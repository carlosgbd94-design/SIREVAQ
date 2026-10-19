// Armador de la ruta de Pinol (Guía de Ruta) y ayudas inteligentes del panel de Pinol.
//  1) Cálculo puro (Node): prioridad, sugerencia, orden, totales, HTML de la guía y ayudas de la unidad.
//  2) Panel ADMIN sobre index.html con PostgREST simulado: la ruta empieza VACÍA, solo se imprime/surte lo elegido,
//     cantidades por unidad, orden, candado contra surtir dos veces y avisos de rezago.
//  3) Panel de la UNIDAD: botellas sugeridas, tope de 4 e historial.
const { test, expect } = require('@playwright/test');
const PR = require('../pinol_ruta.js');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;
const HOY = '2026-10-18';

const fila = (id, estatus, extra = {}) => ({
  id, clues: 'C-' + id, unidad: 'UNIDAD ' + id.toUpperCase(), municipio: 'QUERETARO', estatus,
  timestamp_solicitud: '2026-10-10T16:00:00+00:00',
  solicitud_botellas: 2, existencia_actual_botellas: 2, capturado_por: 'ANA', fecha_entrega: null, ...extra
});
// listPinol entrega fecha_solicitud como el timestamp de la solicitud; la base la guarda igual en timestamp_solicitud
const conFecha = (f) => ({ ...f, fecha_solicitud: f.timestamp_solicitud });
const lote = () => [
  fila('p1', 'PENDIENTE', { existencia_actual_botellas: 0, solicitud_botellas: 3, timestamp_solicitud: '2026-10-05T16:00:00+00:00' }),
  fila('p2', 'PENDIENTE', { municipio: 'CORREGIDORA', existencia_actual_botellas: 2, solicitud_botellas: 4, timestamp_solicitud: '2026-10-17T16:00:00+00:00' }),
  fila('p3', 'PENDIENTE', { municipio: 'CORREGIDORA', existencia_actual_botellas: 1, solicitud_botellas: 2, timestamp_solicitud: '2026-10-08T16:00:00+00:00' }),
  fila('p4', 'PENDIENTE', { municipio: 'HUIMILPAN', existencia_actual_botellas: 3, solicitud_botellas: 1, timestamp_solicitud: '2026-10-18T10:00:00+00:00' }),
  fila('p5', 'ENTREGADO', { fecha_entrega: '2026-10-10', timestamp_solicitud: '2026-10-06T16:00:00+00:00' }),
  fila('p6', 'RECIBIDO', { fecha_entrega: '2026-09-02', timestamp_solicitud: '2026-08-30T16:00:00+00:00' })
];

