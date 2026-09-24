// Pruebas de feedback_autoreply.js y perfil_cuenta.js.
// No necesitan sesión real: cargan los scripts en una página vacía con un
// cliente de Supabase simulado, así que corren sin credenciales ni red.
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Margen extra: estas pruebas pueden correr en paralelo con otras que cargan páginas completas.
expect.configure({ timeout: 10000 });

async function pagina(page) {
  // Origen real (localhost) para que exista localStorage; la página es una hoja en blanco.
  await page.route('**/__blank', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('/__blank');
  await page.addScriptTag({ path: path.join(ROOT, 'feedback_autoreply.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'perfil_cuenta.js') });
}

test.describe('Respuestas automáticas de feedback', () => {
  const casos = [
    ['necesito mi usuario y contraseña por favor', 'password_forgot'],
    ['Se me olvidó la contraseña', 'password_forgot'],
    ['no recuerdo mi usuario', 'password_forgot'],
    ['No puedo iniciar sesión', 'login_fail'],
    ['no me llegó el correo de recuperación', 'mail_not_arriving'],
    ['la pagina se queda cargando', 'refresh_tip'],
    ['necesito crear un usuario para el nuevo enfermero', 'account_request'],
    // No deben disparar nada
    ['No recuerdo la clave del biologico BCG en el catalogo', null],
    ['Al guardar el reporte sale error en el lote 123', null],
    ['al cambiar mi contraseña me marca error', null],
  ];
  for (const [texto, esperada] of casos) {
    test(`"${texto}" -> ${esperada || 'sin respuesta'}`, async ({ page }) => {
      await pagina(page);
      const id = await page.evaluate((t) => {
        const m = window.FeedbackAutoReply.match(t, {});
        return m ? m.rule.id : null;
      }, texto);
      expect(id).toBe(esperada);
    });
  }

  test('una propuesta (por su texto) no se detiene aunque mencione la contraseña', async ({ page }) => {
    await pagina(page);
    const m = await page.evaluate(() => window.FeedbackAutoReply.match('Sugiero agregar una opción para recuperar la contraseña olvidada', {}));
    expect(m).toBeNull();
  });

  test('con el tipo "Sugerencia" preseleccionado (default real del formulario) SÍ responde', async ({ page }) => {
    await pagina(page);
    const id = await page.evaluate(() => {
      const m = window.FeedbackAutoReply.match('se me olvidó mi contraseña', { type: 'Sugerencia' });
      return m ? m.rule.id : null;
    });
    expect(id).toBe('password_forgot');
  });

  test('detiene el envío hasta elegir "enviar de todos modos"', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      document.body.innerHTML = `<form id="f"><div class="feedback-input-group"><select id="t"><option value="Sugerencia">Sugerencia</option><option value="Pregunta">Pregunta</option></select>
        <textarea id="m"></textarea></div><button type="submit">Enviar</button></form>`;
      window.__enviados = 0;
      const f = document.getElementById('f');
      window.FeedbackAutoReply.attach({ textarea: document.getElementById('m'), form: f, typeSelect: document.getElementById('t') });
      f.addEventListener('submit', (e) => { e.preventDefault(); window.__enviados++; });
    });
    await page.fill('#m', 'Se me olvidó mi contraseña');
    await expect(page.locator('.fb-autoreply')).toBeVisible();
    await expect(page.locator('.fb-autoreply')).toContainText('¿Olvidaste tu contraseña?');

    await page.click('button[type=submit]');
    expect(await page.evaluate(() => window.__enviados)).toBe(0);

    await page.click('.fb-ar-skip');
    expect(await page.evaluate(() => window.__enviados)).toBe(1);
  });

  test('"Esto resolvió mi duda" cierra sin enviar nada', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      document.body.innerHTML = `<form id="f"><div><textarea id="m"></textarea></div><button type="submit">Enviar</button></form>`;
      window.__enviados = 0; window.__resuelto = 0;
      const f = document.getElementById('f');
      window.FeedbackAutoReply.attach({ textarea: document.getElementById('m'), form: f, onResolved: () => { window.__resuelto++; } });
      f.addEventListener('submit', (e) => { e.preventDefault(); window.__enviados++; });
    });
    await page.fill('#m', 'no me llega el correo para recuperar mi contraseña');
    await page.click('.fb-ar-ok');
    expect(await page.evaluate(() => [window.__enviados, window.__resuelto])).toEqual([0, 1]);
  });
});

