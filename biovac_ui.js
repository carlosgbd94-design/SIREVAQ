// ============================================================================
// BioVac — UI de captura mensual
//
// Cliente Supabase propio (mismo proyecto/anon key que ya es público en
// main.js), pero al estar en el mismo origen que la página real, si el
// usuario ya inició sesión ahí, supabase-js recupera esa MISMA sesión
// persistida en localStorage automáticamente -- por eso basta con
// intentar cargar la sesión al arrancar (cargarSesionReal) para saber
// quién es el capturista real, sin pedirle que teclee su nombre. Si no
// hay sesión (uso standalone/pruebas), se cae al campo de texto libre.
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' }, { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' }, { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' }, { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' }
];
const MESES_ABREV3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Mismos colores oficiales por biológico que ya usa el resto de SIREVAQ
// (window.BIOLOGICO_COLORS / getBiologicoColor en main.js) -- aquí mapeados
// por `clave` del catálogo de BioVac, que es la llave estable (nombre_excel
// trae saltos de línea / signos que no calzan con el matching por texto).
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

// Catálogo central de lotes (tabla "lotes", ya existente en el resto de
// SIREVAQ -- panel "Carga de lotes por municipio") -- desde la fase de
// integración con ARF/Canje, es la ÚNICA fuente de números de lote dentro de
// BioVac: el número de lote se selecciona de una lista desplegable en vez de
// teclearse a mano, así que ya no hace falta ningún mecanismo de detección
// de errores de dedo (el que había aquí antes comparaba contra el propio
// histórico de BioVac vía Levenshtein y generaba falsos positivos entre
// lotes genuinamente distintos que solo comparten un par de caracteres).
// Solo los lotes con tipo NORMAL se ofrecen para resolver un canje (el lote
// nuevo recibido siempre entra como existencia normal); los de tipo ARF o
// CANJE se ofrecen al agregar un lote nuevo cuyo Estatus sea ese mismo.
const CLAVE_A_EXISTENCIA_BIOLOGICO = {
  BCG: ['BCG'], DPT: ['DPT'], HEPA: ['HEPATITIS A'], HEPB: ['HEPATITIS B'],
  HEXAVALENTE: ['HEXAVALENTE'], ANTIINFLUENZA: ['INFLUENZA'],
  NEUMO_13V: ['NEUMOCOCICA 13', 'NEUMOCÓCICA 13'], NEUMO_20V: ['NEUMOCOCICA 20', 'NEUMOCÓCICA 20'],
  ROTAVIRUS: ['ROTAVIRUS'], SR: ['SR'], SRP: ['SRP'], TD: ['TD'], TDPA: ['TDPA'],
  VARICELA: ['VARICELA'], VPH: ['VPH'], VSR: ['VSR']
};

// El catálogo central nombra a los 4 municipios distinto de como los nombra
// BioVac (con/sin acentos, con/sin "EL ") -- mapeo explícito en vez de
// normalización difusa, porque son solo 4 y así un municipio nuevo mal
// escrito en cualquiera de los dos lados falla visiblemente (lista vacía)
// en vez de emparejar con el equivocado.
const MUNICIPIO_BIOVAC_A_LOTES = {
  QUERETARO: 'QUERÉTARO', CORREGIDORA: 'CORREGIDORA', MARQUES: 'EL MARQUÉS', HUIMILPAN: 'HUIMILPAN'
};

// perfiles.usuario guarda un nombre corto de login (ej. "CARLOS_BECERRA"),
// no el nombre completo real -- este mapa es solo de despliegue dentro de
// BioVac (no toca la tabla perfiles, compartida con el resto de SIREVAQ),
// para que "responsable de elaboración" muestre el nombre completo.
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
  bloques: [],
  biologicos: [],
  unidades: [],
  movimiento: null,
  renglones: [],
  correccionBatchId: null,
  catalogoLotesCentral: {}
};

function initDb() {
  estado.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function cargarSesionReal() {
  const { data: { session } } = await estado.db.auth.getSession();
  if (!session) return;
  const { data: perfil } = await estado.db.from('perfiles').select('id, usuario, rol, municipio_asignado, municipios_allowed').eq('id', session.user.id).maybeSingle();
  if (!perfil) return;
  estado.perfil = perfil;
  const nombreCompleto = nombreCompletoDePerfil(perfil);
  const inp = document.getElementById('selUsuario');
  inp.value = nombreCompleto;
  inp.readOnly = true;
  const aviso = document.getElementById('avisoUsuario');
  aviso.classList.add('aviso-ok');
  aviso.innerHTML = `<span class="material-symbols-rounded">verified_user</span> Sesión real: ${nombreCompleto} (${perfil.rol}).`;
}

function usuarioActual() {
  if (estado.perfil) return nombreCompletoDePerfil(estado.perfil);
  const v = document.getElementById('selUsuario').value.trim();
  if (!v) {
    toast('Ingresa tu nombre en "Usuario / capturista" antes de continuar.', 'error');
    return null;
  }
  localStorage.setItem('biovac_usuario', v);
  return v;
}

function toast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, 4500);
}

