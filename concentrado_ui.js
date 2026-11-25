/**
 * concentrado_ui.js — Panel "Concentrado de Aplicaciones" (ADMIN / JURISDICCIONAL / VISUALIZADOR_JURISDICCIONAL)
 *
 * Rediseño (nov-2026): en vez de una tabla pivote, el panel se lee de arriba abajo:
 *   1. Hero: total del periodo, cambio contra el mismo periodo del año anterior y ritmo mensual (clic en un mes = verlo solo).
 *   2. Biológicos: listón de participación + fichas que SON el filtro (uno o varios) de todo lo demás.
 *   3. Hallazgos: lo que conviene revisar, redactado a partir de los datos (unidades sin dosis, caídas, biológicos en cero…).
 *   4. Municipios: composición y cambio de cada uno; clic acota el panel.
 *   5. Unidades: ranking con composición por biológico, cambio y detalle (dosis por clave SIS bajo demanda) o la matriz
 *      completa unidad × biológico/clave para quien la necesite. El Excel exporta lo que se ve.
 *
 * El cálculo vive en concentrado_motor.js (puro, probado en Node). Motor de datos aislado: RPCs propias
 * (get_concentrado_por_biologico, get_concentrado_aplicaciones, get_concentrado_mensual); no toca get_rda_indicators.
 * Todas las llamadas se paginan (PAGE_SIZE) para no truncar en silencio contra el tope de filas de PostgREST.
 */
