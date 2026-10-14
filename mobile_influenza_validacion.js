/**
 * Validación de reportes de Influenza (versión móvil).
 *
 * Mismo flujo que «Validación y Edición» del escritorio, en una sola columna:
 *   1. Lista de unidades del municipio con el estado de su reporte de la semana (Sin reporte / Por validar /
 *      Validado / Corregido).
 *   2. Detalle de la unidad: vista en vivo de lo capturado (total, quién capturó, quién firmó) y el formulario
 *      de corrección con meta, acumulado y avance. «Validar sin cambios» o «Guardar corrección».
 *
 * Datos: tablas campanas, unidades, influenza_metas e influenza_capturas (las mismas del escritorio, con las
 * mismas políticas de acceso). Reglas de calendario de 1ª/2ª dosis: influenza_reglas.js (window.InfluenzaReglas).
 * Rubros: influenza_rubros.js (window.INFLUENZA_RUBROS_MOVIL).
 */
(function (root) {
  "use strict";

  const ROLES = ["ADMIN", "JURISDICCIONAL", "MUNICIPAL"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const ESTADOS = [
    { id: "todas", label: "Todas" },
    { id: "pendiente", label: "Sin reporte" },
    { id: "reportado", label: "Por validar" },
    { id: "corregido", label: "Revisadas" }
  ];

  let cfg = null;               // { getClient, getProfile, toast }
  let rootEl = null;
  let S = null;                 // estado

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

  // ── Fechas (siempre locales, nunca toISOString: de noche en México adelantaría un día) ──
  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parse(s) { return new Date(`${s}T12:00:00`); }
  function suma(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function lunesDe(s) { const d = parse(s); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w)); return ymd(d); }
  function corta(s) { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()]}`; }
  function larga(s) { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function isoWeek(s) {
    const t = parse(s);
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 4 - (t.getDay() || 7));
    const y0 = new Date(t.getFullYear(), 0, 1);
    return Math.ceil((((t - y0) / 86400000) + 1) / 7);
  }
  function rangoSemana(fecha) {
    const ini = lunesDe(fecha);
    const fin = suma(ini, 6);
    const a = parse(ini), b = parse(fin);
    return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} ${MESES[b.getMonth()]}` : `${corta(ini)} al ${corta(fin)}`;
  }

  // Semanas de la campaña: viernes dentro de la temporada + cortes de fin de mes (ver InfluenzaReglas.cortes).
  function generarSemanas(inicio, fin) {
    const semanas = [];
    const d = parse(inicio);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    const limite = parse(fin);
    while (d <= limite) {
      const f = ymd(d);
      semanas.push({ fecha: f, label: `Semana ${isoWeek(f)} (${rangoSemana(f)})` });
      d.setDate(d.getDate() + 7);
    }
    const cortes = root.InfluenzaReglas ? root.InfluenzaReglas.cortes(inicio, fin) : [];
    cortes.forEach(f => semanas.push({ fecha: f, corte: true, label: `Semana ${isoWeek(f)} (corte de mes: ${rangoSemana(f)})` }));
    semanas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return semanas;
  }

  // La semana en curso: la más reciente cuyo lunes ya llegó.
  function semanaPredeterminada(semanas) {
    const hoy = ymd(new Date());
    let elegida = semanas[0];
    semanas.forEach(s => { if (lunesDe(s.fecha) <= hoy) elegida = s; });
    return elegida ? elegida.fecha : "";
  }

  function rubros() { return root.INFLUENZA_RUBROS_MOVIL || []; }
  function reglaDosis(rb, fecha) {
    return root.InfluenzaReglas && S.camp
      ? root.InfluenzaReglas.reglaDosis(rb.grupo, fecha, S.camp.fecha_inicio, S.camp.fecha_fin)
      : null;
  }

  function historial(report) {
    try {
      const h = report && report.historial_ediciones;
      return Array.isArray(h) ? h : JSON.parse(h || "[]");
    } catch (_) { return []; }
  }
  function estadoDe(report) {
    if (!report) return "pendiente";
    return report.editado_por && report.editado_por !== "UNIDAD" ? "corregido" : "reportado";
  }
  function ultimaEdicion(report) {
    const h = historial(report);
    return h.length ? h[h.length - 1] : null;
  }
  function valoresOriginales(report) {
    const primera = historial(report).find(h => h && h.editado_por && h.editado_por !== "UNIDAD");
    return primera ? (primera.valores_anteriores || primera.valores_previos || null) : null;
  }
  function totalDosis(report) {
    return Object.values((report && report.valores) || {}).reduce((a, v) => a + Number(v || 0), 0);
  }

  // ── Acceso ──
  function rolPermitido() {
    const p = cfg && cfg.getProfile ? cfg.getProfile() : null;
    return !!p && ROLES.includes(String(p.rol || "").toUpperCase());
  }

  function municipiosPermitidos(todas) {
    const p = cfg.getProfile();
    const rol = String(p.rol || "").toUpperCase();
    const todos = [...new Set(todas.map(u => u.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    if (rol === "ADMIN" || rol === "JURISDICCIONAL") return todos;
    const permitidos = new Set(
      [p.municipio, ...String(p.municipios_allowed || "").split(/[,;|]/)].map(norm).filter(Boolean)
    );
    return todos.filter(m => permitidos.has(norm(m)));
  }

  // ── Datos ──
  async function cargarBase() {
    const db = cfg.getClient();
    const { data: camps, error: e1 } = await db.from("campanas").select("*").ilike("nombre", "Campaña Influenza%").order("fecha_inicio", { ascending: false });
    if (e1) throw e1;
    S.camp = (camps || []).find(c => c.activo) || (camps || [])[0] || null;
    if (!S.camp) throw new Error("No hay una campaña de Influenza configurada.");
    S.semanas = generarSemanas(S.camp.fecha_inicio, S.camp.fecha_fin);

    const { data: unis, error: e2 } = await db.from("unidades").select("clues, unidad, municipio").eq("activo", "SI").order("municipio").order("unidad");
    if (e2) throw e2;
    S.todasUnidades = unis || [];
    S.municipios = municipiosPermitidos(S.todasUnidades);
  }

  async function cargarSemana() {
    const db = cfg.getClient();
    const [m, c] = await Promise.all([
      db.from("influenza_metas").select("*").eq("anio_campana", S.camp.nombre).eq("municipio", S.municipio),
      db.from("influenza_capturas").select("*").eq("anio_campana", S.camp.nombre).eq("municipio", S.municipio).eq("fecha", S.fecha)
    ]);
    if (m.error) throw m.error;
    if (c.error) throw c.error;
    S.metas = {};
    (m.data || []).forEach(r => { S.metas[r.clues] = r.metas || {}; });
    S.capturas = {};
    (c.data || []).forEach(r => { S.capturas[r.clues] = r; });
  }

  // ── Vista: lista ──
  function anunciar(msg) {
    const live = rootEl && rootEl.querySelector("#ivLive");
    if (!live) return;
    live.textContent = "";
    setTimeout(() => { live.textContent = msg; }, 50);
  }

  function unidadesVisibles() {
    const q = norm(S.q);
    return S.todasUnidades
      .filter(u => norm(u.municipio) === norm(S.municipio))
      .filter(u => !q || norm(u.unidad).includes(q) || norm(u.clues).includes(q))
      .filter(u => S.estado === "todas" || estadoDe(S.capturas[u.clues]) === S.estado);
  }

  function insigniaHtml(report) {
    const est = estadoDe(report);
    if (est === "corregido") {
      const sin = !!(ultimaEdicion(report) && ultimaEdicion(report).sin_cambios);
      return `<span class="iv-badge iv-badge--ok"><span class="material-symbols-rounded" aria-hidden="true">verified</span>${sin ? "Validado" : "Corregido"}</span>`;
    }
    if (est === "reportado") return `<span class="iv-badge iv-badge--info"><span class="material-symbols-rounded" aria-hidden="true">pending_actions</span>Por validar</span>`;
    return `<span class="iv-badge iv-badge--warn"><span class="material-symbols-rounded" aria-hidden="true">error</span>Sin reporte</span>`;
  }

  function pintarLista() {
    const mun = S.todasUnidades.filter(u => norm(u.municipio) === norm(S.municipio));
    const reportadas = mun.filter(u => S.capturas[u.clues]).length;
    const revisadas = mun.filter(u => estadoDe(S.capturas[u.clues]) === "corregido").length;
    const semanasOpts = S.semanas.map(s => `<option value="${esc(s.fecha)}"${s.fecha === S.fecha ? " selected" : ""}>${esc(s.label)}</option>`).join("");
    const munOpts = S.municipios.map(m => `<option value="${esc(m)}"${m === S.municipio ? " selected" : ""}>${esc(m)}</option>`).join("");

    rootEl.innerHTML = `
      <div class="iv-wrap" id="ivLista">
        <div class="iv-titulo">
          <h2 id="ivTitulo" tabindex="-1">Influenza: validar reportes</h2>
          <p>Revisa lo que capturó cada unidad, valida o corrige las cifras.</p>
        </div>
        <div class="iv-filtros">
          <label class="iv-campo"><span>Semana a validar</span>
            <select id="ivSemana">${semanasOpts}</select>
          </label>
          ${S.municipios.length > 1 ? `<label class="iv-campo"><span>Municipio</span><select id="ivMunicipio">${munOpts}</select></label>` : `<p class="iv-municipio-fijo">Municipio: <b>${esc(S.municipio)}</b></p>`}
          <label class="iv-campo"><span>Buscar unidad</span>
            <input id="ivBuscar" type="search" autocomplete="off" placeholder="CLUES o nombre" value="${esc(S.q)}">
          </label>
        </div>
        <div class="iv-chips" role="group" aria-label="Filtrar por estado del reporte">
          ${ESTADOS.map(e => `<button type="button" class="iv-chip" data-estado="${e.id}" aria-pressed="${S.estado === e.id}">${e.label}</button>`).join("")}
        </div>
        <p class="iv-resumen" id="ivResumen">${reportadas} de ${mun.length} unidades reportaron · ${revisadas} revisadas por supervisión</p>
        <div id="ivLive" class="iv-sr" role="status" aria-live="polite"></div>
        <ul class="iv-lista" id="ivUnidades"></ul>
      </div>`;

    rootEl.querySelector("#ivSemana").onchange = async (e) => {
      S.fecha = e.target.value;
      await recargar();
    };
    const selMun = rootEl.querySelector("#ivMunicipio");
    if (selMun) selMun.onchange = async (e) => { S.municipio = e.target.value; await recargar(); };
    rootEl.querySelector("#ivBuscar").oninput = (e) => { S.q = e.target.value; pintarUnidades(); };
    rootEl.querySelectorAll(".iv-chip").forEach(b => {
      b.onclick = () => {
        S.estado = b.dataset.estado;
        rootEl.querySelectorAll(".iv-chip").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.estado === S.estado)));
        pintarUnidades();
      };
    });
    pintarUnidades();
  }

  function pintarUnidades() {
    const ul = rootEl.querySelector("#ivUnidades");
    if (!ul) return;
    const lista = unidadesVisibles();
    if (!lista.length) {
      ul.innerHTML = `<li class="iv-vacio">No hay unidades con esa búsqueda o estado.</li>`;
      anunciar("Sin resultados.");
      return;
    }
    ul.innerHTML = lista.map(u => {
      const rep = S.capturas[u.clues];
      const est = estadoDe(rep);
      const accion = est === "corregido" ? "Revisar de nuevo" : est === "reportado" ? "Validar reporte" : "Capturar por la unidad";
      return `<li>
        <button type="button" class="iv-unidad" data-clues="${esc(u.clues)}">
          <span class="iv-unidad-txt">
            <span class="iv-sr">${esc(accion)}: </span>
            <span class="iv-clues">${esc(u.clues)}</span>
            <span class="iv-nombre">${esc(u.unidad)}</span>
            <span class="iv-dosis">${est === "pendiente" ? "Sin reporte esta semana" : `Dosis reportadas: <b>${totalDosis(rep)}</b>`}</span>
          </span>
          <span class="iv-unidad-estado">${insigniaHtml(rep)}<span class="material-symbols-rounded iv-flecha" aria-hidden="true">chevron_right</span></span>
        </button>
      </li>`;
    }).join("");
    ul.querySelectorAll(".iv-unidad").forEach(b => { b.onclick = () => abrirDetalle(b.dataset.clues); });
    anunciar(`Mostrando ${lista.length} unidad${lista.length === 1 ? "" : "es"}.`);
  }

  async function recargar() {
    cargando(true);
    try {
      await cargarSemana();
    } catch (e) {
      cfg.toast("No se pudo cargar la semana: " + (e.message || e), "error");
    }
    cargando(false);
    pintarLista();
  }

  function cargando(si) {
    if (!rootEl) return;
    if (si) rootEl.innerHTML = `<div class="iv-wrap"><p class="iv-cargando" role="status">Cargando…</p></div>`;
  }

  // ── Vista: detalle (vista en vivo + corrección) ──
  async function abrirDetalle(clues) {
    S.ultimaClues = clues;
    const u = S.todasUnidades.find(x => x.clues === clues);
    cargando(true);
    let todas = [];
    try {
      const { data, error } = await cfg.getClient().from("influenza_capturas").select("fecha, valores").eq("clues", clues).eq("anio_campana", S.camp.nombre);
      if (error) throw error;
      todas = data || [];
    } catch (e) {
      cfg.toast("No se pudo cargar el historial de la unidad: " + (e.message || e), "error");
      pintarLista();
      return;
    }
    S.detalle = { clues, unidad: u ? u.unidad : clues, municipio: u ? u.municipio : S.municipio, report: S.capturas[clues] || null, todas };
    pintarDetalle();
    const t = rootEl.querySelector("#ivDetTitulo");
    if (t) { t.focus(); window.scrollTo({ top: 0, behavior: "auto" }); }
  }

  function acumulados(d) {
    const a = {};
    rubros().forEach(rb => {
      a[rb.id] = d.todas.filter(r => r.fecha !== S.fecha).reduce((s, r) => s + Number((r.valores || {})[rb.id] || 0), 0);
    });
    return a;
  }

  function pintarDetalle() {
    const d = S.detalle;
    const rep = d.report;
    const metas = S.metas[d.clues] || {};
    const acum = acumulados(d);
    const orig = rep ? valoresOriginales(rep) : null;
    const semanaLabel = (S.semanas.find(s => s.fecha === S.fecha) || {}).label || S.fecha;
    const ult = rep ? ultimaEdicion(rep) : null;
    const est = estadoDe(rep);

    let vivo;
    if (!rep) {
      vivo = `<p class="iv-vivo-vacio">La unidad no ha enviado su reporte de esta semana. Si lo capturas aquí, quedará firmado por ti.</p>`;
    } else {
      const firmante = est === "corregido" ? ((ult && ult.firmado_por) || rep.editado_por) : "";
      vivo = `<dl class="iv-vivo">
          <div><dt>Dosis reportadas</dt><dd>${totalDosis(rep)}</dd></div>
          <div><dt>Capturó</dt><dd>${esc(rep.capturado_por || "—")}</dd></div>
          <div><dt>Estado</dt><dd>${est === "corregido" ? (ult && ult.sin_cambios ? "Validado sin cambios" : "Corregido") + (firmante ? " por " + esc(firmante) : "") : "Por validar"}</dd></div>
          ${rep.updated_at ? `<div><dt>Última actualización</dt><dd>${esc(larga(String(rep.updated_at).slice(0, 10)))}</dd></div>` : ""}
        </dl>`;
    }

    const grupos = {};
    rubros().forEach(rb => {
      const k = `${rb.categoria} - ${rb.grupo}`;
      (grupos[k] = grupos[k] || []).push(rb);
    });
    const sinMeta = [];
    let tarjetas = "";
    Object.entries(grupos).forEach(([titulo, lista]) => {
      if (lista.every(rb => !Number(metas[rb.id] || 0))) { sinMeta.push(titulo); return; }
      const filas = lista.map(rb => {
        const meta = Number(metas[rb.id] || 0);
        const val = rep && rep.valores && rep.valores[rb.id] !== undefined ? rep.valores[rb.id] : "";
        const regla = reglaDosis(rb, S.fecha);
        const bloqueada = meta === 0 || !!regla;
        const original = rep ? (orig && orig[rb.id] !== undefined ? orig[rb.id] : (rep.valores[rb.id] !== undefined ? rep.valores[rb.id] : 0)) : "—";
        const pct = meta > 0 ? Math.round(((acum[rb.id] + Number(val || 0)) / meta) * 100) : 0;
        const nombre = `${rb.grupo} · ${rb.edad}`;
        return `<div class="iv-rubro${bloqueada ? " iv-rubro--bloq" : ""}">
          <div class="iv-rubro-cab">
            <span class="iv-edad">${esc(rb.edad)}</span>
            ${regla ? `<span class="iv-pill">${esc(regla.etiqueta)}</span>` : (meta === 0 ? `<span class="iv-pill iv-pill--gris">Sin meta</span>` : "")}
          </div>
          <div class="iv-rubro-datos">
            <span>Meta anual <b>${meta || "—"}</b></span>
            <span>Capturó la unidad <b>${original}</b></span>
            <span>Acumulado otras semanas <b>${acum[rb.id]}</b></span>
          </div>
          <div class="iv-rubro-input">
            <label for="iv_${rb.id}">Valor validado<span class="iv-sr"> de ${esc(nombre)}</span></label>
            <input id="iv_${rb.id}" data-rubro="${rb.id}" type="number" inputmode="numeric" min="0" step="1" value="${esc(val)}"
              ${bloqueada ? `disabled placeholder="—"` : `placeholder="0"`} aria-describedby="ivp_${rb.id}">
          </div>
          <div class="iv-avance" id="ivp_${rb.id}">
            <span class="iv-avance-txt">${meta > 0 ? `Avance con este valor: <b id="ivpct_${rb.id}">${pct}%</b>` : "Sin meta asignada"}</span>
            <span class="iv-over" id="ivover_${rb.id}" aria-live="polite">${meta > 0 && pct > 100 ? "Supera la meta anual" : ""}</span>
          </div>
        </div>`;
      }).join("");
      tarjetas += `<section class="iv-grupo" aria-label="${esc(titulo)}"><h3>${esc(titulo)}</h3>${filas}</section>`;
    });

    const avisos = [];
    const vistos = {};
    rubros().forEach(rb => { const r = reglaDosis(rb, S.fecha); if (r && !vistos[r.tipo]) { vistos[r.tipo] = 1; avisos.push(r); } });

    rootEl.innerHTML = `
      <div class="iv-wrap" id="ivDetalle">
        <button type="button" class="iv-volver" id="ivVolver"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Volver al listado</button>
        <div class="iv-titulo">
          <h2 id="ivDetTitulo" tabindex="-1">${esc(d.unidad)}</h2>
          <p>${esc(d.clues)} · ${esc(semanaLabel)}</p>
        </div>
        <section class="iv-card" aria-label="Vista en vivo del reporte">
          <h3>Reporte de la unidad</h3>
          ${vivo}
        </section>
        <details class="iv-leyenda">
          <summary>¿Qué significa cada dato?</summary>
          <p><b>Meta anual:</b> dosis que debe aplicar la unidad en toda la campaña.</p>
          <p><b>Capturó la unidad:</b> cifra original enviada; no cambia.</p>
          <p><b>Acumulado otras semanas:</b> dosis de las demás semanas, sin contar esta.</p>
          <p><b>Valor validado:</b> la cifra de esta semana que queda registrada; es lo único que puedes editar.</p>
        </details>
        ${avisos.map(r => `<div class="iv-aviso"><b>${r.tipo === "segunda" ? "2ª dosis" : "1ª dosis"} no disponible esta semana.</b> ${esc(r.texto)}</div>`).join("")}
        <label class="iv-campo iv-firma"><span>Nombre de quien realiza/autoriza la corrección <i>(obligatorio)</i></span>
          <input id="ivNombre" type="text" autocomplete="name" required aria-required="true" placeholder="Nombre completo">
        </label>
        ${tarjetas}
        ${sinMeta.length ? `<div class="iv-aviso iv-aviso--info">Sin meta para esta unidad (no se capturan): ${esc(sinMeta.join("; "))}.</div>` : ""}
        <p class="iv-cambios" id="ivCambios" role="status" aria-live="polite"></p>
        <div class="iv-error" id="ivError" role="alert" tabindex="-1" hidden></div>
        <div class="iv-acciones">
          <button type="button" class="iv-btn iv-btn--sec" id="ivCancelar">Cancelar</button>
          <button type="button" class="iv-btn iv-btn--pri" id="ivGuardar">Validar sin cambios</button>
        </div>
      </div>`;

    const inputs = () => [...rootEl.querySelectorAll("input[data-rubro]:not([disabled])")];
    const cambios = () => inputs().filter(i => (parseInt(i.value, 10) || 0) !== Number((rep && rep.valores && rep.valores[i.dataset.rubro]) || 0)).length;
    const refrescar = () => {
      const n = cambios();
      const t = rootEl.querySelector("#ivCambios");
      const b = rootEl.querySelector("#ivGuardar");
      if (rep && n === 0) { t.textContent = "Sin cambios: se validará tal como lo capturó la unidad."; b.textContent = "Validar sin cambios"; }
      else if (rep) { t.textContent = `${n} rubro${n === 1 ? "" : "s"} modificado${n === 1 ? "" : "s"} respecto a lo capturado.`; b.textContent = "Guardar corrección"; }
      else { t.textContent = n ? `Se registrará un reporte nuevo con ${n} rubro${n === 1 ? "" : "s"}.` : "La unidad no tiene reporte esta semana: captura las dosis."; b.textContent = "Guardar captura"; }
      return n;
    };
    refrescar();

    rootEl.querySelector("#ivDetalle").addEventListener("input", (ev) => {
      const inp = ev.target;
      if (inp.id === "ivNombre") { inp.removeAttribute("aria-invalid"); return; }
      if (!inp.dataset || !inp.dataset.rubro) return;
      const id = inp.dataset.rubro;
      const meta = Number(metas[id] || 0);
      const v = parseInt(inp.value, 10) || 0;
      const pct = meta > 0 ? Math.round(((acum[id] + v) / meta) * 100) : 0;
      const pEl = rootEl.querySelector(`#ivpct_${id}`);
      const oEl = rootEl.querySelector(`#ivover_${id}`);
      if (pEl) pEl.textContent = `${pct}%`;
      const rebasa = meta > 0 && pct > 100;
      if (oEl) oEl.textContent = rebasa ? "Supera la meta anual" : "";
      if (rebasa) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
      refrescar();
    });

    const volver = () => { S.detalle = null; pintarLista(); const b = rootEl.querySelector(`.iv-unidad[data-clues="${S.ultimaClues}"]`); (b || rootEl.querySelector("#ivTitulo")).focus(); };
    rootEl.querySelector("#ivVolver").onclick = () => volver();
    rootEl.querySelector("#ivCancelar").onclick = () => {
      const sucio = cambios() > 0 || rootEl.querySelector("#ivNombre").value.trim() !== "";
      if (sucio && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos y volver al listado?")) return;
      volver();
    };
    rootEl.querySelector("#ivGuardar").onclick = () => guardar(metas, acum, cambios, volver);
  }

  function mostrarErrores(items) {
    const box = rootEl.querySelector("#ivError");
    box.innerHTML = `<strong>${items.length === 1 ? "Hay 1 problema" : `Hay ${items.length} problemas`} que corregir antes de guardar:</strong><ul>${items.map(i => `<li>${esc(i.msg)}</li>`).join("")}</ul>`;
    box.hidden = false;
    items.forEach(i => i.el && i.el.setAttribute("aria-invalid", "true"));
    const primero = items.find(i => i.el && !i.el.disabled);
    const destino = primero ? primero.el : box;
    destino.focus();
    if (destino.scrollIntoView) destino.scrollIntoView({ block: "center" });
  }

  async function guardar(metas, acum, cambios, volver) {
    const d = S.detalle;
    const rep = d.report;
    const box = rootEl.querySelector("#ivError");
    box.hidden = true;
    rootEl.querySelectorAll("[aria-invalid='true']").forEach(el => el.removeAttribute("aria-invalid"));

    const nombreEl = rootEl.querySelector("#ivNombre");
    const nombre = nombreEl.value.trim();
    const errores = [];
    if (!nombre) errores.push({ msg: "Escribe el nombre de quien realiza o autoriza la corrección; queda firmado en el historial.", el: nombreEl });

    const valores = {};
    rubros().forEach(rb => {
      const inp = rootEl.querySelector(`#iv_${rb.id}`);
      const nombreRubro = `${rb.grupo} · ${rb.edad}`;
      const raw = inp ? String(inp.value).trim() : "";
      if (inp && !inp.disabled && raw !== "" && !/^\d+$/.test(raw)) errores.push({ msg: `${nombreRubro}: escribe un número entero de 0 en adelante.`, el: inp });
      const v = inp ? parseInt(inp.value, 10) || 0 : 0;
      valores[rb.id] = v;
      const meta = Number(metas[rb.id] || 0);
      const previo = Number((rep && rep.valores && rep.valores[rb.id]) || 0);
      if (v > previo) {
        if (!meta) errores.push({ msg: `${nombreRubro}: la unidad no tiene meta asignada en este rubro.`, el: inp });
        const cal = reglaDosis(rb, S.fecha);
        if (cal) errores.push({ msg: `${nombreRubro}: ${cal.texto}`, el: inp });
      }
      if (meta > 0 && acum[rb.id] + v > meta) {
        errores.push({ msg: `${nombreRubro}: el acumulado (${acum[rb.id] + v}) supera la meta anual de ${meta}. Máximo esta semana: ${Math.max(0, meta - acum[rb.id])}.`, el: inp });
      }
    });
    if (errores.length) { mostrarErrores(errores); return; }

    const sinCambios = !!rep && cambios() === 0;
    const btn = rootEl.querySelector("#ivGuardar");
    const textoBtn = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const db = cfg.getClient();
      const perfil = cfg.getProfile();
      const { data: prev, error: e0 } = await db.from("influenza_capturas").select("valores, historial_ediciones").eq("clues", d.clues).eq("fecha", S.fecha).maybeSingle();
      if (e0) throw e0;
      let hist = [];
      if (prev && prev.historial_ediciones) hist = typeof prev.historial_ediciones === "string" ? JSON.parse(prev.historial_ediciones) : prev.historial_ediciones;
      const rol = String(perfil.rol || "").toUpperCase();
      hist.push({
        fecha_edicion: new Date().toISOString(),
        editado_por: rol,
        usuario: String(perfil.usuario || "DESCONOCIDO").toUpperCase(),
        firmado_por: nombre.slice(0, 120),
        sin_cambios: sinCambios,
        valores_anteriores: prev ? prev.valores : null
      });
      const registro = {
        clues: d.clues,
        unidad: d.unidad,
        municipio: d.municipio,
        fecha: S.fecha,
        anio_campana: S.camp.nombre,
        valores,
        capturado_por: String((rep && rep.capturado_por) || nombre).toUpperCase(),
        editado_por: rol,
        historial_ediciones: hist,
        updated_at: new Date().toISOString()
      };
      const { error } = await db.from("influenza_capturas").upsert(registro, { onConflict: "clues,fecha" });
      if (error) throw error;
      cfg.toast(sinCambios ? "Reporte validado sin cambios." : "Corrección guardada.", "success");
      await cargarSemana();
      volver();
      anunciar(sinCambios ? `Reporte de ${d.unidad} validado sin cambios.` : `Corrección de ${d.unidad} guardada.`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = textoBtn;
      mostrarErrores([{ msg: "No se pudo guardar: " + (e.message || e) + ". Revisa tu conexión e inténtalo de nuevo." }]);
    }
  }

  // ── API ──
  async function abrir() {
    if (!rootEl) return;
    if (!rolPermitido()) {
      rootEl.innerHTML = `<div class="iv-wrap"><p class="iv-vacio">Este panel es para perfiles de supervisión.</p></div>`;
      return;
    }
    if (S && S.listo) { S.detalle ? pintarDetalle() : pintarLista(); return; }
    cargando(true);
    try {
      S = S || { q: "", estado: "todas", detalle: null };
      await cargarBase();
      if (!S.municipios.length) throw new Error("Tu perfil no tiene municipios asignados.");
      const p = cfg.getProfile();
      S.municipio = S.municipios.find(m => norm(m) === norm(p.municipio)) || S.municipios[0];
      S.fecha = semanaPredeterminada(S.semanas);
      await cargarSemana();
      S.listo = true;
      pintarLista();
    } catch (e) {
      S = null;
      rootEl.innerHTML = `<div class="iv-wrap"><p class="iv-vacio" role="alert">No se pudo abrir el panel: ${esc(e.message || e)}</p><button type="button" class="iv-btn iv-btn--sec" id="ivReintentar">Reintentar</button></div>`;
      const r = rootEl.querySelector("#ivReintentar");
      if (r) r.onclick = () => abrir();
    }
  }

  root.MobileInfluenzaVal = {
    init(opciones) {
      cfg = opciones;
      rootEl = document.getElementById("infValRoot");
      S = null;
    },
    puedeUsar: rolPermitido,
    abrir,
    // Solo para pruebas
    _util: { generarSemanas, semanaPredeterminada, lunesDe, estadoDe, rangoSemana }
  };
})(typeof window !== "undefined" ? window : globalThis);
