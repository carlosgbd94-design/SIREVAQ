/* COVID-19: captura semanal por unidad y por marca (lógica pura: validación, paquete CeNSIA, suma para SIS y Movimiento).
 *
 * valores = { MODERNA: { c1..c6 }, PFIZER: { c3..c6 } }   (dosis tal como se aplican; c1/c2 son de 0.25 mL)
 * Rubros y marcas = covid_frascos.js. La meta es una sola por rubro: Moderna + Pfizer suman contra ella.
 */
(function (root) {
  "use strict";

  const RUBROS = ["c1", "c2", "c3", "c4", "c5", "c6"];
  const MARCAS = ["MODERNA", "PFIZER"];
  // Pfizer no se aplica a niños de 6 a 59 meses
  const RUBROS_MARCA = { MODERNA: ["c1", "c2", "c3", "c4", "c5", "c6"], PFIZER: ["c3", "c4", "c5", "c6"] };
  const ETIQUETA = {
    c1: "Niñas y niños de 6 a 59 meses · 1ª dosis (0.25 mL)",
    c2: "Niñas y niños de 6 a 59 meses · 2ª dosis (0.25 mL)",
    c3: "Personas de 5 a 59 años con factores de riesgo",
    c4: "Personas de 60 años y más",
    c5: "Personas embarazadas",
    c6: "Personal de salud"
  };

  // Casillas de CeNSIA (pantalla Captura, sección COVID-19). El sufijo CM = Moderna, CP = Pfizer.
  // «Otra» marca (CO) y las filas «Otros» (BIE148..151) no se capturan en SIREVAQ (solo hay Moderna y Pfizer).
  // Comorbilidades 5-59: SIREVAQ captura un solo rubro, todo va a la casilla de 12 a 59 años (decisión del usuario).
  const CENSIA = {
    MODERNA: { c1: "BIE200CM", c2: "BIE200CM2", c3: "BIE103_12a59aCM", c4: "BIE40CM", c5: "BIO96CM", c6: "BIO97CM" },
    PFIZER: { c3: "BIE103_12a59aCP", c4: "BIE40CP", c5: "BIO96CP", c6: "BIO97CP" }
  };

  // Claves SINBA-SIS (hojas SIS-06-P y SIS-SS-CE-H; NO distinguen marca: Moderna + Pfizer se suman).
  const SIS_CLAVE = { c1: "VCV38", c2: "VCV39", c3: "VCV28", c4: "VCV16", c5: "VCV20", c6: "VCV21" };
  // Refuerzo de 6 a 59 meses (VCV40, renglón «344 COVID-19» del SIS): no existe en las metas, así que por ahora
  // no se captura ni se prellena. Para activarlo: agregar su rubro a covid_frascos.js/metas, a RUBROS y aquí.
  const SIS_REFUERZO_6_59 = { clave: "VCV40", activo: false };

  const n = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; };

  /** Normaliza lo tecleado: solo marcas y rubros válidos, enteros >= 0. */
  function limpiar(valores) {
    const out = { MODERNA: {}, PFIZER: {} };
    MARCAS.forEach((m) => {
      RUBROS_MARCA[m].forEach((r) => { out[m][r] = n(valores && valores[m] && valores[m][r]); });
    });
    return out;
  }

  /** Suma de ambas marcas por rubro: { c1..c6 }. */
  function porRubro(valores) {
    const t = {};
    RUBROS.forEach((r) => { t[r] = MARCAS.reduce((s, m) => s + n(valores && valores[m] && valores[m][r]), 0); });
    return t;
  }

  function totalDosis(valores) {
    const t = porRubro(valores);
    return RUBROS.reduce((s, r) => s + t[r], 0);
  }

  /**
   * Regla de calendario (igual que Influenza): la 2ª dosis de 6 a 59 meses (c2) no se captura durante el 1er mes de la
   * campaña, porque va un mes después de la 1ª. null = se puede capturar; si no, { tipo, fecha, etiqueta, texto }.
   * Las fechas de la campaña se editan en «Fechas Campaña»; la regla vive en influenza_reglas.js.
   */
  function reglaRubro(r, fecha, inicio, fin) {
    if (r !== "c2" || !root.InfluenzaReglas) return null;
    return root.InfluenzaReglas.reglaDosis("Segunda dosis", fecha, inicio, fin);
  }

  /**
   * Valida un reporte contra la meta de la unidad. metas = { c1..c6 }; acumOtras = { c1..c6 } de las demás semanas;
   * previo = valores ya guardados de esta semana (lo que ya estaba no bloquea, igual que en Influenza).
   * reglas = { c2: regla|null } (opcional, de reglaRubro): un rubro bloqueado por calendario no admite dosis nuevas.
   * Devuelve { error, excedidos: [{rubro, exceso}] }.
   */
  function validar(valores, metas, acumOtras, previo, reglas) {
    const nuevo = porRubro(valores);
    const antes = porRubro(previo || {});
    const excedidos = [];
    let sinMeta = null, bloqueado = null;
    RUBROS.forEach((r) => {
      if (nuevo[r] <= antes[r]) return;
      if (reglas && reglas[r]) { bloqueado = bloqueado || { r, regla: reglas[r] }; return; }
      const meta = n(metas && metas[r]);
      if (!meta) { sinMeta = sinMeta || r; return; }
      const exceso = n(acumOtras && acumOtras[r]) + nuevo[r] - meta;
      if (exceso > 0) excedidos.push({ rubro: r, exceso });
    });
    let error = null;
    if (bloqueado) error = `${ETIQUETA[bloqueado.r]}: ${bloqueado.regla.texto}`;
    else if (sinMeta) error = `${ETIQUETA[sinMeta]}: la unidad no tiene meta de COVID-19 asignada en este rubro.`;
    else if (excedidos.length) error = `No se puede guardar el reporte: ${ETIQUETA[excedidos[0].rubro]} supera la meta de tu unidad por ${excedidos[0].exceso} dosis (Moderna y Pfizer suman contra la misma meta).`;
    return { error, excedidos };
  }

  /** Paquete para el complemento CeNSIA: { idCasilla: dosis } solo con lo > 0 en casillas válidas. */
  function paqueteCensia(valores) {
    const v = limpiar(valores);
    const out = {};
    MARCAS.forEach((m) => {
      RUBROS_MARCA[m].forEach((r) => { if (v[m][r] > 0) out[CENSIA[m][r]] = v[m][r]; });
    });
    return out;
  }

  /** Suma del mes (capturas ya filtradas al mes) por clave SIS, sin marca: { VCV38: n, ... }. */
  function sisPorClave(capturas) {
    const acum = {};
    RUBROS.forEach((r) => { acum[r] = 0; });
    (capturas || []).forEach((c) => {
      const t = porRubro(c.valores);
      RUBROS.forEach((r) => { acum[r] += t[r]; });
    });
    const out = {};
    RUBROS.forEach((r) => { out[SIS_CLAVE[r]] = acum[r]; });
    return out;
  }

  /**
   * Movimiento de biológico (sí distingue marca): dosis aplicadas del mes por biológico BioVac.
   * COVID_MODERNA es de dosis partida: a = pediátricas de 0.25 mL (c1+c2), b = adultas de 0.5 mL (c3..c6).
   * COVID_PFIZER no se parte: a = todas (solo adultos).
   */
  function movimientoPorMarca(capturas) {
    const mod = { a: 0, b: 0 };
    const pfi = { a: 0 };
    (capturas || []).forEach((c) => {
      const v = c.valores || {};
      const M = v.MODERNA || {};
      const P = v.PFIZER || {};
      mod.a += n(M.c1) + n(M.c2);
      mod.b += n(M.c3) + n(M.c4) + n(M.c5) + n(M.c6);
      pfi.a += n(P.c3) + n(P.c4) + n(P.c5) + n(P.c6);
    });
    return { COVID_MODERNA: mod, COVID_PFIZER: pfi };
  }

  /** Semanas (fecha YYYY-MM-DD) cuya fecha cae en el mes/año dado. */
  function delMes(capturas, mes, anio) {
    return (capturas || []).filter((c) => {
      const [a, m] = String(c.fecha).slice(0, 10).split("-").map(Number);
      return a === anio && m === mes;
    });
  }

  const api = { RUBROS, MARCAS, RUBROS_MARCA, ETIQUETA, CENSIA, SIS_CLAVE, SIS_REFUERZO_6_59,
    limpiar, porRubro, totalDosis, reglaRubro, validar, paqueteCensia, sisPorClave, movimientoPorMarca, delMes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CovidCaptura = api;
})(typeof window !== "undefined" ? window : globalThis);
