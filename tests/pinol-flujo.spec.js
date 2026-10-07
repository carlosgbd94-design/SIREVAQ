// Flujo de solicitud de Pinol (candado + avisos + confirmación de recepción) sobre el index.html y el
// mobile.html reales. Sin sesión real: Supabase se intercepta en la red con un PostgREST simulado en
// memoria. Se verifica lo que ve la unidad (aviso, pasos, botón de confirmar, hub bloqueado con su
// explicación) y las PETICIONES que salen (PATCH a RECIBIDO acotado por id, clues y estatus).
// El candado del servidor (trigger trg_pinol_reject_duplicate_active) se prueba contra la base real.
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate/i;
const CLUES = 'QTSSA001921';

function creaServidor(estado) {
  const reqs = [];
  const tabla = (n) => (estado.db[n] = estado.db[n] || []);
  const cond = (col, op, val) => {
    if (op === 'eq') return (r) => String(r[col]) === val;
    if (op === 'is') return (r) => (val === 'null' ? r[col] == null : String(r[col]) === val);
    if (op === 'in') {
      const lista = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      return (r) => lista.includes(r[col] == null ? 'null' : String(r[col]));
    }
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
      const req = route.request();
      const url = new URL(req.url());
      const m = req.method();
      const accept = req.headers()['accept'] || '';
      const prefer = req.headers()['prefer'] || '';
      const json = (status, body, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*', ...extra }, body: JSON.stringify(body) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
      if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
      const nombre = url.pathname.replace('/rest/v1/', '');
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ }
      reqs.push({ m, nombre, q: url.search, body });

      if (nombre.startsWith('rpc/')) {
        const h = estado.rpc[nombre.slice(4)];
        if (!h) return json(200, null);
        const out = await h(body || {}, estado);
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
      if (m === 'POST') {
        // Candado del servidor simulado: ya hay una solicitud PENDIENTE/ENTREGADO de esa CLUES
        if (nombre === 'pinol_solicitudes' && estado.rechazarDuplicados) {
          const nueva = Array.isArray(body) ? body[0] : body;
          if (filas.some((r) => r.clues === nueva.clues && ['PENDIENTE', 'ENTREGADO'].includes(r.estatus))) {
            return json(409, { code: '23505', message: `Ya existe una solicitud de Pinol activa para esta unidad (CLUES ${nueva.clues}). Debe completarse y confirmarse como recibida antes de crear una nueva.` });
          }
        }
        const rows = Array.isArray(body) ? body : [body]; rows.forEach((r) => filas.push({ ...r }));
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      if (m === 'PATCH') {
        const tocadas = filas.filter(pasa);
        tocadas.forEach((r) => Object.assign(r, body));
        if (prefer.includes('return=representation')) return json(200, tocadas);
        return route.fulfill({ status: 204 });
      }
      if (m === 'DELETE') { estado.db[nombre] = filas.filter((r) => !pasa(r)); return route.fulfill({ status: 204 }); }
      return json(200, []);
    }
  };
}

const fila = (id, estatus, extra = {}) => ({
  id, clues: CLUES, unidad: 'PIE DE GALLO', municipio: 'QUERETARO', estatus,
  timestamp_solicitud: '2026-08-20T16:57:10.389+00:00', fecha_solicitud: '2026-08-20',
  solicitud_botellas: 2, existencia_actual_botellas: 3, capturado_por: 'ANA', fecha_entrega: null, ...extra
});

async function prepararEscritorio(page, filas, { rechazarDuplicados = false } = {}) {
  const estado = { db: { pinol_solicitudes: filas, notificaciones: [], notificaciones_perfil: [] }, rpc: {}, rechazarDuplicados };
  const srv = creaServidor(estado);
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate(async () => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: 'UNIDAD', usuario: 'ana', nombre: 'Ana', clues: 'QTSSA001921', unidad: 'PIE DE GALLO', municipio: 'QUERETARO', municipiosAllowed: ['QUERETARO'] };
    TOKEN = 'token-prueba';
    AppState.mainPanel = 'CAP'; AppState.captureTab = 'PINOL';
    const f = document.getElementById('formPINOL'); f.style.display = 'block';
    for (let el = f; el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
  });
  return { estado, srv, errores };
}

// Refresca la lista y reaplica candado + hub, igual que el realtime o un guardado
const refrescar = (page) => page.evaluate(async () => { await listPinol(true); applyPinolFormLock(); syncCommandHub(); });

