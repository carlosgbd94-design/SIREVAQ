// Resiliencia de la página ante servidor lento/caído y consumo con la persona ausente (se probó contra el comportamiento real
// de index.html: fetch con tope, pausa de sondeos por inactividad y salida del canal de presencia).
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

async function abrir(page, { clock = false } = {}) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  if (clock) await page.clock.install();
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.supabase && typeof window.supabase.from === 'function' && typeof canRunRealtime === 'function', null, { timeout: 20000 });
  return errores;
}

test('una lectura que el servidor deja colgada se corta (ya no deja la pantalla esperando para siempre)', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page, { clock: true });
  // El servidor nunca contesta: la petición queda abierta indefinidamente
  await page.route('**/rest/v1/notificaciones**', () => { /* sin respuesta a propósito */ });
  await page.evaluate(() => {
    window.__r = null;
    window.supabase.from('notificaciones').select('id').limit(1).then((r) => { window.__r = { error: !!r.error, msg: String((r.error && r.error.message) || '') }; });
  });
  // El tope es de 25 s por intento y supabase-js reintenta con espera creciente: se avanza el reloj hasta que termine
  for (let i = 0; i < 12; i++) {
    await page.clock.fastForward(30000);
    if (await page.evaluate(() => window.__r !== null)) break;
  }
  const r = await page.evaluate(() => window.__r);
  expect(r, 'la petición debía terminar con error en vez de colgarse').not.toBeNull();
  expect(r.error).toBe(true);
});

test('con el servidor devolviendo 503 en todo, la pantalla de acceso sigue usable y sin errores no controlados', async ({ page }) => {
  const errores = await abrir(page);
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Service Unavailable"}' }));
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15000 });
  expect(errores, errores.join('\n')).toEqual([]);
});

test('sin interacción por 10 min los sondeos se pausan y al volver a interactuar se reanudan', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate(() => {
    TOKEN = 'token-de-prueba'; USER = { rol: 'UNIDAD', usuario: 'X' };
    const activo = canRunRealtime();
    LAST_ACTIVITY_AT = Date.now() - 11 * 60 * 1000;
    const pausado = !canRunRealtime();
    // markActivity intenta refrescar la bandeja al volver: se neutraliza para no salir a la red
    window.loadNotifications = async () => null;
    window.dispatchEvent(new Event('pointerdown'));
    return { activo, pausado, reanudado: canRunRealtime() };
  });
  expect(r).toEqual({ activo: true, pausado: true, reanudado: true });
});

test('la presencia (usuarios en línea) abandona el canal al quedar inactivo y se reincorpora al volver', async ({ page }) => {
  await abrir(page, { clock: true });
  const salio = await page.evaluate(() => {
    TOKEN = 'token-de-prueba'; USER = { rol: 'UNIDAD', usuario: 'X' };
    window.__quitados = 0;
    window.supabase.removeChannel = () => { window.__quitados++; };
    PRESENCE_CHANNEL = { fake: true };
    LAST_ACTIVITY_AT = Date.now() - 11 * 60 * 1000;
    return true;
  });
  expect(salio).toBe(true);
  await page.clock.fastForward(61000); // corre el temporizador de 60 s que revisa la presencia
  const estado = await page.evaluate(() => ({ quitados: window.__quitados, canal: PRESENCE_CHANNEL }));
  expect(estado.quitados).toBe(1);
  expect(estado.canal).toBeNull();
  // Al volver a interactuar se reincorpora (initPresenceRealtime se sustituye por un espía)
  const volvio = await page.evaluate(() => {
    window.__init = 0; window.initPresenceRealtime = () => { window.__init++; };
    window.loadNotifications = async () => null;
    window.dispatchEvent(new Event('pointerdown'));
    return window.__init;
  });
  expect(volvio).toBe(1);
});
