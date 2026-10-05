// Exportador de requisiciones (requisiciones_export_excel.js) contra la plantilla real:
// 21 renglones del formato nuevo, pie recorrido 2 filas, una sola hoja, sin cuadro de jeringas.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

global.ExcelJS = ExcelJS;
const { generar } = require('../requisiciones_export_excel.js');

const CODIGOS = ['6508', '148', '150', '6135', '2526', '6187', '3800', '3801', '3805', '3808', '3810',
  '6056', '3820', '3821', '6317', '3832', '6501', '2', '6502', '6506', '6509'];
const catalogo = CODIGOS.map((c, i) => ({ id: 'b' + c, orden: i + 1, nombre: 'V' + c, clave_articulo: 'CL-' + c, codigo_articulo: c }));
const plantillaBuffer = fs.readFileSync(path.join(__dirname, '..', 'requisiciones_plantilla.xlsx'));
const base = {
  plantillaBuffer, catalogo,
  encabezado: { destinoNombre: 'C.S JURICA', destinoDireccion: 'Privada Lirios S/N', mesLabel: 'OCTUBRE' },
  firmas: { elaboro_nombre: 'ELA', autorizo_nombre: 'AUT', entrega_nombre: 'ENT', recibe_nombre: 'REC' }
};

async function abrir(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

test('la plantilla trae los 21 renglones del formato nuevo en una sola hoja', async () => {
  const wb = await abrir(plantillaBuffer);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['GENERAL']);
  const ws = wb.getWorksheet('GENERAL');
  catalogo.forEach((b) => expect(String(ws.getCell(`B${12 + 2 * b.orden}`).value)).toBe(b.codigo_articulo));
  expect(ws.getCell('C14').value).toMatch(/NEUMOCOCCICA 20/);
});

test('exporta cantidades, lotes y firmas en las filas nuevas, sin cuadro de jeringas', async () => {
  const filas = {
    b6506: [{ cantidad: 40, numeroLote: 'PF1', caducidad: '2027-03-31' }],
    b6509: [{ cantidad: 5, numeroLote: 'MK3145', caducidad: '2027-08-31' }, { cantidad: 2, numeroLote: 'MK9', caducidad: '2027-09-30' }]
  };
  const { buffer, sobrantes, sinRenglon } = await generar({ ...base, filasPorBiologico: filas });
  expect(sobrantes).toEqual([]);
  expect(sinRenglon).toEqual([]);
  const ws = (await abrir(buffer)).getWorksheet('GENERAL');
  expect(ws.getCell('F52').value).toBe(40);      // Pfizer: orden 20 -> fila 52
  expect(ws.getCell('I52').value).toBe('PF1');
  expect(ws.getCell('F54').value).toBe(7);       // VRS: orden 21 -> fila 54, F = suma de sus 2 lotes
  expect(ws.getCell('I55').value).toBe('MK9');
  expect(ws.getCell('A67').value).toBe('ELA');
  expect(ws.getCell('H67').value).toBe('AUT');
  expect(ws.getCell('A74').value).toBe('ENT');
  expect(ws.getCell('H74').value).toBe('REC');
  expect(ws.getCell('B9').value).toBe('C.S JURICA');
  expect(ws.getCell('B10').value).toBe('Privada Lirios S/N');
  for (let r = 14; r <= 20; r++) expect(ws.getCell(`M${r}`).value ?? null).toBeNull();
  expect(ws.getColumn(13).hidden).toBe(true);
  expect(ws.pageSetup.printArea).toBe('A1:K89');
});

test('un biológico fuera del formato no se escribe sobre el pie y se avisa', async () => {
  const cat = [...catalogo, { id: 'bX', orden: 22, nombre: 'VACUNA NUEVA', clave_articulo: 'X', codigo_articulo: '9' }];
  const { buffer, sinRenglon } = await generar({ ...base, catalogo: cat, filasPorBiologico: { bX: [{ cantidad: 3, numeroLote: 'L', caducidad: null }] } });
  expect(sinRenglon).toEqual(['VACUNA NUEVA']);
  const ws = (await abrir(buffer)).getWorksheet('GENERAL');
  expect(String(ws.getCell('B56').value.richText ? 'cond' : ws.getCell('B56').value)).toBe('cond');
});

