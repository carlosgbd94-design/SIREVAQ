// Corregir reportes (Influenza): el editor de un reporte semanal muestra TODOS los rubros, resume lo que se escribe
// y no pierde cifras al guardar.
const { test, expect } = require('@playwright/test');

const CAMP = 'Campaña Influenza 2026-2027';
const CLUES = 'QTSSA000001';
const unidades = [{ clues: CLUES, unidad: 'Q UNIDAD 1', municipio: 'QUERETARO', activo: 'SI' }];

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

const poner = (page, sel, v) => page.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);

test.use({ viewport: { width: 1400, height: 1000 } });

test('Editor de reporte (Influenza): se ven los 46 rubros, el resumen se actualiza y no se pierden cifras al guardar', async ({ page }) => {
  test.setTimeout(60000);
  await page.route(/\.supabase\.co\//, servidor({ campanas: [{ id: 'c1', nombre: CAMP, fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02', activo: true }], unidades }));
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00'));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof supabaseRequest === 'function' && typeof renderValidacionEdicionGrid === 'function', null, { timeout: 20000 });

  const info = await page.evaluate(async (unis) => {
    USER = { rol: 'MUNICIPAL', usuario: 'muni', nombre: 'Muni Prueba', municipio: 'QUERETARO', municipiosAllowed: ['QUERETARO'] };
    TOKEN = 'token-prueba';
    await loadCampaignConfig();
    _vacuna = 'INFLUENZA';
    _allUnidades = unis;
    const [a, b, c] = INFLUENZA_RUBROS;
    // Meta solo en el primer rubro; el reporte ya trae dosis en otro rubro SIN meta (debe verse y conservarse al guardar)
    const conDatos = INFLUENZA_RUBROS.find(r => `${r.categoria} - ${r.grupo}` !== `${a.categoria} - ${a.grupo}`);
    _adminMetasArray = [{ clues: unis[0].clues, municipio: 'QUERETARO', metas: { [a.id]: 100 } }];
    _adminCapturasArray = [{ clues: unis[0].clues, unidad: unis[0].unidad, municipio: 'QUERETARO', fecha: '2026-11-13', valores: { [a.id]: 10, [conDatos.id]: 4 }, capturado_por: 'UNIDAD1', editado_por: 'UNIDAD' }];
    window.__ids = { meta: a.id, sinMeta: conDatos.id };
    window.__guardados = [];
    AppService.runCapture = async ({ action }) => action();
    AppService.call = async (nombre, payload) => { if (nombre === 'saveinfluenza_captura') window.__guardados.push(payload); return { ok: true, data: [] }; };
    window.loadInfluenzaAdminData = async () => {};
    window.volverAlListadoValidacion = () => {};
    document.getElementById('validationReportContent').classList.remove('hidden');
    renderValidacionEdicionGrid(unis[0].clues, '2026-11-13');
    return { total: INFLUENZA_RUBROS.length };
  }, unidades);

  const c = page.locator('#validationCardsContainer');
  // Todos los rubros están a la vista: renglones de tabla + los plegados («sin meta»)
  const reng = await c.locator('tbody tr').count();
  const plegados = await c.locator('.vl-sinmeta .vl-chip').count();
  expect(reng + plegados).toBe(info.total);
  await expect(c.locator('.vl-sinmeta')).toContainText('sin meta');
  // El grupo sin meta que ya traía dosis se muestra completo (no plegado) con su cifra
  await expect(page.locator(`#val_input_inf_${await page.evaluate(() => window.__ids.sinMeta)}`)).toHaveValue('4');

  // Resumen: arranca con lo capturado y sube al teclear
  const franja = c.locator('.vl-franja');
  await expect(franja).toContainText('14');          // 10 + 4
  await poner(page, `#val_input_inf_${await page.evaluate(() => window.__ids.meta)}`, '30');
  await expect(franja).toContainText('34');           // 30 + 4
  await expect(franja).toContainText('100');          // meta de la unidad

  // Guardar: la cifra del rubro sin meta NO se pierde
  await poner(page, '#validationNombreResponsable', 'Ana Pérez');
  await page.evaluate(() => saveValidationReport('QTSSA000001', '2026-11-13'));
  const g = await page.evaluate(() => window.__guardados);
  expect(g.length).toBe(1);
  expect(g[0].valores[await page.evaluate(() => window.__ids.meta)]).toBe(30);
  expect(g[0].valores[await page.evaluate(() => window.__ids.sinMeta)]).toBe(4);
  expect(g[0].firmado_por).toBe('Ana Pérez');
});
