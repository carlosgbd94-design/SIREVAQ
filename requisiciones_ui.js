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
  puedeEditar: false,
  plantillaBuffer: null
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
  if (resultado.estado === 'EXISTE') return `<span class="pill pill-ok badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">check_circle</span> Ya existe (${formatMmmAa(resultado.lote.caducidad)})</span>`;
  if (resultado.estado === 'SIMILAR') return `<span class="pill pill-warn badge-comparador"><span class="material-symbols-rounded" style="font-size:12px">warning</span> ¿"${resultado.sugerencias[0].numero_lote}"?</span>`;
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
    $('hintCabecera').style.display = 'block';
    $('hintCabecera').innerHTML = estado.puedeEditar
      ? 'No existe requisición para este mes todavía. Presiona el botón de guardar (💾) para crearla.'
      : 'No existe requisición capturada para este mes.';
    return;
  }
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
  const ok = confirm('¿Cerrar esta requisición? Se marca como enviada. Si después necesitas corregir algo, puedes seguir editándola aquí mismo -- quedará marcada como "corregida posteriormente" para que municipios y unidades lo sepan.');
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
  $('panelExplorador').style.display = 'none';
  await cargarDatosRequisicion();
}

async function cargarDatosRequisicion() {
  if (!estado.requisicion) return;
  const reqId = estado.requisicion.id;
  const [{ data: items }, { data: dm }, { data: du }] = await Promise.all([
    estado.db.from('requi_items_jurisdiccion').select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', reqId).order('created_at'),
    estado.db.from('requi_distribucion_municipio').select('*').eq('requisicion_id', reqId),
    estado.db.from('requi_distribucion_unidad').select('*').eq('requisicion_id', reqId)
  ]);
  estado.items = items || [];
  estado.distMunicipio = dm || [];
  estado.distUnidad = du || [];
  $('contenidoRequisicion').style.display = 'block';
  document.body.classList.add('con-dock');
  actualizarPildorasDock();
  renderPaso1();
  renderSelectLotesPaso2();
  renderSelectMunicipioYLotesPaso3();
  renderDestinosMasivos();
}

// ---------------------------------------------------------------------------
// Paso 1 — Lo surtido: da clic en un biológico para ver/agregar sus lotes.
// Sin límite de lotes (el límite de 2 por biológico es solo un detalle
// físico de la plantilla de exportación, no de la captura).
// ---------------------------------------------------------------------------

function itemsDe(biologicoId) {
  return estado.items.filter((i) => i.requi_biologico_id === biologicoId);
}

function textoClave(bio) {
  return bio.codigo_articulo ? `${bio.clave_articulo} · ${bio.codigo_articulo}` : bio.clave_articulo;
}

function filasBiologicoHtml(bio, idx) {
  const items = itemsDe(bio.id);
  const total = items.reduce((acc, i) => acc + Number(i.cantidad_surtida || 0), 0);
  const esMultidosis = bio.presentacion === 'MULTIDOSIS';
  return `
    <tr class="fila-bio" data-bio="${bio.id}">
      <td>${idx + 1}</td>
      <td>
        <strong>${bio.nombre}</strong><br>
        <span class="clave-bio" id="clave-${bio.id}">
          <span class="clave-texto">${textoClave(bio)}</span>
          <button class="icon-btn-pure btn-editar-clave solo-edicion" data-bio="${bio.id}" title="Editar clave de artículo"><span class="material-symbols-rounded">edit</span></button>
        </span>
      </td>
      <td><span class="pill-presentacion ${esMultidosis ? 'multidosis' : ''}">${bio.presentacion}</span></td>
      <td><span class="badge-count ${items.length ? 'tiene-lotes' : ''}"><span class="dot"></span>${items.length} lote${items.length === 1 ? '' : 's'}</span></td>
      <td><strong>${total}</strong></td>
    </tr>
    <tr id="detalle-${bio.id}" class="fila-detalle" style="display:none;"><td colspan="5" style="background:var(--surface-container);">${renderDetalleBiologico(bio, items)}</td></tr>
  `;
}

function renderPaso1() {
  const tbody = $('tbodyBiologicos');
  tbody.innerHTML = estado.catalogo.map((bio, idx) => filasBiologicoHtml(bio, idx)).join('');
  tbody.querySelectorAll('tr.fila-bio').forEach((tr) => cablearResumen(tr));
  tbody.querySelectorAll('tr.fila-detalle').forEach((tr) => cablearDetalle(tr));
}

