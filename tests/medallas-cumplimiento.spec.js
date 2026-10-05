// Medallas de cumplimiento (main.js): fórmula única de puntaje, una sola consulta por año, influenza,
// paginación de capturas, caché, respuestas viejas y el HTML que se pinta. Se extraen los bloques de main.js
// y se evalúan en la página con un Supabase simulado.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8').split('\r\n').join('\n');
const corte = (desde, hasta) => {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i);
  if (i < 0 || j < 0) throw new Error('No se encontró el bloque: ' + desde);
  return src.slice(i, j);
};
const bloque =
  corte('function complianceTierFromScore', 'async function getHistoryMetrics') + '\n' +
  corte('const MEDALS_CACHE_TTL', 'function updateCumplimientoMedalTone');

async function montar(page, { rows, capturas = [], campana } = {}) {
  await page.route('**/__blank_med', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="bCumplimientoMedals"></div></body></html>' }));
  await page.goto('/__blank_med');
  await page.evaluate(({ code, rows, capturas, campana }) => {
    window.__rpc = 0; window.__cap = 0; window.__rpcArgs = null;
    window.__rows = rows; window.__capturas = capturas;
    window.TOKEN = 't';
    window.USER = { rol: 'UNIDAD', clues: 'AAA', municipio: 'CORREGIDORA' };
    window.$ = (id) => document.getElementById(id);
    window.normalizeText = (s) => String(s || '').trim().toUpperCase();
    window.buildCacheKey = (a, b) => a + '::' + b;
    window.__cache = new Map();
    window.getCachedOrFetch = async ({ key, fetcher, shouldCache }) => {
      if (window.__cache.has(key)) return window.__cache.get(key);
      const d = await fetcher();
      if (shouldCache(d)) window.__cache.set(key, d);
      return d;
    };
    window.calculateBioIntelligentWindow = (y, m) => ({ start: new Date(y, m, 1) });
    window.todayYmdLocal = () => '2026-10-20';
    window.dateToLocalYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    window.__campana = campana;
    window.getActiveCampaign = async () => ({ data: window.__campana || null });
    window.InfluenzaReglas = { cortes: () => [] };
    window.__hitsArgs = null;
    window.supabase = {
      rpc: async (n, a) => {
        if (n === 'influenza_capture_hits_rpc') {
          window.__cap++; window.__hitsArgs = a;
          const out = {};
          window.__capturas.forEach((c) => {
            if (!a.p_fechas.includes(c.fecha)) return;
            if (a.p_clues && !a.p_clues.includes(c.clues)) return;
            (out[c.clues] = out[c.clues] || []).push(c.fecha);
          });
          return { data: out, error: null };
        }
        window.__rpc++; window.__rpcArgs = { n, a };
        return { data: window.__rows, error: null };
      }
    };
    // eslint-disable-next-line no-eval
    (0, eval)(code + '\nObject.assign(window,{computeComplianceScore,complianceTierFromScore,getYearMedals,renderUnitMedals,refreshComplianceMedals,fetchInfluenzaCaptureDates,influenzaExpectedDatesForMonth,isPedidoRequiredForMonth});');
  }, { code: bloque, rows, capturas, campana });
}

const fila = (mes, b, c, p, eb = 4, ec = 4, clues = 'AAA') => ({ mes, clues, bio_semanas_ok: b, cons_semanas_ok: c, pedido_mensual: p, ebio: eb, econs: ec });

test('niveles por puntaje: cortes exactos', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => [100, 99, 90, 89, 80, 79, 70, 69, 60, 59, 50, 49, 0].map((s) => window.complianceTierFromScore(s)));
  expect(r).toEqual(['diamante', 'oro', 'oro', 'plata', 'plata', 'bronce', 'bronce', 'acero', 'acero', 'jade', 'jade', 'riesgo', 'riesgo']);
});

test('fórmula: pesos con y sin pedido, con y sin influenza, y tope de 100', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => {
    const f = window.computeComplianceScore;
    return {
      perfecto: f({ bio: 4, cons: 4, eBio: 4, eCons: 4, pedido: true, isRequired: true }),
      sinPedidoReq: f({ bio: 2, cons: 4, eBio: 4, eCons: 4, pedido: false, isRequired: false }),   // 50% bio, 100% cons -> 75
      pedidoFalta: f({ bio: 4, cons: 4, eBio: 4, eCons: 4, pedido: false, isRequired: true }),     // 80
      infReq: f({ bio: 4, cons: 4, eBio: 4, eCons: 4, pedido: true, isRequired: true, influenzaPct: 0 }),  // 75
      infNoReq: f({ bio: 4, cons: 4, eBio: 4, eCons: 4, pedido: false, isRequired: false, influenzaPct: 0 }), // 70
      tope: f({ bio: 9, cons: 9, eBio: 4, eCons: 4, pedido: true, isRequired: true }),
      sinEsperadas: f({ bio: 2, cons: 2, eBio: 0, eCons: 0, pedido: false, isRequired: false })     // 0 esperadas => 4
    };
  });
  expect(r).toEqual({ perfecto: 100, sinPedidoReq: 75, pedidoFalta: 80, infReq: 75, infNoReq: 70, tope: 100, sinEsperadas: 50 });
});

