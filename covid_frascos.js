/**
 * COVID-19 (temporada invernal): rubros de meta y cálculo de frascos por marca.
 *
 * Formato oficial (PALOTEO INFLUENZA, fila 62 de FORMATOS_TEMPORADA_INVERNAL):
 *   c1 6-59 meses primera (0.25 mL) · c2 6-59 meses segunda (0.25 mL) · c3 5-59 años con factores de riesgo
 *   c4 60 años y más · c5 embarazadas · c6 personal de salud   (c3..c6 son de 0.5 mL)
 *   TOTAL en dosis de 0.5 mL = (c1 + c2) / 2 + c3 + c4 + c5 + c6.
 *
 * Marcas:
 *   MODERNA: pediátrica y adulto; 1 frasco = 5 dosis de 0.5 mL (10 pediátricas de 0.25 mL).
 *   PFIZER:  solo adultos (c3..c6); 1 frasco = 6 dosis.
 * El tope de frascos de un destino/unidad considera las dos marcas (en dosis de 0.5 mL) y limita a
 * Pfizer a la meta adulta. Debe coincidir con supabase/covid_metas_frascos.sql.
 */
(function (root) {
  "use strict";

  const RUBROS = [
    { id: "c1", categoria: "COVID-19", grupo: "Niñas y niños de 6 a 59 meses", edad: "Primera (0.25 mL)" },
    { id: "c2", categoria: "COVID-19", grupo: "Niñas y niños de 6 a 59 meses", edad: "Segunda (0.25 mL)" },
    { id: "c3", categoria: "COVID-19", grupo: "Personas de 5 a 59 años con factores de riesgo", edad: "0.5 mL" },
    { id: "c4", categoria: "COVID-19", grupo: "Personas de 60 años y más", edad: "0.5 mL" },
    { id: "c5", categoria: "COVID-19", grupo: "Personas embarazadas", edad: "0.5 mL" },
    { id: "c6", categoria: "COVID-19", grupo: "Personal de salud", edad: "0.5 mL" }
  ];
  const PEDIATRICOS = new Set(["c1", "c2"]);
  const MARCAS = [
    { id: "MODERNA", label: "Moderna", dosisPorFrasco: 5 },
    { id: "PFIZER", label: "Pfizer (solo adultos)", dosisPorFrasco: 6 }
  ];

  const n = (v) => Math.max(0, Number(v) || 0);

  function dosisPorFrasco(marca) {
    const m = MARCAS.find(x => x.id === marca);
    return m ? m.dosisPorFrasco : 10;
  }

  /** Dosis pediátricas (0.25 mL) tal como se capturan. */
  function metaPediatrica(metas) {
    return RUBROS.filter(r => PEDIATRICOS.has(r.id)).reduce((s, r) => s + n((metas || {})[r.id]), 0);
  }

  /** Meta adulta (0.5 mL): c3..c6. */
  function metaAdulta(metas) {
    return RUBROS.filter(r => !PEDIATRICOS.has(r.id)).reduce((s, r) => s + n((metas || {})[r.id]), 0);
  }

  /** Meta total en dosis de 0.5 mL equivalentes, redondeada hacia arriba. */
  function metaEquivalente(metas) {
    return Math.ceil(metaPediatrica(metas) / 2 + metaAdulta(metas));
  }

  /** Meta (en dosis de 0.5 mL) contra la que se reparte una marca: Moderna todo, Pfizer solo la adulta. */
  function metaMarca(metas, marca) {
    return marca === "PFIZER" ? metaAdulta(metas) : metaEquivalente(metas);
  }

  /**
   * Frascos que corresponden a una meta: los niños (6-59 meses) solo se vacunan con Moderna, así que la meta
   * pediátrica equivalente (c1+c2)/2 se cubre con Moderna (5 dosis de 0.5 mL por frasco); la meta adulta (c3..c6)
   * va con Pfizer (6 dosis por frasco). Ejemplo: 25 dosis de niños = 5 frascos de Moderna de cajón.
   * Sin pérdida (la pérdida de la Jurisdicción solo sube lo que se debe recibir).
   */
  function frascosPorMeta(metas) {
    const pedEq = metaPediatrica(metas) / 2;
    const adulto = metaAdulta(metas);
    const moderna = Math.ceil(pedEq / DPF_MODERNA);
    const pfizer = Math.ceil(adulto / DPF_PFIZER);
    return { pedEq, adulto, moderna, pfizer, total: moderna + pfizer };
  }

  /**
   * Cobertura de niños: los menores de 6 a 59 meses solo reciben Moderna, así que cada destino/unidad necesita
   * al menos `minimo` frascos de Moderna (meta pediátrica con su pérdida / 5, hacia arriba). Pfizer no cuenta.
   * `factor` = factorPerdida de la Jurisdicción; `moderna` = frascos de Moderna recibidos (todas las entregas).
   */
  function coberturaNinos(metas, factor, moderna) {
    const dosisNinos = Math.max(0, metaMarcaConPerdida(metas, "MODERNA", factor) - metaMarcaConPerdida(metas, "PFIZER", factor));
    const minimo = Math.ceil(dosisNinos / DPF_MODERNA);
    const recibidos = n(moderna);
    return { dosisNinos, minimo, moderna: recibidos, faltan: Math.max(0, minimo - recibidos), cubierto: recibidos >= minimo };
  }

  /**
   * ¿La meta no trae niños de 6 a 59 meses? (solo adultos). Entonces no recibe Moderna y su meta se cubre al 100 %
   * con Pfizer: `pfizerFrascos` = frascos de Pfizer que la cubren (6 dosis por frasco, con pérdida).
   */
  function sinNinos(metas, factor) {
    const total = metaMarcaConPerdida(metas, "MODERNA", factor);
    const adulto = metaMarcaConPerdida(metas, "PFIZER", factor);
    return { sinNinos: total > 0 && total <= adulto, dosisMeta: total, pfizerFrascos: Math.ceil(adulto / DPF_PFIZER) };
  }

  /**
   * Frascos que aún le caben a un destino/unidad en la entrega que se está capturando.
   *  - total / adulto: meta en dosis de 0.5 mL (equivalente) y meta adulta.
   *  - propiasOtras: frascos de ESTA marca en las demás entregas.
   *  - otraMarca: frascos de la OTRA marca (todas sus entregas).
   */
  function topeFrascos({ total, adulto, marca, propiasOtras, otraMarca, sinNinos }) {
    // Sin meta de niños no recibe Moderna: se cubre al 100 % con Pfizer (igual que el servidor).
    if (marca === "MODERNA" && sinNinos) return 0;
    const dpf = dosisPorFrasco(marca);
    const dpfOtra = dosisPorFrasco(marca === "PFIZER" ? "MODERNA" : "PFIZER");
    const otrasDosis = n(propiasOtras) * dpf + n(otraMarca) * dpfOtra;
    let tope = Math.ceil(Math.max(0, n(total) - otrasDosis) / dpf);
    if (marca === "PFIZER") {
      tope = Math.min(tope, Math.ceil(Math.max(0, n(adulto) - n(propiasOtras) * 6) / 6));
    }
    return tope;
  }

  // ─── Predistribución de la meta COVID con los porcentajes de la meta de influenza ──────────────────────
  // Pesos por rubro COVID a partir de las metas de influenza (r1..r17 y r18+):
  //   c1/c2 ← 6 a 59 meses (r1..r14) · c3 ← grupos de riesgo 5-59 (r18 en adelante) · c4 ← 60+ (r15)
  //   c5 ← embarazadas (r16) · c6 ← personal de salud (r17)
  function pesosInfluenza(metas) {
    const m = metas || {};
    const num = (k) => n(m[k]);
    let ped = 0, riesgo = 0;
    Object.keys(m).forEach(k => {
      const mt = /^r(\d+)$/.exec(k);
      if (!mt) return;
      const i = Number(mt[1]);
      if (i >= 1 && i <= 14) ped += num(k);
      else if (i >= 18) riesgo += num(k);
    });
    return { c1: ped, c2: ped, c3: riesgo, c4: num("r15"), c5: num("r16"), c6: num("r17") };
  }

  /** Reparte `total` en enteros proporcional a `pesos` (residuo mayor; empata el primero). */
  function repartirEntero(total, pesos) {
    total = Math.max(0, Math.round(Number(total) || 0));
    const suma = pesos.reduce((a, b) => a + b, 0);
    if (!total || !suma) return pesos.map(() => 0);
    const partes = pesos.map((w, i) => {
      const cuota = total * w;
      return { i, base: Math.floor(cuota / suma), resto: cuota % suma };
    });
    let sobran = total - partes.reduce((a, p) => a + p.base, 0);
    partes.slice().sort((a, b) => (b.resto - a.resto) || (a.i - b.i))
      .forEach(p => { if (sobran > 0 && pesos[p.i] > 0) { p.base += 1; sobran -= 1; } });
    return partes.map(p => p.base);
  }

  /**
   * totales: {c1..c6} a repartir. items: [{ id, metas (de influenza), permitidos }].
   * `permitidos` (opcional) = rubros que ese destino puede recibir; el resto queda en 0 (p. ej. un hospital
   * solo de adultos). Un destino permitido en un rubro donde su meta de influenza es 0 entra con un peso estimado
   * desde su meta de 60+ (o adulta) y la razón de ese rubro contra 60+ en los demás destinos (si no, nunca
   * recibiría nada). Si ningún destino tiene peso en un rubro se reparte por su meta total de influenza y, al
   * final, parejo entre los permitidos.
   */
  function predistribuir(totales, items) {
    const pesos = items.map(it => pesosInfluenza(it.metas));
    const out = {};
    items.forEach(it => { out[it.id] = {}; });
    RUBROS.forEach(r => {
      const elegible = items.map(it => !it.permitidos || it.permitidos.includes(r.id));
      // Razón de este rubro contra 60+ en los destinos sin restricción: sirve para darle peso a un destino
      // permitido que en influenza no tiene meta en el rubro (se estima desde su meta de 60+ o adulta).
      const libres = items.map((it, i) => i).filter(i => !items[i].permitidos);
      const sumRubro = libres.reduce((a, i) => a + pesos[i][r.id], 0);
      const sum60 = libres.reduce((a, i) => a + pesos[i].c4, 0);
      const razon = sum60 > 0 ? sumRubro / sum60 : 1;
      let w = items.map((it, i) => {
        if (!elegible[i]) return 0;
        const p = pesos[i];
        if (p[r.id] > 0) return p[r.id];
        if (!it.permitidos) return 0;
        const ref = p.c4 > 0 ? p.c4 : p.c3 + p.c5 + p.c6;
        return ref * razon;
      });
      if (!w.some(x => x > 0)) {
        w = items.map((it, i) => (elegible[i] ? pesos[i].c1 + pesos[i].c3 + pesos[i].c4 + pesos[i].c5 + pesos[i].c6 : 0));
      }
      if (!w.some(x => x > 0)) w = items.map((it, i) => (elegible[i] ? 1 : 0));
      const rep = repartirEntero(totales[r.id], w);
      items.forEach((it, i) => { out[it.id][r.id] = rep[i]; });
    });
    return out;
  }

  // ─── Factor de pérdida (dosis de 0.5 mL a nivel Jurisdicción) ──────────────────────────────────────────
  // No forma parte de la meta de aplicación: solo sube lo que se debe RECIBIR. Se aplica en la misma proporción
  // a cada destino y unidad: recibir = meta * (J + P) / J, con J la meta equivalente de la Jurisdicción y P la
  // pérdida. Aritmética entera (todo x2 por las pediátricas de 0.25 mL) para no depender de decimales:
  //   total  = ceil((ped + 2*adulto) * (J2 + 2P) / (2*J2))     adulto' = ceil(adulto * (J2 + 2P) / J2)
  function factorPerdida(metasJuris) {
    const m = metasJuris || {};
    const j2 = metaPediatrica(m) + 2 * metaAdulta(m);
    const p = Math.max(0, Math.round(Number(m.perdida) || 0));
    return { j2, p, activo: j2 > 0 && p > 0 };
  }

  /** Dosis (0.5 mL) a recibir de la marca para unas metas, con la pérdida de la Jurisdicción. */
  function metaMarcaConPerdida(metas, marca, factor) {
    const ped = metaPediatrica(metas), ad = metaAdulta(metas);
    const f = factor || { activo: false };
    if (marca === "PFIZER") return f.activo ? Math.ceil(ad * (f.j2 + 2 * f.p) / f.j2) : ad;
    return f.activo
      ? Math.ceil((ped + 2 * ad) * (f.j2 + 2 * f.p) / (2 * f.j2))
      : Math.ceil((ped + 2 * ad) / 2);
  }

  // ─── Frascos cerrados (con la pérdida incluida) ───────────────────────────────────────────────────────
  // Regla: cada destino y cada unidad debe recibir frascos COMPLETOS; el sobrante (frasco abierto) se lo queda
  // Querétaro, en la unidad Pedro Escobedo. Con dos marcas, «cerrado» se define así:
  //   Moderna (niños, 5 dosis de 0.5 mL): la meta pediátrica equivalente + su pérdida es múltiplo de 5.
  //   Pfizer  (adultos,  6 dosis de 0.5 mL): la meta adulta + su pérdida es múltiplo de 6.
  // «+ su pérdida» = recibir = ceil(dosis * num / den), con num/den = (J2 + 2P) / J2 (ver factorPerdida).
  const DPF_MODERNA = 5;
  const DPF_PFIZER = 6;

  function razonPerdida(factor) {
    const f = factor || {};
    return f.activo ? { num: f.j2 + 2 * f.p, den: f.j2 } : { num: 1, den: 1 };
  }

  /** Dosis (0.5 mL) a recibir por unas dosis de meta, con pérdida; siempre entero y hacia arriba. */
  function recibirDosis(dosis, razon) {
    const r = razon || { num: 1, den: 1 };
    return Math.ceil((Math.max(0, Math.round(dosis)) * r.num) / r.den);
  }

  function esCerrado(dosis, dpf, razon) {
    return dosis === 0 || recibirDosis(dosis, razon) % dpf === 0;
  }

  /** Valores cerrados cercanos a `ideal` (hasta `cuantos`), del más cercano al más lejano. */
  function candidatosCerrados(ideal, dpf, razon, cuantos) {
    const centro = Math.max(0, Math.round(ideal));
    const salida = [];
    const alcance = dpf * 3 + 4;
    for (let d = 0; d <= alcance && salida.length < (cuantos || 5); d++) {
      const arriba = centro + d;
      const abajo = centro - d;
      if (esCerrado(arriba, dpf, razon)) salida.push(arriba);
      if (d > 0 && abajo >= 0 && esCerrado(abajo, dpf, razon)) salida.push(abajo);
    }
    return salida;
  }

  /**
   * Reparte `total` dosis entre `pesos.length` renglones dejando cerrados a todos menos al `absorbedor` (índice),
   * que se queda con lo que sobre. Sin absorbedor busca, con programación dinámica, la combinación cerrada que suma
   * exacto; si no existe, el renglón de mayor peso absorbe (queda abierto) y se reporta en `abierto`.
   * Devuelve { valores:[], abierto: índice|null }.
   */
  function cerrarLado(total, pesos, dpf, razon, absorbedor, elegibles) {
    total = Math.max(0, Math.round(total));
    const n = pesos.length;
    const ok = (i) => !elegibles || elegibles[i];
    const sumaPesos = pesos.reduce((a, w, i) => a + (ok(i) ? w : 0), 0);
    const ideal = pesos.map((w, i) => (ok(i) && sumaPesos > 0 ? (total * w) / sumaPesos : 0));
    const valores = new Array(n).fill(0);
    const sinAbs = (absorbedor === null || absorbedor === undefined || absorbedor < 0);

    if (!sinAbs) {
      let usado = 0;
      for (let i = 0; i < n; i++) {
        if (i === absorbedor || !ok(i)) continue;
        // el más cercano por debajo del ideal (así el absorbedor nunca queda en negativo)
        const cands = candidatosCerrados(Math.floor(ideal[i]), dpf, razon, 12).filter(c => c <= Math.ceil(ideal[i]));
        valores[i] = cands.length ? cands.reduce((a, b) => (Math.abs(b - ideal[i]) < Math.abs(a - ideal[i]) ? b : a)) : 0;
        usado += valores[i];
      }
      // si por redondeo se pasó del total, se baja a los de mayor valor
      while (usado > total) {
        let k = -1;
        for (let i = 0; i < n; i++) if (i !== absorbedor && valores[i] > 0 && (k < 0 || valores[i] > valores[k])) k = i;
        if (k < 0) break;
        const menores = candidatosCerrados(valores[k] - 1, dpf, razon, 12).filter(c => c < valores[k]);
        const nuevo = menores.length ? menores[0] : 0;
        usado -= valores[k] - nuevo;
        valores[k] = nuevo;
      }
      valores[absorbedor] = total - usado;
      return { valores, abierto: null };
    }

    // Sin absorbedor: DP sobre los candidatos de cada renglón (suma exacta, mínima desviación)
    const idx = [];
    for (let i = 0; i < n; i++) if (ok(i)) idx.push(i);
    let capas = [new Map([[0, { costo: 0, prev: null, val: 0 }]])];
    for (const i of idx) {
      const cands = candidatosCerrados(ideal[i], dpf, razon, 7);
      const sig = new Map();
      capas[capas.length - 1].forEach((estado, suma) => {
        cands.forEach(c => {
          const s = suma + c;
          if (s > total) return;
          const costo = estado.costo + Math.abs(c - ideal[i]);
          const previo = sig.get(s);
          if (!previo || costo < previo.costo) sig.set(s, { costo, prev: suma, val: c });
        });
      });
      capas.push(sig);
    }
    const final = capas[capas.length - 1].get(total);
    if (final) {
      let suma = total;
      for (let k = idx.length - 1; k >= 0; k--) {
        const est = capas[k + 1].get(suma);
        valores[idx[k]] = est.val;
        suma = est.prev;
      }
      return { valores, abierto: null };
    }
    // No hay combinación cerrada exacta: el de mayor peso absorbe y queda abierto
    let mayor = idx[0];
    idx.forEach(i => { if (pesos[i] > pesos[mayor]) mayor = i; });
    const r = cerrarLado(total, pesos, dpf, razon, mayor, elegibles);
    return { valores: r.valores, abierto: mayor };
  }

  /**
   * Predistribución con FRASCOS CERRADOS. Parte de los porcentajes de influenza (predistribuir) y los acomoda para que
   * todo renglón menos el `absorbedor` (id) reciba frascos completos de Moderna (niños) y de Pfizer (adultos), ya con
   * la pérdida. opts: { perdida (dosis 0.5 mL de la Jurisdicción), absorbedor (id), jurisTotales ({c1..c6} de la
   * Jurisdicción, para la razón de pérdida; por omisión `totales`) }.
   * Devuelve { valores: {id:{c1..c6}}, abiertos: [ids] } (abiertos = los que no se pudieron cerrar sin absorbedor).
   */
  function predistribuirCerrado(totales, items, opts) {
    const o = opts || {};
    const base = predistribuir(totales, items);
    const jur = o.jurisTotales || totales;
    const razon = razonPerdida(factorPerdida({ ...jur, perdida: o.perdida || 0 }));
    const n = items.length;
    const abs = o.absorbedor ? items.findIndex(it => it.id === o.absorbedor) : -1;
    const permite = (it, r) => !it.permitidos || it.permitidos.includes(r);
    const valores = {};
    items.forEach(it => { valores[it.id] = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }; });
    const abiertos = [];

    // Niños: c1 = c2 = v (cada renglón cerrado en múltiplos de Moderna); el absorbedor se queda con lo demás
    const pedTotal = Math.min(Number(totales.c1) || 0, Number(totales.c2) || 0);
    const pedElegible = items.map(it => permite(it, "c1") && permite(it, "c2"));
    if (pedTotal > 0 && pedElegible.some(Boolean)) {
      const pesos = items.map(it => (base[it.id].c1 + base[it.id].c2) / 2);
      const r = cerrarLado(pedTotal, pesos, DPF_MODERNA, razon, abs, pedElegible);
      items.forEach((it, i) => { if (pedElegible[i]) { valores[it.id].c1 = r.valores[i]; valores[it.id].c2 = r.valores[i]; } });
      if (r.abierto !== null && r.abierto !== undefined) abiertos.push(items[r.abierto].id);
    }
    // lo que c1 o c2 tienen de más que el mínimo (c1 != c2 en la meta jurídica) lo absorbe el absorbedor / el mayor
    const resto = (rub) => (Number(totales[rub]) || 0) - items.reduce((a, it) => a + valores[it.id][rub], 0);
    ["c1", "c2"].forEach(rub => {
      const sobra = resto(rub);
      if (sobra > 0) {
        const dest = abs >= 0 ? abs : items.reduce((m, it, i) => (pedElegible[i] && (m < 0 || base[it.id][rub] > base[items[m].id][rub]) ? i : m), -1);
        if (dest >= 0) valores[items[dest].id][rub] += sobra;
      }
    });

    // Adultos: cada renglón cerrado en múltiplos de Pfizer; después se reparte entre c3..c6 y se ajustan columnas
    const ADULTO = ["c3", "c4", "c5", "c6"];
    const adultoTotal = ADULTO.reduce((a, r) => a + (Number(totales[r]) || 0), 0);
    const adElegible = items.map(it => ADULTO.some(r => permite(it, r)));
    if (adultoTotal > 0 && adElegible.some(Boolean)) {
      const pesos = items.map(it => ADULTO.reduce((a, r) => a + base[it.id][r], 0));
      const r = cerrarLado(adultoTotal, pesos, DPF_PFIZER, razon, abs, adElegible);
      if (r.abierto !== null && r.abierto !== undefined && !abiertos.includes(items[r.abierto].id)) abiertos.push(items[r.abierto].id);
      // fila: reparto de cada renglón entre sus rubros adultos (proporcional a lo predistribuido)
      items.forEach((it, i) => {
        if (!adElegible[i] || i === abs) return;
        const rubros = ADULTO.filter(rb => permite(it, rb));
        let w = rubros.map(rb => base[it.id][rb]);
        if (!w.some(x => x > 0)) w = rubros.map(() => 1);
        repartirEntero(r.valores[i], w).forEach((v, k) => { valores[it.id][rubros[k]] = v; });
      });
      if (abs >= 0) {
        // el absorbedor se queda con lo que falta en cada columna
        ADULTO.forEach(rb => {
          const falta = (Number(totales[rb]) || 0) - items.reduce((a, it, i) => a + (i === abs ? 0 : valores[it.id][rb]), 0);
          valores[items[abs].id][rb] = Math.max(0, falta);
        });
      } else {
        // sin absorbedor: cuadrar columnas moviendo dosis entre rubros dentro de un mismo renglón (no cambia su total)
        let guardia = 100000;
        for (;;) {
          const dif = {};
          ADULTO.forEach(rb => { dif[rb] = (Number(totales[rb]) || 0) - items.reduce((a, it) => a + valores[it.id][rb], 0); });
          const falta = ADULTO.find(rb => dif[rb] > 0);
          const sobra = ADULTO.find(rb => dif[rb] < 0);
          if (!falta || !sobra || guardia-- <= 0) break;
          const it = items.find(x => valores[x.id][sobra] > 0 && permite(x, falta));
          if (!it) break;
          valores[it.id][sobra] -= 1;
          valores[it.id][falta] += 1;
        }
      }
    }
    return { valores, abiertos };
  }

  // ─── Avance: dosis aplicadas (SIS) contra la meta ──────────────────────────────────────────────────────
  // Variable SIS (clave general, igual que los indicadores RDA) de cada rubro de meta.
  const VARIABLE_SIS = { c1: "VCV38", c2: "VCV39", c3: "VCV28", c4: "VCV16", c5: "VCV20", c6: "VCV21" };

  /**
   * metas y aplicadas: { c1..c6 } en dosis tal como se capturan (c1/c2 son de 0.25 mL). Devuelve el detalle por
   * rubro y los totales en dosis equivalentes de 0.5 mL (los niños valen la mitad, igual que la meta).
   */
  function avanceRubros(metas, aplicadas) {
    const m = metas || {};
    const a = aplicadas || {};
    const rubros = RUBROS.map((r) => {
      const meta = n(m[r.id]);
      const apl = n(a[r.id]);
      return { id: r.id, meta, aplicadas: apl, pct: meta > 0 ? (apl * 100) / meta : null, pendiente: Math.max(0, meta - apl) };
    });
    const peso = (id) => (PEDIATRICOS.has(id) ? 0.5 : 1);
    const metaEq = rubros.reduce((s, r) => s + r.meta * peso(r.id), 0);
    const aplEq = rubros.reduce((s, r) => s + r.aplicadas * peso(r.id), 0);
    return {
      rubros, metaEq, aplEq,
      pct: metaEq > 0 ? (aplEq * 100) / metaEq : null,
      pendienteEq: Math.max(0, metaEq - aplEq)
    };
  }

  const api = { RUBROS, MARCAS, dosisPorFrasco, metaPediatrica, metaAdulta, metaEquivalente, metaMarca, topeFrascos, frascosPorMeta, coberturaNinos, sinNinos,
    pesosInfluenza, repartirEntero, predistribuir, factorPerdida, metaMarcaConPerdida,
    razonPerdida, recibirDosis, esCerrado, candidatosCerrados, cerrarLado, predistribuirCerrado, DPF_MODERNA, DPF_PFIZER,
    VARIABLE_SIS, avanceRubros };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CovidFrascos = api;
})(typeof window !== "undefined" ? window : globalThis);
