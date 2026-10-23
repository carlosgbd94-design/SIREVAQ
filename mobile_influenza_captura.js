/**
 * Captura semanal de Influenza para la unidad (versión móvil, perfil UNIDAD).
 *
 * Mismo reporte y mismas reglas que «Captura» del escritorio (influenza_module.js), pensado para el celular:
 *   · Semana (lunes a domingo, fechada el viernes) con flechas anterior/siguiente y estado claro.
 *   · Resumen de la meta de la unidad: meta, aplicadas y avance, que se actualiza al capturar.
 *   · Cantidades por rubro con botones − / + grandes; muestra cuántas dosis le faltan a cada grupo.
 *   · «Sin movimiento», reglas de 1ª/2ª dosis, tope de meta y ventana de captura, con errores en línea.
 *   · Guardado con folio y lista de reportes anteriores.
 *
 * Datos: campanas, influenza_metas e influenza_capturas (mismas tablas y políticas que el escritorio).
 * COVID-19: si la unidad tiene meta en covid_metas aparece el selector Influenza | COVID-19; el reporte lleva
 *   Moderna y Pfizer por grupo (covid_capturas, reglas de covid_captura.js) y comparte semana, nombre y botón Guardar.
 * Calendario: influenza_reglas.js (window.InfluenzaReglas). Rubros: influenza_rubros.js.
 */
