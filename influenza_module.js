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
  
  let html = "";
  if (infCampanas.length > 0) {
    html = infCampanas.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join("");
  } else {
    const name = deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin);
    html = `<option value="Campaña Influenza ${name}">Campaña Influenza ${name}</option>`;
  }

  ["influenza_campana", "metaCampaignSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
      if (_selectedCampaign) {
        el.value = _selectedCampaign.nombre;
      }
      
      // Si el wrapper premium ya existe, actualizarlo sin recrearlo (evita el bug de display:none
      // cuando el contenedor padre aún está oculto al momento del rebuild)
      const existingWrapper = document.getElementById(`${id}_custom_wrapper`);
      if (existingWrapper) {
        // Forzar visibilidad del wrapper y actualizar el label del botón
        existingWrapper.style.removeProperty("display");
        existingWrapper.style.display = "inline-block";
        const btn = existingWrapper.querySelector("button > span.truncate");
        if (btn && el.options[el.selectedIndex]) {
          btn.textContent = el.options[el.selectedIndex].text;
        }
        // Actualizar opciones en el panel desplegable
        const optPanel = existingWrapper.querySelector("div");
        if (optPanel) {
          optPanel.innerHTML = "";
          Array.from(el.options).forEach(opt => {
            const item = document.createElement("button");
            item.type = "button";
            item.dataset.value = opt.value;
            item.className = "w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 rounded-full hover:bg-slate-100 transition-colors duration-150" + (opt.value === el.value ? " bg-violet-50 text-violet-700" : "");
            item.textContent = opt.text;
            item.onclick = () => {
              el.value = opt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              optPanel.classList.add("hidden");
              optPanel.style.display = "none";
            };
            optPanel.appendChild(item);
          });
        }
      } else if (window.createPremiumCustomDropdown) {
        // Solo crear desde cero si no existe el wrapper
        window.createPremiumCustomDropdown(el);
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
      // Solo actualizar el label del wrapper premium si ya existe — no recrearlo
      const wrapper = document.getElementById(`${id}_custom_wrapper`);
      if (wrapper) {
        const labelSpan = wrapper.querySelector("button > span.truncate");
        if (labelSpan) labelSpan.textContent = name;
      }
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
    const today = new Date().toISOString().split("T")[0];
    const matchingWeek = weeks.find(w => w.fecha >= today);
    if (matchingWeek) {
      weekSelect.value = matchingWeek.fecha;
    } else {
      weekSelect.value = weeks[weeks.length - 1].fecha;
    }
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
    
    _activeCampaign = infCampanas.find(c => c.activo) || _allCampaigns.find(c => c.activo) || infCampanas[0] || _allCampaigns[0] || null;

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

// Generar semanas epidemiológicas de Influenza
function generateCampaignWeeks() {
  const weeks = [];
  const startStr = _campaignConfig.fecha_inicio || "2025-10-03";
  const endStr   = _campaignConfig.fecha_fin    || "2026-04-25";
  let d = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");

  // Si la campaña ya terminó, generar semanas de la SIGUIENTE campaña
  const today = new Date();
  if (today > end) {
    // Calcular fecha de inicio de la nueva campaña (primer viernes de octubre del año siguiente)
    const nextYear = end.getFullYear() + 1;
    d = new Date(`${nextYear}-10-01T12:00:00`);
    // Avanzar hasta el primer viernes
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    const nextEnd = new Date(`${nextYear + 1}-04-30T12:00:00`);
    while (d <= nextEnd) {
      const ymd = d.toISOString().split('T')[0];
      const weekNum = getISOWeek(d);
      weeks.push({ semana: weekNum, fecha: ymd, label: `Semana ${weekNum} (Viernes ${ymd})` });
      d.setDate(d.getDate() + 7);
    }
    return weeks;
  }

  while (d <= end) {
    const ymd = d.toISOString().split('T')[0];
    const weekNum = getISOWeek(d);
    weeks.push({ semana: weekNum, fecha: ymd, label: `Semana ${weekNum} (Viernes ${ymd})` });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

// Helper para renderizar el Selector de Semanas Premium en el Dropdown
function renderInfluenzaWeekPicker() {
  const dropdown = document.getElementById("influenza_semana_dropdown");
  const hiddenInput = document.getElementById("influenza_semana");
  if (!dropdown || !hiddenInput) return;

  // Ajustar ancho del panel a 360px para dar más espacio a las etiquetas
  dropdown.style.setProperty("width", "360px", "important");

  const weeks = generateCampaignWeeks();
  const today = new Date().toISOString().split("T")[0];

  // Determinar semana epidemiológica actual (la primera futura/actual o la última)
  let currentWeekFecha = null;
  const futureOrCurrentWeeks = weeks.filter(w => w.fecha >= today);
  if (futureOrCurrentWeeks.length) {
    currentWeekFecha = futureOrCurrentWeeks[0].fecha;
  } else if (weeks.length) {
    currentWeekFecha = weeks[weeks.length - 1].fecha;
  }

  dropdown.innerHTML = "";

  weeks.forEach(w => {
    const captureRecord = _influenzaCapturasCache.find(r => r.fecha === w.fecha);
    const isCaptured = !!captureRecord;
    const isSinMov = captureRecord && (captureRecord.sin_movimiento === true || captureRecord.sin_movimiento === 'SI');
    const isCurrent = w.fecha === currentWeekFecha;
    const isFuture = w.fecha > today && !isCurrent;
    
    let statusBadge = "";
    if (isSinMov) {
      statusBadge = `<span style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;" class="shrink-0 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:11px; color: #1d4ed8;">pause_circle</span>Sin Movimiento</span>`;
    } else if (isCaptured) {
      statusBadge = `<span style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;" class="shrink-0 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:11px; color: #047857;">check_circle</span>Capturado</span>`;
    } else if (isFuture) {
      statusBadge = `<span style="background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800;" class="shrink-0">Futuro</span>`;
    } else {
      statusBadge = `<span style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;" class="shrink-0 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:11px; color: #b45309;">error</span>Pendiente</span>`;
    }

    const currentBadge = isCurrent ? `<span style="background-color: #7c3aed; color: #ffffff; text-shadow: 0 1px 1px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.05em; font-size: 8px; font-weight: 900; padding: 1.5px 5px; border-radius: 4px; display: inline-flex; align-items: center; margin-left: 6px; line-height: 1;" class="shrink-0">ACTUAL</span>` : "";
    const isSelected = hiddenInput.value === w.fecha;

    const item = document.createElement("button");
    item.type = "button";
    item.className = `w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all`;

    // Estilos premium explícitos para el selector de semanas
    if (isSelected) {
      item.style.backgroundColor = "#f3e8ff"; // Fondo lavanda/violeta claro
      item.style.borderColor = "#c084fc"; // Borde violeta medio
      item.classList.add("shadow-sm");
    } else {
      item.style.backgroundColor = "transparent";
      item.style.borderColor = "#f1f5f9"; // slate-100
      
      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "#f8fafc"; // slate-50
        item.style.borderColor = "#e2e8f0"; // slate-200
      });
      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
        item.style.borderColor = "#f1f5f9";
      });
    }

    const textStyle = isSelected ? `style="color: #6b21a8; font-weight: 900;"` : `style="color: #1e293b; font-weight: 800;"`;
    const labelStyle = isSelected ? `style="color: #8b5cf6;"` : `style="color: #94a3b8;"`;

    item.innerHTML = `
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-xs shrink-0" ${textStyle}>Semana ${w.semana}</span>
          ${currentBadge}
        </div>
        <span class="text-[10px] mt-0.5 truncate" ${labelStyle}>Corte: ${w.fecha}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${statusBadge}
        ${isSelected ? '<span class="material-symbols-rounded text-xs shrink-0" style="color: #6b21a8; font-weight: 900;">check</span>' : ''}
      </div>
    `;

    item.onclick = (e) => {
      e.stopPropagation();
      hiddenInput.value = w.fecha;
      hiddenInput.dispatchEvent(new Event("change"));
      dropdown.classList.add("hidden");
      dropdown.style.display = "none";
    };

    dropdown.appendChild(item);
  });
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
    
    let statusBadge = "";
    if (isSinMov) {
      statusBadge = `<span class="text-blue-700 bg-blue-50 border border-blue-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:12px;">pause_circle</span>Sin Movimiento</span>`;
    } else if (isCaptured) {
      statusBadge = `<span class="text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:12px;">check_circle</span>Capturado</span>`;
    } else {
      statusBadge = `<span class="text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded text-xs" style="font-size:12px;">error</span>Pendiente</span>`;
    }
    labelSpan.innerHTML = `<span class="font-extrabold text-violet-700">Semana ${selected.semana}</span> <span class="text-slate-400 font-bold">(${selected.fecha})</span> ${statusBadge}`;
  } else {
    labelSpan.innerHTML = `<span class="text-slate-400 font-bold">Seleccionar semana...</span>`;
  }
}

