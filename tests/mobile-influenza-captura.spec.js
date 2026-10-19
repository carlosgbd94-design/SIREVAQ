// Captura semanal de Influenza para la unidad en móvil: semanas, meta en vivo, sin movimiento, reglas y guardado.
// Mismo PostgREST simulado que mobile-dock-oneui.spec.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;

const srcDock = fs.readFileSync(path.join(__dirname, 'mobile-dock-oneui.spec.js'), 'utf8');
const creaServidor = new Function(srcDock.slice(srcDock.indexOf('function creaServidor'), srcDock.indexOf('const idx =')) + '\nreturn creaServidor;')();

const CAMP = 'Campaña Influenza 2026-2027';

function estado({ rol = 'UNIDAD', metas = { r1: 100, r2: 12, r6: 40, r11: 20 }, capturas, covid = false } = {}) {
  return {
    db: {
      perfiles: [{ id: 'u1', usuario: 'ana', nombre: 'Ana Perez', rol, clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' }],
      campanas: [{ id: 1, nombre: CAMP, activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2027-04-30' }],
      influenza_metas: metas ? [{ clues: 'QTSSA000001', municipio: 'QUERETARO', anio_campana: CAMP, metas }] : [],
      influenza_capturas: capturas || [
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-09', anio_campana: CAMP, valores: { r1: 80 }, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [], folio: 'INF-20261009-AAAA1111' }
      ]
    },
    rpc: {}
  };
}

function estadoCovid() {
  const st = estado();
  st.db.covid_metas = [{ clues: 'QTSSA000001', municipio: 'QUERETARO', anio_campana: CAMP, metas: { c1: 20, c3: 50, c4: 100 } }];
  st.db.covid_capturas = [{ clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-09', anio_campana: CAMP,
    valores: { MODERNA: { c3: 10, c4: 30 }, PFIZER: { c4: 20 } }, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [], folio: 'COV-20261009-AAAA1111' }];
  return st;
}

async function abrir(page, st, ahora = '2026-10-14T12:00:00') {
  const srv = creaServidor(st);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.clock.setFixedTime(new Date(ahora));
  await page.addInitScript(() => {
    localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
      access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
      user: { id: 'u1', email: 'ana@x.mx', user_metadata: {} }
    }));
  });
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
  return { srv, errores };
}

test.describe('Influenza: captura de la unidad en móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('solo UNIDAD ve la pestaña; supervisión ve la de validación', async ({ page }) => {
    await abrir(page, estado({ rol: 'ADMIN' }));
    await expect(page.locator('#dockItemINFC')).toBeHidden();
    await expect(page.locator('#dockItemINF')).toBeVisible();
  });

  test('semana en curso, resumen de meta en vivo, faltantes y reglas de calendario', async ({ page }) => {
    const { errores } = await abrir(page, estado());
    await page.click('#dockItemINFC');
    await expect(page.locator('#icSemana')).toHaveValue('2026-10-16');
    await expect(page.locator('.ic-chip')).toHaveText('Pendiente');
    await expect(page.locator('#icMeta')).toHaveText('172');                       // 100 + 12 + 40 + 20
    await expect(page.locator('#icAplicadas')).toHaveText('80');                   // acumulado anterior
    // r1: meta 100, antes 80 → faltan 20; al capturar 5, faltan 15
    await expect(page.locator('#icf_r1')).toHaveText('Faltan 20');
    await page.click('.ic-mas-menos[data-rubro="r1"][data-paso="1"]');
    await page.click('.ic-mas-menos[data-rubro="r1"][data-paso="1"]');
    await expect(page.locator('#ic_r1')).toHaveValue('2');
    await expect(page.locator('#icf_r1')).toHaveText('Faltan 18');
    await expect(page.locator('#icAplicadas')).toHaveText('82');
    await expect(page.locator('#hubCounter .hub-counter-num')).toHaveText('2');
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-label', /2 dosis esta semana/);
    // 2ª dosis aún no disponible (1er mes de la campaña): campo deshabilitado
    await expect(page.locator('#ic_r6')).toBeDisabled();
    await expect(page.locator('.ic-aviso:not(.ic-aviso--info)').first()).toContainText('2ª dosis no disponible');
    // Se pasa de la meta: aviso en vivo
    await page.fill('#ic_r1', '30');
    await expect(page.locator('#icf_r1')).toHaveText('Rebasa por 10');
    await expect(page.locator('#ic_r1')).toHaveAttribute('aria-invalid', 'true');
    expect(errores).toEqual([]);
  });

  test('usa el command hub (chip, contador y guardar) y la guía por pasos accesible', async ({ page }) => {
    await abrir(page, estado());
    await page.click('#dockItemINFC');
    await expect(page.locator('#globalCommandHub')).toHaveClass(/visible/);
    await expect(page.locator('#hubStatusText')).toHaveText('Listo');
    await expect(page.locator('#hubCounter')).toBeVisible();
    await expect(page.locator('#hubCounter .hub-counter-num')).toHaveText('0');
    // Pasos: semana y nombre ya completos (nombre del perfil); el paso actual es «Captura las dosis»
    await expect(page.locator('#icPasos li')).toHaveCount(4);
    await expect(page.locator('#icPasos li[aria-current="step"]')).toContainText('Captura las dosis');
    await expect(page.locator('#icPasoActual')).toHaveText('Paso 3 de 4: Captura las dosis');
    await page.click('.ic-mas-menos[data-rubro="r1"][data-paso="1"]');
    await expect(page.locator('#icPasoActual')).toHaveText('Paso 4 de 4: Guarda y recibe tu folio');
    // Ayuda por pasos (Anterior / Siguiente)
    await page.click('.ic-ayuda');
    await expect(page.getByRole('button', { name: /Siguiente/i }).first()).toBeVisible();
  });

  test('semanas futuras: cerrada con motivo y sin guardar', async ({ page }) => {
    await abrir(page, estado());
    await page.click('#dockItemINFC');
    await page.click('#icSig');
    await expect(page.locator('.ic-chip')).toHaveText('Aún no abre');
    await expect(page.locator('.ic-aviso--cerrada')).toContainText('aún no se puede capturar');
    await expect(page.locator('#hubSaveBtn')).toBeDisabled();
  });

  test('guardar: pide nombre, valida la meta y manda el reporte con folio', async ({ page }) => {
    const { srv, errores } = await abrir(page, estado());
    await page.click('#dockItemINFC');
    await page.fill('#ic_r1', '10');
    await page.fill('#ic_r11', '4');
    await page.fill('#icNombre', '');   // el nombre llega precargado del perfil
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icError')).toContainText('nombre');
    await expect(page.locator('#icNombre')).toBeFocused();

    await page.fill('#icNombre', 'Ana Perez');
    await page.fill('#ic_r1', '50');                                              // 80 + 50 > 100
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icError')).toContainText('superas la meta');
    await expect(page.locator('#ic_r1')).toBeFocused();
    expect(srv.reqs.filter(r => r.nombre === 'influenza_capturas' && r.m === 'POST')).toHaveLength(0);

    await page.fill('#ic_r1', '10');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icExito')).toBeVisible();
    const post = srv.reqs.find(r => r.nombre === 'influenza_capturas' && r.m === 'POST');
    const fila = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(fila).toMatchObject({ clues: 'QTSSA000001', fecha: '2026-10-16', anio_campana: CAMP, editado_por: 'UNIDAD', sin_movimiento: false, capturado_por: 'ANA PEREZ' });
    expect(fila.valores.r1).toBe(10);
    expect(fila.valores.r11).toBe(4);
    expect(errores).toEqual([]);
  });

  test('reporte guardado: casillas bloqueadas hasta «Editar»; Cancelar vuelve a lo guardado y Guardar sale del modo edición', async ({ page }) => {
    const { srv } = await abrir(page, estado());
    await page.click('#dockItemINFC');
    await page.selectOption('#icSemana', '2026-10-09');
    await expect(page.locator('#ic_r1')).toBeDisabled();
    await expect(page.locator('#icNombre')).toBeDisabled();
    await expect(page.locator('#icSinMov')).toBeDisabled();
    await expect(page.locator('#hubSaveBtn')).toBeDisabled();
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-label', /toca Editar/);
    await expect(page.locator('#hubEditBtn')).toBeVisible();
    await expect(page.locator('#hubCancelBtn')).toBeHidden();

    await page.click('#hubEditBtn');
    await expect(page.locator('#ic_r1')).toBeEnabled();
    await expect(page.locator('#hubEditBtn')).toBeHidden();
    await expect(page.locator('#hubCancelBtn')).toBeVisible();
    await expect(page.locator('#hubSaveBtn')).toBeEnabled();
    await page.fill('#ic_r1', '85');
    await page.click('#hubCancelBtn');
    await expect(page.locator('#ic_r1')).toBeDisabled();
    await expect(page.locator('#ic_r1')).toHaveValue('80');

    await page.click('#hubEditBtn');
    await page.fill('#ic_r1', '85');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icExito')).toBeVisible();
    await expect(page.locator('#ic_r1')).toBeDisabled();
    const post = srv.reqs.find(r => r.nombre === 'influenza_capturas' && r.m === 'POST');
    expect((Array.isArray(post.body) ? post.body[0] : post.body).valores.r1).toBe(85);
  });

  test('sin movimiento guarda todo en cero y no exige cantidades', async ({ page }) => {
    const { srv } = await abrir(page, estado());
    await page.click('#dockItemINFC');
    await page.fill('#icNombre', 'Ana Perez');
    await page.check('#icSinMov');
    await expect(page.locator('#hubCounter .hub-counter-etq')).toHaveText('sin mov.');
    await expect(page.locator('.ic-grupo')).toHaveCount(0);
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icExito')).toBeVisible();
    const post = srv.reqs.find(r => r.nombre === 'influenza_capturas' && r.m === 'POST');
    const fila = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(fila.sin_movimiento).toBe(true);
    expect(Object.values(fila.valores).every(v => v === 0)).toBe(true);
  });

  test('reporte en ceros sin «Sin movimiento» no se guarda', async ({ page }) => {
    const { srv } = await abrir(page, estado());
    await page.click('#dockItemINFC');
    await page.fill('#icNombre', 'Ana Perez');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icError')).toContainText('Sin movimiento');
    expect(srv.reqs.filter(r => r.nombre === 'influenza_capturas' && r.m === 'POST')).toHaveLength(0);
  });

  test('sin meta de COVID-19 no aparece el selector de vacuna', async ({ page }) => {
    await abrir(page, estado());
    await page.click('#dockItemINFC');
    await expect(page.locator('.ic-vac')).toHaveCount(0);
  });

  test('COVID-19: selector, Moderna y Pfizer por grupo, meta compartida y guardado en covid_capturas', async ({ page }) => {
    const { srv, errores } = await abrir(page, estadoCovid());
    await page.click('#dockItemINFC');
    await expect(page.locator('.ic-vac')).toBeVisible();
    await page.click('.ic-vac-btn[data-vac="COVID"]');
    await expect(page.locator('#icTitulo')).toHaveText('Temporada invernal');
    await expect(page.locator('.ic-titulo p')).toContainText('COVID-19');
    // Solo los grupos con meta; Pfizer no aplica a 6 a 59 meses
    await expect(page.locator('.ic-grupo .ic-rubro')).toHaveCount(3);
    await expect(page.locator('#ic_cv_MODERNA_c1')).toBeVisible();
    await expect(page.locator('#ic_cv_PFIZER_c1')).toHaveCount(0);
    await expect(page.locator('#icMeta')).toHaveText('170');
    await expect(page.locator('#icAplicadas')).toHaveText('60');                  // 10 + 30 + 20 de la semana anterior
    await expect(page.locator('#icf_cv_c4')).toHaveText('Faltan 50');
    await page.fill('#ic_cv_MODERNA_c4', '20');
    await page.fill('#ic_cv_PFIZER_c4', '10');
    await expect(page.locator('#icf_cv_c4')).toHaveText('Faltan 20');            // las dos marcas suman: 50 + 30
    await expect(page.locator('#hubCounter .hub-counter-num')).toHaveText('30');
    // Se pasa de la meta sumando ambas marcas
    await page.fill('#ic_cv_MODERNA_c4', '45');
    await page.fill('#ic_cv_PFIZER_c4', '10');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icError')).toContainText('supera la meta');
    expect(srv.reqs.filter(r => r.nombre === 'covid_capturas' && r.m === 'POST')).toHaveLength(0);
    await page.fill('#ic_cv_MODERNA_c4', '20');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icExito')).toBeVisible();
    const post = srv.reqs.find(r => r.nombre === 'covid_capturas' && r.m === 'POST');
    const fila = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(fila).toMatchObject({ clues: 'QTSSA000001', fecha: '2026-10-16', anio_campana: CAMP, editado_por: 'UNIDAD', sin_movimiento: false });
    expect(fila.valores.MODERNA.c4).toBe(20);
    expect(fila.valores.PFIZER.c4).toBe(10);
    expect(srv.reqs.filter(r => r.nombre === 'influenza_capturas' && r.m === 'POST')).toHaveLength(0);
    expect(errores).toEqual([]);
  });

  test('COVID-19: la 2ª dosis de 6 a 59 meses se bloquea el 1er mes (igual que en escritorio) y se abre un mes después', async ({ page }) => {
    const conC2 = () => { const st = estadoCovid(); st.db.covid_metas[0].metas.c2 = 20; return st; };
    const { srv, errores } = await abrir(page, conC2(), '2026-10-14T12:00:00');
    await page.click('#dockItemINFC');
    await page.click('.ic-vac-btn[data-vac="COVID"]');
    // 1er mes de la campaña (inicio 1-oct): la 2ª dosis queda deshabilitada con su etiqueta y su aviso; la 1ª sigue libre
    await expect(page.locator('#ic_cv_MODERNA_c2')).toBeDisabled();
    await expect(page.locator('.ic-rubro[data-rubro="cv_c2"] .ic-pill')).toHaveText('Desde 1 nov');
    await expect(page.locator('.ic-aviso').filter({ hasText: '2ª dosis no disponible esta semana' })).toBeVisible();
    await expect(page.locator('#ic_cv_MODERNA_c1')).toBeEnabled();
    // Aunque algo la saltara, guardar con dosis en c2 se rechaza con la regla de calendario y no manda nada
    await page.evaluate(() => { const i = document.getElementById('ic_cv_MODERNA_c2'); i.disabled = false; i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.fill('#ic_cv_MODERNA_c1', '2');
    await page.click('#hubSaveBtn');
    await expect(page.locator('#icError')).toContainText('No hay 2ª dosis en el 1er mes');
    expect(srv.reqs.filter(r => r.nombre === 'covid_capturas' && r.m === 'POST')).toHaveLength(0);
    expect(errores).toEqual([]);
  });

  test('COVID-19: pasado el primer mes la 2ª dosis se captura normal', async ({ page }) => {
    const st = estadoCovid(); st.db.covid_metas[0].metas.c2 = 20;
    const { errores } = await abrir(page, st, '2026-11-06T12:00:00');
    await page.click('#dockItemINFC');
    await page.click('.ic-vac-btn[data-vac="COVID"]');
    await expect(page.locator('#ic_cv_MODERNA_c2')).toBeEnabled();
    await expect(page.locator('.ic-rubro[data-rubro="cv_c2"] .ic-pill')).toHaveCount(0);
    await expect(page.locator('.ic-aviso').filter({ hasText: '2ª dosis no disponible' })).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('unidad sin meta: avisa y solo permite sin movimiento', async ({ page }) => {
    await abrir(page, estado({ metas: null }));
    await page.click('#dockItemINFC');
    await expect(page.locator('.ic-aviso').first()).toContainText('no tiene meta asignada');
    await expect(page.locator('.ic-grupo')).toHaveCount(0);
    await expect(page.locator('#icSinMov')).toBeEnabled();
  });

  test('móvil: sin desbordes y objetivos táctiles de 44 px', async ({ page }) => {
    await abrir(page, estado());
    await page.click('#dockItemINFC');
    const r = await page.evaluate(() => ({
      desborde: document.documentElement.scrollWidth > window.innerWidth,
      chicos: [...document.querySelectorAll('#panelINFC button:not([disabled]), #panelINFC input:not([disabled]):not([type=checkbox]), #panelINFC select')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.id || e.className)
    }));
    expect(r.desborde).toBe(false);
    expect(r.chicos).toEqual([]);
    if (process.env.IC_SHOT) {
      await page.waitForTimeout(3500);
      await page.screenshot({ path: process.env.IC_SHOT, fullPage: false });
      await page.evaluate(() => window.scrollTo(0, 560));
      await page.waitForTimeout(400);
      await page.screenshot({ path: process.env.IC_SHOT.replace('.png', '2.png'), fullPage: false });
    }
  });
});