// Reemplaza confirm()/prompt() nativos del navegador por un modal propio.
// Sin pedirMotivo: resuelve true (Aceptar) / false (Cancelar o Escape).
// Con pedirMotivo: resuelve el texto escrito (no vacío) / null si se cancela.
function mostrarModal({ titulo, mensaje, pedirMotivo = false, placeholderMotivo = '', textoAceptar = 'Aceptar', peligro = false }) {
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
    btnAceptar.className = peligro ? 'btn-peligro' : 'btn-primario';

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

function fechaVigenciaRef(anio, mes) {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

function biologicoVigente(b, anio, mes) {
  const ref = fechaVigenciaRef(anio, mes);
  const desde = new Date(b.vigente_desde + 'T00:00:00Z');
  const hasta = b.vigente_hasta ? new Date(b.vigente_hasta + 'T00:00:00Z') : null;
  return ref >= desde && (!hasta || ref <= hasta);
}

// Igual que formatToMmmAa() en main.js -- mismo formato ya usado en el
// resto de SIREVAQ para caducidades ("JUL-29").
function formatMmmAa(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return `${MESES_ABREV3[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function ultimoDiaMes(anio, mes) {
  const dia = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Convierte teclear solo números (DDMMAA de 6 dígitos, o MMAA de 4 -- se
// asume día = último día del mes cuando no se captura) a fecha ISO. Acepta
// separadores (-, /, espacios) porque se descartan antes de interpretar.
function parsearCaducidadInteligente(texto) {
  const t = String(texto || '').trim();
  // ya viene formateado como "JUL-29" (p.ej. si el usuario no vuelve a
  // tocar el campo después del blur) -- se interpreta directo.
  const mMmmAa = t.match(/^([A-ZÑ]{3})-(\d{2})$/i);
  if (mMmmAa) {
    const idx = MESES_ABREV3.indexOf(mMmmAa[1].toUpperCase());
    if (idx === -1) return null;
    const anioCompleto = 2000 + Number(mMmmAa[2]);
    return ultimoDiaMes(anioCompleto, idx + 1);
  }
  // Si hay separadores (-, /, espacio), se interpreta por partes -- esto
  // permite mes/día de 1 O 2 dígitos ("7-27" == "07-27"), no solo bloques
  // de longitud fija. Sin separadores, se interpreta por longitud total
  // (260729 = DDMMAA, 0729 = MMAA, 26072029... = DDMMAAAA).
  const partes = t.split(/[^0-9]+/).filter(Boolean);
  let dd = null, mm, yy;
  if (partes.length === 3) {
    [dd, mm, yy] = partes;
  } else if (partes.length === 2) {
    [mm, yy] = partes;
  } else if (partes.length === 1) {
    const digitos = partes[0];
    if (digitos.length === 6) { dd = digitos.slice(0, 2); mm = digitos.slice(2, 4); yy = digitos.slice(4, 6); }
    else if (digitos.length === 4) { mm = digitos.slice(0, 2); yy = digitos.slice(2, 4); }
    else if (digitos.length === 8) { dd = digitos.slice(0, 2); mm = digitos.slice(2, 4); yy = digitos.slice(6, 8); }
    else return null;
  } else return null;

  if (yy.length > 2) yy = yy.slice(-2);
  const mesNum = Number(mm);
  if (!mesNum || mesNum < 1 || mesNum > 12) return null;
  const anioCompleto = 2000 + Number(yy);
  const ultimoDiaDelMes = new Date(anioCompleto, mesNum, 0).getDate();
  let diaNum = dd ? Number(dd) : ultimoDiaDelMes;
  if (!diaNum || diaNum < 1 || diaNum > ultimoDiaDelMes) diaNum = ultimoDiaDelMes;
  return `${anioCompleto}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Carga inicial: catálogo + unidades + selects de año/mes
// ---------------------------------------------------------------------------

async function cargarCatalogo() {
  const [{ data: bloques, error: e1 }, { data: biologicos, error: e2 }, { data: unidades, error: e3 }] = await Promise.all([
    estado.db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden'),
    estado.db.from('biovac_catalogo_biologicos').select('*').order('orden_en_bloque'),
    estado.db.from('biovac_unidades').select('*').eq('activo', true).order('nombre')
  ]);
  if (e1 || e2 || e3) { toast('Error cargando catálogo: ' + (e1 || e2 || e3).message, 'error'); return; }
  estado.bloques = bloques;
  estado.biologicos = biologicos;
  // RLS ya filtra qué unidades puede ver este perfil (MUNICIPAL solo las
  // suyas); si no hay sesión real (uso standalone), unidades trae las 4.
  estado.unidades = unidades;

  const selUnidad = document.getElementById('selUnidad');
  selUnidad.innerHTML = unidades.map((u) => `<option value="${u.id}">${u.nombre} (${u.municipio})</option>`).join('');

  const selAnio = document.getElementById('selAnio');
  const anioActual = new Date().getFullYear();
  const anios = [];
  for (let a = anioActual - 1; a <= anioActual + 1; a++) anios.push(a);
  selAnio.innerHTML = anios.map((a) => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');

  const selMes = document.getElementById('selMes');
  const mesActual = new Date().getMonth() + 1;
  selMes.innerHTML = MESES.map((m) => `<option value="${m.v}" ${m.v === mesActual ? 'selected' : ''}>${m.l}</option>`).join('');

  if (!estado.perfil) {
    const usuarioGuardado = localStorage.getItem('biovac_usuario');
    if (usuarioGuardado) document.getElementById('selUsuario').value = usuarioGuardado;
    document.getElementById('avisoUsuario').innerHTML =
      '<span class="material-symbols-rounded">info</span> Sin sesión de SIREVAQ detectada: escribe tu nombre arriba para la auditoría.';
  }
}

// ---------------------------------------------------------------------------
// Cargar / renderizar movimiento
// ---------------------------------------------------------------------------

async function cargarMovimiento() {
  const unidadId = document.getElementById('selUnidad').value;
  const anio = Number(document.getElementById('selAnio').value);
  const mes = Number(document.getElementById('selMes').value);
  if (!unidadId) return;

  const { data: movimiento, error } = await estado.db.from('biovac_movimientos')
    .select('*').eq('unidad_id', unidadId).eq('anio', anio).eq('mes', mes).maybeSingle();
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  if (!movimiento) {
    estado.movimiento = null;
    document.getElementById('panelMovimiento').style.display = 'none';
    document.getElementById('filaCabeceraMovimiento').style.display = 'none';
    document.getElementById('filaBotonesCabecera').style.display = 'none';
    document.getElementById('panelSinMovimiento').style.display = 'block';
    return;
  }
  document.getElementById('panelSinMovimiento').style.display = 'none';

  estado.movimiento = movimiento;
  await cargarRenglones();
  render();
}

async function cargarRenglones() {
  const { data, error } = await estado.db.from('biovac_renglones')
    .select(`id, categoria, existencia_anterior_frascos, recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b, existencia_final_frascos, observaciones,
      biovac_lotes ( id, numero_lote, caducidad, dosis_por_frasco_override, biologico_id,
        biovac_catalogo_biologicos ( id, clave, nombre_excel, bloque_id, presentacion, dosis_por_frasco, regla_especial ) )`)
    .eq('movimiento_id', estado.movimiento.id);
  if (error) { toast('Error cargando renglones: ' + error.message, 'error'); return; }
  estado.renglones = data;
}

async function crearMovimiento() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const unidadId = document.getElementById('selUnidad').value;
  const anio = Number(document.getElementById('selAnio').value);
  const mes = Number(document.getElementById('selMes').value);
  const { error } = await estado.db.from('biovac_movimientos')
    .insert({ unidad_id: unidadId, anio, mes, responsable_elaboracion: usuario, fecha_corte: ultimoDiaMes(anio, mes) });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Movimiento creado.', 'ok');
  await cargarMovimiento();
}

function render() {
  const m = estado.movimiento;
  document.getElementById('panelMovimiento').style.display = 'block';
  document.getElementById('filaCabeceraMovimiento').style.display = 'contents';
  document.getElementById('filaBotonesCabecera').style.display = 'flex';

  const badge = document.getElementById('badgeEstado');
  badge.textContent = m.estado.replace('_', ' ');
  badge.className = 'estado-badge estado-' + m.estado;

  document.getElementById('infoCorregido').textContent = m.fue_corregido ? '⚠ Corregido posteriormente' : '';

  const editable = m.estado === 'BORRADOR' || m.estado === 'EN_CORRECCION';
  const inpResp = document.getElementById('inpResponsable');
  inpResp.value = m.responsable_elaboracion || '';
  inpResp.readOnly = !editable;

  // La fecha de corte es mensual (último día del mes elegido) -- se
  // calcula sola, no se pide un día específico.
  const fechaCorte = m.fecha_corte || ultimoDiaMes(m.anio, m.mes);
  document.getElementById('infoFechaCorte').textContent = new Date(fechaCorte + 'T00:00:00')
    .toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  document.getElementById('btnCerrarMes').style.display = m.estado === 'BORRADOR' ? 'inline-block' : 'none';
  document.getElementById('btnAbrirCorreccion').style.display = m.estado === 'CERRADO' ? 'inline-block' : 'none';
  document.getElementById('btnAplicarCorreccion').style.display = m.estado === 'EN_CORRECCION' ? 'inline-block' : 'none';
  document.getElementById('btnGuardarCabecera').disabled = !editable;

  renderBloques(editable);
}

function renderBloques(editable) {
  const cont = document.getElementById('contenedorBloques');
  const anio = estado.movimiento.anio, mes = estado.movimiento.mes;
  let html = '';

  for (const bloque of estado.bloques) {
    const biosDelBloque = estado.biologicos
      .filter((b) => b.bloque_id === bloque.id && biologicoVigente(b, anio, mes))
      .sort((a, b) => a.orden_en_bloque - b.orden_en_bloque);
    if (biosDelBloque.length === 0) continue;

    for (const bio of biosDelBloque) {
      html += renderBiologico(bio, editable);
    }
  }
  cont.innerHTML = html || '<p>Sin biológicos vigentes para este periodo.</p>';
}

function numColumnas(split) { return split ? 11 : 9; }

function colgroupRenglones(split) {
  // El ancho total de cada columna "de rol" (recibido, aplicadas,
  // desechadas) se mantiene fijo entre tablas normales y de dosis
  // fraccionada (Hepatitis B) -- en vez de agregar columnas extra que
  // empujan el ancho total por encima de 100% (lo que el navegador
  // compensa encogiendo TODAS las columnas y desalinea la tabla con las
  // de los demás biológicos), aplicadas/desechadas simplemente se
  // reparten en dos mitades cuando hay dosis fraccionada.
  const parDato = split ? '<col class="col-dato-mitad"><col class="col-dato-mitad">' : '<col class="col-dato">';
  return `<colgroup>
    <col class="col-lote"><col class="col-caducidad"><col class="col-ant">
    <col class="col-dato">
    ${parDato}
    ${parDato}
    <col class="col-final"><col class="col-obs"><col class="col-accion">
  </colgroup>`;
}

function encabezadoColumnas(split) {
  // Cuando hay dosis fraccionada (Hepatitis B), cada columna de "aplicadas"
  // y "desechadas" se separa en dos: una fila de subencabezado marca cuál
  // corresponde a 0.5 mL (fraccionada) y cuál a 1 mL (completa) -- de otro
  // modo, con solo el título del grupo arriba, no se distingue a simple
  // vista qué recuadro es cuál dosis.
  const rs = split ? ' rowspan="2"' : '';
  const subfila = split ? `<tr class="fila-subencabezado">
    <th class="col-dosis-05">0.5 mL</th><th class="col-dosis-1">1 mL</th>
    <th class="col-dosis-05">0.5 mL</th><th class="col-dosis-1">1 mL</th>
  </tr>` : '';
  return `<thead>
    <tr>
      <th style="text-align:left"${rs}>Lote</th>
      <th${rs}>Caducidad</th>
      <th${rs}>Ant.</th>
      <th${rs}>Recibido</th>
      <th colspan="${split ? 2 : 1}">Dosis aplicadas</th>
      <th colspan="${split ? 2 : 1}">Dosis desechadas</th>
      <th${rs}>Final</th>
      <th${rs}>Observaciones</th>
      <th${rs}></th>
    </tr>
    ${subfila}
  </thead>`;
}

// Semaforización de caducidad: rojo = ya caducó, ámbar = vence dentro de
// los próximos 90 días (umbral típico de control de caducidades en frío),
// verde = con vigencia holgada. Solo es informativo aquí -- el bloqueo real
// de guardar un lote NORMAL caducado lo hace el motor (biovac_trg_20_autocalc).
const DIAS_PROXIMO_A_VENCER = 90;
function semaforoCaducidad(caducidadIso) {
  if (!caducidadIso) return 'sem-ok';
  const hoyMs = Date.now();
  const caducidadMs = new Date(caducidadIso + 'T00:00:00').getTime();
  const diasRestantes = (caducidadMs - hoyMs) / 86400000;
  if (diasRestantes < 0) return 'sem-vencido';
  if (diasRestantes <= DIAS_PROXIMO_A_VENCER) return 'sem-proximo';
  return 'sem-ok';
}

// Compara contra el ÚLTIMO DÍA DEL MES del movimiento abierto, no contra
// la fecha real de hoy -- mismo criterio que biovac_trg_20_autocalc en la
// base de datos. Así, al reabrir un mes pasado para corregir (o al ver un
// mes ya cerrado), un lote no se marca "caducado" solo porque, visto desde
// HOY, ya pasó su fecha; lo que importa es si ya estaba caducado EN ese mes.
function loteVencido(caducidadIso) {
  if (!caducidadIso || !estado.movimiento) return false;
  const finDeMes = ultimoDiaMes(estado.movimiento.anio, estado.movimiento.mes);
  return caducidadIso < finDeMes;
}

function renderBiologico(bio, editable) {
  const renglonesBio = estado.renglones.filter((r) => r.biovac_lotes.biologico_id === bio.id);
  const normales = renglonesBio.filter((r) => r.categoria === 'NORMAL');
  const arf = renglonesBio.filter((r) => r.categoria === 'ARF');
  const canje = renglonesBio.filter((r) => r.categoria === 'CANJE');
  const split = bio.regla_especial === 'SPLIT_DOSE';
  const color = colorDeBiologico(bio.clave);

  // Lo que más se hace mes a mes no es agregar lotes nuevos, es dar
  // seguimiento a los que ya vienen arrastrando -- este resumen hace
  // visible de un vistazo cuántos siguen pendientes (y si alguno ya
  // caducó sin dictamen) antes de que el usuario entre a la tabla.
  const arfPendientes = arf.filter((r) => Number(r.existencia_final_frascos) > 0);
  const canjePendientes = canje.filter((r) => Number(r.existencia_final_frascos) > 0);
  const arfVencidos = arfPendientes.filter((r) => loteVencido(r.biovac_lotes.caducidad));
  let resumenHtml = '';
  if (arfPendientes.length || canjePendientes.length) {
    const partes = [];
    if (arfPendientes.length) partes.push(`${arfPendientes.length} en A.R.F.`);
    if (canjePendientes.length) partes.push(`${canjePendientes.length} en canje`);
    resumenHtml = `<div class="bio-resumen">${partes.join(' · ')} pendiente${(arfPendientes.length + canjePendientes.length) > 1 ? 's' : ''} de seguimiento${arfVencidos.length ? ` <span class="alerta">· ${arfVencidos.length} caducado${arfVencidos.length > 1 ? 's' : ''} sin dictamen</span>` : ''}</div>`;
  }

  const cols = numColumnas(split);
  let html = `<div class="bloque">
    <div class="bloque-titulo">
      <div class="bio-icon" style="background: rgba(${hexToRgb(color)}, .13); color: ${color};"><span class="material-symbols-rounded">medication_liquid</span></div>
      <div class="bio-meta"><h2>${bio.nombre_excel.replace(/\n/g, ' ')}</h2>${resumenHtml}</div>
    </div>
    <div class="tabla-wrap">
    <table class="renglones">${colgroupRenglones(split)}${encabezadoColumnas(split)}<tbody>`;

  if (normales.length === 0) html += `<tr><td colspan="${cols}" style="color:var(--muted); text-align:left; font-style:italic">Sin lotes normales capturados.</td></tr>`;
  for (const r of normales) html += renderRenglonFila(r, bio, editable, split);

  if (arf.length > 0) {
    html += `<tr><td colspan="${cols}" class="subseccion arf">A.R.F. — En dictamen</td></tr>`;
    for (const r of arf) html += renderRenglonFila(r, bio, editable, split, 'arf');
  }
  if (canje.length > 0) {
    html += `<tr><td colspan="${cols}" class="subseccion canje">Canje</td></tr>`;
    for (const r of canje) html += renderRenglonFila(r, bio, editable, split, 'canje');
  }
  html += `</tbody>`;

  // Total del biológico: igual que la fila "Total" del Excel real, suma
  // NORMAL + A.R.F. + Canje columna por columna (existencia anterior,
  // recibido, aplicadas, desechadas y existencia final) -- no solo el
  // final; el ARF/canje sí suma al total impreso, aunque no cuente como
  // "dado de baja" en la lógica de negocio.
  const sumarCampo = (campo) => renglonesBio.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);
  const totalAnt = sumarCampo('existencia_anterior_frascos');
  const totalRecibido = sumarCampo('recibido_frascos');
  const totalAplicadasA = sumarCampo('aplicadas_a');
  const totalAplicadasB = sumarCampo('aplicadas_b');
  const totalDesechadasA = sumarCampo('desechadas_a');
  const totalDesechadasB = sumarCampo('desechadas_b');
  const totalFinal = renglonesBio.reduce((acc, r) => acc + (Number(BiovacEngine.calcExistenciaFinal({
    presentacion: bio.presentacion, dosisPorFrasco: bio.dosis_por_frasco, dosisPorFrascoOverride: r.biovac_lotes.dosis_por_frasco_override,
    reglaEspecial: bio.regla_especial, existenciaAnterior: r.existencia_anterior_frascos, recibido: r.recibido_frascos,
    aplicadasA: r.aplicadas_a, aplicadasB: r.aplicadas_b, desechadasA: r.desechadas_a, desechadasB: r.desechadas_b
  })) || 0), 0);
  html += `<tfoot><tr>
    <td colspan="2">Total ${bio.nombre_excel.replace(/\n/g, ' ')}</td>
    <td data-total-ant="${bio.id}">${totalAnt}</td>
    <td data-total-recibido="${bio.id}">${totalRecibido}</td>
    <td class="${split ? 'col-dosis-05' : ''}" data-total-aplicadas-a="${bio.id}">${totalAplicadasA}</td>
    ${split ? `<td class="col-dosis-1" data-total-aplicadas-b="${bio.id}">${totalAplicadasB}</td>` : ''}
    <td class="${split ? 'col-dosis-05' : ''}" data-total-desechadas-a="${bio.id}">${totalDesechadasA}</td>
    ${split ? `<td class="col-dosis-1" data-total-desechadas-b="${bio.id}">${totalDesechadasB}</td>` : ''}
    <td><span class="valor-final" data-total-final="${bio.id}">${totalFinal}</span></td>
    <td colspan="2"></td>
  </tr></tfoot>`;
  html += `</table></div>`;

  if (editable) {
    html += renderPanelAgregar(bio);
  }
  html += `</div>`;
  return html;
}

function renderRenglonFila(r, bio, editable, split, subcategoria) {
  const lote = r.biovac_lotes;
  const dosis = BiovacEngine.calcExistenciaFinal({
    presentacion: bio.presentacion, dosisPorFrasco: bio.dosis_por_frasco, dosisPorFrascoOverride: lote.dosis_por_frasco_override,
    reglaEspecial: bio.regla_especial, existenciaAnterior: r.existencia_anterior_frascos, recibido: r.recibido_frascos,
    aplicadasA: r.aplicadas_a, aplicadasB: r.aplicadas_b, desechadasA: r.desechadas_a, desechadasB: r.desechadas_b
  });
  const negativa = dosis < 0;
  const cols = numColumnas(split);
  const caducado = Number(dosis) > 0 && loteVencido(lote.caducidad);
  const vencidoArf = subcategoria === 'arf' && caducado;
  const bloqueadoNormal = !subcategoria && caducado;
  const semaforo = semaforoCaducidad(lote.caducidad);

  const campo = (campo, valor, clase) => editable
    ? `<input type="number" step="any" inputmode="decimal" class="${clase || ''}" data-renglon="${r.id}" data-campo="${campo}" value="${valor ? valor : ''}" placeholder="0">`
    : `<span>${valor || 0}</span>`;

  let botonResolver = '';
  let filaResolver = '';
  if (editable && subcategoria === 'arf' && Number(dosis) > 0) {
    botonResolver = `<button class="btn-resolver arf" data-action="toggle-resolver" data-renglon="${r.id}"><span class="material-symbols-rounded">task_alt</span> Dictamen</button>`;
    filaResolver = `<tr><td colspan="${cols}" style="padding:0; border-bottom:1px solid #f1f5f9;">${panelResolverArfHtml(r.id)}</td></tr>`;
  } else if (editable && subcategoria === 'canje' && Number(dosis) > 0) {
    botonResolver = `<button class="btn-resolver canje" data-action="toggle-resolver" data-renglon="${r.id}"><span class="material-symbols-rounded">sync_alt</span> Canje</button>`;
    filaResolver = `<tr><td colspan="${cols}" style="padding:0; border-bottom:1px solid #f1f5f9;">${panelResolverCanjeHtml(r.id, bio)}</td></tr>`;
  }

  return `<tr class="${subcategoria ? 'categoria-' + subcategoria : ''}">
    <td>
      <div class="lote-texto">${lote.numero_lote}${botonResolver}</div>
    </td>
    <td>
      <div class="caducidad-chip ${semaforo}"><span class="semaforo"></span>${formatMmmAa(lote.caducidad)}</div>
      ${vencidoArf ? '<div class="badge-vencido"><span class="material-symbols-rounded">warning</span> Caducado</div>' : ''}
      ${bloqueadoNormal ? '<div class="badge-vencido"><span class="material-symbols-rounded">warning</span> Debe desecharse</div>' : ''}
    </td>
    <td class="col-anterior">${r.existencia_anterior_frascos || 0}</td>
    <td class="col-mov">${campo('recibido_frascos', r.recibido_frascos)}</td>
    <td class="col-mov${split ? ' col-dosis-05' : ''}">${campo('aplicadas_a', r.aplicadas_a)}</td>
    ${split ? `<td class="col-mov col-dosis-1">${campo('aplicadas_b', r.aplicadas_b)}</td>` : ''}
    <td class="col-mov${split ? ' col-dosis-05' : ''}">${campo('desechadas_a', r.desechadas_a)}</td>
    ${split ? `<td class="col-mov col-dosis-1">${campo('desechadas_b', r.desechadas_b)}</td>` : ''}
    <td class="col-final"><span class="valor-final ${negativa ? 'existencia-negativa' : ''}" data-existencia-final="${r.id}">${dosis}</span></td>
    <td>${editable ? `<input type="text" data-renglon="${r.id}" data-campo="observaciones" value="${(r.observaciones || '').replace(/"/g, '&quot;')}">` : (r.observaciones || '')}</td>
    <td>${editable ? `<button class="btn-fantasma" data-action="eliminar-renglon" data-renglon="${r.id}" title="Eliminar renglón"><span class="material-symbols-rounded">delete</span></button>` : ''}</td>
  </tr>${filaResolver}`;
}

function panelResolverArfHtml(renglonId) {
  return `<div class="panel-resolver" data-panel-arf="${renglonId}">
    <p>El dictamen llegó y la vacuna se reutiliza: la existencia se traslada íntegra a un renglón normal de este mismo lote. (Si el dictamen ordena desecharla, regístralo como "Dosis desechadas" arriba, sin usar este botón.)</p>
    <div class="campos">
      <div class="campo" style="width:300px">
        <label>Motivo / resultado del dictamen</label>
        <input type="text" data-motivo-arf placeholder="Ej. Dictamen favorable, se reintegra a existencia">
      </div>
    </div>
    <div class="acciones">
      <button class="btn-primario btn-mini" data-action="confirmar-resolver-arf" data-renglon="${renglonId}"><span class="material-symbols-rounded">check</span> Reactivar a normal</button>
      <button class="btn-fantasma btn-mini" data-action="cancelar-resolver" data-renglon="${renglonId}">Cancelar</button>
    </div>
  </div>`;
}

function panelResolverCanjeHtml(renglonId, bio) {
  return `<div class="panel-resolver" data-panel-canje="${renglonId}" data-bio="${bio.id}">
    <p>El canje se realizó: este lote se sustituye por el lote nuevo recibido, y su existencia pasa a un renglón normal.</p>
    <div class="campos">
      <div class="campo">
        <label>N° de lote nuevo</label>
        <select data-nuevo-lote-canje><option value="">Selecciona un lote…</option></select>
        <input type="text" data-nuevo-lote-canje-manual placeholder="Escribe el número del lote nuevo" style="display:none; margin-top:6px">
      </div>
      <div class="campo">
        <label>Caducidad del nuevo</label>
        <input type="text" inputmode="numeric" data-nueva-caducidad-canje placeholder="DDMMAA o MMAA">
      </div>
      <div class="campo" style="width:220px">
        <label>Motivo</label>
        <input type="text" data-motivo-canje placeholder="Ej. Canje recibido de laboratorio">
      </div>
    </div>
    <div class="acciones">
      <button class="btn-primario btn-mini" data-action="confirmar-resolver-canje" data-renglon="${renglonId}"><span class="material-symbols-rounded">check</span> Registrar canje</button>
      <button class="btn-fantasma btn-mini" data-action="cancelar-resolver" data-renglon="${renglonId}">Cancelar</button>
    </div>
  </div>`;
}

function renderPanelAgregar(bio) {
  const bioId = bio.id;
  return `
  <button class="btn-mini btn-secundario" style="margin-top:14px" data-action="toggle-agregar" data-bio="${bioId}"><span class="material-symbols-rounded">add</span> Agregar lote</button>
  <div class="panel-agregar" data-panel-agregar="${bioId}" data-bio="${bioId}">
    <div class="campos">
      <div class="campo">
        <label>N° de lote</label>
        <select data-nuevo-lote><option value="">Selecciona un lote…</option></select>
        <input type="text" data-nuevo-lote-manual placeholder="Escribe el nuevo número de lote" style="display:none; margin-top:6px">
      </div>
      <div class="campo">
        <label>Caducidad</label>
        <input type="text" inputmode="numeric" data-nuevo-caducidad placeholder="Ej. 072029">
        <span class="ayuda">Solo números; se convierte a "JUL-29" al salir del campo</span>
      </div>
      <div class="campo">
        <label>Estatus</label>
        <select data-nuevo-categoria>
          <option value="NORMAL">Normal</option>
          <option value="ARF">A.R.F. (en dictamen)</option>
          <option value="CANJE">Canje</option>
        </select>
      </div>
      <div class="campo">
        <label>Esta cantidad es...</label>
        <select data-nuevo-tipo-cantidad>
          <option value="ANTERIOR">Existencia que ya tenía</option>
          <option value="RECIBIDO">Entrada nueva (recibido este mes)</option>
        </select>
      </div>
      <div class="campo">
        <label>Cantidad (frascos)</label>
        <input type="number" step="any" data-nuevo-cantidad placeholder="0">
      </div>
    </div>
    <div class="acciones">
      <button class="btn-primario btn-mini" data-action="confirmar-agregar" data-bio="${bioId}"><span class="material-symbols-rounded">check</span> Agregar lote</button>
      <button class="btn-fantasma btn-mini" data-action="cancelar-agregar" data-bio="${bioId}">Cancelar</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Edición de renglones (delegación de eventos)
// ---------------------------------------------------------------------------

function recalcularFilaEnVivo(renglonId) {
  const inputs = document.querySelectorAll(`[data-renglon="${renglonId}"]`);
  const r = estado.renglones.find((x) => x.id === renglonId);
  if (!r) return;
  const bio = estado.biologicos.find((b) => b.id === r.biovac_lotes.biologico_id);
  const valores = {};
  inputs.forEach((inp) => { if (inp.dataset.campo !== 'observaciones') valores[inp.dataset.campo] = Number(inp.value) || 0; });
  const dosis = BiovacEngine.calcExistenciaFinal({
    presentacion: bio.presentacion, dosisPorFrasco: bio.dosis_por_frasco, dosisPorFrascoOverride: r.biovac_lotes.dosis_por_frasco_override,
    reglaEspecial: bio.regla_especial, existenciaAnterior: r.existencia_anterior_frascos,
    recibido: valores.recibido_frascos ?? r.recibido_frascos, aplicadasA: valores.aplicadas_a ?? r.aplicadas_a,
    aplicadasB: valores.aplicadas_b ?? r.aplicadas_b, desechadasA: valores.desechadas_a ?? r.desechadas_a, desechadasB: valores.desechadas_b ?? r.desechadas_b
  });
  const celda = document.querySelector(`[data-existencia-final="${renglonId}"]`);
  if (celda) { celda.textContent = dosis; celda.classList.toggle('existencia-negativa', dosis < 0); }
  recalcularTotalBio(bio.id);
}

// Total por biológico (suma NORMAL + A.R.F. + Canje, igual que la fila
// "Total" del Excel real) -- lee directo de los inputs en pantalla para
// reflejar también ediciones aún no guardadas de cualquier renglón del
// mismo bloque, y cae a los valores ya guardados cuando no hay inputs
// (vista de solo lectura de un mes CERRADO).
function recalcularTotalBio(bioId) {
  const bio = estado.biologicos.find((b) => b.id === bioId);
  if (!bio) return;
  const renglonesBio = estado.renglones.filter((r) => r.biovac_lotes.biologico_id === bioId);
  const totales = { ant: 0, recibido: 0, aplicadasA: 0, aplicadasB: 0, desechadasA: 0, desechadasB: 0, final: 0 };
  for (const r of renglonesBio) {
    const inputs = document.querySelectorAll(`[data-renglon="${r.id}"]`);
    const valores = {};
    inputs.forEach((inp) => { if (inp.dataset.campo && inp.dataset.campo !== 'observaciones') valores[inp.dataset.campo] = Number(inp.value) || 0; });
    const recibido = valores.recibido_frascos ?? r.recibido_frascos;
    const aplicadasA = valores.aplicadas_a ?? r.aplicadas_a;
    const aplicadasB = valores.aplicadas_b ?? r.aplicadas_b;
    const desechadasA = valores.desechadas_a ?? r.desechadas_a;
    const desechadasB = valores.desechadas_b ?? r.desechadas_b;
    const dosis = BiovacEngine.calcExistenciaFinal({
      presentacion: bio.presentacion, dosisPorFrasco: bio.dosis_por_frasco, dosisPorFrascoOverride: r.biovac_lotes.dosis_por_frasco_override,
      reglaEspecial: bio.regla_especial, existenciaAnterior: r.existencia_anterior_frascos,
      recibido, aplicadasA, aplicadasB, desechadasA, desechadasB
    });
    totales.ant += Number(r.existencia_anterior_frascos) || 0;
    totales.recibido += Number(recibido) || 0;
    totales.aplicadasA += Number(aplicadasA) || 0;
    totales.aplicadasB += Number(aplicadasB) || 0;
    totales.desechadasA += Number(desechadasA) || 0;
    totales.desechadasB += Number(desechadasB) || 0;
    totales.final += Number(dosis) || 0;
  }
  const setCelda = (attr, valor) => {
    const celda = document.querySelector(`[${attr}="${bioId}"]`);
    if (celda) celda.textContent = valor;
  };
  setCelda('data-total-ant', totales.ant);
  setCelda('data-total-recibido', totales.recibido);
  setCelda('data-total-aplicadas-a', totales.aplicadasA);
  setCelda('data-total-aplicadas-b', totales.aplicadasB);
  setCelda('data-total-desechadas-a', totales.desechadasA);
  setCelda('data-total-desechadas-b', totales.desechadasB);
  setCelda('data-total-final', totales.final);
}

// Espejo, en el cliente, de las dos seguridades que en la base de datos
// aplica biovac_trg_20_autocalc (solo sobre renglones NORMALES) -- esto es
// solo para dar el error al instante sin esperar el viaje al servidor; la
// base de datos sigue siendo quien realmente lo bloquea.
function validarGuardadoRenglon(r, bio, dosisProspectiva) {
  if (r.categoria !== 'NORMAL') return null;
  const lote = r.biovac_lotes;
  if (Number(dosisProspectiva) > 0 && loteVencido(lote.caducidad)) {
    return `El lote ${lote.numero_lote} está caducado. Regístralo como desechado antes de guardar.`;
  }
  if (bio.frasco_desecho_mismo_dia && Number(dosisProspectiva) !== Math.round(Number(dosisProspectiva))) {
    return `${bio.nombre_excel.replace(/\n/g, ' ')} se desecha el mismo día de abrirse: la existencia final no puede quedar en fracción de frasco.`;
  }
  return null;
}

// Cada celda de renglón (recibido/aplicadas/desechadas/observaciones) se
// guarda sola al perder el foco -- no hace falta "Cerrar mes" para que el
// progreso quede a salvo, eso solo bloquea edición y arrastra la existencia
// al mes siguiente. Este set trackea celdas tecleadas (evento "input") que
// AÚN no confirmaron ese guardado (evento "change", que dispara recién al
// salir del campo) -- se usa para advertir antes de cerrar la pestaña con
// algo a medio escribir, y para el destello verde de "guardado".
const camposSinGuardar = new Set();

function marcarCampoSinGuardar(input) {
  camposSinGuardar.add(input);
}

function destellarGuardado(input) {
  input.classList.remove('campo-guardado-ok');
  // Forzar reflow para poder re-disparar la animación si el usuario edita
  // el mismo campo dos veces seguidas.
  void input.offsetWidth;
  input.classList.add('campo-guardado-ok');
}

window.addEventListener('beforeunload', (ev) => {
  if (camposSinGuardar.size === 0) return;
  ev.preventDefault();
  ev.returnValue = '';
});

async function guardarCampoRenglon(input) {
  const renglonId = input.dataset.renglon;
  const campo = input.dataset.campo;
  const valor = campo === 'observaciones' ? (input.value.trim() || null) : (Number(input.value) || 0);

  const r = estado.renglones.find((x) => x.id === renglonId);
  if (r && campo !== 'observaciones') {
    const bio = estado.biologicos.find((b) => b.id === r.biovac_lotes.biologico_id);
    const dosisProspectiva = BiovacEngine.calcExistenciaFinal({
      presentacion: bio.presentacion, dosisPorFrasco: bio.dosis_por_frasco, dosisPorFrascoOverride: r.biovac_lotes.dosis_por_frasco_override,
      reglaEspecial: bio.regla_especial, existenciaAnterior: r.existencia_anterior_frascos,
      recibido: campo === 'recibido_frascos' ? valor : r.recibido_frascos,
      aplicadasA: campo === 'aplicadas_a' ? valor : r.aplicadas_a, aplicadasB: campo === 'aplicadas_b' ? valor : r.aplicadas_b,
      desechadasA: campo === 'desechadas_a' ? valor : r.desechadas_a, desechadasB: campo === 'desechadas_b' ? valor : r.desechadas_b
    });
    const errorValidacion = validarGuardadoRenglon(r, bio, dosisProspectiva);
    if (errorValidacion) {
      toast(errorValidacion, 'error');
      input.value = r[campo] || '';
      camposSinGuardar.delete(input);
      recalcularFilaEnVivo(renglonId);
      return;
    }
  }

  const { data, error } = await estado.db.from('biovac_renglones').update({ [campo]: valor }).eq('id', renglonId)
    .select('existencia_final_frascos').single();
  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  camposSinGuardar.delete(input);
  destellarGuardado(input);
  if (r) {
    r[campo] = valor;
    r.existencia_final_frascos = data.existencia_final_frascos;
    const celda = document.querySelector(`[data-existencia-final="${renglonId}"]`);
    if (celda) { celda.textContent = data.existencia_final_frascos; celda.classList.toggle('existencia-negativa', Number(data.existencia_final_frascos) < 0); }
  }
}

async function eliminarRenglon(renglonId) {
  const ok = await mostrarModal({ titulo: 'Eliminar renglón', mensaje: '¿Eliminar este renglón (lote)? Esta acción no se puede deshacer.', textoAceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  const { error } = await estado.db.from('biovac_renglones').delete().eq('id', renglonId);
  if (error) { toast('Error al eliminar: ' + error.message, 'error'); return; }
  await cargarRenglones();
  render();
}

// ---------------------------------------------------------------------------
// Lotes disponibles desde el catálogo central (tabla "lotes") para ofrecer
// en la lista desplegable -- filtrados por biológico, por el municipio de
// la unidad activa (o "*"/"TODOS", registrado para toda la jurisdicción) y
// por tipo (NORMAL/ARF/CANJE, según el Estatus elegido). Cacheado por
// bio+categoría dentro de la sesión; se invalida solo al cambiar de unidad
// (cargarCatalogo se llama una sola vez al inicio, así que en la práctica
// dura toda la sesión de captura).
// ---------------------------------------------------------------------------

async function obtenerLotesCatalogoCentral(bio, categoria) {
  const key = bio.clave + '::' + categoria;
  if (estado.catalogoLotesCentral[key]) return estado.catalogoLotesCentral[key];

  const unidad = estado.unidades.find((u) => u.id === estado.movimiento.unidad_id);
  const nombres = CLAVE_A_EXISTENCIA_BIOLOGICO[bio.clave];
  const municipioLotes = unidad ? MUNICIPIO_BIOVAC_A_LOTES[unidad.municipio] : null;
  if (!nombres || !municipioLotes) { estado.catalogoLotesCentral[key] = []; return []; }

  const { data, error } = await estado.db.from('lotes')
    .select('lote, caducidad, municipio')
    .in('biologico', nombres).eq('tipo', categoria);
  if (error || !data) { estado.catalogoLotesCentral[key] = []; return []; }

  const vistos = new Map();
  for (const fila of data) {
    const m = String(fila.municipio || '').trim().toUpperCase();
    if (m !== municipioLotes && m !== '*' && m !== 'TODOS') continue;
    const lote = String(fila.lote || '').trim();
    if (!lote || vistos.has(lote)) continue;
    vistos.set(lote, fila.caducidad);
  }
  const lista = [...vistos.entries()].map(([lote, caducidad]) => ({ lote, caducidad }));
  estado.catalogoLotesCentral[key] = lista;
  return lista;
}

// Llena un <select> de lote con lo que ya existe en el catálogo central para
// ese biológico+categoría, más una opción para capturar uno genuinamente
// nuevo que el catálogo central aún no conozca (input de texto que aparece
// al elegirla) -- así el flujo normal es "elegir de la lista", sin volver a
// depender de detección de errores de dedo.
async function poblarSelectLote(bio, categoria, selectEl) {
  selectEl.innerHTML = '<option value="">Cargando lotes…</option>';
  const lista = await obtenerLotesCatalogoCentral(bio, categoria);
  const opciones = lista
    .map((l) => `<option value="${l.lote}" data-cad="${l.caducidad || ''}">${l.lote}${l.caducidad ? ' — ' + formatMmmAa(l.caducidad) : ''}</option>`)
    .join('');
  selectEl.innerHTML = `<option value="">Selecciona un lote…</option>${opciones}<option value="__nuevo__">+ Nuevo lote (no está en la lista)</option>`;
}

// Muestra/oculta el input de texto para "+ Nuevo lote" y, al elegir un lote
// ya conocido, precarga su caducidad (sin sobreescribir si el usuario ya
// escribió una).
function onCambioSelectLote(selectEl) {
  const campo = selectEl.closest('.campo');
  const manual = campo && campo.querySelector('[data-nuevo-lote-manual], [data-nuevo-lote-canje-manual]');
  if (manual) manual.style.display = selectEl.value === '__nuevo__' ? 'block' : 'none';

  const opt = selectEl.selectedOptions[0];
  const cad = opt && opt.dataset ? opt.dataset.cad : '';
  if (cad) {
    const panel = selectEl.closest('[data-bio]');
    const campoCaducidad = panel && panel.querySelector('[data-nuevo-caducidad], [data-nueva-caducidad-canje]');
    if (campoCaducidad && !campoCaducidad.value.trim()) campoCaducidad.value = formatMmmAa(cad);
  }
}

// "Agregar lote": la lista depende del Estatus elegido (Normal/A.R.F./Canje)
// -- se repuebla cada vez que el panel se abre y cada vez que cambia el
// Estatus.
function poblarSelectLoteAgregar(panel) {
  const bio = estado.biologicos.find((b) => b.id === panel.dataset.bio);
  const selectEl = panel.querySelector('[data-nuevo-lote]');
  if (!bio || !selectEl) return;
  const categoria = panel.querySelector('[data-nuevo-categoria]')?.value || 'NORMAL';
  poblarSelectLote(bio, categoria, selectEl);
}

// Resolución de canje: el lote nuevo siempre entra como existencia normal.
function poblarSelectLoteCanje(panel) {
  const bio = estado.biologicos.find((b) => b.id === panel.dataset.bio);
  const selectEl = panel.querySelector('[data-nuevo-lote-canje]');
  if (!bio || !selectEl) return;
  poblarSelectLote(bio, 'NORMAL', selectEl);
}

async function agregarLote(bioId, panel) {
  const loteSelect = panel.querySelector('[data-nuevo-lote]');
  const loteManual = panel.querySelector('[data-nuevo-lote-manual]');
  const numeroLote = (loteSelect.value === '__nuevo__' ? loteManual.value : loteSelect.value).trim();
  const caducidadTexto = panel.querySelector('[data-nuevo-caducidad]').value.trim();
  const categoria = panel.querySelector('[data-nuevo-categoria]').value;
  const tipoCantidad = panel.querySelector('[data-nuevo-tipo-cantidad]').value;
  const cantidad = Number(panel.querySelector('[data-nuevo-cantidad]').value) || 0;
  if (!loteSelect.value) { toast('Selecciona un lote de la lista, o "+ Nuevo lote".', 'error'); return; }
  if (!numeroLote) { toast('Escribe el número de lote.', 'error'); return; }

  let caducidad = null;
  if (caducidadTexto) {
    caducidad = parsearCaducidadInteligente(caducidadTexto);
    if (!caducidad) { toast('No entendí la fecha de caducidad. Usa por ejemplo 260729 o 07-29.', 'error'); return; }
  }

  let { data: lote, error: errSel } = await estado.db.from('biovac_lotes')
    .select('id').eq('biologico_id', bioId).eq('numero_lote', numeroLote).maybeSingle();
  if (errSel) { toast('Error: ' + errSel.message, 'error'); return; }

  let loteReciénCreado = false;
  if (!lote) {
    const { data: nuevo, error: errIns } = await estado.db.from('biovac_lotes')
      .insert({ biologico_id: bioId, numero_lote: numeroLote, caducidad }).select('id').single();
    if (errIns) { toast('Error creando lote: ' + errIns.message, 'error'); return; }
    lote = nuevo;
    loteReciénCreado = true;
  }

  const renglon = { movimiento_id: estado.movimiento.id, lote_id: lote.id, categoria };
  if (tipoCantidad === 'RECIBIDO') renglon.recibido_frascos = cantidad;
  else renglon.existencia_anterior_frascos = cantidad;

  const { error: errRenglon } = await estado.db.from('biovac_renglones').insert(renglon);
  if (errRenglon) {
    toast('Error agregando renglón: ' + errRenglon.message, 'error');
    // si el lote se acababa de crear para este intento, no dejarlo huérfano
    // (si no, un reintento con la caducidad corregida reutilizaría por error
    // el lote viejo -- ya bloqueado -- en vez de crear uno con el dato bueno)
    if (loteReciénCreado) {
      await estado.db.from('biovac_lotes').delete().eq('id', lote.id);
    }
    return;
  }

  toast('Lote agregado.', 'ok');
  await cargarRenglones();
  render();
}

// ---------------------------------------------------------------------------
// Resolución de A.R.F. / Canje -- lo que más se da seguimiento mes a mes:
// un lote en A.R.F. se reactiva íntegro a existencia normal cuando llega el
// dictamen (si el dictamen ordena desecharlo, eso se registra como dosis
// desechada directo en el renglón, sin pasar por aquí); un lote en canje se
// sustituye por el lote nuevo recibido, que entra como existencia normal.
// ---------------------------------------------------------------------------

async function reactivarArf(renglonId, panel) {
  const usuario = usuarioActual();
  if (!usuario) return;
  const motivo = panel.querySelector('[data-motivo-arf]').value.trim();
  if (!motivo) { toast('Escribe el motivo o resultado del dictamen.', 'error'); return; }
  const { error } = await estado.db.rpc('biovac_reclasificar_arf_normal', {
    p_renglon_id: renglonId, p_usuario: usuario, p_rol: (estado.perfil ? estado.perfil.rol : 'MUNICIPAL'), p_motivo: motivo
  });
  if (error) { toast('No se pudo reactivar: ' + error.message, 'error'); return; }
  toast('Lote reactivado a existencia normal.', 'ok');
  await cargarRenglones();
  render();
}

async function resolverCanje(renglonId, panel) {
  const usuario = usuarioActual();
  if (!usuario) return;
  const loteSelect = panel.querySelector('[data-nuevo-lote-canje]');
  const loteManual = panel.querySelector('[data-nuevo-lote-canje-manual]');
  const nuevoLote = (loteSelect.value === '__nuevo__' ? loteManual.value : loteSelect.value).trim();
  const caducidadTexto = panel.querySelector('[data-nueva-caducidad-canje]').value.trim();
  const motivo = panel.querySelector('[data-motivo-canje]').value.trim();
  if (!loteSelect.value) { toast('Selecciona el lote nuevo de la lista, o "+ Nuevo lote".', 'error'); return; }
  if (!nuevoLote) { toast('Escribe el número del lote nuevo.', 'error'); return; }
  if (!motivo) { toast('Escribe el motivo del canje.', 'error'); return; }

  let caducidad = null;
  if (caducidadTexto) {
    caducidad = parsearCaducidadInteligente(caducidadTexto);
    if (!caducidad) { toast('No entendí la fecha de caducidad. Usa por ejemplo 260729 o 07-29.', 'error'); return; }
  }

  const { error } = await estado.db.rpc('biovac_resolver_canje', {
    p_renglon_id: renglonId, p_nuevo_numero_lote: nuevoLote, p_nueva_caducidad: caducidad,
    p_usuario: usuario, p_rol: (estado.perfil ? estado.perfil.rol : 'MUNICIPAL'), p_motivo: motivo
  });
  if (error) { toast('No se pudo registrar el canje: ' + error.message, 'error'); return; }
  toast('Canje registrado: el lote nuevo entró a existencia normal.', 'ok');
  await cargarRenglones();
  render();
}

// ---------------------------------------------------------------------------
// Cabecera, cierre y corrección
// ---------------------------------------------------------------------------

async function guardarCabecera() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const responsable = document.getElementById('inpResponsable').value.trim() || null;
  const fechaCorte = ultimoDiaMes(estado.movimiento.anio, estado.movimiento.mes);
  const { error } = await estado.db.from('biovac_movimientos')
    .update({ responsable_elaboracion: responsable, fecha_corte: fechaCorte }).eq('id', estado.movimiento.id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Datos guardados.', 'ok');
}

async function cerrarMes() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const ok = await mostrarModal({
    titulo: 'Cerrar mes',
    mensaje: 'Quedará bloqueado para edición directa y la existencia se arrastrará al mes siguiente. Si después necesitas corregir algo, puedes reabrirlo: el cambio se propagará automáticamente a los meses ya cerrados que siguen.',
    textoAceptar: 'Cerrar mes'
  });
  if (!ok) return;
  const { error } = await estado.db.rpc('biovac_cerrar_mes', { p_movimiento_id: estado.movimiento.id, p_usuario: usuario });
  if (error) { toast('No se pudo cerrar: ' + error.message, 'error'); return; }
  toast('Mes cerrado correctamente.', 'ok');
  await cargarMovimiento();
}

async function abrirCorreccion() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const motivo = await mostrarModal({
    titulo: 'Reabrir para corregir',
    mensaje: 'Escribe el motivo de la corrección; queda registrado en la auditoría.',
    pedirMotivo: true, placeholderMotivo: 'Ej. Se corrigió una cantidad mal capturada', textoAceptar: 'Reabrir'
  });
  if (!motivo) return;
  const { data, error } = await estado.db.rpc('biovac_abrir_correccion', {
    p_movimiento_id: estado.movimiento.id, p_usuario: usuario, p_rol: (estado.perfil ? estado.perfil.rol : 'MUNICIPAL'), p_motivo: motivo.trim(), p_tipo: 'REAPERTURA'
  });
  if (error) { toast('No se pudo abrir corrección: ' + error.message, 'error'); return; }
  estado.correccionBatchId = data;
  toast('Mes reabierto para corrección. Edita lo necesario y pulsa "Guardar corrección".', 'ok');
  await cargarMovimiento();
}

async function aplicarCorreccion() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const ok = await mostrarModal({
    titulo: 'Guardar corrección',
    mensaje: 'Se recalculará este mes y se propagará en cascada a los meses siguientes ya cerrados.',
    textoAceptar: 'Guardar corrección'
  });
  if (!ok) return;
  const { data, error } = await estado.db.rpc('biovac_aplicar_correccion', {
    p_movimiento_id: estado.movimiento.id, p_usuario: usuario, p_cascade_batch_id: estado.correccionBatchId
  });
  if (error) { toast('No se pudo aplicar la corrección: ' + error.message, 'error'); return; }
  toast(`Corrección aplicada. Meses recalculados: ${data}.`, 'ok');
  estado.correccionBatchId = null;
  await cargarMovimiento();
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

async function exportarExcel() {
  const btn = document.getElementById('btnExportarExcel');
  const htmlOriginal = btn.innerHTML;
  btn.disabled = true; btn.title = 'Generando…'; btn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span>';
  try {
    const unidad = estado.unidades.find((u) => u.id === estado.movimiento.unidad_id);
    const resp = await fetch('biovac_plantilla.xlsx');
    const plantillaBuffer = await resp.arrayBuffer();
    const buffer = await BiovacExportExcel.exportarExcel({ db: estado.db, unidad, movimiento: estado.movimiento, plantillaBuffer });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Movimiento_Biologico_${unidad.nombre}_${estado.movimiento.anio}-${String(estado.movimiento.mes).padStart(2, '0')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Excel generado.', 'ok');
  } catch (e) {
    toast('No se pudo exportar: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.title = 'Exportar a Excel'; btn.innerHTML = htmlOriginal;
  }
}

function verPdf() {
  const unidadId = document.getElementById('selUnidad').value;
  const anio = document.getElementById('selAnio').value;
  const mes = document.getElementById('selMes').value;
  window.open(`biovac_print.html?unidad=${unidadId}&anio=${anio}&mes=${mes}`, '_blank');
}

// ---------------------------------------------------------------------------
// Importación de histórico (autoservicio por municipio) -- lee el mismo
// Excel oficial ya llenado, mes por mes, y usa SIEMPRE biovac_cerrar_mes
// del motor para cerrarlos en orden cronológico (biovac_importer.js). El
// RLS de biovac_unidades ya limita `selUnidad` al propio municipio del
// capturista, así que el destino de la importación siempre es su unidad.
// ---------------------------------------------------------------------------

let archivoImportadoParseado = null;
let nombresRemapPendientes = []; // nombres no reconocidos únicos mostrados en la sección de remapeo

function abrirPanelImportador() {
  document.getElementById('panelImportador').style.display = 'block';
  const nombreUnidad = document.getElementById('selUnidad').selectedOptions[0]?.textContent;
  document.getElementById('importadorMunicipio').textContent = nombreUnidad || 'tu municipio';
  document.getElementById('resultadoImportador').innerHTML = '';
  document.getElementById('revisionImportador').innerHTML = '';
  document.getElementById('btnConfirmarImportacion').style.display = 'none';
  archivoImportadoParseado = null;
  nombresRemapPendientes = [];
}

async function analizarArchivoImportacion() {
  const input = document.getElementById('inputArchivoImportar');
  const file = input.files[0];
  if (!file) { toast('Selecciona un archivo .xlsx primero.', 'error'); return; }
  const unidadId = document.getElementById('selUnidad').value;
  if (!unidadId) { toast('Selecciona tu municipio arriba primero.', 'error'); return; }

  const btn = document.getElementById('btnAnalizarImportacion');
  const cont = document.getElementById('resultadoImportador');
  btn.disabled = true;
  document.getElementById('btnConfirmarImportacion').style.display = 'none';
  cont.innerHTML = '<p>Analizando archivo…</p>';
  try {
    const buffer = await file.arrayBuffer();
    const parsed = await BiovacImporter.parseWorkbook(buffer);
    archivoImportadoParseado = parsed;
    renderResumenAnalisis(parsed);
    renderRevisionImportacion(parsed);
    if (parsed.meses.length) document.getElementById('btnConfirmarImportacion').style.display = 'inline-flex';
  } catch (e) {
    cont.innerHTML = `<div class="resumen-importador"><p class="err">Error al leer el archivo: ${e.message}</p></div>`;
  } finally {
    btn.disabled = false;
  }
}

function renderResumenAnalisis(parsed) {
  const cont = document.getElementById('resultadoImportador');
  if (!parsed.meses.length) {
    cont.innerHTML = '<div class="resumen-importador"><p class="aviso">No se encontraron meses con datos en este archivo.</p></div>';
    return;
  }
  const noReconocidos = new Set();
  let advertenciasTotal = 0;
  parsed.meses.forEach((m) => { m.noReconocidos.forEach((n) => noReconocidos.add(n)); advertenciasTotal += m.advertencias.length; });

  let html = `<div class="resumen-importador">
    <p><b>${parsed.meses.length}</b> mes(es) con datos: ${parsed.meses.map((m) => `${m.mesClave} ${m.anio}`).join(', ')}.</p>`;
  if (noReconocidos.size) {
    html += `<p class="aviso">⚠ ${noReconocidos.size} nombre(s) de biológico no reconocido(s) en el archivo (asígnalos abajo, en "Biológicos no reconocidos" -- si se dejan sin asignar, se omiten): ${[...noReconocidos].join(', ')}</p>`;
  }
  if (advertenciasTotal) {
    html += `<p class="aviso">⚠ ${advertenciasTotal} fila(s) con datos pero sin número de lote identificable (se omiten).</p>`;
  }
  html += `<p>Revisa la tabla de abajo y corrige lo que haga falta -- lote, caducidad, cantidades, categoría (Normal/A.R.F./Canje) -- antes de confirmar. Al confirmar, cada mes se guarda y se cierra automáticamente en orden; si un mes ya estaba cerrado en el sistema, se conserva tal cual y no se toca.</p></div>`;
  cont.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Revisión editable antes de confirmar -- deja corregir cualquier error de
// lectura del escaneo estructural (nombre de biológico no reconocido, lote
// mal leído, caducidad, cantidades, categoría) sin tener que corregir el
// Excel y volver a subirlo. Los cambios mutan archivoImportadoParseado
// directamente, así que confirmarImportacion() los usa tal cual, sin pasos
// intermedios.
// ---------------------------------------------------------------------------

function renderRevisionImportacion(parsed) {
  const cont = document.getElementById('revisionImportador');
  if (!parsed.meses.length) { cont.innerHTML = ''; return; }

  const vistos = new Set();
  nombresRemapPendientes = [];
  parsed.meses.forEach((m) => m.bloques.forEach((b) => {
    if (!b.clave && !vistos.has(b.nombreExcel)) { vistos.add(b.nombreExcel); nombresRemapPendientes.push(b.nombreExcel); }
  }));

  const opcionesBiologicos = [...new Map(estado.biologicos.map((b) => [b.clave, b])).values()]
    .sort((a, b) => a.nombre_excel.localeCompare(b.nombre_excel))
    .map((b) => `<option value="${b.clave}">${b.nombre_excel.replace(/\n/g, ' ')}</option>`).join('');

  let html = '<div class="revision-importador">';

  if (nombresRemapPendientes.length) {
    html += `<div class="revision-remap">
      <h3><span class="material-symbols-rounded" style="font-size:15px">warning</span> Biológicos no reconocidos</h3>
      <p>Estos nombres del archivo no coinciden con el catálogo. Asígnalos al biológico correcto para que se importen; si se dejan en "Omitir" no se importarán.</p>
      ${nombresRemapPendientes.map((nombre, idx) => `
        <div class="revision-remap-fila">
          <span class="nombre-orig">${nombre.replace(/\n/g, ' ')}</span>
          <select data-remap-idx="${idx}" style="max-width:300px">
            <option value="">Omitir (no importar)</option>
            ${opcionesBiologicos}
          </select>
        </div>`).join('')}
    </div>`;
  }

  parsed.meses.forEach((mes, mi) => {
    const numRenglones = mes.bloques.reduce((n, b) => n + b.renglones.length, 0);
    html += `<details class="revision-mes" open>
      <summary>${mes.mesClave} ${mes.anio || '¿año no leído?'} <span style="font-weight:600; color:var(--muted)">${numRenglones} renglón(es)</span></summary>
      <div class="tabla-wrap"><table class="tabla-revision"><thead><tr>
        <th style="width:16%; text-align:left">Biológico</th><th>Categ.</th><th>Lote</th><th>Caducidad</th>
        <th>Ant.</th><th>Recibido</th><th>Aplic. A</th><th>Aplic. B</th><th>Desech. A</th><th>Desech. B</th>
        <th style="width:14%">Observaciones</th><th></th>
      </tr></thead><tbody>`;
    mes.bloques.forEach((bloque, bi) => {
      html += `<tr class="fila-bloque-titulo${bloque.clave ? '' : ' no-reconocido'}"><td colspan="12">${bloque.nombreExcel.replace(/\n/g, ' ')}${bloque.clave ? '' : ' — sin asignar, ver arriba'}</td></tr>`;
      bloque.renglones.forEach((r, ri) => { html += filaRevisionHtml(mi, bi, ri, r); });
    });
    html += '</tbody></table></div></details>';
  });

  html += '</div>';
  cont.innerHTML = html;
}

function filaRevisionHtml(mi, bi, ri, r) {
  const d = (campo) => `data-mes="${mi}" data-bloque="${bi}" data-renglon="${ri}" data-campo="${campo}"`;
  return `<tr>
    <td></td>
    <td><select ${d('categoria')}>
      <option value="NORMAL" ${r.categoria === 'NORMAL' ? 'selected' : ''}>Normal</option>
      <option value="ARF" ${r.categoria === 'ARF' ? 'selected' : ''}>A.R.F.</option>
      <option value="CANJE" ${r.categoria === 'CANJE' ? 'selected' : ''}>Canje</option>
    </select></td>
    <td><input type="text" ${d('numeroLote')} value="${(r.numeroLote || '').replace(/"/g, '&quot;')}"></td>
    <td><input type="date" ${d('caducidad')} value="${r.caducidad || ''}"></td>
    <td><input type="number" step="any" ${d('existenciaAnterior')} value="${r.existenciaAnterior || 0}"></td>
    <td><input type="number" step="any" ${d('recibido')} value="${r.recibido || 0}"></td>
    <td><input type="number" step="any" ${d('aplicadasA')} value="${r.aplicadasA || 0}"></td>
    <td><input type="number" step="any" ${d('aplicadasB')} value="${r.aplicadasB || 0}"></td>
    <td><input type="number" step="any" ${d('desechadasA')} value="${r.desechadasA || 0}"></td>
    <td><input type="number" step="any" ${d('desechadasB')} value="${r.desechadasB || 0}"></td>
    <td><input type="text" ${d('observaciones')} value="${(r.observaciones || '').replace(/"/g, '&quot;')}"></td>
    <td><button type="button" class="btn-fantasma" data-action="eliminar-renglon-import" data-mes="${mi}" data-bloque="${bi}" data-renglon="${ri}" title="Quitar este renglón de la importación"><span class="material-symbols-rounded">delete</span></button></td>
  </tr>`;
}

function onCambioRevisionImportacion(ev) {
  const remapSel = ev.target.closest('[data-remap-idx]');
  if (remapSel) {
    const nombre = nombresRemapPendientes[Number(remapSel.dataset.remapIdx)];
    const nuevaClave = remapSel.value || null;
    archivoImportadoParseado.meses.forEach((m) => m.bloques.forEach((b) => {
      if (b.nombreExcel === nombre) b.clave = nuevaClave;
    }));
    renderRevisionImportacion(archivoImportadoParseado);
    return;
  }
  const campoEl = ev.target.closest('[data-campo][data-mes][data-bloque][data-renglon]');
  if (!campoEl) return;
  const renglon = archivoImportadoParseado.meses[Number(campoEl.dataset.mes)].bloques[Number(campoEl.dataset.bloque)].renglones[Number(campoEl.dataset.renglon)];
  const campo = campoEl.dataset.campo;
  if (campo === 'numeroLote' || campo === 'observaciones') renglon[campo] = campoEl.value.trim() || null;
  else if (campo === 'caducidad') renglon.caducidad = campoEl.value || null;
  else if (campo === 'categoria') renglon.categoria = campoEl.value;
  else renglon[campo] = Number(campoEl.value) || 0;
}

function onClickRevisionImportacion(ev) {
  const btn = ev.target.closest('[data-action="eliminar-renglon-import"]');
  if (!btn) return;
  archivoImportadoParseado.meses[Number(btn.dataset.mes)].bloques[Number(btn.dataset.bloque)].renglones.splice(Number(btn.dataset.renglon), 1);
  renderRevisionImportacion(archivoImportadoParseado);
}

async function confirmarImportacion() {
  if (!archivoImportadoParseado) return;
  const usuario = usuarioActual();
  if (!usuario) return;
  const unidadId = document.getElementById('selUnidad').value;

  const ok = await mostrarModal({
    titulo: 'Confirmar importación',
    mensaje: `Se importarán ${archivoImportadoParseado.meses.length} mes(es) para esta unidad, cerrando automáticamente cada uno que no lo esté ya. Revisa el resumen antes de continuar.`,
    textoAceptar: 'Importar'
  });
  if (!ok) return;

  const btn = document.getElementById('btnConfirmarImportacion');
  const cont = document.getElementById('resultadoImportador');
  btn.disabled = true;
  cont.innerHTML = '<p>Importando… esto puede tardar varios segundos por mes.</p>';
  document.getElementById('revisionImportador').innerHTML = '';
  try {
    const resumen = await BiovacImporter.importParsedData(estado.db, unidadId, archivoImportadoParseado, usuario);
    renderResumenFinal(resumen);
    toast('Importación completada.', 'ok');
    archivoImportadoParseado = null;
    btn.style.display = 'none';
  } catch (e) {
    cont.innerHTML = `<div class="resumen-importador"><p class="err">Error durante la importación: ${e.message}</p></div>`;
    toast('Error al importar: ' + e.message, 'error');
    if (archivoImportadoParseado) renderRevisionImportacion(archivoImportadoParseado);
  } finally {
    btn.disabled = false;
  }
}

function renderResumenFinal(resumen) {
  const cont = document.getElementById('resultadoImportador');
  let html = '<div class="resumen-importador"><p><b>Importación completada:</b></p><ul>';
  for (const m of resumen.meses) {
    if (m.omitido) {
      html += `<li>${m.mes} ${m.anio || ''}: omitido (${m.omitido})</li>`;
      continue;
    }
    if (m.error) {
      html += `<li class="err">${m.mes}: error — ${m.error}</li>`;
      continue;
    }
    html += `<li>${m.mes} ${m.anio}: ${m.insertados} renglón(es) nuevo(s), ${m.actualizados} actualizado(s)${m.omitidos ? `, <span class="aviso">${m.omitidos} omitido(s)</span>` : ''}</li>`;
    if (m.discrepancias && m.discrepancias.length) {
      html += '<ul>' + m.discrepancias.map((d) => `<li class="aviso">${d}</li>`).join('') + '</ul>';
    }
  }
  html += '</ul>';
  if (resumen.noReconocidos.length) html += `<p class="aviso">Biológicos no reconocidos (omitidos): ${resumen.noReconocidos.join(', ')}</p>`;
  html += '</div>';
  cont.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Arranque y delegación de eventos
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  initDb();
  await cargarSesionReal();
  cargarCatalogo();

  document.getElementById('btnCargar').addEventListener('click', () => { estado.correccionBatchId = null; cargarMovimiento(); });
  document.getElementById('btnIniciarMovimiento').addEventListener('click', crearMovimiento);
  document.getElementById('btnGuardarCabecera').addEventListener('click', guardarCabecera);
  document.getElementById('btnCerrarMes').addEventListener('click', cerrarMes);
  document.getElementById('btnAbrirCorreccion').addEventListener('click', abrirCorreccion);
  document.getElementById('btnAplicarCorreccion').addEventListener('click', aplicarCorreccion);
  document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
  document.getElementById('btnVerPdf').addEventListener('click', verPdf);
  document.getElementById('btnAbrirImportador').addEventListener('click', abrirPanelImportador);
  document.getElementById('btnCerrarImportador').addEventListener('click', () => { document.getElementById('panelImportador').style.display = 'none'; });
  document.getElementById('btnAnalizarImportacion').addEventListener('click', analizarArchivoImportacion);
  document.getElementById('btnConfirmarImportacion').addEventListener('click', confirmarImportacion);
  document.getElementById('revisionImportador').addEventListener('change', onCambioRevisionImportacion);
  document.getElementById('revisionImportador').addEventListener('click', onClickRevisionImportacion);

  const cont = document.getElementById('contenedorBloques');
  cont.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-renglon][data-campo]')) {
      marcarCampoSinGuardar(ev.target);
      if (ev.target.dataset.campo !== 'observaciones') recalcularFilaEnVivo(ev.target.dataset.renglon);
      return;
    }
  });
  cont.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-renglon][data-campo]')) { guardarCampoRenglon(ev.target); return; }
    if (ev.target.matches('[data-nuevo-lote], [data-nuevo-lote-canje]')) { onCambioSelectLote(ev.target); return; }
    if (ev.target.matches('[data-nuevo-categoria]')) {
      const panel = ev.target.closest('[data-panel-agregar]');
      if (panel) poblarSelectLoteAgregar(panel);
    }
  });
  // seleccionar todo el contenido al enfocar un número, para que escribir
  // reemplace el "0" en vez de concatenarse ("05")
  cont.addEventListener('focus', (ev) => {
    if (ev.target.matches('input[type=number]')) ev.target.select();
  }, true);
  // al salir del campo de caducidad del "+ Agregar lote", reacomodar lo
  // tecleado (números sueltos) al formato visible "JUL-29"
  cont.addEventListener('blur', (ev) => {
    if (ev.target.matches('[data-nuevo-caducidad], [data-nueva-caducidad-canje]')) {
      const iso = parsearCaducidadInteligente(ev.target.value);
      if (iso) ev.target.value = formatMmmAa(iso);
      return;
    }
  }, true);
  cont.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const accion = btn.dataset.action;

    if (accion === 'eliminar-renglon') { eliminarRenglon(btn.dataset.renglon); return; }

    if (accion === 'toggle-agregar' || accion === 'cancelar-agregar' || accion === 'confirmar-agregar') {
      const panel = document.querySelector(`[data-panel-agregar="${btn.dataset.bio}"]`);
      if (accion === 'toggle-agregar') {
        const abriendo = !panel.classList.contains('abierto');
        panel.classList.toggle('abierto');
        if (abriendo) poblarSelectLoteAgregar(panel);
      }
      if (accion === 'cancelar-agregar') panel.classList.remove('abierto');
      if (accion === 'confirmar-agregar') agregarLote(btn.dataset.bio, panel);
      return;
    }

    if (accion === 'toggle-resolver' || accion === 'cancelar-resolver') {
      const panel = document.querySelector(`[data-panel-arf="${btn.dataset.renglon}"], [data-panel-canje="${btn.dataset.renglon}"]`);
      if (!panel) return;
      if (accion === 'toggle-resolver') {
        const abriendo = !panel.classList.contains('abierto');
        panel.classList.toggle('abierto');
        if (abriendo && panel.dataset.bio) poblarSelectLoteCanje(panel);
      } else {
        panel.classList.remove('abierto');
      }
      return;
    }
    if (accion === 'confirmar-resolver-arf') {
      reactivarArf(btn.dataset.renglon, document.querySelector(`[data-panel-arf="${btn.dataset.renglon}"]`));
      return;
    }
    if (accion === 'confirmar-resolver-canje') {
      resolverCanje(btn.dataset.renglon, document.querySelector(`[data-panel-canje="${btn.dataset.renglon}"]`));
      return;
    }
  });
});

