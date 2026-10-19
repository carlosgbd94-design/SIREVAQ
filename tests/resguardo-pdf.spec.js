// PDF de Resguardo (perfil UNIDAD): acumula por biológico+lote y pagina a 18 filas por hoja.
// No necesita navegador: se extrae generarPDFResguardoSR de main.js y se corre en vm con un jsPDF falso.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8').replace(/\r\n/g, '\n');
const extraer = (inicio) => {
  const i = src.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf('\n}\n', i) + 3);
};
const codigo = extraer('async function generarPDFResguardoSR(') + extraer('function getDosesPerVial(');

function generar(existencias, marcas) {
  const hojas = [];      // una entrada por página: filas de la tabla de biológicos
  let paginaActual = -1;
  const doc = {
    addImage() {}, addPage() {}, setFont() {}, setFontSize() {}, setDrawColor() {},
    setLineWidth() {}, setTextColor() {}, line() {}, text() {}, save() {},
    lastAutoTable: { finalY: 50 },
    autoTable(o) {
      if (o.head && o.head[0] && o.head[0][0] && String(o.head[0][0].content || '').includes('CONTROL DE BIOL')) {
        hojas.push(o.body);
      }
    },
  };
  const ctx = {
    console, Math, Number, String, Object, Array, Promise, Map,
    window: {
      COVID_LOTE_MARCA: marcas || null,
      jspdf: { jsPDF: function () { return doc; } },
      supabase: {
        from(t) {
          const q = {
            select() { return q; }, eq() { return q; }, order() { return t === 'biologicos_catalogo' ? Promise.resolve({ data: [] }) : q; },
            limit() { return q; },
            maybeSingle() { return Promise.resolve({ data: { fecha: '2026-10-01' }, error: null }); },
            then(res) { return Promise.resolve({ data: existencias, error: null }).then(res); },
          };
          return q;
        },
      },
    },
    document: { querySelectorAll: () => [] },
    $: () => null,
    USER: { clues: 'QTIMB000001', unidad: 'Unidad de prueba', usuario: 'u' },
    todayYmdLocal: () => '2026-10-08',
    showOverlay() {}, hideOverlay() {}, showToast() {},
    ensurePdfAssetsLoaded: async () => {}, ensureJsPdfLoaded: async () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(codigo + '\nthis.generar = generarPDFResguardoSR;', ctx);
  return ctx.generar([], '', '', true).then(() => hojas);
}

const fila = (biologico, lote, cantidad, fecha) => ({ biologico, lote, cantidad, fecha, clues: 'QTIMB000001' });
const llenas = (hoja) => hoja.filter((r) => r[0] !== '');

test('suma los frascos del mismo biológico+lote sin importar la fecha de entrada', async () => {
  const hojas = await generar([
    fila('BCG', '0374MA108', 5, '2026-09-01'),
    fila('BCG', '0374MA108', 2, '2026-09-15'),
    fila('HEXAVALENTE', 'Y3C48D1', 10, '2026-09-02'),
    fila('HEXAVALENTE', 'Y3C48D1', 10, '2026-09-20'),
    fila('HEXAVALENTE', 'Y3A532V', 14, '2026-09-03'),
  ]);
  // ORIGINAL + COPIA de una sola hoja
  expect(hojas).toHaveLength(2);
  const f = llenas(hojas[0]);
  expect(f).toHaveLength(3);
  const bcg = f.find((r) => r[0] === 'BCG');
  expect(bcg[1]).toBe('7');
  expect(bcg[3]).toBe('0374MA108');
  expect(f.find((r) => r[3] === 'Y3C48D1')[1]).toBe('20');
  expect(f.find((r) => r[3] === 'Y3A532V')[1]).toBe('14');
  expect(hojas[0]).toHaveLength(18);
  expect(hojas[1]).toEqual(hojas[0]);
});

test('con más de 18 biológico-lote genera otro formato con los faltantes (cada uno en ORIGINAL y COPIA)', async () => {
  const filas = [];
  for (let i = 1; i <= 20; i++) filas.push(fila('SRP', `LOTE${String(i).padStart(2, '0')}`, i, '2026-09-01'));
  filas.push(fila('SRP', 'LOTE01', 4, '2026-09-10')); // se acumula, no ocupa fila nueva
  const hojas = await generar(filas);
  expect(hojas).toHaveLength(4);
  expect(llenas(hojas[0])).toHaveLength(18);
  expect(llenas(hojas[2])).toHaveLength(2);
  expect(hojas[1]).toEqual(hojas[0]);
  expect(hojas[3]).toEqual(hojas[2]);
  const todos = [...llenas(hojas[0]), ...llenas(hojas[2])];
  expect(new Set(todos.map((r) => r[3])).size).toBe(20);
  expect(todos.find((r) => r[3] === 'LOTE01')[1]).toBe('5');
});

test('exactamente 18 filas caben en una sola hoja y los lotes en cero no se imprimen', async () => {
  const filas = [];
  for (let i = 1; i <= 18; i++) filas.push(fila('TD', `L${i}`, 1, '2026-09-01'));
  filas.push(fila('TD', 'VACIO', 0, '2026-09-01'));
  const hojas = await generar(filas);
  expect(hojas).toHaveLength(2);
  expect(llenas(hojas[0])).toHaveLength(18);
});

test('COVID-19: Moderna imprime 5 dosis por frasco y Pfizer 6 (según la marca del lote)', async () => {
  const hojas = await generar([
    fila('COVID-19', '3062813', 4, '2026-10-01'),
    fila('COVID-19', 'RP2699', 4, '2026-10-01'),
  ], { '3062813': 'MODERNA', 'RP2699': 'PFIZER' });
  const f = llenas(hojas[0]);
  expect(f.find((r) => r[3] === '3062813')[2]).toBe('20');
  expect(f.find((r) => r[3] === 'RP2699')[2]).toBe('24');
});

test('frascos por meta: niños solo con Moderna (5 dosis), adultos con Pfizer (6)', () => {
  const F = require('../covid_frascos.js');
  // 25 niños (1ª y 2ª dosis) = 25 dosis de 0.5 mL equivalentes = 5 frascos Moderna de cajón
  expect(F.frascosPorMeta({ c1: 25, c2: 25 })).toMatchObject({ moderna: 5, pfizer: 0, total: 5 });
  expect(F.frascosPorMeta({ c1: 25, c2: 25, c3: 10, c4: 20 })).toMatchObject({ moderna: 5, pfizer: 5, total: 10 });
  expect(F.frascosPorMeta({ c4: 13 })).toMatchObject({ moderna: 0, pfizer: 3 });
});

test('cobertura de niños con las cifras reales de la Jurisdicción: Moderna mínimo 13,779 y Pfizer no los cubre', () => {
  const F = require('../covid_frascos.js');
  const juris = { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859, perdida: 3900 };
  const f = F.factorPerdida(juris);
  expect(F.metaMarcaConPerdida(juris, 'MODERNA', f)).toBe(81734);
  const c = F.coberturaNinos(juris, f, 13791);   // lo que entrega la federación
  expect(c.minimo).toBe(13779);
  expect(c.cubierto).toBe(true);
  expect(F.coberturaNinos(juris, f, 13000)).toMatchObject({ cubierto: false, faltan: 779 });
  // Pfizer (2,141 frascos = 12,846 dosis) alcanza para toda la meta adulta con pérdida
  expect(Math.ceil(F.metaMarcaConPerdida(juris, 'PFIZER', f) / 6)).toBe(2141);
});

test('sin meta de niños: no recibe Moderna (tope 0) y se cubre al 100% con Pfizer', () => {
  const F = require('../covid_frascos.js');
  const juris = { c1: 65604, c2: 65604, c3: 4135, c4: 6288, c5: 948, c6: 859, perdida: 3900 };
  const f = F.factorPerdida(juris);
  const hospital = { c4: 300, c6: 66 };                    // 366 dosis, solo adultos (como HENM)
  const sn = F.sinNinos(hospital, f);
  expect(sn.sinNinos).toBe(true);
  expect(sn.pfizerFrascos * 6).toBeGreaterThanOrEqual(366);
  const base = { total: 400, adulto: 400, propiasOtras: 0, otraMarca: 0 };
  expect(F.topeFrascos({ ...base, marca: 'MODERNA', sinNinos: true })).toBe(0);
  expect(F.topeFrascos({ ...base, marca: 'MODERNA', sinNinos: false })).toBeGreaterThan(0);
  expect(F.topeFrascos({ ...base, marca: 'PFIZER', sinNinos: true })).toBeGreaterThan(0);
  // una unidad con niños sí recibe Moderna
  expect(F.sinNinos({ c1: 40, c2: 40, c4: 20 }, f).sinNinos).toBe(false);
  // sin ninguna meta no se marca como "sin niños"
  expect(F.sinNinos({}, f).sinNinos).toBe(false);
});
