// Concentrado de Avances de la Temporada invernal (Influenza y COVID-19): las cuentas por municipio y por Jurisdicción.
// No levanta toda la app: monta #secInfluenzaAvances de index.html y el bloque de influenza_module.js con datos simulados.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8');
const seccion = html.slice(
  html.indexOf('<div id="secInfluenzaAvances"'),
  html.indexOf('<!-- SECCIÓN 2'));
const bloque = modulo.slice(
  modulo.indexOf('// ─── Concentrado de Avances (Influenza y COVID-19)'),
  modulo.indexOf('function renderUnitDetail('));
const iPeso = modulo.indexOf('function metaPesoRubro');
const accesores = modulo.slice(modulo.indexOf('function esCovid()'), modulo.indexOf('}', iPeso) + 1);

const DATOS = `
  var USER = { rol: window.__ROL__ };
  var _vacuna = window.__VAC__;
  var _marcaCovid = 'MODERNA';
  var _campaignConfig = { fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' };
  var influenzaHoy = function () { return '2026-10-23'; };
  var influenzaSemanaAbre = function (f) { return f; };
  var generateCampaignWeeks = function () { return [{ semana: 42, fecha: '2026-10-16' }, { semana: 43, fecha: '2026-10-23' }, { semana: 44, fecha: '2026-10-30' }]; };
  var infMuniEtiqueta = function (m) { return String(m).toUpperCase() === 'MARQUES' ? 'EL MARQUÉS' : m; };
  var INFLUENZA_RUBROS = [{ id: 'r1' }];
  var DOSIS_POR_FRASCO = 10;
  var FRASCO_DESTINOS = [{ id: 'QUERETARO' }, { id: 'HENM', label: 'HENM', clues: 'H1', hospital: true }];
  var _adminChart = null, _adminInfluenzaTrendChart = null, _adminInfluenzaBreakdownChart = null;
  var exportConcentradoSimpleExcel = function () {}, exportConcentradoDetalladoUnidadesExcel = function () {};
  var _allUnidades = [
    { clues: 'Q1', unidad: 'UMQ UNO', municipio: 'QUERETARO' },
    { clues: 'H1', unidad: 'HENM', municipio: 'QUERETARO' },
    { clues: 'C1', unidad: 'CORREGIDORA UNO', municipio: 'CORREGIDORA' }
  ];
  var _adminMetasArray = [
    { clues: 'Q1', municipio: 'QUERETARO', metas: { r1: 1000 } },
    { clues: 'H1', municipio: 'HENM', metas: { r1: 500 } },
    { clues: 'C1', municipio: 'CORREGIDORA', metas: { r1: 400 } }
  ];
  var _adminCapturasArray = [
    { clues: 'Q1', fecha: '2026-10-16', valores: { r1: 100 } },
    { clues: 'Q1', fecha: '2026-10-23', valores: { r1: 200 } },
    { clues: 'H1', fecha: '2026-10-23', valores: { r1: 50 } },
    { clues: 'C1', fecha: '2026-10-23', valores: { r1: 40 } }
  ];
  // Los frascos de los hospitales se registran con el municipio del hospital (HENM), no el de la unidad: se cuentan por CLUES.
  var _adminFrascosArray = [
    { clues: 'Q1', municipio: 'QUERETARO', cantidad_frascos: 20 },
    { clues: 'H1', municipio: 'HENM', cantidad_frascos: 5 },
    { clues: 'C1', municipio: 'CORREGIDORA', cantidad_frascos: 10 }
  ];
  var _covidMetasArray = [
    { clues: 'Q1', municipio: 'QUERETARO', metas: { c1: 100, c3: 100 } },
    { clues: null, municipio: 'HENM', metas: { c3: 60 } }
  ];
  var _covidCapturasAll = [
    { clues: 'Q1', fecha: '2026-10-23', valores: { MODERNA: { c1: 40, c3: 30 }, PFIZER: { c3: 10 } } },
    { clues: 'H1', fecha: '2026-10-23', valores: { MODERNA: { c3: 20 }, PFIZER: {} } }
  ];
  var _covidFrascosAll = [
    { clues: 'Q1', marca: 'MODERNA', cantidad_frascos: 10 },
    { clues: 'Q1', marca: 'PFIZER', cantidad_frascos: 5 }
  ];
  var infCapturasVista = function () { return esCovid() ? _covidCapturasAll : _adminCapturasArray; };
`;

