/* ============================================================================
   Móvil · Indicadores RDA completos (reemplaza la vista básica de mobile_supervision.js).
   Esquemas: Básico, Adolescentes y adultos, Adultos mayores, Embarazadas, Temporada invernal,
   Biológicos adicionales, Deserción de esquema, Comparativa multianual y Meta-logro Influenza.
   Mismas RPC y fórmulas que rda_ui.js / influenza_module.js, en tarjetas y listas para el celular.
   ============================================================================ */
(function (global) {
  "use strict";
  const SV = global.MobileSupervision;
  if (!SV || !SV.registrar) return;
  const A = SV.api;
  const { esc, norm } = A;
  const db = () => A.cfg().getClient();

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const nf = (n) => Math.round(Number(n || 0)).toLocaleString("es-MX");
  const f1 = (n) => (Math.round(Number(n || 0) * 10) / 10).toFixed(1);

  const ESQUEMAS = [
    { id: "basico", label: "Básico" },
    { id: "adultos", label: "Adolescentes y adultos", kpis: [["Hepatitis B", "adol_hb"], ["SR", "adol_sr"], ["VPH", "adol_vph"], ["Td", "adol_td"], ["Tdpa", "adol_tdpa"]] },
    { id: "mayores", label: "Adultos mayores", kpis: [["Neumo 13", "am_neumo13"], ["Neumo 20", "am_neumo20"], ["Td mayores", "am_td"]] },
    { id: "embarazadas", label: "Embarazadas", kpis: [["Tdpa embarazadas", "emb_tdpa"], ["VSR embarazadas", "emb_vsr"]] },
    { id: "invernal", label: "Temporada invernal", kpis: [["Influenza", "inv_influenza"], ["COVID-19", "inv_covid"]] },
    { id: "adicionales", label: "Adicionales", kpis: [["Varicela", "varicela"], ["Hepatitis A", "hepatitis_a"]] },
    { id: "desercion", label: "Deserción" },
    { id: "comparativa", label: "Comparativa" },
    { id: "influenza", label: "Meta Influenza" }
  ];
  const CADENAS = [
    { label: "Hexavalente", steps: [["hexa_1", "Dosis 1"], ["hexa_2", "Dosis 2"], ["hexa_3", "Dosis 3"], ["hexa_ref", "Refuerzo"]] },
    { label: "Neumococo 13", steps: [["neumo_1", "Dosis 1"], ["neumo_2", "Dosis 2"], ["neumo_ref", "Refuerzo"]] },
    { label: "Neumococo 20", steps: [["neumo_c1", "Dosis 1"], ["neumo_c2", "Dosis 2"], ["neumo_c3", "Dosis 3"]] },
    { label: "Rotavirus", steps: [["rota_1", "Dosis 1"], ["rota_2", "Dosis 2"]] },
    { label: "SRP", steps: [["srp_1", "Dosis 1"], ["srp_2", "Dosis 2"]] }
  ];

  const estadoCob = (v) => (v >= 95 ? "ok" : v >= 75 ? "reg" : "mal");
  const textoEstado = { ok: "Óptimo", reg: "Regular", mal: "Crítico" };

  function suma(filas, k) { return filas.reduce((t, u) => t + (Number(u[k]) || 0), 0); }

  // Misma fórmula que rda_ui.js: dosis / divisor / (población × 0.0833 × meses).
  function cobertura(filas, maxMes) {
    const pob1 = suma(filas, "pob_menor_1"), pob2 = suma(filas, "pob_1_ano"), pob4 = suma(filas, "pob_4_anos");
    const d1 = suma(filas, "bcg_dosis") + suma(filas, "hepb_0_7_dosis") + suma(filas, "hexa_3_dosis") + suma(filas, "rota_2_dosis") + suma(filas, "neumo_2_dosis");
    const d2 = suma(filas, "hexa_ref_dosis") + suma(filas, "neumo_ref_dosis") + suma(filas, "srp_2_dosis");
    const d4 = suma(filas, "dpt_4_dosis");
    const cob = (dosis, div, pob) => { const f = pob * 0.0833 * maxMes; return f > 0 ? Math.round((dosis / div / f) * 1000) / 10 : 0; };
    return { pob1, pob2, pob4, d1, d2, d4, c1: cob(d1, 4, pob1), c2: cob(d2, 3, pob2), c4: cob(d4, 1, pob4) };
  }

  const S = { filas: null, esquema: "basico", muni: "", destInf: null, cargando: false, error: null, anio: 0, maxMes: 0,
              sinRda: [], extra: {} };
  // En Meta-logro de Influenza los hospitales (HENM y NHG) son destinos propios, igual que en escritorio:
  // no cuentan dentro de Querétaro.
  const HOSPITALES = { QTSSA001740: "HENM", QTSSA002901: "NHG" };
  const destinoDe = (u) => HOSPITALES[u.clues] || String(u.municipio || "").toUpperCase().trim();
  const claveDest = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/^EL\s+/, "");

  const cargandoHtml = (t) => `<div class="sv-cargando" role="status" aria-live="polite"><div class="sv-indet" aria-hidden="true"><i></i></div><p>${esc(t)}</p><small>Puede tardar unos segundos.</small></div>`;

  async function cargarBase() {
    const d = db();
    const hoy = new Date();
    S.anio = hoy.getFullYear();
    const { data: mm, error: e1 } = await d.rpc("get_rda_max_mes", { p_anio: S.anio });
    if (e1) throw e1;
    let maxMes = parseInt(mm, 10);
    if (isNaN(maxMes) || maxMes < 1) maxMes = 1;
    if (maxMes > hoy.getMonth() + 1) maxMes = hoy.getMonth() + 1;
    S.maxMes = maxMes;
    const { data, error } = await d.rpc("get_rda_indicators", { p_anio: S.anio, p_max_mes: maxMes });
    if (error) throw error;
    S.filas = (data || []).map((u) => ({ ...u, unidad: u.unidad || u.nombre })).filter(A.enAlcance);
    S.sinRda = [];
    try {
      const { data: us } = await d.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
      const con = new Set(S.filas.map((u) => String(u.clues || "").trim().toUpperCase()));
      S.sinRda = (us || []).filter(A.enAlcance).filter((u) => !con.has(String(u.clues || "").trim().toUpperCase()));
    } catch (e) { /* informativo */ }
  }

  async function pagina(armar) {
    let todo = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await armar().range(desde, desde + 999);
      if (error) throw error;
      if (!data || !data.length) break;
      todo = todo.concat(data);
      if (data.length < 1000) break;
    }
    return todo;
  }

  const enMuni = (u) => !S.muni || String(u.municipio || "").toUpperCase().trim() === S.muni;

  // ── Pantalla ──
  async function abrir(root) {
    S.root = root;
    if (!S.filas) {
      S.cargando = true; S.error = null; pintar();
      try { await cargarBase(); S.error = null; } catch (e) { S.error = "No se pudieron cargar los indicadores: " + (e.message || e); }
      S.cargando = false;
    }
    pintar();
    if (S.filas && !S.cargando) cargarEsquema(S.esquema, true);
  }

  async function cargarEsquema(id, silencioso) {
    if (S.extra[id] && (S.extra[id].ok || S.extra[id].cargando)) return;
    if (!["desercion", "comparativa", "influenza"].includes(id)) return;
    S.extra[id] = { cargando: true };
    if (!silencioso) pintar();
    try {
      if (id === "desercion") {
        const { data, error } = await db().rpc("get_rda_abandono_esquema", { p_anio: S.anio, p_max_mes: S.maxMes });
        if (error) throw error;
        S.extra[id] = { ok: true, filas: (data || []).filter((r) => A.enAlcance({ unidad: r.nombre || r.unidad, municipio: r.municipio })) };
      } else if (id === "comparativa") {
        const d = db();
        const [a, b] = await Promise.all([
          d.rpc("get_rda_indicators", { p_anio: S.anio - 1, p_max_mes: 12 }),
          d.rpc("get_rda_indicators", { p_anio: S.anio, p_max_mes: S.maxMes })
        ]);
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        const f = (rows) => (rows || []).map((u) => ({ ...u, unidad: u.unidad || u.nombre })).filter(A.enAlcance);
        S.extra[id] = { ok: true, previo: f(a.data), actual: f(b.data) };
      } else if (id === "influenza") {
        S.extra[id] = { ok: true, ...(await cargarInfluenza()) };
      }
    } catch (e) {
      S.extra[id] = { error: "No se pudo cargar: " + (e.message || e) };
    }
    pintar();
  }

  async function cargarInfluenza() {
    const d = db();
    const { data: camps, error: e1 } = await d.from("campanas").select("*").ilike("nombre", "Campaña Influenza%").order("fecha_inicio", { ascending: false });
    if (e1) throw e1;
    const camp = (camps || []).find((c) => c.activo) || (camps || [])[0];
    if (!camp) throw new Error("No hay una campaña de Influenza configurada.");
    const { data: us, error: e2 } = await d.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
    if (e2) throw e2;
    const unidades = (us || []).filter(A.enAlcance);
    const [metas, caps] = await Promise.all([
      pagina(() => d.from("influenza_metas").select("*").eq("anio_campana", camp.nombre).order("clues")),
      pagina(() => d.from("influenza_capturas").select("clues, fecha, valores").eq("anio_campana", camp.nombre).order("clues").order("fecha"))
    ]);
    return { camp, unidades, metas, caps };
  }

  function pintar() {
    const root = S.root;
    if (!root) return;
    let cuerpo;
    if (S.cargando) cuerpo = cargandoHtml("Calculando indicadores…");
    else if (S.error) cuerpo = `<p class="sv-vacio" role="alert">${esc(S.error)}</p><button type="button" class="sv-btn" id="svRdaRe">Reintentar</button>`;
    else cuerpo = cuerpoEsquema();
    const chips = ESQUEMAS.map((e) => `<button type="button" class="sv-chip sv-chip--sm${e.id === S.esquema ? " activo" : ""}" data-esq="${e.id}" aria-pressed="${e.id === S.esquema}">${esc(e.label)}</button>`).join("");
    root.innerHTML = A.encabezadoSub("Indicadores RDA") + `<div class="sv-chips sv-chips--scroll" role="group" aria-label="Esquema">${chips}</div>` + cuerpo;
    A.enlazarVolver(root);
    root.querySelectorAll("[data-esq]").forEach((b) => { b.onclick = () => { S.esquema = b.dataset.esq; pintar(); cargarEsquema(S.esquema, false); }; });
    root.querySelectorAll("[data-muni]").forEach((b) => { b.onclick = () => { S.muni = b.dataset.muni; pintar(); }; });
    root.querySelectorAll("[data-dest]").forEach((b) => { b.onclick = () => { S.destInf = b.dataset.dest; pintar(); }; });
    const re = root.querySelector("#svRdaRe");
    if (re) re.onclick = () => { S.filas = null; S.extra = {}; abrir(root); };
    const reX = root.querySelector("#svRdaReX");
    if (reX) reX.onclick = () => { delete S.extra[S.esquema]; cargarEsquema(S.esquema, false); };
  }

  function chipsMunicipio() {
    const munis = [...new Set(S.filas.map((u) => String(u.municipio || "").toUpperCase().trim()).filter(Boolean))].sort();
    if (munis.length < 2) return "";
    return `<div class="sv-chips sv-chips--scroll" role="group" aria-label="Municipio">
      <button type="button" class="sv-chip sv-chip--sm${!S.muni ? " activo" : ""}" data-muni="" aria-pressed="${!S.muni}">Todos</button>
      ${munis.map((m) => `<button type="button" class="sv-chip sv-chip--sm${S.muni === m ? " activo" : ""}" data-muni="${esc(m)}" aria-pressed="${S.muni === m}">${esc(m)}</button>`).join("")}</div>`;
  }

  const corteHtml = () => `<p class="sv-corte"><span class="material-symbols-rounded" aria-hidden="true">event_available</span>Corte: ${MESES[S.maxMes - 1]} ${S.anio}</p>`;
  const notaSinRda = () => (S.sinRda.length ? `<p class="sv-nota">Sin registro en el RDA: ${S.sinRda.map((u) => esc(u.unidad)).join(", ")}.</p>` : "");

  function cuerpoEsquema() {
    const id = S.esquema;
    if (id === "basico") return htmlBasico();
    if (id === "desercion") return htmlDesercion();
    if (id === "comparativa") return htmlComparativa();
    if (id === "influenza") return htmlInfluenza();
    return htmlDosis(ESQUEMAS.find((e) => e.id === id));
  }

  function tarjeta(titulo, icono, cob, dosis, pob) {
    const st = estadoCob(cob);
    return `<div class="sv-kpi">
      <div class="sv-kpi-cab"><span class="material-symbols-rounded" aria-hidden="true">${icono}</span><b>${titulo}</b><span class="sv-pill sv-pill--${st}">${textoEstado[st]}</span></div>
      <div class="sv-kpi-val">${cob}<small>%</small></div>
      <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(cob))}" aria-label="${titulo}"><i class="sv-barra--${st}" style="width:${Math.min(100, cob)}%"></i></div>
      <small class="sv-kpi-sub">${nf(dosis)} dosis · Pob. ${nf(pob)}</small></div>`;
  }

  function htmlBasico() {
    const usadas = S.filas.filter(enMuni);
    const a = cobertura(usadas, S.maxMes);
    const ranking = usadas.map((u) => ({ u, a: cobertura([u], S.maxMes) })).sort((x, y) => x.a.c1 - y.a.c1 || String(x.u.unidad).localeCompare(String(y.u.unidad), "es"));
    return `${corteHtml()}${chipsMunicipio()}
      <div class="sv-kpis">${tarjeta("Menores de 1 año", "child_care", a.c1, a.d1, a.pob1)}${tarjeta("1 año", "face", a.c2, a.d2, a.pob2)}${tarjeta("4 años", "school", a.c4, a.d4, a.pob4)}</div>
      <p class="sv-sec">Por unidad · de menor a mayor avance</p>
      ${ranking.length ? `<ul class="sv-lista">${ranking.map((x) => `<li class="sv-unidad sv-unidad--rda">
        <div class="sv-u-txt"><b>${esc(x.u.unidad)}</b><small>${esc(x.u.municipio || "")}</small></div>
        <div class="sv-mini" role="img" aria-label="Cobertura: menores de 1 año ${x.a.c1}%, 1 año ${x.a.c2}%, 4 años ${x.a.c4}%">
          <span class="sv-mini-i sv-mini--${estadoCob(x.a.c1)}"><em>&lt;1</em>${Math.round(x.a.c1)}%</span>
          <span class="sv-mini-i sv-mini--${estadoCob(x.a.c2)}"><em>1</em>${Math.round(x.a.c2)}%</span>
          <span class="sv-mini-i sv-mini--${estadoCob(x.a.c4)}"><em>4</em>${Math.round(x.a.c4)}%</span></div></li>`).join("")}</ul>` : `<p class="sv-vacio">Sin unidades en tu alcance.</p>`}
      ${notaSinRda()}`;
  }

  // Esquemas por dosis aplicadas (adultos, mayores, embarazadas, invernal, adicionales): total y parte de cada vacuna.
  function htmlDosis(esq) {
    const usadas = S.filas.filter(enMuni);
    const totales = esq.kpis.map(([n, k]) => ({ n, k, v: suma(usadas, k) }));
    const total = totales.reduce((t, x) => t + x.v, 0);
    const ranking = usadas.map((u) => ({ u, t: esq.kpis.reduce((s, [, k]) => s + (Number(u[k]) || 0), 0) })).sort((a, b) => b.t - a.t);
    return `${corteHtml()}${chipsMunicipio()}
      <div class="sv-avance"><div class="sv-avance-cab"><div><b>${esc(esq.label)}</b><small>Dosis aplicadas acumuladas del año</small></div><span class="sv-pct">${nf(total)}</span></div></div>
      <div class="sv-kpis">${totales.map((x) => {
        const p = total > 0 ? Math.round((x.v / total) * 1000) / 10 : 0;
        return `<div class="sv-kpi"><div class="sv-kpi-cab"><b>${esc(x.n)}</b></div><div class="sv-kpi-val">${nf(x.v)}</div>
          <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}" aria-label="${esc(x.n)}"><i style="width:${p}%"></i></div>
          <small class="sv-kpi-sub">${p}% de las dosis de este esquema</small></div>`;
      }).join("")}</div>
      <p class="sv-sec">Por unidad · de mayor a menor</p>
      ${ranking.length ? `<ul class="sv-lista">${ranking.map((x) => `<li class="sv-unidad">
        <div class="sv-u-txt"><b>${esc(x.u.unidad)}</b><small>${esc(x.u.municipio || "")}</small></div><span class="sv-pill sv-pill--ok">${nf(x.t)}</span></li>`).join("")}</ul>`
        : `<p class="sv-vacio">Sin unidades en tu alcance.</p>`}
      ${notaSinRda()}`;
  }

  function estadoX(id) {
    const x = S.extra[id];
    if (!x || x.cargando) return cargandoHtml("Calculando…");
    if (x.error) return `<p class="sv-vacio" role="alert">${esc(x.error)}</p><button type="button" class="sv-btn" id="svRdaReX">Reintentar</button>`;
    return null;
  }

  function htmlDesercion() {
    const w = estadoX("desercion");
    if (w) return w;
    const filas = S.extra.desercion.filas.filter(enMuni);
    const cadenas = CADENAS.map((c) => ({ ...c, tot: c.steps.map(([k]) => suma(filas, k)) }));
    const peores = [];
    filas.forEach((r) => {
      let peor = null;
      CADENAS.forEach((c) => {
        for (let i = 1; i < c.steps.length; i++) {
          const prev = Number(r[c.steps[i - 1][0]]) || 0, cur = Number(r[c.steps[i][0]]) || 0;
          if (prev <= 0) continue;
          const caida = ((prev - cur) / prev) * 100;
          if (!peor || caida > peor.caida) peor = { cadena: c.label, de: c.steps[i - 1][1], a: c.steps[i][1], prev, cur, caida };
        }
      });
      if (peor && peor.caida > 0) peores.push({ unidad: r.nombre || r.unidad, municipio: r.municipio, ...peor });
    });
    peores.sort((a, b) => b.caida - a.caida);
    return `${corteHtml()}${chipsMunicipio()}
      <p class="sv-nota sv-nota--sup">Deserción: porcentaje que no continúa de una dosis a la siguiente (dosis N ÷ dosis anterior).</p>
      <div class="sv-kpis">${cadenas.map((c) => `<div class="sv-kpi"><div class="sv-kpi-cab"><b>${esc(c.label)}</b></div>
        <ul class="sv-cadena">${c.steps.map(([, et], i) => {
          const tot = c.tot[i], prev = i ? c.tot[i - 1] : null;
          const des = i && prev ? Math.max(0, 100 - (tot / prev) * 100) : null;
          const st = des === null ? "" : des <= 10 ? "ok" : des <= 25 ? "reg" : "mal";
          return `<li><span>${esc(et)}</span><b>${nf(tot)}</b>${des === null ? (i ? `<small>Sin previas</small>` : "") : `<span class="sv-pill sv-pill--${st}">${f1(des)}%</span>`}</li>`;
        }).join("")}</ul></div>`).join("")}</div>
      <p class="sv-sec">Mayor caída por unidad</p>
      ${peores.length ? `<ul class="sv-lista sv-lista--sep">${peores.slice(0, 15).map((p) => `<li class="sv-unidad">
        <div class="sv-u-txt"><b>${esc(p.unidad)}</b><small>${esc(p.cadena)} · ${esc(p.de)} ${nf(p.prev)} → ${esc(p.a)} ${nf(p.cur)}</small></div>
        <span class="sv-pill sv-pill--${p.caida <= 10 ? "ok" : p.caida <= 25 ? "reg" : "mal"}">${f1(p.caida)}%</span></li>`).join("")}</ul>
        ${peores.length > 15 ? `<p class="sv-nota">Se muestran 15 de ${peores.length}.</p>` : ""}` : `<p class="sv-vacio">Sin caídas registradas.</p>`}`;
  }

  function htmlComparativa() {
    const w = estadoX("comparativa");
    if (w) return w;
    const X = S.extra.comparativa;
    const prev = cobertura(X.previo.filter(enMuni), 12);
    const act = cobertura(X.actual.filter(enMuni), S.maxMes);
    const fila = (n, p, a, dp, da) => {
      const d = Math.round((a - p) * 10) / 10;
      return `<li class="sv-comp"><b>${esc(n)}</b>
        <div class="sv-comp-v"><span><small>${S.anio - 1} (año completo)</small>${f1(p)}%<em>${nf(dp)} dosis</em></span>
          <span><small>${S.anio} (a ${MESES[S.maxMes - 1].toLowerCase()})</small>${f1(a)}%<em>${nf(da)} dosis</em></span>
          <span class="sv-pill sv-pill--${d >= 0 ? "ok" : "mal"}">${d >= 0 ? "+" : ""}${f1(d)} pts</span></div></li>`;
    };
    return `${corteHtml()}${chipsMunicipio()}
      <p class="sv-nota sv-nota--sup">Esquema básico: año anterior completo contra lo acumulado de este año.</p>
      <ul class="sv-lista sv-lista--sep">${fila("Menores de 1 año", prev.c1, act.c1, prev.d1, act.d1)}${fila("1 año", prev.c2, act.c2, prev.d2, act.d2)}${fila("4 años", prev.c4, act.c4, prev.d4, act.d4)}</ul>`;
  }

  function htmlInfluenza() {
    const w = estadoX("influenza");
    if (w) return w;
    const X = S.extra.influenza;
    const rubros = global.INFLUENZA_RUBROS_MOVIL || [];
    const metas = {};
    X.metas.forEach((m) => { if (m.clues) metas[m.clues] = m.metas || {}; });
    const caps = {};
    X.caps.forEach((c) => { (caps[c.clues] = caps[c.clues] || []).push(c); });
    const ini = X.camp.fecha_inicio, fin = X.camp.fecha_fin;
    const hoy = new Date().toLocaleDateString("en-CA");
    const val = global.MobileInfluenzaVal && global.MobileInfluenzaVal._util;
    const semanas = val && val.generarSemanas ? val.generarSemanas(ini, fin).map((s) => s.fecha) : [];
    const vencidas = semanas.filter((f) => f <= hoy);
    const ultima = vencidas[vencidas.length - 1] || null;
    const t0 = Date.parse(ini + "T12:00:00"), t1 = Date.parse(fin + "T12:00:00"), tn = Date.parse(hoy + "T12:00:00");
    const esperado = t1 > t0 ? Math.max(0, Math.min(100, ((tn - t0) * 100) / (t1 - t0))) : 0;
    const destinos = [...new Set(X.unidades.map(destinoDe).filter(Boolean))].sort();
    // Por omisión (como en escritorio) el municipal ve su municipio sin los hospitales.
    if (S.destInf === null) {
      const rolActual = A.rol();
      S.destInf = rolActual === "MUNICIPAL" ? (destinos.find((d) => d !== "HENM" && d !== "NHG") || "") : "";
    }
    const sel = X.unidades.filter((u) => !S.destInf || claveDest(destinoDe(u)) === claveDest(S.destInf));
    const chipsDest = destinos.length > 1 ? `<div class="sv-chips sv-chips--scroll" role="group" aria-label="Destino">
      <button type="button" class="sv-chip sv-chip--sm${!S.destInf ? " activo" : ""}" data-dest="" aria-pressed="${!S.destInf}">Todos</button>
      ${destinos.map((d) => `<button type="button" class="sv-chip sv-chip--sm${claveDest(S.destInf) === claveDest(d) ? " activo" : ""}" data-dest="${esc(d)}" aria-pressed="${claveDest(S.destInf) === claveDest(d)}">${esc(d)}</button>`).join("")}</div>` : "";
    const filas = sel.map((u) => {
      const m = metas[u.clues] || {};
      const cs = caps[u.clues] || [];
      let meta = 0, apl = 0;
      rubros.forEach((r) => {
        meta += Number(m[r.id] || 0);
        apl += cs.reduce((s, c) => s + Number((c.valores || {})[r.id] || 0), 0);
      });
      return { u, meta, apl, nunca: cs.length === 0, reporto: !!ultima && cs.some((c) => c.fecha === ultima) };
    });
    const conMeta = filas.filter((f) => f.meta > 0);
    const meta = suma(filas, "meta"), apl = suma(filas, "apl");
    if (!meta) return `${chipsDest}<p class="sv-vacio">Este ámbito aún no tiene meta de Influenza.</p>`;
    const pct = (apl * 100) / meta;
    const diff = pct - esperado;
    const tono = diff >= -5 ? "ok" : diff >= -15 ? "reg" : "mal";
    const etiqueta = pct >= 100 ? "Meta alcanzada" : tono === "ok" ? "En ritmo" : tono === "reg" ? "Algo atrasado" : "Atrasado";
    const sinReporte = ultima ? conMeta.filter((f) => !f.reporto) : [];
    const ranking = conMeta.map((f) => ({ ...f, p: (f.apl * 100) / f.meta })).sort((a, b) => a.p - b.p);
    return `${chipsDest}
      <div class="sv-avance">
        <div class="sv-avance-cab"><div><b>${esc(X.camp.nombre)}</b><small>Avance de la meta · esperado a hoy ${f1(esperado)}%</small></div><span class="sv-pct">${f1(pct)}%</span></div>
        <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-label="Avance de la meta de Influenza"><i class="sv-barra--${tono}" style="width:${Math.min(100, pct)}%"></i></div>
        <p class="sv-leyenda"><span class="sv-pill sv-pill--${tono}">${etiqueta}</span><span>${nf(apl)} de ${nf(meta)} dosis</span></p>
        <p class="sv-nota sv-nota--sup">${diff >= 0 ? `Vas ${f1(diff)} puntos por delante.` : `Faltan ${f1(-diff)} puntos para ir en ritmo.`}${ultima ? ` Sin reporte de la última semana: ${sinReporte.length} de ${conMeta.length} unidades.` : ""}</p>
      </div>
      <p class="sv-sec">Por unidad · de menor a mayor avance</p>
      <ul class="sv-lista sv-lista--sep">${ranking.map((f) => `<li class="sv-unidad">
        <div class="sv-u-txt"><b>${esc(f.u.unidad)}</b><small>${nf(f.apl)} de ${nf(f.meta)}${f.nunca ? " · sin reportes" : ""}</small>
          <div class="sv-barra sv-barra--fina"><i class="sv-barra--${f.p - esperado >= -5 ? "ok" : f.p - esperado >= -15 ? "reg" : "mal"}" style="width:${Math.min(100, f.p)}%"></i></div></div>
        <span class="sv-pill sv-pill--${f.p - esperado >= -5 ? "ok" : f.p - esperado >= -15 ? "reg" : "mal"}">${Math.round(f.p)}%</span></li>`).join("")}</ul>`;
  }

  SV.registrar("RDA", "Indicadores RDA", { abrir }, "supRdaRoot");
  global.MobileSupervisionRda = { _util: { cobertura } };
})(typeof window !== "undefined" ? window : globalThis);
