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
    const usesServiceLevel = (mode === 'nivel_servicio' || mode === 'reabasto_inteligente' || mode === 'proyeccion_inteligente');
    if (colchonWrap) colchonWrap.style.display = usesServiceLevel ? 'none' : 'flex';
    if (serviceWrap) serviceWrap.style.display = usesServiceLevel ? 'flex' : 'none';
    if (leadTimeWrap) leadTimeWrap.style.display = (mode === 'reabasto_inteligente' || mode === 'proyeccion_inteligente') ? 'flex' : 'none';
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

// 8s. PROYECCIÓN INTELIGENTE (proyeccion_consumo.js): propone Promedio/Mínimo/Máximo del mes que sigue por unidad y biológico,
//     con su explicación y su confianza. No guarda nada: pasa por la vista previa, donde se elige qué aplicar.
// Campañas/temporadas: no siguen un consumo mensual regular, igual que en el motor SQL de reabasto.
const SPM_PROY_EXCLUIDOS = ['INFLUENZA', 'VPH'];
// Columna de biologicos_existencia (frascos en existencia por captura semanal) de cada biológico
const SPM_COL_EXISTENCIA = {
    "BCG": "bcg", "HEPATITIS B": "hepatitis_b", "HEXAVALENTE": "hexavalente", "DPT": "dpt", "ROTAVIRUS": "rotavirus",
    "NEUMOCOCICA 13": "neumococica_13", "SRP": "srp", "SR": "sr", "VARICELA": "varicela", "HEPATITIS A": "hepatitis_a",
    "TD": "td", "TDPA": "tdpa"
};

/** Existencia de las últimas 8 semanas por unidad: { clues: [{ fecha, bcg, ... }] } (para detectar desabasto y sobreexistencia). */
async function spmCargarExistenciaReciente() {
    const desde = new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10);
    const cols = ['clues', 'fecha'].concat(Object.values(SPM_COL_EXISTENCIA)).join(',');
    const porClues = {};
    let from = 0;
    for (;;) {
        const { data, error } = await window.supabase.from('biologicos_existencia').select(cols).gte('fecha', desde).order('fecha', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((r) => { (porClues[r.clues] = porClues[r.clues] || []).push(r); });
        if (!data || data.length < 1000) break;
        from += 1000;
    }
    return porClues;
}

/** Señales de existencia de un biológico en una unidad: semanas en cero (con consumo) → meses, y sobreexistencia sostenida. */
function spmSenalesExistencia(filas, bio, promedioActualFrascos, consumoReciente) {
    const col = SPM_COL_EXISTENCIA[bio];
    if (!col || !filas || filas.length < 3) return { mesesSinExistencia: 0, sobreexistencia: false };
    const vals = filas.map((r) => (r[col] === null || r[col] === undefined ? null : Number(r[col]))).filter((v) => v !== null);
    if (vals.length < 3) return { mesesSinExistencia: 0, sobreexistencia: false };
    // En cero solo cuenta como desabasto si la unidad sí consumía ese biológico
    const ceros = consumoReciente > 0 ? vals.filter((v) => v === 0).length : 0;
    const mesesSinExistencia = Math.min(4, Math.round((ceros / vals.length) * 4));
    const ult4 = vals.slice(0, 4);
    const prom4 = ult4.reduce((a, b) => a + b, 0) / ult4.length;
    const sobreexistencia = promedioActualFrascos > 0 && ult4.length >= 3 && prom4 >= 2 * promedioActualFrascos;
    return { mesesSinExistencia, sobreexistencia };
}

