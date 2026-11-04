// «Recibido contra requisición»: cuando un lote no coincide, el aviso dice qué unidad lo capturó, cuánto y la causa probable
// (antes solo mostraba biológico, lote y dos cantidades, y había que buscar unidad por unidad).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

test.use({ viewport: { width: 1400, height: 1000 } });

test('Recibido vs requisición: cada lote que no coincide dice quién lo capturó y por qué no cuadra', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);

  const html = await page.evaluate(async () => {
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => (n === 'sis06p_recibido_vs_requisicion'
        ? { error: null, data: [
          { municipio: 'QUERETARO', biologico: 'SRP \nTriple Viral', numero_lote: '0134N117B', caducidad_requisicion: null, caducidad_unidades: '2027-06-30', requisicion: 0, unidades: 20, coincide: false,
            detalle_unidades: [{ clues: 'QTSSA000001', unidad: 'C.S. Alfa', requisicion: 0, recibido: 20 }], requisicion_otros_lotes: [{ lote: '0134N117A', cantidad: 20 }], unidades_otros_lotes: null },
          { municipio: 'QUERETARO', biologico: 'BCG', numero_lote: 'B1', caducidad_requisicion: null, caducidad_unidades: null, requisicion: 30, unidades: 20, coincide: false,
            detalle_unidades: [{ clues: 'QTSSA000002', unidad: 'C.S. Beta', requisicion: 30, recibido: 20 }], requisicion_otros_lotes: null, unidades_otros_lotes: null }
        ] }
        : t.rpc(n, a));
      return t[p];
    } });
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    const api = await SIS06PConcentradoMunicipal.render(cont, 'QUERETARO', 10, 2026, { sinBoton: true });
    return api.htmlRecibido();
  });
  expect(html).toContain('0134N117B');
  expect(html).toContain('C.S. Alfa');
  expect(html).toContain('QTSSA000001');
  expect(html).toContain('requisición 0 · capturó 20');
  expect(html).toContain('La requisición no reparte este lote');
  expect(html).toContain('0134N117A (20)');
  expect(html).toContain('faltan 10 frascos por capturar');
});

test('Existencia negativa: muestra la cuenta del municipio y la tabla de unidades con la posible causante marcada', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);

  const html = await page.evaluate(() => htmlDiscrepancias([{
    biologico: 'Hepatitis "A"', numero_lote: 'Y004995', categoria: 'NORMAL', tipo: 'FINAL_NEGATIVA', severidad: 'ERROR',
    mensaje: 'Quedó en -1 frascos: las unidades declararon 13 de existencia anterior y el municipio trae 12 (1 de más).',
    mun_anterior: 12, mun_recibido: 0, mun_aplicadas: 13, mun_desechadas: 0, mun_final: -1,
    detalle: [
      { unidad: 'EMILIANO ZAPATA', clues: 'QTSSA012602', anterior: 13, cierre_mes_pasado: 0, recibido: 0, aplicado: 13, sospechosa: true },
      { unidad: 'OTRA UNIDAD', clues: 'QTSSA000002', anterior: 5, cierre_mes_pasado: 5, recibido: 0, aplicado: 2, sospechosa: false }
    ]
  }]));
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'cajaDisc'; d.innerHTML = h; document.body.appendChild(d); }, html);
  const caja = page.locator('#cajaDisc');
  await expect(caja.locator('.disc-cuenta')).toContainText('Anterior12');
  await expect(caja.locator('.disc-cuenta .res')).toContainText('-1');
  await expect(caja.locator('tr.sosp')).toHaveCount(1);
  await expect(caja.locator('tr.sosp')).toContainText('EMILIANO ZAPATA');
  await expect(caja.locator('tr.sosp')).toContainText('Posible error');
  await expect(caja.locator('.disc-tabla tbody tr')).toHaveCount(2);
});
