// Estado de la carga a indicadores (registros_sis) que ve el municipal/jurisdicción: si al cerrar el mes NO se pudo cargar,
// se dice por qué (antes quedaba callado y los hospitales nunca se cargaban sin que nadie lo notara).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrirBiovac(page) {
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(800);
}

const pintar = (page, { estadoPub, ultimo }) => page.evaluate(async ({ estadoPub, ultimo }) => {
  estado.db = { rpc: async (n) => {
    if (n === 'sis_estado_publicacion') return { data: estadoPub, error: null };
    if (n === 'sis_ultimo_intento_publicacion') return { data: ultimo, error: null };
    return { data: [], error: null };
  } };
  const div = document.createElement('div');
  await window.SIS06PDashboard.pintarEstadoPublicacion(div, 'NHG', 10, 2026);
  return div.textContent;
}, { estadoPub, ultimo });

test('Indicadores: el estado dice por qué NO se cargó al cerrar el mes, y no contradice una carga posterior', async ({ page }) => {
  test.setTimeout(60000);
  await abrirBiovac(page);

  // nunca se cargó y el último intento falló: se muestra el motivo
  let t = await pintar(page, { estadoPub: [], ultimo: [{ resultado: 'BLOQUEADO', detalle: 'Rol UNIDAD no puede publicar el SIS.', creado_en: '2026-11-06T19:00:00Z' }] });
  expect(t).toContain('NO se pudo cargar a indicadores');
  expect(t).toContain('Rol UNIDAD no puede publicar el SIS.');

  // pendiente (faltan unidades por validar) también se avisa
  t = await pintar(page, { estadoPub: [], ultimo: [{ resultado: 'PENDIENTE', detalle: 'Faltan por validar: QTSSA000001.', creado_en: '2026-11-06T19:00:00Z' }] });
  expect(t).toContain('Faltan por validar: QTSSA000001.');

  // ya se cargó DESPUÉS del intento fallido: manda la publicación
  t = await pintar(page, {
    estadoPub: [{ publicado_en: '2026-11-07T10:00:00Z', publicado_por: 'ALMA (auto)', filas: 422, desactualizada: false }],
    ultimo: [{ resultado: 'BLOQUEADO', detalle: 'viejo', creado_en: '2026-11-06T19:00:00Z' }]
  });
  expect(t).toContain('Publicado el');
  expect(t).toContain('422 filas');
  expect(t).not.toContain('NO se pudo');

  // sin intentos ni publicación: se explica cuándo se carga
  t = await pintar(page, { estadoPub: [], ultimo: [] });
  expect(t).toContain('cuando se cierra el mes');
});
