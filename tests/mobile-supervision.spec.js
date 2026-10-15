// Móvil de supervisión: barra por rol, Resumen (quién capturó) y alcance de unidades.
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;

const UNIDADES = [
  { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'QTSSA000111', unidad: 'El Pueblito', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', activo: 'SI' },
  { clues: 'QTSSA000333', unidad: 'FAM Sierra', municipio: 'AMEALCO', activo: 'SI' }
];

function servidor(perfil, rpcExtra = {}) {
  const rpc = {
    get_captures_sr_range_bypass: [{ clues: 'QTSSA000830', fecha: '2026-10-22' }, { clues: 'QTSSA000333', fecha: '2026-10-22' }],
    get_captures_cons_range_bypass: [],
    get_captures_bio_range_bypass: [{ clues: 'QTSSA000111', fecha: '2026-10-05', tipo_pedido: 'MENSUAL' }],
    get_rda_max_mes: 10,
    get_rda_indicators: [
      { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', pob_menor_1: 100, pob_1_ano: 100, pob_4_anos: 100, bcg_dosis: 400, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0, hexa_ref_dosis: 100, neumo_ref_dosis: 100, srp_2_dosis: 100, dpt_4_dosis: 50 },
      { clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', pob_menor_1: 50, pob_1_ano: 50, pob_4_anos: 50, bcg_dosis: 10, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0, hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0 }
    ],
    get_history_metrics_rpc: [
      { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', bio_semanas_ok: 4, cons_semanas_ok: 4, pedido_mensual: true, ultima_captura: '2026-10-22', ebio: 4, econs: 4 },
      { clues: 'QTSSA000111', unidad: 'El Pueblito', municipio: 'CORREGIDORA', bio_semanas_ok: 1, cons_semanas_ok: 2, pedido_mensual: false, ultima_captura: '2026-10-09', ebio: 4, econs: 4 }
    ]
  };
  const tablas = { perfiles: [perfil], unidades: UNIDADES };
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(b) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.startsWith('/auth/v1')) return json({ user: null, session: null });
    if (!url.pathname.startsWith('/rest/v1/')) return json({});
    const nombre = url.pathname.replace('/rest/v1/', '');
    if (nombre.startsWith('rpc/')) {
      const fn = nombre.slice(4);
      const h = rpcExtra[fn];
      if (h) { let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ } return json(h(b || {})); }
      return json(rpc[fn] || null);
    }
    const filas = tablas[nombre] || [];
    if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) return filas.length === 1 ? json(filas[0]) : json({ code: 'PGRST116', message: 'x' }, 406);
    return json(filas);
  };
}

async function abrir(page, perfil, ahora = '2026-10-22T12:00:00', rpcExtra = {}) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, servidor({ id: 'u1', usuario: 'sup', nombre: 'Sup', clues: '', unidad: '', municipio: '', activo: 'SI', ...perfil }, rpcExtra));
  await page.clock.setFixedTime(new Date(ahora));
  await page.addInitScript(() => {
    localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
      access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
      user: { id: 'u1', email: 'sup@x.mx', user_metadata: {} }
    }));
  });
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
  await page.waitForSelector('body.sup-mode', { timeout: 10000 });
  return errores;
}

const barra = (page) => page.$$eval('#mobileCaptureDock .dock-item', (b) => b.map((x) => x.dataset.panel));

