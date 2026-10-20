// ============================================================================
// Requisiciones — Kardex 2026 (tarjetas de control de biológicos)
//
// Genera, a partir de lo ya capturado en Requisiciones, los dos libros que hoy se
// llenan a mano ("Formatos/KARDEX 2026"):
//   * POR UNIDAD     -> "CONTROL DE BIOLOGICO 2026 (TARJETAS).xlsx": una salida por unidad.
//   * POR MUNICIPIO  -> "CONTROL DE BIOLOGICO 2026 POR MUNICIPIO (TARJETAS).xlsx": una salida por municipio.
//
// Estructura (idéntica en ambos): una hoja por biológico; en cada hoja, una TARJETA por
// mes con encabezado (logos, biológico, clave, responsable, mes) y, debajo, un BLOQUE por
// entrega del mes: SALDO ANTERIOR, una entrada "CAMARA FRIA" por lote (fecha de recepción,
// lote, caducidad, frascos, dosis, folio) y las salidas con el saldo corrido.
// Las cantidades de Requisiciones ya están en frascos; las dosis = frascos × dosis por frasco.
//
// armarModelo() es puro (se prueba en Node); generar() arma el .xlsx con ExcelJS.
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RequiKardexExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // Orden en que salen los destinos dentro de cada bloque (igual que en los kardex hechos a mano;
  // los hospitales cierran la lista y, como ahí, van bajo QUERETARO).
  const ORDEN_DESTINOS = ['CORREGIDORA', 'HUIMILPAN', 'MARQUES', 'QUERETARO', 'NHG', 'HENM'];
  const HOSPITALES = { NHG: 'NHGQ', HENM: 'HENM' };
  const DESTINO_IMPRESO = { CORREGIDORA: 'CORREGIDORA', HUIMILPAN: 'HUIMILPAN', MARQUES: 'MARQUES', QUERETARO: 'QUERETARO', NHG: 'QUERETARO', HENM: 'QUERETARO' };

  // Dosis por frasco de los multidosis (todo lo demás es unidosis = 1). Moderna/Pfizer: ver covid_frascos.js.
  const DOSIS_POR_FRASCO = { '2526': 10, '3800': 10, '3801': 10, '3805': 10, '3810': 10, '3821': 10, '6317': 10, '6502': 5, '6506': 6 };

  // Nombre de la hoja y del biológico en la tarjeta (los que ya usan los kardex de la jurisdicción).
  const NOMBRES = {
    '6508': 'NEUMO 20', '148': 'NEUMO 13', '150': 'ROTAVIRUS MONOVALENTE', '6135': 'HEXAVALENTE', '2526': 'HEPATITIS B',
    '6187': 'HEPATITIS A', '3800': 'SR', '3801': 'BCG', '3805': 'DPT', '3808': 'TDPA', '3810': 'TD', '6056': 'ANTIVARICELA',
    '3820': 'SRP', '3821': 'SRP MULTIDOSIS', '6317': 'INFLUENZA', '3832': 'GAMAGLOBULINA', '6501': 'VPH', '2': 'ANTIAMARILICA',
    '6502': 'COVID-19 MODERNA', '6506': 'COVID-19 PFIZER', '6509': 'VRS', '146': 'NEUMO 23', '3802': 'SABIN'
  };

  function nombreBio(bio) {
    const n = NOMBRES[String(bio.codigo_articulo)];
    return n || String(bio.nombre || '').replace(/^VACUNA\s+/i, '').trim() || String(bio.codigo_articulo);
  }
  function dosisPorFrasco(bio) { return DOSIS_POR_FRASCO[String(bio.codigo_articulo)] || 1; }

  function fechaValida(f) {
    const a = Number(String(f || '').slice(0, 4));
    return a >= 2000 && a <= 2100;
  }
  // Fecha en que se recibió la entrega (la misma que sale en el Excel de la requisición).
  function fechaRecepcion(req) { return [req.fecha_envio, req.pedido_fecha].find(fechaValida) || ''; }

  const num = (v) => Number(v) || 0;
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es');

  // ---------------------------------------------------------------------------
  // Modelo: { anio, hojas: [{ bio, hoja, titulo, clave, dpf, tarjetas: [{ mes, saldoAnterior, bloques }] }], avisos }
  //   bloque = { req, fecha, folio, entradas: [{ lote, caducidad, frascos }], salidas: [...] }
  //   salida = { destino, destinoImpreso, unidad (obs), frascos, hospital, detalle }
  // ---------------------------------------------------------------------------
  function armarModelo({ anio, catalogo, requisiciones, items, distMunicipio, distUnidad, unidades, lotes }) {
    const avisos = new Set();
    const sinRepartir = new Map(); // mes -> Set(biológicos con destinos sin repartir entre sus unidades)
    const bioPorId = {};
    catalogo.forEach((b) => { bioPorId[b.id] = b; });
    const unidadPorId = {};
    (unidades || []).forEach((u) => { unidadPorId[u.id] = u; });
    const loteTxt = (it) => (it.requi_lotes && it.requi_lotes.numero_lote) || (lotes && lotes[it.lote_id] && lotes[it.lote_id].numero_lote) || '';

    const reqs = requisiciones.filter((r) => r.anio === anio).sort((a, b) => a.mes - b.mes || (a.entrega || 1) - (b.entrega || 1));
    const hojas = new Map(); // bio.id -> { bio, porMes: Map(mes -> bloques[]) }

    reqs.forEach((req) => {
      const delReq = items.filter((i) => i.requisicion_id === req.id && num(i.cantidad_surtida) > 0);
      if (!delReq.length) return;
      const fecha = fechaRecepcion(req);
      if (!fecha) avisos.add(`La entrega ${req.entrega || 1} de ${MESES[req.mes - 1]} no tiene fecha de recepción: sus fechas quedaron en blanco.`);
      const biosDelReq = [...new Set(delReq.map((i) => i.requi_biologico_id))];
      biosDelReq.forEach((bioId) => {
        const bio = bioPorId[bioId];
        if (!bio) return;
        const entradas = delReq.filter((i) => i.requi_biologico_id === bioId)
          .map((i) => ({ loteId: i.lote_id, lote: loteTxt(i), caducidad: (i.requi_lotes && i.requi_lotes.caducidad) || '', frascos: num(i.cantidad_surtida) }))
          .sort((a, b) => String(a.lote).localeCompare(String(b.lote), 'es'));
        if (entradas.some((e) => e.lote === 'POR DEFINIR')) avisos.add(`${nombreBio(bio)} (${MESES[req.mes - 1]}) tiene lote POR DEFINIR: asígnalo en Requisiciones y vuelve a exportar.`);
        const multiLote = entradas.length > 1;
        const detalleDe = (filas) => {
          if (!multiLote) return '';
          const porLote = {};
          filas.forEach((f) => { const l = entradas.find((e) => e.loteId === f.lote_id); const k = l ? l.lote : '?'; porLote[k] = (porLote[k] || 0) + num(f.cantidad); });
          const partes = Object.entries(porLote).filter(([, q]) => q > 0).map(([l, q]) => `${l}: ${q}`);
          return partes.length ? ` (${partes.join(' / ')})` : '';
        };

        const dm = distMunicipio.filter((d) => d.requisicion_id === req.id && d.requi_biologico_id === bioId && num(d.cantidad) > 0);
        const du = distUnidad.filter((d) => d.requisicion_id === req.id && d.requi_biologico_id === bioId && num(d.cantidad) > 0);
        const salidas = [];
        ORDEN_DESTINOS.forEach((destino) => {
          const filasMuni = dm.filter((d) => d.municipio === destino);
          const totalMuni = filasMuni.reduce((s, d) => s + num(d.cantidad), 0);
          const hospital = !!HOSPITALES[destino];
          const delDestino = du.filter((d) => unidadPorId[d.unidad_id] && unidadPorId[d.unidad_id].municipio === destino);
          const porUnidad = {};
          delDestino.forEach((d) => { (porUnidad[d.unidad_id] ||= []).push(d); });
          const filasUnidad = Object.keys(porUnidad).map((id) => ({
            nombre: unidadPorId[id].nombre, frascos: porUnidad[id].reduce((s, d) => s + num(d.cantidad), 0), detalle: detalleDe(porUnidad[id])
          })).sort(porNombre);
          const sumaUnidades = filasUnidad.reduce((s, u) => s + u.frascos, 0);
          if (!totalMuni && !sumaUnidades) return;
          if (sumaUnidades > totalMuni) avisos.add(`${nombreBio(bio)} (${MESES[req.mes - 1]}): las unidades de ${destino} suman más que lo asignado al municipio.`);
          const base = { destino, destinoImpreso: DESTINO_IMPRESO[destino], hospital, municipal: { frascos: totalMuni, detalle: detalleDe(filasMuni) } };
          filasUnidad.forEach((u) => salidas.push({ ...base, unidad: u.nombre + u.detalle, frascos: u.frascos, soloUnidad: true }));
          const resto = totalMuni - sumaUnidades;
          if (resto > 0) {
            salidas.push({ ...base, unidad: hospital ? HOSPITALES[destino] : 'SIN REPARTIR A UNIDADES', frascos: resto, soloUnidad: true, sinRepartir: !hospital });
            if (!hospital) { if (!sinRepartir.has(req.mes)) sinRepartir.set(req.mes, new Set()); sinRepartir.get(req.mes).add(nombreBio(bio)); }
          }
        });
        const asignadoMuni = dm.reduce((s, d) => s + num(d.cantidad), 0);
        const surtido = entradas.reduce((s, e) => s + e.frascos, 0);
        if (asignadoMuni > surtido) avisos.add(`${nombreBio(bio)} (${MESES[req.mes - 1]}): lo asignado a municipios rebasa lo surtido.`);

        let h = hojas.get(bioId);
        if (!h) { h = { bio, porMes: new Map() }; hojas.set(bioId, h); }
        if (!h.porMes.has(req.mes)) h.porMes.set(req.mes, []);
        h.porMes.get(req.mes).push({ req, fecha, folio: req.folio_oracle || '', entradas, salidas, municipal: dm });
      });
    });

    const lista = [...hojas.values()].sort((a, b) => (a.bio.orden || 0) - (b.bio.orden || 0)).map((h) => {
      let saldo = 0; // frascos al cierre de la tarjeta anterior
      const tarjetas = [...h.porMes.keys()].sort((a, b) => a - b).map((mes) => {
        const bloques = h.porMes.get(mes);
        const tarjeta = { mes, saldoAnterior: saldo, bloques };
        bloques.forEach((b) => {
          saldo += b.entradas.reduce((s, e) => s + e.frascos, 0);
          saldo -= b.municipal.reduce((s, d) => s + num(d.cantidad), 0);
        });
        return tarjeta;
      });
      return { bio: h.bio, hoja: nombreHoja(nombreBio(h.bio)), titulo: nombreBio(h.bio), clave: h.bio.clave_articulo || '', dpf: dosisPorFrasco(h.bio), tarjetas };
    });
    [...sinRepartir.keys()].sort((a, b) => a - b).forEach((mes) => {
      const nombres = [...sinRepartir.get(mes)];
      avisos.add(`${MESES[mes - 1]}: falta repartir entre unidades (salen como «SIN REPARTIR A UNIDADES») en ${nombres.join(', ')}.`);
    });
    return { anio, hojas: lista, avisos: [...avisos] };
  }

  function nombreHoja(n) { return String(n).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim(); }

  // Filas de salida según el nivel del libro. POR MUNICIPIO: una por municipio, con los hospitales
  // dentro de QUERETARO (como en los kardex hechos a mano) y su desglose en observaciones.
  function salidasDelBloque(bloque, nivel) {
    if (nivel === 'UNIDAD') return bloque.salidas.map((s) => ({ destino: s.destinoImpreso, frascos: s.frascos, obs: s.unidad }));
    const porDestino = new Map();
    ORDEN_DESTINOS.forEach((d) => {
      const filas = bloque.municipal.filter((x) => x.municipio === d);
      const total = filas.reduce((s, x) => s + num(x.cantidad), 0);
      if (!total) return;
      const imp = DESTINO_IMPRESO[d];
      if (!porDestino.has(imp)) porDestino.set(imp, { destino: imp, frascos: 0, hosp: [] });
      const g = porDestino.get(imp);
      g.frascos += total;
      if (HOSPITALES[d]) g.hosp.push(`${HOSPITALES[d]} ${total}`);
    });
    return [...porDestino.values()].map((g) => ({ destino: g.destino, frascos: g.frascos, obs: g.hosp.length ? `INCLUYE ${g.hosp.join(' · ')}` : '' }));
  }

  // ---------------------------------------------------------------------------
  // Libro
  // ---------------------------------------------------------------------------
  const MEDIO = { style: 'medium', color: { argb: 'FF000000' } };
  const FINO = { style: 'thin', color: { argb: 'FF000000' } };
  const FUENTE = { name: 'Calibri', size: 12 };
  const ANCHOS = { A: 5.86, B: 22.71, C: 13.71, D: 13.71, E: 13.71, F: 12.71, G: 12.71, H: 18.71, I: 15.14, J: 12.57, K: 12.57, L: 12.57, M: 12.57, N: 18.86, O: 27.86 };
  const COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
  const COLOR_ENTRADA = 'FFC9D652';
  const COLOR_SALDO = 'FFF2F2F2';

  function celda(ws, addr, valor, opc) {
    const c = ws.getCell(addr);
    if (valor !== undefined && valor !== null) c.value = valor;
    c.font = { ...FUENTE, bold: !!(opc && opc.bold) };
    c.alignment = { horizontal: (opc && opc.h) || 'center', vertical: (opc && opc.v) || 'middle', wrapText: !!(opc && opc.wrap) };
    if (opc && opc.bottom) c.border = { ...(c.border || {}), bottom: FINO };
    if (opc && opc.top) c.border = { ...(c.border || {}), top: FINO };
    if (opc && opc.numFmt) c.numFmt = opc.numFmt;
    return c;
  }

  // Renglón de datos: fondo, bordes finos arriba/abajo y verticales gruesas entre grupos
  // (finas solo entre J|K y L|M, igual que la tarjeta original).
  function estiloRenglon(ws, r, fondo, ultimo) {
    COLS.forEach((col) => {
      const c = ws.getCell(`${col}${r}`);
      c.font = { ...FUENTE };
      c.alignment = { horizontal: col === 'O' ? 'left' : 'center', vertical: 'middle' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
      c.border = {
        top: FINO, bottom: ultimo ? MEDIO : FINO,
        left: (col === 'K' || col === 'M') ? FINO : MEDIO,
        right: col === 'O' ? MEDIO : undefined
      };
    });
    ws.getCell(`C${r}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`I${r}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`E${r}`).numFmt = 'mmm-yy';
  }

  function fechaXl(iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00Z') : null; }

  function pintarEncabezado(ws, r0, hoja, tarjeta, anio, responsable) {
    ws.mergeCells(`H${r0}:J${r0}`); celda(ws, `H${r0}`, 'ANEXO A', { bold: true });
    ws.mergeCells(`B${r0 + 1}:O${r0 + 1}`); celda(ws, `B${r0 + 1}`, `TARJETA DE CONTROL DE BIOLOGICOS ${anio}`, { bold: true });
    ws.mergeCells(`G${r0 + 2}:H${r0 + 2}`); celda(ws, `G${r0 + 2}`, 'BIOLÓGICO');
    ws.mergeCells(`I${r0 + 2}:J${r0 + 2}`); celda(ws, `I${r0 + 2}`, hoja.titulo, { bold: true, bottom: true }); ws.getCell(`J${r0 + 2}`).border = { bottom: FINO };
    const f = r0 + 4;
    ws.mergeCells(`B${f}:C${f}`); celda(ws, `B${f}`, 'ENTIDAD FEDERATIVA:');
    ws.mergeCells(`D${f}:E${f}`); celda(ws, `D${f}`, 'QUERETARO', { bottom: true }); ws.getCell(`E${f}`).border = { bottom: FINO };
    ws.mergeCells(`F${f}:G${f}`); celda(ws, `F${f}`, 'NIVEL: ');
    celda(ws, `H${f}`, 'ESTATAL', { bottom: true });
    celda(ws, `I${f}`, 'JURISDICCIÓN:'); celda(ws, `J${f}`, 1, { bottom: true });
    celda(ws, `K${f}`, 'LOCAL:'); celda(ws, `L${f}`, null, { bottom: true });
    celda(ws, `M${f}`, 'UBICACIÓN:');
    ws.mergeCells(`N${f}:O${f}`); celda(ws, `N${f}`, 'VACUNAS ', { bottom: true }); ws.getCell(`O${f}`).border = { bottom: FINO };
    ws.mergeCells(`N${f + 1}:O${f + 1}`); celda(ws, `N${f + 1}`, 'MUNICIPIO Y LOCALIDAD', { v: 'top' });
    const g = r0 + 6;
    ws.mergeCells(`B${g}:C${g}`); celda(ws, `B${g}`, 'RESPONSABLE:');
    ws.mergeCells(`D${g}:F${g}`); celda(ws, `D${g}`, responsable || '', { bottom: true }); ['E', 'F'].forEach((c) => { ws.getCell(`${c}${g}`).border = { bottom: FINO }; });
    ws.mergeCells(`G${g}:H${g}`); celda(ws, `G${g}`, 'CLAVE:');
    ws.mergeCells(`I${g}:L${g}`); celda(ws, `I${g}`, hoja.clave, { bold: true, bottom: true }); ['J', 'K', 'L'].forEach((c) => { ws.getCell(`${c}${g}`).border = { bottom: FINO }; });
    ws.mergeCells(`N${g}:O${g}`); celda(ws, `N${g}`, MESES[tarjeta.mes - 1], { bottom: true }); ws.getCell(`O${g}`).border = { bottom: FINO };

    const h1 = r0 + 8, h2 = r0 + 9;
    const cab = [['B', 'ORIGEN/PROCEDENCIA'], ['C', 'FECHA DE INGRESO '], ['D', 'N° DE LOTE'], ['E', 'FECHA DE CADUCIDAD'], ['F', 'ENTRADAS'], ['H', 'DESTINO'], ['I', 'FECHA DE SALIDA'], ['J', 'SALIDAS'], ['L', 'SALDO'], ['N', 'TEMPERATURA  DE INGRESO °C'], ['O', 'OBSERVACIONES']];
    ['B', 'C', 'D', 'E', 'H', 'I', 'N', 'O'].forEach((c) => ws.mergeCells(`${c}${h1}:${c}${h2}`));
    ['F', 'J', 'L'].forEach((c) => ws.mergeCells(`${c}${h1}:${String.fromCharCode(c.charCodeAt(0) + 1)}${h1}`));
    COLS.forEach((c) => {
      [h1, h2].forEach((r) => {
        const x = ws.getCell(`${c}${r}`);
        x.font = { ...FUENTE }; x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        x.border = { top: r === h1 ? MEDIO : FINO, bottom: r === h2 ? MEDIO : FINO, left: (c === 'K' || c === 'M') ? FINO : MEDIO, right: c === 'O' ? MEDIO : undefined };
      });
    });
    cab.forEach(([c, t]) => { ws.getCell(`${c}${h1}`).value = t; });
    [['F', 'FRASCOS'], ['G', 'DOSIS'], ['J', 'FRASCOS'], ['K', 'DOSIS'], ['L', 'FRASCOS'], ['M', 'DOSIS']].forEach(([c, t]) => { ws.getCell(`${c}${h2}`).value = t; });
    return h2 + 1; // primera fila de datos
  }

  async function generar(modelo, { ExcelJS, nivel, logos, responsable }) {
    const Lib = ExcelJS || (typeof globalThis !== 'undefined' ? globalThis.ExcelJS : null);
    if (!Lib) throw new Error('ExcelJS no está cargado');
    const wb = new Lib.Workbook();
    wb.creator = 'SIREVAQ';
    const ids = {};
    if (logos) {
      if (logos.salud) ids.salud = wb.addImage({ base64: logos.salud, extension: 'png' });
      if (logos.queretaro) ids.queretaro = wb.addImage({ base64: logos.queretaro, extension: 'png' });
    }
    const usados = new Set();
    modelo.hojas.forEach((hoja) => {
      let nombre = hoja.hoja, n = 2;
      while (usados.has(nombre.toUpperCase())) nombre = `${hoja.hoja.slice(0, 28)} ${n++}`;
      usados.add(nombre.toUpperCase());
      const ws = wb.addWorksheet(nombre, { views: [{ showGridLines: false, zoomScale: 80 }] });
      Object.entries(ANCHOS).forEach(([c, w]) => { ws.getColumn(c).width = w; });
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.04, right: 0.24, top: 0.75, bottom: 0.75, header: 0.31, footer: 0.31 } };

      let r0 = 1;
      hoja.tarjetas.forEach((tarjeta, ti) => {
        if (ti > 0) ws.getRow(r0 - 1).addPageBreak();
        [r0, r0 + 1, r0 + 2].forEach((r) => { ws.getRow(r).height = 21; });
        if (ids.salud) ws.addImage(ids.salud, { tl: { col: 1.03, row: r0 - 1 }, ext: { width: 248, height: 64 } });
        if (ids.queretaro) ws.addImage(ids.queretaro, { tl: { col: 13.24, row: r0 - 1 }, ext: { width: 215, height: 62 } });
        let r = pintarEncabezado(ws, r0, hoja, tarjeta, modelo.anio, responsable);

        // SALDO ANTERIOR (lo que no salió de cámara fría en la tarjeta anterior; 0 en la primera).
        estiloRenglon(ws, r, COLOR_SALDO, false);
        celda(ws, `B${r}`, 'SALDO ANTERIOR', { numFmt: undefined });
        ws.getCell(`L${r}`).value = tarjeta.saldoAnterior;
        ws.getCell(`M${r}`).value = { formula: `L${r}*${hoja.dpf}`, result: tarjeta.saldoAnterior * hoja.dpf };
        let filaPrev = r, saldo = tarjeta.saldoAnterior;
        r++;

        const filaSaldo = (fila, frascosEntra, frascosSale) => {
          saldo += frascosEntra - frascosSale;
          ws.getCell(`L${fila}`).value = { formula: `L${filaPrev}+F${fila}-J${fila}`, result: saldo };
          ws.getCell(`M${fila}`).value = { formula: `M${filaPrev}+G${fila}-K${fila}`, result: saldo * hoja.dpf };
          filaPrev = fila;
        };

        tarjeta.bloques.forEach((bloque) => {
          const fecha = fechaXl(bloque.fecha);
          bloque.entradas.forEach((e, i) => {
            estiloRenglon(ws, r, COLOR_ENTRADA, false);
            ws.getCell(`B${r}`).value = 'CAMARA FRIA';
            if (fecha) ws.getCell(`C${r}`).value = fecha;
            ws.getCell(`D${r}`).value = e.lote;
            if (e.caducidad) ws.getCell(`E${r}`).value = fechaXl(e.caducidad);
            ws.getCell(`F${r}`).value = e.frascos;
            ws.getCell(`G${r}`).value = { formula: `F${r}*${hoja.dpf}`, result: e.frascos * hoja.dpf };
            ws.getCell(`H${r}`).value = 'JS-1';
            if (fecha) ws.getCell(`I${r}`).value = fecha;
            ws.getCell(`N${r}`).value = '4°';
            if (i === 0 && bloque.folio) ws.getCell(`O${r}`).value = bloque.folio;
            filaSaldo(r, e.frascos, 0);
            r++;
          });
          salidasDelBloque(bloque, nivel).forEach((s) => {
            estiloRenglon(ws, r, 'FFFFFFFF', false);
            ws.getCell(`B${r}`).value = 'JS-1';
            ws.getCell(`H${r}`).value = s.destino;
            if (fecha) ws.getCell(`I${r}`).value = fecha;
            ws.getCell(`J${r}`).value = s.frascos;
            ws.getCell(`K${r}`).value = { formula: `J${r}*${hoja.dpf}`, result: s.frascos * hoja.dpf };
            if (s.obs) ws.getCell(`O${r}`).value = s.obs;
            filaSaldo(r, 0, s.frascos);
            r++;
          });
        });
        // Cierre grueso de la tarjeta.
        COLS.forEach((c) => { const x = ws.getCell(`${c}${r - 1}`); x.border = { ...(x.border || {}), bottom: MEDIO }; });
        r0 = r + 1;
      });
    });
    if (!modelo.hojas.length) wb.addWorksheet('SIN MOVIMIENTOS').getCell('A1').value = `No hay requisiciones con lo surtido capturado en ${modelo.anio}.`;
    return wb.xlsx.writeBuffer();
  }

  return { armarModelo, generar, salidasDelBloque, dosisPorFrasco, nombreBio, fechaRecepcion, ORDEN_DESTINOS, DOSIS_POR_FRASCO };
});
