/**
 * param_calculator.js — Consola Paramétrica de Unidades de Salud (SIREVAQ)
 * Módulo autónomo de gestión e in-line editing de Mínimos, Máximos y Promedios por unidad.
 * Conectado en tiempo real con la tabla `biologicos_params` y el histórico de productividades `SIS`.
 */

// Estado global exclusivo del módulo de parámetros
window._spmUnitsList = [];
window._spmParamsMap = {}; // Clave: `${clues}|${biologico}` -> objeto parámetro
window._spmActiveClues = null;
window._spmUserRole = null;
window._spmUserMunis = []; // Municipios permitidos para el usuario actual
window._spmPendingCalcRecords = null; // Registros calculados pendientes de confirmar (vista previa)

// Identificador legible del usuario actual, para auditoría (updated_by)
window.spmGetCurrentUsername = function() {
    const u = window.USER || {};
    return u.usuario || u.nombre || u.email || 'Desconocido';
};

// Lista oficial de 12 biológicos en orden estándar de la cartilla / catálogo
const OFFICIAL_BIO_ORDER = [
    "BCG",
    "HEPATITIS B",
    "HEXAVALENTE",
    "DPT",
    "ROTAVIRUS",
    "NEUMOCOCICA 13", // Sin acento: coincide con el valor real guardado en biologicos_params.biologico
    "SRP",
    "SR",
    "VPH",
    "VARICELA",
    "HEPATITIS A",
    "TD",
    "TDPA",
    "INFLUENZA"
];

// Mapeo de variables SIS por vacuna para la Calculadora Admin: fuente única en la tabla
// `biologico_sis_variable_mapping` de Supabase (antes vivía hardcodeado aquí, duplicado
// del que necesita el motor SQL de reabasto -- dos copias independientes de la misma lista
// es justo el tipo de cosa que se desincroniza sin que nadie lo note). Se carga una vez por
// sesión de panel; ver spmLoadBioSisMapping().
window._spmBioSisMapping = null;

window.spmLoadBioSisMapping = async function() {
    if (window._spmBioSisMapping) return window._spmBioSisMapping;

    const { data, error } = await window.supabase
        .from('biologico_sis_variable_mapping')
        .select('biologico, variable_sis');

    if (error) {
        console.error("[param_calculator] No se pudo cargar biologico_sis_variable_mapping:", error);
        if (typeof showToast === 'function') {
            showToast("No se pudo cargar el mapeo Biológico↔SIS. La Calculadora Admin no puede calcular sin él.", false, 'bad');
        }
        return {};
    }

    const mapping = {};
    (data || []).forEach(row => {
        if (!mapping[row.biologico]) mapping[row.biologico] = [];
        mapping[row.biologico].push(row.variable_sis);
    });

    window._spmBioSisMapping = mapping;
    return mapping;
};

// Cantidad de dosis estándar por frasco para cada biológico
// Multidosis (10 dosis/frasco): BCG, HEPATITIS B, DPT, SR, TD — el resto es monodosis (1)
const DEFAULT_DOSES_PER_BOTTLE = {
    "BCG": 10, "HEPATITIS B": 10, "HEXAVALENTE": 1, "DPT": 10,
    "ROTAVIRUS": 1, "NEUMOCÓCICA 13": 1, "NEUMOCOCICA 13": 1,
    "SRP": 1, "SR": 10, "VPH": 1, "VARICELA": 1, "HEPATITIS A": 1,
    "TD": 10, "TDPA": 1, "TDPa": 1, "INFLUENZA": 10, "VSR": 1
};

