/**
 * concentrado_motor.js — Cálculo puro del panel "Concentrado de Aplicaciones" (sin DOM, sin red).
 * Lo usa concentrado_ui.js (navegador) y tests/concentrado-panel.spec.js (Node).
 *
 * Entrada: filas ya agregadas por el servidor (unidad × biológico para el rango elegido, el mismo rango del año
 * anterior y la serie mensual municipio × biológico × mes). Salida: totales, participación, comparación contra el
 * año anterior, composición por unidad/municipio, ritmo mensual y hallazgos redactados.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ConcentradoMotor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Orden del esquema (el mismo de biologicos_catalogo) + etiqueta. Los colores de pantalla NO salen de aquí: 17
  // categorías no se pueden distinguir por color, así que solo los 8 de mayor volumen tienen matiz propio (ver SLOTS).
  const BIOLOGICOS = [
    ['BCG', 'BCG'], ['HEPATITIS B', 'Hepatitis B'], ['HEXAVALENTE', 'Hexavalente'], ['DPT', 'DPT'], ['ROTAVIRUS', 'Rotavirus'],
    ['NEUMOCOCICA 13', 'Neumocócica 13'], ['NEUMOCOCICA 20', 'Neumocócica 20'], ['SRP', 'SRP'], ['SR', 'SR'], ['VPH', 'VPH'],
    ['VARICELA', 'Varicela'], ['HEPATITIS A', 'Hepatitis A'], ['TD', 'TD'], ['TDPA', 'TDPA'], ['COVID-19', 'COVID-19'],
    ['INFLUENZA', 'Influenza'], ['VSR', 'VSR']
  ].map(([key, label]) => ({ key, label }));
  const LABEL = {};
  BIOLOGICOS.forEach((b) => { LABEL[b.key] = b.label; });
  LABEL.OTROS = 'Otros / sin clasificar';

  // Ranuras categóricas fijas (el color sigue a la vacuna, no a su posición en el ranking). Orden = orden de apilado.
  // Tonos de la paleta de referencia validada (dataviz/palette.md); el resto de biológicos va en gris neutro.
  const SLOTS = [
    ['INFLUENZA', '#2a78d6'], ['COVID-19', '#eb6834'], ['HEXAVALENTE', '#1baf7a'], ['NEUMOCOCICA 13', '#eda100'],
    ['SRP', '#e87ba4'], ['ROTAVIRUS', '#008300'], ['VPH', '#6250d6'], ['TDPA', '#e34948']
  ];
  const COLOR = {};
  SLOTS.forEach(([k, c]) => { COLOR[k] = c; });
  const COLOR_OTROS = '#94a3b8';
  const colorDe = (key) => COLOR[key] || COLOR_OTROS;
  const ORDEN_APILADO = SLOTS.map((s) => s[0]);

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MES3 = MESES.map((m) => m.slice(0, 3));

  const normUp = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = (v) => Number(v) || 0;
  const labelDe = (key) => LABEL[key] || key;

  function indexa(filas) {
    const m = new Map();
    (filas || []).forEach((r) => {
      let o = m.get(r.clues);
      if (!o) { o = {}; m.set(r.clues, o); }
      o[r.biologico] = (o[r.biologico] || 0) + num(r.total_dosis);
    });
    return m;
  }

  const sumaSel = (porBio, selSet) => {
    if (!porBio) return 0;
    let t = 0;
    for (const k in porBio) if (!selSet || selSet.has(k)) t += porBio[k];
    return t;
  };
  const cambio = (actual, previo) => (previo > 0 ? (actual - previo) / previo : null);

  /**
   * @param {{unidades:{clues,nombre,municipio}[], filas:any[], filasPrev:any[]|null, sel?:string[], municipio?:string, busqueda?:string}} e
   */
  function analiza(e) {
    const selSet = e.sel && e.sel.length ? new Set(e.sel) : null;
    const hayPrev = !!(e.filasPrev && e.filasPrev.length);
    const idx = indexa(e.filas), idxPrev = indexa(e.filasPrev);

    const alcance = (e.unidades || []).filter((u) => (!e.municipio || normUp(u.municipio) === e.municipio)
      && (!e.busqueda || normUp(u.nombre).includes(e.busqueda) || normUp(u.clues).includes(e.busqueda)));

    const unidades = alcance.map((u) => {
      const porBio = idx.get(u.clues) || {};
      const porBioPrev = idxPrev.get(u.clues) || {};
      const total = sumaSel(porBio, selSet), prev = sumaSel(porBioPrev, selSet);
      return {
        clues: u.clues, nombre: u.nombre, municipio: u.municipio, muni: normUp(u.municipio),
        porBio, total, prev, delta: hayPrev ? cambio(total, prev) : null,
        totalTodas: sumaSel(porBio, null), prevTodas: sumaSel(porBioPrev, null)
      };
    });

    const total = unidades.reduce((s, u) => s + u.total, 0);
    const prev = unidades.reduce((s, u) => s + u.prev, 0);
    const totalTodas = unidades.reduce((s, u) => s + u.totalTodas, 0);
    unidades.forEach((u) => { u.share = total > 0 ? u.total / total : 0; });

    // Biológicos dentro del alcance (municipio/búsqueda), SIN aplicar el filtro de biológico: alimentan los chips
    const acum = {}, acumPrev = {};
    unidades.forEach((u) => {
      for (const k in u.porBio) acum[k] = (acum[k] || 0) + u.porBio[k];
      const pp = idxPrev.get(u.clues) || {};
      for (const k in pp) acumPrev[k] = (acumPrev[k] || 0) + pp[k];
    });
    const conocidas = BIOLOGICOS.map((b) => b.key);
    const llaves = conocidas.concat(Object.keys(acum).concat(Object.keys(acumPrev)).filter((k, i, arr) => !conocidas.includes(k) && arr.indexOf(k) === i));
    const porBio = llaves.map((k) => ({
      key: k, label: labelDe(k), color: colorDe(k), total: acum[k] || 0, prev: acumPrev[k] || 0,
      share: totalTodas > 0 ? (acum[k] || 0) / totalTodas : 0, delta: hayPrev ? cambio(acum[k] || 0, acumPrev[k] || 0) : null
    }));

    const munis = new Map();
    unidades.forEach((u) => {
      let m = munis.get(u.muni);
      if (!m) { m = { muni: u.muni, nombre: u.municipio, total: 0, prev: 0, n: 0, conDatos: 0, porBio: {} }; munis.set(u.muni, m); }
      m.total += u.total; m.prev += u.prev; m.n++;
      if (u.totalTodas > 0) m.conDatos++;
      for (const k in u.porBio) if (!selSet || selSet.has(k)) m.porBio[k] = (m.porBio[k] || 0) + u.porBio[k];
    });
    const porMuni = [...munis.values()].map((m) => ({ ...m, share: total > 0 ? m.total / total : 0, delta: hayPrev ? cambio(m.total, m.prev) : null }))
      .sort((a, b) => b.total - a.total);

    return {
      hayPrev, selSet, unidades, porBio, porMuni, total, prev, delta: hayPrev ? cambio(total, prev) : null, totalTodas,
      nUnidades: unidades.length, conDatos: unidades.filter((u) => u.totalTodas > 0).length,
      promedio: (() => { const c = unidades.filter((u) => u.total > 0).length; return c ? total / c : 0; })()
    };
  }

  /** Segmentos apilados de una composición: los 8 con matiz propio en orden fijo, el resto junto en gris. */
  function segmentos(porBio, selSet) {
    const segs = [];
    let otros = 0, otrosLista = [];
    ORDEN_APILADO.forEach((k) => { const v = porBio[k] || 0; if (v > 0 && (!selSet || selSet.has(k))) segs.push({ key: k, label: labelDe(k), color: colorDe(k), v }); });
    for (const k in porBio) {
      if (ORDEN_APILADO.includes(k) || (selSet && !selSet.has(k))) continue;
      const v = porBio[k] || 0;
      if (v > 0) { otros += v; otrosLista.push({ label: labelDe(k), v }); }
    }
    if (otros > 0) segs.push({ key: 'OTROS_GRIS', label: 'Otros biológicos', color: COLOR_OTROS, v: otros, detalle: otrosLista.sort((a, b) => b.v - a.v) });
    return segs;
  }

  /**
   * Ritmo mensual del año consultado y del anterior. `mensual*`: filas {municipio, biologico, mes, total_dosis, unidades_mes}.
   * Un mes está "incompleto" cuando reportaron menos del 60% de las unidades que reportan en el mes más completo del año.
   */
  function serieMensual(mensual, mensualPrev, o) {
    const selSet = o && o.sel && o.sel.length ? new Set(o.sel) : null;
    const muni = o && o.municipio ? o.municipio : '';
    const arma = (filas) => {
      const tot = Array(13).fill(0), und = Array(13).fill(0), vistos = {};
      (filas || []).forEach((r) => {
        const mm = num(r.mes); if (mm < 1 || mm > 12) return;
        // Unidades por mes: se cuentan en TODA la jurisdicción para saber si el mes está completo, no solo en el filtro
        const k = normUp(r.municipio) + '|' + mm;
        if (!vistos[k]) { vistos[k] = true; und[mm] += num(r.unidades_mes); }
        if (muni && normUp(r.municipio) !== muni) return;
        if (selSet && !selSet.has(r.biologico)) return;
        tot[mm] += num(r.total_dosis);
      });
      const maxU = Math.max(0, ...und);
      return { tot, und, incompleto: und.map((n, i) => i > 0 && n > 0 && n < maxU * 0.6), maxU, conDatos: und.map((n) => n > 0) };
    };
    const a = arma(mensual), p = arma(mensualPrev);
    const meses = [];
    for (let m = 1; m <= 12; m++) {
      meses.push({ mes: m, total: a.tot[m], prev: p.tot[m], unidades: a.und[m], unidadesPrev: p.und[m], maxU: a.maxU, maxUPrev: p.maxU,
        incompleto: a.incompleto[m], incompletoPrev: p.incompleto[m], conDatos: a.conDatos[m], conDatosPrev: p.conDatos[m] });
    }
    return meses;
  }

  const fmt = (n) => Math.round(num(n)).toLocaleString('es-MX');
  const pctTxt = (d) => (d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 100)).toLocaleString('es-MX')}%`);
  const rangoTxt = (ini, fin, anio) => (ini === fin ? `${MESES[ini - 1].toLowerCase()} ${anio}` : `${MES3[ini - 1].toLowerCase()}–${MES3[fin - 1].toLowerCase()} ${anio}`);

  /**
   * Hallazgos redactados a partir de los datos (solo los que realmente aplican). Cada uno: {id, tipo, titulo, texto, accion?}.
   * tipo: 'alerta' (pide atención), 'info' (contexto), 'bien' (buena noticia).
   */
  function hallazgos(an, ctx) {
    const out = [];
    const c = ctx || {};
    const unidades = an.unidades;
    if (!unidades.length) return out;

    // 1. Unidades sin una sola aplicación en el periodo (solo tiene sentido si el resto sí capturó)
    const sin = unidades.filter((u) => u.totalTodas === 0);
    if (sin.length && an.totalTodas > 0) {
      out.push({
        id: 'sin-captura', tipo: 'alerta', icono: 'event_busy',
        titulo: `${sin.length} ${sin.length === 1 ? 'unidad' : 'unidades'} sin aplicaciones`,
        texto: `${sin.slice(0, 3).map((u) => u.nombre).join(', ')}${sin.length > 3 ? ` y ${sin.length - 3} más` : ''} no ${sin.length === 1 ? 'registra' : 'registran'} dosis en ${c.rango || 'el periodo'}. Revisa si falta captura del SIS.`,
        accion: { tipo: 'orden', valor: 'sin' }
      });
    }

    // 2. Caídas fuertes contra el mismo periodo del año anterior
    if (an.hayPrev) {
      const caidas = unidades.filter((u) => u.prev >= 100 && u.delta != null && u.delta <= -0.4 && u.total > 0).sort((a, b) => (a.total - a.prev) - (b.total - b.prev));
      if (caidas.length) {
        out.push({
          id: 'caidas', tipo: 'alerta', icono: 'trending_down',
          titulo: `${caidas.length} ${caidas.length === 1 ? 'unidad cae' : 'unidades caen'} 40% o más`,
          texto: `${caidas.slice(0, 3).map((u) => `${u.nombre} (${pctTxt(u.delta)})`).join(', ')}${caidas.length > 3 ? ` y ${caidas.length - 3} más` : ''}, contra ${c.rangoPrev || 'el año anterior'}.`,
          accion: { tipo: 'orden', valor: 'caida' }
        });
      }
      const alzas = unidades.filter((u) => u.prev >= 100 && u.delta != null && u.delta >= 0.4).sort((a, b) => (b.total - b.prev) - (a.total - a.prev));
      if (alzas.length) {
        out.push({
          id: 'alzas', tipo: 'bien', icono: 'trending_up',
          titulo: `${alzas.length} ${alzas.length === 1 ? 'unidad sube' : 'unidades suben'} 40% o más`,
          texto: `${alzas.slice(0, 3).map((u) => `${u.nombre} (${pctTxt(u.delta)})`).join(', ')}${alzas.length > 3 ? ` y ${alzas.length - 3} más` : ''}.`,
          accion: { tipo: 'orden', valor: 'alza' }
        });
      }
    }

    // 3. Biológicos con movimiento fuerte contra el año anterior o que se quedaron en cero
    if (an.hayPrev) {
      const cero = an.porBio.filter((b) => b.key !== 'OTROS' && b.total === 0 && b.prev >= 50);
      if (cero.length) {
        out.push({
          id: 'bio-cero', tipo: 'alerta', icono: 'vaccines',
          titulo: `${cero.map((b) => b.label).slice(0, 3).join(', ')}${cero.length > 3 ? '…' : ''}: en cero`,
          texto: `${cero.length === 1 ? 'No tiene' : 'No tienen'} aplicaciones en ${c.rango || 'el periodo'}; ${c.rangoPrev || 'el año anterior'} ${cero.length === 1 ? 'sumó' : 'sumaron'} ${cero.map((b) => `${fmt(b.prev)} (${b.label})`).join(', ')}.`,
          accion: { tipo: 'bio', valor: cero[0].key }
        });
      }
      const mov = an.porBio.filter((b) => b.total > 0 && b.prev >= 200 && b.delta != null).sort((x, y) => Math.abs(y.total - y.prev) - Math.abs(x.total - x.prev))[0];
      if (mov && Math.abs(mov.delta) >= 0.25) {
        out.push({
          id: 'bio-mov', tipo: mov.delta > 0 ? 'bien' : 'alerta', icono: mov.delta > 0 ? 'trending_up' : 'trending_down',
          titulo: `${mov.label} ${mov.delta > 0 ? 'crece' : 'baja'} ${pctTxt(Math.abs(mov.delta)).replace('+', '')}`,
          texto: `${fmt(mov.total)} dosis contra ${fmt(mov.prev)} en ${c.rangoPrev || 'el año anterior'}: es el biológico que más se movió.`,
          accion: { tipo: 'bio', valor: mov.key }
        });
      }
    }

    // 4. Concentración: pocas unidades se llevan buena parte de las dosis
    const top = unidades.filter((u) => u.total > 0).sort((a, b) => b.total - a.total);
    if (top.length >= 10 && an.total > 0) {
      const n = 5, suma = top.slice(0, n).reduce((s, u) => s + u.total, 0);
      out.push({
        id: 'concentracion', tipo: 'info', icono: 'donut_small',
        titulo: `${n} unidades concentran el ${Math.round(suma * 100 / an.total)}%`,
        texto: `${top.slice(0, n).map((u) => u.nombre).join(', ')} suman ${fmt(suma)} de ${fmt(an.total)} dosis; las otras ${top.length - n} reparten el resto.`,
        accion: { tipo: 'orden', valor: 'total' }
      });
    }
    return out;
  }

  /** Meses dentro del rango con captura parcial (año actual o anterior), para avisar que la comparación no es pareja. */
  function avisosDeComparacion(meses, ini, fin, anio) {
    const av = [];
    meses.filter((m) => m.mes >= ini && m.mes <= fin).forEach((m) => {
      if (m.incompletoPrev) av.push(`${MES3[m.mes - 1].toLowerCase()}-${String(anio - 1).slice(2)} tiene captura parcial (${m.unidadesPrev} de ${m.maxUPrev} unidades por municipio)`);
      if (m.incompleto) av.push(`${MES3[m.mes - 1].toLowerCase()}-${String(anio).slice(2)} tiene captura parcial (${m.unidades} de ${m.maxU} unidades por municipio)`);
    });
    return av;
  }

  function ordena(unidades, orden) {
    const a = unidades.slice();
    const porNombre = (x, y) => x.nombre.localeCompare(y.nombre, 'es');
    if (orden === 'nombre') return a.sort(porNombre);
    if (orden === 'caida') return a.filter((u) => u.delta != null).sort((x, y) => x.delta - y.delta || y.prev - x.prev).concat(a.filter((u) => u.delta == null).sort((x, y) => y.total - x.total));
    if (orden === 'alza') return a.filter((u) => u.delta != null).sort((x, y) => y.delta - x.delta || y.total - x.total).concat(a.filter((u) => u.delta == null).sort((x, y) => y.total - x.total));
    if (orden === 'sin') return a.sort((x, y) => (y.totalTodas === 0) - (x.totalTodas === 0) || x.total - y.total || porNombre(x, y));
    return a.sort((x, y) => y.total - x.total || porNombre(x, y));
  }

  return { BIOLOGICOS, SLOTS, COLOR_OTROS, MESES, MES3, normUp, labelDe, colorDe, analiza, segmentos, serieMensual, hallazgos, avisosDeComparacion, ordena, fmt, pctTxt, rangoTxt, cambio };
});
