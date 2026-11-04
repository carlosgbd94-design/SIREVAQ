// «Correcciones sin aceptar»: si el municipal tecleó una cifra de 4 a 5 y luego de 5 a 4, la celda quedó igual y no hay nada que
// aceptar. Solo se listan (y se cuentan) las celdas con un cambio real, y cada una se acepta con todos sus movimientos.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
test.use({ viewport: { width: 1400, height: 1000 } });

test('Correcciones netas: lo que quedó igual no se lista y cada celda junta sus movimientos', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
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
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'ENVIADO', valores: {}, ajustes: {}, updated_at: '2026-09-01T00:00:00Z' });
    const c = (id, fila, ant, nue, t) => ({ id, mes, anio, tipo: 'EDICION_MUNICIPAL', fila_excel: fila, subconteo: 'total', detalle: null, valor_anterior: ant, valor_nuevo: nue, usuario: 'Alma', creado_en: `2026-11-03T15:4${t}:00Z`, reconocido_por_unidad: false });
    const filas = [c('a1', 12, '4', '5', 1), c('a2', 12, '5', '4', 2), c('a3', 12, '4', '5', 3), c('a4', 12, '5', '4', 4), c('b1', 13, '2', '3', 5), c('b2', 13, '3', '6', 6)];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'from') return (tabla) => (tabla === 'sis06p_correcciones'
        ? { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: filas, error: null }) }) }) }) }) }
        : t.from(tabla));
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  });

  const items = page.locator('#sis06pListaCambiosPendientes > div');
  await expect(items).toHaveCount(1);                       // la celda 12 quedó igual (4→5→4→5→4): no cuenta
  await expect(items.first()).toContainText('2');           // la 13 pasó de 2 a 6
  await expect(items.first()).toContainText('6');
  const ids = await items.first().locator('[data-aceptar-correccion]').getAttribute('data-aceptar-correccion');
  expect(ids).toBe('b1,b2');                                // aceptar la celda acepta todos sus movimientos
});