// Clic en la fila abre/cierra el detalle -- el botón de editar clave vive
// dentro de esa misma fila, así que necesita stopPropagation para no
// disparar también el toggle del detalle.
function cablearResumen(trResumen) {
  trResumen.addEventListener('click', () => toggleDetalle(trResumen.dataset.bio));
  trResumen.querySelectorAll('.btn-editar-clave').forEach((btn) => {
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); activarEdicionClave(btn.dataset.bio); });
  });
}

function toggleDetalle(bioId) {
  const detalle = $('detalle-' + bioId);
  const abierto = detalle.style.display !== 'none';
  document.querySelectorAll('tr.fila-detalle').forEach((d) => (d.style.display = 'none'));
  document.querySelectorAll('tr.fila-bio').forEach((tr) => tr.classList.remove('activa'));
  detalle.style.display = abierto ? 'none' : 'table-row';
  if (!abierto) document.querySelector(`tr.fila-bio[data-bio="${bioId}"]`).classList.add('activa');
}

function cablearDetalle(trDetalle) {
  trDetalle.querySelectorAll('.btn-agregar-lote').forEach((btn) => btn.addEventListener('click', () => agregarLoteSurtido(btn.dataset.bio)));
  trDetalle.querySelectorAll('.btn-quitar-item').forEach((btn) => btn.addEventListener('click', () => quitarItemSurtido(btn.dataset.item, btn.dataset.bio)));
  trDetalle.querySelectorAll('.btn-editar-item').forEach((btn) => btn.addEventListener('click', () => activarEdicionItem(btn.dataset.item, btn.dataset.bio)));
  const inpCantidad = trDetalle.querySelector('.inp-cantidad-nueva');
  if (inpCantidad) inpCantidad.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') agregarLoteSurtido(inpCantidad.dataset.bio); });
}

// Edición en línea de un lote ya capturado -- solo cantidad y caducidad (no
// número de lote: cambiarlo es, en la práctica, un lote distinto, así que
// para eso se sigue usando quitar + volver a agregar con el comparador).
function activarEdicionItem(itemId, bioId) {
  const item = estado.items.find((i) => i.id === itemId);
  const tr = document.querySelector(`tr.fila-lote-capturado[data-item="${itemId}"]`);
  if (!item || !tr) return;
  tr.innerHTML = `
    <td>${item.requi_lotes.numero_lote}</td>
    <td><input type="text" class="inp-editar-caducidad" value="${formatMmmAa(item.requi_lotes.caducidad)}" placeholder="FEB-27"></td>
    <td><input type="number" min="0" class="inp-editar-cantidad" value="${item.cantidad_surtida}"></td>
    <td class="solo-edicion celda-acciones">
      <button class="icon-btn-pure btn-guardar-edicion" title="Guardar"><span class="material-symbols-rounded" style="font-size:16px">check</span></button>
      <button class="icon-btn-pure btn-cancelar-edicion" title="Cancelar"><span class="material-symbols-rounded" style="font-size:16px">close</span></button>
    </td>
  `;
  tr.querySelector('.btn-guardar-edicion').addEventListener('click', () => guardarEdicionItem(itemId, bioId));
  tr.querySelector('.btn-cancelar-edicion').addEventListener('click', () => actualizarFilaBiologico(bioId, true));
  tr.querySelector('.inp-editar-cantidad').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') guardarEdicionItem(itemId, bioId); });
}

async function guardarEdicionItem(itemId, bioId) {
  const item = estado.items.find((i) => i.id === itemId);
  const tr = document.querySelector(`tr.fila-lote-capturado[data-item="${itemId}"]`);
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
  actualizarFilaBiologico(bioId, true);
  renderSelectLotesPaso2();
}

