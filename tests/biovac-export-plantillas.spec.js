// Exportación de Movimiento de Biológico: la plantilla del MUNICIPIO (biovac_plantilla.xlsx) y la de la
// UNIDAD (hoja MOV-DE-BIOLÓGICO del SINBA) tienen un primer bloque de distinto tamaño. El motor debe leer
// de la propia plantilla dónde están A.R.F. y Total: A.R.F. en rosa/rojo, Canje en morado, Total en beige.
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');
const E = require('../biovac_export_excel.js');

const raiz = path.join(__dirname, '..');
const bloques = [{ id: 'b1', pagina: 'ANVERSO', orden: 1 }, { id: 'b2', pagina: 'ANVERSO', orden: 2 }, { id: 'b3', pagina: 'REVERSO', orden: 1 }];
const bios = [
  { id: 'bio1', bloque_id: 'b1', nombre_excel: 'B.C.G.\nfrasco multidosis', orden_en_bloque: 1, presentacion: 'FRASCO', dosis_por_frasco: 10, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null },
  { id: 'bio2', bloque_id: 'b2', nombre_excel: 'Rotavirus', orden_en_bloque: 1, presentacion: 'UNIDOSIS', dosis_por_frasco: 1, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null },
  { id: 'bio3', bloque_id: 'b3', nombre_excel: 'Td', orden_en_bloque: 1, presentacion: 'MULTIDOSIS', dosis_por_frasco: 10, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null }
];
const r = (cat, lote, bio, ant, rec, apl) => ({ categoria: cat, existencia_anterior_frascos: ant, recibido_frascos: rec, aplicadas_a: apl, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, observaciones: null, biovac_lotes: { numero_lote: lote, caducidad: '2027-03-31', dosis_por_frasco_override: null, biologico_id: bio } });
const filas = [r('NORMAL', 'L1', 'bio1', 2, 3, 10), r('ARF', 'LA1', 'bio1', 0, 4, 0), r('CANJE', 'LC1', 'bio1', 1, 0, 0), r('NORMAL', 'R1', 'bio2', 1, 1, 1), r('CANJE', 'RC1', 'bio2', 1, 0, 0), r('NORMAL', 'T1', 'bio3', 3, 0, 5)];

const relleno = (c) => ((c.fill && c.fill.fgColor && c.fill.fgColor.argb) || '').slice(2);
const texto = (c) => { const v = c.value; return v && v.richText ? v.richText.map((t) => t.text).join('') : String(v == null ? '' : v); };

for (const [nombre, archivo, hoja] of [['municipio', 'biovac_plantilla.xlsx', 'SEP'], ['unidad (SINBA)', 'SINBA-VER_26_2026.xlsx', 'MOV-DE-BIOLÓGICO']]) {
  test(`Exportar Movimiento con la plantilla del ${nombre}: A.R.F. rosa, Canje morado, Total beige`, async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(raiz, 'Formatos', archivo));
    const ws = wb.getWorksheet(hoja);
    await E.construirWorkbookDesdeDatos({ ws, bloques, biologicos: bios, renglonesDb: filas, anio: 2026, mes: 9, datosHeader: { mesNombre: 'SEPTIEMBRE', dia: 30, anio: 2026, municipio: 'CORREGIDORA', responsable: 'X' } });

    // por número de lote, no por fila fija: cada renglón debe tener el color de su categoría
    const porLote = {};
    ws.eachRow((row) => { const lote = row.getCell(3).value || row.getCell(6).value; if (lote) porLote[lote] = { fondo: relleno(row.getCell(2)), fuente: ((row.getCell(3).font && row.getCell(3).font.color && row.getCell(3).font.color.argb) || '').slice(2) }; });
    expect(porLote.L1.fondo).toBe('');            // normal: sin relleno
    expect(porLote.R1.fondo).toBe('');
    expect(porLote.LA1.fondo).toBe('FFCDCD');     // A.R.F.: rosa con letra roja
    expect(porLote.LA1.fuente).toBe('DE0000');
    expect(porLote.LC1.fondo).toBe('F5F3FF');     // Canje: morado
    expect(porLote.LC1.fuente).toBe('7C3AED');
    expect(porLote.RC1.fondo).toBe('F5F3FF');

    // cada bloque cierra con su Total en beige (no con el estilo de A.R.F.)
    const totales = [];
    ws.eachRow((row, n) => { if (texto(row.getCell(1)).trim() === 'Total') totales.push(relleno(row.getCell(1))); });
    expect(totales.length).toBe(3);
    totales.forEach((t) => expect(t).toBe('E5D8BD'));

    // impresión: carta, horizontal, un solo salto en el Reverso y sin centrado vertical (encabezados alineados a doble cara)
    expect(ws.rowBreaks.length).toBe(1);
    expect(ws.pageSetup.paperSize).toBe(1);
    expect(ws.pageSetup.orientation).toBe('landscape');
    expect(ws.pageSetup.verticalCentered).toBe(false);
    expect(ws.pageSetup.fitToPage).toBe(false);
    let filaReverso = 0; ws.eachRow((row, n) => { if (!filaReverso && texto(row.getCell(1)).trim() === 'Reverso') filaReverso = n; });
    expect(ws.rowBreaks[0].id).toBe(filaReverso - 1);
  });
}
