/**
 * Exportación Meta-Logro de Influenza a las plantillas oficiales 2026-2027:
 *
 * - «Formatos/Análisis_Meta_Logro_Influenza_2026-2027_UNIDAD_DE_SALUD_Individual.xlsx»
 *   Una unidad: hoja resumen (logro / meta / % con barra de avance) + una hoja por mes (OCTUBRE..ABRIL)
 *   con una columna por semana. El logro del resumen lo suman las hojas de mes con su propia fórmula.
 * - «Formatos/Análisis_Meta_Logro_Influenza_2026-2027_UNIDAD_DE_SALUD_Municipal_Jurisdiccional.xlsx»
 *   Un grupo de tres columnas (LOGRO | META | %) por unidad, municipio u hospital, con semáforo en el %.
 *
 * Los renglones de las plantillas (46) siguen el orden de INFLUENZA_RUBROS (r1..r46).
 * No necesita navegador: recibe ExcelJS y el buffer de la plantilla (se prueba en Node).
 */
(function (root) {
  "use strict";

  const N_RUBROS = 46;
  const HOJA_RESUMEN = "ANÁLIS DE META-LOGRO";
  const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

  // Semáforo del % de avance (los mismos cortes que trae la plantilla: 70 % verde, 40 % ámbar, abajo rojo).
  const SEMAFORO = {
    verde: { fill: "FFD9F2D0", font: "FF1E6B2E" },
    ambar: { fill: "FFFFF2B3", font: "FF9A6B00" },
    rojo: { fill: "FFFCD5D5", font: "FFC00000" },
    rebasa: { fill: "FFE4DAF7", font: "FF5B2A9E" }
  };

  // Un viernes es su número de viernes del mes; el corte de fin de mes entre semana va en la columna que sigue.
  // (Misma regla que mapDateToMonthAndWeek de influenza_module.js.)
  function mesYSemana(fechaStr) {
    const d = new Date(fechaStr + "T12:00:00");
    const year = d.getFullYear(), month = d.getMonth();
    const viernes = [];
    const t = new Date(year, month, 1, 12, 0, 0);
    while (t.getMonth() === month) { if (t.getDay() === 5) viernes.push(t.getDate()); t.setDate(t.getDate() + 1); }
    return { mes: MESES[month], semana: viernes.filter((f) => f < d.getDate()).length + 1 };
  }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const copiarEstilo = (dst, src) => { dst.style = JSON.parse(JSON.stringify(src.style || {})); };
  const letra = (c) => { let s = ""; for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

  // Encabezado: el renglón 4 lleva el título fijo y el 5 el sujeto (unidad / ámbito y corte). Todo junto en el 5
  // no cabía en el ancho combinado de la plantilla y se cortaba por los dos lados.
  function escribirEncabezado(ws, temporada, sujeto) {
    ws.unMergeCells && (() => { try { ws.unMergeCells(4, 1, 4, 9); } catch (e) { /* no estaba fusionado */ } })();
    copiarEstilo(ws.getCell("A4"), ws.getCell("A5"));
    ws.mergeCells(4, 1, 4, 9);
    ws.getCell("A4").value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal ${temporada}`;
    ws.getCell("A5").value = sujeto;
    ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
  }

  // ExcelJS no guarda el tema de colores del libro: el texto con color de tema 0 (blanco en la plantilla) sale negro sobre los
  // rellenos oscuros. Se fija el blanco explícito en todas las celdas que lo traían como color de tema.
  function fijarBlancos(ws) {
    ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: true }, (c) => {
      const col = c.font && c.font.color;
      if (col && col.theme === 0 && !col.argb) c.font = Object.assign({}, c.font, { color: { argb: "FFFFFFFF" } });
    }));
  }

  function reglasSemaforo(col, f0, f1) {
    const x = `${col}${f0}`;
    const regla = (formula, c, prioridad) => ({
      type: "expression", priority: prioridad, formulae: [formula],
      style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: c.fill } }, font: { bold: true, color: { argb: c.font } } }
    });
    return {
      ref: `${col}${f0}:${col}${f1}`,
      rules: [
        regla(`AND(ISNUMBER(${x}),${x}>1)`, SEMAFORO.rebasa, 1),
        regla(`AND(ISNUMBER(${x}),${x}>=0.7,${x}<=1)`, SEMAFORO.verde, 2),
        regla(`AND(ISNUMBER(${x}),${x}>=0.4,${x}<0.7)`, SEMAFORO.ambar, 3),
        regla(`AND(ISNUMBER(${x}),${x}<0.4)`, SEMAFORO.rojo, 4)
      ]
    };
  }

  /**
   * Libro Municipal/Jurisdiccional. entidades: [{ nombre, metas:{r1..}, logros:{r1..} }] (una por unidad,
   * municipio u hospital). Con más de una se agrega al final un grupo «TOTAL».
   */
  async function construirLibroEntidades({ ExcelJS, plantilla, rubroIds, entidades, titulo, temporada, nombreTotal }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantilla);
    const ws = wb.getWorksheet(HOJA_RESUMEN) || wb.worksheets[0];
    const ids = rubroIds;
    const F0 = 10, F1 = F0 + ids.length - 1;         // 10..55
    const FT = F1 + 1, FF = FT + 1;                  // totales y frascos
    const C0 = 7;                                    // G

    const grupos = (entidades || []).map((e) => ({ nombre: e.nombre, metas: e.metas || {}, logros: e.logros || {} }));
    if (grupos.length > 1) {
      const suma = (k) => Object.fromEntries(ids.map((id) => [id, grupos.reduce((s, g) => s + num(g[k][id]), 0)]));
      grupos.push({ nombre: nombreTotal || "TOTAL", metas: suma("metas"), logros: suma("logros") });
    }
    if (!grupos.length) grupos.push({ nombre: "Sin datos", metas: {}, logros: {} });

    // La plantilla trae dos grupos (G:I y J:L). Los demás se hacen copiando el estilo del primero.
    const molde = [7, 8, 9];
    const anchos = molde.map((c) => ws.getColumn(c).width);
    ws.conditionalFormattings = [];
    escribirEncabezado(ws, temporada || "2026-2027", titulo);

    grupos.forEach((g, k) => {
      const c0 = C0 + k * 3;
      if (k >= 2) {
        for (let r = 8; r <= FF; r++) for (let j = 0; j < 3; j++) copiarEstilo(ws.getCell(r, c0 + j), ws.getCell(r, molde[j]));
        ws.mergeCells(8, c0, 8, c0 + 2);
      }
      for (let j = 0; j < 3; j++) ws.getColumn(c0 + j).width = anchos[j] || 14;
      const L = letra(c0), M = letra(c0 + 1), P = letra(c0 + 2);
      ws.getCell(8, c0).value = g.nombre;
      ws.getCell(9, c0).value = "LOGRO";
      ws.getCell(9, c0 + 1).value = "META";
      ws.getCell(9, c0 + 2).value = "%";
      ws.getCell(9, c0 + 2).numFmt = "General";
      ids.forEach((id, i) => {
        const fila = F0 + i;
        const logro = num(g.logros[id]), meta = num(g.metas[id]);
        ws.getCell(fila, c0).value = logro;
        ws.getCell(fila, c0 + 1).value = meta;
        ws.getCell(fila, c0 + 2).value = { formula: `IFERROR(${L}${fila}/${M}${fila}," ")`, result: meta > 0 ? logro / meta : " " };
        ws.getCell(fila, c0 + 2).numFmt = "0%";
      });
      const tl = ids.reduce((s, id) => s + num(g.logros[id]), 0), tm = ids.reduce((s, id) => s + num(g.metas[id]), 0);
      ws.getCell(FT, c0).value = { formula: `SUM(${L}${F0}:${L}${F1})`, result: tl };
      ws.getCell(FT, c0 + 1).value = { formula: `SUM(${M}${F0}:${M}${F1})`, result: tm };
      ws.getCell(FT, c0 + 2).value = { formula: `IFERROR(${L}${FT}/${M}${FT}," ")`, result: tm > 0 ? tl / tm : " " };
      ws.getCell(FT, c0 + 2).numFmt = "0%";
      // Frascos (10 dosis). El % es logro / meta (la plantilla lo traía al revés: meta / logro).
      ws.getCell(FF, c0).value = { formula: `IFERROR(${L}${FT}/10," ")`, result: tl / 10 };
      ws.getCell(FF, c0 + 1).value = { formula: `IFERROR(${M}${FT}/10," ")`, result: tm / 10 };
      ws.getCell(FF, c0 + 2).value = { formula: `IFERROR(${L}${FF}/${M}${FF}," ")`, result: tm > 0 ? tl / tm : " " };
      ws.getCell(FF, c0 + 2).numFmt = "0%";
      ws.addConditionalFormatting(reglasSemaforo(P, F0, FT));
    });

    // Con una sola entidad la plantilla dejaría su segundo grupo (J:L) con «Nombre de unidad 2» y fórmulas vacías.
    if (grupos.length < 2) {
      try { ws.unMergeCells(8, C0 + 3, 8, C0 + 5); } catch (e) { /* ya estaba desfusionado */ }
      for (let r = 8; r <= FF; r++) for (let j = 0; j < 3; j++) { const c = ws.getCell(r, C0 + 3 + j); c.value = null; c.style = {}; }
    }

    fijarBlancos(ws);
    ws.pageSetup = Object.assign({}, ws.pageSetup, { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    return wb;
  }


  /**
   * Hojas de COVID-19 sobre la plantilla oficial «Formatos/PLANTILLA COVID 2026-2027.xlsx»: «META-LOGRO COVID-19»
   * (un grupo LOGRO | META | % por entidad, total en dosis equivalentes de 0.5 mL y lo aplicado con Moderna y Pfizer)
   * y «DOSIS POR MARCA» (un bloque por entidad: Moderna 1.ª/2.ª dosis y Pfizer por grupo de población).
   * Solo van los rubros que SIREVAQ maneja (c1..c6); la plantilla ya no trae Otros, comorbilidades por edad ni la marca Otra.
   * rubros: [{ id, grupo, edad }]; entidades: [{ nombre, metas:{c1..c6}, logros:{c1..c6}, marca:{MODERNA, PFIZER}, marcaR:{MODERNA:{c1..c6}, PFIZER:{c1..c6}} }].
   * marcaR son las dosis aplicadas de cada marca por rubro (tal como se aplican, sin pesar): de ahí sale «DOSIS POR MARCA».
   */
  async function agregarHojaCovid({ ExcelJS, wb, plantilla, rubros, entidades, titulo, temporada, nombreTotal, nombreHoja, totalExplicito }) {
    const tpl = new ExcelJS.Workbook();
    await tpl.xlsx.load(plantilla);
    const src = tpl.getWorksheet("META-LOGRO COVID-19") || tpl.worksheets[0];
    const srcM = tpl.getWorksheet("DOSIS POR MARCA") || tpl.worksheets[1];
    if (!src || !srcM) throw new Error("La plantilla de COVID-19 no trae las hojas «META-LOGRO COVID-19» y «DOSIS POR MARCA».");
    const ids = (rubros || []).map((r) => r.id);
    // Renglón de cada rubro en las hojas de la plantilla (orden fijo de la plantilla)
    const FILA = { c1: 9, c2: 10, c3: 11, c4: 12, c5: 13, c6: 14 };
    const peso = (id) => (id === "c1" || id === "c2" ? 0.5 : 1);
    const MARCAS = ["MODERNA", "PFIZER"];

    const grupos = (entidades || []).map((e) => ({ nombre: e.nombre, metas: e.metas || {}, logros: e.logros || {}, marca: e.marca || {}, marcaR: e.marcaR || {} }));
    if (totalExplicito) {
      // Total que no es la suma de las columnas (p. ej. por semana: la meta es una sola y no se suma semana tras semana)
      grupos.push({ nombre: totalExplicito.nombre || nombreTotal || "TOTAL", metas: totalExplicito.metas || {}, logros: totalExplicito.logros || {}, marca: totalExplicito.marca || {}, marcaR: totalExplicito.marcaR || {} });
    } else if (grupos.length > 1) {
      const suma = (k) => Object.fromEntries(ids.map((id) => [id, grupos.reduce((t, g) => t + num(g[k][id]), 0)]));
      grupos.push({ nombre: nombreTotal || "TOTAL", metas: suma("metas"), logros: suma("logros"),
        marca: { MODERNA: grupos.reduce((t, g) => t + num(g.marca.MODERNA), 0), PFIZER: grupos.reduce((t, g) => t + num(g.marca.PFIZER), 0) },
        marcaR: Object.fromEntries(MARCAS.map((mk) => [mk, Object.fromEntries(ids.map((id) => [id, grupos.reduce((t, g) => t + num(((g.marcaR || {})[mk] || {})[id]), 0)]))])) });
    }
    if (!grupos.length) grupos.push({ nombre: "Sin datos", metas: {}, logros: {}, marca: {}, marcaR: {} });

    const colNum = (t) => t.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    // Copia estilos y valores de un rango de la plantilla a otro lugar de la hoja nueva (y sus celdas combinadas)
    const copiar = (s, d, f0, f1, c0, c1, df, dc) => {
      for (let r = f0; r <= f1; r++) {
        if (s.getRow(r).height) d.getRow(r + df).height = s.getRow(r).height;
        for (let c = c0; c <= c1; c++) {
          const o = s.getCell(r, c), x = d.getCell(r + df, c + dc);
          copiarEstilo(x, o);
          if (o.value !== null && o.value !== undefined && !(o.value && o.value.formula)) x.value = o.value;
        }
      }
      (s.model.merges || []).forEach((m) => {
        const [a1, b1] = m.split(":");
        const pa = a1.match(/^([A-Z]+)(\d+)$/), pb = b1.match(/^([A-Z]+)(\d+)$/);
        const ra = +pa[2], rb = +pb[2], ca = colNum(pa[1]), cb = colNum(pb[1]);
        if (ra >= f0 && rb <= f1 && ca >= c0 && cb <= c1) { try { d.mergeCells(ra + df, ca + dc, rb + df, cb + dc); } catch (e) { /* ya fusionada */ } }
      });
    };
    // Renglones 1 a 4 (texto oficial) combinados a todo lo ancho; el 5 lleva el sujeto (ámbito y corte)
    const encabezado = (s, d, ultima) => {
      for (let r = 1; r <= 6; r++) { if (s.getRow(r).height) d.getRow(r).height = s.getRow(r).height; }
      for (let r = 1; r <= 4; r++) {
        copiarEstilo(d.getCell(r, 1), s.getCell(r, 1));
        d.getCell(r, 1).value = s.getCell(r, 1).value;
        d.mergeCells(r, 1, r, ultima);
      }
      d.getCell("A4").value = `Meta-Logro de Vacuna COVID-19 Temporada Invernal ${temporada || "2026-2027"}`;
      copiarEstilo(d.getCell("A5"), s.getCell("A4"));
      d.mergeCells(5, 1, 5, ultima);
      d.getCell("A5").value = titulo;
      d.getCell("A5").font = Object.assign({}, d.getCell("A5").font, { size: 12, bold: false });
      d.getCell("A5").alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
    };

    // ── Hoja META-LOGRO ──
    const ws = wb.addWorksheet(nombreHoja || "META-LOGRO COVID-19", { views: [{ showGridLines: false, zoomScale: 90 }] });
    for (let c = 1; c <= 6; c++) ws.getColumn(c).width = src.getColumn(c).width;
    copiar(src, ws, 7, 17, 1, 6, 0, 0);
    encabezado(src, ws, 6 + grupos.length * 3);
    ws.conditionalFormattings = [];
    grupos.forEach((g, k) => {
      const c0 = 7 + k * 3;
      for (let j = 0; j < 3; j++) ws.getColumn(c0 + j).width = src.getColumn(7 + j).width || 14;
      copiar(src, ws, 7, 17, 7, 9, 0, c0 - 7);
      const L = letra(c0), M = letra(c0 + 1), P = letra(c0 + 2);
      ws.getCell(7, c0).value = g.nombre;
      ws.getCell(8, c0).value = "LOGRO"; ws.getCell(8, c0 + 1).value = "META"; ws.getCell(8, c0 + 2).value = "%";
      ids.forEach((id) => {
        const fila = FILA[id]; if (!fila) return;
        const logro = num(g.logros[id]), meta = num(g.metas[id]);
        ws.getCell(fila, c0).value = logro;
        ws.getCell(fila, c0 + 1).value = meta;
        ws.getCell(fila, c0 + 2).value = { formula: `IFERROR(${L}${fila}/${M}${fila}," ")`, result: meta > 0 ? logro / meta : " " };
        ws.getCell(fila, c0 + 2).numFmt = "0%";
      });
      const eq = (k2) => ids.reduce((t, id) => t + num(g[k2][id]) * peso(id), 0);
      const tl = eq("logros"), tm = eq("metas");
      const formulaEq = (col) => `((${col}9+${col}10)/2)+SUM(${col}11:${col}14)`;
      ws.getCell(15, c0).value = { formula: formulaEq(L), result: tl };
      ws.getCell(15, c0 + 1).value = { formula: formulaEq(M), result: tm };
      ws.getCell(15, c0 + 2).value = { formula: `IFERROR(${L}15/${M}15," ")`, result: tm > 0 ? tl / tm : " " };
      ws.getCell(15, c0 + 2).numFmt = "0%";
      // Por marca: solo lo aplicado (la meta es una sola; Moderna y Pfizer suman contra ella)
      ws.getCell(16, c0).value = num(g.marca.MODERNA);
      ws.getCell(17, c0).value = num(g.marca.PFIZER);
      // Sin punto decimal sobrante («1,377.»): con decimales solo cuando el valor trae media dosis
      const fmtDosis = (v) => (Number.isInteger(Math.round(v * 100) / 100) ? "#,##0" : "#,##0.0");
      ws.getCell(15, c0).numFmt = fmtDosis(tl); ws.getCell(15, c0 + 1).numFmt = fmtDosis(tm);
      ws.getCell(16, c0).numFmt = fmtDosis(num(g.marca.MODERNA)); ws.getCell(17, c0).numFmt = fmtDosis(num(g.marca.PFIZER));
      ws.addConditionalFormatting(reglasSemaforo(P, 9, 15));
    });
    fijarBlancos(ws);
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };

    // ── Hoja DOSIS POR MARCA: un bloque (renglones 7 a 15 de la plantilla) por entidad, hacia abajo ──
    const wm = wb.addWorksheet("DOSIS POR MARCA", { views: [{ showGridLines: false }] });
    for (let c = 1; c <= 7; c++) wm.getColumn(c).width = srcM.getColumn(c).width || 15;
    encabezado(srcM, wm, 7);
    const PASO = 11;
    grupos.forEach((g, k) => {
      const o = k * PASO;
      copiar(srcM, wm, 7, 15, 1, 7, o, 0);
      const D = (mk, id) => num(((g.marcaR || {})[mk] || {})[id]);
      wm.getCell(7 + o, 3).value = g.nombre;
      // Niños de 6 a 59 meses: solo Moderna (1.ª y 2.ª dosis); en la plantilla el encabezado de Pfizer cubre ese renglón
      wm.getCell(10 + o, 5).value = D("MODERNA", "c1");
      wm.getCell(10 + o, 6).value = D("MODERNA", "c2");
      // Grupos de una sola dosis por marca (la columna de Moderna ocupa las dos dosis)
      [["c3", 11], ["c4", 12], ["c5", 13], ["c6", 14]].forEach(([id, fila]) => {
        wm.getCell(fila + o, 5).value = D("MODERNA", id);
        wm.getCell(fila + o, 7).value = D("PFIZER", id);
      });
      const tM = ids.reduce((t, id) => t + D("MODERNA", id), 0), tP = ids.reduce((t, id) => t + (id === "c1" || id === "c2" ? 0 : D("PFIZER", id)), 0);
      wm.getCell(15 + o, 5).value = { formula: `SUM(E${10 + o}:F${14 + o})`, result: tM };
      wm.getCell(15 + o, 7).value = { formula: `SUM(G${11 + o}:G${14 + o})`, result: tP };
      for (let f = 10; f <= 15; f++) for (let c = 5; c <= 7; c++) wm.getCell(f + o, c).numFmt = "#,##0";
    });
    const fNota = grupos.length * PASO + 7;
    wm.mergeCells(fNota, 1, fNota, 7);
    wm.getCell(fNota, 1).value = "Dosis tal como se aplicaron (las pediátricas de 0.25 mL cuentan una dosis). SIREVAQ captura las comorbilidades de 5 a 59 años en un solo grupo.";
    wm.getCell(fNota, 1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };
    wm.getCell(fNota, 1).alignment = { wrapText: true, vertical: "top" };
    wm.getRow(fNota).height = 28;
    fijarBlancos(wm);
    wm.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };

    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    return wb;
  }

  /** Libro nuevo solo con la hoja de COVID-19 (Concentrado de Avances de COVID-19: simple, con unidades y por semana). */
  async function construirLibroCovid(op) {
    const wb = new op.ExcelJS.Workbook();
    await agregarHojaCovid(Object.assign({}, op, { wb }));
    return wb;
  }

  /**
   * Libro Individual (una unidad). metas: {r1..}; capturas: [{ fecha:'YYYY-MM-DD', valores:{r1..} }]
   * (ya filtradas a la unidad y a la fecha de corte). Devuelve { wb, omitidas } con las capturas cuyo mes
   * no tiene hoja en la plantilla.
   */
  async function construirLibroUnidad({ ExcelJS, plantilla, rubroIds, metas, capturas, titulo, temporada }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantilla);
    const resumen = wb.getWorksheet(HOJA_RESUMEN) || wb.worksheets[0];
    const ids = rubroIds;

    // semana por mes: mes -> semana(1..5) -> rubro -> dosis
    const porMes = {};
    const omitidas = [];
    (capturas || []).forEach((c) => {
      const { mes, semana } = mesYSemana(c.fecha);
      const hoja = wb.getWorksheet(mes);
      if (!hoja) { omitidas.push(c.fecha); return; }
      const col = Math.min(5, semana);
      const m = (porMes[mes] = porMes[mes] || {});
      const s = (m[col] = m[col] || {});
      ids.forEach((id) => { s[id] = (s[id] || 0) + num((c.valores || {})[id]); });
    });

    Object.keys(porMes).forEach((mes) => {
      const hoja = wb.getWorksheet(mes);
      Object.keys(porMes[mes]).forEach((col) => {
        ids.forEach((id, i) => {
          const v = porMes[mes][col][id] || 0;
          if (v) hoja.getCell(8 + i, 6 + Number(col)).value = v;
        });
      });
    });

    escribirEncabezado(resumen, temporada || "2026-2027", titulo);
    // La columna L de la plantilla solo avisaba «Meta rebasada» (casi siempre vacía y con relleno): se quita.
    for (let r = 8; r <= 9 + ids.length; r++) { const c = resumen.getCell(r, 12); c.value = null; c.style = {}; }
    resumen.getColumn(12).width = 2;
    wb.worksheets.forEach(fijarBlancos);
    // La barra de avance no debe mostrar el número (la plantilla lo ocultaba con showValue=0, ExcelJS lo pierde al guardar)
    for (let r = 9; r <= 9 + ids.length; r++) resumen.getCell(r, 11).numFmt = ";;;";
    // En cada mes, el renglón 4 trae la unidad (vínculo al resumen) y el 5 el mes de esa hoja
    wb.worksheets.forEach((h) => {
      if (h === resumen) return;
      try { h.unMergeCells(5, 3, 5, 12); } catch (e) { /* no estaba fusionado */ }
      copiarEstilo(h.getCell("C5"), h.getCell("C4"));
      h.mergeCells(5, 3, 5, 12);
      h.getCell("C5").value = `Temporada Invernal ${temporada || "2026-2027"} · ${h.name}`;
    });
    ids.forEach((id, i) => {
      const fila = 9 + i;
      resumen.getCell(fila, 8).value = num((metas || {})[id]);
      // El logro lo suman las hojas de mes (fórmula 3D de la plantilla); se deja también el valor calculado
      const celda = resumen.getCell(fila, 7);
      let total = 0;
      Object.keys(porMes).forEach((mes) => Object.keys(porMes[mes]).forEach((col) => { total += porMes[mes][col][id] || 0; }));
      const f = celda.value && celda.value.formula;
      if (f) celda.value = { formula: f, result: total };
    });

    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    return { wb, omitidas };
  }

  const api = { construirLibroEntidades, agregarHojaCovid, construirLibroCovid, construirLibroUnidad, mesYSemana, SEMAFORO, HOJA_RESUMEN, N_RUBROS };
  root.InfluenzaMetaLogroExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
