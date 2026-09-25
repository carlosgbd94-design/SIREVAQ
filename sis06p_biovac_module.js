/**
 * SIS / SINBA -- Captura mensual del concentrado SIS-06-P, portada a la
 * ventana de BioVac (Fase 3), con motor de envío/validación (Fase 4). NO
 * depende de `AppService`/`window.USER` -- usa el cliente Supabase
 * (`estado.db`) y la sesión (`estado.perfil`) de `biovac_ui.js`, y
 * `toast()`/`mostrarCargando()`/`ocultarCargando()` de ese mismo archivo.
 *
 * La unidad captura su concentrado MENSUAL completo (104 variables), NO por
 * día. Afromexicano/Indígena/Migrante son subconteos ilustrativos, subconjunto
 * del total, nunca se suman aparte.
 *
 * Flujo de estatus (motor en supabase/sis06p_estado_engine.sql):
 * BORRADOR (unidad edita libre) -> ENVIADO (unidad ya no edita; municipal/
 * jurisdiccional/admin sí, cada edición se audita automáticamente por
 * trigger) -> VALIDADO (municipal marcó validado; unidad ve "cambios
 * pendientes de aceptar" si hubo correcciones, y el botón Imprimir).
 * Este módulo también sirve como "modo revisión" para roles MUNICIPAL/
 * JURISDICCIONAL/ADMIN: `claveActiva()` resuelve la CLUES objetivo según
 * quién mira, no siempre `estado.perfil.clues`.
 */
