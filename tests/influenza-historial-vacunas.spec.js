// Historial de reportes de la unidad: Influenza y COVID-19 separados (selector, color, marca de cada reporte y cifras propias).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8').replace(/\r\n/g, '\n');
const seccion = html.slice(html.indexOf('<div id="influenzaHistorialVacuna"'), html.indexOf('<div id="influenzaHistorialList"')) + '<div id="influenzaHistorialList"></div>';
const bloque = modulo.slice(modulo.indexOf('// Vacuna que se ve en el Historial de reportes'), modulo.indexOf('/**\n * Semana de captura de la unidad.'));
const hl0 = modulo.indexOf('function _highlightInfluenzaText');
const resalta = modulo.slice(hl0, modulo.indexOf('\n}\n', hl0) + 3);

const DATOS = `
  var _campaignConfig = { fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' };
  var generateCampaignWeeks = function () { return [{ semana: 43, fecha: '2026-10-23' }, { semana: 44, fecha: '2026-10-30' }]; };
  var influenzaRangoTexto = function (f) { return f; };
  var influenzaEsCorte = function () { return false; };
  var influenzaFolio = function (r) { return r.folio || 'INF-' + r.fecha; };
  var _infTotalDosis = function (r) { return Object.values(r.valores || {}).reduce(function (s, v) { return s + Number(v || 0); }, 0); };
  var _influenzaMetasCache = { r1: 1000 };
  var _influenzaCapturasCache = [
    { fecha: '2026-10-23', folio: 'INF-A', valores: { r1: 100, r2: 20 }, capturado_por: 'ANA' },
    { fecha: '2026-10-30', folio: 'INF-B', valores: { r1: 50 }, capturado_por: 'ANA' }];
  var _covidCapturasCache = [
    { fecha: '2026-10-23', folio: 'COV-A', valores: { MODERNA: { c1: 10, c3: 5 }, PFIZER: { c3: 4 } }, capturado_por: 'ANA' }];
  var _covidPanelListo = true;
  var _eleccion = null;
  var elegirVacunaCaptura = function (v) { _eleccion = v; };
  var showToast = function () {};
`;

test('Historial: cada reporte dice su vacuna, el selector los separa y las cifras de COVID-19 van por marca', async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate((h) => {
    document.body.innerHTML = h + '<button id="subtabUnitCaptura"></button><input id="influenza_semana">';
    window.InfluenzaReglas = { fechaLarga: (x) => x };
  }, seccion);
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ content: DATOS + resalta + bloque + '\nwindow.__cargar = loadInfluenzaHistoryList;' });
  await page.evaluate(() => window.__cargar());

  // Todos: 2 de Influenza + 1 de COVID-19, cada uno con su etiqueta
  await expect(page.locator('.inf-hist-card')).toHaveCount(3);
  await expect(page.locator('.inf-hist-card--inf')).toHaveCount(2);
  await expect(page.locator('.inf-hist-card--cov')).toHaveCount(1);
  await expect(page.locator('.inf-hist-card--cov .inf-chip--vac-cov')).toHaveText(/COVID-19/);
  await expect(page.locator('.inf-hist-card--inf .inf-chip--vac-inf').first()).toHaveText(/Influenza/);
  // La tarjeta de COVID-19 desglosa Moderna / Pfizer y suma sus dosis (10 + 5 + 4)
  const cov = await page.locator('.inf-hist-card--cov').innerText();
  expect(cov).toMatch(/Moderna\s*15/);
  expect(cov).toMatch(/Pfizer\s*4/);
  expect(cov).toMatch(/19/);
  // Resumen separado por vacuna
  const resumen = await page.locator('#influenzaHistorialResumen').innerText();
  expect(resumen).toMatch(/INFLUENZA/i);
  expect(resumen).toMatch(/COVID-19/i);
  expect(resumen).toContain('reportes de Influenza');
  expect(resumen).toContain('reportes de COVID-19');
  expect(await page.locator('.inf-hist-linea').count()).toBe(2);   // una línea por vacuna, no 8 tarjetas

  // Solo COVID-19
  await page.click('[data-hv="COVID"]');
  await expect(page.locator('.inf-hist-card')).toHaveCount(1);
  await expect(page.locator('.inf-hist-card--inf')).toHaveCount(0);
  expect(await page.locator('#influenzaHistorialResumen').innerText()).not.toContain('reportes de Influenza');
  // Solo Influenza
  await page.click('[data-hv="INFLUENZA"]');
  await expect(page.locator('.inf-hist-card')).toHaveCount(2);
  await expect(page.locator('.inf-hist-card--cov')).toHaveCount(0);

  // Abrir un reporte de COVID-19 lleva a la captura de COVID-19
  await page.click('[data-hv="TODOS"]');
  await page.locator('.inf-hist-card--cov').click();
  expect(await page.evaluate(() => _eleccion)).toBe('COVID');
});

test('Historial: sin reportes ni meta de COVID-19 el selector no aparece y todo queda como Influenza', async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate((h) => {
    document.body.innerHTML = h;
    window.InfluenzaReglas = { fechaLarga: (x) => x };
  }, seccion);
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ content: DATOS.replace("var _covidPanelListo = true;", "var _covidPanelListo = false;").replace(/var _covidCapturasCache = \[[\s\S]*?\];/, 'var _covidCapturasCache = [];') + resalta + bloque + '\nwindow.__cargar = loadInfluenzaHistoryList;' });
  await page.evaluate(() => window.__cargar());
  await expect(page.locator('#influenzaHistorialVacuna')).toBeHidden();
  await expect(page.locator('.inf-hist-card')).toHaveCount(2);
});
