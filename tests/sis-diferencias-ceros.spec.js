// SINBA-SIS de la unidad: (1) la casilla del paloteo no deja un cero pegado al número ("5" no puede quedar "05") y
// (2) cuando el paloteo y el Movimiento no coinciden el aviso es permanente, rojo y con la lista, y el botón Enviar
// explica en qué en lugar de quedarse apagado.
// Página real (biovac.html) con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

// UNIDAD QTSSA000001 con su captura del mes en BORRADOR; `valores` = lo ya guardado en el paloteo.
async function prepararUnidad(page, valores) {
  await page.evaluate((vals) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push(
      { id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', clave_afro: null, clave_indigena: null, clave_migrante: null, orden: 1, activo: true },
      { id: 2, fila_excel: 12, biologico: 'BCG', grupo_poblacional: '29 días a 11 meses', dosis: 'ÚNICA', edad: null, clave_general: 'VBC02', clave_afro: null, clave_indigena: null, clave_migrante: null, orden: 2, activo: true }
    );
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: vals, ajustes: {}, updated_at: '2026-09-01T00:00:00Z' });
  }, valores);
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('06-P: un 0 guardado se ve vacío y teclear 5 sobre él no deja "05"', async ({ page }) => {
  await abrir(page);
  await prepararUnidad(page, { 11: { total: 0, afro: 0, indigena: 0, migrante: 0 }, 12: { total: 7 } });
  await page.evaluate(() => { document.getElementById('panelSIS06P').style.display = 'block'; });
  await page.evaluate(async () => { await SIS06PBiovac.init(); });

  // el 0 guardado no se pinta como valor (el "0" gris es solo el placeholder) y lo capturado sí
  await expect(page.locator('#sisb_11_total')).toHaveValue('');
  await expect(page.locator('#sisb_12_total')).toHaveValue('7');

  // teclear un 5 deja exactamente "5"
  await page.locator('#sisb_11_total').focus();
  await page.keyboard.type('5');
  await expect(page.locator('#sisb_11_total')).toHaveValue('5');

  // un 0 que sí esté escrito se vacía al entrar a la casilla
  await page.evaluate(() => { document.getElementById('sisb_11_afro').value = '0'; });
  await page.locator('#sisb_11_afro').focus();
  expect(await page.evaluate(() => document.getElementById('sisb_11_afro').value)).toBe('');
  await page.keyboard.type('3');
  await expect(page.locator('#sisb_11_afro')).toHaveValue('3');

  // y si de todos modos llega un valor con cero a la izquierda ("05"), se limpia de inmediato
  await page.evaluate(() => {
    const el = document.getElementById('sisb_12_total');
    el.value = '05';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#sisb_12_total')).toHaveValue('5');

  // al entrar a una casilla con número se selecciona: lo tecleado lo reemplaza
  await page.locator('#sisb_12_total').focus();
  await page.keyboard.type('9');
  await expect(page.locator('#sisb_12_total')).toHaveValue('9');
});

test('Diferencias paloteo vs Movimiento: aviso rojo permanente con la lista y Enviar explica en qué', async ({ page }) => {
  await abrir(page);
  await prepararUnidad(page, { 11: { total: 5 } });
  await page.evaluate(async () => {
    // el servidor responde que SRP y Hexavalente no cuadran
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => (n === 'sis06p_comparativo'
        ? { data: [
          { municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta: 'SRP', paloteo: 10, aplicado: 10, coincide: true },
          { municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta: 'HEXAVALENTE', paloteo: 48, aplicado: 51, coincide: false },
          { municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta: 'TD', paloteo: 5, aplicado: 0, coincide: false }
        ], error: null }
        : t.rpc(n, a));
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  });

  // Aviso permanente: dice que NO se envía, quién no recibe nada y en qué biológicos
  const aviso = page.locator('#sisAlertaDiferencias');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('NO se puede enviar');
  await expect(aviso).toContainText('el municipal no recibe nada');
  await expect(aviso).toContainText('HEXAVALENTE: paloteo 48 · Movimiento 51 (-3)');
  await expect(aviso).toContainText('TD: paloteo 5 · Movimiento 0 (+5)');
  await expect(aviso).not.toContainText('SRP');          // lo que sí coincide no se lista
  await expect(aviso.locator('button[data-dif-ir="paloteo"]')).toBeVisible();
  await expect(aviso.locator('button[data-dif-ir="mov"]')).toBeVisible();

  // La tarjeta de la 06-P también es roja y el dock lo dice
  await expect(page.locator('#sis06pConciliacion')).toContainText('2 biológico(s) NO coinciden');
  const colorTarjeta = await page.evaluate(() => getComputedStyle(document.getElementById('sis06pConciliacion')).borderTopColor);
  expect(colorTarjeta).toBe('rgb(248, 113, 113)');
  await expect(page.locator('#dockEstadoDetalle')).toContainText('2 biológicos no coinciden');

  // Enviar no está apagado: se ve en rojo y al pulsarlo explica que NO se envió y en qué
  await page.evaluate(() => { const b = document.getElementById('btnEnviarSIS06P'); b.style.display = 'inline-flex'; });
  await page.evaluate(() => { document.getElementById('btnEnviarSIS06P').disabled = false; });
  await page.evaluate(() => {
    window.__rpcEnviar = 0;
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => { if (n === 'sis06p_enviar_para_validacion') window.__rpcEnviar++; return t.rpc(n, a); };
      return t[p];
    } });
  });
  await page.locator('#btnEnviarSIS06P').click();
  await expect(page.locator('#modalOverlay')).toHaveClass(/abierto/);
  await expect(page.locator('#modalTitulo')).toHaveText('Tu SINBA-SIS NO se envió');
  await expect(page.locator('#modalDetalle')).toContainText('HEXAVALENTE: paloteo 48 · Movimiento 51');
  expect(await page.evaluate(() => window.__rpcEnviar)).toBe(0);                 // ni siquiera intenta enviar
  await page.locator('#modalBtnAceptar').click();
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/abierto/);

  // Cuando coinciden el aviso desaparece
  await page.evaluate(async () => {
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => (n === 'sis06p_comparativo'
        ? { data: [{ municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta: 'SRP', paloteo: 10, aplicado: 10, coincide: true }], error: null }
        : t.rpc(n, a));
      return t[p];
    } });
    await SIS06PBiovac.init();
  });
  await expect(page.locator('#sisAlertaDiferencias')).toBeHidden();
});
