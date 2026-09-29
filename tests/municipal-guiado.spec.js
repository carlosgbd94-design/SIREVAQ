// Cierre mensual guiado del MUNICIPAL (municipal_guiado.js) sobre biovac.html real,
// con un Supabase simulado (tests/fixtures/fake-biovac.js). Cubre los 4 pasos,
// los puntos de avance, la navegación entre unidades, el paso automático a la
// siguiente por validar y la habilitación del CSV oficial.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|ResizeObserver|DevTools|posthog/i;

async function abrir(page, rol) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 240)); });
  page.on('dialog', (d) => d.accept());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  if (rol) await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockPasosMun', { timeout: 15000 });
  return errores;
}
const fake = (page, expr) => page.evaluate(`(() => { const F = window.__FAKE; return ${expr}; })()`);

test.use({ viewport: { width: 1400, height: 1000 } });

test('Municipal: cierre guiado en 4 pasos', async ({ page }) => {
  const errores = await abrir(page);

  // --- Paso 1: envíos --------------------------------------------------------
  await expect(page.locator('body')).toHaveClass(/mun-guiado/);
  await expect(page.locator('#dockPasosMun .hoja-tab')).toHaveCount(4);
  await expect(page.locator('#dockHojas')).toBeHidden();
  await expect(page.locator('#selUsuario')).toBeHidden();                    // el municipal ya no ve campos que no le sirven
  await expect(page.locator('#wrapUnidadRevision')).toBeHidden();                     // las 6 pestañas viejas ya no estorban
  await expect(page.locator('#rutaMes .ruta-paso')).toHaveCount(4);
  await expect(page.locator('#munEnvios .mun-unidad')).toHaveCount(4);
  await expect(page.locator('#munEnvios button.pt')).toHaveCount(4);
  await expect(page.locator('#munEnvios button.pt.parcial')).toHaveCount(2);   // por validar
  await expect(page.locator('#munEnvios button.pt.completo')).toHaveCount(1);
  await expect(page.locator('#munCtaSiguiente')).toContainText('(2)');
  await page.click('.mun-chip[data-filtro="ENVIADO"]');
  await expect(page.locator('#munEnvios .mun-unidad')).toHaveCount(2);
  await page.click('.mun-chip[data-filtro="todas"]');
  await expect(page.locator('#pildoraMun1')).toHaveText('3/4');

  // --- Paso 2: revisión unidad por unidad -------------------------------------
  await page.click('#munCtaSiguiente');
  await expect(page.locator('#munBarraRevision')).toBeVisible();
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Alfa');
  await expect(page.locator('#selUnidadRevision')).toHaveValue('un-a');
  await expect(page.locator('#panelSIS06P')).toBeVisible();
  await page.click('#munNext');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Beta');
  await expect(page.locator('#selUnidadRevision')).toHaveValue('un-b');
  await page.click('#munSigPend');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Gamma');
  await page.selectOption('#munRevSelect', 'QTSSA000004');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Delta');
  await page.click('#munBarraRevision .mun-hoja[data-hoja="btnSeccionCEH"]');
  await expect(page.locator('#panelCEH')).toBeVisible();
  await expect(page.locator('#munBarraRevision .mun-hoja[data-hoja="btnSeccionCEH"]')).toHaveClass(/activo/);

  // Validar de verdad (botón de la barra + confirmación): se abre sola la siguiente por validar
  await page.click('#munBarraRevision .pt[data-clues="QTSSA000001"]');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Alfa');
  await expect(page.locator('#btnMarcarValidado')).toBeVisible();
  await page.click('#btnMarcarValidado');
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Gamma');
  await expect(page.locator('#pildoraMun2')).toHaveText('2/4');
  expect(await fake(page, "F.seg.find((f) => f.clues === 'QTSSA000001').estado")).toBe('VALIDADO');

  // --- Paso 3: concentrado ----------------------------------------------------
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="3"]');
  await expect(page.locator('#panelMunConcentrado')).toBeVisible();
  await expect(page.locator('#munBarraRevision')).toBeHidden();
  await expect(page.locator('#panelSIS06P')).toBeHidden();
  await expect(page.locator('#munConcComparativo')).toContainText('C.S. Gamma');   // la única que aún tiene diferencia
  await page.click('#munVerMovimiento');
  await expect(page.locator('#munMovBarra')).toBeVisible();
  await page.click('#munVolverConcentrado');
  await expect(page.locator('#panelMunConcentrado')).toBeVisible();

  // --- Paso 4: entrega --------------------------------------------------------
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="4"]');
  await expect(page.locator('#panelMunEntrega')).toBeVisible();
  await expect(page.locator('#munCheck li').first()).toContainText('2 de 4');
  await expect(page.locator('#munDescargarCSV')).toBeDisabled();             // faltan unidades por validar
  await fake(page, 'F.validarTodas()');
  await page.selectOption('#selMes', { index: 0 });
  await page.selectOption('#selMes', { index: new Date().getMonth() });
  await expect(page.locator('#munDescargarCSV')).toBeEnabled();
  await expect(page.locator('#munCheck li.ok')).toHaveCount(2);
  await expect(page.locator('#munCheck li.aviso')).toContainText('informativo');   // recibido vs requisición no bloquea

  // Ayuda contextual
  await page.click('#panelMunEntrega [data-ayuda="mun_entrega"]');
  await expect(page.locator('#ayudaOverlay.abierto')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(errores).toEqual([]);
});

test('Jurisdicción en Movimiento: el cierre guiado trabaja con los hospitales', async ({ page }) => {
  const errores = await abrir(page, 'JURISDICCIONAL');

  // Paso 1: municipios como avance informativo; los hospitales, revisables
  await expect(page.locator('#tituloPagina')).toHaveText('SINBA-SIS · Cierre de hospitales');
  await expect(page.locator('#munEnvios .mun-otro')).toHaveCount(2);              // Querétaro y Corregidora (solo lectura)
  await expect(page.locator('#munEnvios .mun-otro button')).toHaveCount(0);
  await expect(page.locator('#munEnvios .mun-unidad')).toHaveCount(2);            // NHGQ y HENM
  await expect(page.locator('#pildoraMun1')).toHaveText('1/2');
  await expect(page.locator('#munCtaSiguiente')).toContainText('(1)');

  // Paso 2: solo se navega entre hospitales
  await page.click('#munCtaSiguiente');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('NHGQ');
  await expect(page.locator('#munRevSelect option')).toHaveCount(2);
  await expect(page.locator('#selUnidadRevision')).toHaveValue('un-h1');
  await page.click('#munNext');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('HENM');

  // Paso 3: el Movimiento de la jurisdicción vive en su propia página
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="3"]');
  await expect(page.locator('#panelMunConcentrado a[href="biovac_jurisdiccion.html"]')).toBeVisible();
  await expect(page.locator('#munVerMovimiento')).toHaveCount(0);
  await expect(page.locator('#panelMunConcentrado .mun-chip')).toHaveCount(2);     // NHG y HENM

  // Paso 4: entrega por hospital
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="4"]');
  await expect(page.locator('#munCheck li').first()).toContainText('0 de 1');
  await expect(page.locator('#munDescargarCSV')).toBeDisabled();
  expect(errores).toEqual([]);
});
