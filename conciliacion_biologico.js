/**
 * CONCILIACIÓN DE BIOLÓGICO 2026 (formato trimestral CeNSIA, versión 7.1).
 *
 * Se llena cada mes y se entrega por trimestre, acumulado en el año: cuánto había, cuánto se recibió, cuánto se aplicó y
 * cuánto se perdió, POR LOTE y en DOSIS. Todo sale de BIOVAC (Movimiento de Biológico); nada se teclea.
 *
 * Reglas de negocio (confirmadas con el usuario):
 *   - Un renglón por LOTE y mes (igual que BIOVAC). No se separa por fecha de entrada: «Fecha de recepción» y «N° de entrega»
 *     se dejan vacíos; PT también.
 *   - Pérdida por ACCIDENTE EN LA RED DE FRÍO = lo desechado en renglones A.R.F. (y Canje). TODO lo demás que se desecha
 *     (multidosis abierta de BCG/SR, caducidad, ruptura...) es «Pérdida en la operación».
 *   - Los frascos se convierten a dosis con las dosis por frasco del lote (Moderna 5, Pfizer 6, BCG/SR/DPT/Td 10...).
 *   - Hepatitis B y COVID Moderna separan lo aplicado en dos columnas (0.5/1 ml y 0.25/0.5 ml): total = a/2 + b (igual que BIOVAC).
 *   - Antes de octubre de 2026 no hay datos en SIREVAQ: esos meses se dejan vacíos (sin ceros inventados).
 *   - Se exporta el año acumulado (enero a diciembre); los meses sin datos quedan como vienen en la plantilla.
 *   - Municipal = suma de sus unidades. Masivo = un libro por unidad.
 *
 * El libro se arma sobre la plantilla real (Formatos/conciliacion_biologico_plantilla.xlsx): se quitan las hojas ÍNDICE y DATOS
 * (el nombre de la unidad lo pone el código) y TODAS las fórmulas de las hojas de biológico se reescriben explícitas, con su
 * resultado a la vista (la plantilla mezclaba fórmulas compartidas y, en el total del trimestre, restaba dos veces la pérdida
 * por red de frío).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ConciliacionBiologico = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  const ANIO_PLANTILLA = 2026;
  const MES_INICIO = 10;                       // SIREVAQ tiene Movimiento por unidad desde octubre de 2026
  const PLANTILLA_URL = './Formatos/conciliacion_biologico_plantilla.xlsx';
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const HOJAS_QUITAR = ['ÍNDICE', 'INDICE', 'DATOS'];

  // clave del catálogo BIOVAC -> hoja de la plantilla (sin espacios sobrantes)
  const HOJA_DE = {
    NEUMO_13V: 'NEUMO 13', NEUMO_20V: 'NEUMO 20', ROTAVIRUS: 'ROTAVIRUS', HEXAVALENTE: 'HEXAVALENTE', HEPB: 'HEPATITIS B 20 mcg',
    HEPA: 'Hepatitis A', SR: 'SR', BCG: 'BCG', DPT: 'DPT', TDPA: 'TDPa', TD: 'TD', SRP: 'SRP', VARICELA: 'Varicela',
    ANTIINFLUENZA: 'INFLUENZA', VPH: 'VPH', COVID_PFIZER: 'C-19 PFIZER', COVID_MODERNA: 'C-19 MODERNA', VSR: 'VSR'
  };
  const SPLIT = new Set(['HEPB', 'COVID_MODERNA']);
  const DEFAULT_DPF = { COVID_MODERNA: 5, COVID_PFIZER: 6 };

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;
  const colL = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const nombreMes = (m) => MESES[Number(m) - 1] || String(m);
  const trimestreDe = (mes) => Math.ceil(Number(mes) / 3);

  // ---------------------------------------------------------------------------------------------------------------
  // 1) MOTOR: renglones de BIOVAC -> filas de conciliación (puro, sin Excel ni red)
  // ---------------------------------------------------------------------------------------------------------------

  /**
   * Renglón normalizado: { clave, lote, caducidad, dpf, categoria, anterior, recibido, apA, apB, deA, deB, final }
   * (frascos en anterior/recibido/final; DOSIS en apA/apB/deA/deB, como en BIOVAC).
   */
  function normalizarRenglonDb(r, catalogoPorId) {
    const lote = r.biovac_lotes || {};
    const cat = (catalogoPorId && catalogoPorId.get(lote.biologico_id)) || null;
    if (!cat) return null;
    const dpf = num(lote.dosis_por_frasco_override) || num(cat.dosis_por_frasco) || DEFAULT_DPF[cat.clave] || 1;
    return {
      clave: cat.clave, lote: String(lote.numero_lote || '').trim().toUpperCase(), caducidad: lote.caducidad || null, dpf,
      categoria: String(r.categoria || 'NORMAL').toUpperCase(),
      anterior: num(r.existencia_anterior_frascos), recibido: num(r.recibido_frascos),
      apA: num(r.aplicadas_a), apB: num(r.aplicadas_b), deA: num(r.desechadas_a), deB: num(r.desechadas_b),
      final: r.existencia_final_frascos == null ? null : num(r.existencia_final_frascos)
    };
  }

  /**
   * Junta los renglones de UN mes (de una unidad o de todas las de un municipio) por biológico y lote.
   * Devuelve Map clave -> Map lote -> fila { G, frascos, E, apA, apB, ap, oper, rf, T, arfFinal, finalBiovac, caducidad, dpf }.
   * Todo en dosis. oper = desechado en renglones NORMAL; rf = desechado en A.R.F./Canje (accidente en red de frío).
   */
  function consolidarMes(renglones, avisos, etiqueta) {
    const porClave = new Map();
    (renglones || []).forEach((x) => {
      if (!x || !x.clave || !x.lote) return;
      const split = SPLIT.has(x.clave);
      if (!porClave.has(x.clave)) porClave.set(x.clave, new Map());
      const lotes = porClave.get(x.clave);
      let f = lotes.get(x.lote);
      if (!f) { f = { G: 0, frascos: 0, E: 0, apA: 0, apB: 0, oper: 0, rf: 0, arfFinal: 0, canjeFinal: 0, finalBiovac: 0, finalBiovacConocido: true, caducidad: x.caducidad, dpf: x.dpf }; lotes.set(x.lote, f); }
      if (!f.caducidad && x.caducidad) f.caducidad = x.caducidad;
      f.G += x.anterior * x.dpf;
      f.frascos += x.recibido;
      f.E += x.recibido * x.dpf;
      f.apA += x.apA; f.apB += x.apB;
      const desecho = split ? x.deA / 2 + x.deB : x.deA + x.deB;
      // solo el A.R.F. es accidente en la red de frío; el Canje NO se desecha (se cambia de lote con la misma cantidad)
      if (x.categoria === 'ARF') f.rf += desecho; else f.oper += desecho;
      if (x.final == null) f.finalBiovacConocido = false; else f.finalBiovac += x.final * x.dpf;
      if (x.categoria === 'ARF' && x.final != null) f.arfFinal += x.final * x.dpf;
      if (x.categoria === 'CANJE' && x.final != null) f.canjeFinal += x.final * x.dpf;
    });
    porClave.forEach((lotes, clave) => {
      const split = SPLIT.has(clave);
      lotes.forEach((f, lote) => {
        f.ap = split ? f.apA / 2 + f.apB : f.apA + f.apB;
        if (!split) { f.apA = f.apA + f.apB; f.apB = 0; }
        ['G', 'E', 'frascos', 'apA', 'apB', 'ap', 'oper', 'rf', 'arfFinal', 'canjeFinal'].forEach((k) => { f[k] = r2(f[k]); });
        f.T = r2(f.E + f.G - f.ap - f.oper - f.rf);
        if (f.T < -0.005 && avisos) avisos.push(`${etiqueta || ''} ${clave} lote ${lote}: existencia final negativa (${f.T} dosis).`.trim());
        if (f.finalBiovacConocido && Math.abs(r2(f.finalBiovac) - f.T) > 0.06 && avisos) {
          avisos.push(`${etiqueta || ''} ${clave} lote ${lote}: la existencia final de BIOVAC (${r2(f.finalBiovac)} dosis) no coincide con lo calculado (${f.T}).`.trim());
        }
      });
    });
    return porClave;
  }

  const hayMovimiento = (f) => [f.G, f.E, f.ap, f.oper, f.rf, f.T].some((v) => Math.abs(v) > 0.0001);

  /** meses: { [mes]: renglones[] }  ->  { porClave: Map clave -> { lotes: [..ordenados], meses: Map mes -> Map lote -> fila } , avisos } */
  function armarDatos(meses) {
    const avisos = [];
    const porClave = new Map();
    Object.keys(meses || {}).map(Number).sort((a, b) => a - b).forEach((mes) => {
      consolidarMes(meses[mes], avisos, nombreMes(mes) + ':').forEach((lotes, clave) => {
        if (!porClave.has(clave)) porClave.set(clave, { lotes: new Map(), meses: new Map() });
        const info = porClave.get(clave);
        const filas = new Map();
        lotes.forEach((f, lote) => {
          if (!hayMovimiento(f)) return;
          filas.set(lote, f);
          if (!info.lotes.has(lote)) info.lotes.set(lote, f.caducidad || null);
        });
        info.meses.set(mes, filas);
      });
    });
    porClave.forEach((info) => {
      // orden estable de los lotes en TODA la hoja: caducidad más próxima primero, sin caducidad al final, luego por número
      const orden = [...info.lotes.entries()].sort((a, b) => {
        const ca = a[1] ? String(a[1]) : '9999-99-99', cb = b[1] ? String(b[1]) : '9999-99-99';
        return ca === cb ? a[0].localeCompare(b[0]) : (ca < cb ? -1 : 1);
      }).map((e) => e[0]);
      info.lotes = orden;
    });
    return { porClave, avisos };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 2) PLANTILLA: ubicar bloques y escribir
  // ---------------------------------------------------------------------------------------------------------------

  const txt = (c) => {
    const v = c && c.value;
    if (v == null) return '';
    if (typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result != null ? String(v.result) : (v.text || ''));
    return String(v);
  };

  /** Columnas de la hoja: normal (21 col) o dividida en dos tamaños de dosis (Hep B y Moderna, 24 col). */
  function columnasDe(ws) {
    const encabezado = txt(ws.getCell('H9')) + ' ' + txt(ws.getCell('I9'));
    const dividida = /\bml\b/i.test(encabezado);
    if (dividida) {
      return {
        dividida: true, D: 4, E: 5, F: 6, G: 7, C: 3, A: 1, B: 2,
        ap: (idx) => [8 + idx * 2, 9 + idx * 2], apTot: 14,
        oper: (idx) => 15 + idx, operTot: 18, rf: (idx) => 19 + idx, rfTot: 22, T: 23, obs: 24, ultima: 24
      };
    }
    return {
      dividida: false, D: 4, E: 5, F: 6, G: 7, C: 3, A: 1, B: 2,
      ap: (idx) => [8 + idx], apTot: 11,
      oper: (idx) => 12 + idx, operTot: 15, rf: (idx) => 16 + idx, rfTot: 19, T: 20, obs: 21, ultima: 21
    };
  }

  function detectarBloques(ws) {
    const meses = [], trimTotales = [];
    let cur = null;
    for (let r = 1; r <= ws.rowCount; r++) {
      const t = txt(ws.getCell(r, 1)).trim().toUpperCase();
      const i = MESES.indexOf(t);
      if (i >= 0) { cur = { mes: i + 1, label: r, ini: r + 1, total: null }; meses.push(cur); }
      else if (cur && cur.total == null && (t === 'TOTAL' || (t.startsWith('TOTAL ') && MESES.includes(t.slice(6).trim())))) cur.total = r;   // la hoja de Influenza rotula «TOTAL ENERO»
      else if (/^TOTAL DEL TRIMESTRE/.test(t)) trimTotales.push(r);
    }
    if (meses.length !== 12 || meses.some((m) => !m.total) || trimTotales.length !== 4) {
      throw new Error(`La hoja ${ws.name} no tiene la estructura esperada (12 meses y 4 totales de trimestre).`);
    }
    meses.forEach((m) => { m.capacidad = m.total - m.ini; });
    return { meses, trimTotales };
  }

  /** Inserta `extra` renglones de lote antes del TOTAL del mes, copiando estilo y alto, y reacomoda las celdas combinadas. */
  function ampliarMes(ws, bloque, extra) {
    const posTotal = bloque.total;
    const combinadas = Object.values(ws._merges || {}).map((m) => ({ ...m.model }));
    const abajo = combinadas.filter((m) => m.top >= posTotal);
    abajo.forEach((m) => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
    ws.spliceRows(posTotal, 0, ...Array.from({ length: extra }, () => []));
    const modelo = ws.getRow(posTotal - 1);
    for (let k = 0; k < extra; k++) {
      const nueva = ws.getRow(posTotal + k);
      nueva.height = modelo.height;
      modelo.eachCell({ includeEmpty: true }, (c, col) => { nueva.getCell(col).style = JSON.parse(JSON.stringify(c.style || {})); });
    }
    abajo.forEach((m) => ws.mergeCells(m.top + extra, m.left, m.bottom + extra, m.right));
  }

  const fecha = (s) => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  };

  function setF(ws, fila, col, formula, resultado) {
    ws.getCell(fila, col).value = { formula, result: r2(resultado) };
  }

  /**
   * Llena una hoja de biológico. info = { lotes: [orden], meses: Map mes -> Map lote -> fila } (o undefined si no hay datos).
   * Reescribe las fórmulas de TODA la hoja (renglones, totales por mes y por trimestre).
   */
  function llenarHoja(ws, info, resumen) {
    const K = columnasDe(ws);
    // 1) capacidad: si un mes trae más lotes que renglones, se agregan (de abajo hacia arriba para no mover lo pendiente)
    let bl = detectarBloques(ws);
    const faltan = bl.meses.map((b, i) => {
      const filas = info && info.meses.get(b.mes);
      return { i, extra: Math.max(0, (filas ? filas.size : 0) - b.capacidad) };
    }).filter((x) => x.extra > 0).sort((a, b) => b.i - a.i);
    faltan.forEach(({ i, extra }) => { ampliarMes(ws, bl.meses[i], extra); resumen.renglonesAgregados += extra; bl = detectarBloques(ws); });

    const colsMes = (idx) => {
      const out = {};
      out.ap = K.ap(idx); out.oper = K.oper(idx); out.rf = K.rf(idx);
      return out;
    };
    const apTotales = (f) => f.ap;

    const totMes = {};      // mes -> fila de TOTAL con sus sumas (para el trimestre)
    const trimestres = [1, 2, 3, 4].map(() => ({ meses: [] }));

    bl.meses.forEach((b) => {
      const idx = (b.mes - 1) % 3;
      const q = trimestreDe(b.mes) - 1;
      const filasMes = info && info.meses.get(b.mes);
      const orden = (info ? info.lotes : []).filter((l) => filasMes && filasMes.has(l));
      const suma = { D: 0, E: 0, G: 0, ap: 0, oper: 0, rf: 0, T: 0, apA: 0, apB: 0 };
      const cm = colsMes(idx);
      for (let k = 0; k < b.capacidad; k++) {
        const r = b.ini + k;
        const lote = orden[k];
        const f = lote ? filasMes.get(lote) : null;
        // limpia lo que haya (la plantilla viene vacía; así una hoja ya llena no arrastra datos viejos)
        for (let c = 1; c <= K.ultima; c++) { const cel = ws.getCell(r, c); if (cel.value !== null && cel.value !== undefined) cel.value = null; }
        if (f) {
          ws.getCell(r, K.C).value = lote;
          if (f.frascos) ws.getCell(r, K.D).value = f.frascos;
          if (f.E) ws.getCell(r, K.E).value = f.E;
          const cad = fecha(f.caducidad); if (cad) ws.getCell(r, K.F).value = cad;
          if (f.G) ws.getCell(r, K.G).value = f.G;
          if (K.dividida) {
            if (f.apA) ws.getCell(r, cm.ap[0]).value = f.apA;
            if (f.apB) ws.getCell(r, cm.ap[1]).value = f.apB;
          } else if (f.ap) ws.getCell(r, cm.ap[0]).value = f.ap;
          if (f.oper) ws.getCell(r, cm.oper).value = f.oper;
          if (f.rf) ws.getCell(r, cm.rf).value = f.rf;
          const notas = [];
          if (f.arfFinal > 0.005) notas.push(`A.R.F. en dictamen al cierre: ${f.arfFinal} dosis`);
          if (f.canjeFinal > 0.005) notas.push(`En canje al cierre: ${f.canjeFinal} dosis`);
          if (notas.length) ws.getCell(r, K.obs).value = notas.join(' · ');
        }
        const v = f || { G: 0, E: 0, frascos: 0, apA: 0, apB: 0, ap: 0, oper: 0, rf: 0, T: 0 };
        // fórmulas del renglón (explícitas, con resultado)
        const L = (c) => colL(c) + r;
        setF(ws, r, K.apTot, K.dividida ? `((${L(cm.ap[0])}/2)+(${L(cm.ap[1])}))` : L(cm.ap[0]), apTotales(v));
        setF(ws, r, K.operTot, L(cm.oper), v.oper);
        setF(ws, r, K.rfTot, L(cm.rf), v.rf);
        setF(ws, r, K.T, `${L(K.E)}+${L(K.G)}-${L(K.apTot)}-${L(K.operTot)}-${L(K.rfTot)}`, v.T);
        suma.D += v.frascos; suma.E += v.E; suma.G += v.G; suma.ap += v.ap; suma.oper += v.oper; suma.rf += v.rf; suma.T += v.T; suma.apA += v.apA; suma.apB += v.apB;
      }
      // TOTAL del mes
      const a = b.ini, z = b.total - 1, t = b.total;
      const SUMA = (c) => `SUM(${colL(c)}${a}:${colL(c)}${z})`;
      setF(ws, t, K.D, SUMA(K.D), suma.D);
      setF(ws, t, K.E, SUMA(K.E), suma.E);
      setF(ws, t, K.G, SUMA(K.G), suma.G);
      if (K.dividida) { setF(ws, t, cm.ap[0], SUMA(cm.ap[0]), suma.apA); setF(ws, t, cm.ap[1], SUMA(cm.ap[1]), suma.apB); }
      else setF(ws, t, cm.ap[0], SUMA(cm.ap[0]), suma.ap);
      setF(ws, t, K.apTot, SUMA(K.apTot), suma.ap);
      setF(ws, t, cm.oper, SUMA(cm.oper), suma.oper); setF(ws, t, K.operTot, SUMA(K.operTot), suma.oper);
      setF(ws, t, cm.rf, SUMA(cm.rf), suma.rf); setF(ws, t, K.rfTot, SUMA(K.rfTot), suma.rf);
      setF(ws, t, K.T, SUMA(K.T), suma.T);
      totMes[b.mes] = { fila: t, suma, cm, idx, filasMes, orden, ini: b.ini };
      trimestres[q].meses.push(b.mes);
    });

    // TOTAL DEL TRIMESTRE (acumula los tres meses; la existencia con la que inicia es la de los lotes en su PRIMER aparición del trimestre)
    trimestres.forEach((tr, q) => {
      const filaT = bl.trimTotales[q];
      const ms = tr.meses.map((m) => totMes[m]);
      const refs = (c) => ms.map((m) => `${colL(c)}${m.fila}`);
      const sum = (c, key) => ({ f: `SUM(${refs(c).join(',')})`, v: ms.reduce((s, m) => s + (key ? m.suma[key] : 0), 0) });
      const w = (c, key) => { const x = sum(c, key); setF(ws, filaT, c, x.f, x.v); return x.v; };
      w(K.D, 'D'); w(K.E, 'E');
      // G del trimestre: lo que traían los lotes en el primer mes CON datos. Un canje de lote pasa la misma cantidad del lote viejo al nuevo
      // (el viejo deja de aparecer y el nuevo entra con esa existencia), así que se cancela y no debe sumarse otra vez.
      const base = ms.find((m) => (m.orden || []).length) || ms[0];
      setF(ws, filaT, K.G, `${colL(K.G)}${base.fila}`, base.suma.G);
      const g = base.suma.G;
      let ap = 0;
      ms.forEach((m) => { ap += m.suma.ap; });
      const cmAll = [0, 1, 2].map(colsMes);
      cmAll.forEach((cm, i) => {
        const m = ms[i];
        [cm.ap[0], cm.ap.length > 1 ? cm.ap[1] : null, cm.oper, cm.rf].filter(Boolean).forEach((c) => {
          let v = 0;
          if (c === cm.oper) v = m.suma.oper; else if (c === cm.rf) v = m.suma.rf; else if (c === cm.ap[0]) v = K.dividida ? m.suma.apA : m.suma.ap; else v = m.suma.apB;
          setF(ws, filaT, c, `SUM(${refs(c).join(',')})`, v);
        });
      });
      const op = ms.reduce((s, m) => s + m.suma.oper, 0), rf = ms.reduce((s, m) => s + m.suma.rf, 0);
      const e = ms.reduce((s, m) => s + m.suma.E, 0);
      w(K.apTot, 'ap'); w(K.operTot, 'oper'); w(K.rfTot, 'rf');
      const c = (n) => `${colL(n)}${filaT}`;
      setF(ws, filaT, K.T, `${c(K.E)}+${c(K.G)}-${c(K.apTot)}-${c(K.operTot)}-${c(K.rfTot)}`, e + g - ap - op - rf);
      // control: la existencia del trimestre debe ser la del último mes con datos (si no, hay un salto de existencia entre meses)
      const conDatos = ms.filter((m) => (m.orden || []).length);
      if (conDatos.length && Math.abs(r2(e + g - ap - op - rf) - r2(conDatos[conDatos.length - 1].suma.T)) > 0.06) {
        resumen.avisos.push(`${ws.name.trim()}, ${q + 1}.º trimestre: la existencia al cierre (${r2(e + g - ap - op - rf)}) no coincide con la del último mes (${r2(conDatos[conDatos.length - 1].suma.T)}); revisa los lotes de ese trimestre.`);
      }
    });
    return { K, bloques: bl };
  }

  /** Encabezado, ejercicio y firmas. */
  function llenarEncabezado(ws, { nombre, responsable, supervisor, anio }) {
    // 1) nombre de la unidad (en la plantilla era ÍNDICE!C6 & "  (1)")
    const fila6 = ws.getRow(6);
    fila6.eachCell({ includeEmpty: false }, (c) => {
      const v = c.value;
      if (v && typeof v === 'object' && typeof v.formula === 'string' && /[ÍI]NDICE/i.test(v.formula)) c.value = `${nombre}  (1)`;
    });
    // 2) ejercicio fiscal fijo (la plantilla usaba YEAR(TODAY()))
    const a7 = ws.getCell('A7');
    if (a7.value && typeof a7.value === 'object' && a7.value.formula) a7.value = `EJERCICIO FISCAL ${anio}`;
    // 3) firmas: el nombre va en el renglón en blanco que queda arriba del rótulo
    for (let r = Math.max(1, ws.rowCount - 12); r <= ws.rowCount; r++) {
      ws.getRow(r).eachCell({ includeEmpty: false }, (c) => {
        const t = txt(c).trim();
        const poner = (valor) => {
          if (!valor || r < 2) return;
          const celda = ws.getCell(r - 1, c.col);
          celda.value = valor;
          celda.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };
          celda.font = Object.assign({}, celda.font || {}, { size: 14, bold: true, name: (c.font && c.font.name) || 'Arial' });
        };
        if (/^Supervisor municipal/i.test(t)) poner(supervisor);
        else if (/^Responsable de Vacunaci/i.test(t)) poner(responsable);
      });
    }
  }

  function quitarHojasAuxiliares(wb) {
    HOJAS_QUITAR.forEach((n) => { const w = wb.getWorksheet(n); if (w) wb.removeWorksheet(w.id); });
    // nombres definidos que apuntaran a hojas quitadas
    try { if (wb.definedNames && wb.definedNames.model) wb.definedNames.model = []; } catch (e) { /* sin nombres definidos */ }
  }

  function ajustarVista(wb) {
    const primera = wb.worksheets.find((w) => w.state === 'visible') || wb.worksheets[0];
    wb.worksheets.forEach((w) => { w.state = 'visible'; });
    wb.views = [{ x: 0, y: 0, width: 28800, height: 17000, firstSheet: 0, activeTab: Math.max(0, wb.worksheets.indexOf(primera)), visibility: 'visible' }];
    wb.worksheets.forEach((w) => { (w.views || []).forEach((v) => { v.tabSelected = (w === primera); }); });
  }

  const sinAcentos = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

  /**
   * Arma el libro de UNA unidad o de un municipio (consolidado).
   *   wb: libro ya cargado de la plantilla · meses: { mes: renglones normalizados[] }
   */
  function construirLibro({ wb, nombre, meses, responsable, supervisor, anio }) {
    if (Number(anio || ANIO_PLANTILLA) !== ANIO_PLANTILLA) throw new Error(`La plantilla de conciliación es de ${ANIO_PLANTILLA}.`);
    const { porClave, avisos } = armarDatos(meses);
    quitarHojasAuxiliares(wb);
    const resumen = { hojasConDatos: [], sinHoja: [], avisos, renglonesAgregados: 0, meses: Object.keys(meses || {}).map(Number).sort((a, b) => a - b) };
    const hojaPorNombre = new Map(wb.worksheets.map((w) => [w.name.trim(), w]));
    porClave.forEach((info, clave) => {
      if (!HOJA_DE[clave] || !hojaPorNombre.has(HOJA_DE[clave])) resumen.sinHoja.push(clave);
    });
    Object.entries(HOJA_DE).forEach(([clave, hoja]) => {
      const ws = hojaPorNombre.get(hoja);
      if (!ws) return;
      const info = porClave.get(clave) || null;
      llenarHoja(ws, info, resumen);
      llenarEncabezado(ws, { nombre, responsable, supervisor, anio: ANIO_PLANTILLA });
      if (info && info.meses.size) resumen.hojasConDatos.push(hoja);
    });
    ajustarVista(wb);
    wb.calcProperties = Object.assign(wb.calcProperties || {}, { fullCalcOnLoad: true });
    return { wb, resumen };
  }

  const nombreArchivoDe = (nombre, mesHasta) => `CONCILIACION_BIOLOGICO_${ANIO_PLANTILLA}_${sinAcentos(nombre).replace(/\s/g, '_')}_hasta_${nombreMes(mesHasta)}.xlsx`;

  // ---------------------------------------------------------------------------------------------------------------
  // 3) DATOS: BIOVAC -> renglones normalizados (navegador)
  // ---------------------------------------------------------------------------------------------------------------

  async function traerTodo(armar) {
    const todo = [];
    for (let desde = 0; ; desde += 1000) {
      const q = armar();
      const paginable = q && typeof q.range === 'function';
      const { data, error } = await (paginable ? q.range(desde, desde + 999) : q);
      if (error) throw error;
      const filas = data || [];
      todo.push(...filas);
      if (!paginable || filas.length < 1000) break;
    }
    return todo;
  }

  async function cargarCatalogo(db) {
    const filas = await traerTodo(() => db.from('biovac_catalogo_biologicos').select('id, clave, dosis_por_frasco').order('id'));
    return new Map(filas.map((c) => [c.id, c]));
  }

  /** Unidades que cuentan para un municipio desde octubre de 2026: las reales; si no hubiera, la fila JS1- del municipio. */
  function unidadesDelMunicipio(todas, municipio) {
    const mismas = (todas || []).filter((u) => u.activo !== false && u.municipio === municipio);
    const reales = mismas.filter((u) => !String(u.clues || '').startsWith('JS1-'));
    return reales.length ? reales : mismas;
  }

  /**
   * Trae, de octubre a `mesHasta`, los renglones de las unidades dadas. Devuelve { meses, estados, responsables }.
   *   meses: { mes: renglones[] } · estados: { mes: {cerrados, abiertos} } · responsables: Map unidadId -> último responsable
   */
  async function cargarMeses({ db, unidades, anio, mesHasta, catalogo }) {
    const ids = unidades.map((u) => u.id);
    const meses = {}, estados = {}, responsables = new Map(), porUnidad = new Map();
    for (let m = MES_INICIO; m <= mesHasta; m++) { meses[m] = []; estados[m] = { cerrados: 0, abiertos: 0 }; }
    if (!ids.length || mesHasta < MES_INICIO) return { meses, estados, responsables, porUnidad };
    const movs = [];
    for (let i = 0; i < ids.length; i += 60) {
      const parte = await traerTodo(() => db.from('biovac_movimientos')
        .select('id, unidad_id, mes, estado, responsable_elaboracion')
        .in('unidad_id', ids.slice(i, i + 60)).eq('anio', anio).gte('mes', MES_INICIO).lte('mes', mesHasta).order('id'));
      movs.push(...parte);
    }
    const mesDe = new Map(movs.map((m) => [m.id, m.mes]));
    const unidadDe = new Map(movs.map((m) => [m.id, m.unidad_id]));
    movs.forEach((m) => {
      if (m.estado === 'CERRADO') estados[m.mes].cerrados++; else estados[m.mes].abiertos++;
      if (m.responsable_elaboracion) responsables.set(m.unidad_id, m.responsable_elaboracion);
    });
    const movIds = movs.map((m) => m.id);
    for (let i = 0; i < movIds.length; i += 40) {
      const rens = await traerTodo(() => db.from('biovac_renglones')
        .select('id, movimiento_id, categoria, existencia_anterior_frascos, recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b, existencia_final_frascos, biovac_lotes ( numero_lote, caducidad, dosis_por_frasco_override, biologico_id )')
        .in('movimiento_id', movIds.slice(i, i + 40)).order('id'));
      rens.forEach((r) => {
        const n = normalizarRenglonDb(r, catalogo);
        if (!n) return;
        const mes = mesDe.get(r.movimiento_id), uid = unidadDe.get(r.movimiento_id);
        meses[mes].push(n);
        if (!porUnidad.has(uid)) porUnidad.set(uid, {});
        const pu = porUnidad.get(uid); (pu[mes] = pu[mes] || []).push(n);
      });
    }
    return { meses, estados, responsables, porUnidad };
  }

  async function cargarPlantilla() {
    if (!root.ExcelJS && typeof root.ensureLibsLoaded === 'function') {
      try { await root.ensureLibsLoaded('exceljs'); } catch (e) { console.warn('[Conciliación] exceljs no cargó:', e); }
    }
    if (!root.ExcelJS) throw new Error('No cargó la librería de Excel. Revisa tu conexión e inténtalo de nuevo.');
    const resp = await fetch(PLANTILLA_URL);
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla (Formatos/conciliacion_biologico_plantilla.xlsx).');
    const buf = await resp.arrayBuffer();
    return () => { const wb = new root.ExcelJS.Workbook(); return wb.xlsx.load(buf).then(() => wb); };
  }

  /** Avisos de calidad previos a descargar (meses sin cerrar, sin datos). */
  function avisosDeMeses(estados, mesHasta) {
    const out = [];
    for (let m = MES_INICIO; m <= mesHasta; m++) {
      const e = estados[m] || { cerrados: 0, abiertos: 0 };
      if (e.abiertos) out.push(`${nombreMes(m)}: ${e.abiertos} movimiento(s) sin cerrar`);
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 4) EXPORTACIONES (unidad · municipio consolidado · masivo)
  // ---------------------------------------------------------------------------------------------------------------

  /**
   * ámbito: 'unidad' (unidades=[u]) · 'municipio' (unidades = todas las del municipio, se suman).
   * Devuelve { buffer, nombreArchivo, resumen, avisosMeses }.
   */
  async function armarLibroDesde({ abrirPlantilla, etiqueta, meses, estados, responsable, supervisor, anio, mesHasta }) {
    const wb = await abrirPlantilla();
    const { resumen } = construirLibro({ wb, nombre: etiqueta, meses, responsable: responsable || '', supervisor: supervisor || '', anio });
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer, nombreArchivo: nombreArchivoDe(etiqueta, mesHasta), resumen, avisosMeses: avisosDeMeses(estados, mesHasta) };
  }

  async function exportarLibro({ db, abrirPlantilla, catalogo, unidades, etiqueta, anio, mesHasta, supervisor, responsable }) {
    const { meses, estados, responsables } = await cargarMeses({ db, unidades, anio, mesHasta, catalogo });
    const resp = responsable || (unidades.length === 1 ? (responsables.get(unidades[0].id) || '') : '');
    return armarLibroDesde({ abrirPlantilla, etiqueta, meses, estados, responsable: resp, supervisor, anio, mesHasta });
  }

  /**
   * Un libro por unidad (solo las que tienen movimiento desde octubre), dentro de un ZIP. Los datos se leen UNA vez para todas.
   * Devuelve { blob, nombreArchivo, unidades: [{nombre, archivo}], sinDatos: [nombre], avisos }.
   */
  async function exportarMasivo({ db, abrirPlantilla, catalogo, unidades, etiqueta, anio, mesHasta, supervisor, JSZipLib, alProgreso }) {
    const Z = JSZipLib || root.JSZip;
    if (!Z) throw new Error('No cargó la librería para armar el ZIP.');
    const { estados, responsables, porUnidad } = await cargarMeses({ db, unidades, anio, mesHasta, catalogo });
    const zip = new Z();
    const salida = { unidades: [], sinDatos: [], avisos: [], avisosMeses: avisosDeMeses(estados, mesHasta) };
    const usados = new Set();
    const lista = unidades.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    for (let i = 0; i < lista.length; i++) {
      const u = lista[i];
      const datos = porUnidad.get(u.id);
      if (!datos || !Object.values(datos).some((a) => a.length)) { salida.sinDatos.push(u.nombre); continue; }
      if (alProgreso) alProgreso(i + 1, lista.length, u.nombre);
      const meses = {};
      for (let m = MES_INICIO; m <= mesHasta; m++) meses[m] = datos[m] || [];
      const r = await armarLibroDesde({ abrirPlantilla, etiqueta: u.nombre, meses, estados: {}, responsable: responsables.get(u.id) || '', supervisor, anio, mesHasta });
      let archivo = `${sinAcentos(u.clues || '')}_${r.nombreArchivo}`.replace(/^_/, '');
      while (usados.has(archivo)) archivo = '2_' + archivo;
      usados.add(archivo);
      zip.file(archivo, r.buffer);
      salida.unidades.push({ nombre: u.nombre, archivo });
      r.resumen.avisos.forEach((a) => salida.avisos.push(`${u.nombre}: ${a}`));
    }
    if (!salida.unidades.length) throw new Error('Ninguna unidad tiene Movimiento de Biológico en el periodo.');
    salida.blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    salida.nombreArchivo = `CONCILIACION_BIOLOGICO_${ANIO_PLANTILLA}_${sinAcentos(etiqueta).replace(/\s/g, '_')}_unidades_hasta_${nombreMes(mesHasta)}.zip`;
    return salida;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 5) INTERFAZ: botón en el paso 3 «Descarga tus archivos» del Concentrado (municipal_guiado.js), tarjeta en el Concentrado Jurisdiccional (paso 4) + ventana
  // ---------------------------------------------------------------------------------------------------------------
  const interfaz = (function () {
    const hayDom = typeof document !== 'undefined';
    const est = () => (typeof estado !== 'undefined' ? estado : (root.estado || null));
    const rolActual = () => { const e = est(); return (e && e.perfil && e.perfil.rol) || null; };
    const puede = () => ['UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN'].includes(rolActual());
    const MUNICIPIOS = { QUERETARO: 'Querétaro', HUIMILPAN: 'Huimilpan', MARQUES: 'El Marqués', CORREGIDORA: 'Corregidora', NHG: 'Nuevo Hospital General', HENM: 'Hospital del Niño y la Mujer' };
    const nombreMunicipio = (m) => MUNICIPIOS[m] || String(m || '');
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const aviso = (t, tipo) => { if (typeof root.toast === 'function') root.toast(t, tipo); else console.log('[Conciliación]', t); };
    let ocupado = false, abierta = null;

    function mesPorDefecto() {
      const sel = Number((document.getElementById('selMes') || {}).value);
      const anio = Number((document.getElementById('selAnio') || {}).value);
      if (anio === ANIO_PLANTILLA && sel >= MES_INICIO) return sel;
      const hoy = new Date();
      if (hoy.getFullYear() === ANIO_PLANTILLA) return Math.min(12, Math.max(MES_INICIO, hoy.getMonth() + 1));
      return 12;
    }

    function descargarBlob(blob, nombre) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function cargarJSZip() {
      if (root.JSZip) return root.JSZip;
      await new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = ok; s.onerror = () => mal(new Error('No cargó la librería del ZIP. Revisa tu conexión.'));
        document.head.appendChild(s);
      });
      return root.JSZip;
    }

    function estilos() {
      if (document.getElementById('concEstilos')) return;
      const st = document.createElement('style');
      st.id = 'concEstilos';
      st.textContent = `
      .conc-fondo{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9000;padding:16px}
      .conc-ventana{background:var(--surface,#fff);color:var(--text,#0f172a);border-radius:20px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px 24px;box-shadow:0 18px 50px rgba(15,23,42,.28)}
      .conc-ventana h2{margin:0 0 4px;font-size:18px}
      .conc-ventana p{margin:0 0 14px;font-size:13px;color:var(--muted,#475569);line-height:1.5}
      .conc-ventana fieldset{border:1px solid var(--outline-variant,#cbd5e1);border-radius:14px;margin:0 0 12px;padding:10px 14px}
      .conc-ventana legend{font-size:12px;font-weight:700;padding:0 6px}
      .conc-opcion{display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:13.5px}
      .conc-opcion small{display:block;color:var(--muted,#475569);font-size:12px}
      .conc-campo{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;font-size:12.5px;font-weight:700}
      .conc-campo select{font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid var(--outline-variant,#cbd5e1);background:var(--surface,#fff);color:inherit}
      .conc-estado{min-height:18px;font-size:12.5px;font-weight:600;color:var(--muted,#475569);margin:4px 0 10px}
      .conc-acciones{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}`;
      document.head.appendChild(st);
    }

    async function unidadesVisibles(db) {
      const filas = await traerTodo(() => db.from('biovac_unidades').select('id, nombre, clues, municipio, activo').eq('activo', true).order('nombre'));
      const e = est();
      const rol = rolActual();
      if (rol === 'UNIDAD' && e.perfil && e.perfil.clues) return filas.filter((u) => u.clues === e.perfil.clues);
      return filas;
    }

    async function abrirVentana(origen, opciones) {
      opciones = opciones || {};
      if (abierta || !hayDom) return;
      const e = est();
      const db = e && e.db;
      if (!db) { aviso('Aún no hay conexión con la base. Intenta de nuevo.', 'error'); return; }
      estilos();
      const rol = rolActual();
      let todas = [];
      try { todas = await unidadesVisibles(db); } catch (err) { aviso('No se pudieron leer las unidades: ' + (err.message || err), 'error'); return; }
      const reales = todas.filter((u) => !String(u.clues || '').startsWith('JS1-'));
      const porMunicipio = new Map();
      reales.forEach((u) => { if (!porMunicipio.has(u.municipio)) porMunicipio.set(u.municipio, []); porMunicipio.get(u.municipio).push(u); });
      const municipios = [...porMunicipio.keys()].sort((a, b) => nombreMunicipio(a).localeCompare(nombreMunicipio(b), 'es'));
      if (!reales.length) { aviso('No hay unidades con Movimiento para exportar.', 'warn'); return; }
      const soloUnidad = rol === 'UNIDAD' || reales.length === 1;
      const mes0 = opciones.mes >= MES_INICIO ? Number(opciones.mes) : mesPorDefecto();

      const fondo = document.createElement('div');
      fondo.className = 'conc-fondo';
      fondo.innerHTML = `
        <div class="conc-ventana" role="dialog" aria-modal="true" aria-labelledby="concTitulo">
          <h2 id="concTitulo">Conciliación de biológico ${ANIO_PLANTILLA}</h2>
          <p>Formato trimestral por lote, en dosis, acumulado del año. Sale de lo capturado en el Movimiento de Biológico (desde octubre de ${ANIO_PLANTILLA}); los meses anteriores quedan vacíos para pegar lo que ya entregaste.</p>
          <label class="conc-campo">Acumulado hasta
            <select id="concMes">${MESES.map((n, i) => (i + 1 >= MES_INICIO ? `<option value="${i + 1}"${i + 1 === mes0 ? ' selected' : ''}>${n[0] + n.slice(1).toLowerCase()} ${ANIO_PLANTILLA}</option>` : '')).join('')}</select>
          </label>
          ${soloUnidad ? '' : `
          <fieldset><legend>¿Qué quieres descargar?</legend>
            <label class="conc-opcion"><input type="radio" name="concAmbito" value="unidad" checked><span>Una unidad<small>Un libro con su conciliación.</small></span></label>
            <label class="conc-opcion"><input type="radio" name="concAmbito" value="municipio"><span>Municipio completo<small>Un libro con la suma de todas sus unidades.</small></span></label>
            <label class="conc-opcion"><input type="radio" name="concAmbito" value="masivo"><span>Un libro por unidad<small>Un ZIP con el libro de cada unidad del municipio.</small></span></label>
          </fieldset>
          <label class="conc-campo" id="concCampoMun">Municipio
            <select id="concMun">${municipios.map((m) => `<option value="${esc(m)}">${esc(nombreMunicipio(m))}</option>`).join('')}</select>
          </label>
          <label class="conc-campo" id="concCampoUni">Unidad
            <select id="concUni"></select>
          </label>`}
          <div class="conc-estado" id="concEstado" role="status" aria-live="polite"></div>
          <div class="conc-acciones">
            <button type="button" class="btn-fantasma btn-mini" id="concCerrar">Cerrar</button>
            <button type="button" class="btn-primario btn-mini" id="concDescargar"><span class="material-symbols-rounded" aria-hidden="true">download</span> Descargar</button>
          </div>
        </div>`;
      document.body.appendChild(fondo);
      abierta = { fondo, origen };
      const $ = (id) => fondo.querySelector('#' + id);
      const estadoEl = $('concEstado');
      const poner = (t) => { estadoEl.textContent = t || ''; };

      const llenarUnidades = () => {
        const sel = $('concUni'); if (!sel) return;
        const lista = (porMunicipio.get($('concMun').value) || []).slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
        sel.innerHTML = lista.map((u) => `<option value="${esc(u.id)}">${esc(u.nombre)} (${esc(u.clues)})</option>`).join('');
      };
      const ambito = () => (soloUnidad ? 'unidad' : (fondo.querySelector('input[name="concAmbito"]:checked') || {}).value);
      const refrescar = () => {
        if (soloUnidad) return;
        const a = ambito();
        $('concCampoUni').style.display = a === 'unidad' ? '' : 'none';
      };
      if (!soloUnidad) {
        if (opciones.municipio && porMunicipio.has(opciones.municipio)) {
          $('concMun').value = opciones.municipio;
          const rm = fondo.querySelector('input[name="concAmbito"][value="municipio"]'); if (rm) rm.checked = true;
        }
        llenarUnidades(); refrescar();
        $('concMun').addEventListener('change', llenarUnidades);
        fondo.querySelectorAll('input[name="concAmbito"]').forEach((r) => r.addEventListener('change', refrescar));
      }

      const cerrar = () => {
        if (ocupado) return;
        document.removeEventListener('keydown', teclas, true);
        fondo.remove(); abierta = null;
        if (origen && origen.focus && document.contains(origen)) origen.focus();
      };
      const teclas = (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); cerrar(); return; }
        if (ev.key !== 'Tab') return;
        const f = [...fondo.querySelectorAll('button:not([disabled]), select, input')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const ini = f[0], fin = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === ini) { ev.preventDefault(); fin.focus(); }
        else if (!ev.shiftKey && document.activeElement === fin) { ev.preventDefault(); ini.focus(); }
      };
      document.addEventListener('keydown', teclas, true);
      fondo.addEventListener('mousedown', (ev) => { if (ev.target === fondo) cerrar(); });
      $('concCerrar').addEventListener('click', cerrar);
      (fondo.querySelector('select') || $('concDescargar')).focus();

      $('concDescargar').addEventListener('click', async () => {
        if (ocupado) return;
        ocupado = true;
        const btn = $('concDescargar'); btn.disabled = true; $('concCerrar').disabled = true;
        try {
          const mesHasta = Number($('concMes').value);
          const a = ambito();
          const sup = (rol === 'MUNICIPAL' && typeof root.nombrePersonaDe === 'function') ? (root.nombrePersonaDe(e.perfil) || '') : '';
          poner('Leyendo el Movimiento de Biológico…');
          const [catalogo, abrirPlantilla] = await Promise.all([cargarCatalogo(db), cargarPlantilla()]);
          let unidades, etiqueta;
          if (a === 'unidad') {
            const id = soloUnidad ? reales[0].id : $('concUni').value;
            const u = reales.find((x) => x.id === id);
            unidades = [u]; etiqueta = u.nombre;
          } else {
            const mun = $('concMun').value;
            unidades = unidadesDelMunicipio(todas, mun);
            etiqueta = a === 'municipio' ? `MUNICIPIO DE ${nombreMunicipio(mun).toUpperCase()}` : nombreMunicipio(mun);
          }
          const base = { db, abrirPlantilla, catalogo, unidades, etiqueta, anio: ANIO_PLANTILLA, mesHasta, supervisor: sup };
          let avisos = [], exito = '';
          if (a === 'masivo') {
            const JSZipLib = await cargarJSZip();
            const r = await exportarMasivo({ ...base, JSZipLib, alProgreso: (i, n, nombre) => poner(`Armando ${i} de ${n}: ${nombre}…`) });
            descargarBlob(r.blob, r.nombreArchivo);
            avisos = [...r.avisosMeses, ...r.avisos];
            poner('');
            exito = `Conciliación lista: ${r.unidades.length} unidades en el ZIP${r.sinDatos.length ? ` (${r.sinDatos.length} sin Movimiento)` : ''}.`;
          } else {
            poner('Armando el Excel sobre el formato oficial…');
            const r = await exportarLibro(base);
            descargarBlob(new Blob([r.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), r.nombreArchivo);
            avisos = [...r.avisosMeses, ...r.resumen.avisos];
            poner('');
            exito = 'Conciliación lista: el Excel se descargó.';
          }
          if (avisos.length) console.warn('[Conciliación] Avisos:', avisos);
          // la ventana se cierra al terminar; lo que haya que revisar queda en el aviso (corto) y en la consola
          ocupado = false;
          cerrar();
          if (avisos.length) aviso(`${exito} Hay ${avisos.length} aviso(s) por revisar: ${avisos[0].slice(0, 110)}${avisos[0].length > 110 ? '…' : ''}`, 'warn');
          else aviso(exito, 'ok');
        } catch (err) {
          console.error('[Conciliación] Error al exportar:', err);
          poner(err.message || 'No se pudo generar la conciliación.');
          aviso(err.message || 'No se pudo generar la conciliación.', 'error');
        } finally {
          ocupado = false; btn.disabled = false; $('concCerrar').disabled = false;
        }
      });
    }

    // Tarjeta del Concentrado Jurisdiccional (paso 4, junto al Excel oficial y PARALELOS).
    function pintarTarjeta() {
      const lista = document.querySelector('#panelPaso4 .jur-entregables');
      if (!lista || !puede()) return false;
      if (document.getElementById('conciliacionBiologicoCard')) return true;
      const c = document.createElement('div');
      c.id = 'conciliacionBiologicoCard'; c.className = 'jur-entregable';
      c.innerHTML = `<b>Conciliación de biológico ${ANIO_PLANTILLA}</b>
        <small>Formato trimestral por lote y en dosis, acumulado del año: por unidad, por municipio (suma de sus unidades) o un ZIP con un libro por unidad.</small>
        <div class="jur-ent-acciones"><button type="button" class="btn-secundario btn-mini" id="btnConciliacionCard"><span class="material-symbols-rounded" aria-hidden="true">inventory_2</span> Descargar conciliación</button></div>`;
      lista.appendChild(c);
      c.querySelector('button').addEventListener('click', (ev) => abrirVentana(ev.currentTarget));
      return true;
    }

    function pintar() {
      if (!hayDom) return;
      pintarTarjeta();
    }

    return { pintar, abrirVentana };
  })();

  return {
    ANIO_PLANTILLA, MES_INICIO, MESES, HOJA_DE, SPLIT, PLANTILLA_URL,
    normalizarRenglonDb, consolidarMes, armarDatos, columnasDe, detectarBloques, llenarHoja, llenarEncabezado,
    construirLibro, cargarCatalogo, cargarMeses, cargarPlantilla, unidadesDelMunicipio, exportarLibro, exportarMasivo, armarLibroDesde,
    avisosDeMeses, nombreArchivoDe, sinAcentos, pintar: () => interfaz.pintar(), abrirVentana: (origen, opciones) => interfaz.abrirVentana(origen, opciones), interfaz
  };
});
