// ============================================================================
// BioVac — UI de vista jurisdiccional (Fase 4 del plan)
//
// Concentrado en vivo (nunca se guarda aparte), validaciones, generación de
// informe (snapshot), y corrección con drill-down: toda corrección se
// aplica sobre el renglón municipal de origen usando el MISMO motor
// (biovac_abrir_correccion / biovac_aplicar_correccion) que usa la UI
// municipal, solo que con rol='JURISDICCIONAL' y motivo obligatorio.
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' }, { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' }, { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' }, { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' }
];
const MESES_ABREV3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Mismos colores oficiales por biológico que usa biovac_ui.js / el resto de
// SIREVAQ (window.BIOLOGICO_COLORS en main.js), mapeados por `clave`.
const CLAVE_COLORES = {
  BCG: '#3A86B7', HEPB: '#C43D3D', HEXAVALENTE: '#9ACD32', DPT: '#E9C46A',
  ROTAVIRUS: '#264653', NEUMO_13V: '#3D405B', NEUMO_20V: '#3D405B', NEUMO_23V: '#3D405B',
  HEPA: '#4b5563', SRP: '#B23A48', ANTIINFLUENZA: '#C26750', SR: '#7B5EA7',
  VPH: '#2A9D8F', TD: '#5C5C5C', TDPA: '#E76F51', COVID_MODERNA: '#4A4A4A',
  COVID_PFIZER: '#4A4A4A', VARICELA: '#059669', VSR: '#A66B50'
};
function colorDeBiologico(clave) { return CLAVE_COLORES[clave] || '#0f172a'; }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '15, 23, 42';
}
function formatMmmAa(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return `${MESES_ABREV3[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}
// En frascos MULTIDOSIS, existencia_final_frascos/existencia_anterior_frascos
// son una división entre dosis_por_frasco -- si aplicadas/desechadas no caen
// en un múltiplo exacto, arrastra decimales largos que no aportan nada al
// usuario (no se puede tener un tercio de frasco físico). Se muestra
// redondeado a 2 decimales; UNIDOSIS siempre da enteros, así que no le afecta.
function redondearFrascos(valor) {
  const n = Number(valor);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
function loteVencido(caducidadIso) {
  if (!caducidadIso) return false;
  return caducidadIso < new Date().toISOString().slice(0, 10);
}
const DIAS_PROXIMO_A_VENCER = 90;
function semaforoCaducidad(caducidadIso) {
  if (!caducidadIso) return 'sem-ok';
  const diasRestantes = (new Date(caducidadIso + 'T00:00:00').getTime() - Date.now()) / 86400000;
  if (diasRestantes < 0) return 'sem-vencido';
  if (diasRestantes <= DIAS_PROXIMO_A_VENCER) return 'sem-proximo';
  return 'sem-ok';
}

// perfiles.usuario guarda un nombre corto de login -- este mapa es solo de
// despliegue dentro de BioVac (no toca la tabla perfiles compartida).
const PERFIL_ID_A_NOMBRE_COMPLETO = {
  '2db73d2e-4bee-4974-a249-8b827c848922': 'Carlos Becerra Dorantes',
  '68697e4e-4bc3-4c05-b4b6-03fc70a92f01': 'Ana María Ramírez Munguía',
  '948499f8-108a-46b7-b393-d08af025e2f7': 'Stefanía González Rangel',
  '628ba817-95a2-4c88-aaf2-ae6fb1bf2c96': 'Alma Hernández Esquivel',
  '74c6fa10-b106-4209-af61-9d18f7e37f12': 'Ana Julia Mendoza Hernández'
};
function nombreCompletoDePerfil(perfil) {
  return (perfil && PERFIL_ID_A_NOMBRE_COMPLETO[perfil.id]) || (perfil ? perfil.usuario : null);
}

const estado = {
  db: null,
  perfil: null,
  jurisdicciones: [],
  bloques: [],
  concentrado: [],
  drilldownAbierto: null, // {loteId, categoria}
  correccionesAbiertas: {}, // renglonId -> batchId
  paso: 1,
  unidadesCuentan: [],   // unidades que suman en el concentrado del mes elegido
  movPorUnidad: new Map(),
  validaciones: [],
  informes: [],
  sisFilas: [],
  inicioPorUnidad: '2026-10-01',
  filtroBio: '',
  soloAlertas: false,
  munisAbiertas: new Set(),
  unidadPorId: new Map()
};

function initDb() { estado.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }

async function cargarSesionReal() {
  const { data: { session } } = await estado.db.auth.getSession();
  if (!session) return;
  const { data: perfil } = await estado.db.from('perfiles').select('id, usuario, rol').eq('id', session.user.id).maybeSingle();
  if (!perfil) return;
  estado.perfil = perfil;
  const inp = document.getElementById('selUsuario');
  inp.value = nombreCompletoDePerfil(perfil);
  inp.readOnly = true;
}

function usuarioActual() {
  if (estado.perfil) return nombreCompletoDePerfil(estado.perfil);
  const v = document.getElementById('selUsuario').value.trim();
  if (!v) { toast('Ingresa tu nombre antes de continuar.', 'error'); return null; }
  localStorage.setItem('biovac_usuario_jurisdiccion', v);
  return v;
}

function toast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// Reemplaza confirm()/prompt() nativos del navegador por un modal propio
// (mismo patrón que biovac_ui.js).
function mostrarModal({ titulo, mensaje, pedirMotivo = false, placeholderMotivo = '', textoAceptar = 'Aceptar' }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitulo').textContent = titulo;
    document.getElementById('modalMensaje').textContent = mensaje;
    const campoMotivo = document.getElementById('modalCampoMotivo');
    const inputMotivo = document.getElementById('modalInputMotivo');
    campoMotivo.style.display = pedirMotivo ? 'block' : 'none';
    inputMotivo.value = '';
    inputMotivo.placeholder = placeholderMotivo;
    const btnAceptar = document.getElementById('modalBtnAceptar');
    const btnCancelar = document.getElementById('modalBtnCancelar');
    btnAceptar.textContent = textoAceptar;

    function cerrar(resultado) {
      overlay.classList.remove('abierto');
      document.removeEventListener('keydown', onTecla);
      btnAceptar.removeEventListener('click', onAceptar);
      btnCancelar.removeEventListener('click', onCancelar);
      resolve(resultado);
    }
    function onAceptar() {
      if (pedirMotivo) {
        const m = inputMotivo.value.trim();
        if (!m) { inputMotivo.focus(); return; }
        cerrar(m);
      } else {
        cerrar(true);
      }
    }
    function onCancelar() { cerrar(pedirMotivo ? null : false); }
    function onTecla(ev) { if (ev.key === 'Escape') onCancelar(); if (ev.key === 'Enter' && !pedirMotivo) onAceptar(); }

    btnAceptar.addEventListener('click', onAceptar);
    btnCancelar.addEventListener('click', onCancelar);
    document.addEventListener('keydown', onTecla);
    overlay.classList.add('abierto');
    if (pedirMotivo) inputMotivo.focus();
  });
}

async function cargarInicial() {
  const [{ data: jurisdicciones, error: e1 }, { data: bloques, error: e2 }] = await Promise.all([
    estado.db.from('biovac_jurisdicciones').select('*').order('nombre'),
    estado.db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden')
  ]);
  if (e1 || e2) { toast('Error cargando catálogo: ' + (e1 || e2).message, 'error'); return; }
  estado.jurisdicciones = jurisdicciones;
  estado.bloques = bloques;

  document.getElementById('selJurisdiccion').innerHTML = jurisdicciones.map((j) => `<option value="${j.id}">${j.nombre}</option>`).join('');

  const anioActual = new Date().getFullYear();
  const anios = [anioActual - 1, anioActual, anioActual + 1];
  document.getElementById('selAnio').innerHTML = anios.map((a) => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');

  const mesActual = new Date().getMonth() + 1;
  document.getElementById('selMes').innerHTML = MESES.map((m) => `<option value="${m.v}" ${m.v === mesActual ? 'selected' : ''}>${m.l}</option>`).join('');

  if (!estado.perfil) {
    const usuarioGuardado = localStorage.getItem('biovac_usuario_jurisdiccion');
    if (usuarioGuardado) document.getElementById('selUsuario').value = usuarioGuardado;
  }
}

function seleccion() {
  return {
    jurisdiccionId: document.getElementById('selJurisdiccion').value,
    anio: Number(document.getElementById('selAnio').value),
    mes: Number(document.getElementById('selMes').value)
  };
}

// ---------------------------------------------------------------------------
// Flujo guiado en 4 pasos, por MUNICIPIO. Desde octubre de 2026 la cadena es:
// unidades -> municipio -> jurisdicción. Cada unidad cierra su Movimiento al
// enviar su SINBA-SIS; el municipio (que valida a sus unidades) queda como la
// suma de ellas, y la jurisdicción es la suma de los municipios y hospitales.
// Por eso aquí se trabaja a nivel municipio: las unidades solo se consultan.
//
//   1. Municipios   -- ¿ya cerró cada municipio y hospital?
//   2. Por revisar  -- lo que el concentrado detecta, dicho en claro y con quién lo resuelve.
//   3. Concentrado  -- la suma por biológico y lote; "Ver" abre el detalle por municipio.
//   4. Informe      -- lista de verificación, informe (foto del mes), Excel y PDF.
// ---------------------------------------------------------------------------

const PASOS_JUR = [
  { n: 1, t: 'Municipios', icono: 'location_city', color: '#0284c7', titulo: '1. ¿Ya cerró cada municipio y hospital?' },
  { n: 2, t: 'Por revisar', icono: 'rule', color: '#d97706', titulo: '2. Lo que el concentrado detecta' },
  { n: 3, t: 'Concentrado', icono: 'table_chart', color: '#16a34a', titulo: '3. Concentrado por biológico y lote' },
  { n: 4, t: 'Informe', icono: 'summarize', color: '#7c3aed', titulo: '4. Informe del mes' }
];
const ORDEN_MUNICIPIOS_JUR = ['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM'];
const ETIQUETA_MUNI_JUR = {
  QUERETARO: 'Querétaro', CORREGIDORA: 'Corregidora', MARQUES: 'El Marqués', HUIMILPAN: 'Huimilpan',
  NHG: 'Nuevo Hospital General', HENM: 'Hospital del Niño y la Mujer'
};
const ES_HOSPITAL_JUR = { NHG: true, HENM: true };
const TEXTO_MOV = { CERRADO: 'Cerrado', EN_CORRECCION: 'En corrección', BORRADOR: 'En captura', SIN_MOVIMIENTO: 'Sin movimiento' };

function puedeEditar() {
  const rol = estado.perfil ? estado.perfil.rol : null;
  return !estado.perfil || rol === 'ADMIN' || rol === 'JURISDICCIONAL';
}
function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }
function escJ(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function nombreMesJ(m) { const x = MESES.find((k) => k.v === m); return x ? x.l : String(m); }
function etiquetaMuniJ(m) { return ETIQUETA_MUNI_JUR[m] || m; }
function sinSaltos(t) { return String(t || '').replace(/\s*\n\s*/g, ' ').trim(); }
function desdeArranquePorUnidad() {
  const { anio, mes } = seleccion();
  return `${anio}-${String(mes).padStart(2, '0')}-01` >= (estado.inicioPorUnidad || '2026-10-01');
}

// Misma regla que biovac_cuenta_para_jurisdiccion en la base: qué filas de
// biovac_unidades se suman en el concentrado de ese mes.
function cuentaParaJurisdiccion(u, anio, mes, todas) {
  const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const esPseudo = (x) => Boolean(x.clues && x.clues.startsWith('JS1-'));
  if (primerDia < (estado.inicioPorUnidad || '2026-10-01')) return esPseudo(u);
  return !esPseudo(u) || !todas.some((r) => r.municipio === u.municipio && !esPseudo(r) && r.activo);
}

// Cada aviso del servidor, dicho en claro: qué pasa, quién lo resuelve y qué hacer.
const INFO_VALIDACION = {
  EXISTENCIA_NEGATIVA: { titulo: 'Existencia negativa', icono: 'remove_circle', nivel: 'ERROR' },
  CADUCIDAD_INCONSISTENTE: { titulo: 'Caducidades distintas', icono: 'event_busy', nivel: 'ADVERTENCIA' },
  ARF_SIN_RESOLVER: { titulo: 'Lote en dictamen sin resolver', icono: 'hourglass_bottom', nivel: 'ADVERTENCIA' }
};

function filasDeLote(v) {
  const bio = sinSaltos(v.biologico);
  return estado.concentrado.filter((f) => sinSaltos(f.nombre_excel) === bio && String(f.numero_lote) === String(v.lote));
}
function municipiosDeNombres(texto) {
  const nombres = String(texto || '').split(',').map((x) => x.trim()).filter(Boolean);
  const munis = new Set();
  nombres.forEach((n) => { const u = (estado.unidadesCuentan || []).find((x) => x.nombre === n); if (u) munis.add(u.municipio); });
  return [...munis];
}
function suma(filas, campo) { return filas.reduce((a, f) => a + (Number(f[campo]) || 0), 0); }

function explicarValidacion(v) {
  const filas = filasDeLote(v);
  const munis = municipiosDeNombres(v.unidad).map(etiquetaMuniJ);
  const donde = munis.length ? ` en ${munis.join(' y ')}` : '';
  if (v.codigo === 'EXISTENCIA_NEGATIVA') {
    const neg = filas.filter((f) => Number(f.existencia_final_frascos) < 0);
    const total = redondearFrascos(suma(neg.length ? neg : filas, 'existencia_final_frascos'));
    return {
      que: `Se dieron de baja más frascos de los que había${donde}: la existencia final del lote queda en ${total}.`,
      quien: 'Lo resuelve la unidad o el municipio',
      hacer: 'Pide que revisen lo recibido o lo aplicado de ese lote. Si ya está confirmado, puedes corregirlo tú en el detalle del lote (queda con motivo y auditado).'
    };
  }
  if (v.codigo === 'CADUCIDAD_INCONSISTENTE') {
    const cads = [...new Set(filas.map((f) => formatMmmAa(f.caducidad)))];
    return {
      que: `El mismo lote aparece con caducidades diferentes${cads.length > 1 ? ` (${cads.join(' y ')})` : ''}${donde}.`,
      quien: 'Lo resuelve quien capturó la fecha mal',
      hacer: 'Confirma la fecha correcta en el empaque y pide que corrijan la que esté mal.'
    };
  }
  if (v.codigo === 'ARF_SIN_RESOLVER') {
    const f = filas.filter((x) => x.categoria === 'ARF' || x.categoria === 'CANJE');
    const total = redondearFrascos(suma(f.length ? f : filas, 'existencia_final_frascos'));
    return {
      que: `Este lote lleva 3 meses o más en dictamen (A.R.F. o canje) y todavía tiene ${total} frascos sin resolver${donde}.`,
      quien: 'Lo resuelve el municipio desde su Movimiento',
      hacer: 'Pídele que lo regrese a existencia normal o registre el canje. No necesitas corregir nada aquí.'
    };
  }
  return { que: v.mensaje || '', quien: '', hacer: '' };
}

function alertasDeLote(fila) {
  return estado.validaciones.filter((v) => v.codigo !== 'MOVIMIENTO_NO_CERRADO'
    && sinSaltos(v.biologico) === sinSaltos(fila.nombre_excel) && String(v.lote) === String(fila.numero_lote));
}

async function cargarConcentrado(opciones) {
  const { jurisdiccionId, anio, mes } = seleccion();
  if (!jurisdiccionId) return;
  estado.drilldownAbierto = null;
  estado.cargando = true;

  const [{ data: unidades, error: eU }, { data: validaciones, error: eV },
    { data: concentrado, error: eC }, { data: informes, error: eI }, { data: cfg }] = await Promise.all([
    estado.db.from('biovac_unidades').select('*').eq('jurisdiccion_id', jurisdiccionId).eq('activo', true).order('nombre'),
    estado.db.rpc('biovac_validar_concentrado', { p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes }),
    estado.db.rpc('biovac_concentrado_jurisdiccion', { p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes, p_incluir_borrador: true }),
    estado.db.from('biovac_informes_jurisdiccionales').select('*').eq('jurisdiccion_id', jurisdiccionId).eq('anio', anio).eq('mes', mes).order('generado_en', { ascending: false }),
    estado.db.from('sis_config').select('valor').eq('clave', 'inicio_captura_por_unidad').maybeSingle()
  ]);
  estado.cargando = false;
  if (eU || eV || eC || eI) { toast('Error: ' + (eU || eV || eC || eI).message, 'error'); return; }
  if (cfg && cfg.valor) estado.inicioPorUnidad = cfg.valor;

  const cuentan = (unidades || []).filter((u) => cuentaParaJurisdiccion(u, anio, mes, unidades));
  const { data: movimientos } = await estado.db.from('biovac_movimientos')
    .select('unidad_id, estado, fue_corregido').in('unidad_id', cuentan.map((u) => u.id)).eq('anio', anio).eq('mes', mes);
  estado.unidadesCuentan = cuentan;
  estado.unidadPorId = new Map(cuentan.map((u) => [u.id, u]));
  estado.movPorUnidad = new Map((movimientos || []).map((m) => [m.unidad_id, m]));
  estado.validaciones = validaciones || [];
  estado.informes = informes || [];
  estado.concentrado = concentrado || [];
  estado.sisFilas = [];
  // Avance del SINBA-SIS de las unidades: solo consulta (el concentrado sale del Movimiento).
  try {
    const { data: sis } = await estado.db.rpc('sis06p_resumen_seguimiento', { p_mes: mes, p_anio: anio });
    estado.sisFilas = sis || [];
  } catch (e) { /* sin permiso o sin datos: no estorba */ }

  document.getElementById('panelResultados').style.display = 'block';
  document.getElementById('dockJuris').style.display = 'flex';
  document.body.classList.add('con-dock');
  renderTodoJur();
  if (!(opciones && opciones.mantenerPaso)) activarPasoJur(estado.paso || 1, true);
}

// Resumen por municipio/hospital: una unidad "cerró" cuando su Movimiento está CERRADO;
// el municipio cierra cuando cierran todas las unidades que suman en él.
function gruposMunicipio() {
  const porMuni = new Map();
  (estado.unidadesCuentan || []).forEach((u) => { if (!porMuni.has(u.municipio)) porMuni.set(u.municipio, []); porMuni.get(u.municipio).push(u); });
  const orden = ORDEN_MUNICIPIOS_JUR.filter((m) => porMuni.has(m)).concat([...porMuni.keys()].filter((m) => !ORDEN_MUNICIPIOS_JUR.includes(m)));
  const est = (u) => (estado.movPorUnidad.get(u.id) || {}).estado || 'SIN_MOVIMIENTO';
  return orden.map((m) => {
    const unidades = porMuni.get(m);
    const cerradas = unidades.filter((u) => est(u) === 'CERRADO').length;
    return { muni: m, unidades, cerradas, completo: cerradas === unidades.length, est };
  });
}

function resumenJur() {
  const grupos = gruposMunicipio();
  const total = grupos.reduce((a, g) => a + g.unidades.length, 0);
  const cerradas = grupos.reduce((a, g) => a + g.cerradas, 0);
  const errores = estado.validaciones.filter((v) => v.severidad === 'ERROR').length;
  const avisos = estado.validaciones.filter((v) => v.codigo !== 'MOVIMIENTO_NO_CERRADO').length;
  const advertencias = avisos - errores;
  const lotes = new Set(estado.concentrado.map((f) => f.lote_id + '|' + f.categoria)).size;
  return {
    grupos, total, cerradas, errores, advertencias, avisos, lotes, informes: estado.informes.length,
    munis: grupos.length, munisCerrados: grupos.filter((g) => g.completo).length
  };
}

function estadoPasosJur() {
  const r = resumenJur();
  const cierreHecho = r.munis > 0 && r.munisCerrados === r.munis;
  const revisado = cierreHecho && r.avisos === 0;
  return [
    { hecho: cierreHecho, texto: r.munis ? `${r.munisCerrados} de ${r.munis} municipios y hospitales cerrados` : 'Sin unidades', pill: r.munis ? `${r.munisCerrados}/${r.munis}` : '', pillCls: cierreHecho ? 'ok' : '' },
    { hecho: revisado, alerta: r.errores > 0, texto: r.avisos ? plural(r.avisos, 'aviso por revisar', 'avisos por revisar') : (cierreHecho ? 'Nada por revisar' : 'Se completa cuando todos cierren'), pill: r.avisos ? String(r.avisos) : (revisado ? '✓' : ''), pillCls: r.avisos ? 'aviso' : (revisado ? 'ok' : '') },
    { hecho: revisado, texto: r.lotes ? `${plural(r.lotes, 'lote', 'lotes')} sumados` : 'Sin movimientos este mes', pill: r.lotes ? String(r.lotes) : '', pillCls: '' },
    { hecho: r.informes > 0, texto: r.informes ? `${plural(r.informes, 'informe generado', 'informes generados')}` : 'Aún sin generar', pill: r.informes ? '✓' : '', pillCls: r.informes ? 'ok' : '' }
  ];
}

function pintarRutaJur() {
  const cont = document.getElementById('rutaJuris');
  if (!cont) return;
  const ps = estadoPasosJur();
  cont.innerHTML = `
    <ol class="ruta-pasos">
      ${PASOS_JUR.map((p, i) => {
        const e = ps[i];
        const cls = e.hecho ? 'hecho' : (e.alerta ? 'alerta' : (estado.paso === p.n ? 'actual' : ''));
        return `<li class="ruta-paso ${cls}" data-jpaso="${p.n}" title="Ir al paso ${p.n}">
          <span class="ruta-num">${e.hecho ? '<span class="material-symbols-rounded">check</span>' : (e.alerta ? '<span class="material-symbols-rounded">priority_high</span>' : p.n)}</span>
          <span class="ruta-txt"><b>${p.t}</b><small>${escJ(e.texto)}</small></span>
        </li>`;
      }).join('')}
    </ol>
    <button type="button" class="ayuda-btn ruta-ayuda" data-ayuda="jur" title="Cómo funciona el concentrado jurisdiccional" aria-label="Cómo funciona el concentrado jurisdiccional"><span class="material-symbols-rounded">help</span></button>`;
  PASOS_JUR.forEach((p, i) => {
    const el = document.getElementById('pildoraJ' + p.n);
    if (!el) return;
    el.textContent = ps[i].pill;
    el.className = 'hoja-pildora' + (ps[i].pillCls ? ' ' + ps[i].pillCls : '');
  });
  const actual = ps[estado.paso - 1];
  document.getElementById('dockJTitulo').textContent = `Paso ${estado.paso} de 4 · ${PASOS_JUR[estado.paso - 1].t}`;
  document.getElementById('dockJDetalle').textContent = actual.texto;
  const r = resumenJur();
  document.getElementById('dockJPunto').className = 'dock-punto' + (actual.hecho ? ' validado' : (r.cerradas ? ' enviado' : ''));
  document.getElementById('btnSiguiente').style.display = estado.paso < 4 ? 'inline-flex' : 'none';
  document.getElementById('btnGenerarInforme').style.display = (estado.paso === 4 && puedeEditar()) ? 'inline-flex' : 'none';
}

function activarPasoJur(n, sinScroll) {
  estado.paso = n;
  document.querySelectorAll('#dockJTabs .hoja-tab').forEach((t) => t.classList.toggle('activo', Number(t.dataset.jpaso) === n));
  document.querySelectorAll('.paso-panel').forEach((p) => { p.style.display = p.id === 'panelPaso' + n ? 'block' : 'none'; });
  pintarRutaJur();
  if (!sinScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTodoJur() {
  renderCierre();
  renderValidaciones(estado.validaciones);
  renderChipsBioJur();
  pintarConcentrado();
  renderInforme();
  pintarRutaJur();
}

// ------------------------------------------------------------------ paso 1
function renderCierre() {
  const { anio, mes } = seleccion();
  const r = resumenJur();
  const conUnidades = desdeArranquePorUnidad();
  const sisPorClues = new Map((estado.sisFilas || []).map((f) => [f.clues, f]));
  const todos = r.munis > 0 && r.munisCerrados === r.munis;

  const cta = todos
    ? `<button type="button" class="btn-primario" data-jir="2"><span class="material-symbols-rounded">rule</span> Todos cerrados: ver lo que hay por revisar</button>`
    : `<span class="jur-espera"><span class="material-symbols-rounded">hourglass_top</span> El concentrado suma cada municipio en cuanto cierra; mientras tanto es provisional.</span>`;
  const pct = r.munis ? Math.round((r.munisCerrados / r.munis) * 100) : 0;
  document.getElementById('cierreResumen').innerHTML = `
    <div class="jur-avance">
      <div class="jur-avance-cab"><div><b>${nombreMesJ(mes)} ${anio}</b><small>${conUnidades
        ? 'Cada unidad cierra su Movimiento al enviar su SINBA-SIS; el municipio queda cerrado cuando cierran todas sus unidades.'
        : 'Antes del arranque por unidad, cada municipio y hospital cierra su propio Movimiento.'}</small></div><span class="jur-pct">${r.munisCerrados} de ${r.munis} cerrados</span></div>
      <div class="jur-barra"><i style="width:${pct}%"></i></div>
    </div>
    <div class="jur-acciones">${cta}</div>`;

  document.getElementById('estadoUnidades').innerHTML = r.grupos.map((g) => {
    const n = g.unidades.length;
    const pctM = n ? Math.round((g.cerradas / n) * 100) : 0;
    const esHosp = Boolean(ES_HOSPITAL_JUR[g.muni]);
    const txt = conUnidades
      ? (g.completo
        ? (n === 1 ? 'La unidad cerró su Movimiento' : `Las ${n} unidades cerraron su Movimiento`)
        : (n === 1 ? 'La unidad aún no cierra su Movimiento' : `${g.cerradas} de ${n} unidades cerraron su Movimiento`))
      : (g.completo ? 'Movimiento cerrado' : `Movimiento ${String(TEXTO_MOV[g.est(g.unidades[0])]).toLowerCase()}`);
    let sis = '', accion = '';
    if (conUnidades) {
      const filas = g.unidades.map((u) => sisPorClues.get(u.clues)).filter(Boolean);
      if (filas.length) {
        const v = filas.filter((f) => f.estado === 'VALIDADO').length;
        const e = filas.filter((f) => f.estado === 'ENVIADO').length;
        sis = `SINBA-SIS (consulta): ${v} validados · ${e} por validar · ${filas.length - v - e} sin enviar`;
        if (esHosp && e > 0 && puedeEditar()) accion = `<a class="btn-secundario btn-mini" href="biovac.html" style="text-decoration:none;"><span class="material-symbols-rounded">fact_check</span> Revisar y validar su SINBA-SIS (${e})</a>`;
      }
    }
    return `<div class="jur-muni ${g.completo ? 'completo' : ''}">
      <div class="jur-muni-cab">
        <span class="jur-muni-icono"><span class="material-symbols-rounded">${esHosp ? 'local_hospital' : 'location_city'}</span></span>
        <div class="jur-muni-tit"><b>${escJ(etiquetaMuniJ(g.muni))}</b><small>${escJ(txt)}</small></div>
        <span class="jur-estado ${g.completo ? 'ok' : ''}">${g.completo ? '<span class="material-symbols-rounded">check_circle</span> Cerrado' : 'En proceso'}</span>
      </div>
      <div class="jur-barra jur-barra-fina"><i style="width:${pctM}%"></i></div>
      ${sis ? `<p class="jur-sis">${escJ(sis)}</p>` : ''}
      ${accion ? `<div class="jur-muni-accion">${accion}</div>` : ''}
      ${n > 1 || !g.completo ? `<details class="jur-detalle">
        <summary>Ver unidades (consulta)</summary>
        <table><tbody>${g.unidades.map((u) => {
          const mov = estado.movPorUnidad.get(u.id);
          const e = mov ? mov.estado : 'SIN_MOVIMIENTO';
          return `<tr><td>${escJ(u.nombre)}</td><td><span class="estado-badge estado-${e}">${TEXTO_MOV[e]}</span>${mov && mov.fue_corregido ? ' <span class="corregido"><span class="material-symbols-rounded">warning</span> corregido</span>' : ''}</td>
            <td>${mov ? `<button type="button" class="btn-icono" data-action="ver-pdf-unidad" data-unidad="${u.id}" data-anio="${anio}" data-mes="${mes}" title="Ver PDF de ${escJ(u.nombre)}"><span class="material-symbols-rounded">picture_as_pdf</span></button>` : ''}</td></tr>`;
        }).join('')}</tbody></table>
      </details>` : ''}
    </div>`;
  }).join('') || '<div class="jur-vacio">No hay unidades que cuenten para el concentrado de este mes.</div>';
}

// ------------------------------------------------------------------ paso 2
function renderValidaciones(validaciones) {
  const cont = document.getElementById('listaValidaciones');
  const lista = (validaciones || []).filter((v) => v.codigo !== 'MOVIMIENTO_NO_CERRADO');
  const sinCerrar = (validaciones || []).filter((v) => v.codigo === 'MOVIMIENTO_NO_CERRADO');
  const errores = lista.filter((v) => v.severidad === 'ERROR').length;

  let cabecera;
  if (!lista.length) {
    cabecera = '<p class="sin-validaciones"><span class="material-symbols-rounded">check_circle</span> No hay nada por revisar: las cifras cuadran.</p>';
  } else {
    cabecera = `<p class="jur-val-resumen">Hay <b class="${errores ? 'err' : 'adv'}">${plural(lista.length, 'aviso', 'avisos')}</b>${errores ? ` (${plural(errores, 'error', 'errores')})` : ''}. Cada uno dice qué pasa, quién lo resuelve y qué hacer.</p>`;
  }

  const tarjetas = lista.map((v) => {
    const info = INFO_VALIDACION[v.codigo] || { titulo: v.codigo, icono: 'info' };
    const e = explicarValidacion(v);
    const munis = municipiosDeNombres(v.unidad).map(etiquetaMuniJ);
    return `<div class="validacion-grupo ${v.severidad}">
      <div class="validacion-cab">
        <span class="material-symbols-rounded">${info.icono}</span>
        <div>
          <b>${escJ(sinSaltos(v.biologico))} · lote ${escJ(v.lote)}</b>
          <small>${escJ(info.titulo)}${munis.length ? ' · ' + escJ(munis.join(', ')) : ''}</small>
        </div>
        <button type="button" class="btn-secundario btn-mini" data-action="ir-lote" data-biologico="${escJ(v.biologico)}" data-lote="${escJ(v.lote)}"><span class="material-symbols-rounded">manage_search</span> Ver el lote</button>
      </div>
      <dl class="jur-val-detalle">
        <div><dt>Qué pasa</dt><dd>${escJ(e.que)}</dd></div>
        <div><dt>Quién lo resuelve</dt><dd>${escJ(e.quien)}</dd></div>
        <div><dt>Qué hacer</dt><dd>${escJ(e.hacer)}</dd></div>
      </dl>
    </div>`;
  }).join('');

  // Las unidades que aún no cierran no son un error: solo dicen que el concentrado es provisional.
  let pendientes = '';
  if (sinCerrar.length) {
    const porMuni = new Map();
    sinCerrar.forEach((v) => {
      const u = (estado.unidadesCuentan || []).find((x) => x.nombre === v.unidad);
      const m = u ? u.municipio : '—';
      if (!porMuni.has(m)) porMuni.set(m, []);
      porMuni.get(m).push(v.unidad);
    });
    const resumen = [...porMuni.entries()].map(([m, l]) => `${etiquetaMuniJ(m)} ${l.length}`).join(' · ');
    pendientes = `<details class="jur-pendientes">
      <summary><span class="material-symbols-rounded">lock_open</span><b>${plural(sinCerrar.length, 'unidad sin cerrar', 'unidades sin cerrar')}</b> <small>${escJ(resumen)}</small></summary>
      <p>Mientras no cierren, el concentrado es provisional: se completa solo en cuanto cierren. Es solo consulta; cada municipio les da seguimiento.</p>
      ${[...porMuni.entries()].map(([m, l]) => `<div class="jur-pend-muni"><b>${escJ(etiquetaMuniJ(m))}</b><span>${l.map(escJ).join(' · ')}</span></div>`).join('')}
    </details>`;
  }
  cont.innerHTML = cabecera + tarjetas + pendientes;
}

// ------------------------------------------------------------------ paso 3
function alertasDeLotes() {
  const claves = new Set();
  estado.validaciones.filter((v) => v.codigo !== 'MOVIMIENTO_NO_CERRADO').forEach((v) => claves.add(`${sinSaltos(v.biologico)}|${v.lote}`));
  return claves;
}

function filasVisibles() {
  const alertas = alertasDeLotes();
  return estado.concentrado.filter((f) => {
    if (estado.filtroBio && f.biologico_id !== estado.filtroBio) return false;
    if (estado.soloAlertas) {
      const negativa = Number(f.existencia_final_frascos) < 0;
      const marcada = alertas.has(`${sinSaltos(f.nombre_excel)}|${f.numero_lote}`);
      if (!(negativa || marcada || f.es_provisional)) return false;
    }
    return true;
  });
}

function renderChipsBioJur() {
  const bios = [];
  estado.concentrado.forEach((f) => { if (!bios.some((b) => b.id === f.biologico_id)) bios.push({ id: f.biologico_id, nombre: sinSaltos(f.nombre_excel), clave: f.clave }); });
  const cont = document.getElementById('chipsBio');
  if (estado.filtroBio && !bios.some((b) => b.id === estado.filtroBio)) estado.filtroBio = '';
  const cortos = (n) => n.replace(/^VACUNA\s+/i, '');
  cont.innerHTML = bios.length ? `<button type="button" class="jur-chip ${estado.filtroBio ? '' : 'activo'}" data-filtro-bio="" style="--c:#0f172a">Todos</button>`
    + bios.map((b) => `<button type="button" class="jur-chip ${estado.filtroBio === b.id ? 'activo' : ''}" data-filtro-bio="${b.id}" style="--c:${colorDeBiologico(b.clave)}" title="${escJ(b.nombre)}"><i></i>${escJ(cortos(b.nombre))}</button>`).join('')
    + `<button type="button" class="jur-chip jur-chip-alertas ${estado.soloAlertas ? 'activo' : ''}" data-solo-alertas="1"><span class="material-symbols-rounded">warning</span>Solo con avisos</button>` : '';
}

function pintarConcentrado() {
  renderConcentrado(filasVisibles());
  const cont = document.getElementById('contenedorConcentrado');
  if (!filasVisibles().length && estado.concentrado.length) cont.innerHTML = '<p class="jur-vacio">Ningún lote con avisos en este filtro.</p>';
}

async function irALote(biologico, lote) {
  const nombre = sinSaltos(biologico);
  const fila = estado.concentrado.find((f) => sinSaltos(f.nombre_excel) === nombre && String(f.numero_lote) === String(lote));
  estado.soloAlertas = false;
  estado.filtroBio = fila ? fila.biologico_id : '';
  activarPasoJur(3, true);
  renderChipsBioJur();
  if (fila) {
    estado.drilldownAbierto = { loteId: fila.lote_id, categoria: fila.categoria };
    pintarConcentrado();
    await refrescarDrilldown();
    const el = document.getElementById('drilldownContenido');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    pintarConcentrado();
  }
}

// ------------------------------------------------------------------ paso 4
function renderInformes(informes) { renderInforme(informes); }

function renderInforme() {
  const r = resumenJur();
  const { anio, mes } = seleccion();
  const cerrado = r.munis > 0 && r.munisCerrados === r.munis;
  const fila = (ok, aviso, titulo, detalle) => `<li class="${ok ? 'ok' : (aviso ? 'aviso' : 'pend')}"><span class="material-symbols-rounded">${ok ? 'check_circle' : (aviso ? 'warning' : 'error')}</span><div><b>${titulo}</b><small>${detalle}</small></div></li>`;
  document.getElementById('checkInforme').innerHTML =
    fila(cerrado, false, 'Todos los municipios y hospitales cerrados', `${r.munisCerrados} de ${r.munis}${cerrado ? '' : ' — el informe solo suma lo que ya cerró'}`)
    + fila(r.errores === 0, false, 'Sin errores por atender', r.errores ? plural(r.errores, 'error por atender', 'errores por atender') : 'Nada que corregir')
    + fila(r.advertencias === 0, r.advertencias > 0, 'Sin otros avisos', r.advertencias ? `${plural(r.advertencias, 'aviso', 'avisos')} (no bloquean)` : 'Nada por revisar');
  document.getElementById('tituloInforme').textContent = `Informe de ${nombreMesJ(mes)} ${anio}`;

  const cont = document.getElementById('listaInformes');
  const informes = estado.informes || [];
  cont.innerHTML = informes.length ? informes.map((i) => `
    <div class="informe-fila">
      <span class="estado-badge estado-${i.estado}">${String(i.estado).replace(/_/g, ' ')}</span>
      generado por <b>${escJ(i.generado_por || '—')}</b> el ${new Date(i.generado_en).toLocaleString('es-MX')}
    </div>`).join('') : '<p style="color:var(--muted); font-size:12.5px; margin:0">Aún no se ha generado un informe de este mes.</p>';
}

async function generarInforme() {
  if (!puedeEditar()) return;
  const usuario = usuarioActual();
  if (!usuario) return;
  const { jurisdiccionId, anio, mes } = seleccion();
  const r = resumenJur();
  if (r.munis > 0 && r.munisCerrados < r.munis) {
    const seguir = await mostrarModal({
      titulo: 'Hay municipios sin cerrar',
      mensaje: `Faltan ${plural(r.munis - r.munisCerrados, 'municipio u hospital por cerrar', 'municipios u hospitales por cerrar')}. El informe es una foto del mes y solo suma los movimientos cerrados: lo que cierre después no entrará en él. ¿Generarlo de todos modos?`,
      textoAceptar: 'Generar de todos modos'
    });
    if (!seguir) return;
  }
  const { error } = await estado.db.rpc('biovac_generar_informe_jurisdiccional', {
    p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes, p_usuario: usuario
  });
  if (error) { toast('No se pudo generar: ' + error.message, 'error'); return; }
  toast('Informe generado.', 'ok');
  await cargarConcentrado({ mantenerPaso: true });
  pintarRutaJur();
}

// ---------------------------------------------------------------------------
// Tabla de concentrado
// ---------------------------------------------------------------------------

const COLS_CONCENTRADO = 9;

function renderConcentrado(filas) {
  const cont = document.getElementById('contenedorConcentrado');
  let html = '';
  let paginaActual = null, bloqueActualId = null, biologicoActualId = null;
  let filasBiologicoActual = [];

  const cerrarBiologico = () => {
    if (biologicoActualId === null) return;
    html += renderTotalBiologico(filasBiologicoActual) + `</tbody></table></div>`;
  };

  for (const f of filas) {
    if (f.pagina !== paginaActual) {
      cerrarBiologico();
      if (bloqueActualId !== null) html += `</div>`;
      html += `<div class="pagina-titulo">${f.pagina}</div>`;
      paginaActual = f.pagina; bloqueActualId = null; biologicoActualId = null;
    }
    if (f.bloque_id !== bloqueActualId) {
      cerrarBiologico();
      if (bloqueActualId !== null) html += `</div>`;
      html += `<div class="bloque">`;
      bloqueActualId = f.bloque_id; biologicoActualId = null;
    }
    if (f.biologico_id !== biologicoActualId) {
      cerrarBiologico();
      const color = colorDeBiologico(f.clave);
      html += `<div class="bloque-titulo">
        <div class="bio-icon" style="background: rgba(${hexToRgb(color)}, .13); color: ${color};"><span class="material-symbols-rounded">medication_liquid</span></div>
        <h2>${f.nombre_excel.replace(/\n/g, ' ')}</h2>
      </div>
      <div class="tabla-wrap">
      <table class="concentrado">
        <colgroup><col class="col-lote"><col class="col-caducidad"><col class="col-dato"><col class="col-dato"><col class="col-dato"><col class="col-dato"><col class="col-final"><col class="col-unidades"><col class="col-accion"></colgroup>
        <thead><tr>
          <th>Lote</th><th>Caducidad</th><th>Ant.</th><th>Recibido</th><th>Aplicadas</th><th>Desechadas</th>
          <th>Final</th><th>Cierre</th><th></th>
        </tr></thead><tbody>`;
      biologicoActualId = f.biologico_id;
      filasBiologicoActual = [];
    }
    filasBiologicoActual.push(f);
    html += renderFilaConcentrado(f);
  }
  cerrarBiologico();
  if (bloqueActualId !== null) html += `</div>`;
  cont.innerHTML = html || '<p>Sin movimientos capturados para este periodo.</p>';
}

// Total del biológico en toda la jurisdicción: suma todos sus lotes
// (NORMAL + A.R.F. + Canje) columna por columna -- no solo la existencia
// final -- igual que el renglón "Total" de la captura municipal y del
// Excel real.
function renderTotalBiologico(filas) {
  if (!filas.length) return '';
  const sumarCampo = (campo) => filas.reduce((acc, f) => acc + (Number(f[campo]) || 0), 0);
  const nombre = filas[0].nombre_excel.replace(/\n/g, ' ');
  const isSplit = filas[0].regla_especial === 'SPLIT_DOSE';
  const totalAplicadasA = sumarCampo('aplicadas_a');
  const totalAplicadasB = sumarCampo('aplicadas_b');
  const totalDesechadasA = sumarCampo('desechadas_a');
  const totalDesechadasB = sumarCampo('desechadas_b');
  const totalAplicadas = isSplit ? `${totalAplicadasA} / ${totalAplicadasB}` : totalAplicadasA;
  const totalDesechadas = isSplit ? `${totalDesechadasA} / ${totalDesechadasB}` : totalDesechadasA;
  const totalFinal = redondearFrascos(sumarCampo('existencia_final_frascos'));
  const algunProvisional = filas.some((f) => f.es_provisional);
  return `<tfoot><tr>
    <td colspan="2">Total ${nombre}${algunProvisional ? ' <span class="tag-provisional">Provisional</span>' : ''}</td>
    <td>${redondearFrascos(sumarCampo('existencia_anterior_frascos'))}</td>
    <td>${sumarCampo('recibido_frascos')}</td>
    <td>${totalAplicadas}</td>
    <td>${totalDesechadas}</td>
    <td><span class="valor-final">${totalFinal}</span></td>
    <td colspan="2"></td>
  </tr></tfoot>`;
}

function renderFilaConcentrado(f) {
  const negativa = Number(f.existencia_final_frascos) < 0;
  const incompleto = f.unidades_cerradas < f.unidades_reportando;
  const aplicadas = f.regla_especial === 'SPLIT_DOSE' ? `${f.aplicadas_a} / ${f.aplicadas_b}` : f.aplicadas_a;
  const desechadas = f.regla_especial === 'SPLIT_DOSE' ? `${f.desechadas_a} / ${f.desechadas_b}` : f.desechadas_a;
  const semaforo = semaforoCaducidad(f.caducidad);
  let html = `<tr class="${f.categoria === 'ARF' ? 'categoria-arf' : f.categoria === 'CANJE' ? 'categoria-canje' : ''}">
    <td>
      <div class="lote-texto">${f.numero_lote}</div>
      ${f.categoria !== 'NORMAL' ? `<span class="tag-${f.categoria.toLowerCase()}">${f.categoria}</span>` : ''}
      ${f.es_provisional ? `<span class="tag-provisional" title="Al menos un municipio todavía no cierra este mes -- el número puede cambiar">Provisional</span>` : ''}
    </td>
    <td><div class="caducidad-chip ${semaforo}"><span class="semaforo"></span>${formatMmmAa(f.caducidad)}</div></td>
    <td>${redondearFrascos(f.existencia_anterior_frascos)}</td>
    <td>${f.recibido_frascos}</td>
    <td>${aplicadas}</td>
    <td>${desechadas}</td>
    <td><span class="valor-final ${negativa ? 'existencia-negativa' : ''}">${redondearFrascos(f.existencia_final_frascos)}</span></td>
    <td class="unidades-reportando ${incompleto ? 'incompleto' : ''}">${f.unidades_cerradas} de ${f.unidades_reportando} cerraron</td>
    <td><button class="btn-mini btn-secundario" data-action="drilldown" data-lote="${f.lote_id}" data-categoria="${f.categoria}"><span class="material-symbols-rounded">manage_search</span> Ver por municipio</button></td>
  </tr>`;
  if (estado.drilldownAbierto && estado.drilldownAbierto.loteId === f.lote_id && estado.drilldownAbierto.categoria === f.categoria) {
    html += `<tr><td colspan="${COLS_CONCENTRADO}" style="padding:0; border-bottom:1px solid #f1f5f9;"><div class="drilldown" id="drilldownContenido">Cargando…</div></td></tr>`;
  }
  return html;
}

async function toggleDrilldown(loteId, categoria) {
  if (estado.drilldownAbierto && estado.drilldownAbierto.loteId === loteId && estado.drilldownAbierto.categoria === categoria) {
    estado.drilldownAbierto = null;
    pintarConcentrado();
    return;
  }
  estado.drilldownAbierto = { loteId, categoria };
  pintarConcentrado();
  await refrescarDrilldown();
}

async function refrescarDrilldown() {
  if (!estado.drilldownAbierto) return;
  const { loteId, categoria } = estado.drilldownAbierto;
  const { jurisdiccionId, anio, mes } = seleccion();
  const { data, error } = await estado.db.rpc('biovac_detalle_lote_jurisdiccion', {
    p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes, p_lote_id: loteId, p_categoria: categoria
  });
  const cont = document.getElementById('drilldownContenido');
  if (!cont) return;
  if (error) { cont.textContent = 'Error: ' + error.message; return; }
  const fila = estado.concentrado.find((f) => f.lote_id === loteId && f.categoria === categoria);
  cont.innerHTML = renderDetalleLote(data || [], fila, anio, mes);
}

function botonVerPdfUnidad(d, anio, mes) {
  return `<button class="btn-icono" data-action="ver-pdf-unidad" data-unidad="${d.unidad_id}" data-anio="${anio}" data-mes="${mes}" title="Ver PDF de ${escJ(d.unidad_nombre)}">
    <span class="material-symbols-rounded">picture_as_pdf</span></button>`;
}

// Detalle de un lote POR MUNICIPIO: cada municipio (u hospital) es la suma de las
// unidades que reportaron ese lote; las unidades quedan como consulta dentro de
// su municipio. Solo aparece quien de verdad reportó el lote.
function renderDetalleLote(data, filaLote, anio, mes) {
  const split = Boolean(filaLote && filaLote.regla_especial === 'SPLIT_DOSE');
  const reportaron = data.filter((d) => d.movimiento_id && d.renglon_id);
  const sinLote = data.filter((d) => !d.renglon_id).length;

  // Qué revisar en este lote, con la explicación de siempre.
  const alertas = filaLote ? alertasDeLote(filaLote) : [];
  const callout = alertas.length ? `<div class="jur-callout">${alertas.map((v) => {
    const e = explicarValidacion(v);
    return `<div class="jur-callout-item ${v.severidad}"><span class="material-symbols-rounded">${(INFO_VALIDACION[v.codigo] || {}).icono || 'info'}</span>
      <div><b>${escJ((INFO_VALIDACION[v.codigo] || {}).titulo || v.codigo)}</b><p>${escJ(e.que)}</p><p class="hacer"><b>${escJ(e.quien)}.</b> ${escJ(e.hacer)}</p></div></div>`;
  }).join('')}</div>` : '';

  const porMuni = new Map();
  reportaron.forEach((d) => {
    const u = estado.unidadPorId ? estado.unidadPorId.get(d.unidad_id) : null;
    const m = u ? u.municipio : '—';
    if (!porMuni.has(m)) porMuni.set(m, []);
    porMuni.get(m).push(d);
  });
  const orden = ORDEN_MUNICIPIOS_JUR.filter((m) => porMuni.has(m)).concat([...porMuni.keys()].filter((m) => !ORDEN_MUNICIPIOS_JUR.includes(m)));
  const num = (d, c) => Number(d[c]) || 0;
  const celdaAB = (a, b) => (split ? `${a} / ${b}` : String(a));

  const filas = orden.map((m) => {
    const ds = porMuni.get(m);
    if (ds.length === 1) return renderFilaDrilldown(ds[0], anio, mes, split, etiquetaMuniJ(m));
    const s = (c) => ds.reduce((a, d) => a + num(d, c), 0);
    const todasCerradas = ds.every((d) => d.movimiento_estado === 'CERRADO');
    const abierta = estado.munisAbiertas && estado.munisAbiertas.has(m);
    return `<tr class="muni-resumen">
        <td><b>${escJ(etiquetaMuniJ(m))}</b><small class="muni-sub">${plural(ds.length, 'unidad', 'unidades')}</small></td>
        <td><span class="estado-badge estado-${todasCerradas ? 'CERRADO' : 'BORRADOR'}">${todasCerradas ? 'Cerrado' : 'En captura'}</span></td>
        <td>${redondearFrascos(s('existencia_anterior_frascos'))}</td>
        <td>${s('recibido_frascos')}</td>
        <td>${celdaAB(s('aplicadas_a'), s('aplicadas_b'))}</td>
        <td>${celdaAB(s('desechadas_a'), s('desechadas_b'))}</td>
        <td class="existencia-final"><b>${redondearFrascos(s('existencia_final_frascos'))}</b></td>
        <td></td>
        <td><button type="button" class="btn-mini btn-secundario" data-action="toggle-unidades" data-muni="${escJ(m)}"><span class="material-symbols-rounded">${abierta ? 'expand_less' : 'expand_more'}</span> ${abierta ? 'Ocultar' : 'Ver'} unidades</button></td>
      </tr>
      ${ds.map((d) => renderFilaDrilldown(d, anio, mes, split, null, m, abierta)).join('')}`;
  }).join('');

  return `${callout}
    <p class="jur-drill-nota">Cada renglón es un municipio u hospital: la suma de las unidades que reportaron este lote.</p>
    <table class="jur-drill"><thead><tr>
      <th>Municipio</th><th>Estado</th><th>Ant.</th><th>Recibido</th><th>${split ? 'Aplicadas (A / B)' : 'Aplicadas'}</th><th>${split ? 'Desechadas (A / B)' : 'Desechadas'}</th><th>Final</th><th>Observaciones</th><th></th>
    </tr></thead><tbody>${filas || '<tr><td colspan="9" style="color:var(--muted)">Ninguna unidad reportó este lote este mes.</td></tr>'}</tbody></table>
    ${sinLote ? `<p class="jur-drill-nota">${plural(sinLote, 'unidad no reportó', 'unidades no reportaron')} este lote (es normal si nunca lo recibieron).</p>` : ''}`;
}

// Una fila del detalle. Con `etiqueta` (municipio con una sola unidad) se muestra el
// municipio; con `subDe` es una unidad dentro de un municipio con varias (oculta hasta abrirlo).
function renderFilaDrilldown(d, anio, mes, split, etiqueta, subDe, visible) {
  const enCorreccion = d.movimiento_estado === 'EN_CORRECCION';
  const cerrado = d.movimiento_estado === 'CERRADO';
  const campo = (campoNombre, valor) => enCorreccion
    ? `<input type="number" step="any" data-corr-renglon="${d.renglon_id}" data-corr-campo="${campoNombre}" data-corr-movimiento="${d.movimiento_id}" value="${valor || 0}">`
    : (valor || 0);
  const celdaAB = (cA, vA, cB, vB) => (split ? `${campo(cA, vA)} / ${campo(cB, vB)}` : campo(cA, vA));
  const nombre = etiqueta ? `<b>${escJ(etiqueta)}</b>` : (subDe ? `<span class="unidad-sub">${escJ(d.unidad_nombre)}</span>` : `<b>${escJ(d.unidad_nombre)}</b>`);
  return `<tr data-fila-renglon="${d.renglon_id}" ${subDe ? `data-sub="${escJ(subDe)}" style="display:${visible ? 'table-row' : 'none'};"` : ''} class="${subDe ? 'sub-fila' : ''}">
    <td>${nombre}</td>
    <td><span class="estado-badge estado-${d.movimiento_estado}">${String(d.movimiento_estado).replace('_', ' ')}</span></td>
    <td>${redondearFrascos(d.existencia_anterior_frascos)}</td>
    <td>${campo('recibido_frascos', d.recibido_frascos)}</td>
    <td>${celdaAB('aplicadas_a', d.aplicadas_a, 'aplicadas_b', d.aplicadas_b)}</td>
    <td>${celdaAB('desechadas_a', d.desechadas_a, 'desechadas_b', d.desechadas_b)}</td>
    <td class="existencia-final" data-drill-final="${d.renglon_id}">${redondearFrascos(d.existencia_final_frascos)}</td>
    <td>${enCorreccion ? `<input type="text" data-corr-renglon="${d.renglon_id}" data-corr-campo="observaciones" data-corr-movimiento="${d.movimiento_id}" value="${(d.observaciones || '').replace(/"/g, '&quot;')}">` : escJ(d.observaciones || '')}</td>
    <td>
      ${botonVerPdfUnidad(d, anio, mes)}
      ${cerrado && puedeEditar() ? `<button class="btn-mini btn-secundario" data-action="abrir-correccion-mov" data-movimiento="${d.movimiento_id}" title="Uso excepcional: reabre este renglón para corregirlo, con motivo"><span class="material-symbols-rounded">edit</span> Corregir</button>` : ''}
      ${enCorreccion ? `<button class="btn-mini btn-primario" data-action="aplicar-correccion-mov" data-movimiento="${d.movimiento_id}"><span class="material-symbols-rounded">check_circle</span> Guardar</button>` : ''}
    </td>
  </tr>`;
}

async function abrirCorreccionMovimiento(movimientoId) {
  const usuario = usuarioActual();
  if (!usuario) return;
  const motivo = await mostrarModal({
    titulo: 'Corrección jurisdiccional',
    mensaje: 'Vas a editar directamente el renglón de este municipio. Escribe el motivo; queda en su auditoría.',
    pedirMotivo: true, placeholderMotivo: 'Ej. Ajuste tras validar con la unidad', textoAceptar: 'Reabrir'
  });
  if (!motivo) return;
  const { data, error } = await estado.db.rpc('biovac_abrir_correccion', {
    p_movimiento_id: movimientoId, p_usuario: usuario, p_rol: (estado.perfil ? estado.perfil.rol : 'JURISDICCIONAL'), p_motivo: motivo, p_tipo: 'CORRECCION_JURISDICCIONAL'
  });
  if (error) { toast('No se pudo abrir corrección: ' + error.message, 'error'); return; }
  estado.correccionesAbiertas[movimientoId] = data;
  toast('Renglón municipal reabierto. Edita y pulsa "Guardar".', 'ok');
  await refrescarDrilldown();
}

async function aplicarCorreccionMovimiento(movimientoId) {
  const usuario = usuarioActual();
  if (!usuario) return;
  const ok = await mostrarModal({
    titulo: 'Guardar corrección',
    mensaje: 'Se recalculará este mes y se propagará en cascada a los meses siguientes del municipio.',
    textoAceptar: 'Guardar corrección'
  });
  if (!ok) return;
  const { data, error } = await estado.db.rpc('biovac_aplicar_correccion', {
    p_movimiento_id: movimientoId, p_usuario: usuario, p_cascade_batch_id: estado.correccionesAbiertas[movimientoId] || null
  });
  if (error) { toast('No se pudo aplicar: ' + error.message, 'error'); return; }
  delete estado.correccionesAbiertas[movimientoId];
  toast(`Corrección aplicada. Meses recalculados en el municipio: ${data}.`, 'ok');
  const drilldownPrevio = estado.drilldownAbierto;
  await cargarConcentrado();
  if (drilldownPrevio) {
    estado.drilldownAbierto = drilldownPrevio;
    pintarConcentrado();
    await refrescarDrilldown();
  }
}

function recalcularFilaDrilldownEnVivo(renglonId) {
  // Preview simplificado: no conocemos aquí la presentación exacta sin otra
  // consulta, así que el valor autoritativo sigue viniendo del guardado en
  // biovac_renglones (autocálculo del trigger); esta función solo evita que
  // la celda quede desactualizada visualmente hasta el siguiente guardado.
}

// El batch normalmente ya se conoce en memoria (se guardó al reabrir la
// corrección en esta misma sesión) -- pero si la página se recargó con el
// mes todavía EN_CORRECCION (abierto antes, o por otra sesión), se recupera
// consultando la fila "marcador" de biovac_abrir_correccion para ese
// movimiento, así el motivo original sigue heredándose en cada campo.
async function obtenerBatchAbierto(movimientoId) {
  if (estado.correccionesAbiertas[movimientoId]) return estado.correccionesAbiertas[movimientoId];
  const { data } = await estado.db.from('biovac_correcciones')
    .select('cascade_batch_id').eq('movimiento_id', movimientoId).eq('tipo', 'CORRECCION_JURISDICCIONAL')
    .is('campo', null).order('creado_en', { ascending: false }).limit(1).maybeSingle();
  if (data?.cascade_batch_id) estado.correccionesAbiertas[movimientoId] = data.cascade_batch_id;
  return data?.cascade_batch_id || null;
}

// Cada campo editado en el drill-down queda auditado por separado (a
// diferencia de la captura municipal normal, que no necesita esto porque
// ahí el propio dueño del dato lo está tecleando) -- así la unidad afectada
// puede ver exactamente qué cambió cuando reconozca la alerta.
async function guardarCampoDrilldown(input) {
  const usuario = usuarioActual();
  if (!usuario) return;
  const renglonId = input.dataset.corrRenglon;
  const campo = input.dataset.corrCampo;
  const movimientoId = input.dataset.corrMovimiento;
  const batchId = await obtenerBatchAbierto(movimientoId);
  const { data: final, error } = await estado.db.rpc('biovac_guardar_campo_correccion_jurisdiccional', {
    p_renglon_id: renglonId, p_campo: campo, p_valor: String(input.value ?? ''),
    p_usuario: usuario, p_rol: (estado.perfil ? estado.perfil.rol : 'JURISDICCIONAL'), p_cascade_batch_id: batchId
  });
  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  const celda = document.querySelector(`[data-drill-final="${renglonId}"]`);
  if (celda) celda.textContent = redondearFrascos(final);
}

// ---------------------------------------------------------------------------
// Exportación jurisdiccional (Excel/PDF) -- mismo motor de plantilla que la
// exportación municipal (biovac_export_excel.js), alimentado por el
// concentrado en vivo de los 4 municipios en vez de un solo movimiento.
// ---------------------------------------------------------------------------

async function exportarExcelJurisdiccional() {
  const btn = document.getElementById('btnExportarExcelJurisdiccional');
  const { jurisdiccionId, anio, mes } = seleccion();
  if (!jurisdiccionId) { toast('Selecciona jurisdicción, año y mes.', 'error'); return; }
  const jurisdiccion = estado.jurisdicciones.find((j) => j.id === jurisdiccionId);
  const usuario = usuarioActual();
  if (!usuario) return;
  const htmlOriginal = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span>';
  try {
    const resp = await fetch('biovac_plantilla.xlsx');
    const plantillaBuffer = await resp.arrayBuffer();
    const buffer = await BiovacExportExcel.exportarExcelJurisdiccional({
      db: estado.db, jurisdiccion, anio, mes, responsable: usuario, plantillaBuffer
    });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Movimiento_Biologico_Jurisdiccional_${anio}-${String(mes).padStart(2, '0')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Excel jurisdiccional generado.', 'ok');
  } catch (e) {
    toast('No se pudo exportar: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = htmlOriginal;
  }
}

function verPdfJurisdiccional() {
  const { jurisdiccionId, anio, mes } = seleccion();
  if (!jurisdiccionId) { toast('Selecciona jurisdicción, año y mes.', 'error'); return; }
  window.open(`biovac_print.html?jurisdiccion=${jurisdiccionId}&anio=${anio}&mes=${mes}`, '_blank');
}

// ---------------------------------------------------------------------------
// Arranque y delegación de eventos
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  initDb();
  await cargarSesionReal();
  await cargarInicial();
  // Sin jurisdicciones que elegir ni usuario que teclear, esos campos solo estorban.
  const ocultarCampo = (id) => { const c = document.getElementById(id).closest('.campo'); if (c) c.style.display = 'none'; };
  if (estado.jurisdicciones.length <= 1) ocultarCampo('selJurisdiccion');
  if (estado.perfil) ocultarCampo('selUsuario');
  if (!puedeEditar()) document.getElementById('btnGenerarInforme').style.display = 'none';

  const recargar = () => cargarConcentrado({ mantenerPaso: true });
  document.getElementById('btnCargar').addEventListener('click', recargar);
  ['selJurisdiccion', 'selAnio', 'selMes'].forEach((id) => document.getElementById(id).addEventListener('change', recargar));
  document.getElementById('btnGenerarInforme').addEventListener('click', generarInforme);
  document.getElementById('btnExportarExcelJurisdiccional').addEventListener('click', exportarExcelJurisdiccional);
  document.getElementById('btnVerPdfJurisdiccional').addEventListener('click', verPdfJurisdiccional);
  document.getElementById('btnSiguiente').addEventListener('click', () => activarPasoJur(Math.min(4, estado.paso + 1)));
  if (window.DockGlass) window.DockGlass.instalar(document.getElementById('dockJTabs'));

  document.addEventListener('click', (ev) => {
    const paso = ev.target.closest('[data-jpaso]');
    if (paso) { activarPasoJur(Number(paso.dataset.jpaso)); return; }
    const ir = ev.target.closest('[data-jir]');
    if (ir) { activarPasoJur(Number(ir.dataset.jir)); return; }
    const filtro = ev.target.closest('[data-filtro-bio]');
    if (filtro) { estado.filtroBio = filtro.dataset.filtroBio; estado.drilldownAbierto = null; renderChipsBioJur(); pintarConcentrado(); return; }
    if (ev.target.closest('[data-solo-alertas]')) { estado.soloAlertas = !estado.soloAlertas; estado.drilldownAbierto = null; renderChipsBioJur(); pintarConcentrado(); return; }
    const lote = ev.target.closest('[data-action="ir-lote"]');
    if (lote) { irALote(lote.dataset.biologico, lote.dataset.lote); return; }
    const pdf = ev.target.closest('[data-action="ver-pdf-unidad"]');
    if (pdf) window.open(`biovac_print.html?unidad=${pdf.dataset.unidad}&anio=${pdf.dataset.anio}&mes=${pdf.dataset.mes}`, '_blank');
  });

  const cont = document.getElementById('contenedorConcentrado');
  cont.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'drilldown') toggleDrilldown(btn.dataset.lote, btn.dataset.categoria);
    if (btn.dataset.action === 'toggle-unidades') {
      const m = btn.dataset.muni;
      const abrir = !estado.munisAbiertas.has(m);
      if (abrir) estado.munisAbiertas.add(m); else estado.munisAbiertas.delete(m);
      cont.querySelectorAll(`tr[data-sub="${CSS.escape(m)}"]`).forEach((tr) => { tr.style.display = abrir ? 'table-row' : 'none'; });
      btn.innerHTML = `<span class="material-symbols-rounded">${abrir ? 'expand_less' : 'expand_more'}</span> ${abrir ? 'Ocultar' : 'Ver'} unidades`;
    }
    if (btn.dataset.action === 'abrir-correccion-mov') abrirCorreccionMovimiento(btn.dataset.movimiento);
    if (btn.dataset.action === 'aplicar-correccion-mov') aplicarCorreccionMovimiento(btn.dataset.movimiento);
    if (btn.dataset.action === 'ver-pdf-unidad') window.open(`biovac_print.html?unidad=${btn.dataset.unidad}&anio=${btn.dataset.anio}&mes=${btn.dataset.mes}`, '_blank');
  });
  cont.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-corr-renglon][data-corr-campo]')) guardarCampoDrilldown(ev.target);
  });

  await cargarConcentrado();
});