/* ───────────────────────────── 1) cálculo puro ───────────────────────────── */
test.describe('Ruta de Pinol: cálculo', () => {
  const items = lote().map(conFecha);

  test('espera, sin confirmar y críticas', () => {
    expect(PR.esperaDias(items[0], HOY)).toBe(13);
    expect(PR.esperaDias(items[3], HOY)).toBe(0);
    expect(PR.esperaDias(items[4], HOY)).toBe(null);            // ya no está pendiente
    expect(PR.sinConfirmarDias(items[4], HOY)).toBe(8);
    expect(PR.esCritica(items[0])).toBe(true);
    expect(PR.esCritica(items[2])).toBe(false);
    expect(PR.resumenAlertas(items, HOY)).toEqual({ rezago: 2, sinConfirmar: 1, criticas: 1 });
  });

  test('sugerir ruta: sin existencia o 7+ días, nada más', () => {
    expect(PR.sugerirRuta(items, HOY).sort()).toEqual(['p1', 'p3']);
    expect(PR.sugerirRuta(items, HOY, 14)).toEqual(['p1']);     // p1 es crítica
  });

  test('orden por municipio, críticas y antigüedad; totales por cantidad elegida', () => {
    const o = PR.ordenarParadas(items.filter((x) => x.estatus === 'PENDIENTE'), HOY).map((x) => x.id);
    expect(o).toEqual(['p3', 'p2', 'p4', 'p1']);                 // CORREGIDORA (p3 más antigua), HUIMILPAN, QUERETARO
    expect(PR.cantidadInicial({ solicitud_botellas: 9 })).toBe(4);
    expect(PR.cantidadInicial({ solicitud_botellas: 0 })).toBe(4);
    expect(PR.totales([items[0], items[2]], { p1: 3, p3: 1 })).toEqual({ paradas: 2, botellas: 4, litros: 3.3 });
  });

  test('guía impresa: municipios de TODAS las paradas, subtotales y solo lo elegido', () => {
    const html = PR.htmlGuia([items[2], items[0]], { fecha: HOY, responsable: 'ANA PÉREZ', vehiculo: 'Camioneta 3', cantidades: { p3: 2, p1: 3 }, logos: {} });
    expect(html).toContain('CORREGIDORA, QUERETARO');
    expect(html).toContain('UNIDAD P3');
    expect(html).toContain('UNIDAD P1');
    expect(html).not.toContain('UNIDAD P2');
    expect(html).toContain('18 DE OCTUBRE DE 2026');
    expect(html).toContain('ANA PÉREZ');
    expect(html).toContain('TOTAL DE LA RUTA');
    expect(html).toContain('5 pz');
    expect(html).toContain('SIN EXISTENCIA');
    expect(html).toContain('CORREGIDORA · 1 unidad(es) · 2 bot');  // subtotal por municipio cuando son varios
  });

  test('ayudas de la unidad: botellas sugeridas y su historial', () => {
    expect(PR.botellasSugeridas(1)).toEqual({ n: 3, aviso: '' });
    expect(PR.botellasSugeridas(0)).toEqual({ n: 4, aviso: '' });
    expect(PR.botellasSugeridas(4).n).toBe(null);
    expect(PR.botellasSugeridas(4).aviso).toContain('tope');
    expect(PR.botellasSugeridas('')).toEqual({ n: null, aviso: '' });
    const h = PR.resumenHistorialUnidad([
      { clues: 'X', estatus: 'RECIBIDO', fecha_solicitud: '2026-09-01T10:00:00+00:00', fecha_entrega: '2026-09-07', solicitud_botellas: 3 },
      { clues: 'X', estatus: 'RECIBIDO', fecha_solicitud: '2026-08-01T10:00:00+00:00', fecha_entrega: '2026-08-03', solicitud_botellas: 2 },
      { clues: 'Y', estatus: 'RECIBIDO', fecha_solicitud: '2026-09-20T10:00:00+00:00', fecha_entrega: '2026-09-21', solicitud_botellas: 1 }
    ], 'X', HOY);
    expect(h.ultimo).toMatchObject({ entrega: '2026-09-07', botellas: 3, haceDias: 41 });
    expect(h.promEspera).toBe(4);                                 // (6 + 2) / 2
    expect(h.n).toBe(2);
    expect(PR.resumenHistorialUnidad([], 'X', HOY)).toEqual({ ultimo: null, promEspera: null, n: 0 });
  });
});

/* ───────────────────────────── 2) panel con PostgREST simulado ───────────────────────────── */
function creaServidor(estado) {
  const reqs = [];
  const tabla = (n) => (estado.db[n] = estado.db[n] || []);
  const cond = (col, op, val) => {
    if (op === 'eq') return (r) => String(r[col]) === val;
    if (op === 'is') return (r) => (val === 'null' ? r[col] == null : String(r[col]) === val);
    if (op === 'in') { const l = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')); return (r) => l.includes(r[col] == null ? 'null' : String(r[col])); }
    return () => true;
  };
  const filtros = (url) => {
    const fns = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const m = v.match(/^(eq|in|is)\.(.*)$/s);
      if (m) fns.push(cond(k, m[1], m[2]));
    }
    return (r) => fns.every((f) => f(r));
  };
  return {
    reqs,
    async manejar(route) {
      const req = route.request(); const url = new URL(req.url()); const m = req.method();
      const accept = req.headers()['accept'] || ''; const prefer = req.headers()['prefer'] || '';
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
      if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
      const nombre = url.pathname.replace('/rest/v1/', '');
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ }
      reqs.push({ m, nombre, q: url.search, body });
      if (nombre.startsWith('rpc/')) return json(200, null);
      const filas = tabla(nombre); const pasa = filtros(url);
      if (m === 'GET' || m === 'HEAD') {
        let out = filas.filter(pasa);
        const ord = url.searchParams.get('order');
        if (ord) { const [c, d] = ord.split('.'); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
        if (accept.includes('vnd.pgrst.object')) return out.length === 1 ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'sin fila' });
        return json(200, out);
      }
      if (m === 'POST') { (Array.isArray(body) ? body : [body]).forEach((r) => filas.push({ ...r })); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (m === 'PATCH') { const t = filas.filter(pasa); t.forEach((r) => Object.assign(r, body)); return prefer.includes('return=representation') ? json(200, t) : route.fulfill({ status: 204 }); }
      if (m === 'DELETE') { estado.db[nombre] = filas.filter((r) => !pasa(r)); return route.fulfill({ status: 204 }); }
      return json(200, []);
    }
  };
}

