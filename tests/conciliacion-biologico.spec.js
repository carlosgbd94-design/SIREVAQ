// CONCILIACIÓN DE BIOLÓGICO 2026: el libro se arma sobre la plantilla real con lo que hay en BIOVAC. Prueba en Node (sin navegador):
// conversión frascos->dosis, pérdida en operación vs. red de frío (A.R.F.), división en dos tamaños de dosis (Hep B / Moderna),
// un renglón por lote, municipal = suma de unidades, renglones extra, fórmulas explícitas y libro sin ÍNDICE/DATOS.
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const C = require('../conciliacion_biologico.js');

test.setTimeout(120000);   // abrir y escribir 19 hojas es pesado cuando la máquina está cargada

const PLANTILLA = path.join(__dirname, '..', 'Formatos', 'conciliacion_biologico_plantilla.xlsx');
const abrir = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(PLANTILLA); return wb; };
const val = (c) => { const v = c.value; if (v == null) return null; if (v instanceof Date) return v; return typeof v === 'object' ? (v.result != null ? v.result : null) : v; };
const n = (c) => Number(val(c)) || 0;

// atajo para armar un renglón normalizado
const R = (clave, lote, o = {}) => ({
  clave, lote, caducidad: o.cad === undefined ? '2027-06-01' : o.cad, dpf: o.dpf || 1, categoria: o.cat || 'NORMAL',
  anterior: o.ant || 0, recibido: o.rec || 0, apA: o.apA || 0, apB: o.apB || 0, deA: o.deA || 0, deB: o.deB || 0, final: o.final === undefined ? null : o.final
});

// filas de datos de un mes: [{lote, fila}] leyendo la hoja ya llena
function filasMes(ws, mes) {
  const b = C.detectarBloques(ws).meses.find((m) => m.mes === mes);
  const out = [];
  for (let r = b.ini; r < b.total; r++) { const lote = val(ws.getCell(r, 3)); if (lote) out.push({ r, lote }); }
  return { b, filas: out };
}

test('SR (multidosis 10): frascos -> dosis, pérdida en operación y existencia que se arrastra de mes a mes', async () => {
  const wb = await abrir();
  const meses = {
    10: [R('SR', '0125N118A', { dpf: 10, ant: 71, rec: 0, apA: 384, deA: 96 })],           // 710 - 384 - 96 = 230
    11: [R('SR', '0125N118A', { dpf: 10, ant: 23, apA: 100, deA: 130 }), R('SR', '0125N120A', { dpf: 10, rec: 30, apA: 20 })]
  };
  const { resumen } = C.construirLibro({ wb, nombre: 'LOMAS DE CASA BLANCA', meses, responsable: 'Ana Pérez', supervisor: 'Luis Gómez', anio: 2026 });
  expect(resumen.avisos).toEqual([]);
  const ws = wb.getWorksheet('SR');
  const oct = filasMes(ws, 10);
  expect(oct.filas.map((f) => f.lote)).toEqual(['0125N118A']);
  const r = oct.filas[0].r;
  expect(n(ws.getCell(r, 7))).toBe(710);              // G inicia (71 frascos x 10)
  expect(n(ws.getCell(r, 8))).toBe(384);              // aplicadas en la columna de octubre
  expect(n(ws.getCell(r, 11))).toBe(384);             // total aplicadas
  expect(n(ws.getCell(r, 12))).toBe(96);              // pérdida en operación de octubre
  expect(n(ws.getCell(r, 15))).toBe(96);
  expect(n(ws.getCell(r, 19))).toBe(0);               // red de frío
  expect(n(ws.getCell(r, 20))).toBe(230);             // existencia final
  // fecha de recepción, nº de entrega: vacíos; caducidad desde BIOVAC (no se teclea)
  expect(val(ws.getCell(r, 1))).toBeNull();
  expect(val(ws.getCell(r, 2))).toBeNull();
  expect(new Date(val(ws.getCell(r, 6))).toISOString().slice(0, 10)).toBe('2027-06-01');
  // noviembre: la existencia de octubre es el inicio y hay un lote nuevo con su recibido en dosis (30 frascos = 300)
  const nov = filasMes(ws, 11);
  expect(nov.filas.map((f) => f.lote)).toEqual(['0125N118A', '0125N120A']);
  expect(n(ws.getCell(nov.filas[0].r, 7))).toBe(230);
  expect(n(ws.getCell(nov.filas[0].r, 20))).toBe(0);
  expect(n(ws.getCell(nov.filas[1].r, 4))).toBe(30);
  expect(n(ws.getCell(nov.filas[1].r, 5))).toBe(300);
  expect(n(ws.getCell(nov.filas[1].r, 20))).toBe(280);
  // total del mes y del trimestre
  const totNov = nov.b.total;
  expect(n(ws.getCell(totNov, 5))).toBe(300);
  expect(n(ws.getCell(totNov, 20))).toBe(280);
  const q4 = C.detectarBloques(ws).trimTotales[3];
  expect(n(ws.getCell(q4, 5))).toBe(300);              // recibidas del trimestre
  expect(n(ws.getCell(q4, 7))).toBe(710);              // con las que inicia el trimestre
  expect(n(ws.getCell(q4, 11))).toBe(384 + 100 + 20);  // aplicadas
  expect(n(ws.getCell(q4, 15))).toBe(96 + 130);        // operación
  expect(n(ws.getCell(q4, 20))).toBe(710 + 300 - 504 - 226);
  // encabezado y firmas desde el código (sin ÍNDICE)
  expect(val(ws.getCell('O6'))).toBe('LOMAS DE CASA BLANCA  (1)');
  expect(String(val(ws.getCell('A7')))).toBe('EJERCICIO FISCAL 2026');
  const textos = []; ws.eachRow((row) => row.eachCell((c) => { const t = String(val(c) || ''); if (c.address === c.master.address && /Ana Pérez|Luis Gómez/.test(t)) textos.push(t); }));
  expect(textos.sort()).toEqual(['Ana Pérez', 'Luis Gómez']);
});