window.spmRunSmartProjection = async function(opts) {
    const PC = window.ProyeccionConsumo;
    if (!PC) {
        if (typeof showToast === 'function') showToast('No se cargó el motor de proyección. Recarga la página.', false, 'bad');
        return;
    }
    const bioSisMapping = await window.spmLoadBioSisMapping();
    if (Object.keys(bioSisMapping).length === 0) return;

    const hoy = new Date();
    const objetivo = PC.mesObjetivo(hoy);
    const anios = [hoy.getFullYear() - 1, hoy.getFullYear()];
    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const ok = await window.showConfirmDialog(
        "Proyección inteligente",
        `Voy a proyectar el consumo de ${MONTH_NAMES[objetivo.mes]} ${objetivo.anio} de cada unidad y biológico con el histórico SIS de ${anios[0]} y ${anios[1]}, la existencia de las últimas semanas y el nivel de servicio elegido (${opts.serviceLevelPct}%, entrega ~${opts.leadTimeWeeksMean} sem. ±${opts.leadTimeStdWeeks}). Nada se guarda hasta que elijas qué aplicar en la vista previa.`
    );
    if (!ok) return;

    if (typeof showOverlay === 'function') showOverlay("Proyectando el consumo de cada unidad...", "Proyección inteligente");
    try {
        // 1. Meses cargados en cada año
        const mesesCargados = [];
        for (const anio of anios) {
            const { data, error } = await window.supabase.rpc('get_registros_sis_active_months', { p_anio: anio });
            if (error) throw error;
            (data || []).map((r) => r.mes).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b)
                .forEach((m) => mesesCargados.push({ anio, mes: m }));
        }
        if (mesesCargados.length === 0) {
            if (typeof showToast === 'function') showToast(`No hay registros SIS cargados de ${anios[0]} ni ${anios[1]}. No se modificó ningún parámetro.`, false, 'bad');
            return;
        }

        // 2. Producción SIS mensual de ambos años, SIN las filas en cero (el 91 % del SIS son ceros: así son ~44 páginas, no ~470)
        const regMap = {};
        {
            let from = 0, hayMas = true;
            while (hayMas) {
                const { data: chunk, error } = await window.supabase.rpc('get_registros_sis_mensual_nz', { p_anio_desde: anios[0], p_anio_hasta: anios[1] }).range(from, from + 999);
                if (error) throw error;
                (chunk || []).forEach((r) => { const k = `${r.clues}|${r.variable_sis}|${r.anio}|${r.mes}`; regMap[k] = (regMap[k] || 0) + (r.total_valor || 0); });
                if (!chunk || chunk.length < 1000) hayMas = false; else from += 1000;
            }
        }

        // 3. Línea de tiempo contigua desde el primer mes cargado hasta el último; los meses no cargados quedan en null
        const primero = mesesCargados[0], ultimo = mesesCargados[mesesCargados.length - 1];
        const cargado = new Set(mesesCargados.map((m) => `${m.anio}-${m.mes}`));
        const linea = [];
        for (let i = primero.anio * 12 + primero.mes - 1; i <= ultimo.anio * 12 + ultimo.mes - 1; i++) {
            linea.push({ anio: Math.floor(i / 12), mes: (i % 12) + 1 });
        }
        const valorMes = (clues, vars, m) => {
            if (!cargado.has(`${m.anio}-${m.mes}`)) return null;
            let t = 0;
            vars.forEach((v) => { t += regMap[`${clues}|${v}|${m.anio}|${m.mes}`] || 0; });
            return t;
        };

        const bios = OFFICIAL_BIO_ORDER.filter((b) => !SPM_PROY_EXCLUIDOS.includes(b));
        const unidades = window._spmUnitsList;
        const series = {};   // `${clues}|${bio}` -> serie
        unidades.forEach((u) => bios.forEach((bio) => {
            const vars = bioSisMapping[bio] || [];
            series[`${u.clues}|${bio}`] = linea.map((m) => ({ anio: m.anio, mes: m.mes, dosis: valorMes(u.clues, vars, m) }));
        }));

        // 4. Mes parcial: si el último mes cargado trae menos del 40 % de lo normal, no es consumo real sino carga a medias
        let mesParcial = null;
        const parcial = PC.detectarMesParcial(Object.values(series));
        if (parcial) {
            mesParcial = parcial;
            Object.keys(series).forEach((k) => { const s = series[k]; if (s.length) s[s.length - 1] = { ...s[s.length - 1], dosis: null }; });
        }

        // 5. Existencia reciente (no bloquea el cálculo si falla)
        let existencia = {};
        try { existencia = await spmCargarExistenciaReciente(); } catch (e) { console.warn('[param_calculator] sin señales de existencia:', e); }

        // 6. Índice estacional y eventos por biológico (con todas las unidades) y proyección de cada unidad
        const changes = [];
        const MIN_DOSIS_FLOOR = 5;
        bios.forEach((bio) => {
            const grupo = unidades.map((u) => series[`${u.clues}|${bio}`]);
            const eventos = PC.detectarEventos(grupo);
            const indiceGrupo = PC.indiceEstacionalGrupo(grupo, eventos);
            const dpf = DEFAULT_DOSES_PER_BOTTLE[bio.toUpperCase()] || 1;
            unidades.forEach((u) => {
                const serie = series[`${u.clues}|${bio}`];
                const existing = window._spmParamsMap[`${u.clues}|${bio}`] || {};
                const ult3 = serie.slice(-3).map((p) => p.dosis).filter((v) => v !== null);
                const consumoReciente = ult3.reduce((a, b) => a + b, 0);
                const senales = spmSenalesExistencia(existencia[u.clues], bio, Number(existing.promedio_frascos) || 0, consumoReciente);
                const r = PC.proyectar({
                    serie, objetivo, dosisPorFrasco: dpf, nivelZ: opts.zScore, leadSem: opts.leadTimeWeeksMean, leadStdSem: opts.leadTimeStdWeeks,
                    indiceGrupo, eventos, senales, pisoMin: MIN_DOSIS_FLOOR
                });
                if (!r) return;
                const oldProm = existing.promedio_frascos !== undefined ? existing.promedio_frascos : 0;
                const oldMin = existing.min_dosis !== undefined ? existing.min_dosis : 0;
                const oldMax = existing.max_dosis !== undefined ? existing.max_dosis : 0;
                if (oldProm === r.promedioFrascos && oldMin === r.minDosis && oldMax === r.maxDosis) return;
                changes.push({
                    clues: u.clues, unidad: u.unidad, municipio: u.municipio, biologico: bio,
                    oldProm, oldMin, oldMax, newProm: r.promedioFrascos, newMin: r.minDosis, newMax: r.maxDosis,
                    proy: r, sel: r.confianza.nivel !== 'baja',
                    record: { clues: u.clues, unidad: u.unidad, municipio: u.municipio, biologico: bio, promedio_frascos: r.promedioFrascos,
                        min_dosis: r.minDosis, max_dosis: r.maxDosis, multiplo_pedido: dpf, activo: 'SI' }
                });
            });
        });

        window._spmPendingCalcRecords = null;
        window._spmPendingCalcChanges = changes;
        window.spmShowCalcPreview(changes, {
            calcMode: 'proyeccion_inteligente', objetivo, mesParcial, ultimoMes: ultimo, primerMes: primero,
            serviceLevelPct: opts.serviceLevelPct, zScore: opts.zScore, leadTimeWeeksMean: opts.leadTimeWeeksMean, leadTimeStdWeeks: opts.leadTimeStdWeeks,
            existenciaCargada: Object.keys(existencia).length > 0
        });
    } catch (e) {
        console.error("Error en la proyección inteligente:", e);
        if (typeof showToast === 'function') showToast("Error en la proyección: " + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Vista previa de la proyección: confianza, explicación y casilla por propuesta (las de confianza baja vienen sin marcar). */
window.spmRenderProyeccionPreview = function(changes, meta) {
    const modal = document.getElementById('spmCalcPreviewModal');
    const body = document.getElementById('spmCalcPreviewBody');
    const summary = document.getElementById('spmCalcPreviewSummary');
    const btnConfirm = document.getElementById('spmBtnCalcPreviewConfirm');
    const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cuenta = (n) => changes.filter((c) => c.proy.confianza.nivel === n).length;

    const aviso = [];
    if (meta.mesParcial) aviso.push(`${MESES[meta.mesParcial.mes]} ${meta.mesParcial.anio} está cargado a medias (${Math.round(meta.mesParcial.proporcion * 100)} % de lo normal): no se usó.`);
    if (!meta.existenciaCargada) aviso.push('No se pudo leer la existencia reciente: no se consideraron desabasto ni sobreexistencia.');
    summary.innerHTML = `Proyección de <b>${MESES[meta.objetivo.mes]} ${meta.objetivo.anio}</b> con el SIS de ${MESES[meta.primerMes.mes]} ${meta.primerMes.anio} a ${MESES[meta.ultimoMes.mes]} ${meta.ultimoMes.anio} · `
        + `${changes.length} propuestas con cambios · confianza alta ${cuenta('alta')}, media ${cuenta('media')}, baja ${cuenta('baja')} (las bajas vienen sin marcar) · nivel de servicio ${meta.serviceLevelPct}%, entrega ~${meta.leadTimeWeeksMean} sem.`
        + (aviso.length ? `<br><span class="spm-pr-aviso">${aviso.map(esc).join(' ')}</span>` : '');

    if (changes.length === 0) {
        body.innerHTML = `<div style="padding:30px; text-align:center; color:#64748b; font-size:13px;">La proyección coincide con los valores guardados. No es necesario cambiar nada.</div>`;
        if (btnConfirm) btnConfirm.style.display = 'none';
        modal.style.display = 'flex';
        return;
    }
    if (btnConfirm) btnConfirm.style.display = 'inline-flex';

    const chip = (n) => `<span class="spm-pr-conf spm-pr-conf--${n}">${n === 'alta' ? 'Alta' : n === 'media' ? 'Media' : 'Baja'}</span>`;
    const orden = { baja: 0, media: 1, alta: 2 };
    const filas = changes.map((c, i) => ({ c, i })).sort((a, b) =>
        String(a.c.municipio).localeCompare(String(b.c.municipio), 'es') || String(a.c.unidad).localeCompare(String(b.c.unidad), 'es')
        || orden[a.c.proy.confianza.nivel] - orden[b.c.proy.confianza.nivel]);
    const rows = filas.map(({ c, i }) => {
        const p = c.proy;
        return `<tr data-conf="${p.confianza.nivel}">
            <td class="spm-pr-chk"><input type="checkbox" data-i="${i}" ${c.sel ? 'checked' : ''} aria-label="Aplicar ${esc(c.biologico)} de ${esc(c.unidad)}"></td>
            <td>${esc(c.municipio)}</td><td>${esc(c.unidad)}</td><td>${esc(c.biologico)}</td>
            <td class="spm-pr-num"><b>${p.proyeccionDosis.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</b><small>${p.banda.p10.toLocaleString('es-MX')}–${p.banda.p95.toLocaleString('es-MX')}</small></td>
            <td class="spm-preview-diff">${c.oldProm} &rarr; <strong>${c.newProm}</strong></td>
            <td class="spm-preview-diff">${c.oldMin} &rarr; <strong>${c.newMin}</strong></td>
            <td class="spm-preview-diff">${c.oldMax} &rarr; <strong>${c.newMax}</strong></td>
            <td>${chip(p.confianza.nivel)}</td>
            <td class="spm-pr-why"><details><summary>${esc(p.razones[0])}</summary><ul>${p.razones.slice(1).map((r) => `<li>${esc(r)}</li>`).join('')}${p.confianza.motivos.length ? `<li><b>Confianza:</b> ${esc(p.confianza.motivos.join('; '))}.</li>` : ''}</ul></details></td>
        </tr>`;
    }).join('');
    body.innerHTML = `
        <div class="spm-pr-barra">
            <label><input type="checkbox" id="spmPrTodas"> Marcar todas</label>
            <label><input type="checkbox" id="spmPrOcultaBajas"> Ocultar confianza baja</label>
            <span id="spmPrConteo" class="spm-pr-conteo"></span>
        </div>
        <table class="spm-preview-table spm-pr-tabla">
            <thead><tr><th><span class="vl-sr">Aplicar</span></th><th>Municipio</th><th>Unidad</th><th>Biológico</th>
                <th title="Dosis proyectadas del mes y rango probable">Proyección (dosis)</th><th>Promedio (frascos)</th><th>Mínimo (dosis)</th><th>Máximo (dosis)</th><th>Confianza</th><th>Por qué</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    const actualizarConteo = () => {
        const n = changes.filter((c) => c.sel).length;
        const el = document.getElementById('spmPrConteo');
        if (el) el.textContent = `${n} de ${changes.length} marcadas para aplicar`;
        if (btnConfirm) btnConfirm.textContent = n > 0 ? `Aplicar ${n} marcadas` : 'Nada marcado';
        if (btnConfirm) btnConfirm.disabled = n === 0;
        const todas = document.getElementById('spmPrTodas');
        if (todas) todas.checked = n === changes.length;
    };
    body.querySelectorAll('input[data-i]').forEach((cb) => { cb.onchange = () => { changes[Number(cb.dataset.i)].sel = cb.checked; actualizarConteo(); }; });
    document.getElementById('spmPrTodas').onchange = (e) => {
        changes.forEach((c) => { c.sel = e.target.checked; });
        body.querySelectorAll('input[data-i]').forEach((cb) => { cb.checked = e.target.checked; });
        actualizarConteo();
    };
    document.getElementById('spmPrOcultaBajas').onchange = (e) => {
        body.querySelectorAll('tbody tr[data-conf="baja"]').forEach((tr) => { tr.style.display = e.target.checked ? 'none' : ''; });
    };
    actualizarConteo();
    modal.style.display = 'flex';
};

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
    const usesServiceLevel = (calcMode === 'nivel_servicio' || calcMode === 'reabasto_inteligente' || calcModeRaw === 'proyeccion_inteligente');
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

    // Modo «Proyección inteligente»: tiene su propio flujo (proyeccion_consumo.js) y su propia vista previa
    if (calcModeRaw === 'proyeccion_inteligente') {
        return window.spmRunSmartProjection({ serviceLevelPct, zScore, leadTimeWeeksMean, leadTimeStdWeeks });
    }

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
    if (meta && meta.calcMode === 'proyeccion_inteligente') {
        modal.classList.add('spm-preview--proy');
        return window.spmRenderProyeccionPreview(changes, meta);
    }
    modal.classList.remove('spm-preview--proy');
    window._spmPendingCalcChanges = null;
    if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = 'Confirmar y Guardar en Supabase'; }

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
    window._spmPendingCalcChanges = null;
    const modal = document.getElementById('spmCalcPreviewModal');
    if (modal) modal.style.display = 'none';
    if (typeof showToast === 'function') {
        showToast("Cálculo descartado. No se guardó ningún cambio.", true, 'warn');
    }
};

// 8c. CONFIRMAR Y PERSISTIR EL CÁLCULO MASIVO EN SUPABASE
window.spmConfirmCalcSave = async function() {
    // Proyección inteligente: solo lo que quedó marcado en la vista previa
    const records = window._spmPendingCalcChanges
        ? window._spmPendingCalcChanges.filter((c) => c.sel).map((c) => c.record)
        : window._spmPendingCalcRecords;
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
        window._spmPendingCalcChanges = null;
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
window._spmSugSel = new Set(); // ids marcados para aplicar/descartar

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

        window._spmSugerenciasCache = (data || []).filter(r => !['INFLUENZA', 'VPH', 'COVID-19', 'COVID19', 'COVID 19'].includes(String(r.biologico || '').toUpperCase()));
        window._spmSugSel = new Set();
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
    // Solo conservar marcas de filas que siguen existiendo
    const idsVigentes = new Set(rows.map(r => r.id));
    window._spmSugSel = new Set([...window._spmSugSel].filter(id => idsVigentes.has(id)));

    // Vacunas de campaña/temporada: nunca se sugieren desde este motor (el SQL ya las
    // excluye; esto cubre filas viejas que hayan quedado en staging).
    const EXCLUIDOS = ['INFLUENZA', 'VPH', 'COVID-19', 'COVID19', 'COVID 19'];
    rows = rows.filter(r => !EXCLUIDOS.includes(String(r.biologico || '').toUpperCase()));

    const CAT = {
        RIESGO_DESABASTO:     { txt: 'Subir promedio',      bg: '#fee2e2', fg: '#b91c1c', hint: 'Se quedó sin existencia mientras sí había consumo.' },
        POSIBLE_SOBREABASTO:  { txt: 'Bajar promedio',    bg: '#dcfce7', fg: '#15803d', hint: 'Lo que pide hoy es más de lo que consume.' },
        DATO_ATIPICO_REVISAR: { txt: 'Revisar captura', bg: '#fef3c7', fg: '#b45309', hint: 'Hubo un mes con consumo fuera de lo normal; confirma que no sea error de captura.' },
        SIN_CAMBIO_RELEVANTE: { txt: 'Mantener promedio', bg: '#f1f5f9', fg: '#475569', hint: 'El promedio queda igual; solo cambian Mín/Máx.' }
    };

    const counts = {};
    rows.forEach(r => { counts[r.tipo_cambio] = (counts[r.tipo_cambio] || 0) + 1; });
    const chips = Object.keys(CAT).filter(k => counts[k]).map(k =>
        `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:${CAT[k].bg}; color:${CAT[k].fg}; font-weight:700; font-size:12px; margin:2px 6px 2px 0;">${counts[k]} · ${CAT[k].txt}</span>`
    ).join('');
    summary.innerHTML = `
        <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">${rows.length} cambio(s) por revisar</div>
        <div>${chips}</div>
        <div style="margin-top:6px; font-size:12px; color:#64748b; line-height:1.5;">
            <b>Cómo leerlo:</b> cada tarjeta es una unidad. <b>Pedido</b> = frascos que pide por ciclo (antes &rarr; propuesto).
            <b>Mín</b> y <b>Máx</b> = existencia mínima y máxima en dosis. Los frascos multidosis ya se calculan dividiendo las dosis entre las dosis por frasco.
            Influenza, VPH y COVID-19 no se incluyen.
            <br><b>Marca</b> las que quieras y usa <b>Aplicar seleccionadas</b>; las que no marques se quedan pendientes.
        </div>`;

    // Agrupar por municipio > unidad
    const byMuni = {};
    rows.forEach(r => {
        const m = r.municipio || 'Sin municipio';
        const u = r.unidad || r.clues;
        ((byMuni[m] = byMuni[m] || {})[u] = byMuni[m][u] || []).push(r);
    });

    const dosisPorFrasco = (bio) => DEFAULT_DOSES_PER_BOTTLE[String(bio).toUpperCase()] || 1;
    const frascoTxt = (n) => `${n} frasco${Number(n) === 1 ? '' : 's'}`;

    const bioLine = (r) => {
        const c = CAT[r.tipo_cambio] || CAT.SIN_CAMBIO_RELEVANTE;
        const ant = Number(r.promedio_frascos_actual) || 0;
        const nue = Number(r.promedio_frascos_sugerido) || 0;
        const dif = nue - ant;
        const difTxt = dif === 0 ? '' : ` <span style="color:${dif > 0 ? '#b91c1c' : '#15803d'}; font-weight:700;">(${dif > 0 ? '+' : ''}${dif})</span>`;
        const dpf = dosisPorFrasco(r.biologico);
        const dpfTxt = dpf > 1 ? `<span style="color:#94a3b8;"> · ${dpf} dosis c/u</span>` : '';
        const sem = Number(r.ciclos_insuficientes_recientes) || 0;
        const motivo = sem > 0
            ? `Sin existencia ${sem} semana${sem === 1 ? '' : 's'} con consumo.`
            : c.hint;
        const sel = window._spmSugSel.has(r.id);
        const chk = `<span role="checkbox" tabindex="0" aria-checked="${sel}" aria-label="Seleccionar ${escapeHtml(r.biologico || '')}"
            onclick="window.spmToggleSugerencia('${r.id}')" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();window.spmToggleSugerencia('${r.id}');}"
            style="width:20px; height:20px; border-radius:6px; border:2px solid ${sel ? '#2563eb' : '#94a3b8'}; background:${sel ? '#2563eb' : '#fff'}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; cursor:pointer; user-select:none;">${sel ? '&#10003;' : ''}</span>`;
        return `
            <div style="display:grid; grid-template-columns:26px minmax(120px,1.1fr) minmax(170px,1.6fr) minmax(130px,1fr); gap:8px 14px; align-items:center; padding:9px 0; border-top:1px solid #eef2f7;">
                <div>${chk}</div>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:13px;">${escapeHtml(r.biologico || '')}</div>
                    <span style="display:inline-block; margin-top:3px; padding:2px 8px; border-radius:999px; background:${c.bg}; color:${c.fg}; font-weight:700; font-size:11px;">${c.txt}${r.dato_atipico_detectado && r.tipo_cambio !== 'DATO_ATIPICO_REVISAR' ? ' ⚠️' : ''}</span>
                </div>
                <div style="font-size:13px; color:#334155;">
                    <b>Pedido:</b> ${frascoTxt(ant)} &rarr; <b style="color:#0f172a;">${frascoTxt(nue)}</b>${difTxt}${dpfTxt}
                    <div style="font-size:11.5px; color:#64748b; margin-top:2px;">${motivo}</div>
                </div>
                <div style="font-size:12px; color:#475569; line-height:1.6;">
                    <div><b>Mín:</b> ${r.min_dosis_actual} &rarr; <b>${r.min_dosis_sugerido}</b></div>
                    <div><b>Máx:</b> ${r.max_dosis_actual} &rarr; <b>${r.max_dosis_sugerido}</b></div>
                </div>
            </div>`;
    };

    const html = Object.keys(byMuni).sort().map(muni => {
        const unidades = Object.keys(byMuni[muni]).sort().map(u => `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:10px 16px 4px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding-bottom:6px;">
                    <span style="font-weight:800; color:#0f172a; font-size:13.5px;">${escapeHtml(u)}</span>
                    <button type="button" onclick="window.spmToggleSugerenciasGrupo('${byMuni[muni][u][0].clues}')" style="height:26px; padding:0 10px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; font-size:11.5px; font-weight:700; cursor:pointer;">Elegir unidad</button>
                </div>
                ${byMuni[muni][u].map(bioLine).join('')}
            </div>`).join('');
        return `
            <div style="margin-bottom:14px;">
                <div style="font-size:11.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin:4px 2px 8px;">${escapeHtml(muni)}</div>
                ${unidades}
            </div>`;
    }).join('');

    const barra = `
        <div style="display:flex; gap:8px; align-items:center; margin:2px 2px 12px;">
            <button type="button" onclick="window.spmSeleccionarSugerencias(true)" style="height:30px; padding:0 12px; border-radius:9px; border:1px solid #cbd5e1; background:#fff; color:#334155; font-size:12px; font-weight:700; cursor:pointer;">Seleccionar todas</button>
            <button type="button" onclick="window.spmSeleccionarSugerencias(false)" style="height:30px; padding:0 12px; border-radius:9px; border:1px solid #cbd5e1; background:#fff; color:#334155; font-size:12px; font-weight:700; cursor:pointer;">Quitar selección</button>
        </div>`;
    body.innerHTML = `<div style="padding:4px 2px;">${barra}${html}</div>`;
    window.spmUpdateSugerenciasFooter();
};

/** Actualiza texto/estado de los botones del pie según lo marcado. */
window.spmUpdateSugerenciasFooter = function() {
    const n = window._spmSugSel.size;
    const set = (id, base) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.textContent = n ? `${base} (${n})` : base;
        b.disabled = !n;
        b.style.opacity = n ? '1' : '.5';
        b.style.cursor = n ? 'pointer' : 'not-allowed';
    };
    set('spmBtnAplicarSugerencias', 'Aplicar seleccionadas');
    set('spmBtnDescartarSugerencias', 'Descartar seleccionadas');
};

