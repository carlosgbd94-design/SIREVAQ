/**
 * SIS / SINBA -- CSV del concentrado mensual (UN solo generador).
 *
 * Antes había tres copias casi iguales (pestaña CSV de biovac.html, tarjeta de Seguimiento y el botón de
 * exportación de index.html) con DOS formatos distintos de columnas. Ahora todas pasan por aquí:
 *
 *   CLUES, VARIABLE, VALOR, MES, AÑO, MUNICIPIO
 *
 * que es el formato de la hoja "CSV" del archivo oficial del municipal ("SIS QUERETARO ... .xlsx") y que el
 * panel RDA también acepta (rda_parser.js reconoce VARIABLE/VARIABLE_SIS y AÑO/ANIO).
 *
 * Las filas NO se arman en el navegador: salen del servidor (RPC sis_filas_csv), la misma fuente con la que se
 * publica a registros_sis (sis_publicar_registros_sis), así el CSV y la tabla de indicadores nunca difieren.
 * Solo hay CSV de un municipio cuando TODAS sus unidades ya están validadas.
 */
(function () {
  const HEADERS = ['CLUES', 'VARIABLE', 'VALOR', 'MES', 'AÑO', 'MUNICIPIO'];

  // Nombre como lo escribe la hoja CSV del Excel oficial (QUERÉTARO con acento); NHG/HENM se dejan igual
  const NOMBRE_OFICIAL = { QUERETARO: 'QUERÉTARO', MARQUES: 'EL MARQUÉS' };
  const nombreOficial = (m) => NOMBRE_OFICIAL[m] || m;

  function aFilas(data, mes, anio, municipio) {
    return (data || []).map((f) => ({
      CLUES: f.clues, VARIABLE: f.variable_sis, VALOR: f.valor, MES: Number(mes), 'AÑO': Number(anio), MUNICIPIO: nombreOficial(f.municipio || municipio)
    }));
  }

  function aTexto(filas) {
    const lineas = [HEADERS.join(',')].concat(
      filas.map((r) => HEADERS.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    );
    // BOM para que Excel abra bien los acentos
    return '﻿' + lineas.join('\r\n');
  }

  function descargar(nombreArchivo, filas) {
    const blob = new Blob([aTexto(filas)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---- Libro de Excel para estadística: UNA pestaña por unidad, con las mismas columnas del CSV ----
  // Nombre de pestaña: NOMBRE_CLUES (p. ej. JURICA_QTSSA001793). Excel limita a 31 caracteres y prohíbe
  // : \ / ? * [ ], así que se recorta el nombre de la unidad (la CLUES siempre va completa).
  function nombrePestana(unidad, clues, usados) {
    const limpio = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[:\\/?*\[\]]/g, ' ').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
    const c = limpio(clues);
    const disponible = Math.max(0, 31 - c.length - 1);
    const n = limpio(unidad).slice(0, disponible).replace(/_+$/, '');
    let base = n ? `${n}_${c}` : c;
    let nombre = base, i = 2;
    while (usados.has(nombre.toLowerCase())) { const suf = `_${i++}`; nombre = base.slice(0, 31 - suf.length) + suf; }
    usados.add(nombre.toLowerCase());
    return nombre;
  }

  // Agrupa las filas por CLUES, ordenadas por CLUES (y por VARIABLE dentro de cada una).
  function agruparPorClues(filas) {
    const mapa = new Map();
    (filas || []).forEach((r) => { if (!mapa.has(r.CLUES)) mapa.set(r.CLUES, []); mapa.get(r.CLUES).push(r); });
    return [...mapa.keys()].sort((a, b) => String(a).localeCompare(String(b))).map((clues) => ({ clues, filas: mapa.get(clues) }));
  }

  async function aLibro(filas, nombres) {
    if (!window.ExcelJS && typeof window.ensureLibsLoaded === 'function') {
      try { await window.ensureLibsLoaded('exceljs'); } catch (e) { console.warn('[SIS_CSV] exceljs no cargó:', e); }
    }
    if (!window.ExcelJS) throw new Error('No cargó la librería de Excel. Revisa tu conexión e inténtalo de nuevo.');
    const wb = new window.ExcelJS.Workbook();
    const usados = new Set();
    agruparPorClues(filas).forEach(({ clues, filas: fs }) => {
      const ws = wb.addWorksheet(nombrePestana((nombres || {})[clues], clues, usados));
      ws.columns = HEADERS.map((h) => ({ header: h, key: h, width: h === 'MUNICIPIO' ? 18 : (h === 'CLUES' ? 16 : 11) }));
      ws.getRow(1).font = { bold: true };
      fs.slice().sort((a, b) => String(a.VARIABLE).localeCompare(String(b.VARIABLE))).forEach((r) => {
        ws.addRow(HEADERS.map((h) => (['VALOR', 'MES', 'AÑO'].includes(h) ? Number(r[h]) : r[h])));
      });
    });
    return wb;
  }

  async function descargarLibro(nombreArchivo, filas, nombres) {
    const wb = await aLibro(filas, nombres);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // clues -> nombre de la unidad, tomado del seguimiento del mes (mismo origen que el resto del módulo SIS).
  // Si no se puede leer, la pestaña se queda solo con la CLUES.
  async function nombresDeUnidades(db, mes, anio) {
    try {
      const { data } = await db.rpc('sis06p_resumen_seguimiento', { p_mes: Number(mes), p_anio: Number(anio) });
      const m = {};
      (Array.isArray(data) ? data : []).forEach((f) => { if (f && f.clues && f.unidad) m[f.clues] = f.unidad; });
      return m;
    } catch (e) { return {}; }
  }

  // Pide al servidor las filas oficiales del municipio. Lanza el error del servidor (p. ej. "Faltan por
  // validar: ...") para que quien llama lo muestre.
  async function filasDeMunicipio(db, municipio, mes, anio) {
    const { data, error } = await db.rpc('sis_filas_csv', { p_mes: Number(mes), p_anio: Number(anio), p_municipio: municipio });
    if (error) throw error;
    return aFilas(data, mes, anio, municipio);
  }

  window.SIS_CSV = { HEADERS, aFilas, aTexto, descargar, filasDeMunicipio, nombrePestana, agruparPorClues, aLibro, descargarLibro, nombresDeUnidades };
})();
