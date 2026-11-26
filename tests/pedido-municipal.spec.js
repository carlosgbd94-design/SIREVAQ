// Captura municipal del pedido de una unidad que no lo hizo: NO cuenta como cumplimiento de la unidad.
// Reglas puras (Node) + pantalla real (index.html contra un PostgREST simulado, como pedidos-extraordinarios.spec.js).
const { test, expect } = require('@playwright/test');
const path = require('path');
const PM = require('../pedido_municipal.js');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;

const fila = (o) => ({ biologico: 'TD', promedio_frascos: 10, min_dosis: 4, max_dosis: 30, ...o });

test.describe('reglas del pedido municipal (puras)', () => {
  test('evalúa renglones como el formulario de la unidad', () => {
    expect(PM.evaluar(fila(), '', '').nivel).toBe('pendiente');
    expect(PM.evaluar(fila(), '3', '').msg).toBe('Falta el pedido');
    expect(PM.evaluar(fila(), '3', '10').nivel).toBe('ok');
    const bajo = PM.evaluar(fila(), '2', '5');
    expect(bajo.nivel).toBe('aviso');
    expect(bajo.msg).toContain('Faltan 3');
    expect(PM.evaluar(fila(), '25', '10').msg).toContain('Rebasa el máximo por 5');
    expect(PM.evaluar(fila(), '-1', '1').nivel).toBe('error');
    expect(PM.evaluar(fila(), '1', '2.5').nivel).toBe('error');
  });

  test('múltiplos (hexavalente 10, SRP/rotavirus 5) y campañas sin validación', () => {
    const hexa = fila({ biologico: 'HEXAVALENTE', promedio_frascos: 4 });
    expect(PM.evaluar(hexa, '0', '15').msg).toBe('Debe ser múltiplo de 10');
    expect(PM.evaluar(hexa, '0', '10').nivel).toBe('ok');
    expect(PM.evaluar(fila({ biologico: 'SRP', promedio_frascos: 5 }), '0', '7').nivel).toBe('error');
    const camp = PM.evaluar(fila({ biologico: 'VPH', promedio_frascos: 31 }), '0', '0');
    expect(camp).toMatchObject({ nivel: 'ok', msg: 'Campaña' });
  });

  test('sugerido: lo que falta para el promedio, redondeado al múltiplo', () => {
    expect(PM.evaluar(fila({ promedio_frascos: 7 }), '2', '').sugerido).toBe(5);
    expect(PM.evaluar(fila({ biologico: 'NEUMOCOCICA 13', promedio_frascos: 7 }), '0', '').sugerido).toBe(10);
    expect(PM.evaluar(fila({ promedio_frascos: 7 }), '9', '').sugerido).toBe(0);
  });

  test('resumen: totales, promedio, mínimo y máximo de la unidad', () => {
    const filas = [fila(), fila({ biologico: 'BCG', promedio_frascos: 6, min_dosis: 1, max_dosis: 12 })];
    const t = PM.resumen(filas, [{ existencia: '2', pedido: '10' }, { existencia: '', pedido: '' }]);
    expect(t).toMatchObject({ existencia: 2, pedido: 10, promedio: 16, minimo: 5, maximo: 42, pendientes: 1, errores: 0, conPedido: 1 });
  });
});

// --- PostgREST mínimo (mismo patrón que pedidos-extraordinarios.spec.js) ---
function creaServidor(estado) {
  const reqs = [];
  return {
    reqs,
    async manejar(route) {
      const req = route.request();
      const url = new URL(req.url());
      const m = req.method();
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
      if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
      const nombre = url.pathname.replace('/rest/v1/', '');
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ }
      reqs.push({ m, nombre, body, q: url.search });
      if (nombre.startsWith('rpc/')) {
        const h = estado.rpc[nombre.slice(4)];
        if (!h) return json(200, null);
        const out = await h(body || {}, estado);
        if (out && out.__error) return json(400, { message: out.__error, code: 'P0001' });
        return json(200, out === undefined ? null : out);
      }
      if (m === 'GET' && estado.db[nombre]) {
        let rows = estado.db[nombre];
        for (const [k, v] of url.searchParams.entries()) {
          const mm = v.match(/^eq\.(.*)$/); if (mm && !['select'].includes(k)) rows = rows.filter((r) => String(r[k]) === mm[1]);
        }
        return json(200, rows);
      }
      return m === 'GET' ? json(200, []) : route.fulfill({ status: 204 });
    }
  };
}

