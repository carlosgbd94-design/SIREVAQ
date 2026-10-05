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
  modulo.indexOf('function updateFlaskCalculationMuni'),
  modulo.indexOf('// --- ═══════════ INDICADORES'));

const meta = (clues, municipio, n) => ({ clues, municipio, metas: { r1: n } });
const DATOS = `
  var USER = { rol: window.__ROL__, usuario: 'PRUEBA', municipio: 'QUERETARO' };
  var showToast = function (m) { window.__toasts.push(m); };
  var updateFlaskCalculationMuni = function () {};
  var _adminCapturasArray = [];
  var _adminFrascosArray = [];
  var _adminLotesEntregas = [];
  var _influenzaDistribucionCache = [];
  var _influenzaCapturasCache = [];
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
    runCapture: async function (o) { try { const r = await o.action(); if (!r || !r.ok) throw new Error('Error al procesar la solicitud'); return r; } catch (e) { window.__errores.push(e.message); throw e; } }
  };
  var loadInfluenzaAdminData = async function () {};
`;

async function montar(page, rol) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'dock_glass.css') });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate(([h, r]) => {
    window.__ROL__ = r; window.__toasts = []; window.__llamadas = []; window.__errores = [];
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

  // Editar Querétaro a 400: SOLO cambia Querétaro; los demás no se mueven y el total muestra lo real (546 de 458)
  await page.fill('#rem_inp_QUERETARO', '400');
  expect(await valores(page, DEST)).toEqual(['400', '47', '36', '16', '26', '21']);
  await expect(page.locator('#rem_mark_QUERETARO')).toHaveText('editado · por meta: 312');
  await expect(page.locator('#rem_real_QUERETARO')).toContainText('87.34%');   // 400 / 458
  await expect(page.locator('#rem_real_QUERETARO small')).toContainText('+19.15 pts');
  await expect(page.locator('#rem_inp_T')).toHaveText('546 de 458');
  await expect(page.locator('#remesaResumen')).toContainText('546 frascos repartidos de 458');
  await expect(page.locator('#remesaResumen')).toContainText('te pasaste por 88');
  await expect(page.locator('#rem_inp_QUERETARO')).toHaveClass(/frs-num--excede/);   // la que cambiaste, en rojo
  await expect(page.locator('#rem_inp_CORREGIDORA')).not.toHaveClass(/frs-num--excede/);
  await page.click('#btnSaveRemesa');                                         // se pasa: no guarda
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);

  // «Cuadrar con los demás»: ahora sí se reparte lo que queda (58) entre los que no tocaste
  await page.click('#btnRemesaCuadrar');
  expect(await valores(page, DEST)).toEqual(['400', '19', '15', '6', '10', '8']);
  await expect(page.locator('#rem_real_T')).toHaveText('100.00%');
  await expect(page.locator('#remesaResumen')).toContainText('Reparto completo: 458 de 458');

  // Pasarse otra vez avisa y no deja guardar
  await page.fill('#rem_inp_QUERETARO', '500');
  await expect(page.locator('#remesaResumen')).toContainText('te pasaste por 100');
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
  expect(await page.evaluate(() => window.__errores)).toEqual([]);   // el guardado no marca error
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
  expect(await v()).toEqual(['156', '104', '100']);      // solo cambia Q3; las demás no se mueven (suma 360, se pasa)
  await expect(page.locator('#mr_inp_T')).toHaveText('360 de 312');
  await page.click('#btnMuniCuadrar');                   // ahora sí: los 212 restantes por meta 3:2
  expect(await v()).toEqual(['127', '85', '100']);       // (el decimal mayor se lleva el sobrante)
  await expect(page.locator('#mr_inp_T')).toHaveText('312 de 312');
  await expect(page.locator('#mr_real_Q3')).toContainText('32.05%');    // 100 / 312 vs. 16.67% de su meta
  await expect(page.locator('#mr_real_Q3 small')).toContainText('+15.38 pts');
  await page.click('#btnSaveFrascoEntrega');
  const g = (await page.evaluate(() => window.__llamadas)).find((l) => l[0] === 'guardarinfluenza_reparto')[1];
  expect(g.municipio).toBe('QUERETARO');
  expect(g.anio_campana).toBe('2025-2026');
  expect(await page.evaluate(() => window.__errores)).toEqual([]);   // el guardado no marca error
  expect(g.rows.map((r) => r.cantidad_frascos)).toEqual([127, 85, 100]);
});

