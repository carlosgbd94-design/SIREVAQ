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
          ${m.folio ? `<div style="font-size:11px;font-weight:900;color:#0f172a;margin-top:2px;">FOLIO ${esc(m.folio)}${m.reimpresion ? ` · <span style="color:#991b1b;">REIMPRESIÓN${m.reimpresion !== true && m.reimpresion !== "" ? " " + esc(m.reimpresion) : ""}</span>` : ""}</div>` : ""}
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
  const claveFolio = (r) => `RUTA-${String(r.numero == null ? 0 : r.numero).padStart(4, "0")}`;

  /** Foto de las paradas tal como salen en la guía: orden, cantidad acotada y los datos que imprime la guía. */
  function instantanea(paradas, cantidades) {
    return (paradas || []).map((x) => {
      const q = cantidades && cantidades[String(x.id)] != null ? num(cantidades[String(x.id)]) : cantidadInicial(x);
      return {
        id: String(x.id), clues: x.clues || "", unidad: x.unidad || "", municipio: x.municipio || "",
        existencia_actual_botellas: num(x.existencia_actual_botellas), solicitud_botellas: num(x.solicitud_botellas),
        observaciones: x.observaciones || "", cantidad: Math.min(MAX_ENTREGA, Math.max(1, Math.round(q) || 1))
      };
    });
  }
  /** De una ruta guardada a lo que necesita htmlGuia: paradas (en su orden) + meta. */
  function guiaDeRuta(ruta, opciones) {
    const op = opciones || {};
    const paradas = (ruta.paradas || []).map((p) => ({ ...p, estatus: "PENDIENTE" }));   // «PENDIENTE» solo para que la guía marque SIN EXISTENCIA como al imprimirla
    const cantidades = {};
    paradas.forEach((p) => { cantidades[String(p.id)] = num(p.cantidad); });
    return { paradas, meta: { fecha: ruta.fecha, responsable: ruta.responsable, vehiculo: ruta.vehiculo || "", cantidades, logos: op.logos || {}, folio: claveFolio(ruta), reimpresion: op.reimpresion ? (op.fechaReimpresion || "") : "" } };
  }
  Object.assign(API, { instantanea, guiaDeRuta, claveFolio });

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

  const S = { orden: [], cant: {}, filtro: "todas", texto: "", abierto: false, opener: null, rutas: [], textoRutas: "", rutaAbierta: null, ultimaRuta: null };
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
        <button type="button" class="pr-btn ok" data-pr="surtir" id="prSurtir">${ICO("local_shipping")}Marcar en tránsito y guardar ruta</button>
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
    const ok = await root.showConfirmDialog("Marcar la ruta en tránsito", `Se marcarán ${t.paradas} solicitud(es) como enviadas (${t.botellas} botellas, ${t.litros.toFixed(1)} L) con fecha ${meta.fecha}. La ruta queda guardada para poder reimprimir la guía, y cada unidad recibirá su aviso para confirmar la recepción.`);
    if (!ok) return;
    // Guarda la ruta y marca las unidades en una sola operación; luego un aviso con «Imprimir guía» que no se pierde al cerrar ventanas
    const r = await despacharYAvisar(paradas, meta);
    if (r) cerrar();
  }

  /* ───────────────────────────── rutas despachadas: guardado, aviso y reimpresión ───────────────────────────── */
  const ESTILOS_RUTAS = `
  #pinolRutaListo,#pinolRutasOverlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)}
  #pinolRutaListo{z-index:2700}#pinolRutasOverlay{z-index:2650}
  #pinolRutaListo.show,#pinolRutasOverlay.show{display:flex}
  .pl-box{width:100%;max-width:520px;background:#fff;border-radius:22px;padding:22px;color:#0f172a;box-shadow:0 20px 50px rgba(15,23,42,.35);font-family:inherit}
  .pl-ico{width:52px;height:52px;border-radius:16px;background:#d1fae5;color:#065f46;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
  .pl-ico .material-symbols-rounded{font-size:30px}
  .pl-box h3{margin:0 0 4px;font-size:19px;font-weight:900}
  .pl-box p{margin:0 0 4px;font-size:13px;font-weight:600;color:#334155;line-height:1.45}
  .pl-box .pl-datos{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}
  .pl-chip{display:inline-flex;gap:4px;align-items:center;padding:3px 10px;border-radius:99px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:12px;font-weight:800;color:#1e293b}
  .pl-aviso{padding:10px 12px;border-radius:12px;background:#fef3c7;border:1px solid #fcd34d;color:#78350f;font-size:12.5px;font-weight:700;margin:0 0 12px}
  .pl-acciones{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:6px}
  .pl-btn{font-family:inherit;min-height:0!important;height:42px!important;padding:0 16px!important;border-radius:12px!important;border:1px solid #0f172a!important;background:#fff!important;color:#0f172a!important;font-size:13px!important;font-weight:800!important;display:inline-flex!important;align-items:center;gap:6px;cursor:pointer;transition:none!important}
  .pl-btn.sol{background:#0f172a!important;color:#fff!important}
  .pl-btn .material-symbols-rounded{font-size:19px}
  .pl-btn:focus-visible,.pl-in:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  .pl-btn[disabled]{opacity:.5;cursor:default}
  .pl-hist{width:100%;max-width:1040px;max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;color:#0f172a;box-shadow:0 20px 50px rgba(15,23,42,.35);font-family:inherit}
  .pl-hist-head{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid #e2e8f0}
  .pl-hist-head h3{margin:0;font-size:18px;font-weight:900}
  .pl-hist-head p{margin:2px 0 0;font-size:12px;font-weight:600;color:#475569}
  .pl-x{margin-left:auto}
  .pl-in{height:38px!important;min-height:0!important;padding:0 12px!important;border:1px solid #94a3b8!important;border-radius:10px!important;background:#fff!important;font-size:13px;font-weight:600;font-family:inherit;color:#0f172a}
  .pl-bar{display:flex;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid #e2e8f0}
  .pl-lista{overflow-y:auto;padding:8px 14px 16px;margin:0;list-style:none;flex:1}
  .pl-ruta{border:1px solid #cbd5e1;border-radius:14px;margin-top:8px;background:#fff}
  .pl-fila{display:flex;align-items:center;gap:12px;padding:10px 14px}
  .pl-acc{display:flex;gap:8px;flex:none;align-items:center}
  .pl-acc .pl-btn{white-space:nowrap}
  @media (max-width:640px){.pl-fila{flex-wrap:wrap}.pl-acc{width:100%;justify-content:flex-end}}
  .pl-folio{font-family:monospace;font-size:13px;font-weight:900;background:#0f172a;color:#fff;border-radius:8px;padding:3px 9px}
  .pl-main{flex:1 1 0;min-width:0}
  .pl-main b{display:block;font-size:13.5px;font-weight:800}
  .pl-main small{font-size:11.5px;font-weight:600;color:#475569}
  .pl-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
  .pl-t{padding:1px 9px;border-radius:99px;font-size:11px;font-weight:800;background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;white-space:nowrap}
  .pl-t.ok{background:#d1fae5;border-color:#6ee7b7;color:#065f46}.pl-t.am{background:#fef3c7;border-color:#fcd34d;color:#78350f}
  .pl-det{padding:0 14px 12px;font-size:12.5px;font-weight:600;color:#1e293b}
  .pl-det ol{margin:6px 0 0;padding-left:22px}
  .pl-det li{padding:2px 0}
  .pl-vacio{padding:34px 16px;text-align:center;font-size:13px;font-weight:600;color:#475569}
  `;

  const usuarioNombre = () => String((root.USER && (root.USER.nombre || root.USER.usuario)) || "");

  /** Marca la ruta en tránsito Y la guarda, todo en una transacción del servidor. Devuelve la ruta guardada. */
  async function despachar(paradas, meta) {
    const snap = instantanea(paradas, meta.cantidades);
    const { data, error } = await root.supabase.rpc("pinol_despachar_ruta", {
      p_fecha: meta.fecha, p_responsable: meta.responsable, p_vehiculo: meta.vehiculo || null, p_paradas: snap
    });
    if (error) throw error;
    const res = data || {};
    const { data: ruta, error: e2 } = await root.supabase.from("pinol_rutas").select("*").eq("id", res.ruta_id).single();
    if (e2) throw e2;
    return { ruta, actualizadas: res.actualizadas || 0, omitidas: res.omitidas || 0 };
  }
  Object.assign(API, { despachar });

  /** Imprime una ruta guardada. La primera impresión es la original; las siguientes llevan la leyenda de reimpresión. */
  function imprimirRuta(ruta, esReimpresion) {
    const g = guiaDeRuta(ruta, { logos: root.PINOL_LOGOS || {}, reimpresion: esReimpresion, fechaReimpresion: new Date().toLocaleDateString("es-MX") });
    const ok = imprimirHtml(g.paradas, g.meta);
    if (ok) {
      // Contador de impresiones: informativo, no debe estorbar si falla
      root.supabase.from("pinol_rutas").update({ impresiones: num(ruta.impresiones) + 1, ultima_impresion_ts: new Date().toISOString(), ultima_impresion_por: usuarioNombre() || null })
        .eq("id", ruta.id).then(() => { ruta.impresiones = num(ruta.impresiones) + 1; }, () => { /* sin contador */ });
    }
    return ok;
  }
  Object.assign(API, { imprimirRuta });

  function construirDomRutas() {
    if ($("pinolRutaListo")) return;
    const st = document.createElement("style"); st.id = "pinolRutasStyles"; st.textContent = ESTILOS_RUTAS; document.head.appendChild(st);
    const l = document.createElement("div");
    l.id = "pinolRutaListo";
    l.innerHTML = `<div class="pl-box" role="dialog" aria-modal="true" aria-labelledby="plTitulo">
      <div class="pl-ico" aria-hidden="true"><span class="material-symbols-rounded">task_alt</span></div>
      <h3 id="plTitulo">Ruta guardada y en tránsito</h3>
      <p id="plTexto"></p>
      <div class="pl-datos" id="plDatos"></div>
      <div class="pl-aviso" id="plAviso" hidden></div>
      <p style="font-size:12px;color:#475569">La guía queda guardada: si cierras la ventana de impresión o no sale, la reimprimes desde <b>Rutas despachadas</b>. Imprimirla otra vez no cambia nada en las unidades.</p>
      <div class="pl-acciones">
        <button type="button" class="pl-btn" data-pl="historial"><span class="material-symbols-rounded" aria-hidden="true">history</span>Rutas despachadas</button>
        <button type="button" class="pl-btn" data-pl="cerrar">Cerrar</button>
        <button type="button" class="pl-btn sol" data-pl="imprimir" id="plImprimir"><span class="material-symbols-rounded" aria-hidden="true">print</span>Imprimir guía</button>
      </div></div>`;
    document.body.appendChild(l);
    l.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pl]"); if (!b) return;
      if (b.dataset.pl === "cerrar") return cerrarListo();
      if (b.dataset.pl === "imprimir" && S.ultimaRuta) { imprimirRuta(S.ultimaRuta, S.ultimaRuta._yaImpresa); S.ultimaRuta._yaImpresa = true; return; }
      if (b.dataset.pl === "historial") { cerrarListo(); abrirHistorial(); }
    });
    l.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); cerrarListo(); } else atrapaFoco(e, l); });

    const h = document.createElement("div");
    h.id = "pinolRutasOverlay";
    h.innerHTML = `<div class="pl-hist" role="dialog" aria-modal="true" aria-labelledby="phTitulo">
      <div class="pl-hist-head"><div><h3 id="phTitulo">Rutas despachadas</h3><p>Cada ruta que se marca en tránsito queda guardada. Reimprime la guía cuando la necesites: no cambia el estatus de las unidades.</p></div>
        <button type="button" class="pr-ib pl-x pl-btn" data-ph="cerrar" aria-label="Cerrar" style="width:38px;padding:0!important;justify-content:center"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      <div class="pl-bar"><input id="phBuscar" class="pl-in" type="search" placeholder="Buscar folio, unidad, responsable o municipio" aria-label="Buscar ruta" autocomplete="off" style="flex:1"><span id="phConteo" style="font-size:12px;font-weight:700;color:#475569"></span></div>
      <ul class="pl-lista" id="phLista" aria-live="polite"></ul></div>`;
    document.body.appendChild(h);
    h.addEventListener("click", alClicHistorial);
    h.addEventListener("mousedown", (e) => { if (e.target === h) cerrarHistorial(); });
    h.addEventListener("input", (e) => { if (e.target.id === "phBuscar") { S.textoRutas = e.target.value; pintarHistorial(); } });
    h.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); cerrarHistorial(); } else atrapaFoco(e, h); });
  }
  function atrapaFoco(e, cont) {
    if (e.key !== "Tab") return;
    const f = [...cont.querySelectorAll("button, input, summary, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const p = f[0], u = f[f.length - 1];
    if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
    else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
  }

  function mostrarListo(ruta, res) {
    construirDomRutas();
    S.ultimaRuta = ruta; ruta._yaImpresa = false;
    S.openerListo = document.activeElement;
    $("plTexto").textContent = `${claveFolio(ruta)} · salida ${root.PinolRuta.fechaLarga(ruta.fecha)}. Las unidades ya aparecen en tránsito y recibirán su aviso para confirmar la recepción.`;
    $("plDatos").innerHTML = `<span class="pl-chip">${ruta.total_paradas} ${ruta.total_paradas === 1 ? "unidad" : "unidades"}</span><span class="pl-chip">${num(ruta.total_botellas)} botellas</span><span class="pl-chip">${esc(ruta.responsable)}</span>${ruta.vehiculo ? `<span class="pl-chip">${esc(ruta.vehiculo)}</span>` : ""}`;
    const av = $("plAviso");
    av.hidden = !res.omitidas;
    av.textContent = res.omitidas ? `${res.omitidas} solicitud(es) ya no estaban pendientes (alguien más las surtió): no se tocaron y no van en esta guía.` : "";
    $("pinolRutaListo").classList.add("show");
    setTimeout(() => $("plImprimir").focus(), 30);
  }
  function cerrarListo() {
    const l = $("pinolRutaListo"); if (!l) return;
    l.classList.remove("show");
    if (S.openerListo && document.contains(S.openerListo)) S.openerListo.focus();
  }

  /* ───────────── historial ───────────── */
  async function cargarRutas() {
    const { data, error } = await root.supabase.from("pinol_rutas").select("*").order("numero", { ascending: false }).limit(300);
    if (error) throw error;
    S.rutas = data || [];
  }
  const recibidasDe = (r) => {
    const mias = (root._pinolRawItems || []).filter((x) => String(x.ruta_id || "") === String(r.id));
    return mias.length ? { n: mias.filter((x) => estatusDe(x) === "RECIBIDO").length, de: mias.length } : null;
  };
  function pintarHistorial() {
    const ul = $("phLista"); if (!ul) return;
    const q = norm(S.textoRutas || "");
    const lista = (S.rutas || []).filter((r) => !q || norm(`${claveFolio(r)} ${r.responsable} ${r.vehiculo || ""} ${(r.municipios || []).join(" ")} ${(r.paradas || []).map((p) => p.unidad + " " + p.clues).join(" ")}`).includes(q));
    $("phConteo").textContent = `${lista.length} de ${(S.rutas || []).length}`;
    if (!lista.length) { ul.innerHTML = `<li class="pl-vacio">${(S.rutas || []).length ? "Ninguna ruta coincide con la búsqueda." : "Todavía no hay rutas despachadas."}</li>`; return; }
    ul.innerHTML = lista.map((r) => {
      const rec = recibidasDe(r);
      const abierta = S.rutaAbierta === r.id;
      return `<li class="pl-ruta"><div class="pl-fila">
          <span class="pl-folio">${esc(claveFolio(r))}</span>
          <span class="pl-main"><b>${esc(root.PinolRuta.fechaLarga(r.fecha))} · ${esc((r.municipios || []).join(", ") || "—")}</b><small>${esc(r.responsable)}${r.vehiculo ? " · " + esc(r.vehiculo) : ""}</small>
            <span class="pl-tags"><span class="pl-t">${r.total_paradas} ${r.total_paradas === 1 ? "unidad" : "unidades"}</span><span class="pl-t">${num(r.total_botellas)} bot.</span>
              ${rec ? `<span class="pl-t ${rec.n === rec.de ? "ok" : "am"}">${rec.n} de ${rec.de} recibidas</span>` : ""}
              ${r.reconstruida ? `<span class="pl-t am" title="Armada después, con las solicitudes que seguían en la tabla: el orden de las paradas es por municipio y unidad">reconstruida</span>` : ""}
              ${num(r.impresiones) ? `<span class="pl-t">impresa ${num(r.impresiones)} ${num(r.impresiones) === 1 ? "vez" : "veces"}</span>` : ""}</span></span>
          <span class="pl-acc">
            <button type="button" class="pl-btn" data-ph="ver" data-id="${esc(r.id)}" aria-expanded="${abierta}">${abierta ? "Ocultar" : "Ver paradas"}</button>
            <button type="button" class="pl-btn sol" data-ph="imprimir" data-id="${esc(r.id)}" aria-label="Reimprimir la guía ${esc(claveFolio(r))}"><span class="material-symbols-rounded" aria-hidden="true">print</span>Reimprimir</button>
          </span>
        </div>
        ${abierta ? `<div class="pl-det"><ol>${(r.paradas || []).map((p) => `<li><b>${esc(p.unidad)}</b> · ${esc(p.clues)} · ${esc(p.municipio)} — ${num(p.cantidad)} botella(s)</li>`).join("")}</ol></div>` : ""}</li>`;
    }).join("");
  }
  function alClicHistorial(e) {
    const b = e.target.closest("[data-ph]"); if (!b) return;
    const a = b.dataset.ph;
    if (a === "cerrar") return cerrarHistorial();
    const r = (S.rutas || []).find((x) => String(x.id) === String(b.dataset.id));
    if (a === "ver" && r) { S.rutaAbierta = S.rutaAbierta === r.id ? null : r.id; pintarHistorial(); return $("phLista").querySelector(`[data-ph=ver][data-id="${cssEsc(r.id)}"]`)?.focus(); }
    if (a === "imprimir" && r) {
      const ya = num(r.impresiones) > 0;
      const ok = imprimirRuta(r, true);
      if (ok) { if (typeof root.showToast === "function") root.showToast(`${claveFolio(r)}: guía enviada a impresión${ya ? "" : ""}.`, true, "good"); setTimeout(pintarHistorial, 700); }
    }
  }
  async function abrirHistorial() {
    construirDomRutas();
    S.openerHist = document.activeElement; S.textoRutas = ""; S.rutaAbierta = null;
    $("phBuscar").value = "";
    $("phLista").innerHTML = `<li class="pl-vacio">Cargando rutas…</li>`;
    $("pinolRutasOverlay").classList.add("show");
    try { await cargarRutas(); pintarHistorial(); }
    catch (err) { console.error("[PinolRuta] historial:", err); $("phLista").innerHTML = `<li class="pl-vacio">No se pudo cargar el historial de rutas: ${esc(err.message || err)}</li>`; }
    setTimeout(() => $("phBuscar").focus(), 30);
  }
  function cerrarHistorial() {
    const h = $("pinolRutasOverlay"); if (!h) return;
    h.classList.remove("show");
    if (S.openerHist && document.contains(S.openerHist)) S.openerHist.focus();
  }

  /** Despacha las paradas (marca en tránsito + guarda la ruta) y muestra el aviso con «Imprimir guía». Lo usan el armador y el surtido masivo. */
  async function despacharYAvisar(paradas, meta) {
    try {
      root.showOverlay("Marcando la ruta en tránsito...", "Pinol");
      const r = await despachar(paradas, meta);
      root.hideOverlay();
      if (typeof root.invalidatePinolCache === "function") root.invalidatePinolCache();
      root._pinolSelectedIds && root._pinolSelectedIds.clear();
      if (typeof root.refreshPinol === "function") await root.refreshPinol();
      if (typeof root.showToast === "function") root.showToast(r.omitidas ? `${r.actualizadas} surtidas; ${r.omitidas} ya no estaban pendientes y no se tocaron.` : `${r.actualizadas} solicitudes marcadas en tránsito`, !r.omitidas, r.omitidas ? "warn" : "good");
      mostrarListo(r.ruta, r);
      return r;
    } catch (err) {
      console.error("[PinolRuta] despachar ruta:", err);
      try { root.hideOverlay(); } catch (e) { /* ya cerrado */ }
      if (typeof root.showToast === "function") root.showToast("No se pudo marcar la ruta: " + (err.message || err), false, "bad");
      return null;
    }
  }
  Object.assign(API, { despacharYAvisar, abrirHistorial, cerrarHistorial });

  Object.assign(API, { abrir, cerrar, imprimirHtml, _estado: S });
})(typeof window !== "undefined" ? window : globalThis);