function renderDetalleBiologico(bio, items) {
  const filas = items.map((it) => `
    <tr class="fila-lote-capturado" data-item="${it.id}">
      <td>${it.requi_lotes.numero_lote}</td>
      <td>${formatMmmAa(it.requi_lotes.caducidad)}</td>
      <td>${it.cantidad_surtida}</td>
      <td class="solo-edicion celda-acciones">
        <button class="icon-btn-pure btn-editar-item" data-item="${it.id}" data-bio="${bio.id}" title="Editar"><span class="material-symbols-rounded" style="font-size:16px">edit</span></button>
        <button class="icon-btn-pure btn-quitar-item" data-item="${it.id}" data-bio="${bio.id}" title="Quitar"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="color:var(--muted)">Sin lotes capturados.</td></tr>';

  return `
    <table class="tbl" style="background:#fff; border-radius:12px;">
      <thead><tr><th>Lote</th><th>Caducidad</th><th>Cantidad surtida</th><th class="solo-edicion"></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="fila-add-lote solo-edicion">
      <div class="campo"><label>Número de lote</label><input type="text" class="inp-lote-nueva" placeholder="Ej. 0374MA109"></div>
      <div class="campo"><label>Caducidad</label><input type="text" class="inp-caducidad-nueva" placeholder="FEB-27"></div>
      <div class="campo"><label>Cantidad</label><input type="number" min="0" class="inp-cantidad-nueva" data-bio="${bio.id}" placeholder="Cant."></div>
      <button class="btn btn-primary btn-sm btn-agregar-lote" data-bio="${bio.id}"><span class="material-symbols-rounded" style="font-size:14px">add</span> Agregar</button>
      <span class="comparador-resultado" id="comparador-${bio.id}"></span>
    </div>
  `;
}

async function lotesExistentesDe(biologicoId) {
  if (estado.lotesPorBiologico[biologicoId]) return estado.lotesPorBiologico[biologicoId];
  const { data } = await estado.db.from('requi_lotes').select('id, numero_lote, caducidad').eq('requi_biologico_id', biologicoId);
  estado.lotesPorBiologico[biologicoId] = data || [];
  return estado.lotesPorBiologico[biologicoId];
}

function actualizarFilaBiologico(bioId, mantenerAbierto) {
  const bio = estado.catalogo.find((b) => b.id === bioId);
  const idx = estado.catalogo.indexOf(bio);
  const tmp = document.createElement('tbody');
  tmp.innerHTML = filasBiologicoHtml(bio, idx);
  const nuevaResumen = tmp.children[0];
  const nuevaDetalle = tmp.children[1];
  document.querySelector(`tr.fila-bio[data-bio="${bioId}"]`).replaceWith(nuevaResumen);
  $('detalle-' + bioId).replaceWith(nuevaDetalle);
  cablearResumen(nuevaResumen);
  cablearDetalle(nuevaDetalle);
  if (mantenerAbierto) { nuevaDetalle.style.display = 'table-row'; nuevaResumen.classList.add('activa'); }
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
    <input type="text" class="inp-editar-clave-articulo" value="${bio.clave_articulo || ''}" placeholder="Clave de artículo" title="Clave de artículo (columna A del Excel)">
    <input type="text" class="inp-editar-codigo-articulo" value="${bio.codigo_articulo || ''}" placeholder="Código" title="Código de artículo (columna B del Excel)">
    <button class="icon-btn-pure btn-guardar-clave" title="Guardar"><span class="material-symbols-rounded">check</span></button>
    <button class="icon-btn-pure btn-cancelar-clave" title="Cancelar"><span class="material-symbols-rounded">close</span></button>
  `;
  const detalleAbierto = document.getElementById('detalle-' + bioId)?.style.display !== 'none';
  cont.querySelector('.btn-guardar-clave').addEventListener('click', (ev) => { ev.stopPropagation(); guardarClaveArticulo(bioId, detalleAbierto); });
  cont.querySelector('.btn-cancelar-clave').addEventListener('click', (ev) => { ev.stopPropagation(); actualizarFilaBiologico(bioId, detalleAbierto); });
  cont.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('click', (ev) => ev.stopPropagation());
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') guardarClaveArticulo(bioId, detalleAbierto); });
  });
}

async function guardarClaveArticulo(bioId, detalleAbierto) {
  const bio = estado.catalogo.find((b) => b.id === bioId);
  const cont = document.getElementById('clave-' + bioId);
  if (!bio || !cont) return;
  const claveArticulo = cont.querySelector('.inp-editar-clave-articulo').value.trim();
  const codigoArticulo = cont.querySelector('.inp-editar-codigo-articulo').value.trim();
  if (!claveArticulo) { toast('La clave de artículo no puede quedar vacía.', true); return; }

  const cambios = {};
  if (claveArticulo !== bio.clave_articulo) cambios.clave_articulo = claveArticulo;
  if (codigoArticulo !== (bio.codigo_articulo || '')) cambios.codigo_articulo = codigoArticulo || null;
  if (Object.keys(cambios).length === 0) { actualizarFilaBiologico(bioId, detalleAbierto); return; }

  const { error } = await estado.db.from('requi_catalogo_biologicos').update(cambios).eq('id', bioId);
  // Ej. violación de la clave única si ya existe otro biológico con la
  // misma clave_articulo -- se muestra el mensaje real de Postgres.
  if (error) { toast('No se pudo guardar la clave: ' + error.message, true); return; }
  Object.assign(bio, cambios);
  toast('Clave actualizada.');
  actualizarFilaBiologico(bioId, detalleAbierto);
}

