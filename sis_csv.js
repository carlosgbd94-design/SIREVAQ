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

  // Pide al servidor las filas oficiales del municipio. Lanza el error del servidor (p. ej. "Faltan por
  // validar: ...") para que quien llama lo muestre.
  async function filasDeMunicipio(db, municipio, mes, anio) {
    const { data, error } = await db.rpc('sis_filas_csv', { p_mes: Number(mes), p_anio: Number(anio), p_municipio: municipio });
    if (error) throw error;
    return aFilas(data, mes, anio, municipio);
  }

  window.SIS_CSV = { HEADERS, aFilas, aTexto, descargar, filasDeMunicipio };
})();
