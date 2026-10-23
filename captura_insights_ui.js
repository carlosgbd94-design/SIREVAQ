/**
 * captura_insights_ui.js — Consultas y pintado de los indicadores del Resumen de captura y de la Vista en vivo.
 * El cálculo está en captura_insights.js (funciones puras); aquí solo hay red + DOM.
 *
 * Criterio de diseño: el resumen es para decidir a quién llamar o qué revisar HOY, así que muestra una sola fila de
 * indicadores breves (clicables: filtran las tablas) y unas pocas fichas de alerta bajo cada unidad. Todo el detalle
 * (lotes, caducidades, insumos, renglones del pedido) está en la Vista en vivo de la unidad.
 *
 * Integración (main.js): renderCaptureSummary() llama a CapturaInsights.attach(data, {...}) y usa
 * CapturaInsights.filterLists()/rowHtml() al pintar las tablas; openLiveView() llama a renderVivo().
 */
(function (root) {
  "use strict";
  const CI = root.CapturaInsights;
  if (!CI || typeof document === "undefined") return;
  const U = CI._util;
  const { esc, norm, fmt } = U;

  /* ───────────────────────────── estilos ───────────────────────────── */
  const CSS = `
  #captureInsights{background:#fff;padding:14px 24px 4px}
  #captureInsights:empty{display:none}
  .ci-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:10px}
  .ci-search{position:relative;display:flex;align-items:center;flex:0 1 230px;min-width:170px}
  .ci-search .material-symbols-rounded{position:absolute;left:10px;font-size:19px;color:#475569;pointer-events:none}
  #captureInsights input.ci-input{width:100%!important;height:36px!important;min-height:0!important;padding:0 10px 0 36px!important;border:1px solid #94a3b8!important;border-radius:10px!important;background:#fff!important;background-image:none!important;color:#0f172a!important;font-size:12.5px!important;font-weight:600!important;box-shadow:none!important;margin:0!important}
  #captureInsights input.ci-input::placeholder{color:#64748b}
  .ci-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto}
  #captureInsights button.ci-chip{min-height:0!important;height:32px!important;padding:0 11px!important;border-radius:999px!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;line-height:1!important;cursor:pointer;display:inline-flex!important;align-items:center;gap:6px;white-space:nowrap;box-shadow:none!important;background:#fff!important;color:#1e293b!important;border:1px solid #94a3b8!important;transition:background-color .15s}
  #captureInsights button.ci-chip small{font-weight:700;color:#475569;font-size:11px}
  #captureInsights button.ci-chip[aria-pressed="true"]{background:#0c4a6e!important;color:#fff!important;border-color:#0c4a6e!important}
  #captureInsights button.ci-chip[aria-pressed="true"] small{color:#e0f2fe}
  .ci-acts{display:flex;gap:2px;margin-left:auto}
  #captureInsights button.ci-ib{min-height:0!important;width:36px!important;height:36px!important;padding:0!important;border:none!important;border-radius:10px!important;background:transparent!important;color:#0c4a6e!important;display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer;box-shadow:none!important}
  .ci-ib .material-symbols-rounded{font-size:22px}
  #captureInsights button:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  @media (hover:hover) and (pointer:fine){
    #captureInsights button.ci-chip:hover{background:#f1f5f9!important}
    #captureInsights button.ci-chip[aria-pressed="true"]:hover{background:#075985!important}
    #captureInsights button.ci-ib{transition:transform .2s,filter .2s}
    #captureInsights button.ci-ib:hover{transform:translateY(-2px);filter:drop-shadow(0 3px 4px rgba(12,74,110,.35))}
    #captureInsights button.ci-tile:hover{border-color:#475569!important}
  }
  .ci-active{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:4px 6px 4px 12px;border-radius:10px;background:#eff6ff;border:1px solid #93c5fd;color:#1e3a8a;font-size:12px;font-weight:700}
  .ci-active .t{flex:1;min-width:0}
  .ci-active button{min-height:0!important;height:28px!important;padding:0 10px!important;border-radius:8px!important;border:none!important;background:transparent!important;color:#1e3a8a!important;font:800 12px/1 inherit!important;cursor:pointer;display:inline-flex!important;align-items:center;gap:4px}
  .ci-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:8px;margin-bottom:6px}
  #captureInsights .ci-tile,#liveViewKpis .ci-tile{display:flex!important;align-items:center;gap:9px;width:100%!important;min-height:0!important;margin:0!important;padding:8px 11px!important;border-radius:12px!important;border:1px solid #cbd5e1!important;background:#fff!important;color:#0f172a!important;text-align:left!important;font-family:inherit!important;box-shadow:none!important;box-sizing:border-box}
  #captureInsights button.ci-tile{cursor:pointer}
  #captureInsights button.ci-tile[aria-pressed="true"]{border:2px solid #0c4a6e!important;padding:7px 10px!important}
  .ci-ico{flex:none;width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center}
  .ci-ico .material-symbols-rounded{font-size:18px}
  .ci-val{flex:none;font-size:22px;font-weight:900;line-height:1;color:#0f172a;font-variant-numeric:tabular-nums;min-width:1ch}
  .ci-val small{font-size:12px;font-weight:700;color:#475569;margin-left:2px}
  .ci-txt{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
  .ci-etq{font-size:11.5px;font-weight:800;color:#0f172a;line-height:1.2}
  .ci-nota{font-size:11px;font-weight:600;color:#475569;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ci-t-rojo .ci-ico{background:#fee2e2;color:#991b1b}.ci-t-ambar .ci-ico{background:#fef3c7;color:#92400e}.ci-t-verde .ci-ico{background:#d1fae5;color:#065f46}
  .ci-t-azul .ci-ico{background:#dbeafe;color:#1e40af}.ci-t-violeta .ci-ico{background:#ede9fe;color:#5b21b6}.ci-t-gris .ci-ico{background:#e2e8f0;color:#334155}
  .ci-load{font-size:12px;font-weight:700;color:#475569;padding:4px 2px 8px}
  /* fichas de alerta bajo la unidad (tablas) */
  .ci-fichas{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
  .ci-f{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:99px;font-size:10.5px;font-weight:800;line-height:1.5;border:1px solid transparent;white-space:nowrap}
  .ci-f .material-symbols-rounded{font-size:12px}
  .ci-f.rojo{background:#fee2e2;color:#7f1d1d;border-color:#fca5a5}.ci-f.ambar{background:#fef3c7;color:#78350f;border-color:#fcd34d}.ci-f.verde{background:#d1fae5;color:#064e3b;border-color:#6ee7b7}
  .ci-f.azul{background:#dbeafe;color:#1e3a8a;border-color:#93c5fd}.ci-f.violeta{background:#ede9fe;color:#4c1d95;border-color:#c4b5fd}.ci-f.gris{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
  /* Vista en vivo */
  #liveViewKpis{display:none;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:18px}
  #liveViewKpis .ci-tile{background:var(--md-sys-color-surface,#fff)!important;align-items:flex-start}
  #liveViewKpis .ci-val{font-size:20px}
  @media (max-width:760px){#captureInsights{padding:12px 12px 4px}.ci-search{flex:1 1 100%;max-width:none}.ci-tiles{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
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
  const COLS_BIO = "bcg,hepatitis_b,hexavalente,dpt,rotavirus,neumococica_13,neumococica_20,srp,sr,vph,varicela,hepatitis_a,td,tdpa,covid_19,influenza,vsr";

  async function cargarSR(data) {
    const [ini, fin] = [data.fIniStr, data.fFinStr];
    const lunes = CI.lunesDe(ini);
    const [det, ex, prev] = await Promise.all([
      traer(() => sb().from("existencia_detalle").select("id,clues,fecha,biologico,lote,caducidad,cantidad,fecha_recepcion,fecha_apertura,tipo").gte("fecha", ini).lte("fecha", fin).order("id")),
      traer(() => sb().from("biologicos_existencia").select(`id,clues,fecha,timestamp,editado,editado_por,sin_movimiento,tiene_ceros,${COLS_BIO}`).gte("fecha", ini).lte("fecha", fin).order("id")),
      // Las semanas previas dan dos cosas: qué biológicos se quedaron en cero y cuántas semanas lleva sin capturar
      traer(() => sb().from("biologicos_existencia").select(`id,clues,fecha,timestamp,${COLS_BIO}`).gte("fecha", CI.ymdAdd(lunes, -35)).lt("fecha", lunes).order("id"))
    ]);
    return { an: CI.analizarSR(det, ex, hoyLocal(), prev), racha: CI.rachaSemanal(prev, lunes, 4), unidadRacha: "sem." };
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
      traer(() => sb().from("influenza_metas").select("id,clues,metas").eq("anio_campana", camp.nombre).not("clues", "is", null).order("id"))
    ]);
    const rubros = typeof INFLUENZA_RUBROS !== "undefined" ? INFLUENZA_RUBROS : [];
    const lunes = CI.lunesDe(data.fIniStr);
    return { an: CI.analizarInf(caps, metas, camp, data.fIniStr, hoyLocal(), rubros), racha: CI.rachaSemanal(caps.filter((r) => r.fecha < lunes), lunes, 4), unidadRacha: "sem." };
  }

  /** COVID-19: los reportes llevan las dosis por marca y por grupo; se pasan a dosis por grupo (c1..c6) para reusar el análisis de Influenza. */
  async function cargarCov(data) {
    const gac = root.getActiveCampaign || (typeof getActiveCampaign === "function" ? getActiveCampaign : null);
    const camp = gac ? ((await gac()).data || null) : null;
    const rubros = (root.CovidFrascos && root.CovidFrascos.RUBROS) || [];
    if (!camp) return { an: CI.analizarInf([], [], null, data.fIniStr, hoyLocal(), rubros), racha: null };
    const [caps, metas] = await Promise.all([
      traer(() => sb().from("covid_capturas").select("id,clues,fecha,valores,updated_at,sin_movimiento,editado_por").eq("anio_campana", camp.nombre).order("id")),
      traer(() => sb().from("covid_metas").select("id,clues,metas").eq("anio_campana", camp.nombre).not("clues", "is", null).order("id"))
    ]);
    const planas = caps.map((r) => ({ ...r, valores: root.CovidCaptura ? root.CovidCaptura.porRubro(r.valores) : {} }));
    const lunes = CI.lunesDe(data.fIniStr);
    return { an: CI.analizarInf(planas, metas, camp, data.fIniStr, hoyLocal(), rubros), racha: CI.rachaSemanal(planas.filter((r) => r.fecha < lunes), lunes, 4), unidadRacha: "sem." };
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

  /** Fichas de alerta bajo el nombre de la unidad: solo lo que pide acción; lo demás está en la Vista en vivo. */
  function rowHtml(r, estado) {
    const clues = String(r.clues || "").toUpperCase();
    const f = [];
    const u = S.an && S.an.unidades.get(clues);
    if (estado === "cap" && u) {
      if (S.tipo === "SR") {
        if (u.enCero) f.push(ficha("rojo", "inventory_2", u.ceros.length ? `en cero: ${u.ceros.slice(0, 2).join(", ")}${u.ceros.length > 2 ? " +" + (u.ceros.length - 2) : ""}` : "capturó en cero"));
        if (u.caducados.lotes) f.push(ficha("rojo", "event_busy", `${u.caducados.lotes} caducado${u.caducados.lotes === 1 ? "" : "s"}`));
        else if (u.cad.lotes) f.push(ficha("ambar", "hourglass_bottom", `${u.cad.lotes} caduca${u.cad.lotes === 1 ? "" : "n"} ≤3 m`));
        if (u.abiertos.vencidos) f.push(ficha("rojo", "timer", `${u.abiertos.vencidos} abierto${u.abiertos.vencidos === 1 ? "" : "s"} vencido${u.abiertos.vencidos === 1 ? "" : "s"}`));
      } else if (S.tipo === "CONS") {
        if (u.insuficiente) f.push(ficha("rojo", "syringe", `insumos para ${Math.round(u.cobertura * 100)} % de sus dosis`));
        else if (u.ceros.length) f.push(ficha("ambar", "inventory_2", `sin ${u.ceros.map((c) => c.replace("Jeringa ", "jer. ").toLowerCase()).join(", ")}`));
      } else if (S.tipo === "BIO") {
        if (u.alertas.length) f.push(ficha("ambar", "rule", `${u.alertas.length} por revisar`));
        if (u.fueraVentana) f.push(ficha("ambar", "event_busy", "fuera de ventana"));
      } else if (S.tipo === "INF") {
        if (u.avance != null) f.push(ficha(u.bajoRitmo ? "ambar" : "gris", "trending_up", `${u.avance} % de su meta`));
        else f.push(ficha("ambar", "flag", "sin meta"));
      }
    } else if (estado === "fal" && S.racha) {
      const n = S.racha(clues);
      const mes = S.unidadRacha === "mes";
      if (n >= 1) {
        const tope = mes ? 3 : 4;
        const unidad = mes ? (n === 1 ? "mes" : "meses") : (n === 1 ? "semana" : "semanas");
        f.push(ficha(n >= 2 ? "rojo" : "ambar", "history", `${n >= tope ? n + "+" : n} ${unidad} sin capturar`));
      }
    }
    return f.length ? `<div class="ci-fichas">${f.join("")}</div>` : "";
  }

  /* ───────────────────────────── pintado del panel ───────────────────────────── */
  function contenedor() { return document.getElementById("captureInsights"); }

  function barraHtml() {
    const m = CI.avancePorMunicipio(S.data.capturadas, S.data.faltantes);
    const f = S.filtro;
    const cap = (S.data.capturadas || []).length, tot = cap + (S.data.faltantes || []).length;
    const chips = [`<button type="button" class="ci-chip" data-ci="muni" data-v="" aria-pressed="${!f.muni}">Todos<small>${cap}/${tot}</small></button>`]
      .concat(m.map((x) => `<button type="button" class="ci-chip" data-ci="muni" data-v="${esc(x.k)}" aria-pressed="${f.muni === x.k}">${esc(x.etiqueta)}<small>${x.cap}/${x.total}</small></button>`));
    return `<div class="ci-bar" role="search">
      <div class="ci-search">${ICO("search")}<input id="ciBuscar" class="ci-input" type="search" placeholder="Buscar unidad o CLUES" aria-label="Buscar en las tablas por unidad, CLUES o municipio" value="${esc(f.texto)}" autocomplete="off"></div>
      <div class="ci-chips" role="group" aria-label="Filtrar por municipio">${chips.join("")}</div>
      <div class="ci-acts">
        <button type="button" class="ci-ib" data-ci="copiar" aria-label="Copiar resumen para WhatsApp" title="Copiar resumen para WhatsApp">${ICO("content_copy")}</button>
        <button type="button" class="ci-ib" data-ci="csv" aria-label="Descargar tabla por unidad en CSV (abre en Excel)" title="Descargar tabla por unidad (CSV)">${ICO("download")}</button>
      </div></div>
      ${f.set ? `<div class="ci-active" role="status"><span class="t">Mostrando solo: <strong>${esc(f.etiqueta)}</strong></span><button type="button" data-ci="quitar">${ICO("close")}Quitar</button></div>` : ""}`;
  }

  function tileHtml(t) {
    const activo = S.filtro.set && S.filtro.etiqueta === t.etiquetaFiltro;
    const cuerpo = `<span class="ci-ico">${ICO(t.icono)}</span><span class="ci-val">${esc(t.valor)}</span><span class="ci-txt"><span class="ci-etq">${esc(t.etiqueta)}</span><span class="ci-nota" title="${esc(t.nota || "")}">${esc(t.nota || "")}</span></span>`;
    if (!t.set) return `<div class="ci-tile ci-t-${t.tono}">${cuerpo}</div>`;
    return `<button type="button" class="ci-tile ci-t-${t.tono}" data-ci="tile" data-id="${esc(t.id)}" aria-pressed="${!!activo}" title="Ver solo estas unidades en las tablas">${cuerpo}</button>`;
  }

  function render() {
    const c = contenedor();
    if (!c || !S.data) return;
    const previo = document.activeElement && document.activeElement.id === "ciBuscar" ? document.getElementById("ciBuscar").selectionStart : null;
    let html = barraHtml();
    if (S.resumen) html += `<div class="ci-tiles">${S.resumen.tiles.map(tileHtml).join("")}</div>`;
    else if (S.error) html += `<div class="ci-load" role="status">No se pudieron calcular los indicadores (${esc(S.error)}). Las tablas siguen funcionando.</div>`;
    else html += `<div class="ci-load" role="status">Calculando indicadores…</div>`;
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
      else if (a === "tile") { const t = S.resumen && S.resumen.tiles.find((x) => x.id === b.dataset.id); if (t) aplicarFiltro(t.set, t.etiquetaFiltro); }
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
    const esCov = tipo === "INF" && data.vacuna === "COVID";
    const key = `${tipo}${esCov ? ":COVID" : ""}|${data.fecha}|${w}|${(data.capturadas || []).length}|${(data.faltantes || []).length}`;
    const mismoPeriodo = S.tipo === tipo && S.key && S.key.split("|").slice(0, 3).join("|") === key.split("|").slice(0, 3).join("|");
    S.key = key; S.tipo = tipo; S.data = data; S.ctx = ctx || {};
    if (!mismoPeriodo) S.filtro = { muni: null, texto: "", set: null, etiqueta: "" };
    S.muniDe = new Map(); S.nombreDe = new Map();
    [...(data.capturadas || []), ...(data.faltantes || [])].forEach((r) => { const k = String(r.clues || "").toUpperCase(); S.muniDe.set(k, CI.muniKey(r.municipio)); S.nombreDe.set(k, r.unidad || k); });
    if (!mismoPeriodo) { S.an = null; S.resumen = null; S.racha = null; }
    S.error = null;
    render();
    try {
      const cargar = esCov ? cargarCov : { SR: cargarSR, CONS: cargarCons, BIO: cargarBio, INF: cargarInf }[tipo];
      if (!cargar) return;
      const r = await cargar(data);
      if (S.key !== key) return; // llegó otra consulta mientras tanto
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
    box.innerHTML = k.map((t) => `<div class="ci-tile ci-t-${t.tono}"><span class="ci-ico">${ICO(t.icono)}</span><span class="ci-val">${t.valor}</span><span class="ci-txt"><span class="ci-etq">${esc(t.etiqueta)}</span><span class="ci-nota">${esc(t.nota || "")}</span></span></div>`).join("");
    box.style.display = "grid";
  }

  Object.assign(CI, { attach, filterLists, rowHtml, renderVivo, _estado: S });
})(typeof window !== "undefined" ? window : globalThis);
