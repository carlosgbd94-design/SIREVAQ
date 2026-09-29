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

// Puente opcional hacia la tabla "lotes" (panel "Carga de lotes por
// municipio", ya usado por Biovac) -- solo aplica a los 4 municipios reales.
const MUNICIPIO_A_LOTES = { CORREGIDORA: 'CORREGIDORA', HUIMILPAN: 'HUIMILPAN', MARQUES: 'EL MARQUÉS', QUERETARO: 'QUERÉTARO' };
const CODIGO_A_LOTES_BIOLOGICO = {
  '148': 'NEUMOCÓCICA 13', '150': 'ROTAVIRUS', '6135': 'HEXAVALENTE', '2526': 'HEPATITIS B',
  '3825': 'HEPATITIS A', '3800': 'SR', '3801': 'BCG', '3805': 'DPT', '3808': 'TDPA',
  '3810': 'TD', '6056': 'VARICELA', '3820': 'SRP', '6317': 'INFLUENZA', '6501': 'VPH', '6509': 'VSR'
};

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
  '6317': '#C26750', '3832': '#0f172a', '6501': '#2A9D8F', '2': '#0f172a', '6509': '#A66B50'
};
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
  guardandoRapido: false,
  cola: Promise.resolve()
};

function $(id) { return document.getElementById(id); }

function toast(msg, esError) {
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
  estado.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
  if (resultado.estado === 'EXISTE') return `<span class="pill pill-ok badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">check_circle</span> Lote conocido (${esc(formatMmmAa(resultado.lote.caducidad)) || 'sin caducidad'})</span>`;
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
    estado.db.from('requi_unidades').select('*').eq('activo', true).order('municipio').order('nombre')
  ]);
  estado.catalogo = catalogo || [];
  estado.unidades = unidades || [];
  estado.unidadPorId = Object.fromEntries(estado.unidades.map((u) => [u.id, u]));
}

async function guardarCabecera() {
  if (!estado.puedeEditar) return;
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  const { data, error } = await estado.db.from('requi_requisiciones')
    .upsert({ anio, mes, creado_por: estado.perfil.usuario }, { onConflict: 'anio,mes' })
    .select().single();
  if (error) { toast('No se pudo guardar la cabecera: ' + error.message, true); return; }
  estado.requisicion = data;
  toast('Requisición guardada.');
  renderEstadoRequisicion();
  await cargarDatosRequisicion();
}

async function cargarRequisicion() {
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  const { data, error } = await estado.db.from('requi_requisiciones')
    .select('*').eq('anio', anio).eq('mes', mes).maybeSingle();
  if (error) { toast('Error al cargar: ' + error.message, true); return; }
  estado.requisicion = data;
  renderEstadoRequisicion();
  if (!data) {
    $('contenidoRequisicion').style.display = 'none';
    document.body.classList.remove('con-dock');
    $('hintCabecera').style.display = 'none';
    const mesInfo = MESES.find((m) => m.v === mes);
    $('tituloSinRequisicion').textContent = `Todavía no hay requisición de ${mesInfo ? mesInfo.l : mes} ${anio}`;
    $('textoSinRequisicion').textContent = estado.puedeEditar
      ? 'Créala para empezar: primero capturas lo que llegó del almacén y luego lo repartes a municipios, hospitales y unidades.'
      : 'Aún no se ha capturado la requisición de este mes.';
    $('tarjetaSinRequisicion').style.display = 'flex';
    return;
  }
  $('tarjetaSinRequisicion').style.display = 'none';
  $('hintCabecera').style.display = 'none';
  await cargarDatosRequisicion();
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
  const aviso = pendientes ? `

Ojo: ${plural(pendientes, 'reparto todavía tiene', 'repartos todavía tienen')} saldo sin repartir (puntos ámbar o grises).` : '';
  const ok = confirm('¿Cerrar esta requisición? Se marca como enviada. Si después necesitas corregir algo, puedes seguir editándola aquí mismo -- quedará marcada como "corregida posteriormente" para que municipios y unidades lo sepan.' + aviso);
  if (!ok) return;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .update({ estado: 'CERRADA', cerrado_en: new Date().toISOString(), fecha_envio: estado.requisicion.fecha_envio || ultimoDiaMes(estado.requisicion.anio, estado.requisicion.mes) })
    .eq('id', estado.requisicion.id).select().single();
  if (error) { toast('No se pudo cerrar: ' + error.message, true); return; }
  estado.requisicion = data;
  toast('Requisición cerrada.');
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
    .select('*').order('anio', { ascending: false }).order('mes', { ascending: false });
  if (error) { toast('No se pudo cargar el historial: ' + error.message, true); return; }
  renderExplorador(data || []);
}

