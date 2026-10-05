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

  /**
   * Reparto "libre": cada renglón vale lo que el usuario escribió (manual) o, si no ha escrito nada,
   * su parte proporcional a la meta del TOTAL. Tocar un renglón NO mueve a los demás: el total repartido
   * es simplemente la suma de lo que se ve, y puede pasarse (porAsignar < 0) o faltar (> 0).
   * Cuadrarlo es una acción explícita (cuadrarResto).
   */
  function repartoLibre(total, items, manual) {
    manual = manual || {};
    const base = repartirFrascos(total, items, {}).frascos;
    const frascos = {};
    let asignado = 0;
    items.forEach(it => {
      const v = Object.prototype.hasOwnProperty.call(manual, it.id)
        ? Math.max(0, Math.floor(Number(manual[it.id]) || 0))
        : (base[it.id] || 0);
      frascos[it.id] = v;
      asignado += v;
    });
    const t = Math.max(0, Math.floor(Number(total) || 0));
    return { frascos, asignado, porAsignar: t - asignado, base };
  }

  /**
   * Reparte lo que falta (o quita lo que sobra) SOLO entre los renglones que el usuario no tocó,
   * proporcional a su meta. Devuelve { ok, frascos } o { ok:false, motivo }.
   */
  function cuadrarResto(total, items, valoresTocados) {
    total = Math.max(0, Math.floor(Number(total) || 0));
    const tocados = items.filter(it => Object.prototype.hasOwnProperty.call(valoresTocados, it.id));
    const libres = items.filter(it => !Object.prototype.hasOwnProperty.call(valoresTocados, it.id));
    const sumaTocados = tocados.reduce((s, it) => s + Math.max(0, Math.floor(Number(valoresTocados[it.id]) || 0)), 0);
    if (!libres.length) return { ok: false, motivo: "no-hay-libres", sumaTocados };
    const restante = total - sumaTocados;
    if (restante < 0) return { ok: false, motivo: "tocados-se-pasan", sumaTocados, restante };
    const conMeta = libres.some(it => Math.round(Number(it.meta) || 0) > 0);
    if (!conMeta && restante > 0) return { ok: false, motivo: "sin-meta", sumaTocados, restante };
    const rep = repartirFrascos(restante, libres, {}).frascos;
    return { ok: true, frascos: rep, libres: libres.map(it => it.id), restante };
  }

  const api = { repartirFrascos, repartoLibre, cuadrarResto };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.InfluenzaReparto = api;
})(typeof window !== "undefined" ? window : globalThis);
