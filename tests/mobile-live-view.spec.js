// Móvil · Live View de una unidad desde el Resumen de supervisión: existencia por lote con vigencia,
// desabasto, consumibles y pedido; solo lectura, accesible, Escape cierra y devuelve el foco.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir } = require('./_mobile_supervision_apoyo');

const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const axe = async (page, selector) => {
  await page.evaluate((src) => { if (!window.axe) (0, eval)(src); }, AXE);
  return page.evaluate(async (sel) => {
    const r = await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, nodos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  }, selector);
};

async function conDatos(page) {
  const ctx = await abrir(page, { rol: 'ADMIN' });
  const db = ctx.estado.db;
  // El servidor simulado ignora gte/lte/order: se entregan ya en el orden y rango que devolvería la base
  db.existencia_detalle = [
    { clues: 'QTSSA000830', fecha: '2026-10-22', biologico: 'BCG', lote: 'L-100', cantidad: 12, caducidad: '2026-11-30', capturado_por: 'ANA', tipo: 'PRESTAMO_DESABASTO' },
    { clues: 'QTSSA000830', fecha: '2026-10-22', biologico: 'TD', lote: 'L-200', cantidad: 8, caducidad: '2028-12-31', capturado_por: 'ANA' },
    { clues: 'QTSSA000830', fecha: '2026-10-15', biologico: 'VSR', lote: 'L-900', cantidad: 5, caducidad: '2027-05-31', capturado_por: 'ANA' }
  ];
  db.consumibles = [{ clues: 'QTSSA000830', fecha: '2026-10-22', srp_dosis: 40, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 15, jeringa_aplic_05ml_0605502657: 60, aguja_0600403711: 75 }];
  db.biologicos_pedido = [{ clues: 'QTSSA000830', fecha_pedido_programada: '2026-10-05', biologico: 'BCG', existencia_actual_frascos: 3, pedido_frascos: 10, promedio_frascos: 6, min_dosis: 20, max_dosis: 120 }];
  return ctx;
}

test.describe('Móvil · Live View de la unidad', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('biológicos: lotes, vigencia y desabasto; filtros; Escape devuelve el foco', async ({ page }) => {
    const { errores } = await conDatos(page);
    await page.click('[data-filtro="todas"]');
    const fila = page.locator('[data-lv="QTSSA000830"]');
    await fila.focus();
    await fila.click();
    const hoja = page.locator('#lvOverlay [role="dialog"]');
    await expect(hoja).toBeVisible();
    await expect(hoja).toContainText('Santa Bárbara');
    await expect(hoja).toContainText('BCG');
    await expect(hoja).toContainText('Cad. próxima');          // BCG caduca en un mes
    await expect(hoja).toContainText('Préstamo por desabasto');
    await expect(hoja).toContainText('VSR');                   // venía en la captura anterior y ya no: desabasto
    await page.click('[data-lvf="sin"]');
    await expect(hoja.locator('.lv-item')).toHaveCount(1);
    await expect(hoja).toContainText('Sin existencia');
    await page.keyboard.press('Escape');
    await expect(page.locator('#lvOverlay')).toHaveCount(0);
    await expect(fila).toBeFocused();
    expect(errores).toEqual([]);
  });

  test('consumibles y pedido muestran su detalle', async ({ page }) => {
    await conDatos(page);
    await page.click('[data-filtro="todas"]');
    await page.click('[data-tipo="CONS"]');
    await page.locator('[data-lv="QTSSA000830"]').click();
    await expect(page.locator('#lvOverlay')).toContainText('Jeringa de 0.5 ml');
    await expect(page.locator('#lvOverlay')).toContainText('75');
    await page.click('#lvCerrar');
    await page.click('[data-tipo="BIO"]');
    await page.locator('[data-lv="QTSSA000830"]').click();
    await expect(page.locator('#lvOverlay')).toContainText('Prom. mensual');
    await expect(page.locator('#lvOverlay')).toContainText('20 / 120');
  });

  test('accesible en claro y oscuro', async ({ page }) => {
    await conDatos(page);
    await page.click('[data-filtro="todas"]');
    await page.locator('[data-lv="QTSSA000830"]').click();
    await expect(page.locator('#lvOverlay')).toContainText('BCG');
    await page.waitForTimeout(500); // termina la animacion de entrada de la hoja
    expect(await axe(page, '#lvOverlay')).toEqual([]);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(600);
    expect(await axe(page, '#lvOverlay')).toEqual([]);
  });
});

