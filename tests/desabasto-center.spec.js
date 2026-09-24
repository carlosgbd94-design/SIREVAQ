// Pruebas de desabasto_center.js: consolidación de alertas y modal.
// No necesitan sesión real: cargan el script en una página en blanco.
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.join(__dirname, '..');

expect.configure({ timeout: 10000 });

async function pagina(page) {
  await page.route('**/__blank', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('/__blank');
  await page.addScriptTag({ path: path.join(ROOT, 'desabasto_center.js') });
}

const ahora = () => new Date().toISOString();

test.describe('Consolidación de alertas (buildDigest)', () => {
  test('N alertas de desabasto se vuelven UNA tarjeta y el resto de notificaciones no se toca', async ({ page }) => {
    await pagina(page);
    const r = await page.evaluate((now) => {
      const mk = (id, clues, unidad, municipio, missing) => ({ id, type: 'ALERTA_DESABASTO', created_ts: now, status: 'UNREAD',
        meta_json: JSON.stringify({ clues, unidad, municipio, missing, status: 'activa' }) });
      const items = [
        mk('a1', 'C1', 'CS UNO', 'QUERETARO', ['BCG']),
        mk('a2', 'C2', 'CS DOS', 'QUERETARO', ['BCG', 'HEPATITIS B']),
        mk('a3', 'C3', 'CS TRES', 'CORREGIDORA', ['SRP']),
        { id: 'p1', type: 'INFO', created_ts: now, status: 'UNREAD', title: 'Aviso' },
      ];
      const out = window.DesabastoCenter.buildDigest(items);
      const d = out.find((x) => x.is_digest);
      return { total: out.length, ids: d.digest_ids, title: d.title, status: d.status,
        meta: JSON.parse(d.meta_json), otros: out.filter((x) => !x.is_digest).map((x) => x.id) };
    }, ahora());

    expect(r.total).toBe(2);
    expect(r.otros).toEqual(['p1']);
    expect(r.ids).toEqual(['a1', 'a2', 'a3']);
    expect(r.title).toContain('3 unidades con desabasto');
    expect(r.status).toBe('UNREAD');
    expect(r.meta.municipios_count).toBe(2);
    expect(r.meta.missing[0]).toBe('BCG'); // el más afectado va primero
  });

  test('varias alertas de la misma unidad se funden y unen sus biológicos', async ({ page }) => {
    await pagina(page);
    const meta = await page.evaluate((now) => {
      const mk = (id, missing) => ({ id, type: 'ALERTA_DESABASTO', created_ts: now, status: 'UNREAD',
        meta_json: JSON.stringify({ clues: 'C1', unidad: 'CS UNO', municipio: 'QUERETARO', missing, status: 'activa' }) });
      const d = window.DesabastoCenter.buildDigest([mk('a1', ['BCG']), mk('a2', ['SRP'])]).find((x) => x.is_digest);
      return JSON.parse(d.meta_json);
    }, ahora());
    expect(meta.units).toHaveLength(1);
    expect(meta.units[0].missing.sort()).toEqual(['BCG', 'SRP']);
    expect(meta.units[0].ids).toEqual(['a1', 'a2']);
  });

  test('con todo resuelto la tarjeta queda leída/resuelta y lo resuelto hace >7 días desaparece', async ({ page }) => {
    await pagina(page);
    const r = await page.evaluate((now) => {
      const viejo = new Date(Date.now() - 20 * 86400000).toISOString();
      const mk = (id, ts, clues) => ({ id, type: 'ALERTA_DESABASTO', created_ts: ts, status: 'UNREAD',
        meta_json: JSON.stringify({ clues, unidad: 'U ' + clues, municipio: 'M', missing: ['BCG'], status: 'resuelta' }) });
      const conReciente = window.DesabastoCenter.buildDigest([mk('r1', now, 'C1'), mk('r2', viejo, 'C2')]);
      const soloViejo = window.DesabastoCenter.buildDigest([mk('r2', viejo, 'C2')]);
      const d = conReciente.find((x) => x.is_digest);
      return { units: JSON.parse(d.meta_json).units.length, status: d.status, title: d.title, soloViejo: soloViejo.length };
    }, ahora());
    expect(r.units).toBe(1);
    expect(r.status).toBe('READ'); // nada activo que atender => no cuenta como no leída
    expect(r.title).toBe('Desabasto resuelto');
    expect(r.soloViejo).toBe(0);
  });

  test('meta_json ya parseado (objeto) también se entiende', async ({ page }) => {
    await pagina(page);
    const n = await page.evaluate((now) => {
      const out = window.DesabastoCenter.buildDigest([{ id: 'o1', type: 'ALERTA_DESABASTO', created_ts: now, status: 'READ',
        meta_json: { clues: 'C1', unidad: 'CS', municipio: 'M', missing: ['BCG'], status: 'activa' } }]);
      return out.find((x) => x.is_digest).status;
    }, ahora());
    expect(n).toBe('READ');
  });
});

test.describe('Modal del Centro de Desabasto', () => {
  const unidades = [
    { clues: 'C1', unidad: 'CS UNO', municipio: 'QUERETARO', missing: ['BCG', 'HEPATITIS B'], status: 'activa', ids: ['a1'], created_ts: ahora(), unread: true },
    { clues: 'C2', unidad: 'CS DOS', municipio: 'QUERETARO', missing: ['BCG'], status: 'activa', ids: ['a2'], created_ts: ahora(), unread: false },
    { clues: 'C3', unidad: 'CS TRES', municipio: 'CORREGIDORA', missing: ['SRP'], status: 'activa', ids: ['a3'], created_ts: ahora(), unread: false },
    { clues: 'C4', unidad: 'CS CUATRO', municipio: 'CORREGIDORA', missing: ['BCG'], status: 'resuelta', ids: [], created_ts: ahora(), unread: false },
  ];

  // Abre el modal con datos y acciones simuladas; expone lo que el modal le pidió a main.js.
  async function abrir(page, datos = unidades) {
    await page.evaluate((u) => {
      window.__u = JSON.parse(JSON.stringify(u));
      window.__calls = { resolve: [], markRead: 0, toast: [] };
      window.DesabastoCenter.open({
        getUnits: () => window.__u,
        markRead: async () => { window.__calls.markRead++; },
        toast: (m, ok = true) => window.__calls.toast.push([m, ok]),
        resolve: async (ids) => {
          window.__calls.resolve.push(ids);
          window.__u.forEach((x) => { if (x.ids.some((i) => ids.includes(i))) { x.status = 'resuelta'; x.ids = []; } });
        },
      });
    }, datos);
  }
  const $ = (page, sel) => page.locator(`#desabastoCenterHost ${sel}`);

  test('abre mostrando solo las activas agrupadas por municipio y marca como leído', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await expect($(page, '.sub')).toContainText('3 unidades con desabasto activo · 2 municipios');
    await expect($(page, '.row')).toHaveCount(3); // la resuelta queda fuera de "Activas"
    await expect($(page, '.muni')).toHaveCount(2);
    expect(await page.evaluate(() => window.__calls.markRead)).toBe(1);
  });

  test('chip de biológico y buscador filtran; el chip muestra a cuántas unidades afecta', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await expect($(page, '.chip[data-bio="BCG"]')).toContainText('2');
    await $(page, '.chip[data-bio="BCG"]').click();
    await expect($(page, '.row')).toHaveCount(2);
    await $(page, '.chip[data-bio="BCG"]').click(); // segundo clic quita el filtro
    await expect($(page, '.row')).toHaveCount(3);

    await $(page, 'input').fill('corregidora');
    await expect($(page, '.row')).toHaveCount(1);
    await $(page, 'input').fill('zzz');
    await expect($(page, '.empty')).toContainText('Ninguna unidad coincide');
  });

  test('pestaña Todas incluye las resueltas', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await $(page, '[data-filter="todas"]').click();
    await expect($(page, '.row')).toHaveCount(4);
    await expect($(page, '.row.done .tag')).toContainText('Verificada');
  });

  test('verificar una unidad pide resolver solo sus ids y la saca de Activas', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await $(page, '[data-resolve="C1"]').click();
    await expect($(page, '.row')).toHaveCount(2);
    expect(await page.evaluate(() => window.__calls.resolve)).toEqual([['a1']]);
  });

  test('"Verificar N unidades" exige confirmar y respeta el filtro activo', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await $(page, '.chip[data-bio="BCG"]').click(); // C1 y C2
    const boton = $(page, '[data-act="verify"]');
    await expect(boton).toContainText('Verificar 2 unidades');
    await boton.click();
    await expect(boton).toContainText('Confirmar (2)');
    expect(await page.evaluate(() => window.__calls.resolve)).toEqual([]); // el primer clic no resuelve nada
    await boton.click();
    await expect($(page, '.row')).toHaveCount(0);
    expect(await page.evaluate(() => window.__calls.resolve)).toEqual([['a1', 'a2']]);
    // C3 (no visible por el filtro) quedó intacta
    expect(await page.evaluate(() => window.__u.find((u) => u.clues === 'C3').status)).toBe('activa');
  });

  test('sin desabasto activo abre directo en Todas y oculta el botón de verificar', async ({ page }) => {
    await pagina(page);
    await abrir(page, unidades.filter((u) => u.status === 'resuelta'));
    await expect($(page, '.sub')).toContainText('Sin desabasto activo');
    await expect($(page, '.row')).toHaveCount(1);
    await expect($(page, '[data-act="verify"]')).toBeHidden();
  });

  test('un nombre con HTML se muestra como texto, no se interpreta', async ({ page }) => {
    await pagina(page);
    await abrir(page, [{ ...unidades[0], unidad: '<img src=x onerror="window.__xss=1">' }]);
    await expect($(page, '.nm')).toContainText('<img');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('Escape y el botón Cerrar lo cierran', async ({ page }) => {
    await pagina(page);
    await abrir(page);
    await page.keyboard.press('Escape');
    await expect($(page, '.ov')).toHaveCount(0);
    await abrir(page);
    await $(page, '.x2').click();
    await expect($(page, '.ov')).toHaveCount(0);
  });
});
