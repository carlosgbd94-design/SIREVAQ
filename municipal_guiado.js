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
  const ETIQUETA = { VALIDADO: 'Validado', ENVIADO: 'Por validar', SIN: 'Sin enviar', OMITIDA: 'Sin envío' };
  const CLASE_EST = { VALIDADO: 'completo', ENVIADO: 'parcial', SIN: 'vacio', OMITIDA: 'omitida' };

  const ES_HOSPITAL = { NHG: true, HENM: true };
  const st = { activo: false, modo: 'municipal', todas: [], paso: 1, filas: [], filtro: 'todas', clues: null, muni: null, vista3: 'concentrado', hojaActual: 'btnSeccionSIS06P', tokenConc: 0, conc: null, pend: null };

  function activo() { return st.activo; }
  function periodo() { return { mes: Number($('selMes').value), anio: Number($('selAnio').value) }; }
  // "OMITIDA" = el municipal decidió continuar sin esa unidad (no envió): no bloquea ni se suma.
  function estadoDe(f) {
    if (f.estado === 'VALIDADO') return 'VALIDADO';
    if (f.estado === 'ENVIADO') return 'ENVIADO';
    return f.sin_envio ? 'OMITIDA' : 'SIN';
  }
  function eraUnidades(mes, anio) { return `${anio}-${String(mes).padStart(2, '0')}-01` >= (estado.inicioPorUnidad || '2026-10-01'); }
  function nombreMes(m) { const x = (typeof MESES !== 'undefined') && MESES.find((k) => k.v === m); return x ? x.l : String(m); }
  function etiquetaMuni(v) { return (window.SIS06PDashboard && window.SIS06PDashboard.MUNICIPIO_LABEL[v]) || v; }
  function fechaCorta(iso) { return iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''; }

  function filasOrdenadas() {
    // Siempre por CLUES (no por quién envió primero): cada unidad se queda en su lugar y es fácil de ubicar.
    return st.filas.slice().sort((a, b) => String(a.clues || '').localeCompare(String(b.clues || ''), 'es', { numeric: true }) || String(a.unidad || '').localeCompare(String(b.unidad || ''), 'es'));
  }
  function municipios() { return [...new Set(st.filas.map((f) => f.municipio).filter(Boolean))]; }
  function filasDe(muni) { return st.filas.filter((f) => f.municipio === muni); }

  function resumen(filas) {
    const r = { total: filas.length, sin: 0, enviado: 0, validado: 0, omitida: 0, difs: 0 };
    filas.forEach((f) => {
      const e = estadoDe(f);
      if (e === 'VALIDADO') r.validado++; else if (e === 'ENVIADO') r.enviado++; else if (e === 'OMITIDA') r.omitida++; else r.sin++;
      // Solo cuentan las unidades que ya enviaron: una que sigue capturando todavía no tiene por qué cuadrar
      if (Number(f.diferencias) > 0 && (e === 'ENVIADO' || e === 'VALIDADO')) r.difs++;
    });
    r.enviaron = r.validado + r.enviado;                 // las que sí mandaron su SINBA-SIS
    r.esperadas = r.total - r.omitida;                   // las que se esperaba que enviaran
    return r;
  }
  // Listo para cerrar/entregar: nada por enviar ni por validar (las "sin envío" no cuentan) y al menos una validada.
  function listoDe(r) { return r.total > 0 && r.sin === 0 && r.enviado === 0 && r.validado > 0; }

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
  // Paso 3: lo que ya sabe el Concentrado (pendientes reales) manda; si aún no se abrió, se usa el conteo de unidades con diferencia.
  function pasoConcentrado(r, listo) {
    const n = pendientesTotal(st.pend);
    if (n > 0) return { hecho: false, alerta: true, texto: plural(n, 'pendiente por resolver', 'pendientes por resolver'), pill: `${n} ≠`, pillCls: 'aviso' };
    if (st.pend && st.pend.listo && listo) return { hecho: true, texto: 'Todo cuadra', pill: '✓', pillCls: 'ok' };
    return { hecho: listo && r.difs === 0 && !st.pend, alerta: r.difs > 0, texto: r.difs ? `${plural(r.difs, 'unidad con diferencia', 'unidades con diferencia')}` : (listo ? 'Sin diferencias' : 'Se arma con lo que validas'), pill: r.difs ? `${r.difs} ≠` : (listo ? '✓' : ''), pillCls: r.difs ? 'aviso' : (listo ? 'ok' : '') };
  }

  function estadoPasos() {
    const r = resumen(st.filas);
    const listo = listoDe(r);
    return [
      { hecho: r.total > 0 && r.sin === 0, texto: r.total ? `${r.enviaron} de ${r.esperadas} enviaron${r.omitida ? ` · ${r.omitida} sin envío` : ''}` : 'Sin unidades', pill: r.total ? `${r.enviaron}/${r.esperadas}` : '', pillCls: r.total > 0 && r.sin === 0 ? 'ok' : '' },
      { hecho: listo, texto: r.total ? `${r.validado} de ${r.esperadas} validadas` : 'Sin unidades', pill: r.total ? `${r.validado}/${r.esperadas}` : '', pillCls: listo ? 'ok' : '' },
      pasoConcentrado(r, listo),
      { hecho: false, texto: listo ? 'Listo: descarga el CSV oficial' : 'Se habilita al validar todas', pill: listo ? '✓' : '', pillCls: listo ? 'ok' : '' }
    ];
  }

  function pintarRuta() {
    const cont = $('rutaMes');
    if (!cont || !st.activo) return;
    const ps = estadoPasos();
    cont.innerHTML = `
      <div class="ruta-pasos" role="group" aria-label="Pasos del cierre del mes">
        ${PASOS.map((p, i) => {
          const e = ps[i];
          const cls = e.hecho ? 'hecho' : (e.alerta ? 'alerta' : (st.paso === p.n ? 'actual' : ''));
          const estadoTxt = e.hecho ? 'completo' : (e.alerta ? 'requiere atención' : (st.paso === p.n ? 'paso actual' : 'pendiente'));
          return `<div class="ruta-paso ${cls} mun-ruta-paso" data-mpaso="${p.n}" role="button" tabindex="0" ${st.paso === p.n ? 'aria-current="step"' : ''} title="Ir al paso ${p.n}">
            <span class="ruta-num" aria-hidden="true">${e.hecho ? '<span class="material-symbols-rounded">check</span>' : (e.alerta ? '<span class="material-symbols-rounded">priority_high</span>' : p.n)}</span>
            <span class="ruta-txt"><b>${p.t}</b><small>${esc(e.texto)}</small><span class="sr-only"> (${estadoTxt})</span></span>
          </div>`;
        }).join('')}
      </div>
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
  // «Enviado por»: la persona que elaboró el SINBA-SIS (responsable), no el usuario técnico con el que entró la unidad (CLUES_NOMBRE).
  function responsableSIS(f) {
    const esPersona = (n) => { const t = String(n == null ? '' : n).trim(); return Boolean(t) && !(/^[A-Za-z]{3,6}\d{4,}(?:[_\s-]|$)/.test(t) || (/^[A-Z0-9_]+$/.test(t) && t.indexOf('_') >= 0)); };
    if (esPersona(f.capturado_por)) return String(f.capturado_por).trim();
    if (esPersona(f.enviado_por)) return String(f.enviado_por).trim();
    return 'responsable sin nombre';
  }
  function detalleUnidad(f) {
    const e = estadoDe(f);
    const sm = f.sin_movimiento ? ' · sin movimiento' : '';
    if (e === 'VALIDADO') return `Validado por ${f.validado_por || '—'}${f.validado_en ? ', ' + fechaCorta(f.validado_en) : ''}${sm}`;
    if (e === 'ENVIADO') return `Enviado por ${responsableSIS(f)}${f.enviado_en ? ', ' + fechaCorta(f.enviado_en) : ''}${sm}`;
    if (e === 'OMITIDA') return `Se continúa sin ella: ${f.sin_envio_motivo || 'sin motivo'}`;
    return detalleAvance(f);
  }
  function pillSinMovimiento(f) {
    return f.sin_movimiento && (estadoDe(f) === 'ENVIADO' || estadoDe(f) === 'VALIDADO') ? '<span class="mun-pill sinmov" title="La unidad declaró que no recibió ni aplicó biológico este mes">Sin movimiento</span>' : '';
  }
  function tieneDiferencias(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    return !(dosis === 0 && lotes === 0) && (Number(f.diferencias) || 0) > 0;
  }
  function pillConciliacion(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    if (dosis === 0 && lotes === 0) return '';
    const n = Number(f.diferencias) || 0;
    return n > 0 ? `<span class="mun-pill aviso" title="Biológicos donde el paloteo y el Movimiento no tienen las mismas dosis aplicadas">${n} no coincide${n === 1 ? '' : 'n'}</span>` : '<span class="mun-pill ok">Coincide</span>';
  }

  function puntosHtml(filas, actual) {
    return filas.map((f) => `<button type="button" class="pt ${CLASE_EST[estadoDe(f)]} ${f.clues === actual ? 'actual' : ''}" data-clues="${esc(f.clues)}" title="${esc((f.unidad || f.clues) + ' — ' + ETIQUETA[estadoDe(f)])}"></button>`).join('');
  }

  // Mensaje para WhatsApp con las unidades pendientes de enviar (una por línea, por CLUES). Los asteriscos son la
  // negrita de WhatsApp: el periodo del SINBA-SIS y cada unidad de salud van resaltados.
  const negrita = (t) => String(t == null ? '' : t).replace(/\*/g, '').trim();
  function textoPendientes() {
    const { mes, anio } = periodo();
    const pend = filasOrdenadas().filter((f) => estadoDe(f) === 'SIN');
    const varios = municipios().length > 1;
    const lineas = pend.map((f) => `• *${negrita(f.unidad || f.clues)}* (${f.clues})${varios && f.municipio ? ` · ${etiquetaMuni(f.municipio)}` : ''}`);
    return `Hola, buen día. Les recordamos que aún está pendiente el envío del *SINBA-SIS de ${nombreMes(mes)} ${anio}* de las siguientes *unidades de salud* (${pend.length}):\n\n${lineas.join('\n')}\n\nLes pedimos enviarlo a la brevedad desde SIREVAQ. Si tienen algún problema para hacerlo, avísennos. ¡Gracias!`;
  }
  async function copiarPendientes(btn) {
    const texto = textoPendientes();
    try { await navigator.clipboard.writeText(texto); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* sin portapapeles */ }
      ta.remove();
    }
    // El logo de WhatsApp pasa a «copiar» un momento para confirmar que ya quedó en el portapapeles
    if (btn) { btn.classList.add('copiado'); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove('copiado'), 2200); }
    toast('Lista copiada: pégala en el mensaje a las unidades.', 'ok');
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
    // Filtro de «problemas»: unidades con diferencias entre paloteo y Movimiento
    const conDif = (f) => estadoDe(f) !== 'OMITIDA' && tieneDiferencias(f);
    const conteos = { todas: r.total, ENVIADO: r.enviado, SIN: r.sin, VALIDADO: r.validado, OMITIDA: r.omitida, DIF: st.filas.filter(conDif).length };
    if (st.filtro === 'DIF' && !conteos.DIF) st.filtro = 'todas';
    const visibles = filasOrdenadas().filter((f) => st.filtro === 'todas' || (st.filtro === 'DIF' ? conDif(f) : estadoDe(f) === st.filtro));
    const pct = r.esperadas ? Math.round((r.validado / r.esperadas) * 100) : 0;
    const cta = r.enviado > 0
      ? `<button type="button" class="btn-primario" id="munCtaSiguiente"><span class="material-symbols-rounded">fact_check</span> Revisar la siguiente por validar (${r.enviado})</button>`
      : r.sin > 0
        ? (new Date() < new Date(periodo().anio, periodo().mes, 0)
          ? `<span class="mun-espera"><span class="material-symbols-rounded">hourglass_top</span> El mes sigue en curso: las unidades van prellenando y el envío se abre al cierre del mes.</span>`
          : `<span class="mun-espera"><span class="material-symbols-rounded">hourglass_top</span> Faltan ${plural(r.sin, 'unidad', 'unidades')} por enviar. Si alguna no va a enviar este mes (internet, etc.), ábrela y elige «Continuar sin esta unidad»: no bloquea nada.</span>`)
        : '';   // todo validado: sin botón aparte, la barra de abajo ya lleva al Concentrado
    // «Copiar pendientes»: las unidades que aún no envían (sin contar las que se continúan sin envío), listas para pegar en un mensaje
    // Logo de WhatsApp: burbuja verde con el teléfono blanco centrado en ella
    const WA = '<svg class="mun-ib-wa" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25d366" d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2z"/><path fill="#fff" transform="translate(12 12) scale(.56) translate(-12 -12)" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
    const copiarBtn = r.sin > 0
      ? `<button type="button" class="mun-ib" id="munCopiarPendientes" aria-label="Copiar mensaje para WhatsApp con las ${r.sin} unidades pendientes de enviar" title="Copiar mensaje para WhatsApp: ${r.sin} unidades pendientes de enviar">${WA}<span class="material-symbols-rounded mun-ib-copy" aria-hidden="true">content_copy</span></button>`
      : '';
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
        <div class="mun-avance-cab"><div><b>${nombreMes(periodo().mes)} ${periodo().anio}</b><small>${r.enviaron} de ${r.esperadas} unidades ya enviaron su SINBA-SIS${r.omitida ? ` · ${plural(r.omitida, 'unidad continúa', 'unidades continúan')} sin envío` : ''}</small></div><span class="mun-pct">${r.validado}/${r.esperadas} validadas</span></div>
        <div class="mun-barra"><i style="width:${pct}%"></i></div>
        <div class="puntos">${puntosHtml(filasOrdenadas(), null)}</div>
        <div class="mun-leyenda"><span><i class="pt vacio"></i>sin enviar</span><span><i class="pt parcial"></i>por validar</span><span><i class="pt completo"></i>validada</span>${r.omitida ? '<span><i class="pt omitida"></i>sin envío</span>' : ''}</div>
      </div>
      <div class="mun-acciones">${cta}
        <div class="mun-chips">${copiarBtn}${chip('todas', 'Todas')}${chip('ENVIADO', 'Por validar')}${chip('SIN', 'Sin enviar')}${chip('VALIDADO', 'Validadas')}${r.omitida ? chip('OMITIDA', 'Sin envío') : ''}${conteos.DIF ? chip('DIF', 'Con diferencias') : ''}</div>
      </div>
      <div class="mun-grid">${visibles.map((f) => `
        <button type="button" class="mun-unidad ${CLASE_EST[estadoDe(f)]}" data-clues="${esc(f.clues)}" title="${esc((f.unidad || f.clues) + ' · ' + detalleUnidad(f))}">
          <span class="mun-dot"></span>
          <span class="mun-u-txt"><b>${esc(f.unidad || f.clues)}</b><small>${esc(f.clues)} · ${esc(detalleUnidad(f))}</small></span>
          <span class="mun-u-pills"><span class="mun-pill ${CLASE_EST[estadoDe(f)]}">${ETIQUETA[estadoDe(f)]}</span>${pillSinMovimiento(f)}${pillConciliacion(f)}</span>
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
        <button type="button" class="btn-secundario btn-mini" id="munVolverLista" title="Volver a la lista de unidades" aria-label="Volver a la lista de unidades"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Unidades</button>
        <button type="button" class="mun-nav" id="munPrev" title="Unidad anterior" aria-label="Unidad anterior"><span class="material-symbols-rounded">chevron_left</span></button>
        <div class="mun-rev-unidad">
          <b>${esc(f ? (f.unidad || f.clues) : '')}</b>
          <small>${esc(f ? f.clues : '')} · unidad ${idx + 1} de ${lista.length} <span class="mun-pill ${CLASE_EST[e]}">${ETIQUETA[e]}</span></small>
        </div>
        <button type="button" class="mun-nav" id="munNext" title="Unidad siguiente" aria-label="Unidad siguiente"><span class="material-symbols-rounded">chevron_right</span></button>
        <select id="munRevSelect" class="mun-select" aria-label="Elegir unidad">${lista.map((x) => `<option value="${esc(x.clues)}" ${f && x.clues === f.clues ? 'selected' : ''}>${esc(x.unidad || x.clues)}</option>`).join('')}</select>
        <button type="button" class="btn-secundario btn-mini" id="munSigPend" ${r.enviado - (e === 'ENVIADO' ? 1 : 0) > 0 ? '' : 'disabled'}><span class="material-symbols-rounded">skip_next</span> Siguiente por validar (${r.enviado})</button>
        ${e === 'SIN' ? '<button type="button" class="btn-secundario btn-mini" id="munSinEnvio" title="Esta unidad no va a enviar este mes: se continúa sin ella (queda registrado y se puede deshacer)"><span class="material-symbols-rounded" aria-hidden="true">event_busy</span> Continuar sin esta unidad</button>' : ''}
        ${e === 'OMITIDA' ? '<button type="button" class="btn-secundario btn-mini" id="munQuitarSinEnvio" title="Volver a esperar el envío de esta unidad"><span class="material-symbols-rounded" aria-hidden="true">undo</span> Volver a esperarla</button>' : ''}
      </div>
      <div class="puntos mun-rev-puntos">${puntosHtml(lista, f && f.clues)}</div>
      <div class="mun-hojas"><div class="mun-hojas-tabs" role="tablist" aria-label="Hojas de revisión de la unidad">${HOJAS.map((h) => `
        <button type="button" class="mun-hoja" data-hoja="${h.id}" style="--hoja:${h.color};" role="tab">
          <span class="material-symbols-rounded">${h.icono}</span>${h.t}<span class="mun-hoja-pildora" data-pildora="${h.pildora}"></span>
        </button>`).join('')}</div>
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
      span.className = 'mun-hoja-pildora' + (p && p.classList.contains('aviso') ? ' aviso' : p && p.classList.contains('ok') ? ' ok' : '') + (!txt && p && p.classList.contains('punto') && p.textContent.length > 0 ? ' punto' : '')   // el punto solo si de verdad hay cambios sin guardar (la píldora de origen trae un carácter invisible); vacía no se pinta;
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
      toast(st.modo === 'juris' ? 'Ya no quedan hospitales por validar. Puedes volver al concentrado jurisdiccional.' : 'Ya no quedan unidades por validar.', 'ok');
      pintarBarraRevision();
      // Se avisa también a los lectores de pantalla y el foco queda en el regreso: es lo siguiente que la jurisdicción hace.
      if (st.modo === 'juris') {
        const vivo = $('munVivo');
        if (vivo) vivo.textContent = 'Ya no quedan hospitales por validar. El botón Volver al concentrado jurisdiccional está disponible arriba.';
        const volver = $('munVolverJuris');
        if (volver) volver.classList.add('mun-volver-listo');
      }
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

  // ---- Pendientes del Concentrado: UNA lista, cada renglón dice qué falta y lleva directo a donde se arregla ----
  function pendientesTotal(p) {
    if (!p) return 0;
    return ((p.abiertas || []).length) + (p.cmp || 0) + (p.rec || 0) + (p.disc || 0);
  }

  function pintarPendientes() {
    const caja = $('munPendientes'), p = st.pend;
    if (!caja || !p) return;
    if (!p.listo) { caja.className = 'mun-pend carga'; caja.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">hourglass_top</span> Revisando que todo cuadre…'; return; }
    const n = pendientesTotal(p);
    if (n === 0) {
      caja.className = 'mun-pend ok';
      caja.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span> <b>Todo cuadra.</b> Ya puedes descargar tus archivos y continuar a la Entrega.';
      return;
    }
    const fila = (icono, txt, ayuda, accion, extra) => `<li><button type="button" class="mun-pend-fila" ${accion}>
        <span class="material-symbols-rounded" aria-hidden="true">${icono}</span>
        <span><b>${txt}</b><small>${ayuda}</small></span><span class="material-symbols-rounded mun-pend-ir" aria-hidden="true">chevron_right</span></button>${extra || ''}</li>`;
    const filas = [];
    const ab = p.abiertas || [];
    if (ab.length) {
      const unidades = `<ul class="mun-pend-unidades">${ab.map((u) => `<li><button type="button" class="mun-pend-unidad" data-pend-unidad="${esc(u.clues)}">${esc(u.unidad || u.clues)}<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button></li>`).join('')}</ul>`;
      filas.push(fila('edit_note', plural(ab.length, 'unidad sin guardar su Movimiento', 'unidades sin guardar su Movimiento'),
        'Las reabriste para corregir y no se suman al municipio. Entra a cada una y pulsa Guardar.', 'data-pend-ir="munFaseMov"', unidades));
    }
    if (p.cmp) filas.push(fila('compare_arrows', plural(p.cmp, 'unidad con el paloteo distinto a su Movimiento', 'unidades con el paloteo distinto a su Movimiento'), 'Lo aplicado no es igual en las dos hojas. Corrige la que esté mal.', 'data-pend-ir="munDetConciliacion"'));
    if (p.rec) filas.push(fila('local_shipping', plural(p.rec, 'lote que no coincide con la requisición', 'lotes que no coinciden con la requisición'), 'Lo que recibieron las unidades no es lo que se les repartió. Se ve qué unidad abajo.', 'data-pend-ir="munDetRecibido"'));
    if (p.disc) filas.push(fila('inventory_2', plural(p.disc, 'lote donde las unidades y el municipio no cuadran', 'lotes donde las unidades y el municipio no cuadran'), 'Cada aviso dice qué revisar.', 'data-pend-ir="munDiscrepancias"'));
    caja.className = 'mun-pend aviso';
    caja.innerHTML = `<div class="mun-pend-tit"><span class="material-symbols-rounded" aria-hidden="true">flag</span> ${plural(filas.length, 'cosa por resolver', 'cosas por resolver')} antes de entregar</div><ol class="mun-pend-lista">${filas.join('')}</ol>`;
  }

  // Cada parte del Concentrado avisa cuando termina; la caja se completa sola.
  function setPend(token, parcial) {
    if (!st.pend || st.pend.token !== token) return;
    Object.assign(st.pend, parcial);
    const p = st.pend;
    p.listo = p.cmp !== undefined && p.rec !== undefined && p.disc !== undefined;
    pintarPendientes();
    // La barra de pasos se repinta solo si el resumen del paso 3 cambió (repintarla de más le quita el foco a quien navega con teclado)
    const firma = JSON.stringify(pasoConcentrado(resumen(st.filas), listoDe(resumen(st.filas))));
    if (firma !== p.firma) { p.firma = firma; pintarRuta(); }
  }

  function irAPendiente(id) {
    const el = $(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pintarConcentrado() {
    const panel = $('panelMunConcentrado');
    const { mes, anio } = periodo();
    const muni = st.muni;
    const juris = st.modo === 'juris';
    const nombre = etiquetaMuni(muni) || 'tu municipio';
    const resu = resumen(filasDe(muni));
    const listoCSV = listoDe(resu);
    const token = ++st.tokenConc;
    st.conc = null;
    st.pend = { token, abiertas: [], cmp: undefined, rec: undefined, disc: undefined, listo: false };
    setTimeout(pintarPendientes, 0);
    const pseudo = pseudoDe(muni);
    const esManual = !juris && !!pseudo && !esDerivado(pseudo, mes, anio) && !eraUnidades(mes, anio);

    panel.innerHTML = `
      <div class="mun-cab">
        <div class="mun-cab-icono" style="background:#f0fdf4; border-color:#bbf7d0;"><span class="material-symbols-rounded" style="color:#16a34a;">table_chart</span></div>
        <div style="flex:1; min-width:220px;">
          <h2>Concentrado de ${esc(nombre)} · ${nombreMes(mes)} ${anio}<button type="button" class="ayuda-btn" data-ayuda="mun_concentrado" title="Cómo leer el concentrado" aria-label="Cómo leer el concentrado"><span class="material-symbols-rounded">help</span></button></h2>
          <p class="subtitulo">Tres cosas, en este orden: verifica que cuadre, deja listo el Movimiento del municipio y descarga tus archivos.</p>
        </div>
      </div>
      ${chipsMunicipio('conc')}
      <div id="munPendientes" class="mun-pend carga" aria-live="polite"></div>
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
            ${filaArchivo(2, 'description', '#7c3aed', 'CSV oficial para estadística', listoCSV ? 'Una fila por clave SIS de cada unidad validada.' : `Se habilita cuando todas las unidades estén validadas (${resu.validado} de ${resu.esperadas}${resu.omitida ? '; ' + resu.omitida + ' sin envío no cuentan' : ''}).`,
              `<button type="button" class="btn-secundario btn-mini" data-descarga="csv" ${listoCSV ? '' : 'disabled'} aria-label="Descargar CSV oficial"><span class="material-symbols-rounded">download</span> Descargar CSV</button>`)}
          </ul>
        </li>
      </ol>
      <details class="mun-det mun-det-grande"><summary>Ver el concentrado en pantalla (paloteo y seguimiento de biológico)</summary><div id="munConcTablas" class="mun-det-cuerpo"></div></details>`;

    const vigente = () => token === st.tokenConc && st.activo && st.paso === 3 && st.vista3 === 'concentrado';
    const verif = { cmp: undefined, rec: undefined, recTotal: 0 };
    const cerrarVerif = () => {
      if (verif.cmp === undefined || verif.rec === undefined || !vigente()) return;
      setPend(token, { cmp: verif.cmp ? verif.cmp.conDiferencia : 0, rec: verif.rec });
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
        const sinEnvios = resu.enviaron === 0;     // nada que comparar todavía: lo recibido llega por las unidades
        if (rec) rec.innerHTML = sinEnvios ? '<div class="mun-vacio">Aún ninguna unidad ha enviado: lo recibido se compara contra la requisición en cuanto lleguen los primeros envíos.</div>'
          : (api ? api.htmlRecibido() : '<div class="mun-vacio">No se pudo cargar.</div>');
        verif.rec = (api && !sinEnvios) ? api.nDifRecibido : 0;
        verif.recTotal = (api && !sinEnvios) ? api.d.requisicion.length : 0;
        if (api && !sinEnvios && api.nDifRecibido > 0) $('munDetRecibido').open = true;
        const b = panel.querySelector('[data-descarga="conc"]');
        if (b && api) b.disabled = false;
        cerrarVerif();
      });
    } else { verif.rec = 0; }

    if (!juris) pintarFaseMovimiento(muni, mes, anio, esManual, vigente, token);
    else setPend(token, { disc: 0 });
  }

  async function pintarFaseMovimiento(muni, mes, anio, esManual, vigente, token) {
    const sinAvisos = () => setPend(token, { abiertas: [], disc: 0 });
    let info;
    try { info = await leerMovimientoMuni(muni, mes, anio); }
    catch (err) {
      if (vigente() && $('munMovEstadoFase')) $('munMovEstadoFase').innerHTML = chipEstado('aviso', 'No se pudo consultar', 'error');
      sinAvisos();
      return;
    }
    if (!vigente()) return;
    const caja = $('munMovEstadoFase'), cuerpo = $('munMovCuerpo');
    if (!caja || !cuerpo) return;
    const abrir = (txt, primario) => `<button type="button" class="${primario ? 'btn-primario' : 'btn-secundario'} btn-mini" id="munVerMovimiento"><span class="material-symbols-rounded" aria-hidden="true">inventory_2</span> ${txt}</button>`;
    if (!info.u) {
      caja.innerHTML = chipEstado('info', 'Sin Movimiento propio', 'info');
      cuerpo.innerHTML = '<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Este municipio no tiene Movimiento propio: lo concentra la Jurisdicción.</span></p>';
      sinAvisos();
      return;
    }
    if (info.derivado) {
      caja.innerHTML = chipEstado('ok', 'Se arma solo', 'auto_awesome');
      cuerpo.innerHTML = '<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span><span>Desde octubre 2026 el Movimiento del municipio es la suma de sus unidades: no se captura ni se cierra aquí. Cada unidad exporta el suyo.</span></p>';
      sinAvisos();
      return;
    }
    const eraU = eraUnidades(mes, anio);
    const intro = eraU ? `<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">group_work</span><span><b>Se arma solo con lo que envían tus unidades.</b> Si algo no cuadra, se corrige en la unidad. Cuando empate con la Jurisdicción, ciérralo con <b>Cerrar mes</b>.</span></p>`
      : esManual ? `<p class="mun-nota"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><span><b>${nombreMes(mes)} se captura a mano en el municipio</b>, porque las unidades todavía no capturan el suyo. Desde octubre se arma con tus unidades.</span></p>` : '';
    if (!info.mov) {
      caja.innerHTML = chipEstado('pend', eraU ? 'Aparece al enviar la 1.ª unidad' : 'Sin iniciar', eraU ? 'hourglass_top' : 'radio_button_unchecked');
      cuerpo.innerHTML = `${intro}<div class="mun-fase-acciones">${eraU ? abrir('Abrir en blanco', false) : abrir('Iniciar y capturar', true)}</div>`;
      sinAvisos();
      return;
    }
    const e = ESTADO_MOV[info.mov.estado] || ESTADO_MOV.BORRADOR;
    caja.innerHTML = chipEstado(e.cls, e.txt, e.icono);
    const cerrado = info.mov.estado === 'CERRADO';
    const ayuda = cerrado
      ? 'El mes ya está cerrado: la existencia final pasó al mes siguiente. Para cambiar algo, ábrelo y usa «Corregir movimiento» (queda registrado).'
      : 'Cuando todo cuadre, usa <b>Cerrar mes</b> en la barra de abajo: bloquea el mes y pasa la existencia final al siguiente.';
    const armadoTxt = eraU && !cerrado
      ? `<p class="mun-ayuda-mov">${info.mov.armado_en ? `Se actualiza sola cada vez que una unidad envía. Última suma: ${fechaCorta(info.mov.armado_en)}.` : 'Se actualizará sola en cuanto una unidad envíe su SINBA-SIS.'}</p>` : '';
    const discHtml = eraU ? '<div id="munDiscrepancias" class="disc-caja" aria-live="polite"></div>' : '';
    cuerpo.innerHTML = `${intro}${armadoTxt}${discHtml}<p class="mun-ayuda-mov">${ayuda}</p><div class="mun-fase-acciones">${abrir(cerrado ? 'Ver Movimiento' : (eraU ? 'Abrir y ajustar' : 'Abrir y capturar'), !cerrado)}</div>`;
    if (eraU && typeof pintarDiscrepanciasMunicipio === 'function') {
      Promise.resolve(pintarDiscrepanciasMunicipio($('munDiscrepancias'), muni, mes, anio, { sinAlertaAbiertas: true }))
        .then((r) => { if (vigente()) setPend(token, r ? { abiertas: r.abiertas, disc: r.errores } : { abiertas: [], disc: 0 }); }, () => setPend(token, { abiertas: [], disc: 0 }));
    } else sinAvisos();
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
      ${eraUnidades(periodo().mes, periodo().anio) ? '' : `<ol class="mun-guia">
        <li><i aria-hidden="true">1</i><div><b>Captura</b><small>Cada celda se guarda sola al salir de ella. El botón Guardar de la barra de abajo es solo para confirmarlo.</small></div></li>
        <li><i aria-hidden="true">2</i><div><b>Revisa</b><small>La existencia final debe cuadrar con el paloteo del concentrado.</small></div></li>
        <li><i aria-hidden="true">3</i><div><b>Cerrar mes</b><small>Da el mes por terminado: lo bloquea y pasa la existencia final al mes siguiente. Se puede reabrir con un motivo.</small></div></li>
      </ol>`}`;
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
    const listo = listoDe(r);
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
        <li class="${listo ? 'ok' : 'pend'}"><span class="material-symbols-rounded">${listo ? 'check_circle' : 'radio_button_unchecked'}</span><div><b>Todas las unidades validadas</b><small>${r.validado} de ${r.esperadas}${r.omitida ? ` · ${r.omitida} sin envío (no cuentan)` : ''}${listo ? '' : ` — faltan ${r.esperadas - r.validado}`}</small></div>${listo ? '' : '<button type="button" class="btn-secundario btn-mini" id="munIrPendientes">Ir a revisar</button>'}</li>
        <li class="${r.difs === 0 ? 'ok' : 'pend'}"><span class="material-symbols-rounded">${r.difs === 0 ? 'check_circle' : 'error'}</span><div><b>Paloteo y Movimiento coinciden</b><small>${r.difs === 0 ? 'Ninguna unidad con diferencia' : plural(r.difs, 'unidad con diferencia', 'unidades con diferencia')}</small></div></li>
        <li class="cargando" id="munCheckAbiertas"><span class="material-symbols-rounded">hourglass_top</span><div><b>Movimientos de las unidades guardados</b><small>Comprobando…</small></div></li>
        <li class="cargando" id="munCheckRecibido"><span class="material-symbols-rounded">hourglass_top</span><div><b>Recibido igual a la requisición</b><small>Comparando…</small></div></li>
      </ul>
      <div class="mun-entregar">
        <div><b>CSV oficial</b><small>El archivo que se sube al departamento de estadística: una fila por clave SIS de cada unidad validada.</small></div>
        <button type="button" class="btn-primario" id="munDescargarCSV" ${listo ? '' : 'disabled'} title="${listo ? 'Descargar el CSV oficial' : 'Se habilita cuando todas las unidades estén validadas'}"><span class="material-symbols-rounded">download</span> Descargar CSV oficial</button>
      </div>
      <div class="mun-entregar">
        <div><b>SINBA-SIS de cada unidad (Excel oficial)</b><small>Un ZIP con un archivo de Excel por unidad, con la plantilla oficial completa, listo para guardar o imprimir. Es pesado: verás una barra de avance.</small></div>
        <button type="button" class="btn-primario" id="munDescargarZip" ${listo ? '' : 'disabled'} title="${listo ? 'Descargar un Excel oficial por unidad en un ZIP' : 'Se habilita cuando todas las unidades estén validadas'}"><span class="material-symbols-rounded">folder_zip</span> Exportar SIS masiva (ZIP)</button>
      </div>
      <div class="mun-entregar">
        <div><b>Indicadores (RDA)</b><small id="munPubEstado">${listo ? 'Consultando…' : 'Se carga sola al cerrar el mes (o cuando tú lo pidas).'}</small></div>
        <button type="button" class="btn-secundario" id="munPublicar" ${listo ? '' : 'disabled'} title="${listo ? 'Cargar ahora el concentrado validado a los indicadores (si no, se carga solo al cerrar el mes)' : 'Se habilita cuando todas las unidades estén validadas'}"><span class="material-symbols-rounded">cloud_upload</span> Cargar a indicadores</button>
      </div>
      <p class="mun-nota-csv">Abajo, la vista previa: se va llenando con lo que capturan las unidades. El archivo que se descarga tiene el mismo formato que la hoja CSV del Excel oficial.</p>`;
    if (listo && window.SIS06PDashboard) window.SIS06PDashboard.pintarEstadoPublicacion($('munPubEstado'), muni, mes, anio);
    // Unidades con el Movimiento reabierto en corrección y sin guardar: no se suman al Movimiento del municipio.
    try {
      const abiertas = await window.SIS06PConcentradoMunicipal.movimientosAbiertos(muni, mes, anio);
      const li = $('munCheckAbiertas');
      if (li) {
        li.className = abiertas.length ? 'pend' : 'ok';
        li.innerHTML = `<span class="material-symbols-rounded">${abiertas.length ? 'error' : 'check_circle'}</span><div><b>Movimientos de las unidades guardados</b><small>${abiertas.length
          ? `${plural(abiertas.length, 'unidad con el Movimiento abierto en corrección', 'unidades con el Movimiento abierto en corrección')}: ${abiertas.map((x) => esc(x.unidad || x.clues)).join(', ')}. No se suman al Movimiento del municipio: ábrelo en cada unidad y pulsa Guardar.`
          : 'Ninguna unidad tiene el Movimiento abierto en corrección'}</small></div>`;
      }
    } catch (err) {
      const li = $('munCheckAbiertas');
      if (li) { li.className = 'info'; li.querySelector('small').textContent = 'No se pudo comprobar'; }
    }
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

  // ZIP masivo: un Excel oficial por unidad validada del municipio (las «sin envío» no cuentan).
  async function exportarZipMasivo(btn) {
    const { mes, anio } = periodo();
    const muni = st.muni;
    const filas = filasDe(muni).filter((f) => estadoDe(f) !== 'OMITIDA');
    if (!window.SIS06PBiovac || !window.SIS06PBiovac.exportarZipMunicipio) { toast('El módulo de exportación aún no está listo. Intenta de nuevo en un momento.', 'error'); return; }
    if (btn) btn.disabled = true;
    try { await window.SIS06PBiovac.exportarZipMunicipio(filas, muni, mes, anio); }
    finally { if (btn) btn.disabled = false; }
  }

  // -------------------------------------------------------------- sin envío y armado
  // El municipal puede continuar sin una unidad que no envió (internet, etc.): queda con motivo y se puede deshacer.
  async function marcarSinEnvio(clues) {
    const f = st.filas.find((x) => x.clues === clues);
    if (!f) return;
    const { mes, anio } = periodo();
    const motivo = await mostrarModal({
      titulo: 'Continuar sin esta unidad',
      mensaje: `${f.unidad || clues} no envió su SINBA-SIS de ${nombreMes(mes)} ${anio}. Podrás cerrar el mes y entregar sin ella; su información no se suma. Si después envía, se toma en cuenta sola. Escribe el motivo (queda registrado).`,
      pedirMotivo: true, placeholderMotivo: 'Ej. Falla de internet en la unidad', textoAceptar: 'Continuar sin ella'
    });
    if (!motivo) return;
    const { error } = await estado.db.rpc('sis06p_marcar_sin_envio', { p_clues: clues, p_mes: mes, p_anio: anio, p_motivo: motivo });
    if (error) { toast('No se pudo marcar: ' + error.message, 'error'); return; }
    toast('Listo: se continúa sin esta unidad.', 'ok');
    await refrescarFilas();
  }
  async function quitarSinEnvio(clues) {
    const { mes, anio } = periodo();
    const { error } = await estado.db.rpc('sis06p_quitar_sin_envio', { p_clues: clues, p_mes: mes, p_anio: anio });
    if (error) { toast('No se pudo deshacer: ' + error.message, 'error'); return; }
    toast('Se vuelve a esperar el envío de esta unidad.', 'ok');
    await refrescarFilas();
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
      const pu = t.closest('[data-pend-unidad]');
      if (pu) { revisar(pu.dataset.pendUnidad, 'btnSeccionMovimiento'); return; }
      const pi = t.closest('[data-pend-ir]');
      if (pi) { irAPendiente(pi.dataset.pendIr); return; }
      if (t.closest('#munPrev')) moverUnidad(-1);
      else if (t.closest('#munNext')) moverUnidad(1);
      else if (t.closest('#munSigPend')) { const s = siguientePendiente(st.clues); if (s) cambiarUnidad(s.clues); }
      else if (t.closest('#munCtaSiguiente')) { const s = siguientePendiente(null); if (s) revisar(s.clues); }
      else if (t.closest('#munCopiarPendientes')) copiarPendientes(t.closest('#munCopiarPendientes'));
      else if (t.closest('#munVerMovimiento')) verMovimiento();
      else if (t.closest('#munSinEnvio')) marcarSinEnvio(st.clues);
      else if (t.closest('#munQuitarSinEnvio')) quitarSinEnvio(st.clues);
      else if (t.closest('#munVolverConcentrado') || t.closest('#munVolverConcentradoEnt')) irAPaso(3);
      else if (t.closest('#munVolverUnidades') || t.closest('#munVolverLista')) irAPaso(1);
      else if (t.closest('#munIrEntrega')) irAPaso(4);
      else if (t.closest('#munDescargarZip')) exportarZipMasivo(t.closest('#munDescargarZip'));
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

  // ------------------------------------------------------------ refresco en vivo
  // Cuando una unidad guarda, envía o corrige su SINBA-SIS, el panel se actualiza solo (antes había que dar F5):
  //  1) Realtime sobre sis06p_capturas (cambios agrupados en ~1 s);
  //  2) respaldo: al volver a la pestaña y cada 60 s con la pestaña visible, por si Realtime se cae.
  // Solo se repintan los resúmenes; la hoja de la unidad que estás revisando NO se toca (no pisa lo que editas):
  // si esa unidad cambió, aparece un aviso con «Recargar».
  const vivo = { canal: null, conectado: false, t: null, ocupado: false, poll: null, pendiente: false };
  const huella = (f) => [f.estado, f.enviado_en, f.validado_en, f.sin_movimiento ? 1 : 0, f.sin_envio ? 1 : 0, f.diferencias, f.correcciones_pendientes].join('|');

  function avisoCambioRemoto(f) {
    let el = $('munCambioRemoto');
    if (!f) { if (el) el.remove(); return; }
    if (!el) {
      const ref = $('munBarraRevision');
      if (!ref) return;
      el = document.createElement('div');
      el.id = 'munCambioRemoto';
      el.className = 'mun-cambio-remoto';
      el.setAttribute('role', 'status');
      ref.insertAdjacentElement('afterend', el);
      el.addEventListener('click', async (ev) => {
        if (!ev.target.closest('[data-recargar]')) return;
        if (!(await salidaSegura())) return;
        el.remove();
        $('selUnidadRevision').dispatchEvent(new Event('change'));
      });
    }
    el.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">sync_problem</span><span><b>${esc(f.unidad || f.clues)}</b> cambió su SINBA-SIS mientras lo tenías abierto.</span><button type="button" class="btn-secundario btn-mini" data-recargar>Recargar</button>`;
  }

  // La unidad que se está revisando cambió en el servidor (p. ej. acaba de ENVIAR). Validar y el resto de la barra salen del estado
  // que se leyó al abrirla, así que con el estado viejo faltaba Validar hasta recargar la página (Ctrl+F5). Si el revisor no tiene
  // nada sin guardar ni está tecleando, se relee sola; si sí, se deja intacto lo que escribe y se ofrece «Recargar».
  async function alCambiarUnidadAbierta(f, estadoAntes) {
    const sis = window.SIS06PBiovac;
    const tecleando = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.closest('#panelSIS06P, #panelMovimiento, #panelInfluenza, #panelCEH');
    if ((sis && sis.hayCambiosSinGuardar && sis.hayCambiosSinGuardar()) || tecleando) { avisoCambioRemoto(f); return; }
    avisoCambioRemoto(null);
    $('selUnidadRevision').dispatchEvent(new Event('change'));
    if (f.estado === 'ENVIADO' && estadoAntes !== 'ENVIADO') toast(`${f.unidad || f.clues} acaba de enviar su SINBA-SIS: ya puedes validarlo.`, 'ok');
  }

  async function sincronizarVivo() {
    if (!st.activo) return;
    if (vivo.ocupado) { vivo.pendiente = true; return; }
    vivo.ocupado = true;
    try {
      const antes = new Map(st.todas.map((f) => [f.clues, huella(f)]));
      const nombres = new Map(st.todas.map((f) => [f.clues, f.estado]));
      await refrescarFilas();
      const cambiadas = st.todas.filter((f) => antes.get(f.clues) !== huella(f));
      if (!cambiadas.length) return;
      if (st.paso === 1) pintarEnvios(st.todas);
      cambiadas.filter((f) => f.estado === 'ENVIADO' && nombres.get(f.clues) !== 'ENVIADO' && nombres.get(f.clues) !== 'VALIDADO')
        .slice(0, 3).forEach((f) => toast(`${f.unidad || f.clues} envió su SINBA-SIS.`, 'ok'));
      if (st.paso === 2 && st.clues) {
        const abierta = cambiadas.find((f) => f.clues === st.clues);
        if (abierta) await alCambiarUnidadAbierta(abierta, nombres.get(abierta.clues));
      }
    } catch (e) {
      console.warn('[Municipal] No se pudo actualizar en vivo:', e);
    } finally {
      vivo.ocupado = false;
      if (vivo.pendiente) { vivo.pendiente = false; programarVivo(); }
    }
  }
  function programarVivo(ms) {
    clearTimeout(vivo.t);
    vivo.t = setTimeout(sincronizarVivo, ms == null ? 900 : ms);
  }
  function iniciarVivo() {
    if (vivo.canal || !estado.db || typeof estado.db.channel !== 'function') return;
    try {
      vivo.canal = estado.db.channel('mun-sis06p-capturas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sis06p_capturas' }, (payload) => {
          const r = (payload && (payload.new && payload.new.clues ? payload.new : payload.old)) || {};
          const { mes, anio } = periodo();
          // Solo lo del mes que se ve y de las unidades de mi alcance (Realtime trae las altas de todos)
          if (r.clues && (Number(r.mes) !== mes || Number(r.anio) !== anio || !st.todas.some((f) => f.clues === r.clues))) return;
          programarVivo();
        })
        .subscribe((status) => { vivo.conectado = status === 'SUBSCRIBED'; });
    } catch (e) { vivo.canal = null; }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) programarVivo(200); });
    vivo.poll = setInterval(() => { if (!document.hidden && !vivo.conectado) sincronizarVivo(); }, 60000);
    // Con Realtime conectado igual se revisa cada 5 min por si se perdió algún evento
    setInterval(() => { if (!document.hidden && vivo.conectado) sincronizarVivo(); }, 300000);
  }

  async function init() {
    if (st.activo) return;
    st.activo = true;
    st.modo = estado.perfil && estado.perfil.rol === 'JURISDICCIONAL' ? 'juris' : 'municipal';
    document.body.classList.add('mun-guiado');
    $('tituloPagina').textContent = st.modo === 'juris' ? 'SINBA-SIS · Cierre de hospitales' : 'SINBA-SIS · Cierre del municipio';
    $('subtituloPagina').style.display = 'none';
    // La jurisdicción llega aquí desde el Concentrado jurisdiccional (tarjeta del hospital): siempre debe poder regresar.
    // Barra de ubicación fija arriba (se queda visible al bajar), con el botón grande y la miga de pan.
    if (st.modo === 'juris' && !$('munUbicacion')) {
      // A nivel de página (debajo de "Volver a SIREVAQ"), no dentro del encabezado con el logo: así se ve grande y se queda fija.
      const refUbicacion = document.querySelector('a.volver') || $('tituloPagina').closest('h1');
      const donde = document.querySelector('a.volver') ? 'afterend' : 'beforebegin';
      if (refUbicacion) refUbicacion.insertAdjacentHTML(donde, `
        <nav id="munUbicacion" class="mun-ubicacion" aria-label="Ubicación en el SINBA-SIS">
          <a id="munVolverJuris" class="mun-volver" href="biovac_jurisdiccion.html" aria-label="Volver al concentrado jurisdiccional, donde están los municipios y los hospitales">
            <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span><span>Volver al concentrado jurisdiccional</span>
          </a>
          <span class="mun-ubicacion-sep" aria-hidden="true">›</span>
          <span class="mun-ubicacion-aqui" aria-current="page">Cierre de hospitales</span>
        </nav>`);
    }
    $('rutaMes').style.display = 'flex';
    document.title = st.modo === 'juris' ? 'SINBA-SIS · Cierre de hospitales — SIREVAQ' : 'SINBA-SIS municipal — SIREVAQ';
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
    iniciarVivo();
  }

  window.MunicipalGuiado = { init, activo, paso: () => st.paso, pintarEnvios, revisar, irAPaso, refrescarFilas };
})();
