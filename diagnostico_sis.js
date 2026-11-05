/**
 * Asistente de revisión del municipal (SIS / Movimiento de Biológico).
 *
 * SOLO LEE Y EXPLICA: no escribe nada ni cambia ninguna cifra. Toma lo que ya calcula el detector del servidor
 * (`biovac_discrepancias_municipio`: municipio vs. suma de unidades, por lote) más la evidencia por unidad
 * (`biovac_diagnostico_unidades`) y responde, por biológico, la pregunta que el detector no contesta: ¿POR QUÉ no cuadra
 * y qué hago? Las causas que reconoce:
 *
 *  - LOTE_CRUZADO : las diferencias de existencia anterior entre lotes del mismo biológico se CANCELAN (+12 en un lote,
 *                   −5 y −7 en otros): nadie perdió frascos, una unidad declaró la existencia en otro lote (casi siempre un
 *                   error de dedo: 0374MA108 vs 0374MA109). Señala qué unidad declaró esa cantidad.
 *  - CATEGORIA    : el mismo lote aparece como Normal en un lado y A.R.F./Canje en el otro.
 *  - CONTEO       : la diferencia no se cancela: las unidades contaron más/menos de lo que dejó el cierre del mes pasado.
 *  - FRACCION     : menos de un frasco de diferencia (multidosis abierto, redondeo).
 *  - MOVIMIENTO   : difieren recibido/aplicadas/desechadas (una unidad cambió después de sincronizar o se ajustó a mano).
 *
 * El motor propone y ordena; el municipal decide. Es una función pura (sin DOM ni red) para poder probarla con datos reales.
 */