async function montar(page, rol, vac) {
  await page.goto('/reference.html');
  await page.evaluate(() => { document.body.innerHTML = ''; });
  await page.evaluate(([h, r, v]) => {
    window.__ROL__ = r; window.__VAC__ = v;
    document.body.innerHTML = h;
    document.getElementById('adminInfluenzaMuni').innerHTML = '<option value="QUERETARO">Q</option><option value="CORREGIDORA">C</option>';
    // Semanas de la campaña: del primer viernes al último
    const semanas = '<option value="2026-10-16">Sem 42</option><option value="2026-10-23">Sem 43</option><option value="2026-10-30">Sem 44</option>';
    document.getElementById('adminInfluenzaSemanaInicio').innerHTML = semanas;
    document.getElementById('adminInfluenzaSemanaFin').innerHTML = semanas;
    document.getElementById('adminInfluenzaSemanaFin').value = '2026-10-30';
  }, [seccion, rol, vac]);
  await page.addScriptTag({ path: path.join(raiz, 'covid_frascos.js') });
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ content: DATOS + accesores + bloque + '\nwindow.__render = renderAvancesAndConcentrados;' });
}

const kpis = (page) => page.locator('#muniFrascosAnalisisBox .kpiCard').allInnerTexts();
const celdas = (page, clues) => page.locator(`#adminInfluenzaMunicipalTbody tr[data-clues="${clues}"] td`).allInnerTexts();

test('Municipio de Querétaro (Influenza): suma sus unidades y deja fuera al hospital, que es un destino aparte', async ({ page }) => {
  await montar(page, 'MUNICIPAL', 'INFLUENZA');
  await page.evaluate(() => window.__render());
  const k = await kpis(page);
  expect(k[0]).toContain('30%');                  // 300 de 1,000 (sin el hospital)
  expect(k[0]).toMatch(/300 de 1,000/i);
  expect(k[2]).toContain('20');                    // los 5 frascos del hospital no cuentan aquí
  expect(k[2]).toContain('200');
  expect(k[3]).toContain('-100');                  // entregó 200 dosis y aplicó 300
  expect(await page.locator('#adminInfluenzaMunicipalTbody tr[data-clues="H1"]').count()).toBe(0);
  expect(k[3].toLowerCase()).toContain('aplicó más de lo entregado');
  const q1 = await celdas(page, 'Q1');
  expect(q1[2]).toContain('1,000');
  expect(q1[3]).toContain('300');
  expect(q1[4]).toContain('30%');
  const total = await page.locator('#adminInfluenzaMunicipalTbody tr').last().innerText();
  expect(total).toContain('1,000');
  expect(total).toContain('300');
});

test('Jurisdicción: el botón suma los municipios con subtotales y total; solo lo ven Admin y Jurisdicción', async ({ page }) => {
  await montar(page, 'ADMIN', 'INFLUENZA');
  await page.evaluate(() => window.__render());
  await expect(page.locator('#avancesAmbitoJuris')).toBeVisible();
  await page.click('#avancesAmbitoJuris button');
  const k = await kpis(page);
  expect(k[0]).toContain('20.5%');                 // 390 de 1,900
  expect(k[0]).toMatch(/390 de 1,900/i);
  expect(k[2]).toContain('35');                    // 20 + 5 + 10
  const total = await page.locator('#adminInfluenzaMunicipalTbody tr').last().innerText();
  expect(total).toContain('TOTAL JURISDICCIÓN');
  expect(total).toContain('1,900');
  const filas = await page.locator('#adminInfluenzaMunicipalTbody tr').allInnerTexts();
  expect(filas.filter((t) => t.includes('subtotal')).length).toBe(2);   // Querétaro y Corregidora
  expect(filas.filter((t) => /HENM · hospital/i.test(t)).length).toBe(1);   // el hospital va aparte, con su subtotal
  await expect(page.locator('#adminInfluenzaMuni')).toBeDisabled();

  await montar(page, 'MUNICIPAL', 'INFLUENZA');
  await page.evaluate(() => window.__render());
  await expect(page.locator('#avancesAmbitoJuris')).toBeHidden();
});

test('COVID-19: dosis equivalentes de 0.5 mL (la pediátrica cuenta la mitad), frascos por marca y meta del hospital en su destino', async ({ page }) => {
  await montar(page, 'ADMIN', 'COVID');
  await page.evaluate(() => window.__render());
  // Querétaro sin el hospital. Meta: Q1 = 100/2 + 100 = 150. Aplicadas: Q1 = 40/2 + 30 + 10 = 60.
  let k = await kpis(page);
  expect(k[0]).toContain('40%');
  expect(k[0]).toMatch(/60 de 150/i);
  // Jurisdicción: el hospital (meta en el destino = 60) va aparte; aplicó 20 → 80 de 210
  await page.click('#avancesAmbitoJuris button');
  k = await kpis(page);
  expect(k[0]).toContain('38.1%');
  expect(k[0]).toMatch(/80 de 210/i);
  // Frascos: Q1 = 10 Moderna (5 dosis) + 5 Pfizer (6 dosis) = 80 dosis eq.
  expect(k[2]).toContain('15');
  expect(k[2]).toContain('80');
  const h1 = await celdas(page, 'H1');
  expect(h1[2]).toContain('60');                   // meta del hospital tomada del destino
  await expect(page.locator('#dropdownExportInfluenzaContainer')).toBeHidden();   // los Excel de este concentrado son de Influenza
});
