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
// Vacuna activa (Influenza / COVID-19): estado y accesores que usa el bloque de frascos.
const iVac = modulo.indexOf('// ─── Vacuna activa en Distribución de Metas');
const iPeso = modulo.indexOf('function metaPesoRubro');
const vacuna = modulo.slice(iVac, modulo.indexOf('}', iPeso) + 1);
const vacunaFns = modulo.slice(
  modulo.indexOf('async function loadCovidAdminData'),
  modulo.indexOf('async function populateInfluenzaAdminFilters'));

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
    meta('Q1', 'QUERETARO', 30000), meta('Q2', 'QUERETARO', 20000), meta('Q3', 'QUERETARO', 10000)
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
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ content: DATOS });
  await page.addScriptTag({ content: vacuna + vacunaFns });
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
    _adminMetasArray.push({ clues: 'C1', municipio: 'CORREGIDORA', metas: { r1: 5000 } }, { clues: 'H1', municipio: 'HUIMILPAN', metas: { r1: 3000 } }, { clues: 'H2', municipio: 'HUIMILPAN', metas: { r1: 1000 } });
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
  expect(ws.getRow(9).getCell(1).value).toBe('META (frascos)');
  expect(ws.getRow(10).getCell(1).value).toBe('TOTAL ENTREGADO');
  expect(JSON.stringify(ws.conditionalFormattings)).toContain('FFC6EFCE');
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
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ content: rubros + vacuna + vacunaFns });
  await page.addScriptTag({ content: bloque });
  await page.addScriptTag({ content: gridFn + 'window.__render = renderMetasConfigurationGrid;' });
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

test('Metas municipales: fila de frascos (solo Pedro Escobedo admite abierto), repartir parejo y pegado desde Excel', async ({ page }) => {
  await montarMetas(page, 'MUNICIPAL', [meta(null, 'QUERETARO', 100)]);
  const q1 = page.locator('input[data-rb="r1"][data-clues="Q1"]');
  // Q2 (otra unidad de Querétaro) con frasco abierto: en rojo, aunque sea Querétaro
  await page.locator('input[data-rb="r1"][data-clues="Q2"]').fill('215');
  await expect(page.locator('#frs_Q2')).toHaveAttribute('data-estado', 'mal');
  await expect(page.locator('#frs_label')).toContainText('solo Pedro Escobedo');
  await page.locator('input[data-rb="r1"][data-clues="Q2"]').fill('220');
  // Pedro Escobedo (QTSSA001863) sí puede quedar con frasco abierto: ámbar
  await page.evaluate(() => { _allUnidades[0].clues = 'QTSSA001863'; _allUnidades[0].unidad = 'PEDRO ESCOBEDO'; window.__render(); });
  const pe = page.locator('input[data-rb="r1"][data-clues="QTSSA001863"]');
  await pe.fill('215');
  await expect(page.locator('#frs_QTSSA001863')).toHaveAttribute('data-estado', 'aviso');
  await expect(page.locator('#frs_QTSSA001863')).toContainText('21.5');
  await pe.fill('220');
  await expect(page.locator('#frs_QTSSA001863')).toHaveAttribute('data-estado', 'ok');
  const q1x = pe;

  // Repartir parejo: 100 entre 3 unidades -> 34/33/33
  await page.locator('tr[data-rb="r1"] .meta-split-btn').click();
  await expect(q1x).toHaveValue('34');
  await expect(page.locator('input[data-rb="r1"][data-clues="Q3"]')).toHaveValue('33');

  // Pegado de bloque (2 filas x 2 columnas) desde Q1/r1
  await q1x.focus();
  await page.evaluate(() => {
    const el = document.querySelector('input[data-rb="r1"][data-clues="QTSSA001863"]');
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

test('Tope duro: lo recibido en todas las entregas no puede rebasar la meta en frascos (Jurisdicción)', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  // Meta HENM = 500 dosis = 50 frascos; ya recibió 40 en la 1ª entrega: en la 2ª solo caben 10.
  await page.evaluate(() => {
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 40, asignacion: { HENM: 40 }, manual: [] }];
    renderFrascosDistribution();
    _remesaState.numero = 2;
    cargarRemesaSeleccionada();
    window.__toasts = []; window.__llamadas = [];
  });
  await page.fill('#remesaTotalInput', '400');
  // El reparto automático respeta el tope de HENM (10) y manda el sobrante a los demás
  expect(await page.evaluate(() => document.getElementById('rem_inp_HENM').value)).toBe('10');

  // Editarlo a mano por arriba del tope: rojo, mensaje y no guarda
  await page.fill('#rem_inp_HENM', '11');
  await expect(page.locator('#rem_inp_HENM')).toHaveClass(/frs-num--excede/);
  await expect(page.locator('#remesaResumen')).toContainText('Rebasa la meta de frascos');
  await page.click('#btnRemesaCuadrar');
  await page.click('#btnSaveRemesa');
  expect(await page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'saveinfluenza_remesa').length)).toBe(0);
  expect(await page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '')).toContain('rebasa la meta de frascos');
});

test('Tope duro: si el total ya no cabe en la meta de la campaña, no guarda', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate(() => {
    // Metas totales = 6000+900+700+300+500+400 dosis = 880 frascos
    _adminRemesasArray = [{ numero_entrega: 1, fecha: '2026-10-05', total_frascos: 870, asignacion: { QUERETARO: 600, CORREGIDORA: 90, MARQUES: 70, HUIMILPAN: 30, HENM: 50, NHG: 30 }, manual: [] }];
    renderFrascosDistribution();
    _remesaState.numero = 2;
    cargarRemesaSeleccionada();
    window.__toasts = []; window.__llamadas = [];
  });
  await page.fill('#remesaTotalInput', '200');
  await expect(page.locator('#remesaResumen')).toContainText('ya no caben');
  await page.click('#btnSaveRemesa');
  expect(await page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'saveinfluenza_remesa').length)).toBe(0);
});

test('Tope duro: el municipio no puede dar a una unidad más de su meta contando entregas anteriores', async ({ page }) => {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    // Q1 meta 30000 dosis = 3000 frascos, ya recibió 2990 en la entrega 1
    _adminFrascosArray = [{ clues: 'Q1', municipio: 'QUERETARO', numero_entrega: 1, cantidad_frascos: 2990 }];
    _adminRemesasArray = [
      { numero_entrega: 1, fecha: '2026-10-05', total_frascos: 2990, asignacion: { QUERETARO: 2990 }, manual: [] },
      { numero_entrega: 2, fecha: '2026-10-09', total_frascos: 300, asignacion: { QUERETARO: 300 }, manual: [] }];
    renderFrascosDistribution();
    _muniRepartoState.numero = 2;
    renderFrascosMunicipal('QUERETARO');
    window.__toasts = []; window.__llamadas = [];
  });
  // Por meta le tocarían ~150 a Q1, pero solo le caben 10: el resto va a Q2 y Q3
  expect(await page.evaluate(() => document.getElementById('batch_frascos_Q1').value)).toBe('10');
  await page.fill('#batch_frascos_Q1', '20');
  await expect(page.locator('#batch_frascos_Q1')).toHaveClass(/frs-num--excede/);
  await page.fill('#batch_frascos_Q2', '180');
  await page.fill('#batch_frascos_Q3', '100');
  await page.click('#btnSaveFrascoEntrega');
  expect(await page.evaluate(() => window.__llamadas.filter((l) => l[0] === 'guardarinfluenza_reparto').length)).toBe(0);
  expect(await page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '')).toContain('rebasa la meta de frascos');
});

