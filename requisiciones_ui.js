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
  await cargarDatosRequisicion();
}

async function cargarRequisicion() {
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  const { data, error } = await estado.db.from('requi_requisiciones')
    .select('*').eq('anio', anio).eq('mes', mes).maybeSingle();
  if (error) { toast('Error al cargar: ' + error.message, true); return; }
  estado.requisicion = data;
  if (!data) {
    $('contenidoRequisicion').style.display = 'none';
    $('hintCabecera').style.display = 'block';
    $('hintCabecera').innerHTML = estado.puedeEditar
      ? 'No existe requisición para este mes todavía. Presiona "Guardar / Abrir requisición" para crearla.'
      : 'No existe requisición capturada para este mes.';
    return;
  }
  $('hintCabecera').style.display = 'none';
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

function filasBiologicoHtml(bio, idx) {
  const items = itemsDe(bio.id);
  const total = items.reduce((acc, i) => acc + Number(i.cantidad_surtida || 0), 0);
  const esMultidosis = bio.presentacion === 'MULTIDOSIS';
  return `
    <tr class="fila-bio" data-bio="${bio.id}">
      <td>${idx + 1}</td>
      <td><strong>${bio.nombre}</strong><br><span style="color:var(--muted); font-size:11px;">${bio.clave_articulo}</span></td>
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
  tbody.querySelectorAll('tr.fila-bio').forEach((tr) => tr.addEventListener('click', () => toggleDetalle(tr.dataset.bio)));
  tbody.querySelectorAll('tr.fila-detalle').forEach((tr) => cablearDetalle(tr));
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
  nuevaResumen.addEventListener('click', () => toggleDetalle(bioId));
  cablearDetalle(nuevaDetalle);
  if (mantenerAbierto) { nuevaDetalle.style.display = 'table-row'; nuevaResumen.classList.add('activa'); }
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

  toast('Lote registrado.');
  actualizarFilaBiologico(biologicoId, true);
  renderSelectLotesPaso2();
}

async function quitarItemSurtido(itemId, biologicoId) {
  if (!confirm('¿Quitar este lote de lo surtido? Esto falla si ya tiene reparto asignado.')) return;
  const { error } = await estado.db.from('requi_items_jurisdiccion').delete().eq('id', itemId);
  if (error) { toast('No se pudo quitar: ' + error.message, true); return; }
  estado.items = estado.items.filter((i) => i.id !== itemId);
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
    ? biologicos.map((bio) => `<option value="${bio.id}">${bio.nombre}</option>`).join('')
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
    ? opciones.map((i) => `<option value="${i.requi_biologico_id}::${i.lote_id}">Lote ${i.requi_lotes.numero_lote} (surtido: ${i.cantidad_surtida})</option>`).join('')
    : '<option value="">Elige un biológico</option>';
  sel.onchange = renderCajaRepartoMunicipio;
  renderCajaRepartoMunicipio();
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
    const puedeSincronizar = estado.puedeEditar && fila && cantidad > 0 && MUNICIPIO_A_LOTES[m.v];
    return `
      <div class="destino-card">
        <div class="destino-card-cabecera">
          <label>${m.l}</label>
          ${puedeSincronizar ? `<button class="icon-btn-pure solo-edicion" data-sync-muni="${m.v}" title="Sincronizar a Lotes"><span class="material-symbols-rounded">sync</span></button>` : ''}
        </div>
        <input type="number" min="0" class="solo-edicion" id="dm-${m.v}" value="${cantidad}" data-municipio="${m.v}">
        <span class="solo-lectura" style="display:none;">${cantidad}</span>
      </div>
    `;
  }).join('');

  const yaRepartido = filas.reduce((acc, f) => acc + Number(f.cantidad || 0), 0);
  const saldo = disponible - yaRepartido;
  const conReparto = filas.filter((f) => Number(f.cantidad) > 0).length;
  caja.innerHTML = `
    <div style="margin-top:14px;">
      <div class="franja-estado">
        <div class="stat"><span>Disponible</span><b>${disponible}</b></div>
        <div class="stat"><span>Repartido</span><b>${yaRepartido}</b></div>
        <div class="stat saldo-${claseSaldo(saldo, disponible)}"><span>Saldo</span><b>${saldo}</b></div>
        <div class="stat"><span>Destinos con reparto</span><b>${conReparto} / ${DESTINOS.length}</b></div>
      </div>
      <div class="grid-destinos">${cards}</div>
    </div>
  `;

  caja.querySelectorAll('input[data-municipio]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoMunicipio(biologicoId, loteId, inp.dataset.municipio, inp));
  });
  caja.querySelectorAll('[data-sync-muni]').forEach((btn) => {
    btn.addEventListener('click', () => sincronizarLotePublico(btn.dataset.syncMuni, biologicoId, loteId));
  });
}

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
  const { data: dm } = await estado.db.from('requi_distribucion_municipio').select('*').eq('requisicion_id', estado.requisicion.id);
  estado.distMunicipio = dm || [];
  renderCajaRepartoMunicipio();
  renderSelectMunicipioYLotesPaso3();
  renderDestinosMasivos();
}

async function sincronizarLotePublico(municipio, biologicoId, loteId) {
  const bio = estado.catalogo.find((b) => b.id === biologicoId);
  const lote = estado.items.find((i) => i.requi_biologico_id === biologicoId && i.lote_id === loteId);
  const nombreLotesTabla = bio ? CODIGO_A_LOTES_BIOLOGICO[bio.codigo_articulo] : null;
  const municipioLotesTabla = MUNICIPIO_A_LOTES[municipio];
  if (!nombreLotesTabla || !municipioLotesTabla || !lote) {
    toast('Este biológico no tiene equivalente en "Carga de lotes por municipio"; sincroniza ahí manualmente.', true);
    return;
  }
  const numeroLote = lote.requi_lotes.numero_lote;
  const caducidad = lote.requi_lotes.caducidad;
  const { error: errDel } = await estado.db.from('lotes').delete()
    .eq('biologico', nombreLotesTabla).eq('lote', numeroLote).eq('municipio', municipioLotesTabla);
  if (errDel) { toast('No se pudo sincronizar: ' + errDel.message, true); return; }
  const { error: errIns } = await estado.db.from('lotes')
    .insert({ biologico: nombreLotesTabla, lote: numeroLote, caducidad, municipio: municipioLotesTabla, tipo: 'NORMAL' });
  if (errIns) { toast('No se pudo sincronizar: ' + errIns.message, true); return; }
  toast(`Sincronizado con "Carga de lotes por municipio" (${municipioLotesTabla}).`);
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
    ? biologicos.map((bio) => `<option value="${bio.id}">${bio.nombre}</option>`).join('')
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
        return `<option value="${d.requi_biologico_id}::${d.lote_id}">Lote ${item ? item.requi_lotes.numero_lote : '?'} — asignado ${d.cantidad}, saldo ${saldo}</option>`;
      }).join('')
    : '<option value="">Elige un biológico</option>';
  sel.onchange = renderCajaRepartoUnidad;
  renderCajaRepartoUnidad();
}

function renderCajaRepartoUnidad() {
  const municipio = $('selMunicipioUnidad').value;
  const val = $('selLoteParaUnidad').value;
  const caja = $('cajaRepartoUnidad');
  if (!val) { caja.innerHTML = ''; return; }
  const [biologicoId, loteId] = val.split('::');
  const asignacion = estado.distMunicipio.find((d) => d.municipio === municipio && d.requi_biologico_id === biologicoId && d.lote_id === loteId);
  const disponible = asignacion ? Number(asignacion.cantidad) : 0;
  const unidadesMunicipio = estado.unidades.filter((u) => u.municipio === municipio);
  const filas = estado.distUnidad.filter((d) => d.requi_biologico_id === biologicoId && d.lote_id === loteId);
  const yaRepartido = filas.reduce((acc, f) => acc + Number(f.cantidad || 0), 0);
  const saldo = disponible - yaRepartido;

  // Orden alfabético fijo (no se reordena por asignación) -- reordenar en
  // cada guardado saltaría filas de lugar mientras se teclea varias unidades
  // seguidas. El resaltado en verde ya resuelve "ubicarlas rápido".
  const filasHtml = unidadesMunicipio.map((u) => {
    const fila = filas.find((f) => f.unidad_id === u.id);
    const cantidad = fila ? Number(fila.cantidad) : 0;
    return `
      <tr class="${cantidad > 0 ? 'con-asignacion' : ''}">
        <td>${u.nombre}</td>
        <td class="solo-edicion"><input type="number" min="0" value="${cantidad}" data-unidad="${u.id}"></td>
        <td class="solo-lectura" style="display:none;">${cantidad}</td>
        <td style="text-align:center;"><button class="icon-btn-pure" data-export-unidad="${u.id}" title="Exportar Excel de esta unidad"><span class="material-symbols-rounded">download</span></button></td>
      </tr>
    `;
  }).join('');

  const conReparto = filas.filter((f) => Number(f.cantidad) > 0).length;
  caja.innerHTML = `
    <div class="franja-estado">
      <div class="stat"><span>Disponible en ${municipio}</span><b>${disponible}</b></div>
      <div class="stat"><span>Repartido</span><b>${yaRepartido}</b></div>
      <div class="stat saldo-${claseSaldo(saldo, disponible)}"><span>Saldo</span><b>${saldo}</b></div>
      <div class="stat"><span>Unidades con reparto</span><b>${conReparto} / ${unidadesMunicipio.length}</b></div>
    </div>
    <div class="tbl-scroll" style="margin-top:10px;">
      <table class="tbl-unidades">
        <thead><tr><th>Unidad</th><th>Cantidad</th><th style="text-align:center;">Exportar</th></tr></thead>
        <tbody>${filasHtml || '<tr><td colspan="3" style="color:var(--muted)">Sin unidades registradas para este municipio.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  caja.querySelectorAll('input[data-unidad]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoUnidad(biologicoId, loteId, inp.dataset.unidad, inp));
  });
  caja.querySelectorAll('[data-export-unidad]').forEach((btn) => {
    btn.addEventListener('click', () => exportarUno('UNIDAD', btn.dataset.exportUnidad));
  });
}

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
  const { data: du } = await estado.db.from('requi_distribucion_unidad').select('*').eq('requisicion_id', estado.requisicion.id);
  estado.distUnidad = du || [];
  renderCajaRepartoUnidad();
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
    const unidad = estado.unidades.find((u) => u.id === destino);
    const muniLabel = unidad ? MUNICIPIOS_REALES.find((m) => m.v === unidad.municipio) : null;
    destinoNombre = unidad ? `C.S. ${unidad.nombre}` : '';
    destinoDireccion = muniLabel ? muniLabel.l : '';
    const { data } = await estado.db.from('requi_distribucion_unidad')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', estado.requisicion.id).eq('unidad_id', destino).gt('cantidad', 0);
    (data || []).forEach((it) => (filasPorBiologico[it.requi_biologico_id] ||= []).push({
      cantidad: it.cantidad, numeroLote: it.requi_lotes.numero_lote, caducidad: it.requi_lotes.caducidad
    }));
  }

  const { data: firmasJuris } = await estado.db.from('requi_firmas').select('*')
    .eq('nivel', 'JURISDICCIONAL').eq('destino', 'JURISDICCION').maybeSingle();

  // Entrega/Recibe: solo existe para JURISDICCIONAL y para un municipio
  // real. Las unidades y los hospitales (que se tratan como unidad) SIEMPRE
  // van en blanco -- firman a mano y anotan su propio nombre en el papel.
  let entregaRecibe = {};
  if (nivel === 'JURISDICCIONAL') entregaRecibe = firmasJuris || {};
  else if (nivel === 'MUNICIPAL' && !esHospital(destino)) {
    const { data } = await estado.db.from('requi_firmas').select('*').eq('nivel', 'MUNICIPAL').eq('destino', destino).maybeSingle();
    entregaRecibe = data || {};
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
    fechaEnvio: estado.requisicion.fecha_envio ? new Date(estado.requisicion.fecha_envio + 'T00:00:00') : new Date(),
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
      <label class="destino-masivo-chk">
        <input type="checkbox" class="chk-destino-masivo" value="${m.v}" ${tieneDatos ? 'checked' : ''}>
        ${m.l} <span class="cuenta">${tieneDatos ? '' : '(sin repartir)'}</span>
      </label>
    `;
  }).join('');
}

async function exportarMasivo() {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const seleccionados = [...document.querySelectorAll('.chk-destino-masivo:checked')].map((c) => c.value);
  if (!seleccionados.length) { toast('Selecciona al menos un destino.', true); return; }
  const incluirUnidades = $('chkIncluirUnidades').checked;

  toast('Generando paquete…');
  try {
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
  $('btnCargar').addEventListener('click', cargarRequisicion);
  $('btnGuardarCabecera').addEventListener('click', guardarCabecera);
  $('btnPdfJurisdiccional').addEventListener('click', () => exportarUno('JURISDICCIONAL', ''));
  $('btnGuardarFirmasJuris').addEventListener('click', guardarFirmasJurisdiccionales);
  $('btnExportarMasivo').addEventListener('click', exportarMasivo);
  $('btnToggleResponsables').addEventListener('click', toggleResponsables);
  $('btnAbrirExportar').addEventListener('click', (ev) => { ev.stopPropagation(); togglePanelExportar(); });
  $('panelExportar').addEventListener('click', (ev) => ev.stopPropagation());
  document.addEventListener('click', () => togglePanelExportar(true));
});
