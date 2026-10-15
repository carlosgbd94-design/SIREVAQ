// Móvil de supervisión: Parámetros, Jeringas, Pinol, Enviar aviso y Seguridad (con PostgREST simulado con estado).
const { test, expect } = require('@playwright/test');

const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide|navigator\.vibrate|WebSocket|realtime/i;

const UNIDADES = [
  { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'QTSSA000111', unidad: 'El Pueblito', municipio: 'CORREGIDORA', activo: 'SI' },
  { clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', activo: 'SI' },
  { clues: 'QTSSA000333', unidad: 'FAM Sierra', municipio: 'AMEALCO', activo: 'SI' }
];

function estadoBase(perfil) {
  return {
    db: {
      perfiles: [
        { id: 'u1', usuario: 'sup', nombre: 'Sup', clues: '', unidad: '', municipio: '', activo: 'SI', ...perfil },
        { usuario: 'unidad830', rol: 'UNIDAD', clues: 'QTSSA000830', municipio: 'CORREGIDORA' },
        { usuario: 'unidad111', rol: 'UNIDAD', clues: 'QTSSA000111', municipio: 'CORREGIDORA' },
        { usuario: 'unidad222', rol: 'UNIDAD', clues: 'QTSSA000222', municipio: 'EL MARQUES' },
        { usuario: 'muni_corr', rol: 'MUNICIPAL', municipios_allowed: ['CORREGIDORA'] },
        { usuario: 'admin1', rol: 'ADMIN' }
      ],
      usuarios_legacy: [],
      unidades: UNIDADES,
      biologicos_params: [
        { clues: 'QTSSA000830', biologico: 'BCG', promedio_frascos: 1, min_dosis: 0, max_dosis: 10, multiplo_pedido: 10, updated_by: 'otro', updated_at: '2026-10-01T10:00:00Z' },
        { clues: 'QTSSA000830', biologico: 'VSR', promedio_frascos: 2, min_dosis: 1, max_dosis: 4, multiplo_pedido: 1 }
      ],
      jeringas_params: [],
      pinol_solicitudes: [
        { id: 'p1', clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', estatus: 'PENDIENTE', solicitud_botellas: 4, existencia_actual_botellas: 0, timestamp_solicitud: '2026-10-12T10:00:00Z' },
        { id: 'p2', clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', estatus: 'ENTREGADO', solicitud_botellas: 2, existencia_actual_botellas: 1, timestamp_solicitud: '2026-10-08T10:00:00Z' }
      ],
      aperturas_existencia: [],
      notificaciones: [
        { id: 'NOTIF:PINOL_ENTREGA:p1', target_scope: 'CLUES', target_clues: 'QTSSA000830', target_municipio: 'CORREGIDORA', from_usuario: 'sup', title: 'Pinol entregado' }
      ],
      notificaciones_perfil: []
    },
    rpc: {
      get_audit_findings: [{ severidad: 'alta', categoria: 'unidad_huerfana', clues: 'QTSSA000999', descripcion: 'Sin ficha' }],
      get_rda_max_mes: 10,
      get_rda_indicators: [
        { clues: 'QTSSA000830', unidad: 'Santa Bárbara', municipio: 'CORREGIDORA', pob_menor_1: 100, pob_1_ano: 100, pob_4_anos: 100, bcg_dosis: 400, hexa_ref_dosis: 100, neumo_ref_dosis: 100, srp_2_dosis: 100, dpt_4_dosis: 50, adol_hb: 30, adol_vph: 70, am_neumo13: 12, emb_tdpa: 9, inv_influenza: 40, inv_covid: 10, varicela: 5, hepatitis_a: 3 },
        { clues: 'QTSSA000222', unidad: 'La Cañada', municipio: 'EL MARQUES', pob_menor_1: 50, pob_1_ano: 50, pob_4_anos: 50, bcg_dosis: 10, adol_hb: 10, adol_vph: 5 }
      ],
      get_rda_abandono_esquema: [
        { clues: 'QTSSA000830', nombre: 'Santa Bárbara', municipio: 'CORREGIDORA', hexa_1: 100, hexa_2: 80, hexa_3: 40, hexa_ref: 40, rota_1: 50, rota_2: 50 }
      ], get_history_metrics_rpc: [],
      get_captures_sr_range_bypass: [], get_captures_cons_range_bypass: [], get_captures_bio_range_bypass: []
    }
  };
}

function servidor(estado, reqs) {
  const filtros = (url) => {
    const fs = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const m = v.match(/^(eq|in)\.(.*)$/s);
      if (!m) continue;
      if (m[1] === 'eq') fs.push((r) => String(r[k]) === m[2]);
      else { const l = m[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')); fs.push((r) => l.includes(String(r[k]))); }
    }
    return (r) => fs.every((f) => f(r));
  };
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(b) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.startsWith('/auth/v1')) return json({ user: null, session: null });
    if (!url.pathname.startsWith('/rest/v1/')) return json({});
    const nombre = url.pathname.replace('/rest/v1/', '');
    let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { /* sin cuerpo */ }
    reqs.push({ m: req.method(), nombre, q: url.search, body });
    if (nombre.startsWith('rpc/')) return json(estado.rpc[nombre.slice(4)] === undefined ? null : estado.rpc[nombre.slice(4)]);
    const filas = (estado.db[nombre] = estado.db[nombre] || []);
    const pasa = filtros(url);
    const m = req.method();
    if (m === 'GET' || m === 'HEAD') {
      const out = filas.filter(pasa);
      if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) return out.length === 1 ? json(out[0]) : json({ code: 'PGRST116', message: 'x' }, 406);
      return json(out);
    }
    if (m === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const conf = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      rows.forEach((r) => {
        const i = conf.length ? filas.findIndex((x) => conf.every((c) => String(x[c]) === String(r[c]))) : -1;
        if (i >= 0) filas[i] = { ...filas[i], ...r }; else filas.push({ ...r });
      });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (m === 'DELETE') { estado.db[nombre] = filas.filter((r) => !pasa(r)); return route.fulfill({ status: 204 }); }
    if (m === 'PATCH') {
      const tocadas = filas.filter(pasa);
      tocadas.forEach((r) => Object.assign(r, body));
      if ((req.headers()['prefer'] || '').includes('return=representation')) return json(tocadas);
      return route.fulfill({ status: 204 });
    }
    return json([]);
  };
}

async function abrir(page, perfil) {
  const estado = estadoBase(perfil);
  const reqs = [];
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, servidor(estado, reqs));
  await page.clock.setFixedTime(new Date('2026-10-22T12:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem('sb-utclfqjietlxzlorxhrs-auth-token', JSON.stringify({
      access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: 'r',
      user: { id: 'u1', email: 'sup@x.mx', user_metadata: {} }
    }));
  });
  await page.goto('/mobile.html', { waitUntil: 'load' });
  await page.waitForSelector('body.sup-mode', { timeout: 20000 });
  return { estado, reqs, errores };
}

