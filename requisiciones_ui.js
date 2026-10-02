// ============================================================================
// Requisiciones — UI de captura (Jurisdicción -> Municipio/Hospitales -> Unidad)
//
// Mismo patrón que Biovac (biovac_ui.js): cliente Supabase propio que hereda
// la sesión ya iniciada en index.html (misma URL/anon key, mismo origen).
// Postgres (supabase/requi_engine.sql) es la autoridad de validación; este
// archivo solo espeja esa lógica (requi_engine.js) para dar feedback
// instantáneo y atrapar el error del trigger si aun así se excede.
//
// La captura web es un diseño propio (lista expandible), NO una réplica del
// Excel oficial -- eso se reserva para la exportación (requisiciones_export_
// excel.js), que sí clona el archivo real celda por celda.
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' }, { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' }, { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' }, { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' }
];
const MESES_ABREV3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// 4 municipios reales + 2 hospitales (el "Hospital General" viejo ya no
// existe), todos hermanos entre sí -- cada hospital lleva su propia
// requisición. A diferencia de los municipios, los hospitales se tratan
// como "unidad" para firmas: nunca llevan nombre de quien recibe
// precapturado (ver esHospital más abajo).
const DESTINOS = [
  { v: 'CORREGIDORA', l: 'Corregidora' },
  { v: 'HUIMILPAN', l: 'Huimilpan' },
  { v: 'MARQUES', l: 'El Marqués' },
  { v: 'QUERETARO', l: 'Querétaro' },
  { v: 'NHG', l: 'Nuevo Hospital General' },
  { v: 'HENM', l: 'HENM' }
];
const MUNICIPIOS_REALES = DESTINOS.slice(0, 4); // solo estos tienen unidades (Paso 3) y firma cacheada
function esHospital(destino) { return destino === 'NHG' || destino === 'HENM'; }

const NOMBRE_DESTINO_EXPORT = {
  CORREGIDORA: 'MUNICIPIO CORREGIDORA', HUIMILPAN: 'MUNICIPIO HUIMILPAN',
  MARQUES: 'MUNICIPIO EL MARQUÉS', QUERETARO: 'MUNICIPIO QUERÉTARO',
  NHG: 'NUEVO HOSPITAL GENERAL DE QUERÉTARO', HENM: 'HOSPITAL DE ESPECIALIDADES DEL NIÑO Y LA MUJER'
};
const DIRECCION_HOSPITAL = {
  NHG: 'Adalberto Martínez n.448, La Joya, Querétaro, Qro.',
  HENM: 'Av. Luis Vega Monrroy n.410, Colinas del Cimatario, Querétaro, Qro.'
};
const DIRECCION_JURISDICCION = 'Circuito Moises Solana S/N, Col. Vista Alegre, Santiago de Querétaro. Qro.';
const COPIAS_SUGERIDAS = { JURISDICCIONAL: 2, MUNICIPAL: 2, UNIDAD: 3 };

// Mismos colores que ya usa BioVac por biológico (CLAVE_COLORES en
// biovac_ui.js) -- una vacuna se ve del mismo color en toda la app, no solo
// aquí. Los selects de Biológico/Lote de Paso 2 y 3 eran texto plano puro
// (sin nada que distinga un biológico de otro de un vistazo, reportado por
// el usuario); ahora cada opción lleva un punto de color + la tarjeta de
// vista previa junto a los selects repite el mismo color en grande.
const COLOR_POR_CODIGO_ARTICULO = {
  '146': '#3D405B', '148': '#3D405B', '150': '#264653', '6135': '#9ACD32', '2526': '#C43D3D',
  '3825': '#4b5563', '3800': '#7B5EA7', '3801': '#3A86B7', '3802': '#0f172a', '3805': '#E9C46A',
  '3808': '#E76F51', '3810': '#5C5C5C', '6056': '#059669', '3820': '#B23A48', '3821': '#B23A48',
  '6317': '#C26750', '3832': '#0f172a', '6501': '#2A9D8F', '2': '#0f172a', '6509': '#A66B50',
  '6502': '#6D28D9', '6506': '#1D4ED8', '6508': '#3D405B', '6187': '#4b5563'
};

// Lote marcador para capturar cantidades antes de que lleguen los lotes reales
// (ver requi_covid_lotes_pendientes_transferencias.sql: requi_asignar_lotes lo
// reemplaza por 1 o más lotes y reacomoda el reparto ya hecho).
const LOTE_PENDIENTE = 'POR DEFINIR';
function esPendiente(item) { return !!item && item.requi_lotes && item.requi_lotes.numero_lote === LOTE_PENDIENTE; }
function colorDeBio(bio) { return COLOR_POR_CODIGO_ARTICULO[bio?.codigo_articulo] || '#0f172a'; }

const estado = {
  db: null,
  perfil: null,
  catalogo: [],       // requi_catalogo_biologicos
  unidades: [],        // requi_unidades (solo los 4 municipios reales)
  requisicion: null,   // requi_requisiciones actual
  items: [],           // requi_items_jurisdiccion
  distMunicipio: [],   // requi_distribucion_municipio
  distUnidad: [],      // requi_distribucion_unidad
  lotesPorBiologico: {},
  unidadPorId: {},
  puedeEditar: false,
  plantillaBuffer: null,
  pasoActual: 1,
  bioRapido: null,     // biológico elegido en la captura rápida (Paso 1)
  soloConLotes: false, // Paso 1: ocultar biológicos sin lotes
  filtroBio2: '',      // Paso 2: biológico filtrado ('' = todos)
  municipioPaso3: 'CORREGIDORA',
  avance: null,
  previa: null,        // reparto del mes anterior (para "Sugerir")
  pegado: [],
  pegadoToken: 0,
  entregasMes: [],     // requisiciones (entregas) del año/mes elegido
  guardado: { escribiendo: 0, ultimo: null, error: null, rafagaConError: false },   // estado de guardado (ver instrumentarEscrituras)
  asig: null,          // modal "Asignar lotes"
  transferencias: [],
  guardandoRapido: false,
  cola: Promise.resolve()
};

function $(id) { return document.getElementById(id); }

function toast(msg, esError) {
  toast.ultimo = { error: !!esError, cuando: Date.now() };
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!esError);
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), esError ? 5500 : 2600);
}

function valorOnull(id) { return $(id).value.trim() || null; }

function flashGuardado(el) {
  const celdas = el.tagName === 'TR' ? el.querySelectorAll('td') : [el];
  celdas.forEach((td) => td.classList.add('celda-guardada'));
  setTimeout(() => celdas.forEach((td) => td.classList.remove('celda-guardada')), 900);
}

// ---------------------------------------------------------------------------
// Fechas de caducidad — mismo formato y mismo parser inteligente que ya usa
// Biovac (formatMmmAa / parsearCaducidadInteligente en biovac_ui.js): se
// muestra "FEB-27" y se captura tecleando solo números (270228, 02-27, etc.)
// ---------------------------------------------------------------------------

