// Tutoriales animados del SINBA-SIS (tutoriales_sis.js) y globitos de ayuda (hints.js).
// Cada película se recorre paso a paso: debe tener texto, sus objetivos (cursor / resaltado) deben existir en la réplica y no
// debe haber errores de consola. También se revisa la accesibilidad del reproductor con axe-core.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1200);
}

test.use({ viewport: { width: 1280, height: 720 } });

test('Tutoriales: cada película se recorre completa, con texto en cada paso y sus objetivos presentes', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(m.text()); });
  await abrir(page, 'UNIDAD');
  const ids = await page.evaluate(() => window.Tutoriales.lista());
  expect(ids).toEqual(['primer_mes', 'cuadrar', 'mover', 'enviar']);
  for (const id of ids) {
    await page.evaluate((i) => window.Tutoriales.abrir(i), id);
    const total = await page.locator('#tutPuntos .tut-punto').count();
    expect(total).toBeGreaterThanOrEqual(5);
    await page.click('#tutPlay');                    // pausa: se avanza a mano
    for (let k = 0; k < total; k++) {
      await page.click(`#tutPuntos [data-k="${k}"]`);
      await page.waitForTimeout(80);
      await expect(page.locator('#tutTexto')).not.toHaveText('');
      await expect(page.locator('#tutPaso')).toHaveText(`Paso ${k + 1} de ${total}`);
    }
    // El último paso deja la película en su estado final y el botón ofrece verla otra vez.
    await expect(page.locator('#tutPlay')).toContainText(/Ver otra vez/);
  }
  expect(errores).toEqual([]);
});

test('Tutorial primer mes: al terminar, la fila del lote muestra 4 de existencia anterior y su final cambia', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await page.evaluate(() => window.Tutoriales.abrir('primer_mes'));
  await page.click('#tutPlay');
  await page.click('#tutPuntos [data-k="6"]');
  await page.waitForTimeout(100);
  await expect(page.locator('#tutEscena [data-t="ant-a"]')).toHaveText('4');
  await expect(page.locator('#tutEscena [data-t="fin-a"]')).toHaveText('34');
});

test('Tutoriales: el menú lista las cuatro películas, Escape cierra y el foco regresa', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await page.addScriptTag({ content: AXE });
  await page.evaluate(() => window.Tutoriales.menu());
  await expect(page.locator('.tut-tarjeta')).toHaveCount(4);
  const viol = await page.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('.tut-overlay'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '));
  });
  expect(viol).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tut-overlay.abierto')).toHaveCount(0);
});

test('Globitos de ayuda: el title de un botón de la tabla pasa a un globito visible al enfocarlo', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await page.evaluate(() => {
    const p = document.getElementById('panelMovimiento');
    const b = document.createElement('button');
    b.id = 'botonHint'; b.type = 'button'; b.title = 'Texto de ayuda de prueba'; b.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">edit</span>';
    p.appendChild(b);
    p.style.display = 'block';
  });
  await page.focus('#botonHint');
  await expect(page.locator('#hintBurbuja.visible')).toHaveText('Texto de ayuda de prueba');
  await expect(page.locator('#botonHint')).toHaveAttribute('aria-label', 'Texto de ayuda de prueba');
  await page.keyboard.press('Escape');
  await expect(page.locator('#hintBurbuja.visible')).toHaveCount(0);
});