async function agregarLoteSurtido(biologicoId) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const detalle = $('detalle-' + biologicoId);
  const numeroLote = detalle.querySelector('.inp-lote-nueva').value.trim();
  const caducidadTexto = detalle.querySelector('.inp-caducidad-nueva').value.trim();
  const cantidad = Number(detalle.querySelector('.inp-cantidad-nueva').value);
  if (!numeroLote || !cantidad || cantidad <= 0) { toast('Captura número de lote y cantidad mayor a 0.', true); return; }

  let caducidad = null;
  if (caducidadTexto) {
    caducidad = parsearCaducidadInteligente(caducidadTexto);
    if (!caducidad) { toast('No entendí la caducidad. Usa por ejemplo FEB-27.', true); return; }
  }

  const existentes = await lotesExistentesDe(biologicoId);
  const resultado = RequiEngine.compararLote(numeroLote, existentes);
  const badgeComparador = $('comparador-' + biologicoId);
  if (badgeComparador) badgeComparador.innerHTML = pillComparador(resultado);
  if (resultado.estado === 'SIMILAR') {
    const continuar = confirm(`El lote "${numeroLote}" se parece a "${resultado.sugerencias[0].numero_lote}", ya registrado. ¿Seguro que es un lote NUEVO y distinto? Cancelar para corregir la captura.`);
    if (!continuar) return;
  }

  let loteId = resultado.estado === 'EXISTE' ? resultado.lote.id : null;
  if (!loteId) {
    const { data: nuevoLote, error: errLote } = await estado.db.from('requi_lotes')
      .insert({ requi_biologico_id: biologicoId, numero_lote: numeroLote, caducidad })
      .select().single();
    if (errLote) { toast('No se pudo registrar el lote: ' + errLote.message, true); return; }
    loteId = nuevoLote.id;
    estado.lotesPorBiologico[biologicoId].push(nuevoLote);
  }

  const { data: itemGuardado, error: errItem } = await estado.db.from('requi_items_jurisdiccion')
    .upsert({ requisicion_id: estado.requisicion.id, requi_biologico_id: biologicoId, lote_id: loteId, cantidad_surtida: cantidad },
      { onConflict: 'requisicion_id,requi_biologico_id,lote_id' })
    .select('*, requi_lotes(numero_lote, caducidad)').single();
  if (errItem) { toast('No se pudo guardar lo surtido: ' + errItem.message, true); return; }

  const idxExistente = estado.items.findIndex((i) => i.id === itemGuardado.id);
  if (idxExistente === -1) estado.items.push(itemGuardado); else estado.items[idxExistente] = itemGuardado;
  actualizarPildorasDock();

  toast('Lote registrado.');
  actualizarFilaBiologico(biologicoId, true);
  renderSelectLotesPaso2();
}

async function quitarItemSurtido(itemId, biologicoId) {
  if (!confirm('¿Quitar este lote de lo surtido? Esto falla si ya tiene reparto asignado.')) return;
  const { error } = await estado.db.from('requi_items_jurisdiccion').delete().eq('id', itemId);
  if (error) { toast('No se pudo quitar: ' + error.message, true); return; }
  estado.items = estado.items.filter((i) => i.id !== itemId);
  actualizarPildorasDock();
  toast('Lote quitado.');
  actualizarFilaBiologico(biologicoId, true);
  renderSelectLotesPaso2();
}

// ---------------------------------------------------------------------------
// Paso 2 — Reparto a Municipios y Hospitales (6 destinos hermanos)
// ---------------------------------------------------------------------------

function claseSaldo(saldo, disponible) {
  return saldo <= 0 ? 'agotado' : saldo < disponible * 0.2 ? 'bajo' : 'ok';
}

// 2 filtros en cascada (biológico -> lote), mismo motivo que en Paso 3: un
// solo combo mezclando ambos dificulta ver de un vistazo qué se está
// repartiendo cuando hay varios biológicos con lotes surtidos a la vez.
function renderSelectLotesPaso2() {
  const selBio = $('selBiologicoMunicipio');
  const valorPrevio = selBio.value;
  const idsConSurtido = new Set(estado.items.filter((i) => Number(i.cantidad_surtida) > 0).map((i) => i.requi_biologico_id));
  const biologicos = estado.catalogo.filter((bio) => idsConSurtido.has(bio.id));
  selBio.innerHTML = biologicos.length
    ? biologicos.map((bio) => `<option value="${bio.id}" style="color:${colorDeBio(bio)}">● ${bio.nombre}</option>`).join('')
    : '<option value="">Sin lotes surtidos capturados</option>';
  if (biologicos.some((b) => b.id === valorPrevio)) selBio.value = valorPrevio;
  selBio.onchange = renderSelectLotesPorBiologicoMunicipio;
  renderSelectLotesPorBiologicoMunicipio();
}

