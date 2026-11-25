// Panel "Concentrado de Aplicaciones" rediseñado: el motor (concentrado_motor.js, en Node) y la pantalla (con un Supabase
// simulado). Los datos son deterministas y las cifras esperadas se calculan aquí por separado, no con el motor.
const { test, expect } = require('@playwright/test');
const path = require('path');
const M = require('../concentrado_motor.js');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

// ── Datos ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const UNIDADES = [];
const MUNIS = [['QUERETARO', 6], ['CORREGIDORA', 4], ['MARQUÉS', 2], ['HUIMILPAN', 1]]; // la última unidad nunca captura
let n = 1;
MUNIS.forEach(([m, c]) => { for (let i = 0; i < c; i++) { const id = String(n++).padStart(2, '0'); UNIDADES.push({ clues: `QTSSA0000${id}`, nombre: `Unidad ${id}`, municipio: m, i: n - 1 }); } });
const CON_DATOS = UNIDADES.filter((u) => u.i <= 12);

// dosis por mes de una unidad (año consultado): influenza 10·i, hexavalente 5·i, SRP 3·i, BCG 2 en pares, VSR siempre 0
const base = (u) => ({ INFLUENZA: 10 * u.i, HEXAVALENTE: 5 * u.i, SRP: 3 * u.i, ...(u.i % 2 === 0 ? { BCG: 2 } : {}) });
// año anterior: U03 era 10 veces mayor (hoy cae 90%); U05 era la tercera parte (hoy sube 200%); el resto igual
const factorPrev = (u) => (u.i === 3 ? 10 : u.i === 5 ? 1 / 3 : 1);
const MESES_CORTE = 10;

function filasUnidad(anio, ini, fin) {
  const out = [];
  CON_DATOS.forEach((u) => {
    const f = anio === 2026 ? 1 : factorPrev(u);
    Object.entries(base(u)).forEach(([bio, v]) => out.push({ clues: u.clues, nombre: u.nombre, municipio: u.municipio, biologico: bio, total_dosis: Math.round(v * f) * (fin - ini + 1) }));
  });
  return out;
}
function filasMensual(anio) {
  const out = [];
  MUNIS.forEach(([muni]) => {
    const us = CON_DATOS.filter((u) => u.municipio === muni);
    if (!us.length) return;
    for (let mes = 1; mes <= (anio === 2026 ? MESES_CORTE : 12); mes++) {
      const bios = {};
      us.forEach((u) => Object.entries(base(u)).forEach(([b, v]) => { bios[b] = (bios[b] || 0) + Math.round(v * (anio === 2026 ? 1 : factorPrev(u))); }));
      const unidadesMes = anio === 2025 && mes === 6 ? Math.ceil(us.length / 2) : us.length; // junio 2025: captura parcial
      Object.entries(bios).forEach(([b, t]) => out.push({ municipio: muni, biologico: b, mes, total_dosis: t, unidades_mes: unidadesMes }));
    }
  });
  return out;
}
const esperado = (filtro = {}, ini = 1, fin = MESES_CORTE) => {
  const sel = filtro.sel ? new Set(filtro.sel) : null;
  let total = 0, prev = 0; const porUni = {};
  CON_DATOS.filter((u) => !filtro.muni || M.normUp(u.municipio) === filtro.muni).forEach((u) => {
    Object.entries(base(u)).forEach(([b, v]) => { if (!sel || sel.has(b)) { total += v * (fin - ini + 1); prev += Math.round(v * factorPrev(u)) * (fin - ini + 1); porUni[u.clues] = (porUni[u.clues] || 0) + v * (fin - ini + 1); } });
  });
  return { total, prev, porUni };
};

