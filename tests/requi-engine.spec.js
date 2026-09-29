// Motor puro de requisiciones (requi_engine.js): pegado desde Excel, reconocimiento
// de biológicos y reparto proporcional. Sin navegador ni red.
const { test, expect } = require('@playwright/test');
const E = require('../requi_engine.js');

const catalogo = [
  { nombre: 'VACUNA TRIPLE VIRAL 1DS (SRP)', codigo_articulo: '3820', clave_articulo: '25311.020-000-3820-00' },
  { nombre: 'VACUNA DOBLE VIRAL  (SR)', codigo_articulo: '3800', clave_articulo: '25311.020-000-3800-00' },
  { nombre: 'VACUNA TD', codigo_articulo: '3810', clave_articulo: '25311.020-000-3810-00' },
  { nombre: 'VACUNA HEXAVALENTE', codigo_articulo: '6135', clave_articulo: '25311.020-000-6135-00' }
];

test('resolverBiologico: abreviatura, nombre, clave; sin falsos positivos con lotes', () => {
  expect(E.resolverBiologico('srp', catalogo).codigo_articulo).toBe('3820');
  expect(E.resolverBiologico('SR', catalogo).codigo_articulo).toBe('3800');
  expect(E.resolverBiologico('hexavalente', catalogo).codigo_articulo).toBe('6135');
  expect(E.resolverBiologico('25311.020-000-3810-00', catalogo).codigo_articulo).toBe('3810');
  expect(E.resolverBiologico('A1TD22', catalogo)).toBeNull();      // un lote no es TD
  expect(E.resolverBiologico('viral', catalogo)).toBeNull();       // ambiguo (SR y SRP)
});

test('parsearPegado: tabulaciones, punto y coma y espacios dobles; ignora la línea final vacía', () => {
  expect(E.parsearPegado('a\tb\tc\n1\t2\t3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  expect(E.parsearPegado('a;b\n')).toEqual([['a', 'b']]);
  expect(E.parsearPegado('HEXA  AB12  1250')).toEqual([['HEXA', 'AB12', '1250']]);
  expect(E.parsearEntero('1,250')).toBe(1250);
  expect(E.parsearEntero('12.5')).toBeNull();
  expect(E.parsearEntero('')).toBeNull();
});

test('detectarFilasSurtido: columnas en cualquier orden, encabezados ignorados', () => {
  const filas = E.parsearPegado(['Biologico\tLote\tCad\tCant', 'HEXAVALENTE\t0374MA109\tfeb-27\t1,250', '300\tSRP\t02/27\tAB123', '\tX9\t\t50', 'SRP\t\t\t10'].join('\n'));
  const r = E.detectarFilasSurtido(filas, catalogo, catalogo[2]);
  expect(r.length).toBe(4); // el encabezado no cuenta
  expect(r[0]).toMatchObject({ lote: '0374MA109', caducidadTexto: 'feb-27', cantidad: 1250, error: '' });
  expect(r[0].bio.codigo_articulo).toBe('6135');
  expect(r[1]).toMatchObject({ lote: 'AB123', caducidadTexto: '02/27', cantidad: 300, error: '' });
  expect(r[1].bio.codigo_articulo).toBe('3820');
  expect(r[2].bio.codigo_articulo).toBe('3810'); // biológico por defecto
  expect(r[3].error).toMatch(/lote/i);
});

test('repartirProporcional: enteros, suma exacta, sin base = null', () => {
  expect(E.repartirProporcional(10, [1, 1, 1])).toEqual([4, 3, 3]);
  expect(E.repartirProporcional(7, [5, 0, 2])).toEqual([5, 0, 2]);
  expect(E.repartirProporcional(100, [60, 20, 10, 30, 0, 0])).toEqual([50, 17, 8, 25, 0, 0]);
  const r = E.repartirProporcional(1001, [3, 5, 7]);
  expect(r.reduce((a, b) => a + b, 0)).toBe(1001);
  expect(E.repartirProporcional(10, [0, 0])).toBeNull();
  expect(E.repartirProporcional(0, [1, 2])).toBeNull();
});