function ultimoDiaMes(anio, mes) {
  const dia = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Para escribir una fecha en una celda de Excel (vía ExcelJS) hace falta
// 'Z' -- ExcelJS serializa Date a número de serie usando sus componentes
// UTC, así que un Date de medianoche LOCAL (America/Mexico_City, UTC-6)
// se serializa con ".25" de fracción de día (6/24) en vez de un entero
// limpio. formatMmmAa/parsearCaducidadInteligente de abajo SÍ deben seguir
// en hora local (son para pantalla, no para Excel) -- no tocar esos.
function fechaExcelUtc(fechaIso) {
  const iso = fechaIso || new Date().toISOString().slice(0, 10);
  return new Date(iso + 'T00:00:00Z');
}

function formatMmmAa(fechaIso) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return `${MESES_ABREV3[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

// Captura: DD-MM-AA (también 150729, 15/07/29, 07-29 o JUL-29). Lo que se MUESTRA en
// tablas y exportaciones sigue siendo MMM-AA (JUL-29); al teclear se enseña esa vista
// a un lado para confirmar que se entendió bien.
function formatDdMmAa(fechaIso) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
}

// "15 de julio de 2029": al pasar el mouse sobre una caducidad (JUL-29) se ve completa, con el día.
function fechaLarga(fechaIso) {
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}
function cadHtml(fechaIso) {
  if (!fechaIso) return '—';
  return `<span class="cad-tip" title="${esc(fechaLarga(fechaIso))}">${esc(formatMmmAa(fechaIso))}</span>`;
}

function vistaCaducidad(texto) {
  if (!String(texto || '').trim()) return '';
  const iso = parsearCaducidadInteligente(texto);
  return iso ? `= ${formatMmmAa(iso)}` : 'No la entiendo';
}

// Máscara al teclear: 31 -> "31-" (salta solo al mes), 06 -> "31-06-", 29 -> "31-06-29" y ahí se detiene
// (nunca acepta más dígitos). Un 4-9 como primer dígito del día (o 2-9 del mes) se completa con un 0.
// Si se teclea un separador (- / . o espacio) se completa el bloque con ceros: "7-" -> "07-".
// JUL-29 (con letras) se respeta tal cual.
function mascaraDigitosFecha(d) {
  let i = 0;
  const grupos = [];
  const toma = (primeroMax) => {
    if (i >= d.length) return null;
    const a = d[i++];
    if (Number(a) > primeroMax) return '0' + a;
    if (i < d.length) return a + d[i++];
    return a;
  };
  const dia = toma(3);
  if (dia === null) return '';
  grupos.push(dia);
  if (dia.length === 2) {
    const mes = toma(1);
    if (mes !== null) {
      grupos.push(mes);
      if (mes.length === 2) {
        let anio = '';
        while (anio.length < 2 && i < d.length) anio += d[i++];
        if (anio) grupos.push(anio);
      }
    }
  }
  const ultimo = grupos[grupos.length - 1];
  return grupos.join('-') + (grupos.length < 3 && ultimo.length === 2 ? '-' : '');
}

function formatearFechaTecleada(raw, ev) {
  const tipo = (ev && ev.inputType) || '';
  if (tipo.startsWith('delete') || /[a-zñ]/i.test(raw)) return raw;     // al borrar no se reacomoda
  const hayOtro = /[^0-9]/.test(raw);
  const pegado = tipo === 'insertFromPaste' || tipo === 'insertFromDrop';
  const terminaEnSep = /[^0-9]$/.test(raw);
  if (hayOtro && (pegado || terminaEnSep)) {
    const t = raw.split(/[^0-9]+/).filter(Boolean).slice(0, 3).map((x, i) => (i === 2 ? x.slice(-2) : x.padStart(2, '0')));
    if (!t.length) return '';
    return t.join('-') + (t.length < 3 && terminaEnSep && !pegado ? '-' : '');
  }
  const digitos = raw.replace(/\D/g, '');
  if (pegado && digitos.length === 8) return `${digitos.slice(0, 2)}-${digitos.slice(2, 4)}-${digitos.slice(6, 8)}`;   // 15072029
  return mascaraDigitosFecha(digitos.slice(0, 8));
}

// Aplica la máscara al campo; devuelve true si acaba de quedar una fecha completa y válida.
function aplicarMascaraFecha(ev) {
  const inp = ev.target;
  const nuevo = formatearFechaTecleada(inp.value, ev);
  if (nuevo !== inp.value) inp.value = nuevo;
  return String(ev.inputType || '').startsWith('insert') && /^\d\d-\d\d-\d\d$/.test(nuevo) && !!parsearCaducidadInteligente(nuevo);
}

function actualizarVistaCad(inp) {
  const span = inp.parentElement && inp.parentElement.querySelector('.cad-vista');
  if (!span) return;
  const v = vistaCaducidad(inp.value);
  span.textContent = v;
  span.classList.toggle('mal', v === 'No la entiendo');
}

function parsearCaducidadInteligente(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const mMmmAa = t.match(/^([A-ZÑ]{3})-(\d{2})$/i);
  if (mMmmAa) {
    const idx = MESES_ABREV3.indexOf(mMmmAa[1].toUpperCase());
    if (idx === -1) return null;
    return ultimoDiaMes(2000 + Number(mMmmAa[2]), idx + 1);
  }
  const partes = t.split(/[^0-9]+/).filter(Boolean);
  let dd = null, mm, yy;
  if (partes.length === 3) { [dd, mm, yy] = partes; }
  else if (partes.length === 2) { [mm, yy] = partes; }
  else if (partes.length === 1) {
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

function initDb() {
  estado.db = instrumentarEscrituras(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
}

// ---------------------------------------------------------------------------
// Estado de guardado. Todo se guarda al instante (al salir de una celda, con Enter, con
// "Agregar"…), pero antes no se veía: ahora cada escritura a la base se cuenta aquí y el chip
// de la barra de abajo muestra "Guardando…", "Todo guardado · hace 5 s", "Falta guardar" (hay
// algo tecleado sin confirmar) o "No se guardó" (la base lo rechazó). El botón Guardar (o
// Ctrl+S) confirma lo tecleado y avisa cuando todo quedó guardado.
// ---------------------------------------------------------------------------

const TABLAS_SIN_AVISO = new Set(['requi_pdf_generados', 'r2_objects']);   // bitácoras: no son "lo que captura el usuario"

function instrumentarEscrituras(cliente) {
  const from = cliente.from.bind(cliente);
  cliente.from = (tabla) => {
    const constructor = from(tabla);
    if (TABLAS_SIN_AVISO.has(tabla)) return constructor;
    ['insert', 'upsert', 'update', 'delete'].forEach((m) => {
      if (typeof constructor[m] !== 'function') return;
      const original = constructor[m].bind(constructor);
      constructor[m] = (...args) => marcarEscritura(original(...args));
    });
    return constructor;
  };
  if (typeof cliente.rpc === 'function') {
    const rpc = cliente.rpc.bind(cliente);
    cliente.rpc = (...args) => marcarEscritura(rpc(...args));
  }
  return cliente;
}

// Cuenta la escritura cuando se ejecuta (al hacer await) y registra cómo terminó.
function marcarEscritura(constructor) {
  const original = constructor.then.bind(constructor);
  constructor.then = (ok, ko) => {
    inicioEscritura();
    return original(
      (res) => { finEscritura(res && res.error ? res.error : null); return ok ? ok(res) : res; },
      (err) => { finEscritura(err || { message: 'Sin conexión' }); if (ko) return ko(err); throw err; }
    );
  };
  return constructor;
}

function inicioEscritura() {
  const g = estado.guardado;
  if (g.escribiendo === 0) g.rafagaConError = false;
  g.escribiendo++;
  actualizarEstadoGuardado();
}

function finEscritura(error) {
  const g = estado.guardado;
  g.escribiendo = Math.max(0, g.escribiendo - 1);
  if (error) { g.rafagaConError = true; g.error = String(error.message || error).replace(/^.*?ERROR:\s*/, ''); }
  if (g.escribiendo === 0) {
    if (!g.rafagaConError) { g.error = null; g.ultimo = Date.now(); pulsoGuardado(); }
    actualizarEstadoGuardado();
  } else {
    actualizarEstadoGuardado();
  }
}

function pulsoGuardado() {
  const chip = $('dockGuardado');
  if (!chip) return;
  chip.classList.remove('pulso');
  void chip.offsetWidth;       // reinicia la animación
  chip.classList.add('pulso');
}

function haceCuanto(ms) {
  const seg = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seg < 8) return 'hace un momento';
  if (seg < 60) return `hace ${seg} s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

// Celdas de las matrices con una cantidad tecleada que todavía no coincide con lo guardado.
function celdasSinGuardar() {
  const cambios = [];
  document.querySelectorAll('#matrizMunicipio input.celda, #matrizUnidad input.celda').forEach((inp) => {
    const c = cambioDeInput(inp);
    if (c.cantidad !== cantidadGuardada(c)) cambios.push(c);
  });
  return cambios;
}

// Lo que está tecleado pero aún no se guardó.
function sinGuardar() {
  const lista = [];
  if (!estado.requisicion || !estado.puedeEditar) return lista;
  const rap = estado.bioRapido && ['rapLote', 'rapCad', 'rapCant'].some((id) => $(id).value.trim());
  if (rap) lista.push({ tipo: 'rapida', titulo: 'Captura rápida sin agregar', texto: 'Tienes un lote escrito: falta darle Agregar.' });
  if (document.querySelector('tr.fila-lote-capturado .btn-guardar-edicion')) lista.push({ tipo: 'edicion', titulo: 'Renglón en edición', texto: 'Falta confirmar con la palomita.' });
  const celdas = celdasSinGuardar().length;
  if (celdas) lista.push({ tipo: 'celdas', titulo: `${plural(celdas, 'celda', 'celdas')} sin confirmar`, texto: 'Se guardan al salir de la celda o con Enter.' });
  return lista;
}

// Lo que falta por completar (no es obligatorio, pero conviene verlo antes de cerrar la entrega).
function pendientesDeCaptura() {
  const lista = [];
  if (!estado.requisicion) return lista;
  const porDefinir = estado.items.filter((i) => esPendiente(i) && Number(i.cantidad_surtida) > 0);
  if (porDefinir.length) lista.push({ paso: 1, icono: 'hourglass_top', titulo: `${plural(porDefinir.length, 'biológico con lote por definir', 'biológicos con lote por definir')}`, texto: 'Asigna los lotes cuando lleguen.', ir: 'Ir al paso 1' });
  const av = estado.avance || calcularAvance();
  const resumen = (arr) => ({ vacio: arr.filter((x) => x.est === 'vacio').length, parcial: arr.filter((x) => x.est === 'parcial').length });
  const frase = ({ vacio, parcial }) => [vacio ? `${plural(vacio, 'sin repartir', 'sin repartir')}` : '', parcial ? `${plural(parcial, 'con saldo', 'con saldo')}` : ''].filter(Boolean).join(' · ');
  const r2 = resumen(av.p2), r3 = resumen(av.p3);
  if (r2.vacio + r2.parcial) lista.push({ paso: 2, icono: 'alt_route', titulo: 'Paso 2: reparto a municipios y hospitales', texto: frase(r2), ir: 'Ir al paso 2' });
  if (r3.vacio + r3.parcial) lista.push({ paso: 3, icono: 'local_hospital', titulo: 'Paso 3: reparto a unidades', texto: frase(r3), ir: 'Ir al paso 3' });
  return lista;
}

function faseGuardado() {
  const g = estado.guardado;
  if (g.escribiendo > 0) return 'guardando';
  if (g.error) return 'error';
  if (sinGuardar().length) return 'sucio';
  return 'ok';
}

function actualizarEstadoGuardado() {
  const chip = $('dockGuardado');
  if (!chip) return;
  const g = estado.guardado;
  const fase = faseGuardado();
  const sin = fase === 'sucio' ? sinGuardar() : [];
  const pend = pendientesDeCaptura();
  const textos = {
    ok: ['Todo guardado', g.ultimo ? haceCuanto(g.ultimo) : 'Se guarda solo al instante', 'cloud_done'],
    guardando: ['Guardando…', 'un momento', 'sync'],
    sucio: ['Falta guardar', sin[0] ? sin[0].titulo : '', 'edit_note'],
    error: ['No se guardó', g.error || 'Revisa lo marcado en rojo', 'cloud_off']
  };
  const [titulo, texto, icono] = textos[fase];
  chip.classList.remove('ok', 'guardando', 'sucio', 'error');
  chip.classList.add(fase);
  $('dockGuardadoIcono').textContent = icono;
  $('dockGuardadoTitulo').textContent = titulo;
  $('dockGuardadoTexto').textContent = texto;
  $('dockGuardadoTexto').title = texto;
  const temas = sin.length + pend.length;
  $('dockGuardadoPend').textContent = temas || '';
  $('dockGuardadoPend').style.display = temas ? 'inline-flex' : 'none';
  chip.setAttribute('aria-label', `${titulo}. ${texto}${temas ? `. ${plural(temas, 'tema pendiente', 'temas pendientes')}` : ''}`);
  const btn = $('btnGuardarTodo');
  if (btn) {
    btn.classList.toggle('en-reposo', fase === 'ok' || fase === 'guardando');
    btn.title = fase === 'ok' ? 'Todo está guardado (Ctrl+S)' : 'Guardar lo que está pendiente (Ctrl+S)';
  }
  $('avisoGuardado').textContent = `${titulo}. ${texto}`;
  if ($('panelPendientes').style.display !== 'none') renderPanelPendientes();
}

function renderPanelPendientes() {
  const g = estado.guardado;
  const fase = faseGuardado();
  const sin = sinGuardar();
  const pend = pendientesDeCaptura();
  const cab = {
    ok: ['cloud_done', 'Todo guardado', g.ultimo ? `Último guardado ${haceCuanto(g.ultimo)}. Lo que capturas se guarda solo.` : 'Lo que capturas se guarda solo, al salir de cada celda o al dar Agregar.'],
    guardando: ['sync', 'Guardando…', 'Un momento, se está enviando a la base.'],
    sucio: ['edit_note', 'Falta guardar', 'Hay datos tecleados que todavía no se confirmaron.'],
    error: ['cloud_off', 'No se guardó', g.error || 'La base rechazó el último cambio.']
  }[fase];
  const filaSin = sin.map((x) => `<li class="pp-item aviso"><span class="material-symbols-rounded">edit_note</span><div><b>${esc(x.titulo)}</b><small>${esc(x.texto)}</small></div><button type="button" class="btn btn-primary btn-sm" data-pp="guardar">Guardar</button></li>`).join('');
  const filaPend = pend.map((x) => `<li class="pp-item"><span class="material-symbols-rounded">${x.icono}</span><div><b>${esc(x.titulo)}</b><small>${esc(x.texto)}</small></div><button type="button" class="btn btn-outline btn-sm" data-pp="paso${x.paso}">${esc(x.ir)}</button></li>`).join('');
  const cerrada = estado.requisicion && estado.requisicion.estado === 'CERRADA';
  const todoAlDia = !sin.length && !pend.length;
  $('panelPendientes').innerHTML = `
    <div class="pp-cab ${fase}"><span class="material-symbols-rounded">${cab[0]}</span><div><b>${cab[1]}</b><small>${esc(cab[2])}</small></div></div>
    ${sin.length ? `<div class="pp-sec">Sin guardar</div><ul class="pp-lista">${filaSin}</ul>` : ''}
    ${pend.length ? `<div class="pp-sec">Por completar</div><ul class="pp-lista">${filaPend}</ul>` : ''}
    ${todoAlDia ? `<div class="pp-vacio"><span class="material-symbols-rounded">task_alt</span>No queda nada pendiente.${cerrada ? ' La entrega ya está cerrada.' : ' Ya puedes cerrar la entrega.'}</div>` : ''}
    <div class="pp-pie"><kbd>Ctrl</kbd> + <kbd>S</kbd> guarda lo pendiente</div>`;
}

function alternarPanelPendientes(forzar) {
  const panel = $('panelPendientes');
  const abrir = typeof forzar === 'boolean' ? forzar : panel.style.display === 'none';
  if (abrir) { renderPanelPendientes(); panel.style.display = 'block'; } else panel.style.display = 'none';
  $('dockGuardado').setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function esperarEscrituras(maxMs) {
  return new Promise((resolve) => {
    const limite = Date.now() + (maxMs || 6000);
    const mirar = () => (estado.guardado.escribiendo === 0 || Date.now() > limite ? resolve() : setTimeout(mirar, 40));
    mirar();
  });
}

// Botón Guardar / Ctrl+S: confirma lo tecleado y espera a que todo llegue a la base.
async function guardarTodo() {
  if (!estado.puedeEditar || !estado.requisicion) return;
  const antes = sinGuardar();
  const hizoAlgo = antes.length > 0;
  if (antes.some((x) => x.tipo === 'rapida')) await agregarRapido();
  const edicion = document.querySelector('tr.fila-lote-capturado .btn-guardar-edicion');
  if (edicion) await guardarEdicionItem(edicion.dataset.item);
  const cambios = celdasSinGuardar();
  if (cambios.length) await guardarReparto(cambios);
  await estado.cola;
  await esperarEscrituras();
  actualizarEstadoGuardado();
  const fase = faseGuardado();
  if (fase === 'ok') toast(hizoAlgo ? 'Todo guardado ✓' : 'Ya estaba todo guardado ✓');
  else if (fase === 'error') toast('No se guardó: ' + estado.guardado.error, true);
  else if (fase === 'sucio' && !(toast.ultimo && toast.ultimo.error && Date.now() - toast.ultimo.cuando < 800)) {
    toast('Aún falta algo por guardar: ' + sinGuardar()[0].titulo.toLowerCase() + '.', true);   // (si ya salió el aviso concreto, no se pisa)
  }
}

async function cargarSesionReal() {
  const { data: { session } } = await estado.db.auth.getSession();
  if (!session) {
    toast('No hay sesión activa. Inicia sesión en SIREVAQ primero.', true);
    $('badgeRol').textContent = 'Sin sesión';
    return;
  }
  const { data: perfil } = await estado.db.from('perfiles')
    .select('id, usuario, rol, municipio_asignado, municipios_allowed')
    .eq('id', session.user.id).maybeSingle();
  if (!perfil) { toast('No se encontró el perfil del usuario.', true); return; }
  estado.perfil = perfil;
  const rol = String(perfil.rol || '').toUpperCase();
  estado.puedeEditar = rol === 'ADMIN' || rol === 'JURISDICCIONAL';
  $('badgeRol').textContent = `${perfil.usuario} · ${perfil.rol}`;
  document.getElementById('pagina').setAttribute('data-solo-lectura', estado.puedeEditar ? '0' : '1');
}

function pillComparador(resultado) {
  if (resultado.estado === 'EXISTE') return `<span class="pill pill-ok badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">check_circle</span> Lote conocido (${resultado.lote.caducidad ? cadHtml(resultado.lote.caducidad) : 'sin caducidad'})</span>`;
  if (resultado.estado === 'SIMILAR') return `<span class="pill pill-warn badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">warning</span> ¿"${esc(resultado.sugerencias[0].numero_lote)}"?</span>`;
  if (resultado.estado === 'NUEVO') return `<span class="pill pill-new badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">fiber_new</span> Nuevo</span>`;
  return '';
}

// ---------------------------------------------------------------------------
// Responsables (Elaboró/Autorizó/Entrega/Recibe) — configuración fija por
// nivel/destino, NO por requisición: el mismo responsable firma mes tras
// mes, así que se captura una sola vez y se reutiliza (caché) hasta que
// cambie. Cada municipio tiene su propia tarjeta (entrega/recibe distinto
// en cada uno). Los hospitales no aparecen aquí -- cuentan como unidad,
// firman a mano y anotan su propio nombre en el papel.
// ---------------------------------------------------------------------------

async function cargarFirmasJurisdiccionales() {
  const { data } = await estado.db.from('requi_firmas').select('*')
    .eq('nivel', 'JURISDICCIONAL').eq('destino', 'JURISDICCION').maybeSingle();
  const d = data || {};
  $('jurElaboroNombre').value = d.elaboro_nombre || '';
  $('jurElaboroCargo').value = d.elaboro_cargo || '';
  $('jurAutorizoNombre').value = d.autorizo_nombre || '';
  $('jurAutorizoCargo').value = d.autorizo_cargo || '';
  $('jurEntregaNombre').value = d.entrega_nombre || '';
  $('jurEntregaCargo').value = d.entrega_cargo || '';
  $('jurRecibeNombre').value = d.recibe_nombre || '';
  $('jurRecibeCargo').value = d.recibe_cargo || '';
}

async function guardarFirmasJurisdiccionales() {
  const payload = {
    nivel: 'JURISDICCIONAL', destino: 'JURISDICCION',
    elaboro_nombre: valorOnull('jurElaboroNombre'), elaboro_cargo: valorOnull('jurElaboroCargo'),
    autorizo_nombre: valorOnull('jurAutorizoNombre'), autorizo_cargo: valorOnull('jurAutorizoCargo'),
    entrega_nombre: valorOnull('jurEntregaNombre'), entrega_cargo: valorOnull('jurEntregaCargo'),
    recibe_nombre: valorOnull('jurRecibeNombre'), recibe_cargo: valorOnull('jurRecibeCargo')
  };
  const { error } = await estado.db.from('requi_firmas').upsert(payload, { onConflict: 'nivel,destino' });
  if (error) { toast('No se pudieron guardar: ' + error.message, true); return; }
  toast('Responsables jurisdiccionales guardados.');
}

async function renderFirmasMunicipio() {
  const cont = $('listaFirmasMunicipio');
  const { data } = await estado.db.from('requi_firmas').select('*').eq('nivel', 'MUNICIPAL');
  const porDestino = {};
  (data || []).forEach((f) => { porDestino[f.destino] = f; });

  cont.innerHTML = MUNICIPIOS_REALES.map((m) => {
    const d = porDestino[m.v] || {};
    return `
      <div class="barra" data-firma-municipio="${m.v}" style="padding:10px 12px; background:var(--surface-container); border-radius:12px;">
        <div class="campo" style="min-width:110px;"><label>Municipio</label><div style="font-weight:800; padding:9px 0;">${m.l}</div></div>
        <div class="campo"><label>Entrega — Nombre</label><input type="text" class="inp-firma-entrega-n" value="${(d.entrega_nombre || '').replace(/"/g, '&quot;')}"></div>
        <div class="campo"><label>Entrega — Cargo</label><input type="text" class="inp-firma-entrega-c" value="${(d.entrega_cargo || '').replace(/"/g, '&quot;')}"></div>
        <div class="campo"><label>Recibe — Nombre</label><input type="text" class="inp-firma-recibe-n" value="${(d.recibe_nombre || '').replace(/"/g, '&quot;')}"></div>
        <div class="campo"><label>Recibe — Cargo</label><input type="text" class="inp-firma-recibe-c" value="${(d.recibe_cargo || '').replace(/"/g, '&quot;')}"></div>
        <button class="btn btn-primary btn-sm" data-guardar-firma-municipio="${m.v}"><span class="material-symbols-rounded" style="font-size:14px">save</span> Guardar</button>
      </div>
    `;
  }).join('');

  cont.querySelectorAll('[data-guardar-firma-municipio]').forEach((btn) => {
    btn.addEventListener('click', () => guardarFirmasMunicipio(btn.dataset.guardarFirmaMunicipio));
  });
}

async function guardarFirmasMunicipio(destino) {
  const fila = document.querySelector(`[data-firma-municipio="${destino}"]`);
  const payload = {
    nivel: 'MUNICIPAL', destino,
    entrega_nombre: fila.querySelector('.inp-firma-entrega-n').value.trim() || null,
    entrega_cargo: fila.querySelector('.inp-firma-entrega-c').value.trim() || null,
    recibe_nombre: fila.querySelector('.inp-firma-recibe-n').value.trim() || null,
    recibe_cargo: fila.querySelector('.inp-firma-recibe-c').value.trim() || null
  };
  const { error } = await estado.db.from('requi_firmas').upsert(payload, { onConflict: 'nivel,destino' });
  if (error) { toast('No se pudieron guardar: ' + error.message, true); return; }
  toast(`Responsables de ${destino} guardados.`);
}

// ---------------------------------------------------------------------------
// Cabecera (año/mes/folio)
// ---------------------------------------------------------------------------

function poblarSelectoresCabecera() {
  const anioActual = new Date().getFullYear();
  const selAnio = $('selAnio');
  selAnio.innerHTML = [anioActual - 1, anioActual, anioActual + 1]
    .map((a) => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');
  const selMes = $('selMes');
  const mesActual = new Date().getMonth() + 1;
  selMes.innerHTML = MESES.map((m) => `<option value="${m.v}" ${m.v === mesActual ? 'selected' : ''}>${m.l}</option>`).join('');
}

async function cargarCatalogoYUnidades() {
  const [{ data: catalogo }, { data: unidades }] = await Promise.all([
    estado.db.from('requi_catalogo_biologicos').select('*').eq('activo', true).order('orden'),
    estado.db.from('requi_unidades').select('*').eq('activo', true).order('municipio').order('clues')
  ]);
  // Biológicos en el mismo orden que los renglones del formato de requisición
  // (columna `orden` del catálogo = fila de la plantilla oficial).
  estado.catalogo = (catalogo || []).slice().sort((a, b) => Number(a.orden) - Number(b.orden));
  // Unidades: primero por municipio (en el orden de MUNICIPIOS_REALES) y dentro
  // de cada uno por número de CLUES; las que no tengan CLUES van al final, por nombre.
  const idxMuni = (m) => { const i = DESTINOS.findIndex((x) => x.v === m); return i < 0 ? 99 : i; };
  const cmp = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });
  estado.unidades = (unidades || []).slice().sort((a, b) =>
    idxMuni(a.municipio) - idxMuni(b.municipio)
    || (a.clues && b.clues ? cmp(a.clues, b.clues) : (a.clues ? -1 : b.clues ? 1 : 0))
    || cmp(a.nombre, b.nombre));
  estado.unidadPorId = Object.fromEntries(estado.unidades.map((u) => [u.id, u]));
}

async function guardarCabecera() {
  if (!estado.puedeEditar) return;
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  const entrega = (estado.requisicion && estado.requisicion.anio === anio && estado.requisicion.mes === mes)
    ? estado.requisicion.entrega : 1;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .upsert({ anio, mes, entrega, creado_por: estado.perfil.usuario }, { onConflict: 'anio,mes,entrega' })
    .select().single();
  if (error) { toast('No se pudo guardar la cabecera: ' + error.message, true); return; }
  toast('Requisición guardada.');
  await cargarRequisicion(data.entrega);
}

// Cada entrega del mes es su propia requisición (mismos pasos, su propio reparto, su
// propio Excel): esquema básico, influenza, etc. Las pestañas de "Entrega N" cambian de una a otra.
async function cargarEntregasMes(anio, mes) {
  const { data, error } = await estado.db.from('requi_requisiciones').select('*')
    .eq('anio', anio).eq('mes', mes).order('entrega');
  if (error) { toast('Error al cargar: ' + error.message, true); return false; }
  estado.entregasMes = data || [];
  return true;
}

function renderEntregas() {
  const barra = $('barraEntregas');
  const lista = estado.entregasMes;
  if (!lista.length) { barra.style.display = 'none'; return; }
  barra.style.display = 'flex';
  barra.querySelector('.entregas-chips').innerHTML = lista.map((e) => `
    <button type="button" class="chip-bio ${estado.requisicion && estado.requisicion.id === e.id ? 'activo' : ''}" data-entrega="${e.entrega}" style="--c:#0284c7">
      <i></i>Entrega ${e.entrega}${e.etiqueta ? `<b>${esc(e.etiqueta)}</b>` : ''}
    </button>`).join('');
}

async function cargarRequisicion(entregaPreferida) {
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  if (!(await cargarEntregasMes(anio, mes))) return;
  const lista = estado.entregasMes;
  const actual = estado.requisicion && estado.requisicion.anio === anio && estado.requisicion.mes === mes ? estado.requisicion.entrega : null;
  const buscada = typeof entregaPreferida === 'number' ? entregaPreferida : actual;
  const data = lista.find((e) => e.entrega === buscada) || lista[lista.length - 1] || null;
  estado.requisicion = data;
  renderEstadoRequisicion();
  renderEntregas();
  if (!data) {
    $('contenidoRequisicion').style.display = 'none';
    document.body.classList.remove('con-dock');
    $('hintCabecera').style.display = 'none';
    const mesInfo = MESES.find((m) => m.v === mes);
    $('tituloSinRequisicion').textContent = `Todavía no hay requisición de ${mesInfo ? mesInfo.l : mes} ${anio}`;
    $('textoSinRequisicion').textContent = estado.puedeEditar
      ? 'Créala para empezar: primero capturas lo que llegó del almacén y luego lo repartes a municipios, hospitales y unidades. Si en el mes llegan más entregas, las agregas después.'
      : 'Aún no se ha capturado la requisición de este mes.';
    $('tarjetaSinRequisicion').style.display = 'flex';
    return;
  }
  $('tarjetaSinRequisicion').style.display = 'none';
  $('hintCabecera').style.display = 'none';
  await cargarDatosRequisicion();
}

// Confirmación propia de SIREVAQ (en lugar del confirm del navegador). Devuelve true/false.
// tono: 'aviso' (ámbar), 'peligro' (rojo) o 'info' (azul).
function confirmar({ titulo, mensaje, aceptar, cancelar, tono }) {
  return new Promise((resolve) => {
    if (estado.dialogoConfirmar) estado.dialogoConfirmar.resolve(false);   // nunca dos a la vez
    estado.dialogoConfirmar = { resolve };
    const t = tono || 'aviso';
    const iconos = { aviso: 'warning', peligro: 'delete', info: 'help' };
    const caja = $('modalConfirmar').querySelector('.modal-hoja');
    caja.dataset.tono = t;
    $('confirmarIcono').textContent = iconos[t] || 'help';
    $('confirmarTitulo').textContent = titulo || '¿Continuar?';
    $('confirmarMensaje').textContent = mensaje || '';
    $('confirmarAceptar').textContent = aceptar || 'Continuar';
    $('confirmarCancelar').textContent = cancelar || 'Cancelar';
    $('modalConfirmar').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('confirmarAceptar').focus();
  });
}

function cerrarConfirmar(valor) {
  $('modalConfirmar').style.display = 'none';
  document.body.style.overflow = '';
  const d = estado.dialogoConfirmar;
  estado.dialogoConfirmar = null;
  if (d) d.resolve(valor);
}

// Diálogo propio (en lugar del prompt del navegador). Devuelve el texto, o null si se cancela.
function pedirTexto({ titulo, descripcion, etiqueta, valor, placeholder, aceptar, sugerencias }) {
  return new Promise((resolve) => {
    estado.dialogoTexto = { resolve };
    $('textoTitulo').textContent = titulo;
    $('textoDescripcion').textContent = descripcion || '';
    $('textoEtiqueta').textContent = etiqueta || '';
    $('textoValor').value = valor || '';
    $('textoValor').placeholder = placeholder || '';
    $('textoAceptar').textContent = aceptar || 'Guardar';
    $('textoSugerencias').innerHTML = (sugerencias || []).map((x) => `<button type="button" class="chip-filtro" data-sug="${esc(x)}">${esc(x)}</button>`).join('');
    $('modalTexto').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('textoValor').focus();
    $('textoValor').select();
  });
}

function cerrarTexto(valor) {
  $('modalTexto').style.display = 'none';
  document.body.style.overflow = '';
  const d = estado.dialogoTexto;
  estado.dialogoTexto = null;
  if (d) d.resolve(valor);
}

async function nuevaEntrega() {
  if (!estado.puedeEditar || !estado.requisicion) return;
  const { anio, mes } = estado.requisicion;
  const siguiente = Math.max(...estado.entregasMes.map((e) => e.entrega), 0) + 1;
  const etiqueta = await pedirTexto({
    titulo: `Nueva entrega ${siguiente}`, descripcion: `${etiquetaMes({ anio, mes })}: se captura, se reparte y se exporta por separado.`,
    etiqueta: '¿Qué llegó en esta entrega? (opcional)', placeholder: 'Ej. Influenza', aceptar: 'Crear entrega',
    sugerencias: ['Esquema básico', 'Influenza', 'COVID-19']
  });
  if (etiqueta === null) return;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .insert({ anio, mes, entrega: siguiente, etiqueta: etiqueta.trim() || null, creado_por: estado.perfil.usuario })
    .select().single();
  if (error) { toast('No se pudo crear la entrega: ' + error.message, true); return; }
  toast(`Entrega ${siguiente} creada.`);
  await cargarRequisicion(data.entrega);
}

async function renombrarEntrega() {
  const r = estado.requisicion;
  if (!estado.puedeEditar || !r) return;
  const etiqueta = await pedirTexto({
    titulo: `Nombre de la entrega ${r.entrega}`, descripcion: `${etiquetaMes(r)}. Déjalo vacío para quitar el nombre.`,
    etiqueta: 'Nombre', valor: r.etiqueta || '', placeholder: 'Ej. Esquema básico', aceptar: 'Guardar',
    sugerencias: ['Esquema básico', 'Influenza', 'COVID-19']
  });
  if (etiqueta === null) return;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .update({ etiqueta: etiqueta.trim() || null }).eq('id', r.id).select().single();
  if (error) { toast('No se pudo guardar el nombre: ' + error.message, true); return; }
  estado.requisicion = data;
  const i = estado.entregasMes.findIndex((e) => e.id === data.id);
  if (i >= 0) estado.entregasMes[i] = data;
  renderEntregas();
  renderEstadoRequisicion();
}

// ---------------------------------------------------------------------------
// Estado (BORRADOR/CERRADA) + "Cerrar mes": ver requi_cerrar_mes_y_marca_
// corregido.sql -- cerrar NO bloquea edición, solo dispara el aviso
// "corregido posteriormente" si se vuelve a tocar algo después.
// ---------------------------------------------------------------------------

function renderEstadoRequisicion() {
  const badges = $('badgesEstadoRequisicion');
  const btnCerrar = $('btnCerrarMes');
  const r = estado.requisicion;
  if (!r) { badges.style.display = 'none'; btnCerrar.style.display = 'none'; return; }

  const esCerrada = r.estado === 'CERRADA';
  badges.style.display = 'inline-flex';
  badges.innerHTML = `
    <span class="pill ${esCerrada ? 'pill-ok' : 'pill-warn'}">${esCerrada ? 'Cerrada' : 'Borrador'}</span>
    ${r.fue_corregido ? '<span class="pill pill-err">Corregido posteriormente</span>' : ''}
  `;
  btnCerrar.style.display = estado.puedeEditar && !esCerrada ? 'inline-flex' : 'none';
}

async function cerrarMes() {
  if (!estado.puedeEditar || !estado.requisicion || estado.requisicion.estado === 'CERRADA') return;
  const av = estado.avance || calcularAvance();
  const pendientes = av.p2.filter((x) => x.est !== 'completo').length + av.p3.filter((x) => x.est !== 'completo').length;
  const sinLote = estado.items.filter((i) => esPendiente(i) && Number(i.cantidad_surtida) > 0).length;
  const avisoLote = sinLote ? `

Ojo: ${plural(sinLote, 'renglón todavía tiene', 'renglones todavía tienen')} el lote "por definir".` : '';
  const aviso = avisoLote + (pendientes ? `

Ojo: ${plural(pendientes, 'reparto todavía tiene', 'repartos todavía tienen')} saldo sin repartir (puntos ámbar o grises).` : '');
  const ok = await confirmar({
    titulo: '¿Cerrar esta entrega?', tono: 'info', aceptar: 'Cerrar entrega',
    mensaje: 'Se marca como enviada. Si después necesitas corregir algo, puedes seguir editándola aquí mismo: quedará marcada como "corregida posteriormente" para que municipios y unidades lo sepan.' + aviso
  });
  if (!ok) return;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .update({ estado: 'CERRADA', cerrado_en: new Date().toISOString(), fecha_envio: estado.requisicion.fecha_envio || ultimoDiaMes(estado.requisicion.anio, estado.requisicion.mes) })
    .eq('id', estado.requisicion.id).select().single();
  if (error) { toast('No se pudo cerrar: ' + error.message, true); return; }
  estado.requisicion = data;
  toast('Entrega cerrada.');
  renderEstadoRequisicion();
}

// ---------------------------------------------------------------------------
// Explorador -- historial de requisiciones capturadas. Salta directo al
// registro elegido (no depende de que el año esté en el <select>: se le
// asigna el valor si existe, pero la carga de datos usa el id real).
// ---------------------------------------------------------------------------

async function toggleExplorador() {
  const panel = $('panelExplorador');
  const abrir = panel.style.display === 'none';
  panel.style.display = abrir ? 'block' : 'none';
  if (!abrir) return;

  const { data, error } = await estado.db.from('requi_requisiciones')
    .select('*').order('anio', { ascending: false }).order('mes', { ascending: false }).order('entrega', { ascending: false });
  if (error) { toast('No se pudo cargar el historial: ' + error.message, true); return; }
  renderExplorador(data || []);
}

function renderExplorador(filas) {
  $('tbodyExplorador').innerHTML = filas.map((r) => {
    const mesInfo = MESES.find((m) => m.v === r.mes);
    const esCerrada = r.estado === 'CERRADA';
    return `
      <tr class="${estado.requisicion && estado.requisicion.id === r.id ? 'activa' : ''}">
        <td><strong>${mesInfo ? mesInfo.l : r.mes} ${r.anio}</strong> <small style="color:var(--muted)">${esc(etiquetaEntrega(r))}</small></td>
        <td><span class="pill ${esCerrada ? 'pill-ok' : 'pill-warn'}">${esCerrada ? 'Cerrada' : 'Borrador'}</span></td>
        <td>${r.fue_corregido ? '<span class="pill pill-err">Corregido</span>' : ''}</td>
        <td>${r.fecha_envio ? formatMmmAa(r.fecha_envio) : '—'}</td>
        <td>${r.creado_por || '—'}</td>
        <td><button class="btn btn-outline btn-sm btn-abrir-historial" data-id="${r.id}">Abrir</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" style="color:var(--muted)">Todavía no hay requisiciones capturadas.</td></tr>';

  $('tbodyExplorador').querySelectorAll('.btn-abrir-historial').forEach((btn) => {
    btn.addEventListener('click', () => abrirDesdeHistorial(btn.dataset.id, filas));
  });
}

async function abrirDesdeHistorial(id, filas) {
  const r = filas.find((f) => f.id === id);
  if (!r) return;
  if ([...$('selAnio').options].some((o) => o.value === String(r.anio))) $('selAnio').value = r.anio;
  if ([...$('selMes').options].some((o) => o.value === String(r.mes))) $('selMes').value = r.mes;
  await cargarEntregasMes(r.anio, r.mes);
  estado.requisicion = estado.entregasMes.find((e) => e.id === r.id) || r;
  renderEstadoRequisicion();
  renderEntregas();
  $('hintCabecera').style.display = 'none';
  $('tarjetaSinRequisicion').style.display = 'none';
  $('panelExplorador').style.display = 'none';
  await cargarDatosRequisicion();
}

async function cargarDatosRequisicion() {
  if (!estado.requisicion) return;
  const reqId = estado.requisicion.id;
  const [{ data: items }, { data: dm }, du] = await Promise.all([
    estado.db.from('requi_items_jurisdiccion').select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', reqId).order('created_at'),
    estado.db.from('requi_distribucion_municipio').select('*').eq('requisicion_id', reqId),
    traerTodo(() => estado.db.from('requi_distribucion_unidad').select('*').eq('requisicion_id', reqId))
  ]);
  estado.items = items || [];
  estado.distMunicipio = dm || [];
  estado.distUnidad = du || [];
  estado.previa = null;
  if (!estado.catalogo.some((b) => b.id === estado.bioRapido)) estado.bioRapido = null;
  $('tarjetaSinRequisicion').style.display = 'none';
  $('contenidoRequisicion').style.display = 'block';
  document.body.classList.add('con-dock');
  renderDestinosMasivos();
  activarPaso(estado.pasoActual || 1, { sinScroll: true });
}

// ---------------------------------------------------------------------------
// Utilidades compartidas por los tres pasos
// ---------------------------------------------------------------------------

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nombreCorto(bio) { return RequiEngine.nombreCortoBio(bio); }
function esMunicipioReal(v) { return MUNICIPIOS_REALES.some((m) => m.v === v); }
// Un destino tiene Paso 3 si hay unidades registradas para él: los 4 municipios y, cada hospital, él mismo
// como su única unidad (lo que se le asigna en el paso 2 se le pasa solo; ver unidadDeHospital).
function tieneUnidades(v) { return estado.unidades.some((u) => u.municipio === v); }
function unidadDeHospital(destino) { return esHospital(destino) ? estado.unidades.find((u) => u.municipio === destino) || null : null; }
function etiquetaMunicipio(v) { const d = DESTINOS.find((x) => x.v === v); return d ? d.l : v; }
function etiquetaMes(req) { const m = MESES.find((x) => x.v === req.mes); return `${m ? m.l : req.mes} ${req.anio}`; }
// "Entrega 2 · Influenza"
function etiquetaEntrega(req) { return `Entrega ${req.entrega || 1}${req.etiqueta ? ' · ' + req.etiqueta : ''}`; }
function variasEntregas() { return estado.entregasMes.length > 1 || (estado.requisicion && estado.requisicion.entrega > 1); }
// Texto de "MES A SURTIR" y sufijo de archivo: la 1ª entrega de un mes sin más entregas queda como siempre.
function sufijoEntregaArchivo() { return variasEntregas() ? `_E${estado.requisicion.entrega}` : ''; }
function claveLote(bioId, loteId) { return bioId + '::' + loteId; }

function itemDe(bioId, loteId) { return estado.items.find((i) => i.requi_biologico_id === bioId && i.lote_id === loteId); }
function itemsDe(biologicoId) { return estado.items.filter((i) => i.requi_biologico_id === biologicoId); }
function ordenCatalogo(bioId) { const i = estado.catalogo.findIndex((b) => b.id === bioId); return i < 0 ? 999 : i; }
function numeroLoteDe(bioId, loteId) { const it = itemDe(bioId, loteId); return it ? it.requi_lotes.numero_lote : '?'; }
function caducidadDe(bioId, loteId) { const it = itemDe(bioId, loteId); return it ? cadHtml(it.requi_lotes.caducidad) : '—'; }

// Lotes con algo surtido, en el orden del catálogo (y por número de lote dentro de cada biológico).
function itemsSurtidos() {
  return estado.items.filter((i) => Number(i.cantidad_surtida) > 0).sort((a, b) =>
    ordenCatalogo(a.requi_biologico_id) - ordenCatalogo(b.requi_biologico_id)
    || String(a.requi_lotes.numero_lote).localeCompare(String(b.requi_lotes.numero_lote)));
}

function sumaMunicipio(bioId, loteId) {
  return estado.distMunicipio.filter((d) => d.requi_biologico_id === bioId && d.lote_id === loteId)
    .reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
}
function asignadoMunicipio(muni, bioId, loteId) {
  const f = estado.distMunicipio.find((d) => d.municipio === muni && d.requi_biologico_id === bioId && d.lote_id === loteId);
  return f ? Number(f.cantidad) : 0;
}
function sumaUnidadesMunicipio(muni, bioId, loteId) {
  return estado.distUnidad.filter((d) => d.requi_biologico_id === bioId && d.lote_id === loteId
    && estado.unidadPorId[d.unidad_id] && estado.unidadPorId[d.unidad_id].municipio === muni)
    .reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
}

// Todas las páginas de una consulta (PostgREST corta en 1000 filas por respuesta).
async function traerTodo(construir) {
  const tam = 1000;
  const todo = [];
  for (let desde = 0; ; desde += tam) {
    const { data, error } = await construir().order('id').range(desde, desde + tam - 1);
    if (error) { toast('No se pudieron cargar todos los datos: ' + error.message, true); break; }
    todo.push(...(data || []));
    if (!data || data.length < tam) break;
  }
  return todo;
}

// Los guardados corren de uno en uno: cada uno valida contra lo ya guardado por
// el anterior, y una respuesta tardía nunca pisa a una más reciente.
function encolar(fn) {
  estado.cola = estado.cola.then(fn).catch((e) => { console.error(e); toast('Error inesperado al guardar: ' + (e.message || e), true); });
  return estado.cola;
}

// ---------------------------------------------------------------------------
// Avance: un punto por lote (gris = sin reparto, ámbar = con saldo, verde =
// completo). Alimenta el stepper de arriba, las píldoras de la barra
// flotante, el resumen de cada paso y el botón "Siguiente".
// ---------------------------------------------------------------------------

function estadoPorSaldo(asignado, repartido) {
  return repartido <= 0 ? 'vacio' : repartido >= asignado ? 'completo' : 'parcial';
}

function calcularAvance() {
  const surtidos = itemsSurtidos();
  const sumaM = new Map();
  estado.distMunicipio.forEach((d) => {
    const k = claveLote(d.requi_biologico_id, d.lote_id);
    sumaM.set(k, (sumaM.get(k) || 0) + Number(d.cantidad || 0));
  });
  const p2 = surtidos.map((it) => {
    const disp = Number(it.cantidad_surtida);
    const rep = sumaM.get(claveLote(it.requi_biologico_id, it.lote_id)) || 0;
    return { bio: it.requi_biologico_id, lote: it.lote_id, disp, rep, est: estadoPorSaldo(disp, rep) };
  });

  const sumaU = new Map();
  estado.distUnidad.forEach((d) => {
    const u = estado.unidadPorId[d.unidad_id];
    if (!u) return;
    const k = u.municipio + '|' + claveLote(d.requi_biologico_id, d.lote_id);
    sumaU.set(k, (sumaU.get(k) || 0) + Number(d.cantidad || 0));
  });
  const p3 = estado.distMunicipio.filter((d) => Number(d.cantidad) > 0 && tieneUnidades(d.municipio))
    .map((d) => {
      const asignado = Number(d.cantidad);
      const rep = sumaU.get(d.municipio + '|' + claveLote(d.requi_biologico_id, d.lote_id)) || 0;
      return { muni: d.municipio, bio: d.requi_biologico_id, lote: d.lote_id, disp: asignado, rep, est: estadoPorSaldo(asignado, rep) };
    })
    .sort((a, b) => DESTINOS.findIndex((m) => m.v === a.muni) - DESTINOS.findIndex((m) => m.v === b.muni)
      || ordenCatalogo(a.bio) - ordenCatalogo(b.bio));
  return { surtidos, p2, p3 };
}

function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }

function htmlAvance(titulo, resumen, puntos, porcentaje, leyenda) {
  return `
    <div class="avance-cab"><div><b>${titulo}</b><small>${resumen}</small></div>${porcentaje != null ? `<span class="avance-pct">${porcentaje}%</span>` : ''}</div>
    ${porcentaje != null ? `<div class="avance-barra"><i style="width:${porcentaje}%"></i></div>` : ''}
    <div class="puntos">${puntos.map((p) => `<button type="button" class="pt ${p.est}" title="${esc(p.titulo)}" ${p.datos}></button>`).join('')}</div>
    <div class="leyenda">${leyenda.map(([cls, txt]) => `<span><i class="pt ${cls}"></i>${txt}</span>`).join('')}</div>`;
}

function renderAvance() {
  if (!estado.requisicion) return;
  const a = calcularAvance();
  estado.avance = a;
  const bios = new Set(a.surtidos.map((i) => i.requi_biologico_id));
  const c2 = a.p2.filter((x) => x.est === 'completo').length;
  const c3 = a.p3.filter((x) => x.est === 'completo').length;
  const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);

  const pasos = [
    { n: 1, titulo: 'Lo surtido', color: '#0284c7', hecho: a.surtidos.length > 0, iniciado: a.surtidos.length > 0,
      pill: a.surtidos.length ? String(a.surtidos.length) : '',
      texto: a.surtidos.length ? `${plural(a.surtidos.length, 'lote', 'lotes')} · ${plural(bios.size, 'biológico', 'biológicos')}` : 'Sin lotes todavía' },
    { n: 2, titulo: 'Municipios y hospitales', color: '#d97706', hecho: a.p2.length > 0 && c2 === a.p2.length, iniciado: a.p2.some((x) => x.rep > 0),
      pill: a.p2.length ? `${c2}/${a.p2.length}` : '',
      texto: a.p2.length ? `${c2} de ${plural(a.p2.length, 'lote repartido', 'lotes repartidos')}` : 'Primero captura el paso 1' },
    { n: 3, titulo: 'Unidades', color: '#16a34a', hecho: a.p3.length > 0 && c3 === a.p3.length, iniciado: a.p3.some((x) => x.rep > 0),
      pill: a.p3.length ? `${c3}/${a.p3.length}` : '',
      texto: a.p3.length ? `${c3} de ${plural(a.p3.length, 'asignación repartida', 'asignaciones repartidas')}` : 'Primero reparte el paso 2' }
  ];
  estado.pasos = pasos;
  setTimeout(actualizarEstadoGuardado, 0);   // el avance cambia lo "por completar" del chip

  // Stepper superior
  $('stepper').innerHTML = pasos.map((p, i) => `${i ? `<span class="st-linea ${pasos[i - 1].hecho ? 'hecho' : ''}"></span>` : ''}
    <button type="button" role="listitem" class="st-nodo ${p.hecho ? 'hecho' : p.iniciado ? 'iniciado' : ''} ${estado.pasoActual === p.n ? 'activo' : ''}" data-paso="${p.n}" style="--hoja:${p.color}">
      <span class="st-circulo">${p.hecho ? '<span class="material-symbols-rounded">check</span>' : p.n}</span>
      <span class="st-txt"><b>${p.titulo}</b><small>${esc(p.texto)}</small></span>
    </button>`).join('');

  // Píldoras de la barra flotante
  pasos.forEach((p) => {
    const el = $('pildoraPaso' + p.n);
    if (!el) return;
    el.textContent = p.pill;
    el.className = 'hoja-pildora' + (p.hecho ? ' ok' : '');
    el.title = p.texto;
  });

  // Resumen de la barra flotante + botón Siguiente
  const actual = pasos[estado.pasoActual - 1];
  $('dockEstadoTitulo').textContent = `Paso ${actual.n} de 3 · ${actual.titulo}`;
  $('dockEstadoTexto').textContent = actual.texto;
  $('dockPunto').className = 'dock-punto' + (actual.hecho ? ' validado' : actual.iniciado ? ' enviado' : '');
  $('btnSiguiente').style.display = estado.pasoActual < 3 ? 'inline-flex' : 'none';

  // Resumen con puntos de cada paso
  $('avancePaso1').innerHTML = htmlAvance(
    'Paso 1 de 3 · Lo surtido', esc(pasos[0].texto),
    estado.catalogo.map((bio) => {
      const n = itemsDe(bio.id).length;
      return { est: n ? 'completo' : 'vacio', titulo: `${bio.nombre}: ${n ? plural(n, 'lote', 'lotes') : 'sin lotes'}`, datos: `data-ir="p1" data-bio="${bio.id}"` };
    }), null, [['vacio', 'sin lotes'], ['completo', 'con lotes']]);

  $('avancePaso2').innerHTML = htmlAvance(
    'Paso 2 de 3 · Municipios y hospitales', esc(pasos[1].texto),
    a.p2.map((x) => ({ est: x.est, titulo: `${nombreCorto(estado.catalogo.find((b) => b.id === x.bio) || {})} · lote ${numeroLoteDe(x.bio, x.lote)}: ${x.est === 'completo' ? 'repartido por completo' : x.est === 'vacio' ? 'sin repartir' : 'quedan ' + (x.disp - x.rep)}`, datos: `data-ir="p2" data-bio="${x.bio}" data-lote="${x.lote}"` })),
    a.p2.length ? pct(c2, a.p2.length) : null, [['vacio', 'sin repartir'], ['parcial', 'con saldo'], ['completo', 'completo']]);

  $('avancePaso3').innerHTML = htmlAvance(
    'Paso 3 de 3 · Unidades', esc(pasos[2].texto),
    a.p3.map((x) => ({ est: x.est, titulo: `${etiquetaMunicipio(x.muni)} · ${nombreCorto(estado.catalogo.find((b) => b.id === x.bio) || {})} lote ${numeroLoteDe(x.bio, x.lote)}: ${x.est === 'completo' ? 'repartido por completo' : x.est === 'vacio' ? 'sin repartir' : 'quedan ' + (x.disp - x.rep)}`, datos: `data-ir="p3" data-muni="${x.muni}" data-bio="${x.bio}" data-lote="${x.lote}"` })),
    a.p3.length ? pct(c3, a.p3.length) : null, [['vacio', 'sin repartir'], ['parcial', 'con saldo'], ['completo', 'completo']]);
}

function irDesdePunto(btn) {
  const { ir, bio, lote, muni } = btn.dataset;
  if (ir === 'p1') {
    seleccionarBioRapido(bio, true);
    $('rapida').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else if (ir === 'p2') {
    estado.filtroBio2 = '';
    activarPaso(2, { sinScroll: true });
    resaltarFila($('matrizMunicipio').querySelector(`tr[data-key="${claveLote(bio, lote)}"]`));
  } else if (ir === 'p3') {
    estado.municipioPaso3 = muni;
    activarPaso(3, { sinScroll: true });
    resaltarFila($('matrizUnidad').querySelector(`th[data-col="${claveLote(bio, lote)}"]`));
  }
}

function resaltarFila(el) {
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  el.classList.add('resalte');
  setTimeout(() => el.classList.remove('resalte'), 1800);
}

// ---------------------------------------------------------------------------
// Paso 1 — Lo surtido. Captura rápida: se elige el biológico una vez y se
// teclean lotes seguidos (Enter guarda y regresa al campo Lote), con lote ya
// conocido = caducidad autocompletada. "Pegar desde Excel" carga varios de
// un golpe. Sin límite de lotes (el límite de 2 por biológico es solo un
// detalle físico de la plantilla de exportación, no de la captura).
// ---------------------------------------------------------------------------

function textoClave(bio) {
  return bio.codigo_articulo ? `${bio.clave_articulo} · ${bio.codigo_articulo}` : bio.clave_articulo;
}

function renderChipsBio() {
  $('chipsBio').innerHTML = estado.catalogo.map((bio) => {
    const n = itemsDe(bio.id).length;
    return `<button type="button" class="chip-bio ${n ? 'con-lotes' : ''} ${estado.bioRapido === bio.id ? 'activo' : ''}" data-bio="${bio.id}" style="--c:${colorDeBio(bio)}" title="${esc(bio.nombre)}"><i></i>${esc(nombreCorto(bio))}${n ? `<b>${n}</b>` : ''}</button>`;
  }).join('');
}

function renderRapidaBio() {
  const bio = estado.catalogo.find((b) => b.id === estado.bioRapido);
  const rap = $('rapida');
  rap.classList.toggle('sin-bio', !bio);
  rap.style.setProperty('--c', bio ? colorDeBio(bio) : '#cbd5e1');
  ['rapLote', 'rapCad', 'rapCant', 'rapAgregar'].forEach((id) => { $(id).disabled = !bio; });
  if (!bio) {
    $('rapidaBio').innerHTML = `
      <div class="rb-icono" style="background:#e2e8f0;"><span class="material-symbols-rounded" style="color:#64748b">touch_app</span></div>
      <div><div class="rb-nombre">Elige un biológico</div><div class="rb-sub">Toca uno de los botones de arriba para empezar.</div></div>`;
    return;
  }
  const color = colorDeBio(bio);
  const n = itemsDe(bio.id).length;
  $('rapidaBio').innerHTML = `
    <div class="rb-icono" style="background: linear-gradient(135deg, ${color}1f, ${color}4d);"><span class="material-symbols-rounded" style="color:${color}">medication_liquid</span></div>
    <div><div class="rb-nombre">${esc(bio.nombre)}</div><div class="rb-sub">${esc(bio.presentacion)} · ${n ? plural(n, 'lote capturado', 'lotes capturados') : 'sin lotes todavía'}</div></div>`;
}

async function seleccionarBioRapido(bioId, enfocar) {
  estado.bioRapido = bioId || null;
  renderChipsBio();
  renderRapidaBio();
  document.querySelectorAll('#tbodyBiologicos tr.fila-bio').forEach((tr) => tr.classList.toggle('activa', tr.dataset.bio === estado.bioRapido));
  limpiarRapida();
  if (!bioId) return;
  const existentes = await lotesExistentesDe(bioId);
  if (estado.bioRapido === bioId) {
    $('rapListaLotes').innerHTML = existentes.map((l) => `<option value="${esc(l.numero_lote)}">${esc(formatMmmAa(l.caducidad))}</option>`).join('');
  }
  if (enfocar) $('rapLote').focus();
}

function limpiarRapida() {
  $('rapLote').value = '';
  $('rapCad').value = '';
  $('rapCad').dataset.auto = '';
  actualizarVistaCad($('rapCad'));
  $('rapCant').value = '';
  $('rapNota').innerHTML = '';
}

// Al teclear el lote: lo compara contra los ya conocidos del biológico y, si
// existe, trae su caducidad (así no se vuelve a teclear).
function evaluarLoteRapido() {
  const bioId = estado.bioRapido;
  const nota = $('rapNota');
  const cad = $('rapCad');
  if (!bioId) { nota.innerHTML = ''; return; }
  const texto = $('rapLote').value.trim();
  const limpiarAuto = () => { if (cad.dataset.auto === '1') { cad.value = ''; cad.dataset.auto = ''; actualizarVistaCad(cad); } };
  if (!texto) { limpiarAuto(); nota.innerHTML = ''; return; }
  const res = RequiEngine.compararLote(texto, estado.lotesPorBiologico[bioId] || []);
  let extra = '';
  if (res.estado === 'EXISTE') {
    if (!cad.value || cad.dataset.auto === '1') { cad.value = formatDdMmAa(res.lote.caducidad); cad.dataset.auto = '1'; actualizarVistaCad(cad); }
    const it = itemDe(bioId, res.lote.id);
    if (it) extra = `<span class="pill pill-warn">Ya capturado (${it.cantidad_surtida}): se reemplazará la cantidad</span>`;
  } else {
    limpiarAuto();
  }
  nota.innerHTML = pillComparador(res) + extra;
}

// Guarda (o actualiza) un lote surtido. Devuelve true si quedó guardado.
async function guardarLoteSurtido(biologicoId, numeroLote, caducidad, cantidad) {
  const existentes = await lotesExistentesDe(biologicoId);
  const resultado = RequiEngine.compararLote(numeroLote, existentes);
  if (resultado.estado === 'SIMILAR') {
    const continuar = await confirmar({
      titulo: 'Este lote se parece a otro', tono: 'aviso', aceptar: 'Sí, es un lote nuevo', cancelar: 'Corregir captura',
      mensaje: `El lote "${numeroLote}" se parece a "${resultado.sugerencias[0].numero_lote}", que ya está registrado. ¿Seguro que es un lote NUEVO y distinto?`
    });
    if (!continuar) return false;
  }

  let loteId = resultado.estado === 'EXISTE' ? resultado.lote.id : null;
  if (loteId && caducidad && !resultado.lote.caducidad) {
    const { error } = await estado.db.from('requi_lotes').update({ caducidad }).eq('id', loteId);
    if (!error) resultado.lote.caducidad = caducidad;
  }
  if (!loteId) {
    const { data: nuevoLote, error: errLote } = await estado.db.from('requi_lotes')
      .insert({ requi_biologico_id: biologicoId, numero_lote: numeroLote, caducidad })
      .select().single();
    if (errLote) { toast('No se pudo registrar el lote: ' + errLote.message, true); return false; }
    loteId = nuevoLote.id;
    existentes.push(nuevoLote);
  }

  const { data: itemGuardado, error: errItem } = await estado.db.from('requi_items_jurisdiccion')
    .upsert({ requisicion_id: estado.requisicion.id, requi_biologico_id: biologicoId, lote_id: loteId, cantidad_surtida: cantidad },
      { onConflict: 'requisicion_id,requi_biologico_id,lote_id' })
    .select('*, requi_lotes(numero_lote, caducidad)').single();
  if (errItem) { toast('No se pudo guardar lo surtido: ' + errItem.message, true); return false; }

  const idx = estado.items.findIndex((i) => i.id === itemGuardado.id);
  if (idx === -1) estado.items.push(itemGuardado); else estado.items[idx] = itemGuardado;
  return true;
}

async function agregarRapido() {
  if (estado.guardandoRapido || !estado.requisicion) return;
  const bioId = estado.bioRapido;
  if (!bioId) { toast('Elige primero el biológico.', true); return; }
  const numeroLote = $('rapLote').value.trim().toUpperCase() || LOTE_PENDIENTE; // sin lote = "por definir"
  const caducidadTexto = numeroLote === LOTE_PENDIENTE ? '' : $('rapCad').value.trim();
  const cantidad = Number($('rapCant').value);
  if (!cantidad || cantidad <= 0) { toast('La cantidad debe ser mayor a 0.', true); $('rapCant').focus(); return; }
  let caducidad = null;
  if (caducidadTexto) {
    caducidad = parsearCaducidadInteligente(caducidadTexto);
    if (!caducidad) { toast('No entendí la caducidad. Usa por ejemplo 15-07-29.', true); $('rapCad').focus(); return; }
  }

  estado.guardandoRapido = true;
  try {
    if (!(await guardarLoteSurtido(bioId, numeroLote, caducidad, cantidad))) return;
    const bio = estado.catalogo.find((b) => b.id === bioId);
    toast(numeroLote === LOTE_PENDIENTE ? `${nombreCorto(bio)}: ${cantidad} con lote por definir.` : `Lote ${numeroLote} de ${nombreCorto(bio)} guardado.`);
    limpiarRapida();
    renderPaso1();
    renderAvance();
    $('rapListaLotes').innerHTML = (estado.lotesPorBiologico[bioId] || []).map((l) => `<option value="${esc(l.numero_lote)}">${esc(formatMmmAa(l.caducidad))}</option>`).join('');
    $('rapLote').focus();
  } finally {
    estado.guardandoRapido = false;
  }
}

function filasBiologicoHtml(bio) {
  const items = itemsDe(bio.id);
  const total = items.reduce((acc, i) => acc + Number(i.cantidad_surtida || 0), 0);
  const esMultidosis = bio.presentacion === 'MULTIDOSIS';
  const color = colorDeBio(bio);
  const filaBio = `
    <tr class="fila-bio ${items.length ? '' : 'sin-lotes'} ${estado.bioRapido === bio.id ? 'activa' : ''}" data-bio="${bio.id}">
      <td>
        <span class="punto-bio" style="background:${color}"></span><strong>${esc(bio.nombre)}</strong><br>
        <span class="clave-bio" id="clave-${bio.id}" style="margin-left:18px;">
          <span class="clave-texto">${esc(textoClave(bio))}</span>
          <button type="button" class="icon-btn-pure btn-editar-clave solo-edicion" data-bio="${bio.id}" title="Editar clave de artículo"><span class="material-symbols-rounded">edit</span></button>
        </span>
      </td>
      <td><span class="pill-presentacion ${esMultidosis ? 'multidosis' : ''}">${esc(bio.presentacion)}</span></td>
      <td><span class="badge-count ${items.length ? 'tiene-lotes' : ''}"><span class="dot"></span>${plural(items.length, 'lote', 'lotes')}</span></td>
      <td><strong>${total}</strong></td>
    </tr>`;
  const filasLotes = items.map((it) => `
    <tr class="fila-lote-capturado" data-item="${it.id}" data-bio="${bio.id}" style="--c:${color}">
      <td class="lote-cel" colspan="3">${esPendiente(it)
        ? '<span class="chip-lote pendiente"><span class="material-symbols-rounded">hourglass_top</span>Lote por definir</span>'
        : `<span class="chip-lote"><span class="material-symbols-rounded">qr_code_2</span>Lote ${esc(it.requi_lotes.numero_lote)}</span><span class="cad-lote">Cad. ${cadHtml(it.requi_lotes.caducidad)}</span>`}</td>
      <td><div class="cant-wrap"><strong>${it.cantidad_surtida}</strong><span class="solo-edicion">
        ${esPendiente(it) ? `<button type="button" class="btn btn-outline btn-sm btn-asignar-lotes" data-item="${it.id}" title="Ya llegaron los lotes: asígnalos"><span class="material-symbols-rounded" style="font-size:15px">edit_note</span> Asignar lotes</button>` : ''}
        ${esPendiente(it) ? '' : `<button type="button" class="icon-btn-pure btn-asignar-lotes" data-item="${it.id}" title="Cambiar el número de lote o dividirlo en varios"><span class="material-symbols-rounded" style="font-size:16px">call_split</span></button>`}
        <button type="button" class="icon-btn-pure btn-editar-item" data-item="${it.id}" title="Editar"><span class="material-symbols-rounded" style="font-size:16px">edit</span></button>
        <button type="button" class="icon-btn-pure btn-quitar-item" data-item="${it.id}" data-bio="${bio.id}" title="Quitar"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
      </span></div></td>
    </tr>`).join('');
  return filaBio + filasLotes;
}

function renderAvisoPendientes() {
  const todos = estado.items.filter((i) => Number(i.cantidad_surtida) > 0)
    .sort((a, b) => ordenCatalogo(a.requi_biologico_id) - ordenCatalogo(b.requi_biologico_id));
  const pend = todos.filter(esPendiente);
  const el = $('avisoPendientes');
  el.style.display = pend.length ? 'block' : 'none';
  if (!pend.length) { el.innerHTML = ''; return; }
  const bioDe = (id) => estado.catalogo.find((b) => b.id === id) || {};
  const segmentos = todos.map((i) => {
    const bio = bioDe(i.requi_biologico_id);
    return `<i class="seg ${esPendiente(i) ? 'pend' : ''}" style="--c:${colorDeBio(bio)}" title="${esc(nombreCorto(bio))}: ${esPendiente(i) ? 'lote por definir' : 'lote ' + esc(i.requi_lotes.numero_lote)}"></i>`;
  }).join('');
  const fichas = pend.map((i) => {
    const bio = bioDe(i.requi_biologico_id);
    return `<button type="button" class="ficha-pend solo-edicion btn-asignar-lotes" data-item="${i.id}" style="--c:${colorDeBio(bio)}" title="Asignar lote a ${esc(bio.nombre || '')}">
      <span class="fp-ico"><span class="material-symbols-rounded">medication_liquid</span></span>
      <span class="fp-txt"><b>${esc(nombreCorto(bio))}</b><small><strong>${Number(i.cantidad_surtida).toLocaleString('es-MX')}</strong> dosis sin lote</small></span>
      <span class="fp-ir material-symbols-rounded">arrow_forward</span>
    </button>`;
  }).join('');
  el.innerHTML = `
    <div class="ap-cab">
      <span class="ap-ico"><span class="material-symbols-rounded">hourglass_top</span></span>
      <div class="ap-txt"><b>${plural(pend.length, 'biológico con lote por definir', 'biológicos con lote por definir')}</b><small>Cuando lleguen los lotes, asígnalos aquí: el reparto que ya hiciste se acomoda solo.</small></div>
      <div class="ap-cuenta"><b>${todos.length - pend.length}/${todos.length}</b>con lote</div>
    </div>
    <div class="ap-barra" aria-hidden="true">${segmentos}</div>
    <div class="ap-fichas">${fichas}</div>`;
}

function renderPaso1() {
  renderAvisoPendientes();
  renderChipsBio();
  renderRapidaBio();
  $('chkSoloConLotes').classList.toggle('activo', estado.soloConLotes);
  const visibles = estado.catalogo.filter((bio) => !estado.soloConLotes || itemsDe(bio.id).length);
  $('tbodyBiologicos').innerHTML = visibles.map(filasBiologicoHtml).join('')
    || '<tr><td colspan="4" style="color:var(--muted)">Todavía no hay lotes capturados.</td></tr>';
}

// Edición en línea de un lote ya capturado -- solo cantidad y caducidad (no
// número de lote: cambiarlo es, en la práctica, un lote distinto, así que
// para eso se sigue usando quitar + volver a agregar con el comparador).
function activarEdicionItem(itemId) {
  const item = estado.items.find((i) => i.id === itemId);
  const tr = document.querySelector(`tr.fila-lote-capturado[data-item="${itemId}"]`);
  if (!item || !tr) return;
  tr.innerHTML = `
    <td class="lote-cel" colspan="3">${esPendiente(item)
      ? '<span class="chip-lote pendiente"><span class="material-symbols-rounded">hourglass_top</span>Lote por definir</span>'
      : `<span class="chip-lote"><span class="material-symbols-rounded">qr_code_2</span>Lote ${esc(item.requi_lotes.numero_lote)}</span>
      <span class="campo-cad"><input type="text" class="inp-editar-caducidad" value="${esc(formatDdMmAa(item.requi_lotes.caducidad))}" placeholder="DD-MM-AA"><span class="cad-vista">${esc(vistaCaducidad(formatDdMmAa(item.requi_lotes.caducidad)))}</span></span>`}</td>
    <td><div class="cant-wrap"><input type="number" min="0" class="inp-editar-cantidad" value="${item.cantidad_surtida}"><span>
      <button type="button" class="icon-btn-pure btn-guardar-edicion" data-item="${itemId}" title="Guardar"><span class="material-symbols-rounded" style="font-size:16px">check</span></button>
      <button type="button" class="icon-btn-pure btn-cancelar-edicion" title="Cancelar"><span class="material-symbols-rounded" style="font-size:16px">close</span></button>
    </span></div></td>`;
  tr.querySelector('.inp-editar-cantidad').focus();
}

async function guardarEdicionItem(itemId) {
  const item = estado.items.find((i) => i.id === itemId);
  const tr = document.querySelector(`tr.fila-lote-capturado[data-item="${itemId}"]`);
  if (!item || !tr) return;
  const inpCad = tr.querySelector('.inp-editar-caducidad');
  const caducidadTexto = inpCad ? inpCad.value.trim() : '';
  const cantidad = Number(tr.querySelector('.inp-editar-cantidad').value);
  if (!cantidad || cantidad <= 0) { toast('La cantidad debe ser mayor a 0.', true); return; }

  let caducidad = item.requi_lotes.caducidad;
  if (caducidadTexto) {
    const parseada = parsearCaducidadInteligente(caducidadTexto);
    if (!parseada) { toast('No entendí la caducidad. Usa por ejemplo 15-07-29.', true); return; }
    caducidad = parseada;
  }

  if (caducidad !== item.requi_lotes.caducidad) {
    const { error: errLote } = await estado.db.from('requi_lotes').update({ caducidad }).eq('id', item.lote_id);
    if (errLote) { toast('No se pudo actualizar la caducidad: ' + errLote.message, true); return; }
    item.requi_lotes.caducidad = caducidad;
    const cache = (estado.lotesPorBiologico[item.requi_biologico_id] || []).find((l) => l.id === item.lote_id);
    if (cache) cache.caducidad = caducidad;
  }

  if (cantidad !== Number(item.cantidad_surtida)) {
    const { error: errItem } = await estado.db.from('requi_items_jurisdiccion').update({ cantidad_surtida: cantidad }).eq('id', itemId);
    // El trigger de Postgres rechaza bajar la cantidad por debajo de lo que
    // ya se repartió a municipios/Hospitales -- ese mensaje se muestra tal
    // cual, es más claro que cualquier validación que dupliquemos aquí.
    if (errItem) { toast('No se pudo guardar: ' + errItem.message, true); return; }
    item.cantidad_surtida = cantidad;
  }

  toast('Lote actualizado.');
  renderPaso1();
  renderAvance();
}

async function quitarItemSurtido(itemId) {
  if (!(await confirmar({ titulo: '¿Quitar este lote?', tono: 'peligro', aceptar: 'Quitar lote', mensaje: 'Se quita de lo surtido. Si ya tiene reparto asignado, no se podrá quitar hasta liberar ese reparto.' }))) return;
  const { error } = await estado.db.from('requi_items_jurisdiccion').delete().eq('id', itemId);
  if (error) { toast('No se pudo quitar: ' + error.message, true); return; }
  estado.items = estado.items.filter((i) => i.id !== itemId);
  toast('Lote quitado.');
  renderPaso1();
  renderAvance();
}

async function lotesExistentesDe(biologicoId) {
  if (estado.lotesPorBiologico[biologicoId]) return estado.lotesPorBiologico[biologicoId];
  const { data } = await estado.db.from('requi_lotes').select('id, numero_lote, caducidad').eq('requi_biologico_id', biologicoId);
  estado.lotesPorBiologico[biologicoId] = data || [];
  return estado.lotesPorBiologico[biologicoId];
}

// Edición en línea de la clave/código de artículo del catálogo (jurisdicción
// completa, no por requisición) -- ADMIN/JURISDICCIONAL únicamente, mismo
// candado que el resto de la edición (estado.puedeEditar). El valor editado
// se usa tal cual en el próximo Excel exportado (ver requisiciones_export_
// excel.js), no solo en esta tabla.
function activarEdicionClave(bioId) {
  const bio = estado.catalogo.find((b) => b.id === bioId);
  const cont = document.getElementById('clave-' + bioId);
  if (!bio || !cont) return;
  cont.innerHTML = `
    <input type="text" class="inp-editar-clave-articulo" value="${esc(bio.clave_articulo || '')}" placeholder="Clave de artículo" title="Clave de artículo (columna A del Excel)">
    <input type="text" class="inp-editar-codigo-articulo" value="${esc(bio.codigo_articulo || '')}" placeholder="Código" title="Código de artículo (columna B del Excel)">
    <button type="button" class="icon-btn-pure btn-guardar-clave" data-bio="${bioId}" title="Guardar"><span class="material-symbols-rounded">check</span></button>
    <button type="button" class="icon-btn-pure btn-cancelar-clave" title="Cancelar"><span class="material-symbols-rounded">close</span></button>`;
  cont.querySelector('.inp-editar-clave-articulo').focus();
}

async function guardarClaveArticulo(bioId) {
  const bio = estado.catalogo.find((b) => b.id === bioId);
  const cont = document.getElementById('clave-' + bioId);
  if (!bio || !cont) return;
  const claveArticulo = cont.querySelector('.inp-editar-clave-articulo').value.trim();
  const codigoArticulo = cont.querySelector('.inp-editar-codigo-articulo').value.trim();
  if (!claveArticulo) { toast('La clave de artículo no puede quedar vacía.', true); return; }

  const cambios = {};
  if (claveArticulo !== bio.clave_articulo) cambios.clave_articulo = claveArticulo;
  if (codigoArticulo !== (bio.codigo_articulo || '')) cambios.codigo_articulo = codigoArticulo || null;
  if (Object.keys(cambios).length === 0) { renderPaso1(); return; }

  const { error } = await estado.db.from('requi_catalogo_biologicos').update(cambios).eq('id', bioId);
  // Ej. violación de la clave única si ya existe otro biológico con la
  // misma clave_articulo -- se muestra el mensaje real de Postgres.
  if (error) { toast('No se pudo guardar la clave: ' + error.message, true); return; }
  Object.assign(bio, cambios);
  toast('Clave actualizada.');
  renderPaso1();
}

// ---------------------------------------------------------------------------
// Asignar lotes a lo capturado "por definir". Un renglón (ej. 65 dosis de
// Hexavalente) puede convertirse en 1 o varios lotes reales: se teclea cada
// lote con su cantidad (el renglón nuevo se llena solo con lo que falta) y
// la base reacomoda el reparto ya hecho (requi_asignar_lotes).
// ---------------------------------------------------------------------------

function abrirAsignarLotes(itemId) {
  const item = estado.items.find((i) => i.id === itemId);
  if (!item || !estado.puedeEditar) return;
  const bio = estado.catalogo.find((b) => b.id === item.requi_biologico_id) || {};
  const total = Number(item.cantidad_surtida);
  const pend = esPendiente(item);
  estado.asig = { item, bio, total, pend, filas: [{ lote: '', cad: '', cant: total }] };
  const repartido = sumaMunicipio(item.requi_biologico_id, item.lote_id);
  const nota = repartido ? ` (${repartido} ya repartidas: el reparto pasa al lote nuevo en orden y lo puedes ajustar en los pasos 2 y 3)` : '';
  $('asigTitulo').textContent = `${pend ? 'Asignar lotes' : 'Cambiar o dividir lote'} · ${nombreCorto(bio)}`;
  $('asigSub').textContent = pend
    ? `${plural(total, 'dosis sin lote', 'dosis sin lote')}${nota}.`
    : `Lote actual ${item.requi_lotes.numero_lote}: ${plural(total, 'dosis', 'dosis')}${nota}.`;
  $('asigAyuda').innerHTML = pend
    ? 'Si llegó un solo lote, déjalo con toda la cantidad. Si llegaron varios, baja la cantidad del primero y toca <b>Agregar otro lote</b>: el nuevo renglón se llena con lo que falta.'
    : 'Para <b>cambiar el número de lote</b>, deja una fila con toda la cantidad. Para <b>dividirlo</b>, captura solo la parte que pasa a otro lote: el resto se queda en el lote actual.';
  $('modalAsignar').querySelector('.modal-hoja').style.setProperty('--c', colorDeBio(bio));
  $('modalAsignar').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  lotesExistentesDe(item.requi_biologico_id).then((ls) => {
    $('asigListaLotes').innerHTML = ls.filter((l) => l.numero_lote !== LOTE_PENDIENTE)
      .map((l) => `<option value="${esc(l.numero_lote)}">${esc(formatMmmAa(l.caducidad))}</option>`).join('');
  });
  renderAsignarFilas();
  const primero = $('asigFilas').querySelector('input[data-campo="lote"]');
  if (primero) primero.focus();
}

function cerrarAsignarLotes() {
  $('modalAsignar').style.display = 'none';
  document.body.style.overflow = '';
  estado.asig = null;
}

function renderAsignarFilas() {
  const a = estado.asig;
  if (!a) return;
  $('asigFilas').innerHTML = a.filas.map((f, i) => `
    <div class="asig-fila" data-i="${i}">
      <div class="campo"><label>Lote</label><input type="text" data-campo="lote" list="asigListaLotes" autocomplete="off" placeholder="Ej. 0374MA109" value="${esc(f.lote)}"></div>
      <div class="campo"><label>Caducidad</label><input type="text" data-campo="cad" autocomplete="off" placeholder="DD-MM-AA" value="${esc(f.cad)}" style="width:96px;"><span class="cad-vista">${esc(vistaCaducidad(f.cad))}</span></div>
      <div class="campo"><label>Cantidad</label><input type="number" data-campo="cant" min="0" inputmode="numeric" placeholder="0" value="${f.cant || ''}" style="width:96px;"></div>
      ${a.filas.length > 1 ? `<button type="button" class="icon-btn-pure asig-quitar" data-i="${i}" title="Quitar este lote"><span class="material-symbols-rounded">delete</span></button>` : '<span style="width:34px"></span>'}
    </div>`).join('');
  actualizarResumenAsignar();
}

function actualizarResumenAsignar() {
  const a = estado.asig;
  if (!a) return;
  const suma = a.filas.reduce((acc, f) => acc + (Number(f.cant) || 0), 0);
  const dif = a.total - suma;
  const el = $('asigResumen');
  el.className = 'modal-resumen ' + (dif === 0 ? 'ok' : 'aviso');
  el.textContent = dif === 0 ? `Suman ${suma} de ${a.total} ✓`
    : dif > 0 ? `Suman ${suma} de ${a.total}: ${a.pend ? `quedan ${dif} por definir` : `${dif} se quedan en ${a.item.requi_lotes.numero_lote}`}`
    : `Suman ${suma}: ${-dif} más de lo capturado`;
}

function alCambiarFilaAsignar(ev) {
  const inp = ev.target.closest('input[data-campo]');
  const a = estado.asig;
  if (!inp || !a) return;
  const f = a.filas[Number(inp.closest('.asig-fila').dataset.i)];
  const campo = inp.dataset.campo;
  let fechaCompleta = false;
  if (campo === 'cad' && ev.type === 'input') fechaCompleta = aplicarMascaraFecha(ev);
  f[campo] = inp.value;
  if (campo === 'lote' && ev.type === 'change') {
    const res = RequiEngine.compararLote(inp.value.trim(), estado.lotesPorBiologico[a.item.requi_biologico_id] || []);
    const cad = inp.closest('.asig-fila').querySelector('[data-campo="cad"]');
    if (res.estado === 'EXISTE' && res.lote.caducidad && !cad.value) { cad.value = formatDdMmAa(res.lote.caducidad); f.cad = cad.value; actualizarVistaCad(cad); }
  }
  if (campo === 'cad') actualizarVistaCad(inp);
  if (fechaCompleta) inp.closest('.asig-fila').querySelector('[data-campo="cant"]').focus();
  actualizarResumenAsignar();
}

function agregarFilaAsignar() {
  const a = estado.asig;
  if (!a) return;
  const suma = a.filas.reduce((acc, f) => acc + (Number(f.cant) || 0), 0);
  a.filas.push({ lote: '', cad: '', cant: Math.max(0, a.total - suma) });
  renderAsignarFilas();
  const filas = $('asigFilas').querySelectorAll('.asig-fila');
  filas[filas.length - 1].querySelector('input[data-campo="lote"]').focus();
}

async function confirmarAsignarLotes() {
  const a = estado.asig;
  if (!a) return;
  const bioId = a.item.requi_biologico_id;
  const existentes = await lotesExistentesDe(bioId);
  const vistos = new Set();
  const lotes = [];
  for (const f of a.filas) {
    const numero = String(f.lote || '').trim().toUpperCase();
    const cant = Number(f.cant);
    if (!numero || numero.toUpperCase() === LOTE_PENDIENTE) { toast('Falta el número de lote en uno de los renglones.', true); return; }
    if (!Number.isInteger(cant) || cant <= 0) { toast(`La cantidad del lote ${numero} debe ser un entero mayor a 0.`, true); return; }
    if (vistos.has(numero.toUpperCase())) { toast(`El lote ${numero} está repetido.`, true); return; }
    vistos.add(numero.toUpperCase());
    let caducidad = null;
    if (String(f.cad || '').trim()) {
      caducidad = parsearCaducidadInteligente(f.cad);
      if (!caducidad) { toast(`No entendí la caducidad del lote ${numero}. Usa por ejemplo 15-07-29.`, true); return; }
    }
    const res = RequiEngine.compararLote(numero, existentes);
    if (res.estado === 'EXISTE' && itemDe(bioId, res.lote.id)) { toast(`El lote ${numero} ya está capturado este mes: edita ese renglón en vez de asignarlo aquí.`, true); return; }
    if (res.estado === 'SIMILAR' && !(await confirmar({
      titulo: 'Este lote se parece a otro', tono: 'aviso', aceptar: 'Sí, es un lote nuevo', cancelar: 'Corregir',
      mensaje: `El lote "${numero}" se parece a "${res.sugerencias[0].numero_lote}", que ya está registrado. ¿Seguro que es un lote NUEVO y distinto?`
    }))) return;
    lotes.push({ numero_lote: numero, caducidad, cantidad: cant });
  }
  const suma = lotes.reduce((acc, l) => acc + l.cantidad, 0);
  if (suma < a.total && !(await confirmar({
    titulo: 'Los lotes no suman todo', tono: 'aviso', aceptar: 'Continuar',
    mensaje: `Suman ${suma} de ${a.total}: las ${a.total - suma} restantes se quedan ${a.pend ? 'con lote "por definir"' : `en el lote ${a.item.requi_lotes.numero_lote}`}.`
  }))) return;

  $('asigGuardar').disabled = true;
  try {
    const { data, error } = await estado.db.rpc('requi_asignar_lotes', { p_item_id: a.item.id, p_lotes: lotes });
    if (error) { toast(error.message.replace(/^.*?ERROR:\s*/, ''), true); return; }
    delete estado.lotesPorBiologico[bioId];
    cerrarAsignarLotes();
    await cargarDatosRequisicion();
    const quedan = data && Number(data.quedan_pendientes);
    toast(quedan ? `Lotes asignados. Quedan ${quedan} ${a.pend ? 'por definir' : `en ${a.item.requi_lotes.numero_lote}`}.` : 'Lotes asignados.');
  } finally {
    $('asigGuardar').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Catálogo de lotes (panel "Lotes"): lo alimenta solo el servidor (trigger sobre
// el reparto a municipios, ver lotes_sync_desde_requisiciones.sql). Este botón
// es la revisión a demanda del mes elegido: da de alta lo que falte, nunca
// duplica ni borra, y avisa de lo que requiere atención humana.
// ---------------------------------------------------------------------------

async function sincronizarLotes() {
  if (!estado.puedeEditar) return;
  const btn = $('btnSyncLotes');
  btn.disabled = true;
  try {
    const { data, error } = await estado.db.rpc('lotes_sincronizar_desde_requisiciones', {
      p_anio: Number($('selAnio').value), p_mes: Number($('selMes').value)
    });
    if (error) { toast(error.message.replace(/^.*?ERROR:\s*/, ''), true); return; }
    const nuevos = (data.lotes_nuevos || []).length;
    const avisos = [];
    if (data.por_definir_omitidos) avisos.push(`${plural(data.por_definir_omitidos, 'reparto sigue', 'repartos siguen')} con lote "por definir"`);
    if ((data.conflictos_caducidad || []).length) avisos.push('caducidad distinta a la del panel Lotes en ' + data.conflictos_caducidad.map((c) => `${c.biologico} ${c.lote}`).join(', ') + ' (se respetó la del panel)');
    if (data.sin_caducidad) avisos.push(`${plural(data.sin_caducidad, 'lote sin caducidad omitido', 'lotes sin caducidad omitidos')}`);
    if (data.biologicos_sin_equivalente) avisos.push('sin equivalente en Lotes: ' + data.biologicos_sin_equivalente);
    const base = data.insertados
      ? `Panel Lotes actualizado: ${plural(data.insertados, 'alta', 'altas')} (${plural(nuevos, 'lote nuevo', 'lotes nuevos')}).`
      : 'El panel Lotes ya estaba al día.';
    if (avisos.length) await confirmar({ titulo: 'Sincronización de lotes', tono: 'aviso', aceptar: 'Entendido', cancelar: 'Cerrar', mensaje: base + ' Ojo: ' + avisos.join('; ') + '.' });
    else toast(base);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Prellenar cantidades: a veces llega primero lo surtido y los lotes después. Aquí se
// captura de golpe cuánto llegó de cada biológico (queda con lote "por definir") y ya se
// puede repartir; cuando lleguen los lotes se asignan con el botón "Asignar lotes".
// ---------------------------------------------------------------------------

function abrirCantidades() {
  if (!estado.puedeEditar || !estado.requisicion) return;
  $('cantFilas').innerHTML = estado.catalogo.map((bio) => {
    const pend = estado.items.find((i) => i.requi_biologico_id === bio.id && esPendiente(i));
    const conLote = itemsDe(bio.id).filter((i) => !esPendiente(i));
    const sumaConLote = conLote.reduce((acc, i) => acc + Number(i.cantidad_surtida || 0), 0);
    return `<tr data-bio="${bio.id}">
      <td><span class="punto-bio" style="background:${colorDeBio(bio)}"></span><b>${esc(nombreCorto(bio))}</b></td>
      <td class="cant-actual">${conLote.length ? `${sumaConLote} con lote` : ''}</td>
      <td><input type="number" class="inp-cant" min="0" inputmode="numeric" placeholder="0" value="${pend ? pend.cantidad_surtida : ''}" style="border-color:color-mix(in srgb, ${colorDeBio(bio)} 50%, #e2e8f0); background:color-mix(in srgb, ${colorDeBio(bio)} 6%, #fff)"></td>
    </tr>`;
  }).join('');
  $('modalCantidades').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  actualizarResumenCantidades();
  const primero = $('cantFilas').querySelector('input');
  if (primero) primero.focus();
}

function cerrarCantidades() {
  $('modalCantidades').style.display = 'none';
  document.body.style.overflow = '';
}

function valoresCantidades() {
  return [...$('cantFilas').querySelectorAll('tr')].map((tr) => ({
    bio: tr.dataset.bio, cantidad: Math.floor(Number(tr.querySelector('input').value) || 0)
  })).filter((x) => x.cantidad > 0);
}

function actualizarResumenCantidades() {
  const v = valoresCantidades();
  const total = v.reduce((acc, x) => acc + x.cantidad, 0);
  $('cantResumen').textContent = v.length ? `${plural(v.length, 'biológico', 'biológicos')} · ${total} dosis` : '';
  $('cantGuardar').disabled = !v.length;
}

async function guardarCantidades() {
  const valores = valoresCantidades();
  if (!valores.length || !estado.requisicion) return;
  $('cantGuardar').disabled = true;
  try {
    // 1) El lote "por definir" de cada biológico (se crea una sola vez y se reutiliza).
    const faltantes = [];
    for (const v of valores) {
      const lotes = await lotesExistentesDe(v.bio);
      if (!lotes.some((l) => l.numero_lote === LOTE_PENDIENTE)) faltantes.push({ requi_biologico_id: v.bio, numero_lote: LOTE_PENDIENTE });
    }
    if (faltantes.length) {
      const { data, error } = await estado.db.from('requi_lotes').insert(faltantes).select();
      if (error) throw error;
      (data || []).forEach((l) => (estado.lotesPorBiologico[l.requi_biologico_id] ||= []).push(l));
    }
    // 2) Un renglón "por definir" por biológico (si ya había, se reemplaza su cantidad).
    const filas = valores.map((v) => ({
      requisicion_id: estado.requisicion.id, requi_biologico_id: v.bio,
      lote_id: estado.lotesPorBiologico[v.bio].find((l) => l.numero_lote === LOTE_PENDIENTE).id,
      cantidad_surtida: v.cantidad
    }));
    const { data: guardados, error: errItems } = await estado.db.from('requi_items_jurisdiccion')
      .upsert(filas, { onConflict: 'requisicion_id,requi_biologico_id,lote_id' })
      .select('*, requi_lotes(numero_lote, caducidad)');
    if (errItems) throw errItems;
    (guardados || []).forEach((g) => {
      const idx = estado.items.findIndex((i) => i.id === g.id);
      if (idx === -1) estado.items.push(g); else estado.items[idx] = g;
    });
    toast(`Se prellenaron ${plural(valores.length, 'biológico', 'biológicos')} con lote por definir.`);
    cerrarCantidades();
    renderPaso1();
    renderAvance();
  } catch (e) {
    toast('No se pudo guardar: ' + String(e.message || e).replace(/^.*?ERROR:\s*/, ''), true);
    $('cantGuardar').disabled = false;
  }
}

// Lo que sigue "por definir" sale así en el Excel: se avisa antes de exportar.
async function confirmarExportarConPendientes() {
  const n = estado.items.filter((i) => esPendiente(i) && Number(i.cantidad_surtida) > 0).length;
  return !n || confirmar({
    titulo: 'Hay lotes por definir', tono: 'aviso', aceptar: 'Exportar de todos modos',
    mensaje: `${plural(n, 'renglón sigue', 'renglones siguen')} con el lote "por definir" y así saldrá en el Excel.`
  });
}

// Un solo manejador para toda la tabla del Paso 1 (se re-dibuja completa).
function clicTablaPaso1(ev) {
  const btn = ev.target.closest('button');
  if (btn) {
    if (btn.classList.contains('btn-editar-clave')) activarEdicionClave(btn.dataset.bio);
    else if (btn.classList.contains('btn-guardar-clave')) guardarClaveArticulo(btn.dataset.bio);
    else if (btn.classList.contains('btn-cancelar-clave') || btn.classList.contains('btn-cancelar-edicion')) renderPaso1();
    else if (btn.classList.contains('btn-editar-item')) activarEdicionItem(btn.dataset.item);
    else if (btn.classList.contains('btn-guardar-edicion')) guardarEdicionItem(btn.dataset.item);
    else if (btn.classList.contains('btn-quitar-item')) quitarItemSurtido(btn.dataset.item);
    else if (btn.classList.contains('btn-asignar-lotes')) abrirAsignarLotes(btn.dataset.item);
    return;
  }
  if (ev.target.closest('input')) return;
  const fila = ev.target.closest('tr.fila-bio');
  if (fila && estado.puedeEditar) {
    seleccionarBioRapido(fila.dataset.bio, true);
    $('rapida').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function teclaTablaPaso1(ev) {
  const inp = ev.target.closest('input');
  if (!inp) return;
  const tr = inp.closest('tr.fila-lote-capturado');
  if (ev.key === 'Escape') { renderPaso1(); return; }
  if (ev.key !== 'Enter') return;
  if (tr) guardarEdicionItem(tr.dataset.item);
  else { const cont = inp.closest('.clave-bio'); if (cont) guardarClaveArticulo(cont.id.replace('clave-', '')); }
}

// ---------------------------------------------------------------------------
// Pegar desde Excel (Paso 1): reconoce biológico / lote / caducidad /
// cantidad sin importar el orden de las columnas, muestra cómo entendió cada
// fila y solo entonces importa (lotes nuevos en un solo insert, lo surtido en
// un solo upsert).
// ---------------------------------------------------------------------------

// Con texto inicial (pegado directo en el campo Lote) el biológico elegido queda como
// predeterminado; abierto con el botón no se supone ninguno, para no asignar por error.
function abrirPegar(textoInicial) {
  $('pegarBioDefecto').innerHTML = '<option value="">— detectar en cada fila —</option>'
    + estado.catalogo.map((b) => `<option value="${b.id}" ${textoInicial && b.id === estado.bioRapido ? 'selected' : ''}>${esc(b.nombre)}</option>`).join('');
  $('pegarTexto').value = textoInicial || '';
  estado.pegado = [];
  $('modalPegar').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderVistaPegado();
  if (textoInicial) analizarPegado(); else $('pegarTexto').focus();
}

function cerrarPegar() {
  $('modalPegar').style.display = 'none';
  document.body.style.overflow = '';
}

function errorFilaPegado(f) {
  if (!f.lote) return 'No encontré el número de lote.';
  if (!(f.cantidad > 0)) return 'No encontré una cantidad mayor a 0.';
  if (!f.bio) return 'No reconocí el biológico.';
  return '';
}

// Recalcula el estado de cada fila (error, repetida, lote nuevo/conocido/parecido).
function clasificarPegado() {
  const vistos = new Set();
  estado.pegado.forEach((f) => {
    f.error = errorFilaPegado(f);
    f.res = null;
    if (!f.error) {
      const clave = f.bio.id + '|' + f.lote.toUpperCase();
      if (vistos.has(clave)) f.error = 'Repetido en el pegado.';
      else {
        vistos.add(clave);
        f.res = RequiEngine.compararLote(f.lote, estado.lotesPorBiologico[f.bio.id] || []);
      }
    }
    if (f.incluir === undefined) f.incluir = !f.error && f.res.estado !== 'SIMILAR';
    if (f.error) f.incluir = false;
  });
}

async function analizarPegado() {
  const token = ++estado.pegadoToken;
  const porDefecto = estado.catalogo.find((b) => b.id === $('pegarBioDefecto').value) || null;
  const detectadas = RequiEngine.detectarFilasSurtido(RequiEngine.parsearPegado($('pegarTexto').value), estado.catalogo, porDefecto);
  await Promise.all([...new Set(detectadas.map((f) => f.bio && f.bio.id).filter(Boolean))].map(lotesExistentesDe));
  if (token !== estado.pegadoToken) return;
  estado.pegado = detectadas.map((f) => ({ ...f, caducidad: f.caducidadTexto ? parsearCaducidadInteligente(f.caducidadTexto) : null, incluir: undefined }));
  clasificarPegado();
  renderVistaPegado();
}

function pillFilaPegado(f) {
  if (f.error) return `<span class="pill pill-err">${esc(f.error)}</span>`;
  const aviso = f.caducidadTexto && !f.caducidad ? ' <span class="pill pill-warn">Caducidad no entendida</span>' : '';
  if (f.res.estado === 'EXISTE') {
    const it = itemDe(f.bio.id, f.res.lote.id);
    return (it ? `<span class="pill pill-warn">Reemplaza ${it.cantidad_surtida}</span>` : '<span class="pill pill-ok">Lote conocido</span>') + aviso;
  }
  if (f.res.estado === 'SIMILAR') return `<span class="pill pill-warn">¿"${esc(f.res.sugerencias[0].numero_lote)}"?</span>${aviso}`;
  return '<span class="pill pill-new">Nuevo</span>' + aviso;
}

function renderVistaPegado() {
  const filas = estado.pegado || [];
  const opciones = estado.catalogo.map((b) => `<option value="${b.id}">${esc(nombreCorto(b))}</option>`).join('');
  $('pegarVista').innerHTML = filas.length ? `
    <table class="vista-pegado">
      <thead><tr><th></th><th>Biológico</th><th>Lote</th><th>Caducidad</th><th>Cantidad</th><th>Estado</th></tr></thead>
      <tbody>${filas.map((f, i) => `
        <tr class="${f.error ? 'fila-error' : ''}">
          <td><input type="checkbox" data-pegar-inc="${i}" ${f.incluir ? 'checked' : ''} ${f.error ? 'disabled' : ''}></td>
          <td>${f.bio ? esc(nombreCorto(f.bio)) : `<select data-pegar-bio="${i}"><option value="">Elegir…</option>${opciones}</select>`}</td>
          <td>${esc(f.lote) || '—'}</td>
          <td>${f.caducidad ? cadHtml(f.caducidad) : '—'}</td>
          <td>${f.cantidad != null ? f.cantidad : '—'}</td>
          <td>${pillFilaPegado(f)}</td>
        </tr>`).join('')}</tbody>
    </table>` : '';
  const listas = filas.filter((f) => f.incluir).length;
  const problemas = filas.filter((f) => f.error).length;
  $('pegarResumen').textContent = filas.length ? `${plural(listas, 'lote por importar', 'lotes por importar')}${problemas ? ` · ${plural(problemas, 'fila con problema', 'filas con problemas')}` : ''}` : '';
  $('pegarImportar').disabled = listas === 0;
  $('pegarImportar').textContent = listas ? `Importar ${plural(listas, 'lote', 'lotes')}` : 'Importar';
}

async function importarPegado() {
  const filas = (estado.pegado || []).filter((f) => f.incluir && !f.error);
  if (!filas.length || !estado.requisicion) return;
  $('pegarImportar').disabled = true;
  try {
    const nuevos = [];
    const caducidadesPorCompletar = [];
    filas.forEach((f) => {
      if (f.res.estado === 'EXISTE') {
        if (f.caducidad && !f.res.lote.caducidad) caducidadesPorCompletar.push({ lote: f.res.lote, caducidad: f.caducidad });
      } else {
        nuevos.push({ requi_biologico_id: f.bio.id, numero_lote: String(f.lote).trim().toUpperCase(), caducidad: f.caducidad });
      }
    });

    let insertados = [];
    if (nuevos.length) {
      const { data, error } = await estado.db.from('requi_lotes').insert(nuevos).select();
      if (error) throw error;
      insertados = data || [];
      insertados.forEach((l) => estado.lotesPorBiologico[l.requi_biologico_id].push(l));
    }
    for (const c of caducidadesPorCompletar) {
      const { error } = await estado.db.from('requi_lotes').update({ caducidad: c.caducidad }).eq('id', c.lote.id);
      if (!error) c.lote.caducidad = c.caducidad;
    }

    const idNuevo = new Map(insertados.map((l) => [l.requi_biologico_id + '|' + l.numero_lote.toUpperCase(), l.id]));
    const filasItems = filas.map((f) => ({
      requisicion_id: estado.requisicion.id, requi_biologico_id: f.bio.id,
      lote_id: f.res.estado === 'EXISTE' ? f.res.lote.id : idNuevo.get(f.bio.id + '|' + f.lote.toUpperCase()),
      cantidad_surtida: f.cantidad
    }));
    const { data: guardados, error: errItems } = await estado.db.from('requi_items_jurisdiccion')
      .upsert(filasItems, { onConflict: 'requisicion_id,requi_biologico_id,lote_id' })
      .select('*, requi_lotes(numero_lote, caducidad)');
    if (errItems) throw errItems;
    (guardados || []).forEach((g) => {
      const idx = estado.items.findIndex((i) => i.id === g.id);
      if (idx === -1) estado.items.push(g); else estado.items[idx] = g;
    });

    toast(`Se importaron ${plural(filas.length, 'lote', 'lotes')}.`);
    cerrarPegar();
    renderPaso1();
    renderAvance();
  } catch (e) {
    toast('No se pudo importar: ' + (e.message || e), true);
    renderVistaPegado();
  }
}

// ---------------------------------------------------------------------------
// Matrices de reparto (Paso 2 y 3) -- comparten teclado, pegado, guardado y
// validación. `data-municipio` (Paso 2) o `data-unidad` (Paso 3) + data-bio +
// data-lote identifican cada celda.
// ---------------------------------------------------------------------------

function chipSaldo(saldo, repartido, asignado, prefijo) {
  const clase = asignado > 0 && saldo <= 0 ? 'completo' : repartido > 0 ? 'parcial' : '';
  const icono = clase === 'completo' ? '<span class="material-symbols-rounded">check</span>' : '';
  return `<span class="saldo-chip ${clase}">${icono}${prefijo || ''}${saldo}</span>`;
}

function celdaHtml(atributos, valor) {
  return `<input type="number" min="0" inputmode="numeric" class="celda solo-edicion ${valor > 0 ? 'con-dato' : ''}" ${atributos} value="${valor > 0 ? valor : ''}" placeholder="0" title="Doble clic: poner todo el saldo">`
    + `<span class="solo-lectura" style="display:none;">${valor > 0 ? valor : '—'}</span>`;
}

function filaGuardada(c) {
  return c.tipo === 'M'
    ? estado.distMunicipio.find((d) => d.municipio === c.destino && d.requi_biologico_id === c.bio && d.lote_id === c.lote)
    : estado.distUnidad.find((d) => d.unidad_id === c.destino && d.requi_biologico_id === c.bio && d.lote_id === c.lote);
}
function cantidadGuardada(c) { const f = filaGuardada(c); return f ? Number(f.cantidad) : 0; }
function municipioDeUnidad(unidadId) { const u = estado.unidadPorId[unidadId]; return u ? u.municipio : null; }

function cambioDeInput(inp) {
  const esM = !!inp.dataset.municipio;
  let n = inp.value.trim() === '' ? 0 : Number(inp.value);
  if (!Number.isFinite(n) || n < 0) n = 0;
  return { tipo: esM ? 'M' : 'U', destino: esM ? inp.dataset.municipio : inp.dataset.unidad, bio: inp.dataset.bio, lote: inp.dataset.lote, cantidad: Math.floor(n) };
}

function etiquetaCambio(c) {
  return c.tipo === 'M' ? etiquetaMunicipio(c.destino) : ((estado.unidadPorId[c.destino] || {}).nombre || 'la unidad');
}

function localizarInput(c) {
  const tabla = $(c.tipo === 'M' ? 'matrizMunicipio' : 'matrizUnidad');
  const attr = c.tipo === 'M' ? 'data-municipio' : 'data-unidad';
  return tabla.querySelector(`input.celda[${attr}="${c.destino}"][data-bio="${c.bio}"][data-lote="${c.lote}"]`);
}

// Saldo que le queda a la fila/columna de esa celda (para "doble clic = poner el saldo").
function saldoDeCelda(c) {
  if (c.tipo === 'M') {
    const it = itemDe(c.bio, c.lote);
    return it ? Number(it.cantidad_surtida) - sumaMunicipio(c.bio, c.lote) : 0;
  }
  const muni = municipioDeUnidad(c.destino);
  return asignadoMunicipio(muni, c.bio, c.lote) - sumaUnidadesMunicipio(muni, c.bio, c.lote);
}

// Devuelve un mensaje si el grupo (mismo lote; en unidades, mismo municipio) no cabe.
function validarGrupoReparto(lista) {
  const c0 = lista[0];
  const nuevos = new Map(lista.map((c) => [c.destino, c.cantidad]));
  if (c0.tipo === 'M') {
    const it = itemDe(c0.bio, c0.lote);
    const disp = it ? Number(it.cantidad_surtida) : 0;
    let proyectado = 0;
    DESTINOS.forEach((d) => { proyectado += nuevos.has(d.v) ? nuevos.get(d.v) : cantidadGuardada({ tipo: 'M', destino: d.v, bio: c0.bio, lote: c0.lote }); });
    if (proyectado > disp) return `Excede lo surtido del lote ${numeroLoteDe(c0.bio, c0.lote)}: disponible ${disp}, intentas repartir ${proyectado}.`;
    for (const c of lista) {
      if (!tieneUnidades(c.destino) || esHospital(c.destino)) continue;   // el hospital es su propia unidad: se le pasa solo
      const enUnidades = sumaUnidadesMunicipio(c.destino, c.bio, c.lote);
      if (c.cantidad < enUnidades) return `${etiquetaMunicipio(c.destino)} ya repartió ${enUnidades} de este lote entre sus unidades (paso 3): reduce primero ese reparto.`;
    }
    return '';
  }
  const muni = municipioDeUnidad(c0.destino);
  const asignado = asignadoMunicipio(muni, c0.bio, c0.lote);
  if (!asignado) return `${etiquetaMunicipio(muni)} no tiene asignado el lote ${numeroLoteDe(c0.bio, c0.lote)}: repártelo primero en el paso 2.`;
  let proyectado = 0;
  estado.unidades.filter((u) => u.municipio === muni).forEach((u) => {
    proyectado += nuevos.has(u.id) ? nuevos.get(u.id) : cantidadGuardada({ tipo: 'U', destino: u.id, bio: c0.bio, lote: c0.lote });
  });
  if (proyectado > asignado) return `Excede lo asignado a ${etiquetaMunicipio(muni)} del lote ${numeroLoteDe(c0.bio, c0.lote)}: disponible ${asignado}, intentas repartir ${proyectado}.`;
  return '';
}

function fusionarGuardadas(tipo, filas) {
  const arr = tipo === 'M' ? estado.distMunicipio : estado.distUnidad;
  (filas || []).forEach((r) => {
    const i = arr.findIndex((x) => x.id === r.id);
    if (i >= 0) arr[i] = r; else arr.push(r);
  });
}

// Pone en cada celda visible el valor guardado (sin pisar la que se está tecleando).
function pintarValoresMatriz(tabla, forzar) {
  tabla.querySelectorAll('input.celda').forEach((inp) => {
    const c = cambioDeInput({ dataset: inp.dataset, value: '' });
    const v = cantidadGuardada(c);
    if (document.activeElement !== inp || (forzar && forzar.includes(inp))) inp.value = v > 0 ? v : '';
    inp.classList.toggle('con-dato', v > 0);
    inp.classList.remove('error');
    const lectura = inp.nextElementSibling;
    if (lectura && lectura.classList.contains('solo-lectura')) lectura.textContent = v > 0 ? v : '—';
  });
}

function actualizarSaldosPaso2() {
  $('matrizMunicipio').querySelectorAll('tbody tr[data-key]').forEach((tr) => {
    const [bio, lote] = tr.dataset.key.split('::');
    const it = itemDe(bio, lote);
    const disp = it ? Number(it.cantidad_surtida) : 0;
    const rep = sumaMunicipio(bio, lote);
    tr.classList.toggle('completo', estadoPorSaldo(disp, rep) === 'completo');
    tr.querySelector('.saldo-td').innerHTML = chipSaldo(disp - rep, rep, disp);
  });
}

function actualizarSaldosPaso3() {
  const muni = estado.municipioPaso3;
  $('matrizUnidad').querySelectorAll('thead th[data-col]').forEach((th) => {
    const [bio, lote] = th.dataset.col.split('::');
    const asignado = asignadoMunicipio(muni, bio, lote);
    const rep = sumaUnidadesMunicipio(muni, bio, lote);
    th.querySelector('.saldo-td').innerHTML = chipSaldo(asignado - rep, rep, asignado, 'Saldo ');
  });
}

// `cambiosBrutos`: [{tipo:'M'|'U', destino, bio, lote, cantidad}]. Valida cada
// lote contra lo disponible, escribe en lote (una petición por tipo de
// operación) y actualiza la pantalla en su sitio, sin redibujar la tabla.
function guardarReparto(cambiosBrutos) {
  return encolar(async () => {
    if (!estado.puedeEditar || !estado.requisicion) return;
    // Un hospital es su propia (única) unidad: lo que se le asigna en el paso 2 se le pasa igual en el paso 3.
    cambiosBrutos = cambiosBrutos.concat(cambiosBrutos
      .filter((c) => c.tipo === 'M' && unidadDeHospital(c.destino))
      .map((c) => ({ tipo: 'U', destino: unidadDeHospital(c.destino).id, bio: c.bio, lote: c.lote, cantidad: c.cantidad, auto: true })));
    const cambios = cambiosBrutos.filter((c) => c.cantidad !== cantidadGuardada(c));
    const tablas = new Set(cambiosBrutos.map((c) => (c.tipo === 'M' ? 'matrizMunicipio' : 'matrizUnidad')));
    const repintar = (forzar) => tablas.forEach((id) => pintarValoresMatriz($(id), forzar));
    if (!cambios.length) { repintar(); return; }

    const grupos = new Map();
    cambios.forEach((c) => {
      const k = c.tipo === 'M' ? `M|${c.bio}|${c.lote}` : `U|${municipioDeUnidad(c.destino)}|${c.bio}|${c.lote}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    });
    const aceptados = [];
    const rechazos = [];
    grupos.forEach((lista) => {
      if (lista.every((c) => c.auto)) { aceptados.push(...lista); return; }   // derivado del paso 2, ya validado allá
      const msg = validarGrupoReparto(lista);
      if (msg) rechazos.push({ lista, msg }); else aceptados.push(...lista);
    });
    if (rechazos.length) {
      const inputsError = rechazos.flatMap((r) => r.lista.map(localizarInput)).filter(Boolean);
      repintar(inputsError);
      inputsError.forEach((i) => i.classList.add('error'));
      toast(rechazos[0].msg + (rechazos.length > 1 ? ` (y ${rechazos.length - 1} lote(s) más sin guardar)` : ''), true);
    }
    if (!aceptados.length) return;

    const tabla = (c) => (c.tipo === 'M' ? 'requi_distribucion_municipio' : 'requi_distribucion_unidad');
    const payload = (c) => {
      const f = filaGuardada(c);
      return {
        ...(f && f.id ? { id: f.id } : {}),
        requisicion_id: estado.requisicion.id,
        ...(c.tipo === 'M' ? { municipio: c.destino } : { unidad_id: c.destino }),
        requi_biologico_id: c.bio, lote_id: c.lote, cantidad: c.cantidad
      };
    };
    // Primero lo que baja, luego lo que sube: en ningún momento la suma del lote se pasa.
    const actualizaciones = aceptados.filter((c) => filaGuardada(c)).sort((a, b) => (a.cantidad - cantidadGuardada(a)) - (b.cantidad - cantidadGuardada(b)));
    const altas = aceptados.filter((c) => !filaGuardada(c));

    let error = null;
    for (const tipo of ['M', 'U']) {
      const upd = actualizaciones.filter((c) => c.tipo === tipo);
      const ins = altas.filter((c) => c.tipo === tipo);
      // Con `id` la validación del trigger excluye la propia fila (upsert por id);
      // un upsert por columnas únicas contaría dos veces la cantidad anterior.
      if (upd.length && !error) {
        const r = await estado.db.from(tabla(upd[0])).upsert(upd.map(payload), { onConflict: 'id' }).select();
        if (r.error) error = r.error; else fusionarGuardadas(tipo, r.data);
      }
      if (ins.length && !error) {
        const r = await estado.db.from(tabla(ins[0])).insert(ins.map(payload)).select();
        if (r.error) error = r.error; else fusionarGuardadas(tipo, r.data);
      }
    }

    renderAvance();
    renderDestinosMasivos();
    tablas.forEach((id) => (id === 'matrizMunicipio' ? actualizarSaldosPaso2() : (actualizarSaldosPaso3(), renderChipsMunicipio())));
    if (error) {
      const inputsAceptados = aceptados.map(localizarInput).filter(Boolean);
      repintar(inputsAceptados);
      toast(error.message.replace(/^.*?ERROR:\s*/, ''), true);
      return;
    }
    repintar();
    aceptados.forEach((c) => {
      const inp = localizarInput(c);
      if (inp) flashGuardado(inp.closest('td'));
    });
    toast(aceptados.length === 1 ? `Guardado: ${etiquetaCambio(aceptados[0])} = ${aceptados[0].cantidad}` : `Se guardaron ${aceptados.length} celdas.`);

  });
}

