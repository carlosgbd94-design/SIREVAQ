// Asistente de revisión del municipal: el motor (diagnostico_sis.js) explica POR QUÉ no cuadra el SIS con cifras reales
// de octubre-2026 (Corregidora, Marqués, Huimilpan). Es lógica pura: no abre navegador ni toca la base.
const { test, expect } = require('@playwright/test');
const { diagnosticar, htmlDiagnostico, distancia } = require('../diagnostico_sis.js');

// fila de biovac_discrepancias_municipio (solo existencia anterior distinta salvo que se indique)
const f = (bio, lote, mAnt, uAnt, extra = {}) => ({
  lote_id: `id-${bio}-${lote}`, numero_lote: lote, biologico: bio, categoria: 'NORMAL', caducidad: null, tipo: 'ANTERIOR_DISTINTA',
  mun_anterior: mAnt, uni_anterior: uAnt, mun_recibido: 0, uni_recibido: 0, mun_aplicadas: 0, uni_aplicadas: 0, mun_desechadas: 0, uni_desechadas: 0, ...extra
});
const u = (bio, lote, unidad, anterior, categoria = 'NORMAL') => ({ lote_id: `id-${bio}-${lote}`, numero_lote: lote, biologico: bio, categoria, unidad, clues: 'X', anterior, recibido: 0, aplicado: 0, desechado: 0, final: anterior });
const grupo = (res, bio) => res.grupos.find((g) => g.biologico === bio);
const causa = (g, tipo) => g.causas.filter((c) => c.tipo === tipo);

const TDPA = 'TDPa\nfrasco unidosis';

test('Corregidora TDPa: −5, −7 y +12 se cancelan → un lote cruzado y se señala a la unidad', () => {
  const disc = [f(TDPA, '3CA38C5', 53, 48), f(TDPA, 'AC37B542BD', 46, 39), f(TDPA, 'AC37B543AD', 12, 24, { mun_recibido: 45, uni_recibido: 45, mun_aplicadas: 24, uni_aplicadas: 24 })];
  const uni = [u(TDPA, 'AC37B543AD', 'PRESA DE BRAVO', 8), u(TDPA, 'AC37B543AD', 'SAN JOSÉ DE LOS OLVERA', 7), u(TDPA, 'AC37B543AD', 'JOAQUIN HERRERA', 1)];
  const res = diagnosticar(disc, uni);
  const g = grupo(res, 'TDPa frasco unidosis');
  expect(g.explicado).toBe(true);
  expect(g.requiereDecision).toBe(false);
  const c = causa(g, 'LOTE_CRUZADO');
  expect(c).toHaveLength(1);
  expect(c[0].cantidad).toBe(12);
  expect(c[0].confianza).toBe('alta');
  expect(c[0].texto).toContain('3CA38C5');
  expect(c[0].texto).toContain('AC37B542BD');
  expect(causa(g, 'CONTEO')).toHaveLength(0);                       // nada se queda como "faltante"
  expect(c[0].sospechas.find((s) => s.exacto).unidad).toBe('SAN JOSÉ DE LOS OLVERA'); // declaró justo 7
});

test('Marqués BCG: 0374MA108 −4 y 0374MA109 +4 → error de dedo (lotes casi iguales)', () => {
  const B = 'B.C.G.\nfrasco multidosis';
  const res = diagnosticar([f(B, '0374MA108', 42, 38), f(B, '0374MA109', 0, 4)], [u(B, '0374MA109', 'LA PIEDAD', 4)]);
  const c = causa(grupo(res, 'B.C.G. frasco multidosis'), 'LOTE_CRUZADO')[0];
  expect(c.cantidad).toBe(4);
  expect(c.confianza).toBe('alta');
  expect(c.texto).toContain('lote casi igual');
  expect(c.sospechas[0]).toMatchObject({ unidad: 'LA PIEDAD', cantidad: 4, exacto: true });
  expect(distancia('0374MA108', '0374MA109')).toBe(1);
});

test('Huimilpan: dos pares exactos en el mismo biológico, cada uno por separado', () => {
  const res = diagnosticar([f(TDPA, '3CA38C5', 32, 35), f(TDPA, '3CA53C1', 6, 3), f(TDPA, 'AC37B542BD', 37, 42), f(TDPA, 'AC37B543AD', 34, 29)], []);
  const c = causa(grupo(res, 'TDPa frasco unidosis'), 'LOTE_CRUZADO');
  expect(c.map((x) => x.cantidad).sort()).toEqual([3, 5]);
  expect(res.resumen.frascosCruzados).toBe(8);
});

test('Misma diferencia en Normal y A.R.F. del mismo lote → estatus distinto, no faltante', () => {
  const H = 'Hepatitis "B" frasco multidosis';
  const res = diagnosticar([f(H, '2526250606', 22.75, 21.95), { ...f(H, '2526250606', 0, 0.8), categoria: 'ARF' }], [u(H, '2526250606', 'SANTA BARBARA', 0.8, 'ARF')]);
  const g = grupo(res, 'Hepatitis "B" frasco multidosis');
  const c = causa(g, 'CATEGORIA');
  expect(c).toHaveLength(1);
  expect(c[0].cantidad).toBe(0.8);
  expect(c[0].sospechas[0].unidad).toBe('SANTA BARBARA');
  expect(g.explicado).toBe(true);
});

