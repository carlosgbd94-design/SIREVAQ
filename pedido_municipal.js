/**
 * pedido_municipal.js — El nivel MUNICIPAL captura el pedido de biológico de una unidad que no lo hizo.
 *
 * Reglas de negocio:
 *  - Se guarda con tipo_pedido = 'MUNICIPAL' (RPC pedido_municipal_guardar): Jurisdicción lo jala igual que cualquier
 *    pedido (por fecha), pero NO cuenta como cumplimiento de la unidad (todo el cumplimiento filtra 'MENSUAL').
 *  - Solo para unidades sin pedido propio en la fecha; si la unidad captura después, su pedido reemplaza al municipal.
 *  - Los parámetros (promedio, mínimo, máximo) salen de biologicos_params en el servidor.
 *
 * Integración (main.js): renderCaptureSummary() pinta el botón con PedidoMunicipal.botonHtml(fila) en cada pendiente
 * del Resumen de captura (pedido de biológico) y registra el contexto con PedidoMunicipal.setContexto(data, refrescar).
 */
(function (root) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normBio = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

  // Mismas reglas que el formulario de la unidad (main.js refreshBioAlerts).
  const MULT_10 = ["HEXAVALENTE", "NEUMOCOCICA 13", "NEUMOCOCICA 20"];
  const MULT_5 = ["ROTAVIRUS", "SRP"];
  const SIN_VALIDACION = ["INFLUENZA", "COVID-19", "COVID 19", "VPH", "VARICELA"]; // campañas: no se valida contra el promedio
  const multiploDe = (bio) => { const k = normBio(bio); return MULT_10.includes(k) ? 10 : MULT_5.includes(k) ? 5 : 1; };
  const esCampana = (bio) => SIN_VALIDACION.includes(normBio(bio));

  const num = (v) => { const t = String(v == null ? "" : v).trim(); return t === "" ? null : Number(t); };
  const fmt = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString("es-MX") : "—");

  /** Evalúa un renglón. Devuelve {nivel: 'pendiente'|'ok'|'aviso'|'error', msg, sugerido}. Puro (lo prueba Node). */
  function evaluar(fila, existenciaRaw, pedidoRaw) {
    const ex = num(existenciaRaw), pe = num(pedidoRaw);
    const prom = Number(fila.promedio_frascos || 0), mn = Number(fila.min_dosis || 0), mx = Number(fila.max_dosis || 0);
    const mult = multiploDe(fila.biologico);
    const camp = esCampana(fila.biologico);
    const falta = camp ? 0 : Math.max(0, prom - (ex || 0));
    const sugerido = Math.ceil(falta / mult) * mult;
    if (ex === null && pe === null) return { nivel: "pendiente", msg: "Pendiente", sugerido };
    if (ex === null || pe === null) return { nivel: "pendiente", msg: ex === null ? "Falta la existencia" : "Falta el pedido", sugerido };
    if (!Number.isFinite(ex) || !Number.isFinite(pe) || ex < 0 || pe < 0 || !Number.isInteger(pe)) return { nivel: "error", msg: "Cantidad inválida", sugerido };
    if (mult > 1 && pe > 0 && pe % mult !== 0) return { nivel: "error", msg: "Debe ser múltiplo de " + mult, sugerido };
    if (camp) return { nivel: "ok", msg: "Campaña", sugerido };
    const total = ex + pe;
    if (prom > 0 && total < prom) return { nivel: "aviso", msg: "Faltan " + fmt(prom - total) + " fr. para el promedio", sugerido };
    if (mx > 0 && total > mx) return { nivel: "aviso", msg: "Rebasa el máximo por " + fmt(total - mx) + " fr.", sugerido };
    return { nivel: "ok", msg: "Correcto", sugerido };
  }

  /** Totales del pedido para el resumen. Puro. */
  function resumen(filas, valores) {
    let existencia = 0, pedido = 0, promedio = 0, minimo = 0, maximo = 0, pendientes = 0, errores = 0, avisos = 0, conPedido = 0;
    filas.forEach((f, i) => {
      const v = valores[i] || {};
      const ev = evaluar(f, v.existencia, v.pedido);
      existencia += num(v.existencia) || 0;
      pedido += num(v.pedido) || 0;
      if ((num(v.pedido) || 0) > 0) conPedido++;
      promedio += Number(f.promedio_frascos || 0);
      minimo += Number(f.min_dosis || 0);
      maximo += Number(f.max_dosis || 0);
      if (ev.nivel === "pendiente") pendientes++;
      else if (ev.nivel === "error") errores++;
      else if (ev.nivel === "aviso") avisos++;
    });
    return { existencia, pedido, promedio, minimo, maximo, pendientes, errores, avisos, conPedido };
  }

  const api = { evaluar, resumen, multiploDe, esCampana, _normBio: normBio };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  /* ───────────────────────────── estilos ───────────────────────────── */
  const CSS = `
  #pmOverlay{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)}
  #pmOverlay.pm-open{display:flex}
  #pmOverlay .pm-card{width:min(860px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,.35);font-family:inherit;color:#0f172a}
  #pmOverlay .pm-head{padding:18px 22px 14px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:flex-start}
  #pmOverlay .pm-head h2{margin:0;font-size:17px;font-weight:900;line-height:1.25;color:#0f172a}
  #pmOverlay .pm-sub{margin-top:3px;font-size:12px;font-weight:700;color:#475569;display:flex;flex-wrap:wrap;gap:4px 10px}
  #pmOverlay .pm-sub code{font-family:monospace;font-size:11.5px}
  #pmOverlay .pm-x{margin-left:auto;flex:none}
  #pmOverlay button.pm-ib{min-height:0!important;width:36px!important;height:36px!important;padding:0!important;border:none!important;border-radius:10px!important;background:transparent!important;color:#334155!important;display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer;box-shadow:none!important}
  #pmOverlay .pm-aviso{margin:12px 22px 0;padding:10px 12px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:12.5px;font-weight:700;line-height:1.4;display:flex;gap:8px;align-items:flex-start}
  #pmOverlay .pm-aviso .material-symbols-rounded{font-size:19px;flex:none;margin-top:1px}
  #pmOverlay .pm-aviso.pm-ya{background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6}
  #pmOverlay .pm-aviso.pm-bloq{background:#fef2f2;border-color:#fecaca;color:#991b1b}
  #pmOverlay .pm-body{padding:12px 22px 6px;overflow:auto;flex:1 1 auto}
  #pmOverlay .pm-cols,#pmOverlay .pm-row{display:grid;grid-template-columns:minmax(120px,1.35fr) 64px 78px 92px 92px minmax(120px,1.2fr);gap:8px;align-items:center}
  #pmOverlay .pm-cols{padding:6px 10px;font-size:10.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#475569;position:sticky;top:0;background:#fff;z-index:1}
  #pmOverlay .pm-cols span{text-align:center}#pmOverlay .pm-cols span:first-child{text-align:left}
  #pmOverlay .pm-row{padding:8px 10px;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:7px;background:#fff}
  #pmOverlay .pm-row[data-nivel="error"]{border-color:#fca5a5;background:#fef2f2}
  #pmOverlay .pm-row[data-nivel="aviso"]{border-color:#fcd34d;background:#fffbeb}
  #pmOverlay .pm-row[data-nivel="ok"]{border-color:#86efac;background:#f0fdf4}
  #pmOverlay .pm-bio{font-size:13px;font-weight:900;line-height:1.2}
  #pmOverlay .pm-bio small{display:block;margin-top:2px;font-size:10.5px;font-weight:700;color:#64748b}
  #pmOverlay .pm-met{text-align:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;color:#0f172a}
  #pmOverlay .pm-met small{display:block;font-size:10px;font-weight:700;color:#64748b}
  #pmOverlay .pm-lbl{display:none}
  #pmOverlay input.pm-in{width:100%!important;height:40px!important;min-height:0!important;padding:0 6px!important;border:1.5px solid #94a3b8!important;border-radius:10px!important;background:#fff!important;background-image:none!important;color:#0f172a!important;font:900 16px/1 inherit!important;text-align:center!important;box-shadow:none!important;margin:0!important;-moz-appearance:textfield!important;appearance:textfield!important}
  #pmOverlay input.pm-in::-webkit-outer-spin-button,#pmOverlay input.pm-in::-webkit-inner-spin-button{-webkit-appearance:none!important;margin:0!important}
  #pmOverlay input.pm-in:focus{outline:3px solid #0369a1!important;outline-offset:1px;border-color:#0369a1!important}
  #pmOverlay input.pm-in:disabled{background:#f1f5f9!important;color:#64748b!important}
  #pmOverlay .pm-est{font-size:11.5px;font-weight:800;line-height:1.3;display:flex;flex-direction:column;gap:5px;align-items:flex-start}
  #pmOverlay .pm-est .pm-msg{display:inline-flex;gap:4px;align-items:center}
  #pmOverlay .pm-est .material-symbols-rounded{font-size:16px}
  #pmOverlay .pm-row[data-nivel="error"] .pm-msg{color:#991b1b}#pmOverlay .pm-row[data-nivel="aviso"] .pm-msg{color:#92400e}
  #pmOverlay .pm-row[data-nivel="ok"] .pm-msg{color:#166534}#pmOverlay .pm-row[data-nivel="pendiente"] .pm-msg{color:#64748b}
  #pmOverlay button.pm-sug{min-height:0!important;height:26px!important;padding:0 9px!important;border-radius:999px!important;border:1px solid #0c4a6e!important;background:#fff!important;color:#0c4a6e!important;font:800 11px/1 inherit!important;cursor:pointer;box-shadow:none!important}
  #pmOverlay .pm-barra{grid-column:1/-1;position:relative;height:8px;border-radius:999px;background:#e2e8f0;margin:2px 2px 0}
  #pmOverlay .pm-barra i{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:#0369a1;max-width:100%}
  #pmOverlay .pm-barra b{position:absolute;top:-3px;bottom:-3px;width:2px;background:#0f172a;border-radius:2px}
  #pmOverlay .pm-barra b[data-k="min"]{background:#b45309}#pmOverlay .pm-barra b[data-k="max"]{background:#991b1b}
  #pmOverlay .pm-leyenda{display:flex;flex-wrap:wrap;gap:4px 14px;padding:2px 12px 8px;font-size:11px;font-weight:700;color:#475569}
  #pmOverlay .pm-leyenda span::before{content:"";display:inline-block;width:10px;height:3px;margin-right:5px;vertical-align:middle;border-radius:2px;background:#0f172a}
  #pmOverlay .pm-leyenda .l-min::before{background:#b45309}#pmOverlay .pm-leyenda .l-max::before{background:#991b1b}#pmOverlay .pm-leyenda .l-tot::before{background:#0369a1;height:6px}
  #pmOverlay .pm-foot{padding:12px 22px 16px;border-top:1px solid #e2e8f0;background:#f8fafc}
  #pmOverlay .pm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px}
  #pmOverlay .pm-kpi{padding:8px 10px;border-radius:12px;background:#fff;border:1px solid #e2e8f0}
  #pmOverlay .pm-kpi b{display:block;font-size:19px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}
  #pmOverlay .pm-kpi span{font-size:10.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em}
  #pmOverlay .pm-kpi small{display:block;font-size:10.5px;font-weight:700;color:#64748b;margin-top:1px}
  #pmOverlay .pm-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  #pmOverlay .pm-estado{font-size:12px;font-weight:800;color:#475569;flex:1 1 180px}
  #pmOverlay button.pm-btn{min-height:0!important;height:42px!important;padding:0 18px!important;border-radius:12px!important;font:800 13.5px/1 inherit!important;cursor:pointer;box-shadow:none!important;display:inline-flex!important;align-items:center;gap:6px}
  #pmOverlay button.pm-btn.pm-pri{background:#0c4a6e!important;color:#fff!important;border:1px solid #0c4a6e!important}
  #pmOverlay button.pm-btn.pm-sec{background:#fff!important;color:#0f172a!important;border:1px solid #94a3b8!important}
  #pmOverlay button.pm-btn.pm-pel{background:#fff!important;color:#991b1b!important;border:1px solid #fca5a5!important}
  #pmOverlay button.pm-btn:disabled{opacity:.5;cursor:not-allowed}
  #pmOverlay button:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  #pmOverlay .pm-carga{padding:34px 10px;text-align:center;font-weight:700;color:#475569}
  @media (hover:hover) and (pointer:fine){#pmOverlay button.pm-ib:hover{background:#f1f5f9!important}#pmOverlay button.pm-sug:hover{background:#f0f9ff!important}}
  @media (max-width:680px){
    #pmOverlay{padding:0;align-items:flex-end}
    #pmOverlay .pm-card{max-height:100dvh;height:100dvh;border-radius:0}
    #pmOverlay .pm-cols{display:none}
    #pmOverlay .pm-row{grid-template-columns:1fr 1fr;gap:8px 10px}
    #pmOverlay .pm-bio{grid-column:1/-1}
    #pmOverlay .pm-met{display:flex;justify-content:space-between;align-items:baseline;text-align:left}
    #pmOverlay .pm-met small{display:inline;font-size:11px}
    #pmOverlay .pm-lbl{display:block;font-size:10.5px;font-weight:800;color:#475569;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
    #pmOverlay .pm-est{grid-column:1/-1}
  }
  @media (prefers-reduced-motion:no-preference){#pmOverlay.pm-open .pm-card{animation:pmIn .18s ease-out}@keyframes pmIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}
  #faltantesTbody td button.pm-icon-btn{display:inline-flex!important;align-items:center;justify-content:center;width:30px!important;height:30px!important;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;border:none!important;border-radius:8px!important;background:transparent!important;color:#0c4a6e!important;cursor:pointer;box-shadow:none!important;transition:transform .2s,filter .2s}
  #faltantesTbody td button.pm-icon-btn .material-symbols-rounded{font-size:22px!important}
  #faltantesTbody td button.pm-icon-btn.pm-hecho{color:#7c3aed!important}
  #faltantesTbody td button.pm-icon-btn:focus-visible{outline:3px solid #0369a1!important;outline-offset:2px}
  @media (hover:hover) and (pointer:fine){#faltantesTbody td button.pm-icon-btn:hover{transform:translateY(-2px);filter:drop-shadow(0 3px 4px rgba(12,74,110,.35))}}
  `;
  function inyectarCss() {
    if (document.getElementById("pmStyles")) return;
    const st = document.createElement("style");
    st.id = "pmStyles";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ───────────────────────────── estado ───────────────────────────── */
  let ctx = { data: null, refrescar: null };
  let S = null; // {clues, fecha, filas, form, guardando}

  const toast = (msg, ok, tipo) => { if (typeof root.showToast === "function") root.showToast(msg, ok, tipo || (ok ? "good" : "bad")); };
  const sb = () => root.supabase;
  const fechaBonita = (ymd) => { try { return typeof root.formatAppDate === "function" ? root.formatAppDate(ymd) : ymd; } catch (e) { return ymd; } };

  // USER es una variable global de main.js (puede ser let/var, no siempre propiedad de window)
  function rolActual() { try { return String((typeof USER !== "undefined" && USER && USER.rol) || "").toUpperCase(); } catch (e) { return ""; } }
  const puede = () => ["MUNICIPAL", "ADMIN"].includes(rolActual());

  /** Botón que va bajo el nombre de la unidad en la tabla de pendientes del Resumen de captura. */
  function botonHtml(fila, data) {
    if (!puede() || !data || data.tipo !== "BIO" || data.es_extraordinario) return "";
    inyectarCss();   // el botón se pinta antes de abrir el modal
    const hecho = !!fila.capturado_municipio;
    const nombre = (hecho ? "Pedido capturado por el municipio: corregir" : "Capturar el pedido de la unidad") + " (" + (fila.unidad || fila.clues) + ")";
    return `<button type="button" class="pm-icon-btn${hecho ? " pm-hecho" : ""}" data-pm-clues="${esc(fila.clues)}" data-pm-unidad="${esc(fila.unidad)}" ` +
      `data-hint="${hecho ? "Pedido capturado por el municipio · corregir" : "Capturar el pedido de esta unidad"}" aria-label="${esc(nombre)}">` +
      `<span class="material-symbols-rounded" aria-hidden="true">${hecho ? "edit_note" : "add_task"}</span></button>`;
  }

  function setContexto(data, refrescar) { ctx = { data, refrescar }; }

  function alDarClick(ev) {
    const b = ev.target.closest && ev.target.closest("button[data-pm-clues]");
    if (!b) return;
    ev.preventDefault();
    abrir(b.dataset.pmClues, b.dataset.pmUnidad || "");
  }
  function enganchar() {
    const t = document.getElementById("faltantesTbody");
    if (t && !t.dataset.pmListo) { t.dataset.pmListo = "1"; t.addEventListener("click", alDarClick); }
  }

  /* ───────────────────────────── modal ───────────────────────────── */
  function overlay() {
    let o = document.getElementById("pmOverlay");
    if (o) return o;
    inyectarCss();
    o = document.createElement("div");
    o.id = "pmOverlay";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.setAttribute("aria-labelledby", "pmTitulo");
    o.addEventListener("mousedown", (e) => { if (e.target === o) cerrar(); });
    document.body.appendChild(o);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && o.classList.contains("pm-open")) cerrar(); });
    return o;
  }
  let foco = null;
  function cerrar() {
    const o = document.getElementById("pmOverlay");
    if (!o) return;
    o.classList.remove("pm-open");
    S = null;
    if (foco && foco.focus) { try { foco.focus(); } catch (e) { /* noop */ } }
  }

  async function abrir(clues, unidad) {
    const data = ctx.data;
    if (!puede() || !data) return;
    const fecha = data.fecha_ordinaria;
    if (!fecha) return toast("No se pudo determinar la fecha del pedido", false, "warn");
    foco = document.activeElement;
    const o = overlay();
    o.innerHTML = `<div class="pm-card"><div class="pm-head"><div><h2 id="pmTitulo">${esc(unidad || clues)}</h2></div>
      <button type="button" class="pm-ib pm-x" aria-label="Cerrar" data-pm-cerrar><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      <div class="pm-carga" role="status">Cargando parámetros de la unidad…</div></div>`;
    o.classList.add("pm-open");
    o.querySelector("[data-pm-cerrar]").onclick = cerrar;
    const x = o.querySelector("[data-pm-cerrar]"); if (x) x.focus();

    const { data: form, error } = await sb().rpc("pedido_municipal_formulario", { p_clues: clues, p_fecha: fecha });
    if (error || !form) {
      cerrar();
      return toast((error && error.message) || "No se pudo abrir el formulario", false, "bad");
    }
    S = { clues, fecha, filas: form.filas || [], form, guardando: false };
    pintar();
  }

  function valoresActuales() {
    const o = document.getElementById("pmOverlay");
    return S.filas.map((_, i) => ({
      existencia: (o.querySelector(`input[data-pm-i="${i}"][data-pm-k="ex"]`) || {}).value,
      pedido: (o.querySelector(`input[data-pm-i="${i}"][data-pm-k="pe"]`) || {}).value
    }));
  }

  function pintar() {
    const o = document.getElementById("pmOverlay");
    const f = S.form;
    const bloqueado = !!f.unidad_ya_capturo;
    const yaMunicipal = !!f.municipal_ts;
    const filasHtml = S.filas.map((r, i) => {
      const camp = esCampana(r.biologico);
      const mult = multiploDe(r.biologico);
      const ex = r.existencia_actual_frascos, pe = r.pedido_frascos;
      return `<div class="pm-row" data-i="${i}" data-nivel="pendiente">
        <div class="pm-bio">${esc(r.biologico)}<small>${camp ? "Campaña: sin validación de promedio" : (mult > 1 ? "Múltiplos de " + mult : "&nbsp;")}</small></div>
        <div class="pm-met"><span class="pm-lbl">Promedio</span>${camp ? "N/A" : fmt(Number(r.promedio_frascos || 0))}<small>fr.</small></div>
        <div class="pm-met"><span class="pm-lbl">Mín / Máx</span>${camp ? "N/A" : fmt(Number(r.min_dosis || 0)) + " / " + fmt(Number(r.max_dosis || 0))}</div>
        <div><label class="pm-lbl" for="pmEx${i}">Existencia</label><input id="pmEx${i}" class="pm-in" type="number" min="0" step="1" inputmode="numeric" data-pm-i="${i}" data-pm-k="ex" value="${ex == null ? "" : esc(ex)}" placeholder="0" ${bloqueado ? "disabled" : ""} aria-label="Existencia de ${esc(r.biologico)}"></div>
        <div><label class="pm-lbl" for="pmPe${i}">Pedido</label><input id="pmPe${i}" class="pm-in" type="number" min="0" step="1" inputmode="numeric" data-pm-i="${i}" data-pm-k="pe" value="${pe == null ? "" : esc(pe)}" placeholder="0" ${bloqueado ? "disabled" : ""} aria-label="Pedido de ${esc(r.biologico)}"></div>
        <div class="pm-est" data-pm-est="${i}"></div>
        ${camp ? "" : `<div class="pm-barra" aria-hidden="true" data-pm-barra="${i}"></div>`}
      </div>`;
    }).join("");

    o.innerHTML = `<div class="pm-card">
      <div class="pm-head"><div>
        <h2 id="pmTitulo">Pedido de ${esc(f.unidad || S.clues)}</h2>
        <div class="pm-sub"><code>${esc(S.clues)}</code><span>${esc(f.municipio || "")}</span><span>Pedido del ${esc(fechaBonita(S.fecha))}</span></div></div>
        <button type="button" class="pm-ib pm-x" aria-label="Cerrar" data-pm-cerrar><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      ${bloqueado
        ? `<div class="pm-aviso pm-bloq" role="alert"><span class="material-symbols-rounded" aria-hidden="true">lock</span><span>La unidad ya capturó su propio pedido de esta fecha. No se puede sustituir desde el municipio.</span></div>`
        : yaMunicipal
          ? `<div class="pm-aviso pm-ya" role="note"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><span>Este pedido ya lo capturó el municipio${f.municipal_nombre ? " (" + esc(f.municipal_nombre) + ")" : ""}. Puedes corregirlo; si la unidad captura el suyo después, lo reemplaza.</span></div>`
          : `<div class="pm-aviso" role="note"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Capturas el pedido a nombre de la unidad para que Jurisdicción lo pueda jalar. <b>No cuenta como cumplimiento de la unidad</b>: sigue como pendiente.</span></div>`}
      ${f.requisicion_vinculada && !bloqueado
        ? `<div class="pm-aviso" style="background:#fffbeb;border-color:#fcd34d;color:#92400e" role="note"><span class="material-symbols-rounded" aria-hidden="true">sync_problem</span><span>El pedido de esta fecha ya se trajo a una requisición. Lo que captures aquí no la actualiza sola: a Jurisdicción le aparecerá un aviso en Requisiciones para que vuelva a traer el pedido.</span></div>` : ""}
      <div class="pm-body">
        <div class="pm-cols" aria-hidden="true"><span>Biológico</span><span>Promedio</span><span>Mín / Máx</span><span>Existencia</span><span>Pedido</span><span style="text-align:left">Revisión</span></div>
        ${filasHtml || `<div class="pm-carga">Esta unidad no tiene biológicos configurados en Parámetros.</div>`}
        <div class="pm-leyenda" aria-hidden="true"><span class="l-tot">Existencia + pedido</span><span class="l-min">Mínimo</span><span>Promedio</span><span class="l-max">Máximo</span></div>
      </div>
      <div class="pm-foot">
        <div class="pm-kpis" id="pmKpis" aria-live="polite"></div>
        <div class="pm-acts">
          <div class="pm-estado" id="pmEstado" role="status"></div>
          ${yaMunicipal && !bloqueado ? `<button type="button" class="pm-btn pm-pel" data-pm-quitar>Quitar pedido</button>` : ""}
          <button type="button" class="pm-btn pm-sec" data-pm-cerrar>Cancelar</button>
          <button type="button" class="pm-btn pm-pri" data-pm-guardar ${bloqueado ? "disabled" : ""}>${yaMunicipal ? "Guardar cambios" : "Guardar pedido"}</button>
        </div>
      </div></div>`;

    o.querySelectorAll("[data-pm-cerrar]").forEach((b) => { b.onclick = cerrar; });
    o.querySelectorAll("input.pm-in").forEach((inp) => inp.addEventListener("input", refrescarVista));
    const g = o.querySelector("[data-pm-guardar]"); if (g) g.onclick = guardar;
    const q = o.querySelector("[data-pm-quitar]"); if (q) q.onclick = quitar;
    refrescarVista();
    const primero = o.querySelector("input.pm-in:not(:disabled)") || o.querySelector("[data-pm-cerrar]");
    if (primero) primero.focus();
  }

  const ICONO = { ok: "check_circle", aviso: "warning", error: "error", pendiente: "schedule" };

  function refrescarVista() {
    if (!S) return;
    const o = document.getElementById("pmOverlay");
    const vals = valoresActuales();
    S.filas.forEach((r, i) => {
      const ev = evaluar(r, vals[i].existencia, vals[i].pedido);
      const row = o.querySelector(`.pm-row[data-i="${i}"]`);
      if (row) row.dataset.nivel = ev.nivel;
      const est = o.querySelector(`[data-pm-est="${i}"]`);
      if (est) {
        // Solo se sugiere cuando falta para el promedio o el múltiplo está mal, y la sugerencia cambia lo escrito
        const faltaProm = (num(vals[i].existencia) || 0) + (num(vals[i].pedido) || 0) < Number(r.promedio_frascos || 0);
        const mostrarSug = !esCampana(r.biologico) && ev.sugerido > 0 && (faltaProm || ev.nivel === "error") && String(ev.sugerido) !== String(vals[i].pedido).trim()
          && !S.form.unidad_ya_capturo && num(vals[i].existencia) !== null;
        est.innerHTML = `<span class="pm-msg"><span class="material-symbols-rounded" aria-hidden="true">${ICONO[ev.nivel]}</span>${esc(ev.msg)}</span>` +
          (mostrarSug ? `<button type="button" class="pm-sug" data-pm-sug="${i}" data-v="${ev.sugerido}" aria-label="Poner ${ev.sugerido} frascos de pedido en ${esc(r.biologico)}">Pedir ${ev.sugerido}</button>` : "");
      }
      // Barra: existencia + pedido contra el máximo (escala = el mayor de máximo y total), con marcas de mínimo, promedio y máximo
      const barra = o.querySelector(`[data-pm-barra="${i}"]`);
      if (barra) {
        const total = (num(vals[i].existencia) || 0) + (num(vals[i].pedido) || 0);
        const mn = Number(r.min_dosis || 0), pr = Number(r.promedio_frascos || 0), mx = Number(r.max_dosis || 0);
        const escala = Math.max(mx, pr, total, 1);
        const pct = (v) => Math.min(100, (v / escala) * 100).toFixed(1);
        barra.innerHTML = `<i style="width:${pct(total)}%"></i>` +
          (mn > 0 ? `<b data-k="min" style="left:${pct(mn)}%"></b>` : "") + (pr > 0 ? `<b data-k="prom" style="left:${pct(pr)}%"></b>` : "") + (mx > 0 ? `<b data-k="max" style="left:${pct(mx)}%"></b>` : "");
      }
    });
    o.querySelectorAll("button[data-pm-sug]").forEach((b) => {
      b.onclick = () => {
        const inp = o.querySelector(`input[data-pm-i="${b.dataset.pmSug}"][data-pm-k="pe"]`);
        if (inp) { inp.value = b.dataset.v; inp.focus(); refrescarVista(); }
      };
    });
    const t = resumen(S.filas, vals);
    const kpis = o.querySelector("#pmKpis");
    if (kpis) kpis.innerHTML =
      `<div class="pm-kpi"><span>Pedido total</span><b>${fmt(t.pedido)}</b><small>${t.conPedido} biológico${t.conPedido === 1 ? "" : "s"} con pedido</small></div>` +
      `<div class="pm-kpi"><span>Existencia</span><b>${fmt(t.existencia)}</b><small>frascos capturados</small></div>` +
      `<div class="pm-kpi"><span>Promedio</span><b>${fmt(t.promedio)}</b><small>consumo mensual</small></div>` +
      `<div class="pm-kpi"><span>Mín / Máx</span><b>${fmt(t.minimo)} / ${fmt(t.maximo)}</b><small>suma de la unidad</small></div>`;
    const est = o.querySelector("#pmEstado");
    const g = o.querySelector("[data-pm-guardar]");
    let txt = "", bloquea = false;
    if (t.errores) { txt = `${t.errores} renglón${t.errores === 1 ? "" : "es"} con error: corrígelo para guardar.`; bloquea = true; }
    else if (t.pendientes) { txt = `Faltan ${t.pendientes} renglón${t.pendientes === 1 ? "" : "es"} por llenar.`; bloquea = true; }
    else if (t.avisos) txt = `${t.avisos} renglón${t.avisos === 1 ? "" : "es"} con aviso (por debajo del promedio o sobre el máximo); se puede guardar.`;
    else txt = "Todo correcto.";
    if (est) est.textContent = txt;
    if (g && !S.form.unidad_ya_capturo) g.disabled = bloquea || S.guardando;
  }

  async function guardar() {
    if (!S || S.guardando) return;
    const vals = valoresActuales();
    const items = S.filas.map((r, i) => ({ biologico: r.biologico, existencia: num(vals[i].existencia) || 0, pedido: num(vals[i].pedido) || 0 }));
    const sinPedido = items.every((it) => it.pedido === 0);
    S.guardando = true;
    const g = document.querySelector("#pmOverlay [data-pm-guardar]");
    if (g) { g.disabled = true; g.textContent = "Guardando…"; }
    const { data, error } = await sb().rpc("pedido_municipal_guardar", { p_clues: S.clues, p_fecha: S.fecha, p_items: items, p_sin_pedido: sinPedido });
    if (error) {
      S.guardando = false;
      if (g) { g.disabled = false; g.textContent = "Guardar pedido"; }
      return toast(error.message || "No se pudo guardar el pedido", false, "bad");
    }
    toast(`Pedido guardado a nombre de la unidad (${fmt(Number((data || {}).frascos || 0))} fr.). No cuenta como su cumplimiento.`, true, "good");
    cerrar();
    if (typeof ctx.refrescar === "function") ctx.refrescar();
  }

  async function quitar() {
    if (!S || S.guardando) return;
    if (typeof root.confirm === "function" && !root.confirm("¿Quitar el pedido capturado por el municipio? La unidad volverá a quedar sin pedido.")) return;
    S.guardando = true;
    const { error } = await sb().rpc("pedido_municipal_quitar", { p_clues: S.clues, p_fecha: S.fecha });
    if (error) { S.guardando = false; return toast(error.message || "No se pudo quitar", false, "bad"); }
    toast("Pedido municipal quitado", true, "good");
    cerrar();
    if (typeof ctx.refrescar === "function") ctx.refrescar();
  }

  Object.assign(api, { puede, botonHtml, setContexto, enganchar, abrir });
  root.PedidoMunicipal = api;
})(typeof window !== "undefined" ? window : globalThis);