test('A.R.F. es la única pérdida por red de frío; lo desechado en renglón Normal (incluida la caducidad) es operación', async () => {
  const wb = await abrir();
  const meses = {
    10: [
      R('BCG', 'MA109', { dpf: 10, ant: 5, apA: 20, deA: 10 }),                     // 50-20-10 = 20 -> 2 frascos (en Normal)
      R('BCG', 'MA109', { dpf: 10, cat: 'ARF', ant: 2, deA: 20 })                    // ARF: 2 frascos se desechan por dictamen -> red de frío
    ]
  };
  // el lote junta Normal + ARF: anterior 7 fr = 70 dosis; apl 20; oper 10; rf 20 -> T 20
  const { resumen } = C.construirLibro({ wb, nombre: 'X', meses, anio: 2026 });
  expect(resumen.avisos).toEqual([]);
  const ws = wb.getWorksheet('BCG');
  const { filas } = filasMes(ws, 10);
  expect(filas.length).toBe(1);
  const r = filas[0].r;
  expect([n(ws.getCell(r, 7)), n(ws.getCell(r, 11)), n(ws.getCell(r, 15)), n(ws.getCell(r, 19)), n(ws.getCell(r, 20))]).toEqual([70, 20, 10, 20, 20]);
});

test('Hepatitis B y Moderna: dos tamaños de dosis; total = a/2 + b; pérdida en una sola columna', async () => {
  const wb = await abrir();
  const meses = {
    10: [
      R('HEPB', '2526240806', { dpf: 10, rec: 10, apA: 40, apB: 30, deA: 20 }),         // 100 - (20+30) - (10) = 40
      R('COVID_MODERNA', '3053352', { dpf: 5, rec: 50, apA: 0, apB: 125, deA: 0, deB: 25 }) // 250 -125 -25 = 100
    ]
  };
  C.construirLibro({ wb, nombre: 'X', meses, anio: 2026 });
  const hb = wb.getWorksheet('HEPATITIS B 20 mcg');
  const rh = filasMes(hb, 10).filas[0].r;
  expect(n(hb.getCell(rh, 8))).toBe(40);   // ENERO.. col H = primer tamaño del mes (octubre = 1er mes del trimestre)
  expect(n(hb.getCell(rh, 9))).toBe(30);
  expect(n(hb.getCell(rh, 14))).toBe(50);  // 40/2 + 30
  expect(n(hb.getCell(rh, 15))).toBe(10);  // operación (20/2)
  expect(n(hb.getCell(rh, 23))).toBe(40);
  const mo = wb.getWorksheet('C-19 MODERNA');
  const rm = filasMes(mo, 10).filas[0].r;
  expect(n(mo.getCell(rm, 5))).toBe(250);
  expect(n(mo.getCell(rm, 9))).toBe(125);
  expect(n(mo.getCell(rm, 14))).toBe(125);
  expect(n(mo.getCell(rm, 15))).toBe(25);
  expect(n(mo.getCell(rm, 23))).toBe(100);
  // fórmula explícita con la misma regla que la plantilla original
  expect(hb.getCell(rh, 14).value.formula).toBe(`((H${rh}/2)+(I${rh}))`);
});