test('Diferencia que NO se cancela → conteo distinto, requiere decisión humana (no se inventa un lote)', () => {
  const H = 'Hexavalente frasco unidosis';
  const res = diagnosticar([f(H, 'Y3A532V', 322, 324), f(TDPA, '3CA38C5', 53, 48)], []);   // unidades declararon 2 de MÁS
  const g = grupo(res, 'Hexavalente frasco unidosis');
  expect(causa(g, 'CONTEO')).toHaveLength(1);
  expect(causa(g, 'CONTEO')[0].sentido).toBe('unidades_mas');
  expect(g.requiereDecision).toBe(true);
  expect(g.explicado).toBe(false);
  expect(causa(g, 'LOTE_CRUZADO')).toHaveLength(0);
  expect(res.grupos[0].biologico).toBe('Hexavalente frasco unidosis'.replace(/\s+/g, ' ')); // lo que pide decisión sale primero
});

test('Sin evidencia suficiente no se adivina: lotes distintos y cantidades distintas quedan como conteo', () => {
  const X = 'Td multidosis';
  const res = diagnosticar([f(X, 'AAAA1111', 10, 7), f(X, 'ZZZZ9999', 0, 5)], []);   // +3 / −5: no se cancela, lotes sin parecido
  const g = grupo(res, 'Td multidosis');
  expect(causa(g, 'LOTE_CRUZADO')).toHaveLength(0);
  expect(causa(g, 'CONTEO')).toHaveLength(1);
});

test('Menos de un frasco → fracción; aplicadas distintas → movimiento', () => {
  const H = 'Hepatitis "B" frasco multidosis';
  const A = 'Hepatitis "A"';
  const res = diagnosticar([f(H, '2526250606', 21.05, 20.4), f(A, 'AHAVC215AA', 220, 220, { mun_aplicadas: 92, uni_aplicadas: 85, tipo: 'UNIDAD_CAMBIO_POSTERIOR' })], []);
  expect(causa(grupo(res, 'Hepatitis "B" frasco multidosis'), 'FRACCION')).toHaveLength(1);
  const m = grupo(res, 'Hepatitis "A"');
  expect(causa(m, 'MOVIMIENTO')).toHaveLength(1);
  expect(m.requiereDecision).toBe(true);
});

test('Sin diferencias no hay panel; con diferencias el HTML explica y no ofrece botones que cambien datos', () => {
  expect(htmlDiagnostico(diagnosticar([], []))).toBe('');
  const html = htmlDiagnostico(diagnosticar([f(TDPA, '3CA38C5', 53, 48), f(TDPA, 'AC37B542BD', 46, 39), f(TDPA, 'AC37B543AD', 12, 24)], []));
  expect(html).toContain('Asistente de revisión');
  expect(html).toContain('no cambia ninguna cifra');
  expect(html).not.toMatch(/<button|<input/);
});

// ---- Integración en la página: el panel aparece arriba del detector y se pide la evidencia por unidad ----
const fs = require('fs');
const path = require('path');
const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

test('En el Movimiento del municipal el asistente aparece sobre el detector y no estorba si la evidencia falla', async ({ page }) => {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
  const filas = [f(TDPA, '3CA38C5', 53, 48), f(TDPA, 'AC37B542BD', 46, 39), f(TDPA, 'AC37B543AD', 12, 24)];
  const correr = (evidenciaFalla) => page.evaluate(async ([disc, falla]) => {
    document.body.insertAdjacentHTML('beforeend', '<div id="cajaDx"></div>');
    window.__rpcs = [];
    estado.db = { rpc: async (n, a) => {
      window.__rpcs.push(n);
      if (n === 'biovac_discrepancias_municipio') return { data: disc, error: null };
      if (n === 'biovac_diagnostico_unidades') { if (falla) throw new Error('sin permiso'); return { data: [], error: null }; }
      return { data: [], error: null };
    } };
    await pintarDiscrepanciasMunicipio(document.getElementById('cajaDx'), 'CORREGIDORA', 10, 2026);
    const caja = document.getElementById('cajaDx');
    const r = { asistente: !!caja.querySelector('.dx-caja'), detector: !!caja.querySelector('.disc-det'), orden: caja.firstElementChild && caja.firstElementChild.className, rpcs: window.__rpcs };
    caja.remove();
    return r;
  }, [filas, evidenciaFalla]);
  const ok = await correr(false);
  expect(ok.asistente).toBe(true);
  expect(ok.detector).toBe(true);                       // el detector de siempre sigue ahí
  expect(ok.orden).toContain('dx-caja');                // y el asistente va arriba
  expect(ok.rpcs).toContain('biovac_diagnostico_unidades');
  const falla = await correr(true);
  expect(falla.asistente).toBe(false);                  // si falla, no rompe nada
  expect(falla.detector).toBe(true);
});

test('Querétaro real: el municipio trae más que sus unidades (almacén municipal) → por confirmar, no "requiere decisión"', () => {
  // SRP 0134N117B: municipio 5651 vs unidades 5377, mismo movimiento (cifras reales de oct-2026)
  const S = 'SRP\nTriple Viral frasco unidosis';
  const res = diagnosticar([f(S, '0134N117B', 5651, 5377, { mun_aplicadas: 233, uni_aplicadas: 233 })], []);
  const g = grupo(res, 'SRP Triple Viral frasco unidosis');
  const c = causa(g, 'CONTEO')[0];
  expect(c.sentido).toBe('municipio_mas');
  expect(c.cantidad).toBe(274);
  expect(c.texto).toContain('almacén municipal');
  expect(c.titulo).not.toContain('no coincide');
  expect(g.requiereDecision).toBe(false);
  expect(g.explicado).toBe(false);          // sigue "por confirmar"
});
