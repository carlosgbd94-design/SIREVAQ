// Panel de usuarios (ADMIN): varias cuentas por unidad sin interferirse, mover CLUES/municipio sin borrar,
// y diálogo accesible. Sin sesión real: se carga index.html, se llena la lista de usuarios a mano y se
// intercepta apiCall para ver QUÉ se enviaría al servidor (las Edge Functions no se llaman).
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

// El contenedor trae la variante de Tailwind [&.show]:..., así que /show/ siempre coincidiría: se exige la clase suelta
const MOSTRADO = /(^|\s)show(\s|$)/;

const USUARIOS = [
  { id: 'id-a', usuario: 'QTSSA000830_SANTA_BARBARA', email: 'a@x.com', nombre: 'Ana Pérez', rol: 'UNIDAD', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI' },
  // Segunda cuenta en la MISMA unidad: otro id, otro correo (el ID interno solo difiere por el sufijo)
  { id: 'id-b', usuario: 'QTSSA000830_SANTA_BARBARA_2', email: 'b@x.com', nombre: null, rol: 'UNIDAD', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI', must_change: true },
  { id: 'id-m', usuario: 'STEFANIA', email: 'm@x.com', nombre: null, rol: 'MUNICIPAL', clues: 'QTSSA012154', unidad: 'OFICINAS', municipio: 'CORREGIDORA,HUIMILPAN', activo: 'SI' },
  { id: 'id-j', usuario: 'JURIS', email: 'j@x.com', nombre: null, rol: 'JURISDICCIONAL', clues: 'QTSSA012154', unidad: 'OFICINAS', municipio: 'NHG,HENM', activo: 'SI' },
  { id: 'id-s', usuario: 'SUSPENDIDO', email: 's@x.com', nombre: null, rol: 'UNIDAD', clues: 'QTSSA000842', unidad: 'Los Ángeles', municipio: 'CORREGIDORA', activo: 'NO' }
];

async function preparar(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openEditUserModal === 'function' && typeof window.openCreateUserModal === 'function', null, { timeout: 20000 });
  await page.evaluate((usuarios) => {
    window.__llamadas = [];
    window.apiCall = async (payload) => { window.__llamadas.push(JSON.parse(JSON.stringify(payload))); return { ok: true, message: 'ok' }; };
    NOTIF_UNIT_CATALOG = [
      { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA' },
      { clues: 'QTSSA000842', unidad: 'Los Ángeles', municipio: 'CORREGIDORA' },
      { clues: 'QTSSA001315', unidad: 'La Cañada', municipio: 'MARQUES' }
    ];
    USERS_CACHE = usuarios;
    // Sin sesión: se quita la pantalla de login y se hace visible la rama del DOM donde vive la lista
    const login = document.getElementById('loginWrapper');
    if (login) login.style.display = 'none';
    for (let el = document.getElementById('usersTbody'); el && el !== document.body; el = el.parentElement) {
      el.classList.remove('hidden', 'hide');
      if (getComputedStyle(el).display === 'none') el.style.display = 'block';
      if (getComputedStyle(el).visibility === 'hidden') el.style.visibility = 'visible';
    }
    renderUsersRows(USERS_CACHE);
    window.refreshUsers = async () => {};
  }, USUARIOS);
  return errores;
}

test('Usuarios: cada acción opera por id de cuenta y se avisa cuántas cuentas comparten unidad', async ({ page }) => {
  const errores = await preparar(page);
  const filas = page.locator('#usersTbody .sgb-body-row');
  await expect(filas).toHaveCount(5);

  // Todas las acciones llevan el id (nunca solo el texto del usuario) y un nombre accesible
  const botones = page.locator('#usersTbody .sgb-icon-btn');
  expect(await botones.count()).toBe(20);
  for (let i = 0; i < 20; i++) {
    const b = botones.nth(i);
    await expect(b).toHaveAttribute('data-id', /^id-/);
    expect((await b.getAttribute('aria-label')) || '').not.toBe('');
  }

  // Dos cuentas en la misma CLUES: las dos filas lo dicen; la de otra unidad no
  await expect(filas.nth(0)).toContainText('2 cuentas en esta unidad');
  await expect(filas.nth(1)).toContainText('2 cuentas en esta unidad');
  await expect(filas.nth(4)).not.toContainText('cuentas en esta unidad');
  // Cuenta sin contraseña todavía y cuenta suspendida se distinguen
  await expect(filas.nth(1)).toContainText('Pendiente: crear contraseña');
  await expect(filas.nth(4)).toContainText('Suspendido');

  // Suspender a UNA cuenta manda su id (y no toca a la que comparte unidad)
  page.on('dialog', (d) => d.accept());
  await filas.nth(1).locator('[data-action="toggle"]').click();
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  const llamada = await page.evaluate(() => window.__llamadas[0]);
  expect(llamada).toMatchObject({ action: 'adminSetActive', id: 'id-b', activo: false });

  expect(errores, errores.join('\n')).toEqual([]);
});

test('Usuarios: mover una cuenta de CLUES conserva id y correo; el municipal multi-municipio no pierde los suyos', async ({ page }) => {
  await preparar(page);
  const filas = page.locator('#usersTbody .sgb-body-row');

  // UNIDAD: se abre el modal como diálogo accesible, con su aviso de cuentas hermanas
  await filas.nth(0).locator('[data-action="edit"]').click();
  const modal = page.locator('#createUserModal');
  await expect(modal).toHaveClass(MOSTRADO);
  await expect(modal).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#createUserModal [role="dialog"]')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#createUsuarioID')).toHaveValue('QTSSA000830_SANTA_BARBARA');
  await expect(page.locator('#createUsuarioID')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#createUnidadAviso')).toContainText('ya tiene 1 cuenta');
  await expect(page.locator('#createUnidadAviso')).toContainText('no modifica a las demás');

  // Mover a otra unidad del mismo municipio: cambia CLUES, no el ID ni el correo
  await page.selectOption('#createUnidad', 'Los Ángeles');
  await expect(page.locator('#createClues')).toHaveValue('QTSSA000842');
  await expect(page.locator('#createUsuarioID')).toHaveValue('QTSSA000830_SANTA_BARBARA');
  await page.click('#btnSubmitCreateUser');
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  expect(await page.evaluate(() => window.__llamadas[0])).toMatchObject({
    action: 'adminupdateuser', id: 'id-a', usuario: 'QTSSA000830_SANTA_BARBARA', email: 'a@x.com', rol: 'UNIDAD', clues: 'QTSSA000842', municipio: 'CORREGIDORA'
  });
  await expect(modal).not.toHaveClass(MOSTRADO);
  await expect(modal).toHaveAttribute('aria-hidden', 'true');

  // MUNICIPAL con 2 municipios: ambos marcados; al guardar se envían los dos
  await page.evaluate(() => { window.__llamadas.length = 0; });
  await filas.nth(2).locator('[data-action="edit"]').click();
  await expect(page.locator('#createMunicipiosGroup')).toBeVisible();
  await expect(page.locator('#createUnidadBox')).toBeHidden();
  await expect(page.locator('#createMunicipiosChips input:checked')).toHaveCount(2);
  await page.click('#createMunicipiosChips label:has(input[value="QUERETARO"])');
  await page.click('#btnSubmitCreateUser');
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  const m = await page.evaluate(() => window.__llamadas[0]);
  expect(m).toMatchObject({ id: 'id-m', rol: 'MUNICIPAL' });
  expect(m.municipio.split(',').sort()).toEqual(['CORREGIDORA', 'HUIMILPAN', 'QUERETARO']);

  // JURISDICCIONAL de los hospitales: conserva NHG,HENM y los marca
  await page.evaluate(() => { window.__llamadas.length = 0; });
  await filas.nth(3).locator('[data-action="edit"]').click();
  await expect(page.locator('#createMunicipiosChips input:checked')).toHaveCount(2);
  await page.click('#btnSubmitCreateUser');
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  const j = await page.evaluate(() => window.__llamadas[0]);
  expect(j.municipio.split(',').sort()).toEqual(['HENM', 'NHG']);
});

test('Usuarios: alta de una segunda cuenta en la misma unidad avisa y deja que el servidor ponga un ID único; Escape cierra el diálogo', async ({ page }) => {
  await preparar(page);
  await page.evaluate(() => openCreateUserModal());
  const modal = page.locator('#createUserModal');
  await expect(modal).toHaveAttribute('aria-hidden', 'false');

  await page.selectOption('#createRol', 'UNIDAD');
  await page.selectOption('#createMunicipio', 'CORREGIDORA');
  await page.selectOption('#createUnidad', 'Santa Bárbara');
  await expect(page.locator('#createClues')).toHaveValue('QTSSA000830');
  // Sugiere el mismo ID que la cuenta existente: el servidor le agrega _2, _3... (aquí solo se verifica el aviso y el envío)
  await expect(page.locator('#createUnidadAviso')).toContainText('ya tiene 2 cuentas');
  await page.fill('#createEmail', 'tercera@x.com');
  await page.click('#btnSubmitCreateUser');
  await expect.poll(() => page.evaluate(() => window.__llamadas.length)).toBe(1);
  expect(await page.evaluate(() => window.__llamadas[0])).toMatchObject({ action: 'admincreateuser', email: 'tercera@x.com', rol: 'UNIDAD', clues: 'QTSSA000830' });

  // Escape cierra y devuelve el foco
  await page.evaluate(() => openCreateUserModal());
  await expect(modal).toHaveClass(MOSTRADO);
  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(MOSTRADO);
  await expect(modal).toHaveAttribute('aria-hidden', 'true');

  // Validaciones del lado del cliente: correo mal escrito no sale
  await page.evaluate(() => { window.__llamadas.length = 0; openCreateUserModal(); });
  await page.selectOption('#createRol', 'CARAVANAS');
  await page.fill('#createEmail', 'no-es-correo');
  await page.click('#btnSubmitCreateUser');
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);
});
