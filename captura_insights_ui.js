/**
 * captura_insights_ui.js — Consultas y pintado de los indicadores del Resumen de captura y de la Vista en vivo.
 * El cálculo está en captura_insights.js (funciones puras); aquí solo hay red + DOM.
 *
 * Integración (main.js): renderCaptureSummary() llama a CapturaInsights.attach(data, {...}) y usa
 * CapturaInsights.filterLists()/rowHtml() al pintar las tablas; openLiveView() llama a renderVivo().
 */
(function (root) {
  "use strict";
  const CI = root.CapturaInsights;
  if (!CI || typeof document === "undefined") return;
  const U = CI._util;
  const { esc, norm, fmt, hora, diaCorto } = U;

  /* ───────────────────────────── estilos ───────────────────────────── */
  const CSS = `
  #captureInsights{background:#fff;padding:18px 24px 4px}
  #captureInsights:empty{display:none}
  .ci-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;margin-bottom:14px}
  .ci-search{position:relative;display:flex;align-items:center;flex:1 1 230px;min-width:200px;max-width:340px}
  .ci-search .material-symbols-rounded{position:absolute;left:12px;font-size:20px;color:#475569;pointer-events:none}
  #captureInsights input.ci-input{width:100%!important;height:40px!important;min-height:0!important;padding:0 12px 0 40px!important;border:1px solid #94a3b8!important;border-radius:12px!important;background:#fff!important;background-image:none!important;color:#0f172a!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important;margin:0!important}
  #captureInsights input.ci-input::placeholder{color:#64748b}
  .ci-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto}
  #captureInsights button.ci-chip,#captureInsights button.ci-btn{min-height:0!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;line-height:1!important;cursor:pointer;display:inline-flex!important;align-items:center;gap:6px;white-space:nowrap;box-shadow:none!important;transition:background-color .15s,border-color .15s}
  #captureInsights button.ci-chip{background:#fff!important;color:#1e293b!important;border:1px solid #94a3b8!important}
  #captureInsights button.ci-chip small{font-weight:700;color:#475569}
  #captureInsights button.ci-chip[aria-pressed="true"]{background:#0c4a6e!important;color:#fff!important;border-color:#0c4a6e!important}
  #captureInsights button.ci-chip[aria-pressed="true"] small{color:#e0f2fe}
  #captureInsights button.ci-btn{background:transparent!important;color:#0c4a6e!important;border:1px solid transparent!important}
  .ci-btn .material-symbols-rounded{font-size:18px}
  #captureInsights button:focus-visible,#captureInsights summary:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  @media (hover:hover) and (pointer:fine){
    #captureInsights button.ci-chip:hover{background:#f1f5f9!important}
    #captureInsights button.ci-chip[aria-pressed="true"]:hover{background:#075985!important}
    #captureInsights button.ci-btn:hover{background:#e0f2fe!important}
    #captureInsights button.ci-tile:hover,#captureInsights button.ci-row:hover{border-color:#475569!important}
  }
  .ci-acts{display:flex;gap:4px;margin-left:auto}
  .ci-active{display:flex;align-items:center;gap:10px;margin:-4px 0 14px;padding:8px 12px;border-radius:12px;background:#eff6ff;border:1px solid #93c5fd;color:#1e3a8a;font-size:12.5px;font-weight:700}
  .ci-active span.t{flex:1}
  .ci-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px;margin-bottom:14px}
  #captureInsights .ci-tile,#liveViewKpis .ci-tile{display:flex!important;align-items:flex-start;gap:12px;width:100%!important;min-height:0!important;margin:0!important;padding:13px 14px!important;border-radius:16px!important;border:1px solid #cbd5e1!important;background:#fff!important;color:#0f172a!important;text-align:left!important;font-family:inherit!important;box-shadow:none!important;box-sizing:border-box}
  #captureInsights button.ci-tile{cursor:pointer}
  #captureInsights button.ci-tile[aria-pressed="true"]{border:2px solid #0c4a6e!important;padding:12px 13px!important}
  .ci-ico{flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center}
  .ci-ico .material-symbols-rounded{font-size:22px}
  .ci-txt{min-width:0;flex:1}
  .ci-etq{font-size:11.5px;font-weight:800;color:#334155;line-height:1.25}
  .ci-val{font-size:26px;font-weight:900;line-height:1.15;color:#0f172a;font-variant-numeric:tabular-nums;margin-top:2px}
  .ci-val small{font-size:13px;font-weight:700;color:#475569;margin-left:3px}
  .ci-nota{font-size:11.5px;font-weight:600;color:#475569;line-height:1.35;margin-top:2px}
  .ci-t-rojo .ci-ico{background:#fee2e2;color:#991b1b}.ci-t-ambar .ci-ico{background:#fef3c7;color:#92400e}.ci-t-verde .ci-ico{background:#d1fae5;color:#065f46}
  .ci-t-azul .ci-ico{background:#dbeafe;color:#1e40af}.ci-t-violeta .ci-ico{background:#ede9fe;color:#5b21b6}.ci-t-gris .ci-ico{background:#e2e8f0;color:#334155}
  .ci-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px;margin-bottom:14px}
  .ci-card{border:1px solid #cbd5e1;border-radius:16px;padding:14px 16px;background:#fff;min-width:0}
  .ci-card h4{margin:0;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#0f172a}
  .ci-card p.n{margin:3px 0 10px;font-size:11.5px;font-weight:600;color:#475569}
  .ci-card .vacio{font-size:12.5px;font-weight:700;color:#065f46;padding:6px 0}
  .ci-rows{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
  #captureInsights .ci-row{display:block!important;width:100%!important;min-height:0!important;margin:0!important;padding:7px 9px!important;border-radius:10px!important;border:1px solid transparent!important;background:transparent!important;text-align:left!important;font-family:inherit!important;box-shadow:none!important;color:#0f172a!important}
  #captureInsights button.ci-row{cursor:pointer;border-color:#e2e8f0!important}
  #captureInsights button.ci-row[aria-pressed="true"]{border:2px solid #0c4a6e!important;padding:6px 8px!important}
  .ci-row .l{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:800;color:#0f172a}
  .ci-row .l span:last-child{font-weight:700;color:#334155;text-align:right}
  .ci-bar-t{position:relative;height:7px;border-radius:99px;background:#e2e8f0;margin-top:6px;overflow:visible}
  .ci-bar-t i{display:block;height:100%;border-radius:99px;background:#64748b}
  .ci-bar-t b{position:absolute;top:-3px;width:2px;height:13px;background:#0f172a;border-radius:2px}
  .ci-bar-t.rojo i{background:#dc2626}.ci-bar-t.ambar i{background:#d97706}.ci-bar-t.verde i{background:#059669}.ci-bar-t.violeta i{background:#7c3aed}.ci-bar-t.azul i{background:#2563eb}
  .ci-det{border:1px solid #cbd5e1;border-radius:16px;margin-bottom:14px;background:#fff;overflow:hidden}
  .ci-det summary{cursor:pointer;padding:12px 16px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#0f172a;list-style:none;display:flex;align-items:center;gap:8px}
  .ci-det summary::-webkit-details-marker{display:none}
  .ci-det summary .material-symbols-rounded{font-size:20px;transition:transform .2s}
  .ci-det[open] summary .material-symbols-rounded{transform:rotate(180deg)}
  .ci-det .sc{overflow-x:auto;padding:0 16px 14px}
  .ci-det p.n{margin:0 16px 8px;font-size:11.5px;font-weight:600;color:#475569}
  .ci-tab{width:100%;border-collapse:collapse;font-size:12.5px}
  .ci-tab th{text-align:right;padding:8px 10px;font-size:11px;font-weight:800;color:#334155;background:#f1f5f9;white-space:nowrap}
  .ci-tab th:first-child,.ci-tab td:first-child{text-align:left}
  .ci-tab td{padding:8px 10px;text-align:right;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums}
  .ci-tab td:first-child{font-weight:800}
  .ci-tab tr.al td{background:#fff1f2}
  .ci-tab button.ci-lk{min-height:0!important;height:auto!important;padding:2px 8px!important;border-radius:8px!important;border:1px solid #94a3b8!important;background:#fff!important;color:#0c4a6e!important;font:800 11px/1.3 inherit!important;cursor:pointer;margin-left:6px}
  .ci-spark{display:flex;align-items:flex-end;gap:6px;height:84px;margin-top:6px}
  .ci-spark div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:10.5px;font-weight:700;color:#334155}
  .ci-spark div i{display:block;width:100%;border-radius:6px 6px 0 0;background:#7c3aed;min-height:3px}
  .ci-spark div.cur i{background:#4c1d95}
  .ci-load{font-size:12.5px;font-weight:700;color:#475569;padding:6px 2px 12px}
  /* fichas dentro de las tablas */
  .ci-fichas{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .ci-f{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:99px;font-size:10.5px;font-weight:800;line-height:1.4;border:1px solid transparent;white-space:nowrap}
  .ci-f .material-symbols-rounded{font-size:13px}
  .ci-f.rojo{background:#fee2e2;color:#7f1d1d;border-color:#fca5a5}.ci-f.ambar{background:#fef3c7;color:#78350f;border-color:#fcd34d}.ci-f.verde{background:#d1fae5;color:#064e3b;border-color:#6ee7b7}
  .ci-f.azul{background:#dbeafe;color:#1e3a8a;border-color:#93c5fd}.ci-f.violeta{background:#ede9fe;color:#4c1d95;border-color:#c4b5fd}.ci-f.gris{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
  /* Vista en vivo */
  #liveViewKpis{display:none;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:20px}
  #liveViewKpis .ci-tile{background:var(--md-sys-color-surface,#fff)!important}
  @media (max-width:760px){#captureInsights{padding:14px 12px 4px}.ci-acts{margin-left:0}}
  @media (prefers-reduced-motion:reduce){.ci-det summary .material-symbols-rounded{transition:none}}
  `;
  function inyectarEstilos() {
    if (document.getElementById("ciStyles")) return;
    const s = document.createElement("style");
    s.id = "ciStyles";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ───────────────────────────── estado ───────────────────────────── */
  const S = { key: null, tipo: null, data: null, an: null, resumen: null, racha: null, ctx: null, filtro: { muni: null, texto: "", set: null, etiqueta: "" }, muniDe: new Map(), nombreDe: new Map() };
  const hoyLocal = () => (typeof root.todayYmdLocal === "function" ? root.todayYmdLocal() : new Date().toLocaleDateString("en-CA"));
  const sb = () => root.supabase;
  const traer = (armar) => (typeof root.fetchAllRows === "function" ? root.fetchAllRows(armar) : armar().then((r) => { if (r.error) throw r.error; return r.data || []; }));

  const ICO = (n) => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const ficha = (tono, icono, txt) => `<span class="ci-f ${tono}">${ICO(icono)}${esc(txt)}</span>`;

  /* ───────────────────────────── consultas ───────────────────────────── */
  async function cargarSR(data) {
    const [ini, fin] = [data.fIniStr, data.fFinStr];
    const lunes = CI.lunesDe(ini);
    const [det, ex, prev] = await Promise.all([
      traer(() => sb().from("existencia_detalle").select("id,clues,fecha,biologico,lote,caducidad,cantidad,fecha_recepcion,fecha_apertura,tipo").gte("fecha", ini).lte("fecha", fin).order("id")),
      traer(() => sb().from("biologicos_existencia").select("id,clues,fecha,timestamp,editado,editado_por,sin_movimiento,tiene_ceros").gte("fecha", ini).lte("fecha", fin).order("id")),
      traer(() => sb().from("biologicos_existencia").select("id,clues,fecha").gte("fecha", CI.ymdAdd(lunes, -28)).lt("fecha", lunes).order("id"))
    ]);
    return { an: CI.analizarSR(det, ex, hoyLocal()), racha: CI.rachaSemanal(prev, lunes, 4), unidadRacha: "sem." };
  }
  async function cargarCons(data) {
    const [ini, fin] = [data.fIniStr, data.fFinStr];
    const lunes = CI.lunesDe(ini);
    const cols = "id,clues,fecha,timestamp,srp_dosis,sr_dosis,jeringa_reconst_5ml_0605500438,jeringa_aplic_05ml_0605502657,aguja_0600403711,editado,editado_por,sin_movimiento";
    const [rows, prev] = await Promise.all([
      traer(() => sb().from("consumibles").select(cols).gte("fecha", ini).lte("fecha", fin).order("id")),
      traer(() => sb().from("consumibles").select("id,clues,fecha").gte("fecha", CI.ymdAdd(lunes, -28)).lt("fecha", lunes).order("id"))
    ]);
    return { an: CI.analizarCons(rows), racha: CI.rachaSemanal(prev, lunes, 4), unidadRacha: "sem." };
  }
  async function cargarBio(data) {
    const w = data.active_window || { fecha: data.fecha, tipo_pedido: "MENSUAL" };
    const mensual = (w.tipo_pedido || "MENSUAL") === "MENSUAL";
    const ym = String(w.fecha).slice(0, 7);
    const primero = ym + "-01";
    const d3 = new Date(primero + "T12:00:00"); d3.setMonth(d3.getMonth() - 3);
    const desde = d3.getFullYear() + "-" + String(d3.getMonth() + 1).padStart(2, "0") + "-01";
    const cols = "id,clues,biologico,fecha_captura,fecha_pedido_programada,timestamp,promedio_frascos,existencia_actual_frascos,pedido_frascos,editado,editado_por,sin_pedido,tipo_pedido";
    const filtroTipo = (q) => (mensual ? q.or("tipo_pedido.eq.MENSUAL,tipo_pedido.is.null") : q.eq("tipo_pedido", w.tipo_pedido));
    const [rows, prev] = await Promise.all([
      traer(() => filtroTipo(sb().from("biologicos_pedido").select(cols).eq("fecha_pedido_programada", w.fecha)).order("id")),
      mensual ? traer(() => filtroTipo(sb().from("biologicos_pedido").select("id,clues,fecha_pedido_programada,tipo_pedido").gte("fecha_pedido_programada", desde).lt("fecha_pedido_programada", primero)).order("id")) : Promise.resolve([])
    ]);
    return { an: CI.analizarBio(rows, S.ctx && S.ctx.ventana), racha: mensual ? CI.rachaMensual(prev, ym, 3) : null, unidadRacha: "mes" };
  }
  async function cargarInf(data) {
    const gac = root.getActiveCampaign || (typeof getActiveCampaign === "function" ? getActiveCampaign : null);
    const camp = gac ? ((await gac()).data || null) : null;
    if (!camp) return { an: CI.analizarInf([], [], null, data.fIniStr, hoyLocal(), []), racha: null };
    const [caps, metas] = await Promise.all([
      traer(() => sb().from("influenza_capturas").select("id,clues,fecha,valores,updated_at,sin_movimiento,editado_por").eq("anio_campana", camp.nombre).order("id")),
      traer(() => sb().from("influenza_metas").select("id,clues,metas").eq("anio_campana", camp.nombre).order("id"))
    ]);
    const rubros = typeof INFLUENZA_RUBROS !== "undefined" ? INFLUENZA_RUBROS : [];
    const lunes = CI.lunesDe(data.fIniStr);
    return { an: CI.analizarInf(caps, metas, camp, data.fIniStr, hoyLocal(), rubros), racha: CI.rachaSemanal(caps.filter((r) => r.fecha < lunes), lunes, 4), unidadRacha: "sem." };
  }

  /* ───────────────────────────── filtros ───────────────────────────── */
  function coincide(r) {
    const f = S.filtro;
    const clues = String(r.clues || "").toUpperCase();
    if (f.muni && CI.muniKey(r.municipio) !== f.muni) return false;
    if (f.set && !f.set.has(clues)) return false;
    if (f.texto) {
      const hay = norm(`${r.municipio || ""} ${r.clues || ""} ${r.unidad || ""}`);
      if (!norm(f.texto).split(" ").every((p) => hay.includes(p))) return false;
    }
    return true;
  }
  function filterLists(cap, fal) {
    return { cap: (cap || []).filter(coincide), fal: (fal || []).filter(coincide), activo: !!(S.filtro.muni || S.filtro.set || S.filtro.texto) };
  }

  /** Fichas (hallazgos) que se muestran bajo el nombre de la unidad en las tablas. */
  function rowHtml(r, estado) {
    const clues = String(r.clues || "").toUpperCase();
    const f = [];
    const u = S.an && S.an.unidades.get(clues);
    if (estado === "cap" && u) {
      if (S.tipo === "SR") {
        if (u.ceros.length) f.push(ficha("rojo", "inventory_2", `${u.ceros.length} en cero`));
        if (u.caducados.lotes) f.push(ficha("rojo", "event_busy", `${u.caducados.lotes} caducado${u.caducados.lotes === 1 ? "" : "s"}`));
        if (u.cad.lotes) f.push(ficha("ambar", "hourglass_bottom", `${u.cad.lotes} caduca${u.cad.lotes === 1 ? "" : "n"} ≤3 m`));
        if (u.abiertos.vencidos) f.push(ficha("rojo", "timer", `${u.abiertos.vencidos} abierto${u.abiertos.vencidos === 1 ? "" : "s"} vencido${u.abiertos.vencidos === 1 ? "" : "s"}`));
        else if (u.abiertos.porVencer) f.push(ficha("ambar", "timer", `${u.abiertos.porVencer} abierto${u.abiertos.porVencer === 1 ? "" : "s"} por vencer`));
        if (u.permanencia.excedida) f.push(ficha("ambar", "schedule", `${u.permanencia.excedida} lote${u.permanencia.excedida === 1 ? "" : "s"} >90 d`));
        if (u.prestamos) f.push(ficha("azul", "handshake", "préstamo"));
        f.push(ficha("gris", "package_2", `${fmt(u.frascos)} frascos`));
      } else if (S.tipo === "CONS") {
        if (u.insuficiente) f.push(ficha("rojo", "syringe", `insumos para ${Math.round(u.cobertura * 100)} % de sus dosis`));
        if (u.ceros.length) f.push(ficha("ambar", "inventory_2", `sin ${u.ceros.map((c) => c.replace("Jeringa ", "jer. ").toLowerCase()).join(", ")}`));
        f.push(ficha("gris", "vaccines", `${fmt(u.dosis)} dosis SRP/SR`));
      } else if (S.tipo === "BIO") {
        f.push(ficha("violeta", "local_shipping", `${fmt(u.pedido)} frascos`));
        if (u.alertas.length) f.push(ficha("ambar", "rule", `${u.alertas.length} por revisar`));
        if (u.fueraVentana) f.push(ficha("ambar", "event_busy", "fuera de ventana"));
      } else if (S.tipo === "INF") {
        f.push(ficha("violeta", "vaccines", `${fmt(u.semana)} dosis`));
        if (u.avance != null) f.push(ficha(u.bajoRitmo ? "ambar" : "verde", "trending_up", `${u.avance} % de meta`));
        else f.push(ficha("gris", "flag", "sin meta"));
      }
      const cuando = u.timestamp ? `${diaCorto(ymdDe(u.timestamp))} · ${hora(u.timestamp)}` : (u.fechaCaptura ? diaCorto(u.fechaCaptura) : "");
      if (cuando) f.push(`<span class="ci-f gris">${ICO("schedule")}${esc(cuando)}</span>`);
    } else if (estado === "fal" && S.racha) {
      const n = S.racha(clues);
      const unidad = S.unidadRacha === "mes" ? (n === 1 ? "mes" : "meses") : (n === 1 ? "semana" : "semanas");
      const fem = S.unidadRacha !== "mes"; // semana(s) femenino, mes(es) masculino
      const seguid = fem ? (n === 1 ? "seguida" : "seguidas") : (n === 1 ? "seguido" : "seguidos");
      if (n >= 1) f.push(ficha(n >= 2 ? "rojo" : "ambar", "history", `${n >= (S.unidadRacha === "mes" ? 3 : 4) ? n + "+" : n} ${unidad} ${seguid} sin capturar`));
      else f.push(ficha("verde", "history", S.unidadRacha === "mes" ? "pidió el mes anterior" : "capturó la semana anterior"));
    }
    return f.length ? `<div class="ci-fichas">${f.join("")}</div>` : "";
  }
  const ymdDe = (ts) => CI._util.ymdLocalDeTs(ts) || "";

  /* ───────────────────────────── pintado del panel ───────────────────────────── */
  function contenedor() { return document.getElementById("captureInsights"); }

  function barraHtml() {
    const m = CI.avancePorMunicipio(S.data.capturadas, S.data.faltantes);
    const f = S.filtro;
    const chips = [`<button type="button" class="ci-chip" data-ci="muni" data-v="" aria-pressed="${!f.muni}">Todos<small>${(S.data.capturadas || []).length}/${(S.data.capturadas || []).length + (S.data.faltantes || []).length}</small></button>`]
      .concat(m.map((x) => `<button type="button" class="ci-chip" data-ci="muni" data-v="${esc(x.k)}" aria-pressed="${f.muni === x.k}">${esc(x.etiqueta)}<small>${x.cap}/${x.total}</small></button>`));
    return `<div class="ci-bar" role="search">
      <div class="ci-search">${ICO("search")}<input id="ciBuscar" class="ci-input" type="search" placeholder="Buscar unidad, CLUES o municipio" aria-label="Buscar en las tablas por unidad, CLUES o municipio" value="${esc(f.texto)}" autocomplete="off"></div>
      <div class="ci-chips" role="group" aria-label="Filtrar por municipio">${chips.join("")}</div>
      <div class="ci-acts">
        <button type="button" class="ci-btn" data-ci="copiar" title="Copia un resumen listo para pegar en WhatsApp">${ICO("content_copy")}Copiar resumen</button>
        <button type="button" class="ci-btn" data-ci="csv" title="Descarga una fila por unidad con sus indicadores (abre en Excel)">${ICO("download")}Descargar CSV</button>
      </div></div>
      ${f.set ? `<div class="ci-active" role="status"><span class="t">${ICO("filter_alt")} Mostrando: <strong>${esc(f.etiqueta)}</strong></span><button type="button" class="ci-btn" data-ci="quitar">${ICO("close")}Quitar filtro</button></div>` : ""}`;
  }

  function tileHtml(t) {
    const activo = S.filtro.set && S.filtro.etiqueta === t.etiquetaFiltro;
    const cuerpo = `<span class="ci-ico">${ICO(t.icono)}</span><span class="ci-txt"><span class="ci-etq">${esc(t.etiqueta)}</span><div class="ci-val">${t.valor}</div><div class="ci-nota">${esc(t.nota || "")}</div></span>`;
    if (!t.set) return `<div class="ci-tile ci-t-${t.tono}">${cuerpo}</div>`;
    return `<button type="button" class="ci-tile ci-t-${t.tono}" data-ci="tile" data-id="${esc(t.id)}" aria-pressed="${!!activo}" title="Ver solo estas unidades en las tablas">${cuerpo}</button>`;
  }

  function filaPanelHtml(p, f, i) {
    const nombre = f.etiqueta || S.nombreDe.get(f.clues) || f.clues;
    const marca = f.marca != null ? `<b style="left:${Math.min(100, f.marca)}%" title="Esperado a la fecha"></b>` : "";
    const ancho = Math.max(3, Math.round((f.valor / (p.max || 1)) * 100));
    const cuerpo = `<span class="l"><span>${esc(nombre)}</span><span>${esc(f.texto)}</span></span><span class="ci-bar-t ${f.tono || ""}" style="display:block"><i style="width:${Math.min(100, ancho)}%"></i>${marca}</span>`;
    if (!f.set) return `<li><div class="ci-row">${cuerpo}</div></li>`;
    const act = S.filtro.set && S.filtro.etiqueta === (f.etiquetaFiltro || nombre);
    return `<li><button type="button" class="ci-row" data-ci="fila" data-p="${esc(p.id)}" data-i="${i}" aria-pressed="${!!act}">${cuerpo}</button></li>`;
  }

  function panelHtml(p) {
    const cuerpo = p.filas.length ? `<ul class="ci-rows">${p.filas.map((f, i) => filaPanelHtml(p, f, i)).join("")}</ul>` : `<div class="vacio">${esc(p.vacio || "Sin datos")}</div>`;
    return `<section class="ci-card" aria-label="${esc(p.titulo)}"><h4>${esc(p.titulo)}</h4><p class="n">${esc(p.nota || "")}</p>${cuerpo}</section>`;
  }

  function municipioPanelHtml() {
    const m = CI.avancePorMunicipio(S.data.capturadas, S.data.faltantes);
    if (m.length < 2) return "";
    const filas = m.map((x) => `<li><button type="button" class="ci-row" data-ci="muni" data-v="${esc(x.k)}" aria-pressed="${S.filtro.muni === x.k}"><span class="l"><span>${esc(x.etiqueta)}</span><span>${x.cap} de ${x.total} · ${x.pct} %${x.falta ? ` · faltan ${x.falta}` : ""}</span></span><span class="ci-bar-t ${x.pct >= 100 ? "verde" : x.pct >= 70 ? "azul" : "ambar"}" style="display:block"><i style="width:${Math.max(2, x.pct)}%"></i></span></button></li>`);
    return `<section class="ci-card" aria-label="Avance por municipio"><h4>Avance por municipio</h4><p class="n">Toca un municipio para filtrar las tablas.</p><ul class="ci-rows">${filas.join("")}</ul></section>`;
  }

  function tablaHtml(t) {
    if (!t) return "";
    const filas = t.filas.map((f, i) => `<tr class="${f.alerta ? "al" : ""}">${f.celdas.map((c, j) => `<td>${esc(c)}${j === 0 && f.set ? `<button type="button" class="ci-lk" data-ci="tfila" data-i="${i}">ver unidades</button>` : ""}</td>`).join("")}</tr>`).join("");
    return `<details class="ci-det"><summary>${ICO("expand_more")}${esc(t.titulo)}</summary><p class="n">${esc(t.nota || "")}</p><div class="sc"><table class="ci-tab"><thead><tr>${t.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div></details>`;
  }

  function sparkHtml() {
    const s = S.resumen && S.resumen.serie;
    if (!s || s.length < 2) return "";
    const max = Math.max(1, ...s.map((x) => x.dosis));
    const sem = S.data.fIniStr;
    return `<section class="ci-card" aria-label="Dosis por semana"><h4>Dosis por semana</h4><p class="n">Últimas ${s.length} semanas con reporte (toda la jurisdicción).</p><div class="ci-spark" role="img" aria-label="${esc(s.map((x) => `${CI._util.fechaCorta(x.fecha)}: ${fmt(x.dosis)}`).join("; "))}">${s.map((x) => `<div class="${x.fecha === sem ? "cur" : ""}"><span>${fmt(x.dosis)}</span><i style="height:${Math.max(4, Math.round((x.dosis / max) * 60))}px"></i><span>${CI._util.fechaCorta(x.fecha).replace("-", " ")}</span></div>`).join("")}</div></section>`;
  }

  function render() {
    const c = contenedor();
    if (!c || !S.data) return;
    const previo = document.activeElement && document.activeElement.id === "ciBuscar" ? document.getElementById("ciBuscar").selectionStart : null;
    let html = barraHtml();
    if (S.resumen) {
      html += `<div class="ci-tiles">${S.resumen.tiles.map(tileHtml).join("")}</div>`;
      html += `<div class="ci-cards">${municipioPanelHtml()}${S.resumen.paneles.map(panelHtml).join("")}${sparkHtml()}</div>`;
      html += tablaHtml(S.resumen.tabla);
    } else if (S.error) {
      html += `<div class="ci-load" role="status">No se pudieron calcular los indicadores (${esc(S.error)}). Las tablas siguen funcionando.</div>`;
    } else {
      html += `<div class="ci-load" role="status">Calculando indicadores…</div>`;
    }
    c.innerHTML = html;
    if (previo != null) { const i = document.getElementById("ciBuscar"); if (i) { i.focus(); i.setSelectionRange(previo, previo); } }
  }

  function aplicarFiltro(set, etiqueta) {
    const igual = S.filtro.set && S.filtro.etiqueta === etiqueta;
    S.filtro.set = igual ? null : set;
    S.filtro.etiqueta = igual ? "" : etiqueta;
    refrescar();
  }
  function refrescar() {
    render();
    if (S.ctx && typeof S.ctx.repaint === "function") S.ctx.repaint();
    // tras el repintado del panel, devuelve el foco al elemento activado si desapareció
  }

  /* ───────────────────────────── acciones ───────────────────────────── */
  function toast(msg, ok) { if (typeof root.showToast === "function") root.showToast(msg, ok !== false, ok === false ? "bad" : "good"); }
  function copiar() {
    const txt = CI.textoResumen(S.tipo, S.data, CI.avancePorMunicipio(S.data.capturadas, S.data.faltantes), S.resumen);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Resumen copiado. Pégalo en WhatsApp.", true)).catch(() => toast("No se pudo copiar el resumen.", false));
  }
  function descargarCsv() {
    const csv = CI.construirCsv(S.tipo, S.data, S.an, S.racha);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const ref = (S.data.fIniStr || S.data.fecha || "").slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `resumen_captura_${S.tipo}_${ref}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function enlazar() {
    const c = contenedor();
    if (!c || c.dataset.ciBound === "1") return;
    c.dataset.ciBound = "1";
    c.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ci]");
      if (!b || !c.contains(b)) return;
      const a = b.dataset.ci;
      if (a === "muni") { S.filtro.muni = b.dataset.v && S.filtro.muni !== b.dataset.v ? b.dataset.v : null; refrescar(); }
      else if (a === "tile") { const t = S.resumen.tiles.find((x) => x.id === b.dataset.id); if (t) aplicarFiltro(t.set, t.etiquetaFiltro); }
      else if (a === "fila") { const p = S.resumen.paneles.find((x) => x.id === b.dataset.p); const f = p && p.filas[Number(b.dataset.i)]; if (f) aplicarFiltro(f.set, f.etiquetaFiltro || f.etiqueta || S.nombreDe.get(f.clues) || f.clues); }
      else if (a === "tfila") { const f = S.resumen.tabla.filas[Number(b.dataset.i)]; if (f && f.set) aplicarFiltro(f.set, f.etiquetaFiltro); }
      else if (a === "quitar") { S.filtro.set = null; S.filtro.etiqueta = ""; refrescar(); }
      else if (a === "copiar") copiar();
      else if (a === "csv") descargarCsv();
    });
    let t = null;
    c.addEventListener("input", (e) => {
      if (e.target.id !== "ciBuscar") return;
      clearTimeout(t);
      const v = e.target.value;
      t = setTimeout(() => { S.filtro.texto = v; refrescar(); }, 180);
    });
  }

  /* ───────────────────────────── entrada principal ───────────────────────────── */
  async function attach(data, ctx) {
    inyectarEstilos();
    const c = contenedor();
    if (!c) return;
    const rol = String((root.AppState && root.AppState.rol) || (root.USER && root.USER.rol) || "").toUpperCase();
    if (rol === "UNIDAD") { c.innerHTML = ""; return; }
    enlazar();
    const tipo = data.tipo || "SR";
    const w = data.active_window ? `${data.active_window.fecha}|${data.active_window.tipo_pedido}` : "";
    const key = `${tipo}|${data.fecha}|${w}|${(data.capturadas || []).length}|${(data.faltantes || []).length}`;
    const mismoPeriodo = S.tipo === tipo && S.key && S.key.split("|").slice(0, 3).join("|") === key.split("|").slice(0, 3).join("|");
    S.key = key; S.tipo = tipo; S.data = data; S.ctx = ctx || {};
    if (!mismoPeriodo) S.filtro = { muni: null, texto: "", set: null, etiqueta: "" };
    S.muniDe = new Map(); S.nombreDe = new Map();
    [...(data.capturadas || []), ...(data.faltantes || [])].forEach((r) => { const k = String(r.clues || "").toUpperCase(); S.muniDe.set(k, CI.muniKey(r.municipio)); S.nombreDe.set(k, r.unidad || k); });
    if (!mismoPeriodo) { S.an = null; S.resumen = null; S.racha = null; }
    S.error = null;
    render();
    try {
      const cargar = { SR: cargarSR, CONS: cargarCons, BIO: cargarBio, INF: cargarInf }[tipo];
      if (!cargar) return;
      const r = await cargar(data);
      if (S.key !== key) return; // llegó otra consulta mientras tanto
      // solo las unidades del alcance del usuario (RLS ya filtra; esto cuida el resumen municipal/caravanas)
      const permitidas = new Set([...S.muniDe.keys()]);
      r.an.unidades.forEach((_, k) => { if (!permitidas.has(k)) r.an.unidades.delete(k); });
      S.an = r.an; S.racha = r.racha; S.unidadRacha = r.unidadRacha;
      S.resumen = CI.construirResumen(tipo, r.an, { muniDe: (cl) => S.muniDe.get(String(cl).toUpperCase()) || "OTRO", ventana: S.ctx.ventana });
      refrescar();
    } catch (e) {
      console.warn("[CapturaInsights]", e);
      if (S.key === key) { S.error = (e && e.message) || "error"; render(); }
    }
  }

  /* ───────────────────────────── Vista en vivo ───────────────────────────── */
  function renderVivo(tipo, res) {
    inyectarEstilos();
    const box = document.getElementById("liveViewKpis");
    if (!box) return;
    let k = [];
    try { k = CI.kpisVivo(tipo, res, hoyLocal()); } catch (e) { console.warn("[CapturaInsights] kpisVivo", e); }
    if (!k.length) { box.style.display = "none"; box.innerHTML = ""; return; }
    box.innerHTML = k.map((t) => `<div class="ci-tile ci-t-${t.tono}"><span class="ci-ico">${ICO(t.icono)}</span><span class="ci-txt"><span class="ci-etq">${esc(t.etiqueta)}</span><div class="ci-val">${t.valor}</div><div class="ci-nota">${esc(t.nota || "")}</div></span></div>`).join("");
    box.style.display = "grid";
  }

  Object.assign(CI, { attach, filterLists, rowHtml, renderVivo, _estado: S });
})(typeof window !== "undefined" ? window : globalThis);