function moverFoco(inp, dFila, dCol) {
  const fila = inp.closest('tr');
  const filas = [...fila.parentElement.rows];
  const celdasDe = (f) => [...f.querySelectorAll('input.celda')];
  const col = celdasDe(fila).indexOf(inp) + dCol;
  for (let r = filas.indexOf(fila) + dFila; r >= 0 && r < filas.length; r += dFila) {
    const destino = celdasDe(filas[r])[col];
    if (destino) { destino.focus(); return true; }
  }
  return false;
}

function instalarMatriz(tabla) {
  tabla.addEventListener('change', (ev) => {
    const inp = ev.target.closest('input.celda');
    if (inp) guardarReparto([cambioDeInput(inp)]);
  });
  tabla.addEventListener('focusin', (ev) => { if (ev.target.matches && ev.target.matches('input.celda')) ev.target.select(); });
  tabla.addEventListener('keydown', (ev) => {
    const inp = ev.target.closest('input.celda');
    if (!inp) return;
    if (ev.key === 'Enter' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const arriba = ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey);
      if (!moverFoco(inp, arriba ? -1 : 1, 0)) inp.blur();
    } else if (ev.key === 'Escape') {
      inp.value = '';
      pintarValoresMatriz(tabla, [inp]);
      inp.blur();
    }
  });
  tabla.addEventListener('dblclick', (ev) => {
    const inp = ev.target.closest('input.celda');
    if (!inp || (inp.value.trim() !== '' && Number(inp.value) !== 0)) return;
    const saldo = saldoDeCelda(cambioDeInput(inp));
    if (saldo > 0) { inp.value = saldo; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  tabla.addEventListener('paste', (ev) => {
    const inp = ev.target.closest('input.celda');
    if (!inp) return;
    const texto = (ev.clipboardData || window.clipboardData).getData('text');
    const filasPeg = RequiEngine.parsearPegado(texto);
    if (filasPeg.length <= 1 && (filasPeg[0] || []).length <= 1) return; // una sola celda: pegado normal
    ev.preventDefault();
    const fila0 = inp.closest('tr');
    const filas = [...fila0.parentElement.rows];
    const celdasDe = (f) => [...f.querySelectorAll('input.celda')];
    const col0 = celdasDe(fila0).indexOf(inp);
    const r0 = filas.indexOf(fila0);
    const cambios = [];
    let ignoradas = 0;
    filasPeg.forEach((celdas, i) => {
      const fila = filas[r0 + i];
      if (!fila) return;
      const destinos = celdasDe(fila);
      celdas.forEach((celda, j) => {
        const destino = destinos[col0 + j];
        if (!destino) return;
        const n = RequiEngine.parsearEntero(celda);
        if (n === null) { if (celda !== '') ignoradas++; return; }
        destino.value = n;
        cambios.push(cambioDeInput(destino));
      });
    });
    if (ignoradas) toast(`${plural(ignoradas, 'celda pegada no era', 'celdas pegadas no eran')} un número entero y se omitió.`, true);
    if (cambios.length) guardarReparto(cambios);
  });
}

// ---------------------------------------------------------------------------
// Sugerencia según el mes anterior: reparte el saldo de cada lote SIN reparto
// con la misma proporción con que se repartió ese biológico el mes anterior
// (nunca toca lo que ya tiene algo capturado).
// ---------------------------------------------------------------------------

async function cargarPrevia() {
  const req = estado.requisicion;
  if (estado.previa && estado.previa.para === req.id) return estado.previa;
  // Las requisiciones anteriores (mes anterior o entregas previas del mismo mes), de la más reciente
  // hacia atrás. Cada biológico toma su proporción de la última donde SÍ se repartió: si hoy llega la
  // influenza, se parece a la última influenza aunque la entrega de antes fuera de esquema básico.
  const { data } = await estado.db.from('requi_requisiciones').select('id, anio, mes, entrega, etiqueta')
    .or(`anio.lt.${req.anio},and(anio.eq.${req.anio},mes.lt.${req.mes}),and(anio.eq.${req.anio},mes.eq.${req.mes},entrega.lt.${req.entrega || 1})`)
    .order('anio', { ascending: false }).order('mes', { ascending: false }).order('entrega', { ascending: false }).limit(8);
  const previas = data || [];
  const previa = { para: req.id, req: previas[0] || null, texto: '', dm: [], du: [] };
  if (previas.length) {
    const ids = previas.map((p) => p.id);
    const dmTodas = await traerTodo(() => estado.db.from('requi_distribucion_municipio').select('id, requisicion_id, requi_biologico_id, municipio, cantidad').in('requisicion_id', ids));
    const duTodas = await traerTodo(() => estado.db.from('requi_distribucion_unidad').select('id, requisicion_id, requi_biologico_id, unidad_id, cantidad').in('requisicion_id', ids));
    const orden = new Map(ids.map((id, i) => [id, i]));
    const mejorPorBio = {};
    [...dmTodas, ...duTodas].forEach((d) => {
      if (!(Number(d.cantidad) > 0)) return;
      const o = orden.get(d.requisicion_id);
      if (!(d.requi_biologico_id in mejorPorBio) || o < mejorPorBio[d.requi_biologico_id]) mejorPorBio[d.requi_biologico_id] = o;
    });
    const vale = (d) => orden.get(d.requisicion_id) === mejorPorBio[d.requi_biologico_id];
    previa.dm = dmTodas.filter(vale);
    previa.du = duTodas.filter(vale);
    const usadas = [...new Set(Object.values(mejorPorBio))].sort((x, y) => x - y).map((i) => previas[i]);
    previa.texto = usadas.map((p) => `${etiquetaMes(p)}${p.entrega > 1 || p.etiqueta ? ' (' + etiquetaEntrega(p) + ')' : ''}`).join(' y ');
  }
  estado.previa = previa;
  return previa;
}

async function sugerirPaso2() {
  if (!estado.puedeEditar) return;
  const previa = await cargarPrevia();
  if (!previa.req || !previa.dm.some((d) => Number(d.cantidad) > 0)) { toast('No hay un reparto anterior que sirva de base.', true); return; }
  const pesosPorBio = {};
  previa.dm.forEach((d) => {
    const i = DESTINOS.findIndex((x) => x.v === d.municipio);
    if (i < 0) return;
    (pesosPorBio[d.requi_biologico_id] ||= DESTINOS.map(() => 0))[i] += Number(d.cantidad || 0);
  });
  const cambios = [];
  let lotes = 0, sinBase = 0;
  itemsSurtidos().filter((it) => !estado.filtroBio2 || it.requi_biologico_id === estado.filtroBio2).forEach((it) => {
    if (sumaMunicipio(it.requi_biologico_id, it.lote_id) > 0) return;
    const rep = pesosPorBio[it.requi_biologico_id] && RequiEngine.repartirProporcional(Number(it.cantidad_surtida), pesosPorBio[it.requi_biologico_id]);
    if (!rep) { sinBase++; return; }
    lotes++;
    rep.forEach((cant, i) => { if (cant > 0) cambios.push({ tipo: 'M', destino: DESTINOS[i].v, bio: it.requi_biologico_id, lote: it.lote_id, cantidad: cant }); });
  });
  if (!cambios.length) { toast(sinBase ? 'Los lotes sin reparto no tienen antecedente en entregas anteriores.' : 'No hay lotes vacíos: todos ya tienen reparto.'); return; }
  if (!(await confirmar({
    titulo: 'Sugerir reparto', tono: 'info', aceptar: 'Llenar',
    mensaje: `Se llenarán ${plural(lotes, 'lote', 'lotes')} sin reparto con la proporción de ${previa.texto}${sinBase ? ` (${plural(sinBase, 'lote sin antecedente se queda', 'lotes sin antecedente se quedan')} vacío)` : ''}. Los que ya tienen algo no se tocan y después puedes ajustar cada cantidad.`
  }))) return;
  await guardarReparto(cambios);
}

async function sugerirPaso3() {
  if (!estado.puedeEditar) return;
  const muni = estado.municipioPaso3;
  const previa = await cargarPrevia();
  if (!previa.req || !previa.du.some((d) => Number(d.cantidad) > 0)) { toast('No hay un reparto a unidades anterior que sirva de base.', true); return; }
  const unidades = estado.unidades.filter((u) => u.municipio === muni);
  const pesosPorBio = {};
  previa.du.forEach((d) => {
    const i = unidades.findIndex((u) => u.id === d.unidad_id);
    if (i < 0) return;
    (pesosPorBio[d.requi_biologico_id] ||= unidades.map(() => 0))[i] += Number(d.cantidad || 0);
  });
  const cambios = [];
  let lotes = 0, sinBase = 0;
  columnasPaso3(muni).forEach((col) => {
    if (sumaUnidadesMunicipio(muni, col.bio, col.lote) > 0) return;
    const rep = pesosPorBio[col.bio] && RequiEngine.repartirProporcional(col.asignado, pesosPorBio[col.bio]);
    if (!rep) { sinBase++; return; }
    lotes++;
    rep.forEach((cant, i) => { if (cant > 0) cambios.push({ tipo: 'U', destino: unidades[i].id, bio: col.bio, lote: col.lote, cantidad: cant }); });
  });
  if (!cambios.length) { toast(sinBase ? 'Los lotes sin reparto no tienen antecedente en entregas anteriores.' : 'No hay lotes vacíos: todos ya tienen reparto.'); return; }
  if (!(await confirmar({
    titulo: `Sugerir reparto · ${etiquetaMunicipio(muni)}`, tono: 'info', aceptar: 'Llenar',
    mensaje: `Se llenarán ${plural(lotes, 'lote', 'lotes')} de ${etiquetaMunicipio(muni)} sin reparto con la proporción de ${previa.texto}${sinBase ? ` (${plural(sinBase, 'lote sin antecedente se queda', 'lotes sin antecedente se quedan')} vacío)` : ''}. Los que ya tienen algo no se tocan y después puedes ajustar cada cantidad.`
  }))) return;
  await guardarReparto(cambios);
}

// ---------------------------------------------------------------------------
// Paso 2 — Reparto a Municipios y Hospitales (6 destinos hermanos)
// ---------------------------------------------------------------------------

function renderChipsFiltro2() {
  const surtidos = itemsSurtidos();
  const bios = estado.catalogo.filter((b) => surtidos.some((i) => i.requi_biologico_id === b.id));
  if (estado.filtroBio2 && !bios.some((b) => b.id === estado.filtroBio2)) estado.filtroBio2 = '';
  $('chipsFiltro2').innerHTML = surtidos.length ? `<button type="button" class="chip-bio ${estado.filtroBio2 ? '' : 'activo'}" data-filtro="" style="--c:#0f172a"><i></i>Todos<b>${surtidos.length}</b></button>`
    + bios.map((b) => `<button type="button" class="chip-bio ${estado.filtroBio2 === b.id ? 'activo' : ''}" data-filtro="${b.id}" style="--c:${colorDeBio(b)}" title="${esc(b.nombre)}"><i></i>${esc(nombreCorto(b))}<b>${surtidos.filter((i) => i.requi_biologico_id === b.id).length}</b></button>`).join('') : '';
}

function renderMatrizMunicipio() {
  const tabla = $('matrizMunicipio');
  const surtidos = itemsSurtidos();
  renderChipsFiltro2();
  if (!surtidos.length) {
    tabla.innerHTML = '<tbody><tr><td class="vacio-matriz">Todavía no hay lotes surtidos. Captúralos en el paso 1 y aquí aparecerán para repartirlos.</td></tr></tbody>';
    return;
  }
  const visibles = surtidos.filter((i) => !estado.filtroBio2 || i.requi_biologico_id === estado.filtroBio2);
  const bioDe = (id) => estado.catalogo.find((b) => b.id === id) || {};
  tabla.innerHTML = `
    <thead><tr><th class="col-fija">Biológico · lote</th><th class="col-num">Surtido</th>${DESTINOS.map((d) => `<th class="col-num">${esc(d.l)}</th>`).join('')}<th class="col-num">Saldo</th></tr></thead>
    <tbody>${visibles.map((it) => {
      const bio = it.requi_biologico_id, lote = it.lote_id;
      const disp = Number(it.cantidad_surtida);
      const rep = sumaMunicipio(bio, lote);
      return `<tr data-key="${claveLote(bio, lote)}" class="${estadoPorSaldo(disp, rep) === 'completo' ? 'completo' : ''}">
        <th scope="row" class="col-fija" style="--c:${colorDeBio(bioDe(bio))}"><b>${esc(nombreCorto(bioDe(bio)))}</b><small>Lote ${esc(it.requi_lotes.numero_lote)} · Cad. ${cadHtml(it.requi_lotes.caducidad)}</small></th>
        <td class="col-num"><b>${disp}</b></td>
        ${DESTINOS.map((d) => `<td>${celdaHtml(`data-municipio="${d.v}" data-bio="${bio}" data-lote="${lote}"`, asignadoMunicipio(d.v, bio, lote))}</td>`).join('')}
        <td class="col-num saldo-td">${chipSaldo(disp - rep, rep, disp)}</td>
      </tr>`;
    }).join('')}</tbody>`;
}

// ---------------------------------------------------------------------------
// Paso 3 — Reparto a Unidades (solo los 4 municipios reales; los hospitales
// no tienen unidades, ver Paso 2)
// ---------------------------------------------------------------------------

function columnasPaso3(muni) {
  return estado.distMunicipio.filter((d) => d.municipio === muni && Number(d.cantidad) > 0 && itemDe(d.requi_biologico_id, d.lote_id))
    .map((d) => ({ bio: d.requi_biologico_id, lote: d.lote_id, asignado: Number(d.cantidad) }))
    .sort((a, b) => ordenCatalogo(a.bio) - ordenCatalogo(b.bio) || String(numeroLoteDe(a.bio, a.lote)).localeCompare(String(numeroLoteDe(b.bio, b.lote))));
}

function renderChipsMunicipio() {
  const p3 = (estado.avance && estado.avance.p3) || [];
  $('chipsMunicipio').innerHTML = DESTINOS.filter((m) => tieneUnidades(m.v)).map((m) => {
    const propios = p3.filter((x) => x.muni === m.v);
    const hechos = propios.filter((x) => x.est === 'completo').length;
    const est = !propios.length ? '' : hechos === propios.length ? 'completo' : 'parcial';
    return `<button type="button" class="chip-bio ${est} ${estado.municipioPaso3 === m.v ? 'activo' : ''}" data-muni="${m.v}" style="--c:#16a34a"><i></i>${esc(m.l)}<b>${propios.length ? `${hechos}/${propios.length}` : 'sin lotes'}</b></button>`;
  }).join('');
}

function renderPaso3() {
  renderChipsMunicipio();
  const muni = estado.municipioPaso3;
  const tabla = $('matrizUnidad');
  const cols = columnasPaso3(muni);
  const unidades = estado.unidades.filter((u) => u.municipio === muni);
  if (!cols.length) {
    tabla.innerHTML = `<tbody><tr><td class="vacio-matriz">${esc(etiquetaMunicipio(muni))} todavía no tiene lotes asignados. Repártelos primero en el paso 2.</td></tr></tbody>`;
    return;
  }
  if (!unidades.length) {
    tabla.innerHTML = '<tbody><tr><td class="vacio-matriz">Sin unidades registradas para este municipio.</td></tr></tbody>';
    return;
  }
  const bioDe = (id) => estado.catalogo.find((b) => b.id === id) || {};
  tabla.innerHTML = `
    <thead><tr><th class="col-fija">Unidad</th>${cols.map((c) => {
      const rep = sumaUnidadesMunicipio(muni, c.bio, c.lote);
      return `<th class="col-lote-h" data-col="${claveLote(c.bio, c.lote)}" style="--c:${colorDeBio(bioDe(c.bio))}"><span class="barra-color"></span><b>${esc(nombreCorto(bioDe(c.bio)))}</b><small>Lote ${esc(numeroLoteDe(c.bio, c.lote))}</small><small>Cad. ${caducidadDe(c.bio, c.lote)}</small><span class="saldo-td">${chipSaldo(c.asignado - rep, rep, c.asignado, 'Saldo ')}</span></th>`;
    }).join('')}<th class="col-num">Excel</th></tr></thead>
    <tbody>${unidades.map((u) => `<tr data-unidad-fila="${u.id}">
      <th scope="row" class="col-fija"><b>${esc(u.nombre)}</b>${u.clues ? `<small>${esc(u.clues)}</small>` : ''}</th>
      ${cols.map((c) => `<td>${celdaHtml(`data-unidad="${u.id}" data-bio="${c.bio}" data-lote="${c.lote}"`, cantidadGuardada({ tipo: 'U', destino: u.id, bio: c.bio, lote: c.lote }))}</td>`).join('')}
      <td><button type="button" class="icon-btn-pure" data-export-unidad="${u.id}" title="Exportar Excel de esta unidad"><span class="material-symbols-rounded">download</span></button></td>
    </tr>`).join('')}</tbody>`;
}

// ---------------------------------------------------------------------------
// Exportación — clona la plantilla oficial real (requisiciones_export_
// excel.js), 1:1 con el Excel original. Genera .xlsx descargables; el
// número de copias (2 jurisdiccional/municipal, 3 unidad) se imprime desde
// ahí mismo, no se "hornean" páginas de más en el archivo.
// ---------------------------------------------------------------------------

async function obtenerPlantillaBuffer() {
  if (!estado.plantillaBuffer) {
    const resp = await fetch('requisiciones_plantilla.xlsx');
    estado.plantillaBuffer = await resp.arrayBuffer();
  }
  return estado.plantillaBuffer;
}

// Construye los datos (encabezado/firmas/renglones) de UN destino, sin
// generar ni descargar nada -- se reutiliza tanto para exportar uno solo
// como para el paquete masivo.
async function construirDatosDestino(nivel, destino) {
  let filasPorBiologico = {};
  let destinoNombre = '', destinoDireccion = '';
  let unidadDestino = null;

  if (nivel === 'JURISDICCIONAL') {
    destinoNombre = 'JURISDICCIÓN SANITARIA N.1 (concentrado)';
    destinoDireccion = DIRECCION_JURISDICCION;
    estado.items.forEach((it) => {
      if (Number(it.cantidad_surtida) <= 0) return;
      (filasPorBiologico[it.requi_biologico_id] ||= []).push({
        cantidad: it.cantidad_surtida, numeroLote: it.requi_lotes.numero_lote, caducidad: it.requi_lotes.caducidad
      });
    });
  } else if (nivel === 'MUNICIPAL') {
    destinoNombre = NOMBRE_DESTINO_EXPORT[destino] || destino;
    destinoDireccion = DIRECCION_HOSPITAL[destino] || '';
    const { data } = await estado.db.from('requi_distribucion_municipio')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', estado.requisicion.id).eq('municipio', destino).gt('cantidad', 0);
    (data || []).forEach((it) => (filasPorBiologico[it.requi_biologico_id] ||= []).push({
      cantidad: it.cantidad, numeroLote: it.requi_lotes.numero_lote, caducidad: it.requi_lotes.caducidad
    }));
  } else {
    unidadDestino = estado.unidades.find((u) => u.id === destino);
    const muniLabel = unidadDestino ? MUNICIPIOS_REALES.find((m) => m.v === unidadDestino.municipio) : null;
    // Nombre impreso y domicilio reales de la unidad (requi_unidades, tomados de
    // las hojas por unidad de los Excel oficiales); sin domicilio, va el municipio.
    destinoNombre = unidadDestino ? (unidadDestino.nombre_impresion || `C.S. ${unidadDestino.nombre}`) : '';
    destinoDireccion = (unidadDestino && unidadDestino.direccion) || (muniLabel ? muniLabel.l : '');
    const { data } = await estado.db.from('requi_distribucion_unidad')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', estado.requisicion.id).eq('unidad_id', destino).gt('cantidad', 0);
    (data || []).forEach((it) => (filasPorBiologico[it.requi_biologico_id] ||= []).push({
      cantidad: it.cantidad, numeroLote: it.requi_lotes.numero_lote, caducidad: it.requi_lotes.caducidad
    }));
  }

  const { data: firmasJuris } = await estado.db.from('requi_firmas').select('*')
    .eq('nivel', 'JURISDICCIONAL').eq('destino', 'JURISDICCION').maybeSingle();

  // Entrega/Recibe: para JURISDICCIONAL y un municipio real, ambos vienen
  // del catálogo cacheado. Para una unidad, "recibe" siempre va en blanco
  // -- la unidad firma a mano y anota su propio nombre en el papel -- pero
  // "entrega" SÍ debe llevar nombre: es el mismo responsable municipal que
  // entrega en las demás requisiciones de ese municipio, no alguien que
  // firme en el papel. Antes ambos quedaban en blanco para unidades.
  let entregaRecibe = {};
  if (nivel === 'JURISDICCIONAL') entregaRecibe = firmasJuris || {};
  else if (nivel === 'MUNICIPAL' && !esHospital(destino)) {
    const { data } = await estado.db.from('requi_firmas').select('*').eq('nivel', 'MUNICIPAL').eq('destino', destino).maybeSingle();
    entregaRecibe = data || {};
  } else if (nivel !== 'MUNICIPAL' && unidadDestino) {
    const { data } = await estado.db.from('requi_firmas').select('*').eq('nivel', 'MUNICIPAL').eq('destino', unidadDestino.municipio).maybeSingle();
    entregaRecibe = { entrega_nombre: data?.entrega_nombre, entrega_cargo: data?.entrega_cargo };
  }
  const firmas = {
    elaboro_nombre: firmasJuris?.elaboro_nombre, elaboro_cargo: firmasJuris?.elaboro_cargo,
    autorizo_nombre: firmasJuris?.autorizo_nombre, autorizo_cargo: firmasJuris?.autorizo_cargo,
    entrega_nombre: entregaRecibe.entrega_nombre, entrega_cargo: entregaRecibe.entrega_cargo,
    recibe_nombre: entregaRecibe.recibe_nombre, recibe_cargo: entregaRecibe.recibe_cargo
  };

  const mesInfo = MESES.find((m) => m.v === estado.requisicion.mes);
  const encabezado = {
    origenNombre: 'JURISDICCIÓN SANITARIA N.1', area: 'VACUNAS', origenDireccion: DIRECCION_JURISDICCION,
    fechaEnvio: fechaExcelUtc(estado.requisicion.fecha_envio),
    destinoNombre, folio: estado.requisicion.folio_oracle || '', destinoDireccion,
    mesLabel: mesInfo ? `${mesInfo.l.toUpperCase()} ${estado.requisicion.anio}${variasEntregas() ? ` · ENTREGA ${estado.requisicion.entrega}${estado.requisicion.etiqueta ? ' (' + estado.requisicion.etiqueta.toUpperCase() + ')' : ''}` : ''}` : ''
  };

  const nombreArchivo = `Requisicion_${nivel}_${(destinoNombre || destino).replace(/[^\wÁÉÍÓÚÑáéíóúñ ]/g, '').trim().replace(/\s+/g, '_')}_${estado.requisicion.anio}-${String(estado.requisicion.mes).padStart(2, '0')}${sufijoEntregaArchivo()}.xlsx`;

  return { encabezado, firmas, catalogo: estado.catalogo, filasPorBiologico, nombreArchivo };
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function registrarExportacion(nivel, destino, copias) {
  const { data: { session } } = await estado.db.auth.getSession();
  if (!session) return;
  await estado.db.from('requi_pdf_generados').insert({
    requisicion_id: estado.requisicion.id, nivel, destino: destino || 'JURISDICCION', copias, generado_por: session.user.email
  });
}

// Aviso común de lo que no cupo en el formato oficial.
function avisosExportacion(sinRenglon) {
  return sinRenglon.length ? [`${sinRenglon.join(', ')} no tiene renglón en el formato oficial y NO salió en el Excel.`] : [];
}

// Un municipio = UN solo archivo: una pestaña por cada unidad con reparto (si se pide) y, al final, la
// pestaña municipal. Los hospitales no tienen unidades: llevan solo su hoja.
async function generarLibroMunicipio(destino, incluirUnidades) {
  const hojas = [];
  const unidades = (incluirUnidades && !esHospital(destino))
    ? estado.unidades.filter((u) => u.municipio === destino && estado.distUnidad.some((d) => d.unidad_id === u.id && Number(d.cantidad) > 0))
    : [];
  for (const u of unidades) hojas.push({ ...(await construirDatosDestino('UNIDAD', u.id)), nombreHoja: u.nombre });
  const municipal = await construirDatosDestino('MUNICIPAL', destino);
  hojas.push({ ...municipal, nombreHoja: unidades.length ? 'MUNICIPAL' : 'GENERAL' });
  const plantillaBuffer = await obtenerPlantillaBuffer();
  const { buffer, sinRenglon } = await RequiExportExcel.generarLibro({ plantillaBuffer, hojas });
  for (const u of unidades) await registrarExportacion('UNIDAD', u.id, COPIAS_SUGERIDAS.UNIDAD);
  await registrarExportacion('MUNICIPAL', destino, COPIAS_SUGERIDAS.MUNICIPAL);
  return { buffer, sinRenglon, nombreArchivo: municipal.nombreArchivo, unidades: unidades.length };
}

async function exportarUno(nivel, destino) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  if (!(await confirmarExportarConPendientes())) return;
  toast('Generando Excel…');
  try {
    const tipoXlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    let sinRenglon, resumen;
    if (nivel === 'MUNICIPAL') {
      const libro = await generarLibroMunicipio(destino, $('chkIncluirUnidades').checked);
      descargarBlob(new Blob([libro.buffer], { type: tipoXlsx }), libro.nombreArchivo);
      sinRenglon = libro.sinRenglon;
      resumen = libro.unidades ? `Excel generado: ${plural(libro.unidades, 'pestaña de unidad', 'pestañas de unidades')} y la municipal al final.` : 'Excel generado.';
    } else {
      const datos = await construirDatosDestino(nivel, destino);
      const plantillaBuffer = await obtenerPlantillaBuffer();
      const resultado = await RequiExportExcel.generar({ plantillaBuffer, ...datos });
      descargarBlob(new Blob([resultado.buffer], { type: tipoXlsx }), datos.nombreArchivo);
      sinRenglon = resultado.sinRenglon;
      resumen = 'Excel generado.';
      await registrarExportacion(nivel, destino, COPIAS_SUGERIDAS[nivel] || 1);
    }
    const avisos = avisosExportacion(sinRenglon);
    toast(avisos.length ? `${resumen} Ojo: ${avisos.join(' ')}` : resumen, !!avisos.length);
  } catch (e) {
    toast('No se pudo generar el Excel: ' + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Exportación masiva — el día de entrega se imprime todo de una vez: se
// eligen destinos con filtros (checkboxes) y se descarga un solo .zip con
// un .xlsx por cada requisición, en vez de exportar uno por uno.
// ---------------------------------------------------------------------------

function renderDestinosMasivos() {
  const cont = $('destinosMasivos');
  cont.innerHTML = DESTINOS.map((m) => {
    const tieneDatos = estado.distMunicipio.some((d) => d.municipio === m.v && Number(d.cantidad) > 0);
    return `
      <div class="destino-masivo-fila" data-tipo-destino="${esHospital(m.v) ? 'hospitales' : 'municipios'}">
        <label class="destino-masivo-chk">
          <input type="checkbox" class="chk-destino-masivo" value="${m.v}" ${tieneDatos ? 'checked' : ''}>
          ${m.l} <span class="cuenta">${tieneDatos ? '' : '(sin repartir)'}</span>
        </label>
        <button type="button" class="icon-btn-pure btn-exportar-uno-destino" data-destino="${m.v}" title="Exportar solo ${m.l}">
          <span class="material-symbols-rounded" style="font-size:17px">download</span>
        </button>
      </div>
    `;
  }).join('');
  cont.querySelectorAll('.btn-exportar-uno-destino').forEach((btn) => {
    btn.addEventListener('click', () => exportarUno('MUNICIPAL', btn.dataset.destino));
  });
}

function aplicarFiltroDestinosMasivos(filtro) {
  document.querySelectorAll('#destinosMasivos .destino-masivo-fila').forEach((fila) => {
    fila.querySelector('.chk-destino-masivo').checked = filtro === 'todos' || fila.dataset.tipoDestino === filtro;
  });
}

async function exportarMasivo() {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const seleccionados = [...document.querySelectorAll('.chk-destino-masivo:checked')].map((c) => c.value);
  if (!seleccionados.length) { toast('Selecciona al menos un destino.', true); return; }
  const incluirUnidades = $('chkIncluirUnidades').checked;
  if (!(await confirmarExportarConPendientes())) return;

  toast('Generando paquete…');
  try {
    if (window.ensureLibsLoaded) await window.ensureLibsLoaded('jszip');
    const zip = new JSZip();
    const sinRenglonTotal = new Set();
    let pestanas = 0;

    // Un archivo por municipio/hospital; las unidades de cada municipio van dentro, una por pestaña.
    for (const destino of seleccionados) {
      const libro = await generarLibroMunicipio(destino, incluirUnidades);
      zip.file(libro.nombreArchivo, libro.buffer);
      libro.sinRenglon.forEach((x) => sinRenglonTotal.add(x));
      pestanas += libro.unidades + 1;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    descargarBlob(zipBlob, `Requisiciones_${estado.requisicion.anio}-${String(estado.requisicion.mes).padStart(2, '0')}${sufijoEntregaArchivo()}.zip`);
    toast(`Listo: ${plural(seleccionados.length, 'archivo', 'archivos')} (${plural(pestanas, 'pestaña', 'pestañas')}) en el paquete.`
      + (sinRenglonTotal.size ? ` Sin renglón en el formato oficial (no salió): ${[...sinRenglonTotal].join(', ')}.` : ''), !!sinRenglonTotal.size);
  } catch (e) {
    toast('No se pudo generar el paquete: ' + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Transferencias -- repositorio de PDF mensuales (solo ADMIN y JURISDICCIONAL:
// lo garantiza la RLS de requi_transferencias; el botón solo se muestra a quien
// puede editar). Los archivos van al mismo Cloudflare R2 de las evidencias, vía
// la función r2-signer. La ruta lleva un token aleatorio para que la URL
// pública no se pueda adivinar; el nombre del archivo es siempre
// Transferencias_Mes_Año.pdf y volver a subir el mismo mes lo reemplaza.
// ---------------------------------------------------------------------------

const R2_PUBLIC_URL = 'https://pub-149cbeba11c04e8c9ba986d1addcdcc0.r2.dev';
const R2_BUCKET = 'sirevaq-evidencias';
const MAX_PDF_BYTES = 40 * 1024 * 1024;

function nombreTransferencia(anio, mes) {
  const m = MESES.find((x) => x.v === Number(mes));
  return `Transferencias_${m ? m.l : mes}_${anio}.pdf`;
}

function actualizarNombreTransferencia() {
  $('transNombre').textContent = nombreTransferencia($('transAnio').value, $('transMes').value);
}

async function abrirTransferencias() {
  if (!estado.puedeEditar) return;
  const hoy = new Date();
  $('transMes').innerHTML = MESES.map((m) => `<option value="${m.v}">${m.l}</option>`).join('');
  $('transMes').value = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();
  $('transAnio').innerHTML = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1]
    .map((a) => `<option value="${a}">${a}</option>`).join('');
  $('transAnio').value = anioActual;
  $('transArchivo').value = '';
  $('transArchivoNombre').textContent = 'Ningún PDF elegido';
  $('transSubir').disabled = true;
  actualizarNombreTransferencia();
  $('modalTransferencias').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await cargarTransferencias();
}

function cerrarTransferencias() {
  $('modalTransferencias').style.display = 'none';
  document.body.style.overflow = '';
}

async function cargarTransferencias() {
  const { data, error } = await estado.db.from('requi_transferencias').select('*')
    .order('anio', { ascending: false }).order('mes', { ascending: false });
  if (error) { toast('No se pudieron cargar las transferencias: ' + error.message, true); return; }
  estado.transferencias = data || [];
  const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  $('transLista').innerHTML = estado.transferencias.map((t) => {
    const m = MESES.find((x) => x.v === t.mes);
    return `<tr>
      <td><strong>${esc(m ? m.l : t.mes)} ${t.anio}</strong></td>
      <td><a class="trans-ver" href="${esc(t.public_url)}" target="_blank" rel="noopener"><span class="material-symbols-rounded" style="font-size:16px">picture_as_pdf</span>${esc(t.nombre_archivo)}</a></td>
      <td>${t.tamano_bytes ? kb(t.tamano_bytes) : '—'}</td>
      <td>${esc(t.subido_por || '—')}<br><small style="color:var(--muted)">${esc(new Date(t.subido_en).toLocaleDateString('es-MX'))}</small></td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:var(--muted)">Todavía no hay transferencias cargadas.</td></tr>';
}

async function subirTransferencia() {
  const file = $('transArchivo').files[0];
  if (!file || !estado.puedeEditar) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('El archivo debe ser un PDF.', true); return; }
  if (file.size > MAX_PDF_BYTES) { toast('El PDF pesa más de 40 MB.', true); return; }
  const anio = Number($('transAnio').value);
  const mes = Number($('transMes').value);
  const nombre = nombreTransferencia(anio, mes);
  const previa = estado.transferencias.find((t) => t.anio === anio && t.mes === mes);
  if (previa && !(await confirmar({
    titulo: 'Ya hay una transferencia de ese mes', tono: 'aviso', aceptar: 'Reemplazar',
    mensaje: `Ya hay una transferencia de ${etiquetaMes({ anio, mes })}. ¿Reemplazarla con este archivo?`
  }))) return;
  // Mismo mes = misma ruta (se sobrescribe); mes nuevo = token nuevo.
  const ruta = previa ? previa.ruta : `Requisiciones/Transferencias/${crypto.randomUUID()}/${nombre}`;

  $('transSubir').disabled = true;
  $('transSubir').textContent = 'Subiendo…';
  try {
    const { data: { session } } = await estado.db.auth.getSession();
    const fd = new FormData();
    fd.append('file', file, nombre);
    fd.append('folderPath', ruta);
    fd.append('contentType', 'application/pdf');
    const headers = { apikey: SUPABASE_KEY };
    if (session) headers.Authorization = 'Bearer ' + session.access_token;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/r2-signer`, { method: 'POST', headers, body: fd });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok || !resultado.ok) throw new Error(resultado.error || `Error de carga (${resp.status})`);

    const publicUrl = `${R2_PUBLIC_URL}/${ruta}`;
    const { error } = await estado.db.from('requi_transferencias').upsert({
      anio, mes, nombre_archivo: nombre, ruta, public_url: publicUrl, tamano_bytes: file.size,
      subido_por: estado.perfil.usuario, subido_en: new Date().toISOString()
    }, { onConflict: 'anio,mes' });
    if (error) throw error;
    // Registro en r2_objects para que cuente en el límite de almacenamiento.
    await estado.db.from('r2_objects').upsert({
      name: ruta, bucket_id: R2_BUCKET, owner: session ? session.user.id : null, public_url: publicUrl,
      updated_at: new Date().toISOString(), metadata: { size: file.size, mimetype: 'application/pdf', cacheControl: '3600' }
    }, { onConflict: 'name' });

    toast(`${nombre} cargado.`);
    $('transArchivo').value = '';
    $('transArchivoNombre').textContent = 'Ningún PDF elegido';
    await cargarTransferencias();
  } catch (e) {
    toast('No se pudo subir: ' + (e.message || e), true);
    $('transSubir').disabled = false;
  } finally {
    $('transSubir').textContent = 'Subir';
  }
}

// ---------------------------------------------------------------------------
// Navegación de pasos / arranque
// ---------------------------------------------------------------------------

function togglePanelExportar(forzarCerrado) {
  const panel = $('panelExportar');
  const abierto = panel.style.display !== 'none';
  panel.style.display = (forzarCerrado || abierto) ? 'none' : 'block';
}

function toggleResponsables() {
  const cuerpo = $('cuerpoResponsables');
  const icono = $('iconoToggleResponsables');
  const abierto = cuerpo.style.display !== 'none';
  cuerpo.style.display = abierto ? 'none' : 'block';
  icono.style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
}

// Cada paso se dibuja al entrar (siempre desde lo guardado), así lo capturado
// en un paso ya se ve en los demás sin tener que recargar.
function activarPaso(n, opciones) {
  n = Number(n);
  estado.pasoActual = n;
  document.querySelectorAll('.paso-tab').forEach((t) => t.classList.toggle('activo', t.dataset.paso === String(n)));
  document.querySelectorAll('.paso-panel').forEach((p) => p.classList.remove('activo'));
  $('panelPaso' + n).classList.add('activo');
  renderAvance();
  if (n === 1) renderPaso1();
  else if (n === 2) renderMatrizMunicipio();
  else renderPaso3();
  if (!(opciones && opciones.sinScroll)) window.scrollTo({ top: Math.max(0, $('contenidoRequisicion').offsetTop - 16), behavior: 'smooth' });
}

function instalarEventos() {
  // Pasos: barra flotante, stepper superior y botón Siguiente
  document.querySelectorAll('.paso-tab').forEach((tab) => tab.addEventListener('click', () => activarPaso(tab.dataset.paso)));
  $('stepper').addEventListener('click', (ev) => { const b = ev.target.closest('[data-paso]'); if (b) activarPaso(b.dataset.paso); });
  $('btnSiguiente').addEventListener('click', () => activarPaso(Math.min(3, estado.pasoActual + 1)));
  ['avancePaso1', 'avancePaso2', 'avancePaso3'].forEach((id) => {
    $(id).addEventListener('click', (ev) => { const b = ev.target.closest('.pt[data-ir]'); if (b) irDesdePunto(b); });
  });

  // Cabecera
  $('btnCargar').addEventListener('click', () => cargarRequisicion());
  $('selAnio').addEventListener('change', () => cargarRequisicion());
  $('selMes').addEventListener('change', () => cargarRequisicion());
  $('barraEntregas').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-entrega]');
    if (b) cargarRequisicion(Number(b.dataset.entrega));
  });
  $('btnNuevaEntrega').addEventListener('click', nuevaEntrega);
  $('btnRenombrarEntrega').addEventListener('click', renombrarEntrega);
  $('btnGuardarCabecera').addEventListener('click', guardarCabecera);
  $('btnCrearRequisicion').addEventListener('click', guardarCabecera);
  $('btnPdfJurisdiccional').addEventListener('click', () => exportarUno('JURISDICCIONAL', ''));
  $('btnGuardarFirmasJuris').addEventListener('click', guardarFirmasJurisdiccionales);
  $('btnExportarMasivo').addEventListener('click', exportarMasivo);
  $('btnToggleResponsables').addEventListener('click', toggleResponsables);
  $('btnAbrirExportar').addEventListener('click', (ev) => { ev.stopPropagation(); togglePanelExportar(); });
  $('panelExportar').addEventListener('click', (ev) => ev.stopPropagation());
  document.addEventListener('click', () => togglePanelExportar(true));
  $('btnAbrirExplorador').addEventListener('click', toggleExplorador);
  $('btnCerrarMes').addEventListener('click', cerrarMes);
  document.querySelectorAll('.chip-filtro[data-filtro-destino]').forEach((chip) => {
    chip.addEventListener('click', () => aplicarFiltroDestinosMasivos(chip.dataset.filtroDestino));
  });

  // Paso 1: captura rápida
  $('chipsBio').addEventListener('click', (ev) => { const b = ev.target.closest('.chip-bio'); if (b) seleccionarBioRapido(b.dataset.bio, true); });
  $('rapLote').addEventListener('input', evaluarLoteRapido);
  $('rapLote').addEventListener('change', evaluarLoteRapido);
  $('rapCad').addEventListener('input', (ev) => {
    $('rapCad').dataset.auto = '';
    const completa = aplicarMascaraFecha(ev);
    actualizarVistaCad($('rapCad'));
    if (completa) $('rapCant').focus();     // fecha completa: pasa sola a la cantidad
  });
  $('rapLote').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    evaluarLoteRapido();
    // Lote ya conocido = su caducidad ya viene puesta: se salta directo a la cantidad.
    (($('rapCad').dataset.auto === '1' && $('rapCad').value) ? $('rapCant') : $('rapCad')).focus();
  });
  $('rapCad').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('rapCant').focus(); } });
  $('rapCant').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); agregarRapido(); } });
  $('rapAgregar').addEventListener('click', agregarRapido);
  // Pegar varias filas de Excel directo en el campo Lote abre la vista previa.
  $('rapLote').addEventListener('paste', (ev) => {
    const texto = (ev.clipboardData || window.clipboardData).getData('text');
    if (/[\t\n]/.test(texto.trim())) { ev.preventDefault(); abrirPegar(texto); }
  });
  $('btnPegarSurtido').addEventListener('click', () => abrirPegar(''));
  $('chkSoloConLotes').addEventListener('click', () => { estado.soloConLotes = !estado.soloConLotes; renderPaso1(); });
  $('tbodyBiologicos').addEventListener('click', clicTablaPaso1);
  $('tbodyBiologicos').addEventListener('keydown', teclaTablaPaso1);
  $('tbodyBiologicos').addEventListener('input', (ev) => {
    if (!(ev.target.classList && ev.target.classList.contains('inp-editar-caducidad'))) return;
    const completa = aplicarMascaraFecha(ev);
    actualizarVistaCad(ev.target);
    if (completa) { const c = ev.target.closest('tr').querySelector('.inp-editar-cantidad'); if (c) c.focus(); }
  });

  // Estado de guardado: chip, panel de pendientes, botón Guardar y Ctrl+S
  $('dockGuardado').addEventListener('click', (ev) => { ev.stopPropagation(); alternarPanelPendientes(); });
  $('panelPendientes').addEventListener('click', (ev) => {
    ev.stopPropagation();
    const b = ev.target.closest('[data-pp]');
    if (!b) return;
    const acc = b.dataset.pp;
    if (acc === 'guardar') guardarTodo();
    else { alternarPanelPendientes(false); activarPaso(Number(acc.replace('paso', ''))); if (acc === 'paso1') { const av = $('avisoPendientes'); if (av && av.style.display !== 'none') av.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  });
  document.addEventListener('click', () => alternarPanelPendientes(false));
  $('btnGuardarTodo').addEventListener('click', guardarTodo);
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      guardarTodo();
    }
  });
  // Lo tecleado sin confirmar se refleja al momento en el chip.
  let refrescoGuardado;
  const programarRefresco = () => { clearTimeout(refrescoGuardado); refrescoGuardado = setTimeout(actualizarEstadoGuardado, 120); };
  document.addEventListener('input', programarRefresco, true);
  document.addEventListener('change', programarRefresco, true);
  setInterval(() => { if (!document.hidden) actualizarEstadoGuardado(); }, 15000);
  window.addEventListener('beforeunload', (ev) => {
    if (estado.puedeEditar && ['guardando', 'sucio'].includes(faseGuardado())) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // Confirmación propia
  $('confirmarAceptar').addEventListener('click', () => cerrarConfirmar(true));
  $('confirmarCancelar').addEventListener('click', () => cerrarConfirmar(false));
  $('modalConfirmar').addEventListener('click', (ev) => { if (ev.target === $('modalConfirmar')) cerrarConfirmar(false); });

  // Diálogo de texto (nombre de la entrega)
  $('textoAceptar').addEventListener('click', () => cerrarTexto($('textoValor').value));
  $('textoCancelar').addEventListener('click', () => cerrarTexto(null));
  $('textoCerrar').addEventListener('click', () => cerrarTexto(null));
  $('modalTexto').addEventListener('click', (ev) => { if (ev.target === $('modalTexto')) cerrarTexto(null); });
  $('textoValor').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); cerrarTexto($('textoValor').value); } });
  $('textoSugerencias').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sug]');
    if (b) { $('textoValor').value = b.dataset.sug; $('textoValor').focus(); }
  });

  // Números de lote: se escriben (y se guardan) siempre en MAYÚSCULAS.
  document.addEventListener('input', (ev) => {
    const inp = ev.target;
    if (!inp.matches || !inp.matches('#rapLote, input[data-campo="lote"]')) return;
    const alto = inp.value.toUpperCase();
    if (alto !== inp.value) { const p = inp.selectionStart; inp.value = alto; try { inp.setSelectionRange(p, p); } catch (e) { /* tipo sin selección */ } }
  });

  // Prellenar cantidades (modal)
  $('btnSyncLotes').addEventListener('click', sincronizarLotes);
  $('btnPrellenar').addEventListener('click', abrirCantidades);
  $('cantCerrar').addEventListener('click', cerrarCantidades);
  $('cantCancelar').addEventListener('click', cerrarCantidades);
  $('cantGuardar').addEventListener('click', guardarCantidades);
  $('modalCantidades').addEventListener('click', (ev) => { if (ev.target === $('modalCantidades')) cerrarCantidades(); });
  $('cantFilas').addEventListener('input', actualizarResumenCantidades);
  $('cantFilas').addEventListener('focusin', (ev) => { if (ev.target.matches('input')) ev.target.select(); });
  $('cantFilas').addEventListener('keydown', (ev) => {
    const inp = ev.target.closest('input');
    if (!inp || !['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
    ev.preventDefault();
    const filas = [...$('cantFilas').querySelectorAll('input')];
    const i = filas.indexOf(inp) + ((ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey)) ? -1 : 1);
    if (filas[i]) filas[i].focus(); else if (ev.key === 'Enter') guardarCantidades();
  });
  // Pegar una columna de Excel: se reparte hacia abajo desde la celda donde se pegó.
  $('cantFilas').addEventListener('paste', (ev) => {
    const inp = ev.target.closest('input');
    if (!inp) return;
    const texto = (ev.clipboardData || window.clipboardData).getData('text');
    const celdas = RequiEngine.parsearPegado(texto).map((f) => f[f.length - 1]);
    if (celdas.length <= 1) return;
    ev.preventDefault();
    const filas = [...$('cantFilas').querySelectorAll('input')];
    celdas.forEach((c, k) => {
      const n = RequiEngine.parsearEntero(c);
      const dest = filas[filas.indexOf(inp) + k];
      if (dest && n !== null) dest.value = n;
    });
    actualizarResumenCantidades();
  });

  // Asignar lotes (modal) y avisos de lotes por definir
  $('avisoPendientes').addEventListener('click', (ev) => { const b = ev.target.closest('.btn-asignar-lotes'); if (b) abrirAsignarLotes(b.dataset.item); });
  $('asigFilas').addEventListener('input', alCambiarFilaAsignar);
  $('asigFilas').addEventListener('change', alCambiarFilaAsignar);
  $('asigFilas').addEventListener('click', (ev) => {
    const q = ev.target.closest('.asig-quitar');
    if (q && estado.asig) { estado.asig.filas.splice(Number(q.dataset.i), 1); renderAsignarFilas(); }
  });
  $('asigFilas').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input')) { ev.preventDefault(); confirmarAsignarLotes(); } });
  $('asigAgregar').addEventListener('click', agregarFilaAsignar);
  $('asigCerrar').addEventListener('click', cerrarAsignarLotes);
  $('asigCancelar').addEventListener('click', cerrarAsignarLotes);
  $('asigGuardar').addEventListener('click', confirmarAsignarLotes);
  $('modalAsignar').addEventListener('click', (ev) => { if (ev.target === $('modalAsignar')) cerrarAsignarLotes(); });

  // Transferencias (modal)
  $('btnAbrirTransferencias').addEventListener('click', abrirTransferencias);
  $('transCerrar').addEventListener('click', cerrarTransferencias);
  $('transCerrar2').addEventListener('click', cerrarTransferencias);
  $('modalTransferencias').addEventListener('click', (ev) => { if (ev.target === $('modalTransferencias')) cerrarTransferencias(); });
  $('transMes').addEventListener('change', actualizarNombreTransferencia);
  $('transAnio').addEventListener('change', actualizarNombreTransferencia);
  $('transArchivo').addEventListener('change', () => {
    const f = $('transArchivo').files[0];
    $('transArchivoNombre').textContent = f ? f.name : 'Ningún PDF elegido';
    $('transSubir').disabled = !f;
  });
  $('transSubir').addEventListener('click', subirTransferencia);

  // Pegar desde Excel (modal)
  let debounce;
  $('pegarTexto').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(analizarPegado, 150); });
  $('pegarBioDefecto').addEventListener('change', analizarPegado);
  $('pegarCerrar').addEventListener('click', cerrarPegar);
  $('pegarCancelar').addEventListener('click', cerrarPegar);
  $('pegarImportar').addEventListener('click', importarPegado);
  $('modalPegar').addEventListener('click', (ev) => { if (ev.target === $('modalPegar')) cerrarPegar(); });
  $('pegarVista').addEventListener('change', (ev) => {
    const chk = ev.target.closest('[data-pegar-inc]');
    const sel = ev.target.closest('[data-pegar-bio]');
    if (chk) { estado.pegado[Number(chk.dataset.pegarInc)].incluir = chk.checked; renderVistaPegado(); }
    if (sel && sel.value) {
      const f = estado.pegado[Number(sel.dataset.pegarBio)];
      f.bio = estado.catalogo.find((b) => b.id === sel.value) || null;
      f.incluir = undefined;
      lotesExistentesDe(sel.value).then(() => { clasificarPegado(); renderVistaPegado(); });
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if ($('modalConfirmar').style.display !== 'none') cerrarConfirmar(false);
    else if ($('panelPendientes').style.display !== 'none') alternarPanelPendientes(false);
    else if ($('modalTexto').style.display !== 'none') cerrarTexto(null);
    else if ($('modalPegar').style.display !== 'none') cerrarPegar();
    else if ($('modalAsignar').style.display !== 'none') cerrarAsignarLotes();
    else if ($('modalCantidades').style.display !== 'none') cerrarCantidades();
    else if ($('modalTransferencias').style.display !== 'none') cerrarTransferencias();
    else if (estado.bioRapido) { seleccionarBioRapido(null); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  });
  // Clic fuera de la captura (botones de biológico, recuadro y tabla) quita la selección del biológico.
  document.addEventListener('click', (ev) => {
    if (!estado.bioRapido || !ev.target.isConnected) return;
    if (ev.target.closest('#chipsBio, #rapida, #tbodyBiologicos, .modal-fondo, .dock-sis, #toast, .ayuda-btn')) return;
    seleccionarBioRapido(null);
  });

  // Paso 2 y 3: matrices
  instalarMatriz($('matrizMunicipio'));
  instalarMatriz($('matrizUnidad'));
  $('chipsFiltro2').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip-bio');
    if (b) { estado.filtroBio2 = b.dataset.filtro; renderMatrizMunicipio(); }
  });
  $('chipsMunicipio').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip-bio');
    if (b) { estado.municipioPaso3 = b.dataset.muni; renderPaso3(); }
  });
  $('matrizUnidad').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-export-unidad]');
    if (b) exportarUno('UNIDAD', b.dataset.exportUnidad);
  });
  $('btnSugerir2').addEventListener('click', sugerirPaso2);
  $('btnSugerir3').addEventListener('click', sugerirPaso3);
}

document.addEventListener('DOMContentLoaded', async () => {
  initDb();
  poblarSelectoresCabecera();
  instalarEventos();
  await cargarSesionReal();
  await cargarCatalogoYUnidades();
  await cargarFirmasJurisdiccionales();
  await renderFirmasMunicipio();
  await cargarRequisicion();
  if (window.DockGlass) window.DockGlass.instalar($('dockPasosTabs'));
});