(function (window) {
  'use strict';

  const M = window.ConcentradoMotor;

  // Paleta del Excel institucional (misma `insumos` de main.js:generateProfessionalXLSX). La pantalla usa otra (ver motor).
  const CONCENTRADO_BIOLOGICOS = [
    { key: 'BCG', label: 'BCG', color: '3A86B7', fontColor: 'FFFFFFFF' },
    { key: 'HEPATITIS B', label: 'Hepatitis B', color: 'C43D3D', fontColor: 'FFFFFFFF' },
    { key: 'HEXAVALENTE', label: 'Hexavalente', color: '9ACD32', fontColor: 'FF000000' },
    { key: 'DPT', label: 'DPT', color: 'E9C46A', fontColor: 'FF000000' },
    { key: 'ROTAVIRUS', label: 'Rotavirus', color: '264653', fontColor: 'FFFFFFFF' },
    { key: 'NEUMOCOCICA 13', label: 'Neumocócica 13', color: '3D405B', fontColor: 'FFFFFFFF' },
    { key: 'NEUMOCOCICA 20', label: 'Neumocócica 20', color: '5C5F82', fontColor: 'FFFFFFFF' },
    { key: 'SRP', label: 'SRP', color: 'B23A48', fontColor: 'FFFFFFFF' },
    { key: 'SR', label: 'SR', color: '7B5EA7', fontColor: 'FFFFFFFF' },
    { key: 'VPH', label: 'VPH', color: '2A9D8F', fontColor: 'FF000000' },
    { key: 'VARICELA', label: 'Varicela', color: '8ED1C2', fontColor: 'FF000000' },
    { key: 'HEPATITIS A', label: 'Hepatitis A', color: 'BDBDBD', fontColor: 'FF000000' },
    { key: 'TD', label: 'TD', color: '9E9E9E', fontColor: 'FF000000' },
    { key: 'TDPA', label: 'TDPA', color: 'E76F51', fontColor: 'FFFFFFFF' },
    { key: 'COVID-19', label: 'COVID-19', color: '4A4A4A', fontColor: 'FFFFFFFF' },
    { key: 'INFLUENZA', label: 'Influenza', color: 'D48A6A', fontColor: 'FFFFFFFF' },
    { key: 'VSR', label: 'VSR', color: 'D8B4A0', fontColor: 'FF000000' }
  ];
  const CONCENTRADO_OTROS = { key: 'OTROS', label: 'Otros / sin clasificar', color: 'CBD5E1', fontColor: 'FF000000' };
  const CONCENTRADO_BIOLOGICOS_ALL = CONCENTRADO_BIOLOGICOS.concat([CONCENTRADO_OTROS]);

  // Debe coincidir 1:1 con alias_map de get_concentrado_por_biologico / get_concentrado_mensual (supabase/).
  const CANONICAL_BIOLOGICO_ALIASES = {
    'BCG': ['BCG', 'MOTHER_BCG'],
    'HEPATITIS B': ['HEPB_0_7', 'ADOL_HB', 'HEPATITIS B', 'MOTHER_HEPATITIS_B'],
    'HEXAVALENTE': ['HEXA_1', 'HEXA_2', 'HEXA_3', 'HEXA_REF', 'HEXAVALENTE', 'MOTHER_HEXAVALENTE'],
    'DPT': ['DPT_4', 'DPT', 'MOTHER_DPT'],
    'ROTAVIRUS': ['ROTA_1', 'ROTA_2', 'ROTAVIRUS', 'MOTHER_ROTAVIRUS'],
    'NEUMOCOCICA 13': ['NEUMO_1', 'NEUMO_2', 'NEUMO_C1', 'NEUMO_C2', 'NEUMO_C3', 'NEUMO_REF', 'AM_NEUMO13', 'MOTHER_NEUMO_CONJ'],
    'NEUMOCOCICA 20': ['AM_NEUMO20', 'MOTHER_NEUMO_20'],
    'SRP': ['SRP_1', 'SRP_2', 'SRP_6', 'SRP', 'MOTHER_SRP'],
    'SR': ['ADOL_SR', 'SR', 'MOTHER_SR'],
    'VPH': ['ADOL_VPH', 'VPH', 'MOTHER_VPH'],
    'VARICELA': ['VARICELA', 'MOTHER_VARICELA'],
    'HEPATITIS A': ['HEPATITIS_A', 'HEPATITIS A', 'MOTHER_HEPATITIS_A'],
    'TD': ['ADOL_TD', 'AM_TD', 'TD', 'MOTHER_TD'],
    'TDPA': ['ADOL_TDPA', 'EMB_TDPA', 'TDPA', 'MOTHER_TDPA'],
    'COVID-19': ['COVID', 'COVID-19', 'MOTHER_COVID'],
    'INFLUENZA': ['INFLUENZA', 'MOTHER_INFLUENZA'],
    'VSR': ['EMB_VSR', 'VSR', 'MOTHER_VSR']
  };

  const MUNI_ORDER_CONCENTRADO = ['CORREGIDORA', 'HUIMILPAN', 'MARQUES', 'QUERETARO'];
  // QTSSA001740 (Hospital de Especialidades del Niño y la Mujer) no tiene filas en registros_sis bajo ese CLUES (su captura
  // quedó ligada a "HENM", ver main.js:generateProfessionalXLSX): se excluye, su nombre larguísimo rompe las columnas.
  const EXCLUDED_CLUES = new Set(['QTSSA001740']);
  const STICKY_W = { clues: 108, unidad: 210, municipio: 104 };
  // Tamaño de página chico, muy por debajo de cualquier tope de PostgREST (típicamente 1000): "llegaron menos de PAGE_SIZE"
  // vuelve a ser una señal confiable de fin de datos.
  const PAGE_SIZE = 500;
  const FILAS_VISIBLES = 12;

  const normUp_ = M.normUp;
  const fmt_ = M.fmt;
  const esc_ = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bonito_ = (s) => { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

  function biologicoLabelFor_(key) {
    const found = CONCENTRADO_BIOLOGICOS_ALL.find((b) => b.key === key);
    return found ? found.label : key;
  }
  function biologicoOrderIndex_(key) {
    const idx = CONCENTRADO_BIOLOGICOS.findIndex((b) => b.key === key);
    return idx === -1 ? CONCENTRADO_BIOLOGICOS.length : idx;
  }

  const _state = {
    initialized: false,
    anio: 2026,
    mesIni: 1,
    mesFin: 12,
    mesCorte: 12,
    municipio: '',
    busqueda: '',
    sel: [],                 // biológicos elegidos (vacío = todos)
    modo: 'ranking',         // 'ranking' | 'matriz'
    vista: 'biologico',      // agrupación de la matriz y del Excel: 'biologico' | 'clave'
    orden: 'total',          // 'total' | 'caida' | 'alza' | 'nombre' | 'sin'
    abiertas: new Set(),     // CLUES con el detalle abierto
    verTodas: false,
    loading: false,
    reqId: 0,
    bioFetchKey: null,
    claveFetchKey: null,
    claveLoading: false,
    bioRows: [],
    prevRows: null,          // mismo rango del año anterior (null si no se pudo pedir)
    claveRows: [],
    mensual: null,           // serie del año consultado / del anterior (null = no disponible)
    mensualPrev: null,
    mensualCache: {},
    mensualCargando: false,
    unidades: [],
    claveToBiologico: new Map(),
    foco: null
  };
  const _idx = { clave: new Map() };

  // ── Paginación defensiva (POST con p_offset/p_limit, el offset avanza por filas que LLEGARON) ──────────────────────
  async function fetchAllPaginated_(rpcName, params, pageSize) {
    const tam = pageSize || PAGE_SIZE;
    let all = [];
    let offset = 0;
    while (true) {
      const { data, error } = await window.supabase.rpc(rpcName, { ...params, p_offset: offset, p_limit: tam });
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) break;
      all = all.concat(rows);
      offset += rows.length;
    }
    return all;
  }

  // ── Mapa clave SIS -> biológico (solo para etiquetar el desglose por clave) ───────────────────────────────────────
  async function buildAliasLookup_(anio) {
    _state.claveToBiologico = new Map();
    const { data, error } = await window.supabase.from('sis_variables_mapeo').select('biologico, variables').eq('anio', anio);
    if (error) { console.error('[Concentrado] Error cargando sis_variables_mapeo:', error); return; }
    const aliasIndex = new Map();
    Object.keys(CANONICAL_BIOLOGICO_ALIASES).forEach((parent) => {
      CANONICAL_BIOLOGICO_ALIASES[parent].forEach((alias) => aliasIndex.set(normUp_(alias), parent));
    });
    (data || []).forEach((row) => {
      const parent = aliasIndex.get(normUp_(row.biologico)) || 'OTROS';
      (Array.isArray(row.variables) ? row.variables : []).forEach((clave) => {
        const claveUp = normUp_(clave);
        if (claveUp) _state.claveToBiologico.set(claveUp, parent);
      });
    });
  }

  async function loadUnidadesVisibles_() {
    const [medRes, actRes] = await Promise.all([
      window.supabase.from('unidades_medicas').select('clues, nombre, municipio'),
      window.supabase.from('unidades').select('clues, activo').eq('activo', 'SI')
    ]);
    if (medRes.error) { console.error('[Concentrado] Error cargando unidades_medicas:', medRes.error); return; }
    if (actRes.error) { console.error('[Concentrado] Error cargando unidades activas:', actRes.error); return; }
    const activasSet = new Set((actRes.data || []).map((u) => u.clues));
    const user = window.USER || {};
    _state.unidades = (medRes.data || [])
      .filter((u) => activasSet.has(u.clues))
      .filter((u) => !EXCLUDED_CLUES.has(u.clues))
      .filter((u) => typeof window.canSeeMunicipio_ === 'function' ? window.canSeeMunicipio_(user, u.municipio) : true)
      .sort((a, b) => (a.municipio || '').localeCompare(b.municipio || '') || a.clues.localeCompare(b.clues));
  }

  function municipiosVisibles_() {
    const set = new Set(_state.unidades.map((u) => normUp_(u.municipio)));
    return MUNI_ORDER_CONCENTRADO.filter((m) => set.has(m));
  }

  // ── Carga de datos ────────────────────────────────────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const rangoKey_ = () => `${_state.anio}|${_state.mesIni}|${_state.mesFin}`;

  async function cargarMensual_(anio) {
    if (_state.mensualCache[anio] !== undefined) return _state.mensualCache[anio];
    try {
      const filas = await fetchAllPaginated_('get_concentrado_mensual', { p_anio: anio }, 1000);
      _state.mensualCache[anio] = filas;
    } catch (err) {
      console.warn('[Concentrado] Serie mensual no disponible:', err);
      _state.mensualCache[anio] = null;
    }
    return _state.mensualCache[anio];
  }

  async function fetchBiologicoData_(force) {
    const key = rangoKey_();
    if (!force && _state.bioFetchKey === key) { render_(); return; }
    if (force) _state.mensualCache = {};
    const req = ++_state.reqId;
    _state.loading = true;
    render_();
    const p = { p_anio: _state.anio, p_mes_ini: _state.mesIni, p_mes_fin: _state.mesFin };
    const pPrev = { ...p, p_anio: _state.anio - 1 };
    try {
      // Primero lo esencial (total, biológicos, municipios, unidades); la serie mensual se pide después para no competir
      // por la base y no retrasar la primera pantalla (con datos reales cada consulta pesada tarda varios segundos).
      const [rows, prev] = await Promise.all([
        fetchAllPaginated_('get_concentrado_por_biologico', p),
        fetchAllPaginated_('get_concentrado_por_biologico', pPrev).catch((e) => { console.warn('[Concentrado] Sin comparativo del año anterior:', e); return null; })
      ]);
      if (req !== _state.reqId) return; // llegó otra consulta después: esta ya no vale
      _state.bioRows = rows;
      _state.prevRows = prev;
      _state.bioFetchKey = key;
      const cA = _state.mensualCache[_state.anio], cB = _state.mensualCache[_state.anio - 1];
      _state.mensualCargando = cA === undefined || cB === undefined;
      _state.mensual = cA || null;
      _state.mensualPrev = cB || null;
    } catch (err) {
      if (req !== _state.reqId) return;
      console.error('[Concentrado] Error en RPC get_concentrado_por_biologico:', err);
      if (window.showToast) window.showToast('No se pudo cargar el concentrado de aplicaciones.', false, 'bad');
      _state.bioRows = []; _state.prevRows = null; _state.bioFetchKey = null;
    }
    _state.loading = false;
    render_();
    if (_state.mensualCargando) {
      const [anio] = [_state.anio];
      Promise.all([cargarMensual_(anio), cargarMensual_(anio - 1)]).then(([a, b]) => {
        if (req !== _state.reqId) return;
        _state.mensual = a; _state.mensualPrev = b; _state.mensualCargando = false;
        render_();
      });
    }
  }

  // Desglose por clave SIS: ~11 mil filas para toda la jurisdicción, solo bajo demanda (matriz por clave o detalle de unidad).
  async function fetchClaveData_(force) {
    const key = rangoKey_();
    if (!force && _state.claveFetchKey === key) { render_(); return; }
    _state.claveLoading = true;
    render_();
    try {
      _state.claveRows = await fetchAllPaginated_('get_concentrado_aplicaciones', { p_anio: _state.anio, p_mes_ini: _state.mesIni, p_mes_fin: _state.mesFin });
      _state.claveFetchKey = key;
      reindexaClaves_();
    } catch (err) {
      console.error('[Concentrado] Error en RPC get_concentrado_aplicaciones:', err);
      if (window.showToast) window.showToast('No se pudo cargar el desglose por clave.', false, 'bad');
      _state.claveRows = []; _state.claveFetchKey = null; _idx.clave = new Map();
    }
    _state.claveLoading = false;
    render_();
  }

  function reindexaClaves_() {
    const m = new Map();
    _state.claveRows.forEach((r) => {
      let o = m.get(r.clues); if (!o) { o = {}; m.set(r.clues, o); }
      o[normUp_(r.variable_sis)] = (o[normUp_(r.variable_sis)] || 0) + Number(r.total_dosis || 0);
    });
    _idx.clave = m;
  }

  // ── Alcance, columnas y agregados (también los usa el Excel) ──────────────────────────────────────────────────────
  function unidadesVisiblesFiltro_() {
    let out = _state.unidades;
    if (_state.municipio) out = out.filter((u) => normUp_(u.municipio) === _state.municipio);
    if (_state.busqueda) out = out.filter((u) => normUp_(u.nombre).includes(_state.busqueda) || normUp_(u.clues).includes(_state.busqueda));
    return out;
  }

  const selSet_ = () => (_state.sel.length ? new Set(_state.sel) : null);

  function computeUnitAggregate_(clues) {
    const sel = selSet_();
    if (_state.vista === 'clave') {
      const porClave = {};
      let totalGeneral = 0;
      const o = _idx.clave.get(clues) || {};
      Object.keys(o).forEach((c) => {
        if (sel && !sel.has(_state.claveToBiologico.get(c) || 'OTROS')) return;
        porClave[c] = o[c]; totalGeneral += o[c];
      });
      return { totalGeneral, porFuente: porClave };
    }
    const porBiologico = {};
    let totalGeneral = 0;
    _state.bioRows.forEach((r) => {
      if (r.clues !== clues) return;
      if (sel && !sel.has(r.biologico)) return;
      porBiologico[r.biologico] = Number(r.total_dosis || 0);
      totalGeneral += Number(r.total_dosis || 0);
    });
    return { totalGeneral, porFuente: porBiologico };
  }

  function computeScopeAggregate_(unidades) {
    const porFuenteTotal = {};
    let grandTotal = 0, unidadesConDatos = 0;
    unidades.forEach((u) => {
      const agg = computeUnitAggregate_(u.clues);
      if (agg.totalGeneral > 0) unidadesConDatos++;
      grandTotal += agg.totalGeneral;
      Object.keys(agg.porFuente).forEach((k) => { porFuenteTotal[k] = (porFuenteTotal[k] || 0) + agg.porFuente[k]; });
    });
    return { porFuenteTotal, grandTotal, unidadesConDatos };
  }

  function columnasActivas_(scopeAgg) {
    const sel = selSet_();
    if (_state.vista === 'clave') {
      return Object.keys(scopeAgg.porFuenteTotal)
        .map((c) => {
          const parent = _state.claveToBiologico.get(c) || 'OTROS';
          return { key: c, label: c, sublabel: biologicoLabelFor_(parent), color: null, fontColor: null, parentIdx: biologicoOrderIndex_(parent), parent };
        })
        .filter((c) => !sel || sel.has(c.parent))
        .sort((a, b) => (a.parentIdx - b.parentIdx) || a.key.localeCompare(b.key));
    }
    return CONCENTRADO_BIOLOGICOS_ALL.filter((c) => !sel || sel.has(c.key));
  }

  // ── Filtros (selects y búsqueda viven en index.html) ──────────────────────────────────────────────────────────────
  function sincronizaMeses_() {
    const a = $('concFilterMesIni'), b = $('concFilterMesFin');
    if (a) a.value = String(_state.mesIni);
    if (b) b.value = String(_state.mesFin);
  }

  function renderFiltros_() {
    const selAnio = $('concFilterAnio'), selMesIni = $('concFilterMesIni'), selMesFin = $('concFilterMesFin');
    const selMuni = $('concFilterMunicipio'), inpBusqueda = $('concSearchUnidad');

    if (selAnio && !selAnio.dataset.filled) {
      selAnio.innerHTML = ['2026', '2025'].map((a) => `<option value="${a}">${a}</option>`).join('');
      selAnio.value = String(_state.anio);
      selAnio.dataset.filled = '1';
      selAnio.addEventListener('change', async () => {
        _state.anio = Number(selAnio.value);
        _state.mesCorte = await resolveMesCorte_(_state.anio);
        _state.mesFin = _state.mesCorte;
        if (_state.mesIni > _state.mesFin) _state.mesIni = _state.mesFin;
        sincronizaMeses_();
        _state.claveFetchKey = null;
        await buildAliasLookup_(_state.anio);
        fetchBiologicoData_(true);
      });
    }
    if (selMesIni && !selMesIni.dataset.filled) {
      selMesIni.innerHTML = M.MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
      selMesIni.value = String(_state.mesIni);
      selMesIni.dataset.filled = '1';
      selMesIni.addEventListener('change', () => {
        _state.mesIni = Number(selMesIni.value);
        if (_state.mesIni > _state.mesFin) _state.mesFin = _state.mesIni;
        sincronizaMeses_();
        cambioDeRango_();
      });
    }
    if (selMesFin && !selMesFin.dataset.filled) {
      selMesFin.innerHTML = M.MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
      selMesFin.value = String(_state.mesFin);
      selMesFin.dataset.filled = '1';
      selMesFin.addEventListener('change', () => {
        _state.mesFin = Number(selMesFin.value);
        if (_state.mesFin < _state.mesIni) _state.mesIni = _state.mesFin;
        sincronizaMeses_();
        cambioDeRango_();
      });
    }
    if (selMuni) {
      const munis = municipiosVisibles_();
      selMuni.innerHTML = '<option value="">Todos los municipios</option>' + munis.map((m) => `<option value="${m}">${bonito_(m)}</option>`).join('');
      selMuni.value = _state.municipio;
      if (!selMuni.dataset.bound) {
        selMuni.addEventListener('change', () => { _state.municipio = selMuni.value; _state.abiertas.clear(); _state.verTodas = false; render_(); });
        selMuni.dataset.bound = '1';
      }
    }
    if (inpBusqueda && !inpBusqueda.dataset.bound) {
      inpBusqueda.addEventListener('input', () => { _state.busqueda = normUp_(inpBusqueda.value); _state.verTodas = false; render_(); });
      inpBusqueda.dataset.bound = '1';
    }
  }

  function cambioDeRango_() {
    _state.abiertas.clear();
    fetchBiologicoData_(false);
    if (_state.vista === 'clave' || _state.claveFetchKey) { _state.claveFetchKey = null; if (_state.modo === 'matriz' && _state.vista === 'clave') fetchClaveData_(false); }
  }

  // Mes de corte "inteligente": reutiliza get_rda_max_mes (solo lectura) para no diluir totales con meses sin captura.
  async function resolveMesCorte_(anio) {
    try {
      const { data, error } = await window.supabase.rpc('get_rda_max_mes', { p_anio: anio });
      if (error) throw error;
      const maxMes = Number(data);
      if (maxMes >= 1 && maxMes <= 12) return maxMes;
    } catch (err) {
      console.warn('[Concentrado] No se pudo resolver el mes de corte automático, se usa diciembre:', err);
    }
    return 12;
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function analizar_(municipio) {
    return M.analiza({
      unidades: _state.unidades, filas: _state.bioRows, filasPrev: _state.prevRows,
      sel: _state.sel, municipio: municipio === undefined ? _state.municipio : municipio, busqueda: _state.busqueda
    });
  }

  function chipDelta_(d, titulo) {
    if (d == null) return '<span class="cn-d cn-d-na" title="Sin cifra del año anterior para comparar">—</span>';
    const cls = d > 0.005 ? 'cn-d-up' : d < -0.005 ? 'cn-d-down' : 'cn-d-flat';
    const ic = d > 0.005 ? 'arrow_upward' : d < -0.005 ? 'arrow_downward' : 'remove';
    return `<span class="cn-d ${cls}" title="${esc_(titulo || '')}"><span class="material-symbols-rounded" aria-hidden="true">${ic}</span>${esc_(M.pctTxt(d))}</span>`;
  }

  function pila_(porBio, anchoPct, tituloUnidad) {
    const segs = M.segmentos(porBio, selSet_());
    const total = segs.reduce((s, x) => s + x.v, 0);
    if (!total) return '<span class="cn-stack cn-stack-vacia" aria-hidden="true"></span>';
    const partes = segs.map((s) => `<i style="flex:${s.v} 1 0; background:${s.color}" data-tip="${esc_(s.label)}: ${fmt_(s.v)} (${Math.round(s.v * 100 / total)}%)${s.detalle ? '\n' + esc_(s.detalle.slice(0, 6).map((d) => `${d.label} ${fmt_(d.v)}`).join(' · ')) : ''}"></i>`).join('');
    return `<span class="cn-stack" style="width:${Math.max(2, anchoPct).toFixed(1)}%" role="img" aria-label="${esc_(tituloUnidad || 'Composición por biológico')}">${partes}</span>`;
  }

  function seccionHero_(an, meses) {
    const rango = M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio);
    const rangoPrev = M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1);
    const sel = _state.sel;
    const etiquetaSel = sel.length ? sel.map((k) => M.labelDe(k)).join(' + ') : 'Todos los biológicos';
    const ambito = [_state.municipio ? bonito_(_state.municipio) : 'Jurisdicción Sanitaria 1', _state.busqueda ? `búsqueda «${esc_($('concSearchUnidad') ? $('concSearchUnidad').value : '')}»` : ''].filter(Boolean).join(' · ');

    let delta = '';
    if (an.hayPrev && an.prev > 0) {
      const d = an.delta;
      const cls = d > 0.005 ? 'cn-d-up' : d < -0.005 ? 'cn-d-down' : 'cn-d-flat';
      const ic = d > 0.005 ? 'arrow_upward' : d < -0.005 ? 'arrow_downward' : 'remove';
      const palabra = d > 0.005 ? 'más' : d < -0.005 ? 'menos' : 'igual';
      delta = `<p class="cn-hero-delta"><span class="cn-d ${cls}"><span class="material-symbols-rounded" aria-hidden="true">${ic}</span>${esc_(M.pctTxt(d))}</span> ${palabra} que en ${esc_(rangoPrev)} <span class="cn-muted">(${fmt_(an.prev)} dosis)</span></p>`;
    } else {
      delta = `<p class="cn-hero-delta cn-muted">${an.hayPrev ? `En ${esc_(rangoPrev)} este filtro no tuvo dosis: no hay base de comparación.` : `Sin cifras de ${_state.anio - 1} para comparar.`}</p>`;
    }

    // Mes más fuerte dentro del rango (solo si el rango abarca varios meses)
    let fuerte = '';
    if (meses && _state.mesFin > _state.mesIni) {
      const enRango = meses.filter((m) => m.mes >= _state.mesIni && m.mes <= _state.mesFin && m.conDatos);
      const top = enRango.slice().sort((a, b) => b.total - a.total)[0];
      if (top && top.total > 0) fuerte = `<div><dt>Mes más fuerte</dt><dd>${M.MESES[top.mes - 1]} <span class="cn-muted">${fmt_(top.total)}</span></dd></div>`;
    }

    const avisos = meses ? M.avisosDeComparacion(meses, _state.mesIni, _state.mesFin, _state.anio) : [];
    const aviso = avisos.length ? `<p class="cn-aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Ojo con la comparación: ${esc_(avisos.join('; '))}.</span></p>` : '';

    return `<section class="cn-hero" aria-label="Resumen del periodo">
      <div class="cn-hero-main">
        <p class="cn-eyebrow">${esc_(etiquetaSel)} · ${esc_(rango)}</p>
        <p class="cn-big" id="concKpiTotal">${fmt_(an.total)}</p>
        <p class="cn-hero-sub">aplicaciones · ${esc_(ambito)}</p>
        ${delta}
        <dl class="cn-facts">
          <div><dt>Unidades con dosis</dt><dd id="concKpiUnidades">${an.conDatos} <span class="cn-muted">de ${an.nUnidades}</span></dd></div>
          <div><dt>Promedio por unidad</dt><dd>${fmt_(an.promedio)}</dd></div>
          ${fuerte}
        </dl>
        ${aviso}
      </div>
      ${seccionRitmo_(meses)}
    </section>`;
  }

  function seccionRitmo_(meses) {
    if (!meses && _state.mensualCargando) {
      return `<div class="cn-ritmo cn-ritmo-na" role="status"><h4>Ritmo mensual ${_state.anio}</h4><p class="cn-muted"><span class="material-symbols-rounded cn-gira" aria-hidden="true">progress_activity</span> Cargando el ritmo mes por mes…</p></div>`;
    }
    if (!meses) {
      return `<div class="cn-ritmo cn-ritmo-na"><h4>Ritmo mensual</h4><p class="cn-muted">La serie mensual no está disponible en este momento. El resto del panel sí.</p></div>`;
    }
    const max = Math.max(1, ...meses.map((m) => Math.max(m.total, m.prev)));
    const unico = _state.sel.length === 1 ? M.colorDe(_state.sel[0]) : '';
    const bars = meses.map((m) => {
      const enRango = m.mes >= _state.mesIni && m.mes <= _state.mesFin;
      const h = m.total > 0 ? Math.max(3, m.total * 86 / max) : 0;
      const hp = m.prev > 0 ? m.prev * 86 / max : 0;
      const tip = `${M.MESES[m.mes - 1]} ${_state.anio}: ${m.conDatos ? fmt_(m.total) : 'sin captura todavía'}` +
        (m.conDatos && m.incompleto ? `\nCaptura parcial: ${m.unidades} de ${m.maxU} unidades` : '') +
        `\n${M.MESES[m.mes - 1]} ${_state.anio - 1}: ${m.conDatosPrev ? fmt_(m.prev) : 'sin datos'}` +
        (m.conDatosPrev && m.incompletoPrev ? ` (captura parcial: ${m.unidadesPrev} de ${m.maxUPrev})` : '');
      const peak = m.total > 0 && m.mes === (meses.find((x) => x.total === Math.max(...meses.map((y) => y.total))) || {}).mes;
      return `<button type="button" class="cn-mes ${enRango ? 'is-in' : 'is-out'} ${m.conDatos ? '' : 'is-vacio'} ${m.incompleto ? 'is-parcial' : ''}" data-a="mes" data-v="${m.mes}" data-tip="${esc_(tip)}" aria-label="${esc_(tip.replace(/\n/g, '. '))}" aria-pressed="${enRango && _state.mesIni === _state.mesFin && _state.mesIni === m.mes ? 'true' : 'false'}">
        <span class="cn-mes-area">
          ${peak ? `<span class="cn-mes-val">${fmt_(m.total)}</span>` : ''}
          <span class="cn-mes-bar" style="height:${h}%;${unico && enRango ? `background:${unico}` : ''}"></span>
          ${hp ? `<span class="cn-mes-prev ${m.incompletoPrev ? 'is-parcial' : ''}" style="height:${hp}%"></span>` : ''}
        </span>
        <span class="cn-mes-lbl">${M.MES3[m.mes - 1]}</span>
      </button>`;
    }).join('');
    const unMes = _state.mesIni === _state.mesFin;
    return `<div class="cn-ritmo">
      <div class="cn-ritmo-cab">
        <h4>Ritmo mensual ${_state.anio}</h4>
        <ul class="cn-leyenda" aria-label="Cómo leer la gráfica">
          <li><i class="cn-lg-bar"></i>${_state.anio}</li>
          <li><i class="cn-lg-prev"></i>${_state.anio - 1}</li>
          <li><i class="cn-lg-parcial"></i>captura parcial</li>
        </ul>
      </div>
      <div class="cn-meses" role="group" aria-label="Meses del año; elige uno para verlo solo">${bars}</div>
      <p class="cn-ritmo-pie cn-muted">${unMes ? 'Viendo un solo mes. Toca el mismo mes otra vez para volver a enero–corte.' : 'Toca un mes para verlo solo; el resto del panel se ajusta.'}</p>
    </div>`;
  }

  function seccionBiologicos_(an) {
    const ordenados = an.porBio.filter((b) => b.key !== 'OTROS' || b.total > 0).sort((a, b) => b.total - a.total || M.BIOLOGICOS.findIndex((x) => x.key === a.key) - M.BIOLOGICOS.findIndex((x) => x.key === b.key));
    const maxShare = Math.max(0.0001, ...ordenados.map((b) => b.share));
    const sel = selSet_();
    const hayFiltro = !!sel;
    const liston = M.segmentos(Object.fromEntries(an.porBio.map((b) => [b.key, b.total])), null);
    const totalListon = liston.reduce((s, x) => s + x.v, 0);
    const segs = liston.map((s) => {
      const activo = !sel || (s.key === 'OTROS_GRIS' ? [...sel].some((k) => !M.SLOTS.some((x) => x[0] === k)) : sel.has(s.key));
      return `<i class="${activo ? '' : 'is-off'}" style="flex:${s.v} 1 0; background:${s.color}" data-tip="${esc_(s.label)}: ${fmt_(s.v)} (${Math.round(s.v * 100 / (totalListon || 1))}%)"></i>`;
    }).join('');
    const chips = ordenados.map((b) => {
      const on = sel && sel.has(b.key);
      const cero = b.total === 0;
      const partes = [];
      if (!cero) partes.push(`${(b.share * 100).toFixed(b.share < 0.1 ? 1 : 0)}%`);
      return `<li><button type="button" class="cn-chip ${on ? 'is-on' : ''} ${cero ? 'is-cero' : ''}" data-a="bio" data-v="${esc_(b.key)}" aria-pressed="${on ? 'true' : 'false'}"
          data-tip="${esc_(`${b.label}: ${fmt_(b.total)} dosis${_state.prevRows ? `\n${M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1)}: ${fmt_(b.prev)}` : ''}`)}">
        <span class="cn-chip-top"><i class="cn-dot" style="background:${b.color}"></i><span class="cn-chip-nom">${esc_(b.label)}</span>${on ? '<span class="material-symbols-rounded cn-chip-ok" aria-hidden="true">check</span>' : ''}</span>
        <span class="cn-chip-num">${fmt_(b.total)}</span>
        <span class="cn-chip-pie"><span class="cn-chip-pct">${cero ? (b.prev > 0 ? 'en cero' : 'sin dosis') : partes.join('')}</span>${cero ? '' : chipDelta_(b.delta, `Contra ${M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1)}`)}</span>
        <span class="cn-chip-barra"><i style="width:${cero ? 0 : Math.max(3, b.share * 100 / maxShare)}%;background:${b.color}"></i></span>
      </button></li>`;
    }).join('');
    return `<section class="cn-sec cn-bio" aria-labelledby="cnBioT">
      <header class="cn-sec-cab">
        <div><h4 id="cnBioT">Biológicos</h4><p class="cn-muted">Elige uno o varios: todo lo demás se recalcula con tu elección.</p></div>
        ${hayFiltro ? `<button type="button" class="cn-link" data-a="bio-clear"><span class="material-symbols-rounded" aria-hidden="true">filter_alt_off</span>Quitar filtro (${sel.size})</button>` : ''}
      </header>
      <div class="cn-liston ${hayFiltro ? 'hay-filtro' : ''}" role="img" aria-label="Participación de cada biológico en el total">${segs}</div>
      <ul class="cn-chips">${chips}</ul>
      <p class="cn-nota cn-muted">Los ocho de mayor volumen tienen color propio; el resto va en gris. El color sigue a la vacuna, nunca a su lugar en el ranking.</p>
    </section>`;
  }

  function seccionHallazgos_(an, meses) {
    const ctx = { rango: M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio), rangoPrev: M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1) };
    const lista = M.hallazgos(an, ctx);
    _state.hallazgos = lista;
    const tarjetas = lista.length ? lista.map((h, i) => `<li class="cn-hall cn-hall-${h.tipo}">
        <span class="material-symbols-rounded cn-hall-ic" aria-hidden="true">${h.icono}</span>
        <div class="cn-hall-tx"><strong>${esc_(h.titulo)}</strong><p>${esc_(h.texto)}</p>
          <button type="button" class="cn-link" data-a="hall" data-v="${i}">${h.accion.tipo === 'bio' ? 'Filtrar por este biológico' : 'Ver en el ranking'}<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div>
      </li>`).join('') : `<li class="cn-hall cn-hall-bien"><span class="material-symbols-rounded cn-hall-ic" aria-hidden="true">task_alt</span><div class="cn-hall-tx"><strong>Nada urgente en este filtro</strong><p>Todas las unidades del alcance registran dosis y no hay caídas fuertes contra ${esc_(ctx.rangoPrev)}.</p></div></li>`;
    return `<section class="cn-sec cn-halls" aria-labelledby="cnHallT">
      <header class="cn-sec-cab"><div><h4 id="cnHallT">Lo que conviene revisar</h4><p class="cn-muted">Calculado con los datos de arriba; cambia cuando cambias los filtros.</p></div></header>
      <ul class="cn-hall-lista">${tarjetas}</ul>
    </section>`;
  }

  function seccionMunicipios_(anTodos) {
    if (anTodos.porMuni.length <= 1 && !_state.municipio) return '';
    const maxT = Math.max(1, ...anTodos.porMuni.map((m) => m.total));
    const filas = anTodos.porMuni.map((m) => {
      const on = _state.municipio === m.muni;
      return `<li><button type="button" class="cn-muni-row ${on ? 'is-on' : ''}" data-a="muni" data-v="${esc_(m.muni)}" aria-pressed="${on ? 'true' : 'false'}">
        <span class="cn-muni-nom">${esc_(bonito_(m.nombre))}<small>${m.conDatos} de ${m.n} ${m.n === 1 ? 'unidad' : 'unidades'} con dosis</small></span>
        <span class="cn-muni-bar">${pila_(m.porBio, m.total * 100 / maxT, `Composición de ${m.nombre}`)}</span>
        <span class="cn-muni-tot">${fmt_(m.total)}<small>${Math.round(m.share * 100)}% del total</small></span>
        ${chipDelta_(m.delta, `Contra ${M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1)}`)}
      </button></li>`;
    }).join('');
    return `<section class="cn-sec cn-munis" aria-labelledby="cnMuniT">
      <header class="cn-sec-cab"><div><h4 id="cnMuniT">Por municipio</h4><p class="cn-muted">${_state.municipio ? 'Toca el municipio activo para volver a ver todos.' : 'Toca uno para acotar el panel. El largo de la barra compara volumen entre municipios; sus colores, la mezcla de biológicos.'}</p></div></header>
      <ul class="cn-muni-lista">${filas}</ul>
    </section>`;
  }

  function seccionUnidades_(an) {
    const modoBtn = (v, ic, txt) => `<button type="button" class="cn-seg-btn ${_state.modo === v ? 'is-on' : ''}" data-a="modo" data-v="${v}" aria-pressed="${_state.modo === v}"><span class="material-symbols-rounded" aria-hidden="true">${ic}</span>${txt}</button>`;
    const cab = `<header class="cn-sec-cab">
        <div><h4 id="cnUniT">Unidades</h4><p class="cn-muted">${an.nUnidades} en este alcance${an.nUnidades !== an.conDatos ? ` · ${an.nUnidades - an.conDatos} sin dosis` : ''}.${_state.modo === 'ranking' ? ' La barra muestra la mezcla de biológicos de cada unidad; el número, cuánto aplicó.' : ''}</p></div>
        <div class="cn-controles">
          ${_state.modo === 'ranking' ? `<label class="cn-orden"><span>Ordenar por</span><select id="concOrden" aria-label="Orden del ranking">
            ${[['total', 'Más aplicaciones'], ['caida', 'Mayor caída'], ['alza', 'Mayor alza'], ['sin', 'Sin dosis primero'], ['nombre', 'Nombre']].map(([v, t]) => `<option value="${v}" ${_state.orden === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
          <div class="cn-seg" role="group" aria-label="Forma de ver las unidades">${modoBtn('ranking', 'leaderboard', 'Ranking')}${modoBtn('matriz', 'grid_view', 'Matriz')}</div>
        </div>
      </header>`;
    if (!an.nUnidades) return `<section class="cn-sec cn-unis" aria-labelledby="cnUniT">${cab}<p class="cn-vacio">Ninguna unidad coincide con la búsqueda o el municipio elegido. Quita un filtro para ver más.</p></section>`;
    return `<section class="cn-sec cn-unis" aria-labelledby="cnUniT">${cab}${_state.modo === 'matriz' ? matriz_() : ranking_(an)}</section>`;
  }

  function ranking_(an) {
    const lista = M.ordena(an.unidades, _state.orden);
    const visibles = _state.verTodas ? lista : lista.slice(0, FILAS_VISIBLES);
    const filas = visibles.map((u, i) => {
      const abierta = _state.abiertas.has(u.clues);
      const sinDosis = u.totalTodas === 0;
      return `<li class="cn-row ${abierta ? 'is-open' : ''} ${sinDosis ? 'is-sin' : ''}">
        <button type="button" class="cn-row-cab" data-a="uni" data-v="${esc_(u.clues)}" aria-expanded="${abierta}">
          <span class="cn-pos">${i + 1}</span>
          <span class="cn-uni-nom"><strong>${esc_(u.nombre)}</strong><small>${esc_(u.clues)} · ${esc_(bonito_(u.municipio))}</small></span>
          <span class="cn-uni-bar">${sinDosis ? '<span class="cn-sin"><span class="material-symbols-rounded" aria-hidden="true">event_busy</span>Sin dosis en el periodo</span>' : (u.total ? pila_(u.porBio, 100, `Composición de ${u.nombre}`) : '<span class="cn-sin cn-sin-sel">Sin dosis del biológico elegido</span>')}</span>
          <span class="cn-uni-tot">${fmt_(u.total)}<small>${an.total ? (u.share * 100).toFixed(u.share < 0.1 ? 1 : 0) + '% del total' : ''}</small></span>
          ${chipDelta_(u.delta, `Contra ${M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1)}: ${fmt_(u.prev)}`)}
          <span class="material-symbols-rounded cn-chev" aria-hidden="true">expand_more</span>
        </button>
        ${abierta ? detalleUnidad_(u) : ''}
      </li>`;
    }).join('');
    const restantes = lista.length - FILAS_VISIBLES;
    const pie = lista.length > FILAS_VISIBLES
      ? `<button type="button" class="cn-mas" data-a="mas">${_state.verTodas ? 'Ver menos' : (restantes === 1 ? 'Ver la unidad restante' : `Ver las ${restantes} unidades restantes`)}</button>` : '';
    return `<ol class="cn-rank">${filas}</ol>${pie}`;
  }

  function detalleUnidad_(u) {
    const sel = selSet_();
    const idxClaves = _idx.clave.get(u.clues) || {};
    const hayClaves = _state.claveFetchKey === rangoKey_();
    const prevU = {}; // dosis del año anterior por biológico de esta unidad
    (_state.prevRows || []).forEach((r) => { if (r.clues === u.clues) prevU[r.biologico] = (prevU[r.biologico] || 0) + Number(r.total_dosis || 0); });
    const llaves = Object.keys(u.porBio).concat(Object.keys(prevU)).filter((k, i, a) => a.indexOf(k) === i)
      .filter((k) => (!sel || sel.has(k)) && ((u.porBio[k] || 0) > 0 || (prevU[k] || 0) > 0))
      .sort((a, b) => (u.porBio[b] || 0) - (u.porBio[a] || 0) || (prevU[b] || 0) - (prevU[a] || 0));
    const items = llaves.map((k) => {
      const claves = hayClaves ? Object.keys(idxClaves).filter((c) => (_state.claveToBiologico.get(c) || 'OTROS') === k).sort() : [];
      const v = u.porBio[k] || 0, prev = prevU[k] || 0;
      return `<li class="cn-det-it"><span class="cn-det-n"><i class="cn-dot" style="background:${M.colorDe(k)}"></i>${esc_(M.labelDe(k))}</span>
        <span class="cn-det-v"><b>${fmt_(v)}</b>${_state.prevRows ? chipDelta_(M.cambio(v, prev), `Contra ${M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio - 1)}`) : ''}</span>
        ${_state.prevRows ? `<span class="cn-muted cn-det-prev">${prev ? `${fmt_(prev)} el año pasado` : 'sin dosis el año pasado'}</span>` : ''}
        ${claves.length ? `<span class="cn-claves">${claves.map((c) => `<span title="Clave SIS ${esc_(c)}"><code>${esc_(c)}</code> ${fmt_(idxClaves[c])}</span>`).join('')}</span>` : ''}
      </li>`;
    }).join('');
    const boton = hayClaves ? '' : `<button type="button" class="cn-link" data-a="claves" ${_state.claveLoading ? 'disabled' : ''}><span class="material-symbols-rounded" aria-hidden="true">key</span>${_state.claveLoading ? 'Cargando claves…' : 'Ver dosis por clave SIS'}</button>`;
    return `<div class="cn-det">
      ${llaves.length ? `<ul class="cn-det-lista">${items}</ul>` : '<p class="cn-muted">Esta unidad no tiene dosis de los biológicos elegidos, ni en este periodo ni en el año anterior.</p>'}
      <div class="cn-det-pie">${boton}<span class="cn-muted">${esc_(u.clues)} · ${esc_(u.nombre)}</span></div>
    </div>`;
  }

  function matriz_() {
    const unidades = unidadesVisiblesFiltro_();
    const scopeAgg = computeScopeAggregate_(unidades);
    const cols = columnasActivas_(scopeAgg);
    const agrupar = `<div class="cn-matriz-barra"><span class="cn-muted">Agrupar columnas por</span>
      <div class="cn-seg cn-seg-chico" role="group" aria-label="Agrupación de la matriz">
        <button type="button" class="cn-seg-btn ${_state.vista === 'biologico' ? 'is-on' : ''}" data-a="agrupar" data-v="biologico" aria-pressed="${_state.vista === 'biologico'}">Biológico</button>
        <button type="button" class="cn-seg-btn ${_state.vista === 'clave' ? 'is-on' : ''}" data-a="agrupar" data-v="clave" aria-pressed="${_state.vista === 'clave'}">Clave SIS</button>
      </div></div>`;
    if (_state.vista === 'clave' && _state.claveLoading) return `${agrupar}<p class="cn-vacio">Cargando el desglose por clave SIS…</p>`;
    if (!cols.length) return `${agrupar}<p class="cn-vacio">No hay columnas con datos para este rango y filtro.</p>`;

    const maxCol = {};
    cols.forEach((c) => { maxCol[c.key] = 0; });
    const aggs = new Map();
    unidades.forEach((u) => { const a = computeUnitAggregate_(u.clues); aggs.set(u.clues, a); cols.forEach((c) => { maxCol[c.key] = Math.max(maxCol[c.key], a.porFuente[c.key] || 0); }); });
    const heat = (v, c) => (v ? ` style="background:rgba(37,106,191,${(0.05 + 0.3 * v / (maxCol[c.key] || 1)).toFixed(3)})"` : '');

    const leftU = STICKY_W.clues, leftM = STICKY_W.clues + STICKY_W.unidad, anchoIzq = leftM + STICKY_W.municipio;
    const th = `<tr>
      <th class="cn-sticky" style="left:0;width:${STICKY_W.clues}px;min-width:${STICKY_W.clues}px">CLUES</th>
      <th class="cn-sticky" style="left:${leftU}px;width:${STICKY_W.unidad}px;min-width:${STICKY_W.unidad}px">Unidad</th>
      <th class="cn-sticky" style="left:${leftM}px;width:${STICKY_W.municipio}px;min-width:${STICKY_W.municipio}px">Municipio</th>
      ${cols.map((c) => `<th class="cn-num">${esc_(c.label)}${c.sublabel ? `<small>${esc_(c.sublabel)}</small>` : ''}</th>`).join('')}
      <th class="cn-num">Total</th></tr>`;

    const munis = _state.municipio ? [_state.municipio] : municipiosVisibles_();
    const mostrarMuni = !_state.busqueda;
    const mostrarJuris = !_state.busqueda && !_state.municipio && munis.length > 1;
    let cuerpo = '';
    munis.forEach((muni) => {
      const us = unidades.filter((u) => normUp_(u.municipio) === muni);
      if (!us.length) return;
      const nomMuni = bonito_(us[0].municipio);
      const sub = {}; let subTotal = 0;
      us.forEach((u) => {
        const a = aggs.get(u.clues);
        cuerpo += `<tr><td class="cn-sticky" style="left:0">${esc_(u.clues)}</td><td class="cn-sticky cn-trunc" style="left:${leftU}px" title="${esc_(u.nombre)}">${esc_(u.nombre)}</td><td class="cn-sticky" style="left:${leftM}px">${esc_(nomMuni)}</td>
          ${cols.map((c) => { const v = a.porFuente[c.key] || 0; sub[c.key] = (sub[c.key] || 0) + v; return `<td class="cn-num"${heat(v, c)}>${v ? fmt_(v) : '<span class="cn-muted">—</span>'}</td>`; }).join('')}
          <td class="cn-num cn-tot">${fmt_(a.totalGeneral)}</td></tr>`;
        subTotal += a.totalGeneral;
      });
      if (mostrarMuni) cuerpo += `<tr class="cn-sub"><td class="cn-sticky" colspan="3" style="left:0;min-width:${anchoIzq}px">Total municipal — ${esc_(nomMuni)}</td>${cols.map((c) => `<td class="cn-num">${fmt_(sub[c.key] || 0)}</td>`).join('')}<td class="cn-num cn-tot">${fmt_(subTotal)}</td></tr>`;
    });
    if (mostrarJuris) cuerpo += `<tr class="cn-sub cn-juris"><td class="cn-sticky" colspan="3" style="left:0;min-width:${anchoIzq}px">Total jurisdiccional</td>${cols.map((c) => `<td class="cn-num">${fmt_(scopeAgg.porFuenteTotal[c.key] || 0)}</td>`).join('')}<td class="cn-num cn-tot">${fmt_(scopeAgg.grandTotal)}</td></tr>`;
    return `${agrupar}<div class="cn-tabla-wrap" tabindex="0" role="region" aria-label="Matriz de aplicaciones; usa las flechas para desplazarte"><table class="cn-tabla"><thead>${th}</thead><tbody>${cuerpo}</tbody></table></div>
      <p class="cn-nota cn-muted">El tono de cada celda compara contra el valor más alto de su columna.</p>`;
  }

  function esqueleto_() {
    return `<div class="cn-cargando" role="status" aria-live="polite"><span class="material-symbols-rounded cn-gira" aria-hidden="true">progress_activity</span>Armando el concentrado de aplicaciones…</div>`;
  }

  function render_() {
    const root = $('concRoot');
    if (!root) return;
    updateSearchCount_();
    if (_state.loading && !_state.bioRows.length) { root.innerHTML = esqueleto_(); return; }
    root.classList.toggle('is-loading', _state.loading);

    const an = analizar_();
    const anTodos = analizar_('');
    const meses = (_state.mensual && _state.mensual.length) ? M.serieMensual(_state.mensual, _state.mensualPrev, { municipio: _state.municipio, sel: _state.sel }) : null;
    const sinNada = !_state.bioRows.length && !_state.loading;

    const html = sinNada
      ? `<p class="cn-vacio">No hay aplicaciones registradas en el SIS para ${esc_(M.rangoTxt(_state.mesIni, _state.mesFin, _state.anio))}. Prueba con otro rango de meses.</p>`
      : seccionHero_(an, meses) + seccionBiologicos_(an) + seccionHallazgos_(an, meses) + seccionMunicipios_(anTodos) + seccionUnidades_(an);
    root.innerHTML = html;

    if (_state.foco) {
      const el = root.querySelector(_state.foco);
      if (el) el.focus({ preventScroll: true });
      _state.foco = null;
    }
  }

  // Compatibilidad con el nombre histórico (main.js / pruebas)
  window.renderConcentradoTable = render_;

  function updateSearchCount_() {
    const el = $('concSearchCount');
    if (!el) return;
    const n = unidadesVisiblesFiltro_().length;
    el.textContent = (_state.busqueda || _state.municipio) ? `${n} de ${_state.unidades.length} unidades` : '';
  }

  // ── Interacción (delegación) ──────────────────────────────────────────────────────────────────────────────────────
  function alternaBio_(key) {
    const i = _state.sel.indexOf(key);
    if (i >= 0) _state.sel.splice(i, 1); else _state.sel.push(key);
    _state.abiertas.clear();
    _state.foco = `[data-a="bio"][data-v="${key.replace(/"/g, '\\"')}"]`;
    render_();
  }

  function aplicaRango_(ini, fin) {
    _state.mesIni = ini; _state.mesFin = fin;
    sincronizaMeses_();
    cambioDeRango_();
  }

  function onClick_(ev) {
    const t = ev.target.closest('[data-a]');
    if (!t) return;
    const a = t.dataset.a, v = t.dataset.v;
    if (a === 'bio') return alternaBio_(v);
    if (a === 'bio-clear') { _state.sel = []; _state.abiertas.clear(); return render_(); }
    if (a === 'mes') {
      const m = Number(v);
      if (_state.mesIni === m && _state.mesFin === m) return aplicaRango_(1, _state.mesCorte);
      return aplicaRango_(m, m);
    }
    if (a === 'muni') {
      _state.municipio = _state.municipio === v ? '' : v;
      const s = $('concFilterMunicipio'); if (s) s.value = _state.municipio;
      _state.abiertas.clear(); _state.verTodas = false;
      _state.foco = `[data-a="muni"][data-v="${v}"]`;
      return render_();
    }
    if (a === 'uni') {
      if (_state.abiertas.has(v)) _state.abiertas.delete(v); else _state.abiertas.add(v);
      _state.foco = `[data-a="uni"][data-v="${v}"]`;
      return render_();
    }
    if (a === 'modo') {
      _state.modo = v;
      if (v === 'matriz' && _state.vista === 'clave' && _state.claveFetchKey !== rangoKey_()) return fetchClaveData_(false);
      return render_();
    }
    if (a === 'agrupar') {
      _state.vista = v;
      if (v === 'clave' && _state.claveFetchKey !== rangoKey_()) return fetchClaveData_(false);
      return render_();
    }
    if (a === 'mas') { _state.verTodas = !_state.verTodas; _state.foco = '[data-a="mas"]'; return render_(); }
    if (a === 'claves') return fetchClaveData_(false);
    if (a === 'hall') {
      const h = (_state.hallazgos || [])[Number(v)];
      if (!h) return;
      if (h.accion.tipo === 'bio') { _state.sel = [h.accion.valor]; _state.abiertas.clear(); render_(); const el = $('cnBioT'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      _state.modo = 'ranking'; _state.orden = h.accion.valor; _state.verTodas = false; render_();
      const el = $('cnUniT'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  // Tooltip único, también con teclado (foco) y sin depender de title
  function bindTooltip_(root) {
    let tip = $('cnTip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'cnTip'; tip.className = 'cn-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip); }
    const muestra = (el) => {
      const txt = el.getAttribute('data-tip'); if (!txt) return;
      tip.innerHTML = txt.split('\n').map((l) => `<span>${l}</span>`).join('');
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
      if (y < 4) y = r.bottom + 8;
      x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    };
    const oculta = () => { tip.hidden = true; };
    root.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el) muestra(el); });
    root.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]')) oculta(); });
    root.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) muestra(el); });
    root.addEventListener('focusout', oculta);
    root.addEventListener('scroll', oculta, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') oculta(); });
  }

  function bindRoot_() {
    const root = $('concRoot');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    root.addEventListener('click', onClick_);
    root.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'concOrden') { _state.orden = e.target.value; _state.verTodas = false; _state.foco = '#concOrden'; render_(); }
    });
    bindTooltip_(root);
  }


  // ── 7. Exportación a Excel institucional (ExcelJS) ──────────────────────────────────
  async function exportConcentradoExcel() {
    // ExcelJS se carga bajo demanda (igual que en el resto de exportaciones de SIREVAQ)
    if (!window.ExcelJS && typeof window.ensureLibsLoaded === 'function') { try { await window.ensureLibsLoaded('exceljs'); } catch (e) { console.warn('[Concentrado] exceljs no cargó:', e); } }
    if (!window.ExcelJS) {
      if (window.showToast) window.showToast('Librería de exportación no cargada todavía, intenta de nuevo en unos segundos.', false, 'bad');
      return;
    }
    if (_state.vista === 'clave' && _state.claveFetchKey !== rangoKey_()) await fetchClaveData_(false);
    const rowsActivas = _state.vista === 'clave' ? _state.claveRows : _state.bioRows;
    if (_state.loading || rowsActivas.length === 0) {
      if (window.showToast) window.showToast('No hay datos cargados para exportar.', false, 'bad');
      return;
    }

    if (window.showToast) window.showToast('Generando concentrado en Excel…', true, 'info');

    const unidadesFiltradas = unidadesVisiblesFiltro_();
    const scopeAgg = computeScopeAggregate_(unidadesFiltradas);
    const cols = columnasActivas_(scopeAgg);
    const munisVisibles = _state.municipio ? [_state.municipio] : municipiosVisibles_();
    // Con una búsqueda activa, la tabla ya no representa "todas las unidades del
    // municipio/jurisdicción" sino solo las que coinciden con el texto -- una fila de
    // TOTAL MUNICIPAL/JURISDICCIONAL en ese contexto es engañosa (parece un total real
    // cuando es apenas la suma de los resultados filtrados), así que se ocultan.
    const mostrarTotalMunicipal = !_state.busqueda;
    const mostrarTotalJurisdiccional = !_state.busqueda && !_state.municipio && munisVisibles.length > 1;

    if (cols.length === 0) {
      if (window.showToast) window.showToast('No hay aplicaciones registradas en este filtro para exportar.', false, 'bad');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIREVAQ';
    const ws = wb.addWorksheet('Concentrado', { views: [{ showGridLines: false }] });

    const totalCols = 3 + cols.length + 1; // CLUES, Unidad, Municipio, ...bio/clave, TOTAL

    // Encabezado institucional
    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell('A1').value = 'SECRETARÍA DE SALUD DE QUERÉTARO — JURISDICCIÓN SANITARIA 1';
    ws.getCell('A1').font = { name: 'Arial Nova', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E46' } };
    ws.getRow(1).height = 32;

    const ambitoLabel = unidadesFiltradas.length === 1
      ? unidadesFiltradas[0].nombre
      : (_state.municipio ? `MUNICIPIO DE ${_state.municipio}` : 'JURISDICCIÓN SANITARIA 1 (TODOS LOS MUNICIPIOS)');
    const vistaLabel = _state.vista === 'clave' ? 'Desglosado por clave SIS' : 'Agrupado por biológico';
    const mesesLabel = `Meses ${_state.mesIni} a ${_state.mesFin} de ${_state.anio}`;

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell('A2').value = `CONCENTRADO DE APLICACIONES POR UNIDAD — ${ambitoLabel}`;
    ws.getCell('A2').font = { name: 'Arial Nova', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(3, 1, 3, totalCols);
    const selLabel = _state.sel.length ? ` · Solo: ${_state.sel.map((k) => M.labelDe(k)).join(', ')}` : '';
    ws.getCell('A3').value = `${vistaLabel}${selLabel} · ${mesesLabel} · Emitido: ${new Date().toLocaleDateString('es-MX')}`;
    ws.getCell('A3').font = { name: 'Arial Nova', size: 9, italic: true, color: { argb: 'FF64748B' } };
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

    const HEADER_ROW = 5;
    const headerRow = ws.getRow(HEADER_ROW);
    headerRow.values = ['CLUES', 'UNIDAD', 'MUNICIPIO', ...cols.map(c => c.sublabel ? `${c.label}\n(${c.sublabel})` : c.label), 'TOTAL'];
    headerRow.height = 26;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial Nova', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const colDef = cols[colNumber - 4];
      const bg = colDef && colDef.color ? colDef.color : '2F3E46';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
    });

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    let rowCursor = HEADER_ROW + 1;
    let jurisRowIdxs = [];

    munisVisibles.forEach(muni => {
      const unidadesMuni = unidadesFiltradas.filter(u => normUp_(u.municipio) === muni);
      if (unidadesMuni.length === 0) return;

      const muniStartRow = rowCursor;

      unidadesMuni.forEach(u => {
        const agg = computeUnitAggregate_(u.clues);
        const row = ws.getRow(rowCursor);
        row.getCell(1).value = u.clues;
        row.getCell(2).value = u.nombre;
        row.getCell(3).value = muni.charAt(0) + muni.slice(1).toLowerCase();
        cols.forEach((c, i) => { row.getCell(4 + i).value = agg.porFuente[c.key] || 0; });
        const totalColIdx = 4 + cols.length;
        row.getCell(totalColIdx).value = { formula: `SUM(D${rowCursor}:${ws.getColumn(totalColIdx - 1).letter}${rowCursor})` };

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial Nova', size: 9, bold: colNumber === totalColIdx };
          cell.border = borderThin;
          if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
        });
        rowCursor++;
      });

      if (mostrarTotalMunicipal) {
        const muniEndRow = rowCursor - 1;
        const subtotalRow = ws.getRow(rowCursor);
        ws.mergeCells(rowCursor, 1, rowCursor, 3);
        subtotalRow.getCell(1).value = `TOTAL MUNICIPAL — ${muni.charAt(0) + muni.slice(1).toLowerCase()}`;
        cols.forEach((c, i) => {
          const colLetter = ws.getColumn(4 + i).letter;
          subtotalRow.getCell(4 + i).value = { formula: `SUM(${colLetter}${muniStartRow}:${colLetter}${muniEndRow})` };
        });
        const totalColIdx = 4 + cols.length;
        const totalColLetter = ws.getColumn(totalColIdx).letter;
        subtotalRow.getCell(totalColIdx).value = { formula: `SUM(${totalColLetter}${muniStartRow}:${totalColLetter}${muniEndRow})` };

        subtotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial Nova', size: 9, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
          cell.border = borderThin;
          if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
        });

        jurisRowIdxs.push(rowCursor);
        rowCursor++;
      }
    });

    if (mostrarTotalJurisdiccional && jurisRowIdxs.length > 0) {
      const jurisRow = ws.getRow(rowCursor);
      ws.mergeCells(rowCursor, 1, rowCursor, 3);
      jurisRow.getCell(1).value = 'TOTAL JURISDICCIONAL (JURISDICCIÓN SANITARIA 1)';
      const totalColIdx = 4 + cols.length;
      cols.forEach((c, i) => {
        const colLetter = ws.getColumn(4 + i).letter;
        const refs = jurisRowIdxs.map(r => `${colLetter}${r}`).join('+');
        jurisRow.getCell(4 + i).value = { formula: refs };
      });
      const totalColLetter = ws.getColumn(totalColIdx).letter;
      jurisRow.getCell(totalColIdx).value = { formula: jurisRowIdxs.map(r => `${totalColLetter}${r}`).join('+') };

      jurisRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Arial Nova', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0D7FF' } };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF4C1D95' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };
        if (colNumber >= 4) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
      });
      rowCursor++;
    }

    // Autoajuste de ancho de columnas
    ws.columns.forEach((column, idx) => {
      if (idx < 3) { column.width = idx === 1 ? 38 : 16; return; }
      let maxLen = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value;
        if (val && typeof val === 'object' && val.formula) return;
        const str = String(val || '');
        if (str.length > maxLen) maxLen = str.length;
      });
      column.width = Math.max(12, Math.min(maxLen + 4, 26));
    });

    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW, showGridLines: false }];

    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
    };
    ws.headerFooter = {
      oddFooter: `&L&"Arial Nova,Regular"&8SIREVAQ — Concentrado de Aplicaciones &C&"Arial Nova,Regular"&8Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} &R&"Arial Nova,Regular"&8Página &P de &N`
    };

    const anioLabel = _state.anio;
    const mesesFile = `${_state.mesIni}-${_state.mesFin}`;
    const ambitoFile = (ambitoLabel || 'JURISDICCIONAL').replace(/\s+/g, '_');
    const fechaFile = new Date().toISOString().slice(0, 10);
    const fileName = `Concentrado_Aplicaciones_${ambitoFile}_${anioLabel}_${mesesFile}_${fechaFile}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    if (window.showToast) window.showToast('🟢 Concentrado exportado a Excel.', true, 'good');
  }

  // ── 8. Init (llamado de forma perezosa desde activateOpsTab) ────────────────────────
  async function initConcentradoPanel() {
    const btnExport = $('btnExportConcentrado');
    if (btnExport && !btnExport.dataset.bound) {
      btnExport.addEventListener('click', exportConcentradoExcel);
      btnExport.dataset.bound = '1';
    }
    const btnRefresh = $('btnRefreshConcentrado');
    if (btnRefresh && !btnRefresh.dataset.bound) {
      btnRefresh.addEventListener('click', () => { _state.claveFetchKey = null; fetchBiologicoData_(true); });
      btnRefresh.dataset.bound = '1';
    }
    bindRoot_();

    if (_state.initialized) {
      renderFiltros_();
      render_();
      return;
    }

    try {
      _state.loading = true;
      render_();
      await loadUnidadesVisibles_();
      await buildAliasLookup_(_state.anio);
      _state.mesCorte = await resolveMesCorte_(_state.anio);
      _state.mesFin = _state.mesCorte;
      if (_state.mesIni > _state.mesFin) _state.mesIni = _state.mesFin;
      renderFiltros_();
      _state.initialized = true;
      await fetchBiologicoData_(true);
    } catch (err) {
      _state.loading = false;
      console.error('[Concentrado] Error inicializando el panel:', err);
      if (window.showToast) window.showToast('Error al inicializar el concentrado de aplicaciones.', false, 'bad');
    }
  }

  window.initConcentradoPanel = initConcentradoPanel;

})(window);
