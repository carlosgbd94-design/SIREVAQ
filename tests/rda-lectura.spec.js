// "Lectura del corte" de Indicadores RDA (rda_analisis.js en Node + rda_lectura_ui.js en una página mínima).
// Las cifras esperadas se calculan a mano aquí, no con el módulo.
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require('../rda_analisis.js');

// pob_menor_1 = 1200 -> meta anual 1200*0.0833*12 = 1199.52; a 10 meses la meta al corte es 999.6
const U = (clues, municipio, pob, dosis) => ({
  clues, nombre: 'U ' + clues, municipio,
  pob_menor_1: pob, pob_1_ano: pob, pob_4_anos: pob,
  bcg_dosis: dosis, hepb_0_7_dosis: dosis, hexa_3_dosis: dosis, rota_2_dosis: dosis, neumo_2_dosis: dosis, // x5 / 4
  hexa_ref_dosis: dosis, neumo_ref_dosis: dosis, srp_2_dosis: dosis,                                         // x3 / 3
  dpt_4_dosis: dosis
});
const UNIDADES = [
  U('A', 'QUERETARO', 1200, 200),   // eq <1: 1000/4... = 5*200/4 = 250
  U('B', 'QUERETARO', 1200, 800),   // eq <1: 1000 -> ~100 % del corte
  U('C', 'CORREGIDORA', 600, 100),
  U('D', 'CORREGIDORA', 600, 400),
  U('E', 'MARQUÉS', 600, 600),
  U('F', 'HUIMILPAN', 600, 300),
  U('H', 'HOSPITALES', 0, 50)        // sin población meta: no entra al semáforo
];

test('motor: avance, brecha, semáforo, ritmo y proyección coinciden con el cálculo a mano', () => {
  const r = A.analiza(UNIDADES, 10, { anio: 2026 });
  const g = r.grupos.find((x) => x.key === 'cuatro'); // divisor 1: eq = dpt
  const pob = 1200 + 1200 + 600 * 4;                  // 4800
  const meta = pob * 0.0833 * 10;                     // 3998.4
  const eq = 200 + 800 + 100 + 400 + 600 + 300 + 50;  // 2450 (el hospital suma dosis)
  expect(g.meta).toBeCloseTo(meta, 6);
  expect(g.eq).toBe(eq);
  expect(g.avance).toBeCloseTo(eq / meta * 100, 6);
  expect(g.unidadesConMeta).toBe(6);                  // el hospital no entra
  expect(g.ritmo).toBeCloseTo(eq / 10, 6);
  expect(g.proyeccion).toBeCloseTo(eq + eq / 10 * 2, 6);
  expect(g.anual).toBeCloseTo(pob * 0.0833 * 12, 6);
  expect(g.ritmoNecesario).toBeCloseTo((pob * 0.0833 * 12 - eq) / 2, 6);
  expect(g.factorRitmo).toBeCloseTo(g.ritmoNecesario / g.ritmo, 6);
  // semáforo: cortes 95 / 75 -> B (800 de 999.6) y D (400 de 499.8) = 80 % regulares; E (600 de 499.8) óptimo; A, C y F críticas
  expect(g.niveles).toEqual({ optimo: 1, regular: 2, critico: 3 });
  // la mayor brecha es A: 999.6 - 200
  expect(g.topBrecha[0].clues).toBe('A');
  expect(g.topBrecha[0].brecha).toBeCloseTo(1199.52 / 12 * 10 - 200, 4);
  // E superó su meta: no tiene brecha
  expect(g.topBrecha.some((f) => f.clues === 'E')).toBe(false);
  // los municipios se ordenan por brecha, y HOSPITALES no aparece (sin meta)
  expect(g.municipios[0].municipio).toBe('QUERETARO');
  expect(g.municipios.some((m) => m.municipio === 'HOSPITALES')).toBe(false);
});

test('motor: al cierre de año no hay ritmo pendiente ni proyección distinta; con 2025 se agrega el grupo de 6 años', () => {
  const r = A.analiza(UNIDADES, 12, { anio: 2025 });
  expect(r.grupos.map((g) => g.key)).toEqual(['menor1', 'uno', 'cuatro', 'seis']);
  const g = r.grupos[2];
  expect(g.restantes).toBe(0);
  expect(g.ritmoNecesario).toBeNull();
  expect(g.proyeccion).toBeCloseTo(g.eq, 6);
});

test('motor: titulares con ritmo, concentración, municipio y unidad; sin unidades no inventa nada', () => {
  const r = A.analiza(UNIDADES, 10, { anio: 2026 });
  const txt = r.titulares.map((t) => t.texto).join('\n');
  expect(txt).toMatch(/Quedan 2 meses/);
  expect(txt).toMatch(/QUERETARO aporta \d+ %/);
  expect(txt).toMatch(/es la unidad con más rezago/);
  expect(A.analiza([], 10, {}).titulares).toEqual([]);
});

test('pantalla: pinta una tarjeta por grupo, semáforo y la unidad con más rezago; con una sola unidad omite listas', async ({ page }) => {
  await page.setContent('<div id="rdaDashboardContent"><div id="rdaKpiGrid"></div><div id="rdaAnalysisGrid"></div></div>');
  await page.addScriptTag({ path: path.join(__dirname, '..', 'rda_analisis.js') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'rda_lectura_ui.js') });
  await page.evaluate((u) => window.renderRdaLectura(u, 10, 2026), UNIDADES);
  await expect(page.locator('#rdaLecturaCorte .rl-card')).toHaveCount(3);
  await expect(page.locator('#rdaLecturaCorte')).toContainText('Corte a octubre · 10 de 12 meses');
  await expect(page.locator('.rl-card[data-rl="cuatro"] .rl-semaforo .rl-seg')).toHaveCount(3);
  await expect(page.locator('.rl-card[data-rl="cuatro"] .rl-fila').first()).toContainText('U A');
  // una sola unidad: sin semáforo ni lista de rezago
  await page.evaluate((u) => window.renderRdaLectura([u], 10, 2026), UNIDADES[0]);
  await expect(page.locator('#rdaLecturaCorte .rl-card')).toHaveCount(3);
  await expect(page.locator('#rdaLecturaCorte .rl-semaforo')).toHaveCount(0);
  await expect(page.locator('#rdaLecturaCorte .rl-fila')).toHaveCount(0);
  // no queda duplicado al repintar y se puede quitar
  expect(await page.locator('#rdaLecturaCorte').count()).toBe(1);
  await page.evaluate(() => window.removeRdaLectura());
  expect(await page.locator('#rdaLecturaCorte').count()).toBe(0);
});