test('Municipal: lo guardado fuera de la meta se marca como editado y lo demás sigue por meta', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    _adminFrascosArray = [
      { municipio: 'QUERETARO', clues: 'Q1', numero_entrega: 1, cantidad_frascos: 156, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q2', numero_entrega: 1, cantidad_frascos: 104, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q3', numero_entrega: 1, cantidad_frascos: 52, fecha_entrega: '2026-10-05' }];
    renderFrascosDistribution();
  });
  // Guardado por meta: nada marcado
  await expect(page.locator('#mr_mark_Q1')).toHaveText('');
  await expect(page.locator('#mr_mark_Q3')).toHaveText('');
  // Guardado con una edición vieja en Q3 (80 en vez de 52): se ve y dice cuánto le tocaba
  await page.evaluate(() => {
    _adminFrascosArray = [
      { municipio: 'QUERETARO', clues: 'Q1', numero_entrega: 1, cantidad_frascos: 156, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q2', numero_entrega: 1, cantidad_frascos: 76, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q3', numero_entrega: 1, cantidad_frascos: 80, fecha_entrega: '2026-10-05' }];
    renderFrascosDistribution();
  });
  await expect(page.locator('#mr_mark_Q2')).toHaveText('editado · por meta: 104');
  await expect(page.locator('#mr_mark_Q3')).toHaveText('editado · por meta: 52');
  await expect(page.locator('#mr_mark_Q1')).toHaveText('');
});

test('Municipal: el lote ya no se captura aquí, se muestra el que asignó Requisiciones (solo lectura)', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    renderFrascosDistribution();
  });
  // Sin campos de lote ni caducidad
  await expect(page.locator('#frascoLoteInput')).toHaveCount(0);
  await expect(page.locator('#frascoCaducidadInput')).toHaveCount(0);
  // Aún no hay requisición: se explica dónde se asigna
  await expect(page.locator('#frascosLotesEstado')).toContainText('Requisiciones');
  await expect(page.locator('#frascosBatchTbody tr').first().locator('td').last()).toContainText('—');

  // Requisiciones asignó lote a Q1 y dejó Q2 por definir
  await page.evaluate(() => {
    _adminLotesEntregas = [
      { numero_entrega: 1, clues: 'Q1', lote: 'LF123A', caducidad: '2027-03-31', cantidad: 156 },
      { numero_entrega: 1, clues: 'Q2', lote: 'POR DEFINIR', caducidad: null, cantidad: 104 }];
    renderFrascosDistribution();
  });
  await expect(page.locator('#frascosBatchTbody tr').nth(0).locator('td').last()).toContainText('LF123A');
  await expect(page.locator('#frascosBatchTbody tr').nth(0).locator('td').last()).toContainText('MAR-27');
  await expect(page.locator('#frascosBatchTbody tr').nth(1).locator('td').last()).toContainText('Pendiente');
  await expect(page.locator('#frascosLotesEstado')).toContainText('156 de 260');
  // Guardar el reparto ya no manda lote ni caducidad
  await page.click('#btnSaveFrascoEntrega');
  const g = (await page.evaluate(() => window.__llamadas)).find((l) => l[0] === 'guardarinfluenza_reparto')[1];
  expect(g.lote).toBeUndefined();
  expect(g.caducidad).toBeUndefined();
});

