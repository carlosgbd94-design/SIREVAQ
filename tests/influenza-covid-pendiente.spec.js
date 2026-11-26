// Influenza + COVID-19 en una sola captura: «Sin movimiento» ya no guarda COVID-19 en silencio y el selector de semanas
// no dice «Capturado» cuando solo se reportó una de las dos vacunas.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8').replace(/\r\n/g, '\n');

/** Texto de una función de primer nivel del módulo (hasta su llave de cierre en columna 0). */
function fn(nombre) {
  let i = modulo.indexOf(`function ${nombre}(`);
  if (i < 0) throw new Error(`No existe ${nombre}`);
  if (modulo.slice(i - 6, i) === 'async ') i -= 6;
  return modulo.slice(i, modulo.indexOf('\n}\n', i) + 3);
}

const SEM = '2026-11-27';

async function montar(page, extra = '') {
  await page.goto('about:blank');
  await page.evaluate(() => {
    document.body.innerHTML = '<input id="chkSinMovimientoINF" type="checkbox" checked><input id="influenza_semana" value="2026-11-27"><input id="nombreINFLUENZA" value="ANA"><input id="influenza_campana" value="2026-2027">'
      + '<div id="influenza_semana_dropdown"></div>';
  });
  await page.addScriptTag({
    content: `
      var _covidPanelListo = true; var _capturaVacuna = 'INFLUENZA';
      var _influenzaCapturasCache = []; var _covidCapturasCache = [];
      window.__llamadas = []; window.__toasts = [];
      var guardarSinMovimientoAmbas = async function () { window.__llamadas.push('AMBAS'); };
      var guardarCovidDesdePanel = async function () { window.__llamadas.push('COVID'); };
      var showToast = function (m) { window.__toasts.push(m); };
      // Cierra la captura: si el flujo sigue por la ruta normal de Influenza, se detiene aquí (y se nota por el toast).
      var influenzaEstadoCaptura = function () { return { abierta: false, motivo: 'RUTA_NORMAL' }; };
      var _infSinMovReabierto = null; var _capEdicion = null;
      ${fn('semanaVacunaFaltante')}
      ${fn('capReporteGuardado')}
      ${fn('preguntarSinMovimientoCovid')}
      ${fn('saveInfluenzaReport')}
      ${extra}`
  });
}

test('Sin movimiento en Influenza con COVID-19 pendiente: pregunta, y Cancelar no guarda nada', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => { window.__p = saveInfluenzaReport(); });
  const dlg = page.locator('[role="alertdialog"]');
  await expect(dlg).toContainText('¿Y COVID-19 esta semana?');
  await expect(dlg.locator('button')).toHaveText([
    'También COVID-19 sin movimiento', 'Solo Influenza (capturaré COVID-19 después)', 'Cancelar']);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await page.evaluate(() => window.__p);
  await expect(dlg).toHaveCount(0);
  expect(await page.evaluate(() => ({ l: window.__llamadas, t: window.__toasts }))).toEqual({ l: [], t: [] });
});

test('Escape también cancela el aviso sin guardar', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => { window.__p = saveInfluenzaReport(); });
  await expect(page.locator('[role="alertdialog"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__p);
  await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__llamadas)).toEqual([]);
});

test('«También COVID-19» guarda las dos vacunas en ceros', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => { window.__p = saveInfluenzaReport(); });
  await page.getByRole('button', { name: 'También COVID-19 sin movimiento' }).click();
  await page.evaluate(() => window.__p);
  expect(await page.evaluate(() => window.__llamadas)).toEqual(['AMBAS']);
});

test('«Solo Influenza» sigue la ruta normal de Influenza y NO toca COVID-19', async ({ page }) => {
  await montar(page);
  await page.evaluate(() => { window.__p = saveInfluenzaReport(); });
  await page.getByRole('button', { name: /Solo Influenza/ }).click();
  await page.evaluate(() => window.__p);
  const r = await page.evaluate(() => ({ l: window.__llamadas, t: window.__toasts }));
  expect(r.l).toEqual([]);
  expect(r.t).toEqual(['RUTA_NORMAL']);
});

