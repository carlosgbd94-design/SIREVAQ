// Exportar existencia por lote (unidad, municipio o jurisdicción; todos los biológicos o solo los lotes elegidos).
// Sin navegador: se extraen las funciones de main.js y se corren en vm con un Supabase y un ExcelJS falsos.
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
const linea = (inicio) => {
  const i = src.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf('\n', i) + 1);
};
const codigo = [
  linea('const EXPORT_HOSPITALES ='),
  extraer('function exportNormText_('), extraer('function exportMunicipioEfectivo_('), extraer('function exportRowEnSeleccion_('),
  extraer('function getSelectedExportMunicipios('), extraer('function canSeeMunicipio_('), extraer('async function fetchAllRows('), extraer('function getDosesPerVial('),
  linea('const SRL ='), extraer('const SRL_COLORES ='), linea('const srlR2_ ='), extraer('function srlClave_('), extraer('function srlNorm_('), extraer('function srlRango_('),
  extraer('async function srlCargarDatos_('), extraer('async function srlOrdenBiologicos_('), extraer('function srlOrdenar_('),
  extraer('function srlFiltrar_('), extraer('async function exportarExistenciaPorLote_('),
].join('\n');

// ExcelJS mínimo: guarda lo que se escribe en cada celda.
function libroFalso(hojas) {
  class Hoja {
    constructor(nombre) { this.nombre = nombre; this.celdas = {}; this.cols = {}; this.rows = {}; hojas.push(this); }
    getCell(a, b) {
      let k = a;
      if (typeof a === 'string') { const m = /^([A-Z]+)(\d+)$/.exec(a); k = `${m[2]},${m[1].charCodeAt(0) - 64}`; } else k = `${a},${b}`;
      return (this.celdas[k] = this.celdas[k] || {});
    }
    getColumn(n) { return (this.cols[n] = this.cols[n] || { letter: String.fromCharCode(64 + n) }); }
    getRow(n) { return (this.rows[n] = this.rows[n] || {}); }
    mergeCells() {}
    valor(f, c) { const x = this.celdas[`${f},${c}`]; return x ? x.value : undefined; }
    fila(f, n) { return Array.from({ length: n }, (_, i) => this.valor(f, i + 1)); }
  }
  return function Workbook() { this.addWorksheet = (n) => new Hoja(n); this.xlsx = { writeBuffer: async () => new Uint8Array([1]) }; };
}

const DET = [
  // Unidad A (Querétaro): dos capturas; solo cuenta la última (2026-11-16), con dos entradas del mismo lote.
  { id: 1, clues: 'QTSSA000001', unidad: 'Centro A', municipio: 'QUERETARO', fecha: '2026-11-09', biologico: 'BCG', lote: 'L-OLD', cantidad: 99, capturado_por: 'ANA' },
  { id: 2, clues: 'QTSSA000001', unidad: 'Centro A', municipio: 'QUERETARO', fecha: '2026-11-16', biologico: 'BCG', lote: 'bcg1', cantidad: 5, capturado_por: 'ANA' },
  { id: 3, clues: 'QTSSA000001', unidad: 'Centro A', municipio: 'QUERETARO', fecha: '2026-11-16', biologico: 'BCG', lote: 'BCG1', cantidad: 2, capturado_por: 'ANA' },
  { id: 4, clues: 'QTSSA000001', unidad: 'Centro A', municipio: 'QUERETARO', fecha: '2026-11-16', biologico: 'HEXAVALENTE', lote: 'HX1', cantidad: 3, capturado_por: 'ANA' },
  // Unidad B (Querétaro) y unidad C (Corregidora).
  { id: 5, clues: 'QTSSA000002', unidad: 'Centro B', municipio: 'QUERETARO', fecha: '2026-11-12', biologico: 'BCG', lote: 'BCG1', cantidad: 4, capturado_por: 'LUIS' },
  { id: 6, clues: 'QTSSA000003', unidad: 'Centro C', municipio: 'CORREGIDORA', fecha: '2026-11-15', biologico: 'HEXAVALENTE', lote: 'HX2', cantidad: 6, capturado_por: 'EVA' },
  { id: 7, clues: 'QTSSA000003', unidad: 'Centro C', municipio: 'CORREGIDORA', fecha: '2026-11-15', biologico: 'TD', lote: 'TD9', cantidad: 0, capturado_por: 'EVA' },
];

async function correr({ rol = 'JURISDICCIONAL', municipio = '', municipios = [], clues = '', desmarcados = [] } = {}) {
  const hojas = [];
  const salida = { archivos: [], toasts: [] };
  const consultas = [];
  const ctx = {
    console, Math, Number, String, Object, Array, Promise, Map, Set, Date, Uint8Array,
    Blob: class { constructor(p) { this.p = p; } },
    ExcelJS: { Workbook: libroFalso(hojas) },
    window: {
      ExcelJS: { Workbook: libroFalso(hojas) },
      URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
      supabase: {
        from(t) {
          const q = {
            _t: t,
            select() { return q; }, gte() { return q; }, lte() { return q; }, order() { return q; },
            eq(c, v) { consultas.push(['eq', c, v]); return q; }, in(c, v) { consultas.push(['in', c, v]); return q; },
            range(d, h) { return Promise.resolve({ data: (t === 'existencia_detalle' ? DET : []).slice(d, h + 1), error: null }); },
            then(res) { return Promise.resolve({ data: t === 'biologicos_catalogo' ? [{ biologico: 'BCG' }, { biologico: 'HEXAVALENTE' }, { biologico: 'TD' }] : [], error: null }).then(res); },
          };
          return q;
        },
      },
    },
    document: {
      querySelectorAll: (sel) => (sel === '.exportMunicipioChk:checked' ? municipios.map((value) => ({ value })) : sel === '.exportMunicipioChk' ? new Array(3).fill({}) : []),
      createElement: () => ({ click() { salida.archivos.push(this.download); } }),
    },
    $: (id) => (id === 'exportSrlUnidad' ? { value: clues } : id === 'exportFechaInicio' ? { value: '2026-11-11' } : id === 'exportFechaFin' ? { value: '2026-11-17' } : null),
    USER: { rol, municipio, clues: 'QTSSA000001' },
    normalizeText: (s) => String(s || '').trim().toUpperCase(),
    todayYmdLocal: () => '2026-11-18',
    ensureLibsLoaded: async () => {}, showToast: (m) => salida.toasts.push(m),
  };
  vm.createContext(ctx);
  vm.runInContext(codigo + '\nthis.SRL = SRL; this.srlClave_ = srlClave_; this.exportar = exportarExistenciaPorLote_;', ctx);
  desmarcados.forEach(([b, l]) => ctx.SRL.desmarcados.add(ctx.srlClave_(b, l)));
  await ctx.exportar();
  return { hojas, ...salida, consultas };
}

