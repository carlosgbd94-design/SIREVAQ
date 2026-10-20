// Kardex 2026 (requisiciones_kardex_excel.js): tarjetas por biológico y mes, con un bloque por entrega,
// entradas "CAMARA FRIA" por lote y salidas por unidad / por municipio con saldo corrido.
const { test, expect } = require('@playwright/test');
const ExcelJS = require('exceljs');
const { armarModelo, generar } = require('../requisiciones_kardex_excel.js');

const catalogo = [
  { id: 'bcg', codigo_articulo: '3801', nombre: 'VACUNA BCG', clave_articulo: '25311.020-000-3801-01', orden: 8 },
  { id: 'hexa', codigo_articulo: '6135', nombre: 'VACUNA HEXAVALENTE', clave_articulo: '25311.020-000-6135-00', orden: 4 },
  { id: 'pfi', codigo_articulo: '6506', nombre: 'VACUNA COVID-19 PFIZER', clave_articulo: '25311.020-000-6506-00', orden: 20 }
];
const unidades = [
  { id: 'u1', nombre: 'LOS OLVERA', municipio: 'CORREGIDORA' },
  { id: 'u2', nombre: 'EMILIANO ZAPATA', municipio: 'CORREGIDORA' },
  { id: 'u3', nombre: 'JURICA', municipio: 'QUERETARO' },
  { id: 'u4', nombre: 'HENM', municipio: 'HENM' },
  { id: 'u5', nombre: 'LAGUNILLAS', municipio: 'HUIMILPAN' }
];
const lote = (n, cad) => ({ numero_lote: n, caducidad: cad });
const requisiciones = [
  { id: 'r9', anio: 2026, mes: 9, entrega: 1, fecha_envio: '2026-09-04', folio_oracle: 'VC/0033/2026' },
  { id: 'r10', anio: 2026, mes: 10, entrega: 1, fecha_envio: '2026-10-05', folio_oracle: 'VC/0040/2026' },
  { id: 'r10b', anio: 2026, mes: 10, entrega: 2, fecha_envio: '2026-10-16', folio_oracle: 'E-VC/0041/2026' },
  { id: 'vacia', anio: 2026, mes: 8, entrega: 1, fecha_envio: null, folio_oracle: null }
];
const it = (r, b, l, n, cad) => ({ requisicion_id: r, requi_biologico_id: b, lote_id: l, cantidad_surtida: n, requi_lotes: lote(l, cad) });
const items = [
  it('r9', 'bcg', 'BCG1', 100, '2027-03-01'),
  it('r10', 'bcg', 'BCG2', 60, '2027-03-01'),
  it('r10b', 'bcg', 'BCG2', 40, '2027-03-01'),
  it('r10', 'hexa', 'HX1', 30, '2027-12-01'), it('r10', 'hexa', 'HX2', 20, '2027-10-01'),
  it('r10', 'pfi', 'PF1', 10, '2027-08-13')
];
const dm = (r, m, b, l, n) => ({ requisicion_id: r, municipio: m, requi_biologico_id: b, lote_id: l, cantidad: n });
const du = (r, u, b, l, n) => ({ requisicion_id: r, unidad_id: u, requi_biologico_id: b, lote_id: l, cantidad: n });
const distMunicipio = [
  dm('r9', 'CORREGIDORA', 'bcg', 'BCG1', 40), dm('r9', 'QUERETARO', 'bcg', 'BCG1', 50), dm('r9', 'HENM', 'bcg', 'BCG1', 10),
  dm('r10', 'CORREGIDORA', 'bcg', 'BCG2', 20), dm('r10', 'QUERETARO', 'bcg', 'BCG2', 30), dm('r10', 'HUIMILPAN', 'bcg', 'BCG2', 10),
  dm('r10b', 'QUERETARO', 'bcg', 'BCG2', 40),
  dm('r10', 'CORREGIDORA', 'hexa', 'HX1', 10), dm('r10', 'CORREGIDORA', 'hexa', 'HX2', 5), dm('r10', 'QUERETARO', 'hexa', 'HX1', 20),
  dm('r10', 'NHG', 'pfi', 'PF1', 10)
];
const distUnidad = [
  du('r9', 'u1', 'bcg', 'BCG1', 25), du('r9', 'u2', 'bcg', 'BCG1', 15), du('r9', 'u3', 'bcg', 'BCG1', 50), du('r9', 'u4', 'bcg', 'BCG1', 10),
  du('r10', 'u1', 'bcg', 'BCG2', 20), du('r10', 'u3', 'bcg', 'BCG2', 12),            // Querétaro: faltan 18 por repartir
  du('r10', 'u1', 'hexa', 'HX1', 10), du('r10', 'u1', 'hexa', 'HX2', 5), du('r10', 'u3', 'hexa', 'HX1', 20)
];
const entrada = { anio: 2026, catalogo, requisiciones, items, distMunicipio, distUnidad, unidades };

