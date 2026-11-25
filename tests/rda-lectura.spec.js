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

test('motor: esquemas de solo dosis — reparto por biológico, municipio, unidades sin dosis y concentración', () => {
  const us = [
    { clues: 'A', nombre: 'UA', municipio: 'Q', adol_hb: 10, adol_sr: 90, adol_vph: 0, adol_td: 0, adol_tdpa: 0 },
    { clues: 'B', nombre: 'UB', municipio: 'Q', adol_hb: 0, adol_sr: 100, adol_vph: 0, adol_td: 0, adol_tdpa: 0 },
    { clues: 'C', nombre: 'UC', municipio: 'M', adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0 }
  ];
  const r = A.analizaDosis(us, 'adultos');
  expect(r.total).toBe(200);
  expect(r.bios.find((b) => b.label === 'SR').total).toBe(190);
  expect(r.bios.find((b) => b.label === 'SR').share).toBeCloseTo(95, 6);
  expect(r.bios.find((b) => b.label === 'SR').aplicaron).toBe(2);
  expect(r.bios.find((b) => b.label === 'HepB').aplicaron).toBe(1);
  expect(r.municipios[0]).toMatchObject({ municipio: 'Q', dosis: 200, unidades: 2 });
  expect(r.sinDosis.map((u) => u.clues)).toEqual(['C']);
  expect(r.titulares.map((t) => t.texto).join('\n')).toMatch(/SR es el biológico que más pesa: 95 %/);
  expect(r.titulares.map((t) => t.texto).join('\n')).toMatch(/1 de 3 unidades no registran ninguna dosis de este esquema: UC/);
  expect(A.analizaDosis(us, 'basico')).toBeNull();
});

test('tabla de detalle: columna FALTAN, filtros por nivel, búsqueda y rótulo de municipio que el PDF no lee como texto', async ({ page }) => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'rda_ui.js'), 'utf8');
  const cuerpo = src.slice(src.indexOf('function _rdaTablaTools'), src.indexOf('// ══════════ EXPORT'));
  expect(cuerpo.length).toBeGreaterThan(500);
  await page.setContent(`<div id="rdaTableContainer"><table id="rdaDetailTable"><thead></thead><tbody id="rdaDetailTbody"></tbody></table></div><span id="rdaTableCount"></span>`);
  // _tablaTools inserta su barra antes del contenedor: necesita un padre
  await page.evaluate(() => { const c = document.getElementById('rdaTableContainer'); const w = document.createElement('div'); c.parentNode.insertBefore(w, c); w.appendChild(c); w.appendChild(document.getElementById('rdaTableCount')); });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'rda_analisis.js') });
  await page.addScriptTag({ content: `var _rdaState={esquema:'basico',vistaBasico:'esquema',sortCol:null,sortAsc:false};var _rdaCache={maxMes:10,anio:2026};var USER={rol:'JURISDICCIONAL'};${cuerpo};window.__render=function(u){renderTable(u,'basico',{cobertura_menor1:50,cobertura_uno:50,cobertura_cuatro:50,cobertura_seis:0});};` });
  const U = (clues, muni, pob, dosis) => ({ clues, nombre: 'U ' + clues, municipio: muni, pob_menor_1: pob, pob_1_ano: pob, pob_4_anos: pob,
    bcg_dosis: dosis, hepb_0_7_dosis: dosis, hexa_3_dosis: dosis, rota_2_dosis: dosis, neumo_2_dosis: dosis, hexa_ref_dosis: dosis, neumo_ref_dosis: dosis, srp_2_dosis: dosis, dpt_4_dosis: dosis });
  // meta al corte por grupo = pob * 0.0833 * 10; con pob 1200 -> 999.6, así que dosis 1000 (~100 %), 800 (~80 %), 100 (~10 %)
  const unidades = [U('A', 'QUERETARO', 1200, 1000), U('B', 'QUERETARO', 1200, 800), U('C', 'CORREGIDORA', 1200, 100)];
  await page.evaluate((u) => window.__render(u), unidades);
  const heads = await page.locator('#rdaDetailTable thead th').allInnerTexts();
  expect(heads.slice(-3)).toEqual(['FALTAN', 'META AL CORTE', 'APLICADAS (EQUIV.)']);
  expect(await page.locator('#rdaDetailTbody tr.rt-fila').count()).toBe(3);
  // el rótulo del municipio es UNA celda con solo el nombre (el PDF lo toma como encabezado de grupo); el resumen va en data-resumen
  const grupo = page.locator('#rdaDetailTbody tr.rt-grupo td').first();
  expect(await grupo.innerText()).toBe('CORREGIDORA');
  expect(await grupo.getAttribute('data-resumen')).toMatch(/1 unidad · 1 crítica/);
  // faltan = meta - aplicadas: C -> 999.6*3 - 100*? (equivalentes: dosis*5/4 + dosis*3/3 + dosis = 3.25*dosis)
  const filaC = page.locator('#rdaDetailTbody tr.rt-fila', { hasText: 'U C' });
  const metaC = Math.round(1200 * 0.0833 * 10 * 3), aplC = Math.round(100 * 5 / 4 + 100 + 100);
  expect(await filaC.locator('td').nth(6).innerText()).toBe((metaC - aplC).toLocaleString('es-MX'));
  // la unidad que superó su meta muestra "+excedente" en vez de un faltante
  const filaA = page.locator('#rdaDetailTbody tr.rt-fila', { hasText: 'U A' });
  expect(await filaA.locator('td').nth(6).innerText()).toMatch(/^\+/);
  // chips: críticas = C solamente (A ~ 100 % óptima, B ~ 80 % regular)
  await expect(page.locator('#rdaTablaTools .rt-chip[data-n="critico"]')).toContainText('1');
  await page.locator('#rdaTablaTools .rt-chip[data-n="critico"]').click();
  expect(await page.locator('#rdaDetailTbody tr.rt-fila').count()).toBe(1);
  await expect(page.locator('#rdaTableCount')).toHaveText('1 de 3 unidades');
  await page.locator('#rdaTablaTools .rt-chip[data-n=""]').click();
  await page.locator('#rdaTablaBusca').fill('u b');
  expect(await page.locator('#rdaDetailTbody tr.rt-fila').count()).toBe(1);
  // la barra de herramientas no entra a las exportaciones
  expect(await page.locator('#rdaTablaTools').getAttribute('class')).toContain('rda-no-export');
  // la fila de total sigue siendo de 3 celdas de texto + columnas y es la última
  expect(await page.locator('#rdaDetailTbody tr[data-rda-total]').count()).toBe(1);
});

