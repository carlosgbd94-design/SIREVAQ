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

    ws.pageSetup = Object.assign({}, ws.pageSetup, { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    return wb;
  }


  /**
   * Hoja de COVID-19 con el MISMO formato de la plantilla Municipal/Jurisdiccional: encabezado oficial, un grupo
   * LOGRO | META | % por entidad (con el mismo semáforo) y renglón de total. Los renglones son los 6 rubros de COVID-19
   * (los pediátricos son dosis de 0.25 mL, como en la meta); el total va en dosis equivalentes de 0.5 mL y debajo
   * se separa lo aplicado con Moderna y con Pfizer.
   * rubros: [{ id, grupo, edad }]; entidades: [{ nombre, metas:{c1..c6}, logros:{c1..c6}, marca:{MODERNA, PFIZER} }].
   */
  async function agregarHojaCovid({ ExcelJS, wb, plantilla, rubros, entidades, titulo, temporada, nombreTotal, nombreHoja }) {
    const tpl = new ExcelJS.Workbook();
    await tpl.xlsx.load(plantilla);
    const src = tpl.getWorksheet(HOJA_RESUMEN) || tpl.worksheets[0];
    const ws = wb.addWorksheet(nombreHoja || "META-LOGRO COVID-19", { views: [{ showGridLines: false, zoomScale: 90 }] });
    const n = rubros.length, F0 = 10, F1 = F0 + n - 1, FT = F1 + 1, FM = FT + 1, FP = FT + 2, C0 = 7;
    const peso = (id) => (id === "c1" || id === "c2" ? 0.5 : 1);

    const grupos = (entidades || []).map((e) => ({ nombre: e.nombre, metas: e.metas || {}, logros: e.logros || {}, marca: e.marca || {} }));
    if (grupos.length > 1) {
      const suma = (k) => Object.fromEntries(rubros.map((r) => [r.id, grupos.reduce((t, g) => t + num(g[k][r.id]), 0)]));
      grupos.push({ nombre: nombreTotal || "TOTAL", metas: suma("metas"), logros: suma("logros"),
        marca: { MODERNA: grupos.reduce((t, g) => t + num(g.marca.MODERNA), 0), PFIZER: grupos.reduce((t, g) => t + num(g.marca.PFIZER), 0) } });
    }
    if (!grupos.length) grupos.push({ nombre: "Sin datos", metas: {}, logros: {}, marca: {} });

    // Columnas y renglones de encabezado tal cual la plantilla
    for (let c = 1; c <= 6; c++) ws.getColumn(c).width = src.getColumn(c).width;
    for (let r = 1; r <= 9; r++) {
      if (src.getRow(r).height) ws.getRow(r).height = src.getRow(r).height;
      for (let c = 1; c <= 9; c++) { const o = src.getCell(r, c), d = ws.getCell(r, c); d.value = o.value; copiarEstilo(d, o); }
    }
    (src.model.merges || []).forEach((m) => {
      const fin = Number(String(m.split(":")[1]).replace(/[A-Z]/g, ""));
      const ini = m.split(":")[0].charAt(0);
      if (fin <= 9 && (ini <= "F" || fin <= 5)) { try { ws.mergeCells(m); } catch (e) { /* ya fusionada */ } }
    });
    copiarEstilo(ws.getCell("A4"), src.getCell("A5"));
    ws.mergeCells(4, 1, 4, 9);
    ws.getCell("A4").value = `Meta-Logro de Vacuna COVID-19 Temporada Invernal ${temporada || "2026-2027"}`;
    ws.getCell("A5").value = titulo;
    ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };

    // Renglones de datos (estilos de los renglones 10 y siguientes de la plantilla; el último, el del renglón 55)
    rubros.forEach((r, i) => {
      const fila = F0 + i, molde = i === n - 1 ? 55 : (i === 0 ? 10 : 11);
      ws.getRow(fila).height = src.getRow(10).height || 30;
      for (let c = 1; c <= 6; c++) copiarEstilo(ws.getCell(fila, c), src.getCell(molde, c));
      ws.getCell(fila, 3).value = r.grupo;
      ws.getCell(fila, 6).value = r.edad;
    });
    ws.getCell(F0, 1).value = "COVID-19 Aplicación de vacuna";
    ws.getCell(F0, 2).value = "Campaña de vacunación contra COVID-19";
    ws.mergeCells(F0, 1, FT, 1);
    ws.mergeCells(F0, 2, F1, 2);
    // El grupo de 6 a 59 meses ocupa sus dos renglones (primera y segunda dosis), como los grupos de la plantilla
    let a = 0;
    while (a < n) {
      let b = a;
      while (b + 1 < n && rubros[b + 1].grupo === rubros[a].grupo) b++;
      ws.mergeCells(F0 + a, 3, F0 + b, 5);
      a = b + 1;
    }
    // Total (renglón 56 de la plantilla) y los dos renglones por marca (el 57 de la plantilla)
    ws.getRow(FT).height = src.getRow(56).height;
    for (let c = 1; c <= 6; c++) copiarEstilo(ws.getCell(FT, c), src.getCell(56, c));
    ws.getCell(FT, 2).value = "Total de dosis aplicadas (equivalentes de 0.5 mL)";
    ws.mergeCells(FT, 2, FT, 6);
    [[FM, "Moderna (dosis equivalentes de 0.5 mL)"], [FP, "Pfizer (dosis de 0.5 mL)"]].forEach(([fila, txt]) => {
      ws.getRow(fila).height = src.getRow(57).height;
      for (let c = 1; c <= 6; c++) copiarEstilo(ws.getCell(fila, c), src.getCell(57, c));
      ws.getCell(fila, 6).value = txt;
    });

    const molde = [7, 8, 9];
    const anchos = molde.map((c) => src.getColumn(c).width);
    ws.conditionalFormattings = [];
    grupos.forEach((g, k) => {
      const c0 = C0 + k * 3;
      for (let j = 0; j < 3; j++) ws.getColumn(c0 + j).width = anchos[j] || 14;
      for (let fila = 8; fila <= FP; fila++) {
        const m = fila <= 9 ? fila : (fila < F1 ? (fila === F0 ? 10 : 11) : (fila === F1 ? 55 : (fila === FT ? 56 : 57)));
        for (let j = 0; j < 3; j++) copiarEstilo(ws.getCell(fila, c0 + j), src.getCell(m, molde[j]));
      }
      ws.mergeCells(8, c0, 8, c0 + 2);
      const L = letra(c0), M = letra(c0 + 1), P = letra(c0 + 2);
      ws.getCell(8, c0).value = g.nombre;
      ws.getCell(9, c0).value = "LOGRO";
      ws.getCell(9, c0 + 1).value = "META";
      ws.getCell(9, c0 + 2).value = "%";
      ws.getCell(9, c0 + 2).numFmt = "General";
      rubros.forEach((r, i) => {
        const fila = F0 + i, logro = num(g.logros[r.id]), meta = num(g.metas[r.id]);
        ws.getCell(fila, c0).value = logro;
        ws.getCell(fila, c0 + 1).value = meta;
        ws.getCell(fila, c0 + 2).value = { formula: `IFERROR(${L}${fila}/${M}${fila}," ")`, result: meta > 0 ? logro / meta : " " };
        ws.getCell(fila, c0 + 2).numFmt = "0%";
      });
      const eq = (k2) => rubros.reduce((t, r) => t + num(g[k2][r.id]) * peso(r.id), 0);
      const tl = eq("logros"), tm = eq("metas");
      const formulaEq = (col) => `((${col}${F0}+${col}${F0 + 1})/2)+SUM(${col}${F0 + 2}:${col}${F1})`;
      ws.getCell(FT, c0).value = { formula: formulaEq(L), result: tl };
      ws.getCell(FT, c0 + 1).value = { formula: formulaEq(M), result: tm };
      ws.getCell(FT, c0 + 2).value = { formula: `IFERROR(${L}${FT}/${M}${FT}," ")`, result: tm > 0 ? tl / tm : " " };
      ws.getCell(FT, c0).numFmt = "#,##0.##";
      ws.getCell(FT, c0 + 1).numFmt = "#,##0.##";
      ws.getCell(FT, c0 + 2).numFmt = "0%";
      // Por marca: solo lo aplicado (la meta es una sola; Moderna y Pfizer suman contra ella)
      ws.getCell(FM, c0).value = num(g.marca.MODERNA);
      ws.getCell(FP, c0).value = num(g.marca.PFIZER);
      ws.getCell(FM, c0).numFmt = "#,##0.##";
      ws.getCell(FP, c0).numFmt = "#,##0.##";
      ws.addConditionalFormatting(reglasSemaforo(P, F0, FT));
    });

    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
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

  const api = { construirLibroEntidades, agregarHojaCovid, construirLibroUnidad, mesYSemana, SEMAFORO, HOJA_RESUMEN, N_RUBROS };
  root.InfluenzaMetaLogroExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