test('Municipal = suma de sus unidades por lote; la existencia final de BIOVAC debe coincidir', async () => {
  const wb = await abrir();
  const u1 = R('SRP', 'L1', { ant: 10, rec: 20, apA: 12, deA: 1, final: 17 });
  const u2 = R('SRP', 'L1', { ant: 5, rec: 0, apA: 4, deA: 0, final: 1 });
  const u3 = R('SRP', 'L2', { ant: 0, rec: 30, apA: 3, final: 27 });
  const { resumen } = C.construirLibro({ wb, nombre: 'MUNICIPIO', meses: { 10: [u1, u2, u3] }, anio: 2026 });
  expect(resumen.avisos).toEqual([]);
  const ws = wb.getWorksheet('SRP');
  const { filas } = filasMes(ws, 10);
  expect(filas.map((f) => f.lote)).toEqual(['L1', 'L2']);
  expect([n(ws.getCell(filas[0].r, 7)), n(ws.getCell(filas[0].r, 5)), n(ws.getCell(filas[0].r, 11)), n(ws.getCell(filas[0].r, 15)), n(ws.getCell(filas[0].r, 20))]).toEqual([15, 20, 16, 1, 18]);
  // una unidad con un cálculo que no cuadra con lo que dice BIOVAC avisa
  const mal = C.construirLibro({ wb: await abrir(), nombre: 'X', meses: { 10: [R('SRP', 'L9', { ant: 10, apA: 4, final: 9 })] }, anio: 2026 });
  expect(mal.resumen.avisos.some((a) => /no coincide/.test(a))).toBe(true);
});

test('Más lotes que renglones: se agregan renglones y todo (totales, trimestre, firmas) sigue cuadrando', async () => {
  const wb = await abrir();
  const lotes = Array.from({ length: 11 }, (_, i) => R('DPT', 'LOTE' + String(i + 1).padStart(2, '0'), { dpf: 10, rec: 2, apA: 5 + i, cad: `2027-${String((i % 12) + 1).padStart(2, '0')}-01` }));
  const { resumen } = C.construirLibro({ wb, nombre: 'X', meses: { 10: lotes }, supervisor: 'Sup Visor', anio: 2026 });
  expect(resumen.renglonesAgregados).toBe(3);
  const ws = wb.getWorksheet('DPT');
  const { b, filas } = filasMes(ws, 10);
  expect(filas.length).toBe(11);
  const totalAp = lotes.reduce((s, l) => s + l.apA, 0);
  expect(n(ws.getCell(b.total, 11))).toBe(totalAp);
  expect(n(ws.getCell(b.total, 5))).toBe(220);
  const bl = C.detectarBloques(ws);
  expect(bl.meses.length).toBe(12);
  expect(n(ws.getCell(bl.trimTotales[3], 11))).toBe(totalAp);
  // los meses de abajo conservan su estructura y la firma sigue ubicada
  expect(bl.meses[10].capacidad).toBe(8);
  const textos = []; ws.eachRow((row) => row.eachCell((c) => { if (c.address === c.master.address && String(val(c) || '') === 'Sup Visor') textos.push(1); }));
  expect(textos.length).toBe(1);
});

