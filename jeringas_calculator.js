/**
 * jeringas_calculator.js — Consola de Cálculo de Jeringas por Unidad de Salud (SIREVAQ)
 * Módulo autónomo, independiente de param_calculator.js/rda_calculator.js: no reutiliza ni
 * modifica sus estructuras. Aquí SÍ se cuentan todas las aplicaciones de cada biológico (sin el
 * filtrado por esquema/variable que hace el motor de indicadores RDA), porque lo que importa para
 * estimar jeringas es cuántas veces se picó una aguja, no si esa dosis cuenta para un indicador.
 *
 * Conectado con la tabla `jeringas_params` (independiente de `biologicos_params`) y con el
 * histórico real de productividad SIS (`registros_sis`), resuelto contra el mapeo vigente de
 * variables por biológico en `sis_variables_mapeo` (el mismo que usa el panel "Mapeador SIS"),
 * en vez de hardcodear códigos de variable aquí — así, si el mapeo cambia de año a año, este
 * motor no se desincroniza.
 */

window._jerUnitsList = [];
window._jerParamsMap = {}; // Clave: `${clues}|${jeringa}` -> objeto parámetro
window._jerActiveClues = null;
window._jerUserRole = null;
window._jerUserMunis = []; // Municipios permitidos para el usuario actual (null = todos)
window._jerPendingCalcRecords = null; // Registros calculados pendientes de confirmar (vista previa)
window._jerSisMappingCache = null; // { anio, map: Map<BIOLOGICO_MAYUSC, string[]> }

window.jerGetCurrentUsername = function() {
    const u = window.USER || {};
    return u.usuario || u.nombre || u.email || 'Desconocido';
};

/**
 * Los 5 tipos de jeringa del catálogo de compras, en el orden en que se capturan.
 * `bioKeys` son las llaves de `sis_variables_mapeo.biologico` cuyas aplicaciones cuentan para
 * esa jeringa — se listan variantes conocidas (con/sin prefijo MOTHER_) para que el cálculo no
 * se rompa si el Mapeador SIS solo tiene una de las dos variantes en un año dado; el motor une
 * (sin duplicar) las variables de todas las llaves que sí existan para el año consultado.
 */
const JERINGA_DEFS = [
    {
        key: '27x13', nombre: '27x13 mm', colorLabel: 'Gris', swatchCss: '#94a3b8',
        tileText: '27·13', tileTextColor: '#1e293b', captionColor: '#64748b', cajaSize: 100,
        usoLabel: 'BCG, SR, SRP y Varicela',
        bioKeys: ['MOTHER_BCG', 'BCG', 'MOTHER_SR', 'MOTHER_SRP', 'SRP_1', 'SRP_2', 'MOTHER_VARICELA', 'VARICELA'],
        clave: '25411.060-550-2657',
        descripcion: 'JERINGAS DE PLÁSTICO, PARA APLICAR BCG Y ANTISARAMPIÓN, CAPACIDAD 0.5 ML CON DOS AGUJAS.UNA CALIBRE 20 X 32 MM PARA CARGAR LA JERINGA CON EL BIOLÓGICO Y OTRA 27 X 13 MM PARA APLICAR LA VACUNA,CADA JERINGA CON LA LEYENDA PROGRAMA DE ATENC'
    },
    {
        key: '25x16', nombre: '25x16 mm', colorLabel: 'Naranja', swatchCss: '#c2410c',
        tileText: '25·16', tileTextColor: '#ffffff', captionColor: '#c2410c', cajaSize: 50,
        usoLabel: 'Hepatitis B — únicamente recién nacido (VAC06)',
        bioKeys: ['HepB_0_7', 'HEPB_0_7'],
        clave: '25411.060-550-2699',
        descripcion: 'JERINGA DESECHABLE PARA APLICAR VACUNA CONTRA HEPATITIS B, CAPACIDAD 1.0 ML. GRADUADA EN DÉCIMAS DE ML.CON DOS AGUJAS: UNA DE CALIBRE 20X32 MM.PARA CARGAR. LA JERINGA CON EL BIOLÓGICO Y OTRA DE CALIBRE 25 X 16 PARA APLICAR LA VACUNA, CON E'
    },
    {
        key: '23x25', nombre: '23x25 mm', colorLabel: 'Azul', swatchCss: '#2563eb',
        tileText: '23·25', tileTextColor: '#ffffff', captionColor: '#1d4ed8', cajaSize: 50,
        usoLabel: 'DPT, Hepatitis A y Hexavalente',
        bioKeys: ['MOTHER_DPT', 'DPT_4', 'MOTHER_HEPATITIS_A', 'HEPATITIS_A', 'MOTHER_HEXAVALENTE'],
        clave: '25411.060-550-2707',
        descripcion: 'JERINGA DESECHABLE PARA APLICAR 0.25 ML. DE VACUNA ANTIINFLUENZA; CAPACIDAD DE 0.5 ML. GRADUADA EN DÉCIMAS DE ML. (0.25 ML.) CON DOS AGUJAS:UNA CALIBRE 20X32 MM. PARA CARGAR LA JERINGA CON EL BIOLÓGICO Y OTRA CALIBRE 23X25 MM. PARA APLICA'
    },
    {
        key: '22x32', nombre: '22x32 mm', colorLabel: 'Negro', swatchCss: '#0f172a',
        tileText: '22·32', tileTextColor: '#ffffff', captionColor: '#0f172a', cajaSize: 50,
        usoLabel: 'TD, TDPa, Hepatitis B (adolescente/adulto) y VPH',
        bioKeys: ['MOTHER_TD', 'AM_TD', 'MOTHER_TDPA', 'ADOL_TDPA', 'EMB_TDPA', 'ADOL_HB', 'MOTHER_VPH', 'ADOL_VPH'],
        clave: '25411.060-550-2715',
        descripcion: 'JERINGA DESECHABLE PARA APLICAR 0.5 ML. DE VACUNA ANTIINFLUENZA EN ADULTOS; DPT + HEPATITIS B + HIB; DPT, Y TOXOIDE TETÁNICO; CAPACIDAD DE 0.5 ML. GRADUADA EN DÉCIMAS DE ML. CON DOS AGUJAS: UNA CALIBRE 20X32 MM. PARA CARGAR LA JERINGA CON'
    },
    {
        key: 'terumo', nombre: 'Terumo (Insulina 30G)', colorLabel: 'Verde / Naranja', swatchCss: 'linear-gradient(135deg,#16a34a 50%,#f97316 50%)',
        tileText: 'TERUMO', tileTextColor: '#ffffff', captionColor: '#166534', cajaSize: 100,
        usoLabel: 'BCG — mismas aplicaciones que 27x13, cálculo en paralelo',
        bioKeys: ['MOTHER_BCG', 'BCG'],
        clave: '25411.060X 0059',
        descripcion: 'JERINGA PARA INSULINA, INSULIN SYRINGE AGUJA NEEDLE 30G. X 13MM. (30GX1/2) CAP. 1 ML.  ULTRA FINE JERINGA DE PLASTICO ESTERIL ATOXICA SIN PIRÓGENOS, SE CARACTERIZA PORQUE LA AGUJA VIENE ADHERIDA AL CUERPO DE LA JERINGA-CONTENIDO ESTERIL  CAJA CON 100 PIEZAS. '
    }
];

/**
 * Identidad visual de cada jeringa — SIN chips/pastillas: un ícono cuadrado (tile) con el
 * calibre grabado en el color real de la jeringa, y el nombre del color como texto plano
 * (sin caja) debajo del nombre. Nada de forma "pill" ni punto de color aislado.
 */
