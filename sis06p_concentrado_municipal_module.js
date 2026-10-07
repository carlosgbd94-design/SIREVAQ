/**
 * SIS / SINBA -- Concentrado MUNICIPAL (solo lectura). Reemplaza el trabajo
 * que hoy se hace a mano en el Excel municipal ("SIS QUERETARO <MES>.xlsx"):
 * el municipio NO captura nada aquí, todo se arma sumando lo que ya capturó
 * cada unidad:
 *
 *   - Recibido: requisición municipal vs. suma de lo que las unidades
 *     capturaron como recibido (biológico + lote + caducidad + cantidad).
 *     El municipio nunca se queda con vacuna: lo que llega se reparte por
 *     unidad en la misma requisición, así que las dos cifras deben ser iguales.
 *   - PALOTEO: una fila por variable/clave, una columna por unidad + Total
 *     municipal (hoja PALOTEO del Excel municipal).
 *   - SEGUIMIENTO DE BIOLOGICO: por biológico y por unidad, SIN lotes:
 *     existencia anterior (frascos), recibido (frascos), aplicado (dosis),
 *     desperdicio (dosis) y existencia al corte (frascos).
 *
 * Aplicado/desperdicio en dosis EQUIVALENTES (Hepatitis B y COVID Moderna:
 * pediátrica cuenta ½), igual que la conciliación paloteo-vs-movimiento.
 * La hoja "PEDIDO DE BIOLOGICO" del Excel municipal se omite a propósito
 * (ya no se usa: el pedido vive en Requisiciones).
 *
 * Datos siempre vía RPC/consultas con el cliente Supabase de BioVac
 * (`estado.db`) -- Postgres decide el alcance real por rol.
 */