let SIN_MOVIMIENTO_INF = false;

function updateInfluenzaSinMovimientoUI() {
  const chkINF = document.getElementById("chkSinMovimientoINF");
  const cardINF = document.getElementById("cardSinMovimientoINF");
  if (!chkINF || !cardINF) return;

  const selectedFecha = document.getElementById("influenza_semana").value;
  const currentReport = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);

  if (currentReport) {
    cardINF.style.display = "flex";
    const isSinMov = !!(currentReport.sin_movimiento === true || currentReport.sin_movimiento === 'SI');
    chkINF.checked = isSinMov;
    chkINF.disabled = true;
    SIN_MOVIMIENTO_INF = isSinMov;
  } else {
    cardINF.style.display = "flex";
    chkINF.checked = SIN_MOVIMIENTO_INF;
    chkINF.disabled = false;
  }

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
    cardINF.style.borderColor = "#cbd5e1";
    cardINF.style.background = "#ffffff";
    if (iconBg) {
      iconBg.style.background = "#f1f5f9";
      iconBg.style.color = "#64748b";
    }
    if (labelText) labelText.style.color = "#475569";
  }

  // Bloquear selectores principales (Semana y Campaña)
  const isSinMovActive = chkINF.checked;
  const weekBtn = document.getElementById("influenza_semana_btn");
  // El dropdown "premium" custom fue desactivado (createPremiumCustomDropdown es un no-op en
  // main.js); el selector real es el <select id="influenza_campana"> nativo, así que se
  // bloquea directamente en vez de buscar un wrapper que ya no se genera.
  const campSelect = document.getElementById("influenza_campana");

  if (isSinMovActive) {
    if (weekBtn) {
      weekBtn.disabled = true;
      weekBtn.style.opacity = "0.55";
      weekBtn.style.pointerEvents = "none";
    }
    if (campSelect) {
      campSelect.disabled = true;
      campSelect.style.opacity = "0.55";
      campSelect.style.pointerEvents = "none";
    }
  } else {
    if (weekBtn) {
      weekBtn.disabled = false;
      weekBtn.style.opacity = "";
      weekBtn.style.pointerEvents = "";
    }
    if (campSelect) {
      campSelect.disabled = false;
      campSelect.style.opacity = "";
      campSelect.style.pointerEvents = "";
    }
  }
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
  const unitTabs = ["subtabUnitCaptura", "subtabUnitHistorico"];
  unitTabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.onclick = () => {
        unitTabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");

        document.getElementById("secUnitCaptura").style.setProperty("display", "none", "important");
        document.getElementById("secUnitHistorico").style.setProperty("display", "none", "important");

        const targetSec = t.replace("subtabUnit", "secUnit");
        document.getElementById(targetSec).style.setProperty("display", targetSec === "secUnitCaptura" ? "flex" : "block", "important");

        if (typeof syncTabGroupIndicator === 'function') {
          syncTabGroupIndicator('#influenzaUnitTabsContainer');
        }
      };
    }
  });
  
  // Activar pestaña por defecto (Captura de Reporte)
  document.getElementById("subtabUnitCaptura")?.click();
  
  // Forzar visibilidad del wrapper del selector de campaña DESPUÉS de que el panel sea visible.
  // Esto corrige el bug donde createPremiumCustomDropdown se llamó mientras secUnitCaptura
  // aún tenía display:none, lo que causaba que wasOriginallyHidden = true y el wrapper
  // quedaba oculto con display:none !important de forma permanente.
  setTimeout(() => {
    ["influenza_campana", "metaCampaignSelect"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrapper = document.getElementById(`${id}_custom_wrapper`);
      if (wrapper) {
        // Forzar el wrapper a visible (anula cualquier display:none !important puesto durante init)
        wrapper.style.setProperty("display", "inline-block", "important");
        if (el._premiumHiddenBySelf !== false) {
          el._premiumHiddenBySelf = true;
        }
      } else if (window.createPremiumCustomDropdown) {
        // Si no existe aún (raro), crearlo ahora que el panel es visible
        window.createPremiumCustomDropdown(el);
      }
    });
    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator('#influenzaUnitTabsContainer');
    }
  }, 100);

  const weeks = generateCampaignWeeks();
  const weekSelect = document.getElementById("influenza_semana");
  const weekBtn = document.getElementById("influenza_semana_btn");
  const weekDropdown = document.getElementById("influenza_semana_dropdown");

  if (weekSelect && weekBtn && weekDropdown) {
    const today = new Date().toISOString().split("T")[0];
    const matchingWeek = weeks.find(w => w.fecha >= today);
    if (matchingWeek) {
      weekSelect.value = matchingWeek.fecha;
    } else {
      weekSelect.value = weeks[weeks.length - 1].fecha;
    }
    
    // Toggle dropdown
    weekBtn.onclick = (e) => {
      e.stopPropagation();

      // Cerrar otros dropdowns premium estándar abiertos en el DOM
      document.querySelectorAll("[id$=_custom_wrapper] > div").forEach(d => {
        d.classList.add("hidden");
        d.style.display = "none";
        const wrp = d.parentElement;
        if (wrp) {
          wrp.style.zIndex = "";
          if (typeof setParentZIndex === 'function') setParentZIndex(wrp, "");
        }
      });

      const isHidden = weekDropdown.classList.contains("hidden");
      if (isHidden) {
        renderInfluenzaWeekPicker();
        weekDropdown.classList.remove("hidden");
        weekDropdown.style.display = "flex";
      } else {
        weekDropdown.classList.add("hidden");
        weekDropdown.style.display = "none";
      }
    };

    // Cerrar al dar click fuera
    document.addEventListener("click", (e) => {
      if (!weekBtn.contains(e.target) && !weekDropdown.contains(e.target)) {
        weekDropdown.classList.add("hidden");
        weekDropdown.style.display = "none";
      }
    });

    // Enlazar evento change
    weekSelect.removeEventListener("change", renderCaptureGrid);
    weekSelect.addEventListener("change", renderCaptureGrid);
    
    // Auto-actualizar botón y dropdown
    weekSelect.addEventListener("change", (e) => {
      updateInfluenzaWeekBtnLabel(e.target.value);
      updateInfluenzaSinMovimientoUI();
    });
  }

  const chkINF = document.getElementById("chkSinMovimientoINF");
  if (chkINF) {
    chkINF.onchange = () => {
      SIN_MOVIMIENTO_INF = chkINF.checked;
      updateInfluenzaSinMovimientoUI();
      renderCaptureGrid();
    };
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

    // 2. Historial de capturas
    const resCapturas = await AppService.call("getinfluenza_capturas", { clues: USER.clues, anio_campana: campana });
    _influenzaCapturasCache = resCapturas.data || [];

    // 3. Distribución de frascos
    const resFrascos = await AppService.call("getinfluenza_distribucion", { clues: USER.clues });
    _influenzaDistribucionCache = resFrascos.data || [];

    // 📈 4. CONEXIÓN AUTOMÁTICA: Pronóstico de Desabasto
    if (window.StockPredictor) {
      const totalStock = _influenzaDistribucionCache.reduce((acc, curr) => acc + (Number(curr.existencia_dosis) || Number(curr.dosis_restantes) || 0), 0) || 45;
      const historyApplies = _influenzaCapturasCache.map(c => {
        const totalSemana = Object.values(c.valores || {}).reduce((a, b) => a + Number(b || 0), 0);
        return { fecha: c.fecha, dosis: totalSemana };
      });
      window.StockPredictor.renderPredictiveWidget("influenzaStockPredictorContainer", totalStock, historyApplies, USER?.clues);
    }
  } catch (err) {
    console.error("Error al cargar datos de Influenza:", err);
  }
}

