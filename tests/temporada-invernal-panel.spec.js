// Temporada invernal: un solo tablero (Ambas | Influenza | COVID-19) en Indicadores. Las cifras se comparan con un
// cálculo independiente hecho aquí con los mismos datos.
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;
const CAMP = 'Campaña Influenza 2026-2027';
const HOY = '2026-11-20';   // viernes
const SEMANAS = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13'];

const unidades = [
  { clues: 'QTSSA000001', unidad: 'Q UNIDAD 1', municipio: 'QUERETARO', activo: 'SI' },
  { clues: 'QTSSA000002', unidad: 'Q UNIDAD 2', municipio: 'QUERETARO', activo: 'SI' },
  { clues: 'QTSSA000003', unidad: 'C UNIDAD 1', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'QTSSA001740', unidad: 'HOSPITAL ENM', municipio: 'QUERETARO', activo: 'SI' }
];
const infMetas = unidades.map(u => ({ anio_campana: CAMP, clues: u.clues, municipio: u.municipio, metas: { r1: 1000 } }));
const infCaps = [];
unidades.forEach((u, i) => SEMANAS.forEach(f => infCaps.push({ anio_campana: CAMP, clues: u.clues, municipio: u.municipio, fecha: f, valores: { r1: 20 + i }, sin_movimiento: false })));
// COVID: meta por destino (sin clues). Q UNIDAD 2 nunca reporta COVID-19.
const covMetas = [
  { anio_campana: CAMP, municipio: 'QUERETARO', clues: null, metas: { c1: 20, c2: 20, c3: 100, c4: 200, c5: 30, c6: 50 } },   // 40/2 + 380 = 400
  { anio_campana: CAMP, municipio: 'CORREGIDORA', clues: null, metas: { c3: 100, c4: 100 } },                                  // 200
  { anio_campana: CAMP, municipio: 'HENM', clues: null, metas: { c4: 100 } }                                                  // 100
  ,{ anio_campana: CAMP, municipio: 'QUERETARO', clues: 'QTSSA000001', metas: { c1: 10, c2: 10, c3: 40, c4: 100 } }   // la municipal bajó una parte a Q UNIDAD 1: 150
];
const covCaps = [];
const cap = (clues, f, mod, pfz) => covCaps.push({ anio_campana: CAMP, clues, municipio: 'X', fecha: f, valores: { MODERNA: mod, PFIZER: pfz }, sin_movimiento: false });
SEMANAS.forEach(f => {
  cap('QTSSA000001', f, { c1: 4, c2: 0, c4: 6 }, { c3: 2 });     // 2 + 6 + 2 = 10 eq por semana
  cap('QTSSA000003', f, { c4: 5 }, { c3: 5 });                   // 10 eq por semana
});
cap('QTSSA001740', '2026-11-13', { c4: 8 }, {});                 // 8 eq
const covFrascos = [
  { anio_campana: CAMP, clues: 'QTSSA000001', municipio: 'QUERETARO', marca: 'MODERNA', cantidad_frascos: 10 },
  { anio_campana: CAMP, clues: 'QTSSA000001', municipio: 'QUERETARO', marca: 'PFIZER', cantidad_frascos: 1 }
];

function servidor(db) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
    if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
    const nombre = url.pathname.replace('/rest/v1/', '');
    if (nombre.startsWith('rpc/')) return json(200, null);
    const filtros = [];
    for (const [k, v] of url.searchParams.entries()) { const f = v.match(/^eq\.(.*)$/s); if (f) filtros.push((x) => String(x[k]) === f[1]); }
    return json(200, (db[nombre] || []).filter((x) => filtros.every((f) => f(x))));
  };
}

async function abrir(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const db = {
    campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-02', fecha_fin: '2027-04-30', activo: true }],
    influenza_metas: infMetas, influenza_capturas: infCaps, influenza_distribucion_frascos: [], unidades,
    covid_metas: covMetas, covid_capturas: covCaps, covid_distribucion_frascos: covFrascos
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
    const previo = document.getElementById('rdaDashboardContent'); if (previo) previo.id = 'rdaDashboardContent_oculto';
    const d = document.createElement('div'); d.id = 'rdaDashboardContent';
    d.style.cssText = 'position:absolute;left:0;top:0;width:1280px;z-index:99999;background:#fff;padding:24px';
    document.body.appendChild(d);
  });
  return errores;
}
const render = (page, muni, uni) => page.evaluate(async ([m, u]) => { await renderTemporadaInvernalDashboard(m || null, u || null); }, [muni, uni]);

