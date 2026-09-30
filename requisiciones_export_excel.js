// ============================================================================
// Requisiciones — Exportador a Excel, 100% fiel al formato oficial
//
// A diferencia de Biovac (biovac_export_excel.js), aquí NO hace falta
// insertar/quitar filas: la plantilla real tiene un número FIJO de filas por
// biológico (2 -- un lote en cada una) y un número FIJO de biológicos, así
// que basta con escribir directo en las celdas correspondientes del archivo
// real (requisiciones_plantilla.xlsx, copia exacta de "Municipio
// Corregidora.xlsx" hoja GENERAL -- misma estructura en los 3 niveles,
// verificado celda por celda: solo cambian ORIGEN/DESTINO/DIRECCIÓN). Logos,
// márgenes, combinación de celdas y formato de fecha (mmm-aa, ya nativo en
// la plantilla) se conservan intactos porque nunca se tocan.
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RequiExportExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const HOJA = 'GENERAL';

  // orden=1 (el primer renglón del catálogo) empieza en la fila 14; cada
  // biológico ocupa 2 filas (una por lote, hasta 2 lotes por biológico --
  // límite físico de la plantilla, igual que en el Excel real).
  function filaBase(orden) { return 12 + 2 * orden; }

  // La plantilla tiene 21 renglones físicos (filas 14-55) sin importar
  // cuántos biológicos estén activos hoy en el catálogo -- se limpian TODOS
  // antes de escribir, porque requisiciones_plantilla.xlsx es una copia real
  // de "Municipio Corregidora.xlsx" y trae datos reales de septiembre ya
  // capturados en esas celdas (cantidades, lotes) que de otro modo se
  // quedarían pegados en cualquier renglón que esta exportación no llene.
  const TOTAL_RENGLONES_PLANTILLA = 21;

  function limpiarDatosPrevios(ws) {
    for (let orden = 1; orden <= TOTAL_RENGLONES_PLANTILLA; orden++) {
      const fila = filaBase(orden);
      ['F', 'G', 'H', 'I', 'J', 'K'].forEach((col) => {
        ws.getCell(`${col}${fila}`).value = null;
        ws.getCell(`${col}${fila + 1}`).value = null;
      });
    }
  }

  // Tabla de referencia de "jeringas" (filas 14-18, columnas M-P): ya no se
  // usa (el usuario confirmó que ese cálculo se dejó de hacer), así que se
  // elimina del archivo exportado en vez de solo dejarla sin tocar. Se
  // limpia con margen (M1:Q90) por si la plantilla trae alguna fila extra
  // no detectada, y se recorta el área de impresión a A1:K87 (la cuadrícula
  // real de la requisición) para que no quede ese espacio en blanco.
  function limpiarTablaJeringas(ws) {
    // Además de los valores se quita el formato (bordes, tamaño de letra): el
    // cuadro seguía viéndose como una tabla vacía con líneas. Las columnas M:Q
    // se ocultan para que no ocupen espacio en pantalla ni en la impresión.
    for (let r = 1; r <= 90; r++) {
      ['M', 'N', 'O', 'P', 'Q'].forEach((col) => {
        const celda = ws.getCell(`${col}${r}`);
        celda.value = null;
        celda.style = {};
      });
    }
    for (let c = 13; c <= 17; c++) ws.getColumn(c).hidden = true;
    // Ajustar a UNA página Carta (la plantilla ya viene así; se fuerza por si
    // ExcelJS no conserva el ajuste al re-guardar).
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 1;
  }

  // La plantilla real trae, además de "GENERAL", las hojas ocultas/visibles
  // de cada unidad de ese municipio (con sus propios datos y CLUES reales de
  // septiembre). NO se borran (wb.removeWorksheet) -- varias celdas de
  // GENERAL las referencian con fórmulas 3D (ej. SUM('HOJA1:HOJA9'!F16));
  // borrar una hoja referenciada así corrompe el .xlsx a nivel OOXML (Excel
  // avisa "encontramos un problema con el contenido"), aunque ExcelJS lo
  // siga leyendo sin quejarse. En su lugar se ocultan por completo
  // (veryHidden, ni siquiera aparece en "Mostrar hoja" del menú) -- mismo
  // resultado visual de "una sola hoja" al abrir el archivo, sin tocar la
  // estructura interna.
  function ocultarOtrasHojas(wb, nombreHoja) {
    wb.worksheets.forEach((hoja) => {
      if (hoja.name !== nombreHoja) hoja.state = 'veryHidden';
    });
  }

  const CELDAS_ENCABEZADO = {
    origenNombre: 'B7', area: 'H7',
    origenDireccion: 'B8', fechaEnvio: 'H8',
    destinoNombre: 'B9', folio: 'H9',
    destinoDireccion: 'B10', mesLabel: 'H10'
  };

  function escribir(ws, addr, valor) {
    if (valor === undefined) return; // no tocar la celda si no hay dato
    ws.getCell(addr).value = valor === null ? '' : valor;
  }

  function escribirEncabezado(ws, datos) {
    Object.entries(CELDAS_ENCABEZADO).forEach(([campo, addr]) => escribir(ws, addr, datos[campo]));
  }

  // Elaboró/Autorizó (filas 67-68) se imprimen igual en las 3 copias.
  // Entrega/Recibe (fila 74) se deja SIN nombre para el nivel UNIDAD -- la
  // unidad firma a mano y anota su propio nombre en el papel (fila 75, ya
  // impresa en la plantilla, no se toca).
  function escribirFirmas(ws, firmas, d) {
    escribir(ws, `A${67 + d}`, firmas.elaboro_nombre || '');
    escribir(ws, `A${68 + d}`, firmas.elaboro_cargo || '');
    escribir(ws, `H${67 + d}`, firmas.autorizo_nombre || '');
    escribir(ws, `H${68 + d}`, firmas.autorizo_cargo || '');
    escribir(ws, `A${74 + d}`, firmas.entrega_nombre || '');
    escribir(ws, `H${74 + d}`, firmas.recibe_nombre || '');
  }

  // --- Más de 2 lotes en un biológico -------------------------------------------
  // Cada biológico trae 2 renglones (un lote por renglón). Si llegan más lotes se
  // agregan renglones a ESE biológico y todo lo de abajo (pie, firmas y recuadros de
  // sellos) baja lo necesario; la hoja sigue ajustada a una página Carta.
  const ULTIMA_COL = 11; // A..K
  const FILA_FINAL_PLANTILLA = 89; // última fila usada (recuadros de sellos)

  function copiarFila(ws, desde, hasta) {
    const o = ws.getRow(desde);
    const d = ws.getRow(hasta);
    d.height = o.height;
    for (let c = 1; c <= ULTIMA_COL; c++) {
      const co = o.getCell(c);
      const cd = d.getCell(c);
      cd.value = co.isMerged && co.master !== co ? null : co.value;
      cd.style = JSON.parse(JSON.stringify(co.style || {}));
    }
  }

  // Abre `n` filas debajo de `ultima` (última fila del bloque del biológico), copiando
  // el formato de esa fila, y extiende las celdas combinadas del bloque (A-F y K).
  function abrirFilas(ws, primera, ultima, n, filaFinal) {
    const merges = Object.values(ws._merges).map((m) => ({ ...m.model }));
    merges.filter((m) => m.top >= primera).forEach((m) => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
    for (let r = filaFinal; r > ultima; r--) copiarFila(ws, r, r + n);
    for (let r = ultima + 1; r <= ultima + n; r++) {
      copiarFila(ws, ultima, r);
      for (let c = 1; c <= ULTIMA_COL; c++) ws.getRow(r).getCell(c).value = null;
    }
    merges.filter((m) => m.top >= primera).forEach((m) => {
      if (m.top >= primera && m.top <= ultima) ws.mergeCells(m.top, m.left, m.bottom + n, m.right);
      else ws.mergeCells(m.top + n, m.left, m.bottom + n, m.right);
    });
  }

  // filasPorBiologico: { [requi_biologico_id]: [{ cantidad, numeroLote, caducidad }, ...] }
  // Un renglón por lote: 2 por biológico en la plantilla y los que hagan falta si
  // llegan más (ver abrirFilas). Devuelve cuántas filas se agregaron en total.
  function escribirBiologicos(ws, catalogo, filasPorBiologico) {
    const sinRenglon = [];
    const validos = [];
    catalogo.forEach((bio) => {
      const registros = filasPorBiologico[bio.id] || [];
      // Biológicos agregados después del formato oficial (orden > 21)
      // no tienen renglón en la plantilla: escribirlos pisaría el pie de la
      // hoja, así que se omiten y se avisa en vez de perderlos en silencio.
      if (bio.orden > TOTAL_RENGLONES_PLANTILLA) {
        if (registros.some((r) => Number(r.cantidad) > 0)) sinRenglon.push(bio.nombre);
        return;
      }
      validos.push({ bio, registros, extra: Math.max(0, registros.length - 2) });
    });

    // 1) Abrir renglones de abajo hacia arriba (así las filas de arriba no se mueven).
    let filaFinal = FILA_FINAL_PLANTILLA;
    validos.slice().sort((x, y) => y.bio.orden - x.bio.orden).forEach((v) => {
      if (!v.extra) return;
      const primera = filaBase(v.bio.orden);
      abrirFilas(ws, primera, primera + 1, v.extra, filaFinal);
      filaFinal += v.extra;
    });
    const agregadas = filaFinal - FILA_FINAL_PLANTILLA;

    // 2) Escribir: la fila de cada biológico se recorre por los renglones agregados arriba de él.
    validos.forEach((v) => {
      const { bio, registros } = v;
      const desplazo = validos.filter((o) => o.bio.orden < bio.orden).reduce((acc, o) => acc + o.extra, 0);
      const base = filaBase(bio.orden) + desplazo;

      // A (CLAVE DE ARTÍCULO) y B (CÓDIGO) se escriben desde requi_catalogo_biologicos
      // (editable en la UI) para que una clave corregida sí se refleje en el Excel
      // exportado. A/B/F están fusionadas entre los renglones del biológico -- se escriben una vez.
      escribir(ws, `A${base}`, bio.clave_articulo);
      escribir(ws, `B${base}`, bio.codigo_articulo || '');

      // F (SOLICITADO) es UN solo total por biológico (suma de todos sus lotes);
      // G/H/I/J sí son por renglón (por lote).
      const total = registros.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
      if (total > 0) escribir(ws, `F${base}`, total);

      registros.forEach((r, i) => {
        const fila = base + i;
        if (r.cantidad !== undefined && r.cantidad !== null) {
          // El formato real no distingue autorizado/surtido en la práctica
          // -- se repite el mismo número en ambas columnas.
          escribir(ws, `G${fila}`, r.cantidad);
          escribir(ws, `H${fila}`, r.cantidad);
        }
        if (r.numeroLote) escribir(ws, `I${fila}`, r.numeroLote);
        // 'Z' -- ExcelJS serializa Date a número de serie con sus componentes
        // UTC; una medianoche LOCAL sin 'Z' se serializa con ".25" de fracción de día.
        if (r.caducidad) escribir(ws, `J${fila}`, new Date(r.caducidad + 'T00:00:00Z'));
      });
    });
    return { sinRenglon, agregadas };
  }

  async function generar({ plantillaBuffer, encabezado, firmas, catalogo, filasPorBiologico }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantillaBuffer);
    const ws = wb.getWorksheet(HOJA);
    if (!ws) throw new Error(`La plantilla no tiene la hoja "${HOJA}".`);

    // La plantilla no traía tamaño de papel explícito -- se fuerza Carta
    // siempre, sin depender de lo que el archivo original haya heredado.
    ws.pageSetup.paperSize = 1; // 1 = Letter/Carta (OOXML)

    limpiarDatosPrevios(ws);
    limpiarTablaJeringas(ws);
    escribirEncabezado(ws, encabezado || {});
    const { sinRenglon, agregadas } = escribirBiologicos(ws, catalogo || [], filasPorBiologico || {});
    escribirFirmas(ws, firmas || {}, agregadas);
    ws.pageSetup.printArea = `A1:K${FILA_FINAL_PLANTILLA + agregadas}`;
    ocultarOtrasHojas(wb, HOJA);

    const buffer = await wb.xlsx.writeBuffer();
    // `sobrantes` se conserva vacío por compatibilidad: ya no hay límite de 2 lotes.
    return { buffer, sobrantes: [], sinRenglon };
  }

  return { generar };
});
