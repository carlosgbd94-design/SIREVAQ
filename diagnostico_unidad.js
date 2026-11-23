/**
 * diagnostico_unidad.js — Diagnóstico explicativo de una unidad de salud (SIREVAQ).
 *
 * Qué hace: con lo que SIREVAQ ya tiene (capturas del SIS en registros_sis, poblaciones y RDA) ordena los problemas
 * de la unidad por dosis que faltan, explica de dónde vienen (tendencia, contra el año anterior, retención por
 * cohorte, calidad del dato, unidades parecidas) y deja elegir causa y compromiso del mes.
 *
 * NO modifica la fórmula del RDA: las coberturas se calculan igual (dosis / (población × 0.0833 × meses)) y la de
 * menores de 1 año suma BCG + Hep B + Hexa 3ª + Rota 2ª + Neumo 2ª entre 4 (criterio estatal).
 *
 * Datos: UNA consulta (rpc get_diagnostico_unidad, ~5 KB) y la tabla diagnostico_compromisos para guardar lo elegido.
 * Diseño: motor y textos son funciones puras (probadas en Node); la vista vive en Shadow DOM para que los resets
 * globales !important de style.css no deformen botones ni selectores.
 *   DiagnosticoUnidad.open({ clues })  -> ventana emergente
 */
