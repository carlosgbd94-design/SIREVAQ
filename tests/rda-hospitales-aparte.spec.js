// Indicadores RDA: los hospitales (HENM y NHGQ) cuentan APARTE ("HOSPITALES"); Querétaro se limita a sus centros de salud.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function helpers() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'rda_ui.js'), 'utf8');
  const ini = src.indexOf('const RDA_CLUES_HOSPITALES');
  const fin = src.indexOf('async function fetchRDAData');
  expect(ini).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(ini);
  return new Function(`${src.slice(ini, fin)}; return { rdaAparteHospitales_, rdaMunicipalVeHospitales_ };`)();
}

test('RDA: los hospitales salen como su propio grupo y Querétaro queda solo con sus unidades', () => {
  const { rdaAparteHospitales_ } = helpers();
  const filas = [
    { clues: 'QTSSA001740', nombre: 'HENM', municipio: 'QUERÉTARO' },
    { clues: 'QTSSA002901', nombre: 'NHGQ', municipio: 'QUERÉTARO' },
    { clues: 'QTSSA000001', nombre: 'CS JURICA', municipio: 'QUERÉTARO' },
    { clues: 'QTSSA000002', nombre: 'CS HUIMILPAN', municipio: 'HUIMILPAN' }
  ];
  const r = rdaAparteHospitales_(filas);
  expect(r.map((u) => u.municipio)).toEqual(['HOSPITALES', 'HOSPITALES', 'QUERÉTARO', 'HUIMILPAN']);
  expect(r.filter((u) => u.municipio === 'QUERÉTARO').map((u) => u.nombre)).toEqual(['CS JURICA']);
  expect(r).toHaveLength(4);   // la vista jurisdiccional (todos) sigue sumando las 4 filas
  expect(rdaAparteHospitales_(null)).toEqual([]);
});

test('RDA: un municipal solo ve HOSPITALES si está configurado como municipal de los hospitales', () => {
  const { rdaMunicipalVeHospitales_ } = helpers();
  expect(rdaMunicipalVeHospitales_('HOSPITALES', ['QUERETARO'])).toBe(false);
  expect(rdaMunicipalVeHospitales_('HOSPITALES', ['HENM'])).toBe(true);
  expect(rdaMunicipalVeHospitales_('HOSPITALES', ['NHG', 'QUERETARO'])).toBe(true);
  expect(rdaMunicipalVeHospitales_('QUERÉTARO', ['HENM'])).toBe(false);
});
