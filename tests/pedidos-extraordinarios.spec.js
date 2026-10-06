// Pedidos extraordinarios de biológico sobre el index.html real (captura de la unidad, panel ADMIN y exportación).
// Sin sesión real: las llamadas a Supabase (REST y RPC) se interceptan en la red y las responde un
// PostgREST simulado en memoria (filtros eq/gte/lte/in/is/or, insert/delete, rpc). Así corre el código de
// main.js tal cual: lo que se verifica son las PETICIONES que saldrían (fechas, tipo_pedido, filtros).
const { test, expect } = require('@playwright/test');
const path = require('path');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;
const BASE = 'https://utclfqjietlxzlorxhrs.supabase.co';

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

// Estado base: unidad con 2 biológicos configurados
function estadoBase(hoy) {
  return {
    db: {
      biologicos_params: [
        { clues: 'QTSSA000830', biologico: 'TD', multiplo: 1, min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' },
        { clues: 'QTSSA000830', biologico: 'BCG', multiplo: 1, min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' }
      ],
      pedidos_extraordinarios: [],
      biologicos_pedido: [],
      calendario_pedidos: [],
      unidades: [{ clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI' }]
    },
    rpc: {
      get_server_today: () => hoy,
      bio_pedidos_clasificados: () => []
    }
  };
}

async function preparar(page, estado, { rol = 'UNIDAD' } = {}) {
  const srv = creaServidor(estado);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate((rolUsuario) => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: rolUsuario, usuario: 'tester', nombre: 'Tester', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', municipiosAllowed: rolUsuario === 'ADMIN' ? ['*'] : ['CORREGIDORA'] };
    TOKEN = 'token-prueba';
    FULL_BIO_CATALOG = [{ biologico: 'TD' }, { biologico: 'BCG' }];
  }, rol);
  return { srv, errores };
}

// Deja el formulario de pedido visible y listo (la sesión real lo hace al entrar)
async function abrirPedido(page) {
  await page.evaluate(async () => {
    const r = await supabaseRequest('unitstatus', { action: 'unitstatus' });
    STATUS = r.data;
    const f = document.getElementById('formBIO'); f.style.display = 'block';
    for (let el = f; el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
    await loadBioForm();
  });
}

test.describe('Pedidos extraordinarios', () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  test('unitstatus: solo trae los extraordinarios abiertos HOY', async ({ page }) => {
    const e = estadoBase('2026-10-20');
    e.db.pedidos_extraordinarios = [
      { id: 'a', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-21', motivo: 'Abierto hoy', activo: true },
      { id: 'b', fecha_programada: '2026-10-25', habilitar_desde: '2026-10-25', habilitar_hasta: '2026-10-26', motivo: 'Futuro', activo: true },
      { id: 'c', fecha_programada: '2026-10-10', habilitar_desde: '2026-10-10', habilitar_hasta: '2026-10-11', motivo: 'Vencido', activo: true },
      { id: 'd', fecha_programada: '2026-10-19', habilitar_desde: '2026-10-19', habilitar_hasta: '2026-10-22', motivo: 'Cerrado a mano', activo: false }
    ];
    const { errores } = await preparar(page, e);
    const extras = await page.evaluate(async () => (await supabaseRequest('unitstatus', { action: 'unitstatus' })).data.bioExtras);
    expect(extras.map((x) => x.id)).toEqual(['a']);
    expect(errores).toEqual([]);
  });

  test('captura: sin extraordinarios y fuera de ventana, el pedido está cerrado y no hay selector', async ({ page }) => {
    const e = estadoBase('2026-10-12');
    const { errores } = await preparar(page, e);
    await abrirPedido(page);
    expect(await page.evaluate(() => BIO_STATE.canCapture)).toBe(false);
    await expect(page.locator('#bioModoBox')).toBeHidden();
    expect(errores).toEqual([]);
  });

  test('captura: solo la ventana ordinaria abierta -> MENSUAL con la fecha del día 22, sin selector', async ({ page }) => {
    const e = estadoBase('2026-10-22');
    const { srv, errores } = await preparar(page, e);
    await abrirPedido(page);
    const s = await page.evaluate(() => ({ can: BIO_STATE.canCapture, tipo: BIO_STATE.tipoPedido, fecha: BIO_STATE.fechaPedidoProgramada }));
    expect(s).toEqual({ can: true, tipo: 'MENSUAL', fecha: '2026-10-22' });
    await expect(page.locator('#bioModoBox')).toBeHidden();
    // La lectura de lo guardado es la del ordinario (con el rango de la ventana), no la de un extra
    const lect = idx(srv.reqs, 'biologicos_pedido', 'GET').pop();
    expect(lect.q).toContain('or=');
    expect(errores).toEqual([]);
  });

  test('captura: solo un extraordinario abierto (fuera de la ventana del 22) -> se captura ese pedido y no toca el ordinario', async ({ page }) => {
    const e = estadoBase('2026-10-27');
    e.db.pedidos_extraordinarios = [{ id: 'x1', fecha_programada: '2026-10-26', habilitar_desde: '2026-10-26', habilitar_hasta: '2026-10-28', motivo: 'Brote', activo: true }];
    // Ya hay un ordinario guardado (22) y un extra a medias (26): solo el extra debe cargarse
    e.db.biologicos_pedido = [
      { id: 'o1', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', fecha_captura: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 50, existencia_actual_frascos: 1, timestamp: '2026-10-22T10:00:00Z' },
      { id: 'x1r', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-26', fecha_captura: '2026-10-26', tipo_pedido: 'EXTRAORDINARIO', pedido_frascos: 7, existencia_actual_frascos: 2, timestamp: '2026-10-26T10:00:00Z' }
    ];
    const { srv, errores } = await preparar(page, e);
    await abrirPedido(page);
    const s = await page.evaluate(() => ({ can: BIO_STATE.canCapture, tipo: BIO_STATE.tipoPedido, fecha: BIO_STATE.fechaPedidoProgramada, td: BIO_STATE.rows.find((r) => r.biologico === 'TD') }));
    expect(s.can).toBe(true);
    expect(s.tipo).toBe('EXTRAORDINARIO');
    expect(s.fecha).toBe('2026-10-26');
    expect(s.td.pedido_frascos).toBe(7);                       // lo del extra, no los 50 del ordinario
    await expect(page.locator('#bioModoBox')).toBeHidden();    // un solo pedido abierto: nada que elegir
    await expect(page.locator('#bioDayAlert')).toContainText('PEDIDO EXTRAORDINARIO');
    const lect = idx(srv.reqs, 'biologicos_pedido', 'GET').pop();
    expect(lect.q).toContain('fecha_pedido_programada=eq.2026-10-26');
    expect(lect.q).not.toContain('or=');
    expect(errores).toEqual([]);
  });

  test('captura: ordinario y extraordinario abiertos a la vez -> selector accesible y cada pedido carga lo suyo', async ({ page }) => {
    const e = estadoBase('2026-10-22');
    e.db.pedidos_extraordinarios = [{ id: 'x1', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-23', motivo: 'Faltante', activo: true }];
    e.db.biologicos_pedido = [
      { id: 'o1', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', fecha_captura: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 50, existencia_actual_frascos: 1, timestamp: '2026-10-22T10:00:00Z' }
    ];
    const { errores } = await preparar(page, e);
    await abrirPedido(page);
    await expect(page.locator('#bioModoBox')).toBeVisible();
    await expect(page.locator('#bioModoBox legend')).toHaveText('¿Qué pedido vas a capturar?');
    await expect(page.locator('#bioModoOpciones')).toHaveAttribute('role', 'radiogroup');
    const radios = page.locator('#bioModoOpciones input[type=radio]');
    await expect(radios).toHaveCount(2);
    await expect(radios.first()).toBeChecked();                // el ordinario va primero y es el predeterminado
    expect(await page.evaluate(() => BIO_STATE.tipoPedido)).toBe('MENSUAL');
    expect(await page.evaluate(() => BIO_STATE.rows.find((r) => r.biologico === 'TD').pedido_frascos)).toBe(50);

    // Cambiar al extra con el teclado (flecha) recarga ESE pedido, vacío, y conserva el foco
    await radios.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => BIO_STATE.tipoPedido)).toBe('EXTRAORDINARIO');
    expect(await page.evaluate(() => BIO_STATE.fechaPedidoProgramada)).toBe('2026-10-20');
    expect(await page.evaluate(() => BIO_STATE.rows.find((r) => r.biologico === 'TD').pedido_frascos)).toBeFalsy();
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    // ... y volver al ordinario
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => page.evaluate(() => BIO_STATE.tipoPedido)).toBe('MENSUAL');
    expect(await page.evaluate(() => BIO_STATE.fechaPedidoProgramada)).toBe('2026-10-22');
    expect(errores).toEqual([]);
  });

  async function llenarYGuardar(page) {
    await page.evaluate(() => {
      document.getElementById('nombreBIO').value = 'Ana Pérez';
      document.querySelectorAll('input[data-kind="existencia"]').forEach((i) => { i.value = '10'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      document.querySelectorAll('input[data-kind="pedido"]').forEach((i) => { i.value = '10'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      // El formulario puede pedir confirmar avisos (existencia vs. promedio): se aceptan como lo haría la persona
      window.__aceptaAvisos = setInterval(() => { const o = document.getElementById('bioConfirmOverlay'); if (o && o.classList.contains('show')) document.getElementById('btnBioConfirmAccept').click(); }, 60);
      window.__guardado = performSaveBIO();
    });
  }

  test('guardar un pedido EXTRAORDINARIO: su fecha, tipo EXTRAORDINARIO y NO borra el ordinario', async ({ page }) => {
    const e = estadoBase('2026-10-22');
    e.db.pedidos_extraordinarios = [{ id: 'x1', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-23', motivo: 'Faltante', activo: true }];
    e.db.biologicos_pedido = [
      { id: 'o1', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-22', fecha_captura: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 50, existencia_actual_frascos: 1, timestamp: '2026-10-22T10:00:00Z' }
    ];
    const { srv, errores } = await preparar(page, e);
    await abrirPedido(page);
    await page.locator('#bioModoOpciones input[type=radio]').nth(1).check();
    await expect.poll(() => page.evaluate(() => BIO_STATE.tipoPedido)).toBe('EXTRAORDINARIO');
    await llenarYGuardar(page);
    await expect.poll(() => idx(srv.reqs, 'biologicos_pedido', 'POST').length).toBeGreaterThan(0);

    const post = idx(srv.reqs, 'biologicos_pedido', 'POST')[0];
    expect(post.body.length).toBe(2);
    post.body.forEach((r) => { expect(r.tipo_pedido).toBe('EXTRAORDINARIO'); expect(r.fecha_pedido_programada).toBe('2026-10-20'); expect(r.clues).toBe('QTSSA000830'); });
    // La limpieza previa solo toca la fecha del extra: nada de rangos de ventana ni del tipo MENSUAL
    const del = idx(srv.reqs, 'biologicos_pedido', 'DELETE')[0];
    expect(del.q).toContain('fecha_pedido_programada=eq.2026-10-20');
    expect(del.q).not.toContain('or=');
    // El ordinario sigue intacto
    expect(e.db.biologicos_pedido.filter((r) => r.fecha_pedido_programada === '2026-10-22').map((r) => r.pedido_frascos)).toEqual([50]);
    expect(e.db.biologicos_pedido.filter((r) => r.fecha_pedido_programada === '2026-10-20').length).toBe(2);
    expect(errores).toEqual([]);
  });

  test('guardar el pedido ORDINARIO: MENSUAL con la fecha del día 22 (y su limpieza por ventana), sin tocar un extra', async ({ page }) => {
    const e = estadoBase('2026-10-22');
    e.db.pedidos_extraordinarios = [{ id: 'x1', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-23', motivo: 'Faltante', activo: true }];
    e.db.biologicos_pedido = [
      { id: 'x1r', clues: 'QTSSA000830', biologico: 'TD', fecha_pedido_programada: '2026-10-20', fecha_captura: '2026-10-21', tipo_pedido: 'EXTRAORDINARIO', pedido_frascos: 9, existencia_actual_frascos: 1, timestamp: '2026-10-21T10:00:00Z' }
    ];
    const { srv, errores } = await preparar(page, e);
    await abrirPedido(page);
    await llenarYGuardar(page);
    await expect.poll(() => idx(srv.reqs, 'biologicos_pedido', 'POST').length).toBeGreaterThan(0);
    const post = idx(srv.reqs, 'biologicos_pedido', 'POST')[0];
    post.body.forEach((r) => { expect(r.tipo_pedido).toBe('MENSUAL'); expect(r.fecha_pedido_programada).toBe('2026-10-22'); });
    // El extra (capturado dentro del rango de fechas de la ventana) sobrevive a la limpieza del ordinario
    expect(e.db.biologicos_pedido.filter((r) => r.id === 'x1r').length).toBe(1);
    expect(errores).toEqual([]);
  });

  test('ADMIN: la lista de extraordinarios muestra estado y acciones correctos, y abrir/cerrar/reabrir/eliminar llaman a la base', async ({ page }) => {
    const e = estadoBase('2026-10-20');
    e.db.pedidos_extraordinarios = [
      { id: 'abierto', fecha_programada: '2026-10-20', habilitar_desde: '2026-10-20', habilitar_hasta: '2026-10-21', motivo: 'Brote', activo: true },
      { id: 'futuro', fecha_programada: '2026-10-28', habilitar_desde: '2026-10-28', habilitar_hasta: '2026-10-29', motivo: null, activo: true },
      { id: 'vencido', fecha_programada: '2026-10-05', habilitar_desde: '2026-10-05', habilitar_hasta: '2026-10-06', motivo: null, activo: true },
      { id: 'cerrado', fecha_programada: '2026-10-02', habilitar_desde: '2026-10-02', habilitar_hasta: '2026-10-09', motivo: null, activo: false }
    ];
    e.rpc.bio_pedidos_clasificados = ({ p_mes }) => (p_mes === 10 ? [
      { fecha: '2026-10-20', tipo: 'EXTRAORDINARIO', unidades: 3, frascos: 120 },
      { fecha: '2026-10-02', tipo: 'EXTRAORDINARIO', unidades: 1, frascos: 5 }
    ] : []);
    const llamadas = [];
    e.rpc.pedido_extra_abrir = (b) => { llamadas.push(['abrir', b]); if (b.p_fecha === '2026-10-22') return { __error: 'El 22/10/2026 es la fecha del pedido ordinario de ese mes; elige otro día para el extraordinario' }; e.db.pedidos_extraordinarios.push({ id: 'nuevo', fecha_programada: b.p_fecha, habilitar_desde: b.p_fecha, habilitar_hasta: b.p_hasta, motivo: b.p_motivo, activo: true }); return {}; };
    e.rpc.pedido_extra_estado = (b) => { llamadas.push(['estado', b]); e.db.pedidos_extraordinarios.find((x) => x.id === b.p_id).activo = b.p_activo; };
    e.rpc.pedido_extra_eliminar = (b) => { llamadas.push(['eliminar', b]); e.db.pedidos_extraordinarios = e.db.pedidos_extraordinarios.filter((x) => x.id !== b.p_id); };
    const { errores } = await preparar(page, e, { rol: 'ADMIN' });
    await page.evaluate(async () => {
      STATUS = (await supabaseRequest('unitstatus', { action: 'unitstatus' })).data;
      for (let el = document.getElementById('pedidosExtraCard'); el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
      await loadPedidosExtraAdmin();
    });
    const item = (id) => page.locator(`#pedExtraLista li[data-id="${id}"]`);
    await expect(page.locator('#pedExtraLista li')).toHaveCount(4);
    await expect(item('abierto')).toContainText('Abierto');
    await expect(item('abierto')).toContainText('3 unidades lo capturaron');
    await expect(item('abierto')).toContainText('Brote');
    await expect(item('abierto').locator('button[data-accion="cerrar"]')).toBeVisible();
    await expect(item('abierto').locator('button[data-accion="eliminar"]')).toHaveCount(0);        // ya tiene capturas
    await expect(item('futuro')).toContainText('Programado');
    await expect(item('futuro').locator('button[data-accion="eliminar"]')).toBeVisible();          // sin capturas
    await expect(item('vencido')).toContainText('Venció');
    await expect(item('vencido').locator('button[data-accion="reabrir"]')).toBeVisible();
    await expect(item('cerrado')).toContainText('Cerrado');
    // Etiquetas accesibles en los botones
    await expect(item('abierto').locator('button[data-accion="cerrar"]')).toHaveAttribute('aria-label', /Cerrar el pedido extraordinario del 20 oct 2026/);

    // Cerrar
    await item('abierto').locator('button[data-accion="cerrar"]').click();
    await expect.poll(() => llamadas.some((l) => l[0] === 'estado' && l[1].p_id === 'abierto' && l[1].p_activo === false)).toBe(true);
    await expect(item('abierto')).toContainText('Cerrado');
    // Eliminar el que no tiene capturas
    await item('futuro').locator('button[data-accion="eliminar"]').click();
    await expect(item('futuro')).toHaveCount(0);
    // Reabrir un vencido: usa "captura hasta" del formulario (si es futura) o mañana
    await item('vencido').locator('button[data-accion="reabrir"]').click();
    await expect.poll(() => llamadas.some((l) => l[0] === 'abrir' && l[1].p_fecha === '2026-10-05')).toBe(true);
    const re = llamadas.find((l) => l[0] === 'abrir' && l[1].p_fecha === '2026-10-05')[1];
    expect(re.p_hasta >= '2026-10-20').toBe(true);

    // Abrir uno nuevo desde el formulario
    await page.fill('#pedExtraFecha', '2026-10-30');
    await page.fill('#pedExtraHasta', '2026-10-31');
    await page.fill('#pedExtraMotivo', '  Campaña  ');
    await page.click('#btnSavePedidoExtra');
    await expect.poll(() => llamadas.some((l) => l[0] === 'abrir' && l[1].p_fecha === '2026-10-30')).toBe(true);
    expect(llamadas.find((l) => l[0] === 'abrir' && l[1].p_fecha === '2026-10-30')[1]).toEqual({ p_fecha: '2026-10-30', p_hasta: '2026-10-31', p_motivo: 'Campaña' });
    await expect(page.locator('#pedExtraLista')).toContainText('30 oct 2026');

    // Validaciones del formulario (no llegan a la base)
    const antes = llamadas.length;
    await page.fill('#pedExtraFecha', '2026-10-22');                       // fecha del ordinario
    await page.fill('#pedExtraHasta', '2026-10-23');
    await page.click('#btnSavePedidoExtra');
    await page.fill('#pedExtraFecha', '2026-10-31');                       // hasta < fecha
    await page.fill('#pedExtraHasta', '2026-10-30');
    await page.click('#btnSavePedidoExtra');
    await page.fill('#pedExtraFecha', '');                                 // vacío
    await page.click('#btnSavePedidoExtra');
    await page.waitForTimeout(300);
    expect(llamadas.length).toBe(antes);
    expect(errores).toEqual([]);
  });

  test('exportar: con varios pedidos deja elegir (ordinario por omisión) y exporta SOLO ese pedido', async ({ page }) => {
    const e = estadoBase('2026-10-05');
    e.rpc.bio_pedidos_clasificados = ({ p_anio, p_mes }) => {
      if (p_anio === 2026 && p_mes === 9) return [
        { fecha: '2026-09-22', tipo: 'MENSUAL', unidades: 68, frascos: 13466 },
        { fecha: '2026-09-28', tipo: 'EXTRAORDINARIO', unidades: 1, frascos: 340 }
      ];
      if (p_anio === 2026 && p_mes === 8) return [{ fecha: '2026-08-21', tipo: 'MENSUAL', unidades: 69, frascos: 1 }];
      return [];
    };
    let rangos = [];
    e.rpc.get_export_bio_range_bypass = (b) => { rangos.push(b); return [{ id: 'z', clues: 'QTSSA000830', municipio: 'CORREGIDORA', biologico: 'TD', pedido_frascos: 5, fecha_pedido_programada: b.p_fecha_inicio }]; };
    const { errores } = await preparar(page, e, { rol: 'ADMIN' });
    await page.evaluate(() => {
      const ov = document.getElementById('exportOverlay'); for (let el = ov; el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
      ov.classList.add('show');
      document.getElementById('exportTipo').value = 'BIO';
    });
    await page.evaluate(() => ensureLibsLoaded('exceljs'));
    const elegir = async (anio, mes) => page.evaluate(async ([a, m]) => { document.getElementById('exportYear').value = a; document.getElementById('exportMonth').value = m; document.getElementById('exportMonth').dataset.touched = '1'; await updateExportFechaHint(); }, [anio, mes]);

    await elegir('2026', '09');
    await expect(page.locator('#exportBioExactDateBox')).toBeVisible();
    await expect(page.locator('#exportBioExactDate option')).toHaveCount(2);
    await expect(page.locator('#exportBioExactDate')).toHaveValue('2026-09-22');
    await expect(page.locator('#exportBioExactDate option').nth(0)).toContainText('Ordinario');
    await expect(page.locator('#exportBioExactDate option').nth(1)).toContainText('Extraordinario');
    await expect(page.locator('#exportFechaHint')).toContainText('Se detectaron 2 pedidos');
    await expect(page.locator('label[for="exportBioExactDate"]')).toHaveText(/Pedido a exportar/);

    await elegir('2026', '08');                                          // un solo pedido: sin selector
    await expect(page.locator('#exportBioExactDateBox')).toBeHidden();
    await expect(page.locator('#exportFechaHint')).toContainText('Un solo pedido');
    await elegir('2026', '07');                                          // ninguno
    await expect(page.locator('#exportBioExactDateBox')).toBeHidden();
    await expect(page.locator('#exportFechaHint')).toContainText('No se encontraron');

    // Carrera: se cambia de mes mientras el anterior aún carga -> gana el último
    e.rpc.bio_pedidos_clasificados = async ({ p_mes }) => { await new Promise((r) => setTimeout(r, p_mes === 9 ? 600 : 50)); return p_mes === 9 ? [{ fecha: '2026-09-22', tipo: 'MENSUAL', unidades: 1, frascos: 1 }, { fecha: '2026-09-28', tipo: 'EXTRAORDINARIO', unidades: 1, frascos: 1 }] : [{ fecha: '2026-08-21', tipo: 'MENSUAL', unidades: 1, frascos: 1 }]; };
    await page.evaluate(() => { document.getElementById('exportYear').value = '2026'; document.getElementById('exportMonth').value = '09'; updateExportFechaHint(); });
    await page.evaluate(async () => { document.getElementById('exportMonth').value = '08'; await updateExportFechaHint(); });
    await page.waitForTimeout(900);
    await expect(page.locator('#exportBioExactDate option')).toHaveCount(1);
    await expect(page.locator('#exportBioExactDate')).toHaveValue('2026-08-21');

    // Exportar el extraordinario: rango = esa fecha exacta; nombre y encabezado lo marcan
    e.rpc.bio_pedidos_clasificados = ({ p_mes }) => (p_mes === 9 ? [
      { fecha: '2026-09-22', tipo: 'MENSUAL', unidades: 68, frascos: 13466 }, { fecha: '2026-09-28', tipo: 'EXTRAORDINARIO', unidades: 1, frascos: 340 }] : []);
    await elegir('2026', '09');
    await page.selectOption('#exportBioExactDate', '2026-09-28');
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#btnDoExport')]);
    expect(rangos.pop()).toEqual({ p_fecha_inicio: '2026-09-28', p_fecha_fin: '2026-09-28' });
    expect(descarga.suggestedFilename()).toMatch(/^Pedido de biologico Septiembre 2026 EXTRAORDINARIO 28/);
    const ExcelJS = require('exceljs');
    const leer = async (d) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(await d.path()); const textos = []; wb.worksheets[0].eachRow((row) => row.eachCell((c) => { if (typeof c.value === 'string') textos.push(c.value); })); return textos; };
    expect((await leer(descarga)).some((t) => t === 'FECHA PEDIDO: 2026-09-28 (EXTRAORDINARIO)')).toBe(true);
    expect(errores).toEqual([]);

    // Exportar el ordinario: sin marca (el export cierra el diálogo; se vuelve a abrir)
    await page.evaluate(() => document.getElementById('exportOverlay').classList.add('show'));
    await elegir('2026', '09');
    const [d2] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#btnDoExport')]);
    expect(rangos.pop()).toEqual({ p_fecha_inicio: '2026-09-22', p_fecha_fin: '2026-09-22' });
    expect(d2.suggestedFilename()).not.toContain('EXTRAORDINARIO');
    const t2 = await leer(d2);
    expect(t2.some((t) => t === 'FECHA PEDIDO: 2026-09-22')).toBe(true);
    expect(t2.some((t) => /EXTRAORDINARIO/.test(t))).toBe(false);
    expect(errores).toEqual([]);
  });
});
