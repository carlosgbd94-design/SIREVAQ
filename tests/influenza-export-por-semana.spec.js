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
const iw = modulo.indexOf('function writeUnitDataColumns');
const escritor = modulo.slice(iw, modulo.indexOf('\n}\n', iw) + 3);
const estilos = corta('function applyPremiumStyles', 'async function exportWeeklyMonthlyUnitExcel');
const PLANTILLA = fs.readFileSync(path.join(raiz, 'Formatos', 'PLANTILLA, CONCENTRADO DE INFLUENZA CON UNIDADES O MUNICIPIOS.xlsx'));

function montar(valores) {
  const descargas = [];
  const ctx = {
    ExcelJS, console, fetch: async () => ({ ok: true, arrayBuffer: async () => PLANTILLA }), PLANTILLA, encodeURI, Blob: function (partes) { this.partes = partes; }, URL: { createObjectURL: (b) => { descargas.push(b); return 'blob:x'; } },
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
  vm.runInContext(rubros + '\n' + ayudas + '\n' + estilos + '\n' + escritor + '\n' + porSemana, ctx);
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

test('Concentrado por semana sobre la plantilla oficial: un grupo (Logro, Meta, %) por semana y el total del rango', async () => {
  const { ctx, descargas } = montar({ adminInfluenzaSemanaInicio: '2026-10-23', adminInfluenzaSemanaFin: '2026-10-30', adminInfluenzaExportScope: 'muni_selected', adminInfluenzaMuni: 'QUERETARO' });
  await vm.runInContext('exportConcentradoPorSemanaExcel()', ctx);
  expect(descargas.nombre).toBe('Concentrado_Por_Semana_Influenza_MUNICIPIO_QUERETARO_Sem43_a_Sem44.xlsx');
  const wb = await hojas(descargas);
  expect(wb.worksheets.length).toBe(1);
  const ws = wb.worksheets[0];
  expect(wb.worksheets[0].name).toBe('ANÁLIS DE META-LOGRO');                // la hoja de la plantilla oficial
  expect(String(val(ws, 4, 1))).toContain('Concentrado de información');        // encabezado institucional intacto
  expect(String(val(ws, 8, 2))).toContain('POR SEMANA');
  // grupos desde G: sem 43 = G:I, sem 44 = J:L, total = M:O
  expect(String(val(ws, 10, 7))).toContain('SEMANA 43');
  expect(String(val(ws, 10, 10))).toContain('SEMANA 44');
  expect(String(val(ws, 10, 13))).toContain('TOTAL DEL RANGO');
  expect(['LOGRO', 'META', '%']).toEqual([val(ws, 11, 7), val(ws, 11, 8), val(ws, 11, 9)]);
  expect(val(ws, 12, 7)).toBe(27);   // r1 sem 43: Q1 20 + Q2 7 (sin Corregidora, sin la sem 42)
  expect(val(ws, 12, 8)).toBe(150);  // meta Querétaro r1
  expect(val(ws, 12, 10)).toBe(30);  // r1 sem 44
  expect(val(ws, 13, 7)).toBe(5);    // r2 sem 43
  expect(val(ws, 12, 13)).toBe(57);  // total del rango r1 = 27 + 30
});

test('Una sola semana: sin grupos sobrantes de la plantilla, encabezados blancos en negrita y cifras legibles', async () => {
  const { ctx, descargas } = montar({ adminInfluenzaSemanaInicio: '2026-10-23', adminInfluenzaSemanaFin: '2026-10-23', adminInfluenzaExportScope: 'muni_selected', adminInfluenzaMuni: 'QUERETARO' });
  await vm.runInContext('exportConcentradoPorSemanaExcel()', ctx);
  const ws = (await hojas(descargas)).worksheets[0];
  expect(String(val(ws, 10, 7))).toContain('SEMANA 43');
  for (let c = 10; c <= 18; c++) for (let r = 10; r <= 59; r++) expect(val(ws, r, c) ?? null).toBeNull();
  expect(ws.getCell(10, 7).font.bold).toBe(true);
  expect(ws.getCell(10, 7).font.color.argb).toBe('FFFFFFFF');
  expect(ws.getCell(11, 8).font.color.argb).toBe('FFFFFFFF');
  expect(ws.getCell(12, 7).font.size).toBeGreaterThanOrEqual(11);
  expect(ws.pageSetup.printArea).toBe('A1:I59');
});
