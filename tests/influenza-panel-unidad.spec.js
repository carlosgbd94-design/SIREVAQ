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

async function abrirPanel(page, { metas = true, fecha = '2026-10-20T12:00:00', extra = {}, covid = false } = {}) {
  const meta = Object.fromEntries(Array.from({ length: 46 }, (_, k) => [`r${k + 1}`, 0]));
  Object.assign(meta, { r1: 100, r2: 60, r3: 40 }, extra);
  const db = {
    campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-02', fecha_fin: '2027-04-30', activo: true }],
    influenza_metas: metas ? [{ anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', metas: meta }] : [],
    influenza_capturas: [
      { id: 'k1', anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', fecha: '2026-10-09', valores: { r1: 20, r2: 10 }, sin_movimiento: false, capturado_por: 'ANA PEREZ' },
      { id: 'k2', anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', fecha: '2026-10-16', valores: { r1: 30 }, sin_movimiento: false, capturado_por: 'LUIS GOMEZ' }
    ],
    influenza_distribucion_frascos: [{ anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', cantidad_frascos: 15, fecha_entrega: '2026-10-05' }],
    unidades: [{ clues: CLUES, unidad: 'JOFRITO', municipio: 'QUERETARO', activo: 'SI' }]
  };
  if (covid) {
    db.covid_metas = [{ anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', metas: { c1: 100, c2: 100, c3: 50, c4: 200, c5: 10, c6: 20 } }];
    db.covid_capturas = [{ id: 'v1', anio_campana: CAMP, clues: CLUES, municipio: 'QUERETARO', fecha: '2026-10-09', capturado_por: 'ANA PEREZ',
      valores: { MODERNA: { c1: 20, c3: 10, c4: 40 }, PFIZER: { c4: 20, c6: 5 } } }];
    db.covid_distribucion_frascos = [
      { anio_campana: CAMP, marca: 'MODERNA', clues: CLUES, municipio: 'QUERETARO', cantidad_frascos: 10, fecha_entrega: '2026-10-05' },
      { anio_campana: CAMP, marca: 'PFIZER', clues: CLUES, municipio: 'QUERETARO', cantidad_frascos: 5, fecha_entrega: '2026-10-05' }];
  }
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, servidor(db));
  await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
  await page.route(/jszip\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'jszip', 'dist', 'jszip.min.js') }));
  await page.clock.setFixedTime(new Date(fecha));
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

  test('captura abierta: casillas con nombre, sin controles mudos y la pestaña activa se anuncia', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-22T12:00:00' });   // jueves: la captura de la semana está abierta
    await page.waitForTimeout(400);   // el saneador de accesibilidad corre un instante después de pintar
    const scan = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const f = document.getElementById('formINFLUENZA');
      const casillas = [...f.querySelectorAll('input[id^="input_inf_"]')].filter(vis);
      const habilitadas = casillas.filter((i) => !i.disabled);
      const sinNombre = casillas.filter((i) => !(i.getAttribute('aria-label') || '').trim()).length;
      const ctr = [...f.querySelectorAll('button, a[href], input:not([type=hidden]), select')].filter(vis);
      const mudos = ctr.filter((e) => {
        const c = e.cloneNode(true); c.querySelectorAll('.material-symbols-rounded').forEach((n) => n.remove());
        return !((e.getAttribute('aria-label') || '').trim() || (e.labels && e.labels.length) || (e.title || '').trim() || (c.textContent || '').trim() || (e.placeholder || '').trim());
      }).map((e) => e.id || e.className);
      const iconos = [...f.querySelectorAll('.material-symbols-rounded')].filter((e) => !e.closest('[aria-hidden="true"]') && !e.hasAttribute('aria-hidden')).length;
      const barras = [...f.querySelectorAll('[id^="bar_inf_"]')].filter((b) => b.getAttribute('role') === 'progressbar' && b.hasAttribute('aria-valuenow')).length;
      const ths = [...f.querySelectorAll('th')].filter((t) => !t.getAttribute('scope')).length;
      const activa = f.querySelector('#subtabUnitCaptura').getAttribute('aria-current');
      return { total: casillas.length, habilitadas: habilitadas.length, sinNombre, mudos, iconos, barras, ths, activa, ejemplo: habilitadas[0] ? habilitadas[0].getAttribute('aria-label') : null };
    });
    expect(scan.total).toBeGreaterThan(0);
    expect(scan.habilitadas).toBeGreaterThan(0);          // hay metas: se puede capturar
    expect(scan.sinNombre).toBe(0);
    expect(scan.mudos).toEqual([]);
    expect(scan.iconos).toBe(0);
    expect(scan.barras).toBeGreaterThan(0);
    expect(scan.ths).toBe(0);
    expect(scan.activa).toBe('true');
    expect(scan.ejemplo).toContain('dosis aplicadas esta semana');
    // teclear sobre la meta: la casilla se marca inválida (no solo en rojo) y explica por qué
    const primera = page.locator('#formINFLUENZA input[id^="input_inf_"]:not([disabled])').first();
    await primera.fill('999999');
    await expect(primera).toHaveAttribute('aria-invalid', 'true');
    await expect(primera).toHaveAttribute('title', /superas la meta/);
    await primera.fill('1');
    await expect(primera).not.toHaveAttribute('aria-invalid', 'true');
    // la pestaña activa cambia con el teclado/clic y se anuncia
    await page.locator('#subtabUnitHistorico').click();
    await expect(page.locator('#subtabUnitHistorico')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#subtabUnitCaptura')).not.toHaveAttribute('aria-current', 'true');
    await page.locator('#subtabUnitCaptura').click();
    if (process.env.GUARDAR_CAPTURAS) await page.screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'influenza_captura_abierta.png'), fullPage: false });
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

  test('COVID-19: el resumen tiene selector, avance por grupo, abasto por marca y el menú exporta ambas metas', async ({ page }) => {
    const { errores } = await abrirPanel(page, { covid: true });
    await page.locator('#subtabUnitResumen').click();
    await expect(page.locator('#resumenVacunaSel')).toBeVisible();
    await page.locator('#resumenVacunaSel [data-vac="COVID"]').click();
    const kpis = page.locator('#influenzaResumenKpis');
    // meta equivalente = (100+100)/2 + 50+200+10+20 = 380; aplicadas = 20/2 + 10+40+20+5 = 85
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText('380');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Dosis aplicadas' })).toContainText('85');
    await expect(kpis.locator('.ip-kpi').filter({ hasText: 'Pfizer' })).toContainText('25');
    await expect(page.locator('#influenzaResumenGrupos tfoot')).toContainText('22.4%');
    await expect(page.locator('#influenzaBalanceUnidad')).toContainText('Moderna: 10 frascos');
    await expect(page.locator('#influenzaBalanceUnidad')).toContainText('Pfizer: 5 frascos');
    await page.locator('#resumenVacunaSel [data-vac="INFLUENZA"]').click();
    await expect(page.locator('#influenzaResumenGrupos caption')).toHaveText(/Meta y dosis aplicadas por grupo/);
    // Menú único de exportación: con meta de ambas vacunas aparecen las tres opciones
    await page.locator('#btnExportMeta').click();
    await expect(page.locator('#ipExpMetaMenu [data-exp]:visible')).toHaveCount(3);
    expect(errores).toEqual([]);
  });

  test('sin meta asignada el resumen lo explica y el Excel no se genera', async ({ page }) => {
    const { errores } = await abrirPanel(page, { metas: false });
    await page.locator('#subtabUnitResumen').click();
    await expect(page.locator('#influenzaResumenKpis')).toContainText('aún no tiene meta asignada');
    await page.locator('#btnExportMeta').click().then(() => page.locator('#ipExpMetaMenu [data-exp=INFLUENZA]').click());
    await expect(page.locator('.toast-new').last()).toContainText('aún no tiene meta asignada');
    expect(errores).toEqual([]);
  });

  test('«Descargar mi meta»: Excel oficial solo de la unidad, con su columna, su meta y su jeringa', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await page.locator('#subtabUnitResumen').click();
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#btnExportMeta').click().then(() => page.locator('#ipExpMetaMenu [data-exp=INFLUENZA]').click())]);
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

  test('sábado: entra a la semana que corre (viernes 16) y la puede capturar; el panel resume tu meta en vivo', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-17T11:00:00' });
    await expect(page.locator('#influenza_semana')).toHaveValue('2026-10-16');
    await expect(page.locator('.inf-aviso--cerrada')).toHaveCount(0);
    const habil = page.locator('#formINFLUENZA input[id^="input_inf_"]:not([disabled])').first();
    await expect(habil).toBeEnabled();
    const ctl = page.locator('#infControlMeta');
    await expect(ctl).toBeVisible();
    // el 16 ya tiene un reporte (r1: 30): meta r1 = 100, antes = 20, con 90 más rebasa
    const r1 = page.locator('#input_inf_r1');
    await r1.fill('90');
    await expect(page.locator('#disp_inf_r1')).toContainText('Te pasas por 10');
    await expect(ctl.locator('[role="alert"]')).toContainText('rebasa su meta');
    await r1.fill('80');
    await expect(page.locator('#disp_inf_r1')).toHaveText('100 de 100');
    await expect(ctl.locator('[role="alert"]')).toHaveCount(0);
    if (process.env.GUARDAR_CAPTURAS) {
      await r1.fill('90');
      await page.locator('#influenzaCaptureGroupsContainer').screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'influenza_control_meta.png'), clip: undefined });
    }
    expect(errores).toEqual([]);
  });

  test('command hub: contador de dosis capturadas se actualiza en vivo y es accesible', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-17T11:00:00' });
    await page.evaluate(() => { AppState.mainTab = 'CAP'; AppState.captureTab = 'INFLUENZA'; syncCommandHub(); });
    const caja = page.locator('#hubDosis');
    await expect(caja).toBeVisible();
    await expect(caja).toHaveAttribute('aria-label', 'Dosis capturadas esta semana');
    const semana = page.locator('#hubDosisSemana');
    const base = Number((await semana.innerText()).replace(/\D/g, ''));
    const r1 = page.locator('#input_inf_r1');
    await r1.fill('7');
    await expect(semana).not.toHaveText(String(base));
    // el texto para lectores de pantalla se anuncia con retardo, sin saturar cada tecla
    await expect(page.locator('#hubDosisSr')).toContainText('esta semana', { timeout: 3000 });
    expect(errores).toEqual([]);
  });

  test('selector de semanas: teclado (flechas, Esc) y estados visibles', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-20T12:00:00' });
    const btn = page.locator('#influenza_semana_btn');
    await btn.focus();
    await page.keyboard.press('ArrowDown');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.inf-sem-item[aria-current="true"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.inf-sem-item[data-fecha="2026-10-30"]')).toBeFocused();   // la semana siguiente a la elegida (23)
    await page.keyboard.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn).toBeFocused();
    expect(errores).toEqual([]);
  });

  test('la guía del panel: pasos con Anterior/Siguiente, botones con hover/presionado y el foco no se escapa', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await page.locator('#formINFLUENZA button.cp-help-btn').click();
    await expect(page.locator('#ayudaTitulo')).toHaveText('Guía del panel de Influenza');
    await expect(page.locator('#ayudaSub')).toContainText('Paso 1 de 7');
    const sig = page.locator('#ayudaCerrarBtn');
    await expect(sig).toHaveText('Siguiente');
    await expect(page.locator('#ayudaAnt')).toBeHidden();
    await expect(page.locator('#ayudaPuntos .ayuda-punto')).toHaveCount(7);
    // PDF y compartir dentro de la misma tarjeta; sin salir de la página
    await expect(page.locator('#ayudaExtras a[download]')).toHaveAttribute('href', 'instructivo_influenza.pdf');
    await expect(page.locator('#ayudaExtras [data-accion="compartir"]')).toBeVisible();
    await expect(page.locator('#ayudaExtras [data-accion="novedades"]')).toBeVisible();
    // Hover y presionado del botón principal
    const estilo = () => sig.evaluate((e) => { const c = getComputedStyle(e); return { t: c.transform, s: c.boxShadow, h: e.getBoundingClientRect().height }; });
    await page.waitForTimeout(400);
    const reposo = await estilo();
    expect(reposo.h).toBeGreaterThanOrEqual(43.5);
    await sig.hover();
    await page.waitForTimeout(350);
    const hover = await estilo();
    expect(hover.t).not.toBe(reposo.t);
    expect(hover.s).not.toBe(reposo.s);
    await page.mouse.down();
    await page.waitForTimeout(250);
    expect((await estilo()).t).not.toBe(hover.t);
    await page.mouse.up();                                   // avanza al paso 2
    await expect(page.locator('#ayudaSub')).toContainText('Paso 2 de 7');
    await expect(page.locator('#ayudaAnt')).toBeVisible();
    // Teclado: flechas cambian de paso y Tab no se escapa del diálogo
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#ayudaSub')).toContainText('Paso 3 de 7');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#ayudaSub')).toContainText('Paso 2 de 7');
    for (let k = 0; k < 14; k++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.getElementById('ayudaOverlay').contains(document.activeElement))).toBe(true);
    // Último paso: el botón principal pasa a «Entendido» y cierra
    await page.locator('#ayudaPuntos .ayuda-punto').last().click();
    await expect(page.locator('#ayudaSub')).toContainText('Paso 7 de 7');
    await expect(sig).toHaveText('Entendido');
    await sig.click();
    await expect(page.locator('#ayudaOverlay')).not.toHaveClass(/abierto/);
    // Regresa el foco al botón que abrió la guía (no se salió de la pantalla)
    expect(await page.evaluate(() => document.activeElement && document.activeElement.className)).toContain('cp-help-btn');
    expect(page.url()).toContain('index.html');
    expect(errores).toEqual([]);
  });

  test('todas las tablas de captura tienen las columnas en las mismas posiciones', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-11-20T12:00:00', extra: { r6: 5000, r7: 3 } });
    const pos = await page.evaluate(() => [...document.querySelectorAll('#influenzaCaptureGroupsContainer table.inf-cap-tabla')]
      .map((t) => [...t.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().left - t.getBoundingClientRect().left)).join(',')));
    expect(pos.length).toBeGreaterThan(1);
    expect(new Set(pos).size).toBe(1);
    expect(errores).toEqual([]);
  });

  test('Indicadores de influenza: avance vs esperado, ritmo, cobertura, abasto y detalle por grupo', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await page.evaluate(async () => {
      const previo = document.getElementById('rdaDashboardContent'); if (previo) previo.id = 'rdaDashboardContent_oculto';
      const d = document.createElement('div'); d.id = 'rdaDashboardContent'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;padding:24px'; document.body.appendChild(d);
      try { await renderInfluenzaIndicatorsDashboard(null, null); } catch (e) { window.__indErr = String(e && e.stack || e); }
    });
    expect(await page.evaluate(() => window.__indErr)).toBeUndefined();
    const raiz = page.locator('#rdaDashboardContent .iinf');
    await expect(raiz).toBeVisible();
    // Meta 200, aplicadas 60 = 30 %; la campaña lleva ~8.6 %
    await expect(raiz.locator('.iinf-hero')).toContainText('30.0');
    await expect(raiz.locator('.iinf-hero')).toContainText('puntos por delante');
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Faltan por aplicar' })).toContainText('140');
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText('200');
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Proyección al cierre' })).toBeVisible();
    await expect(raiz).toContainText('Reporte de la semana del 12 al 18 oct');
    await expect(raiz).toContainText('1 de 1 unidad');
    await expect(raiz.locator('#iinfRankTit')).toHaveText('Avance por municipio');
    await expect(raiz.locator('.iinf-svg')).toBeVisible();
    await expect(raiz.locator('#iinfAbTit')).toBeVisible();
    await expect(raiz.locator('#iinfAbTit').locator('xpath=ancestor::section')).toContainText('15');   // frascos repartidos
    await expect(raiz.locator('#iinfGrpTit')).toBeVisible();
    await expect(raiz.locator('[role="progressbar"]').first()).toHaveAttribute('aria-valuenow', /\d+/);
    expect(await raiz.locator('.sr-only').count()).toBe(0);   // el export a imagen/PDF no soporta texto oculto dentro del contenido
    if (process.env.GUARDAR_CAPTURAS) await raiz.screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'influenza_indicadores.png') });
    expect(errores).toEqual([]);
  });

  test('Indicadores de influenza: se exporta a Excel, PDF e imagen con las cifras del tablero', async ({ page }) => {
    test.setTimeout(90000);
    const { errores } = await abrirPanel(page);
    await page.evaluate(async () => {
      _rdaCache.unidades = []; _rdaCache.registros = []; _rdaState.esquema = 'meta_logro_influenza';
      document.getElementById('rdaDetailTable')?.remove();   // en esta vista el panel no tiene tabla de detalle
      const previo = document.getElementById('rdaDashboardContent'); if (previo) previo.id = 'rdaDashboardContent_oculto';
      const d = document.createElement('div'); d.id = 'rdaDashboardContent'; d.style.cssText = 'position:absolute;left:0;top:0;width:1280px;z-index:99999;background:#fff;padding:24px'; document.body.appendChild(d);
      await renderInfluenzaIndicatorsDashboard(null, null);
    });

    // Excel
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportInfluenzaIndicadoresExcel())]);
    expect(descarga.suggestedFilename()).toMatch(/^Indicadores_Influenza_2026_2027_Jurisdiccion_Sanitaria_1_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await descarga.path());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Por municipio', 'Por semana', 'Por grupo', 'Por edad', 'Abasto de frascos', 'Por revisar']);
    const res = wb.getWorksheet('Resumen');
    const fila = (ws, txt) => { let r = null; ws.eachRow((row) => { if (String(row.getCell(1).value || '').startsWith(txt)) r = row; }); return r; };
    expect(fila(res, 'Meta de la campaña').getCell(2).value).toBe(200);
    expect(fila(res, 'Dosis aplicadas').getCell(2).value).toBe(60);
    expect(fila(res, 'Avance de la meta').getCell(2).value).toBeCloseTo(0.3, 5);
    expect(fila(res, 'Dosis que faltan').getCell(2).value).toBe(140);
    expect(wb.getWorksheet('Por municipio').getCell(5, 1).value).toBe('QUERETARO');
    expect(wb.getWorksheet('Por semana').getCell(5, 2).value).toBe(0);    // 2-oct: sin captura
    expect(wb.getWorksheet('Por semana').getCell(6, 2).value).toBe(30);   // 9-oct: 20 + 10
    expect(wb.getWorksheet('Por semana').getCell(7, 3).value).toBe(60);   // acumulado al 16-oct
    expect(wb.getWorksheet('Por grupo').getCell(5, 2).value).toBe(200);

    // PDF e imagen (usan las librerías de captura; si el entorno no las puede descargar se omite)
    const libs = await page.evaluate(async () => { try { await window.ensureLibsLoaded('html2canvas'); await window.ensureJsPdfLoaded(); return true; } catch (e) { return false; } });
    if (libs) {
      const pdf = await page.evaluate(async () => {
        const blob = await generarPDFRobusto('rdaDashboardContent', 'x.pdf', true);
        const buf = new Uint8Array(await blob.arrayBuffer());
        const txt = new TextDecoder('latin1').decode(buf);
        return { bytes: buf.length, cabecera: txt.slice(0, 5), paginas: (txt.match(/\/Type\s*\/Page[^s]/g) || []).length };
      });
      expect(pdf.cabecera).toBe('%PDF-');
      expect(pdf.bytes).toBeGreaterThan(20000);
      expect(pdf.paginas).toBeGreaterThanOrEqual(1);
      const img = await page.evaluate(async () => {
        const c = await _captureRdaContentAsCanvas(document.getElementById('rdaDashboardContent'), 1);
        return { w: c.width, h: c.height, uri: c.toDataURL('image/png').length, data: c.toDataURL('image/jpeg', 0.7) };
      });
      if (process.env.GUARDAR_CAPTURAS) require('fs').writeFileSync(path.join(process.env.GUARDAR_CAPTURAS, 'influenza_export.jpg'), Buffer.from(img.data.split(',')[1], 'base64'));
      expect(img.w).toBeGreaterThanOrEqual(1280);
      expect(img.h).toBeGreaterThan(1500);       // el tablero completo, con tablas y detalle desplegado
      expect(img.uri).toBeGreaterThan(30000);
    } else {
      test.info().annotations.push({ type: 'omitido', description: 'Sin acceso a las librerías de captura (CDN) en este entorno' });
    }
    expect(errores).toEqual([]);
  });

  test('el instructivo vive en la tarjeta «¿Cómo funciona?» y ya no hay enlaces aparte en el panel', async ({ page }) => {
    const { errores } = await abrirPanel(page);
    await expect(page.locator('#formINFLUENZA a[href^="instructivo_"]')).toHaveCount(0);
    await expect(page.locator('#formINFLUENZA button.cp-help-btn')).toContainText('¿Cómo funciona?');
    expect(errores).toEqual([]);
  });

  test('las semanas se muestran con sus fechas (lunes a domingo), sin depender del viernes', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-20T12:00:00' });
    await page.locator('#influenza_semana_btn').click();
    const lista = page.locator('#influenza_semana_dropdown');
    await expect(lista.locator('.inf-sem-item[data-fecha="2026-10-16"]')).toContainText('12 al 18 oct');
    await expect(lista.locator('.inf-sem-item[data-fecha="2026-10-09"]')).toContainText('5 al 11 oct');
    await expect(lista.locator('.inf-sem-item[data-fecha="2026-10-02"]')).toContainText('2 al 4 oct');   // primera semana: desde el inicio de la campaña
    await expect(lista).not.toContainText(/viernes/i);
    await page.keyboard.press('Escape');
    // Guía de pasos, etiqueta del selector e historial hablan de la semana
    await expect(page.locator('#influenza_semana_label')).toContainText('19 al 25 oct');
    await expect(page.locator('#influenzaPasosGuia')).toContainText('19 al 25 oct');
    await expect(page.locator('#influenzaPasosGuia')).not.toContainText(/viernes/i);
    expect(errores).toEqual([]);
  });
});

