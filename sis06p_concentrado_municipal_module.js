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
      unidades: uRes.data || [], variables: vRes.data || [], capturaPorClues, segPorClave, movEstado,
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

  async function descargarExcel(d) {
    const mesNombre = (typeof MESES !== 'undefined' ? (MESES.find((m) => m.v === Number(d.mes)) || {}).l : '') || String(d.mes);
    const wb = new ExcelJS.Workbook();
    const negrita = { bold: true };
    const relleno = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const colLetra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

    // PALOTEO
    const wp = wb.addWorksheet('PALOTEO');
    wp.getCell('A1').value = `MUNICIPIO ${d.municipio} -- ${mesNombre.toUpperCase()} ${d.anio}`;
    wp.getCell('A1').font = { bold: true, size: 13 };
    const cabP = ['Biológico', 'Clave', 'Variable', 'Grupo / dosis'];
    const cIni = cabP.length + 1;
    const cFin = cIni + d.unidades.length - 1;
    cabP.forEach((t, i) => { const c = wp.getCell(4, i + 1); c.value = t; c.font = negrita; c.fill = relleno; });
    d.unidades.forEach((u, i) => {
      wp.getCell(3, cIni + i).value = u.nombre;
      const c = wp.getCell(4, cIni + i); c.value = u.clues; c.font = negrita; c.fill = relleno;
      wp.getCell(3, cIni + i).font = negrita;
    });
    const cTot = cFin + 1;
    wp.getCell(3, cTot).value = 'Total Municipal'; wp.getCell(3, cTot).font = negrita;
    const ct = wp.getCell(4, cTot); ct.value = 'Total Municipal'; ct.font = negrita; ct.fill = relleno;

    let fila = 5;
    const biologicosVar = [];
    d.variables.forEach((v) => { if (!biologicosVar.includes(v.biologico)) biologicosVar.push(v.biologico); });
    biologicosVar.forEach((bio) => {
      const vars = d.variables.filter((v) => v.biologico === bio);
      const filasTotales = [];
      TIPOS_CLAVE.forEach((tc) => {
        vars.forEach((v) => {
          if (!v[tc.campo]) return;
          wp.getCell(fila, 1).value = limpiar(bio);
          wp.getCell(fila, 2).value = v[tc.campo];
          wp.getCell(fila, 3).value = tc.tipo;
          wp.getCell(fila, 4).value = limpiar([v.grupo_poblacional, v.dosis !== v.grupo_poblacional ? v.dosis : '', v.edad].filter(Boolean).join(' · '));
          let suma = 0;
          d.unidades.forEach((u, i) => {
            const x = valorPaloteo(d, u.clues, v, tc.sub);
            if (x === null) return;
            suma += x;
            if (tc.sub === 'total' || x > 0) wp.getCell(fila, cIni + i).value = x;
          });
          wp.getCell(fila, cTot).value = d.unidades.length
            ? { formula: `SUM(${colLetra(cIni)}${fila}:${colLetra(cFin)}${fila})`, result: suma } : suma;
          if (tc.sub === 'total') filasTotales.push({ fila, suma });
          fila += 1;
        });
      });
      if (filasTotales.length) {
        wp.getCell(fila, 1).value = `TOTAL ${limpiar(bio)}`;
        wp.getCell(fila, 1).font = negrita;
        d.unidades.forEach((u, i) => {
          const col = colLetra(cIni + i);
          const res = filasTotales.reduce((a, f) => a + num(wp.getCell(f.fila, cIni + i).value), 0);
          wp.getCell(fila, cIni + i).value = { formula: filasTotales.map((f) => `${col}${f.fila}`).join('+'), result: res };
          wp.getCell(fila, cIni + i).font = negrita;
        });
        const sumaBio = filasTotales.reduce((a, f) => a + f.suma, 0);
        wp.getCell(fila, cTot).value = { formula: `SUM(${colLetra(cIni)}${fila}:${colLetra(cFin)}${fila})`, result: sumaBio };
        wp.getCell(fila, cTot).font = negrita;
        fila += 1;
      }
    });
    wp.getColumn(1).width = 34; wp.getColumn(2).width = 10; wp.getColumn(3).width = 15; wp.getColumn(4).width = 42;
    for (let c = cIni; c <= cTot; c++) wp.getColumn(c).width = 13;
    wp.views = [{ state: 'frozen', xSplit: 4, ySplit: 4 }];

    // SEGUIMIENTO DE BIOLOGICO
    const ws = wb.addWorksheet('SEGUIMIENTO DE BIOLOGICO');
    ws.getCell('A1').value = `MUNICIPIO ${d.municipio} -- ${mesNombre.toUpperCase()} ${d.anio}`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    const bios = biologicosConMovimiento(d);
    let fs = 3;
    BLOQUES.forEach((bl) => {
      const t = ws.getCell(fs, 1); t.value = bl.titulo.toUpperCase(); t.font = negrita; t.fill = relleno;
      d.unidades.forEach((u, i) => { const c = ws.getCell(fs, 2 + i); c.value = u.nombre; c.font = negrita; c.fill = relleno; });
      const ctt = ws.getCell(fs, 2 + d.unidades.length); ctt.value = 'Total'; ctt.font = negrita; ctt.fill = relleno;
      fs += 1;
      bios.forEach((b) => {
        ws.getCell(fs, 1).value = limpiar(b.nombre_excel || b.clave);
        let suma = 0;
        d.unidades.forEach((u, i) => {
          const f = d.segPorClave.get(`${u.clues}|${b.clave}`);
          if (!f) return;
          const x = Math.round(num(f[bl.key]) * 100) / 100;
          suma += x;
          ws.getCell(fs, 2 + i).value = x;
        });
        ws.getCell(fs, 2 + d.unidades.length).value = d.unidades.length
          ? { formula: `SUM(B${fs}:${colLetra(1 + d.unidades.length)}${fs})`, result: Math.round(suma * 100) / 100 } : 0;
        ws.getCell(fs, 2 + d.unidades.length).font = negrita;
        fs += 1;
      });
      fs += 1;
    });
    ws.getColumn(1).width = 34;
    for (let c = 2; c <= 2 + d.unidades.length; c++) ws.getColumn(c).width = 14;
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 0 }];

    // RECIBIDO VS REQUISICIÓN
    const wr = wb.addWorksheet('RECIBIDO VS REQUISICION');
    ['Biológico', 'Lote', 'Caducidad requisición', 'Caducidad unidades', 'Requisición (frascos)', 'Suma unidades (frascos)', 'Coincide'].forEach((t, i) => {
      const c = wr.getCell(1, i + 1); c.value = t; c.font = negrita; c.fill = relleno;
    });
    d.requisicion.forEach((f, i) => {
      const r = i + 2;
      wr.getCell(r, 1).value = limpiar(f.biologico); wr.getCell(r, 2).value = f.numero_lote;
      wr.getCell(r, 3).value = f.caducidad_requisicion || ''; wr.getCell(r, 4).value = f.caducidad_unidades || '';
      wr.getCell(r, 5).value = num(f.requisicion); wr.getCell(r, 6).value = num(f.unidades);
      wr.getCell(r, 7).value = f.coincide ? 'SÍ' : 'NO';
    });
    [40, 16, 20, 20, 20, 22, 10].forEach((w, i) => { wr.getColumn(i + 1).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Concentrado_SIS_${d.municipio}_${d.mes}_${d.anio}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Tarjeta ---------------------------------------------------------------

  async function render(cont, municipio, mes, anio) {
    cont.innerHTML = '<div style="font-size:11.5px; color:var(--muted); padding:6px 0;">Cargando concentrado municipal…</div>';
    let d;
    try {
      d = await cargarDatos(municipio, mes, anio);
    } catch (err) {
      console.error('[SIS-06-P] Error cargando el concentrado municipal:', err);
      cont.innerHTML = `<div style="font-size:11.5px; color:var(--error);">Error al cargar el concentrado municipal: ${esc(err.message || err)}</div>`;
      return;
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
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px;">
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; color:var(--muted);">Concentrado municipal -- se arma solo con lo que capturan las unidades</div>
        <button type="button" class="btn-fantasma btn-mini" data-accion="excel"><span class="material-symbols-rounded">download</span> Descargar Excel del concentrado</button>
      </div>
      ${seccion('Recibido: requisición vs. unidades', htmlRecibido(d), nDifRecibido > 0, insigniaRecibido)}
      ${seccion('Paloteo municipal (SIS-06-P)', htmlPaloteo(d), false)}
      ${seccion('Seguimiento de biológico', htmlSeguimiento(d), false)}
    `;
    const btn = cont.querySelector('[data-accion="excel"]');
    if (btn) btn.addEventListener('click', async () => {
      try { await descargarExcel(d); toast('Excel del concentrado municipal generado.', 'ok'); }
      catch (err) { console.error('[SIS-06-P] Error generando el Excel del concentrado:', err); toast('No se pudo generar el Excel: ' + (err.message || err), 'error'); }
    });
  }

  window.SIS06PConcentradoMunicipal = { render, ORDEN_BIOLOGICOS };
})();