// ─── COVID-19: metas por rubro y frascos por marca (Moderna 10 dosis, Pfizer 6; pediátricas valen la mitad) ───
const metasCovid = [
  { clues: null, municipio: 'QUERETARO', metas: { c1: 200, c2: 200, c3: 600, c4: 200, c5: 0, c6: 0 } },
  { clues: null, municipio: 'CORREGIDORA', metas: { c1: 0, c2: 0, c3: 500, c4: 0, c5: 0, c6: 0 } }
];

test('COVID: la meta se calcula en dosis de 0.5 mL y Pfizer solo cubre la parte adulta', async ({ page }) => {
  await page.goto('/reference.html');
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  const r = await page.evaluate(() => {
    const m = { c1: 200, c2: 200, c3: 600, c4: 200, c5: 0, c6: 0 };
    return {
      equiv: CovidFrascos.metaEquivalente(m),
      adulta: CovidFrascos.metaAdulta(m),
      impar: CovidFrascos.metaEquivalente({ c1: 1, c2: 0, c3: 0 }),            // 0.5 → sube a 1
      modernaLibre: CovidFrascos.topeFrascos({ total: 1000, adulto: 800, marca: 'MODERNA', propiasOtras: 0, otraMarca: 0 }),
      pfizerLibre: CovidFrascos.topeFrascos({ total: 1000, adulto: 800, marca: 'PFIZER', propiasOtras: 0, otraMarca: 0 }),
      // 80 frascos de Moderna (5 dosis = 400) ya entregados: a Pfizer le caben (1000-400)/6 = 100
      pfizerTrasModerna: CovidFrascos.topeFrascos({ total: 1000, adulto: 800, marca: 'PFIZER', propiasOtras: 0, otraMarca: 80 }),
      // 100 frascos de Pfizer (600 dosis): a Moderna le caben (1000-600)/5 = 80
      modernaTrasPfizer: CovidFrascos.topeFrascos({ total: 1000, adulto: 800, marca: 'MODERNA', propiasOtras: 0, otraMarca: 100 })
    };
  });
  expect(r).toEqual({ equiv: 1000, adulta: 800, impar: 1, modernaLibre: 200, pfizerLibre: 134,
    pfizerTrasModerna: 100, modernaTrasPfizer: 80 });   // Moderna = 5 dosis por frasco, Pfizer = 6
});

test('COVID Jurisdicción: reparte Moderna por la meta equivalente y Pfizer descuenta lo ya entregado de Moderna', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate((metas) => {
    _vacuna = 'COVID'; _marcaCovid = 'MODERNA';
    _covidMetasArray = metas; _covidRemesasAll = []; _covidFrascosAll = [];
    renderFrascosDistribution();
  }, metasCovid);

  // Moderna: 150 frascos en proporción 1000 : 500 → 100 y 50 (cada uno justo en su tope)
  await page.fill('#remesaTotalInput', '150');
  expect(await valores(page, ['QUERETARO', 'CORREGIDORA'])).toEqual(['100', '50']);
  await expect(page.locator('#rem_dos_QUERETARO')).toHaveText('500');         // 100 frascos × 5 dosis

  // Guarda como COVID/MODERNA (acción y marca propias) y sin tocar las tablas de influenza
  await page.fill('#rem_inp_QUERETARO', '40');
  await page.fill('#rem_inp_CORREGIDORA', '20');
  await page.fill('#remesaTotalInput', '60');
  await page.click('#btnSaveRemesa');
  const guardada = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'savecovid_remesa'));
  expect(guardada[1].marca).toBe('MODERNA');
  expect(guardada[1].total_frascos).toBe(60);
  expect(guardada[1].asignacion.QUERETARO).toBe(40);
  expect(await page.evaluate(() => window.__llamadas.some((l) => l[0] === 'saveinfluenza_remesa'))).toBe(false);

  // Pfizer con esa Moderna ya entregada (40 y 20 frascos × 5 dosis): QUERETARO (1000-200)/6 = 134; CORREGIDORA (500-100)/6 = 67
  const topes = await page.evaluate(() => {
    _covidRemesasAll = [{ marca: 'MODERNA', numero_entrega: 1, fecha: '2026-10-05', total_frascos: 60, asignacion: { QUERETARO: 40, CORREGIDORA: 20 }, manual: [] }];
    _marcaCovid = 'PFIZER';
    _remesaState.numero = null;
    renderFrascosDistribution();
    return calcularRemesa().items.filter((i) => ['QUERETARO', 'CORREGIDORA'].includes(i.id)).map((i) => [i.id, i.meta, i.tope]);
  });
  expect(topes).toEqual([['QUERETARO', 800, 134], ['CORREGIDORA', 500, 67]]);   // meta Pfizer = solo adulta
  await page.fill('#remesaTotalInput', '300');
  await expect(page.locator('#remesaResumen')).toContainText('ya no caben');       // 201 máx. entre los dos
});

test('COVID Metas: 6 rubros del formato y renglón de frascos Moderna (niños, 10) / Pfizer (adultos, 6)', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', []);
  await page.evaluate((metas) => {
    _vacuna = 'COVID'; _covidMetasArray = metas;
    document.getElementById('metaCampaignSelect') || document.body.insertAdjacentHTML('beforeend', '<select id="metaCampaignSelect"><option value="2026-2027">x</option></select>');
    window.__render();
  }, metasCovid);
  await expect(page.locator('#influenzaMetasTbody tr[data-rb]')).toHaveCount(6);
  await expect(page.locator('input[data-rb="c1"][data-muni="QUERETARO"]')).toHaveValue('200');
  // Querétaro: niños 200 (c1+c2 = 400 dosis de 0.25 mL = 200 de 0.5 mL) → 40 frascos Moderna (5 dosis); adultos 800 → 133.3 Pfizer
  await expect(page.locator('#frs_QUERETARO')).toContainText('Moderna 40 fr. ✓');
  await expect(page.locator('#frs_QUERETARO')).toContainText('Pfizer 133.3 fr. abierto');
  await expect(page.locator('#frs_QUERETARO')).toHaveAttribute('data-estado', 'aviso');   // Querétaro sí puede quedar abierto
  // Corregidora: solo adultos 500 → 83.3 frascos Pfizer: abierto y NO es Querétaro → rojo
  await expect(page.locator('#frs_CORREGIDORA')).toContainText('Pfizer 83.3 fr. abierto');
  await expect(page.locator('#frs_CORREGIDORA')).toHaveAttribute('data-estado', 'mal');
  await expect(page.locator('.meta-frascos-row td').first()).toContainText('FRASCOS (Moderna · Pfizer)');

  // Cerrarlo: adultos de Corregidora en 504 (84 frascos) y ya queda en verde
  await page.fill('input[data-rb="c3"][data-muni="CORREGIDORA"]', '504');
  await expect(page.locator('#frs_CORREGIDORA')).toContainText('Pfizer 84 fr. ✓');
  await expect(page.locator('#frs_CORREGIDORA')).toHaveAttribute('data-estado', 'ok');
});