test('Cuadre: en cada hoja y renglón, existencia = recibido + inicio − aplicadas − operación − red de frío, y los totales suman', async () => {
  const wb = await abrir();
  const meses = {
    10: [R('VPH', 'V1', { rec: 40, apA: 10 }), R('TD', 'T1', { dpf: 10, ant: 3, apA: 12, deA: 8 })],
    11: [R('VPH', 'V1', { ant: 30, apA: 9, deA: 1 }), R('VPH', 'V1', { cat: 'ARF', ant: 0, rec: 0, deA: 0 }), R('TD', 'T1', { dpf: 10, ant: 1, rec: 5, apA: 30, deA: 5, cat: 'NORMAL' })],
    12: [R('VPH', 'V1', { ant: 20, apA: 2 })]
  };
  C.construirLibro({ wb, nombre: 'X', meses, anio: 2026 });
  for (const ws of wb.worksheets.filter((w) => w.name !== 'INSTRUCCIONES')) {
    const bl = C.detectarBloques(ws), K = C.columnasDe(ws);
    bl.meses.forEach((b) => {
      let sT = 0;
      for (let r = b.ini; r < b.total; r++) {
        const t = n(ws.getCell(r, K.E)) + n(ws.getCell(r, K.G)) - n(ws.getCell(r, K.apTot)) - n(ws.getCell(r, K.operTot)) - n(ws.getCell(r, K.rfTot));
        expect(Math.abs(t - n(ws.getCell(r, K.T))), `${ws.name} fila ${r}`).toBeLessThan(0.0001);
        sT += n(ws.getCell(r, K.T));
      }
      expect(Math.abs(sT - n(ws.getCell(b.total, K.T)))).toBeLessThan(0.0001);
    });
    bl.trimTotales.forEach((fila, q) => {
      const ms = bl.meses.slice(q * 3, q * 3 + 3);
      const suma = (c) => ms.reduce((s, m) => s + n(ws.getCell(m.total, c)), 0);
      expect(n(ws.getCell(fila, K.E))).toBeCloseTo(suma(K.E), 4);
      expect(n(ws.getCell(fila, K.apTot))).toBeCloseTo(suma(K.apTot), 4);
      expect(n(ws.getCell(fila, K.operTot))).toBeCloseTo(suma(K.operTot), 4);
      expect(n(ws.getCell(fila, K.rfTot))).toBeCloseTo(suma(K.rfTot), 4);
      // sin saltos de existencia: la del trimestre = la del último mes con movimiento
      const ult = ms.slice().reverse().find((m) => n(ws.getCell(m.total, K.E)) || n(ws.getCell(m.total, K.G)) || n(ws.getCell(m.total, K.apTot)) || n(ws.getCell(m.total, K.operTot)) || n(ws.getCell(m.total, K.rfTot)));
      if (ult) expect(n(ws.getCell(fila, K.T)), `${ws.name} T trimestre ${q + 1}`).toBeCloseTo(n(ws.getCell(ult.total, K.T)), 4);
    });
  }
});

