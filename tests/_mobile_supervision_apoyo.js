// Apoyo compartido de las pruebas del móvil de supervisión: PostgREST simulado con estado y arranque de mobile.html.
const { expect } = require('@playwright/test');

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
      lotes: [
        { id: 1, biologico: 'BCG', lote: 'L-100', caducidad: '2026-10-30', municipio: 'CORREGIDORA', tipo: 'NORMAL' },
        { id: 2, biologico: 'TD', lote: 'L-200', caducidad: '2027-12-31', municipio: 'EL MARQUES', tipo: 'NORMAL' },
        { id: 3, biologico: 'SR', lote: 'L-300', caducidad: '2026-01-31', municipio: 'CORREGIDORA', tipo: 'NORMAL' }
      ],
      notificaciones: [
        { id: 'NOTIF:PINOL_ENTREGA:p1', target_scope: 'CLUES', target_clues: 'QTSSA000830', target_municipio: 'CORREGIDORA', from_usuario: 'sup', title: 'Pinol entregado' }
      ],
      notificaciones_perfil: []
    },
    rpc: {
      get_audit_findings: [{ severidad: 'alta', categoria: 'unidad_huerfana', clues: 'QTSSA000999', descripcion: 'Sin ficha' }],
      get_concentrado_por_biologico: [
        { clues: 'QTSSA000830', nombre: 'Santa Bárbara', municipio: 'CORREGIDORA', biologico: 'BCG', total_dosis: 120 },
        { clues: 'QTSSA000111', nombre: 'El Pueblito', municipio: 'CORREGIDORA', biologico: 'BCG', total_dosis: 80 },
        { clues: 'QTSSA000830', nombre: 'Santa Bárbara', municipio: 'CORREGIDORA', biologico: 'TD', total_dosis: 40 }
      ],
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
    if (nombre.startsWith('rpc/')) {
      if (body && body.p_offset > 0) return json([]);
      return json(estado.rpc[nombre.slice(4)] === undefined ? null : estado.rpc[nombre.slice(4)]);
    }
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

module.exports = { RUIDO, UNIDADES, estadoBase, servidor, abrir, irAMas };