test('un biológico con 3 lotes crece un renglón y baja lo de abajo (pie, firmas y sellos)', async () => {
  const filas = {
    b6135: [
      { cantidad: 60, numeroLote: 'A', caducidad: '2027-12-31' },
      { cantidad: 30, numeroLote: 'B', caducidad: '2028-01-31' },
      { cantidad: 10, numeroLote: 'C', caducidad: '2028-03-31' }
    ],
    b6509: [
      { cantidad: 3, numeroLote: 'V1', caducidad: '2027-08-31' },
      { cantidad: 1, numeroLote: 'V2', caducidad: '2027-09-30' },
      { cantidad: 1, numeroLote: 'V3', caducidad: '2027-10-31' }
    ]
  };
  const { buffer, sobrantes, sinRenglon } = await generar({ ...base, filasPorBiologico: filas });
  expect(sobrantes).toEqual([]);
  expect(sinRenglon).toEqual([]);
  const ws = (await abrir(buffer)).getWorksheet('GENERAL');
  // Hexavalente (orden 4, fila 20): 3 renglones, total 100 en la celda combinada
  expect(ws.getCell('F20').value).toBe(100);
  ['A', 'B', 'C'].forEach((l, i) => expect(ws.getCell(`I${20 + i}`).value).toBe(l));
  // El siguiente biológico (HepB, orden 5) baja 1 fila: de la 22 a la 23
  expect(String(ws.getCell('B23').value)).toBe('2526');
  // VRS (orden 21) baja 1 por Hexavalente: de la 54 a la 55, con sus 3 lotes
  expect(String(ws.getCell('B55').value)).toBe('6509');
  ['V1', 'V2', 'V3'].forEach((l, i) => expect(ws.getCell(`I${55 + i}`).value).toBe(l));
  // Pie y firmas bajan 2 (una fila por cada biológico con 3 lotes); área de impresión igual
  expect(ws.getCell('A69').value).toBe('ELA');
  expect(ws.getCell('A76').value).toBe('ENT');
  expect(ws.pageSetup.printArea).toBe('A1:K91');
  expect(ws.getCell('A55').master.address).toBe('A55');
  expect(ws.getCell('A57').master.address).toBe('A55');
});

test('un municipio sale en UN libro: una pestaña por unidad y la municipal al final', async () => {
  const { generarLibro } = require('../requisiciones_export_excel.js');
  const hoja = (nombreHoja, destino, filas) => ({
    nombreHoja, catalogo, filasPorBiologico: filas,
    encabezado: { destinoNombre: destino, destinoDireccion: 'dir ' + destino, mesLabel: 'OCTUBRE' },
    firmas: { elaboro_nombre: 'ELA' }
  });
  const { buffer, sinRenglon } = await generarLibro({
    plantillaBuffer,
    hojas: [
      hoja('JURICA', 'C.S JURICA', { b6509: [{ cantidad: 5, numeroLote: 'U1', caducidad: '2027-08-31' }] }),
      hoja('MENCHACA / NORTE: [x]', 'C.S MENCHACA', { b6509: [{ cantidad: 3, numeroLote: 'U2', caducidad: null }, { cantidad: 2, numeroLote: 'U3', caducidad: null }, { cantidad: 1, numeroLote: 'U4', caducidad: null }] }),
      hoja('MENCHACA / NORTE: [x]', 'C.S REPETIDA', {}),
      hoja('MUNICIPAL', 'MUNICIPIO QUERÉTARO', { b6509: [{ cantidad: 11, numeroLote: 'M1', caducidad: '2027-08-31' }] })
    ]
  });
  expect(sinRenglon).toEqual([]);
  const wb = await abrir(buffer);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['JURICA', 'MENCHACA NORTE x', 'MENCHACA NORTE x (2)', 'MUNICIPAL']);   // únicos y válidos; la municipal, al final
  expect(wb.worksheets.every((w) => w.state === 'visible')).toBe(true);
  const [u1, u2, u3, mun] = wb.worksheets;
  expect(u1.getCell('B9').value).toBe('C.S JURICA');
  expect(u1.getCell('I54').value).toBe('U1');
  expect(u2.getCell('B9').value).toBe('C.S MENCHACA');
  expect(u2.getCell('I56').value).toBe('U4');                 // 3 lotes: la hoja crece sin afectar a las demás
  expect(u2.pageSetup.printArea).toBe('A1:K90');
  expect(u1.pageSetup.printArea).toBe('A1:K89');
  expect(u3.getCell('B9').value).toBe('C.S REPETIDA');
  expect(u3.getCell('I54').value ?? null).toBeNull();         // cada hoja arranca limpia
  expect(mun.getCell('B9').value).toBe('MUNICIPIO QUERÉTARO');
  expect(mun.getCell('I54').value).toBe('M1');
  wb.worksheets.forEach((w) => expect(w.getImages().length).toBe(2));   // los dos logos en cada pestaña
});