test.describe('Pinol: candado y avisos (escritorio)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sin solicitud activa: formulario libre, regla visible y hub habilitado', async ({ page }) => {
    const { errores } = await prepararEscritorio(page, [fila('p0', 'RECIBIDO')]);
    await refrescar(page);
    await expect(page.locator('#pinolFlowBanner')).toBeHidden();
    await expect(page.locator('#pinolRuleNote')).toBeVisible();
    await expect(page.locator('#pinolRuleNote')).toContainText('confirma la recepción');
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('#pinol_solicitud')).toBeEnabled();
    expect(errores).toEqual([]);
  });

  test('ENTREGADO sin confirmar: aviso con pasos y botón de confirmar, formulario y hub bloqueados con explicación', async ({ page }) => {
    const { errores } = await prepararEscritorio(page, [fila('p1', 'ENTREGADO', { fecha_entrega: '2026-10-06' })]);
    await refrescar(page);
    const banner = page.locator('#pinolFlowBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('role', 'status');
    await expect(banner).toContainText('Confirma que recibiste tu Pinol para poder pedir más');
    await expect(banner.locator('.cp-step')).toHaveCount(4);
    await expect(banner.locator('.cp-step.done')).toHaveCount(2);
    await expect(banner.locator('.cp-step.current')).toHaveAttribute('aria-current', 'step');
    await expect(banner.locator('#btnPinolConfirmarRecepcion')).toBeVisible();
    await expect(page.locator('#pinolRuleNote')).toBeHidden();
    await expect(page.locator('#pinol_solicitud')).toBeDisabled();
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#hubStatusText')).toHaveText('Confirma recepción');
    // El botón bloqueado sigue siendo clicable para explicar el motivo (antes no decía nada)
    await page.locator('#hubSaveBtn').click({ force: true });
    await expect(page.locator('.toast-new').last()).toContainText('Aún no confirmas la recepción de tu Pinol anterior');
    expect(errores).toEqual([]);
  });

  test('PENDIENTE: aviso "en curso" sin botón de confirmar', async ({ page }) => {
    const { errores } = await prepararEscritorio(page, [fila('p2', 'PENDIENTE')]);
    await refrescar(page);
    const banner = page.locator('#pinolFlowBanner');
    await expect(banner).toContainText('Tu solicitud de Pinol está en curso');
    await expect(banner).toContainText('Pediste 2 botellas');
    await expect(banner.locator('#btnPinolConfirmarRecepcion')).toHaveCount(0);
    await expect(banner.locator('.cp-step.done')).toHaveCount(1);
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#hubSaveBtn').click({ force: true });
    await expect(page.locator('.toast-new').last()).toContainText('solicitud de Pinol en curso');
    expect(errores).toEqual([]);
  });

  test('confirmar recepción desde el aviso: PATCH a RECIBIDO acotado y el formulario se vuelve a habilitar', async ({ page }) => {
    const { estado, srv, errores } = await prepararEscritorio(page, [fila('p3', 'ENTREGADO', { fecha_entrega: '2026-10-06' })]);
    await refrescar(page);
    await page.locator('#btnPinolConfirmarRecepcion').click();
    await page.locator('#btnGenericConfirmAccept').click();
    await expect(page.locator('#pinolFlowBanner')).toBeHidden({ timeout: 10000 });
    const patch = srv.reqs.filter((r) => r.nombre === 'pinol_solicitudes' && r.m === 'PATCH')[0];
    expect(patch.body.estatus).toBe('RECIBIDO');
    expect(patch.q).toContain('id=eq.p3');
    expect(patch.q).toContain(`clues=eq.${CLUES}`);
    expect(patch.q).toContain('estatus=eq.ENTREGADO');
    expect(estado.db.pinol_solicitudes[0].estatus).toBe('RECIBIDO');
    await expect(page.locator('#pinolRuleNote')).toBeVisible();
    await expect(page.locator('#pinol_solicitud')).toBeEnabled();
    await expect(page.locator('#hubSaveBtn')).toHaveAttribute('aria-disabled', 'false');
    expect(errores).toEqual([]);
  });

  test('cancelar el cuadro de confirmación no cambia nada', async ({ page }) => {
    const { srv, errores } = await prepararEscritorio(page, [fila('p4', 'ENTREGADO')]);
    await refrescar(page);
    await page.locator('#btnPinolConfirmarRecepcion').click();
    await page.locator('#btnGenericConfirmCancel').click();
    await expect(page.locator('#pinolFlowBanner')).toBeVisible();
    expect(srv.reqs.filter((r) => r.nombre === 'pinol_solicitudes' && r.m === 'PATCH')).toHaveLength(0);
    expect(errores).toEqual([]);
  });

  test('si el servidor rechaza la solicitud por el candado, la unidad ve un mensaje claro (no el error técnico)', async ({ page }) => {
    // La caché local aún cree que no hay nada activo (otro dispositivo creó la solicitud)
    const { errores } = await prepararEscritorio(page, [fila('p5', 'PENDIENTE')], { rechazarDuplicados: true });
    const res = await page.evaluate(async () => {
      try { return await supabaseRequest('savepinol', { action: 'savepinol', nombre: 'Ana', solicitud_botellas: 1, existencia_actual_botellas: 0 }); } catch (e) { return { ok: false, error: e.message }; }
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Aún tienes una solicitud de Pinol sin confirmar');
    expect(res.error).not.toContain('23505');
    expect(errores.filter((e) => !/Capture Error|AppService|savepinol|supabaseRequest/i.test(e))).toEqual([]);
  });

  test('guardar con candado activo no envía nada al servidor', async ({ page }) => {
    const { srv } = await prepararEscritorio(page, [fila('p6', 'ENTREGADO')]);
    await refrescar(page);
    await page.evaluate(() => { document.getElementById('nombrePINOL').value = 'Ana'; document.getElementById('pinol_solicitud').value = '2'; });
    // El botón oculto queda disabled con el candado; el manejador se invoca directo (como la cola offline o un clic forzado)
    await page.evaluate(() => document.getElementById('btnSavePINOL').onclick());
    await expect(page.locator('.toast-new').last()).toContainText('Aún no confirmas la recepción');
    expect(srv.reqs.filter((r) => r.nombre === 'pinol_solicitudes' && r.m === 'POST')).toHaveLength(0);
  });
});

test.describe('Pinol: paneles rediseñados (escritorio)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('los cuatro paneles conservan sus ids, etiquetas asociadas y encabezado accesible', async ({ page }) => {
    await prepararEscritorio(page, []);
    const r = await page.evaluate(() => {
      const ids = ['nombreSR', 'srCaptureTbody', 'btnAddSRRow', 'chkSinMovimientoSR', 'cardSinMovimientoSR', 'nombreCONS', 'srp_dosis', 'sr_dosis',
        'jeringa_aplic_05ml_0605502657', 'jeringa_reconst_5ml_0605500438', 'aguja_0600403711', 'chkSinMovimientoCONS', 'nombreBIO', 'fechaPedidoBIOBox', 'bioHint',
        'fechaPedidoBIO', 'chkNoPedido', 'cardNoPedido', 'bioModoBox', 'bioDayAlert', 'bioTbody', 'nombrePINOL', 'pinol_existencia', 'pinol_solicitud',
        'pinol_observaciones', 'btnSavePINOL', 'pinolFlowBanner', 'pinolRuleNote'];
      const faltan = ids.filter((id) => !document.getElementById(id));
      const sinEtiqueta = ['srp_dosis', 'sr_dosis', 'jeringa_aplic_05ml_0605502657', 'jeringa_reconst_5ml_0605500438', 'aguja_0600403711', 'nombreSR', 'nombreCONS', 'nombreBIO',
        'nombrePINOL', 'pinol_existencia', 'pinol_solicitud', 'pinol_observaciones', 'chkSinMovimientoSR', 'chkSinMovimientoCONS', 'chkNoPedido']
        .filter((id) => { const el = document.getElementById(id); return !(document.querySelector(`label[for="${id}"]`) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')); });
      const regiones = ['formSR', 'formCONS', 'formBIO', 'formPINOL'].filter((id) => { const el = document.getElementById(id); return el.getAttribute('role') !== 'region' || !document.getElementById(el.getAttribute('aria-labelledby')); });
      return { faltan, sinEtiqueta, regiones };
    });
    expect(r).toEqual({ faltan: [], sinEtiqueta: [], regiones: [] });
  });
});


test.describe('Paneles de captura: ayuda y regla de Solo existencias', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  const PANELES = [
    ['formSR', 'cap_sr', 'Existencia de biológicos'],
    ['formCONS', 'cap_cons', 'Insumos y consumibles'],
    ['formBIO', 'cap_bio', 'Pedido de biológico'],
    ['formPINOL', 'cap_pinol', 'Solicitud de Pinol']
  ];

  for (const [form, clave, titulo] of PANELES) {
    test(`${form}: el botón «¿Cómo funciona?» abre la ayuda "${titulo}" y Escape la cierra`, async ({ page }) => {
      const { errores } = await prepararEscritorio(page, []);
      await page.evaluate((id) => { const f = document.getElementById(id); f.style.display = 'block'; }, form);
      const boton = page.locator(`#${form} .cp-help-btn`);
      await expect(boton).toBeVisible();
      await expect(boton).toHaveAttribute('data-ayuda', clave);
      await expect(boton).toHaveAttribute('aria-label', /Cómo funciona el panel de/);
      await boton.click();
      await expect(page.locator('#ayudaOverlay')).toHaveClass(/abierto/);
      await expect(page.locator('#ayudaTitulo')).toHaveText(titulo);
      expect(await page.locator('#ayudaCuerpo .ayuda-paso').count()).toBeGreaterThan(2);
      await page.keyboard.press('Escape');
      await expect(page.locator('#ayudaOverlay')).not.toHaveClass(/abierto/);
      expect(errores).toEqual([]);
    });
  }

  test('Pedido: la nota de «Solo existencias» queda separada del interruptor (no se encima)', async ({ page }) => {
    await prepararEscritorio(page, []);
    await page.evaluate(() => { document.getElementById('formBIO').style.display = 'block'; });
    const cajas = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const t = r('cardNoPedido'), n = r('bioSinPedidoNote'), i = document.querySelector('#formBIO .cp-grid2 .modern-input-group').getBoundingClientRect();
      return { toggleBottom: t.bottom, inputBottom: i.bottom, noteTop: n.top };
    });
    expect(cajas.noteTop - cajas.toggleBottom).toBeGreaterThanOrEqual(12);
    expect(cajas.noteTop - cajas.inputBottom).toBeGreaterThanOrEqual(12);
  });

  test('Pedido: la regla de «Solo existencias» está explicada y aparece en la ayuda', async ({ page }) => {
    await prepararEscritorio(page, []);
    await page.evaluate(() => { document.getElementById('formBIO').style.display = 'block'; });
    await expect(page.locator('#bioSinPedidoNote')).toContainText('mayor o igual a su promedio');
    await page.locator('#formBIO .cp-help-btn').click();
    await expect(page.locator('#ayudaCuerpo')).toContainText('Solo existencias');
    await expect(page.locator('#ayudaCuerpo')).toContainText('no se puede enviar el pedido en ceros');
  });

  test('Pedido: con «Solo existencias» y existencia bajo el promedio el aviso lo dice y bloquea; con existencia suficiente queda correcto', async ({ page }) => {
    await prepararEscritorio(page, []);
    const r = await page.evaluate(() => {
      document.getElementById('formBIO').style.display = 'block';
      renderBioRows([{ biologico: 'TD', existencia_actual_frascos: 3, pedido_frascos: 0, promedio_frascos: 8, min_dosis: 20, max_dosis: 100 }]);
      return new Promise((resolve) => setTimeout(() => {
        const chk = document.getElementById('chkNoPedido'); chk.checked = true;
        const bajo = refreshBioAlerts(true);
        const textoBajo = document.querySelector('#bioAlert_0').innerText;
        document.querySelector('input[data-i="0"][data-kind="existencia"]').value = '9';
        const ok = refreshBioAlerts(true);
        resolve({ bajo: bajo.hasBlockingError, textoBajo, ok: ok.hasBlockingError, textoOk: document.querySelector('#bioAlert_0').innerText });
      }, 100));
    });
    expect(r.bajo).toBe(true);
    expect(r.textoBajo).toContain('Sin pedido: la existencia debe ser de al menos 8 fr. (faltan 5)');
    expect(r.ok).toBe(false);
    expect(r.textoOk).toContain('CORRECTO');
  });
});

