// --- SIREVAQ INFLUENZA META-LOGRO MODULE ---
const INFLUENZA_RUBROS = [
  { id: "r1", categoria: "Población blanca", grupo: "Primera dosis", edad: "6 a 11 meses" },
  { id: "r2", categoria: "Población blanca", grupo: "Primera dosis", edad: "12 a 23 meses" },
  { id: "r3", categoria: "Población blanca", grupo: "Primera dosis", edad: "24 a 35 meses" },
  { id: "r4", categoria: "Población blanca", grupo: "Primera dosis", edad: "36 a 47 meses" },
  { id: "r5", categoria: "Población blanca", grupo: "Primera dosis", edad: "48 a 59 meses" },
  { id: "r6", categoria: "Población blanca", grupo: "Segunda dosis", edad: "7 a 11 meses" },
  { id: "r7", categoria: "Población blanca", grupo: "Segunda dosis", edad: "12 a 23 meses" },
  { id: "r8", categoria: "Población blanca", grupo: "Segunda dosis", edad: "24 a 35 meses" },
  { id: "r9", categoria: "Población blanca", grupo: "Segunda dosis", edad: "36 a 47 meses" },
  { id: "r10", categoria: "Población blanca", grupo: "Segunda dosis", edad: "48 a 59 meses" },
  { id: "r11", categoria: "Población blanca", grupo: "Revacunación", edad: "18 a 23 meses" },
  { id: "r12", categoria: "Población blanca", grupo: "Revacunación", edad: "24 a 35 meses" },
  { id: "r13", categoria: "Población blanca", grupo: "Revacunación", edad: "36 a 47 meses" },
  { id: "r14", categoria: "Población blanca", grupo: "Revacunación", edad: "48 a 59 meses" },
  { id: "r15", categoria: "Población blanca", grupo: "Revacunación", edad: "60 años y más" },
  { id: "r16", categoria: "Población de riesgo de 5 a 59 años", grupo: "Grupos de riesgo", edad: "EMBARAZADAS" },
  { id: "r17", categoria: "Población de riesgo de 5 a 59 años", grupo: "Grupos de riesgo", edad: "PERSONAL DE SALUD EN UNIDADES MÉDICAS" },
  { id: "r18", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "5 a 9 años" },
  { id: "r19", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "10 a 19 años" },
  { id: "r20", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "20 a 59 años" },
  { id: "r21", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "5 a 9 años" },
  { id: "r22", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "10 a 19 años" },
  { id: "r23", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "20 a 59 años" },
  { id: "r24", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "5 a 9 años" },
  { id: "r25", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "10 a 19 años" },
  { id: "r26", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "20 a 59 años" },
  { id: "r27", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "5 a 9 años" },
  { id: "r28", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "10 a 19 años" },
  { id: "r29", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "20 a 59 años" },
  { id: "r30", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "5 a 9 años" },
  { id: "r31", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "10 a 19 años" },
  { id: "r32", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "20 a 59 años" },
  { id: "r33", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "5 a 9 años" },
  { id: "r34", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "10 a 19 años" },
  { id: "r35", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "20 a 59 años" },
  { id: "r36", categoria: "Población de riesgo de 5 a 59 años", grupo: "Enfermedades cardiacas o pulmonares congénitas, u otros padecimientos crónicos que requieran consumo prolongado de salicilatos", edad: "5 a 9 años" },
  { id: "r37", categoria: "Población de riesgo de 5 a 59 años", grupo: "Enfermedades cardiacas o pulmonares congénitas, u otros padecimientos crónicos que requieran consumo prolongado de salicilatos", edad: "10 a 19 años" },
  { id: "r38", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "5 a 9 años" },
  { id: "r39", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "10 a 19 años" },
  { id: "r40", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "20 a 59 años" },
  { id: "r41", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "5 a 9 años" },
  { id: "r42", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "10 a 19 años" },
  { id: "r43", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "20 a 59 años" },
  { id: "r44", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "5 a 9 años" },
  { id: "r45", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "10 a 19 años" },
  { id: "r46", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "20 a 59 años" }
];

// Fuente única de verdad: mapeo rubro (r1..r46) -> variable SIS de Influenza.
// influenza_module.js carga primero (ver orden de <script defer> en index.html), así que
// param_calculator.js (BIO_SIS_MAPPING.INFLUENZA) y rda_calculator.js (DEFAULT_DICT_2026.INFLUENZA)
// derivan su lista de aquí (Object.values(window.INFLUENZA_SIS_MAPPING)) en vez de mantener
// cada uno su propia copia hardcodeada — si necesitas agregar/quitar una variable, cámbiala
// solo aquí.
window.INFLUENZA_SIS_MAPPING = {
  "r1": "BIE01", "r2": "BIE28", "r3": "BIE29", "r4": "BIE30", "r5": "BIE31",
  "r6": "BIE04", "r7": "BIE32", "r8": "BIE33", "r9": "BIE34", "r10": "BIE35",
  "r11": "BIE36", "r12": "BIE37", "r13": "BIE38", "r14": "BIE39", "r15": "BIE40",
  "r16": "BIO96", "r17": "BIO97",
  "r18": "BIE09", "r19": "BIE10", "r20": "BIE41",
  "r21": "BIE12", "r22": "BIE13", "r23": "BIE42",
  "r24": "BIE15", "r25": "BIE16", "r26": "BIE43",
  "r27": "BIE18", "r28": "BIE19", "r29": "BIE44",
  "r30": "BIE48", "r31": "BIE49", "r32": "BIE50",
  "r33": "BIE24", "r34": "BIE25", "r35": "BIE46",
  "r36": "BIE51", "r37": "BIE52", "r38": "BIE53",
  "r39": "BIE54", "r40": "BIE55",
  "r41": "BIE56", "r42": "BIE57", "r43": "BIE58",
  "r44": "BIE59", "r45": "BIE60", "r46": "BIE61"
};

// ISO Week Helper
function getISOWeek(date) {
  const tempDate = new Date(date.valueOf());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

let _campaignConfig = { fecha_inicio: "2025-10-03", fecha_fin: "2026-04-25" };
let _allCampaigns = [];
let _activeCampaign = null;
let _selectedCampaign = null;
let _uploadedCsvData = null;
let _conciliacionLastResult = [];
let _conciliacionFilter = "all"; // all, diff, match
let _conciliacionSearchQuery = "";

/**
 * Deriva el nombre de campaña (ej. "2025-2026") a partir de las fechas.
 * Si la campaña ya terminó, calcula la siguiente automáticamente.
 */
function deriveCampaignName(startStr, endStr) {
  const start = new Date(startStr + "T12:00:00");
  const end   = new Date(endStr   + "T12:00:00");
  const today = new Date();

  // Años iniciales de la campaña configurada
  let yr1 = start.getFullYear();
  let yr2 = end.getFullYear();

  // Si la campaña ya terminó, avanzar un año
  if (today > end) {
    yr1++;
    yr2++;
  }
  return `${yr1}-${yr2}`;
}

/** Puebla todos los selectores de campaña en el DOM */
function populateCampaignSelectors() {
  const infCampanas = _allCampaigns.filter(c => c.nombre && c.nombre.startsWith("Campaña Influenza"));
  // El panel «Temporada invernal» cubre influenza y COVID-19: ahí se muestra «Temporada invernal 2026-2027»
  // (el valor sigue siendo el nombre de la campaña, que es la llave de los datos).
  const etiquetaTemporada = (n) => String(n).replace(/^Campaña Influenza\s*/i, "Temporada invernal ");

  let html = "", htmlTemporada = "";
  if (infCampanas.length > 0) {
    html = infCampanas.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join("");
    htmlTemporada = infCampanas.map(c => `<option value="${c.nombre}">${etiquetaTemporada(c.nombre)}</option>`).join("");
  } else {
    const name = deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin);
    html = `<option value="Campaña Influenza ${name}">Campaña Influenza ${name}</option>`;
    htmlTemporada = `<option value="Campaña Influenza ${name}">Temporada invernal ${name}</option>`;
  }

  ["influenza_campana", "metaCampaignSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = id === "metaCampaignSelect" ? htmlTemporada : html;
      if (_selectedCampaign) {
        el.value = _selectedCampaign.nombre;
      }
    }
  });

  // Actualizar badge/eyebrow si existe
  const badge = document.getElementById("influenzaCampaignBadge");
  if (badge) {
    badge.textContent = _selectedCampaign ? _selectedCampaign.nombre : `Campaña Influenza ${deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin)}`;
  }

  // Generar dinámicamente los meses de conciliación basados en la campaña activa y sus fechas variables
  populateConciliacionMonths();
}

async function selectCampaignByName(name) {
  const found = _allCampaigns.find(c => c.nombre === name);
  if (!found) return;

  _selectedCampaign = found;
  _campaignConfig.fecha_inicio = found.fecha_inicio;
  _campaignConfig.fecha_fin = found.fecha_fin;

  // Sincronizar el valor de ambos selectores si existen
  ["influenza_campana", "metaCampaignSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== name) {
      el.value = name;
    }
  });

  const badge = document.getElementById("influenzaCampaignBadge");
  if (badge) badge.textContent = found.nombre;

  populateConciliacionMonths();
}

async function handleInfluenzaCampanaChange(e) {
  await selectCampaignByName(e.target.value);
  await loadInfluenzaUnitData();

  const weeks = generateCampaignWeeks();
  const weekSelect = document.getElementById("influenza_semana");
  if (weekSelect && weeks.length) {
    weekSelect.value = influenzaSemanaPredeterminada(weeks);
    updateInfluenzaWeekBtnLabel(weekSelect.value);
    updateInfluenzaSinMovimientoUI();
  }

  renderCaptureGrid();
  loadInfluenzaHistoryList();
}

async function handleMetaCampaignSelectChange(e) {
  await selectCampaignByName(e.target.value);
  await loadInfluenzaAdminData();
  await populateInfluenzaAdminFilters();
  renderActiveAdminSection();
}


function populateConciliacionMonths() {
  const conciliacionMesSelect = document.getElementById("conciliacionMes");
  if (!conciliacionMesSelect) return;

  const startStr = _campaignConfig.fecha_inicio || "2025-10-03";
  const endStr   = _campaignConfig.fecha_fin    || "2026-04-25";

  const startDate = new Date(startStr + "T12:00:00");
  const endDate = new Date(endStr + "T12:00:00");

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const options = [];
  // Inicializar en el día 1 de ese mes/año
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 12, 0, 0);

  while (current <= endDate || (current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear())) {
    const m = current.getMonth() + 1;
    const y = current.getFullYear();
    const label = `${monthNames[current.getMonth()]} ${y}`;
    options.push({ value: `${m}|${y}`, label: label });
    
    // Avanzar mes
    current.setMonth(current.getMonth() + 1);
  }

  conciliacionMesSelect.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
}

async function loadCampaignConfig() {
  try {
    const { data, error } = await window.supabase
      .from("campanas")
      .select("*")
      .order("fecha_inicio", { ascending: false });

    if (error) throw error;

    _allCampaigns = data || [];
    const infCampanas = _allCampaigns.filter(c => c.nombre && c.nombre.startsWith("Campaña Influenza"));
    
    _activeCampaign = infCampanas.find(c => c.activo) || infCampanas[0] || null;

    if (_activeCampaign) {
      _campaignConfig.fecha_inicio = _activeCampaign.fecha_inicio;
      _campaignConfig.fecha_fin    = _activeCampaign.fecha_fin;
      if (!_selectedCampaign) {
        _selectedCampaign = _activeCampaign;
      }
    }
    
    if (_selectedCampaign) {
      _campaignConfig.fecha_inicio = _selectedCampaign.fecha_inicio;
      _campaignConfig.fecha_fin    = _selectedCampaign.fecha_fin;
    }
  } catch (err) {
    console.error("Error al cargar configuración de campaña:", err);
  }
  // Siempre sincronizar los selectores después de cargar
  populateCampaignSelectors();
}

// Generar semanas epidemiológicas de Influenza.
// Los reportes son semanales y SIEMPRE caen en viernes (el avance/medallas de main.js cuenta los viernes
// dentro de la temporada), así que la lista arranca en el primer viernes >= inicio y termina en el último
// viernes <= fin, aunque las fechas de la temporada no sean viernes (ej. inicio jueves 1-oct).
// Siempre se usa la campaña seleccionada/activa; no se salta a otra temporada al terminar la actual.
function generateCampaignWeeks() {
  const weeks = [];
  const startStr = _campaignConfig.fecha_inicio || "2025-10-03";
  const endStr   = _campaignConfig.fecha_fin    || "2026-04-25";
  const d = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);

  while (d <= end) {
    const ymd = d.toISOString().split('T')[0];
    const weekNum = getISOWeek(d);
    weeks.push({ semana: weekNum, fecha: ymd, label: `Semana ${weekNum} (${influenzaRangoTexto(ymd, startStr, endStr)})` });
    d.setDate(d.getDate() + 7);
  }

  // Cortes de fin de mes entre semana (ver InfluenzaReglas.cortes): reporte extra fechado el último día del mes.
  const cortes = window.InfluenzaReglas ? window.InfluenzaReglas.cortes(startStr, endStr) : [];
  cortes.forEach(ymd => {
    const weekNum = getISOWeek(new Date(ymd + "T12:00:00"));
    weeks.push({ semana: weekNum, fecha: ymd, corte: true, label: `Semana ${weekNum} (corte de mes: ${influenzaRangoTexto(ymd, startStr, endStr)})` });
  });
  weeks.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return weeks;
}

/** "2026-2027": temporada de la campaña seleccionada, para títulos y nombres de archivo de los reportes. */
function campaignSeasonLabel() {
  const nombre = _selectedCampaign?.nombre || document.getElementById("influenza_campana")?.value || "";
  const m = String(nombre).match(/(\d{4}-\d{4})/);
  return m ? m[1] : deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin);
}

// Helper para renderizar el Selector de Semanas Premium en el Dropdown
function renderInfluenzaWeekPicker() {
  const dropdown = document.getElementById("influenza_semana_dropdown");
  const hiddenInput = document.getElementById("influenza_semana");
  if (!dropdown || !hiddenInput) return;

  // Ajustar ancho del panel a 360px para dar más espacio a las etiquetas
  dropdown.style.setProperty("width", "360px", "important");

  const weeks = generateCampaignWeeks();
  // Semana en curso: la más reciente que ya abrió (el fin de semana sigue siendo de la semana que corre)
  const currentWeekFecha = influenzaSemanaPredeterminada(weeks);

  dropdown.innerHTML = "";

  const chip = (cls, icono, txt) => `<span class="inf-chip inf-chip--${cls}"><span class="material-symbols-rounded" aria-hidden="true">${icono}</span>${txt}</span>`;

  weeks.forEach(w => {
    const captureRecord = _influenzaCapturasCache.find(r => r.fecha === w.fecha);
    const isCaptured = !!captureRecord;
    const isSinMov = captureRecord && (captureRecord.sin_movimiento === true || captureRecord.sin_movimiento === 'SI');
    const isCurrent = w.fecha === currentWeekFecha;
    const isSelected = hiddenInput.value === w.fecha;

    let estado;
    if (isSinMov) estado = chip("azul", "pause_circle", "Sin movimiento");
    else if (isCaptured) estado = chip("verde", "check_circle", "Capturado");
    else if (influenzaVentanaError(w.fecha)) estado = chip("gris", "schedule", `Abre ${influenzaDiaCorto(influenzaSemanaAbre(w.fecha))}`);
    else estado = chip("ambar", "error", "Pendiente");

    const rr = window.InfluenzaReglas.rangoSemana(w.fecha, _campaignConfig.fecha_inicio, _campaignConfig.fecha_fin);
    const rangoTxt = window.InfluenzaReglas.textoRango(rr.desde, rr.hasta);
    const rango = rr.parte === "corte" ? `Corte de fin de mes · ${rangoTxt}`
      : (rr.parte === "resto" ? `${rangoTxt} · resto de la semana` : rangoTxt);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "inf-sem-item" + (isSelected ? " is-selected" : "");
    if (isSelected) item.setAttribute("aria-current", "true");
    item.dataset.fecha = w.fecha;
    item.innerHTML = `
      <span class="inf-sem-item-txt">
        <span class="inf-sem-item-tit">Semana ${w.semana}${isCurrent ? '<span class="inf-sem-actual">En curso</span>' : ""}</span>
        <span class="inf-sem-item-sub">${rango}</span>
      </span>
      <span class="inf-sem-item-est">${estado}${isSelected ? '<span class="material-symbols-rounded inf-sem-check" aria-hidden="true">check</span>' : ""}</span>`;

    item.onclick = (e) => {
      e.stopPropagation();
      hiddenInput.value = w.fecha;
      hiddenInput.dispatchEvent(new Event("change"));
      cerrarSelectorSemanaInfluenza(true);
    };

    dropdown.appendChild(item);
  });
}

/** Cierra la lista de semanas; con `devolverFoco` el foco vuelve al botón (teclado). */
function cerrarSelectorSemanaInfluenza(devolverFoco) {
  const dropdown = document.getElementById("influenza_semana_dropdown");
  const btn = document.getElementById("influenza_semana_btn");
  if (dropdown) { dropdown.classList.add("hidden"); dropdown.style.display = "none"; }
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    if (devolverFoco) btn.focus();
  }
}

// Helper para actualizar la etiqueta del botón selector
function updateInfluenzaWeekBtnLabel(fecha) {
  const labelSpan = document.getElementById("influenza_semana_label");
  if (!labelSpan) return;

  const weeks = generateCampaignWeeks();
  const selected = weeks.find(w => w.fecha === fecha);
  if (selected) {
    const captureRecord = _influenzaCapturasCache.find(r => r.fecha === fecha);
    const isCaptured = !!captureRecord;
    const isSinMov = captureRecord && (captureRecord.sin_movimiento === true || captureRecord.sin_movimiento === 'SI');
    
    const chip = (cls, icon, txt) => `<span class="${cls} border text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0" style="white-space:nowrap;"><span class="material-symbols-rounded" style="font-size:12px;">${icon}</span>${txt}</span>`;
    let statusBadge = "";
    if (isSinMov) {
      statusBadge = chip("text-blue-700 bg-blue-50 border-blue-200", "pause_circle", "Sin Movimiento");
    } else if (isCaptured) {
      statusBadge = chip("text-emerald-700 bg-emerald-50 border-emerald-200", "check_circle", "Capturado");
    } else if (influenzaVentanaError(fecha)) {
      statusBadge = chip("text-slate-600 bg-slate-100 border-slate-300", "schedule", `Abre ${influenzaDiaCorto(influenzaSemanaAbre(fecha))}`);
    } else {
      statusBadge = chip("text-amber-700 bg-amber-50 border-amber-200", "error", "Pendiente");
    }
    labelSpan.innerHTML = `<span class="font-extrabold text-violet-700 shrink-0" style="white-space:nowrap;">Semana ${selected.semana}${selected.corte ? " · corte" : ""}</span> <span class="text-slate-400 font-bold shrink-0" style="white-space:nowrap;">· ${influenzaRangoTexto(selected.fecha)}</span> ${statusBadge}`;
  } else {
    labelSpan.innerHTML = `<span class="text-slate-400 font-bold">Seleccionar semana...</span>`;
  }
}

let SIN_MOVIMIENTO_INF = false;
// Un reporte guardado «Sin movimiento» se puede reabrir mientras la semana siga abierta (la semana corre de lunes a
// domingo, así que puede haber dosis después de haberlo marcado): aquí se recuerda esa decisión por semana.
let _infSinMovReabierto = null;   // { fecha, valor }

function updateInfluenzaSinMovimientoUI() {
  const chkINF = document.getElementById("chkSinMovimientoINF");
  const cardINF = document.getElementById("cardSinMovimientoINF");
  if (!chkINF || !cardINF) return;

  const selectedFecha = document.getElementById("influenza_semana").value;
  const currentReport = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);

  if (currentReport) {
    cardINF.style.display = "flex";
    const isSinMov = !!(currentReport.sin_movimiento === true || currentReport.sin_movimiento === 'SI');
    const reabierto = _infSinMovReabierto && _infSinMovReabierto.fecha === selectedFecha ? _infSinMovReabierto.valor : null;
    chkINF.checked = reabierto == null ? isSinMov : reabierto;
    // Un reporte con dosis no se pone en ceros de un clic (eso borraría lo capturado): se corrigen las casillas.
    chkINF.disabled = !isSinMov;
    SIN_MOVIMIENTO_INF = chkINF.checked;
  } else {
    cardINF.style.display = "flex";
    chkINF.checked = SIN_MOVIMIENTO_INF;
    chkINF.disabled = false;
  }
  if (!influenzaEstadoCaptura(selectedFecha).abierta) chkINF.disabled = true;

  // Update styles
  const iconBg = document.getElementById("iconSinMovimientoINFBg");
  const labelText = document.getElementById("labelSinMovimientoINF");

  if (chkINF.checked) {
    cardINF.style.borderColor = "var(--md-sys-color-primary)";
    cardINF.style.background = "var(--md-sys-color-primary-container)";
    if (iconBg) {
      iconBg.style.background = "var(--md-sys-color-primary)";
      iconBg.style.color = "var(--md-sys-color-on-primary)";
    }
    if (labelText) labelText.style.color = "var(--md-sys-color-primary)";
  } else {
    cardINF.style.borderColor = "";
    cardINF.style.background = "";
    if (iconBg) {
      iconBg.style.background = "";
      iconBg.style.color = "";
    }
    if (labelText) labelText.style.color = "";
  }

  // «Sin movimiento» ya no congela los selectores: al cambiar de semana se reinicia (ver initInfluenzaCaptureFlow).
  const weekBtn = document.getElementById("influenza_semana_btn");
  const campSelect = document.getElementById("influenza_campana");
  [weekBtn, campSelect].forEach(el => {
    if (!el) return;
    el.disabled = false;
    el.style.opacity = "";
    el.style.pointerEvents = "";
  });
}

// Inicializar el flujo de captura en UNIDAD
let _influenzaMetasCache = {};
let _influenzaCapturasCache = [];
let _influenzaDistribucionCache = [];
let _adminInfluenzaTrendChart = null;
let _adminInfluenzaBreakdownChart = null;


async function initInfluenzaCaptureFlow() {
  if (USER.rol !== "UNIDAD") return;
  
  await loadCampaignConfig();
  
  const campanaSelect = document.getElementById("influenza_campana");
  if (campanaSelect) {
    campanaSelect.removeEventListener("change", handleInfluenzaCampanaChange);
    campanaSelect.addEventListener("change", handleInfluenzaCampanaChange);
  }
  
  // Enlazar pestañas de Unidad
  const unitTabs = ["subtabUnitCaptura", "subtabUnitResumen", "subtabUnitHistorico"];
  unitTabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.onclick = () => {
        unitTabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");

        document.getElementById("secUnitCaptura").style.setProperty("display", "none", "important");
        document.getElementById("secUnitResumen").style.setProperty("display", "none", "important");
        document.getElementById("secUnitHistorico").style.setProperty("display", "none", "important");

        const targetSec = t.replace("subtabUnit", "secUnit");
        document.getElementById(targetSec).style.setProperty("display", targetSec === "secUnitHistorico" ? "block" : "flex", "important");
        if (targetSec === "secUnitResumen") renderInfluenzaResumenUnidad();

        if (typeof syncTabGroupIndicator === 'function') {
          syncTabGroupIndicator('#influenzaUnitTabsContainer');
        }
      };
    }
  });
  
  // Activar pestaña por defecto (Captura de Reporte)
  document.getElementById("subtabUnitCaptura")?.click();
  
  // Los selectores de campaña son <select> nativos: solo hay que realinear el indicador de pestañas
  // cuando el panel ya es visible.
  setTimeout(() => {
    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator('#influenzaUnitTabsContainer');
    }
  }, 100);

  const weeks = generateCampaignWeeks();
  const weekSelect = document.getElementById("influenza_semana");
  const weekBtn = document.getElementById("influenza_semana_btn");
  const weekDropdown = document.getElementById("influenza_semana_dropdown");

  if (weekSelect && weekBtn && weekDropdown) {
    weekSelect.value = influenzaSemanaPredeterminada(weeks);

    // Abrir/cerrar la lista; con teclado: flechas para recorrerla, Esc para cerrarla
    weekBtn.onclick = (e) => {
      e.stopPropagation();

      const isHidden = weekDropdown.classList.contains("hidden");
      if (isHidden) {
        renderInfluenzaWeekPicker();
        weekDropdown.classList.remove("hidden");
        weekDropdown.style.display = "flex";
        weekBtn.setAttribute("aria-expanded", "true");
        const enfocar = weekDropdown.querySelector('[aria-current="true"]') || weekDropdown.querySelector(".inf-sem-item");
        if (enfocar && e.detail === 0) enfocar.focus();   // detail 0 = se abrió con teclado
        if (enfocar && typeof enfocar.scrollIntoView === "function") enfocar.scrollIntoView({ block: "nearest" });
      } else {
        cerrarSelectorSemanaInfluenza(false);
      }
    };

    weekDropdown.addEventListener("keydown", (e) => {
      const items = [...weekDropdown.querySelectorAll(".inf-sem-item")];
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrarSelectorSemanaInfluenza(true); }
      else if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0])?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1])?.focus(); }
      else if (e.key === "Tab") cerrarSelectorSemanaInfluenza(false);
    });
    weekBtn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && weekDropdown.classList.contains("hidden")) { e.preventDefault(); weekBtn.click(); }
    });

    // Cerrar al dar click fuera (una sola vez, aunque el panel se reinicialice)
    if (!window._infSemanaClickFuera) {
      window._infSemanaClickFuera = true;
      document.addEventListener("click", (e) => {
        const btn = document.getElementById("influenza_semana_btn");
        const dd = document.getElementById("influenza_semana_dropdown");
        if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) cerrarSelectorSemanaInfluenza(false);
      });
    }

    // Enlazar evento change
    // Cada semana arranca limpia: la marca «Sin movimiento» de otra semana no se arrastra.
    if (!weekSelect.dataset.enlazado) {
      weekSelect.dataset.enlazado = "1";
      weekSelect.addEventListener("change", (e) => {
        SIN_MOVIMIENTO_INF = false;
        _infSinMovReabierto = null;
        const nomInp = document.getElementById("nombreINFLUENZA");
        if (nomInp) delete nomInp.dataset.tocado;
        updateInfluenzaWeekBtnLabel(e.target.value);
        updateInfluenzaSinMovimientoUI();
        renderCaptureGrid();
      });
    }
  }

  const chkINF = document.getElementById("chkSinMovimientoINF");
  if (chkINF) {
    chkINF.onchange = () => {
      _infSinMovReabierto = { fecha: document.getElementById("influenza_semana").value, valor: chkINF.checked };
      SIN_MOVIMIENTO_INF = chkINF.checked;
      updateInfluenzaSinMovimientoUI();
      renderCaptureGrid();
    };
  }

  const nombreInf = document.getElementById("nombreINFLUENZA");
  if (nombreInf && !nombreInf.dataset.pasos) {
    nombreInf.dataset.pasos = "1";
    nombreInf.addEventListener("input", () => { nombreInf.dataset.tocado = "1"; actualizarPasosInfluenza(); });
  }
  const gridInf = document.getElementById("influenzaCaptureGroupsContainer");
  if (gridInf && !gridInf.dataset.pasos) {
    gridInf.dataset.pasos = "1";
    gridInf.addEventListener("input", actualizarPasosInfluenza);
  }

  // Cargar datos iniciales
  await loadInfluenzaUnitData();
  if (weekSelect) {
    updateInfluenzaWeekBtnLabel(weekSelect.value);
    updateInfluenzaSinMovimientoUI();
  }
  renderCaptureGrid();
  loadInfluenzaHistoryList();
  // Nota: el guardado se maneja desde el globalCommandHub (syncCommandHub → saveInfluenzaReport)
}

async function loadInfluenzaUnitData() {
  try {
    // 1. Metas de la unidad
    const campana = document.getElementById("influenza_campana").value;
    const resMetas = await AppService.call("getinfluenza_metas", { anio_campana: campana });
    const unitMetaRec = resMetas.data.find(r => r.clues === USER.clues);
    _influenzaMetasCache = unitMetaRec ? unitMetaRec.metas : {};
    covidCargarMetaUnidad(campana);
    actualizarMenuExportMeta();

    // 2. Historial de capturas
    const resCapturas = await AppService.call("getinfluenza_capturas", { clues: USER.clues, anio_campana: campana });
    _influenzaCapturasCache = resCapturas.data || [];
    try {
      const resCovid = await AppService.call("getcovid_capturas", { clues: USER.clues, anio_campana: campana }, { silent: true });
      _covidCapturasCache = (resCovid && resCovid.data) || [];
    } catch (e) { _covidCapturasCache = []; }
    renderCovidCaptura();

    // 3. Distribución de frascos
    const resFrascos = await AppService.call("getinfluenza_distribucion", { clues: USER.clues, anio_campana: campana });
    _influenzaDistribucionCache = resFrascos.data || [];

    // 📈 4. CONEXIÓN AUTOMÁTICA: Pronóstico de Desabasto
    // Existencia REAL: dosis repartidas a la unidad menos las que ella misma ha capturado cada semana.
    // (Antes se leían campos que no existen y se usaba un valor fijo de 45 dosis.)
    const balance = renderInfluenzaBalanceUnidad();
    renderInfluenzaResumenUnidad();
    const contPred = document.getElementById("influenzaStockPredictorContainer");
    if (window.StockPredictor && contPred) {
      if (!balance.recibidos) {
        contPred.innerHTML = "";   // sin reparto no hay existencia que pronosticar
      } else {
        const historyApplies = _influenzaCapturasCache.map(c => ({ fecha: c.fecha, dosis: frascoDosisDeCaptura(c) }));
        window.StockPredictor.renderPredictiveWidget("influenzaStockPredictorContainer", Math.max(0, balance.existencia), historyApplies, USER?.clues);
      }
    }
  } catch (err) {
    console.error("Error al cargar datos de Influenza:", err);
  }
}

// Regla de calendario (2ª dosis no en el 1er mes, 1ª dosis no en el último) para un rubro y una semana,
// con las fechas de la campaña seleccionada. null = se puede capturar.
function reglaDosisRubro(rb, fecha) {
  return window.InfluenzaReglas
    ? window.InfluenzaReglas.reglaDosis(rb.grupo, fecha, _campaignConfig.fecha_inicio, _campaignConfig.fecha_fin)
    : null;
}

// Aviso con las reglas que aplican a la semana elegida (o "" si ninguna).
function avisoReglasSemana(fecha) {
  const ejemplos = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const r = reglaDosisRubro(rb, fecha);
    if (r) ejemplos[r.tipo] = r;
  });
  return Object.values(ejemplos).map(r => `<div class="inf-aviso"><b>${r.tipo === "segunda" ? "2ª dosis" : "1ª dosis"} no disponible esta semana.</b> ${r.texto}</div>`).join("");
}

// Estado de la tabla pintada (acumulado previo por rubro) para recalcular sin volver a pintar.
let _infGrid = { acum: {}, fecha: "", cerrada: false };

/** Tono del avance: gris sin meta, verde >= 85 %, ámbar >= 50 %, rojo debajo; «over» si rebasa la meta. */
function infTonoAvance(meta, pct) {
  if (!meta) return "none";
  if (pct > 100) return "over";
  if (pct >= 85) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}

/** Repinta una fila con lo que se va tecleando: avance, barra y la línea «X de Y» (o «Te pasas por N» si rebasa la meta). */
function actualizarFilaInfluenza(rubroId, v) {
  const meta = Number(_influenzaMetasCache[rubroId] || 0);
  const acum = _infGrid.acum[rubroId] || 0;
  const input = document.getElementById(`input_inf_${rubroId}`);
  const disp = document.getElementById(`disp_inf_${rubroId}`);
  const pctEl = document.getElementById(`pct_inf_${rubroId}`);
  const barEl = document.getElementById(`bar_inf_${rubroId}`);
  if (!input || !meta) return;

  const total = acum + v;
  const exceso = total - meta;
  const pct = Math.round((total / meta) * 100);
  const tono = infTonoAvance(meta, pct);

  if (exceso > 0) {
    input.setAttribute("aria-invalid", "true");
    input.title = `Con esta cifra superas la meta de este grupo por ${exceso}: confirma que es correcta`;
    input.classList.add("is-over");
    if (disp) { disp.className = "inf-disp is-over"; disp.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">warning</span>Te pasas por ${exceso}`; }
  } else {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("title");
    input.classList.remove("is-over");
    if (disp) { disp.className = "inf-disp" + (exceso === 0 ? " is-justo" : ""); disp.textContent = `${total} de ${meta}`; }
  }
  if (pctEl) { pctEl.textContent = `${pct}%`; pctEl.dataset.tono = tono; }
  if (barEl) {
    barEl.style.width = Math.min(pct, 100) + "%";
    barEl.setAttribute("aria-valuenow", String(Math.min(pct, 100)));
    barEl.dataset.tono = tono;
  }
}

/**
 * Contador de dosis del command hub: total de dosis tecleadas en la semana elegida.
 * Se llama en cada cambio de la tabla; el texto leído por lectores de pantalla se actualiza con retardo
 * para no anunciar cada tecla.
 */
let _hubDosisTimer = null;
function actualizarContadorDosisHub() {
  const box = document.getElementById("hubDosis");
  if (!box) return;
  if (typeof _capturaVacuna !== "undefined" && _capturaVacuna === "COVID" && window.CovidCapturaUI) {
    const t = window.CovidCapturaUI.totalActual();
    const el = document.getElementById("hubDosisSemana");
    if (el) el.textContent = t.toLocaleString("es-MX");
    box.hidden = false;
    clearTimeout(_hubDosisTimer);
    _hubDosisTimer = setTimeout(() => {
      const sr = document.getElementById("hubDosisSr");
      if (sr) sr.textContent = `${t.toLocaleString("es-MX")} ${t === 1 ? "dosis capturada" : "dosis capturadas"} esta semana.`;
    }, 700);
    return;
  }
  const grid = document.getElementById("influenzaCaptureGroupsContainer");
  const sinMov = !!document.getElementById("chkSinMovimientoINF")?.checked;
  let semana = 0, previo = 0;
  INFLUENZA_RUBROS.forEach(rb => {
    previo += Number(_infGrid.acum[rb.id] || 0);
    const input = document.getElementById(`input_inf_${rb.id}`);
    const v = sinMov ? 0 : (parseInt(input?.value, 10) || 0);
    if (v > 0) semana += v;
  });
  const fmt = (n) => n.toLocaleString("es-MX");
  const campana = previo + semana;
  const elS = document.getElementById("hubDosisSemana");
  if (elS) elS.textContent = fmt(semana);
  // Visible solo mientras la tabla de captura está pintada
  box.hidden = !grid || !grid.querySelector(".inf-input, .inf-cap-tabla");
  clearTimeout(_hubDosisTimer);
  _hubDosisTimer = setTimeout(() => {
    const sr = document.getElementById("hubDosisSr");
    if (sr) sr.textContent = `${fmt(semana)} ${semana === 1 ? "dosis capturada" : "dosis capturadas"} esta semana.`;
  }, 700);
}
window.actualizarContadorDosisHub = actualizarContadorDosisHub;

/**
 * Panel «Control de tu meta» de la captura: suma lo tecleado de toda la tabla contra la meta y lo ya acumulado,
 * dice cuántas dosis le quedan a la unidad y señala los grupos que se pasarían (el guardado los rechaza).
 */
function actualizarControlMetaInfluenza() {
  actualizarContadorDosisHub();
  const box = document.getElementById("infControlMeta");
  if (!box) return;
  const sinMov = !!document.getElementById("chkSinMovimientoINF")?.checked;
  let meta = 0, acum = 0, semana = 0;
  const excedidos = [];
  INFLUENZA_RUBROS.forEach(rb => {
    const m = Number(_influenzaMetasCache[rb.id] || 0);
    const a = _infGrid.acum[rb.id] || 0;
    const input = document.getElementById(`input_inf_${rb.id}`);
    const v = sinMov ? 0 : (parseInt(input?.value, 10) || 0);
    if (m > 0) {
      meta += m; acum += a; semana += Math.max(0, v);
      if (a + v > m) excedidos.push({ rb, exceso: a + v - m });
    }
  });

  box.hidden = false;
  if (!meta) {
    box.innerHTML = `<div class="inf-ctl-msg is-info"><span class="material-symbols-rounded" aria-hidden="true">info</span><div><b>Tu unidad aún no tiene meta asignada.</b> Cuando tu municipio la registre podrás capturar y verás aquí tu avance.</div></div>`;
    return;
  }

  const avance = (acum + semana) * 100 / meta;
  const esperado = influenzaResumenCalcular().esperadoPct;
  const diff = avance - esperado;
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const lista = excedidos.slice(0, 4).map(e => `${escapeHtml(e.rb.grupo)} · ${escapeHtml(e.rb.edad)} (+${e.exceso})`).join("; ") + (excedidos.length > 4 ? `; y ${excedidos.length - 4} más` : "");

  let msg;
  if (excedidos.length) {
    msg = `<div class="inf-ctl-msg is-over" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span><div><b>${excedidos.length === 1 ? "1 grupo rebasa" : excedidos.length + " grupos rebasan"} su meta:</b> ${lista}. Corrige la cifra: no se puede guardar un reporte que supere la meta.</div></div>`;
  } else if (_infGrid.cerrada) {
    msg = "";
  } else if (sinMov) {
    msg = `<div class="inf-ctl-msg is-info"><span class="material-symbols-rounded" aria-hidden="true">pause_circle</span><div>Esta semana se guarda <b>sin movimiento</b>: todo en ceros.</div></div>`;
  } else if (semana === 0) {
    msg = `<div class="inf-ctl-msg is-info"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><div>Anota las dosis aplicadas esta semana. Cada grupo muestra cuántas te quedan; los que no tienen meta están bloqueados.</div></div>`;
  } else {
    const ritmo = diff >= -5 ? "Vas al ritmo esperado" : `Vas ${f1(-diff)} puntos por debajo del ritmo esperado a hoy`;
    msg = `<div class="inf-ctl-msg is-ok"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span><div><b>Dentro de tu meta.</b> Con esta captura llevas ${f1(avance)}% de tu meta (esperado a hoy: ${f1(esperado)}%). ${ritmo}.</div></div>`;
  }

  // Semanas anteriores sin reporte (el panel abre toda la semana, pero cada semana se reporta una sola vez)
  const hoy = influenzaHoy();
  const atrasadas = generateCampaignWeeks().filter(w => w.fecha < hoy && w.fecha !== _infGrid.fecha
    && !_influenzaCapturasCache.some(r => r.fecha === w.fecha) && !influenzaVentanaError(w.fecha));
  const pend = atrasadas.length
    ? `<div class="inf-ctl-msg is-warn"><span class="material-symbols-rounded" aria-hidden="true">history</span><div>Tienes <b>${atrasadas.length === 1 ? "1 semana anterior" : atrasadas.length + " semanas anteriores"} sin reporte</b>. <button type="button" class="inf-ctl-link" data-fecha="${atrasadas[0].fecha}">Ir a la semana del ${influenzaRangoTexto(atrasadas[0].fecha)}</button></div></div>`
    : "";

  // Las cifras de la campaña (meta, aplicadas, avance vs esperado) viven en «Resumen de meta»; aquí solo van
  // los avisos que importan al capturar: si algo rebasa la meta y si falta alguna semana.
  box.innerHTML = msg + pend;
  box.hidden = !(msg || pend);

  box.querySelectorAll(".inf-ctl-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const sel = document.getElementById("influenza_semana");
      sel.value = btn.dataset.fecha;
      sel.dispatchEvent(new Event("change"));
    });
  });
}

// --- Paso a CeNSIA (plataforma federal): relleno asistido, la persona revisa y pulsa GUARDAR ---

// Código de casilla de CeNSIA por rubro r1..r46 (mismo orden que INFLUENZA_RUBROS).
const CENSIA_CODIGOS = [
  "BIE01", "BIE28", "BIE29", "BIE30", "BIE31",
  "BIE04", "BIE32", "BIE33", "BIE34", "BIE35",
  "BIE36", "BIE37", "BIE38", "BIE39", "BIE40",
  "BIO96", "BIO97",
  "BIE09", "BIE10", "BIE41", "BIE12", "BIE13", "BIE42", "BIE15", "BIE16", "BIE43",
  "BIE18", "BIE19", "BIE44", "BIE48", "BIE49", "BIE50", "BIE24", "BIE25", "BIE46",
  "BIE51", "BIE52", "BIE53", "BIE54", "BIE55", "BIE56", "BIE57", "BIE58", "BIE59", "BIE60", "BIE61"
];
const CENSIA_URL = "https://siscensia.salud.gob.mx/influenza26/ssa/captura.php";
// Ficha del complemento en la Chrome Web Store (se llena al publicarlo); vacío = aún no disponible.
const CENSIA_EXT_URL = "https://chromewebstore.google.com/detail/noofpbkapekpjcfegnmcndjejmkpmbin";
const censiaExtInstalada = () => document.documentElement.hasAttribute("data-sirevaq-censia-ext");

/** Guía para quien no conoce el complemento: cómo instalarlo (solo una vez) o, ya instalado, cómo se usa.
 *  Se comparte entre la tarjeta de Influenza y la de COVID-19. */
function censiaGuiaExtension() {
  const d = document.createElement("div");
  d.className = "inf-censia__guia";
  if (censiaExtInstalada()) {
    d.innerHTML = `
      <p class="inf-censia__ok"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span><span><b>Complemento instalado.</b> Así se usa:</span></p>
      <ol class="inf-censia__pasos inf-censia__pasos--grandes">
        <li>Pulsa <b>Abrir CeNSIA y rellenar</b>. CeNSIA se abre en otra pestaña.</li>
        <li>Si CeNSIA te pide usuario y contraseña, entra como siempre y ve a <b>Dosis Aplicadas → Captura</b>.</li>
        <li>Las casillas aparecen llenas solas. Revisa las cifras y pulsa <b>Guardar</b> en CeNSIA.</li>
      </ol>`;
    return d;
  }
  if (!CENSIA_EXT_URL) return d;
  d.innerHTML = `
    <div class="inf-censia__instala">
      <p class="inf-censia__instala-tit"><span class="material-symbols-rounded" aria-hidden="true">extension</span><b>Primero instala el complemento (solo una vez, tarda 1 minuto)</b></p>
      <ol class="inf-censia__pasos inf-censia__pasos--grandes">
        <li>Pulsa el botón <b>Instalar complemento</b>. Se abre la tienda de Chrome en otra pestaña.</li>
        <li>En esa pestaña pulsa el botón azul <b>Agregar a Chrome</b> y, si Chrome pregunta, <b>Agregar extensión</b>.</li>
        <li>Regresa a esta pestaña y pulsa <b>Ya lo instalé</b>. Listo: no tendrás que hacerlo otra vez.</li>
      </ol>
      <div class="inf-censia__acciones">
        <a class="inf-censia__btn" href="${CENSIA_EXT_URL}" target="_blank" rel="noopener">Instalar complemento</a>
        <button type="button" class="inf-censia__btn is-sec" data-recargar>Ya lo instalé</button>
      </div>
      <p class="inf-censia__nota">Solo funciona en Google Chrome de computadora, no en el celular.</p>
    </div>`;
  d.querySelector("[data-recargar]").addEventListener("click", () => location.reload());
  return d;
}

/** Fecha de aplicación para CeNSIA: hoy, pero nunca fuera del mes que se reporta (si ya es otro mes, el último día de ese mes). */
function censiaFechaAplicacion(fechaSemana, hoy) {
  const [a, m] = String(fechaSemana).split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const tope = `${a}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
  return hoy > tope ? tope : hoy;
}

/** Código del marcador: corre dentro de CeNSIA (self-contained). Rellena casillas; NO guarda.
 *  Lee los datos de la dirección (#sirevaq=) o, si el login los borró, del portapapeles («SIREVAQ1:…»). */
function censiaMarcadorFn() {
  var aviso = function (msg, ok) {
    var b = document.getElementById("sirevaqAviso");
    if (!b) { b = document.createElement("div"); b.id = "sirevaqAviso"; b.setAttribute("role", "status"); document.body.appendChild(b); }
    b.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;max-width:560px;padding:12px 18px;border-radius:14px;font:600 14px/1.4 system-ui,sans-serif;background:#fff;color:#0f172a;border:1px solid " + (ok ? "#cbd5e1" : "#fca5a5") + ";box-shadow:0 8px 24px rgba(15,23,42,.18)";
    b.textContent = msg;
  };
  if (!document.getElementById("BIE01")) { aviso("SIREVAQ: abre primero la pantalla «Captura» de Dosis Aplicadas en CeNSIA y vuelve a pulsar el marcador.", false); return; }
  var decodificar = function (tx) {
    try {
      var d = JSON.parse(decodeURIComponent(escape(atob(String(tx).replace(/^SIREVAQ1:/, "").trim()))));
      return d && d.v ? d : null;
    } catch (e) { return null; }
  };
  var rellenar = function (d) {
    if (d.t && Date.now() - d.t > 12 * 3600 * 1000) { aviso("SIREVAQ: esos datos tienen más de 12 horas. Vuelve a pulsar «Abrir CeNSIA y rellenar» en SIREVAQ.", false); return; }
    var ev = function (el, t) { el.dispatchEvent(new Event(t, { bubbles: true })); };
    var notas = [];
    var sel = document.querySelector("[name=s_clues]");
    if (sel) { sel.value = d.clues; ev(sel, "change"); if (sel.value !== d.clues) notas.push("elige tu unidad (" + d.clues + ") en CeNSIA"); }
    var f = document.querySelector("input[type=date]");
    if (f) { f.value = d.fecha; ev(f, "input"); ev(f, "change"); }
    var n = 0, total = 0;
    Object.keys(d.valores).forEach(function (k) {
      var el = document.getElementById(k);
      if (!el || el.disabled) return;
      var v = Number(d.valores[k]) || 0;
      el.value = v; ev(el, "input"); ev(el, "change"); n++; total += v;
    });
    aviso("SIREVAQ rellenó " + n + " casillas · " + total + " dosis · fecha " + d.fecha.split("-").reverse().join("/") + ". "
      + (notas.length ? "Falta: " + notas.join("; ") + ". " : "") + "Revisa y pulsa GUARDAR tú mismo.", !notas.length);
  };
  var manual = function () {
    var t = window.prompt("Pega aquí el código que copió SIREVAQ (empieza con SIREVAQ1:)");
    var d = t && decodificar(t);
    if (d) rellenar(d); else aviso("SIREVAQ: no encontré datos válidos. Vuelve a pulsar «Abrir CeNSIA y rellenar» en SIREVAQ.", false);
  };
  var h = (location.hash || "").match(/sirevaq=([^&]+)/), d = null;
  if (h) { try { d = decodificar(decodeURIComponent(h[1])); } catch (e) { } }
  if (d) { rellenar(d); return; }
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(function (t) {
      var c = decodificar(t);
      if (c) rellenar(c); else manual();
    }, manual);
  } else manual();
}

/** Tarjeta «Pasar a CeNSIA»: aparece cuando la semana ya está guardada en SIREVAQ. */
function renderPasoCensia(container, fechaSemana, reporte) {
  const hoy = influenzaHoy();
  const fecha = censiaFechaAplicacion(fechaSemana, hoy);
  const clave = `sirevaq_censia_${USER?.clues}_${fechaSemana}`;
  const valores = {};
  INFLUENZA_RUBROS.forEach((rb, i) => { valores[CENSIA_CODIGOS[i]] = Number(reporte.valores?.[rb.id] || 0); });
  const total = Object.values(valores).reduce((a, b) => a + b, 0);
  const armar = () => btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, t: Date.now(), clues: USER?.clues, fecha, valores }))));
  const enlace = `${CENSIA_URL}#sirevaq=${encodeURIComponent(armar())}`;
  let previo = null;
  try { previo = localStorage.getItem(clave); } catch (e) { /* sin almacenamiento */ }
  const fmtF = (s) => s.split("-").reverse().join("/");

  const box = document.createElement("section");
  box.className = "inf-censia";
  box.setAttribute("aria-label", "Pasar este reporte a CeNSIA");
  box.innerHTML = `
    <div class="inf-censia__tit"><span class="material-symbols-rounded" aria-hidden="true">cloud_upload</span><b>Siguiente paso: captura en CeNSIA</b></div>
    <p>Este reporte (${total.toLocaleString("es-MX")} dosis) también se captura en la plataforma federal. SIREVAQ rellena las casillas con fecha <b>${fmtF(fecha)}</b>; tú revisas y pulsas <b>Guardar</b> allá.</p>
    <div id="infCensiaGuia"></div>
    ${previo ? `<p class="inf-censia__aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>Ya abriste CeNSIA con este reporte el ${previo}. En CeNSIA las capturas <b>se suman</b> (a diferencia de SIREVAQ, que reemplaza): si ya lo guardaste allá, no lo vuelvas a guardar; si cambió algo, captura en CeNSIA solo la diferencia.</p>` : ""}
    <div class="inf-censia__acciones">
      <a class="inf-censia__btn" id="infCensiaAbrir" href="${enlace}" target="_blank" rel="noopener">Abrir CeNSIA y rellenar</a>
      <button type="button" class="inf-censia__btn is-sec" id="infCensiaAyuda" aria-expanded="false" aria-controls="infCensiaPasos"${censiaExtInstalada() ? " hidden" : ""}>Prefiero no instalar nada (para personas con experiencia)</button>
    </div>
    <ol id="infCensiaPasos" class="inf-censia__pasos" hidden>
      <li>Una sola vez: arrastra <a href="#" id="infCensiaMarcador" class="inf-censia__marcador">Rellenar CeNSIA</a> a tu barra de marcadores.</li>
      <li>Pulsa «Abrir CeNSIA y rellenar», inicia sesión si te lo pide y entra a <b>Dosis Aplicadas → Captura</b>.</li>
      <li>Pulsa el marcador «Rellenar CeNSIA» (si Chrome pregunta por el portapapeles, permítelo). Revisa las cifras y pulsa GUARDAR.</li>
    </ol>`;
  box.querySelector("#infCensiaGuia").replaceWith(censiaGuiaExtension());
  container.appendChild(box);

  const marc = box.querySelector("#infCensiaMarcador");
  marc.href = "javascript:" + encodeURIComponent(`(${censiaMarcadorFn.toString()})()`);
  marc.addEventListener("click", (e) => { e.preventDefault(); showToast("Arrastra este botón a tu barra de marcadores; se usa dentro de CeNSIA.", true, "warn"); });
  const ayuda = box.querySelector("#infCensiaAyuda");
  ayuda.addEventListener("click", () => {
    const pasos = box.querySelector("#infCensiaPasos");
    pasos.hidden = !pasos.hidden;
    ayuda.setAttribute("aria-expanded", String(!pasos.hidden));
  });
  const abrir = box.querySelector("#infCensiaAbrir");
  abrir.addEventListener("click", () => {
    const token = armar();
    abrir.href = `${CENSIA_URL}#sirevaq=${encodeURIComponent(token)}`;
    // Con el complemento: el paquete se entrega directo (no depende de la dirección ni del portapapeles)
    if (censiaExtInstalada()) {
      window.postMessage({ source: "sirevaq", type: "censia-payload", payload: { v: 1, clues: USER?.clues, fecha, valores } }, location.origin);
    }
    // Respaldo para el marcador: CeNSIA borra el «#» al iniciar sesión, así que también va al portapapeles
    try { navigator.clipboard?.writeText("SIREVAQ1:" + token).catch(() => { }); } catch (e) { /* sin portapapeles */ }
    try { localStorage.setItem(clave, fmtF(influenzaHoy())); } catch (e) { /* sin almacenamiento */ }
  });
}

/** Nombre del responsable: el del reporte de la semana; si no hay, el del último reporte de la unidad o el último usado en este equipo.
 *  Lo que la persona ya escribió en esta pantalla no se pisa. */
function prellenarNombreResponsableInfluenza(reporte) {
  const inp = document.getElementById("nombreINFLUENZA");
  if (!inp || inp.dataset.tocado === "1") return;
  let nombre = String(reporte?.capturado_por || "").trim();
  if (!nombre) {
    const ult = [..._influenzaCapturasCache].filter(r => r.capturado_por).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
    nombre = String(ult?.capturado_por || "").trim();
  }
  if (!nombre) { try { nombre = localStorage.getItem(`sirevaq_inf_nombre_${USER?.clues}`) || ""; } catch (e) { /* sin almacenamiento */ } }
  if (nombre && inp.value !== nombre) { inp.value = nombre; actualizarPasosInfluenza(); }
}

function renderCaptureGrid() {
  const container = document.getElementById("influenzaCaptureGroupsContainer");
  if (!container) return;
  container.innerHTML = "";

  const selectedFecha = document.getElementById("influenza_semana").value;
  const estado = influenzaEstadoCaptura(selectedFecha);
  const capturaCerrada = !estado.abierta;
  if (capturaCerrada) {
    const cerrado = document.createElement("div");
    cerrado.className = "inf-aviso inf-aviso--cerrada";
    cerrado.innerHTML = `<span class="material-symbols-rounded">lock_clock</span><div><b>Captura cerrada.</b> ${estado.motivo} Puedes revisar la tabla, pero todavía no se puede guardar información.</div>`;
    container.appendChild(cerrado);
  }
  const nombreInp = document.getElementById("nombreINFLUENZA");
  if (nombreInp) nombreInp.disabled = capturaCerrada;
  const avisoHtml = avisoReglasSemana(selectedFecha);
  if (avisoHtml && !capturaCerrada) {
    const aviso = document.createElement("div");
    aviso.className = "flex flex-col gap-2";
    aviso.innerHTML = avisoHtml;
    container.appendChild(aviso);
  }
  const currentReport = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);
  const currentValores = currentReport ? currentReport.valores : {};
  prellenarNombreResponsableInfluenza(currentReport);

  // Acumulado previo por rubro (todo lo reportado en las demás semanas de la campaña)
  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });
  _infGrid = { acum: acumuladosPrevios, fecha: selectedFecha, cerrada: capturaCerrada };

  // Control de meta: panel que resume en vivo lo que se va a reportar contra lo disponible
  const control = document.createElement("section");
  control.id = "infControlMeta";
  control.className = "inf-ctl";
  control.setAttribute("aria-label", "Control de tu meta");
  container.appendChild(control);

  // Regla de reemplazo: cada semana lleva un solo reporte y el último guardado sustituye al anterior
  if (!capturaCerrada || currentReport) {
    const reemplazo = document.createElement("section");
    reemplazo.className = "inf-reemplazo";
    reemplazo.setAttribute("aria-label", "Cómo funciona el guardado de la semana");
    const folio = currentReport ? influenzaFolio(currentReport) : "";
    reemplazo.innerHTML = currentReport
      ? `<span class="material-symbols-rounded" aria-hidden="true">swap_horiz</span><div><b>Esta semana ya tiene un reporte guardado${folio ? ` (folio ${folio})` : ""}.</b> Si lo vuelves a guardar, <b>el nuevo reemplaza por completo al anterior</b>: no se suma. Captura siempre el <b>total de la semana</b>, no solo lo que falta.</div>`
      : `<span class="material-symbols-rounded" aria-hidden="true">info</span><div><b>Un solo reporte por semana.</b> Si hoy guardas y mañana vuelves a guardar esta misma semana, <b>el reporte de mañana reemplaza al de hoy</b>. Por eso captura siempre el <b>total de la semana</b>, no solo lo nuevo.</div>`;
    container.appendChild(reemplazo);
  }

  // Reporte ya guardado: ofrecer el paso a CeNSIA (plataforma federal)
  if (currentReport) renderPasoCensia(container, selectedFecha, currentReport);
  if (typeof renderCovidCaptura === "function") renderCovidCaptura();


  // Agrupar rubros por categoría y grupo para una presentación visual limpia y organizada
  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const groupKey = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(rb);
  });

  const chkINF = document.getElementById("chkSinMovimientoINF");
  const isSinMovActive = !!(chkINF && chkINF.checked);

  // Renderizar cada grupo en un panel/tarjeta con fondo blanco sólido
  const gruposSinMeta = [];
  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    // Un grupo donde la unidad no tiene meta en ningún renglón no se captura: va en un solo aviso al final,
    // no como una tabla entera de guiones.
    if (rubros.every(rb => !Number(_influenzaMetasCache[rb.id] || 0))) {
      gruposSinMeta.push(groupTitle);
      return;
    }
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100">
        <h4 class="text-xs font-black text-violet-900 uppercase tracking-wider m-0">${groupTitle}</h4>
      </div>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200 bg-white">
        <table class="inf-cap-tabla w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <caption class="sr-only">${groupTitle}: meta anual, acumulado, dosis de esta semana y avance por grupo de edad</caption>
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th scope="col" class="p-3">Subgrupo / Edad</th>
              <th scope="col" class="p-3 text-center">Meta Anual</th>
              <th scope="col" class="p-3 text-center">Acumulado</th>
              <th scope="col" class="p-3 text-center">Esta Semana</th>
              <th scope="col" class="p-3 text-center">Avance %</th>
            </tr>
          </thead>
          <tbody class="tbody-inputs">
          </tbody>
        </table>
      </div>
    `;

    const tbody = card.querySelector(".tbody-inputs");

    rubros.forEach(rb => {
      const meta = Number(_influenzaMetasCache[rb.id] || 0);
      const acum = acumuladosPrevios[rb.id];
      const val = isSinMovActive ? 0 : (currentValores[rb.id] !== undefined ? currentValores[rb.id] : "");
      const reglaCal = reglaDosisRubro(rb, selectedFecha);
      const isLocked = meta === 0 || isSinMovActive || !!reglaCal || capturaCerrada;

      const row = document.createElement("tr");

      const currentVal = Number(val || 0);
      const pct = meta > 0 ? Math.round(((acum + currentVal) / meta) * 100) : 0;
      const t = infTonoAvance(meta, pct);

      row.className = meta === 0 ? "inf-fila is-bloqueada" : "inf-fila";

      const rubroTxt = `${String(rb.grupo || rb.categoria || "").replace(/"/g, "&quot;")} · ${String(rb.edad || "").replace(/"/g, "&quot;")}`;
      const motivoBloqueo = meta === 0 ? "Sin meta asignada para este grupo: no se captura"
        : (capturaCerrada ? "La captura de esta semana está cerrada" : (isSinMovActive ? "Marcaste «Sin movimiento»: esta semana se guarda en ceros" : "Este grupo no se captura en esta fecha"));

      row.innerHTML = `
        <th scope="row" class="p-3 inf-fila-edad">
          <span class="${meta === 0 ? "inf-edad is-bloqueada" : "inf-edad"}">${rb.edad}</span>
          ${reglaCal ? `<span class="inf-pill-regla">${reglaCal.etiqueta}</span>` : ''}
        </th>
        <td class="p-3 text-center inf-num">${meta || '—'}</td>
        <td class="p-3 text-center inf-num inf-num--acum">${acum}</td>
        <td class="p-3 text-center">
          <input type="number" min="0" step="1" inputmode="numeric"
            id="input_inf_${rb.id}" class="inf-input"
            aria-label="${rubroTxt}: dosis aplicadas esta semana"
            ${meta > 0 ? `aria-describedby="disp_inf_${rb.id}"` : ''}
            ${isLocked ? `title="${motivoBloqueo}"` : ''}
            value="${val}"
            ${isLocked ? 'disabled placeholder="—"' : 'placeholder="0"'}
          >
        </td>
        <td class="p-3 text-center inf-col-avance">
          <span id="pct_inf_${rb.id}" class="inf-pct" data-tono="${t}">${meta > 0 ? pct + '%' : 'N/A'}</span>
          <div class="inf-barra">
            <div id="bar_inf_${rb.id}" class="inf-barra-fill" data-tono="${t}" role="progressbar" aria-label="Avance contra la meta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(pct, 100)}" style="width:${Math.min(pct, 100)}%;"></div>
          </div>
          <span id="disp_inf_${rb.id}" class="inf-disp">${meta > 0 ? `${acum + currentVal} de ${meta}` : ''}</span>
        </td>
      `;
      tbody.appendChild(row);

      // Validación y avance en vivo
      if (!isLocked) {
        const input = row.querySelector(`#input_inf_${rb.id}`);
        input.addEventListener("input", () => {
          let v = parseInt(input.value, 10) || 0;
          if (v < 0) { v = 0; input.value = 0; }
          actualizarFilaInfluenza(rb.id, v);
          actualizarControlMetaInfluenza();
        });
        if (currentVal > 0) actualizarFilaInfluenza(rb.id, currentVal);
      }
    });

    container.appendChild(card);
  });

  if (gruposSinMeta.length) {
    const det = document.createElement("details");
    det.className = "inf-sinmeta";
    det.innerHTML = `
      <summary><span class="material-symbols-rounded" aria-hidden="true">block</span>${gruposSinMeta.length === 1 ? "1 grupo sin meta" : gruposSinMeta.length + " grupos sin meta"} para tu unidad: no se capturan</summary>
      <ul>${gruposSinMeta.map(g => `<li>${g}</li>`).join("")}</ul>`;
    container.appendChild(det);
  }

  actualizarControlMetaInfluenza();
  actualizarPasosInfluenza();
  if (typeof syncCommandHub === "function") syncCommandHub();
}

// --- Guía por pasos del panel de captura ---

/** Pinta los 4 pasos (y la ayuda) según el estado real de la captura: semana, nombre, dosis y guardado con folio. */
function actualizarPasosInfluenza() {
  const box = document.getElementById("influenzaPasosGuia");
  if (!box) return;

  const fecha = document.getElementById("influenza_semana")?.value || "";
  const estado = influenzaEstadoCaptura(fecha);
  const nombre = (document.getElementById("nombreINFLUENZA")?.value || "").trim();
  const sinMov = !!document.getElementById("chkSinMovimientoINF")?.checked;
  const hayDosis = INFLUENZA_RUBROS.some(rb => Number(document.getElementById(`input_inf_${rb.id}`)?.value || 0) > 0);
  const semana = generateCampaignWeeks().find(w => w.fecha === fecha);

  const pasos = [
    { titulo: "Elige la semana", ok: !!semana,
      texto: semana ? (semana.corte ? `Corte de fin de mes · ${influenzaRangoTexto(fecha)}` : `Semana ${semana.semana} · ${influenzaRangoTexto(fecha)}`) : "Selecciona la semana que vas a reportar." },
    { titulo: "Escribe tu nombre", ok: !!nombre,
      texto: nombre ? nombre : "Quien captura queda registrado en el reporte." },
    { titulo: "Captura las dosis", ok: sinMov || hayDosis || estado.guardado,
      texto: sinMov ? "Marcaste «Sin movimiento»: se guarda en ceros."
        : (estado.guardado ? "Ya hay dosis guardadas; puedes corregirlas." : "Anota lo aplicado esta semana. Si no hubo, usa «Sin movimiento».") },
    { titulo: "Guarda y recibe tu folio", ok: estado.guardado,
      texto: estado.guardado ? `Folio ${estado.folio}` : "Con el botón azul de guardar. Cada reporte recibe un folio único." }
  ];

  let activo = estado.abierta ? pasos.findIndex(p => !p.ok) : -1;
  if (activo < 0) activo = pasos.length;

  const claseDe = (p, i) => (!estado.abierta && !p.ok) ? "is-lock" : (p.ok ? "is-done" : (i === activo ? "is-active" : ""));
  const tarjetas = pasos.map((p, i) => `
    <div class="inf-paso ${claseDe(p, i)}">
      <div class="inf-paso-num">${p.ok ? '<span class="material-symbols-rounded">check</span>' : i + 1}</div>
      <div class="inf-paso-cuerpo">
        <div class="inf-paso-titulo">${p.titulo}</div>
        <div class="inf-paso-texto">${p.texto}</div>
      </div>
    </div>`).join("");

  box.innerHTML = `
    <div class="inf-pasos-cab">
      <span>Tu reporte en 4 pasos</span>
      <button type="button" class="ayuda-btn" data-ayuda="influenza_captura" title="Cómo funciona este panel" aria-label="Cómo funciona este panel"><span class="material-symbols-rounded">help</span></button>
    </div>
    <div class="inf-pasos-grid">${tarjetas}</div>`;
}
window.actualizarPasosInfluenza = actualizarPasosInfluenza;

function updateFlaskCalculation() {
  // El cálculo y control de frascos para UNIDAD ha sido removido de su formulario.
  // La comparación y el balance se manejan ahora a nivel MUNICIPAL.
}

// Helper to highlight matching terms in text
function _highlightInfluenzaText(text, queryWords) {
  if (!text || !queryWords || !queryWords.length) return text || "";
  let escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sortedWords = [...queryWords].sort((a, b) => b.length - a.length);
  const pattern = sortedWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  if (!pattern) return escaped;
  const regex = new RegExp(`(${pattern})`, 'gi');
  return escaped.replace(regex, '<mark class="bg-violet-100 text-violet-900 rounded px-0.5 font-extrabold">$1</mark>');
}

const INF_MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function _infTotalDosis(r) {
  return Object.values(r?.valores || {}).reduce((s, v) => s + Number(v || 0), 0);
}

/** Tarjetas de resumen del historial: reportes capturados vs. esperados, dosis y avance, sin movimiento y último folio. */
function pintarResumenHistorialInfluenza() {
  const box = document.getElementById("influenzaHistorialResumen");
  if (!box) return;

  const hoy = new Date().toLocaleDateString("en-CA");
  const esperados = generateCampaignWeeks().filter(w => w.fecha <= hoy);
  const capturadas = new Set(_influenzaCapturasCache.map(r => r.fecha));
  const pendientes = esperados.filter(w => !capturadas.has(w.fecha)).length;
  const dosis = _influenzaCapturasCache.reduce((s, r) => s + _infTotalDosis(r), 0);
  const meta = Object.values(_influenzaMetasCache).reduce((s, v) => s + Number(v || 0), 0);
  const avance = meta > 0 ? Math.round((dosis / meta) * 100) : null;
  const sinMov = _influenzaCapturasCache.filter(r => r.sin_movimiento === true || r.sin_movimiento === "SI").length;
  const ultimo = [..._influenzaCapturasCache].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const L = window.InfluenzaReglas ? window.InfluenzaReglas.fechaLarga : (x) => x;

  const tarjeta = (icono, tono, etiqueta, valor, nota) => `
    <div class="inf-hist-stat">
      <div class="inf-hist-stat-ico inf-tono-${tono}"><span class="material-symbols-rounded">${icono}</span></div>
      <div class="inf-hist-stat-txt">
        <div class="inf-hist-stat-etq">${etiqueta}</div>
        <div class="inf-hist-stat-val">${valor}</div>
        <div class="inf-hist-stat-nota">${nota}</div>
      </div>
    </div>`;

  box.innerHTML = [
    tarjeta("fact_check", pendientes ? "ambar" : "verde", "Reportes capturados", `${_influenzaCapturasCache.length}<small> de ${esperados.length}</small>`,
      pendientes ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"} a la fecha` : "Al corriente"),
    tarjeta("vaccines", "violeta", "Dosis aplicadas", dosis.toLocaleString("es-MX"),
      avance === null ? "Sin meta asignada" : `${avance}% de tu meta anual`),
    tarjeta("pause_circle", "azul", "Sin movimiento", String(sinMov), sinMov === 1 ? "semana en ceros" : "semanas en ceros"),
    tarjeta("tag", "gris", "Último folio", ultimo ? `<span class="inf-hist-folio-mini">${influenzaFolio(ultimo)}</span>` : "—",
      ultimo ? `Semana del ${influenzaRangoTexto(ultimo.fecha)}` : "Aún no hay reportes")
  ].join("");
}

async function loadInfluenzaHistoryList() {
  const container = document.getElementById("influenzaHistorialList");
  if (!container) return;
  container.innerHTML = "";
  pintarResumenHistorialInfluenza();

  const searchInput = document.getElementById("influenzaHistorialSearch");
  const limitSelect = document.getElementById("influenzaHistorialLimit");
  const sortSelect = document.getElementById("influenzaHistorialSort");
  const clearBtn = document.getElementById("influenzaClearSearch");
  const filterActiveBadge = document.getElementById("influenzaHistorialFiltersActive");
  const counterEl = document.getElementById("influenzaHistorialCounter");

  const filterVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const limitVal = limitSelect ? limitSelect.value : "10";
  const sortVal = sortSelect ? sortSelect.value : "newest";

  // Bind controls listeners once
  if (searchInput && !searchInput.dataset.listened) {
    searchInput.dataset.listened = "true";
    
    searchInput.addEventListener("input", () => {
      if (clearBtn) {
        if (searchInput.value) {
          clearBtn.style.display = "flex";
          clearBtn.classList.remove("hidden");
        } else {
          clearBtn.style.display = "none";
          clearBtn.classList.add("hidden");
        }
      }
      if (filterActiveBadge) {
        if (searchInput.value.trim()) {
          filterActiveBadge.style.display = "flex";
          filterActiveBadge.classList.remove("hidden");
        } else {
          filterActiveBadge.style.display = "none";
          filterActiveBadge.classList.add("hidden");
        }
      }
      loadInfluenzaHistoryList();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        clearBtn.classList.add("hidden");
        if (filterActiveBadge) {
          filterActiveBadge.style.display = "none";
          filterActiveBadge.classList.add("hidden");
        }
        loadInfluenzaHistoryList();
      });
    }

    if (limitSelect) {
      limitSelect.addEventListener("change", () => loadInfluenzaHistoryList());
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => loadInfluenzaHistoryList());
    }
  }

  if (!_influenzaCapturasCache.length) {
    container.innerHTML = `<div class="text-sm text-slate-400 font-medium p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">No se han registrado reportes aún.</div>`;
    if (counterEl) counterEl.textContent = "Mostrando 0 de 0 reportes";
    return;
  }

  const queryWords = filterVal.split(/\s+/).filter(Boolean);

  const monthsEs = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  // Map and calculate stats for all items
  const processedReports = _influenzaCapturasCache.map(r => {
    let totalDosis = 0;
    if (r.valores) {
      Object.values(r.valores).forEach(v => totalDosis += Number(v || 0));
    }

    const folio = influenzaFolio(r);
    
    // Construct friendly Spanish date representation for smart search
    let friendlyDate = "";
    if (r.fecha) {
      const parts = r.fecha.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        if (m >= 0 && m < 12) {
          friendlyDate = `${influenzaRangoTexto(r.fecha)} ${monthsEs[m]} ${y}`;
        }
      }
    }

    return {
      original: r,
      totalDosis,
      folio,
      friendlyDate,
      searchText: `${folio} ${r.fecha} ${friendlyDate} ${(r.capturado_por || '').toLowerCase()} ${totalDosis}`.toLowerCase()
    };
  });

  // Filter based on smart keywords
  const filtered = processedReports.filter(p => {
    if (!queryWords.length) return true;
    return queryWords.every(word => p.searchText.includes(word));
  });

  // Sort based on sortVal
  filtered.sort((a, b) => {
    if (sortVal === "newest") {
      return b.original.fecha.localeCompare(a.original.fecha);
    } else if (sortVal === "oldest") {
      return a.original.fecha.localeCompare(b.original.fecha);
    } else if (sortVal === "doses-desc") {
      return b.totalDosis - a.totalDosis;
    } else if (sortVal === "doses-asc") {
      return a.totalDosis - b.totalDosis;
    }
    return 0;
  });

  const totalMatches = filtered.length;
  const totalCached = _influenzaCapturasCache.length;

  // Apply visual limit
  let displayCount = totalMatches;
  let itemsToDisplay = filtered;
  if (limitVal !== "all") {
    const limitInt = parseInt(limitVal) || 10;
    itemsToDisplay = filtered.slice(0, limitInt);
    displayCount = itemsToDisplay.length;
  }

  // Update statistics label
  if (counterEl) {
    if (filterVal) {
      counterEl.textContent = `Mostrando ${displayCount} de ${totalMatches} encontrados (Total: ${totalCached})`;
    } else {
      counterEl.textContent = `Mostrando ${displayCount} de ${totalCached} reportes`;
    }
  }

  if (!itemsToDisplay.length) {
    container.innerHTML = `<div class="text-sm text-slate-400 font-medium p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">No se encontraron reportes que coincidan con la búsqueda.</div>`;
    return;
  }

  const metaTotal = Object.values(_influenzaMetasCache).reduce((acc, v) => acc + Number(v || 0), 0);
  const corteDe = (f) => influenzaEsCorte(f);

  itemsToDisplay.forEach(p => {
    const r = p.original;
    const sinMov = r.sin_movimiento === true || r.sin_movimiento === "SI";
    const [yy, mm, dd] = r.fecha.split("-").map(Number);
    const semana = generateCampaignWeeks().find(w => w.fecha === r.fecha);
    const pct = metaTotal > 0 ? Math.min(100, Math.round((p.totalDosis / metaTotal) * 100)) : 0;
    const folioFormatted = _highlightInfluenzaText(p.folio, queryWords);
    const capturadoFormatted = _highlightInfluenzaText(r.capturado_por || "Desconocido", queryWords);
    const fechaFormatted = _highlightInfluenzaText(r.fecha, queryWords);
    const inicial = String(r.capturado_por || "?").trim().charAt(0).toUpperCase() || "?";
    const actualizado = r.updated_at ? new Date(r.updated_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    const ediciones = Array.isArray(r.historial_ediciones) ? Math.max(0, r.historial_ediciones.length - 1) : 0;

    const estado = sinMov
      ? `<span class="inf-chip inf-chip--azul"><span class="material-symbols-rounded">pause_circle</span>Sin movimiento</span>`
      : `<span class="inf-chip inf-chip--verde"><span class="material-symbols-rounded">check_circle</span>Capturado</span>`;
    const tipo = corteDe(r.fecha) ? `<span class="inf-chip inf-chip--ambar"><span class="material-symbols-rounded">event_available</span>Corte de fin de mes</span>` : "";

    const card = document.createElement("div");
    card.className = "inf-hist-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <div class="inf-hist-fecha">
        <span class="inf-hist-mes">Sem</span>
        <span class="inf-hist-dia">${semana ? semana.semana : "·"}</span>
        <span class="inf-hist-anio">${yy}</span>
      </div>
      <div class="inf-hist-cuerpo">
        <div class="inf-hist-top">
          <span class="inf-hist-folio">${folioFormatted}</span>
          ${estado}${tipo}
        </div>
        <div class="inf-hist-titulo">${semana ? `Semana ${semana.semana}` : "Semana"} <span>· ${influenzaRangoTexto(r.fecha)} ${yy}</span></div>
        <div class="inf-hist-meta">
          <span class="inf-hist-resp"><span class="inf-hist-avatar">${inicial}</span>${capturadoFormatted}</span>
          ${actualizado ? `<span><span class="material-symbols-rounded">schedule</span>Guardado ${actualizado}</span>` : ""}
          ${ediciones ? `<span><span class="material-symbols-rounded">edit_note</span>${ediciones} edici${ediciones === 1 ? "ón" : "ones"}</span>` : ""}
        </div>
      </div>
      <div class="inf-hist-dosis">
        <div class="inf-hist-dosis-num">${p.totalDosis.toLocaleString("es-MX")}</div>
        <div class="inf-hist-dosis-etq">dosis</div>
        <div class="inf-hist-barra" title="${pct}% de tu meta anual"><span style="width:${pct}%"></span></div>
      </div>
      <div class="inf-hist-accion"><span class="material-symbols-rounded">chevron_right</span></div>
    `;
    const abrir = () => {
      document.getElementById("influenza_semana").value = r.fecha;
      document.getElementById("influenza_semana").dispatchEvent(new Event("change"));
      // Cambiar automáticamente a la pestaña de captura
      document.getElementById("subtabUnitCaptura").click();
      showToast(`Reporte con folio ${p.folio} cargado para edición/consulta.`, true, "info");
    };
    card.onclick = abrir;
    card.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    container.appendChild(card);
  });
}

/**
 * Semana de captura de la unidad. El reporte se fecha el viernes, pero la semana es la ISO (lunes a domingo): el
 * panel abre el lunes y se puede capturar cualquier día; sábado y domingo cuentan para el viernes de esa misma
 * semana. Sigue habiendo UN solo reporte por semana, sin importar el día en que se capture.
 * null = se puede capturar. Lo mismo lo exige el trigger influenza_trg_ventana_captura en la base.
 */
function influenzaVentanaError(fecha) {
  const ini = _campaignConfig.fecha_inicio, fin = _campaignConfig.fecha_fin;
  if (!ini || !fin || !fecha) return null;
  const hoy = influenzaHoy();
  const L = window.InfluenzaReglas ? window.InfluenzaReglas.fechaLarga : (x) => x;
  if (hoy < ini) return `La campaña de Influenza inicia el ${L(ini)}. Aún no se pueden capturar reportes.`;
  if (fecha < ini || fecha > fin) return `La semana del ${influenzaRangoTexto(fecha)} queda fuera de la campaña (${L(ini)} al ${L(fin)}).`;
  const abre = influenzaSemanaAbre(fecha);
  if (hoy < abre) return `La semana del ${influenzaRangoTexto(fecha)} aún no se puede capturar: se abre el ${influenzaDiaCorto(abre)}.`;
  return null;
}
window.influenzaVentanaError = influenzaVentanaError;

/** Hoy en la fecha local de la unidad (AAAA-MM-DD); toISOString daría el día siguiente después de las 6 pm. */
function influenzaHoy() {
  return new Date().toLocaleDateString("en-CA");
}

/** Rango que cubre el reporte de `fecha` (la semana, o su parte si hay corte de mes), p. ej. «12 al 18 oct». */
function influenzaRangoTexto(fecha, ini, fin) {
  const R = window.InfluenzaReglas;
  if (!R || !fecha) return fecha || "";
  const r = R.rangoSemana(fecha, ini || _campaignConfig.fecha_inicio, fin || _campaignConfig.fecha_fin);
  return R.textoRango(r.desde, r.hasta);
}
window.influenzaRangoTexto = influenzaRangoTexto;

function influenzaFechaCorta(ymd) {
  return window.InfluenzaReglas ? window.InfluenzaReglas.fechaCorta(ymd) : ymd;
}

function influenzaDiaCorto(ymd) {
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dow = window.InfluenzaReglas ? window.InfluenzaReglas.diaSemana(ymd) : 0;
  return `${dias[dow]} ${influenzaFechaCorta(ymd)}`;
}

function influenzaSumaDias(ymd, n) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function influenzaDiaAnterior(ymd) {
  return influenzaSumaDias(ymd, -1);
}

/** Lunes de la semana (lunes a domingo) que contiene `ymd`. */
function influenzaLunesDe(ymd) {
  const dow = window.InfluenzaReglas ? window.InfluenzaReglas.diaSemana(ymd) : 1;
  return influenzaSumaDias(ymd, -((dow + 6) % 7));
}

/**
 * Primer día en que se puede capturar la semana de `fecha`: el lunes de esa semana (o el inicio de la campaña si es
 * después). El viernes que sigue a un corte de fin de mes entre semana abre al día siguiente del corte, porque los
 * días anteriores ya forman parte del reporte del corte.
 */
function influenzaSemanaAbre(fecha) {
  const ini = _campaignConfig.fecha_inicio;
  const lunes = influenzaLunesDe(fecha);
  let abre = lunes;
  if (!influenzaEsCorte(fecha) && window.InfluenzaReglas) {
    const previos = window.InfluenzaReglas.cortes(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin)
      .filter(c => c >= lunes && c < fecha);
    if (previos.length) abre = influenzaSumaDias(previos[previos.length - 1], 1);
  }
  return ini && ini > abre ? ini : abre;
}

/**
 * Semana que se muestra al entrar: la más reciente que ya abrió (sábado y domingo siguen en la semana que corre).
 * Antes de que abra la campaña, la primera.
 */
function influenzaSemanaPredeterminada(weeks) {
  weeks = weeks || generateCampaignWeeks();
  if (!weeks.length) return "";
  const hoy = influenzaHoy();
  const abiertas = weeks.filter(w => influenzaSemanaAbre(w.fecha) <= hoy);
  return (abiertas.length ? abiertas[abiertas.length - 1] : weeks[0]).fecha;
}
window.influenzaSemanaPredeterminada = influenzaSemanaPredeterminada;

/** true si `fecha` es un corte de fin de mes entre semana (no un viernes de corte). */
function influenzaEsCorte(fecha) {
  return !!(window.InfluenzaReglas && window.InfluenzaReglas.cortes(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin).includes(fecha));
}

/** Folio del reporte: el que asigna la base (columna folio); si aún no existe, el mismo formato derivado del id. */
function influenzaFolio(r) {
  if (!r) return "";
  if (r.folio) return r.folio;
  const shortId = r.id ? String(r.id).substring(0, 8).toUpperCase() : "TEMP";
  return `INF-${String(r.fecha || "").replace(/-/g, "")}-${shortId}`;
}
window.influenzaFolio = influenzaFolio;

/**
 * Estado de la captura de la semana elegida: abierta (se puede guardar) o cerrada con su motivo, y si ya hay
 * reporte guardado (con su folio). Lo usan el panel, los pasos y el botón flotante de Guardar.
 */
function influenzaEstadoCaptura(fecha) {
  fecha = fecha || document.getElementById("influenza_semana")?.value;
  const reporte = _influenzaCapturasCache.find(r => r.fecha === fecha) || null;
  const motivo = influenzaVentanaError(fecha);
  return { abierta: !motivo, motivo, reporte, guardado: !!reporte, folio: reporte ? influenzaFolio(reporte) : "" };
}
window.influenzaEstadoCaptura = influenzaEstadoCaptura;

/**
 * Lee la tabla y valida el reporte de la semana contra la meta de la unidad y las reglas de calendario:
 * sin meta no se captura, 2ª/1ª dosis según la campaña y ningún grupo puede rebasar su meta con lo ya acumulado.
 * Solo cuenta lo NUEVO: un valor ya guardado antes de la regla (o antes de que bajara la meta) no bloquea el reporte.
 * Devuelve { error, valores, isSinMov }; error = null si se puede guardar. Lo usan el guardado normal y el offline.
 */
function influenzaValidarCaptura(selectedFecha) {
  const isSinMov = document.getElementById("chkSinMovimientoINF")?.checked || false;
  const valores = {};
  let reglaError = null;
  let excedeRubro = "";
  const reporteActual = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);

  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`input_inf_${rb.id}`);
    const val = isSinMov ? 0 : Math.max(0, input ? parseInt(input.value, 10) || 0 : 0);
    valores[rb.id] = val;
    if (isSinMov) continue;

    const previo = Number(reporteActual?.valores?.[rb.id] || 0);
    const meta = Number(_influenzaMetasCache[rb.id] || 0);
    if (val > previo) {
      if (!meta) reglaError = reglaError || `${rb.grupo} ${rb.edad}: la unidad no tiene meta asignada en este rubro.`;
      const cal = reglaDosisRubro(rb, selectedFecha);
      if (cal) reglaError = reglaError || `${rb.grupo} ${rb.edad}: ${cal.texto}`;

      let acum = 0;
      _influenzaCapturasCache.forEach(r => {
        if (r.fecha !== selectedFecha) acum += Number(r.valores[rb.id] || 0);
      });
      if (meta > 0 && acum + val > meta && !excedeRubro) excedeRubro = `${rb.grupo} ${rb.edad}`;
    }
  }

  let error = reglaError;
  // Un reporte en ceros solo se guarda con «Sin movimiento»: así queda claro que no es un olvido.
  if (!error && !isSinMov && Object.values(valores).every(v => v === 0)) {
    error = "No hay dosis capturadas. Si esta semana no hubo aplicaciones, marca «Sin movimiento» para guardar el reporte en ceros.";
  }
  if (!error && excedeRubro) error = `No se puede guardar el reporte: ${excedeRubro} supera la meta asignada de tu unidad. Revisa los grupos marcados en rojo.`;
  if (!error) error = influenzaVentanaError(selectedFecha);
  return { error, valores, isSinMov };
}
window.influenzaValidarCaptura = influenzaValidarCaptura;

async function saveInfluenzaReport() {
  if (typeof _capturaVacuna !== "undefined" && _capturaVacuna === "COVID") return guardarCovidDesdePanel();
  const selectedFecha = document.getElementById("influenza_semana").value;
  const nombre = document.getElementById("nombreINFLUENZA").value.trim();
  const campana = document.getElementById("influenza_campana").value;

  const cierre = influenzaEstadoCaptura(selectedFecha);
  if (!cierre.abierta) {
    showToast(cierre.motivo, false, "bad");
    return;
  }

  if (!nombre) {
    showToast("Por favor ingresa el nombre de quien reporta la captura.", false, "bad");
    return;
  }

  const validacion = influenzaValidarCaptura(selectedFecha);
  if (validacion.error) {
    showToast(validacion.error, false, "bad");
    return;
  }
  const { isSinMov, valores } = validacion;

  const payload = {
    clues: USER.clues,
    unidad: USER.unidad,
    municipio: USER.municipio,
    fecha: selectedFecha,
    anio_campana: campana,
    valores,
    capturado_por: nombre,
    editado_por: "UNIDAD",
    sin_movimiento: isSinMov
  };

  const totalDosisEstaSemana = Object.values(valores).reduce((s, v) => s + Number(v || 0), 0);
  const rubrosCapturados = Object.values(valores).filter(v => Number(v) > 0).length;
  const metaTotal = Object.values(_influenzaMetasCache).reduce((s, v) => s + Number(v || 0), 0);
  
  // Acumulado general antes de este reporte
  const acumPrevio = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumPrevio[rb.id] = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) acumPrevio[rb.id] += Number(r.valores[rb.id] || 0);
    });
  });
  const totalAcumPrevio = Object.values(acumPrevio).reduce((s, v) => s + v, 0);
  const totalConNuevo = totalAcumPrevio + totalDosisEstaSemana;
  const avanceGlobal = metaTotal > 0 ? Math.round((totalConNuevo / metaTotal) * 100) : 0;

  const runCaptureMsg = isSinMov ? "Registrando sin movimiento..." : "Registrando reporte semanal de Influenza...";
  const runCaptureSuccess = isSinMov ? "✅ Sin movimiento de Influenza registrado" : `✅ Reporte guardado · ${totalDosisEstaSemana} dosis esta semana · Avance global: ${avanceGlobal}%`;
  const runCaptureEventMsg = isSinMov ? `Captura semana ${selectedFecha} marcada Sin Movimiento.` : `Captura semana ${selectedFecha}: ${totalDosisEstaSemana} dosis en ${rubrosCapturados} rubros. Avance acumulado: ${avanceGlobal}%.`;

  await AppService.runCapture({
    btnId: "btnSaveINFLUENZA",
    title: "Guardando reporte",
    msg: runCaptureMsg,
    successMsg: runCaptureSuccess,
    eventTitle: "Influenza",
    eventMsg: runCaptureEventMsg,
    action: async () => {
      const res = await AppService.call("saveinfluenza_captura", payload);
      _infSinMovReabierto = null;
      try { localStorage.setItem(`sirevaq_inf_nombre_${USER?.clues}`, nombre); } catch (e) { /* sin almacenamiento */ }
      await loadInfluenzaUnitData();
      const folioGuardado = res?.folio || influenzaFolio(_influenzaCapturasCache.find(r => r.fecha === selectedFecha));
      if (folioGuardado) showToast(`Folio del reporte: ${folioGuardado}`, true, "info");
      updateInfluenzaWeekBtnLabel(selectedFecha);
      updateInfluenzaSinMovimientoUI();
      renderCaptureGrid();
      loadInfluenzaHistoryList();
      const sinMovimientoVisual = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof confetti === 'function' && !sinMovimientoVisual) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      return res;
    }
  });
}


// --- LÓGICA DE ADMINISTRACIÓN Y MUNICIPIOS ---

async function refreshInfluenzaAdminPanel() {
  // Manejador de subpestañas
  initInfluenzaSubtabs();
  vacunaPintarSelectores();   // respeta la vacuna elegida: con COVID-19 solo Metas y Frascos

  // Cargar configuración de fechas
  await loadCampaignConfig();

  const metaCampSelect = document.getElementById("metaCampaignSelect");
  if (metaCampSelect) {
    metaCampSelect.removeEventListener("change", handleMetaCampaignSelectChange);
    metaCampSelect.addEventListener("change", handleMetaCampaignSelectChange);
  }

  // Cargar metas de la campaña y catálogo de unidades
  await loadInfluenzaAdminData();

  // Poblar Filtros
  await populateInfluenzaAdminFilters();

  // Renderizar la sección activa
  renderActiveAdminSection();
}

function initInfluenzaSubtabs() {
  const tabs = ["subtabInfluenzaAvances", "subtabInfluenzaValidacion", "subtabInfluenzaConciliacion", "subtabCovidAvance", "subtabInfluenzaMetas", "subtabInfluenzaFrascos", "subtabInfluenzaConfig"];
  
  // Inicializar estado de visibilidad
  tabs.forEach(t => {
    const el = document.getElementById(t);
    const targetSec = t.replace("subtab", "sec");
    if (el && targetSec) {
      const secEl = document.getElementById(targetSec);
      if (secEl) {
        if (el.classList.contains("active")) {
          secEl.style.setProperty("display", "flex", "important");
        } else {
          secEl.style.setProperty("display", "none", "important");
        }
      }
    }
  });

  // Semántica de pestañas para lectores de pantalla (el estado activo ya no es solo visual)
  const contTabs = document.getElementById("influenzaAdminTabsContainer");
  if (contTabs) {
    contTabs.setAttribute("role", "tablist");
    contTabs.setAttribute("aria-label", "Secciones de Temporada invernal");
  }
  const syncAriaTabs = () => {
    tabs.forEach(x => {
      const b = document.getElementById(x);
      if (!b) return;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false");
      b.setAttribute("aria-controls", x.replace("subtab", "sec"));
      b.tabIndex = b.classList.contains("active") ? 0 : -1;
      b.querySelectorAll(".material-symbols-rounded").forEach(i => i.setAttribute("aria-hidden", "true"));
      const panel = document.getElementById(x.replace("subtab", "sec"));
      if (panel) {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", x);
      }
    });
  };
  syncAriaTabs();
  if (contTabs && window.MutationObserver && !contTabs.dataset.ariaObs) {
    contTabs.dataset.ariaObs = "1";
    new MutationObserver(syncAriaTabs).observe(contTabs, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      // Flechas izquierda/derecha, Inicio y Fin entre pestañas visibles
      el.addEventListener("keydown", (ev) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
        const visibles = tabs.map(x => document.getElementById(x)).filter(b => b && b.offsetParent !== null);
        const i = visibles.indexOf(el);
        if (i < 0) return;
        let j = i;
        if (ev.key === "ArrowRight") j = (i + 1) % visibles.length;
        if (ev.key === "ArrowLeft") j = (i - 1 + visibles.length) % visibles.length;
        if (ev.key === "Home") j = 0;
        if (ev.key === "End") j = visibles.length - 1;
        ev.preventDefault();
        visibles[j].focus();
        visibles[j].click();
      });
      el.onclick = () => {
        tabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");
        syncAriaTabs();

        // Ocultar todas las secciones
        const sections = ["secInfluenzaAvances", "secInfluenzaValidacion", "secInfluenzaConciliacion", "secCovidAvance", "secInfluenzaMetas", "secInfluenzaFrascos", "secInfluenzaConfig"];
        sections.forEach(s => {
          const sec = document.getElementById(s);
          if (sec) sec.style.setProperty("display", "none", "important");
        });

        const targetSec = t.replace("subtab", "sec");
        const secEl = document.getElementById(targetSec);
        if (secEl) secEl.style.setProperty("display", "flex", "important");

        if (typeof syncTabGroupIndicator === 'function') {
          syncTabGroupIndicator('#influenzaAdminTabsContainer');
        }

        renderActiveAdminSection();
      };
    }
  });

  // Inicializar indicador
  setTimeout(() => {
    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator('#influenzaAdminTabsContainer');
    }
  }, 150);
}

let _adminMetasArray = [];
let _adminCapturasArray = [];
let _adminFrascosArray = [];
// Lotes reales por unidad y entrega: los asigna Requisiciones (solo lectura aquí).
let _adminLotesEntregas = [];
let _allUnidades = [];

// ─── Vacuna activa en Distribución de Metas y Control de Frascos ───────────────────────────────────────────
// INFLUENZA usa las tablas y rubros de siempre. COVID usa covid_metas / covid_remesas /
// covid_distribucion_frascos (supabase/covid_metas_frascos.sql) con sus 6 rubros, y los frascos se reparten
// por MARCA (Moderna 5 dosis, Pfizer 6): remesasVista()/frascosVista() ya traen solo la marca elegida.
let _vacuna = "INFLUENZA";          // "INFLUENZA" | "COVID"
let _marcaCovid = "MODERNA";        // "MODERNA" | "PFIZER"
let _covidMetasArray = [];
let _covidRemesasAll = [];
let _covidFrascosAll = [];
let _covidLotesAll = [];   // lotes reales por marca/unidad/entrega (los asigna Requisiciones)

function esCovid() { return _vacuna === "COVID"; }
// Factor de pérdida de COVID (dosis de 0.5 mL, fila JURISDICCION de covid_metas): sube lo que se debe RECIBIR
// en cada destino/unidad en la misma proporción; no cambia la meta de aplicación.
function covidFactor() {
  const rec = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
  return CovidFrascos.factorPerdida((rec && rec.metas) || {});
}
function rubrosMetas() { return esCovid() ? CovidFrascos.RUBROS : INFLUENZA_RUBROS; }
function metasVista() { return esCovid() ? _covidMetasArray : _adminMetasArray; }
function remesasVista() { return esCovid() ? _covidRemesasAll.filter(r => r.marca === _marcaCovid) : _adminRemesasArray; }
function frascosVista() { return esCovid() ? _covidFrascosAll.filter(d => d.marca === _marcaCovid) : _adminFrascosArray; }
function lotesVista() { return esCovid() ? _covidLotesAll.filter(l => l.marca === _marcaCovid) : _adminLotesEntregas; }
function dosisFrasco() { return esCovid() ? CovidFrascos.dosisPorFrasco(_marcaCovid) : DOSIS_POR_FRASCO; }
function vacunaEtiqueta() {
  return esCovid() ? `COVID-19 ${_marcaCovid === "PFIZER" ? "Pfizer" : "Moderna"}` : "influenza";
}
// Cada rubro de COVID pediátrico (0.25 mL) cuenta la mitad de una dosis de 0.5 mL.
function metaPesoRubro(rbId) { return esCovid() && (rbId === "c1" || rbId === "c2") ? 0.5 : 1; }

async function loadInfluenzaAdminData() {
  try {
    const campana = document.getElementById("metaCampaignSelect").value;
    
    // 1. Cargar metas
    const resMetas = await AppService.call("getinfluenza_metas", { anio_campana: campana });
    _adminMetasArray = resMetas.data || [];

    // 2. Cargar capturas
    const resCapturas = await AppService.call("getinfluenza_capturas", { anio_campana: campana });
    _adminCapturasArray = resCapturas.data || [];

    // 3. Cargar catálogo de unidades
    const { data: units } = await window.supabase.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
    _allUnidades = units || [];

    // 4. Cargar entregas de frascos
    const resFrascos = await AppService.call("getinfluenza_distribucion", { anio_campana: campana });
    _adminFrascosArray = resFrascos.data || [];

    // 5. Entregas (remesas) repartidas por Jurisdicción
    const resRemesas = await AppService.call("getinfluenza_remesas", { anio_campana: campana });
    _adminRemesasArray = resRemesas.data || [];

    // 5b. COVID-19 (solo cuando es la vacuna elegida; ver loadCovidAdminData)
    if (esCovid()) await loadCovidAdminData(campana);

    // 6. Lotes asignados en Requisiciones (si falla no impide repartir: solo no se muestran)
    try {
      const resLotes = await AppService.call("getinfluenza_lotes_entregas", { anio_campana: campana }, { silent: true });
      _adminLotesEntregas = resLotes.data || [];
    } catch (e) {
      _adminLotesEntregas = [];
    }
  } catch (err) {
    console.error("Error al cargar datos administrativos de Influenza:", err);
  }
}

async function loadCovidAdminData(campana) {
  const camp = campana || document.getElementById("metaCampaignSelect")?.value || "";
  try {
    const [m, d, r] = await Promise.all([
      AppService.call("getcovid_metas", { anio_campana: camp }),
      AppService.call("getcovid_distribucion", { anio_campana: camp }),
      AppService.call("getcovid_remesas", { anio_campana: camp })
    ]);
    _covidMetasArray = m.data || [];
    if (typeof _covidAvance !== "undefined") _covidAvance.cargado = false;   // el Avance se vuelve a pedir al SIS
    _covidFrascosAll = d.data || [];
    _covidRemesasAll = r.data || [];
    try {
      const l = await AppService.call("getcovid_lotes_entregas", { anio_campana: camp }, { silent: true });
      _covidLotesAll = l.data || [];
    } catch (eLotes) {
      _covidLotesAll = [];
    }
  } catch (err) {
    console.error("Error al cargar datos de COVID-19:", err);
    _covidMetasArray = []; _covidFrascosAll = []; _covidRemesasAll = [];
    showToast("No se pudieron cargar los datos de COVID-19.", false, "bad");
  }
}

// Cambia de vacuna (o de marca de COVID) en Distribución de Metas y Control de Frascos.
async function vacunaElegir(vacuna, marca) {
  const cambioVacuna = vacuna !== _vacuna;
  _vacuna = vacuna;
  if (marca) _marcaCovid = marca;
  _remesaState = { numero: null, fijos: {}, editados: new Set(), tocados: new Set() };
  _muniRepartoState = { numero: null, fijos: {}, editados: new Set(), tocados: new Set() };
  const perdidaInp = document.getElementById("covidPerdidaInput");
  if (perdidaInp) delete perdidaInp.dataset.sucio;
  if (esCovid() && cambioVacuna) await loadCovidAdminData();
  vacunaPintarSelectores();
  renderActiveAdminSection();
}

function vacunaPintarSelectores() {
  document.querySelectorAll(".vac-seg").forEach(seg => {
    seg.querySelectorAll("[data-vac]").forEach(b => {
      const on = b.dataset.vac === _vacuna;
      b.classList.toggle("activo", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (!b.dataset.bound) {
        b.dataset.bound = "1";
        b.addEventListener("click", () => vacunaElegir(b.dataset.vac));
      }
    });
  });
  ["frascosBatchTbody", "remesaTbody"].forEach(id => {
    const t = document.getElementById(id) && document.getElementById(id).closest("table");
    if (t) { t.dataset.vac = esCovid() ? "COVID" : "INFLUENZA"; t.dataset.marca = _marcaCovid; }
  });
  const barraMarca = document.getElementById("frascosMarcaBar");
  if (barraMarca) barraMarca.style.display = esCovid() ? "" : "none";
  const botonesMarca = [...document.querySelectorAll(".marca-btn")];
  botonesMarca.forEach(b => {
    const on = b.dataset.marca === _marcaCovid;
    b.classList.toggle("activo", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    if (!b.dataset.bound) {
      b.dataset.bound = "1";
      b.addEventListener("click", () => vacunaElegir("COVID", b.dataset.marca));
      // radiogroup: las flechas cambian de marca
      b.addEventListener("keydown", (ev) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
        ev.preventDefault();
        const otro = botonesMarca.find(x => x !== b);
        if (otro) { otro.focus(); vacunaElegir("COVID", otro.dataset.marca); }
      });
    }
  });
  document.querySelectorAll(".vac-marca").forEach(sel => {
    sel.value = _marcaCovid;
    if (!sel.dataset.bound) {
      sel.dataset.bound = "1";
      sel.addEventListener("change", () => vacunaElegir("COVID", sel.value));
    }
  });
  ["#frascosJurisPanel thead th:nth-child(2)", "#influenzaFrascosDeliveryForm thead th:nth-child(2)"].forEach(sel => {
    const th = document.querySelector(sel);
    if (th) th.textContent = esCovid() ? "Meta + pérdida (dosis)" : "Meta (dosis)";
  });
  const nota = document.getElementById("frascosVacunaNota");
  if (nota) {
    nota.style.display = esCovid() ? "" : "none";
    nota.innerHTML = _marcaCovid === "PFIZER"
      ? "<b>COVID-19 · Pfizer</b>: solo adultos (0.5 mL); 1 frasco = 6 dosis. Se reparte en proporción a la meta de adultos (5-59 años con riesgo, 60+, embarazadas y personal de salud)."
      : "<b>COVID-19 · Moderna</b>: pediátrica (0.25 mL) y adulto (0.5 mL); 1 frasco = 5 dosis de 0.5 mL (las pediátricas de 0.25 mL cuentan la mitad). Lo entregado de Pfizer también descuenta de la misma meta.";
  }
  temporadaAplicarVacuna();
}

// Subpestañas que solo existen para Influenza (captura semanal, validación, conciliación con el CSV y fechas de
// campaña). Con COVID-19 el panel muestra únicamente lo suyo: Distribución de Metas y Control de Frascos.
const TEMPORADA_SOLO_INFLUENZA = ["subtabInfluenzaAvances", "subtabInfluenzaValidacion", "subtabInfluenzaConciliacion", "subtabInfluenzaConfig"];
function temporadaAplicarVacuna() {
  TEMPORADA_SOLO_INFLUENZA.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("tinv-oculta", esCovid());
  });
  const avanceCovid = document.getElementById("subtabCovidAvance");
  if (avanceCovid) avanceCovid.classList.toggle("tinv-oculta", !esCovid());
  // Si estaba en una subpestaña que la vacuna elegida no tiene, pasa a su primera (Avance COVID-19 / Concentrado).
  if (esCovid() && TEMPORADA_SOLO_INFLUENZA.some(id => document.getElementById(id)?.classList.contains("active"))) {
    const destino = document.getElementById("subtabCovidAvance") || document.getElementById("subtabInfluenzaMetas");
    if (destino) destino.click();
  } else if (!esCovid() && avanceCovid && avanceCovid.classList.contains("active")) {
    const av = document.getElementById("subtabInfluenzaAvances");
    if (av) av.click();
  }
  if (typeof syncTabGroupIndicator === "function" && document.getElementById("influenzaAdminTabsContainer")) {
    syncTabGroupIndicator("#influenzaAdminTabsContainer");
  }
}

async function populateInfluenzaAdminFilters() {
  const muniSelect = document.getElementById("adminInfluenzaMuni");
  const semInicioSelect = document.getElementById("adminInfluenzaSemanaInicio");
  const semFinSelect = document.getElementById("adminInfluenzaSemanaFin");

  if (!muniSelect) return;

  const role = USER.rol.toUpperCase();
  const allowedMunis = USER.municipiosAllowed || [USER.municipio];

  const scopeBox = document.getElementById("adminInfluenzaExportScopeBox");
  if (scopeBox) {
    if (role === "ADMIN" || role === "JURISDICCIONAL") {
      scopeBox.style.setProperty("display", "block", "important");
    } else {
      scopeBox.style.setProperty("display", "none", "important");
    }
  }

  // Municipios
  let munis = ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"];
  if (role === "MUNICIPAL") {
    munis = munis.filter(m => allowedMunis.includes(m.toUpperCase()));
  }

  muniSelect.innerHTML = munis.map(m => `<option value="${m}">${m === "MARQUES" ? "EL MARQUÉS" : m}</option>`).join("");
  muniSelect.removeEventListener("change", updateCluesFilterAndRender);
  muniSelect.addEventListener("change", updateCluesFilterAndRender);

  // Semanas
  const weeks = generateCampaignWeeks();
  const optionsHtml = weeks.map(w => `<option value="${w.fecha}">${w.label}</option>`).join("");

  if (semInicioSelect && semFinSelect) {
    semInicioSelect.innerHTML = optionsHtml;
    semFinSelect.innerHTML = optionsHtml;

    if (weeks.length > 0) {
      semInicioSelect.value = weeks[0].fecha;
      semFinSelect.value = weeks[weeks.length - 1].fecha;
    }

    semInicioSelect.removeEventListener("change", renderAvancesAndConcentrados);
    semInicioSelect.addEventListener("change", renderAvancesAndConcentrados);
    semFinSelect.removeEventListener("change", renderAvancesAndConcentrados);
    semFinSelect.addEventListener("change", renderAvancesAndConcentrados);
  }

  await updateCluesFilterAndRender();
}

async function updateCluesFilterAndRender() {
  const muniVal = document.getElementById("adminInfluenzaMuni").value;
  const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muniVal.toUpperCase());
  
  // Rellenar selectores de validación y conciliación
  const valCluesSelect = document.getElementById("validationInfluenzaClues");
  if (valCluesSelect) {
    valCluesSelect.innerHTML = units.map(u => `<option value="${u.clues}">${u.unidad} (${u.clues})</option>`).join("");
  }

  const concCluesSelect = document.getElementById("conciliacionClues");
  if (concCluesSelect) {
    concCluesSelect.innerHTML = units.map(u => `<option value="${u.clues}">${u.unidad} (${u.clues})</option>`).join("");
  }

  renderAvancesAndConcentrados();
}

function renderActiveAdminSection() {
  const advancesTab = document.getElementById("subtabInfluenzaAvances");
  const validationTab = document.getElementById("subtabInfluenzaValidacion");
  const conciliacionTab = document.getElementById("subtabInfluenzaConciliacion");
  const metasTab = document.getElementById("subtabInfluenzaMetas");
  const frascosTab = document.getElementById("subtabInfluenzaFrascos");
  const configTab = document.getElementById("subtabInfluenzaConfig");
  const covidAvanceTab = document.getElementById("subtabCovidAvance");

  if (covidAvanceTab && covidAvanceTab.classList.contains("active")) {
    renderCovidAvance();
  } else if (advancesTab && advancesTab.classList.contains("active")) {
    renderAvancesAndConcentrados();
  } else if (validationTab && validationTab.classList.contains("active")) {
    initValidationTab();
  } else if (conciliacionTab && conciliacionTab.classList.contains("active")) {
    initConciliacionTab();
  } else if (metasTab && metasTab.classList.contains("active")) {
    renderMetasConfigurationGrid();
  } else if (frascosTab && frascosTab.classList.contains("active")) {
    renderFrascosDistribution();
  } else if (configTab && configTab.classList.contains("active")) {
    renderCampaignConfigScreen();
  }
}

// Helper to map cut date to month and week number in template
function mapDateToMonthAndWeek(fechaStr) {
  const d = new Date(fechaStr + "T12:00:00");
  const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const monthName = monthNames[d.getMonth()];
  
  const year = d.getFullYear();
  const month = d.getMonth();
  const fridays = [];
  const temp = new Date(year, month, 1, 12, 0, 0);
  while (temp.getMonth() === month) {
    if (temp.getDay() === 5) {
      fridays.push(temp.getDate());
    }
    temp.setDate(temp.getDate() + 1);
  }
  
  // Un viernes es su número de viernes del mes; el corte de fin de mes entre semana va en la columna que sigue.
  const day = d.getDate();
  return {
    month: monthName,
    weekNumInMonth: fridays.filter(f => f < day).length + 1
  };
}

// Versión para el propio botón de la unidad (Historial de Reportes): reusa
// la misma plantilla/lógica de exportUnitReportExcel, pero lee de las
// cachés que SÍ están pobladas en el flujo de captura de la unidad
// (_influenzaMetasCache/_influenzaCapturasCache, ya filtradas a USER.clues
// desde loadInfluenzaUnitData) en vez de _adminMetasArray/_adminCapturasArray
// (cachés de un panel admin -- exportUnitReportExcel nunca llegó a
// conectarse a ningún botón en el repo).
async function exportInfluenzaExcelOficialUnidad() {
  try {
    showToast("Generando reporte de Excel...", true, "info");

    const response = await fetch(encodeURI("./Formatos/Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const fechaCorte = document.getElementById("influenza_semana")?.value || new Date().toISOString().split("T")[0];
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];

    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal ${campaignSeasonLabel()} - ${USER.unidad} (${USER.clues})`;

      INFLUENZA_RUBROS.forEach((rb, idx) => {
        const metaVal = Number(_influenzaMetasCache[rb.id] || 0);
        sheetMeta.getCell(9 + idx, 8).value = metaVal;

        let totalLogro = 0;
        _influenzaCapturasCache.forEach(c => {
          if (c.fecha <= fechaCorte) totalLogro += Number(c.valores[rb.id] || 0);
        });
        sheetMeta.getCell(9 + idx, 7).value = totalLogro;
      });

      sheetMeta.getCell('G55').value = { formula: 'SUM(G9:G54)' };
    }

    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Análisis_Meta_Logro_Influenza_${campaignSeasonLabel()}_${String(USER.unidad || '').replace(/ /g, "_")}_${fechaCorte}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte Excel descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar reporte Excel (unidad):", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

async function exportUnitReportExcel(report, fecha) {
  try {
    showToast("Generando reporte de Excel...", true, "info");
    
    const response = await fetch(encodeURI("./Formatos/Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const unitMetaRecord = _adminMetasArray.find(m => m.clues === report.clues);
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal ${campaignSeasonLabel()} - ${report.unidad} (${report.clues})`;
      
      INFLUENZA_RUBROS.forEach((rb, idx) => {
        // Meta
        const metaVal = unitMetaRecord ? (unitMetaRecord.metas[rb.id] || 0) : 0;
        sheetMeta.getCell(9 + idx, 8).value = Number(metaVal);
        
        // Logro (Suma de acumulado histórico de la unidad hasta la fecha seleccionada)
        let totalLogro = 0;
        _adminCapturasArray.forEach(c => {
          if (c.clues === report.clues && c.fecha <= report.fecha) {
            totalLogro += Number(c.valores[rb.id] || 0);
          }
        });
        sheetMeta.getCell(9 + idx, 7).value = totalLogro;
      });
      
      // Cambiar fórmula del total general G55 a suma local ya que no hay hojas mensuales
      sheetMeta.getCell('G55').value = { formula: 'SUM(G9:G54)' };
    }
    
    // Eliminar hojas que no correspondan
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Análisis_Meta_Logro_Influenza_${campaignSeasonLabel()}_${report.unidad.replace(/ /g, "_")}_${fecha}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte Excel descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar reporte Excel:", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

async function exportMunicipalConcentradoExcel(muni, fecha) {
  try {
    showToast("Generando concentrado municipal de Excel...", true, "info");
    
    const response = await fetch(encodeURI("./Formatos/Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());
    
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal ${campaignSeasonLabel()} - Concentrado Municipal: ${muni}`;
      
      INFLUENZA_RUBROS.forEach((rb, idx) => {
        // Meta del municipio (suma de las de cada unidad)
        let totalMeta = 0;
        units.forEach(u => {
          const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
          totalMeta += unitMetaRecord ? Number(unitMetaRecord.metas[rb.id] || 0) : 0;
        });
        sheetMeta.getCell(9 + idx, 8).value = totalMeta;
        
        // Logro municipal acumulado hasta la fecha seleccionada
        let totalLogro = 0;
        _adminCapturasArray.forEach(c => {
          if (c.municipio.toUpperCase() === muni.toUpperCase() && c.fecha <= fecha) {
            totalLogro += Number(c.valores[rb.id] || 0);
          }
        });
        sheetMeta.getCell(9 + idx, 7).value = totalLogro;
      });
      
      sheetMeta.getCell('G55').value = { formula: 'SUM(G9:G54)' };
    }
    
    const ws = wb.addWorksheet('CONCENTRADO MUNICIPAL', { views: [{ showGridLines: true }] });
    // Mover la hoja recién agregada al inicio (índice 0)
    const sheets = wb.worksheets;
    const addedSheet = sheets.pop();
    sheets.unshift(addedSheet);
    
    ws.getColumn(1).width = 4;
    ws.getColumn(2).width = 6;
    ws.getColumn(3).width = 35;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 15;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 15;
    
    ws.getCell('B2').value = "ANÁLISIS DE META-LOGRO DE INFLUENZA";
    ws.getCell('B2').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF2E1065' } };
    
    ws.getCell('B3').value = `Concentrado Municipal - ${muni} | Campaña: ${campaignSeasonLabel()} | Semana Epidemiológica: ${fecha}`;
    ws.getCell('B3').font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF64748B' } };
    
    const headers = ["#", "UNIDAD DE SALUD", "CLUES", "META ANUAL", "LOGRO ACUMULADO", "% AVANCE"];
    const headerRowIdx = 5;
    
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRowIdx, 2 + i);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4C1D95' }
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF2E1065' } },
        bottom: { style: 'medium', color: { argb: 'FF2E1065' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
    ws.getRow(headerRowIdx).height = 25;
    
    let rowIdx = 6;
    units.forEach((u, index) => {
      const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
      let totalMeta = 0;
      if (unitMetaRecord) {
        Object.values(unitMetaRecord.metas).forEach(v => totalMeta += Number(v || 0));
      }
      
      let totalLogro = 0;
      _adminCapturasArray.forEach(c => {
        if (c.clues === u.clues && c.fecha <= fecha) {
          Object.values(c.valores).forEach(v => totalLogro += Number(v || 0));
        }
      });
      
      ws.getCell(rowIdx, 2).value = index + 1;
      ws.getCell(rowIdx, 3).value = u.unidad;
      ws.getCell(rowIdx, 4).value = u.clues;
      ws.getCell(rowIdx, 5).value = totalMeta;
      ws.getCell(rowIdx, 6).value = totalLogro;
      
      const cellPercent = ws.getCell(rowIdx, 7);
      cellPercent.value = { formula: `IFERROR(F${rowIdx}/E${rowIdx}, 0)` };
      cellPercent.numFmt = '0.0%';
      
      ws.getCell(rowIdx, 5).numFmt = '#,##0';
      ws.getCell(rowIdx, 6).numFmt = '#,##0';
      
      const borderThin = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
      
      for (let i = 0; i < 6; i++) {
        const cell = ws.getCell(rowIdx, 2 + i);
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
        cell.border = borderThin;
      }
      
      const pct = totalMeta > 0 ? (totalLogro / totalMeta) : 0;
      let bg = 'FFFFF2F2';
      let fg = 'FF991B1B';
      
      if (pct >= 0.95) {
        bg = 'FFE6FBF0';
        fg = 'FF047857';
      } else if (pct >= 0.80) {
        bg = 'FFFFFDF0';
        fg = 'FFB45309';
      }
      
      cellPercent.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bg }
      };
      cellPercent.font = { name: 'Arial', size: 10, bold: true, color: { argb: fg } };
      
      rowIdx++;
    });
    
    ws.getCell(rowIdx, 2).value = "";
    ws.getCell(rowIdx, 3).value = "TOTAL MUNICIPAL";
    ws.getCell(rowIdx, 3).font = { name: 'Arial', size: 10, bold: true };
    ws.getCell(rowIdx, 4).value = "";
    
    ws.getCell(rowIdx, 5).value = { formula: `SUM(E6:E${rowIdx-1})` };
    ws.getCell(rowIdx, 5).numFmt = '#,##0';
    ws.getCell(rowIdx, 5).font = { name: 'Arial', size: 10, bold: true };
    
    ws.getCell(rowIdx, 6).value = { formula: `SUM(F6:F${rowIdx-1})` };
    ws.getCell(rowIdx, 6).numFmt = '#,##0';
    ws.getCell(rowIdx, 6).font = { name: 'Arial', size: 10, bold: true };
    
    const cellTotalPercent = ws.getCell(rowIdx, 7);
    cellTotalPercent.value = { formula: `IFERROR(F${rowIdx}/E${rowIdx}, 0)` };
    cellTotalPercent.numFmt = '0.0%';
    cellTotalPercent.font = { name: 'Arial', size: 10, bold: true };
    
    const borderDouble = {
      top: { style: 'thin', color: { argb: 'FF2E1065' } },
      bottom: { style: 'double', color: { argb: 'FF2E1065' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    
    for (let i = 0; i < 6; i++) {
      const cell = ws.getCell(rowIdx, 2 + i);
      cell.border = borderDouble;
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
    }
    
    // Eliminar hojas del mensual que no se necesitan
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Concentrado_Influenza_${muni.replace(/ /g, "_")}_${fecha}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Concentrado municipal descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar concentrado Excel:", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

// 1. AVANCES Y CONCENTRADOS ADMIN/MUNI
let _currentEditingReport = null;

function renderAvancesAndConcentrados() {
  const semInicioSelect = document.getElementById("adminInfluenzaSemanaInicio");
  const semFinSelect = document.getElementById("adminInfluenzaSemanaFin");
  if (!semInicioSelect || !semFinSelect) return;

  const semInicio = semInicioSelect.value;
  const semFin = semFinSelect.value;
  const muni = document.getElementById("adminInfluenzaMuni").value;

  const muniFrascosBox = document.getElementById("muniFrascosAnalisisBox");
  const muniTableContainer = document.getElementById("adminInfluenzaMunicipalTableContainer");
  const muniTbody = document.getElementById("adminInfluenzaMunicipalTbody");
  const unitDetailContainer = document.getElementById("adminInfluenzaUnitDetailContainer");

  if (unitDetailContainer) unitDetailContainer.classList.add("hidden");

  // Limpiar y reasignar listener de exportar concentrado e histórico detallado
  const exportBtn = document.getElementById("btnExportInfluenzaConcentrado");
  if (exportBtn) {
    exportBtn.onclick = () => {
      exportConcentradoSimpleExcel();
    };
  }

  const exportDetailedBtn = document.getElementById("btnExportConcentradoConUnidades");
  if (exportDetailedBtn) {
    exportDetailedBtn.onclick = () => {
      exportConcentradoDetalladoUnidadesExcel();
    };
  }

  // Lógica de toggle para el dropdown de exportación
  const trigger = document.getElementById("btnExportInfluenzaDropdownTrigger");
  const menu = document.getElementById("exportInfluenzaMenu");
  if (trigger && menu) {
    trigger.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    };
    
    // Cerrar al hacer clic fuera
    if (!window._exportDropdownOutsideClickListener) {
      window._exportDropdownOutsideClickListener = (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.add("hidden");
        }
      };
      document.addEventListener("click", window._exportDropdownOutsideClickListener);
    }
  }

  if (muniFrascosBox) muniFrascosBox.style.setProperty("display", "block", "important");
  if (muniTableContainer) muniTableContainer.style.setProperty("display", "flex", "important");

  const minFecha = semInicio < semFin ? semInicio : semFin;
  const maxFecha = semInicio < semFin ? semFin : semInicio;

  // Actualizar gráficos y proyecciones
  updateInfluenzaDashboardVisuals(muni, minFecha, maxFecha);

  // Obtener unidades del municipio
  const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());

  // Sumar dosis aplicadas en el municipio de todos los reportes capturados para el rango seleccionado
  const municipalReportsInRange = _adminCapturasArray.filter(r => r.fecha >= minFecha && r.fecha <= maxFecha && r.municipio.toUpperCase() === muni.toUpperCase());
  let totalDosesRange = 0;
  municipalReportsInRange.forEach(r => {
    Object.values(r.valores).forEach(v => totalDosesRange += Number(v || 0));
  });

  // Calcular frascos entregados acumulado en el municipio
  let totalFrascosEntregados = 0;
  _adminFrascosArray.forEach(d => {
    if (d.municipio.toUpperCase() === muni.toUpperCase()) {
      totalFrascosEntregados += Number(d.cantidad_frascos || 0);
    }
  });

  const frascosAplicadosRange = totalDosesRange / 10;
  const dif = totalFrascosEntregados - frascosAplicadosRange;

  muniFrascosBox.innerHTML = `
    <div class="text-xs font-black text-violet-950 uppercase tracking-widest mb-3 mt-6 ml-1">Resumen Municipal: ${muni} (Semanas del ${minFecha} al ${maxFecha})</div>
    <div class="dashboardKpis w-full" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">
      <!-- KPI 1: Dosis Aplicadas -->
      <div class="kpiCard" style="border-left-color: #6366f1 !important; background-color: #f5f3ff !important; --kpi-color: #6366f1; --kpi-bg: #e0e7ff;">
        <div class="kpiHeader">
          <div class="kpiCardLabel" style="color: #4f46e5;">Dosis Aplicadas</div>
          <div class="kpiIcon"><span class="material-symbols-rounded">vaccines</span></div>
        </div>
        <div class="kpiCardValue" style="color: #312e81;">${totalDosesRange.toLocaleString('es-MX')}</div>
        <div style="font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; margin-top: 6px;">${frascosAplicadosRange.toLocaleString('es-MX')} frascos equiv.</div>
      </div>
      
      <!-- KPI 2: Frascos Entregados -->
      <div class="kpiCard" style="border-left-color: #a855f7 !important; background-color: #faf5ff !important; --kpi-color: #a855f7; --kpi-bg: #f3e8ff;">
        <div class="kpiHeader">
          <div class="kpiCardLabel" style="color: #9333ea;">Frascos Entregados</div>
          <div class="kpiIcon"><span class="material-symbols-rounded">inventory_2</span></div>
        </div>
        <div class="kpiCardValue" style="color: #581c87;">${totalFrascosEntregados.toLocaleString('es-MX')}</div>
        <div style="font-size: 10px; font-weight: 800; color: #a855f7; text-transform: uppercase; margin-top: 6px;">${(totalFrascosEntregados * 10).toLocaleString('es-MX')} dosis equiv.</div>
      </div>

      <!-- KPI 3: Estimado en Resguardo -->
      <div class="kpiCard" style="border-left-color: #ec4899 !important; background-color: #fdf2f8 !important; --kpi-color: #ec4899; --kpi-bg: #fce7f3;">
        <div class="kpiHeader">
          <div class="kpiCardLabel" style="color: #db2777;">Diferencia en Resguardo</div>
          <div class="kpiIcon"><span class="material-symbols-rounded">hourglass_empty</span></div>
        </div>
        <div class="kpiCardValue" style="color: #831843;">${dif.toLocaleString('es-MX')}</div>
        <div style="font-size: 10px; font-weight: 800; color: #ec4899; text-transform: uppercase; margin-top: 6px;">${(dif * 10).toLocaleString('es-MX')} dosis equiv.</div>
      </div>
    </div>
  `;

  // Renderizar desglose de unidades
  muniTbody.innerHTML = "";
  units.forEach(u => {
    // Sumar metas de la unidad
    const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
    let totalMeta = 0;
    if (unitMetaRecord && unitMetaRecord.metas) {
      Object.values(unitMetaRecord.metas).forEach(v => totalMeta += Number(v || 0));
    }

    // Sumar capturas acumuladas de la unidad en el rango seleccionado
    let totalAcumulado = 0;
    _adminCapturasArray.forEach(c => {
      if (c.clues === u.clues && c.fecha >= minFecha && c.fecha <= maxFecha) {
        Object.values(c.valores).forEach(v => totalAcumulado += Number(v || 0));
      }
    });

    // Calcular %
    const pct = totalMeta > 0 ? ((totalAcumulado / totalMeta) * 100).toFixed(1) : "0.0";

    // Sumar frascos entregados
    let unitFrascos = 0;
    _adminFrascosArray.forEach(d => {
      if (d.clues === u.clues) {
        unitFrascos += Number(d.cantidad_frascos || 0);
      }
    });
    const unitDosisEquiv = unitFrascos * 10;

    const row = document.createElement("tr");
    row.className = "border-b border-slate-100 hover:bg-slate-50";
    row.innerHTML = `
      <td class="p-3 text-xs font-semibold text-slate-700">${u.unidad}</td>
      <td class="p-3 text-xs text-slate-500 font-mono">${u.clues}</td>
      <td class="p-3 text-center text-xs font-bold text-slate-600">${totalMeta.toLocaleString('es-MX')}</td>
      <td class="p-3 text-center text-xs font-bold text-violet-950">${totalAcumulado.toLocaleString('es-MX')}</td>
      <td class="p-3 text-center text-xs font-bold ${Number(pct) >= 95 ? 'text-emerald-600' : 'text-slate-600'}">${pct}%</td>
      <td class="p-3 text-center text-xs font-bold text-slate-700">${unitFrascos}</td>
      <td class="p-3 text-center text-xs font-bold text-slate-500">${unitDosisEquiv.toLocaleString('es-MX')}</td>
    `;
    row.onclick = () => {
      renderUnitDetail(u.clues, u.unidad, minFecha, maxFecha);
    };
    muniTbody.appendChild(row);
  });
}

function updateInfluenzaDashboardVisuals(muni, minFecha, maxFecha) {
  const projCard = document.getElementById("influenzaProjectionCard");
  const topGrid = document.getElementById("influenzaTopGrid");
  const trendContainer = document.getElementById("influenzaTrendContainer");
  
  if (topGrid) {
    topGrid.classList.remove("hidden");
    topGrid.style.setProperty("display", "grid", "important");
    topGrid.style.setProperty("grid-template-columns", "1fr 1fr", "important");
    topGrid.style.setProperty("gap", "24px", "important");
  }
  if (trendContainer) {
    trendContainer.classList.remove("hidden");
    trendContainer.style.setProperty("display", "block", "important");
  }
  
  const campaignWeeks = generateCampaignWeeks();
  const weeksSorted = campaignWeeks.map(w => w.fecha).sort();
  const totalWeeks = weeksSorted.length;
  
  const municipalReportsInRange = _adminCapturasArray.filter(r => r.fecha >= minFecha && r.fecha <= maxFecha && r.municipio.toUpperCase() === muni.toUpperCase());
  
  let municipalMetaTotal = 0;
  const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());
  muniUnits.forEach(u => {
    const mRecord = _adminMetasArray.find(r => r.clues === u.clues);
    if (mRecord && mRecord.metas) {
      Object.values(mRecord.metas).forEach(v => municipalMetaTotal += Number(v || 0));
    }
  });

  let runningCumulative = 0;
  const trendLabels = [];
  const actualTrend = [];
  const expectedTrend = [];
  
  const currentWeekIndex = Math.max(1, weeksSorted.indexOf(maxFecha) + 1);

  weeksSorted.forEach((wFecha, idx) => {
    const weekNum = campaignWeeks.find(cw => cw.fecha === wFecha)?.semana || "N/A";
    trendLabels.push(`Sem. ${weekNum}${campaignWeeks.find(cw => cw.fecha === wFecha)?.corte ? " (corte)" : ""}`);
    
    let weekDoses = 0;
    _adminCapturasArray.forEach(c => {
      if (c.municipio.toUpperCase() === muni.toUpperCase() && c.fecha === wFecha) {
        Object.values(c.valores).forEach(v => weekDoses += Number(v || 0));
      }
    });
    runningCumulative += weekDoses;
    actualTrend.push(runningCumulative);
    
    const expected = municipalMetaTotal > 0 ? Math.round((municipalMetaTotal / totalWeeks) * (idx + 1)) : 0;
    expectedTrend.push(expected);
  });

  const accumulatedUpToMax = actualTrend[currentWeekIndex - 1] || 0;
  const velocity = currentWeekIndex > 0 ? (accumulatedUpToMax / currentWeekIndex) : 0;
  const projectedEndValue = Math.round(velocity * totalWeeks);
  const projectedPct = municipalMetaTotal > 0 ? Math.round((projectedEndValue / municipalMetaTotal) * 100) : 0;
  
  let statusText, statusBadgeClass, statusDesc;
  if (projectedPct >= 95) {
    statusText = "🟢 Óptimo";
    statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
    statusDesc = "El ritmo actual de aplicación es excelente. Se proyecta cumplir o superar la meta anual de vacunación al finalizar la campaña invernal.";
  } else if (projectedPct >= 80) {
    statusText = "🟡 En Riesgo";
    statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-300";
    statusDesc = "Se proyecta un avance del " + projectedPct + "%. Aunque hay progreso constante, se recomienda reforzar las brigadas semanales para consolidar la meta.";
  } else {
    statusText = "🔴 Crítico";
    statusBadgeClass = "bg-rose-100 text-rose-800 border-rose-300";
    statusDesc = "¡Alerta! Al ritmo semanal promedio de " + Math.round(velocity) + " dosis, se proyecta cubrir únicamente el " + projectedPct + "% de la meta anual. Se requiere intervención y abasto inmediato.";
  }

  if (projCard) {
    projCard.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-violet-100 pb-3">
        <div>
          <div class="text-[10px] font-black text-violet-600 uppercase tracking-widest">Predicción y Proyecciones de Cierre</div>
          <h3 class="text-xs font-black text-slate-800 mt-1">Análisis de Cumplimiento Municipal: ${muni}</h3>
        </div>
        <span class="px-3 py-1 rounded-full text-[9px] font-black border ${statusBadgeClass} transition-all">${statusText}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 flex-grow">
        <div class="bg-white/60 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
          <div class="text-[9px] font-bold text-slate-450 uppercase leading-none">Velocidad Promedio</div>
          <div class="text-base font-extrabold text-violet-950 mt-1.5 leading-none">${Math.round(velocity).toLocaleString('es-MX')} <span class="text-xs font-bold text-slate-500">d/sem</span></div>
          <div class="text-[10px] text-slate-500 mt-1.5 leading-none">Semanas: ${currentWeekIndex} de ${totalWeeks}</div>
        </div>
        <div class="bg-white/60 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
          <div class="text-[9px] font-bold text-slate-450 uppercase leading-none">Meta Asignada</div>
          <div class="text-base font-extrabold text-slate-700 mt-1.5 leading-none">${municipalMetaTotal.toLocaleString('es-MX')} <span class="text-xs font-bold text-slate-500">dosis</span></div>
          <div class="text-[10px] text-slate-500 mt-1.5 leading-none">Avance: ${accumulatedUpToMax.toLocaleString('es-MX')} (${municipalMetaTotal > 0 ? Math.round(accumulatedUpToMax / municipalMetaTotal * 100) : 0}%)</div>
        </div>
        <div class="bg-white/60 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
          <div class="text-[9px] font-bold text-slate-450 uppercase leading-none">Proyección de Cierre</div>
          <div class="text-base font-extrabold text-slate-800 mt-1.5 leading-none">${projectedEndValue.toLocaleString('es-MX')} <span class="text-xs font-bold text-slate-500">dosis</span></div>
          <div class="text-[10px] text-slate-500 mt-1.5 leading-none">Cumplimiento: <b>${projectedPct}%</b></div>
        </div>
        <div class="bg-white/60 p-3 rounded-xl border border-slate-100 flex flex-col justify-center">
          <div class="text-[10px] font-semibold text-slate-650 leading-relaxed">${statusDesc}</div>
        </div>
      </div>
    `;
  }

  // 2. Render Trend EChart
  const ctxTrend = document.getElementById("adminInfluenzaTrendChart");
  if (ctxTrend && typeof echarts !== 'undefined') {
    if (_adminInfluenzaTrendChart) {
      _adminInfluenzaTrendChart.dispose();
    }
    _adminInfluenzaTrendChart = echarts.init(ctxTrend);
    
    const visibleActual = actualTrend.slice(0, currentWeekIndex);
    
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' }
      },
      legend: {
        data: ['Avance Real Acumulado', 'Meta Lineal Sugerida'],
        bottom: 0,
        textStyle: { fontSize: 9, fontWeight: 'bold' }
      },
      grid: { left: '3%', right: '4%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendLabels,
        axisLabel: { fontSize: 8 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 8 }
      },
      series: [
        {
          name: 'Avance Real Acumulado',
          type: 'line',
          smooth: true,
          data: visibleActual,
          itemStyle: { color: '#6d28d9' },
          lineStyle: { width: 3 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(109, 40, 217, 0.2)' },
              { offset: 1, color: 'rgba(109, 40, 217, 0)' }
            ])
          }
        },
        {
          name: 'Meta Lineal Sugerida',
          type: 'line',
          smooth: true,
          data: expectedTrend,
          itemStyle: { color: '#94a3b8' },
          lineStyle: { type: 'dashed', width: 2 }
        }
      ]
    };
    _adminInfluenzaTrendChart.setOption(option);
  }

  // 3. Render Group Distribution EChart
  const ctxBreakdown = document.getElementById("adminInfluenzaBreakdownChart");
  if (ctxBreakdown && typeof echarts !== 'undefined') {
    if (_adminInfluenzaBreakdownChart) {
      _adminInfluenzaBreakdownChart.dispose();
    }
    _adminInfluenzaBreakdownChart = echarts.init(ctxBreakdown);

    let primDosis = 0;
    let segDosis = 0;
    let revac = 0;
    let riskGroups = 0;
    let comorbidities = 0;

    municipalReportsInRange.forEach(r => {
      INFLUENZA_RUBROS.forEach(rb => {
        const val = Number(r.valores[rb.id] || 0);
        if (rb.grupo === "Primera dosis") primDosis += val;
        else if (rb.grupo === "Segunda dosis") segDosis += val;
        else if (rb.grupo === "Revacunación") revac += val;
        else if (rb.grupo === "Grupos de riesgo") riskGroups += val;
        else comorbidities += val;
      });
    });

    const pieData = [
      { value: primDosis, name: 'Primera dosis' },
      { value: segDosis, name: 'Segunda dosis' },
      { value: revac, name: 'Revacunación' },
      { value: riskGroups, name: 'Grupos de riesgo' },
      { value: comorbidities, name: 'Comorbilidades' }
    ].filter(item => item.value > 0);

    const totalDoses = pieData.reduce((sum, item) => sum + item.value, 0);
    const hasData = totalDoses > 0;

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <b>{c}</b> ({d}%)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 11, fontWeight: 'bold' },
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowBlur: 10
      },
      legend: {
        bottom: 0,
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        textStyle: { fontSize: 9, fontWeight: 'bold', color: '#64748b' }
      },
      series: [
        {
          name: 'Población',
          type: 'pie',
          radius: ['52%', '72%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2,
            shadowColor: 'rgba(0, 0, 0, 0.04)',
            shadowBlur: 8
          },
          label: {
            show: hasData,
            position: 'center',
            formatter: '{total|' + totalDoses.toLocaleString('es-MX') + '}\n{label|dosis}',
            rich: {
              total: {
                fontSize: 16,
                fontWeight: '900',
                color: '#1e1b4b',
                lineHeight: 22
              },
              label: {
                fontSize: 9,
                color: '#94a3b8',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }
            }
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.08)'
            }
          },
          labelLine: { show: false },
          color: [
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#6d28d9' }
            ]),
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#14b8a6' },
              { offset: 1, color: '#0d9488' }
            ]),
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ec4899' },
              { offset: 1, color: '#db2777' }
            ]),
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#d97706' }
            ]),
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#6366f1' },
              { offset: 1, color: '#4f46e5' }
            ])
          ],
          data: hasData ? pieData : [{
            value: 1,
            name: 'Sin datos',
            itemStyle: { color: '#fbcfe8', borderRadius: 8 },
            label: {
              show: true,
              position: 'center',
              formatter: '{total|Sin Datos}\n{label|campaña}',
              rich: {
                total: {
                  fontSize: 16,
                  fontWeight: '900',
                  color: '#db2777',
                  lineHeight: 22
                },
                label: {
                  fontSize: 9,
                  color: '#f472b6',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }
              }
            }
          }]
        }
      ]
    };
    _adminInfluenzaBreakdownChart.setOption(option);
  }

  if (!window._influenzaResizeListenerAttached) {
    window.addEventListener("resize", () => {
      if (_adminInfluenzaTrendChart) _adminInfluenzaTrendChart.resize();
      if (_adminInfluenzaBreakdownChart) _adminInfluenzaBreakdownChart.resize();
    });
    window._influenzaResizeListenerAttached = true;
  }
}

function renderUnitDetail(clues, unidadNombre, minFecha, maxFecha) {
  const detailContainer = document.getElementById("adminInfluenzaUnitDetailContainer");
  const detailTitle = document.getElementById("adminInfluenzaUnitDetailTitle");
  const detailCards = document.getElementById("adminInfluenzaUnitDetailCards");

  if (!detailContainer || !detailCards) return;

  detailContainer.classList.remove("hidden");
  detailTitle.textContent = `Detalle de Meta-Logro por Rubro: ${unidadNombre} (${clues})`;
  detailCards.innerHTML = "";

  // Poblar selector de meses para reporte mensual de esta unidad
  const mesSelect = document.getElementById("reporteSemanalMesSelect");
  if (mesSelect) {
    const startStr = _campaignConfig.fecha_inicio || "2025-10-03";
    const endStr   = _campaignConfig.fecha_fin    || "2026-04-25";
    const startDate = new Date(startStr + "T12:00:00");
    const endDate = new Date(endStr + "T12:00:00");
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const options = [];
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 12, 0, 0);
    while (current <= endDate || (current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear())) {
      const m = current.getMonth() + 1;
      const y = current.getFullYear();
      options.push({ value: `${m}|${y}`, label: `${monthNames[current.getMonth()]} ${y}` });
      current.setMonth(current.getMonth() + 1);
    }
    mesSelect.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
  }

  const exportWeeklyUnitBtn = document.getElementById("btnExportReporteSemanaUnit");
  if (exportWeeklyUnitBtn) {
    exportWeeklyUnitBtn.onclick = () => {
      const mesVal = document.getElementById("reporteSemanalMesSelect").value;
      exportWeeklyMonthlyUnitExcel(clues, unidadNombre, mesVal);
    };
  }

  const unitMetaRecord = _adminMetasArray.find(m => m.clues === clues);
  const metas = unitMetaRecord ? unitMetaRecord.metas : {};

  // Sumar dosis aplicadas en el rango seleccionado
  const acumuladoRango = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladoRango[rb.id] = 0;
    _adminCapturasArray.forEach(c => {
      if (c.clues === clues && c.fecha >= minFecha && c.fecha <= maxFecha) {
        acumuladoRango[rb.id] += Number(c.valores[rb.id] || 0);
      }
    });
  });

  // Agrupar por rubro
  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const key = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rb);
  });

  const gruposSinMeta = [];
  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    // Un grupo donde la unidad no tiene meta en ningún renglón no se captura: va en un solo aviso al final,
    // no como una tabla entera de guiones.
    if (rubros.every(rb => !Number(metas[rb.id] || 0))) {
      gruposSinMeta.push(groupTitle);
      return;
    }
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    let rowsHtml = "";
    rubros.forEach(rb => {
      const meta = Number(metas[rb.id] || 0);
      const acum = acumuladoRango[rb.id];
      const pct = meta > 0 ? Math.round((acum / meta) * 100) : 0;

      let barColor;
      if (!meta) {
        barColor = '#cbd5e1';
      } else if (pct >= 85) {
        barColor = '#10b981';
      } else if (pct >= 50) {
        barColor = '#f59e0b';
      } else {
        barColor = '#ef4444';
      }

      rowsHtml += `
        <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
          <td class="p-3 font-semibold text-slate-700 text-xs">${rb.edad}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-500">${meta || '—'}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-950">${acum}</td>
          <td class="p-3" style="min-width: 120px;">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between w-full text-[10px] font-black text-slate-500">
                <span>Avance</span>
                <span>${meta > 0 ? `${pct}%` : 'N/A'}</span>
              </div>
              <div style="width:100%; height:6px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
                <div style="width:${Math.min(pct, 100)}%; height:100%; background:${barColor}; border-radius:6px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    });

    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100 mb-2">
        <h4 class="text-xs font-black text-violet-950 uppercase tracking-wider m-0">${groupTitle}</h4>
      </div>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200">
        <table class="w-full border-collapse text-left text-xs text-slate-700">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
              <th class="p-3">Edad</th>
              <th class="p-3 text-center">Meta Anual</th>
              <th class="p-3 text-center">Logrado</th>
              <th class="p-3">Progreso</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
    detailCards.appendChild(card);
  });
}

// 1.1 VALIDACIÓN Y EDICIÓN SUPERVISADA
let _currentValidationReport = null;

function initValidationTab() {
  const valSemanaSelect = document.getElementById("validationInfluenzaSemana");
  const searchInput = document.getElementById("validationUnitSearch");
  const backBtn = document.getElementById("btnBackToValidationList");

  if (!valSemanaSelect) return;

  // Las semanas se rearman si cambia la campaña (no solo la primera vez)
  const weeksKey = (_selectedCampaign?.nombre || "") + "|" + _campaignConfig.fecha_inicio + "|" + _campaignConfig.fecha_fin;
  if (!valSemanaSelect.innerHTML.trim() || valSemanaSelect.dataset.weeksKey !== weeksKey) {
    valSemanaSelect.dataset.weeksKey = weeksKey;
    const weeks = generateCampaignWeeks();
    valSemanaSelect.innerHTML = weeks.map(w => `<option value="${w.fecha}">${w.label}</option>`).join("");
    // Select last week by default or current week
    // Fecha LOCAL (toISOString usa UTC y de noche en México adelantaría un día).
    const hoy = new Date();
    const today = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const matchingWeek = weeks.find(w => w.fecha >= today);
    if (matchingWeek) {
      valSemanaSelect.value = matchingWeek.fecha;
    } else if (weeks.length) {
      valSemanaSelect.value = weeks[weeks.length - 1].fecha;
    }
  }

  // Bind events
  if (!valSemanaSelect.dataset.listened) {
    valSemanaSelect.dataset.listened = "true";
    valSemanaSelect.addEventListener("change", () => {
      renderValidationDashboard();
    });
  }

  if (searchInput && !searchInput.dataset.listened) {
    searchInput.dataset.listened = "true";
    searchInput.addEventListener("input", () => {
      renderValidationDashboard();
    });
  }

  const estadoSelect = document.getElementById("validationEstadoFiltro");
  if (estadoSelect && !estadoSelect.dataset.listened) {
    estadoSelect.dataset.listened = "true";
    estadoSelect.addEventListener("change", () => renderValidationDashboard());
  }

  if (backBtn) {
    backBtn.onclick = () => volverAlListadoValidacion();
  }

  renderValidationDashboard();
}

// Estado del reporte de una unidad en la semana: "pendiente" | "reportado" | "corregido"
function estadoValidacion(report) {
  if (!report) return "pendiente";
  return report.editado_por !== "UNIDAD" ? "corregido" : "reportado";
}

function historialDeReporte(report) {
  try {
    const h = report && report.historial_ediciones;
    return Array.isArray(h) ? h : JSON.parse(h || "[]");
  } catch (_) { return []; }
}

// Última edición del supervisor fue «validar sin cambios»
function validadoSinCambios(report) {
  if (!report || report.editado_por === "UNIDAD") return false;
  const hist = historialDeReporte(report);
  const last = hist[hist.length - 1];
  return !!(last && last.sin_cambios);
}

// Nombre que firmó la última corrección/validación (si el historial lo trae)
function firmaDeReporte(report) {
  const hist = historialDeReporte(report);
  const last = hist[hist.length - 1];
  return (last && last.firmado_por) || "";
}

// Valores tal como los capturó la unidad: lo que había antes de la primera edición de supervisión
// (el servidor guarda `valores_anteriores`; los reportes viejos pudieron traer `valores_previos`).
function valoresOriginalesUnidad(report) {
  const hist = historialDeReporte(report);
  const primera = hist.find(h => h && h.editado_por && h.editado_por !== "UNIDAD");
  if (primera) return primera.valores_anteriores || primera.valores_previos || null;
  return null;
}

let _valUltimaClues = null;

// Texto legible de la semana seleccionada («Semana 42 (12 al 18 oct)») en vez de la fecha ISO.
function etiquetaSemanaValidacion(fecha) {
  const sel = document.getElementById("validationInfluenzaSemana");
  const opt = sel && [...sel.options].find(o => o.value === fecha);
  return opt ? opt.textContent.trim() : fecha;
}

function anunciarValidacion(msg) {
  const el = document.getElementById("validationStatsSummary");
  if (!el) return;
  let live = document.getElementById("validationLiveStatus");
  if (!live) {
    live = document.createElement("div");
    live.id = "validationLiveStatus";
    live.className = "vl-sr";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    el.parentElement.appendChild(live);
  }
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 50);
}

// Regresa al listado devolviendo el foco a la unidad que se estaba revisando.
function volverAlListadoValidacion(mensaje) {
  document.getElementById("validationReportContent").classList.add("hidden");
  document.getElementById("validationDashboard").classList.remove("hidden");
  renderValidationDashboard();
  const clues = _valUltimaClues;
  const btn = clues ? document.querySelector(`#validationUnitsGrid button[data-clues="${clues}"]`) : null;
  const destino = btn || document.getElementById("validationDashboardTitle");
  if (destino) {
    destino.focus({ preventScroll: false });
    if (destino.scrollIntoView) destino.scrollIntoView({ block: "center" });
  }
  if (mensaje) anunciarValidacion(mensaje);
}

function renderValidationDashboard() {
  const grid = document.getElementById("validationUnitsGrid");
  const summary = document.getElementById("validationStatsSummary");
  const valSemanaSelect = document.getElementById("validationInfluenzaSemana");
  const searchInput = document.getElementById("validationUnitSearch");
  const muniVal = document.getElementById("adminInfluenzaMuni").value;

  if (!grid || !valSemanaSelect) return;

  const selectedFecha = valSemanaSelect.value;
  const filterText = searchInput ? searchInput.value.toLowerCase().trim() : "";

  // Get units in selected municipality
  const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === muniVal.toUpperCase());

  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const estadoFiltro = document.getElementById("validationEstadoFiltro")?.value || "todas";

  // Estadísticas de TODO el municipio (no dependen de la búsqueda ni del filtro de estado)
  let totalCount = muniUnits.length;
  let reportedCount = 0;
  let validatedCount = 0;
  muniUnits.forEach(u => {
    const rep = _adminCapturasArray.find(r => r.clues === u.clues && r.fecha === selectedFecha);
    if (rep) {
      reportedCount++;
      if (rep.editado_por !== "UNIDAD") validatedCount++;
    }
  });

  const filteredUnits = muniUnits.filter(u => {
    if (filterText && !(u.unidad.toLowerCase().includes(filterText) || u.clues.toLowerCase().includes(filterText))) return false;
    if (estadoFiltro !== "todas") {
      const rep = _adminCapturasArray.find(r => r.clues === u.clues && r.fecha === selectedFecha);
      if (estadoValidacion(rep) !== estadoFiltro) return false;
    }
    return true;
  });

  grid.innerHTML = "";
  grid.setAttribute("role", "list");

  if (filteredUnits.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-sm text-slate-700 font-medium p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">No hay unidades que coincidan con la búsqueda o el estado elegido.</div>`;
  }

  filteredUnits.forEach(u => {
    const report = _adminCapturasArray.find(r => r.clues === u.clues && r.fecha === selectedFecha);
    const estado = estadoValidacion(report);

    let statusBadge = "";
    let actionText = "";
    let cardBorder = "";
    let totalDosis = 0;
    const badgeBase = "px-2.5 py-1 rounded-full text-[12px] font-black flex items-center gap-1 border";

    if (report && report.valores) {
      Object.values(report.valores).forEach(v => totalDosis += Number(v || 0));
    }

    if (estado === "corregido") {
      const sinCambios = validadoSinCambios(report);
      statusBadge = `<span class="bg-violet-50 text-violet-900 border-violet-300 ${badgeBase}"><span class="material-symbols-rounded text-xs" aria-hidden="true">verified</span>${sinCambios ? "Validado" : "Corregido"}</span>`;
      actionText = "Revisar de nuevo";
      cardBorder = "border-violet-200 hover:border-violet-300";
    } else if (estado === "reportado") {
      statusBadge = `<span class="bg-emerald-50 text-emerald-900 border-emerald-300 ${badgeBase}"><span class="material-symbols-rounded text-xs" aria-hidden="true">check_circle</span>Por validar</span>`;
      actionText = "Validar reporte";
      cardBorder = "border-emerald-200 hover:border-emerald-300";
    } else {
      statusBadge = `<span class="bg-amber-50 text-amber-900 border-amber-300 ${badgeBase}"><span class="material-symbols-rounded text-xs" aria-hidden="true">error</span>Sin reporte</span>`;
      actionText = "Capturar por la unidad";
      cardBorder = "border-amber-200 hover:border-amber-300";
    }
    const btnBg = "#0f172a";
    const btnHoverBg = "#1e293b";

    const card = document.createElement("div");
    card.setAttribute("role", "listitem");
    card.className = `p-4 rounded-2xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md cursor-pointer ${cardBorder}`;
    card.style.backgroundColor = "#ffffff";
    card.innerHTML = `
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
          <span class="material-symbols-rounded text-[22px] text-slate-600" aria-hidden="true">domain</span>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-black text-slate-600 tracking-wider uppercase mb-0.5">${esc(u.clues)}</div>
          <h5 class="text-sm font-extrabold text-slate-900 leading-tight" style="overflow-wrap:anywhere;">${esc(u.unidad)}</h5>
          <div class="text-xs font-bold text-slate-700 mt-1.5">
            Dosis reportadas: <strong class="text-slate-900">${report ? totalDosis : "—"}</strong>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-center">
        ${statusBadge}
        <button type="button" data-clues="${esc(u.clues)}" aria-label="${esc(actionText)}: ${esc(u.unidad)}, ${esc(u.clues)}"
          class="transition-all h-[40px] px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm border-0"
          style="background-color: ${btnBg} !important; color: #ffffff !important; cursor: pointer;"
          onmouseenter="this.style.setProperty('background-color', '${btnHoverBg}', 'important');"
          onmouseleave="this.style.setProperty('background-color', '${btnBg}', 'important');">
          <span class="material-symbols-rounded text-[18px]" aria-hidden="true" style="color: #ffffff !important;">find_in_page</span>
          <span style="color: #ffffff !important;">${esc(actionText)}</span>
        </button>
      </div>
    `;

    card.onclick = () => {
      _valUltimaClues = u.clues;
      document.getElementById("validationDashboard").classList.add("hidden");
      document.getElementById("validationReportContent").classList.remove("hidden");

      const valCluesSelect = document.getElementById("validationInfluenzaClues");
      if (valCluesSelect) valCluesSelect.value = u.clues;

      renderValidacionEdicionGrid(u.clues, selectedFecha);

      const titulo = document.getElementById("validationReportTitle");
      if (titulo) {
        titulo.focus();
        titulo.scrollIntoView({ block: "start" });
      }
    };

    grid.appendChild(card);
  });

  if (summary) {
    summary.innerHTML = `
      <span>${reportedCount} de ${totalCount} reportadas</span>
      <span class="text-slate-400 font-normal" aria-hidden="true">|</span>
      <span class="text-violet-900">${validatedCount} revisadas por supervisión</span>
    `;
  }
  anunciarValidacion(`Mostrando ${filteredUnits.length} de ${totalCount} unidades.`);
}

// Mensaje de error en línea (role="alert") + campos marcados; mueve el foco al primero con problema.
function mostrarErroresValidacion(items) {
  const box = document.getElementById("validationFormError");
  if (!box || !items.length) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  box.innerHTML = `<strong>${items.length === 1 ? "Hay 1 problema" : `Hay ${items.length} problemas`} que corregir antes de guardar:</strong><ul>${items.map(i => `<li>${esc(i.msg)}</li>`).join("")}</ul>`;
  box.classList.remove("hidden");
  items.forEach(i => {
    if (!i.el) return;
    i.el.setAttribute("aria-invalid", "true");
    if (i.el.id === "validationNombreResponsable") document.getElementById("validationNombreGrupo")?.classList.add("vl-invalido");
  });
  const primero = items.find(i => i.el && !i.el.disabled)?.el || box;
  primero.focus();
  if (primero.scrollIntoView) primero.scrollIntoView({ block: "center" });
}

function limpiarErroresValidacion() {
  const box = document.getElementById("validationFormError");
  if (box) { box.classList.add("hidden"); box.innerHTML = ""; }
  document.getElementById("validationNombreGrupo")?.classList.remove("vl-invalido");
  document.querySelectorAll("#secInfluenzaValidacion [aria-invalid='true']").forEach(el => el.removeAttribute("aria-invalid"));
}

// Cambios del supervisor frente a lo que capturó la unidad (solo campos editables).
function contarCambiosValidacion() {
  const orig = _currentValidationReport?.valores || null;
  let n = 0;
  document.querySelectorAll("#validationCardsContainer input[data-rubro]:not([disabled])").forEach(inp => {
    const actual = parseInt(inp.value, 10) || 0;
    const previo = orig ? Number(orig[inp.dataset.rubro] || 0) : 0;
    if (actual !== previo) n++;
  });
  return n;
}

function actualizarResumenValidacion() {
  const resumen = document.getElementById("validationCambiosResumen");
  const btn = document.getElementById("btnSaveValidation");
  const n = contarCambiosValidacion();
  const hayReporte = !!_currentValidationReport;
  let texto, etiqueta;
  if (hayReporte && n === 0) {
    texto = "Sin cambios: el reporte se validará tal como lo capturó la unidad.";
    etiqueta = "Validar sin cambios";
  } else if (hayReporte) {
    texto = n === 1 ? "1 rubro modificado respecto a lo capturado por la unidad." : `${n} rubros modificados respecto a lo capturado por la unidad.`;
    etiqueta = "Guardar corrección del supervisor";
  } else {
    texto = n === 0 ? "La unidad no tiene reporte esta semana. Captura las dosis para registrarlo." : `Se registrará un reporte nuevo con ${n} rubro${n === 1 ? "" : "s"} capturado${n === 1 ? "" : "s"} por supervisión.`;
    etiqueta = "Guardar captura del supervisor";
  }
  if (resumen) {
    resumen.textContent = texto;
    resumen.classList.toggle("vl-hay-cambios", n > 0);
  }
  if (btn && !btn.disabled) btn.textContent = etiqueta;
  return n;
}

function renderValidacionEdicionGrid(clues, fecha) {
  const content = document.getElementById("validationReportContent");
  const title = document.getElementById("validationReportTitle");
  const subtitle = document.getElementById("validationReportSubtitle");
  const badge = document.getElementById("validationReportEditBadge");
  const cardsContainer = document.getElementById("validationCardsContainer");
  const nombreInput = document.getElementById("validationNombreResponsable");

  if (!content || !cardsContainer) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const report = _adminCapturasArray.find(r => r.clues === clues && r.fecha === fecha);
  _currentValidationReport = report;
  nombreInput.value = "";
  limpiarErroresValidacion();

  content.classList.remove("hidden");

  const unitMeta = _adminMetasArray.find(r => r.clues === clues);
  const metas = unitMeta ? unitMeta.metas : {};

  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _adminCapturasArray.forEach(r => {
      if (r.clues === clues && r.fecha !== fecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  if (report) {
    title.textContent = `Reporte de ${report.unidad}`;
    subtitle.textContent = `${etiquetaSemanaValidacion(fecha)} | Capturado por: ${report.capturado_por}`;

    if (report.editado_por !== "UNIDAD") {
      badge.classList.remove("hidden");
      const firma = firmaDeReporte(report) || report.editado_por;
      badge.textContent = validadoSinCambios(report)
        ? `Validado sin cambios por ${firma}`
        : `Corregido por ${firma}`;
    } else {
      badge.classList.add("hidden");
    }
  } else {
    const unidad = _allUnidades.find(u => u.clues === clues);
    title.textContent = `Sin reporte: ${unidad ? unidad.unidad : clues}`;
    subtitle.textContent = `${etiquetaSemanaValidacion(fecha)} | La unidad no ha enviado su reporte. Al guardar se creará uno nuevo.`;
    badge.classList.add("hidden");
  }

  cardsContainer.innerHTML = "";
  const avisoValHtml = avisoReglasSemana(fecha);
  if (avisoValHtml) {
    const aviso = document.createElement("div");
    aviso.className = "flex flex-col gap-2";
    aviso.innerHTML = avisoValHtml;
    cardsContainer.appendChild(aviso);
  }

  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const key = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rb);
  });

  const gruposSinMeta = [];
  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    // Un grupo donde la unidad no tiene meta en ningún renglón no se captura: va en un solo aviso al final,
    // no como una tabla entera de guiones.
    if (rubros.every(rb => !Number(metas[rb.id] || 0))) {
      gruposSinMeta.push(groupTitle);
      return;
    }
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    let rowsHtml = "";
    rubros.forEach(rb => {
      const meta = Number(metas[rb.id] || 0);
      const acum = acumuladosPrevios[rb.id];
      const val = report && report.valores[rb.id] !== undefined ? report.valores[rb.id] : "";
      const reglaCal = reglaDosisRubro(rb, fecha);
      const isLocked = meta === 0 || !!reglaCal;

      // Valor original capturado por la unidad: el primero del historial, o el actual si nunca se editó
      let originalVal = "—";
      if (report) {
        const orig = valoresOriginalesUnidad(report);
        originalVal = orig && orig[rb.id] !== undefined ? orig[rb.id] : (report.valores[rb.id] !== undefined ? report.valores[rb.id] : "0");
      }

      const currentVal = Number(val || 0);
      const pct = meta > 0 ? Math.round(((acum + currentVal) / meta) * 100) : 0;
      const cappedPct = Math.min(pct, 100);

      let barColor;
      if (!meta) barColor = '#94a3b8';
      else if (pct >= 85) barColor = '#047857';
      else if (pct >= 50) barColor = '#b45309';
      else barColor = '#b91c1c';

      const etiqueta = esc(`${rb.grupo || rb.categoria || ""} · ${rb.edad || ""}`);
      const motivoBloqueo = reglaCal
        ? `<span class="inf-pill-regla">${esc(reglaCal.etiqueta)}</span>`
        : (isLocked ? '<span class="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800">Sin meta</span>' : '');

      rowsHtml += `
        <tr class="border-b border-slate-100 last:border-0 ${isLocked ? 'vl-bloqueada' : ''}">
          <th scope="row" class="p-3 text-xs font-semibold text-slate-800 text-left">
            ${esc(rb.edad)}
            ${motivoBloqueo}
          </th>
          <td class="p-3 text-center text-xs font-bold text-slate-700">${meta || '—'}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-700">${originalVal}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-950">${acum}</td>
          <td class="p-3 text-center">
            <input type="number" min="0" step="1" inputmode="numeric"
              id="val_input_inf_${rb.id}" data-rubro="${rb.id}"
              aria-label="${etiqueta}: valor validado de esta semana${isLocked ? (reglaCal ? ' (no disponible esta semana)' : ' (la unidad no tiene meta)') : ''}"
              aria-describedby="val_over_inf_${rb.id}"
              class="text-center font-bold bg-slate-50 border border-slate-400 rounded-lg outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200 transition-all"
              value="${val}"
              ${isLocked ? 'disabled placeholder="—"' : 'placeholder="0"'}
            />
          </td>
          <td class="p-3" style="min-width: 130px;">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between w-full text-[12px] font-black text-slate-700">
                <span>Avance</span>
                <span id="val_pct_inf_${rb.id}">${meta > 0 ? `${pct}%` : 'N/A'}</span>
              </div>
              <div aria-hidden="true" style="width:100%; height:8px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
                <div id="val_bar_inf_${rb.id}" style="width:${cappedPct}%; height:100%; background:${barColor}; border-radius:6px; transition: width 0.3s ease;"></div>
              </div>
              <span id="val_over_inf_${rb.id}" class="vl-over" aria-live="polite">${meta > 0 && pct > 100 ? 'Supera la meta anual' : ''}</span>
            </div>
          </td>
        </tr>
      `;
    });

    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100 mb-2">
        <h4 class="text-xs font-black text-violet-950 uppercase tracking-wider m-0">${esc(groupTitle)}</h4>
      </div>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200" tabindex="0" role="region" aria-label="Tabla: ${esc(groupTitle)}">
        <table class="w-full border-collapse text-left text-xs text-slate-700">
          <caption class="vl-sr">${esc(groupTitle)}: dosis por rango de edad, con meta, captura de la unidad, acumulado, valor validado y avance.</caption>
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
              <th scope="col" class="p-3">Edad</th>
              <th scope="col" class="p-3 text-center">Meta anual</th>
              <th scope="col" class="p-3 text-center">Capturado por la unidad</th>
              <th scope="col" class="p-3 text-center">Acumulado otras semanas</th>
              <th scope="col" class="p-3 text-center">Valor validado</th>
              <th scope="col" class="p-3">Avance con este valor</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    cardsContainer.appendChild(card);
  });

  if (gruposSinMeta.length) {
    const sinMeta = document.createElement("div");
    sinMeta.className = "inf-aviso inf-aviso--info";
    sinMeta.textContent = `Sin meta para esta unidad (no se capturan): ${gruposSinMeta.join("; ")}.`;
    cardsContainer.appendChild(sinMeta);
  }

  // Un solo manejador para todos los campos: porcentaje, aviso de meta rebasada y resumen de cambios
  cardsContainer.oninput = (ev) => {
    const input = ev.target;
    if (!input || !input.matches || !input.matches("input[data-rubro]")) return;
    const id = input.dataset.rubro;
    const meta = Number(metas[id] || 0);
    const val = parseInt(input.value, 10) || 0;
    const pct = meta > 0 ? Math.round(((acumuladosPrevios[id] + val) / meta) * 100) : 0;
    const pctEl = document.getElementById(`val_pct_inf_${id}`);
    const barEl = document.getElementById(`val_bar_inf_${id}`);
    const overEl = document.getElementById(`val_over_inf_${id}`);
    if (pctEl) pctEl.textContent = meta > 0 ? `${pct}%` : "N/A";
    if (barEl) {
      barEl.style.width = `${Math.min(pct, 100)}%`;
      barEl.style.background = pct >= 85 ? "#047857" : pct >= 50 ? "#b45309" : "#b91c1c";
    }
    const rebasa = meta > 0 && pct > 100;
    if (overEl) overEl.textContent = rebasa ? "Supera la meta anual" : "";
    if (rebasa) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    actualizarResumenValidacion();
  };
  nombreInput.oninput = () => {
    nombreInput.removeAttribute("aria-invalid");
    document.getElementById("validationNombreGrupo")?.classList.remove("vl-invalido");
  };

  actualizarResumenValidacion();

  document.getElementById("btnCancelValidation").onclick = () => {
    const sucio = contarCambiosValidacion() > 0 || nombreInput.value.trim() !== "";
    if (sucio && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos y volver al listado?")) return;
    volverAlListadoValidacion();
  };

  document.getElementById("btnSaveValidation").onclick = () => {
    saveValidationReport(clues, fecha);
  };
}

async function saveValidationReport(clues, fecha) {
  const nombreInput = document.getElementById("validationNombreResponsable");
  const nombre = nombreInput ? nombreInput.value.trim() : "";

  limpiarErroresValidacion();
  const errores = [];

  if (!nombre) {
    errores.push({ msg: "Escribe el nombre de quien realiza o autoriza la corrección; queda firmado en el historial.", el: nombreInput });
  }

  const unitMeta = _adminMetasArray.find(r => r.clues === clues);
  const metas = unitMeta ? unitMeta.metas : {};

  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _adminCapturasArray.forEach(r => {
      if (r.clues === clues && r.fecha !== fecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  const valores = {};

  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`val_input_inf_${rb.id}`);
    const nombreRubro = `${rb.grupo || rb.categoria} · ${rb.edad}`;
    const raw = input ? String(input.value).trim() : "";
    if (input && !input.disabled && raw !== "" && !/^\d+$/.test(raw)) {
      errores.push({ msg: `${nombreRubro}: escribe un número entero de 0 en adelante.`, el: input });
    }
    const val = input ? parseInt(input.value, 10) || 0 : 0;
    valores[rb.id] = val;

    const meta = Number(metas[rb.id] || 0);
    const previo = Number(_currentValidationReport?.valores?.[rb.id] || 0);
    if (val > previo) {
      if (!meta) errores.push({ msg: `${nombreRubro}: la unidad no tiene meta asignada en este rubro.`, el: input });
      const cal = reglaDosisRubro(rb, fecha);
      if (cal) errores.push({ msg: `${nombreRubro}: ${cal.texto}`, el: input });
    }
    const acum = acumuladosPrevios[rb.id];
    if (meta > 0 && (acum + val) > meta) {
      errores.push({ msg: `${nombreRubro}: con ${val} dosis el acumulado (${acum + val}) supera la meta anual de ${meta}. Máximo para esta semana: ${Math.max(0, meta - acum)}.`, el: input });
    }
  }

  if (errores.length) {
    mostrarErroresValidacion(errores);
    return;
  }

  const sinCambios = !!_currentValidationReport && contarCambiosValidacion() === 0;

  const unitData = _allUnidades.find(u => u.clues === clues);
  const unidadNombre = unitData ? unitData.unidad : "Unidad Médica";
  const municipio = unitData ? unitData.municipio : USER.municipio;

  // El historial lo arma el servidor (saveinfluenza_captura): aquí solo se manda quién firma y si fue sin cambios.
  const payload = {
    clues,
    unidad: unidadNombre,
    municipio,
    fecha,
    valores,
    anio_campana: document.getElementById("metaCampaignSelect").value,
    capturado_por: _currentValidationReport ? _currentValidationReport.capturado_por : nombre,
    editado_por: USER.rol.toUpperCase(),
    firmado_por: nombre,
    sin_cambios: sinCambios
  };

  await AppService.runCapture({
    btnId: "btnSaveValidation",
    title: sinCambios ? "Validando reporte" : "Guardando corrección",
    msg: sinCambios ? "Registrando la validación firmada por el supervisor..." : "Registrando la corrección firmada por el supervisor...",
    successMsg: sinCambios ? "Reporte validado sin cambios." : "Reporte de validación guardado correctamente.",
    eventTitle: "Influenza",
    eventMsg: `${sinCambios ? "Validación" : "Edición"} de reporte de ${unidadNombre} por supervisor ${nombre}`,
    action: async () => {
      const res = await AppService.call("saveinfluenza_captura", payload);
      await loadInfluenzaAdminData();
      volverAlListadoValidacion(sinCambios ? `Reporte de ${unidadNombre} validado sin cambios.` : `Corrección de ${unidadNombre} guardada.`);
      const sinMovimientoVisual = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof confetti === 'function' && !sinMovimientoVisual) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      return res;
    }
  });
}

// 1.2 CONCILIACIÓN VS CSV
function initConciliacionTab() {
  const runBtn = document.getElementById("btnRunConciliacion");
  const resultContainer = document.getElementById("conciliacionResultContainer");
  const exportBtn = document.getElementById("btnExportConciliacion");
  const searchInput = document.getElementById("conciliacionSearch");
  const closeDrawerBtn = document.getElementById("btnCloseConciliacionDrawer");
  const backdrop = document.getElementById("conciliacionDrawerBackdrop");

  const filterAllBtn = document.getElementById("btnFilterConcAll");
  const filterDiffBtn = document.getElementById("btnFilterConcDiff");
  const filterMatchBtn = document.getElementById("btnFilterConcMatch");

  if (!runBtn || !resultContainer) return;

  // Limpiar estados
  _uploadedCsvData = null;
  _conciliacionLastResult = [];
  _conciliacionFilter = "all";
  _conciliacionSearchQuery = "";

  // Botón Consultar Base de Datos
  runBtn.onclick = () => {
    const docInfo = document.getElementById("conciliacionSourceInfo");
    if (docInfo) docInfo.textContent = "Fuente: Consulta de Base de Datos";
    
    const mesAnio = document.getElementById("conciliacionMes").value;
    const clues = document.getElementById("conciliacionClues").value;
    runConciliacionProcess(clues, mesAnio);
  };

  // Filtros de Estado
  const updateFilterButtons = (activeBtn) => {
    [filterAllBtn, filterDiffBtn, filterMatchBtn].forEach(btn => {
      if (!btn) return;
      btn.className = "px-3 py-1.5 text-[11px] font-bold text-slate-500 rounded-lg transition-all focus:outline-none hover:text-slate-700";
    });
    if (activeBtn) {
      activeBtn.className = "px-3 py-1.5 text-[11px] font-black rounded-lg transition-all focus:outline-none bg-surface text-slate-700 shadow-xs";
    }
  };

  if (filterAllBtn) {
    filterAllBtn.onclick = () => {
      _conciliacionFilter = "all";
      updateFilterButtons(filterAllBtn);
      applyConciliacionFiltersAndSearch();
    };
  }
  if (filterDiffBtn) {
    filterDiffBtn.onclick = () => {
      _conciliacionFilter = "diff";
      updateFilterButtons(filterDiffBtn);
      applyConciliacionFiltersAndSearch();
    };
  }
  if (filterMatchBtn) {
    filterMatchBtn.onclick = () => {
      _conciliacionFilter = "match";
      updateFilterButtons(filterMatchBtn);
      applyConciliacionFiltersAndSearch();
    };
  }

  // Buscador
  if (searchInput) {
    searchInput.oninput = (e) => {
      _conciliacionSearchQuery = e.target.value;
      applyConciliacionFiltersAndSearch();
    };
  }

  // Exportar Excel
  if (exportBtn) {
    exportBtn.onclick = async () => {
      await exportConciliacionReport();
    };
  }

  // Cerrar Drawer
  if (closeDrawerBtn) closeDrawerBtn.onclick = closeConciliacionDrawer;
  if (backdrop) backdrop.onclick = closeConciliacionDrawer;
}

// Ejecutar proceso de conciliación
async function runConciliacionProcess(clues, mesAnio) {
  const resultContainer = document.getElementById("conciliacionResultContainer");
  const tbody = document.getElementById("conciliacionTbody");
  const title = document.getElementById("conciliacionTitle");
  const statusEl = document.getElementById("conciliacionGeneralStatus");

  if (!resultContainer || !tbody) return;

  const [mes, anio] = mesAnio.split("|").map(Number);
  const unitData = _allUnidades.find(u => u.clues === clues);
  const unitName = unitData ? unitData.unidad : clues;

  resultContainer.classList.remove("hidden");
  title.textContent = `Conciliación de Carga: ${unitName} (${clues}) — Mes ${mes}/${anio}`;

  let sisRecords = [];

  // Consultar Base de Datos Supabase (Dato Inmutable)
  const { data, error } = await window.supabase
    .from("registros_sis")
    .select("variable_sis, valor")
    .eq("clues", clues)
    .eq("mes", mes)
    .eq("anio", anio);

  if (error) {
    console.error("Error al cargar registros del SIS:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-rose-500 font-bold">Error al cargar datos del SIS oficial.</td></tr>`;
    return;
  }
  sisRecords = data || [];

  // Sumar capturas locales de _adminCapturasArray
  const localValues = {};
  INFLUENZA_RUBROS.forEach(rb => {
    localValues[rb.id] = 0;
  });

  _adminCapturasArray.forEach(c => {
    if (c.clues === clues) {
      const d = new Date(c.fecha + "T12:00:00");
      if (d.getMonth() + 1 === mes && d.getFullYear() === anio) {
        INFLUENZA_RUBROS.forEach(rb => {
          localValues[rb.id] += Number(c.valores[rb.id] || 0);
        });
      }
    }
  });

  _conciliacionLastResult = [];
  let totalLocal = 0;
  let totalSis = 0;
  let totalDiff = 0;
  let discrepanciasCount = 0;

  INFLUENZA_RUBROS.forEach(rb => {
    const sisVar = window.INFLUENZA_SIS_MAPPING[rb.id];
    const sisRec = sisRecords.find(r => r.variable_sis === sisVar);
    const sisVal = sisRec ? Number(sisRec.valor || 0) : 0;
    const localVal = localValues[rb.id];
    const diff = localVal - sisVal;

    totalLocal += localVal;
    totalSis += sisVal;
    totalDiff += diff;

    if (diff !== 0) {
      discrepanciasCount++;
    }

    _conciliacionLastResult.push({
      rb,
      sisVar,
      localVal,
      sisVal,
      diff
    });
  });

  // Renderizar tabla aplicando filtros y buscador
  applyConciliacionFiltersAndSearch();

  // Actualizar Tarjetas KPI
  const kpiTasa = document.getElementById("kpiTasa");
  const kpiTasaIcon = document.getElementById("kpiTasaIcon");
  const kpiLocal = document.getElementById("kpiLocal");
  const kpiSis = document.getElementById("kpiSis");
  const kpiDiscrepancias = document.getElementById("kpiDiscrepancias");

  const totalRubros = INFLUENZA_RUBROS.length;
  const tasaPareo = totalRubros > 0 ? ((1 - (discrepanciasCount / totalRubros)) * 100) : 100;
  
  if (kpiTasa) kpiTasa.textContent = `${tasaPareo.toFixed(1)}%`;
  if (kpiLocal) kpiLocal.textContent = totalLocal.toLocaleString('es-MX');
  if (kpiSis) kpiSis.textContent = totalSis.toLocaleString('es-MX');
  if (kpiDiscrepancias) {
    kpiDiscrepancias.textContent = `${discrepanciasCount} (${totalDiff > 0 ? `+${totalDiff}` : totalDiff})`;
  }

  // Actualizar ícono de la tasa
  if (kpiTasaIcon) {
    if (tasaPareo === 100) {
      kpiTasaIcon.textContent = "check_circle";
      kpiTasaIcon.parentElement.className = "w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0";
    } else if (tasaPareo > 85) {
      kpiTasaIcon.textContent = "info";
      kpiTasaIcon.parentElement.className = "w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0";
    } else {
      kpiTasaIcon.textContent = "error";
      kpiTasaIcon.parentElement.className = "w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0";
    }
  }

  // Fila de totales en el status general
  if (discrepanciasCount > 0) {
    statusEl.className = "px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200";
    statusEl.textContent = `Desconciliado (${discrepanciasCount} discrepancias encontradas)`;
  } else {
    statusEl.className = "px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200";
    statusEl.textContent = "Datos 100% Conciliados";
  }
}

// Aplicar filtros y búsquedas en caliente a la tabla
function applyConciliacionFiltersAndSearch() {
  const tbody = document.getElementById("conciliacionTbody");
  if (!tbody || !_conciliacionLastResult.length) return;

  tbody.innerHTML = "";
  let filtered = _conciliacionLastResult;

  // 1. Filtrar por estado
  if (_conciliacionFilter === "diff") {
    filtered = filtered.filter(item => item.diff !== 0);
  } else if (_conciliacionFilter === "match") {
    filtered = filtered.filter(item => item.diff === 0);
  }

  // 2. Filtrar por búsqueda
  if (_conciliacionSearchQuery.trim()) {
    const q = _conciliacionSearchQuery.toLowerCase();
    filtered = filtered.filter(item => 
      item.rb.categoria.toLowerCase().includes(q) ||
      item.rb.grupo.toLowerCase().includes(q) ||
      item.rb.edad.toLowerCase().includes(q) ||
      item.sisVar.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-semibold">No se encontraron rubros con los filtros aplicados.</td></tr>`;
    return;
  }

  let subLocal = 0;
  let subSis = 0;
  let subDiff = 0;

  filtered.forEach(item => {
    const isDiscrepant = item.diff !== 0;
    subLocal += item.localVal;
    subSis += item.sisVal;
    subDiff += item.diff;

    const row = document.createElement("tr");
    if (isDiscrepant) {
      row.className = "border-b border-slate-100 font-bold bg-rose-50/10 hover:bg-rose-50/20";
    } else {
      row.className = "border-b border-slate-100 hover:bg-slate-50";
    }

    row.innerHTML = `
      <td class="p-3">
        <div style="max-width: 420px; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35;" title="${item.rb.categoria} - ${item.rb.grupo} (${item.rb.edad})">
          ${item.rb.categoria} - ${item.rb.grupo} (${item.rb.edad})
        </div>
      </td>
      <td class="p-3 text-center text-xs font-mono font-bold text-slate-500">${item.sisVar}</td>
      <td class="p-3 text-center text-xs font-bold">${item.localVal.toLocaleString('es-MX')}</td>
      <td class="p-3 text-center text-xs font-bold">${item.sisVal.toLocaleString('es-MX')}</td>
      <td class="p-3 text-center text-xs font-black ${item.diff > 0 ? 'text-indigo-600' : item.diff < 0 ? 'text-rose-600' : 'text-emerald-600'}">
        ${item.diff > 0 ? `+${item.diff}` : item.diff}
      </td>
      <td class="p-3 text-center text-xs">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${isDiscrepant ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
          ${isDiscrepant ? 'Desfase' : 'Conciliado'}
        </span>
      </td>
      <td class="p-3 text-center">
        <button class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-primary transition-colors btn-conciliacion-detalle" data-rubro-id="${item.rb.id}" title="Auditar capturas locales">
          <span class="material-symbols-rounded text-[18px]">history</span>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Fila de totales del filtro
  const totalRow = document.createElement("tr");
  totalRow.className = "bg-slate-50 border-t border-slate-300 font-extrabold text-slate-900";
  totalRow.innerHTML = `
    <td class="p-3 text-xs uppercase text-right" colspan="2">TOTAL FILTRADO:</td>
    <td class="p-3 text-center text-xs">${subLocal.toLocaleString('es-MX')}</td>
    <td class="p-3 text-center text-xs">${subSis.toLocaleString('es-MX')}</td>
    <td class="p-3 text-center text-xs ${subDiff > 0 ? 'text-indigo-700' : subDiff < 0 ? 'text-rose-700' : 'text-emerald-700'}">
      ${subDiff > 0 ? `+${subDiff}` : subDiff}
    </td>
    <td class="p-3 text-center text-xs" colspan="2">
      <span class="px-2 py-0.5 rounded-full font-black ${subDiff !== 0 ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}">
        ${subDiff !== 0 ? 'Diferencia Activa' : 'Sincronizado'}
      </span>
    </td>
  `;
  tbody.appendChild(totalRow);

  // Agregar click listener a los botones de auditoría
  tbody.querySelectorAll(".btn-conciliacion-detalle").forEach(btn => {
    btn.onclick = () => {
      const rubroId = btn.getAttribute("data-rubro-id");
      openAuditDrawer(rubroId);
    };
  });
}

// Abrir Drawer de Auditoría Lateral
function openAuditDrawer(rubroId) {
  const drawer = document.getElementById("conciliacionDrawer");
  const backdrop = document.getElementById("conciliacionDrawerBackdrop");
  const nameEl = document.getElementById("drawerRubroName");
  const contentEl = document.getElementById("drawerContent");

  if (!drawer || !backdrop) return;

  const rb = INFLUENZA_RUBROS.find(r => r.id === rubroId);
  if (!rb) return;

  nameEl.textContent = `${rb.categoria} - ${rb.grupo} (${rb.edad})`;

  const mesAnio = document.getElementById("conciliacionMes").value;
  const clues = document.getElementById("conciliacionClues").value;
  const [mes, anio] = mesAnio.split("|").map(Number);

  // Buscar capturas locales
  const matchingCapturas = [];
  _adminCapturasArray.forEach(c => {
    if (c.clues === clues) {
      const d = new Date(c.fecha + "T12:00:00");
      if (d.getMonth() + 1 === mes && d.getFullYear() === anio) {
        const val = Number(c.valores[rubroId] || 0);
        if (val > 0) {
          matchingCapturas.push({
            fecha: c.fecha,
            valor: val,
            usuario: c.capturado_por || c.usuario || "Usuario del Sistema",
            comentarios: c.comentarios || ""
          });
        }
      }
    }
  });

  // Ordenar por fecha descendente
  matchingCapturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  contentEl.innerHTML = "";

  if (matchingCapturas.length === 0) {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <span class="material-symbols-rounded text-[48px] mb-2">assignment_late</span>
        <p class="text-sm font-semibold">No hay capturas locales registradas para este rubro en este mes.</p>
      </div>
    `;
  } else {
    const timeline = document.createElement("div");
    timeline.className = "flex flex-col gap-4 relative border-l-2 border-slate-100 pl-4 ml-2";

    matchingCapturas.forEach(cap => {
      const item = document.createElement("div");
      item.className = "relative mb-1";

      const dateParts = cap.fecha.split("-");
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

      item.innerHTML = `
        <div class="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface"></div>
        <div class="bg-slate-50 border border-slate-150 rounded-xl p-3 shadow-2xs hover:bg-slate-100/50 transition-colors">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-bold text-slate-800">${formattedDate}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary">${cap.valor} dosis</span>
          </div>
          <div class="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
            <span class="material-symbols-rounded text-[12px]">person</span>
            ${cap.usuario}
          </div>
          ${cap.comentarios ? `
            <div class="mt-2 text-[10px] italic text-slate-600 bg-surface border border-slate-100 p-2 rounded-lg">
              "${cap.comentarios}"
            </div>
          ` : ""}
        </div>
      `;
      timeline.appendChild(item);
    });

    contentEl.appendChild(timeline);
  }

  drawer.classList.remove("hidden");
  backdrop.classList.remove("hidden");

  // Pequeño timeout para asegurar que el DOM dibuje la clase hidden y luego anime
  setTimeout(() => {
    drawer.classList.remove("translate-x-full");
    backdrop.classList.remove("opacity-0");
  }, 30);
}

// Cerrar Drawer de Auditoría Lateral
function closeConciliacionDrawer() {
  const drawer = document.getElementById("conciliacionDrawer");
  const backdrop = document.getElementById("conciliacionDrawerBackdrop");

  if (!drawer || !backdrop) return;

  drawer.classList.add("translate-x-full");
  backdrop.classList.add("opacity-0");

  setTimeout(() => {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
  }, 300);
}

// Exportar Reporte de Conciliación a Excel con ExcelJS
async function exportConciliacionReport() {
  if (!_conciliacionLastResult || _conciliacionLastResult.length === 0) {
    showToast("No hay datos de conciliación para exportar.", false, "bad");
    return;
  }

  const mesAnio = document.getElementById("conciliacionMes").value;
  const clues = document.getElementById("conciliacionClues").value;
  const [mes, anio] = mesAnio.split("|").map(Number);
  const unitData = _allUnidades.find(u => u.clues === clues);
  const unitName = unitData ? unitData.unidad : clues;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Conciliación SIS');

    sheet.columns = [
      { header: 'Rubro (Edad)', key: 'rubro', width: 45 },
      { header: 'Clave SIS', key: 'clave', width: 15 },
      { header: 'Captura Local', key: 'local', width: 20 },
      { header: 'SIS Oficial (CSV)', key: 'sis', width: 20 },
      { header: 'Diferencia', key: 'diff', width: 15 },
      { header: 'Estatus', key: 'status', width: 15 }
    ];

    sheet.insertRow(1, []);
    sheet.insertRow(2, [`REPORTE DE CONCILIACIÓN DE INFLUENZA`]);
    sheet.insertRow(3, [`Unidad: ${unitName} (${clues})  |  Mes: ${mes}/${anio}`]);
    sheet.insertRow(4, [`Fecha de exportación: ${new Date().toLocaleDateString('es-MX')}`]);
    sheet.insertRow(5, []);

    sheet.mergeCells('A2:F2');
    sheet.mergeCells('A3:F3');
    sheet.mergeCells('A4:F4');

    const titleCell = sheet.getCell('A2');
    titleCell.font = { name: 'Montserrat', family: 4, size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center' };

    const subtitleCell = sheet.getCell('A3');
    subtitleCell.font = { name: 'Montserrat', family: 4, size: 11, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { horizontal: 'center' };

    const dateCell = sheet.getCell('A4');
    dateCell.font = { name: 'Montserrat', family: 4, size: 9, color: { argb: 'FF64748B' } };
    dateCell.alignment = { horizontal: 'center' };

    const headerRow = sheet.getRow(6);
    headerRow.values = ['Rubro (Edad)', 'Clave SIS', 'Captura Local', 'SIS Oficial (CSV)', 'Diferencia', 'Estatus'];
    headerRow.font = { name: 'Montserrat', family: 4, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 25;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    let rowIdx = 7;
    let totalLocal = 0;
    let totalSis = 0;

    _conciliacionLastResult.forEach(item => {
      const isDiscrepant = item.diff !== 0;
      totalLocal += item.localVal;
      totalSis += item.sisVal;

      const row = sheet.addRow({
        rubro: `${item.rb.categoria} - ${item.rb.grupo} (${item.rb.edad})`,
        clave: item.sisVar,
        local: item.localVal,
        sis: item.sisVal,
        diff: item.diff,
        status: isDiscrepant ? 'Desfase' : 'Conciliado'
      });

      row.height = 20;
      row.getCell('rubro').alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell('clave').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('local').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('sis').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('diff').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Montserrat', family: 4, size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (isDiscrepant) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF1F2' }
          };
          if (colNumber === 5) {
            cell.font = { name: 'Montserrat', family: 4, size: 9, bold: true, color: { argb: 'FFE11D48' } };
          }
          if (colNumber === 6) {
            cell.font = { name: 'Montserrat', family: 4, size: 9, bold: true, color: { argb: 'FF9F1239' } };
          }
        } else {
          if (colNumber === 5) {
            cell.font = { name: 'Montserrat', family: 4, size: 9, color: { argb: 'FF059669' } };
          }
          if (colNumber === 6) {
            cell.font = { name: 'Montserrat', family: 4, size: 9, bold: true, color: { argb: 'FF065F46' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE6F4EA' }
            };
          }
        }
      });

      rowIdx++;
    });

    const totalRow = sheet.addRow({
      rubro: 'TOTAL GENERAL:',
      clave: '',
      local: totalLocal,
      sis: totalSis,
      diff: totalLocal - totalSis,
      status: totalLocal === totalSis ? 'Sincronizado' : 'Desfases'
    });
    totalRow.height = 24;
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);

    totalRow.eachCell((cell) => {
      cell.font = { name: 'Montserrat', family: 4, size: 10, bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF475569' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    totalRow.getCell('rubro').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('local').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('sis').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('diff').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Conciliacion_Influenza_${clues}_Mes_${mes}_${anio}.xlsx`;
    link.click();

    showToast("Reporte de conciliación exportado correctamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar a Excel:", err);
    showToast("Error al exportar el reporte a Excel.", false, "bad");
  }
}

// --- FUNCIONES PREMIUM DE EXPORTACIÓN A EXCEL (CON EXCELJS) ---

function applyPremiumStyles(cell, options = {}) {
  cell.font = {
    name: 'Montserrat',
    family: 4,
    size: options.size || 9,
    bold: !!options.bold,
    italic: !!options.italic,
    color: options.color
  };
  if (options.align) {
    cell.alignment = { horizontal: options.align, vertical: 'middle' };
  }
}

function copyColumnStyle(ws, srcColIndex, destColIndex) {
  for (let row = 10; row <= 59; row++) {
    const srcCell = ws.getCell(row, srcColIndex);
    const destCell = ws.getCell(row, destColIndex);
    
    // Clonar las propiedades de estilo para evitar referencias cruzadas
    destCell.font = srcCell.font ? { ...srcCell.font } : undefined;
    destCell.fill = srcCell.fill ? { ...srcCell.fill } : undefined;
    destCell.border = srcCell.border ? { ...srcCell.border } : undefined;
    destCell.alignment = srcCell.alignment ? { ...srcCell.alignment } : undefined;
    destCell.numFmt = srcCell.numFmt;
  }
}

function centerHeadersAcrossColumns(ws, lastColIndex) {
  const lastColLetter = ws.getColumn(lastColIndex).letter;
  for (let row = 1; row <= 5; row++) {
    try {
      ws.unmergeCells(`A${row}:L${row}`);
    } catch(e) {}
    try {
      ws.unmergeCells(`A${row}:I${row}`);
    } catch(e) {}
    try {
      ws.mergeCells(`A${row}:${lastColLetter}${row}`);
      ws.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      applyPremiumStyles(ws.getCell(`A${row}`), { bold: row === 5 ? false : true, size: row === 1 ? 14 : row === 5 ? 10 : 11 });
    } catch(e) {}
  }
}

function applyPremiumFooterAndPageSetup(ws, activeCampana) {
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };
  ws.headerFooter = {
    oddFooter: `&L&"Montserrat,Regular"&8Campaña: ${activeCampana} &C&"Montserrat,Regular"&8Fecha de Reporte: ${new Date().toLocaleDateString()} &R&"Montserrat,Regular"&8Página &P de &N`
  };
}

// 1. PLANTILLA 1: Reporte mensual por unidad separado por semanas
async function exportWeeklyMonthlyUnitExcel(clues, unidadNombre, mesAnio) {
  try {
    showToast("Generando reporte mensual por semanas...", true, "info");
    
    const [mes, anio] = mesAnio.split("|").map(Number);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mesNombre = monthNames[mes - 1];
    
    const response = await fetch(encodeURI("./Formatos/PLANTILLA REPORTE POR SEMANA.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de reporte semanal.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    const ws = wb.worksheets[0];
    
    // Escribir cabecera
    const cellUnit = ws.getCell('B6');
    cellUnit.value = `UNIDAD DE SALUD: ${unidadNombre.toUpperCase()} (${clues})`;
    applyPremiumStyles(cellUnit, { bold: true, size: 10 });
    
    const cellMonth = ws.getCell('I6');
    cellMonth.value = `MES: ${mesNombre.toUpperCase()} ${anio}`;
    applyPremiumStyles(cellMonth, { bold: true, size: 10 });
    
    // Limpiar cuadrícula de semanas (Semana 1 a 5 = Columnas G a K / 7 a 11)
    for (let r = 9; r <= 54; r++) {
      for (let c = 7; c <= 11; c++) {
        ws.getCell(r, c).value = null;
      }
    }
    
    // Obtener capturas del mes y unidad
    const campana = campaignSeasonLabel();
    const unitCaptures = _adminCapturasArray.filter(c => c.clues === clues);
    
    unitCaptures.forEach(cap => {
      const capDate = new Date(cap.fecha + "T12:00:00");
      if (capDate.getMonth() + 1 === mes && capDate.getFullYear() === anio) {
        const { weekNumInMonth } = mapDateToMonthAndWeek(cap.fecha);
        INFLUENZA_RUBROS.forEach((rb, idx) => {
          const row = 9 + idx;
          const col = 7 + (weekNumInMonth - 1);
          const val = Number(cap.valores[rb.id] || 0);
          
          ws.getCell(row, col).value = (ws.getCell(row, col).value || 0) + val;
        });
      }
    });
    
    // Aplicar fuentes y formatos en las celdas semanales
    for (let r = 9; r <= 54; r++) {
      for (let c = 7; c <= 12; c++) {
        const cell = ws.getCell(r, c);
        applyPremiumStyles(cell, { size: 9, bold: r === 54 });
        if (cell.value !== null && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      }
    }
    
    applyPremiumFooterAndPageSetup(ws, campana);
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Semanal_Mensual_${unidadNombre.replace(/ /g, "_")}_${mesNombre}_${anio}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte mensual descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar reporte semanal:", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

// 2. PLANTILLA 2: Concentrado de totales (Simple)
async function exportConcentradoSimpleExcel() {
  const scope = document.getElementById("adminInfluenzaExportScope")?.value || "single";
  const selectMuni = document.getElementById("adminInfluenzaMuni")?.value || USER.municipio;
  const role = USER.rol.toUpperCase();
  
  if (role === "ADMIN" || role === "JURISDICCIONAL") {
    if (scope === "muni_4") {
      const munis = ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"];
      for (const m of munis) {
        await generateConcentradoSimpleFile(m, "municipio");
      }
      return;
    } else if (scope === "single") {
      await generateConcentradoSimpleFile(null, "jurisdiccion");
      return;
    }
  }
  
  // Default o rol Municipal
  await generateConcentradoSimpleFile(selectMuni, "municipio");
}

async function generateConcentradoSimpleFile(muniName, type = "municipio") {
  try {
    const scopeLabel = type === "jurisdiccion" ? "JURISDICCION SANITARIA" : `MUNICIPIO DE ${muniName}`;
    showToast(`Generando Concentrado Simple para ${scopeLabel}...`, true, "info");
    
    const response = await fetch(encodeURI("./Formatos/PLANTILLA, CONCENTRADO DE INFLUENZA.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de concentrado.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    const ws = wb.worksheets[0];
    
    // Escribir cabecera
    const cellScope = ws.getCell('B8');
    cellScope.value = `ÁMBITO DE EXPORTACIÓN: ${scopeLabel}`;
    applyPremiumStyles(cellScope, { bold: true, size: 10 });
    
    // Obtener unidades
    let targetUnits = _allUnidades;
    if (type === "municipio") {
      targetUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === muniName.toUpperCase());
    }
    const targetClues = targetUnits.map(u => u.clues);
    
    // Mapear Meta y Logro
    INFLUENZA_RUBROS.forEach((rb, idx) => {
      const row = 11 + idx;
      
      // Sumar metas
      let totalMeta = 0;
      targetClues.forEach(clues => {
        const mRecord = _adminMetasArray.find(m => m.clues === clues);
        totalMeta += mRecord ? Number(mRecord.metas[rb.id] || 0) : 0;
      });
      
      // Sumar logros (todas las semanas reportadas)
      let totalLogro = 0;
      _adminCapturasArray.forEach(cap => {
        if (targetClues.includes(cap.clues)) {
          totalLogro += Number(cap.valores[rb.id] || 0);
        }
      });
      
      ws.getCell(row, 7).value = totalLogro; // Logro (G)
      ws.getCell(row, 8).value = totalMeta;  // Meta (H)
      ws.getCell(row, 9).value = { formula: `IFERROR(G${row}/H${row}," ")` }; // % (I)
    });
    
    // Aplicar fuentes y formatos Montserrat
    for (let r = 11; r <= 58; r++) {
      for (let c = 7; c <= 9; c++) {
        const cell = ws.getCell(r, c);
        applyPremiumStyles(cell, { size: 9, bold: r >= 57 });
        if (c !== 9 && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        } else if (c === 9) {
          cell.numFmt = '0.0%';
        }
      }
    }
    
    const campana = campaignSeasonLabel();
    applyPremiumFooterAndPageSetup(ws, campana);
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Concentrado_Totales_Influenza_${scopeLabel.replace(/ /g, "_")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Concentrado simple de ${type} descargado.`, true, "good");
  } catch (err) {
    console.error("Error al generar concentrado simple:", err);
    showToast("Error al generar el concentrado.", false, "bad");
  }
}

// 3. PLANTILLA 3: Concentrado Detallado con Unidades/Municipios
async function exportConcentradoDetalladoUnidadesExcel() {
  const scope = document.getElementById("adminInfluenzaExportScope")?.value || "single";
  const selectMuni = document.getElementById("adminInfluenzaMuni")?.value || USER.municipio;
  const role = USER.rol.toUpperCase();
  
  if (role === "ADMIN" || role === "JURISDICCIONAL") {
    if (scope === "muni_4") {
      const munis = ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"];
      for (const m of munis) {
        await generateConcentradoDetalladoFile(m, "municipio");
      }
      return;
    } else if (scope === "single") {
      await generateConcentradoDetalladoFile(null, "jurisdiccion");
      return;
    }
  }
  
  // Default o rol Municipal
  await generateConcentradoDetalladoFile(selectMuni, "municipio");
}

async function generateConcentradoDetalladoFile(muniName, type = "municipio") {
  try {
    const scopeLabel = type === "jurisdiccion" ? "CONSOLIDADO JURISDICCIONAL" : `MUNICIPIO: ${muniName}`;
    showToast(`Generando Concentrado Detallado para ${scopeLabel}...`, true, "info");
    
    const response = await fetch(encodeURI("./Formatos/PLANTILLA, CONCENTRADO DE INFLUENZA CON UNIDADES O MUNICIPIOS.xlsx"));
    if (!response.ok) throw new Error("No se pudo cargar la plantilla detallada.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    const ws = wb.worksheets[0];
    
    // Cabecera
    const cellScope = ws.getCell('B8');
    cellScope.value = `ÁMBITO: ${scopeLabel}`;
    applyPremiumStyles(cellScope, { bold: true, size: 10 });
    
    let currentColumn = 7; // Empezar en Columna G (7)
    
    // Si es municipal, listamos las unidades de ese municipio
    if (type === "municipio") {
      const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muniName.toUpperCase());
      
      // Asegurarse de ordenar por CLUES como se especificó
      units.sort((a, b) => a.clues.localeCompare(b.clues));
      
      units.forEach(u => {
        writeUnitDataColumns(ws, currentColumn, u.unidad, u.clues, [u.clues]);
        currentColumn += 3;
      });
      
      // Agregar columna de TOTAL MUNICIPAL
      writeUnitDataColumns(ws, currentColumn, `TOTAL ${muniName}`, "MUNICIPAL", units.map(u => u.clues), true);
      currentColumn += 3;
      
    } else {
      // Jurisdiccional consolidado en un solo archivo:
      // Agrupar unidades por municipio, ordenadas por CLUES
      const munis = ["CORREGIDORA", "HUIMILPAN", "MARQUES", "QUERETARO"];
      
      munis.forEach(m => {
        const unitsMuni = _allUnidades.filter(u => u.municipio.toUpperCase() === m.toUpperCase());
        unitsMuni.sort((a, b) => a.clues.localeCompare(b.clues));
        
        // Escribir las unidades de este municipio
        unitsMuni.forEach(u => {
          writeUnitDataColumns(ws, currentColumn, u.unidad, u.clues, [u.clues]);
          currentColumn += 3;
        });
        
        // Escribir Subtotal del municipio
        writeUnitDataColumns(ws, currentColumn, `TOTAL ${m}`, `SUBTOTAL ${m}`, unitsMuni.map(u => u.clues), true);
        currentColumn += 3;
      });
      
      // Al final, TOTAL JURISDICCIONAL
      writeUnitDataColumns(ws, currentColumn, "TOTAL JURISDICCIONAL", "JURISDICCIONAL", _allUnidades.map(u => u.clues), true);
      currentColumn += 3;
    }
    
    // Centrar logos y cabeceras de títulos de forma adaptativa
    centerHeadersAcrossColumns(ws, currentColumn - 1);
    
    // Formato de página y pie de página
    const campana = campaignSeasonLabel();
    applyPremiumFooterAndPageSetup(ws, campana);
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Concentrado_Detallado_Influenza_${scopeLabel.replace(/ /g, "_")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Concentrado con unidades de ${muniName || 'Jurisdicción'} descargado.`, true, "good");
  } catch (err) {
    console.error("Error al generar concentrado detallado:", err);
    showToast("Error al generar el concentrado detallado.", false, "bad");
  }
}

// Helper para escribir un grupo de 3 columnas (Logro, Meta, %) para una unidad o totalizador
function writeUnitDataColumns(ws, startCol, headerName, clues, cluesArray, isTotal = false) {
  // Copiar estilos de columnas G, H, I (7, 8, 9)
  copyColumnStyle(ws, 7, startCol);
  copyColumnStyle(ws, 8, startCol + 1);
  copyColumnStyle(ws, 9, startCol + 2);
  
  const col1Letter = ws.getColumn(startCol).letter;
  const col2Letter = ws.getColumn(startCol + 1).letter;
  const col3Letter = ws.getColumn(startCol + 2).letter;
  
  // Fusionar fila 10 para el nombre de la unidad/municipio
  try {
    ws.mergeCells(`${col1Letter}10:${col3Letter}10`);
  } catch(e) {}
  
  const headerCell = ws.getCell(`${col1Letter}10`);
  headerCell.value = `${headerName.toUpperCase()}\n(${clues})`;
  applyPremiumStyles(headerCell, { bold: true, size: 8, align: 'center' });
  headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  
  // Rellenar subencabezados fila 11
  ws.getCell(`${col1Letter}11`).value = "LOGRO";
  ws.getCell(`${col2Letter}11`).value = "META";
  ws.getCell(`${col3Letter}11`).value = "%";
  
  // Poblar rubros (Fila 12 a 57)
  INFLUENZA_RUBROS.forEach((rb, idx) => {
    const row = 12 + idx;
    
    // Metas
    let metaVal = 0;
    cluesArray.forEach(c => {
      const mRecord = _adminMetasArray.find(m => m.clues === c);
      metaVal += mRecord ? Number(mRecord.metas[rb.id] || 0) : 0;
    });
    
    // Logros
    let logroVal = 0;
    _adminCapturasArray.forEach(cap => {
      if (cluesArray.includes(cap.clues)) {
        logroVal += Number(cap.valores[rb.id] || 0);
      }
    });
    
    const cellL = ws.getCell(row, startCol);
    const cellM = ws.getCell(row, startCol + 1);
    const cellP = ws.getCell(row, startCol + 2);
    
    cellL.value = logroVal;
    cellM.value = metaVal;
    cellP.value = { formula: `IFERROR(${col1Letter}${row}/${col2Letter}${row}," ")` };
    
    applyPremiumStyles(cellL, { size: 9 });
    applyPremiumStyles(cellM, { size: 9 });
    applyPremiumStyles(cellP, { size: 9 });
    
    cellL.numFmt = '#,##0';
    cellM.numFmt = '#,##0';
    cellP.numFmt = '0.0%';
    
    if (isTotal) {
      cellL.fill = cellM.fill = cellP.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F3FF' } // Fondo violeta claro para subtotales/totales
      };
    }
  });
  
  // Fila 58: Total Dosis
  const cellTL = ws.getCell(58, startCol);
  const cellTM = ws.getCell(58, startCol + 1);
  const cellTP = ws.getCell(58, startCol + 2);
  
  cellTL.value = { formula: `SUM(${col1Letter}12:${col1Letter}57)` };
  cellTM.value = { formula: `SUM(${col2Letter}12:${col2Letter}57)` };
  cellTP.value = { formula: `IFERROR(${col1Letter}58/${col2Letter}58," ")` };
  
  applyPremiumStyles(cellTL, { bold: true, size: 9 });
  applyPremiumStyles(cellTM, { bold: true, size: 9 });
  applyPremiumStyles(cellTP, { bold: true, size: 9 });
  
  cellTL.numFmt = '#,##0';
  cellTM.numFmt = '#,##0';
  cellTP.numFmt = '0.0%';
  
  // Fila 59: Frascos
  const cellFL = ws.getCell(59, startCol);
  const cellFM = ws.getCell(59, startCol + 1);
  const cellFP = ws.getCell(59, startCol + 2);
  
  cellFL.value = { formula: `IFERROR(${col1Letter}58/10," ")` };
  cellFM.value = { formula: `IFERROR(${col2Letter}58/10," ")` };
  cellFP.value = { formula: `IFERROR(${col2Letter}59/${col1Letter}59," ")` };
  
  applyPremiumStyles(cellFL, { bold: true, size: 9 });
  applyPremiumStyles(cellFM, { bold: true, size: 9 });
  applyPremiumStyles(cellFP, { bold: true, size: 9 });
  
  cellFL.numFmt = '#,##0';
  cellFM.numFmt = '#,##0';
  cellFP.numFmt = '0.0%';
  
  if (isTotal) {
    [58, 59].forEach(r => {
      for (let c = startCol; c <= startCol + 2; c++) {
        ws.getCell(r, c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0D7FF' } // Destacado más fuerte para totales finales
        };
      }
    });
  }
}


// 2. CONFIGURACIÓN DE METAS (ADMIN / MUNICIPAL)

// Captura numérica de metas: sin el "0" inicial pegado al teclear (se selecciona todo al entrar y se
// quitan ceros a la izquierda) y sin aceptar letras.
function metaEnlazarInputs(raiz, alCambiar) {
  raiz.querySelectorAll("input.meta-num").forEach(inp => {
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => {
      const limpio = inp.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (inp.value !== limpio) inp.value = limpio;
      if (alCambiar) alCambiar();
    });
    inp.addEventListener("blur", () => { if (inp.value === "") { inp.value = "0"; if (alCambiar) alCambiar(); } });
    // Pegado desde Excel: un bloque de celdas se reparte hacia la derecha y hacia abajo a partir del campo
    // activo. Un valor suelto se pega normal.
    inp.addEventListener("paste", (e) => {
      const texto = (e.clipboardData || window.clipboardData)?.getData("text") || "";
      if (!/[\t\r\n]/.test(texto.trim())) return;
      const filas = [...raiz.querySelectorAll("tr[data-rb]")];
      const r0 = filas.indexOf(inp.closest("tr"));
      if (r0 < 0) return;
      e.preventDefault();
      const c0 = [...inp.closest("tr").querySelectorAll("input.meta-num")].indexOf(inp);
      texto.replace(/\r/g, "").replace(/\n+$/, "").split("\n").forEach((linea, i) => {
        const campos = filas[r0 + i]?.querySelectorAll("input.meta-num");
        if (!campos) return;
        linea.split("\t").forEach((v, j) => {
          if (!campos[c0 + j]) return;
          campos[c0 + j].value = String(parseInt(v.replace(/[^\d]/g, ""), 10) || 0);
        });
      });
      if (alCambiar) alCambiar();
    });
    // Tab avanza a la derecha (Shift+Tab a la izquierda) y al terminar la fila salta a la siguiente;
    // Enter / flecha abajo bajan por la misma columna (Shift+Enter / flecha arriba suben) y al terminar
    // la columna pasan a la siguiente. Siempre con scroll automático hasta el campo.
    inp.addEventListener("keydown", (e) => {
      const k = e.key;
      if (!(k === "Tab" || k === "Enter" || k === "ArrowDown" || k === "ArrowUp")) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const filas = [...raiz.querySelectorAll("tr[data-rb]")];
      const fila = inp.closest("tr");
      const r = filas.indexOf(fila);
      if (r < 0) return;
      const campos = [...fila.querySelectorAll("input.meta-num")];
      const c = campos.indexOf(inp);
      const atras = k === "ArrowUp" || e.shiftKey;
      let nr = r, nc = c;
      if (k === "Tab") {
        nc = c + (atras ? -1 : 1);
        if (nc >= campos.length) { nr = r + 1; nc = 0; }
        else if (nc < 0) { nr = r - 1; nc = campos.length - 1; }
      } else {
        nr = r + (atras ? -1 : 1);
        if (nr >= filas.length) { nr = 0; nc = c + 1; }
        else if (nr < 0) { nr = filas.length - 1; nc = c - 1; }
      }
      const destino = filas[nr]?.querySelectorAll("input.meta-num")[nc];
      if (!destino) return;   // fuera de la tabla: el Tab normal sigue su camino
      e.preventDefault();
      destino.focus();
      destino.scrollIntoView({ block: "center", inline: "center" });
    });
  });
}

// Bloques de la tabla de metas (Primera dosis, Segunda dosis, Revacunación, Grupos de riesgo...): una franja
// de color con el nombre del bloque cada vez que cambia, y el mismo color como filete en sus renglones.
const META_COLORES_GRUPO = ["#7c3aed", "#0284c7", "#d97706", "#16a34a", "#db2777", "#0d9488", "#64748b"];
function metaGrupoKey(rb) { return `${rb.categoria}|${rb.grupo}`; }
function metaColorGrupo(rb) {
  const claves = [...new Set(rubrosMetas().map(metaGrupoKey))];
  return META_COLORES_GRUPO[claves.indexOf(metaGrupoKey(rb)) % META_COLORES_GRUPO.length];
}
// colspan = columnas antes de «Comparación» (que va aparte para seguir pegada a la derecha).
function metaAgregarFranja(tbody, previo, rb, colspan) {
  if (previo && metaGrupoKey(previo) === metaGrupoKey(rb)) return;
  const tr = document.createElement("tr");
  tr.className = "meta-grupo-row";
  tr.style.setProperty("--g", metaColorGrupo(rb));
  tr.innerHTML = `<td colspan="${colspan}"><span class="meta-grupo-txt"><span class="meta-grupo-cat">${rb.categoria}</span> <b>${rb.grupo}</b></span></td><td class="meta-cmp-cell meta-grupo-cmp"></td>`;
  tbody.appendChild(tr);
}

// Selector de municipio propio de la pestaña de metas (el de «Avances» queda oculto aquí). Solo aparece
// cuando el rol municipal atiende más de un municipio; comparte valor con el selector general.
function metaSincronizarSelectorMuni() {
  const general = document.getElementById("adminInfluenzaMuni");
  const sel = document.getElementById("metaMuniSelect");
  const lbl = document.getElementById("metaMuniLbl");
  if (!general || !sel || !lbl) return;
  const mostrar = USER.rol === "MUNICIPAL" && general.options.length > 1;
  sel.style.display = lbl.style.display = mostrar ? "" : "none";
  if (!mostrar) return;
  sel.innerHTML = general.innerHTML;
  sel.value = general.value;
  sel.onchange = () => {
    general.value = sel.value;
    general.dispatchEvent(new Event("change"));
    renderMetasConfigurationGrid();
  };
}

// Un frasco rinde 10 dosis: la meta total de una unidad/destino debería cerrar en frascos completos. Solo
// avisa (no bloquea): Querétaro municipio puede tener una unidad con frasco abierto (p. ej. Pedro Escobedo);
// en los demás municipios y en los hospitales una meta abierta se marca en rojo.
// Regla: la meta de cada destino y unidad cierra en frascos completos; el único frasco que puede quedar abierto
// es el de Querétaro municipio y se le adjudica a la unidad Pedro Escobedo (QTSSA001863).
const CLUES_FRASCO_ABIERTO = "QTSSA001863";
function metaPintarFrascos(td, total, permiteAbierto, soloInformar) {
  if (!td) return "ok";
  if (esCovid()) {
    // COVID: frascos que se reciben por marca, con la pérdida. Moderna cubre a los niños (5 dosis) y Pfizer a los
    // adultos (6 dosis). Cerrado = frascos completos; el abierto solo lo admite Querétaro / Pedro Escobedo.
    const o = (total && typeof total === "object") ? total : { ped: 0, adulto: Number(total) || 0, razon: null };
    const mod = CovidFrascos.recibirDosis(o.ped, o.razon) / CovidFrascos.DPF_MODERNA;
    const pf = CovidFrascos.recibirDosis(o.adulto, o.razon) / CovidFrascos.DPF_PFIZER;
    const cerrado = Number.isInteger(mod) && Number.isInteger(pf);
    const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString("es-MX") : n.toFixed(1));
    let estado = "ok", color = "#16a34a";
    if (!cerrado) {
      if (soloInformar) { estado = "info"; color = "#64748b"; }
      else if (permiteAbierto) { estado = "aviso"; color = "#d97706"; }
      else { estado = "mal"; color = "#dc2626"; }
    } else if (soloInformar) color = "#64748b";
    td.dataset.estado = estado;
    td.style.color = color;
    td.innerHTML = `Moderna ${fmt(mod)} fr.${Number.isInteger(mod) ? " ✓" : " abierto"}<br>Pfizer ${fmt(pf)} fr.${Number.isInteger(pf) ? " ✓" : " abierto"}`;
    return estado;
  }
  const resto = total % 10;
  const f = total / 10;
  let estado = "ok", color = "#16a34a", txt = `${f} fr. ✓`;
  if (resto) {
    txt = `${f.toFixed(1)} fr. abierto<br><span style="font-weight:600;font-size:10px">+${10 - resto} → ${Math.ceil(f)} · −${resto} → ${Math.floor(f)}</span>`;
    if (soloInformar) { estado = "info"; color = "#64748b"; }
    else if (permiteAbierto) { estado = "aviso"; color = "#d97706"; }
    else { estado = "mal"; color = "#dc2626"; }
  } else if (soloInformar) color = "#64748b";
  td.dataset.estado = estado;
  td.style.color = color;
  td.innerHTML = txt;
  return estado;
}

// Deja fijos al desplazar: encabezado, franja del bloque, columnas Grupo/Edad y los renglones TOTAL/FRASCOS.
// Mide lo que el CSS no puede saber (alto del encabezado y ancho real de la primera columna).
function metaFijarFilas() {
  const thead = document.getElementById("influenzaMetasThead");
  const tbody = document.getElementById("influenzaMetasTbody");
  const wrap = thead && thead.closest(".tableWrap");
  if (!wrap || !tbody) return;
  const marcar = (celdas) => { if (celdas[0]) celdas[0].classList.add("meta-fx1"); if (celdas[1]) celdas[1].classList.add("meta-fx2"); };
  thead.querySelectorAll("tr").forEach(tr => marcar(tr.children));
  tbody.querySelectorAll("tr[data-rb]").forEach(tr => marcar(tr.children));
  tbody.querySelectorAll("tr.meta-total-row > td:first-child").forEach(td => td.classList.add("meta-fx-total"));
  const th1 = thead.querySelector("th");
  if (th1 && th1.offsetWidth) wrap.style.setProperty("--meta-c1w", `${th1.offsetWidth}px`);
  if (thead.offsetHeight) wrap.style.setProperty("--meta-th-h", `${thead.offsetHeight}px`);
}

// Exportar metas al formato oficial. Jurisdicción elige un municipio o «Todos» (un .zip con un archivo por
// municipio); el municipal exporta el municipio que tiene seleccionado. Usa lo último guardado.
const METAS_EXPORT_PLANTILLA = "./Formatos/Metas Influenza Querétaro 2025-2026.xlsx";

function metaSincronizarExportar() {
  const sel = document.getElementById("metaExportMuni");
  const lbl = document.getElementById("metaExportMuniLbl");
  if (!sel || !lbl) return;
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
  sel.style.display = lbl.style.display = esJuris ? "" : "none";
  if (!esJuris || sel.options.length) return;
  const M = (window.InfluenzaMetasExport || {}).MUNICIPIOS || {};
  sel.innerHTML = `<option value="TODOS">Todos (un archivo por municipio)</option>`
    + Object.keys(M).map(k => `<option value="${k}">${M[k].archivo}</option>`).join("");
}

function metaDescargar(contenido, nombre, tipo) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

const METAS_COVID_PLANTILLA = "./Formatos/Metas COVID-19 plantilla.xlsx";

// Excel de metas de COVID-19 (mismo reparto de archivos que influenza: un municipio, o «Todos» en un .zip).
async function exportCovidMetasExcel() {
  const btn = document.getElementById("btnExportInfluenzaMetas");
  const X = window.CovidMetasExport;
  if (!X) { showToast("No se cargó el exportador de metas de COVID-19. Recarga la página.", false, "bad"); return; }
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
  const eleccion = esJuris ? (document.getElementById("metaExportMuni")?.value || "TODOS")
    : String(document.getElementById("adminInfluenzaMuni")?.value || USER.municipio || "").toUpperCase();
  const munis = eleccion === "TODOS" ? Object.keys(X.MUNICIPIOS) : [eleccion];
  if (btn) btn.disabled = true;
  try {
    await window.ensureLibsLoaded("exceljs", "jszip");
    const resp = await fetch(encodeURI(METAS_COVID_PLANTILLA));
    if (!resp.ok) throw new Error(`No se pudo leer la plantilla (${resp.status})`);
    const plantilla = await resp.arrayBuffer();
    const campana = campaignSeasonLabel();
    const archivos = [];
    for (const muni of munis) {
      try {
        const wb = await X.construirLibroCovid({ ExcelJS, plantilla, muni, campana, metas: _covidMetasArray, unidades: _allUnidades });
        archivos.push({ nombre: X.nombreArchivo(muni, campana), datos: await X.escribirLibro(wb, window.JSZip) });
      } catch (e) {
        if (munis.length === 1) throw e;     // «Todos»: el municipio sin metas simplemente no genera archivo
      }
    }
    if (!archivos.length) { showToast("Aún no hay metas de COVID-19 capturadas para exportar.", false, "warn"); return; }
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (archivos.length === 1) {
      metaDescargar(archivos[0].datos, archivos[0].nombre, xlsx);
    } else {
      const zip = new window.JSZip();
      archivos.forEach(a => zip.file(a.nombre, a.datos));
      metaDescargar(await zip.generateAsync({ type: "uint8array" }), `Metas COVID-19 ${campana}.zip`, "application/zip");
    }
    showToast("Metas de COVID-19 exportadas con lo último guardado.", true, "good");
  } catch (err) {
    console.error("Error al exportar las metas de COVID-19:", err);
    const msg = String((err && err.message) || "");
    showToast(/No hay unidades|sin meta/.test(msg)
      ? "Este municipio aún no tiene metas de COVID-19 capturadas." : `No se pudo generar el Excel de metas de COVID-19${msg ? ": " + msg : "."}`, false, "bad");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function exportInfluenzaMetasExcel() {
  if (esCovid()) return exportCovidMetasExcel();
  const btn = document.getElementById("btnExportInfluenzaMetas");
  const X = window.InfluenzaMetasExport;
  if (!X) { showToast("No se cargó el exportador de metas. Recarga la página.", false, "bad"); return; }
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
  const eleccion = esJuris ? (document.getElementById("metaExportMuni")?.value || "TODOS")
    : String(document.getElementById("adminInfluenzaMuni")?.value || USER.municipio || "").toUpperCase();
  const munis = eleccion === "TODOS" ? Object.keys(X.MUNICIPIOS) : [eleccion];
  if (btn) btn.disabled = true;
  try {
    await window.ensureLibsLoaded("exceljs", "jszip");
    const resp = await fetch(encodeURI(METAS_EXPORT_PLANTILLA));
    if (!resp.ok) throw new Error(`No se pudo leer la plantilla (${resp.status})`);
    const plantilla = await resp.arrayBuffer();
    const campana = document.getElementById("metaCampaignSelect").value;
    const archivos = [];
    for (const muni of munis) {
      const wb = await X.construirLibroMetas({
        ExcelJS, plantilla, muni, campana, metas: metasVista(), unidades: _allUnidades,
        rubroIds: rubrosMetas().map(r => r.id)
      });
      archivos.push({ nombre: X.nombreArchivo(muni, campana), datos: await X.escribirLibro(wb, window.JSZip) });
    }
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (archivos.length === 1) {
      metaDescargar(archivos[0].datos, archivos[0].nombre, xlsx);
    } else {
      const zip = new window.JSZip();
      archivos.forEach(a => zip.file(a.nombre, a.datos));
      metaDescargar(await zip.generateAsync({ type: "uint8array" }), `Metas Influenza ${campana}.zip`, "application/zip");
    }
    showToast("Metas exportadas con lo último guardado.", true, "good");
  } catch (err) {
    console.error("Error al exportar las metas de Influenza:", err);
    showToast("No se pudo generar el Excel de metas" + (err && err.message ? ": " + err.message : ".") , false, "bad");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderMetasConfigurationGrid() {
  const isMuni = USER.rol === "MUNICIPAL";
  metaSincronizarSelectorMuni();
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const hints = document.getElementById("secInfluenzaMetasHint");
  const thead = document.getElementById("influenzaMetasThead");
  const tbody = document.getElementById("influenzaMetasTbody");

  tbody.innerHTML = "";

  // Sincronizar el indicador de las subpestañas
  if (typeof syncTabGroupIndicator === 'function') {
    syncTabGroupIndicator('#influenzaAdminTabsContainer');
  }

  const celdaGrupo = (rb) => `
        <td class="p-3 align-middle"><div style="width: 220px; min-width: 220px; max-width: 220px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; font-weight: 600; color: #334155;">${rb.categoria} - ${rb.grupo}</div></td>
        <td class="p-3 align-middle"><div style="width: 130px; min-width: 130px; max-width: 130px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; color: #475569;">${rb.edad}</div></td>`;
  const inputMeta = (extra, valor, clase) => `<input type="text" inputmode="numeric" autocomplete="off" class="meta-num ${clase} w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" ${extra} value="${valor}">`;
  const leer = (el) => (el ? (parseInt(el.value, 10) || 0) : 0);

  if (!isMuni) {
    // Modo Jurisdiccional: metas de los 4 municipios y los 2 hospitales, contra el total jurisdiccional capturado
    hints.textContent = "Modo Jurisdiccional: Configura las metas anuales de los 4 municipios y de los hospitales HENM y NHGQ. En «Comparación» captura la meta total de la Jurisdicción: se pinta en verde si la suma de los 6 destinos coincide y en rojo si no.";

    const th = (t, w) => `<th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: ${w}; min-width: 96px;">${t}</th>`;
    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 220px; min-width: 220px; max-width: 220px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 130px; min-width: 130px; max-width: 130px;">Subgrupo / Edad</th>
        ${th("Querétaro", "9%")}${th("Corregidora", "9%")}${th("El Marqués", "9%")}${th("Huimilpan", "9%")}${th("HENM", "9%")}${th("NHGQ", "9%")}
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 9%; min-width: 120px;">Total Jurisd.</th>
        <th class="meta-cmp-cell meta-cmp-th p-3 text-center text-xs font-black text-slate-500 uppercase">Comparación</th>
      </tr>
    `;

    const jurisRec = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
    const ids = FRASCO_DESTINOS.map(d => d.id);

    rubrosMetas().forEach(rb => {
      const metas = {};
      ids.forEach(id => { metas[id] = 0; });
      metasVista().forEach(m => {
        if (!m.clues) {
          const name = String(m.municipio).toUpperCase();
          if (metas[name] !== undefined) metas[name] = m.metas[rb.id] || 0;
        }
      });
      const jurisTotal = jurisRec ? Number(jurisRec.metas[rb.id] || 0) : 0;
      const totalJ = ids.reduce((x, id) => x + Number(metas[id] || 0), 0);

      metaAgregarFranja(tbody, rubrosMetas()[rubrosMetas().indexOf(rb) - 1], rb, 2 + ids.length + 1);
      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50 meta-rubro-row";
      row.style.setProperty("--g", metaColorGrupo(rb));
      row.dataset.rb = rb.id;
      row.innerHTML = celdaGrupo(rb)
        + ids.map(id => `<td class="p-3 text-center">${inputMeta(`data-rb="${rb.id}" data-muni="${id}"`, metas[id], "meta-input")}</td>`).join("")
        + `<td class="p-3 text-center font-bold text-slate-800 text-xs align-middle" id="total_j_${rb.id}">${totalJ}</td>
        <td class="meta-cmp-cell p-3 text-center align-middle" id="cmp_${rb.id}">
          ${inputMeta(`data-rb="${rb.id}" data-juris="1" title="Meta total de la Jurisdicción para este rubro"`, jurisTotal, "meta-juris-input")}
          <div class="meta-cmp-msg"></div>
        </td>`;
      tbody.appendChild(row);
    });

    const pie = document.createElement("tr");
    pie.className = "meta-total-row";
    pie.innerHTML = `<td class="p-3 text-xs font-black" colspan="2" ${esCovid() ? 'title="Dosis equivalentes de 0.5 mL: las pediátricas (0.25 mL) valen la mitad"' : ""}>${esCovid() ? "TOTAL (dosis 0.5 mL)" : "TOTAL"}</td>`
      + ids.map(id => `<td class="p-3 text-center text-xs font-black" id="tot_${id}">0</td>`).join("")
      + `<td class="p-3 text-center text-xs font-black" id="tot_J">0</td>
         <td class="meta-cmp-cell p-3 text-center" id="cmp_TOTAL"><b id="tot_juris">0</b><div class="meta-cmp-msg"></div></td>`;
    tbody.appendChild(pie);

    const pieFr = document.createElement("tr");
    pieFr.className = "meta-total-row meta-frascos-row";
    pieFr.innerHTML = `<td class="p-3 text-xs font-black" colspan="2" title="${esCovid() ? "Frascos que se reciben con la pérdida: Moderna (niños, 5 dosis) y Pfizer (adultos, 6 dosis)" : "Un frasco = 10 dosis"}">${esCovid() ? "FRASCOS (Moderna · Pfizer)" : "FRASCOS"}</td>`
      + ids.map(id => `<td class="p-3 text-center text-[11px] font-black" id="frs_${id}"></td>`).join("")
      + `<td class="p-3 text-center text-[11px] font-black" id="frs_J"></td><td class="meta-cmp-cell p-3"></td>`;
    tbody.appendChild(pieFr);

    const pintar = (celda, ref, suma) => {
      const msg = celda.querySelector(".meta-cmp-msg");
      if (!ref && !suma) { celda.dataset.estado = "vacio"; msg.textContent = ""; return; }
      if (ref === suma) { celda.dataset.estado = "ok"; msg.textContent = "✓ Coincide"; return; }
      celda.dataset.estado = "mal";
      msg.textContent = suma > ref ? `Sobran ${suma - ref}` : `Faltan ${ref - suma}`;
    };
    const recalcular = () => {
      let granJ = 0, granRef = 0, granEq = 0, granPed = 0, granAd = 0, granRefEqJ = 0;
      _metaDesc = { hay: false, n: 0, falta: 0, sobra: 0 };
      const porDestino = {};
      const eqDestino = {};   // en dosis de 0.5 mL equivalentes (COVID: las pediátricas valen la mitad)
      const pedDestino = {}, adDestino = {};   // COVID: niños (c1+c2) y adultos (c3..c6) por destino
      ids.forEach(id => { porDestino[id] = 0; eqDestino[id] = 0; pedDestino[id] = 0; adDestino[id] = 0; });
      tbody.querySelectorAll("tr[data-rb]").forEach(tr => {
        let suma = 0;
        ids.forEach(id => {
          const v = leer(tr.querySelector(`input[data-muni="${id}"]`));
          suma += v;
          porDestino[id] += v;
          eqDestino[id] += v * metaPesoRubro(tr.dataset.rb);
          if (metaPesoRubro(tr.dataset.rb) === 0.5) pedDestino[id] += v; else adDestino[id] += v;
        });
        granEq += suma * metaPesoRubro(tr.dataset.rb);
        if (metaPesoRubro(tr.dataset.rb) === 0.5) granPed += suma; else granAd += suma;
        const ref = leer(tr.querySelector("input[data-juris]"));
        granRefEqJ += ref * metaPesoRubro(tr.dataset.rb);
        document.getElementById(`total_j_${tr.dataset.rb}`).textContent = suma;
        pintar(document.getElementById(`cmp_${tr.dataset.rb}`), ref, suma);
        metaDescAcum(ref, suma);
        granJ += suma;
        granRef += ref;
      });
      const razon = esCovid() ? covidRazonDeGrid(tbody, false) : null;
      ids.forEach(id => {
        document.getElementById(`tot_${id}`).textContent = esCovid() ? covidAvanceFmt(eqDestino[id]) : porDestino[id];
        const valor = esCovid() ? { ped: Math.ceil(pedDestino[id] / 2), adulto: adDestino[id], razon } : porDestino[id];
        metaPintarFrascos(document.getElementById(`frs_${id}`), valor, id === "QUERETARO");
      });
      document.getElementById("tot_J").textContent = esCovid() ? covidAvanceFmt(granEq) : granJ;
      metaPintarFrascos(document.getElementById("frs_J"),
        esCovid() ? { ped: Math.ceil(granPed / 2), adulto: granAd, razon } : granJ, true, true);
      document.getElementById("tot_juris").textContent = esCovid() ? covidAvanceFmt(granRefEqJ) : granRef;
      // COVID: el total se compara en dosis equivalentes de 0.5 mL (igual que el TOTAL de arriba y el formato)
      pintar(document.getElementById("cmp_TOTAL"), esCovid() ? granRefEqJ : granRef, esCovid() ? granEq : granJ);
      metaPintarPill();
    };
    metaEnlazarInputs(tbody, recalcular);
    _gridRecalcular = recalcular;
    recalcular();

  } else {
    // Modo MUNICIPAL: Desglosa metas municipales a nivel CLUES (el total viene de Jurisdicción)
    hints.textContent = `Modo Municipal (${selectMuni}): Desglosa tu meta municipal asignada entre las unidades (CLUES). La columna «Comparación» se pinta en verde cuando lo distribuido coincide con tu meta y en rojo si falta o sobra.`;

    const muniUnits = frascoUnidadesMunicipio(selectMuni);
    const muniMetaRec = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === selectMuni.toUpperCase());

    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 220px; min-width: 220px; max-width: 220px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 130px; min-width: 130px; max-width: 130px;">Subgrupo / Edad</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 10%;">Meta Muni</th>
        ${muniUnits.map(u => `<th class="meta-th-unidad p-3 text-center text-[10px] font-black text-slate-500 uppercase" title="${u.unidad}">${u.unidad}</th>`).join("")}
        <th class="meta-cmp-cell meta-cmp-th p-3 text-center text-xs font-black text-slate-500 uppercase">Comparación</th>
      </tr>
    `;

    rubrosMetas().forEach(rb => {
      const muniMeta = muniMetaRec ? Number(muniMetaRec.metas[rb.id] || 0) : 0;
      metaAgregarFranja(tbody, rubrosMetas()[rubrosMetas().indexOf(rb) - 1], rb, 3 + muniUnits.length);
      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50 meta-rubro-row";
      row.style.setProperty("--g", metaColorGrupo(rb));
      row.dataset.rb = rb.id;
      row.dataset.meta = muniMeta;
      row.innerHTML = celdaGrupo(rb)
        + `<td class="p-3 text-center font-bold text-violet-900 text-xs align-middle">${muniMeta}</td>`
        + muniUnits.map(u => {
          const rec = metasVista().find(m => m.clues === u.clues);
          const v = rec ? Number(rec.metas[rb.id] || 0) : 0;
          return `<td class="p-2 text-center">${inputMeta(`data-rb="${rb.id}" data-clues="${u.clues}"`, v, "clues-meta-input")}</td>`;
        }).join("")
        + `<td class="meta-cmp-cell p-3 text-center align-middle" id="cmp_${rb.id}"><b class="meta-cmp-num"></b><div class="meta-cmp-msg"></div>
          <span class="meta-split-btn material-symbols-rounded" role="button" tabindex="0" aria-label="Repartir la meta de este renglón en partes iguales entre las unidades" title="Repartir la meta de este renglón en partes iguales entre las unidades" style="font-size:18px;cursor:pointer;color:#7c3aed;user-select:none">call_split</span></td>`;
      tbody.appendChild(row);
    });

    const pie = document.createElement("tr");
    pie.className = "meta-total-row";
    pie.innerHTML = `<td class="p-3 text-xs font-black" colspan="2" ${esCovid() ? 'title="Dosis equivalentes de 0.5 mL: las pediátricas (0.25 mL) valen la mitad"' : ""}>${esCovid() ? "TOTAL (dosis 0.5 mL)" : "TOTAL"}</td><td class="p-3 text-center text-xs font-black" id="tot_meta">0</td>`
      + muniUnits.map(u => `<td class="p-3 text-center text-xs font-black" id="tot_${u.clues}">0</td>`).join("")
      + `<td class="meta-cmp-cell p-3 text-center" id="cmp_TOTAL"><b class="meta-cmp-num"></b><div class="meta-cmp-msg"></div></td>`;
    tbody.appendChild(pie);

    // Querétaro municipio es el único que puede cerrar con frasco abierto (lo habitual: una sola unidad).
    const permiteAbierto = String(selectMuni).toUpperCase() === "QUERETARO";
    const pieFr = document.createElement("tr");
    pieFr.className = "meta-total-row meta-frascos-row";
    pieFr.innerHTML = `<td class="p-3 text-xs font-black" colspan="2" title="Un frasco = 10 dosis" id="frs_label">FRASCOS</td><td class="p-3 text-center text-[11px] font-black" id="frs_meta"></td>`
      + muniUnits.map(u => `<td class="p-3 text-center text-[11px] font-black" id="frs_${u.clues}"></td>`).join("")
      + `<td class="meta-cmp-cell p-3"></td>`;
    tbody.appendChild(pieFr);

    const pintar = (celda, ref, suma) => {
      celda.querySelector(".meta-cmp-num").textContent = `${suma} de ${ref}`;
      const msg = celda.querySelector(".meta-cmp-msg");
      if (!ref && !suma) { celda.dataset.estado = "vacio"; msg.textContent = ""; return; }
      if (ref === suma) { celda.dataset.estado = "ok"; msg.textContent = "✓ Completo"; return; }
      celda.dataset.estado = "mal";
      msg.textContent = suma > ref ? `Sobran ${suma - ref}` : `Faltan ${ref - suma}`;
    };
    const recalcular = () => {
      let granRef = 0, granSuma = 0, granRefEq = 0, refPed = 0, refAd = 0;
      _metaDesc = { hay: false, n: 0, falta: 0, sobra: 0 };
      const porUnidad = {};
      const eqUnidad = {};   // dosis de 0.5 mL equivalentes (COVID)
      const pedUnidad = {}, adUnidad = {};   // COVID: niños (c1+c2) y adultos (c3..c6) por unidad
      muniUnits.forEach(u => { porUnidad[u.clues] = 0; eqUnidad[u.clues] = 0; pedUnidad[u.clues] = 0; adUnidad[u.clues] = 0; });
      tbody.querySelectorAll("tr[data-rb]").forEach(tr => {
        let suma = 0;
        muniUnits.forEach(u => {
          const v = leer(tr.querySelector(`input[data-clues="${u.clues}"]`));
          suma += v;
          porUnidad[u.clues] += v;
          eqUnidad[u.clues] += v * metaPesoRubro(tr.dataset.rb);
          if (metaPesoRubro(tr.dataset.rb) === 0.5) pedUnidad[u.clues] += v; else adUnidad[u.clues] += v;
        });
        const ref = Number(tr.dataset.meta) || 0;
        granRefEq += ref * metaPesoRubro(tr.dataset.rb);
        if (metaPesoRubro(tr.dataset.rb) === 0.5) refPed += ref; else refAd += ref;
        pintar(document.getElementById(`cmp_${tr.dataset.rb}`), ref, suma);
        metaDescAcum(ref, suma);
        granRef += ref;
        granSuma += suma;
      });
      let abiertas = 0;
      const razonCovid = esCovid() ? covidRazonDeGrid(tbody, true) : null;
      muniUnits.forEach(u => {
        document.getElementById(`tot_${u.clues}`).textContent = esCovid() ? covidAvanceFmt(eqUnidad[u.clues]) : porUnidad[u.clues];
        const puedeAbrir = permiteAbierto && u.clues === CLUES_FRASCO_ABIERTO;
        const valor = esCovid() ? { ped: Math.ceil(pedUnidad[u.clues] / 2), adulto: adUnidad[u.clues], razon: razonCovid } : porUnidad[u.clues];
        if (metaPintarFrascos(document.getElementById(`frs_${u.clues}`), valor, puedeAbrir) !== "ok" && !puedeAbrir) abiertas++;
      });
      if (esCovid()) document.getElementById("frs_label").innerHTML = (permiteAbierto && abiertas > 0)
        ? `FRASCOS (Moderna · Pfizer)<div style="font-size:10px;font-weight:600;color:#dc2626;text-transform:none">${abiertas} ${abiertas === 1 ? "unidad" : "unidades"} con frasco abierto: solo Pedro Escobedo puede quedar abierta</div>` : "FRASCOS (Moderna · Pfizer)";
      else document.getElementById("frs_label").innerHTML = (permiteAbierto && abiertas > 0)
        ? `FRASCOS<div style="font-size:10px;font-weight:600;color:#dc2626;text-transform:none">${abiertas} ${abiertas === 1 ? "unidad" : "unidades"} con frasco abierto: solo Pedro Escobedo puede quedar abierta</div>` : "FRASCOS";
      metaPintarFrascos(document.getElementById("frs_meta"),
        esCovid() ? { ped: Math.ceil(refPed / 2), adulto: refAd, razon: razonCovid } : granRef, permiteAbierto, true);
      document.getElementById("tot_meta").textContent = esCovid() ? covidAvanceFmt(granRefEq) : granRef;
      const sumaEq = Object.values(eqUnidad).reduce((a, v) => a + v, 0);
      pintar(document.getElementById("cmp_TOTAL"), esCovid() ? granRefEq : granRef, esCovid() ? sumaEq : granSuma);
      metaPintarPill();
    };
    metaEnlazarInputs(tbody, recalcular);
    _gridRecalcular = recalcular;
    // Repartir en partes iguales la meta del renglón (el residuo va a las primeras unidades).
    const repartirParejo = (tr) => {
      const campos = [...tr.querySelectorAll("input.clues-meta-input")];
      if (!campos.length) return;
      const meta = Number(tr.dataset.meta) || 0;
      const base = Math.floor(meta / campos.length), resto = meta % campos.length;
      campos.forEach((c, i) => { c.value = String(base + (i < resto ? 1 : 0)); });
      recalcular();
    };
    tbody.onclick = (e) => {
      const b = e.target.closest(".meta-split-btn");
      if (b) repartirParejo(b.closest("tr"));
    };
    tbody.onkeydown = (e) => {
      const b = e.target.closest?.(".meta-split-btn");
      if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); repartirParejo(b.closest("tr")); }
    };
    recalcular();
  }

  metaFijarFilas();
  metaSincronizarExportar();
  const btnExp = document.getElementById("btnExportInfluenzaMetas");
  if (btnExp) btnExp.onclick = exportInfluenzaMetasExcel;
  // El mismo botón exporta el Excel oficial de la vacuna elegida (influenza o COVID-19).
  const grupoExp = document.querySelector("#secInfluenzaMetas .meta-exp-grupo");
  if (grupoExp) grupoExp.style.display = "";
  vacunaPintarSelectores();
  if (esCovid() && hints && !hints.textContent.startsWith("COVID-19")) hints.textContent = `COVID-19 · ${hints.textContent}`;
  covidPintarPerdida();
  const btnPre = document.getElementById("btnCovidPredistribuir");
  if (btnPre) {
    btnPre.style.display = esCovid() ? "" : "none";
    btnPre.onclick = covidPredistribuir;
    // Jerarquía: Jurisdicción reparte entre municipios y hospitales; el municipal, entre sus unidades.
    btnPre.title = USER.rol === "MUNICIPAL"
      ? "Reparte la meta COVID-19 de tu municipio entre tus unidades con los porcentajes de la meta de influenza de cada una. No guarda hasta que presiones Guardar."
      : "Reparte la meta COVID-19 de la Jurisdicción entre los municipios y hospitales con los porcentajes de influenza (HENM y NHGQ solo adultos/personal). No guarda hasta que presiones Guardar.";
  }

  // Enlazar guardado
  document.getElementById("btnSaveInfluenzaMetas").onclick = async () => {
    await saveInfluenzaMetasConfig();
  };
}

// Razón de pérdida con la que se evalúa el cierre de frascos en la cuadrícula: Jurisdicción usa lo que está
// capturando (Comparación + pérdida); el municipal, lo guardado en la fila JURISDICCION.
let _gridRecalcular = null;
function covidRazonDeGrid(tbody, esMunicipal) {
  const rec = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
  const juris = {};
  CovidFrascos.RUBROS.forEach(r => {
    if (!esMunicipal) {
      const c = tbody && tbody.querySelector(`input[data-rb="${r.id}"][data-juris]`);
      juris[r.id] = c ? (parseInt(c.value, 10) || 0) : 0;
    } else {
      juris[r.id] = Number(rec && rec.metas[r.id]) || 0;
    }
  });
  const p = esMunicipal
    ? (Number(rec && rec.metas.perdida) || 0)
    : (parseInt((document.getElementById("covidPerdidaInput") || {}).value, 10) || 0);
  return CovidFrascos.razonPerdida(CovidFrascos.factorPerdida({ ...juris, perdida: p }));
}

// ─── Avance de COVID-19: dosis aplicadas (SIS, validadas) contra la meta ────────────────────────────────
// Las dosis salen de registros_sis (mensuales) mediante covid_avance; la meta, de covid_metas. Jurisdicción ve
// la Jurisdicción, cada municipio/hospital y sus unidades; el municipal, sus municipios y sus unidades.
let _covidAvance = { filas: [], ult: null, hasta: null, cargado: false };

const COVID_MESES_NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Meses de la campaña (de su inicio a su fin), como [{ valor: "2026-10", etiqueta: "Octubre 2026" }].
function covidAvanceMeses() {
  const ini = _campaignConfig && _campaignConfig.fecha_inicio;
  const fin = _campaignConfig && _campaignConfig.fecha_fin;
  if (!ini || !fin) return [];
  const out = [];
  const d = new Date(ini + "T12:00:00");
  const tope = new Date(fin + "T12:00:00");
  let y = d.getFullYear(), m = d.getMonth();
  while (y < tope.getFullYear() || (y === tope.getFullYear() && m <= tope.getMonth())) {
    out.push({ valor: `${y}-${String(m + 1).padStart(2, "0")}`, etiqueta: `${COVID_MESES_NOMBRE[m]} ${y}` });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

function covidAvanceAmbitos() {
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL" || USER.rol === "VISUALIZADOR_JURISDICCIONAL";
  if (esJuris) return [{ id: "JURIS", label: "Jurisdicción" }, ...FRASCO_DESTINOS.map(d => ({ id: d.id, label: d.label + (d.hospital ? " (hospital)" : "") }))];
  const general = document.getElementById("adminInfluenzaMuni");
  const munis = general ? [...general.options].map(o => String(o.value).toUpperCase()).filter(Boolean) : [String(USER.municipio || "").toUpperCase()];
  return [...new Set(munis)].map(m => ({ id: m, label: (FRASCO_DESTINOS.find(d => d.id === m) || { label: m }).label }));
}

async function covidAvanceCargar() {
  const ini = _campaignConfig && _campaignConfig.fecha_inicio;
  const corte = document.getElementById("cavCorte");
  const mes = corte && corte.value ? corte.value : null;
  if (!ini || !mes) { _covidAvance = { filas: [], ult: null, hasta: mes, cargado: true }; return; }
  const [y, m] = mes.split("-").map(Number);
  const hasta = `${y}-${String(m).padStart(2, "0")}-01`;
  try {
    const res = await AppService.call("getcovid_avance", { desde: ini, hasta }, { silent: true });
    const filas = res.data || [];
    const ult = filas.reduce((mx, f) => (f.ult && (!mx || f.ult > mx) ? f.ult : mx), null);
    _covidAvance = { filas, ult, hasta, cargado: true };
  } catch (err) {
    console.error("Error al cargar el avance de COVID-19:", err);
    _covidAvance = { filas: [], ult: null, hasta, cargado: true, error: true };
  }
}

// Dosis aplicadas por CLUES y rubro: { clues: { c1..c6 } }
function covidAvanceAplicadasPorClues() {
  const inversa = {};
  Object.keys(CovidFrascos.VARIABLE_SIS).forEach(r => { inversa[CovidFrascos.VARIABLE_SIS[r]] = r; });
  const out = {};
  _covidAvance.filas.forEach(f => {
    const r = inversa[f.variable_sis];
    if (!r) return;
    (out[f.clues] = out[f.clues] || {})[r] = (out[f.clues][r] || 0) + Number(f.dosis || 0);
  });
  return out;
}

function covidAvanceSumar(lista) {
  const t = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
  lista.forEach(x => Object.keys(t).forEach(r => { t[r] += Number((x || {})[r]) || 0; }));
  return t;
}

// Resultado del ámbito elegido: { titulo, nombreCol, filas:[{ nombre, sub, meta, apl, calc }], total }
function covidAvanceCalcular(ambito) {
  const aplPorClues = covidAvanceAplicadasPorClues();
  const metaDestino = (id) => {
    const rec = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === id);
    return (rec && rec.metas) || {};
  };
  const metaUnidad = (clues) => {
    const rec = _covidMetasArray.find(m => m.clues === clues);
    return rec ? rec.metas : null;
  };
  const unidadesDe = (id) => {
    const hosp = FRASCO_DESTINOS.find(d => d.id === id && d.hospital);
    if (hosp) return _allUnidades.filter(u => u.clues === hosp.clues);
    return frascoUnidadesMunicipio(id);
  };
  const aplDestino = (id) => covidAvanceSumar(unidadesDe(id).map(u => aplPorClues[u.clues]));
  const fila = (nombre, sub, metas, apl) => ({ nombre, sub, metas, apl, calc: CovidFrascos.avanceRubros(metas || {}, apl) });

  if (ambito === "JURIS") {
    // Un destino sin meta de COVID-19 se dice «sin meta» (no «0 / 0 por aplicar»); si aun así aplicó, se señala.
    const filas = FRASCO_DESTINOS.map(d => {
      const f = fila(d.label, d.hospital ? "hospital" : "municipio", metaDestino(d.id), aplDestino(d.id));
      return { ...f, sinMeta: f.calc.metaEq === 0 };
    });
    const metas = covidAvanceSumar(FRASCO_DESTINOS.map(d => metaDestino(d.id)));
    const apl = covidAvanceSumar(FRASCO_DESTINOS.map(d => aplDestino(d.id)));
    return { titulo: "Avance por municipio y hospital", nombreCol: "Municipio / hospital", filas, total: fila("Jurisdicción", "", metas, apl) };
  }
  const unidades = unidadesDe(ambito);
  // Un hospital es su propio destino y una sola unidad: su meta vive en el destino, no por CLUES.
  const esHospital = FRASCO_DESTINOS.some(d => d.id === ambito && d.hospital);
  const filas = unidades.map(u => {
    const m = metaUnidad(u.clues) || (esHospital && Object.keys(metaDestino(ambito)).length ? metaDestino(ambito) : null);
    return { ...fila(u.unidad, u.clues, m || {}, aplPorClues[u.clues] || {}), sinMeta: !m };
  }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  const nombre = (FRASCO_DESTINOS.find(d => d.id === ambito) || { label: ambito }).label;
  return { titulo: `Avance por unidad · ${nombre}`, nombreCol: "Unidad", filas,
    total: fila(nombre, "", metaDestino(ambito), aplDestino(ambito)) };
}

function covidAvanceFmt(n) {
  const v = Math.round(Number(n) * 10) / 10;
  return Number.isInteger(v) ? v.toLocaleString("es-MX") : v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function covidAvanceBarra(pct) {
  if (pct === null || pct === undefined) return '<span class="frs-muted">sin meta</span>';
  const w = Math.max(0, Math.min(100, pct));
  return `<div class="cav-barra${pct >= 100 ? " cav-completo" : ""}"><i style="width:${w}%"></i></div><span class="cav-pct">${pct.toFixed(1)} %</span>`;
}

async function renderCovidAvance() {
  const sel = document.getElementById("cavAmbito");
  const corte = document.getElementById("cavCorte");
  if (!sel || !corte) return;

  // Selectores (se conservan al volver a pintar)
  const ambitos = covidAvanceAmbitos();
  const previoAmb = sel.value;
  sel.innerHTML = ambitos.map(a => `<option value="${a.id}">${a.label}</option>`).join("");
  if (ambitos.some(a => a.id === previoAmb)) sel.value = previoAmb;
  else if (!ambitos.some(a => a.id === "JURIS")) {
    // Municipal: arranca en el municipio que ya tiene elegido en el resto del panel (Jurisdicción arranca en JURIS)
    const general = document.getElementById("adminInfluenzaMuni");
    const actual = general ? String(general.value || "").toUpperCase() : "";
    if (ambitos.some(a => a.id === actual)) sel.value = actual;
  }
  // Con un solo ámbito (municipal de un municipio) el selector sobra: se oculta para no dejar hueco.
  const unico = ambitos.length <= 1;
  sel.style.display = unico ? "none" : "";
  const lblAmb = document.getElementById("cavAmbitoLbl");
  if (lblAmb) lblAmb.style.display = unico ? "none" : "";
  const meses = covidAvanceMeses();
  const previoMes = corte.value;
  corte.innerHTML = meses.map(m => `<option value="${m.valor}">${m.etiqueta}</option>`).join("");
  if (previoMes && meses.some(m => m.valor === previoMes)) corte.value = previoMes;
  else {
    // por omisión: el mes en curso o, si la campaña ya terminó / aún no empieza, el más cercano
    const hoy = new Date();
    const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    corte.value = meses.some(m => m.valor === claveHoy) ? claveHoy : (meses.length ? meses[meses.length - 1].valor : "");
  }
  if (!sel.dataset.bound) {
    sel.dataset.bound = "1";
    sel.addEventListener("change", () => renderCovidAvance());
    corte.addEventListener("change", () => { _covidAvance.cargado = false; renderCovidAvance(); });
  }

  if (!_covidAvance.cargado || _covidAvance.hasta !== `${corte.value}-01`) {
    document.getElementById("cavTbody").innerHTML = '<tr><td colspan="5" class="cav-vacio">Calculando avance…</td></tr>';
    await covidAvanceCargar();
  }

  const r = covidAvanceCalcular(sel.value || "JURIS");
  document.getElementById("cavTituloAmbito").textContent = r.titulo;
  document.getElementById("cavThNombre").textContent = r.nombreCol;

  const T = r.total.calc;
  const hayDatos = _covidAvance.filas.length > 0;
  const fuente = document.getElementById("cavFuente");
  if (_covidAvance.error) fuente.textContent = "No se pudo leer el SIS; intenta con Actualizar.";
  else if (!hayDatos) fuente.textContent = "Aún no hay dosis de COVID-19 publicadas del SIS en este periodo.";
  else fuente.textContent = `Fuente: SIS (dosis validadas) · último mes con datos: ${_covidAvance.ult ? COVID_MESES_NOMBRE[Number(String(_covidAvance.ult).slice(5, 7)) - 1] + " " + String(_covidAvance.ult).slice(0, 4) : "—"}`;

  document.getElementById("cavKpis").innerHTML = `
    <div class="cav-kpi cav-kpi--main"><span class="cav-kpi-lbl">Avance</span><b>${T.pct === null ? "—" : T.pct.toFixed(1) + " %"}</b><small>${covidAvanceFmt(T.aplEq)} de ${covidAvanceFmt(T.metaEq)} dosis (0.5 mL)</small></div>
    <div class="cav-kpi"><span class="cav-kpi-lbl">Meta</span><b>${covidAvanceFmt(T.metaEq)}</b><small>dosis equivalentes de 0.5 mL</small></div>
    <div class="cav-kpi"><span class="cav-kpi-lbl">Aplicadas</span><b>${covidAvanceFmt(T.aplEq)}</b><small>según SIS validado</small></div>
    <div class="cav-kpi"><span class="cav-kpi-lbl">Por aplicar</span><b>${covidAvanceFmt(T.pendienteEq)}</b><small>para cubrir la meta</small></div>`;

  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const filaHtml = (f, total) => `<tr class="${total ? "cav-total" : ""}${f.sinMeta && f.calc.aplEq > 0 ? " cav-fila-alerta" : ""}">
      <td><b>${esc(f.nombre)}</b>${f.sub ? `<span class="cav-sub">${esc(f.sub)}</span>` : ""}</td>
      <td class="c">${f.sinMeta ? (f.calc.aplEq > 0 ? '<span class="cav-sinmeta" title="Esta unidad aplicó dosis pero no tiene meta de COVID-19 asignada: esas dosis cuentan en el total del municipio">sin meta · con dosis</span>' : '<span class="frs-muted">sin meta</span>') : covidAvanceFmt(f.calc.metaEq)}</td>
      <td class="c">${covidAvanceFmt(f.calc.aplEq)}</td>
      <td class="c">${covidAvanceBarra(f.calc.pct)}</td>
      <td class="c">${f.sinMeta ? "—" : covidAvanceFmt(f.calc.pendienteEq)}</td></tr>`;
  document.getElementById("cavTbody").innerHTML = r.filas.length
    ? r.filas.map(f => filaHtml(f, false)).join("") + filaHtml(r.total, true)
    : '<tr><td colspan="5" class="cav-vacio">No hay unidades para este ámbito.</td></tr>';

  document.getElementById("cavRubros").innerHTML = T.rubros.map(x => {
    const rb = CovidFrascos.RUBROS.find(q => q.id === x.id);
    return `<tr><td><b>${esc(rb.grupo)}</b><span class="cav-sub">${esc(rb.edad)}</span></td>
      <td class="c">${covidAvanceFmt(x.meta)}</td><td class="c">${covidAvanceFmt(x.aplicadas)}</td>
      <td class="c">${covidAvanceBarra(x.pct)}</td><td class="c">${covidAvanceFmt(x.pendiente)}</td></tr>`;
  }).join("");
}

// Verificador de Distribución de Metas: resume si todos los grupos cuadran contra la meta de arriba (Jurisdicción
// para los destinos; el municipio para sus unidades). Se alimenta desde recalcular() de la cuadrícula.
let _metaDesc = { hay: false, n: 0, falta: 0, sobra: 0 };
function metaDescAcum(ref, suma) {
  if (ref || suma) _metaDesc.hay = true;
  if (ref === suma) return;
  _metaDesc.n += 1;
  if (suma > ref) _metaDesc.sobra += suma - ref; else _metaDesc.falta += ref - suma;
}
function metaPintarPill() {
  const el = document.getElementById("metasHubEstado");
  if (!el) return;
  const d = _metaDesc;
  const fmt = (n) => Number(n).toLocaleString("es-MX");
  let estado, icono, valor, etiqueta, completo;
  if (!d.hay) {
    estado = "vacio"; icono = "rule"; valor = "—"; etiqueta = "sin metas";
    completo = "Aún no hay metas capturadas";
  } else if (d.n === 0) {
    estado = "ok"; icono = "check_circle"; valor = ""; etiqueta = "cuadra";
    completo = "Las metas cuadran en todos los grupos";
  } else {
    estado = d.sobra > 0 ? "excede" : "falta"; icono = "rule"; valor = fmt(d.falta + d.sobra); etiqueta = "diferencia";
    completo = `${d.n} ${d.n === 1 ? "grupo no cuadra" : "grupos no cuadran"}: faltan ${fmt(d.falta)} y sobran ${fmt(d.sobra)} dosis`;
  }
  el.dataset.estado = estado;
  el.setAttribute("aria-label", completo);
  el.title = completo;
  el.innerHTML = estado === "ok" || estado === "vacio"
    ? `<span class="material-symbols-rounded" aria-hidden="true">${icono}</span><small>${etiqueta}</small>`
    : `<b>${valor}</b><small>${etiqueta}</small>`;
}

// Meta equivalente (dosis de 0.5 mL) de la Jurisdicción tal como está en pantalla (Comparación) o, en municipal,
// la guardada: sirve para convertir el factor de pérdida de % a dosis.
function covidMetaEquivalenteJuris() {
  const tbody = document.getElementById("influenzaMetasTbody");
  const rec = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
  const juris = {};
  CovidFrascos.RUBROS.forEach(r => {
    const c = tbody && tbody.querySelector(`input[data-rb="${r.id}"][data-juris]`);
    juris[r.id] = c ? (parseInt(c.value, 10) || 0) : (Number(rec && rec.metas[r.id]) || 0);
  });
  return CovidFrascos.metaEquivalente(juris);
}

// Caja «Factor de pérdida»: Jurisdicción la captura (dosis de 0.5 mL) y el municipal solo la ve. Muestra el %
// y lo que se debe recibir (meta + pérdida); los topes de frascos usan ese total.
function covidPintarPerdida() {
  const caja = document.getElementById("covidPerdidaBox");
  if (!caja) return;
  caja.style.display = esCovid() ? "" : "none";
  if (!esCovid()) return;
  const isMuni = USER.rol === "MUNICIPAL";
  const inp = document.getElementById("covidPerdidaInput");
  const txt = document.getElementById("covidPerdidaTxt");
  const tbody = document.getElementById("influenzaMetasTbody");
  inp.disabled = isMuni;
  if (tbody && !tbody.dataset.perdidaBound) {
    // Al cambiar la meta de Jurisdicción se recalcula el % y el total a recibir.
    tbody.dataset.perdidaBound = "1";
    tbody.addEventListener("input", (e) => { if (e.target.matches("input[data-juris]")) { covidPintarPerdida(); if (typeof _gridRecalcular === "function") _gridRecalcular(); } });
  }
  const pctInp = document.getElementById("covidPerdidaPct");
  if (pctInp) pctInp.disabled = isMuni;
  if (!inp.dataset.bound) {
    inp.dataset.bound = "1";
    inp.addEventListener("input", () => {
      const limpio = inp.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (inp.value !== limpio) inp.value = limpio;
      inp.dataset.sucio = "1";
      covidPintarPerdida();
      if (typeof _gridRecalcular === "function") _gridRecalcular();   // los frascos cerrados dependen de la pérdida
    });
  }
  if (pctInp && !pctInp.dataset.bound) {
    pctInp.dataset.bound = "1";
    pctInp.addEventListener("input", () => {
      // porcentaje con hasta 2 decimales (acepta coma); las dosis salen de la meta equivalente de la Jurisdicción
      const limpio = pctInp.value.replace(",", ".").replace(/[^0-9.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1");
      if (pctInp.value !== limpio) pctInp.value = limpio;
      const eqJ = covidMetaEquivalenteJuris();
      const pct = parseFloat(limpio);
      if (eqJ > 0 && Number.isFinite(pct)) {
        inp.value = String(Math.round(eqJ * pct / 100));
        inp.dataset.sucio = "1";
        covidPintarPerdida();
        if (typeof _gridRecalcular === "function") _gridRecalcular();
      }
    });
  }
  const rec = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
  const guardada = Number(rec && rec.metas.perdida) || 0;
  if (!inp.dataset.sucio) inp.value = String(guardada);
  const juris = {};
  CovidFrascos.RUBROS.forEach(r => {
    if (!isMuni) {
      const c = tbody && tbody.querySelector(`input[data-rb="${r.id}"][data-juris]`);
      juris[r.id] = c ? (parseInt(c.value, 10) || 0) : 0;
    } else {
      juris[r.id] = Number(rec && rec.metas[r.id]) || 0;
    }
  });
  const p = isMuni ? guardada : (parseInt(inp.value, 10) || 0);
  const eq = CovidFrascos.metaEquivalente(juris);
  // El porcentaje se actualiza solo (salvo mientras se está tecleando en él)
  if (pctInp && document.activeElement !== pctInp) pctInp.value = eq > 0 && p > 0 ? (p * 100 / eq).toFixed(2) : (p > 0 ? "" : "0");
  txt.textContent = eq > 0
    ? `Meta ${eq.toLocaleString("es-MX")} + pérdida ${p.toLocaleString("es-MX")} = total a recibir ${(eq + p).toLocaleString("es-MX")} dosis de 0.5 mL`
    : "Captura la meta de la Jurisdicción para ver el total a recibir.";
}

// Predistribucion de la meta COVID-19 con los porcentajes de la meta de influenza de la misma campana.
// Jurisdiccion: reparte lo capturado en "Comparacion" entre los 4 municipios y los hospitales (NHGQ solo adultos).
// Municipal: reparte la meta COVID de su municipio entre sus unidades. Solo llena los campos: guarda quien presione Guardar.
// Rubros de COVID que recibe cada hospital en la predistribucion (los demas destinos reciben todos).
// HENM: adultos (5-59 con riesgo, 60+) y personal de salud. NHGQ: 60+, 5-59 con riesgo y personal de salud.
const COVID_RUBROS_HOSPITAL = { HENM: ["c3", "c4", "c6"], NHG: ["c3", "c4", "c6"] };

function covidPredistribuir() {
  if (!esCovid() || !window.CovidFrascos) return false;
  const isMuni = USER.rol === "MUNICIPAL";
  const tbody = document.getElementById("influenzaMetasTbody");
  const ids = CovidFrascos.RUBROS.map(r => r.id);
  const metasInf = (fn) => {
    const rec = _adminMetasArray.find(fn);   // metas de INFLUENZA (la vista activa es COVID)
    return (rec && rec.metas) || {};
  };
  const totales = {};
  let items, selector;

  if (!isMuni) {
    ids.forEach(id => {
      const inp = tbody.querySelector(`input[data-rb="${id}"][data-juris]`);
      totales[id] = inp ? (parseInt(inp.value, 10) || 0) : 0;
    });
    items = FRASCO_DESTINOS.map(d => ({
      id: d.id,
      metas: metasInf(m => !m.clues && String(m.municipio).toUpperCase() === d.id),
      permitidos: COVID_RUBROS_HOSPITAL[d.id]
    }));
    selector = (rb, id) => `input[data-rb="${rb}"][data-muni="${id}"]`;
  } else {
    const muni = document.getElementById("adminInfluenzaMuni").value;
    const rec = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === String(muni).toUpperCase());
    ids.forEach(id => { totales[id] = Number(rec && rec.metas[id]) || 0; });
    items = frascoUnidadesMunicipio(muni).map(u => ({ id: u.clues, metas: metasInf(m => m.clues === u.clues) }));
    selector = (rb, id) => `input[data-rb="${rb}"][data-clues="${id}"]`;
  }

  if (!ids.some(id => totales[id] > 0)) {
    showToast(isMuni
      ? "Jurisdicción todavía no asigna meta de COVID-19 a tu municipio."
      : "Captura primero la meta de la Jurisdicción en la columna «Comparación».", false, "bad");
    return false;
  }
  if (!items.length) { showToast("No hay unidades para predistribuir.", false, "bad"); return false; }
  const sinInfluenza = items.every(it => !Object.keys(it.metas).length);
  // Frascos cerrados con la pérdida incluida: Moderna (niños, 5) y Pfizer (adultos, 6). El sobrante abierto se lo
  // queda Querétaro (Jurisdicción) o la unidad Pedro Escobedo (municipal de Querétaro).
  const recJuris = _covidMetasArray.find(m => !m.clues && String(m.municipio).toUpperCase() === "JURISDICCION");
  const perdida = isMuni
    ? (Number(recJuris && recJuris.metas.perdida) || 0)
    : (parseInt((document.getElementById("covidPerdidaInput") || {}).value, 10) || 0);
  const jurisTotales = {};
  CovidFrascos.RUBROS.forEach(r => {
    jurisTotales[r.id] = isMuni ? (Number(recJuris && recJuris.metas[r.id]) || 0) : totales[r.id];
  });
  const muniActual = isMuni ? String(document.getElementById("adminInfluenzaMuni").value).toUpperCase() : "";
  const absorbedor = isMuni
    ? (muniActual === "QUERETARO" && items.some(it => it.id === CLUES_FRASCO_ABIERTO) ? CLUES_FRASCO_ABIERTO : null)
    : "QUERETARO";
  const cerrado = CovidFrascos.predistribuirCerrado(totales, items, { perdida, absorbedor, jurisTotales });
  const res = cerrado.valores;
  items.forEach(it => ids.forEach(rb => {
    const inp = tbody.querySelector(selector(rb, it.id));
    if (inp) { inp.value = String(res[it.id][rb] || 0); inp.dispatchEvent(new Event("input", { bubbles: true })); }
  }));
  if (cerrado.abiertos.length) {
    const nombre = (id) => (FRASCO_DESTINOS.find(d => d.id === id) || {}).label || frascoEtiquetaUnidad(id);
    showToast(`Predistribuido, pero no se pudo cerrar en frascos completos: ${cerrado.abiertos.map(nombre).join(", ")}. Ajusta a mano.`, false, "warn");
  } else {
    const eqJ = CovidFrascos.metaEquivalente(jurisTotales);
    const usada = perdida > 0
      ? `con la pérdida de ${perdida.toLocaleString("es-MX")} dosis${eqJ > 0 ? ` (${(perdida * 100 / eqJ).toFixed(2)} %)` : ""}`
      : "SIN factor de pérdida (captúralo arriba si quieres incluirlo y vuelve a predistribuir)";
    showToast((sinInfluenza
      ? "Predistribuido parejo (no hay metas de influenza para tomar porcentajes) en frascos cerrados, "
      : "Predistribuido con los porcentajes de influenza en frascos cerrados, ") + usada + ". Revisa y presiona Guardar.", true, perdida > 0 ? "good" : "warn");
  }
  return true;
}

// Rubros donde la suma de las unidades no coincide con la meta municipal.
// sobran / faltan: [{ id, dif }] con dif > 0.
function metaDescuadreRubros(metasMunicipio, sumasUnidades) {
  const sobran = [], faltan = [];
  rubrosMetas().forEach(rb => {
    const ref = Number(metasMunicipio[rb.id]) || 0;
    const suma = Number(sumasUnidades[rb.id]) || 0;
    if (suma > ref) sobran.push({ id: rb.id, dif: suma - ref });
    else if (suma < ref) faltan.push({ id: rb.id, dif: ref - suma });
  });
  return { sobran, faltan };
}

function metaListaRubros(lista) {
  const etq = (it) => {
    const rb = rubrosMetas().find(r => r.id === it.id);
    return `${rb.grupo} ${rb.edad} (${it.dif})`;
  };
  const mostrar = lista.slice(0, 3).map(etq).join(", ");
  return lista.length > 3 ? `${mostrar} y ${lista.length - 3} más` : mostrar;
}

async function saveInfluenzaMetasConfig() {
  const isMuni = USER.rol === "MUNICIPAL";
  let avisoFaltantes = "";
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const campana = document.getElementById("metaCampaignSelect").value;

  const rows = [];

  if (!isMuni) {
    // Guardar para los 4 municipios y los 2 hospitales
    const munis = FRASCO_DESTINOS.map(d => d.id);
    // Meta total de la Jurisdicción (columna «Comparación»): solo sirve de referencia para cuadrar.
    const jurisMetas = {};
    rubrosMetas().forEach(rb => {
      const input = document.querySelector(`input[data-rb="${rb.id}"][data-juris]`);
      jurisMetas[rb.id] = input ? (parseInt(input.value, 10) || 0) : 0;
    });
    if (esCovid()) {
      const pi = document.getElementById("covidPerdidaInput");
      jurisMetas.perdida = pi ? (parseInt(pi.value, 10) || 0) : 0;   // dosis de 0.5 mL; no es parte de la meta
    }
    rows.push({ anio_campana: campana, municipio: "JURISDICCION", clues: null, metas: jurisMetas, modificado_por: USER.usuario });
    munis.forEach(m => {
      const metasObj = {};
      rubrosMetas().forEach(rb => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-muni="${m}"]`);
        metasObj[rb.id] = input ? (parseInt(input.value) || 0) : 0;
      });

      rows.push({
        anio_campana: campana,
        municipio: m,
        clues: null,
        metas: metasObj,
        modificado_por: USER.usuario
      });
      // El hospital es un solo destino y una sola unidad: su CLUES lleva la misma meta.
      const hosp = FRASCO_DESTINOS.find(d => d.id === m && d.hospital);
      if (hosp) {
        rows.push({
          anio_campana: campana,
          municipio: m,
          clues: hosp.clues,
          metas: metasObj,
          modificado_por: USER.usuario
        });
      }
    });

    // Si Jurisdicción cambia la meta de un municipio y las metas por unidad ya capturadas dejan de
    // sumarla exacta, se guarda igual pero se avisa (el municipal es quien debe reajustar sus unidades).
    const descuadrados = [];
    ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"].forEach(m => {
      const unidades = metasVista().filter(r =>
        r.clues && !FRASCO_CLUES_HOSPITAL.has(r.clues) && String(r.municipio).toUpperCase() === m);
      if (!unidades.length) return;   // el municipal aún no reparte entre sus unidades
      const sumas = {};
      rubrosMetas().forEach(rb => {
        sumas[rb.id] = unidades.reduce((s, r) => s + (Number((r.metas || {})[rb.id]) || 0), 0);
      });
      const nuevaMeta = rows.find(r => r.municipio === m && !r.clues).metas;
      const d = metaDescuadreRubros(nuevaMeta, sumas);
      const n = d.sobran.length + d.faltan.length;
      if (n) descuadrados.push(`${FRASCO_DESTINOS.find(x => x.id === m).label} (${n} rubro${n > 1 ? "s" : ""})`);
    });
    if (descuadrados.length) {
      avisoFaltantes = `Guardado, pero las metas por unidad ya no suman la meta municipal en: ${descuadrados.join(", ")}. Avisa al municipal para que las ajuste.`;
    }
  } else {
    // Guardar desglose de las CLUES del municipio (sin hospitales: su meta viene de Jurisdicción)
    const muniUnits = frascoUnidadesMunicipio(selectMuni);
    
    // Validación previa: las unidades no pueden pasarse de la meta municipal en ningún rubro
    // (bloquea) y deberían sumarla exacta (si faltan, guarda pero avisa cuáles rubros).
    const muniMetaRec = metasVista().find(m => !m.clues && m.municipio.toUpperCase() === selectMuni.toUpperCase());
    const sumasUnidades = {};
    rubrosMetas().forEach(rb => {
      let sum = 0;
      muniUnits.forEach(u => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-clues="${u.clues}"]`);
        sum += input ? (parseInt(input.value) || 0) : 0;
      });
      sumasUnidades[rb.id] = sum;
    });
    const descuadre = metaDescuadreRubros((muniMetaRec && muniMetaRec.metas) || {}, sumasUnidades);
    if (descuadre.sobran.length) {
      showToast(`Error de validación. Las unidades suman más que la meta municipal en ${metaListaRubros(descuadre.sobran)}.`, false, "bad");
      return;
    }
    avisoFaltantes = descuadre.faltan.length
      ? `Guardado, pero las unidades suman menos que la meta municipal en ${metaListaRubros(descuadre.faltan)}.`
      : "";

    muniUnits.forEach(u => {
      const metasObj = {};
      rubrosMetas().forEach(rb => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-clues="${u.clues}"]`);
        metasObj[rb.id] = input ? (parseInt(input.value) || 0) : 0;
      });

      rows.push({
        anio_campana: campana,
        municipio: selectMuni,
        clues: u.clues,
        metas: metasObj,
        modificado_por: USER.usuario
      });
    });
  }

  await AppService.runCapture({
    btnId: "btnSaveInfluenzaMetas",
    title: "Guardando metas",
    msg: `Registrando metas de ${esCovid() ? "COVID-19" : "Influenza"} en la base de datos...`,
    successMsg: "Configuración de metas guardada correctamente",
    eventTitle: "Influenza",
    eventMsg: "Actualización de catálogo de metas anuales",
    action: async () => {
      const res = await AppService.call(esCovid() ? "savecovid_metas" : "saveinfluenza_metas", { rows });
      const perdidaInp = document.getElementById("covidPerdidaInput");
      if (perdidaInp) delete perdidaInp.dataset.sucio;
      await loadInfluenzaAdminData();
      renderMetasConfigurationGrid();
      if (avisoFaltantes) showToast(avisoFaltantes, false, "warn");
      const sinMovimientoVisual = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof confetti === 'function' && !sinMovimientoVisual) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      return res;
    }
  });
}


// 3. CONTROL DE FRASCOS (MUNICIPAL / ADMIN)

function updateFlaskCalculationMuni() {
  const selectMuni = document.getElementById("adminInfluenzaMuni")?.value;
  if (!selectMuni) return;

  // ADMIN/JURISDICCIONAL ven la jurisdicción completa (4 municipios + 2 hospitales);
  // MUNICIPAL ve su municipio (los hospitales cuentan aparte, aunque sean unidades de QUERETARO).
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";

  // 1. Dosis aplicadas (acumuladas de todas las capturas del ámbito)
  let totalDosis = 0;
  if (esJuris) {
    FRASCO_DESTINOS.forEach(d => { totalDosis += frascoDosisAplicadas(d.id); });
  } else {
    totalDosis = frascoDosisAplicadas(selectMuni.toUpperCase());
  }

  const frascosAplicados = totalDosis / dosisFrasco();

  // 2. Frascos entregados
  let totalFrascosEntregados = 0;
  if (esJuris) {
    remesasVista().forEach(r => {
      totalFrascosEntregados += FRASCO_DESTINOS.reduce((x, d) => x + Number((r.asignacion || {})[d.id] || 0), 0);
    });
  } else {
    // Lo que Jurisdicción asignó al municipio (existe desde que reparte la entrega, aunque el municipio
    // todavía no lo baje a sus unidades); el detalle por unidad está en «Reparto vs. captura semanal».
    remesasVista().forEach(r => {
      totalFrascosEntregados += Number((r.asignacion || {})[selectMuni.toUpperCase()] || 0);
    });
  }

  const dif = totalFrascosEntregados - frascosAplicados;

  const entregadosEl = document.getElementById("muniFrascosEntregados");
  const reportadosEl = document.getElementById("muniFrascosReportados");
  const diferenciaEl = document.getElementById("muniFrascosDiferencia");
  const warningBox = document.getElementById("muniFrascosWarningBox");

  if (entregadosEl) entregadosEl.textContent = totalFrascosEntregados;
  if (reportadosEl) reportadosEl.textContent = `${frascosAplicados} frascos (${totalDosis} dosis)`;
  if (diferenciaEl) diferenciaEl.textContent = `${dif} frascos`;

  if (warningBox) {
    if (totalFrascosEntregados > 0) {
      warningBox.className = "mb-4 p-4 rounded-xl border-2 block text-xs font-semibold ";
      if (dif < 0) {
        warningBox.classList.add("bg-rose-50", "border-rose-200", "text-rose-950");
        warningBox.innerHTML = `⚠️ <b>Inconsistencia:</b> Se han reportado más dosis aplicadas en el municipio (${totalDosis} dosis = ${frascosAplicados} frascos) que el total de frascos entregados (${totalFrascosEntregados} frascos).`;
      } else if (dif > 0 && dif >= (totalFrascosEntregados * 0.5)) {
        warningBox.classList.add("bg-amber-50", "border-amber-200", "text-amber-950");
        warningBox.innerHTML = `⚠️ <b>Observación:</b> Se han entregado ${totalFrascosEntregados} frascos, pero las unidades solo han reportado aplicar ${totalDosis} dosis (${frascosAplicados} frascos). Hay un resguardo del ${Math.round((dif/totalFrascosEntregados)*100)}% sin aplicar en el municipio.`;
      } else {
        warningBox.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-950");
        warningBox.innerHTML = `✅ <b>Balance Logístico:</b> Balance correcto. Frascos en resguardo estimado municipal: ${dif} frascos (${dif * 10} dosis).`;
      }
    } else {
      warningBox.className = "hidden";
    }
  }
}

// Un frasco de influenza rinde 10 dosis.
const DOSIS_POR_FRASCO = 10;

// Destinos del reparto jurisdiccional. Querétaro va primero: a igualdad de
// residuo es quien se queda con el frasco sobrante (ver influenza_reparto.js).
// Los hospitales son unidades de QUERETARO en el catálogo, pero aquí son
// destinos aparte con su propia meta y su propio renglón.
const FRASCO_DESTINOS = [
  { id: "QUERETARO", label: "Querétaro" },
  { id: "CORREGIDORA", label: "Corregidora" },
  { id: "MARQUES", label: "El Marqués" },
  { id: "HUIMILPAN", label: "Huimilpan" },
  { id: "HENM", label: "HENM", clues: "QTSSA001740", hospital: true },
  { id: "NHG", label: "NHGQ", clues: "QTSSA002901", hospital: true }
];
const FRASCO_CLUES_HOSPITAL = new Set(FRASCO_DESTINOS.filter(d => d.hospital).map(d => d.clues));

let _adminRemesasArray = [];
// fijos: frascos que NO se recalculan (editados a mano, o cargados de una entrega guardada).
// editados: los que el usuario tocó de verdad (se guardan como "manual").
// tocados: los renglones que el usuario escribió en esta sesión (se marcan en rojo/ámbar si el total no cuadra).
let _remesaState = { numero: null, fijos: {}, editados: new Set(), tocados: new Set() };
let _muniRepartoState = { numero: null, fijos: {}, editados: new Set(), tocados: new Set() };

function frascoSumaMetas(metas) {
  if (esCovid()) return CovidFrascos.metaMarcaConPerdida(metas, _marcaCovid, covidFactor());
  return Object.values(metas || {}).reduce((a, v) => a + (Number(v) || 0), 0);
}

function frascoMetaDestino(id) {
  const rec = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === id);
  return rec ? frascoSumaMetas(rec.metas) : 0;
}

function frascoMetaUnidad(clues) {
  const rec = metasVista().find(m => m.clues === clues);
  return rec ? frascoSumaMetas(rec.metas) : 0;
}

// Tope duro del reparto: lo recibido en TODAS las entregas de la campaña no puede rebasar la meta en frascos
// (meta en dosis / 10, hacia arriba porque el último frasco puede quedar abierto). El servidor lo impone igual
// (influenza_remesas_tope_meta.sql); aquí solo se anticipa para mostrarlo y bloquear antes de guardar.
function frascoTopeMeta(metaDosis) {
  return Math.ceil((Number(metaDosis) || 0) / dosisFrasco());
}

function frascoRecibidoOtrasDestino(id, numero) {
  return remesasVista()
    .filter(r => r.numero_entrega !== numero)
    .reduce((s, r) => s + Number((r.asignacion || {})[id] || 0), 0);
}

function frascoRecibidoOtrasUnidad(clues, numero) {
  return frascosVista()
    .filter(d => d.clues === clues && d.numero_entrega !== numero)
    .reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
}

// Agrega `tope` (lo que aún le cabe al renglón en esta entrega) y `otras` (lo ya recibido). Sin ninguna meta
// capturada no hay tope: ese caso ya lo bloquea el aviso «sin meta».
// nivel: "destino" (remesa de Jurisdicción) o "unidad" (reparto municipal); en COVID el tope también descuenta
// lo entregado de la OTRA marca (todo cuenta contra la misma meta en dosis de 0.5 mL).
function frascoConTope(items, otrasFn, nivel) {
  const hayMetas = items.some(i => i.meta > 0);
  return items.map(i => {
    const otras = otrasFn(i.id);
    if (!esCovid()) {
      return { ...i, otras, metaFrascos: frascoTopeMeta(i.meta), tope: hayMetas ? Math.max(0, frascoTopeMeta(i.meta) - otras) : undefined };
    }
    const rec = metasVista().find(m => nivel === "unidad"
      ? m.clues === i.id
      : !m.clues && String(m.municipio).toUpperCase() === i.id);
    const metas = (rec && rec.metas) || {};
    const otraMarca = nivel === "unidad"
      ? _covidFrascosAll.filter(d => d.marca !== _marcaCovid && d.clues === i.id)
          .reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0)
      : _covidRemesasAll.filter(r => r.marca !== _marcaCovid)
          .reduce((s, r) => s + Number((r.asignacion || {})[i.id] || 0), 0);
    const tope = CovidFrascos.topeFrascos({
      total: CovidFrascos.metaMarcaConPerdida(metas, "MODERNA", covidFactor()),
      adulto: CovidFrascos.metaMarcaConPerdida(metas, "PFIZER", covidFactor()),
      marca: _marcaCovid, propiasOtras: otras, otraMarca
    });
    return { ...i, otras, otraMarca, metaFrascos: frascoTopeMeta(i.meta), tope: hayMetas ? tope : undefined };
  });
}

function frascoTextoExceso(excesos, etiquetaFn, items) {
  const por = {};
  items.forEach(i => { por[i.id] = i; });
  const lista = excesos.map(e => {
    const it = por[e.id] || {};
    const ya = esCovid() && it.otraMarca ? `, ya recibió ${frascoFmt(it.otras || 0)} de esta marca y ${frascoFmt(it.otraMarca)} de la otra` : `, ya recibió ${frascoFmt(it.otras || 0)}`;
    return `${etiquetaFn(e.id)}: ${frascoFmt(e.valor)} frascos y solo le caben ${frascoFmt(e.tope)} (meta ${frascoFmt(it.metaFrascos != null ? it.metaFrascos : frascoTopeMeta(it.meta))}${ya})`;
  });
  return lista.join("; ");
}

// Unidades que reparten frascos dentro de un municipio (sin los hospitales, que son destino propio).
function frascoUnidadesMunicipio(muni) {
  return _allUnidades.filter(u =>
    String(u.municipio).toUpperCase() === String(muni).toUpperCase() && !FRASCO_CLUES_HOSPITAL.has(u.clues));
}

// Municipal que atiende más de un municipio (p. ej. Corregidora y Huimilpan): selector propio en Control de
// frascos, igual que en Distribución de Metas; comparte valor con el selector general de la pestaña Avances.
function frascoSincronizarSelectorMuni() {
  const general = document.getElementById("adminInfluenzaMuni");
  const sel = document.getElementById("frascoMuniSelect");
  const col = document.getElementById("frascoMuniCol");
  if (!general || !sel || !col) return;
  const mostrar = USER.rol === "MUNICIPAL" && general.options.length > 1;
  col.style.display = mostrar ? "" : "none";
  if (!mostrar) return;
  sel.innerHTML = general.innerHTML;
  sel.value = general.value;
  sel.onchange = () => {
    general.value = sel.value;
    general.dispatchEvent(new Event("change"));
    renderFrascosDistribution();
  };
}

function frascoEntero(v) {
  return parseInt(String(v == null ? "" : v).replace(/[^\d]/g, ""), 10) || 0;
}

function frascoOrdinal(n) {
  return `${n}ª entrega`;
}

function frascoFmt(n) {
  return Number(n || 0).toLocaleString("es-MX");
}

function frascoPintarResumen(el, tono, html) {
  if (!el) return;
  el.className = `frs-box frs-box--${tono}`;
  el.innerHTML = html;
}

// "% real": qué parte de los frascos recibidos se asignó de verdad a este renglón.
// Junto al % de la meta permite ver de un vistazo cuánto se desvió una edición manual
// (se marca en ámbar cuando la diferencia pasa de medio punto porcentual).
function frascoPintarPctReal(el, frascos, total, metaPct) {
  if (!el) return;
  if (!total) { el.className = "c frs-real frs-muted"; el.textContent = "—"; return; }
  const real = frascos * 100 / total;
  const dif = metaPct == null ? 0 : real - metaPct;
  const desv = Math.abs(dif) > 0.5;
  el.className = "c frs-real" + (desv ? " frs-real--desv" : "");
  el.innerHTML = `${real.toFixed(2)}%` + (desv ? `<small title="Diferencia contra el % de la meta">${dif > 0 ? "+" : ""}${dif.toFixed(2)} pts</small>` : "");
}

const FRASCO_MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
function frascoMmmAa(fechaIso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(fechaIso || ""));
  return m ? `${FRASCO_MESES[Number(m[2]) - 1]}-${m[1].slice(2)}` : "";
}

// Lotes de una unidad en una entrega, tal como están en Requisiciones.
function frascoLotesDe(numero, clues) {
  return lotesVista().filter(l => Number(l.numero_entrega) === Number(numero) && l.clues === clues);
}

// Celda de lote (solo lectura): "Pendiente" si aún no llega, o lote(s) con caducidad.
function frascoLoteHtml(numero, clues) {
  const lotes = frascoLotesDe(numero, clues);
  if (!lotes.length) return '<span class="frs-muted" title="Aún no está en Requisiciones">—</span>';
  return lotes.map(l => l.lote === "POR DEFINIR"
    ? '<span class="frs-lote frs-lote--pend" title="El lote se asigna en Requisiciones cuando llegue la entrega">Pendiente</span>'
    : `<span class="frs-lote" title="${l.cantidad} frascos">${l.lote}${l.caducidad ? ` <small>${frascoMmmAa(l.caducidad)}</small>` : ""}</span>`).join(" ");
}

// Resumen para la barra de la entrega: cuántos frascos ya tienen lote real.
function frascoEstadoLotes(numero, units) {
  const claves = new Set(units.map(u => u.clues));
  const filas = lotesVista().filter(l => Number(l.numero_entrega) === Number(numero) && claves.has(l.clues));
  if (!filas.length) return { tono: "info", html: '<span class="material-symbols-rounded">inventory_2</span> Los lotes se asignan en <b>Requisiciones</b> cuando llegue la entrega.' };
  const total = filas.reduce((s, l) => s + Number(l.cantidad || 0), 0);
  const conLote = filas.filter(l => l.lote !== "POR DEFINIR").reduce((s, l) => s + Number(l.cantidad || 0), 0);
  if (conLote >= total) return { tono: "good", html: `<span class="material-symbols-rounded">check_circle</span> Lotes asignados en Requisiciones (${frascoFmt(conLote)} frascos).` };
  return { tono: "warn", html: `<span class="material-symbols-rounded">pending</span> ${frascoFmt(conLote)} de ${frascoFmt(total)} frascos ya tienen lote en Requisiciones.` };
}

// Marca de un renglón editado a mano: dice cuánto le tocaría por meta, para que una edición
// vieja (se conserva al guardar) no pase como un error del cálculo.
function frascoMarcaEditado(editado, proporcional) {
  return editado ? `editado · por meta: ${frascoFmt(proporcional)}` : "";
}

function frascoResumenReparto(el, total, res, tieneMeta) {
  if (!total) {
    frascoPintarResumen(el, "info", "Captura el total de frascos recibidos para calcular el reparto.");
  } else if (res.porAsignar < 0) {
    frascoPintarResumen(el, "bad", `⚠️ <b>${frascoFmt(res.asignado)} frascos repartidos de ${frascoFmt(total)}</b>: te pasaste por <b>${frascoFmt(-res.porAsignar)}</b>. Baja lo que cambiaste (marcado en rojo) o usa «Cuadrar con las demás».`);
  } else if (res.porAsignar > 0) {
    frascoPintarResumen(el, "warn", `<b>${frascoFmt(res.asignado)} frascos repartidos de ${frascoFmt(total)}</b>: faltan <b>${frascoFmt(res.porAsignar)}</b> por repartir${tieneMeta ? ". Sube alguna cantidad o usa «Cuadrar con las demás»" : " (ninguna unidad tiene meta capturada)"}.`);
  } else {
    frascoPintarResumen(el, "good", `✅ Reparto completo: ${frascoFmt(res.asignado)} de ${frascoFmt(total)} frascos (${frascoFmt(res.asignado * dosisFrasco())} dosis).`);
  }
}

// Guardar un reparto exige que sume EXACTO lo asignado: si se pasa o falta no se guarda, se dice cuánto
// y se sacude el recuadro correspondiente para que no pase desapercibido.
function frascoBloquearGuardado(porAsignar, sinMeta, ids) {
  const regla = "El reparto debe sumar exactamente los frascos asignados.";
  const msg = sinMeta
    ? "No se puede guardar: ninguna unidad tiene meta capturada, así que no hay con qué repartir los frascos."
    : porAsignar < 0
      ? `No se puede guardar: te pasaste por ${frascoFmt(-porAsignar)} frascos. ${regla}`
      : `No se puede guardar: faltan ${frascoFmt(porAsignar)} frascos por repartir. ${regla}`;
  showToast(msg, false, "bad");
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("frs-shake");
    void el.offsetWidth;
    el.classList.add("frs-shake");
  });
  return msg;
}

// Pinta el bloqueo por tope de meta sobre lo ya pintado: renglones que rebasan en rojo (con su motivo) y el
// resumen. Devuelve los excesos (vacío si todo cabe) para que el guardado se bloquee con la misma lista.
function frascoAplicarTope(items, res, total, resumenEl, prefInput, prefMark, etiquetaFn) {
  const excesos = InfluenzaReparto.excedenTope(items, res.frascos);
  const ids = new Set(excesos.map(e => e.id));
  items.forEach(it => {
    const inp = document.getElementById(`${prefInput}${it.id}`);
    if (inp && ids.has(it.id)) inp.classList.add("frs-num--excede");
    const mk = document.getElementById(`${prefMark}${it.id}`);
    if (mk && ids.has(it.id)) mk.textContent = `rebasa su meta: tope ${frascoFmt(it.tope)} (ya recibió ${frascoFmt(it.otras || 0)} en otras entregas)`;
  });
  if (excesos.length) {
    frascoPintarResumen(resumenEl, "bad",
      `⛔ <b>Rebasa la meta de frascos de la campaña</b> y no se puede guardar. ${frascoTextoExceso(excesos, etiquetaFn, items)}. Baja esas cantidades.`);
  } else if (total > 0 && res.porAsignar > 0 && items.length && items.every(i => i.tope !== undefined)) {
    const cabe = items.reduce((s, i) => s + i.tope, 0);
    if (total > cabe) {
      frascoPintarResumen(resumenEl, "bad",
        `⛔ <b>Estos ${frascoFmt(total)} frascos ya no caben en la meta de la campaña</b>: solo hay lugar para ${frascoFmt(cabe)}. No se puede guardar; revisa el total capturado.`);
    }
  }
  return excesos;
}

// Marca en rojo (se pasa) o ámbar (falta) SOLO los renglones que el usuario tocó; no mueve ningún otro.
function frascoMarcarInputs(ids, prefijo, res, total, tocados) {
  const exceso = res.porAsignar < 0;
  const falta = res.porAsignar > 0 && total > 0;
  ids.forEach(id => {
    const inp = document.getElementById(`${prefijo}${id}`);
    if (!inp) return;
    inp.classList.toggle("frs-num--excede", exceso && tocados.has(id));
    inp.classList.toggle("frs-num--falta", falta && tocados.has(id));
  });
}

// «Cuadrar con las demás»: acción explícita que reparte lo que falta (o quita lo que sobra) entre los renglones
// que NO se tocaron, proporcional a su meta. Los que se tocaron no se mueven.
function frascoCuadrar(total, items, state) {
  const tocados = {};
  items.forEach(it => { if (state.tocados.has(it.id) && it.id in state.fijos) tocados[it.id] = state.fijos[it.id]; });
  const r = InfluenzaReparto.cuadrarResto(total, items, tocados);
  if (!r.ok) {
    const motivos = {
      "no-hay-libres": "No hay otros renglones que ajustar: todos los tocaste.",
      "tocados-se-pasan": `Lo que cambiaste ya suma ${frascoFmt(r.sumaTocados)}, más que los ${frascoFmt(total)} asignados: baja esas cantidades primero.`,
      "sin-meta": "Los demás renglones no tienen meta capturada, no hay con qué cuadrarlos."
    };
    showToast(motivos[r.motivo] || "No se pudo cuadrar.", false, "bad");
    return false;
  }
  r.libres.forEach(id => { state.fijos[id] = r.frascos[id]; });
  return true;
}

// Al cambiar el total recibido (Jurisdicción) se sueltan los renglones que no editó el usuario para recalcularlos por meta.
function frascoSoltarCargados(state) {
  const nuevos = {};
  state.editados.forEach(id => { if (id in state.fijos) nuevos[id] = state.fijos[id]; });
  state.fijos = nuevos;
}

// ─── Reparto jurisdiccional (ADMIN / JURISDICCIONAL) ───────────────────────

// Meta en FRASCOS de una unidad/destino por marca (si toda su meta se cubriera con esa marca): Moderna cubre
// niños y adultos (5 dosis); Pfizer, solo la meta adulta (6 dosis). Es la meta compartida: lo que recibe una marca
// descuenta de la otra, por eso aquí se muestran como topes alternos, no sumables.
function covidMetaFrascosDe(metas) {
  const f = covidFactor();
  return {
    MODERNA: Math.ceil(CovidFrascos.metaMarcaConPerdida(metas || {}, "MODERNA", f) / CovidFrascos.dosisPorFrasco("MODERNA")),
    PFIZER: Math.ceil(CovidFrascos.metaMarcaConPerdida(metas || {}, "PFIZER", f) / CovidFrascos.dosisPorFrasco("PFIZER"))
  };
}

// Celda «Te caben»: lo que todavía le cabe en esta marca/entrega, con su meta en frascos. Se ve ANTES de capturar.
function frascoTopeCeldaHtml(it, metasRec) {
  if (it.tope === undefined || it.tope === null) return '<span class="frs-muted">sin meta</span>';
  const cero = it.tope <= 0;
  const sub = esCovid()
    ? ``
    : `ya recibió ${frascoFmt(it.otras || 0)}`;
  return `<span class="frs-tope${cero ? " frs-tope--cero" : ""}" title="Le caben ${frascoFmt(it.tope)} frascos sin rebasar su meta (descontadas las dos marcas)">${frascoFmt(it.tope)}</span>${sub ? `<span class="frs-tope-sub">${sub}</span>` : ""}`;
}

// Celdas «Meta (frascos)» / «Meta Moderna» / «Meta Pfizer»: la meta de cada renglón en frascos, bien visible.
function frascoPintarMetaFr(pref, id, metas, it) {
  const set = (suf, n) => {
    const el = document.getElementById(`${pref}_${suf}_${id}`);
    if (el) el.innerHTML = `<span class="frs-metafr">${frascoFmt(n)}</span><span class="frs-metafr-u">frascos</span>`;
  };
  if (esCovid()) {
    const m = covidMetaFrascosDe(metas);
    set("mmod", m.MODERNA);
    set("mpfz", m.PFIZER);
  } else {
    set("mfr", (it && it.metaFrascos) || 0);
  }
}

function frascoPintarMetaFrTotales(pref, lista) {
  const set = (suf, n) => {
    const el = document.getElementById(`${pref}_${suf}_T`);
    if (el) el.innerHTML = `<span class="frs-metafr">${frascoFmt(n)}</span>`;
  };
  if (esCovid()) {
    set("mmod", lista.reduce((a, x) => a + covidMetaFrascosDe(x.metas).MODERNA, 0));
    set("mpfz", lista.reduce((a, x) => a + covidMetaFrascosDe(x.metas).PFIZER, 0));
  } else {
    set("mfr", lista.reduce((a, x) => a + ((x.it && x.it.metaFrascos) || 0), 0));
  }
}

// Estado del reparto en una píldora compacta («faltan N» / «te pasaste N» / «completo»): se pinta en todos los
// elementos dados (sobre el command hub, en línea en pantallas chicas o junto a «Guardar» en Jurisdicción).
function frascoPintarPill(ids, { total, asignado, porAsignar }) {
  const marca = esCovid() ? `${_marcaCovid === "PFIZER" ? "Pfizer" : "Moderna"} · ` : "";
  let estado, icono, valor, etiqueta, completo;
  if (!total && !asignado) {
    estado = "vacio"; icono = "inventory_2"; valor = "—"; etiqueta = "sin frascos";
    completo = `Sin frascos por repartir en esta entrega${marca ? ` · ${marca.replace(" · ", "")}` : ""}`;
  } else {
    estado = porAsignar === 0 ? "ok" : porAsignar > 0 ? "falta" : "excede";
    const abs = Math.abs(porAsignar);
    const plural = abs === 1 ? "frasco" : "frascos";
    icono = estado === "ok" ? "check_circle" : estado === "falta" ? "hourglass_top" : "error";
    valor = estado === "ok" ? "OK" : frascoFmt(abs);
    etiqueta = estado === "ok" ? "completo" : estado === "falta" ? "faltan" : "de más";
    completo = (estado === "ok" ? "Reparto completo"
      : estado === "falta" ? `Faltan ${frascoFmt(abs)} ${plural} por repartir`
        : `Te pasaste por ${frascoFmt(abs)} ${plural}`)
      + ` · ${marca}${frascoFmt(asignado)} de ${frascoFmt(total)} frascos repartidos`;
  }
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.estado = estado;
    el.setAttribute("aria-label", completo);
    el.title = completo;
    if (el.classList.contains("frs-pill--inline")) {
      // En línea (Jurisdicción / pantallas chicas): una sola frase corta
      el.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icono}</span><b>${completo.split(" · ")[0]}</b>`;
    } else if (estado === "ok") {
      el.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icono}</span><small>${etiqueta}</small>`;
    } else {
      // Círculo del hub: el número es lo importante; con 4+ dígitos se achica para que quepa
      const chico = String(valor).length >= 4 ? ' style="font-size:13px"' : "";
      el.innerHTML = `<b${chico}>${valor}</b><small>${etiqueta}</small>`;
    }
  });
}

function renderRemesaPanel() {
  const sel = document.getElementById("remesaNumeroSelect");
  if (!sel) return;
  const nums = remesasVista().map(r => r.numero_entrega);
  const siguiente = (nums.length ? Math.max(...nums) : 0) + 1;
  if (_remesaState.numero == null || (!nums.includes(_remesaState.numero) && _remesaState.numero !== siguiente)) {
    _remesaState.numero = siguiente;
  }
  sel.innerHTML = nums.map(n => `<option value="${n}">${frascoOrdinal(n)} (guardada)</option>`).join("")
    + `<option value="${siguiente}">${frascoOrdinal(siguiente)} (nueva)</option>`;
  sel.value = String(_remesaState.numero);

  if (!sel.dataset.bound) {
    sel.dataset.bound = "1";
    sel.addEventListener("change", () => { _remesaState.numero = parseInt(sel.value, 10); cargarRemesaSeleccionada(); });
    document.getElementById("remesaTotalInput").addEventListener("input", () => {
      frascoSoltarCargados(_remesaState);
      refreshRemesa();
    });
    document.getElementById("btnRemesaReset").addEventListener("click", () => {
      _remesaState.fijos = {};
      _remesaState.editados = new Set();
      _remesaState.tocados = new Set();
      refreshRemesa();
    });
    document.getElementById("btnRemesaCuadrar").addEventListener("click", () => {
      const { total, items } = calcularRemesa();
      if (!total) { showToast("Captura primero el total de frascos recibidos.", false, "bad"); return; }
      if (frascoCuadrar(total, items, _remesaState)) refreshRemesa();
    });
    document.getElementById("btnSaveRemesa").addEventListener("click", saveRemesa);
  }
  cargarRemesaSeleccionada();
}

function cargarRemesaSeleccionada() {
  const r = remesasVista().find(x => x.numero_entrega === _remesaState.numero);
  document.getElementById("remesaTotalInput").value = r ? String(r.total_frascos) : "";
  document.getElementById("remesaFechaInput").value = r ? r.fecha : new Date().toISOString().split("T")[0];
  _remesaState.fijos = r ? { ...r.asignacion } : {};
  _remesaState.editados = new Set(r ? (r.manual || []) : []);
  _remesaState.tocados = new Set();

  const tbody = document.getElementById("remesaTbody");
  tbody.innerHTML = "";
  FRASCO_DESTINOS.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${d.label}</b>${d.hospital ? ' <span class="frs-sub">hospital</span>' : ""}</td>
      <td class="c" id="rem_meta_${d.id}"></td>
      <td class="c frs-muted" id="rem_pct_${d.id}"></td>
      <td class="c col-inf" id="rem_mfr_${d.id}"></td>
      <td class="c col-mod" id="rem_mmod_${d.id}"></td>
      <td class="c col-pfz" id="rem_mpfz_${d.id}"></td>
      <td class="c" id="rem_tope_${d.id}"></td>
      <td class="c">
        <input type="text" inputmode="numeric" autocomplete="off" id="rem_inp_${d.id}" class="frs-num" aria-describedby="rem_tope_${d.id}">
        <div class="frs-mark" id="rem_mark_${d.id}"></div>
      </td>
      <td class="c frs-real" id="rem_real_${d.id}"></td>
      <td class="c frs-muted" id="rem_dos_${d.id}"></td>`;
    tbody.appendChild(tr);
    // Tocar un destino SOLO cambia ese destino: los demás se quedan como estaban.
    tr.querySelector("input").addEventListener("input", (e) => {
      if (e.target.value.trim() === "") {
        delete _remesaState.fijos[d.id];
        _remesaState.editados.delete(d.id);
        _remesaState.tocados.delete(d.id);
      } else {
        _remesaState.fijos[d.id] = frascoEntero(e.target.value);
        _remesaState.editados.add(d.id);
        _remesaState.tocados.add(d.id);
      }
      refreshRemesa(e.target);
    });
  });
  const tf = document.createElement("tr");
  tf.className = "frs-total";
  tf.innerHTML = `<td>TOTAL</td><td class="c" id="rem_meta_T"></td>
    <td class="c" id="rem_pct_T"></td><td class="c col-inf" id="rem_mfr_T"></td><td class="c col-mod" id="rem_mmod_T"></td><td class="c col-pfz" id="rem_mpfz_T"></td><td class="c" id="rem_tope_T"></td><td class="c" id="rem_inp_T"></td>
    <td class="c" id="rem_real_T"></td><td class="c" id="rem_dos_T"></td>`;
  tbody.appendChild(tf);
  refreshRemesa();
}

function calcularRemesa() {
  const total = frascoEntero(document.getElementById("remesaTotalInput").value);
  const items = frascoConTope(
    FRASCO_DESTINOS.map(d => ({ id: d.id, meta: frascoMetaDestino(d.id) })),
    id => frascoRecibidoOtrasDestino(id, _remesaState.numero), "destino");
  const res = InfluenzaReparto.repartoLibre(total, items, _remesaState.fijos);
  const porMeta = res.base;
  return { total, items, res, porMeta, sumaMeta: items.reduce((s, i) => s + i.meta, 0) };
}

// Renglones del reparto municipal (una por unidad) con su tope por meta de la campaña.
function frascoItemsMunicipal(muni) {
  const numero = _muniRepartoState.numero;
  return frascoConTope(
    frascoUnidadesMunicipio(muni).map(u => ({ id: u.clues, meta: frascoMetaUnidad(u.clues) })),
    clues => frascoRecibidoOtrasUnidad(clues, numero), "unidad");
}

function frascoEtiquetaUnidad(clues) {
  const u = _allUnidades.find(x => x.clues === clues);
  return u ? u.unidad : clues;
}

function frascoEtiquetaDestino(id) {
  return (FRASCO_DESTINOS.find(d => d.id === id) || { label: id }).label;
}

function refreshRemesa(enfocado) {
  const { total, items, res, porMeta, sumaMeta } = calcularRemesa();
  items.forEach(it => {
    const v = res.frascos[it.id] || 0;
    document.getElementById(`rem_meta_${it.id}`).textContent = frascoFmt(it.meta);
    document.getElementById(`rem_pct_${it.id}`).textContent = sumaMeta ? `${(it.meta * 100 / sumaMeta).toFixed(2)}%` : "—";
    const recDest = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === it.id);
    document.getElementById(`rem_tope_${it.id}`).innerHTML = frascoTopeCeldaHtml(it, recDest && recDest.metas);
    frascoPintarMetaFr("rem", it.id, recDest && recDest.metas, it);
    const inp = document.getElementById(`rem_inp_${it.id}`);
    if (inp !== enfocado) inp.value = total || v ? String(v) : "";
    document.getElementById(`rem_mark_${it.id}`).textContent = frascoMarcaEditado(_remesaState.editados.has(it.id), porMeta[it.id]);
    document.getElementById(`rem_dos_${it.id}`).textContent = frascoFmt(v * dosisFrasco());
    frascoPintarPctReal(document.getElementById(`rem_real_${it.id}`), v, total, sumaMeta ? it.meta * 100 / sumaMeta : null);
  });
  frascoPintarPctReal(document.getElementById("rem_real_T"), res.asignado, total, 100);
  document.getElementById("rem_meta_T").textContent = frascoFmt(sumaMeta);
  document.getElementById("rem_pct_T").textContent = sumaMeta ? "100%" : "—";
  document.getElementById("rem_inp_T").textContent = total ? `${frascoFmt(res.asignado)} de ${frascoFmt(total)}` : frascoFmt(res.asignado);
  frascoPintarMetaFrTotales("rem", items.map(i => {
    const r = metasVista().find(m => !m.clues && String(m.municipio).toUpperCase() === i.id);
    return { metas: r && r.metas, it: i };
  }));
  const sumaTope = items.reduce((a, i) => a + (i.tope === undefined ? 0 : i.tope), 0);
  document.getElementById("rem_tope_T").innerHTML = items.some(i => i.tope !== undefined) ? `<span class="frs-tope">${frascoFmt(sumaTope)}</span>` : "";
  frascoPintarPill(["remesaPill"], { total, asignado: res.asignado, porAsignar: res.porAsignar });
  document.getElementById("rem_dos_T").textContent = frascoFmt(res.asignado * dosisFrasco());
  const filaTotal = document.getElementById("rem_inp_T").closest("tr");
  if (filaTotal) filaTotal.dataset.estado = !total ? "" : res.porAsignar === 0 ? "ok" : res.porAsignar > 0 ? "falta" : "excede";
  frascoMarcarInputs(items.map(i => i.id), "rem_inp_", res, total, _remesaState.tocados);
  frascoResumenReparto(document.getElementById("remesaResumen"), total, res, sumaMeta > 0);
  frascoAplicarTope(items, res, total, document.getElementById("remesaResumen"), "rem_inp_", "rem_mark_", frascoEtiquetaDestino);
}

async function saveRemesa() {
  const fecha = document.getElementById("remesaFechaInput").value;
  const { total, res, items } = calcularRemesa();
  const numero = _remesaState.numero;
  if (!total || !fecha) {
    showToast("Captura la fecha y el total de frascos recibidos.", false, "bad");
    return;
  }
  const excesos = InfluenzaReparto.excedenTope(items, res.frascos);
  if (excesos.length) {
    showToast(`No se puede guardar: rebasa la meta de frascos de la campaña. ${frascoTextoExceso(excesos, frascoEtiquetaDestino, items)}.`, false, "bad");
    const caja = document.getElementById("remesaResumen");
    if (caja) { caja.classList.remove("frs-shake"); void caja.offsetWidth; caja.classList.add("frs-shake"); }
    return;
  }
  if (res.porAsignar !== 0) {
    frascoBloquearGuardado(res.porAsignar, items.every(i => !i.meta), ["remesaResumen"]);
    return;
  }
  const campana = document.getElementById("metaCampaignSelect").value;
  await AppService.runCapture({
    btnId: "btnSaveRemesa",
    title: "Guardando reparto",
    msg: `Guardando el reparto de la ${frascoOrdinal(numero)}...`,
    successMsg: "Reparto de la entrega guardado correctamente",
    eventTitle: esCovid() ? "COVID-19" : "Influenza",
    eventMsg: `Reparto de la ${frascoOrdinal(numero)} de frascos${esCovid() ? ` (${vacunaEtiqueta()})` : ""}`,
    action: async () => {
      await AppService.call(esCovid() ? "savecovid_remesa" : "saveinfluenza_remesa", {
        anio_campana: campana,
        ...(esCovid() ? { marca: _marcaCovid } : {}),
        numero_entrega: numero,
        fecha,
        total_frascos: total,
        asignacion: res.frascos,
        manual: [..._remesaState.editados]
      });
      // Los hospitales son su propio destino (una sola unidad): su entrega queda registrada de una vez.
      for (const d of FRASCO_DESTINOS.filter(x => x.hospital)) {
        await AppService.call(esCovid() ? "guardarcovid_reparto" : "guardarinfluenza_reparto", {
          anio_campana: campana,
          ...(esCovid() ? { marca: _marcaCovid } : {}),
          municipio: d.id,
          numero_entrega: numero,
          fecha,
          rows: [{ clues: d.clues, cantidad_frascos: res.frascos[d.id] || 0 }]
        });
      }
      await loadInfluenzaAdminData();
      renderFrascosDistribution();
      return { ok: true };
    }
  });
}

// ─── Reparto municipal entre unidades ──────────────────────────────────────

// COVID: el tope de una unidad cuenta lo recibido de las DOS marcas contra la misma meta; en «Otras entregas» se
// ve lo de la marca elegida y, debajo, lo ya recibido de la otra marca (para que el tope no sorprenda).
function frascoOtraMarcaHtml(clues) {
  if (!esCovid()) return "";
  const otra = _marcaCovid === "MODERNA" ? "PFIZER" : "MODERNA";
  const n = _covidFrascosAll.filter(d => d.marca === otra && d.clues === clues)
    .reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
  return n ? `<span class="frs-sub" style="display:block">${otra === "PFIZER" ? "Pfizer" : "Moderna"}: ${frascoFmt(n)}</span>` : "";
}

function frascosRecibidosMunicipio(muni, numero) {
  const r = remesasVista().find(x => x.numero_entrega === numero);
  return r ? Number((r.asignacion || {})[muni] || 0) : 0;
}

function renderFrascosMunicipal(muni) {
  const sel = document.getElementById("frascoEntregaInput");
  const tbody = document.getElementById("frascosBatchTbody");
  const resumen = document.getElementById("frascosMuniResumen");
  const remesas = remesasVista().filter(r => Number((r.asignacion || {})[muni] || 0) > 0);

  if (!remesas.length) {
    sel.innerHTML = "";
    tbody.innerHTML = "";
    const deMarca = esCovid() ? ` de ${_marcaCovid === "PFIZER" ? "Pfizer" : "Moderna"}` : "";
    frascoPintarResumen(resumen, "info", `La Jurisdicción todavía no asigna frascos${deMarca} a este municipio. Cuando reparta una entrega${deMarca} aparecerá aquí.`
      + (esCovid() ? " Puedes cambiar de marca arriba." : ""));
    ["frascosHubEstado", "frascosEstadoInline"].forEach(id => { const p = document.getElementById(id); if (p) p.innerHTML = ""; });
    const kpisVacio = document.getElementById("frascosMuniKpis");
    if (kpisVacio) kpisVacio.style.display = "none";
    return;
  }

  const nums = remesas.map(r => r.numero_entrega);
  if (!nums.includes(_muniRepartoState.numero)) _muniRepartoState.numero = nums[nums.length - 1];
  sel.innerHTML = remesas.map(r =>
    `<option value="${r.numero_entrega}">${frascoOrdinal(r.numero_entrega)} — ${frascoFmt(r.asignacion[muni])} frascos</option>`).join("");
  sel.value = String(_muniRepartoState.numero);

  if (!sel.dataset.bound) {
    sel.dataset.bound = "1";
    sel.addEventListener("change", () => {
      _muniRepartoState.numero = parseInt(sel.value, 10);
      renderFrascosMunicipal(document.getElementById("adminInfluenzaMuni").value);
    });
  }

  const numero = _muniRepartoState.numero;
  const units = frascoUnidadesMunicipio(muni);
  const previas = frascosVista().filter(d => d.municipio.toUpperCase() === muni.toUpperCase() && d.numero_entrega === numero);

  // Cada vez que se abre una entrega se parte de lo ya guardado (todo fijo) o de cero.
  _muniRepartoState.fijos = {};
  _muniRepartoState.editados = new Set();
  _muniRepartoState.tocados = new Set();
  if (previas.length) {
    units.forEach(u => {
      _muniRepartoState.fijos[u.clues] = previas.filter(p => p.clues === u.clues).reduce((s, p) => s + Number(p.cantidad_frascos || 0), 0);
    });
    // Lo guardado que no coincide con el reparto por meta se marca como editado (y se conserva):
    // así una edición anterior no pasa por un error del cálculo.
    const porMetaGuardado = InfluenzaReparto.repartirFrascos(
      frascosRecibidosMunicipio(muni, numero), units.map(u => ({ id: u.clues, meta: frascoMetaUnidad(u.clues) })), {}).frascos;
    units.forEach(u => {
      if (_muniRepartoState.fijos[u.clues] !== (porMetaGuardado[u.clues] || 0)) _muniRepartoState.editados.add(u.clues);
    });
    frascoSoltarCargados(_muniRepartoState);
  }
  document.getElementById("frascoFechaInput").value = previas[0]?.fecha_entrega
    || remesas.find(r => r.numero_entrega === numero)?.fecha || new Date().toISOString().split("T")[0];
  const estadoLotes = frascoEstadoLotes(numero, units);
  const cajaLotes = document.getElementById("frascosLotesEstado");
  cajaLotes.className = `frs-lotesestado frs-lotesestado--${estadoLotes.tono}`;
  cajaLotes.innerHTML = estadoLotes.html;

  tbody.innerHTML = "";
  units.forEach(u => {
    const otras = frascosVista()
      .filter(d => d.clues === u.clues && d.numero_entrega !== numero)
      .reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
    const tr = document.createElement("tr");
    tr.className = "frs-row";
    tr.innerHTML = `
      <td><b>${u.unidad}</b><br><span class="frs-sub">${u.clues}</span></td>
      <td class="c" id="mr_meta_${u.clues}"></td>
      <td class="c frs-muted col-pct" id="mr_pct_${u.clues}"></td>
      <td class="c frs-muted">${frascoFmt(otras)}${frascoOtraMarcaHtml(u.clues)}</td>
      <td class="c col-inf" id="mr_mfr_${u.clues}"></td>
      <td class="c col-mod" id="mr_mmod_${u.clues}"></td>
      <td class="c col-pfz" id="mr_mpfz_${u.clues}"></td>
      <td class="c" id="mr_tope_${u.clues}"></td>
      <td class="c">
        <input type="text" inputmode="numeric" autocomplete="off" id="batch_frascos_${u.clues}" class="frs-num" aria-describedby="mr_tope_${u.clues}">
        <div class="frs-mark" id="mr_mark_${u.clues}"></div>
      </td>
      <td class="c frs-real" id="mr_real_${u.clues}"></td>
      <td class="c">${frascoLoteHtml(numero, u.clues)}</td>`;
    tbody.appendChild(tr);
    // Tocar una unidad SOLO cambia esa unidad: las demás se quedan como estaban y el total se ajusta a la suma real.
    tr.querySelector("input").addEventListener("input", (e) => {
      if (e.target.value.trim() === "") {
        delete _muniRepartoState.fijos[u.clues];
        _muniRepartoState.editados.delete(u.clues);
        _muniRepartoState.tocados.delete(u.clues);
      } else {
        _muniRepartoState.fijos[u.clues] = frascoEntero(e.target.value);
        _muniRepartoState.editados.add(u.clues);
        _muniRepartoState.tocados.add(u.clues);
      }
      refreshRepartoMunicipal(muni, e.target);
    });
  });

  const btnCuadrar = document.getElementById("btnMuniCuadrar");
  const btnReset = document.getElementById("btnMuniReset");
  if (btnCuadrar && !btnCuadrar.dataset.bound) {
    btnCuadrar.dataset.bound = "1";
    btnCuadrar.addEventListener("click", () => {
      const m = document.getElementById("adminInfluenzaMuni").value;
      const tot = frascosRecibidosMunicipio(m, _muniRepartoState.numero);
      const its = frascoItemsMunicipal(m);
      if (frascoCuadrar(tot, its, _muniRepartoState)) refreshRepartoMunicipal(m);
    });
    btnReset.addEventListener("click", () => {
      _muniRepartoState.fijos = {};
      _muniRepartoState.editados = new Set();
      _muniRepartoState.tocados = new Set();
      refreshRepartoMunicipal(document.getElementById("adminInfluenzaMuni").value);
    });
  }
  refreshRepartoMunicipal(muni);
}

function refreshRepartoMunicipal(muni, enfocado) {
  const numero = _muniRepartoState.numero;
  const total = frascosRecibidosMunicipio(muni, numero);
  const units = frascoUnidadesMunicipio(muni);
  const items = frascoItemsMunicipal(muni);
  const sumaMeta = items.reduce((s, i) => s + i.meta, 0);
  const res = InfluenzaReparto.repartoLibre(total, items, _muniRepartoState.fijos);
  const porMeta = res.base;
  items.forEach(it => {
    document.getElementById(`mr_meta_${it.id}`).innerHTML = `${frascoFmt(it.meta)}<span class="frs-meta-pct">${sumaMeta ? (it.meta * 100 / sumaMeta).toFixed(1) : "—"} % del municipio</span>`;
    document.getElementById(`mr_pct_${it.id}`).textContent = sumaMeta ? `${(it.meta * 100 / sumaMeta).toFixed(2)}%` : "—";
    const recUni = metasVista().find(m => m.clues === it.id);
    document.getElementById(`mr_tope_${it.id}`).innerHTML = frascoTopeCeldaHtml(it, recUni && recUni.metas);
    frascoPintarMetaFr("mr", it.id, recUni && recUni.metas, it);
    const inp = document.getElementById(`batch_frascos_${it.id}`);
    if (inp !== enfocado) inp.value = String(res.frascos[it.id] || 0);
    document.getElementById(`mr_mark_${it.id}`).textContent = frascoMarcaEditado(_muniRepartoState.editados.has(it.id), porMeta[it.id]);
    frascoPintarPctReal(document.getElementById(`mr_real_${it.id}`), res.frascos[it.id] || 0, total, sumaMeta ? it.meta * 100 / sumaMeta : null);
  });
  frascoResumenReparto(document.getElementById("frascosMuniResumen"), total, res, sumaMeta > 0);
  frascoMarcarInputs(items.map(i => i.id), "batch_frascos_", res, total, _muniRepartoState.tocados);
  frascoAplicarTope(items, res, total, document.getElementById("frascosMuniResumen"), "batch_frascos_", "mr_mark_", frascoEtiquetaUnidad);

  // Renglón TOTAL de la tabla: lo repartido contra lo asignado, con el color del estado.
  const sumaOtras = units.reduce((s, u) => s + frascosVista()
    .filter(d => d.clues === u.clues && d.numero_entrega !== numero).reduce((a, d) => a + Number(d.cantidad_frascos || 0), 0), 0);
  const estadoTot = res.porAsignar === 0 ? "ok" : res.porAsignar > 0 ? "falta" : "excede";
  const filaTot = document.getElementById("mr_total_row");
  if (filaTot) {
    filaTot.dataset.estado = estadoTot;
    document.getElementById("mr_meta_T").textContent = frascoFmt(sumaMeta);
    document.getElementById("mr_pct_T").textContent = sumaMeta ? "100%" : "—";
    document.getElementById("mr_otras_T").textContent = frascoFmt(sumaOtras);
    frascoPintarMetaFrTotales("mr", items.map(i => {
      const r = metasVista().find(m => m.clues === i.id);
      return { metas: r && r.metas, it: i };
    }));
    const sumaTopeM = items.reduce((a, i) => a + (i.tope === undefined ? 0 : i.tope), 0);
    document.getElementById("mr_tope_T").innerHTML = items.some(i => i.tope !== undefined) ? `<span class="frs-tope">${frascoFmt(sumaTopeM)}</span>` : "";
    frascoPintarPill(["frascosHubEstado", "frascosEstadoInline"], { total, asignado: res.asignado, porAsignar: res.porAsignar });
    document.getElementById("mr_inp_T").textContent = `${frascoFmt(res.asignado)} de ${frascoFmt(total)}`;
    frascoPintarPctReal(document.getElementById("mr_real_T"), res.asignado, total, 100);
  }

  // Cifras grandes: lo asignado al municipio, lo ya repartido a sus unidades y lo que falta.
  const kpis = document.getElementById("frascosMuniKpis");
  if (kpis) {
    kpis.style.display = "";
    document.getElementById("kpiTotal").textContent = frascoFmt(total);
    document.getElementById("kpiDosis").textContent = `${(FRASCO_DESTINOS.find(d => d.id === String(muni).toUpperCase()) || { label: muni }).label} · ${frascoOrdinal(numero)} · ${frascoFmt(total * dosisFrasco())} dosis`;
    document.getElementById("kpiAsignado").textContent = frascoFmt(res.asignado);
    document.getElementById("kpiAsignadoDe").textContent = `de ${frascoFmt(total)} asignados`;
    document.getElementById("kpiRepBox").dataset.estado = estadoTot;
    document.getElementById("kpiPor").textContent = frascoFmt(Math.abs(res.porAsignar));
    const caja = document.getElementById("kpiPorBox");
    caja.dataset.estado = estadoTot;
    caja.querySelector(".frs-kpi-lbl").textContent = res.porAsignar < 0 ? "Te pasaste por" : "Por repartir";
  }
}

async function saveFrascosDelivery() {
  const muni = document.getElementById("adminInfluenzaMuni").value;
  const numero = _muniRepartoState.numero;
  const fecha = document.getElementById("frascoFechaInput").value;
  if (!numero || !fecha) {
    showToast("Elige la entrega y la fecha.", false, "bad");
    return;
  }
  const total = frascosRecibidosMunicipio(muni, numero);
  const units = frascoUnidadesMunicipio(muni);
  const items = frascoItemsMunicipal(muni);
  const res = InfluenzaReparto.repartoLibre(total, items, _muniRepartoState.fijos);
  const excesos = InfluenzaReparto.excedenTope(items, res.frascos);
  if (excesos.length) {
    showToast(`No se puede guardar: rebasa la meta de frascos de la campaña. ${frascoTextoExceso(excesos, frascoEtiquetaUnidad, items)}.`, false, "bad");
    ["kpiRepBox", "kpiPorBox", "frascosMuniResumen"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove("frs-shake"); void el.offsetWidth; el.classList.add("frs-shake"); }
    });
    return;
  }
  if (res.porAsignar !== 0) {
    frascoBloquearGuardado(res.porAsignar, units.every(u => !frascoMetaUnidad(u.clues)), ["kpiRepBox", "kpiPorBox", "frascosMuniResumen"]);
    document.getElementById("frascosMuniKpis")?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const rows = units.map(u => ({ clues: u.clues, cantidad_frascos: res.frascos[u.clues] || 0 }));
  const campana = document.getElementById("metaCampaignSelect").value;

  await AppService.runCapture({
    btnId: "btnSaveFrascoEntrega",
    title: "Guardando reparto",
    msg: `Guardando el reparto de la ${frascoOrdinal(numero)} entre las unidades...`,
    successMsg: "Reparto guardado correctamente",
    eventTitle: esCovid() ? "COVID-19" : "Influenza",
    eventMsg: `Reparto municipal de la ${frascoOrdinal(numero)} de frascos${esCovid() ? ` (${vacunaEtiqueta()})` : ""}`,
    action: async () => {
      await AppService.call(esCovid() ? "guardarcovid_reparto" : "guardarinfluenza_reparto", {
        anio_campana: campana, ...(esCovid() ? { marca: _marcaCovid } : {}), municipio: muni, numero_entrega: numero, fecha, rows
      });
      await loadInfluenzaAdminData();
      renderFrascosDistribution();
      return { ok: true };
    }
  });
}

// ─── Concentrado estilo plantilla (entregas x destinos o unidades) ─────────

// ambito: "JURIS" (6 destinos) o un municipio (sus unidades).
function frascoMatrizDatos(ambito) {
  let columnas, valor, meta, numeros;
  if (ambito === "JURIS") {
    columnas = FRASCO_DESTINOS.map(d => ({ key: d.id, label: d.label }));
    valor = (n, k) => {
      const r = remesasVista().find(x => x.numero_entrega === n);
      return r ? Number((r.asignacion || {})[k] || 0) : 0;
    };
    meta = k => frascoMetaDestino(k);
    numeros = remesasVista().map(r => r.numero_entrega);
  } else {
    const units = frascoUnidadesMunicipio(ambito);
    columnas = units.map(u => ({ key: u.clues, label: u.unidad }));
    const filas = frascosVista().filter(d => d.municipio.toUpperCase() === ambito.toUpperCase());
    valor = (n, k) => filas.filter(d => d.clues === k && d.numero_entrega === n)
      .reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
    meta = k => frascoMetaUnidad(k);
    numeros = filas.map(d => d.numero_entrega);
  }
  const max = Math.max(4, ...numeros);
  return { columnas, valor, meta, numeros: Array.from({ length: max }, (_, i) => i + 1) };
}

function renderFrascosMatrix(ambito) {
  const table = document.getElementById("frascosMatrixTable");
  if (!table) return;
  const titulo = document.getElementById("frascosMatrixTitle");
  if (titulo) titulo.textContent = (ambito === "JURIS" ? "Entregas por municipio y hospital (frascos)" : "Entregas por unidad (frascos)")
    + (esCovid() ? ` · ${vacunaEtiqueta()}` : "");
  const { columnas, valor, meta, numeros } = frascoMatrizDatos(ambito);
  const cab = columnas.map(c => `<th class="c">${c.label}</th>`).join("");
  const fila = (etq, fn, bold) => `<tr class="${bold ? "frs-bold" : ""}"><th class="frs-rowlbl">${etq}</th>`
    + columnas.map(c => `<td class="c">${fn(c.key)}</td>`).join("")
    + `<td class="c frs-bold">${fn(null)}</td></tr>`;
  const suma = (fn) => columnas.reduce((s, c) => s + fn(c.key), 0);
  const cuerpo = numeros.map(n => fila(frascoOrdinal(n), k => {
    const v = k === null ? suma(kk => valor(n, kk)) : valor(n, k);
    return v ? frascoFmt(v) : "";
  })).join("");
  const entregado = k => numeros.reduce((s, n) => s + (k === null ? suma(kk => valor(n, kk)) : valor(n, k)), 0);
  table.innerHTML = `<thead><tr><th></th>${cab}<th class="c">TOTAL</th></tr></thead>
    <tbody>${cuerpo}
    ${fila(esCovid() ? "META + PÉRDIDA (dosis)" : "META (dosis)", k => frascoFmt(k === null ? suma(meta) : meta(k)), true)}
    ${fila("TOTAL ENTREGADO", k => { const v = entregado(k); return v ? frascoFmt(v) : "-"; }, true)}
    ${fila("DOSIS EQUIV. / META", k => {
      const m = k === null ? suma(meta) : meta(k);
      return m ? `${Math.round(entregado(k) * dosisFrasco() * 100 / m)}%` : "—";
    }, false)}</tbody>`;
}

async function exportFrascosExcel() {
  try {
    const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
    const ambitos = esJuris
      ? [["JURIS", "Jurisdicción"], ...FRASCO_DESTINOS.filter(d => !d.hospital).map(d => [d.id, d.label])]
      : (() => { const m = document.getElementById("adminInfluenzaMuni").value; return [[m, m]]; })();
    const wb = new ExcelJS.Workbook();
    const campana = document.getElementById("metaCampaignSelect").value;
    const fuente = { name: "Arial Nova", size: 12 };
    const borde = { style: "thin", color: { argb: "FF888888" } };
    const bordes = { top: borde, left: borde, bottom: borde, right: borde };

    ambitos.forEach(([ambito, nombre]) => {
      const { columnas, valor, meta, numeros } = frascoMatrizDatos(ambito);
      if (!columnas.length) return;
      const ws = wb.addWorksheet(nombre.substring(0, 31));
      const nCol = columnas.length + 2;
      const letra = (i) => ws.getColumn(i).letter;
      ws.getCell(1, 1).value = `Distribución de frascos de ${vacunaEtiqueta()} ${campana} — ${ambito === "JURIS" ? "Jurisdicción Sanitaria 1" : nombre}`;
      ws.getCell(1, 1).font = { ...fuente, bold: true, size: 14 };
      ws.getColumn(1).width = 26;

      const hRow = 3;
      columnas.forEach((c, i) => { ws.getCell(hRow, i + 2).value = c.label; });
      ws.getCell(hRow, nCol).value = "TOTAL";
      for (let c = 2; c <= nCol; c++) {
        const cell = ws.getCell(hRow, c);
        cell.font = { ...fuente, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF633E55" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = bordes;
        ws.getColumn(c).width = c === nCol ? 12 : 14;
      }
      ws.getRow(hRow).height = 48;

      const etiqueta = (r, txt) => {
        const cell = ws.getCell(r, 1);
        cell.value = txt;
        cell.font = { ...fuente, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3C3C3" } };
        cell.border = bordes;
      };
      const primera = hRow + 1;
      numeros.forEach((n, idx) => {
        const r = primera + idx;
        etiqueta(r, frascoOrdinal(n));
        columnas.forEach((c, i) => {
          const cell = ws.getCell(r, i + 2);
          const v = valor(n, c.key);
          cell.value = v || null;
          cell.font = fuente;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB88EA8" } };
          cell.border = bordes;
          cell.alignment = { horizontal: "center" };
        });
        const tot = ws.getCell(r, nCol);
        tot.value = { formula: `SUM(B${r}:${letra(nCol - 1)}${r})` };
        tot.font = { ...fuente, bold: true };
        tot.border = bordes;
        tot.alignment = { horizontal: "center" };
      });
      const ultima = primera + numeros.length - 1;
      const rMeta = ultima + 1;
      const rMetaF = ultima + 2;
      const rTot = ultima + 3;
      etiqueta(rMeta, esCovid() ? "META + PÉRDIDA (dosis 0.5 mL)" : "META (dosis)");
      etiqueta(rMetaF, "META (frascos)");
      etiqueta(rTot, "TOTAL ENTREGADO");
      columnas.forEach((c, i) => {
        const col = letra(i + 2);
        const m = ws.getCell(rMeta, i + 2);
        m.value = meta(c.key) || null;
        // Meta en frascos = dosis / 10 hacia arriba (el último frasco puede quedar abierto); es la que se compara.
        const mf = ws.getCell(rMetaF, i + 2);
        mf.value = { formula: `IF(${col}${rMeta}>0,ROUNDUP(${col}${rMeta}/${dosisFrasco()},0),"")` };
        const t = ws.getCell(rTot, i + 2);
        t.value = { formula: `IF(SUM(${col}${primera}:${col}${ultima})=0,"-",SUM(${col}${primera}:${col}${ultima}))` };
      });
      const cl = letra(nCol);
      const ultCol = letra(nCol - 1);
      ws.getCell(rMeta, nCol).value = { formula: `SUM(B${rMeta}:${ultCol}${rMeta})` };
      ws.getCell(rMetaF, nCol).value = { formula: `SUM(B${rMetaF}:${ultCol}${rMetaF})` };
      ws.getCell(rTot, nCol).value = { formula: `SUM(${cl}${primera}:${cl}${ultima})` };
      [rMeta, rMetaF, rTot].forEach(r => {
        for (let c = 2; c <= nCol; c++) {
          const cell = ws.getCell(r, c);
          cell.font = { ...fuente, bold: true };
          cell.border = bordes;
          cell.alignment = { horizontal: "center" };
        }
      });
      // Formato condicional del TOTAL ENTREGADO contra la META (frascos): verde = meta cubierta al 100 %,
      // rojo = rebasa la meta, ámbar = entrega en curso (aún no la cubre). Sin meta o sin entregas no se pinta.
      const verde = { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6EFCE" } };
      const rojo = { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } };
      const ambar = { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFEB9C" } };
      const ref = `B${rTot}:${cl}${rTot}`;
      const ini = `B${rTot}`, mini = `B${rMetaF}`;
      ws.addConditionalFormatting({ ref, rules: [
        { type: "expression", priority: 1, formulae: [`AND(ISNUMBER(${ini}),N(${mini})>0,${ini}=${mini})`], style: { fill: verde, font: { bold: true, color: { argb: "FF006100" } } } },
        { type: "expression", priority: 2, formulae: [`AND(ISNUMBER(${ini}),N(${mini})>0,${ini}>${mini})`], style: { fill: rojo, font: { bold: true, color: { argb: "FF9C0006" } } } },
        { type: "expression", priority: 3, formulae: [`AND(ISNUMBER(${ini}),N(${mini})>0,${ini}<${mini})`], style: { fill: ambar, font: { bold: true, color: { argb: "FF9C5700" } } } }
      ] });
      // Leyenda para quien abre el archivo
      const ley = ws.getCell(rTot + 2, 1);
      ley.value = "Verde: meta cubierta al 100 % · Ámbar: entrega en curso · Rojo: rebasa la meta (frascos)";
      ley.font = { ...fuente, size: 10, italic: true, color: { argb: "FF555555" } };
      ws.views = [{ state: "frozen", xSplit: 1, ySplit: hRow }];
    });

    if (!wb.worksheets.length) {
      showToast("No hay unidades para exportar.", false, "bad");
      return;
    }
    const buffer = await wb.xlsx.writeBuffer();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    link.download = esCovid() ? `Distribucion_Frascos_COVID_${_marcaCovid}_${campana}.xlsx` : `Distribucion_Frascos_Influenza_${campana}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel de distribución descargado.", true, "good");
  } catch (err) {
    console.error("Error al exportar la distribución de frascos:", err);
    showToast("Error al generar el Excel de distribución.", false, "bad");
  }
}

// ─── Dosis aplicadas por destino (el hospital cuenta aparte de QUERETARO) ──

// Destino (municipio u hospital) de una CLUES. Se deduce de la unidad, no del municipio guardado en la
// captura, para comparar siempre contra el mismo reparto (que también va por CLUES).
function frascoDestinoDeClues(clues, municipioCaptura) {
  const hosp = FRASCO_DESTINOS.find(d => d.hospital && d.clues === clues);
  if (hosp) return hosp.id;
  const u = _allUnidades.find(x => x.clues === clues);
  return String((u && u.municipio) || municipioCaptura || "").toUpperCase();
}

// Dosis de una captura semanal: la misma suma de todos los rubros que usa Meta-Logro como «logro».
function frascoDosisDeCaptura(c) {
  return Object.values((c && c.valores) || {}).reduce((s, v) => s + Number(v || 0), 0);
}

function frascoDosisAplicadas(destId) {
  let total = 0;
  _adminCapturasArray.forEach(c => {
    if (frascoDestinoDeClues(c.clues, c.municipio) === destId) total += frascoDosisDeCaptura(c);
  });
  return total;
}

// Compara lo REPARTIDO a una unidad con lo que captura cada semana en Meta-Logro (dosis aplicadas).
// filasFrascos: sus renglones de reparto; capturas: sus capturas semanales de la campaña.
function frascoBalance(filasFrascos, capturas) {
  const recibidos = (filasFrascos || []).reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
  const dosisRecibidas = recibidos * DOSIS_POR_FRASCO;
  let aplicadas = 0, ultima = "";
  (capturas || []).forEach(c => {
    aplicadas += frascoDosisDeCaptura(c);
    if (c.fecha && c.fecha > ultima) ultima = c.fecha;
  });
  const existencia = dosisRecibidas - aplicadas;
  let estado = "ok";
  if (aplicadas > dosisRecibidas) estado = "excede";
  else if (!recibidos && !aplicadas) estado = "vacio";
  else if (recibidos && existencia === 0) estado = "agotado";
  return { recibidos, dosisRecibidas, aplicadas, existencia, ultima, estado,
    aprov: dosisRecibidas > 0 ? aplicadas * 100 / dosisRecibidas : null };
}

function frascoEstadoBalanceHtml(b) {
  if (b.estado === "excede") {
    const txt = b.recibidos ? `Aplicó ${frascoFmt(b.aplicadas - b.dosisRecibidas)} dosis de más` : "Aplicó sin reparto";
    return `<span class="frs-estado frs-estado--excede" title="Capturó más dosis aplicadas de las que le repartieron">${txt}</span>`;
  }
  if (b.estado === "vacio") return '<span class="frs-estado frs-estado--vacio">Sin reparto ni captura</span>';
  if (b.estado === "agotado") return '<span class="frs-estado frs-estado--agotado">Sin existencia</span>';
  return '<span class="frs-estado frs-estado--ok">En orden</span>';
}

function frascoFechaCorta(f) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(f || ""));
  return m ? `${m[2]}/${m[1]}` : "—";
}

// Tabla «Reparto vs. captura semanal», por unidad. Municipal: las unidades de su municipio (todas);
// Jurisdicción: toda unidad que ya tenga reparto o captura.
function renderFrascosBalance() {
  const tbody = document.getElementById("frascosBalanceTbody");
  if (!tbody) return;
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
  const muni = document.getElementById("adminInfluenzaMuni")?.value;
  const unidades = esJuris ? _allUnidades.slice() : frascoUnidadesMunicipio(muni || "");
  const orden = FRASCO_DESTINOS.map(d => d.id);
  let filas = unidades.map(u => {
    const destino = frascoDestinoDeClues(u.clues);
    const b = frascoBalance(_adminFrascosArray.filter(d => d.clues === u.clues), _adminCapturasArray.filter(c => c.clues === u.clues));
    return { u, destino, b };
  });
  if (esJuris) filas = filas.filter(f => f.b.recibidos || f.b.aplicadas);
  filas.sort((a, b) => (orden.indexOf(a.destino) - orden.indexOf(b.destino)) || String(a.u.unidad).localeCompare(String(b.u.unidad), "es"));

  const col = document.getElementById("frascosBalanceDestinoTh");
  if (col) col.style.display = esJuris ? "" : "none";
  tbody.innerHTML = filas.length ? filas.map(({ u, destino, b }) => {
    const dest = FRASCO_DESTINOS.find(d => d.id === destino);
    return `<tr class="frs-row" data-estado="${b.estado}">
      <td><b>${u.unidad}</b><br><span class="frs-sub">${u.clues}</span></td>
      <td class="c" style="${esJuris ? "" : "display:none"}">${dest ? dest.label : destino}</td>
      <td class="c">${frascoFmt(b.recibidos)}</td>
      <td class="c frs-muted">${frascoFmt(b.dosisRecibidas)}</td>
      <td class="c"><b>${frascoFmt(b.aplicadas)}</b></td>
      <td class="c ${b.existencia < 0 ? "frs-neg" : ""}">${frascoFmt(b.existencia)}</td>
      <td class="c frs-muted">${b.aprov == null ? "—" : b.aprov.toFixed(1) + "%"}</td>
      <td class="c frs-muted">${frascoFechaCorta(b.ultima)}</td>
      <td class="c">${frascoEstadoBalanceHtml(b)}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="frs-muted" style="padding:18px;text-align:center">Todavía no hay frascos repartidos ni capturas semanales.</td></tr>`;

  const t = filas.reduce((a, { b }) => ({
    r: a.r + b.recibidos, dr: a.dr + b.dosisRecibidas, ap: a.ap + b.aplicadas }), { r: 0, dr: 0, ap: 0 });
  const tb = frascoBalance([{ cantidad_frascos: t.r }], [{ valores: { t: t.ap } }]);
  const pie = document.getElementById("frascosBalanceTfoot");
  if (pie) pie.innerHTML = `<tr class="frs-total" data-estado="${tb.estado === "excede" ? "excede" : "ok"}">
    <td>TOTAL</td><td class="c" style="${esJuris ? "" : "display:none"}"></td>
    <td class="c">${frascoFmt(t.r)}</td><td class="c">${frascoFmt(t.dr)}</td><td class="c">${frascoFmt(t.ap)}</td>
    <td class="c">${frascoFmt(t.dr - t.ap)}</td><td class="c">${tb.aprov == null ? "—" : tb.aprov.toFixed(1) + "%"}</td><td></td><td></td></tr>`;
}

// Vista de la UNIDAD: lo que le repartieron contra lo que ella misma ha capturado cada semana en Meta-Logro.
// De aquí sale también la existencia que usa el pronóstico de abasto (antes se usaba un valor fijo de 45).
function renderInfluenzaBalanceUnidad() {
  const b = frascoBalance(_influenzaDistribucionCache, _influenzaCapturasCache);
  const box = document.getElementById("influenzaBalanceUnidad");
  if (box) {
    if (!b.recibidos && !b.aplicadas) {
      box.innerHTML = '<div class="frs-balance-nota">Aún no te han repartido frascos de esta campaña. Cuando tu municipio registre la entrega, aquí verás cuánto te tocó y cuánto llevas aplicado.</div>';
    } else {
      const alerta = b.estado === "excede"
        ? `<div class="frs-balance-alerta">⚠️ Llevas <b>${frascoFmt(b.aplicadas)} dosis aplicadas</b> y solo te repartieron <b>${frascoFmt(b.dosisRecibidas)}</b>${b.recibidos ? "" : " (sin reparto registrado)"}. Avisa a tu municipio para revisar el reparto o la captura.</div>`
        : "";
      box.innerHTML = `<div class="frs-balance">
        <div><span>Frascos que te repartieron</span><b>${frascoFmt(b.recibidos)}</b><small>${frascoFmt(b.dosisRecibidas)} dosis</small></div>
        <div><span>Dosis aplicadas (tus capturas)</span><b>${frascoFmt(b.aplicadas)}</b><small>${b.aprov == null ? "" : b.aprov.toFixed(1) + "% de lo repartido"}</small></div>
        <div data-estado="${b.estado}"><span>Existencia estimada</span><b>${frascoFmt(Math.max(0, b.existencia))}</b><small>dosis${b.ultima ? " · última captura " + frascoFechaCorta(b.ultima) : ""}</small></div>
      </div>${alerta}`;
    }
  }
  return b;
}

// ─── Resumen de meta de la UNIDAD (pestaña «Resumen de meta» del panel de Influenza) ───────────────────────
// Todo se calcula con lo que ya se cargó (metas, capturas semanales, reparto de frascos): sin consultas nuevas.
function influenzaResumenCalcular() {
  const metas = _influenzaMetasCache || {};
  const hoy = (typeof todayYmdLocal === "function") ? todayYmdLocal() : new Date().toISOString().slice(0, 10);
  const logroPorRubro = {};
  INFLUENZA_RUBROS.forEach(r => { logroPorRubro[r.id] = 0; });
  const porSemana = {};
  _influenzaCapturasCache.forEach(c => {
    let dosis = 0;
    INFLUENZA_RUBROS.forEach(r => {
      const v = Number((c.valores || {})[r.id] || 0);
      logroPorRubro[r.id] += v;
      dosis += v;
    });
    porSemana[c.fecha] = (porSemana[c.fecha] || 0) + dosis;
  });
  const metaDe = (r) => Number(metas[r.id] || 0);
  const metaTotal = INFLUENZA_RUBROS.reduce((s, r) => s + metaDe(r), 0);
  const logro = INFLUENZA_RUBROS.reduce((s, r) => s + logroPorRubro[r.id], 0);
  const pendiente = Math.max(0, metaTotal - logro);
  const conMeta = INFLUENZA_RUBROS.filter(r => metaDe(r) > 0);
  const cumplidos = conMeta.filter(r => logroPorRubro[r.id] >= metaDe(r)).length;

  const semanas = generateCampaignWeeks();
  const reportadas = new Set(_influenzaCapturasCache.map(c => c.fecha));
  const reportadasN = semanas.filter(w => reportadas.has(w.fecha)).length;
  const atrasadas = semanas.filter(w => w.fecha < hoy && !reportadas.has(w.fecha)).length;
  const restantes = semanas.filter(w => w.fecha >= hoy && !reportadas.has(w.fecha)).length;

  const t0 = Date.parse((_campaignConfig.fecha_inicio || "") + "T12:00:00");
  const t1 = Date.parse((_campaignConfig.fecha_fin || "") + "T12:00:00");
  const t = Date.parse(hoy + "T12:00:00");
  const esperadoPct = (t1 > t0) ? Math.max(0, Math.min(100, (t - t0) * 100 / (t1 - t0))) : 0;
  const avancePct = metaTotal > 0 ? logro * 100 / metaTotal : 0;

  let mejor = null;
  Object.keys(porSemana).forEach(f => { if (!mejor || porSemana[f] > mejor.dosis) mejor = { fecha: f, dosis: porSemana[f] }; });
  const ultima = _influenzaCapturasCache.reduce((u, c) => (c.fecha > u ? c.fecha : u), "");

  return {
    metas, logroPorRubro, metaTotal, logro, pendiente, conMeta: conMeta.length, cumplidos,
    totalSemanas: semanas.length, reportadasN, atrasadas, restantes,
    esperadoPct, avancePct, mejor, ultima, hoy,
    ritmoProm: reportadasN ? Math.round(logro / reportadasN) : 0,
    ritmoNecesario: (pendiente > 0 && restantes > 0) ? Math.ceil(pendiente / restantes) : null
  };
}

function renderInfluenzaResumenUnidad() {
  const kpis = document.getElementById("influenzaResumenKpis");
  const grupos = document.getElementById("influenzaResumenGrupos");
  if (!kpis || !grupos) return;
  aplicarSelectorResumen();
  if (_resumenVacuna === "COVID" && _covidMetaUnidadCache && window.CovidCaptura) { renderCovidResumenUnidad(); return; }
  const sub = document.getElementById("influenzaResumenSub");
  const c = influenzaResumenCalcular();
  const pct = (n) => (Math.round(n * 10) / 10).toFixed(1) + "%";

  if (sub) sub.textContent = `Campaña ${campaignSeasonLabel()} · corte al ${influenzaFechaCorta(c.hoy)} · ${USER?.unidad || ""}`;

  if (!c.metaTotal) {
    kpis.innerHTML = '<div class="frs-balance-nota">Tu unidad aún no tiene meta asignada para esta campaña. Cuando tu municipio la registre, aquí verás tu avance, tu ritmo y el detalle por grupo.</div>';
    grupos.innerHTML = "";
    return;
  }

  const diff = c.avancePct - c.esperadoPct;
  const tono = diff >= -5 ? "good" : (diff >= -15 ? "warn" : "bad");
  const kpi = (label, valor, nota, data) => `<div class="ip-kpi"${data ? ` data-tone="${data}"` : ""}><span class="ip-kpi-l">${label}</span><b>${valor}</b><small>${nota || "&nbsp;"}</small></div>`;
  const semNota = c.atrasadas ? `${c.atrasadas} ${c.atrasadas === 1 ? "semana sin reporte" : "semanas sin reporte"}` : "Al corriente";
  const ritmoNota = c.ritmoNecesario != null
    ? `Para cumplir necesitas ${frascoFmt(c.ritmoNecesario)} dosis/sem`
    : (c.pendiente > 0 ? "La campaña ya no tiene semanas por reportar" : "Meta cumplida");

  kpis.innerHTML = `
    <div class="ip-kpis">
      ${kpi("Meta de la campaña", frascoFmt(c.metaTotal), `${c.conMeta} grupos con meta · ≈ ${frascoFmt(Math.ceil(c.metaTotal / DOSIS_POR_FRASCO))} frascos`)}
      ${kpi("Dosis aplicadas", frascoFmt(c.logro), c.ultima ? "Última captura: semana del " + influenzaRangoTexto(c.ultima) : "Aún sin capturas")}
      ${kpi("Avance de tu meta", pct(c.avancePct), `Esperado a hoy: ${pct(c.esperadoPct)}`, tono)}
      ${kpi("Meta pendiente", frascoFmt(c.pendiente), `≈ ${frascoFmt(Math.ceil(c.pendiente / DOSIS_POR_FRASCO))} frascos por aplicar`)}
      ${kpi("Semanas reportadas", `${c.reportadasN} de ${c.totalSemanas}`, semNota, c.atrasadas ? "warn" : "good")}
      ${kpi("Ritmo promedio", `${frascoFmt(c.ritmoProm)} <small class="ip-unit-inline">dosis/sem</small>`, ritmoNota)}
      ${kpi("Mejor semana", c.mejor ? frascoFmt(c.mejor.dosis) : "—", c.mejor ? "Semana del " + influenzaRangoTexto(c.mejor.fecha) : "Aún sin capturas")}
      ${kpi("Grupos con meta cumplida", `${c.cumplidos} de ${c.conMeta}`, c.cumplidos === c.conMeta && c.conMeta ? "Todos cumplidos" : "Grupos que ya alcanzaron su meta")}
    </div>
    <div class="ip-progress-wrap">
      <div class="ip-progress-top"><span>Avance real <b>${pct(c.avancePct)}</b></span><span>Esperado a hoy <b>${pct(c.esperadoPct)}</b></span></div>
      <div class="ip-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, c.avancePct))}" aria-label="Avance de tu meta">
        <div class="ip-progress-fill" data-tone="${tono}" style="width:${Math.min(100, c.avancePct).toFixed(1)}%"></div>
        <div class="ip-progress-mark" style="left:${Math.min(100, c.esperadoPct).toFixed(1)}%" title="Avance esperado a hoy"></div>
      </div>
    </div>`;

  // Avance por grupo (se suman las edades de cada grupo, en el orden de la plantilla oficial)
  const orden = [];
  const porGrupo = {};
  INFLUENZA_RUBROS.forEach(r => {
    if (!porGrupo[r.grupo]) { porGrupo[r.grupo] = { grupo: r.grupo, categoria: r.categoria, meta: 0, logro: 0 }; orden.push(r.grupo); }
    porGrupo[r.grupo].meta += Number(c.metas[r.id] || 0);
    porGrupo[r.grupo].logro += c.logroPorRubro[r.id];
  });
  const filas = orden.map(g => porGrupo[g]).filter(g => g.meta > 0 || g.logro > 0);
  const filaHtml = (g) => {
    const p = g.meta > 0 ? g.logro * 100 / g.meta : null;
    const tonoG = p == null ? "" : (p >= 100 ? "good" : (p >= c.esperadoPct - 5 ? "good" : (p >= c.esperadoPct - 15 ? "warn" : "bad")));
    return `<tr>
      <th scope="row"><span class="ip-g-n">${escapeHtml(g.grupo)}</span><span class="ip-g-c">${escapeHtml(g.categoria)}</span></th>
      <td class="c">${frascoFmt(g.meta)}</td>
      <td class="c"><b>${frascoFmt(g.logro)}</b></td>
      <td class="ip-g-bar"><div class="ip-bar-mini" aria-hidden="true"><i data-tone="${tonoG}" style="width:${p == null ? 0 : Math.min(100, p).toFixed(1)}%"></i></div><span>${p == null ? "Sin meta" : pct(p)}</span></td>
    </tr>`;
  };
  grupos.innerHTML = `<table class="ip-table">
    <caption class="sr-only">Meta y dosis aplicadas por grupo de población</caption>
    <thead><tr><th scope="col">Grupo</th><th scope="col" class="c">Meta</th><th scope="col" class="c">Aplicadas</th><th scope="col">Avance</th></tr></thead>
    <tbody>${filas.map(filaHtml).join("")}</tbody>
    <tfoot><tr><th scope="row">Total</th><td class="c">${frascoFmt(c.metaTotal)}</td><td class="c"><b>${frascoFmt(c.logro)}</b></td><td class="ip-g-bar"><span>${pct(c.avancePct)}</span></td></tr></tfoot>
  </table>`;
}

// Meta de COVID-19 de la unidad (la lee de covid_metas; el hospital usa la de su destino). Si no tiene, el botón no sale.
let _covidMetaUnidadCache = null;
async function covidCargarMetaUnidad(campana) {
  const btn = document.getElementById("btnExportMetaCovidUnidad");
  _covidMetaUnidadCache = null;
  if (btn) btn.style.display = "none";
  try {
    const res = await AppService.call("getcovid_metas", { anio_campana: campana }, { silent: true });
    const filas = (res && res.data) || [];
    const X = window.CovidMetasExport;
    const destino = X ? Object.keys(X.CLUES_HOSPITALES).find(k => X.CLUES_HOSPITALES[k] === USER.clues) : null;
    const propia = filas.find(r => r.clues === USER.clues);
    const delDestino = destino ? filas.find(r => !r.clues && String(r.municipio).toUpperCase() === destino) : null;
    const metas = (delDestino && delDestino.metas) || (propia && propia.metas) || null;
    if (metas && CovidFrascos.RUBROS.some(r => Number(metas[r.id] || 0) > 0)) {
      _covidMetaUnidadCache = { metas, registros: filas };
      if (btn) btn.style.display = "";
      try {
        const d = await AppService.call("getcovid_distribucion", { anio_campana: campana, clues: USER.clues }, { silent: true });
        _covidDistUnidad = (d && d.data) || [];
      } catch (e) { _covidDistUnidad = []; }
    }
  } catch (e) { /* sin meta de COVID-19 visible: el botón queda oculto */ }
  renderCovidCaptura();
  actualizarMenuExportMeta();
  renderInfluenzaResumenUnidad();
}

// ─── Exportar meta (menú único): Influenza, COVID-19 o ambas ─────────────────────────────────────────────
let _covidDistUnidad = [];

function actualizarMenuExportMeta() {
  const wrap = document.getElementById("ipExpMeta");
  if (!wrap) return;
  const conInf = INFLUENZA_RUBROS.some(r => Number((_influenzaMetasCache || {})[r.id] || 0) > 0);
  const conCov = !!_covidMetaUnidadCache;
  const vis = { INFLUENZA: true, COVID: conCov, AMBAS: conInf && conCov };   // Influenza siempre: sin meta, el aviso lo explica
  wrap.querySelectorAll("[data-exp]").forEach(b => { b.hidden = !vis[b.dataset.exp]; });
  if (!wrap.dataset.listo) {
    wrap.dataset.listo = "1";
    const btn = wrap.querySelector("#btnExportMeta");
    const menu = wrap.querySelector("#ipExpMetaMenu");
    const cerrar = (foco) => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (foco) btn.focus(); };
    btn.addEventListener("click", () => {
      const abrir = menu.hidden;
      menu.hidden = !abrir;
      btn.setAttribute("aria-expanded", String(abrir));
      if (abrir) { const p = menu.querySelector("[data-exp]:not([hidden])"); if (p) p.focus(); }
    });
    menu.addEventListener("click", async (e) => {
      const o = e.target.closest("[data-exp]");
      if (!o) return;
      cerrar(true);
      await exportarMetaUnidad(o.dataset.exp);
    });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { e.stopPropagation(); cerrar(true); } });
    document.addEventListener("click", (e) => { if (!menu.hidden && !wrap.contains(e.target)) cerrar(false); });
  }
}

async function exportarMetaUnidad(que) {
  if (que === "INFLUENZA" || que === "AMBAS") await exportInfluenzaMetaUnidadExcel();
  if (que === "COVID" || que === "AMBAS") await exportCovidMetaUnidadExcel();
}

// ─── Resumen de meta de COVID-19 (misma pestaña, selector Influenza | COVID-19) ──────────────────────────
let _resumenVacuna = "INFLUENZA";

function covidResumenCalcular() {
  const metas = _covidMetaUnidadCache.metas;
  const C = window.CovidCaptura;
  const hoy = (typeof todayYmdLocal === "function") ? todayYmdLocal() : new Date().toISOString().slice(0, 10);
  const aplicadas = {};
  const porMarca = { MODERNA: 0, PFIZER: 0 };
  C.RUBROS.forEach(r => { aplicadas[r] = 0; });
  let ultima = "";
  _covidCapturasCache.forEach(c => {
    const t = C.porRubro(c.valores);
    C.RUBROS.forEach(r => { aplicadas[r] += t[r]; });
    C.MARCAS.forEach(m => {
      porMarca[m] += C.RUBROS.reduce((s, r) => s + (Number(c.valores?.[m]?.[r]) || 0) * ((r === "c1" || r === "c2") ? 0.5 : 1), 0);
    });
    if (c.fecha > ultima) ultima = c.fecha;
  });
  const av = CovidFrascos.avanceRubros(metas, aplicadas);
  const semanas = generateCampaignWeeks();
  const reportadas = new Set(_covidCapturasCache.map(c => c.fecha));
  const reportadasN = semanas.filter(w => reportadas.has(w.fecha)).length;
  const atrasadas = semanas.filter(w => w.fecha < hoy && !reportadas.has(w.fecha)).length;
  const t0 = Date.parse((_campaignConfig.fecha_inicio || "") + "T12:00:00");
  const t1 = Date.parse((_campaignConfig.fecha_fin || "") + "T12:00:00");
  const t = Date.parse(hoy + "T12:00:00");
  const esperadoPct = (t1 > t0) ? Math.max(0, Math.min(100, (t - t0) * 100 / (t1 - t0))) : 0;
  const conMeta = av.rubros.filter(r => r.meta > 0);
  return {
    av, aplicadas, porMarca, ultima, hoy, esperadoPct, reportadasN, atrasadas, totalSemanas: semanas.length,
    conMeta: conMeta.length, cumplidos: conMeta.filter(r => r.aplicadas >= r.meta).length
  };
}

function renderCovidResumenUnidad() {
  const kpis = document.getElementById("influenzaResumenKpis");
  const grupos = document.getElementById("influenzaResumenGrupos");
  const sub = document.getElementById("influenzaResumenSub");
  const c = covidResumenCalcular();
  const pct = (n) => (Math.round(n * 10) / 10).toFixed(1) + "%";
  const f = (n) => Math.round(n).toLocaleString("es-MX");
  if (sub) sub.textContent = `COVID-19 · Campaña ${campaignSeasonLabel()} · corte al ${influenzaFechaCorta(c.hoy)} · ${USER?.unidad || ""}`;
  const avancePct = c.av.pct == null ? 0 : c.av.pct;
  const diff = avancePct - c.esperadoPct;
  const tono = diff >= -5 ? "good" : (diff >= -15 ? "warn" : "bad");
  const kpi = (label, valor, nota, data) => `<div class="ip-kpi"${data ? ` data-tone="${data}"` : ""}><span class="ip-kpi-l">${label}</span><b>${valor}</b><small>${nota || "&nbsp;"}</small></div>`;
  kpis.innerHTML = `
    <div class="ip-kpis">
      ${kpi("Meta de la campaña", f(c.av.metaEq), `${c.conMeta} grupos con meta · dosis equivalentes de 0.5 mL`)}
      ${kpi("Dosis aplicadas", f(c.av.aplEq), c.ultima ? "Última captura: semana del " + influenzaRangoTexto(c.ultima) : "Aún sin capturas")}
      ${kpi("Avance de tu meta", pct(avancePct), `Esperado a hoy: ${pct(c.esperadoPct)}`, tono)}
      ${kpi("Meta pendiente", f(c.av.pendienteEq), "dosis equivalentes por aplicar")}
      ${kpi("Semanas reportadas", `${c.reportadasN} de ${c.totalSemanas}`, c.atrasadas ? `${c.atrasadas} ${c.atrasadas === 1 ? "semana sin reporte" : "semanas sin reporte"}` : "Al corriente", c.atrasadas ? "warn" : "good")}
      ${kpi("Moderna", f(c.porMarca.MODERNA), "dosis equivalentes de 0.5 mL")}
      ${kpi("Pfizer", f(c.porMarca.PFIZER), "dosis de 0.5 mL")}
      ${kpi("Grupos con meta cumplida", `${c.cumplidos} de ${c.conMeta}`, c.cumplidos === c.conMeta && c.conMeta ? "Todos cumplidos" : "Grupos que ya alcanzaron su meta")}
    </div>
    <div class="ip-progress-wrap">
      <div class="ip-progress-top"><span>Avance real <b>${pct(avancePct)}</b></span><span>Esperado a hoy <b>${pct(c.esperadoPct)}</b></span></div>
      <div class="ip-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, avancePct))}" aria-label="Avance de tu meta de COVID-19">
        <div class="ip-progress-fill" data-tone="${tono}" style="width:${Math.min(100, avancePct).toFixed(1)}%"></div>
        <div class="ip-progress-mark" style="left:${Math.min(100, c.esperadoPct).toFixed(1)}%" title="Avance esperado a hoy"></div>
      </div>
    </div>`;

  // Abasto por marca: frascos repartidos (covid_distribucion_frascos) contra lo aplicado, en dosis equivalentes de 0.5 mL
  const balance = document.getElementById("influenzaBalanceUnidad");
  const pred = document.getElementById("influenzaStockPredictorContainer");
  if (pred) pred.innerHTML = "";
  if (balance) {
    const marcas = ["MODERNA", "PFIZER"].map(m => {
      const frascos = _covidDistUnidad.filter(d => d.marca === m).reduce((s, d) => s + Number(d.cantidad_frascos || 0), 0);
      const dosis = frascos * CovidFrascos.dosisPorFrasco(m);
      return { m, frascos, dosis, aplicadas: c.porMarca[m], existencia: Math.max(0, dosis - c.porMarca[m]) };
    });
    const tot = marcas.reduce((a, x) => ({ frascos: a.frascos + x.frascos, dosis: a.dosis + x.dosis, aplicadas: a.aplicadas + x.aplicadas, existencia: a.existencia + x.existencia }), { frascos: 0, dosis: 0, aplicadas: 0, existencia: 0 });
    if (!tot.frascos && !tot.aplicadas) {
      balance.innerHTML = '<div class="frs-balance-nota">Aún no te han repartido frascos de COVID-19. Cuando tu municipio registre la entrega, aquí verás cuánto te tocó por marca y cuánto llevas aplicado.</div>';
    } else {
      const det = marcas.map(x => `${x.m === "PFIZER" ? "Pfizer" : "Moderna"}: ${f(x.frascos)} frascos`).join(" · ");
      const exceso = tot.aplicadas > tot.dosis;
      balance.innerHTML = `<div class="frs-balance">
        <div><span>Frascos que te repartieron</span><b>${f(tot.frascos)}</b><small>${det}</small></div>
        <div><span>Dosis aplicadas (tus capturas)</span><b>${f(tot.aplicadas)}</b><small>${tot.dosis ? pct(tot.aplicadas * 100 / tot.dosis) + " de lo repartido" : ""}</small></div>
        <div data-estado="${exceso ? "excede" : "ok"}"><span>Existencia estimada</span><b>${f(tot.existencia)}</b><small>dosis equivalentes de 0.5 mL</small></div>
      </div>${exceso ? `<div class="frs-balance-alerta">⚠️ Llevas más dosis aplicadas de COVID-19 que las repartidas. Avisa a tu municipio para revisar el reparto o la captura.</div>` : ""}`;
    }
  }

  const filas = c.av.rubros.filter(r => r.meta > 0 || r.aplicadas > 0).map(r => {
    const def = CovidFrascos.RUBROS.find(x => x.id === r.id);
    const p = r.pct;
    const tonoG = p == null ? "" : (p >= 100 ? "good" : (p >= c.esperadoPct - 5 ? "good" : (p >= c.esperadoPct - 15 ? "warn" : "bad")));
    return `<tr>
      <th scope="row"><span class="ip-g-n">${escapeHtml(def.grupo)}</span><span class="ip-g-c">${escapeHtml(def.edad)}</span></th>
      <td class="c">${f(r.meta)}</td>
      <td class="c"><b>${f(r.aplicadas)}</b></td>
      <td class="ip-g-bar"><div class="ip-bar-mini" aria-hidden="true"><i data-tone="${tonoG}" style="width:${p == null ? 0 : Math.min(100, p).toFixed(1)}%"></i></div><span>${p == null ? "Sin meta" : pct(p)}</span></td>
    </tr>`;
  });
  grupos.innerHTML = `<table class="ip-table">
    <caption class="sr-only">Meta y dosis aplicadas de COVID-19 por grupo de población</caption>
    <thead><tr><th scope="col">Grupo</th><th scope="col" class="c">Meta</th><th scope="col" class="c">Aplicadas</th><th scope="col">Avance</th></tr></thead>
    <tbody>${filas.join("")}</tbody>
    <tfoot><tr><th scope="row">Total (dosis equivalentes de 0.5 mL)</th><td class="c">${f(c.av.metaEq)}</td><td class="c"><b>${f(c.av.aplEq)}</b></td><td class="ip-g-bar"><span>${pct(avancePct)}</span></td></tr></tfoot>
  </table>`;
}

function aplicarSelectorResumen() {
  const sel = document.getElementById("resumenVacunaSel");
  if (!sel) return;
  const tiene = !!_covidMetaUnidadCache;
  if (!tiene) _resumenVacuna = "INFLUENZA";
  sel.hidden = !tiene;
  sel.querySelectorAll("[data-vac]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vac === _resumenVacuna)));
  if (!sel.dataset.listo) {
    sel.dataset.listo = "1";
    sel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-vac]");
      if (!b) return;
      _resumenVacuna = b.dataset.vac === "COVID" ? "COVID" : "INFLUENZA";
      renderInfluenzaResumenUnidad();
      if (_resumenVacuna === "INFLUENZA") renderInfluenzaBalanceUnidad();
    });
  }
}

// ─── COVID-19: reporte semanal por marca (covid_captura.js / covid_captura_ui.js) ────────────────────────
let _covidCapturasCache = [];

let _capturaVacuna = "INFLUENZA";   // "INFLUENZA" | "COVID": cuál de las dos se muestra y guarda el botón azul
let _covidPanelListo = false;      // el panel de COVID-19 se pintó (la unidad tiene meta)

function aplicarVacunaCaptura() {
  const tiene = _covidPanelListo;
  if (!tiene) _capturaVacuna = "INFLUENZA";
  const sel = document.getElementById("capVacunaSel");
  if (sel) {
    sel.hidden = !tiene;
    sel.querySelectorAll("[data-vac]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vac === _capturaVacuna)));
  }
  const inf = document.getElementById("influenzaCaptureGroupsContainer");
  const cov = document.getElementById("covidCapturaContainer");
  if (inf) inf.hidden = _capturaVacuna === "COVID";
  if (cov) cov.hidden = _capturaVacuna !== "COVID" || !tiene;
  actualizarContadorDosisHub();
}

function elegirVacunaCaptura(vac) {
  _capturaVacuna = vac === "COVID" ? "COVID" : "INFLUENZA";
  aplicarVacunaCaptura();
}

function renderCovidCaptura() {
  const cont = document.getElementById("covidCapturaContainer");
  if (!cont || !window.CovidCapturaUI) return;
  const sel = document.getElementById("capVacunaSel");
  if (sel && !sel.dataset.listo) {
    sel.dataset.listo = "1";
    sel.addEventListener("click", (e) => { const b = e.target.closest("[data-vac]"); if (b) elegirVacunaCaptura(b.dataset.vac); });
  }
  const fecha = document.getElementById("influenza_semana")?.value;
  if (!fecha) { _covidPanelListo = false; aplicarVacunaCaptura(); return; }
  const estado = influenzaEstadoCaptura(fecha);
  _covidPanelListo = window.CovidCapturaUI.render({
    container: cont,
    metas: _covidMetaUnidadCache ? _covidMetaUnidadCache.metas : null,
    capturas: _covidCapturasCache,
    fecha,
    cerrada: !estado.abierta,
    motivo: estado.motivo,
    USER,
    alCambiar: actualizarContadorDosisHub,
    censia: {
      url: CENSIA_URL,
      guia: censiaGuiaExtension,
      hoy: influenzaHoy,
      fechaAplicacion: (f) => censiaFechaAplicacion(f, influenzaHoy()),
      enviarPaquete: (paquete) => {
        const token = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, t: Date.now(), clues: paquete.clues, fecha: paquete.fecha, valores: paquete.valores }))));
        if (censiaExtInstalada()) window.postMessage({ source: "sirevaq", type: "censia-payload", payload: paquete }, location.origin);
        try { navigator.clipboard?.writeText("SIREVAQ1:" + token).catch(() => { }); } catch (e) { /* sin portapapeles */ }
        return `${CENSIA_URL}#sirevaq=${encodeURIComponent(token)}`;
      }
    }
  });
  aplicarVacunaCaptura();
}

/** Botón azul de guardar con COVID-19 elegido: valida contra la meta y guarda el reporte de la semana. */
async function guardarCovidDesdePanel() {
  const fecha = document.getElementById("influenza_semana").value;
  const nombre = (document.getElementById("nombreINFLUENZA")?.value || "").trim();
  if (!nombre) { showToast("Por favor ingresa el nombre de quien reporta la captura.", false, "bad"); return; }
  const r = window.CovidCapturaUI.recoger();
  if (!r) { showToast("Tu unidad no tiene meta de COVID-19 asignada.", false, "bad"); return; }
  if (r.error) { showToast(r.error, false, "bad"); return; }
  await guardarCapturaCovid(fecha, { valores: r.valores, nombre, sin_movimiento: r.sin_movimiento });
}

async function guardarCapturaCovid(fecha, p) {
  const cierre = influenzaEstadoCaptura(fecha);
  if (!cierre.abierta) { showToast(cierre.motivo, false, "bad"); return; }
  const campana = document.getElementById("influenza_campana").value;
  const total = window.CovidCaptura.totalDosis(p.valores);
  await AppService.runCapture({
    btnId: "btnSaveINFLUENZA",
    title: "Guardando reporte",
    msg: "Registrando reporte semanal de COVID-19...",
    successMsg: `✅ Reporte de COVID-19 guardado · ${total} dosis esta semana`,
    eventTitle: "COVID-19",
    eventMsg: `Captura COVID-19 semana ${fecha}: ${total} dosis.`,
    action: async () => {
      const res = await AppService.call("savecovid_captura", {
        clues: USER.clues, unidad: USER.unidad, municipio: USER.municipio, fecha, anio_campana: campana,
        valores: p.valores, capturado_por: p.nombre, editado_por: "UNIDAD", sin_movimiento: p.sin_movimiento
      });
      const r = await AppService.call("getcovid_capturas", { clues: USER.clues, anio_campana: campana }, { silent: true });
      _covidCapturasCache = (r && r.data) || [];
      renderCovidCaptura();
      if (res && res.folio) showToast(`Folio del reporte de COVID-19: ${res.folio}`, true, "info");
      return res;
    }
  });
}

// Excel de la META de COVID-19 de la unidad (formato de la temporada invernal): solo su columna.
async function exportCovidMetaUnidadExcel() {
  const btn = document.getElementById("btnExportMetaCovidUnidad");
  const X = window.CovidMetasExport;
  if (!X) { showToast("No se cargó el exportador de metas de COVID-19. Recarga la página.", false, "bad"); return; }
  if (!_covidMetaUnidadCache) { showToast("Tu unidad aún no tiene meta de COVID-19 asignada.", false, "warn"); return; }
  if (btn) btn.disabled = true;
  try {
    await window.ensureLibsLoaded("exceljs", "jszip");
    const resp = await fetch(encodeURI(METAS_COVID_PLANTILLA));
    if (!resp.ok) throw new Error(`No se pudo leer la plantilla (${resp.status})`);
    const plantilla = await resp.arrayBuffer();
    const campana = campaignSeasonLabel();
    const hospital = Object.keys(X.CLUES_HOSPITALES).find(k => X.CLUES_HOSPITALES[k] === USER.clues);
    const muni = hospital ? "HOSPITALES" : String(USER.municipio || "").trim().toUpperCase();
    if (!X.MUNICIPIOS[muni]) throw new Error(`Municipio sin formato de metas: ${USER.municipio}`);
    const registros = (_covidMetaUnidadCache.registros || []).slice();
    if (!registros.some(r => r.clues === USER.clues)) registros.push({ clues: USER.clues, municipio: USER.municipio, metas: _covidMetaUnidadCache.metas });
    const wb = await X.construirLibroCovid({
      ExcelJS, plantilla, muni, campana, metas: registros,
      unidades: [{ clues: USER.clues, unidad: USER.unidad, municipio: USER.municipio }], soloClues: USER.clues,
      unidadEtiqueta: String(USER.unidad || "").toUpperCase()
    });
    metaDescargar(await X.escribirLibro(wb, window.JSZip), X.nombreArchivoUnidad(USER.unidad, campana), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    showToast("Meta de COVID-19 de tu unidad descargada.", true, "good");
  } catch (err) {
    console.error("Error al exportar la meta de COVID-19 de la unidad:", err);
    showToast("No se pudo generar el Excel de tu meta de COVID-19" + (err && err.message ? ": " + err.message : "."), false, "bad");
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.exportCovidMetaUnidadExcel = exportCovidMetaUnidadExcel;

// Excel de la META de la unidad con el formato oficial («Metas Influenza …»): solo su columna y su jeringa.
async function exportInfluenzaMetaUnidadExcel() {
  const btn = document.getElementById("btnExportMetaUnidad");
  const X = window.InfluenzaMetasExport;
  if (!X) { showToast("No se cargó el exportador de metas. Recarga la página.", false, "bad"); return; }
  const metas = _influenzaMetasCache || {};
  if (!INFLUENZA_RUBROS.some(r => Number(metas[r.id] || 0) > 0)) {
    showToast("Tu unidad aún no tiene meta asignada para esta campaña.", false, "warn");
    return;
  }
  if (btn) btn.disabled = true;
  try {
    await window.ensureLibsLoaded("exceljs", "jszip");
    const resp = await fetch(encodeURI(METAS_EXPORT_PLANTILLA));
    if (!resp.ok) throw new Error(`No se pudo leer la plantilla (${resp.status})`);
    const plantilla = await resp.arrayBuffer();
    const campana = campaignSeasonLabel();

    const hospital = Object.keys(X.CLUES_HOSPITALES).find(k => X.CLUES_HOSPITALES[k] === USER.clues);
    const muni = hospital ? "HOSPITALES" : String(USER.municipio || "").trim().toUpperCase();
    if (!X.MUNICIPIOS[muni]) throw new Error(`Municipio sin formato de metas: ${USER.municipio}`);
    // Los hospitales toman la meta de su destino; las demás unidades, la de su CLUES.
    const registros = [{ clues: USER.clues, municipio: USER.municipio, metas }];
    if (hospital) registros.push({ clues: null, municipio: hospital, metas });

    const wb = await X.construirLibroMetas({
      ExcelJS, plantilla, muni, campana, metas: registros,
      unidades: [{ clues: USER.clues, unidad: USER.unidad, municipio: USER.municipio }],
      rubroIds: INFLUENZA_RUBROS.map(r => r.id), soloClues: USER.clues
    });
    const datos = await X.escribirLibro(wb, window.JSZip);
    metaDescargar(datos, X.nombreArchivoUnidad(USER.unidad, campana), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    showToast("Meta de tu unidad descargada.", true, "good");
  } catch (err) {
    console.error("Error al exportar la meta de la unidad:", err);
    showToast("No se pudo generar el Excel de tu meta" + (err && err.message ? ": " + err.message : "."), false, "bad");
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.exportInfluenzaMetaUnidadExcel = exportInfluenzaMetaUnidadExcel;

function renderFrascosDistribution() {
  const esJuris = USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL";
  const muni = document.getElementById("adminInfluenzaMuni")?.value;
  const jurisPanel = document.getElementById("frascosJurisPanel");
  const deliveryForm = document.getElementById("influenzaFrascosDeliveryForm");
  const historyContainer = document.getElementById("influenzaFrascosHistoryContainer");
  const adminMuniTableContainer = document.getElementById("adminFrascosMunicipalTableContainer");
  const historyTbody = document.getElementById("frascosEntregaTbody");

  if (esJuris) {
    if (jurisPanel) jurisPanel.style.setProperty("display", "flex", "important");
    if (deliveryForm) deliveryForm.style.setProperty("display", "none", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "none", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "flex", "important");

    renderRemesaPanel();
    renderFrascosMatrix("JURIS");

    const tbodyMuni = document.getElementById("adminFrascosMunicipalTbody");
    tbodyMuni.innerHTML = "";
    if (esCovid()) {
      // Resumen de existencias contra capturas semanales: solo existe para influenza.
      tbodyMuni.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold">El resumen por dosis aplicadas de COVID-19 aún no está disponible; consulta «Entregas».</td></tr>`;
    }
    const csvData = [
      ["Destino", "Frascos recibidos de la entrega (Total)", "Equivalente en Dosis", "Dosis Aplicadas", "Estimado en Resguardo (Frascos)", "Aprovechamiento %"]
    ];
    FRASCO_DESTINOS.forEach(d => {
      if (esCovid()) return;
      const totalFrascos = _adminRemesasArray.reduce((s, r) => s + Number((r.asignacion || {})[d.id] || 0), 0);
      const equivDosis = totalFrascos * DOSIS_POR_FRASCO;
      const totalAplicadas = frascoDosisAplicadas(d.id);
      const resguardo = totalFrascos - (totalAplicadas / DOSIS_POR_FRASCO);
      const pct = equivDosis > 0 ? ((totalAplicadas / equivDosis) * 100).toFixed(1) : "0.0";

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-bold text-slate-700">${d.label}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-600">${frascoFmt(totalFrascos)}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${frascoFmt(equivDosis)}</td>
        <td class="p-3 text-center text-xs font-bold text-violet-950">${frascoFmt(totalAplicadas)}</td>
        <td class="p-3 text-center text-xs font-bold text-amber-600">${resguardo.toFixed(1)}</td>
        <td class="p-3 text-center text-xs font-bold text-emerald-600">${pct}%</td>
      `;
      tbodyMuni.appendChild(row);
      csvData.push([d.label, totalFrascos, equivDosis, totalAplicadas, resguardo.toFixed(1), `${pct}%`]);
    });

    const exportBtn = document.getElementById("btnExportFrascosMuni");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const csvContent = "data:text/csv;charset=utf-8,﻿"
          + csvData.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Concentrado_Frascos_Influenza.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Archivo CSV exportado exitosamente.", true, "good");
      };
    }
  } else {
    if (jurisPanel) jurisPanel.style.setProperty("display", "none", "important");
    if (deliveryForm) deliveryForm.style.setProperty("display", "flex", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "flex", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "none", "important");
    if (!historyTbody || !muni) return;

    frascoSincronizarSelectorMuni();
    renderFrascosMunicipal(muni);
    renderFrascosMatrix(muni);

    historyTbody.innerHTML = "";
    const deliveries = esCovid() ? [] : _adminFrascosArray.filter(d => d.municipio.toUpperCase() === muni.toUpperCase());
    if (!deliveries.length) {
      historyTbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-bold">No hay entregas registradas para este municipio.</td></tr>`;
    } else {
      deliveries.forEach(d => {
        const unit = _allUnidades.find(u => u.clues === d.clues);
        const row = document.createElement("tr");
        row.className = "border-b border-slate-100 hover:bg-slate-50";
        row.innerHTML = `
          <td class="p-3 text-xs font-semibold text-slate-700">${unit ? unit.unidad : d.clues} <br><span class="text-[10px] text-slate-400 font-normal">${d.clues}</span></td>
          <td class="p-3 text-center text-xs">${d.numero_entrega}</td>
          <td class="p-3 text-center text-xs font-mono text-slate-600" colspan="2">${frascoLoteHtml(d.numero_entrega, d.clues)}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-900">${d.cantidad_frascos}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-600">${d.cantidad_frascos * DOSIS_POR_FRASCO} dosis</td>
          <td class="p-3 text-center text-xs">${d.fecha_entrega}</td>
          <td class="p-3 text-xs text-slate-500">${d.entregado_por}</td>
        `;
        historyTbody.appendChild(row);
      });
    }
    document.getElementById("btnSaveFrascoEntrega").onclick = saveFrascosDelivery;
  }

  const exp = document.getElementById("btnExportFrascosExcel");
  if (exp) exp.onclick = exportFrascosExcel;
  if (!esCovid()) {
    renderFrascosBalance();
    updateFlaskCalculationMuni();
  }
  vacunaPintarSelectores();
  iniciarDockFrascos(esJuris);
}

// Barra flotante: un solo subpanel a la vez (Repartir / Entregas / Resumen / Historial).
function frascoIrA(sub) {
  const sec = document.getElementById("secInfluenzaFrascos");
  if (!sec) return;
  sec.dataset.frsSub = sub;
  document.querySelectorAll("#dockFrascosTabs .hoja-tab").forEach(b => {
    const activo = b.dataset.frs === sub;
    b.classList.toggle("activo", activo);
    b.setAttribute("aria-selected", activo ? "true" : "false");
  });
}

function iniciarDockFrascos(esJuris) {
  const tabs = document.getElementById("dockFrascosTabs");
  if (!tabs) return;
  // El historial por unidad es solo del municipal; Jurisdicción ve sus entregas en "Entregas".
  const hist = document.getElementById("dockFrascosHist");
  if (hist) hist.style.display = (esJuris || esCovid()) ? "none" : "";
  // «Resumen» compara lo repartido contra las capturas semanales de influenza: no aplica a COVID.
  const resumenTab = tabs.querySelector('[data-frs="resumen"]');
  if (resumenTab) resumenTab.style.display = esCovid() ? "none" : "";
  if (!tabs.dataset.bound) {
    tabs.dataset.bound = "1";
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".hoja-tab");
      if (b) frascoIrA(b.dataset.frs);
    });
    if (window.DockGlass) window.DockGlass.instalar(tabs);
  }
  const sec = document.getElementById("secInfluenzaFrascos");
  if (esCovid() && ["resumen", "historial"].includes(sec?.dataset.frsSub)) frascoIrA("repartir");
  else if (esJuris && sec?.dataset.frsSub === "historial") frascoIrA("repartir");
  else frascoIrA(sec?.dataset.frsSub || "repartir");
}


// --- ═══════════ INDICADORES — EVALUACIÓN META-LOGRO INFLUENZA ═══════════ ---

// ─── Indicadores · Meta-Logro Influenza ─────────────────────────────────────────────────────────────────────
// Vista del ámbito elegido (jurisdicción, municipio u hospital, o una unidad): avance contra la meta y contra lo
// que debería llevarse a la fecha, ritmo y proyección al cierre, cobertura de reporte de la semana, avance por
// municipio/unidad, tendencia semanal, abasto de frascos y detalle por grupo. Todo sale de metas, capturas y
// reparto de la campaña activa (sin tablas nuevas).
function infIndSemanas(ini, fin) {
  const out = [];
  if (!ini || !fin) return out;
  const d = new Date(ini + "T12:00:00");
  const end = new Date(fin + "T12:00:00");
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  while (d <= end) { out.push(d.toLocaleDateString("en-CA")); d.setDate(d.getDate() + 7); }
  const cortes = window.InfluenzaReglas ? window.InfluenzaReglas.cortes(ini, fin) : [];
  return [...new Set([...out, ...cortes])].sort();
}

function infIndTono(diff) {
  return diff >= -5 ? "good" : (diff >= -15 ? "warn" : "bad");
}

function infIndEtiqueta(tono, pct) {
  if (pct >= 100) return "Meta alcanzada";
  return tono === "good" ? "En ritmo" : (tono === "warn" ? "Algo atrasado" : "Atrasado");
}

let _infIndRenderToken = 0;
async function renderInfluenzaIndicatorsDashboard(muniFilter, uniFilter) {
  const miToken = ++_infIndRenderToken;
  window._infIndicadoresDatos = null;   // hasta que termine este cálculo, el Excel/PDF no usan cifras de otro ámbito
  const container = document.getElementById("rdaDashboardContent");
  if (!container) return;
  container.innerHTML = '<div class="iinf-cargando" role="status">Calculando indicadores de influenza…</div>';

  // Campaña activa (nunca fija: cambia cada temporada)
  const resConfig = await AppService.call("getinfluenza_config");
  const camp = resConfig?.data || null;
  const activeCampaignName = camp?.nombre
    || `Campaña Influenza ${deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin)}`;
  const ini = camp?.fecha_inicio || _campaignConfig.fecha_inicio;
  const fin = camp?.fecha_fin || _campaignConfig.fecha_fin;

  const scopeEl = document.getElementById("rdaScopeLabel");
  if (scopeEl) {
    if (uniFilter) scopeEl.textContent = `Unidad: ${uniFilter}`;
    else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
    else scopeEl.textContent = "Jurisdicción Sanitaria 1";
  }
  const cierreEl = document.getElementById("rdaCierreLabel");
  if (cierreEl) cierreEl.textContent = `Meta-Logro Influenza | ${activeCampaignName}`;

  // 1. Unidades del ámbito (los hospitales cuentan como su propio destino)
  const hospitales = [
    { id: "HENM", clues: "QTSSA001740" },
    { id: "NHG", clues: "QTSSA002901" }
  ];
  const { data: allUnits } = await window.supabase.from("unidades").select("clues, municipio, unidad").eq("activo", "SI");
  const destinoDe = (u) => {
    const h = hospitales.find(x => x.clues === u.clues);
    return h ? h.id : String(u.municipio || "").toUpperCase();
  };
  let units = (allUnits || []).map(u => ({ clues: u.clues, unidad: u.unidad || u.clues, municipio: String(u.municipio || "").toUpperCase(), destino: destinoDe(u) }));
  if (uniFilter) units = units.filter(u => u.clues === uniFilter);
  else if (muniFilter) {
    // Los hospitales (HENM, NHG) se manejan como destinos propios: no cuentan dentro de Querétaro.
    const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/^EL\s+/, "");
    units = units.filter(u => norm(u.destino) === norm(muniFilter));
  }

  // 2. Metas, capturas y reparto de la campaña
  const [resMetas, resCapturas, resFrascos] = await Promise.all([
    AppService.call("getinfluenza_metas", { anio_campana: activeCampaignName }),
    AppService.call("getinfluenza_capturas", { anio_campana: activeCampaignName }),
    AppService.call("getinfluenza_distribucion", { anio_campana: activeCampaignName })
  ]);
  const metasPorClues = {};
  (resMetas.data || []).forEach(m => { if (m.clues) metasPorClues[m.clues] = m.metas || {}; });
  const capturasPorClues = {};
  (resCapturas.data || []).forEach(c => { (capturasPorClues[c.clues] = capturasPorClues[c.clues] || []).push(c); });
  const frascosPorClues = {};
  (resFrascos.data || []).forEach(f => { if (f.clues) frascosPorClues[f.clues] = (frascosPorClues[f.clues] || 0) + Number(f.cantidad_frascos || 0); });

  if (miToken !== _infIndRenderToken) return;   // llegó un filtro más reciente: este cálculo ya no se pinta

  // 3. Calendario de la campaña
  const hoy = new Date().toLocaleDateString("en-CA");
  const semanas = infIndSemanas(ini, fin);
  const vencidas = semanas.filter(f => f <= hoy);
  const ultimaSemana = vencidas[vencidas.length - 1] || null;
  const restantes = semanas.filter(f => f > hoy).length;
  const t0 = Date.parse(ini + "T12:00:00"), t1 = Date.parse(fin + "T12:00:00"), tn = Date.parse(hoy + "T12:00:00");
  const esperadoPct = (t1 > t0) ? Math.max(0, Math.min(100, (tn - t0) * 100 / (t1 - t0))) : 0;

  // 4. Agregados por unidad, grupo y semana
  const grupos = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const k = `${rb.categoria} - ${rb.grupo}`;
    (grupos[k] = grupos[k] || []).push(rb);
  });
  const rubro = {};
  INFLUENZA_RUBROS.forEach(rb => { rubro[rb.id] = { meta: 0, apl: 0 }; });
  const porSemana = {};
  semanas.forEach(f => { porSemana[f] = 0; });
  const filas = units.map(u => {
    const metas = metasPorClues[u.clues] || {};
    const caps = capturasPorClues[u.clues] || [];
    let meta = 0, apl = 0, blancoM = 0, blancoA = 0, riesgoM = 0, riesgoA = 0, rebasa = 0;
    const aplRubro = {};
    caps.forEach(c => {
      INFLUENZA_RUBROS.forEach(rb => { aplRubro[rb.id] = (aplRubro[rb.id] || 0) + Number((c.valores || {})[rb.id] || 0); });
      const dosis = Object.values(c.valores || {}).reduce((s, v) => s + Number(v || 0), 0);
      porSemana[c.fecha] = (porSemana[c.fecha] || 0) + dosis;
    });
    INFLUENZA_RUBROS.forEach(rb => {
      const m = Number(metas[rb.id] || 0), a = aplRubro[rb.id] || 0;
      const esBlanco = String(rb.categoria).includes("blanca");
      meta += m; apl += a;
      if (esBlanco) { blancoM += m; blancoA += a; } else { riesgoM += m; riesgoA += a; }
      if (m > 0 && a > m) rebasa++;
      rubro[rb.id].meta += m; rubro[rb.id].apl += a;
    });
    const ultima = caps.reduce((x, c) => (c.fecha > x ? c.fecha : x), "");
    return {
      ...u, meta, apl, blancoM, blancoA, riesgoM, riesgoA, rebasa, ultima,
      conMeta: meta > 0, nunca: caps.length === 0,
      reportoUltima: !!ultimaSemana && caps.some(c => c.fecha === ultimaSemana),
      frascos: frascosPorClues[u.clues] || 0
    };
  });
  const evaluables = filas.filter(f => f.conMeta);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  const meta = sum(filas, "meta"), apl = sum(filas, "apl");
  const pct = meta > 0 ? apl * 100 / meta : 0;
  const diff = pct - esperadoPct;
  const tono = infIndTono(diff);
  const faltan = Math.max(0, meta - apl);

  const fmt = (n) => Math.round(n).toLocaleString("es-MX");
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const corta = (ymd) => (window.InfluenzaReglas ? window.InfluenzaReglas.fechaCorta(ymd) : ymd);
  const rangoDe = (ymd) => influenzaRangoTexto(ymd, ini, fin);
  const e = (t) => escapeHtml(String(t == null ? "" : t));

  if (!meta) {
    container.innerHTML = `<div class="iinf"><div class="iinf-vacio"><span class="material-symbols-rounded" aria-hidden="true">flag</span><div><b>Este ámbito aún no tiene meta de influenza asignada.</b><p>Cuando se registre la meta en «Distribución de Metas», aquí verás el avance, el ritmo y la cobertura de reporte.</p></div></div></div>`;
    return;
  }

  // Ritmo: promedio de las últimas 4 semanas vencidas contra lo que se necesita por semana restante
  const ult4 = vencidas.slice(-4);
  const ritmo4 = ult4.length ? ult4.reduce((s, f) => s + (porSemana[f] || 0), 0) / ult4.length : 0;
  const necesario = (restantes > 0 && faltan > 0) ? faltan / restantes : null;
  const proyeccion = apl + ritmo4 * restantes;
  const pctProy = meta > 0 ? proyeccion * 100 / meta : 0;
  const proyFiable = vencidas.length >= 4 || restantes === 0;   // con menos semanas el promedio no dice nada
  const semanaN = vencidas.length;

  // Cobertura de reporte de la última semana vencida
  // Sin semanas vencidas (la campaña aún no inicia) nadie «dejó de reportar».
  const sinReporte = ultimaSemana ? evaluables.filter(f => !f.reportoUltima) : [];
  const reportaron = ultimaSemana ? evaluables.length - sinReporte.length : 0;
  const nuncaReportaron = evaluables.filter(f => f.nunca);

  // Abasto de frascos (solo unidades con reparto registrado)
  const conReparto = filas.filter(f => f.frascos > 0);
  const frascosRec = sum(conReparto, "frascos");
  const dosisRec = frascosRec * DOSIS_POR_FRASCO;
  const aplConReparto = sum(conReparto, "apl");
  const excedenReparto = conReparto.filter(f => f.apl > f.frascos * DOSIS_POR_FRASCO);

  const chip = (t, txt) => `<span class="iinf-chip iinf-chip--${t}">${txt}</span>`;
  const barra = (p, t, aria) => `<div class="iinf-bar" role="progressbar" aria-label="${e(aria)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(p))}"><span class="iinf-fill" data-tono="${t}" style="width:${Math.min(100, Math.max(p > 0 ? 2 : 0, p)).toFixed(1)}%"></span></div>`;
  const tonoGrupo = (m, a) => (m > 0 ? infIndTono(a * 100 / m - esperadoPct) : "none");

  // ── Hero ──
  const heroEstado = infIndEtiqueta(tono, pct);
  const hero = `
    <section class="iinf-hero" data-tono="${tono}" aria-labelledby="iinfHeroTit">
      <div class="iinf-hero-num">
        <span class="iinf-eyebrow" id="iinfHeroTit">Avance de la campaña</span>
        <b>${f1(pct)}<small>%</small></b>
        ${chip(tono, heroEstado)}
      </div>
      <div class="iinf-hero-txt">
        <p>Se han aplicado <b>${fmt(apl)}</b> de <b>${fmt(meta)}</b> dosis de la meta (≈ ${fmt(Math.ceil(meta / DOSIS_POR_FRASCO))} frascos).
        A esta fecha, con ${fmt(semanaN)} de ${fmt(semanas.length)} semanas de campaña, se debería llevar <b>${f1(esperadoPct)}%</b>:
        ${diff >= 0 ? `vas <b>${f1(diff)} puntos por delante</b>` : `faltan <b>${f1(-diff)} puntos</b> para ir en ritmo`}.</p>
        <div class="iinf-prog" role="progressbar" aria-label="Avance de la meta contra lo esperado a hoy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-valuetext="${f1(pct)} por ciento; esperado a hoy ${f1(esperadoPct)} por ciento">
          <i data-tono="${tono}" style="width:${Math.min(100, pct).toFixed(1)}%"></i>
          <span class="iinf-prog-marca" style="left:${Math.min(100, esperadoPct).toFixed(1)}%" title="Avance esperado a hoy"></span>
        </div>
        <div class="iinf-prog-leyenda" aria-hidden="true"><span>0%</span><span>La marca es lo esperado a hoy (${f1(esperadoPct)}%)</span><span>Meta 100%</span></div>
      </div>
    </section>`;

  // ── Indicadores clave ──
  const kpi = (icono, etq, valor, nota, t) => `
    <div class="iinf-kpi"${t ? ` data-tono="${t}"` : ""}>
      <span class="material-symbols-rounded" aria-hidden="true">${icono}</span>
      <div><small>${etq}</small><b>${valor}</b><em>${nota}</em></div>
    </div>`;
  const tonoRitmo = necesario == null ? "good" : (ritmo4 >= necesario ? "good" : (ritmo4 >= necesario * 0.7 ? "warn" : "bad"));
  const tonoProy = pctProy >= 100 ? "good" : (pctProy >= 85 ? "warn" : "bad");
  const kpis = `
    <div class="iinf-kpis" role="group" aria-label="Indicadores clave de la campaña">
      ${kpi("flag", "Meta de la campaña", fmt(meta), `${fmt(evaluables.length)} ${evaluables.length === 1 ? "unidad con meta" : "unidades con meta"}`)}
      ${kpi("vaccines", "Dosis aplicadas", fmt(apl), ultimaSemana ? `Corte: semana del ${rangoDe(ultimaSemana)}` : "Aún sin semanas vencidas")}
      ${kpi("hourglass_top", "Faltan por aplicar", fmt(faltan), `≈ ${fmt(Math.ceil(faltan / DOSIS_POR_FRASCO))} frascos`)}
      ${kpi("calendar_month", "Semana de campaña", `${fmt(semanaN)} de ${fmt(semanas.length)}`, restantes ? `Quedan ${fmt(restantes)} ${restantes === 1 ? "semana" : "semanas"}` : "La campaña ya terminó")}
      ${kpi("speed", "Ritmo reciente", `${fmt(ritmo4)} <small>dosis/sem</small>`, necesario == null ? (faltan > 0 ? "Sin semanas restantes" : "Meta cumplida") : `Necesario: ${fmt(necesario)} por semana`, tonoRitmo)}
      ${proyFiable
        ? kpi("trending_up", "Proyección al cierre", `${f1(pctProy)}<small>%</small>`, restantes ? `A este ritmo, ${fmt(proyeccion)} dosis` : "Resultado final", tonoProy)
        : kpi("trending_up", "Proyección al cierre", "—", "Se calcula con 4 semanas de reportes")}
    </div>`;

  // ── Cobertura de reporte ──
  const pctCob = evaluables.length ? reportaron * 100 / evaluables.length : 0;
  const tonoCob = pctCob >= 90 ? "good" : (pctCob >= 70 ? "warn" : "bad");
  const nombresSin = sinReporte.slice(0, 12).map(f => `<li>${e(f.unidad)}<small>${e(f.destino)}</small></li>`).join("");
  const cobertura = ultimaSemana ? `
    <section class="iinf-card" aria-labelledby="iinfCobTit">
      <header><h3 id="iinfCobTit">Reporte de la semana del ${rangoDe(ultimaSemana)}</h3>${chip(tonoCob, `${fmt(reportaron)} de ${fmt(evaluables.length)} ${evaluables.length === 1 ? "unidad" : "unidades"}`)}</header>
      ${barra(pctCob, tonoCob, "Unidades que reportaron la última semana")}
      ${sinReporte.length
        ? `<p class="iinf-nota">${fmt(sinReporte.length)} ${sinReporte.length === 1 ? "unidad no ha reportado" : "unidades no han reportado"} esa semana${nuncaReportaron.length ? ` (${fmt(nuncaReportaron.length)} sin ningún reporte en la campaña)` : ""}:</p>
           <ul class="iinf-lista">${nombresSin}</ul>${sinReporte.length > 12 ? `<p class="iinf-nota">y ${fmt(sinReporte.length - 12)} más.</p>` : ""}`
        : '<p class="iinf-nota">Todas las unidades con meta reportaron esa semana.</p>'}
    </section>` : "";

  // ── Población blanco / riesgo ──
  const blancoM = sum(filas, "blancoM"), blancoA = sum(filas, "blancoA"), riesgoM = sum(filas, "riesgoM"), riesgoA = sum(filas, "riesgoA");
  const poblacion = [
    { t: "Población blanco", ico: "child_care", m: blancoM, a: blancoA },
    { t: "Población de riesgo", ico: "health_and_safety", m: riesgoM, a: riesgoA }
  ].map(p => {
    const pp = p.m > 0 ? p.a * 100 / p.m : 0, tt = tonoGrupo(p.m, p.a);
    return `<div class="iinf-pob" data-tono="${tt}">
      <span class="material-symbols-rounded" aria-hidden="true">${p.ico}</span>
      <div><small>${p.t}</small><b>${p.m > 0 ? f1(pp) + "%" : "Sin meta"}</b>
      ${barra(pp, tt, "Avance de " + p.t)}
      <em>${fmt(p.a)} de ${fmt(p.m)} dosis</em></div></div>`;
  }).join("");

  // ── Avance por municipio / unidad ──
  let ranking = "";
  const porUnidad = !!muniFilter;
  const mapa = {};
  evaluables.forEach(f => {
    const k = porUnidad ? f.clues : f.destino;
    const o = mapa[k] || (mapa[k] = { nombre: porUnidad ? f.unidad : f.destino, n: 0, meta: 0, apl: 0, ultima: "", sinRep: 0 });
    o.n++; o.meta += f.meta; o.apl += f.apl;
    if (f.ultima > o.ultima) o.ultima = f.ultima;
    if (!f.reportoUltima) o.sinRep++;
  });
  const lista = Object.values(mapa).map(o => ({ ...o, p: o.meta ? o.apl * 100 / o.meta : 0 }))
    .map(o => ({ ...o, d: o.p - esperadoPct })).sort((a, b) => a.d - b.d);
  if (!uniFilter) {
    ranking = `
    <section class="iinf-card" aria-labelledby="iinfRankTit">
      <header><h3 id="iinfRankTit">Avance por ${porUnidad ? "unidad" : "municipio"}</h3><span class="iinf-sub">Primero quienes van más atrasados contra lo esperado</span></header>
      <div class="iinf-scroll">
        <table class="iinf-tabla" aria-label="Avance de la meta de influenza por ${porUnidad ? "unidad" : "municipio"}, ordenado del más atrasado al más adelantado">
          <thead><tr><th scope="col">${porUnidad ? "Unidad" : "Municipio / hospital"}</th><th scope="col" class="c">Meta</th><th scope="col" class="c">Aplicadas</th><th scope="col">Avance</th><th scope="col" class="c">Contra lo esperado</th><th scope="col" class="c">Último reporte</th></tr></thead>
          <tbody>${lista.map(o => {
            const tt = infIndTono(o.d);
            return `<tr>
              <th scope="row">${e(o.nombre)}${!porUnidad ? `<small>${fmt(o.n)} ${o.n === 1 ? "unidad" : "unidades"}${o.sinRep ? ` · ${fmt(o.sinRep)} sin reporte` : ""}</small>` : ""}</th>
              <td class="c">${fmt(o.meta)}</td><td class="c"><b>${fmt(o.apl)}</b></td>
              <td class="iinf-avance"><div class="iinf-avance-in">${barra(o.p, tt, "Avance de " + o.nombre)}<span>${f1(o.p)}%</span></div></td>
              <td class="c">${chip(tt, `${o.d >= 0 ? "+" : "−"}${f1(Math.abs(o.d))} pts`)}</td>
              <td class="c">${o.ultima ? rangoDe(o.ultima) : "Sin reporte"}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </section>`;
  }

  // ── Tendencia semanal ──
  const barras = vencidas.map(f => ({ f, v: porSemana[f] || 0 }));
  const maxV = Math.max(1, ...barras.map(b => b.v), necesario || 0);
  const W = 720, H = 190, padL = 44, padB = 28, padT = 14, gw = W - padL - 8, gh = H - padB - padT;
  const bw = barras.length ? Math.max(4, Math.min(34, gw / barras.length - 4)) : 10;
  const paso = barras.length ? gw / barras.length : gw;
  const yDe = v => padT + gh - (v / maxV) * gh;
  const cada = Math.max(1, Math.ceil(barras.length / 12));
  const svg = barras.length ? `
    <svg viewBox="0 0 ${W} ${H}" class="iinf-svg" role="img" aria-label="Dosis aplicadas por semana: ${barras.map(b => `semana del ${rangoDe(b.f)}: ${fmt(b.v)}`).join(", ")}">
      <line x1="${padL}" y1="${padT + gh}" x2="${W - 8}" y2="${padT + gh}" class="iinf-eje"/>
      <line x1="${padL}" y1="${padT}" x2="${W - 8}" y2="${padT}" class="iinf-grid"/>
      <text x="${padL - 6}" y="${padT + 4}" class="iinf-txt" text-anchor="end">${fmt(maxV)}</text>
      <text x="${padL - 6}" y="${padT + gh + 4}" class="iinf-txt" text-anchor="end">0</text>
      ${necesario != null ? `<line x1="${padL}" y1="${yDe(necesario).toFixed(1)}" x2="${W - 8}" y2="${yDe(necesario).toFixed(1)}" class="iinf-necesario"/>` : ""}
      ${barras.map((b, i) => {
        const x = padL + i * paso + (paso - bw) / 2, y = yDe(b.v);
        return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${Math.max(1, padT + gh - y).toFixed(1)}" rx="3" class="iinf-col"><title>Semana del ${rangoDe(b.f)}: ${fmt(b.v)} dosis</title></rect>
        ${i % cada === 0 || i === barras.length - 1 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" class="iinf-txt" text-anchor="middle">${corta(window.InfluenzaReglas.rangoSemana(b.f, ini, fin).desde)}</text>` : ""}</g>`;
      }).join("")}
    </svg>` : "";
  const tendencia = `
    <section class="iinf-card" aria-labelledby="iinfTendTit">
      <header><h3 id="iinfTendTit">Dosis aplicadas por semana</h3><span class="iinf-sub">Cada barra es una semana (se marca con su primer día)${necesario != null ? `; la línea punteada es el ritmo necesario para cumplir (<b>${fmt(necesario)}</b> dosis por semana)` : ""}</span></header>
      ${svg || '<p class="iinf-nota">La campaña aún no tiene semanas vencidas.</p>'}
      ${barras.length ? `<details class="iinf-det"><summary>Ver los datos por semana</summary>
        <table class="iinf-tabla iinf-tabla--mini" aria-label="Dosis aplicadas por semana"><thead><tr><th scope="col">Semana</th><th scope="col" class="c">Dosis</th></tr></thead>
        <tbody>${barras.slice().reverse().map(b => `<tr><th scope="row">${rangoDe(b.f)}</th><td class="c">${fmt(b.v)}</td></tr>`).join("")}</tbody></table></details>` : ""}
    </section>`;

  // ── Abasto de frascos ──
  const abasto = `
    <section class="iinf-card" aria-labelledby="iinfAbTit">
      <header><h3 id="iinfAbTit">Abasto de frascos</h3><span class="iinf-sub">Lo repartido a las unidades contra lo que han aplicado</span></header>
      ${frascosRec ? `
      <div class="iinf-mini-kpis">
        <div><small>Repartidos</small><b>${fmt(frascosRec)}</b><em>${fmt(dosisRec)} dosis</em></div>
        <div><small>Aplicadas</small><b>${fmt(aplConReparto)}</b><em>${f1(dosisRec ? aplConReparto * 100 / dosisRec : 0)}% de lo repartido</em></div>
        <div data-tono="${aplConReparto > dosisRec ? "bad" : "good"}"><small>Existencia estimada</small><b>${fmt(Math.max(0, dosisRec - aplConReparto))}</b><em>dosis</em></div>
      </div>
      ${excedenReparto.length ? `<p class="iinf-nota iinf-nota--alerta">${fmt(excedenReparto.length)} ${excedenReparto.length === 1 ? "unidad ha aplicado más" : "unidades han aplicado más"} de lo que se les repartió: ${excedenReparto.slice(0, 6).map(f => e(f.unidad)).join(", ")}${excedenReparto.length > 6 ? "…" : ""}. Revisa el reparto o la captura.</p>` : '<p class="iinf-nota">Ninguna unidad ha aplicado más de lo que se le repartió.</p>'}
      ${conReparto.length < evaluables.length ? `<p class="iinf-nota">${fmt(evaluables.length - conReparto.length)} ${evaluables.length - conReparto.length === 1 ? "unidad con meta aún no tiene" : "unidades con meta aún no tienen"} reparto registrado.</p>` : ""}`
      : '<p class="iinf-nota">Todavía no hay reparto de frascos registrado por unidad para este ámbito.</p>'}
    </section>`;

  // ── Por grupo ──
  const filasGrupo = Object.entries(grupos).map(([titulo, rubros]) => {
    const m = rubros.reduce((s, rb) => s + rubro[rb.id].meta, 0);
    const a = rubros.reduce((s, rb) => s + rubro[rb.id].apl, 0);
    return { titulo, rubros, m, a };
  }).filter(g => g.m > 0 || g.a > 0);
  const tablaGrupos = `
    <section class="iinf-card" aria-labelledby="iinfGrpTit">
      <header><h3 id="iinfGrpTit">Avance por grupo de población</h3><span class="iinf-sub">Cada grupo contra su meta; la columna final compara con lo esperado a hoy</span></header>
      <div class="iinf-scroll">
        <table class="iinf-tabla" aria-label="Meta y dosis aplicadas de influenza por grupo de población">
          <thead><tr><th scope="col">Grupo</th><th scope="col" class="c">Meta</th><th scope="col" class="c">Aplicadas</th><th scope="col">Avance</th><th scope="col" class="c">Contra lo esperado</th></tr></thead>
          <tbody>${filasGrupo.map(g => {
            const p = g.m ? g.a * 100 / g.m : 0, tt = tonoGrupo(g.m, g.a), d = p - esperadoPct;
            return `<tr><th scope="row">${e(g.titulo)}</th><td class="c">${fmt(g.m)}</td><td class="c"><b>${fmt(g.a)}</b></td>
              <td class="iinf-avance"><div class="iinf-avance-in">${barra(p, tt, "Avance de " + g.titulo)}<span>${g.m ? f1(p) + "%" : "Sin meta"}</span></div></td>
              <td class="c">${g.m ? chip(tt, `${d >= 0 ? "+" : "−"}${f1(Math.abs(d))} pts`) : "—"}</td></tr>`;
          }).join("")}</tbody>
          <tfoot><tr><th scope="row">Total</th><td class="c">${fmt(meta)}</td><td class="c"><b>${fmt(apl)}</b></td><td class="iinf-avance"><div class="iinf-avance-in"><span>${f1(pct)}%</span></div></td><td class="c">${chip(tono, `${diff >= 0 ? "+" : "−"}${f1(Math.abs(diff))} pts`)}</td></tr></tfoot>
        </table>
      </div>
      <details class="iinf-det"><summary>Ver el detalle por edad</summary>
        <div class="iinf-scroll"><table class="iinf-tabla" aria-label="Meta y dosis aplicadas de influenza por rubro y edad">
          <thead><tr><th scope="col">Grupo y edad</th><th scope="col" class="c">Meta</th><th scope="col" class="c">Aplicadas</th><th scope="col" class="c">Avance</th></tr></thead>
          <tbody>${filasGrupo.map(g => `<tr class="iinf-grp"><th scope="colgroup" colspan="4">${e(g.titulo)}</th></tr>` + g.rubros.map(rb => {
            const r = rubro[rb.id];
            if (!r.meta && !r.apl) return "";
            const p = r.meta ? r.apl * 100 / r.meta : 0;
            return `<tr><th scope="row" class="iinf-edad">${e(rb.edad)}</th><td class="c">${fmt(r.meta)}</td><td class="c">${fmt(r.apl)}</td><td class="c">${r.meta ? chip(r.apl > r.meta ? "bad" : tonoGrupo(r.meta, r.apl), f1(p) + "%") : "—"}</td></tr>`;
          }).join("")).join("")}</tbody>
        </table></div>
      </details>
    </section>`;

  // ── Por revisar ──
  const sinMeta = filas.filter(f => !f.conMeta);
  const rebasan = filas.filter(f => f.rebasa > 0);
  const alertas = [];
  if (rebasan.length) alertas.push(`<li><b>${fmt(rebasan.length)} ${rebasan.length === 1 ? "unidad rebasa" : "unidades rebasan"} su meta</b> en algún grupo: ${rebasan.slice(0, 6).map(f => e(f.unidad)).join(", ")}${rebasan.length > 6 ? "…" : ""}.</li>`);
  if (sinMeta.length && !uniFilter) alertas.push(`<li><b>${fmt(sinMeta.length)} ${sinMeta.length === 1 ? "unidad activa no tiene" : "unidades activas no tienen"} meta asignada</b> en esta campaña.</li>`);
  if (nuncaReportaron.length && vencidas.length >= 2) alertas.push(`<li><b>${fmt(nuncaReportaron.length)} ${nuncaReportaron.length === 1 ? "unidad con meta no ha reportado" : "unidades con meta no han reportado"} nunca</b> en esta campaña: ${nuncaReportaron.slice(0, 6).map(f => e(f.unidad)).join(", ")}${nuncaReportaron.length > 6 ? "…" : ""}.</li>`);
  const revisar = alertas.length ? `
    <section class="iinf-card iinf-card--alerta" aria-labelledby="iinfRevTit">
      <header><h3 id="iinfRevTit">Por revisar</h3></header>
      <ul class="iinf-alertas">${alertas.join("")}</ul>
    </section>` : "";

  // Datos del tablero para el Excel (exportInfluenzaIndicadoresExcel): mismas cifras que se ven en pantalla.
  window._infIndicadoresDatos = {
    campana: activeCampaignName,
    ambito: uniFilter ? `Unidad: ${(units[0] && units[0].unidad) || uniFilter}` : (muniFilter ? `Municipio: ${muniFilter}` : "Jurisdicción Sanitaria 1"),
    fechaCorte: hoy, ultimaSemana, inicio: ini, fin,
    meta, apl, pct, esperadoPct, diff, estado: heroEstado, faltan, semanaN, totalSemanas: semanas.length, restantes,
    ritmo4, necesario, proyeccion: proyFiable ? proyeccion : null, pctProy: proyFiable ? pctProy : null,
    unidadesConMeta: evaluables.length, reportaron, sinReporte: sinReporte.map(f => ({ unidad: f.unidad, destino: f.destino })),
    nuncaReportaron: nuncaReportaron.length,
    blanco: { meta: blancoM, apl: blancoA }, riesgo: { meta: riesgoM, apl: riesgoA },
    porUnidad, ranking: uniFilter ? [] : lista,
    semanas: barras.map(b => ({ fecha: b.f, rango: rangoDe(b.f), desde: window.InfluenzaReglas.rangoSemana(b.f, ini, fin).desde, dosis: b.v })),
    rangoUltimaSemana: ultimaSemana ? rangoDe(ultimaSemana) : null,
    grupos: filasGrupo.map(g => ({ titulo: g.titulo, meta: g.m, apl: g.a, edades: g.rubros.map(rb => ({ edad: rb.edad, meta: rubro[rb.id].meta, apl: rubro[rb.id].apl })).filter(x => x.meta || x.apl) })),
    abasto: { frascos: frascosRec, dosis: dosisRec, apl: aplConReparto, exceden: excedenReparto.map(f => f.unidad), conReparto: conReparto.length },
    revisar: { rebasan: rebasan.map(f => f.unidad), sinMeta: sinMeta.map(f => f.unidad), nunca: (vencidas.length >= 2 ? nuncaReportaron : []).map(f => f.unidad) }
  };

  container.innerHTML = `
    <div class="iinf">
      ${hero}
      ${kpis}
      <div class="iinf-dos">${cobertura}<section class="iinf-card" aria-labelledby="iinfPobTit"><header><h3 id="iinfPobTit">Población blanco y de riesgo</h3></header><div class="iinf-pobs">${poblacion}</div></section></div>
      ${revisar}
      ${ranking}
      ${tendencia}
      ${abasto}
      ${tablaGrupos}
      <p class="iinf-pie" role="note"><b>Cómo leerlo:</b> el avance es dosis aplicadas ÷ meta de la campaña (${e(activeCampaignName)}). «Esperado a hoy» es la proporción de la campaña que ya transcurrió; verde si vas a menos de 5 puntos de ella, ámbar hasta 15 y rojo si estás más atrás. La proyección supone que se mantiene el ritmo de las últimas 4 semanas.</p>
    </div>`;
}


/** Excel del tablero de Indicadores de influenza (mismas cifras que se ven en pantalla). */
async function exportInfluenzaIndicadoresExcel() {
  const d = window._infIndicadoresDatos;
  if (!d) { showToast("Primero abre el tablero de influenza para generar el Excel.", false, "warn"); return; }
  try {
    await window.ensureLibsLoaded("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "SIREVAQ · Jurisdicción Sanitaria 1";
    wb.created = new Date();
    const AZUL = "FF1E293B";
    const borde = { style: "thin", color: { argb: "FFE2E8F0" } };
    const tonoFill = (diff) => ({ type: "pattern", pattern: "solid", fgColor: { argb: diff >= -5 ? "FFD1FAE5" : (diff >= -15 ? "FFFEF3C7" : "FFFEE2E2") } });

    const hoja = (nombre, titulo, columnas, filas, alFila) => {
      const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      ws.mergeCells(1, 1, 1, columnas.length);
      ws.getCell(1, 1).value = titulo;
      ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: AZUL } };
      ws.mergeCells(2, 1, 2, columnas.length);
      ws.getCell(2, 1).value = `${d.campana} · ${d.ambito} · Corte al ${d.fechaCorte}`;
      ws.getCell(2, 1).font = { size: 10, color: { argb: "FF64748B" } };
      const cab = ws.getRow(4);
      columnas.forEach((c, i) => {
        const cell = cab.getCell(i + 1);
        cell.value = c.t;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
        cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
        ws.getColumn(i + 1).width = c.w || 16;
      });
      cab.height = 26;
      filas.forEach((f, r) => {
        const row = ws.getRow(5 + r);
        f.forEach((v, i) => {
          const cell = row.getCell(i + 1);
          cell.value = v;
          const fmt = typeof v === "number" ? (columnas[i].fmt || null) : null;
          if (fmt) cell.numFmt = fmt;
          cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: i === 0 };
          cell.border = { bottom: borde };
        });
        if (alFila) alFila(row, f, r);
      });
      return ws;
    };

    const pctFmt = "0.0%";
    const resumen = [
      ["Meta de la campaña (dosis)", d.meta, "#,##0"],
      ["Dosis aplicadas", d.apl, "#,##0"],
      ["Avance de la meta", d.pct / 100, pctFmt],
      ["Avance esperado a la fecha", d.esperadoPct / 100, pctFmt],
      ["Diferencia contra lo esperado (puntos)", Math.round(d.diff * 10) / 10, "0.0"],
      ["Estado", d.estado],
      ["Dosis que faltan", d.faltan, "#,##0"],
      ["Frascos que faltan (aprox.)", Math.ceil(d.faltan / DOSIS_POR_FRASCO), "#,##0"],
      ["Semana de campaña", `${d.semanaN} de ${d.totalSemanas}`],
      ["Semanas restantes", d.restantes],
      ["Ritmo reciente (dosis por semana, últimas 4)", Math.round(d.ritmo4), "#,##0"],
      ["Ritmo necesario (dosis por semana)", d.necesario == null ? "—" : Math.round(d.necesario), "#,##0"],
      ["Proyección al cierre (% de la meta)", d.pctProy == null ? "Se calcula con 4 semanas de reportes" : d.pctProy / 100, pctFmt],
      ["Unidades con meta", d.unidadesConMeta],
      [`Unidades que reportaron la semana del ${d.rangoUltimaSemana || "—"}`, d.reportaron],
      ["Unidades que no reportaron esa semana", d.sinReporte.length],
      ["Población blanco: avance de su meta", d.blanco.meta ? d.blanco.apl / d.blanco.meta : "Sin meta", pctFmt],
      ["Población de riesgo: avance de su meta", d.riesgo.meta ? d.riesgo.apl / d.riesgo.meta : "Sin meta", pctFmt]
    ];
    hoja("Resumen", "Indicadores de influenza · Resumen", [{ t: "Indicador", w: 52 }, { t: "Valor", w: 30 }],
      resumen.map(r => [r[0], r[1]]),
      (row, f, i) => { if (resumen[i][2] && typeof f[1] === "number") row.getCell(2).numFmt = resumen[i][2]; });

    if (d.ranking.length) {
      hoja(d.porUnidad ? "Por unidad" : "Por municipio", `Avance por ${d.porUnidad ? "unidad" : "municipio / hospital"} (más atrasados primero)`,
        [{ t: d.porUnidad ? "Unidad" : "Municipio / hospital", w: 34 }, { t: "Unidades", w: 12 }, { t: "Meta", w: 12, fmt: "#,##0" }, { t: "Aplicadas", w: 12, fmt: "#,##0" },
         { t: "Avance", w: 12, fmt: pctFmt }, { t: "Contra lo esperado (pts)", w: 16, fmt: "0.0" }, { t: "Sin reporte última semana", w: 16 }, { t: "Último reporte (semana)", w: 24 }],
        d.ranking.map(o => [o.nombre, o.n, o.meta, o.apl, o.p / 100, Math.round(o.d * 10) / 10, o.sinRep, o.ultima ? influenzaRangoTexto(o.ultima, d.inicio, d.fin) : "Sin reporte"]),
        (row, f, r) => { row.getCell(6).fill = tonoFill(d.ranking[r].d); });
    }

    let acum = 0;
    hoja("Por semana", "Dosis aplicadas por semana",
      [{ t: "Semana", w: 28 }, { t: "Dosis", w: 14, fmt: "#,##0" }, { t: "Acumulado", w: 14, fmt: "#,##0" }, { t: "% de la meta", w: 14, fmt: pctFmt }],
      d.semanas.map(s => { acum += s.dosis; return [s.rango, s.dosis, acum, d.meta ? acum / d.meta : 0]; }));

    hoja("Por grupo", "Avance por grupo de población",
      [{ t: "Grupo", w: 60 }, { t: "Meta", w: 12, fmt: "#,##0" }, { t: "Aplicadas", w: 12, fmt: "#,##0" }, { t: "Avance", w: 12, fmt: pctFmt }, { t: "Contra lo esperado (pts)", w: 16, fmt: "0.0" }],
      d.grupos.map(g => { const p = g.meta ? g.apl * 100 / g.meta : null; return [g.titulo, g.meta, g.apl, p == null ? "Sin meta" : p / 100, p == null ? "—" : Math.round((p - d.esperadoPct) * 10) / 10]; }),
      (row, f) => { if (typeof f[4] === "number") row.getCell(5).fill = tonoFill(f[4]); });

    const edades = [];
    d.grupos.forEach(g => g.edades.forEach(e => edades.push([g.titulo, e.edad, e.meta, e.apl, e.meta ? e.apl / e.meta : "Sin meta"])));
    hoja("Por edad", "Detalle por grupo y edad",
      [{ t: "Grupo", w: 52 }, { t: "Edad", w: 22 }, { t: "Meta", w: 12, fmt: "#,##0" }, { t: "Aplicadas", w: 12, fmt: "#,##0" }, { t: "Avance", w: 12, fmt: pctFmt }], edades);

    hoja("Abasto de frascos", "Abasto de frascos", [{ t: "Concepto", w: 46 }, { t: "Valor", w: 20, fmt: "#,##0" }],
      [["Frascos repartidos a las unidades", d.abasto.frascos], ["Dosis repartidas", d.abasto.dosis], ["Dosis aplicadas (unidades con reparto)", d.abasto.apl],
       ["Existencia estimada (dosis)", Math.max(0, d.abasto.dosis - d.abasto.apl)], ["Unidades con reparto registrado", d.abasto.conReparto],
       ["Unidades que aplicaron más de lo repartido", d.abasto.exceden.length]]);

    const rev = [];
    d.sinReporte.forEach(u => rev.push(["No reportó la última semana", u.unidad, u.destino]));
    d.revisar.nunca.forEach(u => rev.push(["Sin ningún reporte en la campaña", u, ""]));
    d.revisar.rebasan.forEach(u => rev.push(["Rebasa su meta en algún grupo", u, ""]));
    d.revisar.sinMeta.forEach(u => rev.push(["Sin meta asignada", u, ""]));
    d.abasto.exceden.forEach(u => rev.push(["Aplicó más de lo repartido", u, ""]));
    hoja("Por revisar", "Unidades por revisar", [{ t: "Motivo", w: 40 }, { t: "Unidad", w: 46 }, { t: "Municipio", w: 20 }], rev.length ? rev : [["Sin pendientes", "", ""]]);

    const buf = await wb.xlsx.writeBuffer();
    const limpio = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const nombre = `Indicadores_Influenza_${limpio(d.campana.replace(/^Campaña Influenza\s*/, ""))}_${limpio(d.ambito)}_${d.fechaCorte}.xlsx`;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast("Excel de indicadores de influenza descargado.", true, "good");
  } catch (err) {
    console.error("Error al exportar indicadores de influenza:", err);
    showToast("No se pudo generar el Excel de influenza.", false, "bad");
  }
}
window.exportInfluenzaIndicadoresExcel = exportInfluenzaIndicadoresExcel;


/**
 * PDF vectorial (texto seleccionable, tablas reales) del tablero de Indicadores de influenza.
 * Usa las mismas cifras que la pantalla y el Excel (window._infIndicadoresDatos). Lo llama generarPDFRobusto
 * (rda_ui.js) cuando el esquema es Meta-Logro Influenza; con `devolverBlob` entrega el Blob (ZIP masivo).
 */
async function influenzaPdfVectorial(jsPDF, nombreArchivo, devolverBlob) {
  const d = window._infIndicadoresDatos;
  if (!d) throw new Error("Abre el tablero de influenza antes de exportar.");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PW = 215.9, PH = 279.4, M = 14, CW = PW - 2 * M, TOP = 16, BOT = PH - 16;
  const fmt = (n) => Math.round(n).toLocaleString("es-MX");
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  // Helvetica estándar solo trae Latin-1: se sustituyen los símbolos que no existen en ella.
  const tx = (s) => String(s == null ? "" : s).replace(/≈/g, "aprox.").replace(/[−–]/g, "-").replace(/[→▸▾]/g, ">").replace(/[^\x00-\xFF]/g, "");
  const corta = (ymd) => (window.InfluenzaReglas ? window.InfluenzaReglas.fechaCorta(ymd) : ymd);
  const largaFecha = (ymd) => String(ymd).split("-").reverse().join("/");
  const COL = { good: [4, 120, 87], warn: [180, 83, 9], bad: [185, 28, 28], none: [71, 85, 105] };
  const FON = { good: [209, 250, 229], warn: [254, 243, 199], bad: [254, 226, 226], none: [241, 245, 249] };
  const tonoDe = (diff) => (diff >= -5 ? "good" : (diff >= -15 ? "warn" : "bad"));
  let y = TOP;

  const nueva = () => { doc.addPage(); y = TOP; };
  const hace = (h) => { if (y + h > BOT) nueva(); };
  const titulo = (t, sub) => {
    hace(16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(15, 23, 42);
    doc.text(tx(t), M, y + 4);
    if (sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139); doc.text(tx(sub), M, y + 9); y += 5; }
    y += 8;
  };
  const barra = (x, yy, w, h, p, tono, marca) => {
    doc.setFillColor(226, 232, 240); doc.roundedRect(x, yy, w, h, h / 2, h / 2, "F");
    const fw = Math.max(p > 0 ? h : 0, Math.min(100, p) / 100 * w);
    if (fw > 0) { doc.setFillColor(...COL[tono]); doc.roundedRect(x, yy, fw, h, h / 2, h / 2, "F"); }
    if (marca != null) { doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.7); const mx = x + Math.min(100, marca) / 100 * w; doc.line(mx, yy - 1.5, mx, yy + h + 1.5); }
  };
  const tabla = (head, body, opts = {}) => {
    // Una tabla que cabe en una página no se parte: si no cabe en lo que queda, pasa completa a la siguiente.
    const estimada = (body.length + (opts.cabeceras || 1)) * 8.4 + 6;
    if (y + estimada > BOT && estimada < BOT - TOP) nueva(); else hace(20);
    doc.autoTable({
      head: opts.headRows || [head.map(tx)], body: body.map(r => r.map(c => (c && typeof c === "object" && !Array.isArray(c) ? { ...c, content: tx(c.content) } : tx(c)))),
      startY: y, margin: { left: M, right: M, top: TOP, bottom: 18 }, theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [30, 41, 59], valign: "middle" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: opts.columnStyles || { 0: { halign: "left", fontStyle: "bold" } },
      didParseCell: opts.didParseCell,
      rowPageBreak: "avoid"
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  // ── Encabezado ──
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PW, 30, "F");
  doc.setFillColor(56, 189, 248); doc.rect(0, 30, PW, 1.2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
  doc.text("SECRETARÍA DE SALUD DEL ESTADO DE QUERÉTARO — JURISDICCIÓN SANITARIA NO. 1", M, 10);
  doc.setFontSize(15); doc.setTextColor(255, 255, 255);
  doc.text(tx(`Meta-Logro de vacunación antiinfluenza ${String(d.campana).replace(/^Campa.a Influenza\s*/i, "")}`), M, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(203, 213, 225);
  doc.text(tx(`${d.ambito}  |  Corte al ${largaFecha(d.fechaCorte)}  |  Emitido ${new Date().toLocaleString("es-MX")}`), M, 25);
  y = 40;

  // ── Avance de la campaña ──
  const tono = tonoDe(d.diff);
  hace(50);
  doc.setFillColor(...FON[tono]); doc.roundedRect(M, y, CW, 42, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  doc.text("AVANCE DE LA CAMPAÑA", M + 6, y + 8);
  doc.setFontSize(34); doc.setTextColor(...COL[tono]);
  doc.text(`${f1(d.pct)}%`, M + 6, y + 24);
  doc.setFontSize(9); doc.text(tx(d.estado), M + 6, y + 32);
  const parrafo = `Se han aplicado ${fmt(d.apl)} de ${fmt(d.meta)} dosis de la meta (aprox. ${fmt(Math.ceil(d.meta / DOSIS_POR_FRASCO))} frascos). `
    + `A esta fecha, con ${d.semanaN} de ${d.totalSemanas} semanas de campaña, se debería llevar ${f1(d.esperadoPct)}%: `
    + (d.diff >= 0 ? `va ${f1(d.diff)} puntos por delante.` : `faltan ${f1(-d.diff)} puntos para ir en ritmo.`);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
  doc.text(doc.splitTextToSize(tx(parrafo), CW - 62), M + 52, y + 9);
  barra(M + 52, y + 27, CW - 62, 5, d.pct, tono, d.esperadoPct);
  doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
  doc.text("0%", M + 52, y + 38);
  doc.text(`La marca es lo esperado a hoy (${f1(d.esperadoPct)}%)`, M + 52 + (CW - 62) / 2, y + 38, { align: "center" });
  doc.text("Meta 100%", M + 52 + CW - 62, y + 38, { align: "right" });
  y += 50;

  // ── Indicadores clave (3 x 2) ──
  const tonoRitmo = d.necesario == null ? "good" : (d.ritmo4 >= d.necesario ? "good" : (d.ritmo4 >= d.necesario * 0.7 ? "warn" : "bad"));
  const tonoProy = d.pctProy == null ? "none" : (d.pctProy >= 100 ? "good" : (d.pctProy >= 85 ? "warn" : "bad"));
  const kpis = [
    ["META DE LA CAMPAÑA", fmt(d.meta), `${fmt(d.unidadesConMeta)} ${d.unidadesConMeta === 1 ? "unidad con meta" : "unidades con meta"}`, "none"],
    ["DOSIS APLICADAS", fmt(d.apl), d.ultimaSemana ? `Corte: semana del ${d.rangoUltimaSemana}` : "Sin semanas vencidas", "none"],
    ["FALTAN POR APLICAR", fmt(d.faltan), `aprox. ${fmt(Math.ceil(d.faltan / DOSIS_POR_FRASCO))} frascos`, "none"],
    ["SEMANA DE CAMPAÑA", `${d.semanaN} de ${d.totalSemanas}`, d.restantes ? `Quedan ${d.restantes} semanas` : "La campaña ya terminó", "none"],
    ["RITMO RECIENTE", `${fmt(d.ritmo4)} dosis/sem`, d.necesario == null ? (d.faltan > 0 ? "Sin semanas restantes" : "Meta cumplida") : `Necesario: ${fmt(d.necesario)} por semana`, tonoRitmo],
    ["PROYECCIÓN AL CIERRE", d.pctProy == null ? "-" : `${f1(d.pctProy)}%`, d.pctProy == null ? "Se calcula con 4 semanas de reportes" : `A este ritmo, ${fmt(d.proyeccion)} dosis`, tonoProy]
  ];
  const kw = (CW - 8) / 3, kh = 22;
  hace(kh * 2 + 14);
  kpis.forEach((k, i) => {
    const x = M + (i % 3) * (kw + 4), yy = y + Math.floor(i / 3) * (kh + 4);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255); doc.roundedRect(x, yy, kw, kh, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(k[0], x + 4, yy + 6);
    doc.setFontSize(14); doc.setTextColor(...(k[3] === "none" ? [15, 23, 42] : COL[k[3]])); doc.text(tx(k[1]), x + 4, yy + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(tx(k[2]), x + 4, yy + 19.5);
  });
  y += kh * 2 + 12;

  // ── Cobertura de reporte y población ──
  titulo("Reporte de la última semana y población");
  const pctCob = d.unidadesConMeta ? d.reportaron * 100 / d.unidadesConMeta : 0;
  const tCob = pctCob >= 90 ? "good" : (pctCob >= 70 ? "warn" : "bad");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
  doc.text(tx(d.ultimaSemana ? `Semana del ${d.rangoUltimaSemana}: ${d.reportaron} de ${d.unidadesConMeta} ${d.unidadesConMeta === 1 ? "unidad reportó" : "unidades reportaron"}.` : "La campaña aún no tiene semanas vencidas."), M, y + 3);
  if (d.ultimaSemana) barra(M, y + 6, CW, 4, pctCob, tCob);
  y += 16;
  const pobl = (t, o) => { const p = o.meta ? o.apl * 100 / o.meta : null; return [t, o.meta ? fmt(o.meta) : "Sin meta", fmt(o.apl), p == null ? "-" : `${f1(p)}%`]; };
  tabla(["Población", "Meta", "Aplicadas", "Avance"], [pobl("Población blanco", d.blanco), pobl("Población de riesgo", d.riesgo)],
    { columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } } });

  // ── Por revisar ──
  const lista = (arr) => arr.slice(0, 8).join(", ") + (arr.length > 8 ? ` y ${arr.length - 8} más` : "");
  const alertas = [];
  if (d.sinReporte.length) alertas.push(`No reportaron la última semana (${d.sinReporte.length}): ${lista(d.sinReporte.map(u => u.unidad))}.`);
  if (d.revisar.nunca.length && d.semanaN >= 2) alertas.push(`Sin ningún reporte en la campaña (${d.revisar.nunca.length}): ${lista(d.revisar.nunca)}.`);
  if (d.revisar.rebasan.length) alertas.push(`Rebasan su meta en algún grupo (${d.revisar.rebasan.length}): ${lista(d.revisar.rebasan)}.`);
  if (d.revisar.sinMeta.length && d.ranking.length) alertas.push(`Unidades activas sin meta asignada (${d.revisar.sinMeta.length}): ${lista(d.revisar.sinMeta)}.`);
  if (d.abasto.exceden.length) alertas.push(`Aplicaron más de lo repartido (${d.abasto.exceden.length}): ${lista(d.abasto.exceden)}.`);
  if (alertas.length) {
    titulo("Por revisar");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 53, 15);
    alertas.forEach(a => {
      const ls = doc.splitTextToSize("- " + tx(a), CW - 4);
      hace(ls.length * 4 + 2);
      doc.text(ls, M + 2, y + 3);
      y += ls.length * 4 + 2;
    });
    y += 4;
  }

  // ── Avance por municipio / unidad ──
  if (d.ranking.length) {
    titulo(`Avance por ${d.porUnidad ? "unidad" : "municipio / hospital"}`, "Primero quienes van más atrasados contra lo esperado");
    tabla([d.porUnidad ? "Unidad" : "Municipio / hospital", "Meta", "Aplicadas", "Avance", "Contra lo esperado", "Último reporte"],
      d.ranking.map(o => [o.nombre + (d.porUnidad ? "" : `  (${o.n} ${o.n === 1 ? "unidad" : "unidades"})`), fmt(o.meta), fmt(o.apl), `${f1(o.p)}%`, `${o.d >= 0 ? "+" : "-"}${f1(Math.abs(o.d))} pts`, o.ultima ? influenzaRangoTexto(o.ultima, d.inicio, d.fin) : "Sin reporte"]),
      { columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 62 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" }, 5: { halign: "center" } },
        didParseCell: (h) => { if (h.section === "body" && h.column.index === 4) { const t = tonoDe(d.ranking[h.row.index].d); h.cell.styles.fillColor = FON[t]; h.cell.styles.textColor = COL[t]; } } });
  }

  // ── Dosis por semana ──
  titulo("Dosis aplicadas por semana", d.necesario != null ? `Línea punteada: ritmo necesario (${fmt(d.necesario)} por semana)` : undefined);
  if (d.semanas.length) {
    const gh = 44, gw = CW - 14, gx = M + 12, gy = y + 2;
    const maxV = Math.max(1, ...d.semanas.map(s => s.dosis), d.necesario || 0);
    hace(gh + 16);
    const gy2 = y + 2;
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.line(gx, gy2 + gh, gx + gw, gy2 + gh); doc.line(gx, gy2, gx, gy2 + gh);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(fmt(maxV), gx - 2, gy2 + 2, { align: "right" }); doc.text("0", gx - 2, gy2 + gh, { align: "right" });
    const paso = gw / d.semanas.length, bw = Math.max(1.2, Math.min(9, paso * 0.7));
    const cada = Math.max(1, Math.ceil(d.semanas.length / 14));
    d.semanas.forEach((s, i) => {
      const bh = s.dosis / maxV * gh, x = gx + i * paso + (paso - bw) / 2;
      doc.setFillColor(124, 58, 237); if (bh > 0) doc.rect(x, gy2 + gh - bh, bw, bh, "F");
      if (i % cada === 0 || i === d.semanas.length - 1) { doc.setFontSize(6.5); doc.setTextColor(100, 116, 139); doc.text(corta(s.desde), x + bw / 2, gy2 + gh + 4, { align: "center" }); }
    });
    if (d.necesario != null) {
      const ny = gy2 + gh - d.necesario / maxV * gh;
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.5); doc.setLineDashPattern([2, 1.5], 0); doc.line(gx, ny, gx + gw, ny); doc.setLineDashPattern([], 0);
    }
    y = gy2 + gh + 10;
    let ac = 0;
    tabla(["Semana", "Dosis", "Acumulado", "% de la meta"], d.semanas.map(s => { ac += s.dosis; return [s.rango, fmt(s.dosis), fmt(ac), `${f1(d.meta ? ac * 100 / d.meta : 0)}%`]; }),
      { columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } } });
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text("La campaña aún no tiene semanas vencidas.", M, y + 3); y += 10;
  }

  // ── Abasto de frascos ──
  titulo("Abasto de frascos", "Lo repartido a las unidades contra lo que han aplicado");
  if (d.abasto.frascos) {
    tabla(["Concepto", "Valor"], [
      ["Frascos repartidos", fmt(d.abasto.frascos)], ["Dosis repartidas", fmt(d.abasto.dosis)],
      ["Dosis aplicadas (unidades con reparto)", fmt(d.abasto.apl)], ["Existencia estimada (dosis)", fmt(Math.max(0, d.abasto.dosis - d.abasto.apl))],
      ["Unidades con reparto registrado", fmt(d.abasto.conReparto)], ["Unidades que aplicaron más de lo repartido", fmt(d.abasto.exceden.length)]
    ], { columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "center" } } });
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text("Todavía no hay reparto de frascos registrado por unidad para este ámbito.", M, y + 3); y += 10;
  }

  // ── Por grupo y por edad ──
  titulo("Avance por grupo de población", "La última columna compara con lo esperado a hoy");
  const filasG = d.grupos.map(g => { const p = g.meta ? g.apl * 100 / g.meta : null; return { g, p, diff: p == null ? null : p - d.esperadoPct }; });
  tabla(["Grupo", "Meta", "Aplicadas", "Avance", "Contra lo esperado"],
    filasG.map(r => [r.g.titulo, fmt(r.g.meta), fmt(r.g.apl), r.p == null ? "Sin meta" : `${f1(r.p)}%`, r.diff == null ? "-" : `${r.diff >= 0 ? "+" : "-"}${f1(Math.abs(r.diff))} pts`])
      .concat([["TOTAL", fmt(d.meta), fmt(d.apl), `${f1(d.pct)}%`, `${d.diff >= 0 ? "+" : "-"}${f1(Math.abs(d.diff))} pts`]]),
    { columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 74 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" } },
      didParseCell: (h) => {
        if (h.section !== "body") return;
        const esTotal = h.row.index === filasG.length;
        const diff = esTotal ? d.diff : filasG[h.row.index].diff;
        if (h.column.index === 4 && diff != null) { const t = tonoDe(diff); h.cell.styles.fillColor = FON[t]; h.cell.styles.textColor = COL[t]; }
        if (esTotal) { h.cell.styles.fontStyle = "bold"; if (h.column.index !== 4) h.cell.styles.fillColor = [241, 245, 249]; }
      } });

  titulo("Detalle por grupo y edad");
  d.grupos.forEach(g => {
    // Cada grupo es su propia tabla (con su título como cabecera): nunca queda un título solo al pie de una página.
    tabla(null, g.edades.map(e => [e.edad, fmt(e.meta), fmt(e.apl), e.meta ? `${f1(e.apl * 100 / e.meta)}%` : "-"]), {
      cabeceras: 2,
      headRows: [
        [{ content: tx(g.titulo), colSpan: 4, styles: { halign: "left", fillColor: [245, 243, 255], textColor: [76, 29, 149], fontStyle: "bold" } }],
        ["Edad", "Meta", "Aplicadas", "Avance"].map(c => ({ content: c, styles: { fillColor: [30, 41, 59], textColor: 255, halign: "center", fontStyle: "bold" } }))
      ],
      columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } }
    });
    y -= 3;
  });

  // ── Nota y pie de página ──
  hace(22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
  const nota = doc.splitTextToSize(tx(`Cómo leerlo: el avance es dosis aplicadas / meta de la campaña (${d.campana}). "Esperado a hoy" es la proporción de la campaña que ya transcurrió; verde si va de 5 puntos de ella, ámbar hasta 15 y rojo si está más atrás. La proyección supone que se mantiene el ritmo de las últimas 4 semanas.`), CW);
  doc.text(nota, M, y + 3);
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(tx(`REPORTE GENERADO EL ${new Date().toLocaleString("es-MX")} - INTELIGENCIA OPERATIVA JS1`), M, PH - 8);
    doc.text(`Página ${i} de ${n}`, PW - M, PH - 8, { align: "right" });
  }
  if (devolverBlob) return doc.output("blob");
  doc.save(nombreArchivo);
  return true;
}
window.influenzaPdfVectorial = influenzaPdfVectorial;

let _editingCampaignId = null;

function renderInfluenzaCampanasTable() {
  const tbody = document.getElementById("influenzaCampanasTableBody");
  if (!tbody) return;

  const infCampanas = _allCampaigns.filter(c => c.nombre && c.nombre.startsWith("Campaña Influenza"));
  if (infCampanas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay campañas registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = infCampanas.map(c => {
    const statusBadge = c.activo 
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">Activo</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">Inactivo</span>';

    const actBtn = c.activo
      ? `<button class="opacity-50 cursor-not-allowed text-[10px] font-black text-slate-400 px-3 py-1.5 rounded-full border border-slate-200" disabled>Activa</button>`
      : `<button onclick="window.activateInfluenzaCampaign('${c.id}')" class="text-[10px] font-black text-violet-700 hover:bg-violet-50 transition-colors px-3 py-1.5 rounded-full border border-violet-200 shadow-sm flex items-center gap-1">
           <span class="material-symbols-rounded text-xs" style="font-size:12px;">check</span> Activar
         </button>`;

    const editBtn = `<button onclick="window.startEditInfluenzaCampaign('${c.id}')" class="text-[10px] font-black text-slate-700 hover:bg-slate-100 transition-colors px-3 py-1.5 rounded-full border border-slate-300 shadow-sm flex items-center gap-1">
                       <span class="material-symbols-rounded text-xs" style="font-size:12px;">edit</span> Editar
                     </button>`;

    return `
      <tr class="border-b border-slate-100 hover:bg-violet-50/10 transition-colors duration-150">
        <td class="p-3 font-bold text-slate-700">${c.nombre}</td>
        <td class="p-3 text-center font-semibold text-slate-600">${c.fecha_inicio}</td>
        <td class="p-3 text-center font-semibold text-slate-600">${c.fecha_fin}</td>
        <td class="p-3 text-center">${statusBadge}</td>
        <td class="p-3 text-right">
          <div class="inline-flex gap-2 justify-end">
            ${editBtn}
            ${actBtn}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.startEditInfluenzaCampaign = (id) => {
  const c = _allCampaigns.find(x => x.id === id);
  if (!c) return;

  _editingCampaignId = c.id;
  
  const startInput = document.getElementById("configFechaInicio");
  const endInput = document.getElementById("configFechaFin");
  const formTitle = document.getElementById("influenzaConfigFormTitle");
  const cancelBtn = document.getElementById("btnCancelInfluenzaConfigEdit");

  if (startInput) startInput.value = c.fecha_inicio;
  if (endInput) endInput.value = c.fecha_fin;
  if (formTitle) formTitle.textContent = `Editando ${c.nombre}`;
  if (cancelBtn) cancelBtn.classList.remove("hidden");
};

window.cancelEditInfluenzaCampaign = () => {
  _editingCampaignId = null;
  
  const startInput = document.getElementById("configFechaInicio");
  const endInput = document.getElementById("configFechaFin");
  const formTitle = document.getElementById("influenzaConfigFormTitle");
  const cancelBtn = document.getElementById("btnCancelInfluenzaConfigEdit");

  if (startInput) startInput.value = _campaignConfig.fecha_inicio || "";
  if (endInput) endInput.value = _campaignConfig.fecha_fin || "";
  if (formTitle) formTitle.textContent = "Establecer Fechas de la Temporada";
  if (cancelBtn) cancelBtn.classList.add("hidden");
};

window.activateInfluenzaCampaign = async (id) => {
  const c = _allCampaigns.find(x => x.id === id);
  if (!c) return;

  await AppService.runCapture({
    btnId: "btnSaveInfluenzaConfig",
    title: "Activando Campaña",
    msg: `Estableciendo ${c.nombre} como la campaña activa de Influenza...`,
    successMsg: `Campaña ${c.nombre} activada correctamente`,
    eventTitle: "Influenza",
    eventMsg: `Activación de campaña ${c.nombre}`,
    action: async () => {
      const res = await AppService.call("saveinfluenza_config", {
        id: c.id,
        fecha_inicio: c.fecha_inicio,
        fecha_fin: c.fecha_fin,
        activo: true
      });

      await loadCampaignConfig();
      await loadInfluenzaAdminData();
      await populateInfluenzaAdminFilters();
      renderActiveAdminSection();
      renderCampaignConfigScreen();
      return res;
    }
  });
};

function actualizarVentanasInfluenza() {
  const box = document.getElementById("influenzaVentanasInfo");
  const ini = document.getElementById("configFechaInicio")?.value;
  const fin = document.getElementById("configFechaFin")?.value;
  if (!box || !window.InfluenzaReglas) return;
  if (!ini || !fin || ini >= fin) { box.style.display = "none"; return; }
  const v = window.InfluenzaReglas.ventanas(ini, fin);
  const L = window.InfluenzaReglas.fechaLarga;
  box.style.display = "block";
  box.innerHTML = `<b>Reglas de dosis calculadas con estas fechas:</b><br>
    • <b>2ª dosis:</b> se captura a partir del <b>${L(v.segundasDesde)}</b> (no hay 2ª dosis en el 1er mes).<br>
    • <b>1ª dosis:</b> se captura hasta el <b>${L(v.primerasHasta)}</b> (no hay 1ª dosis en el último mes).<br>
    Si amplías la clausura, la fecha límite de 1ª dosis se recorre sola.`;
}

function renderCampaignConfigScreen() {
  const startInput = document.getElementById("configFechaInicio");
  const endInput = document.getElementById("configFechaFin");
  const saveBtn = document.getElementById("btnSaveInfluenzaConfig");
  const cancelBtn = document.getElementById("btnCancelInfluenzaConfigEdit");

  if (!startInput || !endInput || !saveBtn) return;

  // Cargar valores iniciales en los inputs si no estamos editando
  if (!_editingCampaignId) {
    startInput.value = _campaignConfig.fecha_inicio || "";
    endInput.value = _campaignConfig.fecha_fin || "";
  }

  // Renderizar la tabla de campañas
  renderInfluenzaCampanasTable();

  // Ventanas de dosis derivadas de las fechas (se actualizan al teclearlas)
  [startInput, endInput].forEach(inp => {
    if (!inp.dataset.ventanas) {
      inp.dataset.ventanas = "1";
      inp.addEventListener("input", actualizarVentanasInfluenza);
      inp.addEventListener("change", actualizarVentanasInfluenza);
    }
  });
  actualizarVentanasInfluenza();

  // Enlazar botón cancelar
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      window.cancelEditInfluenzaCampaign();
    };
  }

  saveBtn.onclick = async () => {
    const startVal = startInput.value;
    const endVal = endInput.value;

    if (!startVal || !endVal) {
      showToast("Por favor selecciona ambas fechas de inicio y fin.", false, "bad");
      return;
    }

    if (new Date(startVal) >= new Date(endVal)) {
      showToast("La fecha de inicio debe ser anterior a la fecha de fin.", false, "bad");
      return;
    }

    const modeText = _editingCampaignId ? "Guardando cambios" : "Creando nueva campaña";
    const modeMsg = _editingCampaignId 
      ? "Actualizando fechas de la campaña seleccionada..."
      : "Creando y registrando nueva campaña de Influenza...";

    await AppService.runCapture({
      btnId: "btnSaveInfluenzaConfig",
      title: modeText,
      msg: modeMsg,
      successMsg: "Fechas de campaña guardadas correctamente",
      eventTitle: "Influenza",
      eventMsg: "Guardado de fechas oficiales de campaña",
      action: async () => {
        let isActivo = false;
        if (_editingCampaignId) {
          const original = _allCampaigns.find(x => x.id === _editingCampaignId);
          if (original && original.activo) {
            isActivo = true;
          }
        } else {
          const activeCamp = _allCampaigns.find(x => x.activo && x.nombre && x.nombre.startsWith("Campaña Influenza"));
          if (!activeCamp) {
            isActivo = true;
          }
        }

        const res = await AppService.call("saveinfluenza_config", {
          id: _editingCampaignId,
          fecha_inicio: startVal,
          fecha_fin: endVal,
          activo: isActivo
        });

        // Limpiar modo edición
        _editingCampaignId = null;
        if (cancelBtn) cancelBtn.classList.add("hidden");
        const formTitle = document.getElementById("influenzaConfigFormTitle");
        if (formTitle) formTitle.textContent = "Establecer Fechas de la Temporada";

        await loadCampaignConfig();
        await loadInfluenzaAdminData();
        await populateInfluenzaAdminFilters();
        
        renderActiveAdminSection();
        renderCampaignConfigScreen();
        
        return res;
      }
    });
  };
}
