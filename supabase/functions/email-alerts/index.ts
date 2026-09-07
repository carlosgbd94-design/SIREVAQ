import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import nodemailer from "npm:nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    const platformUrl = Deno.env.get('PLATFORM_URL') ?? 'https://carlosgbd94-design.github.io/SIREVAQ/'

    if (!supabaseServiceKey) {
      throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
    }
    if (!gmailUser || !gmailPassword) {
      throw new Error('Configuración SMTP incompleta')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Leer payload
    const payload = await req.json().catch(() => ({}))
    const action = payload.action || 'send-reminders' // 'send-reminders' o 'send-summaries'
    
    // Obtener la fecha y el día de la semana locales de México
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    // Convertir a fecha local para determinar el día de la semana
    const localTimeStr = now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
    const localTime = new Date(localTimeStr)
    const dayOfWeek = localTime.getDay() // 0 = Dom, 1 = Lun, ..., 4 = Jue, 5 = Vie
    
    // Normalizador de municipios para evitar fallos por acentos
    const normalizeMuni = (m: string) => {
      return String(m || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
    }

    // Función para limpiar HTML y evitar codificación "=20" de espacios al final de las líneas
    const cleanHtml = (html: string) => {
      return html
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim().length > 0)
        .join('\n')
    }
    
    const todayYmd = formatter.format(localTime) // YYYY-MM-DD
    
    const yesterday = new Date(localTime)
    yesterday.setDate(localTime.getDate() - 1)
    const yesterdayYmd = formatter.format(yesterday)

    console.log(`[ALERTA LOG] Fecha Local: ${todayYmd}, Día de la Semana: ${dayOfWeek}, Acción: ${action}`)

    // 1. Obtener catálogo de unidades médicas activas
    const { data: rawUnits, error: unitsErr } = await supabaseAdmin
      .from('unidades')
      .select('clues, unidad, municipio')
      .eq('activo', 'SI')
      .order('unidad')
    
    if (unitsErr) throw new Error(`Error obteniendo unidades: ${unitsErr.message}`)
    
    const activeUnits = rawUnits || []

    // 2. Obtener capturas de hoy y de ayer
    const [resBioToday, resConsToday, resBioYesterday] = await Promise.all([
      supabaseAdmin.from('biologicos_existencia').select('clues').eq('fecha', todayYmd),
      supabaseAdmin.from('consumibles').select('clues').eq('fecha', todayYmd),
      supabaseAdmin.from('biologicos_existencia').select('clues').eq('fecha', yesterdayYmd)
    ])

    const capturedBioToday = new Set((resBioToday.data || []).map(r => String(r.clues).trim().toUpperCase()))
    const capturedConsToday = new Set((resConsToday.data || []).map(r => String(r.clues).trim().toUpperCase()))
    const capturedBioYesterday = new Set((resBioYesterday.data || []).map(r => String(r.clues).trim().toUpperCase()))

    // Configurar cliente SMTP con nodemailer (pool para permitir envíos concurrentes)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    })

    if (action === 'send-reminders') {
      // --- RECORDATORIOS DE CAPTURA INDIVIDUALES (A LAS 14:30) ---
      let sentCount = 0

      // Obtener perfiles de rol UNIDAD para mandarles el correo
      const { data: userProfiles, error: profErr } = await supabaseAdmin
        .from('perfiles')
        .select('email, clues_asignado')
        .eq('rol', 'UNIDAD')

      if (profErr) throw new Error(`Error obteniendo perfiles de unidades: ${profErr.message}`)

      const reminderSends: Promise<void>[] = []

      for (const unit of activeUnits) {
        const unitClues = String(unit.clues).trim().toUpperCase()
        const userForUnit = (userProfiles || []).find(p => String(p.clues_asignado).trim().toUpperCase() === unitClues)

        if (!userForUnit?.email) continue

        const missingItems = []

        if (dayOfWeek === 5) {
          // Viernes: Solo verificamos biológicos. Si no capturó ni jueves ni viernes, enviamos recordatorio
          const bioOk = capturedBioToday.has(unitClues) || capturedBioYesterday.has(unitClues)
          if (!bioOk) {
            missingItems.push('Existencias de biológico')
          }
        } else {
          // Jueves (o cualquier otro día de prueba): Verificamos ambos del día de hoy
          const bioOk = capturedBioToday.has(unitClues)
          const consOk = capturedConsToday.has(unitClues)

          if (!consOk) missingItems.push('Consumibles')
          if (!bioOk) missingItems.push('Existencias de biológico')
        }

        if (missingItems.length > 0) {
          const htmlBody = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
    <div style="background-color: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px auto; text-align: center;">
      <span style="font-size: 30px; line-height: 60px; display: block;">⏱️</span>
    </div>
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Acción Requerida</h1>
    <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">Recordatorio de Captura Diario</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Estimado(a) capturista de la unidad <strong style="color: #1e40af; font-weight: 700;">${unit.unidad}</strong>,</p>
    <p style="font-size: 15px; color: #475569;">El sistema ha detectado que aún existen registros pendientes correspondientes a tu unidad para el día de hoy:</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #ef4444; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <div style="color: #b91c1c; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Pendiente de Capturar</div>
      <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 16px; font-weight: 600;">
        ${missingItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}
      </ul>
    </div>
    
    <p style="font-size: 15px; color: #475569;">Te solicitamos ingresar a la plataforma a la brevedad para realizar tu registro y mantener los indicadores actualizados.</p>
    
    <div style="text-align: center; margin: 40px 0 10px 0;">
      <a href="${platformUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -2px rgba(37, 99, 235, 0.2);">Acceder a la Plataforma</a>
    </div>
  </div>
  
  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - SIREVAQ</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

          reminderSends.push(
            transporter.sendMail({
              from: gmailUser,
              to: userForUnit.email,
              subject: `Aviso Pendiente: Captura en ${unit.unidad}`,
              text: `Recordatorio de captura pendiente para ${unit.unidad}: ${missingItems.join(', ')}`,
              html: htmlBody,
              replyTo: 'no-reply@js1reportes.com'
            }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando recordatorio a ${userForUnit.email}:`, err))
          )
        }
      }

      await Promise.allSettled(reminderSends)
      transporter.close()

      return new Response(JSON.stringify({ ok: true, message: `Recordatorios individuales enviados: ${sentCount} correos.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'send-summaries') {
      // --- RESÚMENES DE CAPTURA (A LAS 18:00) ---
      // Determinamos qué métrica reportar hoy
      // Jueves reportamos CONSUMIBLES
      // Viernes (o cualquier otro día) reportamos BIOLÓGICOS (Jueves + Viernes)
      const reportType = (dayOfWeek === 4) ? 'CONSUMIBLES' : 'BIOLOGICOS'
      
      // Obtener perfiles de usuarios
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from('perfiles')
        .select('email, rol, municipio, municipios_allowed')
        .in('rol', ['MUNICIPAL', 'ADMIN', 'JURISDICCIONAL', 'CARAVANAS'])

      if (profErr) throw new Error(`Error obteniendo perfiles de supervisión: ${profErr.message}`)

      let sentCount = 0

      // Helper para renderizar los badges de estado
      const renderStatusBadge = (isOk: boolean) => {
        return isOk 
          ? `<span style="background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Completado</span>`
          : `<span style="background-color: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Pendiente</span>`
      }

      // Enviar a perfiles MUNICIPALES (solo sus unidades correspondientes)
      const summarySends: Promise<void>[] = []
      const municipalProfiles = (profiles || []).filter(p => p.rol === 'MUNICIPAL' && p.email)
      for (const supervisor of municipalProfiles) {
        let allowedMunis: string[] = []
        if (Array.isArray(supervisor.municipios_allowed) && supervisor.municipios_allowed.length > 0) {
          allowedMunis = supervisor.municipios_allowed.map(normalizeMuni)
        } else if (supervisor.municipio) {
          allowedMunis = String(supervisor.municipio).split(',').map(normalizeMuni)
        }

        if (allowedMunis.length === 0) continue

        const muniUnits = activeUnits.filter(u => allowedMunis.includes(normalizeMuni(u.municipio)))

        if (muniUnits.length === 0) continue

        const muniLabel = allowedMunis.join(', ')

        let completedCount = 0
        const rowsHtml = muniUnits.map(unit => {
          const uClues = String(unit.clues).trim().toUpperCase()
          
          // Estatus dependiendo del reporte de hoy
          const isOk = (reportType === 'CONSUMIBLES')
            ? capturedConsToday.has(uClues)
            : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
          
          if (isOk) completedCount++

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #1e293b;">${unit.unidad}</td>
              <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #64748b;">${unit.clues}</td>
              <td style="padding: 12px 16px; text-align: center;">${renderStatusBadge(isOk)}</td>
            </tr>
          `
        }).join('')

        const pct = Math.round((completedCount / muniUnits.length) * 100)
        const progressColor = pct === 100 ? '#10b981' : (pct >= 70 ? '#f59e0b' : '#ef4444')

        const htmlBody = `
<div style="font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 35px -5px rgba(0, 51, 102, 0.08), 0 10px 15px -8px rgba(0, 51, 102, 0.04); border: 1px solid #e2e8f0; border-top: 6px solid #2563eb;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 35px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">Resumen de Captura</h1>
    <p style="color: #38bdf8; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px;">Módulo: ${reportType} | Región: ${muniLabel}</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a; font-weight: 700;">Estimado(a) Coordinador(a),</p>
    <p style="font-size: 15px; color: #475569; margin-bottom: 25px;">Te compartimos el estatus de captura de hoy <strong style="color: #1e293b; font-weight: 800;">${todayYmd}</strong> para las unidades a tu cargo:</p>
    
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.04);">
      <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Avance de Captura</div>
      <div style="font-size: 54px; font-weight: 900; color: ${progressColor}; margin: 8px 0 4px 0; letter-spacing: -2px; line-height: 1;">${pct}%</div>
      <div style="background-color: #f1f5f9; border-radius: 9999px; height: 8px; width: 80%; margin: 15px auto 12px auto; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: ${progressColor}; height: 100%; width: ${pct}%; border-radius: 9999px;"></div>
      </div>
      <div style="font-size: 13.5px; color: #475569; font-weight: 600;">
        Unidades Completadas: <strong style="color: #0f172a; font-weight: 800;">${completedCount}</strong> de <strong style="color: #0f172a; font-weight: 800;">${muniUnits.length}</strong>
      </div>
    </div>
    
    <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-top: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: left; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Unidad</th>
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">CLUES</th>
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>

  <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">SIREVAQ - Jurisdicción Sanitaria 1</p>
    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        summarySends.push(
          transporter.sendMail({
            from: gmailUser,
            to: supervisor.email,
            subject: `Reporte ${reportType}: Región ${muniLabel} (${pct}% Capturado) - ${todayYmd}`,
            text: `Resumen de captura para ${muniLabel}.`,
            html: htmlBody,
            replyTo: 'no-reply@js1reportes.com'
          }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando resumen municipal a ${supervisor.email}:`, err))
        )
      }

      // Enviar a perfiles CARAVANAS (solo unidades UMME y FAM)
      const caravanasProfiles = (profiles || []).filter(p => p.rol === 'CARAVANAS' && p.email)
      for (const supervisor of caravanasProfiles) {
        const caravanaUnits = activeUnits.filter(u => {
          const name = String(u.unidad || '').trim().toUpperCase()
          return name.startsWith('FAM') || name.startsWith('UMME')
        })

        if (caravanaUnits.length === 0) continue

        let completedCount = 0
        const rowsHtml = caravanaUnits.map(unit => {
          const uClues = String(unit.clues).trim().toUpperCase()
          
          const isOk = (reportType === 'CONSUMIBLES')
            ? capturedConsToday.has(uClues)
            : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
          
          if (isOk) completedCount++

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #1e293b;">${unit.unidad}</td>
              <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #64748b;">${unit.clues}</td>
              <td style="padding: 12px 16px; text-align: center;">${renderStatusBadge(isOk)}</td>
            </tr>
          `
        }).join('')

        const pct = Math.round((completedCount / caravanaUnits.length) * 100)
        const progressColor = pct === 100 ? '#10b981' : (pct >= 70 ? '#f59e0b' : '#ef4444')
        const regionLabel = 'CARAVANAS MÓVILES (UMME/FAM)'

        const htmlBody = `
<div style="font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 35px -5px rgba(0, 51, 102, 0.08), 0 10px 15px -8px rgba(0, 51, 102, 0.04); border: 1px solid #e2e8f0; border-top: 6px solid #10b981;">
  <div style="background: linear-gradient(135deg, #047857 0%, #065f46 50%, #022c22 100%); padding: 35px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">Resumen de Captura</h1>
    <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px;">Módulo: ${reportType} | Región: ${regionLabel}</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a; font-weight: 700;">Estimado(a) Coordinador(a),</p>
    <p style="font-size: 15px; color: #475569; margin-bottom: 25px;">Te compartimos el estatus de captura de hoy <strong style="color: #1e293b; font-weight: 800;">${todayYmd}</strong> para las caravanas a tu cargo:</p>
    
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.04);">
      <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Avance de Captura</div>
      <div style="font-size: 54px; font-weight: 900; color: ${progressColor}; margin: 8px 0 4px 0; letter-spacing: -2px; line-height: 1;">${pct}%</div>
      <div style="background-color: #f1f5f9; border-radius: 9999px; height: 8px; width: 80%; margin: 15px auto 12px auto; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: ${progressColor}; height: 100%; width: ${pct}%; border-radius: 9999px;"></div>
      </div>
      <div style="font-size: 13.5px; color: #475569; font-weight: 600;">
        Unidades Completadas: <strong style="color: #0f172a; font-weight: 800;">${completedCount}</strong> de <strong style="color: #0f172a; font-weight: 800;">${caravanaUnits.length}</strong>
      </div>
    </div>
    
    <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-top: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: left; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Unidad</th>
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">CLUES</th>
            <th style="padding: 14px 20px; font-size: 11px; font-weight: 800; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>

  <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">SIREVAQ - Jurisdicción Sanitaria 1</p>
    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        summarySends.push(
          transporter.sendMail({
            from: gmailUser,
            to: supervisor.email,
            subject: `Reporte ${reportType}: CARAVANAS (${pct}% Capturado) - ${todayYmd}`,
            text: `Resumen de captura para Caravanas Móviles.`,
            html: htmlBody,
            replyTo: 'no-reply@js1reportes.com'
          }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando resumen de caravanas a ${supervisor.email}:`, err))
        )
      }

      // Enviar a perfiles JURISDICCIONALES Y ADMIN (Resumen general de todas las unidades, separado por municipio)
      const adminProfiles = (profiles || []).filter(p => (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') && p.email)
      
      if (adminProfiles.length > 0) {
        // Agrupar unidades por municipio
        const unitsByMuni: { [key: string]: typeof activeUnits } = {}
        activeUnits.forEach(u => {
          const mKey = normalizeMuni(u.municipio)
          if (!unitsByMuni[mKey]) unitsByMuni[mKey] = []
          unitsByMuni[mKey].push(u)
        })

        // Generar secciones de HTML para cada municipio
        let totalCompleted = 0
        const municipiosHtml = Object.keys(unitsByMuni).map(muniName => {
          const muniUnits = unitsByMuni[muniName]
          let muniCompleted = 0

          const rows = muniUnits.map(unit => {
            const uClues = String(unit.clues).trim().toUpperCase()
            const isOk = (reportType === 'CONSUMIBLES')
              ? capturedConsToday.has(uClues)
              : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
            
            if (isOk) {
              muniCompleted++
              totalCompleted++
            }

            return `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; font-size: 13px; color: #334155;">${unit.unidad}</td>
                <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #64748b;">${unit.clues}</td>
                <td style="padding: 8px 12px; text-align: center;">${renderStatusBadge(isOk)}</td>
              </tr>
            `
          }).join('')

          const muniPct = muniUnits.length > 0 ? Math.round((muniCompleted / muniUnits.length) * 100) : 0

          return `
            <div style="margin-top: 25px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
              <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 14px 20px; font-weight: 800; color: #0f172a; font-size: 13.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">📍 Municipio: ${muniName}</td>
                  <td style="padding: 14px 20px; text-align: right;">
                    <span style="font-weight: 800; color: ${muniPct === 100 ? '#10b981' : '#f59e0b'}; font-size: 13px; background: ${muniPct === 100 ? '#e6fbf2' : '#fffdf0'}; padding: 4px 12px; border-radius: 9999px; display: inline-block;">${muniPct}% (${muniCompleted}/${muniUnits.length})</span>
                  </td>
                </tr>
              </table>
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          `
        }).join('')

        const totalPct = activeUnits.length > 0 ? Math.round((totalCompleted / activeUnits.length) * 100) : 0

        const htmlBodyAdmin = `
<div style="font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif; max-width: 750px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 35px -5px rgba(0, 51, 102, 0.08), 0 10px 15px -8px rgba(0, 51, 102, 0.04); border: 1px solid #e2e8f0; border-top: 6px solid #1e3a8a;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 50%, #0f172a 100%); padding: 35px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">Reporte General Jurisdiccional</h1>
    <p style="color: #93c5fd; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px;">Jurisdicción Sanitaria 1 | Módulo: ${reportType}</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a; font-weight: 700;">Estimado(a) Administrador(a) / Personal Jurisdiccional,</p>
    <p style="font-size: 15px; color: #475569; margin-bottom: 25px;">Se presenta el consolidado de capturas generales de hoy <strong style="color: #1e293b; font-weight: 800;">${todayYmd}</strong>:</p>
    
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.04);">
      <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Estatus Jurisdiccional Global</div>
      <div style="font-size: 54px; font-weight: 900; color: #1e3a8a; margin: 8px 0 4px 0; letter-spacing: -2px; line-height: 1;">${totalPct}%</div>
      <div style="background-color: #f1f5f9; border-radius: 9999px; height: 8px; width: 80%; margin: 15px auto 12px auto; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #1e3a8a; height: 100%; width: ${totalPct}%; border-radius: 9999px;"></div>
      </div>
      <div style="font-size: 13.5px; color: #475569; font-weight: 600;">
        Total General: <strong style="color: #0f172a; font-weight: 800;">${totalCompleted}</strong> de <strong style="color: #0f172a; font-weight: 800;">${activeUnits.length}</strong> unidades capturadas
      </div>
    </div>
    
    <h3 style="color: #0f172a; font-size: 18px; font-weight: 900; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Consolidado por Municipios</h3>
    ${municipiosHtml}
  </div>

  <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">SIREVAQ - Jurisdicción Sanitaria 1</p>
    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        for (const admin of adminProfiles) {
          summarySends.push(
            transporter.sendMail({
              from: gmailUser,
              to: admin.email,
              subject: `[GENERAL] Reporte JS1 ${reportType} (${totalPct}% Global) - ${todayYmd}`,
              text: `Estatus general de captura: ${totalCompleted}/${activeUnits.length} completadas.`,
              html: htmlBodyAdmin,
              replyTo: 'no-reply@js1reportes.com'
            }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando resumen general a ${admin.email}:`, err))
          )
        }
      }

      await Promise.allSettled(summarySends)
      transporter.close()

      return new Response(JSON.stringify({ ok: true, message: `Reportes generales y municipales enviados: ${sentCount} correos.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'send-desabasto-alert') {
      // --- ALERTA INMEDIATA DE DESABASTO CRÍTICO ---
      // Disparada por un Database Webhook (trigger en public.notificaciones, ver
      // migración add_desabasto_critico_webhook) apenas se inserta una fila
      // type = 'ALERTA_DESABASTO'. No espera al cron de jueves/viernes.
      let meta: any = {}
      try {
        meta = typeof payload.meta === 'string' ? JSON.parse(payload.meta) : (payload.meta || {})
      } catch (_e) { meta = {} }

      const alertMunicipio = normalizeMuni(meta.municipio || '')
      const alertUnidad = meta.unidad || 'Unidad no especificada'
      const alertClues = meta.clues || ''
      const missing: string[] = Array.isArray(meta.missing) ? meta.missing : []
      const alertMessage = payload.message || `La unidad ${alertUnidad} capturó sin existencias.`

      const { data: criticalProfiles, error: critErr } = await supabaseAdmin
        .from('perfiles')
        .select('email, rol, municipio, municipios_allowed')
        .in('rol', ['ADMIN', 'JURISDICCIONAL', 'MUNICIPAL', 'CARAVANAS'])

      if (critErr) throw new Error(`Error obteniendo destinatarios de desabasto: ${critErr.message}`)

      // ADMIN/JURISDICCIONAL siempre reciben. MUNICIPAL/CARAVANAS solo si el
      // municipio de la alerta está dentro de su alcance (mismo criterio que
      // fanout_notification_trigger usa para el scope MUNICIPIO).
      const recipients = (criticalProfiles || []).filter((p: any) => {
        if (!p.email) return false
        if (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') return true
        let allowedMunis: string[] = []
        if (Array.isArray(p.municipios_allowed) && p.municipios_allowed.length > 0) {
          allowedMunis = p.municipios_allowed.map(normalizeMuni)
        } else if (p.municipio) {
          allowedMunis = String(p.municipio).split(',').map(normalizeMuni)
        }
        return allowedMunis.includes('*') || (alertMunicipio !== '' && allowedMunis.includes(alertMunicipio))
      })

      const htmlBody = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 2px solid #fecaca;">
  <div style="background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%); padding: 30px 20px; text-align: center;">
    <div style="background-color: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px auto; text-align: center;">
      <span style="font-size: 30px; line-height: 60px; display: block;">🚨</span>
    </div>
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Desabasto Crítico</h1>
    <p style="color: #fee2e2; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">Alerta inmediata — Esquema Básico</p>
  </div>

  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 15px; color: #475569;">${alertMessage}</p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #ef4444; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <div style="color: #b91c1c; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Sin existencias</div>
      <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 16px; font-weight: 600;">
        ${missing.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('') || '<li>No especificado</li>'}
      </ul>
      <div style="margin-top: 14px; font-size: 13px; color: #7f1d1d;">
        Unidad: <strong>${alertUnidad}</strong> (${alertClues}) — Municipio: <strong>${meta.municipio || 'N/D'}</strong>
      </div>
    </div>

    <div style="text-align: center; margin: 40px 0 10px 0;">
      <a href="${platformUrl}" style="background-color: #b91c1c; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block;">Ver en la Plataforma</a>
    </div>
  </div>

  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - SIREVAQ</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

      const desabastoSends: Promise<void>[] = []
      for (const r of recipients) {
        desabastoSends.push(
          transporter.sendMail({
            from: gmailUser,
            to: r.email,
            subject: `🚨 Desabasto crítico: ${alertUnidad} (${missing.join(', ') || 'Esquema Básico'})`,
            text: alertMessage,
            html: htmlBody,
            replyTo: 'no-reply@js1reportes.com'
          }).catch(err => console.error(`Error enviando alerta de desabasto a ${r.email}:`, err))
        )
      }

      await Promise.allSettled(desabastoSends)
      transporter.close()

      return new Response(JSON.stringify({ ok: true, message: `Alerta de desabasto enviada a ${desabastoSends.length} destinatarios.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    throw new Error('Acción no soportada.')

  } catch (error) {
    console.error("Edge Function Error:", error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Ocurrió un error inesperado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

