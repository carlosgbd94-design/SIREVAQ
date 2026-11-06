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
 *  - CATEGORIA    : el mismo lote aparece como Normal en un lado y A.R.F./Canje en el otro. Es lo esperado (el lote
 *                   sufrió un A.R.F. en el mes): NO se lista como diferencia, solo se cuenta en resumen.cambiosEstatus.
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

  function juntarEstatus(filas, res) {
    const s = (k) => filas.reduce((t, l) => t + l[k], 0);
    return { ...filas[0], cat: 'NORMAL', agregadas: filas, dAnt: res, mAnt: s('mAnt'), uAnt: s('uAnt'), mRec: s('mRec'), uRec: s('uRec'), mApl: s('mApl'), uApl: s('uApl'), mDes: s('mDes'), uDes: s('uDes') };
  }
  const filasPara = (l) => l.agregadas || [l];
  // Comentario (no error): frascos de estos lotes que cambiaron de estatus a A.R.F./Canje en el mes y ya van descontados.
  function comentariosEstatus(lotes) {
    return lotes.flatMap((l) => (l.agregadas || []).filter((x) => x.cat !== 'NORMAL' && Math.abs(x.dAnt) > EPS)
      .map((x) => `Lote ${l.lote}: ${q(Math.abs(x.dAnt))} frasco${Math.abs(x.dAnt) === 1 ? '' : 's'} pasaron a ${etiquetaCat(x.cat)} durante el mes. Es normal y ya está descontado de esta cuenta.`));
  }

  function tablaLotes(lotes) {
    return lotes.map((l) => ({ lote: l.lote, cat: l.cat, municipio: r2(l.mAnt), unidades: r2(l.uAnt), dif: r2(l.dAnt) }));
  }
  // Fila con el desglose: de la diferencia total, cuánto explica ESTA tarjeta y cuánto queda sin explicar.
  const filaConDesglose = (l, dif, explicado) => ({ lote: l.lote, cat: l.cat, municipio: r2(l.mAnt), unidades: r2(l.uAnt), dif: r2(dif), explicado: r2(explicado), queda: r2(dif - explicado) });

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
      // El lote se cruza con otros ya con el estatus neteado: Normal + A.R.F. + Canje del mismo lote cuentan como UN lote
      // (lo que pasó a A.R.F. en el mes no se cuenta como diferencia ni se muestra como fila aparte).
      if (Math.abs(res) > EPS) residual.push({ lote: filas.length > 1 ? juntarEstatus(filas, res) : filas[0], res });
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
      // Desglose por lote: de cada diferencia, lo que explica este cruce y lo que queda para la tarjeta de Conteo
      const explicadoPor = new Map();
      partes.forEach((x) => { const k = key(x.p.lote.loteId, x.p.lote.cat); explicadoPor.set(k, r2((explicadoPor.get(k) || 0) + x.cant)); });
      const filasCruce = [filaConDesglose(n.lote, n.res, -total)];
      const vistos = new Set();
      partes.forEach((x) => { const k = key(x.p.lote.loteId, x.p.lote.cat); if (vistos.has(k)) return; vistos.add(k); filasCruce.push(filaConDesglose(x.p.lote, x.p.res, explicadoPor.get(k))); });
      const quedan = filasCruce.filter((l) => Math.abs(l.queda) > EPS);
      const aviso = quedan.length ? ` Ojo: no todo queda explicado con este cruce. ${quedan.map((l) => `En el lote ${l.lote} la diferencia es de ${q(Math.abs(l.dif))} y aquí se explican ${q(Math.abs(l.explicado))}, quedan ${q(Math.abs(l.queda))} sin explicar (van en la tarjeta «Conteo distinto»)`).join('; ')}.` : '';
      const sosp = filasPara(n.lote).flatMap((l) => sospechasDe(idx, l, l.cat, null)).map((s) => ({ ...s, exacto: partes.some((x) => Math.abs(s.cantidad - x.cant) < EPS) || Math.abs(s.cantidad - total) < EPS }))
        .sort((a, b) => (b.exacto - a.exacto) || (b.cantidad - a.cantidad));
      causas.push({
        tipo: 'LOTE_CRUZADO', confianza: alta ? 'alta' : 'media', cantidad: total,
        titulo: `Lote ${n.lote.lote}: ${q(total)} frasco${total === 1 ? '' : 's'} declarados en el lote equivocado`,
        texto: `Las unidades declararon ${q(total)} frasco${total === 1 ? '' : 's'} de más en el lote ${n.lote.lote} y, al mismo tiempo, esa misma cantidad de menos en ${partes.map((x) => `el lote ${x.p.lote.lote}`).join(' y ')}. Como se cancelan, no falta ningún frasco: lo más probable es que una unidad anotó la existencia con el número de lote equivocado (${quien.join('; ')}).${aviso}`,
        accion: 'Revisa la etiqueta del frasco en el refrigerador de la unidad señalada. Si es del otro lote, corrígelo en «Por unidad» con «Cambiar lote» (conserva las cantidades); si esa unidad ya tiene fila del lote correcto, suma ahí la cantidad y elimina la equivocada. También puede ser un error del cierre manual de septiembre: la etiqueta decide.',
        lotes: filasCruce,
        comentarios: comentariosEstatus([n.lote, ...partes.map((x) => x.p.lote)]),
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
          texto: `${sobras.some((x) => Math.abs(x.lote.dAnt - x.res) > EPS) ? 'Esto es lo que QUEDA después de restar lo que explica el cruce de lotes (ver la tarjeta de arriba). ' : ''}Esta diferencia NO se compensa con otro lote: ${partes.join('; y ')}.${solo.length ? ` ${solo.length === 1 ? 'El lote' : 'Los lotes'} ${lotesTxt(solo)} no ${solo.length === 1 ? 'lo reporta' : 'los reportan'} ninguna unidad.` : ''}`,
          accion: soloMunMas
            ? 'Cuenta lo que hay en el almacén municipal de estos lotes. Si coincide con la diferencia, no hay nada que corregir; si esos frascos no existen, ajusta la existencia anterior del municipio (queda con motivo y auditoría).'
            : 'Pide a la unidad el conteo físico. Si el de la unidad es el correcto, ajusta la existencia anterior del municipio (queda con motivo y auditoría); si el cierre de septiembre es el correcto, la unidad debe corregir su declaración.',
          lotes: sobras.map((x) => filaConDesglose(x.lote, x.lote.dAnt, r2(x.lote.dAnt - x.res))),
          comentarios: comentariosEstatus(sobras.map((x) => x.lote)),
          sospechas: unidadesDeMas.flatMap((x) => filasPara(x.lote).flatMap((l) => sospechasDe(idx, l, l.cat, null)))
        });
      }
    }

    // Un lote que cambió de estatus (Normal → A.R.F./Canje) en el mes es lo ESPERADO, no un error: la unidad lo declara
    // ya como A.R.F. y el cierre del mes pasado lo traía como Normal. No se lista como diferencia; solo se cuenta.
    const cambiosEstatus = causas.filter((c) => c.tipo === 'CATEGORIA');
    for (let i = causas.length - 1; i >= 0; i--) if (causas[i].tipo === 'CATEGORIA') causas.splice(i, 1);
    const orden = { MOVIMIENTO: 0, LOTE_CRUZADO: 1, CONTEO: 2, FRACCION: 4 };
    causas.sort((a, b) => orden[a.tipo] - orden[b.tipo]);
    // Un solo panel: lo que el detector del servidor dice de estos lotes y ya explica una causa NO se repite.
    // Se conservan aparte los avisos con información propia (existencia negativa, ajuste a mano, no se explica…)
    // y las filas sin diferencia de cifras. La tabla «por unidad» del detector queda como detalle de las filas explicadas.
    const REDUNDANTES = ['ANTERIOR_DISTINTA', 'UNIDAD_CAMBIO_POSTERIOR', 'SOLO_MUNICIPIO'];
    const cubierta = (l) => Math.abs(l.dAnt) > EPS || l.dMov > EPS;
    const avisos = lotes.filter((l) => !(cubierta(l) && REDUNDANTES.includes(l.raw.tipo))).map((l) => l.raw);
    const detalles = lotes.filter((l) => cubierta(l) && Array.isArray(l.raw.detalle) && l.raw.detalle.length).map((l) => l.raw);
    const hayError = avisos.some((f) => f.severidad === 'ERROR');
    const explicado = !avisos.length && causas.length > 0 && causas.every((c) => (c.tipo === 'LOTE_CRUZADO' && c.confianza === 'alta') || c.tipo === 'FRACCION');
    // Nombre y presentación del biológico para el título (la 1ª línea es el nombre; el resto, la presentación)
    const partesNombre = String(lotes[0].raw.biologico == null ? bio : lotes[0].raw.biologico).split('\n').map((x) => x.trim()).filter(Boolean);
    const nombre = partesNombre[0] || bio; const presentacion = partesNombre.slice(1).join(' ');
    const lotesN = new Set(lotes.map((l) => l.loteId || l.lote)).size;
    const unidadesN = new Set(causas.flatMap((c) => c.sospechas.map((x) => x.unidad))).size;
    // Frascos en juego: lo que sobra de un lado (o del otro) en la existencia anterior de este biológico
    const sumPos = lotes.filter((l) => l.dAnt > 0).reduce((t, l) => t + l.dAnt, 0); const sumNeg = lotes.filter((l) => l.dAnt < 0).reduce((t, l) => t - l.dAnt, 0);
    const frascos = r2(Math.max(sumPos, sumNeg));
    return { biologico: bio, nombre, presentacion, lotesN, unidadesN, frascos, causas, cambiosEstatus, avisos, detalles, explicado, requiereDecision: hayError || causas.some((c) => (c.tipo === 'CONTEO' && c.sentido !== 'municipio_mas') || c.tipo === 'MOVIMIENTO') };
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
    const grupos = []; const cambios = [];
    porBio.forEach((lotes, bio) => {
      const g = diagnosticarGrupo(bio, lotes, idx);
      cambios.push(...g.cambiosEstatus);
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
        porTipo: { LOTE_CRUZADO: cuenta('LOTE_CRUZADO'), CONTEO: cuenta('CONTEO'), FRACCION: cuenta('FRACCION'), MOVIMIENTO: cuenta('MOVIMIENTO') },
        cambiosEstatus: cambios.length, frascosCambioEstatus: r2(cambios.reduce((t, c) => t + c.cantidad, 0)),
        avisos: grupos.reduce((s, g) => s + g.avisos.length, 0),
        frascosCruzados: r2(cruzados.reduce((s, c) => s + c.cantidad, 0))
      }
    };
  }

  // ----------------------------------------------------------------------- presentación
  // Lenguaje visual propio: "libro de cuentas". Sin tarjetas con borde de color ni chips: tipografía grande para el biológico,
  // el número de frascos en juego a la derecha, estado con un punto + palabra, barras de datos para las unidades y un
  // diagrama de flujo para el lote cruzado.
  const TITULO_TIPO = { MOVIMIENTO: 'Movimiento distinto', CONTEO: 'Conteo distinto', LOTE_CRUZADO: 'Lote cruzado', CATEGORIA: 'Estatus distinto', FRACCION: 'Fracción de frasco' };

  function injectCss() {
    if (typeof document === 'undefined') return;
    const previo = document.getElementById('dxEstilos');
    if (previo) previo.remove();
    const st = document.createElement('style');
    st.id = 'dxEstilos';
    st.textContent = `
      .dx-caja{--dx-tinta:var(--on-surface,#0f172a);--dx-suave:var(--on-surface-variant,#64748b);--dx-linea:var(--outline-variant,#dbe2ea);--dx-acento:var(--primary,#4f46e5);--dx-fondo:var(--surface-container,#f1f5f9);
        --dx-decide:#e11d48;--dx-conf:#d97706;--dx-ok:#059669;margin:0 0 16px;border-radius:20px;background:var(--surface,#fff);color:var(--dx-tinta);border:1px solid var(--dx-linea);overflow:hidden}
      .dx-cab{padding:22px 24px 18px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px 32px;align-items:end}
      .dx-cab-t>b{display:block;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--dx-suave);font-weight:700}
      .dx-total{display:flex;align-items:baseline;gap:10px;margin-top:6px}
      .dx-total .dx-num{display:inline;text-transform:none;letter-spacing:-.04em;color:var(--dx-tinta);font-size:54px;line-height:.95;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
      .dx-total span{font-size:15px;font-weight:600;max-width:15ch;line-height:1.2}
      .dx-cab small{display:block;margin-top:8px;font-size:12px;color:var(--dx-suave)}
      .dx-prop{display:flex;height:10px;border-radius:99px;overflow:hidden;gap:3px;background:transparent}
      .dx-prop i{display:block;border-radius:99px;min-width:10px}
      .dx-prop .decide{background:var(--dx-decide)}.dx-prop .rev{background:var(--dx-conf)}.dx-prop .ok{background:var(--dx-ok)}
      .dx-leyenda{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px;font-size:13px;font-weight:600}
      .dx-leyenda span{display:inline-flex;align-items:center;gap:7px}
      .dx-leyenda b{font-size:15px;font-variant-numeric:tabular-nums}
      .dx-pt{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
      .decide>.dx-pt,.dx-pt.decide{background:var(--dx-decide)}.rev>.dx-pt,.dx-pt.rev{background:var(--dx-conf)}.ok>.dx-pt,.dx-pt.ok{background:var(--dx-ok)}
      .dx-lista{list-style:none;margin:0;padding:0 10px 6px;counter-reset:dxb}
      .dx-bio{border-top:1px solid var(--dx-linea);counter-increment:dxb}
      .dx-lista>li:first-child>.dx-bio{border-top:0}
      .dx-bio>summary{cursor:pointer;display:grid;grid-template-columns:34px minmax(0,1fr) auto auto 26px;gap:4px 18px;align-items:center;padding:18px 14px;list-style:none;border-radius:14px}
      .dx-bio>summary::-webkit-details-marker{display:none}
      .dx-bio>summary::before{content:counter(dxb,decimal-leading-zero);font-size:13px;font-weight:700;color:var(--dx-suave);font-variant-numeric:tabular-nums;align-self:start;padding-top:5px}
      .dx-bio>summary:hover{background:var(--dx-fondo)}
      .dx-bio>summary:focus-visible{outline:2px solid var(--dx-acento);outline-offset:-2px}
      .dx-bio-nom{min-width:0}
      .dx-bio-nom strong{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.1;overflow-wrap:anywhere}
      .dx-bio-nom small{display:block;font-size:13px;color:var(--dx-suave);margin-top:4px}
      .dx-bio-nom em{display:block;font-style:normal;font-size:12px;font-weight:700;margin-top:6px;color:var(--dx-acento)}
      .dx-frascos{text-align:right;line-height:1}
      .dx-frascos b{display:block;font-size:30px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
      .dx-frascos small{font-size:11px;color:var(--dx-suave);font-weight:600}
      .dx-est{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;white-space:nowrap;min-width:122px}
      .dx-chev{font-size:24px;color:var(--dx-suave);transition:transform .18s}
      .dx-bio[open] .dx-chev{transform:rotate(180deg)}
      .dx-cuerpo{padding:2px 14px 22px 66px}
      .dx-causa{padding:18px 0 4px;margin-top:6px;border-top:1px dashed var(--dx-linea);font-size:14px;line-height:1.55}
      .dx-causa:first-child{border-top:0;margin-top:0}
      .dx-kick{display:flex;gap:10px;align-items:baseline;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:800;color:var(--dx-acento)}
      .dx-kick span{color:var(--dx-suave);font-weight:600;letter-spacing:.04em}
      .dx-causa h4{margin:4px 0 6px;font-size:17px;font-weight:700;letter-spacing:-.01em}
      .dx-causa p{margin:4px 0;max-width:92ch}
      .dx-flujo{display:grid;gap:14px;margin:16px 0 8px}
      .dx-flujo-f{display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,.55fr) minmax(0,1fr);align-items:center;gap:6px}
      .dx-nodo b{display:block;font-size:19px;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
      .dx-nodo small{display:block;font-size:12px;color:var(--dx-suave);margin-top:2px}
      .dx-nodo .q{color:var(--dx-conf);font-weight:700}
      .dx-nodo .cap{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dx-suave);font-weight:700;margin-bottom:3px}
      .dx-flecha{position:relative;text-align:center;font-size:13px;font-weight:800;padding-bottom:11px}
      .dx-flecha::after{content:'';position:absolute;left:0;right:5px;bottom:4px;border-bottom:2px solid var(--dx-acento)}
      .dx-flecha::before{content:'';position:absolute;right:0;bottom:0;width:8px;height:8px;border-top:2px solid var(--dx-acento);border-right:2px solid var(--dx-acento);transform:translateY(-1px) rotate(45deg);transform-origin:center}
      .dx-cuenta{margin:12px 0 4px;font-size:12px}.dx-cuenta>summary{cursor:pointer;font-weight:700;color:var(--dx-suave)}
      .dx-tabla-wrap{overflow-x:auto;max-width:100%}
      .dx-tabla{width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0;font-variant-numeric:tabular-nums}
      .dx-tabla th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dx-suave);font-weight:700}
      .dx-tabla th,.dx-tabla td{padding:6px 10px;text-align:right;border-bottom:1px solid var(--dx-linea)}
      .dx-tabla th:first-child,.dx-tabla td:first-child{text-align:left;font-weight:700}
      .dx-lote-t{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin:18px 0 8px}
      .dx-lote-t b{font-size:14px}.dx-lote-t span{font-size:12px;color:var(--dx-suave)}
      .dx-barras{display:grid;gap:3px}
      .dx-barra{display:grid;grid-template-columns:minmax(120px,230px) minmax(60px,1fr) 38px;align-items:center;gap:12px;font-size:12.5px;padding:3px 0}
      .dx-barra>span{min-width:0;overflow-wrap:anywhere}
      .dx-barra>i{display:block;height:8px;border-radius:99px;background:linear-gradient(90deg,var(--dx-tinta) var(--w),transparent var(--w));opacity:.22}
      .dx-barra.ex>i{background:linear-gradient(90deg,var(--dx-acento) var(--w),transparent var(--w));opacity:1}
      .dx-barra.ex>span{font-weight:800}
      .dx-barra>b{text-align:right;font-size:14px;font-variant-numeric:tabular-nums}
      .dx-coment{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--dx-suave)}.dx-coment .material-symbols-rounded{font-size:16px}
      .dx-accion{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:16px 0 6px;padding-top:12px;border-top:1px solid var(--dx-linea)}
      .dx-accion b{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--dx-acento);padding-top:2px;white-space:nowrap}
      .dx-avisos{list-style:none;margin:10px 0 0;padding:0}.dx-det{margin-top:12px;font-size:12px}.dx-det>summary{cursor:pointer;font-weight:700}
      .dx-nota{display:flex;gap:8px;align-items:center;margin:0;padding:12px 24px 16px;font-size:12px;color:var(--dx-suave)}.dx-nota .material-symbols-rounded{font-size:16px}
      .dx-ok{display:flex;gap:8px;align-items:center;padding:12px 14px;font-size:13px}
      @media (max-width:760px){
        .dx-cab{grid-template-columns:1fr;padding:18px 16px 14px}.dx-num{font-size:44px}
        .dx-lista{padding:0 4px 4px}
        .dx-bio>summary{grid-template-columns:minmax(0,1fr) 26px;padding:16px 10px}
        .dx-bio>summary::before{display:none}
        .dx-bio-nom{grid-column:1}.dx-chev{grid-column:2;grid-row:1}
        .dx-frascos{grid-column:1;text-align:left;display:flex;align-items:baseline;gap:8px}.dx-frascos b{font-size:24px}
        .dx-est{grid-column:1}
        .dx-cuerpo{padding:0 10px 18px}
        .dx-flujo-f{grid-template-columns:1fr;gap:8px}.dx-flecha{text-align:left;padding-left:2px}
        .dx-barra{grid-template-columns:minmax(0,1fr) 36px}.dx-barra>i{grid-column:1 / -1;grid-row:2}
        .dx-accion{grid-template-columns:1fr}
      }`;
    document.head.appendChild(st);
  }

  // Diagrama de flujo del lote cruzado: dónde lo anotaron las unidades → dónde probablemente estaba.
  function htmlFlujo(c) {
    const destino = c.lotes.find((l) => l.explicado !== undefined && l.dif < 0);
    const origenes = c.lotes.filter((l) => l.explicado !== undefined && l.dif > 0 && l.explicado > 0);
    if (!destino || !origenes.length) return '';
    const dq = Math.abs(destino.queda);
    return `<div class="dx-flujo" role="group" aria-label="Cómo se cruzan los lotes">${origenes.map((o, i) => `<div class="dx-flujo-f">
        <div class="dx-nodo"><div class="cap">Las unidades lo anotaron en</div><b>${esc(destino.lote)}</b><small>declararon ${q(Math.abs(destino.dif))} de más${i === 0 && dq > EPS ? ` · <span class="q">quedan ${q(dq)} sin explicar</span>` : ''}</small></div>
        <div class="dx-flecha">${q(o.explicado)} frasco${o.explicado === 1 ? '' : 's'}</div>
        <div class="dx-nodo"><div class="cap">¿Será en realidad?</div><b>${esc(o.lote)}</b><small>el municipio tiene ${q(o.dif)} de más</small></div></div>`).join('')}</div>`;
  }

  function htmlCausa(c, vistos) {
    vistos = vistos || new Set();
    const desglose = c.lotes.some((l) => l.explicado !== undefined);
    const sg = (n) => (n > 0 ? '+' : '') + q(n);
    const filas = c.lotes.map((l) => `<tr><td>${esc(l.lote)}${l.cat !== 'NORMAL' ? ` <small>(${esc(etiquetaCat(l.cat))})</small>` : ''}</td><td>${q(l.municipio)}</td><td>${q(l.unidades)}</td><td>${sg(l.dif)}</td>${desglose ? `<td>${sg(l.explicado)}</td><td>${sg(l.queda)}</td>` : ''}</tr>`).join('');
    const nota = c.lotes.find((l) => l.nota);
    // Todas las unidades, agrupadas por lote, como barras proporcionales y con su suma (para cuadrarla con la tabla)
    const grupos = new Map();
    c.sospechas.forEach((s) => { const k = s.lote + '|' + s.cat; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(s); });
    const sosp = [...grupos.entries()].map(([k, arr]) => {
      const suma = r2(arr.reduce((t, s) => t + s.cantidad, 0));
      const s0 = arr[0];
      const titulo = `Lote ${esc(s0.lote)}${s0.cat !== 'NORMAL' ? ' (' + esc(etiquetaCat(s0.cat)) + ')' : ''}`;
      // Las mismas unidades no se listan dos veces en el mismo biológico: la 2ª tarjeta remite a la 1ª
      if (vistos.has(k)) return `<div class="dx-lote-t"><b>${titulo}</b><span>mismas ${arr.length} unidades del apartado de arriba (suman ${q(suma)})</span></div>`;
      vistos.add(k);
      const max = Math.max(...arr.map((s) => s.cantidad), 1);
      const orden = arr.slice(0, 60).slice().sort((a, b) => b.cantidad - a.cantidad);
      return `<div class="dx-lote-t"><b>${titulo}</b><span>${arr.length} unidad${arr.length === 1 ? '' : 'es'}, suman ${q(suma)}</span></div>
        <div class="dx-barras">${orden.map((s) => `<div class="dx-barra${s.exacto ? ' ex' : ''}"><span>${esc(s.unidad)}${s.exacto ? ' · coincide justo con la diferencia' : ''}</span><i style="--w:${Math.max(4, Math.round(s.cantidad / max * 100))}%"></i><b>${q(s.cantidad)}</b></div>`).join('')}</div>`;
    }).join('');
    const cuenta = `<details class="dx-cuenta"${desglose ? ' open' : ''}><summary>Cuenta por lote</summary><div class="dx-tabla-wrap"><table class="dx-tabla"><caption class="sr-only" style="position:absolute;left:-9999px">Lotes involucrados</caption><thead><tr><th scope="col">Lote</th><th scope="col">${nota ? 'Municipio' : 'Anterior municipio'}</th><th scope="col">${nota ? 'Unidades' : 'Anterior unidades'}</th><th scope="col">Diferencia</th>${desglose ? '<th scope="col">Explica este cruce</th><th scope="col">Sin explicar</th>' : ''}</tr></thead><tbody>${filas}</tbody></table></div></details>`;
    return `<div class="dx-causa">
      <div class="dx-kick">${esc(TITULO_TIPO[c.tipo])} <span>confianza ${esc(c.confianza)}</span></div>
      <h4>${esc(c.titulo)}</h4>${c.tipo === 'LOTE_CRUZADO' ? htmlFlujo(c) : ''}<p>${esc(c.texto)}</p>${(c.comentarios || []).map((t) => `<p class="dx-coment"><span class="material-symbols-rounded" aria-hidden="true">info</span> ${esc(t)}</p>`).join('')}
      ${cuenta}${sosp}<div class="dx-accion"><b>Qué hacer</b><span>${esc(c.accion)}</span></div></div>`;
  }

  // opts.htmlAviso(f): pinta un aviso del detector del servidor; opts.htmlDetalle(f): su tabla por unidad.
  function htmlExtras(g, opts) {
    const o = opts || {};
    const avisos = (g.avisos && o.htmlAviso) ? `<ul class="dx-avisos disc-lista">${g.avisos.map(o.htmlAviso).join('')}</ul>` : '';
    const det = (g.detalles && o.htmlDetalle && g.detalles.length)
      ? `<details class="dx-det"><summary>Ver lo que declaró cada unidad en estos lotes</summary>${g.detalles.map((f) => `<p><b>Lote ${esc(f.numero_lote)}</b></p>${o.htmlDetalle(f)}`).join('')}</details>` : '';
    return (avisos || det) ? `<div class="dx-causa">${avisos}${det}</div>` : '';
  }

  // Nota (no es un aviso): lotes que pasaron a A.R.F./Canje en el mes. Es lo esperado, por eso no se lista como diferencia.
  function htmlNotaEstatus(res) {
    const r = res && res.resumen;
    if (!r || !r.cambiosEstatus) return '';
    const n = r.cambiosEstatus;
    return `<p class="dx-nota"><span class="material-symbols-rounded" aria-hidden="true">info</span> ${n} lote${n === 1 ? '' : 's'} cambió${n === 1 ? '' : ' '}de estatus a A.R.F. o Canje durante el mes (${q(r.frascosCambioEstatus)} frascos): es lo esperado y no se cuenta como diferencia.</p>`;
  }

  function htmlDiagnostico(res, opts) {
    injectCss();
    if (!res || !res.grupos.length) return '';
    const r = res.resumen;
    const porConfirmar = r.biologicos - r.requierenDecision - r.explicados;
    const seg = (cls, n) => (n > 0 ? `<i class="${cls}" style="flex:${n}"></i>` : '');
    const ley = (cls, n, txt) => `<span class="${cls}"><i class="dx-pt ${cls}"></i><b>${n}</b> ${txt}</span>`;
    const items = res.grupos.map((g, i) => {
      const est = g.requiereDecision ? 'decide' : g.explicado ? 'ok' : 'rev';
      const txtEst = est === 'decide' ? 'Requiere tu decisión' : est === 'ok' ? 'Causa identificada' : 'Por confirmar';
      const tipos = g.causas.map((c) => TITULO_TIPO[c.tipo]).concat(g.avisos.length ? [`${g.avisos.length} aviso${g.avisos.length === 1 ? '' : 's'}`] : []).join(' · ');
      const meta = `${g.lotesN} lote${g.lotesN === 1 ? '' : 's'}${g.unidadesN ? ` · ${g.unidadesN} unidad${g.unidadesN === 1 ? '' : 'es'}` : ''}`;
      const fr = g.frascos > EPS ? `<span class="dx-frascos"><b>${q(g.frascos)}</b><small>frasco${g.frascos === 1 ? '' : 's'} en juego</small></span>` : '<span class="dx-frascos"></span>';
      return `<li><details class="dx-bio ${est}"${g.requiereDecision && i < 3 ? ' open' : ''}><summary>
        <span class="dx-bio-nom"><strong>${esc(g.nombre)}</strong><small>${esc(g.presentacion ? g.presentacion + ' · ' : '')}${esc(meta)}</small><em>${esc(tipos)}</em></span>
        ${fr}<span class="dx-est ${est}"><i class="dx-pt"></i>${txtEst}</span><span class="material-symbols-rounded dx-chev" aria-hidden="true">expand_more</span></summary>
        <div class="dx-cuerpo">${(() => { const vistos = new Set(); return g.causas.map((c) => htmlCausa(c, vistos)).join(''); })()}${htmlExtras(g, opts)}</div></details></li>`;
    }).join('');
    return `<section class="dx-caja" aria-label="Asistente de revisión">
      <div class="dx-cab"><div class="dx-cab-t"><b>Revisión de unidades contra municipio</b>
        <div class="dx-total"><b class="dx-num">${r.biologicos}</b> <span>biológico${r.biologicos === 1 ? '' : 's'} con diferencia</span></div>
        <small>Solo explica y sugiere: no cambia ninguna cifra; tú decides.</small></div>
        <div><div class="dx-prop" role="img" aria-label="${r.requierenDecision} por decidir, ${porConfirmar} por confirmar, ${r.explicados} con causa identificada">${seg('decide', r.requierenDecision)}${seg('rev', porConfirmar)}${seg('ok', r.explicados)}</div>
        <div class="dx-leyenda">${ley('decide', r.requierenDecision, 'por decidir')}${ley('rev', porConfirmar, 'por confirmar')}${ley('ok', r.explicados, 'con causa identificada')}</div></div></div>
      <ul class="dx-lista">${items}</ul>${htmlNotaEstatus(res)}</section>`;
  }

  const api = { diagnosticar, htmlDiagnostico, htmlNotaEstatus, distancia };
  root.DiagnosticoSIS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
