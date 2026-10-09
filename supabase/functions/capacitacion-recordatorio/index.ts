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

// Solo se mandan reportes y resúmenes a correos de proveedores reconocidos (Gmail, Hotmail/Outlook, Yahoo, iCloud...)
// o institucionales (.gob.mx): las cuentas de prueba con dominios inventados no reciben nada.
const DOMINIOS_RECONOCIDOS = new Set([
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.es', 'hotmail.com.mx', 'outlook.com', 'outlook.es', 'outlook.com.mx', 'live.com', 'live.com.mx', 'msn.com',
  'yahoo.com', 'yahoo.com.mx', 'yahoo.es', 'ymail.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com',
])
const correoReconocido = (email: unknown): boolean => {
  const e = String(email ?? '').trim().toLowerCase()
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(e)
  if (!m) return false
  const d = m[1]
  return DOMINIOS_RECONOCIDOS.has(d) || /(^|\.)gob\.mx$/.test(d)
}

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
        .filter((e: string) => correoReconocido(e))))
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

const MESES_C = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const MOD_ICON: Record<string, string> = { PRESENCIAL: '🏢', VIRTUAL: '💻', MIXTA: '🔀' }

function htmlFor(caps: Cap[], hoy: string, platformUrl: string) {
  // Todo con tablas e estilos en línea: es lo único que Gmail/Outlook respetan igual.
  const detail = (icon: string, label: string, value: string, extra = '') => value ? `
        <tr>
          <td style="padding:0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f7;"><tr>
              <td width="44" valign="top" style="padding:14px 0;">
                <div style="width:34px;height:34px;line-height:34px;text-align:center;font-size:16px;background:#eff6ff;border-radius:10px;">${icon}</div>
              </td>
              <td valign="top" style="padding:14px 0 14px 4px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;">${label}</div>
                <div style="font-size:15px;font-weight:600;color:#0f172a;line-height:1.4;margin-top:2px;">${value}</div>
                ${extra}
              </td>
            </tr></table>
          </td>
        </tr>` : ''

  const cards = caps.map((c) => {
    const n = diffDays(c.fecha, hoy)
    const d = toUtcDate(c.fecha)
    const urgent = n <= 1
    const pillBg = urgent ? '#fff7ed' : '#eff6ff'
    const pillFg = urgent ? '#c2410c' : '#1d4ed8'
    const dir = c.direccion ? `<div style="font-size:13px;font-weight:500;color:#64748b;line-height:1.4;margin-top:3px;">${esc(c.direccion)}</div>` : ''
    const notas = c.notas ? `
        <tr><td style="padding:4px 20px 20px 20px;">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#b45309;">📝 Importante</div>
            <div style="font-size:14px;font-weight:500;color:#78350f;line-height:1.5;margin-top:4px;">${esc(c.notas)}</div>
          </div>
        </td></tr>` : '<tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>'
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #dbe3ef;border-radius:18px;background:#ffffff;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:20px 20px 16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="72" valign="top">
              <table role="presentation" width="68" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;border:1px solid #bfdbfe;border-collapse:separate;">
                <tr><td align="center" bgcolor="#1d4ed8" style="background:#1d4ed8;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:1.2px;padding:5px 0;">${MESES_C[d.getUTCMonth()]}</td></tr>
                <tr><td align="center" bgcolor="#eff6ff" style="background:#eff6ff;color:#0f172a;font-size:30px;font-weight:800;line-height:1;padding:10px 0 2px 0;">${d.getUTCDate()}</td></tr>
                <tr><td align="center" bgcolor="#eff6ff" style="background:#eff6ff;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:0 0 8px 0;">${DIAS[d.getUTCDay()].slice(0, 3)}</td></tr>
              </table>
            </td>
            <td valign="top" style="padding-left:6px;">
              <span style="display:inline-block;background:${pillBg};color:${pillFg};border-radius:9999px;padding:4px 12px;font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;">${esc(cuando(n))}</span>
              <div style="font-size:19px;font-weight:800;color:#0f172a;line-height:1.3;margin-top:8px;word-break:break-word;">${esc(c.tema)}</div>
            </td>
          </tr></table>
        </td>
      </tr>
      ${detail('🕗', 'Horario', esc(horario(c)))}
      ${detail('📍', 'Sede', esc(c.sede), dir)}
      ${detail(MOD_ICON[c.modalidad] || '🏢', 'Modalidad', esc(MODALIDAD[c.modalidad] || 'Presencial'))}
      ${detail('👥', 'Dirigido a', esc(c.dirigido_a || ''))}
      ${notas}
    </table>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef2f7" style="background:#eef2f7;"><tr><td align="center" style="padding:16px 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:'Inter','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <tr><td align="center" bgcolor="#0b3d91" style="background:#0b3d91;background-image:linear-gradient(135deg,#0b3d91 0%,#1d6fd1 100%);border-radius:20px 20px 0 0;padding:32px 20px 28px 20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#93c5fd;text-transform:uppercase;">Jurisdicción Sanitaria 1</div>
      <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:10px;line-height:1.2;">📅 Recordatorio de capacitación</div>
      <div style="font-size:14px;font-weight:500;color:#dbeafe;margin-top:8px;">${caps.length === 1 ? 'Se aproxima tu próxima capacitación' : 'Se aproximan ' + caps.length + ' capacitaciones'}</div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:4px 16px 28px 16px;">
      ${cards}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:28px;">
        <a href="${esc(platformUrl)}" style="background:#1d4ed8;color:#ffffff;padding:14px 34px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">Ver calendario completo</a>
        <div style="font-size:12px;color:#94a3b8;margin-top:12px;font-weight:500;">Consulta todas las fechas y sedes del año en la plataforma.</div>
      </td></tr></table>
    </td></tr>
    <tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;border-top:1px solid #e2e8f0;border-radius:0 0 20px 20px;padding:20px 16px;">
      <div style="font-size:12px;font-weight:700;color:#64748b;">Jurisdicción Sanitaria 1 · SIREVAQ</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.5;">Correo automático, no respondas a este mensaje.<br>Se envía una sola vez cuando faltan 3 días o menos.</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}
