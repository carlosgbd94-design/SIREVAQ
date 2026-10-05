// Control de Frascos de Influenza: reparto de una entrega por meta.
// No levanta toda la app: monta la sección #secInfluenzaFrascos de index.html y el bloque de
// frascos de influenza_module.js con datos simulados (metas, unidades, AppService).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8');
const seccion = html.slice(
  html.indexOf('<div id="secInfluenzaFrascos"'),
  html.indexOf('<!-- SECCIÓN 4: CONFIGURACIÓN DE CAMPAÑA -->'));
const bloque = modulo.slice(
  modulo.indexOf('const DOSIS_POR_FRASCO'),
  modulo.indexOf('// --- ═══════════ INDICADORES'));

const meta = (clues, municipio, n) => ({ clues, municipio, metas: { r1: n } });
const DATOS = `
  var USER = { rol: window.__ROL__, usuario: 'PRUEBA', municipio: 'QUERETARO' };
  var showToast = function (m) { window.__toasts.push(m); };
  var updateFlaskCalculationMuni = function () {};
  var _adminCapturasArray = [];
  var _adminFrascosArray = [];
  var _allUnidades = [
    { clues: 'Q1', unidad: 'UMQ UNO', municipio: 'QUERETARO' },
    { clues: 'Q2', unidad: 'UMQ DOS', municipio: 'QUERETARO' },
    { clues: 'Q3', unidad: 'UMQ TRES', municipio: 'QUERETARO' },
    { clues: 'QTSSA001740', unidad: 'HENM', municipio: 'QUERETARO' },
    { clues: 'QTSSA002901', unidad: 'NHGQ', municipio: 'QUERETARO' }
  ];
  var _adminMetasArray = ${JSON.stringify([
    meta(null, 'QUERETARO', 6000), meta(null, 'CORREGIDORA', 900), meta(null, 'MARQUES', 700),
    meta(null, 'HUIMILPAN', 300), meta(null, 'HENM', 500), meta(null, 'NHG', 400),
    meta('Q1', 'QUERETARO', 3000), meta('Q2', 'QUERETARO', 2000), meta('Q3', 'QUERETARO', 1000)
  ])};
  var _llamadas = [];
  var AppService = {
    call: async function (a, p) { window.__llamadas.push([a, p]); return { ok: true, data: [] }; },
    // Igual que el real: si la acción no devuelve {ok:true} se toma como error.
    runCapture: async function (o) { const r = await o.action(); if (!r || !r.ok) throw new Error('Error al procesar la solicitud'); return r; }
  };
  var loadInfluenzaAdminData = async function () {};
`;

async function montar(page, rol) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'dock_glass.css') });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate(([h, r]) => {
    window.__ROL__ = r; window.__toasts = []; window.__llamadas = [];
    document.body.innerHTML = `${h}<select id="adminInfluenzaMuni"><option value="QUERETARO">Q</option></select>
      <select id="metaCampaignSelect"><option value="2025-2026">x</option></select>`;
    document.getElementById('secInfluenzaFrascos').classList.remove('hidden');
  }, [seccion, rol]);
  await page.addScriptTag({ path: path.join(raiz, 'influenza_reparto.js') });
  await page.addScriptTag({ content: DATOS });
  await page.addScriptTag({ content: bloque });
}

const valores = (page, ids) => page.evaluate(
  (l) => l.map((id) => document.getElementById(`rem_inp_${id}`).value), ids);
