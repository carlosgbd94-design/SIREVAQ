/**
 * proyeccion_consumo.js — Motor de proyección del consumo mensual por unidad y biológico (SIREVAQ).
 *
 * Lógica pura (sin DOM ni red), probada en Node. La usa la Calculadora de Parámetros (param_calculator.js) en el modo
 * «Proyección inteligente» para proponer Promedio (punto de reorden, en frascos), Mínimo y Máximo (en dosis) del mes que
 * viene. Cada propuesta lleva su explicación y su confianza; nada se guarda sin aprobación humana.
 *
 * Qué considera:
 *   · Nivel reciente: promedio con peso exponencial (vida media de 3 meses), no el promedio de enero al último mes.
 *   · Tendencia: pendiente de los últimos 6 meses, amortiguada y solo en la medida en que es significativa.
 *   · Estacionalidad: índice del grupo de unidades (mismo mes de otros años) mezclado con el de la propia unidad.
 *   · Meses atípicos: picos o ceros fuera de lo normal se acotan; los meses de evento (brote/campaña que afecta a muchas
 *     unidades a la vez) se conservan pero pesan la mitad.
 *   · Cambio de nivel: si los últimos 3 meses ya son otro nivel (cambio de población, apertura/cierre de servicio), solo
 *     se usan los meses recientes.
 *   · Existencia y pedidos previos: desabasto reciente = demanda subestimada (sube); sobreexistencia sostenida (baja el Promedio).
 *   · Variabilidad real: el error que habría tenido el propio método los meses anteriores (backtest), no un % fijo.
 */
