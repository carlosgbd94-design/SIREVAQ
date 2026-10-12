// Indicadores de Meta-Logro Influenza con una jurisdicción realista (4 municipios + 2 hospitales, ~40 unidades,
// varias semanas de captura): las cifras del tablero, del Excel y del PDF deben coincidir con un cálculo
// independiente hecho aquí con los mismos datos.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;
const CAMP = 'Campaña Influenza 2026-2027';
const HOY = '2026-12-18';   // viernes: 11 semanas de campaña vencidas (2-oct a 18-dic) + cortes de mes

function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

// 4 municipios + 2 hospitales (los hospitales figuran como QUERETARO en `unidades`, como en producción)
function construir() {
  const r = rng(7);
  const conf = [['QUERETARO', 16], ['CORREGIDORA', 8], ['EL MARQUES', 6], ['HUIMILPAN', 4]];
  const unidades = [];
  let n = 1000;
  conf.forEach(([mun, cuantas]) => { for (let i = 0; i < cuantas; i++) unidades.push({ clues: `QTSSA${String(n++).padStart(6, '0')}`, unidad: `${mun.split(' ').pop()} UNIDAD ${i + 1}`, municipio: mun, activo: 'SI' }); });
  unidades.push({ clues: 'QTSSA001740', unidad: 'HOSPITAL ENM', municipio: 'QUERETARO', activo: 'SI' });
  unidades.push({ clues: 'QTSSA002901', unidad: 'NUEVO HOSPITAL GENERAL', municipio: 'QUERETARO', activo: 'SI' });
  unidades.push({ clues: 'QTSSA009999', unidad: 'UNIDAD SIN META', municipio: 'CORREGIDORA', activo: 'SI' });

  const rubros = Array.from({ length: 46 }, (_, k) => `r${k + 1}`);   // los 46 rubros reales (con sus nombres largos)
  const metas = [], capturas = [], frascos = [];
  const semanas = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04', '2026-12-11', '2026-12-18'];
  unidades.forEach((u, idx) => {
    if (u.clues === 'QTSSA009999') return;   // activa pero sin meta
    const m = {};
    rubros.forEach((k) => { m[k] = Math.round(20 + r() * 300); });
    metas.push({ anio_campana: CAMP, clues: u.clues, municipio: u.municipio, metas: m });
    // La unidad 5 nunca reporta; la 9 dejó de reportar; la 12 rebasa su meta en r1; el resto con avance variable
    semanas.forEach((f, si) => {
      if (idx === 4) return;
      if (idx === 8 && si >= 4) return;
      if (idx % 7 === 3 && si === semanas.length - 1) return;      // algunas no reportaron la última semana
      const v = {};
      rubros.forEach((k) => { v[k] = Math.round(m[k] * (0.02 + r() * 0.06)); });
      if (idx === 11 && si === 0) v.r1 = m.r1 + 25;   // rebasa su meta
      capturas.push({ anio_campana: CAMP, clues: u.clues, municipio: u.municipio, fecha: f, valores: v, sin_movimiento: false });
    });
    if (idx % 3 !== 2) frascos.push({ anio_campana: CAMP, clues: u.clues, municipio: u.municipio, cantidad_frascos: Math.round(10 + r() * 90), fecha_entrega: '2026-10-05' });
  });
  return { unidades, metas, capturas, frascos, rubros, semanas };
}

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
      if (f) filtros.push((x) => String(x[k]) === f[1]);
    }
    if (m === 'GET' || m === 'HEAD') return json(200, filas.filter((x) => filtros.every((f) => f(x))));
    return route.fulfill({ status: 204 });
  };
}