function renderCaptureGrid() {
  const container = document.getElementById("influenzaCaptureGroupsContainer");
  if (!container) return;
  container.innerHTML = "";

  const selectedFecha = document.getElementById("influenza_semana").value;
  const currentReport = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);
  const currentValores = currentReport ? currentReport.valores : {};

  // Calcular acumulado previo (excluyendo la semana seleccionada)
  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  // Agrupar rubros por categoría y grupo para una presentación visual limpia y organizada
  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const groupKey = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(rb);
  });

  // Renderizar cada grupo en un panel/tarjeta con fondo blanco sólido
  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100">
        <h4 class="text-xs font-black text-violet-900 uppercase tracking-wider m-0">${groupTitle}</h4>
      </div>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200 bg-white">
        <table class="w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="p-3">Subgrupo / Edad</th>
              <th class="p-3 text-center" style="width: 100px;">Meta Anual</th>
              <th class="p-3 text-center" style="width: 100px;">Acumulado</th>
              <th class="p-3 text-center" style="width: 120px;">Esta Semana</th>
              <th class="p-3 text-center" style="width: 100px;">Avance %</th>
            </tr>
          </thead>
          <tbody class="tbody-inputs">
          </tbody>
        </table>
      </div>
    `;

    const tbody = card.querySelector(".tbody-inputs");

    const chkINF = document.getElementById("chkSinMovimientoINF");
    const isSinMovActive = chkINF && chkINF.checked;

    rubros.forEach(rb => {
      const meta = Number(_influenzaMetasCache[rb.id] || 0);
      const acum = acumuladosPrevios[rb.id];
      const val = isSinMovActive ? 0 : (currentValores[rb.id] !== undefined ? currentValores[rb.id] : "");
      const isLocked = meta === 0 || isSinMovActive;

      const row = document.createElement("tr");

      // Calcular avance inicial
      const currentVal = Number(val || 0);
      const totalDoses = acum + currentVal;
      const pct = meta > 0 ? Math.round((totalDoses / meta) * 100) : 0;
      const cappedPct = Math.min(pct, 100);

      // Semáforo de color
      let barColor, badgeBg, badgeText, badgeBorder;
      if (!meta) {
        barColor = '#cbd5e1'; badgeBg = '#f1f5f9'; badgeText = '#94a3b8'; badgeBorder = '#e2e8f0';
      } else if (pct >= 85) {
        barColor = '#10b981'; badgeBg = '#d1fae5'; badgeText = '#065f46'; badgeBorder = '#6ee7b7';
      } else if (pct >= 50) {
        barColor = '#f59e0b'; badgeBg = '#fef3c7'; badgeText = '#92400e'; badgeBorder = '#fcd34d';
      } else {
        barColor = '#ef4444'; badgeBg = '#fee2e2'; badgeText = '#991b1b'; badgeBorder = '#fca5a5';
      }

      // Estilo de fila inhabilitada
      if (isLocked) {
        row.style.cssText = 'opacity:0.4; pointer-events:none; background: #f8fafc;';
      } else {
        row.className = 'border-b border-slate-100 hover:bg-violet-50/30 transition-all duration-200';
      }

      row.innerHTML = `
        <td class="p-3">
          <span class="text-xs font-semibold ${isLocked ? 'text-slate-400 italic' : 'text-slate-700'}">${rb.edad}</span>
          ${isLocked ? '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#e2e8f0;color:#94a3b8;padding:1px 6px;border-radius:20px;">Sin meta</span>' : ''}
        </td>
        <td class="p-3 text-center font-bold text-slate-600 text-xs">${meta || '—'}</td>
        <td class="p-3 text-center font-bold text-xs" style="color:#6d28d9;">${acum}</td>
        <td class="p-3 text-center">
          <input type="number" min="0" step="1"
            id="input_inf_${rb.id}"
            style="width:70px; text-align:center; font-weight:700; font-size:12px;
              background:${isLocked ? '#f1f5f9' : '#fff'};
              border:1.5px solid ${isLocked ? '#e2e8f0' : '#c4b5fd'};
              border-radius:10px; padding:5px 8px; outline:none;
              cursor:${isLocked ? 'not-allowed' : 'text'};
              transition: border-color 0.2s, box-shadow 0.2s;"
            value="${val}"
            ${isLocked ? 'disabled placeholder="—"' : 'placeholder="0"'}
          >
        </td>
        <td class="p-3" style="min-width:110px;">
          <div style="display:flex; flex-direction:column; align-items:flex-start; gap:3px;">
            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:2px;">
              <span id="pct_inf_${rb.id}" style="
                font-size:10px; font-weight:800;
                background:${badgeBg}; color:${badgeText};
                border:1px solid ${badgeBorder};
                padding:2px 7px; border-radius:20px;
                transition: background 0.3s, color 0.3s;
              ">${meta > 0 ? pct + '%' : 'N/A'}</span>
            </div>
            <div style="width:100%; height:6px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
              <div id="bar_inf_${rb.id}" style="
                height:100%; width:${cappedPct}%;
                background:${barColor};
                border-radius:6px;
                transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1), background 0.3s;
              "></div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(row);

      // Eventos en vivo para validación y avance % con barra
      if (!isLocked) {
        const input  = row.querySelector(`#input_inf_${rb.id}`);
        const pctEl  = row.querySelector(`#pct_inf_${rb.id}`);
        const barEl  = row.querySelector(`#bar_inf_${rb.id}`);

        input.addEventListener("focus", () => {
          input.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.2)';
        });
        input.addEventListener("blur", () => {
          input.style.boxShadow = '';
        });

        input.addEventListener("input", () => {
          let v = parseInt(input.value) || 0;
          if (v < 0) { v = 0; input.value = 0; }

          const total = acum + v;
          const overMeta = total > meta;

          if (overMeta) {
            input.style.borderColor = '#ef4444';
            input.style.background  = '#fee2e2';
          } else {
            input.style.borderColor = '#c4b5fd';
            input.style.background  = '#fff';
          }

          const livePct = Math.round((total / meta) * 100);
          const liveCapped = Math.min(livePct, 100);

          let lBarColor, lBadgeBg, lBadgeText, lBadgeBorder;
          if (livePct >= 85) {
            lBarColor = '#10b981'; lBadgeBg = '#d1fae5'; lBadgeText = '#065f46'; lBadgeBorder = '#6ee7b7';
          } else if (livePct >= 50) {
            lBarColor = '#f59e0b'; lBadgeBg = '#fef3c7'; lBadgeText = '#92400e'; lBadgeBorder = '#fcd34d';
          } else {
            lBarColor = '#ef4444'; lBadgeBg = '#fee2e2'; lBadgeText = '#991b1b'; lBadgeBorder = '#fca5a5';
          }

          pctEl.textContent = `${livePct}%`;
          pctEl.style.background   = lBadgeBg;
          pctEl.style.color        = lBadgeText;
          pctEl.style.borderColor  = lBadgeBorder;
          barEl.style.width        = liveCapped + '%';
          barEl.style.background   = lBarColor;
        });
      }
    });

    container.appendChild(card);
  });
}

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