(function (root) {
  'use strict';

  const F = 0.0833;
  const MESN = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES1 = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const KEYS = ['bcg', 'hepb', 'h1', 'h2', 'h3', 'href', 'r2', 'n1', 'n2', 'nref', 's1', 's2', 'dpt'];
  // [nombre, grupo de población]: m1 = menores de 1 año, a1 = 1 año, a4 = 4 años
  const VAC = {
    bcg: ['BCG', 'm1'], hepb: ['Hepatitis B', 'm1'], h1: ['Hexa 1ª', 'm1'], h2: ['Hexa 2ª', 'm1'], h3: ['Hexa 3ª', 'm1'],
    r2: ['Rotavirus 2ª', 'm1'], n1: ['Neumo 1ª', 'm1'], n2: ['Neumo 2ª', 'm1'],
    href: ['Hexa refuerzo', 'a1'], nref: ['Neumo refuerzo', 'a1'], s1: ['SRP 1ª', 'a1'], s2: ['SRP 2ª', 'a1'], dpt: ['DPT 4 años', 'a4']
  };
  const POBIDX = { m1: 0, a1: 1, a4: 2 };
  const GRUPOS = [
    { id: 'ref', nombre: 'Refuerzos de los 12 a 18 meses', vacs: ['href', 'nref', 's2'], peso: 1, que: 'Niños que ya iniciaron esquema y no volvieron a la cita de refuerzo.' },
    { id: 'cierre', nombre: 'Cierre del esquema en menores de 1 año', vacs: ['h3', 'r2', 'n2'], peso: 1, que: 'Tercera dosis de hexavalente y segunda de rotavirus y neumococo: aquí se pierde al niño en el primer año.' },
    { id: 'dpt', nombre: 'DPT de los 4 años', vacs: ['dpt'], peso: 1, que: 'Refuerzo preescolar: no depende del calendario del bebé, depende de ir a buscarlos.' },
    { id: 'nac', nombre: 'Aplicaciones al nacer', vacs: ['bcg', 'hepb'], peso: 0.25, que: 'BCG y Hepatitis B se aplican casi siempre en el hospital de nacimiento; la unidad ve sobre todo rezagados.' }
  ];
  const ACCION = {
    ref: ['No regresan a la cita', 'Se atienden en otra unidad', 'Biológico agotado ese día', 'Rechazo o duda'],
    cierre: ['No regresan a la cita', 'Captura en otro mes', 'Biológico agotado ese día', 'Cita mal programada'],
    dpt: ['Sin estrategia para esa edad', 'Niños en guardería o preescolar', 'Captura en otro mes', 'Rechazo o duda'],
    nac: ['Nacen en hospital', 'Falta de biológico al nacer', 'Captura en otro mes', 'Sin causa identificada']
  };
  const COMP = {
    ref: ['Búsqueda en cartilla de quienes no volvieron', 'Aviso a la madre a los 12 y 18 meses', 'Casa a casa en el sector con más inasistencia'],
    cierre: ['Programar la siguiente cita al aplicar la dosis', 'Revisión semanal de niños con 1ª y 2ª pendientes', 'Horario extendido un día a la semana'],
    dpt: ['Jornada en preescolares y guarderías', 'Acuerdo con directoras de preescolar', 'Revisión de cartilla al entrar a primaria'],
    nac: ['Acordar con el hospital el envío semanal de nacimientos', 'Seguimiento de rezagados en el primer mes']
  };

  /* ───────────────────────────── utilidades puras ───────────────────────────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (a, f = 0, t = a.length) => (a || []).slice(Math.max(0, f), Math.max(0, t)).reduce((x, y) => x + (y || 0), 0);
  const fmt = (n) => Math.round(n).toLocaleString('es-MX');
  const pct = (x) => Math.round(x * 100);
  const med = (a) => { const s = a.filter((x) => x != null).slice().sort((x, y) => x - y), k = s.length; return k ? (k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2) : 0; };
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /** Arma la estructura de trabajo con lo que devuelve la RPC (los años llegan como llaves de texto). */
  function prepara(raw) {
    const y = Number(raw.anio), c = String(y), a = String(y - 1);
    const z = () => Object.fromEntries(KEYS.map((k) => [k, Array(12).fill(null)]));
    const fill = (o) => { const base = z(); KEYS.forEach((k) => { if (o && Array.isArray(o[k])) base[k] = o[k].slice(0, 12); }); return base; };
    const pobs = raw.pob || {};
    return {
      id: raw.clues, n: raw.nombre, mun: raw.municipio, y, M: Number(raw.mes) || 1,
      pob: { cur: pobs[c] || [0, 0, 0], ant: pobs[a] || [0, 0, 0] },
      s: { cur: fill((raw.s || {})[c]), ant: fill((raw.s || {})[a]) },
      pares: Array.isArray(raw.pares) ? raw.pares : [],
      jur: { bcg: (raw.jur && raw.jur.bcg) || Array(12).fill(0), unid: (raw.jur && raw.jur.unid) || Array(12).fill(0) }
    };
  }

  /** Motor: grupos ordenados por dosis que faltan, con tendencia, contra el año anterior, cierre proyectado y cohortes. */
  function analiza(D) {
    const M = D.M, Sc = D.s.cur, Sa = D.s.ant;
    const pob = (v, ant) => (ant ? D.pob.ant : D.pob.cur)[POBIDX[VAC[v][1]]] || 0;
    const esp = (v, m = M) => pob(v) * F * m;
    const apl = (v) => sum(Sc[v], 0, M);
    const cov = (v) => (esp(v) ? apl(v) / esp(v) : 0);
    const imputa = (s) => s.map((x, i) => (x != null ? x : Math.round(((s[i - 1] || 0) + (s[i + 1] || 0)) / 2)));
    const trend = (s) => { const u = sum(s, M - 3, M), p = sum(s, M - 6, M - 3); return { u, p, d: p ? u / p - 1 : null }; };
    const gs = (g, cur) => Array.from({ length: 12 }, (_, i) => {
      if (cur && i >= M) return null;
      let t = 0;
      for (const v of g.vacs) { const x = (cur ? Sc : Sa)[v][i]; if (x == null) return null; t += x; }
      return t;
    });
    // «L meses antes»: para el mes i se toma el mes i-L (del año anterior si cae antes de enero); el mes sin captura se estima con el vecino
    const lag = (key, L) => { const a = imputa(Sa[key]); let t = 0; for (let i = 0; i < M; i++) { const j = i - L; t += j < 0 ? (a[12 + j] || 0) : (Sc[key][j] || 0); } return t; };
    const G = GRUPOS.map((g) => {
      const aplicadas = sum(g.vacs.map(apl)), esperadas = sum(g.vacs.map((v) => esp(v)));
      const falta = Math.max(0, esperadas - aplicadas), s26 = gs(g, true), s25 = gs(g, false), tr = trend(s26.map((x) => x || 0));
      const idx = [...Array(M).keys()].filter((i) => s25[i] != null);
      const y26 = idx.reduce((s, i) => s + (s26[i] || 0), 0), y25 = idx.reduce((s, i) => s + s25[i], 0);
      const ceros = g.vacs.filter((v) => { let r = 0, m = 0; Sa[v].forEach((x) => { r = x === 0 ? r + 1 : 0; m = Math.max(m, r); }); return m >= 3; });
      const anual = sum(g.vacs.map((v) => pob(v))), proy = anual ? (aplicadas + (tr.u / 3) * (12 - M)) / anual : 0;
      const umbral = Math.max(6, 0.10 * Math.max(tr.p, tr.u));
      return { ...g, aplicadas, esperadas, falta, s26, s25, tr, umbral, yoy: y25 ? y26 / y25 - 1 : null, nmes: idx.length, ceros, proy, score: falta * g.peso };
    }).sort((a, b) => b.score - a.score);
    const h3lag = lag('h3', 12), s1lag = lag('s1', 6);
    const sinPob = !(D.pob.cur[0] > 0);
    return { D, pob, esp, apl, cov, G, Sa, Sc, h3lag, s1lag, sinPob };
  }

  const sev = (p) => (p < 0.05 ? 'var(--ok)' : p < 0.10 ? 'var(--mid)' : p < 0.20 ? 'var(--bad)' : 'var(--worst)');
  const col = (c) => (c >= 0.9 ? 'var(--ok)' : c >= 0.7 ? 'var(--mid)' : 'var(--bad)');
  const tone = (x, bad, mid) => (x < bad ? 'bad' : x < mid ? 'mid' : 'ok');

  /** Coberturas del RDA (misma fórmula que el panel) al corte, para el año actual o el anterior. */
  function coberturas(D, ant) {
    const S = ant ? D.s.ant : D.s.cur, P = ant ? D.pob.ant : D.pob.cur, M = D.M;
    const q = (k) => sum(S[k], 0, M), den = (i) => P[i] * F * M;
    return {
      m1: den(0) ? (q('bcg') + q('hepb') + q('h3') + q('r2') + q('n2')) / 4 / den(0) : 0,
      a1: den(1) ? (q('href') + q('nref') + q('s2')) / 3 / den(1) : 0,
      a4: den(2) ? q('dpt') / den(2) : 0
    };
  }

  /** ¿El año anterior sirve de referencia? No si le faltan meses de captura o si la BCG de toda la jurisdicción estuvo en cero. */
  function anteriorComparable(D) {
    const M = D.M, falta = D.s.ant.h1.slice(0, M).includes(null);
    return !falta && !jurBcgEnCero(D, 0, M);
  }
  function jurBcgEnCero(D, desde, hasta) {
    let r = 0, m = 0; for (let i = desde; i < hasta; i++) { r = D.jur.bcg[i] === 0 ? r + 1 : 0; m = Math.max(m, r); } return m >= 3;
  }

  /** Pares: mismo municipio, población entre 0.4 y 2.5 veces, sin denominadores atípicos (Hexa 1ª < 35% de la meta). */
  function paresDe(D, a) {
    const p0 = D.pob.cur[0], M = D.M;
    const raw = D.pares.filter((r) => r.c !== D.id && r.p >= p0 * 0.4 && r.p <= p0 * 2.5);
    const ok = raw.filter((r) => r.p > 0 && r.h1 / (r.p * F * M) >= 0.35), fuera = raw.filter((r) => !(r.p > 0 && r.h1 / (r.p * F * M) >= 0.35));
    const yo = { c: D.id, n: D.n, p: p0, h1: a.apl('h1'), h3: a.apl('h3') };
    const lista = [...ok, yo].map((r) => ({ ...r, v: r.h3 / (r.p * F * M), d: r.h1 ? 1 - r.h3 / r.h1 : 0 })).sort((x, y) => y.v - x.v);
    return { lista, fuera, mdn: med(lista.filter((r) => r.c !== D.id).map((r) => r.v)) };
  }

  /** Hallazgos sobre la calidad del dato (calendario de captura). */
  function hallazgos(a) {
    const D = a.D, M = D.M, Q = [], Sa = D.s.ant, yA = D.y - 1;
    const nUni = Math.max(0, ...D.jur.unid);
    for (let i = 0; i < 12; i++) if (Sa.h1[i] == null) {
      Q.push({ t: 'a', a: `${cap1(MESN[i])} ${yA} sin captura`, b: `No hay ningún renglón del SIS para la unidad en ese mes${D.jur.unid[i] < nUni ? ` (en toda la jurisdicción solo ${D.jur.unid[i]} de ${nUni} unidades capturaron)` : ''}. Las comparaciones con ${yA} excluyen ese mes.` });
    }
    const cambio = D.pob.ant[0] ? D.pob.cur[0] / D.pob.ant[0] - 1 : 0;
    if (Math.abs(cambio) >= 0.15) Q.push({ t: 'v', a: `La población asignada cambió ${cambio > 0 ? '+' : ''}${pct(cambio)}% entre ${yA} y ${D.y} (${D.pob.ant[0]} → ${D.pob.cur[0]} menores de 1 año)`, b: 'Es un cambio de denominador, no de desempeño: las coberturas no son comparables una a una entre los dos años. Conviene validar la proyección con la jurisdicción.' });
    KEYS.forEach((k) => {
      const s = Sa[k]; let run = 0, st = -1;
      for (let i = 0; i <= 12; i++) {
        if (i < 12 && s[i] === 0) { if (!run) st = i; run++; continue; }
        if (run >= 3) {
          const jur = jurBcgEnCero(D, st, st + run);
          if (k === 'bcg' && jur) {
            const sig = D.jur.bcg[st + run];
            Q.push({ t: 'r', a: `BCG: ${run} meses en cero (${MESN[st]}–${MESN[st + run - 1]} ${yA})`, b: `En esos meses <b>toda la jurisdicción</b> (${nUni} unidades) registró 0 BCG${sig ? ` y en ${MESN[st + run]} se acumularon ${fmt(sig)} dosis` : ''}: es un patrón de jurisdicción (abasto o captura), no de la unidad. Por eso no se compara BCG con ${yA}.` });
          } else Q.push({ t: 'r', a: `${VAC[k][0]}: ${run} meses en cero (${MESN[st]}–${MESN[st + run - 1]} ${yA})`, b: 'Revisa contra las existencias de ese periodo y con el municipio si no fue un problema de abasto o de captura.' });
        }
        run = 0;
      }
    });
    { const s = Sa.dpt, md = med(s); for (let i = 1; i < 12; i++) if (s[i - 1] != null && s[i] != null && s[i - 1] < md * 0.2 && s[i] > md * 2) Q.push({ t: 'a', a: `DPT 4 años: ${MESN[i - 1]} ${yA} con ${s[i - 1]} dosis y ${MESN[i]} con ${s[i]}`, b: `Juntos suman ${s[i - 1] + s[i]} (≈${Math.round((s[i - 1] + s[i]) / 2)} por mes): probablemente se capturó en el mes siguiente. Distorsiona tendencias mensuales, no el acumulado.` }); }
    { const s = Sa.n1, hx = Sa.h1; for (let i = 0; i < 12; i++) if (s[i] != null && hx[i] != null && s[i] < med(s) * 0.35 && hx[i] > med(hx) * 0.8) Q.push({ t: 'a', a: `Neumococo en ${MESN[i]} ${yA}: ${Sa.n1[i]}, ${Sa.n2[i]} y ${Sa.nref[i]} dosis`, b: `Mientras la hexavalente del mismo mes fue normal (${hx[i]}). Una caída de un solo biológico apunta a abasto o a captura en otro mes, no a falta de demanda.` }); }
    // meses del año actual sin captura (antes del corte)
    for (let i = 0; i < M; i++) if (D.s.cur.h1[i] == null) Q.push({ t: 'r', a: `${cap1(MESN[i])} ${D.y} sin captura`, b: 'La unidad no tiene renglones del SIS en ese mes, así que el acumulado y la cobertura al corte quedan subestimados.' });
    return Q;
  }

  /** Frase de lectura de la unidad (hero). */
  function fraseHero(a) {
    const D = a.D, cap = (a.cov('h1') + a.cov('n1') + a.cov('s1')) / 3, ret = a.apl('h1') ? a.apl('h3') / a.apl('h1') : 1, nombre = esc(D.n);
    if (cap < 0.8) return `${nombre} tiene un problema de <b>captación</b>: las primeras dosis solo llegan a <b>${pct(cap)}%</b> de la meta al corte. Antes de revisar el seguimiento, hay que traer a los niños.`;
    if (ret < 0.85) return `${nombre} <b>capta bien pero no completa</b>: las primeras dosis van en <b>${pct(cap)}%</b> de la meta al corte, pero de cada 100 niños que inician hexavalente solo <b>${pct(ret)}</b> llegan a la 3ª dosis.`;
    return `${nombre} <b>va en ruta</b>: primeras dosis en <b>${pct(cap)}%</b> de la meta al corte y ${ret >= 1 ? 'las terceras dosis alcanzan a las primeras' : `${pct(ret)} de cada 100 niños llegan a la 3ª dosis`}.`;
  }

  function lectura(a, g) {
    const m = g.tr.d != null && g.tr.d < -0.12 && Math.abs(g.tr.u - g.tr.p) >= g.umbral;
    if (g.id === 'ref') return `El problema no es captar niños, es que <b>no vuelven</b>: ${m ? 'además, el ritmo reciente baja.' : 'el ritmo reciente se mantiene, pero sin alcanzar la meta mensual.'}`;
    if (g.id === 'cierre') return `Se pierde al niño <b>entre la 1ª y la 3ª dosis</b>. ${m ? 'El ritmo de los últimos meses empeora.' : 'El ritmo reciente no mejora esa brecha por sí solo.'}`;
    if (g.id === 'dpt') return 'La meta depende de <b>ir a buscar a los niños de 4 años</b>; sin estrategia sostenida, cada mes varía con quien llega.';
    return 'Es normal una brecha aquí si los nacimientos son en hospital: <b>confirma el origen</b> antes de tratarla como falla de la unidad.';
  }

  /* ───────────────────────────── piezas de la vista ───────────────────────────── */
  function barVital(txt, cov, ghost, sub, anio) {
    const w = Math.min(cov, 1.2) / 1.2 * 100;
    return `<div><div class="vt-h"><b>${txt}</b><span>${pct(cov)}%<small>de la meta al corte</small></span></div>
     <div class="bar" role="img" aria-label="${txt}: ${pct(cov)}% de la meta al corte${ghost != null ? `; mismo corte de ${anio}: ${pct(ghost)}%` : ''}"><div class="fill" style="width:${w}%;background:${col(cov)}"></div><div class="tick" style="left:${100 / 1.2}%"></div>${ghost != null ? `<div class="ghost" style="left:${Math.min(ghost, 1.2) / 1.2 * 100}%"></div>` : ''}</div>
     <div class="vt-n"><span>${sub}</span><span>${ghost != null ? `│ gris: mismo corte ${anio} (${pct(ghost)}%)` : ''}</span></div></div>`;
  }

  function mini(a, g) {
    const M = a.D.M, w = 320, h = 104, pad = 18, bw = 15;
    const e = sum(g.vacs.map((v) => a.pob(v) * F));
    const mx = Math.max(...g.s26.filter((x) => x != null), ...g.s25.filter((x) => x != null), e) * 1.18 || 1;
    const y = (v) => h - pad - (v / mx) * (h - pad - 8), x = (i) => 6 + i * ((w - 12) / 12) + ((w - 12) / 12 - bw) / 2;
    let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Aplicaciones por mes de ${a.D.y} contra la meta mensual y ${a.D.y - 1}">`;
    g.s26.forEach((v, i) => { if (v == null) return; const c = v >= e * 0.95 ? 'var(--ok)' : v < e * 0.6 ? 'var(--bad)' : 'var(--mid)'; s += `<rect x="${x(i)}" y="${y(v)}" width="${bw}" height="${Math.max(2, h - pad - y(v))}" rx="4" fill="${c}"/>`; });
    let d = ''; g.s25.forEach((v, i) => { if (v == null) return; d += (d && g.s25[i - 1] != null ? 'L' : 'M') + (x(i) + bw / 2) + ',' + y(v); });
    s += `<path d="${d}" fill="none" stroke="var(--ink3)" stroke-width="1.7" stroke-dasharray="2 3"/>`;
    s += `<line x1="2" x2="${w - 2}" y1="${y(e)}" y2="${y(e)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${w - 4}" y="${y(e) - 5}" text-anchor="end" font-size="10.5" fill="var(--ink)">meta mensual ${fmt(e)}</text>`;
    MES1.forEach((m, i) => { s += `<text x="${x(i) + bw / 2}" y="${h - 4}" text-anchor="middle" font-size="9.5" fill="${i < M ? 'var(--ink2)' : 'var(--line)'}">${m}</text>`; });
    return s + '</svg>';
  }

  function tiles(a, g) {
    const T = [], M = a.D.M, anioA = a.D.y - 1;
    const tr = g.tr, mat = tr.d != null && Math.abs(tr.u - tr.p) >= g.umbral && Math.abs(tr.d) >= 0.12;
    T.push(`<div class="tile ${mat ? (tr.d < 0 ? 'bad' : 'ok') : ''}"><div class="l">Últimos 3 meses</div><div class="v">${mat ? (tr.d > 0 ? '+' : '') + pct(tr.d) + '%' : 'Estable'}</div><div class="s">${fmt(tr.u)} dosis contra ${fmt(tr.p)} antes</div></div>`);
    if (g.ceros.length) T.push(`<div class="tile"><div class="l">Contra ${anioA}</div><div class="v">—</div><div class="s">${g.ceros.map((v) => VAC[v][0]).join(' y ')} estuvo en cero varios meses de ${anioA}</div></div>`);
    else if (g.yoy != null) T.push(`<div class="tile ${g.yoy < -0.1 ? 'bad' : g.yoy > 0.1 ? 'ok' : ''}"><div class="l">Contra ${anioA}</div><div class="v">${g.yoy > 0 ? '+' : ''}${pct(g.yoy)}%</div><div class="s">${g.nmes} meses comparables</div></div>`);
    T.push(`<div class="tile ${tone(g.proy, 0.7, 0.9)}"><div class="l">Cierre proyectado</div><div class="v">${pct(g.proy)}%</div><div class="s">de la meta anual al ritmo actual</div></div>`);
    if (g.id === 'ref') { const r1 = a.h3lag ? a.apl('href') / a.h3lag : 0, r2 = a.s1lag ? a.apl('s2') / a.s1lag : 0; T.push(`<div class="tile ${tone(Math.min(r1, r2), 0.7, 0.85)}"><div class="l">Vuelven al refuerzo</div><div class="v">${pct(r1)}%</div><div class="s">hexavalente · y ${pct(r2)}% en SRP 2ª</div></div>`); }
    else if (g.id === 'cierre') { const r = a.apl('h1') ? a.apl('h3') / a.apl('h1') : 0; T.push(`<div class="tile ${tone(r, 0.8, 0.9)}"><div class="l">Llegan a la 3ª dosis</div><div class="v">${pct(r)}%</div><div class="s">de quienes iniciaron hexavalente</div></div>`); }
    else if (g.id === 'dpt') { const v = g.s26.slice(0, M).map((x) => x || 0), bajo = v.filter((x) => x < a.pob('dpt') * F * 0.95).length; T.push(`<div class="tile ${bajo >= Math.ceil(M * 0.7) ? 'bad' : 'mid'}"><div class="l">Meses bajo la meta</div><div class="v">${bajo} de ${M}</div><div class="s">mes a mes varía entre ${Math.min(...v)} y ${Math.max(...v)}</div></div>`); }
    else T.push(`<div class="tile mid"><div class="l">BCG · Hepatitis B</div><div class="v">${pct(a.cov('bcg'))}% · ${pct(a.cov('hepb'))}%</div><div class="s">confirmar con el hospital de referencia</div></div>`);
    return T.join('');
  }

  function rutaHtml(a) {
    const nodes = (ns) => `<div class="line">${ns.map((n, i) => {
      const pl = i > 0 && n.de ? 1 - n.n / n.de : 0, c = sev(Math.max(pl, 0));
      return `<div class="st" style="--seg:${i > 0 ? c : 'var(--line)'}">${i > 0 ? `<span class="pl" style="background:${c}">${pl >= 0 ? '−' : '+'}${Math.abs(pct(pl))}%</span>` : ''}<div class="d"></div><b>${fmt(n.n)}</b><span>${n.k}</span><em>${n.nota || ''}</em></div>`;
    }).join('')}</div>`;
    const r1 = [{ k: 'Hexa 1ª', n: a.apl('h1') }, { k: 'Hexa 2ª', n: a.apl('h2'), de: a.apl('h1'), nota: 'mismo periodo' }, { k: 'Hexa 3ª', n: a.apl('h3'), de: a.apl('h2'), nota: 'mismo periodo' }, { k: 'Refuerzo', n: a.apl('href'), de: a.h3lag, nota: 'vs 3ª de hace 12 m' }];
    const r2 = [{ k: 'SRP 1ª', n: a.apl('s1') }, { k: 'SRP 2ª', n: a.apl('s2'), de: a.s1lag, nota: 'vs 1ª de hace 6 m' }];
    return `<div class="metro">${nodes(r1)}${nodes(r2)}</div>`;
  }

  function calendarioHtml(a) {
    const D = a.D, M = D.M, meses = [];
    for (let i = 0; i < 12; i++) meses.push([D.y - 1, i, 'ant']);
    for (let i = 0; i < M; i++) meses.push([D.y, i, 'cur']);
    const nc = meses.length;
    let hm = `<div class="hm"><div class="hmg" style="grid-template-columns:104px repeat(${nc},minmax(17px,1fr));min-width:${Math.max(480, 104 + nc * 26)}px"><span></span><span class="yh" style="grid-column:span 12">${D.y - 1}</span><span class="yh" style="grid-column:span ${M}">${D.y}</span>${meses.map(([, i]) => `<span class="mh">${MES1[i]}</span>`).join('')}`;
    KEYS.forEach((k) => {
      const all = [...D.s.ant[k], ...D.s.cur[k].slice(0, M)], md = med(all), mx = Math.max(...all.filter((x) => x != null), 1);
      hm += `<span class="rl">${VAC[k][0]}</span>` + meses.map(([y, i, w]) => {
        const v = D.s[w][k][i]; let c;
        if (v == null) c = 'm'; else if (v === 0) c = 'z'; else if (md > 0 && v < md * 0.35) c = 'lo'; else if (md > 0 && v > md * 1.8) c = 'hi';
        else { const r = v / mx; c = r > 0.75 ? 'n4' : r > 0.5 ? 'n3' : r > 0.25 ? 'n2' : 'n1'; }
        return `<span class="c ${c}" title="${VAC[k][0]} · ${MESN[i]} ${y}: ${v == null ? 'sin captura' : v}"></span>`;
      }).join('');
    });
    return hm + `</div></div><div class="lg2"><span><i style="background:#39b5a3"></i>con captura (más oscuro = más dosis)</span><span><i style="background:transparent;border:2px solid var(--bad)"></i>cero</span><span><i style="background:var(--mid);opacity:.75"></i>muy por debajo de lo habitual</span><span><i style="background:var(--violet)"></i>muy por encima (recuperación)</span><span><i style="background:repeating-linear-gradient(135deg,var(--line) 0 3px,transparent 3px 6px)"></i>mes sin captura</span></div>`;
  }

  /** Contenido completo (sin los controles de unidad ni la barra de compromisos). */
  function contenidoHtml(a, saved) {
    const D = a.D, M = D.M, yA = D.y - 1, G = a.G;
    if (a.sinPob) return `<section class="card"><div class="pt">${esc(D.n)} no tiene población asignada en ${D.y}</div><p class="read">Sin población de menores de 1 año no se puede calcular la meta al corte ni ningún porcentaje. Si es una unidad con población, pídele a la jurisdicción que la capture en Parámetros.</p></section>`;
    const c26 = coberturas(D, false), c25 = coberturas(D, true), cmp = anteriorComparable(D);
    const p = G[0], q = G[1];
    let h = `<section class="hero"><div class="lectura"><div class="kick">Lectura de la unidad</div><h1>${fraseHero(a)} ${p.falta > 0 ? `Lo que más pesa: <b>${p.nombre.toLowerCase()}</b> (${fmt(p.falta)} dosis por debajo de lo esperado)${q.falta > p.falta * 0.5 ? `, y después <b>${q.nombre.toLowerCase()}</b> (${fmt(q.falta)})` : ''}.` : ''}</h1>
      <p>Tomado del SIS de ${MESN[M - 1]}. Misma fórmula del RDA: dosis aplicadas contra población × 0.0833 × meses. El diagnóstico ordena y explica; no la modifica.</p></div>
      <div class="vitals">${barVital('Menores de 1 año', c26.m1, cmp ? c25.m1 : null, 'BCG, Hep B, Hexa 3ª, Rota 2ª, Neumo 2ª', yA)}${barVital('Niños de 1 año', c26.a1, cmp ? c25.a1 : null, 'Hexa y Neumo refuerzo, SRP 2ª', yA)}${barVital('Niños de 4 años', c26.a4, cmp ? c25.a4 : null, 'DPT', yA)}</div></section>`;
    h += `<h2>Qué atender primero <small>ordenado por dosis que faltan, no por porcentaje</small></h2><div class="prio">`;
    G.slice(0, 3).forEach((g, i) => {
      const sv = (saved && saved[g.id]) || { causas: [], compromisos: [] };
      const chips = (tipo, lista, marcados) => `<div class="chips" data-k="${tipo}|${g.id}">${lista.map((c) => `<button class="chip${marcados.includes(c) ? ' on' : ''}" type="button" aria-pressed="${marcados.includes(c)}">${c}</button>`).join('')}</div>`;
      h += `<article class="card"><div class="ph"><div class="rank">${i + 1}</div><div><div class="pt">${g.nombre}</div><div class="ps">${g.que}</div></div><div class="miss"><strong>${fmt(g.falta)}</strong><small>dosis por debajo<br>de lo esperado</small></div></div>
       <div class="pb"><div><div class="tiles">${tiles(a, g)}</div><p class="read">${lectura(a, g)}</p>
         <div class="vrows">${g.vacs.map((v) => `<div class="vr"><span>${VAC[v][0]}</span><div class="t"><i style="width:${Math.min(a.cov(v), 1.2) / 1.2 * 100}%;background:${col(a.cov(v))}"></i><u style="left:${100 / 1.2}%"></u></div><b>${pct(a.cov(v))}%</b></div>`).join('')}</div></div>
        <div><div class="lbl">Por mes · ${D.y} contra la meta mensual y ${yA} (punteado)</div>${mini(a, g)}<div class="gap"></div>
         <div class="lbl">¿Cuál crees que es la causa?</div>${chips('c', ACCION[g.id], sv.causas)}<div class="gap"></div>
         <div class="lbl">Compromiso del mes</div>${chips('m', COMP[g.id], sv.compromisos)}</div></div></article>`;
    });
    h += '</div>';
    const rest = G.slice(3).filter((g) => g.falta > 0).map((g) => `${g.nombre.toLowerCase()} (${fmt(g.falta)} dosis)`);
    if (rest.length) h += `<div class="foot" style="margin-left:6px">También por debajo, sin ser prioridad este mes: ${rest.join(' · ')}.</div>`;

    const pr = paresDe(D, a), mx = Math.max(...pr.lista.map((r) => r.v), 1);
    const imput = D.s.ant.h3.slice(0, M).includes(null);
    h += `<h2>La ruta del niño y contra unidades parecidas <small>dónde se queda en el camino · cada tramo compara con los niños que ya podían estar ahí</small></h2><div class="two">
     <div class="card">${rutaHtml(a)}<div class="lg">Pérdida por tramo:<i style="background:var(--ok)"></i>menos de 5%<i style="background:var(--mid)"></i>5–10%<i style="background:var(--bad)"></i>10–20%<i style="background:var(--worst)"></i>20% o más. El refuerzo y la SRP 2ª se comparan con la cohorte que corresponde${imput ? ` (el mes sin captura de ${yA} se estimó con el promedio vecino)` : ''}.</div></div>
     <div class="card"><div class="lbl" style="margin-bottom:10px">Hexa 3ª frente a la meta al corte · ${esc(cap1(String(D.mun || '').toLowerCase()))}</div>
      ${pr.lista.length > 1 ? `<div class="rk">${pr.lista.map((r, i) => `<div class="rr ${r.c === D.id ? 'me' : ''}"><span>${i + 1}</span><div style="min-width:0"><div class="nm">${esc(r.n)}</div><div class="t"><i style="width:${Math.min(r.v / mx, 1) * 100}%"></i><u style="left:${Math.min(pr.mdn / mx, 1) * 100}%"></u></div></div><span class="n">${pct(r.v)}% · ${r.d > 0 ? 'pierde ' + pct(r.d) + '%' : '3ª ≥ 1ª'}</span></div>`).join('')}</div>
      <div class="foot">La línea marca la mediana (${pct(pr.mdn)}%). “Pierde” es la caída de la 1ª a la 3ª dosis en el mismo periodo; “3ª ≥ 1ª” suele indicar niños atendidos de otra unidad o captura en otro paso.${pr.fuera.length ? ` Fuera del comparativo por denominador atípico: ${pr.fuera.map((r) => esc(r.n)).join(', ')}.` : ''}</div>` : '<div class="foot">No hay unidades de tamaño parecido en el mismo municipio para comparar.</div>'}</div></div>`;

    const Q = hallazgos(a);
    h += `<h2>Qué tan confiable es el dato <small>revisa esto antes de decidir</small></h2><div class="card">${calendarioHtml(a)}<div class="q">${Q.map((x) => `<div class="qi"><div class="ic ${x.t}" aria-hidden="true">${x.t === 'r' ? '!' : x.t === 'a' ? '?' : x.t === 'v' ? '≠' : 'i'}</div><div><b>${x.a}</b><small>${x.b}</small></div></div>`).join('') || '<small>Sin alertas de captura.</small>'}</div></div>`;

    const gb = [], cap = (a.cov('h1') + a.cov('n1') + a.cov('s1')) / 3;
    if (cap >= 0.9) gb.push(`Captación de primeras dosis: Hexa 1ª <b>${pct(a.cov('h1'))}%</b>, Neumo 1ª <b>${pct(a.cov('n1'))}%</b> y SRP 1ª <b>${pct(a.cov('s1'))}%</b> de la meta al corte.`);
    if (M >= 2 && a.Sc.h2.slice(0, M).every((x) => x > 0) && a.Sc.h3.slice(0, M).every((x) => x > 0)) gb.push(`Hexa 2ª y 3ª se aplicaron todos los meses de ${D.y}, sin huecos de captura.`);
    const best = Object.keys(VAC).map((k) => [k, a.cov(k)]).filter(([k, c]) => c >= 0.95 && !['bcg', 'hepb'].includes(k) && !(cap >= 0.9 && ['h1', 'n1', 's1'].includes(k)));
    if (best.length) gb.push(`Ya en meta al corte: ${best.map(([k, c]) => `${VAC[k][0]} (${pct(c)}%)`).join(', ')}.`);
    if (gb.length) h += `<h2>Lo que va bien</h2><div class="card"><ul class="good">${gb.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
    return h;
  }

  /* ───────────────────────────── estilos (Shadow DOM) ───────────────────────────── */
  const CSS = `
  :host{all:initial;--bg:#eef1f6;--card:#fff;--soft:#f4f6fa;--ink:#0f172a;--ink2:#3b4658;--ink3:#667389;--line:#e3e8f0;--ok:#0f9d8a;--okbg:#e3f6f2;--mid:#b87c00;--midbg:#fcf1d6;--bad:#d9463e;--badbg:#fde7e5;--worst:#8f1a14;--info:#2f6fed;--violet:#7c5ce6;--nav:#0f172a;--r:22px;--r2:14px;font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
  :host(.dark){--bg:#0b1020;--card:#141c33;--soft:#1c2646;--ink:#eaf0fb;--ink2:#b7c3d9;--ink3:#93a1bb;--line:#26314f;--ok:#2fc4ae;--mid:#e0a526;--bad:#f0706a;--okbg:#0f3a35;--midbg:#40320c;--badbg:#451a1a;--nav:#1f2c52;--violet:#9d83f2}
  *{box-sizing:border-box}
  .ov{position:fixed;inset:0;z-index:2147483000;background:rgba(8,12,24,.55);display:flex;align-items:stretch;justify-content:center;padding:clamp(0px,2vw,22px)}
  .shell{background:var(--bg);color:var(--ink);width:min(1160px,100%);border-radius:clamp(0px,2vw,26px);display:flex;flex-direction:column;overflow:hidden}
  .top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 18px;background:var(--bg);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700}
  .mark{width:30px;height:30px;border-radius:10px;background:var(--ink);display:grid;place-items:center}
  .mark i{width:12px;height:12px;border-radius:50%;border:3px solid var(--bg)}
  .sp{flex:1}
  select{appearance:none;font:inherit;color:inherit;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:8px 32px 8px 12px;font-weight:600;cursor:pointer;max-width:260px;
    background-image:linear-gradient(45deg,transparent 50%,var(--ink3) 50%),linear-gradient(135deg,var(--ink3) 50%,transparent 50%);background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%;background-size:5px 5px;background-repeat:no-repeat}
  .badge{font-size:12px;border-radius:99px;padding:5px 11px;background:var(--soft);color:var(--ink2)}
  .x{font:inherit;color:inherit;border:0;background:var(--soft);width:36px;height:36px;border-radius:12px;font-size:20px;line-height:1;cursor:pointer}
  button:focus-visible,select:focus-visible{outline:3px solid var(--info);outline-offset:2px}
  .body{flex:1;overflow:auto;padding:16px 18px 26px}
  .hero{display:grid;grid-template-columns:1.25fr 1fr;gap:16px}
  .lectura{background:var(--nav);color:#e9eef9;border-radius:var(--r);padding:26px 28px}
  .kick{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:#9fb0cf}
  .lectura h1{font-size:23px;line-height:1.36;font-weight:560;margin:10px 0 0;letter-spacing:-.005em}
  .lectura h1 b{color:#fff;font-weight:700}
  .lectura p{margin:14px 0 0;color:#b4c1da;font-size:14px}
  .vitals{background:var(--card);border-radius:var(--r);padding:20px 22px;display:grid;gap:16px;align-content:center}
  .vt-h{display:flex;justify-content:space-between;align-items:baseline}
  .vt-h b{font-size:13px;font-weight:650}
  .vt-h span{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .vt-h small{font-size:12px;color:var(--ink3);margin-left:4px;font-weight:500}
  .bar{position:relative;height:12px;border-radius:99px;background:var(--soft);margin-top:7px}
  .bar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px}
  .bar .tick{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink);border-radius:2px}
  .bar .ghost{position:absolute;top:-2px;bottom:-2px;width:3px;background:var(--ink3);border-radius:2px;opacity:.8}
  .vt-n{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--ink3);margin-top:5px}
  h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:750;margin:30px 4px 12px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  h2 small{text-transform:none;letter-spacing:0;font-weight:500;font-size:13px}
  .prio{display:grid;gap:14px}
  .card{background:var(--card);border-radius:var(--r);padding:22px 24px}
  .ph{display:flex;gap:14px;align-items:flex-start}
  .rank{flex:none;width:34px;height:34px;border-radius:12px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:800}
  .pt{font-size:19px;font-weight:700;line-height:1.25;letter-spacing:-.01em}
  .ps{font-size:13.5px;color:var(--ink3);margin-top:2px}
  .miss{margin-left:auto;text-align:right;flex:none}
  .miss strong{display:block;font-size:34px;line-height:1;font-weight:750;letter-spacing:-.03em;color:var(--bad)}
  .miss small{font-size:12px;color:var(--ink3)}
  .pb{display:grid;grid-template-columns:1.05fr 1fr;gap:26px;margin-top:18px}
  .tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .tile{border-radius:var(--r2);padding:12px 14px;background:var(--soft)}
  .tile .l{font-size:11.5px;color:var(--ink3);font-weight:650}
  .tile .v{font-size:25px;font-weight:720;letter-spacing:-.02em;line-height:1.15;margin-top:2px}
  .tile .s{font-size:12px;color:var(--ink3);margin-top:1px}
  .tile.bad{background:var(--badbg)} .tile.bad .v{color:var(--bad)}
  .tile.mid{background:var(--midbg)} .tile.mid .v{color:var(--mid)}
  .tile.ok{background:var(--okbg)} .tile.ok .v{color:var(--ok)}
  .read{margin:14px 0 0;color:var(--ink2);font-size:14.5px} .read b{color:var(--ink)}
  .vrows{margin-top:14px;display:grid;gap:8px}
  .vr{display:grid;grid-template-columns:118px 1fr 44px;gap:10px;align-items:center;font-size:12.5px;color:var(--ink2)}
  .vr .t{height:8px;background:var(--soft);border-radius:99px;position:relative}
  .vr .t i{position:absolute;left:0;top:0;bottom:0;border-radius:99px}
  .vr .t u{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink)}
  .vr b{text-align:right;color:var(--ink)}
  .lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:750;margin:0 0 6px}
  .chips{display:flex;gap:7px;flex-wrap:wrap}
  .chip{font:inherit;border:1px solid var(--line);background:transparent;border-radius:99px;padding:6px 12px;font-size:13px;color:var(--ink2);cursor:pointer}
  .chip:hover{border-color:var(--ink3)} .chip.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}
  .gap{height:14px}
  svg text{font-family:inherit}
  .two{display:grid;grid-template-columns:1.15fr 1fr;gap:14px;align-items:start}
  .metro{display:grid;gap:22px;padding-top:4px}
  .line{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;align-items:start}
  .st{position:relative;text-align:center;padding-top:34px}
  .st:before{content:"";position:absolute;left:0;right:0;top:12px;height:5px;background:var(--seg,var(--line))}
  .st:first-child:before{left:50%} .st:last-child:before{right:50%}
  .st .d{position:absolute;left:50%;top:5px;width:18px;height:18px;transform:translateX(-50%);border-radius:50%;background:var(--card);border:4px solid var(--ink)}
  .st .pl{position:absolute;left:0;top:-14px;transform:translateX(-50%);font-size:11.5px;font-weight:750;color:#fff;border-radius:99px;padding:1px 8px;white-space:nowrap}
  .st b{display:block;font-size:20px;font-weight:720;letter-spacing:-.02em}
  .st span{display:block;font-size:12px;color:var(--ink3);line-height:1.25}
  .st em{display:block;font-style:normal;font-size:10.5px;color:var(--ink3);margin-top:2px}
  .lg{font-size:12px;color:var(--ink3);margin-top:12px;line-height:1.5}
  .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 4px 0 10px;vertical-align:-1px}
  .rk{display:grid;gap:5px}
  .rr{display:grid;grid-template-columns:20px 1fr 118px;gap:8px;align-items:center;font-size:13px;color:var(--ink2)}
  .rr .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rr .t{height:8px;background:var(--soft);border-radius:99px;position:relative}
  .rr .t i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--ink3);opacity:.55}
  .rr.me{color:var(--ink);font-weight:700} .rr.me .t i{background:var(--info);opacity:1}
  .rr .t u{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink)}
  .rr .n{text-align:right;font-size:12px;color:var(--ink3);white-space:nowrap} .rr.me .n{color:var(--ink)}
  .foot{font-size:12.5px;color:var(--ink3);margin-top:12px;line-height:1.5}
  .hm{overflow-x:auto;padding-bottom:6px}
  .hmg{display:grid;gap:3px;align-items:center}
  .hmg .rl{font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hmg .mh{font-size:10px;color:var(--ink3);text-align:center}
  .hmg .yh{font-size:10.5px;font-weight:750;color:var(--ink2)}
  .c{height:17px;border-radius:5px;background:var(--soft)}
  .c.n1{background:#bfe7df} .c.n2{background:#7fd0c3} .c.n3{background:#39b5a3} .c.n4{background:#0f9d8a}
  .c.z{background:transparent;border:2px solid var(--bad)}
  .c.m{background:repeating-linear-gradient(135deg,var(--line) 0 3px,transparent 3px 6px)}
  .c.lo{background:var(--mid);opacity:.75} .c.hi{background:var(--violet)}
  .lg2{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ink3);margin-top:10px}
  .lg2 i{display:inline-block;width:14px;height:12px;border-radius:4px;margin-right:5px;vertical-align:-2px}
  .q{display:grid;gap:10px;margin-top:16px}
  .qi{display:grid;grid-template-columns:30px 1fr;gap:12px;padding:12px 14px;border-radius:var(--r2);background:var(--soft)}
  .qi .ic{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-weight:800;color:#fff}
  .ic.a{background:#a86d00} .ic.r{background:#c23a33} .ic.b{background:var(--info)} .ic.v{background:#6a49d8}
  .qi>div>b{display:block;font-size:14px} .qi small{display:block;color:var(--ink2);font-size:13px;line-height:1.45} .qi small b{color:var(--ink)}
  .good{display:grid;gap:8px;margin:0;padding:0;list-style:none}
  .good li{padding-left:22px;position:relative;color:var(--ink2);font-size:14px}
  .good li:before{content:"";position:absolute;left:2px;top:8px;width:9px;height:9px;border-radius:50%;background:var(--ok)}
  .good b{color:var(--ink)}
  .dock{border-top:1px solid var(--line);background:var(--card);padding:12px 18px;display:flex;gap:12px;align-items:center}
  .dock span{flex:1;font-size:13.5px;color:var(--ink2)}
  .btn{font:inherit;border:0;background:var(--ink);color:var(--bg);border-radius:13px;padding:11px 18px;font-weight:650;cursor:pointer}
  .btn[disabled]{opacity:.35;cursor:default}
  .msg{padding:60px 20px;text-align:center;color:var(--ink2)}
  @media(max-width:860px){.hero,.two{grid-template-columns:1fr}}
  @media(max-width:820px){.pb{grid-template-columns:1fr}.miss{display:none}}
  @media(max-width:600px){.sp{display:none}.brand{flex:1}.x{order:2}[data-sel]{order:3;flex:1 1 100%}[data-sel] select{width:100%;max-width:none}.badge{order:4}.lectura{padding:20px}.lectura h1{font-size:19px}.card{padding:18px 16px}.vitals{padding:18px 16px}.dock span{display:none}.btn{width:100%}.vr{grid-template-columns:96px 1fr 40px}.ov{padding:0}.shell{border-radius:0}.body{padding:12px 12px 22px}}
  @media(prefers-reduced-motion:no-preference){.chip,.btn{transition:background .15s,border-color .15s,opacity .15s}}
  `;

  /* ───────────────────────────── red + ventana ───────────────────────────── */
  let cfg = null, host = null, state = null;

  const isDark = () => { const d = document.documentElement; return d.classList.contains('dark') || d.dataset.theme === 'dark' || document.body.classList.contains('dark'); };
  const role = () => String((cfg && cfg.getUser() && cfg.getUser().rol) || '').trim().toUpperCase();
  const toast = (m, k) => { if (cfg && cfg.toast) cfg.toast(m, k); };

  async function cargar(clues) {
    const { data, error } = await cfg.getClient().rpc('get_diagnostico_unidad', { p_clues: clues });
    if (error) throw error;
    return data;
  }
  async function cargarCompromisos(clues, anio, mes) {
    try {
      const { data, error } = await cfg.getClient().from('diagnostico_compromisos').select('grupo,causas,compromisos').eq('clues', clues).eq('anio', anio).eq('mes', mes);
      if (error) throw error;
      return Object.fromEntries((data || []).map((r) => [r.grupo, { causas: r.causas || [], compromisos: r.compromisos || [] }]));
    } catch (e) { console.warn('[DiagnosticoUnidad] compromisos', e && e.message); return {}; }
  }
  async function listaUnidades() {
    const { data, error } = await cfg.getClient().from('unidades_medicas').select('clues,nombre,municipio').order('nombre', { ascending: true });
    if (error) throw error;
    const hosp = ['QTSSA001740', 'QTSSA002901'];
    return (data || []).filter((u) => !hosp.includes(u.clues));
  }

  function close() {
    if (host) { host.remove(); host = null; }
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  async function pinta(clues) {
    const root = host.shadowRoot, body = root.querySelector('.body'), dock = root.querySelector('.dock');
    body.innerHTML = '<div class="msg" role="status">Calculando el diagnóstico…</div>'; dock.style.display = 'none';
    const mio = ++state.token;
    try {
      const raw = await cargar(clues);
      if (mio !== state.token || !host) return;
      const D = prepara(raw), a = analiza(D);
      const saved = a.sinPob ? {} : await cargarCompromisos(clues, D.y, D.M);
      if (mio !== state.token || !host) return;
      state.eleg = {}; state.D = D; state.a = a; state.clues = clues;
      body.innerHTML = contenidoHtml(a, saved);
      root.querySelector('[data-corte]').textContent = `Corte: ${MESN[D.M - 1]} ${D.y}`;
      // lo ya guardado
      Object.entries(saved).forEach(([g, v]) => { state.eleg[`c|${g}`] = v.causas.slice(); state.eleg[`m|${g}`] = v.compromisos.slice(); });
      state.guardado = JSON.stringify(state.eleg);
      body.querySelectorAll('.chips').forEach((c) => c.addEventListener('click', (e) => {
        const b = e.target.closest('.chip'); if (!b) return;
        b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on'));
        state.eleg[c.dataset.k] = [...c.querySelectorAll('.chip.on')].map((x) => x.textContent);
        actualizaDock();
      }));
      body.scrollTop = 0;
      dock.style.display = a.sinPob ? 'none' : 'flex';
      actualizaDock();
    } catch (e) {
      if (mio !== state.token || !host) return;
      console.warn('[DiagnosticoUnidad]', e);
      body.innerHTML = `<div class="msg" role="alert">No se pudo calcular el diagnóstico. ${esc((e && e.message) || '')}</div>`;
    }
  }

  function gruposConCompromiso() { return Object.keys(state.eleg).filter((k) => k[0] === 'm' && state.eleg[k].length).length; }
  function actualizaDock() {
    const root = host.shadowRoot, n = gruposConCompromiso(), cambio = JSON.stringify(state.eleg) !== state.guardado;
    root.querySelector('[data-dock-txt]').textContent = n ? `${n} prioridad${n > 1 ? 'es' : ''} con compromiso elegido${cambio ? '' : ' · guardado'}.` : 'Elige la causa y el compromiso de cada prioridad.';
    root.querySelector('[data-guardar]').disabled = !cambio;
  }

  async function guardar() {
    const D = state.D, user = cfg.getUser() || {};
    const grupos = [...new Set(Object.keys(state.eleg).map((k) => k.split('|')[1]))];
    const filas = grupos.map((g) => ({ clues: D.id, anio: D.y, mes: D.M, grupo: g, causas: state.eleg[`c|${g}`] || [], compromisos: state.eleg[`m|${g}`] || [], usuario: user.usuario || null, updated_at: new Date().toISOString() }));
    const btn = host.shadowRoot.querySelector('[data-guardar]'); btn.disabled = true;
    try {
      const vacias = filas.filter((f) => !f.causas.length && !f.compromisos.length).map((f) => f.grupo);
      const llenas = filas.filter((f) => f.causas.length || f.compromisos.length);
      const c = cfg.getClient();
      if (llenas.length) { const { error } = await c.from('diagnostico_compromisos').upsert(llenas, { onConflict: 'clues,anio,mes,grupo' }); if (error) throw error; }
      if (vacias.length) { const { error } = await c.from('diagnostico_compromisos').delete().eq('clues', D.id).eq('anio', D.y).eq('mes', D.M).in('grupo', vacias); if (error) throw error; }
      state.guardado = JSON.stringify(state.eleg);
      toast('Compromisos del mes guardados', 'good');
    } catch (e) { console.warn('[DiagnosticoUnidad] guardar', e); toast('No se pudieron guardar los compromisos. Intenta de nuevo.', 'bad'); }
    actualizaDock();
  }

  async function open(opts) {
    if (!cfg) return;
    close();
    const user = cfg.getUser() || {};
    const propia = role() === 'UNIDAD';
    let clues = (opts && opts.clues) || user.clues;
    host = document.createElement('div'); host.id = 'diagnosticoUnidadHost';
    host.classList.toggle('dark', isDark());
    const root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.append(st);
    const tmp = document.createElement('div');
    tmp.innerHTML = `<div class="ov"><div class="shell" role="dialog" aria-modal="true" aria-label="Diagnóstico de la unidad"><div class="top"><div class="brand"><div class="mark"><i></i></div>Diagnóstico de la unidad</div><div class="sp"></div><span data-sel></span><span class="badge" data-corte></span><button class="x" type="button" aria-label="Cerrar" data-x>×</button></div><div class="body"><div class="msg" role="status">Calculando el diagnóstico…</div></div><div class="dock" style="display:none"><span data-dock-txt></span><button class="btn" type="button" data-guardar disabled>Guardar compromisos del mes</button></div></div></div>`;
    root.append(tmp.firstElementChild);
    document.body.append(host);
    document.addEventListener('keydown', onKey, true);
    state = { token: 0, eleg: {}, guardado: '{}' };
    root.querySelector('[data-x]').addEventListener('click', close);
    root.querySelector('.ov').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) close(); });
    root.querySelector('[data-guardar]').addEventListener('click', guardar);
    if (!propia) {
      try {
        const us = await listaUnidades();
        if (!host) return;
        if (!clues || !us.some((u) => u.clues === clues)) clues = us[0] && us[0].clues;
        root.querySelector('[data-sel]').innerHTML = `<select aria-label="Unidad">${us.map((u) => `<option value="${esc(u.clues)}"${u.clues === clues ? ' selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select>`;
        root.querySelector('select').addEventListener('change', (e) => pinta(e.target.value));
      } catch (e) { console.warn('[DiagnosticoUnidad] unidades', e); }
    }
    if (!clues) { root.querySelector('.body').innerHTML = '<div class="msg">Tu usuario no tiene una unidad asignada.</div>'; return; }
    pinta(clues);
  }

  const API = {
    init(c) { cfg = c; },
    open,
    // puras (probadas en Node)
    prepara, analiza, coberturas, anteriorComparable, paresDe, hallazgos, fraseHero, contenidoHtml, VAC, KEYS, GRUPOS
  };
  root.DiagnosticoUnidad = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
