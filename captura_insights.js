/**
 * captura_insights.js — Indicadores del Resumen de captura y de la Vista en vivo (SIREVAQ).
 *
 * Qué hace:
 *  - Resumen de captura (panel de Jurisdicción/Municipal): además de «quién capturó y quién falta», calcula
 *    para el tipo elegido (Existencia, Consumibles, Pedido, Influenza) lo que se ENCONTRÓ en esas capturas:
 *    biológicos en cero, caducidades, frascos abiertos, insumos insuficientes, pedidos fuera de lo normal,
 *    avance de la campaña contra su meta, reincidentes (semanas seguidas sin capturar) y hora de captura.
 *  - Vista en vivo de una unidad: tira de indicadores arriba de la tabla (KPIs) con la variación contra la
 *    captura anterior.
 *
 * Diseño: TODO el cálculo vive en funciones puras (sin DOM ni red) para poder probarlas en Node. La red
 * (consultas a Supabase) y el pintado están al final y solo se usan en el navegador. Se apoya en lo que ya
 * existe: window.supabase, fetchAllRows, getDosesPerVial, getActiveCampaign.
 * Estilos: todo cuelga de .ci-* / #captureInsights / #liveViewKpis (la hoja global style.css tiene resets con
 * !important sobre input/select/button, por eso aquí cada propiedad en conflicto lleva !important).
 */
