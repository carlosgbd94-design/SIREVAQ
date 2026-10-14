// Validación de reportes de Influenza en la versión móvil (supervisión): lista, vista en vivo, validar sin cambios,
// corrección con firma y errores en línea. Mismo PostgREST simulado que mobile-dock-oneui.spec.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;

// Reutiliza el servidor PostgREST simulado de la prueba de la barra de paneles (sin duplicarlo).
const srcDock = fs.readFileSync(path.join(__dirname, 'mobile-dock-oneui.spec.js'), 'utf8');
const i0 = srcDock.indexOf('function creaServidor');
const i1 = srcDock.indexOf('const idx =');
const creaServidor = new Function(srcDock.slice(i0, i1) + '\nreturn creaServidor;')();

function estado(rol = 'ADMIN') {
  const camp = 'Campaña Influenza 2026-2027';
  const valoresA = { r1: 11, r2: 10 };
  return {
    db: {
      perfiles: [{ id: 'u1', usuario: 'sup', nombre: 'Sup', rol, clues: 'QTSSA012154', unidad: 'JS1', municipio: 'QUERETARO', activo: 'SI' }],
      campanas: [{ id: 1, nombre: camp, activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2027-04-30' }],
      unidades: [
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' },
        { clues: 'QTSSA000002', unidad: 'CENTRO B', municipio: 'QUERETARO', activo: 'SI' },
        { clues: 'QTSSA000003', unidad: 'CENTRO C', municipio: 'QUERETARO', activo: 'SI' },
        { clues: 'QTSSA000009', unidad: 'OTRA UNIDAD', municipio: 'CORREGIDORA', activo: 'SI' }
      ],
      influenza_metas: ['QTSSA000001', 'QTSSA000002', 'QTSSA000003'].map(c => ({ clues: c, municipio: 'QUERETARO', anio_campana: camp, metas: { r1: 100, r2: 12, r6: 40, r11: 20 } })),
      influenza_capturas: [
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-16', anio_campana: camp, valores: valoresA, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [{ editado_por: 'UNIDAD', valores_anteriores: null }], updated_at: '2026-10-13T10:00:00Z' },
        { clues: 'QTSSA000002', unidad: 'CENTRO B', municipio: 'QUERETARO', fecha: '2026-10-16', anio_campana: camp, valores: { r1: 5 }, capturado_por: 'LUIS', editado_por: 'ADMIN', historial_ediciones: [{ editado_por: 'UNIDAD', valores_anteriores: null }, { editado_por: 'ADMIN', firmado_por: 'DRA. PEREZ', sin_cambios: true, valores_anteriores: { r1: 5 } }], updated_at: '2026-10-13T11:00:00Z' },
        // Otras semanas de la unidad A para el acumulado
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-09', anio_campana: camp, valores: { r1: 80 }, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [] }
      ]
    },
    rpc: {}
  };
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
      user: { id: 'u1', email: 'sup@x.mx', user_metadata: {} }
    }));
  });
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
  return { srv, errores };
}