test('varios biológicos con varios lotes a la vez (primero, de en medio y último) no se pisan entre sí', async () => {
  const lotes = (n, pref) => Array.from({ length: n }, (_, i) => ({ cantidad: i + 1, numeroLote: `${pref}${i + 1}`, caducidad: '2027-12-31' }));
  const { buffer } = await generar({ ...base, filasPorBiologico: { b6508: lotes(4, 'A'), b2526: lotes(3, 'B'), b6509: lotes(5, 'C') } });
  const ws = (await abrir(buffer)).getWorksheet('GENERAL');
  // extras: +2 (orden 1), +1 (orden 5), +3 (orden 21) = 6 filas más
  for (let i = 0; i < 4; i++) expect(ws.getCell(`I${14 + i}`).value).toBe(`A${i + 1}`);
  expect(ws.getCell('F14').value).toBe(10);                                  // 1+2+3+4
  expect(String(ws.getCell('B24').value)).toBe('2526');                       // HepB bajó 2
  for (let i = 0; i < 3; i++) expect(ws.getCell(`I${24 + i}`).value).toBe(`B${i + 1}`);
  expect(String(ws.getCell('B57').value)).toBe('6509');                       // VRS bajó 3 (2+1)
  for (let i = 0; i < 5; i++) expect(ws.getCell(`I${57 + i}`).value).toBe(`C${i + 1}`);
  expect(ws.getCell('A73').value).toBe('ELA');                                // firmas: 67 + 6
  expect(ws.getCell('A80').value).toBe('ENT');                                // 74 + 6
  expect(ws.pageSetup.printArea).toBe('A1:K95');                              // 89 + 6
  // Entre bloques no se perdió ningún biológico: todos los códigos siguen en orden
  const codigos = [];
  ws.eachRow((fila, n) => { const c = fila.getCell('B'); if (n >= 14 && n <= 62 && c.master.address === c.address && /^\d+$/.test(String(c.value))) codigos.push(String(c.value)); });
  expect(codigos).toEqual(CODIGOS);
});

test('los nombres de pestaña son válidos aunque la unidad traiga caracteres raros, sea larguísima o se repita', async () => {
  const { generarLibro } = require('../requisiciones_export_excel.js');
  const hoja = (nombreHoja) => ({ nombreHoja, catalogo, filasPorBiologico: {}, encabezado: {}, firmas: {} });
  const largo = 'C.S SAN MIGUEL LÁZARO CÁRDENAS (EL COLORADO) ANEXO';
  const { buffer } = await generarLibro({ plantillaBuffer, hojas: [hoja(largo), hoja(largo), hoja('A/B\C?D*E[F]G:H'), hoja(''), hoja(undefined)] });
  const nombres = (await abrir(buffer)).worksheets.map((w) => w.name);
  expect(nombres).toHaveLength(5);
  expect(new Set(nombres.map((n) => n.toUpperCase())).size).toBe(5);          // únicos
  nombres.forEach((n) => { expect(n.length).toBeLessThanOrEqual(31); expect(n).not.toMatch(/[\/?*[\]:]/); expect(n.trim()).not.toBe(''); });
});