test('una sola consulta por año: un RPC con la unidad y UNA lectura de influenza', async ({ page }) => {
  await montar(page, {
    rows: [fila('2026-08', 4, 4, true), fila('2026-09', 3, 4, true), fila('2026-10', 3, 3, true)],
    campana: { nombre: 'C', fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' },
    capturas: [{ clues: 'AAA', fecha: '2026-10-16' }, { clues: 'AAA', fecha: '2026-10-23' }]
  });
  const r = await page.evaluate(async () => {
    const m = await window.getYearMedals(2026, { clues: 'AAA' });
    return { m, rpc: window.__rpc, cap: window.__cap, args: window.__rpcArgs };
  });
  expect(r.rpc).toBe(1);
  expect(r.cap).toBe(1);
  expect(r.args).toEqual({ n: 'get_year_medal_inputs_rpc', a: { p_anio: 2026, p_clues: 'AAA', p_municipio: null } });
  // Octubre: viernes 16, 23, 30 dentro de la campaña -> 2 de 3 capturados = 66.7% de influenza.
  expect(r.m.map((x) => [x.month, x.tier])).toEqual([['2026-08', 'diamante'], ['2026-09', 'oro'], ['2026-10', 'bronce']]);
  expect(r.m[2].score).toBe(Math.round(75 * 0.3 + 75 * 0.3 + 100 * 0.15 + (2 / 3) * 100 * 0.25));
});

test('sin campaña activa no se lee influenza y el puntaje no la incluye', async ({ page }) => {
  await montar(page, { rows: [fila('2026-10', 4, 4, true)] });
  const r = await page.evaluate(async () => ({ m: await window.getYearMedals(2026, { clues: 'AAA' }), cap: window.__cap }));
  expect(r.cap).toBe(0);
  expect(r.m).toEqual([{ month: '2026-10', score: 100, tier: 'diamante' }]);
});

test('meses en riesgo (<50) no dan medalla', async ({ page }) => {
  await montar(page, { rows: [fila('2026-08', 0, 0, false), fila('2026-09', 4, 4, true)] });
  const m = await page.evaluate(() => window.getYearMedals(2026, { clues: 'AAA' }));
  expect(m.map((x) => x.month)).toEqual(['2026-09']);
});

test('municipio: promedia las unidades de cada mes y manda p_municipio', async ({ page }) => {
  await montar(page, { rows: [fila('2026-09', 4, 4, true, 4, 4, 'AAA'), fila('2026-09', 2, 2, true, 4, 4, 'BBB')] });
  const r = await page.evaluate(async () => ({ m: await window.getYearMedals(2026, { municipio: 'Corregidora' }), a: window.__rpcArgs.a }));
  // AAA = 100, BBB = 50*0.4+50*0.4+20 = 60 -> promedio 80 -> plata
  expect(r.m).toEqual([{ month: '2026-09', score: 80, tier: 'plata' }]);
  expect(r.a).toEqual({ p_anio: 2026, p_clues: null, p_municipio: 'Corregidora' });
});

test('influenza: se piden solo las fechas esperadas (sin repetir) y nunca la tabla completa', async ({ page }) => {
  await montar(page, { rows: [], capturas: [{ clues: 'A', fecha: '2026-10-16' }, { clues: 'A', fecha: '2026-10-17' }, { clues: 'B', fecha: '2026-10-30' }] });
  const r = await page.evaluate(async () => {
    const m = await window.fetchInfluenzaCaptureDates('C', ['2026-10-16', '2026-10-30', '2026-10-30'], null);
    const vacio = await window.fetchInfluenzaCaptureDates('C', [], null);
    return { args: window.__hitsArgs, A: [...m.get('A')], B: [...m.get('B')], llamadas: window.__cap, vacio: vacio.size };
  });
  expect(r.args).toEqual({ p_campana: 'C', p_fechas: ['2026-10-16', '2026-10-30'], p_clues: null });
  expect(r.A).toEqual(['2026-10-16']); // el 17 no era fecha esperada
  expect(r.B).toEqual(['2026-10-30']);
  expect(r.llamadas).toBe(1);               // con lista vacía no se consulta
  expect(r.vacio).toBe(0);
});

test('un corte de fin de mes que cae en viernes cuenta UNA sola vez', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => {
    window.InfluenzaReglas = { cortes: () => ['2026-10-30', '2026-11-30'] };
    const camp = { fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' };
    return { oct: window.influenzaExpectedDatesForMonth(camp, '2026-10'), nov: window.influenzaExpectedDatesForMonth(camp, '2026-11') };
  });
  expect(r.oct).toEqual(['2026-10-16', '2026-10-23', '2026-10-30']);
  // noviembre: viernes 6, 13, 20, 27 + corte del lunes 30
  expect(r.nov).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27', '2026-11-30']);
});

