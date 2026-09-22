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
  correccionesAbiertas: {} // renglonId -> batchId
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
// Carga principal
// ---------------------------------------------------------------------------

async function cargarConcentrado() {
  const { jurisdiccionId, anio, mes } = seleccion();
  if (!jurisdiccionId) return;
  estado.drilldownAbierto = null;

  const [{ data: unidades, error: eU }, { data: validaciones, error: eV },
    { data: concentrado, error: eC }, { data: informes, error: eI }] = await Promise.all([
    estado.db.from('biovac_unidades').select('*').eq('jurisdiccion_id', jurisdiccionId).eq('activo', true).order('nombre'),
    estado.db.rpc('biovac_validar_concentrado', { p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes }),
    estado.db.rpc('biovac_concentrado_jurisdiccion', { p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes, p_incluir_borrador: true }),
    estado.db.from('biovac_informes_jurisdiccionales').select('*').eq('jurisdiccion_id', jurisdiccionId).eq('anio', anio).eq('mes', mes).order('generado_en', { ascending: false })
  ]);
  if (eU || eV || eC || eI) { toast('Error: ' + (eU || eV || eC || eI).message, 'error'); return; }

  document.getElementById('panelResultados').style.display = 'block';

  await renderEstadoUnidades(unidades, anio, mes);
  renderValidaciones(validaciones);
  renderInformes(informes);
  estado.concentrado = concentrado;
  renderConcentrado(concentrado);
}

async function renderEstadoUnidades(unidades, anio, mes) {
  const { data: movimientos } = await estado.db.from('biovac_movimientos')
    .select('unidad_id, estado, fue_corregido')
    .in('unidad_id', unidades.map((u) => u.id)).eq('anio', anio).eq('mes', mes);
  const mapa = new Map((movimientos || []).map((m) => [m.unidad_id, m]));

  document.getElementById('estadoUnidades').innerHTML = unidades.map((u) => {
    const m = mapa.get(u.id);
    const est = m ? m.estado : 'SIN_MOVIMIENTO';
    return `<div class="chip-municipio">
      <b>${u.nombre}</b>
      <span class="estado-badge estado-${est}">${est.replace('_', ' ')}</span>
      ${m && m.fue_corregido ? '<span class="corregido"><span class="material-symbols-rounded">warning</span> corregido</span>' : ''}
    </div>`;
  }).join('');
}

function renderValidaciones(validaciones) {
  const cont = document.getElementById('listaValidaciones');
  if (!validaciones || validaciones.length === 0) {
    cont.innerHTML = '<p class="sin-validaciones"><span class="material-symbols-rounded">check_circle</span> Sin inconsistencias detectadas.</p>';
    return;
  }
  cont.innerHTML = validaciones.map((v) => `
    <div class="validacion ${v.severidad}">
      <span class="codigo">${v.severidad}</span>
      <span>${v.mensaje}${v.unidad ? ' — <b>' + v.unidad + '</b>' : ''}${v.biologico ? ' · ' + v.biologico : ''}${v.lote ? ' · lote ' + v.lote : ''}</span>
    </div>`).join('');
}

function renderInformes(informes) {
  const cont = document.getElementById('listaInformes');
  if (!informes || informes.length === 0) { cont.innerHTML = '<p style="color:var(--muted); font-size:12.5px; margin:0">Aún no se ha generado un informe de este mes.</p>'; return; }
  cont.innerHTML = informes.map((i) => `
    <div class="informe-fila">
      <span class="estado-badge estado-${i.estado}">${i.estado.replace(/_/g, ' ')}</span>
      generado por <b>${i.generado_por || '—'}</b> el ${new Date(i.generado_en).toLocaleString('es-MX')}
    </div>`).join('');
}