// 1. INICIALIZADOR PRINCIPAL DE LA CONSOLA CON CONTROL ESTRICTO DE ROLES
window.initConsoleParametros = async function() {
    // Supabase v2: auth.user() was removed — use getUser() async or window.USER global
    let user = window.USER || {};
    if (!user.rol && !user.role) {
        try {
            const { data } = await window.supabase.auth.getUser();
            user = data?.user || {};
        } catch (_) { /* no session */ }
    }
    const roleRaw = (user.rol || user.role || "").toUpperCase();
    const userEmail = (user.email || "").toLowerCase();

    // Denegar acceso a perfiles no autorizados (Visualizador y Caravanas)
    if (roleRaw.includes("VISUALIZADOR") || roleRaw.includes("CARAVANA")) {
        const container = document.getElementById('adminSection_parametros');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; margin-top: 20px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🚫</div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">Acceso Restringido</h3>
                    <p style="margin-top: 6px; font-size: 13px; color: #64748b;">Tu perfil no tiene permisos para consultar ni editar los parámetros de las unidades de salud.</p>
                </div>
            `;
        }
        return;
    }

    window._spmUserRole = roleRaw;

    // Determinar municipios permitidos según perfil
    let allowedMunis = [];
    if (roleRaw.includes("ADMIN") || roleRaw.includes("JURISDICCIONAL") || roleRaw.includes("ESTATAL")) {
        allowedMunis = null; // Todos los municipios
    } else {
        // Usar municipiosAllowed del objeto USER (ya gestiona casos multi-municipio)
        const muniAllowed = Array.isArray(user.municipiosAllowed) ? user.municipiosAllowed : [];
        if (muniAllowed.includes("*")) {
            allowedMunis = null;
        } else if (muniAllowed.length > 0) {
            allowedMunis = muniAllowed;
        } else if (user.municipio) {
            // Soporte para municipios separados por coma/punto y coma
            allowedMunis = String(user.municipio).split(/[;,]/).map(m => m.trim()).filter(Boolean);
        } else {
            allowedMunis = [];
        }
    }
    window._spmUserMunis = allowedMunis;

    // Ajustar visibilidad del selector de municipios
    const muniSelect = document.getElementById('spmParamMuniSelect');
    if (muniSelect) {
        if (allowedMunis === null) {
            muniSelect.disabled = false;
        } else {
            muniSelect.disabled = (allowedMunis.length <= 1);
        }
    }

    // Ocultar botón de Calculadora Admin si no es Admin o Jurisdiccional.
    // .spm-btn-icon-custom fija "display: inline-flex !important" en CSS, así que un
    // style.display normal (sin prioridad) no lo tapa — hay que igualar la prioridad con
    // setProperty(..., 'important') o el botón se queda visible/clickeable para Municipal.
    const btnAdminCalc = document.getElementById('spmBtnAdminCalc');
    if (btnAdminCalc) {
        btnAdminCalc.style.setProperty('display', (roleRaw.includes("ADMIN") || roleRaw.includes("JURISDICCIONAL")) ? "inline-flex" : "none", "important");
    }
    const bufferWrap = document.getElementById('spmBufferPctWrap');
    if (bufferWrap) {
        bufferWrap.style.setProperty('display', (roleRaw.includes("ADMIN") || roleRaw.includes("JURISDICCIONAL")) ? "flex" : "none", "important");
    }
    const btnSugerencias = document.getElementById('spmBtnSugerencias');
    if (btnSugerencias) {
        btnSugerencias.style.setProperty('display', (roleRaw.includes("ADMIN") || roleRaw.includes("JURISDICCIONAL")) ? "inline-flex" : "none", "important");
    }

    await window.spmLoadAllData();
};

// 2. CARGAR UNIDADES Y PARÁMETROS REALES DESDE SUPABASE
window.spmLoadAllData = async function() {
    if (typeof showOverlay === 'function') {
        showOverlay("Cargando parámetros de la base de datos...", "Parámetros de Salud");
    }

    try {
        // Cargar unidades activas
        let queryUnits = window.supabase
            .from('unidades')
            .select('clues, unidad, municipio')
            .eq('activo', 'SI')
            .order('municipio')
            .order('unidad');

        if (window._spmUserMunis !== null && window._spmUserMunis.length > 0) {
            queryUnits = queryUnits.in('municipio', window._spmUserMunis);
        }

        const { data: unitsData, error: errUnits } = await queryUnits;
        if (errUnits) throw errUnits;

        window._spmUnitsList = unitsData || [];

        // Cargar parámetros existentes en biologicos_params (paginado: Supabase corta las
        // consultas sin .range() en ~1000 filas por defecto, y esta tabla ya tiene más de eso —
        // sin paginar, las unidades cuyas filas caían después del corte se veían vacías/en cero
        // en el panel aunque sus datos sí existieran en la base).
        let paramsData = [];
        let pFrom = 0;
        const pStep = 1000;
        let pHasMore = true;
        while (pHasMore) {
            const { data: pChunk, error: errParams } = await window.supabase
                .from('biologicos_params')
                .select('*')
                .range(pFrom, pFrom + pStep - 1);

            if (errParams) throw errParams;

            if (pChunk && pChunk.length > 0) {
                paramsData = paramsData.concat(pChunk);
                pFrom += pStep;
                if (pChunk.length < pStep) pHasMore = false;
            } else {
                pHasMore = false;
            }
        }

        // Mapear parámetros por clave `${clues}|${biologico}`
        window._spmParamsMap = {};
        (paramsData || []).forEach(p => {
            const bioNorm = (p.biologico || "").toUpperCase().trim();
            window._spmParamsMap[`${p.clues}|${bioNorm}`] = p;
        });

        // Poblar Selector de Municipios
        window.spmPopulateMuniSelect();

        // Filtrar y renderizar lista de unidades
        const selectedMuni = document.getElementById('spmParamMuniSelect')?.value || "";
        window.spmFilterUnitsByMuni(selectedMuni);

    } catch (e) {
        console.error("Error al cargar datos en módulo de parámetros:", e);
        if (typeof showToast === 'function') {
            showToast("Error al cargar parámetros: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// 3. POBLAR SELECTOR DE MUNICIPIOS
window.spmPopulateMuniSelect = function() {
    const select = document.getElementById('spmParamMuniSelect');
    if (!select) return;

    const munis = Array.from(new Set(window._spmUnitsList.map(u => u.municipio))).filter(Boolean).sort();
    
    let html = '';
    if (window._spmUserMunis === null) {
        html += `<option value="">Todos los Municipios (${munis.length})</option>`;
    }
    
    munis.forEach(m => {
        const count = window._spmUnitsList.filter(u => u.municipio === m).length;
        html += `<option value="${m}">Municipio: ${m} (${count} Unidades)</option>`;
    });

    select.innerHTML = html;
};

// 4. FILTRAR Y RENDERIZAR LISTA LATERAL DE UNIDADES
window.spmFilterUnitsByMuni = function(muni) {
    const container = document.getElementById('spmUnitsListContainer');
    if (!container) return;

    let filtered = window._spmUnitsList;
    if (muni) {
        filtered = filtered.filter(u => u.municipio === muni);
    }

    let reviewedCount = 0;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No hay unidades registradas.</div>`;
        window.spmRenderUnitMatrix(null);
        return;
    }

    const html = filtered.map(u => {
        // Verificar si la unidad tiene al menos un parámetro guardado en la BD
        const hasParams = OFFICIAL_BIO_ORDER.some(bio => window._spmParamsMap[`${u.clues}|${bio}`]);
        if (hasParams) reviewedCount++;

        const isDotClass = hasParams ? "spm-dot-reviewed" : "spm-dot-pending";
        const dotTitle = hasParams ? "Guardado en BD" : "Pendiente de revisión";
        const activeClass = (u.clues === window._spmActiveClues) ? "active" : "";

        return `
            <div class="spm-unit-card-item ${activeClass}" data-clues="${u.clues}" onclick="window.spmSelectUnit('${u.clues}')">
                <div class="spm-unit-item-title">${u.unidad}</div>
                <span class="spm-status-dot ${isDotClass}" title="${dotTitle}"></span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Actualizar contador de progreso
    const counterEl = document.getElementById('spmUnitsProgressCounter');
    if (counterEl) {
        counterEl.textContent = `${reviewedCount} / ${filtered.length} Rev.`;
    }

    // Seleccionar automáticamente la primera unidad si no hay selección activa
    const firstClues = filtered[0]?.clues;
    if (firstClues && (!window._spmActiveClues || !filtered.some(u => u.clues === window._spmActiveClues))) {
        window.spmSelectUnit(firstClues);
    }
};

// 5. SELECCIONAR UNA UNIDAD Y MOSTRAR SUS 12 BIOLÓGICOS
window.spmSelectUnit = function(clues) {
    window._spmActiveClues = clues;

    // Resaltar elemento activo en la lista lateral
    document.querySelectorAll('.spm-unit-card-item').forEach(el => {
        el.classList.toggle('active', el.dataset.clues === clues);
    });

    const unitObj = window._spmUnitsList.find(u => u.clues === clues);
    if (!unitObj) return;

    // Actualizar Encabezado del Editor
    document.getElementById('spmActiveUnitName').textContent = unitObj.unidad;
    
    const hasParams = OFFICIAL_BIO_ORDER.some(bio => window._spmParamsMap[`${clues}|${bio}`]);
    const activeDot = document.getElementById('spmActiveUnitDot');
    if (activeDot) {
        activeDot.className = `spm-status-dot ${hasParams ? 'spm-dot-reviewed' : 'spm-dot-pending'}`;
    }

    window.spmRenderUnitMatrix(unitObj);
};

// 6. RENDERIZAR MATRIZ DE EDICIÓN DE BIOLÓGICOS PARA LA UNIDAD SELECCIONADA
window.spmRenderUnitMatrix = function(unit) {
    const tbody = document.getElementById('spmMatrixTbody');
    if (!tbody) return;

    if (!unit) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color:#64748b; font-size:13px;">Selecciona una unidad para editar sus parámetros.</td></tr>`;
        return;
    }

    const html = OFFICIAL_BIO_ORDER.map((bio, idx) => {
        const key = `${unit.clues}|${bio}`;
        const p = window._spmParamsMap[key] || {};

        const minVal = p.min_dosis !== undefined ? p.min_dosis : 0;
        const maxVal = p.max_dosis !== undefined ? p.max_dosis : 0;
        const promVal = p.promedio_frascos !== undefined ? p.promedio_frascos : 0;

        const idxStr = String(idx + 1).padStart(2, '0');

        return `
            <tr data-bio="${bio}">
                <td><span class="spm-bio-idx-badge">${idxStr}</span></td>
                <td><span class="spm-bio-name-lbl">${bio}</span></td>
                <td>
                    <input type="number" class="spm-input-num-clean spm-inp-prom" data-bio="${bio}" value="${promVal}" min="0">
                </td>
                <td>
                    <input type="number" class="spm-input-num-clean spm-inp-min" data-bio="${bio}" value="${minVal}" min="0">
                </td>
                <td>
                    <input type="number" class="spm-input-num-clean spm-inp-max" data-bio="${bio}" value="${maxVal}" min="0">
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;

    const dbStatusText = document.getElementById('spmDbStatusText');
    if (dbStatusText) {
        dbStatusText.innerHTML = `Estado: <strong>Guardado en la base de datos</strong>`;
    }

    // Auditoría: mostrar quién y cuándo modificó por última vez algún biológico de esta unidad
    window.spmRenderLastUpdatedInfo(unit);
};

// 6b. MOSTRAR QUIÉN/CUÁNDO FUE LA ÚLTIMA MODIFICACIÓN DE LA UNIDAD (AUDITORÍA)
window.spmRenderLastUpdatedInfo = function(unit) {
    const updatedEl = document.getElementById('spmLastUpdatedText');
    if (!updatedEl || !unit) return;

    let latest = null;
    OFFICIAL_BIO_ORDER.forEach(bio => {
        const p = window._spmParamsMap[`${unit.clues}|${bio}`];
        if (p && p.updated_at) {
            const t = new Date(p.updated_at).getTime();
            if (!latest || t > latest.time) {
                latest = { time: t, updated_at: p.updated_at, updated_by: p.updated_by };
            }
        }
    });

    if (!latest) {
        updatedEl.textContent = 'Última modificación: sin registro de auditoría';
        return;
    }

    const dt = new Date(latest.time);
    const dateStr = dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const who = latest.updated_by || 'usuario no registrado';
    updatedEl.textContent = `Última modificación: ${dateStr} ${timeStr} por ${who}`;
};

// 7. GUARDAR CAMBIOS DE LA UNIDAD EN SUPABASE (UPSERT A `biologicos_params`)
window.spmSaveCurrentUnitParams = async function() {
    if (!window._spmActiveClues) {
        if (typeof showToast === 'function') showToast("Selecciona una unidad primero", false, "warn");
        return;
    }

    const unitObj = window._spmUnitsList.find(u => u.clues === window._spmActiveClues);
    if (!unitObj) return;

    const tbody = document.getElementById('spmMatrixTbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-bio]');
    const recordsToUpsert = [];

    rows.forEach(tr => {
        const bio = tr.dataset.bio;
        const promInput = tr.querySelector('.spm-inp-prom');
        const minInput = tr.querySelector('.spm-inp-min');
        const maxInput = tr.querySelector('.spm-inp-max');

        const promVal = parseInt(promInput.value, 10) || 0;
        const minVal = parseInt(minInput.value, 10) || 0;
        const maxVal = parseInt(maxInput.value, 10) || 0;

        const defaultMultiplo = DEFAULT_DOSES_PER_BOTTLE[bio.toUpperCase()] || 1;

        recordsToUpsert.push({
            clues: unitObj.clues,
            unidad: unitObj.unidad || 'Unidad',
            municipio: unitObj.municipio || '*',
            biologico: bio,
            promedio_frascos: promVal,
            min_dosis: minVal,
            max_dosis: maxVal,
            multiplo_pedido: defaultMultiplo,
            activo: 'SI',
            updated_by: window.spmGetCurrentUsername(),
            updated_at: new Date().toISOString()
        });
    });

    if (typeof showOverlay === 'function') {
        showOverlay(`Guardando parámetros de ${unitObj.unidad}...`, "Guardado de Parámetros");
    }

    try {
        const { error } = await window.supabase
            .from('biologicos_params')
            .upsert(recordsToUpsert, { onConflict: 'clues,biologico' });

        if (error) throw error;

        // Actualizar caché local
        recordsToUpsert.forEach(p => {
            window._spmParamsMap[`${p.clues}|${p.biologico}`] = p;
        });

        const statusEl = document.getElementById('spmDbStatusText');
        if (statusEl) {
            statusEl.innerHTML = `Estado: <strong style="color:#10b981;">Guardado en la base de datos</strong>`;
        }

        window.spmRenderLastUpdatedInfo(unitObj);

        // Refrescar lista lateral para actualizar punto verde de revisión
        window.spmFilterUnitsByMuni(document.getElementById('spmParamMuniSelect')?.value || "");

        if (typeof showToast === 'function') {
            showToast(`¡Parámetros de ${unitObj.unidad} guardados con éxito!`, true, 'good');
        }

    } catch (e) {
        console.error("Error al guardar parámetros:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar en base de datos: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// 8. CALCULADORA ADMIN MASIVA DESDE HISTÓRICO SIS (CON AÑO EN CURSO Y MESES CARGADOS REALES + 10% COLCHÓN TÉCNICO)
/** Alterna entre el input de "% Colchón" y el selector de "Nivel de servicio" según el modo elegido. */
window.spmToggleCalcMode = function() {
    const mode = document.getElementById('spmCalcMode')?.value;
    const colchonWrap = document.getElementById('spmColchonInputWrap');
    const serviceWrap = document.getElementById('spmServiceLevelWrap');
    const leadTimeWrap = document.getElementById('spmLeadTimeWrap');
    const usesServiceLevel = (mode === 'nivel_servicio' || mode === 'reabasto_inteligente');
    if (colchonWrap) colchonWrap.style.display = usesServiceLevel ? 'none' : 'flex';
    if (serviceWrap) serviceWrap.style.display = usesServiceLevel ? 'flex' : 'none';
    if (leadTimeWrap) leadTimeWrap.style.display = (mode === 'reabasto_inteligente') ? 'flex' : 'none';
};

/** Muestra/oculta la explicación de "Colchón fijo" vs "Nivel de servicio". */
window.spmToggleCalcModeInfo = function() {
    const panel = document.getElementById('spmCalcModeInfoPanel');
    if (!panel) return;
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
};

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('spmCalcModeInfoWrap');
    const panel = document.getElementById('spmCalcModeInfoPanel');
    if (!wrap || !panel || panel.style.display === 'none') return;
    if (!wrap.contains(e.target)) panel.style.display = 'none';
});

// 8x. HELPERS PUROS DEL MODO "REABASTO INTELIGENTE" (sin efectos secundarios, fáciles de probar)
/** Cantidad de semanas que tiene un mes calendario dado (mes en 1-12). */
function spmWeeksInMonth(year, month) {
    return new Date(year, month, 0).getDate() / 7;
}

/**
 * Calcula el "punto de reorden" (Promedio) considerando no solo la variabilidad del consumo,
 * sino también el tiempo que tarda en llegar la remesa después del cierre de la ventana de
 * captura. La unidad debe sobrevivir con lo que le quede en existencia + lo que pida durante
 * TODO ese periodo de cobertura (semanas hasta el próximo pedido + semanas de entrega), no solo
 * durante el mes. A mayor incertidumbre en la fecha de entrega (leadTimeStdWeeks), mayor colchón,
 * aunque el consumo promedio no cambie.
 *
 * @param {number[]} monthlyTotals Dosis totales aplicadas por mes, de Enero (idx 0) al último mes cargado.
 * @param {number} year Año evaluado (para calcular semanas reales de cada mes).
 * @param {number} zScore Z del nivel de servicio elegido (90/95/99%).
 * @param {number} leadTimeWeeksMean Semanas promedio entre el cierre de captura y la llegada de la remesa.
 * @param {number} leadTimeStdWeeks Variabilidad esperada de esa fecha de entrega, en semanas.
 * @returns {number} Dosis objetivo a tener disponibles (existencia + pedido) al cierre de la ventana.
 */
function spmComputeSmartReplenishmentTarget(monthlyTotals, year, zScore, leadTimeWeeksMean, leadTimeStdWeeks) {
    const n = monthlyTotals.length;
    if (n === 0) return 0;

    // Ritmo semanal estimado de cada mes evaluado (total del mes / semanas reales de ese mes)
    const weeklyRates = monthlyTotals.map((total, idx) => {
        const weeks = spmWeeksInMonth(year, idx + 1);
        return weeks > 0 ? total / weeks : 0;
    });

    const meanWeekly = weeklyRates.reduce((a, b) => a + b, 0) / n;
    const varianceWeekly = weeklyRates.reduce((acc, v) => acc + Math.pow(v - meanWeekly, 2), 0) / n;

    // Periodo de revisión: semanas promedio entre un pedido y el siguiente (tamaño real de los
    // meses evaluados, ~4.3 semanas), más el lead time de entrega
    const avgWeeksPerMonth = weeklyRates.length
        ? monthlyTotals.reduce((acc, _, idx) => acc + spmWeeksInMonth(year, idx + 1), 0) / n
        : 0;
    const safeLeadMean = Math.max(0, Number(leadTimeWeeksMean) || 0);
    const safeLeadStd = Math.max(0, Number(leadTimeStdWeeks) || 0);
    const coverageWeeks = avgWeeksPerMonth + safeLeadMean;

    // Varianza combinada: variabilidad del consumo durante toda la cobertura + variabilidad
    // propia de la fecha de entrega (fórmula estándar de stock de seguridad con lead time variable)
    const combinedVariance = (coverageWeeks * varianceWeekly) + (meanWeekly * meanWeekly * safeLeadStd * safeLeadStd);
    const combinedStdDev = Math.sqrt(Math.max(0, combinedVariance));

    const target = (meanWeekly * coverageWeeks) + ((Number(zScore) || 0) * combinedStdDev);
    return Number.isFinite(target) ? Math.max(0, target) : 0;
}

window.spmRunAdminCalculation = async function() {
    // Respaldo por si el botón queda visible para Municipal por algún problema de CSS (ya
    // pasó una vez): sin esto, el único freno era ocultar el botón, y si ese freno fallaba
    // el usuario topaba directo con el error crudo de la RPC restringida por RLS.
    const role = window._spmUserRole || "";
    if (!role.includes("ADMIN") && !role.includes("JURISDICCIONAL")) {
        if (typeof showToast === 'function') {
            showToast("Tu perfil no tiene permisos para ejecutar la calculadora automática.", false, 'bad');
        }
        return;
    }

    const bioSisMapping = await window.spmLoadBioSisMapping();
    if (Object.keys(bioSisMapping).length === 0) {
        // spmLoadBioSisMapping ya mostró el toast de error -- abortar sin calcular nada
        // en vez de seguir con un mapeo vacío (eso daría 0 en todos los biológicos).
        return;
    }

    const currentYear = new Date().getFullYear(); // Año en curso dinámico

    const bufferInput = document.getElementById('spmBufferPct');
    let bufferPct = parseFloat(bufferInput?.value);
    if (!Number.isFinite(bufferPct) || bufferPct < 0) bufferPct = 10;
    const bufferMultiplier = 1 + (bufferPct / 100);

    // Modo "Nivel de servicio": mismo modelo que ya tiene la Calculadora de Jeringas — el
    // Promedio usa la desviación estándar del consumo mensual real en vez de un % fijo; Mínimo
    // y Máximo NO cambian de fórmula (siguen usando el colchón fijo), y el piso operativo de
    // MIN_DOSIS_FLOOR sigue aplicando igual en ambos modos.
    const calcModeEl = document.getElementById('spmCalcMode');
    const calcModeRaw = calcModeEl?.value;
    const calcMode = (calcModeRaw === 'nivel_servicio' || calcModeRaw === 'reabasto_inteligente') ? calcModeRaw : 'colchon_fijo';
    const usesServiceLevel = (calcMode === 'nivel_servicio' || calcMode === 'reabasto_inteligente');
    const SPM_Z_SCORES = { '90': 1.28, '95': 1.65, '99': 2.33 };
    const serviceLevelEl = document.getElementById('spmServiceLevel');
    const serviceLevelPct = usesServiceLevel ? (serviceLevelEl?.value || '95') : null;
    const zScore = SPM_Z_SCORES[serviceLevelPct] || 1.65;

    // Modo "Reabasto inteligente": además del nivel de servicio, el Promedio cubre las semanas
    // que tarda en llegar la remesa (y su incertidumbre), no solo el mes en curso.
    const leadTimeWeeksEl = document.getElementById('spmLeadTimeWeeks');
    const leadTimeStdEl = document.getElementById('spmLeadTimeStdWeeks');
    let leadTimeWeeksMean = parseFloat(leadTimeWeeksEl?.value);
    if (!Number.isFinite(leadTimeWeeksMean) || leadTimeWeeksMean < 0) leadTimeWeeksMean = 2;
    let leadTimeStdWeeks = parseFloat(leadTimeStdEl?.value);
    if (!Number.isFinite(leadTimeStdWeeks) || leadTimeStdWeeks < 0) leadTimeStdWeeks = 1;

    let confirmMsg;
    if (calcMode === 'reabasto_inteligente') {
        confirmMsg = `¿Deseas calcular automáticamente los promedios de productividad SIS del año ${currentYear} para todas las unidades activas? El Promedio usará el modo "Reabasto inteligente" (${serviceLevelPct}%, z=${zScore}), cubriendo ~${leadTimeWeeksMean} semana(s) de entrega (±${leadTimeStdWeeks} sem. de incertidumbre) además del mes en curso; Mínimo y Máximo siguen usando el colchón fijo del ${bufferPct}%.`;
    } else if (calcMode === 'nivel_servicio') {
        confirmMsg = `¿Deseas calcular automáticamente los promedios de productividad SIS del año ${currentYear} para todas las unidades activas? El Promedio usará el modo "Nivel de servicio" (${serviceLevelPct}%, z=${zScore}) sobre la variabilidad real de consumo; Mínimo y Máximo siguen usando el colchón fijo del ${bufferPct}%.`;
    } else {
        confirmMsg = `¿Deseas calcular automáticamente los promedios de productividad SIS del año ${currentYear} (con +${bufferPct}% colchón técnico) para todas las unidades activas?`;
    }

    const confirmCalc = await window.showConfirmDialog(
        "Ejecutar Calculadora de Aplicaciones SIS",
        confirmMsg
    );
    if (!confirmCalc) return;

    if (typeof showOverlay === 'function') {
        showOverlay("Consultando productividad SIS en tiempo real...", "Calculadora Admin");
    }

    try {
        // 1. Consultar meses activos reales cargados en el sistema para el año en curso
        const { data: dbMonths, error: errMonths } = await window.supabase
            .rpc('get_registros_sis_active_months', { p_anio: currentYear });

        if (errMonths) throw errMonths;

        const activeMonths = (dbMonths || [])
            .map(r => r.mes)
            .filter(m => Number.isInteger(m) && m >= 1 && m <= 12)
            .sort((a, b) => a - b);

        // Salvaguarda: si no hay NADA cargado para el año en curso, abortar sin tocar los parámetros existentes
        if (activeMonths.length === 0) {
            if (typeof showToast === 'function') {
                showToast(`No hay registros SIS cargados para el año ${currentYear}. No se modificó ningún parámetro.`, false, 'bad');
            }
            return;
        }

        // "Enero al último mes cargado": el divisor es el número de mes más alto reportado,
        // NO la cantidad de meses distintos (evita promedios inflados si algún mes intermedio no se cargó).
        const lastMonth = Math.max(...activeMonths);
        const numMonths = lastMonth;

        // Detectar huecos entre Enero y el último mes cargado (p.ej. falta marzo) y advertir antes de calcular
        const missingMonths = [];
        for (let m = 1; m <= lastMonth; m++) {
            if (!activeMonths.includes(m)) missingMonths.push(m);
        }
        if (missingMonths.length > 0) {
            const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const missingNames = missingMonths.map(m => MONTH_NAMES[m - 1]).join(', ');
            const proceedAnyway = await window.showConfirmDialog(
                "Meses faltantes en el histórico SIS",
                `Detecté que ${missingNames} del ${currentYear} no tiene(n) registros cargados, pero sí hay datos de meses posteriores. Esos meses se contarán como 0 aplicaciones en el promedio. ¿Deseas continuar de todas formas?`
            );
            if (!proceedAnyway) return;
        }

        // 2. Extraer productividad SIS del año en curso CON GRANULARIDAD MENSUAL
        //    (necesaria para sacar el mínimo y máximo reales entre los meses evaluados, no un estimado)
        let monthlyData = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: chunk, error: errAgg } = await window.supabase
                .rpc('get_registros_sis_monthly', { p_anio: currentYear })
                .range(from, from + step - 1);

            if (errAgg) throw errAgg;

            if (chunk && chunk.length > 0) {
                monthlyData = monthlyData.concat(chunk);
                from += step;
                if (chunk.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        // Mapear totales por mes: `${clues}|${variable_sis}|${mes}` -> total
        const regMap = {};
        monthlyData.forEach(r => {
            const k = `${r.clues}|${r.variable_sis}|${r.mes}`;
            regMap[k] = (regMap[k] || 0) + (r.total_valor || 0);
        });

        const MIN_DOSIS_FLOOR = 5; // Nunca dejar el mínimo en 0

        // 3. Recalcular promedio, mínimo y máximo reales (por mes) para todas las unidades
        const changes = [];
        window._spmUnitsList.forEach(u => {
            OFFICIAL_BIO_ORDER.forEach(bio => {
                const vars = bioSisMapping[bio] || [];

                // Total de dosis aplicadas por cada mes evaluado (Enero..lastMonth; mes sin datos = 0)
                const monthlyTotals = [];
                for (let m = 1; m <= lastMonth; m++) {
                    let monthTotal = 0;
                    vars.forEach(v => {
                        monthTotal += regMap[`${u.clues}|${v}|${m}`] || 0;
                    });
                    monthlyTotals.push(monthTotal);
                }

                const sumDoses = monthlyTotals.reduce((a, b) => a + b, 0);
                const rawAvg = sumDoses / numMonths;
                const rawMin = Math.min(...monthlyTotals);
                const rawMax = Math.max(...monthlyTotals);

                // Colchón técnico (ajustable, 10% por defecto) sobre Mínimo y Máximo en ambos
                // modos; el Promedio usa colchón fijo O nivel de servicio, según spmCalcMode.
                let avgWithBuffer;
                if (calcMode === 'reabasto_inteligente') {
                    avgWithBuffer = spmComputeSmartReplenishmentTarget(monthlyTotals, currentYear, zScore, leadTimeWeeksMean, leadTimeStdWeeks);
                } else if (calcMode === 'nivel_servicio') {
                    const variance = monthlyTotals.reduce((a, v) => a + Math.pow(v - rawAvg, 2), 0) / monthlyTotals.length;
                    const stdDev = Math.sqrt(variance);
                    avgWithBuffer = rawAvg + zScore * stdDev;
                } else {
                    avgWithBuffer = rawAvg * bufferMultiplier;
                }
                const minWithBuffer = rawMin * bufferMultiplier;
                const maxWithBuffer = rawMax * bufferMultiplier;

                const defaultMultiplo = DEFAULT_DOSES_PER_BOTTLE[bio.toUpperCase()] || 1;

                // Promedio de frascos redondeado hacia arriba (nunca decimales)
                const promedioFrascos = Math.ceil(avgWithBuffer / defaultMultiplo);
                // Mínimo nunca por debajo de 5 dosis (piso operativo)
                const minDosis = Math.max(MIN_DOSIS_FLOOR, Math.round(minWithBuffer));
                // Máximo nunca por debajo del mínimo (caso de meses en 0) NI por debajo del propio
                // objetivo de Promedio (en "Reabasto inteligente" el Promedio cubre varias semanas
                // de cobertura y puede superar el máximo histórico mensual — el Máximo mostrado en
                // pantalla debe seguir siendo, por definición, mayor o igual al Promedio).
                const maxDosis = Math.max(minDosis, Math.round(maxWithBuffer), Math.round(avgWithBuffer));

                const key = `${u.clues}|${bio}`;
                const existing = window._spmParamsMap[key] || {};

                const record = {
                    clues: u.clues,
                    unidad: u.unidad,
                    municipio: u.municipio,
                    biologico: bio,
                    promedio_frascos: promedioFrascos,
                    min_dosis: minDosis,
                    max_dosis: maxDosis,
                    multiplo_pedido: defaultMultiplo,
                    activo: 'SI'
                };

                const oldProm = existing.promedio_frascos !== undefined ? existing.promedio_frascos : 0;
                const oldMin = existing.min_dosis !== undefined ? existing.min_dosis : 0;
                const oldMax = existing.max_dosis !== undefined ? existing.max_dosis : 0;

                if (oldProm !== promedioFrascos || oldMin !== minDosis || oldMax !== maxDosis) {
                    changes.push({
                        clues: u.clues,
                        unidad: u.unidad,
                        municipio: u.municipio,
                        biologico: bio,
                        oldProm, oldMin, oldMax,
                        newProm: promedioFrascos, newMin: minDosis, newMax: maxDosis,
                        record
                    });
                }
            });
        });

        // 4. Guardar el cálculo en memoria y mostrar vista previa; el guardado en Supabase
        //    solo ocurre si el usuario confirma desde el modal (spmConfirmCalcSave)
        window._spmPendingCalcRecords = changes.map(c => c.record);

        window.spmShowCalcPreview(changes, { currentYear, lastMonth, numMonths, missingMonths, calcMode, serviceLevelPct, zScore, leadTimeWeeksMean, leadTimeStdWeeks });

    } catch (e) {
        console.error("Error al ejecutar Calculadora Admin:", e);
        if (typeof showToast === 'function') {
            showToast("Error en calculadora: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// 8b. VISTA PREVIA DE CAMBIOS ANTES DE GUARDAR EN SUPABASE
window.spmShowCalcPreview = function(changes, meta) {
    const modal = document.getElementById('spmCalcPreviewModal');
    const body = document.getElementById('spmCalcPreviewBody');
    const summary = document.getElementById('spmCalcPreviewSummary');
    const btnConfirm = document.getElementById('spmBtnCalcPreviewConfirm');
    if (!modal || !body || !summary) return;

    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const modeLabel = meta.calcMode === 'reabasto_inteligente'
        ? ` · Modo: Reabasto inteligente (${meta.serviceLevelPct}%, z=${meta.zScore}, entrega ~${meta.leadTimeWeeksMean} sem. ±${meta.leadTimeStdWeeks})`
        : meta.calcMode === 'nivel_servicio'
            ? ` · Modo: Nivel de servicio (${meta.serviceLevelPct}%, z=${meta.zScore})`
            : '';
    summary.textContent = `Periodo evaluado: Enero a ${MONTH_NAMES[meta.lastMonth]} ${meta.currentYear} (${meta.numMonths} meses) · ${changes.length} parámetros con cambios de ${window._spmUnitsList.length * OFFICIAL_BIO_ORDER.length} evaluados${modeLabel}`;

    if (changes.length === 0) {
        body.innerHTML = `<div style="padding:30px; text-align:center; color:#64748b; font-size:13px;">No hay cambios respecto a los valores actualmente guardados. No es necesario guardar nada.</div>`;
        if (btnConfirm) btnConfirm.style.display = 'none';
    } else {
        if (btnConfirm) btnConfirm.style.display = 'inline-flex';
        const rows = changes.map(c => `
            <tr>
                <td>${c.municipio}</td>
                <td>${c.unidad}</td>
                <td>${c.biologico}</td>
                <td class="spm-preview-diff">${c.oldProm} &rarr; <strong>${c.newProm}</strong></td>
                <td class="spm-preview-diff">${c.oldMin} &rarr; <strong>${c.newMin}</strong></td>
                <td class="spm-preview-diff">${c.oldMax} &rarr; <strong>${c.newMax}</strong></td>
            </tr>
        `).join('');
        body.innerHTML = `
            <table class="spm-preview-table">
                <thead>
                    <tr>
                        <th>Municipio</th><th>Unidad</th><th>Biológico</th>
                        <th>Promedio (frascos)</th><th>Mínimo (dosis)</th><th>Máximo (dosis)</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    modal.style.display = 'flex';
};

window.spmCancelCalcPreview = function() {
    window._spmPendingCalcRecords = null;
    const modal = document.getElementById('spmCalcPreviewModal');
    if (modal) modal.style.display = 'none';
    if (typeof showToast === 'function') {
        showToast("Cálculo descartado. No se guardó ningún cambio.", true, 'warn');
    }
};

// 8c. CONFIRMAR Y PERSISTIR EL CÁLCULO MASIVO EN SUPABASE
window.spmConfirmCalcSave = async function() {
    const records = window._spmPendingCalcRecords;
    const modal = document.getElementById('spmCalcPreviewModal');

    if (!records || records.length === 0) {
        if (modal) modal.style.display = 'none';
        return;
    }

    const username = window.spmGetCurrentUsername();
    const nowIso = new Date().toISOString();
    const recordsToUpsert = records.map(r => ({ ...r, updated_by: username, updated_at: nowIso }));

    if (typeof showOverlay === 'function') {
        showOverlay(`Guardando ${recordsToUpsert.length} parámetros calculados en Supabase...`, "Calculadora Admin");
    }

    try {
        const batchSize = 200;
        let savedCount = 0;
        for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
            const batch = recordsToUpsert.slice(i, i + batchSize);
            const { error: batchErr } = await window.supabase
                .from('biologicos_params')
                .upsert(batch, { onConflict: 'clues,biologico' });

            if (batchErr) {
                throw new Error(`Se guardaron ${savedCount} de ${recordsToUpsert.length} parámetros antes de fallar: ${batchErr.message}`);
            }
            savedCount += batch.length;

            // Reflejar en caché local a medida que se confirma cada lote
            batch.forEach(rec => {
                window._spmParamsMap[`${rec.clues}|${rec.biologico}`] = rec;
            });
        }

        window._spmPendingCalcRecords = null;
        if (modal) modal.style.display = 'none';

        // Refrescar lista lateral (puntos de revisión) y la matriz de la unidad activa
        window.spmFilterUnitsByMuni(document.getElementById('spmParamMuniSelect')?.value || "");
        if (window._spmActiveClues) {
            const activeUnit = window._spmUnitsList.find(u => u.clues === window._spmActiveClues);
            if (activeUnit) window.spmRenderUnitMatrix(activeUnit);
        }

        if (typeof showToast === 'function') {
            showToast(`¡${savedCount} parámetros guardados en Supabase con éxito!`, true, 'good');
        }
    } catch (e) {
        console.error("Error al guardar cálculo masivo:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar en base de datos: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// 9. FASE 6 — SUGERENCIAS PENDIENTES DEL MOTOR DE REABASTO INTELIGENTE (server-side)
// Lee biologicos_params_sugeridos (escrita por calcular_reabasto_pendientes() en Supabase)
// y deja aplicar/descartar el lote completo -- nunca escribe directo, siempre pasa por
// esta aprobación humana explícita.
window._spmSugerenciasCache = null;

const SPM_TIPO_CAMBIO_LABEL = {
    RIESGO_DESABASTO: 'Riesgo de desabasto',
    POSIBLE_SOBREABASTO: 'Posible sobreabasto',
    DATO_ATIPICO_REVISAR: 'Dato atípico — revisar',
    SIN_CAMBIO_RELEVANTE: 'Sin cambio relevante'
};
const SPM_TIPO_CAMBIO_COLOR = {
    RIESGO_DESABASTO: '#fee2e2',
    POSIBLE_SOBREABASTO: '#dcfce7',
    DATO_ATIPICO_REVISAR: '#fef3c7',
    SIN_CAMBIO_RELEVANTE: '#f1f5f9'
};

/** Refresca el número en el badge rojo del ícono de Sugerencias Pendientes. */
window.spmRefreshSugerenciasBadge = async function() {
    const badge = document.getElementById('spmSugerenciasBadge');
    if (!badge) return;
    try {
        const { count, error } = await window.supabase
            .from('biologicos_params_sugeridos')
            .select('id', { count: 'exact', head: true });
        if (error) throw error;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        console.warn('[param_calculator] No se pudo refrescar el badge de sugerencias:', e);
    }
};

/** Carga las sugerencias pendientes de Supabase y abre el modal de revisión. */
window.spmLoadSugerenciasPendientes = async function() {
    if (typeof showOverlay === 'function') showOverlay('Cargando sugerencias pendientes...', 'Reabasto Inteligente');
    try {
        const { data, error } = await window.supabase
            .from('biologicos_params_sugeridos')
            .select('*')
            .order('tipo_cambio')
            .order('municipio')
            .order('unidad')
            .order('biologico');
        if (error) throw error;

        window._spmSugerenciasCache = data || [];
        window.spmRenderSugerenciasModal(window._spmSugerenciasCache);

        const modal = document.getElementById('spmSugerenciasModal');
        if (modal) modal.style.display = 'flex';
    } catch (e) {
        console.error('[param_calculator] Error al cargar sugerencias pendientes:', e);
        if (typeof showToast === 'function') showToast('Error al cargar sugerencias: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

window.spmRenderSugerenciasModal = function(rows) {
    const summary = document.getElementById('spmSugerenciasSummary');
    const body = document.getElementById('spmSugerenciasBody');
    const btnAplicar = document.getElementById('spmBtnAplicarSugerencias');
    const btnDescartar = document.getElementById('spmBtnDescartarSugerencias');
    if (!summary || !body) return;

    if (!rows || rows.length === 0) {
        summary.textContent = 'No hay sugerencias pendientes en este momento.';
        body.innerHTML = `<div style="padding:30px; text-align:center; color:#64748b; font-size:13px;">El motor de reabasto inteligente no tiene cambios pendientes de aprobación.</div>`;
        if (btnAplicar) btnAplicar.style.display = 'none';
        if (btnDescartar) btnDescartar.style.display = 'none';
        return;
    }

    if (btnAplicar) btnAplicar.style.display = 'inline-flex';
    if (btnDescartar) btnDescartar.style.display = 'inline-flex';

    const counts = {};
    rows.forEach(r => { counts[r.tipo_cambio] = (counts[r.tipo_cambio] || 0) + 1; });
    const countsText = Object.keys(SPM_TIPO_CAMBIO_LABEL)
        .filter(k => counts[k])
        .map(k => `${counts[k]} ${SPM_TIPO_CAMBIO_LABEL[k].toLowerCase()}`)
        .join(' · ');
    summary.textContent = `${rows.length} sugerencia(s) pendientes — ${countsText}`;

    const rowsHtml = rows.map(r => {
        const color = SPM_TIPO_CAMBIO_COLOR[r.tipo_cambio] || '#ffffff';
        const atipicoTag = r.dato_atipico_detectado ? ' ⚠️' : '';
        return `
            <tr style="background:${color};">
                <td>${escapeHtml(r.municipio || '')}</td>
                <td>${escapeHtml(r.unidad || '')}</td>
                <td>${escapeHtml(r.biologico || '')}</td>
                <td>${SPM_TIPO_CAMBIO_LABEL[r.tipo_cambio] || r.tipo_cambio}${atipicoTag}</td>
                <td class="spm-preview-diff">${r.promedio_frascos_actual} &rarr; <strong>${r.promedio_frascos_sugerido}</strong></td>
                <td class="spm-preview-diff">${r.min_dosis_actual} &rarr; <strong>${r.min_dosis_sugerido}</strong></td>
                <td class="spm-preview-diff">${r.max_dosis_actual} &rarr; <strong>${r.max_dosis_sugerido}</strong></td>
                <td style="text-align:center;">${r.ciclos_insuficientes_recientes ?? 0}</td>
            </tr>
        `;
    }).join('');

    body.innerHTML = `
        <table class="spm-preview-table">
            <thead>
                <tr>
                    <th>Municipio</th><th>Unidad</th><th>Biológico</th><th>Categoría</th>
                    <th>Promedio (frascos)</th><th>Mínimo (dosis)</th><th>Máximo (dosis)</th><th>Sem. en cero c/consumo</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
};

window.spmCerrarSugerenciasModal = function() {
    const modal = document.getElementById('spmSugerenciasModal');
    if (modal) modal.style.display = 'none';
};

/** Copia TODAS las sugerencias cargadas a biologicos_params (aprobación humana explícita). */
window.spmAplicarTodasSugerencias = async function() {
    const rows = window._spmSugerenciasCache || [];
    if (rows.length === 0) return;

    const confirmApply = await window.showConfirmDialog(
        'Aplicar Sugerencias de Reabasto Inteligente',
        `¿Aplicar las ${rows.length} sugerencias pendientes a biologicos_params? Esto reemplaza el Promedio/Mínimo/Máximo vigente de cada unidad+biológico listado.`
    );
    if (!confirmApply) return;

    if (typeof showOverlay === 'function') showOverlay(`Aplicando ${rows.length} sugerencias en Supabase...`, 'Reabasto Inteligente');

    try {
        const username = window.spmGetCurrentUsername();
        const nowIso = new Date().toISOString();
        const records = rows.map(r => ({
            clues: r.clues,
            unidad: r.unidad,
            municipio: r.municipio,
            biologico: r.biologico,
            promedio_frascos: r.promedio_frascos_sugerido,
            min_dosis: r.min_dosis_sugerido,
            max_dosis: r.max_dosis_sugerido,
            multiplo_pedido: DEFAULT_DOSES_PER_BOTTLE[String(r.biologico).toUpperCase()] || 1,
            activo: 'SI',
            updated_by: username,
            updated_at: nowIso
        }));

        const batchSize = 200;
        let saved = 0;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { error } = await window.supabase
                .from('biologicos_params')
                .upsert(batch, { onConflict: 'clues,biologico' });
            if (error) throw new Error(`Se aplicaron ${saved} de ${records.length} antes de fallar: ${error.message}`);
            saved += batch.length;
        }

        const ids = rows.map(r => r.id);
        const { error: delError } = await window.supabase
            .from('biologicos_params_sugeridos')
            .delete()
            .in('id', ids);
        if (delError) console.warn('[param_calculator] Sugerencias aplicadas pero no se pudieron limpiar de la tabla de staging:', delError);

        window._spmSugerenciasCache = null;
        window.spmCerrarSugerenciasModal();
        window.spmRefreshSugerenciasBadge();

        records.forEach(rec => {
            window._spmParamsMap[`${rec.clues}|${rec.biologico}`] = rec;
        });
        if (window._spmActiveClues) {
            const activeUnit = window._spmUnitsList.find(u => u.clues === window._spmActiveClues);
            if (activeUnit) window.spmRenderUnitMatrix(activeUnit);
        }
        window.spmFilterUnitsByMuni(document.getElementById('spmParamMuniSelect')?.value || '');

        if (typeof showToast === 'function') showToast(`¡${saved} sugerencias aplicadas con éxito!`, true, 'good');
    } catch (e) {
        console.error('[param_calculator] Error al aplicar sugerencias:', e);
        if (typeof showToast === 'function') showToast('Error al aplicar sugerencias: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Descarta TODAS las sugerencias cargadas sin aplicarlas (el motor las regenerará si sigue aplicando el criterio). */
window.spmDescartarTodasSugerencias = async function() {
    const rows = window._spmSugerenciasCache || [];
    if (rows.length === 0) return;

    const confirmDiscard = await window.showConfirmDialog(
        'Descartar Sugerencias Pendientes',
        `¿Descartar las ${rows.length} sugerencias pendientes sin aplicarlas? El motor las volverá a generar en su próxima corrida si las condiciones siguen igual.`
    );
    if (!confirmDiscard) return;

    if (typeof showOverlay === 'function') showOverlay('Descartando sugerencias...', 'Reabasto Inteligente');
    try {
        const ids = rows.map(r => r.id);
        const { error } = await window.supabase
            .from('biologicos_params_sugeridos')
            .delete()
            .in('id', ids);
        if (error) throw error;

        window._spmSugerenciasCache = null;
        window.spmCerrarSugerenciasModal();
        window.spmRefreshSugerenciasBadge();
        if (typeof showToast === 'function') showToast('Sugerencias descartadas.', true, 'warn');
    } catch (e) {
        console.error('[param_calculator] Error al descartar sugerencias:', e);
        if (typeof showToast === 'function') showToast('Error al descartar: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

// Escuchar cambios de sub-panel en el panel Admin para inicializar automáticamente
document.addEventListener("click", (e) => {
    if (e.target && (e.target.id === "tabAdminParametros" || e.target.closest("#tabAdminParametros"))) {
        setTimeout(() => {
            window.initConsoleParametros();
            window.spmRefreshSugerenciasBadge();
        }, 100);
    }
});