(function () {
  let _sisVariablesCache = [];
  let _sis06pCapturasCache = [];
  let _influenzaCapturasCache = [];
  let _ventanaCache = null;
  let _correccionesPendientesCache = [];
  // Filas de sis06p_comparativo (RPC) de la CLUES/mes/año en pantalla: una
  // por biológico con algo que comparar. `null` = todavía no se pudo cargar
  // (en ese caso NO se bloquea el botón Enviar desde aquí -- el servidor
  // igual revisa la conciliación y rechaza el envío con el detalle).
  let _conciliacionCache = null;

  // "Hay captura tecleada que todavía no se guarda". El paloteo SIS-06-P se
  // guarda con su propio botón (a diferencia de Movimiento, que guarda por
  // celda): en una prueba real, una unidad tecleó todo el paloteo, se pasó a
  // la pestaña Movimiento y guardó SOLO esa -- el paloteo nunca llegó al
  // servidor (ni una petición) y no hubo ningún aviso. Ahora se rastrea, se
  // muestra un chip visible y biovac_ui.js pide guardar antes de cambiar de
  // pestaña / mes / unidad; el navegador avisa antes de cerrar la página.
  let _sinGuardar = false;
  function marcarSinGuardar(valor) {
    _sinGuardar = valor;
    const chip = document.getElementById('sis06pChipSinGuardar');
    if (chip) chip.style.display = valor ? 'inline-block' : 'none';
  }
  document.addEventListener('input', (ev) => {
    const id = ev.target && ev.target.id;
    if (id && id.indexOf('sisb_') === 0) marcarSinGuardar(true);
  });
  window.addEventListener('beforeunload', (ev) => {
    if (_sinGuardar) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // Copia de window.INFLUENZA_SIS_MAPPING (fuente única de verdad real:
  // influenza_module.js:57-72) -- biovac.html no carga influenza_module.js
  // (es de otra página/bundle), así que se duplica aquí solo esta constante
  // pequeña. Si cambia allá, hay que reflejarlo aquí.
  const INFLUENZA_SIS_MAPPING = {
    r1: "BIE01", r2: "BIE28", r3: "BIE29", r4: "BIE30", r5: "BIE31",
    r6: "BIE04", r7: "BIE32", r8: "BIE33", r9: "BIE34", r10: "BIE35",
    r11: "BIE36", r12: "BIE37", r13: "BIE38", r14: "BIE39", r15: "BIE40",
    r16: "BIO96", r17: "BIO97",
    r18: "BIE09", r19: "BIE10", r20: "BIE41",
    r21: "BIE12", r22: "BIE13", r23: "BIE42",
    r24: "BIE15", r25: "BIE16", r26: "BIE43",
    r27: "BIE18", r28: "BIE19", r29: "BIE44",
    r30: "BIE48", r31: "BIE49", r32: "BIE50",
    r33: "BIE24", r34: "BIE25", r35: "BIE46",
    r36: "BIE51", r37: "BIE52", r38: "BIE53",
    r39: "BIE54", r40: "BIE55",
    r41: "BIE56", r42: "BIE57", r43: "BIE58",
    r44: "BIE59", r45: "BIE60", r46: "BIE61"
  };

  // Mismos colores oficiales por biológico que ya usa el resto de SIREVAQ
  // en RDA (window.BIOLOGICO_COLORS en main.js / CLAVE_COLORES en
  // biovac_ui.js) -- aquí mapeados directo por el nombre `biologico` de
  // sis_variables, que no comparte llave con esos otros catálogos. Los
  // pocos biológicos que solo existen en sis_variables (sueros,
  // antitoxinas, "Otros biológicos") no tienen color oficial en RDA -- se
  // quedan con el acento de respaldo en vez de inventarles uno.
  const _SIS_COLOR_POR_BIOLOGICO = {
    'BCG': '#3A86B7',
    'HEPATITIS B': '#C43D3D',
    'HEXAVALENTE ACELULAR DPaT + IPV + Hib + HB': '#9ACD32',
    'DPT': '#E9C46A',
    'ROTAVIRUS RV1': '#264653',
    'NEUMOCÓCICA CONJUGADA (13 VALENTE)': '#3D405B',
    'NEUMOCÓCICA CONJUGADA (20 VALENTE)': '#3D405B',
    'S R P  TRIPLE VIRAL': '#B23A48',
    'SR DOBLE VIRAL': '#7B5EA7',
    'VARICELA*': '#059669',
    'HEPATITIS A': '#4b5563',
    'VPH': '#2A9D8F',
    'Td TETÁNICO DIFTÉRICO': '#5C5C5C',
    'Tdpa': '#E76F51',
    'COVID-19': '#4A4A4A',
    'VSR': '#A66B50'
  };
  function _normBio(str) {
    return String(str || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  }
  const _SIS_COLOR_LOOKUP = Object.fromEntries(
    Object.entries(_SIS_COLOR_POR_BIOLOGICO).map(([k, v]) => [_normBio(k), v])
  );
  const _RESPALDO_HEX = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#14b8a6', '#6366f1'];
  function _hexDeRespaldo(biologico) {
    let hash = 0;
    const str = String(biologico || '');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return _RESPALDO_HEX[hash % _RESPALDO_HEX.length];
  }
  // Mezcla un hex con blanco (pct 0-1) -- para el tono claro del degradado
  // del ícono, sin recurrir a un segundo color inventado por biológico.
  function _mezclarConBlanco(hex, pct) {
    const [r, g, b] = hexToRgb(hex).split(',').map((n) => parseInt(n.trim(), 10));
    const mix = (c) => Math.round(c + (255 - c) * pct);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }
  // `hexToRgb` es global de biovac_ui.js (cargado antes que este archivo,
  // mismo criterio que MESES/mesNombre).
  function accentDeBiologico(biologico) {
    const hex = _SIS_COLOR_LOOKUP[_normBio(biologico)] || _hexDeRespaldo(biologico);
    return {
      hex,
      light: _mezclarConBlanco(hex, .32),
      glow: `rgba(${hexToRgb(hex)}, .45)`,
      tint: `rgba(${hexToRgb(hex)}, .14)`,
      tintSoft: `rgba(${hexToRgb(hex)}, .07)`,
      wash: `rgba(${hexToRgb(hex)}, .06)`
    };
  }

  // Reutiliza el catálogo global `MESES` ya definido en biovac_ui.js
  // ({v,l}[], cargado antes que este archivo).
  function mesNombre(m) {
    const found = (typeof MESES !== 'undefined' ? MESES : []).find((x) => x.v === Number(m));
    return found ? found.l : String(m);
  }

  // "YYYY-MM-DD" (lo que regresa sis06p_ventana_envio, un `date` de
  // Postgres) -> "30 de septiembre de 2026" -- formato largo en español de
  // México, para que la fecha se lea de corrido en vez de como ISO crudo.
  function fechaLargaMX(fechaIso) {
    if (!fechaIso) return '';
    const [anio, mes, dia] = String(fechaIso).split('-').map(Number);
    if (!anio || !mes || !dia) return String(fechaIso);
    return `${dia} de ${mesNombre(mes).toLowerCase()} de ${anio}`;
  }

  // ---------------------------------------------------------------------------
  // Resolución de la CLUES/unidad "activa": UNIDAD siempre ve la suya propia
  // (selector bloqueado); MUNICIPAL/JURISDICCIONAL/ADMIN ven la que hayan
  // elegido en el selector compartido del encabezado (modo revisión). El
  // valor especial "Jurisdicción (suma)" no es una CLUES real -- SIS-06-P no
  // tiene sentido ahí, se resuelve a null y las pantallas muestran un aviso.
  // ---------------------------------------------------------------------------

  function esRolRevisor() {
    const rol = estado.perfil && estado.perfil.rol;
    return rol === 'MUNICIPAL' || rol === 'JURISDICCIONAL' || rol === 'ADMIN';
  }

  function datosUnidadActiva() {
    if (!estado.perfil) return null;
    if (estado.perfil.rol === 'UNIDAD') {
      return { clues: estado.perfil.clues, unidad: estado.perfil.unidad, municipio: estado.perfil.municipio };
    }
    // Roles revisores: la CLUES a revisar sale de #selUnidadRevision, NUNCA
    // de #selUnidad -- ese sigue siendo el municipio/hospital de Movimiento
    // (dos vistas separadas a propósito, ver biovac_ui.js).
    const selVal = document.getElementById('selUnidadRevision')?.value;
    if (!selVal) return null;
    const u = (estado.unidadesClues || estado.unidades || []).find((x) => x.id === selVal);
    if (!u) return null;
    return { clues: u.clues, unidad: u.nombre, municipio: u.municipio };
  }

  async function init() {
    const activa = datosUnidadActiva();
    const container = document.getElementById('sis06pCaptureGroupsContainer');
    if (!activa) {
      if (container) container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Selecciona una unidad (CLUES) específica arriba -- "Jurisdicción (suma)" no aplica a SIS-06-P.</div>';
      return;
    }
    try {
      if (_sisVariablesCache.length === 0) {
        const { data: vars, error: e1 } = await estado.db.from('sis_variables').select('*').eq('activo', true).order('orden');
        if (e1) throw e1;
        _sisVariablesCache = vars || [];
      }

      const { data: capturas, error: e2 } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      if (e2) throw e2;
      _sis06pCapturasCache = capturas || [];

      const { data: capturasInf, error: e3 } = await estado.db.from('influenza_capturas').select('fecha, valores').eq('clues', activa.clues);
      if (e3) throw e3;
      _influenzaCapturasCache = capturasInf || [];

      const mes = Number(document.getElementById('selMes').value);
      const anio = Number(document.getElementById('selAnio').value);
      const { data: ventana, error: e4 } = await estado.db.rpc('sis06p_ventana_envio', { p_anio: anio, p_mes: mes });
      if (e4) { console.warn('[SIS-06-P] Error cargando ventana:', e4); _ventanaCache = null; }
      else _ventanaCache = (ventana && ventana[0]) || null;

      await cargarCorreccionesPendientes(activa.clues);
      await cargarConciliacion(activa.clues);

      render();
    } catch (err) {
      console.error('[SIS-06-P] Error al cargar:', err);
      toast('Error al cargar SIS-06-P: ' + err.message, 'error');
    }
  }

  async function cargarCorreccionesPendientes(clues) {
    if (estado.perfil.rol !== 'UNIDAD') { _correccionesPendientesCache = []; return; }
    const { data, error } = await estado.db.from('sis06p_correcciones')
      .select('*').eq('clues', clues).eq('tipo', 'EDICION_MUNICIPAL').eq('reconocido_por_unidad', false)
      .order('creado_en', { ascending: false });
    if (error) { console.warn('[SIS-06-P] Error cargando correcciones pendientes:', error); _correccionesPendientesCache = []; return; }
    _correccionesPendientesCache = data || [];
  }

  const SUBCONTEO_LABEL = { total: 'Total', afro: 'Afromexicano', indigena: 'Indígena', migrante: 'Migrante' };

  function labelDeFila(filaExcel) {
    const v = _sisVariablesCache.find((x) => Number(x.fila_excel) === Number(filaExcel));
    if (!v) return `Fila ${filaExcel}`;
    // Mismo criterio de deduplicación que la tabla de captura: no repetir
    // dosis si es idéntica al grupo poblacional (así vienen varias filas en
    // la hoja real), y sumar la edad cuando la fila la trae, para que dos
    // filas que solo se distinguen por edad (Td, VPH) no se vean iguales
    // en este panel tampoco.
    const descripcion = (v.dosis && v.dosis !== v.grupo_poblacional)
      ? `${v.grupo_poblacional || ''} · ${v.dosis}`
      : (v.grupo_poblacional || v.dosis || '');
    return `${v.biologico} -- ${descripcion}${v.edad ? ' (' + v.edad + ')' : ''}`;
  }

  function renderPanelCambiosPendientes() {
    const panel = document.getElementById('sis06pPanelCambiosPendientes');
    const lista = document.getElementById('sis06pListaCambiosPendientes');
    if (!panel || !lista) return;

    if (estado.perfil.rol !== 'UNIDAD' || _correccionesPendientesCache.length === 0) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    lista.innerHTML = _correccionesPendientesCache.map((c) => `
      <div style="background:#fff; border:1px solid var(--warning-border); border-radius:10px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div style="font-size:11.5px;">
          <strong>${c.fila_excel != null ? labelDeFila(c.fila_excel) : (c.detalle || 'Ajuste')}</strong>${c.subconteo ? ' -- ' + (SUBCONTEO_LABEL[c.subconteo] || c.subconteo) : ''}:
          <span style="color:var(--muted); text-decoration:line-through;">${c.valor_anterior}</span>
          <span class="material-symbols-rounded" style="font-size:12px; vertical-align:middle;">arrow_forward</span>
          <strong style="color:var(--warning);">${c.valor_nuevo}</strong>
          <span style="color:var(--muted);"> -- ${c.usuario}, ${new Date(c.creado_en).toLocaleDateString('es-MX')}</span>
        </div>
        <button class="btn-mini btn-secundario" data-aceptar-correccion="${c.id}"><span class="material-symbols-rounded">check</span> Aceptar</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-aceptar-correccion]').forEach((btn) => {
      btn.addEventListener('click', () => aceptarCambio(btn.getAttribute('data-aceptar-correccion')));
    });
  }

  async function aceptarCambio(correccionId) {
    try {
      const { error } = await estado.db.rpc('sis06p_reconocer_correccion', { p_correccion_id: correccionId, p_usuario: nombreCompletoDePerfil(estado.perfil) });
      if (error) throw error;
      const activa = datosUnidadActiva();
      await cargarCorreccionesPendientes(activa.clues);
      renderPanelCambiosPendientes();
      toast('Cambio aceptado.', 'ok');
    } catch (err) {
      toast('Error al aceptar el cambio: ' + err.message, 'error');
    }
  }

  async function aceptarTodosCambios() {
    const activa = datosUnidadActiva();
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === Number(document.getElementById('selMes').value) && Number(r.anio) === Number(document.getElementById('selAnio').value));
    if (!currentReport) return;
    try {
      const { error } = await estado.db.rpc('sis06p_reconocer_todas', { p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil) });
      if (error) throw error;
      await cargarCorreccionesPendientes(activa.clues);
      renderPanelCambiosPendientes();
      toast('Todos los cambios fueron aceptados.', 'ok');
    } catch (err) {
      toast('Error al aceptar los cambios: ' + err.message, 'error');
    }
  }

  async function cargarConciliacion(clues) {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const { data, error } = await estado.db.rpc('sis06p_comparativo', { p_mes: mes, p_anio: anio, p_clues: clues });
    if (error) {
      console.warn('[SIS-06-P] Error cargando conciliación con Movimiento:', error);
      _conciliacionCache = null;
      return;
    }
    _conciliacionCache = data || [];
  }

  function hayDiferenciasConciliacion() {
    return Array.isArray(_conciliacionCache) && _conciliacionCache.some((f) => !f.coincide);
  }

  // Tarjeta "Conciliación con Movimiento de Biológico": el paloteo y el
  // Movimiento son un solo documento (el SIS) y sus dosis aplicadas tienen
  // que ser iguales, biológico por biológico. Mismo cálculo que hace el
  // servidor para bloquear Enviar/Validar (RPC sis06p_comparativo).
  // Comodín de sustitución (regla federal): si se aplicó SRP en lugar de SR
  // (o TdPa en lugar de DPT), el paloteo lo reporta como SR/DPT pero el
  // Movimiento lo da de baja como SRP/TdPa. La unidad declara aquí cuántas
  // dosis fueron; sin ese dato la diferencia bloquea el envío como cualquier
  // otra. Se guarda con el botón Guardar del paloteo (columna `ajustes`).
  const AJUSTES_DEF = [
    { key: 'SRP_COMO_SR', etiqueta: 'Dosis de SRP aplicadas y reportadas en el paloteo como SR', claves: ['SR', 'SRP'] },
    { key: 'TDPA_COMO_DPT', etiqueta: 'Dosis de TdPa aplicadas y reportadas en el paloteo como DPT', claves: ['DPT', 'TDPA'] }
  ];

  function htmlAjustes(soloLectura, currentReport) {
    const ajustes = (currentReport && currentReport.ajustes) || {};
    const hayPar = (_conciliacionCache || []).some((f) => !f.coincide && (f.claves || []).some((k) => ['SR', 'SRP', 'DPT', 'TDPA'].indexOf(k) >= 0));
    const hayAjuste = AJUSTES_DEF.some((d) => Number(ajustes[d.key] || 0) > 0);
    const filas = AJUSTES_DEF.map((d) => `
      <label style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; font-size:11.5px; font-weight:600; padding:4px 0;">
        <span>${d.etiqueta}</span>
        <input type="number" min="0" step="1" id="sisb_ajuste_${d.key}" ${soloLectura ? 'disabled' : ''}
          value="${Number(ajustes[d.key] || 0) > 0 ? Number(ajustes[d.key]) : ''}" placeholder="0"
          style="width:88px; text-align:center; font-weight:800; font-size:13px; border:1.5px solid #cbd5e1; border-radius:9px; padding:6px 8px; ${soloLectura ? 'background:#f1f5f9;' : ''}">
      </label>`).join('');
    return `
      <details ${(hayPar || hayAjuste) ? 'open' : ''} style="margin-top:10px; background:rgba(255,255,255,.65); border:1px solid rgba(0,0,0,.08); border-radius:10px;">
        <summary style="cursor:pointer; padding:8px 12px; font-size:11.5px; font-weight:800;">Ajuste por sustitución (comodín)${hayAjuste ? ' · capturado' : ''}</summary>
        <div style="padding:2px 12px 10px;">
          <div style="font-size:11px; font-weight:500; opacity:.85; margin-bottom:4px;">Si se aplicó SRP en lugar de SR, o TdPa en lugar de DPT, el paloteo la reporta como la vacuna original pero el Movimiento la da de baja como la que realmente se usó. Captura aquí cuántas dosis fueron y guarda para que la conciliación cuadre. No puede ser mayor a lo capturado de cada lado.</div>
          ${filas}
        </div>
      </details>`;
  }

  function renderConciliacion(soloLectura, currentReport) {
    const cont = document.getElementById('sis06pConciliacion');
    if (!cont) return;
    if (_conciliacionCache === null) { cont.style.display = 'none'; return; }

    const filas = _conciliacionCache;
    const dif = filas.filter((f) => !f.coincide);
    cont.style.display = 'block';

    if (filas.length === 0) {
      cont.style.cssText = 'display:block; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:12px; font-weight:700; background:#f1f5f9; color:#64748b;';
      cont.innerHTML = '<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">compare_arrows</span> Conciliación con Movimiento de Biológico: todavía no hay dosis aplicadas ni en el paloteo ni en el Movimiento de este mes.' + htmlAjustes(soloLectura, currentReport);
      return;
    }

    const ok = dif.length === 0;
    const fila = (f) => `
      <tr style="border-bottom:1px solid rgba(0,0,0,.06);">
        <td style="padding:5px 8px;">${f.etiqueta}</td>
        <td style="padding:5px 8px; text-align:center; font-weight:800;">${Number(f.paloteo)}</td>
        <td style="padding:5px 8px; text-align:center; font-weight:800;">${Number(f.aplicado)}</td>
        <td style="padding:5px 8px; text-align:center; font-weight:800;">${f.coincide ? '✓' : Number(f.paloteo) - Number(f.aplicado) > 0 ? `+${Number(f.paloteo) - Number(f.aplicado)}` : Number(f.paloteo) - Number(f.aplicado)}</td>
      </tr>`;
    const tabla = (lista) => `
      <div style="overflow-x:auto; margin-top:8px;">
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; font-weight:600;">
          <thead><tr style="text-align:center; font-size:10px; text-transform:uppercase; opacity:.75;">
            <th style="padding:4px 8px; text-align:left;">Biológico</th><th style="padding:4px 8px;">Paloteo SIS-06-P</th><th style="padding:4px 8px;">Aplicado (Movimiento)</th><th style="padding:4px 8px;">Diferencia</th>
          </tr></thead>
          <tbody>${lista.map(fila).join('')}</tbody>
        </table>
      </div>`;

    if (ok) {
      cont.style.cssText = 'display:block; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:12px; font-weight:700; background:var(--success-bg); color:var(--success);';
      cont.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">check_circle</span> Conciliación con Movimiento de Biológico: las dosis aplicadas coinciden en los ${filas.length} biológico(s) con captura.` + htmlAjustes(soloLectura, currentReport);
      return;
    }
    const esUnidad = estado.perfil && estado.perfil.rol === 'UNIDAD';
    cont.style.cssText = 'display:block; margin-bottom:14px; padding:12px 14px; border-radius:12px; font-size:12px; font-weight:700; background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);';
    cont.innerHTML = `
      <div><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">compare_arrows</span>
        ${dif.length} biológico(s) NO coinciden entre el paloteo SIS-06-P y el Movimiento de Biológico.
        ${esUnidad ? 'No podrás enviar el SIS hasta que las dosis aplicadas sean iguales -- corrige el paloteo aquí o las "aplicadas" por lote en Movimiento de Biológico.' : 'No se puede validar hasta que coincidan -- corrige el lado que esté mal (modo revisión).'}
      </div>
      ${tabla(dif)}
      ${htmlAjustes(soloLectura, currentReport)}`;
  }

  function renderBannerVentana(estadoActual) {
    const banner = document.getElementById('sis06pBannerVentana');
    if (!banner) return;
    if (!_ventanaCache || estado.perfil.rol !== 'UNIDAD' || estadoActual !== 'BORRADOR') {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    // Las fechas son el dato que de verdad importa en este aviso -- se
    // resaltan más grandes/oscuras que el resto del texto para que salten a
    // la vista sin tener que leer la frase completa.
    const destacada = (fecha) => `<strong style="font-size:13.5px; font-weight:900; letter-spacing:.01em;">${fecha}</strong>`;
    if (_ventanaCache.dentro_envio) {
      banner.style.cssText += 'background:var(--success-bg); color:var(--success);';
      banner.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">check_circle</span> Ya puedes enviar tu concentrado -- tienes hasta el ${destacada(fechaLargaMX(_ventanaCache.fin_envio))} para hacerlo.`;
    } else {
      banner.style.cssText += 'background:var(--warning-bg); color:var(--warning);';
      banner.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">schedule</span> Todavía puedes ir prellenando tu concentrado -- el envío se habilita del ${destacada(fechaLargaMX(_ventanaCache.inicio_envio))} al ${destacada(fechaLargaMX(_ventanaCache.fin_envio))}.`;
    }
  }

  function render() {
    const activa = datosUnidadActiva();
    const container = document.getElementById('sis06pCaptureGroupsContainer');
    if (!container) return;
    if (!activa) {
      container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Selecciona una unidad (CLUES) específica arriba -- "Jurisdicción (suma)" no aplica a SIS-06-P.</div>';
      return;
    }
    container.innerHTML = '';
    marcarSinGuardar(false); // los inputs se reconstruyen desde lo guardado

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    const currentValores = currentReport ? (currentReport.valores || {}) : {};
    const estadoActual = currentReport ? currentReport.estado : 'BORRADOR';

    const esUnidad = estado.perfil.rol === 'UNIDAD';
    const soloLectura = esUnidad ? (estadoActual !== 'BORRADOR') : (!currentReport || estadoActual === 'BORRADOR');

    // Badges y botones de acción
    const badge = document.getElementById('sis06pBadgeEstado');
    if (badge) {
      badge.className = 'estado-badge estado-' + estadoActual;
      badge.textContent = estadoActual === 'BORRADOR' ? 'Borrador' : estadoActual === 'ENVIADO' ? 'Enviado -- pendiente de validación' : 'Información validada';
    }
    renderBannerVentana(estadoActual);
    renderConciliacion(soloLectura, currentReport);
    renderPanelCambiosPendientes();

    const btnGuardar = document.getElementById('btnGuardarSIS06P');
    const btnEnviar = document.getElementById('btnEnviarSIS06P');
    const btnValidar = document.getElementById('btnMarcarValidado');
    const btnImprimir = document.getElementById('btnImprimirSIS06P');

    // El Excel oficial es el documento final -- no tiene caso (y puede
    // confundir) entregarlo antes de que el municipal valide el concentrado,
    // porque hasta ese momento la información todavía puede corregirse. Se
    // habilita para cualquier rol una vez que ESTE concentrado quedó en
    // VALIDADO, sin importar quién lo esté mirando.
    const btnExportar = document.getElementById('btnExportarSISCompleto');
    if (btnExportar) {
      const puedeExportar = estadoActual === 'VALIDADO';
      btnExportar.disabled = !puedeExportar;
      btnExportar.title = puedeExportar
        ? 'Exportar Excel oficial: SIS-06-P y, si ya iniciaste el movimiento de este mes, también Movimiento de Biológico'
        : 'Disponible hasta que el municipal valide el concentrado SIS-06-P de este mes';
    }

    if (esUnidad) {
      if (btnGuardar) btnGuardar.style.display = estadoActual === 'BORRADOR' ? 'inline-flex' : 'none';
      if (btnEnviar) {
        btnEnviar.style.display = estadoActual === 'BORRADOR' ? 'inline-flex' : 'none';
        const fueraDeVentana = !(_ventanaCache && _ventanaCache.dentro_envio);
        const noConcilia = hayDiferenciasConciliacion();
        btnEnviar.disabled = fueraDeVentana || noConcilia;
        btnEnviar.title = fueraDeVentana
          ? 'Fuera de la ventana de envío'
          : noConcilia ? 'El paloteo SIS-06-P y el Movimiento de Biológico no coinciden -- revisa la conciliación' : '';
      }
      if (btnValidar) btnValidar.style.display = 'none';
      if (btnImprimir) btnImprimir.style.display = estadoActual === 'VALIDADO' ? 'inline-flex' : 'none';
    } else {
      if (btnGuardar) btnGuardar.style.display = (currentReport && estadoActual !== 'BORRADOR') ? 'inline-flex' : 'none';
      if (btnEnviar) btnEnviar.style.display = 'none';
      if (btnValidar) btnValidar.style.display = (currentReport && estadoActual === 'ENVIADO') ? 'inline-flex' : 'none';
      if (btnImprimir) btnImprimir.style.display = 'none';
      if (!currentReport || estadoActual === 'BORRADOR') {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Esta unidad todavía no envía su concentrado de este mes -- nada que revisar todavía.</div>';
        return;
      }
    }

    const groups = new Map();
    _sisVariablesCache.forEach((v) => {
      if (!groups.has(v.biologico)) groups.set(v.biologico, []);
      groups.get(v.biologico).push(v);
    });

    groups.forEach((vars, biologico) => {
      // "Capturada" = la fila YA se guardó como parte del concentrado (existe
      // en `valores`), no "quedó en algo distinto de cero" -- muchas filas
      // (antitoxinas, sueros, rezagos) legítimamente no tienen aplicaciones
      // la mayoría de los meses, y contarlas como "pendientes" para siempre
      // desinforma tanto el badge X/Y como la barra de avance. Reportes
      // guardados ANTES de este cambio seguirán mostrando huecos en sus
      // filas que de verdad eran cero (esos meses nunca guardaron esa fila),
      // hasta que se vuelvan a guardar.
      const capturadas = vars.filter((v) => currentValores[String(v.fila_excel)] !== undefined).length;
      const accent = accentDeBiologico(biologico);

      const card = document.createElement('div');
      card.className = 'sis-card';

      const pct = vars.length ? Math.round((capturadas / vars.length) * 100) : 0;

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'sis-card-header';
      // El degradado de fondo es la "personalidad" de cada tarjeta -- muy
      // sutil (6% de opacidad) y en `background-image`, aparte de
      // `background-color`, para que el :hover (definido en CSS) se pueda
      // seguir viendo encima sin pelearse con un estilo inline.
      header.style.backgroundImage = `linear-gradient(120deg, ${accent.wash}, rgba(255,255,255,0) 65%)`;
      header.innerHTML = `
        <div class="sis-card-row">
          <span style="display:flex; align-items:center; gap:12px; min-width:0;">
            <span class="sis-icon-chip" style="background-image:linear-gradient(135deg, ${accent.light}, ${accent.hex}); box-shadow:0 3px 10px -3px ${accent.glow};">
              <span class="material-symbols-rounded">vaccines</span>
            </span>
            <span class="sis-card-title">${biologico}</span>
          </span>
          <span style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
            <span class="sis-card-count" style="background:${capturadas > 0 ? accent.tint : '#f1f5f9'}; color:${capturadas > 0 ? accent.hex : '#94a3b8'};">${capturadas}/${vars.length}</span>
            <span class="material-symbols-rounded sis-chevron" style="font-size:18px; color:#94a3b8; transition:transform .32s cubic-bezier(.4,0,.2,1);">expand_more</span>
          </span>
        </div>
        <div class="sis-progress-track">
          <div class="sis-progress-fill" style="width:${pct}%; background-image:linear-gradient(90deg, ${accent.light}, ${accent.hex});"></div>
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'sis-card-body';
      body.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:1px solid var(--outline-variant);">
                <th style="padding:10px; text-align:left; font-weight:600; color:#475569;">Grupo poblacional</th>
                <th style="padding:10px; text-align:center; width:140px; font-weight:600; font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:.03em;">Dosis</th>
                <th style="padding:10px; text-align:center; width:90px; font-weight:600; font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:.03em;">Clave</th>
                <th style="padding:10px; text-align:center; width:110px; font-weight:800; font-size:11px; color:#334155;">TOTAL</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Afromex.</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Indígena</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Migrante</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;

      const tbody = body.querySelector('tbody');
      vars.forEach((v) => {
        const rowVal = currentValores[String(v.fila_excel)] || {};
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom:1px solid #f1f5f9;';

        const dis = soloLectura ? 'disabled' : '';
        const mkTotal = (val) => `
          <input type="number" min="0" step="1" id="sisb_${v.fila_excel}_total" data-fila="${v.fila_excel}" data-kind="total" ${dis}
            style="width:88px; max-width:100%; text-align:center; font-weight:800; font-size:13px; color:${accent.hex};
              background:${soloLectura ? '#f1f5f9' : accent.tintSoft}; border:1.5px solid ${accent.hex}; border-radius:9px; padding:6px 8px; outline:none;"
            value="${val !== undefined && val !== null ? val : ''}" placeholder="0">`;
        const mkSub = (kind, val) => `
          <input type="number" min="0" step="1" id="sisb_${v.fila_excel}_${kind}" data-fila="${v.fila_excel}" data-kind="${kind}" ${dis}
            style="width:66px; max-width:100%; text-align:center; font-weight:500; font-size:11px; color:#94a3b8;
              background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:5px 6px; outline:none;"
            value="${val !== undefined && val !== null ? val : ''}" placeholder="0">`;

        // Clave vive en su propia columna, no ya metida dentro del texto de
        // la descripción -- antes el badge quedaba "esclavo" de qué tan
        // largo saliera ese texto (se encimaba o se iba a una línea rara
        // cuando la descripción era larga, ver VPH).
        const claveBadge = v.clave_general
          ? `<span style="display:inline-block;font-size:9px;font-weight:700;font-family:monospace;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:6px;white-space:nowrap;">${v.clave_general}</span>`
          : `<span style="display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;background:#e2e8f0;color:#94a3b8;padding:2px 7px;border-radius:20px;">No RDA</span>`;

        // Grupo poblacional y Dosis son columnas reales en la hoja
        // (BIOLÓGICO | DOSIS/GRUPO POBLACIONAL, con "dosis" -- ÚNICA,
        // PRIMERA, SEGUNDA... y a veces la franja de edad debajo, apilada
        // en la misma celda -- como su propia sub-columna, ver imagen del
        // formato real). Cuando la fila viene de una celda fusionada en el
        // Excel (mismo texto en ambas: "PRIMERA 2 A 11 MESES" en Hexavalente,
        // p.ej.), se muestra UNA sola vez con colspan en vez de repetirlo en
        // las dos columnas.
        const mismaCelda = v.dosis && v.dosis === v.grupo_poblacional;
        const edadHtml = v.edad ? `<br><span style="font-size:10px; color:#94a3b8; font-weight:600;">${v.edad}</span>` : '';
        const celdaDosis = `${v.dosis || '—'}${edadHtml}`;
        const celdasGrupoDosis = mismaCelda
          ? `<td colspan="2" style="padding:10px;"><span style="font-size:12px; font-weight:600; color:#334155;">${v.grupo_poblacional || v.dosis}${edadHtml}</span></td>`
          : `<td style="padding:10px;"><span style="font-size:12px; font-weight:600; color:#334155;">${v.grupo_poblacional || ''}</span></td>
             <td style="padding:10px; text-align:center; font-size:11px; font-weight:700; color:#475569; line-height:1.5;">${celdaDosis}</td>`;

        row.innerHTML = `
          ${celdasGrupoDosis}
          <td style="padding:10px; text-align:center;">${claveBadge}</td>
          <td style="padding:10px; text-align:center;">${mkTotal(rowVal.total)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('afro', rowVal.afro)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('indigena', rowVal.indigena)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('migrante', rowVal.migrante)}</td>
        `;
        tbody.appendChild(row);

        if (!soloLectura) {
          const totalInput = row.querySelector(`#sisb_${v.fila_excel}_total`);
          ['afro', 'indigena', 'migrante'].forEach((kind) => {
            const subInput = row.querySelector(`#sisb_${v.fila_excel}_${kind}`);
            const validate = () => {
              const total = parseInt(totalInput.value) || 0;
              const sub = parseInt(subInput.value) || 0;
              if (sub > total) {
                subInput.style.borderColor = '#ef4444'; subInput.style.background = '#fee2e2'; subInput.style.color = '#991b1b';
              } else {
                subInput.style.borderColor = '#e2e8f0'; subInput.style.background = '#f8fafc'; subInput.style.color = '#94a3b8';
              }
            };
            subInput.addEventListener('input', validate);
            totalInput.addEventListener('input', validate);
          });
        }
      });

      // Despliegue animado por altura (max-height), no un salto de
      // display:none/block -- ese no se puede animar. Se anima hacia un
      // valor numérico (scrollHeight) y, ya abierto, se suelta a "none" para
      // que el contenido pueda crecer/encogerse libre (p.ej. al reacomodarse
      // el layout) sin quedar recortado por una altura vieja congelada.
      header.addEventListener('click', () => {
        const abriendo = !body.classList.contains('abierto');
        header.querySelector('.sis-chevron').style.transform = abriendo ? 'rotate(180deg)' : 'rotate(0deg)';
        if (abriendo) {
          body.classList.add('abierto');
          body.style.maxHeight = body.scrollHeight + 'px';
          body.addEventListener('transitionend', function alTerminar(ev) {
            if (ev.propertyName !== 'max-height') return;
            body.removeEventListener('transitionend', alTerminar);
            if (body.classList.contains('abierto')) body.style.maxHeight = 'none';
          });
        } else {
          // Si venía de "none" (ya asentado, totalmente abierto), primero
          // hay que fijarlo a un número -- de "none" a "0" no anima, salta.
          body.style.maxHeight = body.scrollHeight + 'px';
          void body.offsetHeight; // fuerza reflow para que el navegador registre ese valor antes de cambiarlo
          body.classList.remove('abierto');
          body.style.maxHeight = '0px';
        }
      });

      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  // Nivel UNIDAD, guardar el paloteo SIS-06-P con dosis reales ES la señal
  // de que este mes ya se está capturando -- no tiene sentido además
  // pedirle un clic aparte en "Iniciar movimiento de este mes" (ese botón
  // sigue teniendo sentido para MUNICIPAL, que arranca desde un Excel
  // importado, no desde el paloteo de una unidad). Se crea el movimiento
  // en silencio la primera vez que hay algo que reportar; si ya existe, no
  // se toca -- nunca se pisa lo que la unidad ya esté capturando ahí.
  async function autoCrearMovimientoSiFalta(clues, mes, anio, totalReportado) {
    if (totalReportado <= 0) return;
    try {
      const unidadBiovac = (estado.unidades || []).find((u) => u.clues === clues);
      if (!unidadBiovac) return;
      const { data: existente } = await estado.db.from('biovac_movimientos')
        .select('id').eq('unidad_id', unidadBiovac.id).eq('anio', anio).eq('mes', mes).maybeSingle();
      if (existente) return;
      await estado.db.from('biovac_movimientos').insert({
        unidad_id: unidadBiovac.id, anio, mes,
        responsable_elaboracion: nombreCompletoDePerfil(estado.perfil) || '',
        fecha_corte: ultimoDiaMes(anio, mes)
      });
    } catch (err) {
      console.warn('[SIS-06-P] No se pudo auto-crear el movimiento de este mes:', err);
    }
  }

  async function save() {
    const activa = datosUnidadActiva();
    if (!activa) { toast('Selecciona una unidad (CLUES) específica.', 'error'); return false; }

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const clues = activa.clues;
    const esUnidad = estado.perfil.rol === 'UNIDAD';

    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (esUnidad && currentReport && currentReport.estado !== 'BORRADOR') {
      toast('Este concentrado ya fue enviado -- no puedes editarlo directamente.', 'error');
      return false;
    }
    if (!esUnidad && (!currentReport || currentReport.estado === 'BORRADOR')) {
      toast('Esta unidad todavía no envía su concentrado -- nada que corregir.', 'error');
      return false;
    }

    let hasSubconteoError = false;
    const valores = {};
    _sisVariablesCache.forEach((v) => {
      const total = parseInt(document.getElementById(`sisb_${v.fila_excel}_total`)?.value) || 0;
      const afro = parseInt(document.getElementById(`sisb_${v.fila_excel}_afro`)?.value) || 0;
      const indigena = parseInt(document.getElementById(`sisb_${v.fila_excel}_indigena`)?.value) || 0;
      const migrante = parseInt(document.getElementById(`sisb_${v.fila_excel}_migrante`)?.value) || 0;
      if (afro > total || indigena > total || migrante > total) hasSubconteoError = true;
      // Se guarda la fila SIEMPRE, aunque quede en cero -- si no, un renglón
      // que la unidad sí revisó y de verdad no tuvo aplicaciones este mes
      // (frecuente en antitoxinas/sueros/rezagos) queda indistinguible de
      // uno que nunca se tocó, y el conteo de "capturadas" (barra de avance,
      // badge X/Y) lo cuenta como pendiente para siempre. No afecta CSV/
      // Excel/comparativo con Movimiento -- esos ya trataban "falta la
      // fila" y "fila en cero" exactamente igual (default a 0).
      valores[v.fila_excel] = { total, afro, indigena, migrante };
    });

    if (hasSubconteoError) {
      toast('No se puede guardar: hay subconteos (Afromexicano/Indígena/Migrante) que superan el Total de su misma fila.', 'error');
      return false;
    }

    mostrarCargando(esUnidad ? 'Guardando concentrado SIS-06-P...' : 'Guardando corrección...');
    try {
      const nombreActor = nombreCompletoDePerfil(estado.perfil) || String(estado.perfil.usuario || '');
      let hist = [];
      if (currentReport && currentReport.historial_ediciones) {
        hist = typeof currentReport.historial_ediciones === 'string' ? JSON.parse(currentReport.historial_ediciones) : currentReport.historial_ediciones;
      }
      hist.push({
        fecha_edicion: new Date().toISOString(),
        editado_por: estado.perfil.rol,
        usuario: nombreActor,
        valores_anteriores: currentReport ? currentReport.valores : null
      });

      // Comodín de sustitución: solo se guardan los ajustes > 0.
      const ajustes = {};
      AJUSTES_DEF.forEach((d) => {
        const v = parseFloat(document.getElementById(`sisb_ajuste_${d.key}`)?.value);
        if (Number.isFinite(v) && v > 0) ajustes[d.key] = v;
      });

      const record = {
        clues,
        unidad: activa.unidad,
        municipio: activa.municipio,
        mes, anio, valores, ajustes,
        capturado_por: currentReport ? currentReport.capturado_por : nombreActor,
        historial_ediciones: hist,
        ultimo_editor_usuario: nombreActor,
        updated_at: new Date().toISOString()
      };

      const { error } = await estado.db.from('sis06p_capturas').upsert(record, { onConflict: 'clues,mes,anio' });
      if (error) throw error;

      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', clues);
      _sis06pCapturasCache = capturas || [];
      await cargarConciliacion(clues);
      render();

      const totalReportado = Object.values(valores).reduce((s, v) => s + Number(v.total || 0), 0);
      if (esUnidad) await autoCrearMovimientoSiFalta(clues, mes, anio, totalReportado);
      toast(`✅ ${esUnidad ? 'Concentrado' : 'Corrección'} guardado · ${totalReportado} dosis en ${Object.keys(valores).length} variables.`, 'ok');
      return true;
    } catch (err) {
      console.error('[SIS-06-P] Error al guardar:', err);
      toast('Error al guardar: ' + err.message, 'error');
      return false;
    } finally {
      ocultarCargando();
    }
  }

  // Para rol UNIDAD, paloteo (SIS-06-P) y Movimiento de Biológico NO son dos
  // cosas separadas -- son un solo archivo, "el SIS" -- así que "Enviar" es
  // UN solo botón que bloquea las dos mitades. TODA la lógica vive en el RPC
  // sis06p_enviar_para_validacion, en UNA sola transacción del servidor:
  // ventana de fechas, que exista el Movimiento del mes, conciliación de
  // dosis aplicadas (paloteo = Movimiento, biológico por biológico), cierre
  // del Movimiento y cambio de estado. Si cualquiera falla no queda nada a
  // medias -- antes el cierre del Movimiento se hacía desde aquí ANTES del
  // envío, y un rechazo posterior dejaba el Movimiento bloqueado.
  async function enviarParaValidacion() {
    const activa = datosUnidadActiva();
    if (!activa) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport) { toast('Guarda tu concentrado antes de enviarlo.', 'error'); return; }
    if (_sinGuardar) { toast('Tienes cambios sin guardar en el paloteo -- guárdalos antes de enviar.', 'error'); return; }

    const unidadBiovac = (estado.unidades || []).find((u) => u.clues === activa.clues);

    mostrarCargando('Enviando el SIS para validación...');
    try {
      const { error } = await estado.db.rpc('sis06p_enviar_para_validacion', {
        p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil)
      });
      if (error) throw error;
      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      _sis06pCapturasCache = capturas || [];
      await cargarConciliacion(activa.clues);
      render();
      toast('✅ SIS enviado para validación (SIS-06-P + Movimiento de Biológico, ya bloqueados para edición).', 'ok');

      // Si la pestaña Movimiento ya tenía cargado este mismo movimiento,
      // se refresca para que su badge de estado (BORRADOR->CERRADO) y el
      // bloqueo de edición se reflejen sin tener que recargar la página --
      // best-effort: si esta función no existe o falla, el envío YA quedó
      // aplicado en base de datos de todas formas.
      try {
        if (unidadBiovac && typeof cargarMovimiento === 'function' && estado.movimiento
          && estado.movimiento.unidad_id === unidadBiovac.id
          && Number(estado.movimiento.anio) === anio && Number(estado.movimiento.mes) === mes) {
          await cargarMovimiento();
        }
      } catch (errRefresh) {
        console.warn('[SIS-06-P] No se pudo refrescar la pestaña Movimiento (el envío ya quedó aplicado):', errRefresh);
      }
    } catch (err) {
      console.error('[SIS-06-P] Error al enviar:', err);
      // Se refresca la conciliación por si el rechazo fue por diferencias --
      // así la tarjeta muestra exactamente qué biológicos no coinciden.
      try { await cargarConciliacion(activa.clues); render(); } catch (_) { /* no-op */ }
      toast('No se pudo enviar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  // Basta con insertar la notificación maestra -- verificado contra la base
  // real: notificaciones tiene un trigger AFTER INSERT
  // (trg_fanout_notification / fanout_notification_trigger()) que ya
  // resuelve destinatarios por target_scope='CLUES' del lado del servidor
  // (unidad + municipal/jurisdiccional/admin), el mismo mecanismo que usa
  // el resto de la app -- repetir ese reparto a mano aquí (como en un
  // intento anterior) solo duplicaba filas en notificaciones_perfil.
  // Best-effort: si falla, se avisa por consola pero NUNCA se revierte la
  // validación ya aplicada -- la notificación es un plus, no una condición
  // del flujo.
  async function notificarUnidadValidacion(activa, mes, anio) {
    try {
      const hoy = new Date();
      const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      // type='SIS_VALIDADO' + meta_json es lo que main.js (openNotifDetailModal)
      // usa para mostrar el botón "Ir a mi SIS" y armar el enlace directo a
      // biovac.html con clues/mes/año ya resueltos -- sin esto la unidad
      // tendría que volver a seleccionar mes/año a mano.
      const { error } = await estado.db.from('notificaciones').insert({
        id: 'NOTIF:' + btoa(activa.clues + ':' + Date.now()),
        created_ts: hoy.toISOString(),
        created_date: ymd,
        from_usuario: estado.perfil.usuario,
        from_rol: estado.perfil.rol,
        target_scope: 'CLUES',
        target_municipio: activa.municipio || null,
        target_clues: activa.clues,
        target_usuario: null,
        type: 'SIS_VALIDADO',
        title: 'Concentrado SIS-06-P validado',
        message: `El concentrado SIS-06-P de ${mesNombre(mes)} ${anio} ya fue validado -- ya puedes descargar, exportar e imprimir el Excel oficial.`,
        meta_json: JSON.stringify({ source: 'SIS06P', clues: activa.clues, mes, anio }),
        status: 'UNREAD'
      });
      if (error) throw error;
    } catch (err) {
      console.error('[SIS-06-P] No se pudo notificar a la unidad tras validar (la validación ya quedó aplicada):', err);
    }
  }

  async function marcarValidado() {
    const activa = datosUnidadActiva();
    if (!activa) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport) return;

    const confirmado = await mostrarModal({
      titulo: 'Marcar como Validado',
      mensaje: `Vas a marcar como validado el concentrado SIS-06-P de ${activa.unidad} (${mesNombre(mes)} ${anio}). La unidad ya no podrá editarlo directamente y verá cualquier corrección que hayas hecho. ¿Confirmas?`,
      textoAceptar: 'Marcar como Validado'
    });
    if (!confirmado) return;

    mostrarCargando('Marcando como validado...');
    try {
      const { error } = await estado.db.rpc('sis06p_marcar_validado', {
        p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil)
      });
      if (error) throw error;
      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      _sis06pCapturasCache = capturas || [];
      await cargarConciliacion(activa.clues);
      render();
      toast('✅ Concentrado marcado como validado.', 'ok');
      notificarUnidadValidacion(activa, mes, anio);
    } catch (err) {
      console.error('[SIS-06-P] Error al validar:', err);
      try { await cargarConciliacion(activa.clues); render(); } catch (_) { /* no-op */ }
      toast('No se pudo validar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  // ---------------------------------------------------------------------------
  // Imprimir -- solo disponible con estado VALIDADO. Clona el acordeón ya
  // expandido, en modo solo-lectura, dentro de #sis06pVistaImprimible; el
  // CSS @media print (en biovac.html) oculta todo lo demás.
  // ---------------------------------------------------------------------------

  function prepararImpresion() {
    const activa = datosUnidadActiva();
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport || currentReport.estado !== 'VALIDADO') return;

    const destino = document.getElementById('sis06pVistaImprimible');
    if (!destino) return;

    const origen = document.getElementById('sis06pCaptureGroupsContainer');
    const clon = origen.cloneNode(true);
    clon.querySelectorAll('div').forEach((d) => { if (d.style && d.style.display === 'none') d.style.display = 'block'; });
    clon.querySelectorAll('input').forEach((i) => {
      const span = document.createElement('span');
      span.textContent = i.value || '0';
      span.style.cssText = 'display:inline-block; padding:4px 8px; font-weight:700;';
      i.replaceWith(span);
    });

    destino.innerHTML = `
      <div style="padding:20px; font-family:sans-serif;">
        <h2 style="margin:0 0 4px;">Concentrado Mensual SIS-06-P</h2>
        <p style="margin:0 0 16px; font-size:13px;">
          ${activa.unidad} (${activa.clues}) -- ${activa.municipio}<br>
          ${mesNombre(mes)} ${anio} -- Validado por ${currentReport.validado_por || ''} el ${currentReport.validado_en ? new Date(currentReport.validado_en).toLocaleDateString('es-MX') : ''}
        </p>
      </div>
    `;
    destino.appendChild(clon);
    window.print();
  }

  // ---------------------------------------------------------------------------
  // Pestaña CSV: mismas filas (CLUES, MUNICIPIO, VARIABLE_SIS, MES, ANIO, VALOR)
  // que ya acepta el panel RDA.
  //
  // Para rol UNIDAD sigue siendo solo su propia CLUES (buildCSVRowsActuales,
  // ya tenía sentido: una unidad solo tiene una CLUES). Para MUNICIPAL
  // (único rol revisor que llega a esta pestaña, ver btnCsv.style.display en
  // biovac_ui.js) el listado ahora es el municipio COMPLETO -- todas sus
  // CLUES reales, una fila por variable por cada una, con VALOR=0 para las
  // que todavía no capturan nada -- y se va "llenando sola" porque se
  // consulta en vivo cada vez que se abre esta pestaña o cambia mes/año,
  // nunca desde una caché de una sola unidad. Antes esto mostraba solo la
  // CLUES seleccionada en "unidad a revisar", que es para lo que sirve el
  // modo revisión del SIS-06-P (editar/validar una unidad a la vez), pero no
  // tiene sentido para el CSV: el municipio necesita ver el concentrado
  // completo para poder armar lo que se sube al departamento de estadística.
  // ---------------------------------------------------------------------------

  // Suma, por rubro (r1..r46), las capturas SEMANALES reales de Influenza
  // (panel semanal de la unidad -- ahí dice "meta-logro" pero lo que se
  // teclea ahí son aplicaciones reales) que caen dentro del mes/año
  // calendario pedido.
  function sumasInfluenzaPorRubro(mes, anio) {
    const enMes = _influenzaCapturasCache.filter((c) => {
      if (!c.fecha) return false;
      const d = new Date(c.fecha + 'T12:00:00');
      return (d.getMonth() + 1) === mes && d.getFullYear() === anio;
    });
    const sumas = {};
    enMes.forEach((c) => {
      Object.entries(c.valores || {}).forEach(([rubro, val]) => {
        sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0);
      });
    });
    return sumas;
  }

  // Suma las capturas semanales de Influenza que caen dentro del mes/año
  // calendario pedido y las traduce a filas SIS vía INFLUENZA_SIS_MAPPING.
  // Solo emite filas si hubo al menos una semana capturada ese mes -- si no,
  // no hay nada que decir de Influenza ese periodo.
  function buildInfluenzaCSVRows(clues, municipio, mes, anio) {
    const sumas = sumasInfluenzaPorRubro(mes, anio);
    if (Object.keys(sumas).length === 0) return [];
    return Object.entries(INFLUENZA_SIS_MAPPING).map(([rubro, clave]) => ({
      CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: clave, MES: mes, ANIO: anio, VALOR: sumas[rubro] || 0
    }));
  }

  function buildCSVRowsActuales() {
    const activa = datosUnidadActiva();
    if (!activa) return [];
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const clues = activa.clues;
    const municipio = activa.municipio;
    const captura = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);

    const rows = [];
    if (captura) {
      const valores = captura.valores || {};
      _sisVariablesCache.forEach((v) => {
        const val = valores[String(v.fila_excel)] || {};
        const total = Number(val.total || 0);
        if (v.clave_general) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_general, MES: mes, ANIO: anio, VALOR: total });
        const afro = Number(val.afro || 0);
        if (v.clave_afro && afro > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_afro, MES: mes, ANIO: anio, VALOR: afro });
        const indigena = Number(val.indigena || 0);
        if (v.clave_indigena && indigena > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_indigena, MES: mes, ANIO: anio, VALOR: indigena });
        const migrante = Number(val.migrante || 0);
        if (v.clave_migrante && migrante > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_migrante, MES: mes, ANIO: anio, VALOR: migrante });
      });
    }
    return rows.concat(buildInfluenzaCSVRows(clues, municipio, mes, anio));
  }

  // Municipio completo: todas las CLUES reales activas de ese municipio
  // (excluye la pseudo-unidad 'JS1-...', que no tiene paloteo SIS-06-P
  // propio), consultado fresco cada vez -- nunca desde _sis06pCapturasCache
  // (esa caché es y sigue siendo de una sola CLUES a la vez, la usan además
  // la captura/impresión/Excel oficial de este mismo módulo, no se toca).
  async function buildCSVRowsMunicipioCompleto(municipio, mes, anio) {
    const { data: unidadesReales, error: eU } = await estado.db.from('biovac_unidades')
      .select('clues, nombre').eq('municipio', municipio).eq('activo', true).not('clues', 'like', 'JS1-%').order('clues');
    if (eU) throw eU;
    const listaUnidades = unidadesReales || [];
    if (listaUnidades.length === 0) return [];
    const cluesList = listaUnidades.map((u) => u.clues);

    if (_sisVariablesCache.length === 0) {
      const { data: vars, error: e1 } = await estado.db.from('sis_variables').select('*').eq('activo', true).order('orden');
      if (e1) throw e1;
      _sisVariablesCache = vars || [];
    }

    const [{ data: capturas, error: eC }, { data: capturasInf, error: eI }] = await Promise.all([
      estado.db.from('sis06p_capturas').select('clues, valores').in('clues', cluesList).eq('mes', mes).eq('anio', anio),
      estado.db.from('influenza_capturas').select('clues, fecha, valores').in('clues', cluesList)
    ]);
    if (eC) throw eC;
    if (eI) console.error('[SIS-06-P] Error cargando influenza para CSV municipal:', eI);

    const capturaPorClues = new Map((capturas || []).map((c) => [c.clues, c]));
    const infPorClues = new Map();
    (capturasInf || []).forEach((c) => {
      if (!infPorClues.has(c.clues)) infPorClues.set(c.clues, []);
      infPorClues.get(c.clues).push(c);
    });

    const rows = [];
    listaUnidades.forEach((u) => {
      // Sin captura todavía -> valores vacíos, así que cada variable con
      // clave sale con VALOR=0 (misma regla que una unidad que sí capturó
      // pero puso 0): la fila existe siempre, para que el listado completo
      // se vea desde el día 1 y solo se vaya "llenando" con números reales.
      const captura = capturaPorClues.get(u.clues);
      const valores = captura ? (captura.valores || {}) : {};
      _sisVariablesCache.forEach((v) => {
        const val = valores[String(v.fila_excel)] || {};
        const total = Number(val.total || 0);
        if (v.clave_general) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_general, MES: mes, ANIO: anio, VALOR: total });
        const afro = Number(val.afro || 0);
        if (v.clave_afro && afro > 0) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_afro, MES: mes, ANIO: anio, VALOR: afro });
        const indigena = Number(val.indigena || 0);
        if (v.clave_indigena && indigena > 0) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_indigena, MES: mes, ANIO: anio, VALOR: indigena });
        const migrante = Number(val.migrante || 0);
        if (v.clave_migrante && migrante > 0) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_migrante, MES: mes, ANIO: anio, VALOR: migrante });
      });

      const infEnMes = (infPorClues.get(u.clues) || []).filter((c) => {
        if (!c.fecha) return false;
        const d = new Date(c.fecha + 'T12:00:00');
        return (d.getMonth() + 1) === Number(mes) && d.getFullYear() === Number(anio);
      });
      if (infEnMes.length > 0) {
        const sumas = {};
        infEnMes.forEach((c) => {
          Object.entries(c.valores || {}).forEach(([rubro, val]) => { sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0); });
        });
        Object.entries(INFLUENZA_SIS_MAPPING).forEach(([rubro, clave]) => {
          rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: clave, MES: mes, ANIO: anio, VALOR: sumas[rubro] || 0 });
        });
      }
    });

    // Ordenado por CLUES ascendente -- sort de JS es estable, así que dentro
    // de cada CLUES las filas conservan el orden del catálogo.
    rows.sort((a, b) => String(a.CLUES).localeCompare(String(b.CLUES)));
    return rows;
  }

  function esRolUnidad() { return Boolean(estado.perfil && estado.perfil.rol === 'UNIDAD'); }

  async function filasCSVSegunRol() {
    if (esRolUnidad()) return buildCSVRowsActuales();
    const activa = datosUnidadActiva();
    if (!activa) return [];
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    return buildCSVRowsMunicipioCompleto(activa.municipio, mes, anio);
  }

  async function renderCSVPreview() {
    const tbody = document.getElementById('csvUnidadTbody');
    if (!tbody) return;
    const esUnidad = esRolUnidad();

    const titulo = document.getElementById('csvPanelTitulo');
    const subtitulo = document.getElementById('csvPanelSubtitulo');
    if (titulo && subtitulo) {
      if (esUnidad) {
        titulo.textContent = 'CSV -- lo que se subirá a RDA';
        subtitulo.textContent = 'Mes seleccionado arriba, una fila por clave SIS con su valor -- mismo formato que ya acepta el panel RDA.';
      } else {
        titulo.textContent = 'CSV -- concentrado completo del municipio';
        subtitulo.textContent = 'Todas las CLUES del municipio, una fila por clave SIS -- se va llenando conforme cada unidad captura (0 mientras no ha capturado).';
      }
    }

    tbody.innerHTML = '<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--muted);">Cargando…</td></tr>';
    let rows;
    try {
      rows = await filasCSVSegunRol();
    } catch (err) {
      console.error('[SIS-06-P] Error cargando vista previa CSV:', err);
      tbody.innerHTML = `<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--error);">Error: ${err.message || err}</td></tr>`;
      return;
    }
    if (rows.length === 0) {
      const msg = esUnidad
        ? 'No hay concentrado guardado para este mes/año todavía -- captúralo en la pestaña SIS-06-P y guarda.'
        : 'No hay unidades activas en este municipio.';
      tbody.innerHTML = `<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">${msg}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 9px; font-family:monospace; color:var(--muted);">${r.CLUES}</td>
        <td style="padding:8px 9px; font-family:monospace; font-weight:700; color:var(--primary);">${r.VARIABLE_SIS}</td>
        <td style="padding:8px 9px;">${mesNombre(r.MES)}</td>
        <td style="padding:8px 9px;">${r.ANIO}</td>
        <td style="padding:8px 9px; text-align:center; font-weight:800;">${r.VALOR}</td>
      </tr>
    `).join('');
  }

  async function downloadCSV() {
    const esUnidad = esRolUnidad();
    let rows;
    try {
      rows = await filasCSVSegunRol();
    } catch (err) {
      toast(err.message || 'Error al generar el CSV.', 'error');
      return;
    }
    if (rows.length === 0) { toast('No hay datos para descargar.', 'error'); return; }
    const headers = ['CLUES', 'MUNICIPIO', 'VARIABLE_SIS', 'MES', 'ANIO', 'VALOR'];
    const csvLines = [headers.join(',')].concat(
      rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    );
    const blob = new Blob(['﻿' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = esUnidad
      ? `SIS06P_${rows[0].CLUES}_${rows[0].MES}_${rows[0].ANIO}.csv`
      : `SIS06P_${rows[0].MUNICIPIO}_${rows[0].MES}_${rows[0].ANIO}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Exportar a la plantilla oficial (.xlsx) -- confirmado contra
  // SINBA-VER_26_2026.xlsx, hoja "SINBA-SIS-06-P": la columna Y es el TOTAL
  // (dedicada, no hace falta desglosar por edad), V/W/X son Afromexicano/
  // Indígena/Migrante, y `sis_variables.fila_excel` ya es el número de
  // renglón real de esa hoja (se verificó al construir el catálogo en
  // Fase 1). Los encabezados A6/B6/H6/L6/W3/V3 en el original son fórmulas
  // que dependen de un selector en la hoja ÍNDICE -- en vez de arriesgar un
  // desajuste de texto contra ese catálogo, aquí se sobrescriben directo con
  // los valores ya conocidos (mismo criterio que ya usaba el prototipo
  // sinba_dev/main.js con syncMetadataHeaders).
  // ---------------------------------------------------------------------------

  const COL_TOTAL = 25, COL_AFRO = 22, COL_INDIGENA = 23, COL_MIGRANTE = 24;

  // Llena la hoja real "MOV-DE-BIOLÓGICO" de la plantilla con el mismo motor
  // que ya usan las exportaciones municipal/jurisdiccional de Movimiento de
  // Biológico (construirWorkbookDesdeDatos, en biovac_export_excel.js) --
  // ese motor NO depende del layout fijo de la plantilla: limpia todo bajo
  // el encabezado y reconstruye bloque por bloque (tantos renglones de lote/
  // A.R.F./Canje como haga falta ese mes), tomando el estilo real de la
  // propia hoja (fila 13=normal, 16=A.R.F., 18=Total, verificado contra
  // SINBA-VER_26_2026.xlsx) -- por eso es adaptativo de verdad, no limitado
  // a 3 renglones normales + 2 de A.R.F./Canje. El morado de Canje (vs. rojo
  // de A.R.F.) ya lo resuelve ese mismo motor por categoría, sin nada extra
  // aquí.
  async function llenarMovimientoOficial(wb, unidadBiovac, movimiento) {
    const wsMov = wb.getWorksheet('MOV-DE-BIOLÓGICO');
    if (!wsMov) throw new Error('La plantilla no tiene la hoja "MOV-DE-BIOLÓGICO".');

    const [{ data: bloques }, { data: biologicos }] = await Promise.all([
      estado.db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden'),
      estado.db.from('biovac_catalogo_biologicos').select('*').order('orden_en_bloque')
    ]);
    const { data: renglonesDb } = await estado.db.from('biovac_renglones')
      .select(`categoria, existencia_anterior_frascos, recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b, observaciones,
        biovac_lotes ( numero_lote, caducidad, dosis_por_frasco_override, biologico_id )`)
      .eq('movimiento_id', movimiento.id);

    const diaCorte = movimiento.fecha_corte ? Number(movimiento.fecha_corte.slice(8, 10)) : new Date(movimiento.anio, movimiento.mes, 0).getDate();
    const datosHeader = {
      mesNombre: MESES_NOMBRE_MAYUS[movimiento.mes - 1], dia: diaCorte, anio: movimiento.anio,
      municipio: unidadBiovac.nombre, responsable: movimiento.responsable_elaboracion || ''
    };
    await window.BiovacExportExcel.construirWorkbookDesdeDatos({
      ws: wsMov, bloques: bloques || [], biologicos: biologicos || [], renglonesDb: renglonesDb || [],
      anio: movimiento.anio, mes: movimiento.mes, datosHeader
    });

    // El override genérico del motor (pensado para biovac_plantilla.xlsx,
    // donde esa posición es un número plano) escribe el año como NÚMERO en
    // I7 -- pero en esta plantilla esa celda es la que originalmente traía
    // ÍNDICE!U3 (una FECHA completa, con formato que solo muestra el año).
    // Escribir 2026 como número ahí lo vuelve un serial de fecha absurdo
    // (Excel lo lee como 18-jul-1905). Se corrige con la fecha real.
    const fechaCorte = new Date(Date.UTC(movimiento.anio, movimiento.mes - 1, diaCorte));
    wsMov.getCell('I7').value = fechaCorte;
    wsMov.getCell('J7').value = fechaCorte;
  }

  const MESES_NOMBRE_MAYUS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // ---------------------------------------------------------------------------
  // La hoja ÍNDICE del workbook original solo existía para que alguien
  // eligiera a mano (desde un selector) la unidad/mes/responsable que
  // alimentaba, por fórmula, TODAS las demás hojas (SINBA-SIS-06-P,
  // MOV-DE-BIOLÓGICO, SIS-SS-CE-H-2026 y SIS-SS-IE Mensual -- verificado
  // celda por celda con un script contra el archivo real). Como esos datos
  // ya los conocemos directo de la app, no hace falta el selector: se
  // sustituye cada fórmula conocida por su valor ya resuelto, en TODO el
  // libro, y solo entonces se puede quitar la hoja ÍNDICE sin dejar ningún
  // #REF! colgado en ninguna de las otras 4 hojas (incluidas las que este
  // módulo no llena todavía, como SIS-SS-CE-H-2026).
  // ---------------------------------------------------------------------------

  function mapaReemplazosIndice(ctx) {
    return {
      'IF(ÍNDICE!C4=0," ",ÍNDICE!C4)': ctx.unidad,
      'IF(ÍNDICE!G4=0," ",ÍNDICE!G4)': ctx.clues,
      'IF(ÍNDICE!J4=0," ",ÍNDICE!J4)': ctx.responsable,
      'IF(ÍNDICE!O4=0," ",ÍNDICE!O4)': ctx.mesNombre,
      'IF(ÍNDICE!S3=0," ",ÍNDICE!S3)': ctx.dia,
      'IF(ÍNDICE!U3=0," ",ÍNDICE!U3)': ctx.fechaCorte,
      'IFERROR(VLOOKUP(ÍNDICE!O4,DATOS!J81:K92,2,0)," ")': ctx.mesCodigo,
      // Localidad (vía VLOOKUP contra DATOS!E94:F168) -- no se captura en
      // ningún lado del sistema, se deja en blanco a propósito (mismo
      // criterio ya usado para H6 desde Fase 3b).
      'IFERROR(VLOOKUP(ÍNDICE!C4,DATOS!E94:F168,2,0)," ")': '',
      'TEXT(IF(ÍNDICE!$U$3=0," ",ÍNDICE!$U$3),"AAAA")': String(ctx.anio),
      'TEXT(ÍNDICE!$U$3,"aaaa")': String(ctx.anio),
      '"Del 1ro al "&IF(SUM(ÍNDICE!S3)=0," ",SUM(ÍNDICE!S3)&" de")': `Del 1ro al ${ctx.dia} de`,
      '"del "&TEXT(ÍNDICE!$U$3,"aaaa")': `del ${ctx.anio}`
    };
  }

  function resolverReferenciasIndiceYQuitarHoja(wb, ctx) {
    const mapa = mapaReemplazosIndice(ctx);
    wb.eachSheet((ws) => {
      if (ws.name === 'ÍNDICE') return;
      ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value;
          if (v && typeof v === 'object' && typeof v.formula === 'string') {
            if (Object.prototype.hasOwnProperty.call(mapa, v.formula)) {
              cell.value = mapa[v.formula];
            } else if (/ÍNDICE/i.test(v.formula)) {
              console.warn('[SIS-06-P] Fórmula sin mapear referenciando ÍNDICE, se deja en blanco:', ws.name, cell.address, v.formula);
              cell.value = '';
            }
          }
        });
      });
    });
    const wsIndice = wb.getWorksheet('ÍNDICE');
    if (wsIndice) wb.removeWorksheet(wsIndice.id);
  }

  // Fila 11 = r1/BIE01 ... fila 56 = r46/BIE61, en el MISMO orden que
  // INFLUENZA_SIS_MAPPING (verificado celda por celda contra la plantilla
  // real) -- columnas H..L son "SEMANA 1".."SEMANA 5" del mes reportado, NO
  // una semana de campaña fija. El panel de Influenza no numera sus
  // capturas por semana-del-mes, solo trae una `fecha` por captura, así que
  // aquí se ordenan cronológicamente las capturas de ese mes calendario y
  // se reparten en orden a las 5 columnas -- si por algún motivo hubiera
  // más de 5 en un mismo mes (no debería, un mes tiene cuando mucho 5
  // viernes), la(s) sobrante(s) se suman dentro de la 5ta en vez de
  // perderse, para que el TOTAL (columna G, fórmula de la propia plantilla)
  // siga siendo exacto.
  const FILA_INFLUENZA_INICIO = 11;
  const COL_SEMANA_INICIO = 8; // H

  function llenarInfluenzaOficial(wb, mes, anio) {
    const ws = wb.getWorksheet('SIS-SS-IE Mensual');
    if (!ws) return false;

    const enMes = (_influenzaCapturasCache || [])
      .filter((c) => {
        if (!c.fecha) return false;
        const d = new Date(c.fecha + 'T12:00:00');
        return (d.getMonth() + 1) === mes && d.getFullYear() === anio;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (enMes.length === 0) return false;

    const rubros = Object.keys(INFLUENZA_SIS_MAPPING);
    enMes.forEach((captura, idx) => {
      const col = COL_SEMANA_INICIO + Math.min(idx, 4);
      rubros.forEach((rubro, i) => {
        const val = Number((captura.valores || {})[rubro] || 0);
        if (!val) return;
        const cell = ws.getCell(FILA_INFLUENZA_INICIO + i, col);
        cell.value = Number(cell.value || 0) + val;
      });
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Exportación oficial UNIFICADA: un solo .xlsx con SIS-06-P, Influenza
  // (SIS-SS-IE Mensual, tomada del panel semanal), SIS-SS-CE-H-2026 y, si la
  // unidad ya inició su Movimiento de Biológico de este mes, también esa
  // hoja -- para la unidad su "SIS" es un solo documento, no un archivo por
  // pestaña (el CSV sigue siendo la única excepción real, con su propio
  // botón en la pestaña CSV, porque alimenta un pipeline distinto -- carga
  // a RDA).
  // ---------------------------------------------------------------------------

  async function exportarSISOficialCompleto() {
    const activa = datosUnidadActiva();
    if (!activa) { toast('Selecciona una unidad (CLUES) específica.', 'error'); return; }

    await init();

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    const unidadBiovac = (estado.unidades || []).find((u) => u.clues === activa.clues);

    // Misma regla que deshabilita el botón en render() -- se repite aquí
    // porque esta función es la fuente de verdad real (el botón deshabilitado
    // ya debería impedir el clic, pero no hay que confiar solo en eso).
    if (!captura || captura.estado !== 'VALIDADO') {
      toast('El concentrado SIS-06-P debe estar Validado por el municipal antes de poder exportarlo.', 'error');
      return;
    }

    mostrarCargando('Generando Excel oficial...');
    try {
      let movimiento = null;
      if (unidadBiovac) {
        const { data: mov } = await estado.db.from('biovac_movimientos')
          .select('*').eq('unidad_id', unidadBiovac.id).eq('anio', anio).eq('mes', mes).maybeSingle();
        movimiento = mov || null;
      }

      const resp = await fetch('SINBA-VER_26_2026.xlsx');
      if (!resp.ok) throw new Error('No se pudo cargar la plantilla oficial (SINBA-VER_26_2026.xlsx).');
      const buffer = await resp.arrayBuffer();

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      // Las 4 tablas de Excel en DATOS (QUERÉTARO/MARQUÉS/CORREGIDORA/
      // HUIMILPAN -- listas de unidades por municipio) solo alimentaban el
      // selector desplegable de la hoja ÍNDICE (data validation
      // INDIRECT($B$4)), que ya no existe -- aquí la unidad/CLUES se
      // conocen directo de la app. Se quitan aquí (no se usan para nada
      // más) porque ExcelJS reescribe mal su <autoFilter>/totalsRowShown al
      // guardar (agrega un filterColumn que no traía la plantilla e invierte
      // headerRowCount/totalsRowShown) -- verificado contra Excel real: el
      // archivo generado quedaba "dañado" y Excel lo reparaba solo, quitando
      // ese autoFilter de todas formas. Mejor quitar las tablas por
      // completo que dejar que ExcelJS las corrompa.
      const wsDatos = wb.getWorksheet('DATOS');
      if (wsDatos && wsDatos.tables) {
        Object.keys(wsDatos.tables).forEach((nombreTabla) => {
          try { wsDatos.removeTable(nombreTabla); } catch (errTabla) { console.warn('[SIS-06-P] No se pudo quitar tabla', nombreTabla, errTabla); }
        });
      }

      const ws = wb.getWorksheet('SINBA-SIS-06-P');
      if (!ws) throw new Error('La plantilla no tiene la hoja "SINBA-SIS-06-P".');

      const diaCorte = new Date(anio, mes, 0).getDate();
      const responsableGeneral = captura.capturado_por || (movimiento && movimiento.responsable_elaboracion) || '';

      // H6 (localidad, via VLOOKUP contra DATOS!E94:F168) se deja intacta --
      // esa columna es la LOCALIDAD de la unidad (ej. "JURICA PUEBLO"), no
      // el municipio, y no la capturamos en ningún lado -- verificado contra
      // un ejemplo real (LOMAS.xlsx) antes de escribir esto, mejor dejarla
      // en blanco (fórmula sin resolver) que meter un dato equivocado en un
      // reporte oficial.
      ws.getCell('A6').value = captura.unidad || activa.unidad || '';
      ws.getCell('B6').value = captura.clues || activa.clues;
      ws.getCell('L6').value = responsableGeneral;
      // W3 = código de mes de 2 dígitos ("08" para agosto, NO el nombre) y
      // V3 = días del mes (NO el año) -- también verificado contra
      // LOMAS.xlsx: W3="08", V3=31 para un reporte de agosto.
      ws.getCell('W3').value = String(mes).padStart(2, '0');
      ws.getCell('V3').value = diaCorte;

      const valores = captura.valores || {};
      _sisVariablesCache.forEach((v) => {
        const val = valores[String(v.fila_excel)];
        if (!val) return;
        const row = Number(v.fila_excel);
        const total = Number(val.total || 0);
        const afro = Number(val.afro || 0);
        const indigena = Number(val.indigena || 0);
        const migrante = Number(val.migrante || 0);
        if (total > 0) ws.getCell(row, COL_TOTAL).value = total;
        if (afro > 0) ws.getCell(row, COL_AFRO).value = afro;
        if (indigena > 0) ws.getCell(row, COL_INDIGENA).value = indigena;
        if (migrante > 0) ws.getCell(row, COL_MIGRANTE).value = migrante;
      });

      let movimientoIncluido = false;
      let movimientoErrorMsg = null;
      if (movimiento && unidadBiovac && window.BiovacExportExcel) {
        try {
          await llenarMovimientoOficial(wb, unidadBiovac, movimiento);
          movimientoIncluido = true;
        } catch (errMov) {
          console.error('[SIS-06-P] No se pudo llenar Movimiento de Biológico en el Excel:', errMov);
          movimientoErrorMsg = errMov.message;
        }
      }

      // Ya se conocen unidad/clues/mes/año/responsable/fecha de corte --
      // sustituye toda referencia restante a ÍNDICE (en las 4 hojas, no solo
      // en las que este módulo llena) por su valor resuelto y quita la hoja,
      // que ya quedó obsoleta. ANTES de llenar Influenza a propósito --
      // probado contra Excel real (no solo openpyxl/XML): escribir en
      // SIS-SS-IE Mensual ANTES de recorrer+quitar ÍNDICE deja el .xlsx
      // marcado como dañado al abrirlo (Excel lo repara solo, pero igual
      // asusta al usuario) -- invertido el orden, abre limpio. No se
      // encontró la causa exacta dentro de ExcelJS, pero el orden importa.
      resolverReferenciasIndiceYQuitarHoja(wb, {
        unidad: captura.unidad || activa.unidad || (unidadBiovac && unidadBiovac.nombre) || '',
        clues: captura.clues || activa.clues,
        responsable: responsableGeneral,
        mesNombre: MESES_NOMBRE_MAYUS[mes - 1],
        mesCodigo: String(mes).padStart(2, '0'),
        dia: diaCorte,
        anio,
        fechaCorte: new Date(Date.UTC(anio, mes - 1, diaCorte))
      });

      let influenzaIncluida = false;
      try {
        influenzaIncluida = llenarInfluenzaOficial(wb, mes, anio);
      } catch (errInf) {
        console.error('[SIS-06-P] No se pudo llenar SIS-SS-IE Mensual (Influenza) en el Excel:', errInf);
      }

      // SIS-SS-CE-H-2026 trae fórmulas propias de la plantilla que leen en
      // vivo de SINBA-SIS-06-P / MOV-DE-BIOLÓGICO (verificado celda por
      // celda, ver sinba_dev/dependencies.js) -- nunca se tocan aquí, solo
      // se le escriben valores a esas 2 hojas fuente. SIS-SS-IE Mensual, en
      // cambio, SÍ se llena directo arriba (llenarInfluenzaOficial) -- sus
      // fórmulas propias (G11:G56, fila 57-58) solo sirven para sumar lo que
      // ya se escribió, no para traerlo de otra hoja. En ambos casos, Excel
      // normalmente muestra el valor CACHEADO que traía la plantilla (casi
      // siempre vacío/0) hasta que alguien presiona F9, porque no sabe que
      // esas celdas cambiaron por fuera de sus propias fórmulas --
      // fullCalcOnLoad fuerza el recálculo completo al abrir el archivo.
      wb.calcProperties = wb.calcProperties || {};
      wb.calcProperties.fullCalcOnLoad = true;

      const outBuffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SIS_${activa.clues}_${mes}_${anio}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const hojasExtra = 'SIS-SS-CE-H-2026' + (influenzaIncluida ? ' + SIS-SS-IE Mensual (Influenza)' : '');
      if (movimientoErrorMsg) {
        toast('Excel generado solo con SIS-06-P -- no se pudo incluir Movimiento de Biológico: ' + movimientoErrorMsg, 'error');
      } else if (movimientoIncluido) {
        toast(`✅ Excel generado: SIS-06-P + Movimiento de Biológico + ${hojasExtra}.`, 'ok');
      } else {
        toast(`✅ Excel generado con SIS-06-P + ${hojasExtra} (aún no inicias el Movimiento de Biológico de este mes).`, 'ok');
      }
    } catch (err) {
      console.error('[SIS-06-P] Error al exportar Excel oficial:', err);
      toast('Error al exportar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnGuardar = document.getElementById('btnGuardarSIS06P');
    if (btnGuardar) btnGuardar.addEventListener('click', save);
    const btnEnviar = document.getElementById('btnEnviarSIS06P');
    if (btnEnviar) btnEnviar.addEventListener('click', enviarParaValidacion);
    const btnValidar = document.getElementById('btnMarcarValidado');
    if (btnValidar) btnValidar.addEventListener('click', marcarValidado);
    const btnImprimir = document.getElementById('btnImprimirSIS06P');
    if (btnImprimir) btnImprimir.addEventListener('click', prepararImpresion);
    const btnAceptarTodos = document.getElementById('btnAceptarTodosCambios');
    if (btnAceptarTodos) btnAceptarTodos.addEventListener('click', aceptarTodosCambios);
    const btnCSV = document.getElementById('btnDescargarCSVUnidad');
    if (btnCSV) btnCSV.addEventListener('click', downloadCSV);
    const btnExcel = document.getElementById('btnExportarSISCompleto');
    if (btnExcel) btnExcel.addEventListener('click', exportarSISOficialCompleto);
  });

  // INFLUENZA_SIS_MAPPING se expone para que sis06p_dashboard_module.js (el
  // export oficial por municipio, ver renderExportOficial/exportarCSVOficialMunicipio)
  // pueda reutilizar la misma fuente de verdad en vez de duplicarla una
  // tercera vez -- ya se duplicó una vez desde influenza_module.js (Fase 3c)
  // porque biovac.html no carga ese archivo; no hace falta duplicarla otra
  // vez dentro del propio biovac.html, donde ambos módulos sí conviven.
  window.SIS06PBiovac = { init, render, save, hayCambiosSinGuardar: () => _sinGuardar, renderCSVPreview, exportarSISOficialCompleto, INFLUENZA_SIS_MAPPING };
})();