// ── Motor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('Motor del concentrado (Node)', () => {
  const entrada = (extra = {}) => ({ unidades: UNIDADES, filas: filasUnidad(2026, 1, 10), filasPrev: filasUnidad(2025, 1, 10), ...extra });

  test('total, comparativo y participación coinciden con el cálculo independiente', () => {
    const an = M.analiza(entrada());
    const E = esperado();
    expect(an.total).toBe(E.total);
    expect(an.prev).toBe(E.prev);
    expect(an.nUnidades).toBe(13);
    expect(an.conDatos).toBe(12);
    const inf = an.porBio.find((b) => b.key === 'INFLUENZA');
    expect(inf.total).toBe(CON_DATOS.reduce((s, u) => s + 10 * u.i * 10, 0));
    expect(an.porBio.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 6);
    expect(an.porBio.find((b) => b.key === 'VSR').total).toBe(0);
  });

  test('el filtro de biológicos cambia total, unidades y municipios pero NO los chips', () => {
    const an = M.analiza(entrada({ sel: ['INFLUENZA', 'SRP'] }));
    const E = esperado({ sel: ['INFLUENZA', 'SRP'] });
    expect(an.total).toBe(E.total);
    an.unidades.filter((u) => u.totalTodas > 0).forEach((u) => expect(u.total).toBe(E.porUni[u.clues]));
    expect(an.totalTodas).toBe(esperado().total); // los chips siguen viendo todo
    expect(an.porBio.find((b) => b.key === 'HEXAVALENTE').total).toBeGreaterThan(0);
    expect(an.porMuni.reduce((s, m) => s + m.total, 0)).toBe(E.total);
  });

  test('municipio con acento y búsqueda sin acentos', () => {
    expect(M.analiza(entrada({ municipio: 'MARQUES' })).nUnidades).toBe(2);
    expect(M.analiza(entrada({ busqueda: 'UNIDAD 0' })).nUnidades).toBe(9);
    expect(M.analiza(entrada({ busqueda: 'QTSSA000005' })).unidades[0].nombre).toBe('Unidad 05');
  });

  test('cambio por unidad: caída de U03, alza de U05 y "sin comparativo" cuando no hay año anterior', () => {
    const an = M.analiza(entrada());
    const u3 = an.unidades.find((u) => u.nombre === 'Unidad 03'), u5 = an.unidades.find((u) => u.nombre === 'Unidad 05');
    expect(u3.delta).toBeCloseTo(-0.9, 2);
    expect(u5.delta).toBeCloseTo(2, 1);
    expect(M.analiza(entrada({ filasPrev: null })).delta).toBeNull();
    expect(M.analiza(entrada({ filasPrev: null })).unidades.every((u) => u.delta === null)).toBe(true);
  });

  test('hallazgos: unidad sin dosis, caída fuerte, alza fuerte, VSR no se alerta (nunca tuvo) y concentración', () => {
    const an = M.analiza(entrada());
    const h = M.hallazgos(an, { rango: 'ene–oct 2026', rangoPrev: 'ene–oct 2025' });
    const ids = h.map((x) => x.id);
    expect(ids).toContain('sin-captura');
    expect(h.find((x) => x.id === 'sin-captura').titulo).toBe('1 unidad sin aplicaciones');
    expect(h.find((x) => x.id === 'sin-captura').texto).toContain('Unidad 13');
    expect(h.find((x) => x.id === 'caidas').texto).toContain('Unidad 03 (−90%)');
    expect(h.find((x) => x.id === 'alzas').texto).toContain('Unidad 05 (+200%)');
    expect(ids).not.toContain('bio-cero');
    expect(ids).toContain('concentracion');
  });

  test('un biológico que el año pasado sí se aplicó y hoy está en cero se avisa', () => {
    const prev = filasUnidad(2025, 1, 10).concat([{ clues: 'QTSSA000001', nombre: 'Unidad 01', municipio: 'QUERETARO', biologico: 'VSR', total_dosis: 400 }]);
    const h = M.hallazgos(M.analiza(entrada({ filasPrev: prev })), {});
    expect(h.find((x) => x.id === 'bio-cero').titulo).toContain('VSR');
  });

  test('serie mensual: marca captura parcial (jun-2025) y respeta municipio y biológico', () => {
    const s = M.serieMensual(filasMensual(2026), filasMensual(2025), {});
    expect(s).toHaveLength(12);
    expect(s[5].incompletoPrev).toBe(true);
    expect(s[5].incompleto).toBe(false);
    expect(s[10].conDatos).toBe(false); // noviembre 2026: aún sin captura
    const todas = CON_DATOS.reduce((t, u) => t + Object.values(base(u)).reduce((a, b) => a + b, 0), 0);
    expect(s[0].total).toBe(todas);
    const inf = M.serieMensual(filasMensual(2026), filasMensual(2025), { sel: ['INFLUENZA'], municipio: 'CORREGIDORA' });
    expect(inf[0].total).toBe(CON_DATOS.filter((u) => u.municipio === 'CORREGIDORA').reduce((t, u) => t + 10 * u.i, 0));
    const av = M.avisosDeComparacion(s, 1, 10, 2026);
    expect(av.some((x) => x.startsWith('jun-25 tiene captura parcial'))).toBe(true);
    expect(M.avisosDeComparacion(s, 7, 10, 2026)).toEqual([]);
  });

  test('orden: caída primero, alza primero, sin dosis primero', () => {
    const an = M.analiza(entrada());
    expect(M.ordena(an.unidades, 'caida')[0].nombre).toBe('Unidad 03');
    expect(M.ordena(an.unidades, 'alza')[0].nombre).toBe('Unidad 05');
    expect(M.ordena(an.unidades, 'sin')[0].nombre).toBe('Unidad 13');
    expect(M.ordena(an.unidades, 'total')[0].nombre).toBe('Unidad 12');
  });

  test('segmentos: los 8 con color propio van en orden fijo y el resto junto en gris', () => {
    const segs = M.segmentos({ BCG: 5, SRP: 3, INFLUENZA: 10, TD: 2 }, null);
    expect(segs.map((s) => s.key)).toEqual(['INFLUENZA', 'SRP', 'OTROS_GRIS']);
    expect(segs[2].v).toBe(7);
    expect(M.segmentos({ BCG: 5, SRP: 3 }, new Set(['SRP'])).map((s) => s.key)).toEqual(['SRP']);
  });
});

