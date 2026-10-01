// Jurisdicción pide corregir el movimiento de un MUNICIPIO (suma de sus unidades): fila de hoy en gris, debajo
// la corrección y lo que falta; el municipal ajusta sus unidades hasta que coincida. Concentrado Jurisdiccional
// con el Supabase simulado de tests/fixtures/fake-juris.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-juris.js'), 'utf8');

async function abrirDetalle(page) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'JURISDICCIONAL'; });
  await page.goto('/biovac_jurisdiccion.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockJuris', { state: 'visible', timeout: 15000 });
  await page.selectOption('#selAnio', '2026');
  await page.selectOption('#selMes', '10');
  await expect(page.locator('#pildoraJ1')).toHaveText('2/4');
  await page.click('#btnSiguiente');
  await page.click('[data-action="ir-lote"]');
  await expect(page.locator('#drilldownContenido tr.muni-resumen')).toHaveCount(1);
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('Jurisdicción pide corregir un municipio: fila gris, corrección debajo y lo que falta; se puede cancelar', async ({ page }) => {
  await abrirDetalle(page);
  const resumen = page.locator('#drilldownContenido tr.muni-resumen');
  await expect(resumen).not.toHaveClass(/fila-gris/);
  await expect(resumen.locator('[data-action="corregir-muni"]')).toBeVisible();

  // Editar: aparecen las cifras actuales (suma de las unidades) para escribir cómo deben quedar
  await resumen.locator('[data-action="corregir-muni"]').click();
  const edicion = page.locator('#drilldownContenido tr.fila-correccion');
  await expect(edicion).toBeVisible();
  await expect(resumen).toHaveClass(/fila-gris/);
  const recibido = edicion.locator('[data-cm-campo="recibido_frascos"]');
  await expect(recibido).toHaveValue('15');                                   // 10 + 5 de sus dos unidades

  // Sin cambios no se manda nada
  await edicion.locator('[data-action="enviar-correccion-muni"]').click();
  await expect(page.locator('#toast')).toContainText('Cambia al menos una cifra');

  // Pedir la corrección con motivo
  await recibido.fill('20');
  await edicion.locator('[data-action="enviar-correccion-muni"]').click();
  await page.fill('#modalInputMotivo', 'No cuadra con el paloteo');
  await page.click('#modalBtnAceptar');
  const pendiente = page.locator('#drilldownContenido tr.fila-correccion');
  await expect(pendiente).toContainText('Pendiente');
  await expect(pendiente).toContainText('faltan 5');                          // 20 pedidos vs 15 hoy
  await expect(pendiente).toContainText('No cuadra con el paloteo');
  await expect(resumen).toHaveClass(/fila-gris/);                              // la fila de hoy queda en gris
  const enviado = await page.evaluate(() => window.__INSERTS[0]);
  expect(enviado).toMatchObject({ municipio: 'QUERETARO', recibido_frascos: 20, categoria: 'NORMAL', motivo: 'No cuadra con el paloteo' });
  expect(Object.keys(enviado)).not.toContain('aplicadas_a');                  // solo viaja lo que se corrigió
  await expect(resumen.locator('[data-action="corregir-muni"]')).toHaveCount(0);

  // Cancelar la solicitud: desaparece la fila de corrección y la gris vuelve a normal
  await pendiente.locator('[data-action="cancelar-correccion-muni"]').click();
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#drilldownContenido tr.fila-correccion')).toHaveCount(0);
  await expect(resumen).not.toHaveClass(/fila-gris/);
});
