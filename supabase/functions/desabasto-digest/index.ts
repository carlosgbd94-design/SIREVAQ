import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import nodemailer from "npm:nodemailer@6.9.13"

// Correo consolidado de desabasto de Esquema Básico.
//
// Antes cada fila ALERTA_DESABASTO disparaba su propio correo (trigger
// notify_desabasto_critico -> email-alerts/send-desabasto-alert), así que una
// tarde de capturas mandaba decenas de correos por destinatario. Ahora las
// alertas quedan pendientes (notificaciones.email_digest_ts IS NULL) y pg_cron
// invoca esta función unas pocas veces al día: cada destinatario recibe UN solo
// correo con todas las unidades de su alcance, agrupadas por municipio.
//
// Payload opcional: { "dry_run": true } -> devuelve qué se enviaría sin mandar
// nada ni marcar las alertas como enviadas.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Solo se consideran alertas de los últimos días: evita reenviar historial
// viejo si alguna vez la columna quedara en NULL.
const PENDING_WINDOW_DAYS = 3
// Ventana para saber qué desabastos "ya se avisaron" y no repetirlos.
const REPORTED_WINDOW_DAYS = 14

type Alerta = { id: string; created_ts: string; clues: string; unidad: string; municipio: string; missing: string[] }

const normalizeMuni = (m: string) =>
  String(m || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// meta_json es jsonb, pero el cliente históricamente lo guarda como texto JSON
// (jsonb "string"): se acepta tanto objeto como cadena.
function parseMeta(raw: unknown): any {
  if (raw && typeof raw === 'object') return raw
  try {
    const v = JSON.parse(String(raw ?? '{}'))
    return v && typeof v === 'object' ? v : {}
  } catch (_e) { return {} }
}

function allowedMunis(p: any): string[] {
  if (Array.isArray(p.municipios_allowed) && p.municipios_allowed.length > 0) {
    return p.municipios_allowed.map(normalizeMuni)
  }
  if (p.municipio) return String(p.municipio).split(',').map(normalizeMuni)
  return []
}


// Une las alertas ACTIVAS por unidad (CLUES): una unidad puede tener varias filas.
function consolidate(rows: { id: string; created_ts: string; meta_json: unknown }[]): Map<string, Alerta> {
  const byClues = new Map<string, Alerta>()
  for (const row of rows) {
    const m = parseMeta(row.meta_json)
    if (m.status !== 'activa') continue // ya se resolvió antes de que saliera el correo
    const clues = String(m.clues || '').trim().toUpperCase()
    if (!clues) continue
    const missing: string[] = Array.isArray(m.missing) ? m.missing : []
    const prev = byClues.get(clues)
    if (prev) {
      prev.missing = Array.from(new Set([...prev.missing, ...missing]))
      prev.id = row.id
      prev.created_ts = row.created_ts
    } else {
      byClues.set(clues, {
        id: row.id, created_ts: row.created_ts, clues,
        unidad: m.unidad || clues, municipio: m.municipio || '', missing: Array.from(new Set(missing))
      })
    }
  }
  return byClues
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    const platformUrl = Deno.env.get('PLATFORM_URL') ?? 'https://carlosgbd94-design.github.io/SIREVAQ/'

    if (!supabaseServiceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
    if (!gmailUser || !gmailPassword) throw new Error('Configuración SMTP incompleta')

    const payload = await req.json().catch(() => ({}))
    const dryRun = payload?.dry_run === true

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const sinceMs = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

    // Prueba: { "test_to": "correo@ejemplo.com" } manda SOLO a ese correo el resumen con los
    // desabastos activos de los últimos días (sin importar si ya se enviaron) y no marca nada.
    const testTo = typeof payload?.test_to === 'string' ? payload.test_to.trim() : ''
    if (testTo) {
      const { data: recent, error: recErr } = await supabaseAdmin
        .from('notificaciones')
        .select('id, created_ts, meta_json')
        .eq('type', 'ALERTA_DESABASTO')
        .gte('created_ts', sinceMs(REPORTED_WINDOW_DAYS))
        .order('created_ts', { ascending: true })
      if (recErr) throw new Error(`Error leyendo alertas para la prueba: ${recErr.message}`)
      const sample = Array.from(consolidate(recent || []).values())
      if (sample.length === 0) return json({ ok: false, message: 'No hay desabastos activos para armar la prueba.' })

      const testTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmailUser, pass: gmailPassword },
      })
      const label = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric',
      }).format(new Date()).replace(/\./g, '')
      await testTransporter.sendMail({
        from: gmailUser,
        to: testTo,
        subject: `[PRUEBA] ${subjectFor(sample, label)}`,
        text: textFor(sample, label),
        html: htmlFor(sample, label, platformUrl),
        replyTo: 'no-reply@js1reportes.com',
      })
      testTransporter.close()
      return json({ ok: true, message: `Correo de prueba enviado a ${testTo} (${sample.length} unidades).` })
    }

    // 1. Alertas pendientes de correo
    const { data: pendingRows, error: pendErr } = await supabaseAdmin
      .from('notificaciones')
      .select('id, created_ts, meta_json')
      .eq('type', 'ALERTA_DESABASTO')
      .is('email_digest_ts', null)
      .gte('created_ts', sinceMs(PENDING_WINDOW_DAYS))
      .order('created_ts', { ascending: true })
    if (pendErr) throw new Error(`Error leyendo alertas pendientes: ${pendErr.message}`)

    if (!pendingRows || pendingRows.length === 0) {
      return json({ ok: true, message: 'Sin alertas de desabasto pendientes.', pending: 0, sent: 0 })
    }

    // 2. Lo que ya se avisó por correo y sigue activo (para no repetirlo)
    const { data: reportedRows, error: repErr } = await supabaseAdmin
      .from('notificaciones')
      .select('meta_json')
      .eq('type', 'ALERTA_DESABASTO')
      .not('email_digest_ts', 'is', null)
      .gte('created_ts', sinceMs(REPORTED_WINDOW_DAYS))
    if (repErr) throw new Error(`Error leyendo alertas ya enviadas: ${repErr.message}`)

    const alreadyReported = new Map<string, Set<string>>()
    for (const r of reportedRows || []) {
      const m = parseMeta(r.meta_json)
      if (m.status !== 'activa' || !m.clues || !Array.isArray(m.missing)) continue
      const key = String(m.clues).trim().toUpperCase()
      if (!alreadyReported.has(key)) alreadyReported.set(key, new Set())
      m.missing.forEach((b: string) => alreadyReported.get(key)!.add(b))
    }

    // 3. Consolidar por unidad (una unidad puede tener varias alertas pendientes)
    const byClues = consolidate(pendingRows)
    const units: Alerta[] = Array.from(byClues.values()).filter((u) => {
      const known = alreadyReported.get(u.clues)
      return !(known && u.missing.length > 0 && u.missing.every((b) => known.has(b)))
    })

    // 4. Destinatarios y su alcance (mismo criterio que fanout_notification_trigger)
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('perfiles')
      .select('email, rol, municipio, municipios_allowed')
      .in('rol', ['ADMIN', 'JURISDICCIONAL', 'MUNICIPAL', 'CARAVANAS'])
    if (profErr) throw new Error(`Error obteniendo destinatarios: ${profErr.message}`)

    const seenEmails = new Set<string>()
    const plans: { email: string; units: Alerta[] }[] = []
    for (const p of profiles || []) {
      const email = String(p.email || '').trim().toLowerCase()
      if (!email || seenEmails.has(email)) continue
      let scoped: Alerta[]
      if (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') {
        scoped = units
      } else {
        const munis = allowedMunis(p)
        scoped = munis.includes('*') ? units : units.filter((u) => munis.includes(normalizeMuni(u.municipio)))
      }
      if (scoped.length === 0) continue
      seenEmails.add(email)
      plans.push({ email, units: scoped })
    }

    const allProcessedIds = pendingRows.map((r) => r.id)

    if (dryRun) {
      return json({
        ok: true, dry_run: true, pending: pendingRows.length, unidades: units.length,
        destinatarios: plans.map((p) => ({ email: p.email, unidades: p.units.length })),
      })
    }

    const markProcessed = async () => {
      const { error } = await supabaseAdmin
        .from('notificaciones')
        .update({ email_digest_ts: new Date().toISOString() })
        .in('id', allProcessedIds)
      if (error) console.error('No se pudo marcar email_digest_ts:', error.message)
    }

    if (plans.length === 0) {
      await markProcessed()
      return json({ ok: true, message: 'Alertas procesadas sin destinatarios en alcance.', pending: pendingRows.length, sent: 0 })
    }

    // 5. Un correo por destinatario
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPassword },
      pool: true, maxConnections: 3, maxMessages: 100,
    })

    const todayLabel = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date()).replace(/\./g, '')

    let sent = 0
    let failed = 0
    const sends = plans.map((plan) =>
      transporter.sendMail({
        from: gmailUser,
        to: plan.email,
        subject: subjectFor(plan.units, todayLabel),
        text: textFor(plan.units, todayLabel),
        html: htmlFor(plan.units, todayLabel, platformUrl),
        replyTo: 'no-reply@js1reportes.com',
      }).then(() => { sent++ }).catch((err) => {
        failed++
        console.error(`Error enviando desabasto a ${plan.email}:`, err)
      })
    )
    await Promise.allSettled(sends)
    transporter.close()

    // Si el SMTP falló para todos, se dejan pendientes para reintentar en la siguiente corrida.
    if (sent > 0) await markProcessed()

    return json({
      ok: sent > 0, pending: pendingRows.length, unidades: units.length, sent, failed,
      message: sent > 0
        ? `Resumen de desabasto enviado a ${sent} destinatario(s) (${units.length} unidades).`
        : 'No se pudo enviar ningún correo; las alertas siguen pendientes.',
    })
  } catch (error) {
    console.error('desabasto-digest error:', error)
    return json({ ok: false, error: (error as Error).message || 'Ocurrió un error inesperado' }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
}

function groupByMuni(units: Alerta[]): [string, Alerta[]][] {
  const map = new Map<string, Alerta[]>()
  for (const u of units) {
    const k = String(u.municipio || 'SIN MUNICIPIO').trim().toUpperCase()
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(u)
  }
  return Array.from(map.entries())
    .map(([k, list]) => [k, list.sort((a, b) => a.unidad.localeCompare(b.unidad, 'es'))] as [string, Alerta[]])
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'))
}

function topBiologicos(units: Alerta[]): [string, number][] {
  const count = new Map<string, number>()
  units.forEach((u) => u.missing.forEach((b) => count.set(b, (count.get(b) || 0) + 1)))
  return Array.from(count.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
}

function subjectFor(units: Alerta[], today: string) {
  if (units.length === 1) return `🚨 Desabasto: ${units[0].unidad} (${units[0].missing.join(', ') || 'Esquema Básico'})`
  return `🚨 Desabasto de Esquema Básico: ${units.length} unidades — ${today}`
}

function textFor(units: Alerta[], today: string) {
  const lines = [`Desabasto de Esquema Básico — ${today}`, `${units.length} unidad(es) reportaron desabasto.`, '']
  for (const [muni, list] of groupByMuni(units)) {
    lines.push(`${muni} (${list.length})`)
    list.forEach((u) => lines.push(`  • ${u.unidad} (${u.clues}): ${u.missing.join(', ') || 'No especificado'}`))
    lines.push('')
  }
  return lines.join('\n')
}

function htmlFor(units: Alerta[], today: string, platformUrl: string) {
  const groups = groupByMuni(units)
  const tops = topBiologicos(units).slice(0, 8)

  const chips = tops.map(([b, n]) =>
    `<span style="display:inline-block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:9999px;padding:4px 10px;margin:0 6px 6px 0;font-size:12px;font-weight:700;">${esc(b)} · ${n}</span>`
  ).join('')

  const sections = groups.map(([muni, list]) => {
    const rows = list.map((u) => `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #f1f5f9;">
            <div style="font-size:14px;font-weight:700;color:#1e293b;line-height:1.3;word-break:break-word;">${esc(u.unidad)}</div>
            <div style="font-family:monospace;font-size:11px;color:#64748b;margin-top:2px;">${esc(u.clues)}</div>
            <div style="font-size:13px;font-weight:700;color:#991b1b;margin-top:5px;">${esc(u.missing.join(', ') || 'No especificado')}</div>
          </td>
        </tr>`).join('')
    return `
      <div style="margin-top:22px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;"><tr>
          <td style="padding:12px;font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#0f172a;">📍 ${esc(muni)}</td>
          <td align="right" style="padding:12px;white-space:nowrap;font-size:12px;font-weight:800;color:#b91c1c;">${list.length} unidad${list.length === 1 ? '' : 'es'}</td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:8px;background:#f1f5f9;">
<div style="font-family:'Inter','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #fecaca;">
  <div style="background:linear-gradient(135deg,#b91c1c 0%,#ef4444 100%);padding:26px 16px;text-align:center;border-radius:13px 13px 0 0;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;">🚨 Desabasto de Esquema Básico</h1>
    <p style="color:#fee2e2;margin:8px 0 0 0;font-size:14px;font-weight:500;">${units.length} unidad${units.length === 1 ? '' : 'es'} · ${groups.length} municipio${groups.length === 1 ? '' : 's'} · ${esc(today)}</p>
  </div>
  <div style="padding:24px 16px;color:#334155;line-height:1.55;">
    <p style="margin:0 0 14px 0;font-size:14px;color:#475569;">Estas unidades capturaron sin existencias desde el último aviso:</p>
    <div>${chips}</div>
    ${sections}
    <div style="text-align:center;margin:30px 0 6px 0;">
      <a href="${esc(platformUrl)}" style="background:#b91c1c;color:#ffffff;padding:13px 30px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;display:inline-block;">Ver en la Plataforma</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:18px 14px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 13px 13px;">
    <p style="margin:0;color:#64748b;font-size:12px;font-weight:500;">Jurisdicción Sanitaria 1 - SIREVAQ</p>
    <p style="margin:5px 0 0 0;color:#94a3b8;font-size:11px;">Correo automático de no-reply. Los desabastos se consolidan en un solo aviso por corrida.</p>
  </div>
</div>
</body></html>`
}
