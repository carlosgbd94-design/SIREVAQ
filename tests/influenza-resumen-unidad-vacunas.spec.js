// Resumen de meta de la UNIDAD: Influenza por mes y COVID-19 por marca y por mes (sin redondear).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = html.slice(html.indexOf('<section class="cp-card" id="ipResS4Card"'), html.indexOf('<!-- SECCIÓN DE HISTORIAL -->'));
const marcas = modulo.slice(modulo.indexOf('// ─── COVID-19 por marca (Moderna / Pfizer)'), modulo.indexOf('function updateInfluenzaDashboardVisuals('));
const mensual = modulo.slice(modulo.indexOf('// Cuarta tarjeta del resumen de la unidad'), modulo.indexOf('function aplicarSelectorResumen'));
const i0 = modulo.indexOf('const INFLUENZA_RUBROS');
const rubros = modulo.slice(i0, modulo.indexOf('];', i0) + 2).replace('const INFLUENZA_RUBROS', 'var INFLUENZA_RUBROS');

const DATOS = `
  var USER = { unidad: 'UMF PRUEBA', clues: 'Q1' };
  var INF_MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var generateCampaignWeeks = function () { return [{ semana: 43, fecha: '2026-10-23' }, { semana: 44, fecha: '2026-10-30' }, { semana: 47, fecha: '2026-11-20' }]; };
  var todayYmdLocal = function () { return '2026-10-31'; };
  var infFmt = function (n, dec) { return (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: dec == null ? 1 : dec }); };
  // Sin metaPesoRubro a propósito: en la unidad no hay vacuna activa de administración y la equivalencia no debe depender de ella
  var _infTotalDosis = function (r) { return Object.values(r.valores || {}).reduce(function (s, v) { return s + Number(v || 0); }, 0); };
  var _influenzaMetasCache = { r1: 1000 };
  var _influenzaCapturasCache = [
    { fecha: '2026-10-23', valores: { r1: 100, r2: 20 } }, { fecha: '2026-10-30', valores: { r1: 50 } }, { fecha: '2026-11-20', valores: { r1: 30 } }];
  var _covidCapturasCache = [
    { fecha: '2026-10-23', valores: { MODERNA: { c1: 10, c3: 5 }, PFIZER: { c3: 4 } } },
    { fecha: '2026-10-30', valores: { MODERNA: { c1: 1 }, PFIZER: {} } },
    { fecha: '2026-11-20', valores: { MODERNA: { c3: 2 }, PFIZER: { c3: 6 } } }];
  var _covidDistUnidad = [{ marca: 'MODERNA', cantidad_frascos: 3 }, { marca: 'PFIZER', cantidad_frascos: 2 }];
`;

async function montar(page) {
  await page.goto('about:blank');
  await page.evaluate((h) => { document.body.innerHTML = h; }, tarjeta);
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ content: rubros + DATOS + marcas + mensual });
}

test('Resumen de la unidad · Influenza por mes: reportes, aplicadas del mes y acumulado contra la meta', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => pintarDetalleMensualUnidad('INFLUENZA'));
  await expect(page.locator('#ipResS4Card')).toBeVisible();
  await expect(page.locator('#ipResS4')).toHaveText('Influenza por mes');
  const filas = await page.locator('#resumenDetalleMensual tbody tr').allInnerTexts();
  expect(filas.length).toBe(2);
  expect(filas[0]).toMatch(/octubre 2026/i);
  expect(filas[0]).toMatch(/2 de 2/);          // 2 reportes de 2 semanas del mes
  expect(filas[0]).toContain('170');           // 100 + 20 + 50 aplicadas en octubre
  expect(filas[1]).toMatch(/noviembre 2026/i);
  expect(filas[1]).toContain('200');           // acumulado 170 + 30
  expect(filas[1]).toContain('20.0%');         // 200 de 1000
});

test('Resumen de la unidad · COVID-19 por marca y por mes: Moderna y Pfizer separadas y sin redondear', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => pintarDetalleMensualUnidad('COVID'));
  await expect(page.locator('#ipResS4')).toHaveText('COVID-19 por marca y por mes');
  // Mes por omisión: el actual (octubre 2026)
  const tarjetas = page.locator('.cvm-card');
  await expect(tarjetas).toHaveCount(2);
  const m = await tarjetas.nth(0).innerText();
  expect(m).toContain('Aplicadas en octubre 2026');
  expect(m).toMatch(/16 dosis/);                  // octubre: 10 + 5 + 1 pediátricas/adultos de Moderna
  expect(m).toMatch(/10\.5 equiv\. 0\.5 mL/);     // 11 pediátricas cuentan 5.5 + 5 adultos = 10.5 (sin redondear)
  expect(m).toMatch(/Acumulado de la temporada\s*16 dosis/);       // hasta octubre
  expect(m).toMatch(/15 dosis de 0\.5 mL/);       // 3 frascos x 5
  const f = await tarjetas.nth(1).innerText();
  expect(f).toContain('Pfizer');
  expect(f).toMatch(/4 dosis/);                   // octubre
  expect(f).toMatch(/12 dosis de 0\.5 mL/);       // 2 frascos x 6
  // Selector de mes de la unidad
  await page.selectOption('#covMesSelUnidad', '2026-11');
  const m2 = await page.locator('.cvm-card').nth(0).innerText();
  expect(m2).toContain('Aplicadas en noviembre 2026');
  expect(m2).toMatch(/Aplicadas en noviembre 2026\s*2 dosis/);
  expect(m2).toMatch(/Acumulado de la temporada\s*18 dosis/);         // 16 + 2
  // Pfizer no aplica a 6-59 meses en la tabla por grupo
  expect(await page.locator('.cvm-tabla tbody tr').first().innerText()).toContain('—');
});