(function (root) {
  "use strict";

  /* ───────────────────────────── utilidades puras ───────────────────────────── */
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const LIMITE_APERTURA_DIAS = 28; // vigencia del frasco multidosis abierto (igual que getAperturaStatusHelper)

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const fmt = (n, dec) => num(n).toLocaleString("es-MX", { maximumFractionDigits: dec == null ? 0 : dec });
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function ymdAdd(f, n) { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); }
  function lunesDe(f) {
    const d = new Date(f + "T12:00:00");
    d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
    return ymd(d);
  }
  function diasEntre(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
  function diaCorto(f) { return DIAS[new Date(f + "T12:00:00").getDay()] + " " + Number(f.slice(8, 10)); }
  function fechaCorta(f) { return f ? String(Number(f.slice(8, 10))) + "-" + MESES[Number(f.slice(5, 7)) - 1] : "—"; }
  function hora(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function ymdLocalDeTs(ts) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "" : ymd(d);
  }

  /** Meses de diferencia entre el mes de la caducidad y el mes de hoy (misma regla que getMonthsTo de main.js). */
  function mesesA(cad, hoy) {
    if (!cad) return 99;
    const s = String(cad).trim();
    let y, m;
    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) { y = Number(iso[1]); m = Number(iso[2]) - 1; }
    else {
      const p = s.toUpperCase().split("-");
      const i = MESES.indexOf(p[0]);
      if (i < 0 || !p[1]) return 99;
      y = 2000 + Number(p[1]); m = i;
    }
    const t = String(hoy).split("-");
    return (y - Number(t[0])) * 12 + (m - (Number(t[1]) - 1));
  }
  function mmmaa(cad) {
    const s = String(cad || "");
    const iso = s.match(/^(\d{4})-(\d{2})/);
    return iso ? MESES[Number(iso[2]) - 1] + "-" + iso[1].slice(2) : (s || "—");
  }

  /** Dosis por frasco. Usa la de main.js cuando existe; la copia es para poder probar en Node. */
  function dosisFrasco(bio) {
    if (typeof root.getDosesPerVial === "function") return root.getDosesPerVial(bio);
    const n = String(bio || "").toUpperCase().trim();
    if (n.includes("COVID")) return 6;
    if (["HEXAVALENTE", "ROTAVIRUS", "NEUMO", "VPH", "TDPA", "HEPATITIS A", "VARICELA", "DENGUE", "SRP", "VSR"].some((k) => n.includes(k))) return 1;
    return 10;
  }

  const ORDEN_MUNI = ["CORREGIDORA", "HUIMILPAN", "MARQUES", "QUERETARO"];
  const ETIQ_MUNI = { CORREGIDORA: "Corregidora", HUIMILPAN: "Huimilpan", MARQUES: "El Marqués", QUERETARO: "Querétaro" };
  function muniKey(m) {
    const n = norm(m);
    return ORDEN_MUNI.find((k) => n.includes(k)) || n || "OTRO";
  }
  function muniEtiqueta(m) { const k = muniKey(m); return ETIQ_MUNI[k] || String(m || "Otro"); }
  function muniOrden(k) { const i = ORDEN_MUNI.indexOf(k); return i < 0 ? 99 : i; }

  /** Último registro por CLUES (por fecha y, a igualdad, por marca de tiempo). */
  function ultimoPorClues(rows, campoFecha) {
    const f = campoFecha || "fecha";
    const out = new Map();
    (rows || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      if (!k) return;
      const p = out.get(k);
      const rf = String(r[f] || ""), pf = p ? String(p[f] || "") : "";
      const rt = String(r.timestamp || r.updated_at || ""), pt = p ? String(p.timestamp || p.updated_at || "") : "";
      if (!p || rf > pf || (rf === pf && rt > pt)) out.set(k, r);
    });
    return out;
  }

  /* ───────────────────────────── Existencia (SR) ───────────────────────────── */
  // existencia_detalle NUNCA guarda renglones en 0: un biológico que se quedó en cero simplemente ya no aparece.
  // Lo que sí lo registra es biologicos_existencia (una columna por biológico + tiene_ceros). Un biológico está en
  // cero cuando su columna es 0 ahora y era mayor a 0 en la captura anterior de esa unidad.
  const COLUMNAS_BIO = {
    bcg: "BCG", hepatitis_b: "HEPATITIS B", hexavalente: "HEXAVALENTE", dpt: "DPT", rotavirus: "ROTAVIRUS",
    neumococica_13: "NEUMOCÓCICA 13", neumococica_20: "NEUMOCÓCICA 20", srp: "SRP", sr: "SR", vph: "VPH",
    varicela: "VARICELA", hepatitis_a: "HEPATITIS A", td: "TD", tdpa: "TDPA", covid_19: "COVID-19", influenza: "INFLUENZA", vsr: "VSR"
  };
  function cerosDeCaptura(actual, previa) {
    const out = [];
    if (!actual || !previa) return out;
    Object.keys(COLUMNAS_BIO).forEach((c) => { if (num(actual[c]) === 0 && num(previa[c]) > 0) out.push(COLUMNAS_BIO[c]); });
    return out;
  }

  /**
   * det: renglones de existencia_detalle de la semana. ex: biologicos_existencia de la semana. exPrev: biologicos_existencia
   * de las semanas previas (para saber qué biológicos se quedaron en cero). Un registro por unidad + agregados.
   */
  function analizarSR(det, ex, hoy, exPrev) {
    const porClues = new Map();
    (det || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      if (!k) return;
      if (!porClues.has(k)) porClues.set(k, []);
      porClues.get(k).push(r);
    });
    const exUlt = ultimoPorClues(ex);
    const prevPorClues = new Map();
    (exPrev || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      if (!prevPorClues.has(k)) prevPorClues.set(k, []);
      prevPorClues.get(k).push(r);
    });
    const unidades = new Map();
    const porBio = new Map();
    const enCeroPorBio = new Map();
    new Set([...porClues.keys(), ...exUlt.keys()]).forEach((clues) => {
      const rowsU = porClues.get(clues) || [];
      const ult = rowsU.reduce((m, r) => (String(r.fecha) > m ? String(r.fecha) : m), "");
      let rs = rowsU.filter((r) => String(r.fecha) === ult);
      const conStock = new Set();
      rs.forEach((r) => { if (num(r.cantidad) > 0) conStock.add(norm(r.biologico) + ":" + norm(r.lote)); });
      rs = rs.filter((r) => !(num(r.cantidad) === 0 && conStock.has(norm(r.biologico) + ":" + norm(r.lote))));

      const u = {
        clues, fecha: ult, frascos: 0, dosis: 0, biologicos: 0, ceros: [], cerosDet: [], enCero: false,
        cad: { lotes: 0, frascos: 0, primera: null }, caducados: { lotes: 0, frascos: 0 },
        abiertos: { vencidos: 0, porVencer: 0 }, permanencia: { excedida: 0, alerta: 0 }, prestamos: 0
      };
      const tot = new Map();
      rs.forEach((r) => {
        const q = num(r.cantidad);
        const bio = String(r.biologico || "").trim();
        const kb = norm(bio);
        if (!tot.has(kb)) tot.set(kb, { name: bio, total: 0 });
        tot.get(kb).total += q;
        if (q <= 0) return;
        u.frascos += q;
        u.dosis += q * dosisFrasco(bio);
        const m = mesesA(r.caducidad, hoy);
        if (m < 0) { u.caducados.lotes++; u.caducados.frascos += q; }
        else if (m <= 3) { u.cad.lotes++; u.cad.frascos += q; }
        if (m <= 3 && (!u.cad.primera || String(r.caducidad) < String(u.cad.primera))) u.cad.primera = r.caducidad;
        if (r.fecha_apertura) {
          const left = LIMITE_APERTURA_DIAS - diasEntre(r.fecha_apertura, hoy);
          if (left <= 0) u.abiertos.vencidos++; else if (left <= 5) u.abiertos.porVencer++;
        }
        if (r.fecha_recepcion) {
          const d = diasEntre(String(r.fecha_recepcion).slice(0, 10), hoy);
          if (d > 90) u.permanencia.excedida++; else if (d >= 60) u.permanencia.alerta++;
        }
        if (/PRESTAMO|PRÉSTAMO/i.test(String(r.tipo || ""))) u.prestamos++;
      });
      u.cerosDet = [...tot.values()].filter((v) => v.total === 0).map((v) => v.name); // renglones en 0 que arma la Vista en vivo
      tot.forEach((v, kb) => {
        u.biologicos++;
        if (!porBio.has(kb)) porBio.set(kb, { name: v.name, frascos: 0, conExistencia: new Set(), enCero: new Set() });
        const pb = porBio.get(kb);
        pb.frascos += v.total;
        if (v.total > 0) pb.conExistencia.add(clues);
      });

      const e = exUlt.get(clues);
      if (e) {
        const previas = (prevPorClues.get(clues) || []).filter((r) => String(r.fecha) < String(e.fecha));
        const previa = previas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.timestamp || "").localeCompare(String(a.timestamp || "")))[0];
        u.ceros = cerosDeCaptura(e, previa);
        u.enCero = u.ceros.length > 0 || e.tiene_ceros === true; // la bandera cubre la captura sin semana previa
        u.ceros.forEach((name) => {
          const kb = norm(name);
          if (!enCeroPorBio.has(kb)) enCeroPorBio.set(kb, { name, clues: new Set() });
          enCeroPorBio.get(kb).clues.add(clues);
          if (porBio.has(kb)) porBio.get(kb).enCero.add(clues);
        });
      }
      u.timestamp = e ? e.timestamp : null;
      u.fechaCaptura = e ? e.fecha : ult;
      u.editado = !!(e && (e.editado === "SI" || e.editado_por));
      u.sinMovimiento = !!(e && (e.sin_movimiento === true || e.sin_movimiento === "SI"));
      unidades.set(clues, u);
    });
    return { unidades, porBio, enCeroPorBio };
  }

  /* ───────────────────────────── Consumibles ───────────────────────────── */
  function analizarCons(rows) {
    const unidades = new Map();
    ultimoPorClues(rows).forEach((r, clues) => {
      const srp = num(r.srp_dosis), sr = num(r.sr_dosis);
      const j5 = num(r.jeringa_reconst_5ml_0605500438), j05 = num(r.jeringa_aplic_05ml_0605502657), ag = num(r.aguja_0600403711);
      const dosis = srp + sr;
      const ceros = [];
      if (j5 === 0) ceros.push("Jeringa 5 ml");
      if (j05 === 0) ceros.push("Jeringa 0.5 ml");
      if (ag === 0) ceros.push("Aguja");
      const minimo = Math.min(j05, ag);
      unidades.set(clues, {
        clues, srp, sr, j5, j05, ag, dosis, ceros,
        // Mínimo indispensable: cada dosis necesita su jeringa de aplicación y su aguja
        cobertura: dosis > 0 ? minimo / dosis : null,
        insuficiente: dosis > 0 && minimo < dosis,
        timestamp: r.timestamp, fechaCaptura: r.fecha,
        editado: r.editado === "SI" || !!r.editado_por,
        sinMovimiento: r.sin_movimiento === true || r.sin_movimiento === "SI"
      });
    });
    return { unidades };
  }

  /* ───────────────────────────── Pedido (BIO) ───────────────────────────── */
  function analizarBio(rows, ventana) {
    const unidades = new Map();
    const porBio = new Map();
    const porClues = new Map();
    (rows || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      if (!k) return;
      if (!porClues.has(k)) porClues.set(k, []);
      porClues.get(k).push(r);
    });
    porClues.forEach((rs, clues) => {
      const u = {
        clues, pedido: 0, existencia: 0, dosisPedido: 0, pedidos: 0, alertas: [], sinPedido: false,
        editado: false, timestamp: null, fueraVentana: false, fechaCaptura: null
      };
      rs.forEach((r) => {
        const bio = String(r.biologico || "").trim();
        const ped = num(r.pedido_frascos), exi = num(r.existencia_actual_frascos), prom = num(r.promedio_frascos);
        u.pedido += ped; u.existencia += exi; u.dosisPedido += ped * dosisFrasco(bio);
        if (ped > 0) u.pedidos++;
        if (r.editado === "SI" || r.editado_por) u.editado = true;
        if (r.timestamp && (!u.timestamp || String(r.timestamp) > String(u.timestamp))) u.timestamp = r.timestamp;
        u.fechaCaptura = r.fecha_captura || r.fecha_pedido_programada || u.fechaCaptura;
        if (r.sin_pedido === true) u.sinPedido = true;
        const kb = norm(bio);
        if (!porBio.has(kb)) porBio.set(kb, { name: bio, pedido: 0, existencia: 0, promedio: 0, unidadesPiden: new Set(), alertas: 0 });
        const pb = porBio.get(kb);
        pb.pedido += ped; pb.existencia += exi; pb.promedio += prom;
        if (ped > 0) pb.unidadesPiden.add(clues);
        // Revisión: contra el consumo mensual promedio que la propia unidad tiene configurado
        if (prom > 0) {
          const cob = (exi + ped) / prom;
          if (ped > 2 * prom) u.alertas.push({ bio, tipo: "sobrepedido", texto: `${bio}: pide ${fmt(ped)} frascos y su consumo mensual es ${fmt(prom, 1)}` });
          else if (cob < 1) u.alertas.push({ bio, tipo: "riesgo", texto: `${bio}: con existencia y pedido le alcanza para ${fmt(cob, 1)} meses` });
          else if (exi >= 2 * prom && ped > 0) u.alertas.push({ bio, tipo: "exceso", texto: `${bio}: ya tiene ${fmt(exi)} frascos (≥2 meses) y aun así pide ${fmt(ped)}` });
        }
      });
      if (u.pedido === 0) u.sinPedido = true;
      if (ventana && ventana.end && u.timestamp) {
        const dia = ymdLocalDeTs(u.timestamp);
        u.fueraVentana = !!dia && (dia > ventana.end || (ventana.start && dia < ventana.start));
      }
      u.alertas.forEach((a) => { porBio.get(norm(a.bio)).alertas++; });
      unidades.set(clues, u);
    });
    return { unidades, porBio };
  }

  /* ───────────────────────────── Influenza ───────────────────────────── */
  function totalValores(valores) { return Object.values(valores || {}).reduce((s, v) => s + num(v), 0); }

  /**
   * caps: capturas de toda la campaña; metas: filas de influenza_metas; camp: {fecha_inicio, fecha_fin};
   * semana: fecha (viernes) del reporte consultado; rubros: INFLUENZA_RUBROS (para dosis por población).
   */
  function analizarInf(caps, metas, camp, semana, hoy, rubros) {
    const unidades = new Map();
    const metaDe = new Map();
    (metas || []).forEach((m) => { metaDe.set(String(m.clues || "").trim().toUpperCase(), totalValores(m.metas)); });
    const acum = new Map();
    const serie = new Map(); // fecha → dosis jurisdiccionales
    const semanaRows = new Map();
    (caps || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      const t = totalValores(r.valores);
      if (String(r.fecha) <= semana) acum.set(k, (acum.get(k) || 0) + t);
      serie.set(r.fecha, (serie.get(r.fecha) || 0) + t);
      if (String(r.fecha) === semana) semanaRows.set(k, r);
    });
    const ref = hoy < semana ? hoy : semana;
    let esperado = null;
    if (camp && camp.fecha_inicio && camp.fecha_fin) {
      const total = diasEntre(camp.fecha_inicio, camp.fecha_fin);
      const trans = diasEntre(camp.fecha_inicio, ref);
      esperado = total > 0 ? Math.max(0, Math.min(100, Math.round((trans / total) * 100))) : null;
    }
    const rubroCat = new Map((rubros || []).map((r) => [r.id, r.categoria]));
    const porCat = {};
    let semanaTotal = 0, metaTotal = 0, acumTotal = 0, sinMeta = 0;
    const llaves = new Set([...semanaRows.keys(), ...metaDe.keys(), ...acum.keys()]);
    llaves.forEach((clues) => {
      const r = semanaRows.get(clues);
      const meta = metaDe.get(clues) || 0;
      const a = acum.get(clues) || 0;
      const sem = r ? totalValores(r.valores) : 0;
      if (r) Object.keys(r.valores || {}).forEach((id) => { const c = rubroCat.get(id) || "Otros"; porCat[c] = (porCat[c] || 0) + num(r.valores[id]); });
      const avance = meta > 0 ? Math.round((a / meta) * 100) : null;
      semanaTotal += sem; metaTotal += meta; acumTotal += a;
      if (!meta) sinMeta++;
      unidades.set(clues, {
        clues, semana: sem, acumulado: a, meta, avance,
        bajoRitmo: esperado != null && meta > 0 && avance < Math.round(esperado * 0.8),
        timestamp: r ? r.updated_at : null, fechaCaptura: r ? r.fecha : null,
        sinMovimiento: !!(r && (r.sin_movimiento === true || r.sin_movimiento === "SI")),
        editado: !!(r && r.editado_por && r.editado_por !== "UNIDAD")
      });
    });
    const fechas = [...serie.keys()].sort().slice(-8);
    return {
      unidades, esperado, semanaTotal, metaTotal, acumTotal, sinMeta, porCat,
      serie: fechas.map((f) => ({ fecha: f, dosis: serie.get(f) })),
      anterior: (() => { const p = [...serie.keys()].filter((f) => f < semana).sort().pop(); return p ? serie.get(p) : null; })()
    };
  }

  /* ───────────────────────────── reincidentes ───────────────────────────── */
  /** Semanas seguidas (antes de la actual) sin capturar, hasta 4. rows: {clues, fecha} de las 4 semanas previas. */
  function rachaSemanal(rows, lunesActual, maxSem) {
    const m = maxSem || 4;
    const porClues = new Map();
    (rows || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      const idx = Math.floor(diasEntre(lunesDe(String(r.fecha).slice(0, 10)), lunesActual) / 7); // 1 = semana anterior
      if (idx < 1 || idx > m) return;
      if (!porClues.has(k)) porClues.set(k, new Set());
      porClues.get(k).add(idx);
    });
    return (clues) => {
      const s = porClues.get(String(clues || "").trim().toUpperCase()) || new Set();
      let n = 0;
      while (n < m && !s.has(n + 1)) n++;
      return n;
    };
  }
  /** Meses seguidos (antes del actual) sin pedir, hasta 3. rows: {clues, fecha_pedido_programada}. */
  function rachaMensual(rows, ymActual, maxMes) {
    const m = maxMes || 3;
    const [ya, ma] = ymActual.split("-").map(Number);
    const porClues = new Map();
    (rows || []).forEach((r) => {
      const k = String(r.clues || "").trim().toUpperCase();
      const f = String(r.fecha_pedido_programada || r.fecha || "");
      const idx = (ya - Number(f.slice(0, 4))) * 12 + (ma - Number(f.slice(5, 7)));
      if (idx < 1 || idx > m) return;
      if (!porClues.has(k)) porClues.set(k, new Set());
      porClues.get(k).add(idx);
    });
    return (clues) => {
      const s = porClues.get(String(clues || "").trim().toUpperCase()) || new Set();
      let n = 0;
      while (n < m && !s.has(n + 1)) n++;
      return n;
    };
  }

  /* ───────────────────────────── indicadores del resumen ───────────────────────────── */
  function tile(id, icono, tono, etiqueta, valor, nota, set, etiquetaFiltro) {
    return { id, icono, tono, etiqueta, valor, nota, set: set && set.size ? set : null, etiquetaFiltro: etiquetaFiltro || etiqueta };
  }
  const setDe = (iter) => new Set([...iter]);

  /** Indicadores breves del resumen (una sola fila de tarjetas). El detalle por unidad está en la Vista en vivo. */
  function construirResumen(tipo, an, ctx) {
    const out = { tipo, tiles: [], texto: [] };
    const arr = [...an.unidades.values()];
    const sum = (f) => arr.reduce((s, u) => s + f(u), 0);
    const plural = (n, uno, varios) => (n === 1 ? uno : varios);

    if (tipo === "SR") {
      const enCero = arr.filter((u) => u.enCero);
      const caduca = arr.filter((u) => u.cad.lotes || u.caducados.lotes);
      const abiertos = arr.filter((u) => u.abiertos.vencidos || u.abiertos.porVencer);
      const sinMov = arr.filter((u) => u.sinMovimiento);
      const topCeros = [...an.enCeroPorBio.values()].sort((a, b) => b.clues.size - a.clues.size);
      const lotes = sum((u) => u.cad.lotes + u.caducados.lotes), vencidosLotes = sum((u) => u.caducados.lotes);
      const frascosCad = sum((u) => u.cad.frascos + u.caducados.frascos);
      const abiertosN = sum((u) => u.abiertos.vencidos + u.abiertos.porVencer), abiertosV = sum((u) => u.abiertos.vencidos);
      out.tiles.push(
        tile("ceros", "inventory_2", enCero.length ? "rojo" : "verde", "Capturaron en cero", String(enCero.length),
          topCeros.length ? topCeros.slice(0, 2).map((c) => `${c.name} (${c.clues.size})`).join(", ") + (topCeros.length > 2 ? ` +${topCeros.length - 2}` : "") : (enCero.length ? "Sin semana previa para comparar" : "Ninguna"),
          setDe(enCero.map((u) => u.clues)), "Capturaron en cero"),
        tile("caducan", "hourglass_bottom", vencidosLotes ? "rojo" : lotes ? "ambar" : "verde", "Caducan en ≤ 3 meses", String(lotes),
          lotes ? `${fmt(frascosCad)} frascos · ${caduca.length} ${plural(caduca.length, "unidad", "unidades")}${vencidosLotes ? ` · ${vencidosLotes} ya caducado${vencidosLotes === 1 ? "" : "s"}` : ""}` : "Nada por caducar", setDe(caduca.map((u) => u.clues)), "Caducidad próxima"),
        tile("abiertos", "vaccines", abiertosV ? "rojo" : abiertosN ? "ambar" : "verde", "Frascos abiertos", String(abiertosN),
          abiertosN ? `${abiertosV} vencido${abiertosV === 1 ? "" : "s"} (28 días)` : "Todos vigentes", setDe(abiertos.map((u) => u.clues)), "Frascos abiertos por vencer"),
        tile("sinmov", "pause_circle", "gris", "Sin movimiento", String(sinMov.length), "Igual que la semana previa", setDe(sinMov.map((u) => u.clues)), "Sin movimiento")
      );
      out.texto.push(
        enCero.length ? `• ${enCero.length} unidad${enCero.length === 1 ? " capturó" : "es capturaron"} biológicos en cero` + (topCeros.length ? " (" + topCeros.slice(0, 4).map((c) => `${c.name}: ${c.clues.size}`).join(", ") + ")" : "") : "• Ninguna unidad capturó biológicos en cero",
        lotes ? `• ${lotes} lote(s) caducan en ≤3 meses (${fmt(frascosCad)} frascos, ${caduca.length} unidades)${vencidosLotes ? `; ${vencidosLotes} ya caducado(s)` : ""}` : "",
        abiertosN ? `• ${abiertosN} frasco(s) abiertos por vencer o vencidos` : ""
      );
    }

    if (tipo === "CONS") {
      const insuf = arr.filter((u) => u.insuficiente);
      const conCeros = arr.filter((u) => u.ceros.length);
      const sinMov = arr.filter((u) => u.sinMovimiento);
      out.tiles.push(
        tile("insuf", "syringe", insuf.length ? "rojo" : "verde", "No alcanzan para sus dosis", String(insuf.length), insuf.length ? "Jeringa 0.5 ml o aguja < dosis SRP+SR" : "Todas cubren sus dosis", setDe(insuf.map((u) => u.clues)), "Insumos insuficientes"),
        tile("ceros", "inventory_2", conCeros.length ? "ambar" : "verde", "Con algún insumo en cero", String(conCeros.length), conCeros.length ? "Jeringa 5 ml, 0.5 ml o aguja" : "Ninguna", setDe(conCeros.map((u) => u.clues)), "Con insumo en cero"),
        tile("sinmov", "pause_circle", "gris", "Sin movimiento", String(sinMov.length), "Igual que la semana previa", setDe(sinMov.map((u) => u.clues)), "Sin movimiento")
      );
      out.texto.push(
        insuf.length ? `• ${insuf.length} unidad(es) con jeringas o agujas insuficientes para sus dosis` : "• Todas las unidades cubren sus dosis con jeringas y agujas",
        conCeros.length ? `• ${conCeros.length} unidad(es) con algún insumo en cero` : ""
      );
    }

    if (tipo === "BIO") {
      const sinPed = arr.filter((u) => u.sinPedido);
      const conAl = arr.filter((u) => u.alertas.length);
      const edit = arr.filter((u) => u.editado);
      const fuera = arr.filter((u) => u.fueraVentana);
      const nAl = sum((u) => u.alertas.length);
      out.tiles.push(
        tile("pedido", "local_shipping", "violeta", "Pedido total", fmt(sum((u) => u.pedido)), `frascos · ${fmt(sum((u) => u.dosisPedido))} dosis`, null),
        tile("alertas", "rule", conAl.length ? "ambar" : "verde", "Por revisar", String(conAl.length), conAl.length ? `${nAl} renglón${nAl === 1 ? "" : "es"} fuera de lo normal` : "Nada fuera de lo normal", setDe(conAl.map((u) => u.clues)), "Pedidos por revisar"),
        tile("sinped", "do_not_disturb_on", sinPed.length ? "ambar" : "verde", "Sin pedido", String(sinPed.length), "No pidieron ningún frasco", setDe(sinPed.map((u) => u.clues)), "Sin pedido")
      );
      if (fuera.length) out.tiles.push(tile("fuera", "event_busy", "ambar", "Fuera de ventana", String(fuera.length), ctx.ventana ? `Ventana ${fechaCorta(ctx.ventana.start)} al ${fechaCorta(ctx.ventana.end)}` : "", setDe(fuera.map((u) => u.clues)), "Fuera de ventana"));
      if (edit.length) out.tiles.push(tile("edit", "edit_note", "violeta", "Editados", String(edit.length), "Corregidos por Jurisdicción", setDe(edit.map((u) => u.clues)), "Pedidos editados"));
      out.texto.push(
        `• Pedido total: ${fmt(sum((u) => u.pedido))} frascos (${fmt(sum((u) => u.dosisPedido))} dosis)`,
        conAl.length ? `• ${conAl.length} unidad(es) con pedidos por revisar (${nAl} renglones)` : "• Ningún pedido fuera de lo normal",
        sinPed.length ? `• ${sinPed.length} unidad(es) sin pedido` : ""
      );
    }

    if (tipo === "INF") {
      const bajo = arr.filter((u) => u.bajoRitmo);
      const sinMov = arr.filter((u) => u.sinMovimiento);
      const avance = an.metaTotal > 0 ? Math.round((an.acumTotal / an.metaTotal) * 100) : null;
      const dif = avance != null && an.esperado != null ? avance - an.esperado : null;
      const varSem = an.anterior != null ? an.semanaTotal - an.anterior : null;
      out.tiles.push(
        tile("sem", "vaccines", "violeta", "Dosis de la semana", fmt(an.semanaTotal), varSem == null ? "Primera semana con reportes" : `${varSem >= 0 ? "+" : "−"}${fmt(Math.abs(varSem))} vs semana anterior`, null),
        tile("acum", "trending_up", dif == null ? "azul" : dif >= 0 ? "verde" : "ambar", "Avance de campaña", avance == null ? "—" : `${avance} %`,
          avance == null ? "Sin metas asignadas" : `${fmt(an.acumTotal)} de ${fmt(an.metaTotal)}${dif == null ? "" : ` · ${dif >= 0 ? "+" : "−"}${Math.abs(dif)} pts vs esperado`}`, null),
        tile("bajo", "warning", bajo.length ? "ambar" : "verde", "Bajo el ritmo", String(bajo.length), bajo.length ? "Menos del 80 % de lo esperado" : "Todas al ritmo", setDe(bajo.map((u) => u.clues)), "Por debajo del ritmo"),
        tile("sinmov", "pause_circle", "gris", "Sin movimiento", String(sinMov.length), "Semana en ceros", setDe(sinMov.map((u) => u.clues)), "Sin movimiento")
      );
      if (an.sinMeta) out.tiles.push(tile("sinmeta", "flag", "ambar", "Sin meta", String(an.sinMeta), "No se mide su avance", setDe(arr.filter((u) => !u.meta).map((u) => u.clues)), "Sin meta"));
      out.texto.push(
        `• Dosis de la semana: ${fmt(an.semanaTotal)}${varSem == null ? "" : ` (${varSem >= 0 ? "+" : "−"}${fmt(Math.abs(varSem))} vs semana anterior)`}`,
        an.metaTotal ? `• Acumulado de la campaña: ${fmt(an.acumTotal)} de ${fmt(an.metaTotal)} (${avance} %)${an.esperado != null ? `, esperado ${an.esperado} %` : ""}` : "",
        bajo.length ? `• ${bajo.length} unidad(es) por debajo del ritmo` : ""
      );
    }
    out.texto = out.texto.filter(Boolean);
    return out;
  }

  /** Avance por municipio a partir de las listas del resumen (capturadas/faltantes). */
  function avancePorMunicipio(capturadas, faltantes) {
    const m = new Map();
    const add = (r, cap) => {
      const k = muniKey(r.municipio);
      if (!m.has(k)) m.set(k, { k, etiqueta: muniEtiqueta(r.municipio), cap: 0, falta: 0 });
      m.get(k)[cap ? "cap" : "falta"]++;
    };
    (capturadas || []).forEach((r) => add(r, true));
    (faltantes || []).forEach((r) => add(r, false));
    return [...m.values()].sort((a, b) => muniOrden(a.k) - muniOrden(b.k)).map((x) => ({ ...x, total: x.cap + x.falta, pct: pct(x.cap, x.cap + x.falta) }));
  }

  /* ───────────────────────────── Vista en vivo: KPIs ───────────────────────────── */
  const dif = (a, b, un) => { const d = a - b; return d === 0 ? "igual que la captura anterior" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}${un ? " " + un : ""} vs captura anterior`; };

  /**
   * Tira de indicadores de la Vista en vivo. res = respuesta de adminGetUnitDetail (+ res.extra según el tipo).
   * Devuelve [{icono, tono, etiqueta, valor, nota}] sin DOM.
   */
  function kpisVivo(tipo, res, hoy) {
    const t = String(tipo || "SR").toUpperCase();
    const data = (res && res.data) || [];
    const k = [];
    if (t === "SR") {
      if (!data.length) return k;
      const an = analizarSR(data.map((r) => ({ ...r, clues: r.clues || "X" })), [], hoy);
      const u = [...an.unidades.values()][0];
      if (!u) return k;
      const prev = (res.prevData || []);
      const prevFr = prev.reduce((s, r) => s + num(r.cantidad), 0);
      const nBio = u.biologicos;
      const conStock = nBio - u.cerosDet.length;
      k.push(
        { icono: "package_2", tono: "azul", etiqueta: "Frascos en existencia", valor: fmt(u.frascos), nota: prev.length ? dif(u.frascos, prevFr, "frascos") : `≈ ${fmt(u.dosis)} dosis` },
        { icono: "vaccines", tono: "azul", etiqueta: "Dosis estimadas", valor: fmt(u.dosis), nota: "Frascos × dosis por frasco" },
        { icono: "inventory_2", tono: u.cerosDet.length ? "rojo" : "verde", etiqueta: "Biológicos con existencia", valor: `${conStock}<small> de ${nBio}</small>`, nota: u.cerosDet.length ? `En cero: ${u.cerosDet.slice(0, 3).join(", ")}${u.cerosDet.length > 3 ? " +" + (u.cerosDet.length - 3) : ""}` : "Ninguno en cero" },
        { icono: "event_busy", tono: u.caducados.lotes ? "rojo" : u.cad.lotes ? "ambar" : "verde", etiqueta: "Caducidad ≤ 3 meses", valor: String(u.cad.lotes + u.caducados.lotes), nota: (u.cad.lotes + u.caducados.lotes) ? `${fmt(u.cad.frascos + u.caducados.frascos)} frascos${u.caducados.lotes ? " · " + u.caducados.lotes + " ya caducado" + (u.caducados.lotes === 1 ? "" : "s") : ""}` : "Nada por caducar pronto" },
        { icono: "schedule", tono: u.permanencia.excedida ? "ambar" : "verde", etiqueta: "Más de 90 días en la unidad", valor: String(u.permanencia.excedida), nota: u.permanencia.excedida ? "Conviene redistribuir" : (u.permanencia.alerta ? `${u.permanencia.alerta} entre 60 y 90 días` : "Dentro del límite") }
      );
      if (u.abiertos.vencidos || u.abiertos.porVencer) k.push({ icono: "timer", tono: u.abiertos.vencidos ? "rojo" : "ambar", etiqueta: "Frascos abiertos", valor: String(u.abiertos.vencidos + u.abiertos.porVencer), nota: `${u.abiertos.vencidos} vencido${u.abiertos.vencidos === 1 ? "" : "s"} · ${u.abiertos.porVencer} por vencer` });
      if (u.prestamos) k.push({ icono: "handshake", tono: "azul", etiqueta: "Préstamos recibidos", valor: String(u.prestamos), nota: "Renglones prestados por otro municipio" });
    }
    if (t === "CONS") {
      const c = data[0];
      if (!c) return k;
      const an = analizarCons([{ ...c, clues: c.clues || "X" }]);
      const u = [...an.unidades.values()][0];
      const p = (res.prevData && res.prevData[0]) || null;
      const pa = p ? [...analizarCons([{ ...p, clues: p.clues || "X" }]).unidades.values()][0] : null;
      k.push(
        { icono: "vaccines", tono: "azul", etiqueta: "Dosis SRP + SR", valor: fmt(u.dosis), nota: pa ? dif(u.dosis, pa.dosis, "dosis") : `SRP ${fmt(u.srp)} · SR ${fmt(u.sr)}` },
        { icono: "syringe", tono: u.j05 === 0 ? "rojo" : "azul", etiqueta: "Jeringas de 0.5 ml", valor: fmt(u.j05), nota: pa ? dif(u.j05, pa.j05) : "Aplicación" },
        { icono: "colorize", tono: u.ag === 0 ? "rojo" : "azul", etiqueta: "Agujas", valor: fmt(u.ag), nota: pa ? dif(u.ag, pa.ag) : "Existencia reportada" },
        { icono: "syringe", tono: u.j5 === 0 ? "ambar" : "azul", etiqueta: "Jeringas de 5 ml", valor: fmt(u.j5), nota: pa ? dif(u.j5, pa.j5) : "Reconstitución" },
        { icono: u.insuficiente ? "error" : "verified", tono: u.dosis === 0 ? "gris" : u.insuficiente ? "rojo" : "verde", etiqueta: "Cobertura de insumos", valor: u.cobertura == null ? "—" : `${Math.round(u.cobertura * 100)} %`, nota: u.cobertura == null ? "Sin dosis SRP/SR registradas" : u.insuficiente ? `Faltan ${fmt(u.dosis - Math.min(u.j05, u.ag))} jeringas/agujas para sus dosis` : "Alcanza para una jeringa y aguja por dosis" }
      );
    }
    if (t === "BIO") {
      if (!data.length) return k;
      const an = analizarBio(data.map((r) => ({ ...r, clues: r.clues || "X" })), null);
      const u = [...an.unidades.values()][0];
      const prev = (res.extra && res.extra.pedidoAnterior) || null;
      const prevTot = prev ? prev.reduce((s, r) => s + num(r.pedido_frascos), 0) : null;
      k.push(
        { icono: "local_shipping", tono: "violeta", etiqueta: "Pedido solicitado", valor: fmt(u.pedido), nota: prevTot == null ? `${fmt(u.dosisPedido)} dosis` : `${dif(u.pedido, prevTot, "frascos").replace("captura anterior", "mes anterior")}` },
        { icono: "inventory", tono: "azul", etiqueta: "Existencia al pedir", valor: fmt(u.existencia), nota: "Frascos declarados" },
        { icono: "vaccines", tono: "azul", etiqueta: "Dosis pedidas", valor: fmt(u.dosisPedido), nota: "Frascos × dosis por frasco" },
        { icono: "list_alt", tono: "azul", etiqueta: "Biológicos solicitados", valor: `${u.pedidos}<small> de ${data.length}</small>`, nota: u.sinPedido ? "No solicitó ningún frasco" : "Con al menos un frasco" },
        { icono: "rule", tono: u.alertas.length ? "ambar" : "verde", etiqueta: "Renglones por revisar", valor: String(u.alertas.length), nota: u.alertas.length ? u.alertas[0].texto : "Nada fuera de lo normal" }
      );
    }
    if (t === "INF") {
      const e = res && res.extra;
      if (!data.length) return k;
      const total = data.reduce((s, r) => s + num(r.cantidad), 0);
      if (e) {
        const avance = e.metaTotal > 0 ? Math.round((e.acumulado / e.metaTotal) * 100) : null;
        k.push(
          { icono: "vaccines", tono: "violeta", etiqueta: "Dosis de la semana", valor: fmt(total), nota: e.anterior == null ? "Primer reporte" : dif(total, e.anterior, "dosis").replace("captura anterior", "semana anterior") },
          { icono: "trending_up", tono: "azul", etiqueta: "Acumulado de la campaña", valor: fmt(e.acumulado), nota: e.metaTotal ? `${avance} % de su meta (${fmt(e.metaTotal)})` : "Sin meta asignada" }
        );
        if (e.esperado != null && avance != null) {
          const d = avance - e.esperado;
          k.push({ icono: "speed", tono: d >= 0 ? "verde" : (avance < e.esperado * 0.8 ? "rojo" : "ambar"), etiqueta: "Ritmo contra lo esperado", valor: `${d >= 0 ? "+" : "−"}${Math.abs(d)} pts`, nota: `Se esperaba ${e.esperado} % a esta fecha` });
        }
        if (e.metaTotal > 0 && e.restantes != null) k.push({ icono: "flag", tono: "gris", etiqueta: "Dosis para llegar a la meta", valor: fmt(Math.max(0, e.metaTotal - e.acumulado)), nota: e.restantes > 0 ? `≈ ${fmt(Math.ceil(Math.max(0, e.metaTotal - e.acumulado) / e.restantes))} por semana restante` : "Campaña concluida" });
      }
    }
    return k;
  }

  /** Revisión por renglón de un pedido (Vista en vivo): cobertura en meses y alerta. */
  function revisionRenglonBio(r) {
    const ped = num(r.pedido_frascos ?? r.solicitud), exi = num(r.existencia_actual_frascos ?? r.existencia), prom = num(r.promedio_frascos);
    if (prom <= 0) return { cobertura: null, tipo: null, texto: "" };
    const cob = (exi + ped) / prom;
    if (ped > 2 * prom) return { cobertura: cob, tipo: "sobrepedido", texto: "Sobrepedido" };
    if (cob < 1) return { cobertura: cob, tipo: "riesgo", texto: "Riesgo de desabasto" };
    if (exi >= 2 * prom && ped > 0) return { cobertura: cob, tipo: "exceso", texto: "Ya tiene existencia" };
    return { cobertura: cob, tipo: null, texto: "" };
  }

  /* ───────────────────────────── texto y CSV ───────────────────────────── */
  function textoResumen(tipo, data, avanceMuni, resumen) {
    const nombre = { SR: "Existencia de biológicos", CONS: "Consumibles", BIO: "Pedido de biológico", INF: "Influenza" }[tipo] || tipo;
    const periodo = data && data.fIniStr && data.fFinStr && data.fIniStr !== data.fFinStr ? `${fechaCorta(data.fIniStr)} al ${fechaCorta(data.fFinStr)}` : fechaCorta(data && data.fecha);
    const L = [`*RESUMEN DE CAPTURA · ${nombre.toUpperCase()}*`, `Periodo: ${periodo}`];
    const cap = data.total_capturadas || 0, tot = data.total_unidades || 0;
    L.push(data.es_extraordinario ? `Capturaron: ${cap} unidades (pedido extraordinario)` : `Avance: ${cap} de ${tot} unidades (${pct(cap, tot)} %)`);
    if (avanceMuni && avanceMuni.length > 1) {
      L.push("", "*Por municipio*");
      avanceMuni.forEach((m) => L.push(`• ${m.etiqueta}: ${m.cap}/${m.total} (${m.pct} %)${m.falta ? ` — faltan ${m.falta}` : ""}`));
    }
    if (resumen && resumen.texto && resumen.texto.length) L.push("", "*Hallazgos*", ...resumen.texto);
    const fal = (data.faltantes || []).length;
    if (fal && !data.es_extraordinario) L.push("", `Pendientes (${fal}): ` + data.faltantes.slice(0, 12).map((f) => String(f.unidad || "").toUpperCase()).join(", ") + (fal > 12 ? ` y ${fal - 12} más` : ""));
    return L.join("\n");
  }

  function csvCelda(v) {
    const s = String(v == null ? "" : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /** Una fila por unidad (capturó o falta) con las columnas del tipo. */
  function construirCsv(tipo, data, an, rachas) {
    const cabeceras = ["Municipio", "CLUES", "Unidad", "Estatus", "Capturó", "Fecha captura", "Hora"];
    const extra = {
      SR: ["Frascos", "Dosis estimadas", "Biológicos en cero", "Lotes caducan ≤3 m", "Frascos caducan ≤3 m", "Lotes caducados", "Frascos abiertos vencidos", "Lotes >90 días", "Préstamos"],
      CONS: ["SRP (dosis)", "SR (dosis)", "Jeringa 5 ml", "Jeringa 0.5 ml", "Aguja", "Insumos en cero", "Cobertura de insumos %"],
      BIO: ["Pedido (frascos)", "Pedido (dosis)", "Existencia (frascos)", "Biológicos solicitados", "Renglones por revisar", "Fuera de ventana"],
      INF: ["Dosis semana", "Acumulado", "Meta", "Avance %", "Por debajo del ritmo"]
    }[tipo] || [];
    const L = [[...cabeceras, ...extra, "Semanas/meses previos sin capturar"].map(csvCelda).join(",")];
    const fila = (r, cap) => {
      const u = an && an.unidades.get(String(r.clues || "").toUpperCase());
      const base = [r.municipio, r.clues, r.unidad, cap ? "Capturó" : "Pendiente", cap ? (r.capturado_por || "") : "", u && u.fechaCaptura || "", u && u.timestamp ? hora(u.timestamp) : ""];
      let e = extra.map(() => "");
      if (u) {
        if (tipo === "SR") e = [u.frascos, u.dosis, u.ceros.join(" / "), u.cad.lotes, u.cad.frascos, u.caducados.lotes, u.abiertos.vencidos, u.permanencia.excedida, u.prestamos];
        if (tipo === "CONS") e = [u.srp, u.sr, u.j5, u.j05, u.ag, u.ceros.join(" / "), u.cobertura == null ? "" : Math.round(u.cobertura * 100)];
        if (tipo === "BIO") e = [u.pedido, u.dosisPedido, u.existencia, u.pedidos, u.alertas.length, u.fueraVentana ? "Sí" : "No"];
        if (tipo === "INF") e = [u.semana, u.acumulado, u.meta, u.avance == null ? "" : u.avance, u.bajoRitmo ? "Sí" : "No"];
      }
      L.push([...base, ...e, !cap && rachas ? rachas(r.clues) : ""].map(csvCelda).join(","));
    };
    (data.capturadas || []).forEach((r) => fila(r, true));
    (data.faltantes || []).forEach((r) => fila(r, false));
    return "﻿" + L.join("\r\n");
  }

  const API = {
    // puras (probadas en Node)
    mesesA, mmmaa, lunesDe, ymdAdd, dosisFrasco, muniKey, muniEtiqueta,
    analizarSR, analizarCons, analizarBio, analizarInf, rachaSemanal, rachaMensual,
    construirResumen, avancePorMunicipio, kpisVivo, revisionRenglonBio, textoResumen, construirCsv,
    _util: { esc, norm, num, fmt, pct, hora, diaCorto, fechaCorta, ymdLocalDeTs, ultimoPorClues, muniOrden, ETIQ_MUNI }
  };
  root.CapturaInsights = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
