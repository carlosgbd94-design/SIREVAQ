// Plantillas HTML de los correos de captura (recordatorios y resúmenes).
//
// Pensadas para leerse bien en el teléfono: ancho fluido (nada de anchos fijos ni
// overflow:hidden que recorten contenido), tablas de una sola "fila apilada" por unidad
// (nombre + CLUES + estado) en vez de 3 columnas anchas, y las unidades PENDIENTES
// siempre primero para que lo importante quede a la vista sin desplazarse.
// Todo el estilo va en línea (Gmail/Outlook móvil descartan casi todo lo demás); el <style>
// de la cabecera solo afina paddings en pantallas angostas donde el cliente lo respete.

export type UnitStatus = { unidad: string; clues: string; ok: boolean }

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "'Inter','Segoe UI',Tahoma,Geneva,Verdana,sans-serif"

type Shell = {
  maxWidth: number
  gradient: string
  accent: string
  title: string
  subtitle: string
  subtitleColor: string
  content: string
  emoji?: string
}

function shell(o: Shell): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<style>@media only screen and (max-width:480px){.sx-pad{padding:18px 12px !important}.sx-h1{font-size:19px !important}.sx-big{font-size:40px !important}}</style>
</head><body style="margin:0;padding:8px;background:#f1f5f9;">
<div style="font-family:${FONT};max-width:${o.maxWidth}px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-top:5px solid ${o.accent};border-radius:14px;">
  <div style="background:${o.gradient};padding:26px 16px;text-align:center;border-radius:9px 9px 0 0;">
    ${o.emoji ? `<div style="font-size:30px;line-height:1;margin-bottom:10px;">${o.emoji}</div>` : ''}
    <h1 class="sx-h1" style="color:#ffffff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px;line-height:1.25;">${esc(o.title)}</h1>
    <p style="color:${o.subtitleColor};margin:8px 0 0 0;font-size:13px;font-weight:700;letter-spacing:.4px;">${o.subtitle}</p>
  </div>
  <div class="sx-pad" style="padding:26px 22px;color:#334155;line-height:1.55;">
    ${o.content}
  </div>
  <div style="background:#f8fafc;padding:18px 14px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 9px 9px;">
    <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;">SIREVAQ · Jurisdicción Sanitaria 1</p>
    <p style="margin:5px 0 0 0;color:#94a3b8;font-size:11px;">Correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
</body></html>`
}

function cta(url: string, label: string, color = '#2563eb'): string {
  return `<div style="text-align:center;margin:28px 0 6px 0;"><a href="${esc(url)}" style="background-color:${color};color:#ffffff;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;display:inline-block;">${esc(label)}</a></div>`
}

// Pendientes primero, luego completadas; dentro de cada grupo, por nombre.
const sortUnits = (list: UnitStatus[]) =>
  [...list].sort((a, b) => Number(a.ok) - Number(b.ok) || a.unidad.localeCompare(b.unidad, 'es'))

// Lista apilada: [✓/✗] Nombre / CLUES · ESTADO. Funciona a 320 px sin desplazamiento horizontal.
function unitList(list: UnitStatus[]): string {
  const rows = sortUnits(list).map((u) => {
    const color = u.ok ? '#059669' : '#dc2626'
    return `<tr>
      <td width="30" valign="top" style="width:30px;padding:10px 0 10px 12px;border-top:1px solid #f1f5f9;font-size:16px;font-weight:800;line-height:1.3;color:${color};">${u.ok ? '&#10003;' : '&#10007;'}</td>
      <td valign="top" style="padding:10px 12px 10px 6px;border-top:1px solid #f1f5f9;">
        <div style="font-size:14px;font-weight:700;color:#1e293b;line-height:1.3;word-break:break-word;">${esc(u.unidad)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;"><span style="font-family:monospace;">${esc(u.clues)}</span> &middot; <strong style="color:${color};text-transform:uppercase;letter-spacing:.3px;">${u.ok ? 'Completado' : 'Pendiente'}</strong></div>
      </td>
    </tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table>`
}

function counts(list: UnitStatus[]) {
  const done = list.filter((u) => u.ok).length
  return { done, pending: list.length - done }
}

function pill(text: string, bg: string, fg: string, border: string): string {
  return `<span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:9999px;padding:4px 12px;margin:0 6px 6px 0;font-size:12px;font-weight:800;">${text}</span>`
}

