// El botón Validar del revisor no debe desaparecer al cambiar de unidad u hoja durante la revisión.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page) {
  page.on('dialog', (d) => d.accept());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockPasosMun', { timeout: 15000 });
}
test.use({ viewport: { width: 1400, height: 1000 } });

test('Validar sigue visible al pasar por Movimiento y volver a SIS-06-P con otra unidad por validar', async ({ page }) => {
  await abrir(page);
  await page.click('#munCtaSiguiente');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Alfa');
  await expect(page.locator('#btnMarcarValidado')).toBeVisible();
  // Se revisa el Movimiento de Alfa y, estando ahí, se salta a la siguiente por validar
  await page.click('#munBarraRevision .mun-hoja[data-hoja="btnSeccionMovimiento"]');
  await page.click('#munSigPend');
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Gamma');
  await page.click('#munBarraRevision .mun-hoja[data-hoja="btnSeccionSIS06P"]');
  await expect(page.locator('#btnMarcarValidado')).toBeVisible();
});

test('Validar visible en cada unidad por validar sin importar la hoja desde la que se llega', async ({ page }) => {
  await abrir(page);
  await page.click('#munCtaSiguiente');
  for (const hoja of ['btnSeccionCEH', 'btnSeccionInfluenza', 'btnSeccionMovimiento', 'btnSeccionSIS06P']) {
    await page.click(`#munBarraRevision .mun-hoja[data-hoja="${hoja}"]`);
    await page.click('#munNext');
    await page.click('#munBarraRevision .mun-hoja[data-hoja="btnSeccionSIS06P"]');
    const est = await page.locator('#munBarraRevision .mun-pill').innerText();
    const nombre = await page.locator('#munBarraRevision .mun-rev-unidad b').innerText();
    if (/Por validar/i.test(est)) await expect(page.locator('#btnMarcarValidado'), nombre + ' desde ' + hoja).toBeVisible();
    else await expect(page.locator('#btnMarcarValidado'), nombre + ' desde ' + hoja).toBeHidden();
  }
});

test('Validar aparece solo cuando la unidad abierta envía mientras se revisa (sin recargar la página)', async ({ page }) => {
  await abrir(page);
  await page.click('#munCtaSiguiente');
  await page.selectOption('#munRevSelect', 'QTSSA000002');                    // Beta: aún en borrador
  await expect(page.locator('#munBarraRevision .mun-rev-unidad b')).toHaveText('C.S. Beta');
  await page.click('#munBarraRevision .mun-hoja[data-hoja="btnSeccionSIS06P"]');
  await expect(page.locator('#btnMarcarValidado')).toBeHidden();
  await expect(page.locator('#dockEstadoDetalle')).toContainText('aún no lo envía');
  // La unidad envía desde su teléfono: cambia en el servidor
  await page.evaluate(() => {
    const F = window.__FAKE;
    F.seg.find((f) => f.clues === 'QTSSA000002').estado = 'ENVIADO';
    F.tables.sis06p_capturas.find((c) => c.clues === 'QTSSA000002').estado = 'ENVIADO';
    document.dispatchEvent(new Event('visibilitychange'));                    // equivale a la actualización en vivo / al volver a la pestaña
  });
  await expect(page.locator('#btnMarcarValidado')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#dockEstadoDetalle')).toContainText('Validar');
});
