// Panel de Influenza de la UNIDAD sobre el index.html real: barra de captura homologada, pestaña
// «Resumen de meta» (tarjetas movidas ahí + métricas nuevas) y Excel de la meta de la unidad.
// Sin sesión real: Supabase se intercepta en red con tablas en memoria (filtros eq, order, insert).
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;
const CAMP = 'Campaña Influenza 2026-2027';
const CLUES = 'QTSSA001904';   // JOFRITO (rural de Querétaro)

function servidor(db) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = req.method();
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
    if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
    const nombre = url.pathname.replace('/rest/v1/', '');
    if (nombre.startsWith('rpc/')) return json(200, null);
    const filas = db[nombre] || [];
    const filtros = [];
    for (const [k, v] of url.searchParams.entries()) {
      const f = v.match(/^eq\.(.*)$/s);
      if (f) filtros.push((r) => String(r[k]) === f[1]);
    }
    if (m === 'GET' || m === 'HEAD') {
      let out = filas.filter((r) => filtros.every((f) => f(r)));
      const ord = url.searchParams.get('order');
      if (ord) { const [c, d] = ord.split('.'); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
      return json(200, out);
    }
    return route.fulfill({ status: 204 });
  };
}

async function abrirPanel(page, { metas = true } = {}) {
  const meta = Object.fromEntries(Array.from({ length: 46 }, (_, k) => [`r${k + 1}`, 0]));
  Object.assign(meta, { r1: 100, r2: 60, r3: 40 });
  const db = {
    campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-02', fecha_fin: '2027-04-30', activo: true }],
    influenza_metas: metas ? [{ anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', metas: meta }] : [],
    influenza_capturas: [
      { id: 'k1', anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', fecha: '2026-10-09', valores: { r1: 20, r2: 10 }, sin_movimiento: false },
      { id: 'k2', anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', fecha: '2026-10-16', valores: { r1: 30 }, sin_movimiento: false }
    ],
    influenza_distribucion_frascos: [{ anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', cantidad_frascos: 15, fecha_entrega: '2026-10-05' }],
    unidades: [{ clues: CLUES, unidad: 'JOFRITO', municipio: 'QUERETARO', activo: 'SI' }]
  };
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, servidor(db));
  await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
  await page.route(/jszip\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'jszip', 'dist', 'jszip.min.js') }));
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00'));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: 'UNIDAD', usuario: 'ana', nombre: 'Ana', clues: 'QTSSA001904', unidad: 'JOFRITO', municipio: 'QUERETARO', municipiosAllowed: ['QUERETARO'] };
    TOKEN = 'token-prueba';
    const f = document.getElementById('formINFLUENZA'); f.style.display = 'flex';
    for (let el = f; el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
    await initInfluenzaCaptureFlow();
  });
  return { errores };
}

test.describe('Panel de Influenza (unidad)', () => {
  test.use({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });

  test('la barra de captura tiene 4 campos con la misma altura, radio y borde', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    const r = await page.evaluate(() => {
      const ids = ['influenza_campana', 'influenza_semana_btn', 'nombreINFLUENZA', 'cardSinMovimientoINF'];
      return ids.map((id) => {
        const el = document.getElementById(id), b = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return { id, h: Math.round(b.height), radio: cs.borderTopLeftRadius, borde: cs.borderTopWidth + ' ' + cs.borderTopStyle, visible: b.width > 0 };
      });
    });
    expect(r.every((x) => x.visible)).toBe(true);
    expect(new Set(r.map((x) => x.h)).size).toBe(1);
    expect(r[0].h).toBe(48);
    expect(new Set(r.map((x) => x.radio)).size).toBe(1);
    expect(new Set(r.map((x) => x.borde)).size).toBe(1);
    // Todos con etiqueta accesible y el selector de semana anuncia su estado
    await expect(page.locator('label[for="influenza_campana"]')).toHaveText('Campaña');
    await expect(page.locator('label[for="nombreINFLUENZA"]')).toContainText('responsable');
    await expect(page.locator('#influenza_semana_btn')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#influenza_semana_btn').click();
    await expect(page.locator('#influenza_semana_btn')).toHaveAttribute('aria-expanded', 'true');
    expect(errores).toEqual([]);
  });

  test('las tarjetas de abasto salen de Captura y viven en la pestaña «Resumen de meta»', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await expect(page.locator('#secUnitCaptura #influenzaBalanceUnidad')).toHaveCount(0);
    await expect(page.locator('#secUnitCaptura #influenzaStockPredictorContainer')).toHaveCount(0);
    await expect(page.locator('#secUnitResumen #influenzaBalanceUnidad')).toHaveCount(1);
    await expect(page.locator('#secUnitResumen #influenzaStockPredictorContainer')).toHaveCount(1);
    await expect(page.locator('#secUnitResumen')).toBeHidden();
    await page.locator('#subtabUnitResumen').click();
    await expect(page.locator('#secUnitResumen')).toBeVisible();
    await expect(page.locator('#secUnitCaptura')).toBeHidden();
    await expect(page.locator('#influenzaBalanceUnidad .frs-balance')).toContainText('Frascos que te repartieron');
    await page.locator('#subtabUnitCaptura').click();
    await expect(page.locator('#secUnitCaptura')).toBeVisible();
    await expect(page.locator('#secUnitResumen')).toBeHidden();
    expect(errores).toEqual([]);
  });

  test('el resumen calcula meta, avance, semanas y detalle por grupo', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await page.locator('#subtabUnitResumen').click();
    const kpis = page.locator('#influenzaResumenKpis');
    // Meta 200 (100+60+40), aplicadas 60 (20+10+30) = 30 %
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText('200');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Dosis aplicadas' })).toContainText('60');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Avance de tu meta' })).toContainText('30.0%');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Meta pendiente' })).toContainText('140');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Mejor semana' })).toContainText('30');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Semanas reportadas' })).toContainText('2 de');
    await expect(kpis.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '30');
    // Detalle por grupo: primera dosis tiene meta 200 y 60 aplicadas
    const fila = page.locator('#influenzaResumenGrupos tbody tr').filter({ hasText: 'Primera dosis' });
    await expect(fila).toContainText('200');
    await expect(fila).toContainText('60');
    await expect(page.locator('#influenzaResumenGrupos tfoot')).toContainText('30.0%');
    await expect(page.locator('#influenzaResumenGrupos caption')).toHaveText(/Meta y dosis aplicadas por grupo/);
    expect(errores).toEqual([]);
  });

  test('sin meta asignada el resumen lo explica y el Excel no se genera', async ({ page }) => {
    const { errores } = await abrirPanel(page, { metas: false });
    await page.locator('#subtabUnitResumen').click();
    await expect(page.locator('#influenzaResumenKpis')).toContainText('aún no tiene meta asignada');
    await page.locator('#btnExportMetaUnidad').click();
    await expect(page.locator('.toast-new').last()).toContainText('aún no tiene meta asignada');
    expect(errores).toEqual([]);
  });

  test('«Descargar mi meta»: Excel oficial solo de la unidad, con su columna, su meta y su jeringa', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await page.locator('#subtabUnitResumen').click();
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#btnExportMetaUnidad').click()]);
    expect(descarga.suggestedFilename()).toBe('Metas Influenza JOFRITO 2026-2027.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await descarga.path());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS UNIDADES RURALES', 'DISTRIBUCIÓN DE JERINGA']);
    const ws = wb.getWorksheet('METAS UNIDADES RURALES');
    expect(String(ws.getCell(10, 7).value).toUpperCase()).toBe('JOFRITO');
    expect(ws.getCell(11, 7).value).toBe(100);
    expect(ws.getCell(12, 7).value).toBe(60);
    expect(ws.getCell(13, 7).value).toBe(40);
    expect(ws.getCell(14, 7).value == null).toBe(true);
    expect(wb.getWorksheet('DISTRIBUCIÓN DE JERINGA').getCell(2, 1).value).toBe(CLUES);
    expect(errores).toEqual([]);
  });
});