function renderExplorador(filas) {
  $('tbodyExplorador').innerHTML = filas.map((r) => {
    const mesInfo = MESES.find((m) => m.v === r.mes);
    const esCerrada = r.estado === 'CERRADA';
    return `
      <tr class="${estado.requisicion && estado.requisicion.id === r.id ? 'activa' : ''}">
        <td><strong>${mesInfo ? mesInfo.l : r.mes} ${r.anio}</strong></td>
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
  estado.requisicion = r;
  renderEstadoRequisicion();
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
function etiquetaMunicipio(v) { const d = DESTINOS.find((x) => x.v === v); return d ? d.l : v; }
function etiquetaMes(req) { const m = MESES.find((x) => x.v === req.mes); return `${m ? m.l : req.mes} ${req.anio}`; }
function claveLote(bioId, loteId) { return bioId + '::' + loteId; }

function itemDe(bioId, loteId) { return estado.items.find((i) => i.requi_biologico_id === bioId && i.lote_id === loteId); }
function itemsDe(biologicoId) { return estado.items.filter((i) => i.requi_biologico_id === biologicoId); }
function ordenCatalogo(bioId) { const i = estado.catalogo.findIndex((b) => b.id === bioId); return i < 0 ? 999 : i; }
function numeroLoteDe(bioId, loteId) { const it = itemDe(bioId, loteId); return it ? it.requi_lotes.numero_lote : '?'; }
function caducidadDe(bioId, loteId) { const it = itemDe(bioId, loteId); return it ? formatMmmAa(it.requi_lotes.caducidad) : '—'; }

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
  const p3 = estado.distMunicipio.filter((d) => Number(d.cantidad) > 0 && esMunicipioReal(d.municipio))
    .map((d) => {
      const asignado = Number(d.cantidad);
      const rep = sumaU.get(d.municipio + '|' + claveLote(d.requi_biologico_id, d.lote_id)) || 0;
      return { muni: d.municipio, bio: d.requi_biologico_id, lote: d.lote_id, disp: asignado, rep, est: estadoPorSaldo(asignado, rep) };
    })
    .sort((a, b) => MUNICIPIOS_REALES.findIndex((m) => m.v === a.muni) - MUNICIPIOS_REALES.findIndex((m) => m.v === b.muni)
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
  const limpiarAuto = () => { if (cad.dataset.auto === '1') { cad.value = ''; cad.dataset.auto = ''; } };
  if (!texto) { limpiarAuto(); nota.innerHTML = ''; return; }
  const res = RequiEngine.compararLote(texto, estado.lotesPorBiologico[bioId] || []);
  let extra = '';
  if (res.estado === 'EXISTE') {
    if (!cad.value || cad.dataset.auto === '1') { cad.value = formatMmmAa(res.lote.caducidad); cad.dataset.auto = '1'; }
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
    const continuar = confirm(`El lote "${numeroLote}" se parece a "${resultado.sugerencias[0].numero_lote}", ya registrado. ¿Seguro que es un lote NUEVO y distinto? Cancelar para corregir la captura.`);
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
  const numeroLote = $('rapLote').value.trim();
  const caducidadTexto = $('rapCad').value.trim();
  const cantidad = Number($('rapCant').value);
  if (!numeroLote) { toast('Escribe el número de lote.', true); $('rapLote').focus(); return; }
  if (!cantidad || cantidad <= 0) { toast('La cantidad debe ser mayor a 0.', true); $('rapCant').focus(); return; }
  let caducidad = null;
  if (caducidadTexto) {
    caducidad = parsearCaducidadInteligente(caducidadTexto);
    if (!caducidad) { toast('No entendí la caducidad. Usa por ejemplo FEB-27.', true); $('rapCad').focus(); return; }
  }

  estado.guardandoRapido = true;
  try {
    if (!(await guardarLoteSurtido(bioId, numeroLote, caducidad, cantidad))) return;
    const bio = estado.catalogo.find((b) => b.id === bioId);
    toast(`Lote ${numeroLote} de ${nombreCorto(bio)} guardado.`);
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
    <tr class="fila-lote-capturado" data-item="${it.id}" data-bio="${bio.id}">
      <td class="lote-cel" colspan="3"><span class="chip-lote"><span class="material-symbols-rounded">qr_code_2</span>Lote ${esc(it.requi_lotes.numero_lote)}</span><span class="cad-lote">Cad. ${esc(formatMmmAa(it.requi_lotes.caducidad)) || '—'}</span></td>
      <td><div class="cant-wrap"><strong>${it.cantidad_surtida}</strong><span class="solo-edicion">
        <button type="button" class="icon-btn-pure btn-editar-item" data-item="${it.id}" title="Editar"><span class="material-symbols-rounded" style="font-size:16px">edit</span></button>
        <button type="button" class="icon-btn-pure btn-quitar-item" data-item="${it.id}" data-bio="${bio.id}" title="Quitar"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
      </span></div></td>
    </tr>`).join('');
  return filaBio + filasLotes;
}

function renderPaso1() {
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
    <td class="lote-cel" colspan="3"><span class="chip-lote"><span class="material-symbols-rounded">qr_code_2</span>Lote ${esc(item.requi_lotes.numero_lote)}</span>
      <input type="text" class="inp-editar-caducidad" value="${esc(formatMmmAa(item.requi_lotes.caducidad))}" placeholder="FEB-27"></td>
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
  const caducidadTexto = tr.querySelector('.inp-editar-caducidad').value.trim();
  const cantidad = Number(tr.querySelector('.inp-editar-cantidad').value);
  if (!cantidad || cantidad <= 0) { toast('La cantidad debe ser mayor a 0.', true); return; }

  let caducidad = item.requi_lotes.caducidad;
  if (caducidadTexto) {
    const parseada = parsearCaducidadInteligente(caducidadTexto);
    if (!parseada) { toast('No entendí la caducidad. Usa por ejemplo FEB-27.', true); return; }
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
  if (!confirm('¿Quitar este lote de lo surtido? Esto falla si ya tiene reparto asignado.')) return;
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
          <td>${f.caducidad ? esc(formatMmmAa(f.caducidad)) : '—'}</td>
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
        nuevos.push({ requi_biologico_id: f.bio.id, numero_lote: f.lote, caducidad: f.caducidad });
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
      if (!esMunicipioReal(c.destino)) continue;
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

    // En segundo plano: espejo hacia la tabla "lotes" del sistema anterior.
    const paraLotes = aceptados.filter((c) => c.tipo === 'M');
    if (paraLotes.length) (async () => { for (const c of paraLotes) await sincronizarLotePublico(c.destino, c.bio, c.lote, c.cantidad); })();
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
  const { data } = await estado.db.from('requi_requisiciones').select('id, anio, mes')
    .or(`anio.lt.${req.anio},and(anio.eq.${req.anio},mes.lt.${req.mes})`)
    .order('anio', { ascending: false }).order('mes', { ascending: false }).limit(1);
  const previa = { para: req.id, req: (data && data[0]) || null, dm: [], du: [] };
  if (previa.req) {
    previa.dm = await traerTodo(() => estado.db.from('requi_distribucion_municipio').select('id, requi_biologico_id, municipio, cantidad').eq('requisicion_id', previa.req.id));
    previa.du = await traerTodo(() => estado.db.from('requi_distribucion_unidad').select('id, requi_biologico_id, unidad_id, cantidad').eq('requisicion_id', previa.req.id));
  }
  estado.previa = previa;
  return previa;
}

async function sugerirPaso2() {
  if (!estado.puedeEditar) return;
  const previa = await cargarPrevia();
  if (!previa.req || !previa.dm.some((d) => Number(d.cantidad) > 0)) { toast('No hay un reparto de un mes anterior que sirva de base.', true); return; }
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
  if (!cambios.length) { toast(sinBase ? 'Los lotes sin reparto no tienen antecedente en el mes anterior.' : 'No hay lotes vacíos: todos ya tienen reparto.'); return; }
  if (!confirm(`Se llenarán ${plural(lotes, 'lote', 'lotes')} sin reparto con la proporción de ${etiquetaMes(previa.req)}${sinBase ? ` (${plural(sinBase, 'lote sin antecedente se queda', 'lotes sin antecedente se quedan')} vacío)` : ''}. Los que ya tienen algo no se tocan y después puedes ajustar cada cantidad. ¿Continuar?`)) return;
  await guardarReparto(cambios);
}

async function sugerirPaso3() {
  if (!estado.puedeEditar) return;
  const muni = estado.municipioPaso3;
  const previa = await cargarPrevia();
  if (!previa.req || !previa.du.some((d) => Number(d.cantidad) > 0)) { toast('No hay un reparto a unidades de un mes anterior que sirva de base.', true); return; }
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
  if (!cambios.length) { toast(sinBase ? 'Los lotes sin reparto no tienen antecedente en el mes anterior.' : 'No hay lotes vacíos: todos ya tienen reparto.'); return; }
  if (!confirm(`Se llenarán ${plural(lotes, 'lote', 'lotes')} de ${etiquetaMunicipio(muni)} sin reparto con la proporción de ${etiquetaMes(previa.req)}${sinBase ? ` (${plural(sinBase, 'lote sin antecedente se queda', 'lotes sin antecedente se quedan')} vacío)` : ''}. Los que ya tienen algo no se tocan y después puedes ajustar cada cantidad. ¿Continuar?`)) return;
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
        <th scope="row" class="col-fija" style="--c:${colorDeBio(bioDe(bio))}"><b>${esc(nombreCorto(bioDe(bio)))}</b><small>Lote ${esc(it.requi_lotes.numero_lote)} · Cad. ${esc(formatMmmAa(it.requi_lotes.caducidad)) || '—'}</small></th>
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
  $('chipsMunicipio').innerHTML = MUNICIPIOS_REALES.map((m) => {
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
      return `<th class="col-lote-h" data-col="${claveLote(c.bio, c.lote)}" style="--c:${colorDeBio(bioDe(c.bio))}"><span class="barra-color"></span><b>${esc(nombreCorto(bioDe(c.bio)))}</b><small>Lote ${esc(numeroLoteDe(c.bio, c.lote))}</small><small>Cad. ${esc(caducidadDe(c.bio, c.lote))}</small><span class="saldo-td">${chipSaldo(c.asignado - rep, rep, c.asignado, 'Saldo ')}</span></th>`;
    }).join('')}<th class="col-num">Excel</th></tr></thead>
    <tbody>${unidades.map((u) => `<tr data-unidad-fila="${u.id}">
      <th scope="row" class="col-fija"><b>${esc(u.nombre)}</b></th>
      ${cols.map((c) => `<td>${celdaHtml(`data-unidad="${u.id}" data-bio="${c.bio}" data-lote="${c.lote}"`, cantidadGuardada({ tipo: 'U', destino: u.id, bio: c.bio, lote: c.lote }))}</td>`).join('')}
      <td><button type="button" class="icon-btn-pure" data-export-unidad="${u.id}" title="Exportar Excel de esta unidad"><span class="material-symbols-rounded">download</span></button></td>
    </tr>`).join('')}</tbody>`;
}

// Automático desde guardarReparto -- no es una acción que el
// usuario dispare, así que nunca interrumpe con un toast: si el biológico
// o el municipio no tienen equivalente en el sistema viejo (ej. Hospitales,
// o un biológico que no existía cuando se armó ese catálogo), simplemente
// no hay nada que sincronizar ahí. Si falla la escritura, no es grave --
// solo afecta el autocompletado de caducidad en captura de aplicaciones,
// no ningún conteo de inventario -- se reintenta solo en el siguiente
// guardado de este mismo reparto.
async function sincronizarLotePublico(municipio, biologicoId, loteId, cantidad) {
  const bio = estado.catalogo.find((b) => b.id === biologicoId);
  const lote = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  const nombreLotesTabla = bio ? CODIGO_A_LOTES_BIOLOGICO[bio.codigo_articulo] : null;
  const municipioLotesTabla = MUNICIPIO_A_LOTES[municipio];
  if (!nombreLotesTabla || !municipioLotesTabla || !lote) return;

  const numeroLote = lote.requi_lotes.numero_lote;
  await estado.db.from('lotes').delete()
    .eq('biologico', nombreLotesTabla).eq('lote', numeroLote).eq('municipio', municipioLotesTabla);
  // cantidad 0 = ya no se reparte a este municipio -- se queda borrado, no se reinserta.
  if (cantidad > 0) {
    await estado.db.from('lotes')
      .insert({ biologico: nombreLotesTabla, lote: numeroLote, caducidad: lote.requi_lotes.caducidad, municipio: municipioLotesTabla, tipo: 'NORMAL' });
  }
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
    destinoNombre = unidadDestino ? `C.S. ${unidadDestino.nombre}` : '';
    destinoDireccion = muniLabel ? muniLabel.l : '';
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
    mesLabel: mesInfo ? `${mesInfo.l.toUpperCase()} ${estado.requisicion.anio}` : ''
  };

  const nombreArchivo = `Requisicion_${nivel}_${(destinoNombre || destino).replace(/[^\wÁÉÍÓÚÑáéíóúñ ]/g, '').trim().replace(/\s+/g, '_')}_${estado.requisicion.anio}-${String(estado.requisicion.mes).padStart(2, '0')}.xlsx`;

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

async function exportarUno(nivel, destino) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  toast('Generando Excel…');
  try {
    const datos = await construirDatosDestino(nivel, destino);
    const plantillaBuffer = await obtenerPlantillaBuffer();
    const { buffer, sobrantes } = await RequiExportExcel.generar({ plantillaBuffer, ...datos });
    descargarBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), datos.nombreArchivo);

    const copias = COPIAS_SUGERIDAS[nivel] || 1;
    toast(sobrantes.length
      ? `Excel generado. Ojo: ${sobrantes.join(', ')} tiene más de 2 lotes -- el formato solo admite 2, repórtalo aparte.`
      : `Excel generado.`, !!sobrantes.length);
    await registrarExportacion(nivel, destino, copias);
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

  toast('Generando paquete…');
  try {
    if (window.ensureLibsLoaded) await window.ensureLibsLoaded('jszip');
    const zip = new JSZip();
    const plantillaBuffer = await obtenerPlantillaBuffer();
    const sobrantesTotal = new Set();
    let total = 0;

    for (const destino of seleccionados) {
      const datos = await construirDatosDestino('MUNICIPAL', destino);
      const { buffer, sobrantes } = await RequiExportExcel.generar({ plantillaBuffer, ...datos });
      zip.file(datos.nombreArchivo, buffer);
      sobrantes.forEach((s) => sobrantesTotal.add(s));
      total++;
      await registrarExportacion('MUNICIPAL', destino, COPIAS_SUGERIDAS.MUNICIPAL);

      if (incluirUnidades && !esHospital(destino)) {
        const unidadesDeEste = estado.unidades.filter((u) => u.municipio === destino);
        for (const u of unidadesDeEste) {
          const tieneAsignado = estado.distUnidad.some((d) => d.unidad_id === u.id && Number(d.cantidad) > 0);
          if (!tieneAsignado) continue;
          const datosU = await construirDatosDestino('UNIDAD', u.id);
          const { buffer: bufU, sobrantes: sobU } = await RequiExportExcel.generar({ plantillaBuffer, ...datosU });
          zip.file(datosU.nombreArchivo, bufU);
          sobU.forEach((s) => sobrantesTotal.add(s));
          total++;
          await registrarExportacion('UNIDAD', u.id, COPIAS_SUGERIDAS.UNIDAD);
        }
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    descargarBlob(zipBlob, `Requisiciones_${estado.requisicion.anio}-${String(estado.requisicion.mes).padStart(2, '0')}.zip`);
    toast(`Listo: ${total} archivo(s) en el paquete.` + (sobrantesTotal.size ? ` Ojo con lotes de sobra en: ${[...sobrantesTotal].join(', ')}.` : ''), !!sobrantesTotal.size);
  } catch (e) {
    toast('No se pudo generar el paquete: ' + e.message, true);
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
  $('btnCargar').addEventListener('click', cargarRequisicion);
  $('selAnio').addEventListener('change', cargarRequisicion);
  $('selMes').addEventListener('change', cargarRequisicion);
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
  $('rapCad').addEventListener('input', () => { $('rapCad').dataset.auto = ''; });
  $('rapCad').addEventListener('blur', () => {
    const p = parsearCaducidadInteligente($('rapCad').value);
    if (p) $('rapCad').value = formatMmmAa(p);
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
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('modalPegar').style.display !== 'none') cerrarPegar(); });

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
