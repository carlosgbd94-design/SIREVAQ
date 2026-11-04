// Comodín de sustitución (SR/SRP, DPT/TdPa): (1) mientras hay algo por corregir es un panel ámbar y abierto, y el botón
// «Aplicar N dosis» lo registra de inmediato (sin Guardar ni cambiar de pestaña); (2) cuando todo ya cuadra se vuelve una línea
// verde, cerrada, que solo confirma lo aplicado (antes seguía en amarillo y parecía que aún había errores).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

test.use({ viewport: { width: 1400, height: 1000 } });

test('Comodín: se registra al instante y el panel pasa de ámbar a verde cerrado', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);

  await page.evaluate(async () => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'Maria Lopez Ruiz' };
    F.tables.sis_variables.length = 0;
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: {}, ajustes: {}, updated_at: '2026-09-01T00:00:00Z' });
    window.__aj = null;
    const fila = (etiqueta, paloteo, ajP, aplicado, ajA) => ({ municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta, grupo: etiqueta, claves: [etiqueta], paloteo, ajuste_paloteo: ajP, aplicado, ajuste_aplicado: ajA, coincide: paloteo === aplicado });
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n !== 'sis06p_comparativo') return t.rpc(n, a);
        // 10 SRP aplicadas y anotadas como SR: sin comodín no cuadran; con el comodín sí
        return { error: null, data: window.__aj && window.__aj.SRP_COMO_SR
          ? [fila('SR', 10, 0, 10, 10), fila('SRP', 10, 10, 10, 0)]
          : [fila('SR', 10, 0, 0, 0), fila('SRP', 0, 0, 10, 0)] };
      };
      if (p === 'from') return (tabla) => (tabla === 'sis06p_capturas'
        ? { update: (v) => ({ eq: async () => { window.__aj = v.ajustes; return { error: null }; } }), select: (...x) => t.from(tabla).select(...x) }
        : t.from(tabla));
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  });

  const panel = page.locator('#sisbComodin');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-estado', 'pendiente');
  await expect(panel).toHaveJSProperty('open', true);

  await panel.locator('[data-comodin-usar="SRP_COMO_SR"]').click();

  await expect(panel).toHaveAttribute('data-estado', 'ok');
  await expect(panel).toHaveJSProperty('open', false);
  await expect(panel).toContainText('Comodín aplicado');
  expect(await page.evaluate(() => window.__aj)).toEqual({ SRP_COMO_SR: 10 });
  const borde = await panel.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(borde).not.toBe('rgb(245, 158, 11)');
  await expect(page.locator('#sis06pConciliacion')).toContainText('coinciden');
});
