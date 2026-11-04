import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import nodemailer from "npm:nodemailer@6.9.13"

// Correo a la unidad cuando su SINBA-SIS queda VALIDADO *y liberado*: el municipio ya cerró el mes (antes se mandaba al
// validar y la unidad podía imprimir algo que luego había que reabrir).
// Lo pide la base (_sis06p_liberar_captura -> _sis06p_avisar_validacion -> pg_net) con
// { notificacion_id, captura_id }. Manda UN correo a cada persona activa de esa CLUES y marca
// notificaciones.email_digest_ts para no repetirlo si la petición llegara dos veces.
// Payload opcional { dry_run: true } -> solo dice a quién se enviaría.

const DOMINIOS_RECONOCIDOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'hotmail.com.mx', 'outlook.com', 'outlook.es', 'outlook.com.mx',
  'live.com', 'live.com.mx', 'msn.com', 'yahoo.com', 'yahoo.com.mx', 'yahoo.es', 'ymail.com', 'icloud.com', 'me.com',
  'proton.me', 'protonmail.com', 'aol.com',
])
const correoReconocido = (email: unknown): boolean => {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email ?? '').trim().toLowerCase())
  return !!m && (DOMINIOS_RECONOCIDOS.has(m[1]) || /(^|\.)gob\.mx$/.test(m[1]))
}
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    const platformUrl = Deno.env.get('PLATFORM_URL') ?? 'https://carlosgbd94-design.github.io/SIREVAQ/'

    // Solo la base de datos (service role) puede pedir este correo.
    if ((req.headers.get('Authorization') ?? '') !== `Bearer ${serviceKey}`) return json({ error: 'no autorizado' }, 401)

    const payload = await req.json().catch(() => ({}))
    const dryRun = payload?.dry_run === true
    const notifId = String(payload?.notificacion_id ?? '')
    const capturaId = String(payload?.captura_id ?? '')
    if (!notifId || !capturaId) return json({ error: 'faltan notificacion_id y captura_id' }, 400)

    const db = createClient(supabaseUrl, serviceKey)
    const { data: notif } = await db.from('notificaciones').select('id, email_digest_ts').eq('id', notifId).maybeSingle()
    if (!notif) return json({ error: 'notificación no encontrada' }, 404)
    if (notif.email_digest_ts) return json({ ok: true, omitido: 'ya se había enviado' })

    const { data: cap } = await db.from('sis06p_capturas')
      .select('clues, mes, anio, estado, validado_por, validado_en, excepcion_conciliacion').eq('id', capturaId).maybeSingle()
    if (!cap || cap.estado !== 'VALIDADO') return json({ error: 'el SINBA-SIS no está validado' }, 409)

    const { data: perfiles } = await db.from('perfiles').select('email, nombre, unidad').eq('clues', cap.clues).eq('activo', 'SI')
    const vistos = new Set<string>()
    const destinos = (perfiles ?? []).filter((p: any) => {
      const e = String(p.email || '').trim().toLowerCase()
      if (!correoReconocido(e) || vistos.has(e)) return false
      vistos.add(e); return true
    })
    if (dryRun) return json({ ok: true, dry_run: true, destinatarios: destinos.map((d: any) => d.email) })
    if (!destinos.length) {
      await db.from('notificaciones').update({ email_digest_ts: new Date().toISOString() }).eq('id', notifId)
      return json({ ok: true, enviados: 0, aviso: 'sin correos reconocidos en esa unidad' })
    }
    if (!gmailUser || !gmailPassword) return json({ error: 'sin credenciales de correo' }, 500)

    const periodo = `${MESES[cap.mes - 1]} ${cap.anio}`
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmailUser, pass: gmailPassword } })
    let enviados = 0
    for (const d of destinos as any[]) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <h2 style="color:#15803d;margin:0 0 8px">Tu SINBA-SIS de ${esc(periodo)} ya es definitivo</h2>
        <p>Hola${d.nombre ? ' ' + esc(d.nombre) : ''}: el municipal revisó y validó el SINBA-SIS de <b>${esc(d.unidad || cap.clues)}</b> (${esc(cap.clues)}) correspondiente a <b>${esc(periodo)}</b>, y el municipio ya cerró el mes.</p>
        <ul style="line-height:1.6">
          <li>Ya <b>no se puede editar</b> ese mes.</li>
          <li>Entra a SIREVAQ → SINBA-SIS para <b>exportar el Excel oficial</b> (las 4 hojas) y el PDF del Movimiento, o imprimirlo.</li>
          <li>Si el municipal ajustó algún dato al revisar, ya quedó como la cifra definitiva (no tienes que aceptar nada).</li>
        </ul>
        ${cap.excepcion_conciliacion ? `<p style="background:#fef3c7;padding:8px 12px;border-radius:8px"><b>Se validó con una excepción de conciliación:</b> ${esc(cap.excepcion_conciliacion)}</p>` : ''}
        <p style="color:#6b7280;font-size:13px">Validado por ${esc(cap.validado_por || 'el municipal')}.</p>
        <p><a href="${esc(platformUrl)}" style="background:#15803d;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir SIREVAQ</a></p>
      </div>`
      try {
        await transporter.sendMail({ from: gmailUser, to: d.email, subject: `SINBA-SIS de ${periodo} definitivo — ${d.unidad || cap.clues}`, html })
        enviados++
      } catch (err) { console.error(`Error enviando validación a ${d.email}:`, err) }
    }
    if (enviados > 0) await db.from('notificaciones').update({ email_digest_ts: new Date().toISOString() }).eq('id', notifId)
    return json({ ok: true, enviados, destinatarios: destinos.length })
  } catch (err) {
    console.error('sis-validado-correo:', err)
    return json({ error: String((err as Error)?.message ?? err) }, 500)
  }
})