(function (root) {
  'use strict';

  const EPS = 0.005;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => String(r2(n));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normBio = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const normLote = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const etiquetaCat = (c) => (c === 'ARF' ? 'A.R.F.' : c === 'CANJE' ? 'Canje' : 'Normal');

  // Distancia de edición (cuántos caracteres cambian de un lote a otro). 1–2 = casi seguro error de dedo.
  function distancia(a, b) {
    a = normLote(a); b = normLote(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  const key = (loteId, cat) => `${loteId}|${cat}`;

  function filasDeLote(f) {
    return {
      raw: f, loteId: f.lote_id, lote: f.numero_lote, cat: f.categoria || 'NORMAL', bio: normBio(f.biologico), cad: f.caducidad || null,
      mAnt: Number(f.mun_anterior) || 0, uAnt: Number(f.uni_anterior) || 0,
      dAnt: r2((Number(f.mun_anterior) || 0) - (Number(f.uni_anterior) || 0)),
      dMov: r2(Math.abs((Number(f.mun_recibido) || 0) - (Number(f.uni_recibido) || 0))
        + Math.abs((Number(f.mun_aplicadas) || 0) - (Number(f.uni_aplicadas) || 0))
        + Math.abs((Number(f.mun_desechadas) || 0) - (Number(f.uni_desechadas) || 0))),
      mRec: Number(f.mun_recibido) || 0, uRec: Number(f.uni_recibido) || 0,
      mApl: Number(f.mun_aplicadas) || 0, uApl: Number(f.uni_aplicadas) || 0,
      mDes: Number(f.mun_desechadas) || 0, uDes: Number(f.uni_desechadas) || 0
    };
  }

  // Unidades que declararon existencia anterior en ese lote/estatus (la evidencia de "quién").
  function sospechasDe(idx, lote, cat, cantidad) {
    return (idx.get(key(lote.loteId, cat)) || [])
      .filter((u) => (Number(u.anterior) || 0) > EPS)
      .map((u) => ({ unidad: u.unidad, clues: u.clues, lote: lote.lote, cat, cantidad: r2(u.anterior), exacto: cantidad != null && Math.abs(r2(u.anterior) - cantidad) < EPS }))
      .sort((a, b) => (b.exacto - a.exacto) || (b.cantidad - a.cantidad));
  }

  function tablaLotes(lotes) {
    return lotes.map((l) => ({ lote: l.lote, cat: l.cat, municipio: r2(l.mAnt), unidades: r2(l.uAnt), dif: r2(l.dAnt) }));
  }

  function diagnosticarGrupo(bio, lotes, idx) {
    const causas = [];

    // 1) Recibido / aplicadas / desechadas distintos: no es un tema de lotes, es que algo cambió.
    const conMov = lotes.filter((l) => l.dMov > EPS);
    if (conMov.length) {
      causas.push({
        tipo: 'MOVIMIENTO', confianza: 'alta', cantidad: 0,
        titulo: 'Lo recibido, aplicado o desechado no coincide',
        texto: `En ${conMov.map((l) => `lote ${l.lote}`).join(', ')} el municipio tiene cifras de movimiento distintas a la suma de las unidades. Pasa cuando una unidad cambió su Movimiento después de sincronizar, o cuando el municipio se ajustó a mano.`,
        accion: 'Abre la unidad que cambió y pulsa Guardar para que se vuelva a sumar; si el ajuste a mano fue a propósito, confírmalo con la jurisdicción.',
        lotes: conMov.flatMap((l) => [['recibido', l.mRec, l.uRec], ['aplicadas', l.mApl, l.uApl], ['desechadas', l.mDes, l.uDes]]
          .filter(([, m, un]) => Math.abs(m - un) > EPS)
          .map(([campo, m, un]) => ({ lote: `${l.lote} · ${campo}`, cat: l.cat, municipio: r2(m), unidades: r2(un), dif: r2(m - un), nota: 'Cifra' }))),
        sospechas: []
      });
    }

    // 2) Existencia anterior: primero el cambio de ESTATUS dentro de un mismo lote (Normal ↔ A.R.F. ↔ Canje).
    const porLote = new Map();
    lotes.filter((l) => Math.abs(l.dAnt) > EPS).forEach((l) => {
      if (!porLote.has(l.loteId)) porLote.set(l.loteId, []);
      porLote.get(l.loteId).push(l);
    });
    const residual = []; // { lote(base), res }
    porLote.forEach((filas) => {
      const pos = filas.filter((l) => l.dAnt > 0); const neg = filas.filter((l) => l.dAnt < 0);
      const sumPos = r2(pos.reduce((s, l) => s + l.dAnt, 0)); const sumNeg = r2(neg.reduce((s, l) => s - l.dAnt, 0));
      const mov = Math.min(sumPos, sumNeg);
      if (mov > EPS) {
        const lugarMun = pos.map((l) => etiquetaCat(l.cat)).join(' / '); const lugarUni = neg.map((l) => etiquetaCat(l.cat)).join(' / ');
        causas.push({
          tipo: 'CATEGORIA', confianza: 'alta', cantidad: mov,
          titulo: `Lote ${filas[0].lote}: el estatus no es el mismo`,
          texto: `${q(mov)} frasco${mov === 1 ? '' : 's'} de este lote el municipio los tiene como ${lugarMun} y las unidades los declararon como ${lugarUni}. No falta nada: es el mismo lote con otro estatus (Normal, A.R.F. o Canje).`,
          accion: `Confirma con la unidad si ese lote está retenido (A.R.F.), en canje o normal, y deja el mismo estatus en las dos partes.`,
          lotes: tablaLotes(filas),
          sospechas: neg.flatMap((l) => sospechasDe(idx, l, l.cat, null))
        });
      }
      const res = r2(filas.reduce((s, l) => s + l.dAnt, 0));
      if (Math.abs(res) > EPS) residual.push({ lote: filas[0], res });
    });

    // 3) Lotes cruzados: lo que sobra en un lote aparece de menos en otro del mismo biológico.
    const P = residual.filter((x) => x.res > 0).map((x) => ({ ...x, rem: x.res }));
    const N = residual.filter((x) => x.res < 0).map((x) => ({ ...x, rem: -x.res }));
    const netoGrupo = r2(residual.reduce((s, x) => s + x.res, 0));
    const grupoCancela = Math.abs(netoGrupo) < EPS && residual.length >= 2;
    const pares = [];
    for (;;) {
      let mejor = null;
      P.forEach((p) => N.forEach((n) => {
        if (p.rem <= EPS || n.rem <= EPS) return;
        const dist = distancia(p.lote.lote, n.lote.lote);
        const igual = Math.abs(p.rem - n.rem) < EPS;
        if (!grupoCancela && !igual && dist > 2) return; // sin evidencia suficiente: no se adivina
        const puntaje = (igual ? 0 : 10) + dist;
        if (!mejor || puntaje < mejor.puntaje) mejor = { p, n, dist, igual, puntaje };
      }));
      if (!mejor) break;
      const cant = r2(Math.min(mejor.p.rem, mejor.n.rem));
      mejor.p.rem = r2(mejor.p.rem - cant); mejor.n.rem = r2(mejor.n.rem - cant);
      pares.push({ ...mejor, cant });
    }
    // Un lote que recibe varios pares se explica junto (ej. 12 = 7 + 5): se agrupa por el lote donde las unidades de más.
    const porDestino = new Map();
    pares.forEach((pr) => {
      const k = key(pr.n.lote.loteId, pr.n.lote.cat);
      if (!porDestino.has(k)) porDestino.set(k, { n: pr.n, partes: [] });
      porDestino.get(k).partes.push(pr);
    });
    porDestino.forEach(({ n, partes }) => {
      const total = r2(partes.reduce((s, x) => s + x.cant, 0));
      const quien = partes.map((x) => `${q(x.cant)} del lote ${x.p.lote.lote}${x.dist <= 2 ? ' (lote casi igual)' : ''}${x.p.lote.cad && x.p.lote.cad === n.lote.cad ? ' (misma caducidad)' : ''}`);
      const alta = grupoCancela || partes.every((x) => x.dist <= 2);
      const sosp = sospechasDe(idx, n.lote, n.lote.cat, null).map((s) => ({ ...s, exacto: partes.some((x) => Math.abs(s.cantidad - x.cant) < EPS) || Math.abs(s.cantidad - total) < EPS }))
        .sort((a, b) => (b.exacto - a.exacto) || (b.cantidad - a.cantidad));
      causas.push({
        tipo: 'LOTE_CRUZADO', confianza: alta ? 'alta' : 'media', cantidad: total,
        titulo: `Lote ${n.lote.lote}: ${q(total)} frasco${total === 1 ? '' : 's'} declarados en el lote equivocado`,
        texto: `Las unidades declararon ${q(total)} frasco${total === 1 ? '' : 's'} de más en el lote ${n.lote.lote} y, al mismo tiempo, esa misma cantidad de menos en ${partes.map((x) => `el lote ${x.p.lote.lote}`).join(' y ')}. Como se cancelan, no falta ningún frasco: lo más probable es que una unidad anotó la existencia con el número de lote equivocado (${quien.join('; ')}).`,
        accion: 'Revisa la etiqueta del frasco en el refrigerador de la unidad señalada. Si es del otro lote, corrígelo en «Por unidad» con «Cambiar lote» (conserva las cantidades); si esa unidad ya tiene fila del lote correcto, suma ahí la cantidad y elimina la equivocada. También puede ser un error del cierre manual de septiembre: la etiqueta decide.',
        lotes: tablaLotes([n.lote, ...partes.map((x) => x.p.lote)]),
        sospechas: sosp
      });
    });

    // 4) Lo que no se canceló.
    const sobras = [...P, ...N].filter((x) => x.rem > EPS).map((x) => ({ lote: x.lote, res: r2(x.res > 0 ? x.rem : -x.rem) }));
    if (sobras.length) {
      const total = r2(sobras.reduce((s, x) => s + x.res, 0));
      const fraccion = sobras.every((x) => Math.abs(x.res) < 1);
      const solo = sobras.filter((x) => x.res > 0 && x.lote.uAnt === 0 && x.lote.uRec === 0 && x.lote.uApl === 0);
      const lotesTxt = (arr) => arr.map((x) => `${x.lote.lote}${x.lote.cat !== 'NORMAL' ? ' (' + etiquetaCat(x.lote.cat) + ')' : ''}`).join(', ');
      const unidadesDeMas = sobras.filter((x) => x.res < 0); const unidadesDeMenos = sobras.filter((x) => x.res > 0);
      if (fraccion) {
        causas.push({
          tipo: 'FRACCION', confianza: 'media', cantidad: Math.abs(total),
          titulo: 'Diferencia menor a un frasco',
          texto: `Queda una diferencia de ${q(Math.abs(total))} frasco en ${lotesTxt(sobras)}. En frascos multidosis suele ser un frasco abierto o un redondeo de dosis, no dosis perdidas.`,
          accion: 'Si el conteo físico de la unidad es correcto, déjalo así; si no, ajusta la existencia anterior del municipio con motivo.',
          lotes: tablaLotes(sobras.map((x) => x.lote)), sospechas: []
        });
      } else {
        const soloMunMas = unidadesDeMas.length === 0; // el municipio trae más que sus unidades: lo normal es existencia en el almacén municipal
        const partes = [];
        if (unidadesDeMenos.length) partes.push(`el municipio tiene ${q(unidadesDeMenos.reduce((s, x) => s + x.res, 0))} frasco(s) más que la suma de las unidades en ${lotesTxt(unidadesDeMenos)}. Si esos frascos están en el almacén municipal (o en una unidad que no declaró), es normal: ninguna unidad los reporta`);
        if (unidadesDeMas.length) partes.push(`las unidades declararon ${q(-unidadesDeMas.reduce((s, x) => s + x.res, 0))} frasco(s) de MÁS que el cierre del mes pasado en ${lotesTxt(unidadesDeMas)}: alguien contó de más o el cierre de septiembre quedó corto`);
        causas.push({
          tipo: 'CONTEO', confianza: 'media', cantidad: r2(sobras.reduce((s, x) => s + Math.abs(x.res), 0)), sentido: soloMunMas ? 'municipio_mas' : 'unidades_mas',
          titulo: soloMunMas ? 'El municipio tiene más existencia que la suma de sus unidades' : 'El conteo de las unidades no coincide con el cierre del mes pasado',
          texto: `Esta diferencia NO se compensa con otro lote: ${partes.join('; y ')}.${solo.length ? ` ${solo.length === 1 ? 'El lote' : 'Los lotes'} ${lotesTxt(solo)} no ${solo.length === 1 ? 'lo reporta' : 'los reportan'} ninguna unidad.` : ''}`,
          accion: soloMunMas
            ? 'Cuenta lo que hay en el almacén municipal de estos lotes. Si coincide con la diferencia, no hay nada que corregir; si esos frascos no existen, ajusta la existencia anterior del municipio (queda con motivo y auditoría).'
            : 'Pide a la unidad el conteo físico. Si el de la unidad es el correcto, ajusta la existencia anterior del municipio (queda con motivo y auditoría); si el cierre de septiembre es el correcto, la unidad debe corregir su declaración.',
          lotes: tablaLotes(sobras.map((x) => x.lote)),
          sospechas: unidadesDeMas.flatMap((x) => sospechasDe(idx, x.lote, x.lote.cat, null)).slice(0, 8)
        });
      }
    }

    const orden = { MOVIMIENTO: 0, CONTEO: 1, LOTE_CRUZADO: 2, CATEGORIA: 3, FRACCION: 4 };
    causas.sort((a, b) => orden[a.tipo] - orden[b.tipo]);
    // Un solo panel: lo que el detector del servidor dice de estos lotes y ya explica una causa NO se repite.
    // Se conservan aparte los avisos con información propia (existencia negativa, ajuste a mano, no se explica…)
    // y las filas sin diferencia de cifras. La tabla «por unidad» del detector queda como detalle de las filas explicadas.
    const REDUNDANTES = ['ANTERIOR_DISTINTA', 'UNIDAD_CAMBIO_POSTERIOR', 'SOLO_MUNICIPIO'];
    const cubierta = (l) => Math.abs(l.dAnt) > EPS || l.dMov > EPS;
    const avisos = lotes.filter((l) => !(cubierta(l) && REDUNDANTES.includes(l.raw.tipo))).map((l) => l.raw);
    const detalles = lotes.filter((l) => cubierta(l) && Array.isArray(l.raw.detalle) && l.raw.detalle.length).map((l) => l.raw);
    const hayError = avisos.some((f) => f.severidad === 'ERROR');
    const explicado = !avisos.length && causas.length > 0 && causas.every((c) => (c.tipo === 'LOTE_CRUZADO' && c.confianza === 'alta') || c.tipo === 'CATEGORIA' || c.tipo === 'FRACCION');
    return { biologico: bio, causas, avisos, detalles, explicado, requiereDecision: hayError || causas.some((c) => (c.tipo === 'CONTEO' && c.sentido !== 'municipio_mas') || c.tipo === 'MOVIMIENTO') };
  }

  /**
   * @param discrepancias filas de biovac_discrepancias_municipio
   * @param unidades      filas de biovac_diagnostico_unidades
   * @returns { grupos, resumen }
   */
  function diagnosticar(discrepancias, unidades) {
    const idx = new Map();
    (unidades || []).forEach((u) => {
      const k = key(u.lote_id, u.categoria || 'NORMAL');
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(u);
    });
    const porBio = new Map();
    (discrepancias || []).forEach((f) => {
      const l = filasDeLote(f);
      if (!porBio.has(l.bio)) porBio.set(l.bio, []);
      porBio.get(l.bio).push(l);
    });
    const grupos = [];
    porBio.forEach((lotes, bio) => {
      const g = diagnosticarGrupo(bio, lotes, idx);
      if (g.causas.length || g.avisos.length) grupos.push(g);
    });
    const peso = (g) => (g.requiereDecision ? 0 : g.explicado ? 2 : 1);
    grupos.sort((a, b) => peso(a) - peso(b) || a.biologico.localeCompare(b.biologico, 'es'));
    const cuenta = (t) => grupos.filter((g) => g.causas.some((c) => c.tipo === t)).length;
    const cruzados = grupos.flatMap((g) => g.causas).filter((c) => c.tipo === 'LOTE_CRUZADO');
    return {
      grupos,
      resumen: {
        biologicos: grupos.length,
        explicados: grupos.filter((g) => g.explicado).length,
        requierenDecision: grupos.filter((g) => g.requiereDecision).length,
        porTipo: { LOTE_CRUZADO: cuenta('LOTE_CRUZADO'), CATEGORIA: cuenta('CATEGORIA'), CONTEO: cuenta('CONTEO'), FRACCION: cuenta('FRACCION'), MOVIMIENTO: cuenta('MOVIMIENTO') },
        avisos: grupos.reduce((s, g) => s + g.avisos.length, 0),
        frascosCruzados: r2(cruzados.reduce((s, c) => s + c.cantidad, 0))
      }
    };
  }

  // ----------------------------------------------------------------------- presentación
  const TITULO_TIPO = { MOVIMIENTO: 'Movimiento distinto', CONTEO: 'Conteo distinto', LOTE_CRUZADO: 'Lote cruzado', CATEGORIA: 'Estatus distinto', FRACCION: 'Fracción de frasco' };
  const ICONO_TIPO = { MOVIMIENTO: 'sync_problem', CONTEO: 'calculate', LOTE_CRUZADO: 'swap_horiz', CATEGORIA: 'label', FRACCION: 'science' };

  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('dxEstilos')) return;
    const st = document.createElement('style');
    st.id = 'dxEstilos';
    st.textContent = `
      .dx-caja{margin:0 0 12px;border:1px solid var(--outline-variant,#cbd5e1);border-radius:14px;background:var(--surface,#fff);overflow:hidden}
      .dx-cab{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;background:var(--surface-container,#f1f5f9)}
      .dx-cab .material-symbols-rounded{font-size:22px;color:var(--primary,#1d4ed8);flex:none}
      .dx-cab b{display:block;font-size:14px}.dx-cab small{display:block;font-size:12px;opacity:.8;margin-top:2px}
      .dx-lista{list-style:none;margin:0;padding:0}
      .dx-bio{border-top:1px solid var(--outline-variant,#e2e8f0)}
      .dx-bio>summary{cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;font-size:13px;font-weight:700;list-style:none}
      .dx-bio>summary::-webkit-details-marker{display:none}
      .dx-chip{font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;background:var(--surface-container,#e2e8f0)}
      .dx-chip.ok{background:#dcfce7;color:#166534}.dx-chip.decide{background:#fee2e2;color:#991b1b}.dx-chip.rev{background:#fef3c7;color:#92400e}
      .dx-causa{padding:2px 14px 12px 14px;font-size:13px;line-height:1.45}
      .dx-causa h4{display:flex;gap:6px;align-items:center;margin:10px 0 4px;font-size:13px}
      .dx-causa h4 .material-symbols-rounded{font-size:18px}
      .dx-causa p{margin:4px 0}.dx-accion{background:var(--surface-container,#f1f5f9);border-radius:10px;padding:8px 10px}
      .dx-tabla{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}
      .dx-tabla th,.dx-tabla td{padding:4px 8px;text-align:right;border-bottom:1px solid var(--outline-variant,#e2e8f0)}
      .dx-tabla th:first-child,.dx-tabla td:first-child{text-align:left}
      .dx-sosp{margin:6px 0 0;padding-left:18px;font-size:12px}.dx-sosp li.ex{font-weight:800}
      .dx-avisos{list-style:none;margin:8px 0 0;padding:0}.dx-det{margin-top:8px;font-size:12px}.dx-det>summary{cursor:pointer;font-weight:700}
      .dx-ok{display:flex;gap:8px;align-items:center;padding:12px 14px;font-size:13px}`;
    document.head.appendChild(st);
  }

  function htmlCausa(c) {
    const filas = c.lotes.map((l) => `<tr><td>${esc(l.lote)}${l.cat !== 'NORMAL' ? ` <small>(${esc(etiquetaCat(l.cat))})</small>` : ''}</td><td>${q(l.municipio)}</td><td>${q(l.unidades)}</td><td>${l.dif > 0 ? '+' : ''}${q(l.dif)}</td></tr>`).join('');
    const nota = c.lotes.find((l) => l.nota);
    const sosp = c.sospechas.length
      ? `<p><b>Unidades que declararon ese lote:</b></p><ul class="dx-sosp">${c.sospechas.slice(0, 8).map((s) => `<li class="${s.exacto ? 'ex' : ''}">${esc(s.unidad)} · lote ${esc(s.lote)}${s.cat !== 'NORMAL' ? ' (' + esc(etiquetaCat(s.cat)) + ')' : ''}: declaró ${q(s.cantidad)}${s.exacto ? ' — coincide justo con la diferencia' : ''}</li>`).join('')}</ul>` : '';
    return `<div class="dx-causa">
      <h4><span class="material-symbols-rounded" aria-hidden="true">${ICONO_TIPO[c.tipo]}</span>${esc(TITULO_TIPO[c.tipo])} · <span style="font-weight:600">confianza ${esc(c.confianza)}</span></h4>
      <p><b>${esc(c.titulo)}</b></p><p>${esc(c.texto)}</p>
      <table class="dx-tabla"><caption class="sr-only" style="position:absolute;left:-9999px">Lotes involucrados</caption><thead><tr><th scope="col">Lote</th><th scope="col">${nota ? 'Municipio' : 'Anterior municipio'}</th><th scope="col">${nota ? 'Unidades' : 'Anterior unidades'}</th><th scope="col">Diferencia</th></tr></thead><tbody>${filas}</tbody></table>
      ${sosp}<p class="dx-accion"><b>Qué hacer:</b> ${esc(c.accion)}</p></div>`;
  }

  // opts.htmlAviso(f): pinta un aviso del detector del servidor; opts.htmlDetalle(f): su tabla por unidad.
  function htmlExtras(g, opts) {
    const o = opts || {};
    const avisos = (g.avisos && o.htmlAviso) ? `<ul class="dx-avisos disc-lista">${g.avisos.map(o.htmlAviso).join('')}</ul>` : '';
    const det = (g.detalles && o.htmlDetalle && g.detalles.length)
      ? `<details class="dx-det"><summary>Ver lo que declaró cada unidad en estos lotes</summary>${g.detalles.map((f) => `<p><b>Lote ${esc(f.numero_lote)}</b></p>${o.htmlDetalle(f)}`).join('')}</details>` : '';
    return (avisos || det) ? `<div class="dx-causa">${avisos}${det}</div>` : '';
  }

  function htmlDiagnostico(res, opts) {
    injectCss();
    if (!res || !res.grupos.length) return '';
    const r = res.resumen;
    const partes = [];
    if (r.avisos) partes.push(`${r.avisos} aviso${r.avisos === 1 ? '' : 's'} del sistema`);
    if (r.porTipo.LOTE_CRUZADO) partes.push(`${r.porTipo.LOTE_CRUZADO} por lote cruzado (${q(r.frascosCruzados)} frascos anotados en otro lote)`);
    if (r.porTipo.CATEGORIA) partes.push(`${r.porTipo.CATEGORIA} por estatus distinto`);
    if (r.porTipo.FRACCION) partes.push(`${r.porTipo.FRACCION} por fracción de frasco`);
    if (r.porTipo.CONTEO) partes.push(`${r.porTipo.CONTEO} por conteo distinto`);
    if (r.porTipo.MOVIMIENTO) partes.push(`${r.porTipo.MOVIMIENTO} por movimiento cambiado`);
    const items = res.grupos.map((g, i) => {
      const chip = g.requiereDecision ? '<span class="dx-chip decide">Requiere tu decisión</span>' : g.explicado ? '<span class="dx-chip ok">Causa identificada</span>' : '<span class="dx-chip rev">Por confirmar</span>';
      const tipos = g.causas.map((c) => `<span class="dx-chip">${esc(TITULO_TIPO[c.tipo])}</span>`).join('');
      return `<li><details class="dx-bio"${g.requiereDecision && i < 3 ? ' open' : ''}><summary><span>${esc(g.biologico)}</span>${chip}${tipos}</summary>${g.causas.map(htmlCausa).join('')}${htmlExtras(g, opts)}</details></li>`;
    }).join('');
    return `<section class="dx-caja" aria-label="Asistente de revisión">
      <div class="dx-cab"><span class="material-symbols-rounded" aria-hidden="true">psychology_alt</span>
        <div><b>Revisión de unidades contra municipio: ${r.biologicos} biológico${r.biologicos === 1 ? '' : 's'} con diferencia (${r.requierenDecision} por decidir · ${r.explicados} con causa identificada)</b>
        <small>${esc(partes.join(' · '))}. Solo explica y sugiere: no cambia ninguna cifra; tú decides.</small></div></div>
      <ul class="dx-lista">${items}</ul></section>`;
  }

  const api = { diagnosticar, htmlDiagnostico, distancia };
  root.DiagnosticoSIS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
