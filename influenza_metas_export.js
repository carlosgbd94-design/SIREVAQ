/**
 * Exportación de las metas de Influenza al formato oficial
 * («Formatos/Metas Influenza Querétaro 2025-2026.xlsx»).
 *
 * - Solo salen las unidades que tienen meta. Los hospitales (HENM y NHGQ) no son del municipio de Querétaro:
 *   llevan su propio archivo con la meta que Jurisdicción les asigna.
 * - Querétaro lleva dos hojas de unidades (URBANAS y RURALES) porque en una sola quedarían demasiado
 *   angostas; Corregidora, El Marqués y Huimilpan llevan una sola hoja («METAS UNIDADES»).
 * - Cada libro trae además «Comparación» (suma de las unidades contra la meta del municipio) y
 *   «DISTRIBUCIÓN DE JERINGA» (cajas de 50 y piezas sueltas por unidad).
 * - Jeringa 23x25 (clave 2707, azul): rubros r1..r14, renglones 11-24 de la plantilla.
 *   Jeringa 22x32 (clave 2715): rubros r15..r46, renglones 25-56. Las claves de cada una están abajo.
 *
 * Los renglones de la plantilla (11..56) siguen el mismo orden que INFLUENZA_RUBROS (r1..r46).
 * Todo el cálculo (totales, jeringas, frascos) queda como fórmula de Excel, no como número fijo.
 */