const DEST = ['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'HENM', 'NHG'];

test('Jurisdicción: reparte 458 frascos por meta sin rebasar el total y permite editar', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => { _adminRemesasArray = []; renderFrascosDistribution(); });

  await page.fill('#remesaTotalInput', '458');
  expect(await valores(page, DEST)).toEqual(['312', '47', '36', '16', '26', '21']);
  await expect(page.locator('#remesaResumen')).toContainText('Reparto completo: 458 de 458');
  await expect(page.locator('#rem_pct_QUERETARO')).toHaveText('68.18%');
  await expect(page.locator('#rem_real_QUERETARO')).toHaveText('68.12%');   // 312 / 458, casi igual a su % de meta
  await expect(page.locator('#rem_real_QUERETARO small')).toHaveCount(0);

  // Editar solo frascos: Querétaro a 400, el resto se reparte con lo que queda
  await page.fill('#rem_inp_QUERETARO', '400');
  expect(await valores(page, DEST)).toEqual(['400', '19', '15', '6', '10', '8']);
  await expect(page.locator('#rem_mark_QUERETARO')).toHaveText('editado · por meta: 312');
  await expect(page.locator('#rem_real_QUERETARO')).toContainText('87.34%');   // 400 / 458
  await expect(page.locator('#rem_real_QUERETARO small')).toContainText('+19.15 pts');
  await expect(page.locator('#rem_real_T')).toHaveText('100.00%');

  // Pasarse del total avisa y no deja guardar
  await page.fill('#rem_inp_QUERETARO', '500');
  await expect(page.locator('#remesaResumen')).toContainText('Te pasaste por 42');
  await page.click('#btnSaveRemesa');
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);

  // Restablecer vuelve al reparto proporcional
  await page.click('#btnRemesaReset');
  expect(await valores(page, DEST)).toEqual(['312', '47', '36', '16', '26', '21']);

  await page.click('#btnSaveRemesa');
  const llamadas = await page.evaluate(() => window.__llamadas);
  const remesa = llamadas.find((l) => l[0] === 'saveinfluenza_remesa')[1];
  expect(remesa.total_frascos).toBe(458);
  expect(remesa.numero_entrega).toBe(1);
  expect(llamadas.filter((l) => l[0] === 'guardarinfluenza_reparto').every((l) => l[1].anio_campana === '2025-2026')).toBe(true);
  expect(Object.values(remesa.asignacion).reduce((a, b) => a + b, 0)).toBe(458);
  // Los hospitales quedan registrados como su propio destino, con su CLUES
  const hosp = llamadas.filter((l) => l[0] === 'guardarinfluenza_reparto').map((l) => [l[1].municipio, l[1].rows[0].clues, l[1].rows[0].cantidad_frascos]);
  expect(hosp).toEqual([['HENM', 'QTSSA001740', 26], ['NHG', 'QTSSA002901', 21]]);
});

test('Jurisdicción: con las metas reales de la campaña 2026-2027 (HENM 1300, NHGQ 1500) reparte 25 y 29 de 2700', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => {
    const m = { QUERETARO: 99837, CORREGIDORA: 12590, MARQUES: 15890, HUIMILPAN: 6630, HENM: 1300, NHG: 1500 };
    _adminMetasArray = Object.entries(m).map(([municipio, n]) => ({ clues: null, municipio, metas: { r1: n } }));
    _adminRemesasArray = [];
    renderFrascosDistribution();
  });
  await page.fill('#remesaTotalInput', '2700');
  expect(await valores(page, DEST)).toEqual(['1957', '247', '311', '130', '26', '29']);
  await expect(page.locator('#remesaResumen')).toContainText('Reparto completo: 2,700 de 2,700');
  // Una edición vieja de NHGQ (89) se nota: dice cuánto le tocaría por meta
  await page.fill('#rem_inp_NHG', '89');
  await expect(page.locator('#rem_mark_NHG')).toHaveText('editado · por meta: 29');
});

test('Municipal: reparte lo que asignó Jurisdicción entre sus unidades (sin hospitales)', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    renderFrascosDistribution();
  });
  await expect(page.locator('#frascosBatchTbody tr')).toHaveCount(3);   // los hospitales no aparecen
  await expect(page.locator('#frascosMuniResumen')).toContainText('312');
  const v = async () => page.evaluate(() => ['Q1', 'Q2', 'Q3'].map((c) => document.getElementById(`batch_frascos_${c}`).value));
  expect(await v()).toEqual(['156', '104', '52']);

  await page.fill('#batch_frascos_Q3', '100');
  expect(await v()).toEqual(['127', '85', '100']);       // 212 restantes por meta 3:2 (el decimal mayor se lleva el sobrante)
  await expect(page.locator('#mr_real_Q3')).toContainText('32.05%');    // 100 / 312 vs. 16.67% de su meta
  await expect(page.locator('#mr_real_Q3 small')).toContainText('+15.38 pts');
  await page.click('#btnSaveFrascoEntrega');
  const g = (await page.evaluate(() => window.__llamadas)).find((l) => l[0] === 'guardarinfluenza_reparto')[1];
  expect(g.municipio).toBe('QUERETARO');
  expect(g.anio_campana).toBe('2025-2026');
  expect(g.rows.map((r) => r.cantidad_frascos)).toEqual([127, 85, 100]);
});

