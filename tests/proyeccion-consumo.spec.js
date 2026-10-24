// Motor de proyección del consumo mensual (proyeccion_consumo.js): lógica pura, sin navegador.
const { test, expect } = require('@playwright/test');
const P = require('../proyeccion_consumo.js');

// Serie contigua desde (anio, mes) con los valores dados (null = mes sin cargar)
function serie(anio, mes, valores) {
  return valores.map((v, k) => { const m = mes - 1 + k; return { anio: anio + Math.floor(m / 12), mes: (m % 12) + 1, dosis: v }; });
}
const base = { objetivo: { anio: 2026, mes: 10 }, dosisPorFrasco: 10, nivelZ: 1.65, leadSem: 2, leadStdSem: 1 };
const correr = (valores, extra = {}) => P.proyectar({ ...base, serie: serie(2025, 10, valores), ...extra });

test('consumo estable: la proyección es el nivel y el Promedio cubre mes + entrega con colchón', () => {
  const r = correr([100, 102, 98, 101, 99, 100, 103, 97, 100, 101, 99, 100]);   // oct-25 a sep-26
  expect(r.proyeccionDosis).toBeGreaterThan(97);
  expect(r.proyeccionDosis).toBeLessThan(103);
  expect(r.confianza.nivel).toBe('alta');
  // Cubre ~6.3 semanas (4.43 del mes + 2 de entrega): ~145 dosis + colchón → 15 a 19 frascos de 10 dosis
  expect(r.promedioFrascos).toBeGreaterThanOrEqual(15);
  expect(r.promedioFrascos).toBeLessThanOrEqual(19);
  expect(r.minDosis).toBeGreaterThanOrEqual(5);
  expect(r.maxDosis).toBeGreaterThanOrEqual(r.minDosis);
  expect(r.maxDosis).toBeGreaterThanOrEqual(r.componentes.objetivoDosis);
});

test('tendencia al alza: proyecta por arriba del promedio histórico y lo explica', () => {
  const r = correr([60, 66, 70, 78, 84, 90, 96, 104, 110, 118, 124, 130]);
  const promedioHistorico = (60 + 66 + 70 + 78 + 84 + 90 + 96 + 104 + 110 + 118 + 124 + 130) / 12;
  expect(r.proyeccionDosis).toBeGreaterThan(promedioHistorico);
  expect(r.proyeccionDosis).toBeGreaterThan(120);
  expect(r.razones.join(' ')).toMatch(/al alza/);
});

test('un pico atípico de captura se acota y se avisa; no infla el Promedio', () => {
  const limpio = correr([100, 98, 102, 101, 99, 100, 103, 97, 100, 101, 99, 100]);
  const conPico = correr([100, 98, 102, 101, 99, 100, 103, 2500, 100, 101, 99, 100]);
  expect(conPico.banderas).toContain('atipicos');
  expect(conPico.razones.join(' ')).toMatch(/acotó/i);
  expect(conPico.promedioFrascos).toBeLessThanOrEqual(limpio.promedioFrascos + 3);
  expect(conPico.confianza.puntaje).toBeLessThan(limpio.confianza.puntaje);
});

test('un mes de evento (muchas unidades se disparan) se conserva con menor peso, no se trata como error', () => {
  const vals = [100, 98, 102, 101, 99, 100, 103, 400, 100, 101, 99, 100];
  const sinEvento = correr(vals);
  const conEvento = correr(vals, { eventos: ['2026-05'] });   // el 400 cae en mayo de 2026
  expect(sinEvento.banderas).toContain('atipicos');
  expect(conEvento.banderas).toContain('evento');
  expect(conEvento.banderas).not.toContain('atipicos');
  expect(conEvento.razones.join(' ')).toMatch(/evento/i);
});

