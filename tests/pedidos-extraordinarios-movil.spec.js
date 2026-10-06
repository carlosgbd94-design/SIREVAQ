// Pedidos extraordinarios en la app móvil (mobile.html): mismo PostgREST simulado en red, sesión sembrada.
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;

// --- PostgREST mínimo ------------------------------------------------------------------------------
function creaServidor(estado) {
  const reqs = [];
  const tabla = (n) => (estado.db[n] = estado.db[n] || []);

  function parseOr(expr) {
    // "a.eq.1,and(b.gte.2,c.lte.3,d.in.(MENSUAL,null))" -> función fila => bool
    const partes = []; let prof = 0; let acc = '';
    for (const ch of expr) {
      if (ch === '(') prof++; if (ch === ')') prof--;
      if (ch === ',' && prof === 0) { partes.push(acc); acc = ''; } else acc += ch;
    }
    if (acc) partes.push(acc);
    const fns = partes.map((p) => {
      if (p.startsWith('and(')) { const sub = parseOr(p.slice(4, -1)); return (r) => sub.every((f) => f(r)); }
      const m = p.match(/^([a-z_]+)\.(eq|gte|lte|gt|lt|in|is)\.(.*)$/);
      return cond(m[1], m[2], m[3]);
    });
    fns.isOr = true;
    return fns;
  }
  function cond(col, op, val) {
    const num = (v) => v;
    if (op === 'eq') return (r) => String(r[col]) === val;
    if (op === 'gte') return (r) => r[col] != null && String(r[col]) >= val;
    if (op === 'lte') return (r) => r[col] != null && String(r[col]) <= val;
    if (op === 'gt') return (r) => r[col] != null && String(r[col]) > val;
    if (op === 'lt') return (r) => r[col] != null && String(r[col]) < val;
    if (op === 'is') return (r) => (val === 'null' ? r[col] == null : String(r[col]) === val);
    if (op === 'in') {
      const lista = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      return (r) => lista.includes(r[col] == null ? 'null' : String(r[col]));
    }
    return () => true;
  }
  function filtros(url) {
    const fns = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      if (k === 'or') { const alts = parseOr(v.replace(/^\(|\)$/g, '')); fns.push((r) => alts.some((f) => f(r))); continue; }
      if (k === 'and') { const alts = parseOr(v.replace(/^\(|\)$/g, '')); fns.push((r) => alts.every((f) => f(r))); continue; }
      const neg = v.startsWith('not.');
      const m = (neg ? v.slice(4) : v).match(/^(eq|gte|lte|gt|lt|in|is)\.(.*)$/s);
      if (!m) continue;
      const f = cond(k, m[1], m[2]);
      fns.push(neg ? (r) => !f(r) : f);
    }
    return (r) => fns.every((f) => f(r));
  }

  return {
    reqs,
    async manejar(route) {
      const req = route.request();
      const url = new URL(req.url());
      const m = req.method();
      const accept = req.headers()['accept'] || '';
      const json = (status, body, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*', ...extra }, body: JSON.stringify(body) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
      if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
      const nombre = url.pathname.replace('/rest/v1/', '');
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ }
      reqs.push({ m, nombre, q: url.search, body });

      if (nombre.startsWith('rpc/')) {
        const fn = nombre.slice(4);
        const h = estado.rpc[fn];
        if (!h) return json(200, null);
        const out = await h(body || {}, estado);
        if (out && out.__error) return json(400, { message: out.__error, code: 'P0001' });
        return json(200, out === undefined ? null : out);
      }
      const filas = tabla(nombre);
      const pasa = filtros(url);
      if (m === 'GET' || m === 'HEAD') {
        let out = filas.filter(pasa);
        const ord = url.searchParams.get('order');
        if (ord) { const [c, d] = ord.split('.'); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
        const lim = url.searchParams.get('limit'); if (lim) out = out.slice(0, Number(lim));
        if (accept.includes('vnd.pgrst.object')) {
          return out.length === 1 ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${out.length} rows` });
        }
        return json(200, out);
      }
      if (m === 'DELETE') { const quedan = filas.filter((r) => !pasa(r)); estado.db[nombre] = quedan; return route.fulfill({ status: 204 }); }
      if (m === 'POST') { const rows = Array.isArray(body) ? body : [body]; rows.forEach((r) => filas.push({ ...r })); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (m === 'PATCH') { filas.filter(pasa).forEach((r) => Object.assign(r, body)); return route.fulfill({ status: 204 }); }
      return json(200, []);
    }
  };
}


const idx = (reqs, nombre, m) => reqs.filter((r) => r.nombre === nombre && (!m || r.m === m));

function estadoMovil() {
  return {
    db: {
      perfiles: [{ id: 'u1', usuario: 'ana', nombre: 'Ana', rol: 'UNIDAD', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI' }],
      biologicos_catalogo: [{ biologico: 'TD', orden_biologico: 1, id: 'b-td' }, { biologico: 'BCG', orden_biologico: 2, id: 'b-bcg' }],
      biologicos_params: [
        { clues: 'QTSSA000830', biologico: 'TD', min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' },
        { clues: 'QTSSA000830', biologico: 'BCG', min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' }
      ],
      pedidos_extraordinarios: [], biologicos_pedido: [], calendario_pedidos: []
    },
    rpc: {}
  };
}

async function abrirMovil(page, estado, ahora) {
  const srv = creaServidor(estado);
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
  await page.click('.dock-item[data-panel="BIO"]');
  await page.waitForTimeout(800);
  return { srv, errores };
}

async function llenarYGuardar(page) {
  await page.evaluate(() => {
    document.getElementById('nombreBIO').value = 'Ana';
    document.querySelectorAll('#bioCardsContainer input[data-field]').forEach((i) => { i.value = '10'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  });
  await page.waitForTimeout(300);
  for (let k = 0; k < 4; k++) {   // el guardado puede pedir confirmar avisos
    await page.evaluate(() => document.getElementById('hubSaveBtn').click());
    await page.waitForTimeout(500);
    const ok = page.locator('button:has-text("Confirmar"), button:has-text("Guardar de todos modos"), button:has-text("Aceptar")').first();
    if (await ok.isVisible().catch(() => false)) await ok.click().catch(() => {});
  }
}

test.describe('Pedidos extraordinarios (móvil)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('solo ventana ordinaria: pedido MENSUAL del día 22 y sin selector', async ({ page }) => {
    const e = estadoMovil();
    const { srv, errores } = await abrirMovil(page, e, '2026-10-22T12:00:00');
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('22/10/2026');
    await expect(page.locator('#bioModoMobile')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('solo un extraordinario abierto: banner naranja y guarda EXTRAORDINARIO con su fecha sin tocar el ordinario', async ({ page }) => {
    const e = estadoMovil();
    e.db.pedidos_extraordinarios = [{ id: 'x', fecha_programada: '2026-10-26', habilitar_desde: '2026-10-26', habilitar_hasta: '2026-10-28', motivo: 'Brote', activo: true }];
    e.db.biologicos_pedido = [{ id: 'o1', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', fecha_captura: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 50, existencia_actual_frascos: 1 }];
    const { srv, errores } = await abrirMovil(page, e, '2026-10-27T12:00:00');
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('Pedido Extraordinario');
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('26/10/2026');
    await expect(page.locator('#bioModoMobile')).toHaveCount(0);
    await llenarYGuardar(page);
    await expect.poll(() => idx(srv.reqs, 'biologicos_pedido', 'POST').length).toBeGreaterThan(0);
    const post = idx(srv.reqs, 'biologicos_pedido', 'POST')[0];
    post.body.forEach((r) => { expect(r.tipo_pedido).toBe('EXTRAORDINARIO'); expect(r.fecha_pedido_programada).toBe('2026-10-26'); });
    expect(idx(srv.reqs, 'biologicos_pedido', 'DELETE')[0].q).toContain('fecha_pedido_programada=eq.2026-10-26');
    expect(e.db.biologicos_pedido.filter((r) => r.fecha_pedido_programada === '2026-10-22').map((r) => r.pedido_frascos)).toEqual([50]);
    expect(errores).toEqual([]);
  });

  test('ordinario y extraordinario abiertos: selector (radiogroup) y cada pedido carga su fecha', async ({ page }) => {
    const e = estadoMovil();
    e.db.pedidos_extraordinarios = [{ id: 'x', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-23', motivo: 'Faltante', activo: true }];
    const { srv, errores } = await abrirMovil(page, e, '2026-10-22T12:00:00');
    await expect(page.locator('#bioModoMobile legend')).toHaveText('¿Qué pedido vas a capturar?');
    const radios = page.locator('#bioModoMobile input[type=radio]');
    await expect(radios).toHaveCount(2);
    await expect(radios.first()).toBeChecked();
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('22/10/2026');
    await radios.nth(1).check();
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('Pedido Extraordinario');
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('20/10/2026');
    await expect(radios.nth(1)).toBeChecked();
    await radios.first().check();
    await expect(page.locator('#fechaPedidoBIOBox')).toContainText('22/10/2026');
    expect(errores).toEqual([]);
  });
});