async function loadInfluenzaHistoryList() {
  const container = document.getElementById("influenzaHistorialList");
  if (!container) return;
  container.innerHTML = "";

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

    const shortId = r.id ? r.id.substring(0, 8).toUpperCase() : "TEMP";
    const dateStr = r.fecha.replace(/-/g, "");
    const folio = `INF-${dateStr}-${shortId}`;
    
    // Construct friendly Spanish date representation for smart search
    let friendlyDate = "";
    if (r.fecha) {
      const parts = r.fecha.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        if (m >= 0 && m < 12) {
          friendlyDate = `${d} de ${monthsEs[m]} de ${y}`;
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

  itemsToDisplay.forEach(p => {
    const r = p.original;
    const folioFormatted = _highlightInfluenzaText(p.folio, queryWords);
    const fechaFormatted = _highlightInfluenzaText(r.fecha, queryWords);
    const friendlyDateFormatted = p.friendlyDate ? _highlightInfluenzaText(p.friendlyDate, queryWords) : "";
    const capturadoFormatted = _highlightInfluenzaText(r.capturado_por || 'Desconocido', queryWords);

    const card = document.createElement("div");
    card.className = "p-5 rounded-2xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer bg-white shadow-sm hover:shadow-md";
    card.style.backgroundColor = "#ffffff";
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
          <span class="material-symbols-rounded text-[22px]">assignment</span>
        </div>
        <div>
          <div class="text-[11px] font-black text-violet-600 mb-1 tracking-wider uppercase">${folioFormatted}</div>
          <div class="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
            <span class="material-symbols-rounded text-slate-400 text-base">calendar_today</span>
            Semana: ${fechaFormatted} ${friendlyDateFormatted ? `<span class="text-xs text-slate-400 font-bold">(${friendlyDateFormatted})</span>` : ''}
          </div>
          <div class="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Dosis: <strong class="text-slate-700">${p.totalDosis}</strong></span>
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Responsable: <strong class="text-slate-700">${capturadoFormatted}</strong></span>
          </div>
        </div>
      </div>
      <button class="bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white transition-all h-[36px] px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1 shrink-0 self-end sm:self-center shadow-sm">
        <span class="material-symbols-rounded text-[18px]">edit</span> Cargar reporte
      </button>
    `;
    card.onclick = () => {
      document.getElementById("influenza_semana").value = r.fecha;
      renderCaptureGrid();
      // Cambiar automáticamente a la pestaña de captura
      document.getElementById("subtabUnitCaptura").click();
      showToast(`Reporte con folio ${p.folio} cargado para edición/consulta.`, true, "info");
    };
    container.appendChild(card);
  });
}

async function saveInfluenzaReport() {
  const selectedFecha = document.getElementById("influenza_semana").value;
  const nombre = document.getElementById("nombreINFLUENZA").value.trim();
  const campana = document.getElementById("influenza_campana").value;

  if (!nombre) {
    showToast("Por favor ingresa el nombre de quien reporta la captura.", false, "bad");
    return;
  }

  // Validaciones del reporte
  const isSinMov = document.getElementById("chkSinMovimientoINF")?.checked || false;
  let hasOverMetaError = false;
  const valores = {};
  
  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`input_inf_${rb.id}`);
    const val = isSinMov ? 0 : (input ? parseInt(input.value) || 0 : 0);
    valores[rb.id] = val;

    if (!isSinMov) {
      // Calcular acumulado
      let acum = 0;
      _influenzaCapturasCache.forEach(r => {
        if (r.fecha !== selectedFecha) {
          acum += Number(r.valores[rb.id] || 0);
        }
      });

      const meta = Number(_influenzaMetasCache[rb.id] || 0);
      if (meta > 0 && (acum + val) > meta) {
        hasOverMetaError = true;
      }
    }
  }

  if (hasOverMetaError) {
    showToast("No se puede guardar el reporte. Uno o más rubros superan la meta asignada.", false, "bad");
    return;
  }

  // Lógica de ventana: Jueves y Viernes
  const d_dow = new Date().getDay();
  // Permitir capturar/editar solo Jueves (4) o Viernes (5)
  if (d_dow !== 4 && d_dow !== 5) {
    showToast("El reporte de Influenza solo se puede capturar los días Jueves o Viernes.", false, "bad");
    return;
  }

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
      await loadInfluenzaUnitData();
      updateInfluenzaWeekBtnLabel(selectedFecha);
      updateInfluenzaSinMovimientoUI();
      renderCaptureGrid();
      loadInfluenzaHistoryList();
      if (typeof confetti === 'function') {
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
  const tabs = ["subtabInfluenzaAvances", "subtabInfluenzaValidacion", "subtabInfluenzaConciliacion", "subtabInfluenzaMetas", "subtabInfluenzaFrascos", "subtabInfluenzaConfig"];
  
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

  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.onclick = () => {
        tabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");

        // Ocultar todas las secciones
        const sections = ["secInfluenzaAvances", "secInfluenzaValidacion", "secInfluenzaConciliacion", "secInfluenzaMetas", "secInfluenzaFrascos", "secInfluenzaConfig"];
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
let _allUnidades = [];

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
    const resFrascos = await AppService.call("getinfluenza_distribucion", {});
    _adminFrascosArray = resFrascos.data || [];
  } catch (err) {
    console.error("Error al cargar datos administrativos de Influenza:", err);
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

  if (advancesTab && advancesTab.classList.contains("active")) {
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
  
  const day = d.getDate();
  const weekIndex = fridays.indexOf(day);
  
  return {
    month: monthName,
    weekNumInMonth: weekIndex >= 0 ? weekIndex + 1 : 1
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

    const response = await fetch("./Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const fechaCorte = document.getElementById("influenza_semana")?.value || new Date().toISOString().split("T")[0];
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];

    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal 2025-2026 - ${USER.unidad} (${USER.clues})`;

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

    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Análisis_Meta_Logro_Influenza_2025-2026_${String(USER.unidad || '').replace(/ /g, "_")}_${fechaCorte}.xlsx`;
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
    
    const response = await fetch("./Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const unitMetaRecord = _adminMetasArray.find(m => m.clues === report.clues);
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal 2025-2026 - ${report.unidad} (${report.clues})`;
      
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
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Análisis_Meta_Logro_Influenza_2025-2026_${report.unidad.replace(/ /g, "_")}_${fecha}.xlsx`;
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
    
    const response = await fetch("./Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());
    
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal 2025-2026 - Concentrado Municipal: ${muni}`;
      
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
    
    ws.getCell('B3').value = `Concentrado Municipal - ${muni} | Campaña: 2025-2026 | Semana Epidemiológica: ${fecha}`;
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
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL'];
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
    trendLabels.push(`Sem. ${weekNum}`);
    
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

  Object.entries(groups).forEach(([groupTitle, rubros]) => {
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

  // Bind weeks options once
  if (!valSemanaSelect.innerHTML.trim()) {
    const weeks = generateCampaignWeeks();
    valSemanaSelect.innerHTML = weeks.map(w => `<option value="${w.fecha}">${w.label}</option>`).join("");
    // Select last week by default or current week
    const today = new Date().toISOString().split("T")[0];
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

  if (backBtn) {
    backBtn.onclick = () => {
      document.getElementById("validationReportContent").classList.add("hidden");
      document.getElementById("validationDashboard").classList.remove("hidden");
      renderValidationDashboard();
    };
  }

  renderValidationDashboard();
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

  // Filter based on search text
  const filteredUnits = muniUnits.filter(u => {
    if (!filterText) return true;
    return u.unidad.toLowerCase().includes(filterText) || u.clues.toLowerCase().includes(filterText);
  });

  // Calculate status statistics
  let totalCount = muniUnits.length;
  let reportedCount = 0;
  let validatedCount = 0;

  grid.innerHTML = "";

  if (filteredUnits.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-sm text-slate-400 font-medium p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">No se encontraron unidades que coincidan con la búsqueda.</div>`;
  }

  filteredUnits.forEach(u => {
    const report = _adminCapturasArray.find(r => r.clues === u.clues && r.fecha === selectedFecha);
    
    let statusBadge = "";
    let actionText = "Cargar y reportar";
    let cardBorder = "border-slate-200 hover:border-violet-300 hover:shadow-md";
    let btnBg = "";
    let btnHoverBg = "";
    let totalDosis = 0;

    if (report) {
      reportedCount++;
      if (report.valores) {
        Object.values(report.valores).forEach(v => totalDosis += Number(v || 0));
      }

      if (report.editado_por !== "UNIDAD") {
        validatedCount++;
        statusBadge = `<span class="bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-0.5"><span class="material-symbols-rounded text-xs">verified</span>Corregido</span>`;
        actionText = "Editar corrección";
        cardBorder = "border-violet-200 hover:border-violet-300 hover:bg-violet-50/10";
        btnBg = "#0f172a";
        btnHoverBg = "#1e293b";
      } else {
        reportedCount; // No-op
        statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-0.5"><span class="material-symbols-rounded text-xs">check_circle</span>Reportado</span>`;
        actionText = "Validar / Corregir";
        cardBorder = "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/10";
        btnBg = "#0f172a";
        btnHoverBg = "#1e293b";
      }
    } else {
      statusBadge = `<span class="bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-0.5"><span class="material-symbols-rounded text-xs">error</span>Pendiente</span>`;
      actionText = "Iniciar captura";
      cardBorder = "border-amber-200 hover:border-amber-300 hover:bg-amber-50/10";
      btnBg = "#0f172a";
      btnHoverBg = "#1e293b";
    }

    const card = document.createElement("div");
    card.className = `p-4 rounded-2xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md cursor-pointer ${cardBorder}`;
    card.style.backgroundColor = "#ffffff";
    card.innerHTML = `
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <span class="material-symbols-rounded text-[22px] text-slate-500">domain</span>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-0.5">${u.clues}</div>
          <h5 class="text-sm font-extrabold text-slate-800 leading-tight truncate" title="${u.unidad}">${u.unidad}</h5>
          <div class="text-xs font-bold text-slate-500 flex items-center gap-1.5 mt-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            Dosis reportadas: <strong class="text-slate-700">${totalDosis}</strong>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-center">
        ${statusBadge}
        <button class="transition-all h-[36px] px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm border-0"
          style="background-color: ${btnBg} !important; color: #ffffff !important; cursor: pointer;"
          onmouseenter="this.style.setProperty('background-color', '${btnHoverBg}', 'important');"
          onmouseleave="this.style.setProperty('background-color', '${btnBg}', 'important');">
          <span class="material-symbols-rounded text-[18px]" style="color: #ffffff !important;">find_in_page</span>
          <span style="color: #ffffff !important;">${actionText}</span>
        </button>
      </div>
    `;

    card.onclick = () => {
      document.getElementById("validationDashboard").classList.add("hidden");
      document.getElementById("validationReportContent").classList.remove("hidden");
      
      const valCluesSelect = document.getElementById("validationInfluenzaClues");
      if (valCluesSelect) valCluesSelect.value = u.clues;

      renderValidacionEdicionGrid(u.clues, selectedFecha);
    };

    grid.appendChild(card);
  });

  if (summary) {
    summary.innerHTML = `
      <span>${reportedCount} de ${totalCount} Reportadas</span>
      <span class="text-slate-300 font-normal">|</span>
      <span class="text-violet-700">${validatedCount} Validadas</span>
    `;
  }
}

function renderValidacionEdicionGrid(clues, fecha) {
  const content = document.getElementById("validationReportContent");
  const title = document.getElementById("validationReportTitle");
  const subtitle = document.getElementById("validationReportSubtitle");
  const badge = document.getElementById("validationReportEditBadge");
  const cardsContainer = document.getElementById("validationCardsContainer");
  const nombreInput = document.getElementById("validationNombreResponsable");

  if (!content || !cardsContainer) return;

  const report = _adminCapturasArray.find(r => r.clues === clues && r.fecha === fecha);
  _currentValidationReport = report;
  nombreInput.value = "";

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
    subtitle.textContent = `Semana: ${report.fecha} | Capturado por: ${report.capturado_por}`;
    
    if (report.editado_por !== "UNIDAD") {
      badge.classList.remove("hidden");
      badge.innerHTML = `<span class="material-symbols-rounded text-xs mr-1">history</span> Corregido por Supervisor (${report.editado_por})`;
    } else {
      badge.classList.add("hidden");
    }
  } else {
    title.textContent = `Sin captura registrada`;
    subtitle.textContent = `No hay un reporte guardado para esta semana. Se creará un nuevo registro.`;
    badge.classList.add("hidden");
  }

  cardsContainer.innerHTML = "";

  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const key = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rb);
  });

  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    let rowsHtml = "";
    rubros.forEach(rb => {
      const meta = Number(metas[rb.id] || 0);
      const acum = acumuladosPrevios[rb.id];
      const val = report && report.valores[rb.id] !== undefined ? report.valores[rb.id] : "";
      const isLocked = meta === 0;

      // Extract original captured value from first edit in history, or fallback to current val
      let originalVal = "—";
      if (report) {
        let hist = [];
        if (report.historial_ediciones) {
          hist = Array.isArray(report.historial_ediciones)
            ? report.historial_ediciones
            : JSON.parse(report.historial_ediciones || "[]");
        }
        if (hist.length > 0 && hist[0].valores_previos && hist[0].valores_previos[rb.id] !== undefined) {
          originalVal = hist[0].valores_previos[rb.id];
        } else {
          originalVal = report.valores[rb.id] !== undefined ? report.valores[rb.id] : "0";
        }
      }

      const currentVal = Number(val || 0);
      const pct = meta > 0 ? Math.round(((acum + currentVal) / meta) * 100) : 0;
      const cappedPct = Math.min(pct, 100);

      let barColor;
      if (!meta) barColor = '#cbd5e1';
      else if (pct >= 85) barColor = '#10b981';
      else if (pct >= 50) barColor = '#f59e0b';
      else barColor = '#ef4444';

      rowsHtml += `
        <tr class="border-b border-slate-100 last:border-0" style="${isLocked ? 'opacity: 0.45; background-color:#f8fafc;' : ''}">
          <td class="p-3 text-xs font-semibold text-slate-700">
            ${rb.edad}
            ${isLocked ? '<span class="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-400">Sin Meta</span>' : ''}
          </td>
          <td class="p-3 text-center text-xs font-bold text-slate-500">${meta || '—'}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-400">${originalVal}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-950">${acum}</td>
          <td class="p-3 text-center">
            <input type="number" min="0" step="1"
              id="val_input_inf_${rb.id}"
              class="w-16 h-8 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              value="${val}"
              ${isLocked ? 'disabled placeholder="—"' : 'placeholder="0"'}
            />
          </td>
          <td class="p-3" style="min-width: 120px;">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between w-full text-[10px] font-black text-slate-500">
                <span>Avance</span>
                <span id="val_pct_inf_${rb.id}">${meta > 0 ? `${pct}%` : 'N/A'}</span>
              </div>
              <div style="width:100%; height:6px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
                <div id="val_bar_inf_${rb.id}" style="width:${cappedPct}%; height:100%; background:${barColor}; border-radius:6px; transition: width 0.3s ease;"></div>
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
              <th class="p-3 text-center">Original (Unidad)</th>
              <th class="p-3 text-center">Logro Previo</th>
              <th class="p-3 text-center">Corrección</th>
              <th class="p-3">Progreso</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    rubros.forEach(rb => {
      const meta = Number(metas[rb.id] || 0);
      if (meta === 0) return;
      const input = card.querySelector(`#val_input_inf_${rb.id}`);
      if (input) {
        input.addEventListener("input", () => {
          const val = parseInt(input.value) || 0;
          const total = acumuladosPrevios[rb.id] + val;
          const pct = Math.round((total / meta) * 100);
          const pctEl = card.querySelector(`#val_pct_inf_${rb.id}`);
          const barEl = card.querySelector(`#val_bar_inf_${rb.id}`);

          if (pctEl) pctEl.textContent = `${pct}%`;
          if (barEl) {
            barEl.style.width = `${Math.min(pct, 100)}%`;
            if (pct >= 85) barEl.style.background = '#10b981';
            else if (pct >= 50) barEl.style.background = '#f59e0b';
            else barEl.style.background = '#ef4444';
          }
        });
      }
    });

    cardsContainer.appendChild(card);
  });

  document.getElementById("btnCancelValidation").onclick = () => {
    content.classList.add("hidden");
    document.getElementById("validationDashboard").classList.remove("hidden");
    renderValidationDashboard();
  };

  document.getElementById("btnSaveValidation").onclick = () => {
    saveValidationReport(clues, fecha);
  };
}

async function saveValidationReport(clues, fecha) {
  const nombreInput = document.getElementById("validationNombreResponsable");
  const nombre = nombreInput ? nombreInput.value.trim() : "";

  if (!nombre) {
    showToast("Por favor, introduce el nombre del supervisor para firmar la corrección.", false, "bad");
    return;
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
  let hasOverMetaError = false;

  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`val_input_inf_${rb.id}`);
    const val = input ? parseInt(input.value) || 0 : 0;
    valores[rb.id] = val;

    const meta = Number(metas[rb.id] || 0);
    const acum = acumuladosPrevios[rb.id];
    if (meta > 0 && (acum + val) > meta) {
      hasOverMetaError = true;
    }
  }

  if (hasOverMetaError) {
    showToast("No se puede guardar. Uno o más rubros superan la meta anual de la unidad.", false, "bad");
    return;
  }

  const unitData = _allUnidades.find(u => u.clues === clues);
  const unidadNombre = unitData ? unitData.unidad : "Unidad Médica";
  const municipio = unitData ? unitData.municipio : USER.municipio;

  let historial = [];
  if (_currentValidationReport && _currentValidationReport.historial_ediciones) {
    historial = Array.isArray(_currentValidationReport.historial_ediciones)
      ? _currentValidationReport.historial_ediciones
      : JSON.parse(_currentValidationReport.historial_ediciones || "[]");
  }
  historial.push({
    fecha_edicion: new Date().toISOString(),
    editado_por: nombre,
    rol: USER.rol,
    valores_previos: _currentValidationReport ? _currentValidationReport.valores : null
  });

  const payload = {
    clues,
    unidad: unidadNombre,
    municipio,
    fecha,
    valores,
    anio_campana: document.getElementById("metaCampaignSelect").value,
    capturado_por: _currentValidationReport ? _currentValidationReport.capturado_por : nombre,
    editado_por: USER.rol.toUpperCase(),
    historial_ediciones: historial
  };

  await AppService.runCapture({
    btnId: "btnSaveValidation",
    title: "Guardando corrección",
    msg: "Registrando la corrección firmada por el supervisor...",
    successMsg: "Reporte de validación guardado correctamente.",
    eventTitle: "Influenza",
    eventMsg: `Edición de reporte de ${unidadNombre} por supervisor ${nombre}`,
    action: async () => {
      const res = await AppService.call("saveinfluenza_captura", payload);
      await loadInfluenzaAdminData();
      document.getElementById("validationReportContent").classList.add("hidden");
      document.getElementById("validationDashboard").classList.remove("hidden");
      renderValidationDashboard();
      if (typeof confetti === 'function') {
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
    
    const response = await fetch("./PLANTILLA REPORTE POR SEMANA.xlsx");
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
    const campana = document.getElementById("influenza_campana")?.value || "2025-2026";
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
    
    const response = await fetch("./PLANTILLA, CONCENTRADO DE INFLUENZA.xlsx");
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
    
    const campana = document.getElementById("influenza_campana")?.value || "2025-2026";
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
    
    const response = await fetch("./PLANTILLA, CONCENTRADO DE INFLUENZA CON UNIDADES O MUNICIPIOS.xlsx");
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
    const campana = document.getElementById("influenza_campana")?.value || "2025-2026";
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

function renderMetasConfigurationGrid() {
  const isMuni = USER.rol === "MUNICIPAL";
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const hints = document.getElementById("secInfluenzaMetasHint");
  const thead = document.getElementById("influenzaMetasThead");
  const tbody = document.getElementById("influenzaMetasTbody");

  tbody.innerHTML = "";

  // Sincronizar el indicador de las subpestañas
  if (typeof syncTabGroupIndicator === 'function') {
    syncTabGroupIndicator('#influenzaAdminTabsContainer');
  }

  if (!isMuni) {
    // Modo ADMIN: Configura metas de los 4 municipios
    hints.textContent = "Modo Administrador: Configura las metas anuales para los 4 municipios. El total jurisdiccional se calcula automáticamente.";
    
    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 280px; min-width: 280px; max-width: 280px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 150px; min-width: 150px; max-width: 150px;">Subgrupo / Edad</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Querétaro</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Corregidora</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">El Marqués</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Huimilpan</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 11%;">Total Jurisd.</th>
      </tr>
    `;

    INFLUENZA_RUBROS.forEach(rb => {
      const metas = {
        "QUERETARO": 0,
        "CORREGIDORA": 0,
        "MARQUES": 0,
        "HUIMILPAN": 0
      };

      _adminMetasArray.forEach(m => {
        if (!m.clues) {
          const name = m.municipio.toUpperCase();
          if (metas[name] !== undefined) {
            metas[name] = m.metas[rb.id] || 0;
          }
        }
      });

      const totalJ = Number(metas["QUERETARO"] || 0) + Number(metas["CORREGIDORA"] || 0) + Number(metas["MARQUES"] || 0) + Number(metas["HUIMILPAN"] || 0);

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 align-middle"><div style="width: 280px; min-width: 280px; max-width: 280px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; font-weight: 600; color: #334155;">${rb.categoria} - ${rb.grupo}</div></td>
        <td class="p-3 align-middle"><div style="width: 150px; min-width: 150px; max-width: 150px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; color: #475569;">${rb.edad}</div></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="QUERETARO" value="${metas["QUERETARO"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="CORREGIDORA" value="${metas["CORREGIDORA"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="MARQUES" value="${metas["MARQUES"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="HUIMILPAN" value="${metas["HUIMILPAN"]}"></td>
        <td class="p-3 text-center font-bold text-slate-800 text-xs align-middle" id="total_j_${rb.id}">${totalJ}</td>
      `;
      tbody.appendChild(row);

      row.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
          let sum = 0;
          row.querySelectorAll("input").forEach(i => sum += parseInt(i.value) || 0);
          document.getElementById(`total_j_${rb.id}`).textContent = sum;
        });
      });
    });

  } else {
    // Modo MUNICIPAL: Desglosa metas municipales a nivel CLUES
    hints.textContent = `Modo Municipal (${selectMuni}): Desglosa tu meta municipal asignada entre las unidades (CLUES).`;
    
    // Obtener unidades del municipio
    const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 280px; min-width: 280px; max-width: 280px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 150px; min-width: 150px; max-width: 150px;">Subgrupo / Edad</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 10%;">Meta Muni</th>
        ${muniUnits.map(u => `<th class="p-3 text-center text-[10px] font-black text-slate-500 uppercase truncate" style="max-width: 90px; min-width: 80px;" title="${u.unidad}">${u.unidad.substring(0, 12)}...</th>`).join("")}
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 10%;">Por Asignar</th>
      </tr>
    `;

    INFLUENZA_RUBROS.forEach(rb => {
      // Meta asignada al municipio
      const muniMetaRec = _adminMetasArray.find(m => !m.clues && m.municipio.toUpperCase() === selectMuni.toUpperCase());
      const muniMeta = muniMetaRec ? (muniMetaRec.metas[rb.id] || 0) : 0;

      // Metas ya asignadas a las CLUES
      const cluesMetas = {};
      muniUnits.forEach(u => {
        const rec = _adminMetasArray.find(m => m.clues === u.clues);
        cluesMetas[u.clues] = rec ? (rec.metas[rb.id] || 0) : 0;
      });

      const totalAsignado = Object.values(cluesMetas).reduce((a, b) => a + b, 0);
      const restante = muniMeta - totalAsignado;

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      
      let inputsHtml = "";
      muniUnits.forEach(u => {
        inputsHtml += `<td class="p-2 text-center"><input type="number" min="0" class="clues-meta-input w-16 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-1 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-clues="${u.clues}" value="${cluesMetas[u.clues]}"></td>`;
      });

      row.innerHTML = `
        <td class="p-3 align-middle"><div style="width: 280px; min-width: 280px; max-width: 280px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; font-weight: 600; color: #334155;">${rb.categoria} - ${rb.grupo}</div></td>
        <td class="p-3 align-middle"><div style="width: 150px; min-width: 150px; max-width: 150px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; color: #475569;">${rb.edad}</div></td>
        <td class="p-3 text-center font-bold text-violet-900 text-xs align-middle" id="muni_meta_${rb.id}">${muniMeta}</td>
        ${inputsHtml}
        <td class="p-3 text-center font-bold text-xs align-middle" id="restante_${rb.id}" style="color: ${restante < 0 ? '#ef4444' : '#64748b'}">${restante}</td>
      `;
      tbody.appendChild(row);

      row.querySelectorAll(".clues-meta-input").forEach(inp => {
        inp.addEventListener("input", () => {
          let sum = 0;
          row.querySelectorAll(".clues-meta-input").forEach(i => sum += parseInt(i.value) || 0);
          const rest = muniMeta - sum;
          const cell = document.getElementById(`restante_${rb.id}`);
          cell.textContent = rest;
          cell.style.color = rest < 0 ? "#ef4444" : "#64748b";
        });
      });
    });
  }

  // Enlazar guardado
  document.getElementById("btnSaveInfluenzaMetas").onclick = async () => {
    await saveInfluenzaMetasConfig();
  };
}

