// Indicadores del Resumen de captura y de la Vista en vivo (captura_insights.js + captura_insights_ui.js).
//  1) Cálculo puro (sin navegador): existencias, caducidades, insumos, pedidos, campaña, reincidentes, texto y CSV.
//  2) Panel real sobre index.html con un PostgREST simulado: tarjetas, filtros de las tablas, fichas por unidad,
//     Vista en vivo de cada tipo y accesibilidad (axe).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const CI = require('../captura_insights.js');

const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|posthog|ResizeObserver|DevTools|lucide/i;
const HOY = '2026-10-15'; // jueves; la semana va del 12 al 18

/* ───────────────────────────── 1) cálculo puro ───────────────────────────── */
test.describe('Cálculo de indicadores (sin navegador)', () => {
  test('mesesA usa la misma regla de mes que la Vista en vivo', () => {
    expect(CI.mesesA('2026-12-31', HOY)).toBe(2);
    expect(CI.mesesA('2026-10-01', HOY)).toBe(0);
    expect(CI.mesesA('2026-09-30', HOY)).toBe(-1);
    expect(CI.mesesA('OCT-26', HOY)).toBe(0);
    expect(CI.mesesA(null, HOY)).toBe(99);
    expect(CI.mmmaa('2026-11-30')).toBe('NOV-26');
  });

  const det = [
    // C1: TD con dos lotes (uno caducado, con más de 90 días), BCG en cero, un renglón fantasma, HEXAVALENTE sano
    { clues: 'C1', fecha: '2026-10-13', biologico: 'TD', lote: 'A', caducidad: '2026-11-30', cantidad: 5, fecha_recepcion: '2026-09-20' },
    { clues: 'C1', fecha: '2026-10-13', biologico: 'TD', lote: 'A2', caducidad: '2026-09-30', cantidad: 3, fecha_recepcion: '2026-06-01' },
    { clues: 'C1', fecha: '2026-10-13', biologico: 'BCG', lote: 'B', caducidad: '2027-05-31', cantidad: 0 },
    { clues: 'C1', fecha: '2026-10-13', biologico: 'TD', lote: 'A', caducidad: '2026-11-30', cantidad: 0 }, // fantasma de A
    { clues: 'C1', fecha: '2026-10-13', biologico: 'HEXAVALENTE', lote: 'H', caducidad: '2027-12-31', cantidad: 10 },
    // C1 tiene una captura más vieja de la misma semana: no debe contar
    { clues: 'C1', fecha: '2026-10-12', biologico: 'BCG', lote: 'B', caducidad: '2027-05-31', cantidad: 99 },
    // C2: frasco abierto hace 44 días y préstamo
    { clues: 'C2', fecha: '2026-10-14', biologico: 'BCG', lote: 'C', caducidad: '2028-01-31', cantidad: 4, fecha_apertura: '2026-09-01', tipo: 'PRESTAMO_DESABASTO' },
    { clues: 'C2', fecha: '2026-10-14', biologico: 'TD', lote: 'D', caducidad: '2028-01-31', cantidad: 20 }
  ];

  test('Existencia: ceros, caducados, caducan pronto, abiertos, permanencia, préstamos y última captura', () => {
    // existencia_detalle nunca guarda renglones en 0: el cero sale de biologicos_existencia contra la captura anterior
    const ex = [{ clues: 'C1', fecha: '2026-10-13', timestamp: '2026-10-13T16:42:00Z', editado: 'SI', tiene_ceros: true, bcg: 0, td: 8, hexavalente: 10 }];
    const exPrev = [{ clues: 'C1', fecha: '2026-10-06', bcg: 3, td: 8, hexavalente: 10 }, { clues: 'C1', fecha: '2026-09-29', bcg: 0, vph: 4 }];
    const an = CI.analizarSR(det, ex, HOY, exPrev);
    const c1 = an.unidades.get('C1'), c2 = an.unidades.get('C2');
    expect(c1.frascos).toBe(18);                       // 5+3+10 (el 99 de la captura vieja y el fantasma no cuentan)
    expect(c1.ceros).toEqual(['BCG']);          // solo se compara con la captura inmediata anterior (VPH de hace 2 semanas no cuenta)
    expect(c1.enCero).toBe(true);
    expect(c2.enCero).toBe(false);
    expect(c1.cad).toMatchObject({ lotes: 1, frascos: 5 });
    expect(c1.caducados).toMatchObject({ lotes: 1, frascos: 3 });
    expect(c1.permanencia.excedida).toBe(1);           // lote A2: 136 días
    expect(c1.dosis).toBe(5 * 10 + 3 * 10 + 10 * 1);   // TD ×10, HEXAVALENTE ×1
    expect(c1.editado).toBe(true);
    expect(c2.abiertos.vencidos).toBe(1);
    expect(c2.prestamos).toBe(1);
    expect(an.enCeroPorBio.get('BCG').clues.has('C1')).toBe(true);
    expect(an.enCeroPorBio.has('VPH')).toBe(false);
    expect(an.porBio.get('TD').frascos).toBe(8 + 20);
  });

  test('Resumen de Existencia: tarjetas con las unidades correctas para filtrar', () => {
    const ex = [{ clues: 'C1', fecha: '2026-10-13', tiene_ceros: true, bcg: 0 }, { clues: 'C2', fecha: '2026-10-14', tiene_ceros: false, bcg: 4 }];
    const an = CI.analizarSR(det, ex, HOY, [{ clues: 'C1', fecha: '2026-10-06', bcg: 3 }]);
    const r = CI.construirResumen('SR', an, { muniDe: () => 'X' });
    const t = (id) => r.tiles.find((x) => x.id === id);
    expect(r.tiles.map((x) => x.id)).toEqual(['ceros', 'caducan', 'abiertos', 'sinmov']); // una sola fila breve
    expect(t('ceros').valor).toBe('1');
    expect(t('ceros').nota).toContain('BCG (1)');
    expect([...t('ceros').set]).toEqual(['C1']);
    expect(t('caducan').valor).toBe('2');                  // 1 lote por caducar + 1 ya caducado
    expect(t('caducan').nota).toContain('1 ya caducado');
    expect([...t('abiertos').set]).toEqual(['C2']);
    expect(r.texto.join('\n')).toContain('1 unidad capturó biológicos en cero (BCG: 1)');
  });

  test('Consumibles: insumos insuficientes para las dosis y cobertura', () => {
    const rows = [
      { clues: 'C1', fecha: '2026-10-15', srp_dosis: 60, sr_dosis: 40, jeringa_reconst_5ml_0605500438: 0, jeringa_aplic_05ml_0605502657: 50, aguja_0600403711: 200 },
      { clues: 'C2', fecha: '2026-10-15', srp_dosis: 10, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 5, jeringa_aplic_05ml_0605502657: 30, aguja_0600403711: 30 },
      // una captura vieja de C2 que no cuenta
      { clues: 'C2', fecha: '2026-10-12', srp_dosis: 999, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 0, jeringa_aplic_05ml_0605502657: 0, aguja_0600403711: 0 }
    ];
    const an = CI.analizarCons(rows);
    expect(an.unidades.get('C1')).toMatchObject({ dosis: 100, insuficiente: true, cobertura: 0.5, ceros: ['Jeringa 5 ml'] });
    expect(an.unidades.get('C2')).toMatchObject({ dosis: 10, insuficiente: false });
    const r = CI.construirResumen('CONS', an, { muniDe: (c) => (c === 'C1' ? 'CORREGIDORA' : 'MARQUES') });
    expect(r.tiles.find((t) => t.id === 'insuf').valor).toBe('1');
    expect(r.tiles.map((x) => x.id)).toEqual(['insuf', 'ceros', 'sinmov']);
  });

  test('Pedido: vacunas de temporada no generan riesgo de desabasto', () => {
    const rows = ['INFLUENZA', 'COVID-19', 'VPH', 'VARICELA', 'BCG'].map((b) => (
      { clues: 'C1', biologico: b, pedido_frascos: 1, existencia_actual_frascos: 0, promedio_frascos: 10 }
    ));
    const an = CI.analizarBio(rows, null);
    expect(an.unidades.get('C1').alertas.map((a) => a.bio)).toEqual(['BCG']);
    expect(CI.revisionRenglonBio(rows[0]).tipo).toBe(null);
    expect(CI.revisionRenglonBio(rows[4]).tipo).toBe('riesgo');
  });

  test('Pedido: sobrepedido, riesgo, exceso, sin pedido y fuera de ventana', () => {
    const rows = [
      { clues: 'C1', biologico: 'TD', pedido_frascos: 30, existencia_actual_frascos: 1, promedio_frascos: 10, timestamp: '2026-10-22T18:00:00Z' }, // 30 > 2×10
      { clues: 'C1', biologico: 'BCG', pedido_frascos: 1, existencia_actual_frascos: 0, promedio_frascos: 10, timestamp: '2026-10-22T18:00:00Z' }, // (0+1)/10 = 0.1 mes
      { clues: 'C2', biologico: 'TD', pedido_frascos: 5, existencia_actual_frascos: 25, promedio_frascos: 10, timestamp: '2026-10-30T18:00:00Z' }, // exceso
      { clues: 'C3', biologico: 'TD', pedido_frascos: 0, existencia_actual_frascos: 12, promedio_frascos: 10, sin_pedido: true }
    ];
    const an = CI.analizarBio(rows, { start: '2026-10-20', end: '2026-10-26' });
    expect(an.unidades.get('C1').alertas.map((a) => a.tipo).sort()).toEqual(['riesgo', 'sobrepedido']);
    expect(an.unidades.get('C2').alertas.map((a) => a.tipo)).toEqual(['exceso']);
    expect(an.unidades.get('C2').fueraVentana).toBe(true);
    expect(an.unidades.get('C1').fueraVentana).toBe(false);
    expect(an.unidades.get('C3').sinPedido).toBe(true);
    expect(an.porBio.get('TD').pedido).toBe(35);
    const r = CI.construirResumen('BIO', an, { muniDe: () => 'X', ventana: { start: '2026-10-20', end: '2026-10-26' } });
    expect(r.tiles.find((t) => t.id === 'alertas').valor).toBe('2');
    expect(r.tiles.find((t) => t.id === 'sinped').valor).toBe('1');
    expect(CI.revisionRenglonBio(rows[0]).tipo).toBe('sobrepedido');
    expect(CI.revisionRenglonBio({ pedido_frascos: 1, existencia_actual_frascos: 1, promedio_frascos: 0 }).tipo).toBe(null);
  });

  test('Influenza: acumulado contra meta, ritmo esperado y rezago', () => {
    const camp = { fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' };
    const caps = [
      { clues: 'C1', fecha: '2026-10-02', valores: { r1: 10, r2: 10 } },
      { clues: 'C1', fecha: '2026-10-09', valores: { r1: 30 } },
      { clues: 'C2', fecha: '2026-10-09', valores: { r1: 5 }, sin_movimiento: false },
      { clues: 'C1', fecha: '2026-10-16', valores: { r1: 100 } } // semana posterior: no entra en "acumulado a la semana"
    ];
    const metas = [{ clues: 'C1', metas: { r1: 100, r2: 100 } }, { clues: 'C2', metas: { r1: 100 } }];
    const rubros = [{ id: 'r1', categoria: 'Población blanca' }, { id: 'r2', categoria: 'Población blanca' }];
    const an = CI.analizarInf(caps, metas, camp, '2026-10-09', '2026-10-15', rubros);
    expect(an.unidades.get('C1')).toMatchObject({ semana: 30, acumulado: 50, meta: 200, avance: 25 });
    expect(an.esperado).toBe(27); // 8 de 30 días, medido al viernes 9
    expect(an.unidades.get('C2')).toMatchObject({ avance: 5, bajoRitmo: true });
    expect(an.unidades.get('C1').bajoRitmo).toBe(false);
    expect(an.semanaTotal).toBe(35);
    expect(an.anterior).toBe(20);
    expect(an.porCat['Población blanca']).toBe(35);
    const r = CI.construirResumen('INF', an, { muniDe: () => 'X' });
    expect(r.tiles.find((t) => t.id === 'bajo').valor).toBe('1');
    expect(r.tiles.find((t) => t.id === 'acum').valor).toBe('18 %'); // 55 de 300
  });

  test('Reincidentes: semanas y meses seguidos sin capturar', () => {
    const lunes = CI.lunesDe(HOY); // 2026-10-12
    expect(lunes).toBe('2026-10-12');
    const racha = CI.rachaSemanal([
      { clues: 'C1', fecha: '2026-10-07' },   // semana anterior
      { clues: 'C2', fecha: '2026-09-30' },   // hace 2 semanas (la anterior no capturó)
      { clues: 'C3', fecha: '2026-09-02' }    // fuera de las 4 semanas
    ], lunes, 4);
    expect(racha('C1')).toBe(0);
    expect(racha('C2')).toBe(1);
    expect(racha('C3')).toBe(4);
    expect(racha('SIN')).toBe(4);
    const mes = CI.rachaMensual([{ clues: 'C1', fecha_pedido_programada: '2026-09-22' }, { clues: 'C2', fecha_pedido_programada: '2026-07-22' }], '2026-10', 3);
    expect(mes('C1')).toBe(0);
    expect(mes('C2')).toBe(2); // julio sí pidió; septiembre y agosto no
    expect(mes('C3')).toBe(3);
  });

  test('Vista en vivo: indicadores por tipo y variación contra lo anterior', () => {
    const sr = CI.kpisVivo('SR', {
      data: [
        { clues: 'U', fecha: '2026-10-13', biologico: 'TD', lote: 'A', caducidad: '2026-11-30', cantidad: 5 },
        { clues: 'U', fecha: '2026-10-13', biologico: 'BCG', lote: 'B', caducidad: '2027-05-31', cantidad: 0 }
      ],
      prevData: [{ cantidad: 8 }]
    }, HOY);
    expect(sr[0]).toMatchObject({ etiqueta: 'Frascos en existencia', valor: '5' });
    expect(sr[0].nota).toBe('−3 frascos vs captura anterior');
    expect(sr.find((k) => k.etiqueta === 'Biológicos con existencia').valor).toContain('1<small> de 2');
    const cons = CI.kpisVivo('CONS', {
      data: [{ srp_dosis: 100, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 1, jeringa_aplic_05ml_0605502657: 40, aguja_0600403711: 100 }],
      prevData: [{ srp_dosis: 120, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 1, jeringa_aplic_05ml_0605502657: 90, aguja_0600403711: 100 }]
    });
    expect(cons.find((k) => k.etiqueta === 'Cobertura de insumos')).toMatchObject({ valor: '40 %', tono: 'rojo' });
    expect(cons.find((k) => k.etiqueta === 'Jeringas de 0.5 ml').nota).toBe('−50 vs captura anterior');
    const inf = CI.kpisVivo('INF', { data: [{ cantidad: 30 }], extra: { acumulado: 50, metaTotal: 200, anterior: 20, esperado: 27, restantes: 3 } });
    expect(inf.map((k) => k.etiqueta)).toEqual(['Dosis de la semana', 'Acumulado de la campaña', 'Ritmo contra lo esperado', 'Dosis para llegar a la meta']);
    expect(inf[0].nota).toBe('+10 dosis vs semana anterior');
    expect(inf[2].valor).toBe('−2 pts');
  });

  test('Texto para WhatsApp y CSV (con comillas y acentos)', () => {
    const data = {
      fecha: HOY, fIniStr: '2026-10-12', fFinStr: '2026-10-18', total_capturadas: 2, total_unidades: 3,
      capturadas: [{ municipio: 'CORREGIDORA', clues: 'C1', unidad: 'Centro "Uno"', capturado_por: 'Ana' }, { municipio: 'EL MARQUÉS', clues: 'C2', unidad: 'Dos', capturado_por: 'Luis' }],
      faltantes: [{ municipio: 'HUIMILPAN', clues: 'C3', unidad: 'Tres' }]
    };
    const muni = CI.avancePorMunicipio(data.capturadas, data.faltantes);
    expect(muni.map((m) => [m.etiqueta, m.cap, m.total])).toEqual([['Corregidora', 1, 1], ['Huimilpan', 0, 1], ['El Marqués', 1, 1]]);
    const txt = CI.textoResumen('SR', data, muni, { texto: ['• algo'] });
    expect(txt).toContain('Avance: 2 de 3 unidades (67 %)');
    expect(txt).toContain('• Huimilpan: 0/1 (0 %) — faltan 1');
    expect(txt).toContain('Pendientes (1): TRES');
    const an = CI.analizarSR(det, [{ clues: 'C1', fecha: '2026-10-13', bcg: 0, tiene_ceros: true }], HOY, [{ clues: 'C1', fecha: '2026-10-06', bcg: 3 }]);
    const csv = CI.construirCsv('SR', data, an, () => 2);
    const lineas = csv.replace('\ufeff', '').split('\r\n');
    expect(lineas[0]).toContain('Biológicos en cero');
    expect(lineas[1]).toContain('"Centro ""Uno"""');
    expect(lineas[1]).toContain('BCG');
    expect(lineas[3].endsWith(',2')).toBe(true); // el pendiente trae su racha
  });
});

/* ───────────────────────────── 2) panel real con PostgREST simulado ───────────────────────────── */
function creaServidor(estado) {
  const reqs = [];
  const tabla = (n) => (estado.db[n] = estado.db[n] || []);
  const cond = (col, op, val) => {
    if (op === 'eq') return (r) => String(r[col]) === val;
    if (op === 'gte') return (r) => r[col] != null && String(r[col]) >= val;
    if (op === 'lte') return (r) => r[col] != null && String(r[col]) <= val;
    if (op === 'gt') return (r) => r[col] != null && String(r[col]) > val;
    if (op === 'lt') return (r) => r[col] != null && String(r[col]) < val;
    if (op === 'is') return (r) => (val === 'null' ? r[col] == null : String(r[col]) === val);
    if (op === 'in') { const l = val.replace(/^\(|\)$/g, '').split(','); return (r) => l.includes(String(r[col])); }
    if (op === 'ilike') { const re = new RegExp('^' + val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); return (r) => re.test(String(r[col])); }
    return () => true;
  };
  const parseOr = (expr) => expr.split(',').map((p) => { const m = p.match(/^([a-z_]+)\.(eq|gte|lte|gt|lt|in|is)\.(.*)$/); return cond(m[1], m[2], m[3]); });
  const filtros = (url) => {
    const fns = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      if (k === 'or') { const a = parseOr(v.replace(/^\(|\)$/g, '')); fns.push((r) => a.some((f) => f(r))); continue; }
      const m = v.match(/^(eq|gte|lte|gt|lt|in|is|ilike)\.(.*)$/s);
      if (m) fns.push(cond(k, m[1], m[2]));
    }
    return (r) => fns.every((f) => f(r));
  };
  return {
    reqs,
    async manejar(route) {
      const req = route.request(); const url = new URL(req.url()); const accept = req.headers()['accept'] || '';
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/v1')) return json(200, { user: null, session: null });
      if (!url.pathname.startsWith('/rest/v1/')) return json(200, {});
      const nombre = url.pathname.replace('/rest/v1/', '');
      reqs.push({ m: req.method(), nombre, q: url.search });
      if (nombre.startsWith('rpc/')) { const h = estado.rpc[nombre.slice(4)]; return json(200, h ? await h(JSON.parse(req.postData() || '{}')) : null); }
      let out = tabla(nombre).filter(filtros(url));
      const ord = url.searchParams.get('order');
      if (ord) { const [c, d] = ord.split('.'); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
      const lim = url.searchParams.get('limit'); if (lim) out = out.slice(0, Number(lim));
      if (accept.includes('vnd.pgrst.object')) return out.length === 1 ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'sin fila' });
      return json(200, out);
    }
  };
}