test('medallas con influenza: todas las fechas del año en UNA llamada y solo las unidades del alcance', async ({ page }) => {
  await montar(page, {
    rows: [fila('2026-10', 4, 4, true, 4, 4, 'AAA'), fila('2026-10', 4, 4, true, 4, 4, 'BBB')],
    campana: { nombre: 'C', fecha_inicio: '2026-10-12', fecha_fin: '2027-04-02' },
    capturas: [{ clues: 'AAA', fecha: '2026-10-16' }, { clues: 'AAA', fecha: '2026-10-23' }, { clues: 'AAA', fecha: '2026-10-30' }]
  });
  const r = await page.evaluate(async () => {
    window.InfluenzaReglas = { cortes: () => ['2026-10-30'] };
    const m = await window.getYearMedals(2026, { municipio: 'X' });
    return { m, cap: window.__cap, args: window.__hitsArgs };
  });
  expect(r.cap).toBe(1);
  expect(r.args.p_fechas).toEqual(['2026-10-16', '2026-10-23', '2026-10-30']);
  expect(r.args.p_clues).toEqual(['AAA', 'BBB']);
  // AAA: 100% influenza => 100; BBB: 0% => 4/4 y 4/4 con pedido: 30+30+15+0 = 75; promedio 88 -> plata
  expect(r.m).toEqual([{ month: '2026-10', score: 88, tier: 'plata' }]);
});

test('si falla el RPC no se pinta ni se cachea (null) y se reintenta', async ({ page }) => {
  await montar(page, { rows: [fila('2026-09', 4, 4, true)] });
  const r = await page.evaluate(async () => {
    const rpcOk = window.supabase.rpc;
    window.supabase.rpc = async () => ({ data: null, error: { message: 'boom' } });
    const a = await window.getYearMedals(2026, { clues: 'AAA' });
    window.supabase.rpc = rpcOk;
    const b = await window.getYearMedals(2026, { clues: 'AAA' });
    return { a, b: b.length };
  });
  expect(r).toEqual({ a: null, b: 1 });
});

test('el resultado se cachea: la segunda lectura no vuelve a consultar', async ({ page }) => {
  await montar(page, { rows: [fila('2026-09', 4, 4, true)] });
  const rpc = await page.evaluate(async () => { await window.getYearMedals(2026, { clues: 'AAA' }); await window.getYearMedals(2026, { clues: 'AAA' }); return window.__rpc; });
  expect(rpc).toBe(1);
});

test('el HTML: misma chip, icono y color por nivel, tooltip y solo la última marcada', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => {
    window.renderUnitMedals([
      { month: '2026-01', score: 100, tier: 'diamante' },
      { month: '2026-02', score: 92, tier: 'oro' },
      { month: '2026-03', score: 85, tier: 'plata' },
      { month: '2026-04', score: 72, tier: 'bronce' },
      { month: '2026-05', score: 61, tier: 'acero' },
      { month: '2026-06', score: 55, tier: 'jade' },
      { month: '2026-07', score: 100, tier: 'diamante' }
    ]);
    return [...document.querySelectorAll('#bCumplimientoMedals > span')].map((e) => ({ cls: e.className, icon: e.textContent, title: e.title }));
  });
  expect(r.map((x) => x.icon)).toEqual(['diamond', 'workspace_premium', 'military_tech', 'military_tech', 'workspace_premium', 'military_tech', 'diamond']);
  expect(r.map((x) => x.cls.split(' ').find((c) => c.startsWith('tier-')))).toEqual(['tier-diamante', 'tier-oro', 'tier-plata', 'tier-bronze', 'tier-steel', 'tier-emerald', 'tier-diamante']);
  expect(r.every((x) => x.cls.startsWith('material-symbols-rounded chip-medal-icon'))).toBe(true);
  expect(r.filter((x) => x.cls.includes('is-latest')).length).toBe(1);
  expect(r[6].cls).toContain('is-latest');
  expect(r[1].title).toBe('Medalla de cumplimiento Oro - Febrero (92%)');
});

