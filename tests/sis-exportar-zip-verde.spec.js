// SINBA-SIS: (1) «Exportar» de la UNIDAD es un solo botón con Excel o PDF (bloqueado hasta que el municipal valide, sin botón PDF aparte);
// (2) el municipal exporta el SIS masivo en ZIP desde Entrega, con pantalla de progreso; (3) tarjetas verdes (validada / por validar).
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

async function prepararUnidad(page, estadoSis) {
  await page.evaluate(async (estadoSis) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: estadoSis, valores: {}, ajustes: {}, capturado_por: 'MARIA LOPEZ RUIZ', sin_movimiento: true });
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n === 'sis06p_comparativo') return { data: [], error: null };
        if (n === 'sis06p_ventana_envio') return { data: [{ dentro_prellenado: true, dentro_envio: true, inicio_prellenado: '2026-09-23', inicio_envio: '2026-09-30', fin_envio: '2026-10-07' }], error: null };
        return t.rpc(n, a);
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  }, estadoSis);
}

test('Unidad: «Exportar» bloqueado hasta que el municipal valide', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, 'ENVIADO');
  await expect(page.locator('#btnExportarSISCompleto')).toBeDisabled();
  await page.locator('#btnExportarSISCompleto').click({ force: true });
  await expect(page.locator('#menuExportarSIS.abierto')).toHaveCount(0);
});

test('Unidad: con el SIS validado, «Exportar» abre un menú con Excel o PDF (un solo botón)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, 'VALIDADO');
  await page.evaluate(() => {
    window.__llamadas = [];
    SIS06PBiovac.exportarSISOficialCompleto = () => window.__llamadas.push('excel');
    document.getElementById('btnVerPdf').addEventListener('click', () => window.__llamadas.push('pdf'));
  });
  await expect(page.locator('#btnExportarSISCompleto')).toBeEnabled();
  await page.locator('#btnExportarSISCompleto').click();
  const menu = page.locator('#menuExportarSIS');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-exp]')).toHaveCount(2);
  await expect(menu).toContainText('Excel oficial');
  await expect(menu).toContainText('PDF');
  await menu.locator('[data-exp="pdf"]').click();
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => window.__llamadas)).toEqual(['pdf']);
});

test('Unidad: el PDF ya no es un botón aparte en la barra del Movimiento', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, 'ENVIADO');
  await page.evaluate(() => {
    document.getElementById('btnSeccionMovimiento').classList.add('activo');
    estado.movimiento = { id: 'm1' };
    document.getElementById('filaBotonesCabecera').style.display = 'flex';
    document.getElementById('btnVerPdf').style.display = 'inline-flex';
    document.getElementById('btnVerPdf').disabled = false;
    sincronizarDockMovimientoExtras();
  });
  await expect(page.locator('#btnVerPdfDock')).toBeHidden();
});

test('Municipal: tarjetas verdes (validada franca, por validar tenue)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.waitForSelector('#munEnvios .mun-unidad.completo');
  const fondo = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await fondo('#munEnvios .mun-unidad.completo')).toBe('rgb(236, 253, 243)');
  expect(await fondo('#munEnvios .mun-unidad.parcial')).toBe('rgb(246, 253, 248)');
});

test('Municipal: «Exportar SIS masiva (ZIP)» en Entrega, solo con todo validado, con las unidades validadas', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.waitForSelector('#munEnvios .mun-unidad');
  await page.evaluate(async () => { await MunicipalGuiado.irAPaso(4); });
  const btn = page.locator('#munDescargarZip');
  await expect(btn).toBeVisible();
  await expect(btn).toContainText('Exportar SIS masiva');
  await expect(btn).toBeDisabled();            // faltan unidades por validar
  await page.evaluate(async () => {
    window.__FAKE.validarTodas();
    window.__zip = null;
    SIS06PBiovac.exportarZipMunicipio = async (filas, muni, mes, anio) => { window.__zip = { n: filas.length, todasValidadas: filas.every((f) => f.estado === 'VALIDADO'), muni, mes, anio }; };
    await MunicipalGuiado.refrescarFilas();
    await MunicipalGuiado.irAPaso(4);
  });
  await expect(page.locator('#munDescargarZip')).toBeEnabled();
  await page.locator('#munDescargarZip').click();
  await expect.poll(() => page.evaluate(() => window.__zip)).not.toBeNull();
  const z = await page.evaluate(() => window.__zip);
  expect(z.n).toBe(4);
  expect(z.todasValidadas).toBe(true);
});

test('Pantalla de progreso: barra con porcentaje y aviso de que es un archivo pesado', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => mostrarCargando('Generando Excel 3 de 12: C.S. Alfa', { pct: 41.6, nota: 'Es un archivo pesado: puede tardar unos minutos.' }));
  await expect(page.locator('#loadingOverlay')).toBeVisible();
  await expect(page.locator('#loadingTexto')).toContainText('Generando Excel 3 de 12');
  await expect(page.locator('#loadingPct')).toHaveText('42 %');
  await expect(page.locator('#loadingBarraCaja')).toHaveAttribute('aria-valuenow', '42');
  await expect(page.locator('#loadingNota')).toContainText('archivo pesado');
  expect(await page.locator('#loadingBarra').evaluate((e) => e.style.width)).toBe('42%');
  await page.evaluate(() => ocultarCargando());
  await expect(page.locator('#loadingOverlay')).toBeHidden();
  // Un aviso de carga normal no muestra barra
  await page.evaluate(() => mostrarCargando('Guardando…'));
  await expect(page.locator('#loadingProgreso')).toBeHidden();
});