const UNIDADES = [
  { clues: 'C1', unidad: 'Uno', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'C2', unidad: 'Dos', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'C3', unidad: 'Tres', municipio: 'CORREGIDORA', activo: 'SI' }
];
const FORM_C2 = {
  clues: 'C2', unidad: 'Dos', municipio: 'CORREGIDORA', fecha: '2026-10-22', unidad_ya_capturo: false, municipal_ts: null, sin_pedido: false,
  filas: [
    { biologico: 'TD', promedio_frascos: 10, min_dosis: 4, max_dosis: 30, multiplo: 1, existencia_actual_frascos: null, pedido_frascos: null },
    { biologico: 'HEXAVALENTE', promedio_frascos: 4, min_dosis: 2, max_dosis: 6, multiplo: 5, existencia_actual_frascos: null, pedido_frascos: null }
  ]
};

function estadoBase() {
  return {
    db: { unidades: UNIDADES.map((u) => ({ ...u })), biologicos_params: [], biologicos_pedido: [], calendario_pedidos: [] },
    rpc: {
      get_server_today: () => '2026-10-22',
      bio_pedidos_clasificados: () => [],
      get_captures_sr_range_bypass: () => [],
      get_captures_cons_range_bypass: () => [],
      // C1 capturó; C2 lo capturó el MUNICIPIO (no cuenta); C3 nada
      get_captures_bio_range_bypass: () => [
        { clues: 'C1', fecha: '2026-10-22', capturado_por: 'A', tipo_pedido: 'MENSUAL', sin_pedido: false },
        { clues: 'C2', fecha: '2026-10-22', capturado_por: 'MARIA', tipo_pedido: 'MUNICIPAL', sin_pedido: false }
      ],
      pedido_municipal_formulario: () => FORM_C2
    }
  };
}

async function preparar(page, estado, rol) {
  const srv = creaServidor(estado);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(new Date('2026-10-22T12:00:00'));
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate((r) => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: r, usuario: 'tester', nombre: 'Tester', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', municipiosAllowed: ['CORREGIDORA'] };
    TOKEN = 'token-prueba';
  }, rol);
  return { srv, errores };
}