async function generarInforme() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const { jurisdiccionId, anio, mes } = seleccion();
  const { error } = await estado.db.rpc('biovac_generar_informe_jurisdiccional', {
    p_jurisdiccion_id: jurisdiccionId, p_anio: anio, p_mes: mes, p_usuario: usuario
  });
  if (error) { toast('No se pudo generar: ' + error.message, 'error'); return; }
  toast('Informe generado.', 'ok');
  await cargarConcentrado();
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
          <th>Final</th><th>Unidades</th><th></th>
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
    <td class="unidades-reportando ${incompleto ? 'incompleto' : ''}">${f.unidades_cerradas}/${f.unidades_reportando} cerradas</td>
    <td><button class="btn-mini btn-secundario" data-action="drilldown" data-lote="${f.lote_id}" data-categoria="${f.categoria}"><span class="material-symbols-rounded">manage_search</span> Ver</button></td>
  </tr>`;
  if (estado.drilldownAbierto && estado.drilldownAbierto.loteId === f.lote_id && estado.drilldownAbierto.categoria === f.categoria) {
    html += `<tr><td colspan="${COLS_CONCENTRADO}" style="padding:0; border-bottom:1px solid #f1f5f9;"><div class="drilldown" id="drilldownContenido">Cargando…</div></td></tr>`;
  }
  return html;
}

async function toggleDrilldown(loteId, categoria) {
  if (estado.drilldownAbierto && estado.drilldownAbierto.loteId === loteId && estado.drilldownAbierto.categoria === categoria) {
    estado.drilldownAbierto = null;
    renderConcentrado(estado.concentrado);
    return;
  }
  estado.drilldownAbierto = { loteId, categoria };
  renderConcentrado(estado.concentrado);
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

  cont.innerHTML = `<table><thead><tr>
      <th>Unidad</th><th>Estado</th><th>Ant.</th><th>Recibido</th><th>Aplic. A</th><th>Aplic. B</th><th>Desech. A</th><th>Desech. B</th><th>Final</th><th>Observaciones</th><th></th>
    </tr></thead><tbody>${data.map((d) => renderFilaDrilldown(d, anio, mes)).join('')}</tbody></table>`;
}

function botonVerPdfUnidad(d, anio, mes) {
  return `<button class="btn-icono" data-action="ver-pdf-unidad" data-unidad="${d.unidad_id}" data-anio="${anio}" data-mes="${mes}" title="Ver PDF de ${d.unidad_nombre}">
    <span class="material-symbols-rounded">picture_as_pdf</span></button>`;
}

function renderFilaDrilldown(d, anio, mes) {
  if (!d.movimiento_id) {
    return `<tr><td><b>${d.unidad_nombre}</b></td><td colspan="9" style="color:var(--muted)">Sin movimiento este mes</td></tr>`;
  }
  if (!d.renglon_id) {
    return `<tr><td><b>${d.unidad_nombre}</b></td><td><span class="estado-badge estado-${d.movimiento_estado}">${d.movimiento_estado}</span></td>
      <td colspan="7" style="color:var(--muted)">No reportó este lote</td><td>${botonVerPdfUnidad(d, anio, mes)}</td></tr>`;
  }
  const enCorreccion = d.movimiento_estado === 'EN_CORRECCION';
  const cerrado = d.movimiento_estado === 'CERRADO';
  const campo = (campo, valor) => enCorreccion
    ? `<input type="number" step="any" data-corr-renglon="${d.renglon_id}" data-corr-campo="${campo}" data-corr-movimiento="${d.movimiento_id}" value="${valor || 0}">`
    : valor;
  return `<tr data-fila-renglon="${d.renglon_id}">
    <td><b>${d.unidad_nombre}</b></td>
    <td><span class="estado-badge estado-${d.movimiento_estado}">${d.movimiento_estado.replace('_', ' ')}</span></td>
    <td>${redondearFrascos(d.existencia_anterior_frascos)}</td>
    <td>${campo('recibido_frascos', d.recibido_frascos)}</td>
    <td>${campo('aplicadas_a', d.aplicadas_a)}</td>
    <td>${campo('aplicadas_b', d.aplicadas_b)}</td>
    <td>${campo('desechadas_a', d.desechadas_a)}</td>
    <td>${campo('desechadas_b', d.desechadas_b)}</td>
    <td class="existencia-final" data-drill-final="${d.renglon_id}">${redondearFrascos(d.existencia_final_frascos)}</td>
    <td>${enCorreccion ? `<input type="text" data-corr-renglon="${d.renglon_id}" data-corr-campo="observaciones" data-corr-movimiento="${d.movimiento_id}" value="${(d.observaciones || '').replace(/"/g, '&quot;')}">` : (d.observaciones || '')}</td>
    <td>
      ${botonVerPdfUnidad(d, anio, mes)}
      ${cerrado ? `<button class="btn-mini btn-secundario" data-action="abrir-correccion-mov" data-movimiento="${d.movimiento_id}"><span class="material-symbols-rounded">edit</span> Corregir aquí</button>` : ''}
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
    renderConcentrado(estado.concentrado);
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
  cargarInicial();

  document.getElementById('btnCargar').addEventListener('click', cargarConcentrado);
  document.getElementById('btnGenerarInforme').addEventListener('click', generarInforme);
  document.getElementById('btnExportarExcelJurisdiccional').addEventListener('click', exportarExcelJurisdiccional);
  document.getElementById('btnVerPdfJurisdiccional').addEventListener('click', verPdfJurisdiccional);

  const cont = document.getElementById('contenedorConcentrado');
  cont.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'drilldown') toggleDrilldown(btn.dataset.lote, btn.dataset.categoria);
    if (btn.dataset.action === 'abrir-correccion-mov') abrirCorreccionMovimiento(btn.dataset.movimiento);
    if (btn.dataset.action === 'aplicar-correccion-mov') aplicarCorreccionMovimiento(btn.dataset.movimiento);
    if (btn.dataset.action === 'ver-pdf-unidad') window.open(`biovac_print.html?unidad=${btn.dataset.unidad}&anio=${btn.dataset.anio}&mes=${btn.dataset.mes}`, '_blank');
  });
  cont.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-corr-renglon][data-corr-campo]')) guardarCampoDrilldown(ev.target);
  });
});