(function (root) {
  "use strict";

  const CLAVES_JERINGA_23X25 = [
    "BIE01", "BIE28", "BIE29", "BIE30", "BIE31", "BIE04", "BIE32", "BIE33", "BIE34", "BIE35",
    "BIE36", "BIE37", "BIE38", "BIE39"
  ];
  const CLAVES_JERINGA_22X32 = [
    "BIE40", "BIO96", "BIO97", "BIE09", "BIE10", "BIE41", "BIE12", "BIE13", "BIE42", "BIE15", "BIE16",
    "BIE43", "BIE18", "BIE19", "BIE44", "BIE48", "BIE49", "BIE50", "BIE24", "BIE25", "BIE46", "BIE51",
    "BIE52", "BIE53", "BIE54", "BIE55", "BIE56", "BIE57", "BIE58", "BIE59", "BIE60", "BIE61"
  ];
  const N_RUBROS_23X25 = CLAVES_JERINGA_23X25.length;                       // 14
  const N_RUBROS = N_RUBROS_23X25 + CLAVES_JERINGA_22X32.length;            // 46

  const FILA_PRIMER_RUBRO = 11;                                             // renglón de r1 en las hojas de unidades
  const FILA_ULTIMO_RUBRO = FILA_PRIMER_RUBRO + N_RUBROS - 1;               // 56
  const FILA_ULTIMO_23X25 = FILA_PRIMER_RUBRO + N_RUBROS_23X25 - 1;         // 24
  const COL_PRIMERA_UNIDAD = 7;                                             // G
  const COL_ULTIMA_UNIDAD = 26;                                             // Z
  const COL_TOTAL = 27;                                                     // AA
  const MAX_UNIDADES_HOJA = COL_ULTIMA_UNIDAD - COL_PRIMERA_UNIDAD + 1;     // 20
  const DOSIS_POR_CAJA = 50;

  const CLUES_HOSPITALES = { NHG: "QTSSA002901", HENM: "QTSSA001740" };
  const HOSPITALES_CLUES = new Set(Object.values(CLUES_HOSPITALES));

  // Columnas de la plantilla de Querétaro, en su orden. `label` es el encabezado de la hoja y `nombre` el de
  // la hoja de jeringas (los dos vienen de la plantilla). Se enlazan por CLUES para no depender de cómo se
  // escriba el nombre en el catálogo.
  const URBANAS_QRO = [
    { label: "UMME\nUMQ", nombre: "UMME QUERÉTARO", clues: "QTSSA001764" },
    { label: "JURICA", nombre: "JURICA", clues: "QTSSA001793" },
    { label: "MENCHACA", nombre: "MENCHACA", clues: "QTSSA001810" },
    { label: "SAN ANTONIO DE LA PUNTA", nombre: "SAN ANTONIO DE LA PUNTA", clues: "QTSSA001822" },
    { label: "SAN PABLO", nombre: "SAN PABLO", clues: "QTSSA001834" },
    { label: "CARRILLO PUERTO", nombre: "FELIPE CARRILLO PUERTO", clues: "QTSSA001846" },
    { label: "LOMA BONITA", nombre: "LOMA BONITA", clues: "QTSSA001851" },
    { label: "PEDRO ESCOBEDO", nombre: "PEDRO ESCOBEDO", clues: "QTSSA001863" },
    { label: "SANTA MARÍA MAGDALENA", nombre: "SANTA MARÍA MAGDALENA", clues: "QTSSA001974" },
    { label: "TLACOTE EL BAJO", nombre: "TLACOTE EL BAJO", clues: "QTSSA002020" },
    { label: "LÁZARO CÁRDENAS", nombre: "LÁZARO CÁRDENAS", clues: "QTSSA002522" },
    { label: "SAN PEDRITO PEÑUELAS", nombre: "SAN PEDRITO PEÑUELAS", clues: "QTSSA002534" },
    { label: "MENCHACA NORTE", nombre: "MENCHACA NORTE", clues: "QTSSA002703" },
    { label: "SAN JOSÉ EL ALTO", nombre: "SAN JOSÉ EL ALTO", clues: "QTSSA012240" },
    { label: "SANTA ROSA JÁUREGUI", nombre: "SANTA ROSA JÁUREGUI", clues: "QTSSA012655" },
    { label: "SATÉLITE", nombre: "SATÉLITE", clues: "QTSSA012923" },
    { label: "SAN PEDRO MÁRTIR", nombre: "SAN PEDRO MÁRTIR", clues: "QTSSA012976" },
    { label: "LOMAS DE CASABLANCA", nombre: "LOMAS DE CASA BLANCA", clues: "QTSSA012982" }
  ];
  // Los hospitales no son del municipio de Querétaro: llevan su propio archivo, con la meta que Jurisdicción
  // les asigna como destino (HENM y NHG en la distribución de metas).
  const HOSPITALES = [
    { label: "NHGQ", nombre: "NHGQ", clues: "QTSSA002901", destino: "NHG" },
    { label: "HENM", nombre: "HENM", clues: "QTSSA001740", destino: "HENM" }
  ];
  const RURALES_QRO = [
    { label: "JOFRITO", nombre: "JOFRITO", clues: "QTSSA001904" },
    { label: "MONTENEGRO", nombre: "MONTENEGRO", clues: "QTSSA001916" },
    { label: "PIE DE GALLO", nombre: "PIE DE GALLO", clues: "QTSSA001921" },
    { label: "SAN JOSÉ BUENAVISTA", nombre: "SAN JOSÉ BUENAVISTA", clues: "QTSSA001945" },
    { label: "SAN MIGUELITO", nombre: "SAN MIGUELITO", clues: "QTSSA001962" },
    { label: "LA SOLANA", nombre: "LA SOLANA", clues: "QTSSA002003" },
    { label: "TINAJA DE LA ESTANCIA", nombre: "TINAJA DE LA ESTANCIA", clues: "QTSSA002015" },
    { label: "UMME AMB1", nombre: "UMME AMBULANCIA 1", clues: "QTSSA012561" },
    { label: "UMME CERRO DE LA CRUZ", nombre: "UMME CERRO DE LA CRUZ", clues: "QTSSA003553" },
    { label: "UMME LA LUZ", nombre: "UMME LA LUZ", clues: "QTSSA003562" },
    { label: "UMME SAN PEDRITO", nombre: "UMME SAN PEDRITO", clues: "QTSSA003595" },
    { label: "UMME RANCHO LARGO", nombre: "UMME RANCHO LARGO", clues: "QTSSA003604" },
    { label: "LA GOTERA", nombre: "LA GOTERA", clues: "QTSSA003715" },
    { label: "FAM SAN JOSÉ BUENAVISTA", nombre: "FAM SAN JOSÉ BUENAVISTA", clues: "QTSSA012276" },
    { label: "FAM PEDRO ESCOBEDO", nombre: "FAM PEDRO ESCOBEDO", clues: "QTSSA012281" },
    { label: "FAM EL MARQUES 2", nombre: "FAM PALO ALTO", clues: "QTSSA012544" },
    { label: "UMME MF1", nombre: "UMME MF1", clues: "QTSSA012556" },
    { label: "UMME AMB2", nombre: "UMME AMBULANCIA 2", clues: "QTSSA012585" },
    { label: "UMME MEDICO DENTAL", nombre: "UMME MEDICO DENTAL", clues: "QTSSA012631" }
  ];

  const MUNICIPIOS = {
    QUERETARO: { etiqueta: "QUERÉTARO", archivo: "Querétaro" },
    CORREGIDORA: { etiqueta: "CORREGIDORA", archivo: "Corregidora" },
    MARQUES: { etiqueta: "EL MARQUÉS", archivo: "El Marqués" },
    HUIMILPAN: { etiqueta: "HUIMILPAN", archivo: "Huimilpan" },
    HOSPITALES: { etiqueta: "HOSPITALES (QUERÉTARO)", archivo: "Hospitales" }
  };

  const mayus = (t) => String(t == null ? "" : t).trim().toUpperCase();
  const comillas = (nombreHoja) => `'${nombreHoja.replace(/'/g, "''")}'`;
  const letra = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

  function claveJeringa(indiceRubro) { return indiceRubro < N_RUBROS_23X25 ? "2707" : "2715"; }

  /** Metas (por rubro) de una unidad o de un municipio/destino, o null si no hay registro. */
  function metasDe(metas, { clues, destino }) {
    let hallado = null;
    (metas || []).forEach((m) => {
      if (clues ? m.clues === clues : (!m.clues && mayus(m.municipio) === destino)) hallado = m;
    });
    return hallado ? (hallado.metas || {}) : null;
  }

  /** Metas de una columna: el hospital toma la de su destino; las demás unidades, la de su CLUES. */
  function metasDeColumna(metas, col) {
    if (col.destino) return metasDe(metas, { destino: col.destino }) || metasDe(metas, { clues: col.clues });
    return metasDe(metas, { clues: col.clues });
  }

  /** Columnas (unidades) por hoja para un municipio. Solo salen las unidades que tienen meta. */
  function columnasDelMunicipio(muni, unidades, metas, rubroIds) {
    const delMuni = (unidades || []).filter((u) => mayus(u.municipio) === muni && !HOSPITALES_CLUES.has(u.clues));
    const conMetas = (col) => { const m = metasDeColumna(metas, col); return !!m && rubroIds.some((id) => Number(m[id] || 0) > 0); };
    const tieneMetas = (u) => conMetas({ clues: u.clues });

    if (muni === "HOSPITALES") return { urbanas: HOSPITALES.filter(conMetas), rurales: [] };
    if (muni !== "QUERETARO") {
      const ordenadas = delMuni.filter(tieneMetas).sort((a, b) => String(a.clues).localeCompare(String(b.clues)));
      return { urbanas: ordenadas.map((u) => ({ label: mayus(u.unidad), nombre: mayus(u.unidad), clues: u.clues })), rurales: [] };
    }

    const conocidas = new Set([...URBANAS_QRO, ...RURALES_QRO].map((c) => c.clues));
    // Unidades del catálogo que la plantilla no trae (también con meta, como todas).
    const extras = delMuni.filter((u) => !conocidas.has(u.clues) && tieneMetas(u))
      .sort((a, b) => String(a.unidad).localeCompare(String(b.unidad)));
    const esMovil = (u) => /^(UMME|FAM|CARAVANA|UNIDAD M)/.test(mayus(u.unidad));
    const aCol = (u) => ({ label: mayus(u.unidad), nombre: mayus(u.unidad), clues: u.clues });
    return {
      urbanas: [...URBANAS_QRO.filter(conMetas), ...extras.filter((u) => !esMovil(u)).map(aCol)],
      rurales: [...RURALES_QRO.filter(conMetas), ...extras.filter(esMovil).map(aCol)]
    };
  }

  /** Copia una hoja (estilos, combinadas, columnas) para cuando las unidades no caben en 20 columnas. */
  function clonarHoja(wb, origen, nombre) {
    const copia = wb.addWorksheet(nombre);
    const modelo = Object.assign({}, origen.model, { name: nombre, id: copia.id });
    copia.model = modelo;
    copia.name = nombre;
    return copia;
  }

  function trocear(lista, n) {
    const out = [];
    for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
    return out.length ? out : [[]];
  }

  // Con pocas unidades se ocultan las columnas sobrantes y los datos del encabezado (Jurisdicción, Municipio,
  // Institución) quedarían escondidos: se reacomodan en las primeras columnas, que siempre se ven.
  const COLUMNAS_MIN_COMPACTO = 6;
  const UMBRAL_COMPACTO = 18;

  function acomodarEncabezado(ws, muniEtiqueta) {
    const estEtiqueta = ws.getCell("A5").style;
    const estValor = ws.getCell("D5").style;
    ["D5:J5", "D6:J6", "U5:W5", "X5:AA5", "L6:M6", "N6:R6", "T6:U6", "V6:Z6"].forEach((r) => {
      try { ws.unMergeCells(r); } catch (e) { /* ya estaba separada */ }
    });
    ["U5", "X5", "L6", "N6", "T6", "V6", "D5", "D6"].forEach((a) => { ws.getCell(a).value = null; });
    const poner = (rango, valor, estilo) => {
      const [a, b] = rango.split(":");
      if (b) ws.mergeCells(rango);
      const c = ws.getCell(a);
      c.value = valor;
      c.style = estilo;
    };
    poner("D5:F5", "QUERÉTARO", estValor);
    poner("G5:H5", "Jurisdicción Sanitaria:", estEtiqueta);
    poner("I5:J5", 1, estValor);
    poner("D6:F6", "DEPARTAMENTO DE VACUNAS", estValor);
    poner("G6:H6", "Municipio:", estEtiqueta);
    poner("I6:L6", muniEtiqueta, estValor);
    poner("A7", "Institución:", estEtiqueta);
    poner("D7:F7", "SECRETARÍA DE SALUD", estValor);
  }

  /** Escribe una hoja de unidades: encabezados, metas por rubro y fórmulas de total. */
  function llenarHojaUnidades(ws, columnas, ctx) {
    // Limpia lo que traía la plantilla (metas de otra temporada)
    for (let r = FILA_PRIMER_RUBRO; r <= FILA_ULTIMO_RUBRO; r++) {
      for (let c = COL_PRIMERA_UNIDAD; c <= COL_ULTIMA_UNIDAD; c++) ws.getCell(r, c).value = null;
    }
    const compacto = columnas.length < UMBRAL_COMPACTO;
    const visibles = compacto ? Math.max(columnas.length, COLUMNAS_MIN_COMPACTO) : columnas.length;
    for (let c = COL_PRIMERA_UNIDAD; c <= COL_ULTIMA_UNIDAD; c++) {
      const col = ws.getColumn(c);
      const i = c - COL_PRIMERA_UNIDAD;
      const unidad = columnas[i];
      col.hidden = i >= visibles;
      ws.getCell(10, c).value = unidad ? unidad.label : null;
      if (!unidad) continue;
      const m = metasDeColumna(ctx.metas, unidad) || {};
      ctx.rubroIds.forEach((id, k) => {
        const v = Number(m[id] || 0);
        ws.getCell(FILA_PRIMER_RUBRO + k, c).value = v > 0 ? v : null;
      });
    }
    // El total de la plantilla sumaba solo de la columna I en adelante y dejaba fuera a los hospitales (G, H).
    for (let r = FILA_PRIMER_RUBRO; r <= FILA_ULTIMO_RUBRO; r++) {
      ws.getCell(r, COL_TOTAL).value = { formula: `SUM(${letra(COL_PRIMERA_UNIDAD)}${r}:${letra(COL_ULTIMA_UNIDAD)}${r})` };
    }
    if (compacto) acomodarEncabezado(ws, ctx.muniEtiqueta);
    else ws.getCell("N6").value = ctx.muniEtiqueta;
    const titulo = ws.getCell("A4");
    if (typeof titulo.value === "string") titulo.value = titulo.value.replace(/2025-2026/g, ctx.campana).replace(/\s{2,}/g, " ");

    const nota = (fila, texto) => {
      const c = ws.getCell(fila, 1);
      c.value = texto;
      c.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
      c.alignment = { horizontal: "left", vertical: "middle", wrapText: false };
    };
    nota(63, `Jeringa 23x25 · clave 2707 (azul): renglones ${FILA_PRIMER_RUBRO}-${FILA_ULTIMO_23X25} · ${CLAVES_JERINGA_23X25.join(", ")}`);
    nota(64, `Jeringa 22x32 · clave 2715: renglones ${FILA_ULTIMO_23X25 + 1}-${FILA_ULTIMO_RUBRO} · ${CLAVES_JERINGA_22X32.join(", ")}`);
    nota(65, `Frasco = ${10} dosis · caja de jeringas = ${DOSIS_POR_CAJA} piezas.`);
  }

  /** Hoja «DISTRIBUCIÓN DE JERINGA»: una fila por unidad con fórmulas vivas hacia las hojas de metas. */
  function llenarHojaJeringa(ws, unidadesHoja) {
    const FILAS_PLANTILLA = ws.rowCount - 1;                                 // filas de datos que trae la plantilla
    const n = unidadesHoja.length;
    if (n < FILAS_PLANTILLA) ws.spliceRows(2 + n, FILAS_PLANTILLA - n);
    const estilos = [];
    for (let c = 1; c <= 12; c++) estilos[c] = ws.getRow(3).getCell(c).style;

    unidadesHoja.forEach((u, i) => {
      const r = 2 + i;
      const fila = ws.getRow(r);
      if (i >= FILAS_PLANTILLA) for (let c = 1; c <= 12; c++) fila.getCell(c).style = estilos[c];
      const ref = (desde, hasta) => `SUM(${comillas(u.hoja)}!${u.col}${desde}:${u.col}${hasta})`;
      fila.getCell(1).value = u.clues;
      fila.getCell(2).value = u.nombre;
      fila.getCell(3).value = { formula: `ROUNDDOWN(I${r},0)` };
      fila.getCell(4).value = { formula: `ROUNDDOWN(J${r},0)` };
      fila.getCell(5).value = { formula: `((G${r})-(C${r}*${DOSIS_POR_CAJA}))` };
      fila.getCell(6).value = { formula: `((H${r})-(D${r}*${DOSIS_POR_CAJA}))` };
      fila.getCell(7).value = { formula: ref(FILA_PRIMER_RUBRO, FILA_ULTIMO_23X25) };
      fila.getCell(8).value = { formula: ref(FILA_ULTIMO_23X25 + 1, FILA_ULTIMO_RUBRO) };
      fila.getCell(9).value = { formula: `G${r}/${DOSIS_POR_CAJA}` };
      fila.getCell(10).value = { formula: `H${r}/${DOSIS_POR_CAJA}` };
      fila.commit && fila.commit();
    });

    const rt = 2 + n;
    const total = ws.getRow(rt);
    for (let c = 1; c <= 12; c++) total.getCell(c).style = Object.assign({}, estilos[c], { font: Object.assign({}, (estilos[c] || {}).font, { bold: true }) });
    total.getCell(2).value = "TOTAL";
    "CDEFGH".split("").forEach((l) => { total.getCell(l).value = { formula: `SUM(${l}2:${l}${rt - 1})` }; });
    // Las columnas auxiliares (I, J) y los encabezados repetidos de K y L sobraban en la plantilla
    for (const l of ["K", "L"]) ws.getCell(`${l}1`).value = null;
    ws.getCell("I1").value = "AUXILIAR 23X25 (CAJAS)";
    ws.getCell("J1").value = "AUXILIAR 22X32 (CAJAS)";
    ws.getCell("G1").value = "META 23X25 (DOSIS)";
    ws.getCell("H1").value = "META 22X32 (DOSIS)";
  }

  /** Hoja «Comparación»: suma de unidades contra la meta del municipio (los hospitales van en su propio archivo). */
  function llenarComparacion(ws, hojasUnidades, ctx) {
    const destinos = ctx.muni === "HOSPITALES" ? ["NHG", "HENM"] : [ctx.muni];
    const registros = destinos.map((d) => metasDe(ctx.metas, { destino: d }) || {});
    ctx.rubroIds.forEach((id, k) => {
      const r = 5 + k;
      const refs = hojasUnidades.map((h) => `${comillas(h)}!AA${FILA_PRIMER_RUBRO + k}`).join(",");
      ws.getCell(r, 7).value = { formula: `SUM(${refs})` };
      ws.getCell(r, 8).value = registros.reduce((s, m) => s + Number(m[id] || 0), 0);
    });
    ws.getCell("A1").value = `COMPARACIÓN DE METAS · ${ctx.muniEtiqueta} · CAMPAÑA ${ctx.campana}`;
    ws.getCell("A1").font = { name: "Arial", size: 12, bold: true };
    ws.getCell("A2").value = ctx.muni === "HOSPITALES"
      ? "Meta de HENM y NHGQ (asignada por Jurisdicción) contra la suma de sus columnas."
      : "Meta del municipio contra la suma de sus unidades.";
    ws.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    ws.getCell("H4").value = `METAS ${ctx.campana}`;
  }

  // La plantilla trae nombres definidos («temp», filtro) que apuntan a la hoja «CLUES JS1», que no se exporta:
  // en Excel quedan como vínculos rotos hacia el archivo original. Se quitan los que apunten a hojas que ya no existen.
  function quitarVinculosHeredados(wb) {
    const existentes = new Set(wb.worksheets.map((w) => w.name));
    const hojaDe = (rango) => { const m = /^'((?:[^']|'')+)'!|^([^'!]+)!/.exec(String(rango)); return m ? (m[1] || m[2]).replace(/''/g, "'") : null; };
    const modelo = (wb.definedNames && wb.definedNames.model) || [];
    wb.definedNames.model = modelo.filter((n) => (n.ranges || []).every((r) => { const h = hojaDe(r); return !h || existentes.has(h); }));
  }

  /**
   * Arma el libro de un municipio a partir de la plantilla oficial.
   * ctx: { ExcelJS, plantilla (ArrayBuffer/Buffer), muni, campana, metas, unidades, rubroIds }
   */
  async function construirLibroMetas(ctx) {
    const muni = mayus(ctx.muni);
    if (!MUNICIPIOS[muni]) throw new Error(`Municipio desconocido: ${ctx.muni}`);
    const rubroIds = ctx.rubroIds || Array.from({ length: N_RUBROS }, (_, i) => `r${i + 1}`);
    if (rubroIds.length !== N_RUBROS) throw new Error(`Se esperaban ${N_RUBROS} rubros y llegaron ${rubroIds.length}`);
    const campana = ctx.campana || "2025-2026";
    const base = { muni, muniEtiqueta: MUNICIPIOS[muni].etiqueta, campana, metas: ctx.metas || [], rubroIds };

    const wb = new ctx.ExcelJS.Workbook();
    await wb.xlsx.load(ctx.plantilla);
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    const porIndice = wb.worksheets.slice();
    const hojaUrb = porIndice[0], hojaRur = porIndice[1], hojaComp = porIndice[2], hojaJer = porIndice[3];
    if (!hojaUrb || !hojaRur || !hojaComp || !hojaJer) throw new Error("La plantilla no tiene las hojas esperadas.");

    // Hojas que no se exportan: rutas y caravanas llevan captura manual de otra temporada y CLUES JS1 era solo consulta
    porIndice.slice(4).forEach((h) => wb.removeWorksheet(h.id));

    const cols = columnasDelMunicipio(muni, ctx.unidades, base.metas, rubroIds);
    // Archivo de UNA sola unidad (lo baja la propia unidad): solo su columna, sin la hoja «Comparación»
    // (que mide a todo el municipio) y sin las hojas de unidades que quedan vacías.
    const soloClues = ctx.soloClues ? String(ctx.soloClues) : "";
    if (soloClues) {
      cols.urbanas = cols.urbanas.filter((c) => c.clues === soloClues);
      cols.rurales = cols.rurales.filter((c) => c.clues === soloClues);
      if (!cols.urbanas.length && !cols.rurales.length) throw new Error("La unidad no tiene metas en esta campaña.");
    }
    const hojas = [];      // { ws, nombre, columnas }
    const nombreBase = muni === "QUERETARO" ? ["METAS UNIDADES URBANAS", "METAS UNIDADES RURALES"] : ["METAS UNIDADES"];

    const colocar = (hojaPlantilla, nombreOriginal, nombreFinal, lista) => {
      trocear(lista, MAX_UNIDADES_HOJA).forEach((grupo, i) => {
        const nombre = i === 0 ? nombreFinal : `${nombreFinal} (${i + 1})`;
        const ws = i === 0 ? hojaPlantilla : clonarHoja(wb, hojaPlantilla, nombre);
        if (i === 0 && nombre !== nombreOriginal) ws.name = nombre;
        hojas.push({ ws, nombre, columnas: grupo });
      });
    };
    if (soloClues && !cols.urbanas.length) wb.removeWorksheet(hojaUrb.id);
    else colocar(hojaUrb, hojaUrb.name, nombreBase[0], cols.urbanas);
    if (muni === "QUERETARO" && !(soloClues && !cols.rurales.length)) colocar(hojaRur, hojaRur.name, nombreBase[1], cols.rurales);
    else wb.removeWorksheet(hojaRur.id);

    const unidadesHoja = [];
    hojas.forEach(({ ws, nombre, columnas }) => {
      llenarHojaUnidades(ws, columnas, base);
      columnas.forEach((u, i) => unidadesHoja.push({ clues: u.clues, nombre: u.nombre, hoja: nombre, col: letra(COL_PRIMERA_UNIDAD + i) }));
    });
    if (soloClues) wb.removeWorksheet(hojaComp.id);
    else llenarComparacion(hojaComp, hojas.map((h) => h.nombre), base);
    llenarHojaJeringa(hojaJer, unidadesHoja);
    quitarVinculosHeredados(wb);
    return wb;
  }

  // ExcelJS pierde el recorte (srcRect) de los logotipos y los deja estirados: se vuelve a poner en el .xlsx.
  const RECORTE_LOGO = '<a:srcRect l="8244" t="17875" r="8869" b="17984"/>';
  async function escribirLibro(wb, JSZip) {
    const buffer = await wb.xlsx.writeBuffer();
    if (!JSZip) return buffer;
    const zip = await JSZip.loadAsync(buffer);
    const dibujos = Object.keys(zip.files).filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n));
    for (const n of dibujos) {
      const xml = await zip.file(n).async("string");
      const nuevo = xml.replace(/(<a:blip\b[^>]*\/>)(\s*<a:stretch>)/g, `$1${RECORTE_LOGO}$2`);
      if (nuevo !== xml) zip.file(n, nuevo);
    }
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  function nombreArchivo(muni, campana) {
    return `Metas Influenza ${MUNICIPIOS[mayus(muni)].archivo} ${campana || "2025-2026"}.xlsx`;
  }

  /** Nombre del archivo de una sola unidad: «Metas Influenza <unidad> <campaña>.xlsx». */
  function nombreArchivoUnidad(unidad, campana) {
    const limpio = String(unidad || "Unidad").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    return `Metas Influenza ${limpio} ${campana || "2025-2026"}.xlsx`;
  }

  const api = {
    construirLibroMetas, escribirLibro, nombreArchivo, nombreArchivoUnidad, columnasDelMunicipio, claveJeringa, MUNICIPIOS,
    CLAVES_JERINGA_23X25, CLAVES_JERINGA_22X32, URBANAS_QRO, RURALES_QRO, HOSPITALES, CLUES_HOSPITALES
  };
  root.InfluenzaMetasExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
