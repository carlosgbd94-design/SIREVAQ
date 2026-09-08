// ============================================================================
// Requisiciones — UI de captura (Jurisdicción -> Municipio/Hospitales -> Unidad)
//
// Mismo patrón que Biovac (biovac_ui.js): cliente Supabase propio que hereda
// la sesión ya iniciada en index.html (misma URL/anon key, mismo origen).
// Postgres (supabase/requi_engine.sql) es la autoridad de validación; este
// archivo solo espeja esa lógica (requi_engine.js) para dar feedback
// instantáneo y atrapar el error del trigger si aun así se excede.
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' }, { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' }, { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' }, { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' }
];

const MUNICIPIOS = [
  { v: 'CORREGIDORA', l: 'Corregidora' },
  { v: 'HUIMILPAN', l: 'Huimilpan' },
  { v: 'MARQUES', l: 'El Marqués' },
  { v: 'QUERETARO', l: 'Querétaro' },
  { v: 'HOSPITALES', l: 'Hospitales' }
];

// Puente opcional hacia la tabla "lotes" (panel "Carga de lotes por
// municipio", ya usado por Biovac) -- mismo criterio de mapeo explícito que
// MUNICIPIO_BIOVAC_A_LOTES en biovac_ui.js: si un código de artículo no
// tiene equivalente exacto en ese catálogo (BIOS_LIST), la sincronización
// simplemente no se ofrece para ese biológico.
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
  unidades: [],        // requi_unidades
  requisicion: null,   // requi_requisiciones actual
  items: [],           // requi_items_jurisdiccion
  distMunicipio: [],   // requi_distribucion_municipio
  distUnidad: [],      // requi_distribucion_unidad
  lotesPorBiologico: {},
  puedeEditar: false
};

function $(id) { return document.getElementById(id); }

function abrirPdf(nivel, destino, copias) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const params = new URLSearchParams({ id: estado.requisicion.id, nivel, copias: String(copias) });
  if (destino) params.set('destino', destino);
  window.open('requisiciones_print.html?' + params.toString(), '_blank');
}

// ---------------------------------------------------------------------------
// Firmas por nivel/destino — Elaboró/Autorizó/Entrega/Recibe cambian en
// cada rango (jurisdicción, cada municipio/Hospitales, cada unidad), así
// que se editan justo antes de imprimir ese destino en concreto, no una
// sola vez para todo el mes.
// ---------------------------------------------------------------------------

const CAMPOS_FIRMA = [
  ['elaboro_nombre', 'elaboroN', 'Elaboró — Nombre'], ['elaboro_cargo', 'elaboroC', 'Elaboró — Cargo'],
  ['autorizo_nombre', 'autorizoN', 'Autorizó — Nombre'], ['autorizo_cargo', 'autorizoC', 'Autorizó — Cargo'],
  ['entrega_nombre', 'entregaN', 'Entrega — Nombre'], ['entrega_cargo', 'entregaC', 'Entrega — Cargo'],
  ['recibe_nombre', 'recibeN', 'Recibe — Nombre'], ['recibe_cargo', 'recibeC', 'Recibe — Cargo']
];

function htmlFirmasForm(idPrefix, datos) {
  datos = datos || {};
  const campos = CAMPOS_FIRMA.map(([col, sufijo, etiqueta]) => `
    <div class="campo"><label>${etiqueta}</label><input type="text" id="${idPrefix}-${sufijo}" value="${(datos[col] || '').replace(/"/g, '&quot;')}"></div>
  `).join('');
  return `
    <div class="barra">${campos}</div>
    <button class="btn btn-primary btn-sm" style="margin-top:8px;" data-guardar-firmas="${idPrefix}">
      <span class="material-symbols-rounded" style="font-size:14px">print</span> Guardar firmas e imprimir
    </button>
  `;
}

