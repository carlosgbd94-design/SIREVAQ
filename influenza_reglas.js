/**
 * Reglas de calendario de las dosis de Influenza.
 *
 * Esquema de vacunación: la 1ª dosis es el día 0 y la 2ª va 1 mes después; si no se completa dentro de la
 * misma temporada invernal, el esquema se reinicia. Por eso, con las fechas de la campaña:
 *   · no hay 2ª dosis durante el 1er mes (antes de inicio + 1 mes), y
 *   · no hay 1ª dosis durante el último mes (después de fin − 1 mes).
 * Las ventanas salen de las fechas de la campaña (las que se editan en «Fechas Campaña»), así que si la
 * clausura se extiende, la ventana de 1ras dosis se mueve sola. Fechas en formato AAAA-MM-DD.
 */
(function (root) {
  "use strict";

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function partes(ymd) {
    const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
    return { y, m, d };
  }

  function aYmd(dt) {
    return dt.toISOString().slice(0, 10);
  }

  // Suma meses calendario; si el día no existe en el mes destino se queda en el último (31-ene + 1 mes = 28/29-feb).
  function sumaMeses(ymd, n) {
    const { y, m, d } = partes(ymd);
    const primero = new Date(Date.UTC(y, m - 1 + n, 1));
    const ultimo = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0)).getUTCDate();
    primero.setUTCDate(Math.min(d, ultimo));
    return aYmd(primero);
  }

  function ventanas(inicio, fin) {
    return { segundasDesde: sumaMeses(inicio, 1), primerasHasta: sumaMeses(fin, -1) };
  }

  function fechaLarga(ymd) {
    const { y, m, d } = partes(ymd);
    return `${d} ${MESES[m - 1]} ${y}`;
  }

  function fechaCorta(ymd) {
    const { m, d } = partes(ymd);
    return `${d} ${MESES[m - 1]}`;
  }

  /**
   * null si se puede capturar; si no, { tipo, fecha, etiqueta, texto }.
   * `grupo` es el grupo del rubro («Primera dosis», «Segunda dosis»...); el resto de grupos
   * (revacunación, grupos de riesgo) no tiene restricción de calendario.
   */
  function reglaDosis(grupo, fecha, inicio, fin) {
    if (!fecha || !inicio || !fin) return null;
    const v = ventanas(inicio, fin);
    if (grupo === "Segunda dosis" && fecha < v.segundasDesde) {
      return {
        tipo: "segunda", fecha: v.segundasDesde, etiqueta: `Desde ${fechaCorta(v.segundasDesde)}`,
        texto: `No hay 2ª dosis en el 1er mes de la campaña: la 2ª va un mes después de la 1ª, así que se captura a partir del ${fechaLarga(v.segundasDesde)}.`
      };
    }
    if (grupo === "Primera dosis" && fecha > v.primerasHasta) {
      return {
        tipo: "primera", fecha: v.primerasHasta, etiqueta: `Hasta ${fechaCorta(v.primerasHasta)}`,
        texto: `No hay 1ª dosis en el último mes de la campaña: su 2ª dosis caería fuera de la temporada. La última fecha para 1ª dosis es el ${fechaLarga(v.primerasHasta)}.`
      };
    }
    return null;
  }

  function diaSemana(ymd) {
    const { y, m, d } = partes(ymd);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();   // 0 = domingo ... 5 = viernes
  }

  /**
   * Cortes de fin de mes: los reportes son de viernes, pero el SIS corta por mes calendario. Si el mes (o la
   * campaña) termina de lunes a jueves, esos días ya no caben en el viernes siguiente (cae en otro mes), así que
   * se captura un reporte extra fechado el último día. Si termina en viernes ya es su reporte; si termina en
   * sábado o domingo no se aplica nada en fin de semana: esos días entran en el reporte del viernes anterior.
   */
  function cortes(inicio, fin) {
    if (!inicio || !fin) return [];
    const out = [];
    const agrega = (ymd) => {
      const dow = diaSemana(ymd);
      if (dow >= 1 && dow <= 4 && ymd >= inicio && ymd <= fin && !out.includes(ymd)) out.push(ymd);
    };
    const a = partes(inicio), z = partes(fin);
    const meses = (z.y - a.y) * 12 + (z.m - a.m);
    for (let i = 0; i <= meses; i++) {
      agrega(aYmd(new Date(Date.UTC(a.y, a.m - 1 + i + 1, 0))));   // último día de ese mes
    }
    agrega(fin);
    return out.sort();
  }

  const api = { sumaMeses, ventanas, fechaLarga, fechaCorta, reglaDosis, cortes, diaSemana };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.InfluenzaReglas = api;
})(typeof window !== "undefined" ? window : globalThis);