test('Libro: sin ÍNDICE ni DATOS, con las 18 hojas de biológico, sin referencias rotas y que reabre', async () => {
  const wb = await abrir();
  C.construirLibro({ wb, nombre: 'UNIDAD X', meses: { 10: [R('SR', 'A', { dpf: 10, rec: 5, apA: 9 })] }, anio: 2026 });
  const nombres = wb.worksheets.map((w) => w.name.trim());
  expect(nombres).not.toContain('ÍNDICE');
  expect(nombres).not.toContain('DATOS');
  expect(nombres).toContain('INSTRUCCIONES');
  expect(nombres.length).toBe(19);
  const buf = await wb.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(buf);
  for (const nombre of Object.keys(zip.files).filter((f) => /^xl\/(worksheets\/sheet\d+\.xml|workbook\.xml)$/.test(f))) {
    const x = await zip.file(nombre).async('string');
    expect(/#REF!|ÍNDICE!|INDICE!|DATOS!/.test(x), nombre).toBe(false);
  }
  const otra = new ExcelJS.Workbook(); await otra.xlsx.load(buf);
  expect(otra.worksheets.length).toBe(19);
});

test('Meses sin datos quedan en la plantilla; un lote que se queda sin movimiento no genera renglón; sin hoja se avisa', async () => {
  const wb = await abrir();
  const { resumen } = C.construirLibro({ wb, nombre: 'X', meses: {
    10: [R('SR', 'A', { dpf: 10, rec: 1, apA: 2 }), R('NEUMO_23V', 'Z', { rec: 3, apA: 1 }), R('SR', 'CERO', { dpf: 10 })]
  }, anio: 2026 });
  expect(resumen.sinHoja).toEqual(['NEUMO_23V']);
  const ws = wb.getWorksheet('SR');
  expect(filasMes(ws, 10).filas.map((f) => f.lote)).toEqual(['A']);
  for (const mes of [1, 2, 3, 4, 5, 6, 7, 8, 9]) expect(filasMes(ws, mes).filas).toEqual([]);
  expect(C.detectarBloques(ws).meses.length).toBe(12);
});

test('Catálogo: cada biológico de BIOVAC con hoja existe en la plantilla (nombres exactos)', async () => {
  const wb = await abrir();
  const hojas = new Set(wb.worksheets.map((w) => w.name.trim()));
  Object.values(C.HOJA_DE).forEach((h) => expect(hojas.has(h), h).toBe(true));
});

test('Canje: no es pérdida; el lote nuevo entra con la misma cantidad y el trimestre sigue cuadrando; lo en canje se anota', async () => {
  const wb = await abrir();
  const meses = {
    10: [R('SRP', 'VIEJO', { ant: 20, apA: 5, cad: '2027-01-01' }), R('SRP', 'VIEJO', { cat: 'CANJE', ant: 0 })],
    // noviembre: se resolvió el canje de 15 frascos -> el lote VIEJO sale y NUEVO entra como existencia anterior (15)
    11: [R('SRP', 'NUEVO', { ant: 15, apA: 4, cad: '2028-01-01' })],
    12: [R('SRP', 'NUEVO', { ant: 11, apA: 1, cad: '2028-01-01' })]
  };
  const { resumen } = C.construirLibro({ wb, nombre: 'X', meses, anio: 2026 });
  expect(resumen.avisos).toEqual([]);
  const ws = wb.getWorksheet('SRP');
  const q4 = C.detectarBloques(ws).trimTotales[3];
  expect(n(ws.getCell(q4, 7))).toBe(20);                       // con las que inicia: solo octubre
  expect(n(ws.getCell(q4, 15))).toBe(0);                       // ninguna pérdida
  expect(n(ws.getCell(q4, 19))).toBe(0);
  expect(n(ws.getCell(q4, 20))).toBe(10);                      // 20 - 5 - 4 - 1: igual que el último mes
  // un desecho registrado en un renglón de canje NO es red de frío
  const wb2 = await abrir();
  C.construirLibro({ wb: wb2, nombre: 'X', meses: { 10: [R('SRP', 'L', { cat: 'CANJE', ant: 6, deA: 2, final: 4 })] }, anio: 2026 });
  const s2 = wb2.getWorksheet('SRP'); const r = filasMes(s2, 10).filas[0].r;
  expect([n(s2.getCell(r, 15)), n(s2.getCell(r, 19))]).toEqual([2, 0]);
  expect(String(val(s2.getCell(r, 21)))).toContain('En canje al cierre: 4');
});

test('normalizarRenglonDb usa las dosis por frasco del lote (override) o las del catálogo', () => {
  const cat = new Map([['b1', { clave: 'COVID_MODERNA', dosis_por_frasco: 5 }], ['b2', { clave: 'SR', dosis_por_frasco: 10 }]]);
  const f = (id, over) => C.normalizarRenglonDb({ categoria: 'NORMAL', existencia_anterior_frascos: '2', recibido_frascos: 1, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 3, biovac_lotes: { numero_lote: ' ab1 ', caducidad: '2027-01-01', dosis_por_frasco_override: over, biologico_id: id } }, cat);
  expect(f('b1', null).dpf).toBe(5);
  expect(f('b2', 6).dpf).toBe(6);
  expect(f('b2', null).lote).toBe('AB1');
  expect(f('nope', null)).toBeNull();
});