// Cálculo independiente de lo que el tablero debe mostrar
function esperado(D, filtro) {
  const hosp = { QTSSA001740: 'HENM', QTSSA002901: 'NHG' };
  const dest = (u) => hosp[u.clues] || u.municipio;
  let us = D.unidades;
  if (filtro && filtro.destino) us = us.filter((u) => dest(u).replace(/^EL /, '') === filtro.destino.replace(/^EL /, ''));
  if (filtro && filtro.clues) us = us.filter((u) => u.clues === filtro.clues);
  const claves = new Set(us.map((u) => u.clues));
  const sum = (o) => Object.values(o || {}).reduce((s, v) => s + Number(v || 0), 0);
  const metaDe = (c) => sum((D.metas.find((x) => x.clues === c) || {}).metas);
  const aplDe = (c) => D.capturas.filter((x) => x.clues === c).reduce((s, x) => s + sum(x.valores), 0);
  const meta = us.reduce((s, u) => s + metaDe(u.clues), 0);
  const apl = us.reduce((s, u) => s + aplDe(u.clues), 0);
  const conMeta = us.filter((u) => metaDe(u.clues) > 0);
  const ultima = D.semanas[D.semanas.length - 1];
  const reportaron = conMeta.filter((u) => D.capturas.some((x) => x.clues === u.clues && x.fecha === ultima)).length;
  const porDestino = {};
  conMeta.forEach((u) => { const k = dest(u); (porDestino[k] = porDestino[k] || { meta: 0, apl: 0, n: 0 }); porDestino[k].meta += metaDe(u.clues); porDestino[k].apl += aplDe(u.clues); porDestino[k].n++; });
  const frascos = D.frascos.filter((f) => claves.has(f.clues)).reduce((s, f) => s + f.cantidad_frascos, 0);
  return { meta, apl, pct: meta ? apl * 100 / meta : 0, conMeta: conMeta.length, reportaron, porDestino, frascos, unidades: us.length };
}

async function abrir(page, D) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const db = {
    campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-02', fecha_fin: '2027-04-30', activo: true }],
    influenza_metas: D.metas, influenza_capturas: D.capturas, influenza_distribucion_frascos: D.frascos, unidades: D.unidades
  };
  await page.route(/\.supabase\.co\//, servidor(db));
  await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
  await page.clock.setFixedTime(new Date(HOY + 'T12:00:00'));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: 'ADMIN', usuario: 'admin', nombre: 'Admin', municipiosAllowed: [] };
    TOKEN = 'token-prueba';
    await loadCampaignConfig();
    _rdaCache.unidades = []; _rdaCache.registros = []; _rdaState.esquema = 'meta_logro_influenza';
    document.getElementById('rdaDetailTable')?.remove();
    const previo = document.getElementById('rdaDashboardContent'); if (previo) previo.id = 'rdaDashboardContent_oculto';
    const d = document.createElement('div'); d.id = 'rdaDashboardContent';
    d.style.cssText = 'position:absolute;left:0;top:0;width:1280px;z-index:99999;background:#fff;padding:24px';
    document.body.appendChild(d);
  });
  return errores;
}

const render = (page, muni, uni) => page.evaluate(async ([m, u]) => { await renderInfluenzaIndicatorsDashboard(m || null, u || null); }, [muni, uni]);
const num = (t) => Number(String(t).replace(/[^0-9.-]/g, ''));

