import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import nodemailer from "npm:nodemailer@6.9.13"
import { adminSummaryEmail, reminderEmail, scopeSummaryEmail, type UnitStatus } from "./templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Acciones: 'send-reminders' (recordatorio a cada unidad) y 'send-summaries' (resúmenes a
// supervisores). El aviso de desabasto vive en la función aparte `desabasto-digest`.
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
    const action = payload.action || 'send-reminders'

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

    const json = (body: unknown) => new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
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

        const missingItems: string[] = []

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
          reminderSends.push(
            transporter.sendMail({
              from: gmailUser,
              to: userForUnit.email,
              subject: `Aviso Pendiente: Captura en ${unit.unidad}`,
              text: `Recordatorio de captura pendiente para ${unit.unidad}: ${missingItems.join(', ')}`,
              html: reminderEmail(unit.unidad, missingItems, platformUrl),
              replyTo: 'no-reply@js1reportes.com'
            }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando recordatorio a ${userForUnit.email}:`, err))
          )
        }
      }

      await Promise.allSettled(reminderSends)
      transporter.close()

      return json({ ok: true, message: `Recordatorios individuales enviados: ${sentCount} correos.` })

    } else if (action === 'send-summaries') {
      // --- RESÚMENES DE CAPTURA (A LAS 18:00) ---
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

      // Estado de captura de una unidad según el reporte del día
      const statusOf = (unit: { clues: string; unidad: string }): UnitStatus => {
        const uClues = String(unit.clues).trim().toUpperCase()
        const ok = (reportType === 'CONSUMIBLES')
          ? capturedConsToday.has(uClues)
          : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
        return { unidad: unit.unidad, clues: unit.clues, ok }
      }

      // Prueba: { "action": "send-summaries", "test_to": "correo@ejemplo.com" } manda SOLO un
      // resumen a ese correo (asunto con [PRUEBA]), sin tocar a los destinatarios reales.
      // "test_kind": "general" (por defecto) o "municipal" (con los municipios del perfil de ese
      // correo si existe; si no, todos los municipios).
      const testTo = typeof payload.test_to === 'string' ? payload.test_to.trim() : ''
      if (testTo) {
        let subject: string
        let html: string
        let text: string
        if (payload.test_kind === 'municipal') {
          const mine = (profiles || []).find(p => String(p.email || '').trim().toLowerCase() === testTo.toLowerCase())
          let munis: string[] = []
          if (mine && Array.isArray(mine.municipios_allowed) && mine.municipios_allowed.length > 0) {
            munis = mine.municipios_allowed.map(normalizeMuni)
          } else if (mine?.municipio) {
            munis = String(mine.municipio).split(',').map(normalizeMuni)
          }
          const scoped = (munis.length === 0 || munis.includes('*'))
            ? activeUnits
            : activeUnits.filter(u => munis.includes(normalizeMuni(u.municipio)))
          if (scoped.length === 0) throw new Error('Sin unidades para armar la prueba municipal.')
          const label = (munis.length === 0 || munis.includes('*')) ? 'TODOS LOS MUNICIPIOS' : munis.join(', ')
          const statuses = scoped.map(statusOf)
          const done = statuses.filter(s => s.ok).length
          const pct = Math.round((done / scoped.length) * 100)
          subject = `[PRUEBA] Reporte ${reportType}: Región ${label} (${pct}% Capturado) - ${todayYmd}`
          text = `Prueba del resumen municipal: ${done} de ${scoped.length} unidades completadas.`
          html = scopeSummaryEmail({
            reportType, regionLabel: `Región: ${label}`, todayYmd, units: statuses,
            who: 'Estimado(a) Coordinador(a),', tone: 'blue', whose: 'las unidades a tu cargo'
          })
        } else {
          const byMuniTest: Record<string, UnitStatus[]> = {}
          let doneTest = 0
          activeUnits.forEach(u => {
            const st = statusOf(u)
            if (st.ok) doneTest++
            const k = normalizeMuni(u.municipio)
            if (!byMuniTest[k]) byMuniTest[k] = []
            byMuniTest[k].push(st)
          })
          const pctTest = activeUnits.length > 0 ? Math.round((doneTest / activeUnits.length) * 100) : 0
          subject = `[PRUEBA] [GENERAL] Reporte JS1 ${reportType} (${pctTest}% Global) - ${todayYmd}`
          text = `Prueba del resumen general: ${doneTest}/${activeUnits.length} completadas.`
          html = adminSummaryEmail({ reportType, todayYmd, byMuni: byMuniTest, total: activeUnits.length, totalDone: doneTest })
        }
        await transporter.sendMail({ from: gmailUser, to: testTo, subject, text, html, replyTo: 'no-reply@js1reportes.com' })
        transporter.close()
        return json({ ok: true, message: `Correo de prueba (${payload.test_kind || 'general'}) enviado a ${testTo}.` })
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
        const statuses = muniUnits.map(statusOf)
        const completedCount = statuses.filter(s => s.ok).length
        const pct = Math.round((completedCount / muniUnits.length) * 100)

        summarySends.push(
          transporter.sendMail({
            from: gmailUser,
            to: supervisor.email,
            subject: `Reporte ${reportType}: Región ${muniLabel} (${pct}% Capturado) - ${todayYmd}`,
            text: `Resumen de captura para ${muniLabel}: ${completedCount} de ${muniUnits.length} unidades completadas.`,
            html: scopeSummaryEmail({
              reportType, regionLabel: `Región: ${muniLabel}`, todayYmd, units: statuses,
              who: 'Estimado(a) Coordinador(a),', tone: 'blue', whose: 'las unidades a tu cargo'
            }),
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

        const statuses = caravanaUnits.map(statusOf)
        const completedCount = statuses.filter(s => s.ok).length
        const pct = Math.round((completedCount / caravanaUnits.length) * 100)

        summarySends.push(
          transporter.sendMail({
            from: gmailUser,
            to: supervisor.email,
            subject: `Reporte ${reportType}: CARAVANAS (${pct}% Capturado) - ${todayYmd}`,
            text: `Resumen de captura para Caravanas Móviles: ${completedCount} de ${caravanaUnits.length} completadas.`,
            html: scopeSummaryEmail({
              reportType, regionLabel: 'Región: CARAVANAS MÓVILES (UMME/FAM)', todayYmd, units: statuses,
              who: 'Estimado(a) Coordinador(a),', tone: 'green', whose: 'las caravanas a tu cargo'
            }),
            replyTo: 'no-reply@js1reportes.com'
          }).then(() => { sentCount++ }).catch(err => console.error(`Error enviando resumen de caravanas a ${supervisor.email}:`, err))
        )
      }

      // Enviar a perfiles JURISDICCIONALES Y ADMIN (Resumen general de todas las unidades, separado por municipio)
      const adminProfiles = (profiles || []).filter(p => (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') && p.email)

      if (adminProfiles.length > 0) {
        const byMuni: Record<string, UnitStatus[]> = {}
        let totalCompleted = 0
        activeUnits.forEach(u => {
          const mKey = normalizeMuni(u.municipio)
          const st = statusOf(u)
          if (st.ok) totalCompleted++
          if (!byMuni[mKey]) byMuni[mKey] = []
          byMuni[mKey].push(st)
        })

        const totalPct = activeUnits.length > 0 ? Math.round((totalCompleted / activeUnits.length) * 100) : 0
        const htmlBodyAdmin = adminSummaryEmail({
          reportType, todayYmd, byMuni, total: activeUnits.length, totalDone: totalCompleted
        })

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

      return json({ ok: true, message: `Reportes generales y municipales enviados: ${sentCount} correos.` })
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
