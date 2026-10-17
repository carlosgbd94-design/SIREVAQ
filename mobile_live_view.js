/* ============================================================================
   Móvil · Live View de una unidad (supervisión).
   Equivalente al «Inspeccionar inventario en vivo» del escritorio: al tocar una unidad del Resumen
   se abre una hoja con lo que la unidad capturó en el periodo elegido.
     · Biológicos (SR): existencia por lote, caducidad, vigencia y unidades sin existencia (desabasto).
     · Consumibles (CONS): dosis de SRP/SR, jeringas y aguja.
     · Pedido (BIO): existencia, pedido, promedio y mín/máx por biológico.
   Mismas tablas y reglas que adminGetUnitDetail (main.js). Solo lectura.
   ============================================================================ */
(function (global) {
  "use strict";

  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const TITULO = { SR: "Biológicos", CONS: "Consumibles", BIO: "Pedido", INF: "Influenza" };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => Number(v || 0);
  const nf = (v) => num(v).toLocaleString("es-MX");

  let P = null;        // parámetros de la unidad abierta
  let D = null;        // datos cargados { fecha, filas, ... }
  let filtro = "todos";
  let opener = null;
  let guardaTeclado = null;

  const cliente = () => global.MobileSupervision && global.MobileSupervision.api.cfg().getClient();

  // ── Fechas y vigencia (misma regla que getSemaforoStatus del escritorio) ──
  function mmmaa(iso) {
    const p = String(iso || "").split("-");
    if (p.length < 2) return iso || "—";
    return `${MESES[parseInt(p[1], 10) - 1] || "—"}-${String(p[0]).slice(2)}`;
  }
  function mesesHasta(iso) {
    const p = String(iso || "").split("-");
    if (p.length < 2) return 99;
    const hoy = new Date();
    return (parseInt(p[0], 10) - hoy.getFullYear()) * 12 + (parseInt(p[1], 10) - 1 - hoy.getMonth());
  }
  function vigencia(iso) {
    const d = mesesHasta(iso);
    if (d < 0) return { k: "mal", t: "Expirado" };
    if (d <= 3) return { k: "mal", t: "Cad. próxima" };
    if (d <= 6) return { k: "reg", t: "Cad. media" };
    return { k: "ok", t: "Vigente" };
  }
  const fechaLarga = (iso) => {
    const p = String(iso || "").split("-");
    if (p.length < 3) return iso || "";
    return `${parseInt(p[2], 10)} ${MESES[parseInt(p[1], 10) - 1].toLowerCase()} ${p[0]}`;
  };

  // ── Datos ──
  async function cargar() {
    const db = cliente();
    if (!db) throw new Error("Sesión no disponible");
    if (P.tipo === "SR") {
      const { data, error } = await db.from("existencia_detalle").select("*").eq("clues", P.clues)
        .gte("fecha", P.ini).lte("fecha", P.fin).order("fecha", { ascending: false });
      if (error) throw error;
      let filas = [], fecha = null;
      if (data && data.length) {
        fecha = data[0].fecha;
        filas = data.filter((r) => r.fecha === fecha);
        // Biológicos que estaban en la captura anterior y ya no vienen: se muestran en 0 (desabasto)
        const { data: prev } = await db.from("existencia_detalle").select("*").eq("clues", P.clues)
          .lt("fecha", fecha).order("fecha", { ascending: false });
        if (prev && prev.length) {
          const fPrev = prev[0].fecha;
          const hay = new Set(filas.map((r) => String(r.biologico || "").trim().toUpperCase()));
          prev.filter((r) => r.fecha === fPrev).forEach((r) => {
            const n = String(r.biologico || "").trim().toUpperCase();
            if (n && !hay.has(n)) { hay.add(n); filas.push({ biologico: r.biologico, lote: r.lote, cantidad: 0, caducidad: r.caducidad, fecha, is_desabasto: true, capturado_por: filas[0] && filas[0].capturado_por }); }
          });
        }
        // Renglones históricos en 0 de un lote que sí tiene existencia: no se muestran
        const conStock = new Set(filas.filter((r) => num(r.cantidad) > 0).map((r) => `${String(r.biologico || "").trim().toUpperCase()}:${String(r.lote || "").trim().toUpperCase()}`));
        filas = filas.filter((r) => !(num(r.cantidad) === 0 && conStock.has(`${String(r.biologico || "").trim().toUpperCase()}:${String(r.lote || "").trim().toUpperCase()}`)));
        filas.sort((a, b) => String(a.biologico || "").localeCompare(String(b.biologico || ""), "es") || String(a.lote || "").localeCompare(String(b.lote || ""), "es"));
      }
      return { fecha, filas };
    }
    if (P.tipo === "BIO") {
      const { data, error } = await db.from("biologicos_pedido").select("*").eq("clues", P.clues)
        .gte("fecha_pedido_programada", P.ini).lte("fecha_pedido_programada", P.fin).order("fecha_pedido_programada", { ascending: false });
      if (error) throw error;
      let filas = [], fecha = null;
      if (data && data.length) {
        fecha = data[0].fecha_pedido_programada;
        filas = data.filter((r) => r.fecha_pedido_programada === fecha).sort((a, b) => String(a.biologico || "").localeCompare(String(b.biologico || ""), "es"));
      }
      return { fecha, filas };
    }
    if (P.tipo === "INF") {
      const { data, error } = await db.from("influenza_capturas").select("*").eq("clues", P.clues).eq("fecha", P.fecha).eq("anio_campana", P.campana || "").limit(1);
      if (error) throw error;
      return { fecha: data && data.length ? data[0].fecha : null, filas: data || [] };
    }
    const { data, error } = await db.from("consumibles").select("*").eq("clues", P.clues)
      .gte("fecha", P.ini).lte("fecha", P.fin).order("fecha", { ascending: false }).limit(1);
    if (error) throw error;
    return { fecha: data && data.length ? data[0].fecha : null, filas: data || [] };
  }

  // ── Pantalla ──
  function cuerpoSR() {
    const filas = D.filas;
    if (!filas.length) return `<p class="lv-vacio">No hay registros de existencia en este periodo.</p>`;
    const stats = { sin: 0, prox: 0 };
    filas.forEach((r) => { if (num(r.cantidad) === 0) stats.sin++; const v = vigencia(r.caducidad); if (num(r.cantidad) > 0 && (v.t === "Cad. próxima" || v.t === "Expirado")) stats.prox++; });
    const visibles = filas.filter((r) => {
      if (filtro === "sin") return num(r.cantidad) === 0;
      if (filtro === "prox") { const v = vigencia(r.caducidad); return num(r.cantidad) > 0 && (v.t === "Cad. próxima" || v.t === "Expirado"); }
      return true;
    });
    const chips = [["todos", `Todos ${filas.length}`], ["sin", `Sin existencia ${stats.sin}`], ["prox", `Cad. próxima ${stats.prox}`]]
      .map(([k, t]) => `<button type="button" class="sv-chip sv-chip--sm${filtro === k ? " activo" : ""}" data-lvf="${k}" aria-pressed="${filtro === k}">${esc(t)}</button>`).join("");
    const tipoTag = (r) => (r.tipo === "PRESTAMO_DESABASTO" || r.tipo === "Préstamo por desabasto") ? `<span class="lv-tag lv-tag--reg">Préstamo por desabasto</span>`
      : (r.tipo === "PRESTAMO_ARF" || r.tipo === "Préstamo por ARF") ? `<span class="lv-tag lv-tag--ok">Préstamo por ARF</span>` : "";
    const lista = visibles.length ? `<ul class="lv-lista">${visibles.map((r) => {
      const sin = num(r.cantidad) === 0;
      const v = vigencia(r.caducidad);
      return `<li class="lv-item">
        <div class="lv-item-cab"><b>${esc(r.biologico || "—")}</b><span class="lv-num${sin ? " lv-num--cero" : ""}" aria-label="Existencia ${nf(r.cantidad)}">${nf(r.cantidad)}</span></div>
        <div class="lv-item-pie"><span>Lote ${esc(r.lote || "—")}</span><span>Cad. ${esc(mmmaa(r.caducidad))}</span>
          ${sin ? `<span class="sv-pill sv-pill--mal">Sin existencia</span>` : `<span class="sv-pill sv-pill--${v.k}">${v.t}</span>`}${tipoTag(r)}</div></li>`;
    }).join("")}</ul>` : `<p class="lv-vacio">Ningún lote con ese criterio.</p>`;
    return `<div class="sv-chips sv-chips--scroll" role="group" aria-label="Filtrar lotes">${chips}</div>${lista}`;
  }

  function cuerpoINF() {
    if (!D.filas.length) return `<p class="lv-vacio">La unidad no tiene reporte de Influenza en esta semana.</p>`;
    const r = D.filas[0];
    const vals = r.valores || {};
    const rubros = global.INFLUENZA_RUBROS_MOVIL || [];
    const total = rubros.reduce((t, x) => t + num(vals[x.id]), 0);
    const grupos = {};
    rubros.forEach((x) => { if (num(vals[x.id]) > 0) { const k = `${x.categoria} · ${x.grupo}`; (grupos[k] = grupos[k] || []).push(x); } });
    const ceros = rubros.filter((x) => num(vals[x.id]) === 0).length;
    const lista = Object.keys(grupos).map((k) => `<li class="lv-item"><div class="lv-item-cab"><b>${esc(k)}</b><span class="lv-num">${nf(grupos[k].reduce((t, x) => t + num(vals[x.id]), 0))}</span></div>
      <ul class="lv-sub">${grupos[k].map((x) => `<li><span>${esc(x.edad)}</span><b>${nf(vals[x.id])}</b></li>`).join("")}</ul></li>`).join("");
    return `<div class="lv-item lv-item--fila"><b>Dosis aplicadas en la semana</b><span class="lv-num">${nf(total)}</span></div>
      ${r.sin_movimiento ? `<p class="lv-vacio">La unidad reportó «Sin movimiento» esta semana.</p>` : ""}
      ${lista ? `<ul class="lv-lista">${lista}</ul>` : ""}
      ${ceros ? `<p class="lv-vacio">${ceros} rubros en 0.</p>` : ""}`;
  }

  function cuerpoCONS() {
    if (!D.filas.length) return `<p class="lv-vacio">No hay reporte de consumibles en este periodo.</p>`;
    const c = D.filas[0];
    const rows = [["Existencia SRP (dosis)", c.srp_dosis], ["Existencia SR (dosis)", c.sr_dosis], ["Jeringa de 5 ml", c.jeringa_reconst_5ml_0605500438],
      ["Jeringa de 0.5 ml", c.jeringa_aplic_05ml_0605502657], ["Aguja", c.aguja_0600403711]];
    return `<ul class="lv-lista">${rows.map(([t, v]) => `<li class="lv-item lv-item--fila"><b>${esc(t)}</b><span class="lv-num${num(v) === 0 ? " lv-num--cero" : ""}">${nf(v)}</span></li>`).join("")}</ul>`;
  }

  function cuerpoBIO() {
    if (!D.filas.length) return `<p class="lv-vacio">No hay pedido de biológicos en este periodo.</p>`;
    return `<ul class="lv-lista">${D.filas.map((r) => {
      const ex = r.existencia_actual_frascos ?? r.existencia ?? 0, pe = r.pedido_frascos ?? r.solicitud ?? 0;
      return `<li class="lv-item"><div class="lv-item-cab"><b>${esc(r.biologico || "—")}</b></div>
        <dl class="lv-datos"><div><dt>Existencia</dt><dd>${nf(ex)}</dd></div><div><dt>Pedido</dt><dd>${nf(pe)}</dd></div>
        <div><dt>Prom. mensual</dt><dd>${nf(r.promedio_frascos)}</dd></div><div><dt>Mín / Máx (dosis)</dt><dd>${nf(r.min_dosis)} / ${nf(r.max_dosis)}</dd></div></dl></li>`;
    }).join("")}</ul>`;
  }

  function pintar(estado) {
    const ov = document.getElementById("lvOverlay");
    if (!ov) return;
    const cab = ov.querySelector("#lvSub");
    const cuerpo = ov.querySelector("#lvCuerpo");
    ov.querySelector("#lvTitulo").textContent = `${TITULO[P.tipo]} · ${P.unidad}`;
    let sub = `${esc(P.municipio || "")} · ${esc(P.clues)}`;
    if (D && D.fecha) sub += ` · Captura del ${esc(fechaLarga(D.fecha))}`;
    const capt = D && D.filas && D.filas[0] && (D.filas[0].capturado_por || D.filas[0].usuario);
    cab.innerHTML = `${sub}${capt ? `<br><span class="lv-quien">Capturó: ${esc(capt)}${D.filas[0].editado_por ? ` · Editado por ${esc(D.filas[0].editado_por)}` : ""}</span>` : ""}<br><span class="lv-quien">${esc(P.etiqueta || "")}</span>`;
    if (estado === "cargando") cuerpo.innerHTML = `<p class="lv-vacio" role="status">Cargando…</p>`;
    else if (estado && estado.error) cuerpo.innerHTML = `<p class="lv-vacio" role="alert">${esc(estado.error)}</p><button type="button" class="sv-btn" id="lvReintentar">Reintentar</button>`;
    else {
      cuerpo.innerHTML = P.tipo === "SR" ? cuerpoSR() : P.tipo === "BIO" ? cuerpoBIO() : P.tipo === "INF" ? cuerpoINF() : cuerpoCONS();
      cuerpo.querySelectorAll("[data-lvf]").forEach((b) => { b.onclick = () => { filtro = b.dataset.lvf; pintar(); }; });
    }
    const re = ov.querySelector("#lvReintentar");
    if (re) re.onclick = refrescar;
  }

  async function refrescar() {
    if (!P) return;
    pintar("cargando");
    try { D = await cargar(); pintar(); }
    catch (e) { pintar({ error: "No se pudo cargar: " + (e.message || e) }); }
  }

  function cerrar() {
    const ov = document.getElementById("lvOverlay");
    if (ov) ov.remove();
    document.body.classList.remove("lv-abierto");
    document.removeEventListener("keydown", guardaTeclado, true);
    guardaTeclado = null;
    P = null; D = null;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function abrir(p) {
    if (!p || !p.clues) return;
    if (document.getElementById("lvOverlay")) cerrar();
    P = p; D = null; filtro = "todos";
    opener = document.activeElement;
    const ov = document.createElement("div");
    ov.id = "lvOverlay";
    ov.className = "lv-overlay";
    ov.innerHTML = `<section class="lv-hoja" role="dialog" aria-modal="true" aria-labelledby="lvTitulo" tabindex="-1">
      <div class="lv-cab">
        <div class="lv-cab-txt"><h2 id="lvTitulo"></h2><p id="lvSub"></p></div>
        <button type="button" class="lv-ic" id="lvRefrescar" aria-label="Actualizar"><span class="material-symbols-rounded" aria-hidden="true">refresh</span></button>
        <button type="button" class="lv-ic" id="lvCerrar" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
      </div>
      <div class="lv-cuerpo" id="lvCuerpo" tabindex="0" role="region" aria-label="Detalle de la unidad" aria-live="polite"></div>
    </section>`;
    document.body.appendChild(ov);
    document.body.classList.add("lv-abierto");
    ov.addEventListener("click", (e) => { if (e.target === ov) cerrar(); });
    ov.querySelector("#lvCerrar").onclick = cerrar;
    ov.querySelector("#lvRefrescar").onclick = refrescar;
    guardaTeclado = (e) => {
      if (e.key === "Escape") { cerrar(); e.preventDefault(); e.stopPropagation(); return; }
      if (e.key !== "Tab") return;
      const f = Array.from(ov.querySelectorAll("button, [tabindex]:not([tabindex='-1'])")).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !ov.contains(document.activeElement))) { z.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); }
    };
    document.addEventListener("keydown", guardaTeclado, true);
    pintar("cargando");
    ov.querySelector("#lvCerrar").focus();
    refrescar();
  }

  global.MobileLiveView = { abrir, cerrar, _util: { vigencia, mmmaa, mesesHasta } };
})(typeof window !== "undefined" ? window : globalThis);
