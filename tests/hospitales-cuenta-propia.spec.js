// Hospitales (NHG, HENM) con cuenta propia: desde septiembre de 2026 su Movimiento sale de su propia cuenta y la fila JS1-
// que capturaba la jurisdicción ya no se captura (mismo criterio que biovac_cuenta_para_jurisdiccion en la base).
// Los municipios siguen igual: se capturan por municipio hasta septiembre y se arman de sus unidades desde octubre.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

test('movimientoEsDerivado: hospitales desde septiembre, municipios desde octubre', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    estado.perfil = { id: 'u1', rol: 'JURISDICCIONAL', usuario: 'juris' };
    estado.inicioPorUnidad = '2026-10-01';
    estado.inicioHospitales = '2026-09-01';
    estado.unidades = [
      { id: 'ps-n', clues: 'JS1-NHG', municipio: 'NHG' }, { id: 'n-1', clues: 'QTSSA002901', municipio: 'NHG' },
      { id: 'ps-q', clues: 'JS1-QUERETARO', municipio: 'QUERETARO' }, { id: 'q-1', clues: 'QTSSA001793', municipio: 'QUERETARO' },
      { id: 'ps-x', clues: 'JS1-HUIMILPAN', municipio: 'HUIMILPAN' }          // sin unidad real: conserva su fila
    ];
    estado.unidadesClues = estado.unidades.filter((u) => !u.clues.startsWith('JS1-'));
    const f = (id, anio, mes) => movimientoEsDerivado(id, anio, mes);
    return {
      nhgAgosto: f('ps-n', 2026, 8), nhgSeptiembre: f('ps-n', 2026, 9), nhgOctubre: f('ps-n', 2026, 10),
      qroSeptiembre: f('ps-q', 2026, 9), qroOctubre: f('ps-q', 2026, 10),
      huimilpanOctubre: f('ps-x', 2026, 10),
      unidadReal: f('n-1', 2026, 9)
    };
  });
  expect(r.nhgAgosto).toBe(false);          // hasta agosto la jurisdicción captura al hospital
  expect(r.nhgSeptiembre).toBe(true);       // desde septiembre se arma de la cuenta del hospital
  expect(r.nhgOctubre).toBe(true);
  expect(r.qroSeptiembre).toBe(false);      // los municipios no cambian: septiembre sigue siendo por municipio
  expect(r.qroOctubre).toBe(false);         // los municipios ya no son "derivados": se arman con las unidades y se editan
  expect(r.huimilpanOctubre).toBe(false);   // sin unidad real conserva su fila
  expect(r.unidadReal).toBe(false);         // una unidad real nunca es "derivada"
});