test('COVID Metas: predistribuir con % de influenza reparte exacto y NHGQ queda solo con adultos', async ({ page }) => {
  const inf = (municipio, r) => ({ clues: null, municipio, metas: r });
  await montarMetas(page, 'JURISDICCIONAL', [
    inf('QUERETARO', { r1: 6000, r15: 3000, r16: 500, r17: 100, r18: 2000 }),
    inf('CORREGIDORA', { r1: 2000, r15: 1000, r16: 300, r17: 100, r18: 1000 }),
    inf('MARQUES', { r1: 2000, r15: 1000, r16: 200, r17: 100, r18: 1000 }),
    inf('HUIMILPAN', { r1: 0, r15: 0 }),
    inf('HENM', { r1: 300, r15: 1000 }),
    inf('NHG', { r1: 0, r15: 996, r17: 504 })
  ]);
  await page.evaluate(() => {
    _vacuna = 'COVID'; _covidMetasArray = [];
    window.__render();
  });
  const total = { c1: 1000, c2: 1000, c3: 100, c4: 200, c5: 50, c6: 40 };
  for (const [k, v] of Object.entries(total)) await page.fill(`input[data-rb="${k}"][data-juris]`, String(v));
  await page.click('#btnCovidPredistribuir');
  for (const [k, v] of Object.entries(total)) {
    const suma = await page.evaluate((rb) => [...document.querySelectorAll(`input[data-rb="${rb}"][data-muni]`)]
      .reduce((s, i) => s + (parseInt(i.value, 10) || 0), 0), k);
    expect(suma).toBe(v);                                     // lo repartido suma justo la meta de Jurisdicción
  }
  await expect(page.locator('input[data-rb="c1"][data-muni="NHG"]')).toHaveValue('0');   // NHGQ sin meta pediátrica
  await expect(page.locator('input[data-rb="c2"][data-muni="NHG"]')).toHaveValue('0');
  await expect(page.locator('input[data-rb="c4"][data-muni="NHG"]')).not.toHaveValue('0');
  await expect(page.locator('input[data-rb="c3"][data-muni="NHG"]')).not.toHaveValue('0');   // NHGQ: riesgo 5-59 y 60+
  await expect(page.locator('input[data-rb="c5"][data-muni="NHG"]')).toHaveValue('0');
  await expect(page.locator('input[data-rb="c6"][data-muni="NHG"]')).not.toHaveValue('0');  // y personal de salud
  await expect(page.locator('input[data-rb="c1"][data-muni="HENM"]')).toHaveValue('0');     // HENM: sin pediátrica
  await expect(page.locator('input[data-rb="c5"][data-muni="HENM"]')).toHaveValue('0');
  await expect(page.locator('input[data-rb="c3"][data-muni="HENM"]')).not.toHaveValue('0');
  await expect(page.locator('input[data-rb="c6"][data-muni="HENM"]')).not.toHaveValue('0');
  await expect(page.locator('input[data-rb="c1"][data-muni="HUIMILPAN"]')).toHaveValue('0'); // sin meta en influenza = sin % 
  await expect(page.locator('#cmp_c1')).toHaveAttribute('data-estado', 'ok');             // Comparación en verde
});

test('COVID Metas: Jurisdicción solo guarda destinos (municipios y hospitales), nunca filas por unidad', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', [
    { clues: null, municipio: 'QUERETARO', metas: { r1: 6000, r15: 3000, r18: 2000 } },
    { clues: 'Q1', municipio: 'QUERETARO', metas: { r1: 3000, r15: 1500, r18: 1000 } }
  ]);
  await page.evaluate(() => { window.__llamadas = []; window.__errores = []; window.__toasts = []; _vacuna = 'COVID'; _covidMetasArray = []; window.__render(); });
  await expect(page.locator('#btnCovidPredistribuir')).toBeVisible();
  expect(await page.locator('#btnCovidPredistribuirUnidades').count()).toBe(0);     // no existe botón «por unidades»
  await page.fill('input[data-rb="c4"][data-juris]', '100');
  await page.click('#btnCovidPredistribuir');
  await page.click('#btnSaveInfluenzaMetas');
  const rows = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'savecovid_metas')[1].rows);
  const conClues = rows.filter((r) => r.clues).map((r) => r.clues).sort();
  expect(conClues).toEqual(['QTSSA001740', 'QTSSA002901']);                        // solo las CLUES de los hospitales
});

test('COVID Metas: el municipal predistribuye SU meta entre sus unidades con el % de influenza de cada una', async ({ page }) => {
  const f = (clues, r) => ({ clues, municipio: 'QUERETARO', metas: r });
  await montarMetas(page, 'MUNICIPAL', [
    f('Q1', { r1: 3000, r15: 1500 }), f('Q2', { r1: 2000, r15: 1000 }), f('Q3', { r1: 1000, r15: 500 })
  ]);
  await page.evaluate(() => {
    window.__llamadas = []; _vacuna = 'COVID';
    _covidMetasArray = [{ clues: null, municipio: 'QUERETARO', metas: { c1: 600, c2: 600, c3: 0, c4: 120, c5: 0, c6: 0 } }];
    window.__render();
  });
  await page.click('#btnCovidPredistribuir');
  const v = (rb, c) => page.locator(`input[data-rb="${rb}"][data-clues="${c}"]`).inputValue();
  expect([await v('c1', 'Q1'), await v('c1', 'Q2'), await v('c1', 'Q3')]).toEqual(['300', '200', '100']);   // 50 / 33 / 17 %
  // Adultos: 120 repartido en frascos cerrados de Pfizer (múltiplos de 6) y sumando exacto
  const ad = (await Promise.all(['Q1', 'Q2', 'Q3'].map((c) => v('c4', c)))).map(Number);
  expect(ad.reduce((a, b) => a + b, 0)).toBe(120);
  ad.forEach((n) => expect(n % 6).toBe(0));
  expect(ad[0]).toBeGreaterThanOrEqual(ad[1]);                                                        // el orden de influenza se respeta
  await expect(page.locator('#cmp_c1')).toHaveAttribute('data-estado', 'ok');
  await page.click('#btnSaveInfluenzaMetas');
  const rows = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'savecovid_metas')[1].rows);
  expect(rows.map((r) => r.clues).sort()).toEqual(['Q1', 'Q2', 'Q3']);          // el municipal solo escribe unidades
});

// ─── COVID: factor de pérdida (dosis de 0.5 mL, a nivel Jurisdicción; no es parte de la meta) ───
const JURIS_COVID = { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859, perdida: 3900 };

