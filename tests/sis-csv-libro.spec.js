// El "CSV para estadística" sale como libro de Excel: una pestaña por unidad (NOMBRE_CLUES), ordenadas por CLUES,
// con las columnas CLUES, VARIABLE, VALOR, MES, AÑO, MUNICIPIO.
const { test, expect } = require('@playwright/test');
const path = require('path');

test('libro SIS: una pestaña por CLUES, ordenadas y con nombre válido de Excel', async () => {
  global.window = {};
  delete require.cache[require.resolve('../sis_csv.js')];
  require('../sis_csv.js');
  window.ExcelJS = require('exceljs');
  const S = window.SIS_CSV;
  const f = (c, v, val = 0) => ({ CLUES: c, VARIABLE: v, VALOR: val, MES: 9, 'AÑO': 2026, MUNICIPIO: 'QUERÉTARO' });
  const wb = await S.aLibro(
    [f('QTSSA001793', 'VBC02'), f('QTSSA001764', 'VBC01'), f('QTSSA001793', 'BIO50', 4)],
    { QTSSA001793: 'JURICA', QTSSA001764: 'Unidad Muy Larga de Salud Núm. 1' });
  expect(wb.worksheets.map((w) => w.name)).toEqual(['UNIDAD_MUY_LARGA_DE_QTSSA001764', 'JURICA_QTSSA001793']);
  wb.worksheets.forEach((w) => expect(w.name.length).toBeLessThanOrEqual(31));
  const ws = wb.worksheets[1];
  expect(ws.getRow(1).values.slice(1)).toEqual(S.HEADERS);
  expect(ws.getRow(2).values.slice(1)).toEqual(['QTSSA001793', 'BIO50', 4, 9, 2026, 'QUERÉTARO']);
  expect(ws.rowCount).toBe(3);
});

test('filasDeMunicipio pide por bloques: un municipio de varias unidades no se corta en 1000 filas', async () => {
  global.window = {};
  delete require.cache[require.resolve('../sis_csv.js')];
  require('../sis_csv.js');
  // 5 unidades x 422 claves = 2110 filas; el servidor (PostgREST) solo entrega 1000 por respuesta
  const todas = [];
  for (let u = 0; u < 5; u++) for (let v = 0; v < 422; v++) todas.push({ clues: 'QTSSA00' + (1000 + u), municipio: 'CORREGIDORA', variable_sis: 'V' + String(v).padStart(4, '0'), valor: 0 });
  const db = { rpc: () => ({ range: async (a, b) => ({ data: todas.slice(a, b + 1), error: null }) }) };
  const filas = await window.SIS_CSV.filasDeMunicipio(db, 'CORREGIDORA', 10, 2026);
  expect(filas.length).toBe(2110);
  expect(new Set(filas.map((f) => f.CLUES)).size).toBe(5);
});
