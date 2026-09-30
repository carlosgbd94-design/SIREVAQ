/**
 * Reparto de frascos de influenza en proporción a la meta.
 *
 * Los frascos no se entregan abiertos, así que el reparto es en enteros y la
 * suma NUNCA rebasa el total: se calcula con el método del residuo mayor
 * (piso de cada cuota y los frascos sobrantes a quien perdió más decimales;
 * si empatan gana el que va primero en la lista, por eso Querétaro va primero).
 *
 * `manual` ({id: frascos}) son los que el usuario editó a mano: se respetan y
 * el resto se reparte con lo que queda.
 *
 * Todo con aritmética entera (cuota = restante * meta / sumaMetas) para que no
 * haya errores de punto flotante.
 */
(function (root) {
  "use strict";

  function repartirFrascos(total, items, manual) {
    total = Math.max(0, Math.floor(Number(total) || 0));
    manual = manual || {};
    const out = {};
    let fijado = 0;

    items.forEach(it => {
      if (Object.prototype.hasOwnProperty.call(manual, it.id)) {
        const v = Math.max(0, Math.floor(Number(manual[it.id]) || 0));
        out[it.id] = v;
        fijado += v;
      }
    });

    const auto = items.filter(it => !Object.prototype.hasOwnProperty.call(manual, it.id));
    const restante = Math.max(0, total - fijado);
    const metas = auto.map(it => Math.max(0, Math.round(Number(it.meta) || 0)));
    const sumaMetas = metas.reduce((a, b) => a + b, 0);

    if (sumaMetas === 0) {
      auto.forEach(it => { out[it.id] = 0; });
    } else {
      const partes = auto.map((it, i) => {
        const cuota = restante * metas[i];
        return { id: it.id, base: Math.floor(cuota / sumaMetas), resto: cuota % sumaMetas, orden: i };
      });
      let sobran = restante - partes.reduce((a, p) => a + p.base, 0);
      partes
        .slice()
        .sort((a, b) => (b.resto - a.resto) || (a.orden - b.orden))
        .forEach(p => { if (sobran > 0) { p.base += 1; sobran -= 1; } });
      partes.forEach(p => { out[p.id] = p.base; });
    }

    const asignado = items.reduce((s, it) => s + (out[it.id] || 0), 0);
    return { frascos: out, asignado, porAsignar: total - asignado };
  }

  const api = { repartirFrascos };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.InfluenzaReparto = api;
})(typeof window !== "undefined" ? window : globalThis);