// --- Móvil -------------------------------------------------------------------------------------------
test.describe('Pinol: candado y avisos (móvil)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  async function abrirMovil(page, filas, extra = {}) {
    const estado = {
      db: {
        perfiles: [{ id: 'u1', usuario: 'ana', nombre: 'Ana', rol: 'UNIDAD', clues: CLUES, unidad: 'PIE DE GALLO', municipio: 'QUERETARO', activo: 'SI' }],
        pinol_solicitudes: filas, notificaciones: [], notificaciones_perfil: [], biologicos_catalogo: [], biologicos_params: [], pedidos_extraordinarios: [], calendario_pedidos: [],
        ...extra
      },
      rpc: {}
    };
    const srv = creaServidor(estado);
    const errores = [];
    page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
    page.on('dialog', (d) => d.accept());
    await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
    await page.addInitScript(() => {
      localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
        access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
        user: { id: 'u1', email: 'ana@x.mx', user_metadata: {} }
      }));
    });
    await page.goto('/mobile.html', { waitUntil: 'load' });
    await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 20000 });
    await page.click('.dock-item[data-panel="PINOL"]');
    await page.waitForTimeout(800);
    return { estado, srv, errores };
  }

  test('ENTREGADO sin confirmar: aviso con pasos y botón; al confirmar se libera el formulario', async ({ page }) => {
    const { estado, srv, errores } = await abrirMovil(page, [fila('m1', 'ENTREGADO', { fecha_entrega: '2026-10-06' })]);
    const banner = page.locator('#pinolFlowBanner');
    await expect(banner).toContainText('Confirma que recibiste tu Pinol para poder pedir más');
    await expect(banner.locator('.cp-step')).toHaveCount(4);
    await expect(page.locator('#pinolRuleNote')).toBeHidden();
    await expect(page.locator('#pinol_solicitud')).toBeDisabled();
    await page.locator('#btnPinolConfirmarRecepcionMobile').click();
    await expect(banner).toBeHidden({ timeout: 10000 });
    const patch = srv.reqs.filter((r) => r.nombre === 'pinol_solicitudes' && r.m === 'PATCH')[0];
    expect(patch.body.estatus).toBe('RECIBIDO');
    expect(patch.q).toContain('id=eq.m1');
    expect(patch.q).toContain('estatus=eq.ENTREGADO');
    expect(estado.db.pinol_solicitudes[0].estatus).toBe('RECIBIDO');
    await expect(page.locator('#pinolRuleNote')).toBeVisible();
    await expect(page.locator('#pinol_solicitud')).toBeEnabled();
    expect(errores).toEqual([]);
  });

  test('PENDIENTE: aviso "en curso" y sin botón de confirmar', async ({ page }) => {
    const { errores } = await abrirMovil(page, [fila('m2', 'PENDIENTE')]);
    await expect(page.locator('#pinolFlowBanner')).toContainText('Tu solicitud de Pinol está en curso');
    await expect(page.locator('#btnPinolConfirmarRecepcionMobile')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('sin solicitud activa: regla visible y formulario habilitado', async ({ page }) => {
    const { errores } = await abrirMovil(page, [fila('m3', 'RECIBIDO')]);
    await expect(page.locator('#pinolFlowBanner')).toBeHidden();
    await expect(page.locator('#pinolRuleNote')).toBeVisible();
    await expect(page.locator('#pinol_solicitud')).toBeEnabled();
    expect(errores).toEqual([]);
  });

  test('cada panel móvil tiene su botón de ayuda y abre la hoja correcta', async ({ page }) => {
    const { errores } = await abrirMovil(page, [fila('m9', 'RECIBIDO')]);
    for (const [clave, titulo] of [['cap_pinol', 'Solicitud de Pinol'], ['cap_bio', 'Pedido de biológico'], ['cap_cons', 'Insumos y consumibles'], ['cap_sr', 'Existencia de biológicos']]) {
      const panel = { cap_pinol: 'PINOL', cap_bio: 'BIO', cap_cons: 'CONS', cap_sr: 'SR' }[clave];
      await page.click(`.dock-item[data-panel="${panel}"]`);
      await page.waitForTimeout(300);
      const boton = page.locator(`#panel${panel} [data-ayuda="${clave}"]`);
      await expect(boton).toBeVisible();
      await boton.click();
      await expect(page.locator('#ayudaTitulo')).toHaveText(titulo);
      await page.locator('#ayudaCerrarBtn').click();
      await expect(page.locator('#ayudaOverlay')).not.toHaveClass(/abierto/);
    }
    await expect(page.locator('#bioSinPedidoNote')).toContainText('mayor o igual a su promedio');
    expect(errores).toEqual([]);
  });
  test('accesibilidad móvil: nombres accesibles, ids únicos, tamaños mínimos, foco y avisos de cambio de panel', async ({ page }) => {
    const extra = {
      biologicos_catalogo: [{ biologico: 'TD', orden_biologico: 1, id: 'b-td' }, { biologico: 'BCG', orden_biologico: 2, id: 'b-bcg' }],
      biologicos_params: [
        { clues: CLUES, biologico: 'TD', min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' },
        { clues: CLUES, biologico: 'BCG', min_dosis: 0, max_dosis: 100, promedio_frascos: 10, activo: 'SI' }
      ]
    };
    const { errores } = await abrirMovil(page, [fila('a1', 'RECIBIDO')], extra);
    const problemas = [];
    for (const panel of ['SR', 'CONS', 'BIO', 'PINOL']) {
      await page.click(`.dock-item[data-panel="${panel}"]`);
      await page.waitForTimeout(600);
      await expect(page.locator(`.dock-item[data-panel="${panel}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#mpAnnounce')).toContainText('Panel:');
      const r = await page.evaluate((p) => {
        const sec = document.getElementById('panel' + p);
        const visible = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden'; };
        const out = [];
        sec.querySelectorAll('input, select, textarea').forEach((el) => {
          if (!visible(el) || el.type === 'hidden') return;
          const nombre = (el.labels && el.labels.length) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
          if (!nombre) out.push('sin nombre: ' + (el.id || el.className));
        });
        sec.querySelectorAll('button, [role="button"]').forEach((el) => {
          if (!visible(el)) return;
          const nombre = (el.textContent || '').replace(/\s+/g, '').length > 0 ? ((el.getAttribute('aria-label') || el.textContent.trim())) : el.getAttribute('aria-label');
          const soloIcono = el.querySelector('.material-symbols-rounded') && !(el.getAttribute('aria-label'));
          if (!nombre || (soloIcono && el.textContent.trim().length <= 20 && !el.getAttribute('aria-label') && /^[a-z_]+$/.test(el.textContent.trim()))) out.push('botón sin nombre: ' + (el.id || el.className));
          const b = el.getBoundingClientRect();
          if (b.width < 44 || b.height < 44) { if (!el.closest('.hidden')) out.push(`objetivo pequeño ${Math.round(b.width)}x${Math.round(b.height)}: ` + (el.id || el.className)); }
        });
        // Tamaño mínimo de texto (12 px) en el contenido del panel
        const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
        let n; const chicos = new Set();
        while ((n = walker.nextNode())) {
          const t = n.textContent.trim(); if (!t) continue;
          const el = n.parentElement; if (!el || !visible(el) || el.closest('.material-symbols-rounded') || el.classList.contains('material-symbols-rounded')) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 12) chicos.add(Math.round(fs * 10) / 10 + 'px: ' + t.slice(0, 30));
        }
        chicos.forEach((c) => out.push('texto chico ' + c));
        return out;
      }, panel);
      r.forEach((x) => problemas.push(`[${panel}] ${x}`));
    }
    const ids = await page.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach((e) => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter((k) => c[k] > 1); });
    expect(ids).toEqual([]);
    expect(problemas).toEqual([]);
    // Foco visible con teclado en un campo
    await page.click('.dock-item[data-panel="PINOL"]');
    await page.focus('#nombrePINOL');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe('none');
    expect(errores).toEqual([]);
  });
  test('Consumibles móvil: la aguja es igual a la jeringa 5.0 (no depende de SRP ni SR)', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-08T12:00:00'));   // jueves: Consumibles habilitado
    const { errores } = await abrirMovil(page, [fila('c1', 'RECIBIDO')]);
    await page.click('.dock-item[data-panel="CONS"]');
    await page.waitForTimeout(400);
    const aguja = page.locator('#aguja_0600403711');
    await page.locator('#srp_dosis').fill('5');
    await page.locator('#sr_dosis').fill('4');
    await expect(aguja).toHaveValue(/^(0|)$/);
    await page.locator('#jeringa_reconst_5ml_0605500438').fill('7');
    await expect(aguja).toHaveValue('7');
    await page.locator('#jeringa_reconst_5ml_0605500438').fill('2');
    await expect(aguja).toHaveValue('2');
    expect(errores).toEqual([]);
  });
});
