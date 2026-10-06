// Distribución de rutas (requisiciones_rutas_excel.js): GENERAL + RUTA 1/2/3 + CARAVANAS,
// columnas de influenza dinámicas (una por entrega con influenza) y rutas con fórmulas hacia GENERAL.
const { test, expect } = require('@playwright/test');
const ExcelJS = require('exceljs');
const { armarModelo, generar, RUTAS } = require('../requisiciones_rutas_excel.js');

const CODIGOS = ['6508', '148', '150', '6135', '2526', '6187', '3800', '3801', '3805', '3808', '3810', '6056', '3820', '3821', '6317', '3832', '6501', '2', '6502', '6506', '6509'];
const catalogo = CODIGOS.map((c) => ({ id: 'b' + c, codigo_articulo: c, nombre: 'V' + c }));
const todas = [].concat(...RUTAS.map((r) => r.clues)).concat(['QTSSA001863']);
// CLUES en desorden a propósito: el modelo debe ordenarlas por CLUES.
const unidades = todas.slice().reverse().map((c, i) => ({ id: 'u' + c, clues: c, nombre: 'UNIDAD ' + c.slice(-6) }));
const E1 = { id: 'r1', entrega: 1, etiqueta: null }, E2 = { id: 'r2', entrega: 2, etiqueta: 'Influenza 1er entrega' }, E3 = { id: 'r3', entrega: 3, etiqueta: 'Influenza 2da' };
const f = (r, c, u, n) => ({ requisicion_id: r, unidad_id: 'u' + u, requi_biologico_id: 'b' + c, cantidad: n });
const filas = [
  f('r1', '6508', 'QTSSA001810', 10), f('r1', '6502', 'QTSSA001810', 4), f('r1', '6506', 'QTSSA001863', 6), f('r1', '3821', 'QTSSA001810', 99),
  f('r2', '6317', 'QTSSA001810', 100), f('r2', '6317', 'QTSSA012923', 50), f('r3', '6317', 'QTSSA001810', 25)
];

async function abrir(buffer) { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); return wb; }
const encabezados = (ws) => ws.getRow(4).values.slice(1);

test('una sola entrega con influenza: una columna INFLU; sin influenza: ninguna', async () => {
  const m = armarModelo({ unidades, catalogo, entregas: [E1, E2], filas, unificar: true });
  expect(m.columnas.map((c) => c.titulo)).toEqual(['NEU20', 'NEU13', 'ROTA', 'HEXA', 'HB M', 'HA U', 'SR', 'BCG', 'DPT', 'TDPA', 'TD', 'VAR', 'SRP', 'INFLU', 'VPH', 'COVID\nMOD', 'COVID\nPFI', 'VSR']);
  expect(armarModelo({ unidades, catalogo, entregas: [E1], filas }).columnas.some((c) => c.grupo === 'influenza')).toBe(false);
  expect(m.ignorados).toEqual({ 3821: 99 });
});

test('varias entregas de influenza: una columna por entrega, numeradas', async () => {
  const m = armarModelo({ unidades, catalogo, entregas: [E1, E2, E3], filas, unificar: true });
  expect(m.columnas.filter((c) => c.grupo === 'influenza').map((c) => c.titulo)).toEqual(['INFLU 1', 'INFLU 2']);
});

test('libro: 5 hojas, GENERAL en orden de CLUES, rutas con fórmulas hacia GENERAL', async () => {
  const m = armarModelo({ unidades, catalogo, entregas: [E1, E2], filas, unificar: true });
  const { buffer } = await generar(m, { mesLabel: 'OCTUBRE', anio: 2026, ExcelJSLib: ExcelJS });
  const wb = await abrir(buffer);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['GENERAL', 'RUTA 1', 'RUTA 2', 'RUTA 3', 'CARAVANAS']);
  const g = wb.getWorksheet('GENERAL');
  expect(g.getCell('A5').value).toBe('UNIDAD 001764');
  expect(g.getCell('A40').value).toBe('UNIDAD 013034');   // Tlacote al final por CLUES
  const r1 = wb.getWorksheet('RUTA 1');
  expect(r1.getCell('A5').value).toBe('UNIDAD 001810');
  expect(r1.getCell('B5').value.formula).toMatch(/^IF\(GENERAL!B\d+=0,"",GENERAL!B\d+\)$/);
  const fila = Number(/GENERAL!B(\d+)/.exec(r1.getCell('B5').value.formula)[1]);
  expect(g.getCell(`A${fila}`).value).toBe('UNIDAD 001810');
  expect(g.getCell(`B${fila}`).value).toBe(10);
  expect(wb.getWorksheet('CARAVANAS').rowCount).toBeGreaterThan(14);
});