test('Municipal: cifras grandes de lo asignado, repartido y por repartir (y el aviso si se pasa)', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    renderFrascosDistribution();
  });
  await expect(page.locator('#kpiTotal')).toHaveText('312');
  await expect(page.locator('#kpiDosis')).toContainText('3,120 dosis');
  await expect(page.locator('#kpiDosis')).toContainText('Querétaro');
  await expect(page.locator('#kpiAsignado')).toHaveText('312');
  await expect(page.locator('#kpiPor')).toHaveText('0');
  await expect(page.locator('#kpiPorBox')).toHaveAttribute('data-estado', 'ok');
  // La cantidad de cada unidad es lo principal de su fila (campo grande)
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('batch_frascos_Q1')).fontSize))).toBeGreaterThanOrEqual(18);

  await page.fill('#batch_frascos_Q1', '400');                 // se pasa: 400 + 104 + 52 = 556
  await expect(page.locator('#kpiAsignado')).toHaveText('556');
  await expect(page.locator('#kpiAsignadoDe')).toHaveText('de 312 asignados');
  await expect(page.locator('#kpiRepBox')).toHaveAttribute('data-estado', 'excede');
  await expect(page.locator('#kpiPor')).toHaveText('244');
  await expect(page.locator('#kpiPorBox')).toHaveAttribute('data-estado', 'excede');
  await expect(page.locator('#kpiPorBox .frs-kpi-lbl')).toHaveText('Te pasaste por');
  await expect(page.locator('#batch_frascos_Q1')).toHaveClass(/frs-num--excede/);
  await expect(page.locator('#batch_frascos_Q2')).not.toHaveClass(/frs-num--excede/);
  await page.fill('#batch_frascos_Q1', '100');                 // faltan: 100 + 104 + 52 = 256
  await expect(page.locator('#kpiPorBox')).toHaveAttribute('data-estado', 'falta');
  await expect(page.locator('#kpiPor')).toHaveText('56');
  await expect(page.locator('#batch_frascos_Q1')).toHaveClass(/frs-num--falta/);
  await page.fill('#batch_frascos_Q1', '156');                 // exacto otra vez
  await expect(page.locator('#kpiRepBox')).toHaveAttribute('data-estado', 'ok');
  await expect(page.locator('#batch_frascos_Q1')).not.toHaveClass(/frs-num--(excede|falta)/);
  await page.fill('#batch_frascos_Q2', '');                    // vacío = vuelve a su parte por meta
  await expect(page.locator('#kpiAsignado')).toHaveText('312');
});

test('Municipal con dos municipios (Corregidora y Huimilpan): puede cambiar de municipio en Control de frascos', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    document.getElementById('adminInfluenzaMuni').innerHTML = '<option value="CORREGIDORA">CORREGIDORA</option><option value="HUIMILPAN">HUIMILPAN</option>';
    _allUnidades.push({ clues: 'C1', unidad: 'CS CORREGIDORA UNO', municipio: 'CORREGIDORA' }, { clues: 'H1', unidad: 'CS HUIMILPAN UNO', municipio: 'HUIMILPAN' }, { clues: 'H2', unidad: 'CS HUIMILPAN DOS', municipio: 'HUIMILPAN' });
    _adminMetasArray.push({ clues: 'C1', municipio: 'CORREGIDORA', metas: { r1: 500 } }, { clues: 'H1', municipio: 'HUIMILPAN', metas: { r1: 300 } }, { clues: 'H2', municipio: 'HUIMILPAN', metas: { r1: 100 } });
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 377, asignacion: { CORREGIDORA: 247, HUIMILPAN: 130 }, manual: [] }];
    renderFrascosDistribution();
  });
  await expect(page.locator('#frascoMuniCol')).toBeVisible();
  await expect(page.locator('#frascoMuniSelect option')).toHaveCount(2);
  await expect(page.locator('#kpiTotal')).toHaveText('247');
  await expect(page.locator('#frascosBatchTbody tr')).toHaveCount(1);

  await page.selectOption('#frascoMuniSelect', 'HUIMILPAN');
  await expect(page.locator('#kpiTotal')).toHaveText('130');
  await expect(page.locator('#kpiDosis')).toContainText('Huimilpan');
  await expect(page.locator('#frascosBatchTbody tr')).toHaveCount(2);
  expect(await page.evaluate(() => ['H1', 'H2'].map((c) => document.getElementById('batch_frascos_' + c).value))).toEqual(['98', '32']);   // 130 por meta 3:1
  expect(await page.evaluate(() => document.getElementById('adminInfluenzaMuni').value)).toBe('HUIMILPAN');

  await page.click('#btnSaveFrascoEntrega');
  const g = (await page.evaluate(() => window.__llamadas)).find((l) => l[0] === 'guardarinfluenza_reparto')[1];
  expect(g.municipio).toBe('HUIMILPAN');
  expect(g.rows.map((r) => r.cantidad_frascos)).toEqual([98, 32]);
});

