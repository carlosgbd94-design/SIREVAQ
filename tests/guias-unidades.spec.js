// Guías para las unidades (instructivos y tarjeta de novedades): existen, se pueden abrir desde el
// celular sin desbordar, tienen botón para volver a SIREVAQ y su PDF acompaña a cada página.
const { test, expect } = require('@playwright/test');

const GUIAS = [
  { pagina: 'instructivo_influenza.html', pdf: 'instructivo_influenza.pdf', titulo: /Influenza/ },
  { pagina: 'instructivo_sis.html', pdf: 'instructivo_sis.pdf', titulo: /SINBA-SIS/ },
  { pagina: 'novedades_unidades.html', pdf: 'novedades_unidades.pdf', titulo: /Novedades/ }
];

for (const g of GUIAS) {
  test(`${g.pagina}: abre, tiene botón para volver a SIREVAQ y PDF disponible`, async ({ page, request }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());   // sin red externa
    await page.goto('/' + g.pagina);
    await expect(page).toHaveTitle(g.titulo);
    const volver = page.locator('.barra a.volver');
    await expect(volver).toHaveAttribute('href', 'index.html');
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

test('index.html enlaza las guías para la unidad y biovac.html el instructivo del SIS', async ({ page }) => {
  await page.route(/\.supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  const guias = page.locator('#profileGuiasUnidad');
  await expect(guias).toHaveAttribute('data-role-gate', 'UNIDAD');
  await expect(guias.locator('a[href="novedades_unidades.html"]')).toHaveCount(1);
  await expect(guias.locator('a[href="instructivo_sis.html"]')).toHaveCount(1);
  const src = await (await page.request.get('/sis06p_biovac_module.js')).text();
  expect(src).toContain('href="instructivo_sis.html"');
});
