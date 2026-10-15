// Exportación de metas de COVID-19 (Formatos/Metas COVID-19 plantilla.xlsx, sacada de «METAS POR UNIDAD DE SALUD»
// del formato de la temporada invernal). No necesita navegador: arma los libros con ExcelJS en Node.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const raiz = path.join(__dirname, '..');
const X = require(path.join(raiz, 'covid_metas_export.js'));
const plantilla = fs.readFileSync(path.join(raiz, 'Formatos', 'Metas COVID-19 plantilla.xlsx'));

const meta = (clues, municipio, m) => ({ clues, municipio, metas: m });
const unidad = (clues, nombre, municipio) => ({ clues, unidad: nombre, municipio });
const construir = (muni, metas, unidades, extra = {}) => X.construirLibroCovid({ ExcelJS, plantilla, muni, campana: '2026-2027', metas, unidades, ...extra });

test('Municipio: una columna por unidad con meta, TOTAL al final y los renglones de la plantilla', async () => {
  const unidades = [unidad('Q1', 'UMQ UNO', 'QUERETARO'), unidad('Q2', 'UMQ DOS', 'QUERETARO'), unidad('Q3', 'SIN META', 'QUERETARO'),
    unidad('C1', 'OTRO MUNICIPIO', 'CORREGIDORA')];
  const metas = [
    meta('Q1', 'QUERETARO', { c1: 100, c2: 100, c3: 50, c4: 150, c5: 10, c6: 15 }),
    meta('Q2', 'QUERETARO', { c1: 40, c2: 40, c3: 20, c4: 60 }),
    meta('C1', 'CORREGIDORA', { c3: 99 })
  ];
  const wb = await construir('QUERETARO', metas, unidades);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS COVID-19']);
  const ws = wb.worksheets[0];
  expect(ws.getCell('H10').value).toBe('UMQ DOS');            // orden alfabético
  expect(ws.getCell('I10').value).toBe('UMQ UNO');
  expect(ws.getCell('J10').value).toBe('TOTAL');
  expect(ws.getCell('H11').value).toBe(40);
  expect(ws.getCell('I11').value).toBe(100);
  expect(ws.getCell('H15').value).toBeNull();                  // sin meta en embarazadas: celda vacía
  expect(ws.getCell('J11').value.formula).toBe('SUM(H11:I11)');
  expect(ws.getCell('I17').value.formula).toBe('SUM(I11:I16)');
  expect(ws.getCell('I18').value.formula).toBe('((I11+I12)/2)+I13+I14+I15+I16');
  expect(ws.getCell('J18').value.formula).toBe('((J11+J12)/2)+J13+J14+J15+J16');
  // La unidad sin meta y la de otro municipio no salen; no quedan columnas vacías antes del TOTAL
  expect(ws.getCell('K10').value).toBeNull();
  // Encabezado de la plantilla
  expect(ws.getCell('D6').value).toBe('QUERÉTARO');
  expect(ws.getCell('G6').value).toBe('QUERÉTARO');
  expect(ws.getCell('G7').value).toBe(1);
  expect(String(ws.getCell('B5').value)).toContain('2026-2027');
  // Los rubros de la plantilla
  expect(String(ws.getCell('F11').value)).toContain('Primera (0.25 mL)');
  expect(String(ws.getCell('D16').value)).toBe('Personal de salud');
  expect(String(ws.getCell('C18').value)).toContain('TOTAL DOSIS POR APLICAR (0.5 mL)');
});

test('Más de 20 unidades: continúan en una hoja (2) con su propio TOTAL', async () => {
  const unidades = []; const metas = [];
  for (let i = 1; i <= 25; i++) {
    unidades.push(unidad('Q' + i, 'UNIDAD ' + String(i).padStart(2, '0'), 'QUERETARO'));
    metas.push(meta('Q' + i, 'QUERETARO', { c1: i, c2: i, c3: 1, c4: 1, c5: 1, c6: 1 }));
  }
  const wb = await construir('QUERETARO', metas, unidades);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS COVID-19', 'METAS COVID-19 (2)']);
  expect(wb.worksheets[0].getCell('AB10').value).toBe('TOTAL');      // H..AA = 20 unidades, TOTAL en AB
  const seg = wb.worksheets[1];
  expect(seg.getCell('H10').value).toBe('UNIDAD 21');
  expect(seg.getCell('L10').value).toBe('UNIDAD 25');               // 5 unidades: H..L, TOTAL en M
  expect(seg.getCell('M10').value).toBe('TOTAL');
});

test('Hospitales: archivo propio con la meta de su destino (HENM y NHGQ)', async () => {
  const unidades = [unidad('QTSSA001740', 'HENM', 'QUERETARO'), unidad('QTSSA002901', 'NHGQ', 'QUERETARO')];
  const metas = [meta(null, 'HENM', { c3: 50, c4: 100, c6: 10 }), meta(null, 'NHG', { c3: 30, c4: 60, c6: 5 })];
  const wb = await construir('HOSPITALES', metas, unidades);
  const ws = wb.worksheets[0];
  expect(ws.getCell('H10').value).toBe('NHGQ');
  expect(ws.getCell('I10').value).toBe('HENM');
  expect(ws.getCell('H13').value).toBe(30);
  expect(ws.getCell('I14').value).toBe(100);
  expect(ws.getCell('G6').value).toBe('HOSPITALES (QUERÉTARO)');
});

test('Una sola unidad: solo su columna (sin TOTAL) y con su nombre; sin meta no genera archivo', async () => {
  const unidades = [unidad('Q1', 'UMQ UNO', 'QUERETARO'), unidad('Q2', 'UMQ DOS', 'QUERETARO')];
  const metas = [meta('Q1', 'QUERETARO', { c1: 100, c2: 100, c3: 50, c4: 150, c5: 10, c6: 15 })];
  const wb = await construir('QUERETARO', metas, unidades, { soloClues: 'Q1', unidadEtiqueta: 'UMQ UNO' });
  const ws = wb.worksheets[0];
  expect(ws.getCell('H10').value).toBe('UMQ UNO');
  expect(ws.getCell('I10').value).toBeNull();                        // una unidad: sin TOTAL
  expect(ws.getCell('D7').value).toBe('UMQ UNO');
  expect(ws.getCell('H11').value).toBe(100);
  await expect(construir('QUERETARO', metas, unidades, { soloClues: 'Q2' })).rejects.toThrow(/no tiene meta/);

  // Hospital: usa la meta de su destino
  const h = await construir('HOSPITALES', [meta(null, 'HENM', { c3: 50 })], [unidad('QTSSA001740', 'HENM', 'QUERETARO')], { soloClues: 'QTSSA001740' });
  expect(h.worksheets[0].getCell('H10').value).toBe('HENM');
  expect(h.worksheets[0].getCell('H13').value).toBe(50);
});

test('El libro se puede volver a abrir y nombres de archivo', async () => {
  const wb = await construir('CORREGIDORA', [meta('C1', 'CORREGIDORA', { c3: 9 })], [unidad('C1', 'LOS ÁNGELES', 'CORREGIDORA')]);
  const datos = await X.escribirLibro(wb);
  const otro = new ExcelJS.Workbook();
  await otro.xlsx.load(datos);
  expect(otro.worksheets[0].getCell('H10').value).toBe('LOS ÁNGELES');
  expect(X.nombreArchivo('MARQUES', '2026-2027')).toBe('Metas COVID-19 El Marqués 2026-2027.xlsx');
  expect(X.nombreArchivoUnidad('C.S. UNO / Centro', '2026-2027')).toBe('Metas COVID-19 C.S. UNO Centro 2026-2027.xlsx');
});