async function toggleCajaFirmas(contId, nivel, destino, copias) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const cont = $(contId);
  const abierto = cont.style.display === 'block';
  if (abierto) { cont.style.display = 'none'; return; }

  const { data } = await estado.db.from('requi_firmas').select('*')
    .eq('requisicion_id', estado.requisicion.id).eq('nivel', nivel).eq('destino', destino).maybeSingle();
  cont.innerHTML = htmlFirmasForm(contId, data);
  cont.style.display = 'block';
  const btn = cont.querySelector('[data-guardar-firmas]');
  btn.addEventListener('click', () => guardarFirmasEImprimir(contId, nivel, destino, copias));
}

async function guardarFirmasEImprimir(idPrefix, nivel, destino, copias) {
  const payload = { requisicion_id: estado.requisicion.id, nivel, destino };
  CAMPOS_FIRMA.forEach(([col, sufijo]) => { payload[col] = valorOnull(`${idPrefix}-${sufijo}`); });
  const { error } = await estado.db.from('requi_firmas').upsert(payload, { onConflict: 'requisicion_id,nivel,destino' });
  if (error) { toast('No se pudieron guardar las firmas: ' + error.message, true); return; }
  toast('Firmas guardadas.');
  abrirPdf(nivel, destino, copias);
}

function toast(msg, esError) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!esError);
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), esError ? 5000 : 2600);
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
  if (resultado.estado === 'EXISTE') return `<span class="pill pill-ok"><span class="material-symbols-rounded" style="font-size:13px">check_circle</span> Ya existe (cad. ${resultado.lote.caducidad || 's/f'})</span>`;
  if (resultado.estado === 'SIMILAR') return `<span class="pill pill-warn"><span class="material-symbols-rounded" style="font-size:13px">warning</span> ¿Quisiste decir ${resultado.sugerencias[0].numero_lote}?</span>`;
  if (resultado.estado === 'NUEVO') return `<span class="pill pill-new"><span class="material-symbols-rounded" style="font-size:13px">fiber_new</span> Nuevo ingreso</span>`;
  return '';
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

function valorOnull(id) { return $(id).value.trim() || null; }

async function guardarCabecera() {
  if (!estado.puedeEditar) return;
  const anio = Number($('selAnio').value);
  const mes = Number($('selMes').value);
  const folio = $('inpFolio').value.trim() || null;
  const { data, error } = await estado.db.from('requi_requisiciones')
    .upsert({ anio, mes, folio_oracle: folio, creado_por: estado.perfil.usuario }, { onConflict: 'anio,mes' })
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
      ? 'No existe requisición para este mes todavía. Escribe el folio (opcional) y presiona "Guardar / Abrir requisición" para crearla.'
      : 'No existe requisición capturada para este mes.';
    return;
  }
  $('inpFolio').value = data.folio_oracle || '';
  $('hintCabecera').style.display = 'none';
  await cargarDatosRequisicion();
}

