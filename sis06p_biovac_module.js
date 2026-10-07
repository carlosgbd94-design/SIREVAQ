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
    actualizarDock();
    renderRutaMes();
  }
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    const id = el && el.id;
    if (id && id.indexOf('sisb_') === 0) {
      // Sin ceros a la izquierda: un "5" tecleado sobre un 0 no debe quedar como "05".
      if (el.type === 'number' && /^0\d/.test(el.value)) el.value = el.value.replace(/^0+(?=\d)/, '');
      marcarSinGuardar(true); draftProgramar();
    }
  });
  // Al entrar a una casilla se selecciona lo que tiene (y un 0 suelto se vacía): lo que se teclea reemplaza, no se pega al 0.
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el || !el.id || el.id.indexOf('sisb_') !== 0 || el.type !== 'number' || el.disabled || el.readOnly) return;
    if (el.value === '0') el.value = '';
    else if (typeof el.select === 'function') { try { el.select(); } catch (e) { /* algunos navegadores no seleccionan number */ } }
  });
  window.addEventListener('beforeunload', (ev) => {
    if (_sinGuardar) { draftEscribirYa(); ev.preventDefault(); ev.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && _sinGuardar) draftEscribirYa(); });

  // ---------------------------------------------------------------------------
  // Respaldo local del paloteo. Lo que se teclea se copia al navegador (por
  // persona, CLUES y mes) y solo se borra cuando el servidor confirma el
  // guardado: si se cae el internet, falla el guardado, se cierra la pestaña o
  // se recarga, al volver a abrir el mes se repone lo tecleado y se avisa.
  // ---------------------------------------------------------------------------
  const DRAFT_PREFIJO = 'sis06p_draft_v1:';
  let _draftTimer = null;
  let _ultimoGuardadoFallo = false;

  function esErrorDeRedSIS(err) {
    if (typeof esErrorDeRed === 'function') return esErrorDeRed(err);
    return (typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|network request failed|load failed|timeout/i.test(String((err && err.message) || err || ''));
  }

  function draftClave() {
    const activa = datosUnidadActiva();
    const selMes = document.getElementById('selMes');
    const selAnio = document.getElementById('selAnio');
    if (!activa || !estado.perfil || !selMes || !selAnio) return null;
    return DRAFT_PREFIJO + (estado.perfil.id || estado.perfil.usuario || 'anon') + ':' + activa.clues + ':' + selAnio.value + ':' + selMes.value;
  }
  function draftLeer() {
    const k = draftClave();
    if (!k) return null;
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  }
  function draftBorrar() {
    clearTimeout(_draftTimer);
    const k = draftClave();
    if (!k) return;
    try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
  }
  function draftCapturarDelDom() {
    const valores = {};
    _sisVariablesCache.forEach((v) => {
      const g = (kind) => { const el = document.getElementById('sisb_' + v.fila_excel + '_' + kind); return el ? el.value : ''; };
      valores[v.fila_excel] = [g('total'), g('afro'), g('indigena'), g('migrante')];
    });
    const ajustes = {};
    AJUSTE_KEYS.forEach((k) => { const el = document.getElementById('sisb_ajuste_' + k); if (el && el.value !== '') ajustes[k] = el.value; });
    return { valores, ajustes };
  }
  function draftEscribirYa() {
    clearTimeout(_draftTimer);
    const k = draftClave();
    if (!k || !_sinGuardar || !document.getElementById('sisb_' + ((_sisVariablesCache[0] || {}).fila_excel) + '_total')) return;
    const cap = capturaDelMesActual();
    try {
      localStorage.setItem(k, JSON.stringify(Object.assign(draftCapturarDelDom(), { base: cap ? cap.updated_at || null : null, ts: Date.now() })));
    } catch (e) { /* sin almacenamiento: se sigue sin respaldo */ }
  }
  function draftProgramar() {
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(draftEscribirYa, 350);
  }

  // Repone en las casillas lo respaldado que difiere de lo guardado en el servidor.
  function draftAplicar(currentReport, soloLectura) {
    const banner = document.getElementById('sis06pBannerBorrador');
    if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
    const d = draftLeer();
    if (!d) return;
    if (soloLectura) { draftBorrar(); return; } // este mes ya no admite captura: nada viejo se aplica
    const base = currentReport ? (currentReport.valores || {}) : {};
    const kinds = ['total', 'afro', 'indigena', 'migrante'];
    let cambios = 0;
    const tocados = [];
    _sisVariablesCache.forEach((v) => {
      const arr = d.valores && d.valores[v.fila_excel];
      if (!arr) return;
      const guardado = base[String(v.fila_excel)] || {};
      kinds.forEach((kind, idx) => {
        const el = document.getElementById('sisb_' + v.fila_excel + '_' + kind);
        if (!el) return;
        if ((Number(arr[idx]) || 0) === (Number(guardado[kind]) || 0)) return;
        el.value = arr[idx];
        tocados.push(el);
        cambios++;
      });
    });
    const ajGuardados = (currentReport && currentReport.ajustes) || {};
    AJUSTE_KEYS.forEach((k) => {
      const el = document.getElementById('sisb_ajuste_' + k);
      if (!el) return;
      const nuevo = d.ajustes && d.ajustes[k] !== undefined ? d.ajustes[k] : '';
      if ((parseFloat(nuevo) || 0) === (parseFloat(ajGuardados[k]) || 0)) return;
      el.value = nuevo;
      tocados.push(el);
      cambios++;
    });
    if (!cambios) { draftBorrar(); return; }
    tocados.forEach((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
    marcarSinGuardar(true);
    const hora = d.ts ? new Date(d.ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const viejo = (d.base || null) !== ((currentReport && currentReport.updated_at) || null);
    if (banner) {
      banner.style.cssText = 'display:block; margin-bottom:14px; padding:11px 14px; border-radius:12px; font-size:12px; font-weight:700; background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);';
      banner.innerHTML = `<span class="material-symbols-rounded" style="font-size:15px; vertical-align:middle;">restore</span>
        Recuperamos tu avance sin guardar${hora ? ' (' + hora + ')' : ''}: son ${cambios} casilla${cambios === 1 ? '' : 's'} distinta${cambios === 1 ? '' : 's'} de lo guardado. Revísalas y toca <b>Guardar</b>.
        ${viejo ? '<br><span style="font-weight:600;">Ojo: este concentrado cambió en el servidor después de tu borrador. Revisa los números antes de guardar.</span>' : ''}
        <button type="button" class="btn-mini btn-secundario" id="btnDescartarBorrador" style="margin-left:8px;"><span class="material-symbols-rounded">undo</span> Descartar y volver a lo guardado</button>`;
      const btn = document.getElementById('btnDescartarBorrador');
      if (btn) btn.addEventListener('click', () => { draftBorrar(); _sinGuardar = false; render(); });
    }
  }

  window.addEventListener('online', () => {
    if (_sinGuardar && _ultimoGuardadoFallo) {
      toast('Regresó la conexión: guardando tu avance…', 'ok');
      save();
    }
  });

  // Catálogo de Influenza (hoja SIS-SS-IE): rubro (r1..r46, el mismo id que
  // guarda el panel Meta-Logro en influenza_capturas.valores) -> categoría/
  // grupo/edad + clave SIS. Copia de INFLUENZA_RUBROS + INFLUENZA_SIS_MAPPING
  // (fuente única real: influenza_module.js:2-72) -- biovac.html no carga
  // influenza_module.js (es de otra página/bundle), así que se duplica aquí.
  // Si cambia allá, hay que reflejarlo aquí. Los ids se asignan en orden
  // (r1, r2, ...), igual que allá.
  const _INF_5_9_19_59 = ['5 a 9 años', '10 a 19 años', '20 a 59 años'];
  const _INF_GRUPOS_DEF = [
    ['Población blanco', 'Primera dosis', ['6 a 11 meses', '12 a 23 meses', '24 a 35 meses', '36 a 47 meses', '48 a 59 meses'], ['BIE01', 'BIE28', 'BIE29', 'BIE30', 'BIE31']],
    ['Población blanco', 'Segunda dosis', ['7 a 11 meses', '12 a 23 meses', '24 a 35 meses', '36 a 47 meses', '48 a 59 meses'], ['BIE04', 'BIE32', 'BIE33', 'BIE34', 'BIE35']],
    ['Población blanco', 'Revacunación', ['18 a 23 meses', '24 a 35 meses', '36 a 47 meses', '48 a 59 meses', '60 años y más'], ['BIE36', 'BIE37', 'BIE38', 'BIE39', 'BIE40']],
    ['Población de riesgo de 5 a 59 años', 'Grupos de riesgo', ['Embarazadas', 'Personal de salud en unidades médicas'], ['BIO96', 'BIO97']],
    ['Población de riesgo de 5 a 59 años', 'Personas que viven con VIH/SIDA', _INF_5_9_19_59, ['BIE09', 'BIE10', 'BIE41']],
    ['Población de riesgo de 5 a 59 años', 'Diabetes mellitus', _INF_5_9_19_59, ['BIE12', 'BIE13', 'BIE42']],
    ['Población de riesgo de 5 a 59 años', 'Obesidad mórbida', _INF_5_9_19_59, ['BIE15', 'BIE16', 'BIE43']],
    ['Población de riesgo de 5 a 59 años', 'Personas con cardiopatías agudas o crónicas', _INF_5_9_19_59, ['BIE18', 'BIE19', 'BIE44']],
    ['Población de riesgo de 5 a 59 años', 'Personas con enfermedad pulmonar crónica, incluye EPOC y asma', _INF_5_9_19_59, ['BIE48', 'BIE49', 'BIE50']],
    ['Población de riesgo de 5 a 59 años', 'Personas con cáncer', _INF_5_9_19_59, ['BIE24', 'BIE25', 'BIE46']],
    ['Población de riesgo de 5 a 59 años', 'Enfermedades cardiacas o pulmonares congénitas, u otros padecimientos crónicos que requieran consumo prolongado de salicilatos', ['5 a 9 años', '10 a 19 años'], ['BIE51', 'BIE52']],
    ['Población de riesgo de 5 a 59 años', 'Personas con insuficiencia renal', _INF_5_9_19_59, ['BIE53', 'BIE54', 'BIE55']],
    ['Población de riesgo de 5 a 59 años', 'Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA', _INF_5_9_19_59, ['BIE56', 'BIE57', 'BIE58']],
    ['Población de riesgo de 5 a 59 años', 'Otros grupos', _INF_5_9_19_59, ['BIE59', 'BIE60', 'BIE61']]
  ];
  const INFLUENZA_FILAS = [];
  _INF_GRUPOS_DEF.forEach(([categoria, grupo, edades, claves]) => {
    edades.forEach((edad, i) => INFLUENZA_FILAS.push({ id: 'r' + (INFLUENZA_FILAS.length + 1), categoria, grupo, edad, clave: claves[i] }));
  });
  const INFLUENZA_SIS_MAPPING = {};
  INFLUENZA_FILAS.forEach((f) => { INFLUENZA_SIS_MAPPING[f.id] = f.clave; });

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
      renderCEH();
      renderInfluenza();
      actualizarDock();
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

      const { data: capturasInf, error: e3 } = await estado.db.from('influenza_capturas').select('id, fecha, valores, sin_movimiento, capturado_por, anio_campana, municipio, unidad').eq('clues', activa.clues);
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
      toast(esErrorDeRedSIS(err)
        ? 'No se pudo cargar tu SIS: sin conexión o conexión inestable. Revisa tu internet y vuelve a intentar (lo que tengas respaldado en este dispositivo no se pierde).'
        : 'Error al cargar SIS-06-P: ' + err.message, 'error');
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
    { idx: 0, a: 'SR', b: 'SRP', claves: ['SR', 'SRP'], sisA: 'SR DOBLE VIRAL', sisB: 'S R P  TRIPLE VIRAL', keyFwd: 'SRP_COMO_SR', keyRev: 'SR_COMO_SRP' },
    { idx: 1, a: 'DPT', b: 'TdPa', claves: ['DPT', 'TDPA'], sisA: 'DPT', sisB: 'Tdpa', keyFwd: 'TDPA_COMO_DPT', keyRev: 'DPT_COMO_TDPA' }
  ];
  const AJUSTE_KEYS = AJUSTES_DEF.reduce((acc, d) => acc.concat([d.keyFwd, d.keyRev]), []);

  const _num2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  // Paloteo de un biológico SIS tal como está EN PANTALLA (lo que se está
  // tecleando, sin guardar): suma de los totales de sus variables, con la
  // media dosis contando ½ igual que el servidor. null si esas celdas no
  // están pintadas (se usa entonces lo guardado).
  function paloteoVivo(sisBio) {
    const vars = _sisVariablesCache.filter((v) => v.biologico === sisBio);
    let total = 0; let hay = false;
    vars.forEach((v) => {
      const el = document.getElementById(`sisb_${v.fila_excel}_total`);
      if (!el) return;
      hay = true;
      total += (parseFloat(el.value) || 0) * (v.media_dosis ? 0.5 : 1);
    });
    return hay ? _num2(total) : null;
  }

  function ajusteVivo(key, currentReport) {
    const el = document.getElementById(`sisb_ajuste_${key}`);
    if (el) return _num2(parseFloat(el.value));
    return _num2(((currentReport && currentReport.ajustes) || {})[key]);
  }

  // Radiografía de un par (A = SR/DPT, B = SRP/TdPa) SIN comodín: el servidor
  // devuelve las filas con el comodín ya sumado, aquí se le resta para ver
  // las cifras crudas. El paloteo es el de la pantalla (en vivo); el aplicado
  // es el último guardado en Movimiento. Una sustitución solo MUEVE dosis de
  // un lado a otro y nunca cambia el total del par.
  function analisisPar(d) {
    const filas = _conciliacionCache || [];
    const buscar = (clave) => filas.find((f) => (f.claves || []).length === 1 && f.claves[0] === clave);
    const fa = buscar(d.claves[0]);
    const fb = buscar(d.claves[1]);
    const vivoA = paloteoVivo(d.sisA);
    const vivoB = paloteoVivo(d.sisB);
    const pA = vivoA !== null ? vivoA : _num2(fa ? Number(fa.paloteo) - Number(fa.ajuste_paloteo || 0) : 0);
    const pB = vivoB !== null ? vivoB : _num2(fb ? Number(fb.paloteo) - Number(fb.ajuste_paloteo || 0) : 0);
    const aA = _num2(fa ? Number(fa.aplicado) - Number(fa.ajuste_aplicado || 0) : 0);
    const aB = _num2(fb ? Number(fb.aplicado) - Number(fb.ajuste_aplicado || 0) : 0);
    return {
      pA, aA, pB, aB,
      exceso: _num2(pA - aA),     // paloteo de A de más (negativo: de menos)
      faltante: _num2(aB - pB),   // paloteo de B de menos (negativo: de más)
      difTotal: _num2((pA + pB) - (aA + aB)),
      limiteFwd: Math.max(0, Math.min(pA, aB)),  // B aplicada y reportada como A
      limiteRev: Math.max(0, Math.min(pB, aA))   // A aplicada y reportada como B
    };
  }

  // Diagnóstico en palabras de un par, a partir de las cifras crudas y del
  // comodín tecleado/guardado aj = { fwd, rev }. Lo usan el panel del paloteo
  // y el aviso por biológico en Movimiento (mismo texto en los dos). Las
  // dosis DESECHADAS no cuentan como aplicadas, así que un caso híbrido --
  // 8 SR reales + 10 SRP reportadas como SR: paloteo SR 18 / SRP 10;
  // Movimiento SR 8 (+2 desechadas) / SRP 20 -- da exceso 10 = faltante 10 y
  // el comodín correcto es 10 (SRP reportadas como SR). Sentido contrario
  // (SR aplicada y reportada como SRP): exceso y faltante salen NEGATIVOS e
  // iguales.
  // Devuelve { texto, color, sug: {dir:'fwd'|'rev', n, parcial} | null, cuadra }.
  function diagnosticoPar(d, x, aj) {
    const fwd = _num2(aj && aj.fwd); const rev = _num2(aj && aj.rev);
    const par = `${d.a} + ${d.b}`;
    const nombre = (dir) => (dir === 'fwd' ? `${d.b} aplicadas y reportadas como ${d.a}` : `${d.a} aplicadas y reportadas como ${d.b}`);
    const resA = _num2((x.pA + rev) - (x.aA + fwd));
    const resB = _num2((x.pB + fwd) - (x.aB + rev));
    const hayTeclado = fwd > 0 || rev > 0;

    let sug = null;
    if (x.exceso !== 0 && x.exceso === x.faltante) sug = { dir: x.exceso > 0 ? 'fwd' : 'rev', n: Math.abs(x.exceso), parcial: false };
    else if (x.exceso > 0 && x.faltante > 0) sug = { dir: 'fwd', n: Math.min(x.exceso, x.faltante), parcial: true };
    else if (x.exceso < 0 && x.faltante < 0) sug = { dir: 'rev', n: Math.min(-x.exceso, -x.faltante), parcial: true };

    const nota = ' (las desechadas no cuentan como aplicadas)';
    const noEsSustitucion = `${par} sumados difieren en ${Math.abs(x.difTotal)} dosis (paloteo ${_num2(x.pA + x.pB)} vs Movimiento ${_num2(x.aA + x.aB)}). Una sustitución solo pasa dosis de una vacuna a la otra y no cambia el total: eso es un error de captura, corrige el paloteo o las "aplicadas" del Movimiento${nota}.`;
    let texto = ''; let color = 'var(--warning)'; let cuadra = false;
    if (fwd > x.limiteFwd) {
      color = 'var(--error, #b3261e)';
      texto = `El comodín de ${nombre('fwd')} (${fwd}) NO se aplicaría: es mayor a lo capturado (máximo ${x.limiteFwd}).`;
    } else if (rev > x.limiteRev) {
      color = 'var(--error, #b3261e)';
      texto = `El comodín de ${nombre('rev')} (${rev}) NO se aplicaría: es mayor a lo capturado (máximo ${x.limiteRev}).`;
    } else if (fwd > 0 && rev > 0) {
      texto = 'Capturaste comodín en los dos sentidos. Normalmente solo aplica uno: revisa cuál de las dos sustituciones fue la real.';
    } else if (hayTeclado && resA === 0 && resB === 0) {
      color = 'var(--success)'; cuadra = true;
      texto = `Cuadra: ${fwd > 0 ? `${fwd} dosis de ${nombre('fwd')}` : `${rev} dosis de ${nombre('rev')}`}.`;
    } else if (hayTeclado) {
      texto = `Con ese comodín todavía quedan diferencias (${d.a}: ${resA > 0 ? '+' : ''}${resA}, ${d.b}: ${resB > 0 ? '+' : ''}${resB}). ${x.difTotal !== 0 ? noEsSustitucion : (sug ? `La cantidad que sí lo explica es ${sug.n}.` : '')}`;
    } else if (sug && !sug.parcial) {
      texto = `La diferencia se explica por sustitución: ${sug.n} dosis de ${nombre(sug.dir)}.`;
    } else if (sug) {
      texto = `Solo una parte es sustitución (hasta ${sug.n} dosis de ${nombre(sug.dir)}). ${noEsSustitucion}`;
    } else if (x.difTotal !== 0) {
      texto = noEsSustitucion;
    }
    return { texto, color, sug, cuadra };
  }

  let _comodinSoloLectura = false;
  let _comodinReport = null;

  function htmlAjustes(soloLectura, currentReport) {
    _comodinSoloLectura = soloLectura;
    _comodinReport = currentReport || null;
    const ajustes = (currentReport && currentReport.ajustes) || {};
    const campo = (key, etiqueta) => `
      <label style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; font-size:11.5px; font-weight:600; padding:3px 0;">
        <span>${etiqueta}</span>
        <input type="number" min="0" step="1" id="sisb_ajuste_${key}" ${soloLectura ? 'disabled' : ''}
          value="${_num2(ajustes[key]) > 0 ? _num2(ajustes[key]) : ''}" placeholder="0"
          style="width:88px; text-align:center; font-weight:800; font-size:13px; border:1.5px solid #cbd5e1; border-radius:9px; padding:6px 8px; ${soloLectura ? 'background:#f1f5f9;' : ''}">
      </label>`;
    const bloques = AJUSTES_DEF.map((d) => `
      <div data-comodin-par="${d.idx}" style="padding:8px 0; border-top:1px solid rgba(0,0,0,.06);">
        <div style="font-size:11.5px; font-weight:800;">${d.a} / ${d.b}</div>
        <div data-comodin-diag="${d.idx}" style="margin:2px 0 6px;"></div>
        ${campo(d.keyFwd, `Dosis de ${d.b} aplicadas y reportadas en el paloteo como ${d.a}`)}
        ${campo(d.keyRev, `Dosis de ${d.a} aplicadas y reportadas en el paloteo como ${d.b}`)}
      </div>`).join('');
    return `
      <details id="sisbComodin" open style="margin-top:10px; background:rgba(255,255,255,.65); border:1px solid rgba(0,0,0,.08); border-radius:10px;">
        <summary style="cursor:pointer; padding:8px 12px; font-size:11.5px; font-weight:800;">Ajuste por sustitución (comodín)</summary>
        <div style="padding:2px 12px 8px;">
          <div style="font-size:11px; font-weight:500; opacity:.85; margin-bottom:4px;">Si se aplicó una vacuna y en el paloteo se reportó como otra (SRP por SR, TdPa por DPT o al revés), el Movimiento la da de baja como la que realmente se usó. El aviso se actualiza en vivo con lo que tecleas en el paloteo; el comodín solo se guarda con el botón Guardar.</div>
          ${bloques}
        </div>
      </details>`;
  }

  // Repinta los avisos del comodín con el estado VIVO (paloteo tecleado +
  // comodín tecleado + aplicado guardado). No toca los inputs, así no se
  // pierde el foco mientras se escribe.
  function actualizarComodin() {
    const cont = document.getElementById('sisbComodin');
    if (!cont) return;
    let algunoVisible = false;
    AJUSTES_DEF.forEach((d) => {
      const bloque = cont.querySelector(`[data-comodin-par="${d.idx}"]`);
      const diag = cont.querySelector(`[data-comodin-diag="${d.idx}"]`);
      if (!bloque || !diag) return;
      const x = analisisPar(d);
      const aj = { fwd: ajusteVivo(d.keyFwd, _comodinReport), rev: ajusteVivo(d.keyRev, _comodinReport) };
      const hayDif = x.exceso !== 0 || x.faltante !== 0;
      const visible = hayDif || aj.fwd > 0 || aj.rev > 0;
      bloque.style.display = visible ? '' : 'none';
      if (!visible) { diag.innerHTML = ''; return; }
      algunoVisible = true;
      const dg = diagnosticoPar(d, x, aj);
      const tecleado = dg.sug && (dg.sug.dir === 'fwd' ? aj.fwd : aj.rev) === dg.sug.n;
      const btn = (!_comodinSoloLectura && dg.sug && !tecleado)
        ? ` <button type="button" class="btn-mini btn-secundario" data-comodin-usar="${dg.sug.dir === 'fwd' ? d.keyFwd : d.keyRev}" data-opuesto="${dg.sug.dir === 'fwd' ? d.keyRev : d.keyFwd}" data-valor="${dg.sug.n}"><span class="material-symbols-rounded">auto_fix_high</span> Usar ${dg.sug.n}</button>` : '';
      diag.innerHTML = `
        <div style="font-size:10.5px; font-weight:500; opacity:.8;">${d.a}: paloteo ${x.pA} / Movimiento ${x.aA} · ${d.b}: paloteo ${x.pB} / Movimiento ${x.aB}</div>
        <div style="font-size:11px; font-weight:700; color:${dg.color}; margin-top:2px;">${dg.texto}${btn}</div>`;
    });
    cont.style.display = algunoVisible ? '' : 'none';
  }

  let _comodinRaf = 0;
  function programarComodin() {
    if (_comodinRaf) return;
    _comodinRaf = requestAnimationFrame(() => { _comodinRaf = 0; actualizarComodin(); });
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target && ev.target.closest ? ev.target.closest('[data-comodin-usar]') : null;
    if (!btn) return;
    const input = document.getElementById(`sisb_ajuste_${btn.getAttribute('data-comodin-usar')}`);
    if (!input) return;
    const opuesto = document.getElementById(`sisb_ajuste_${btn.getAttribute('data-opuesto')}`);
    if (opuesto) opuesto.value = '';
    input.value = btn.getAttribute('data-valor');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Comodín capturado: presiona Guardar para aplicarlo.', 'ok');
  });
  // Cualquier cambio del paloteo o del comodín repinta el aviso en vivo.
  document.addEventListener('input', (ev) => {
    const id = ev.target && ev.target.id;
    if (id && id.indexOf('sisb_') === 0) programarComodin();
  });

  function renderConciliacion(soloLectura, currentReport) {
    renderConciliacionBase(soloLectura, currentReport);
    actualizarComodin();
  }

  function renderConciliacionBase(soloLectura, currentReport) {
    renderConciliacionBase0(soloLectura, currentReport);
    const cont = document.getElementById('sis06pConciliacion');
    if (cont && currentReport && currentReport.excepcion_conciliacion) {
      cont.style.display = 'block';
      cont.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:8px; padding:8px 12px; border-radius:10px; background:#eef2ff; color:#3730a3; font-size:11.5px; font-weight:700;">
        <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">gavel</span>
        Validado con excepción de conciliación${currentReport.excepcion_por ? ' (' + _esc(currentReport.excepcion_por) + ')' : ''}: ${_esc(currentReport.excepcion_conciliacion)}</div>`);
    }
  }

  function renderConciliacionBase0(soloLectura, currentReport) {
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
    cont.style.cssText = 'display:block; margin-bottom:14px; padding:14px 16px; border-radius:12px; font-size:13px; font-weight:700; background:#fef2f2; color:#991b1b; border:2px solid #f87171; box-shadow:0 2px 10px rgba(220,38,38,.15);';
    cont.innerHTML = `
      <div style="font-size:14px; font-weight:800;"><span class="material-symbols-rounded" style="font-size:20px; vertical-align:middle;">error</span>
        ${dif.length} biológico(s) NO coinciden entre el paloteo SIS-06-P y el Movimiento de Biológico.
        ${esUnidad ? 'No podrás enviar el SIS hasta que las dosis aplicadas sean iguales -- corrige el paloteo aquí o las "aplicadas" por lote en Movimiento de Biológico.' : 'No se puede validar hasta que coincidan -- corrige el lado que esté mal (modo revisión).'}
      </div>
      ${tabla(dif)}
      ${htmlAjustes(soloLectura, currentReport)}`;
  }

  // Solo lectura según quién mira y en qué momento: la unidad solo captura
  // mientras el mes está en borrador Y dentro de la ventana de prellenado/envío
  // (el servidor lo exige igual); los revisores solo editan un SIS ya enviado.
  function fueraDeVentanaDeCaptura(captura) {
    const est = captura ? captura.estado : 'BORRADOR';
    return Boolean(esUnidadSesion() && est === 'BORRADOR' && _ventanaCache && _ventanaCache.dentro_prellenado === false);
  }
  function soloLecturaPara(captura) {
    const est = captura ? captura.estado : 'BORRADOR';
    if (esUnidadSesion()) return est !== 'BORRADOR' || fueraDeVentanaDeCaptura(captura);
    return !captura || est === 'BORRADOR';
  }
  function fechaHoyIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderBannerVentana(estadoActual) {
    const banner = document.getElementById('sis06pBannerVentana');
    if (!banner) return;
    if (!_ventanaCache || estado.perfil.rol !== 'UNIDAD' || estadoActual !== 'BORRADOR') {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    if (_ventanaCache.dentro_prellenado === false) {
      const aun = fechaHoyIso() < String(_ventanaCache.inicio_prellenado).slice(0, 10);
      banner.style.cssText += 'background:#f1f5f9; color:#475569;';
      banner.innerHTML = aun
        ? `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">lock_clock</span> Este mes todavía no se abre para captura: podrás llenarlo desde el <strong>${fechaLargaMX(_ventanaCache.inicio_prellenado)}</strong> y enviarlo del ${fechaLargaMX(_ventanaCache.inicio_envio)} al ${fechaLargaMX(_ventanaCache.fin_envio)}.`
        : `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">lock_clock</span> La captura de este mes cerró el <strong>${fechaLargaMX(_ventanaCache.fin_envio)}</strong>. Si no alcanzaste a enviarlo, pide al administrador que habilite el mes.`;
      return;
    }
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
    // Las otras dos hojas del SINBA-SIS (solo lectura) y el responsable se
    // derivan de las mismas cachés -- se refrescan siempre que esta se repinta.
    renderCEH();
    renderInfluenza();
    aplicarResponsable();
    renderRutaMes();
    actualizarDock();

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    const currentValores = currentReport ? (currentReport.valores || {}) : {};
    const estadoActual = currentReport ? currentReport.estado : 'BORRADOR';

    const esUnidad = estado.perfil.rol === 'UNIDAD';
    const fueraDeVentana = fueraDeVentanaDeCaptura(currentReport);
    const soloLectura = soloLecturaPara(currentReport);

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
        ? 'Exportar el Excel oficial del SINBA-SIS (SIS-06-P, Movimiento de Biológico, SIS-SS-CE-H e Influenza)'
        : 'Disponible hasta que el municipal valide el SINBA-SIS de este mes';
    }

    if (esUnidad) {
      if (btnGuardar) btnGuardar.style.display = (estadoActual === 'BORRADOR' && !fueraDeVentana) ? 'inline-flex' : 'none';
      if (btnEnviar) {
        btnEnviar.style.display = estadoActual === 'BORRADOR' ? 'inline-flex' : 'none';
        const fueraDeEnvio = !(_ventanaCache && _ventanaCache.dentro_envio);
        const noConcilia = hayDiferenciasConciliacion();
        btnEnviar.disabled = fueraDeEnvio;
        btnEnviar.classList.toggle('con-diferencias', !fueraDeEnvio && noConcilia);
        btnEnviar.title = fueraDeEnvio
          ? 'Fuera de la ventana de envío'
          : noConcilia ? 'El paloteo SIS-06-P y el Movimiento de Biológico no coinciden -- púlsalo para ver en qué' : '';
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
            <span class="sis-card-count" style="background:${capturadas > 0 ? accent.tint : '#f1f5f9'}; color:${capturadas > 0 ? accent.hex : '#526071'};">${capturadas}/${vars.length}</span>
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
            value="${val !== undefined && val !== null && Number(val) !== 0 ? val : ''}" placeholder="0">`;
        const mkSub = (kind, val) => `
          <input type="number" min="0" step="1" id="sisb_${v.fila_excel}_${kind}" data-fila="${v.fila_excel}" data-kind="${kind}" ${dis}
            style="width:66px; max-width:100%; text-align:center; font-weight:500; font-size:11px; color:#94a3b8;
              background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:5px 6px; outline:none;"
            value="${val !== undefined && val !== null && Number(val) !== 0 ? val : ''}" placeholder="0">`;

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

    draftAplicar(currentReport, soloLectura);
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
        responsable_elaboracion: responsableElaboracion() || '',
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
    if (fueraDeVentanaDeCaptura(currentReport)) {
      toast('Este mes está fuera de su ventana de captura: ya no se puede guardar. Pide al administrador que lo habilite.', 'error');
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      draftEscribirYa();
      _ultimoGuardadoFallo = true;
      toast('Sin conexión: tu avance quedó protegido en este dispositivo y se guardará solo cuando regrese el internet.', 'error');
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
      AJUSTE_KEYS.forEach((k) => {
        const v = parseFloat(document.getElementById(`sisb_ajuste_${k}`)?.value);
        if (Number.isFinite(v) && v > 0) ajustes[k] = v;
      });

      const record = {
        clues,
        unidad: activa.unidad,
        municipio: activa.municipio,
        mes, anio, valores, ajustes,
        // "Responsable de la información": la unidad lo elige en el
        // encabezado (puede no ser quien tiene la sesión); un revisor que
        // corrige no lo cambia. La auditoría real va en ultimo_editor_usuario
        // + historial_ediciones (siempre la sesión).
        capturado_por: esUnidad ? responsableElaboracion() : (currentReport ? currentReport.capturado_por : nombreActor),
        historial_ediciones: hist,
        ultimo_editor_usuario: nombreActor,
        updated_at: new Date().toISOString()
      };

      const { error } = await estado.db.from('sis06p_capturas').upsert(record, { onConflict: 'clues,mes,anio' });
      if (error) throw error;

      // Ya está en el servidor: el respaldo local deja de hacer falta.
      draftBorrar();
      _ultimoGuardadoFallo = false;

      const totalReportado = Object.values(valores).reduce((s, v) => s + Number(v.total || 0), 0);
      try {
        const { data: capturas, error: errRel } = await estado.db.from('sis06p_capturas').select('*').eq('clues', clues);
        if (errRel) throw errRel;
        _sis06pCapturasCache = capturas || [];
        await cargarConciliacion(clues);
        render();
        if (esUnidad) await autoCrearMovimientoSiFalta(clues, mes, anio, totalReportado);
      } catch (errRefresco) {
        console.warn('[SIS-06-P] Se guardó, pero no se pudo refrescar la pantalla:', errRefresco);
        marcarSinGuardar(false);
        toast('Se guardó, pero no se pudo actualizar la pantalla. Recarga la página para verlo.', 'ok');
        return true;
      }
      toast(`✅ ${esUnidad ? 'Concentrado' : 'Corrección'} guardado · ${totalReportado} dosis en ${Object.keys(valores).length} variables.`, 'ok');
      if (!esUnidad) document.dispatchEvent(new CustomEvent('sis06p:corregido', { detail: { clues, mes, anio, origen: 'sis06p' } }));
      return true;
    } catch (err) {
      console.error('[SIS-06-P] Error al guardar:', err);
      draftEscribirYa();
      _ultimoGuardadoFallo = esErrorDeRedSIS(err);
      toast(_ultimoGuardadoFallo
        ? 'No se pudo guardar por la conexión. Tu avance quedó protegido en este dispositivo: se reintentará solo al volver el internet, o toca Guardar.'
        : 'Error al guardar: ' + err.message + ' (tu avance sigue protegido en este dispositivo).', 'error');
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

    // Con diferencias el servidor no deja enviar: se explica aquí, con la lista, en vez de un aviso que se pierde.
    try { await cargarConciliacion(activa.clues); } catch (_) { /* si falla, el servidor decide */ }
    if (hayDiferenciasConciliacion()) {
      const dif = _conciliacionCache.filter((f) => !f.coincide);
      renderAlertaDiferencias();
      await mostrarModal({
        titulo: 'Tu SINBA-SIS NO se envió',
        mensaje: 'El paloteo SIS-06-P y el Movimiento de Biológico no coinciden, y mientras no cuadren el sistema no lo envía: el municipal no recibe nada. Corrige el lado que esté mal (el paloteo o las "aplicadas" del Movimiento) y vuelve a enviar.',
        detalleHtml: `<div class="sis-dif-lista" style="flex-direction:column; align-items:stretch;">${listaDiferenciasHtml(dif)}</div>`,
        textoAceptar: 'Entendido, voy a corregir', sinCancelar: true
      });
      return;
    }

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

  // Parte común de una validación exitosa (normal o con excepción).
  async function finalizarValidacion(activa, mes, anio) {
    const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
    _sis06pCapturasCache = capturas || [];
    await cargarConciliacion(activa.clues);
    render();
    toast('✅ Concentrado marcado como validado.', 'ok');
    notificarUnidadValidacion(activa, mes, anio);
    document.dispatchEvent(new CustomEvent('sis06p:validado', { detail: { clues: activa.clues, mes, anio } }));
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
      await finalizarValidacion(activa, mes, anio);
    } catch (err) {
      console.error('[SIS-06-P] Error al validar:', err);
      try { await cargarConciliacion(activa.clues); render(); } catch (_) { /* no-op */ }
      const rolExcepcion = estado.perfil.rol === 'ADMIN' || estado.perfil.rol === 'JURISDICCIONAL';
      if (rolExcepcion && /no coinciden/i.test(err.message || '')) {
        // La diferencia entre paloteo y Movimiento bloquea la validación. La
        // jurisdicción / administración puede autorizar una excepción, con motivo
        // y auditada, para el caso legítimo en que no tienen por qué cuadrar.
        ocultarCargando();
        const resumen = String(err.message || '').replace(/^No se puede validar:\s*/i, '').slice(0, 320);
        const motivo = await mostrarModal({
          titulo: 'Validar con excepción',
          mensaje: 'El paloteo y el Movimiento no coinciden (' + resumen + '). Si la diferencia es legítima, escribe el motivo: queda en la auditoría, la unidad lo verá y se podrá validar y publicar.',
          pedirMotivo: true, placeholderMotivo: 'Ej. Se aplicó SRP por falta de SR; autorizado por la jurisdicción', textoAceptar: 'Validar con excepción', peligro: true
        });
        if (motivo) {
          mostrarCargando('Validando con excepción...');
          try {
            const { error: errEx } = await estado.db.rpc('sis06p_validar_con_excepcion', {
              p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil), p_justificacion: motivo
            });
            if (errEx) throw errEx;
            await finalizarValidacion(activa, mes, anio);
          } catch (errEx2) {
            console.error('[SIS-06-P] Error al validar con excepción:', errEx2);
            toast('No se pudo validar con excepción: ' + (errEx2.message || errEx2), 'error');
          }
        }
        return;
      }
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
  // Pestaña CSV (SOLO MUNICIPAL -- la unidad no tiene CSV: su entregable es
  // el SINBA-SIS completo, y el CSV solo existe concentrado a nivel municipal):
  // mismas filas (CLUES, MUNICIPIO, VARIABLE_SIS, MES, ANIO, VALOR) que ya
  // acepta el panel RDA. El listado es el municipio COMPLETO -- todas sus
  // CLUES reales, una fila por variable por cada una, con VALOR=0 para las
  // que todavía no capturan nada -- y se va "llenando sola" porque se
  // consulta en vivo cada vez que se abre esta pestaña o cambia mes/año,
  // nunca desde una caché de una sola unidad: el municipio necesita ver el
  // concentrado completo para poder armar lo que se sube al departamento de
  // estadística.
  // ---------------------------------------------------------------------------

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

    // Influenza se pide SOLO del mes (por rango de fecha en el servidor): traer toda la campaña de todas las
    // unidades rebasa el tope de 1000 filas de PostgREST y recortaba datos en silencio.
    const iniMes = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const sigAnio = Number(mes) === 12 ? Number(anio) + 1 : Number(anio);
    const sigMes = Number(mes) === 12 ? 1 : Number(mes) + 1;
    const finMes = `${sigAnio}-${String(sigMes).padStart(2, '0')}-01`;
    const [{ data: capturas, error: eC }, { data: capturasInf, error: eI }] = await Promise.all([
      estado.db.from('sis06p_capturas').select('clues, valores').in('clues', cluesList).eq('mes', mes).eq('anio', anio),
      estado.db.from('influenza_capturas').select('clues, fecha, valores').in('clues', cluesList).gte('fecha', iniMes).lt('fecha', finMes)
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
        // Mismas filas que sis_filas_csv / la publicación a registros_sis: las claves de afro/indígena/migrante
        // salen siempre (aun en 0), igual que la rejilla histórica.
        const afro = Number(val.afro || 0);
        if (v.clave_afro) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_afro, MES: mes, ANIO: anio, VALOR: afro });
        const indigena = Number(val.indigena || 0);
        if (v.clave_indigena) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_indigena, MES: mes, ANIO: anio, VALOR: indigena });
        const migrante = Number(val.migrante || 0);
        if (v.clave_migrante) rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: v.clave_migrante, MES: mes, ANIO: anio, VALOR: migrante });
      });

      // La consulta ya trae solo las semanas cuyo viernes cae en este mes.
      const infEnMes = infPorClues.get(u.clues) || [];
      const sumas = {};
      infEnMes.forEach((c) => {
        Object.entries(c.valores || {}).forEach(([rubro, val]) => { sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0); });
      });
      Object.entries(INFLUENZA_SIS_MAPPING).forEach(([rubro, clave]) => {
        rows.push({ CLUES: u.clues, MUNICIPIO: municipio, VARIABLE_SIS: clave, MES: mes, ANIO: anio, VALOR: sumas[rubro] || 0 });
      });
    });

    // Ordenado por CLUES ascendente -- sort de JS es estable, así que dentro
    // de cada CLUES las filas conservan el orden del catálogo.
    rows.sort((a, b) => String(a.CLUES).localeCompare(String(b.CLUES)));
    return rows;
  }

  async function filasCSVSegunRol() {
    const activa = datosUnidadActiva();
    if (!activa) return [];
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    return buildCSVRowsMunicipioCompleto(activa.municipio, mes, anio);
  }

  async function renderCSVPreview() {
    const tbody = document.getElementById('csvUnidadTbody');
    if (!tbody) return;

    const titulo = document.getElementById('csvPanelTitulo');
    const subtitulo = document.getElementById('csvPanelSubtitulo');
    if (titulo && subtitulo) {
      titulo.textContent = 'CSV -- concentrado completo del municipio';
      subtitulo.textContent = 'Todas las CLUES del municipio, una fila por clave SIS -- se va llenando conforme cada unidad captura (0 mientras no ha capturado).';
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
      tbody.innerHTML = '<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">No hay unidades activas en este municipio.</td></tr>';
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

  // La vista previa de arriba incluye borradores (se va llenando); la DESCARGA sale del servidor y solo
  // cuando TODAS las unidades del municipio están validadas -- el mismo origen que la publicación a
  // registros_sis, para que un CSV a medias nunca se suba por error.
  async function downloadCSV() {
    const activa = datosUnidadActiva();
    if (!activa) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    // Mismo CSV, mismo formato y mismo origen que "Descargar CSV oficial" de Seguimiento (sis_csv.js)
    if (window.SIS06PDashboard && window.SIS06PDashboard.exportarCSVOficialMunicipio) {
      await window.SIS06PDashboard.exportarCSVOficialMunicipio(activa.municipio, mes, anio);
    }
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
    // Lo mismo en el encabezado del Reverso (misma posición relativa: fila
    // "Reverso" + 6), que si no se imprime como "1905".
    let filaReverso = 0;
    wsMov.eachRow({ includeEmpty: false }, (row, n) => {
      if (!filaReverso && String(wsMov.getCell(n, 1).value || '').trim() === 'Reverso') filaReverso = n;
    });
    if (filaReverso) {
      wsMov.getCell(filaReverso + 6, 9).value = fechaCorte;
      wsMov.getCell(filaReverso + 6, 10).value = fechaCorte;
    }
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
  // La plantilla oficial trae escrita la temporada 2025-2026 (A4 y A8 de
  // SIS-SS-IE Mensual). La temporada arranca en septiembre: de septiembre en
  // adelante es año-año+1; de enero a agosto, año-1-año.
  function actualizarTemporadaInfluenza(wb, mes, anio) {
    const ws = wb.getWorksheet('SIS-SS-IE Mensual');
    if (!ws) return;
    const ini = mes >= 9 ? anio : anio - 1;
    ['A4', 'A8'].forEach((dir) => {
      const cell = ws.getCell(dir);
      if (typeof cell.value !== 'string') return;
      cell.value = cell.value
        .replace(/2025-2026/g, `${ini}-${ini + 1}`)
        .replace(/2025 - 2026/g, `${ini} - ${ini + 1}`);
    });
  }

  const FILA_INFLUENZA_INICIO = 11;
  const COL_SEMANA_INICIO = 8; // H

  function llenarInfluenzaOficial(wb, mes, anio, capturasInfluenza) {
    const ws = wb.getWorksheet('SIS-SS-IE Mensual');
    if (!ws) return false;

    const enMes = (capturasInfluenza || _influenzaCapturasCache || [])
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

  // ---------------------------------------------------------------------------
  // Configuración de impresión del libro oficial. La plantilla no fijaba el
  // tamaño de papel de SINBA-SIS-06-P ni de MOV-DE-BIOLÓGICO (caían en el
  // predeterminado de cada impresora) y las centraba verticalmente: como el
  // anverso y el reverso tienen distinta altura de contenido, el encabezado
  // del reverso se imprimía más abajo que el del anverso y a doble cara no
  // coincidían. Aquí se fija:
  //   - SINBA-SIS-06-P y MOV-DE-BIOLÓGICO: CARTA, SIN centrado vertical (cada
  //     cara arranca arriba, con el mismo margen y la misma escala, así los
  //     dos encabezados caen en la misma posición adelante y atrás) y un solo
  //     salto manual entre anverso y reverso. La escala es fija y calculada
  //     con la cara más alta (el ajuste "a 1 página" de Excel ignora los
  //     saltos manuales, por eso no se usa aquí).
  //   - SIS-SS-CE-H-2026 y SIS-SS-IE Mensual: OFICIO (Folio 8.5x13 in, código
  //     estándar 14), horizontal, ajustadas a 1 página. La plantilla traía
  //     paperSize=4636, un código propio del controlador de la impresora que
  //     no es un tamaño estándar y que se pierde al guardar (ExcelJS descarta
  //     el printerSettings .bin) -- en otra PC Excel no lo reconoce.
  // La impresión a doble cara no se guarda en el .xlsx: es un ajuste de la
  // impresora (SIS-06-P vertical: voltear por el borde largo; Movimiento
  // horizontal: voltear por el borde corto).
  // ---------------------------------------------------------------------------

  const PAPEL_CARTA = 1;
  const PAPEL_OFICIO = 14;

  function calcularEscalaDosCaras(ws, orientation, colFin, filaCorte, ultimaFila) {
    const m = ws.pageSetup.margins || { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2 };
    const [anchoPag, altoPag] = orientation === 'landscape' ? [792, 612] : [612, 792];
    const dispAncho = anchoPag - (m.left + m.right) * 72;
    const dispAlto = altoPag - (m.top + m.bottom) * 72;
    let ancho = 0;
    // Ancho real de columna en Excel: caracteres*7 px + 5 px de relleno por columna.
    // Sin esos 5 px la escala salía demasiado grande y la última columna
    // (Observaciones, en Movimiento) se pasaba a otra hoja al imprimir.
    for (let c = 1; c <= colFin; c++) ancho += ((ws.getColumn(c).width || 8.43) * 7 + 5) * 0.75;
    const alturaFilas = (desde, hasta) => {
      let h = 0;
      for (let r = desde; r <= hasta; r++) h += ws.getRow(r).height || ws.properties.defaultRowHeight || 15;
      return h;
    };
    const mayorCara = Math.max(alturaFilas(1, filaCorte), alturaFilas(filaCorte + 1, ultimaFila));
    // 3 % de holgura: el ancho real de columna en Excel/impresora varía un poco
    return Math.max(10, Math.floor(Math.min(dispAncho / ancho, dispAlto / mayorCara) * 100 * 0.97));
  }

  function configurarHojaDosCaras(ws, { orientation, colFin, filaCorte, ultimaFila }) {
    ws.rowBreaks.length = 0;
    ws.getRow(filaCorte).addPageBreak();
    Object.assign(ws.pageSetup, {
      paperSize: PAPEL_CARTA,
      orientation,
      fitToPage: false,
      scale: calcularEscalaDosCaras(ws, orientation, colFin, filaCorte, ultimaFila),
      horizontalCentered: true,
      verticalCentered: false,
      printArea: `A1:${ws.getColumn(colFin).letter}${ultimaFila}`
    });
  }

  function configurarImpresionOficial(wb) {
    const wsPaloteo = wb.getWorksheet('SINBA-SIS-06-P');
    if (wsPaloteo) {
      // Anverso = filas 1-67, reverso = 68-124 (con su propio encabezado)
      configurarHojaDosCaras(wsPaloteo, { orientation: 'portrait', colFin: 25, filaCorte: 67, ultimaFila: 124 });
    }

    const wsMov = wb.getWorksheet('MOV-DE-BIOLÓGICO');
    if (wsMov) {
      // El motor de Movimiento reconstruye los bloques: el reverso empieza
      // donde dice "Reverso" (columna A), no en una fila fija de la plantilla.
      let filaReverso = 0;
      let ultimaFila = 0;
      wsMov.eachRow({ includeEmpty: false }, (row, n) => {
        if (!row.hasValues) return;
        if (!filaReverso && String(wsMov.getCell(n, 1).value || '').trim() === 'Reverso') filaReverso = n;
        ultimaFila = n;
      });
      if (filaReverso > 1 && ultimaFila >= filaReverso) {
        configurarHojaDosCaras(wsMov, { orientation: 'landscape', colFin: 17, filaCorte: filaReverso - 1, ultimaFila });
      } else {
        Object.assign(wsMov.pageSetup, { paperSize: PAPEL_CARTA, orientation: 'landscape', verticalCentered: false });
      }
    }

    ['SIS-SS-CE-H-2026', 'SIS-SS-IE Mensual'].forEach((nombre) => {
      const ws = wb.getWorksheet(nombre);
      if (!ws) return;
      Object.assign(ws.pageSetup, { paperSize: PAPEL_OFICIO, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
    });
  }

  async function asegurarVariablesSIS() {
    if (_sisVariablesCache.length > 0) return;
    const { data: vars, error } = await estado.db.from('sis_variables').select('*').eq('activo', true).order('orden');
    if (error) throw error;
    _sisVariablesCache = vars || [];
  }

  // Arma el libro oficial de UNA unidad a partir de datos ya leídos (no toca
  // la pantalla): lo usan tanto la descarga individual como el ZIP municipal.
  async function construirWorkbookSISOficial({ plantillaBuffer, activa, captura, unidadBiovac, movimiento, mes, anio, capturasInfluenza }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantillaBuffer);

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

    // El encabezado del reverso (fila 74) viene en la plantilla solo con "MIGRANTES" en la
    // primera de las tres columnas, aunque los datos van en afro/indígena/migrante igual que
    // en el anverso: se rotulan las tres con el estilo de la celda original.
    const base74 = ws.getCell(74, COL_AFRO);
    [[COL_AFRO, 'AFRO\nAMERICANOS'], [COL_INDIGENA, 'INDÍGENAS'], [COL_MIGRANTE, 'MIGRANTES']].forEach(([col, texto]) => {
      const c = ws.getCell(74, col);
      if (col !== COL_AFRO) c.style = JSON.parse(JSON.stringify(base74.style));
      c.value = texto;
      c.alignment = Object.assign({}, c.alignment, { horizontal: 'center', vertical: 'middle', wrapText: true });
    });
    if ((ws.getRow(74).height || 0) < 24) ws.getRow(74).height = 24;

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
      influenzaIncluida = llenarInfluenzaOficial(wb, mes, anio, capturasInfluenza);
    } catch (errInf) {
      console.error('[SIS-06-P] No se pudo llenar SIS-SS-IE Mensual (Influenza) en el Excel:', errInf);
    }

    actualizarTemporadaInfluenza(wb, mes, anio);
    configurarImpresionOficial(wb);

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

    const buffer = await wb.xlsx.writeBuffer();
    return { buffer, movimientoIncluido, movimientoErrorMsg, influenzaIncluida };
  }

  function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function cargarPlantillaOficial() {
    const resp = await fetch('./Formatos/SINBA-VER_26_2026.xlsx');
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla oficial (SINBA-VER_26_2026.xlsx).');
    return resp.arrayBuffer();
  }

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

      const plantillaBuffer = await cargarPlantillaOficial();
      const { buffer, movimientoIncluido, movimientoErrorMsg, influenzaIncluida } = await construirWorkbookSISOficial({
        plantillaBuffer, activa, captura, unidadBiovac, movimiento, mes, anio, capturasInfluenza: _influenzaCapturasCache
      });

      descargarBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `SIS_${activa.clues}_${mes}_${anio}.xlsx`);

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

  // ---------------------------------------------------------------------------
  // ZIP masivo del municipio: un .xlsx oficial por unidad (el mismo libro que
  // descarga la propia unidad). Solo cuando TODAS las unidades del municipio
  // ya están Validadas -- igual que el CSV oficial y la publicación. `filas` =
  // renglones de Seguimiento (clues, unidad, estado) de ese municipio/mes.
  // ---------------------------------------------------------------------------

  async function exportarZipMunicipio(filas, municipio, mes, anio) {
    if (typeof JSZip === 'undefined') { toast('No se cargó la librería de ZIP. Recarga la página e intenta de nuevo.', 'error'); return; }
    const unidades = (filas || []).slice().sort((a, b) => String(a.clues).localeCompare(String(b.clues)));
    if (unidades.length === 0) { toast('Este municipio no tiene unidades para exportar.', 'error'); return; }
    if (!unidades.every((f) => f.estado === 'VALIDADO')) {
      toast('Faltan unidades por validar: el ZIP solo se puede generar con todas validadas.', 'error');
      return;
    }

    mostrarCargando('Preparando ZIP del municipio...');
    try {
      await asegurarVariablesSIS();
      const lista = unidades.map((f) => f.clues);
      const [{ data: capturas, error: e1 }, { data: influenza, error: e2 }] = await Promise.all([
        estado.db.from('sis06p_capturas').select('*').in('clues', lista).eq('mes', mes).eq('anio', anio),
        estado.db.from('influenza_capturas').select('clues, fecha, valores, sin_movimiento, capturado_por').in('clues', lista)
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const catalogoUnidades = (estado.unidadesClues || []).concat(estado.unidades || []);
      const unidadBiovacDe = (clues) => catalogoUnidades.find((u) => u.clues === clues) || null;
      const idsBiovac = unidades.map((f) => unidadBiovacDe(f.clues)).filter(Boolean).map((u) => u.id);
      let movimientos = [];
      if (idsBiovac.length) {
        const { data: movs, error: e3 } = await estado.db.from('biovac_movimientos')
          .select('*').in('unidad_id', idsBiovac).eq('anio', anio).eq('mes', mes);
        if (e3) throw e3;
        movimientos = movs || [];
      }

      const plantillaBuffer = await cargarPlantillaOficial();
      const zip = new JSZip();
      const mm = String(mes).padStart(2, '0');
      const fallos = [];
      let sinMovimiento = 0;

      for (let i = 0; i < unidades.length; i++) {
        const f = unidades[i];
        mostrarCargando(`Generando Excel ${i + 1} de ${unidades.length}: ${f.unidad || f.clues}...`);
        const captura = (capturas || []).find((c) => c.clues === f.clues);
        if (!captura || captura.estado !== 'VALIDADO') { fallos.push(`${f.clues} (sin captura validada)`); continue; }
        try {
          const unidadBiovac = unidadBiovacDe(f.clues);
          const movimiento = unidadBiovac ? (movimientos.find((m) => m.unidad_id === unidadBiovac.id) || null) : null;
          const res = await construirWorkbookSISOficial({
            plantillaBuffer,
            activa: { clues: f.clues, unidad: f.unidad, municipio: f.municipio || municipio },
            captura, unidadBiovac, movimiento, mes, anio,
            capturasInfluenza: (influenza || []).filter((c) => c.clues === f.clues)
          });
          if (!res.movimientoIncluido) sinMovimiento++;
          const nombreSeguro = String(f.unidad || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
          zip.file(`SIS_${f.clues}${nombreSeguro ? '_' + nombreSeguro : ''}_${mm}_${anio}.xlsx`, res.buffer);
        } catch (errUnidad) {
          console.error('[SIS-06-P] Error generando el Excel de', f.clues, errUnidad);
          fallos.push(`${f.clues} (${errUnidad.message})`);
        }
      }

      const hechos = unidades.length - fallos.length;
      if (hechos === 0) throw new Error('No se pudo generar ningún Excel.');

      mostrarCargando('Comprimiendo ZIP...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      descargarBlob(blob, `SIS_${municipio}_${mm}_${anio}.zip`);

      if (fallos.length) {
        toast(`ZIP generado con ${hechos} de ${unidades.length} unidades. No se incluyeron: ${fallos.join('; ')}`, 'error');
      } else if (sinMovimiento) {
        toast(`✅ ZIP generado con ${hechos} unidades (${sinMovimiento} sin Movimiento de Biológico capturado).`, 'ok');
      } else {
        toast(`✅ ZIP generado con los ${hechos} Excel de las unidades.`, 'ok');
      }
    } catch (err) {
      console.error('[SIS-06-P] Error al generar el ZIP municipal:', err);
      toast('Error al generar el ZIP: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  // ---------------------------------------------------------------------------
  // Responsable de la información (solo rol UNIDAD). Un solo nombre para las 4
  // hojas del SINBA-SIS; se puede editar en el encabezado. Se guarda en
  // sis06p_capturas.capturado_por y biovac_movimientos.responsable_elaboracion
  // (de ahí lo leen el Excel oficial y las cabeceras). No toca la auditoría:
  // quién guardó/envió/corrigió sigue saliendo de la sesión real.
  // ---------------------------------------------------------------------------

  let _responsableManual = false;
  function marcarResponsableManual() { _responsableManual = true; }

  function esUnidadSesion() { return Boolean(estado.perfil && estado.perfil.rol === 'UNIDAD'); }

  function capturaDelMesActual() {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    return _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio) || null;
  }

  // Refleja en el campo lo YA guardado del mes elegido (SIS-06-P primero, luego
  // Movimiento); si todavía no hay nada guardado conserva lo que la persona
  // haya tecleado o, si no, el último nombre usado en esta unidad / la sesión.
  // Después del envío el nombre queda fijo (solo lectura), igual que el resto.
  function aplicarResponsable() {
    if (!esUnidadSesion()) return;
    const inp = document.getElementById('selUsuario');
    if (!inp) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = capturaDelMesActual();
    const mov = (estado.movimiento && Number(estado.movimiento.mes) === mes && Number(estado.movimiento.anio) === anio)
      ? estado.movimiento.responsable_elaboracion : null;
    const guardado = (captura && captura.capturado_por) || mov || null;

    const bloqueado = Boolean((captura && captura.estado !== 'BORRADOR') || fueraDeVentanaDeCaptura(captura));
    inp.readOnly = bloqueado;
    inp.title = bloqueado
      ? 'El SINBA-SIS ya fue enviado (o este mes está fuera de su ventana de captura): el responsable quedó fijo. Si hay que cambiarlo, pídelo al municipal.'
      : 'Nombre de quien elabora la información: sale como responsable en todas las hojas del SINBA-SIS. Puedes cambiarlo.';

    if (document.activeElement === inp && !bloqueado) return; // no pisar lo que se está tecleando
    if (guardado) { inp.value = guardado; return; }
    if (_responsableManual) return;
    let recordado = null;
    try { recordado = localStorage.getItem('sis_responsable_' + estado.perfil.clues); } catch (e) { /* sin storage */ }
    inp.value = recordado || nombreCompletoDePerfil(estado.perfil) || '';
  }

  async function guardarResponsable() {
    if (!esUnidadSesion()) return;
    const inp = document.getElementById('selUsuario');
    let nombre = inp.value.trim();
    if (!nombre) { nombre = nombreCompletoDePerfil(estado.perfil) || ''; inp.value = nombre; } // vacío no se guarda
    _responsableManual = true;
    try { localStorage.setItem('sis_responsable_' + estado.perfil.clues, nombre); } catch (e) { /* sin storage */ }

    const clues = estado.perfil.clues;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = capturaDelMesActual();
    if ((captura && captura.estado !== 'BORRADOR') || fueraDeVentanaDeCaptura(captura)) { aplicarResponsable(); return; }

    let guardadoAlgo = false;
    try {
      if (captura && captura.capturado_por !== nombre) {
        const { error } = await estado.db.from('sis06p_capturas').update({ capturado_por: nombre })
          .eq('id', captura.id).eq('estado', 'BORRADOR');
        if (error) throw error;
        captura.capturado_por = nombre;
        guardadoAlgo = true;
      }
      const unidadBiovac = (estado.unidades || []).find((u) => u.clues === clues);
      if (unidadBiovac) {
        const { data: filas, error } = await estado.db.from('biovac_movimientos').update({ responsable_elaboracion: nombre })
          .eq('unidad_id', unidadBiovac.id).eq('anio', anio).eq('mes', mes).eq('estado', 'BORRADOR').select('id');
        if (error) throw error;
        if (filas && filas.length) {
          guardadoAlgo = true;
          if (estado.movimiento && estado.movimiento.id === filas[0].id) estado.movimiento.responsable_elaboracion = nombre;
        }
      }
      if (guardadoAlgo) toast('Responsable actualizado en el SINBA-SIS de este mes.', 'ok');
    } catch (err) {
      console.error('[SINBA-SIS] No se pudo guardar el responsable:', err);
      toast('No se pudo guardar el responsable: ' + (err.message || err), 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Hojas derivadas del SINBA-SIS (solo lectura): SIS-SS-CE-H e Influenza.
  // ---------------------------------------------------------------------------

  const _esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _vacioSiCero = (n) => (Number(n) > 0 ? Number(n) : '');
  const MSG_SIN_UNIDAD = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Selecciona una unidad (CLUES) específica arriba para ver esta hoja.</div>';

  function etiquetaEstadoSIS(e) {
    return e === 'VALIDADO' ? 'Información validada' : e === 'ENVIADO' ? 'Enviado -- pendiente de validación' : 'Borrador';
  }

  function tarjetaDato(titulo, valor) {
    return `<div style="background:var(--surface-container); border-radius:12px; padding:9px 13px;">
      <div style="font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--muted);">${titulo}</div>
      <div style="font-size:13px; font-weight:700; color:var(--primary); margin-top:2px; word-break:break-word;">${valor ? _esc(valor) : '—'}</div>
    </div>`;
  }

  // Responsable que se muestra en las hojas: para la unidad, lo del campo
  // del encabezado (así se ve al instante lo que se acaba de teclear).
  function responsableParaMostrar(captura) {
    if (esUnidadSesion()) {
      const v = (document.getElementById('selUsuario') || {}).value;
      return (v && v.trim()) || (captura && captura.capturado_por) || '';
    }
    return (captura && captura.capturado_por) || '';
  }

  // Corte mensual de Influenza: suma, por rubro y por semana, los reportes de
  // Meta-Logro (influenza_capturas, un renglón por semana con fecha = viernes)
  // que caen en el mes calendario elegido. Se lee EN VIVO -- el SIS no guarda
  // una copia, así que no puede duplicar ni quedar desfasado. Mismo criterio
  // (orden por fecha, semanas 1-5 en columnas) que llenarInfluenzaOficial.
  function influenzaCorteDelMes(mes, anio) {
    const semanas = (_influenzaCapturasCache || [])
      .filter((c) => {
        if (!c.fecha) return false;
        const d = new Date(c.fecha + 'T12:00:00');
        return (d.getMonth() + 1) === mes && d.getFullYear() === anio;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porRubro = {};
    INFLUENZA_FILAS.forEach((f) => { porRubro[f.id] = [0, 0, 0, 0, 0]; });
    semanas.forEach((c, idx) => {
      const col = Math.min(idx, 4);
      INFLUENZA_FILAS.forEach((f) => { porRubro[f.id][col] += Number((c.valores || {})[f.id] || 0); });
    });
    return { semanas, porRubro };
  }

  const _sumaFila = (arr) => arr.reduce((s, n) => s + n, 0);

  function fechaCortaMX(fechaIso) {
    const d = new Date(fechaIso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // Filas Categoría > Grupo > edad de Influenza, con `celdas(f)` aportando las
  // columnas de valores. Comparte estructura entre CE-H (una columna) y la
  // hoja Influenza (TOTAL + 5 semanas). Con `soloCategoria` solo emite esa
  // categoría y sin su renglón de encabezado (la tarjeta ya lo lleva).
  function filasInfluenzaHtml(colSpanTotal, celdas, soloCategoria, colsOcultables) {
    // Las filas de encabezado (categoría/grupo) abarcan todas las columnas; las
    // que se ocultan en pantalla angosta (.inf-sem) van en una celda aparte,
    // para que al ocultarlas no queden columnas fantasma quitándole ancho a
    // "Variable".
    const extra = Number(colsOcultables) || 0;
    const spanVisible = colSpanTotal - extra;
    const relleno = extra ? `<td class="inf-sem" colspan="${extra}"></td>` : '';
    let html = '';
    let cat = null;
    let grp = null;
    INFLUENZA_FILAS.forEach((f) => {
      if (soloCategoria && f.categoria !== soloCategoria) return;
      if (f.categoria !== cat) {
        cat = f.categoria; grp = null;
        if (!soloCategoria) {
          html += `<tr><td colspan="${spanVisible}" style="padding:5px 10px; background:#fdf2ee; color:#C26750; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em;">${_esc(cat)}</td>${relleno}</tr>`;
        }
      }
      if (f.grupo !== grp) {
        grp = f.grupo;
        html += `<tr><td colspan="${spanVisible}" style="padding:4px 8px 1px; font-size:11px; font-weight:700; color:#334155; line-height:1.25;">${_esc(grp)}</td>${relleno}</tr>`;
      }
      html += `<tr class="fila-tocable" data-inf="${f.id}" tabindex="0" style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:4px 8px 4px 18px; font-size:11.5px; color:#475569;">${_esc(f.edad)}</td>
        <td style="padding:2px 4px; text-align:center;"><span style="display:inline-block;font-size:8.5px;font-weight:700;font-family:monospace;background:#f1f5f9;color:#64748b;padding:1px 5px;border-radius:5px;">${f.clave}</span></td>
        ${celdas(f)}
      </tr>`;
    });
    return html;
  }

  const _TH = 'padding:8px 8px; text-align:center; font-size:10px; text-transform:uppercase; color:var(--muted); font-weight:700;';
  const _TD_NUM = 'padding:3px 6px; text-align:center; font-weight:800; font-size:12px; color:var(--primary);';

  // Réplica de la hoja SIS-SS-CE-H-2026 (Sección III, Aplicación de
  // biológicos): Variable | Clave + Total de dosis | Clave + A Afromexicanos |
  // Clave + A Indígenas | Clave + A Migrantes. En el Excel oficial sus totales
  // son fórmulas sobre SIS-06-P (vacío si es 0) -- aquí igual, nada se captura.
  // Después de las claves de esa hoja van las de Influenza (SIS-SS-IE).
  // Estado de la vista SIS-SS-CE-H que sobrevive a los repintados: contenedores
  // abiertos (por llave) y el filtro "solo con captura".
  const _cehAbiertos = new Set();
  let _cehSoloConDatos = false;

  function renderCEH() {
    const cont = document.getElementById('cehContenido');
    if (!cont) return;
    const enc = document.getElementById('cehEncabezado');
    const aviso = document.getElementById('cehAviso');
    const badge = document.getElementById('cehBadgeEstado');
    const activa = datosUnidadActiva();
    if (!activa) {
      if (enc) enc.innerHTML = '';
      if (aviso) aviso.style.display = 'none';
      if (badge) badge.textContent = '';
      cont.innerHTML = MSG_SIN_UNIDAD;
      return;
    }
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = capturaDelMesActual();
    const valores = captura ? (captura.valores || {}) : {};

    if (badge) {
      const e = captura ? captura.estado : 'BORRADOR';
      badge.className = 'estado-badge estado-' + e;
      badge.textContent = etiquetaEstadoSIS(e);
    }
    if (enc) {
      enc.innerHTML = tarjetaDato('Nombre de la unidad', (captura && captura.unidad) || activa.unidad)
        + tarjetaDato('CLUES', activa.clues)
        + tarjetaDato('Responsable de la información', responsableParaMostrar(captura))
        + tarjetaDato('Mes', mesNombre(mes))
        + tarjetaDato('Año', String(anio));
    }
    if (aviso) {
      let msg = '';
      if (_sinGuardar) msg = 'Tienes cambios sin guardar en SIS-06-P: esta hoja muestra solo lo ya guardado.';
      else if (!captura) msg = 'Todavía no hay SIS-06-P guardado de este mes: los totales aparecen vacíos hasta que lo captures y guardes.';
      aviso.textContent = msg;
      aviso.style.display = msg ? 'block' : 'none';
    }

    // ---- Sección III: aplicación de biológicos (solo variables con clave) ----
    // Igual que la hoja real (bloques lado a lado, no una tira larga): cada
    // biológico es un contenedor desplegable con su tabla compacta (una línea
    // por variable), y los contenedores se acomodan en columnas (CSS columns,
    // ancho mínimo por columna) -- en pantalla ancha 2-3 columnas, en angosta
    // una. Todos nacen contraídos, con un resumen de lo capturado en la
    // cabecera, para no obligar a recorrer 20 tablas; el estado abierto/
    // cerrado se recuerda al repintar.
    // Adaptativo: en pantalla angosta (CSS, .ceh-sub) solo quedan Variable |
    // Clave | Total y cada fila se toca para abrir su detalle (Afromexicanos,
    // Indígenas, Migrantes) en el modal -- sin desplazamiento horizontal.
    const grupos = new Map();
    _sisVariablesCache.forEach((v) => {
      if (!(v.clave_general || v.clave_afro || v.clave_indigena || v.clave_migrante)) return;
      if (!grupos.has(v.biologico)) grupos.set(v.biologico, []);
      grupos.get(v.biologico).push(v);
    });
    const chip = (c) => `<span style="display:inline-block;font-size:8.5px;font-weight:700;font-family:monospace;background:#f1f5f9;color:#64748b;padding:1px 4px;border-radius:5px;">${c}</span>`;
    const claveTd = (c, sub) => `<td class="${sub ? 'ceh-sub' : ''}" style="padding:3px 2px; text-align:center;">${c ? chip(c) : '<span style="color:#e2e8f0;">·</span>'}</td>`;
    const _TH_C = 'padding:5px 2px; text-align:center; font-size:8.5px; text-transform:uppercase; color:var(--muted); font-weight:700; letter-spacing:.02em;';

    let totalDosisCEH = 0;
    let biologicosConDatos = 0;
    let tarjetasBio = '';
    grupos.forEach((vars, biologico) => {
      const accent = accentDeBiologico(biologico);
      let dosisBio = 0;
      let conDatos = 0;
      const celdaVal = (clave, n, sub) => {
        const con = clave && Number(n) > 0;
        return `<td class="${sub ? 'ceh-sub' : ''}" style="padding:3px 2px; text-align:center; font-weight:800; font-size:12px; color:${con ? accent.hex : 'var(--primary)'}; ${con ? `background:${accent.tintSoft};` : ''}">${clave ? _vacioSiCero(n) : ''}</td>`;
      };
      const filas = vars.map((v) => {
        const val = valores[String(v.fila_excel)] || {};
        if (v.clave_general && Number(val.total) > 0) { dosisBio += Number(val.total); conDatos += 1; }
        const partes = [v.dosis && v.dosis !== v.grupo_poblacional ? v.dosis : '', v.edad || ''].filter(Boolean).join(' · ');
        const completo = [v.grupo_poblacional || v.dosis || '', partes].filter(Boolean).join(' · ');
        return `<tr class="fila-tocable" data-fila="${v.fila_excel}" tabindex="0" style="border-top:1px solid #f1f5f9;">
          <td title="${_esc(completo)}" style="padding:4px 8px; font-size:11.5px; line-height:1.25; color:#334155;"><span style="font-weight:600;">${_esc(v.grupo_poblacional || v.dosis || '')}</span>${partes ? ` <span style="color:#94a3b8; font-weight:600; font-size:10.5px;">· ${_esc(partes)}</span>` : ''}</td>
          ${claveTd(v.clave_general)}${celdaVal(v.clave_general, val.total)}
          ${claveTd(v.clave_afro, true)}${celdaVal(v.clave_afro, val.afro, true)}
          ${claveTd(v.clave_indigena, true)}${celdaVal(v.clave_indigena, val.indigena, true)}
          ${claveTd(v.clave_migrante, true)}${celdaVal(v.clave_migrante, val.migrante, true)}
        </tr>`;
      }).join('');
      totalDosisCEH += dosisBio;
      if (dosisBio > 0) biologicosConDatos += 1;
      if (_cehSoloConDatos && dosisBio === 0) return;
      const cuerpo = `
        <div style="overflow-x:auto;"><table class="ceh-tabla">
          <colgroup><col><col style="width:46px"><col style="width:34px">${'<col class="ceh-sub" style="width:46px"><col class="ceh-sub" style="width:34px">'.repeat(3)}</colgroup>
          <thead><tr style="background:#f8fafc;">
            <th style="${_TH_C} text-align:left; padding-left:8px;">Variable</th>
            <th style="${_TH_C}">Clave</th><th style="${_TH_C}">Total</th>
            <th class="ceh-sub" style="${_TH_C}">Clave</th><th class="ceh-sub" style="${_TH_C}" title="A Afromexicanos">Afro</th>
            <th class="ceh-sub" style="${_TH_C}">Clave</th><th class="ceh-sub" style="${_TH_C}" title="A Indígenas">Indíg.</th>
            <th class="ceh-sub" style="${_TH_C}">Clave</th><th class="ceh-sub" style="${_TH_C}" title="A Migrantes">Migr.</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table></div>`;
      tarjetasBio += acordeonSIS('bio:' + biologico, biologico, accent.tint, accent.hex, resumenChipSIS(dosisBio, conDatos, vars.length), cuerpo, _cehAbiertos);
    });

    const barra = `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button type="button" class="btn-secundario btn-mini" id="cehExpandirTodo"><span class="material-symbols-rounded">unfold_more</span> Expandir todo</button>
        <button type="button" class="btn-secundario btn-mini" id="cehContraerTodo"><span class="material-symbols-rounded">unfold_less</span> Contraer todo</button>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--primary); cursor:pointer; margin-left:4px;">
          <input type="checkbox" id="cehSoloConDatos" ${_cehSoloConDatos ? 'checked' : ''}> Solo biológicos con captura
        </label>
        <span style="margin-left:auto; font-size:12px; font-weight:700; color:var(--muted);">${totalDosisCEH} dosis en ${biologicosConDatos} de ${grupos.size} biológicos</span>
        <span class="solo-angosta" style="flex-basis:100%; font-size:11.5px; font-weight:600; color:var(--muted);">Toca una fila para ver el detalle (Afromexicanos, Indígenas, Migrantes).</span>
      </div>`;

    const tablaBiologicos = grupos.size === 0
      ? '<div style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">Catálogo de variables no disponible.</div>'
      : (tarjetasBio
        ? `<div style="column-width:540px; column-gap:14px;">${tarjetasBio}</div>`
        : '<div style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">Ningún biológico tiene captura este mes.</div>');

    // ---- Influenza (SIS-SS-IE), a continuación de las claves de CE-H ----
    const corte = influenzaCorteDelMes(mes, anio);
    const totales = (f) => _sumaFila(corte.porRubro[f.id]);
    const categoriasInf = [...new Set(INFLUENZA_FILAS.map((f) => f.categoria))];
    const tarjetasInf = categoriasInf.map((cat) => {
      const filasCat = INFLUENZA_FILAS.filter((f) => f.categoria === cat);
      const dosisCat = filasCat.reduce((s, f) => s + totales(f), 0);
      const conDatosCat = filasCat.filter((f) => totales(f) > 0).length;
      const cuerpo = `
        <div style="overflow-x:auto;"><table class="inf-tabla-simple">
          <colgroup><col><col style="width:64px"><col style="width:52px"></colgroup>
          <thead><tr style="background:#f8fafc;">
            <th style="${_TH_C} text-align:left; padding-left:8px;">Variable</th><th style="${_TH_C}">Clave</th><th style="${_TH_C}">Total</th>
          </tr></thead>
          <tbody>${filasInfluenzaHtml(3, (f) => `<td style="${_TD_NUM}">${_vacioSiCero(totales(f))}</td>`, cat)}</tbody>
        </table></div>`;
      return acordeonSIS('inf:' + cat, cat, '#fdf2ee', '#C26750', resumenChipSIS(dosisCat, conDatosCat, filasCat.length), cuerpo, _cehAbiertos);
    }).join('');
    const tablaInfluenza = `
      <div style="display:flex; align-items:center; gap:10px; margin:14px 0 10px; flex-wrap:wrap;">
        <span class="material-symbols-rounded" style="color:#C26750;">vaccines</span>
        <h2 style="font-size:14.5px;">Influenza · claves de la hoja SIS-SS-IE</h2>
        <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${corte.semanas.length ? `${corte.semanas.length} reporte(s) semanal(es) de Meta-Logro en ${mesNombre(mes)}` : 'Sin reportes semanales de Meta-Logro este mes'}</span>
      </div>
      <div style="column-width:420px; column-gap:14px;">${tarjetasInf}</div>`;

    cont.innerHTML = barra + tablaBiologicos + tablaInfluenza;

    // Recordar qué contenedores están abiertos (renderCEH se repite al guardar,
    // cambiar de mes, etc.) y cablear la barra de herramientas.
    cablearAcordeones(cont, _cehAbiertos);
    const btnExp = document.getElementById('cehExpandirTodo');
    const btnCon = document.getElementById('cehContraerTodo');
    if (btnExp) btnExp.addEventListener('click', () => cont.querySelectorAll('details.ceh-acc').forEach((d) => { d.open = true; }));
    if (btnCon) btnCon.addEventListener('click', () => cont.querySelectorAll('details.ceh-acc').forEach((d) => { d.open = false; }));
    const chk = document.getElementById('cehSoloConDatos');
    if (chk) chk.addEventListener('change', () => { _cehSoloConDatos = chk.checked; renderCEH(); });
    cablearFilasTocables(cont);
  }

  // Hoja Influenza (SIS-SS-IE Mensual): TOTAL + semanas 1-5, con TOTAL DE DOSIS
  // APLICADAS y TOTAL EN FRASCOS (10 dosis por frasco), como la hoja oficial.
  // SOLO LECTURA: la captura y la validación contra la meta viven en el panel
  // Meta-Logro Influenza; desde aquí solo se navega a él.
  // Vista de columnas de Influenza en pantalla angosta: 'total', 's1'..'s5' o
  // 'todas' (ver el selector de chips). Se recuerda por mes/año.
  let _infVista = null;
  let _infVistaClave = '';

  function renderInfluenza() {
    const cont = document.getElementById('infContenido');
    if (!cont) return;
    const aviso = document.getElementById('infAviso');
    const conc = document.getElementById('infConciliacion');
    const badge = document.getElementById('infBadgeEstado');
    const cta = document.getElementById('infCta');
    const btnEditar = document.getElementById('btnEditarEnMetaLogro');
    const activa = datosUnidadActiva();
    if (!activa) {
      if (aviso) aviso.style.display = 'none';
      if (conc) conc.style.display = 'none';
      if (badge) badge.textContent = '';
      if (cta) cta.style.display = 'none';
      cont.innerHTML = MSG_SIN_UNIDAD;
      return;
    }
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = capturaDelMesActual();
    const estadoSIS = captura ? captura.estado : 'BORRADOR';
    const corte = influenzaCorteDelMes(mes, anio);
    const n = corte.semanas.length;

    if (badge) {
      badge.className = 'estado-badge estado-' + estadoSIS;
      badge.textContent = etiquetaEstadoSIS(estadoSIS);
    }

    // Botón protagonista hacia Meta-Logro: solo la unidad edita Influenza, y
    // solo mientras el SINBA-SIS del mes siga en borrador (el servidor
    // también lo exige). Cuando está congelada la tarjeta lo explica.
    if (cta) {
      const bloqueada = estadoSIS !== 'BORRADOR';
      cta.style.display = esUnidadSesion() ? 'flex' : 'none';
      cta.classList.toggle('bloqueada', bloqueada);
      document.getElementById('infCtaTitulo').textContent = bloqueada
        ? 'Influenza de este mes está congelada'
        : (n === 0 ? 'Todavía no hay semanas reportadas' : '¿Algo no cuadra con tus semanas?');
      document.getElementById('infCtaTexto').textContent = bloqueada
        ? 'Ya enviaste el SINBA-SIS, así que el corte no cambia desde la unidad. Si hay que corregirlo, pídelo al municipal.'
        : (n === 0
          ? 'El reporte de cada semana se captura en Meta-Logro (jueves o viernes); aquí aparece solo.'
          : 'Las semanas se corrigen en Meta-Logro, donde se validan contra tu meta. Tu SIS-06-P se guarda solo antes de salir.');
      if (btnEditar) {
        btnEditar.disabled = bloqueada;
        btnEditar.title = bloqueada
          ? 'El SINBA-SIS de este mes ya fue enviado: Influenza quedó congelada.'
          : 'Guarda tu SIS-06-P y abre el panel de Influenza (Meta-Logro), donde se captura y se valida contra la meta.';
      }
    }

    const subInf = document.getElementById('infSubtitulo');
    if (subInf) {
      subInf.textContent = esRolRevisor()
        ? 'Dosis de antiinfluenza del mes por semana, leídas de Meta-Logro. Con el SIS enviado, tú puedes corregirlas.'
        : 'Dosis de antiinfluenza del mes por semana, leídas de Meta-Logro. Solo lectura.';
    }
    if (cta && esRolRevisor()) {
      const puede = Boolean(captura) && estadoSIS !== 'BORRADOR';
      cta.style.display = puede ? 'flex' : 'none';
      cta.classList.remove('bloqueada');
      document.getElementById('infCtaTitulo').textContent = 'Corregir Influenza de esta unidad';
      document.getElementById('infCtaTexto').textContent = 'Puedes cambiar las dosis de cada semana o agregar una semana que falte. Cada cambio queda registrado y la unidad lo verá para aceptarlo.';
      if (btnEditar) {
        btnEditar.disabled = false;
        btnEditar.title = 'Abrir el editor de semanas de Influenza de este mes';
        btnEditar.innerHTML = '<span class="material-symbols-rounded">edit_note</span> Corregir semanas';
      }
    }

    if (aviso) {
      let msg = ''; let estilo = '';
      if (estadoSIS !== 'BORRADOR' && esRolRevisor()) {
        msg = 'Este SINBA-SIS ya fue enviado. Como revisor puedes corregir Influenza con el botón de arriba; cada cambio queda auditado y la unidad lo ve.';
        estilo = 'background:#eef2ff; color:#3730a3;';
      } else if (estadoSIS !== 'BORRADOR') {
        msg = 'Corte congelado: este SINBA-SIS ya fue enviado, así que Influenza de este mes ya no cambia desde la unidad.';
        estilo = 'background:#f1f5f9; color:#64748b;';
      } else if (n === 0) {
        msg = `Todavía no hay reportes semanales de Influenza en ${mesNombre(mes)}. Se capturan cada jueves o viernes en Meta-Logro Influenza; aquí aparecen solos.`;
        estilo = 'background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);';
      } else {
        msg = `Corte de ${mesNombre(mes)}: ${n} reporte(s) semanal(es) de Meta-Logro. Si un reporte cambia allá, aquí se actualiza solo -- no hay nada que copiar ni capturar dos veces.`;
        estilo = 'background:var(--success-bg); color:var(--success);';
      }
      aviso.style.cssText = `display:block; margin-bottom:12px; padding:9px 13px; border-radius:12px; font-size:12px; font-weight:700; ${estilo}`;
      aviso.textContent = msg;
    }

    // Conciliación con la baja en Movimiento de Biológico (biológico
    // Antiinfluenza): mismo cálculo del servidor que bloquea Enviar/Validar.
    if (conc) {
      const fila = Array.isArray(_conciliacionCache) ? _conciliacionCache.find((f) => f.grupo === 'INFLUENZA') : null;
      if (!fila || (Number(fila.paloteo) === 0 && Number(fila.aplicado) === 0)) {
        conc.style.display = 'none';
      } else {
        const ok = Boolean(fila.coincide);
        conc.style.cssText = `display:block; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:12px; font-weight:700; ${ok
          ? 'background:var(--success-bg); color:var(--success);'
          : 'background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border);'}`;
        conc.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">${ok ? 'check_circle' : 'compare_arrows'}</span>
          ${ok
            ? `Las ${Number(fila.paloteo)} dosis de Influenza de este mes coinciden con lo dado de baja en Movimiento de Biológico.`
            : `Influenza reporta ${Number(fila.paloteo)} dosis y en Movimiento de Biológico hay ${Number(fila.aplicado)} aplicadas: deben ser iguales para poder enviar el SINBA-SIS.`}
          ${ok ? '' : '<button type="button" class="btn-mini btn-secundario" id="btnIrAMovimientoDesdeInfluenza" style="margin-left:8px;"><span class="material-symbols-rounded">inventory_2</span> Ir a Movimiento de Biológico</button>'}`;
        const irMov = document.getElementById('btnIrAMovimientoDesdeInfluenza');
        if (irMov) irMov.addEventListener('click', () => document.getElementById('btnSeccionMovimiento').click());
      }
    }

    // ---- Resumen del mes + contenedores por categoría ----
    // Pantalla ancha: cada categoría muestra TOTAL + semanas 1-5. Pantalla
    // angosta: un selector de chips (Total / Sem 1..5 / Todas) elige QUÉ
    // columna se ve a lo ancho -- ocultar las semanas hacía impráctico
    // validarlas; "Todas" deja la tabla completa con la columna Variable fija.
    // En ambos casos, al tocar una fila el modal muestra su desglose semanal.
    // Los totales del mes (dosis, frascos de 10 dosis, semanas) van arriba en
    // tarjetas -- lo que en la hoja oficial son las dos filas de pie.
    const totalColumna = [0, 1, 2, 3, 4].map((c) => INFLUENZA_FILAS.reduce((s, f) => s + corte.porRubro[f.id][c], 0));
    const totalGeneral = _sumaFila(totalColumna);
    const kpi = (t, v, extra) => `<div class="detalle-kpi"><div class="t">${t}</div><div class="v">${v}</div>${extra || ''}</div>`;
    const resumen = `
      <div class="detalle-kpis" style="margin-bottom:12px;">
        ${kpi('Dosis aplicadas', totalGeneral)}
        ${kpi('Total en frascos', frascosDe(totalGeneral), '<div class="c" style="font-size:10.5px; color:var(--muted); font-weight:600;">10 dosis por frasco</div>')}
        ${kpi('Semanas reportadas', `${n} <span style="font-size:12px; color:var(--muted); font-weight:700;">de 5</span>`)}
        <button type="button" id="infVerSemanas" class="btn-secundario" style="justify-content:center; align-self:stretch;"><span class="material-symbols-rounded">calendar_view_week</span> Detalle por semana</button>
      </div>`;

    const claveVista = `${mes}-${anio}`;
    if (_infVistaClave !== claveVista || !['total', 'todas', 's1', 's2', 's3', 's4', 's5'].includes(_infVista)) {
      _infVistaClave = claveVista;
      _infVista = n > 0 ? 's' + Math.min(n, 5) : 'total'; // por omisión, la semana más reciente reportada
    }
    const chip = (vista, texto, sub, extraCls) => `<button type="button" class="inf-chip ${_infVista === vista ? 'activo' : ''} ${extraCls || ''}" data-inf-vista="${vista}">${texto}${sub ? `<small>${sub}</small>` : ''}</button>`;
    const chips = `
      <div class="inf-chips" role="group" aria-label="Columna a mostrar">
        ${chip('total', 'Total', '')}
        ${[0, 1, 2, 3, 4].map((c) => chip('s' + (c + 1), 'Sem ' + (c + 1), corte.semanas[c] ? fechaCortaMX(corte.semanas[c].fecha) : 'sin reporte', corte.semanas[c] ? '' : 'sin-reporte')).join('')}
        ${chip('todas', 'Todas', 'desliza →')}
      </div>
      <div class="solo-angosta-inf" style="margin-bottom:10px; font-size:11.5px; font-weight:600; color:var(--muted);">Elige una semana arriba para verla completa; toca una fila para su detalle.</div>`;

    const thSemana = (c) => {
      const cap = corte.semanas[c];
      return `<th class="inf-sem inf-w${c + 1}" style="${_TH}">Sem ${c + 1}<br><span style="font-weight:600; font-size:9px; text-transform:none;">${cap ? fechaCortaMX(cap.fecha) : '—'}</span></th>`;
    };
    const categorias = [...new Set(INFLUENZA_FILAS.map((f) => f.categoria))];
    const contenedores = categorias.map((cat) => {
      const filasCat = INFLUENZA_FILAS.filter((f) => f.categoria === cat);
      const dosisCat = filasCat.reduce((s, f) => s + _sumaFila(corte.porRubro[f.id]), 0);
      const conDatosCat = filasCat.filter((f) => _sumaFila(corte.porRubro[f.id]) > 0).length;
      const cuerpo = `
        <div style="overflow-x:auto;"><table class="inf-tabla">
          <colgroup><col><col style="width:64px"><col style="width:52px">${[1, 2, 3, 4, 5].map((k) => `<col class="inf-sem inf-w${k}" style="width:54px">`).join('')}</colgroup>
          <thead><tr style="background:#f8fafc; border-bottom:1px solid var(--outline-variant);">
            <th style="${_TH} text-align:left; padding-left:8px;">Variable</th><th style="${_TH}">Clave</th><th style="${_TH} color:var(--primary);">Total</th>
            ${[0, 1, 2, 3, 4].map(thSemana).join('')}
          </tr></thead>
          <tbody>${filasInfluenzaHtml(8, (f) => {
            const fila = corte.porRubro[f.id];
            return `<td style="${_TD_NUM} background:#fdf8f6;">${_vacioSiCero(_sumaFila(fila))}</td>`
              + [0, 1, 2, 3, 4].map((c) => `<td class="inf-sem inf-w${c + 1}" style="${_TD_NUM} font-weight:600; color:#64748b;">${_vacioSiCero(fila[c])}</td>`).join('');
          }, cat, 5)}</tbody>
        </table></div>`;
      return acordeonSIS('infhoja:' + cat, cat, '#fdf2ee', '#C26750', resumenChipSIS(dosisCat, conDatosCat, filasCat.length), cuerpo, _cehAbiertos);
    }).join('');

    cont.innerHTML = resumen + `<div class="inf-vista" data-vista="${_infVista}">${chips}<div style="column-width:600px; column-gap:14px;">${contenedores}</div></div>`;
    cablearAcordeones(cont, _cehAbiertos);
    cablearFilasTocables(cont);
    if (cont.dataset.chips !== '1') {
      cont.dataset.chips = '1';
      cont.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-inf-vista]');
        if (!b || !cont.contains(b)) return;
        _infVista = b.dataset.infVista;
        const vista = cont.querySelector('.inf-vista');
        if (vista) vista.dataset.vista = _infVista;
        cont.querySelectorAll('.inf-chip').forEach((c) => c.classList.toggle('activo', c.dataset.infVista === _infVista));
        centrarChipInfluenza(cont);
      });
    }
    const btnSem = document.getElementById('infVerSemanas');
    if (btnSem) btnSem.addEventListener('click', abrirDetalleSemanasInfluenza);
    centrarChipInfluenza(cont);
  }

  // Deja el chip activo a la vista dentro de la tira de chips (sin mover la página).
  function centrarChipInfluenza(cont) {
    const tira = cont.querySelector('.inf-chips');
    const activo = tira && tira.querySelector('.inf-chip.activo');
    if (!tira || !activo || tira.scrollWidth <= tira.clientWidth) return;
    tira.scrollLeft = activo.offsetLeft - (tira.clientWidth - activo.offsetWidth) / 2;
  }

  // ---------------------------------------------------------------------------
  // Piezas compartidas por las hojas derivadas: contenedores desplegables,
  // filas tocables y el modal de detalle (adaptativo, ver CSS .detalle-*).
  // ---------------------------------------------------------------------------

  const frascosDe = (dosis) => Math.round((Number(dosis) / 10) * 100) / 100;
  const _chipClave = (c) => `<span style="display:inline-block;font-size:9px;font-weight:700;font-family:monospace;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:6px;">${_esc(c)}</span>`;

  // Contenedor desplegable (<details>) con cabecera coloreada + resumen.
  function acordeonSIS(llave, titulo, tint, hex, resumen, cuerpo, abiertos) {
    return `
      <details data-ceh-llave="${_esc(llave)}" ${abiertos.has(llave) ? 'open' : ''} class="ceh-acc" style="break-inside:avoid; margin:0 0 10px; border:1px solid var(--outline-variant); border-radius:12px; overflow:hidden; background:#fff;">
        <summary style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:${tint}; color:${hex}; cursor:pointer; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em;">
          <span class="material-symbols-rounded ceh-chev" style="font-size:17px;">expand_more</span>
          <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${_esc(titulo)}">${_esc(titulo)}</span>
          ${resumen}
        </summary>
        ${cuerpo}
      </details>`;
  }
  function resumenChipSIS(dosis, conDatos, total) {
    return dosis > 0
      ? `<span style="flex:none; background:#fff; color:var(--primary); font-size:10px; font-weight:800; padding:2px 9px; border-radius:20px; text-transform:none; letter-spacing:0;">${dosis} dosis · ${conDatos}/${total}</span>`
      : '<span style="flex:none; font-size:10px; font-weight:700; opacity:.7; text-transform:none; letter-spacing:0;">sin captura</span>';
  }
  // Recuerda qué contenedores están abiertos (las hojas se repintan al guardar,
  // cambiar de mes, etc.).
  function cablearAcordeones(cont, abiertos) {
    cont.querySelectorAll('details.ceh-acc').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) abiertos.add(d.dataset.cehLlave); else abiertos.delete(d.dataset.cehLlave);
    }));
  }

  // Filas tocables (delegación, una sola vez por contenedor: el contenedor
  // persiste aunque su contenido se repinte).
  function cablearFilasTocables(cont) {
    if (cont.dataset.tocables === '1') return;
    cont.dataset.tocables = '1';
    const abrir = (tr) => {
      if (tr.dataset.fila) abrirDetalleCEHFila(tr.dataset.fila);
      else if (tr.dataset.inf) abrirDetalleInfluenzaFila(tr.dataset.inf);
    };
    cont.addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-fila], tr[data-inf]');
      if (tr && cont.contains(tr)) abrir(tr);
    });
    cont.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const tr = ev.target.closest && ev.target.closest('tr[data-fila], tr[data-inf]');
      if (tr && ev.target === tr) { ev.preventDefault(); abrir(tr); }
    });
  }

  let _detalleSISRetorno = null;
  // Modal de detalle: ventana centrada en escritorio, hoja desde abajo en
  // móvil (CSS). Cierra con la X, tocando el fondo o con Escape, y devuelve el
  // foco a lo que lo abrió. `acciones` = botones extra [{texto, icono, clase,
  // onClick}] antes del "Cerrar".
  function abrirDetalleSIS({ titulo, subtitulo, cuerpo, acciones }) {
    const ov = document.getElementById('detalleSISOverlay');
    if (!ov) return;
    document.getElementById('detalleSISTitulo').textContent = titulo || '';
    document.getElementById('detalleSISSub').textContent = subtitulo || '';
    document.getElementById('detalleSISCuerpo').innerHTML = cuerpo || '';
    const pie = document.getElementById('detalleSISPie');
    pie.innerHTML = '';
    (acciones || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = a.clase || 'btn-secundario';
      b.innerHTML = (a.icono ? `<span class="material-symbols-rounded">${a.icono}</span> ` : '') + _esc(a.texto);
      b.addEventListener('click', a.onClick);
      pie.appendChild(b);
    });
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'btn-secundario';
    cerrar.textContent = 'Cerrar';
    cerrar.addEventListener('click', cerrarDetalleSIS);
    pie.appendChild(cerrar);
    _detalleSISRetorno = document.activeElement;
    ov.classList.add('abierto');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('detalleSISCuerpo').scrollTop = 0;
    document.getElementById('detalleSISCerrar').focus();
  }
  function cerrarDetalleSIS() {
    const ov = document.getElementById('detalleSISOverlay');
    if (!ov || !ov.classList.contains('abierto')) return;
    ov.classList.remove('abierto');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (_detalleSISRetorno && typeof _detalleSISRetorno.focus === 'function') _detalleSISRetorno.focus();
    _detalleSISRetorno = null;
  }

  // Detalle de una variable de SIS-SS-CE-H: total + subconteos con su clave.
  function abrirDetalleCEHFila(filaExcel) {
    const v = _sisVariablesCache.find((x) => String(x.fila_excel) === String(filaExcel));
    if (!v) return;
    const captura = capturaDelMesActual();
    const val = ((captura && captura.valores) || {})[String(v.fila_excel)] || {};
    const accent = accentDeBiologico(v.biologico);
    const item = (t, clave, n) => (clave
      ? `<div class="detalle-kpi"><div class="t">${t}</div><div class="v" style="color:${Number(n) > 0 ? accent.hex : 'var(--muted)'};">${Number(n) > 0 ? Number(n) : '—'}</div><div class="c">${_chipClave(clave)}</div></div>`
      : '');
    const partes = [v.dosis && v.dosis !== v.grupo_poblacional ? v.dosis : '', v.edad || ''].filter(Boolean).join(' · ');
    abrirDetalleSIS({
      titulo: v.grupo_poblacional || v.dosis || v.biologico,
      subtitulo: [v.biologico, partes].filter(Boolean).join(' · '),
      cuerpo: `
        <div class="detalle-kpis">
          ${item('Total de dosis', v.clave_general, val.total)}
          ${item('A afromexicanos', v.clave_afro, val.afro)}
          ${item('A indígenas', v.clave_indigena, val.indigena)}
          ${item('A migrantes', v.clave_migrante, val.migrante)}
        </div>
        <p style="font-size:11.5px; color:var(--muted); line-height:1.5; margin:0;">Afromexicanos, indígenas y migrantes son subconjuntos del total: no se suman aparte. Estos valores vienen de SIS-06-P${captura ? '' : ' (todavía sin guardar este mes)'}.</p>`
    });
  }

  // Desglose semanal de un rubro de Influenza (con acceso directo a editar).
  function abrirDetalleInfluenzaFila(id) {
    const f = INFLUENZA_FILAS.find((x) => x.id === id);
    if (!f) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const corte = influenzaCorteDelMes(mes, anio);
    const fila = corte.porRubro[id];
    const total = _sumaFila(fila);
    const captura = capturaDelMesActual();
    const editable = esUnidadSesion() && (!captura || captura.estado === 'BORRADOR');
    const semanas = [0, 1, 2, 3, 4].map((c) => {
      const cap = corte.semanas[c];
      return `<tr><td>Semana ${c + 1}</td>
        <td>${cap ? fechaCortaMX(cap.fecha) + (cap.sin_movimiento ? ' · <span style="color:var(--muted);">sin movimiento</span>' : '') : '<span style="color:var(--muted);">sin reporte</span>'}</td>
        <td class="num">${cap ? fila[c] : '—'}</td></tr>`;
    }).join('');
    abrirDetalleSIS({
      titulo: f.edad,
      subtitulo: `${f.grupo} · ${f.categoria}`,
      cuerpo: `
        <div class="detalle-kpis">
          <div class="detalle-kpi"><div class="t">Clave SIS</div><div class="v" style="font-size:16px;">${_esc(f.clave)}</div></div>
          <div class="detalle-kpi"><div class="t">Dosis del mes</div><div class="v">${total}</div>${total > 0 ? `<div class="c" style="font-size:10.5px; color:var(--muted); font-weight:600;">${frascosDe(total)} ${frascosDe(total) === 1 ? 'frasco' : 'frascos'}</div>` : ''}</div>
        </div>
        <table class="detalle-tabla"><thead><tr><th>Semana</th><th>Viernes</th><th style="text-align:right;">Dosis</th></tr></thead><tbody>${semanas}</tbody></table>
        <p style="font-size:11.5px; color:var(--muted); line-height:1.5; margin:10px 0 0;">Se captura semana a semana en Meta-Logro Influenza (ahí se valida contra la meta); aquí solo se lee el corte del mes.</p>`,
      acciones: editable ? [{ texto: 'Editar en Meta-Logro', icono: 'edit_note', clase: 'btn-primario', onClick: () => { cerrarDetalleSIS(); irAMetaLogroInfluenza(); } }] : []
    });
  }

  // Totales por semana de Influenza (las filas de pie de la hoja SIS-SS-IE).
  function abrirDetalleSemanasInfluenza() {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const corte = influenzaCorteDelMes(mes, anio);
    const porSemana = [0, 1, 2, 3, 4].map((c) => INFLUENZA_FILAS.reduce((s, f) => s + corte.porRubro[f.id][c], 0));
    const total = _sumaFila(porSemana);
    const filas = [0, 1, 2, 3, 4].map((c) => {
      const cap = corte.semanas[c];
      const quien = cap ? (cap.sin_movimiento ? 'Sin movimiento' : (cap.capturado_por || '')) : '';
      return `<tr>
        <td>Sem ${c + 1}</td>
        <td>${cap ? fechaCortaMX(cap.fecha) : '<span style="color:var(--muted);">—</span>'}</td>
        <td class="num">${cap ? porSemana[c] : '—'}</td>
        <td class="num" style="font-weight:600;">${cap && porSemana[c] > 0 ? frascosDe(porSemana[c]) : '—'}</td>
        <td style="color:var(--muted); font-size:11.5px;">${_esc(quien)}</td></tr>`;
    }).join('');
    abrirDetalleSIS({
      titulo: `Influenza · ${mesNombre(mes)} ${anio}`,
      subtitulo: 'Total de dosis aplicadas y de frascos por semana reportada',
      cuerpo: `
        <div style="overflow-x:auto;">
        <table class="detalle-tabla">
          <thead><tr><th>Semana</th><th>Viernes</th><th style="text-align:right;">Dosis</th><th style="text-align:right;">Frascos</th><th>Reportó</th></tr></thead>
          <tbody>${filas}
            <tr style="background:#f8fafc;"><td colspan="2" style="font-weight:800;">Total del mes</td><td class="num">${total}</td><td class="num">${total > 0 ? frascosDe(total) : '—'}</td><td></td></tr>
          </tbody>
        </table></div>`
    });
  }

  // ---------------------------------------------------------------------------
  // Ruta del mes + barra de hojas (estado en vivo).
  //
  // La "ruta del mes" (encabezado, solo UNIDAD) explica cómo funciona el
  // SINBA-SIS y marca en qué paso va ESTE mes: Captura -> Concilia -> Envía ->
  // Validación. La barra de hojas (abajo, fija) resume el mismo estado en su
  // línea de estatus y pone una píldora viva en cada hoja. Todo se deriva de
  // las cachés que ya existen (captura del mes, ventana de envío, conciliación
  // con Movimiento, Influenza del mes) -- no hay estado propio que se
  // desincronice.
  // ---------------------------------------------------------------------------

  const _MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaMesCorta(iso) {
    if (!iso) return '';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? '' : `${d.getDate()} ${_MES3[d.getMonth()]}`;
  }

  function estadoRuta() {
    const captura = capturaDelMesActual();
    const est = captura ? captura.estado : 'BORRADOR';
    const filas = Array.isArray(_conciliacionCache) ? _conciliacionCache : null;
    const difs = filas ? filas.filter((f) => !f.coincide) : [];
    return { captura, est, filas, difs, v: _ventanaCache };
  }

  function renderRutaMes() {
    const cont = document.getElementById('rutaMes');
    if (!cont || !esUnidadSesion()) return;
    const { captura, est, filas, difs, v } = estadoRuta();
    const enviado = est !== 'BORRADOR';
    const hecho1 = Boolean(captura) || enviado;
    const hecho2 = enviado || (hecho1 && filas !== null && difs.length === 0);
    const hecho4 = est === 'VALIDADO';

    let t3;
    if (enviado) t3 = `Enviado${captura && captura.enviado_en ? ' el ' + fechaMesCorta(captura.enviado_en) : ''}`;
    else if (v) t3 = v.dentro_envio ? `Ya puedes enviar (hasta el ${fechaMesCorta(v.fin_envio)})` : `Se habilita del ${fechaMesCorta(v.inicio_envio)} al ${fechaMesCorta(v.fin_envio)}`;
    else t3 = 'En la ventana de fin de mes';

    const pasos = [
      { t: 'Captura', x: hecho1 ? (_sinGuardar ? 'Tienes cambios sin guardar' : 'Guardado en SIS-06-P') : 'Paloteo, Movimiento e Influenza', hecho: hecho1 && !(est === 'BORRADOR' && _sinGuardar) },
      { t: 'Concilia', x: hecho2 ? 'Paloteo = Movimiento' : (hecho1 && difs.length ? `${difs.length} biológico${difs.length === 1 ? '' : 's'} no coincide${difs.length === 1 ? '' : 'n'}` : 'Las dosis aplicadas deben ser iguales'), hecho: hecho2, alerta: !hecho2 && hecho1 && difs.length > 0 },
      { t: 'Envía', x: t3, hecho: enviado },
      { t: 'Validación', x: hecho4 ? `Validado${captura && captura.validado_en ? ' el ' + fechaMesCorta(captura.validado_en) : ''}` : (enviado ? 'Esperando al municipal' : 'El municipal revisa y valida'), hecho: hecho4 }
    ];
    const actual = pasos.findIndex((p) => !p.hecho);
    cont.innerHTML = `
      <ol class="ruta-pasos">
        ${pasos.map((p, i) => `
          <li class="ruta-paso ${p.hecho ? 'hecho' : (i === actual ? (p.alerta ? 'alerta' : 'actual') : '')}">
            <span class="ruta-num">${p.hecho ? '<span class="material-symbols-rounded">check</span>' : (p.alerta ? '<span class="material-symbols-rounded">priority_high</span>' : i + 1)}</span>
            <span class="ruta-txt"><b>${p.t}</b><small>${_esc(p.x)}</small></span>
          </li>`).join('')}
      </ol>
      <button type="button" class="ayuda-btn ruta-ayuda" data-ayuda="sinba" title="Cómo funciona el SINBA-SIS" aria-label="Cómo funciona el SINBA-SIS"><span class="material-symbols-rounded">help</span></button>`;
  }

  // Píldoras vivas de cada hoja (barra de abajo).
  function actualizarPildoras() {
    const poner = (id, texto, cls, titulo) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = texto;
      el.className = 'hoja-pildora' + (cls ? ' ' + cls : '');
      el.title = titulo || '';
    };
    poner('pildoraSIS06P', _sinGuardar ? '​' : '', 'punto', 'Cambios sin guardar');
    const filas = Array.isArray(_conciliacionCache) ? _conciliacionCache : null;
    if (filas && filas.length) {
      const nd = filas.filter((f) => !f.coincide).length;
      if (nd) poner('pildoraMovimiento', `${nd} ≠`, 'aviso', `${nd} biológico(s) no coinciden con el paloteo`);
      else poner('pildoraMovimiento', '✓', 'ok', 'Paloteo y Movimiento coinciden');
    } else {
      poner('pildoraMovimiento', '', '');
    }
    poner('pildoraCEH', '', '');
    const selMes = document.getElementById('selMes');
    const selAnio = document.getElementById('selAnio');
    if (selMes && selAnio && datosUnidadActiva()) {
      const nSem = influenzaCorteDelMes(Number(selMes.value), Number(selAnio.value)).semanas.length;
      poner('pildoraInfluenza', nSem ? `${nSem}/5` : '', '', nSem ? `${nSem} semana(s) reportada(s) este mes` : '');
    } else {
      poner('pildoraInfluenza', '', '');
    }
  }

  // Línea de estatus + botón Guardar de la barra de hojas.

  // Aviso permanente (visible en cualquier hoja del SINBA-SIS) cuando el paloteo y el Movimiento no coinciden:
  // el servidor NO deja enviar ni validar así, y antes solo había una tarjeta dentro de la 06-P y un botón apagado.
  function listaDiferenciasHtml(dif) {
    return dif.map((f) => {
      const d = Number(f.paloteo) - Number(f.aplicado);
      return `<span class="sis-dif-chip"><b>${_esc(f.etiqueta)}</b>: paloteo ${Number(f.paloteo)} · Movimiento ${Number(f.aplicado)} <em>(${d > 0 ? '+' : ''}${d})</em></span>`;
    }).join('');
  }
  function renderAlertaDiferencias() {
    let el = document.getElementById('sisAlertaDiferencias');
    const captura = capturaDelMesActual();
    const dif = Array.isArray(_conciliacionCache) ? _conciliacionCache.filter((f) => !f.coincide) : [];
    const sinEnviar = !captura || captura.estado === 'BORRADOR';
    const porValidar = Boolean(captura) && captura.estado === 'ENVIADO';
    const mostrar = Boolean(datosUnidadActiva()) && dif.length > 0 && (sinEnviar || porValidar);
    if (!mostrar) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      const ref = document.getElementById('rutaMes') || document.getElementById('sis06pConciliacion');
      if (!ref) return;
      el = document.createElement('div');
      el.id = 'sisAlertaDiferencias';
      el.setAttribute('role', 'alert');
      ref.insertAdjacentElement('afterend', el);
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-dif-ir]');
        if (!b) return;
        const dest = b.getAttribute('data-dif-ir');
        const btn = document.getElementById(dest === 'mov' ? 'btnSeccionMovimiento' : 'btnSeccionSIS06P');
        if (btn) btn.click();
        if (dest !== 'mov') setTimeout(() => { const c = document.getElementById('sis06pConciliacion'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
      });
    }
    const esU = esUnidadSesion();
    const titulo = sinEnviar
      ? (esU ? 'Tu SINBA-SIS NO se puede enviar todavía' : 'Este SINBA-SIS no se puede enviar todavía')
      : 'Este SINBA-SIS no se puede validar todavía';
    const texto = sinEnviar
      ? `El paloteo SIS-06-P y el Movimiento de Biológico no coinciden en ${dif.length} biológico${dif.length === 1 ? '' : 's'}. Mientras no cuadren el sistema no lo envía, y el municipal no recibe nada.`
      : 'El paloteo y el Movimiento ya no coinciden. Corrige el lado que esté mal para poder validarlo.';
    el.innerHTML = `
      <div class="sis-dif-cab"><span class="material-symbols-rounded">error</span><div><b>${titulo}</b><p>${texto}</p></div></div>
      <div class="sis-dif-lista">${listaDiferenciasHtml(dif)}</div>
      <div class="sis-dif-acciones">
        <button type="button" class="btn-primario btn-mini" data-dif-ir="paloteo"><span class="material-symbols-rounded">fact_check</span> Ver y corregir el paloteo</button>
        <button type="button" class="btn-secundario btn-mini" data-dif-ir="mov"><span class="material-symbols-rounded">medication_liquid</span> Ir al Movimiento</button>
      </div>`;
    el.style.display = 'block';
  }

  function actualizarDock() {
    renderAlertaDiferencias();
    actualizarPildoras();
    // En la pestaña Movimiento de un rol revisor, Guardar/Exportar de la barra
    // pertenecen al Movimiento (ver sincronizarDockMovimiento en biovac_ui.js).
    if (typeof dockEnModoMovimiento === 'function' && dockEnModoMovimiento()) return;
    const btnG = document.getElementById('btnGuardarSIS06P');
    const icoG = document.getElementById('iconoGuardarSIS');
    const etqG = document.getElementById('etiquetaGuardarSIS');
    const captura = capturaDelMesActual();
    if (btnG && icoG && etqG) {
      const reposo = !_sinGuardar && Boolean(captura);
      btnG.classList.toggle('en-reposo', reposo);
      icoG.textContent = reposo ? 'check' : 'save';
      etqG.textContent = reposo ? 'Guardado' : 'Guardar';
      btnG.title = reposo ? 'Todo guardado' : 'Guardar concentrado SIS-06-P';
    }

    // Exportar solo aplica con un SINBA-SIS a la vista: la unidad siempre; un
    // revisor cuando eligió una unidad que ya tiene captura. Guardar (y el
    // resto de acciones) los decide render() según rol/estatus.
    const btnExp = document.getElementById('btnExportarSISCompleto');
    const activaDock = datosUnidadActiva();
    if (btnExp) btnExp.style.display = (esUnidadSesion() || (activaDock && captura)) ? 'inline-flex' : 'none';
    if (btnG && !esUnidadSesion()) btnG.style.display = (activaDock && captura && captura.estado !== 'BORRADOR') ? 'inline-flex' : 'none';

    const caja = document.getElementById('dockEstado');
    if (!caja) return;
    if (!activaDock) { caja.style.display = 'none'; return; }
    const { est, filas, difs, v } = estadoRuta();
    const esU = esUnidadSesion();
    let detalle = '';
    if (est === 'VALIDADO') detalle = 'Ya puedes exportar el Excel oficial e imprimir';
    else if (est === 'ENVIADO') detalle = esU ? 'Esperando al municipal' : 'Pendiente de tu validación';
    else if (_sinGuardar) detalle = 'Cambios sin guardar';
    else if (fueraDeVentanaDeCaptura(captura)) detalle = 'Este mes está fuera de su ventana de captura';
    else if (!captura) detalle = 'Aún sin guardar este mes';
    else if (filas !== null && difs.length) detalle = `${difs.length} biológico${difs.length === 1 ? '' : 's'} no coincide${difs.length === 1 ? '' : 'n'} -- corrige antes de enviar`;
    else if (v && !v.dentro_envio) detalle = `Envío del ${fechaMesCorta(v.inicio_envio)} al ${fechaMesCorta(v.fin_envio)}`;
    else if (v) detalle = `Listo para enviar hasta el ${fechaMesCorta(v.fin_envio)}`;
    caja.style.display = 'flex';
    document.getElementById('dockEstadoTitulo').textContent = est === 'BORRADOR' ? 'Borrador' : est === 'ENVIADO' ? 'Enviado' : 'Validado';
    document.getElementById('dockPunto').className = 'dock-punto ' + (est === 'ENVIADO' ? 'enviado' : est === 'VALIDADO' ? 'validado' : '');
    const hayDif = est === 'BORRADOR' && filas !== null && difs.length > 0;
    document.getElementById('dockPunto').style.background = hayDif ? '#dc2626' : '';
    const detEl = document.getElementById('dockEstadoDetalle');
    detEl.textContent = detalle;
    detEl.style.color = hayDif ? '#dc2626' : '';
    detEl.style.fontWeight = hayDif ? '800' : '';
  }

  // Vuelve a pedir la conciliación al servidor (p. ej. tras guardar una celda
  // de Movimiento) y repinta lo que depende de ella, sin tocar el paloteo que
  // se esté tecleando. Con retraso para agrupar ráfagas de guardados.
  let _refrescoConcTimer = null;
  function refrescarConciliacion() {
    clearTimeout(_refrescoConcTimer);
    _refrescoConcTimer = setTimeout(async () => {
      const activa = datosUnidadActiva();
      if (!activa) return;
      try { await cargarConciliacion(activa.clues); } catch (err) { console.warn('[SINBA-SIS] No se pudo refrescar la conciliación:', err); return; }
      const captura = capturaDelMesActual();
      if (!_sinGuardar) {
        renderConciliacion(soloLecturaPara(captura), captura);
      }
      const btnEnviar = document.getElementById('btnEnviarSIS06P');
      if (btnEnviar && esUnidadSesion() && btnEnviar.style.display !== 'none') {
        const fueraDeVentana = !(_ventanaCache && _ventanaCache.dentro_envio);
        const noConcilia = hayDiferenciasConciliacion();
        btnEnviar.disabled = fueraDeVentana;
        btnEnviar.classList.toggle('con-diferencias', !fueraDeVentana && noConcilia);
        btnEnviar.title = fueraDeVentana
          ? 'Fuera de la ventana de envío'
          : noConcilia ? 'El paloteo SIS-06-P y el Movimiento de Biológico no coinciden -- púlsalo para ver en qué' : 'Enviar el SINBA-SIS para validación';
      }
      renderInfluenza();
      renderRutaMes();
      actualizarDock();
    }, 350);
  }

  // ---------------------------------------------------------------------------
  // Editor de Influenza para revisores (MUNICIPAL / JURISDICCIONAL / ADMIN):
  // corrige las semanas del mes de la unidad que se está revisando, o agrega una
  // semana que falte. Escribe directo en influenza_capturas (la misma tabla que
  // Meta-Logro); el servidor registra cada rubro cambiado en el control de
  // cambios de la unidad (trigger influenza_trg_auditoria_sis).
  // ---------------------------------------------------------------------------
  let _edInf = null;

  async function recargarInfluenzaCache(clues) {
    const { data, error } = await estado.db.from('influenza_capturas')
      .select('id, fecha, valores, sin_movimiento, capturado_por, anio_campana, municipio, unidad').eq('clues', clues);
    if (error) throw error;
    _influenzaCapturasCache = data || [];
  }

  function viernesDelMes(mes, anio) {
    const out = [];
    const dias = new Date(anio, mes, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      if (new Date(anio, mes - 1, d).getDay() === 5) out.push(anio + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
    }
    return out;
  }

  function editorInfluenzaHtml() {
    const semanas = _edInf.semanas;
    const faltan = viernesDelMes(_edInf.mes, _edInf.anio).filter((f) => !semanas.some((w) => w.fecha === f));
    const encabezado = semanas.map((w) => `<th style="${_TH}">${fechaCortaMX(w.fecha)}${w.nuevo ? '<br><span style="font-weight:600; font-size:9px; text-transform:none; color:var(--secondary);">nueva</span>' : ''}</th>`).join('');
    let filas = '';
    let cat = null; let grp = null;
    INFLUENZA_FILAS.forEach((f) => {
      if (f.categoria !== cat) {
        cat = f.categoria; grp = null;
        filas += `<tr><td colspan="${2 + semanas.length}" style="padding:6px 8px; background:#fdf2ee; color:#C26750; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em;">${_esc(cat)}</td></tr>`;
      }
      if (f.grupo !== grp) {
        grp = f.grupo;
        filas += `<tr><td colspan="${2 + semanas.length}" style="padding:5px 8px 1px; font-size:11px; font-weight:700; color:#334155;">${_esc(grp)}</td></tr>`;
      }
      const celdas = semanas.map((w) => {
        const v = Number(w.valores[f.id]) || 0;
        const cambiado = v !== (Number(w.orig[f.id]) || 0);
        return `<td style="padding:2px 3px; text-align:center;"><input type="number" min="0" step="1" inputmode="numeric" class="ed-inf-in" data-f="${w.fecha}" data-r="${f.id}" value="${v || ''}" placeholder="0"
          style="width:58px; text-align:center; font-weight:700; font-size:12px; border:1.5px solid ${cambiado ? '#d97706' : '#e2e8f0'}; background:${cambiado ? '#fffbeb' : '#fff'}; border-radius:8px; padding:5px 4px;"></td>`;
      }).join('');
      filas += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px 4px 18px; font-size:11.5px; color:#475569;">${_esc(f.edad)}</td><td style="padding:2px 4px; text-align:center;">${_chipClave(f.clave)}</td>${celdas}</tr>`;
    });
    const agregar = faltan.length
      ? `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <label for="edInfNueva" style="font-size:11.5px; font-weight:700; color:var(--muted);">¿Falta una semana?</label>
          <select id="edInfNueva" style="padding:6px 8px; border-radius:8px; border:1px solid var(--outline-variant);">${faltan.map((f) => `<option value="${f}">Viernes ${fechaCortaMX(f)}</option>`).join('')}</select>
          <button type="button" class="btn-mini btn-secundario" id="edInfAgregar"><span class="material-symbols-rounded">add</span> Agregar semana</button>
        </div>` : '';
    return `${agregar}
      <div style="overflow:auto; max-height:56vh;">
        <table class="detalle-tabla" style="min-width:340px;">
          <thead><tr><th style="text-align:left;">Variable</th><th>Clave</th>${encabezado}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p style="font-size:11.5px; color:var(--muted); line-height:1.5; margin:10px 0 0;">Se marcan en ámbar las casillas que cambiaste. Guarda para que el cambio llegue al servidor; la unidad verá cada corrección en su panel de cambios.</p>`;
  }

  function pintarEditorInfluenza() {
    const cuerpo = document.getElementById('detalleSISCuerpo');
    if (cuerpo) cuerpo.innerHTML = editorInfluenzaHtml();
  }

  async function abrirEditorInfluenza() {
    const activa = datosUnidadActiva();
    if (!activa) { toast('Selecciona una unidad (CLUES) específica.', 'error'); return; }
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = capturaDelMesActual();
    if (!captura || captura.estado === 'BORRADOR') { toast('Esta unidad todavía no envía su SIS: nada que corregir.', 'error'); return; }
    try {
      await recargarInfluenzaCache(activa.clues); // siempre se parte de lo que hay en el servidor
    } catch (err) {
      toast(esErrorDeRedSIS(err) ? 'Sin conexión: no se pudo abrir el editor. Intenta de nuevo cuando regrese el internet.' : 'No se pudo leer Influenza: ' + err.message, 'error');
      return;
    }
    const corte = influenzaCorteDelMes(mes, anio);
    _edInf = {
      clues: activa.clues, unidad: activa.unidad, municipio: activa.municipio, mes, anio,
      semanas: corte.semanas.map((c) => ({
        fecha: c.fecha, nuevo: false, anio_campana: c.anio_campana, municipio: c.municipio, unidad: c.unidad, capturado_por: c.capturado_por,
        sin_movimiento: Boolean(c.sin_movimiento), orig: Object.assign({}, c.valores || {}), valores: Object.assign({}, c.valores || {})
      }))
    };
    abrirDetalleSIS({
      titulo: 'Corregir Influenza · ' + mesNombre(mes) + ' ' + anio,
      subtitulo: (activa.unidad || activa.clues) + ' · cada semana es un reporte de Meta-Logro',
      cuerpo: editorInfluenzaHtml(),
      acciones: [{ texto: 'Guardar cambios', icono: 'save', clase: 'btn-primario', onClick: guardarEditorInfluenza }]
    });
  }

  async function guardarEditorInfluenza() {
    if (!_edInf) return;
    const cambios = _edInf.semanas.filter((w) => w.nuevo || INFLUENZA_FILAS.some((f) => (Number(w.valores[f.id]) || 0) !== (Number(w.orig[f.id]) || 0)));
    if (!cambios.length) { toast('No hay cambios que guardar.', 'ok'); return; }
    const nombre = nombreCompletoDePerfil(estado.perfil) || String(estado.perfil.usuario || '');
    mostrarCargando('Guardando Influenza...');
    try {
      let campanas = null;
      for (const w of cambios) {
        let anioCampana = w.anio_campana;
        if (w.nuevo) {
          if (!campanas) {
            const { data, error } = await estado.db.from('campanas').select('nombre, fecha_inicio, fecha_fin');
            if (error) throw error;
            campanas = (data || []).filter((c) => c.nombre && c.nombre.indexOf('Campaña Influenza') === 0);
          }
          const camp = campanas.find((c) => w.fecha >= String(c.fecha_inicio).slice(0, 10) && w.fecha <= String(c.fecha_fin).slice(0, 10));
          if (!camp) throw new Error('El viernes ' + fechaCortaMX(w.fecha) + ' queda fuera de una campaña de Influenza: no se puede agregar.');
          anioCampana = camp.nombre;
        }
        const valores = {};
        let suma = 0;
        INFLUENZA_FILAS.forEach((f) => {
          const v = Math.max(0, Math.round(Number(w.valores[f.id]) || 0));
          suma += v;
          if (v > 0 || Object.prototype.hasOwnProperty.call(w.orig, f.id)) valores[f.id] = v;
        });
        const { data: previo, error: errPrevio } = await estado.db.from('influenza_capturas')
          .select('historial_ediciones, valores').eq('clues', _edInf.clues).eq('fecha', w.fecha).maybeSingle();
        if (errPrevio) throw errPrevio;
        let hist = [];
        if (previo && previo.historial_ediciones) {
          hist = typeof previo.historial_ediciones === 'string' ? JSON.parse(previo.historial_ediciones) : previo.historial_ediciones;
        }
        hist.push({ fecha_edicion: new Date().toISOString(), editado_por: estado.perfil.rol, usuario: nombre, valores_anteriores: previo ? previo.valores : null });
        const record = {
          clues: _edInf.clues, unidad: w.unidad || _edInf.unidad, municipio: w.municipio || _edInf.municipio,
          fecha: w.fecha, anio_campana: anioCampana, valores,
          capturado_por: String(w.capturado_por || nombre).toUpperCase(), editado_por: estado.perfil.rol,
          historial_ediciones: hist, sin_movimiento: suma === 0, updated_at: new Date().toISOString()
        };
        const { error } = await estado.db.from('influenza_capturas').upsert(record, { onConflict: 'clues,fecha' });
        if (error) throw error;
      }
      await recargarInfluenzaCache(_edInf.clues);
      const clues = _edInf.clues; const mes = _edInf.mes; const anio = _edInf.anio;
      _edInf = null;
      cerrarDetalleSIS();
      renderInfluenza();
      renderCEH();
      refrescarConciliacion();
      toast('✅ Influenza corregida. La unidad verá los cambios para aceptarlos.', 'ok');
      document.dispatchEvent(new CustomEvent('sis06p:corregido', { detail: { clues, mes, anio, origen: 'influenza' } }));
    } catch (err) {
      console.error('[SINBA-SIS] Error al guardar Influenza:', err);
      toast(esErrorDeRedSIS(err) ? 'Sin conexión: no se guardó. Lo que escribiste sigue en el editor; vuelve a tocar Guardar cuando regrese el internet.' : 'No se guardó Influenza: ' + (err.message || err), 'error');
    } finally {
      ocultarCargando();
    }
  }

  // Un solo listener (delegado) para el editor: sigue funcionando aunque el cuerpo del modal se repinte.
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!_edInf || !el || !el.classList || !el.classList.contains('ed-inf-in')) return;
    const w = _edInf.semanas.find((x) => x.fecha === el.dataset.f);
    if (!w) return;
    w.valores[el.dataset.r] = Math.max(0, parseInt(el.value, 10) || 0);
    const cambiado = (Number(w.valores[el.dataset.r]) || 0) !== (Number(w.orig[el.dataset.r]) || 0);
    el.style.borderColor = cambiado ? '#d97706' : '#e2e8f0';
    el.style.background = cambiado ? '#fffbeb' : '#fff';
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('#edInfAgregar') : null;
    if (!b || !_edInf) return;
    const sel = document.getElementById('edInfNueva');
    if (!sel || !sel.value) return;
    _edInf.semanas.push({ fecha: sel.value, nuevo: true, anio_campana: null, municipio: _edInf.municipio, unidad: _edInf.unidad, capturado_por: null, sin_movimiento: false, orig: {}, valores: {} });
    _edInf.semanas.sort((a, c) => a.fecha.localeCompare(c.fecha));
    pintarEditorInfluenza();
  });

  // ---------------------------------------------------------------------------
  // Historial de meses: lista de todos los SIS de la unidad con su estatus. Es
  // SOLO consulta -- los meses enviados/validados no se pueden editar (el
  // servidor lo exige), aquí se ve, se exporta a Excel o se imprime.
  // ---------------------------------------------------------------------------
  function irAMes(mes, anio) {
    const selMes = document.getElementById('selMes');
    const selAnio = document.getElementById('selAnio');
    if (!Array.from(selAnio.options).some((o) => Number(o.value) === anio)) {
      const o = document.createElement('option');
      o.value = String(anio); o.textContent = String(anio);
      selAnio.appendChild(o);
    }
    selMes.value = String(mes);
    selAnio.value = String(anio);
    selMes.dispatchEvent(new Event('change', { bubbles: true }));
  }

  let _histCablead = false;
  async function abrirHistorial() {
    const activa = datosUnidadActiva();
    if (!activa) { toast('Selecciona una unidad (CLUES) específica.', 'error'); return; }
    let filas = _sis06pCapturasCache.slice();
    try {
      const { data, error } = await estado.db.from('sis06p_capturas')
        .select('id, mes, anio, estado, enviado_en, enviado_por, validado_en, validado_por, excepcion_conciliacion')
        .eq('clues', activa.clues).order('anio', { ascending: false }).order('mes', { ascending: false });
      if (!error && data) filas = data;
    } catch (e) { /* se usa lo que ya hay en pantalla */ }
    filas.sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
    const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const etiqueta = { BORRADOR: 'Borrador', ENVIADO: 'Enviado', VALIDADO: 'Validado' };
    const cuerpo = filas.length
      ? `<div style="overflow-x:auto;"><table class="detalle-tabla">
          <thead><tr><th>Mes</th><th>Estatus</th><th>Enviado</th><th>Validado</th><th></th></tr></thead>
          <tbody>${filas.map((f) => `<tr>
            <td style="font-weight:700;">${mesNombre(f.mes)} ${f.anio}</td>
            <td><span class="estado-badge estado-${f.estado}">${etiqueta[f.estado] || f.estado}</span></td>
            <td>${fecha(f.enviado_en)}</td>
            <td>${f.estado === 'VALIDADO' ? fecha(f.validado_en) + (f.validado_por ? '<br><span style="color:var(--muted); font-size:11px;">' + _esc(f.validado_por) + '</span>' : '') : '—'}</td>
            <td style="text-align:right;"><div style="display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
              <button type="button" class="btn-mini btn-secundario" data-hist-ver="${f.mes}|${f.anio}"><span class="material-symbols-rounded">visibility</span> Ver</button>
              ${f.estado === 'VALIDADO' ? `<button type="button" class="btn-mini btn-secundario" data-hist-excel="${f.mes}|${f.anio}"><span class="material-symbols-rounded">download</span> Excel</button>` : ''}
            </div></td></tr>`).join('')}</tbody></table></div>`
      : '<p style="color:var(--muted); font-size:13px;">Todavía no hay meses guardados para esta unidad.</p>';
    abrirDetalleSIS({
      titulo: 'Historial de SIS',
      subtitulo: (activa.unidad || activa.clues) + ' · solo consulta: los meses enviados ya no se pueden editar',
      cuerpo: '<p style="font-size:12px; color:var(--muted); line-height:1.5; margin:0 0 12px;"><b>Solo consulta:</b> los meses enviados o validados no se pueden editar desde la unidad.</p>' + cuerpo + '<p style="font-size:11.5px; color:var(--muted); line-height:1.5; margin:12px 0 0;">«Ver» abre ese mes en las hojas del SINBA-SIS. Para imprimir, ábrelo y usa «Imprimir» (solo meses validados).</p>'
    });
    if (!_histCablead) {
      _histCablead = true;
      document.getElementById('detalleSISCuerpo').addEventListener('click', async (ev) => {
        const ver = ev.target.closest('[data-hist-ver]');
        const xls = ev.target.closest('[data-hist-excel]');
        const b = ver || xls;
        if (!b) return;
        const [m, a] = (b.dataset.histVer || b.dataset.histExcel).split('|').map(Number);
        cerrarDetalleSIS();
        irAMes(m, a);
        const btnSis = document.getElementById('btnSeccionSIS06P');
        if (ver && btnSis && !btnSis.classList.contains('activo')) btnSis.click();
        if (xls) await exportarSISOficialCompleto();
      });
    }
  }

  // Guarda lo pendiente del paloteo SIS-06-P y abre el panel de Influenza
  // (Meta-Logro): es ahí donde se captura y se valida contra la meta, así que
  // no hay dos lugares para editar lo mismo. index.html abre directo en esa
  // pestaña con ?captura=INFLUENZA.
  async function irAMetaLogroInfluenza() {
    if (esRolRevisor()) { await abrirEditorInfluenza(); return; }
    if (!esUnidadSesion()) return;
    const captura = capturaDelMesActual();
    if (captura && captura.estado !== 'BORRADOR') { toast('El SINBA-SIS de este mes ya fue enviado: Influenza quedó congelada.', 'error'); return; }
    if (_sinGuardar) {
      const ok = await save();
      if (!ok) return; // no se pierde nada: se queda aquí con el aviso del error
    }
    window.location.href = 'index.html?captura=INFLUENZA';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnHist = document.getElementById('btnHistorialSIS');
    if (btnHist) btnHist.addEventListener('click', abrirHistorial);
    const btnMeta = document.getElementById('btnEditarEnMetaLogro');
    const ovDetalle = document.getElementById('detalleSISOverlay');
    if (ovDetalle) ovDetalle.addEventListener('click', (ev) => { if (ev.target === ovDetalle) cerrarDetalleSIS(); });
    const btnCerrarDetalle = document.getElementById('detalleSISCerrar');
    if (btnCerrarDetalle) btnCerrarDetalle.addEventListener('click', cerrarDetalleSIS);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarDetalleSIS(); });
    if (btnMeta) btnMeta.addEventListener('click', irAMetaLogroInfluenza);
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
  window.SIS06PComodin = { PARES: AJUSTES_DEF, num2: _num2, diagnosticoPar };
  window.SIS06PBiovac = {
    init, render, save, hayCambiosSinGuardar: () => _sinGuardar, renderCSVPreview, exportarSISOficialCompleto, exportarZipMunicipio, configurarImpresionOficial, INFLUENZA_SIS_MAPPING,
    abrirHistorial, abrirEditorInfluenza,
    renderCEH, renderInfluenza, aplicarResponsable, guardarResponsable, marcarResponsableManual, refrescarConciliacion, actualizarDock
  };
})();
