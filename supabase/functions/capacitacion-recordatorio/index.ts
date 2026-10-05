import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import nodemailer from "npm:nodemailer@6.9.13"

// Recordatorio por correo del Calendario de capacitaciones.
//
// pg_cron la invoca una vez al día (08:00 hora de México). Toma las capacitaciones activas que
// ocurren dentro de los próximos 3 días (hoy incluido) y que todavía no tienen aviso por correo
// (calendario_capacitaciones.recordatorio_3d_ts IS NULL), y manda UN correo por destinatario con
// todas ellas. Después marca recordatorio_3d_ts para no repetirlo. Si el calendario cambia la
// fecha de una capacitación, el cliente vuelve a poner esa marca en NULL y se avisa de nuevo.
//
// Destinatarios: todos los perfiles activos con correo (unidades, municipales, caravanas,
// jurisdicción y admin).
//
// Payload opcional:
//   { "dry_run": true }              -> devuelve qué se enviaría, sin mandar ni marcar nada.
//   { "test_to": "correo@x.com" }    -> manda SOLO a ese correo la próxima capacitación (sin marcar).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAYS_AHEAD = 3
const TZ = 'America/Mexico_City'
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MODALIDAD: Record<string, string> = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta' }

type Cap = {
  id: string; fecha: string; hora_inicio: string | null; hora_fin: string | null; tema: string; sede: string
  direccion: string | null; modalidad: string; dirigido_a: string | null; notas: string | null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// "YYYY-MM-DD" de hoy en hora de México
function todayMx(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return p // en-CA => YYYY-MM-DD
}
const toUtcDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const addDays = (iso: string, n: number) => { const d = toUtcDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const diffDays = (iso: string, from: string) => Math.round((toUtcDate(iso).getTime() - toUtcDate(from).getTime()) / 86400000)
const longDate = (iso: string) => {
  const d = toUtcDate(iso)
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const horario = (c: Cap) => (c.hora_inicio ? `${hhmm(c.hora_inicio)}${c.hora_fin ? ' a ' + hhmm(c.hora_fin) : ''} h` : '')
const cuando = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`)

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
    const testTo = typeof payload?.test_to === 'string' ? payload.test_to.trim() : ''

    const admin = createClient(supabaseUrl, supabaseServiceKey)
    const hoy = todayMx()

    let caps: Cap[] = []
    if (testTo) {
      const { data, error } = await admin.from('calendario_capacitaciones').select('*')
        .eq('activo', true).gte('fecha', hoy).order('fecha').order('hora_inicio').limit(1)
      if (error) throw new Error(`Error leyendo el calendario: ${error.message}`)
      caps = (data || []) as Cap[]
      if (caps.length === 0) return json({ ok: false, message: 'No hay capacitaciones próximas para armar la prueba.' })
    } else {
      const { data, error } = await admin.from('calendario_capacitaciones').select('*')
        .eq('activo', true).is('recordatorio_3d_ts', null)
        .gte('fecha', hoy).lte('fecha', addDays(hoy, DAYS_AHEAD))
        .order('fecha').order('hora_inicio')
      if (error) throw new Error(`Error leyendo el calendario: ${error.message}`)
      caps = (data || []) as Cap[]
      if (caps.length === 0) return json({ ok: true, message: 'Sin capacitaciones por recordar.', capacitaciones: 0, sent: 0 })
    }

    // Destinatarios
    let emails: string[]
    if (testTo) {
      emails = [testTo]
    } else {
      const { data: profiles, error: profErr } = await admin.from('perfiles').select('email').eq('activo', 'SI')
      if (profErr) throw new Error(`Error obteniendo destinatarios: ${profErr.message}`)
      emails = Array.from(new Set((profiles || [])
        .map((p: any) => String(p.email || '').trim().toLowerCase())
        .filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))))
    }

    if (dryRun) {
      return json({ ok: true, dry_run: true, capacitaciones: caps.map((c) => ({ id: c.id, fecha: c.fecha, tema: c.tema })), destinatarios: emails.length })
    }
    if (emails.length === 0) return json({ ok: false, message: 'No hay destinatarios con correo.' })

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPassword },
      pool: true, maxConnections: 3, maxMessages: 100,
    })

    const subject = (testTo ? '[PRUEBA] ' : '') + subjectFor(caps, hoy)
    const text = textFor(caps, hoy)
    const html = htmlFor(caps, hoy, platformUrl)

    let sent = 0
    let failed = 0
    await Promise.allSettled(emails.map((to) =>
      transporter.sendMail({ from: gmailUser, to, subject, text, html, replyTo: 'no-reply@js1reportes.com' })
        .then(() => { sent++ })
        .catch((err) => { failed++; console.error(`Error enviando recordatorio a ${to}:`, err) })
    ))
    transporter.close()

    // Si el SMTP falló para todos, se deja pendiente para reintentar en la siguiente corrida.
    if (sent > 0 && !testTo) {
      const { error } = await admin.from('calendario_capacitaciones')
        .update({ recordatorio_3d_ts: new Date().toISOString() }).in('id', caps.map((c) => c.id))
      if (error) console.error('No se pudo marcar recordatorio_3d_ts:', error.message)
    }

    return json({
      ok: sent > 0, capacitaciones: caps.length, sent, failed,
      message: sent > 0 ? `Recordatorio enviado a ${sent} destinatario(s).` : 'No se pudo enviar ningún correo; quedan pendientes.',
    })
  } catch (error) {
    console.error('capacitacion-recordatorio error:', error)
    return json({ ok: false, error: (error as Error).message || 'Ocurrió un error inesperado' }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
}

function subjectFor(caps: Cap[], hoy: string) {
  const c = caps[0]
  if (caps.length === 1) return `📅 Capacitación ${cuando(diffDays(c.fecha, hoy))}: ${c.tema}`
  return `📅 ${caps.length} capacitaciones próximas — ${c.tema} y más`
}

function textFor(caps: Cap[], hoy: string) {
  const lines = ['Recordatorio de capacitación — Jurisdicción Sanitaria 1', '']
  for (const c of caps) {
    lines.push(`${c.tema} (${cuando(diffDays(c.fecha, hoy))})`)
    lines.push(`  Fecha: ${longDate(c.fecha)}${horario(c) ? ', ' + horario(c) : ''}`)
    lines.push(`  Sede: ${c.sede}${c.direccion ? ' — ' + c.direccion : ''}`)
    lines.push(`  Modalidad: ${MODALIDAD[c.modalidad] || 'Presencial'}`)
    if (c.dirigido_a) lines.push(`  Dirigido a: ${c.dirigido_a}`)
    if (c.notas) lines.push(`  Notas: ${c.notas}`)
    lines.push('')
  }
  return lines.join('\n')
}

function htmlFor(caps: Cap[], hoy: string, platformUrl: string) {
  const row = (label: string, value: string) => value
    ? `<tr><td style="padding:3px 10px 3px 0;font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:3px 0;font-size:14px;font-weight:600;color:#1e293b;">${value}</td></tr>`
    : ''
  const cards = caps.map((c) => {
    const n = diffDays(c.fecha, hoy)
    return `
      <div style="margin-top:18px;border:1px solid #bfdbfe;border-radius:12px;overflow:hidden;">
        <div style="background:#eff6ff;padding:12px 14px;">
          <span style="display:inline-block;background:#1d4ed8;color:#fff;border-radius:9999px;padding:3px 10px;font-size:11px;font-weight:800;text-transform:uppercase;">${esc(cuando(n))}</span>
          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:8px;line-height:1.3;word-break:break-word;">${esc(c.tema)}</div>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="padding:12px 14px;border-collapse:collapse;"><tbody>
          ${row('Fecha', esc(longDate(c.fecha)))}
          ${row('Horario', esc(horario(c)))}
          ${row('Sede', esc(c.sede))}
          ${row('Dirección', esc(c.direccion || ''))}
          ${row('Modalidad', esc(MODALIDAD[c.modalidad] || 'Presencial'))}
          ${row('Dirigido a', esc(c.dirigido_a || ''))}
          ${row('Notas', esc(c.notas || ''))}
        </tbody></table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:8px;background:#f1f5f9;">
<div style="font-family:'Inter','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #bfdbfe;">
  <div style="background:linear-gradient(135deg,#0b3d91 0%,#1d6fd1 100%);padding:26px 16px;text-align:center;border-radius:13px 13px 0 0;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;">📅 Recordatorio de capacitación</h1>
    <p style="color:#dbeafe;margin:8px 0 0 0;font-size:14px;font-weight:500;">Calendario anual de capacitaciones</p>
  </div>
  <div style="padding:22px 16px;color:#334155;line-height:1.55;">
    <p style="margin:0;font-size:14px;color:#475569;">Se aproxima ${caps.length === 1 ? 'la siguiente capacitación' : 'las siguientes capacitaciones'}. Agenda y confirma tu asistencia:</p>
    ${cards}
    <div style="text-align:center;margin:28px 0 6px 0;">
      <a href="${esc(platformUrl)}" style="background:#1d4ed8;color:#ffffff;padding:13px 30px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;display:inline-block;">Ver calendario en la Plataforma</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:18px 14px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 13px 13px;">
    <p style="margin:0;color:#64748b;font-size:12px;font-weight:500;">Jurisdicción Sanitaria 1 - SIREVAQ</p>
    <p style="margin:5px 0 0 0;color:#94a3b8;font-size:11px;">Correo automático de no-reply. Se envía una sola vez cuando faltan 3 días o menos.</p>
  </div>
</div>
</body></html>`
}