test('jurisdicción completa: toma la última captura de cada unidad y acumula el mismo lote', async () => {
  const r = await correr();
  const [det, res] = r.hojas;
  expect(det.valor(2, 1)).toBe('TODA LA JURISDICCIÓN');
  // Querétaro: A (BCG1=7, HX1=3), B (BCG1=4); Corregidora: C (HX2=6; TD en cero no sale; L-OLD queda fuera).
  const filas = [5, 6, 7, 8].map((f) => det.fila(f, 7));
  expect(filas).toEqual([
    ['CORREGIDORA', 'QTSSA000003', 'CENTRO C', 'HEXAVALENTE', 'HX2', 6, 6],
    ['QUERETARO', 'QTSSA000001', 'CENTRO A', 'BCG', 'BCG1', 7, 70],
    ['QUERETARO', 'QTSSA000001', 'CENTRO A', 'HEXAVALENTE', 'HX1', 3, 3],
    ['QUERETARO', 'QTSSA000002', 'CENTRO B', 'BCG', 'BCG1', 4, 40],
  ]);
  expect(det.valor(9, 1)).toBe('TOTAL');
  expect(det.valor(9, 6).result).toBe(20);
  expect(det.valor(9, 6).formula).toBe('SUM(F5:F8)');
  // Resumen por lote: BCG1 suma las dos unidades.
  expect(res.fila(5, 5)).toEqual(['BCG', 'BCG1', 2, 11, 110]);
  expect(res.fila(6, 5)).toEqual(['HEXAVALENTE', 'HX1', 1, 3, 3]);
  expect(r.archivos).toEqual(['Existencia por lote - TODA LA JURISDICCIÓN - 2026-11-17.xlsx']);
});

test('una sola unidad', async () => {
  const r = await correr({ clues: 'QTSSA000002' });
  const det = r.hojas[0];
  expect(det.valor(2, 1)).toBe('UNIDAD: CENTRO B (QTSSA000002)');
  expect(det.fila(5, 6)).toEqual(['QUERETARO', 'QTSSA000002', 'CENTRO B', 'BCG', 'BCG1', 4]);
  expect(det.valor(6, 1)).toBe('TOTAL');
  expect(r.archivos[0]).toBe('Existencia por lote - CENTRO B - 2026-11-17.xlsx');
});

test('un municipio (de los 3 marcados solo 1)', async () => {
  const r = await correr({ municipios: ['CORREGIDORA'] });
  const det = r.hojas[0];
  expect(det.valor(2, 1)).toBe('MUNICIPIO: CORREGIDORA');
  expect(det.fila(5, 6)).toEqual(['CORREGIDORA', 'QTSSA000003', 'CENTRO C', 'HEXAVALENTE', 'HX2', 6]);
  expect(det.valor(6, 1)).toBe('TOTAL');
});

test('solo los lotes elegidos: los desmarcados no salen', async () => {
  const r = await correr({ desmarcados: [['BCG', 'BCG1'], ['HEXAVALENTE', 'HX2']] });
  const det = r.hojas[0];
  expect(det.fila(5, 6)).toEqual(['QUERETARO', 'QTSSA000001', 'CENTRO A', 'HEXAVALENTE', 'HX1', 3]);
  expect(det.valor(6, 1)).toBe('TOTAL');
});

test('perfil municipal: solo ve su municipio aunque la consulta traiga otros', async () => {
  const r = await correr({ rol: 'MUNICIPAL', municipio: 'CORREGIDORA' });
  const det = r.hojas[0];
  expect(det.valor(2, 1)).toBe('MUNICIPIO: CORREGIDORA');
  expect(det.fila(5, 6)).toEqual(['CORREGIDORA', 'QTSSA000003', 'CENTRO C', 'HEXAVALENTE', 'HX2', 6]);
  expect(det.valor(6, 1)).toBe('TOTAL');
  // y la consulta al servidor ya viene acotada a su municipio
  expect(r.consultas).toContainEqual(['in', 'municipio', ['CORREGIDORA']]);
});

test('sin existencias con esos filtros avisa y no descarga nada', async () => {
  const r = await correr({ desmarcados: [['BCG', 'BCG1'], ['HEXAVALENTE', 'HX1'], ['HEXAVALENTE', 'HX2']] });
  expect(r.archivos).toEqual([]);
  expect(r.toasts[0]).toMatch(/No se encontraron existencias/);
});
