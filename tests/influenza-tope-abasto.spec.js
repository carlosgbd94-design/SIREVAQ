// Influenza: tope de la captura de la unidad contra lo repartido (frascos x 10 dosis). Lógica pura de influenza_module.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const modulo = fs.readFileSync(path.join(__dirname, '..', 'influenza_module.js'), 'utf8');
function cortar(inicio, fin) {
  const a = modulo.indexOf(inicio);
  expect(a, inicio).toBeGreaterThan(-1);
  return modulo.slice(a, modulo.indexOf(fin, a));
}
const ctx = { window: {}, DOSIS_POR_FRASCO: 10, _influenzaDistribucionCache: [], _influenzaCapturasCache: [] };
vm.createContext(ctx);
vm.runInContext(cortar('function frascoDosisDeCaptura(c)', 'function frascoDosisAplicadas'), ctx);
vm.runInContext(cortar('function influenzaAbastoSemana(fecha, nuevo)', 'function influenzaValidarCaptura'), ctx);

const caps = [
  { fecha: '2026-10-16', valores: { r1: 40, r2: 10 } },   // 50
  { fecha: '2026-10-23', valores: { r1: 30 } },            // 30
  { fecha: '2026-10-30', valores: { r1: 20 } }             // 20 (la semana que se edita)
];

test('sin reparto registrado no hay tope', () => {
  ctx._influenzaDistribucionCache = [];
  ctx._influenzaCapturasCache = caps;
  expect(ctx.influenzaAbastoSemana('2026-10-30', 500)).toBeNull();
});

test('abasto: repartido = frascos x 10; aplicado = otras semanas + lo de esta semana', () => {
  ctx._influenzaDistribucionCache = [{ cantidad_frascos: 6 }, { cantidad_frascos: 4 }];   // 100 dosis
  ctx._influenzaCapturasCache = caps;
  let a = ctx.influenzaAbastoSemana('2026-10-30', 20);
  expect(a).toMatchObject({ frascos: 10, rep: 100, otras: 80, previo: 20, total: 100, exceso: 0, quedan: 0, sube: false });
  a = ctx.influenzaAbastoSemana('2026-10-30', 25);
  expect(a).toMatchObject({ total: 105, exceso: 5, sube: true });
  // lo ya guardado por encima del reparto no "sube": no se bloquea mientras no aumente
  ctx._influenzaDistribucionCache = [{ cantidad_frascos: 5 }];   // 50 dosis, ya van 100
  a = ctx.influenzaAbastoSemana('2026-10-30', 20);
  expect(a.exceso).toBe(50);
  expect(a.sube).toBe(false);
  // semana nueva (sin reporte previo): cualquier cifra sube
  a = ctx.influenzaAbastoSemana('2026-11-06', 1);
  expect(a).toMatchObject({ previo: 0, otras: 100, sube: true });
});