async function abrir(modelo, nivel) {
  const buffer = await generar(modelo, { ExcelJS, nivel, responsable: 'MTRA. LIZBETH URIBE PANTOJA' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}
// Filas "de datos" de una hoja: [B, C, D, F, H, I, J, L, O] (sin encabezados).
function renglones(ws) {
  const v = (c) => { const x = c.value; return x && typeof x === 'object' && x.formula ? (x.result || 0) : (x instanceof Date ? x.toISOString().slice(0, 10) : x); };
  const filas = [];
  ws.eachRow((row, n) => {
    const b = v(row.getCell(2));
    if (b === 'SALDO ANTERIOR' || b === 'CAMARA FRIA' || b === 'JS-1') filas.push({ n, b, fecha: v(row.getCell(3)), lote: v(row.getCell(4)), f: v(row.getCell(6)), dosisE: v(row.getCell(7)), destino: v(row.getCell(8)), j: v(row.getCell(10)), k: v(row.getCell(11)), l: v(row.getCell(12)), m: v(row.getCell(13)), obs: v(row.getCell(15)) });
  });
  return filas;
}

test('modelo: una hoja por biológico (en el orden del catálogo), tarjetas por mes y saldo anterior arrastrado', () => {
  const m = armarModelo(entrada);
  expect(m.hojas.map((h) => h.hoja)).toEqual(['HEXAVALENTE', 'BCG', 'COVID-19 PFIZER']);
  const bcg = m.hojas.find((h) => h.hoja === 'BCG');
  expect(bcg.tarjetas.map((t) => [t.mes, t.saldoAnterior])).toEqual([[9, 0], [10, 0]]); // sep: 100 entra y 100 sale
  expect(bcg.dpf).toBe(10);
  expect(m.hojas.find((h) => h.hoja === 'COVID-19 PFIZER').dpf).toBe(6);
  expect(m.hojas.find((h) => h.hoja === 'HEXAVALENTE').dpf).toBe(1);
});

test('POR UNIDAD: entrada con folio/fecha/lote/caducidad, salidas por unidad y saldo corrido', async () => {
  const wb = await abrir(armarModelo(entrada), 'UNIDAD');
  const rows = renglones(wb.getWorksheet('BCG'));
  // Septiembre
  const sep = rows.slice(0, rows.findIndex((r, i) => i > 0 && r.b === 'SALDO ANTERIOR'));
  expect(sep[0]).toMatchObject({ b: 'SALDO ANTERIOR', l: 0 });
  expect(sep[1]).toMatchObject({ b: 'CAMARA FRIA', fecha: '2026-09-04', lote: 'BCG1', f: 100, dosisE: 1000, destino: 'JS-1', l: 100, m: 1000, obs: 'VC/0033/2026' });
  const salidas = sep.slice(2);
  expect(salidas.map((s) => [s.destino, s.obs, s.j, s.k, s.l])).toEqual([
    ['CORREGIDORA', 'EMILIANO ZAPATA', 15, 150, 85],
    ['CORREGIDORA', 'LOS OLVERA', 25, 250, 60],
    ['QUERETARO', 'JURICA', 50, 500, 10],
    ['QUERETARO', 'HENM', 10, 100, 0] // el hospital va bajo QUERETARO, como en los kardex hechos a mano
  ]);
  expect(salidas.every((s) => s.b === 'JS-1')).toBe(true);
});

test('dos entregas en el mes = dos bloques en la misma tarjeta; lo no repartido a unidades se avisa y cuadra el saldo', async () => {
  const modelo = armarModelo(entrada);
  const wb = await abrir(modelo, 'UNIDAD');
  const rows = renglones(wb.getWorksheet('BCG'));
  const oct = rows.slice(rows.findIndex((r, i) => i > 0 && r.b === 'SALDO ANTERIOR'));
  expect(oct.filter((r) => r.b === 'CAMARA FRIA').map((r) => [r.fecha, r.lote, r.f, r.obs])).toEqual([
    ['2026-10-05', 'BCG2', 60, 'VC/0040/2026'], ['2026-10-16', 'BCG2', 40, 'E-VC/0041/2026']
  ]);
  const sin = oct.find((r) => r.obs === 'SIN REPARTIR A UNIDADES' && r.destino === 'QUERETARO');
  expect(sin).toMatchObject({ destino: 'QUERETARO', j: 18 });
  // Entregas 1 y 2: 60 + 40 entran, salen 20+30+10 y 40 -> queda 0 al final
  expect(oct[oct.length - 1].l).toBe(0);
  expect(modelo.avisos.some((a) => a.includes('18 frascos de QUERETARO'))).toBe(true);
});

test('varios lotes: una entrada por lote, salidas sumadas por unidad con el desglose por lote', async () => {
  const wb = await abrir(armarModelo(entrada), 'UNIDAD');
  const rows = renglones(wb.getWorksheet('HEXAVALENTE'));
  expect(rows.filter((r) => r.b === 'CAMARA FRIA').map((r) => [r.lote, r.f])).toEqual([['HX1', 30], ['HX2', 20]]);
  const olvera = rows.find((r) => r.destino === 'CORREGIDORA');
  expect(olvera).toMatchObject({ j: 15, obs: 'LOS OLVERA (HX1: 10 / HX2: 5)' });
});

test('POR MUNICIPIO: una salida por municipio, hospitales dentro de QUERETARO con su desglose', async () => {
  const wb = await abrir(armarModelo(entrada), 'MUNICIPIO');
  const sep = renglones(wb.getWorksheet('BCG')).filter((r) => r.b === 'JS-1').slice(0, 2);
  expect(sep.map((s) => [s.destino, s.j, s.obs || ''])).toEqual([['CORREGIDORA', 40, ''], ['QUERETARO', 60, 'INCLUYE HENM 10']]);
  const pf = renglones(wb.getWorksheet('COVID-19 PFIZER'));
  expect(pf.find((r) => r.b === 'JS-1')).toMatchObject({ destino: 'QUERETARO', j: 10, k: 60, obs: 'INCLUYE NHGQ 10' });
});

test('encabezado de la tarjeta: biológico, clave, responsable y mes; fórmulas vivas en dosis y saldos', async () => {
  const wb = await abrir(armarModelo(entrada), 'UNIDAD');
  const ws = wb.getWorksheet('BCG');
  expect(ws.getCell('B2').value).toBe('TARJETA DE CONTROL DE BIOLOGICOS 2026');
  expect(ws.getCell('I3').value).toBe('BCG');
  expect(ws.getCell('I7').value).toBe('25311.020-000-3801-01');
  expect(ws.getCell('D7').value).toBe('MTRA. LIZBETH URIBE PANTOJA');
  expect(ws.getCell('N7').value).toBe('SEPTIEMBRE');
  expect(ws.getCell('F10').value).toBe('FRASCOS');
  expect(ws.getCell('G12').value.formula).toBe('F12*10');
  expect(ws.getCell('L12').value.formula).toBe('L11+F12-J12');
  expect(ws.getCell('E12').numFmt).toBe('mmm-yy');
});

test('sin fecha de recepción se avisa y la fecha queda en blanco; un año sin datos genera una hoja de aviso', async () => {
  const sinFecha = armarModelo({ ...entrada, requisiciones: requisiciones.map((r) => (r.id === 'r9' ? { ...r, fecha_envio: null } : r)) });
  expect(sinFecha.avisos.some((a) => a.includes('no tiene fecha de recepción'))).toBe(true);
  const vacio = armarModelo({ ...entrada, anio: 2030 });
  expect(vacio.hojas).toEqual([]);
  const wb = await abrir(vacio, 'UNIDAD');
  expect(wb.worksheets.map((w) => w.name)).toEqual(['SIN MOVIMIENTOS']);
});
