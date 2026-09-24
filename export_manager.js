/**
 * export_manager.js — Motor Unificado de Exportación de Reportes Institucionales para SIREVAQ
 * Permite exportar reportes oficiales en Excel (.xlsx con fórmulas nativas), PDF vectorial continuo y PNG HD.
 */

(function (window) {
  'use strict';

  // ── 1. Cargar Dinámicamente Librerías de Exportación si no están presentes ─
  function loadExportLibraries() {
    return new Promise((resolve) => {
      const promises = [];

      // SheetJS (XLSX)
      if (!window.XLSX) {
        promises.push(loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'));
      }
      // html2pdf
      if (!window.html2pdf) {
        promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'));
      }
      // html2canvas
      if (!window.html2canvas) {
        promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'));
      }

      Promise.all(promises).then(() => resolve(true)).catch((err) => {
        console.warn('[ExportManager] Ocurrió un error cargando librerías secundarias:', err);
        resolve(false);
      });
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ── 2. Exportación a Excel Profesional (.XLSX) con Fórmulas ────────────────
  /**
   * Genera un libro de Excel con formato institicional, cabeceras y fórmulas de suma nativas
   * @param {string} fileName Nombre del archivo sin extensión
   * @param {string} sheetName Nombre de la pestaña
   * @param {Array<string>} headers Columnas de cabecera
   * @param {Array<Array>} dataRows Matriz de datos de las filas
   * @param {boolean} includeTotalRow Agregar fila final de TOTALES con fórmulas =SUM(...)
   */
  async function exportToExcel(fileName, sheetName, headers, dataRows, includeTotalRow = true) {
    await loadExportLibraries();

    if (!window.XLSX) {
      alert('La librería XLSX no está disponible. Revisa la conexión.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Matriz completa con encabezados
    const fullData = [
      ['SECRETARÍA DE SALUD DE QUERÉTARO - JURISDICCIÓN SANITARIA 1'],
      [`REPORTE OFICIAL SIREVAQ - FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-MX')}`],
      [], // Fila en blanco
      headers,
      ...dataRows
    ];

    // Si requiere fórmula de Totales
    if (includeTotalRow && dataRows.length > 0) {
      const totalRow = ['TOTALES JURISDICCIONALES'];

      headers.forEach((h, colIdx) => {
        if (colIdx === 0) return; // Ya se puso la etiqueta

        // Verificar si la columna tiene números
        const isNumericCol = dataRows.some(r => typeof r[colIdx] === 'number');
        if (isNumericCol) {
          const colLetter = XLSX.utils.encode_col(colIdx);
          const startRow = 5; // Fila donde inician los datos (1-indexed en Excel)
          const endRow = 4 + dataRows.length;
          totalRow.push({ f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})` });
        } else {
          totalRow.push('');
        }
      });

      fullData.push(totalRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(fullData);

    // Ajustar anchos de columnas automáticamente
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      dataRows.forEach(r => {
        const val = String(r[i] || '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Reporte');
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── 3. Exportación a PDF Vectorial Continuo ────────────────────────────────
  /**
   * Genera un PDF de alta calidad a partir de un elemento del DOM evitando cortes de tabla incompletos
   * @param {string|HTMLElement} elementOrId ID o elemento HTML a exportar
   * @param {string} fileName Nombre del archivo sin extensión
   * @param {string} orientation 'portrait' o 'landscape'
   */
  async function exportToPDF(elementOrId, fileName = 'Reporte_SIREVAQ', orientation = 'landscape') {
    await loadExportLibraries();

    const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!element) {
      console.error('[ExportManager] Elemento no encontrado para exportar PDF:', elementOrId);
      return;
    }

    if (!window.html2pdf) {
      alert('El motor de generación PDF se está cargando. Intenta de nuevo en unos segundos.');
      return;
    }

    const opt = {
      margin: [10, 10, 10, 10], // mm
      filename: `${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'letter', orientation: orientation },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      if (window.showToast) window.showToast('Generando PDF en alta resolución...', 'info');
      if (window.ensureLibsLoaded) await window.ensureLibsLoaded('html2pdf');
      await window.html2pdf().set(opt).from(element).save();
      if (window.showToast) window.showToast('🟢 PDF generado con éxito.', 'success');
    } catch (err) {
      console.error('[ExportManager] Error generando PDF:', err);
    }
  }

  // ── 4. Exportación a Imagen PNG de Alta Definición (2x DPI) ─────────────────
  /**
   * Captura una tarjeta o reporte del DOM y descarga una imagen PNG en alta calidad
   * @param {string|HTMLElement} elementOrId ID o elemento HTML
   * @param {string} fileName Nombre del archivo
   */
  async function exportToPNG(elementOrId, fileName = 'Tarjeta_Reporte_SIREVAQ') {
    await loadExportLibraries();

    const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!element) return;

    if (!window.html2canvas) {
      alert('Cargando librería de captura de imagen...');
      return;
    }

    try {
      if (window.showToast) window.showToast('Generando imagen HD para compartir...', 'info');

      if (window.ensureLibsLoaded) await window.ensureLibsLoaded('html2canvas');
      const canvas = await window.html2canvas(element, {
        scale: 2.5, // Alta resolución
        backgroundColor: '#0f172a', // Fondo slate elegante
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (window.showToast) window.showToast('🟢 Imagen PNG descargada.', 'success');
    } catch (err) {
      console.error('[ExportManager] Error generando PNG:', err);
    }
  }

  // Exportar API Global
  window.ExportManager = {
    exportToExcel,
    exportToPDF,
    exportToPNG,
    loadExportLibraries
  };

  // Precargar librerías en segundo plano
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadExportLibraries, 3000);
  });

})(window);
