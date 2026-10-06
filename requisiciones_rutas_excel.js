// ============================================================================
// Requisiciones — "Distribución de rutas" (solo municipio de Querétaro)
//
// Libro de 5 hojas: GENERAL (todas las unidades del municipio × biológicos) y
// RUTA 1, RUTA 2, RUTA 3 y CARAVANAS, que jalan sus unidades de GENERAL con
// fórmulas (=IF(GENERAL!B7=0,"",GENERAL!B7)) igual que el formato original
// (Formatos/Distribución de rutas.xlsx). Las columnas de influenza son
// dinámicas: una por cada entrega del mes que traiga influenza.
//
// Las unidades salen de las requisiciones (requi_unidades, en orden de CLUES);
// a qué ruta pertenece cada una se fija aquí por CLUES, tal como estaban
// repartidas en el formato original.
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RequiRutasExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Columnas fijas, en el orden de la hoja GENERAL del formato original.
  // `codigo` = codigo_articulo del catálogo de requisiciones.
  const ANTES_INFLUENZA = [
    ['6508', 'NEU20'], ['148', 'NEU13'], ['150', 'ROTA'], ['6135', 'HEXA'], ['2526', 'HB M'], ['6187', 'HA U'],
    ['3800', 'SR'], ['3801', 'BCG'], ['3805', 'DPT'], ['3808', 'TDPA'], ['3810', 'TD'], ['6056', 'VAR'], ['3820', 'SRP']
  ];
  const CODIGO_INFLUENZA = '6317';
  const DESPUES_INFLUENZA = [['6501', 'VPH'], ['6502', 'COVID\nMOD'], ['6506', 'COVID\nPFI'], ['6509', 'VSR']];

  // Rutas por CLUES, en el orden en que se recorren (orden del formato original).
  const RUTAS = [
    { hoja: 'RUTA 1', clues: ['QTSSA001810', 'QTSSA001851', 'QTSSA002522', 'QTSSA002534', 'QTSSA002703', 'QTSSA012240', 'QTSSA012923', 'QTSSA012976'] },
    { hoja: 'RUTA 2', clues: ['QTSSA001904', 'QTSSA001916', 'QTSSA001921', 'QTSSA001945', 'QTSSA001962', 'QTSSA002003', 'QTSSA003715', 'QTSSA012655'] },
    { hoja: 'RUTA 3', clues: ['QTSSA001793', 'QTSSA001822', 'QTSSA001834', 'QTSSA001846', 'QTSSA001974', 'QTSSA002015', 'QTSSA013034', 'QTSSA012982'] },
    { hoja: 'CARAVANAS', clues: ['QTSSA001764', 'QTSSA003553', 'QTSSA003562', 'QTSSA003595', 'QTSSA003604', 'QTSSA012276', 'QTSSA012281', 'QTSSA012544', 'QTSSA012556', 'QTSSA012561', 'QTSSA012631'] }
  ];
  // Pedro Escobedo, Satélite y Lomas de Casa Blanca: bloque "prioritarios" de GENERAL.
  const PRIORITARIOS = ['QTSSA001863', 'QTSSA012923', 'QTSSA012982'];

  const cmpClues = (a, b) => String(a.clues || '~').localeCompare(String(b.clues || '~'), 'es', { numeric: true });

  // filas: [{ requisicion_id, unidad_id, requi_biologico_id, cantidad }] de las entregas elegidas.
  // entregas: [{ id, entrega, etiqueta }] (las elegidas). unidades: [{ id, clues, nombre }] de QUERETARO.
  function armarModelo({ unidades, catalogo, entregas, filas, unificar }) {
    const idPorCodigo = {};
    catalogo.forEach((b) => { idPorCodigo[String(b.codigo_articulo)] = b.id; });
    const codigoPorId = {};
    catalogo.forEach((b) => { codigoPorId[b.id] = String(b.codigo_articulo); });

    const lista = unidades.slice().sort(cmpClues);
    const orden = entregas.slice().sort((a, b) => a.entrega - b.entrega);

    // acumulado[unidadId][clave]
    const acumulado = {};
    const ignorados = {};   // biológicos con cantidad que el formato no tiene (se avisa)
    const claveBase = new Set([...ANTES_INFLUENZA, ...DESPUES_INFLUENZA].map((c) => c[0]));
    const influPorEntrega = {};   // requisicion_id -> total
    const idsElegidos = new Set(orden.map((e) => e.id));
    (filas || []).forEach((f) => {
      const cant = Number(f.cantidad) || 0;
      if (!cant || !idsElegidos.has(f.requisicion_id)) return;
      const codigo = codigoPorId[f.requi_biologico_id];
      if (!codigo) return;
      let clave;
      if (codigo === CODIGO_INFLUENZA) {
        clave = 'INFLU:' + f.requisicion_id;
        influPorEntrega[f.requisicion_id] = (influPorEntrega[f.requisicion_id] || 0) + cant;
      } else if (claveBase.has(codigo)) clave = codigo;
      else { ignorados[codigo] = (ignorados[codigo] || 0) + cant; return; }
      const u = (acumulado[f.unidad_id] = acumulado[f.unidad_id] || {});
      u[clave] = (u[clave] || 0) + cant;
    });

    // Influenza: una columna por entrega que traiga influenza (aunque se unifiquen, el reparto de
    // cada entrega se conserva por separado).
    const conInflu = orden.filter((e) => influPorEntrega[e.id] > 0);
    const columnas = [];
    ANTES_INFLUENZA.forEach(([codigo, titulo]) => columnas.push({ clave: codigo, titulo, grupo: 'base' }));
    conInflu.forEach((e, i) => columnas.push({
      clave: 'INFLU:' + e.id, titulo: conInflu.length > 1 ? `INFLU ${i + 1}` : 'INFLU', grupo: 'influenza',
      nota: `Entrega ${e.entrega}${e.etiqueta ? ' · ' + e.etiqueta : ''}`
    }));
    DESPUES_INFLUENZA.forEach(([codigo, titulo]) => columnas.push({ clave: codigo, titulo, grupo: /^COVID/.test(titulo) ? 'covid' : 'base' }));

    const unidadesModelo = lista.map((u) => ({ id: u.id, clues: u.clues, nombre: u.nombre, valores: acumulado[u.id] || {} }));
    const porClues = Object.fromEntries(unidadesModelo.map((u) => [u.clues, u]));
    const enRuta = new Set();
    const rutas = RUTAS.map((r) => {
      const us = r.clues.map((c) => porClues[c]).filter(Boolean);
      us.forEach((u) => enRuta.add(u.clues));
      return { hoja: r.hoja, unidades: us };
    });
    // Pedro Escobedo solo está en GENERAL por diseño del formato original; no cuenta como "sin ruta".
    const sinRuta = unidadesModelo.filter((u) => !enRuta.has(u.clues) && u.clues !== 'QTSSA001863');
    const prioritarios = PRIORITARIOS.map((c) => porClues[c]).filter(Boolean);
    return { columnas, unidades: unidadesModelo, rutas, prioritarios, sinRuta, ignorados, unificar: !!unificar, entregas: orden };
  }

  function letra(n) {   // 1 -> A
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  const COLOR = {
    titulo: 'FF0F3D3E', encabezado: 'FF1F6F6B', influenza: 'FFB45309', covid: 'FF6D28D9',
    zebra: 'FFF3F8F7', total: 'FFD9ECE9', prioritario: 'FFFEF3C7', texto: 'FF1F2937', borde: 'FFB8C7C5'
  };
  const colorGrupo = (g) => (g === 'influenza' ? COLOR.influenza : g === 'covid' ? COLOR.covid : COLOR.encabezado);
  const borde = { style: 'thin', color: { argb: COLOR.borde } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  function encabezadoHoja(ws, titulo, subtitulo, nCols, notas) {
    ws.mergeCells(1, 1, 1, nCols);
    const t = ws.getCell(1, 1);
    t.value = titulo;
    t.font = { name: 'Arial Nova', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titulo } };
    t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 28;
    ws.mergeCells(2, 1, 2, nCols);
    const s = ws.getCell(2, 1);
    s.value = subtitulo;
    s.font = { name: 'Arial Nova', size: 10.5, color: { argb: COLOR.texto } };
    s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 18;
    if (notas) {
      ws.mergeCells(3, 1, 3, nCols);
      const n = ws.getCell(3, 1);
      n.value = notas;
      n.font = { name: 'Arial Nova', size: 9.5, italic: true, color: { argb: 'FF92400E' } };
      n.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  }

  function filaEncabezadoColumnas(ws, fila, columnas, etiquetaUnidad) {
    const celdas = [etiquetaUnidad, ...columnas.map((c) => c.titulo)];
    celdas.forEach((txt, i) => {
      const c = ws.getCell(fila, i + 1);
      c.value = txt;
      c.font = { name: 'Arial Nova', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? COLOR.encabezado : colorGrupo(columnas[i - 1].grupo) } };
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true, indent: i === 0 ? 1 : 0 };
      c.border = bordes;
    });
    ws.getRow(fila).height = 30;
  }

  function configurarHoja(ws, nCols, filaEnc, orientacionHorizontal) {
    ws.getColumn(1).width = 28;
    for (let i = 2; i <= nCols; i++) ws.getColumn(i).width = 7.6;
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: filaEnc, showGridLines: false }];
    ws.pageSetup = {
      paperSize: 1, orientation: orientacionHorizontal ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 },
      printTitlesRow: `${filaEnc}:${filaEnc}`
    };
    ws.headerFooter = { oddFooter: '&L&8SIREVAQ · Jurisdicción Sanitaria N.1&R&8Página &P de &N' };
  }

  function estiloDato(c, { negrita, relleno, texto, izquierda } = {}) {
    c.font = { name: 'Arial Nova', size: 10.5, bold: !!negrita, color: { argb: COLOR.texto } };
    if (relleno) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
    c.border = bordes;
    c.alignment = { vertical: 'middle', horizontal: texto || izquierda ? 'left' : 'center', indent: texto || izquierda ? 1 : 0 };
    if (!texto) c.numFmt = '#,##0;-#,##0;';
  }

  // Devuelve { buffer, resumen }. `ExcelJS` es global (navegador) o se inyecta (pruebas).
  async function generar(modelo, { mesLabel, anio, ExcelJSLib } = {}) {
    const Lib = ExcelJSLib || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);
    if (!Lib) throw new Error('ExcelJS no está cargado');
    const wb = new Lib.Workbook();
    wb.creator = 'SIREVAQ';
    wb.created = new Date();
    const cols = modelo.columnas;
    const nCols = cols.length + 1;
    const etiquetaEntregas = modelo.entregas.map((e) => `Entrega ${e.entrega}${e.etiqueta ? ' (' + e.etiqueta + ')' : ''}`).join(' + ');
    const subtitulo = `${mesLabel || ''} ${anio || ''} · ${etiquetaEntregas}`.trim();
    const notasInflu = cols.filter((c) => c.nota && modelo.columnas.filter((x) => x.grupo === 'influenza').length > 1)
      .map((c) => `${c.titulo} = ${c.nota}`).join('   ·   ');

    // ---------------- GENERAL ----------------
    const g = wb.addWorksheet('GENERAL', { properties: { tabColor: { argb: COLOR.titulo } } });
    encabezadoHoja(g, 'DISTRIBUCIÓN DE BIOLÓGICOS · MUNICIPIO DE QUERÉTARO', subtitulo, nCols, notasInflu || null);
    const filaEnc = 4;
    filaEncabezadoColumnas(g, filaEnc, cols, 'UNIDAD');
    configurarHoja(g, nCols, filaEnc, false);

    const filaDe = {};   // clues -> fila en GENERAL
    const valorGeneral = {};   // clues -> {clave: n}
    let fila = filaEnc + 1;
    modelo.unidades.forEach((u, idx) => {
      filaDe[u.clues] = fila;
      valorGeneral[u.clues] = u.valores;
      const zebra = idx % 2 ? COLOR.zebra : null;
      const cn = g.getCell(fila, 1);
      cn.value = u.nombre;
      estiloDato(cn, { texto: true, relleno: zebra });
      cols.forEach((c, i) => {
        const cell = g.getCell(fila, i + 2);
        const v = u.valores[c.clave] || 0;
        if (v) cell.value = v;
        estiloDato(cell, { relleno: zebra });
      });
      g.getRow(fila).height = 17;
      fila++;
    });
    const primera = filaEnc + 1, ultima = fila - 1;

    const total = (rangoFn, valoresFn) => cols.map((c) => ({ formula: rangoFn(letra(cols.indexOf(c) + 2)), result: valoresFn(c) }));
    const filaTotal = fila;
    g.getCell(filaTotal, 1).value = 'TOTAL MUNICIPAL';
    estiloDato(g.getCell(filaTotal, 1), { texto: true, negrita: true, relleno: COLOR.total });
    total((L) => `SUM(${L}${primera}:${L}${ultima})`, (c) => modelo.unidades.reduce((a, u) => a + (u.valores[c.clave] || 0), 0))
      .forEach((f, i) => { const cell = g.getCell(filaTotal, i + 2); cell.value = f; estiloDato(cell, { negrita: true, relleno: COLOR.total }); });
    g.getRow(filaTotal).height = 19;
    fila += 2;

    // Prioritarios: Pedro Escobedo, Satélite, Lomas de Casa Blanca (referencias a las filas de arriba).
    if (modelo.prioritarios.length) {
      g.mergeCells(fila, 1, fila, nCols);
      const tp = g.getCell(fila, 1);
      tp.value = 'UNIDADES PRIORITARIAS';
      tp.font = { name: 'Arial Nova', size: 10, bold: true, color: { argb: 'FF92400E' } };
      tp.alignment = { horizontal: 'left', indent: 1 };
      fila++;
      const ini = fila;
      modelo.prioritarios.forEach((u) => {
        const c1 = g.getCell(fila, 1);
        c1.value = u.nombre;
        estiloDato(c1, { texto: true, relleno: COLOR.prioritario });
        cols.forEach((c, i) => {
          const cell = g.getCell(fila, i + 2);
          cell.value = { formula: `${letra(i + 2)}${filaDe[u.clues]}`, result: u.valores[c.clave] || 0 };
          estiloDato(cell, { relleno: COLOR.prioritario });
        });
        fila++;
      });
      const fin = fila - 1;
      const c1 = g.getCell(fila, 1);
      c1.value = 'TOTAL PRIORITARIOS';
      estiloDato(c1, { texto: true, negrita: true, relleno: COLOR.total });
      cols.forEach((c, i) => {
        const cell = g.getCell(fila, i + 2);
        cell.value = {
          formula: `SUM(${letra(i + 2)}${ini}:${letra(i + 2)}${fin})`,
          result: modelo.prioritarios.reduce((a, u) => a + (u.valores[c.clave] || 0), 0)
        };
        estiloDato(cell, { negrita: true, relleno: COLOR.total });
      });
    }

    g.pageSetup.printArea = `A1:${letra(nCols)}${fila}`;

    // ---------------- RUTAS ----------------
    modelo.rutas.forEach((r) => {
      const ws = wb.addWorksheet(r.hoja, { properties: { tabColor: { argb: COLOR.encabezado } } });
      encabezadoHoja(ws, `${r.hoja} · DISTRIBUCIÓN DE BIOLÓGICOS`, subtitulo, nCols, notasInflu || null);
      filaEncabezadoColumnas(ws, filaEnc, cols, 'UNIDAD');
      configurarHoja(ws, nCols, filaEnc, false);
      let f = filaEnc + 1;
      r.unidades.forEach((u, idx) => {
        const zebra = idx % 2 ? COLOR.zebra : null;
        const cn = ws.getCell(f, 1);
        cn.value = u.nombre;
        estiloDato(cn, { texto: true, relleno: zebra });
        cols.forEach((c, i) => {
          const cell = ws.getCell(f, i + 2);
          const ref = `GENERAL!${letra(i + 2)}${filaDe[u.clues]}`;
          cell.value = { formula: `IF(${ref}=0,"",${ref})`, result: (u.valores[c.clave] || '') };
          estiloDato(cell, { relleno: zebra });
        });
        ws.getRow(f).height = 18;
        f++;
      });
      const a = filaEnc + 1, b = f - 1;
      const ct = ws.getCell(f, 1);
      ct.value = 'TOTAL';
      estiloDato(ct, { texto: true, negrita: true, relleno: COLOR.total });
      cols.forEach((c, i) => {
        const cell = ws.getCell(f, i + 2);
        cell.value = {
          formula: b >= a ? `SUM(${letra(i + 2)}${a}:${letra(i + 2)}${b})` : '0',
          result: r.unidades.reduce((s, u) => s + (u.valores[c.clave] || 0), 0)
        };
        estiloDato(cell, { negrita: true, relleno: COLOR.total });
      });
      ws.getRow(f).height = 20;
      ws.pageSetup.printArea = `A1:${letra(nCols)}${f}`;
    });

    const buffer = await wb.xlsx.writeBuffer();
    return { buffer, resumen: { unidades: modelo.unidades.length, sinRuta: modelo.sinRuta.map((u) => u.nombre), ignorados: modelo.ignorados } };
  }

  return { armarModelo, generar, RUTAS, PRIORITARIOS, ANTES_INFLUENZA, DESPUES_INFLUENZA, CODIGO_INFLUENZA, letra };
});