async function pintarResumen(page) {
  return page.evaluate(async () => {
    const res = await supabaseRequest('admincaptureoverview', { action: 'admincaptureoverview', fecha: '2026-10-22', tipo: 'BIO' });
    for (const id of ['panelCaptureSummary', 'sumPorcentaje', 'faltantesTbody']) for (let el = document.getElementById(id); el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
    renderCaptureSummary(res.data);
    return res.data;
  });
}

test.describe('captura municipal del pedido de una unidad', () => {
  test('el pedido municipal NO cuenta como captura de la unidad: sigue pendiente, marcada como cubierta', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase(), 'MUNICIPAL');
    const d = await pintarResumen(page);
    expect([d.total_unidades, d.total_capturadas, d.total_faltantes]).toEqual([3, 1, 2]);
    expect(d.fecha_ordinaria).toBe('2026-10-22');
    expect(d.capturadas.map((c) => c.clues)).toEqual(['C1']);
    const c2 = d.faltantes.find((f) => f.clues === 'C2');
    expect(c2).toMatchObject({ capturado_municipio: true, capturado_municipio_por: 'MARIA' });
    expect(d.faltantes.find((f) => f.clues === 'C3').capturado_municipio).toBeUndefined();
    // Botones: "Capturar pedido" para C3 y "corregir" para C2
    await expect(page.locator('#faltantesTbody button[data-pm-clues="C3"]')).toHaveAttribute('aria-label', /Capturar el pedido de la unidad/);
    await expect(page.locator('#faltantesTbody button[data-pm-clues="C2"]')).toHaveAttribute('aria-label', /corregir/);
    expect(errores).toEqual([]);
  });

  test('solo el nivel municipal (y administrador) ve el botón', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase(), 'JURISDICCIONAL');
    await pintarResumen(page);
    await expect(page.locator('#faltantesTbody button[data-pm-clues]')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('modal: promedio, mín/máx, validaciones; guarda con el RPC y refresca el resumen', async ({ page }) => {
    const e = estadoBase();
    let guardado = null;
    e.rpc.pedido_municipal_guardar = (b) => { guardado = b; return { renglones: 2, frascos: 12 }; };
    const { errores } = await preparar(page, e, 'MUNICIPAL');
    await pintarResumen(page);
    await page.click('#faltantesTbody button[data-pm-clues="C2"]');
    const m = page.locator('#pmOverlay');
    await expect(m).toHaveClass(/pm-open/);
    await expect(m).toContainText('Pedido del');
    await expect(m).toContainText('No cuenta como cumplimiento de la unidad');
    // Promedio y mínimo/máximo de cada biológico a la vista
    await expect(m.locator('.pm-row').first()).toContainText('10');
    await expect(m.locator('.pm-row').first()).toContainText('4 / 30');
    const guardar = m.locator('[data-pm-guardar]');
    await expect(guardar).toBeDisabled(); // faltan renglones
    await m.locator('input[data-pm-i="0"][data-pm-k="ex"]').fill('2');
    await m.locator('input[data-pm-i="0"][data-pm-k="pe"]').fill('8');
    await m.locator('input[data-pm-i="1"][data-pm-k="ex"]').fill('0');
    await m.locator('input[data-pm-i="1"][data-pm-k="pe"]').fill('4'); // hexavalente: múltiplo de 10 → error
    await expect(m.locator('.pm-row').nth(1)).toHaveAttribute('data-nivel', 'error');
    await expect(guardar).toBeDisabled();
    await m.locator('input[data-pm-i="1"][data-pm-k="pe"]').fill('10');
    await expect(m.locator('.pm-row').nth(1)).toHaveAttribute('data-nivel', 'aviso'); // 10 fr. rebasa el máximo (6): aviso, no bloquea
    await expect(guardar).toBeEnabled();
    await expect(m.locator('#pmKpis')).toContainText('18'); // pedido total 8 + 10
    await guardar.click();
    await expect(m).not.toHaveClass(/pm-open/);
    expect(guardado).toEqual({
      p_clues: 'C2', p_fecha: '2026-10-22', p_sin_pedido: false,
      p_items: [{ biologico: 'TD', existencia: 2, pedido: 8 }, { biologico: 'HEXAVALENTE', existencia: 0, pedido: 10 }]
    });
    expect(errores).toEqual([]);
  });

  test('si la unidad ya capturó lo suyo, el formulario queda bloqueado', async ({ page }) => {
    const e = estadoBase();
    e.rpc.pedido_municipal_formulario = () => ({ ...FORM_C2, unidad_ya_capturo: true });
    const { errores } = await preparar(page, e, 'MUNICIPAL');
    await pintarResumen(page);
    await page.click('#faltantesTbody button[data-pm-clues="C3"]');
    await expect(page.locator('#pmOverlay')).toContainText('ya capturó su propio pedido');
    await expect(page.locator('#pmOverlay [data-pm-guardar]')).toBeDisabled();
    await expect(page.locator('#pmOverlay input.pm-in').first()).toBeDisabled();
    expect(errores).toEqual([]);
  });

  test('avisa si el pedido de esa fecha ya se trajo a una requisición', async ({ page }) => {
    const e = estadoBase();
    e.rpc.pedido_municipal_formulario = () => ({ ...FORM_C2, requisicion_vinculada: true });
    const { errores } = await preparar(page, e, 'MUNICIPAL');
    await pintarResumen(page);
    await page.click('#faltantesTbody button[data-pm-clues="C3"]');
    await expect(page.locator('#pmOverlay')).toContainText('ya se trajo a una requisición');
    await expect(page.locator('#pmOverlay [data-pm-guardar]')).toBeDisabled(); // faltan renglones, pero el aviso no bloquea
    expect(errores).toEqual([]);
  });

  test('el formulario de la unidad no precarga ni da por capturado lo que escribió el municipio', async ({ page }) => {
    const e = estadoBase();
    e.db.biologicos_params = [{ clues: 'QTSSA000830', biologico: 'TD', multiplo: 1, min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' }];
    e.db.biologicos_pedido = [{ clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', tipo_pedido: 'MUNICIPAL', existencia_actual_frascos: 3, pedido_frascos: 9, timestamp: '2026-10-21T10:00:00Z' }];
    const { errores } = await preparar(page, e, 'UNIDAD');
    const r = await page.evaluate(async () => (await supabaseRequest('biogetform', { action: 'biogetform' })).data);
    expect(r.hasSavedBio).toBe(false);
    expect(r.rows[0].pedido_frascos).toBeNull();
    expect(errores).toEqual([]);
  });
});
