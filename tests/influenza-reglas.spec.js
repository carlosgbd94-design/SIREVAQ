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
const isoFn = modulo.slice(modulo.indexOf('function getISOWeek('), modulo.indexOf('let _campaignConfig'));
const semanasFn = modulo.slice(modulo.indexOf('function generateCampaignWeeks()'), modulo.indexOf('function campaignSeasonLabel()'));
const saveFn = modulo.slice(modulo.indexOf('function influenzaVentanaError('), modulo.indexOf('// --- LÓGICA DE ADMINISTRACIÓN Y MUNICIPIOS ---'));

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
  await page.addScriptTag({ content: rubros + isoFn + semanasFn + reglasFn + gridFn + saveFn + 'window.__grid = renderCaptureGrid; window.__save = saveInfluenzaReport;' });
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

// ─── Temporada 2026-2027: abre lun 12-oct-2026, cierra vie 2-abr-2027 ───────
const INI27 = '2026-10-12';
const FIN27 = '2027-04-02';

test('Temporada 2026-2027: 2ª dosis desde el 12-nov y 1ª dosis hasta el 2-mar', () => {
  expect(R.ventanas(INI27, FIN27)).toEqual({ segundasDesde: '2026-11-12', primerasHasta: '2027-03-02' });
  const b = (g, f) => !!R.reglaDosis(g, f, INI27, FIN27);
  expect(b('Segunda dosis', '2026-10-16')).toBe(true);
  expect(b('Segunda dosis', '2026-11-06')).toBe(true);
  expect(b('Segunda dosis', '2026-11-13')).toBe(false);   // primer viernes con 2ª dosis
  expect(b('Primera dosis', '2027-02-26')).toBe(false);   // último viernes con 1ª dosis
  expect(b('Primera dosis', '2027-03-05')).toBe(true);
});

async function ventana(page, ahora, fecha) {
  await page.clock.install({ time: new Date(ahora) });
  await montarCaptura(page, fecha);
  return page.evaluate(([f, i, fn]) => {
    _campaignConfig = { fecha_inicio: i, fecha_fin: fn };
    return window.influenzaVentanaError(f);
  }, [fecha, INI27, FIN27]);
}

test('Captura de unidad: antes del 12-oct no se puede reportar', async ({ page }) => {
  expect(await ventana(page, '2026-10-02T12:00:00', '2026-10-16')).toContain('inicia el 12 oct 2026');
});

test('Captura de unidad: el jueves previo al primer viernes ya se puede, una semana antes no', async ({ page }) => {
  expect(await ventana(page, '2026-10-15T12:00:00', '2026-10-16')).toBeNull();
  expect(await ventana(page, '2026-10-15T12:00:00', '2026-10-23')).toContain('aún no se puede capturar');
});

test('Captura de unidad: después del 2-abr la temporada ya no admite semanas', async ({ page }) => {
  expect(await ventana(page, '2027-04-09T12:00:00', '2027-04-09')).toContain('fuera de la campaña');
  expect(await ventana(page, '2027-04-01T12:00:00', '2027-04-02')).toBeNull();
});

test('Captura cerrada (antes del 12-oct): la tabla queda bloqueada, avisa y el guardado se rechaza', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00') });
  await montarCaptura(page, '2026-10-16');
  const r = await page.evaluate(async ([i, fn]) => {
    _campaignConfig = { fecha_inicio: i, fecha_fin: fn };
    window.__grid();
    const habilitados = [...document.querySelectorAll('[id^="input_inf_"]')].filter(x => !x.disabled).length;
    const aviso = !!document.querySelector('.inf-aviso--cerrada');
    await window.__save();
    return { habilitados, aviso, guardados: window.__guardados.length, estado: window.influenzaEstadoCaptura('2026-10-16').abierta };
  }, [INI27, FIN27]);
  expect(r).toEqual({ habilitados: 0, aviso: true, guardados: 0, estado: false });
});

test('Folio: usa el de la base y, si falta, lo deriva del id con el mismo formato', async ({ page }) => {
  await montarCaptura(page, '2026-10-16');
  const f = await page.evaluate(() => [
    window.influenzaFolio({ folio: 'INF-20261016-ABCD1234', fecha: '2026-10-16' }),
    window.influenzaFolio({ id: 'abcd1234-0000', fecha: '2026-10-16' })
  ]);
  expect(f).toEqual(['INF-20261016-ABCD1234', 'INF-20261016-ABCD1234']);
});

test('Cortes de fin de mes: solo si el mes termina de lunes a jueves (en viernes ya es su reporte; fin de semana no aplica)', () => {
  expect(R.cortes('2026-10-12', '2027-04-02')).toEqual(['2026-11-30', '2026-12-31', '2027-03-31']);
  // 30-nov-2022 fue miércoles: ese día se captura su propio reporte
  expect(R.cortes('2022-10-10', '2022-12-30')).toContain('2022-11-30');
  // la campaña que termina entre semana también cierra con su propio corte
  expect(R.cortes('2026-10-12', '2027-03-31')).toContain('2027-03-31');
});

test('Corte de fin de mes: se captura el mismo día aunque no sea jueves ni viernes, y aparece en la lista de semanas', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-30T12:00:00') });   // lunes
  await montarCaptura(page, '2026-11-30');
  const r = await page.evaluate(([i, fn]) => {
    _campaignConfig = { fecha_inicio: i, fecha_fin: fn };
    Date = class extends Date { getDay() { return 1; } };
    return { corte: influenzaEsCorte('2026-11-30'), abre: influenzaSemanaAbre('2026-11-30'), semanas: generateCampaignWeeks().filter(w => w.corte).map(w => w.fecha), estado: influenzaEstadoCaptura('2026-11-30').abierta, viernes: influenzaEstadoCaptura('2026-12-04').abierta };
  }, [INI27, FIN27]);
  expect(r).toEqual({ corte: true, abre: '2026-11-30', semanas: ['2026-11-30', '2026-12-31', '2027-03-31'], estado: true, viernes: false });
});
