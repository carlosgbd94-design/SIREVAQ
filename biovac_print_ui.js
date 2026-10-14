// ============================================================================
// BioVac — Vista de impresión / exportación a PDF
//
// No usa jsPDF ni autotable (no manejan bien esta grilla con celdas
// combinadas y bloques dinámicos) -- en su lugar, una vista HTML propia
// que replica el layout del Excel real (mismos encabezados, mismas
// proporciones de columnas, logos oficiales extraídos del propio archivo
// en biovac_assets.js) e impresión vía el diálogo nativo del navegador
// (misma técnica que ya usa este repo para el acuse de Pinol: @page +
// @media print).
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' }, { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' }, { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' }, { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' }
];
const MESES_NOMBRE = { 1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO', 7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE' };
const MESES_ABREV3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
function formatMmmAa(fechaIso) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso + 'T00:00:00');
  if (isNaN(d.getTime())) return fechaIso;
  return `${MESES_ABREV3[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

let db = null;
let jurisdiccionActual = null; // id, cuando la vista se abrió con ?jurisdiccion=...

function fechaVigenteRef(anio, mes) { return new Date(Date.UTC(anio, mes - 1, 1)); }
function bioVigente(b, anio, mes) {
  const ref = fechaVigenteRef(anio, mes);
  const desde = new Date(b.vigente_desde + 'T00:00:00Z');
  const hasta = b.vigente_hasta ? new Date(b.vigente_hasta + 'T00:00:00Z') : null;
  return ref >= desde && (!hasta || ref <= hasta);
}

async function cargarSelects() {
  const { data: unidades } = await db.from('biovac_unidades').select('*').eq('activo', true).order('nombre');
  document.getElementById('selUnidad').innerHTML = unidades.map((u) => `<option value="${u.id}">${u.nombre} (${u.municipio})</option>`).join('');

  const anioActual = new Date().getFullYear();
  document.getElementById('selAnio').innerHTML = [anioActual - 1, anioActual, anioActual + 1]
    .map((a) => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');

  const mesActual = new Date().getMonth() + 1;
  document.getElementById('selMes').innerHTML = MESES.map((m) => `<option value="${m.v}" ${m.v === mesActual ? 'selected' : ''}>${m.l}</option>`).join('');
}

function encabezadoHtml(pagina, datos) {
  return `
  <table class="form">
    <tr>
      <td class="encabezado-logo" colspan="6" rowspan="4">
        <img src="${window.BIOVAC_LOGO_JURISDICCION}" alt="Jurisdicción Sanitaria">
        <img src="${window.BIOVAC_LOGO_SALUD}" alt="Secretaría de Salud">
      </td>
      <td class="titulo-principal" colspan="11">SERVICIOS DE SALUD DEL ESTADO DE QUERÉTARO<br>
        CENTRO NACIONAL PARA LA SALUD DE LA INFANCIA Y ADOLESCENCIA<br>
        INFORME MENSUAL DE MOVIMIENTO DE BIOLÓGICO — ${pagina}</td>
    </tr>
    <tr><td colspan="11">1. Identificación: JURISDICCIÓN SANITARIA N° 1 &nbsp;&nbsp; Entidad Federativa: QUERÉTARO</td></tr>
    <tr>
      <td class="campo-etiqueta" colspan="2">Fecha del corte:</td>
      <td colspan="2">Día: ${datos.dia || ''} &nbsp; Mes: ${datos.mesNombre} &nbsp; Año: ${datos.anio}</td>
      <td class="campo-etiqueta" colspan="2">Unidad de salud:</td>
      <td colspan="5">${datos.municipio}</td>
    </tr>
    <tr><td class="campo-etiqueta" colspan="2">Responsable de la elaboración:</td><td colspan="9">${datos.responsable || ''}</td></tr>
  </table>`;
}

function encabezadoColumnas() {
  return `<thead>
    <tr>
      <th rowspan="2" style="width:9%">Biológico</th>
      <th colspan="3">Existencia anterior en FRASCOS</th>
      <th colspan="3">FRASCOS recibidos con requisición mensual</th>
      <th colspan="2">DOSIS Aplicadas</th>
      <th colspan="2">DOSIS Desechadas</th>
      <th colspan="3">Existencia final en FRASCOS</th>
      <th rowspan="2" style="width:14%">Observaciones</th>
    </tr>
    <tr>
      <th>Cant.</th><th>Lote</th><th>Caduc.</th>
      <th>Cant.</th><th>Lote</th><th>Caduc.</th>
      <th>Frac.</th><th>Compl.</th>
      <th>Frac.</th><th>Compl.</th>
      <th>Cant.</th><th>Lote</th><th>Caduc.</th>
    </tr>
  </thead>`;
}

function calcExistenciaFinal(bio, lote, r) {
  return BiovacEngineCalc(bio, lote, r);
}

function BiovacEngineCalc(bio, lote, r) {
  const dosis = lote.dosis_por_frasco_override != null ? lote.dosis_por_frasco_override : bio.dosis_por_frasco;
  const split = bio.regla_especial === 'SPLIT_DOSE';
  const aplicadas = split ? (r.aplicadas_a / 2 + r.aplicadas_b) : (r.aplicadas_a + r.aplicadas_b);
  const desechadas = split ? (r.desechadas_a / 2 + r.desechadas_b) : (r.desechadas_a + r.desechadas_b);
  const anterior = Number(r.existencia_anterior_frascos), recibido = Number(r.recibido_frascos);
  if (bio.presentacion === 'UNIDOSIS') return (anterior + recibido) - (aplicadas + desechadas);
  const d = dosis || 1;
  return ((anterior + recibido) * d - (aplicadas + desechadas)) / d;
}

function filaRenglonHtml(bio, r, mostrarNombre) {
  const lote = r.biovac_lotes;
  const split = bio.regla_especial === 'SPLIT_DOSE';
  const final = calcExistenciaFinal(bio, lote, r);
  const caducidad = formatMmmAa(lote.caducidad);
  return `<tr class="${r.categoria !== 'NORMAL' ? 'fila-arf' : ''}">
    <td class="nombre-bio">${mostrarNombre ? bio.nombre_excel.replace(/\n/g, ' ') : ''}</td>
    <td>${r.existencia_anterior_frascos || ''}</td><td>${lote.numero_lote}</td><td>${caducidad}</td>
    <td>${r.recibido_frascos || ''}</td><td>${lote.numero_lote}</td><td>${caducidad}</td>
    <td>${r.aplicadas_a || ''}</td><td>${split ? (r.aplicadas_b || '') : ''}</td>
    <td>${r.desechadas_a || ''}</td><td>${split ? (r.desechadas_b || '') : ''}</td>
    <td>${final}</td><td>${lote.numero_lote}</td><td>${caducidad}</td>
    <td class="obs">${r.observaciones || ''}</td>
  </tr>`;
}

function filaEtiquetaHtml(texto, esArf) {
  return `<tr class="${esArf ? 'fila-arf' : ''}"><td class="nombre-bio">${esArf ? '<span class="tag-arf-print">A.R.F.</span> En dictamen o canje' : texto}</td>
    <td colspan="13"></td></tr>`;
}

function filaTotalHtml(biosConRenglones) {
  const suma = (campo) => biosConRenglones.flatMap((b) => [...b.normales, ...b.arf]).reduce((s, r) => s + Number(r[campo] || 0), 0);
  const sumaFinal = biosConRenglones.flatMap((b) => b.renglonesConFinal).reduce((s, x) => s + x.final, 0);
  return `<tr class="fila-total">
    <td>Total</td>
    <td>${suma('existencia_anterior_frascos') || ''}</td><td></td><td></td>
    <td>${suma('recibido_frascos') || ''}</td><td></td><td></td>
    <td>${suma('aplicadas_a') || ''}</td><td>${suma('aplicadas_b') || ''}</td>
    <td>${suma('desechadas_a') || ''}</td><td>${suma('desechadas_b') || ''}</td>
    <td>${sumaFinal}</td><td></td><td></td>
    <td></td>
  </tr>`;
}

function bloqueHtml(biosConRenglones) {
  let html = '';
  for (const { bio, normales } of biosConRenglones) {
    if (normales.length === 0) { html += filaEtiquetaHtml(bio.nombre_excel.replace(/\n/g, ' '), false); continue; }
    normales.forEach((r, i) => { html += filaRenglonHtml(bio, r, i === 0); });
  }
  const arfCombinado = biosConRenglones.flatMap((b) => b.arf.map((r) => ({ bio: b.bio, r })));
  html += filaEtiquetaHtml('', true);
  arfCombinado.forEach(({ bio, r }) => { html += filaRenglonHtml(bio, r, false); });
  html += filaTotalHtml(biosConRenglones.map((b) => ({
    ...b,
    renglonesConFinal: [...b.normales, ...b.arf].map((r) => ({ final: calcExistenciaFinal(b.bio, r.biovac_lotes, r) }))
  })));
  return html;
}

// Arma el HTML de ambas páginas (Anverso/Reverso) a partir de datos YA
// RESUELTOS a la forma común de renglón -- compartido por la vista
// municipal (un solo movimiento) y la jurisdiccional (concentrado en vivo
// de los 4 municipios), igual que construirWorkbookDesdeDatos en el
// exportador de Excel.
function renderizarHojas({ bloques, biologicos, renglonesDb, anio, mes, datosHeader }) {
  const porPagina = { ANVERSO: '', REVERSO: '' };
  for (const bloque of bloques) {
    const biosDelBloque = biologicos.filter((b) => b.bloque_id === bloque.id && bioVigente(b, anio, mes)).sort((a, b) => a.orden_en_bloque - b.orden_en_bloque);
    if (biosDelBloque.length === 0) continue;
    // Los biológicos vigentes se imprimen siempre, incluso sin movimiento
    // este mes -- bloqueHtml ya deja una fila de etiqueta sin datos en ese
    // caso, igual que el formulario oficial en blanco.
    const biosConRenglones = biosDelBloque.map((bio) => {
      const renglonesBio = renglonesDb.filter((r) => r.biovac_lotes.biologico_id === bio.id);
      return { bio, normales: renglonesBio.filter((r) => r.categoria === 'NORMAL'), arf: renglonesBio.filter((r) => r.categoria !== 'NORMAL') };
    });
    porPagina[bloque.pagina] += bloqueHtml(biosConRenglones);
  }

  document.getElementById('contenedorHojas').innerHTML = ['ANVERSO', 'REVERSO'].map((pagina) => `
    <div class="hoja">
      ${encabezadoHtml(pagina, datosHeader)}
      <table class="datos">${encabezadoColumnas()}<tbody>${porPagina[pagina]}</tbody></table>
    </div>`).join('');
}

async function cargarYRenderizarUnidad() {
  const unidadId = document.getElementById('selUnidad').value;
  const anio = Number(document.getElementById('selAnio').value);
  const mes = Number(document.getElementById('selMes').value);
  if (!unidadId) {
    document.getElementById('contenedorHojas').innerHTML = '<p style="padding:20px">No hay unidades disponibles: inicia sesión en SIREVAQ con un perfil MUNICIPAL, JURISDICCIONAL o ADMIN.</p>';
    return;
  }

  const { data: unidad } = await db.from('biovac_unidades').select('*').eq('id', unidadId).single();
  const { data: movimiento } = await db.from('biovac_movimientos').select('*').eq('unidad_id', unidadId).eq('anio', anio).eq('mes', mes).maybeSingle();
  if (!movimiento) { document.getElementById('contenedorHojas').innerHTML = '<p style="padding:20px">No existe movimiento para esta unidad/periodo.</p>'; return; }

  const [{ data: bloques }, { data: biologicos }, { data: renglonesDb }] = await Promise.all([
    db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden'),
    db.from('biovac_catalogo_biologicos').select('*').order('orden_en_bloque'),
    db.from('biovac_renglones').select(`categoria, existencia_anterior_frascos, recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b, observaciones,
      biovac_lotes ( numero_lote, caducidad, dosis_por_frasco_override, biologico_id )`).eq('movimiento_id', movimiento.id)
  ]);

  const datosHeader = {
    dia: movimiento.fecha_corte ? Number(movimiento.fecha_corte.slice(8, 10)) : '',
    mesNombre: MESES_NOMBRE[mes], anio, municipio: unidad.municipio, responsable: movimiento.responsable_elaboracion
  };

  renderizarHojas({ bloques, biologicos, renglonesDb, anio, mes, datosHeader });
}

async function cargarYRenderizarJurisdiccion() {
  const anio = Number(document.getElementById('selAnio').value);
  const mes = Number(document.getElementById('selMes').value);

  const { data: jurisdiccion } = await db.from('biovac_jurisdicciones').select('*').eq('id', jurisdiccionActual).maybeSingle();
  if (!jurisdiccion) { document.getElementById('contenedorHojas').innerHTML = '<p style="padding:20px">Jurisdicción no encontrada.</p>'; return; }

  const [{ data: bloques }, { data: biologicos }, { data: concentrado }] = await Promise.all([
    db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden'),
    db.from('biovac_catalogo_biologicos').select('*').order('orden_en_bloque'),
    window.rpcPorBloques(db, 'biovac_concentrado_jurisdiccion', { p_jurisdiccion_id: jurisdiccionActual, p_anio: anio, p_mes: mes })
  ]);
  if (!concentrado || concentrado.length === 0) {
    document.getElementById('contenedorHojas').innerHTML = '<p style="padding:20px">No hay movimientos CERRADOS de esta jurisdicción para el periodo seleccionado.</p>';
    return;
  }
  const renglonesDb = concentrado.map((f) => ({
    categoria: f.categoria,
    existencia_anterior_frascos: f.existencia_anterior_frascos,
    recibido_frascos: f.recibido_frascos,
    aplicadas_a: f.aplicadas_a, aplicadas_b: f.aplicadas_b,
    desechadas_a: f.desechadas_a, desechadas_b: f.desechadas_b,
    observaciones: null,
    biovac_lotes: { numero_lote: f.numero_lote, caducidad: f.caducidad, dosis_por_frasco_override: null, biologico_id: f.biologico_id }
  }));

  const datosHeader = {
    dia: new Date(Date.UTC(anio, mes, 0)).getUTCDate(),
    mesNombre: MESES_NOMBRE[mes], anio, municipio: jurisdiccion.nombre, responsable: ''
  };

  renderizarHojas({ bloques, biologicos, renglonesDb, anio, mes, datosHeader });
}

async function cargarYRenderizar() {
  if (jurisdiccionActual) return cargarYRenderizarJurisdiccion();
  return cargarYRenderizarUnidad();
}

document.addEventListener('DOMContentLoaded', async () => {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Enlace directo: ?unidad=...&anio=...&mes=... (desde biovac.html) o
  // ?jurisdiccion=...&anio=...&mes=... (desde biovac_jurisdiccion.html).
  const params = new URLSearchParams(window.location.search);
  const jurisdiccionParam = params.get('jurisdiccion');
  const unidadParam = params.get('unidad');

  await cargarSelects();
  if (jurisdiccionParam) {
    jurisdiccionActual = jurisdiccionParam;
    document.getElementById('selUnidad').style.display = 'none';
  } else if (unidadParam && document.querySelector(`#selUnidad option[value="${unidadParam}"]`)) {
    document.getElementById('selUnidad').value = unidadParam;
  }
  if (params.get('anio')) document.getElementById('selAnio').value = params.get('anio');
  if (params.get('mes')) document.getElementById('selMes').value = params.get('mes');
  if (jurisdiccionParam || unidadParam) await cargarYRenderizar();

  document.getElementById('btnCargar').addEventListener('click', cargarYRenderizar);
  document.getElementById('btnImprimir').addEventListener('click', () => window.print());
});

// PostgREST corta cada respuesta en 1000 filas: las funciones que devuelven TABLE se piden por bloques
// (.range) y se juntan. Tolera clientes simulados sin .range (una sola respuesta).
if (typeof window !== 'undefined') window.rpcPorBloques = window.rpcPorBloques || async function rpcPorBloques(db, nombre, args) {
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const q = db.rpc(nombre, args);
    const paginable = q && typeof q.range === 'function';
    const r = await (paginable ? q.range(desde, desde + 999) : q);
    if (r.error) return { data: null, error: r.error };
    if (!Array.isArray(r.data)) return r;
    todo.push(...r.data);
    if (!paginable || r.data.length < 1000) break;
  }
  return { data: todo, error: null };
};