test('Sin aviso cuando la semana ya tiene reporte de alguna vacuna, o cuando la unidad no maneja COVID-19', async ({ page }) => {
  // Ya hay COVID-19 guardado esa semana: no se pregunta, se guarda solo Influenza por la ruta normal
  await montar(page);
  await page.evaluate((f) => { _covidCapturasCache.push({ fecha: f }); window.__p = saveInfluenzaReport(); }, SEM);
  await page.evaluate(() => window.__p);
  await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
  expect(await page.evaluate(() => ({ l: window.__llamadas, t: window.__toasts }))).toEqual({ l: [], t: ['RUTA_NORMAL'] });

  // La unidad no tiene panel de COVID-19: nunca se pregunta
  await montar(page);
  await page.evaluate(() => { _covidPanelListo = false; window.__p = saveInfluenzaReport(); });
  await page.evaluate(() => window.__p);
  await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__llamadas)).toEqual([]);
});

test('Selector de semanas: «Falta COVID-19» / «Falta Influenza» en vez de «Capturado» cuando solo hay una vacuna', async ({ page }) => {
  await montar(page, `
    ${fn('renderInfluenzaWeekPicker')}
    var _campaignConfig = { fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' };
    var generateCampaignWeeks = function () { return [
      { semana: 1, fecha: '2026-11-06' }, { semana: 2, fecha: '2026-11-13' }, { semana: 3, fecha: '2026-11-20' }, { semana: 4, fecha: '2026-11-27' }]; };
    var influenzaSemanaPredeterminada = function () { return '2026-11-27'; };
    var influenzaVentanaError = function () { return null; };
    var influenzaSemanaAbre = function (f) { return f; }; var influenzaDiaCorto = function (f) { return f; };
    window.InfluenzaReglas = { rangoSemana: function () { return { desde: 'a', hasta: 'b', parte: 'semana' }; }, textoRango: function () { return 'rango'; } };
    _influenzaCapturasCache = [
      { fecha: '2026-11-06' }, { fecha: '2026-11-13' }, { fecha: '2026-11-20', sin_movimiento: true }];
    _covidCapturasCache = [{ fecha: '2026-11-06' }, { fecha: '2026-11-20', sin_movimiento: true }, { fecha: '2026-11-27' }];
  `);
  await page.evaluate(() => renderInfluenzaWeekPicker());
  const estados = await page.locator('.inf-sem-item').evaluateAll((els) => els.map((e) => e.querySelector('.inf-chip').lastChild.textContent.trim()));
  expect(estados).toEqual([
    'Capturado',          // 06-nov: las dos
    'Falta COVID-19',     // 13-nov: solo Influenza
    'Sin movimiento',     // 20-nov: las dos sin movimiento
    'Falta Influenza'     // 27-nov: solo COVID-19
  ]);

  // Unidad sin COVID-19: la semana con Influenza sigue diciendo «Capturado»
  await page.evaluate(() => { _covidPanelListo = false; renderInfluenzaWeekPicker(); });
  const sinCov = await page.locator('.inf-sem-item').evaluateAll((els) => els.map((e) => e.querySelector('.inf-chip').lastChild.textContent.trim()));
  expect(sinCov[1]).toBe('Capturado');
});

test('Aviso de «semanas anteriores sin reporte» ignora las de un mes ya enviado/cerrado', async ({ page }) => {
  await montar(page, `
    ${fn('influenzaMesCongelado')}
    ${fn('pintarAvisoSemanasCovid')}
    var USER = { rol: 'UNIDAD' };
    var _sisEstadosUnidad = { '2026-10': 'ENVIADO' };
    var influenzaHoy = function () { return '2026-11-27'; };
    var influenzaVentanaError = function () { return null; };
    var influenzaRangoTexto = function (f) { return f; };
    var generateCampaignWeeks = function () { return [
      { semana: 1, fecha: '2026-10-16' }, { semana: 2, fecha: '2026-10-30' }, { semana: 3, fecha: '2026-11-13' }, { semana: 4, fecha: '2026-11-27' }]; };
  `);
  const link = (setup) => page.evaluate((s) => {
    eval(s);
    const cont = document.createElement('div'); document.body.appendChild(cont);
    pintarAvisoSemanasCovid(cont, '2026-11-27');
    const a = cont.querySelector('.inf-ctl-link');
    return a ? { fecha: a.dataset.fecha, txt: cont.textContent } : null;
  }, setup);
  // Octubre enviado: solo avisa la semana de noviembre
  const r = await link('0');
  expect(r.fecha).toBe('2026-11-13');
  expect(r.txt).toContain('1 semana anterior');
  // Sin semanas pendientes de noviembre: no hay aviso
  expect(await link("_covidCapturasCache = [{ fecha: '2026-11-13' }]")).toBeNull();
  // Si octubre sigue en borrador, sí avisa (primero octubre)
  expect((await link("_sisEstadosUnidad = { '2026-10': 'BORRADOR' }; _covidCapturasCache = []")).fecha).toBe('2026-10-16');
});
