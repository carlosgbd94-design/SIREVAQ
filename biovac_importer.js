// ============================================================================
// BioVac — Importador estructural de "Movimiento de Biológico" (.xlsx)
//
// Lee el archivo TAL CUAL lo llenan las unidades (mismo formato en las 4
// unidades de la jurisdicción), sin depender de coordenadas de celda fijas:
// el número de renglones por biológico varía mes a mes, así que el parser
// reconoce bloques por el TEXTO de columna A (nombre de biológico -> filas
// de lote en blanco -> "A.R.F. En dictamen o canje" -> "Total").
//
// Uso en navegador (Fase 3, autoservicio por municipio):
//   const parsed = BiovacImporter.parseWorkbook(arrayBuffer);
//   const resumen = await BiovacImporter.importParsedData(window.supabase, unidadId, parsed, usuario);
//
// Funciona también en Node (require) para pruebas/carga masiva puntual,
// siempre que se le pase un dbClient con la misma forma que supabase-js
// (.from(tabla).select/insert/update/upsert, .rpc(nombre, args)).
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('exceljs'));
  } else {
    root.BiovacImporter = factory(root.ExcelJS);
  }
})(typeof self !== 'undefined' ? self : this, function (ExcelJS) {
  'use strict';

  const MESES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };

  // ---------------------------------------------------------------------
  // Normalización y matcher de catálogo (reglas en orden de prioridad:
  // las más específicas primero, para no confundir TD/TDPA, SR/SRP,
  // Hepatitis A/B, Neumocócica 13/20/23, COVID Moderna/Pfizer).
  // ---------------------------------------------------------------------

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/["'.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const REGLAS_CATALOGO = [
    ['TDPA', (n) => n.includes('tdpa')],
    ['TD', (n) => /(^|\s)td(\s|$)/.test(n) && !n.includes('tdpa')],
    ['SRP', (n) => n.includes('triple viral') || n.includes('srp')],
    ['SR', (n) => /(^|\s)sr(\s|$)/.test(n) && n.includes('multidosis')],
    ['BCG', (n) => n.includes('bcg')],
    ['HEPB', (n) => n.includes('hepatitis') && /\bb\b/.test(n)],
    ['HEPA', (n) => n.includes('hepatitis') && /\ba\b/.test(n)],
    ['HEXAVALENTE', (n) => n.includes('hexavalente')],
    ['DPT', (n) => /(^|\s)dpt(\s|$)/.test(n)],
    ['ROTAVIRUS', (n) => n.includes('rotavirus')],
    ['NEUMO_13V', (n) => n.includes('neumococica') && n.includes('13')],
    ['NEUMO_23V', (n) => n.includes('neumococica') && n.includes('23')],
    ['NEUMO_20V', (n) => n.includes('neumococica') && n.includes('20')],
    ['ANTIINFLUENZA', (n) => n.includes('antiinfluenza') || n.includes('influenza')],
    ['VPH', (n) => n.includes('vph') || n.includes('v p h') || (n.includes('bivalente') && n.includes('tetravalente'))],
    ['COVID_MODERNA', (n) => n.includes('covid') && n.includes('moderna')],
    ['COVID_PFIZER', (n) => n.includes('covid') && n.includes('pfizer')],
    ['VARICELA', (n) => n.includes('varicela')],
    ['VSR', (n) => /(^|\s)vsr(\s|$)/.test(n)]
  ];

  function matchCatalogo(nombreExcelBloque) {
    const n = normalizar(nombreExcelBloque);
    for (const [clave, test] of REGLAS_CATALOGO) {
      if (test(n)) return clave;
    }
    return null;
  }

  // Algunos meses (FEB-DIC en la plantilla real) calculan el día de corte
  // con una fórmula XLOOKUP a la hoja DATOS en vez de un número plano como
  // ENE -- ExcelJS entrega esas celdas como {formula, result}, hay que leer
  // el resultado cacheado.
  function numeroDeCelda(value) {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && typeof value.result === 'number') return value.result;
    return null;
  }

  const MARCADORES_IGNORAR = ['anverso', 'reverso', 'biologico', 'servicios de salud', 'centro nacional',
    'informe mensual', 'identificacion', 'entidad federativa', 'fecha del corte', 'responsable de la elaboracion',
    'movimiento de biologico'];

  function esMarcadorIgnorable(n) {
    return MARCADORES_IGNORAR.some((m) => n.includes(m));
  }

  // ---------------------------------------------------------------------
  // Parser estructural de una hoja mensual
  // ---------------------------------------------------------------------

  function textoDeCelda(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
    if (typeof value.text === 'string') return value.text;
    if (value.result !== undefined) return textoDeCelda(value.result);
    if (typeof value.formula === 'string') return '';
    return String(value);
  }

  function celdaVacia(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (typeof v === 'object') return textoDeCelda(v).trim() === '';
    return false;
  }

  function leerFormulaTexto(cell) {
    if (!cell) return null;
    if (typeof cell.formula === 'string') return cell.formula;
    if (cell.value && typeof cell.value === 'object' && typeof cell.value.formula === 'string') return cell.value.formula;
    return null;
  }

  // El renglón usa "dosis fraccionada" (Hepatitis B, COVID Moderna) si la
  // columna J trae una fórmula (helper H/2+I) -- propia o de fórmula
  // compartida (ExcelJS solo copia el texto de la fórmula en la celda
  // maestra del grupo; las demás solo traen `sharedFormula` apuntando a
  // ella). En el caso normal, H/I/J son en realidad una sola celda visualmente
  // fusionada cuyo valor Excel replica como número plano en las 3 columnas
  // -- si se leyeran I/L como datos aparte se duplicaría el conteo.
  function celdaTieneFormula(cell) {
    const v = cell && cell.value;
    return !!(v && typeof v === 'object' && (typeof v.formula === 'string' || typeof v.sharedFormula === 'string'));
  }

  function detectarDosisPorFrasco(cellN) {
    const formula = leerFormulaTexto(cellN);
    if (!formula) return null;
    const m = formula.match(/\*\s*(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }

  function leerFecha(cell) {
    if (!cell || celdaVacia(cell.value)) return null;
    const v = cell.value;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }

  function parseHojaMensual(worksheet, mesClave) {
    // Igual que el día de corte (ver abajo): un formato anterior puede
    // traer el año como fórmula (con resultado cacheado) o como texto en
    // vez de número plano.
    const anioCellValue = worksheet.getCell('I7').value;
    const anio = numeroDeCelda(anioCellValue)
      || (typeof anioCellValue === 'string' && /^\d{4}$/.test(anioCellValue.trim()) ? Number(anioCellValue.trim()) : null);
    // C7 ("DIA:") es un número de día de mes, NO una fecha -- la fecha de
    // corte real se arma combinando ese día con el mes de la hoja y I7 (año).
    const dia = numeroDeCelda(worksheet.getCell('C7').value);
    const mesNum = MESES[mesClave];
    const fechaCorte = (dia && anio && mesNum)
      ? `${anio}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      : null;
    const responsableTexto = textoDeCelda(worksheet.getCell('D8').value);
    const responsable = responsableTexto.trim() || null;

    const bloques = [];
    let bloqueActual = null;
    let pagina = 'ANVERSO';
    let advertencias = [];
    let noReconocidos = [];

    for (let r = 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      // ExcelJS resuelve el valor de TODA celda fusionada al de su celda
      // ancla -- una fila que sólo continúa una fusión (ej. el 2° renglón
      // del bloque BCG) "vería" el mismo texto que la fila del encabezado
      // si no se filtra por ancla. Sólo la fila ancla representa una
      // transición real de encabezado/A.R.F./Total.
      const celdaA = row.getCell(1);
      const esAnclaA = !celdaA.isMerged || (celdaA.master && celdaA.master.address === celdaA.address);
      const aTexto = esAnclaA ? textoDeCelda(celdaA.value) : '';

      if (!celdaVacia(aTexto)) {
        const n = normalizar(aTexto);
        if (n.startsWith('total')) {
          bloqueActual = null;
          continue;
        }
        if (n === 'reverso') { pagina = 'REVERSO'; continue; }
        if (n === 'anverso') { pagina = 'ANVERSO'; continue; }
        if (esMarcadorIgnorable(n)) continue;

        if (n.includes('arf') || n.includes('dictamen')) {
          if (bloqueActual) bloqueActual.categoriaActual = 'ARF';
          // sin "continue": esta misma fila suele traer el primer lote de A.R.F./canje
        } else {
          // nuevo bloque de biológico -- esta misma fila suele traer su primer renglón de lote
          const clave = matchCatalogo(aTexto);
          bloqueActual = { nombreExcel: aTexto, clave, pagina, categoriaActual: 'NORMAL', renglones: [] };
          bloques.push(bloqueActual);
          if (!clave) noReconocidos.push(aTexto);
        }
      }

      // posible renglón de lote del bloque activo (columna A vacía, o la
      // misma fila que abrió el bloque/A.R.F. de arriba)
      if (!bloqueActual) continue;

      const anteriorCantidad = row.getCell(2).value;
      const anteriorLote = row.getCell(3).value;
      const anteriorCaducidad = leerFecha(row.getCell(4));
      const recibidoCantidad = row.getCell(5).value;
      const recibidoLote = row.getCell(6).value;
      const recibidoCaducidad = leerFecha(row.getCell(7));
      const dosisFraccionada = celdaTieneFormula(row.getCell(10));
      const aplicadasA = row.getCell(8).value;
      const aplicadasB = dosisFraccionada ? row.getCell(9).value : null;
      const desechadasA = row.getCell(11).value;
      const desechadasB = dosisFraccionada ? row.getCell(12).value : null;
      const observaciones = row.getCell(17).value;

      const numeroLote = !celdaVacia(recibidoLote) ? textoDeCelda(recibidoLote).trim()
        : (!celdaVacia(anteriorLote) ? textoDeCelda(anteriorLote).trim() : null);

      const hayDatos = !celdaVacia(anteriorCantidad) || !celdaVacia(recibidoCantidad) ||
        !celdaVacia(aplicadasA) || !celdaVacia(aplicadasB) || !celdaVacia(desechadasA) || !celdaVacia(desechadasB);

      if (!hayDatos && !numeroLote) continue;

      if (!numeroLote) {
        advertencias.push(`Fila ${r}: hay datos pero no número de lote (bloque "${bloqueActual.nombreExcel}")`);
        continue;
      }

      const dosisDetectada = detectarDosisPorFrasco(row.getCell(14));
      const observacionesTexto = !celdaVacia(observaciones) ? textoDeCelda(observaciones).trim() : null;
      // El Excel real imprime ARF y Canje bajo una sola sección
      // "A.R.F. En dictamen o canje", pero son estatus distintos -- un
      // renglón cuya observación es exactamente "CANJE" es canje puro,
      // el resto de esa sección se clasifica como ARF (en dictamen).
      const categoria = bloqueActual.categoriaActual === 'ARF' && observacionesTexto && /^canje$/i.test(observacionesTexto)
        ? 'CANJE' : bloqueActual.categoriaActual;

      bloqueActual.renglones.push({
        fila: r,
        categoria,
        numeroLote,
        caducidad: recibidoCaducidad || anteriorCaducidad || null,
        existenciaAnterior: Number(anteriorCantidad) || 0,
        recibido: Number(recibidoCantidad) || 0,
        aplicadasA: Number(aplicadasA) || 0,
        aplicadasB: Number(aplicadasB) || 0,
        desechadasA: Number(desechadasA) || 0,
        desechadasB: Number(desechadasB) || 0,
        observaciones: observacionesTexto,
        dosisDetectada
      });
    }

    for (const b of bloques) b.renglones = fusionarRenglonesDuplicados(b.renglones);

    return {
      mesClave, mes: MESES[mesClave], anio,
      fechaCorte,
      responsable,
      bloques: bloques.filter((b) => b.renglones.length > 0),
      advertencias, noReconocidos
    };
  }

  // El mismo número de lote puede aparecer más de una vez dentro de un
  // mismo bloque+categoría en el Excel real (captura manual duplicada,
  // ej. un lote listado en dos renglones con distinta caducidad). El
  // modelo de datos es "un renglón por lote", así que se fusionan sumando
  // cantidades -- de lo contrario violaría la unicidad (movimiento, lote,
  // categoría) al importar.
  function fusionarRenglonesDuplicados(renglones) {
    const porLote = new Map();
    const orden = [];
    for (const r of renglones) {
      const key = r.categoria + '::' + r.numeroLote;
      if (!porLote.has(key)) {
        porLote.set(key, { ...r });
        orden.push(key);
      } else {
        const acc = porLote.get(key);
        acc.existenciaAnterior += r.existenciaAnterior;
        acc.recibido += r.recibido;
        acc.aplicadasA += r.aplicadasA;
        acc.aplicadasB += r.aplicadasB;
        acc.desechadasA += r.desechadasA;
        acc.desechadasB += r.desechadasB;
        if (!acc.caducidad && r.caducidad) acc.caducidad = r.caducidad;
        if (acc.dosisDetectada == null && r.dosisDetectada != null) acc.dosisDetectada = r.dosisDetectada;
        if (!acc.observaciones && r.observaciones) acc.observaciones = r.observaciones;
      }
    }
    return orden.map((k) => porLote.get(k));
  }

  // Acepta número plano o número tecleado como texto ("50") -- un formato
  // anterior capturado a mano puede traer cualquiera de las dos formas, y
  // antes solo se reconocía la primera, así que una hoja con datos reales
  // pero tecleados como texto se leía como "sin datos" y el mes entero
  // desaparecía del análisis. A propósito NO se acepta aquí el resultado
  // cacheado de una fórmula: estas columnas pueden traer una fórmula de
  // arrastre (existencia anterior = total del mes previo) que da un valor
  // no-cero en un mes genuinamente vacío -- contarla como "dato" generaría
  // falsos positivos (meses sin ningún renglón real que igual aparecerían
  // en el análisis).
  function esNumeroConDatos(v) {
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.trim()))) return Number(v.trim()) !== 0;
    return false;
  }

  function hojaTieneDatos(worksheet) {
    for (let r = 13; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      for (const col of [2, 5, 8, 9, 11, 12]) {
        if (esNumeroConDatos(row.getCell(col).value)) return true;
      }
    }
    return false;
  }

  // El nombre de la pestaña varía entre formatos/años ("ENE", "Enero",
  // "ENE-25", "ene 2024"...) -- todos los nombres de mes en español
  // (ENERO, FEBRERO, ...) empiezan con su propia abreviatura de 3 letras,
  // así que basta con normalizar (sin acentos/espacios/números/mayúsculas)
  // y comparar por prefijo en vez de exigir el nombre exacto de 3 letras.
  function normalizarNombreHoja(nombre) {
    return String(nombre || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z]/g, '');
  }

  function encontrarHojaDeMes(wb, mesClave) {
    const directa = wb.getWorksheet(mesClave);
    if (directa) return directa;
    for (const hoja of wb.worksheets) {
      if (normalizarNombreHoja(hoja.name).startsWith(mesClave)) return hoja;
    }
    return null;
  }

  async function parseWorkbook(arrayBufferOrBuffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBufferOrBuffer);

    const meses = [];
    for (const mesClave of Object.keys(MESES)) {
      const ws = encontrarHojaDeMes(wb, mesClave);
      if (!ws) continue;
      if (!hojaTieneDatos(ws)) continue;
      meses.push(parseHojaMensual(ws, mesClave));
    }
    meses.sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes));
    return { meses };
  }

  // ---------------------------------------------------------------------
  // Orquestación contra la base de datos (Supabase). Importa mes por mes,
  // en orden cronológico, usando SIEMPRE biovac_cerrar_mes del motor para
  // cerrar cada mes -- así el arrastre de existencia al mes siguiente lo
  // decide el motor, no lo que diga el Excel de ese mes siguiente. Si el
  // Excel trae una "existencia anterior" distinta a la que el motor ya
  // sembró, se reporta como discrepancia mas no se sobreescribe.
  // ---------------------------------------------------------------------

  async function cargarCatalogoPorClave(db) {
    const { data, error } = await db.from('biovac_catalogo_biologicos')
      .select('id, clave, presentacion, dosis_por_frasco, vigente_desde, vigente_hasta');
    if (error) throw error;
    const mapa = new Map();
    for (const row of data) mapa.set(row.clave, row);
    return mapa;
  }

  async function resolverLote(db, cacheLotes, biologicoId, numeroLote, caducidad, dosisOverride) {
    const key = biologicoId + '::' + numeroLote;
    if (cacheLotes.has(key)) return cacheLotes.get(key);

    const { data: existente, error: errSel } = await db.from('biovac_lotes')
      .select('id, caducidad, dosis_por_frasco_override')
      .eq('biologico_id', biologicoId).eq('numero_lote', numeroLote).maybeSingle();
    if (errSel) throw errSel;

    if (existente) {
      const patch = {};
      if (caducidad && !existente.caducidad) patch.caducidad = caducidad;
      if (dosisOverride != null && existente.dosis_por_frasco_override == null) patch.dosis_por_frasco_override = dosisOverride;
      if (Object.keys(patch).length > 0) {
        const { error: errUpd } = await db.from('biovac_lotes').update(patch).eq('id', existente.id);
        if (errUpd) throw errUpd;
      }
      cacheLotes.set(key, existente.id);
      return existente.id;
    }

    const { data: creado, error: errIns } = await db.from('biovac_lotes')
      .insert({ biologico_id: biologicoId, numero_lote: numeroLote, caducidad, dosis_por_frasco_override: dosisOverride })
      .select('id').single();
    if (errIns) throw errIns;
    cacheLotes.set(key, creado.id);
    return creado.id;
  }

  async function importParsedData(db, unidadId, parsed, usuario) {
    const catalogo = await cargarCatalogoPorClave(db);
    const cacheLotes = new Map();
    const resumenMeses = [];
    const noReconocidosGlobal = new Set();

    for (const mesData of parsed.meses) {
      if (!mesData.anio) {
        resumenMeses.push({ mes: mesData.mesClave, error: 'No se pudo leer el año (celda I7)' });
        continue;
      }

      mesData.noReconocidos.forEach((n) => noReconocidosGlobal.add(n));

      const { data: movExistente, error: errMovSel } = await db.from('biovac_movimientos')
        .select('id, estado').eq('unidad_id', unidadId).eq('anio', mesData.anio).eq('mes', mesData.mes).maybeSingle();
      if (errMovSel) throw errMovSel;

      if (movExistente && movExistente.estado === 'CERRADO') {
        resumenMeses.push({ mes: mesData.mesClave, anio: mesData.anio, omitido: 'El movimiento ya estaba CERRADO' });
        continue;
      }

      let movimientoId = movExistente ? movExistente.id : null;
      if (!movimientoId) {
        const { data: nuevo, error: errIns } = await db.from('biovac_movimientos')
          .insert({ unidad_id: unidadId, anio: mesData.anio, mes: mesData.mes, responsable_elaboracion: mesData.responsable, fecha_corte: mesData.fechaCorte })
          .select('id').single();
        if (errIns) throw errIns;
        movimientoId = nuevo.id;
      } else {
        await db.from('biovac_movimientos').update({ responsable_elaboracion: mesData.responsable, fecha_corte: mesData.fechaCorte }).eq('id', movimientoId);
      }

      const { data: renglonesExistentes, error: errRSel } = await db.from('biovac_renglones')
        .select('id, lote_id, categoria, existencia_anterior_frascos').eq('movimiento_id', movimientoId);
      if (errRSel) throw errRSel;
      const mapaExistentes = new Map(renglonesExistentes.map((r) => [r.lote_id + '::' + r.categoria, r]));

      let insertados = 0, actualizados = 0, omitidos = 0;
      const discrepancias = [];

      for (const bloque of mesData.bloques) {
        if (!bloque.clave || !catalogo.has(bloque.clave)) continue;
        const cat = catalogo.get(bloque.clave);

        for (const r of bloque.renglones) {
          const dosisOverride = (cat.presentacion === 'MULTIDOSIS' && r.dosisDetectada != null && r.dosisDetectada !== Number(cat.dosis_por_frasco))
            ? r.dosisDetectada : null;
          const loteId = await resolverLote(db, cacheLotes, cat.id, r.numeroLote, r.caducidad, dosisOverride);
          const key = loteId + '::' + r.categoria;
          const existente = mapaExistentes.get(key);

          // El Excel histórico se llenó a mano, sin las validaciones del
          // motor (lote NORMAL caducado con existencia, BCG/SR fraccionado,
          // etc.) -- si una fila viola alguna, se omite y se reporta como
          // discrepancia en vez de abortar la importación completa del mes.
          if (existente) {
            const anteriorMotor = Number(existente.existencia_anterior_frascos);
            if (Math.abs(anteriorMotor - r.existenciaAnterior) > 0.001) {
              discrepancias.push(`Lote ${r.numeroLote} (${bloque.nombreExcel}): Excel dice existencia anterior ${r.existenciaAnterior}, el motor ya tenía ${anteriorMotor} (se conserva la del motor)`);
            }
            const { error: errUpd } = await db.from('biovac_renglones').update({
              recibido_frascos: r.recibido, aplicadas_a: r.aplicadasA, aplicadas_b: r.aplicadasB,
              desechadas_a: r.desechadasA, desechadas_b: r.desechadasB, observaciones: r.observaciones
            }).eq('id', existente.id);
            if (errUpd) {
              discrepancias.push(`Lote ${r.numeroLote} (${bloque.nombreExcel}): omitido -- ${errUpd.message}`);
              omitidos++;
            } else {
              actualizados++;
            }
          } else {
            const { error: errIns } = await db.from('biovac_renglones').insert({
              movimiento_id: movimientoId, lote_id: loteId, categoria: r.categoria,
              existencia_anterior_frascos: r.existenciaAnterior, recibido_frascos: r.recibido,
              aplicadas_a: r.aplicadasA, aplicadas_b: r.aplicadasB,
              desechadas_a: r.desechadasA, desechadas_b: r.desechadasB, observaciones: r.observaciones
            });
            if (errIns) {
              discrepancias.push(`Lote ${r.numeroLote} (${bloque.nombreExcel}): omitido -- ${errIns.message}`);
              omitidos++;
            } else {
              insertados++;
            }
          }
        }
      }

      const { error: errCerrar } = await db.rpc('biovac_cerrar_mes', { p_movimiento_id: movimientoId, p_usuario: usuario });
      if (errCerrar) throw errCerrar;

      resumenMeses.push({ mes: mesData.mesClave, anio: mesData.anio, movimientoId, insertados, actualizados, omitidos, discrepancias });
    }

    return { meses: resumenMeses, noReconocidos: Array.from(noReconocidosGlobal) };
  }

  return { parseWorkbook, matchCatalogo, normalizar, importParsedData };
});
