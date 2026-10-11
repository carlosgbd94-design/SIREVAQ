// Barra de paneles móvil (One UI): no se mueve con errores del panel Pedido, selección y teclado. Mismo PostgREST simulado que pedidos-extraordinarios-movil.
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

const cajaDock = (page) => page.evaluate(() => { const r = document.getElementById('mobileCaptureDock').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });

test.describe('Barra de paneles (móvil, One UI)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('un error en el panel Pedido (toast + sacudida) no mueve la barra', async ({ page }) => {
    const { errores } = await abrirMovil(page, estadoMovil(), '2026-10-22T12:00:00');
    const antes = await cajaDock(page);
    // Pedido que viola el múltiplo/promedio => toast de error + sacudida
    await page.evaluate(() => {
      document.getElementById('nombreBIO').value = 'Ana';
      document.querySelectorAll('#bioCardsContainer input[data-field="pedido"]').forEach((i) => { i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    });
    await page.evaluate(() => document.getElementById('hubSaveBtn').click());
    for (let k = 0; k < 6; k++) {
      await page.waitForTimeout(80);
      const d = await cajaDock(page);
      expect(d).toEqual(antes);
    }
    await expect(page.locator('#toastContainer .toast-msg.error').first()).toBeVisible();
    // La sacudida se aplica al contenido, no a #mainApp
    expect(await page.evaluate(() => document.getElementById('mainApp').className.includes('shake-organic'))).toBe(false);
    expect(errores.filter((m) => !/Validación de pedido fallida/.test(m))).toEqual([]);
  });

  test('la cápsula sigue al panel activo y queda dentro de la barra', async ({ page }) => {
    await abrirMovil(page, estadoMovil(), '2026-10-22T12:00:00');
    for (const panel of ['SR', 'CONS', 'BIO', 'PINOL']) {
      await page.click(`.dock-item[data-panel="${panel}"]`);
      await page.waitForTimeout(500);
      const r = await page.evaluate((p) => {
        const b = document.querySelector(`.dock-item[data-panel="${p}"]`).getBoundingClientRect();
        const i = document.getElementById('dockIndicator').getBoundingClientRect();
        const d = document.getElementById('mobileCaptureDock').getBoundingClientRect();
        return { dx: Math.abs((i.left + i.width / 2) - (b.left + b.width / 2)), dentro: i.left >= d.left - 1 && i.right <= d.right + 1, ancho: i.width };
      }, panel);
      expect(r.dx).toBeLessThan(2);
      expect(r.dentro).toBe(true);
      expect(r.ancho).toBeGreaterThan(40);
    }
  });

  test('con el teclado abierto (campo enfocado) la barra se retira y vuelve al salir', async ({ page }) => {
    await abrirMovil(page, estadoMovil(), '2026-10-22T12:00:00');
    await page.focus('#nombreBIO');
    await expect(page.locator('body')).toHaveClass(/teclado-abierto/);
    await page.evaluate(() => document.activeElement.blur());
    await expect(page.locator('body')).not.toHaveClass(/teclado-abierto/);
  });

  test('guardar un pedido inválido NO borra el pedido ya guardado', async ({ page }) => {
    const e = estadoMovil();
    e.db.biologicos_pedido = [{ id: 'o1', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', fecha_captura: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 50, existencia_actual_frascos: 1 }];
    const { srv } = await abrirMovil(page, e, '2026-10-22T12:00:00');
    await page.evaluate(() => document.getElementById('hubEditBtn').click());
    await page.evaluate(() => {
      document.getElementById('nombreBIO').value = 'Ana';
      document.querySelectorAll('#bioCardsContainer input[data-field="pedido"]').forEach((i) => { i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    });
    await page.evaluate(() => document.getElementById('hubSaveBtn').click());
    await page.waitForTimeout(600);
    expect(idx(srv.reqs, 'biologicos_pedido', 'DELETE').length).toBe(0);
    expect(e.db.biologicos_pedido.length).toBe(1);
  });

  test('capturas visuales de la barra (claro y oscuro)', async ({ page }) => {
    await abrirMovil(page, estadoMovil(), '2026-10-22T12:00:00');
    await page.screenshot({ path: 'test-results/dock-oneui-claro.png' });
    await page.evaluate(() => { document.documentElement.classList.add('dark'); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/dock-oneui-oscuro.png' });
  });
});

test.describe('Sin movimiento y fechas (móvil)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  function estadoConExistencia(sinMov) {
    const e = estadoMovil();
    e.db.lotes = [{ lote: 'L1', biologico: 'TD', caducidad: '2027-12-31', municipio: 'CORREGIDORA', tipo: 'NORMAL' }];
    e.db.biologicos_existencia = [{ id: 'x1', clues: 'QTSSA000830', fecha: '2026-10-15', capturado_por: 'ANA', sin_movimiento: sinMov, td: 4 }];
    e.db.existencia_detalle = [{ clues: 'QTSSA000830', fecha: '2026-10-15', biologico: 'TD', lote: 'L1', fecha_recepcion: '2026-10-01', cantidad: 4, caducidad: '2027-12-31' }];
    return e;
  }

  test('la última captura fue "sin movimiento": se precargan sus renglones y la casilla NO queda marcada', async ({ page }) => {
    await abrirMovil(page, estadoConExistencia(true), '2026-10-22T12:00:00');
    await page.click('.dock-item[data-panel="SR"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#srCardsContainer .dynamic-sr-card')).toHaveCount(1);
    await expect(page.locator('#chkSinMovimientoSR')).not.toBeChecked();
  });

  test('Sin movimiento (SR) conserva cantidades y guarda replicando la captura anterior', async ({ page }) => {
    const e = estadoConExistencia(false);
    const { srv } = await abrirMovil(page, e, '2026-10-22T12:00:00');
    await page.click('.dock-item[data-panel="SR"]');
    await page.waitForTimeout(500);
    await page.evaluate(() => { const c = document.getElementById('chkSinMovimientoSR'); c.checked = true; c.dispatchEvent(new Event('change')); });
    await expect(page.locator('.sr-qty-input').first()).toHaveValue('4');
    await page.evaluate(() => document.getElementById('hubSaveBtn').click());
    await expect.poll(() => idx(srv.reqs, 'existencia_detalle', 'POST').length).toBeGreaterThan(0);
    const det = idx(srv.reqs, 'existencia_detalle', 'POST')[0].body;
    expect(det[0].cantidad).toBe(4);
    const resumen = idx(srv.reqs, 'biologicos_existencia', 'POST')[0].body;
    expect(resumen.sin_movimiento).toBe(true);
    expect(resumen.td).toBe(4);
  });

  test('a las 9 pm (hora local) la captura lleva la fecha de HOY, no la de mañana (UTC)', async ({ page }) => {
    const e = estadoConExistencia(false);
    const { srv } = await abrirMovil(page, e, '2026-10-22T21:00:00');
    await page.click('.dock-item[data-panel="SR"]');
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('hubSaveBtn').click());
    await expect.poll(() => idx(srv.reqs, 'biologicos_existencia', 'POST').length).toBeGreaterThan(0);
    expect(idx(srv.reqs, 'biologicos_existencia', 'POST')[0].body.fecha).toBe('2026-10-22');
  });
});