async function preparar(page, rol, filas, usuario = {}) {
  const estado = { db: { pinol_solicitudes: filas.map((f) => ({ ...f })), notificaciones: [], notificaciones_perfil: [] }, rpc: {} };
  const srv = creaServidor(estado);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate(({ rol, usuario }) => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol, usuario: 'tester', nombre: 'Tester', clues: 'C-u', unidad: 'UNIDAD U', municipio: 'QUERETARO', municipiosAllowed: rol === 'ADMIN' ? ['*'] : ['QUERETARO'], ...usuario };
    TOKEN = 'token-prueba';
    AppState.rol = rol;
    STATUS = { today: '2026-10-18' };
    window.__abiertas = [];
    window.open = () => { const w = { document: { write: (h) => window.__abiertas.push(h), close() {} }, focus() {}, print() {}, close() {} }; return w; };
    window.showConfirmDialog = async () => true;
  }, { rol, usuario });
  return { estado, srv, errores };
}
const mostrar = (page, id) => page.evaluate((i) => { for (let el = document.getElementById(i); el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; } }, id);

test.describe('Panel de Pinol (ADMIN): armar la ruta', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('la ruta empieza vacía, no imprime nada sin elegir y avisa del rezago en la tabla', async ({ page }) => {
    const { errores } = await preparar(page, 'ADMIN', lote());
    await mostrar(page, 'pinolTbody');
    await page.evaluate(() => refreshPinol());
    await expect(page.locator('#pinolTbody')).toContainText('hace 13 d');
    await expect(page.locator('#pinolTbody')).toContainText('sin confirmar hace 8 d');
    await expect(page.locator('#pinolAlertMsg')).toContainText('2</b> llevan 7+ días'.replace('</b>', ''));
    // pendientes: la sin existencia primero y luego la que más lleva esperando
    const unidades = await page.locator('#pinolTbody tr').evaluateAll((trs) => trs.map((t) => (t.querySelector('td:nth-child(4) .font-black')?.innerText || '').split('\n')[0].trim()));
    expect(unidades.slice(0, 4)).toEqual(['UNIDAD P1', 'UNIDAD P3', 'UNIDAD P2', 'UNIDAD P4']);

    await page.locator('#btnPinolPrintGuia').click();
    await expect(page.locator('#pinolRutaOverlay')).toBeVisible();
    await expect(page.locator('#pinolRutaOverlay input[data-pr=sel]:checked')).toHaveCount(0);
    await expect(page.locator('#prImprimir')).toBeDisabled();
    await expect(page.locator('#prSurtir')).toBeDisabled();
    await expect(page.locator('#prLista input[data-pr=sel]')).toHaveCount(4);   // solo las pendientes
    expect(errores).toEqual([]);
  });

  test('sugerir, agregar municipio, cantidades, orden e impresión de SOLO lo elegido', async ({ page }) => {
    const { errores } = await preparar(page, 'ADMIN', lote());
    await page.evaluate(() => refreshPinol());
    await mostrar(page, 'btnPinolPrintGuia');
    await page.locator('#btnPinolPrintGuia').click();
    await page.locator('#pinolRutaOverlay [data-pr=sugerir]').click();
    await expect(page.locator('#prParadas .pr-stop')).toHaveCount(2);
    await expect(page.locator('#prParadas .pr-stop').first()).toContainText('UNIDAD P3'); // CORREGIDORA antes que QUERETARO
    await expect(page.locator('#prResumen')).toContainText('2');
    // agregar todo un municipio y quitar una parada
    await page.locator('#pinolRutaOverlay [data-pr=mun]', { hasText: 'Agregar municipio' }).first().click();
    const n = await page.locator('#prParadas .pr-stop').count();
    expect(n).toBeGreaterThanOrEqual(3);
    // quitar una parada la saca de la ruta y limpiar deja todo vacío para elegir a mano
    await page.locator('#prParadas [data-pr=quitar]').first().click();
    await expect(page.locator('#prParadas .pr-stop')).toHaveCount(n - 1);
    await page.locator('#pinolRutaOverlay [data-pr=limpiar]').click();
    await expect(page.locator('#prParadas .pr-stop')).toHaveCount(0);
    await page.locator('#prLista input[data-id=p1]').check();
    await page.locator('#prLista input[data-id=p3]').check();
    await page.locator('#prParadas input[data-pr=qty][data-id=p1]').fill('9');          // se acota a 4
    await expect(page.locator('#prParadas input[data-pr=qty][data-id=p1]')).toHaveValue('4');
    await page.locator('#prParadas input[data-pr=qty][data-id=p1]').fill('3');
    await page.locator('#prParadas [data-pr=bajar][data-id=p1]').click();
    await expect(page.locator('#prParadas .pr-stop').first()).toContainText('UNIDAD P3');
    await expect(page.locator('#prResumen')).toContainText('5');                          // 3 + 2 botellas
    await page.locator('#prResp').fill('Ana Pérez');
    await page.locator('#prVeh').fill('Camioneta 3');
    await page.locator('#prImprimir').click();
    const html = await page.evaluate(() => window.__abiertas.pop());
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Camioneta 3');
    expect(html).toContain('UNIDAD P1');
    expect(html).toContain('UNIDAD P3');
    expect(html).not.toContain('UNIDAD P2');
    expect(html).not.toContain('UNIDAD P4');
    expect(html.indexOf('UNIDAD P3')).toBeLessThan(html.indexOf('UNIDAD P1')); // respeta el orden que se le dio a la ruta
    expect(html).toContain('QUERETARO');
    expect(html).toContain('CORREGIDORA');
    expect(errores).toEqual([]);
  });

  test('imprimir y marcar en tránsito: una actualización por cantidad, solo las pendientes elegidas', async ({ page }) => {
    const { estado, srv, errores } = await preparar(page, 'ADMIN', lote());
    await page.evaluate(() => refreshPinol());
    await mostrar(page, 'btnPinolPrintGuia');
    await page.locator('#btnPinolPrintGuia').click();
    await page.locator('#prLista input[data-id=p1]').check();
    await page.locator('#prLista input[data-id=p3]').check();
    // p1 pide 3 y p3 pide 2: salen dos actualizaciones distintas
    await page.locator('#prResp').fill('Ana Pérez');
    // mientras tanto otra persona ya surtió p3: no se debe volver a surtir
    estado.db.pinol_solicitudes.find((r) => r.id === 'p3').estatus = 'ENTREGADO';
    await page.locator('#prSurtir').click();
    await expect(page.locator('#pinolRutaOverlay')).toBeHidden();
    const patches = srv.reqs.filter((r) => r.m === 'PATCH' && r.nombre === 'pinol_solicitudes');
    expect(patches).toHaveLength(2);
    patches.forEach((p) => { expect(p.q).toContain('estatus=eq.PENDIENTE'); expect(p.body.estatus).toBe('ENTREGADO'); expect(p.body.entregado_por).toBe('Ana Pérez'); });
    expect(patches.map((p) => p.body.cantidad_entregada).sort()).toEqual([2, 3]);
    const por = (id) => estado.db.pinol_solicitudes.find((r) => r.id === id);
    expect(por('p1').estatus).toBe('ENTREGADO');
    expect(por('p1').cantidad_entregada).toBe(3);
    expect(por('p3').cantidad_entregada).toBeUndefined();        // no se tocó: ya estaba surtida
    expect(por('p2').estatus).toBe('PENDIENTE');                  // las no elegidas siguen pendientes
    expect(por('p4').estatus).toBe('PENDIENTE');
    expect((await page.evaluate(() => window.__abiertas.length))).toBe(1);
    expect(errores).toEqual([]);
  });

  test("sin CSS.escape (error de Sentry): marcar, desmarcar, reordenar e imprimir siguen funcionando", async ({ page }) => {
    const { errores } = await preparar(page, "ADMIN", lote());
    await page.evaluate(() => { try { delete CSS.escape; } catch (e) {} if (CSS.escape) CSS.escape = undefined; });
    await page.evaluate(() => refreshPinol());
    await mostrar(page, "btnPinolPrintGuia");
    await page.locator("#btnPinolPrintGuia").click();
    await page.locator("#prLista input[data-id=p1]").check();
    await page.locator("#prLista input[data-id=p3]").check();
    await page.locator("#prLista input[data-id=p1]").uncheck();
    await page.locator("#prLista input[data-id=p1]").check();
    await page.locator("#prParadas [data-pr=bajar][data-id=p3]").click();
    await page.locator("#prParadas [data-pr=subir][data-id=p3]").click();
    await page.locator("#prResp").fill("Ana Pérez");
    await page.locator("#prImprimir").click();
    const html = await page.evaluate(() => window.__abiertas.pop());
    expect(html).toContain("UNIDAD P1");
    expect(html).toContain("UNIDAD P3");
    expect(errores).toEqual([]);
  });

  test('accesibilidad del armador (axe)', async ({ page }) => {
    const fs = require('fs'); const path = require('path');
    const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
    await preparar(page, 'ADMIN', lote());
    await page.evaluate(() => refreshPinol());
    await mostrar(page, 'btnPinolPrintGuia');
    await page.addScriptTag({ content: AXE });
    await page.locator('#btnPinolPrintGuia').click();
    await page.locator('#pinolRutaOverlay [data-pr=sugerir]').click();
    const v = await page.evaluate(async () => (await window.axe.run('#pinolRutaOverlay', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0] ? n.any[0].message : '')).slice(0, 2).join(' | ')}`));
    expect(v).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#pinolRutaOverlay')).toBeHidden();
  });
});

test.describe('Panel de Pinol (UNIDAD): ayudas', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const mias = () => [
    { id: 'h1', clues: 'C-u', unidad: 'UNIDAD U', municipio: 'QUERETARO', estatus: 'RECIBIDO', timestamp_solicitud: '2026-09-01T10:00:00+00:00', fecha_solicitud: '2026-09-01', fecha_entrega: '2026-09-07', solicitud_botellas: 3, existencia_actual_botellas: 1 }
  ];
  async function abrirFormulario(page, filas) {
    const r = await preparar(page, 'UNIDAD', filas);
    await page.evaluate(async () => {
      AppState.mainPanel = 'CAP'; AppState.captureTab = 'PINOL';
      const f = document.getElementById('formPINOL'); f.style.display = 'block';
      for (let el = f; el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
      await listPinol(true); applyPinolFormLock();
    });
    return r;
  }

  test('muestra su último Pinol y cuánto suele tardar el municipio', async ({ page }) => {
    const { errores } = await abrirFormulario(page, mias());
    const info = page.locator('#pinolInfoUnidad');
    await expect(info).toBeVisible();
    await expect(info).toContainText('hace 41 días');
    await expect(info).toContainText('unos 6 días');
    expect(errores).toEqual([]);
  });

  test('sugiere botellas según su existencia y no deja pedir más de 4', async ({ page }) => {
    const { srv, errores } = await abrirFormulario(page, mias());
    await page.locator('#pinol_existencia').fill('1');
    const sug = page.locator('#pinolSugerirBtn');
    await expect(sug).toBeVisible();
    await expect(sug).toContainText('Sugerido: 3 botellas');
    await sug.click();
    await expect(page.locator('#pinol_solicitud')).toHaveValue('3');
    await page.locator('#pinol_existencia').fill('5');
    await expect(sug).toBeHidden();
    await expect(page.locator('#pinolSugerirAviso')).toContainText('tope');
    // pedir 6 se rechaza antes de enviar
    await page.locator('#nombrePINOL').fill('Ana');
    await page.locator('#pinol_solicitud').fill('6');
    await page.evaluate(() => document.getElementById('btnSavePINOL').click());
    await expect(page.locator('body')).toContainText('hasta 4 botellas');
    expect(srv.reqs.filter((r) => r.m === 'POST' && r.nombre === 'pinol_solicitudes')).toHaveLength(0);
    expect(errores).toEqual([]);
  });
});
