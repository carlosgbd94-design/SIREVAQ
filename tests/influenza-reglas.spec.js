// Reglas de calendario de las dosis de Influenza (influenza_reglas.js) y su aplicación en la captura de la unidad.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const R = require('../influenza_reglas.js');

const INI = '2025-10-03';
const FIN = '2026-04-25';

test('ventanas: 2ª dosis desde inicio + 1 mes, 1ª dosis hasta fin − 1 mes', () => {
  expect(R.ventanas(INI, FIN)).toEqual({ segundasDesde: '2025-11-03', primerasHasta: '2026-03-25' });
  expect(R.sumaMeses('2026-01-31', 1)).toBe('2026-02-28');
  expect(R.sumaMeses('2026-05-31', -1)).toBe('2026-04-30');
});

test('2ª dosis bloqueada en el 1er mes; 1ª dosis bloqueada en el último; lo demás libre', () => {
  const b = (g, f) => !!R.reglaDosis(g, f, INI, FIN);
  expect(b('Segunda dosis', '2025-10-03')).toBe(true);
  expect(b('Segunda dosis', '2025-10-31')).toBe(true);
  expect(b('Segunda dosis', '2025-11-07')).toBe(false);
  expect(b('Primera dosis', '2025-10-03')).toBe(false);
  expect(b('Primera dosis', '2026-03-20')).toBe(false);
  expect(b('Primera dosis', '2026-03-27')).toBe(true);
  expect(b('Primera dosis', '2026-04-24')).toBe(true);
  expect(b('Revacunación', '2025-10-03')).toBe(false);
  expect(b('Diabetes mellitus', '2026-04-24')).toBe(false);
  expect(R.reglaDosis('Segunda dosis', '2025-10-03', INI, FIN).etiqueta).toBe('Desde 3 nov');
});

test('si se extiende la clausura, la fecha límite de 1ª dosis se recorre', () => {
  expect(!!R.reglaDosis('Primera dosis', '2026-03-27', INI, FIN)).toBe(true);
  expect(!!R.reglaDosis('Primera dosis', '2026-03-27', INI, '2026-05-30')).toBe(false);
});

// ─── Captura de la unidad ───────────────────────────────────────────────────
const raiz = path.join(__dirname, '..');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8');
const rubros = modulo.slice(modulo.indexOf('const INFLUENZA_RUBROS'), modulo.indexOf('];', modulo.indexOf('const INFLUENZA_RUBROS')) + 2);
const reglasFn = modulo.slice(modulo.indexOf('// Regla de calendario (2ª dosis'), modulo.indexOf('function renderCaptureGrid() {'));
const gridFn = modulo.slice(modulo.indexOf('function renderCaptureGrid() {'), modulo.indexOf('function updateFlaskCalculation() {'));
const saveFn = modulo.slice(modulo.indexOf('async function saveInfluenzaReport() {'), modulo.indexOf('// --- LÓGICA DE ADMINISTRACIÓN Y MUNICIPIOS ---'));

async function montarCaptura(page, fecha, valoresGuardados) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate((f) => {
    document.body.innerHTML = '<div id="influenzaCaptureGroupsContainer"></div><input id="influenza_semana" value="' + f + '">'
      + '<input id="nombreINFLUENZA" value="Enf. Prueba"><input id="influenza_campana" value="2025-2026">';
  }, fecha);
  await page.addScriptTag({ path: path.join(raiz, 'influenza_reglas.js') });
  const capturas = JSON.stringify(valoresGuardados ? [{ fecha, valores: valoresGuardados }] : []);
  await page.addScriptTag({
    content: [
      `var _campaignConfig = { fecha_inicio: '${INI}', fecha_fin: '${FIN}' };`,
      'var _influenzaMetasCache = { r1: 100, r2: 100, r6: 100, r7: 100, r16: 100 };',
      `var _influenzaCapturasCache = ${capturas};`,
      "var USER = { clues: 'C1', unidad: 'U', municipio: 'QUERETARO' };",
      'window.__toasts = []; var showToast = (m) => window.__toasts.push(m);',
      'window.__guardados = [];',
      'var AppService = { call: async (a, p) => { window.__guardados.push([a, p]); return { ok: true }; }, runCapture: async (o) => o.action() };',
      'var loadInfluenzaUnitData = async () => {}; var updateInfluenzaWeekBtnLabel = () => {}; var updateInfluenzaSinMovimientoUI = () => {};',
      'var loadInfluenzaHistoryList = () => {};',
      'var RealDate = Date; Date = class extends RealDate { getDay() { return 5; } };   // la captura solo se permite jueves/viernes'
    ].join('\n')
  });
  await page.addScriptTag({ content: rubros + reglasFn + gridFn + saveFn + 'window.__grid = renderCaptureGrid; window.__save = saveInfluenzaReport;' });
  await page.evaluate(() => window.__grid());
}