test.describe('Móvil · supervisión', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Municipal: barra Resumen·Influenza·Avisos·Capacitación·Más y solo sus municipios', async ({ page }) => {
    const errores = await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    expect(await barra(page)).toEqual(['RES', 'INF', 'AVI', 'CAL', 'MAS']);
    await expect(page.locator('#panelRES')).toBeVisible();
    await expect(page.locator('.sv-unidad')).toHaveCount(1); // faltan: Corregidora sin captura de SR → El Pueblito
    await expect(page.locator('.sv-unidad').first()).toContainText('El Pueblito');
    await page.click('[data-filtro="todas"]');
    await expect(page.locator('.sv-unidad')).toHaveCount(2);
    await expect(page.locator('#hubSaveBtn')).toBeHidden();
    expect(errores).toEqual([]);
  });

  test('Jurisdiccional ve todas las unidades y cambia de tipo de captura', async ({ page }) => {
    await abrir(page, { rol: 'JURISDICCIONAL' });
    await page.click('[data-filtro="todas"]');
    await expect(page.locator('.sv-unidad')).toHaveCount(4);
    await page.click('[data-tipo="BIO"]');
    await expect(page.locator('.sv-pct')).toHaveText('25%');
    await page.click('[data-filtro="capturadas"]');
    await expect(page.locator('.sv-unidad')).toHaveCount(1);
    await expect(page.locator('.sv-unidad').first()).toContainText('El Pueblito');
  });

  test('Caravanas solo ve FAM/UMME; Visualizador es solo lectura y sin Avisos ni Influenza', async ({ page }) => {
    await abrir(page, { rol: 'CARAVANAS' });
    expect(await barra(page)).toEqual(['RES', 'AVI', 'CAL', 'MAS']);
    await page.click('[data-filtro="todas"]');
    await expect(page.locator('.sv-unidad')).toHaveCount(1);
    await expect(page.locator('.sv-unidad')).toContainText('FAM Sierra');
  });

  test('Visualizador: solo lectura', async ({ page }) => {
    await abrir(page, { rol: 'VISUALIZADOR_JURISDICCIONAL' });
    expect(await barra(page)).toEqual(['RES', 'CAL', 'MAS']);
    await expect(page.locator('.sv-ro')).toBeVisible();
  });

  test('Más: Admin separa próximamente de solo-escritorio', async ({ page }) => {
    await abrir(page, { rol: 'ADMIN' });
    await page.click('.dock-item[data-panel="MAS"]');
    await expect(page.locator('#panelMAS')).toBeVisible();
    await expect(page.locator('.sv-mas--desk')).toContainText('SINBA-SIS');
    await expect(page.locator('[data-ir="SEG"]')).toBeVisible();
  });

  test('Indicadores RDA: cobertura básica, chip de municipio y regreso a Más', async ({ page }) => {
    const errores = await abrir(page, { rol: 'JURISDICCIONAL' });
    await page.click('.dock-item[data-panel="MAS"]');
    await page.click('[data-ir="RDA"]');
    await expect(page.locator('#panelRDA')).toBeVisible();
    await expect(page.locator('.dock-item[data-panel="MAS"]')).toHaveClass(/active/);
    // Pob 150: factor 150*0.0833*10 = 124.95; dosis <1 = 410 /4 = 102.5 → 82%
    await expect(page.locator('.sv-kpi-val').first()).toContainText('82');
    await expect(page.locator('#supRdaRoot .sv-unidad')).toHaveCount(2);
    await expect(page.locator('#supRdaRoot .sv-unidad').first()).toContainText('La Cañada'); // menor avance primero
    await expect(page.locator('#supRdaRoot .sv-nota').first()).toContainText('Sin registro en el RDA');
    await page.click('[data-muni="EL MARQUES"]');
    await expect(page.locator('#supRdaRoot .sv-unidad')).toHaveCount(1);
    await page.click('#supRdaRoot [data-back]');
    await expect(page.locator('#panelMAS')).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('Métricas: captura semanal, filtro de incompletas y mes siguiente deshabilitado', async ({ page }) => {
    const errores = await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await page.click('.dock-item[data-panel="MAS"]');
    await page.click('[data-ir="MET"]');
    await expect(page.locator('#panelMET')).toBeVisible();
    await expect(page.locator('#supMetRoot .sv-pct')).toHaveText('69%'); // (100 + 38)/2
    await expect(page.locator('#supMetRoot .sv-unidad')).toHaveCount(1);
    await expect(page.locator('#supMetRoot .sv-unidad')).toContainText('El Pueblito');
    await page.click('[data-mfiltro="todas"]');
    await expect(page.locator('#supMetRoot .sv-unidad')).toHaveCount(2);
    await expect(page.locator('[data-mes="1"]')).toBeDisabled();
    expect(errores).toEqual([]);
  });

  test('Entre semana sin captura: muestra la semana anterior con aviso y permite volver a la actual', async ({ page }) => {
    // Miércoles 14 oct: la semana 12–18 aún no tiene capturas; la del 5–11 sí.
    const sr = (b) => (b.p_fecha_inicio >= '2026-10-12' ? [] : [{ clues: 'QTSSA000830', fecha: '2026-10-08' }]);
    await abrir(page, { rol: 'JURISDICCIONAL' }, '2026-10-14T12:00:00', { get_captures_sr_range_bypass: sr });
    await expect(page.locator('.sv-aviso')).toContainText('semana anterior');
    await expect(page.locator('[data-atras="1"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#supRoot .sv-avance-cab small')).toContainText('5 oct');
    await expect(page.locator('#supRoot .sv-pct')).toHaveText('25%');
    await page.click('[data-atras="0"]');
    await expect(page.locator('#supRoot .sv-pct')).toHaveText('0%');
    await expect(page.locator('.sv-aviso')).toHaveCount(0);
  });

  test('Pedido del mes sin registros: explica por qué y ofrece el mes anterior', async ({ page }) => {
    await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' }, '2026-10-14T12:00:00', { get_captures_bio_range_bypass: () => [] });
    await page.click('[data-tipo="BIO"]');
    await expect(page.locator('.sv-aviso')).toContainText('Aún no hay pedidos');
    await expect(page.locator('[data-atras="1"]')).toBeVisible();
  });

  test('Indicadores RDA muestra la carga mientras calcula', async ({ page }) => {
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    await abrir(page, { rol: 'JURISDICCIONAL' });
    await page.route('**/rpc/get_rda_indicators*', async (route) => { await espera; await route.fallback(); });
    await page.click('.dock-item[data-panel="MAS"]');
    await page.click('[data-ir="RDA"]');
    await expect(page.locator('#supRdaRoot .sv-cargando')).toContainText('Calculando');
    liberar();
  });

  test('Perfil de supervisión no muestra CLUES ni unidad vacíos', async ({ page }) => {
    await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    const vis = await page.evaluate(() => ['profileClues', 'profileUnidad'].map((id) => getComputedStyle(document.getElementById(id).parentElement).display));
    expect(vis).toEqual(['none', 'none']);
  });
});