(function (root) {
  "use strict";

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  // Parámetros del método (ajustados con un backtest sobre el SIS real; ver tests/proyeccion-consumo.spec.js)
  // estacDamp: cuánto se confía en el índice estacional con UN solo ciclo de historia; estacDampVarios: con 2 o más años.
  const CFG = { vidaMedia: 2, amortigua: 0.6, estacDamp: 0.3, estacDampVarios: 0.6, tendencia: 1, sigmaMult: 1.7, umbralAtipico: 3.5 };
  const Z_P10 = 1.28, Z_P95 = 1.65;
  const SEMANAS_MES = 4.345;

  const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const media = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const mediana = (a) => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const desv = (a) => {
    if (a.length < 2) return 0;
    const m = media(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
  };
  const idx = (anio, mes) => anio * 12 + (mes - 1);
  const claveMes = (anio, mes) => `${anio}-${String(mes).padStart(2, "0")}`;
  const semanasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate() / 7;
  const fmt = (n) => Math.round(n).toLocaleString("es-MX");

  /** Serie contigua [{anio, mes, dosis|null}] → puntos válidos [{i, anio, mes, y}] (null = mes sin cargar). */
  function puntos(serie) {
    return (serie || []).filter((p) => p && p.dosis !== null && p.dosis !== undefined && Number.isFinite(Number(p.dosis)))
      .map((p) => ({ i: idx(p.anio, p.mes), anio: p.anio, mes: p.mes, y: Math.max(0, Number(p.dosis)) }))
      .sort((a, b) => a.i - b.i);
  }

  /** Factor estacional (amortiguado) de un mes a partir del índice del grupo: 1 = sin efecto. */
  // Con un solo ciclo de ese mes (un solo año) el índice es poco confiable; con 2 o más se le cree más
  function dampEstac(indiceGrupo, mes) {
    const a = indiceGrupo && indiceGrupo.aniosPorMes ? indiceGrupo.aniosPorMes[mes] : 0;
    return a >= 2 ? CFG.estacDampVarios : CFG.estacDamp;
  }
  function factorGrupo(indiceGrupo, mes) {
    const f = indiceGrupo && indiceGrupo.factores ? Number(indiceGrupo.factores[mes]) : NaN;
    return Number.isFinite(f) && f > 0 ? 1 + dampEstac(indiceGrupo, mes) * (clamp(f, 0.5, 2) - 1) : 1;
  }

  /**
   * Índice estacional del grupo: por cada unidad y año con >= 9 meses, cada mes contra el promedio de su año; el índice del
   * mes es la mediana entre unidades (con >= 6 unidades aportando), normalizado a promedio 1.
   * series: arreglo de series (una por unidad) del MISMO biológico. Devuelve { factores:{1..12}, soporte } o null.
   */
  function indiceEstacionalGrupo(series, eventos) {
    const ev = new Set(eventos || []);
    const porMes = {}, aniosMes = {};
    let unidades = 0;
    (series || []).forEach((serie) => {
      // Los meses de evento (campaña/brote) no son estacionalidad: se dejan fuera
      const pts = puntos(serie).filter((p) => !ev.has(claveMes(p.anio, p.mes)));
      const porAnio = {};
      pts.forEach((p) => { (porAnio[p.anio] = porAnio[p.anio] || []).push(p); });
      let aporto = 0;
      Object.values(porAnio).forEach((lista) => {
        if (lista.length < 9) return;
        const m = media(lista.map((p) => p.y));
        if (m < 10) return;
        lista.forEach((p) => { (porMes[p.mes] = porMes[p.mes] || []).push(p.y / m); (aniosMes[p.mes] = aniosMes[p.mes] || []).push(1); });
        aporto++;
      });
      if (aporto) unidades++;
    });
    const factores = {}, aniosPorMes = {};
    const valores = [];
    for (let m = 1; m <= 12; m++) {
      const l = porMes[m] || [];
      if (l.length >= 6) {
        factores[m] = mediana(l); valores.push(factores[m]);
        // años distintos con dato de ese mes: aportes por unidad / unidades con dato (aprox. por mediana del número de aportes por unidad)
        aniosPorMes[m] = Math.max(1, Math.round(l.length / Math.max(1, (aniosMes[m] || []).length ? unidades : 1)));
      }
    }
    if (valores.length < 6) return null;
    const prom = media(valores);
    Object.keys(factores).forEach((m) => { factores[m] = factores[m] / prom; });
    return { factores, soporte: unidades, aniosPorMes };
  }

  /**
   * Meses de evento: aquellos en que una fracción grande de las unidades se disparó a la vez (brote, campaña, cambio de
   * esquema): no son errores de captura. series: una serie por unidad del mismo biológico. Devuelve un arreglo de «AAAA-MM».
   */
  function detectarEventos(series, opciones) {
    const umbral = (opciones && opciones.umbral) || 1.8;
    const fraccion = (opciones && opciones.fraccion) || 0.35;
    const porMes = {};
    (series || []).forEach((serie) => {
      const pts = puntos(serie);
      if (pts.length < 5) return;
      const med = mediana(pts.map((p) => p.y));
      if (med < 3) return;
      pts.forEach((p) => {
        const k = claveMes(p.anio, p.mes);
        porMes[k] = porMes[k] || { n: 0, alto: 0 };
        porMes[k].n++;
        if (p.y > Math.max(umbral * med, med + 6)) porMes[k].alto++;
      });
    });
    return Object.keys(porMes).filter((k) => porMes[k].n >= 6 && porMes[k].alto / porMes[k].n >= fraccion).sort();
  }

  /**
   * ¿El último mes cargado está incompleto? (el SIS del mes en curso suele subirse a medias). Compara el total de todas las
   * unidades contra el promedio de los 3 meses anteriores: por debajo del 40 % se considera parcial. Devuelve
   * { anio, mes, proporcion } o null. series: una serie por unidad (varios biológicos juntos está bien).
   */
  function detectarMesParcial(series) {
    const total = {};
    (series || []).forEach((serie) => puntos(serie).forEach((p) => { total[p.i] = (total[p.i] || 0) + p.y; }));
    const idxs = Object.keys(total).map(Number).sort((a, b) => a - b);
    if (idxs.length < 4) return null;
    const ult = idxs[idxs.length - 1];
    const previos = idxs.slice(-4, -1).map((i) => total[i]);
    const ref = media(previos);
    if (ref <= 0) return null;
    const proporcion = total[ult] / ref;
    return proporcion < 0.4 ? { anio: Math.floor(ult / 12), mes: (ult % 12) + 1, proporcion } : null;
  }

  /** Núcleo: nivel, tendencia y proyección del mes objetivo (sin banda ni señales). Devuelve null si no hay datos. */
  function nucleo(serie, objetivo, indiceGrupo, eventos) {
    let pts = puntos(serie);
    if (!pts.length) return null;
    const ev = new Set(eventos || []);
    const notas = { atipicos: [], eventos: [], cambioNivel: null };

    // 1. Quitar estacionalidad del grupo
    let d = pts.map((p) => ({ ...p, d: p.y / factorGrupo(indiceGrupo, p.mes), peso: 1 }));

    // 2. Cambio de nivel (antes que los atípicos: los meses del nivel nuevo no son atípicos): los últimos 3 meses ya son
    //    otro nivel y no se explican por una tendencia sostenida de los meses anteriores
    if (d.length >= 8) {
      const ult = d.slice(-3).map((p) => p.d), antP = d.slice(-9, -3), ant = antP.map((p) => p.d);
      const mAnt = media(ant), dif = media(ult) - mAnt;
      const se = Math.max(desv(ant), 0.1 * mAnt + 1) / Math.sqrt(3);
      const mismoLado = ult.every((v) => (dif > 0 ? v > mAnt : v < mAnt));
      const mi = media(antP.map((p) => p.i));
      const sxxA = antP.reduce((s, p) => s + (p.i - mi) * (p.i - mi), 0);
      const pendAnt = sxxA > 0 ? antP.reduce((s, p) => s + (p.i - mi) * (p.d - mAnt), 0) / sxxA : 0;
      const explicadoPorTendencia = Math.sign(pendAnt) === Math.sign(dif) && Math.abs(pendAnt * 4.5) >= 0.6 * Math.abs(dif);
      if (mismoLado && !explicadoPorTendencia && Math.abs(dif) > 2.5 * se && Math.abs(dif) > 0.25 * Math.max(mAnt, 1)) {
        notas.cambioNivel = { desde: d[d.length - 3], sube: dif > 0, pct: mAnt > 0 ? dif / mAnt : null };
        d = d.slice(-3);
      }
    }

    // 3. Atípicos (solo con >= 5 meses): se acotan; los meses de evento se conservan con la mitad del peso
    if (d.length >= 5) {
      const med = mediana(d.map((p) => p.d));
      let sigma = Math.max(1.4826 * mediana(d.map((p) => Math.abs(p.d - med))), 0.15 * med, 1);
      // Consumo intermitente (la mediana es ~0): la escala es la de los meses CON consumo, no 1 dosis
      const conConsumo = d.map((p) => p.d).filter((v) => v > 0);
      if (med < 3 && conConsumo.length >= 3) sigma = Math.max(sigma, 0.8 * mediana(conConsumo));
      d.forEach((p) => {
        const fuera = Math.abs(p.d - med) > CFG.umbralAtipico * sigma;
        if (!fuera) return;
        // Mes de evento (campaña/brote que afectó a muchas unidades): no es un error de captura, pero tampoco consumo
        // de rutina; pesa la mitad y se acota para que no infle el consumo de todos los meses normales
        if (ev.has(claveMes(p.anio, p.mes))) { p.peso = 0.5; notas.eventos.push(p); p.d = clamp(p.d, med - CFG.umbralAtipico * sigma, med + CFG.umbralAtipico * sigma); return; }
        notas.atipicos.push({ anio: p.anio, mes: p.mes, y: p.y, hacia: p.d > med ? "arriba" : "abajo" });
        p.d = clamp(p.d, med - CFG.umbralAtipico * sigma, med + CFG.umbralAtipico * sigma);
      });
    }

    // 4. Nivel con peso exponencial
    const ultimo = d[d.length - 1].i;
    d.forEach((p) => { p.w = p.peso * Math.pow(0.5, (ultimo - p.i) / CFG.vidaMedia); });
    const sw = d.reduce((s, p) => s + p.w, 0);
    const nivel = sw > 0 ? d.reduce((s, p) => s + p.w * p.d, 0) / sw : media(d.map((p) => p.d));

    // 5. Tendencia (últimos 6 puntos, mínimo 4), solo en la medida en que es significativa
    let pendiente = 0, signif = 0;
    const t = d.slice(-6);
    if (t.length >= 4 && nivel > 0) {
      const sx = t.reduce((s, p) => s + p.w, 0);
      const mx = t.reduce((s, p) => s + p.w * p.i, 0) / sx, my = t.reduce((s, p) => s + p.w * p.d, 0) / sx;
      const sxx = t.reduce((s, p) => s + p.w * (p.i - mx) * (p.i - mx), 0);
      if (sxx > 0) {
        pendiente = t.reduce((s, p) => s + p.w * (p.i - mx) * (p.d - my), 0) / sxx;
        const res = Math.sqrt(t.reduce((s, p) => { const e = p.d - (my + pendiente * (p.i - mx)); return s + e * e; }, 0) / Math.max(1, t.length - 2));
        const tstat = res > 0 ? Math.abs(pendiente) / (res / Math.sqrt(sxx)) : (pendiente !== 0 ? 99 : 0);
        signif = clamp(tstat / 2, 0, 1);
        const tope = 0.12 * nivel;
        pendiente = clamp(pendiente, -tope, tope);
      }
    }

    // 6. Proyección al mes objetivo (la tendencia se amortigua con los meses)
    const h = clamp(idx(objetivo.anio, objetivo.mes) - ultimo, 1, 3);
    let sumPhi = 0;
    for (let k = 1; k <= h; k++) sumPhi += Math.pow(CFG.amortigua, k);
    // El promedio ponderado «se queda atrás» cuando hay tendencia: se lleva al último mes antes de proyectar
    const centro = sw > 0 ? d.reduce((s, p) => s + p.w * p.i, 0) / sw : ultimo;
    const nivelFin = nivel + pendiente * signif * (ultimo - centro);
    const baseDes = Math.max(0, nivelFin + CFG.tendencia * pendiente * signif * sumPhi);

    // 7. Estacionalidad del mes objetivo: grupo + lo que hizo la propia unidad ese mes el año pasado
    const g = factorGrupo(indiceGrupo, objetivo.mes);
    let propio = null;
    const mismoMes = pts.filter((p) => p.mes === objetivo.mes && p.anio < objetivo.anio).pop();
    if (mismoMes) {
      const delAnio = pts.filter((p) => p.anio === mismoMes.anio);
      if (delAnio.length >= 6) {
        // Contra la mediana del año (no el promedio) y sin tomar como «estacional» un pico/valle de ese mes del año pasado
        const m = mediana(delAnio.map((p) => p.y));
        const razon = m >= 10 ? mismoMes.y / m : null;
        if (razon !== null && razon <= 2.2 && razon >= 0.3) propio = clamp(razon, 0.5, 1.6);
      }
    }
    let estac = 1, tipoEstac = "ninguna";
    if (indiceGrupo && propio !== null) { estac = 0.65 * g + 0.35 * (1 + dampEstac(indiceGrupo, objetivo.mes) * (propio - 1)); tipoEstac = "grupo+propia"; }
    else if (indiceGrupo) { estac = g; tipoEstac = "grupo"; }
    else if (propio !== null) { estac = 1 + 0.5 * (propio - 1); tipoEstac = "propia"; }
    estac = clamp(estac, 0.5, 2);

    return { pronostico: baseDes * estac, nivel, pendiente: pendiente * signif, estac, tipoEstac, h, notas, n: pts.length, des: d.map((p) => p.d), ultimo };
  }

  /** Error cuadrático medio del propio método, mes a mes, sobre los meses anteriores (backtest de un paso). */
  function errorBacktest(serie, indiceGrupo, eventos) {
    const pts = puntos(serie);
    const errores = [];
    const ev = new Set(eventos || []);
    for (let k = Math.max(4, pts.length - 8); k < pts.length; k++) {
      if (ev.has(claveMes(pts[k].anio, pts[k].mes))) continue;   // un mes de evento (campaña/brote) no mide la calidad del método
      const previo = pts.slice(0, k).map((p) => ({ anio: p.anio, mes: p.mes, dosis: p.y }));
      const r = nucleo(previo, { anio: pts[k].anio, mes: pts[k].mes }, indiceGrupo, eventos);
      if (r) errores.push(pts[k].y - r.pronostico);
    }
    return errores;
  }

  /**
   * Proyecta el consumo del mes objetivo y propone Promedio (frascos), Mínimo y Máximo (dosis).
   * entrada: { serie, objetivo:{anio,mes}, dosisPorFrasco, nivelZ, leadSem, leadStdSem, indiceGrupo, eventos,
   *            senales:{ mesesSinExistencia, sobreexistencia }, pisoMin }
   * Devuelve null si la unidad no tiene ni un mes cargado.
   */
  function proyectar(entrada) {
    const e = entrada || {};
    const objetivo = e.objetivo;
    const dpf = Math.max(1, num(e.dosisPorFrasco) || 1);
    const z = num(e.nivelZ) || 1.65;
    const leadSem = Math.max(0, e.leadSem == null ? 2 : num(e.leadSem));
    const leadStd = Math.max(0, e.leadStdSem == null ? 1 : num(e.leadStdSem));
    const piso = e.pisoMin == null ? 5 : num(e.pisoMin);
    const senales = e.senales || {};

    const r = nucleo(e.serie, objetivo, e.indiceGrupo || null, e.eventos);
    if (!r) return null;
    const total = (e.serie || []).length;
    const huecos = Math.max(0, total - r.n);

    // Variabilidad: error real del método; con pocos meses, la dispersión de lo observado
    const errores = errorBacktest(e.serie, e.indiceGrupo || null, e.eventos);
    let sigma;
    if (errores.length >= 3) {
      // Robusto: un mes atípico no debe inflar la banda de todos los demás (los errores extremos se acotan)
      const medE = mediana(errores);
      const escala = Math.max(1.4826 * mediana(errores.map((v) => Math.abs(v - medE))), 0.05 * Math.max(r.nivel, 1));
      const acotados = errores.map((v) => clamp(v, medE - 3.5 * escala, medE + 3.5 * escala));
      sigma = Math.sqrt(acotados.reduce((s, v) => s + v * v, 0) / acotados.length);
    }
    else { const m = media(r.des); sigma = m > 0 ? Math.max(0.15, desv(r.des) / m) * r.pronostico : 0.15 * r.pronostico; }

    // Existencia y pedidos previos
    let pronostico = r.pronostico;
    const desabasto = clamp(Math.round(num(senales.mesesSinExistencia)), 0, 4);
    if (desabasto > 0) pronostico *= 1 + Math.min(0.25, 0.08 * desabasto);
    sigma = Math.max(sigma * CFG.sigmaMult, 0.08 * pronostico, pronostico > 0 ? 1 : 0);
    // Tope: una unidad con consumo bajo no puede tener una banda de cientos de dosis por un solo mes raro de su historia
    sigma = Math.min(sigma, Math.max(2 * pronostico, 3 + 2 * Math.sqrt(pronostico)));

    // Punto de reorden: lo que se consume durante todo el periodo que cubre un pedido (revisión + entrega)
    const semanas = semanasDelMes(objetivo.anio, objetivo.mes) || SEMANAS_MES;
    const tasaSem = pronostico / semanas, sigmaSem = sigma / Math.sqrt(semanas);
    const cobertura = semanas + leadSem;
    let objetivoDosis = tasaSem * cobertura + z * Math.sqrt(cobertura * sigmaSem * sigmaSem + tasaSem * tasaSem * leadStd * leadStd);
    if (senales.sobreexistencia) objetivoDosis *= 0.9;
    // Un punto de reorden de más de 2.5 meses de consumo solo acumula (caducidad): se limita
    let limitado = false;
    if (pronostico > 0 && objetivoDosis > 2.5 * pronostico) { objetivoDosis = Math.max(2.5 * pronostico, piso); limitado = true; }

    const promedioFrascos = pronostico > 0 ? Math.ceil(objetivoDosis / dpf) : 0;
    const minDosis = Math.max(piso, Math.round(Math.max(0, pronostico - Z_P10 * sigma)));
    const maxDosis = Math.max(minDosis, Math.round(pronostico + Z_P95 * sigma), Math.round(objetivoDosis));

    // Confianza
    const motivosConf = [];
    let puntaje = 100;
    if (r.n < 12) { puntaje -= (12 - r.n) * 4; motivosConf.push(`solo ${r.n} ${r.n === 1 ? "mes" : "meses"} de historia`); }
    const cvRes = pronostico > 0 ? sigma / pronostico : 0;
    if (cvRes > 0.15) { puntaje -= Math.min(45, (cvRes - 0.15) * 50); motivosConf.push(`el consumo varía mucho (±${Math.round(cvRes * 100)} %)`); }
    if (pronostico > 0 && pronostico < 10) { puntaje -= 10; motivosConf.push("consumo muy bajo (pocas dosis al mes): una dosis más o menos cambia mucho la proyección"); }
    if (r.notas.atipicos.length) { puntaje -= 5 * r.notas.atipicos.length; motivosConf.push(`${r.notas.atipicos.length} mes(es) atípico(s) acotado(s)`); }
    if (huecos) { puntaje -= 4 * huecos; motivosConf.push(`${huecos} mes(es) sin datos cargados`); }
    if (r.notas.cambioNivel) { puntaje -= 10; motivosConf.push("la unidad cambió de nivel hace poco"); }
    if (r.tipoEstac !== "ninguna") puntaje += 5;
    puntaje = clamp(Math.round(puntaje), 0, 100);
    let nivelConf = puntaje >= 70 ? "alta" : puntaje >= 45 ? "media" : "baja";
    if (r.n < 4) nivelConf = "baja";

    // Explicación
    const razones = [];
    const mesTxt = `${MESES[objetivo.mes - 1]} ${objetivo.anio}`;
    if (pronostico <= 0) razones.push("Sin consumo registrado en el periodo: no se propone Promedio.");
    else {
      razones.push(`Consumo reciente ponderado: ${fmt(r.nivel)} dosis/mes (pesan más los últimos meses).`);
      if (Math.abs(r.pendiente) >= 0.03 * Math.max(r.nivel, 1)) {
        const pct = Math.round((r.pendiente / Math.max(r.nivel, 1)) * 100);
        razones.push(`Tendencia ${pct > 0 ? "al alza" : "a la baja"}: ${pct > 0 ? "+" : ""}${pct} % por mes (amortiguada).`);
      }
      if (r.tipoEstac !== "ninguna" && Math.abs(r.estac - 1) >= 0.04) {
        const pct = Math.round((r.estac - 1) * 100);
        razones.push(`${mesTxt[0].toUpperCase() + mesTxt.slice(1)} suele ser ${pct > 0 ? "+" : ""}${pct} % frente al promedio del año (estacionalidad ${r.tipoEstac === "propia" ? "de la unidad" : r.tipoEstac === "grupo" ? "del grupo de unidades" : "del grupo y de la unidad"}).`);
      }
      razones.push(`Proyección de ${mesTxt}: ${fmt(pronostico)} dosis (rango ${fmt(Math.max(0, pronostico - Z_P10 * sigma))} a ${fmt(pronostico + Z_P95 * sigma)}).`);
    }
    r.notas.atipicos.forEach((a) => razones.push(`Se acotó ${MESES[a.mes - 1]} ${a.anio} (${fmt(a.y)} dosis, ${a.hacia === "arriba" ? "pico" : "valle"} atípico).`));
    r.notas.eventos.forEach((a) => razones.push(`${MESES[a.mes - 1][0].toUpperCase() + MESES[a.mes - 1].slice(1)} ${a.anio} fue un evento que afectó a muchas unidades (brote/campaña): se acotó y pesa la mitad (no es consumo de rutina).`));
    if (r.notas.cambioNivel) razones.push(`Cambio de nivel detectado (${r.notas.cambioNivel.sube ? "sube" : "baja"}${r.notas.cambioNivel.pct != null ? " " + Math.abs(Math.round(r.notas.cambioNivel.pct * 100)) + " %" : ""} desde ${MESES[r.notas.cambioNivel.desde.mes - 1]}): solo se usan los meses recientes.`);
    if (desabasto > 0) razones.push(`Se quedó sin existencia ${desabasto} de los últimos 4 meses: se sumó ${Math.round(Math.min(25, 8 * desabasto))} % por demanda no atendida.`);
    if (senales.sobreexistencia) razones.push("Tiene sobreexistencia sostenida: el Promedio sugerido baja 10 % para no acumular más.");
    if (limitado) razones.push("El colchón por variabilidad era mayor a 2.5 meses de consumo: se limitó a 2.5 meses para no acumular existencia.");
    razones.push(`Promedio sugerido: cubre ${cobertura.toFixed(1)} semanas (mes + ${leadSem} de entrega) con nivel de servicio z=${z}.`);

    const banderas = [];
    if (r.notas.atipicos.length) banderas.push("atipicos");
    if (r.notas.eventos.length) banderas.push("evento");
    if (r.notas.cambioNivel) banderas.push("cambio_nivel");
    if (desabasto > 0) banderas.push("desabasto");
    if (senales.sobreexistencia) banderas.push("sobreexistencia");
    if (r.n < 6) banderas.push("pocos_datos");
    if (pronostico <= 0) banderas.push("sin_consumo");

    return {
      promedioFrascos, minDosis, maxDosis,
      proyeccionDosis: Math.round(pronostico * 10) / 10,
      banda: { p10: Math.round(Math.max(0, pronostico - Z_P10 * sigma)), p95: Math.round(pronostico + Z_P95 * sigma) },
      sigma: Math.round(sigma * 10) / 10,
      confianza: { nivel: nivelConf, puntaje, motivos: motivosConf },
      razones, banderas,
      componentes: { nivel: Math.round(r.nivel * 10) / 10, pendiente: Math.round(r.pendiente * 10) / 10, estacionalidad: Math.round(r.estac * 1000) / 1000,
        tipoEstacionalidad: r.tipoEstac, mesesUsados: r.n, huecos, horizonte: r.h, objetivoDosis: Math.round(objetivoDosis) }
    };
  }

  /** Mes objetivo por omisión: el siguiente pedido (a partir del día 15 se piensa en el mes que sigue). */
  function mesObjetivo(hoy) {
    const f = hoy || new Date();
    const m = f.getDate() >= 15 ? f.getMonth() + 2 : f.getMonth() + 1;
    return { anio: f.getFullYear() + (m > 12 ? 1 : 0), mes: ((m - 1) % 12) + 1 };
  }

  const API = { CFG, proyectar, indiceEstacionalGrupo, detectarEventos, detectarMesParcial, mesObjetivo, puntos, MESES };
  root.ProyeccionConsumo = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