test('detectarEventos: solo marca el mes en que muchas unidades se disparan a la vez', () => {
  const unidades = [];
  for (let u = 0; u < 10; u++) {
    const v = Array(12).fill(100 + u);
    v[4] = 300 + u * 5;                // mayo-26 sube en las 10
    if (u === 0) v[8] = 900;           // septiembre-26 solo en una (no es evento)
    unidades.push(serie(2025, 10, v));
  }
  expect(P.detectarEventos(unidades)).toEqual(['2026-02']);   // índice 4 de la serie que arranca en octubre = febrero-26
});

test('estacionalidad del grupo: el mes alto del año pasado sube la proyección de ese mes', () => {
  // 10 unidades, 24 meses (oct-24 a sep-26); noviembre siempre 40 % arriba
  const mkUnidad = (nivel) => serie(2024, 10, Array.from({ length: 24 }, (_, k) => {
    const mes = ((9 + k) % 12) + 1;
    return nivel * (mes === 11 ? 1.4 : 1);
  }));
  const unidades = Array.from({ length: 10 }, (_, u) => mkUnidad(100 + u * 4));
  const indice = P.indiceEstacionalGrupo(unidades);
  expect(indice).not.toBeNull();
  expect(indice.factores[11]).toBeGreaterThan(1.2);
  const hist = serie(2024, 10, Array.from({ length: 24 }, (_, k) => 120 * (((9 + k) % 12) + 1 === 11 ? 1.4 : 1)));
  const sinIndice = P.proyectar({ ...base, objetivo: { anio: 2026, mes: 11 }, serie: hist });
  const conIndice = P.proyectar({ ...base, objetivo: { anio: 2026, mes: 11 }, serie: hist, indiceGrupo: indice });
  expect(sinIndice.componentes.tipoEstacionalidad).toBe('propia');                 // sin índice del grupo solo cuenta lo que hizo la unidad
  expect(conIndice.componentes.tipoEstacionalidad).toMatch(/grupo/);
  const octubre = P.proyectar({ ...base, objetivo: { anio: 2026, mes: 10 }, serie: hist, indiceGrupo: indice });
  expect(conIndice.proyeccionDosis).toBeGreaterThan(octubre.proyeccionDosis);   // noviembre pide más que octubre
});

test('cambio de nivel: si los últimos meses ya son otra cosa, no se promedia con el pasado', () => {
  const vals = [100, 98, 102, 101, 99, 100, 103, 97, 100, 200, 205, 198];     // la unidad se duplicó en julio
  const r = correr(vals);
  expect(r.banderas).toContain('cambio_nivel');
  expect(r.proyeccionDosis).toBeGreaterThan(170);
  expect(r.razones.join(' ')).toMatch(/cambio de nivel/i);
});

test('desabasto reciente = demanda subestimada (sube); sobreexistencia baja el Promedio', () => {
  const vals = [100, 98, 102, 101, 99, 100, 103, 97, 100, 101, 99, 100];
  const normal = correr(vals);
  const falto = correr(vals, { senales: { mesesSinExistencia: 3 } });
  const sobra = correr(vals, { senales: { sobreexistencia: true } });
  expect(falto.proyeccionDosis).toBeGreaterThan(normal.proyeccionDosis * 1.15);
  expect(falto.banderas).toContain('desabasto');
  expect(sobra.promedioFrascos).toBeLessThan(normal.promedioFrascos);
  expect(sobra.banderas).toContain('sobreexistencia');
});

test('pocos meses o con huecos: confianza baja y se explica por qué', () => {
  const corto = correr([40, 55, 48]);
  expect(corto.confianza.nivel).toBe('baja');
  expect(corto.banderas).toContain('pocos_datos');
  const huecos = correr([100, null, 102, null, 99, 100, 103, 97, 100, 101, 99, 100]);
  expect(huecos.componentes.huecos).toBe(2);
  expect(huecos.confianza.motivos.join(' ')).toMatch(/sin datos/);
  expect(huecos.confianza.puntaje).toBeLessThan(correr([100, 98, 102, 101, 99, 100, 103, 97, 100, 101, 99, 100]).confianza.puntaje);
});

