/**
 * Exportación de las metas de COVID-19 al formato oficial de la temporada invernal
 * («Formatos/Metas COVID-19 plantilla.xlsx», sacada del bloque COVID-19 de «METAS POR UNIDAD DE SALUD»
 * de FORMATOS_TEMPORADA_INVERNAL_2026-2027.xlsx).
 *
 * - Una columna por unidad con meta; al final TOTAL (si hay más de una). Los hospitales (HENM y NHGQ) llevan su
 *   propio archivo con la meta que Jurisdicción les asigna como destino.
 * - Seis renglones (c1..c6) y dos totales: «META: TOTAL DOSIS POR APLICAR (0.5 mL y 0.25 mL)» y
 *   «TOTAL DOSIS POR APLICAR (0.5 mL)» (los niños de 0.25 mL valen la mitad). Ambos son fórmulas de Excel.
 * - Más de 20 unidades: se parten en hojas de 20 columnas, cada una con su TOTAL.
 */
(function (root) {
  "use strict";

  const RUBROS = ["c1", "c2", "c3", "c4", "c5", "c6"];
  const FILA_ENCABEZADO = 10;
  const FILA_PRIMER_RUBRO = 11;
  const FILA_ULTIMO_RUBRO = 16;
  const FILA_TOTAL_MIXTO = 17;       // 0.5 mL y 0.25 mL sumados tal cual
  const FILA_TOTAL_EQUIV = 18;       // dosis equivalentes de 0.5 mL
  const COL_PRIMERA = 8;             // H
  const MAX_UNIDADES_HOJA = 20;

  const CLUES_HOSPITALES = { NHG: "QTSSA002901", HENM: "QTSSA001740" };
  const HOSPITALES_CLUES = new Set(Object.values(CLUES_HOSPITALES));
  const HOSPITALES = [
    { label: "NHGQ", nombre: "NHGQ", clues: "QTSSA002901", destino: "NHG" },
    { label: "HENM", nombre: "HENM", clues: "QTSSA001740", destino: "HENM" }
  ];

  const MUNICIPIOS = {
    QUERETARO: { etiqueta: "QUERÉTARO", archivo: "Querétaro" },
    CORREGIDORA: { etiqueta: "CORREGIDORA", archivo: "Corregidora" },
    MARQUES: { etiqueta: "EL MARQUÉS", archivo: "El Marqués" },
    HUIMILPAN: { etiqueta: "HUIMILPAN", archivo: "Huimilpan" },
    HOSPITALES: { etiqueta: "HOSPITALES (QUERÉTARO)", archivo: "Hospitales" }
  };

  const mayus = (t) => String(t == null ? "" : t).trim().toUpperCase();
  const letra = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const tieneMeta = (m) => !!m && RUBROS.some((r) => Number(m[r] || 0) > 0);

  function metasDe(metas, { clues, destino }) {
    let hallado = null;
    (metas || []).forEach((m) => {
      if (clues ? m.clues === clues : (!m.clues && mayus(m.municipio) === destino)) hallado = m;
    });
    return hallado ? (hallado.metas || {}) : null;
  }

  /** Meta de una columna: el hospital toma la de su destino; las demás unidades, la de su CLUES. */
  function metasDeColumna(metas, col) {
    if (col.destino) return metasDe(metas, { destino: col.destino }) || metasDe(metas, { clues: col.clues });
    return metasDe(metas, { clues: col.clues });
  }

  /** Columnas (unidades) del municipio que tienen meta de COVID-19. */
  function columnasDelMunicipio(muni, unidades, metas) {
    if (muni === "HOSPITALES") return HOSPITALES.filter((c) => tieneMeta(metasDeColumna(metas, c)));
    return (unidades || [])
      .filter((u) => mayus(u.municipio) === muni && !HOSPITALES_CLUES.has(u.clues) && tieneMeta(metasDe(metas, { clues: u.clues })))
      .sort((a, b) => String(a.unidad).localeCompare(String(b.unidad), "es"))
      .map((u) => ({ label: mayus(u.unidad), nombre: mayus(u.unidad), clues: u.clues }));
  }

  function trocear(lista, n) {
    const out = [];
    for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
    return out.length ? out : [[]];
  }

  function clonarHoja(wb, origen, nombre) {
    const copia = wb.addWorksheet(nombre);
    copia.model = Object.assign({}, origen.model, { name: nombre, id: copia.id });
    copia.name = nombre;
    return copia;
  }

  /** Copia el estilo de la columna H (renglones 10..18) a la columna c. */
  function clonarColumna(ws, c) {
    for (let r = FILA_ENCABEZADO; r <= FILA_TOTAL_EQUIV; r++) ws.getCell(r, c).style = Object.assign({}, ws.getCell(r, COL_PRIMERA).style);
  }

  function llenarHoja(ws, columnas, ctx) {
    const n = columnas.length;
    const conTotal = n > 1;
    const ultima = COL_PRIMERA + Math.max(n, 1) - 1;
    const colTotal = ultima + 1;
    // El estilo de H se copia antes de pisar su contenido
    const estilos = {};
    for (let r = FILA_ENCABEZADO; r <= FILA_TOTAL_EQUIV; r++) estilos[r] = Object.assign({}, ws.getCell(r, COL_PRIMERA).style);
    const poner = (c) => {
      for (let r = FILA_ENCABEZADO; r <= FILA_TOTAL_EQUIV; r++) ws.getCell(r, c).style = Object.assign({}, estilos[r]);
    };

    const filaTotal = (c) => {
      const L = letra(c);
      ws.getCell(FILA_TOTAL_MIXTO, c).value = { formula: `SUM(${L}${FILA_PRIMER_RUBRO}:${L}${FILA_ULTIMO_RUBRO})` };
      ws.getCell(FILA_TOTAL_EQUIV, c).value = { formula: `((${L}${FILA_PRIMER_RUBRO}+${L}${FILA_PRIMER_RUBRO + 1})/2)+${L}${FILA_PRIMER_RUBRO + 2}+${L}${FILA_PRIMER_RUBRO + 3}+${L}${FILA_PRIMER_RUBRO + 4}+${L}${FILA_PRIMER_RUBRO + 5}` };
    };

    columnas.forEach((u, i) => {
      const c = COL_PRIMERA + i;
      if (i > 0) poner(c);
      ws.getColumn(c).width = 17;
      ws.getCell(FILA_ENCABEZADO, c).value = u.label;
      const m = metasDeColumna(ctx.metas, u) || {};
      RUBROS.forEach((id, k) => {
        const v = Number(m[id] || 0);
        ws.getCell(FILA_PRIMER_RUBRO + k, c).value = v > 0 ? v : null;
      });
      filaTotal(c);
    });
    if (!n) { ws.getCell(FILA_ENCABEZADO, COL_PRIMERA).value = "SIN META"; }
    if (conTotal) {
      poner(colTotal);
      ws.getColumn(colTotal).width = 17;
      ws.getCell(FILA_ENCABEZADO, colTotal).value = "TOTAL";
      const a = letra(COL_PRIMERA), b = letra(ultima);
      for (let r = FILA_PRIMER_RUBRO; r <= FILA_ULTIMO_RUBRO; r++) ws.getCell(r, colTotal).value = { formula: `SUM(${a}${r}:${b}${r})` };
      filaTotal(colTotal);
    }
    // El encabezado de unidad puede llevar nombres largos
    ws.getRow(FILA_ENCABEZADO).height = n && columnas.some((u) => String(u.label).length > 18) ? 48 : 32;
    ws.getRow(FILA_ENCABEZADO).eachCell((cell) => { cell.alignment = Object.assign({}, cell.alignment, { wrapText: true, vertical: "middle", horizontal: "center" }); });

    // Datos del encabezado de la plantilla
    const dato = (dir, valor) => {
      const c = ws.getCell(dir);
      c.value = valor;
      c.font = { name: "Noto Sans", size: 12, bold: true };
      c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    };
    try { ws.mergeCells("D6:E6"); } catch (e) { /* ya combinada */ }
    try { ws.mergeCells("D7:E7"); } catch (e) { /* ya combinada */ }
    dato("D6", "QUERÉTARO");
    dato("D7", ctx.unidadEtiqueta || "DEPARTAMENTO DE VACUNAS");
    dato("G6", ctx.muniEtiqueta);
    dato("G7", 1);
    ["B5", "B11"].forEach((a) => {
      const cell = ws.getCell(a);
      if (typeof cell.value === "string") cell.value = cell.value.replace(/2026-2027/g, ctx.campana);
    });
    ws.pageSetup = Object.assign({}, ws.pageSetup, { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
  }

  /**
   * Arma el libro de un municipio (o de una sola unidad con `soloClues`).
   * ctx: { ExcelJS, plantilla, muni, campana, metas, unidades, soloClues?, unidadEtiqueta? }
   */
  async function construirLibroCovid(ctx) {
    const muni = mayus(ctx.muni);
    if (!MUNICIPIOS[muni]) throw new Error(`Municipio desconocido: ${ctx.muni}`);
    const campana = ctx.campana || "2026-2027";
    const base = { muniEtiqueta: MUNICIPIOS[muni].etiqueta, campana, metas: ctx.metas || [], unidadEtiqueta: ctx.unidadEtiqueta || "" };

    const wb = new ctx.ExcelJS.Workbook();
    await wb.xlsx.load(ctx.plantilla);
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    const hoja = wb.worksheets[0];
    if (!hoja) throw new Error("La plantilla de COVID-19 no tiene hojas.");

    let cols = columnasDelMunicipio(muni, ctx.unidades, base.metas);
    if (ctx.soloClues) {
      const conocida = HOSPITALES.find((h) => h.clues === ctx.soloClues);
      const unidad = (ctx.unidades || []).find((u) => u.clues === ctx.soloClues);
      cols = conocida ? [conocida] : [{ label: mayus(unidad ? unidad.unidad : ctx.soloClues), nombre: mayus(unidad ? unidad.unidad : ctx.soloClues), clues: ctx.soloClues }];
      if (!tieneMeta(metasDeColumna(base.metas, cols[0]))) throw new Error("La unidad no tiene meta de COVID-19 en esta campaña.");
      base.unidadEtiqueta = base.unidadEtiqueta || cols[0].nombre;
    }
    if (!cols.length) throw new Error("No hay unidades con meta de COVID-19 en este municipio.");

    const grupos = trocear(cols, MAX_UNIDADES_HOJA);
    grupos.forEach((grupo, i) => {
      const nombre = i === 0 ? "METAS COVID-19" : `METAS COVID-19 (${i + 1})`;
      const ws = i === 0 ? hoja : clonarHoja(wb, hoja, nombre);
      llenarHoja(ws, grupo, base);
    });
    return wb;
  }

  async function escribirLibro(wb) {
    return wb.xlsx.writeBuffer();
  }

  function nombreArchivo(muni, campana) {
    return `Metas COVID-19 ${MUNICIPIOS[mayus(muni)].archivo} ${campana || "2026-2027"}.xlsx`;
  }

  function nombreArchivoUnidad(unidad, campana) {
    const limpio = String(unidad || "Unidad").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    return `Metas COVID-19 ${limpio} ${campana || "2026-2027"}.xlsx`;
  }

  const api = {
    construirLibroCovid, escribirLibro, nombreArchivo, nombreArchivoUnidad, columnasDelMunicipio,
    MUNICIPIOS, HOSPITALES, CLUES_HOSPITALES, RUBROS
  };
  root.CovidMetasExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
