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
 *   3. Concentrado  -- lo que se arma solo con las unidades (paloteo municipal,
 *                      seguimiento de biológico, recibido vs. requisición) y el
 *                      Movimiento del propio municipio.
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
  const st = { activo: false, modo: 'municipal', todas: [], paso: 1, filas: [], filtro: 'todas', clues: null, muni: null, vista3: 'concentrado', hojaActual: 'btnSeccionSIS06P' };

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
      <ol class="ruta-pasos">
        ${PASOS.map((p, i) => {
          const e = ps[i];
          const cls = e.hecho ? 'hecho' : (e.alerta ? 'alerta' : (st.paso === p.n ? 'actual' : ''));
          return `<li class="ruta-paso ${cls} mun-ruta-paso" data-mpaso="${p.n}" title="Ir al paso ${p.n}">
            <span class="ruta-num">${e.hecho ? '<span class="material-symbols-rounded">check</span>' : (e.alerta ? '<span class="material-symbols-rounded">priority_high</span>' : p.n)}</span>
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
    cont.innerHTML = '<span class="hoja-tinta" aria-hidden="true"></span>' + PASOS.map((p) => `
      <button type="button" class="hoja-tab" data-mpaso="${p.n}" role="tab" style="--hoja:${p.color};" title="${p.titulo}">
        <span class="material-symbols-rounded">${p.icono}</span><span class="hoja-nombre">${p.n} · ${p.t}</span><span class="hoja-pildora" id="pildoraMun${p.n}"></span>
      </button>`).join('');
    nav.insertBefore(cont, viejo);
    viejo.style.display = 'none';
    if (window.DockGlass) window.DockGlass.instalar(cont);
  }

  function marcarTabs() {
    document.querySelectorAll('#dockPasosMun .hoja-tab').forEach((b) => b.classList.toggle('activo', Number(b.dataset.mpaso) === st.paso));
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
      pintarConcentrado();
    } else {
      ocultarHojasViejas();
      $('panelMunEntrega').style.display = 'block';
      // La vista previa del CSV de la hoja vieja necesita una unidad del municipio elegido.
      const u = (estado.unidadesClues || []).find((x) => x.municipio === st.muni);
      if (u) $('selUnidadRevision').value = u.id;
      await pintarEntrega();
      $('btnSeccionCSV').click();
    }
    marcarTabs();
    pintarRuta();
    if (n !== 2) { despertarDock(); pintarDock(); }
    if (!(opciones && opciones.sinScroll)) window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const otros = st.modo !== 'juris' ? '' : `
      <div class="mun-aviso"><span class="material-symbols-rounded">info</span>
        <span>Aquí revisas y validas el SINBA-SIS de los <b>hospitales</b>. El Movimiento de los municipios y el de la jurisdicción están en el
        <a href="biovac_jurisdiccion.html">Concentrado jurisdiccional</a>.</span></div>`;

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
    return `<div class="mun-chips" style="margin:0 0 12px;">${ms.map((m) => `<button type="button" class="mun-chip ${st.muni === m ? 'activo' : ''}" data-${accion}="${esc(m)}">${esc(etiquetaMuni(m))}</button>`).join('')}</div>`;
  }

  function pintarConcentrado() {
    const panel = $('panelMunConcentrado');
    const { mes, anio } = periodo();
    const muni = st.muni;
    panel.innerHTML = `
      <div class="mun-cab">
        <div class="mun-cab-icono" style="background:#f0fdf4; border-color:#bbf7d0;"><span class="material-symbols-rounded" style="color:#16a34a;">table_chart</span></div>
        <div style="flex:1; min-width:220px;">
          <h2>Concentrado de ${esc(etiquetaMuni(muni) || 'tu municipio')}<button type="button" class="ayuda-btn" data-ayuda="mun_concentrado" title="Cómo leer el concentrado" aria-label="Cómo leer el concentrado"><span class="material-symbols-rounded">help</span></button></h2>
          <p class="subtitulo">Lo que arman solas tus unidades, sin capturar nada aquí: revisa que todo cuadre antes de entregar.</p>
        </div>
        ${st.modo === 'juris'
          ? '<a class="btn-secundario btn-mini" href="biovac_jurisdiccion.html" style="text-decoration:none;"><span class="material-symbols-rounded">query_stats</span> Concentrado jurisdiccional</a>'
          : '<button type="button" class="btn-secundario btn-mini" id="munVerMovimiento"><span class="material-symbols-rounded">inventory_2</span> Movimiento del municipio</button>'}
      </div>
      ${chipsMunicipio('conc')}
      <div id="munConcComparativo"></div>
      <div id="munConcTablas"></div>`;
    if (muni && window.SIS06PDashboard) window.SIS06PDashboard.renderComparativoAplicado($('munConcComparativo'), muni, mes, anio);
    if (muni && window.SIS06PConcentradoMunicipal) window.SIS06PConcentradoMunicipal.render($('munConcTablas'), muni, mes, anio);
  }

  async function verMovimiento() {
    if (!(await salidaSegura())) return;
    st.vista3 = 'movimiento';
    ocultarPropios();
    fijarUnidadLegacy('');
    const barra = $('munMovBarra') || (() => {
      const b = document.createElement('div');
      b.id = 'munMovBarra';
      b.className = 'tarjeta mun-mov-barra';
      $('panelMunConcentrado').parentNode.insertBefore(b, $('panelMunConcentrado'));
      return b;
    })();
    barra.innerHTML = '<button type="button" class="btn-secundario btn-mini" id="munVolverConcentrado"><span class="material-symbols-rounded">arrow_back</span> Volver al concentrado</button><span>Movimiento de Biológico del municipio: se concentra de lo que capturan tus unidades.</span>';
    barra.style.display = 'flex';
    $('btnSeccionMovimiento').click();
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
      <p class="mun-nota-csv">Abajo, la vista previa del CSV para el panel RDA de SIREVAQ (formato distinto al oficial).</p>`;
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
  function cablear() {
    document.addEventListener('click', (ev) => {
      if (!st.activo) return;
      const t = ev.target;
      const tab = t.closest('[data-mpaso]');
      if (tab) { irAPaso(Number(tab.dataset.mpaso)); return; }
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
      else if (t.closest('#munIrPendientes')) { st.filtro = 'ENVIADO'; irAPaso(1); }
      else if (t.closest('#munDescargarCSV')) window.SIS06PDashboard.exportarCSVOficialMunicipio(st.muni, periodo().mes, periodo().anio);
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
    document.addEventListener('sis06p:validado', () => { if (st.activo) alValidar(); });
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
