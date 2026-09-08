// ============================================================================
// Requisiciones — Impresión fiel al formato oficial (REQUISICION ACTUALIZADA.xlsx)
//
// Misma técnica que biovac_print_ui.js: réplica HTML del layout real +
// impresión nativa del navegador (@page letter), en vez de jsPDF/autotable
// (no maneja bien celdas combinadas). Los 3 niveles comparten exactamente
// la misma cuadrícula -- solo cambian encabezado ORIGEN/DESTINO y la fuente
// de los renglones.
// ============================================================================

const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";

const DIRECCION_JURISDICCION = "Circuito Moises Solana S/N, Col. Vista Alegre, Santiago de Querétaro. Qro.";
const NOMBRE_MUNICIPIO = { CORREGIDORA: 'MUNICIPIO CORREGIDORA', HUIMILPAN: 'MUNICIPIO HUIMILPAN', MARQUES: 'MUNICIPIO EL MARQUÉS', QUERETARO: 'MUNICIPIO QUERÉTARO', HOSPITALES: 'HOSPITALES' };
const COPIAS_DEFAULT = { JURISDICCIONAL: 2, MUNICIPAL: 2, UNIDAD: 3 };
const MESES_L = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function fmtFecha(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function bloqueEncabezado({ origenNombre, origenDireccion, destinoNombre, destinoDireccion, area, fechaEnvio, folio, mesLabel }) {
  return `
    <div class="encabezado">
      <img src="${window.REQUI_LOGO_SALUD}" alt="Secretaría de Salud SESEQ">
      <div class="titulo-central">
        <div class="l1">Servicios de Salud del Estado de Querétaro</div>
        <div class="l2">Coordinación General · Subdirección de Adquisiciones</div>
      </div>
      <img src="${window.REQUI_LOGO_QUERETARO}" alt="Querétaro, Juntos Adelante">
    </div>
    <div class="subtitulo-doc">Solicitud y Surtimiento de la Cámara de Frío Estatal</div>
    <table class="datos">
      <tr>
        <td class="etq">ORIGEN:</td><td>${origenNombre}</td>
        <td class="etq">ÁREA:</td><td>${area}</td>
      </tr>
      <tr>
        <td class="etq">DIRECCIÓN:</td><td>${origenDireccion}</td>
        <td class="etq">FECHA DE ENVÍO:</td><td>${fechaEnvio}</td>
      </tr>
      <tr>
        <td class="etq">DESTINO:</td><td>${destinoNombre}</td>
        <td class="etq">FOLIO ORACLE:</td><td>${folio || ''}</td>
      </tr>
      <tr>
        <td class="etq">DIRECCIÓN:</td><td>${destinoDireccion || ''}</td>
        <td class="etq">MES A SURTIR:</td><td>${mesLabel}</td>
      </tr>
    </table>
  `;
}

function bloqueFirmas(nombre, cargo, fallbackCaption) {
  return `
    <div class="linea">&nbsp;</div>
    ${nombre ? `<div class="nombre-impreso">${nombre}</div>` : ''}
    <div class="cargo-caption">${cargo || fallbackCaption || ''}</div>
  `;
}

function bloqueGrid(filas, firmas) {
  const cuerpo = filas.map((f, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="clave">${f.clave}</td>
      <td class="nombre">${f.nombre}</td>
      <td>${f.presentacion}</td>
      <td>${f.forma || ''}</td>
      <td></td>
      <td>${f.autorizado ?? ''}</td>
      <td>${f.surtido ?? ''}</td>
      <td>${f.lote || ''}</td>
      <td>${f.caducidad || ''}</td>
      <td></td>
    </tr>
  `).join('');
  return `
    <table class="grid">
      <thead>
        <tr><th rowspan="2">Núm</th><th rowspan="2">Clave de<br>Artículo</th><th rowspan="2">Nombre del<br>Artículo</th><th rowspan="2">Presentación</th><th rowspan="2">Forma<br>Farmacéutica</th><th colspan="3">Cantidad</th><th rowspan="2">Lote</th><th rowspan="2">Caducidad</th><th rowspan="2">Firma de<br>Recepción</th></tr>
        <tr><th>Solicitado</th><th>Autorizado</th><th>Surtido</th></tr>
      </thead>
      <tbody>${cuerpo}</tbody>
    </table>
    <div class="nota-transporte">Condiciones de transporte y almacenamiento: manténgase en todo momento a temperatura entre 2°C y 8°C</div>
    <div class="fila-recepcion">
      <div>Temperatura a la recepción: ____________</div>
      <div>Fecha de recepción: ____________</div>
    </div>
    <div class="obs"><strong>Observaciones:</strong></div>
    <div class="firmas">
      <div>${bloqueFirmas(firmas?.elaboro_nombre, firmas?.elaboro_cargo, 'ELABORÓ')}</div>
      <div>${bloqueFirmas(firmas?.autorizo_nombre, firmas?.autorizo_cargo, 'AUTORIZÓ')}</div>
    </div>
    <div class="firmas">
      <div>${bloqueFirmas(firmas?.entrega_nombre, firmas?.entrega_cargo, 'ENTREGA: NOMBRE COMPLETO Y FIRMA')}</div>
      <div>${bloqueFirmas(firmas?.recibe_nombre, firmas?.recibe_cargo, 'RECIBE: NOMBRE COMPLETO Y FIRMA')}</div>
    </div>
  `;
}

async function main() {
  const qs = new URLSearchParams(location.search);
  const requisicionId = qs.get('id');
  const nivel = (qs.get('nivel') || 'JURISDICCIONAL').toUpperCase();
  const destino = qs.get('destino') || '';
  const copias = Number(qs.get('copias')) || COPIAS_DEFAULT[nivel] || 1;

  if (!requisicionId) {
    document.getElementById('hojas').innerHTML = '<p style="color:#fff;text-align:center;margin-top:40px;">Falta el parámetro "id" de la requisición.</p>';
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: requisicion } = await db.from('requi_requisiciones').select('*').eq('id', requisicionId).single();
  const { data: catalogo } = await db.from('requi_catalogo_biologicos').select('*').eq('activo', true).order('orden');
  const { data: firmas } = await db.from('requi_firmas').select('*')
    .eq('requisicion_id', requisicionId).eq('nivel', nivel).eq('destino', destino || 'JURISDICCION').maybeSingle();

  let filasPorBiologico = {};
  let destinoNombre = '';
  let destinoDireccion = '';

  if (nivel === 'JURISDICCIONAL') {
    const { data } = await db.from('requi_items_jurisdiccion')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', requisicionId);
    destinoNombre = 'JURISDICCIÓN SANITARIA N.1 (concentrado)';
    destinoDireccion = DIRECCION_JURISDICCION;
    (data || []).forEach((it) => {
      (filasPorBiologico[it.requi_biologico_id] ||= []).push({
        surtido: it.cantidad_surtida, lote: it.requi_lotes?.numero_lote, caducidad: it.requi_lotes?.caducidad
      });
    });
  } else if (nivel === 'MUNICIPAL') {
    const { data } = await db.from('requi_distribucion_municipio')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', requisicionId).eq('municipio', destino);
    destinoNombre = NOMBRE_MUNICIPIO[destino] || destino;
    (data || []).forEach((it) => {
      if (Number(it.cantidad) <= 0) return;
      (filasPorBiologico[it.requi_biologico_id] ||= []).push({
        surtido: it.cantidad, lote: it.requi_lotes?.numero_lote, caducidad: it.requi_lotes?.caducidad
      });
    });
  } else {
    const { data: unidad } = await db.from('requi_unidades').select('*').eq('id', destino).single();
    const { data } = await db.from('requi_distribucion_unidad')
      .select('*, requi_lotes(numero_lote, caducidad)').eq('requisicion_id', requisicionId).eq('unidad_id', destino);
    destinoNombre = unidad ? `C.S. ${unidad.nombre}` : '';
    destinoDireccion = unidad ? NOMBRE_MUNICIPIO[unidad.municipio] || '' : '';
    (data || []).forEach((it) => {
      if (Number(it.cantidad) <= 0) return;
      (filasPorBiologico[it.requi_biologico_id] ||= []).push({
        surtido: it.cantidad, lote: it.requi_lotes?.numero_lote, caducidad: it.requi_lotes?.caducidad
      });
    });
  }

  const filas = [];
  (catalogo || []).forEach((bio) => {
    const registros = filasPorBiologico[bio.id];
    if (!registros || !registros.length) {
      filas.push({ clave: bio.clave_articulo, nombre: bio.nombre, presentacion: bio.presentacion, forma: bio.forma });
    } else {
      registros.forEach((r) => filas.push({
        clave: bio.clave_articulo, nombre: bio.nombre, presentacion: bio.presentacion, forma: bio.forma,
        surtido: r.surtido, lote: r.lote, caducidad: fmtFecha(r.caducidad)
      }));
    }
  });

  const encabezadoHtml = bloqueEncabezado({
    origenNombre: 'JURISDICCIÓN SANITARIA N.1',
    origenDireccion: DIRECCION_JURISDICCION,
    destinoNombre, destinoDireccion,
    area: requisicion?.area || 'VACUNAS',
    fechaEnvio: fmtFecha(requisicion?.fecha_envio) || fmtFecha(new Date()),
    folio: requisicion?.folio_oracle,
    mesLabel: requisicion ? `${MESES_L[requisicion.mes]} ${requisicion.anio}` : ''
  });
  const gridHtml = bloqueGrid(filas, firmas);

  const hojasEl = document.getElementById('hojas');
  hojasEl.innerHTML = Array.from({ length: copias }).map(() => `<div class="hoja">${encabezadoHtml}${gridHtml}</div>`).join('');
  document.getElementById('infoImpresion').textContent =
    `${nivel} · ${destinoNombre} · ${copias} copia(s) · ${requisicion ? MESES_L[requisicion.mes] + ' ' + requisicion.anio : ''}`;

  const { data: { session } } = await db.auth.getSession();
  if (session) {
    await db.from('requi_pdf_generados').insert({
      requisicion_id: requisicionId, nivel, destino: destino || 'JURISDICCION', copias, generado_por: session.user.email
    });
  }
}

document.addEventListener('DOMContentLoaded', main);