window.spmToggleSugerencia = function(id) {
    if (window._spmSugSel.has(id)) window._spmSugSel.delete(id); else window._spmSugSel.add(id);
    window.spmRenderSugerenciasModal(window._spmSugerenciasCache);
};

window.spmSeleccionarSugerencias = function(todas) {
    window._spmSugSel = new Set(todas ? (window._spmSugerenciasCache || []).map(r => r.id) : []);
    window.spmRenderSugerenciasModal(window._spmSugerenciasCache);
};

/** Marca/desmarca todas las filas de una unidad (si ya están todas marcadas, las quita). */
window.spmToggleSugerenciasGrupo = function(clues) {
    const ids = (window._spmSugerenciasCache || []).filter(r => r.clues === clues).map(r => r.id);
    const todas = ids.length > 0 && ids.every(id => window._spmSugSel.has(id));
    ids.forEach(id => todas ? window._spmSugSel.delete(id) : window._spmSugSel.add(id));
    window.spmRenderSugerenciasModal(window._spmSugerenciasCache);
};

/** Filas marcadas, tomadas de la caché. */
window._spmSugerenciasSeleccionadas = function() {
    return (window._spmSugerenciasCache || []).filter(r => window._spmSugSel.has(r.id));
};

/** Quita de la caché las filas ya resueltas y refresca (o cierra si no queda nada). */
window._spmSugerenciasQuitar = function(ids) {
    const set = new Set(ids);
    window._spmSugerenciasCache = (window._spmSugerenciasCache || []).filter(r => !set.has(r.id));
    ids.forEach(id => window._spmSugSel.delete(id));
    window.spmRefreshSugerenciasBadge();
    if (window._spmSugerenciasCache.length === 0) window.spmCerrarSugerenciasModal();
    else window.spmRenderSugerenciasModal(window._spmSugerenciasCache);
};