test('Municipal de un solo municipio: no aparece el selector de municipio en Control de frascos', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => { _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 10, asignacion: { QUERETARO: 10 }, manual: [] }]; renderFrascosDistribution(); });
  await expect(page.locator('#frascoMuniCol')).toBeHidden();
});

test('Municipal: no guarda si se pasa ni si falta; solo guarda cuando suma exacto lo asignado', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    renderFrascosDistribution();
    window.__toasts = []; window.__llamadas = [];
  });
  const guardados = () => page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'guardarinfluenza_reparto').length);
  const ultimoToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');

  // Se pasa (400 en una sola unidad)
  await page.fill('#batch_frascos_Q1', '400');
  await page.click('#btnSaveFrascoEntrega');
  expect(await guardados()).toBe(0);
  expect(await ultimoToast()).toContain('te pasaste por 244 frascos');
  await expect(page.locator('#kpiPorBox')).toHaveClass(/frs-shake/);

  // Faltan frascos (dos unidades fijas que suman menos y la tercera también fija)
  await page.evaluate(() => { _muniRepartoState.fijos = { Q1: 100, Q2: 100, Q3: 100 }; _muniRepartoState.editados = new Set(['Q1', 'Q2', 'Q3']); refreshRepartoMunicipal('QUERETARO'); });
  await page.click('#btnSaveFrascoEntrega');
  expect(await guardados()).toBe(0);
  expect(await ultimoToast()).toContain('faltan 12 frascos por repartir');

  // Exacto: sí guarda y no hay aviso nuevo
  await page.evaluate(() => { window.__toasts = []; _muniRepartoState.fijos = { Q1: 100, Q2: 100, Q3: 112 }; refreshRepartoMunicipal('QUERETARO'); });
  await page.click('#btnSaveFrascoEntrega');
  await expect.poll(guardados).toBe(1);
  expect(await page.evaluate(() => window.__toasts.length)).toBe(0);
});

test('Jurisdicción: no guarda la entrega si faltan o sobran frascos', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => { _adminRemesasArray = []; renderFrascosDistribution(); window.__toasts = []; window.__llamadas = []; });
  const guardados = () => page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'saveinfluenza_remesa').length);
  await page.fill('#remesaTotalInput', '458');
  // Fijar todos los destinos con un total menor (faltan 8)
  await page.evaluate(() => { _remesaState.fijos = { QUERETARO: 300, CORREGIDORA: 50, MARQUES: 40, HUIMILPAN: 20, HENM: 20, NHG: 20 }; _remesaState.editados = new Set(Object.keys(_remesaState.fijos)); refreshRemesa(); });
  await page.click('#btnSaveRemesa');
  expect(await guardados()).toBe(0);
  expect((await page.evaluate(() => window.__toasts))[0]).toContain('faltan 8 frascos por repartir');
  await expect(page.locator('#remesaResumen')).toHaveClass(/frs-shake/);
  // Sobran
  await page.evaluate(() => { window.__toasts = []; _remesaState.fijos.QUERETARO = 320; refreshRemesa(); });
  await page.click('#btnSaveRemesa');
  expect(await guardados()).toBe(0);
  expect((await page.evaluate(() => window.__toasts))[0]).toContain('te pasaste por 12 frascos');
  // Exacto
  await page.evaluate(() => { _remesaState.fijos.QUERETARO = 308; refreshRemesa(); });
  await page.click('#btnSaveRemesa');
  await expect.poll(guardados).toBe(1);
});

