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

  // La plantilla tiene 20 renglones físicos (filas 14-53) sin importar
  // cuántos biológicos estén activos hoy en el catálogo -- se limpian TODOS
  // antes de escribir, porque requisiciones_plantilla.xlsx es una copia real
  // de "Municipio Corregidora.xlsx" y trae datos reales de septiembre ya
  // capturados en esas celdas (cantidades, lotes) que de otro modo se
  // quedarían pegados en cualquier renglón que esta exportación no llene.
  const TOTAL_RENGLONES_PLANTILLA = 20;

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
    for (let r = 1; r <= 90; r++) {
      ['M', 'N', 'O', 'P', 'Q'].forEach((col) => { ws.getCell(`${col}${r}`).value = null; });
    }
    ws.pageSetup.printArea = 'A1:K87';
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

  // Elaboró/Autorizó (filas 65-66) se imprimen igual en las 3 copias.
  // Entrega/Recibe (fila 72) se deja SIN nombre para el nivel UNIDAD -- la
  // unidad firma a mano y anota su propio nombre en el papel (fila 73, ya
  // impresa en la plantilla, no se toca).
  function escribirFirmas(ws, firmas) {
    escribir(ws, 'A65', firmas.elaboro_nombre || '');
    escribir(ws, 'A66', firmas.elaboro_cargo || '');
    escribir(ws, 'H65', firmas.autorizo_nombre || '');
    escribir(ws, 'H66', firmas.autorizo_cargo || '');
    escribir(ws, 'A72', firmas.entrega_nombre || '');
    escribir(ws, 'H72', firmas.recibe_nombre || '');
  }

  // filasPorBiologico: { [requi_biologico_id]: [{ cantidad, numeroLote, caducidad }, ...] }
  // Se usan como máximo 2 registros por biológico (límite físico de la
  // plantilla); si sobran más, se reportan en `sobrantes` para avisar al
  // usuario en vez de perderlos en silencio.
  function escribirBiologicos(ws, catalogo, filasPorBiologico) {
    const sobrantes = [];
    catalogo.forEach((bio) => {
      const registros = filasPorBiologico[bio.id] || [];
      if (registros.length > 2) sobrantes.push(bio.nombre);
      const usados = registros.slice(0, 2);

      // A (CLAVE DE ARTÍCULO) y B (CÓDIGO) venían fijas en la plantilla --
      // texto plano de la captura de septiembre, sin relación con el
      // catálogo real. Ahora se escriben desde requi_catalogo_biologicos
      // (editable en la UI) para que una clave corregida sí se refleje en
      // el Excel exportado, no solo en pantalla. Igual que F, A/B están
      // fusionadas entre las 2 filas del biológico -- se escriben una vez.
      escribir(ws, `A${filaBase(bio.orden)}`, bio.clave_articulo);
      escribir(ws, `B${filaBase(bio.orden)}`, bio.codigo_articulo || '');

      // F (SOLICITADO) está fusionada entre las 2 filas del biológico -- es
      // UN solo total, no un valor por lote. Escribirlo dos veces pisaría el
      // mismo valor (la fusión apunta a una sola celda real). Se escribe una
      // vez con la suma de los lotes usados; G/H sí son por fila (por lote).
      const total = usados.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
      if (total > 0) escribir(ws, `F${filaBase(bio.orden)}`, total);

      usados.forEach((r, i) => {
        const fila = filaBase(bio.orden) + i;
        if (r.cantidad !== undefined && r.cantidad !== null) {
          // El formato real no distingue autorizado/surtido en la práctica
          // -- se repite el mismo número en ambas columnas, igual que en
          // los archivos reales de septiembre.
          escribir(ws, `G${fila}`, r.cantidad);
          escribir(ws, `H${fila}`, r.cantidad);
        }
        if (r.numeroLote) escribir(ws, `I${fila}`, r.numeroLote);
        if (r.caducidad) escribir(ws, `J${fila}`, new Date(r.caducidad + 'T00:00:00'));
      });
    });
    return sobrantes;
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
    escribirFirmas(ws, firmas || {});
    const sobrantes = escribirBiologicos(ws, catalogo || [], filasPorBiologico || {});
    ocultarOtrasHojas(wb, HOJA);

    const buffer = await wb.xlsx.writeBuffer();
    return { buffer, sobrantes };
  }

  return { generar };
});