test('Concentrado por entregas: columnas por destino y total entregado', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312, CORREGIDORA: 47, MARQUES: 36, HUIMILPAN: 16, HENM: 26, NHG: 21 }, manual: [] }];
    renderFrascosDistribution();
  });
  await page.click('#dockFrascosTabs [data-frs="entregas"]');
  const filas = await page.locator('#frascosMatrixTable tbody tr').allInnerTexts();
  expect(filas[0]).toContain('1ª entrega');
  expect(filas.find((f) => f.includes('TOTAL ENTREGADO'))).toContain('458');
  expect(filas.find((f) => f.includes('META'))).toContain('8,800');
});

test('Excel de distribución: hoja jurisdiccional con entregas, META y TOTAL ENTREGADO', async ({ page }, info) => {
  await montar(page, 'JURISDICCIONAL');
  await page.addScriptTag({ path: path.join(raiz, 'node_modules/exceljs/dist/exceljs.min.js') });
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312, CORREGIDORA: 47, MARQUES: 36, HUIMILPAN: 16, HENM: 26, NHG: 21 }, manual: [] }];
    _remesaState.numero = 2;
    renderFrascosDistribution();
  });
  await page.fill('#remesaTotalInput', '458');
  if (process.env.FRASCOS_SHOT) await page.screenshot({ path: process.env.FRASCOS_SHOT, fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportFrascosExcel())]);
  const destino = info.outputPath('frascos.xlsx');
  await dl.saveAs(destino);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(destino);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Jurisdicción', 'Querétaro']);   // los municipios sin unidades no generan hoja
  const ws = wb.getWorksheet('Jurisdicción');
  expect(ws.getRow(3).values.slice(2)).toEqual(['Querétaro', 'Corregidora', 'El Marqués', 'Huimilpan', 'HENM', 'NHGQ', 'TOTAL']);
  expect(ws.getRow(4).getCell(1).value).toBe('1ª entrega');
  expect(ws.getRow(4).getCell(2).value).toBe(312);
  expect(ws.getRow(9).getCell(1).value).toBe('TOTAL ENTREGADO');
});

test('Barra flotante: un solo subpanel visible a la vez y el historial solo es municipal', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => { _adminRemesasArray = []; renderFrascosDistribution(); });
  const visible = (n) => page.locator(`[data-frs-panel="${n}"]`).isVisible();
  expect([await visible('repartir'), await visible('entregas'), await visible('resumen'), await visible('historial')]).toEqual([true, false, false, false]);
  await expect(page.locator('#dockFrascosHist')).toBeHidden();

  await page.click('#dockFrascosTabs [data-frs="resumen"]');
  expect([await visible('repartir'), await visible('resumen')]).toEqual([false, true]);
  await expect(page.locator('#dockFrascosTabs [data-frs="resumen"]')).toHaveClass(/activo/);
  await expect(page.locator('#adminFrascosMunicipalTbody tr')).toHaveCount(6);

  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => { _adminRemesasArray = []; renderFrascosDistribution(); });
  await expect(page.locator('#dockFrascosHist')).toBeVisible();
  await page.click('#dockFrascosTabs [data-frs="historial"]');
  await expect(page.locator('#influenzaFrascosHistoryContainer')).toBeVisible();
});

// ─── Distribución de Metas: sin "0" pegado y columna Comparación ───────────
const seccionMetas = html.slice(html.indexOf('<div id="secInfluenzaMetas"'), html.indexOf('<!-- SECCIÓN 3: CONTROL DE FRASCOS -->'));
const rubros = modulo.slice(modulo.indexOf('const INFLUENZA_RUBROS'), modulo.indexOf('];', modulo.indexOf('const INFLUENZA_RUBROS')) + 2);
const gridFn = modulo.slice(modulo.indexOf('function metaEnlazarInputs'), modulo.indexOf('async function saveInfluenzaMetasConfig'));