// ── Pantalla ───────────────────────────────────────────────────────────────────────────────────────────────────────
function servidor(rpcLog, opc = {}) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
    if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
    const nombre = url.pathname.replace('/rest/v1/', '');
    if (nombre.startsWith('rpc/')) {
      const fn = nombre.slice(4);
      const a = JSON.parse(req.postData() || '{}');
      rpcLog.push({ fn, a });
      const pagina = (filas) => json(200, filas.slice(a.p_offset || 0, (a.p_offset || 0) + (a.p_limit || 100000)));
      if (fn === 'get_rda_max_mes') return json(200, MESES_CORTE);
      if (fn === 'get_concentrado_por_biologico') return pagina(filasUnidad(a.p_anio, a.p_mes_ini, a.p_mes_fin));
      if (fn === 'get_concentrado_mensual') return opc.sinMensual ? json(404, { message: 'function not found' }) : pagina(filasMensual(a.p_anio));
      if (fn === 'get_concentrado_aplicaciones') {
        const filas = [];
        filasUnidad(a.p_anio, a.p_mes_ini, a.p_mes_fin).forEach((r) => { if (r.biologico === 'HEXAVALENTE') { filas.push({ ...r, variable_sis: 'HEXA_1', total_dosis: r.total_dosis - 1 }, { ...r, variable_sis: 'HEXA_2', total_dosis: 1 }); } else filas.push({ ...r, variable_sis: r.biologico }); });
        return pagina(filas);
      }
      return json(200, null);
    }
    if (nombre === 'unidades_medicas') return json(200, UNIDADES.map((u) => ({ clues: u.clues, nombre: u.nombre, municipio: u.municipio })));
    if (nombre === 'unidades') return json(200, UNIDADES.map((u) => ({ clues: u.clues, activo: 'SI' })));
    if (nombre === 'sis_variables_mapeo') return json(200, [{ biologico: 'HEXAVALENTE', variables: ['HEXA_1', 'HEXA_2'] }, { biologico: 'INFLUENZA', variables: ['INFLUENZA'] }, { biologico: 'SRP', variables: ['SRP'] }, { biologico: 'BCG', variables: ['BCG'] }]);
    return json(200, []);
  };
}

async function abrir(page, opc = {}) {
  const errores = [], rpcLog = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, servidor(rpcLog, opc));
  await page.route(/exceljs/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00'));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.initConcentradoPanel === 'function' && !!window.supabase && !!window.supabase.rpc, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    window.USER = { rol: 'JURISDICCIONAL', usuario: 'juris', nombre: 'Juris', municipiosAllowed: [] };
    const panel = document.getElementById('panelCONCENTRADO');
    // el panel vive dentro de contenedores ocultos mientras no hay sesión: se muestran todos hacia arriba
    for (let el = panel; el && el !== document.documentElement; el = el.parentElement) { if (getComputedStyle(el).display === 'none') el.style.setProperty('display', 'block', 'important'); if (getComputedStyle(el).visibility === 'hidden') el.style.visibility = 'visible'; }
    await window.initConcentradoPanel();
  });
  await expect(page.locator('#concRoot .cn-hero')).toBeVisible({ timeout: 15000 });
  return { errores, rpcLog };
}
const numTxt = (t) => Number(String(t).replace(/[^0-9]/g, ''));

