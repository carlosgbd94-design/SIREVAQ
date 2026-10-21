// La sesión guardada NO debe borrarse porque falle la red al arrancar (unidades con internet inestable),
// pero sí cuando el servidor dice que la sesión ya no existe. Se prueba sobre la página real (index.html).
const { test, expect } = require('@playwright/test');

const CLAVE = 'sb-utclfqjietlxzlorxhrs-auth-token';
const sesionVencida = () => JSON.stringify({
  access_token: 'a.b.c', refresh_token: 'rt-falso', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) - 600,
  user: { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', email: 'x@test.mx', user_metadata: {} }
});

async function abrir(page, manejadorToken) {
  await page.addInitScript(([clave, valor]) => { try { localStorage.setItem(clave, valor); } catch (_) { /* sin almacenamiento */ } }, [CLAVE, sesionVencida()]);
  await page.route('**/auth/v1/token**', manejadorToken);
  await page.route('**/rest/v1/**', (r) => r.abort());
  await page.goto('/index.html', { waitUntil: 'load' });
  // whoami reintenta 3 veces (1.5 s + 3 s de espera) antes de rendirse
  await page.waitForFunction(() => typeof whoami === 'function', null, { timeout: 20000 });
}

test('sin red al arrancar: la sesión guardada se conserva', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page, (r) => r.abort('internetdisconnected'));
  await page.waitForFunction(() => window.__JS1_AUTH_NETWORK_FAIL === true, null, { timeout: 40000 });
  const clave = await page.evaluate((c) => localStorage.getItem(c), CLAVE);
  expect(clave, 'la sesión guardada debe seguir ahí').not.toBeNull();
});

test('el servidor dice "Refresh Token Not Found": la sesión se limpia (no hay nada que conservar)', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page, (r) => r.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' })
  }));
  await page.waitForFunction((c) => localStorage.getItem(c) === null, CLAVE, { timeout: 30000 });
  const flag = await page.evaluate(() => window.__JS1_AUTH_NETWORK_FAIL);
  expect(flag).not.toBe(true);
});