async function cargarDatosRequisicion() {
  if (!estado.requisicion) return;
  const reqId = estado.requisicion.id;
  const [{ data: items }, { data: dm }, { data: du }] = await Promise.all([
    estado.db.from('requi_items_jurisdiccion').select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', reqId),
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
}

// ---------------------------------------------------------------------------
// Paso 1 — Lo surtido
// ---------------------------------------------------------------------------

function itemsDe(biologicoId) {
  return estado.items.filter((i) => i.requi_biologico_id === biologicoId);
}

function renderPaso1() {
  const tbody = $('tbodyBiologicos');
  tbody.innerHTML = estado.catalogo.map((bio, idx) => {
    const items = itemsDe(bio.id);
    const total = items.reduce((acc, i) => acc + Number(i.cantidad_surtida || 0), 0);
    return `
      <tr class="fila-bio" data-bio="${bio.id}">
        <td>${idx + 1}</td>
        <td><strong>${bio.nombre}</strong><br><span style="color:var(--muted); font-size:11px;">${bio.clave_articulo}</span></td>
        <td>${bio.presentacion}</td>
        <td>${items.length} lote(s)</td>
        <td><strong>${total}</strong></td>
      </tr>
      <tr id="detalle-${bio.id}" style="display:none;"><td colspan="5" style="background:var(--surface-container);">${renderDetalleBiologico(bio, items)}</td></tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr.fila-bio').forEach((tr) => {
    tr.addEventListener('click', () => {
      const detalle = $('detalle-' + tr.dataset.bio);
      const abierto = detalle.style.display !== 'none';
      tbody.querySelectorAll('tr[id^="detalle-"]').forEach((d) => (d.style.display = 'none'));
      detalle.style.display = abierto ? 'none' : 'table-row';
    });
  });

  tbody.querySelectorAll('.btn-agregar-lote').forEach((btn) => {
    btn.addEventListener('click', () => agregarLoteSurtido(btn.dataset.bio));
  });
  tbody.querySelectorAll('.btn-quitar-item').forEach((btn) => {
    btn.addEventListener('click', () => quitarItemSurtido(btn.dataset.item));
  });
}

function renderDetalleBiologico(bio, items) {
  const filas = items.map((it) => `
    <tr>
      <td>${it.requi_lotes.numero_lote}</td>
      <td>${it.requi_lotes.caducidad || '—'}</td>
      <td>${it.cantidad_surtida}</td>
      <td class="solo-edicion"><button class="btn btn-outline btn-sm btn-quitar-item" data-item="${it.id}"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button></td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="color:var(--muted)">Sin lotes capturados.</td></tr>';

  return `
    <table class="tbl" style="background:#fff; border-radius:12px;">
      <thead><tr><th>Lote</th><th>Caducidad</th><th>Cantidad surtida</th><th class="solo-edicion"></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="barra solo-edicion" style="margin-top:12px;">
      <div class="campo"><label>Número de lote</label><input type="text" id="loteTxt-${bio.id}" placeholder="Ej. 0374MA109"></div>
      <div class="campo"><label>Caducidad</label><input type="date" id="loteCad-${bio.id}"></div>
      <div class="campo"><label>Cantidad</label><input type="number" id="loteCant-${bio.id}" min="0"></div>
      <button class="btn btn-primary btn-sm btn-agregar-lote" data-bio="${bio.id}"><span class="material-symbols-rounded" style="font-size:14px">add</span> Agregar</button>
    </div>
    <div id="comparador-${bio.id}" style="margin-top:8px;"></div>
  `;
}

async function lotesExistentesDe(biologicoId) {
  if (estado.lotesPorBiologico[biologicoId]) return estado.lotesPorBiologico[biologicoId];
  const { data } = await estado.db.from('requi_lotes').select('id, numero_lote, caducidad').eq('requi_biologico_id', biologicoId);
  estado.lotesPorBiologico[biologicoId] = data || [];
  return estado.lotesPorBiologico[biologicoId];
}

async function agregarLoteSurtido(biologicoId) {
  if (!estado.requisicion) { toast('Guarda primero la cabecera de la requisición.', true); return; }
  const numeroLote = $('loteTxt-' + biologicoId).value.trim();
  const caducidad = $('loteCad-' + biologicoId).value || null;
  const cantidad = Number($('loteCant-' + biologicoId).value);
  if (!numeroLote || !cantidad || cantidad <= 0) { toast('Captura número de lote y cantidad mayor a 0.', true); return; }

  const existentes = await lotesExistentesDe(biologicoId);
  const resultado = RequiEngine.compararLote(numeroLote, existentes);
  const cajaComparador = $('comparador-' + biologicoId);
  cajaComparador.innerHTML = pillComparador(resultado);

  if (resultado.estado === 'SIMILAR') {
    const continuar = confirm(
      `El lote "${numeroLote}" se parece a "${resultado.sugerencias[0].numero_lote}", ya registrado. `
      + `¿Seguro que es un lote NUEVO y distinto? Cancelar para corregir la captura.`
    );
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

  const { error: errItem } = await estado.db.from('requi_items_jurisdiccion')
    .upsert({ requisicion_id: estado.requisicion.id, requi_biologico_id: biologicoId, lote_id: loteId, cantidad_surtida: cantidad },
      { onConflict: 'requisicion_id,requi_biologico_id,lote_id' });
  if (errItem) { toast('No se pudo guardar lo surtido: ' + errItem.message, true); return; }

  toast('Lote registrado.');
  await cargarDatosRequisicion();
}

async function quitarItemSurtido(itemId) {
  if (!confirm('¿Quitar este lote de lo surtido? Esto falla si ya tiene reparto asignado.')) return;
  const { error } = await estado.db.from('requi_items_jurisdiccion').delete().eq('id', itemId);
  if (error) { toast('No se pudo quitar: ' + error.message, true); return; }
  toast('Lote quitado.');
  await cargarDatosRequisicion();
}

// ---------------------------------------------------------------------------
// Paso 2 — Reparto a Municipios/Hospitales
// ---------------------------------------------------------------------------

function renderSelectLotesPaso2() {
  const sel = $('selLoteParaMunicipio');
  const opciones = estado.items.filter((i) => Number(i.cantidad_surtida) > 0);
  sel.innerHTML = opciones.map((i) => {
    const bio = estado.catalogo.find((b) => b.id === i.requi_biologico_id);
    return `<option value="${i.requi_biologico_id}::${i.lote_id}">${bio ? bio.nombre : '?'} — Lote ${i.requi_lotes.numero_lote} (surtido: ${i.cantidad_surtida})</option>`;
  }).join('') || '<option value="">Sin lotes surtidos capturados</option>';
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

  const cards = MUNICIPIOS.map((m) => {
    const fila = filas.find((f) => f.municipio === m.v);
    const cantidad = fila ? Number(fila.cantidad) : 0;
    const puedeSincronizar = estado.puedeEditar && fila && cantidad > 0 && MUNICIPIO_A_LOTES[m.v];
    return `
      <div class="destino-card">
        <label>${m.l}</label>
        <input type="number" min="0" class="solo-edicion" id="dm-${m.v}" value="${cantidad}" data-municipio="${m.v}">
        <span class="solo-lectura" style="display:none;">${cantidad}</span>
        ${puedeSincronizar ? `<button class="btn btn-outline btn-sm solo-edicion" style="margin-top:8px; width:100%;" data-sync-muni="${m.v}"><span class="material-symbols-rounded" style="font-size:13px">sync</span> Sincronizar a Lotes</button>` : ''}
        <button class="btn btn-outline btn-sm" style="margin-top:6px; width:100%;" data-pdf-muni="${m.v}"><span class="material-symbols-rounded" style="font-size:13px">draw</span> Firmas y PDF (2 copias)</button>
        <div id="cajaFirmasMuni-${m.v}" style="display:none; margin-top:8px; padding:8px; background:var(--surface-container); border-radius:10px;"></div>
      </div>
    `;
  }).join('');

  const yaRepartido = filas.reduce((acc, f) => acc + Number(f.cantidad || 0), 0);
  const saldo = disponible - yaRepartido;
  caja.innerHTML = `
    <div style="margin-top:14px;">
      <span>Disponible: <strong>${disponible}</strong> · Repartido: <strong>${yaRepartido}</strong> ·
        Saldo: <span class="saldo ${saldo <= 0 ? 'agotado' : saldo < disponible * 0.2 ? 'bajo' : 'ok'}">${saldo}</span></span>
      <div class="grid-destinos">${cards}</div>
    </div>
  `;

  caja.querySelectorAll('input[data-municipio]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoMunicipio(biologicoId, loteId, inp.dataset.municipio, inp));
  });
  caja.querySelectorAll('[data-sync-muni]').forEach((btn) => {
    btn.addEventListener('click', () => sincronizarLotePublico(btn.dataset.syncMuni, biologicoId, loteId));
  });
  caja.querySelectorAll('[data-pdf-muni]').forEach((btn) => {
    const muni = btn.dataset.pdfMuni;
    btn.addEventListener('click', () => toggleCajaFirmas('cajaFirmasMuni-' + muni, 'MUNICIPAL', muni, 2));
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
// Paso 3 — Reparto a Unidades
// ---------------------------------------------------------------------------

function renderSelectMunicipioYLotesPaso3() {
  const selMuni = $('selMunicipioUnidad');
  if (!selMuni.dataset.armado) {
    selMuni.innerHTML = MUNICIPIOS.map((m) => `<option value="${m.v}">${m.l}</option>`).join('');
    selMuni.dataset.armado = '1';
    selMuni.onchange = renderSelectLotesPaso3;
  }
  renderSelectLotesPaso3();
}

function renderSelectLotesPaso3() {
  const municipio = $('selMunicipioUnidad').value;
  const sel = $('selLoteParaUnidad');
  const asignados = estado.distMunicipio.filter((d) => d.municipio === municipio && Number(d.cantidad) > 0);
  sel.innerHTML = asignados.map((d) => {
    const bio = estado.catalogo.find((b) => b.id === d.requi_biologico_id);
    const item = estado.items.find((i) => i.requi_biologico_id === d.requi_biologico_id && i.lote_id === d.lote_id);
    return `<option value="${d.requi_biologico_id}::${d.lote_id}">${bio ? bio.nombre : '?'} — Lote ${item ? item.requi_lotes.numero_lote : ''} (asignado: ${d.cantidad})</option>`;
  }).join('') || '<option value="">Este destino no tiene lotes asignados todavía (ver paso 2)</option>';
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

  const filasHtml = unidadesMunicipio.map((u) => {
    const fila = filas.find((f) => f.unidad_id === u.id);
    const cantidad = fila ? Number(fila.cantidad) : 0;
    return `
      <tr>
        <td>${u.nombre}</td>
        <td class="solo-edicion"><input type="number" min="0" value="${cantidad}" data-unidad="${u.id}"></td>
        <td class="solo-lectura" style="display:none;">${cantidad}</td>
        <td><button class="btn btn-outline btn-sm" data-pdf-unidad="${u.id}"><span class="material-symbols-rounded" style="font-size:13px">draw</span> Firmas y PDF</button></td>
      </tr>
    `;
  }).join('');

  caja.innerHTML = `
    <div style="margin-top:14px;">
      <span>Disponible en ${municipio === 'HOSPITALES' ? 'Hospitales' : municipio}: <strong>${disponible}</strong> · Repartido: <strong>${yaRepartido}</strong> ·
        Saldo: <span class="saldo ${saldo <= 0 ? 'agotado' : saldo < disponible * 0.2 ? 'bajo' : 'ok'}">${saldo}</span></span>
      <div class="tbl-scroll" style="margin-top:10px;">
        <table class="tbl">
          <thead><tr><th>Unidad</th><th>Cantidad</th><th>Firmas y PDF (3 copias)</th></tr></thead>
          <tbody>${filasHtml || '<tr><td colspan="3" style="color:var(--muted)">Sin unidades registradas para este destino.</td></tr>'}</tbody>
        </table>
      </div>
      <div id="cajaFirmasUnidad" style="display:none; margin-top:10px; padding:10px; background:var(--surface-container); border-radius:10px;"></div>
    </div>
  `;

  caja.querySelectorAll('input[data-unidad]').forEach((inp) => {
    inp.addEventListener('change', () => guardarRepartoUnidad(biologicoId, loteId, inp.dataset.unidad, inp));
  });
  caja.querySelectorAll('[data-pdf-unidad]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cont = $('cajaFirmasUnidad');
      if (cont.dataset.unidadActual !== btn.dataset.pdfUnidad) cont.style.display = 'none';
      cont.dataset.unidadActual = btn.dataset.pdfUnidad;
      toggleCajaFirmas('cajaFirmasUnidad', 'UNIDAD', btn.dataset.pdfUnidad, 3);
    });
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
// Navegación de pasos / arranque
// ---------------------------------------------------------------------------

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
  await cargarRequisicion();

  document.querySelectorAll('.paso-tab').forEach((tab) => tab.addEventListener('click', () => activarPaso(tab.dataset.paso)));
  $('btnCargar').addEventListener('click', cargarRequisicion);
  $('btnGuardarCabecera').addEventListener('click', guardarCabecera);
  $('btnPdfJurisdiccional').addEventListener('click', () => toggleCajaFirmas('cajaFirmasJurisdiccional', 'JURISDICCIONAL', 'JURISDICCION', 2));
});
