// Integración sobre las páginas reales (index, mobile, biovac) sin iniciar sesión: comprueba que cargan
// sin errores de consola, que el Feedback (con respuestas automáticas) sale por la Edge Function y no
// directo a Discord, y que la recuperación de contraseña usa recover-access. Las llamadas a las
// Edge Functions van simuladas (no envía correos ni mensajes reales); el chequeo de
// usuarios_legacy sí consulta la base real con la llave pública.
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

function vigilar(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  return errores;
}

test('ESCRITORIO index.html: carga, feedback con respuesta automática y recuperación', async ({ page }) => {
  const errores = vigilar(page);
  const envios = []; const recover = [];
  await page.route('**/functions/v1/send-feedback', async (r) => { envios.push({ h: r.request().headers(), body: r.request().postData() || '' }); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.route('**/functions/v1/recover-access', async (r) => { recover.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"code":"NO_EMAIL","message":"El usuario no tiene un correo registrado o no existe"}' }); });
  let discord = 0; await page.route('**/discord.com/**', (r) => { discord++; r.abort(); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.FeedbackAutoReply && window.PerfilCuenta && typeof window.openContactoModal === 'function' && typeof window.openChangePasswordFlow === 'function', null, { timeout: 20000 });

  // Feedback: abre, escribe una duda conocida
  await page.evaluate(() => document.getElementById('btnFeedbackFAB').click());
  await page.fill('#feedbackMessage', 'Buenas tardes, se me olvidó mi usuario y contraseña');
  await expect(page.locator('.fb-autoreply')).toBeVisible();
  await expect(page.locator('.fb-autoreply')).toContainText('¿Olvidaste tu contraseña?');
  await page.click('#btnSubmitFeedback');
  expect(envios.length).toBe(0);                       // detenido
  await page.click('.fb-ar-skip');                     // "enviar de todos modos"
  await expect.poll(() => envios.length).toBe(1);
  expect(envios[0].h['apikey']).toBeTruthy();
  expect(envios[0].body).toContain('se me olvidó mi usuario');
  expect(discord).toBe(0);                             // nada directo a Discord

  // Mensaje normal: NO debe frenarse
  await page.evaluate(() => document.getElementById('btnFeedbackFAB').click());
  await page.fill('#feedbackMessage', 'El PDF de requisiciones no muestra bien el municipio en la tabla');
  await page.waitForTimeout(600);
  await expect(page.locator('.fb-autoreply')).toHaveCount(0);
  await page.click('#btnSubmitFeedback');
  await expect.poll(() => envios.length).toBe(2);

  // Recuperación: usuario (no correo) -> Edge Function con el cuerpo correcto
  await page.evaluate(() => localStorage.removeItem('JS1_last_reset_request'));
  await page.click('#btnForgotPassword');
  await page.fill('#forgotUsuario', 'zz_no_existe');
  await page.click('#btnForgotSend');
  await expect.poll(() => recover.length).toBe(1);
  expect(recover[0]).toMatchObject({ identifier: 'zz_no_existe', mode: 'recovery' });
  expect(recover[0].redirectTo).toMatch(/reset\.html$/);

  // El navegador ya no debe poder leer usuarios_legacy
  const r = await page.evaluate(async () => { const { data, error } = await window.supabase.from('usuarios_legacy').select('usuario').limit(1); return { data, err: error && error.code }; });
  expect(r.err).toBe('42501');

  expect(errores, errores.join('\n')).toEqual([]);
});

test('MÓVIL mobile.html: carga, recuperación con Edge Function', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errores = vigilar(page);
  const recover = [];
  await page.route('**/functions/v1/recover-access', async (r) => { recover.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"masked":"car***94@gmail.com"}' }); });

  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.FeedbackAutoReply && window.PerfilCuenta, null, { timeout: 20000 });
  expect(page.url()).toContain('mobile.html');
  expect(await page.evaluate(() => typeof window.openContactoModal + '/' + typeof window.openChangePasswordFlow)).toBe('function/function');

  await page.evaluate(() => localStorage.removeItem('JS1_last_reset_request'));
  await page.click('#btnForgotPasswordMobile');
  await page.fill('#forgotUsuarioMobile', 'CARLOS_BECERRA');
  await page.click('#btnForgotSendMobile');
  await expect.poll(() => recover.length).toBe(1);
  expect(recover[0]).toMatchObject({ identifier: 'CARLOS_BECERRA', mode: 'recovery' });
  expect(recover[0].redirectTo).toMatch(/reset\.html$/);

  expect(errores, errores.join('\n')).toEqual([]);
  await ctx.close();
});

test('BIOVAC biovac.html: carga y feedback con respuesta automática', async ({ page }) => {
  const errores = vigilar(page);
  const envios = [];
  await page.route('**/functions/v1/send-feedback', async (r) => { envios.push(1); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.FeedbackAutoReply, null, { timeout: 20000 });
  await page.click('#btnFeedbackFAB');
  await page.fill('#feedbackMessage', 'no me llega el correo para recuperar mi contraseña');
  await expect(page.locator('.fb-autoreply')).toBeVisible();
  await page.click('#btnSubmitFeedback');
  expect(envios.length).toBe(0);
  await page.click('.fb-ar-skip');
  await expect.poll(() => envios.length).toBe(1);
  expect(errores, errores.join('\n')).toEqual([]);
});
