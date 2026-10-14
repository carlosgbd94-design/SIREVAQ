/**
 * COVID-19 (temporada invernal): rubros de meta y cálculo de frascos por marca.
 *
 * Formato oficial (PALOTEO INFLUENZA, fila 62 de FORMATOS_TEMPORADA_INVERNAL):
 *   c1 6-59 meses primera (0.25 mL) · c2 6-59 meses segunda (0.25 mL) · c3 5-59 años con factores de riesgo
 *   c4 60 años y más · c5 embarazadas · c6 personal de salud   (c3..c6 son de 0.5 mL)
 *   TOTAL en dosis de 0.5 mL = (c1 + c2) / 2 + c3 + c4 + c5 + c6.
 *
 * Marcas:
 *   MODERNA: pediátrica y adulto; 1 frasco = 10 dosis de 0.5 mL.
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
    { id: "MODERNA", label: "Moderna", dosisPorFrasco: 10 },
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
   * Frascos que aún le caben a un destino/unidad en la entrega que se está capturando.
   *  - total / adulto: meta en dosis de 0.5 mL (equivalente) y meta adulta.
   *  - propiasOtras: frascos de ESTA marca en las demás entregas.
   *  - otraMarca: frascos de la OTRA marca (todas sus entregas).
   */
  function topeFrascos({ total, adulto, marca, propiasOtras, otraMarca }) {
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

  const api = { RUBROS, MARCAS, dosisPorFrasco, metaPediatrica, metaAdulta, metaEquivalente, metaMarca, topeFrascos,
    pesosInfluenza, repartirEntero, predistribuir };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CovidFrascos = api;
})(typeof window !== "undefined" ? window : globalThis);
