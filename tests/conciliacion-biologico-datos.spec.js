// CONCILIACIÓN DE BIOLÓGICO: lectura de BIOVAC con una base simulada (PostgREST: filtros, .range y tope de 1000 filas),
// municipal = suma de unidades, una sola unidad y masivo (ZIP con un libro por unidad).
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const C = require('../conciliacion_biologico.js');

test.setTimeout(120000);

const PLANTILLA = path.join(__dirname, '..', 'Formatos', 'conciliacion_biologico_plantilla.xlsx');
const abrir = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(PLANTILLA); return wb; };
const val = (c) => { const v = c.value; if (v == null) return null; if (v instanceof Date) return v; return typeof v === 'object' ? (v.result != null ? v.result : null) : v; };
const n = (c) => Number(val(c)) || 0;

function filasMes(ws, mes) {
  const b = C.detectarBloques(ws).meses.find((m) => m.mes === mes);
  const out = [];
  for (let r = b.ini; r < b.total; r++) { const lote = val(ws.getCell(r, 3)); if (lote) out.push({ r, lote }); }
  return out;
}

function dbSimulada({ unidades, movimientos, renglones, catalogo }) {
  const tablas = { biovac_unidades: unidades, biovac_movimientos: movimientos, biovac_renglones: renglones, biovac_catalogo_biologicos: catalogo };
  return {
    from(nombre) {
      const filtros = [];
      const q = {
        select() { return q; },
        eq(c, v) { filtros.push((f) => f[c] === v); return q; },
        gte(c, v) { filtros.push((f) => f[c] >= v); return q; },
        lte(c, v) { filtros.push((f) => f[c] <= v); return q; },
        in(c, v) { filtros.push((f) => v.includes(f[c])); return q; },
        order() { return q; },
        range(d, h) {
          const todas = (tablas[nombre] || []).filter((f) => filtros.every((fn) => fn(f)));
          return Promise.resolve({ data: todas.slice(d, Math.min(h, d + 999) + 1), error: null });
        }
      };
      return q;
    }
  };
}

