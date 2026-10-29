// Exportes de Influenza: respetan las semanas elegidas en el panel y el «Concentrado por semana» trae una columna por semana.
// Sin navegador: se evalúa el bloque de influenza_module.js en Node con ExcelJS real y el DOM/descarga simulados.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const raiz = path.join(__dirname, '..');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8').replace(/\r\n/g, '\n');
const corta = (a, b) => modulo.slice(modulo.indexOf(a), modulo.indexOf(b));
const i0 = modulo.indexOf('const INFLUENZA_RUBROS');
const rubros = modulo.slice(i0, modulo.indexOf('];', i0) + 2).replace('const INFLUENZA_RUBROS', 'var INFLUENZA_RUBROS');
const ayudas = corta('let _exportRango = null;', '// 2. PLANTILLA 2');
const porSemana = corta('// 4. CONCENTRADO POR SEMANA CAPTURADA', '// Helper para escribir un grupo de 3 columnas');

function montar(valores) {
  const descargas = [];
  const ctx = {
    ExcelJS, console, Blob: function (partes) { this.partes = partes; }, URL: { createObjectURL: (b) => { descargas.push(b); return 'blob:x'; } },
    document: {
      getElementById: (id) => ({ value: valores[id] }),
      createElement: () => ({ click() {}, set download(v) { descargas.nombre = v; } }),
      body: { appendChild() {}, removeChild() {} }
    },
    USER: { rol: 'ADMIN', municipio: 'QUERETARO' },
    showToast() {},
    generateCampaignWeeks: () => [
      { semana: 42, fecha: '2026-10-16', label: 'Semana 42 (12 al 18 oct)' },
      { semana: 43, fecha: '2026-10-23', label: 'Semana 43 (19 al 25 oct)' },
      { semana: 44, fecha: '2026-10-30', label: 'Semana 44 (26 oct al 1 nov)' }],
    influenzaRangoTexto: (f) => f, campaignSeasonLabel: () => '2026-2027', infMuniEtiqueta: (m) => m,
    _allUnidades: [
      { clues: 'Q2', unidad: 'DOS', municipio: 'QUERETARO' }, { clues: 'Q1', unidad: 'UNO', municipio: 'QUERETARO' },
      { clues: 'C1', unidad: 'COR', municipio: 'CORREGIDORA' }],
    _adminMetasArray: [
      { clues: 'Q1', metas: { r1: 100 } }, { clues: 'Q2', metas: { r1: 50 } }, { clues: 'C1', metas: { r1: 40 } }],
    _adminCapturasArray: [
      { clues: 'Q1', fecha: '2026-10-16', valores: { r1: 10 } },
      { clues: 'Q1', fecha: '2026-10-23', valores: { r1: 20, r2: 5 } },
      { clues: 'Q2', fecha: '2026-10-23', valores: { r1: 7 } },
      { clues: 'Q1', fecha: '2026-10-30', valores: { r1: 30 } },
      { clues: 'C1', fecha: '2026-10-23', valores: { r1: 99 } }]
  };
  vm.createContext(ctx);
  vm.runInContext(rubros + '\n' + ayudas + '\n' + porSemana, ctx);
  return { ctx, descargas };
}

async function hojas(descargas) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await descargas[0].partes[0]));
  return wb;
}
const val = (ws, r, c) => { const v = ws.getCell(r, c).value; return v && v.result !== undefined ? v.result : v; };

test('el rango del panel acota los reportes y marca el nombre del archivo', () => {
  const { ctx } = montar({ adminInfluenzaSemanaInicio: '2026-10-23', adminInfluenzaSemanaFin: '2026-10-23' });
  vm.runInContext('_exportRango = infRangoExport()', ctx);
  expect(vm.runInContext("capEnRangoExport({ fecha: '2026-10-16' })", ctx)).toBe(false);
  expect(vm.runInContext("capEnRangoExport({ fecha: '2026-10-23' })", ctx)).toBe(true);
  expect(vm.runInContext('sufijoRangoExport()', ctx)).toBe('_Sem43_a_Sem43');
  expect(vm.runInContext('textoRangoExport()', ctx)).toContain('SEMANAS: 43 A 43');
  // toda la temporada: sin sufijo ni leyenda
  const t = montar({ adminInfluenzaSemanaInicio: '2026-10-16', adminInfluenzaSemanaFin: '2026-10-30' });
  vm.runInContext('_exportRango = infRangoExport()', t.ctx);
  expect(vm.runInContext('sufijoRangoExport()', t.ctx)).toBe('');
  expect(vm.runInContext('textoRangoExport()', t.ctx)).toBe('');
});

test('Concentrado por semana: una columna por semana, solo las del rango, y los totales cuadran', async () => {
  const { ctx, descargas } = montar({ adminInfluenzaSemanaInicio: '2026-10-23', adminInfluenzaSemanaFin: '2026-10-30', adminInfluenzaExportScope: 'muni_selected', adminInfluenzaMuni: 'QUERETARO' });
  await vm.runInContext('exportConcentradoPorSemanaExcel()', ctx);
  expect(descargas.nombre).toBe('Concentrado_Por_Semana_Influenza_MUNICIPIO_DE_QUERETARO_Sem43_a_Sem44.xlsx');
  const wb = await hojas(descargas);
  const r = wb.getWorksheet('Por rubro');
  // columnas: 1 grupo, 2 edad, 3 = sem 43, 4 = sem 44, 5 total, 6 meta, 7 %
  expect(String(val(r, 4, 3))).toContain('Semana 43');
  expect(String(val(r, 4, 4))).toContain('Semana 44');
  expect(val(r, 5, 3)).toBe(27);   // r1 sem 43: Q1 20 + Q2 7 (no entra Corregidora ni la sem 42)
  expect(val(r, 5, 4)).toBe(30);   // r1 sem 44
  expect(val(r, 6, 3)).toBe(5);    // r2 sem 43
  const u = wb.getWorksheet('Por unidad');
  expect(val(u, 5, 1)).toBe('Q1');  // ordenadas por CLUES
  expect(val(u, 6, 1)).toBe('Q2');
  expect(val(u, 5, 3)).toBe(25);    // Q1 sem 43 = 20 + 5
  expect(val(u, 5, 4)).toBe(30);
  expect(val(u, 6, 4)).toBe(null);  // Q2 no reportó la sem 44
  expect(val(u, 5, 6)).toBe(100);   // meta de Q1
});
