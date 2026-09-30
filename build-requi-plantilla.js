// Genera requisiciones_plantilla.xlsx (hoja única "GENERAL") con el formato oficial
// nuevo de requisición: 21 biológicos (2 filas cada uno, filas 14-55) y el pie
// (condiciones, observaciones, firmas) recorrido 2 filas abajo.
//
// Uso: node build-requi-plantilla.js "Municipio Querétaro (1).xlsx"
// Toma del archivo fuente la hoja GENERAL (encabezado, logos, estilos y pie), la
// reacomoda al orden nuevo y descarta las hojas por unidad (ya no se necesitan:
// los renglones quedan sin fórmulas 3D).
const ExcelJS = require('exceljs');

const ORIGEN = process.argv[2] || 'Municipio Querétaro (1).xlsx';
const DESTINO = 'requisiciones_plantilla.xlsx';
const PRIMERA = 14;          // primera fila de biológicos
const DESPLAZA = 2;          // filas que baja el pie (21 biológicos en lugar de 20)
const FIN_VIEJO = 87;        // última fila del formato anterior

// [clave de artículo, código, nombre, presentación, forma] en el orden del formato nuevo.
const ORDEN = [
  ['25311.020-000-6508-01', 6508, 'VACUNA ANTINEUMOCOCCICA 20', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-0148-01', 148, 'VACUNA ANTINEUMOCOCCICA 13', 'UNIDOSIS', 'Susp. Inyectable (Jer. prellenada)'],
  ['25311.020-000-0150-05', 150, 'VACUNA ROTAVIRUS MONOVALENTE', 'UNIDOSIS', 'Susp. Inyectable (Jer. prellenada)'],
  ['25311.020-000-6135-00', 6135, 'VACUNA HEXAVALENTE', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-2526-00', 2526, 'VACUNA HEPATITIS B MULTIDOSIS', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-6187-00', 6187, 'VACUNA HEPATITIS A UNIDOSIS', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-3800-00', 3800, 'VACUNA DOBLE VIRAL  (SR)', 'MULTIDOSIS', 'Fco. Amp Leofilizado+Diluy.'],
  ['25311.020-000-3801-01', 3801, 'VACUNA BCG', 'MULTIDOSIS', 'Fco. Amp Leofilizado+Diluy.'],
  ['25311.020-000-3805-00', 3805, 'VACUNA DPT', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-3808-02', 3808, 'VACUNA TDPA', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-3810-00', 3810, 'VACUNA TD', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-6056-01', 6056, 'VACUNA ANTIVARICELA', 'UNIDOSIS', 'Fco. Amp Leofilizado+Diluy.'],
  ['25311.020-000-3820-00', 3820, 'VACUNA TRIPLE VIRAL 1DS (SRP)', 'UNIDOSIS', 'Fco. Amp Leofilizado+Diluy.'],
  ['25311.020-000-3821-00', 3821, 'VACUNA TRIPLE VIRAL MULTI DOSIS', 'MULTIDOSIS', 'Fco. Amp Leofilizado+Diluy.'],
  ['25311.020-000-6317-01', 6317, 'VACUNA ANTIINFLUENZA 10/D', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-3832-00', 3832, 'VACUNA INMUNOGLOBULINA ANTITETANICA', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-6501-02', 6501, 'VACUNA VPH', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25331.020-X-0002-00-E', 2, 'VACUNA ANTIAMARILICA', 'UNIDOSIS', 'Fco. Amp Leofilizado +  Jer.prellenada.'],
  ['25311.020-000-6502-00', 6502, 'VACUNA COVID-19 MODERNA', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-6506-00', 6506, 'VACUNA COVID-19 PFIZER', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)'],
  ['25311.020-000-6509-01', 6509, 'VACUNA VRS', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)']
];
const COLS = 17; // A..Q

function clonar(o) { return o ? JSON.parse(JSON.stringify(o)) : o; }

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);
  const ws = wb.getWorksheet('GENERAL');

  // 1) Foto del formato viejo: estilos de los renglones y pie completo.
  const snap = (r) => {
    const row = ws.getRow(r);
    const celdas = [];
    for (let c = 1; c <= COLS; c++) {
      const cel = row.getCell(c);
      celdas.push({ style: clonar(cel.style), value: cel.isMerged && cel.master !== cel ? null : cel.value });
    }
    return { height: row.height, celdas };
  };
  const patron = { primera: [snap(14), snap(15)], media: [snap(16), snap(17)], ultima: [snap(52), snap(53)] };
  const pie = [];
  for (let r = 54; r <= FIN_VIEJO; r++) pie.push({ r, ...snap(r) });
  const mergesPie = Object.values(ws._merges).map((m) => m.model)
    .filter((m) => m.top >= 54).map((m) => ({ ...m }));

  // 2) Quitar todas las combinaciones de celdas de la zona y vaciarla.
  Object.values(ws._merges).map((m) => m.model).filter((m) => m.top >= PRIMERA)
    .forEach((m) => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
  for (let r = PRIMERA; r <= FIN_VIEJO + DESPLAZA; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= COLS; c++) { const cel = row.getCell(c); cel.value = null; cel.style = {}; }
  }

  // 3) Biológicos en el orden nuevo (2 filas cada uno; A-F y K combinadas).
  const aplica = (r, s) => {
    const row = ws.getRow(r);
    row.height = s.height;
    s.celdas.forEach((x, i) => { row.getCell(i + 1).style = clonar(x.style); });
  };
  ORDEN.forEach((b, k) => {
    const r = PRIMERA + 2 * k;
    const p = k === 0 ? patron.primera : k === ORDEN.length - 1 ? patron.ultima : patron.media;
    aplica(r, p[0]); aplica(r + 1, p[1]);
    ['A', 'B', 'C', 'D', 'E'].forEach((col, i) => { ws.getCell(`${col}${r}`).value = b[i]; });
    ['A', 'B', 'C', 'D', 'E', 'F', 'K'].forEach((col) => ws.mergeCells(`${col}${r}:${col}${r + 1}`));
  });

  // La caducidad se muestra mmm-aa en todos los renglones (el patrón de la primera
  // pareja de filas venía sin ese formato en la segunda fila).
  const fmtFecha = ws.getCell('J16').numFmt;
  for (let r = PRIMERA; r < PRIMERA + 2 * ORDEN.length; r++) ws.getCell(`J${r}`).numFmt = fmtFecha;

  // 4) Pie: mismo contenido, merges y alturas, 2 filas más abajo.
  pie.forEach((f) => {
    const r = f.r + DESPLAZA;
    const row = ws.getRow(r);
    row.height = f.height;
    f.celdas.forEach((x, i) => {
      const cel = row.getCell(i + 1);
      cel.style = clonar(x.style);
      if (x.value != null && !(typeof x.value === 'object' && x.value.formula)) cel.value = x.value;
    });
  });
  mergesPie.forEach((m) => ws.mergeCells(m.top + DESPLAZA, m.left, m.bottom + DESPLAZA, m.right));

  // 5) Cuadro de jeringas (M:Q) fuera, y la hoja lista para Carta.
  for (let r = 1; r <= FIN_VIEJO + DESPLAZA + 3; r++) {
    for (let c = 13; c <= COLS; c++) { const cel = ws.getRow(r).getCell(c); cel.value = null; cel.style = {}; }
  }
  for (let c = 13; c <= COLS; c++) ws.getColumn(c).hidden = true;
  ws.pageSetup.printArea = 'A1:K77';
  ws.pageSetup.paperSize = 1;
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 1;
  ws.pageSetup.horizontalCentered = true;
  ws.views = [{ state: 'normal', zoomScale: 55, zoomScaleNormal: 55, showGridLines: false }];

  // 6) Una sola hoja: sin fórmulas 3D quedan sin referencias.
  wb.worksheets.filter((w) => w.id !== ws.id).map((w) => w.id).forEach((id) => wb.removeWorksheet(id));
  ws.name = 'GENERAL';
  await wb.xlsx.writeFile(DESTINO);
  console.log('Plantilla escrita:', DESTINO);
})();
