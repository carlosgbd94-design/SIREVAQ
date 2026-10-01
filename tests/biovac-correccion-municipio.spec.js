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
  await expect(page.locator('[data-corr-chip="l1|NORMAL"] .tag-corr-pedida')).toHaveText('Corrección pedida');   // marca en el concentrado
  await expect(page.locator('[data-corr-chip="l2|NORMAL"] .tag-corr-pedida')).toHaveCount(0);
  await page.click('#dockJTabs .hoja-tab[data-jpaso="4"]');
  await expect(page.locator('#checkInforme')).toContainText('Correcciones pedidas a municipios');
  await page.click('#dockJTabs .hoja-tab[data-jpaso="3"]');

  // Cancelar la solicitud: desaparece la fila de corrección y la gris vuelve a normal
  await pendiente.locator('[data-action="cancelar-correccion-muni"]').click();
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#drilldownContenido tr.fila-correccion')).toHaveCount(0);
  await expect(resumen).not.toHaveClass(/fila-gris/);
  await expect(page.locator('.tag-corr-pedida')).toHaveCount(0);
});

test('Concentrado Jurisdiccional: abre en el mes que se reporta y el selector lo explica', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'JURISDICCIONAL'; });
  await page.goto('/biovac_jurisdiccion.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockJuris', { state: 'visible', timeout: 15000 });
  const esperado = await page.evaluate(() => {
    const d = new Date();
    return d.getMonth() === 0 ? { mes: 12, anio: d.getFullYear() - 1 } : { mes: d.getMonth(), anio: d.getFullYear() };
  });
  await expect(page.locator('#selMes')).toHaveValue(String(esperado.mes));
  await expect(page.locator('#selAnio')).toHaveValue(String(esperado.anio));
  await expect(page.locator('#chipPeriodo')).toHaveClass(/reporta/);
  await expect(page.locator('#chipPeriodo')).toContainText('mes que se reporta');
  for (const c of ['c-ant', 'c-rec', 'c-apl', 'c-des', 'c-fin']) await expect(page.locator(`table.concentrado thead th.${c}`).first()).toBeAttached();
});