function jerIconTileHtml(def) {
    return `<div style="width:36px; height:36px; border-radius:10px; background:${def.swatchCss}; color:${def.tileTextColor}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:9.5px; letter-spacing:-0.02em; flex-shrink:0; box-shadow: inset 0 -3px 5px rgba(0,0,0,0.15), 0 1px 2px rgba(15,23,42,0.12);">${def.tileText}</div>`;
}

function jerColorCaptionHtml(def) {
    return `<span style="font-size:9.5px; font-weight:800; color:${def.captionColor}; text-transform:uppercase; letter-spacing:0.05em;">${def.colorLabel}</span>`;
}

// 1. INICIALIZADOR PRINCIPAL DE LA CONSOLA CON CONTROL ESTRICTO DE ROLES
window.initConsoleJeringas = async function() {
    let user = window.USER || {};
    if (!user.rol && !user.role) {
        try {
            const { data } = await window.supabase.auth.getUser();
            user = data?.user || {};
        } catch (_) { /* no session */ }
    }
    const roleRaw = (user.rol || user.role || "").toUpperCase();

    // Solo Municipal, Jurisdiccional y Admin — mismas jerarquías que el panel de Parámetros.
    const allowedRoles = ["ADMIN", "JURISDICCIONAL", "MUNICIPAL"];
    if (!allowedRoles.includes(roleRaw)) {
        const container = document.getElementById('adminSection_jeringas');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; margin-top: 20px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🚫</div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">Acceso Restringido</h3>
                    <p style="margin-top: 6px; font-size: 13px; color: #64748b;">Tu perfil no tiene permisos para consultar ni editar el cálculo de jeringas.</p>
                </div>
            `;
        }
        return;
    }

    window._jerUserRole = roleRaw;

    // Determinar municipios permitidos según perfil (idéntico criterio a param_calculator.js)
    let allowedMunis = [];
    if (roleRaw === "ADMIN" || roleRaw === "JURISDICCIONAL") {
        allowedMunis = null; // Todos los municipios
    } else {
        const muniAllowed = Array.isArray(user.municipiosAllowed) ? user.municipiosAllowed : [];
        if (muniAllowed.includes("*")) {
            allowedMunis = null;
        } else if (muniAllowed.length > 0) {
            allowedMunis = muniAllowed;
        } else if (user.municipio) {
            allowedMunis = String(user.municipio).split(/[;,]/).map(m => m.trim()).filter(Boolean);
        } else {
            allowedMunis = [];
        }
    }
    window._jerUserMunis = allowedMunis;

    const muniSelect = document.getElementById('jerParamMuniSelect');
    if (muniSelect) {
        muniSelect.disabled = allowedMunis !== null && allowedMunis.length <= 1;
    }

    // La calculadora masiva desde histórico SIS requiere las mismas RPCs que usa Parámetros,
    // las cuales están restringidas por RLS a ADMIN/JURISDICCIONAL — Municipal no puede llamarlas,
    // así que se oculta el botón para evitar un error de permisos al hacer clic.
    // .spm-btn-icon-custom fija "display: inline-flex !important" en CSS, así que un
    // style.display normal (sin prioridad) no lo tapa — hay que igualar la prioridad con
    // setProperty(..., 'important') o el botón se queda visible/clickeable para Municipal.
    const btnAdminCalc = document.getElementById('jerBtnAdminCalc');
    if (btnAdminCalc) {
        btnAdminCalc.style.setProperty('display', (roleRaw === "ADMIN" || roleRaw === "JURISDICCIONAL") ? "inline-flex" : "none", "important");
    }
    const bufferWrap = document.getElementById('jerBufferPctWrap');
    if (bufferWrap) {
        bufferWrap.style.setProperty('display', (roleRaw === "ADMIN" || roleRaw === "JURISDICCIONAL") ? "flex" : "none", "important");
    }

    // El botón de exportar es el mismo para todos, pero para Municipal exporta directo
    // su propio municipio (sin menú) — el título refleja esa diferencia.
    const btnExport = document.getElementById('jerBtnExport');
    if (btnExport) {
        btnExport.title = (roleRaw === "MUNICIPAL")
            ? "Exportar Excel de mi municipio"
            : "Exportar a Excel (concentrado, por municipio o total jurisdiccional)";
    }

    await window.jerLoadAllData();
};

// 2. CARGAR UNIDADES Y PARÁMETROS REALES DESDE SUPABASE
window.jerLoadAllData = async function() {
    if (typeof showOverlay === 'function') {
        showOverlay("Cargando cálculo de jeringas...", "Jeringas por Unidad de Salud");
    }

    try {
        let queryUnits = window.supabase
            .from('unidades')
            .select('clues, unidad, municipio')
            .eq('activo', 'SI')
            .order('municipio')
            .order('unidad');

        if (window._jerUserMunis !== null && window._jerUserMunis.length > 0) {
            queryUnits = queryUnits.in('municipio', window._jerUserMunis);
        }

        const { data: unitsData, error: errUnits } = await queryUnits;
        if (errUnits) throw errUnits;

        window._jerUnitsList = unitsData || [];

        // Paginado: igual que biologicos_params, jeringas_params puede superar el corte de ~1000
        // filas por defecto de Supabase a medida que se van guardando más unidades/jeringas.
        let paramsData = [];
        let pFrom = 0;
        const pStep = 1000;
        let pHasMore = true;
        while (pHasMore) {
            const { data: pChunk, error: errParams } = await window.supabase
                .from('jeringas_params')
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

        window._jerParamsMap = {};
        (paramsData || []).forEach(p => {
            const jerNorm = (p.jeringa || "").toLowerCase().trim();
            window._jerParamsMap[`${p.clues}|${jerNorm}`] = p;
        });

        window.jerPopulateMuniSelect();

        const selectedMuni = document.getElementById('jerParamMuniSelect')?.value || "";
        window.jerFilterUnitsByMuni(selectedMuni);

    } catch (e) {
        console.error("Error al cargar datos en módulo de jeringas:", e);
        if (typeof showToast === 'function') {
            showToast("Error al cargar jeringas: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// 3. POBLAR SELECTOR DE MUNICIPIOS
window.jerPopulateMuniSelect = function() {
    const select = document.getElementById('jerParamMuniSelect');
    if (!select) return;

    const munis = Array.from(new Set(window._jerUnitsList.map(u => u.municipio))).filter(Boolean).sort();

    let html = '';
    if (window._jerUserMunis === null) {
        html += `<option value="">Todos los Municipios (${munis.length})</option>`;
    }

    munis.forEach(m => {
        const count = window._jerUnitsList.filter(u => u.municipio === m).length;
        html += `<option value="${m}">Municipio: ${m} (${count} Unidades)</option>`;
    });

    select.innerHTML = html;
};

// 4. FILTRAR Y RENDERIZAR LISTA LATERAL DE UNIDADES
window.jerFilterUnitsByMuni = function(muni) {
    const container = document.getElementById('jerUnitsListContainer');
    if (!container) return;

    let filtered = window._jerUnitsList;
    if (muni) {
        filtered = filtered.filter(u => u.municipio === muni);
    }

    let reviewedCount = 0;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No hay unidades registradas.</div>`;
        window.jerRenderUnitMatrix(null);
        return;
    }

    const html = filtered.map(u => {
        const hasParams = JERINGA_DEFS.some(def => window._jerParamsMap[`${u.clues}|${def.key}`]);
        if (hasParams) reviewedCount++;

        const isDotClass = hasParams ? "spm-dot-reviewed" : "spm-dot-pending";
        const dotTitle = hasParams ? "Guardado en BD" : "Pendiente de revisión";
        const activeClass = (u.clues === window._jerActiveClues) ? "active" : "";

        return `
            <div class="spm-unit-card-item ${activeClass}" data-clues="${u.clues}" onclick="window.jerSelectUnit('${u.clues}')">
                <div class="spm-unit-item-title">${u.unidad}</div>
                <span class="spm-status-dot ${isDotClass}" title="${dotTitle}"></span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    const counterEl = document.getElementById('jerUnitsProgressCounter');
    if (counterEl) {
        counterEl.textContent = `${reviewedCount} / ${filtered.length} Rev.`;
    }

    const firstClues = filtered[0]?.clues;
    if (firstClues && (!window._jerActiveClues || !filtered.some(u => u.clues === window._jerActiveClues))) {
        window.jerSelectUnit(firstClues);
    }
};

// 5. SELECCIONAR UNA UNIDAD Y MOSTRAR SUS 5 TIPOS DE JERINGA
window.jerSelectUnit = function(clues) {
    window._jerActiveClues = clues;

    document.querySelectorAll('#jerUnitsListContainer .spm-unit-card-item').forEach(el => {
        el.classList.toggle('active', el.dataset.clues === clues);
    });

    const unitObj = window._jerUnitsList.find(u => u.clues === clues);
    if (!unitObj) return;

    document.getElementById('jerActiveUnitName').textContent = unitObj.unidad;

    const hasParams = JERINGA_DEFS.some(def => window._jerParamsMap[`${clues}|${def.key}`]);
    const activeDot = document.getElementById('jerActiveUnitDot');
    if (activeDot) {
        activeDot.className = `spm-status-dot ${hasParams ? 'spm-dot-reviewed' : 'spm-dot-pending'}`;
    }

    window.jerRenderUnitMatrix(unitObj);
};

// 6. RENDERIZAR MATRIZ DE EDICIÓN DE LOS 5 TIPOS DE JERINGA PARA LA UNIDAD SELECCIONADA
window.jerRenderUnitMatrix = function(unit) {
    const tbody = document.getElementById('jerMatrixTbody');
    if (!tbody) return;

    if (!unit) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color:#64748b; font-size:13px;">Selecciona una unidad para editar su cálculo de jeringas.</td></tr>`;
        return;
    }

    const html = JERINGA_DEFS.map((def, idx) => {
        const key = `${unit.clues}|${def.key}`;
        const p = window._jerParamsMap[key] || {};

        const minVal = p.min_cajas !== undefined ? p.min_cajas : 0;
        const maxVal = p.max_cajas !== undefined ? p.max_cajas : 0;
        const promVal = p.promedio_cajas !== undefined ? p.promedio_cajas : 0;

        const idxStr = String(idx + 1).padStart(2, '0');

        return `
            <tr data-jeringa="${def.key}">
                <td><span class="spm-bio-idx-badge">${idxStr}</span></td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${jerIconTileHtml(def)}
                        <div>
                            <div style="display:flex; align-items:center; gap:7px;">
                                <span class="spm-bio-name-lbl">${def.nombre}</span>
                                ${jerColorCaptionHtml(def)}
                            </div>
                            <div style="font-size:9.5px; font-weight:700; color:#64748b; margin-top:1px;">Caja de ${def.cajaSize} · ${def.usoLabel}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <input type="number" class="spm-input-num-clean jer-inp-prom" data-jeringa="${def.key}" value="${promVal}" min="0">
                </td>
                <td>
                    <input type="number" class="spm-input-num-clean jer-inp-min" data-jeringa="${def.key}" value="${minVal}" min="0">
                </td>
                <td>
                    <input type="number" class="spm-input-num-clean jer-inp-max" data-jeringa="${def.key}" value="${maxVal}" min="0">
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;

    const dbStatusText = document.getElementById('jerDbStatusText');
    if (dbStatusText) {
        dbStatusText.innerHTML = `Estado: <strong>Guardado en la base de datos</strong>`;
    }

    window.jerRenderLastUpdatedInfo(unit);
};

// 6b. MOSTRAR QUIÉN/CUÁNDO FUE LA ÚLTIMA MODIFICACIÓN DE LA UNIDAD (AUDITORÍA)
window.jerRenderLastUpdatedInfo = function(unit) {
    const updatedEl = document.getElementById('jerLastUpdatedText');
    if (!updatedEl || !unit) return;

    let latest = null;
    JERINGA_DEFS.forEach(def => {
        const p = window._jerParamsMap[`${unit.clues}|${def.key}`];
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

// 7. GUARDAR CAMBIOS DE LA UNIDAD EN SUPABASE (UPSERT A `jeringas_params`)
window.jerSaveCurrentUnitParams = async function() {
    if (!window._jerActiveClues) {
        if (typeof showToast === 'function') showToast("Selecciona una unidad primero", false, "warn");
        return;
    }

    const unitObj = window._jerUnitsList.find(u => u.clues === window._jerActiveClues);
    if (!unitObj) return;

    const tbody = document.getElementById('jerMatrixTbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-jeringa]');
    const recordsToUpsert = [];

    rows.forEach(tr => {
        const jeringa = tr.dataset.jeringa;
        const promInput = tr.querySelector('.jer-inp-prom');
        const minInput = tr.querySelector('.jer-inp-min');
        const maxInput = tr.querySelector('.jer-inp-max');

        const promVal = parseInt(promInput.value, 10) || 0;
        const minVal = parseInt(minInput.value, 10) || 0;
        const maxVal = parseInt(maxInput.value, 10) || 0;

        recordsToUpsert.push({
            clues: unitObj.clues,
            unidad: unitObj.unidad || 'Unidad',
            municipio: unitObj.municipio || '*',
            jeringa: jeringa,
            promedio_cajas: promVal,
            min_cajas: minVal,
            max_cajas: maxVal,
            activo: 'SI',
            updated_by: window.jerGetCurrentUsername(),
            updated_at: new Date().toISOString()
        });
    });

    if (typeof showOverlay === 'function') {
        showOverlay(`Guardando cálculo de jeringas de ${unitObj.unidad}...`, "Guardado de Jeringas");
    }

    try {
        const { error } = await window.supabase
            .from('jeringas_params')
            .upsert(recordsToUpsert, { onConflict: 'clues,jeringa' });

        if (error) throw error;

        recordsToUpsert.forEach(p => {
            window._jerParamsMap[`${p.clues}|${p.jeringa}`] = p;
        });

        const statusEl = document.getElementById('jerDbStatusText');
        if (statusEl) {
            statusEl.innerHTML = `Estado: <strong style="color:#10b981;">Guardado en la base de datos</strong>`;
        }

        window.jerRenderLastUpdatedInfo(unitObj);
        window.jerFilterUnitsByMuni(document.getElementById('jerParamMuniSelect')?.value || "");

        if (typeof showToast === 'function') {
            showToast(`¡Cálculo de jeringas de ${unitObj.unidad} guardado con éxito!`, true, 'good');
        }

    } catch (e) {
        console.error("Error al guardar jeringas:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar en base de datos: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

/**
 * Trae (con caché en memoria por año) el mapeo vigente `biologico -> [variables]` desde
 * `sis_variables_mapeo`. Se consulta directo a la tabla en vez de usar window.DICT_RDA porque
 * ese objeto es un respaldo hardcodeado en rda_calculator.js que puede quedar desactualizado
 * respecto a lo que un admin ya editó en el Mapeador SIS para el año en curso.
 */
window.jerFetchSisMapping = async function(anio) {
    if (window._jerSisMappingCache && window._jerSisMappingCache.anio === anio) {
        return window._jerSisMappingCache.map;
    }

    const { data, error } = await window.supabase
        .from('sis_variables_mapeo')
        .select('biologico, variables')
        .eq('anio', anio);

    if (error) throw error;

    const map = new Map();
    (data || []).forEach(row => {
        const k = String(row.biologico || '').toUpperCase().trim();
        if (!k) return;
        const existing = map.get(k) || [];
        map.set(k, existing.concat(row.variables || []));
    });

    window._jerSisMappingCache = { anio, map };
    return map;
};

/** Une (sin duplicar) las variables de todas las llaves de biológico listadas en `def.bioKeys` que existan en `mappingMap`. */
window.jerResolveVarsForJeringa = function(def, mappingMap) {
    const set = new Set();
    def.bioKeys.forEach(k => {
        const arr = mappingMap.get(k.toUpperCase());
        if (arr) arr.forEach(v => set.add(String(v).toUpperCase().trim()));
    });
    return set;
};

/** Alterna entre el input de "% Colchón" y el selector de "Nivel de servicio" según el modo elegido. */
window.jerToggleCalcMode = function() {
    const mode = document.getElementById('jerCalcMode')?.value;
    const colchonWrap = document.getElementById('jerColchonInputWrap');
    const serviceWrap = document.getElementById('jerServiceLevelWrap');
    if (colchonWrap) colchonWrap.style.display = (mode === 'nivel_servicio') ? 'none' : 'flex';
    if (serviceWrap) serviceWrap.style.display = (mode === 'nivel_servicio') ? 'flex' : 'none';
};

/** Muestra/oculta la explicación de "Colchón fijo" vs "Nivel de servicio". */
window.jerToggleCalcModeInfo = function() {
    const panel = document.getElementById('jerCalcModeInfoPanel');
    if (!panel) return;
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
};

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('jerCalcModeInfoWrap');
    const panel = document.getElementById('jerCalcModeInfoPanel');
    if (!wrap || !panel || panel.style.display === 'none') return;
    if (!wrap.contains(e.target)) panel.style.display = 'none';
});

// 8. CALCULADORA ADMIN MASIVA DESDE HISTÓRICO SIS (SOLO ADMIN/JURISDICCIONAL — mismo límite que RLS de las RPCs)
window.jerRunAdminCalculation = async function() {
    // Respaldo por si el botón queda visible para Municipal por algún problema de CSS (ya
    // pasó una vez): sin esto, el único freno era ocultar el botón, y si ese freno fallaba
    // el usuario topaba directo con el error crudo de la RPC restringida por RLS.
    if (window._jerUserRole !== "ADMIN" && window._jerUserRole !== "JURISDICCIONAL") {
        if (typeof showToast === 'function') {
            showToast("Tu perfil no tiene permisos para ejecutar la calculadora automática.", false, 'bad');
        }
        return;
    }

    const currentYear = new Date().getFullYear();

    const bufferInput = document.getElementById('jerBufferPct');
    let bufferPct = parseFloat(bufferInput?.value);
    if (!Number.isFinite(bufferPct) || bufferPct < 0) bufferPct = 10;
    const bufferMultiplier = 1 + (bufferPct / 100);

    // Modo "Nivel de servicio": el Promedio (punto de reorden) se calcula con la desviación
    // estándar del consumo mensual real en vez de un % fijo — una unidad con demanda errática
    // recibe más colchón que una estable aunque tengan el mismo promedio. Mínimo y Máximo NO
    // cambian de fórmula en este modo (siguen siendo el mes más bajo/alto observado × colchón,
    // igual que en modo "Colchón fijo") — así "máximo" sigue significando lo mismo para quien
    // ya está acostumbrado a leerlo.
    const calcModeEl = document.getElementById('jerCalcMode');
    const calcMode = calcModeEl?.value === 'nivel_servicio' ? 'nivel_servicio' : 'colchon_fijo';
    const JER_Z_SCORES = { '90': 1.28, '95': 1.65, '99': 2.33 };
    const serviceLevelEl = document.getElementById('jerServiceLevel');
    const serviceLevelPct = calcMode === 'nivel_servicio' ? (serviceLevelEl?.value || '95') : null;
    const zScore = JER_Z_SCORES[serviceLevelPct] || 1.65;

    const confirmMsg = calcMode === 'nivel_servicio'
        ? `¿Deseas calcular automáticamente las cajas de jeringas del año ${currentYear} para todas las unidades activas? El Promedio usará el modo "Nivel de servicio" (${serviceLevelPct}%, z=${zScore}) sobre la variabilidad real de consumo; Mínimo y Máximo siguen usando el colchón fijo del ${bufferPct}%.`
        : `¿Deseas calcular automáticamente las cajas de jeringas (Promedio/Mínimo/Máximo) del año ${currentYear}, con un colchón del ${bufferPct}%, para todas las unidades activas?`;

    const confirmCalc = await window.showConfirmDialog(
        "Ejecutar Calculadora de Jeringas SIS",
        confirmMsg
    );
    if (!confirmCalc) return;

    const PROGRESS_STEPS = 4;
    const badge = "CALCULADORA DE JERINGAS";
    const setStep = (n, msg) => {
        if (typeof updateOverlayProgress === 'function') {
            updateOverlayProgress(n, PROGRESS_STEPS, msg, "Calculadora de Jeringas", badge);
        } else if (typeof showOverlay === 'function') {
            showOverlay(msg, "Calculadora de Jeringas");
        }
    };
    if (typeof showProgressOverlay === 'function') {
        showProgressOverlay("Consultando meses activos...", "Calculadora de Jeringas", badge);
    }
    setStep(1, "Paso 1 de 4 — Consultando meses activos del año...");

    try {
        const { data: dbMonths, error: errMonths } = await window.supabase
            .rpc('get_registros_sis_active_months', { p_anio: currentYear });

        if (errMonths) throw errMonths;

        const activeMonths = (dbMonths || [])
            .map(r => r.mes)
            .filter(m => Number.isInteger(m) && m >= 1 && m <= 12)
            .sort((a, b) => a - b);

        if (activeMonths.length === 0) {
            if (typeof showToast === 'function') {
                showToast(`No hay registros SIS cargados para el año ${currentYear}. No se modificó ningún parámetro.`, false, 'bad');
            }
            return;
        }

        const lastMonth = Math.max(...activeMonths);
        const numMonths = lastMonth;

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
            setStep(1, "Paso 1 de 4 — Consultando meses activos del año...");
        }

        // Paso 2: resolver, para cada jeringa, qué códigos de variable SIS le corresponden
        // según el mapeo vigente (sis_variables_mapeo) — esto viaja al servidor para que la
        // suma se haga ahí (ver Paso 3), en vez de traer al navegador cada fila cruda.
        setStep(2, "Paso 2 de 4 — Resolviendo variables por jeringa según el Mapeador SIS...");
        const sisMapping = await window.jerFetchSisMapping(currentYear);
        const variableMap = {};
        JERINGA_DEFS.forEach(def => {
            variableMap[def.key] = Array.from(window.jerResolveVarsForJeringa(def, sisMapping));
        });

        // Paso 3: UNA sola agregación en el servidor (clues, jeringa, mes) -> suma de aplicaciones.
        // Antes esto traía ~190,000 filas crudas al navegador en 194 páginas de 1000 (por eso se
        // sentía "trabado" sin avance); ahora la BD ya entrega los totales agrupados por jeringa.
        setStep(3, "Paso 3 de 4 — Agregando aplicaciones por jeringa en el servidor...");
        let monthlyTotalsData = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: chunk, error: errAgg } = await window.supabase
                .rpc('get_jeringas_monthly_totals', { p_anio: currentYear, p_variable_map: variableMap })
                .range(from, from + step - 1);

            if (errAgg) throw errAgg;

            if (chunk && chunk.length > 0) {
                monthlyTotalsData = monthlyTotalsData.concat(chunk);
                from += step;
                if (chunk.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        const regMap = {};
        monthlyTotalsData.forEach(r => {
            const k = `${r.clues}|${r.jeringa}|${r.mes}`;
            regMap[k] = (regMap[k] || 0) + Number(r.total_valor || 0);
        });

        // Paso 4: con los totales ya agregados, solo queda calcular promedio/mínimo/máximo
        // en cajas por unidad — esto es aritmética en memoria, ya no requiere más consultas.
        setStep(4, "Paso 4 de 4 — Calculando cajas por unidad de salud...");

        const changes = [];
        window._jerUnitsList.forEach(u => {
            JERINGA_DEFS.forEach(def => {
                const monthlyTotals = [];
                for (let m = 1; m <= lastMonth; m++) {
                    monthlyTotals.push(regMap[`${u.clues}|${def.key}|${m}`] || 0);
                }

                const sumApps = monthlyTotals.reduce((a, b) => a + b, 0);
                const rawAvg = sumApps / numMonths;
                const rawMin = Math.min(...monthlyTotals);
                const rawMax = Math.max(...monthlyTotals);

                // Colchón (ajustable por el usuario, 10% por defecto) sobre Mínimo y Máximo en
                // ambos modos; el Promedio usa colchón fijo O nivel de servicio, según jerCalcMode.
                let avgWithBuffer;
                if (calcMode === 'nivel_servicio') {
                    const variance = monthlyTotals.reduce((a, v) => a + Math.pow(v - rawAvg, 2), 0) / monthlyTotals.length;
                    const stdDev = Math.sqrt(variance);
                    avgWithBuffer = rawAvg + zScore * stdDev;
                } else {
                    avgWithBuffer = rawAvg * bufferMultiplier;
                }
                const minWithBuffer = rawMin * bufferMultiplier;
                const maxWithBuffer = rawMax * bufferMultiplier;

                const promedioCajas = Math.ceil(avgWithBuffer / def.cajaSize);
                const minCajas = Math.ceil(minWithBuffer / def.cajaSize);
                const maxCajas = Math.max(minCajas, Math.ceil(maxWithBuffer / def.cajaSize));

                const key = `${u.clues}|${def.key}`;
                const existing = window._jerParamsMap[key] || {};

                const record = {
                    clues: u.clues,
                    unidad: u.unidad,
                    municipio: u.municipio,
                    jeringa: def.key,
                    promedio_cajas: promedioCajas,
                    min_cajas: minCajas,
                    max_cajas: maxCajas,
                    activo: 'SI'
                };

                const oldProm = existing.promedio_cajas !== undefined ? existing.promedio_cajas : 0;
                const oldMin = existing.min_cajas !== undefined ? existing.min_cajas : 0;
                const oldMax = existing.max_cajas !== undefined ? existing.max_cajas : 0;

                if (oldProm !== promedioCajas || oldMin !== minCajas || oldMax !== maxCajas) {
                    changes.push({
                        clues: u.clues,
                        unidad: u.unidad,
                        municipio: u.municipio,
                        jeringaDef: def,
                        oldProm, oldMin, oldMax,
                        newProm: promedioCajas, newMin: minCajas, newMax: maxCajas,
                        record
                    });
                }
            });
        });

        window._jerPendingCalcRecords = changes.map(c => c.record);
        window.jerShowCalcPreview(changes, { currentYear, lastMonth, numMonths, missingMonths, bufferPct });

    } catch (e) {
        console.error("Error al ejecutar Calculadora de Jeringas:", e);
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
window.jerShowCalcPreview = function(changes, meta) {
    const modal = document.getElementById('jerCalcPreviewModal');
    const body = document.getElementById('jerCalcPreviewBody');
    const summary = document.getElementById('jerCalcPreviewSummary');
    const btnConfirm = document.getElementById('jerBtnCalcPreviewConfirm');
    if (!modal || !body || !summary) return;

    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    summary.textContent = `Periodo evaluado: Enero a ${MONTH_NAMES[meta.lastMonth]} ${meta.currentYear} (${meta.numMonths} meses) · Colchón: ${meta.bufferPct}% · ${changes.length} parámetros con cambios de ${window._jerUnitsList.length * JERINGA_DEFS.length} evaluados`;

    if (changes.length === 0) {
        body.innerHTML = `<div style="padding:30px; text-align:center; color:#64748b; font-size:13px;">No hay cambios respecto a los valores actualmente guardados. No es necesario guardar nada.</div>`;
        if (btnConfirm) btnConfirm.style.display = 'none';
    } else {
        if (btnConfirm) btnConfirm.style.display = 'inline-flex';
        const rows = changes.map(c => `
            <tr>
                <td>${c.municipio}</td>
                <td>${c.unidad}</td>
                <td><div style="display:flex; align-items:center; gap:8px;"><div style="width:26px; height:26px; border-radius:8px; background:${c.jeringaDef.swatchCss}; color:${c.jeringaDef.tileTextColor}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:7.5px; flex-shrink:0;">${c.jeringaDef.tileText}</div><span>${c.jeringaDef.nombre}</span></div></td>
                <td class="spm-preview-diff">${c.oldProm} &rarr; <strong>${c.newProm}</strong></td>
                <td class="spm-preview-diff">${c.oldMin} &rarr; <strong>${c.newMin}</strong></td>
                <td class="spm-preview-diff">${c.oldMax} &rarr; <strong>${c.newMax}</strong></td>
            </tr>
        `).join('');
        body.innerHTML = `
            <table class="spm-preview-table">
                <thead>
                    <tr>
                        <th>Municipio</th><th>Unidad</th><th>Jeringa</th>
                        <th>Promedio (cajas)</th><th>Mínimo (cajas)</th><th>Máximo (cajas)</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    modal.style.display = 'flex';
};

window.jerCancelCalcPreview = function() {
    window._jerPendingCalcRecords = null;
    const modal = document.getElementById('jerCalcPreviewModal');
    if (modal) modal.style.display = 'none';
    if (typeof showToast === 'function') {
        showToast("Cálculo descartado. No se guardó ningún cambio.", true, 'warn');
    }
};

// 8c. CONFIRMAR Y PERSISTIR EL CÁLCULO MASIVO EN SUPABASE
window.jerConfirmCalcSave = async function() {
    const records = window._jerPendingCalcRecords;
    const modal = document.getElementById('jerCalcPreviewModal');

    if (!records || records.length === 0) {
        if (modal) modal.style.display = 'none';
        return;
    }

    const username = window.jerGetCurrentUsername();
    const nowIso = new Date().toISOString();
    const recordsToUpsert = records.map(r => ({ ...r, updated_by: username, updated_at: nowIso }));

    const batchSize = 200;
    const totalBatches = Math.ceil(recordsToUpsert.length / batchSize);
    if (typeof showProgressOverlay === 'function') {
        showProgressOverlay(`Guardando ${recordsToUpsert.length} parámetros...`, "Calculadora de Jeringas", "CALCULADORA DE JERINGAS");
    } else if (typeof showOverlay === 'function') {
        showOverlay(`Guardando ${recordsToUpsert.length} parámetros calculados en Supabase...`, "Calculadora de Jeringas");
    }

    try {
        let savedCount = 0;
        for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
            const batch = recordsToUpsert.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            if (typeof updateOverlayProgress === 'function') {
                updateOverlayProgress(savedCount, recordsToUpsert.length, `Guardando lote ${batchNum} de ${totalBatches}...`, "Calculadora de Jeringas", "CALCULADORA DE JERINGAS");
            }

            const { error: batchErr } = await window.supabase
                .from('jeringas_params')
                .upsert(batch, { onConflict: 'clues,jeringa' });

            if (batchErr) {
                throw new Error(`Se guardaron ${savedCount} de ${recordsToUpsert.length} parámetros antes de fallar: ${batchErr.message}`);
            }
            savedCount += batch.length;

            batch.forEach(rec => {
                window._jerParamsMap[`${rec.clues}|${rec.jeringa}`] = rec;
            });
        }

        window._jerPendingCalcRecords = null;
        if (modal) modal.style.display = 'none';

        window.jerFilterUnitsByMuni(document.getElementById('jerParamMuniSelect')?.value || "");
        if (window._jerActiveClues) {
            const activeUnit = window._jerUnitsList.find(u => u.clues === window._jerActiveClues);
            if (activeUnit) window.jerRenderUnitMatrix(activeUnit);
        }

        if (typeof showToast === 'function') {
            showToast(`¡${savedCount} parámetros de jeringas guardados en Supabase con éxito!`, true, 'good');
        }
    } catch (e) {
        console.error("Error al guardar cálculo masivo de jeringas:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar en base de datos: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// =========================================================================
// EXPORTACIÓN A EXCEL — mapea y reutiliza el formato de la plantilla oficial
// "MAXIMOS Y MINIMOS JERINGAS 2026.xlsx" (fuente Arial Nova, título con fondo
// D4C19C, encabezados con fondo 223962, celdas de dato tamaño 18, columna
// Total con fórmula SUM). Cada hoja apila 3 bloques (Promedio/Mínimo/Máximo).
// =========================================================================

const JER_XLS_TITLE_FILL = 'FFD4C19C';
const JER_XLS_TITLE_TEXT = 'FF10312B';
const JER_XLS_HEADER_FILL = 'FF223962';
const JER_XLS_HEADER_TEXT = 'FFFFFFFF';
const JER_ROW_HEIGHTS = [110.25, 110.25, 94.5, 94.5, 111];

/** Convierte un índice de columna (1-based) a letra de Excel (1->A, 27->AA, ...) */
function jerColLetter(n) {
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

/** Nombre de hoja válido para Excel: máx. 31 caracteres, sin \ / ? * [ ] : */
function jerSanitizeSheetName(name) {
    return String(name || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
}

function jerGroupUnitsByMunicipio(units) {
    const byMuni = {};
    (units || []).forEach(u => {
        const m = u.municipio || 'SIN MUNICIPIO';
        if (!byMuni[m]) byMuni[m] = [];
        byMuni[m].push(u);
    });
    return byMuni;
}

/** Arma, para una lista de unidades, las columnas (una por unidad) con sus 5 valores de jeringa para una métrica dada. */
function jerBuildColumnsForUnits(units, metricKey) {
    return units.map(u => {
        const valuesByJeringa = {};
        JERINGA_DEFS.forEach(def => {
            const p = window._jerParamsMap[`${u.clues}|${def.key}`];
            valuesByJeringa[def.key] = (p && p[metricKey]) || 0;
        });
        return { headerLabel: u.unidad || u.clues, subLabel: u.clues, valuesByJeringa };
    });
}

/** Igual que arriba, pero una columna por MUNICIPIO (suma de todas sus unidades) — para el total jurisdiccional. */
function jerBuildColumnsForMunicipios(municipiosList, unitsByMuni, metricKey) {
    return municipiosList.map(m => {
        const valuesByJeringa = {};
        JERINGA_DEFS.forEach(def => {
            let sum = 0;
            (unitsByMuni[m] || []).forEach(u => {
                const p = window._jerParamsMap[`${u.clues}|${def.key}`];
                sum += (p && p[metricKey]) || 0;
            });
            valuesByJeringa[def.key] = sum;
        });
        return { headerLabel: m, subLabel: '', valuesByJeringa };
    });
}

/** Escribe el banner superior (título + datos de generación) — aquí vive el "membrete" según rol/alcance. */
function jerWriteBanner(ws, totalColIdx, scopeTitle) {
    const role = window._jerUserRole || '';
    const who = window.jerGetCurrentUsername();
    const fechaStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    const buffEl = document.getElementById('jerBufferPct');
    const buffPct = buffEl && buffEl.value !== '' ? buffEl.value : '10';

    ws.mergeCells(1, 1, 1, totalColIdx);
    const bannerCell = ws.getCell(1, 1);
    bannerCell.value = `CÁLCULO DE JERINGAS POR UNIDAD DE SALUD — ${scopeTitle}`;
    bannerCell.font = { name: 'Arial Nova', size: 13, bold: true, color: { argb: JER_XLS_HEADER_TEXT } };
    bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_HEADER_FILL } };
    bannerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, totalColIdx);
    const infoCell = ws.getCell(2, 1);
    infoCell.value = `Generado por ${who} (${role}) el ${fechaStr} · Colchón aplicado en cálculo automático: ${buffPct}% · Cajas: 27x13 y Terumo = 100 pzs, resto = 50 pzs`;
    infoCell.font = { name: 'Arial Nova', size: 9, italic: true, color: { argb: 'FF64748B' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 16;
}

/** Escribe un bloque completo (título de municipio/alcance + encabezado CLUES + 5 filas de jeringa) a partir de `startRow`. Devuelve la siguiente fila libre. */
function jerWriteMetricBlock(ws, startRow, blockLabel, membreteTitle, columns) {
    const numCols = columns.length;
    const totalColIdx = 3 + numCols + 1;
    let r = startRow;

    ws.mergeCells(r, 1, r, totalColIdx);
    const lblCell = ws.getCell(r, 1);
    lblCell.value = blockLabel;
    lblCell.font = { name: 'Arial Nova', size: 11, bold: true, color: { argb: JER_XLS_HEADER_FILL } };
    lblCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 20;
    r++;

    // Fila de título (municipio/alcance) + nombres de unidad + "Total"
    ws.mergeCells(r, 1, r, 3);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = membreteTitle;
    titleCell.font = { name: 'Arial Nova', size: 16, bold: true, color: { argb: JER_XLS_TITLE_TEXT } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_TITLE_FILL } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleCell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    ws.getRow(r).height = 48;

    columns.forEach((col, i) => {
        const cell = ws.getCell(r, 4 + i);
        cell.value = col.headerLabel;
        cell.font = { name: 'Arial Nova', size: 12, bold: true, color: { argb: JER_XLS_TITLE_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_TITLE_FILL } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'medium' } };
    });
    const totalHeaderCell = ws.getCell(r, totalColIdx);
    totalHeaderCell.value = 'Total';
    totalHeaderCell.font = { name: 'Arial Nova', size: 12, bold: true, color: { argb: JER_XLS_TITLE_TEXT } };
    totalHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_TITLE_FILL } };
    totalHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    totalHeaderCell.border = { top: { style: 'medium' } };
    r++;

    // Fila: Clave | Descripción | Calibre | CLUES...
    ['Clave', 'Descripción', 'Calibre'].forEach((lbl, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = lbl;
        cell.font = { name: 'Arial Nova', size: 12, bold: true, color: { argb: JER_XLS_HEADER_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_HEADER_FILL } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    columns.forEach((col, i) => {
        const cell = ws.getCell(r, 4 + i);
        cell.value = col.subLabel || '';
        cell.font = { name: 'Arial Nova', size: 10, bold: true, color: { argb: JER_XLS_HEADER_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: JER_XLS_HEADER_FILL } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(r).height = 16.5;
    r++;

    // 5 filas de jeringa (orden oficial del catálogo, igual que JERINGA_DEFS)
    JERINGA_DEFS.forEach((def, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === JERINGA_DEFS.length - 1;
        const borderStyle = { top: { style: isFirst ? 'medium' : 'thin' }, bottom: { style: isLast ? 'medium' : 'thin' } };

        const fixedVals = [def.clave, def.descripcion, def.key];
        [1, 2, 3].forEach(c => {
            const cell = ws.getCell(r, c);
            cell.value = fixedVals[c - 1];
            cell.font = { name: 'Arial Nova', size: 12, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c === 3 ? 'center' : 'left' };
            cell.border = borderStyle;
        });

        columns.forEach((col, i) => {
            const cell = ws.getCell(r, 4 + i);
            cell.value = col.valuesByJeringa[def.key] || 0;
            cell.numFmt = '0';
            cell.font = { name: 'Arial Nova', size: 18, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderStyle;
        });

        const totalCell = ws.getCell(r, totalColIdx);
        if (numCols > 0) {
            totalCell.value = { formula: `SUM(${jerColLetter(4)}${r}:${jerColLetter(3 + numCols)}${r})` };
        } else {
            totalCell.value = 0;
        }
        totalCell.numFmt = '0';
        totalCell.font = { name: 'Arial Nova', size: 18, color: { argb: 'FF000000' } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        totalCell.alignment = { vertical: 'middle', horizontal: 'center' };
        totalCell.border = borderStyle;

        ws.getRow(r).height = JER_ROW_HEIGHTS[idx] || 100;
        r++;
    });

    r++; // fila en blanco de separación entre bloques
    return r;
}

/**
 * Las 3 métricas exportables, cada una en su PROPIA pestaña — a petición explícita: antes vivían
 * apiladas como 3 bloques dentro de una sola hoja, y por lo importante que es esta información
 * (Promedio/Mínimo/Máximo son 3 decisiones de pedido distintas) se separan en pestañas propias,
 * cada una membretada con el nombre de la métrica y coloreada para no confundirse entre sí.
 */
const JER_METRIC_DEFS = [
    { key: 'promedio_cajas', tabName: 'PROMEDIO', blockLabel: 'PROMEDIO MENSUAL', membreteLabel: 'PROMEDIO MENSUAL (CAJAS)', color: 'FF2563EB' },
    { key: 'min_cajas', tabName: 'MÍNIMO', blockLabel: 'MÍNIMO MENSUAL', membreteLabel: 'MÍNIMO MENSUAL (CAJAS)', color: 'FFD97706' },
    { key: 'max_cajas', tabName: 'MÁXIMO', blockLabel: 'MÁXIMO MENSUAL', membreteLabel: 'MÁXIMO MENSUAL (CAJAS)', color: 'FF16A34A' }
];

/**
 * Arma UNA hoja para UNA sola métrica. `groups` trae 1 bloque por municipio/unidad-lista que se
 * quiera incluir en esta hoja (1 solo grupo para un municipio único; 1 por municipio si son
 * varios, ej. concentrado/mis-municipios) — mismo `jerWriteMetricBlock` de siempre, solo que
 * ahora cada hoja llama la métrica UNA vez en vez de las 3 apiladas.
 */
function jerBuildMetricSheetForUnits(ws, metricDef, scopeTitle, groups) {
    const maxCols = groups.reduce((m, g) => Math.max(m, g.units.length), 0);
    const totalColIdx = 3 + maxCols + 1;

    ws.pageSetup.orientation = 'landscape';
    ws.views = [{ showGridLines: false }];
    ws.properties.tabColor = { argb: metricDef.color };
    ws.getColumn(1).width = 18.14;
    ws.getColumn(2).width = 55.57;
    ws.getColumn(3).width = 11.43;
    for (let i = 0; i < maxCols; i++) ws.getColumn(4 + i).width = 16.71;
    ws.getColumn(totalColIdx).width = 12.71;

    jerWriteBanner(ws, totalColIdx, `${metricDef.membreteLabel} — ${scopeTitle}`);

    let r = 4;
    groups.forEach(g => {
        r = jerWriteMetricBlock(ws, r, metricDef.blockLabel, g.membreteTitle, jerBuildColumnsForUnits(g.units, metricDef.key));
    });
}

/** Igual que arriba, pero con una columna por MUNICIPIO (para el reporte de total jurisdiccional). */
function jerBuildMetricSheetForMunicipios(ws, metricDef, scopeTitle, municipiosList, unitsByMuni) {
    const totalColIdx = 3 + municipiosList.length + 1;

    ws.pageSetup.orientation = 'landscape';
    ws.views = [{ showGridLines: false }];
    ws.properties.tabColor = { argb: metricDef.color };
    ws.getColumn(1).width = 18.14;
    ws.getColumn(2).width = 55.57;
    ws.getColumn(3).width = 11.43;
    municipiosList.forEach((_, i) => { ws.getColumn(4 + i).width = 22; });
    ws.getColumn(totalColIdx).width = 14;

    jerWriteBanner(ws, totalColIdx, `${metricDef.membreteLabel} — ${scopeTitle}`);

    jerWriteMetricBlock(ws, 4, metricDef.blockLabel, scopeTitle, jerBuildColumnsForMunicipios(municipiosList, unitsByMuni, metricDef.key));
}

function jerDownloadWorkbookBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function jerTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function jerMuniScopeTitle(municipio) {
    return `MUNICIPIO DE ${String(municipio || '').toUpperCase()} — JURISDICCIÓN SANITARIA NO. 1`;
}

/**
 * Exporta el alcance completo de un usuario Municipal: 1 hoja por cada municipio que
 * tenga asignado (normalmente 1, pero `perfiles.municipios_allowed` admite varios).
 * `_jerUnitsList` ya viene filtrado por municipio permitido desde `jerLoadAllData`, así
 * que agrupar por municipio aquí basta para no depender de tomar solo el primero.
 */
window.jerExportMyMunicipios = async function() {
    if (typeof ExcelJS === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de exportación no cargada', false, 'bad');
        return;
    }
    const byMuni = jerGroupUnitsByMunicipio(window._jerUnitsList);
    const municipios = Object.keys(byMuni).sort();
    if (municipios.length === 0) {
        if (typeof showToast === 'function') showToast('No se pudo determinar tu municipio', false, 'bad');
        return;
    }
    if (municipios.length === 1) {
        return window.jerExportSingleMunicipio(municipios[0]);
    }

    if (typeof showOverlay === 'function') showOverlay(`Generando Excel de ${municipios.length} municipios...`, "Exportar Jeringas");
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SIREVAQ';
        const scopeTitle = `MIS MUNICIPIOS (${municipios.length}) — JURISDICCIÓN SANITARIA NO. 1`;
        const groups = municipios.map(m => ({ membreteTitle: jerMuniScopeTitle(m), units: byMuni[m] }));
        JER_METRIC_DEFS.forEach(metricDef => {
            const ws = wb.addWorksheet(metricDef.tabName, { views: [{ showGridLines: false }] });
            jerBuildMetricSheetForUnits(ws, metricDef, scopeTitle, groups);
        });

        const buffer = await wb.xlsx.writeBuffer();
        jerDownloadWorkbookBuffer(buffer, `Jeringas_Mis_Municipios_${jerTodayStr()}.xlsx`);
        if (typeof showToast === 'function') showToast('Excel generado con éxito (pestañas: Promedio, Mínimo, Máximo)', true, 'good');
    } catch (e) {
        console.error('Error al exportar jeringas (mis municipios):', e);
        if (typeof showToast === 'function') showToast('Error al generar el Excel: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Exporta un solo municipio (usado tanto por el botón único de Municipal como por el modo "4 archivos"). */
window.jerExportSingleMunicipio = async function(municipio) {
    if (typeof ExcelJS === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de exportación no cargada', false, 'bad');
        return;
    }
    const units = (window._jerUnitsList || []).filter(u => u.municipio === municipio);
    if (units.length === 0) {
        if (typeof showToast === 'function') showToast(`No hay unidades cargadas para ${municipio}`, false, 'warn');
        return;
    }

    if (typeof showOverlay === 'function') showOverlay(`Generando Excel de ${municipio}...`, "Exportar Jeringas");
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SIREVAQ';
        const title = jerMuniScopeTitle(municipio);
        const groups = [{ membreteTitle: title, units }];
        JER_METRIC_DEFS.forEach(metricDef => {
            const ws = wb.addWorksheet(metricDef.tabName, { views: [{ showGridLines: false }] });
            jerBuildMetricSheetForUnits(ws, metricDef, title, groups);
        });

        const buffer = await wb.xlsx.writeBuffer();
        jerDownloadWorkbookBuffer(buffer, `Jeringas_${municipio}_${jerTodayStr()}.xlsx`);
        if (typeof showToast === 'function') showToast('Excel generado con éxito (pestañas: Promedio, Mínimo, Máximo)', true, 'good');
    } catch (e) {
        console.error('Error al exportar jeringas (municipio):', e);
        if (typeof showToast === 'function') showToast('Error al generar el Excel: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Opción 1: los 4 municipios concentrados en 1 solo archivo (1 hoja por municipio). */
window.jerExportConcentrado = async function() {
    if (typeof ExcelJS === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de exportación no cargada', false, 'bad');
        return;
    }
    window.jerCloseExportMenu();
    const byMuni = jerGroupUnitsByMunicipio(window._jerUnitsList);
    const municipios = Object.keys(byMuni).sort();
    if (municipios.length === 0) {
        if (typeof showToast === 'function') showToast('No hay unidades cargadas', false, 'warn');
        return;
    }

    if (typeof showOverlay === 'function') showOverlay('Generando Excel concentrado (4 municipios)...', "Exportar Jeringas");
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SIREVAQ';
        const scopeTitle = 'JURISDICCIÓN SANITARIA NO. 1 — CONCENTRADO 4 MUNICIPIOS';
        const groups = municipios.map(m => ({ membreteTitle: jerMuniScopeTitle(m), units: byMuni[m] }));
        JER_METRIC_DEFS.forEach(metricDef => {
            const ws = wb.addWorksheet(metricDef.tabName, { views: [{ showGridLines: false }] });
            jerBuildMetricSheetForUnits(ws, metricDef, scopeTitle, groups);
        });

        const buffer = await wb.xlsx.writeBuffer();
        jerDownloadWorkbookBuffer(buffer, `Jeringas_Concentrado_4_Municipios_${jerTodayStr()}.xlsx`);
        if (typeof showToast === 'function') showToast('Excel concentrado generado con éxito (pestañas: Promedio, Mínimo, Máximo)', true, 'good');
    } catch (e) {
        console.error('Error al exportar jeringas (concentrado):', e);
        if (typeof showToast === 'function') showToast('Error al generar el Excel: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Opción 2: 4 archivos independientes, uno por municipio, entregados juntos en un .zip. */
window.jerExportPorMunicipio = async function() {
    if (typeof ExcelJS === 'undefined' || typeof JSZip === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de exportación no cargada', false, 'bad');
        return;
    }
    window.jerCloseExportMenu();
    const byMuni = jerGroupUnitsByMunicipio(window._jerUnitsList);
    const municipios = Object.keys(byMuni).sort();
    if (municipios.length === 0) {
        if (typeof showToast === 'function') showToast('No hay unidades cargadas', false, 'warn');
        return;
    }

    if (typeof showOverlay === 'function') showOverlay('Generando 4 archivos (1 por municipio)...', "Exportar Jeringas");
    try {
        const zip = new JSZip();
        for (const m of municipios) {
            const wb = new ExcelJS.Workbook();
            wb.creator = 'SIREVAQ';
            const title = jerMuniScopeTitle(m);
            const groups = [{ membreteTitle: title, units: byMuni[m] }];
            JER_METRIC_DEFS.forEach(metricDef => {
                const ws = wb.addWorksheet(metricDef.tabName, { views: [{ showGridLines: false }] });
                jerBuildMetricSheetForUnits(ws, metricDef, title, groups);
            });
            const buffer = await wb.xlsx.writeBuffer();
            zip.file(`Jeringas_${m}_${jerTodayStr()}.xlsx`, buffer);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Jeringas_4_Municipios_${jerTodayStr()}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);

        if (typeof showToast === 'function') showToast('4 archivos generados con éxito (.zip, cada uno con pestañas Promedio/Mínimo/Máximo)', true, 'good');
    } catch (e) {
        console.error('Error al exportar jeringas (por municipio):', e);
        if (typeof showToast === 'function') showToast('Error al generar los archivos: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

/** Opción 3: 1 solo archivo con el total jurisdiccional (suma de los 4 municipios). */
window.jerExportTotalJurisdiccional = async function() {
    if (typeof ExcelJS === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de exportación no cargada', false, 'bad');
        return;
    }
    window.jerCloseExportMenu();
    const byMuni = jerGroupUnitsByMunicipio(window._jerUnitsList);
    const municipios = Object.keys(byMuni).sort();
    if (municipios.length === 0) {
        if (typeof showToast === 'function') showToast('No hay unidades cargadas', false, 'warn');
        return;
    }

    if (typeof showOverlay === 'function') showOverlay('Generando total jurisdiccional...', "Exportar Jeringas");
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'SIREVAQ';
        const title = 'TOTAL JURISDICCIONAL — JURISDICCIÓN SANITARIA NO. 1 (4 MUNICIPIOS)';
        JER_METRIC_DEFS.forEach(metricDef => {
            const ws = wb.addWorksheet(metricDef.tabName, { views: [{ showGridLines: false }] });
            jerBuildMetricSheetForMunicipios(ws, metricDef, title, municipios, byMuni);
        });

        const buffer = await wb.xlsx.writeBuffer();
        jerDownloadWorkbookBuffer(buffer, `Jeringas_Total_Jurisdiccional_${jerTodayStr()}.xlsx`);
        if (typeof showToast === 'function') showToast('Excel de total jurisdiccional generado con éxito (pestañas: Promedio, Mínimo, Máximo)', true, 'good');
    } catch (e) {
        console.error('Error al exportar jeringas (total jurisdiccional):', e);
        if (typeof showToast === 'function') showToast('Error al generar el Excel: ' + e.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

// --- UI del botón/menú de exportación ---
window.jerToggleExportMenu = function() {
    const role = window._jerUserRole;
    if (role === 'MUNICIPAL') {
        // Exporta TODOS los municipios que el usuario tenga asignados, no solo el primero
        // en orden alfabético — perfiles.municipios_allowed admite más de uno.
        window.jerExportMyMunicipios();
        return;
    }
    const menu = document.getElementById('jerExportMenu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
};

window.jerCloseExportMenu = function() {
    const menu = document.getElementById('jerExportMenu');
    if (menu) menu.style.display = 'none';
};

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('jerExportWrap');
    const menu = document.getElementById('jerExportMenu');
    if (!wrap || !menu || menu.style.display === 'none') return;
    if (!wrap.contains(e.target)) window.jerCloseExportMenu();
});

// Escuchar cambios de sub-panel en el panel Admin para inicializar automáticamente
document.addEventListener("click", (e) => {
    if (e.target && (e.target.id === "tabAdminJeringas" || e.target.closest("#tabAdminJeringas"))) {
        setTimeout(() => {
            window.initConsoleJeringas();
        }, 100);
    }
});