test('Municipal: con 100 frascos, tocar una unidad NO mueve las demás y muestra "105 de 100" con la unidad en rojo', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 100, asignacion: { QUERETARO: 100 }, manual: [] }];
    renderFrascosDistribution();
    window.__toasts = []; window.__llamadas = [];
  });
  const v = () => page.evaluate(() => ['Q1', 'Q2', 'Q3'].map((c) => document.getElementById('batch_frascos_' + c).value));
  expect(await v()).toEqual(['50', '33', '17']);
  await expect(page.locator('#mr_inp_T')).toHaveText('100 de 100');
  await expect(page.locator('#mr_total_row')).toHaveAttribute('data-estado', 'ok');

  await page.fill('#batch_frascos_Q1', '55');                  // me paso por 5
  expect(await v()).toEqual(['55', '33', '17']);               // las otras unidades NO se movieron
  await expect(page.locator('#mr_inp_T')).toHaveText('105 de 100');
  await expect(page.locator('#mr_total_row')).toHaveAttribute('data-estado', 'excede');
  await expect(page.locator('#frascosMuniResumen')).toContainText('105 frascos repartidos de 100');
  await expect(page.locator('#kpiAsignado')).toHaveText('105');
  await expect(page.locator('#batch_frascos_Q1')).toHaveClass(/frs-num--excede/);     // la unidad alterada, en rojo
  await expect(page.locator('#batch_frascos_Q3')).not.toHaveClass(/frs-num--excede/);
  await page.click('#btnSaveFrascoEntrega');
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);                // bloqueado
  expect((await page.evaluate(() => window.__toasts))[0]).toContain('te pasaste por 5 frascos');

  await page.fill('#batch_frascos_Q1', '45');                  // me quedo corto por 5
  expect(await v()).toEqual(['45', '33', '17']);
  await expect(page.locator('#mr_inp_T')).toHaveText('95 de 100');
  await expect(page.locator('#mr_total_row')).toHaveAttribute('data-estado', 'falta');
  await expect(page.locator('#batch_frascos_Q1')).toHaveClass(/frs-num--falta/);
  await page.click('#btnSaveFrascoEntrega');
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);                // también bloqueado

  await page.fill('#batch_frascos_Q1', '50');                  // exacto
  await expect(page.locator('#mr_total_row')).toHaveAttribute('data-estado', 'ok');
  await page.click('#btnSaveFrascoEntrega');
  await expect.poll(() => page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'guardarinfluenza_reparto').length)).toBe(1);
});

test('Municipal: «Restablecer por meta» descarta lo que cambiaste', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 100, asignacion: { QUERETARO: 100 }, manual: [] }];
    renderFrascosDistribution();
  });
  await page.fill('#batch_frascos_Q1', '90');
  await page.fill('#batch_frascos_Q2', '10');
  await page.click('#btnMuniReset');
  expect(await page.evaluate(() => ['Q1', 'Q2', 'Q3'].map((c) => document.getElementById('batch_frascos_' + c).value))).toEqual(['50', '33', '17']);
  await expect(page.locator('#batch_frascos_Q1')).not.toHaveClass(/frs-num--(excede|falta)/);
});

test('Reparto vs. captura semanal (municipal): compara por unidad lo repartido con las dosis que capturan cada semana', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 458, asignacion: { QUERETARO: 312 }, manual: [] }];
    // Reparto ya guardado por unidad: 156 / 104 / 52 frascos
    _adminFrascosArray = [
      { municipio: 'QUERETARO', clues: 'Q1', numero_entrega: 1, cantidad_frascos: 156, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q2', numero_entrega: 1, cantidad_frascos: 104, fecha_entrega: '2026-10-05' },
      { municipio: 'QUERETARO', clues: 'Q3', numero_entrega: 1, cantidad_frascos: 52, fecha_entrega: '2026-10-05' }];
    // Capturas semanales de Meta-Logro (dosis por rubro). Q1: 2 semanas; Q2 aplicó de más; Q3 aún nada.
    // La captura de Q1 trae un municipio mal escrito: se compara por CLUES, no por ese texto.
    _adminCapturasArray = [
      { clues: 'Q1', municipio: 'EL MARQUES', fecha: '2026-10-09', valores: { r1: 600, r2: 400 } },
      { clues: 'Q1', municipio: 'QUERETARO', fecha: '2026-10-16', valores: { r1: 500 } },
      { clues: 'Q2', municipio: 'QUERETARO', fecha: '2026-10-16', valores: { r1: 1100 } },
      { clues: 'QTSSA001740', municipio: 'QUERETARO', fecha: '2026-10-16', valores: { r1: 9999 } }];   // hospital: otro destino
    renderFrascosDistribution();
  });
  const fila = (clues) => page.locator('#frascosBalanceTbody tr', { hasText: clues });
  // Q1: 156 frascos = 1,560 dosis; aplicó 1,500 -> en orden, 96.2%
  await expect(fila('Q1')).toHaveAttribute('data-estado', 'ok');
  await expect(fila('Q1')).toContainText('1,560');
  await expect(fila('Q1')).toContainText('1,500');
  await expect(fila('Q1')).toContainText('96.2%');
  await expect(fila('Q1')).toContainText('16/10');                      // última captura
  // Q2: 104 frascos = 1,040 dosis; aplicó 1,100 -> 60 de más, en rojo
  await expect(fila('Q2')).toHaveAttribute('data-estado', 'excede');
  await expect(fila('Q2')).toContainText('Aplicó 60 dosis de más');
  await expect(fila('Q2').locator('.frs-neg')).toHaveText('-60');
  // Q3: repartido pero sin captura
  await expect(fila('Q3')).toContainText('520');
  await expect(fila('Q3')).toContainText('0.0%');
  // Total de la tabla: 312 frascos (3,120 dosis), 2,600 aplicadas (el hospital no cuenta aquí)
  await expect(page.locator('#frascosBalanceTfoot')).toContainText('312');
  await expect(page.locator('#frascosBalanceTfoot')).toContainText('3,120');
  await expect(page.locator('#frascosBalanceTfoot')).toContainText('2,600');
  // KPIs del resumen: entregado = lo que asignó Jurisdicción; aplicado = 260 frascos; resguardo 52
  await expect(page.locator('#muniFrascosEntregados')).toHaveText('312');
  await expect(page.locator('#muniFrascosReportados')).toContainText('260 frascos (2600 dosis)');
  await expect(page.locator('#muniFrascosDiferencia')).toHaveText('52 frascos');
});

