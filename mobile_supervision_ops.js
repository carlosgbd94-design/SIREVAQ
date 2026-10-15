/* ============================================================================
   Móvil · operaciones de supervisión (cuelgan de «Más» en mobile_supervision.js):
   Parámetros, Jeringas, Pinol (seguimiento), Enviar aviso y Seguridad (ADMIN).
   Cada panel replica la regla de escritorio (misma tabla, mismas claves de upsert,
   mismas reglas de alcance) en una vista corta pensada para el celular.
   ============================================================================ */
(function (global) {
  "use strict";
  const SV = global.MobileSupervision;
  if (!SV || !SV.registrar) return;
  const A = SV.api;
  const { esc, norm } = A;

  const db = () => A.cfg().getClient();
  const perfil = () => A.cfg().getProfile() || {};
  const quien = () => perfil().usuario || perfil().nombre || "Desconocido";
  const aviso = (msg, tipo) => { const c = A.cfg(); if (c && c.toast) c.toast(msg, tipo === "error" ? "error" : "success"); };
  const ahoraIso = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, "0");
  const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fechaCorta = (v) => {
    if (!v) return "—";
    const d = new Date(String(v).length <= 10 ? v + "T12:00:00" : v);
    return isNaN(d) ? "—" : `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  };

  // ── Unidades en alcance (caché por sesión de panel) ──
  let UNIDADES = null;
  async function unidades(forzar) {
    if (UNIDADES && !forzar) return UNIDADES;
    const { data, error } = await db().from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
    if (error) throw error;
    UNIDADES = (data || []).filter(A.enAlcance).sort((a, b) =>
      String(a.municipio || "").localeCompare(String(b.municipio || ""), "es") ||
      String(a.unidad || "").localeCompare(String(b.unidad || ""), "es"));
    return UNIDADES;
  }

  const cargandoHtml = (t) => `<div class="sv-cargando" role="status" aria-live="polite"><div class="sv-indet" aria-hidden="true"><i></i></div><p>${esc(t)}</p></div>`;
  const errorHtml = (m, id) => `<p class="sv-vacio" role="alert">${esc(m)}</p><button type="button" class="sv-btn" id="${id}">Reintentar</button>`;

  // ═══════════════════════════════════════════════════════════════════════════
  // Editor de matriz por unidad (Parámetros y Jeringas)
  // ═══════════════════════════════════════════════════════════════════════════
  const OFICIAL_BIO = ["BCG", "HEPATITIS B", "HEXAVALENTE", "DPT", "ROTAVIRUS", "NEUMOCOCICA 13", "SRP", "SR", "VPH", "VARICELA", "HEPATITIS A", "TD", "TDPA", "INFLUENZA"];
  const DOSIS_POR_FRASCO = {
    "BCG": 10, "HEPATITIS B": 10, "HEXAVALENTE": 1, "DPT": 10, "ROTAVIRUS": 1, "NEUMOCOCICA 13": 1,
    "SRP": 1, "SR": 10, "VPH": 1, "VARICELA": 1, "HEPATITIS A": 1, "TD": 10, "TDPA": 1, "INFLUENZA": 10
  };
  const JERINGAS = [
    { key: "27x13", nombre: "27x13 mm", color: "Gris", caja: 100, uso: "BCG, SR, SRP y Varicela" },
    { key: "25x16", nombre: "25x16 mm", color: "Naranja", caja: 50, uso: "Hepatitis B (recién nacido)" },
    { key: "23x25", nombre: "23x25 mm", color: "Azul", caja: 50, uso: "DPT, Hepatitis A y Hexavalente" },
    { key: "22x32", nombre: "22x32 mm", color: "Negro", caja: 50, uso: "TD, Tdpa, Hep. B adulto y VPH" },
    { key: "terumo", nombre: "Terumo (insulina 30G)", color: "Verde / naranja", caja: 100, uso: "BCG, en paralelo a 27x13" }
  ];

  const CONF_MATRIZ = {
    PAR: {
      titulo: "Parámetros", etiqueta: "Parámetros de biológicos", tabla: "biologicos_params", conflicto: "clues,biologico",
      itemKey: "biologico", campos: { prom: "promedio_frascos", min: "min_dosis", max: "max_dosis" },
      unidadMedida: "frascos", etqMin: "Mín. dosis", etqMax: "Máx. dosis", etqProm: "Prom. frascos",
      items: OFICIAL_BIO.map((b) => ({ key: b, nombre: b, detalle: "" })),
      extra: (item, previo) => ({ multiplo_pedido: (previo && previo.multiplo_pedido) || DOSIS_POR_FRASCO[item.key] || 1 }),
      normaliza: (v) => String(v || "").toUpperCase().trim()
    },
    JER: {
      titulo: "Jeringas", etiqueta: "Cálculo de jeringas", tabla: "jeringas_params", conflicto: "clues,jeringa",
      itemKey: "jeringa", campos: { prom: "promedio_cajas", min: "min_cajas", max: "max_cajas" },
      unidadMedida: "cajas", etqMin: "Mín. cajas", etqMax: "Máx. cajas", etqProm: "Prom. cajas",
      items: JERINGAS.map((j) => ({ key: j.key, nombre: j.nombre, detalle: `${j.color} · caja de ${j.caja} · ${j.uso}` })),
      extra: () => ({}),
      normaliza: (v) => String(v || "").trim()
    }
  };

  function montarMatriz(id) {
    const C = CONF_MATRIZ[id];
    const E = { unidades: null, q: "", clues: null, filas: null, cargando: false, error: null, guardando: false };

    async function abrir(root) {
      E.root = root;
      if (!E.unidades) {
        root.innerHTML = A.encabezadoSub(C.titulo) + cargandoHtml("Cargando unidades…");
        A.enlazarVolver(root);
        try { E.unidades = await unidades(); E.error = null; }
        catch (e) { E.error = "No se pudieron cargar las unidades: " + (e.message || e); }
      }
      pintar();
    }

    function pintar() {
      const root = E.root;
      if (!root) return;
      if (E.error) {
        root.innerHTML = A.encabezadoSub(C.titulo) + errorHtml(E.error, "svMxRe");
        A.enlazarVolver(root);
        const re = root.querySelector("#svMxRe");
        if (re) re.onclick = () => { E.unidades = null; abrir(root); };
        return;
      }
      if (!E.clues) return pintarLista();
      pintarEditor();
    }

    function pintarLista() {
      const root = E.root;
      const q = norm(E.q);
      const lista = (E.unidades || []).filter((u) => !q || norm(u.unidad).includes(q) || norm(u.clues).includes(q) || norm(u.municipio).includes(q));
      root.innerHTML = A.encabezadoSub(C.titulo) + `
        <p class="sv-nota sv-nota--sup">Elige una unidad para ver y editar su ${esc(C.titulo.toLowerCase())}.</p>
        <label class="sv-buscar"><span class="sr-only">Buscar unidad</span><span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input type="search" id="svMxBuscar" placeholder="Buscar unidad o CLUES" value="${esc(E.q)}" autocomplete="off"></label>
        ${lista.length ? `<ul class="sv-lista sv-lista--sep">${lista.map((u) => `<li><button type="button" class="sv-unidad sv-unidad--btn" data-clues="${esc(u.clues)}">
          <div class="sv-u-txt"><b>${esc(u.unidad)}</b><small>${esc(u.municipio || "")} · ${esc(u.clues)}</small></div>
          <span class="material-symbols-rounded sv-chev" aria-hidden="true">chevron_right</span></button></li>`).join("")}</ul>`
          : `<p class="sv-vacio">Sin unidades con ese criterio.</p>`}`;
      A.enlazarVolver(root);
      root.querySelectorAll("[data-clues]").forEach((b) => { b.onclick = () => elegir(b.dataset.clues); });
      const bus = root.querySelector("#svMxBuscar");
      bus.oninput = () => {
        E.q = bus.value;
        const pos = bus.selectionStart;
        pintarLista();
        const n = root.querySelector("#svMxBuscar");
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* search */ } }
      };
    }

    async function elegir(clues) {
      E.clues = clues;
      E.filas = null;
      E.root.innerHTML = A.encabezadoSub(C.titulo) + cargandoHtml("Cargando valores…");
      A.enlazarVolver(E.root);
      try {
        const { data, error } = await db().from(C.tabla).select("*").eq("clues", clues);
        if (error) throw error;
        E.filas = new Map();
        (data || []).forEach((r) => E.filas.set(C.normaliza(r[C.itemKey]), r));
        E.error = null;
      } catch (e) {
        E.error = "No se pudieron cargar los valores: " + (e.message || e);
        E.clues = null;
      }
      pintar();
    }

    // Además de la lista oficial, muestra los biológicos que la unidad ya tiene en la tabla (p. ej. COVID-19, VSR):
    // así no quedan valores ocultos que nadie pueda revisar desde el celular.
    function itemsActuales() {
      const base = C.items.slice();
      if (C.itemKey !== "biologico" || !E.filas) return base;
      const conocidos = new Set(base.map((i) => C.normaliza(i.key)));
      E.filas.forEach((r) => {
        const n = C.normaliza(r[C.itemKey]);
        if (n && !conocidos.has(n)) { conocidos.add(n); base.push({ key: r[C.itemKey], nombre: String(r[C.itemKey]), detalle: "Registrado en la base" }); }
      });
      return base;
    }

    function valorDe(item, campo) {
      const r = E.filas && E.filas.get(C.normaliza(item.key));
      const v = r ? r[C.campos[campo]] : 0;
      return v == null ? 0 : v;
    }

    function pintarEditor() {
      const root = E.root;
      const u = (E.unidades || []).find((x) => x.clues === E.clues) || { unidad: E.clues, municipio: "", clues: E.clues };
      const ult = [...(E.filas ? E.filas.values() : [])].filter((r) => r.updated_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      root.innerHTML = `<div class="sv-sub"><button type="button" class="sv-back" id="svMxLista" aria-label="Volver a la lista de unidades"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span></button><h2>${esc(C.titulo)}</h2></div>
        <div class="sv-scope"><span class="material-symbols-rounded" aria-hidden="true">location_on</span><b>${esc(u.unidad)}</b><small>${esc(u.municipio || "")}</small></div>
        <p class="sv-nota sv-nota--sup">${ult ? `Última modificación: ${esc(fechaCorta(ult.updated_at))}${ult.updated_by ? " por " + esc(ult.updated_by) : ""}.` : "Aún no hay valores guardados para esta unidad."}</p>
        <ul class="sv-lista sv-lista--sep" id="svMxItems">${itemsActuales().map((it) => `
          <li class="sv-mx-item" data-key="${esc(it.key)}">
            <div class="sv-mx-nom"><b>${esc(it.nombre)}</b>${it.detalle ? `<small>${esc(it.detalle)}</small>` : ""}</div>
            <div class="sv-mx-campos">
              ${["prom", "min", "max"].map((c) => `<label class="sv-mx-campo"><span>${c === "prom" ? C.etqProm : c === "min" ? C.etqMin : C.etqMax}</span>
                <input type="number" inputmode="numeric" min="0" step="1" class="sv-num" data-campo="${c}" value="${valorDe(it, c)}"></label>`).join("")}
            </div>
          </li>`).join("")}</ul>
        <p class="sv-error" id="svMxErr" role="alert" hidden></p>
        <div class="sv-barra-accion"><button type="button" class="sv-btn sv-btn--pri" id="svMxGuardar">Guardar ${esc(C.titulo.toLowerCase())}</button></div>`;
      root.querySelector("#svMxLista").onclick = () => { E.clues = null; E.filas = null; pintar(); };
      root.querySelector("#svMxGuardar").onclick = () => guardar(u);
    }

    async function guardar(u) {
      if (E.guardando) return;
      const root = E.root;
      const err = root.querySelector("#svMxErr");
      err.hidden = true;
      root.querySelectorAll(".sv-mx-item").forEach((li) => li.classList.remove("sv-mx-item--mal"));
      const registros = [];
      const malos = [];
      let cambios = 0;
      root.querySelectorAll(".sv-mx-item").forEach((li) => {
        const item = itemsActuales().find((x) => x.key === li.dataset.key);
        const num = (c) => Math.max(0, parseInt(li.querySelector(`[data-campo="${c}"]`).value, 10) || 0);
        const prom = num("prom"), min = num("min"), max = num("max");
        if (max > 0 && min > max) { malos.push(item.nombre); li.classList.add("sv-mx-item--mal"); }
        const previo = E.filas && E.filas.get(C.normaliza(item.key));
        if (!previo || previo[C.campos.prom] !== prom || previo[C.campos.min] !== min || previo[C.campos.max] !== max) {
          if (previo || prom || min || max) cambios++;
        }
        registros.push({
          clues: u.clues, unidad: u.unidad || "Unidad", municipio: u.municipio || "*",
          [C.itemKey]: item.key,
          [C.campos.prom]: prom, [C.campos.min]: min, [C.campos.max]: max,
          ...C.extra(item, previo),
          activo: "SI", updated_by: quien(), updated_at: ahoraIso()
        });
      });
      if (malos.length) {
        err.textContent = `El mínimo no puede ser mayor que el máximo: ${malos.join(", ")}.`;
        err.hidden = false;
        return;
      }
      if (!cambios) { aviso("Sin cambios que guardar."); return; }
      E.guardando = true;
      const btn = root.querySelector("#svMxGuardar");
      btn.disabled = true; btn.textContent = "Guardando…";
      try {
        const { error } = await db().from(C.tabla).upsert(registros, { onConflict: C.conflicto });
        if (error) throw error;
        registros.forEach((r) => E.filas.set(C.normaliza(r[C.itemKey]), r));
        aviso(`${C.titulo} de ${u.unidad} guardados.`);
        E.clues = null; E.filas = null;
        pintar();
      } catch (e) {
        err.textContent = "No se pudo guardar: " + (e.message || e) + ". Revisa tu conexión e inténtalo de nuevo.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = `Guardar ${C.titulo.toLowerCase()}`;
      } finally {
        E.guardando = false;
      }
    }

    return { abrir };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pinol: seguimiento (la entrega se registra en escritorio, donde se notifica a la unidad)
  // ═══════════════════════════════════════════════════════════════════════════
  const PINOL = { filas: null, filtro: "PENDIENTE", q: "", cargando: false, error: null, entrega: null, guardando: false, errorEntrega: null };
  const ESTATUS = { PENDIENTE: ["Pendiente", "falta"], ENTREGADO: ["Por confirmar", "reg"], RECIBIDO: ["Recibido", "ok"] };

  async function abrirPinol(root) {
    PINOL.root = root;
    if (!PINOL.filas) {
      PINOL.cargando = true; PINOL.error = null; pintarPinol();
      try {
        const { data, error } = await db().from("pinol_solicitudes").select("*").order("timestamp_solicitud", { ascending: false }).limit(1000);
        if (error) throw error;
        PINOL.filas = (data || []).filter((r) => A.enAlcance({ unidad: r.unidad, municipio: r.municipio }));
      } catch (e) { PINOL.error = "No se pudo cargar Pinol: " + (e.message || e); }
      PINOL.cargando = false;
    }
    pintarPinol();
  }

  function tarjetaEntrega() {
    if (!PINOL.entrega || !PINOL.filas) return "";
    const r = PINOL.filas.find((x) => String(x.id) === String(PINOL.entrega));
    if (!r) return "";
    const pedidas = Math.min(4, Math.max(1, Number(r.solicitud_botellas) || 4));
    return `<div class="sv-confirma" id="svPinEnt" role="alertdialog" aria-labelledby="svPinEntT">
      <h3 id="svPinEntT">Registrar entrega · ${esc(r.unidad || r.clues)}</h3>
      <label class="sv-fld"><span>Botellas entregadas</span><select id="svPinCant" class="sv-sel">${[1, 2, 3, 4].map((n) => `<option value="${n}"${n === pedidas ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="sv-fld"><span>Entregado por</span><input type="text" id="svPinPor" class="sv-txt" maxlength="80" value="${esc(perfil().nombre || perfil().usuario || "")}"></label>
      <label class="sv-fld"><span>Fecha de entrega</span><input type="date" id="svPinFecha" class="sv-txt" value="${hoyYmd()}" max="${hoyYmd()}"></label>
      <label class="sv-fld"><span>Comentario (opcional)</span><textarea id="svPinCom" class="sv-txt sv-area" rows="3" maxlength="400"></textarea></label>
      <p class="sv-nota">Se avisará a la unidad que su solicitud fue entregada.</p>
      ${PINOL.errorEntrega ? `<p class="sv-error" role="alert">${esc(PINOL.errorEntrega)}</p>` : ""}
      <div class="sv-confirma-acc"><button type="button" class="sv-btn sv-btn--sec" id="svPinEntNo">Cancelar</button>
        <button type="button" class="sv-btn sv-btn--pri" id="svPinEntOk" aria-label="Confirmar entrega"${PINOL.guardando ? " disabled" : ""}>${PINOL.guardando ? "Guardando…" : "Confirmar"}</button></div>
    </div>`;
  }

  // Misma secuencia que escritorio (markPinolDelivered): marca ENTREGADO y reparte el aviso que
  // crea el trigger trg_notify_pinol_entregado a los usuarios de la unidad y su supervisión.
  async function registrarEntrega() {
    if (PINOL.guardando) return;
    const root = PINOL.root;
    const r = (PINOL.filas || []).find((x) => String(x.id) === String(PINOL.entrega));
    if (!r) return;
    const por = root.querySelector("#svPinPor").value.trim() || perfil().usuario;
    const fecha = root.querySelector("#svPinFecha").value || hoyYmd();
    const cant = Math.min(4, Math.max(1, parseInt(root.querySelector("#svPinCant").value, 10) || 4));
    const com = root.querySelector("#svPinCom").value.trim();
    PINOL.guardando = true; PINOL.errorEntrega = null; pintarPinol();
    try {
      const cambios = {
        estatus: "ENTREGADO", entregado_por: por, timestamp_entrega: ahoraIso(), fecha_entrega: fecha,
        comentario_entrega: com || null, solicitud_botellas: cant
      };
      const { data, error } = await db().from("pinol_solicitudes").update(cambios).eq("id", r.id).eq("estatus", "PENDIENTE").select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("Esta solicitud ya no está pendiente. Actualiza la lista.");
      Object.assign(r, cambios);
      // Mejor esfuerzo: mi copia del aviso de solicitud queda leída y la unidad recibe el aviso de entrega.
      try {
        await db().from("notificaciones_perfil").update({ status: "READ", read_ts: ahoraIso() })
          .eq("notificacion_id", "NOTIF:PINOL_REQ:" + r.id).eq("usuario", quien());
      } catch (e) { /* informativo */ }
      try {
        const nid = "NOTIF:PINOL_ENTREGA:" + r.id;
        const { data: notif } = await db().from("notificaciones").select("*").eq("id", nid).maybeSingle();
        if (notif) {
          const dest = await resolverDestinatarios(notif);
          const filas = dest.map((u) => ({ notificacion_id: nid, usuario: u, status: "UNREAD", deleted: false }));
          for (let i = 0; i < filas.length; i += 50) {
            const { error: e2 } = await db().from("notificaciones_perfil").insert(filas.slice(i, i + 50));
            if (e2 && e2.code !== "23505") console.warn("[Pinol] reparto parcial:", e2.message);
          }
        }
      } catch (e) { console.warn("[Pinol] No se pudo repartir el aviso de entrega:", e); }
      PINOL.entrega = null;
      aviso("Solicitud marcada como entregada.");
    } catch (e) {
      PINOL.errorEntrega = "No se pudo registrar: " + (e.message || e);
    }
    PINOL.guardando = false;
    pintarPinol();
  }

  function pintarPinol() {
    const root = PINOL.root;
    let cuerpo;
    if (PINOL.cargando) cuerpo = cargandoHtml("Cargando solicitudes…");
    else if (PINOL.error) cuerpo = errorHtml(PINOL.error, "svPinRe");
    else {
      const est = (r) => String(r.estatus_visual || r.estatus || "PENDIENTE").toUpperCase();
      const cuenta = (e) => PINOL.filas.filter((r) => est(r) === e).length;
      const pend = PINOL.filas.filter((r) => est(r) === "PENDIENTE");
      const botellas = pend.reduce((t, r) => t + (Number(r.solicitud_botellas) || 4), 0);
      const q = norm(PINOL.q);
      const lista = PINOL.filas.filter((r) => (PINOL.filtro === "TODOS" || est(r) === PINOL.filtro) &&
        (!q || norm(r.unidad).includes(q) || norm(r.clues).includes(q) || norm(r.municipio).includes(q)));
      const chips = [["PENDIENTE", "Pendientes"], ["ENTREGADO", "Por confirmar"], ["RECIBIDO", "Recibidas"], ["TODOS", "Todas"]].map(([k, t]) =>
        `<button type="button" class="sv-chip sv-chip--sm${PINOL.filtro === k ? " activo" : ""}" data-pf="${k}" aria-pressed="${PINOL.filtro === k}">${t}${k !== "TODOS" ? ` ${cuenta(k)}` : ""}</button>`).join("");
      cuerpo = `
        <div class="sv-kpis sv-kpis--fila">
          <div class="sv-kpi"><div class="sv-kpi-val">${pend.length}<small></small></div><small class="sv-kpi-sub">Pendientes</small></div>
          <div class="sv-kpi"><div class="sv-kpi-val">${botellas}<small></small></div><small class="sv-kpi-sub">Botellas en ruta (${(botellas * 0.828).toFixed(1)} L)</small></div>
        </div>
        ${tarjetaEntrega()}
        <div class="sv-chips sv-chips--scroll" role="group" aria-label="Estatus">${chips}</div>
        <label class="sv-buscar"><span class="sr-only">Buscar unidad</span><span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input type="search" id="svPinBuscar" placeholder="Buscar unidad o CLUES" value="${esc(PINOL.q)}" autocomplete="off"></label>
        ${lista.length ? `<ul class="sv-lista">${lista.map((r) => { const e = ESTATUS[est(r)] || [est(r), "falta"]; return `<li class="sv-unidad">
          <div class="sv-u-txt"><b>${esc(r.unidad || r.clues)}</b><small>${esc(r.municipio || "")} · ${esc(fechaCorta(r.timestamp_solicitud))} · ${Number(r.solicitud_botellas) || 0} bot. · existencia ${Number(r.existencia_actual_botellas) || 0}</small></div>
          <span class="sv-pill sv-pill--${e[1]}">${esc(e[0])}</span>
          ${est(r) === "PENDIENTE" ? `<button type="button" class="sv-btn sv-btn--sec sv-btn--chico" data-entrega="${esc(r.id)}">Registrar entrega</button>` : ""}</li>`; }).join("")}</ul>`
          : `<p class="sv-vacio">Sin solicitudes con ese criterio.</p>`}
        <p class="sv-nota">La guía de ruta y el acuse impreso siguen en escritorio.</p>`;
    }
    root.innerHTML = A.encabezadoSub("Pinol") + cuerpo;
    A.enlazarVolver(root);
    root.querySelectorAll("[data-pf]").forEach((b) => { b.onclick = () => { PINOL.filtro = b.dataset.pf; pintarPinol(); }; });
    root.querySelectorAll("[data-entrega]").forEach((b) => {
      b.onclick = () => {
        PINOL.entrega = b.dataset.entrega; PINOL.errorEntrega = null; pintarPinol();
        const c = root.querySelector("#svPinEnt"); if (c) c.scrollIntoView({ block: "center" });
      };
    });
    const cancel = root.querySelector("#svPinEntNo");
    if (cancel) cancel.onclick = () => { PINOL.entrega = null; pintarPinol(); };
    const okEnt = root.querySelector("#svPinEntOk");
    if (okEnt) okEnt.onclick = registrarEntrega;
    const bus = root.querySelector("#svPinBuscar");
    if (bus) bus.oninput = () => {
      PINOL.q = bus.value; const pos = bus.selectionStart; pintarPinol();
      const n = root.querySelector("#svPinBuscar"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* search */ } }
    };
    const re = root.querySelector("#svPinRe");
    if (re) re.onclick = () => { PINOL.filas = null; abrirPinol(root); };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Enviar aviso (misma inserción y fan-out que escritorio; con confirmación del alcance)
  // ═══════════════════════════════════════════════════════════════════════════
  const ENV = { tipo: "INFO", titulo: "", mensaje: "", destino: "", municipio: "", clues: "", paso: "form", rec: null, enviando: false, error: null };
  const TIPOS_AVISO = [["INFO", "Información"], ["SUCCESS", "Operación exitosa"], ["WARN", "Alerta operativa"], ["ERROR", "Urgente"]];

  function destinosPorRol() {
    const r = A.rol();
    if (r === "ADMIN") return [["MUNICIPAL_USERS_ALL", "Todos los coordinadores municipales"], ["MUNICIPIO", "Personal de un municipio"], ["CLUES", "Una unidad (CLUES)"]];
    if (r === "JURISDICCIONAL") return [["MUNICIPAL_USERS_ALL", "Todos los municipales"], ["MUNICIPIO", "Personal de un municipio"], ["CLUES", "Una unidad (CLUES)"]];
    if (r === "MUNICIPAL") return [["ALL_MY_UNITS", "Todas mis unidades"], ["CLUES", "Una unidad (CLUES)"]];
    if (r === "CARAVANAS") return [["ALL_MY_UNITS", "Todas mis caravanas"], ["CLUES", "Una caravana"]];
    return [];
  }

  async function usuariosActivos(filtroClues) {
    let q1 = db().from("perfiles").select("usuario, rol, clues, municipio, municipios_allowed");
    let q2 = db().from("usuarios_legacy").select("usuario, rol, clues, municipio");
    let q3 = db().from("unidades").select("clues, unidad, municipio");
    if (filtroClues) { q1 = q1.eq("clues", filtroClues); q2 = q2.eq("clues", filtroClues); q3 = q3.eq("clues", filtroClues); }
    const [r1, r2, r3] = await Promise.all([q1, q2, q3]);
    const mapa = new Map();
    (r1.data || []).forEach((u) => { if (u && u.usuario) mapa.set(u.usuario, u); });
    (r2.data || []).forEach((u) => { if (u && u.usuario && !mapa.has(u.usuario)) mapa.set(u.usuario, u); });
    (r3.data || []).forEach((u) => { if (u && u.clues && !mapa.has(u.clues)) mapa.set(u.clues, { usuario: u.clues, rol: "UNIDAD", clues: u.clues, municipio: u.municipio }); });
    return [...mapa.values()];
  }
  const permitidos = (u) => {
    let raw = u.municipios_allowed || u.municipiosAllowed;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (e) { raw = [raw]; } }
    return Array.isArray(raw) ? raw.map(norm) : [];
  };
  const ALTO = ["ADMIN", "JURISDICCIONAL", "VISUALIZADOR_JURISDICCIONAL"];

  // Mismo criterio que resolveNotificationRecipients de escritorio, limitado a los alcances que ofrece el móvil.
  async function resolverDestinatarios(rec) {
    const scope = String(rec.target_scope || "").toUpperCase();
    const muni = norm(rec.target_municipio);
    const out = new Set();
    if (scope === "CLUES") {
      const delaUnidad = await usuariosActivos(rec.target_clues);
      delaUnidad.forEach((u) => out.add(u.usuario));
      const todos = await usuariosActivos();
      const m = muni || norm((delaUnidad.find((x) => x.municipio) || {}).municipio);
      todos.forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        if (ALTO.includes(r)) out.add(u.usuario);
        else if (r === "MUNICIPAL" || r === "CARAVANAS") { const p = permitidos(u); if (p.includes("*") || (m && p.includes(m))) out.add(u.usuario); }
      });
    } else if (scope === "MUNICIPIO") {
      (await usuariosActivos()).forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        if (ALTO.includes(r)) out.add(u.usuario);
        else if (r === "MUNICIPAL" || r === "CARAVANAS") { const p = permitidos(u); if (p.includes("*") || (muni && p.includes(muni))) out.add(u.usuario); }
      });
    } else if (scope === "MUNICIPIO_UNITS") {
      (await usuariosActivos()).forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        const um = norm(u.municipio);
        if (ALTO.includes(r)) out.add(u.usuario);
        else if (r === "UNIDAD" || u.clues) { if (!muni || um === muni) out.add(u.usuario); }
        else if (r === "MUNICIPAL" || r === "CARAVANAS") { const p = permitidos(u); if (p.includes("*") || (muni && p.includes(muni))) out.add(u.usuario); }
      });
    } else if (scope === "CARAVANAS_UNITS") {
      const { data } = await db().from("unidades").select("clues, unidad").eq("activo", "SI");
      const car = (data || []).filter((u) => A.esCaravana(u)).map((u) => u.clues);
      (await usuariosActivos()).forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        if (ALTO.includes(r) || r === "CARAVANAS") out.add(u.usuario);
        else if (u.clues && car.includes(u.clues)) out.add(u.usuario);
      });
    } else if (scope === "ROLE") {
      (await usuariosActivos()).forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        if (r === String(rec.target_usuario || "").toUpperCase() || r === "ADMIN") out.add(u.usuario);
      });
    } else if (scope === "MUNICIPAL_USERS_ALL") {
      (await usuariosActivos()).forEach((u) => {
        const r = String(u.rol || "").toUpperCase();
        if (r === "MUNICIPAL" || r === "ADMIN") out.add(u.usuario);
      });
    }
    out.delete(rec.from_usuario);
    return [...out].filter(Boolean);
  }

  function armarRegistro() {
    const p = perfil();
    const r = A.rol();
    let scope = ENV.destino;
    let municipio = ENV.municipio || null;
    let usuario = null;
    if (scope === "ALL_MY_UNITS") {
      if (r === "CARAVANAS") scope = "CARAVANAS_UNITS";
      else { scope = "MUNICIPIO_UNITS"; municipio = municipio || A.municipiosPermitidos().filter((m) => m !== "*")[0] || p.municipio || null; }
    }
    if (scope === "MUNICIPAL_USERS_ALL" && r === "JURISDICCIONAL") { scope = "ROLE"; usuario = "MUNICIPAL"; }
    let idBase = ENV.clues || usuario || "SYS";
    let b64;
    try { b64 = btoa(idBase + ":" + Date.now()); } catch (e) { b64 = String(Date.now()) + Math.random().toString(36).slice(2); }
    const rec = {
      id: "NOTIF:" + b64,
      created_ts: ahoraIso(),
      created_date: hoyYmd(),
      from_usuario: p.usuario,
      from_rol: p.rol,
      target_scope: scope,
      target_municipio: municipio,
      target_clues: ENV.clues || null,
      target_usuario: usuario,
      type: ENV.tipo,
      title: ENV.titulo.trim(),
      message: ENV.mensaje.trim(),
      status: "UNREAD"
    };
    return rec;
  }

  async function abrirEnvio(root) {
    ENV.root = root;
    if (!ENV.unidades) {
      root.innerHTML = A.encabezadoSub("Enviar aviso") + cargandoHtml("Preparando…");
      A.enlazarVolver(root);
      try { ENV.unidades = await unidades(); }
      catch (e) { root.innerHTML = A.encabezadoSub("Enviar aviso") + errorHtml("No se pudieron cargar las unidades: " + (e.message || e), "svEnvRe"); A.enlazarVolver(root); root.querySelector("#svEnvRe").onclick = () => abrirEnvio(root); return; }
    }
    ENV.paso = "form";
    pintarEnvio();
  }

  function pintarEnvio() {
    const root = ENV.root;
    const destinos = destinosPorRol();
    if (!destinos.length) { root.innerHTML = A.encabezadoSub("Enviar aviso") + `<p class="sv-vacio">Tu perfil no puede enviar avisos.</p>`; A.enlazarVolver(root); return; }
    if (!ENV.destino) ENV.destino = destinos[0][0];
    const munis = [...new Set((ENV.unidades || []).map((u) => u.municipio).filter(Boolean))];
    const necesitaMuni = ENV.destino === "MUNICIPIO" || (ENV.destino === "ALL_MY_UNITS" && A.rol() === "MUNICIPAL" && munis.length > 1) || (ENV.destino === "CLUES" && A.rol() !== "CARAVANAS" && munis.length > 1);
    const unidadesMuni = (ENV.unidades || []).filter((u) => A.rol() === "CARAVANAS" ? true : (!ENV.municipio || u.municipio === ENV.municipio));
    const optM = (v) => `<option value="${esc(v)}"${ENV.municipio === v ? " selected" : ""}>${esc(v)}</option>`;

    if (ENV.paso === "confirmar" && ENV.rec) {
      const n = ENV.rec.destinatarios.length;
      root.innerHTML = A.encabezadoSub("Enviar aviso") + `
        <div class="sv-confirma" role="alertdialog" aria-labelledby="svCfT">
          <h3 id="svCfT">¿Enviar este aviso?</h3>
          <p><b>${esc(ENV.rec.registro.title)}</b></p>
          <p class="sv-confirma-msg">${esc(ENV.rec.registro.message)}</p>
          <p class="sv-nota">Llegará a <b>${n}</b> ${n === 1 ? "destinatario" : "destinatarios"} · ${esc(ENV.rec.texto)}.</p>
          ${n === 0 ? `<p class="sv-error" role="alert">No hay destinatarios para ese alcance. No se enviará.</p>` : ""}
          ${ENV.error ? `<p class="sv-error" role="alert">${esc(ENV.error)}</p>` : ""}
          <div class="sv-confirma-acc">
            <button type="button" class="sv-btn sv-btn--sec" id="svEnvVolver">Editar</button>
            <button type="button" class="sv-btn sv-btn--pri" id="svEnvOk"${n === 0 || ENV.enviando ? " disabled" : ""}>${ENV.enviando ? "Enviando…" : "Enviar ahora"}</button>
          </div>
        </div>`;
      A.enlazarVolver(root);
      root.querySelector("#svEnvVolver").onclick = () => { ENV.paso = "form"; ENV.error = null; pintarEnvio(); };
      root.querySelector("#svEnvOk").onclick = enviar;
      return;
    }

    root.innerHTML = A.encabezadoSub("Enviar aviso") + `
      <div class="sv-form">
        <label class="sv-fld"><span>Destino</span><select id="svEnvDestino" class="sv-sel">${destinos.map(([k, t]) => `<option value="${k}"${ENV.destino === k ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        ${necesitaMuni ? `<label class="sv-fld"><span>Municipio</span><select id="svEnvMuni" class="sv-sel"><option value="">Selecciona…</option>${munis.map(optM).join("")}</select></label>` : ""}
        ${ENV.destino === "CLUES" ? `<label class="sv-fld"><span>${A.rol() === "CARAVANAS" ? "Caravana" : "Unidad"}</span><select id="svEnvClues" class="sv-sel"><option value="">Selecciona…</option>${unidadesMuni.map((u) => `<option value="${esc(u.clues)}"${ENV.clues === u.clues ? " selected" : ""}>${esc(u.unidad)} (${esc(u.clues)})</option>`).join("")}</select></label>` : ""}
        <label class="sv-fld"><span>Tipo</span><select id="svEnvTipo" class="sv-sel">${TIPOS_AVISO.map(([k, t]) => `<option value="${k}"${ENV.tipo === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="sv-fld"><span>Título</span><input type="text" id="svEnvTitulo" class="sv-txt" maxlength="120" value="${esc(ENV.titulo)}" placeholder="Asunto del aviso"></label>
        <label class="sv-fld"><span>Mensaje</span><textarea id="svEnvMsg" class="sv-txt sv-area" rows="5" maxlength="1200" placeholder="Escribe el mensaje…">${esc(ENV.mensaje)}</textarea></label>
        ${ENV.error ? `<p class="sv-error" role="alert">${esc(ENV.error)}</p>` : ""}
        <div class="sv-barra-accion"><button type="button" class="sv-btn sv-btn--pri" id="svEnvRev">Revisar y enviar</button></div>
      </div>`;
    A.enlazarVolver(root);
    const val = (id) => root.querySelector(id);
    val("#svEnvDestino").onchange = (e) => { leer(); ENV.destino = e.target.value; ENV.clues = ""; ENV.error = null; pintarEnvio(); };
    if (val("#svEnvMuni")) val("#svEnvMuni").onchange = (e) => { leer(); ENV.municipio = e.target.value; ENV.clues = ""; pintarEnvio(); };
    function leer() {
      ENV.tipo = val("#svEnvTipo").value; ENV.titulo = val("#svEnvTitulo").value; ENV.mensaje = val("#svEnvMsg").value;
      if (val("#svEnvClues")) ENV.clues = val("#svEnvClues").value;
    }
    val("#svEnvRev").onclick = async () => {
      leer();
      ENV.error = null;
      if (!ENV.titulo.trim()) { ENV.error = "Escribe un título."; return pintarEnvio(); }
      if (!ENV.mensaje.trim()) { ENV.error = "Escribe un mensaje."; return pintarEnvio(); }
      if (ENV.destino === "CLUES" && !ENV.clues) { ENV.error = "Selecciona la unidad destino."; return pintarEnvio(); }
      if (ENV.destino === "MUNICIPIO" && !ENV.municipio) { ENV.error = "Selecciona el municipio destino."; return pintarEnvio(); }
      const b = val("#svEnvRev"); b.disabled = true; b.textContent = "Calculando destinatarios…";
      try {
        const registro = armarRegistro();
        if (registro.target_scope === "CLUES" && !registro.target_municipio) {
          const u = (ENV.unidades || []).find((x) => x.clues === registro.target_clues);
          if (u) registro.target_municipio = u.municipio;
        }
        const destinatarios = await resolverDestinatarios(registro);
        const d = destinos.find(([k]) => k === ENV.destino);
        const u = registro.target_scope === "CLUES" ? (ENV.unidades || []).find((x) => x.clues === registro.target_clues) : null;
        const texto = u ? `unidad ${u.unidad}` : (registro.target_municipio ? `${d ? d[1].toLowerCase() : "municipio"} · ${registro.target_municipio}` : (d ? d[1].toLowerCase() : ""));
        ENV.rec = { registro, destinatarios, texto };
        ENV.paso = "confirmar";
      } catch (e) { ENV.error = "No se pudo calcular el alcance: " + (e.message || e); }
      pintarEnvio();
    };
  }

  async function enviar() {
    if (ENV.enviando || !ENV.rec) return;
    ENV.enviando = true; ENV.error = null; pintarEnvio();
    try {
      const { registro, destinatarios } = ENV.rec;
      const { error } = await db().from("notificaciones").insert(registro);
      if (error) throw error;
      const filas = destinatarios.map((u) => ({ notificacion_id: registro.id, usuario: u, status: "UNREAD", deleted: false }));
      for (let i = 0; i < filas.length; i += 50) {
        const { error: e2 } = await db().from("notificaciones_perfil").insert(filas.slice(i, i + 50));
        if (e2 && e2.code !== "23505") console.warn("[Avisos] reparto parcial:", e2.message);
      }
      aviso("Aviso enviado.");
      ENV.titulo = ""; ENV.mensaje = ""; ENV.clues = ""; ENV.rec = null; ENV.paso = "form";
    } catch (e) {
      ENV.error = "No se pudo enviar: " + (e.message || e);
    }
    ENV.enviando = false;
    pintarEnvio();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Seguridad (ADMIN): apertura extraordinaria, auditoría de datos y usuarios en línea
  // ═══════════════════════════════════════════════════════════════════════════
  const SEG = { apertura: undefined, hallazgos: null, auditando: false, presencia: null, canal: null, error: null, confirmando: false };
  const CAT = {
    clues_formato: "CLUES con formato inválido", unidad_huerfana: "Unidad huérfana", unidad_sin_ficha_medica: "Unidad sin ficha médica",
    poblacion_duplicada_sospechosa: "Población duplicada entre años", meses_faltantes: "Meses faltantes",
    mapeo_duplicado_mayusculas: "Mapeo SIS duplicado (mayúsculas)", rpc_sin_verificacion_rol: "RPC sin verificación de rol"
  };

  async function abrirSeguridad(root) {
    SEG.root = root;
    if (A.rol() !== "ADMIN") { root.innerHTML = A.encabezadoSub("Seguridad") + `<p class="sv-vacio">Solo Admin puede ver este panel.</p>`; A.enlazarVolver(root); return; }
    root.innerHTML = A.encabezadoSub("Seguridad") + cargandoHtml("Cargando…");
    A.enlazarVolver(root);
    try {
      const { data, error } = await db().from("aperturas_existencia").select("*").eq("activo", "SI").limit(1);
      if (error) throw error;
      SEG.apertura = (data && data[0]) || null;
      SEG.error = null;
    } catch (e) { SEG.apertura = null; SEG.error = "No se pudo leer la apertura: " + (e.message || e); }
    suscribirPresencia();
    pintarSeguridad();
  }

  function suscribirPresencia() {
    try {
      if (SEG.canal) { db().removeChannel(SEG.canal); SEG.canal = null; }
      const canal = db().channel("global_presence");
      canal.on("presence", { event: "sync" }, () => {
        SEG.presencia = Object.values(canal.presenceState()).map((p) => p[0]).filter(Boolean);
        const host = SEG.root && SEG.root.querySelector("#svSegPres");
        if (host) host.innerHTML = presenciaHtml();
      }).subscribe();
      SEG.canal = canal;
    } catch (e) { SEG.presencia = null; }
  }

  const presenciaHtml = () => {
    if (!SEG.presencia) return `<p class="sv-vacio">Conectando…</p>`;
    if (!SEG.presencia.length) return `<p class="sv-vacio">Nadie más en línea ahora.</p>`;
    return `<ul class="sv-lista sv-lista--sep">${SEG.presencia.map((p) => `<li class="sv-unidad"><span class="sv-dot completo" aria-hidden="true"></span>
      <div class="sv-u-txt"><b>${esc(p.nombre || p.user)}</b><small>${esc(p.rol || "")} · ${esc(p.clues || "N/A")}</small></div></li>`).join("")}</ul>`;
  };

  function pintarSeguridad() {
    const root = SEG.root;
    const ap = SEG.apertura;
    const hallazgos = SEG.hallazgos;
    const orden = { alta: 0, media: 1, baja: 2 };
    const cont = { alta: 0, media: 0, baja: 0 };
    (hallazgos || []).forEach((f) => { cont[f.severidad] = (cont[f.severidad] || 0) + 1; });
    const lista = (hallazgos || []).slice().sort((a, b) => (orden[a.severidad] ?? 9) - (orden[b.severidad] ?? 9)).slice(0, 80);
    root.innerHTML = A.encabezadoSub("Seguridad") + `
      <p class="sv-sec">Apertura extraordinaria de existencias</p>
      <div class="sv-avance">
        ${SEG.error ? `<p class="sv-error" role="alert">${esc(SEG.error)}</p>` : ""}
        <div class="sv-avance-cab"><div><b>${ap ? "Abierta" : "Cerrada"}</b><small>${ap ? `${esc(fechaCorta(ap.fecha))} · ${esc(ap.motivo || "")}` : "Las unidades capturan en su ventana normal."}</small></div>
          <span class="sv-pill sv-pill--${ap ? "reg" : "ok"}">${ap ? "Activa" : "Normal"}</span></div>
        ${SEG.confirmando ? `<p class="sv-nota sv-nota--sup">${ap ? "Se cerrará la apertura extraordinaria." : `Se abrirá la captura de existencias para hoy (${esc(fechaCorta(hoyYmd()))}).`}</p>
          <div class="sv-confirma-acc"><button type="button" class="sv-btn sv-btn--sec" id="svApNo">Cancelar</button><button type="button" class="sv-btn sv-btn--pri" id="svApSi">Confirmar</button></div>`
          : `<div class="sv-barra-accion sv-barra-accion--ln"><button type="button" class="sv-btn sv-btn--sec" id="svApToggle">${ap ? "Cerrar apertura" : "Abrir captura hoy"}</button></div>`}
      </div>
      <p class="sv-sec">Auditoría de datos</p>
      <div class="sv-avance">
        <div class="sv-avance-cab"><div><b>Integridad de datos</b><small>${hallazgos ? `${hallazgos.length} hallazgo(s) · Alta ${cont.alta || 0} · Media ${cont.media || 0} · Baja ${cont.baja || 0}` : "Solo lectura; corre la RPC de auditoría."}</small></div></div>
        <div class="sv-barra-accion sv-barra-accion--ln"><button type="button" class="sv-btn sv-btn--sec" id="svAudit"${SEG.auditando ? " disabled" : ""}>${SEG.auditando ? "Auditando…" : "Correr auditoría"}</button></div>
      </div>
      ${hallazgos ? (lista.length ? `<ul class="sv-lista sv-lista--sep">${lista.map((f) => `<li class="sv-unidad"><span class="sv-pill sv-pill--${f.severidad === "alta" ? "mal" : f.severidad === "media" ? "reg" : "ok"}">${esc(f.severidad)}</span>
        <div class="sv-u-txt"><b>${esc(CAT[f.categoria] || f.categoria)}</b><small>${esc(f.clues || "—")} · ${esc(f.descripcion || "")}</small></div></li>`).join("")}</ul>
        ${hallazgos.length > lista.length ? `<p class="sv-nota">Se muestran ${lista.length} de ${hallazgos.length}. El detalle completo está en escritorio.</p>` : ""}`
        : `<p class="sv-vacio">Sin hallazgos: no se detectó ningún problema.</p>`) : ""}
      <p class="sv-sec">Usuarios en línea</p>
      <div id="svSegPres">${presenciaHtml()}</div>
      <p class="sv-nota">Usuarios, catálogo, mapeador y evidencias se administran en escritorio.</p>`;
    A.enlazarVolver(root);
    const tg = root.querySelector("#svApToggle");
    if (tg) tg.onclick = () => { SEG.confirmando = true; pintarSeguridad(); };
    const no = root.querySelector("#svApNo");
    if (no) no.onclick = () => { SEG.confirmando = false; pintarSeguridad(); };
    const si = root.querySelector("#svApSi");
    if (si) si.onclick = cambiarApertura;
    const au = root.querySelector("#svAudit");
    if (au) au.onclick = auditar;
  }

  async function cambiarApertura() {
    SEG.error = null;
    try {
      if (SEG.apertura) {
        const { error } = await db().from("aperturas_existencia").delete().eq("fecha", SEG.apertura.fecha);
        if (error) throw error;
        SEG.apertura = null;
        aviso("Apertura extraordinaria cerrada.");
      } else {
        const fila = { fecha: hoyYmd(), motivo: "APERTURA EXTRAORDINARIA", activo: "SI", creado_por: quien(), timestamp: ahoraIso() };
        const { error } = await db().from("aperturas_existencia").upsert(fila, { onConflict: "fecha" });
        if (error) throw error;
        SEG.apertura = fila;
        aviso("Captura de existencias abierta para hoy.");
      }
    } catch (e) { SEG.error = "No se pudo cambiar la apertura: " + (e.message || e); }
    SEG.confirmando = false;
    pintarSeguridad();
  }

  async function auditar() {
    SEG.auditando = true; SEG.error = null; pintarSeguridad();
    try {
      const { data, error } = await db().rpc("get_audit_findings", { p_anio: new Date().getFullYear() });
      if (error) throw error;
      SEG.hallazgos = data || [];
    } catch (e) { SEG.error = "No se pudo correr la auditoría: " + (e.message || e); }
    SEG.auditando = false;
    pintarSeguridad();
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Concentrado de aplicaciones (solo lectura): mismo RPC que escritorio, por biológico y unidad
  // ═══════════════════════════════════════════════════════════════════════════
  const CON_BIOS = ["BCG", "HEPATITIS B", "HEXAVALENTE", "DPT", "ROTAVIRUS", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP", "SR", "VPH", "VARICELA", "HEPATITIS A", "TD", "TDPA", "COVID-19", "INFLUENZA", "VSR"];
  const MESES_L = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const CON = { anio: new Date().getFullYear(), ini: 1, fin: new Date().getMonth() + 1, bio: "", filas: null, cargando: false, error: null, q: "", clave: "" };

  async function abrirConcentrado(root) {
    CON.root = root;
    if (!CON.filas || CON.clave !== CON.anio + "|" + CON.ini + "|" + CON.fin) await cargarConcentrado();
    else pintarConcentrado();
  }

  async function cargarConcentrado() {
    CON.cargando = true; CON.error = null; pintarConcentrado();
    try {
      let todo = [];
      for (let off = 0; ; ) {
        const { data, error } = await db().rpc("get_concentrado_por_biologico", { p_anio: CON.anio, p_mes_ini: CON.ini, p_mes_fin: CON.fin, p_offset: off, p_limit: 1000 });
        if (error) throw error;
        if (!data || !data.length) break;
        todo = todo.concat(data);
        off += data.length;
      }
      CON.filas = todo.filter((r) => A.enAlcance({ unidad: r.nombre || r.unidad, municipio: r.municipio }));
      CON.clave = CON.anio + "|" + CON.ini + "|" + CON.fin;
    } catch (e) { CON.error = "No se pudo cargar el concentrado: " + (e.message || e); CON.filas = null; }
    CON.cargando = false;
    pintarConcentrado();
  }

  function pintarConcentrado() {
    const root = CON.root;
    let cuerpo;
    const meses = (sel) => MESES_L.map((m, i) => `<option value="${i + 1}"${i + 1 === sel ? " selected" : ""}>${m}</option>`).join("");
    if (CON.cargando) cuerpo = cargandoHtml("Cargando concentrado…");
    else if (CON.error) cuerpo = errorHtml(CON.error, "svConRe");
    else {
      const porBio = new Map();
      CON.filas.forEach((r) => { const k = String(r.biologico || "").toUpperCase(); porBio.set(k, (porBio.get(k) || 0) + (Number(r.total_dosis) || 0)); });
      const bios = CON_BIOS.filter((b) => porBio.has(b));
      const extras = [...porBio.keys()].filter((b) => !CON_BIOS.includes(b)).sort();
      const lista = bios.concat(extras);
      if (!CON.bio || !lista.includes(CON.bio)) CON.bio = lista[0] || "";
      const total = lista.reduce((t, b) => t + (porBio.get(b) || 0), 0);
      const q = norm(CON.q);
      const unidades = new Map();
      CON.filas.filter((r) => String(r.biologico || "").toUpperCase() === CON.bio).forEach((r) => {
        const k = r.clues; const v = unidades.get(k) || { nombre: r.nombre || r.unidad || r.clues, municipio: r.municipio, t: 0 };
        v.t += Number(r.total_dosis) || 0; unidades.set(k, v);
      });
      const ranking = [...unidades.entries()].map(([clues, v]) => ({ clues, ...v }))
        .filter((x) => !q || norm(x.nombre).includes(q) || norm(x.clues).includes(q))
        .sort((a, b) => b.t - a.t);
      const chips = lista.map((b) => `<button type="button" class="sv-chip sv-chip--sm${b === CON.bio ? " activo" : ""}" data-cb="${esc(b)}" aria-pressed="${b === CON.bio}">${esc(b)}</button>`).join("");
      cuerpo = `
        <div class="sv-avance"><div class="sv-avance-cab"><div><b>Aplicaciones del periodo</b><small>${MESES_L[CON.ini - 1]} – ${MESES_L[CON.fin - 1]} ${CON.anio}</small></div><span class="sv-pct">${nf(total)}</span></div></div>
        <div class="sv-chips sv-chips--scroll" role="group" aria-label="Biológico">${chips}</div>
        <p class="sv-sec">${esc(CON.bio || "Sin datos")} · ${nf(porBio.get(CON.bio) || 0)} dosis</p>
        <label class="sv-buscar"><span class="sr-only">Buscar unidad</span><span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input type="search" id="svConBuscar" placeholder="Buscar unidad o CLUES" value="${esc(CON.q)}" autocomplete="off"></label>
        ${ranking.length ? `<ul class="sv-lista sv-lista--sep">${ranking.map((x) => `<li class="sv-unidad"><div class="sv-u-txt"><b>${esc(x.nombre)}</b><small>${esc(x.municipio || "")} · ${esc(x.clues)}</small></div>
          <span class="sv-pill sv-pill--ok">${nf(x.t)}</span></li>`).join("")}</ul>` : `<p class="sv-vacio">Sin unidades con ese criterio.</p>`}`;
    }
    root.innerHTML = A.encabezadoSub("Concentrado") + `
      <div class="sv-periodo">
        <label class="sv-fld"><span>Desde</span><select id="svConIni" class="sv-sel">${meses(CON.ini)}</select></label>
        <label class="sv-fld"><span>Hasta</span><select id="svConFin" class="sv-sel">${meses(CON.fin)}</select></label>
      </div>` + cuerpo;
    A.enlazarVolver(root);
    const cambiar = () => {
      let i = Number(root.querySelector("#svConIni").value), f = Number(root.querySelector("#svConFin").value);
      if (i > f) { if (document.activeElement && document.activeElement.id === "svConIni") f = i; else i = f; }
      CON.ini = i; CON.fin = f; cargarConcentrado();
    };
    root.querySelector("#svConIni").onchange = cambiar;
    root.querySelector("#svConFin").onchange = cambiar;
    root.querySelectorAll("[data-cb]").forEach((b) => { b.onclick = () => { CON.bio = b.dataset.cb; pintarConcentrado(); }; });
    const bus = root.querySelector("#svConBuscar");
    if (bus) bus.oninput = () => {
      CON.q = bus.value; const pos = bus.selectionStart; pintarConcentrado();
      const n = root.querySelector("#svConBuscar"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* search */ } }
    };
    const re = root.querySelector("#svConRe");
    if (re) re.onclick = cargarConcentrado;
  }
  const nf = (n) => Math.round(Number(n || 0)).toLocaleString("es-MX");

  // ═══════════════════════════════════════════════════════════════════════════
  // Lotes (consulta): caducidades y municipio; alta y edición siguen en escritorio
  // ═══════════════════════════════════════════════════════════════════════════
  const LOT = { filas: null, q: "", filtro: "TODOS", cargando: false, error: null };
  const MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mmmAa = (iso) => { if (!iso) return "—"; const d = new Date(String(iso).slice(0, 10) + "T00:00:00"); return isNaN(d) ? String(iso) : MES3[d.getMonth()] + "-" + String(d.getFullYear()).slice(2); };
  function estadoCaducidad(iso) {
    if (!iso) return ["Sin fecha", "reg"];
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    const dias = Math.floor((d - new Date(new Date().toDateString())) / 86400000);
    if (dias < 0) return ["Vencido", "mal"];
    if (dias <= 90) return ["Por vencer", "reg"];
    return ["Vigente", "ok"];
  }

  async function abrirLotes(root) {
    LOT.root = root;
    if (!LOT.filas) {
      LOT.cargando = true; LOT.error = null; pintarLotes();
      try {
        let todo = [];
        for (let desde = 0; ; desde += 1000) {
          const { data, error } = await db().from("lotes").select("*").order("id").range(desde, desde + 999);
          if (error) throw error;
          if (!data || !data.length) break;
          todo = todo.concat(data);
          if (data.length < 1000) break;
        }
        LOT.filas = todo;
      } catch (e) { LOT.error = "No se pudieron cargar los lotes: " + (e.message || e); }
      LOT.cargando = false;
    }
    pintarLotes();
  }

  function pintarLotes() {
    const root = LOT.root;
    let cuerpo;
    if (LOT.cargando) cuerpo = cargandoHtml("Cargando lotes…");
    else if (LOT.error) cuerpo = errorHtml(LOT.error, "svLotRe");
    else {
      const conEstado = LOT.filas.map((l) => ({ l, e: estadoCaducidad(l.caducidad) }));
      const cuenta = (n) => conEstado.filter((x) => x.e[0] === n).length;
      const q = norm(LOT.q);
      const lista = conEstado.filter((x) => (LOT.filtro === "TODOS" || x.e[0] === LOT.filtro) &&
        (!q || norm(x.l.lote).includes(q) || norm(x.l.biologico).includes(q) || norm(x.l.municipio).includes(q)))
        .sort((a, b) => String(a.l.caducidad || "9999").localeCompare(String(b.l.caducidad || "9999")));
      const chips = [["TODOS", "Todos"], ["Vencido", "Vencidos"], ["Por vencer", "Por vencer"], ["Vigente", "Vigentes"]].map(([k, t]) =>
        `<button type="button" class="sv-chip sv-chip--sm${LOT.filtro === k ? " activo" : ""}" data-lf="${k}" aria-pressed="${LOT.filtro === k}">${t}${k !== "TODOS" ? " " + cuenta(k) : ""}</button>`).join("");
      cuerpo = `
        <div class="sv-chips sv-chips--scroll" role="group" aria-label="Caducidad">${chips}</div>
        <label class="sv-buscar"><span class="sr-only">Buscar lote</span><span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input type="search" id="svLotBuscar" placeholder="Buscar lote, biológico o municipio" value="${esc(LOT.q)}" autocomplete="off"></label>
        ${lista.length ? `<ul class="sv-lista sv-lista--sep">${lista.slice(0, 150).map((x) => `<li class="sv-unidad">
          <div class="sv-u-txt"><b>${esc(x.l.biologico)} · ${esc(x.l.lote)}</b><small>${esc(x.l.municipio || "Todos")}${x.l.tipo ? " · " + esc(x.l.tipo) : ""} · caduca ${esc(mmmAa(x.l.caducidad))}</small></div>
          <span class="sv-pill sv-pill--${x.e[1]}">${esc(x.e[0])}</span></li>`).join("")}</ul>
          ${lista.length > 150 ? `<p class="sv-nota">Se muestran 150 de ${lista.length}. Afina la búsqueda.</p>` : ""}` : `<p class="sv-vacio">Sin lotes con ese criterio.</p>`}
        <p class="sv-nota">El alta, edición y baja de lotes sigue en escritorio.</p>`;
    }
    root.innerHTML = A.encabezadoSub("Lotes") + cuerpo;
    A.enlazarVolver(root);
    root.querySelectorAll("[data-lf]").forEach((b) => { b.onclick = () => { LOT.filtro = b.dataset.lf; pintarLotes(); }; });
    const bus = root.querySelector("#svLotBuscar");
    if (bus) bus.oninput = () => {
      LOT.q = bus.value; const pos = bus.selectionStart; pintarLotes();
      const n = root.querySelector("#svLotBuscar"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* search */ } }
    };
    const re = root.querySelector("#svLotRe");
    if (re) re.onclick = () => { LOT.filas = null; abrirLotes(root); };
  }

  // ── Registro ──
  const par = montarMatriz("PAR");
  const jer = montarMatriz("JER");
  SV.registrar("PAR", CONF_MATRIZ.PAR.etiqueta, par);
  SV.registrar("JER", CONF_MATRIZ.JER.etiqueta, jer);
  SV.registrar("PIN", "Seguimiento de Pinol", { abrir: abrirPinol });
  SV.registrar("ENV", "Enviar aviso", { abrir: abrirEnvio });
  SV.registrar("CON", "Concentrado de aplicaciones", { abrir: abrirConcentrado });
  SV.registrar("LOT", "Lotes", { abrir: abrirLotes });
  SV.registrar("SEG", "Seguridad", {
    abrir: abrirSeguridad,
    cerrar() { if (SEG.canal) { try { db().removeChannel(SEG.canal); } catch (e) { /* ya cerrado */ } SEG.canal = null; } }
  });

  global.MobileSupervisionOps = { _util: { resolverDestinatarios, armarRegistro, destinosPorRol } };
})(typeof window !== "undefined" ? window : globalThis);