function renderSelectLotesPorBiologicoMunicipio() {
  const sel = $('selLoteParaMunicipio');
  const biologicoId = $('selBiologicoMunicipio').value;
  const opciones = estado.items.filter((i) => i.requi_biologico_id === biologicoId && Number(i.cantidad_surtida) > 0);
  sel.innerHTML = opciones.length
    ? opciones.map((i) => `<option value="${i.requi_biologico_id}::${i.lote_id}">Lote ${i.requi_lotes.numero_lote} · Cad. ${formatMmmAa(i.requi_lotes.caducidad)} · Surtido ${i.cantidad_surtida}</option>`).join('')
    : '<option value="">Elige un biológico</option>';
  sel.onchange = () => { renderCajaRepartoMunicipio(); actualizarPreviewPaso2(); };
  renderCajaRepartoMunicipio();
  actualizarPreviewPaso2();
}

// Los <select> nativos de Biológico/Lote no dejaban ver de un vistazo qué
// se estaba por repartir -- texto plano, sin color ni caducidad (reportado
// por el usuario: "no ayudan a identificar qué lote/vacuna"). El punto de
// color en cada <option> (soportado por Chrome/Edge, se degrada a texto
// plano en navegadores que lo ignoren) más esta tarjeta grande con el
// mismo color, nombre y caducidad ya resuelven la identificación aunque el
// desplegable en sí se quede nativo.
function actualizarPreviewPaso2() {
  const biologicoId = $('selBiologicoMunicipio').value;
  const [, loteId] = $('selLoteParaMunicipio').value.split('::');
  const bio = estado.catalogo.find((b) => b.id === biologicoId);
  const item = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  renderPreviewSeleccion('previewMunicipio', bio, item);
}

function renderPreviewSeleccion(contId, bio, item) {
  const el = $(contId);
  if (!el) return;
  if (!bio) { el.style.display = 'none'; return; }
  const color = colorDeBio(bio);
  el.style.display = 'flex';
  el.style.borderLeftColor = color;
  const detalle = item
    ? `<div class="preview-detalle">
        <span class="preview-chip"><span class="material-symbols-rounded">qr_code_2</span>Lote ${item.requi_lotes.numero_lote}</span>
        <span class="preview-chip"><span class="material-symbols-rounded">event</span>Caducidad ${formatMmmAa(item.requi_lotes.caducidad)}</span>
      </div>`
    : `<div class="preview-detalle"><span class="preview-chip">Elige un lote</span></div>`;
  el.innerHTML = `
    <div class="preview-icono" style="background: linear-gradient(135deg, ${color}1f, ${color}4d);">
      <span class="material-symbols-rounded" style="color:${color}">medication_liquid</span>
    </div>
    <div>
      <div class="preview-bio">${bio.nombre}</div>
      ${detalle}
    </div>
  `;
}

function renderCajaRepartoMunicipio() {
  const val = $('selLoteParaMunicipio').value;
  const caja = $('cajaRepartoMunicipio');
  if (!val) { caja.innerHTML = ''; return; }
  const [biologicoId, loteId] = val.split('::');
  const item = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  const disponible = Number(item.cantidad_surtida);
  const filas = estado.distMunicipio.filter((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId);

  const cards = DESTINOS.map((m) => {
    const fila = filas.find((f) => f.municipio === m.v);
    const cantidad = fila ? Number(fila.cantidad) : 0;
    return `
      <div class="destino-card">
        <div class="destino-card-cabecera"><label>${m.l}</label></div>
        <input type="number" min="0" class="solo-edicion" id="dm-${m.v}" value="${cantidad}" data-municipio="${m.v}">
        <span class="solo-lectura" style="display:none;">${cantidad}</span>
      </div>
    `;
  }).join('');

  caja.innerHTML = `
    <div style="margin-top:14px;">
      <div class="franja-estado" id="statsRepartoMunicipio"></div>
      <div class="grid-destinos">${cards}</div>
    </div>
  `;
  actualizarStatsRepartoMunicipio(biologicoId, loteId);

  caja.querySelectorAll('input[data-municipio]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoMunicipio(biologicoId, loteId, inp.dataset.municipio, inp));
  });
}

