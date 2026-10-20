/**
 * pinol_ruta.js — Armado de la ruta de entrega de Pinol (panel de Jurisdicción/Municipal).
 *
 * Antes, «Guía de Ruta» imprimía TODAS las solicitudes pendientes (si no había casillas marcadas) y el
 * encabezado tomaba el municipio de la primera fila. Ahora el botón abre un armador de ruta: se eligen las
 * unidades que van, cuántas botellas lleva cada una, el orden de las paradas y los datos del viaje; de ahí se
 * imprime la guía o se imprime y se marca la ruta «en tránsito» (con candado para no surtir dos veces).
 *
 * Todo el cálculo (prioridad, espera, sugerencia, totales, HTML de la guía) son funciones puras para probarlas en
 * Node; el modal y la red están al final y solo corren en el navegador.
 */
(function (root) {
  "use strict";

  const LITROS_BOTELLA = 0.828;
  const MAX_BOTELLAS = 4;           // norma institucional: hasta 4 botellas que PIDE cada unidad
  const MAX_ENTREGA = 20;           // lo que el municipio puede ENTREGAR de más cuando la situación lo amerita
  const DIAS_ESPERA_ALERTA = 7;     // una solicitud pendiente con más días ya es rezago
  const DIAS_SIN_CONFIRMAR = 5;     // enviada y sin confirmar por la unidad

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  // CSS.escape puede faltar (o estar pisado por otro script): ids numericos/uuid solo necesitan escapar comillas y barras.
  const cssEsc = (v) => (typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function") ? CSS.escape(String(v)) : String(v).replace(/[^w-]/g, (c) => "\\" + c);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  /* ───────────────────────────── funciones puras ───────────────────────────── */
  function ymdLocal(raw) {
    const t = String(raw || "");
    if (!t) return "";
    if (t.includes("T")) {
      const d = new Date(t);
      if (isNaN(d)) return "";
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
  }
  function diasEntre(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }

  const estatusDe = (x) => String((x && (x.estatus_visual || x.estatus)) || "PENDIENTE").toUpperCase();

  /** Días que lleva esperando una solicitud pendiente (null si no es pendiente o no tiene fecha). */
  function esperaDias(x, hoy) {
    if (estatusDe(x) !== "PENDIENTE") return null;
    const f = ymdLocal(x.fecha_solicitud || x.timestamp_solicitud);
    return f ? Math.max(0, diasEntre(f, hoy)) : null;
  }
  /** Días que lleva enviada (en tránsito) sin que la unidad confirme. */
  function sinConfirmarDias(x, hoy) {
    if (estatusDe(x) !== "ENTREGADO") return null;
    const f = ymdLocal(x.fecha_entrega || x.timestamp_entrega);
    return f ? Math.max(0, diasEntre(f, hoy)) : null;
  }
  const esCritica = (x) => estatusDe(x) === "PENDIENTE" && num(x.existencia_actual_botellas) === 0;
  const cantidadInicial = (x) => Math.min(MAX_BOTELLAS, Math.max(1, Math.round(num(x.solicitud_botellas) || MAX_BOTELLAS)));

  /** Pendientes que conviene llevar primero: sin existencia o con rezago. */
  function sugerirRuta(items, hoy, dias) {
    const lim = dias == null ? DIAS_ESPERA_ALERTA : dias;
    return (items || []).filter((x) => {
      if (estatusDe(x) !== "PENDIENTE") return false;
      const e = esperaDias(x, hoy);
      return esCritica(x) || (e != null && e >= lim);
    }).map((x) => String(x.id));
  }

  /** Orden de paradas: por municipio (los trayectos se agrupan), críticas primero y la más antigua primero. */
  function ordenarParadas(items, hoy) {
    return [...(items || [])].sort((a, b) => {
      const m = norm(a.municipio).localeCompare(norm(b.municipio));
      if (m) return m;
      if (esCritica(a) !== esCritica(b)) return esCritica(a) ? -1 : 1;
      const ea = esperaDias(a, hoy) || 0, eb = esperaDias(b, hoy) || 0;
      if (ea !== eb) return eb - ea;
      return norm(a.unidad).localeCompare(norm(b.unidad));
    });
  }

  function totales(paradas, cantidades) {
    const botellas = (paradas || []).reduce((s, x) => s + num((cantidades && cantidades[String(x.id)]) != null ? cantidades[String(x.id)] : cantidadInicial(x)), 0);
    return { paradas: (paradas || []).length, botellas, litros: Math.round(botellas * LITROS_BOTELLA * 10) / 10 };
  }

  function municipiosDe(paradas) {
    const vistos = [];
    (paradas || []).forEach((x) => { const m = String(x.municipio || "").trim(); if (m && !vistos.includes(m)) vistos.push(m); });
    return vistos;
  }

  /** Resumen para avisos de la tabla: cuántas llevan rezago y cuántas están sin confirmar. */
  function resumenAlertas(items, hoy) {
    let rezago = 0, sinConfirmar = 0, criticas = 0;
    (items || []).forEach((x) => {
      const e = esperaDias(x, hoy), s = sinConfirmarDias(x, hoy);
      if (e != null && e >= DIAS_ESPERA_ALERTA) rezago++;
      if (s != null && s >= DIAS_SIN_CONFIRMAR) sinConfirmar++;
      if (esCritica(x)) criticas++;
    });
    return { rezago, sinConfirmar, criticas };
  }

  /** Botellas sugeridas para llegar al tope de 4 según lo que la unidad tiene hoy. */
  function botellasSugeridas(existencia) {
    if (existencia === "" || existencia == null) return { n: null, aviso: "" };
    const e = Number(existencia);
    if (!Number.isFinite(e) || e < 0) return { n: null, aviso: "" };
    if (e >= MAX_BOTELLAS) return { n: null, aviso: `Ya tienes ${e} botellas (el tope es ${MAX_BOTELLAS}). Pide solo si de verdad las necesitas.` };
    return { n: Math.max(1, MAX_BOTELLAS - Math.floor(e)), aviso: "" };
  }

  /** Lo que la unidad quiere saber antes de pedir: su último Pinol y cuánto suele tardar el municipio. */
  function resumenHistorialUnidad(items, clues, hoy) {
    const mias = (items || []).filter((x) => String(x.clues || "") === String(clues));
    const porFecha = (a, b) => String(ymdLocal(b.fecha_solicitud)).localeCompare(String(ymdLocal(a.fecha_solicitud)));
    const recibidas = mias.filter((x) => estatusDe(x) === "RECIBIDO").sort(porFecha);
    const esperas = mias.filter((x) => x.fecha_entrega && x.fecha_solicitud).sort(porFecha).slice(0, 5)
      .map((x) => diasEntre(ymdLocal(x.fecha_solicitud), ymdLocal(x.fecha_entrega))).filter((d) => d >= 0);
    const u = recibidas[0];
    return {
      ultimo: u ? { solicitud: ymdLocal(u.fecha_solicitud), entrega: ymdLocal(u.fecha_entrega), botellas: num(u.solicitud_botellas), haceDias: Math.max(0, diasEntre(ymdLocal(u.fecha_entrega || u.fecha_solicitud), hoy)) } : null,
      promEspera: esperas.length ? Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length) : null,
      n: esperas.length
    };
  }

  const MESES_LARGOS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  function fechaLarga(ymd) {
    const d = new Date(String(ymd || "").slice(0, 10) + "T12:00:00");
    return isNaN(d) ? "____ DE ____________" : `${d.getDate()} DE ${MESES_LARGOS[d.getMonth()]} DE ${d.getFullYear()}`;
  }

  /**
   * HTML imprimible de la guía. paradas: solicitudes en el orden de la ruta; meta: {fecha, responsable, vehiculo,
   * cantidades, logos}. Agrupa por municipio con subtotales, así una ruta de varios municipios se lee bien.
   */
  function htmlGuia(paradas, meta) {
    const m = meta || {};
    const cant = (x) => (m.cantidades && m.cantidades[String(x.id)] != null ? num(m.cantidades[String(x.id)]) : cantidadInicial(x));
    const tot = totales(paradas, m.cantidades);
    const muns = municipiosDe(paradas);
    const logos = m.logos || {};
    const th = "padding:7px 8px;border:1px solid #0f172a;";
    const td = "padding:7px 8px;border:1px solid #94a3b8;";
    let n = 0, filas = "";
    // Grupos en el orden en que aparecen en la ruta (no se reordena aquí: el orden lo decidió quien armó la ruta)
    const grupos = [];
    (paradas || []).forEach((x) => {
      const k = norm(x.municipio) || "SIN MUNICIPIO";
      let g = grupos[grupos.length - 1];
      if (!g || g.k !== k) { g = { k, nombre: String(x.municipio || "SIN MUNICIPIO").toUpperCase(), items: [] }; grupos.push(g); }
      g.items.push(x);
    });
    grupos.forEach((g) => {
      const sub = totales(g.items, m.cantidades);
      if (muns.length > 1) filas += `<tr><td colspan="7" style="${td}background:#e2e8f0;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">${esc(g.nombre)} · ${sub.paradas} unidad(es) · ${sub.botellas} bot · ${sub.litros.toFixed(1)} L</td></tr>`;
      g.items.forEach((x) => {
        n++;
        const obs = String(x.observaciones || "").trim();
        filas += `<tr style="page-break-inside:avoid;height:74px;">
          <td style="${td}text-align:center;font-weight:800;">${n}</td>
          <td style="${td}font-family:monospace;font-weight:700;">${esc(x.clues || "")}</td>
          <td style="${td}font-weight:800;">${esc(x.unidad || "")}${esCritica(x) ? ' <span style="font-size:9px;font-weight:900;color:#991b1b;">· SIN EXISTENCIA</span>' : ""}${obs ? `<div style="font-weight:600;font-size:9.5px;color:#475569;">${esc(obs.length > 90 ? obs.slice(0, 87) + "…" : obs)}</div>` : ""}</td>
          <td style="${td}text-align:center;font-weight:700;">${num(x.existencia_actual_botellas)}</td>
          <td style="${td}text-align:center;font-weight:900;">${cant(x)} pz</td>
          <td style="${td}text-align:center;font-weight:700;">${(cant(x) * LITROS_BOTELLA).toFixed(1)} L</td>
          <td style="${td}width:170px;"></td>
        </tr>`;
      });
    });
    return `<div style="padding:18px 22px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;">
        <div style="flex:0 0 auto;max-width:30%;">${logos.logo1 ? `<img src="${logos.logo1}" style="height:48px;max-width:100%;width:auto;object-fit:contain;display:block;" alt="">` : ""}</div>
        <div style="flex:1 1 0;min-width:0;text-align:center;padding:0 10px;">
          <div style="font-size:15px;font-weight:900;text-transform:uppercase;">Servicios de Salud del Estado de Querétaro</div>
          <div style="font-size:12.5px;font-weight:800;color:#166534;text-transform:uppercase;">Guía de despacho y ruta de entrega</div>
          <div style="font-size:10.5px;font-weight:700;color:#475569;">Insumos de desinfección de red de frío (Pinol® 828 mL)</div>
        </div>
        <div style="flex:0 0 auto;max-width:30%;">${logos.logo2 ? `<img src="${logos.logo2}" style="height:44px;max-width:100%;width:auto;object-fit:contain;display:block;margin-left:auto;" alt="">` : ""}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;"><tbody>
        <tr>
          <td style="${td}background:#f8fafc;"><b>MUNICIPIO(S):</b> ${esc(muns.map((x) => x.toUpperCase()).join(", ") || "—")}</td>
          <td style="${td}background:#f8fafc;"><b>FECHA DE SALIDA:</b> ${esc(fechaLarga(m.fecha))}</td>
          <td style="${td}background:#f8fafc;"><b>PARADAS:</b> ${tot.paradas}</td>
          <td style="${td}background:#f8fafc;"><b>CARGA:</b> ${tot.botellas} bot · ${tot.litros.toFixed(1)} L</td>
        </tr>
        <tr>
          <td colspan="2" style="${td}"><b>RESPONSABLE DE LA ENTREGA:</b> ${esc(m.responsable || "")}</td>
          <td colspan="2" style="${td}"><b>VEHÍCULO / OBSERVACIÓN:</b> ${esc(m.vehiculo || "")}</td>
        </tr>
      </tbody></table>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:26px;">
        <thead><tr style="background:#1e293b;color:#fff;text-transform:uppercase;font-weight:800;">
          <th style="${th}width:28px;">#</th><th style="${th}text-align:left;width:105px;">CLUES</th><th style="${th}text-align:left;">Unidad de salud</th>
          <th style="${th}width:56px;">Exist.</th><th style="${th}width:62px;">Botellas</th><th style="${th}width:56px;">Litros</th><th style="${th}width:170px;">Sello y firma de recibido</th>
        </tr></thead>
        <tbody>${filas}
          <tr style="background:#f1f5f9;font-weight:900;"><td colspan="4" style="${td}text-align:right;">TOTAL DE LA RUTA</td><td style="${td}text-align:center;">${tot.botellas} pz</td><td style="${td}text-align:center;">${tot.litros.toFixed(1)} L</td><td style="${td}"></td></tr>
        </tbody>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px;text-align:center;font-size:11px;font-weight:700;">
        <div style="border-top:1px solid #0f172a;padding-top:6px;">ENTREGÓ / RESPONSABLE DE TRANSPORTE<div style="font-size:10px;color:#475569;font-weight:600;">Firma y fecha de salida</div></div>
        <div style="border-top:1px solid #0f172a;padding-top:6px;">V.B. COORDINACIÓN MUNICIPAL DE VACUNACIÓN<div style="font-size:10px;color:#475569;font-weight:600;">Sello y autorización de despacho</div></div>
      </div>
    </div>`;
  }

  const API = {
    LITROS_BOTELLA, MAX_BOTELLAS, MAX_ENTREGA, DIAS_ESPERA_ALERTA, DIAS_SIN_CONFIRMAR,
    botellasSugeridas, resumenHistorialUnidad,
    esperaDias, sinConfirmarDias, esCritica, cantidadInicial, sugerirRuta, ordenarParadas, totales, municipiosDe, resumenAlertas, htmlGuia, fechaLarga
  };
  root.PinolRuta = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof document === "undefined") return;

  /* ───────────────────────────── armador de ruta (DOM) ───────────────────────────── */
  const ESTILOS = `
  #pinolRutaOverlay{position:fixed;inset:0;z-index:2600;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)}
  #pinolRutaOverlay.show{display:flex}
  #pinolRutaOverlay .pr-box{width:100%;max-width:1080px;max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;color:#0f172a;box-shadow:0 20px 50px rgba(15,23,42,.35)}
  #pinolRutaOverlay .pr-head{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid #e2e8f0}
  #pinolRutaOverlay .pr-head h3{margin:0;font-size:18px;font-weight:900}
  #pinolRutaOverlay .pr-head p{margin:2px 0 0;font-size:12px;font-weight:600;color:#475569}
  #pinolRutaOverlay .pr-x{margin-left:auto}
  #pinolRutaOverlay button{font-family:inherit}
  #pinolRutaOverlay .pr-ib{min-height:0!important;width:36px!important;height:36px!important;padding:0!important;border:none!important;border-radius:10px!important;background:transparent!important;color:#0f172a!important;display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer;box-shadow:none!important}
  #pinolRutaOverlay .pr-ib .material-symbols-rounded{font-size:21px}
  #pinolRutaOverlay .pr-ib[disabled]{opacity:.3;cursor:default}
  #pinolRutaOverlay .pr-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:0;min-height:0;flex:1;overflow:hidden}
  #pinolRutaOverlay .pr-col{display:flex;flex-direction:column;min-height:0;overflow:hidden}
  #pinolRutaOverlay .pr-col+.pr-col{border-left:1px solid #e2e8f0;background:#f8fafc}
  #pinolRutaOverlay .pr-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:12px 16px 8px}
  #pinolRutaOverlay input.pr-in{height:36px!important;min-height:0!important;padding:0 10px!important;border:1px solid #94a3b8!important;border-radius:10px!important;background:#fff!important;background-image:none!important;color:#0f172a!important;font-size:12.5px!important;font-weight:600!important;box-shadow:none!important;margin:0!important}
  #pinolRutaOverlay .pr-search{flex:1 1 140px;min-width:120px;width:auto!important}
  #pinolRutaOverlay button.pr-chip{min-height:0!important;height:32px!important;padding:0 11px!important;border-radius:999px!important;border:1px solid #94a3b8!important;background:#fff!important;color:#1e293b!important;font-size:12px!important;font-weight:700!important;cursor:pointer;display:inline-flex!important;align-items:center;gap:5px;box-shadow:none!important;white-space:nowrap}
  #pinolRutaOverlay button.pr-chip[aria-pressed="true"]{background:#0c4a6e!important;color:#fff!important;border-color:#0c4a6e!important}
  #pinolRutaOverlay .pr-list{flex:1;overflow-y:auto;padding:0 12px 12px;margin:0;list-style:none}
  #pinolRutaOverlay .pr-mun{display:flex;align-items:center;gap:8px;padding:10px 6px 4px;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#334155}
  #pinolRutaOverlay .pr-mun button{margin-left:auto;min-height:0!important;height:26px!important;padding:0 10px!important;border-radius:8px!important;border:1px solid #94a3b8!important;background:#fff!important;color:#0c4a6e!important;font-size:11px!important;font-weight:800!important;cursor:pointer;box-shadow:none!important}
  #pinolRutaOverlay label.pr-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:5px;cursor:pointer}
  #pinolRutaOverlay label.pr-row:has(input:checked){border-color:#0c4a6e;background:#f0f9ff}
  #pinolRutaOverlay .pr-row input[type=checkbox]{width:18px;height:18px;flex:none;accent-color:#0c4a6e}
  #pinolRutaOverlay .pr-name{min-width:0;flex:1}
  #pinolRutaOverlay .pr-name b{display:block;font-size:13px;font-weight:800}
  #pinolRutaOverlay .pr-name small{font-size:10.5px;font-weight:700;color:#475569;font-family:monospace}
  #pinolRutaOverlay .pr-tags{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}
  #pinolRutaOverlay .pr-t{display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:800;border:1px solid transparent;white-space:nowrap}
  #pinolRutaOverlay .pr-t.rojo{background:#fee2e2;color:#7f1d1d;border-color:#fca5a5}#pinolRutaOverlay .pr-t.ambar{background:#fef3c7;color:#78350f;border-color:#fcd34d}#pinolRutaOverlay .pr-t.gris{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
  #pinolRutaOverlay .pr-sum{padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
  #pinolRutaOverlay .pr-sum b{font-size:22px;font-weight:900;font-variant-numeric:tabular-nums}
  #pinolRutaOverlay .pr-sum span{font-size:12px;font-weight:700;color:#334155}
  #pinolRutaOverlay .pr-stops{flex:1;overflow-y:auto;padding:10px 12px;margin:0;list-style:none}
  #pinolRutaOverlay .pr-stop{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 10px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;margin-bottom:5px}
  #pinolRutaOverlay .pr-n{flex:none;width:24px;height:24px;border-radius:50%;background:#0c4a6e;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center}
  #pinolRutaOverlay .pr-stop .pr-name b{font-size:12.5px}
  #pinolRutaOverlay input.pr-q{width:54px!important;text-align:center;padding:0 4px!important;font-weight:800!important;-moz-appearance:textfield}
  #pinolRutaOverlay input.pr-q::-webkit-outer-spin-button,#pinolRutaOverlay input.pr-q::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  #pinolRutaOverlay .pr-vacio{padding:26px 16px;text-align:center;font-size:13px;font-weight:600;color:#475569}
  #pinolRutaOverlay .pr-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 16px;border-top:1px solid #e2e8f0;background:#fff}
  #pinolRutaOverlay .pr-meta label{display:block;font-size:10.5px;font-weight:800;color:#334155;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
  #pinolRutaOverlay .pr-meta .full{grid-column:1/-1}
  #pinolRutaOverlay .pr-meta input.pr-in{width:100%!important}
  #pinolRutaOverlay .pr-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fff}
  #pinolRutaOverlay .pr-foot .aviso{margin-right:auto;font-size:11.5px;font-weight:700;color:#475569}
  #pinolRutaOverlay button.pr-btn{transition:none!important;min-height:0!important;height:40px!important;padding:0 16px!important;border-radius:12px!important;border:1px solid #0f172a!important;background:#fff!important;color:#0f172a!important;font-size:12.5px!important;font-weight:800!important;cursor:pointer;display:inline-flex!important;align-items:center;gap:7px;box-shadow:none!important}
  #pinolRutaOverlay button.pr-btn.sol{background:#0f172a!important;color:#fff!important}
  #pinolRutaOverlay button.pr-btn.ok{background:#047857!important;border-color:#047857!important;color:#fff!important}
  #pinolRutaOverlay button.pr-btn[disabled]{opacity:.45;cursor:not-allowed}
  #pinolRutaOverlay .pr-btn .material-symbols-rounded{font-size:19px}
  #pinolRutaOverlay button:focus-visible,#pinolRutaOverlay input:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  @media (hover:hover) and (pointer:fine){#pinolRutaOverlay button.pr-ib:not([disabled]):hover{transform:translateY(-2px);filter:drop-shadow(0 3px 4px rgba(15,23,42,.3))}#pinolRutaOverlay button.pr-chip:hover{background:#f1f5f9!important}#pinolRutaOverlay button.pr-chip[aria-pressed="true"]:hover{background:#075985!important}}
  @media (max-width:820px){#pinolRutaOverlay .pr-body{grid-template-columns:1fr;overflow-y:auto}#pinolRutaOverlay .pr-col{overflow:visible}#pinolRutaOverlay .pr-col+.pr-col{border-left:none;border-top:1px solid #e2e8f0}#pinolRutaOverlay .pr-list,#pinolRutaOverlay .pr-stops{overflow:visible}#pinolRutaOverlay .pr-box{max-height:100vh;border-radius:0}}
  `;

  const S = { orden: [], cant: {}, filtro: "todas", texto: "", abierto: false, opener: null };
  const $ = (id) => document.getElementById(id);
  const hoyYmd = () => (typeof root.todayYmdLocal === "function" ? root.todayYmdLocal() : new Date().toLocaleDateString("en-CA"));
  const ICO = (n) => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };

  const pendientes = () => (root._pinolRawItems || []).filter((x) => estatusDe(x) === "PENDIENTE");
  const porId = (id) => (root._pinolRawItems || []).find((x) => String(x.id) === String(id));

  function construirDom() {
    if ($("pinolRutaOverlay")) return;
    const st = document.createElement("style"); st.id = "pinolRutaStyles"; st.textContent = ESTILOS; document.head.appendChild(st);
    const o = document.createElement("div");
    o.id = "pinolRutaOverlay";
    o.innerHTML = `<div class="pr-box" role="dialog" aria-modal="true" aria-labelledby="prTitulo">
      <div class="pr-head"><div><h3 id="prTitulo">Armar ruta de entrega</h3><p>Elige las unidades que van en este viaje. Solo se imprime y se surte lo que marques.</p></div>
        <button type="button" class="pr-ib pr-x" data-pr="cerrar" aria-label="Cerrar">${ICO("close")}</button></div>
      <div class="pr-body">
        <section class="pr-col" aria-label="Solicitudes pendientes">
          <div class="pr-tools">
            <input id="prBuscar" class="pr-in pr-search" type="search" placeholder="Buscar unidad o CLUES" aria-label="Buscar solicitud pendiente" autocomplete="off">
            <button type="button" class="pr-chip" data-pr="f" data-v="todas" aria-pressed="true">Todas</button>
            <button type="button" class="pr-chip" data-pr="f" data-v="criticas" aria-pressed="false">Sin existencia</button>
            <button type="button" class="pr-chip" data-pr="f" data-v="rezago" aria-pressed="false">7+ días</button>
          </div>
          <div class="pr-tools" style="padding-top:0"><button type="button" class="pr-chip" data-pr="sugerir">${ICO("auto_awesome")}Sugerir ruta</button><button type="button" class="pr-chip" data-pr="todas">Marcar visibles</button><button type="button" class="pr-chip" data-pr="limpiar">Limpiar</button></div>
          <ul class="pr-list" id="prLista"></ul>
        </section>
        <section class="pr-col" aria-label="Ruta">
          <div class="pr-sum" role="status" aria-live="polite" id="prResumen"></div>
          <ol class="pr-stops" id="prParadas"></ol>
          <div class="pr-meta">
            <div><label for="prFecha">Fecha de salida</label><input id="prFecha" class="pr-in" type="date"></div>
            <div><label for="prResp">Responsable de la entrega</label><input id="prResp" class="pr-in" type="text" autocomplete="off"></div>
            <div class="full"><label for="prVeh">Vehículo / observación (opcional)</label><input id="prVeh" class="pr-in" type="text" autocomplete="off" placeholder="Ej: camioneta 3, hielera"></div>
          </div>
        </section>
      </div>
      <div class="pr-foot"><span class="aviso" id="prAviso"></span>
        <button type="button" class="pr-btn" data-pr="ordenar">${ICO("sort")}Ordenar por municipio</button>
        <button type="button" class="pr-btn sol" data-pr="imprimir" id="prImprimir">${ICO("print")}Imprimir guía</button>
        <button type="button" class="pr-btn ok" data-pr="surtir" id="prSurtir">${ICO("local_shipping")}Imprimir y marcar en tránsito</button>
      </div></div>`;
    document.body.appendChild(o);
    o.addEventListener("click", alClic);
    o.addEventListener("mousedown", (e) => { if (e.target === o) cerrar(); });
    o.addEventListener("input", alEscribir);
    o.addEventListener("change", alCambiar);
    o.addEventListener("keydown", alTeclado);
  }

  function visibles() {
    const hoy = hoyYmd();
    const q = norm(S.texto);
    return pendientes().filter((x) => {
      if (S.filtro === "criticas" && !esCritica(x)) return false;
      if (S.filtro === "rezago" && !((esperaDias(x, hoy) || 0) >= DIAS_ESPERA_ALERTA)) return false;
      if (q && !norm(`${x.unidad} ${x.clues} ${x.municipio}`).includes(q)) return false;
      return true;
    });
  }

  function etiquetas(x, hoy) {
    const t = [];
    if (esCritica(x)) t.push(`<span class="pr-t rojo">sin existencia</span>`);
    else t.push(`<span class="pr-t gris">exist. ${num(x.existencia_actual_botellas)}</span>`);
    const e = esperaDias(x, hoy);
    if (e != null) t.push(`<span class="pr-t ${e >= DIAS_ESPERA_ALERTA ? "ambar" : "gris"}">${e === 0 ? "hoy" : "hace " + e + " d"}</span>`);
    t.push(`<span class="pr-t gris">pide ${num(x.solicitud_botellas) || "—"}</span>`);
    return t.join("");
  }

  function pintarLista() {
    const ul = $("prLista");
    const hoy = hoyYmd();
    const items = ordenarParadas(visibles(), hoy);
    if (!items.length) {
      ul.innerHTML = `<li class="pr-vacio">${pendientes().length ? "Ninguna solicitud coincide con el filtro." : "No hay solicitudes pendientes de surtir."}</li>`;
      return;
    }
    let html = "", mun = null;
    items.forEach((x) => {
      const m = String(x.municipio || "Sin municipio");
      if (norm(m) !== mun) {
        mun = norm(m);
        const ids = items.filter((y) => norm(y.municipio || "Sin municipio") === mun).map((y) => y.id);
        const todas = ids.every((id) => S.orden.includes(String(id)));
        html += `<li class="pr-mun" aria-hidden="false"><span>${esc(m)} · ${ids.length}</span><button type="button" data-pr="mun" data-ids="${esc(ids.join("|"))}" aria-label="${todas ? "Quitar" : "Agregar"} municipio ${esc(m)}">${todas ? "Quitar" : "Agregar"} municipio</button></li>`;
      }
      const marcada = S.orden.includes(String(x.id));
      html += `<li><label class="pr-row"><input type="checkbox" data-pr="sel" data-id="${esc(x.id)}" ${marcada ? "checked" : ""} aria-label="Incluir ${esc(x.unidad)} en la ruta">
        <span class="pr-name"><b>${esc(x.unidad)}</b><small>${esc(x.clues)}</small></span><span class="pr-tags">${etiquetas(x, hoy)}</span></label></li>`;
    });
    ul.innerHTML = html;
  }

  function pintarRuta() {
    const paradas = S.orden.map(porId).filter(Boolean);
    const t = totales(paradas, S.cant);
    $("prResumen").innerHTML = `<b>${t.paradas}</b><span>${t.paradas === 1 ? "parada" : "paradas"}</span><b>${t.botellas}</b><span>botellas</span><b>${t.litros.toFixed(1)}</b><span>litros</span>`;
    const ol = $("prParadas");
    if (!paradas.length) ol.innerHTML = `<li class="pr-vacio">Aún no hay unidades en la ruta.<br>Marca las que se van en la lista, o usa «Sugerir ruta».</li>`;
    else ol.innerHTML = paradas.map((x, i) => `<li class="pr-stop">
        <span class="pr-n" aria-hidden="true">${i + 1}</span>
        <span class="pr-name"><b>${esc(x.unidad)}</b><small>${esc(x.municipio || "")} · ${esc(x.clues)}</small></span>
        <input class="pr-in pr-q" type="number" min="1" max="${MAX_ENTREGA}" step="1" inputmode="numeric" data-pr="qty" data-id="${esc(x.id)}" value="${S.cant[String(x.id)]}" aria-label="Botellas para ${esc(x.unidad)}">
        <button type="button" class="pr-ib" data-pr="subir" data-id="${esc(x.id)}" aria-label="Subir ${esc(x.unidad)} en la ruta" ${i === 0 ? "disabled" : ""}>${ICO("arrow_upward")}</button>
        <button type="button" class="pr-ib" data-pr="bajar" data-id="${esc(x.id)}" aria-label="Bajar ${esc(x.unidad)} en la ruta" ${i === paradas.length - 1 ? "disabled" : ""}>${ICO("arrow_downward")}</button>
        <button type="button" class="pr-ib" data-pr="quitar" data-id="${esc(x.id)}" aria-label="Quitar ${esc(x.unidad)} de la ruta">${ICO("close")}</button></li>`).join("");
    const hay = paradas.length > 0;
    $("prImprimir").disabled = !hay; $("prSurtir").disabled = !hay;
    const muns = municipiosDe(paradas);
    $("prAviso").textContent = hay ? (muns.length > 1 ? `Ruta de ${muns.length} municipios` : `Municipio: ${muns[0] || "—"}`) : "";
  }
  const pintar = () => { pintarLista(); pintarRuta(); };

  function agregar(id) {
    const x = porId(id); if (!x) return;
    id = String(id);
    if (!S.orden.includes(id)) S.orden.push(id);
    if (S.cant[id] == null) S.cant[id] = cantidadInicial(x);
  }
  function quitar(id) { S.orden = S.orden.filter((v) => v !== String(id)); }

  function alClic(e) {
    const b = e.target.closest("[data-pr]");
    if (!b) return;
    const a = b.dataset.pr, id = b.dataset.id;
    if (a === "cerrar") return cerrar();
    if (a === "f") { S.filtro = b.dataset.v; document.querySelectorAll("#pinolRutaOverlay [data-pr=f]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === S.filtro))); return pintarLista(); }
    if (a === "sugerir") { sugerirRuta(pendientes(), hoyYmd()).forEach(agregar); ordenarSeleccion(); pintar(); const n = S.orden.length; $("prAviso").textContent = n ? `Sugerencia: ${n} con sin existencia o 7+ días. Ajusta lo que quieras.` : "No hay solicitudes críticas ni con rezago."; return; }
    if (a === "todas") { visibles().forEach((x) => agregar(x.id)); ordenarSeleccion(); return pintar(); }
    if (a === "limpiar") { S.orden = []; return pintar(); }
    if (a === "mun") { const ids = String(b.dataset.ids || "").split("|").filter(Boolean); const todas = ids.every((i) => S.orden.includes(i)); ids.forEach((i) => (todas ? quitar(i) : agregar(i))); if (!todas) ordenarSeleccion(); return pintar(); }
    if (a === "quitar") { quitar(id); return pintar(); }
    if (a === "subir" || a === "bajar") {
      const i = S.orden.indexOf(String(id)), j = a === "subir" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= S.orden.length) return;
      [S.orden[i], S.orden[j]] = [S.orden[j], S.orden[i]];
      pintarRuta();
      const nuevo = document.querySelector(`#pinolRutaOverlay [data-pr=${a}][data-id="${cssEsc(id)}"]`);
      if (nuevo && !nuevo.disabled) nuevo.focus(); else document.querySelector(`#pinolRutaOverlay [data-pr=${a === "subir" ? "bajar" : "subir"}][data-id="${cssEsc(id)}"]`)?.focus();
      return pintarLista();
    }
    if (a === "ordenar") { ordenarSeleccion(); return pintarRuta(); }
    if (a === "imprimir") return imprimir(false);
    if (a === "surtir") return imprimir(true);
  }
  function alCambiar(e) {
    const t = e.target;
    if (t.dataset && t.dataset.pr === "sel") { if (t.checked) { agregar(t.dataset.id); } else quitar(t.dataset.id); pintarRuta(); pintarLista(); const c = document.querySelector(`#pinolRutaOverlay [data-pr=sel][data-id="${cssEsc(t.dataset.id)}"]`); if (c) c.focus(); }
  }
  function alEscribir(e) {
    const t = e.target;
    if (t.id === "prBuscar") { S.texto = t.value; return pintarLista(); }
    if (t.dataset && t.dataset.pr === "qty") {
      const v = Math.min(MAX_ENTREGA, Math.max(1, Math.round(num(t.value)) || 1));
      S.cant[String(t.dataset.id)] = v;
      if (t.value !== "" && String(v) !== t.value) t.value = String(v);
      const paradas = S.orden.map(porId).filter(Boolean);
      const tt = totales(paradas, S.cant);
      $("prResumen").innerHTML = `<b>${tt.paradas}</b><span>${tt.paradas === 1 ? "parada" : "paradas"}</span><b>${tt.botellas}</b><span>botellas</span><b>${tt.litros.toFixed(1)}</b><span>litros</span>`;
    }
  }
  function alTeclado(e) {
    if (e.key === "Escape") { e.preventDefault(); return cerrar(); }
    if (e.key !== "Tab") return;
    const f = [...$("pinolRutaOverlay").querySelectorAll("button, input, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const p = f[0], u = f[f.length - 1];
    if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
    else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
  }
  function ordenarSeleccion() {
    const items = S.orden.map(porId).filter(Boolean);
    S.orden = ordenarParadas(items, hoyYmd()).map((x) => String(x.id));
  }

  function abrir() {
    construirDom();
    const hoy = hoyYmd();
    S.filtro = "todas"; S.texto = "";
    $("prBuscar").value = "";
    document.querySelectorAll("#pinolRutaOverlay [data-pr=f]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === "todas")));
    // Lo que ya estaba marcado en la tabla se conserva; nada se marca por defecto.
    const previas = [...(root._pinolSelectedIds || [])].map(String).filter((id) => { const x = porId(id); return x && estatusDe(x) === "PENDIENTE"; });
    S.orden = []; S.cant = {};
    previas.forEach(agregar);
    ordenarSeleccion();
    $("prFecha").value = hoy;
    $("prResp").value = leer("pinolRutaResp", "L.E. LIZBETH URIBE PANTOJA");
    $("prVeh").value = leer("pinolRutaVeh", "");
    pintar();
    S.opener = document.activeElement;
    $("pinolRutaOverlay").classList.add("show");
    $("prAviso").textContent = previas.length ? `${previas.length} marcada${previas.length === 1 ? "" : "s"} desde la tabla` : "";
    setTimeout(() => ($("prBuscar") || $("prImprimir")).focus(), 30);
  }
  function cerrar() {
    const o = $("pinolRutaOverlay");
    if (!o) return;
    o.classList.remove("show");
    if (S.opener && document.contains(S.opener)) S.opener.focus();
  }

  function metaActual() {
    const meta = { fecha: $("prFecha").value || hoyYmd(), responsable: $("prResp").value.trim(), vehiculo: $("prVeh").value.trim(), cantidades: { ...S.cant }, logos: root.PINOL_LOGOS || {} };
    guardar("pinolRutaResp", meta.responsable); guardar("pinolRutaVeh", meta.vehiculo);
    return meta;
  }
  function imprimirHtml(paradas, meta) {
    const cont = $("pinolPrintContainer");
    const html = htmlGuia(paradas, meta);
    if (cont) cont.innerHTML = html;
    const muns = municipiosDe(paradas);
    const w = window.open("", "_blank");
    if (!w) { if (typeof root.showToast === "function") root.showToast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e intenta de nuevo.", false, "warn"); return false; }
    w.document.write(`<html><head><title>Guía de ruta Pinol - ${esc(muns.join(", ") || "ruta")}</title><style>@page{size:letter;margin:10mm}body{margin:0}</style></head><body>${html}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
    return true;
  }

  async function imprimir(marcar) {
    const paradas = S.orden.map(porId).filter(Boolean);
    if (!paradas.length) return;
    const meta = metaActual();
    if (!marcar) { imprimirHtml(paradas, meta); return; }
    if (!meta.responsable) { if (typeof root.showToast === "function") root.showToast("Indica el responsable de la entrega para marcar la ruta en tránsito.", false, "warn"); $("prResp").focus(); return; }
    const t = totales(paradas, S.cant);
    const ok = await root.showConfirmDialog("Marcar la ruta en tránsito", `Se marcarán ${t.paradas} solicitud(es) como enviadas (${t.botellas} botellas, ${t.litros.toFixed(1)} L) con fecha ${meta.fecha}. Cada unidad recibirá su aviso para confirmar la recepción.`);
    if (!ok) return;
    try {
      root.showOverlay("Marcando la ruta en tránsito...", "Pinol");
      // Una actualización por cantidad distinta; solo toca solicitudes que SIGUEN pendientes (nadie las surtió mientras tanto)
      const porCantidad = new Map();
      paradas.forEach((x) => { const q = S.cant[String(x.id)]; if (!porCantidad.has(q)) porCantidad.set(q, []); porCantidad.get(q).push(x.id); });
      let actualizadas = 0;
      for (const [q, ids] of porCantidad) {
        const { data, error } = await root.supabase.from("pinol_solicitudes")
          .update({ estatus: "ENTREGADO", fecha_entrega: meta.fecha, timestamp_entrega: new Date().toISOString(), entregado_por: meta.responsable, comentario_entrega: meta.vehiculo || null, cantidad_entregada: Math.min(q, MAX_ENTREGA) })
          .in("id", ids).eq("estatus", "PENDIENTE").select("id");
        if (error) throw error;
        actualizadas += (data || []).length;
      }
      const omitidas = paradas.length - actualizadas;
      root.hideOverlay();
      if (typeof root.invalidatePinolCache === "function") root.invalidatePinolCache();
      root._pinolSelectedIds && root._pinolSelectedIds.clear();
      if (typeof root.refreshPinol === "function") await root.refreshPinol();
      if (typeof root.showToast === "function") root.showToast(omitidas ? `${actualizadas} surtidas; ${omitidas} ya no estaban pendientes y no se tocaron.` : `${actualizadas} solicitudes marcadas en tránsito`, !omitidas, omitidas ? "warn" : "good");
      imprimirHtml(paradas, meta);
      cerrar();
    } catch (err) {
      console.error("[PinolRuta] surtir ruta:", err);
      try { root.hideOverlay(); } catch (e) { /* ya cerrado */ }
      if (typeof root.showToast === "function") root.showToast("No se pudo marcar la ruta: " + (err.message || err), false, "bad");
    }
  }

  Object.assign(API, { abrir, cerrar, imprimirHtml, _estado: S });
})(typeof window !== "undefined" ? window : globalThis);