test.describe('Influenza: validación en móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('la pestaña solo aparece para supervisión', async ({ page }) => {
    await abrir(page, estado('UNIDAD'));
    await expect(page.locator('#dockItemINF')).toBeHidden();
  });

  test('lista con estados, filtros y vista en vivo; validar sin cambios guarda firma y marca', async ({ page }) => {
    const { srv, errores } = await abrir(page, estado('ADMIN'));
    await expect(page.locator('#dockItemINF')).toBeVisible();
    await page.click('#dockItemINF');
    await expect(page.locator('#ivUnidades .iv-unidad')).toHaveCount(3);          // solo QUERETARO
    await expect(page.locator('#ivSemana')).toHaveValue('2026-10-16');             // semana en curso
    const txt = await page.locator('#ivUnidades').innerText();
    expect(txt).toMatch(/Por validar/);
    expect(txt).toMatch(/Validado/);
    expect(txt).toMatch(/Sin reporte/);

    // Filtro por estado
    await page.click('.iv-chip[data-estado="reportado"]');
    await expect(page.locator('#ivUnidades .iv-unidad')).toHaveCount(1);
    await expect(page.locator('.iv-chip[data-estado="reportado"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('.iv-chip[data-estado="todas"]');

    // Detalle de la unidad por validar
    await page.click('.iv-unidad[data-clues="QTSSA000001"]');
    await expect(page.locator('#ivDetTitulo')).toBeFocused();
    await expect(page.locator('.iv-vivo')).toContainText('21');                    // 11 + 10 dosis
    await expect(page.locator('.iv-vivo')).toContainText('ANA');
    await expect(page.locator('#ivGuardar')).toHaveText('Validar sin cambios');
    await expect(page.locator('#iv_r6')).toBeDisabled();                            // 2ª dosis aún no disponible
    await expect(page.locator('.iv-aviso:not(.iv-aviso--info)')).toContainText('2ª dosis no disponible');

    // Sin firma: error en línea y foco al campo
    await page.click('#ivGuardar');
    await expect(page.locator('#ivError')).toBeVisible();
    await expect(page.locator('#ivNombre')).toBeFocused();
    await expect(page.locator('#ivNombre')).toHaveAttribute('aria-invalid', 'true');

    await page.fill('#ivNombre', 'DRA. LOPEZ');
    await page.click('#ivGuardar');
    await expect(page.locator('#ivUnidades')).toBeVisible();
    const post = srv.reqs.find(r => r.nombre === 'influenza_capturas' && r.m === 'POST');
    expect(post).toBeTruthy();
    const fila = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(fila.clues).toBe('QTSSA000001');
    expect(fila.fecha).toBe('2026-10-16');
    expect(fila.editado_por).toBe('ADMIN');
    expect(fila.valores.r1).toBe(11);
    const ultima = fila.historial_ediciones[fila.historial_ediciones.length - 1];
    expect(ultima.firmado_por).toBe('DRA. LOPEZ');
    expect(ultima.sin_cambios).toBe(true);
    expect(errores).toEqual([]);
  });

  test('corregir: avance en vivo, tope de meta con error en línea y guardado con cambios', async ({ page }) => {
    const { srv, errores } = await abrir(page, estado('ADMIN'));
    await page.click('#dockItemINF');
    await page.click('.iv-unidad[data-clues="QTSSA000001"]');
    // r1: meta 100, acumulado otras semanas 80 → máximo 20 esta semana
    await page.fill('#iv_r1', '35');
    await expect(page.locator('#ivover_r1')).toContainText('Supera la meta');
    await expect(page.locator('#ivCambios')).toContainText('1 rubro modificado');
    await expect(page.locator('#ivGuardar')).toHaveText('Guardar corrección');
    await page.fill('#ivNombre', 'DRA. LOPEZ');
    await page.click('#ivGuardar');
    await expect(page.locator('#ivError')).toContainText('supera la meta anual');
    await expect(page.locator('#iv_r1')).toBeFocused();
    await expect(page.locator('#iv_r1')).toHaveAttribute('aria-invalid', 'true');
    expect(srv.reqs.filter(r => r.nombre === 'influenza_capturas' && r.m === 'POST')).toHaveLength(0);

    await page.fill('#iv_r1', '15');
    await page.click('#ivGuardar');
    await expect(page.locator('#ivUnidades')).toBeVisible();
    const post = srv.reqs.find(r => r.nombre === 'influenza_capturas' && r.m === 'POST');
    const fila = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(fila.valores.r1).toBe(15);
    const ultima = fila.historial_ediciones[fila.historial_ediciones.length - 1];
    expect(ultima.sin_cambios).toBe(false);
    expect(ultima.valores_anteriores.r1).toBe(11);
    expect(errores).toEqual([]);
  });

  test('sin desbordes horizontales y botones táctiles de al menos 44 px', async ({ page }) => {
    await abrir(page, estado('ADMIN'));
    await page.click('#dockItemINF');
    await page.click('.iv-unidad[data-clues="QTSSA000001"]');
    const r = await page.evaluate(() => ({
      desborde: document.documentElement.scrollWidth > window.innerWidth,
      chicos: [...document.querySelectorAll('#panelINF button, #panelINF input:not([disabled]), #panelINF select')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.id || e.className)
    }));
    expect(r.desborde).toBe(false);
    expect(r.chicos).toEqual([]);
  });

  test('los rubros móviles son los mismos que los del escritorio', async () => {
    const modulo = fs.readFileSync(path.join(__dirname, '..', 'influenza_module.js'), 'utf8');
    const a = modulo.indexOf('const INFLUENZA_RUBROS');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(modulo.slice(a, modulo.indexOf('];', a) + 2).replace('const INFLUENZA_RUBROS', 'var INFLUENZA_RUBROS'), ctx);
    const movil = {};
    vm.createContext(movil);
    movil.window = movil;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'influenza_rubros.js'), 'utf8'), movil);
    expect(JSON.parse(JSON.stringify(movil.INFLUENZA_RUBROS_MOVIL))).toEqual(JSON.parse(JSON.stringify(ctx.INFLUENZA_RUBROS)));
  });
});