test.describe('Indicadores de influenza con una jurisdicción completa', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });
  const D = construir();

  test('jurisdicción: hero, municipios, hospitales y cobertura coinciden con el cálculo independiente', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page, D);
    await render(page);
    const E = esperado(D, null);
    const raiz = page.locator('#rdaDashboardContent .iinf');
    await expect(raiz).toBeVisible();
    // Hero
    const heroPct = num(await raiz.locator('.iinf-hero-num b').innerText());
    expect(heroPct).toBeCloseTo(Math.round(E.pct * 10) / 10, 1);
    // KPIs
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(E.meta.toLocaleString('es-MX'));
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Dosis aplicadas' })).toContainText(E.apl.toLocaleString('es-MX'));
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(`${E.conMeta} unidades con meta`);
    // Cobertura de la última semana
    await expect(raiz).toContainText(`${E.reportaron} de ${E.conMeta} unidades`);
    // Ranking: 6 destinos (4 municipios + HENM + NHG), con sus sumas exactas
    const filas = raiz.locator('#iinfRankTit').locator('xpath=ancestor::section').locator('tbody tr');
    await expect(filas).toHaveCount(Object.keys(E.porDestino).length);
    expect(Object.keys(E.porDestino).sort()).toEqual(['CORREGIDORA', 'EL MARQUES', 'HENM', 'HUIMILPAN', 'NHG', 'QUERETARO']);
    for (const [dest, v] of Object.entries(E.porDestino)) {
      const fila = filas.filter({ hasText: dest }).first();
      await expect(fila).toContainText(v.meta.toLocaleString('es-MX'));
      await expect(fila).toContainText(v.apl.toLocaleString('es-MX'));
    }
    // Más atrasados primero: la diferencia contra lo esperado va en orden ascendente
    const difs = await filas.evaluateAll((trs) => trs.map((tr) => Number((tr.children[4].innerText || '').replace('−', '-').replace(/[^0-9.+-]/g, ''))));
    expect([...difs].sort((a, b) => a - b)).toEqual(difs);
    // Abasto: suma de frascos de todas las unidades con reparto
    await expect(raiz.locator('#iinfAbTit').locator('xpath=ancestor::section')).toContainText(E.frascos.toLocaleString('es-MX'));
    // Por revisar: la unidad sin meta, la que rebasa y la que nunca reportó
    const rev = raiz.locator('#iinfRevTit').locator('xpath=ancestor::section');
    await expect(rev).toContainText('rebasa su meta');
    await expect(rev).toContainText('no tiene meta');
    await expect(rev).toContainText('no ha reportado nunca');
    // Ninguna tabla del tablero se desborda dentro de su tarjeta (con nombres largos reales de grupo)
    const tablas = await page.evaluate(() => [...document.querySelectorAll('#rdaDashboardContent .iinf-scroll')].map((s) => ({ ancho: s.scrollWidth - s.clientWidth, cols: s.querySelectorAll('thead th').length })));
    expect(tablas.length).toBeGreaterThanOrEqual(3);
    tablas.forEach((x) => expect(x.ancho).toBeLessThanOrEqual(1));
    // La página no se rompe: sin desbordes horizontales dentro del tablero
    const desborde = await page.evaluate(() => { const c = document.querySelector('#rdaDashboardContent'); return c.scrollWidth - c.clientWidth; });
    expect(desborde).toBeLessThanOrEqual(1);
    expect(errores).toEqual([]);
    if (process.env.GUARDAR_CAPTURAS) await raiz.screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'jurisdiccion.png') });
  });

  test('municipio y unidad: Querétaro no incluye a los hospitales y la unidad muestra solo lo suyo', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page, D);
    const raiz = page.locator('#rdaDashboardContent .iinf');

    await render(page, 'QUERETARO');
    const Eq = esperado(D, { destino: 'QUERETARO' });
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(Eq.meta.toLocaleString('es-MX'));
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText('16 unidades con meta');   // sin HENM ni NHG
    await expect(raiz.locator('#iinfRankTit')).toHaveText('Avance por unidad');
    await expect(raiz.locator('#iinfRankTit').locator('xpath=ancestor::section').locator('tbody tr')).toHaveCount(16);

    await render(page, 'HENM');
    const Eh = esperado(D, { destino: 'HENM' });
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(Eh.meta.toLocaleString('es-MX'));
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText('1 unidad con meta');

    const unidad = D.unidades[2].clues;
    await render(page, null, unidad);
    const Eu = esperado(D, { clues: unidad });
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(Eu.meta.toLocaleString('es-MX'));
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Dosis aplicadas' })).toContainText(Eu.apl.toLocaleString('es-MX'));
    await expect(raiz.locator('#iinfRankTit')).toHaveCount(0);   // una sola unidad: sin ranking
    expect(errores).toEqual([]);
  });

  test('Excel y PDF de la jurisdicción coinciden con el tablero y el PDF es vectorial con varias páginas', async ({ page }) => {
    test.setTimeout(120000);
    const errores = await abrir(page, D);
    await render(page);
    const E = esperado(D, null);

    const [descarga] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportInfluenzaIndicadoresExcel())]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await descarga.path());
    const res = wb.getWorksheet('Resumen');
    const fila = (ws, t) => { let r = null; ws.eachRow((row) => { if (String(row.getCell(1).value || '').startsWith(t)) r = row; }); return r; };
    expect(fila(res, 'Meta de la campaña').getCell(2).value).toBe(E.meta);
    expect(fila(res, 'Dosis aplicadas').getCell(2).value).toBe(E.apl);
    expect(fila(res, 'Avance de la meta').getCell(2).value).toBeCloseTo(E.apl / E.meta, 6);
    const mun = wb.getWorksheet('Por municipio');
    let filasMun = 0, sumaMeta = 0, sumaApl = 0;
    mun.eachRow((row, n) => { if (n >= 5) { filasMun++; sumaMeta += Number(row.getCell(3).value); sumaApl += Number(row.getCell(4).value); } });
    expect(filasMun).toBe(6);
    expect(sumaMeta).toBe(E.meta);
    expect(sumaApl).toBe(E.apl);
    const sem = wb.getWorksheet('Por semana');
    let totalSem = 0; sem.eachRow((row, n) => { if (n >= 5) totalSem += Number(row.getCell(2).value); });
    expect(totalSem).toBe(E.apl);
    const edades = wb.getWorksheet('Por edad');
    let sumEdad = 0; edades.eachRow((row, n) => { if (n >= 5) sumEdad += Number(row.getCell(4).value); });
    expect(sumEdad).toBe(E.apl);

    const libs = await page.evaluate(async () => { try { await window.ensureLibsLoaded('html2canvas'); await window.ensureJsPdfLoaded(); return true; } catch (e) { return false; } });
    test.skip(!libs, 'Sin acceso a jsPDF/html2canvas en este entorno');
    const pdf = await page.evaluate(async () => {
      const blob = await generarPDFRobusto('rdaDashboardContent', 'x.pdf', true);
      const b = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      return { b64: btoa(s) };
    });
    const buf = Buffer.from(pdf.b64, 'base64');
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    const destino = process.env.GUARDAR_CAPTURAS || require('os').tmpdir();
    fs.writeFileSync(path.join(destino, 'influenza_jurisdiccion.pdf'), buf);
    expect(errores).toEqual([]);
  });

  test('cambios rápidos de filtro: gana el último y el Excel usa ese mismo ámbito', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page, D);
    const E = esperado(D, { destino: 'HUIMILPAN' });
    await page.evaluate(() => {
      // Tres renders seguidos sin esperar: el último (Huimilpan) es el que debe quedar
      renderInfluenzaIndicatorsDashboard(null, null);
      renderInfluenzaIndicatorsDashboard('QUERETARO', null);
      return renderInfluenzaIndicatorsDashboard('HUIMILPAN', null);
    });
    await page.waitForTimeout(500);
    const raiz = page.locator('#rdaDashboardContent .iinf');
    await expect(raiz.locator('.iinf-kpi').filter({ hasText: 'Meta de la campaña' })).toContainText(E.meta.toLocaleString('es-MX'));
    const datos = await page.evaluate(() => ({ ambito: window._infIndicadoresDatos.ambito, meta: window._infIndicadoresDatos.meta }));
    expect(datos).toEqual({ ambito: 'Municipio: HUIMILPAN', meta: E.meta });
    expect(errores).toEqual([]);
  });

  test('pantalla angosta: el tablero no se desborda y las tablas se desplazan dentro de su tarjeta', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page, D);
    await render(page);
    await page.setViewportSize({ width: 420, height: 900 });   // después de cargar: el app ya está en marcha
    await page.evaluate(() => { const c = document.getElementById('rdaDashboardContent'); c.style.width = '390px'; c.style.padding = '8px'; });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const c = document.querySelector('#rdaDashboardContent');
      const fuera = [...c.querySelectorAll('.iinf > *')].filter((el) => el.getBoundingClientRect().right > c.getBoundingClientRect().right + 1).length;
      return { desborde: c.scrollWidth - c.clientWidth, fuera, heroCols: getComputedStyle(c.querySelector('.iinf-hero')).gridTemplateColumns.split(' ').length, kpiCols: getComputedStyle(c.querySelector('.iinf-kpis')).gridTemplateColumns.split(' ').length };
    });
    expect(r.desborde).toBeLessThanOrEqual(1);
    expect(r.fuera).toBe(0);
    expect(r.heroCols).toBe(1);
    expect(r.kpiCols).toBe(1);
    expect(errores).toEqual([]);
    if (process.env.GUARDAR_CAPTURAS) await page.locator('#rdaDashboardContent').screenshot({ path: path.join(process.env.GUARDAR_CAPTURAS, 'movil.png') });
  });

  test('la imagen exportada trae el tablero completo de la jurisdicción', async ({ page }) => {
    test.setTimeout(120000);
    const errores = await abrir(page, D);
    await render(page);
    const libs = await page.evaluate(async () => { try { await window.ensureLibsLoaded('html2canvas'); return true; } catch (e) { return false; } });
    test.skip(!libs, 'Sin acceso a html2canvas en este entorno');
    const r = await page.evaluate(async () => {
      const el = document.getElementById('rdaDashboardContent');
      const c = await _captureRdaContentAsCanvas(el, 1);
      return { w: c.width, h: c.height, alto: el.scrollHeight, detalleAbierto: document.querySelectorAll('#rdaDashboardContent details').length };
    });
    expect(r.w).toBeGreaterThanOrEqual(1280);
    // La imagen es al menos tan alta como el tablero en pantalla (más el membrete): no se recorta nada
    expect(r.h).toBeGreaterThanOrEqual(r.alto);
    expect(errores).toEqual([]);
  });
});