test('renderUnitMedals con lista vacía o nula limpia el contenedor', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => {
    window.renderUnitMedals([{ month: '2026-01', score: 100, tier: 'diamante' }]);
    window.renderUnitMedals([]);
    const a = document.getElementById('bCumplimientoMedals').innerHTML;
    window.renderUnitMedals(null);
    return [a, document.getElementById('bCumplimientoMedals').innerHTML];
  });
  expect(r).toEqual(['', '']);
});

test('refreshComplianceMedals: una respuesta vieja no pisa a la más nueva', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(async () => {
    const lento = [{ month: '2026-01', score: 100, tier: 'diamante' }];
    const rapido = [{ month: '2026-02', score: 92, tier: 'oro' }];
    let n = 0;
    window.getYearMedals = (y) => { n++; const mine = n; return new Promise((res) => setTimeout(() => res(mine === 1 ? lento : rapido), mine === 1 ? 80 : 10)); };
    window.refreshComplianceMedals(2026, 'TODOS');
    window.refreshComplianceMedals(2026, 'TODOS');
    await new Promise((res) => setTimeout(res, 200));
    return [...document.querySelectorAll('#bCumplimientoMedals > span')].map((e) => e.title);
  });
  expect(r).toEqual(['Medalla de cumplimiento Oro - Febrero (92%)']);
});

test('refreshComplianceMedals: roles sin alcance (CARAVANAS) no consultan; el historial vacía y el tablero no toca', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(() => {
    window.USER = { rol: 'CARAVANAS' };
    const c = document.getElementById('bCumplimientoMedals');
    c.innerHTML = 'x';
    window.refreshComplianceMedals(2026, 'TODOS');                        // tablero: no-op
    const tablero = c.innerHTML;
    window.refreshComplianceMedals(2026, 'TODOS', { clearIfNone: true }); // historial: vacía
    return { tablero, historial: c.innerHTML, rpc: window.__rpc };
  });
  expect(r).toEqual({ tablero: 'x', historial: '', rpc: 0 });
});

test('ADMIN/JURISDICCIONAL con TODOS no tienen medallas (la vista global no las lleva) y no consultan', async ({ page }) => {
  await montar(page, { rows: [fila('2026-09', 4, 4, true)] });
  const r = await page.evaluate(async () => {
    const c = document.getElementById('bCumplimientoMedals');
    const out = {};
    for (const rol of ['ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL']) {
      window.USER = { rol };
      c.innerHTML = 'x';
      window.refreshComplianceMedals(2026, '', { clearIfNone: true });
      out[rol] = c.innerHTML;
    }
    return { out, rpc: window.__rpc };
  });
  expect(r).toEqual({ out: { ADMIN: '', JURISDICCIONAL: '', VISUALIZADOR_JURISDICCIONAL: '' }, rpc: 0 });
});

test('admin con municipio elegido: historial y tablero piden lo mismo y las medallas se pintan una vez', async ({ page }) => {
  await montar(page, { rows: [] });
  const r = await page.evaluate(async () => {
    window.USER = { rol: 'ADMIN' };
    window.getYearMedals = () => new Promise((res) => setTimeout(() => res([{ month: '2026-06', score: 92, tier: 'oro' }]), 30));
    window.refreshComplianceMedals(2026, 'CORREGIDORA', { clearIfNone: true }); // historial (pendiente)
    window.refreshComplianceMedals(2026, 'CORREGIDORA');                        // tablero: lee el mismo filtro -> mismo alcance
    await new Promise((res) => setTimeout(res, 120));
    return [...document.querySelectorAll('#bCumplimientoMedals > span')].map((e) => e.title);
  });
  expect(r).toEqual(['Medalla de cumplimiento Oro - Junio (92%)']);
});

test('estilos: sombra doble original, brillo solo en la última y sin brillo permanente en el ranking', async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8').split('\r\n').join('\n');
  expect(css).toMatch(/\.chip-medal-icon \{[^}]*drop-shadow\(0 2px 4px rgba\(0,0,0,0\.3\)\) drop-shadow\(0 4px 8px rgba\(0,0,0,0\.25\)\) !important/);
  expect(css).toMatch(/\.tier-diamante\.is-latest \{ animation: shimmer-medal/);
  expect(css).not.toMatch(/\.tier-diamante \{[^}]*animation:/);
});