test('motor: comparativa 2025 vs 2026 — mejoran/estables/caen con banda de 3 puntos y rankings sin unidades de población mínima', () => {
  const mk = (clues, pob, dosis) => ({ clues, nombre: 'U' + clues, municipio: 'Q', pob_menor_1: pob, pob_1_ano: pob, pob_4_anos: pob, dpt_4_dosis: dosis });
  // grupo de 4 años (divisor 1). 2025 completo (12 meses) y 2026 a 10: meta = pob*0.0833*meses
  const u25 = [mk('A', 1200, 600), mk('B', 1200, 600), mk('C', 1200, 600), mk('D', 4, 1)];
  const u26 = [mk('A', 1200, 900), mk('B', 1200, 600), mk('C', 1200, 100), mk('D', 4, 3), mk('E', 1200, 50)];
  const r = A.comparaAnios(u25, u26, 12, 10);
  const g = r.grupos.find((x) => x.key === 'cuatro');
  expect(g.comparables).toBe(4);                       // E no existía en 2025
  // A: 600/(1200*.0833*12)=50.0% -> 900/(1200*.0833*10)=90.0% (+40); B: 50.0% -> 60.0% (+10); C: 50.0% -> 10.0% (-40); D: 20.8% -> 90.1% (meta < 30 en 2025)
  expect(g.mejoran).toBe(3);
  expect(g.caen).toBe(1);
  expect(g.estables).toBe(0);
  expect(g.mejores[0].clues).toBe('A');                // D no entra a los rankings (meta mínima < 30)
  expect(g.mejores.some((f) => f.clues === 'D')).toBe(false);
  expect(g.peores[0].clues).toBe('C');
  expect(g.peores[0].delta).toBeCloseTo(100 / (1200 * 0.0833 * 10) * 100 - 600 / (1200 * 0.0833 * 12) * 100, 6);
});
