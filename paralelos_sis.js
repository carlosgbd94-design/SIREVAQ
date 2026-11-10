/**
 * SIS / SINBA -- "PARALELOS 2026" (Informe mensual de actividades de la Jurisdicción, SINBA-SIS).
 *
 * Solo JURISDICCIONAL y ADMIN. Arma el libro oficial sobre la plantilla real (Formatos/paralelos_2026_plantilla.xlsx,
 * 12 hojas de mes + TOTAL) con lo que ya está VALIDADO en el SINBA-SIS de los 4 municipios y los 2 hospitales:
 *
 *   columnas de la plantilla (fila 11):  H QUERÉTARO · I HUIMILPAN · J MARQUÉS · K CORREGIDORA · M HGQ (NHG) · N HENM
 *   filas: se ubican por la CLAVE de la columna B (VBC01, VHB01...), la misma clave del catálogo sis_variables y del CSV
 *          oficial (sis_filas_csv). L, O y los renglones TOTAL son fórmulas de la plantilla: no se tocan (solo se les
 *          deja el resultado a la vista para visores que no recalculan).
 *
 * Dos modos, a elección de quien exporta:
 *   - «mes»: un libro con UNA hoja (el mes elegido).
 *   - «acumulado»: el libro completo (enero a diciembre + TOTAL). Los meses con SIS por unidad (desde octubre de 2026)
 *     se llenan desde la base; enero a septiembre se quedan como ya vienen en la plantilla.
 *
 * Particularidades de la plantilla (verificadas contra el catálogo):
 *   - Las filas de Tdpa Afroamericanos/Indígenas (365-368) traen la clave VPD52..VPD55 (copiada de DPT); la clave SIS
 *     real es VDP52..VDP55. Se mapean por posición y se corrige la clave escrita en la hoja.
 *   - L32/O32 (TOTAL BCG) sumaban hasta la fila 18 (incluía migrantes); se igualan al rango de H32 (12:16).
 *   - Influenza (BIE.., BIO96/97): el bloque vive en la hoja base de la plantilla; las hojas de mes que no lo traen lo reciben copiado.
 *   - Las hojas de la plantilla vienen ocultas: el libro exportado deja visible lo que corresponde y la pestaña activa válida.
 *   - TOTAL (acumulado) suma cada CLAVE en la fila/columna real de cada hoja (no por número de fila).
 */