test('Lectura: octubre a mes elegido, municipal junta unidades, una unidad y masivo con ZIP', async () => {
  const catalogo = [{ id: 'b-sr', clave: 'SR', dosis_por_frasco: 10 }];
  const unidades = [
    { id: 'u1', nombre: 'LOMAS', clues: 'QTSSA002982', municipio: 'QUERETARO', activo: true },
    { id: 'u2', nombre: 'LA GRIEGA', clues: 'QTSSA001390', municipio: 'QUERETARO', activo: true },
    { id: 'u3', nombre: 'SIN DATOS', clues: 'QTSSA000001', municipio: 'QUERETARO', activo: true },
    { id: 'uj', nombre: 'JURISDICCION', clues: 'JS1-QUERETARO', municipio: 'QUERETARO', activo: true }
  ];
  const movimientos = [
    { id: 'm1', unidad_id: 'u1', anio: 2026, mes: 10, estado: 'CERRADO', responsable_elaboracion: 'Ana Pérez' },
    { id: 'm2', unidad_id: 'u2', anio: 2026, mes: 10, estado: 'BORRADOR', responsable_elaboracion: null },
    { id: 'm3', unidad_id: 'u1', anio: 2026, mes: 11, estado: 'CERRADO', responsable_elaboracion: 'Ana Pérez' },
    { id: 'm9', unidad_id: 'u1', anio: 2026, mes: 9, estado: 'CERRADO', responsable_elaboracion: 'x' },       // antes de octubre: no entra
    { id: 'mj', unidad_id: 'uj', anio: 2026, mes: 10, estado: 'CERRADO', responsable_elaboracion: 'x' }
  ];
  const ren = (mov, over) => Object.assign({ id: Math.random(), movimiento_id: mov, categoria: 'NORMAL', existencia_anterior_frascos: 0, recibido_frascos: 0, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 0, biovac_lotes: { numero_lote: 'L1', caducidad: '2027-05-01', dosis_por_frasco_override: null, biologico_id: 'b-sr' } }, over);
  const renglones = [
    ren('m1', { recibido_frascos: 10, aplicadas_a: 30, desechadas_a: 20, existencia_final_frascos: 5 }),
    ren('m2', { recibido_frascos: 4, aplicadas_a: 10, existencia_final_frascos: 3 }),
    ren('m3', { existencia_anterior_frascos: 5, aplicadas_a: 20, existencia_final_frascos: 3 }),
    ren('m9', { recibido_frascos: 99 }), ren('mj', { recibido_frascos: 77 })
  ];
  const db = dbSimulada({ unidades, movimientos, renglones, catalogo });
  const cat = await C.cargarCatalogo(db);
  const abrirPlantilla = async () => abrir();

  // municipal: suma de unidades reales (sin la fila JS1- ni meses anteriores a octubre)
  const unidadesMun = C.unidadesDelMunicipio(unidades, 'QUERETARO');
  expect(unidadesMun.map((u) => u.id).sort()).toEqual(['u1', 'u2', 'u3']);
  const mun = await C.exportarLibro({ db, abrirPlantilla, catalogo: cat, unidades: unidadesMun, etiqueta: 'MUNICIPIO DE QUERÉTARO', anio: 2026, mesHasta: 11, supervisor: 'Sup' });
  expect(mun.nombreArchivo).toBe('CONCILIACION_BIOLOGICO_2026_MUNICIPIO_DE_QUERETARO_hasta_NOVIEMBRE.xlsx');
  expect(mun.avisosMeses).toEqual(['OCTUBRE: 1 movimiento(s) sin cerrar']);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(mun.buffer);
  const sr = wb.getWorksheet('SR');
  const oct = filasMes(sr, 10)[0].r;
  // frascos 14 (10+4), dosis recibidas 140, aplicadas 40, operación 20, existencia 80
  expect([n(sr.getCell(oct, 4)), n(sr.getCell(oct, 5)), n(sr.getCell(oct, 11)), n(sr.getCell(oct, 15)), n(sr.getCell(oct, 20))]).toEqual([14, 140, 40, 20, 80]);
  const nov = filasMes(sr, 11)[0].r;
  expect([n(sr.getCell(nov, 7)), n(sr.getCell(nov, 20))]).toEqual([50, 30]);

  // una sola unidad: responsable desde su Movimiento
  const uno = await C.exportarLibro({ db, abrirPlantilla, catalogo: cat, unidades: [unidades[0]], etiqueta: 'LOMAS', anio: 2026, mesHasta: 10 });
  const wb1 = new ExcelJS.Workbook(); await wb1.xlsx.load(uno.buffer);
  const nombres = [];
  wb1.getWorksheet('SR').eachRow((row) => row.eachCell((c) => { if (c.address === c.master.address && String(val(c) || '') === 'Ana Pérez') nombres.push(1); }));
  expect(nombres.length).toBe(1);

  // masivo: un libro por unidad con datos; la que no tiene Movimiento se reporta y no genera libro
  const r = await C.exportarMasivo({ db, abrirPlantilla, catalogo: cat, unidades: unidadesMun, etiqueta: 'Querétaro', anio: 2026, mesHasta: 11, supervisor: '', JSZipLib: JSZip });
  expect(r.unidades.map((u) => u.nombre)).toEqual(['LA GRIEGA', 'LOMAS']);
  expect(r.sinDatos).toEqual(['SIN DATOS']);
  const zip = await JSZip.loadAsync(Buffer.from(await r.blob.arrayBuffer()));
  expect(Object.keys(zip.files).length).toBe(2);
  const arch = Object.keys(zip.files).find((f) => /QTSSA002982/.test(f));
  const wbU = new ExcelJS.Workbook(); await wbU.xlsx.load(await zip.file(arch).async('nodebuffer'));
  const srU = wbU.getWorksheet('SR'); const fU = filasMes(srU, 10)[0].r;
  expect([n(srU.getCell(fU, 5)), n(srU.getCell(fU, 11))]).toEqual([100, 30]);   // solo LOMAS, no la suma
});

test('Lectura paginada: más de 1000 renglones en un mes se leen completos', async () => {
  const catalogo = [{ id: 'b-vph', clave: 'VPH', dosis_por_frasco: 1 }];
  const unidades = [{ id: 'u1', nombre: 'U', clues: 'QTSSA1', municipio: 'QUERETARO', activo: true }];
  const movimientos = [{ id: 'm1', unidad_id: 'u1', anio: 2026, mes: 10, estado: 'CERRADO', responsable_elaboracion: '' }];
  const renglones = Array.from({ length: 1500 }, (_, i) => ({ id: i, movimiento_id: 'm1', categoria: 'NORMAL', existencia_anterior_frascos: 0, recibido_frascos: 1, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 1, biovac_lotes: { numero_lote: 'L' + i, caducidad: null, dosis_por_frasco_override: null, biologico_id: 'b-vph' } }));
  const db = dbSimulada({ unidades, movimientos, renglones, catalogo });
  const { meses } = await C.cargarMeses({ db, unidades, anio: 2026, mesHasta: 10, catalogo: await C.cargarCatalogo(db) });
  expect(meses[10].length).toBe(1500);
});