async function montarMetas(page, rol, metas) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate(([h, r]) => {
    window.__ROL__ = r;
    document.body.innerHTML = `<div style="width:900px">${h}</div><select id="adminInfluenzaMuni"><option value="QUERETARO">Q</option></select>`;
    document.getElementById('secInfluenzaMetas').classList.remove('hidden');
  }, [seccionMetas, rol]);
  await page.addScriptTag({ content: DATOS.replace(/var _adminMetasArray = [\s\S]*?\];/, `var _adminMetasArray = ${JSON.stringify(metas)};`) });
  await page.addScriptTag({ content: bloque });
  await page.addScriptTag({ content: rubros + gridFn + 'window.__render = renderMetasConfigurationGrid;' });
  await page.evaluate(() => { window.syncTabGroupIndicator = () => {}; window.__render(); });
}

test('Metas jurisdiccionales: sin cero inicial y Comparación verde/roja contra el total capturado', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', []);
  const q = page.locator('input[data-rb="r1"][data-muni="QUERETARO"]');
  await q.click();
  await page.keyboard.type('5476');
  await expect(q).toHaveValue('5476');                     // antes quedaba "05476"
  await expect(page.locator('#total_j_r1')).toHaveText('5476');

  const cmp = page.locator('#cmp_r1');
  await page.locator('input[data-rb="r1"][data-juris]').fill('6000');
  await expect(cmp).toHaveAttribute('data-estado', 'mal');
  await expect(cmp).toContainText('Faltan 524');
  await page.locator('input[data-rb="r1"][data-muni="HENM"]').fill('524');
  await expect(cmp).toHaveAttribute('data-estado', 'ok');
  await expect(cmp).toContainText('Coincide');
  await expect(page.locator('#cmp_TOTAL')).toHaveAttribute('data-estado', 'ok');
  await expect(page.locator('#tot_J')).toHaveText('6000');
  // La comparación queda pegada a la derecha aunque se haga scroll horizontal
  expect(await cmp.evaluate((e) => getComputedStyle(e).position)).toBe('sticky');
});

test('Metas municipales: Comparación contra lo distribuido entre las unidades', async ({ page }) => {
  await montarMetas(page, 'MUNICIPAL', [meta(null, 'QUERETARO', 100)]);
  const cmp = page.locator('#cmp_r1');
  await expect(cmp).toContainText('0 de 100');
  await expect(cmp).toHaveAttribute('data-estado', 'mal');
  await page.locator('input[data-rb="r1"][data-clues="Q1"]').fill('60');
  await page.locator('input[data-rb="r1"][data-clues="Q2"]').fill('40');
  await expect(cmp).toHaveAttribute('data-estado', 'ok');
  await page.locator('input[data-rb="r1"][data-clues="Q3"]').fill('5');
  await expect(cmp).toContainText('Sobran 5');
  await expect(cmp).toHaveAttribute('data-estado', 'mal');
});

