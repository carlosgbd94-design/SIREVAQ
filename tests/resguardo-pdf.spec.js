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

function generar(existencias) {
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
