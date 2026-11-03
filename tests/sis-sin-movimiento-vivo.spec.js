// SINBA-SIS: (1) «Sin movimiento este mes» (la unidad declara el cero; un SIS en ceros sin esa marca no se envía) y
// (2) el panel de validación del municipal se actualiza solo cuando una unidad envía (sin F5).
// Página real (biovac.html) con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

test.use({ viewport: { width: 1400, height: 1000 } });

// UNIDAD con su captura del mes en BORRADOR, en ceros, y el envío abierto.
async function prepararUnidad(page, { valores = {}, sinMov = false } = {}) {
  await page.evaluate(async ({ valores, sinMov }) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores, ajustes: {}, capturado_por: 'MARIA LOPEZ RUIZ', sin_movimiento: sinMov });
    window.__upserts = [];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n === 'sis06p_comparativo') return { data: [], error: null };
        if (n === 'sis06p_ventana_envio') return { data: [{ dentro_prellenado: true, dentro_envio: true, inicio_prellenado: '2026-09-23', inicio_envio: '2026-09-30', fin_envio: '2026-10-07' }], error: null };
        return t.rpc(n, a);
      };
      if (p === 'from') return (tabla) => {
        const q = t.from(tabla);
        if (tabla === 'sis06p_capturas') return new Proxy(q, { get(qt, qp) { if (qp === 'upsert') return (rec) => { window.__upserts.push(rec); return qt.upsert(rec); }; return qt[qp]; } });
        return q;
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
    document.getElementById('selUsuario').value = 'MARIA LOPEZ RUIZ';
    SIS06PBiovac.actualizarDock();
  }, { valores, sinMov });
}

test('Sin movimiento: la unidad en ceros ve el interruptor y NO se anuncia como lista para enviar', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page);
  const tarjeta = page.locator('#sisSinMovimiento');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText('¿Este mes no hubo movimiento?');
  await expect(tarjeta.locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(page.locator('#sisListoEnviar')).toBeHidden();
});

test('Sin movimiento: al enviar en ceros sin la marca, explica qué hacer y no manda nada', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page);
  await page.evaluate(() => { window.__rpcEnviar = 0; const r = estado.db; estado.db = new Proxy(r, { get(t, p) { if (p === 'rpc') return async (n, a) => { if (n === 'sis06p_enviar_para_validacion') window.__rpcEnviar++; return t.rpc(n, a); }; return t[p]; } }); });
  await page.click('#btnEnviarSIS06P');
  await expect(page.locator('#modalTitulo')).toHaveText('Tu SINBA-SIS está en ceros');
  await expect(page.locator('#modalMensaje')).toContainText('Sin movimiento este mes');
  await page.click('#modalBtnAceptar');
  expect(await page.evaluate(() => window.__rpcEnviar)).toBe(0);
});

test('Sin movimiento: marcarlo pide guardar y se guarda con sin_movimiento = true', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page);
  await page.locator('#sisSinMovimiento .sis-switch').click();
  await expect(page.locator('#sisSinMovimiento input[type="checkbox"]')).toBeChecked();
  await expect(page.locator('#sisSinMovimiento')).toContainText('SIN MOVIMIENTO');
  expect(await page.evaluate(() => SIS06PBiovac.hayCambiosSinGuardar())).toBe(true);
  await page.evaluate(() => SIS06PBiovac.save());
  const rec = await page.evaluate(() => window.__upserts[0]);
  expect(rec.sin_movimiento).toBe(true);
});

test('Sin movimiento: con la marca guardada el SIS ya está listo para enviar', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { sinMov: true });
  await expect(page.locator('#sisSinMovimiento input[type="checkbox"]')).toBeChecked();
  await expect(page.locator('#sisListoEnviar')).toBeVisible();
});

test('Sin movimiento: con dosis (aquí de Influenza) el interruptor no aplica y se guarda en falso', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    (window.__FAKE.tables.influenza_capturas = window.__FAKE.tables.influenza_capturas || []).push({ id: 'i1', clues: 'QTSSA000001', fecha: `${anio}-${String(mes).padStart(2, '0')}-15`, valores: { r1: 5 }, sin_movimiento: false });
  });
  await prepararUnidad(page, { sinMov: true });
  await expect(page.locator('#sisSinMovimiento input[type="checkbox"]')).toBeDisabled();
  await expect(page.locator('#sisSinMovimiento')).toContainText('Ya hay dosis este mes');
  await page.evaluate(() => SIS06PBiovac.save());
  const rec = await page.evaluate(() => window.__upserts[0]);
  expect(rec.sin_movimiento).toBe(false);
});

test('Municipal: la unidad que envió «Sin movimiento» lo muestra en su tarjeta', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(async () => {
    const F = window.__FAKE;
    F.tables.sis06p_capturas.find((c) => c.clues === 'QTSSA000001').sin_movimiento = true;
    await MunicipalGuiado.refrescarFilas();
    MunicipalGuiado.pintarEnvios(window.__sis06pUltimasFilas);
  });
  const tarjeta = page.locator('#munEnvios .mun-unidad[data-clues="QTSSA000001"]');
  await expect(tarjeta.locator('.mun-pill.sinmov')).toHaveText('Sin movimiento');
  await expect(page.locator('#munEnvios .mun-unidad[data-clues="QTSSA000003"] .mun-pill.sinmov')).toHaveCount(0);
});

test('Panel del municipal: cuando una unidad envía se actualiza solo (sin F5) y avisa', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.waitForSelector('#munEnvios .mun-unidad');
  const antes = await page.locator('.mun-chip[data-filtro="SIN"] b').innerText();
  expect(antes).toBe('1');
  // La unidad Beta (BORRADOR) envía su SIS
  await page.evaluate(() => {
    const f = window.__FAKE.seg.find((x) => x.clues === 'QTSSA000002');
    f.estado = 'ENVIADO'; f.enviado_en = new Date().toISOString(); f.enviado_por = 'Beto';
    document.dispatchEvent(new Event('visibilitychange'));   // volver a la pestaña dispara la revisión (Realtime hace lo mismo)
  });
  await expect(page.locator('.mun-chip[data-filtro="SIN"] b')).toHaveText('0', { timeout: 6000 });
  await expect(page.locator('.mun-chip[data-filtro="ENVIADO"] b')).toHaveText('3');
});