test.describe('Perfil > Cuenta', () => {
  test('normaliza teléfonos', async ({ page }) => {
    await pagina(page);
    const r = await page.evaluate(() => [
      window.PerfilCuenta._normalizePhone('+52 (442) 550-7146'),
      window.PerfilCuenta._normalizePhone('442 550 7146'),
      window.PerfilCuenta._formatPhone('4425507146'),
    ]);
    expect(r).toEqual(['4425507146', '4425507146', '442 550 7146']);
  });

  test('guarda nombre y teléfono con la RPC', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      window.__rpc = null; window.__guardado = null;
      const client = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        rpc: async (fn, args) => { window.__rpc = { fn, args }; return { data: { nombre: args.p_nombre, telefono: args.p_telefono }, error: null }; },
      };
      window.PerfilCuenta.init({ getClient: () => client, getUser: () => ({ uid: 'u1', email: 'a@b.com' }), onContactSaved: (c) => { window.__guardado = c; } });
      window.PerfilCuenta.openContacto();
    });
    const shadow = page.locator('#perfilCuentaHost');
    await shadow.locator('#pcNombre').fill('  María   López ');
    await shadow.locator('#pcTelefono').fill('+52 442 550 7146');
    await shadow.getByRole('button', { name: 'Guardar' }).click();
    await expect.poll(() => page.evaluate(() => window.__rpc)).toEqual({ fn: 'actualizar_mi_contacto', args: { p_nombre: 'María López', p_telefono: '4425507146' } });
    expect(await page.evaluate(() => window.__guardado)).toEqual({ nombre: 'María López', telefono: '4425507146' });
  });

  test('rechaza un teléfono incompleto sin llamar al servidor', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      window.__llamadas = 0;
      const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }), rpc: async () => { window.__llamadas++; return { data: {}, error: null }; } };
      window.PerfilCuenta.init({ getClient: () => client, getUser: () => ({ uid: 'u1', email: 'a@b.com' }) });
      window.PerfilCuenta.openContacto();
    });
    const shadow = page.locator('#perfilCuentaHost');
    await shadow.locator('#pcTelefono').fill('4425');
    await shadow.getByRole('button', { name: 'Guardar' }).click();
    await expect(shadow.getByRole('alert')).toContainText('10 dígitos');
    expect(await page.evaluate(() => window.__llamadas)).toBe(0);
  });

  test('cambio de contraseña: envía código, lo verifica en el servidor y luego actualiza', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      localStorage.removeItem('JS1_last_reset_request');
      window.__orden = [];
      const client = { auth: {
        resetPasswordForEmail: async (email) => { window.__orden.push(['reset', email]); return { error: null }; },
        verifyOtp: async (a) => { window.__orden.push(['verify', a]); return { error: a.token === '123456' ? null : { message: 'Token has expired or is invalid' } }; },
        updateUser: async (a) => { window.__orden.push(['update', a.password]); return { error: null }; },
      } };
      window.PerfilCuenta.init({ getClient: () => client, getUser: () => ({ uid: 'u1', email: 'unidad@salud.gob.mx' }), onPasswordChanged: async () => { window.__orden.push(['hook']); } });
      window.PerfilCuenta.openCambiarPassword();
    });
    const s = page.locator('#perfilCuentaHost');
    await expect(s.getByText('uni***ad@salud.gob.mx', { exact: false })).toBeVisible();
    await s.getByRole('button', { name: 'Enviar código' }).click();

    // Código equivocado: no debe llegar a updateUser
    await s.locator('#pcCode').fill('000000');
    await s.locator('#pcPass1').fill('Clave2026x');
    await s.locator('#pcPass2').fill('Clave2026x');
    await s.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(s.getByRole('alert')).toContainText('incorrecto');
    expect((await page.evaluate(() => window.__orden)).some((o) => o[0] === 'update')).toBe(false);

    // Código correcto
    await s.locator('#pcCode').fill('123456');
    await s.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(s.getByText('se actualizó correctamente')).toBeVisible();
    const orden = (await page.evaluate(() => window.__orden)).map((o) => o[0]);
    expect(orden).toEqual(['reset', 'verify', 'verify', 'update', 'hook']);
  });

  test('valida contraseñas débiles o distintas antes de tocar el servidor', async ({ page }) => {
    await pagina(page);
    await page.evaluate(() => {
      localStorage.setItem('JS1_last_reset_request', String(Date.now())); // entra directo al paso del código
      window.__auth = 0;
      const client = { auth: { verifyOtp: async () => { window.__auth++; return { error: null }; }, updateUser: async () => ({ error: null }), resetPasswordForEmail: async () => ({ error: null }) } };
      window.PerfilCuenta.init({ getClient: () => client, getUser: () => ({ uid: 'u1', email: 'a@b.com' }) });
      window.PerfilCuenta.openCambiarPassword();
    });
    const s = page.locator('#perfilCuentaHost');
    await s.locator('#pcCode').fill('123456');
    for (const [p1, p2, texto] of [['corta1', 'corta1', 'al menos 8'], ['soloLetrasAqui', 'soloLetrasAqui', 'letras y números'], ['Clave2026x', 'Otra2026xx', 'no coincide']]) {
      await s.locator('#pcPass1').fill(p1);
      await s.locator('#pcPass2').fill(p2);
      await s.getByRole('button', { name: 'Cambiar contraseña' }).click();
      await expect(s.getByRole('alert')).toContainText(texto);
    }
    expect(await page.evaluate(() => window.__auth)).toBe(0);
  });
});