(function () {
  // Mismo orden que las filas de la hoja SEGUIMIENTO DE BIOLOGICO del Excel
  // municipal; lo que no aparezca aquí (p. ej. Neumocócica 23) se agrega al
  // final para que nunca quede fuera de los totales.
  const ORDEN_BIOLOGICOS = [
    'BCG', 'HEPB', 'HEXAVALENTE', 'DPT', 'ROTAVIRUS', 'NEUMO_13V', 'NEUMO_20V', 'SRP',
    'ANTIINFLUENZA', 'SR', 'VPH', 'TD', 'TDPA', 'COVID_MODERNA', 'COVID_PFIZER',
    'VARICELA', 'HEPA', 'VSR'
  ];
  const BLOQUES = [
    { key: 'existencia_anterior', titulo: 'Existencia anterior (frascos)' },
    { key: 'recibido', titulo: 'Recibido (frascos)' },
    { key: 'aplicado', titulo: 'Aplicado (dosis)' },
    { key: 'desperdicio', titulo: 'Desperdicio (dosis)' },
    { key: 'existencia_corte', titulo: 'Existencia al corte (frascos)' }
  ];
  const TIPOS_CLAVE = [
    { tipo: 'TOTAL', campo: 'clave_general', sub: 'total' },
    { tipo: 'MIGRANTES', campo: 'clave_migrante', sub: 'migrante' },
    { tipo: 'AFROMEXICANOS', campo: 'clave_afro', sub: 'afro' },
    { tipo: 'INDÍGENAS', campo: 'clave_indigena', sub: 'indigena' }
  ];

  // Nombre como lo escribe el Excel oficial del municipio (QUERÉTARO con acento, EL MARQUÉS)
  const NOMBRE_OFICIAL = { QUERETARO: 'QUERÉTARO', MARQUES: 'EL MARQUÉS' };
  const nombreOficial = (m) => NOMBRE_OFICIAL[m] || m;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const limpiar = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // 2 decimales como máximo, sin ceros de sobra (los frascos pueden traer
  // fracciones de multidosis: 60.15, 3.8...).
  const fmt = (v) => { const n = Math.round(num(v) * 100) / 100; return String(n); };
  const nombreCorto = (n) => limpiar(n).replace(/^UMME\s+/i, 'UMME ').slice(0, 16);

  const ESTADO_MARCA = {
    VALIDADO: { txt: 'V', color: 'var(--success)', titulo: 'Validado' },
    ENVIADO: { txt: 'E', color: 'var(--warning)', titulo: 'Enviado (por validar)' },
    BORRADOR: { txt: 'B', color: '#94a3b8', titulo: 'Sin enviar' }
  };

  const TH = 'padding:6px 8px; font-size:10px; text-transform:uppercase; color:var(--muted); background:#f8fafc; border-bottom:1px solid var(--outline-variant); position:sticky; top:0; z-index:1; white-space:nowrap;';
  const TD = 'padding:5px 8px; border-bottom:1px solid #f1f5f9; white-space:nowrap;';

  async function cargarDatos(municipio, mes, anio) {
    const [uRes, vRes, cRes, sRes, rRes] = await Promise.all([
      estado.db.from('biovac_unidades').select('id, clues, nombre').eq('municipio', municipio).eq('activo', true).not('clues', 'like', 'JS1-%').order('clues'),
      estado.db.from('sis_variables').select('*').eq('activo', true).order('orden'),
      estado.db.from('sis06p_capturas').select('clues, estado, valores').eq('municipio', municipio).eq('mes', mes).eq('anio', anio),
      estado.db.rpc('sis06p_seguimiento_biologico', { p_municipio: municipio, p_mes: mes, p_anio: anio }),
      estado.db.rpc('sis06p_recibido_vs_requisicion', { p_mes: mes, p_anio: anio, p_municipio: municipio })
    ]);
    [uRes, vRes, cRes, sRes, rRes].forEach((r) => { if (r.error) throw r.error; });

    // Influenza (renglones BIE.. del PALOTEO): suma de las semanas cuyo viernes cae en el mes, como en el CSV municipal
    const influenza = new Map();
    const lista = (uRes.data || []).map((u) => u.clues);
    if (lista.length) {
      const iniMes = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const sigMes = Number(mes) === 12 ? 1 : Number(mes) + 1;
      const finMes = `${Number(mes) === 12 ? Number(anio) + 1 : Number(anio)}-${String(sigMes).padStart(2, '0')}-01`;
      const iRes = await estado.db.from('influenza_capturas').select('clues, fecha, valores').in('clues', lista).gte('fecha', iniMes).lt('fecha', finMes);
      if (iRes.error) console.error('[SIS-06-P] No se pudo cargar Influenza para el concentrado municipal:', iRes.error);
      (iRes.data || []).forEach((c) => {
        const acum = influenza.get(c.clues) || {};
        Object.entries(c.valores || {}).forEach(([rubro, val]) => { acum[rubro] = (acum[rubro] || 0) + num(val); });
        influenza.set(c.clues, acum);
      });
    }

    const capturaPorClues = new Map((cRes.data || []).map((c) => [c.clues, c]));
    const segPorClave = new Map(); // `${clues}|${biovac_clave}` -> fila
    const movEstado = new Map();
    (sRes.data || []).forEach((f) => { segPorClave.set(`${f.clues}|${f.biovac_clave}`, f); movEstado.set(f.clues, f.movimiento_estado); });

    // Biológicos en el orden del Excel municipal + los que no estén listados.
    const catalogo = (estado.biologicos || []).slice();
    const ordenados = [];
    ORDEN_BIOLOGICOS.forEach((clave) => { const b = catalogo.find((x) => x.clave === clave); if (b) ordenados.push(b); });
    catalogo.forEach((b) => { if (!ordenados.includes(b)) ordenados.push(b); });

    return {
      unidades: uRes.data || [], variables: vRes.data || [], capturaPorClues, segPorClave, movEstado, influenza,
      biologicos: ordenados, requisicion: rRes.data || [], municipio, mes, anio
    };
  }

  // ---- Recibido: requisición vs unidades -----------------------------------

  function htmlRecibido(d) {
    const filas = d.requisicion;
    if (filas.length === 0) {
      return '<div style="font-size:11.5px; color:var(--muted); font-style:italic; padding:6px 0;">No hay requisición con reparto ni recibido capturado por las unidades en este mes.</div>';
    }
    const dif = filas.filter((f) => !f.coincide);
    const cab = dif.length === 0
      ? `<div style="font-size:11.5px; font-weight:700; color:var(--success); padding:6px 0;">✅ La requisición coincide con lo recibido por las unidades en los ${filas.length} lote(s) (biológico, lote, caducidad y cantidad).</div>`
      : `<div style="font-size:11.5px; font-weight:700; color:var(--warning); padding:6px 0;">⚠ ${dif.length} de ${filas.length} lote(s) NO coinciden entre la requisición municipal y la suma de lo recibido por las unidades.</div>`;
    const fecha = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—');
    const lista = dif.length > 0 ? dif : [];
    const tabla = lista.length === 0 ? '' : `
      <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr>
          <th style="${TH} text-align:left;">Biológico</th><th style="${TH} text-align:left;">Lote</th>
          <th style="${TH}">Caducidad requisición</th><th style="${TH}">Caducidad unidades</th>
          <th style="${TH}">Requisición (frascos)</th><th style="${TH}">Suma unidades (frascos)</th>
        </tr></thead>
        <tbody>${lista.map((f) => `<tr>
          <td style="${TD}">${esc(limpiar(f.biologico))}</td><td style="${TD} font-family:monospace;">${esc(f.numero_lote)}</td>
          <td style="${TD} text-align:center;">${fecha(f.caducidad_requisicion)}</td><td style="${TD} text-align:center;">${fecha(f.caducidad_unidades)}</td>
          <td style="${TD} text-align:center; font-weight:700;">${fmt(f.requisicion)}</td><td style="${TD} text-align:center; font-weight:700;">${fmt(f.unidades)}</td>
        </tr>`).join('')}</tbody></table></div>`;
    return cab + tabla;
  }

  // ---- PALOTEO ---------------------------------------------------------------

  function valorPaloteo(d, clues, v, sub) {
    const cap = d.capturaPorClues.get(clues);
    if (!cap) return null;
    const val = (cap.valores || {})[String(v.fila_excel)];
    return num(val && val[sub]);
  }

  function htmlPaloteo(d) {
    const { unidades, variables } = d;
    if (variables.length === 0) return '<div style="color:var(--muted);">Sin catálogo de variables.</div>';
    const encUnidades = unidades.map((u) => {
      const cap = d.capturaPorClues.get(u.clues);
      const m = cap ? (ESTADO_MARCA[cap.estado] || ESTADO_MARCA.BORRADOR) : null;
      return `<th style="${TH} text-align:center;" title="${esc(u.nombre)} (${esc(u.clues)})${m ? ' -- ' + m.titulo : ' -- sin captura'}">
        ${esc(nombreCorto(u.nombre))}<br><span style="color:${m ? m.color : '#cbd5e1'}; font-weight:900;">${m ? m.txt : '—'}</span></th>`;
    }).join('');

    let ultimoBio = null;
    const cuerpo = variables.map((v) => {
      const primeraDelGrupo = v.biologico !== ultimoBio;
      ultimoBio = v.biologico;
      let total = 0;
      const celdas = unidades.map((u) => {
        const x = valorPaloteo(d, u.clues, v, 'total');
        if (x === null) return `<td style="${TD} text-align:center; color:#cbd5e1;">·</td>`;
        total += x;
        return `<td style="${TD} text-align:center;">${x || ''}</td>`;
      }).join('');
      return `<tr${primeraDelGrupo ? ' style="border-top:2px solid var(--outline-variant);"' : ''}>
        <td style="${TD} font-weight:700; position:sticky; left:0; background:#fff;">${primeraDelGrupo ? esc(limpiar(v.biologico)) : ''}</td>
        <td style="${TD} font-family:monospace; color:#64748b;">${esc(v.clave_general || '')}</td>
        <td style="${TD}">${esc(limpiar([v.grupo_poblacional, v.dosis !== v.grupo_poblacional ? v.dosis : '', v.edad].filter(Boolean).join(' · ')))}</td>
        ${celdas}
        <td style="${TD} text-align:center; font-weight:800; background:#f8fafc;">${total}</td>
      </tr>`;
    }).join('');

    return `<div style="font-size:11px; color:var(--muted); margin-bottom:6px;">Solo TOTAL por variable (los subconteos Afromexicano/Indígena/Migrante van en el Excel y en el CSV). Columna: <b style="color:var(--success);">V</b> validado · <b style="color:var(--warning);">E</b> enviado · <b style="color:#94a3b8;">B</b> sin enviar · — sin captura.</div>
      <div style="overflow:auto; max-height:60vh; border:1px solid var(--outline-variant); border-radius:12px;">
      <table style="border-collapse:collapse; font-size:12px; min-width:100%;">
        <thead><tr><th style="${TH} text-align:left; left:0; z-index:2;">Biológico</th><th style="${TH}">Clave</th><th style="${TH} text-align:left;">Grupo / dosis</th>${encUnidades}<th style="${TH}">Total municipal</th></tr></thead>
        <tbody>${cuerpo}</tbody>
      </table></div>`;
  }

  // ---- SEGUIMIENTO DE BIOLOGICO ---------------------------------------------

  function biologicosConMovimiento(d) {
    return d.biologicos.filter((b) => BLOQUES.some((bl) => d.unidades.some((u) => {
      const f = d.segPorClave.get(`${u.clues}|${b.clave}`);
      return f && num(f[bl.key]) !== 0;
    })));
  }

  function htmlSeguimiento(d) {
    const { unidades } = d;
    const bios = biologicosConMovimiento(d);
    if (bios.length === 0) {
      return '<div style="font-size:11.5px; color:var(--muted); font-style:italic; padding:6px 0;">Ninguna unidad tiene Movimiento de Biológico con cantidades este mes.</div>';
    }
    const provisional = unidades.filter((u) => d.movEstado.has(u.clues) && d.movEstado.get(u.clues) !== 'CERRADO').length;
    const enc = unidades.map((u) => `<th style="${TH} text-align:center;" title="${esc(u.nombre)} (${esc(u.clues)})">${esc(nombreCorto(u.nombre))}</th>`).join('');

    const bloques = BLOQUES.map((bl) => {
      const filas = bios.map((b) => {
        let total = 0;
        const celdas = unidades.map((u) => {
          const f = d.segPorClave.get(`${u.clues}|${b.clave}`);
          if (!f) return `<td style="${TD} text-align:center; color:#cbd5e1;">·</td>`;
          const x = num(f[bl.key]);
          total += x;
          return `<td style="${TD} text-align:center;">${x ? fmt(x) : ''}</td>`;
        }).join('');
        return `<tr><td style="${TD} font-weight:700; position:sticky; left:0; background:#fff;">${esc(limpiar(b.nombre_excel || b.clave))}</td>${celdas}<td style="${TD} text-align:center; font-weight:800; background:#f8fafc;">${fmt(total)}</td></tr>`;
      }).join('');
      return `<div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); margin:14px 0 6px;">${bl.titulo}</div>
        <div style="overflow:auto; border:1px solid var(--outline-variant); border-radius:12px;">
        <table style="border-collapse:collapse; font-size:12px; min-width:100%;">
          <thead><tr><th style="${TH} text-align:left; left:0; z-index:2;">Biológico</th>${enc}<th style="${TH}">Total</th></tr></thead>
          <tbody>${filas}</tbody></table></div>`;
    }).join('');

    const aviso = provisional > 0
      ? `<div style="font-size:11.5px; font-weight:700; color:var(--warning); margin-bottom:4px;">⚠ Provisional: ${provisional} unidad(es) todavía no cierran su Movimiento -- sus cantidades pueden cambiar.</div>` : '';
    return aviso + bloques + '<div style="font-size:10.5px; color:var(--muted); margin-top:8px;">"·" = la unidad no tiene Movimiento de ese biológico. Hepatitis B y COVID Moderna: la dosis pediátrica cuenta ½.</div>';
  }

  // ---- Excel ----------------------------------------------------------------
  //
  // El Excel se arma SOBRE la plantilla real del municipio ("SIS QUERETARO <MES>.xlsx", hojas PALOTEO y
  // SEGUIMIENTO DE BIOLOGICO), recortada por build-concentrado-municipal-plantilla.js en
  // Formatos/concentrado_municipal_plantilla.xlsx. Mapeo (verificado celda por celda contra agosto 2026):
  //
  //  PALOTEO (A1:AU443)
  //    - A1:G1 mes, H1 año (formato aaaa), A3:H3 "MUNICIPIO <X>"; fila 3 nombre de la unidad (vertical) y fila 4 CLUES.
  //    - Columnas I..AT = 38 unidades en orden de CLUES; AU = "Total Municipal" (=SUM de la fila).
  //    - Cada renglón de datos (5..442) se identifica por la CLAVE de la columna C (VBC01, VBF51, VBI51, BIE01...):
  //      TOTAL = clave_general, MIGRANTES = clave_migrante, AFROMEXICANOS = clave_afro, INDÍGENAS = clave_indigena
  //      del catálogo sis_variables; las BIE.. (filas 397-442) son Influenza (suma de las semanas del mes).
  //    - Las filas "TOTAL <biológico>" son fórmulas: suma de los renglones TOTAL de su bloque.
  //    - Fila 443: suma de Influenza (no entra al área de impresión, que termina en la 396).
  //  SEGUIMIENTO DE BIOLOGICO (A1:AP97)
  //    - Fila 2 nombre de la unidad; B..AM = 38 unidades, AN = Total, AO:AP = VALIDACIÓN (Seguimiento vs PALOTEO).
  //    - 5 bloques de 18 biológicos (mismo orden que ORDEN_BIOLOGICOS): existencia anterior (4-21), recibido (23-40),
  //      aplicado (42-59), desperdicio (61-78) y existencia al corte (80-97, FÓRMULA: ((ant+rec)*dosis-(apl+des))/dosis).
  //    - VALIDACIÓN (AO42:AO59) = total del PALOTEO de ese biológico; verde si coincide con el aplicado, rojo si no.
  // Con menos (o más) de 38 unidades se quitan (o se agregan) columnas de unidades y se corren Total/VALIDACIÓN.

  const PLANTILLA_URL = './Formatos/concentrado_municipal_plantilla.xlsx';
  const MESES_MAYUS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const PAL = { hoja: 'PALOTEO', colIni: 9, colFin: 46, filaNombre: 3, filaClues: 4, filaIni: 5, filaFin: 442, filaTotal: 443, ultimaFila: 443, filaImpresion: 396 };
  const SEG = { hoja: 'SEGUIMIENTO DE BIOLOGICO', colIni: 2, colFin: 39, ultimaFila: 97, nBios: 18, ant: 4, rec: 23, apl: 42, des: 61, corte: 80, validacion: [42, 59] };

  const colLetra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const colNumero = (L) => L.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const redondear = (v) => Math.round(num(v) * 100) / 100;
  const clonarEstilo = (st) => JSON.parse(JSON.stringify(st || {}));
  const textoCelda = (v) => (v && v.richText ? v.richText.map((t) => t.text).join('') : (v == null ? '' : String(v))).replace(/\s+/g, ' ').trim();
  // Cambia las referencias de columna `desde` por `hacia` en una fórmula (SUM(I5:I9) -> SUM(J5:J9))
  const trasladarFormula = (f, desde, hacia) => String(f).replace(new RegExp(`\\b${desde}(\\d+)\\b`, 'g'), `${hacia}$1`);

  // Quita (o agrega) columnas de unidades dejando intactos el primer y el último estilo de la tabla, y
  // rehace las combinaciones de celdas que cruzan o quedan a la derecha de lo que se mueve.
  function ajustarColumnas(ws, colIni, colFin, n) {
    const cap = colFin - colIni + 1;
    if (n === cap) return;
    const re = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/;
    const pendientes = [];
    ws.model.merges.slice().forEach((m) => {
      const x = re.exec(m); if (!x) return;
      let c1 = colNumero(x[1]); let c2 = colNumero(x[3]);
      const r1 = x[2]; const r2 = x[4];
      let cambia = false;
      if (n < cap) {
        const quitadas = cap - n; const finQuitadas = colIni + quitadas;
        if (c1 > finQuitadas) { c1 -= quitadas; c2 -= quitadas; cambia = true; } else if (c2 > finQuitadas) { c2 -= quitadas; cambia = true; }
      } else {
        const extra = n - cap;
        if (c1 >= colFin) { c1 += extra; c2 += extra; cambia = true; } else if (c2 >= colFin) { c2 += extra; cambia = true; }
      }
      if (cambia) { ws.unMergeCells(m); pendientes.push(`${colLetra(c1)}${r1}:${colLetra(c2)}${r2}`); }
    });
    if (n < cap) {
      ws.spliceColumns(colIni + 1, cap - n);
    } else {
      const extra = n - cap;
      const molde = colFin - 1; // una columna intermedia de la plantilla
      const ancho = ws.getColumn(molde).width;
      const filas = [];
      ws.eachRow({ includeEmpty: true }, (row, r) => filas.push(r));
      ws.spliceColumns(colFin, 0, ...Array.from({ length: extra }, () => []));
      for (let k = 0; k < extra; k++) {
        const c = colFin + k;
        filas.forEach((r) => { ws.getCell(r, c).style = clonarEstilo(ws.getCell(r, molde).style); });
        ws.getColumn(c).width = ancho;
      }
    }
    pendientes.forEach((rango) => ws.mergeCellsWithoutStyle(rango));
  }

  // Resultado de una fórmula simple de la plantilla (SUM de un rango, suma/resta de celdas, / y *) para dejar
  // el valor ya calculado en el archivo; Excel igual recalcula todo al abrirlo (fullCalcOnLoad).
  function evaluar(formula, leer) {
    try {
      let f = String(formula).replace(/\$/g, '');
      f = f.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        let s = 0;
        for (let c = colNumero(c1); c <= colNumero(c2); c++) for (let r = Number(r1); r <= Number(r2); r++) s += leer(colLetra(c), r);
        return `(${s})`;
      });
      f = f.replace(/\b([A-Z]{1,3})(\d+)\b/g, (_, c, r) => `(${leer(c, Number(r))})`);
      if (!/^[\d.+\-*/() eE]+$/.test(f)) return undefined;
      const v = Function(`"use strict"; return (${f});`)();
      return Number.isFinite(v) ? redondear(v) : undefined;
    } catch (e) { return undefined; }
  }

  // Escala de impresión del PALOTEO: que las filas visibles (las TOTAL; las de afro/indígena/migrante van
  // agrupadas y ocultas) quepan en UNA hoja de alto y las columnas en 3 de ancho como máximo.
  function escalaPaloteo(ws, cTot) {
    const m = ws.pageSetup.margins || { left: 0.24, right: 0.24, top: 0.16, bottom: 0.16 };
    const ancho = 612 - (m.left + m.right) * 72; const alto = 936 - (m.top + m.bottom) * 72; // oficio 8.5x13 in
    let tw = 0; for (let c = 1; c <= cTot; c++) tw += ((ws.getColumn(c).width || 8.43) * 7 + 5) * 0.75;
    let th = 0; for (let r = 1; r <= PAL.filaImpresion; r++) { const f = ws.getRow(r); if (!f.hidden) th += f.height || 15; }
    return Math.max(10, Math.floor(Math.min(1, 3 * ancho / tw, alto / th) * 100 * 0.94));
  }

  function llenarPaloteo(ws, d) {
    const n = d.unidades.length;
    // Lo que trae la plantilla antes de moverla
    const nombresPlantilla = new Map();
    for (let c = PAL.colIni; c <= PAL.colFin; c++) {
      const clues = textoCelda(ws.getCell(PAL.filaClues, c).value);
      if (clues) nombresPlantilla.set(clues, textoCelda(ws.getCell(PAL.filaNombre, c).value));
    }
    const formulasFila = new Map(); // fila -> fórmula de la columna I (subtotales por biológico y suma de Influenza)
    for (let r = PAL.filaIni; r <= PAL.filaTotal; r++) {
      const v = ws.getCell(r, PAL.colIni).value;
      if (v && typeof v === 'object' && v.formula) formulasFila.set(r, v.formula);
    }

    ajustarColumnas(ws, PAL.colIni, PAL.colFin, n);
    const cIni = PAL.colIni; const cFin = cIni + n - 1; const cTot = cFin + 1;
    const LT = colLetra(cTot); const LF = colLetra(cFin);

    ws.getCell(1, 1).value = MESES_MAYUS[Number(d.mes) - 1] || String(d.mes);
    ws.getCell(1, 8).value = new Date(Date.UTC(Number(d.anio), Number(d.mes), 0));
    ws.getCell(3, 1).value = `MUNICIPIO ${nombreOficial(d.municipio)}`;
    d.unidades.forEach((u, i) => {
      ws.getCell(PAL.filaNombre, cIni + i).value = nombresPlantilla.get(u.clues) || limpiar(u.nombre).toUpperCase();
      ws.getCell(PAL.filaClues, cIni + i).value = u.clues;
    });
    ws.getCell(PAL.filaNombre, cTot).value = 'Total Municipal';

    // clave -> { v, sub } del catálogo y clave -> rubro de Influenza
    const porClave = new Map();
    d.variables.forEach((v) => TIPOS_CLAVE.forEach((tc) => { if (v[tc.campo]) porClave.set(String(v[tc.campo]).trim(), { v, sub: tc.sub }); }));
    const inf = window.SIS06PBiovac && window.SIS06PBiovac.INFLUENZA_SIS_MAPPING ? window.SIS06PBiovac.INFLUENZA_SIS_MAPPING : {};
    const rubroDeClave = new Map(Object.entries(inf).map(([rubro, clave]) => [String(clave), rubro]));

    const valores = new Map(); // `${col}|${fila}` -> número (para los resultados de las fórmulas)
    const leer = (L, r) => valores.get(`${L}|${r}`) || 0;
    const usadas = new Set();
    const filasClave = []; // renglones de datos del PALOTEO en su orden (alimentan la hoja CSV)
    const escribirFilaDatos = (r) => {
      const clave = textoCelda(ws.getCell(r, 3).value);
      if (!clave) return;
      filasClave.push({ r, clave });
      const dato = porClave.get(clave);
      const rubro = rubroDeClave.get(clave);
      if (dato) usadas.add(clave);
      d.unidades.forEach((u, i) => {
        let x = 0;
        if (dato) { const val = valorPaloteo(d, u.clues, dato.v, dato.sub); x = val === null ? 0 : val; }
        else if (rubro) { x = num((d.influenza.get(u.clues) || {})[rubro]); }
        if (!x) return;
        ws.getCell(r, cIni + i).value = x;
        valores.set(`${colLetra(cIni + i)}|${r}`, x);
      });
    };
    for (let r = PAL.filaIni; r <= PAL.filaFin; r++) if (!formulasFila.has(r)) escribirFilaDatos(r);

    // Subtotales por biológico (fórmula de la plantilla, trasladada a cada unidad)
    formulasFila.forEach((f, r) => {
      for (let c = cIni; c <= cFin; c++) {
        const L = colLetra(c);
        const fx = trasladarFormula(f, 'I', L);
        const res = evaluar(fx, leer);
        ws.getCell(r, c).value = res === undefined ? { formula: fx } : { formula: fx, result: res };
        if (res !== undefined) valores.set(`${L}|${r}`, res);
      }
    });
    // Total Municipal: suma de la fila; en la 443 la suma de Influenza
    for (let r = PAL.filaIni; r <= PAL.filaFin; r++) {
      let suma = 0; for (let c = cIni; c <= cFin; c++) suma += leer(colLetra(c), r);
      ws.getCell(r, cTot).value = { formula: `SUM(I${r}:${LF}${r})`, result: redondear(suma) };
      valores.set(`${LT}|${r}`, redondear(suma));
    }
    { let s = 0; for (let r = 397; r <= 442; r++) s += leer(LT, r); ws.getCell(PAL.filaTotal, cTot).value = { formula: `SUM(${LT}397:${LT}442)`, result: redondear(s) }; valores.set(`${LT}|${PAL.filaTotal}`, redondear(s)); }

    // Impresión: hasta 3 hojas de ancho y 1 de alto (escala calculada, como la plantilla de agosto). Cuando hay
    // Influenza capturada, sus renglones (397-443) se imprimen APARTE: salto de página después de la 396 y los
    // encabezados de unidad (filas 3:4) repetidos arriba. Sin Influenza el área de impresión termina en la 396.
    let hayInfluenza = false;
    valores.forEach((x, k) => { const f = Number(k.split('|')[1]); if (f >= 397 && f <= 442 && x > 0) hayInfluenza = true; });
    ws.rowBreaks.length = 0;
    if (hayInfluenza) ws.getRow(PAL.filaImpresion).addPageBreak();
    const ultimaImpresion = hayInfluenza ? PAL.filaTotal : PAL.filaImpresion;
    Object.assign(ws.pageSetup, {
      paperSize: 14, orientation: 'portrait', fitToPage: false, scale: escalaPaloteo(ws, cTot),
      printArea: `A1:${LT}${ultimaImpresion}`, printTitlesRow: `${PAL.filaNombre}:${PAL.filaClues}`
    });
    return { cTot, cIni, valores, filasClave, hayInfluenza, nombres: nombresPlantilla, sinFila: Array.from(porClave.keys()).filter((k) => !usadas.has(k)) };
  }

  function llenarSeguimiento(ws, d, pal) {
    const n = d.unidades.length;
    const bios = d.biologicosOrden; // 18, mismo orden que la plantilla
    const estilo = { a1: clonarEstilo(ws.getCell(1, 1).style), v1: clonarEstilo(ws.getCell(1, 22).style), z1: clonarEstilo(ws.getCell(1, 26).style) };
    const corteF = []; for (let b = 0; b < SEG.nBios; b++) corteF.push(ws.getCell(SEG.corte + b, SEG.colIni).value.formula); // con columna B
    const validF = []; for (let r = SEG.validacion[0]; r <= SEG.validacion[1]; r++) { const v = ws.getCell(r, SEG.colFin + 2).value; validF.push(v && v.formula ? v.formula : null); }

    ajustarColumnas(ws, SEG.colIni, SEG.colFin, n);
    const cIni = SEG.colIni; const cFin = cIni + n - 1; const cTot = cFin + 1; const cVal = cTot + 1; const ultima = cVal + 1;
    const LF = colLetra(cFin);

    // Columnas más anchas cuando hay pocas unidades (la plantilla las angosta para que quepan 38 en una hoja)
    const anchoUnidad = n <= 12 ? 11 : (n <= 24 ? 7.5 : null);
    if (anchoUnidad) for (let c = cIni; c <= cFin; c++) ws.getColumn(c).width = anchoUnidad;
    ws.getColumn(cTot).width = 11;

    // Fila 1: título, mes y año (se vuelven a combinar según el ancho real)
    // Los tres rótulos ocupan las columnas que necesiten según su ancho real (título, mes y año); si no caben
    // (municipio de 1 o 2 unidades) se reducen para ajustarse. El resto de la banda queda libre.
    const ancho = (c) => ws.getColumn(c).width || 8.43;
    const abarcar = (desde, necesita) => { let c = desde; let acc = 0; while (c <= ultima && acc < necesita) { acc += ancho(c); c++; } return Math.max(desde, Math.min(ultima, c - 1)); };
    const textoTitulo = `MUNICIPIO ${nombreOficial(d.municipio)}`;
    const t1 = abarcar(1, textoTitulo.length * 2.3 + 2);
    const m1 = Math.min(Math.max(t1 + 1, ultima - 1), abarcar(t1 + 1, 26));
    const a1 = Math.min(ultima, Math.max(m1 + 1, abarcar(m1 + 1, 11)));
    ws.getCell(1, 1).style = clonarEstilo(estilo.a1); ws.getCell(1, t1 + 1).style = clonarEstilo(estilo.v1); ws.getCell(1, m1 + 1).style = clonarEstilo(estilo.z1);
    ws.getCell(1, 1).value = textoTitulo;
    ws.getCell(1, t1 + 1).value = MESES_MAYUS[Number(d.mes) - 1] || String(d.mes);
    ws.getCell(1, m1 + 1).value = new Date(Date.UTC(Number(d.anio), Number(d.mes), 0));
    [[1, t1], [t1 + 1, m1], [m1 + 1, a1], [a1 + 1, ultima]].forEach(([c1, c2]) => { if (c2 > c1) ws.mergeCellsWithoutStyle(1, c1, 1, c2); });
    [1, t1 + 1, m1 + 1].forEach((c) => { ws.getCell(1, c).alignment = Object.assign({}, ws.getCell(1, c).alignment, { shrinkToFit: true }); });

    d.unidades.forEach((u, i) => {
      // nombre corto de la plantilla cuando la CLUES es una de las que ya traía (el mismo que en PALOTEO)
      ws.getCell(2, cIni + i).value = pal.nombres.get(u.clues) || limpiar(u.nombre).toUpperCase();
    });
    ws.getCell(2, cTot).value = 'Total';

    const bloque = (base, campo, ceros) => {
      bios.forEach((b, k) => {
        const r = base + k;
        let suma = 0;
        d.unidades.forEach((u, i) => {
          const f = d.segPorClave.get(`${u.clues}|${b.clave}`);
          const x = f ? redondear(f[campo]) : 0;
          suma += x;
          if (x || ceros) ws.getCell(r, cIni + i).value = x;
        });
        ws.getCell(r, cTot).value = { formula: `SUM(B${r}:${LF}${r})`, result: redondear(suma) };
      });
    };
    bloque(SEG.ant, 'existencia_anterior', true);
    bloque(SEG.rec, 'recibido', false);
    bloque(SEG.apl, 'aplicado', false);
    bloque(SEG.des, 'desperdicio', false);

    // Existencia al corte: fórmula de la plantilla por columna (incluida la de Total)
    const valor = (L, r) => { const v = ws.getCell(r, colNumero(L)).value; return v && typeof v === 'object' ? num(v.result) : num(v); };
    for (let k = 0; k < SEG.nBios; k++) {
      const r = SEG.corte + k;
      for (let c = cIni; c <= cTot; c++) {
        const fx = trasladarFormula(corteF[k], 'B', colLetra(c));
        const res = evaluar(fx, valor);
        ws.getCell(r, c).value = res === undefined ? { formula: fx } : { formula: fx, result: res };
      }
    }

    // VALIDACIÓN: total del PALOTEO de cada biológico (columna Total del PALOTEO)
    const LTP = colLetra(pal.cTot);
    validF.forEach((f, k) => {
      if (!f) return;
      const r = SEG.validacion[0] + k;
      const fx = f.replace(/AU(\d+)/g, `${LTP}$1`);
      const res = evaluar(fx.replace(/PALOTEO!/g, ''), (L, rr) => num(pal.valores.get(`${L}|${rr}`)));
      ws.getCell(r, cVal).value = res === undefined ? { formula: fx } : { formula: fx, result: res };
    });

    // Formatos condicionales de la plantilla (rehechos con las columnas reales)
    ws.conditionalFormattings = [];
    const rojo = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFA3A3' } };
    ws.addConditionalFormatting({ ref: `B${SEG.corte}:${LF}${SEG.corte + 17}`, rules: [{ type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 1, style: { fill: rojo, font: { bold: true, italic: true, color: { argb: 'FFC00000' } } } }] });
    const fracc = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF2CC' } };
    [SEG.corte, SEG.corte + 9, SEG.corte + 13].forEach((r, i) => ws.addConditionalFormatting({ ref: `B${r}:${LF}${r}`, rules: [{ type: 'expression', formulae: [`MOD(B${r},1)<>0`], priority: 2 + i, style: { fill: fracc, font: { bold: true, italic: true, color: { argb: 'FFC00000' } } } }] }));
    const LV = colLetra(cVal); const LN = colLetra(cTot); const v0 = SEG.validacion[0];
    ws.addConditionalFormatting({ ref: `${LV}${v0}:${LV}${SEG.validacion[1]}`, rules: [
      { type: 'expression', formulae: [`${LN}${v0}=${LV}${v0}`], priority: 5, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE2EFDA' } }, font: { bold: true, italic: true, color: { argb: 'FF375623' } } } },
      { type: 'expression', formulae: [`${LN}${v0}<>${LV}${v0}`], priority: 6, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFE5E5' } }, font: { bold: true, italic: true, color: { argb: 'FFAC2F36' } } } }
    ] });

    Object.assign(ws.pageSetup, { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: `A1:${colLetra(ultima)}${SEG.ultimaFila}` });
  }

  // Hoja CSV del Excel oficial: CLUES | VARIABLE | VALOR | MES | AÑO | MUNICIPIO, un renglón por unidad y por clave
  // del PALOTEO (mismo orden que sus renglones de datos). CLUES y VALOR son fórmulas que apuntan a la propia
  // celda del PALOTEO (=PALOTEO!$I$4, =PALOTEO!$I$5...), así la clave de cada renglón y su valor nunca se separan.
  function agregarHojaCSV(wb, d, pal) {
    const ws = wb.addWorksheet('CSV');
    const encabezado = ['CLUES', 'VARIABLE', 'VALOR', 'MES', 'AÑO', 'MUNICIPIO'];
    // Misma letra que la hoja CSV del Excel oficial: Arial Nova 11; encabezado en negritas sobre fondo oscuro
    const fuente = { name: 'Arial Nova', size: 11 };
    for (let c = 1; c <= 6; c++) ws.getColumn(c).font = fuente;
    ws.addRow(encabezado);
    ws.getRow(1).eachCell((c) => { c.font = { name: 'Arial Nova', size: 11, bold: true, color: { argb: 'FFE5E7EB' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; c.alignment = { horizontal: 'left' }; });
    const muni = nombreOficial(d.municipio);
    d.unidades.forEach((u, i) => {
      const L = colLetra(pal.cIni + i);
      pal.filasClave.forEach(({ r, clave }) => {
        const valor = pal.valores.get(`${L}|${r}`) || 0;
        ws.addRow([{ formula: `PALOTEO!$${L}$4`, result: u.clues }, clave, { formula: `PALOTEO!$${L}$${r}`, result: valor }, Number(d.mes), Number(d.anio), muni]);
      });
    });
    ws.autoFilter = { from: 'A1', to: `F${ws.rowCount}` };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    [16, 12, 10, 8, 8, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    return ws;
  }

  async function descargarExcel(d) {
    const resp = await fetch(PLANTILLA_URL);
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla del concentrado (Formatos/concentrado_municipal_plantilla.xlsx).');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await resp.arrayBuffer());
    const wp = wb.getWorksheet(PAL.hoja); const ws = wb.getWorksheet(SEG.hoja);
    if (!wp || !ws) throw new Error('La plantilla del concentrado no tiene las hojas PALOTEO y SEGUIMIENTO DE BIOLOGICO.');
    if (d.unidades.length === 0) throw new Error('Este municipio no tiene unidades activas.');

    // Biológicos en el orden de la plantilla (18 renglones fijos); los que no existan en el catálogo quedan en cero
    d.biologicosOrden = ORDEN_BIOLOGICOS.map((clave) => d.biologicos.find((b) => b.clave === clave) || { clave });

    const pal = llenarPaloteo(wp, d);
    llenarSeguimiento(ws, d, pal);
    agregarHojaCSV(wb, d, pal);

    // RECIBIDO VS REQUISICIÓN (hoja propia de la app: la plantilla de agosto no la trae); misma letra que el resto: Arial Nova 11
    const fuenteRec = { name: 'Arial Nova', size: 11 };
    const wr = wb.addWorksheet('RECIBIDO VS REQUISICION');
    for (let c = 1; c <= 7; c++) wr.getColumn(c).font = fuenteRec;
    ['Biológico', 'Lote', 'Caducidad requisición', 'Caducidad unidades', 'Requisición (frascos)', 'Suma unidades (frascos)', 'Coincide'].forEach((t, i) => {
      const c = wr.getCell(1, i + 1); c.value = t;
      c.font = { name: 'Arial Nova', size: 11, bold: true, color: { argb: 'FFE5E7EB' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    });
    d.requisicion.forEach((f, i) => {
      const r = i + 2;
      wr.getCell(r, 1).value = limpiar(f.biologico); wr.getCell(r, 2).value = f.numero_lote;
      wr.getCell(r, 3).value = f.caducidad_requisicion || ''; wr.getCell(r, 4).value = f.caducidad_unidades || '';
      wr.getCell(r, 5).value = num(f.requisicion); wr.getCell(r, 6).value = num(f.unidades);
      wr.getCell(r, 7).value = f.coincide ? 'SÍ' : 'NO';
      for (let c = 1; c <= 7; c++) wr.getCell(r, c).font = fuenteRec;
    });
    [40, 16, 20, 20, 20, 22, 10].forEach((w, i) => { wr.getColumn(i + 1).width = w; });
    wr.views = [{ state: 'frozen', ySplit: 1 }];

    wb.calcProperties = wb.calcProperties || {};
    wb.calcProperties.fullCalcOnLoad = true;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Concentrado_SIS_${d.municipio}_${d.mes}_${d.anio}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { variablesSinFila: pal.sinFila };
  }

  // ---- Tarjeta ---------------------------------------------------------------

  // Genera el Excel y avisa (toast) con lo mismo desde cualquier botón.
  async function descargarConAviso(d) {
    try {
      const r = await descargarExcel(d);
      if (r && r.variablesSinFila && r.variablesSinFila.length) toast(`Excel generado, pero ${r.variablesSinFila.length} variable(s) del catálogo no existen en la plantilla y no se incluyeron: ${r.variablesSinFila.slice(0, 6).join(', ')}.`, 'error');
      else toast('Excel del concentrado municipal generado.', 'ok');
      return true;
    } catch (err) { console.error('[SIS-06-P] Error generando el Excel del concentrado:', err); toast('No se pudo generar el Excel: ' + (err.message || err), 'error'); return false; }
  }

  // opciones.sinBoton: no pinta el botón de descarga (lo pone quien llama con la API devuelta).
  // opciones.sinRecibido: omite la sección de recibido (quien llama la pinta aparte con api.htmlRecibido()).
  // Devuelve { d, nDifRecibido, htmlRecibido(), descargar() } o null si no se pudo cargar.
  async function render(cont, municipio, mes, anio, opciones) {
    const op = opciones || {};
    cont.innerHTML = '<div style="font-size:11.5px; color:var(--muted); padding:6px 0;">Cargando concentrado municipal…</div>';
    let d;
    try {
      d = await cargarDatos(municipio, mes, anio);
    } catch (err) {
      console.error('[SIS-06-P] Error cargando el concentrado municipal:', err);
      cont.innerHTML = `<div style="font-size:11.5px; color:var(--error);">Error al cargar el concentrado municipal: ${esc(err.message || err)}</div>`;
      return null;
    }

    const nDifRecibido = d.requisicion.filter((f) => !f.coincide).length;
    const seccion = (titulo, cuerpo, abierta, insignia) => `
      <details ${abierta ? 'open' : ''} style="border:1px solid var(--outline-variant); border-radius:12px; background:#fff; margin-top:8px;">
        <summary style="cursor:pointer; padding:10px 14px; font-size:12.5px; font-weight:800; display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span>${titulo}</span>${insignia || ''}
        </summary>
        <div style="padding:4px 14px 14px;">${cuerpo}</div>
      </details>`;
    const insigniaRecibido = d.requisicion.length === 0 ? '' : (nDifRecibido > 0
      ? `<span style="font-size:10px; font-weight:800; background:var(--warning-bg); color:var(--warning); padding:2px 9px; border-radius:20px;">${nDifRecibido} no coincide(n)</span>`
      : '<span style="font-size:10px; font-weight:800; background:var(--success-bg); color:var(--success); padding:2px 9px; border-radius:20px;">Coincide</span>');

    cont.innerHTML = `
      ${op.sinBoton ? '' : `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px;">
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; color:var(--muted);">Concentrado municipal -- se arma solo con lo que capturan las unidades</div>
        <button type="button" class="btn-fantasma btn-mini" data-accion="excel"><span class="material-symbols-rounded">download</span> Descargar Excel del concentrado</button>
      </div>`}
      ${op.sinRecibido ? '' : seccion('Recibido: requisición vs. unidades', htmlRecibido(d), nDifRecibido > 0, insigniaRecibido)}
      ${seccion('Paloteo municipal (SIS-06-P)', htmlPaloteo(d), false)}
      ${seccion('Seguimiento de biológico', htmlSeguimiento(d), false)}
    `;
    const btn = cont.querySelector('[data-accion="excel"]');
    if (btn) btn.addEventListener('click', () => descargarConAviso(d));
    return { d, nDifRecibido, htmlRecibido: () => htmlRecibido(d), descargar: () => descargarConAviso(d) };
  }

  window.SIS06PConcentradoMunicipal = { render, ORDEN_BIOLOGICOS };
})();