// ---------------------------------------------------------------------------
// Botón flotante de feedback -- mismo mecanismo que el resto de SIREVAQ
// (envía a Discord vía webhook, con imágenes adjuntas opcionales), solo que
// aquí la info de usuario/unidad sale de `estado` (sesión real de BioVac o
// el campo de texto libre) en vez del `USER` global de main.js.
// ---------------------------------------------------------------------------

const DISCORD_WEBHOOK_URL = atob("aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTUxNjE5OTgzNTQzNzM3MTU1My8yU19XYW1qck9PcE5ybUdYbHV3QTdTcmRTa3FhZXNiTXY1aXpzWVByQlN4dnJPaDg0LWZIYThHQlFEanNVYWVLc0VIUw==");

document.addEventListener('DOMContentLoaded', () => {
  const btnFeedbackFAB = document.getElementById('btnFeedbackFAB');
  const feedbackModal = document.getElementById('feedbackModal');
  if (!btnFeedbackFAB || !feedbackModal) return;

  const btnCancelFeedback = document.getElementById('btnCancelFeedback');
  const btnCloseFeedbackHeader = document.getElementById('btnCloseFeedbackHeader');
  const formFeedback = document.getElementById('formFeedback');
  const feedbackImagesInput = document.getElementById('feedbackImagesInput');
  const feedbackUploadArea = document.getElementById('feedbackUploadArea');
  const feedbackPreviewGrid = document.getElementById('feedbackPreviewGrid');
  const btnSelectFilesTrigger = document.getElementById('btnSelectFilesTrigger');

  let uploadedFiles = [];

  btnFeedbackFAB.addEventListener('click', () => feedbackModal.classList.add('show'));

  const renderPreviews = () => {
    if (!feedbackPreviewGrid) return;
    feedbackPreviewGrid.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const item = document.createElement('div');
        item.className = 'feedback-preview-item';
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = `Preview ${index}`;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'feedback-preview-remove';
        removeBtn.innerHTML = '✕';
        removeBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          uploadedFiles.splice(index, 1);
          renderPreviews();
        });
        item.appendChild(img);
        item.appendChild(removeBtn);
        feedbackPreviewGrid.appendChild(item);
      };
      reader.readAsDataURL(file);
    });
  };

  const closeModal = () => {
    feedbackModal.classList.remove('show');
    formFeedback.reset();
    uploadedFiles = [];
    renderPreviews();
  };

  btnCancelFeedback?.addEventListener('click', closeModal);
  btnCloseFeedbackHeader?.addEventListener('click', closeModal);
  feedbackModal.addEventListener('click', (e) => { if (!e.target.closest('.feedback-modal-card')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && feedbackModal.classList.contains('show')) closeModal(); });

  btnSelectFilesTrigger?.addEventListener('click', (e) => { e.preventDefault(); feedbackImagesInput.click(); });

  if (feedbackUploadArea && feedbackImagesInput) {
    feedbackUploadArea.addEventListener('click', () => feedbackImagesInput.click());
    feedbackUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); feedbackUploadArea.classList.add('dragover'); });
    feedbackUploadArea.addEventListener('dragleave', () => feedbackUploadArea.classList.remove('dragover'));
    feedbackUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      feedbackUploadArea.classList.remove('dragover');
      if (e.dataTransfer.files) {
        Array.from(e.dataTransfer.files).forEach((file) => { if (file.type.startsWith('image/')) uploadedFiles.push(file); });
        renderPreviews();
      }
    });
  }

  feedbackImagesInput?.addEventListener('change', (e) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file) => { if (file.type.startsWith('image/')) uploadedFiles.push(file); });
      renderPreviews();
      feedbackImagesInput.value = '';
    }
  });

  feedbackModal.addEventListener('paste', (e) => {
    if (!feedbackModal.classList.contains('show')) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasImage = false;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const pFile = new File([file], `paste_${Date.now()}.png`, { type: file.type });
          uploadedFiles.push(pFile);
          hasImage = true;
        }
      }
    }
    if (hasImage) renderPreviews();
  });

  formFeedback.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.getElementById('feedbackType').value;
    const moduleVal = document.getElementById('feedbackModule').value;
    const message = document.getElementById('feedbackMessage').value;
    const submitBtn = document.getElementById('btnSubmitFeedback');

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-symbols-rounded">refresh</span> Enviando...';
    submitBtn.disabled = true;

    const userName = nombreCompletoDePerfil(estado.perfil) || document.getElementById('selUsuario')?.value.trim() || 'Usuario anónimo';
    const userRole = estado.perfil?.rol || 'N/A (sin sesión real)';
    const unidadSel = document.getElementById('selUnidad');
    const unidadTexto = unidadSel?.selectedOptions[0]?.textContent || 'N/A';
    const periodo = estado.movimiento ? `${MESES.find((m) => m.v === estado.movimiento.mes)?.l || estado.movimiento.mes} ${estado.movimiento.anio} (${estado.movimiento.estado})` : 'N/A (sin movimiento cargado)';

    let embedColor = 3447003;
    let typeEmoji = '❓ Pregunta/Duda';
    if (type === 'Sugerencia') { embedColor = 16766720; typeEmoji = '💡 Sugerencia'; }
    else if (type === 'Error') { embedColor = 15158332; typeEmoji = '🚨 Reporte de Error'; }

    const embed = {
      title: `[Movimiento de Biológico] ${typeEmoji}`,
      description: `**Mensaje del Usuario:**\n${message}`,
      color: embedColor,
      fields: [
        { name: '👤 Usuario', value: userName, inline: true },
        { name: '🔑 Rol', value: userRole, inline: true },
        { name: '🏥 Unidad', value: unidadTexto, inline: true },
        { name: '📅 Periodo', value: periodo, inline: true },
        { name: '🛠️ Sección afectada', value: moduleVal, inline: true }
      ],
      footer: { text: 'SIREVAQ · Movimiento de Biológico' },
      timestamp: new Date().toISOString()
    };
    if (uploadedFiles.length > 0) embed.image = { url: 'attachment://image_0.png' };

    const formData = new FormData();
    formData.append('payload_json', JSON.stringify({ embeds: [embed] }));
    uploadedFiles.forEach((file, index) => {
      const extension = file.name.split('.').pop() || 'png';
      formData.append(`files[${index}]`, file, `image_${index}.${extension}`);
    });

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error al enviar a Discord');
      toast('¡Gracias! Hemos recibido tu mensaje y capturas correctamente.', 'ok');
      closeModal();
    } catch (err) {
      toast('Hubo un problema al enviar tu mensaje. Intenta de nuevo más tarde.', 'error');
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  });
});