function estadoBase() {
  const T = (d, h) => `${d}T${h}:00-06:00`;
  return {
    db: {
      unidades: [
        { clues: 'C1', unidad: 'Centro Uno', municipio: 'CORREGIDORA', activo: 'SI' },
        { clues: 'C2', unidad: 'Centro Dos', municipio: 'CORREGIDORA', activo: 'SI' },
        { clues: 'C3', unidad: 'Centro Tres', municipio: 'MARQUES', activo: 'SI' },
        { clues: 'C4', unidad: 'Centro Cuatro', municipio: 'HUIMILPAN', activo: 'SI' }
      ],
      calendario_pedidos: [],
      campanas: [{ id: 1, nombre: 'Campaña Influenza 2026-2027', activo: true, fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' }],
      existencia_detalle: [
        { id: 'd1', clues: 'C1', fecha: '2026-10-13', biologico: 'TD', lote: 'A', caducidad: '2026-11-30', cantidad: 5, fecha_recepcion: '2026-09-20' },
        { id: 'd2', clues: 'C1', fecha: '2026-10-13', biologico: 'TD', lote: 'A2', caducidad: '2026-09-30', cantidad: 3, fecha_recepcion: '2026-06-01' },
        { id: 'd3', clues: 'C1', fecha: '2026-10-13', biologico: 'BCG', lote: 'B', caducidad: '2027-05-31', cantidad: 0 },
        { id: 'd4', clues: 'C2', fecha: '2026-10-14', biologico: 'BCG', lote: 'C', caducidad: '2028-01-31', cantidad: 4, fecha_apertura: '2026-09-01', tipo: 'PRESTAMO_DESABASTO' },
        { id: 'd5', clues: 'C3', fecha: '2026-10-15', biologico: 'TD', lote: 'E', caducidad: '2028-01-31', cantidad: 12 }
      ],
      biologicos_existencia: [
        { id: 'e1', clues: 'C1', fecha: '2026-10-13', timestamp: T('2026-10-13', '10:42'), capturado_por: 'Ana', tiene_ceros: true, bcg: 0, td: 8 },
        { id: 'e0', clues: 'C1', fecha: '2026-10-06', timestamp: T('2026-10-06', '10:00'), capturado_por: 'Ana', bcg: 3, td: 8 },
        { id: 'e2', clues: 'C2', fecha: '2026-10-14', timestamp: T('2026-10-14', '09:05'), capturado_por: 'Luis', tiene_ceros: false },
        { id: 'e3', clues: 'C3', fecha: '2026-10-15', timestamp: T('2026-10-15', '08:30'), capturado_por: 'Eva', tiene_ceros: false },
        // C2 también capturó la semana pasada; C4 no ha capturado en 4 semanas
        { id: 'e4', clues: 'C2', fecha: '2026-10-07', timestamp: T('2026-10-07', '09:00'), capturado_por: 'Luis' }
      ],
      consumibles: [
        { id: 'k1', clues: 'C1', fecha: '2026-10-14', timestamp: T('2026-10-14', '11:00'), srp_dosis: 60, sr_dosis: 40, jeringa_reconst_5ml_0605500438: 0, jeringa_aplic_05ml_0605502657: 50, aguja_0600403711: 200, capturado_por: 'Ana' },
        { id: 'k2', clues: 'C1', fecha: '2026-10-07', srp_dosis: 100, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 10, jeringa_aplic_05ml_0605502657: 120, aguja_0600403711: 200, capturado_por: 'Ana' },
        { id: 'k3', clues: 'C2', fecha: '2026-10-15', timestamp: T('2026-10-15', '12:00'), srp_dosis: 10, sr_dosis: 0, jeringa_reconst_5ml_0605500438: 5, jeringa_aplic_05ml_0605502657: 30, aguja_0600403711: 30, capturado_por: 'Luis' }
      ],
      biologicos_pedido: [
        { id: 'p1', clues: 'C1', biologico: 'TD', fecha_captura: '2026-10-22', fecha_pedido_programada: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 30, existencia_actual_frascos: 1, promedio_frascos: 10, timestamp: T('2026-10-22', '10:00') },
        { id: 'p2', clues: 'C2', biologico: 'TD', fecha_captura: '2026-10-22', fecha_pedido_programada: '2026-10-22', tipo_pedido: 'MENSUAL', pedido_frascos: 0, existencia_actual_frascos: 12, promedio_frascos: 10, sin_pedido: true, timestamp: T('2026-10-22', '11:00') },
        { id: 'p0', clues: 'C1', biologico: 'TD', fecha_captura: '2026-09-22', fecha_pedido_programada: '2026-09-22', tipo_pedido: 'MENSUAL', pedido_frascos: 10, existencia_actual_frascos: 1, promedio_frascos: 10, timestamp: T('2026-09-22', '10:00') }
      ],
      influenza_capturas: [
        { id: 'i1', clues: 'C1', fecha: '2026-10-09', anio_campana: 'Campaña Influenza 2026-2027', valores: { r1: 30, r16: 5 }, updated_at: T('2026-10-09', '15:00') },
        { id: 'i2', clues: 'C1', fecha: '2026-10-16', anio_campana: 'Campaña Influenza 2026-2027', valores: { r1: 40 }, updated_at: T('2026-10-16', '15:00') }
      ],
      influenza_metas: [{ id: 'm1', clues: 'C1', anio_campana: 'Campaña Influenza 2026-2027', metas: { r1: 100, r16: 100 } }]
    },
    rpc: {
      get_server_today: () => HOY,
      get_captures_sr_range_bypass: (b) => []
    }
  };
}

async function preparar(page, estado, rol = 'ADMIN') {
  const srv = creaServidor(estado);
  // Las listas de quién capturó salen de estas RPC: se derivan de las mismas tablas
  const rango = (tabla, campo, b) => estado.db[tabla].filter((r) => r[campo] >= b.p_fecha_inicio && r[campo] <= b.p_fecha_fin);
  estado.rpc.get_captures_sr_range_bypass = (b) => rango('biologicos_existencia', 'fecha', b).map((r) => ({ clues: r.clues, fecha: r.fecha, capturado_por: r.capturado_por, tiene_ceros: !!r.tiene_ceros }));
  estado.rpc.get_captures_cons_range_bypass = (b) => rango('consumibles', 'fecha', b).map((r) => ({ clues: r.clues, fecha: r.fecha, capturado_por: r.capturado_por }));
  estado.rpc.get_captures_bio_range_bypass = (b) => rango('biologicos_pedido', 'fecha_pedido_programada', b).filter((r) => r.biologico === 'TD').map((r) => ({ clues: r.clues, fecha: r.fecha_pedido_programada, capturado_por: 'X', tipo_pedido: r.tipo_pedido, sin_pedido: !!r.sin_pedido }));
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.route(/\.supabase\.co\//, (r) => srv.manejar(r));
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.supabaseRequest === 'function' || typeof supabaseRequest === 'function', null, { timeout: 20000 });
  await page.evaluate((r) => {
    const login = document.getElementById('loginWrapper'); if (login) login.style.display = 'none';
    USER = { rol: r, usuario: 'tester', nombre: 'Tester', clues: 'C1', unidad: 'Centro Uno', municipio: 'CORREGIDORA', municipiosAllowed: ['*'] };
    TOKEN = 'token-prueba';
    AppState.rol = r;
    STATUS = { today: '2026-10-15' };
  }, rol);
  await page.addScriptTag({ content: AXE });
  return { srv, errores };
}

// Hace visible el panel (la sesión real lo hace al entrar) y lo pinta con el tipo y la fecha dados
async function pintarResumen(page, tipo, fecha) {
  await page.evaluate(async ({ tipo, fecha }) => {
    for (const id of ['panelCaptureSummary', 'captureInsights']) for (let el = document.getElementById(id); el && el !== document.body; el = el.parentElement) { el.classList.remove('hidden', 'hide'); if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
    const sel = document.getElementById('summaryTipo');
    if (![...sel.options].some((o) => o.value === tipo)) sel.add(new Option(tipo, tipo));
    sel.value = tipo; document.getElementById('summaryFecha').value = fecha;
    const r = await supabaseRequest('admincaptureoverview', { action: 'admincaptureoverview', fecha, tipo });
    renderCaptureSummary(r.data);
  }, { tipo, fecha });
  await page.waitForSelector('#captureInsights .ci-tile', { timeout: 10000 });
}

const filas = (page, id) => page.locator(`#${id} tr`).evaluateAll((trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
const axe = (page, sel) => page.evaluate(async (s) => {
  const r = await window.axe.run(s, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'heading-order': { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}, sel);

test.describe('Resumen de captura con indicadores', () => {
  test.use({ viewport: { width: 1360, height: 1000 } });

  test('Existencia: tarjetas, fichas por unidad, reincidentes y filtros de las tablas', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    await pintarResumen(page, 'SR', HOY);
    const tarjeta = (txt) => page.locator('#captureInsights .ci-tile', { hasText: txt });
    await expect(tarjeta('Capturaron en cero').locator('.ci-val')).toHaveText('1');
    await expect(tarjeta('Capturaron en cero')).toContainText('BCG (1)');
    await expect(tarjeta('Caducan en ≤ 3 meses').locator('.ci-val')).toHaveText('2');
    await expect(tarjeta('Frascos abiertos').locator('.ci-val')).toHaveText('1');
    // Una sola fila de tarjetas, compacta, y sin paneles extra
    const alto = await page.locator('#captureInsights .ci-tiles').evaluate((e) => e.getBoundingClientRect().height);
    expect(alto).toBeLessThan(80);
    await expect(page.locator('#captureInsights .ci-card')).toHaveCount(0);

    // Fichas bajo cada unidad capturada y reincidencia en la que falta
    const cap = await filas(page, 'capturadasTbody');
    expect(cap.find((t) => t.includes('Centro Uno'))).toContain('en cero: BCG');
    expect(cap.find((t) => t.includes('Centro Uno'))).toContain('1 caducado');
    expect((await filas(page, 'faltantesTbody')).find((t) => t.includes('Centro Cuatro'))).toContain('4+ semanas sin capturar');

    // Tocar una tarjeta deja solo esas unidades
    await tarjeta('Capturaron en cero').click();
    expect(await filas(page, 'capturadasTbody')).toHaveLength(1);
    await expect(page.locator('#capturadasCountLabel')).toHaveText('(1 de 3)');
    await expect(page.locator('#faltantesTbody')).toContainText('Ninguna unidad pendiente coincide');
    await expect(page.locator('#captureInsights .ci-active')).toContainText('Capturaron en cero');
    await page.locator('#captureInsights [data-ci="quitar"]').click();
    expect(await filas(page, 'capturadasTbody')).toHaveLength(3);
    await expect(page.locator('#capturadasCountLabel')).toHaveText('(3)');

    // Municipio y búsqueda; el aviso de WhatsApp copia lo que se ve
    await page.locator('#captureInsights .ci-chip', { hasText: 'Huimilpan' }).click();
    await expect(page.locator('#capturadasTbody')).toContainText('Ninguna unidad capturada coincide');
    expect(await page.evaluate(() => window.currentFaltantesWhatsApp.map((f) => f.clues))).toEqual(['C4']);
    await page.locator('#captureInsights .ci-chip', { hasText: 'Todos' }).click();
    await page.locator('#ciBuscar').fill('tres');
    await expect.poll(async () => (await filas(page, 'capturadasTbody')).length).toBe(1);
    expect(errores).toEqual([]);
  });

  test('Existencia: copiar resumen y accesibilidad del panel', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    await pintarResumen(page, 'SR', HOY);
    await page.evaluate(() => { window.__copiado = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); });
    await page.locator('#captureInsights [data-ci="copiar"]').click();
    const txt = await page.evaluate(() => window.__copiado);
    expect(txt).toContain('RESUMEN DE CAPTURA · EXISTENCIA DE BIOLÓGICOS');
    expect(txt).toContain('Avance: 3 de 4 unidades (75 %)');
    expect(txt).toContain('• Corregidora: 2/2 (100 %)');
    expect(txt).toContain('1 unidad capturó biológicos en cero');
    expect(await axe(page, '#panelCaptureSummary')).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('Consumibles: insumos insuficientes y tabla por municipio', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    await pintarResumen(page, 'CONS', HOY);
    await expect(page.locator('#captureInsights .ci-tile', { hasText: 'No alcanzan para sus dosis' }).locator('.ci-val')).toHaveText('1');
    expect((await filas(page, 'capturadasTbody')).find((t) => t.includes('Centro Uno'))).toContain('insumos para 50 % de sus dosis');
    expect(await axe(page, '#panelCaptureSummary')).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('Pedido: pedido consolidado, pedidos por revisar y reincidencia mensual', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    await pintarResumen(page, 'BIO', '2026-10-22');
    await expect(page.locator('#captureInsights .ci-tile', { hasText: 'Pedido total' }).locator('.ci-val')).toHaveText('30');
    await expect(page.locator('#captureInsights .ci-tile', { hasText: 'Sin pedido' }).locator('.ci-val')).toHaveText('1');
    await expect(page.locator('#captureInsights .ci-tile', { hasText: 'Por revisar' }).locator('.ci-val')).toHaveText('1');
    const fal = await filas(page, 'faltantesTbody');
    expect(fal.find((t) => t.includes('Centro Cuatro'))).toContain('3+ meses sin capturar');
    expect(await axe(page, '#panelCaptureSummary')).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('Influenza: acumulado, ritmo y rezago contra la meta', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    await pintarResumen(page, 'INF', '2026-10-16');
    const v = (t) => page.locator('#captureInsights .ci-tile', { hasText: t }).locator('.ci-val');
    await expect(v('Dosis de la semana')).toHaveText('40');
    await expect(v('Avance de campaña')).toHaveText('38 %');
    expect(await axe(page, '#panelCaptureSummary')).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('Vista en vivo: tira de indicadores en Existencia, Consumibles y Pedido', async ({ page }) => {
    const { errores } = await preparar(page, estadoBase());
    const abrir = async (tipo, fecha, clues, unidad) => {
      await page.evaluate(({ tipo, fecha }) => { const s = document.getElementById('summaryTipo'); if (![...s.options].some((o) => o.value === tipo)) s.add(new Option(tipo, tipo)); s.value = tipo; document.getElementById('summaryFecha').value = fecha; }, { tipo, fecha });
      await page.evaluate(async ({ clues, unidad }) => { await openLiveView(clues, unidad, 'CORREGIDORA'); }, { clues, unidad });
      await page.waitForFunction(() => document.getElementById('liveViewKpis').style.display === 'grid', null, { timeout: 8000 });
    };
    await abrir('SR', HOY, 'C1', 'Centro Uno');
    await expect(page.locator('#liveViewKpis')).toContainText('Frascos en existencia');
    await expect(page.locator('#liveViewKpis')).toContainText('En cero: BCG');
    expect(await axe(page, '#liveViewKpis')).toEqual([]);
    await abrir('CONS', HOY, 'C1', 'Centro Uno');
    await expect(page.locator('#liveViewKpis .ci-tile', { hasText: 'Cobertura de insumos' })).toContainText('50 %');
    await expect(page.locator('#liveViewTbody')).toContainText('−70 (consumo o salida)'); // jeringa 0.5: 120 → 50
    await abrir('BIO', '2026-10-22', 'C1', 'Centro Uno');
    await expect(page.locator('#liveViewKpis')).toContainText('Pedido solicitado');
    await expect(page.locator('#liveViewKpis')).toContainText('+20 frascos vs mes anterior');
    await expect(page.locator('#liveViewTbody')).toContainText('Sobrepedido');
    expect(errores).toEqual([]);
  });
});
