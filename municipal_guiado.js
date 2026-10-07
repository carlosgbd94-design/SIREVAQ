/**
 * SIS / SINBA -- Cierre mensual del MUNICIPIO, guiado en 4 pasos (rol MUNICIPAL;
 * y JURISDICCIONAL, que hace de "municipal" de los hospitales HENM y NHG: los
 * pasos 2 a 4 trabajan solo con ellos y el paso 1 le muestra además el avance
 * de los municipios, informativo). Es una capa sobre lo que ya existe: no reimplementa ninguna hoja,
 * solo ordena el trabajo del municipal en el orden en que de verdad lo hace y
 * le da el avance de cada paso.
 *
 *   1. Envíos       -- quién ya envió su SINBA-SIS (Seguimiento, rediseñado).
 *   2. Revisión     -- unidad por unidad: las 4 hojas de la unidad (SIS-06-P,
 *                      Movimiento, SIS-SS-CE-H, Influenza) con navegación
 *                      anterior/siguiente y "siguiente por validar".
 *   3. Concentrado  -- tres tarjetas en orden: (1) verificar que cuadre
 *                      (conciliación y recibido vs. requisición), (2) Movimiento
 *                      de Biológico del propio municipio (BIOVAC: se captura a mano
 *                      hasta septiembre 2026, desde octubre es la suma de las
 *                      unidades) y (3) los archivos a descargar: Excel del concentrado
 *                      (PALOTEO + SEGUIMIENTO + CSV), Excel BIOVAC y CSV oficial.
 *   4. Entrega      -- lista de verificación y CSV oficial para estadística.
 *
 * Las hojas viejas siguen siendo las de siempre (sus botones quedan ocultos y
 * este módulo los acciona), así que guardar, validar y exportar funcionan igual.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  const PASOS = [
    { n: 1, t: 'Envíos', icono: 'mark_email_read', color: '#0284c7', titulo: '1. Quién ya envió' },
    { n: 2, t: 'Revisión', icono: 'fact_check', color: '#d97706', titulo: '2. Revisar y validar unidad por unidad' },
    { n: 3, t: 'Concentrado', icono: 'table_chart', color: '#16a34a', titulo: '3. Concentrado del municipio' },
    { n: 4, t: 'Entrega', icono: 'outbox', color: '#7c3aed', titulo: '4. Entrega a estadística' }
  ];
  const HOJAS = [
    { id: 'btnSeccionSIS06P', pildora: 'pildoraSIS06P', t: 'SIS-06-P', icono: 'summarize', color: '#0284c7' },
    { id: 'btnSeccionMovimiento', pildora: 'pildoraMovimiento', t: 'Movimiento', icono: 'inventory_2', color: '#d97706' },
    { id: 'btnSeccionCEH', pildora: 'pildoraCEH', t: 'SIS-SS-CE-H', icono: 'table_view', color: '#16a34a' },
    { id: 'btnSeccionInfluenza', pildora: 'pildoraInfluenza', t: 'Influenza', icono: 'vaccines', color: '#C26750' }
  ];
  const ETIQUETA = { VALIDADO: 'Validado', ENVIADO: 'Por validar', SIN: 'Sin enviar' };
  const CLASE_EST = { VALIDADO: 'completo', ENVIADO: 'parcial', SIN: 'vacio' };
  const ORDEN_EST = { ENVIADO: 0, SIN: 1, VALIDADO: 2 };

  const ES_HOSPITAL = { NHG: true, HENM: true };
  const st = { activo: false, modo: 'municipal', todas: [], paso: 1, filas: [], filtro: 'todas', clues: null, muni: null, vista3: 'concentrado', hojaActual: 'btnSeccionSIS06P', tokenConc: 0, conc: null };

  function activo() { return st.activo; }
  function periodo() { return { mes: Number($('selMes').value), anio: Number($('selAnio').value) }; }
  function estadoDe(f) { return f.estado === 'VALIDADO' ? 'VALIDADO' : f.estado === 'ENVIADO' ? 'ENVIADO' : 'SIN'; }
  function nombreMes(m) { const x = (typeof MESES !== 'undefined') && MESES.find((k) => k.v === m); return x ? x.l : String(m); }
  function etiquetaMuni(v) { return (window.SIS06PDashboard && window.SIS06PDashboard.MUNICIPIO_LABEL[v]) || v; }
  function fechaCorta(iso) { return iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''; }

  function filasOrdenadas() {
    return st.filas.slice().sort((a, b) => String(a.unidad || '').localeCompare(String(b.unidad || ''), 'es'));
  }
  function municipios() { return [...new Set(st.filas.map((f) => f.municipio).filter(Boolean))]; }
  function filasDe(muni) { return st.filas.filter((f) => f.municipio === muni); }

  function resumen(filas) {
    const r = { total: filas.length, sin: 0, enviado: 0, validado: 0, difs: 0 };
    filas.forEach((f) => {
      const e = estadoDe(f);
      if (e === 'VALIDADO') r.validado++; else if (e === 'ENVIADO') r.enviado++; else r.sin++;
      if (Number(f.diferencias) > 0) r.difs++;
    });
    return r;
  }

  // ------------------------------------------------------------------ datos
  // La jurisdicción solo revisa y valida los hospitales; los municipios los ve como avance.
  function asignarFilas(filas) {
    st.todas = filas;
    st.filas = st.modo === 'juris' ? filas.filter((f) => ES_HOSPITAL[f.municipio]) : filas;
  }
  async function refrescarFilas() {
    const { mes, anio } = periodo();
    if (!window.SIS06PDashboard) return;
    const filas = await window.SIS06PDashboard.cargarFilas(mes, anio);
    if (filas) asignarFilas(filas);
    if (!st.muni || !municipios().includes(st.muni)) st.muni = municipios()[0] || null;
    pintarRuta();
    pintarDock();
    if (st.paso === 2) pintarBarraRevision();
  }

  // ------------------------------------------------- ruta del mes (arriba)
  function estadoPasos() {
    const r = resumen(st.filas);
    const listo = r.total > 0 && r.validado === r.total;
    return [
      { hecho: r.total > 0 && r.sin === 0, texto: r.total ? `${r.total - r.sin} de ${r.total} enviaron` : 'Sin unidades', pill: r.total ? `${r.total - r.sin}/${r.total}` : '', pillCls: r.total > 0 && r.sin === 0 ? 'ok' : '' },
      { hecho: listo, texto: r.total ? `${r.validado} de ${r.total} validadas` : 'Sin unidades', pill: r.total ? `${r.validado}/${r.total}` : '', pillCls: listo ? 'ok' : '' },
      { hecho: listo && r.difs === 0, alerta: r.difs > 0, texto: r.difs ? `${plural(r.difs, 'unidad con diferencia', 'unidades con diferencia')}` : (listo ? 'Sin diferencias' : 'Se arma con lo que validas'), pill: r.difs ? `${r.difs} ≠` : (listo ? '✓' : ''), pillCls: r.difs ? 'aviso' : (listo ? 'ok' : '') },
      { hecho: false, texto: listo ? 'Listo: descarga el CSV oficial' : 'Se habilita al validar todas', pill: listo ? '✓' : '', pillCls: listo ? 'ok' : '' }
    ];
  }

  function pintarRuta() {
    const cont = $('rutaMes');
    if (!cont || !st.activo) return;
    const ps = estadoPasos();
    cont.innerHTML = `
      <ol class="ruta-pasos" aria-label="Pasos del cierre del mes">
        ${PASOS.map((p, i) => {
          const e = ps[i];
          const cls = e.hecho ? 'hecho' : (e.alerta ? 'alerta' : (st.paso === p.n ? 'actual' : ''));
          const estadoTxt = e.hecho ? 'completo' : (e.alerta ? 'requiere atención' : (st.paso === p.n ? 'paso actual' : 'pendiente'));
          return `<li class="ruta-paso ${cls} mun-ruta-paso" data-mpaso="${p.n}" role="button" tabindex="0" ${st.paso === p.n ? 'aria-current="step"' : ''} aria-label="Paso ${p.n}, ${p.t}: ${esc(e.texto)} (${estadoTxt})" title="Ir al paso ${p.n}">
            <span class="ruta-num" aria-hidden="true">${e.hecho ? '<span class="material-symbols-rounded">check</span>' : (e.alerta ? '<span class="material-symbols-rounded">priority_high</span>' : p.n)}</span>
            <span class="ruta-txt"><b>${p.t}</b><small>${esc(e.texto)}</small></span>
          </li>`;
        }).join('')}
      </ol>
      <button type="button" class="ayuda-btn ruta-ayuda" data-ayuda="municipal" title="Cómo funciona el cierre del mes" aria-label="Cómo funciona el cierre del mes"><span class="material-symbols-rounded">help</span></button>`;
    PASOS.forEach((p, i) => {
      const el = $('pildoraMun' + p.n);
      if (!el) return;
      el.textContent = ps[i].pill;
      el.className = 'hoja-pildora' + (ps[i].pillCls ? ' ' + ps[i].pillCls : '');
    });
  }

  // La línea de estatus de la barra flotante: en el paso 2 la pinta la hoja
  // de la unidad (su estado y detalle); en los demás, el resumen del mes.
  function pintarDock() {
    const caja = $('dockEstado');
    if (!caja || !st.activo) return;
    // Movimiento del municipio (paso 3): la barra ya la maneja esa hoja (Guardar/Exportar).
    if (st.paso === 3 && st.vista3 === 'movimiento') return;
    if (st.paso !== 2) {
      ['btnGuardarSIS06P', 'btnExportarSISCompleto', 'btnEnviarSIS06P', 'btnMarcarValidado', 'btnImprimirSIS06P'].forEach((id) => { const b = $(id); if (b) b.style.display = 'none'; });
    }
    if (st.paso === 2) { if (window.SIS06PBiovac) window.SIS06PBiovac.actualizarDock(); return; }
    const r = resumen(st.filas);
    const ps = estadoPasos();
    caja.style.display = 'flex';
    const p = PASOS[st.paso - 1];
    $('dockEstadoTitulo').textContent = `Paso ${p.n} de 4 · ${p.t}`;
    $('dockEstadoDetalle').textContent = ps[p.n - 1].texto;
    $('dockPunto').className = 'dock-punto' + (ps[p.n - 1].hecho ? ' validado' : (r.validado || r.enviado ? ' enviado' : ''));
  }

  // -------------------------------------------------------------- montaje
  function crearPaneles() {
    const antesDe = $('panelCSV');
    const barra = document.createElement('div');
    barra.id = 'munBarraRevision';
    barra.className = 'tarjeta mun-revision';
    barra.style.display = 'none';
    $('panelSIS06P').parentNode.insertBefore(barra, $('panelSIS06P'));

    const conc = document.createElement('div');
    conc.id = 'panelMunConcentrado';
    conc.className = 'tarjeta';
    conc.style.display = 'none';
    antesDe.parentNode.insertBefore(conc, antesDe);

    const ent = document.createElement('div');
    ent.id = 'panelMunEntrega';
    ent.className = 'tarjeta';
    ent.style.display = 'none';
    antesDe.parentNode.insertBefore(ent, antesDe);

    const vivo = document.createElement('div');
    vivo.id = 'munVivo';
    vivo.className = 'mun-sr';
    vivo.setAttribute('role', 'status');
    vivo.setAttribute('aria-live', 'polite');
    document.body.appendChild(vivo);

    const env = document.createElement('div');
    env.id = 'munEnvios';
    $('seguimientoVentana').parentNode.insertBefore(env, $('seguimientoVentana').nextSibling);
  }

  function montarDock() {
    const nav = $('toggleSeccionUnidad');
    const viejo = $('dockHojas');
    const cont = document.createElement('div');
    cont.className = 'dock-hojas';
    cont.id = 'dockPasosMun';
    cont.setAttribute('role', 'tablist');
    cont.setAttribute('aria-label', 'Pasos del cierre del mes');
    cont.innerHTML = '<span class="hoja-tinta" aria-hidden="true"></span>' + PASOS.map((p) => `
      <button type="button" class="hoja-tab" data-mpaso="${p.n}" role="tab" style="--hoja:${p.color};" title="${p.titulo}">
        <span class="material-symbols-rounded">${p.icono}</span><span class="hoja-nombre">${p.n} · ${p.t}</span><span class="hoja-pildora" id="pildoraMun${p.n}"></span>
      </button>`).join('');
    nav.insertBefore(cont, viejo);
    viejo.style.display = 'none';
    if (window.DockGlass) window.DockGlass.instalar(cont);
  }

  function marcarTabs() {
    document.querySelectorAll('#dockPasosMun .hoja-tab').forEach((b) => {
      const activo = Number(b.dataset.mpaso) === st.paso;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
  }

  const ID_PANELES_PROPIOS = ['munBarraRevision', 'panelMunConcentrado', 'panelMunEntrega', 'munMovBarra'];
  function ocultarPropios() { ID_PANELES_PROPIOS.forEach((id) => { const e = $(id); if (e) e.style.display = 'none'; }); }
  function ocultarHojasViejas() { if (window.__sisOcultarTodo) window.__sisOcultarTodo(); }
  function fijarUnidadLegacy(cluesOVacio) {
    const sel = $('selUnidadRevision');
    if (!cluesOVacio) { sel.value = ''; return; }
    const u = (estado.unidadesClues || []).find((x) => x.clues === cluesOVacio);
    if (u) sel.value = u.id;
  }
  async function salidaSegura() {
    return typeof confirmarSalidaSIS06P === 'function' ? confirmarSalidaSIS06P() : true;
  }
  function despertarDock() { if (window.SIS06PBiovac) window.SIS06PBiovac.actualizarDock(); }

  // ------------------------------------------------------------- navegación
  async function irAPaso(n, opciones) {
    if (!(await salidaSegura())) return;
    st.paso = n;
    st.vista3 = 'concentrado';
    ocultarPropios();
    if (n === 1) {
      fijarUnidadLegacy('');
      $('btnSeccionSeguimiento').click();
    } else if (n === 2) {
      await entrarRevision(opciones && opciones.clues);
    } else if (n === 3) {
      ocultarHojasViejas();
      fijarUnidadLegacy('');
      $('panelMunConcentrado').style.display = 'block';
      animarEntrada($('panelMunConcentrado'));
      pintarConcentrado();
    } else {
      ocultarHojasViejas();
      $('panelMunEntrega').style.display = 'block';
      animarEntrada($('panelMunEntrega'));
      // La vista previa del CSV de la hoja vieja necesita una unidad del municipio elegido.
      const u = (estado.unidadesClues || []).find((x) => x.municipio === st.muni);
      if (u) $('selUnidadRevision').value = u.id;
      await pintarEntrega();
      $('btnSeccionCSV').click();
    }
    marcarTabs();
    pintarRuta();
    if (n !== 2) { despertarDock(); pintarDock(); }
    if (!(opciones && opciones.sinScroll)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      anunciarPaso(n);
    }
  }

  // Quien navega con teclado o lector de pantalla: el foco pasa al título del paso y se anuncia dónde quedó.
  function anunciarPaso(n) {
    const p = PASOS[n - 1];
    const vivo = $('munVivo');
    if (vivo) vivo.textContent = `Paso ${p.n} de ${PASOS.length}: ${p.t}`;
    const destino = { 1: '#seguimientoTitulo', 2: '#munBarraRevision .mun-rev-unidad b', 3: '#panelMunConcentrado h2', 4: '#panelMunEntrega h2' }[n];
    const el = destino && document.querySelector(destino);
    if (!el) return;
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  // Reinicia la animación de entrada de un panel (se omite con "reducir movimiento").
  function animarEntrada(panel) {
    if (!panel) return;
    panel.classList.remove('mun-entra');
    void panel.offsetWidth;
    panel.classList.add('mun-entra');
  }

  // ------------------------------------------------------------ paso 1
  function detalleAvance(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    const paloteo = dosis > 0 ? `paloteo ${dosis} dosis` : 'paloteo sin captura';
    const mov = f.movimiento_estado ? (lotes > 0 ? `${plural(lotes, 'lote', 'lotes')} en Movimiento` : 'Movimiento sin lotes') : 'Movimiento sin iniciar';
    return `${paloteo} · ${mov}`;
  }
  function detalleUnidad(f) {
    const e = estadoDe(f);
    if (e === 'VALIDADO') return `Validado por ${f.validado_por || '—'}${f.validado_en ? ', ' + fechaCorta(f.validado_en) : ''}`;
    if (e === 'ENVIADO') return `Enviado por ${f.enviado_por || '—'}${f.enviado_en ? ', ' + fechaCorta(f.enviado_en) : ''}`;
    return detalleAvance(f);
  }
  function pillConciliacion(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    if (dosis === 0 && lotes === 0) return '';
    const n = Number(f.diferencias) || 0;
    return n > 0 ? `<span class="mun-pill aviso">${n} no coincide${n === 1 ? '' : 'n'}</span>` : '<span class="mun-pill ok">Coincide</span>';
  }

  function puntosHtml(filas, actual) {
    return filas.map((f) => `<button type="button" class="pt ${CLASE_EST[estadoDe(f)]} ${f.clues === actual ? 'actual' : ''}" data-clues="${esc(f.clues)}" title="${esc((f.unidad || f.clues) + ' — ' + ETIQUETA[estadoDe(f)])}"></button>`).join('');
  }

  function pintarEnvios(filas) {
    asignarFilas(filas);
    if (!st.muni || !municipios().includes(st.muni)) st.muni = municipios()[0] || null;
    const cont = $('munEnvios');
    if (!cont) return;
    // El seguimiento viejo (tabla, contadores, export) deja de mostrarse: cada
    // cosa vive ahora en su paso.
    ['seguimientoContadores', 'seguimientoVistaTabla', 'seguimientoExportOficial', 'seguimientoVistaGrupos'].forEach((id) => { const e = $(id); if (e) e.style.display = 'none'; });
    const titulo = $('seguimientoTitulo'), sub = $('seguimientoSubtitulo');
    if (titulo) titulo.textContent = 'Envíos del mes';
    if (sub) sub.textContent = 'Quién ya envió su SINBA-SIS y quién falta. Toca una unidad para revisarla.';

    const r = resumen(st.filas);
    if (!st.filas.length) { cont.innerHTML = '<div class="mun-vacio">No hay unidades en tu alcance.</div>'; pintarRuta(); pintarDock(); return; }
    const conteos = { todas: r.total, ENVIADO: r.enviado, SIN: r.sin, VALIDADO: r.validado };
    const visibles = filasOrdenadas().filter((f) => st.filtro === 'todas' || estadoDe(f) === st.filtro)
      .sort((a, b) => ORDEN_EST[estadoDe(a)] - ORDEN_EST[estadoDe(b)]);
    const pct = r.total ? Math.round((r.validado / r.total) * 100) : 0;
    const cta = r.enviado > 0
      ? `<button type="button" class="btn-primario" id="munCtaSiguiente"><span class="material-symbols-rounded">fact_check</span> Revisar la siguiente por validar (${r.enviado})</button>`
      : r.sin > 0
        ? `<span class="mun-espera"><span class="material-symbols-rounded">hourglass_top</span> Faltan ${plural(r.sin, 'unidad', 'unidades')} por enviar</span>`
        : `<button type="button" class="btn-primario" id="munCtaConcentrado"><span class="material-symbols-rounded">table_chart</span> Todo validado: ir al concentrado</button>`;
    const chip = (k, txt) => `<button type="button" class="mun-chip ${st.filtro === k ? 'activo' : ''}" data-filtro="${k}">${txt}<b>${conteos[k]}</b></button>`;

    // Jurisdicción: aquí solo se revisan los hospitales; los municipios se consultan en el concentrado.
    const otros = st.modo === 'juris' ? `
      <div class="mun-aviso"><span class="material-symbols-rounded">info</span>
        <span><b>Tú validas a los hospitales</b> (Nuevo Hospital General y Hospital del Niño y la Mujer): ellos envían su SINBA-SIS y aquí lo revisas y lo validas.
        Cada municipio valida a sus propias unidades. El Movimiento de los municipios y el de la jurisdicción están en el
        <a href="biovac_jurisdiccion.html">Concentrado jurisdiccional</a>.</span></div>`
      : `
      <div class="mun-aviso"><span class="material-symbols-rounded">info</span>
        <span><b>Tú validas a las unidades de tu municipio.</b> Los hospitales (NHG y HENM) no aparecen aquí: los valida la Jurisdicción.</span></div>`;

    cont.innerHTML = `${otros}
      <div class="mun-avance">
        <div class="mun-avance-cab"><div><b>${nombreMes(periodo().mes)} ${periodo().anio}</b><small>${r.total - r.sin} de ${r.total} unidades ya enviaron su SINBA-SIS</small></div><span class="mun-pct">${r.validado}/${r.total} validadas</span></div>
        <div class="mun-barra"><i style="width:${pct}%"></i></div>
        <div class="puntos">${puntosHtml(filasOrdenadas(), null)}</div>
        <div class="mun-leyenda"><span><i class="pt vacio"></i>sin enviar</span><span><i class="pt parcial"></i>por validar</span><span><i class="pt completo"></i>validada</span></div>
      </div>
      <div class="mun-acciones">${cta}
        <div class="mun-chips">${chip('todas', 'Todas')}${chip('ENVIADO', 'Por validar')}${chip('SIN', 'Sin enviar')}${chip('VALIDADO', 'Validadas')}</div>
      </div>
      <div class="mun-grid">${visibles.map((f) => `
        <button type="button" class="mun-unidad ${CLASE_EST[estadoDe(f)]}" data-clues="${esc(f.clues)}">
          <span class="mun-dot"></span>
          <span class="mun-u-txt"><b>${esc(f.unidad || f.clues)}</b><small>${esc(f.clues)} · ${esc(detalleUnidad(f))}</small></span>
          <span class="mun-u-pills"><span class="mun-pill ${CLASE_EST[estadoDe(f)]}">${ETIQUETA[estadoDe(f)]}</span>${pillConciliacion(f)}${Number(f.correcciones_pendientes) > 0 ? `<span class="mun-pill aviso" title="Correcciones pendientes">${f.correcciones_pendientes}</span>` : ''}</span>
        </button>`).join('') || '<div class="mun-vacio">Ninguna unidad en este filtro.</div>'}</div>`;
    pintarRuta();
    pintarDock();
  }

  // ------------------------------------------------------------ paso 2
  function unidadesNav() { return filasOrdenadas(); }
  function siguientePendiente(desde) {
    const lista = unidadesNav();
    if (!lista.length) return null;
    const i = lista.findIndex((f) => f.clues === desde);
    for (let k = 1; k <= lista.length; k++) {
      const f = lista[(i + k + lista.length) % lista.length];
      if (f.clues !== desde && estadoDe(f) === 'ENVIADO') return f;
    }
    return null;
  }

  async function entrarRevision(cluesElegida) {
    if (!st.filas.length) await refrescarFilas();
    const lista = unidadesNav();
    if (!lista.length) { toast('No hay unidades en tu alcance.', 'error'); st.paso = 1; return irAPaso(1); }
    const destino = cluesElegida || st.clues || (siguientePendiente(null) || lista[0]).clues;
    st.clues = destino;
    $('munBarraRevision').style.display = 'block';
    fijarUnidadLegacy(destino);
    pintarBarraRevision();
    // Mismo gesto que ya usaba el seguimiento: abrir la hoja y luego avisar del cambio de unidad.
    $(st.hojaActual || 'btnSeccionSIS06P').click();
    $('selUnidadRevision').dispatchEvent(new Event('change'));
  }

  function pintarBarraRevision() {
    const cont = $('munBarraRevision');
    if (!cont || st.paso !== 2) return;
    const lista = unidadesNav();
    const f = lista.find((x) => x.clues === st.clues) || lista[0];
    const r = resumen(st.filas);
    const idx = lista.findIndex((x) => x.clues === (f && f.clues));
    const e = f ? estadoDe(f) : 'SIN';
    cont.innerHTML = `
      <div class="mun-rev-fila">
        <button type="button" class="mun-nav" id="munPrev" title="Unidad anterior" aria-label="Unidad anterior"><span class="material-symbols-rounded">chevron_left</span></button>
        <div class="mun-rev-unidad">
          <b>${esc(f ? (f.unidad || f.clues) : '')}</b>
          <small>${esc(f ? f.clues : '')} · unidad ${idx + 1} de ${lista.length} <span class="mun-pill ${CLASE_EST[e]}">${ETIQUETA[e]}</span></small>
        </div>
        <button type="button" class="mun-nav" id="munNext" title="Unidad siguiente" aria-label="Unidad siguiente"><span class="material-symbols-rounded">chevron_right</span></button>
        <select id="munRevSelect" class="mun-select" aria-label="Elegir unidad">${lista.map((x) => `<option value="${esc(x.clues)}" ${f && x.clues === f.clues ? 'selected' : ''}>${esc(x.unidad || x.clues)}</option>`).join('')}</select>
        <button type="button" class="btn-secundario btn-mini" id="munSigPend" ${r.enviado - (e === 'ENVIADO' ? 1 : 0) > 0 ? '' : 'disabled'}><span class="material-symbols-rounded">skip_next</span> Siguiente por validar (${r.enviado})</button>
      </div>
      <div class="puntos mun-rev-puntos">${puntosHtml(lista, f && f.clues)}</div>
      <div class="mun-hojas" role="tablist">${HOJAS.map((h) => `
        <button type="button" class="mun-hoja" data-hoja="${h.id}" style="--hoja:${h.color};" role="tab">
          <span class="material-symbols-rounded">${h.icono}</span>${h.t}<span class="mun-hoja-pildora" data-pildora="${h.pildora}"></span>
        </button>`).join('')}
        <button type="button" class="ayuda-btn" data-ayuda="mun_revision" title="Cómo revisar y validar" aria-label="Cómo revisar y validar" style="margin-left:auto;"><span class="material-symbols-rounded">help</span></button>
      </div>`;
    espejoHojas();
  }

  // Refleja en las pestañas propias cuál hoja vieja está activa y sus píldoras vivas.
  function espejoHojas() {
    const cont = $('munBarraRevision');
    if (!cont) return;
    HOJAS.forEach((h) => {
      const legacy = $(h.id);
      const chip = cont.querySelector(`[data-hoja="${h.id}"]`);
      if (!legacy || !chip) return;
      const activa = legacy.classList.contains('activo') && st.vista3 !== 'movimiento';
      chip.classList.toggle('activo', activa);
      if (activa) st.hojaActual = h.id;
      const p = $(h.pildora);
      const span = chip.querySelector('.mun-hoja-pildora');
      const txt = p ? p.textContent.replace(/​/g, '').trim() : '';
      span.textContent = txt;
      span.className = 'mun-hoja-pildora' + (p && p.classList.contains('aviso') ? ' aviso' : p && p.classList.contains('ok') ? ' ok' : '') + (!txt && p && p.classList.contains('punto') ? ' punto' : '');
    });
  }

  async function cambiarUnidad(clues) {
    if (!clues || clues === st.clues) return;
    if (!(await salidaSegura())) { pintarBarraRevision(); return; }
    st.clues = clues;
    fijarUnidadLegacy(clues);
    pintarBarraRevision();
    $('selUnidadRevision').dispatchEvent(new Event('change'));
  }

  function moverUnidad(delta) {
    const lista = unidadesNav();
    const i = lista.findIndex((x) => x.clues === st.clues);
    const f = lista[(i + delta + lista.length) % lista.length];
    if (f) cambiarUnidad(f.clues);
  }

  async function revisar(clues, hoja) {
    if (hoja) st.hojaActual = hoja;
    if (st.paso === 2) return cambiarUnidad(clues);
    return irAPaso(2, { clues });
  }

  async function alValidar() {
    await refrescarFilas();
    const sig = siguientePendiente(st.clues);
    if (st.paso !== 2) return;
    if (sig) {
      toast(`Validada. Sigue ${sig.unidad || sig.clues}.`, 'ok');
      cambiarUnidad(sig.clues);
    } else {
      toast('Ya no quedan unidades por validar.', 'ok');
      pintarBarraRevision();
    }
  }

  // ------------------------------------------------------------ paso 3
  function chipsMunicipio(accion) {
    const ms = municipios();
    if (ms.length < 2) return '';
    return `<div class="mun-chips" style="margin:0 0 12px;" role="group" aria-label="Municipio">${ms.map((m) => `<button type="button" class="mun-chip ${st.muni === m ? 'activo' : ''}" aria-pressed="${st.muni === m}" data-${accion}="${esc(m)}">${esc(etiquetaMuni(m))}</button>`).join('')}</div>`;
  }

  // Unidad "pseudo" (JS1-...) que guarda el Movimiento del propio municipio.
  function pseudoDe(muni) { return (estado.unidadesPseudo || []).find((u) => u.municipio === muni) || null; }
  function esDerivado(u, mes, anio) { return typeof movimientoEsDerivado === 'function' && movimientoEsDerivado(u.id, anio, mes); }

  // Estado del Movimiento (BIOVAC) del municipio: { u, derivado, mov }. Desde octubre 2026 es la suma de las unidades.
  async function leerMovimientoMuni(muni, mes, anio) {
    const u = pseudoDe(muni);
    if (!u) return { u: null, derivado: false, mov: null };
    if (esDerivado(u, mes, anio)) return { u, derivado: true, mov: null };
    const { data, error } = await estado.db.from('biovac_movimientos').select('*').eq('unidad_id', u.id).eq('anio', anio).eq('mes', mes).maybeSingle();
    if (error) throw error;
    return { u, derivado: false, mov: data };
  }

  function bajarArchivo(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // Excel BIOVAC (formato oficial de Movimiento de Biológico) del municipio, sin abrir la hoja.
  async function descargarMovimientoBiovac(muni, mes, anio) {
    try {
      const info = await leerMovimientoMuni(muni, mes, anio);
      if (info.derivado) { toast('Desde octubre el Movimiento del municipio se arma de sus unidades: cada unidad exporta el suyo.', 'error'); return false; }
      if (!info.mov) { toast('Este mes todavía no tiene Movimiento del municipio: ábrelo y captúralo primero.', 'error'); return false; }
      const resp = await fetch('./Formatos/biovac_plantilla.xlsx');
      if (!resp.ok) throw new Error('No se pudo cargar la plantilla de Movimiento de Biológico.');
      const unidad = (estado.unidades || []).find((x) => x.id === info.u.id) || info.u;
      const buffer = await BiovacExportExcel.exportarExcel({ db: estado.db, unidad, movimiento: info.mov, plantillaBuffer: await resp.arrayBuffer() });
      bajarArchivo(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Movimiento_Biologico_${unidad.nombre}_${anio}-${String(mes).padStart(2, '0')}.xlsx`);
      toast('Excel de Movimiento de Biológico (BIOVAC) generado.', 'ok');
      return true;
    } catch (err) { toast('No se pudo exportar el Movimiento: ' + (err.message || err), 'error'); return false; }
  }

  // Botón con "cargando": se bloquea, cambia el ícono por uno que gira y avisa al lector de pantalla.
  async function conCarga(btn, tarea) {
    if (!btn || btn.disabled) return;
    const ico = btn.querySelector('.material-symbols-rounded');
    const icoOriginal = ico && ico.textContent;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.classList.add('mun-cargando');
    if (ico) ico.textContent = 'progress_activity';
    try { return await tarea(); }
    finally {
      btn.disabled = false; btn.removeAttribute('aria-busy'); btn.classList.remove('mun-cargando');
      if (ico) ico.textContent = icoOriginal;
    }
  }

  const ESTADO_MOV = {
    BORRADOR: { cls: 'pend', txt: 'Abierto · se guarda solo', icono: 'edit_note' },
    EN_CORRECCION: { cls: 'aviso', txt: 'En corrección', icono: 'edit_note' },
    CERRADO: { cls: 'ok', txt: 'Mes cerrado', icono: 'lock' }
  };

  function chipEstado(cls, txt, icono) {
    return `<span class="mun-estado ${cls}"><span class="material-symbols-rounded" aria-hidden="true">${icono}</span>${esc(txt)}</span>`;
  }

  function filaArchivo(i, icono, color, titulo, detalle, boton) {
    return `<li class="mun-archivo" style="--i:${i}">
      <span class="mun-archivo-ico" style="--c:${color};" aria-hidden="true"><span class="material-symbols-rounded">${icono}</span></span>
      <div class="mun-archivo-txt"><b>${titulo}</b><small>${detalle}</small></div>
      ${boton}
    </li>`;
  }

  function pintarConcentrado() {
    const panel = $('panelMunConcentrado');
    const { mes, anio } = periodo();
    const muni = st.muni;
    const juris = st.modo === 'juris';
    const nombre = etiquetaMuni(muni) || 'tu municipio';
    const resu = resumen(filasDe(muni));
    const listoCSV = resu.total > 0 && resu.validado === resu.total;
    const token = ++st.tokenConc;
    st.conc = null;
    const pseudo = pseudoDe(muni);
    const esManual = !juris && !!pseudo && !esDerivado(pseudo, mes, anio);

    panel.innerHTML = `
      <div class="mun-cab">
        <div class="mun-cab-icono" style="background:#f0fdf4; border-color:#bbf7d0;"><span class="material-symbols-rounded" style="color:#16a34a;">table_chart</span></div>
        <div style="flex:1; min-width:220px;">
          <h2>Concentrado de ${esc(nombre)} · ${nombreMes(mes)} ${anio}<button type="button" class="ayuda-btn" data-ayuda="mun_concentrado" title="Cómo leer el concentrado" aria-label="Cómo leer el concentrado"><span class="material-symbols-rounded">help</span></button></h2>
          <p class="subtitulo">Tres cosas, en este orden: verifica que cuadre, deja listo el Movimiento del municipio y descarga tus archivos.</p>
        </div>
      </div>
      ${chipsMunicipio('conc')}
      <ol class="mun-fases">
        <li class="mun-fase" style="--i:0" id="munFaseVerif">
          <div class="mun-fase-cab">
            <span class="mun-fase-num" aria-hidden="true">1</span>
            <div class="mun-fase-tit"><h3>Verifica que cuadre</h3><p>El paloteo de cada unidad contra lo que aplicó en su Movimiento, y lo recibido contra la requisición.</p></div>
            <span id="munVerifEstado" aria-live="polite">${chipEstado('carga', 'Revisando…', 'hourglass_top')}</span>
          </div>
          <div class="mun-fase-cuerpo">
            ${esManual ? `<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>${nombreMes(mes)}: las unidades todavía no capturan su propio Movimiento, así que cualquier diferencia que aparezca aquí puede venir de capturas de prueba. Revísalo antes de entregar.</span></p>` : ''}
            <details class="mun-det" id="munDetConciliacion"><summary id="munSumConciliacion">Paloteo contra Movimiento, unidad por unidad</summary><div id="munConcComparativo" class="mun-det-cuerpo"></div></details>
            <details class="mun-det" id="munDetRecibido"><summary>Recibido contra requisición</summary><div id="munConcRecibido" class="mun-det-cuerpo"></div></details>
          </div>
        </li>
        <li class="mun-fase" style="--i:1" id="munFaseMov">
          <div class="mun-fase-cab">
            <span class="mun-fase-num" aria-hidden="true">2</span>
            <div class="mun-fase-tit"><h3>Movimiento de Biológico del municipio (BIOVAC)</h3><p>Entradas, recibidos, aplicados, desechos y existencia final, por lote y caducidad, con ARF y canjes.</p></div>
            <span id="munMovEstadoFase" aria-live="polite">${juris ? '' : chipEstado('carga', 'Consultando…', 'hourglass_top')}</span>
          </div>
          <div class="mun-fase-cuerpo" id="munMovCuerpo">
            ${juris ? '<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>El Movimiento de los municipios y el de la jurisdicción se concentran en otra pantalla.</span></p><div class="mun-fase-acciones"><a class="btn-secundario btn-mini" href="biovac_jurisdiccion.html" style="text-decoration:none;"><span class="material-symbols-rounded">query_stats</span> Concentrado jurisdiccional</a></div>' : ''}
          </div>
        </li>
        <li class="mun-fase" style="--i:2" id="munFaseArchivos">
          <div class="mun-fase-cab">
            <span class="mun-fase-num" aria-hidden="true">3</span>
            <div class="mun-fase-tit"><h3>Descarga tus archivos</h3><p>Cada archivo se baja desde aquí; no hay que buscar el botón dentro de otra pantalla.</p></div>
          </div>
          <ul class="mun-archivos">
            ${filaArchivo(0, 'table_chart', '#16a34a', 'Excel del concentrado municipal', 'Cuatro hojas: PALOTEO, SEGUIMIENTO DE BIOLÓGICO (acumulado por biológico, sin lotes, ARF ni canjes), CSV y Recibido vs. requisición.',
              '<button type="button" class="btn-secundario btn-mini" data-descarga="conc" disabled aria-label="Descargar Excel del concentrado municipal"><span class="material-symbols-rounded">download</span> Descargar Excel</button>')}
            ${juris ? '' : filaArchivo(1, 'inventory_2', '#d97706', 'Excel de Movimiento de Biológico (BIOVAC)', 'El formato por lote y caducidad, con entradas, recibidos, aplicados, desechos, existencia final, ARF y canjes.',
              '<button type="button" class="btn-secundario btn-mini" data-descarga="mov" disabled aria-label="Descargar Excel de Movimiento de Biológico"><span class="material-symbols-rounded">download</span> Descargar Excel</button>')}
            ${filaArchivo(2, 'description', '#7c3aed', 'CSV oficial para estadística', listoCSV ? 'Una fila por clave SIS de cada unidad validada.' : `Se habilita cuando todas las unidades estén validadas (${resu.validado} de ${resu.total}).`,
              `<button type="button" class="btn-secundario btn-mini" data-descarga="csv" ${listoCSV ? '' : 'disabled'} aria-label="Descargar CSV oficial"><span class="material-symbols-rounded">download</span> Descargar CSV</button>`)}
          </ul>
        </li>
      </ol>
      <details class="mun-det mun-det-grande"><summary>Ver el concentrado en pantalla (paloteo y seguimiento de biológico)</summary><div id="munConcTablas" class="mun-det-cuerpo"></div></details>
      <div class="mun-siguiente">
        <span>Cuando todo cuadre y tengas tus archivos, sigue con la entrega.</span>
        <button type="button" class="btn-primario" id="munIrEntrega">Continuar a Entrega <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </div>`;

    const vigente = () => token === st.tokenConc && st.activo && st.paso === 3 && st.vista3 === 'concentrado';
    const verif = { cmp: undefined, rec: undefined, recTotal: 0 };
    const cerrarVerif = () => {
      if (verif.cmp === undefined || verif.rec === undefined || !vigente()) return;
      const dif = (verif.cmp ? verif.cmp.conDiferencia : 0) + verif.rec;
      const nada = (!verif.cmp || verif.cmp.total === 0) && verif.recTotal === 0;
      const caja = $('munVerifEstado'); if (!caja) return;
      caja.innerHTML = nada ? chipEstado('info', 'Sin datos todavía', 'info')
        : dif === 0 ? chipEstado('ok', 'Todo cuadra', 'check_circle')
        : chipEstado('aviso', plural(dif, 'cosa por revisar', 'cosas por revisar'), 'error');
    };

    if (muni && window.SIS06PDashboard) {
      Promise.resolve(window.SIS06PDashboard.renderComparativoAplicado($('munConcComparativo'), muni, mes, anio)).then((r) => {
        if (!vigente()) return;
        verif.cmp = r || { total: 0, conDiferencia: 0 };
        const sum = $('munSumConciliacion');
        if (sum && verif.cmp.conDiferencia) { sum.innerHTML = `Paloteo contra Movimiento, unidad por unidad <span class="mun-mini-pill aviso">${verif.cmp.conDiferencia} con diferencia</span>`; $('munDetConciliacion').open = true; }
        cerrarVerif();
      });
    } else { verif.cmp = null; }

    if (muni && window.SIS06PConcentradoMunicipal) {
      window.SIS06PConcentradoMunicipal.render($('munConcTablas'), muni, mes, anio, { sinBoton: true, sinRecibido: true }).then((api) => {
        if (!vigente()) return;
        st.conc = api;
        const rec = $('munConcRecibido');
        if (rec) rec.innerHTML = api ? api.htmlRecibido() : '<div class="mun-vacio">No se pudo cargar.</div>';
        verif.rec = api ? api.nDifRecibido : 0;
        verif.recTotal = api ? api.d.requisicion.length : 0;
        if (api && api.nDifRecibido > 0) $('munDetRecibido').open = true;
        const b = panel.querySelector('[data-descarga="conc"]');
        if (b && api) b.disabled = false;
        cerrarVerif();
      });
    } else { verif.rec = 0; }

    if (!juris) pintarFaseMovimiento(muni, mes, anio, esManual, vigente);
  }

  async function pintarFaseMovimiento(muni, mes, anio, esManual, vigente) {
    let info;
    try { info = await leerMovimientoMuni(muni, mes, anio); }
    catch (err) {
      if (vigente() && $('munMovEstadoFase')) $('munMovEstadoFase').innerHTML = chipEstado('aviso', 'No se pudo consultar', 'error');
      return;
    }
    if (!vigente()) return;
    const caja = $('munMovEstadoFase'), cuerpo = $('munMovCuerpo');
    if (!caja || !cuerpo) return;
    const abrir = (txt, primario) => `<button type="button" class="${primario ? 'btn-primario' : 'btn-secundario'} btn-mini" id="munVerMovimiento"><span class="material-symbols-rounded" aria-hidden="true">inventory_2</span> ${txt}</button>`;
    if (!info.u) {
      caja.innerHTML = chipEstado('info', 'Sin Movimiento propio', 'info');
      cuerpo.innerHTML = '<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Este municipio no tiene Movimiento propio: lo concentra la Jurisdicción.</span></p>';
      return;
    }
    if (info.derivado) {
      caja.innerHTML = chipEstado('ok', 'Se arma solo', 'auto_awesome');
      cuerpo.innerHTML = '<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span><span>Desde octubre 2026 el Movimiento del municipio es la suma de sus unidades: no se captura ni se cierra aquí. Cada unidad exporta el suyo.</span></p>';
      return;
    }
    const intro = esManual ? `<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><span><b>${nombreMes(mes)} se captura a mano en el municipio</b>, porque las unidades todavía no capturan el suyo. Desde octubre se arma solo.</span></p>` : '';
    if (!info.mov) {
      caja.innerHTML = chipEstado('pend', 'Sin iniciar', 'radio_button_unchecked');
      cuerpo.innerHTML = `${intro}<div class="mun-fase-acciones">${abrir('Iniciar y capturar', true)}</div>`;
      return;
    }
    const e = ESTADO_MOV[info.mov.estado] || ESTADO_MOV.BORRADOR;
    caja.innerHTML = chipEstado(e.cls, e.txt, e.icono);
    const cerrado = info.mov.estado === 'CERRADO';
    const ayuda = cerrado
      ? 'El mes ya está cerrado: la existencia final pasó al mes siguiente. Para cambiar algo, ábrelo y usa «Corregir movimiento» (queda registrado).'
      : 'Lo que captures se guarda solo al salir de cada celda. Cuando todo cuadre, usa <b>Cerrar mes</b> en la barra de abajo: termina el mes, lo bloquea y pasa la existencia final al mes siguiente.';
    cuerpo.innerHTML = `${intro}<p class="mun-ayuda-mov">${ayuda}</p><div class="mun-fase-acciones">${abrir(cerrado ? 'Ver Movimiento' : 'Abrir y capturar', !cerrado)}</div>`;
    const btn = document.querySelector('#panelMunConcentrado [data-descarga="mov"]');
    if (btn) btn.disabled = false;
  }

  // Estado vivo del Movimiento dentro de su barra (cambia al cerrar, reabrir o corregir).
  function estadoMovEnBarra() {
    const chip = $('munMovEstado');
    if (!chip) return;
    const m = estado.movimiento;
    if (!m) { chip.innerHTML = ''; return; }
    const e = ESTADO_MOV[m.estado] || ESTADO_MOV.BORRADOR;
    chip.innerHTML = chipEstado(e.cls, e.txt, e.icono);
    document.querySelectorAll('#munMovBarra .mun-guia li').forEach((li) => li.classList.toggle('hecho', m.estado === 'CERRADO'));
  }

  async function verMovimiento() {
    if (!(await salidaSegura())) return;
    st.vista3 = 'movimiento';
    ocultarPropios();
    fijarUnidadLegacy('');
    // El Movimiento del municipio vive en la unidad "pseudo" de ESTE municipio (no en la que haya quedado elegida).
    const pseudo = pseudoDe(st.muni);
    if (pseudo && $('selUnidad')) $('selUnidad').value = pseudo.id;
    const barra = $('munMovBarra') || (() => {
      const b = document.createElement('div');
      b.id = 'munMovBarra';
      b.className = 'tarjeta mun-mov-barra';
      $('panelMunConcentrado').parentNode.insertBefore(b, $('panelMunConcentrado'));
      return b;
    })();
    barra.innerHTML = `
      <div class="mun-mov-fila">
        <button type="button" class="btn-secundario btn-mini" id="munVolverConcentrado"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Volver al concentrado</button>
        <h2 class="mun-mov-tit" tabindex="-1">Movimiento de Biológico (BIOVAC) · ${esc(etiquetaMuni(st.muni) || '')}</h2>
        <span id="munMovEstado" aria-live="polite"></span>
        <button type="button" class="btn-secundario btn-mini" id="munMovExcel"><span class="material-symbols-rounded" aria-hidden="true">download</span> Descargar Excel</button>
      </div>
      <ol class="mun-guia">
        <li><i aria-hidden="true">1</i><div><b>Captura</b><small>Cada celda se guarda sola al salir de ella. El botón Guardar de la barra de abajo es solo para confirmarlo.</small></div></li>
        <li><i aria-hidden="true">2</i><div><b>Revisa</b><small>La existencia final debe cuadrar con el paloteo del concentrado.</small></div></li>
        <li><i aria-hidden="true">3</i><div><b>Cerrar mes</b><small>Da el mes por terminado: lo bloquea y pasa la existencia final al mes siguiente. Se puede reabrir con un motivo.</small></div></li>
      </ol>`;
    barra.style.display = 'block';
    animarEntrada(barra);
    $('btnSeccionMovimiento').click();
    estadoMovEnBarra();
    const foco = barra.querySelector('.mun-mov-tit'); if (foco) foco.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------ paso 4
  async function pintarEntrega() {
    const panel = $('panelMunEntrega');
    const { mes, anio } = periodo();
    const muni = st.muni;
    const filas = filasDe(muni);
    const r = resumen(filas);
    const listo = r.total > 0 && r.validado === r.total;
    panel.innerHTML = `
      <div class="mun-cab">
        <div class="mun-cab-icono" style="background:#f5f3ff; border-color:#ddd6fe;"><span class="material-symbols-rounded" style="color:#7c3aed;">outbox</span></div>
        <div style="flex:1; min-width:220px;">
          <h2>Entrega de ${esc(etiquetaMuni(muni) || 'tu municipio')} · ${nombreMes(mes)} ${anio}<button type="button" class="ayuda-btn" data-ayuda="mun_entrega" title="Cómo entregar" aria-label="Cómo entregar"><span class="material-symbols-rounded">help</span></button></h2>
          <p class="subtitulo">Antes de descargar, esta lista te dice si algo quedó pendiente.</p>
        </div>
      </div>
      ${chipsMunicipio('ent')}
      <ul class="mun-check" id="munCheck">
        <li class="${listo ? 'ok' : 'pend'}"><span class="material-symbols-rounded">${listo ? 'check_circle' : 'radio_button_unchecked'}</span><div><b>Todas las unidades validadas</b><small>${r.validado} de ${r.total}${listo ? '' : ` — faltan ${r.total - r.validado}`}</small></div>${listo ? '' : '<button type="button" class="btn-secundario btn-mini" id="munIrPendientes">Ir a revisar</button>'}</li>
        <li class="${r.difs === 0 ? 'ok' : 'pend'}"><span class="material-symbols-rounded">${r.difs === 0 ? 'check_circle' : 'error'}</span><div><b>Paloteo y Movimiento coinciden</b><small>${r.difs === 0 ? 'Ninguna unidad con diferencia' : plural(r.difs, 'unidad con diferencia', 'unidades con diferencia')}</small></div></li>
        <li class="cargando" id="munCheckRecibido"><span class="material-symbols-rounded">hourglass_top</span><div><b>Recibido igual a la requisición</b><small>Comparando…</small></div></li>
      </ul>
      <div class="mun-entregar">
        <div><b>CSV oficial</b><small>El archivo que se sube al departamento de estadística: una fila por clave SIS de cada unidad validada.</small></div>
        <button type="button" class="btn-primario" id="munDescargarCSV" ${listo ? '' : 'disabled'} title="${listo ? 'Descargar el CSV oficial' : 'Se habilita cuando todas las unidades estén validadas'}"><span class="material-symbols-rounded">download</span> Descargar CSV oficial</button>
      </div>
      <div class="mun-entregar">
        <div><b>Indicadores (RDA)</b><small id="munPubEstado">${listo ? 'Consultando…' : 'Se carga sola al validar la última unidad.'}</small></div>
        <button type="button" class="btn-secundario" id="munPublicar" ${listo ? '' : 'disabled'} title="${listo ? 'Cargar de nuevo el concentrado validado a los indicadores' : 'Se habilita cuando todas las unidades estén validadas'}"><span class="material-symbols-rounded">cloud_upload</span> Cargar a indicadores</button>
      </div>
      <p class="mun-nota-csv">Abajo, la vista previa: se va llenando con lo que capturan las unidades. El archivo que se descarga tiene el mismo formato que la hoja CSV del Excel oficial.</p>`;
    if (listo && window.SIS06PDashboard) window.SIS06PDashboard.pintarEstadoPublicacion($('munPubEstado'), muni, mes, anio);
    // Recibido vs requisición: informativo, nunca bloquea.
    try {
      const { data, error } = await estado.db.rpc('sis06p_recibido_vs_requisicion', { p_mes: mes, p_anio: anio, p_municipio: muni });
      if (error) throw error;
      const dif = (data || []).filter((f) => !f.coincide).length;
      const li = $('munCheckRecibido');
      if (li) {
        li.className = !data || data.length === 0 ? 'info' : (dif === 0 ? 'ok' : 'aviso');
        li.innerHTML = `<span class="material-symbols-rounded">${!data || !data.length ? 'info' : dif === 0 ? 'check_circle' : 'warning'}</span><div><b>Recibido igual a la requisición</b><small>${!data || !data.length ? 'Sin requisición de este mes para comparar' : dif === 0 ? 'Coincide en todos los biológicos' : `${plural(dif, 'renglón no coincide', 'renglones no coinciden')} (informativo, no bloquea)`}</small></div>`;
      }
    } catch (err) {
      const li = $('munCheckRecibido');
      if (li) { li.className = 'info'; li.querySelector('small').textContent = 'No se pudo comparar (informativo)'; }
    }
  }

  // -------------------------------------------------------------- eventos
  function descargar(btn) {
    const { mes, anio } = periodo();
    const tipo = btn.dataset.descarga;
    if (tipo === 'conc') return conCarga(btn, () => (st.conc ? st.conc.descargar() : null));
    if (tipo === 'mov') return conCarga(btn, () => descargarMovimientoBiovac(st.muni, mes, anio));
    if (tipo === 'csv') return conCarga(btn, async () => window.SIS06PDashboard.exportarCSVOficialMunicipio(st.muni, mes, anio));
  }

  function cablear() {
    // Los pasos de arriba son botones: también responden a Enter y Espacio.
    document.addEventListener('keydown', (ev) => {
      if (!st.activo || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      const paso = ev.target.closest && ev.target.closest('.mun-ruta-paso');
      if (paso) { ev.preventDefault(); irAPaso(Number(paso.dataset.mpaso)); }
    });
    document.addEventListener('click', (ev) => {
      if (!st.activo) return;
      const t = ev.target;
      const tab = t.closest('[data-mpaso]');
      if (tab) { irAPaso(Number(tab.dataset.mpaso)); return; }
      const dl = t.closest('[data-descarga]');
      if (dl) { descargar(dl); return; }
      const punto = t.closest('.pt[data-clues]');
      if (punto) { revisar(punto.dataset.clues); return; }
      const unidad = t.closest('.mun-unidad');
      if (unidad) { revisar(unidad.dataset.clues); return; }
      const filtro = t.closest('[data-filtro]');
      if (filtro) { st.filtro = filtro.dataset.filtro; pintarEnvios(st.filas); return; }
      const hoja = t.closest('.mun-hoja');
      if (hoja) { st.hojaActual = hoja.dataset.hoja; $(hoja.dataset.hoja).click(); setTimeout(espejoHojas, 0); return; }
      const conc = t.closest('[data-conc]');
      if (conc) { st.muni = conc.dataset.conc; pintarConcentrado(); return; }
      const ent = t.closest('[data-ent]');
      if (ent) { st.muni = ent.dataset.ent; irAPaso(4, { sinScroll: true }); return; }
      if (t.closest('#munPrev')) moverUnidad(-1);
      else if (t.closest('#munNext')) moverUnidad(1);
      else if (t.closest('#munSigPend')) { const s = siguientePendiente(st.clues); if (s) cambiarUnidad(s.clues); }
      else if (t.closest('#munCtaSiguiente')) { const s = siguientePendiente(null); if (s) revisar(s.clues); }
      else if (t.closest('#munCtaConcentrado')) irAPaso(3);
      else if (t.closest('#munVerMovimiento')) verMovimiento();
      else if (t.closest('#munVolverConcentrado')) irAPaso(3);
      else if (t.closest('#munIrEntrega')) irAPaso(4);
      else if (t.closest('#munMovExcel')) { const { mes, anio } = periodo(); conCarga(t.closest('#munMovExcel'), () => descargarMovimientoBiovac(st.muni, mes, anio)); }
      else if (t.closest('#munIrPendientes')) { st.filtro = 'ENVIADO'; irAPaso(1); }
      else if (t.closest('#munDescargarCSV')) window.SIS06PDashboard.exportarCSVOficialMunicipio(st.muni, periodo().mes, periodo().anio);
      else if (t.closest('#munPublicar')) {
        const { mes, anio } = periodo();
        window.SIS06PDashboard.publicarMunicipio(st.muni, mes, anio, etiquetaMuni(st.muni) || st.muni)
          .then((hecho) => { if (hecho) window.SIS06PDashboard.pintarEstadoPublicacion($('munPubEstado'), st.muni, mes, anio); });
      }
    });
    document.addEventListener('change', (ev) => {
      if (st.activo && ev.target && ev.target.id === 'munRevSelect') cambiarUnidad(ev.target.value);
    });
    // Se mantiene el espejo de pestañas/píldoras de las hojas de la unidad.
    const observador = new MutationObserver(() => espejoHojas());
    HOJAS.forEach((h) => {
      const b = $(h.id); if (b) observador.observe(b, { attributes: true, attributeFilter: ['class'] });
      const p = $(h.pildora); if (p) observador.observe(p, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    // El estado del Movimiento (abierto / cerrado / en corrección) se refleja en su barra cuando la hoja lo cambia.
    const obsMov = new MutationObserver(() => { if (st.activo && st.vista3 === 'movimiento') estadoMovEnBarra(); });
    ['btnCerrarMes', 'btnAbrirCorreccion', 'btnAplicarCorreccion'].forEach((id) => { const b = $(id); if (b) obsMov.observe(b, { attributes: true, attributeFilter: ['style'] }); });
    const bannerMov = $('bannerMovimiento'); if (bannerMov) obsMov.observe(bannerMov, { childList: true });
    document.addEventListener('sis06p:validado', () => { if (st.activo) alValidar(); });
    // La publicación automática termina después de la validación: repinta el estado en el paso de entrega.
    document.addEventListener('sis06p:publicado', (ev) => {
      const el = $('munPubEstado');
      if (st.activo && el && ev.detail) window.SIS06PDashboard.pintarEstadoPublicacion(el, ev.detail.municipio, ev.detail.mes, ev.detail.anio);
    });
    const alCambiarPeriodo = async () => {
      if (!st.activo) return;
      await refrescarFilas();
      if (st.paso === 3 && st.vista3 === 'concentrado') pintarConcentrado();
      else if (st.paso === 4) irAPaso(4, { sinScroll: true });
    };
    $('selMes').addEventListener('change', alCambiarPeriodo);
    $('selAnio').addEventListener('change', alCambiarPeriodo);
  }

  async function init() {
    if (st.activo) return;
    st.activo = true;
    st.modo = estado.perfil && estado.perfil.rol === 'JURISDICCIONAL' ? 'juris' : 'municipal';
    document.body.classList.add('mun-guiado');
    $('tituloPagina').textContent = st.modo === 'juris' ? 'SINBA-SIS · Cierre de hospitales' : 'SINBA-SIS · Cierre del municipio';
    $('subtituloPagina').style.display = 'none';
    $('rutaMes').style.display = 'flex';
    document.title = 'SINBA-SIS municipal — SIREVAQ';
    // "Usuario" es solo la sesión (queda oculto pero se sigue usando para la auditoría) y
    // "Municipio" solo hace falta si el perfil tiene más de uno.
    const ocultarCampo = (id) => { const c = $(id) && $(id).closest('.campo'); if (c) c.style.display = 'none'; };
    ocultarCampo('selUsuario');
    if (st.modo === 'juris' || (estado.unidadesPseudo || []).length <= 1) ocultarCampo('selUnidad');
    crearPaneles();
    montarDock();
    cablear();
    await refrescarFilas();
    await irAPaso(1, { sinScroll: true });
  }

  window.MunicipalGuiado = { init, activo, pintarEnvios, revisar, irAPaso, refrescarFilas };
})();