test.describe('Móvil · plantilla de WhatsApp con las unidades pendientes', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('arma el mismo texto que el escritorio con las unidades que faltan, por municipio', async ({ page }) => {
    const { estado } = await abrir(page, { rol: 'ADMIN' });
    // Santa Bárbara y FAM Sierra ya capturaron biológicos esta semana
    estado.rpc.get_captures_sr_range_bypass = [{ clues: 'QTSSA000830', fecha: '2026-10-22' }, { clues: 'QTSSA000333', fecha: '2026-10-22' }];
    await page.reload();
    await page.waitForSelector('body.sup-mode');
    const wa = page.locator('#svWa');
    await expect(wa).toBeVisible();
    const href = await wa.getAttribute('href');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const texto = decodeURIComponent(href.split('text=')[1]);
    expect(texto).toContain('Las siguientes unidades no han realizado su captura de *EXISTENCIA DE BIOLÓGICO*');
    expect(texto).toContain('por favor hay que ingresar a la plataforma *SIREVAQ*');
    // Santa Bárbara y FAM Sierra capturaron biológicos en el periodo; faltan El Pueblito (Corregidora) y La Cañada (El Marqués)
    expect(texto).toContain('• *EL PUEBLITO*');
    expect(texto).toContain('• *LA CAÑADA*');
    expect(texto).not.toContain('SANTA BÁRBARA');
    expect(texto.indexOf('EL PUEBLITO')).toBeLessThan(texto.indexOf('LA CAÑADA')); // Corregidora antes que El Marqués
    await expect(wa).toContainText('(2)');
    // Cambia el texto con el tipo de captura
    await page.click('[data-tipo="CONS"]');
    const href2 = await page.locator('#svWa').getAttribute('href');
    expect(decodeURIComponent(href2.split('text=')[1])).toContain('*CONSUMIBLES*');
  });

  test('accesible', async ({ page }) => {
    await abrir(page, { rol: 'ADMIN' });
    await expect(page.locator('#svWa')).toBeVisible();
    expect(await axe(page, '#svWa')).toEqual([]);
  });
});

test.describe('Móvil · Resumen de Influenza', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const CAMP = 'Campaña Influenza 2026-2027';

  test('sin campaña vigente el Resumen no ofrece Influenza', async ({ page }) => {
    await abrir(page, { rol: 'ADMIN' });
    await expect(page.locator('[data-tipo]')).toHaveCount(3);
  });

  test('con campaña: unidades pendientes, WhatsApp y detalle en vivo', async ({ page }) => {
    const { estado } = await abrir(page, { rol: 'ADMIN' });
    estado.db.campanas = [{ id: 1, nombre: CAMP, activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2027-04-30' }];
    estado.db.influenza_capturas = [{ clues: 'QTSSA000830', fecha: '2026-10-23', anio_campana: CAMP, valores: { r1: 5, r2: 3, r16: 2 }, capturado_por: 'ANA', sin_movimiento: false }];
    await page.reload();
    await page.waitForSelector('body.sup-mode');
    await expect(page.locator('[data-tipo]')).toHaveCount(4);
    await page.click('[data-tipo="INF"]');
    await page.click('[data-filtro="todas"]');
    // Solo Santa Bárbara reportó la semana (viernes 23 oct); faltan las otras 3
    await expect(page.locator('.sv-pill.ok')).toHaveCount(1);
    await expect(page.locator('#svWa')).toContainText('(3)');
    const texto = decodeURIComponent((await page.locator('#svWa').getAttribute('href')).split('text=')[1]);
    expect(texto).toContain('*REPORTE DE INFLUENZA*');
    expect(texto).not.toContain('SANTA BÁRBARA');
    // Live View: dosis por rubro de la semana
    await page.locator('[data-lv="QTSSA000830"]').click();
    const hoja = page.locator('#lvOverlay');
    await expect(hoja).toContainText('Influenza · Santa Bárbara');
    await expect(hoja).toContainText('Dosis aplicadas en la semana');
    await expect(hoja).toContainText('10'); // 5 + 3 + 2
    await expect(hoja).toContainText('EMBARAZADAS');
    await page.keyboard.press('Escape');
    // Una unidad sin reporte lo dice
    await page.locator('[data-lv="QTSSA000111"]').click();
    await expect(page.locator('#lvOverlay')).toContainText('no tiene reporte de Influenza');
  });

  test('accesible con 4 tipos', async ({ page }) => {
    const { estado } = await abrir(page, { rol: 'ADMIN' });
    estado.db.campanas = [{ id: 1, nombre: CAMP, activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2027-04-30' }];
    await page.reload();
    await page.waitForSelector('body.sup-mode');
    await page.click('[data-tipo="INF"]');
    expect(await axe(page, '#supRoot')).toEqual([]);
  });
});
