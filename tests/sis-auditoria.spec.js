// Auditoría del SINBA-SIS (biovac.html) con el Supabase simulado de fake-biovac: accesibilidad automática (axe-core,
// WCAG 2.1 A/AA + buenas prácticas), ids repetidos y botones repetidos en cada vista y diálogo.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const FOTOS = process.env.SIS_FOTOS || '';   // carpeta opcional para guardar capturas al revisar a ojo

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.slice(0, 5).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  });
}
async function repetidos(page) {
  return page.evaluate(() => {
    const ids = {};
    document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    return Object.entries(ids).filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
  });
}

test.use({ viewport: { width: 1400, height: 1000 } });

async function revisar(page, informe, etiqueta) {
  await page.waitForTimeout(400);
  if (FOTOS) await page.screenshot({ path: path.join(FOTOS, etiqueta.replace(/\W+/g, '_') + '.png'), fullPage: true });
  informe[etiqueta] = { axe: await axe(page), ids: await repetidos(page) };
}
function problemas(informe) {
  const p = {};
  for (const [k, v] of Object.entries(informe)) if (v.axe.length || v.ids.length) p[k] = v;
  return p;
}

test('AUDITORÍA SIS: vistas del municipal (seguimiento y movimiento) sin violaciones', async ({ page }) => {
  test.setTimeout(90000);
  await abrir(page, 'MUNICIPAL');
  const informe = {};
  await revisar(page, informe, 'municipal inicio');
  // Cada hoja del dock del cierre guiado (Envíos, Revisión, Concentrado, Entrega)
  const hojas = page.locator('.dock-hojas button:visible');
  const n = await hojas.count();
  for (let i = 0; i < n; i++) {
    await hojas.nth(i).click({ timeout: 5000 });
    await revisar(page, informe, 'municipal hoja ' + (i + 1));
  }
  expect(problemas(informe)).toEqual({});
});

test('AUDITORÍA SIS: vista de la unidad (paloteo) y diálogo de envío sin violaciones', async ({ page }) => {
  test.setTimeout(90000);
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push(
      { id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', orden: 1, activo: true },
      { id: 2, fila_excel: 12, biologico: 'BCG', grupo_poblacional: '29 días a 11 meses', dosis: 'ÚNICA', edad: null, clave_general: 'VBC02', orden: 2, activo: true }
    );
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: { 11: { total: 5 } }, ajustes: {}, updated_at: new Date().toISOString() });
  });
  await page.evaluate(async () => { document.getElementById('panelSIS06P').style.display = 'block'; await SIS06PBiovac.init(); });
  const informe = {};
  await revisar(page, informe, 'unidad paloteo');
  expect(problemas(informe)).toEqual({});
});

// Teléfono (390 px): sin desborde horizontal y sin violaciones, en el cierre del municipal y en la vista de la unidad.
test.describe('SIS en teléfono', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  test('AUDITORÍA SIS móvil: municipal y unidad sin desborde ni violaciones', async ({ page }) => {
    test.setTimeout(90000);
    await abrir(page, 'MUNICIPAL');
    const informe = {};
    await revisar(page, informe, 'movil municipal');
    const desborde = async () => page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth + 1, anchos: [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > innerWidth + 2 && !e.closest('.tabla-wrap, [style*="overflow-x"], .tbl-scroll, .mun-chips, .inf-chips')).map((e) => (e.id || e.className || e.tagName).toString().slice(0, 40)).slice(0, 8) }));
    const d1 = await desborde();
    await page.evaluate(() => {
      const F = window.__FAKE; const mes = Number(document.getElementById('selMes').value); const anio = Number(document.getElementById('selAnio').value);
      estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
      F.tables.sis_variables.length = 0;
      F.tables.sis_variables.push({ id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', orden: 1, activo: true });
      F.tables.sis06p_capturas.length = 0;
      F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: { 11: { total: 5 } }, ajustes: {}, updated_at: new Date().toISOString() });
    });
    await page.evaluate(async () => { document.getElementById('panelSIS06P').style.display = 'block'; await SIS06PBiovac.init(); });
    await revisar(page, informe, 'movil unidad');
    const d2 = await desborde();
    expect({ municipal: d1, unidad: d2 }).toEqual({ municipal: { x: false, anchos: [] }, unidad: { x: false, anchos: [] } });
    expect(problemas(informe)).toEqual({});
  });
});