test('COVID pérdida: Moderna 68,891 + Pfizer 12,843 = 81,734 (Moderna cubre el 100% de niños) y la meta sigue en 77,834', async ({ page }) => {
  await page.goto('/reference.html');
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  const r = await page.evaluate((j) => {
    const f = CovidFrascos.factorPerdida(j);
    const mod = CovidFrascos.metaMarcaConPerdida(j, 'MODERNA', f);
    const pf = CovidFrascos.metaMarcaConPerdida(j, 'PFIZER', f);
    return {
      meta: CovidFrascos.metaEquivalente(j), adulta: CovidFrascos.metaAdulta(j), modernaTotal: mod, pfizerAdultos: pf,
      pedConPerdida: CovidFrascos.metaMarcaConPerdida({ c1: 65604, c2: 65604 }, 'MODERNA', f),
      sinFactor: CovidFrascos.metaMarcaConPerdida(j, 'MODERNA', CovidFrascos.factorPerdida({ ...j, perdida: 0 }))
    };
  }, JURIS_COVID);
  expect(r.meta).toBe(77834);                     // la pérdida no se suma a la meta
  expect(r.modernaTotal).toBe(81734);             // Moderna (meta completa) + pérdida = lo que se debe recibir
  expect(r.pfizerAdultos).toBe(12843);            // adultos 12,230 + su parte de pérdida
  expect(r.pedConPerdida).toBe(68892);            // niños 65,604 + 3,287.3 (se redondea hacia arriba)
  expect(r.pedConPerdida + r.pfizerAdultos - 81734).toBeLessThanOrEqual(1);   // solo difiere por el redondeo
  expect(r.sinFactor).toBe(77834);
});

test('COVID pérdida: el tope de frascos y los topes del municipio usan la meta + pérdida; guarda la pérdida en la fila JURISDICCION', async ({ page }) => {
  await montar(page, 'JURISDICCIONAL');
  await page.evaluate((j) => {
    _vacuna = 'COVID'; _marcaCovid = 'MODERNA';
    // Querétaro con toda la meta: recibe 81,734 dosis → 16,347 frascos de Moderna (5 dosis; ceil de 16,346.8)
    _covidMetasArray = [
      { clues: null, municipio: 'JURISDICCION', metas: j },
      { clues: null, municipio: 'QUERETARO', metas: { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859 } }
    ];
    _covidRemesasAll = []; _covidFrascosAll = [];
    renderFrascosDistribution();
  }, JURIS_COVID);
  const q = await page.evaluate(() => calcularRemesa().items.find((i) => i.id === 'QUERETARO'));
  expect(q.meta).toBe(81734);
  expect(q.tope).toBe(16347);
  expect(q.metaFrascos).toBe(16347);
  // Pfizer: solo adultos con pérdida = 12,843 → 2,141 frascos
  const pf = await page.evaluate(() => { _marcaCovid = 'PFIZER'; _remesaState.numero = null; renderFrascosDistribution();
    return calcularRemesa().items.find((i) => i.id === 'QUERETARO'); });
  expect(pf.meta).toBe(12843);
  expect(pf.tope).toBe(2141);
});

test('COVID pérdida (Metas): Jurisdicción captura la pérdida; el municipal la ve sin poder cambiarla', async ({ page }) => {
  await montarMetas(page, 'JURISDICCIONAL', []);
  await page.evaluate((j) => {
    window.__llamadas = []; window.__errores = []; window.__toasts = [];
    _vacuna = 'COVID'; _covidMetasArray = [{ clues: null, municipio: 'JURISDICCION', metas: j }];
    window.__render();
  }, { ...JURIS_COVID, perdida: 0 });
  await expect(page.locator('#covidPerdidaBox')).toBeVisible();
  await expect(page.locator('#covidPerdidaInput')).toBeEnabled();
  await page.fill('#covidPerdidaInput', '3900');
  await expect(page.locator('#covidPerdidaTxt')).toContainText('5.01 %');
  await expect(page.locator('#covidPerdidaTxt')).toContainText('81,734');
  await page.click('#btnSaveInfluenzaMetas');
  const juris = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'savecovid_metas')[1].rows.find((r) => r.municipio === 'JURISDICCION').metas);
  expect(juris.perdida).toBe(3900);
});

test('COVID pérdida (Metas): el municipal ve el factor pero no lo puede editar', async ({ page }) => {
  await montarMetas(page, 'MUNICIPAL', []);
  await page.evaluate((j) => {
    _vacuna = 'COVID'; _covidMetasArray = [{ clues: null, municipio: 'JURISDICCION', metas: j }];
    window.__render();
  }, JURIS_COVID);
  await expect(page.locator('#covidPerdidaInput')).toBeDisabled();
  await expect(page.locator('#covidPerdidaInput')).toHaveValue('3900');
});

