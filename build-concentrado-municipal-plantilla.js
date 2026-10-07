// Genera Formatos/concentrado_municipal_plantilla.xlsx: las hojas PALOTEO y SEGUIMIENTO DE BIOLOGICO del
// concentrado real del municipio ("SIS QUERETARO AGOSTO 2026.xlsx"), con el MISMO formato (colores por
// biológico, combinaciones, bordes, rotulación, formatos condicionales) pero sin datos de agosto, sin
// referencias a las otras hojas del libro (ÍNDICE / CSV) y con las fórmulas ya escritas una por una (sin
// fórmulas compartidas), para que sis06p_concentrado_municipal_module.js pueda ajustarlas al número de
// unidades de cada municipio.
// Uso: node build-concentrado-municipal-plantilla.js ["Formatos/SIS QUERETARO AGOSTO 2026.xlsx"]
const ExcelJS = require('exceljs');

const ORIGEN = process.argv[2] || 'Formatos/SIS QUERETARO AGOSTO 2026.xlsx';
const DESTINO = 'Formatos/concentrado_municipal_plantilla.xlsx';

// Zonas de datos de cada hoja (columnas de unidades) -- ver el mapeo en el módulo.
const PALOTEO = { nombre: 'PALOTEO', colIni: 9, colFin: 46, filaIni: 5, filaFin: 442 };
const SEGUIMIENTO = { nombre: 'SEGUIMIENTO DE BIOLOGICO', colIni: 2, colFin: 39, bloques: [[4, 21], [23, 40], [42, 59], [61, 78]] };

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);

  [PALOTEO.nombre, SEGUIMIENTO.nombre].forEach((n) => { if (!wb.getWorksheet(n)) throw new Error(`Falta la hoja ${n} en ${ORIGEN}`); });
  wb.worksheets.slice().forEach((ws) => { if (ws.name !== PALOTEO.nombre && ws.name !== SEGUIMIENTO.nombre) wb.removeWorksheet(ws.id); });
  wb.definedNames.model = [];

  const aplanar = (ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.isMerged && cell.master !== cell) return; // la esclava de una combinación refleja a su maestra
      const v = cell.value;
      if (!v || typeof v !== 'object' || (v.formula === undefined && v.sharedFormula === undefined)) return;
      const f = cell.formula;
      if (/ÍNDICE|CSV!/i.test(f || '')) { cell.value = null; return; } // se escriben al exportar (mes, municipio, fecha)
      cell.value = { formula: f, result: v.result };
    }));
  };

  const wp = wb.getWorksheet(PALOTEO.nombre);
  const wsg = wb.getWorksheet(SEGUIMIENTO.nombre);
  // Primero a fórmulas explícitas (el traductor de compartidas necesita a la maestra intacta)
  aplanar(wp); aplanar(wsg);

  // Combinaciones sueltas dentro de la zona de unidades / encabezado de la fila 1: se rehacen al exportar
  wp.model.merges.filter((m) => /^(Z1|AC1):/.test(m)).forEach((m) => wp.unMergeCells(m));
  wsg.model.merges.filter((m) => /^[A-Z]+1:/.test(m)).forEach((m) => wsg.unMergeCells(m));

  // Error de la hoja real de agosto: en los renglones afro/indígena de TDPa (354-361) las claves salieron con el
  // prefijo de DPT (VPD52..VPD55); las oficiales (SINBA-VER / catálogo sis_variables) son VDP52..VDP55, y
  // VPD53..VPD55 ya son las de DPT (renglones 92-95). Se corrigen aquí para que el exportador las encuentre.
  const CORRECCIONES_CLAVE = { VPD52: 'VDP52', VPD53: 'VDP53', VPD54: 'VDP54', VPD55: 'VDP55' };
  for (let r = 354; r <= 361; r++) {
    const c = wp.getCell(r, 3); const k = String(c.value || '').trim();
    if (CORRECCIONES_CLAVE[k]) { console.log(`PALOTEO C${r}: ${k} -> ${CORRECCIONES_CLAVE[k]}`); c.value = CORRECCIONES_CLAVE[k]; }
  }

  // Al deshacer las combinaciones de la fila 1 las celdas esclavas quedaron sin relleno (huecos blancos en la banda
  // oscura del título): se les da el estilo de una celda normal de la banda.
  for (let c = PALOTEO.colIni; c <= PALOTEO.colFin; c++) {
    const cell = wp.getCell(1, c); const f = cell.fill;
    if (!(f && f.fgColor && (f.fgColor.argb || f.fgColor.theme !== undefined))) cell.style = JSON.parse(JSON.stringify(wp.getCell(1, PALOTEO.colIni).style));
  }

  // Quitar datos de agosto (las celdas con fórmula se conservan)
  const limpiar = (ws, r, c) => { const cell = ws.getCell(r, c); const v = cell.value; if (v === null || v === undefined) return; if (typeof v === 'object' && (v.formula !== undefined || v.sharedFormula !== undefined)) return; cell.value = null; };
  for (let r = PALOTEO.filaIni; r <= PALOTEO.filaFin; r++) for (let c = PALOTEO.colIni; c <= PALOTEO.colFin; c++) limpiar(wp, r, c);
  SEGUIMIENTO.bloques.forEach(([a, b]) => { for (let r = a; r <= b; r++) for (let c = SEGUIMIENTO.colIni; c <= SEGUIMIENTO.colFin; c++) limpiar(wsg, r, c); });
  // Celdas sueltas que quedaron a la derecha de VALIDACIÓN en la hoja real (notas de trabajo)
  for (let r = 1; r <= 100; r++) for (let c = 43; c <= 60; c++) { const cell = wsg.getCell(r, c); if (cell.value !== null && !cell.isMerged) cell.value = null; }

  // La hoja real define el formato de columnas hasta la 16384 (<col max=16384>): al insertar columnas ese rango
  // se pasaba de 16384 y Excel rechazaba el archivo. Se recortan las definiciones a la tabla y se quitan las
  // celdas sueltas (solo con formato) que quedaban a la derecha de VALIDACIÓN.
  const recortar = (ws, ultimaCol) => {
    if (Array.isArray(ws._columns)) ws._columns.length = Math.min(ws._columns.length, ultimaCol);
    ws.eachRow({ includeEmpty: true }, (row) => { if (row.cellCount > ultimaCol) row.splice(ultimaCol + 1, row.cellCount - ultimaCol); });
  };
  recortar(wp, 47);   // A..AU
  recortar(wsg, 42);  // A..AP

  // Sin protección de hoja: la plantilla de agosto venía bloqueada (PALOTEO con contraseña) para que nadie borrara
  // fórmulas; el archivo exportado queda editable (mostrar/ocultar filas, ajustar impresión) y sin la contraseña.
  wp.unprotect(); wsg.unprotect();

  wp.views = [{ state: 'frozen', xSplit: 8, ySplit: 4, zoomScale: 70, showGridLines: false }];
  wsg.views = [{ state: 'frozen', xSplit: 1, ySplit: 2, zoomScale: 80, showGridLines: false }];

  await wb.xlsx.writeFile(DESTINO);
  console.log('Plantilla escrita en', DESTINO);
})().catch((e) => { console.error(e); process.exit(1); });