(function (root) {
  "use strict";

  let cfg = null;      // { getClient, getProfile, toast }
  let rootEl = null;
  let S = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = () => root.InfluenzaReglas;
  const rubros = () => root.INFLUENZA_RUBROS_MOVIL || [];
  const num = (v) => Number(v || 0);
  const CC = () => root.CovidCaptura;
  const esCovid = () => !!S && S.vac === "COVID";
  const MARCA_TXT = { MODERNA: "Moderna", PFIZER: "Pfizer" };
  const EDAD_COVID = {
    c1: "6 a 59 meses · 1ª dosis (0.25 mL)", c2: "6 a 59 meses · 2ª dosis (0.25 mL)",
    c3: "5 a 59 años con factores de riesgo", c4: "60 años y más", c5: "Personas embarazadas", c6: "Personal de salud"
  };
  const CLUES_HOSPITALES = { NHG: "QTSSA002901", HENM: "QTSSA001740" };   // el hospital toma la meta de su destino
  const nombreVac = () => (esCovid() ? "COVID-19" : "Influenza");
  const caps = () => (esCovid() ? S.covid.capturas : S.capturas);

  // ── Fechas ──
  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const suma = (f, n) => R().sumaDias(f, n);
  const lunesDe = (f) => suma(f, -((R().diaSemana(f) + 6) % 7));
  function isoWeek(f) {
    const [y, m, d] = f.split("-").map(Number);
    const t = new Date(y, m - 1, d);
    t.setDate(t.getDate() + 4 - (t.getDay() || 7));
    const y0 = new Date(t.getFullYear(), 0, 1);
    return Math.ceil((((t - y0) / 86400000) + 1) / 7);
  }
  function rangoTexto(f) {
    const r = R().rangoSemana(f, S.camp.fecha_inicio, S.camp.fecha_fin);
    return R().textoRango(r.desde, r.hasta);
  }
  function esCorte(f) {
    return R().cortes(S.camp.fecha_inicio, S.camp.fecha_fin).includes(f);
  }
  // Primer día en que se puede capturar la semana de `f` (ver influenzaSemanaAbre del escritorio)
  function semanaAbre(f) {
    const ini = S.camp.fecha_inicio;
    const lunes = lunesDe(f);
    let abre = lunes;
    if (!esCorte(f)) {
      const previos = R().cortes(ini, S.camp.fecha_fin).filter(c => c >= lunes && c < f);
      if (previos.length) abre = suma(previos[previos.length - 1], 1);
    }
    return ini && ini > abre ? ini : abre;
  }
  function diaCorto(f) {
    const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    return `${dias[R().diaSemana(f)]} ${R().fechaCorta(f)}`;
  }
  // null = se puede capturar (misma regla que el trigger de la base)
  function ventanaError(f) {
    const ini = S.camp.fecha_inicio, fin = S.camp.fecha_fin;
    const h = hoy();
    if (h < ini) return `La campaña de Influenza inicia el ${R().fechaLarga(ini)}. Aún no se pueden capturar reportes.`;
    if (f < ini || f > fin) return `La semana del ${rangoTexto(f)} queda fuera de la campaña (${R().fechaLarga(ini)} al ${R().fechaLarga(fin)}).`;
    const abre = semanaAbre(f);
    if (h < abre) return `La semana del ${rangoTexto(f)} aún no se puede capturar: se abre el ${diaCorto(abre)}.`;
    return null;
  }
  function generarSemanas() {
    const ini = S.camp.fecha_inicio, fin = S.camp.fecha_fin;
    const out = [];
    let d = ini;
    while (R().diaSemana(d) !== 5) d = suma(d, 1);
    for (; d <= fin; d = suma(d, 7)) out.push({ fecha: d });
    R().cortes(ini, fin).forEach(c => out.push({ fecha: c, corte: true }));
    out.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return out;
  }
  function semanaPredeterminada() {
    const h = hoy();
    const abiertas = S.semanas.filter(w => semanaAbre(w.fecha) <= h);
    return (abiertas.length ? abiertas[abiertas.length - 1] : S.semanas[0]).fecha;
  }

  // ── Datos derivados ──
  const reporteDe = (f) => caps().find(r => r.fecha === f) || null;
  const esSinMov = (r) => !!(r && (r.sin_movimiento === true || r.sin_movimiento === "SI"));
  const totalReporte = (r) => (esCovid()
    ? CC().totalDosis((r && r.valores) || {})
    : Object.values((r && r.valores) || {}).reduce((a, v) => a + num(v), 0));
  function acumuladoOtras(id) {
    return S.capturas.reduce((a, r) => (r.fecha !== S.fecha ? a + num((r.valores || {})[id]) : a), 0);
  }
  // COVID-19: acumulado de las demás semanas por grupo (Moderna + Pfizer suman contra la misma meta)
  function acumuladoCovid(r) {
    return S.covid.capturas.reduce((a, c) => (c.fecha !== S.fecha ? a + CC().porRubro(c.valores)[r] : a), 0);
  }
  const rubrosCovid = () => CC().RUBROS.filter(r => num(S.covid.metas[r]) > 0);
  const metaTotal = () => (esCovid()
    ? CC().RUBROS.reduce((a, r) => a + num(S.covid.metas[r]), 0)
    : Object.values(S.metas).reduce((a, v) => a + num(v), 0));
  function reglaCovid(r, f) {
    return CC().reglaRubro(r, f, S.camp.fecha_inicio, S.camp.fecha_fin);
  }
  function reglaDosis(rb, f) {
    return R().reglaDosis(rb.grupo, f, S.camp.fecha_inicio, S.camp.fecha_fin);
  }
  function estadoSemana(f) {
    const r = reporteDe(f);
    const err = ventanaError(f);
    if (r) return { id: "guardado", texto: esSinMov(r) ? "Guardado · sin movimiento" : "Guardado", editable: !err };
    if (err) return { id: "cerrada", texto: "Aún no abre", editable: false, motivo: err };
    return { id: "pendiente", texto: "Pendiente", editable: true };
  }
  // Un reporte ya guardado abre BLOQUEADO: las casillas solo se habilitan con «Editar» (modo edición) para no
  // cambiar un dato por accidente. Se sale al guardar, cancelar, cambiar de semana o de vacuna.
  function enEdicion(f) { return !!(S && S.edicion && S.edicion.fecha === f && S.edicion.vac === (S.vac || "INFLUENZA")); }
  function protegido(f) {
    f = f || (S && S.fecha);
    return !!f && !!reporteDe(f) && estadoSemana(f).editable && !enEdicion(f);
  }
  function etiquetaSemana(w) {
    const est = estadoSemana(w.fecha);
    const marca = est.id === "guardado" ? "✓ " : est.id === "pendiente" ? "• " : "";
    return `${marca}Sem. ${isoWeek(w.fecha)} · ${w.corte ? "corte: " : ""}${rangoTexto(w.fecha)}`;
  }
  function folioDe(r) {
    if (!r) return "";
    if (r.folio) return r.folio;
    return `${esCovid() ? "COV" : "INF"}-${String(r.fecha || "").replace(/-/g, "")}-${r.id ? String(r.id).slice(0, 8).toUpperCase() : "TEMP"}`;
  }

  // ── Datos remotos ──
  async function cargarBase() {
    const db = cfg.getClient();
    const { data: camps, error } = await db.from("campanas").select("*").ilike("nombre", "Campaña Influenza%").order("fecha_inicio", { ascending: false });
    if (error) throw error;
    S.camp = (camps || []).find(c => c.activo) || (camps || [])[0] || null;
    if (!S.camp) throw new Error("No hay una campaña de Influenza configurada.");
    S.semanas = generarSemanas();
  }
  async function cargarUnidad() {
    const db = cfg.getClient();
    const p = cfg.getProfile();
    const [m, c] = await Promise.all([
      db.from("influenza_metas").select("metas").eq("anio_campana", S.camp.nombre).eq("clues", p.clues),
      db.from("influenza_capturas").select("*").eq("anio_campana", S.camp.nombre).eq("clues", p.clues).order("fecha", { ascending: false })
    ]);
    if (m.error) throw m.error;
    if (c.error) throw c.error;
    S.metas = (m.data && m.data[0] && m.data[0].metas) || {};
    S.capturas = c.data || [];
    await cargarCovid(db, p);
  }
  // COVID-19 es opcional: si no hay meta (o la tabla no responde) la unidad solo ve Influenza
  async function cargarCovid(db, p) {
    S.covid = { metas: null, capturas: [] };
    try {
      const destino = Object.keys(CLUES_HOSPITALES).find(k => CLUES_HOSPITALES[k] === p.clues);
      const [m, c] = await Promise.all([
        db.from("covid_metas").select("clues,municipio,metas").eq("anio_campana", S.camp.nombre).or(`clues.eq.${p.clues},clues.is.null`),
        db.from("covid_capturas").select("*").eq("anio_campana", S.camp.nombre).eq("clues", p.clues).order("fecha", { ascending: false })
      ]);
      if (m.error || c.error || !CC()) return;
      const filas = m.data || [];
      const propia = filas.find(r => r.clues === p.clues);
      const delDestino = destino ? filas.find(r => !r.clues && String(r.municipio).toUpperCase() === destino) : null;
      const metas = (delDestino && delDestino.metas) || (propia && propia.metas) || null;
      if (metas && CC().RUBROS.some(r => num(metas[r]) > 0)) S.covid = { metas, capturas: c.data || [] };
    } catch (_) { /* sin COVID-19 visible */ }
    if (!S.covid.metas && S.vac === "COVID") S.vac = "INFLUENZA";
  }
  const hayCovid = () => !!(S && S.covid && S.covid.metas);

  // ── Render ──
  function anunciar(msg) {
    const el = rootEl && rootEl.querySelector("#icLive");
    if (!el) return;
    el.textContent = "";
    setTimeout(() => { el.textContent = msg; }, 50);
  }

  function pintar(opciones) {
    const op = opciones || {};
    const f = S.fecha;
    const rep = reporteDe(f);
    const est = estadoSemana(f);
    const idx = S.semanas.findIndex(w => w.fecha === f);
    const sinMovGuardado = esSinMov(rep);
    const reabierto = S.reabierto && S.reabierto.fecha === f ? S.reabierto.valor : null;
    if (S.sinMov == null || S.sinMovFecha !== f) {
      S.sinMov = rep ? sinMovGuardado : false;
      S.sinMovFecha = f;
    }
    if (reabierto != null) S.sinMov = reabierto;
    const protegida = protegido(f);
    const editable = est.editable && !protegida;

    // Avisos de calendario (una vez por tipo)
    const avisos = [];
    const vistos = {};
    if (!esCovid() && metaTotal() > 0) rubros().forEach(rb => { const r = reglaDosis(rb, f); if (r && !vistos[r.tipo]) { vistos[r.tipo] = 1; avisos.push(r); } });
    if (esCovid()) rubrosCovid().forEach(r => { const g = reglaCovid(r, f); if (g && !vistos[g.tipo]) { vistos[g.tipo] = 1; avisos.push(g); } });

    const grupos = {};
    rubros().forEach(rb => { (grupos[`${rb.categoria} - ${rb.grupo}`] = grupos[`${rb.categoria} - ${rb.grupo}`] || []).push(rb); });
    const sinMeta = [];
    let tarjetas = "";
    if (esCovid()) tarjetas = tarjetasCovid(editable);
    else Object.entries(grupos).forEach(([titulo, lista]) => {
      if (lista.every(rb => !num(S.metas[rb.id]))) { sinMeta.push(titulo); return; }
      let omitidas = 0;
      const filas = lista.map(rb => {
        const meta = num(S.metas[rb.id]);
        if (meta === 0) { omitidas++; return ""; }   // sin meta no se captura: no estorba en la lista
        const acum = acumuladoOtras(rb.id);
        const borr = S.borrador && S.borrador.fecha === f ? S.borrador.v[rb.id] : undefined;
        const val = borr !== undefined ? borr : (rep && rep.valores && rep.valores[rb.id] !== undefined ? rep.valores[rb.id] : "");
        const regla = reglaDosis(rb, f);
        const bloqueada = meta === 0 || !!regla;
        const deshab = !editable || bloqueada || S.sinMov;
        const nombre = `${rb.grupo}, ${rb.edad}`;
        return `<div class="ic-rubro${bloqueada ? " ic-rubro--bloq" : ""}" data-rubro="${rb.id}">
          <div class="ic-rubro-cab">
            <span class="ic-edad">${esc(rb.edad)}</span>
            ${regla ? `<span class="ic-pill">${esc(regla.etiqueta)}</span>` : (meta === 0 ? `<span class="ic-pill ic-pill--gris">Sin meta</span>` : "")}
          </div>
          <div class="ic-rubro-fila">
            <div class="ic-datos">
              <span>Meta <b>${meta || "—"}</b></span>
              <span>Antes <b>${acum}</b></span>
              <span class="ic-faltan" id="icf_${rb.id}"></span>
            </div>
            <div class="ic-stepper" role="group" aria-label="${esc(nombre)}">
              <button type="button" class="ic-mas-menos" data-paso="-1" data-rubro="${rb.id}" aria-label="Disminuir ${esc(nombre)}"${deshab ? " disabled" : ""}><span aria-hidden="true">−</span></button>
              <input id="ic_${rb.id}" data-rubro="${rb.id}" type="number" inputmode="numeric" min="0" step="1" value="${S.sinMov ? 0 : esc(val)}"
                aria-label="Dosis aplicadas, ${esc(nombre)}" placeholder="0"${deshab ? " disabled" : ""} aria-describedby="icf_${rb.id}">
              <button type="button" class="ic-mas-menos" data-paso="1" data-rubro="${rb.id}" aria-label="Aumentar ${esc(nombre)}"${deshab ? " disabled" : ""}><span aria-hidden="true">+</span></button>
            </div>
          </div>
          <div class="ic-barra-av" aria-hidden="true"><span id="icb_${rb.id}"></span></div>
        </div>`;
      }).join("");
      tarjetas += `<section class="ic-grupo" aria-label="${esc(titulo)}"><h3>${esc(titulo)}</h3>${filas}${omitidas ? `<p class="ic-nota">${omitidas} rango${omitidas === 1 ? "" : "s"} de edad sin meta (no se capturan).</p>` : ""}</section>`;
    });

    const semanasOpts = S.semanas.map(w => `<option value="${w.fecha}"${w.fecha === f ? " selected" : ""}>${esc(etiquetaSemana(w))}</option>`).join("");
    const guardados = caps().slice(0, 12);

    rootEl.innerHTML = `
      <div class="ic-wrap">
        <div class="ic-titulo">
          <h2 id="icTitulo" tabindex="-1">Temporada invernal</h2>
          <p>Reporte semanal de dosis de ${nombreVac()} aplicadas en tu unidad.</p>
        </div>
        ${hayCovid() ? `<p class="ic-vac-lead"><span class="material-symbols-rounded" aria-hidden="true">ac_unit</span>Tu unidad reporta <b>dos vacunas</b>. Elige cuál capturas esta semana.</p>
        <div class="ic-vac" role="group" aria-label="Vacuna a reportar">
          ${[["INFLUENZA", "Influenza", "vaccines"], ["COVID", "COVID-19", "coronavirus"]].map(([v, txt, ico]) => {
            const ya = (v === "COVID" ? S.covid.capturas : S.capturas || []).some(r => r.fecha === S.fecha);
            return `<button type="button" class="ic-vac-btn" data-vac="${v}" aria-pressed="${(v === "COVID") === esCovid()}"><span class="material-symbols-rounded" aria-hidden="true">${ico}</span><span class="ic-vac-txt"><b>${txt}</b><small>${ya ? "✓ Guardado esta semana" : "Sin reportar esta semana"}</small></span></button>`;
          }).join("")}
        </div>` : ""}
        ${op.exito ? `<div class="ic-exito" id="icExito" role="status" tabindex="-1">
            <span class="material-symbols-rounded" aria-hidden="true">task_alt</span>
            <div><b>Reporte guardado</b><span>Folio ${esc(op.exito.folio)} · ${op.exito.dosis} dosis esta semana${op.exito.avance != null ? ` · avance de la meta ${op.exito.avance}%` : ""}</span></div>
          </div>` : ""}

        <section class="ic-pasos" aria-labelledby="icPasosTit">
          <div class="ic-pasos-cab">
            <h3 id="icPasosTit">Tu reporte en 4 pasos</h3>
            <button type="button" class="ayuda-btn ic-ayuda" data-ayuda="influenza_captura" aria-label="Cómo funciona la captura de Influenza"><span class="material-symbols-rounded" aria-hidden="true">help</span></button>
          </div>
          <p class="ic-paso-actual" id="icPasoActual" role="status" aria-live="polite"></p>
          <ol class="ic-pasos-lista" id="icPasos"></ol>
        </section>

        <section class="ic-semana" aria-label="Semana del reporte">
          <button type="button" class="ic-nav" id="icAnt" aria-label="Semana anterior"${idx <= 0 ? " disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button>
          <label class="ic-sel"><span class="ic-sr">Semana del reporte</span>
            <select id="icSemana">${semanasOpts}</select>
          </label>
          <button type="button" class="ic-nav" id="icSig" aria-label="Semana siguiente"${idx >= S.semanas.length - 1 ? " disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
        </section>
        <p class="ic-estado ic-estado--${est.id}">
          <span class="ic-chip ic-chip--${est.id}">${esc(est.texto)}</span>
          <span>${esc(rangoTexto(f))}${rep ? ` · Folio ${esc(folioDe(rep))}` : ""}</span>
        </p>
        ${est.motivo ? `<div class="ic-aviso ic-aviso--cerrada" role="note"><span class="material-symbols-rounded" aria-hidden="true">lock_clock</span><span>${esc(est.motivo)}</span></div>` : ""}

        <section class="ic-resumen" aria-label="Avance de tu meta">
          <div class="ic-res-num"><span>Meta anual</span><b id="icMeta">${metaTotal() || "—"}</b></div>
          <div class="ic-res-num"><span>Aplicadas</span><b id="icAplicadas">0</b></div>
          <div class="ic-res-num"><span>Avance</span><b id="icAvance">—</b></div>
          <div class="ic-barra-total" role="progressbar" aria-label="Avance de la meta anual" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="icProgreso"><span id="icProgresoBarra"></span></div>
          <p class="ic-res-pie" id="icEstaSemana"></p>
        </section>

        ${protegida ? `<div class="ic-aviso ic-aviso--info" role="note"><b>Reporte guardado y protegido.</b> Para cambiar una cantidad toca <b>Editar</b> (lápiz flotante, abajo a la derecha).</div>` : ""}
        ${esCovid() ? `<div class="ic-aviso ic-aviso--info"><b>Moderna y Pfizer suman contra la misma meta.</b> Captura el total de la semana de cada marca; si guardas de nuevo esta semana, el reporte nuevo reemplaza al anterior.</div>` : ""}
        ${metaTotal() === 0 ? `<div class="ic-aviso"><b>Tu unidad no tiene meta asignada.</b> Puedes registrar la semana como «sin movimiento»; para capturar dosis pide a tu jurisdicción que asigne la meta.</div>` : ""}
        ${avisos.map(r => `<div class="ic-aviso"><b>${r.tipo === "segunda" ? "2ª dosis" : "1ª dosis"} no disponible esta semana.</b> ${esc(r.texto)}</div>`).join("")}

        <label class="ic-switch${S.sinMov ? " ic-switch--on" : ""}">
          <span class="ic-switch-txt"><b>Sin movimiento</b><span>No se aplicó ninguna dosis de ${esCovid() ? "COVID-19" : "influenza"} esta semana.</span></span>
          <input type="checkbox" id="icSinMov" role="switch"${S.sinMov ? " checked" : ""}${!editable || (rep && !sinMovGuardado) ? " disabled" : ""}>
        </label>
        ${rep && !sinMovGuardado ? `<p class="ic-nota">Este reporte ya tiene dosis: para ponerlo en ceros corrige las cantidades.</p>` : ""}

        <label class="ic-campo"><span>Nombre de quien reporta <i>(obligatorio)</i></span>
          <input id="icNombre" type="text" autocomplete="name" required aria-required="true" placeholder="Nombre completo" value="${esc(S.nombre)}"${editable ? "" : " disabled"}>
        </label>

        ${S.sinMov ? `<div class="ic-aviso ic-aviso--info">Se guardará el reporte con todos los grupos en cero.</div>` : tarjetas}
        ${!S.sinMov && sinMeta.length ? `<details class="ic-sinmeta"><summary>Grupos sin meta para tu unidad (${sinMeta.length})</summary><ul>${sinMeta.map(g => `<li>${esc(g)}</li>`).join("")}</ul></details>` : ""}

        <div class="ic-error" id="icError" role="alert" tabindex="-1" hidden></div>
        <p class="ic-guardar-nota" id="icGuardarNota">
          <span class="material-symbols-rounded" aria-hidden="true">save</span>
          <span>${protegida ? `Para modificar este reporte toca <b>Editar</b> (lápiz flotante).` : editable ? `Cuando termines, toca el botón <b>Guardar</b> flotante (abajo a la derecha).` : "Esta semana no se puede guardar todavía."}</span>
        </p>

        <details class="ic-historial"${guardados.length ? "" : " hidden"}>
          <summary>Mis reportes anteriores (${guardados.length})</summary>
          <ul>
            ${guardados.map(r => `<li><button type="button" class="ic-hist-item" data-fecha="${r.fecha}">
              <span><b>Semana ${isoWeek(r.fecha)}</b> · ${esc(rangoTexto(r.fecha))}</span>
              <span>${esSinMov(r) ? "Sin movimiento" : totalReporte(r) + " dosis"}</span>
            </button></li>`).join("")}
          </ul>
        </details>
        <div id="icLive" class="ic-sr" role="status" aria-live="polite"></div>
      </div>`;

    enlazar();
    recalcular();
    if (op.exito) { const e = rootEl.querySelector("#icExito"); if (e) e.focus(); }
  }

  // COVID-19: un grupo por rango de edad, con Moderna y Pfizer (Pfizer no aplica a menores de 5 años)
  function tarjetasCovid(editable) {
    const f = S.fecha;
    const rep = reporteDe(f);
    const borr = S.borrador && S.borrador.fecha === f ? S.borrador.v : {};
    const C = CC();
    const filas = rubrosCovid().map(r => {
      const meta = num(S.covid.metas[r]);
      const regla = reglaCovid(r, f);   // calendario: la 2ª dosis no va en el 1er mes de la campaña
      const marcas = C.MARCAS.map(m => {
        if (!C.RUBROS_MARCA[m].includes(r)) return "";
        const id = `cv_${m}_${r}`;
        const previo = rep && rep.valores && rep.valores[m] ? rep.valores[m][r] : "";
        const val = borr[id] !== undefined ? borr[id] : (previo > 0 ? previo : "");
        const deshab = !editable || S.sinMov || !!regla;
        const nombre = `${MARCA_TXT[m]}, ${EDAD_COVID[r]}`;
        return `<div class="ic-marca">
          <span class="ic-marca-nom">${MARCA_TXT[m]}</span>
          <div class="ic-stepper" role="group" aria-label="${esc(nombre)}">
            <button type="button" class="ic-mas-menos" data-paso="-1" data-rubro="${id}" aria-label="Disminuir ${esc(nombre)}"${deshab ? " disabled" : ""}><span aria-hidden="true">−</span></button>
            <input id="ic_${id}" data-rubro="${id}" data-marca="${m}" data-grupo="${r}" type="number" inputmode="numeric" min="0" step="1" value="${S.sinMov ? 0 : esc(val)}"
              aria-label="Dosis aplicadas, ${esc(nombre)}" placeholder="0"${deshab ? " disabled" : ""} aria-describedby="icf_cv_${r}">
            <button type="button" class="ic-mas-menos" data-paso="1" data-rubro="${id}" aria-label="Aumentar ${esc(nombre)}"${deshab ? " disabled" : ""}><span aria-hidden="true">+</span></button>
          </div>
        </div>`;
      }).join("");
      return `<div class="ic-rubro${regla ? " ic-rubro--bloq" : ""}" data-rubro="cv_${r}">
        <div class="ic-rubro-cab"><span class="ic-edad">${esc(EDAD_COVID[r])}</span>${regla ? `<span class="ic-pill">${esc(regla.etiqueta)}</span>` : ""}</div>
        <div class="ic-datos ic-datos--fila">
          <span>Meta <b>${meta}</b></span>
          <span>Antes <b>${acumuladoCovid(r)}</b></span>
          <span class="ic-faltan" id="icf_cv_${r}"></span>
        </div>
        ${marcas}
        <div class="ic-barra-av" aria-hidden="true"><span id="icb_cv_${r}"></span></div>
      </div>`;
    }).join("");
    return `<section class="ic-grupo" aria-label="COVID-19, dosis por marca"><h3>COVID-19 - Dosis por marca</h3>${filas}</section>`;
  }

  function leerCovid() {
    const v = { MODERNA: {}, PFIZER: {} };
    rootEl.querySelectorAll("input[data-marca]").forEach(i => {
      v[i.dataset.marca][i.dataset.grupo] = S.sinMov ? 0 : Math.max(0, parseInt(i.value, 10) || 0);
    });
    return CC().limpiar(v);
  }

  function recalcularCovid() {
    const C = CC();
    const v = leerCovid();
    const nuevo = C.porRubro(v);
    const rep = reporteDe(S.fecha);
    const antes = C.porRubro((rep && rep.valores) || {});
    let previas = 0;
    const esta = C.totalDosis(v);
    rubrosCovid().forEach(r => {
      const meta = num(S.covid.metas[r]);
      const acum = acumuladoCovid(r);
      previas += acum;
      const total = acum + nuevo[r];
      const quedan = meta - total;
      const falt = rootEl.querySelector(`#icf_cv_${r}`);
      const barra = rootEl.querySelector(`#icb_cv_${r}`);
      if (falt) {
        falt.textContent = quedan >= 0 ? `Faltan ${quedan}` : `Rebasa por ${-quedan}`;
        falt.classList.toggle("ic-faltan--mal", quedan < 0);
      }
      if (barra) {
        const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;
        barra.style.width = pct + "%";
        barra.className = total > meta ? "ic-barra--mal" : pct >= 85 ? "ic-barra--ok" : pct >= 50 ? "ic-barra--medio" : "";
      }
      const rebasa = total > meta && nuevo[r] > antes[r];
      rootEl.querySelectorAll(`input[data-grupo="${r}"]`).forEach(i => { if (rebasa) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); });
    });
    return { v, esta, previas };
  }

  // Lee lo capturado en pantalla y actualiza avances, faltantes y totales
  function leer() {
    if (esCovid()) return leerCovid();
    const v = {};
    rubros().forEach(rb => {
      const i = rootEl.querySelector(`#ic_${rb.id}`);
      v[rb.id] = S.sinMov ? 0 : Math.max(0, parseInt(i && i.value, 10) || 0);
    });
    return v;
  }

  function recalcular() {
    let v, esta = 0, previas = 0;
    const rep = reporteDe(S.fecha);
    if (esCovid()) {
      ({ v, esta, previas } = recalcularCovid());
    } else {
    v = leer();
    rubros().forEach(rb => {
      const meta = num(S.metas[rb.id]);
      const acum = acumuladoOtras(rb.id);
      esta += v[rb.id];
      previas += acum;
      const falt = rootEl.querySelector(`#icf_${rb.id}`);
      const barra = rootEl.querySelector(`#icb_${rb.id}`);
      const inp = rootEl.querySelector(`#ic_${rb.id}`);
      if (!falt || !inp) return;
      const total = acum + v[rb.id];
      const previo = num(rep && rep.valores && rep.valores[rb.id]);
      const rebasa = meta > 0 && total > meta && v[rb.id] > previo;
      if (meta > 0) {
        const quedan = meta - total;
        falt.textContent = quedan >= 0 ? `Faltan ${quedan}` : `Rebasa por ${-quedan}`;
        falt.classList.toggle("ic-faltan--mal", quedan < 0);
      } else {
        falt.textContent = "";
      }
      if (barra) {
        const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;
        barra.style.width = pct + "%";
        barra.className = total > meta && meta > 0 ? "ic-barra--mal" : pct >= 85 ? "ic-barra--ok" : pct >= 50 ? "ic-barra--medio" : "";
      }
      if (rebasa) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
    });
    }
    const mt = metaTotal();
    const aplicadas = previas + esta;
    const av = mt > 0 ? Math.round((aplicadas / mt) * 100) : null;
    const set = (id, t) => { const e = rootEl.querySelector(id); if (e) e.textContent = t; };
    set("#icAplicadas", String(aplicadas));
    set("#icAvance", av == null ? "—" : av + "%");
    const pg = rootEl.querySelector("#icProgreso");
    if (pg) pg.setAttribute("aria-valuenow", String(Math.min(100, av || 0)));
    const pb = rootEl.querySelector("#icProgresoBarra");
    if (pb) pb.style.width = Math.min(100, av || 0) + "%";
    set("#icEstaSemana", S.sinMov ? "Esta semana: sin movimiento." : `Esta semana: ${esta} dosis · acumulado anterior: ${previas}.`);
    S.ultimoTotal = { esta, sinMov: !!S.sinMov };
    pintarPasos();
    sincronizarHub();
    anunciarTotal();
    return { v, esta, av };
  }

  function enlazar() {
    const $ = (s) => rootEl.querySelector(s);
    $("#icSemana").onchange = (e) => cambiarSemana(e.target.value);
    $("#icAnt").onclick = () => { const i = S.semanas.findIndex(w => w.fecha === S.fecha); if (i > 0) cambiarSemana(S.semanas[i - 1].fecha, true); };
    $("#icSig").onclick = () => { const i = S.semanas.findIndex(w => w.fecha === S.fecha); if (i < S.semanas.length - 1) cambiarSemana(S.semanas[i + 1].fecha, true); };

    rootEl.querySelectorAll(".ic-mas-menos").forEach(b => {
      b.onclick = () => {
        const i = rootEl.querySelector(`#ic_${b.dataset.rubro}`);
        if (!i || i.disabled) return;
        i.value = String(Math.max(0, (parseInt(i.value, 10) || 0) + Number(b.dataset.paso)));
        recalcular();
        limpiarError();
      };
    });
    rootEl.querySelectorAll("input[data-rubro]").forEach(i => { i.oninput = () => { recalcular(); limpiarError(); }; });
    $("#icNombre").oninput = (e) => { S.nombre = e.target.value; e.target.removeAttribute("aria-invalid"); pintarPasos(); };

    rootEl.querySelectorAll(".ic-vac-btn").forEach(b => {
      b.onclick = () => {
        if ((b.dataset.vac === "COVID") === esCovid()) return;
        S.vac = b.dataset.vac === "COVID" ? "COVID" : "INFLUENZA";
        S.sinMov = null; S.reabierto = null; S.borrador = null; S.ultAnuncio = undefined; S.edicion = null;
        pintar();
        const nuevo = rootEl.querySelector(`.ic-vac-btn[data-vac="${S.vac}"]`); if (nuevo) nuevo.focus();
        anunciar(`${nombreVac()}.`);
      };
    });

    const sm = $("#icSinMov");
    if (sm) {
      sm.onchange = () => {
        // Al activar «sin movimiento» se recuerda lo escrito para no perderlo si se desactiva
        if (sm.checked) {
          const borr = {};
          rootEl.querySelectorAll("input[data-rubro]").forEach(i => { if (i.value !== "") borr[i.dataset.rubro] = i.value; });
          S.borrador = { fecha: S.fecha, v: borr };
        }
        S.reabierto = { fecha: S.fecha, valor: sm.checked };
        S.sinMov = sm.checked;
        pintar();
        const nuevo = rootEl.querySelector("#icSinMov"); if (nuevo) nuevo.focus();
      };
    }
    rootEl.querySelectorAll(".ic-hist-item").forEach(b => { b.onclick = () => { cambiarSemana(b.dataset.fecha, true); window.scrollTo({ top: 0, behavior: "auto" }); }; });
  }

  function cambiarSemana(f, enfocar) {
    S.fecha = f;
    S.sinMov = null;
    S.reabierto = null;
    S.borrador = null;
    S.edicion = null;
    pintar();
    const est = estadoSemana(f);
    anunciar(`Semana ${isoWeek(f)}, ${rangoTexto(f)}. ${est.texto}.`);
    if (enfocar) { const s = rootEl.querySelector("#icSemana"); if (s) s.focus(); }
  }

  function limpiarError() {
    const e = rootEl.querySelector("#icError");
    if (e) { e.hidden = true; e.innerHTML = ""; }
  }
  function mostrarError(items) {
    const box = rootEl.querySelector("#icError");
    box.innerHTML = `<strong>${items.length === 1 ? "Hay 1 problema" : `Hay ${items.length} problemas`} que corregir antes de guardar:</strong><ul>${items.map(i => `<li>${esc(i.msg)}</li>`).join("")}</ul>`;
    box.hidden = false;
    items.forEach(i => i.el && i.el.setAttribute("aria-invalid", "true"));
    // Aviso emergente: el usuario lo ve aunque el cuadro de errores quede fuera de pantalla
    if (cfg && cfg.toast) cfg.toast(esc(items[0].msg) + (items.length > 1 ? ` (y ${items.length - 1} más)` : ""), "error");
    const primero = items.find(i => i.el && !i.el.disabled);
    const dest = primero ? primero.el : box;
    dest.focus();
    if (dest.scrollIntoView) dest.scrollIntoView({ block: "center" });
  }

  async function guardar() {
    const f = S.fecha;
    limpiarError();
    rootEl.querySelectorAll("[aria-invalid='true']").forEach(e => e.removeAttribute("aria-invalid"));
    const errores = [];
    const cierre = ventanaError(f);
    if (cierre) { mostrarError([{ msg: cierre }]); return; }
    if (protegido(f)) { mostrarError([{ msg: "Este reporte ya está guardado. Toca Editar si necesitas modificarlo." }]); return; }

    const nombreEl = rootEl.querySelector("#icNombre");
    const nombre = nombreEl.value.trim();
    if (!nombre) errores.push({ msg: "Escribe el nombre de quien reporta la captura.", el: nombreEl });

    const rep = reporteDe(f);
    const { v } = recalcular();
    if (esCovid()) {
      if (!S.sinMov) {
        const acum = {};
        CC().RUBROS.forEach(r => { acum[r] = acumuladoCovid(r); });
        const reglasCov = {};
        CC().RUBROS.forEach(r => { reglasCov[r] = reglaCovid(r, f); });
        const val = CC().validar(v, S.covid.metas, acum, rep ? rep.valores : {}, reglasCov);
        if (val.error) errores.push({ msg: val.error, el: rootEl.querySelector("input[data-marca]:not(:disabled)") });
      }
    } else if (!S.sinMov) {
      // Un reporte en ceros solo se guarda con «Sin movimiento» (misma regla que en escritorio).
      if (Object.values(v).every(x => x === 0)) {
        errores.push({ msg: "No hay dosis capturadas. Si esta semana no hubo aplicaciones, activa «Sin movimiento» para guardar el reporte en ceros.", el: rootEl.querySelector("#icSinMov") || rootEl.querySelector("input[data-rubro]:not(:disabled)") });
      }
      rubros().forEach(rb => {
        const inp = rootEl.querySelector(`#ic_${rb.id}`);
        const nombreRubro = `${rb.grupo} ${rb.edad}`;
        const raw = inp ? String(inp.value).trim() : "";
        if (inp && !inp.disabled && raw !== "" && !/^\d+$/.test(raw)) errores.push({ msg: `${nombreRubro}: escribe un número entero de 0 en adelante.`, el: inp });
        const previo = num(rep && rep.valores && rep.valores[rb.id]);
        const meta = num(S.metas[rb.id]);
        if (v[rb.id] > previo) {
          if (!meta) errores.push({ msg: `${nombreRubro}: tu unidad no tiene meta asignada en este rubro.`, el: inp });
          const cal = reglaDosis(rb, f);
          if (cal) errores.push({ msg: `${nombreRubro}: ${cal.texto}`, el: inp });
          const acum = acumuladoOtras(rb.id);
          if (meta > 0 && acum + v[rb.id] > meta) {
            errores.push({ msg: `${nombreRubro}: con ${v[rb.id]} dosis superas la meta de tu unidad (${meta}). Máximo esta semana: ${Math.max(0, meta - acum)}.`, el: inp });
          }
        }
      });
    }
    if (errores.length) { mostrarError(errores); return; }

    S.guardando = true;
    sincronizarHub();
    try {
      const db = cfg.getClient();
      const p = cfg.getProfile();
      const tabla = esCovid() ? "covid_capturas" : "influenza_capturas";
      const { data: prev, error: e0 } = await db.from(tabla).select("valores, historial_ediciones").eq("clues", p.clues).eq("fecha", f).maybeSingle();
      if (e0) throw e0;
      let hist = [];
      if (prev && prev.historial_ediciones) hist = typeof prev.historial_ediciones === "string" ? JSON.parse(prev.historial_ediciones) : prev.historial_ediciones;
      hist.push({
        fecha_edicion: new Date().toISOString(),
        editado_por: "UNIDAD",
        usuario: String(p.usuario || "DESCONOCIDO").toUpperCase(),
        valores_anteriores: prev ? prev.valores : null
      });
      const registro = {
        clues: p.clues,
        unidad: p.unidad,
        municipio: p.municipio,
        fecha: f,
        anio_campana: S.camp.nombre,
        valores: v,
        capturado_por: nombre.toUpperCase(),
        editado_por: "UNIDAD",
        historial_ediciones: hist,
        sin_movimiento: !!S.sinMov,
        updated_at: new Date().toISOString()
      };
      const { data: guardado, error } = await db.from(tabla).upsert(registro, { onConflict: "clues,fecha" }).select("folio").maybeSingle();
      if (error) throw error;
      try { localStorage.setItem(`inf_nombre_${p.clues}`, nombre); } catch (_) { /* sin almacenamiento */ }
      await cargarUnidad();
      S.reabierto = null;
      S.sinMov = null;
      S.borrador = null;
      S.edicion = null;
      const guardadoRep = reporteDe(f);
      const dosis = esCovid() ? CC().totalDosis(v) : Object.values(v).reduce((a, x) => a + x, 0);
      const mt = metaTotal();
      const aplicadas = caps().reduce((a, r) => a + totalReporte(r), 0);
      const folio = (guardado && guardado.folio) || folioDe(guardadoRep);
      cfg.toast(`Reporte de ${nombreVac()} guardado · folio ${folio}`, "success");
      pintar({ exito: { folio, dosis, avance: mt > 0 ? Math.round((aplicadas / mt) * 100) : null } });
    } catch (e) {
      mostrarError([{ msg: "No se pudo guardar: " + (e.message || e) + ". Revisa tu conexión e inténtalo de nuevo." }]);
    } finally {
      S.guardando = false;
      sincronizarHub();
    }
  }

  // ── Tu reporte en 4 pasos (misma lógica que actualizarPasosInfluenza del escritorio) ──
  function pintarPasos() {
    const ol = rootEl && rootEl.querySelector("#icPasos");
    if (!ol || !S) return;
    const f = S.fecha;
    const est = estadoSemana(f);
    const rep = reporteDe(f);
    const nombreEl = rootEl.querySelector("#icNombre");
    const nombre = ((nombreEl && nombreEl.value) || S.nombre || "").trim();
    const hayDosis = rubros().some(rb => { const i = rootEl.querySelector(`#ic_${rb.id}`); return i && num(i.value) > 0; });
    const sinMov = !!S.sinMov;
    const abierta = est.editable;
    const pasos = [
      { titulo: "Elige la semana", ok: true, texto: `Semana ${isoWeek(f)} · ${rangoTexto(f)}` },
      { titulo: "Escribe tu nombre", ok: !!nombre, texto: nombre || "Quien reporta queda registrado en el reporte." },
      { titulo: "Captura las dosis", ok: sinMov || hayDosis || !!rep,
        texto: sinMov ? "Marcaste «Sin movimiento»: se guarda en ceros." : (rep ? "Ya hay dosis guardadas; puedes corregirlas." : "Anota lo aplicado esta semana. Si no hubo, usa «Sin movimiento».") },
      { titulo: "Guarda y recibe tu folio", ok: !!rep, texto: rep ? `Folio ${folioDe(rep)}` : "Con el botón Guardar flotante. Cada reporte recibe un folio único." }
    ];
    let activo = abierta ? pasos.findIndex(p => !p.ok) : -1;
    if (activo < 0) activo = pasos.length;

    ol.innerHTML = pasos.map((p, i) => {
      const bloqueado = !abierta && !p.ok;
      const clase = bloqueado ? "is-lock" : p.ok ? "is-done" : i === activo ? "is-active" : "";
      const estadoTxt = bloqueado ? "bloqueado" : p.ok ? "completado" : i === activo ? "paso actual" : "pendiente";
      return `<li class="ic-paso ${clase}"${i === activo && abierta ? ' aria-current="step"' : ""}>
        <span class="ic-paso-num" aria-hidden="true">${p.ok ? '<span class="material-symbols-rounded">check</span>' : i + 1}</span>
        <span class="ic-paso-cuerpo"><b>${esc(p.titulo)}</b><span>${esc(p.texto)}</span></span>
        <span class="ic-sr">${estadoTxt}</span>
      </li>`;
    }).join("");

    const cab = rootEl.querySelector("#icPasoActual");
    if (cab) {
      const msg = !abierta ? "Esta semana aún no se puede capturar."
        : activo >= pasos.length ? "Listo: reporte guardado. Puedes corregirlo mientras la semana esté abierta."
        : `Paso ${activo + 1} de ${pasos.length}: ${pasos[activo].titulo}`;
      if (cab.textContent !== msg) cab.textContent = msg;
    }
  }

  // ── Command hub (barra flotante de la app): estado, contador de dosis y guardar ──
  function sincronizarHub() {
    const hub = document.getElementById("globalCommandHub");
    if (!hub || !S || !S.listo || !rootEl) return;
    hub.classList.add("visible");
    const est = estadoSemana(S.fecha);
    const t = S.ultimoTotal || { esta: 0, sinMov: false };
    const rep = reporteDe(S.fecha);

    const chip = document.getElementById("hubStatusChip");
    const chipTxt = document.getElementById("hubStatusText");
    if (chip && chipTxt) {
      chip.style.display = "flex";
      const verde = "status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider";
      const rojo = "status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-wider";
      chipTxt.textContent = S.guardando ? "Guardando..." : est.id === "cerrada" ? "Aún no abre" : rep ? (enEdicion(S.fecha) ? "Editando" : "Reporte Guardado") : "Listo";
      chip.className = est.id === "cerrada" ? rojo : verde;
    }

    const contador = document.getElementById("hubCounter");
    if (contador) {
      contador.hidden = false;
      const n = t.sinMov ? 0 : t.esta;
      const num$ = contador.querySelector(".hub-counter-num");
      const etq = contador.querySelector(".hub-counter-etq");
      if (num$) num$.textContent = t.sinMov ? "0" : String(n);
      if (etq) etq.textContent = t.sinMov ? "sin mov." : (n === 1 ? "dosis" : "dosis");
    }

    const save = document.getElementById("hubSaveBtn");
    if (save) {
      const proteg = protegido(S.fecha);
      const bloqueado = !est.editable || !!S.guardando || proteg;
      save.disabled = bloqueado;
      save.style.setProperty("display", "flex", "important");
      save.style.background = bloqueado ? "#e2e8f0" : "";
      save.style.color = bloqueado ? "#475569" : "";
      save.style.pointerEvents = bloqueado ? "none" : "";
      const cuenta = t.sinMov ? "sin movimiento" : `${t.esta} dosis esta semana`;
      const label = !est.editable ? `Guardar reporte de ${nombreVac()}: la semana aún no se puede capturar`
        : proteg ? `Reporte de ${nombreVac()} guardado: toca Editar para modificarlo`
        : `${rep ? "Actualizar" : "Guardar"} reporte de ${nombreVac()}, ${cuenta}`;
      save.setAttribute("aria-label", label);
      save.title = label;
    }
    const mostrar = { hubEditBtn: protegido(S.fecha), hubCancelBtn: enEdicion(S.fecha) && !!rep };
    Object.keys(mostrar).forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      if (mostrar[id]) b.style.setProperty("display", "flex", "important"); else b.style.setProperty("display", "none", "important");
    });
  }

  function editar() {
    if (!S || !S.listo || !protegido(S.fecha)) return;
    S.edicion = { vac: S.vac || "INFLUENZA", fecha: S.fecha };
    pintar();
    const primero = Array.from(rootEl.querySelectorAll("input[data-rubro]")).find(i => !i.disabled);
    if (primero) primero.focus({ preventScroll: false });
    cfg.toast("Modo edición activado: corrige y toca Guardar para actualizar el reporte.", "success");
    anunciar("Modo edición activado. Las cantidades ya se pueden modificar.");
  }
  function cancelarEdicion() {
    if (!S || !S.listo || !enEdicion(S.fecha)) return;
    S.edicion = null; S.sinMov = null; S.reabierto = null; S.borrador = null;
    pintar();
    cfg.toast("Edición cancelada: el reporte quedó como estaba.", "error");
    anunciar("Edición cancelada. El reporte quedó como estaba.");
  }

  // Anuncia el total para lectores de pantalla sin hablar en cada tecla
  let _tAnuncio = null;
  function anunciarTotal() {
    clearTimeout(_tAnuncio);
    _tAnuncio = setTimeout(() => {
      const t = S && S.ultimoTotal;
      if (!t) return;
      const msg = t.sinMov ? "Sin movimiento." : `${t.esta} dosis esta semana.`;
      if (S.ultAnuncio !== undefined && S.ultAnuncio !== msg) anunciar(msg);   // la primera vez solo se registra
      S.ultAnuncio = msg;
    }, 900);
  }

  // ── API ──
  async function abrir() {
    if (!rootEl) return;
    const p = cfg.getProfile();
    if (!p || String(p.rol || "").toUpperCase() !== "UNIDAD" || !p.clues) {
      rootEl.innerHTML = `<div class="ic-wrap"><p class="ic-vacio">La captura de Influenza es para unidades de salud.</p></div>`;
      return;
    }
    if (!root.InfluenzaReglas) {
      rootEl.innerHTML = `<div class="ic-wrap"><p class="ic-vacio" role="alert">No se cargó el módulo de calendario. Recarga la página.</p></div>`;
      return;
    }
    if (S && S.listo) { pintar(); return; }
    const vacPrevia = S && S.vac;
    rootEl.innerHTML = `<div class="ic-wrap"><p class="ic-vacio" role="status">Cargando…</p></div>`;
    try {
      S = S || {};
      S.vac = vacPrevia || "INFLUENZA";
      await cargarBase();
      await cargarUnidad();
      let nombre = "";
      try { nombre = localStorage.getItem(`inf_nombre_${p.clues}`) || ""; } catch (_) { /* sin almacenamiento */ }
      S.nombre = nombre || p.nombre || "";
      S.fecha = semanaPredeterminada();
      S.listo = true;
      pintar();
    } catch (e) {
      S = null;
      rootEl.innerHTML = `<div class="ic-wrap"><p class="ic-vacio" role="alert">No se pudo abrir la captura de Influenza: ${esc(e.message || e)}</p><button type="button" class="ic-guardar" id="icReintentar">Reintentar</button></div>`;
      const r = rootEl.querySelector("#icReintentar");
      if (r) r.onclick = () => abrir();
    }
  }

  root.MobileInfluenzaCap = {
    init(opciones) { cfg = opciones; rootEl = document.getElementById("infCapRoot"); S = null; },
    puedeUsar() {
      const p = cfg && cfg.getProfile ? cfg.getProfile() : null;
      return !!p && String(p.rol || "").toUpperCase() === "UNIDAD" && !!p.clues;
    },
    abrir,
    guardar() { return S && S.listo ? guardar() : Promise.resolve(); },
    editar,
    cancelarEdicion,
    sincronizarHub
  };
})(typeof window !== "undefined" ? window : globalThis);