test.describe('Pantalla del concentrado', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('hero, biológicos, hallazgos, municipios y ranking con cifras reales; el filtro por biológico lo recalcula todo', async ({ page }) => {
    test.setTimeout(60000);
    const { errores, rpcLog } = await abrir(page);
    const root = page.locator('#concRoot');
    const E = esperado();

    await expect(root.locator('#concKpiTotal')).toHaveText(E.total.toLocaleString('es-MX'));
    await expect(root.locator('.cn-hero-delta')).toContainText('ene–oct 2025');
    await expect(root.locator('#concKpiUnidades')).toContainText('12');
    // ritmo mensual con 12 meses y el aviso de comparación (jun-2025 parcial)
    await expect(root.locator('.cn-mes')).toHaveCount(12);
    await expect(root.locator('.cn-aviso')).toContainText('jun-25 tiene captura parcial');
    // 17 fichas de biológico; VSR sin dosis
    await expect(root.locator('.cn-chip')).toHaveCount(17);
    await expect(root.locator('.cn-chip', { hasText: 'VSR' })).toHaveClass(/is-cero/);
    // hallazgos reales
    await expect(root.locator('.cn-hall', { hasText: '1 unidad sin aplicaciones' })).toContainText('Unidad 13');
    await expect(root.locator('.cn-hall', { hasText: 'caen 40% o más' }).or(root.locator('.cn-hall', { hasText: 'cae 40% o más' }))).toContainText('Unidad 03');
    // municipios (4) con su total
    await expect(root.locator('.cn-muni-row')).toHaveCount(4);
    // ranking: 12 visibles de 13, primero la unidad con más dosis
    await expect(root.locator('.cn-row')).toHaveCount(12);
    await expect(root.locator('.cn-row').first()).toContainText('Unidad 12');
    await root.getByRole('button', { name: /Ver la unidad restante/ }).click();
    await expect(root.locator('.cn-row')).toHaveCount(13);

    // Filtro: Influenza → el total, el ranking y el hero se recalculan; los chips siguen mostrando todo
    await root.locator('.cn-chip', { hasText: 'Influenza' }).click();
    const EI = esperado({ sel: ['INFLUENZA'] });
    await expect(root.locator('#concKpiTotal')).toHaveText(EI.total.toLocaleString('es-MX'));
    await expect(root.locator('.cn-hero-sub').first()).toBeVisible();
    await expect(root.locator('.cn-eyebrow')).toContainText('Influenza');
    await expect(root.locator('.cn-chip')).toHaveCount(17);
    await expect(root.locator('.cn-chip.is-on')).toHaveCount(1);
    await expect(root.locator('.cn-chip', { hasText: 'Hexavalente' }).locator('.cn-chip-num')).toHaveText(esperado({ sel: ['HEXAVALENTE'] }).total.toLocaleString('es-MX'));
    // Segundo biológico: se suman
    await root.locator('.cn-chip', { hasText: 'SRP' }).click();
    await expect(root.locator('#concKpiTotal')).toHaveText(esperado({ sel: ['INFLUENZA', 'SRP'] }).total.toLocaleString('es-MX'));
    await root.getByRole('button', { name: /Quitar filtro/ }).click();
    await expect(root.locator('#concKpiTotal')).toHaveText(E.total.toLocaleString('es-MX'));

    // El comparativo y la serie mensual se pidieron: año consultado y año anterior
    expect(rpcLog.some((r) => r.fn === 'get_concentrado_por_biologico' && r.a.p_anio === 2025)).toBe(true);
    expect(rpcLog.filter((r) => r.fn === 'get_concentrado_mensual').map((r) => r.a.p_anio).filter((v, i, a) => a.indexOf(v) === i).sort()).toEqual([2025, 2026]);
    expect(errores).toEqual([]);
  });

  test('clic en un mes lo deja solo (y sincroniza los selectores); clic otra vez vuelve a enero–corte', async ({ page }) => {
    test.setTimeout(60000);
    const { errores } = await abrir(page);
    const root = page.locator('#concRoot');
    await root.locator('.cn-mes').nth(8).click(); // septiembre
    await expect(page.locator('#concFilterMesIni')).toHaveValue('9');
    await expect(page.locator('#concFilterMesFin')).toHaveValue('9');
    await expect(root.locator('#concKpiTotal')).toHaveText(esperado({}, 9, 9).total.toLocaleString('es-MX'));
    await expect(root.locator('.cn-eyebrow')).toContainText('septiembre 2026');
    await root.locator('.cn-mes').nth(8).click();
    await expect(page.locator('#concFilterMesIni')).toHaveValue('1');
    await expect(page.locator('#concFilterMesFin')).toHaveValue('10');
    await expect(root.locator('#concKpiTotal')).toHaveText(esperado().total.toLocaleString('es-MX'));
    expect(errores).toEqual([]);
  });

  test('municipio por clic: acota todo y el municipio activo se puede quitar; la búsqueda filtra unidades', async ({ page }) => {
    test.setTimeout(60000);
    const { errores } = await abrir(page);
    const root = page.locator('#concRoot');
    await root.locator('.cn-muni-row', { hasText: 'Corregidora' }).click();
    await expect(page.locator('#concFilterMunicipio')).toHaveValue('CORREGIDORA');
    await expect(root.locator('#concKpiTotal')).toHaveText(esperado({ muni: 'CORREGIDORA' }).total.toLocaleString('es-MX'));
    await expect(root.locator('.cn-muni-row')).toHaveCount(4); // los demás municipios siguen para poder cambiar
    await expect(root.locator('.cn-row')).toHaveCount(4);
    await root.locator('.cn-muni-row.is-on').click();
    await expect(page.locator('#concFilterMunicipio')).toHaveValue('');
    await page.locator('#concSearchUnidad').fill('unidad 05');
    await expect(root.locator('.cn-row')).toHaveCount(1);
    await expect(root.locator('.cn-row').first()).toContainText('Unidad 05');
    expect(errores).toEqual([]);
  });

  test('detalle de una unidad con su comparativo y, bajo demanda, las dosis por clave SIS', async ({ page }) => {
    test.setTimeout(60000);
    const { errores, rpcLog } = await abrir(page);
    const root = page.locator('#concRoot');
    expect(rpcLog.some((r) => r.fn === 'get_concentrado_aplicaciones')).toBe(false); // lo pesado no se pide al abrir
    await root.locator('.cn-row-cab', { hasText: 'Unidad 12' }).click();
    const det = root.locator('.cn-det');
    await expect(det).toContainText('Influenza');
    await expect(det).toContainText((10 * 12 * 10).toLocaleString('es-MX'));
    await expect(det).toContainText('el año pasado');
    await det.getByRole('button', { name: /dosis por clave SIS/ }).click();
    await expect(root.locator('.cn-claves code', { hasText: 'HEXA_1' }).first()).toBeVisible();
    await expect(root.locator('.cn-claves code', { hasText: 'HEXA_2' }).first()).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('matriz: columnas por biológico respetan el filtro y totales; por clave SIS pide el desglose', async ({ page }) => {
    test.setTimeout(60000);
    const { errores } = await abrir(page);
    const root = page.locator('#concRoot');
    await root.getByRole('button', { name: 'Matriz' }).click();
    const tabla = root.locator('.cn-tabla');
    await expect(tabla).toBeVisible();
    await expect(tabla.locator('thead th')).toHaveCount(3 + 18 + 1); // clues/unidad/municipio + 17 + OTROS + total
    await expect(tabla.locator('tr.cn-juris')).toContainText(esperado().total.toLocaleString('es-MX'));
    await root.locator('.cn-chip').first().scrollIntoViewIfNeeded();
    await root.locator('.cn-chip', { hasText: 'SRP' }).click();
    await expect(tabla.locator('thead th')).toHaveCount(3 + 1 + 1);
    await expect(tabla.locator('tr.cn-juris')).toContainText(esperado({ sel: ['SRP'] }).total.toLocaleString('es-MX'));
    await root.getByRole('button', { name: 'Clave SIS', exact: true }).click();
    await expect(tabla.locator('thead th').filter({ hasText: 'SRP' })).toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test('la serie mensual no disponible no rompe el resto del panel', async ({ page }) => {
    test.setTimeout(60000);
    const { errores } = await abrir(page, { sinMensual: true });
    const root = page.locator('#concRoot');
    await expect(root.locator('.cn-ritmo-na')).toContainText('no está disponible');
    await expect(root.locator('#concKpiTotal')).toHaveText(esperado().total.toLocaleString('es-MX'));
    await expect(root.locator('.cn-chip')).toHaveCount(17);
    expect(errores.filter((e) => !/404|not found/i.test(e))).toEqual([]);
  });

  test('Excel: exporta lo que se ve (solo el biológico elegido) con total por fórmula', async ({ page }) => {
    test.setTimeout(90000);
    const { errores } = await abrir(page);
    const root = page.locator('#concRoot');
    await root.locator('.cn-chip', { hasText: 'SRP' }).click();
    const ExcelJS = require('exceljs');
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('#btnExportConcentrado').click()]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await descarga.path());
    const ws = wb.getWorksheet('Concentrado');
    expect(String(ws.getCell('A3').value)).toContain('Solo: SRP');
    const enc = ws.getRow(5).values.slice(1).map(String);
    expect(enc).toEqual(['CLUES', 'UNIDAD', 'MUNICIPIO', 'SRP', 'TOTAL']);
    const fila = ws.getRow(6).values;
    expect(typeof fila[4]).toBe('number');
    expect(errores).toEqual([]);
  });
});