window.spmCerrarSugerenciasModal = function() {
    const modal = document.getElementById('spmSugerenciasModal');
    if (modal) modal.style.display = 'none';
};

/** Copia SOLO las sugerencias marcadas a biologicos_params (aprobación humana explícita). */
window.spmAplicarSugerenciasSeleccionadas = async function() {
    const rows = window._spmSugerenciasSeleccionadas();
    if (rows.length === 0) return;

    const confirmApply = await window.showConfirmDialog(
        'Aplicar Sugerencias de Reabasto Inteligente',
        `¿Aplicar ${rows.length} sugerencia(s) seleccionada(s)? Esto reemplaza el Promedio/Mínimo/Máximo vigente de cada unidad+biológico marcado. Las demás siguen pendientes.`
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

        window._spmSugerenciasQuitar(ids);

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

/** Descarta SOLO las sugerencias marcadas sin aplicarlas (el motor las regenerará si sigue aplicando el criterio). */
window.spmDescartarSugerenciasSeleccionadas = async function() {
    const rows = window._spmSugerenciasSeleccionadas();
    if (rows.length === 0) return;

    const confirmDiscard = await window.showConfirmDialog(
        'Descartar Sugerencias Pendientes',
        `¿Descartar ${rows.length} sugerencia(s) seleccionada(s) sin aplicarlas? El motor las volverá a generar en su próxima corrida si las condiciones siguen igual.`
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

        window._spmSugerenciasQuitar(ids);
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