test('Reparto vs. captura semanal (Jurisdicción): solo unidades con reparto o captura, con su destino', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 100, asignacion: { QUERETARO: 60, HENM: 40 }, manual: [] }];
    _adminFrascosArray = [
      { municipio: 'QUERETARO', clues: 'Q1', numero_entrega: 1, cantidad_frascos: 60, fecha_entrega: '2026-10-05' },
      { municipio: 'HENM', clues: 'QTSSA001740', numero_entrega: 1, cantidad_frascos: 40, fecha_entrega: '2026-10-05' }];
    _adminCapturasArray = [
      { clues: 'Q1', municipio: 'QUERETARO', fecha: '2026-10-09', valores: { r1: 300 } },
      { clues: 'QTSSA001740', municipio: 'QUERETARO', fecha: '2026-10-09', valores: { r1: 500 } }];
    renderFrascosDistribution();
    frascoIrA('resumen');
  });
  await expect(page.locator('#frascosBalanceTbody tr')).toHaveCount(2);        // Q2 y Q3 no tienen nada: no aparecen
  await expect(page.locator('#frascosBalanceDestinoTh')).toBeVisible();
  await expect(page.locator('#frascosBalanceTbody tr', { hasText: 'QTSSA001740' })).toContainText('HENM');
  // Concentrado por destino: el hospital cuenta aparte de Querétaro
  const fQ = page.locator('#adminFrascosMunicipalTbody tr', { hasText: 'Querétaro' });
  await expect(fQ).toContainText('300');
  const fH = page.locator('#adminFrascosMunicipalTbody tr', { hasText: 'HENM' });
  await expect(fH).toContainText('500');
});