test('Captura de unidad, 1er mes: la 2ª dosis queda bloqueada y avisa desde cuándo', async ({ page }) => {
  await montarCaptura(page, '2025-10-17');
  await expect(page.locator('#input_inf_r6')).toBeDisabled();                   // 2ª dosis con meta, pero 1er mes
  await expect(page.locator('#input_inf_r1')).toBeEnabled();                    // 1ª dosis libre
  await expect(page.locator('#input_inf_r3')).toBeDisabled();                   // sin meta
  await expect(page.locator('.inf-aviso')).toContainText('2ª dosis no disponible');
  await expect(page.locator('.inf-aviso')).toContainText('3 nov 2025');
  await expect(page.locator('.inf-pill-regla').first()).toHaveText('Desde 3 nov');
});

test('Captura de unidad, último mes: la 1ª dosis queda bloqueada y la 2ª libre', async ({ page }) => {
  await montarCaptura(page, '2026-04-10');
  await expect(page.locator('#input_inf_r1')).toBeDisabled();
  await expect(page.locator('#input_inf_r6')).toBeEnabled();
  await expect(page.locator('.inf-aviso')).toContainText('1ª dosis no disponible');
  await expect(page.locator('.inf-aviso')).toContainText('25 mar 2026');
});

test('Captura de unidad: mitad de temporada sin avisos y el guardado respeta la meta', async ({ page }) => {
  await montarCaptura(page, '2026-01-16');
  await expect(page.locator('.inf-aviso')).toHaveCount(0);
  await page.fill('#input_inf_r1', '120');                                      // rebasa la meta de 100
  await page.evaluate(() => window.__save());
  expect(await page.evaluate(() => window.__guardados.length)).toBe(0);
  await page.fill('#input_inf_r1', '40');
  await page.evaluate(() => window.__save());
  expect(await page.evaluate(() => window.__guardados.length)).toBe(1);
});

test('Guardado: aunque se fuerce el campo, el 1er mes no admite 2ª dosis (ni rubros sin meta)', async ({ page }) => {
  await montarCaptura(page, '2025-10-17');
  await page.evaluate(() => { const i = document.getElementById('input_inf_r6'); i.disabled = false; i.value = '5'; });
  await page.evaluate(() => window.__save());
  expect(await page.evaluate(() => window.__guardados.length)).toBe(0);
  expect(await page.evaluate(() => window.__toasts.at(-1))).toContain('2ª dosis');
  await page.evaluate(() => { document.getElementById('input_inf_r6').value = '0'; const i = document.getElementById('input_inf_r3'); i.disabled = false; i.value = '5'; });
  await page.evaluate(() => window.__save());
  expect(await page.evaluate(() => window.__toasts.at(-1))).toContain('no tiene meta');
});

test('Un valor ya guardado en un rubro bloqueado no impide volver a guardar el reporte', async ({ page }) => {
  await montarCaptura(page, '2025-10-17', { r6: 7 });
  await page.evaluate(() => window.__save());
  expect(await page.evaluate(() => window.__guardados.length)).toBe(1);
});