test('Metas: Tab va a la derecha, Enter baja; al terminar fila/columna salta a la siguiente', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', []);
  const inp = (rb, m) => page.locator(`input[data-rb="${rb}"][data-muni="${m}"]`);
  await inp('r1', 'QUERETARO').click();
  await page.keyboard.type('10');
  await page.keyboard.press('Tab');
  await expect(inp('r1', 'CORREGIDORA')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(inp('r1', 'QUERETARO')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(inp('r2', 'QUERETARO')).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(inp('r1', 'QUERETARO')).toBeFocused();
  // Al final de la fila (después de la meta jurisdiccional) se pasa a la primera celda de la fila siguiente
  await page.locator('input[data-rb="r1"][data-juris]').focus();
  await page.keyboard.press('Tab');
  await expect(inp('r2', 'QUERETARO')).toBeFocused();
  // Del último rubro, Enter pasa a la primera fila de la columna siguiente
  const ultimo = await page.evaluate(() => INFLUENZA_RUBROS[INFLUENZA_RUBROS.length - 1].id);
  await inp(ultimo, 'QUERETARO').focus();
  await page.keyboard.press('Enter');
  await expect(inp('r1', 'CORREGIDORA')).toBeFocused();
  await expect(inp('r1', 'QUERETARO')).toHaveValue('10');
});

test('Metas municipales: fila de frascos (Querétaro admite abierto), repartir parejo y pegado desde Excel', async ({ page }) => {
  await montarMetas(page, 'MUNICIPAL', [meta(null, 'QUERETARO', 100)]);
  const q1 = page.locator('input[data-rb="r1"][data-clues="Q1"]');
  await q1.fill('215');
  await expect(page.locator('#frs_Q1')).toHaveAttribute('data-estado', 'aviso');   // Querétaro: abierto = ámbar
  await expect(page.locator('#frs_Q1')).toContainText('21.5');
  await q1.fill('220');
  await expect(page.locator('#frs_Q1')).toHaveAttribute('data-estado', 'ok');

  // Repartir parejo: 100 entre 3 unidades -> 34/33/33
  await page.locator('tr[data-rb="r1"] .meta-split-btn').click();
  await expect(q1).toHaveValue('34');
  await expect(page.locator('input[data-rb="r1"][data-clues="Q3"]')).toHaveValue('33');

  // Pegado de bloque (2 filas x 2 columnas) desde Q1/r1
  await q1.focus();
  await page.evaluate(() => {
    const el = document.querySelector('input[data-rb="r1"][data-clues="Q1"]');
    const dt = new DataTransfer(); dt.setData('text/plain', '10\t20\n30\t40\n');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('input[data-rb="r1"][data-clues="Q2"]')).toHaveValue('20');
  const r2 = await page.evaluate(() => INFLUENZA_RUBROS[1].id);
  await expect(page.locator(`input[data-rb="${r2}"][data-clues="Q2"]`)).toHaveValue('40');
});

test('Metas jurisdiccionales: frasco abierto en rojo salvo Querétaro', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', []);
  await page.locator('input[data-rb="r1"][data-muni="QUERETARO"]').fill('15');
  await page.locator('input[data-rb="r1"][data-muni="CORREGIDORA"]').fill('15');
  await expect(page.locator('#frs_QUERETARO')).toHaveAttribute('data-estado', 'aviso');
  await expect(page.locator('#frs_CORREGIDORA')).toHaveAttribute('data-estado', 'mal');
  await page.locator('input[data-rb="r1"][data-muni="CORREGIDORA"]').fill('20');
  await expect(page.locator('#frs_CORREGIDORA')).toHaveAttribute('data-estado', 'ok');
});

test('Metas: al desplazar quedan fijos el encabezado, la franja del bloque, Grupo/Edad y los renglones TOTAL y FRASCOS', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await montarMetas(page, 'MUNICIPAL', [meta(null, 'QUERETARO', 100)]);
  const wrap = page.locator('#secInfluenzaMetas .tableWrap');
  await wrap.evaluate((e) => { e.scrollTop = 600; });
  const pos = await page.evaluate(() => {
    const w = document.querySelector('#secInfluenzaMetas .tableWrap').getBoundingClientRect();
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return {
      wTop: w.top, wBottom: w.bottom,
      frascos: r('#frs_Q1'), total: r('#tot_Q1'), th: r('#influenzaMetasThead th'),
      franja: r('.meta-grupo-row td')
    };
  });
  expect(Math.abs(pos.frascos.bottom - pos.wBottom)).toBeLessThan(3);        // FRASCOS pegado al borde inferior
  expect(Math.abs(pos.total.bottom - pos.frascos.top)).toBeLessThan(3);      // TOTAL justo encima
  expect(Math.abs(pos.th.top - pos.wTop)).toBeLessThan(3);                   // encabezado arriba
  // La franja del bloque que se está trabajando queda debajo del encabezado
  const franjas = await page.evaluate(() => [...document.querySelectorAll('.meta-grupo-row td:first-child')]
    .map((td) => td.getBoundingClientRect().top));
  const alTope = franjas.filter((t) => Math.abs(t - (pos.th.bottom)) < 3);
  expect(alTope.length).toBeGreaterThan(0);
  // Columna Grupo/Edad fija al desplazar en horizontal (modo jurisdiccional: más columnas que ancho)
  await montarMetas(page, 'JURISDICCIONAL', []);
  await expect.poll(() => wrap.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await wrap.evaluate((e) => { e.scrollLeft = 300; });
  const izq = await page.evaluate(() => {
    const w = document.querySelector('#secInfluenzaMetas .tableWrap').getBoundingClientRect();
    return { w: w.left, c: document.querySelector('#influenzaMetasTbody tr[data-rb] td').getBoundingClientRect().left };
  });
  expect(Math.abs(izq.c - izq.w)).toBeLessThan(3);
});