(function () {
  const ANIO_PLANTILLA = 2026;
  const MES_INICIO_SIS = 10;               // el SIS por unidad arranca en octubre de 2026
  const PLANTILLA_URL = './Formatos/paralelos_2026_plantilla.xlsx';
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const NOMBRE_HOJA_SEP = 'MES';           // en la plantilla la hoja de septiembre se quedó llamada "MES"
  // Municipio/hospital de la base -> nombre del encabezado de la plantilla (fila 11, sin acentos ni espacios sobrantes)
  const DESTINOS = [
    { muni: 'QUERETARO', encabezado: 'QUERETARO', etiqueta: 'Querétaro' },
    { muni: 'HUIMILPAN', encabezado: 'HUIMILPAN', etiqueta: 'Huimilpan' },
    { muni: 'MARQUES', encabezado: 'MARQUES', etiqueta: 'El Marqués' },
    { muni: 'CORREGIDORA', encabezado: 'CORREGIDORA', etiqueta: 'Corregidora' },
    { muni: 'NHG', encabezado: 'HGQ', etiqueta: 'Nuevo Hospital General' },
    { muni: 'HENM', encabezado: 'HENM', etiqueta: 'Hospital del Niño y la Mujer' }
  ];
  const FILA_ENCABEZADO = 11, FILA_INI = 12;
  const COLS_SUMA = [8, 9, 10, 11, 12, 13, 14, 15];   // H..O

  const sinAcentos = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const colLetra = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const colNum = (L) => L.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
  const nombreMes = (m) => MESES[Number(m) - 1] || String(m);

  function textoCelda(v) {
    if (v == null) return '';
    if (typeof v === 'object') return v.richText ? v.richText.map((x) => x.text).join('') : (v.result != null ? String(v.result) : (v.text || ''));
    return String(v);
  }
  function valorCelda(c) {
    const v = c.value;
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object') return num(v.result);
    return num(v);
  }

  // clave de la columna B -> fila. Una clave repetida (Tdpa Afro/Indígena traen VPD5x de DPT) se resuelve por
  // posición: la 2.ª aparición es la clave SIS real VDP5x.
  function filasPorClave(ws) {
    const mapa = new Map(), corregidas = [];
    for (let r = FILA_INI; r <= ws.rowCount; r++) {
      let k = sinAcentos(textoCelda(ws.getCell(r, 2).value));
      if (!/^[A-Z]{2,3}\d{2,3}$/.test(k)) continue;
      if (mapa.has(k)) {
        const alias = k.replace(/^VPD/, 'VDP');
        if (alias !== k && !mapa.has(alias)) { corregidas.push({ fila: r, de: k, a: alias }); k = alias; } else continue;
      }
      mapa.set(k, r);
    }
    return { mapa, corregidas };
  }

  // columna de cada destino según el encabezado real de la hoja (fila 11)
  function columnasDestino(ws) {
    const out = {};
    for (let c = 1; c <= 16; c++) {
      const t = sinAcentos(textoCelda(ws.getCell(FILA_ENCABEZADO, c).value));
      const d = DESTINOS.find((x) => x.encabezado === t);
      if (d) out[d.muni] = c;
    }
    return out;
  }

  // Llena una hoja de mes. sumas: Map(muni -> Map(clave -> valor)). Devuelve claves con dato que la hoja no tiene.
  function llenarHojaMes(ws, sumas, mesNombre, anio) {
    const { mapa, corregidas } = filasPorClave(ws);
    corregidas.forEach((c) => { ws.getCell(c.fila, 2).value = c.a; });
    const cols = columnasDestino(ws);
    const sinFila = new Set();
    let celdas = 0;
    sumas.forEach((claves, muni) => {
      const col = cols[muni];
      claves.forEach((valor, clave) => {
        const r = mapa.get(clave);
        if (!r || !col) { if (valor && !r) sinFila.add(clave); return; }
        if (!valor) return;                       // los ceros se dejan en blanco, como la plantilla
        ws.getCell(r, col).value = Math.round(valor);
        celdas++;
      });
    });
    if (mesNombre) ws.getCell('I7').value = mesNombre;
    ws.getCell('M7').value = new Date(Date.UTC(anio, 0, 1));
    return { celdas, sinFila: [...sinFila].sort() };
  }

  // L/O de los renglones TOTAL con el mismo rango de H (la plantilla traía L32/O32 hasta la fila 18)
  function igualarTotales(ws) {
    for (let r = FILA_INI; r <= ws.rowCount; r++) {
      const f = ws.getCell(r, 8).formula || null;
      const m = f && /^SUM\(H(\d+):H(\d+)\)$/.exec(f);
      if (!m) continue;
      [12, 15].forEach((c) => {
        const L = colLetra(c), cur = ws.getCell(r, c).formula;
        if (cur && /^SUM\([LO]\d+:[LO]\d+\)$/.test(cur)) {
          ws.getCell(r, c).value = { formula: `SUM(${L}${m[1]}:${L}${m[2]})` };
        }
      });
    }
  }

  // Deja a la vista el resultado de las fórmulas simples (SUM de rango en la hoja o SUM(ENERO:DICIEMBRE!X#)): Excel
  // recalcula al abrir, pero otros visores muestran el valor guardado.
  function calcularResultados(wb) {
    const orden = wb.worksheets.map((w) => w.name);
    const leer = (ws, c, r) => valorCelda(ws.getCell(r, c));
    const evaluar = (ws, f) => {
      let m = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/.exec(f);
      if (m) {
        let t = 0; const c1 = colNum(m[1]), c2 = colNum(m[3]);
        for (let r = Number(m[2]); r <= Number(m[4]); r++) for (let c = c1; c <= c2; c++) t += leer(ws, c, r);
        return t;
      }
      m = /^SUM\('?([^':!]+)'?:'?([^':!]+)'?!([A-Z]+)(\d+)\)$/.exec(f);
      if (m) {
        const i = orden.indexOf(m[1]), j = orden.indexOf(m[2]);
        if (i < 0 || j < 0) return null;
        let t = 0;
        for (let k = Math.min(i, j); k <= Math.max(i, j); k++) t += leer(wb.worksheets[k], colNum(m[3]), Number(m[4]));
        return t;
      }
      return null;
    };
    // hojas de mes primero y TOTAL al final (depende de ellas)
    const hojas = wb.worksheets.slice().sort((a, b) => (a.name === 'TOTAL') - (b.name === 'TOTAL'));
    hojas.forEach((ws) => {
      for (let r = FILA_INI; r <= ws.rowCount; r++) {
        COLS_SUMA.forEach((c) => {
          const cell = ws.getCell(r, c), f = cell.formula;
          if (!f) return;
          const res = evaluar(ws, f);
          if (res !== null) cell.value = { formula: f, result: Math.round(res * 100) / 100 };
        });
      }
    });
  }


  // ---- Influenza -----------------------------------------------------------------------------------------------
  // La plantilla trae el bloque de Influenza (BIE.., BIO96/97, TOTAL INFLUENZA) en la hoja base (MES/SEPTIEMBRE); las hojas
  // de mes que no lo tengan lo reciben copiado de ahí (valores, formato, combinadas) y se les ponen las sumas L/O.
  const BLOQUE_INF = { ini: 404, fin: 451 };
  const tieneInfluenza = (ws) => filasPorClave(ws).mapa.has('BIE01');

  function completarBloqueInfluenza(ws) {
    const { mapa } = filasPorClave(ws);
    const filasClave = [...mapa.entries()].filter(([k, r]) => /^BI[EO]/.test(k) && r >= BLOQUE_INF.ini).map(([, r]) => r);
    if (!filasClave.length) return;
    filasClave.forEach((r) => {
      if (!ws.getCell(r, 12).formula) ws.getCell(r, 12).value = { formula: `SUM(H${r}:K${r})` };
      if (!ws.getCell(r, 15).formula) ws.getCell(r, 15).value = { formula: `SUM(L${r}:N${r})` };
    });
    const ini = Math.min(...filasClave), fin = Math.max(...filasClave);
    for (let r = fin + 1; r <= fin + 2; r++) {
      if (!/^TOTAL INFLUENZA/i.test(sinAcentos(textoCelda(ws.getCell(r, 1).value)))) continue;
      [8, 9, 10, 11, 12, 13, 14, 15].forEach((c) => {
        if (!ws.getCell(r, c).formula) ws.getCell(r, c).value = { formula: `SUM(${colLetra(c)}${ini}:${colLetra(c)}${fin})` };
      });
    }
  }

  function copiarBloqueInfluenza(origen, destino) {
    for (let r = BLOQUE_INF.ini; r <= BLOQUE_INF.fin; r++) {
      const ro = origen.getRow(r), rd = destino.getRow(r);
      if (ro.height) rd.height = ro.height;
      for (let c = 1; c <= 16; c++) {
        const co = ro.getCell(c), cd = rd.getCell(c);
        cd.value = co.value && typeof co.value === 'object' && co.value.formula ? { formula: co.formula } : co.value;
        if (co.style) cd.style = JSON.parse(JSON.stringify(co.style));
      }
    }
    (origen.model.merges || []).forEach((m) => {
      const f = /^[A-Z]+(\d+):[A-Z]+(\d+)$/.exec(m);
      if (f && Number(f[1]) >= BLOQUE_INF.ini && Number(f[2]) <= BLOQUE_INF.fin) { try { destino.mergeCells(m); } catch (e) { /* ya combinada */ } }
    });
  }

  function asegurarInfluenza(wb, ws) {
    if (!tieneInfluenza(ws)) {
      // hoja base: la que ya trae el bloque en las mismas filas (BIE01 en 405)
      const base = wb.worksheets.find((w) => w !== ws && w.name !== 'TOTAL' && filasPorClave(w).mapa.get('BIE01') === BLOQUE_INF.ini + 1);
      if (base) copiarBloqueInfluenza(base, ws);
    }
    completarBloqueInfluenza(ws);
  }

  // TOTAL: cada celda = suma de la MISMA clave en cada hoja de mes (cada hoja con su fila y su columna reales). La suma 3D
  // por número de fila de la plantilla solo sirve si todas las hojas tienen el mismo orden (enero y el bloque de Influenza no).
  function totalPorClave(wb) {
    const tot = wb.getWorksheet('TOTAL');
    if (!tot) return;
    const hojas = MESES.map((n) => wb.getWorksheet(n)).filter(Boolean).map((ws) => ({ ws, ...filasPorClave(ws), cols: columnasDestino(ws) }));
    const t = filasPorClave(tot);
    t.corregidas.forEach((c) => { tot.getCell(c.fila, 2).value = c.a; });
    const colsTot = columnasDestino(tot);
    t.mapa.forEach((r, k) => {
      DESTINOS.forEach((d) => {
        const c = colsTot[d.muni];
        if (!c) return;
        const partes = []; let suma = 0;
        hojas.forEach((h) => {
          const rr = h.mapa.get(k), cc = h.cols[d.muni];
          if (rr && cc) { partes.push(`${h.ws.name}!${colLetra(cc)}${rr}`); suma += valorCelda(h.ws.getCell(rr, cc)); }
        });
        if (partes.length) tot.getCell(r, c).value = { formula: partes.join('+'), result: Math.round(suma * 100) / 100 };
      });
    });
  }

  // Vista del libro: las hojas de la plantilla vienen ocultas y la pestaña activa apunta a un índice fijo; sin esto Excel
  // marca el archivo como dañado (una sola hoja oculta / pestaña activa que ya no existe).
  function ajustarVista(wb, modo, mes) {
    const nombres = wb.worksheets.map((w) => w.name);
    const activa = nombres.indexOf(nombreMes(mes));
    wb.worksheets.forEach((w, i) => {
      const visible = modo === 'mes' || i === activa || w.name === 'TOTAL' || MESES.indexOf(w.name) <= Number(mes) - 1;
      w.state = visible ? 'visible' : 'hidden';
      w.views = [Object.assign({}, (w.views && w.views[0]) || {}, { tabSelected: i === activa, state: 'normal' })];
    });
    const v = (wb.views && wb.views[0]) || {};
    wb.views = [Object.assign({}, v, { activeTab: Math.max(activa, 0), firstSheet: 0, visibility: 'visible' })];
  }

  // ---- datos ---------------------------------------------------------------------------------------------------
  // Suma por clave de TODAS las unidades validadas del municipio/hospital (filas oficiales del servidor).
  async function sumasDeMes(db, mes, anio, avance) {
    const sumas = new Map(), faltan = [];
    await Promise.all(DESTINOS.map(async (d) => {
      try {
        const filas = await window.SIS_CSV.filasDeMunicipio(db, d.muni, mes, anio, avance);
        const m = new Map();
        filas.forEach((f) => m.set(f.VARIABLE, (m.get(f.VARIABLE) || 0) + num(f.VALOR)));
        sumas.set(d.muni, m);
      } catch (e) {
        faltan.push({ muni: d.muni, etiqueta: d.etiqueta, motivo: (e && e.message) || String(e) });
      }
    }));
    return { sumas, faltan };
  }

  async function cargarLibro() {
    if (!window.ExcelJS && typeof window.ensureLibsLoaded === 'function') {
      try { await window.ensureLibsLoaded('exceljs'); } catch (e) { console.warn('[Paralelos] exceljs no cargó:', e); }
    }
    if (!window.ExcelJS) throw new Error('No cargó la librería de Excel. Revisa tu conexión e inténtalo de nuevo.');
    const resp = await fetch(PLANTILLA_URL);
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla (Formatos/paralelos_2026_plantilla.xlsx).');
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(await resp.arrayBuffer());
    const sep = wb.getWorksheet(NOMBRE_HOJA_SEP);
    if (sep) { sep.name = 'SEPTIEMBRE'; sep.getCell('I7').value = 'SEPTIEMBRE'; }
    return wb;
  }

  /**
   * Arma el libro. modo: 'mes' | 'acumulado'. Devuelve { wb, nombreArchivo, resumen }.
   * `traer(mes)` devuelve { sumas, faltan } de ese mes (inyectable para pruebas).
   */
  async function armar({ modo, mes, anio, traer, wb: libro }) {
    if (Number(anio) !== ANIO_PLANTILLA) throw new Error(`La plantilla PARALELOS es de ${ANIO_PLANTILLA}.`);
    if (Number(mes) < MES_INICIO_SIS) throw new Error('El SINBA-SIS por unidad arranca en octubre de 2026: antes de eso la plantilla ya trae los datos.');
    const wb = libro || await cargarLibro();
    const desde = modo === 'acumulado' ? MES_INICIO_SIS : Number(mes);
    const resumen = { meses: [], faltan: [], sinFila: new Set(), celdas: 0 };
    for (let m = desde; m <= Number(mes); m++) {
      const { sumas, faltan } = await traer(m);
      const ws = wb.getWorksheet(nombreMes(m));
      if (!ws) throw new Error(`La plantilla no tiene la hoja ${nombreMes(m)}.`);
      asegurarInfluenza(wb, ws);
      const r = llenarHojaMes(ws, sumas, nombreMes(m), ANIO_PLANTILLA);
      resumen.meses.push(nombreMes(m));
      resumen.celdas += r.celdas;
      r.sinFila.forEach((k) => resumen.sinFila.add(k));
      faltan.forEach((f) => resumen.faltan.push({ ...f, mes: m }));
    }
    if (modo === 'acumulado') MESES.forEach((n) => { const w = wb.getWorksheet(n); if (w && tieneInfluenza(w)) completarBloqueInfluenza(w); });
    wb.worksheets.forEach((ws) => { if (ws.name !== 'TOTAL' || modo === 'acumulado') igualarTotales(ws); });
    if (modo === 'acumulado') totalPorClave(wb);
    if (modo === 'mes') {
      // un solo mes: se quitan las demás hojas (TOTAL suma las 12 y quedaría sin sentido)
      wb.worksheets.filter((w) => w.name !== nombreMes(mes)).forEach((w) => wb.removeWorksheet(w.id));
    }
    ajustarVista(wb, modo, mes);
    calcularResultados(wb);
    wb.calcProperties = Object.assign(wb.calcProperties || {}, { fullCalcOnLoad: true });
    const nombreArchivo = modo === 'acumulado'
      ? `PARALELOS_${ANIO_PLANTILLA}_ACUMULADO_hasta_${nombreMes(mes)}.xlsx`
      : `PARALELOS_${ANIO_PLANTILLA}_${nombreMes(mes)}.xlsx`;
    resumen.sinFila = [...resumen.sinFila].sort();
    return { wb, nombreArchivo, resumen };
  }

  function guardar(buffer, nombre) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- interfaz (tarjeta dentro de Seguimiento SIS-06-P; solo JURISDICCIONAL y ADMIN) --------------------------
  const est = () => (typeof estado !== 'undefined' ? estado : (window.estado || null));
  const puede = () => { const e = est(); const r = e && e.perfil && e.perfil.rol; return r === 'ADMIN' || r === 'JURISDICCIONAL'; };
  const msg = (t, tipo) => { if (typeof window.toast === 'function') window.toast(t, tipo); else console.log('[Paralelos]', t); };
  let ocupado = false;

  function periodoActual() {
    const mes = Number((document.getElementById('selMes') || {}).value);
    const anio = Number((document.getElementById('selAnio') || {}).value);
    return { mes, anio };
  }

  async function descargar(modo) {
    if (ocupado) return;
    const { mes, anio } = periodoActual();
    const db = est() && est().db;
    if (!db) { msg('Aún no hay conexión con la base. Intenta de nuevo.', 'error'); return; }
    ocupado = true;
    const btns = [...document.querySelectorAll('#paralelosSIS [data-paralelos]')];
    btns.forEach((b) => { b.disabled = true; });
    const estadoEl = document.getElementById('paralelosEstado');
    const aviso = (t) => { if (estadoEl) estadoEl.textContent = t; };
    try {
      aviso('Leyendo el SINBA-SIS validado de municipios y hospitales…');
      const cache = new Map();
      const traer = async (m) => {
        aviso(`Leyendo ${nombreMes(m)}…`);
        const r = await sumasDeMes(db, m, anio);
        cache.set(m, r);
        return r;
      };
      // primero se lee todo (para poder avisar de lo que falta ANTES de armar el archivo)
      const desde = modo === 'acumulado' ? MES_INICIO_SIS : mes;
      for (let m = desde; m <= mes; m++) await traer(m);
      const faltan = [];
      cache.forEach((r, m) => r.faltan.forEach((f) => faltan.push(`${nombreMes(m)}: ${f.etiqueta}`)));
      if (cache.size && [...cache.values()].every((r) => r.sumas.size === 0)) {
        const motivo = [...cache.values()][0].faltan.map((f) => `${f.etiqueta}: ${f.motivo}`).slice(0, 3).join(' | ');
        throw new Error('Todavía no hay SINBA-SIS validado en ese periodo. ' + motivo);
      }
      if (faltan.length && typeof window.mostrarModal === 'function') {
        const seguir = await window.mostrarModal({
          titulo: 'Faltan municipios u hospitales por validar',
          mensaje: `Sin SINBA-SIS validado: ${faltan.join('; ')}. Sus columnas saldrían vacías en el Excel. ¿Descargar de todos modos?`,
          textoAceptar: 'Descargar de todos modos'
        });
        if (!seguir) { aviso(''); return; }
      }
      aviso('Armando el Excel sobre la plantilla PARALELOS…');
      const { wb, nombreArchivo, resumen } = await armar({ modo, mes, anio, traer: async (m) => cache.get(m) });
      guardar(await wb.xlsx.writeBuffer(), nombreArchivo);
      aviso('');
      const extra = resumen.sinFila.length ? ` Sin renglón en la plantilla (no incluidas): ${resumen.sinFila.slice(0, 6).join(', ')}${resumen.sinFila.length > 6 ? '…' : ''}.` : '';
      msg(`✅ ${nombreArchivo} listo (${resumen.meses.join(', ')}).${extra}`, resumen.sinFila.length || faltan.length ? 'warn' : 'ok');
    } catch (err) {
      console.error('[Paralelos] Error al exportar:', err);
      aviso('');
      msg(err.message || 'No se pudo generar PARALELOS.', 'error');
    } finally {
      ocupado = false;
      btns.forEach((b) => { b.disabled = false; });
      refrescar();
    }
  }

  function refrescar() {
    const cont = document.getElementById('paralelosSIS');
    if (!cont) return;
    if (!puede()) { cont.style.display = 'none'; return; }
    cont.style.display = 'block';
    const { mes, anio } = periodoActual();
    const valido = anio === ANIO_PLANTILLA && mes >= MES_INICIO_SIS;
    const nota = cont.querySelector('#paralelosNota');
    const bM = cont.querySelector('[data-paralelos="mes"]'), bA = cont.querySelector('[data-paralelos="acumulado"]');
    if (bM) { bM.disabled = !valido || ocupado; bM.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">download</span> Solo ${valido ? nombreMes(mes).toLowerCase() : 'este mes'}`; }
    if (bA) { bA.disabled = !valido || ocupado; bA.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">download</span> Acumulado${valido ? ' (enero a ' + nombreMes(mes).toLowerCase() + ')' : ''}`; }
    if (nota) nota.textContent = valido
      ? `Periodo elegido arriba: ${nombreMes(mes)} ${anio}. Toma el SINBA-SIS validado de los 4 municipios y los 2 hospitales.`
      : `Disponible desde octubre de ${ANIO_PLANTILLA} (elige el mes y el año arriba): antes de eso la plantilla ya trae los datos.`;
  }

  // Crea la tarjeta (una sola vez) dentro del panel de Seguimiento y la deja al día con el periodo elegido.
  function pintar() {
    const panel = document.getElementById('panelSeguimiento');
    if (!panel) return;
    let cont = document.getElementById('paralelosSIS');
    if (!puede()) { if (cont) cont.style.display = 'none'; return; }
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'paralelosSIS';
      cont.setAttribute('role', 'region');
      cont.setAttribute('aria-labelledby', 'paralelosTitulo');
      cont.style.cssText = 'margin-bottom:18px; padding:14px 16px; border:1px solid var(--outline-variant); border-radius:14px; background:#fff;';
      cont.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span class="material-symbols-rounded" aria-hidden="true" style="color:var(--secondary);">table_view</span>
          <h3 id="paralelosTitulo" style="margin:0; font-size:14px; font-weight:800;">PARALELOS ${ANIO_PLANTILLA} (informe jurisdiccional SINBA-SIS)</h3>
        </div>
        <p id="paralelosNota" style="margin:0 0 10px; font-size:12px; color:var(--muted);"></p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-primario btn-mini" data-paralelos="mes"></button>
          <button type="button" class="btn-secundario btn-mini" data-paralelos="acumulado"></button>
        </div>
        <div id="paralelosEstado" role="status" aria-live="polite" style="margin-top:8px; font-size:12px; font-weight:600; color:var(--muted);"></div>`;
      const ref = document.getElementById('seguimientoVentana');
      if (ref && ref.parentNode) ref.parentNode.insertBefore(cont, ref.nextSibling); else panel.appendChild(cont);
      cont.addEventListener('click', (e) => { const b = e.target.closest('[data-paralelos]'); if (b && !b.disabled) descargar(b.dataset.paralelos); });
    }
    refrescar();
  }

  window.SIS06PParalelos = { pintar, armar, sumasDeMes, llenarHojaMes, filasPorClave, columnasDestino, DESTINOS, MES_INICIO_SIS, ANIO_PLANTILLA };
})();
