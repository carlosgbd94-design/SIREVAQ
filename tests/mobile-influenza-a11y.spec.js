// Accesibilidad (axe, modo oscuro, 320 px) de los paneles móviles de Influenza: captura de la unidad y validación.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;
const srcDock = fs.readFileSync(path.join(__dirname, 'mobile-dock-oneui.spec.js'), 'utf8');
const creaServidor = new Function(srcDock.slice(srcDock.indexOf('function creaServidor'), srcDock.indexOf('const idx =')) + '\nreturn creaServidor;')();
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const CAMP = 'Campaña Influenza 2026-2027';

function estado(rol) {
  return {
    db: {
      perfiles: [{ id: 'u1', usuario: 'ana', nombre: 'Ana Perez', rol, clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' }],
      campanas: [{ id: 1, nombre: CAMP, activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2027-04-30' }],
      unidades: [
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', activo: 'SI' },
        { clues: 'QTSSA000002', unidad: 'CENTRO B CON UN NOMBRE MUY LARGO PARA PROBAR EL AJUSTE DE LINEA', municipio: 'QUERETARO', activo: 'SI' }
      ],
      influenza_metas: [
        { clues: 'QTSSA000001', municipio: 'QUERETARO', anio_campana: CAMP, metas: { r1: 100, r2: 12, r6: 40, r11: 20 } },
        { clues: 'QTSSA000002', municipio: 'QUERETARO', anio_campana: CAMP, metas: { r1: 50 } }
      ],
      influenza_capturas: [
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-16', anio_campana: CAMP, valores: { r1: 11 }, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [], folio: 'INF-1', updated_at: '2026-10-13T10:00:00Z' },
        { clues: 'QTSSA000001', unidad: 'CENTRO A', municipio: 'QUERETARO', fecha: '2026-10-09', anio_campana: CAMP, valores: { r1: 80 }, capturado_por: 'ANA', editado_por: 'UNIDAD', historial_ediciones: [], folio: 'INF-0' }
      ]
    },
    rpc: {}
  };
}

async function abrir(page, rol, oscuro) {
  const srv = creaServidor(estado(rol));
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00'));
  await page.addInitScript((dark) => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
      access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
      user: { id: 'u1', email: 'ana@x.mx', user_metadata: {} }
    }));
  }, !!oscuro);
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
  await page.addScriptTag({ content: AXE });
  // El tema realmente cambió (si no, las pruebas oscuras no probarían nada)
  const esOscuro = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(esOscuro).toBe(!!oscuro);
  if (oscuro) {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(241, 244, 248)');   // el fondo oscuro se aplicó
  }
}

async function axe(page, selector) {
  return page.evaluate(async (sel) => {
    const r = await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  }, selector);
}

for (const oscuro of [false, true]) {
  test.describe(`Influenza móvil: accesibilidad (${oscuro ? 'oscuro' : 'claro'})`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('captura de la unidad: sin violaciones en la lista, con error y sin movimiento', async ({ page }) => {
      await abrir(page, 'UNIDAD', oscuro);
      await page.click('#dockItemINFC');
      await page.waitForSelector('#icMeta');
      expect(await axe(page, '#panelINFC')).toEqual([]);
      await expect(page.locator('#ic_r1')).toBeDisabled();       // reporte guardado: protegido hasta «Editar»
      await page.click('#hubEditBtn');
      expect(await axe(page, '#panelINFC')).toEqual([]);
      await page.fill('#ic_r1', '30');                    // rebasa la meta → aria-invalid + aviso
      await page.fill('#icNombre', '');
      await page.click('#hubSaveBtn');
      await page.waitForSelector('#icError:not([hidden])');
      expect(await axe(page, '#panelINFC')).toEqual([]);
      await page.selectOption('#icSemana', '2026-10-02');   // semana sin reporte: se puede marcar sin movimiento
      await page.fill('#icNombre', 'Ana');
      await page.check('#icSinMov');
      expect(await axe(page, '#panelINFC')).toEqual([]);
    });

    test('validación: sin violaciones en la lista y en el detalle', async ({ page }) => {
      await abrir(page, 'ADMIN', oscuro);
      await page.click('#dockItemINF');
      await page.waitForSelector('#ivUnidades .iv-unidad');
      expect(await axe(page, '#panelINF')).toEqual([]);
      await page.click('.iv-unidad[data-clues="QTSSA000001"]');
      await page.waitForSelector('#ivGuardar');
      expect(await axe(page, '#panelINF')).toEqual([]);
      await page.fill('#iv_r1', '12');                  // un cambio, pero sin nombre → error en línea
      await page.click('#ivGuardar');
      await page.waitForSelector('#ivError:not([hidden])');
      expect(await axe(page, '#panelINF')).toEqual([]);
    });
  });
}

test.describe('Influenza móvil: reflujo', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('a 320 px no hay desplazamiento horizontal en ninguno de los dos paneles', async ({ page }) => {
    await abrir(page, 'UNIDAD', false);
    await page.click('#dockItemINFC');
    await page.waitForSelector('#icMeta');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });

  test('a 320 px la validación y el nombre largo de la unidad no se desbordan', async ({ page }) => {
    await abrir(page, 'ADMIN', false);
    await page.click('#dockItemINF');
    await page.waitForSelector('#ivUnidades .iv-unidad');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.click('.iv-unidad[data-clues="QTSSA000002"]');
    await page.waitForSelector('#ivGuardar');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