test('COVID: recorrido completo (metas y frascos, Jurisdicción y municipal, ambas marcas) sin errores de consola', async ({ page }) => {
  const errores = [];
  // reference.html (el lienzo de la prueba) trae su propio bucle de animación que falla al vaciar el <body>:
  // no es de la app, se ignora cuando la pila no pasa por código de influenza/COVID.
  page.on('pageerror', (e) => {
    const pila = String(e.stack || '');
    if (!/reference\.html/.test(pila) || /influenza|covid/i.test(pila)) errores.push(`pageerror: ${e.message} @ ${pila}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  const metasInf = [
    { clues: null, municipio: 'QUERETARO', metas: { r1: 6000, r15: 3000, r16: 500, r17: 100, r18: 2000 } },
    { clues: 'Q1', municipio: 'QUERETARO', metas: { r1: 3000, r15: 1500, r18: 1000 } },
    { clues: 'Q2', municipio: 'QUERETARO', metas: { r1: 2000, r15: 1000, r18: 800 } },
    { clues: 'Q3', municipio: 'QUERETARO', metas: { r1: 1000, r15: 500, r18: 200 } }
  ];
  for (const rol of ['JURISDICCIONAL', 'MUNICIPAL']) {
    await montarMetas(page, rol, metasInf);
    await page.evaluate(([j]) => {
      window.__llamadas = []; window.__errores = []; window.__toasts = [];
      _vacuna = 'COVID'; _marcaCovid = 'MODERNA';
      _covidMetasArray = [
        { clues: null, municipio: 'JURISDICCION', metas: j },
        { clues: null, municipio: 'QUERETARO', metas: { c1: 600, c2: 600, c3: 100, c4: 120, c5: 10, c6: 10 } }
      ];
      _covidRemesasAll = []; _covidFrascosAll = [];
      window.__render();
    }, [JURIS_COVID]);
    await page.click('#btnCovidPredistribuir');
    if (rol === 'JURISDICCIONAL') await page.fill('#covidPerdidaInput', '100');   // el municipal solo la ve
    await page.click('#btnSaveInfluenzaMetas');
  }
  // Frascos: ambas marcas, ambos roles
  for (const rol of ['JURISDICCIONAL', 'MUNICIPAL']) {
    await montar(page, rol);
    await page.evaluate(() => {
      _vacuna = 'COVID'; _marcaCovid = 'MODERNA';
      _covidMetasArray = [
        { clues: null, municipio: 'JURISDICCION', metas: { c1: 600, c2: 600, c3: 100, c4: 120, c5: 10, c6: 10, perdida: 50 } },
        { clues: null, municipio: 'QUERETARO', metas: { c1: 600, c2: 600, c3: 100, c4: 120, c5: 10, c6: 10 } },
        { clues: 'Q1', municipio: 'QUERETARO', metas: { c1: 300, c2: 300, c3: 50, c4: 60, c5: 5, c6: 5 } },
        { clues: 'Q2', municipio: 'QUERETARO', metas: { c1: 300, c2: 300, c3: 50, c4: 60, c5: 5, c6: 5 } }
      ];
      _covidRemesasAll = [{ marca: 'MODERNA', numero_entrega: 1, fecha: '2026-10-05', total_frascos: 20, asignacion: { QUERETARO: 20 }, manual: [] }];
      _covidFrascosAll = [];
      renderFrascosDistribution();
    });
    await page.evaluate(() => { _marcaCovid = 'PFIZER'; _remesaState.numero = null; _muniRepartoState.numero = null; renderFrascosDistribution(); });
    await page.evaluate(() => { _marcaCovid = 'MODERNA'; renderFrascosDistribution(); });
    if (rol === 'JURISDICCIONAL') {
      await page.fill('#remesaTotalInput', '10');
      await page.click('#btnSaveRemesa');
    } else {
      await page.click('#btnSaveFrascoEntrega');
    }
    // Volver a influenza no debe romper nada
    await page.evaluate(() => { _vacuna = 'INFLUENZA'; renderFrascosDistribution(); });
  }
  expect(errores).toEqual([]);
});

// ─── Panel «Temporada invernal»: vacuna a nivel de panel, cada vacuna con su espacio ───
const panelTemporada = html.slice(
  html.indexOf('<!-- META LOGRO INFLUENZA ADMIN/MUNICIPAL -->'),
  html.indexOf('<!-- SECCIÓN 1: CONCENTRADO DE AVANCES -->'));

async function montarPanel(page) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate((h) => {
    window.__llamadas = []; window.__clicks = [];
    document.body.innerHTML = h;
    document.getElementById('panelINFLUENZAADMIN').style.display = '';
    ['Avances', 'Validacion', 'Conciliacion', 'Metas', 'Frascos', 'Config'].forEach((n) => {
      document.getElementById(`subtabInfluenza${n}`).addEventListener('click', () => window.__clicks.push(n));
    });
    document.getElementById('subtabCovidAvance').addEventListener('click', () => window.__clicks.push('CovidAvance'));
  }, panelTemporada);
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ content: `
    var USER = { rol: 'JURISDICCIONAL' };
    var _adminMetasArray = [], _adminRemesasArray = [], _adminFrascosArray = [];
    var AppService = { call: async function (a, p) { window.__llamadas.push([a, p]); return { ok: true, data: [] }; } };
    var showToast = function () {};
    var renderActiveAdminSection = function () {};
    var syncTabGroupIndicator = function () {};
    var _remesaState = {}, _muniRepartoState = {};` });
  await page.addScriptTag({ content: vacuna + vacunaFns });
  await page.evaluate(() => vacunaPintarSelectores());   // como al abrir el panel (refreshInfluenzaAdminPanel)
}

test('Temporada invernal: título, barra de vacuna a nivel de panel y un solo selector de vacuna', async ({ page }) => {
  await montarPanel(page);
  await expect(page.locator('#panelINFLUENZAADMIN h3')).toContainText('Temporada invernal — Panel de Control');
  await expect(page.locator('#temporadaVacunaBar .vac-btn')).toHaveCount(2);
  await expect(page.locator('.vac-seg')).toHaveCount(1);                 // ya no hay un selector repetido en cada pestaña
  expect(await page.locator('#influenzaAdminTabsContainer .nav-tab').count()).toBe(7);   // 6 de influenza + Avance COVID-19
});

test('Temporada invernal: COVID-19 muestra solo Metas y Frascos; Influenza conserva todas sus subpestañas', async ({ page }) => {
  await montarPanel(page);
  const visibles = () => page.evaluate(() => [...document.querySelectorAll('#influenzaAdminTabsContainer .nav-tab')]
    .filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.id.replace('subtabInfluenza', '').replace('subtabCovid', 'Covid')));
  expect(await visibles()).toEqual(['Avances', 'Validacion', 'Conciliacion', 'Metas', 'Frascos', 'Config']);

  await page.click('#temporadaVacunaBar [data-vac="COVID"]');
  await expect.poll(visibles).toEqual(['CovidAvance', 'Metas', 'Frascos']);
  expect(await page.evaluate(() => window.__llamadas.map((l) => l[0]).sort()))
    .toEqual(['getcovid_distribucion', 'getcovid_lotes_entregas', 'getcovid_metas', 'getcovid_remesas']);   // carga lo de COVID, no lo de influenza
  // estaba en «Concentrado de Avances» (activa): pasa sola a la primera de COVID-19, Avance COVID-19
  expect(await page.evaluate(() => window.__clicks)).toEqual(['CovidAvance']);

  await page.click('#temporadaVacunaBar [data-vac="INFLUENZA"]');
  await expect.poll(visibles).toEqual(['Avances', 'Validacion', 'Conciliacion', 'Metas', 'Frascos', 'Config']);
  await expect(page.locator('#temporadaVacunaBar [data-vac="INFLUENZA"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Temporada invernal: el selector de temporada se muestra neutro, pero su valor sigue siendo el nombre de la campaña', async ({ page }) => {
  await page.goto('/reference.html');
  const fn = modulo.slice(modulo.indexOf('function populateCampaignSelectors()'), modulo.indexOf('async function selectCampaignByName'));
  const r = await page.evaluate((codigo) => {
    document.body.innerHTML = '<select id="metaCampaignSelect"></select><select id="influenza_campana"></select>';
    window._allCampaigns = [{ nombre: 'Campaña Influenza 2026-2027' }];
    window._selectedCampaign = { nombre: 'Campaña Influenza 2026-2027' };
    window._campaignConfig = {};
    window.deriveCampaignName = () => '2026-2027';
    window.populateConciliacionMonths = () => {};
    // eslint-disable-next-line no-new-func
    new Function(`${codigo}; populateCampaignSelectors();`)();
    const o = (id) => { const s = document.getElementById(id); return [s.value, s.options[0].textContent]; };
    return { meta: o('metaCampaignSelect'), captura: o('influenza_campana') };
  }, fn);
  expect(r.meta).toEqual(['Campaña Influenza 2026-2027', 'Temporada invernal 2026-2027']);
  expect(r.captura[1]).toBe('Campaña Influenza 2026-2027');   // la captura de la unidad sigue con el nombre de influenza
});

// ─── COVID: frascos cerrados (Moderna niños ×10, Pfizer adultos ×6), con la pérdida incluida ───
test('COVID frascos cerrados: con las cifras de Jurisdicción todos cierran salvo Querétaro (que absorbe el abierto) y suman exacto', async ({ page }) => {
  await page.goto('/reference.html');
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  const r = await page.evaluate(() => {
    const mk = (ped, m60, emb, pers, ries) => ({ r1: ped, r15: m60, r16: emb, r17: pers, r18: ries });
    const items = [
      { id: 'QUERETARO', metas: mk(50340, 23691, 4674, 627, 20505) },
      { id: 'CORREGIDORA', metas: mk(6340, 2203, 620, 250, 3177) },
      { id: 'MARQUES', metas: mk(8099, 2557, 1000, 300, 3934) },
      { id: 'HUIMILPAN', metas: mk(3030, 1267, 350, 150, 1833) },
      { id: 'HENM', metas: mk(300, 1000, 0, 0, 0), permitidos: ['c3', 'c4', 'c6'] },
      { id: 'NHG', metas: mk(0, 996, 0, 504, 0), permitidos: ['c3', 'c4', 'c6'] }
    ];
    const tot = { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859 };
    const out = CovidFrascos.predistribuirCerrado(tot, items, { perdida: 3900, absorbedor: 'QUERETARO' });
    const raz = CovidFrascos.razonPerdida(CovidFrascos.factorPerdida({ ...tot, perdida: 3900 }));
    const filas = items.map((it) => {
      const v = out.valores[it.id];
      const ad = v.c3 + v.c4 + v.c5 + v.c6;
      return { id: it.id, v, ped: v.c1, ad, modCerrado: CovidFrascos.esCerrado(v.c1, 5, raz), pfCerrado: CovidFrascos.esCerrado(ad, 6, raz),
        mod: CovidFrascos.recibirDosis(v.c1, raz) / 5, pf: CovidFrascos.recibirDosis(ad, raz) / 6 };
    });
    const suma = (rb) => items.reduce((a, it) => a + out.valores[it.id][rb], 0);
    return { filas, sumas: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(suma), abiertos: out.abiertos };
  });
  expect(r.sumas).toEqual([65604, 65604, 4135, 6288, 948, 859]);       // suma exacta contra Jurisdicción
  expect(r.abiertos).toEqual([]);
  r.filas.filter((f) => f.id !== 'QUERETARO').forEach((f) => {
    expect(f.modCerrado, `${f.id} Moderna`).toBe(true);                   // frascos completos de Moderna
    expect(f.pfCerrado, `${f.id} Pfizer`).toBe(true);                     // frascos completos de Pfizer
    expect(Number.isInteger(f.mod) && Number.isInteger(f.pf)).toBe(true);
  });
  const hosp = r.filas.filter((f) => ['HENM', 'NHG'].includes(f.id));
  hosp.forEach((f) => { expect(f.v.c1).toBe(0); expect(f.v.c2).toBe(0); expect(f.v.c5).toBe(0); });   // sin niños ni embarazadas
  expect(r.filas.find((f) => f.id === 'NHG').v.c6).toBeGreaterThan(0);
});

test('COVID frascos cerrados: sin absorbedor (otro municipio) las unidades cierran y suman exacto la meta municipal', async ({ page }) => {
  await page.goto('/reference.html');
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  const r = await page.evaluate(() => {
    const mk = (ped, m60, emb, pers, ries) => ({ r1: ped, r15: m60, r16: emb, r17: pers, r18: ries });
    const items = [
      { id: 'U1', metas: mk(3000, 900, 100, 40, 500) }, { id: 'U2', metas: mk(2000, 700, 60, 30, 300) },
      { id: 'U3', metas: mk(1000, 400, 40, 20, 200) }, { id: 'U4', metas: mk(500, 200, 20, 10, 100) }
    ];
    // municipio ya cerrado con pérdida: niños 1,000 (c1=c2), adultos 240
    const tot = { c1: 1000, c2: 1000, c3: 60, c4: 120, c5: 36, c6: 24 };
    const jur = { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859 };
    const out = CovidFrascos.predistribuirCerrado(tot, items, { perdida: 3900, jurisTotales: jur });
    const raz = CovidFrascos.razonPerdida(CovidFrascos.factorPerdida({ ...jur, perdida: 3900 }));
    const suma = (rb) => items.reduce((a, it) => a + out.valores[it.id][rb], 0);
    return {
      sumas: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(suma), abiertos: out.abiertos,
      cerrados: items.map((it) => {
        const v = out.valores[it.id];
        return CovidFrascos.esCerrado(v.c1, 5, raz) && CovidFrascos.esCerrado(v.c3 + v.c4 + v.c5 + v.c6, 6, raz);
      })
    };
  });
  expect(r.sumas).toEqual([1000, 1000, 60, 120, 36, 24]);
  expect(r.abiertos.length === 0 ? r.cerrados.every(Boolean) : true).toBe(true);   // o cierra todo, o avisa cuál quedó abierto
});

// ─── Avance de COVID-19: dosis aplicadas (SIS) contra la meta ───
test('COVID Avance: equivalentes de 0.5 mL (los niños valen la mitad), por rubro y total', async ({ page }) => {
  await page.goto('/reference.html');
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  const r = await page.evaluate(() => {
    const metas = { c1: 200, c2: 200, c3: 100, c4: 300, c5: 20, c6: 30 };           // equivalente = 200 + 450 = 650
    const apl = { c1: 100, c2: 50, c3: 100, c4: 150, c5: 0, c6: 45 };               // equivalente = 75 + 295 = 370
    const a = CovidFrascos.avanceRubros(metas, apl);
    return { metaEq: a.metaEq, aplEq: a.aplEq, pct: Math.round(a.pct * 10) / 10, pend: a.pendienteEq,
      c3: a.rubros.find((x) => x.id === 'c3').pct, c6: a.rubros.find((x) => x.id === 'c6').pct,
      vars: CovidFrascos.VARIABLE_SIS, sinMeta: CovidFrascos.avanceRubros({}, { c1: 5 }).pct };
  });
  expect(r.metaEq).toBe(650);
  expect(r.aplEq).toBe(370);
  expect(r.pct).toBe(56.9);
  expect(r.pend).toBe(280);
  expect(r.c3).toBe(100);
  expect(r.c6).toBe(150);                                   // puede rebasar 100 %
  expect(r.vars).toEqual({ c1: 'VCV38', c2: 'VCV39', c3: 'VCV28', c4: 'VCV16', c5: 'VCV20', c6: 'VCV21' });
  expect(r.sinMeta).toBeNull();                             // sin meta no hay porcentaje
});

const avanceFns = modulo.slice(
  modulo.indexOf('// ─── Avance de COVID-19: dosis aplicadas (SIS, validadas) contra la meta'),
  modulo.indexOf('// Caja «Factor de pérdida»: Jurisdicción la captura'));

const seccionAvance = html.slice(
  html.indexOf('<!-- AVANCE DE COVID-19: dosis aplicadas (SIS) contra la meta -->'),
  html.indexOf('<!-- SECCIÓN 2: DISTRIBUCIÓN DE METAS -->'));

async function montarAvance(page, rol, filasSis) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.addStyleTag({ path: path.join(raiz, 'style.css') });
  await page.evaluate(([h]) => {
    window.__llamadas = [];
    document.body.innerHTML = `${h}<select id="adminInfluenzaMuni"><option value="QUERETARO">Q</option></select>`;
    document.getElementById('secCovidAvance').classList.remove('hidden');
  }, [seccionAvance]);
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ content: DATOS.replace(/var _adminMetasArray = [\s\S]*?\];/, 'var _adminMetasArray = [];') });
  await page.addScriptTag({ content: `
    var _campaignConfig = { fecha_inicio: '2026-10-03', fecha_fin: '2027-03-31' };
    AppService.call = async function (a, p) { window.__llamadas.push([a, p]); return { ok: true, data: ${JSON.stringify(filasSis)} }; };` });
  await page.evaluate((r) => { window.USER.rol = r; }, rol);
  await page.addScriptTag({ content: vacuna + vacunaFns });
  await page.addScriptTag({ content: bloque });
  await page.addScriptTag({ content: avanceFns });
  await page.evaluate(() => {
    _vacuna = 'COVID';
    _covidMetasArray = [
      { clues: null, municipio: 'QUERETARO', metas: { c1: 200, c2: 200, c3: 100, c4: 300, c5: 20, c6: 30 } },
      { clues: null, municipio: 'HENM', metas: { c3: 50, c4: 100, c6: 10 } },
      { clues: 'Q1', municipio: 'QUERETARO', metas: { c1: 100, c2: 100, c3: 50, c4: 150, c5: 10, c6: 15 } },
      { clues: 'Q2', municipio: 'QUERETARO', metas: { c1: 100, c2: 100, c3: 50, c4: 150, c5: 10, c6: 15 } }
    ];
  });
}

test('COVID Avance (Jurisdicción): meta vs aplicadas por municipio/hospital con las dosis del SIS', async ({ page }) => {
  const sis = [
    { clues: 'Q1', variable_sis: 'VCV38', dosis: 60, ult: '2026-11-01' }, { clues: 'Q1', variable_sis: 'VCV39', dosis: 40, ult: '2026-11-01' },
    { clues: 'Q1', variable_sis: 'VCV16', dosis: 75, ult: '2026-11-01' }, { clues: 'Q2', variable_sis: 'VCV16', dosis: 25, ult: '2026-10-01' },
    { clues: 'QTSSA001740', variable_sis: 'VCV28', dosis: 50, ult: '2026-11-01' }
  ];
  await montarAvance(page, 'JURISDICCIONAL', sis);
  await page.evaluate(() => { document.getElementById('cavCorte').innerHTML = ''; return renderCovidAvance(); });
  // el corte por omisión existe y se pide el SIS desde el inicio de la campaña
  const llamada = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'getcovid_avance'));
  expect(llamada[1].desde).toBe('2026-10-03');
  await expect(page.locator('#cavTituloAmbito')).toContainText('municipio y hospital');
  // Querétaro: aplicadas equiv = (60+40)/2 + 75 + 25 = 150; meta = 200 + 450 = 650
  const filaQ = page.locator('#cavTbody tr', { hasText: 'Querétaro' }).first();
  await expect(filaQ).toContainText('650');
  await expect(filaQ).toContainText('150');
  await expect(filaQ).toContainText('23.1 %');
  // HENM (hospital): 50 de 160 = 31.3 %
  await expect(page.locator('#cavTbody tr', { hasText: 'HENM' })).toContainText('31.3 %');
  await expect(page.locator('#cavKpis')).toContainText('Avance');
  await expect(page.locator('#cavFuente')).toContainText('último mes con datos');
});

test('COVID Avance: por unidad al elegir un municipio y aviso cuando el SIS aún no publica', async ({ page }) => {
  await montarAvance(page, 'ADMIN', []);
  await page.evaluate(() => { _allUnidades.push({ clues: 'Q9', unidad: 'SIN META', municipio: 'QUERETARO' }); return renderCovidAvance(); });
  await expect(page.locator('#cavFuente')).toContainText('Aún no hay dosis de COVID-19 publicadas');
  await page.selectOption('#cavAmbito', 'QUERETARO');
  await expect(page.locator('#cavTituloAmbito')).toContainText('unidad');
  await expect(page.locator('#cavTbody tr', { hasText: 'UMQ UNO' })).toContainText('0.0 %');
  await expect(page.locator('#cavTbody tr', { hasText: 'Q9' })).toContainText('sin meta');   // unidad aún sin meta
  await expect(page.locator('#cavRubros tr')).toHaveCount(6);
});

test('COVID Avance (municipal): solo ofrece sus municipios, no la Jurisdicción', async ({ page }) => {
  await montarAvance(page, 'MUNICIPAL', []);
  await page.evaluate(() => renderCovidAvance());
  expect(await page.locator('#cavAmbito option').allTextContents()).toEqual(['Querétaro']);
});

test('COVID Avance (municipal): un solo municipio sin selector de ámbito, solo sus unidades y su total', async ({ page }) => {
  const sis = [
    { clues: 'Q1', variable_sis: 'VCV16', dosis: 75, ult: '2026-11-01' },
    { clues: 'Q2', variable_sis: 'VCV38', dosis: 20, ult: '2026-11-01' }, { clues: 'Q2', variable_sis: 'VCV39', dosis: 20, ult: '2026-11-01' }
  ];
  await montarAvance(page, 'MUNICIPAL', sis);
  await page.evaluate(() => renderCovidAvance());
  await expect(page.locator('#cavAmbito')).toBeHidden();                 // un solo municipio: no se ofrece elegir
  await expect(page.locator('#cavAmbitoLbl')).toBeHidden();
  await expect(page.locator('#cavTituloAmbito')).toContainText('unidad');
  // Q1: aplicadas equiv 75 de 400 (50+150+10+15 + 100) ; Q2: (20+20)/2 = 20 de 400
  await expect(page.locator('#cavTbody tr', { hasText: 'UMQ UNO' })).toContainText('75');
  await expect(page.locator('#cavTbody tr', { hasText: 'UMQ DOS' })).toContainText('20');
  // el total del ámbito usa la meta del municipio y suma lo de sus unidades
  const total = page.locator('#cavTbody tr.cav-total');
  await expect(total).toContainText('Querétaro');
  await expect(total).toContainText('95');
  expect(await page.locator('#cavRubros tr').count()).toBe(6);
  // el SIS se pide con el mismo rango y el servidor ya filtra por municipio
  const llamada = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'getcovid_avance'));
  expect(llamada[1].desde).toBe('2026-10-03');
});

// ─── COVID-19 · Control de Frascos en modo MUNICIPAL ───
async function montarMunicipalCovid(page) {
  await montar(page, 'MUNICIPAL');
  await page.evaluate(() => {
    _vacuna = 'COVID'; _marcaCovid = 'MODERNA';
    _covidMetasArray = [
      { clues: null, municipio: 'QUERETARO', metas: { c1: 3000, c2: 3000, c3: 1000, c4: 0, c5: 0, c6: 0 } },
      { clues: 'Q1', municipio: 'QUERETARO', metas: { c1: 2000, c2: 2000, c3: 600 } },     // equiv 2,600 · adulta 600
      { clues: 'Q2', municipio: 'QUERETARO', metas: { c1: 1000, c2: 1000, c3: 300 } },     // equiv 1,300 · adulta 300
      { clues: 'Q3', municipio: 'QUERETARO', metas: { c3: 100 } }                          // equiv 100 · adulta 100
    ];
    _covidRemesasAll = [
      { marca: 'MODERNA', numero_entrega: 1, fecha: '2026-10-05', total_frascos: 40, asignacion: { QUERETARO: 40 }, manual: [] },
      { marca: 'PFIZER', numero_entrega: 1, fecha: '2026-10-05', total_frascos: 5, asignacion: { QUERETARO: 5 }, manual: [] }
    ];
    _covidFrascosAll = [];
    _covidLotesAll = [{ marca: 'MODERNA', numero_entrega: 1, clues: 'Q1', lote: 'GAZ00031', caducidad: '2027-06-30', cantidad: 26 }];
    renderFrascosDistribution();
  });
}

test('COVID municipal: reparte los frascos de la marca por la meta de cada unidad (con su lote) y guarda con la marca', async ({ page }) => {
  await montarMunicipalCovid(page);
  const v = (c) => page.locator(`#batch_frascos_${c}`).inputValue();
  // Moderna 40 frascos por meta equivalente 2,600 : 1,300 : 100 → 26 / 13 / 1
  expect([await v('Q1'), await v('Q2'), await v('Q3')]).toEqual(['26', '13', '1']);
  await expect(page.locator('#kpiDosis')).toContainText('200 dosis');                 // 40 frascos x 5 dosis
  // Antes de teclear ya se ve cuántos frascos le caben a cada unidad y su meta en frascos de las dos marcas
  await expect(page.locator('#mr_tope_Q1')).toContainText('520');                     // 2,600 dosis / 5
  await expect(page.locator('#mr_tope_Q1')).toContainText('Moderna 520');
  await expect(page.locator('#mr_tope_Q1')).toContainText('Pfizer 100');               // meta adulta 600 / 6
  await expect(page.locator('#frascosEstadoSticky')).toContainText('Reparto completo');
  await expect(page.locator('#frascosBatchTbody tr', { hasText: 'UMQ UNO' })).toContainText('GAZ00031');   // lote real de Moderna
  await expect(page.locator('#frascosJurisPanel')).toBeHidden();                      // jerarquía: el reparto jurisdiccional no es del municipal

  await page.click('#btnSaveFrascoEntrega');
  const g = await page.evaluate(() => window.__llamadas.find((l) => l[0] === 'guardarcovid_reparto'));
  expect(g[1].marca).toBe('MODERNA');
  expect(g[1].municipio).toBe('QUERETARO');
  expect(g[1].rows.reduce((a, r) => a + r.cantidad_frascos, 0)).toBe(40);
  expect(await page.evaluate(() => window.__llamadas.some((l) => l[0] === 'guardarinfluenza_reparto'))).toBe(false);
});

test('COVID municipal: Pfizer solo llega a unidades con meta adulta y el tope descuenta lo que ya tiene de la otra marca', async ({ page }) => {
  await montarMunicipalCovid(page);
  // Q3 ya recibió 10 frascos de Pfizer (60 dosis de su meta de 100): a Moderna solo le caben ceil((100-60)/5) = 8
  const topes = await page.evaluate(() => {
    _covidFrascosAll = [{ marca: 'PFIZER', clues: 'Q3', municipio: 'QUERETARO', numero_entrega: 1, cantidad_frascos: 10 }];
    _muniRepartoState.numero = null;
    renderFrascosDistribution();
    return frascoItemsMunicipal('QUERETARO').map((i) => [i.id, i.tope]);
  });
  expect(topes).toEqual([['Q1', 520], ['Q2', 260], ['Q3', 8]]);
  await expect(page.locator('#frascosBatchTbody tr', { hasText: 'UMQ TRES' })).toContainText('Pfizer: 10');   // lo de la otra marca se ve

  // Pfizer: meta adulta 600 / 300 / 100 → topes 100 / 50 / 17 frascos (ceil de dosis/6), sin sobrepasar la adulta
  const pf = await page.evaluate(() => {
    _covidFrascosAll = [];
    _marcaCovid = 'PFIZER'; _muniRepartoState.numero = null;
    renderFrascosDistribution();
    return frascoItemsMunicipal('QUERETARO').map((i) => [i.id, i.meta, i.tope]);
  });
  expect(pf).toEqual([['Q1', 600, 100], ['Q2', 300, 50], ['Q3', 100, 17]]);
  await expect(page.locator('#kpiDosis')).toContainText('30 dosis');                  // 5 frascos x 6 dosis
});

test('COVID municipal: no deja repartir más de lo que le cabe a una unidad (aunque el total cuadre)', async ({ page }) => {
  await montarMunicipalCovid(page);
  await page.evaluate(() => { window.__toasts = []; window.__llamadas = []; });
  // Q3 solo admite 20 frascos de Moderna (meta 100 dosis / 5): se le ponen 25 y se compensa en Q1 y Q2
  await page.fill('#batch_frascos_Q3', '25');
  await page.fill('#batch_frascos_Q1', '8');
  await page.fill('#batch_frascos_Q2', '7');
  await expect(page.locator('#frascosEstadoSticky')).toHaveAttribute('data-estado', 'ok');   // el total cuadra...
  await page.click('#btnSaveFrascoEntrega');
  expect(await page.evaluate(() => window.__llamadas.some((l) => l[0] === 'guardarcovid_reparto'))).toBe(false);
  expect(await page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '')).toContain('rebasa la meta');
});

test('COVID frascos: la marca se elige con un control grande y accesible, y el estado del reparto queda fijo al desplazarse', async ({ page }) => {
  await montarMunicipalCovid(page);
  await page.evaluate(() => { window.renderActiveAdminSection = () => renderFrascosDistribution(); });   // lo que hace el panel real
  const barra = page.locator('#frascosMarcaBar');
  await expect(barra).toBeVisible();
  await expect(barra).toHaveAttribute('role', 'radiogroup');
  await expect(page.locator('.marca-btn[data-marca="MODERNA"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.marca-btn[data-marca="MODERNA"]')).toContainText('5 dosis por frasco');
  await expect(page.locator('.marca-btn[data-marca="PFIZER"]')).toContainText('6 dosis por frasco');
  // se cambia con el clic y con las flechas
  await page.click('.marca-btn[data-marca="PFIZER"]');
  await expect(page.locator('.marca-btn[data-marca="PFIZER"]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => _marcaCovid)).toBe('PFIZER');
  await page.focus('.marca-btn[data-marca="PFIZER"]');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => _marcaCovid)).toBe('MODERNA');
  // la barra de estado es fija (sticky) y dice si faltan o sobran frascos
  const pos = await page.evaluate(() => getComputedStyle(document.getElementById('frascosEstadoSticky')).position);
  expect(pos).toBe('sticky');
  await page.fill('#batch_frascos_Q1', '30');
  await expect(page.locator('#frascosEstadoSticky')).toContainText('Te pasaste por 4 frascos');
  await expect(page.locator('#frascosEstadoSticky')).toHaveAttribute('data-estado', 'excede');
  await page.fill('#batch_frascos_Q1', '20');
  await expect(page.locator('#frascosEstadoSticky')).toContainText('Faltan 6 frascos por repartir');
});
