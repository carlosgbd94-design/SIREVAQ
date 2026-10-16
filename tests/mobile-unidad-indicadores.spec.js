// Perfil UNIDAD en móvil: «Mis indicadores» abre el panel RDA acotado a la propia unidad (solo su CLUES),
// regresa a la captura y es accesible (axe, claro y oscuro). Supervisión no ve este acceso.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;
const srcDock = fs.readFileSync(path.join(__dirname, 'mobile-dock-oneui.spec.js'), 'utf8');
const creaServidor = new Function(srcDock.slice(srcDock.indexOf('function creaServidor'), srcDock.indexOf('const idx =')) + '\nreturn creaServidor;')();
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

const FILA = (clues, unidad, municipio, extra = {}) => ({
  clues, unidad, municipio, pob_menor_1: 100, pob_1_ano: 100, pob_4_anos: 100,
  bcg_dosis: 400, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
  hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, adol_hb: 30, adol_vph: 70, inv_influenza: 12, inv_covid: 3, ...extra
});

function estado(rol = 'UNIDAD', filas) {
  return {
    db: {
      perfiles: [{ id: 'u1', usuario: 'ana', nombre: 'Ana Perez', rol, clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' }],
      unidades: [{ clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' }, { clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', activo: 'SI' }]
    },
    rpc: {
      get_rda_max_mes: () => 10,
      get_rda_indicators: () => filas || [FILA('QTSSA000001', 'CENTRO A', 'QUERETARO'), FILA('QTSSA000222', 'La Cañada', 'EL MARQUES', { bcg_dosis: 10 })]
    }
  };
}

async function abrir(page, st) {
  const srv = creaServidor(st);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
      access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
      user: { id: 'u1', email: 'ana@x.mx', user_metadata: {} }
    }));
  });
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
  return errores;
}

const axe = (page) => page.evaluate(async (src) => {
  if (!window.axe) { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); }
  const r = await window.axe.run({ exclude: [['#premiumLoadingScreen']] }, { resultTypes: ['violations'] });
  return r.violations.map((v) => ({ id: v.id, n: v.nodes.map((x) => x.target.join(' ')).slice(0, 4) }));
}, AXE);

test.describe('Perfil UNIDAD: Mis indicadores', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('abre el RDA solo con su unidad, sin ranking, y regresa a la captura', async ({ page }) => {
    const errores = await abrir(page, estado());
    const btn = page.locator('#btnMisIndicadores');
    await expect(btn).toBeVisible();
    await page.click('.dock-item[data-panel="CONS"]');
    await btn.click();
    await expect(page.locator('#panelRDA')).toBeVisible();
    await expect(page.locator('#supRdaRoot')).toContainText('Menores de 1 año');
    await expect(page.locator('#supRdaRoot')).not.toContainText('La Cañada');
    await expect(page.locator('#supRdaRoot')).not.toContainText('Por unidad');
    await expect(page.locator('#supRdaRoot [data-esq="influenza"]')).toHaveCount(0);
    await expect(page.locator('#globalCommandHub')).not.toHaveClass(/visible/);
    // Temporada invernal: dosis de la propia unidad
    await page.click('#supRdaRoot [data-esq="invernal"]');
    await expect(page.locator('#supRdaRoot')).toContainText('Influenza');
    // Regresa al panel de captura donde estaba
    await page.click('#supRdaRoot [data-back]');
    await expect(page.locator('#panelCONS')).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('unidad sin registro en el RDA: lo explica en vez de mostrar 0 %', async ({ page }) => {
    await abrir(page, estado('UNIDAD', [FILA('QTSSA000222', 'La Cañada', 'EL MARQUES')]));
    await page.click('#btnMisIndicadores');
    await expect(page.locator('#supRdaRoot')).toContainText('aún no tiene registro en el RDA');
  });

  test('accesible en claro y oscuro', async ({ page }) => {
    await abrir(page, estado());
    await page.click('#btnMisIndicadores');
    await expect(page.locator('#supRdaRoot')).toContainText('Menores de 1 año');
    expect(await axe(page)).toEqual([]);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(700); // termina la transicion de color
    expect(await axe(page)).toEqual([]);
  });

  test('supervisión no ve el acceso', async ({ page }) => {
    await abrir(page, estado('MUNICIPAL'));
    await expect(page.locator('#btnMisIndicadores')).toBeHidden();
  });
});