function countPills(list: UnitStatus[]): string {
  const { done, pending } = counts(list)
  return `<div style="text-align:center;margin:0 0 4px 0;">${pill(`&#10007; ${pending} pendiente${pending === 1 ? '' : 's'}`, '#fef2f2', '#b91c1c', '#fecaca')}${pill(`&#10003; ${done} completada${done === 1 ? '' : 's'}`, '#ecfdf5', '#047857', '#a7f3d0')}</div>`
}

function progressCard(pct: number, color: string, done: number, total: number, label: string, unitsLabel = 'Unidades completadas'): string {
  return `<div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px 14px;margin:20px 0;text-align:center;">
    <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:1px;">${esc(label)}</div>
    <div class="sx-big" style="font-size:48px;font-weight:900;color:${color};margin:6px 0 2px 0;letter-spacing:-2px;line-height:1;">${pct}%</div>
    <div style="background:#f1f5f9;border-radius:9999px;height:8px;width:80%;margin:12px auto;border:1px solid #e2e8f0;"><div style="background:${color};height:8px;width:${pct}%;border-radius:9999px;"></div></div>
    <div style="font-size:13px;color:#475569;font-weight:600;">${esc(unitsLabel)}: <strong style="color:#0f172a;">${done}</strong> de <strong style="color:#0f172a;">${total}</strong></div>
  </div>`
}

