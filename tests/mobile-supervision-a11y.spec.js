// Accesibilidad (axe, modo oscuro y 320 px) y nuevas pantallas del móvil de supervisión.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, irAMas } = require('./_mobile_supervision_apoyo');

const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

async function axe(page, selector) {
  await page.evaluate(AXE_SRC => { if (!window.axe) (0, eval)(AXE_SRC); }, AXE);
  const viol = await page.evaluate(async (sel) => {
    const r = await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodos: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  }, selector);
  return viol;
}

const sinDesborde = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function recorre(page, pasos) {
  const hallazgos = [];
  for (const [nombre, selector, accion] of pasos) {
    await accion();
    await page.waitForTimeout(250);
    const v = await axe(page, selector);
    if (v.length) hallazgos.push({ pantalla: nombre, v });
    if (!(await sinDesborde(page))) hallazgos.push({ pantalla: nombre, v: [{ id: 'desborde-horizontal' }] });
  }
  return hallazgos;
}

test.describe('Móvil · supervisión: accesibilidad y diseño', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [nombre, vp, oscuro] of [['claro 390', { width: 390, height: 844 }, false], ['oscuro 390', { width: 390, height: 844 }, true], ['claro 320', { width: 320, height: 640 }, false]]) {
    test(`Municipal, todas las pantallas (${nombre})`, async ({ page }) => {
      await page.setViewportSize(vp);
      await abrir(page, { rol: 'MUNICIPAL', usuario: 'sup', municipios_allowed: 'CORREGIDORA' });
      if (oscuro) await page.evaluate(() => document.documentElement.classList.add('dark'));
      const mas = async () => { await page.click('.dock-item[data-panel="MAS"]'); };
      const volverMas = async () => { await page.evaluate(() => document.querySelector('[data-back]:not([hidden])') && [...document.querySelectorAll('[data-back]')].filter((b) => b.offsetParent)[0].click()); };
      const abre = (id) => async () => { await mas(); await page.click(`[data-ir="${id}"]`); };
      const hallazgos = await recorre(page, [
        ['Resumen', '#panelRES', async () => {}],
        ['Más', '#panelMAS', mas],
        ['RDA básico', '#panelRDA', abre('RDA')],
        ['RDA adultos', '#panelRDA', async () => { await page.click('[data-esq="adultos"]'); }],
        ['RDA deserción', '#panelRDA', async () => { await page.click('[data-esq="desercion"]'); }],
        ['RDA comparativa', '#panelRDA', async () => { await page.click('[data-esq="comparativa"]'); }],
        ['RDA meta influenza', '#panelRDA', async () => { await page.click('[data-esq="influenza"]'); }],
        ['Métricas', '#panelMET', async () => { await volverMas(); await page.click('[data-ir="MET"]'); }],
        ['Parámetros lista', '#panelPAR', async () => { await volverMas(); await page.click('[data-ir="PAR"]'); }],
        ['Parámetros editor', '#panelPAR', async () => { await page.click('#panelPAR [data-clues]'); await page.waitForSelector('#svMxGuardar'); }],
        ['Jeringas editor', '#panelJER', async () => { await page.click('#svMxLista'); await volverMas(); await page.click('[data-ir="JER"]'); await page.click('#panelJER [data-clues]'); await page.waitForSelector('#panelJER #svMxGuardar'); }],
        ['Pinol con entrega', '#panelPIN', async () => { await page.click('#panelJER #svMxLista'); await volverMas(); await page.click('[data-ir="PIN"]'); await page.click('[data-entrega]'); }],
        ['Enviar aviso', '#panelENV', async () => { await page.click('#svPinEntNo'); await volverMas(); await page.click('[data-ir="ENV"]'); }],
        ['Enviar aviso confirmación', '#panelENV', async () => { await page.fill('#svEnvTitulo', 'Asunto'); await page.fill('#svEnvMsg', 'Mensaje'); await page.click('#svEnvRev'); await page.waitForSelector('.sv-confirma'); }]
      ]);
      expect(hallazgos).toEqual([]);
    });
  }

  test('Jurisdiccional: Concentrado, Lotes y accesos a páginas completas', async ({ page }) => {
    await abrir(page, { rol: 'JURISDICCIONAL' });
    await page.click('.dock-item[data-panel="MAS"]');
    await expect(page.locator('a[href="requisiciones.html"]')).toBeVisible();
    await expect(page.locator('a[href="biovac_jurisdiccion.html"]')).toBeVisible();
    await expect(page.locator('a[href="biovac.html"]')).toHaveCount(0);
    const hallazgos = await recorre(page, [
      ['Más (jurisdiccional)', '#panelMAS', async () => {}],
      ['Concentrado', '#panelCON', async () => { await page.click('[data-ir="CON"]'); await page.waitForSelector('#supOps_CON .sv-lista'); }],
      ['Lotes', '#panelLOT', async () => { await page.click('#supOps_CON [data-back]'); await page.click('[data-ir="LOT"]'); await page.waitForSelector('#supOps_LOT .sv-lista'); }]
    ]);
    expect(hallazgos).toEqual([]);
    // datos
    await expect(page.locator('#supOps_LOT .sv-unidad')).toHaveCount(3);
    await expect(page.locator('#supOps_LOT .sv-unidad').first()).toContainText('Vencido');   // ordenados por caducidad
    await expect(page.locator('#supOps_LOT')).toContainText('Por vencer');
    await expect(page.locator('#supOps_LOT')).toContainText('oct-26');
    await page.click('#supOps_LOT [data-back]');
    await page.click('[data-ir="CON"]');
    await expect(page.locator('#supOps_CON .sv-pct')).toHaveText('240');             // 120 + 80 + 40
    await expect(page.locator('#supOps_CON .sv-unidad')).toHaveCount(2);              // BCG por unidad
    await page.click('[data-cb="TD"]');
    await expect(page.locator('#supOps_CON .sv-unidad')).toHaveCount(1);
  });

  test('Concentrado: totales por biológico y unidades en alcance; Lotes: estado de caducidad', async ({ page }) => {
    await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await page.click('.dock-item[data-panel="MAS"]');
    await expect(page.locator('[data-ir="CON"]')).toHaveCount(0); // el municipal no ve Concentrado ni Lotes
    await expect(page.locator('[data-ir="LOT"]')).toHaveCount(0);
    await expect(page.locator('a[href="biovac.html"]')).toBeVisible();
  });

  test('Admin: Seguridad (apertura confirmada, auditoría y presencia) sin violaciones', async ({ page }) => {
    await abrir(page, { rol: 'ADMIN' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const hallazgos = await recorre(page, [
      ['Seguridad', '#panelSEG', async () => { await irAMas(page, 'SEG'); }],
      ['Seguridad confirmando', '#panelSEG', async () => { await page.click('#svApToggle'); }],
      ['Seguridad con auditoría', '#panelSEG', async () => { await page.click('#svApNo'); await page.click('#svAudit'); await page.waitForSelector('#supOps_SEG .sv-lista'); }]
    ]);
    expect(hallazgos).toEqual([]);
  });

  test('Caravanas y Visualizador: Resumen y Más sin violaciones', async ({ page }) => {
    await abrir(page, { rol: 'VISUALIZADOR_JURISDICCIONAL' });
    const hallazgos = await recorre(page, [
      ['Resumen solo lectura', '#panelRES', async () => {}],
      ['Más visualizador', '#panelMAS', async () => { await page.click('.dock-item[data-panel="MAS"]'); }]
    ]);
    expect(hallazgos).toEqual([]);
  });
});