async function irAMas(page, panel) {
  await page.click('.dock-item[data-panel="MAS"]');
  await page.click(`[data-ir="${panel}"]`);
  await expect(page.locator(`#panel${panel}`)).toBeVisible();
}

test.describe('Móvil · operaciones de supervisión', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Parámetros: elige unidad en su alcance, valida y guarda con la misma clave de escritorio', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PAR');
    await expect(page.locator('#supOps_PAR [data-clues]')).toHaveCount(2); // solo Corregidora
    await page.click('[data-clues="QTSSA000830"]');
    await expect(page.locator('#supOps_PAR .sv-mx-item')).toHaveCount(15); // 14 oficiales + VSR registrado en la base
    await expect(page.locator('#supOps_PAR .sv-nota--sup')).toContainText('otro');
    const bcg = page.locator('#supOps_PAR .sv-mx-item[data-key="BCG"]');
    await expect(bcg.locator('[data-campo="max"]')).toHaveValue('10');
    // mínimo mayor que máximo: no guarda
    await bcg.locator('[data-campo="min"]').fill('20');
    await page.click('#svMxGuardar');
    await expect(page.locator('#svMxErr')).toContainText('mínimo');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'biologicos_params')).toHaveLength(0);
    // valores válidos
    await bcg.locator('[data-campo="min"]').fill('2');
    await bcg.locator('[data-campo="prom"]').fill('5');
    await page.click('#svMxGuardar');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'biologicos_params').length).toBe(1);
    const post = reqs.find((r) => r.m === 'POST' && r.nombre === 'biologicos_params');
    expect(post.q).toContain('on_conflict=clues%2Cbiologico');
    expect(post.body).toHaveLength(15);
    const fila = post.body.find((r) => r.biologico === 'BCG');
    expect(fila).toMatchObject({ clues: 'QTSSA000830', promedio_frascos: 5, min_dosis: 2, max_dosis: 10, multiplo_pedido: 10, updated_by: 'sup', activo: 'SI' });
    expect(estado.db.biologicos_params.find((r) => r.biologico === 'BCG').promedio_frascos).toBe(5);
    expect(errores).toEqual([]);
  });

  test('Jeringas: cinco tipos, guarda en jeringas_params', async ({ page }) => {
    const { reqs } = await abrir(page, { rol: 'JURISDICCIONAL' });
    await irAMas(page, 'JER');
    await page.click('[data-clues="QTSSA000222"]');
    await expect(page.locator('#supOps_JER .sv-mx-item')).toHaveCount(5);
    await page.locator('#supOps_JER .sv-mx-item[data-key="27x13"] [data-campo="max"]').fill('7');
    await page.click('#svMxGuardar');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'jeringas_params').length).toBe(1);
    const post = reqs.find((r) => r.m === 'POST' && r.nombre === 'jeringas_params');
    expect(post.q).toContain('on_conflict=clues%2Cjeringa');
    expect(post.body.find((r) => r.jeringa === '27x13')).toMatchObject({ clues: 'QTSSA000222', max_cajas: 7, activo: 'SI' });
  });

  test('Pinol: seguimiento acotado al alcance del municipal', async ({ page }) => {
    await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PIN');
    await expect(page.locator('#supOps_PIN .sv-unidad')).toHaveCount(1);
    await expect(page.locator('#supOps_PIN .sv-unidad')).toContainText('Santa Bárbara');
    await expect(page.locator('#supOps_PIN .sv-kpi').first()).toContainText('1');
  });

  test('Enviar aviso (municipal): confirma alcance, inserta aviso y reparte sin incluir al remitente', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', usuario: 'sup', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'ENV');
    await page.fill('#svEnvTitulo', 'Recordatorio');
    await page.fill('#svEnvMsg', 'Capturen antes del viernes.');
    await page.click('#svEnvRev');
    await expect(page.locator('.sv-confirma')).toContainText('Recordatorio');
    // 2 usuarios de unidad + 2 CLUES del catálogo (como en escritorio) + admin + municipal; sin el remitente
    await expect(page.locator('.sv-confirma .sv-nota b')).toHaveText('6');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'notificaciones')).toHaveLength(0);
    await page.click('#svEnvOk');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'notificaciones').length).toBe(1);
    const maestro = reqs.find((r) => r.m === 'POST' && r.nombre === 'notificaciones').body;
    expect(maestro).toMatchObject({ target_scope: 'MUNICIPIO_UNITS', target_municipio: 'CORREGIDORA', title: 'Recordatorio', from_usuario: 'sup', type: 'INFO', status: 'UNREAD' });
    await expect.poll(() => estado.db.notificaciones_perfil.length).toBe(6);
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).not.toContain('sup');
    expect(estado.db.notificaciones_perfil.every((r) => r.notificacion_id === maestro.id)).toBe(true);
    expect(errores).toEqual([]);
  });

  test('Enviar aviso sin título no avanza', async ({ page }) => {
    await abrir(page, { rol: 'CARAVANAS' });
    await irAMas(page, 'ENV');
    await page.click('#svEnvRev');
    await expect(page.locator('.sv-error')).toContainText('título');
  });

  test('Seguridad (admin): abre la captura de hoy con confirmación y corre la auditoría', async ({ page }) => {
    const { estado, reqs } = await abrir(page, { rol: 'ADMIN' });
    await irAMas(page, 'SEG');
    await expect(page.locator('#supOps_SEG')).toContainText('Cerrada');
    await page.click('#svApToggle');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'aperturas_existencia')).toHaveLength(0);
    await page.click('#svApSi');
    await expect.poll(() => estado.db.aperturas_existencia.length).toBe(1);
    expect(estado.db.aperturas_existencia[0]).toMatchObject({ activo: 'SI', creado_por: 'sup' });
    await expect(page.locator('#supOps_SEG')).toContainText('Abierta');
    await page.click('#svAudit');
    await expect(page.locator('#supOps_SEG')).toContainText('Unidad huérfana');
  });

  test('Permisos: visualizador y caravanas no ven Parámetros ni Seguridad', async ({ page }) => {
    await abrir(page, { rol: 'VISUALIZADOR_JURISDICCIONAL' });
    await page.click('.dock-item[data-panel="MAS"]');
    await expect(page.locator('[data-ir="PAR"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="ENV"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="SEG"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="RDA"]')).toHaveCount(1);
  });

  test('Pinol: registra la entrega, valida estatus y reparte el aviso a la unidad', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', usuario: 'sup', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PIN');
    await page.click('[data-entrega="p1"]');
    await expect(page.locator('#svPinEnt')).toContainText('Santa Bárbara');
    await page.selectOption('#svPinCant', '3');
    await page.fill('#svPinCom', 'Entregado en ventanilla');
    await page.click('#svPinEntOk');
    await expect.poll(() => estado.db.pinol_solicitudes.find((r) => r.id === 'p1').estatus).toBe('ENTREGADO');
    const fila = estado.db.pinol_solicitudes.find((r) => r.id === 'p1');
    expect(fila).toMatchObject({ solicitud_botellas: 3, comentario_entrega: 'Entregado en ventanilla', entregado_por: 'Sup' });
    const patch = reqs.find((r) => r.m === 'PATCH' && r.nombre === 'pinol_solicitudes');
    expect(patch.q).toContain('estatus=eq.PENDIENTE');
    await expect.poll(() => estado.db.notificaciones_perfil.filter((r) => r.notificacion_id === 'NOTIF:PINOL_ENTREGA:p1').length).toBeGreaterThan(0);
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).toContain('unidad830');
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).not.toContain('sup');
    await expect(page.locator('#supOps_PIN .sv-unidad')).toHaveCount(0); // ya no hay pendientes en su alcance
    expect(errores).toEqual([]);
  });

  test('Indicadores RDA: esquemas de dosis, deserción y comparativa', async ({ page }) => {
    await abrir(page, { rol: 'JURISDICCIONAL' });
    await irAMas(page, 'RDA');
    await page.click('[data-esq="adultos"]');
    await expect(page.locator('#supRdaRoot .sv-avance .sv-pct')).toHaveText('115'); // 30+70+10+5
    await expect(page.locator('#supRdaRoot .sv-kpi')).toHaveCount(5);
    await page.click('[data-esq="invernal"]');
    await expect(page.locator('#supRdaRoot .sv-avance .sv-pct')).toHaveText('50');
    await page.click('[data-esq="desercion"]');
    await expect(page.locator('#supRdaRoot .sv-cadena').first()).toContainText('Dosis 1');
    await expect(page.locator('#supRdaRoot')).toContainText('Mayor caída');
    await page.click('[data-esq="comparativa"]');
    await expect(page.locator('#supRdaRoot .sv-comp')).toHaveCount(3);
    await page.click('[data-esq="influenza"]');
    await expect(page.locator('#supRdaRoot')).toContainText(/Influenza|meta/i);
  });
});