const progressColor = (pct: number) => (pct === 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444')

// ── Recordatorio individual a la unidad ────────────────────────────────────────
export function reminderEmail(unidad: string, missingItems: string[], platformUrl: string): string {
  return shell({
    maxWidth: 600, accent: '#2563eb', gradient: 'linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)',
    emoji: '⏱️', title: 'Acción requerida', subtitle: 'RECORDATORIO DE CAPTURA DIARIO', subtitleColor: '#dbeafe',
    content: `
      <p style="font-size:16px;margin:0 0 10px 0;color:#0f172a;">Estimado(a) capturista de la unidad <strong style="color:#1e40af;">${esc(unidad)}</strong>,</p>
      <p style="font-size:15px;color:#475569;margin:0;">El sistema detectó registros pendientes de tu unidad para el día de hoy:</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-left:5px solid #ef4444;padding:16px;border-radius:8px;margin:20px 0;">
        <div style="color:#b91c1c;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Pendiente de capturar</div>
        <ul style="margin:0;padding-left:20px;color:#7f1d1d;font-size:16px;font-weight:600;">${missingItems.map((i) => `<li style="margin-bottom:6px;">${esc(i)}</li>`).join('')}</ul>
      </div>
      <p style="font-size:15px;color:#475569;margin:0;">Ingresa a la plataforma a la brevedad para registrar y mantener los indicadores actualizados.</p>
      ${cta(platformUrl, 'Acceder a la plataforma')}`,
  })
}

// ── Resumen para un coordinador municipal o de caravanas ───────────────────────
export function scopeSummaryEmail(o: {
  reportType: string; regionLabel: string; todayYmd: string; units: UnitStatus[]
  who: string; tone: 'blue' | 'green'; whose: string
}): string {
  const { done, pending } = counts(o.units)
  const pct = Math.round((done / o.units.length) * 100)
  const green = o.tone === 'green'
  return shell({
    maxWidth: 650, accent: green ? '#10b981' : '#2563eb',
    gradient: green ? 'linear-gradient(135deg,#047857 0%,#065f46 100%)' : 'linear-gradient(135deg,#0f172a 0%,#334155 100%)',
    title: 'Resumen de captura', subtitleColor: green ? '#a7f3d0' : '#38bdf8',
    subtitle: `${esc(o.reportType)} · ${esc(o.regionLabel)}`,
    content: `
      <p style="font-size:16px;margin:0 0 6px 0;color:#0f172a;font-weight:700;">${esc(o.who)}</p>
      <p style="font-size:14px;color:#475569;margin:0;">Estatus de captura de hoy <strong style="color:#1e293b;">${esc(o.todayYmd)}</strong> para ${esc(o.whose)}:</p>
      ${progressCard(pct, progressColor(pct), done, o.units.length, 'Avance de captura')}
      ${countPills(o.units)}
      <div style="border:1px solid #e2e8f0;border-radius:12px;margin-top:14px;">
        <div style="background:#f8fafc;padding:11px 12px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-radius:11px 11px 0 0;">${pending > 0 ? `Primero las ${pending} pendiente${pending === 1 ? '' : 's'}` : 'Todas las unidades completaron su captura'}</div>
        ${unitList(o.units)}
      </div>`,
  })
}

// ── Resumen general para ADMIN / JURISDICCIONAL, separado por municipio ─────────
export function adminSummaryEmail(o: {
  reportType: string; todayYmd: string; byMuni: Record<string, UnitStatus[]>; total: number; totalDone: number
}): string {
  const totalPct = o.total > 0 ? Math.round((o.totalDone / o.total) * 100) : 0
  const totalPend = o.total - o.totalDone
  // Municipios con más pendientes primero
  const munis = Object.entries(o.byMuni).sort((a, b) => counts(b[1]).pending - counts(a[1]).pending || a[0].localeCompare(b[0], 'es'))
  const sections = munis.map(([name, list]) => {
    const c = counts(list)
    const pct = list.length > 0 ? Math.round((c.done / list.length) * 100) : 0
    const full = pct === 100
    return `<div style="border:1px solid #e2e8f0;border-radius:12px;margin-top:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:11px 11px 0 0;"><tr>
        <td style="padding:12px;font-weight:800;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.4px;">&#128205; ${esc(name)}</td>
        <td align="right" style="padding:12px;white-space:nowrap;"><span style="display:inline-block;font-weight:800;color:${full ? '#059669' : '#b45309'};background:${full ? '#ecfdf5' : '#fffbeb'};font-size:12px;padding:3px 10px;border-radius:9999px;">${pct}% (${c.done}/${list.length})</span></td>
      </tr></table>
      ${c.pending === 0
        ? `<div style="padding:12px;font-size:13px;color:#047857;font-weight:600;">&#10003; Todas las unidades completaron su captura.</div>`
        : unitList(list)}
    </div>`
  }).join('')

  return shell({
    maxWidth: 700, accent: '#1e3a8a', gradient: 'linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)',
    title: 'Reporte general jurisdiccional', subtitleColor: '#93c5fd',
    subtitle: `JURISDICCIÓN SANITARIA 1 · ${esc(o.reportType)}`,
    content: `
      <p style="font-size:16px;margin:0 0 6px 0;color:#0f172a;font-weight:700;">Estimado(a) Administrador(a) / Personal Jurisdiccional,</p>
      <p style="font-size:14px;color:#475569;margin:0;">Consolidado de capturas de hoy <strong style="color:#1e293b;">${esc(o.todayYmd)}</strong>:</p>
      ${progressCard(totalPct, '#1e3a8a', o.totalDone, o.total, 'Estatus jurisdiccional global', 'Unidades capturadas')}
      <div style="text-align:center;">${pill(`&#10007; ${totalPend} pendiente${totalPend === 1 ? '' : 's'}`, '#fef2f2', '#b91c1c', '#fecaca')}${pill(`&#10003; ${o.totalDone} completada${o.totalDone === 1 ? '' : 's'}`, '#ecfdf5', '#047857', '#a7f3d0')}</div>
      <h3 style="color:#0f172a;font-size:15px;font-weight:900;margin:26px 0 0 0;padding-bottom:8px;border-bottom:2px solid #f1f5f9;text-transform:uppercase;letter-spacing:.5px;">Por municipio <span style="font-weight:600;color:#64748b;text-transform:none;letter-spacing:0;font-size:12px;">(más pendientes primero)</span></h3>
      ${sections}`,
  })
}