async function saveInfluenzaMetasConfig() {
  const isMuni = USER.rol === "MUNICIPAL";
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const campana = document.getElementById("metaCampaignSelect").value;

  const rows = [];

  if (!isMuni) {
    // Guardar para los 4 municipios
    const munis = ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"];
    munis.forEach(m => {
      const metasObj = {};
      INFLUENZA_RUBROS.forEach(rb => {
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
    });
  } else {
    // Guardar desglose de las CLUES del municipio
    const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    // Validación previa: Que ningún rubro tenga restante negativo
    let hasValidationError = false;
    INFLUENZA_RUBROS.forEach(rb => {
      const muniMetaRec = _adminMetasArray.find(m => !m.clues && m.municipio.toUpperCase() === selectMuni.toUpperCase());
      const muniMeta = muniMetaRec ? (muniMetaRec.metas[rb.id] || 0) : 0;

      let sum = 0;
      muniUnits.forEach(u => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-clues="${u.clues}"]`);
        sum += input ? (parseInt(input.value) || 0) : 0;
      });

      if (sum > muniMeta) {
        hasValidationError = true;
      }
    });

    if (hasValidationError) {
      showToast("Error de validación. La suma asignada a las unidades supera la meta municipal en uno o más rubros.", false, "bad");
      return;
    }

    muniUnits.forEach(u => {
      const metasObj = {};
      INFLUENZA_RUBROS.forEach(rb => {
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
    msg: "Registrando metas de Influenza en la base de datos...",
    successMsg: "Configuración de metas guardada correctamente",
    eventTitle: "Influenza",
    eventMsg: "Actualización de catálogo de metas anuales",
    action: async () => {
      const res = await AppService.call("saveinfluenza_metas", { rows });
      await loadInfluenzaAdminData();
      renderMetasConfigurationGrid();
      if (typeof confetti === 'function') {
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

  // 1. Dosis aplicadas en todo el municipio (acumuladas + reporte actual de todas las unidades)
  let totalDosis = 0;
  
  // Sumamos todos los reportes capturados para este municipio
  _adminCapturasArray.forEach(r => {
    if (r.municipio.toUpperCase() === selectMuni.toUpperCase()) {
      INFLUENZA_RUBROS.forEach(rb => {
        totalDosis += Number(r.valores[rb.id] || 0);
      });
    }
  });

  const frascosAplicados = totalDosis / 10;

  // 2. Frascos entregados en el municipio
  let totalFrascosEntregados = 0;
  _adminFrascosArray.forEach(d => {
    if (d.municipio.toUpperCase() === selectMuni.toUpperCase()) {
      totalFrascosEntregados += Number(d.cantidad_frascos || 0);
    }
  });

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

function renderFrascosDistribution() {
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const tbody = document.getElementById("frascosBatchTbody");
  const historyTbody = document.getElementById("frascosEntregaTbody");

  const deliveryForm = document.getElementById("influenzaFrascosDeliveryForm");
  const historyContainer = document.getElementById("influenzaFrascosHistoryContainer");
  const adminMuniTableContainer = document.getElementById("adminFrascosMunicipalTableContainer");

  if (USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL") {
    // Nivel ADMIN y JURISDICCIONAL: Mostrar resumen municipal consolidado
    if (deliveryForm) deliveryForm.style.setProperty("display", "none", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "none", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "flex", "important");

    const munis = ["QUERETARO", "CORREGIDORA", "MARQUES", "HUIMILPAN"];
    const tbodyMuni = document.getElementById("adminFrascosMunicipalTbody");
    tbodyMuni.innerHTML = "";

    const csvData = [
      ["Municipio", "Frascos Entregados (Total)", "Equivalente en Dosis", "Dosis Aplicadas", "Estimado en Resguardo (Frascos)", "Aprovechamiento %"]
    ];

    munis.forEach(m => {
      // Sumar frascos entregados a este municipio
      let totalFrascos = 0;
      _adminFrascosArray.forEach(d => {
        if (d.municipio.toUpperCase() === m) {
          totalFrascos += Number(d.cantidad_frascos || 0);
        }
      });
      const equivDosis = totalFrascos * 10;

      // Sumar dosis aplicadas en este municipio (en todas las capturas)
      let totalAplicadas = 0;
      _adminCapturasArray.forEach(c => {
        if (c.municipio.toUpperCase() === m) {
          Object.values(c.valores).forEach(v => {
            totalAplicadas += Number(v || 0);
          });
        }
      });

      const resguardo = totalFrascos - (totalAplicadas / 10);
      const pct = equivDosis > 0 ? ((totalAplicadas / equivDosis) * 100).toFixed(1) : "0.0";

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-bold text-slate-700">${m}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-600">${totalFrascos.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${equivDosis.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-violet-950">${totalAplicadas.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-amber-600">${resguardo.toFixed(1)}</td>
        <td class="p-3 text-center text-xs font-bold text-emerald-600">${pct}%</td>
      `;
      tbodyMuni.appendChild(row);

      csvData.push([m, totalFrascos, equivDosis, totalAplicadas, resguardo.toFixed(1), `${pct}%`]);
    });

    const exportBtn = document.getElementById("btnExportFrascosMuni");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + csvData.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Concentrado_Municipal_Frascos_Influenza.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Archivo CSV exportado exitosamente.", true, "good");
      };
    }

  } else {
    // Nivel MUNICIPAL: Mostrar formulario de entrega masiva e historial por unidad
    if (deliveryForm) deliveryForm.style.setProperty("display", "flex", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "flex", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "none", "important");

    if (!tbody || !historyTbody) return;

    // Poner fecha de hoy por defecto en el input
    document.getElementById("frascoFechaInput").value = new Date().toISOString().split("T")[0];
    if (!document.getElementById("frascoEntregaInput").value) {
      document.getElementById("frascoEntregaInput").value = "1";
    }

    // Obtener unidades del municipio
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    // Renderizar tabla de captura masiva
    tbody.innerHTML = "";
    units.forEach(u => {
      // Calcular acumulado previo
      let totalFrascosEntregadosUnit = 0;
      _adminFrascosArray.forEach(d => {
        if (d.clues === u.clues) {
          totalFrascosEntregadosUnit += Number(d.cantidad_frascos || 0);
        }
      });

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-semibold text-slate-700">${u.unidad} <br><span class="text-[10px] text-slate-400 font-normal">${u.clues}</span></td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${totalFrascosEntregadosUnit} frascos (${totalFrascosEntregadosUnit * 10} dosis)</td>
        <td class="p-3 text-center">
          <input type="number" min="0" step="1" 
            id="batch_frascos_${u.clues}"
            class="w-20 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none mx-auto"
            placeholder="0"
          >
        </td>
      `;
      tbody.appendChild(row);
    });

    // Renderizar tabla de historial de entregas del municipio
    historyTbody.innerHTML = "";
    const deliveries = _adminFrascosArray.filter(d => d.municipio.toUpperCase() === selectMuni.toUpperCase());

    if (!deliveries.length) {
      historyTbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-bold">No hay entregas registradas para este municipio.</td></tr>`;
    } else {
      deliveries.forEach(d => {
        const unit = _allUnidades.find(u => u.clues === d.clues);
        const unitName = unit ? unit.unidad : d.clues;

        const row = document.createElement("tr");
        row.className = "border-b border-slate-100 hover:bg-slate-50";
        row.innerHTML = `
          <td class="p-3 text-xs font-semibold text-slate-700">${unitName} <br><span class="text-[10px] text-slate-400 font-normal">${d.clues}</span></td>
          <td class="p-3 text-center text-xs">${d.numero_entrega}</td>
          <td class="p-3 text-center text-xs font-mono text-slate-600">${d.lote || '<span class="text-slate-300">-</span>'}</td>
          <td class="p-3 text-center text-xs">${d.fecha_caducidad || '<span class="text-slate-300">-</span>'}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-900">${d.cantidad_frascos}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-600">${d.cantidad_frascos * 10} dosis</td>
          <td class="p-3 text-center text-xs">${d.fecha_entrega}</td>
          <td class="p-3 text-xs text-slate-500">${d.entregado_por}</td>
        `;
        historyTbody.appendChild(row);
      });
    }

    // Enlazar guardado
    document.getElementById("btnSaveFrascoEntrega").onclick = async () => {
      await saveFrascosDelivery();
    };
  }

  // Actualizar cálculo de frascos municipal
  updateFlaskCalculationMuni();
}

async function saveFrascosDelivery() {
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const num = parseInt(document.getElementById("frascoEntregaInput").value) || 0;
  const fecha = document.getElementById("frascoFechaInput").value;
  const lote = document.getElementById("frascoLoteInput").value.trim().toUpperCase();
  const caducidad = document.getElementById("frascoCaducidadInput").value;

  if (num <= 0 || !fecha) {
    showToast("Por favor ingresa un número de entrega y fecha válidos.", false, "bad");
    return;
  }

  // Buscar todos los inputs que tengan valor mayor que 0
  const units = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
  const deliveriesToSave = [];

  units.forEach(u => {
    const input = document.getElementById(`batch_frascos_${u.clues}`);
    const cantidad = parseInt(input?.value || 0);
    if (cantidad > 0) {
      deliveriesToSave.push({
        clues: u.clues,
        municipio: selectMuni,
        cantidad_frascos: cantidad,
        fecha_entrega: fecha,
        numero_entrega: num,
        lote: lote || null,
        fecha_caducidad: caducidad || null,
        entregado_por: USER.usuario
      });
    }
  });

  if (deliveriesToSave.length === 0) {
    showToast("Ingresa al menos una cantidad mayor a cero para alguna de las unidades.", false, "bad");
    return;
  }

  await AppService.runCapture({
    btnId: "btnSaveFrascoEntrega",
    title: "Registrando entregas",
    msg: `Registrando ${deliveriesToSave.length} entregas de frascos en lote...`,
    successMsg: "Entregas en lote guardadas correctamente",
    eventTitle: "Influenza",
    eventMsg: "Distribución de frascos registrada en lote",
    action: async () => {
      // Guardar todos los registros en un solo insert (atómico: o se guardan todos, o ninguno)
      const res = await AppService.call("saveinfluenza_distribucion", { rows: deliveriesToSave });

      // Limpiar inputs
      units.forEach(u => {
        const input = document.getElementById(`batch_frascos_${u.clues}`);
        if (input) input.value = "";
      });
      document.getElementById("frascoLoteInput").value = "";
      document.getElementById("frascoCaducidadInput").value = "";

      await loadInfluenzaAdminData();
      renderFrascosDistribution();
      return res;
    }
  });
}


// --- ═══════════ INDICADORES — EVALUACIÓN META-LOGRO INFLUENZA ═══════════ ---

async function renderInfluenzaIndicatorsDashboard(muniFilter, uniFilter) {
  const container = document.getElementById("rdaDashboardContent");
  if (!container) return;

  // Determinar la campaña activa dinámicamente (nunca hardcoded, cambia cada temporada)
  const resConfig = await AppService.call("getinfluenza_config");
  const activeCampaignName = resConfig?.data?.nombre
    || `Campaña Influenza ${deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin)}`;

  // Título e info de cierre
  const scopeEl = document.getElementById("rdaScopeLabel");
  if (scopeEl) {
    if (uniFilter) scopeEl.textContent = `Unidad: ${uniFilter}`;
    else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
    else scopeEl.textContent = "Jurisdicción Sanitaria 1";
  }

  const cierreEl = document.getElementById("rdaCierreLabel");
  if (cierreEl) {
    cierreEl.textContent = `Meta-Logro Influenza | ${activeCampaignName}`;
  }

  // 1. Obtener la lista de CLUES a evaluar
  let evalCluesList = [];
  if (uniFilter) {
    evalCluesList = [uniFilter];
  } else {
    // Cargar catálogo de unidades
    const { data: allUnits } = await window.supabase.from("unidades").select("clues, municipio, unidad").eq("activo", "SI");
    const filtered = allUnits.filter(u => !muniFilter || u.municipio.toUpperCase() === muniFilter.toUpperCase());
    evalCluesList = filtered.map(u => u.clues);
  }

  // 2. Fetch metas y capturas de la campaña
  const [resMetas, resCapturas] = await Promise.all([
    AppService.call("getinfluenza_metas", { anio_campana: activeCampaignName }),
    AppService.call("getinfluenza_capturas", { anio_campana: activeCampaignName })
  ]);

  const metasData = resMetas.data || [];
  const capturasData = resCapturas.data || [];

  // Calcular agregados
  let totalMetaDosis = 0;
  let totalDosisAplicadas = 0;
  let totalBlancoMeta = 0;
  let totalBlancoAplicadas = 0;
  let totalRiesgoMeta = 0;
  let totalRiesgoAplicadas = 0;

  evalCluesList.forEach(c => {
    const metaRec = metasData.find(m => m.clues === c);
    const metas = metaRec ? metaRec.metas : {};

    // Sumar metas
    INFLUENZA_RUBROS.forEach(rb => {
      const metaVal = Number(metas[rb.id] || 0);
      totalMetaDosis += metaVal;
      if (rb.categoria.includes("blanca")) totalBlancoMeta += metaVal;
      else totalRiesgoMeta += metaVal;
    });

    // Sumar capturas
    const unitCapturas = capturasData.filter(r => r.clues === c);
    unitCapturas.forEach(r => {
      INFLUENZA_RUBROS.forEach(rb => {
        const valVal = Number(r.valores[rb.id] || 0);
        totalDosisAplicadas += valVal;
        if (rb.categoria.includes("blanca")) totalBlancoAplicadas += valVal;
        else totalRiesgoAplicadas += valVal;
      });
    });
  });

  const pctTotal = totalMetaDosis > 0 ? Math.round((totalDosisAplicadas / totalMetaDosis) * 100) : 0;
  const pctBlanco = totalBlancoMeta > 0 ? Math.round((totalBlancoAplicadas / totalBlancoMeta) * 100) : 0;
  const pctRiesgo = totalRiesgoMeta > 0 ? Math.round((totalRiesgoAplicadas / totalRiesgoMeta) * 100) : 0;

  // Inyectar HTML en el contenedor de indicadores
  container.innerHTML = `
    <!-- KPI Cards Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-bottom: 32px;">
      
      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #f0f9ff; color: #0284c7;">
          <span class="material-symbols-rounded">child_care</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Población Blanco</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctBlanco >= 85 ? '#059669' : pctBlanco >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctBlanco}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalBlancoAplicadas.toLocaleString('es-MX')} de ${totalBlancoMeta.toLocaleString('es-MX')} dosis</div>
      </div>

      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #f5f3ff; color: #7c3aed;">
          <span class="material-symbols-rounded">warning</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Población de Riesgo</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctRiesgo >= 85 ? '#059669' : pctRiesgo >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctRiesgo}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalRiesgoAplicadas.toLocaleString('es-MX')} de ${totalRiesgoMeta.toLocaleString('es-MX')} dosis</div>
      </div>

      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #fdf2f8; color: #db2777;">
          <span class="material-symbols-rounded">vaccines</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Total Campaña</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctTotal >= 85 ? '#059669' : pctTotal >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctTotal}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalDosisAplicadas.toLocaleString('es-MX')} de ${totalMetaDosis.toLocaleString('es-MX')} dosis</div>
      </div>

    </div>

    <!-- Tabla Detallada por Rubro -->
    <div class="bg-surface rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden">
      <h3 class="text-sm font-extrabold text-slate-700 mb-4 uppercase tracking-wider">Desglose de Meta-Logro por Rubro</h3>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200">
        <table class="w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider">Subgrupo / Edad</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center" style="width: 120px;">Meta Total</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center" style="width: 120px;">Aplicadas</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center" style="width: 120px;">Avance %</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              // Group rubros by category & group
              const grouped = {};
              INFLUENZA_RUBROS.forEach(rb => {
                const key = `${rb.categoria} - ${rb.grupo}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(rb);
              });

              return Object.entries(grouped).map(([groupTitle, rubros]) => {
                const headerRow = `
                  <tr class="bg-slate-50 border-b border-slate-200">
                    <td colspan="4" class="p-3 bg-violet-50/50">
                      <div class="text-xs font-black text-violet-950 uppercase tracking-wider" style="max-width: 600px; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35;" title="${groupTitle}">${groupTitle}</div>
                    </td>
                  </tr>
                `;
                
                const rows = rubros.map(rb => {
                  let rMeta = 0;
                  let rAplicadas = 0;

                  evalCluesList.forEach(c => {
                    const metaRec = metasData.find(m => m.clues === c);
                    rMeta += metaRec ? Number(metaRec.metas[rb.id] || 0) : 0;

                    const unitCapturas = capturasData.filter(r => r.clues === c);
                    unitCapturas.forEach(r => {
                      rAplicadas += Number(r.valores[rb.id] || 0);
                    });
                  });

                  const rPct = rMeta > 0 ? Math.round((rAplicadas / rMeta) * 100) : 0;
                  let progressColor = "text-slate-700";
                  let progressBg = "bg-slate-100";
                  if (rMeta > 0) {
                    if (rPct >= 85) { progressColor = "text-emerald-800"; progressBg = "bg-emerald-100"; }
                    else if (rPct >= 50) { progressColor = "text-amber-800"; progressBg = "bg-amber-100"; }
                    else { progressColor = "text-rose-800"; progressBg = "bg-rose-100"; }
                  }

                  return `
                    <tr class="border-b border-slate-100 hover:bg-violet-50/10 transition-colors duration-150">
                      <td class="p-3 pl-6 font-semibold text-slate-700 max-w-[400px] whitespace-normal break-words">${rb.edad}</td>
                      <td class="p-3 text-center font-bold text-slate-600">${rMeta.toLocaleString('es-MX')}</td>
                      <td class="p-3 text-center font-bold text-violet-900">${rAplicadas.toLocaleString('es-MX')}</td>
                      <td class="p-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold ${progressColor} ${progressBg}">${rMeta > 0 ? `${rPct}%` : 'N/A'}</span>
                      </td>
                    </tr>
                  `;
                }).join("");

                return headerRow + rows;
              }).join("");
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

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
          const activeCamp = _allCampaigns.find(x => x.activo);
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