test.describe('Temporada invernal: Influenza y COVID-19 en un tablero', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('pestañas, avance combinado y COVID-19 por marca coinciden con el cálculo independiente', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page);
    await render(page);
    const tabs = page.locator('#rdaDashboardContent .tinv-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

    // Influenza: 4 unidades x 5 semanas, 20..23 dosis por semana
    const infApl = 5 * (20 + 21 + 22 + 23), infMeta = 4000;
    // COVID-19: 5 semanas x (10 + 10) + 8 equivalentes
    const covApl = 5 * 20 + 8, covMeta = 400 + 200 + 100;
    const ambas = page.locator('#tinvCuerpo');
    await expect(ambas.locator('.iinf-hero')).toContainText('Avance de la temporada invernal');
    const pct = ((infApl + covApl) * 100 / (infMeta + covMeta)).toFixed(1);
    await expect(ambas.locator('.iinf-hero-num b')).toContainText(pct);
    await expect(ambas.locator('.tinv-vac--inf')).toContainText(`${infApl.toLocaleString('es-MX')} de ${infMeta.toLocaleString('es-MX')} dosis`);
    await expect(ambas.locator('.tinv-vac--cov')).toContainText(`${covApl} de ${covMeta} dosis equivalentes`);
    // Q UNIDAD 2 nunca reportó COVID-19 (sí Influenza)
    await expect(ambas.locator('.tinv-cruce')).toContainText('Falta COVID-19');
    await expect(ambas.locator('#tinvCobTit')).toContainText('Reporte de la semana del');
    await expect(ambas.locator('#tinvCruceTit')).toBeVisible();
    await expect(ambas.locator('section:has(#tinvCruceTit) .iinf-tabla')).toContainText('QUERETARO');
    await expect(ambas.locator('section:has(#tinvCruceTit) .iinf-tabla')).toContainText('CORREGIDORA');

    // COVID-19
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    const cov = page.locator('#tinvCuerpo');
    await expect(cov.locator('.iinf-hero-num b')).toContainText((covApl * 100 / covMeta).toFixed(1));
    await expect(cov.locator('#tinvCMarTit')).toBeVisible();
    await expect(cov.locator('.tinv-marca').first()).toContainText('Moderna');
    await expect(cov.locator('.tinv-marca').first()).toContainText('10 frascos repartidos');
    await expect(cov.locator('#tinvCGrpTit')).toBeVisible();

    // Influenza: el tablero de siempre
    await tabs.nth(1).click();
    await expect(page.locator('#tinvCuerpo .iinf-hero')).toContainText('Avance de la campaña');
    expect(errores).toEqual([]);
  });

  test('navegación con flechas y vista de una sola unidad', async ({ page }) => {
    test.setTimeout(60000);
    const errores = await abrir(page);
    await render(page, 'QUERETARO', 'QTSSA000001');
    const tabs = page.locator('#rdaDashboardContent .tinv-tab');
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    // Unidad 1: 10 equivalentes por semana x 5 = 50 de su meta de 150
    await expect(page.locator('#tinvCuerpo .iinf-hero-txt')).toContainText('50 de 150');
    expect(errores).toEqual([]);
  });

  test('Excel y PDF: COVID-19 va en el mismo libro con el formato de la plantilla oficial y en el PDF', async ({ page }) => {
    test.setTimeout(120000);
    const errores = await abrir(page);
    await render(page);
    const covApl = 5 * 20 + 8, covMeta = 700;

    // Excel Meta-Logro (plantilla oficial): hoja de Influenza intacta + hoja de COVID-19 con el mismo formato
    const [d1] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportInfluenzaMetaLogroPlantilla())]);
    expect(d1.suggestedFilename()).toContain('Temporada_Invernal');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await d1.path());
    expect(wb.worksheets.map(w => w.name)).toEqual(['ANÁLIS DE META-LOGRO', 'META-LOGRO COVID-19']);
    const ws = wb.getWorksheet('META-LOGRO COVID-19');
    const v = (r, c) => { const x = ws.getCell(r, c); const y = x.isMerged ? x.master.value : x.value; return y && y.result !== undefined ? y.result : y; };
    expect(String(v(4, 1))).toContain('COVID-19');
    const nombres = []; for (let c = 7; c <= 30; c += 3) { const x = ws.getCell(8, c).value; if (x) nombres.push(String(x)); }
    expect(nombres).toEqual(['QUERETARO', 'CORREGIDORA', 'HENM', 'TOTAL JURISDICCIÓN']);
    const colTotal = 7 + 3 * 3;
    expect(v(16, colTotal)).toBe(covApl);          // total aplicado (equivalentes de 0.5 mL)
    expect(v(16, colTotal + 1)).toBe(covMeta);     // meta total
    expect(v(17, colTotal) + v(18, colTotal)).toBe(covApl);   // Moderna + Pfizer
    expect(String(v(10, 6))).toContain('Primera');
    expect(ws.conditionalFormattings.length).toBeGreaterThanOrEqual(4);

    // Excel con las cifras: hojas de COVID-19
    const [d2] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportInfluenzaIndicadoresExcel())]);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(await d2.path());
    const nom = wb2.worksheets.map(w => w.name);
    expect(nom).toEqual(expect.arrayContaining(['Resumen', 'COVID-19 Resumen', 'COVID-19 Marcas', 'COVID-19 Por municipio', 'COVID-19 Por semana', 'COVID-19 Por grupo']));
    const res = wb2.getWorksheet('COVID-19 Resumen');
    let meta = null, apl = null;
    res.eachRow((row) => { const t = String(row.getCell(1).value || ''); if (t.startsWith('Meta de COVID-19')) meta = row.getCell(2).value; if (t.startsWith('Dosis aplicadas')) apl = row.getCell(2).value; });
    expect(meta).toBe(covMeta); expect(apl).toBe(covApl);
    const sem = wb2.getWorksheet('COVID-19 Por semana');
    let tot = 0; sem.eachRow((row, n) => { if (n >= 5) tot += Number(row.getCell(4).value); });
    expect(tot).toBe(covApl);

    // PDF: una página de COVID-19 con sus tablas
    const libs = await page.evaluate(async () => { try { await window.ensureLibsLoaded('html2canvas'); await window.ensureJsPdfLoaded(); return true; } catch (e) { return false; } });
    test.skip(!libs, 'Sin acceso a jsPDF/html2canvas en este entorno');
    const pdf = await page.evaluate(async () => {
      _rdaCache.unidades = []; _rdaCache.registros = []; _rdaState.esquema = 'meta_logro_influenza'; document.getElementById('rdaDetailTable')?.remove();
      const blob = await generarPDFRobusto('rdaDashboardContent', 'x.pdf', true);
      const b = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      return btoa(s);
    });
    const buf = Buffer.from(pdf, 'base64');
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(errores).toEqual([]);
  });
});