test('Vista de la unidad: lo que le repartieron contra lo que ella captura (y existencia real para el pronóstico)', async ({ page }) => {
  await montar(page, 'UNIDAD');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div id="influenzaBalanceUnidad"></div>');
    // Sin reparto todavía
    window.__b0 = renderInfluenzaBalanceUnidad();
  });
  await expect(page.locator('#influenzaBalanceUnidad')).toContainText('Aún no te han repartido frascos');
  expect(await page.evaluate(() => window.__b0.recibidos)).toBe(0);

  // Le repartieron 5 frascos (50 dosis) y lleva 30 + 15 = 45 aplicadas: existencia 5, aprovechamiento 90%
  await page.evaluate(() => {
    _influenzaDistribucionCache = [{ clues: 'Q1', cantidad_frascos: 3 }, { clues: 'Q1', cantidad_frascos: 2 }];
    _influenzaCapturasCache = [{ fecha: '2026-10-09', valores: { r1: 20, r2: 10 } }, { fecha: '2026-10-16', valores: { r1: 15 } }];
    window.__b1 = renderInfluenzaBalanceUnidad();
  });
  expect(await page.evaluate(() => [window.__b1.recibidos, window.__b1.dosisRecibidas, window.__b1.aplicadas, window.__b1.existencia, window.__b1.estado])).toEqual([5, 50, 45, 5, 'ok']);
  await expect(page.locator('#influenzaBalanceUnidad')).toContainText('90.0% de lo repartido');
  await expect(page.locator('#influenzaBalanceUnidad .frs-balance-alerta')).toHaveCount(0);

  // Aplica 8 dosis más: 53 > 50 -> alerta, y la existencia para el pronóstico nunca baja de 0
  await page.evaluate(() => {
    _influenzaCapturasCache.push({ fecha: '2026-10-23', valores: { r1: 8 } });
    window.__b2 = renderInfluenzaBalanceUnidad();
  });
  expect(await page.evaluate(() => [window.__b2.existencia, window.__b2.estado])).toEqual([-3, 'excede']);
  await expect(page.locator('#influenzaBalanceUnidad .frs-balance-alerta')).toContainText('53 dosis aplicadas');
  await expect(page.locator('#influenzaBalanceUnidad .frs-balance-alerta')).toContainText('50');
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
const gridFn = modulo.slice(modulo.indexOf('function metaEnlazarInputs'), modulo.indexOf('// 3. CONTROL DE FRASCOS'));

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

test('Metas municipales: guardar bloquea si las unidades se pasan y avisa si faltan (suma exacta)', async ({ page }) => {
  await montarMetas(page, 'MUNICIPAL', [meta(null, 'QUERETARO', 100)]);
  await page.evaluate(() => { window.__toasts = []; window.__llamadas = []; window.__errores = []; });
  const guardados = () => page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'saveinfluenza_metas').length);
  const toasts = () => page.evaluate(() => window.__toasts);
  const poner = async (q1, q2, q3) => {
    await page.locator('input[data-rb="r1"][data-clues="Q1"]').fill(q1);
    await page.locator('input[data-rb="r1"][data-clues="Q2"]').fill(q2);
    await page.locator('input[data-rb="r1"][data-clues="Q3"]').fill(q3);
  };

  // Se pasan (105 de 100): no guarda
  await poner('60', '40', '5');
  await page.click('#btnSaveInfluenzaMetas');
  await expect.poll(toasts).toHaveLength(1);
  expect((await toasts())[0]).toContain('más que la meta municipal');
  expect(await guardados()).toBe(0);

  // Faltan 10: guarda y avisa en qué rubro
  await poner('50', '40', '0');
  await page.click('#btnSaveInfluenzaMetas');
  await expect.poll(guardados).toBe(1);
  await expect.poll(async () => (await toasts()).length).toBe(2);
  expect((await toasts())[1]).toContain('menos que la meta municipal');
  expect((await toasts())[1]).toContain('(10)');

  // Exacto: guarda sin aviso
  await poner('60', '40', '0');
  await page.click('#btnSaveInfluenzaMetas');
  await expect.poll(guardados).toBe(2);
  expect((await toasts()).length).toBe(2);
});

test('Metas jurisdiccionales: si cambian la meta de un municipio y sus unidades ya no suman, guarda y avisa', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', [
    meta(null, 'QUERETARO', 100), meta('Q1', 'QUERETARO', 60), meta('Q2', 'QUERETARO', 40)]);
  await page.evaluate(() => { window.__toasts = []; window.__llamadas = []; });
  const q = page.locator('input[data-rb="r1"][data-muni="QUERETARO"]');
  await expect(q).toHaveValue('100');
  await page.click('#btnSaveInfluenzaMetas');                // sin cambios: cuadra, sin aviso
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  expect(await page.evaluate(() => window.__toasts)).toEqual([]);

  await q.fill('90');                                         // las unidades suman 100: ya no cuadra
  await page.click('#btnSaveInfluenzaMetas');
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__toasts.length)).toBe(1);
  const aviso = (await page.evaluate(() => window.__toasts))[0];
  expect(aviso).toContain('Querétaro (1 rubro)');
  expect(aviso).not.toContain('Corregidora');
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
