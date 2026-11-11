// CSV jurisdiccional: un solo CSV con las unidades de los 4 municipios y los 2 hospitales (paso 4 del Concentrado
// Jurisdiccional), solo para JURISDICCIONAL y ADMIN, con aviso si falta alguien por validar.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-juris.js'), 'utf8');
test.use({ viewport: { width: 1400, height: 1000 } });

async function abrir(page, rol) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac_jurisdiccion.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockJuris', { state: 'visible', timeout: 15000 });
  await page.selectOption('#selAnio', '2026');
  await page.selectOption('#selMes', '10');
  await page.locator('#dockJTabs [data-jpaso="4"]').click();
}

test('CSV jurisdiccional: visible solo para JURISDICCIONAL/ADMIN y baja todas las unidades en un solo archivo', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page, 'JURISDICCIONAL');
  await expect(page.locator('#panelPaso4 #csvJurisdiccional')).toBeVisible();
  await expect(page.locator('#csvJurisdiccional [data-csvjur]')).toContainText('octubre');

  const visible = (rol) => page.evaluate((r) => {
    estado.perfil = Object.assign({}, estado.perfil, { rol: r });
    window.SIS06PCsvJurisdiccional.pintar();
    const c = document.getElementById('csvJurisdiccional');
    return !!c && c.style.display !== 'none';
  }, rol);
  for (const rol of ['UNIDAD', 'MUNICIPAL', 'VISUALIZADOR']) expect(await visible(rol), rol).toBe(false);
  expect(await visible('ADMIN')).toBe(true);
  expect(await visible('JURISDICCIONAL')).toBe(true);

  // antes de octubre de 2026 no hay SIS por unidad: el botón se deshabilita
  await page.selectOption('#selMes', '9');
  await page.evaluate(() => window.SIS06PCsvJurisdiccional.pintar());
  await expect(page.locator('#csvJurisdiccional [data-csvjur]')).toBeDisabled();
  await page.selectOption('#selMes', '10');
  await page.evaluate(() => window.SIS06PCsvJurisdiccional.pintar());
  await expect(page.locator('#csvJurisdiccional [data-csvjur]')).toBeEnabled();

  // HENM sin validar (el servidor responde error): aviso y descarga de todos modos con las demás unidades
  await page.evaluate(() => {
    estado.db = { rpc: async (n, a) => {
      if (n !== 'sis_filas_csv') return { data: [], error: null };
      if (a.p_municipio === 'HENM') return { data: null, error: { message: 'Faltan por validar: QTSSA001740' } };
      const unidad = { QUERETARO: 'QTSSA000001', HUIMILPAN: 'QTSSA000002', MARQUES: 'QTSSA000003', CORREGIDORA: 'QTSSA000004', NHG: 'QTSSA002901' }[a.p_municipio];
      return { data: [{ clues: unidad, municipio: a.p_municipio, variable_sis: 'VBC01', valor: 5 }, { clues: unidad, municipio: a.p_municipio, variable_sis: 'VBC02', valor: 0 }], error: null };
    } };
  });
  await page.locator('#csvJurisdiccional [data-csvjur]').click();
  const bajada = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Descargar de todos modos' }).click();
  const d = await bajada;
  expect(d.suggestedFilename()).toBe('SIS_JURISDICCION_10_2026.csv');
  const destino = path.join(test.info().outputDir, 'jur.csv');
  await d.saveAs(destino);
  const lineas = fs.readFileSync(destino, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  expect(lineas[0]).toBe('CLUES,VARIABLE,VALOR,MES,AÑO,MUNICIPIO');
  expect(lineas).toHaveLength(1 + 5 * 2);                                   // 5 destinos con datos, 2 filas cada uno
  expect(lineas[1]).toBe('"QTSSA000001","VBC01","5","10","2026","QUERÉTARO"');   // Querétaro primero, con su nombre oficial
  expect(lineas[lineas.length - 1]).toContain('"NHG"');                     // hospitales al final
  expect(lineas.join('\n')).not.toContain('QTSSA001740');                   // HENM sin validar: no entra
});