test.describe('Paso a CeNSIA', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('fecha de aplicación acotada al mes reportado y 46 códigos únicos', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-11-03T11:00:00' });
    const r = await page.evaluate(() => ({
      sinTope: censiaFechaAplicacion('2026-10-30', '2026-10-30'),
      conTope: censiaFechaAplicacion('2026-10-30', '2026-11-03'),
      mismoMes: censiaFechaAplicacion('2026-10-16', '2026-10-17'),
      codigos: CENSIA_CODIGOS.length === INFLUENZA_RUBROS.length && new Set(CENSIA_CODIGOS).size === 46
    }));
    expect(r.sinTope).toBe('2026-10-30');
    expect(r.conTope).toBe('2026-10-31');
    expect(r.mismoMes).toBe('2026-10-17');
    expect(r.codigos).toBe(true);
    expect(errores).toEqual([]);
  });

  test('la tarjeta aparece con enlace a CeNSIA y, con el complemento, entrega el paquete', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-17T11:00:00' });
    await expect(page.locator('.inf-censia')).toBeVisible();
    const href = await page.locator('#infCensiaAbrir').getAttribute('href');
    expect(href).toContain('siscensia.salud.gob.mx/influenza26/ssa/captura.php#sirevaq=');
    // simula el complemento instalado y escucha el paquete
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-sirevaq-censia-ext', '1');
      window.__paq = null;
      window.addEventListener('message', (e) => { if (e.data && e.data.type === 'censia-payload') window.__paq = e.data.payload; });
      renderCaptureGrid();
    });
    await expect(page.locator('.inf-censia__ok')).toBeVisible();
    await page.locator('#infCensiaAbrir').evaluate((a) => { a.target = '_self'; a.addEventListener('click', (e) => e.preventDefault()); });
    await page.locator('#infCensiaAbrir').click();
    const paq = await page.evaluate(() => window.__paq);
    expect(paq.v).toBe(1);
    expect(Object.keys(paq.valores)).toHaveLength(46);
    if (process.env.GUARDAR_CAPTURAS) {
      await page.locator('.inf-censia').scrollIntoViewIfNeeded();
      await page.locator('.inf-censia').screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'sirevaq_tarjeta_censia.png') });
    }
    expect(paq.clues).toBe('QTSSA001904');
    expect(errores).toEqual([]);
  });
});

test.describe('Responsable y reemplazo semanal', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('el nombre del responsable viene del reporte de la semana y no se borra al editar', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-17T11:00:00' });
    const nombre = page.locator('#nombreINFLUENZA');
    await expect(nombre).toHaveValue('LUIS GOMEZ');
    // editar cifras no toca el nombre; repintar la tabla tampoco
    await page.locator('#input_inf_r1').fill('31');
    await page.evaluate(() => renderCaptureGrid());
    await expect(nombre).toHaveValue('LUIS GOMEZ');
    // lo que la persona escribe no se pisa al repintar
    await nombre.fill('MARIA LOPEZ');
    await page.evaluate(() => renderCaptureGrid());
    await expect(nombre).toHaveValue('MARIA LOPEZ');
    expect(errores).toEqual([]);
  });

  test('el panel explica que el reporte nuevo reemplaza al anterior', async ({ page }) => {
    const { errores } = await abrirPanel(page, { fecha: '2026-10-17T11:00:00' });
    const aviso = page.locator('.inf-reemplazo');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('reemplaza por completo al anterior');
    await expect(aviso).toContainText('total de la semana');
    expect(errores).toEqual([]);
  });
});
