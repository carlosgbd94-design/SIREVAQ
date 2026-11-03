// Temporada invernal > Reportes por semana con la vacuna COVID-19: la supervisión corrige el reporte semanal de una
// unidad (Moderna y Pfizer por separado), firmado, con las mismas reglas de meta que la captura de la unidad.
const { test, expect } = require('@playwright/test');

const CAMP = 'Campaña Influenza 2026-2027';
const HOY = '2026-11-20';
const SEMANAS = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13'];
const unidades = [
  { clues: 'QTSSA000001', unidad: 'Q UNIDAD 1', municipio: 'QUERETARO', activo: 'SI' },
  { clues: 'QTSSA000002', unidad: 'Q UNIDAD 2', municipio: 'QUERETARO', activo: 'SI' }
];
const covMetas = [{ anio_campana: CAMP, municipio: 'QUERETARO', clues: 'QTSSA000001', metas: { c3: 40, c4: 100 } }];
const covCaps = SEMANAS.map(f => ({ anio_campana: CAMP, clues: 'QTSSA000001', unidad: 'Q UNIDAD 1', municipio: 'QUERETARO', fecha: f, valores: { MODERNA: { c4: 6 }, PFIZER: { c3: 2 } }, capturado_por: 'UNIDAD1', editado_por: 'UNIDAD', sin_movimiento: false }));

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
    return json(200, db[nombre] || []);
  };
}

// El panel está detrás del login en esta prueba: se escribe por script (no hace falta que sea visible).
const poner = (page, sel, v) => page.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);

test.use({ viewport: { width: 1400, height: 1000 } });

test('Reportes por semana con COVID-19: la supervisión corrige Moderna/Pfizer, firma y se respeta la meta', async ({ page }) => {
  test.setTimeout(60000);
  const db = { campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-02', fecha_fin: '2027-04-30', activo: true }], unidades, covid_metas: covMetas, covid_capturas: covCaps };
  await page.route(/\.supabase\.co\//, servidor(db));
  await page.clock.setFixedTime(new Date(HOY + 'T12:00:00'));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate(async ([metas, caps, unis]) => {
    USER = { rol: 'MUNICIPAL', usuario: 'muni', nombre: 'Muni', municipio: 'QUERETARO', municipiosAllowed: ['QUERETARO'] };
    TOKEN = 'token-prueba';
    await loadCampaignConfig();
    _vacuna = 'COVID';
    _covidMetasArray = metas; _covidCapturasAll = caps; _allUnidades = unis;
    window.__guardados = [];
    AppService.runCapture = async ({ action }) => action();
    AppService.call = async (nombre, payload) => { if (nombre === 'savecovid_captura') window.__guardados.push(payload); return { ok: true, data: [] }; };
    window.loadCovidAdminData = async () => {};
    window.volverAlListadoValidacion = () => {};   // el listado necesita el selector de semana, que no es lo que se prueba aquí
    document.getElementById('validationReportContent').classList.remove('hidden');
    renderValidacionEdicionGridCovid('QTSSA000001', '2026-11-06');
  }, [covMetas, covCaps, unidades]);

  // Pfizer solo adultos: no hay casilla de 6 a 59 meses para Pfizer; el rubro sin meta queda bloqueado
  await expect(page.locator('#val_input_cov_MODERNA_c3')).toHaveValue('');
  await expect(page.locator('#val_input_cov_PFIZER_c3')).toHaveValue('2');
  await expect(page.locator('#val_input_cov_PFIZER_c1')).toHaveCount(0);
  await expect(page.locator('#val_input_cov_MODERNA_c5')).toBeDisabled();

  // Pasarse de la meta (8 de otras semanas + 40) lo impide; sin firma tampoco guarda
  await poner(page, '#val_input_cov_PFIZER_c3', '40');
  await page.evaluate(() => saveValidationReportCovid('QTSSA000001', '2026-11-06'));
  await expect(page.locator('#validationFormError')).toContainText('firmado');
  await expect(page.locator('#validationFormError')).toContainText('supera la meta');
  expect(await page.evaluate(() => window.__guardados.length)).toBe(0);

  // Corrección válida con firma
  await poner(page, '#val_input_cov_PFIZER_c3', '5');
  await poner(page, '#validationNombreResponsable', 'Ana Pérez');
  await page.evaluate(() => saveValidationReportCovid('QTSSA000001', '2026-11-06'));
  const g = await page.evaluate(() => window.__guardados);
  expect(g.length).toBe(1);
  expect(g[0].valores.PFIZER.c3).toBe(5);
  expect(g[0].valores.MODERNA.c4).toBe(6);
  expect(g[0].editado_por).toBe('MUNICIPAL');
  expect(g[0].firmado_por).toBe('Ana Pérez');
  expect(g[0].sin_movimiento).toBe(false);
});

test('La pestaña Reportes por semana sigue visible al elegir COVID-19 (Config de campaña no)', async ({ page }) => {
  await page.route(/\.supabase\.co\//, servidor({}));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof temporadaAplicarVacuna === 'function', null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    _vacuna = 'COVID'; temporadaAplicarVacuna();
    const val = document.getElementById('subtabInfluenzaValidacion');
    const cfg = document.getElementById('subtabInfluenzaConfig');
    return { val: val.classList.contains('tinv-oculta'), cfg: cfg.classList.contains('tinv-oculta') };
  });
  expect(r).toEqual({ val: false, cfg: true });
});

test('La meta de COVID-19 de un hospital sale de su destino (HENM), la de una unidad de su renglón propio', async ({ page }) => {
  await page.route(/\.supabase\.co\//, servidor({}));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof covidMetasDeUnidad === 'function', null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    _covidMetasArray = [
      { municipio: 'HENM', clues: null, metas: { c4: 100 } },
      { municipio: 'QUERETARO', clues: 'QTSSA000001', metas: { c3: 40 } }
    ];
    return { hospital: covidMetasDeUnidad('QTSSA001740'), unidad: covidMetasDeUnidad('QTSSA000001'), nada: covidMetasDeUnidad('QTSSA999999') };
  });
  expect(r).toEqual({ hospital: { c4: 100 }, unidad: { c3: 40 }, nada: {} });
});
