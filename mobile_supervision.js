/* ============================================================================
   Móvil · perfiles de supervisión (MUNICIPAL, JURISDICCIONAL, VISUALIZADOR,
   CARAVANAS, ADMIN). Reemplaza la barra de captura (que es de UNIDAD) por:
   Resumen · Influenza · Avisos · Capacitaciones · Más.
   Lenguaje visual: tarjetas planas, chips y puntos de estado de municipal_guiado.css
   (.mun-*), con prefijo .sv- para no depender de la hoja de escritorio.
   Los paneles pesados (SINBA-SIS, concentrados, requisiciones, lotes) quedan en escritorio.
   ============================================================================ */
(function (global) {
  "use strict";

  const ROLES = ["MUNICIPAL", "JURISDICCIONAL", "VISUALIZADOR_JURISDICCIONAL", "CARAVANAS", "ADMIN"];

  // Cada módulo: icono, etiqueta, color de la barra y a qué roles aplica.
  const MOD = {
    RES: { icon: "dashboard", label: "Resumen", hoja: "#0284c7" },
    INF: { icon: "clinical_notes", label: "Influenza", hoja: "#6d28d9" },
    AVI: { icon: "campaign", label: "Avisos", hoja: "#d97706" },
    CAL: { icon: "event", label: "Capacitación", hoja: "#059669" },
    MAS: { icon: "apps", label: "Más", hoja: "#475569" }
  };
  const NAV = {
    MUNICIPAL: ["RES", "INF", "AVI", "CAL", "MAS"],
    JURISDICCIONAL: ["RES", "INF", "AVI", "CAL", "MAS"],
    ADMIN: ["RES", "INF", "AVI", "CAL", "MAS"],
    CARAVANAS: ["RES", "AVI", "CAL", "MAS"],
    VISUALIZADOR_JURISDICCIONAL: ["RES", "CAL", "MAS"]
  };
  // Disponibles en el móvil desde «Más» (abren su propio panel).
  const LISTOS = [
    { panel: "RDA", icon: "stacked_bar_chart", label: "Indicadores RDA", nota: "Esquema básico" },
    { panel: "MET", icon: "query_stats", label: "Métricas", nota: "Captura semanal" }
  ];
  // Pendientes de diseñar para móvil (se muestran en «Más» como próximamente).
  const PROXIMAMENTE = [
    { icon: "sanitizer", label: "Pinol", roles: ["MUNICIPAL", "ADMIN"] },
    { icon: "tune", label: "Parámetros", roles: ["MUNICIPAL", "JURISDICCIONAL", "ADMIN"] },
    { icon: "vaccines", label: "Jeringas", roles: ["MUNICIPAL", "JURISDICCIONAL", "ADMIN"] }
  ];
  // Paneles que cuelgan de «Más»: la barra resalta Más mientras están abiertos.
  const SUBPANELES = { RDA: "MAS", MET: "MAS" };
  // Solo escritorio: demasiado pesados para el celular.
  const SOLO_ESCRITORIO = [
    { icon: "medication_liquid", label: "SINBA-SIS", roles: ["MUNICIPAL", "ADMIN"] },
    { icon: "lab_profile", label: "Concentrado biológico", roles: ["JURISDICCIONAL", "ADMIN"] },
    { icon: "table_chart", label: "Concentrado", roles: ["JURISDICCIONAL", "VISUALIZADOR_JURISDICCIONAL", "ADMIN"] },
    { icon: "local_shipping", label: "Requisiciones", roles: ["MUNICIPAL", "JURISDICCIONAL", "ADMIN"] },
    { icon: "inventory_2", label: "Lotes", roles: ["JURISDICCIONAL", "ADMIN"] },
    { icon: "admin_panel_settings", label: "Seguridad y catálogos", roles: ["ADMIN"] }
  ];

  const TIPOS = {
    SR: { label: "Biológicos", rpc: "get_captures_sr_range_bypass", periodo: "semana" },
    CONS: { label: "Consumibles", rpc: "get_captures_cons_range_bypass", periodo: "semana" },
    BIO: { label: "Pedido", rpc: "get_captures_bio_range_bypass", periodo: "mes" }
  };

  let cfg = null;
  let S = null; // estado del Resumen
  let panelActual = "RES";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fmtCorta = (d) => `${d.getDate()} ${MESES[d.getMonth()]}`;

  const rol = () => String((cfg && cfg.getProfile() && cfg.getProfile().rol) || "").toUpperCase();
  const puedeUsar = () => !!cfg && ROLES.includes(rol());

  function rango(periodo, hoy, atras) {
    const d = hoy || new Date();
    const n = atras || 0;
    if (periodo === "mes") {
      return { ini: new Date(d.getFullYear(), d.getMonth() - n, 1), fin: new Date(d.getFullYear(), d.getMonth() - n + 1, 0) };
    }
    const dow = d.getDay();
    const lunes = new Date(d); lunes.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - 7 * n);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { ini: lunes, fin: domingo };
  }

  function etiquetaPeriodo(tipo, atras) {
    const r = rango(TIPOS[tipo].periodo, null, atras);
    if (TIPOS[tipo].periodo === "mes") {
      const m = MESES[r.ini.getMonth()];
      return `${m.charAt(0).toUpperCase() + m.slice(1)}-${String(r.ini.getFullYear()).slice(2)}`;
    }
    return `${fmtCorta(r.ini)} – ${fmtCorta(r.fin)}`;
  }

  // ── Alcance de unidades según el rol ──
  function municipiosPermitidos() {
    const p = cfg.getProfile() || {};
    const raw = p.municipios_allowed != null ? p.municipios_allowed : p.municipio;
    const lista = Array.isArray(raw) ? raw : String(raw || "").split(/[;,]/);
    return lista.map((x) => x.trim()).filter(Boolean);
  }
  function esCaravana(u) {
    const n = String(u.unidad || "").trim().toUpperCase();
    return n.startsWith("FAM") || n.startsWith("UMME");
  }
  function enAlcance(u) {
    const r = rol();
    if (r === "CARAVANAS") return esCaravana(u);
    if (r === "MUNICIPAL") {
      const ok = municipiosPermitidos();
      if (ok.includes("*")) return true;
      const m = norm(u.municipio);
      return ok.some((a) => norm(a) === m);
    }
    return true;
  }
  function textoAlcance(unidades) {
    const r = rol();
    const muni = [...new Set(unidades.map((u) => u.municipio).filter(Boolean))];
    if (r === "CARAVANAS") return ["Mis unidades móviles", `${unidades.length} unidades`];
    if (r === "MUNICIPAL") return ["Municipios a cargo", `${muni.length} municipios · ${unidades.length} unidades`];
    return ["Jurisdicción Sanitaria 1", `${muni.length} municipios · ${unidades.length} unidades`];
  }

  // ── Datos ──
  async function rpcTodas(db, nombre, params) {
    let todo = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.rpc(nombre, params).range(desde, desde + 999);
      if (error) throw error;
      if (!data || !data.length) break;
      todo = todo.concat(data);
      if (data.length < 1000) break;
    }
    return todo;
  }

  async function cargarBase() {
    const db = cfg.getClient();
    const { data, error } = await db.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
    if (error) throw error;
    S.unidades = (data || []).filter(enAlcance).sort((a, b) =>
      String(a.municipio || "").localeCompare(String(b.municipio || ""), "es") ||
      String(a.unidad || "").localeCompare(String(b.unidad || ""), "es"));
  }

  const claveCap = (tipo, atras) => tipo + ":" + (atras || 0);

  async function cargarTipo(tipo, atras) {
    const k = claveCap(tipo, atras);
    if (S.capturas[k]) return;
    const db = cfg.getClient();
    const r = rango(TIPOS[tipo].periodo, null, atras);
    const filas = await rpcTodas(db, TIPOS[tipo].rpc, { p_fecha_inicio: ymd(r.ini), p_fecha_fin: ymd(r.fin) });
    S.capturas[k] = new Set(filas.map((x) => String(x.clues || x.CLUES || "").trim().toUpperCase()).filter(Boolean));
  }

  // ── Resumen ──
  function pintarResumen() {
    const root = document.getElementById("supRoot");
    if (!root || !S) return;
    const atras = S.atras[S.tipo] || 0;
    const caps = S.capturas[claveCap(S.tipo, atras)];
    const q = norm(S.q);
    const conEstado = S.unidades.map((u) => ({ u, ok: !!caps && caps.has(String(u.clues || "").trim().toUpperCase()) }));
    const total = conEstado.length;
    const hechas = conEstado.filter((x) => x.ok).length;
    const pct = total ? Math.round((hechas / total) * 100) : 0;
    const lista = conEstado.filter((x) => {
      if (S.filtro === "faltan" && x.ok) return false;
      if (S.filtro === "capturadas" && !x.ok) return false;
      if (q && !norm(x.u.unidad).includes(q) && !norm(x.u.clues).includes(q) && !norm(x.u.municipio).includes(q)) return false;
      return true;
    });
    const [alcT, alcS] = textoAlcance(S.unidades);

    const chipsTipo = Object.keys(TIPOS).map((k) =>
      `<button type="button" class="sv-chip${k === S.tipo ? " activo" : ""}" data-tipo="${k}" aria-pressed="${k === S.tipo}">${TIPOS[k].label}</button>`).join("");
    const chipsPeriodo = ["", "Actual", "Anterior"].slice(1).map((t, i) =>
      `<button type="button" class="sv-chip sv-chip--sm${i === atras ? " activo" : ""}" data-atras="${i}" aria-pressed="${i === atras}">${t}</button>`).join("");
    const sinPedidos = S.tipo === "BIO" && atras === 0 && !S.cargando && !S.error && caps && caps.size === 0;
    const avisoPeriodo = sinPedidos ? `<p class="sv-aviso" role="status"><span class="material-symbols-rounded" aria-hidden="true">info</span>Aún no hay pedidos registrados este mes; la ventana del pedido puede no haber abierto. Consulta «Anterior» para ver el mes pasado.</p>` : S.avisoAuto && S.avisoAuto[S.tipo] ? `<p class="sv-aviso" role="status"><span class="material-symbols-rounded" aria-hidden="true">info</span>La captura de esta semana abre el jueves. Mostrando la semana anterior.</p>` : "";
    const chipsFiltro = [["faltan", "Faltan"], ["capturadas", "Capturadas"], ["todas", "Todas"]].map(([k, t]) =>
      `<button type="button" class="sv-chip sv-chip--sm${k === S.filtro ? " activo" : ""}" data-filtro="${k}" aria-pressed="${k === S.filtro}">${t}</button>`).join("");

    let cuerpo;
    if (S.cargando) {
      cuerpo = `<p class="sv-vacio" role="status">Cargando…</p>`;
    } else if (S.error) {
      cuerpo = `<p class="sv-vacio" role="alert">${esc(S.error)}</p><button type="button" class="sv-btn" id="svReintentar">Reintentar</button>`;
    } else if (!lista.length) {
      cuerpo = `<p class="sv-vacio">${S.filtro === "faltan" && !q ? "Todas las unidades capturaron. ¡Buen trabajo!" : "Sin unidades con ese criterio."}</p>`;
    } else {
      cuerpo = `<ul class="sv-lista">${lista.map((x) => `
        <li class="sv-unidad ${x.ok ? "completo" : "falta"}">
          <span class="sv-dot" aria-hidden="true"></span>
          <div class="sv-u-txt"><b>${esc(x.u.unidad)}</b><small>${esc(x.u.municipio || "")} · ${esc(x.u.clues)}</small></div>
          <span class="sv-pill ${x.ok ? "ok" : "falta"}">${x.ok ? "Capturó" : "Falta"}</span>
        </li>`).join("")}</ul>`;
    }

    root.innerHTML = `
      <div class="sv-scope"><span class="material-symbols-rounded" aria-hidden="true">location_on</span><b>${esc(alcT)}</b><small>${esc(alcS)}</small></div>
      ${rol() === "VISUALIZADOR_JURISDICCIONAL" ? `<div class="sv-ro"><span class="material-symbols-rounded" aria-hidden="true">visibility</span>Solo lectura</div>` : ""}
      <div class="sv-chips" role="group" aria-label="Tipo de captura">${chipsTipo}</div>
      <div class="sv-chips" role="group" aria-label="Periodo">${chipsPeriodo}</div>
      ${avisoPeriodo}
      <div class="sv-avance">
        <div class="sv-avance-cab"><div><b>${TIPOS[S.tipo].label}</b><small>${esc(etiquetaPeriodo(S.tipo, atras))}</small></div><span class="sv-pct">${pct}%</span></div>
        <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Unidades que capturaron"><i style="width:${pct}%"></i></div>
        <p class="sv-leyenda"><span><i class="sv-dot completo"></i>${hechas} capturaron</span><span><i class="sv-dot falta"></i>${total - hechas} faltan</span></p>
      </div>
      <div class="sv-filtros">
        <div class="sv-chips" role="group" aria-label="Filtro">${chipsFiltro}</div>
        <label class="sv-buscar"><span class="sr-only">Buscar unidad</span>
          <span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input type="search" id="svBuscar" placeholder="Buscar unidad o CLUES" value="${esc(S.q)}" autocomplete="off"></label>
      </div>
      ${cuerpo}`;

    root.querySelectorAll("[data-tipo]").forEach((b) => { b.onclick = () => cambiarTipo(b.dataset.tipo); });
    root.querySelectorAll("[data-filtro]").forEach((b) => { b.onclick = () => { S.filtro = b.dataset.filtro; pintarResumen(); }; });
    root.querySelectorAll("[data-atras]").forEach((b) => { b.onclick = () => cambiarPeriodo(Number(b.dataset.atras)); });
    const bus = root.querySelector("#svBuscar");
    if (bus) bus.oninput = () => {
      S.q = bus.value;
      const pos = bus.selectionStart;
      pintarResumen();
      const nuevo = document.getElementById("svBuscar");
      if (nuevo) { nuevo.focus(); try { nuevo.setSelectionRange(pos, pos); } catch (e) { /* tipo search */ } }
    };
    const re = root.querySelector("#svReintentar");
    if (re) re.onclick = () => { S = null; abrirResumen(); };
  }

  async function cambiarTipo(tipo) {
    S.tipo = tipo;
    S.error = null;
    const atras = S.atras[tipo] || 0;
    if (!S.capturas[claveCap(tipo, atras)]) { S.cargando = true; pintarResumen(); }
    try { await cargarTipo(tipo, atras); S.cargando = false; await autoAnterior(tipo); }
    catch (e) { S.cargando = false; S.error = "No se pudo cargar: " + (e.message || e); }
    pintarResumen();
  }

  async function cambiarPeriodo(atras) {
    S.atras[S.tipo] = atras;
    if (S.avisoAuto) S.avisoAuto[S.tipo] = false;
    S.error = null;
    if (!S.capturas[claveCap(S.tipo, atras)]) { S.cargando = true; pintarResumen(); }
    try { await cargarTipo(S.tipo, atras); S.cargando = false; }
    catch (e) { S.cargando = false; S.error = "No se pudo cargar: " + (e.message || e); }
    pintarResumen();
  }

  // Lunes a miércoles la semana en curso aún no tiene captura (se captura jueves y viernes):
  // si está vacía se muestra la semana anterior para que el resumen sirva.
  async function autoAnterior(tipo) {
    if (TIPOS[tipo].periodo !== "semana") return;
    if (S.atras[tipo] !== undefined && S.atras[tipo] !== 0) return;
    if (S.autoVisto[tipo]) return;
    S.autoVisto[tipo] = true;
    const dow = new Date().getDay();
    const enCurso = S.capturas[claveCap(tipo, 0)];
    if (dow >= 1 && dow <= 3 && enCurso && enCurso.size === 0) {
      S.atras[tipo] = 1;
      S.avisoAuto[tipo] = true;
      await cargarTipo(tipo, 1);
    }
  }

  async function abrirResumen() {
    if (!S) S = { unidades: [], capturas: {}, atras: {}, avisoAuto: {}, autoVisto: {}, tipo: "SR", filtro: "faltan", q: "", cargando: true, error: null };
    pintarResumen();
    if (S.unidades.length && S.capturas[claveCap(S.tipo, S.atras[S.tipo])]) { S.cargando = false; pintarResumen(); return; }
    try {
      if (!S.unidades.length) await cargarBase();
      await cargarTipo(S.tipo, S.atras[S.tipo] || 0);
      await autoAnterior(S.tipo);
      S.cargando = false;
    } catch (e) {
      S.cargando = false;
      S.error = "No se pudo cargar el resumen: " + (e.message || e);
    }
    pintarResumen();
  }

  // ── Más ──
  function pintarMas() {
    const root = document.getElementById("supMasRoot");
    if (!root) return;
    const r = rol();
    const prox = PROXIMAMENTE.filter((m) => m.roles.includes(r));
    const desk = SOLO_ESCRITORIO.filter((m) => m.roles.includes(r));
    const fila = (m, nota) => `<li class="sv-mas-item"><span class="material-symbols-rounded" aria-hidden="true">${m.icon}</span><b>${esc(m.label)}</b><small>${nota}</small></li>`;
    root.innerHTML = `
      <p class="sv-sec">Disponible</p>
      <ul class="sv-mas">${LISTOS.map((m) => `<li><button type="button" class="sv-mas-item sv-mas-btn" data-ir="${m.panel}">
        <span class="material-symbols-rounded" aria-hidden="true">${m.icon}</span><b>${esc(m.label)}</b><small>${esc(m.nota)}</small>
        <span class="material-symbols-rounded sv-chev" aria-hidden="true">chevron_right</span></button></li>`).join("")}</ul>
      <p class="sv-sec">En camino al móvil</p>
      <ul class="sv-mas">${prox.map((m) => fila(m, "Próximamente")).join("")}</ul>
      <p class="sv-sec">Solo en escritorio</p>
      <ul class="sv-mas sv-mas--desk">${desk.map((m) => fila(m, "Usa la versión de escritorio")).join("")}</ul>`;
    root.querySelectorAll("[data-ir]").forEach((b) => { b.onclick = () => irA(b.dataset.ir); });
  }

  function irA(panelId) {
    if (cfg && typeof cfg.irA === "function") cfg.irA(panelId);
  }
  const encabezadoSub = (titulo) => `<div class="sv-sub"><button type="button" class="sv-back" data-back aria-label="Volver a Más"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span></button><h2>${esc(titulo)}</h2></div>`;
  function enlazarVolver(root) { root.querySelectorAll("[data-back]").forEach((b) => { b.onclick = () => irA("MAS"); }); }

  const MESES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const nf = (n) => Number(n || 0).toLocaleString("es-MX");

  // ── Indicadores RDA (esquema básico, ligero) ──
  // Misma fórmula que rda_ui.js: dosis / divisor / (población × 0.0833 × meses transcurridos).
  let R = null;
  const estadoCob = (v) => (v >= 95 ? "ok" : v >= 75 ? "reg" : "mal");
  const textoEstado = { ok: "Óptimo", reg: "Regular", mal: "Crítico" };

  function agregar(filas, maxMes) {
    const g = (k) => filas.reduce((t, u) => t + (Number(u[k]) || 0), 0);
    const pob1 = g("pob_menor_1"), pob2 = g("pob_1_ano"), pob4 = g("pob_4_anos");
    const d1 = g("bcg_dosis") + g("hepb_0_7_dosis") + g("hexa_3_dosis") + g("rota_2_dosis") + g("neumo_2_dosis");
    const d2 = g("hexa_ref_dosis") + g("neumo_ref_dosis") + g("srp_2_dosis");
    const d4 = g("dpt_4_dosis");
    const cob = (dosis, div, pob) => {
      const f = pob * 0.0833 * maxMes;
      return f > 0 ? Math.round((dosis / div / f) * 1000) / 10 : 0;
    };
    return { pob1, pob2, pob4, d1, d2, d4, c1: cob(d1, 4, pob1), c2: cob(d2, 3, pob2), c4: cob(d4, 1, pob4) };
  }

  async function cargarRDA() {
    const db = cfg.getClient();
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const { data: mm, error: e1 } = await db.rpc("get_rda_max_mes", { p_anio: anio });
    if (e1) throw e1;
    let maxMes = parseInt(mm, 10);
    if (isNaN(maxMes) || maxMes < 1) maxMes = 1;
    if (maxMes > hoy.getMonth() + 1) maxMes = hoy.getMonth() + 1;
    const { data, error } = await db.rpc("get_rda_indicators", { p_anio: anio, p_max_mes: maxMes });
    if (error) throw error;
    R.anio = anio;
    R.maxMes = maxMes;
    R.filas = (data || []).map((u) => ({ ...u, unidad: u.unidad || u.nombre })).filter(enAlcance);
    // Unidades activas de tu alcance que el RDA no trae (p. ej. hospitales sin población asignada)
    R.sinRda = [];
    try {
      const { data: us } = await db.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
      const con = new Set(R.filas.map((u) => String(u.clues || "").trim().toUpperCase()));
      R.sinRda = (us || []).filter(enAlcance).filter((u) => !con.has(String(u.clues || "").trim().toUpperCase()));
    } catch (e) { /* solo informativo */ }
  }

  function pintarRDA() {
    const root = document.getElementById("supRdaRoot");
    if (!root || !R) return;
    let cuerpo;
    if (R.cargando) cuerpo = `<div class="sv-cargando" role="status" aria-live="polite"><div class="sv-indet" aria-hidden="true"><i></i></div><p>Calculando indicadores…</p><small>Puede tardar unos segundos.</small></div>`;
    else if (R.error) cuerpo = `<p class="sv-vacio" role="alert">${esc(R.error)}</p><button type="button" class="sv-btn" id="svRdaRe">Reintentar</button>`;
    else {
      const munis = [...new Set(R.filas.map((u) => String(u.municipio || "").toUpperCase().trim()).filter(Boolean))].sort();
      const usadas = R.muni ? R.filas.filter((u) => String(u.municipio || "").toUpperCase().trim() === R.muni) : R.filas;
      const a = agregar(usadas, R.maxMes);
      const kpi = (titulo, icono, cob, dosis, pob) => {
        const st = estadoCob(cob);
        return `<div class="sv-kpi">
          <div class="sv-kpi-cab"><span class="material-symbols-rounded" aria-hidden="true">${icono}</span><b>${titulo}</b><span class="sv-pill sv-pill--${st}">${textoEstado[st]}</span></div>
          <div class="sv-kpi-val">${cob}<small>%</small></div>
          <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(cob))}" aria-label="${titulo}"><i class="sv-barra--${st}" style="width:${Math.min(100, cob)}%"></i></div>
          <small class="sv-kpi-sub">${nf(dosis)} dosis · Pob. ${nf(pob)}</small></div>`;
      };
      const ranking = usadas.map((u) => ({ u, a: agregar([u], R.maxMes) }))
        .sort((x, y) => x.a.c1 - y.a.c1 || String(x.u.unidad).localeCompare(String(y.u.unidad), "es"));
      const chipMuni = munis.length > 1 ? `<div class="sv-chips sv-chips--scroll" role="group" aria-label="Municipio">
        <button type="button" class="sv-chip sv-chip--sm${!R.muni ? " activo" : ""}" data-muni="" aria-pressed="${!R.muni}">Todos</button>
        ${munis.map((m) => `<button type="button" class="sv-chip sv-chip--sm${R.muni === m ? " activo" : ""}" data-muni="${esc(m)}" aria-pressed="${R.muni === m}">${esc(m)}</button>`).join("")}</div>` : "";
      cuerpo = `
        <p class="sv-corte"><span class="material-symbols-rounded" aria-hidden="true">event_available</span>Corte: ${MESES_LARGO[R.maxMes - 1]} ${R.anio} · meta proporcional al mes</p>
        ${chipMuni}
        <div class="sv-kpis">${kpi("Menores de 1 año", "child_care", a.c1, a.d1, a.pob1)}${kpi("1 año", "face", a.c2, a.d2, a.pob2)}${kpi("4 años", "school", a.c4, a.d4, a.pob4)}</div>
        <p class="sv-sec">Por unidad · de menor a mayor avance</p>
        ${ranking.length ? `<ul class="sv-lista">${ranking.map((x) => `<li class="sv-unidad sv-unidad--rda">
          <div class="sv-u-txt"><b>${esc(x.u.unidad)}</b><small>${esc(x.u.municipio || "")}</small></div>
          <div class="sv-mini" role="img" aria-label="Cobertura: menores de 1 año ${x.a.c1}%, 1 año ${x.a.c2}%, 4 años ${x.a.c4}%">
            <span class="sv-mini-i sv-mini--${estadoCob(x.a.c1)}"><em>&lt;1</em>${Math.round(x.a.c1)}%</span>
            <span class="sv-mini-i sv-mini--${estadoCob(x.a.c2)}"><em>1</em>${Math.round(x.a.c2)}%</span>
            <span class="sv-mini-i sv-mini--${estadoCob(x.a.c4)}"><em>4</em>${Math.round(x.a.c4)}%</span></div></li>`).join("")}</ul>`
          : `<p class="sv-vacio">Sin unidades en tu alcance.</p>`}
        ${R.sinRda && R.sinRda.length ? `<p class="sv-nota">Sin registro en el RDA: ${R.sinRda.map((u) => esc(u.unidad)).join(", ")}.</p>` : ""}
        <p class="sv-nota">Otros esquemas (adultos, mayores, embarazadas, invernal) y comparativas siguen en escritorio.</p>`;
    }
    root.innerHTML = encabezadoSub("Indicadores RDA") + cuerpo;
    enlazarVolver(root);
    root.querySelectorAll("[data-muni]").forEach((b) => { b.onclick = () => { R.muni = b.dataset.muni; pintarRDA(); }; });
    const re = root.querySelector("#svRdaRe");
    if (re) re.onclick = () => { R = null; abrirRDA(); };
  }

  async function abrirRDA() {
    if (!R) R = { filas: null, muni: "", cargando: true, error: null };
    if (R.filas) { R.cargando = false; pintarRDA(); return; }
    R.cargando = true;
    pintarRDA();
    try { await cargarRDA(); R.cargando = false; R.error = null; }
    catch (e) { R.cargando = false; R.error = "No se pudieron cargar los indicadores: " + (e.message || e); }
    pintarRDA();
  }

  // ── Métricas (captura semanal por unidad, ligero) ──
  // Muestra los componentes (B, C, P) y un % simple de captura semanal. La calificación con medallas
  // (Influenza + regla del pedido) vive en escritorio; aquí no se inventa otra distinta.
  let M = null;
  const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  function moverMes(ym, delta) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  function pctSemanal(r) {
    const eb = Number(r.ebio) || 4, ec = Number(r.econs) || 4;
    return Math.min(100, Math.round((((Number(r.bio_semanas_ok) || 0) + (Number(r.cons_semanas_ok) || 0)) / (eb + ec)) * 100));
  }

  async function cargarMet() {
    const db = cfg.getClient();
    const { data, error } = await db.rpc("get_history_metrics_rpc", { p_mes: M.mes });
    if (error) throw error;
    M.filas = (data || []).filter(enAlcance);
  }

  function pintarMet() {
    const root = document.getElementById("supMetRoot");
    if (!root || !M) return;
    const [y, m] = M.mes.split("-").map(Number);
    const esActual = M.mes === mesActual();
    let cuerpo;
    if (M.cargando) cuerpo = `<div class="sv-cargando" role="status" aria-live="polite"><div class="sv-indet" aria-hidden="true"><i></i></div><p>Cargando métricas…</p></div>`;
    else if (M.error) cuerpo = `<p class="sv-vacio" role="alert">${esc(M.error)}</p><button type="button" class="sv-btn" id="svMetRe">Reintentar</button>`;
    else {
      const todas = M.filas.map((r) => ({ r, p: pctSemanal(r) }));
      const completas = todas.filter((x) => x.p === 100).length;
      const prom = todas.length ? Math.round(todas.reduce((t, x) => t + x.p, 0) / todas.length) : 0;
      const lista = todas.filter((x) => M.filtro === "todas" || x.p < 100)
        .sort((a, b) => a.p - b.p || String(a.r.unidad).localeCompare(String(b.r.unidad), "es"));
      const fecha = (v) => { if (!v) return "—"; const d = new Date(String(v).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "—" : fmtCorta(d); };
      const chips = [["incompletas", "Incompletas"], ["todas", "Todas"]].map(([k, t]) =>
        `<button type="button" class="sv-chip sv-chip--sm${k === M.filtro ? " activo" : ""}" data-mfiltro="${k}" aria-pressed="${k === M.filtro}">${t}</button>`).join("");
      cuerpo = `
        <div class="sv-avance">
          <div class="sv-avance-cab"><div><b>Captura semanal</b><small>Biológicos + consumibles · ${todas.length} unidades</small></div><span class="sv-pct">${prom}%</span></div>
          <div class="sv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prom}" aria-label="Promedio de captura semanal"><i style="width:${prom}%"></i></div>
          <p class="sv-leyenda"><span><i class="sv-dot completo"></i>${completas} al 100%</span><span><i class="sv-dot falta"></i>${todas.length - completas} incompletas</span></p>
        </div>
        <div class="sv-chips" role="group" aria-label="Filtro">${chips}</div>
        ${lista.length ? `<ul class="sv-lista sv-lista--sep">${lista.map(({ r, p }) => `<li class="sv-unidad sv-unidad--met">
          <div class="sv-u-txt"><b>${esc(r.unidad)}</b><small>${esc(r.municipio || "")} · última captura ${fecha(r.ultima_captura)}</small>
            <div class="sv-barra sv-barra--fina"><i class="sv-barra--${p >= 90 ? "ok" : p >= 70 ? "reg" : "mal"}" style="width:${p}%"></i></div></div>
          <div class="sv-met-chips" role="img" aria-label="Biológicos ${r.bio_semanas_ok || 0} de ${r.ebio || 4}, consumibles ${r.cons_semanas_ok || 0} de ${r.econs || 4}, pedido ${r.pedido_mensual ? "enviado" : "pendiente"}">
            <span>B ${r.bio_semanas_ok || 0}/${r.ebio || 4}</span>
            <span>C ${r.cons_semanas_ok || 0}/${r.econs || 4}</span>
            <span class="${r.pedido_mensual ? "ok" : ""}">P ${r.pedido_mensual ? "✓" : "—"}</span></div></li>`).join("")}</ul>`
          : `<p class="sv-vacio">${M.filtro === "todas" ? "Sin unidades en tu alcance." : "Todas las unidades están al 100% este mes."}</p>`}
        <p class="sv-nota">La calificación con medallas (incluye Influenza y la regla del pedido) sigue en escritorio.</p>`;
    }
    root.innerHTML = encabezadoSub("Métricas") + `
      <div class="sv-mes">
        <button type="button" class="sv-mes-btn" data-mes="-1" aria-label="Mes anterior"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button>
        <b aria-live="polite">${MESES_LARGO[m - 1]} ${y}</b>
        <button type="button" class="sv-mes-btn" data-mes="1" aria-label="Mes siguiente"${esActual ? " disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
      </div>` + cuerpo;
    enlazarVolver(root);
    root.querySelectorAll("[data-mes]").forEach((b) => { b.onclick = () => cambiarMes(Number(b.dataset.mes)); });
    root.querySelectorAll("[data-mfiltro]").forEach((b) => { b.onclick = () => { M.filtro = b.dataset.mfiltro; pintarMet(); }; });
    const re = root.querySelector("#svMetRe");
    if (re) re.onclick = () => cambiarMes(0);
  }

  async function cambiarMes(delta) {
    const nuevo = moverMes(M.mes, delta);
    if (nuevo > mesActual()) return;
    M.mes = nuevo; M.cargando = true; M.error = null; pintarMet();
    try { await cargarMet(); M.cargando = false; }
    catch (e) { M.cargando = false; M.error = "No se pudieron cargar las métricas: " + (e.message || e); }
    pintarMet();
  }

  async function abrirMet() {
    if (!M) M = { mes: mesActual(), filas: null, filtro: "incompletas", cargando: true, error: null };
    if (M.filas) { M.cargando = false; pintarMet(); return; }
    M.cargando = true;
    pintarMet();
    try { await cargarMet(); M.cargando = false; M.error = null; }
    catch (e) { M.cargando = false; M.error = "No se pudieron cargar las métricas: " + (e.message || e); }
    pintarMet();
  }

  // ── Barra inferior ──
  function items() { return NAV[rol()] || NAV.MUNICIPAL; }

  function armarBarra() {
    const dock = document.getElementById("mobileCaptureDock");
    if (!dock) return;
    const lista = items().filter((k) => k !== "INF" || (global.MobileInfluenzaVal && global.MobileInfluenzaVal.puedeUsar()));
    const ind = dock.querySelector("#dockIndicator");
    dock.innerHTML = "";
    if (ind) dock.appendChild(ind);
    lista.forEach((k) => {
      const m = MOD[k];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dock-item";
      b.dataset.panel = k;
      if (k === "INF") b.id = "dockItemINF";
      b.style.setProperty("--hoja", m.hoja);
      b.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${m.icon}</span><span class="dock-label">${m.label}</span>`;
      dock.appendChild(b);
    });
    dock.style.gridTemplateColumns = `repeat(${lista.length}, minmax(0, 1fr))`;
    dock.setAttribute("aria-label", "Módulos de supervisión");
  }

  // Devuelve true si el panel lo atiende este módulo (el llamador ya alternó .panel-section).
  function mostrar(panelId) {
    panelActual = panelId;
    if (panelId === "RES") abrirResumen();
    else if (panelId === "MAS") pintarMas();
    else if (panelId === "RDA") abrirRDA();
    else if (panelId === "MET") abrirMet();
    else if (panelId === "CAL") {
      const host = document.getElementById("supCalRoot");
      if (global.CalendarioCap && host) global.CalendarioCap.mount(host);
    } else if (panelId === "INF") {
      if (global.MobileInfluenzaVal) global.MobileInfluenzaVal.abrir();
    }
  }

  function init(c) {
    cfg = c;
    if (!puedeUsar()) return;
    document.body.classList.add("sup-mode");
    armarBarra();
  }

  global.MobileSupervision = {
    init,
    puedeUsar,
    activo: () => document.body.classList.contains("sup-mode"),
    mostrar,
    panelInicial: () => "RES",
    // Qué botón de la barra se resalta para un panel (los sub-paneles cuelgan de «Más»)
    dockKey: (panelId) => SUBPANELES[panelId] || panelId,
    // Para pruebas
    _util: { rango, enAlcance, norm, etiquetaPeriodo, NAV, ROLES, agregar, pctSemanal, moverMes }
  };
})(typeof window !== "undefined" ? window : globalThis);