test('sin consumo: Promedio 0, mínimo en el piso y bandera; sin datos cargados: null', () => {
  const r = correr(Array(12).fill(0));
  expect(r.promedioFrascos).toBe(0);
  expect(r.minDosis).toBe(5);
  expect(r.banderas).toContain('sin_consumo');
  expect(P.proyectar({ ...base, serie: serie(2025, 10, [null, null, null]) })).toBeNull();
});

test('mayor nivel de servicio o entrega más lenta suben el Promedio; frascos de 1 dosis no se dividen', () => {
  const vals = [100, 90, 110, 95, 105, 100, 92, 108, 100, 96, 104, 100];
  const z90 = correr(vals, { nivelZ: 1.28 }), z99 = correr(vals, { nivelZ: 2.33 });
  expect(z99.promedioFrascos).toBeGreaterThan(z90.promedioFrascos);
  const lento = correr(vals, { leadSem: 4 });
  expect(lento.promedioFrascos).toBeGreaterThan(correr(vals).promedioFrascos);
  const monodosis = correr(vals, { dosisPorFrasco: 1 });
  expect(monodosis.promedioFrascos).toBeGreaterThanOrEqual(monodosis.componentes.objetivoDosis);
  expect(monodosis.promedioFrascos).toBeLessThanOrEqual(monodosis.componentes.objetivoDosis + 1);
});

test('mesObjetivo: a partir del día 15 se piensa en el mes que sigue', () => {
  expect(P.mesObjetivo(new Date(2026, 9, 10))).toEqual({ anio: 2026, mes: 10 });
  expect(P.mesObjetivo(new Date(2026, 9, 23))).toEqual({ anio: 2026, mes: 11 });
  expect(P.mesObjetivo(new Date(2026, 11, 20))).toEqual({ anio: 2027, mes: 1 });
});

test('determinista: mismos datos, misma propuesta', () => {
  const vals = [100, 90, 110, 95, 105, 100, 92, 108, 100, 96, 104, 100];
  expect(JSON.stringify(correr(vals))).toBe(JSON.stringify(correr(vals)));
});

test('consumo intermitente con una campaña enorme: la banda y el Promedio no se disparan', () => {
  // Biológico casi sin uso que tuvo una campaña nacional (670 dosis) un solo mes
  const r = correr([0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 670, 54, 18, 3, 16, 0, 7, 0].slice(0, 12).concat([0, 0, 0]).slice(0, 12), {});
  const campana = P.proyectar({ ...base, dosisPorFrasco: 10, objetivo: { anio: 2026, mes: 11 },
    serie: serie(2025, 1, [0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 670, 54, 18, 3, 16, 0, 7, 0]) });
  expect(campana.banda.p95).toBeLessThan(60);
  expect(campana.promedioFrascos).toBeLessThanOrEqual(8);
  expect(campana.minDosis).toBe(5);
  expect(campana.razones.join(' ')).toMatch(/670/);          // el mes de campaña se acota y se explica
  expect(campana.razones.join(' ')).not.toMatch(/junio 2026 \(16/);   // un mes normal para esta unidad no es «atípico»
  expect(r).not.toBeNull();
});

test('detectarMesParcial: el último mes cargado a medias se reconoce; uno normal no', () => {
  const unidades = Array.from({ length: 8 }, () => serie(2026, 1, [100, 110, 95, 105, 100, 98, 102, 100, 30]));
  expect(P.detectarMesParcial(unidades)).toMatchObject({ anio: 2026, mes: 9 });
  const normales = Array.from({ length: 8 }, () => serie(2026, 1, [100, 110, 95, 105, 100, 98, 102, 100, 96]));
  expect(P.detectarMesParcial(normales)).toBeNull();
});
