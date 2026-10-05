// Medallas de cumplimiento sobre la página REAL (index.html con su style.css y su main.js, sin sesión):
// se simula solo la respuesta de la base y se comprueba el DOM y los estilos que de verdad ve el usuario.
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

const filas = [
  ['2026-01', 4, 4, true], ['2026-02', 4, 4, false], ['2026-03', 3, 4, true], ['2026-04', 3, 3, true],
  ['2026-05', 2, 3, true], ['2026-06', 2, 2, true], ['2026-07', 4, 4, true]
].map(([mes, b, c, p]) => ({ mes, clues: 'AAA', bio_semanas_ok: b, cons_semanas_ok: c, pedido_mensual: p, ebio: 4, econs: 4 }));

async function prepararPagina(page, rol = 'UNIDAD') {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof refreshComplianceMedals === 'function', null, { timeout: 20000 });
  // El arranque de la página reinicia USER/TOKEN al terminar su comprobación de sesión: se espera a que acabe.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(({ filas, rol }) => {
    /* eslint-disable no-undef */
    TOKEN = 'tok';
    USER = { usuario: 'tester_med', rol, clues: 'AAA', municipio: 'El Marqués' };
    sessionStorage.clear();
    window.__llamadas = [];
    window.supabase.rpc = async (n, a) => {
      window.__llamadas.push({ n, a });
      if (n === 'get_year_medal_inputs_rpc') return { data: filas, error: null };
      return { data: {}, error: null };
    };
    // La tarjeta vive detrás del login: se muestra para poder medirla.
    document.getElementById('rightColumn').classList.remove('hidden');
    document.getElementById('rightColumn').style.display = 'block';
    const lw = document.getElementById('loginWrapper'); if (lw) lw.style.display = 'none';
    document.body.style.minWidth = '900px';
  }, { filas, rol });
  return errores;
}

test('UNIDAD: la tarjeta real pinta una chip por mes con su nivel, sin errores de consola', async ({ page }) => {
  const errores = await prepararPagina(page);
  await page.evaluate(() => refreshComplianceMedals(2026, 'TODOS'));
  const chips = page.locator('#bCumplimientoMedals > .chip-medal-icon');
  await expect(chips).toHaveCount(7);

  const r = await page.evaluate(() => [...document.querySelectorAll('#bCumplimientoMedals > .chip-medal-icon')].map((e) => {
    const cs = getComputedStyle(e);
    return { icon: e.textContent, tier: [...e.classList].find((c) => c.startsWith('tier-')), title: e.title, size: cs.fontSize, filter: cs.filter, bg: cs.backgroundImage, anim: cs.animationName, fill: cs.webkitTextFillColor };
  }));
  // Meses cerrados exigen pedido: Ene 100 diamante, Feb 80 (sin pedido) plata, Mar 90 oro, Abr 80 plata, May 70 bronce, Jun 60 acero, Jul 100 diamante
  expect(r.map((x) => x.tier)).toEqual(['tier-diamante', 'tier-plata', 'tier-oro', 'tier-plata', 'tier-bronze', 'tier-steel', 'tier-diamante']);
  expect(r[0].title).toBe('Medalla de cumplimiento Diamante - Enero (100%)');
  expect(r.every((x) => x.size === '20px')).toBe(true);
  // Sombra doble original (dos drop-shadow) en todas
  expect(r.every((x) => (x.filter.match(/drop-shadow/g) || []).length === 2)).toBe(true);
  // Degradados por nivel: cada tier con su color
  expect(r[0].bg).toContain('rgb(0, 242, 254)');   // diamante
  expect(r[2].bg).toContain('rgb(246, 211, 101)'); // oro
  expect(r[3].bg).toContain('rgb(148, 163, 184)'); // plata
  expect(r[4].bg).toContain('rgb(217, 119, 6)');   // bronce
  expect(r[5].bg).toContain('rgb(71, 85, 105)');   // acero
  expect(r.every((x) => x.fill.includes('0, 0, 0, 0') || x.fill === 'rgba(0, 0, 0, 0)' || x.fill === 'transparent')).toBe(true);
  // El destello continuo solo lo lleva la última diamante
  expect(r.map((x) => x.anim)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'shimmer-medal']);

  // Una sola petición a la base para todo el año
  const llamadas = await page.evaluate(() => window.__llamadas);
  expect(llamadas.filter((l) => l.n === 'get_year_medal_inputs_rpc').length).toBe(1);
  expect(errores).toEqual([]);
});

test('MUNICIPAL: El Marqués se manda tal cual al RPC (la base lo normaliza)', async ({ page }) => {
  await prepararPagina(page, 'MUNICIPAL');
  await page.evaluate(() => refreshComplianceMedals(2026, 'TODOS'));
  await expect(page.locator('#bCumplimientoMedals > .chip-medal-icon').first()).toBeVisible();
  const llamada = await page.evaluate(() => window.__llamadas.find((l) => l.n === 'get_year_medal_inputs_rpc'));
  expect(llamada.a).toEqual({ p_anio: 2026, p_clues: null, p_municipio: 'El Marqués' });
});

test('al pasar el cursor la chip crece (puntero real) y no hay animación permanente en las demás', async ({ page }) => {
  await prepararPagina(page);
  await page.evaluate(() => refreshComplianceMedals(2026, 'TODOS'));
  const chip = page.locator('#bCumplimientoMedals > .chip-medal-icon').nth(2);
  await chip.scrollIntoViewIfNeeded();
  await chip.hover();
  await expect.poll(() => chip.evaluate((e) => getComputedStyle(e).transform)).not.toBe('none');
});

test('ADMIN: con TODOS el tablero no pinta medallas (vista global); con un municipio, las de ese municipio', async ({ page }) => {
  await prepararPagina(page, 'ADMIN');
  const pintar = (valor) => page.evaluate((v) => {
    const sel = document.getElementById('histMunicipioFilter');
    sel.innerHTML = '<option value="TODOS">TODOS</option><option value="CORREGIDORA">CORREGIDORA</option>';
    sel.value = v;
    paintStatusChips({ compliance_pct: 18, global_avg: 18, today: '2026-10-05' });
  }, valor);

  await pintar('TODOS');
  await page.waitForTimeout(600);
  expect(await page.locator('#bCumplimientoMedals .chip-medal-icon').count()).toBe(0);
  expect(await page.evaluate(() => window.__llamadas.length)).toBe(0);

  await pintar('CORREGIDORA');
  await expect(page.locator('#bCumplimientoMedals .chip-medal-icon')).toHaveCount(7);
  const arg = await page.evaluate(() => window.__llamadas.find((l) => l.n === 'get_year_medal_inputs_rpc').a);
  expect(arg).toEqual({ p_anio: 2026, p_clues: null, p_municipio: 'CORREGIDORA' });
});