function actualizarStatsRepartoMunicipio(biologicoId, loteId) {
  const el = $('statsRepartoMunicipio');
  if (!el) return;
  const item = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  const disponible = item ? Number(item.cantidad_surtida) : 0;
  const filas = estado.distMunicipio.filter((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId);
  const yaRepartido = filas.reduce((acc, f) => acc + Number(f.cantidad || 0), 0);
  const saldo = disponible - yaRepartido;
  const conReparto = filas.filter((f) => Number(f.cantidad) > 0).length;
  el.innerHTML = `
    <div class="stat"><span>Disponible</span><b>${disponible}</b></div>
    <div class="stat"><span>Repartido</span><b>${yaRepartido}</b></div>
    <div class="stat saldo-${claseSaldo(saldo, disponible)}"><span>Saldo</span><b>${saldo}</b></div>
    <div class="stat"><span>Destinos con reparto</span><b>${conReparto} / ${DESTINOS.length}</b></div>
  `;
}

// Antes, al terminar CADA guardado se volvía a pedir toda la distribución y
// se reconstruía el HTML completo de la caja (todos los <input> de golpe).
// Si el usuario ya estaba tecleando el SIGUIENTE destino mientras ese
// guardado (asíncrono) seguía en vuelo, ese input a medio teclear se
// destruía y renacía con el valor viejo (el que ya estaba guardado en BD)
// justo cuando el guardado anterior resolvía -- perdía lo tecleado sin
// avisar. Ahora se actualiza `estado.distMunicipio` en memoria y solo se
// refresca esta tarjeta puntual + los totales, sin tocar los demás inputs.
async function guardarRepartoMunicipio(biologicoId, loteId, municipio, inputEl) {
  const cantidad = Number(inputEl.value) || 0;
  const { error } = await estado.db.from('requi_distribucion_municipio')
    .upsert({ requisicion_id: estado.requisicion.id, municipio, requi_biologico_id: biologicoId, lote_id: loteId, cantidad },
      { onConflict: 'requisicion_id,municipio,requi_biologico_id,lote_id' });
  if (error) {
    toast(error.message.replace(/^.*?ERROR:\s*/, ''), true);
    await cargarDatosRequisicion();
    return;
  }
  toast(`Guardado: ${municipio} = ${cantidad}`);
  let fila = estado.distMunicipio.find((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId && d.municipio === municipio);
  if (fila) fila.cantidad = cantidad;
  else estado.distMunicipio.push({ requisicion_id: estado.requisicion.id, municipio, requi_biologico_id: biologicoId, lote_id: loteId, cantidad });
  actualizarPildorasDock();
  flashGuardado(inputEl.closest('.destino-card'));
  actualizarStatsRepartoMunicipio(biologicoId, loteId);
  renderSelectMunicipioYLotesPaso3();
  renderDestinosMasivos();
  sincronizarLotePublico(municipio, biologicoId, loteId, cantidad); // en segundo plano, no bloquea el guardado
}

// Automático desde guardarRepartoMunicipio -- no es una acción que el
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
// Paso 3 — Reparto a Unidades (solo los 4 municipios reales; los hospitales
// no tienen unidades, ver Paso 2)
// ---------------------------------------------------------------------------

function renderSelectMunicipioYLotesPaso3() {
  const selMuni = $('selMunicipioUnidad');
  if (!selMuni.dataset.armado) {
    selMuni.innerHTML = MUNICIPIOS_REALES.map((m) => `<option value="${m.v}">${m.l}</option>`).join('');
    selMuni.dataset.armado = '1';
    selMuni.onchange = renderSelectBiologicosUnidad;
  }
  renderSelectBiologicosUnidad();
}

function asignadosMunicipioUnidad() {
  const municipio = $('selMunicipioUnidad').value;
  return estado.distMunicipio.filter((d) => d.municipio === municipio && Number(d.cantidad) > 0);
}

// 2 filtros en cascada (biológico -> lote) en vez de un solo combo con
// optgroups -- el nombre del biológico se perdía al cerrar el select
// (el navegador no muestra la etiqueta del optgroup, solo la opción),
// dejando ambigüedad sobre qué se está repartiendo.
function renderSelectBiologicosUnidad() {
  const selBio = $('selBiologicoUnidad');
  const valorPrevio = selBio.value;
  const idsAsignados = new Set(asignadosMunicipioUnidad().map((d) => d.requi_biologico_id));
  const biologicos = estado.catalogo.filter((bio) => idsAsignados.has(bio.id));
  selBio.innerHTML = biologicos.length
    ? biologicos.map((bio) => `<option value="${bio.id}" style="color:${colorDeBio(bio)}">● ${bio.nombre}</option>`).join('')
    : '<option value="">Este municipio no tiene lotes asignados todavía (ver paso 2)</option>';
  if (biologicos.some((b) => b.id === valorPrevio)) selBio.value = valorPrevio;
  selBio.onchange = renderSelectLotesPaso3;
  renderSelectLotesPaso3();
}

function renderSelectLotesPaso3() {
  const sel = $('selLoteParaUnidad');
  const biologicoId = $('selBiologicoUnidad').value;
  const asignados = asignadosMunicipioUnidad().filter((d) => d.requi_biologico_id === biologicoId);

  sel.innerHTML = asignados.length
    ? asignados.map((d) => {
        const item = estado.items.find((i) => i.requi_biologico_id === d.requi_biologico_id && i.lote_id === d.lote_id);
        const yaRepartidoAqui = estado.distUnidad
          .filter((u) => u.requi_biologico_id === d.requi_biologico_id && u.lote_id === d.lote_id)
          .reduce((acc, u) => acc + Number(u.cantidad || 0), 0);
        const saldo = Number(d.cantidad) - yaRepartidoAqui;
        const caducidad = item ? formatMmmAa(item.requi_lotes.caducidad) : '—';
        return `<option value="${d.requi_biologico_id}::${d.lote_id}">Lote ${item ? item.requi_lotes.numero_lote : '?'} · Cad. ${caducidad} · Saldo ${saldo}</option>`;
      }).join('')
    : '<option value="">Elige un biológico</option>';
  sel.onchange = () => { renderCajaRepartoUnidad(); actualizarPreviewPaso3(); };
  renderCajaRepartoUnidad();
  actualizarPreviewPaso3();
}

function actualizarPreviewPaso3() {
  const biologicoId = $('selBiologicoUnidad').value;
  const [, loteId] = $('selLoteParaUnidad').value.split('::');
  const bio = estado.catalogo.find((b) => b.id === biologicoId);
  const item = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  renderPreviewSeleccion('previewUnidad', bio, item);
}

function renderCajaRepartoUnidad() {
  const municipio = $('selMunicipioUnidad').value;
  const val = $('selLoteParaUnidad').value;
  const caja = $('cajaRepartoUnidad');
  if (!val) { caja.innerHTML = ''; return; }
  const [biologicoId, loteId] = val.split('::');
  const unidadesMunicipio = estado.unidades.filter((u) => u.municipio === municipio);
  const filas = estado.distUnidad.filter((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId);

  // Orden alfabético fijo (no se reordena por asignación) -- reordenar en
  // cada guardado saltaría filas de lugar mientras se teclea varias unidades
  // seguidas. El resaltado en verde ya resuelve "ubicarlas rápido".
  const filasHtml = unidadesMunicipio.map((u) => {
    const fila = filas.find((f) => f.unidad_id === u.id);
    const cantidad = fila ? Number(fila.cantidad) : 0;
    return `
      <tr class="${cantidad > 0 ? 'con-asignacion' : ''}" data-unidad-fila="${u.id}">
        <td>${u.nombre}</td>
        <td class="solo-edicion"><input type="number" min="0" value="${cantidad}" data-unidad="${u.id}"></td>
        <td class="solo-lectura" style="display:none;">${cantidad}</td>
        <td style="text-align:center;"><button class="icon-btn-pure" data-export-unidad="${u.id}" title="Exportar Excel de esta unidad"><span class="material-symbols-rounded">download</span></button></td>
      </tr>
    `;
  }).join('');

  caja.innerHTML = `
    <div class="franja-estado" id="statsRepartoUnidad"></div>
    <div class="tbl-scroll" style="margin-top:10px;">
      <table class="tbl-unidades">
        <thead><tr><th>Unidad</th><th>Cantidad</th><th style="text-align:center;">Exportar</th></tr></thead>
        <tbody>${filasHtml || '<tr><td colspan="3" style="color:var(--muted)">Sin unidades registradas para este municipio.</td></tr>'}</tbody>
      </table>
    </div>
  `;
  actualizarStatsRepartoUnidad(biologicoId, loteId);

  caja.querySelectorAll('input[data-unidad]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoUnidad(biologicoId, loteId, inp.dataset.unidad, inp));
  });
  caja.querySelectorAll('[data-export-unidad]').forEach((btn) => {
    btn.addEventListener('click', () => exportarUno('UNIDAD', btn.dataset.exportUnidad));
  });
}

function actualizarStatsRepartoUnidad(biologicoId, loteId) {
  const el = $('statsRepartoUnidad');
  if (!el) return;
  const municipio = $('selMunicipioUnidad').value;
  const asignacion = estado.distMunicipio.find((d) => d.municipio === municipio && d.requi_biologico_id === biologicoId && d.lote_id === loteId);
  const disponible = asignacion ? Number(asignacion.cantidad) : 0;
  const unidadesMunicipio = estado.unidades.filter((u) => u.municipio === municipio);
  const filas = estado.distUnidad.filter((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId);
  const yaRepartido = filas.reduce((acc, f) => acc + Number(f.cantidad || 0), 0);
  const saldo = disponible - yaRepartido;
  const conReparto = filas.filter((f) => Number(f.cantidad) > 0).length;
  el.innerHTML = `
    <div class="stat"><span>Disponible en ${municipio}</span><b>${disponible}</b></div>
    <div class="stat"><span>Repartido</span><b>${yaRepartido}</b></div>
    <div class="stat saldo-${claseSaldo(saldo, disponible)}"><span>Saldo</span><b>${saldo}</b></div>
    <div class="stat"><span>Unidades con reparto</span><b>${conReparto} / ${unidadesMunicipio.length}</b></div>
  `;
}

// Mismo motivo que guardarRepartoMunicipio: ya no se vuelve a pedir toda la
// distribución ni se reconstruye la tabla completa al terminar cada
// guardado (eso destruía el <input> de la unidad que el usuario ya
// estuviera tecleando a continuación, perdiendo lo escrito). Se actualiza
// `estado.distUnidad` en memoria y solo se refresca esa fila + los totales.
async function guardarRepartoUnidad(biologicoId, loteId, unidadId, inputEl) {
  const cantidad = Number(inputEl.value) || 0;
  const { error } = await estado.db.from('requi_distribucion_unidad')
    .upsert({ requisicion_id: estado.requisicion.id, unidad_id: unidadId, requi_biologico_id: biologicoId, lote_id: loteId, cantidad },
      { onConflict: 'requisicion_id,unidad_id,requi_biologico_id,lote_id' });
  if (error) {
    toast(error.message.replace(/^.*?ERROR:\s*/, ''), true);
    await cargarDatosRequisicion();
    return;
  }
  toast('Guardado.');
  let fila = estado.distUnidad.find((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId && d.unidad_id === unidadId);
  if (fila) fila.cantidad = cantidad;
  else estado.distUnidad.push({ requisicion_id: estado.requisicion.id, unidad_id: unidadId, requi_biologico_id: biologicoId, lote_id: loteId, cantidad });
  actualizarPildorasDock();
  const filaTr = document.querySelector(`tr[data-unidad-fila="${unidadId}"]`);
  if (filaTr) { flashGuardado(filaTr); filaTr.classList.toggle('con-asignacion', cantidad > 0); }
  actualizarStatsRepartoUnidad(biologicoId, loteId);
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

// Píldoras vivas de la barra de pasos: cuántos biológicos ya tienen lotes
// surtidos (1), a cuántos destinos ya se les repartió (2) y a cuántas
// unidades (3). Se recalcula tras cada guardado.
function actualizarPildorasDock() {
  const poner = (id, n, titulo) => {
    const el = $(id);
    if (!el) return;
    el.textContent = n > 0 ? String(n) : '';
    el.title = n > 0 ? titulo : '';
  };
  poner('pildoraPaso1', new Set((estado.items || []).map((i) => i.requi_biologico_id)).size, 'biológicos con lotes surtidos');
  poner('pildoraPaso2', new Set((estado.distMunicipio || []).filter((d) => Number(d.cantidad) > 0).map((d) => d.municipio)).size, 'destinos con reparto');
  poner('pildoraPaso3', new Set((estado.distUnidad || []).filter((d) => Number(d.cantidad) > 0).map((d) => d.unidad_id)).size, 'unidades con reparto');
}

function activarPaso(n) {
  document.querySelectorAll('.paso-tab').forEach((t) => t.classList.toggle('activo', t.dataset.paso === String(n)));
  document.querySelectorAll('.paso-panel').forEach((p) => p.classList.remove('activo'));
  $('panelPaso' + n).classList.add('activo');
}

document.addEventListener('DOMContentLoaded', async () => {
  initDb();
  poblarSelectoresCabecera();
  await cargarSesionReal();
  await cargarCatalogoYUnidades();
  await cargarFirmasJurisdiccionales();
  await renderFirmasMunicipio();
  await cargarRequisicion();

  document.querySelectorAll('.paso-tab').forEach((tab) => tab.addEventListener('click', () => activarPaso(tab.dataset.paso)));
  if (window.DockGlass) window.DockGlass.instalar($('dockPasosTabs'));
  $('btnCargar').addEventListener('click', cargarRequisicion);
  $('btnGuardarCabecera').addEventListener('click', guardarCabecera);
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
});
