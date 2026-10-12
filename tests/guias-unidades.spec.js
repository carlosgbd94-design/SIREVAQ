// Guías para las unidades (instructivos y tarjeta de novedades): existen, se pueden abrir desde el
// celular sin desbordar, tienen botón para volver a SIREVAQ y su PDF acompaña a cada página.
const { test, expect } = require('@playwright/test');

const GUIAS = [
  { pagina: 'instructivo_influenza.html', pdf: 'instructivo_influenza.pdf', titulo: /Influenza/, volver: 'index.html' },
  { pagina: 'instructivo_sis.html', pdf: 'instructivo_sis.pdf', titulo: /SINBA-SIS/, volver: 'biovac.html' },
  { pagina: 'novedades_unidades.html', pdf: 'novedades_unidades.pdf', titulo: /nuevo/i, volver: 'index.html' }
];

for (const g of GUIAS) {
  test(`${g.pagina}: abre, tiene botón para volver a SIREVAQ y PDF disponible`, async ({ page, request }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());   // sin red externa
    await page.goto('/' + g.pagina);
    await expect(page).toHaveTitle(g.titulo);
    const volver = page.locator('.barra a.volver');
    await expect(volver).toHaveAttribute('href', g.volver);   // la guía del SIS regresa al panel SINBA-SIS, no al inicio
    await expect(volver).toBeVisible();
    await expect(page.locator('.barra a[download]')).toHaveAttribute('href', g.pdf);
    const pdf = await request.get('/' + g.pdf);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).slice(0, 5).toString()).toBe('%PDF-');
    // Celular: sin desborde horizontal
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('el instructivo del SINBA-SIS no habla de jueves/viernes ni del reporte del viernes', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  for (const f of ['instructivo_sis.html', 'novedades_unidades.html', 'instructivo_influenza.html']) {
    await page.goto('/' + f);
    const texto = await page.locator('main').innerText();
    expect(texto, f).not.toMatch(/jueves y viernes|jueves o viernes|reporte del viernes|fecha del viernes/i);
  }
});

test('las guías viven en la tarjeta de ayuda: sin accesos redundantes en el perfil ni enlaces a páginas aparte', async ({ page }) => {
  await page.route(/\.supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#profileGuiasUnidad')).toHaveCount(0);
  await expect(page.locator('a[href="instructivo_sis.html"], a[href="novedades_unidades.html"]')).toHaveCount(0);
  const modulo = await (await page.request.get('/sis06p_biovac_module.js')).text();
  expect(modulo).toContain('data-ayuda="guia_sis"');
  expect(modulo).not.toContain('href="instructivo_sis.html"');
  const contenido = await (await page.request.get('/guias_contenido.js')).text();
  for (const k of ['guia_sis', 'influenza_captura', 'novedades']) expect(contenido).toContain(`G.${k} =`);
});

test('«¿Qué hay de nuevo?»: se muestra una sola vez por versión y se puede reabrir desde una guía', async ({ page }) => {
  await page.route(/\.supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.Ayuda && window.GuiasContenido);
  const r = await page.evaluate(() => { localStorage.removeItem('sirevaq_novedades_visto'); const a = Ayuda.novedadesUnaVez(); Ayuda.cerrar(); const b = Ayuda.novedadesUnaVez(); return { a, b, v: localStorage.getItem('sirevaq_novedades_visto') }; });
  expect(r).toEqual({ a: true, b: false, v: '2026-10' });
  await page.evaluate(() => Ayuda.abrir('novedades'));
  await expect(page.locator('#ayudaTitulo')).toHaveText('¿Qué hay de nuevo?');
  await expect(page.locator('#ayudaSub')).toContainText('Paso 1 de 3');
  await expect(page.locator('.ayuda-donde').first()).toContainText('SINBA-SIS');
  await page.evaluate(() => Ayuda.cerrar());
  // Desde una guía se llega a las novedades sin salir de la pantalla
  await page.evaluate(() => Ayuda.abrir('guia_sis'));
  await expect(page.locator('#ayudaTitulo')).toHaveText('Guía del SINBA-SIS');
  await page.locator('#ayudaExtras [data-accion="novedades"]').dispatchEvent('click');   // sin sesión hay una capa de acceso encima
  await expect(page.locator('#ayudaTitulo')).toHaveText('¿Qué hay de nuevo?');
  expect(page.url()).toContain('index.html');
});
