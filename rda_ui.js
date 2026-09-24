/**
 * rda_ui.js — Indicadores Vacunas 2026 v6 (Premium Analysis - Highly Optimized Vanilla JS)
 */
let _rdaCharts = {};
let _rdaCache = { unidades: null, registros: null, anio: 2026, maxMes: 0 };
let _rdaState = { sortCol: null, sortAsc: true, esquema: 'basico' };
const MUNI_ORDER = ['CORREGIDORA','HUIMILPAN','EL MARQUES','MARQUÉS','MARQUES','QUERETARO','QUERÉTARO'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Definición de KPIs para cada uno de los 5 esquemas de vacunación
const SCHEME_KPIS = {
    basico: [
        { label: 'Menores de 1 Año (<1)', icon: 'child_care', bg: '#f0fdfa', fg: '#0d9488', key: 'menor1' },
        { label: 'Niños de 1 Año (1)', icon: 'face', bg: '#f0f9ff', fg: '#0284c7', key: 'uno' },
        { label: 'Niños de 4 Años (4)', icon: 'school', bg: '#f5f3ff', fg: '#7c3aed', key: 'cuatro' },
        { label: 'Desglose Poblacional Meta', icon: 'groups', bg: '#f8fafc', fg: '#475569', key: 'pob' }
    ],
    adultos: [
        { label: 'Hepatitis B', icon: 'vaccines', bg: '#f0fdfa', fg: '#0d9488', key: 'adol_hb' },
        { label: 'SR', icon: 'face_retouching_natural', bg: '#f0f9ff', fg: '#0284c7', key: 'adol_sr' },
        { label: 'VPH', icon: 'girl', bg: '#f5f3ff', fg: '#7c3aed', key: 'adol_vph' },
        { label: 'Td', icon: 'biotech', bg: '#fff7ed', fg: '#ea580c', key: 'adol_td' },
        { label: 'Tdpa', icon: 'pregnant_woman', bg: '#fdf2f8', fg: '#db2777', key: 'adol_tdpa' }
    ],
    mayores: [
        { label: 'Neumo 13', icon: 'elderly', bg: '#f0fdfa', fg: '#0d9488', key: 'am_neumo13' },
        { label: 'Neumo 20', icon: 'elderly', bg: '#f0f9ff', fg: '#0284c7', key: 'am_neumo20' },
        { label: 'Td Mayores', icon: 'healing', bg: '#f5f3ff', fg: '#7c3aed', key: 'am_td' }
    ],
    embarazadas: [
        { label: 'Tdpa Embarazadas', icon: 'pregnant_woman', bg: '#fdf2f8', fg: '#db2777', key: 'emb_tdpa' },
        { label: 'VSR Embarazadas', icon: 'baby_changing_station', bg: '#f0fdfa', fg: '#0d9488', key: 'emb_vsr' }
    ],
    invernal: [
        { label: 'Influenza', icon: 'ac_unit', bg: '#f0f9ff', fg: '#0284c7', key: 'inv_influenza' },
        { label: 'COVID-19', icon: 'coronavirus', bg: '#f5f3ff', fg: '#7c3aed', key: 'inv_covid' }
    ],
    adicionales: [
        { label: 'Varicela', icon: 'vaccines', bg: '#ecfdf5', fg: '#059669', key: 'varicela' },
        { label: 'Hepatitis A', icon: 'vaccines', bg: '#eff6ff', fg: '#2563eb', key: 'hepatitis_a' }
    ]
};

function initRDADashboard() {
    const overlay = document.getElementById('rdaDashboardOverlay');
    
    // Legacy modal logic (btnOpen, btnClose, Escape) has been entirely removed
    // The RDA Dashboard now operates purely via the standardized 'activateOpsTab' / 'activateUnidadT    // Inyección de select con soporte completo para los 5 esquemas de vacunación (Apple Material Specification)
    // Inyección de select con soporte completo para los 5 esquemas de vacunación
    const leftGroup = document.getElementById('rdaFilterLeftGroup');
    if (leftGroup && !document.getElementById('rdaFilterEsquema')) {
        // Estilos dedicados para anular cualquier regla global e implementar un diseño Premium
        const style = document.createElement('style');
        style.innerHTML = `
            #rdaFilterAnio, #rdaFilterTemporalidad, #rdaFilterEsquema, #rdaFilterMunicipio, #rdaFilterUnidad {
                display: inline-block !important;
                width: auto !important;
                max-width: max-content !important;
                height: 44px !important;
                min-height: 44px !important;
                max-height: 44px !important;
                padding: 0 36px 0 14px !important;
                border-radius: 14px !important;
                border: 1px solid rgba(203, 213, 225, 0.8) !important;
                background-color: #ffffff !important;
                color: #0f172a !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                outline: none !important;
                cursor: pointer !important;
                box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), inset 0 -1.5px 0 rgba(15, 23, 42, 0.08) !important;
                transition: all 0.2s ease !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23475569'%3e%3cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3e%3c/svg%3e") !important;
                background-repeat: no-repeat !important;
                background-position: right 12px center !important;
                background-size: 16px !important;
            }
            #rdaFilterAnio:hover, #rdaFilterTemporalidad:hover, #rdaFilterEsquema:hover, #rdaFilterMunicipio:hover, #rdaFilterUnidad:hover {
                border-color: #94a3b8 !important;
                background-color: #f8fafc !important;
            }
            #rdaFilterAnio:focus, #rdaFilterTemporalidad:focus, #rdaFilterEsquema:focus, #rdaFilterMunicipio:focus, #rdaFilterUnidad:focus {
                border-color: #0ea5e9 !important;
                box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15) !important;
            }
            #rdaViewToggleContainer {
                display: inline-flex;
                align-items: center !important;
                padding: 3px !important;
                box-sizing: border-box !important;
                height: 44px !important;
                border-radius: 14px !important;
                border: 1px solid rgba(203, 213, 225, 0.8) !important;
                background: #f1f5f9 !important;
                box-shadow: inset 0 1.5px 3px rgba(15, 23, 42, 0.05) !important;
                transition: all 0.25s ease !important;
            }
            #rdaViewToggleContainer:hover {
                border-color: #94a3b8 !important;
            }
            #rdaViewToggleContainer button {
                box-sizing: border-box !important;
                min-height: 0 !important;
                height: 36px !important;
                padding: 0 16px !important;
                border-radius: 11px !important;
                border: 1px solid transparent !important;
                font-family: inherit !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                margin: 0 !important;
            }
            #rdaViewToggleContainer button.active {
                background-color: #ffffff !important;
                color: #0f172a !important;
                border-color: rgba(15, 23, 42, 0.04) !important;
                box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04) !important;
            }
            #rdaViewToggleContainer button.inactive {
                background: transparent !important;
                color: #64748b !important;
                box-shadow: none !important;
                border-color: transparent !important;
            }
            #rdaViewToggleContainer button.inactive:hover {
                color: #0f172a !important;
                background: rgba(15, 23, 42, 0.02) !important;
            }
            #rdaTableContainer {
                overflow: auto !important;
                max-height: 540px !important;
                position: relative !important;
                border-radius: 0 0 24px 24px !important;
            }
            #rdaDetailTable {
                table-layout: fixed !important;
                width: 100% !important;
            }
            #rdaDetailTable thead tr th {
                position: sticky !important;
                top: 0 !important;
                z-index: 20 !important;
                background-color: var(--md-sys-color-surface-container) !important;
                box-shadow: 0 1px 0 var(--md-sys-color-outline-variant) !important;
                color: var(--md-sys-color-on-surface) !important;
            }
            #rdaDetailTable th:nth-child(1),
            #rdaDetailTable td:nth-child(1) {
                position: sticky !important;
                left: 0 !important;
                z-index: 12 !important;
                background-color: var(--md-sys-color-surface) !important;
                width: 130px !important;
                min-width: 130px !important;
                max-width: 130px !important;
                box-shadow: 1px 0 0 var(--md-sys-color-surface-variant) !important;
                color: var(--md-sys-color-on-surface) !important;
                box-sizing: border-box !important;
            }
            #rdaDetailTable th:nth-child(2),
            #rdaDetailTable td:nth-child(2) {
                position: sticky !important;
                left: 130px !important;
                z-index: 12 !important;
                background-color: var(--md-sys-color-surface) !important;
                width: 220px !important;
                min-width: 220px !important;
                max-width: 220px !important;
                box-shadow: 2px 0 5px rgba(15, 23, 42, 0.04) !important;
                color: var(--md-sys-color-on-surface) !important;
                box-sizing: border-box !important;
            }
            #rdaDetailTable th:nth-child(3),
            #rdaDetailTable td:nth-child(3) {
                width: 150px !important;
                min-width: 150px !important;
                max-width: 150px !important;
                box-sizing: border-box !important;
            }
            #rdaDetailTable th:nth-child(1),
            #rdaDetailTable th:nth-child(2) {
                z-index: 22 !important;
                background-color: var(--md-sys-color-surface-container) !important;
            }
            #rdaDetailTable tr:nth-child(even) td:nth-child(1),
            #rdaDetailTable tr:nth-child(even) td:nth-child(2) {
                background-color: var(--md-sys-color-surface-container) !important;
            }
            #rdaDetailTable tr td[colspan] {
                position: sticky !important;
                left: 0 !important;
                z-index: 11 !important;
                background-color: var(--md-sys-color-surface-container) !important;
                color: var(--md-sys-color-on-surface) !important;
            }
            #rdaDetailTable tbody tr:hover td {
                background-color: var(--md-sys-color-surface-variant) !important;
            }
            #rdaDetailTable tbody tr:hover td:nth-child(1),
            #rdaDetailTable tbody tr:hover td:nth-child(2) {
                background-color: var(--md-sys-color-surface-variant) !important;
            }
        `;
        document.head.appendChild(style);

        // Selector de Año Base (Ordenado Cronológicamente)
        const selAnio = document.createElement('select');
        selAnio.id = 'rdaFilterAnio';
        selAnio.innerHTML = `
            <option value="2025">Año 2025</option>
            <option value="2026" selected>Año 2026</option>
            <option value="2027">Año 2027</option>
        `;
        selAnio.addEventListener('change', () => {
            _rdaCache.anio = parseInt(selAnio.value, 10);
            _rdaCache.unidades = null; // Invalidate cache for new year fetch
            updateComparativeOptionLabel();
            loadAndRender();
        });
        leftGroup.appendChild(selAnio);

        // Selector de Temporalidad (Cierre Acumulado / Mes Específico / Trimestre)
        const selTemp = document.createElement('select');
        selTemp.id = 'rdaFilterTemporalidad';
        selTemp.innerHTML = `
            <option value="0" selected>⚡ Cierre Acumulado a la Fecha</option>
            <optgroup label="Corte por Mes Específico">
                <option value="1">Mes: Enero</option>
                <option value="2">Mes: Febrero</option>
                <option value="3">Mes: Marzo</option>
                <option value="4">Mes: Abril</option>
                <option value="5">Mes: Mayo</option>
                <option value="6">Mes: Junio</option>
                <option value="7">Mes: Julio</option>
                <option value="8">Mes: Agosto</option>
                <option value="9">Mes: Septiembre</option>
                <option value="10">Mes: Octubre</option>
                <option value="11">Mes: Noviembre</option>
                <option value="12">Mes: Diciembre</option>
            </optgroup>
            <optgroup label="Corte por Trimestre">
                <option value="T1">1er Trimestre (Ene - Mar)</option>
                <option value="T2">2do Trimestre (Abr - Jun)</option>
                <option value="T3">3er Trimestre (Jul - Sep)</option>
                <option value="T4">4to Trimestre (Oct - Dic)</option>
            </optgroup>
        `;
        selTemp.addEventListener('change', () => {
            _rdaState.corteTemporal = selTemp.value;
            _rdaCache.unidades = null; // Invalidate cache to fetch exact month cut
            loadAndRender();
        });
        leftGroup.appendChild(selTemp);

        // Actualizador dinámico del selector de temporalidad según esquema seleccionado
        window.updateTemporalidadOptions = function() {
            const isComp = (_rdaState.esquema === 'comparativa_multianual');
            const maxAvailable = _rdaCache.maxMes || 6;
            let curValue = selTemp.value || '0';

            if (isComp) {
                const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const mName = monthsShort[Math.min(maxAvailable, 12) - 1];

                if (curValue !== '0' && curValue !== 'T1' && curValue !== 'T2' && curValue !== 'T3' && curValue !== 'T4') {
                    curValue = '0';
                    _rdaState.corteTemporal = '0';
                }

                const t1Disabled = maxAvailable < 3 ? 'disabled' : '';
                const t2Disabled = maxAvailable < 6 ? 'disabled' : '';
                const t3Disabled = maxAvailable < 9 ? 'disabled' : '';
                const t4Disabled = maxAvailable < 12 ? 'disabled' : '';

                selTemp.innerHTML = `
                    <option value="0" ${curValue === '0' ? 'selected' : ''}>⚡ Cierre Acumulado (${mName})</option>
                    <optgroup label="Corte Comparativo por Trimestre">
                        <option value="T1" ${curValue === 'T1' ? 'selected' : ''} ${t1Disabled}>1er Trimestre (Ene - Mar)</option>
                        <option value="T2" ${curValue === 'T2' ? 'selected' : ''} ${t2Disabled}>2do Trimestre (Abr - Jun)</option>
                        <option value="T3" ${curValue === 'T3' ? 'selected' : ''} ${t3Disabled}>3er Trimestre (Jul - Sep) ${maxAvailable < 9 ? '🔒 Próximo' : ''}</option>
                        <option value="T4" ${curValue === 'T4' ? 'selected' : ''} ${t4Disabled}>4to Trimestre (Oct - Dic) ${maxAvailable < 12 ? '🔒 Próximo' : ''}</option>
                    </optgroup>
                `;
            } else {
                selTemp.innerHTML = `
                    <option value="0" ${curValue === '0' ? 'selected' : ''}>⚡ Cierre Acumulado a la Fecha</option>
                    <optgroup label="Corte por Mes Específico">
                        <option value="1" ${curValue === '1' ? 'selected' : ''}>Mes: Enero</option>
                        <option value="2" ${curValue === '2' ? 'selected' : ''}>Mes: Febrero</option>
                        <option value="3" ${curValue === '3' ? 'selected' : ''}>Mes: Marzo</option>
                        <option value="4" ${curValue === '4' ? 'selected' : ''}>Mes: Abril</option>
                        <option value="5" ${curValue === '5' ? 'selected' : ''}>Mes: Mayo</option>
                        <option value="6" ${curValue === '6' ? 'selected' : ''}>Mes: Junio</option>
                        <option value="7" ${curValue === '7' ? 'selected' : ''}>Mes: Julio</option>
                        <option value="8" ${curValue === '8' ? 'selected' : ''}>Mes: Agosto</option>
                        <option value="9" ${curValue === '9' ? 'selected' : ''}>Mes: Septiembre</option>
                        <option value="10" ${curValue === '10' ? 'selected' : ''}>Mes: Octubre</option>
                        <option value="11" ${curValue === '11' ? 'selected' : ''}>Mes: Noviembre</option>
                        <option value="12" ${curValue === '12' ? 'selected' : ''}>Mes: Diciembre</option>
                    </optgroup>
                    <optgroup label="Corte por Trimestre">
                        <option value="T1" ${curValue === 'T1' ? 'selected' : ''}>1er Trimestre (Ene - Mar)</option>
                        <option value="T2" ${curValue === 'T2' ? 'selected' : ''}>2do Trimestre (Abr - Jun)</option>
                        <option value="T3" ${curValue === 'T3' ? 'selected' : ''}>3er Trimestre (Jul - Sep)</option>
                        <option value="T4" ${curValue === 'T4' ? 'selected' : ''}>4to Trimestre (Oct - Dic)</option>
                    </optgroup>
                `;
            }
        };

        // Selector de Esquemas moderno y limpio
        const sel = document.createElement('select');
        sel.id = 'rdaFilterEsquema';
        sel.innerHTML = `
            <option value="basico">Esquema Básico (0 a 8 años)</option>
            <option value="adultos">Esquemas Adolescentes y Adultos</option>
            <option value="mayores">Esquemas Adultos Mayores</option>
            <option value="embarazadas">Esquema Embarazadas (Tdpa, VSR)</option>
            <option value="invernal">Temporada Invernal (Influenza, COVID)</option>
            <option value="adicionales">Biológicos Adicionales (Varicela, Hep A)</option>
            <option value="comparativa_multianual" id="optComparativeDynamic">Comparativa Multianual (2025 vs 2026)</option>
            <option value="meta_logro_influenza">Evaluación Meta-Logro Influenza</option>
            <option value="abandono_esquema">Índice de Deserción de Esquema</option>
        `;
        function updateComparativeOptionLabel() {
            const opt = document.getElementById('optComparativeDynamic');
            if (opt) {
                const cur = parseInt(selAnio.value, 10);
                let base = cur - 1;
                let comp = cur;
                if (cur <= 2025) {
                    base = 2025;
                    comp = 2026;
                }
                opt.textContent = `Comparativa Multianual (${base} vs ${comp})`;
            }
        }
        sel.addEventListener('change', () => {
            _rdaState.esquema = sel.value;
            if (window.updateTemporalidadOptions) window.updateTemporalidadOptions();
            renderDashboard();
        });

        leftGroup.appendChild(sel);
 
        // Segmented Control de vistas limpio y moderno
        const toggleWrapper = document.createElement('div');
        toggleWrapper.id = 'rdaViewToggleContainer';
        toggleWrapper.innerHTML = `
            <button id="btnViewEsquema" class="active">Por Esquema</button>
            <button id="btnViewBiologico" class="inactive" style="margin-left: 4px !important;">Por Biológico</button>
        `;
        const btnE = toggleWrapper.querySelector('#btnViewEsquema');
        const btnB = toggleWrapper.querySelector('#btnViewBiologico');
        
        btnE.addEventListener('click', () => {
            _rdaState.vistaBasico = 'esquema';
            btnE.className = 'active';
            btnB.className = 'inactive';
            renderDashboard();
        });
        btnB.addEventListener('click', () => {
            _rdaState.vistaBasico = 'biologico';
            btnB.className = 'active';
            btnE.className = 'inactive';
            renderDashboard();
        });

        leftGroup.appendChild(toggleWrapper);
    }

    document.getElementById('rdaFilterMunicipio')?.addEventListener('change', () => {
        populateUnidadFilter(); renderDashboard();
    });
    document.getElementById('rdaFilterUnidad')?.addEventListener('change', () => renderDashboard());

    // Export dropdown
    const expBtn = document.getElementById('btnExportRdaToggle');
    const expDrop = document.getElementById('rdaExportDropdown');
    if (expBtn && expDrop) {
        expBtn.addEventListener('click', () => expDrop.style.display = expDrop.style.display === 'none' ? 'block' : 'none');
        document.addEventListener('click', e => {
            if (!document.getElementById('rdaExportContainer')?.contains(e.target)) expDrop.style.display = 'none';
        });
    }
    document.querySelectorAll('.rda-export-opt').forEach(btn => {
        btn.addEventListener('mouseenter', () => btn.style.background = '#f1f5f9');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
        btn.addEventListener('click', () => {
            expDrop.style.display = 'none';
            const type = btn.dataset.export;
            if (type === 'individual') exportIndividualPDF();
            else if (type === 'png' || type === 'jpeg') exportDashboardImagen(type);
            else if (type === 'masivo_pdf') exportMasivoZIP('pdf');
            else if (type === 'masivo_img') exportMasivoZIP('png');
            else if (type === 'masivo_jpeg') exportMasivoZIP('jpeg');
        });
    });

    // Table sort listeners
    document.querySelectorAll('#rdaDetailTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (_rdaState.sortCol === col) _rdaState.sortAsc = !_rdaState.sortAsc;
            else { _rdaState.sortCol = col; _rdaState.sortAsc = false; }
            renderDashboard();
        });
    });

    initRDAMobileDashboard();
}

async function loadAndRender() {
    try { 
        showSkeletons(); 
        await fetchRDAData(); 
        populateFilters(); 
        populateMobileFilters();
        renderDashboard(); 
        renderMobileDashboard();
    }
    catch (e) { 
        console.error('[RDA]', e); 
    }
}

// Inyección de Skeleton Loader mientras carga los datos de Supabase
function showSkeletons() {
    const kpiContainer = document.getElementById('rdaKpiGrid');
    if (kpiContainer) {
        kpiContainer.innerHTML = Array(4).fill(0).map(() => `
            <div class="rda-kpi-card" style="position: relative; overflow: hidden; background: #fff;">
                <div style="width: 48px; height: 48px; border-radius: 14px; background: #e2e8f0; margin-bottom: 16px;" class="animate-pulse"></div>
                <div style="width: 120px; height: 12px; background: #e2e8f0; border-radius: 4px; margin-bottom: 8px;" class="animate-pulse"></div>
                <div style="width: 80px; height: 32px; background: #e2e8f0; border-radius: 6px; margin-bottom: 12px;" class="animate-pulse"></div>
                <div style="width: 140px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div>
            </div>
        `).join('');
    }

    const tbody = document.getElementById('rdaDetailTbody');
    if (tbody) {
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:16px 24px;"><div style="width: 100px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px;"><div style="width: 180px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px;"><div style="width: 100px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 65px; height: 20px; background: #e2e8f0; border-radius: 6px; margin: 0 auto;" class="animate-pulse"></div></td>
            </tr>
        `).join('');
    }
}

// Supabase fetching con Server-Side RPC
async function fetchRDAData() {
    if (_rdaCache.unidades) return _rdaCache;

    const curYear = _rdaCache.anio;

    // 1. Obtener el mes máximo progresivo en registros_sis
    // SOLUCIÓN DEFINITIVA: La tabla registros_sis tiene RLS (Row Level Security)
    // lo que bloqueaba las lecturas desde el cliente y devolvía un array vacío siempre.
    // He creado una función RPC 'get_rda_max_mes' en la base de datos (SECURITY DEFINER)
    // que puentea el bloqueo y calcula el mes máximo instantáneamente en el servidor.
    const yearInt = parseInt(curYear, 10);
    const maxAllowedMes = (yearInt === new Date().getFullYear()) ? (new Date().getMonth() + 1) : 12;

    const { data: maxMesRpc, error: mesError } = await window.supabase
        .rpc('get_rda_max_mes', { p_anio: yearInt });

    if (mesError) throw mesError;

    let maxMes = parseInt(maxMesRpc, 10);
    if (isNaN(maxMes) || maxMes < 1) maxMes = 1;
    if (maxMes > maxAllowedMes) maxMes = maxAllowedMes;

    // Si hay un corte temporal específico seleccionado (Mes 1..12 o Trimestre T1..T4)
    const corte = _rdaState.corteTemporal;
    if (corte && corte !== '0') {
        if (corte === 'T1') maxMes = 3;
        else if (corte === 'T2') maxMes = 6;
        else if (corte === 'T3') maxMes = 9;
        else if (corte === 'T4') maxMes = 12;
        else {
            const m = parseInt(corte, 10);
            if (!isNaN(m) && m >= 1 && m <= 12) maxMes = m;
        }
    }

    // 2. Consultar el stored procedure de Supabase (pre-agregación en BD)
    const { data: indicators, error: indError } = await window.supabase
        .rpc('get_rda_indicators', { p_anio: yearInt, p_max_mes: maxMes });

    if (indError) throw indError;

    console.log(`[RDA] Loaded ${yearInt} pre-aggregated indicators: ${indicators.length} records. Max Mes: ${maxMes}`);

    let filteredIndicators = (indicators || []).map(u => {
        if (u.nombre) {
            const upper = u.nombre.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("NIÑO Y LA MUJER") || upper === "HENM") {
                u.nombre = "HENM";
            }
        }
        if (u.unidad) {
            const upper = u.unidad.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("NIÑO Y LA MUJER") || upper === "HENM") {
                u.unidad = "HENM";
            }
        }
        return u;
    });
    if (typeof USER !== 'undefined' && USER?.rol === 'CARAVANAS') {
        filteredIndicators = filteredIndicators.filter(u => {
            const name = (u.unidad || u.nombre || '').toUpperCase().trim();
            return name.startsWith('FAM') || name.startsWith('UMME');
        });
    }

    _rdaCache.unidades = filteredIndicators;
    _rdaCache.registros = filteredIndicators;
    _rdaCache.maxMes = maxMes;
    return _rdaCache;
}

function populateFilters() {
    const { unidades } = _rdaCache;
    const muniSel = document.getElementById('rdaFilterMunicipio');
    const uniSel = document.getElementById('rdaFilterUnidad');
    const esquemaSel = document.getElementById('rdaFilterEsquema');
    if (!muniSel || !unidades) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    const allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];

    let municipios = [...new Set(unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();

    // Reset visibility of the filters and container
    if (muniSel.parentElement) {
        muniSel.parentElement.style.display = 'flex';
    }
    muniSel.style.display = 'block';
    if (uniSel) uniSel.style.display = 'block';
    if (esquemaSel) {
        esquemaSel.disabled = false;
        esquemaSel.style.display = 'block';
    }

    if (role === 'ADMIN' || role === 'JURISDICCIONAL' || role === 'CARAVANAS') {
        muniSel.disabled = false;
        if (uniSel) uniSel.disabled = false;
        muniSel.innerHTML = '<option value="">Todos los municipios</option>' +
            municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        muniSel.value = '';
        populateUnidadFilter();
    } else if (role === 'MUNICIPAL') {
        if (uniSel) uniSel.disabled = false;
        
        municipios = municipios.filter(m => {
            // Strip accents for safe comparison with allowed array
            const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return allowed.some(a => mNorm.includes(a) || a.includes(mNorm));
        });
        
        muniSel.innerHTML = municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        
        if (municipios.length === 1) {
            muniSel.value = municipios[0];
            muniSel.disabled = true;
        } else {
            muniSel.disabled = false;
            if (municipios.length > 0) {
                muniSel.value = municipios[0];
            }
        }
        
        // Explicitly populate CLUES with the chosen municipality DOM value
        populateUnidadFilter();
    } else if (role === 'UNIDAD') {
        muniSel.disabled = true;
        if (uniSel) uniSel.disabled = true;

        const userClues = (typeof USER !== 'undefined' && USER?.clues) || '';
        const matchUnit = unidades.find(u => u.clues === userClues);
        if (matchUnit) {
            muniSel.innerHTML = `<option value="${(matchUnit.municipio || '').toUpperCase().trim()}">${matchUnit.municipio}</option>`;
            muniSel.value = (matchUnit.municipio || '').toUpperCase().trim();
            if (uniSel) {
                uniSel.innerHTML = `<option value="${matchUnit.clues}">${matchUnit.nombre || matchUnit.clues}</option>`;
                uniSel.value = matchUnit.clues;
            }
        } else {
            muniSel.innerHTML = '';
            muniSel.value = '';
            if (uniSel) {
                uniSel.innerHTML = '';
                uniSel.value = '';
            }
        }
    }
}

function populateUnidadFilter() {
    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniSel = document.getElementById('rdaFilterUnidad');
    if (!uniSel) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    if (role === 'UNIDAD') {
        uniSel.style.display = 'block';
        uniSel.disabled = true;
        return;
    }

    if (!muni) {
        uniSel.style.display = 'none';
        uniSel.value = '';
        return;
    }

    uniSel.style.display = 'block';
    uniSel.disabled = false;
    const units = (_rdaCache.unidades || [])
        .filter(u => (u.municipio || '').toUpperCase().trim() === muni.toUpperCase().trim())
        .sort((a, b) => (a.clues || '').localeCompare(b.clues || ''));

    uniSel.innerHTML = '<option value="">Todas las unidades</option>' +
        units.map(u => `<option value="${u.clues}">${u.nombre || u.clues}</option>`).join('');
    uniSel.value = '';
}

// Renderización Principal del Tablero
async function renderDashboard() {
    if (window.updateTemporalidadOptions) window.updateTemporalidadOptions();
    const { unidades, maxMes } = _rdaCache;
    if (!unidades) return;

    const muniFilter = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniFilter = document.getElementById('rdaFilterUnidad')?.value || '';
    const esquema = _rdaState.esquema || 'basico';

    const container = document.getElementById('rdaDashboardContent');
    if (container) {
        if (!_rdaState.originalDashboardHtml) {
            _rdaState.originalDashboardHtml = container.innerHTML;
        }
        if (esquema !== 'meta_logro_influenza' && !document.getElementById('rdaKpiGrid')) {
            if (_rdaCharts.b) { try { _rdaCharts.b.dispose(); } catch(e){} _rdaCharts.b = null; }
            if (_rdaCharts.total) { try { _rdaCharts.total.dispose(); } catch(e){} _rdaCharts.total = null; }
            if (_rdaCharts.d) { try { _rdaCharts.d.dispose(); } catch(e){} _rdaCharts.d = null; }
            if (_rdaCharts.comparativa) { try { _rdaCharts.comparativa.dispose(); } catch(e){} _rdaCharts.comparativa = null; }
            if (_rdaCharts.abandono) { try { _rdaCharts.abandono.dispose(); } catch(e){} _rdaCharts.abandono = null; }
            container.innerHTML = _rdaState.originalDashboardHtml;
        }
    }

    const toggleContainer = document.getElementById('rdaViewToggleContainer');
    if (toggleContainer) {
        toggleContainer.style.display = (esquema === 'basico') ? 'inline-flex' : 'none';
    }

    // Labels generales de filtro
    const scopeEl = document.getElementById('rdaScopeLabel');
    if (scopeEl) {
        if (uniFilter) {
            const uMatch = (_rdaCache.unidades||[]).find(x => x.clues === uniFilter);
            scopeEl.textContent = `[${uniFilter}] ${uMatch?.nombre || uniFilter}`;
        } else if (muniFilter) {
            scopeEl.textContent = `Municipio: ${muniFilter.toUpperCase()}`;
        } else {
            scopeEl.textContent = 'Jurisdicción Sanitaria 1 (4 Municipios)';
        }
    }
    const cierreEl = document.getElementById('rdaCierreLabel');
    if (cierreEl) {
        const labelMap = {
            basico: 'Esquema Básico (0-8 años)',
            adultos: 'Adolescentes y Adultos',
            mayores: 'Adultos Mayores',
            embarazadas: 'Embarazadas',
            invernal: 'Temporada Invernal',
            comparativa_multianual: 'Comparativa Multianual (2025 vs 2026)',
            abandono_esquema: 'Índice de Deserción de Esquema'
        };
        const label = labelMap[esquema] || 'Análisis RDA';
        cierreEl.textContent = `${label} | Cierre: ${MONTH_NAMES[(_rdaCache.maxMes||12)-1] || 'Sin datos'}`;
    }

    if (esquema === 'meta_logro_influenza') {
        if (typeof renderInfluenzaIndicatorsDashboard === 'function') {
            renderInfluenzaIndicatorsDashboard(muniFilter, uniFilter);
        }
        return;
    }

    if (esquema === 'comparativa_multianual') {
        await renderComparativaMultianual(muniFilter, uniFilter);
        return;
    }

    if (esquema === 'abandono_esquema') {
        await renderAbandonoEsquema(muniFilter, uniFilter);
        return;
    }

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    // Calcular agregaciones a nivel de filtro actual
    let agg = {
        pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, pob_6_anos: 0, pob_total: 0,
        bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
        hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, srp_6_dosis: 0,
        adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
        am_neumo13: 0, am_neumo20: 0, am_td: 0,
        emb_tdpa: 0, emb_vsr: 0,
        inv_influenza: 0, inv_covid: 0,
        varicela: 0, hepatitis_a: 0,
        // Campos de dosis adicionales para biológicos individuales
        hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0,
        neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0,
        total_unidades: fUnits.length
    };

    for (const u of fUnits) {
        agg.pob_menor_1 += u.pob_menor_1 || 0;
        agg.pob_1_ano += u.pob_1_ano || 0;
        agg.pob_4_anos += u.pob_4_anos || 0;
        agg.pob_6_anos += u.pob_6_anos || 0;

        agg.bcg_dosis += u.bcg_dosis || 0;
        agg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0;
        agg.hexa_3_dosis += u.hexa_3_dosis || 0;
        agg.rota_2_dosis += u.rota_2_dosis || 0;
        agg.neumo_2_dosis += u.neumo_2_dosis || 0;

        agg.hexa_ref_dosis += u.hexa_ref_dosis || 0;
        agg.neumo_ref_dosis += u.neumo_ref_dosis || 0;
        agg.srp_2_dosis += u.srp_2_dosis || 0;
        agg.dpt_4_dosis += u.dpt_4_dosis || 0;
        agg.srp_6_dosis += u.srp_6_dosis || 0;

        agg.adol_hb += u.adol_hb || 0;
        agg.adol_sr += u.adol_sr || 0;
        agg.adol_vph += u.adol_vph || 0;
        agg.adol_td += u.adol_td || 0;
        agg.adol_tdpa += u.adol_tdpa || 0;

        agg.am_neumo13 += u.am_neumo13 || 0;
        agg.am_neumo20 += u.am_neumo20 || 0;
        agg.am_td += u.am_td || 0;

        agg.emb_tdpa += u.emb_tdpa || 0;
        agg.emb_vsr += u.emb_vsr || 0;

        agg.inv_influenza += u.inv_influenza || 0;
        agg.inv_covid += u.inv_covid || 0;
        
        agg.varicela += u.varicela || 0;
        agg.hepatitis_a += u.hepatitis_a || 0;

        // Nuevos campos agregados
        agg.hexa_1_dosis += u.hexa_1_dosis || 0;
        agg.hexa_2_dosis += u.hexa_2_dosis || 0;
        agg.neumo_1_dosis += u.neumo_1_dosis || 0;
        agg.neumo_c1_dosis += u.neumo_c1_dosis || 0;
        agg.neumo_c2_dosis += u.neumo_c2_dosis || 0;
        agg.neumo_c3_dosis += u.neumo_c3_dosis || 0;
        agg.srp_1_dosis += u.srp_1_dosis || 0;
    }

    agg.pob_total = (agg.pob_menor_1 || 0) + (agg.pob_1_ano || 0) + (agg.pob_4_anos || 0) + (_rdaCache.anio === 2025 ? (agg.pob_6_anos || 0) : 0);

    // Coberturas globales
    const factorMenor1 = (agg.pob_menor_1 * 0.0833) * maxMes;
    const factorUno = (agg.pob_1_ano * 0.0833) * maxMes;
    const factorCuatro = (agg.pob_4_anos * 0.0833) * maxMes;
    const factorSeis = ((agg.pob_6_anos || agg.pob_4_anos) * 0.0833) * maxMes;

    const sumaDosisMenor1 = agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis;
    const sumaDosisUno = agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis;
    const sumaDosisCuatro = agg.dpt_4_dosis;
    const sumaDosisSeis = agg.srp_6_dosis || 0;

    agg.cobertura_menor1 = factorMenor1 > 0 ? Math.round((((sumaDosisMenor1 / 4.0) / factorMenor1) * 100) * 10) / 10 : 0;
    agg.cobertura_uno = factorUno > 0 ? Math.round((((sumaDosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
    agg.cobertura_cuatro = factorCuatro > 0 ? Math.round(((sumaDosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
    agg.cobertura_seis = factorSeis > 0 ? Math.round(((sumaDosisSeis / factorSeis) * 100) * 10) / 10 : 0;

    // Coberturas por Biológico individual (Fórmulas RDA Oficiales)
    agg.cobertura_bcg = factorMenor1 > 0 ? Math.round(((agg.bcg_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hepb = factorMenor1 > 0 ? Math.round(((agg.hepb_0_7_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_rota = factorMenor1 > 0 ? Math.round(((agg.rota_2_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hexa_m1 = factorMenor1 > 0 ? Math.round(((agg.hexa_1_dosis + agg.hexa_2_dosis + agg.hexa_3_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hexa_uno = factorUno > 0 ? Math.round(((agg.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_neumo_m1 = factorMenor1 > 0 ? Math.round(((agg.neumo_1_dosis + agg.neumo_2_dosis + agg.neumo_c1_dosis + agg.neumo_c2_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_neumo_uno = factorUno > 0 ? Math.round(((agg.neumo_ref_dosis + agg.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_srp = factorUno > 0 ? Math.round(((agg.srp_1_dosis + agg.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_dpt = factorCuatro > 0 ? Math.round(((agg.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;

    // Renderizar componentes
    const isSingleUnit = fUnits.length === 1;
    const grid = document.getElementById('rdaAnalysisGrid');
    const doughnutContainer = document.getElementById('chartDoughnutContainer');
    
    if (!isSingleUnit && grid && doughnutContainer) {
        doughnutContainer.style.display = 'none';
        grid.style.gridTemplateColumns = '1fr 1fr';
    } else if (grid && doughnutContainer) {
        doughnutContainer.style.display = 'flex';
        grid.style.gridTemplateColumns = '350px 1fr';
    }

    renderKPIs(agg, esquema);
    if (isSingleUnit) {
        renderDoughnut(agg, esquema);
    }
    renderBarChart(fUnits, muniFilter, esquema);
    renderTable(fUnits, esquema, agg);
}



// Constructor Dinámico de KPIs
function renderKPIs(agg, esquema) {
    const container = document.getElementById('rdaKpiGrid');
    if (!container) return;
    container.innerHTML = '';

    let list = [...(SCHEME_KPIS[esquema] || SCHEME_KPIS.basico)];
    if (esquema === 'basico' && _rdaCache.anio === 2025) {
        // Insertar tarjeta de KPI Niños de 6 Años antes de la tarjeta de Población
        list.splice(3, 0, { label: 'Niños de 6 Años (6)', icon: 'school', bg: '#fff1f2', fg: '#e11d48', key: 'seis' });
    }
    
    list.forEach(k => {
        let valText = '';
        let subText = '';
        let valNum = 0;
        let isPobCard = (k.key === 'pob');
        let cardBg = '#ffffff';
        let valColor = '#0f172a';
        let badgeHtml = '';

        let statusLabel = 'DOSIS APLICADAS';
        let statusColor = '#64748b';
        let barGrad = 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)';
        let barShadow = '0 0 10px rgba(2, 132, 199, 0.3)';

        if (esquema === 'basico') {
            if (k.key === 'menor1') {
                valNum = agg.cobertura_menor1;
                valText = `${valNum}%`;
                const sumDosis = agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis;
                subText = `${sumDosis.toLocaleString('es-MX')} dosis | Pob: ${agg.pob_menor_1.toLocaleString('es-MX')}`;
            } else if (k.key === 'uno') {
                valNum = agg.cobertura_uno;
                valText = `${valNum}%`;
                const sumDosis = agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis;
                subText = `${sumDosis.toLocaleString('es-MX')} dosis | Pob: ${agg.pob_1_ano.toLocaleString('es-MX')}`;
            } else if (k.key === 'cuatro') {
                valNum = agg.cobertura_cuatro;
                valText = `${valNum}%`;
                subText = `${agg.dpt_4_dosis.toLocaleString('es-MX')} dosis | Pob: ${agg.pob_4_anos.toLocaleString('es-MX')}`;
            } else if (k.key === 'seis') {
                valNum = agg.cobertura_seis;
                valText = `${valNum}%`;
                subText = `${(agg.srp_6_dosis || 0).toLocaleString('es-MX')} dosis | Pob: ${(agg.pob_6_anos || 0).toLocaleString('es-MX')}`;
            } else if (k.key === 'pob') {
                valText = agg.pob_total.toLocaleString('es-MX');
                subText = `${agg.total_unidades} unidades médicas`;
            }

            if (!isPobCard) {
                if (valNum >= 95) {
                    statusLabel = 'ÓPTIMO (META ALCANZADA)';
                    statusColor = '#15803d';
                    barGrad = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
                    barShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
                } else if (valNum >= 75) {
                    statusLabel = 'REGULAR (AVANCE MEDIO)';
                    statusColor = '#d97706';
                    barGrad = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                    barShadow = '0 0 10px rgba(245, 158, 11, 0.3)';
                } else {
                    statusLabel = 'CRÍTICO (REQUIERE ATENCIÓN)';
                    statusColor = '#dc2626';
                    barGrad = 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)';
                    barShadow = '0 0 10px rgba(244, 63, 94, 0.3)';
                }
            } else {
                statusLabel = 'JURISDICCIÓN SANITARIA NO. 1 (0-8 AÑOS)';
                statusColor = '#64748b';
            }
        } else {
            if (k.key === 'pob') {
                valText = agg.total_unidades.toLocaleString('es-MX');
                subText = 'unidades médicas';
                statusLabel = 'UNIDADES MÉDICAS ACTIVAS';
                statusColor = '#64748b';
            } else {
                valNum = agg[k.key] || 0;
                valText = valNum.toLocaleString('es-MX');
                subText = 'dosis aplicadas en el periodo';
                statusLabel = 'DOSIS APLICADAS';
                statusColor = '#0284c7';
                barGrad = 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)';
                barShadow = '0 0 10px rgba(2, 132, 199, 0.3)';
            }
        }

        const card = document.createElement('div');
        card.className = 'rda-kpi-card';
        card.style.background = cardBg;

        if (isPobCard && esquema === 'basico') {
            const has6A = (_rdaCache.anio === 2025);
            const gridCols = has6A ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))';
            const pM1 = agg.pob_menor_1 || 0;
            const p1A = agg.pob_1_ano || 0;
            const p4A = agg.pob_4_anos || 0;
            const p6A = agg.pob_6_anos || 0;
            const pTot = agg.pob_total || (pM1 + p1A + p4A + p6A) || 1;
            const pctM1 = Math.round((pM1 / pTot) * 100);
            const pct1A = Math.round((p1A / pTot) * 100);
            const pct4A = Math.round((p4A / pTot) * 100);
            const pct6A = has6A ? Math.round((p6A / pTot) * 100) : 0;

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div class="rda-icon-box" style="background: ${k.bg}; color: ${k.fg}; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <span class="material-symbols-rounded" style="font-size:20px;">groups</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.2;">Población Meta Total</div>
                </div>
                <div style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; line-height: 1.1;">${valText} <span style="font-size: 12px; font-weight: 700; color: #94a3b8;">hab.</span></div>
                <div style="font-size: 9.5px; font-weight: 900; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;">JURISDICCIÓN SANITARIA NO. 1 (0-8 AÑOS)</div>
                
                <!-- BARRA MULTI-SEGMENTO DE PROPORCIÓN DE POBLACIÓN -->
                <div style="margin: 10px 0 8px 0;">
                    <div style="width: 100%; height: 7px; background: rgba(15, 23, 42, 0.06); border-radius: 999px; overflow: hidden; display: flex; gap: 2px;">
                        <div style="height: 100%; width: ${pctM1}%; background: #0d9488;" title="<1 Año: ${pctM1}%"></div>
                        <div style="height: 100%; width: ${pct1A}%; background: #0284c7;" title="1 Año: ${pct1A}%"></div>
                        <div style="height: 100%; width: ${pct4A}%; background: #7c3aed;" title="4 Años: ${pct4A}%"></div>
                        ${has6A ? `<div style="height: 100%; width: ${pct6A}%; background: #e11d48;" title="6 Años: ${pct6A}%"></div>` : ''}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: ${gridCols}; gap: 4px; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px;">
                    <div style="background: #f8fafc; padding: 5px 3px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; min-width: 0; box-sizing: border-box;">
                        <div style="font-size: 8.5px; font-weight: 800; color: #0d9488; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><1 Año</div>
                        <div style="font-size: 10.5px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agg.pob_menor_1.toLocaleString('es-MX')}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 5px 3px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; min-width: 0; box-sizing: border-box;">
                        <div style="font-size: 8.5px; font-weight: 800; color: #0284c7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">1 Año</div>
                        <div style="font-size: 10.5px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agg.pob_1_ano.toLocaleString('es-MX')}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 5px 3px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; min-width: 0; box-sizing: border-box;">
                        <div style="font-size: 8.5px; font-weight: 800; color: #7c3aed; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">4 Años</div>
                        <div style="font-size: 10.5px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agg.pob_4_anos.toLocaleString('es-MX')}</div>
                    </div>
                    ${has6A ? `
                    <div style="background: #f8fafc; padding: 5px 3px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; min-width: 0; box-sizing: border-box;">
                        <div style="font-size: 8.5px; font-weight: 800; color: #e11d48; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">6 Años</div>
                        <div style="font-size: 10.5px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(agg.pob_6_anos || 0).toLocaleString('es-MX')}</div>
                    </div>` : ''}
                </div>
            `;
        } else {
            const barPct = Math.min(100, Math.max(8, valNum));
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div class="rda-icon-box" style="background: ${k.bg}; color: ${k.fg}; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <span class="material-symbols-rounded" style="font-size:20px;">${k.icon}</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.2;">${k.label}</div>
                </div>
                <div style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; line-height: 1.1;">${valText}</div>
                <div style="font-size: 9.5px; font-weight: 900; color: ${statusColor}; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;">${statusLabel}</div>
                
                <!-- BARRA DE AVANCE MODERNA PREMIUM -->
                <div style="margin: 10px 0 8px 0;">
                    <div style="width: 100%; height: 7px; background: rgba(15, 23, 42, 0.06); border-radius: 999px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${barPct}%; background: ${barGrad}; box-shadow: ${barShadow}; border-radius: 999px; transition: width 0.8s ease;"></div>
                    </div>
                </div>

                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px;">${subText}</div>
            `;
        }
        container.appendChild(card);
    });
}

// Chart.js Recycler: In-Place Doughnut update
function renderDoughnut(agg, esquema) {
    const ctx = document.getElementById('chartDoughnut');
    if (!ctx) return;

    let labels = [];
    let data = [];
    let backgroundColors = [];
    let centerValue = '';
    let centerLabel = '';

    if (esquema === 'basico') {
        if (_rdaState.vistaBasico === 'biologico') {
            labels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
            data = [agg.cobertura_bcg, agg.cobertura_hepb, agg.cobertura_rota, agg.cobertura_hexa_m1, agg.cobertura_hexa_uno, agg.cobertura_neumo_m1, agg.cobertura_neumo_uno, agg.cobertura_srp, agg.cobertura_dpt];
            backgroundColors = ['#A5CBE3', '#E8B2B2', '#93BCCD', '#CDE69A', '#9ACD32', '#ACAFC8', '#3D405B', '#F3B7CA', '#F3E0AF'];
        } else {
            labels = ['< 1 Año', '1 Año', '4 Años'];
            data = [agg.cobertura_menor1, agg.cobertura_uno, agg.cobertura_cuatro];
            backgroundColors = ['#0d9488', '#0284c7', '#7c3aed'];
        }
        const validCovs = data.filter(d => d > 0);
        const avg = validCovs.length ? Math.round(validCovs.reduce((a,b)=>a+b,0) / validCovs.length) : 0;
        centerValue = avg + '%';
        centerLabel = 'Promedio';
    } else if (esquema === 'adultos') {
        labels = ['HepB', 'SR', 'VPH', 'Td', 'Tdpa'];
        data = [agg.adol_hb, agg.adol_sr, agg.adol_vph, agg.adol_td, agg.adol_tdpa];
        backgroundColors = ['#0d9488', '#0284c7', '#7c3aed', '#ea580c', '#db2777'];
    } else if (esquema === 'mayores') {
        labels = ['Neumo 13', 'Neumo 20', 'Td'];
        data = [agg.am_neumo13, agg.am_neumo20, agg.am_td];
        backgroundColors = ['#0d9488', '#0284c7', '#7c3aed'];
    } else if (esquema === 'embarazadas') {
        labels = ['Tdpa', 'VSR'];
        data = [agg.emb_tdpa, agg.emb_vsr];
        backgroundColors = ['#db2777', '#0d9488'];
    } else if (esquema === 'invernal') {
        labels = ['Influenza', 'COVID-19'];
        data = [agg.inv_influenza, agg.inv_covid];
        backgroundColors = ['#0284c7', '#7c3aed'];
    } else if (esquema === 'adicionales') {
        labels = ['Varicela', 'Hepatitis A'];
        data = [agg.varicela, agg.hepatitis_a];
        backgroundColors = ['#8ED1C2', '#BDBDBD'];
    }

    if (esquema !== 'basico') {
        const sum = data.reduce((a,b) => a + (b||0), 0);
        centerValue = sum.toLocaleString();
        centerLabel = 'Total Dosis';
    }

    if (typeof echarts === 'undefined') {
        console.warn('[RDA] ECharts aún no está disponible (CDN pendiente). Reintentando en 500ms...');
        setTimeout(() => renderDoughnut(agg, esquema), 500);
        return;
    }
    if (!_rdaCharts.d) {
        _rdaCharts.d = echarts.init(ctx);
    }
    
    let eData = [];
    for(let i=0; i<data.length; i++) {
        eData.push({ value: data[i], name: labels[i], itemStyle: { color: backgroundColors[i] } });
    }

    _rdaCharts.d.setOption({
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        title: {
            text: centerValue,
            subtext: centerLabel,
            left: 'center',
            top: '40%',
            textStyle: { fontSize: 32, fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' },
            subtextStyle: { fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'Inter, sans-serif' },
            itemGap: 4
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            textStyle: { color: '#fff' },
            borderWidth: 0,
            borderRadius: 10
        },
        legend: {
            type: 'scroll',
            bottom: 0,
            icon: 'circle',
            itemGap: 15,
            textStyle: { color: '#64748b', fontWeight: 'bold' },
            pageIconColor: '#3b82f6',
            pageTextStyle: { color: '#64748b' }
        },
        series: [{
            type: 'pie',
            radius: ['55%', '75%'],
            center: ['50%', '42%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            data: eData
        }]
    }, true);
}

// Chart.js Recycler: In-Place Horizontal Bar / Combo chart update
function renderBarChart(fUnits, muniFilter, esquema) {
    const ctx = document.getElementById('chartBar');
    const ctxTotal = document.getElementById('chartBarTotal');
    const totalContainer = document.getElementById('chartBarTotalContainer');
    
    if (!ctx) return;

    const titleEl = document.getElementById('chartBarTitle');
    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';
    const maxMes = _rdaCache.maxMes || 12;

    const isSingleUnit = fUnits.length === 1;

    let labels = [];
    let finalDatasets = [];
    let isHorizontal = !isSingleUnit;
    let titleText = '';

    // Lógica para Total Jurisdiccional (oculto por defecto)
    if (totalContainer) totalContainer.style.display = 'none';

    if (isSingleUnit) {
        const currentYear = new Date().getFullYear();
        titleText = `Avance Anual ${currentYear}`;
        const u = fUnits[0];

        if (esquema === 'basico') {
            if (_rdaState.vistaBasico === 'biologico') {
                labels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
                const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

                const appBCG = u.bcg_dosis || 0;
                const appHepB = u.hepb_0_7_dosis || 0;
                const appRota = u.rota_2_dosis || 0;
                const appHexaM1 = (u.hexa_1_dosis||0) + (u.hexa_2_dosis||0) + (u.hexa_3_dosis||0);
                const appHexa1A = u.hexa_ref_dosis || 0;
                const appNeumoM1 = (u.neumo_1_dosis||0) + (u.neumo_2_dosis||0) + (u.neumo_c1_dosis||0) + (u.neumo_c2_dosis||0);
                const appNeumo1A = (u.neumo_ref_dosis||0) + (u.neumo_c3_dosis||0);
                const appSRP = (u.srp_1_dosis||0) + (u.srp_2_dosis||0);
                const appDPT = u.dpt_4_dosis || 0;

                const covBCG = factorM1 > 0 ? Math.round((appBCG / factorM1 * 100) * 10) / 10 : 0;
                const covHepB = factorM1 > 0 ? Math.round((appHepB / factorM1 * 100) * 10) / 10 : 0;
                const covRota = factorM1 > 0 ? Math.round((appRota / factorM1 * 100) * 10) / 10 : 0;
                const covHexaM1 = factorM1 > 0 ? Math.round((appHexaM1 / factorM1 * 100) * 10) / 10 : 0;
                const covHexa1A = factorUno > 0 ? Math.round((appHexa1A / factorUno * 100) * 10) / 10 : 0;
                const covNeumoM1 = factorM1 > 0 ? Math.round((appNeumoM1 / factorM1 * 100) * 10) / 10 : 0;
                const covNeumo1A = factorUno > 0 ? Math.round((appNeumo1A / factorUno * 100) * 10) / 10 : 0;
                const covSRP = factorUno > 0 ? Math.round((appSRP / factorUno * 100) * 10) / 10 : 0;
                const covDPT = factorCuatro > 0 ? Math.round((appDPT / factorCuatro * 100) * 10) / 10 : 0;

                finalDatasets = [
                    {
                        type: 'bar',
                        label: 'Aplicaciones',
                        data: [appBCG, appHepB, appRota, appHexaM1, appHexa1A, appNeumoM1, appNeumo1A, appSRP, appDPT],
                        backgroundColor: '#e2e8f0',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Meta',
                        data: [
                            Math.round(factorM1), Math.round(factorM1), Math.round(factorM1),
                            Math.round(factorM1), Math.round(factorUno),
                            Math.round(factorM1), Math.round(factorUno),
                            Math.round(factorUno), Math.round(factorCuatro)
                        ],
                        backgroundColor: '#0f172a',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Avance',
                        data: [covBCG, covHepB, covRota, covHexaM1, covHexa1A, covNeumoM1, covNeumo1A, covSRP, covDPT],
                        borderColor: '#3b82f6',
                        borderWidth: 4,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#3b82f6',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        yAxisID: 'y1',
                        order: 0
                    }
                ];
            } else {
                labels = ['< 1 Año', '1 Año', '4 Años'];
                const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

                const dosisM1 = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                const dosisUno = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0);
                const dosisCuatro = u.dpt_4_dosis||0;

                const covM1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                const covUno = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                const covCuatro = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

                finalDatasets = [
                    {
                        type: 'bar',
                        label: 'Aplicaciones',
                        data: [Math.round(dosisM1/4.0), Math.round(dosisUno/3.0), dosisCuatro],
                        backgroundColor: '#e2e8f0',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Meta',
                        data: [Math.round(factorM1), Math.round(factorUno), Math.round(factorCuatro)],
                        backgroundColor: '#0f172a',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Avance',
                        data: [covM1, covUno, covCuatro],
                        borderColor: '#3b82f6',
                        borderWidth: 4,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#3b82f6',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        yAxisID: 'y1',
                        order: 0
                    }
                ];
            }
        } else {
            labels = [''];
            if (esquema === 'adultos') {
                finalDatasets = [
                    { type: 'bar', label: 'HepB', data: [u.adol_hb||0], backgroundColor: '#c43d3d', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'SR', data: [u.adol_sr||0], backgroundColor: '#7b5ea7', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'VPH', data: [u.adol_vph||0], backgroundColor: '#2a9d8f', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Td', data: [u.adol_td||0], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Tdpa', data: [u.adol_tdpa||0], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'mayores') {
                finalDatasets = [
                    { type: 'bar', label: 'Neumo 13', data: [u.am_neumo13||0], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Neumo 20', data: [u.am_neumo20||0], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Td', data: [u.am_td||0], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'embarazadas') {
                finalDatasets = [
                    { type: 'bar', label: 'Tdpa', data: [u.emb_tdpa||0], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'VSR', data: [u.emb_vsr||0], backgroundColor: '#d8b4a0', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'invernal') {
                finalDatasets = [
                    { type: 'bar', label: 'Influenza', data: [u.inv_influenza||0], backgroundColor: '#f1bdad', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'COVID-19', data: [u.inv_covid||0], backgroundColor: '#4a4a4a', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'adicionales') {
                finalDatasets = [
                    { type: 'bar', label: 'Varicela', data: [u.varicela||0], backgroundColor: '#8ED1C2', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Hepatitis A', data: [u.hepatitis_a||0], backgroundColor: '#BDBDBD', borderRadius: 6, barThickness: 40 }
                ];
            }
        }
    } else {
        let d1 = [], d2 = [], d3 = [], d4 = [], d5 = [], d6 = [], d7 = [], d8 = [], d9 = [];
        let datasetConfigs = [];
        if (esquema === 'basico') {
            if (_rdaState.vistaBasico === 'biologico') {
                datasetConfigs = [
                    { label: 'BCG', data: d1, backgroundColor: '#A5CBE3' },
                    { label: 'HepB', data: d2, backgroundColor: '#E8B2B2' },
                    { label: 'Rota', data: d3, backgroundColor: '#93BCCD' },
                    { label: 'Hexa <1A', data: d4, backgroundColor: '#CDE69A' },
                    { label: 'Hexa 1A', data: d5, backgroundColor: '#9ACD32' },
                    { label: 'Neumo <1A', data: d6, backgroundColor: '#ACAFC8' },
                    { label: 'Neumo 1A', data: d7, backgroundColor: '#3D405B' },
                    { label: 'SRP', data: d8, backgroundColor: '#F3B7CA' },
                    { label: 'DPT', data: d9, backgroundColor: '#F3E0AF' }
                ];
            } else {
                datasetConfigs = [
                    { label: '< 1 Año', data: d1, backgroundColor: '#0d9488' },
                    { label: '1 Año', data: d2, backgroundColor: '#0284c7' },
                    { label: '4 Años', data: d3, backgroundColor: '#7c3aed' }
                ];
            }
        } else if (esquema === 'adultos') {
            datasetConfigs = [
                { label: 'HepB', data: d1, backgroundColor: '#c43d3d' },
                { label: 'SR', data: d2, backgroundColor: '#7b5ea7' },
                { label: 'VPH', data: d3, backgroundColor: '#2a9d8f' },
                { label: 'Td', data: d4, backgroundColor: '#9e9e9e' },
                { label: 'Tdpa', data: d5, backgroundColor: '#e76f51' }
            ];
        } else if (esquema === 'mayores') {
            datasetConfigs = [
                { label: 'Neumo 13', data: d1, backgroundColor: '#3d405b' },
                { label: 'Neumo 20', data: d2, backgroundColor: '#3d405b' },
                { label: 'Td Mayores', data: d3, backgroundColor: '#9e9e9e' }
            ];
        } else if (esquema === 'embarazadas') {
            datasetConfigs = [
                { label: 'Tdpa', data: d1, backgroundColor: '#e76f51' },
                { label: 'VSR', data: d2, backgroundColor: '#d8b4a0' }
            ];
        } else if (esquema === 'invernal') {
            datasetConfigs = [
                { label: 'Influenza', data: d1, backgroundColor: '#f1bdad' },
                { label: 'COVID-19', data: d2, backgroundColor: '#4a4a4a' }
            ];
        } else if (esquema === 'adicionales') {
            datasetConfigs = [
                { label: 'Varicela', data: d1, backgroundColor: '#8ED1C2' },
                { label: 'Hepatitis A', data: d2, backgroundColor: '#BDBDBD' }
            ];
        }

        if (!muniFilter && (role === 'ADMIN' || role === 'JURISDICCIONAL')) {
            titleText = 'Análisis por Municipio';
            const munis = [...new Set(_rdaCache.unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();
            for (const m of munis) {
                labels.push(m);
                const muniUnits = _rdaCache.unidades.filter(u => (u.municipio || '').toUpperCase().trim() === m);
                let mAgg = {
                    pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
                    hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                    am_neumo13: 0, am_neumo20: 0, am_td: 0, emb_tdpa: 0, emb_vsr: 0, inv_influenza: 0, inv_covid: 0,
                    hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0, neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0,
                    varicela: 0, hepatitis_a: 0
                };
                for (const u of muniUnits) {
                    mAgg.pob_menor_1 += u.pob_menor_1 || 0; mAgg.pob_1_ano += u.pob_1_ano || 0; mAgg.pob_4_anos += u.pob_4_anos || 0;
                    mAgg.bcg_dosis += u.bcg_dosis || 0; mAgg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0; mAgg.hexa_3_dosis += u.hexa_3_dosis || 0; mAgg.rota_2_dosis += u.rota_2_dosis || 0; mAgg.neumo_2_dosis += u.neumo_2_dosis || 0;
                    mAgg.hexa_ref_dosis += u.hexa_ref_dosis || 0; mAgg.neumo_ref_dosis += u.neumo_ref_dosis || 0; mAgg.srp_2_dosis += u.srp_2_dosis || 0; mAgg.dpt_4_dosis += u.dpt_4_dosis || 0;
                    mAgg.adol_hb += u.adol_hb || 0; mAgg.adol_sr += u.adol_sr || 0; mAgg.adol_vph += u.adol_vph || 0; mAgg.adol_td += u.adol_td || 0; mAgg.adol_tdpa += u.adol_tdpa || 0;
                    mAgg.am_neumo13 += u.am_neumo13 || 0; mAgg.am_neumo20 += u.am_neumo20 || 0; mAgg.am_td += u.am_td || 0;
                    mAgg.emb_tdpa += u.emb_tdpa || 0; mAgg.emb_vsr += u.emb_vsr || 0; mAgg.inv_influenza += u.inv_influenza || 0; mAgg.inv_covid += u.inv_covid || 0;
                    mAgg.hexa_1_dosis += u.hexa_1_dosis || 0; mAgg.hexa_2_dosis += u.hexa_2_dosis || 0; mAgg.neumo_1_dosis += u.neumo_1_dosis || 0;
                    mAgg.neumo_c1_dosis += u.neumo_c1_dosis || 0; mAgg.neumo_c2_dosis += u.neumo_c2_dosis || 0; mAgg.neumo_c3_dosis += u.neumo_c3_dosis || 0; mAgg.srp_1_dosis += u.srp_1_dosis || 0;
                    mAgg.varicela += u.varicela || 0; mAgg.hepatitis_a += u.hepatitis_a || 0;
                }
                if (esquema === 'basico') {
                    const factorM1 = (mAgg.pob_menor_1 * 0.0833) * maxMes; const factorUno = (mAgg.pob_1_ano * 0.0833) * maxMes; const factorCuatro = (mAgg.pob_4_anos * 0.0833) * maxMes;
                    if (_rdaState.vistaBasico === 'biologico') {
                        d1.push(factorM1 > 0 ? Math.round(((mAgg.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d2.push(factorM1 > 0 ? Math.round(((mAgg.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d3.push(factorM1 > 0 ? Math.round(((mAgg.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d4.push(factorM1 > 0 ? Math.round(((mAgg.hexa_1_dosis + mAgg.hexa_2_dosis + mAgg.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d5.push(factorUno > 0 ? Math.round(((mAgg.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d6.push(factorM1 > 0 ? Math.round(((mAgg.neumo_1_dosis + mAgg.neumo_2_dosis + mAgg.neumo_c1_dosis + mAgg.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d7.push(factorUno > 0 ? Math.round(((mAgg.neumo_ref_dosis + mAgg.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d8.push(factorUno > 0 ? Math.round(((mAgg.srp_1_dosis + mAgg.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d9.push(factorCuatro > 0 ? Math.round(((mAgg.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0);
                    } else {
                        const dosisM1 = mAgg.bcg_dosis + mAgg.hepb_0_7_dosis + mAgg.hexa_3_dosis + mAgg.rota_2_dosis + mAgg.neumo_2_dosis;
                        const dosisUno = mAgg.hexa_ref_dosis + mAgg.neumo_ref_dosis + mAgg.srp_2_dosis; const dosisCuatro = mAgg.dpt_4_dosis;
                        d1.push(factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0);
                        d2.push(factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0);
                        d3.push(factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0);
                    }
                } else if (esquema === 'adultos') { d1.push(mAgg.adol_hb); d2.push(mAgg.adol_sr); d3.push(mAgg.adol_vph); d4.push(mAgg.adol_td); d5.push(mAgg.adol_tdpa);
                } else if (esquema === 'mayores') { d1.push(mAgg.am_neumo13); d2.push(mAgg.am_neumo20); d3.push(mAgg.am_td);
                } else if (esquema === 'embarazadas') { d1.push(mAgg.emb_tdpa); d2.push(mAgg.emb_vsr);
                } else if (esquema === 'invernal') { d1.push(mAgg.inv_influenza); d2.push(mAgg.inv_covid);
                } else if (esquema === 'adicionales') { d1.push(mAgg.varicela); d2.push(mAgg.hepatitis_a); }
            }
        } else {
            titleText = 'Top 10 Unidades';
            const results = fUnits.map(u => {
                const res = { clues: u.clues, nombre: u.nombre };
                if (esquema === 'basico') {
                    const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes; const factorUno = (u.pob_1_ano * 0.0833) * maxMes; const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;
                    if (_rdaState.vistaBasico === 'biologico') {
                        res.v1 = factorM1 > 0 ? Math.round(((u.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v2 = factorM1 > 0 ? Math.round(((u.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v3 = factorM1 > 0 ? Math.round(((u.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v4 = factorM1 > 0 ? Math.round(((u.hexa_1_dosis + u.hexa_2_dosis + u.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v5 = factorUno > 0 ? Math.round(((u.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v6 = factorM1 > 0 ? Math.round(((u.neumo_1_dosis + u.neumo_2_dosis + u.neumo_c1_dosis + u.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v7 = factorUno > 0 ? Math.round(((u.neumo_ref_dosis + u.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v8 = factorUno > 0 ? Math.round(((u.srp_1_dosis + u.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v9 = factorCuatro > 0 ? Math.round(((u.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;
                        res.sortVal = (res.v1 + res.v2 + res.v3 + res.v4 + res.v5 + res.v6 + res.v7 + res.v8 + res.v9) / 9.0;
                    } else {
                        const dosisM1 = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                        const dosisUno = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0); const dosisCuatro = u.dpt_4_dosis||0;
                        res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                        res.v2 = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                        res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                        res.sortVal = res.v1;
                    }
                } else if (esquema === 'adultos') { res.v1 = u.adol_hb || 0; res.v2 = u.adol_sr || 0; res.v3 = u.adol_vph || 0; res.v4 = u.adol_td || 0; res.v5 = u.adol_tdpa || 0; res.sortVal = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
                } else if (esquema === 'mayores') { res.v1 = u.am_neumo13 || 0; res.v2 = u.am_neumo20 || 0; res.v3 = u.am_td || 0; res.sortVal = res.v1 + res.v2 + res.v3;
                } else if (esquema === 'embarazadas') { res.v1 = u.emb_tdpa || 0; res.v2 = u.emb_vsr || 0; res.sortVal = res.v1 + res.v2;
                } else if (esquema === 'invernal') { res.v1 = u.inv_influenza || 0; res.v2 = u.inv_covid || 0; res.sortVal = res.v1 + res.v2;
                } else if (esquema === 'adicionales') { res.v1 = u.varicela || 0; res.v2 = u.hepatitis_a || 0; res.sortVal = res.v1 + res.v2; }
                return res;
            }).sort((a, b) => b.sortVal - a.sortVal).slice(0, 10);

            for (const r of results) {
                labels.push((r.nombre || r.clues).substring(0, 20));
                d1.push(r.v1 || 0); d2.push(r.v2 || 0); d3.push(r.v3 || 0);
                if (r.v4 !== undefined) d4.push(r.v4);
                if (r.v5 !== undefined) d5.push(r.v5);
                if (r.v6 !== undefined) d6.push(r.v6);
                if (r.v7 !== undefined) d7.push(r.v7);
                if (r.v8 !== undefined) d8.push(r.v8);
                if (r.v9 !== undefined) d9.push(r.v9);
            }
        }
        finalDatasets = datasetConfigs.map((cfg) => ({ label: cfg.label, data: cfg.data, backgroundColor: cfg.backgroundColor, borderRadius: 6, barThickness: 12 }));

        // Renderizar Total Jurisdiccional o Municipal (Suma de TODAS las unidades en fUnits)
        if (totalContainer && ctxTotal) {
            totalContainer.style.display = 'flex';
            const titleElTotal = document.getElementById('chartBarTotalTitle');
            if (titleElTotal) titleElTotal.textContent = muniFilter ? 'Avance Municipal Total' : 'Avance Jurisdiccional Total';
            
            let tAgg = {
                pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, pob_6_anos: 0, bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
                hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, srp_6_dosis: 0, adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                am_neumo13: 0, am_neumo20: 0, am_td: 0, emb_tdpa: 0, emb_vsr: 0, inv_influenza: 0, inv_covid: 0,
                varicela: 0, hepatitis_a: 0,
                hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0, neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0
            };
            for (const u of fUnits) {
                tAgg.pob_menor_1 += u.pob_menor_1 || 0; tAgg.pob_1_ano += u.pob_1_ano || 0; tAgg.pob_4_anos += u.pob_4_anos || 0; tAgg.pob_6_anos += u.pob_6_anos || 0;
                tAgg.bcg_dosis += u.bcg_dosis || 0; tAgg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0; tAgg.hexa_3_dosis += u.hexa_3_dosis || 0; tAgg.rota_2_dosis += u.rota_2_dosis || 0; tAgg.neumo_2_dosis += u.neumo_2_dosis || 0;
                tAgg.hexa_ref_dosis += u.hexa_ref_dosis || 0; tAgg.neumo_ref_dosis += u.neumo_ref_dosis || 0; tAgg.srp_2_dosis += u.srp_2_dosis || 0; tAgg.dpt_4_dosis += u.dpt_4_dosis || 0; tAgg.srp_6_dosis += u.srp_6_dosis || 0;
                tAgg.adol_hb += u.adol_hb || 0; tAgg.adol_sr += u.adol_sr || 0; tAgg.adol_vph += u.adol_vph || 0; tAgg.adol_td += u.adol_td || 0; tAgg.adol_tdpa += u.adol_tdpa || 0;
                tAgg.am_neumo13 += u.am_neumo13 || 0; tAgg.am_neumo20 += u.am_neumo20 || 0; tAgg.am_td += u.am_td || 0;
                tAgg.emb_tdpa += u.emb_tdpa || 0; tAgg.emb_vsr += u.emb_vsr || 0; tAgg.inv_influenza += u.inv_influenza || 0; tAgg.inv_covid += u.inv_covid || 0;
                tAgg.varicela += u.varicela || 0; tAgg.hepatitis_a += u.hepatitis_a || 0;
                tAgg.hexa_1_dosis += u.hexa_1_dosis || 0; tAgg.hexa_2_dosis += u.hexa_2_dosis || 0; tAgg.neumo_1_dosis += u.neumo_1_dosis || 0;
                tAgg.neumo_c1_dosis += u.neumo_c1_dosis || 0; tAgg.neumo_c2_dosis += u.neumo_c2_dosis || 0; tAgg.neumo_c3_dosis += u.neumo_c3_dosis || 0; tAgg.srp_1_dosis += u.srp_1_dosis || 0;
            }
            
            let tLabels = [];
            let tDatasets = [];
            let tOptions = {
                responsive: true, maintainAspectRatio: false,
                devicePixelRatio: 3,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } }, tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, mode: 'index', intersect: false } },
                scales: { x: { ticks: { color: '#0f172a', font: { size: 12, weight: '800' } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }, grid: { color: '#f1f5f9', borderDash: [5,5] } } }
            };

            if (esquema === 'basico') {
                if (_rdaState.vistaBasico === 'biologico') {
                    tLabels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
                    if (_rdaCache.anio === 2025) tLabels.push('SRP 6A');

                    const factorM1 = (tAgg.pob_menor_1 * 0.0833) * maxMes;
                    const factorUno = (tAgg.pob_1_ano * 0.0833) * maxMes;
                    const factorCuatro = (tAgg.pob_4_anos * 0.0833) * maxMes;
                    const factorSeis = ((tAgg.pob_6_anos || tAgg.pob_4_anos) * 0.0833) * maxMes;

                    const appBCG = tAgg.bcg_dosis || 0;
                    const appHepB = tAgg.hepb_0_7_dosis || 0;
                    const appRota = tAgg.rota_2_dosis || 0;
                    const appHexaM1 = (tAgg.hexa_1_dosis||0) + (tAgg.hexa_2_dosis||0) + (tAgg.hexa_3_dosis||0);
                    const appHexa1A = tAgg.hexa_ref_dosis || 0;
                    const appNeumoM1 = (tAgg.neumo_1_dosis||0) + (tAgg.neumo_2_dosis||0) + (tAgg.neumo_c1_dosis||0) + (tAgg.neumo_c2_dosis||0);
                    const appNeumo1A = (tAgg.neumo_ref_dosis||0) + (tAgg.neumo_c3_dosis||0);
                    const appSRP = (tAgg.srp_1_dosis||0) + (tAgg.srp_2_dosis||0);
                    const appDPT = tAgg.dpt_4_dosis || 0;
                    const appSRP6 = tAgg.srp_6_dosis || 0;

                    const covBCG = factorM1 > 0 ? Math.round((appBCG / factorM1 * 100) * 10) / 10 : 0;
                    const covHepB = factorM1 > 0 ? Math.round((appHepB / factorM1 * 100) * 10) / 10 : 0;
                    const covRota = factorM1 > 0 ? Math.round((appRota / factorM1 * 100) * 10) / 10 : 0;
                    const covHexaM1 = factorM1 > 0 ? Math.round((appHexaM1 / factorM1 * 100) * 10) / 10 : 0;
                    const covHexa1A = factorUno > 0 ? Math.round((appHexa1A / factorUno * 100) * 10) / 10 : 0;
                    const covNeumoM1 = factorM1 > 0 ? Math.round((appNeumoM1 / factorM1 * 100) * 10) / 10 : 0;
                    const covNeumo1A = factorUno > 0 ? Math.round((appNeumo1A / factorUno * 100) * 10) / 10 : 0;
                    const covSRP = factorUno > 0 ? Math.round((appSRP / factorUno * 100) * 10) / 10 : 0;
                    const covDPT = factorCuatro > 0 ? Math.round((appDPT / factorCuatro * 100) * 10) / 10 : 0;
                    const covSRP6 = factorSeis > 0 ? Math.round((appSRP6 / factorSeis * 100) * 10) / 10 : 0;

                    const appData = [appBCG, appHepB, appRota, appHexaM1, appHexa1A, appNeumoM1, appNeumo1A, appSRP, appDPT];
                    const metaData = [
                        Math.round(factorM1), Math.round(factorM1), Math.round(factorM1),
                        Math.round(factorM1), Math.round(factorUno),
                        Math.round(factorM1), Math.round(factorUno),
                        Math.round(factorUno), Math.round(factorCuatro)
                    ];
                    const avanceData = [covBCG, covHepB, covRota, covHexaM1, covHexa1A, covNeumoM1, covNeumo1A, covSRP, covDPT];

                    if (_rdaCache.anio === 2025) {
                        appData.push(appSRP6);
                        metaData.push(Math.round(factorSeis));
                        avanceData.push(covSRP6);
                    }

                    tDatasets = [
                        { type: 'bar', label: 'Aplicaciones', data: appData, backgroundColor: '#e2e8f0', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'bar', label: 'Meta', data: metaData, backgroundColor: '#0f172a', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'line', label: 'Avance', data: avanceData, borderColor: '#3b82f6', borderWidth: 4, tension: 0.4, fill: false, pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, yAxisID: 'y1', order: 0 }
                    ];
                } else {
                    tLabels = ['< 1 Año', '1 Año', '4 Años'];
                    if (_rdaCache.anio === 2025) tLabels.push('6 Años');

                    const factorM1 = (tAgg.pob_menor_1 * 0.0833) * maxMes; 
                    const factorUno = (tAgg.pob_1_ano * 0.0833) * maxMes; 
                    const factorCuatro = (tAgg.pob_4_anos * 0.0833) * maxMes;
                    const factorSeis = ((tAgg.pob_6_anos || tAgg.pob_4_anos) * 0.0833) * maxMes;

                    const dosisM1 = tAgg.bcg_dosis + tAgg.hepb_0_7_dosis + tAgg.hexa_3_dosis + tAgg.rota_2_dosis + tAgg.neumo_2_dosis;
                    const dosisUno = tAgg.hexa_ref_dosis + tAgg.neumo_ref_dosis + tAgg.srp_2_dosis; 
                    const dosisCuatro = tAgg.dpt_4_dosis;
                    const dosisSeis = tAgg.srp_6_dosis || 0;

                    let covM1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                    let covUno = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                    let covCuatro = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                    let covSeis = factorSeis > 0 ? Math.round(((dosisSeis / factorSeis) * 100) * 10) / 10 : 0;
                    
                    const appData = [Math.round(dosisM1/4.0), Math.round(dosisUno/3.0), dosisCuatro];
                    const metaData = [Math.round(factorM1), Math.round(factorUno), Math.round(factorCuatro)];
                    const avanceData = [covM1, covUno, covCuatro];

                    if (_rdaCache.anio === 2025) {
                        appData.push(dosisSeis);
                        metaData.push(Math.round(factorSeis));
                        avanceData.push(covSeis);
                    }

                    tDatasets = [
                        { type: 'bar', label: 'Aplicaciones', data: appData, backgroundColor: '#e2e8f0', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'bar', label: 'Meta', data: metaData, backgroundColor: '#0f172a', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'line', label: 'Avance', data: avanceData, borderColor: '#3b82f6', borderWidth: 4, tension: 0.4, fill: false, pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, yAxisID: 'y1', order: 0 }
                    ];
                }
                tOptions.scales.y1 = { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#64748b', callback: v => v + '%' } };
            } else {
                tLabels = [''];
                if (esquema === 'adultos') {
                    tDatasets = [
                        { type: 'bar', label: 'HepB', data: [tAgg.adol_hb], backgroundColor: '#c43d3d', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'SR', data: [tAgg.adol_sr], backgroundColor: '#7b5ea7', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'VPH', data: [tAgg.adol_vph], backgroundColor: '#2a9d8f', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Td', data: [tAgg.adol_td], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Tdpa', data: [tAgg.adol_tdpa], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'mayores') {
                    tDatasets = [
                        { type: 'bar', label: 'Neumo 13', data: [tAgg.am_neumo13], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Neumo 20', data: [tAgg.am_neumo20], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Td', data: [tAgg.am_td], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'embarazadas') {
                    tDatasets = [
                        { type: 'bar', label: 'Tdpa', data: [tAgg.emb_tdpa], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'VSR', data: [tAgg.emb_vsr], backgroundColor: '#d8b4a0', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'invernal') {
                    tDatasets = [
                        { type: 'bar', label: 'Influenza', data: [tAgg.inv_influenza], backgroundColor: '#f1bdad', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'COVID-19', data: [tAgg.inv_covid], backgroundColor: '#4a4a4a', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'adicionales') {
                    tDatasets = [
                        { type: 'bar', label: 'Varicela', data: [tAgg.varicela], backgroundColor: '#8ED1C2', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Hepatitis A', data: [tAgg.hepatitis_a], backgroundColor: '#BDBDBD', borderRadius: 6, barThickness: 40 }
                    ];
                }
            }

            if (typeof echarts === 'undefined') { console.warn('[RDA] ECharts no disponible para chartBarTotal'); return; }
            if (!_rdaCharts.total) _rdaCharts.total = echarts.init(ctxTotal);
            let eSeries = tDatasets.map(ds => {
                let series = { name: ds.label, type: ds.type || 'bar', data: ds.data };
                if (series.type === 'bar') {
                    series.itemStyle = { color: ds.backgroundColor, borderRadius: [4, 4, 0, 0] };
                    series.emphasis = { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } };
                    if (ds.label === 'Aplicaciones' || ds.label === 'Dosis' || ds.label === 'Avance General') {
                        series.emphasis.itemStyle.color = '#52525b';
                    }
                    if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
                } else if (series.type === 'line') {
                    series.color = ds.borderColor || ds.backgroundColor || '#3b82f6';
                    series.lineStyle = { color: ds.borderColor || '#3b82f6', width: ds.borderWidth || 3 };
                    series.itemStyle = { color: ds.borderColor || '#3b82f6', borderColor: ds.pointBackgroundColor || '#ffffff', borderWidth: 2 };
                    series.symbol = 'circle';
                    series.symbolSize = 8;
                    if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
                }
                return series;
            });
            _rdaCharts.total.resize();
            _rdaCharts.total.setOption({
                animationDuration: 1000,
                animationEasing: 'cubicOut',
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' }, borderWidth: 0, borderRadius: 12 },
                legend: { bottom: 0, icon: 'circle', textStyle: { fontFamily: 'Inter, sans-serif', color: '#64748b', fontWeight: 'bold' } },
                grid: { left: '2%', right: '2%', bottom: '15%', top: '15%', containLabel: true },
                xAxis: { type: 'category', data: tLabels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
                yAxis: [
                    { type: 'value', axisLabel: { color: '#94a3b8', fontFamily: 'Inter, sans-serif' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
                    { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%', fontFamily: 'Inter, sans-serif' }, splitLine: { show: false } }
                ],
                series: eSeries
            }, true);
        }
    }


    if (titleEl) titleEl.textContent = titleText;

    if (typeof echarts === 'undefined') {
        console.warn('[RDA] ECharts aún no está disponible (CDN pendiente). Reintentando en 500ms...');
        setTimeout(() => renderBarChart(fUnits, muniFilter, esquema), 500);
        return;
    }
    if (!_rdaCharts.b) _rdaCharts.b = echarts.init(ctx);

    let eSeries = finalDatasets.map(ds => {
        let series = { name: ds.label, type: ds.type || 'bar', data: ds.data };
        if (series.type === 'bar') {
            series.itemStyle = { color: ds.backgroundColor, borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] };
            series.emphasis = { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } };
            if (ds.label === 'Aplicaciones' || ds.label === 'Dosis' || ds.label === 'Avance General' || ds.backgroundColor === '#e2e8f0') {
                series.emphasis.itemStyle.color = '#52525b';
            }
            if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
        } else if (series.type === 'line') {
            series.color = ds.borderColor || ds.backgroundColor || '#3b82f6';
            series.lineStyle = { color: ds.borderColor || '#3b82f6', width: ds.borderWidth || 3 };
            series.itemStyle = { color: ds.borderColor || '#3b82f6', borderColor: ds.pointBackgroundColor || '#ffffff', borderWidth: 2 };
            series.symbol = 'circle';
            series.symbolSize = 8;
            if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
        }
        return series;
    });

    let eOptions = {
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' }, borderWidth: 0, borderRadius: 12 },
        legend: { bottom: 0, icon: 'circle', show: isSingleUnit || isHorizontal, textStyle: { fontFamily: 'Inter, sans-serif', color: '#64748b', fontWeight: 'bold' } },
        grid: { left: '2%', right: '2%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: isHorizontal ? { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }, axisLabel: { fontFamily: 'Inter, sans-serif' } } : { type: 'category', data: labels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: isHorizontal ? { type: 'category', data: labels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, inverse: true, axisLine: { lineStyle: { color: '#e2e8f0' } } } : [
            { type: 'value', axisLabel: { color: '#94a3b8', fontFamily: 'Inter, sans-serif' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
            { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%', fontFamily: 'Inter, sans-serif' }, splitLine: { show: false } }
        ],
        series: eSeries
    };

    _rdaCharts.b.resize();
    _rdaCharts.b.setOption(eOptions, true);

    // Ensure ECharts resizes when window resizes
    if (!window._rdaEchartsResizeAttached) {
        window.addEventListener('resize', () => {
            if (_rdaCharts.b) _rdaCharts.b.resize();
            if (_rdaCharts.total) _rdaCharts.total.resize();
            if (_rdaCharts.d) _rdaCharts.d.resize();
            if (_rdaCharts.comparativa) { try { _rdaCharts.comparativa.resize(); } catch(e){} }
        });
        window._rdaEchartsResizeAttached = true;
    }
}

// Renderización de la Tabla de Datos con Cabecera Dinámica y Columna "Meta" Condicional
function renderTable(fUnits, esquema, agg) {
    const table = document.getElementById('rdaDetailTable');
    const tbody = document.getElementById('rdaDetailTbody');
    const countEl = document.getElementById('rdaTableCount');
    if (!tbody || !table) return;

    const maxMes = _rdaCache.maxMes || 12;

    // 1. Columnas específicas de la vacuna según esquema
    let vCols = [];
    if (esquema === 'basico') {
        if (_rdaState.vistaBasico === 'biologico') {
            vCols = [
                { n: 'BCG', s: 'v1' },
                { n: 'HepB', s: 'v2' },
                { n: 'Rota', s: 'v3' },
                { n: 'Hexa <1A', s: 'v4' },
                { n: 'Hexa 1A', s: 'v5' },
                { n: 'Neumo <1A', s: 'v6' },
                { n: 'Neumo 1A', s: 'v7' },
                { n: 'SRP', s: 'v8' },
                { n: 'DPT', s: 'v9' }
            ];
            if (_rdaCache.anio === 2025) {
                vCols.push({ n: 'SRP 6A', s: 'v10' });
            }
        } else {
            vCols = [{ n: '< 1 Año', s: 'v1' }, { n: '1 Año', s: 'v2' }, { n: '4 Años', s: 'v3' }];
            if (_rdaCache.anio === 2025) {
                vCols.push({ n: '6 Años', s: 'v4' });
            }
        }
    } else if (esquema === 'adultos') {
        vCols = [
            { n: 'HepB', s: 'v1' }, { n: 'SR', s: 'v2' }, { n: 'VPH', s: 'v3' }, 
            { n: 'Td', s: 'v4' }, { n: 'Tdpa', s: 'v5' }
        ];
    } else if (esquema === 'mayores') {
        vCols = [{ n: 'Neumo 13', s: 'v1' }, { n: 'Neumo 20', s: 'v2' }, { n: 'Td Mayores', s: 'v3' }];
    } else if (esquema === 'embarazadas') {
        vCols = [{ n: 'Tdpa', s: 'v1' }, { n: 'VSR', s: 'v2' }];
    } else if (esquema === 'invernal') {
        vCols = [{ n: 'Influenza', s: 'v1' }, { n: 'COVID-19', s: 'v2' }];
    } else if (esquema === 'adicionales') {
        vCols = [{ n: 'Varicela', s: 'v1' }, { n: 'Hepatitis A', s: 'v2' }];
    }

    // "Meta" sólo es visible para el esquema "basico"
    const showMeta = (esquema === 'basico');
    // Proporciones fijas de columnas
    const numV = vCols.length;
    const colGroupHTML = `
        <colgroup>
            <col style="width: 130px;">
            <col style="width: 220px;">
            <col style="width: 150px;">
            ${vCols.map(() => `<col style="width: 110px;">`).join('')}
            ${showMeta ? `<col style="width: 95px;">` : ''}
            <col style="width: 95px;">
        </colgroup>
    `;

    const headerColsHTML = `
        <tr style="background: #f8fafc; color: #475569; font-weight: 800; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px; text-align: left;" data-sort="clues">CLUES</th>
            <th style="padding: 12px; text-align: left;" data-sort="nombre">UNIDAD MÉDICA</th>
            <th style="padding: 12px; text-align: left;" data-sort="municipio">MUNICIPIO</th>
            ${vCols.map(c => `<th style="padding: 12px; text-align: center;" data-sort="${c.s}">${c.n}</th>`).join('')}
            ${showMeta ? `<th style="padding: 12px; text-align: center;" data-sort="meta">META</th>` : ''}
            <th style="padding: 12px; text-align: center;" data-sort="total">TOTAL</th>
        </tr>
    `;

    table.querySelectorAll('colgroup').forEach(cg => cg.remove());
    table.insertAdjacentHTML('afterbegin', colGroupHTML);
    const thead = table.querySelector('thead');
    thead.innerHTML = headerColsHTML;

    thead.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (_rdaState.sortCol === col) _rdaState.sortAsc = !_rdaState.sortAsc;
            else { _rdaState.sortCol = col; _rdaState.sortAsc = false; }
            renderDashboard();
        });
    });

    // 2. Mapear filas
    const rows = fUnits.map(u => {
        const res = { 
            clues: u.clues, 
            nombre: u.nombre, 
            municipio: u.municipio, 
            pob: (u.pob_menor_1 || 0) + (u.pob_1_ano || 0) + (u.pob_4_anos || 0) 
        };

        if (esquema === 'basico') {
            const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
            const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
            const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;
            const factorSeis = ((u.pob_6_anos || u.pob_4_anos) * 0.0833) * maxMes;

            if (_rdaState.vistaBasico === 'biologico') {
                res.v1 = factorM1 > 0 ? Math.round(((u.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v2 = factorM1 > 0 ? Math.round(((u.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v3 = factorM1 > 0 ? Math.round(((u.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v4 = factorM1 > 0 ? Math.round(((u.hexa_1_dosis + u.hexa_2_dosis + u.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v5 = factorUno > 0 ? Math.round(((u.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v6 = factorM1 > 0 ? Math.round(((u.neumo_1_dosis + u.neumo_2_dosis + u.neumo_c1_dosis + u.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v7 = factorUno > 0 ? Math.round(((u.neumo_ref_dosis + u.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v8 = factorUno > 0 ? Math.round(((u.srp_1_dosis + u.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v9 = factorCuatro > 0 ? Math.round(((u.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;
                if (_rdaCache.anio === 2025) {
                    res.v10 = factorSeis > 0 ? Math.round(((u.srp_6_dosis || 0) / factorSeis * 100) * 10) / 10 : 0;
                }
                res.dosis = (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_1_dosis || 0) + (u.hexa_2_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_1_dosis || 0) + (u.neumo_2_dosis || 0) + (u.neumo_c1_dosis || 0) + (u.neumo_c2_dosis || 0) + (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.neumo_c3_dosis || 0) + (u.srp_1_dosis || 0) + (u.srp_2_dosis || 0) + (u.dpt_4_dosis || 0) + (u.srp_6_dosis || 0);
            } else {
                const dosisM1 = (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_2_dosis || 0);
                const dosisUno = (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.srp_2_dosis || 0);
                const dosisCuatro = u.dpt_4_dosis || 0;
                const dosisSeis = u.srp_6_dosis || 0;

                res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                res.v2 = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                if (_rdaCache.anio === 2025) {
                    res.v4 = factorSeis > 0 ? Math.round(((dosisSeis / factorSeis) * 100) * 10) / 10 : 0;
                }
                res.dosis = dosisM1 + dosisUno + dosisCuatro + dosisSeis;
            }
        } else if (esquema === 'adultos') {
            res.v1 = u.adol_hb || 0;
            res.v2 = u.adol_sr || 0;
            res.v3 = u.adol_vph || 0;
            res.v4 = u.adol_td || 0;
            res.v5 = u.adol_tdpa || 0;
            res.dosis = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
        } else if (esquema === 'mayores') {
            res.v1 = u.am_neumo13 || 0;
            res.v2 = u.am_neumo20 || 0;
            res.v3 = u.am_td || 0;
            res.dosis = res.v1 + res.v2 + res.v3;
        } else if (esquema === 'embarazadas') {
            res.v1 = u.emb_tdpa || 0;
            res.v2 = u.emb_vsr || 0;
            res.dosis = res.v1 + res.v2;
        } else if (esquema === 'invernal') {
            res.v1 = u.inv_influenza || 0;
            res.v2 = u.inv_covid || 0;
            res.dosis = res.v1 + res.v2;
        } else if (esquema === 'adicionales') {
            res.v1 = u.varicela || 0;
            res.v2 = u.hepatitis_a || 0;
            res.dosis = res.v1 + res.v2;
        }
        return res;
    });

    if (_rdaState.sortCol) {
        const col = _rdaState.sortCol;
        rows.sort((a, b) => {
            const va = a[col] === undefined ? 0 : a[col];
            const vb = b[col] === undefined ? 0 : b[col];
            return typeof va === 'string' 
                ? (_rdaState.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)) 
                : (_rdaState.sortAsc ? va - vb : vb - va);
        });
    } else {
        rows.sort((a, b) => {
            const mCmp = (a.municipio || '').localeCompare(b.municipio || '');
            if (mCmp !== 0) return mCmp;
            return (a.clues || '').localeCompare(b.clues || '');
        });
    }

    if (countEl) countEl.textContent = `${rows.length} unidades`;
    
    const badge = (v, vName) => {
        if (esquema !== 'basico') {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 12.5px; font-weight: 900; color: #0f172a; line-height: 1.2;">${v ? v.toLocaleString('es-MX') : '0'}</div>
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">DOSIS</div>
                </div>
            `;
        }

        const pct = typeof v === 'number' ? v : (parseFloat(v) || 0);
        let statusText = 'ÓPTIMO';
        let statusColor = '#15803d';
        // Check-circle
        let statusIcon = '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>';
        if (pct < 80) {
            statusText = 'CRÍTICO';
            statusColor = '#dc2626';
            // Triángulo de alerta
            statusIcon = '<path d="M12 3l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="16.6" r=".6" fill="currentColor" stroke="none"/>';
        } else if (pct < 95) {
            statusText = 'REGULAR';
            statusColor = '#d97706';
            // Círculo con guion (estado intermedio)
            statusIcon = '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r=".6" fill="currentColor" stroke="none"/>';
        }
        const barPct = Math.max(0, Math.min(100, pct));

        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;" title="${statusText}">
                <div style="display: inline-flex; align-items: center; gap: 5px;">
                    <span style="display: flex; align-items: center; justify-content: center; color: ${statusColor}; flex-shrink: 0;">
                        <svg viewBox="0 0 24 24" width="13" height="13" style="fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;">${statusIcon}</svg>
                    </span>
                    <span style="font-size: 13px; font-weight: 900; color: #0f172a; line-height: 1.2;">${pct}%</span>
                </div>
                <span style="display: block; width: 52px; height: 4px; border-radius: 2px; background: #eef1f6; overflow: hidden;">
                    <span style="display: block; height: 100%; border-radius: 2px; width: ${barPct}%; background: ${statusColor};"></span>
                </span>
            </div>
        `;
    };

    let html = '';
    let currentMuni = null;
    const totalCols = 4 + vCols.length + (showMeta ? 1 : 0);

    rows.forEach(r => {
        const muni = (r.municipio || 'Sin Municipio').toUpperCase();
        if (!_rdaState.sortCol && muni !== currentMuni && fUnits.length > 1) {
            html += `<tr><td colspan="${totalCols}" style="padding:12px 24px; background-color:#f8fafc; font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #e2e8f0; border-top:2px solid #e2e8f0;">${muni}</td></tr>`;
            currentMuni = muni;
        }
        html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:16px 24px;font-size:11px;font-weight:700;color:#64748b;">${r.clues}</td>
            <td style="padding:16px 24px;font-size:11px;font-weight:800;color:#0f172a">${r.nombre}</td>
            <td style="padding:16px 24px;font-size:11px;color:#64748b;font-weight:600;">${r.municipio}</td>
            ${vCols.map(c => `<td style="padding:8px 12px;text-align:center">${badge(r[c.s], c.n)}</td>`).join('')}
            ${showMeta ? `<td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#64748b">${(r.pob || 0).toLocaleString('es-MX')}</td>` : ''}
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#0f172a">${(r.dosis || 0).toLocaleString('es-MX')}</td>
        </tr>`;
    });

    // Fila Destacada de Total — JURISDICCIONAL para perfiles con acceso a todas las unidades,
    // MUNICIPAL para el rol MUNICIPAL (solo suma las unidades de su propio municipio, que es
    // lo único que `rows`/`agg` contienen en ese caso porque el filtro de municipio es obligatorio),
    // y CARAVANAS para el rol CARAVANAS (solo suma sus propias unidades FAM/UMME, ya filtradas
    // desde la carga de datos; puede abarcar uno o varios municipios según el filtro elegido).
    const roleForTotal = String((typeof USER !== 'undefined' && USER?.rol) || '').toUpperCase();
    const canSeeJurisdictionTotal = ['ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL'].includes(roleForTotal);
    const canSeeMunicipalTotal = roleForTotal === 'MUNICIPAL';
    const canSeeCaravanasTotal = roleForTotal === 'CARAVANAS';
    if ((canSeeJurisdictionTotal || canSeeMunicipalTotal || canSeeCaravanasTotal) && rows.length > 0) {
        let totalRowLabel;
        if (canSeeMunicipalTotal) {
            totalRowLabel = `TOTAL MUNICIPAL (${(rows[0]?.municipio || '').toUpperCase()})`;
        } else if (canSeeCaravanasTotal) {
            const caravanasMunicipios = [...new Set(rows.map(r => (r.municipio || '').toUpperCase()))];
            totalRowLabel = caravanasMunicipios.length === 1
                ? `TOTAL CARAVANAS (${caravanasMunicipios[0]})`
                : 'TOTAL CARAVANAS (JURISDICCIÓN SANITARIA 1)';
        } else {
            totalRowLabel = 'TOTAL JURISDICCIONAL (JURISDICCIÓN SANITARIA 1)';
        }
        const jurPob = rows.reduce((sum, r) => sum + (r.pob || 0), 0);
        const jurDosis = rows.reduce((sum, r) => sum + (r.dosis || 0), 0);
        
        // Usar los porcentajes de cobertura globales calculados para la Jurisdicción en agg (no promedio simple de unidades)
        const jurVCols = vCols.map(c => {
            if (c.s === 'v1') return agg.cobertura_menor1;
            if (c.s === 'v2') return agg.cobertura_uno;
            if (c.s === 'v3') return agg.cobertura_cuatro;
            if (c.s === 'v4' && _rdaCache.anio === 2025) return agg.cobertura_seis;
            
            const validRows = rows.filter(r => r[c.s] !== undefined && !isNaN(r[c.s]));
            if (validRows.length === 0) return '—';
            const sumVal = validRows.reduce((s, r) => s + r[c.s], 0);
            return Math.round((sumVal / validRows.length) * 10) / 10;
        });

        html += `
            <tr style="background-color:#f1f5f9; color:#0f172a; font-weight:900; border-top:2px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">
                <td colspan="3" style="padding:14px 24px; font-size:12px; uppercase tracking-wider; color:#0f172a; font-weight:900;">${totalRowLabel}</td>
                ${vCols.map((c, idx) => `<td style="padding:12px 10px; text-align:center;">${badge(jurVCols[idx], c.n)}</td>`).join('')}
                ${showMeta ? `<td style="padding:14px 24px; text-align:center; font-size:12px; font-weight:900; color:#0369a1;">${jurPob.toLocaleString('es-MX')}</td>` : ''}
                <td style="padding:14px 24px; text-align:center; font-size:12px; font-weight:900; color:#0f766e;">${jurDosis.toLocaleString('es-MX')}</td>
            </tr>
        `;
    }

    tbody.innerHTML = rows.length === 0
        ? `<tr><td colspan="${totalCols}" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>`
        : html;
}

// ══════════ EXPORT ══════════
function _tLabel() { return `Cierre_${MONTH_NAMES[_rdaCache.maxMes-1] || 'Final'}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

// Motor de exportación a PDF (Premium Vectorial - Direct Render)
async function generarPDFRobusto(elementoOrigenId, nombreArchivo, devolverBlob = false) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("[RDA PDF] Iniciando exportación nativa vectorial premium con patrón corporativo...");
            if (typeof updateOverlayProgress === 'function') {
                updateOverlayProgress(30, 100, "Construyendo plantilla vectorial y encabezados...", "Procesando Documento", "EXPORTACIÓN PDF");
            }
            
            if (typeof window.ensureJsPdfLoaded === 'function') await window.ensureJsPdfLoaded();
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
            if (!jsPDF) { throw new Error("La librería jsPDF no está cargada en el DOM."); }

            // 1. Obtener Metadatos y Configuración
            const esquemaSel = document.getElementById('rdaFilterEsquema');
            const esquemaTexto = esquemaSel ? esquemaSel.options[esquemaSel.selectedIndex].text : 'Análisis RDA';
            const muni = document.getElementById('rdaFilterMunicipio')?.value || 'JURISDICCIÓN SANITARIA 1';
            const maxMesLabel = MONTH_NAMES[_rdaCache.maxMes-1] || 'FINAL';
            
            // 2. Extraer estructura y datos de la tabla real
            const tablaOriginal = document.querySelector('#rdaDetailTable');
            if (!tablaOriginal && _rdaState.esquema === 'comparativa_multianual') {
                const container = document.getElementById('rdaDashboardContent');
                if (!container) return reject("Contenido comparativo no encontrado.");
                
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
                const marginX = 15;
                let currentY = 18;

                // Encabezado Corporativo
                doc.setFillColor(15, 23, 42); doc.rect(0, 0, 279.4, 6, 'F');
                doc.setFillColor(2, 132, 199); doc.rect(0, 6, 279.4, 1.5, 'F');

                const activeScopeVal = document.getElementById('rdaFilterMunicipio')?.value || '';
                const scopeDisplay = activeScopeVal ? `MUNICIPIO: ${activeScopeVal.toUpperCase()}` : (document.getElementById('rdaScopeLabel')?.textContent || 'JURISDICCIÓN SANITARIA 1');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8); doc.setTextColor(2, 132, 199);
                doc.text("SECRETARÍA DE SALUD DEL ESTADO DE QUERÉTARO — JURISDICCIÓN SANITARIA NO. 1", marginX, currentY + 2);

                doc.setFontSize(18); doc.setTextColor(15, 23, 42);
                doc.text("Comparativa Multianual de Cobertura Vacunal (2025 vs 2026)", marginX, currentY + 10);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5); doc.setTextColor(2, 132, 199);
                doc.text(`ÁMBITO DE EVALUACIÓN: ${scopeDisplay}   |   CIERRE MES: ${maxMesLabel.toUpperCase()}`, marginX, currentY + 16);

                currentY = 44;

                // Captura del Histograma ECharts Comparativo
                const chartDom = document.getElementById('chartComparativeMulti');
                let chartImgBase64 = '';
                if (chartDom && typeof echarts !== 'undefined') {
                    const chartInst = echarts.getInstanceByDom(chartDom);
                    if (chartInst) {
                        chartImgBase64 = chartInst.getDataURL({ type: 'png', backgroundColor: '#ffffff', pixelRatio: 2 });
                    }
                }

                if (chartImgBase64) {
                    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
                    doc.roundedRect(marginX, currentY, 249.4, 75, 4, 4, 'FD');
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
                    doc.text("HISTOGRAMA DE COBERTURA (2025 vs 2026)", marginX + 6, currentY + 7);
                    doc.addImage(chartImgBase64, 'PNG', marginX + 6, currentY + 10, 237.4, 60, undefined, 'FAST');
                    currentY += 82;
                }

                // Extracción e Inyección de Tablas Comparativas del DOM con sanitización de iconos
                const cleanCellText = (str) => {
                    if (!str) return '';
                    return str
                        .replace(/\b(child_care|groups|elderly|pregnant_woman|ac_unit|new_releases|location_city|local_hospital|domain|bookmark|vaccines|location_on|trending_up|trending_down|verified)\b/gi, '')
                        .replace(/[↕\n\r]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                };

                const tables = Array.from(container.querySelectorAll('table'));
                tables.forEach((tbl, tIdx) => {
                    const headers = Array.from(tbl.querySelectorAll('thead tr')).map(tr => {
                        return Array.from(tr.querySelectorAll('th')).map(th => cleanCellText(th.innerText));
                    });
                    const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr => {
                        return Array.from(tr.querySelectorAll('td')).map(td => cleanCellText(td.innerText));
                    });

                    if (currentY > 160) {
                        doc.addPage();
                        currentY = 20;
                    }

                    if (headers.length > 0 && rows.length > 0) {
                        doc.autoTable({
                            head: headers,
                            body: rows,
                            startY: currentY,
                            margin: { left: marginX, right: marginX },
                            theme: 'grid',
                            styles: { fontSize: 7.5, font: 'helvetica', valign: 'middle', halign: 'center' },
                            headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', halign: 'center' },
                            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
                        });
                        currentY = doc.lastAutoTable.finalY + 10;
                    }
                });

                // Numeración de páginas
                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
                    doc.text(`REPORTE GENERADO EL ${new Date().toLocaleString('es-MX')} — INTELIGENCIA OPERATIVA JS1`, marginX, 208);
                    doc.text(`Página ${i} de ${totalPages}`, 264.4, 208, { align: 'right' });
                }

                if (devolverBlob) {
                    return resolve(doc.output('blob'));
                } else {
                    doc.save(nombreArchivo);
                    return resolve(true);
                }
            }
            if (!tablaOriginal) return reject("Tabla de datos no encontrada.");

            const tableHeaders = Array.from(tablaOriginal.querySelectorAll('thead th'))
                .map(th => th.innerText.replace(/[↕\n\r]/g, '').trim());

            const tableRowsRaw = Array.from(tablaOriginal.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            });

            // Lógica Universal: Agrupar por Unidad y Municipio
            const colsLen = tableHeaders.length - 3;
            tableHeaders.splice(0, 3);
            
            const isSingleUnit = tableRowsRaw.length === 1;

            // 3. Obtener imágenes base64 de las gráficas
            let imgChart1Base64 = '';
            let titleChart1 = '';
            let titleChart2 = '';
            
            const isMuniFilter = muni && muni !== 'JURISDICCIÓN SANITARIA 1' && muni.trim() !== '';

            if (isSingleUnit) {
                const currentYear = new Date().getFullYear();
                imgChart1Base64 = _rdaCharts.d ? _rdaCharts.d.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
                titleChart1 = "DISTRIBUCIÓN DE AVANCE";
                titleChart2 = `AVANCE ANUAL ${currentYear}`;
            } else {
                imgChart1Base64 = _rdaCharts.total ? _rdaCharts.total.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
                titleChart1 = isMuniFilter ? "AVANCE MUNICIPAL TOTAL" : "AVANCE JURISDICCIONAL TOTAL";
                titleChart2 = isMuniFilter ? "TOP UNIDADES DEL MUNICIPIO" : "TOP 10 UNIDADES";
            }
            const imgTopBase64 = _rdaCharts.b ? _rdaCharts.b.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
            
            const tablesGrouped = [];
            let currentBody = [];
            let currentGroupName = '';
            
            tableRowsRaw.forEach(row => {
                if (row.length === 1) {
                    if (currentBody.length > 0) {
                        tablesGrouped.push({ muni: currentGroupName, rows: currentBody });
                        currentBody = [];
                    }
                    currentGroupName = row[0];
                    return;
                }

                const unitClues = row[0] || '';
                const unitName = row[1] || '';
                
                if (!isSingleUnit) {
                    currentBody.push([{
                        content: `UNIDAD: ${unitName.toUpperCase()}   |   CLUES: ${unitClues}`,
                        colSpan: colsLen,
                        styles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' }
                    }]);
                }
                
                currentBody.push(row.slice(3));
            });
            if (currentBody.length > 0) {
                tablesGrouped.push({ muni: currentGroupName, rows: currentBody });
            }

            // Helper para cargar imágenes Base64
            const loadImgBase64 = (url) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = url;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve({ data: canvas.toDataURL('image/png'), ratio: img.width / img.height });
                    };
                    img.onerror = () => resolve(null);
                });
            };
            
            const [logoData, watermarkData] = await Promise.all([
                loadImgBase64('https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/Seseq_vertical_2025.png'),
                loadImgBase64('https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/logo_nuevo.png')
            ]);

            // 4. Inicializar jsPDF en formato Carta Horizontal
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
            
            // ==========================================
            // PATRÓN: MOSAICO LIMPIO (BACKGROUND)
            // ==========================================
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, 279.4, 215.9, 'F');
            
            if (watermarkData) {
                doc.setGState(new doc.GState({opacity: 0.02}));
                const tileSize = 35;
                const tileH = tileSize / watermarkData.ratio;
                for(let x = -10; x < 290; x += tileSize) {
                    for(let y = -10; y < 230; y += tileH) {
                        doc.addImage(watermarkData.data, 'PNG', x, y, tileSize, tileH, undefined, 'FAST');
                    }
                }
                doc.setGState(new doc.GState({opacity: 1.0}));
            }
            
            // 5. Encabezado
            const marginX = 15;
            let currentY = 0;

            doc.setFillColor(15, 23, 42); // Slate 900
            doc.rect(0, 0, 279.4, 6, 'F');
            doc.setFillColor(13, 148, 136); // Teal 600
            doc.rect(0, 6, 279.4, 1.5, 'F');
            
            currentY = 18;
            let textStartX = marginX;
            if (logoData) {
                const logoH = 26;
                const logoW = logoH * logoData.ratio;
                doc.addImage(logoData.data, 'PNG', marginX, currentY, logoW, logoH, undefined, 'FAST');
                textStartX = marginX + logoW + 8;
            }
            
            const muniFilterVal = document.getElementById('rdaFilterMunicipio')?.value || '';
            const muniScopeStr = muniFilterVal ? `MUNICIPIO: ${muniFilterVal.toUpperCase()}` : (muni && muni !== 'JURISDICCIÓN SANITARIA 1' ? `MUNICIPIO: ${muni.toUpperCase()}` : 'JURISDICCIÓN SANITARIA 1');
            
            let headerTitle = isSingleUnit ? tableRowsRaw[0][1] : "Indicadores Analíticos RDA";
            let headerSubtitle = isSingleUnit 
                ? `UNIDAD: ${tableRowsRaw[0][0]}  |  MUNICIPIO: ${(tableRowsRaw[0][2]||'').toUpperCase()}  |  ${esquemaTexto.toUpperCase()}` 
                : `${esquemaTexto.toUpperCase()}  |  ${muniScopeStr}`;

            if (isSingleUnit) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(13, 148, 136); // Teal 600
                doc.text("INDICADORES ANALÍTICOS RDA", textStartX, currentY + 2);
                
                doc.setFont('helvetica', 'bold');
                let titleSize = headerTitle.length > 35 ? 16 : 24;
                doc.setFontSize(titleSize);
                doc.setTextColor(15, 23, 42);
                doc.text(headerTitle.substring(0, 65), textStartX, currentY + 11);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(headerSubtitle, textStartX, currentY + 18);
            } else {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(26);
                doc.setTextColor(15, 23, 42);
                doc.text(headerTitle, textStartX, currentY + 8);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(headerSubtitle, textStartX, currentY + 15);
            }

            // Avance del Cierre (Derecha)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(210, currentY, 54, 20, 4, 4, 'FD');
            doc.setFillColor(13, 148, 136); // Badge accent
            doc.roundedRect(210, currentY, 54, 6, 4, 4, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("AVANCE AL CIERRE", 237, currentY + 4, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.text(`${maxMesLabel.toUpperCase()}`, 237, currentY + 15, { align: 'center' });
            
            currentY = 48;

            // ==========================================
            // CÁLCULO DE KPIS GERENCIALES
            // ==========================================
            let totalDosis = 0;
            let totalMeta = 0;
            let numPorcentajes = 0;
            let sumaPorcentajes = 0;
            
            Array.from(tablaOriginal.querySelectorAll('tbody tr')).forEach(tr => {
                const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
                tds.forEach(cText => {
                    if (cText.includes('%')) {
                        const val = parseFloat(cText.replace('%', ''));
                        if (!isNaN(val)) { sumaPorcentajes += val; numPorcentajes++; }
                    }
                });
                
                const dText = String(tds[tds.length - 1]).replace(/,/g, '');
                const dVal = parseInt(dText, 10);
                if (!isNaN(dVal)) totalDosis += dVal;
                
                if (_rdaState.esquema === 'basico' && tds.length > 5) {
                    const mText = String(tds[tds.length - 2]).replace(/,/g, '');
                    const mVal = parseInt(mText, 10);
                    if (!isNaN(mVal)) totalMeta += mVal;
                }
            });
            
            const kpiPromedio = numPorcentajes > 0 ? (sumaPorcentajes / numPorcentajes).toFixed(1) + '%' : 'N/A';
            const kpiDosis = totalDosis.toLocaleString('es-MX');
            
            let kpiPob = '';
            let kpiPobLabel = '';
            if (_rdaState.esquema === 'basico') {
                kpiPobLabel = 'POBLACIÓN META';
                kpiPob = totalMeta.toLocaleString('es-MX');
            } else {
                kpiPobLabel = tableRowsRaw.length === 1 ? 'REPORTES ENCONTRADOS' : 'UNIDADES ANALIZADAS';
                kpiPob = tableRowsRaw.length.toString();
            }

            const kpiWidth = 80;
            const kpiGap = (279.4 - (marginX * 2) - (kpiWidth * 3)) / 2;
            
            const drawModernKpiCard = (x, y, w, h, label, value, mainColor, accentColor) => {
                // Solid Background with Modern Look
                doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
                doc.roundedRect(x, y, w, h, 3, 3, 'F');
                
                // Barra sutil inferior en lugar de círculo
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.roundedRect(x, y + h - 2, w, 2, 0, 0, 'F');
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(255, 255, 255); 
                doc.text(label, x + 8, y + 8);
                
                doc.setFontSize(18);
                doc.setTextColor(255, 255, 255); 
                doc.text(value, x + 8, y + 17);
            };
            
            // Colores vibrantes y originales
            drawModernKpiCard(marginX, currentY, kpiWidth, 22, kpiPobLabel, kpiPob, [15, 23, 42], [30, 41, 59]); // Dark Slate
            drawModernKpiCard(marginX + kpiWidth + kpiGap, currentY, kpiWidth, 22, "TOTAL DOSIS APLICADAS", kpiDosis, [13, 148, 136], [17, 94, 89]); // Emerald/Teal
            drawModernKpiCard(marginX + (kpiWidth * 2) + (kpiGap * 2), currentY, kpiWidth, 22, "COBERTURA GLOBAL PROM.", kpiPromedio, [99, 102, 241], [79, 70, 229]); // Indigo

            currentY += 28;

            // ==========================================
            // SECCIÓN DE GRÁFICAS
            // ==========================================
            const chartSectionHeight = isSingleUnit ? 78 : 110;
            const cardWidth = 117.2;
            const gap = 15;

            // Tarjeta A (Gráfica 1)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(marginX, currentY, cardWidth, chartSectionHeight, 4, 4, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(titleChart1, marginX + 6, currentY + 7);
            if (imgChart1Base64) {
                doc.addImage(imgChart1Base64, 'PNG', marginX + 6, currentY + 10, cardWidth - 12, chartSectionHeight - 14, undefined, 'FAST');
            }

            // Tarjeta B (Gráfica 2)
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(marginX + cardWidth + gap, currentY, cardWidth, chartSectionHeight, 4, 4, 'FD');
            doc.text(titleChart2, marginX + cardWidth + gap + 6, currentY + 7);
            if (imgTopBase64) {
                doc.addImage(imgTopBase64, 'PNG', marginX + cardWidth + gap + 6, currentY + 10, cardWidth - 12, chartSectionHeight - 14, undefined, 'FAST');
            }

            currentY += chartSectionHeight + 6;

            if (!isSingleUnit) {
                doc.addPage();
                currentY = 20;
            }

            // ==========================================
            // TABLA VECTORIAL PREMIUM (Badges Nativos)
            // ==========================================
            tablesGrouped.forEach((grp, idx) => {
                if (!isSingleUnit && grp.muni) {
                    if (currentY > 180) {
                        doc.addPage();
                        currentY = 20;
                    }
                    doc.setFillColor(241, 245, 249);
                    doc.rect(marginX, currentY, 249.4, 8, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(51, 65, 85);
                    doc.text(`MUNICIPIO: ${grp.muni.toUpperCase()}`, marginX + 124.7, currentY + 5.5, { align: 'center' });
                    currentY += 8;
                }

                doc.autoTable({
                    head: [tableHeaders],
                    body: grp.rows,
                startY: currentY,
                margin: { left: marginX, right: marginX },
                theme: 'plain', 
                styles: {
                    fontSize: 8,
                    font: 'helvetica',
                    cellPadding: isSingleUnit ? 3.2 : 5,
                    valign: 'middle',
                    lineColor: [241, 245, 249], 
                    lineWidth: { bottom: 0.5 },
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [248, 250, 252],
                    textColor: [100, 116, 139],
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: { bottom: 1, top: 1 }
                },
                bodyStyles: { fillColor: [255, 255, 255] },
                willDrawCell: function(data) {
                    if (data.section === 'body') {
                        // Respetar fila de encabezado que agrupa la unidad
                        if (data.row.raw.length === 1 && data.row.raw[0].colSpan) return;

                        doc.setFillColor(255, 255, 255);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        
                        // Todas las columnas restantes son numéricas
                        const isBadgeCol = !(data.column.index === data.table.columns.length - 1 || (_rdaState.esquema === 'basico' && data.column.index === data.table.columns.length - 2));
                        if (isBadgeCol && data.cell.text[0] && data.cell.text[0].includes('%')) {
                            data.cell.customText = data.cell.text[0]; // Salvamos el texto
                            data.cell.text = []; // BORRAMOS el texto nativo
                        }
                    }
                },
                didDrawCell: function(data) {
                    if (data.section === 'body') {
                        if (data.row.raw.length === 1 && data.row.raw[0].colSpan) return;
                        
                        const text = data.cell.customText;
                        if (!text) return; // Si no hay customText, es una columna normal (Meta/Total)

                        let bg = [241, 245, 249]; 
                        let fg = [71, 85, 105];
                        const val = parseFloat(text.replace('%', ''));
                        if (!isNaN(val)) {
                            if (val >= 80) { bg = [220, 252, 231]; fg = [22, 101, 52]; }
                            else if (val >= 50) { bg = [254, 243, 199]; fg = [146, 64, 14]; }
                            else { bg = [254, 226, 226]; fg = [153, 27, 27]; }
                        }
                        
                        const textWidth = doc.getTextWidth(text);
                        const badgeWidth = textWidth + 6;
                        const badgeHeight = 5;
                        const cx = data.cell.x + (data.cell.width / 2);
                        const cy = data.cell.y + (data.cell.height / 2);
                        
                        doc.setFillColor(bg[0], bg[1], bg[2]);
                        doc.roundedRect(cx - badgeWidth/2, cy - badgeHeight/2, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
                        
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(fg[0], fg[1], fg[2]);
                        doc.text(text, cx, cy, { align: 'center', baseline: 'middle' });
                    }
                },
                didDrawPage: function(data) {
                    if (((!isSingleUnit && data.pageNumber >= 1) || (isSingleUnit && data.pageNumber > 1)) && watermarkData) {
                        doc.setGState(new doc.GState({opacity: 0.02}));
                        const tileSize = 35;
                        const tileH = tileSize / watermarkData.ratio;
                        for(let x = -10; x < 290; x += tileSize) {
                            for(let y = -10; y < 230; y += tileH) {
                                doc.addImage(watermarkData.data, 'PNG', x, y, tileSize, tileH, undefined, 'FAST');
                            }
                        }
                        doc.setGState(new doc.GState({opacity: 1.0}));
                    }
                }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        });

            // Loop through all pages to add the dynamic page number and footer stamp (Two-Pass Pattern)
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                
                const stamp = `REPORTE GENERADO EL ${new Date().toLocaleString('es-MX')} — INTELIGENCIA OPERATIVA JS1`;
                doc.text(stamp, marginX, 208);
                
                const pag = `Página ${i} de ${totalPages}`;
                doc.text(pag, 264.4, 208, { align: 'right' });
            }

            if (devolverBlob) {
                resolve(doc.output('blob'));
            } else {
                doc.save(nombreArchivo);
                resolve(true);
            }

        } catch (error) {
            console.error("[RDA PDF Error]", error);
            reject(error);
        }
    });
}
const _getComparativeFilename = (ext, muniVal, uniVal) => {
    const m = muniVal || document.getElementById('rdaFilterMunicipio')?.value || '';
    const u = uniVal || document.getElementById('rdaFilterUnidad')?.value || '';
    if (u) {
        const uObj = (_rdaCache.unidades || []).find(x => x.clues === u);
        const uName = _safeName(uObj?.nombre || 'UNIDAD');
        return `${uName}_${u}_COMPARATIVA_25-26_RDA.${ext}`;
    } else if (m) {
        return `${_safeName(m)}_COMPARATIVA_25-26_RDA.${ext}`;
    } else {
        return `JS1_QUERETARO_COMPARATIVA_25-26_RDA.${ext}`;
    }
};

async function exportIndividualPDF() {
    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uni = document.getElementById('rdaFilterUnidad')?.value || '';
    let fname = `Indicadores_RDA2026_${_tLabel()}_${_dateStr()}.pdf`;

    if (_rdaState.esquema === 'comparativa_multianual') {
        fname = _getComparativeFilename('pdf', muni, uni);
    } else if (uni) {
        const u = (_rdaCache.unidades||[]).find(x=>x.clues===uni);
        fname = `RDA_${uni}_${_safeName(u?.nombre)}_${_tLabel()}.pdf`;
    } else if (muni) {
        fname = `RDA_${_safeName(muni)}_${_tLabel()}.pdf`;
    }

    if (typeof updateOverlayProgress === 'function') {
        updateOverlayProgress(15, 100, 'Inicializando documento PDF vectorial...', 'Procesando Documento', 'EXPORTACIÓN PDF');
    } else if (typeof showProgressOverlay === 'function') {
        showProgressOverlay('Generando reporte PDF vectorial...', 'Procesando Documento', 'EXPORTACIÓN PDF');
    }

    try {
        await generarPDFRobusto('rdaDashboardContent', fname, false);
        if (typeof updateOverlayProgress === 'function') {
            updateOverlayProgress(100, 100, 'Reporte PDF generado exitosamente', 'Procesando Documento', 'EXPORTACIÓN PDF');
        }
        if (typeof showToast === 'function') showToast('Reporte generado exitosamente', true, 'good');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Error al generar PDF', false, 'bad');
    } finally {
        setTimeout(() => {
            if (typeof hideOverlay === 'function') hideOverlay();
        }, 400);
    }
}

// Preparación del clon (rdaDashboardContent) antes de capturarlo con html2canvas: inyecta el
// membrete institucional, apaga animaciones/brillos, corrige overflow/sticky y centra chips.
const _applyExportFixesToRoot = (clonedContent) => {
    const clonedDoc = clonedContent.ownerDocument;
    if (clonedContent) {
        clonedContent.style.overflow = 'visible';
        clonedContent.style.maxHeight = 'none';
        clonedContent.style.height = 'auto';
        clonedContent.style.width = '1280px';
        clonedContent.style.boxSizing = 'border-box';
        clonedContent.style.padding = '32px';
        clonedContent.style.background = '#ffffff';

        // Desactivar animaciones, pseudo-elementos de brillo, y centrar chips via CSS puro en el clon
        const exportFixStyle = clonedDoc.createElement('style');
        exportFixStyle.textContent = `
            /* === Eliminar brillos / glare en tarjetas === */
            .rda-kpi-card::after, .rda-kpi-card::before,
            .rda-kpi-card:hover::after, .rda-kpi-card:hover::before,
            [class*="kpi"]::after, [class*="kpi"]::before,
            [class*="card"]::after, [class*="card"]::before,
            .podium-gold-chip::before, .podium-diamond-chip::before,
            .podium-silver-chip::after, .podium-steel-chip::before {
                display: none !important;
                content: none !important;
                background: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                animation: none !important;
            }
            /* === Detener todas las animaciones === */
            * {
                animation: none !important;
                transition: none !important;
            }
            /* === Centrado vertical perfecto para CHIPS y BADGES === */
            #rdaExportHeader [style*="border-radius"],
            #rdaScopeLabel, #rdaCierreLabel,
            [id*="Label"], [id*="Chip"], [id*="Badge"], [id*="badge"],
            [class*="chip"], [class*="badge"], [class*="pill"],
            .meta-alcanzada, [class*="meta-"], [class*="estatus"],
            td span[style*="border-radius"], td div[style*="border-radius"] {
                line-height: 1 !important;
            }
        `;
        clonedDoc.head.appendChild(exportFixStyle);

        // Prepend Membrete Institucional Oficial de Exportación si no existe
        if (!clonedContent.querySelector('#rdaExportHeader')) {
            const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
            const uni = document.getElementById('rdaFilterUnidad')?.value || '';
            const esquema = _rdaState?.esquema || 'basico';

            const esquemaLabelMap = {
                basico: 'Esquema Básico (0-8 años)',
                adultos: 'Adolescentes y Adultos',
                mayores: 'Adultos Mayores',
                embarazadas: 'Embarazadas',
                invernal: 'Temporada Invernal',
                comparativa_multianual: 'Comparativa Multianual (2025 vs 2026)',
                meta_logro_influenza: 'Cobertura e Indicadores de Influenza y COVID-19'
            };
            const esquemaLabel = esquemaLabelMap[esquema] || 'Indicadores de Salud';
            const maxMesName = MONTH_NAMES[(_rdaCache.maxMes || 12) - 1] || 'Final';
            const fechaStr = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

            let scopeText = 'JURISDICCIÓN SANITARIA NO. 1 (4 MUNICIPIOS)';
            if (uni) {
                const uObj = (_rdaCache.unidades || []).find(x => x.clues === uni);
                const mName = muni ? muni.toUpperCase() : (uObj?.municipio || '').toUpperCase();
                const uName = uObj?.nombre ? uObj.nombre.toUpperCase() : uni;
                scopeText = `${mName} — ${uName} (${uni})`;
            } else if (muni) {
                scopeText = `MUNICIPIO: ${muni.toUpperCase()}`;
            }

            const headerDiv = clonedDoc.createElement('div');
            headerDiv.id = 'rdaExportHeader';
            headerDiv.style.cssText = `
                width: 100%;
                margin-bottom: 28px;
                padding: 22px 28px;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                border-radius: 16px;
                color: #ffffff;
                font-family: Inter, system-ui, -apple-system, sans-serif;
                box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.2);
                box-sizing: border-box;
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                gap: 24px;
            `;
            headerDiv.innerHTML = `
                <div style="border-left: 4px solid #38bdf8; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; line-height: 1.2;">
                        SECRETARÍA DE SALUD DEL ESTADO DE QUERÉTARO — JURISDICCIÓN SANITARIA NO. 1
                    </div>
                    <div style="font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: #ffffff; line-height: 1.2;">
                        EVALUACIÓN DE INDICADORES DE COBERTURA VACUNAL 2026
                    </div>
                    <div style="font-size: 11.5px; color: #94a3b8; font-weight: 600; margin-top: 2px;">
                        FECHA Y HORA DE EMISIÓN: <span style="color: #f1f5f9; font-weight: 700;">${fechaStr}</span>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, minmax(130px, auto)); gap: 10px 24px; background: rgba(30, 41, 59, 0.7); padding: 14px 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12); box-sizing: border-box;">
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Ámbito / Filtro</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #ffffff; margin-top: 2px;">${scopeText}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Esquema Evaluado</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${esquemaLabel.toUpperCase()}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Cierre Información</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #ffffff; margin-top: 2px;">CIERRE ${maxMesName.toUpperCase()}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Estado Reporte</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #34d399; margin-top: 2px;">CONSOLIDADO JS1</div>
                    </div>
                </div>
            `;
            clonedContent.insertBefore(headerDiv, clonedContent.firstChild);
        }

        // === PASO 1: Eliminar scroll y max-height en contenedores de tabla/panel (NO en gráficas) ===
        // SOLO se toca overflow/max-height en elementos con overflow:hidden/auto/scroll Y sin canvas/svg internos
        // NUNCA se aplica height:auto — eso destruye los contenedores de Chart.js
        const allElements = clonedContent.querySelectorAll('*');
        allElements.forEach(el => {
            const tag = el.tagName;
            if (tag === 'CANVAS' || tag === 'SVG' || tag === 'IMG' || tag === 'SCRIPT' || tag === 'STYLE') return;

            // Proteger elementos que contienen canvas/svg (contenedores de gráficas)
            if (el.querySelector('canvas, svg')) return;

            const inlineSt = el.getAttribute('style') || '';
            // Solo quitar overflow en elementos que claramente lo tengan como scroll/hidden en inline style
            if (inlineSt.includes('overflow') && !inlineSt.includes('overflow: visible')) {
                el.style.setProperty('overflow', 'visible', 'important');
                el.style.setProperty('overflow-x', 'visible', 'important');
                el.style.setProperty('overflow-y', 'visible', 'important');
            }
            if (inlineSt.includes('max-height')) {
                el.style.setProperty('max-height', 'none', 'important');
            }

            // Desactivar sticky en el clon
            if (inlineSt.includes('sticky') || el.style.position === 'sticky') {
                el.style.setProperty('position', 'relative', 'important');
                el.style.setProperty('top', 'auto', 'important');
                el.style.setProperty('left', 'auto', 'important');
            }

            // Resetear scroll interno
            el.scrollTop = 0;
            el.scrollLeft = 0;
        });

        // === PASO 2: Sticky via getComputedStyle en el iframe ===
        const defaultView = clonedDoc.defaultView || window;
        clonedContent.querySelectorAll('*').forEach(el => {
            try {
                const cs = defaultView.getComputedStyle(el);
                if (cs.position === 'sticky') {
                    el.style.setProperty('position', 'relative', 'important');
                    el.style.setProperty('top', 'auto', 'important');
                }
                // También quitar overflow oculto en contenedores sin gráficas detectados via computedStyle
                if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden') && !el.querySelector('canvas, svg')) {
                    el.style.setProperty('overflow', 'visible', 'important');
                }
            } catch(e) {}
        });

        // === PASO 3: Centrado de texto en chips/badges ===
        const chipSelectors = [
            '#rdaScopeLabel', '#rdaCierreLabel', '#rdaTableCount',
            '[id*="Label"]', '[id*="Chip"]', '[id*="Badge"]', '[id*="badge"]',
            '[class*="chip"]', '[class*="badge"]', '[class*="pill"]',
            '.meta-alcanzada', '[class*="meta-"]'
        ];

        const centerChipText = (clonedEl) => {
            // html2canvas NO calcula bien el centrado vertical de texto dentro de contenedores
            // flex (aunque se fuerce align-items:center con !important) — es una limitación de
            // su motor de texto, no algo que se arregle con más CSS de flexbox (por eso el fix
            // anterior, que hacía exactamente eso, nunca funcionó). La técnica que sí es
            // compatible con su motor es la clásica de centrado por línea base: line-height
            // igual a la altura del contenedor, sin flexbox. Se mide la altura real ANTES de
            // tocar el layout para no perder el tamaño/diseño original del chip.
            const measuredHeight = clonedEl.offsetHeight
                || parseInt(getComputedStyle(clonedEl).height, 10)
                || 0;

            clonedEl.style.setProperty('display', 'inline-block', 'important');
            clonedEl.style.setProperty('text-align', 'center', 'important');
            clonedEl.style.setProperty('white-space', 'nowrap', 'important');
            clonedEl.style.setProperty('box-sizing', 'border-box', 'important');
            clonedEl.style.setProperty('vertical-align', 'middle', 'important');

            if (measuredHeight > 0) {
                clonedEl.style.setProperty('height', `${measuredHeight}px`, 'important');
                clonedEl.style.setProperty('line-height', `${measuredHeight}px`, 'important');
                clonedEl.style.setProperty('padding-top', '0', 'important');
                clonedEl.style.setProperty('padding-bottom', '0', 'important');
            }

            // Si el chip trae un ícono u otro elemento en línea junto al texto (ej. "✓ Meta
            // Alcanzada"), cada hijo debe centrarse por línea base también, o solo el texto
            // suelto quedaría centrado y el ícono no.
            Array.from(clonedEl.children).forEach(child => {
                child.style.setProperty('display', 'inline', 'important');
                child.style.setProperty('vertical-align', 'middle', 'important');
            });
        };

        // Chips con ID conocido
        chipSelectors.forEach(sel => {
            clonedContent.querySelectorAll(sel).forEach(clonedEl => {
                centerChipText(clonedEl);
            });
        });

        // Chips de porcentaje/cobertura en celdas de tabla (span con border-radius inline)
        clonedContent.querySelectorAll('td span[style*="border-radius"], td div[style*="border-radius"]').forEach(clonedEl => {
            centerChipText(clonedEl);
        });

        // Chips del #rdaExportHeader
        clonedContent.querySelectorAll('#rdaExportHeader span[style], #rdaExportHeader div[style]').forEach(clonedEl => {
            const inSt = clonedEl.getAttribute('style') || '';
            if (inSt.includes('border-radius') || inSt.includes('padding')) {
                centerChipText(clonedEl);
            }
        });
    }
};

// Conversión manual de <canvas> (gráficas Chart.js/ECharts) a <img> — html2canvas no sabe leer
// el contenido de un canvas por sí solo, así que hay que hacerlo explícito antes de capturar.
const _convertCanvasesToImages = (contentEl, clonedDoc) => {
    const origCanvases = contentEl.querySelectorAll('canvas');
    const clonedCanvases = clonedDoc.querySelectorAll('canvas');
    origCanvases.forEach((origCanvas, idx) => {
        if (clonedCanvases[idx]) {
            try {
                const img = clonedDoc.createElement('img');
                img.src = origCanvas.toDataURL('image/png');
                img.style.cssText = origCanvas.style.cssText;
                img.className = origCanvas.className;
                const w = origCanvas.offsetWidth || origCanvas.width;
                const h = origCanvas.offsetHeight || origCanvas.height;
                if (w) img.style.width = w + 'px';
                if (h) img.style.height = h + 'px';
                img.style.maxWidth = '100%';
                if (clonedCanvases[idx].parentNode) {
                    clonedCanvases[idx].parentNode.replaceChild(img, clonedCanvases[idx]);
                }
            } catch (e) {
                console.warn('[RDA HD PNG Export] Error copiando canvas:', e);
            }
        }
    });
};

// Wrapper para el camino de html2canvas (respaldo): recibe el documento clonado completo,
// tal como lo entrega su onclone, y conserva exactamente el comportamiento original.
const _prepareClonedDocForHDImage = (clonedDoc, contentEl) => {
    const clonedContent = clonedDoc.getElementById('rdaDashboardContent');
    if (clonedContent) {
        _applyExportFixesToRoot(clonedContent);
    }
    _convertCanvasesToImages(contentEl, clonedDoc);
};

// NOTA: se intentó usar "modern-screenshot" (renderizado vía SVG <foreignObject>) como motor
// principal para evitar un bug de centrado de texto en chips propio de html2canvas. Se revirtió:
// los íconos "Material Symbols" de esta app funcionan por ligadura de fuente (el texto literal
// "school", "groups", etc. se sustituye visualmente por el glifo del ícono), y esa sustitución no
// se aplica de forma confiable dentro de un <foreignObject> renderizado como imagen aislada — el
// resultado mostraba el texto crudo en vez de los íconos, y el encabezado con el layout roto. No
// lanzaba ningún error de JS (por eso el intento de respaldo automático nunca se activaba), así
// que se optó por quedarse con html2canvas, que sí renderiza estos íconos correctamente.
async function _captureRdaContentAsCanvas(content, scale) {
    if (window.ensureLibsLoaded) await window.ensureLibsLoaded('html2canvas');
    return await html2canvas(content, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
            _prepareClonedDocForHDImage(clonedDoc, content);
        }
    });
}

async function exportDashboardImagen(format = 'png') {
    const content = document.getElementById('rdaDashboardContent');
    if (!content) return;
    if (typeof html2canvas === 'undefined') {
        if (typeof showToast === 'function') showToast('Librería de captura no disponible', false, 'bad');
        return;
    }

    if (typeof updateOverlayProgress === 'function') {
        updateOverlayProgress(10, 100, 'Inicializando captura HD...', 'Captura HD', 'EXPORTACIÓN IMAGEN');
    } else if (typeof showProgressOverlay === 'function') {
        showProgressOverlay('Generando imagen de alta calidad...', 'Captura HD', 'EXPORTACIÓN IMAGEN');
    }

    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uni = document.getElementById('rdaFilterUnidad')?.value || '';
    const ext = format.toLowerCase() === 'jpeg' ? 'jpg' : 'png';
    let fname = `Indicadores_RDA2026_${_tLabel()}_${_dateStr()}.${ext}`;

    if (_rdaState.esquema === 'comparativa_multianual') {
        fname = _getComparativeFilename(ext, muni, uni);
    } else if (uni) {
        const u = (_rdaCache.unidades||[]).find(x=>x.clues===uni);
        fname = `RDA_${uni}_${_safeName(u?.nombre)}_${_tLabel()}.${ext}`;
    } else if (muni) {
        fname = `RDA_${_safeName(muni)}_${_tLabel()}.${ext}`;
    }

    try {
        if (typeof updateOverlayProgress === 'function') {
            updateOverlayProgress(35, 100, 'Renderizando elementos y gráficos en alta resolución (2.5x HD)...', 'Captura HD', 'EXPORTACIÓN IMAGEN');
        }

        // Captura completa en 1 sola pieza continua con resolución 2.5x HD (Retina Quality)
        const canvas = await _captureRdaContentAsCanvas(content, 2.5);

        if (typeof updateOverlayProgress === 'function') {
            updateOverlayProgress(90, 100, 'Generando archivo final de imagen...', 'Captura HD', 'EXPORTACIÓN IMAGEN');
        }

        const mimeType = format.toLowerCase() === 'jpeg' ? 'image/jpeg' : 'image/png';
        const imgData = canvas.toDataURL(mimeType, 0.95);

        const link = document.createElement('a');
        link.download = fname;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof updateOverlayProgress === 'function') {
            updateOverlayProgress(100, 100, 'Imagen exportada en Alta Calidad', 'Captura HD', 'EXPORTACIÓN IMAGEN');
        }

        if (typeof showToast === 'function') {
            const labelCalidad = format.toLowerCase() === 'jpeg' ? 'JPEG (Buena Calidad)' : 'PNG (Alta Calidad)';
            showToast(`Imagen ${labelCalidad} exportada exitosamente`, true, 'good');
        }
    } catch (e) {
        console.error('[RDA Export Image Error]', e);
        if (typeof showToast === 'function') showToast('Error al exportar imagen', false, 'bad');
    } finally {
        setTimeout(() => {
            if (typeof hideOverlay === 'function') hideOverlay();
        }, 450);
    }
}

async function exportMasivoZIP(mode = 'pdf') {
    if (typeof JSZip === 'undefined') { 
        if (typeof showToast === 'function') showToast('JSZip no disponible', false, 'bad'); 
        return; 
    }

    const { unidades } = _rdaCache;
    if (!unidades) return;

    const muniSelect = document.getElementById('rdaFilterMunicipio');
    const uniSelect = document.getElementById('rdaFilterUnidad');
    if (!muniSelect || !uniSelect) return;

    const originalMuni = muniSelect.value || '';
    const originalUni = uniSelect.value || '';

    let targets = unidades;
    if (originalMuni) {
        targets = targets.filter(u => (u.municipio||'').toUpperCase().trim() === originalMuni.toUpperCase().trim());
    }

    const isImg = mode === 'png' || mode === 'jpeg' || mode === 'jpg';
    const isJpeg = mode === 'jpeg' || mode === 'jpg';

    if (targets.length > 50) {
        const tipoStr = isJpeg ? 'imágenes JPEG de alta calidad' : (mode === 'png' ? 'imágenes PNG de alta resolución' : 'reportes vectoriales PDF');
        if (!confirm(`Vas a generar ${targets.length} ${tipoStr}. El proceso se ejecutará de forma masiva. ¿Continuar?`)) return;
    }

    window._isBatchExporting = true;
    try {
    const labelProceso = isJpeg ? 'ZIP Imágenes JPEG' : (mode === 'png' ? 'ZIP Imágenes PNG HD' : 'ZIP PDFs');
    
    const setOverlayProgress = (current, total, name, modeStr) => {
        const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        let overlayElem = document.getElementById('rdaExportOverlay');
        
        if (!overlayElem) {
            overlayElem = document.createElement('div');
            overlayElem.id = 'rdaExportOverlay';
            overlayElem.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(15, 23, 42, 0.82);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
                animation: fadeInOverlay 0.25s ease-out forwards;
            `;
            
            overlayElem.innerHTML = `
                <div style="background: #ffffff; width: 92%; max-width: 480px; border-radius: 28px; padding: 36px 32px 30px 32px; box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.15); text-align: center; position: relative; overflow: hidden; animation: fadeInOverlay 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
                    <!-- CIRCULAR GAUGE RING WITH PULSING LOGO (OPCIÓN 2) -->
                    <div style="position: relative; width: 108px; height: 108px; margin: 0 auto 18px auto; display: flex; align-items: center; justify-content: center;">
                        <svg style="transform: rotate(-90deg); width: 108px; height: 108px;" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" stroke-width="7"></circle>
                            <circle id="rdaOverlayRing" cx="50" cy="50" r="45" fill="none" stroke="#0284c7" stroke-width="7" stroke-dasharray="283" stroke-dashoffset="283" stroke-linecap="round" style="transition: stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1);"></circle>
                        </svg>
                        <img src="https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/logo_nuevo.png" alt="Exportando SIREVAQ..." class="bounce-logo" style="position: absolute; width: 52px; height: auto;">
                    </div>

                    <!-- BADGE (OPCIÓN 1) -->
                    <div style="display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-size: 11px; font-weight: 900; padding: 4px 14px; border-radius: 9999px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(2,132,199,0.08);" id="rdaOverlayBadge">
                        EXPORTACIÓN MASIVA
                    </div>

                    <!-- TITLE & PERCENTAGE -->
                    <h3 id="rdaOverlayTitle" style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
                        Generando Exportación (0%)
                    </h3>

                    <!-- SUBTITLE CURRENT UNIT NAME -->
                    <p id="rdaOverlayMsg" style="margin: 0 0 20px 0; font-size: 13px; font-weight: 700; color: #475569; min-height: 38px; display: flex; align-items: center; justify-content: center; line-height: 1.45;">
                        Iniciando proceso...
                    </p>

                    <!-- PROGRESS BAR CONTAINER (OPCIÓN 1) -->
                    <div style="background: #f1f5f9; border-radius: 9999px; height: 13px; width: 100%; overflow: hidden; border: 1px solid #e2e8f0; position: relative; margin-bottom: 12px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);">
                        <div id="rdaOverlayBar" style="background: linear-gradient(90deg, #0084d4 0%, #0284c7 50%, #38bdf8 100%); height: 100%; width: 0%; border-radius: 9999px; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(2,132,199,0.4);"></div>
                    </div>

                    <!-- STEP COUNTER -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 800; color: #64748b;">
                        <span id="rdaOverlayCount">0 de 0 Unidades</span>
                        <span id="rdaOverlayPct" style="color: #0284c7; font-weight: 900;">0% COMPLETADO</span>
                    </div>
                </div>
            `;
            
            if (!document.getElementById('rdaExportOverlayStyles')) {
                const style = document.createElement('style');
                style.id = 'rdaExportOverlayStyles';
                style.textContent = `
                    @keyframes p9-bounce { 0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 8px rgba(0,132,212,0.2)); } 50% { transform: scale(1.05); filter: drop-shadow(0 8px 16px rgba(0,132,212,0.35)); } }
                    .bounce-logo { animation: p9-bounce 2s infinite ease-in-out; }
                    @keyframes fadeInOverlay { 0% { opacity: 0; transform: scale(0.96) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                `;
                document.head.appendChild(style);
            }
            document.body.appendChild(overlayElem);
        }

        const oBadge = document.getElementById('rdaOverlayBadge');
        const oTitle = document.getElementById('rdaOverlayTitle');
        const oMsg = document.getElementById('rdaOverlayMsg');
        const oBar = document.getElementById('rdaOverlayBar');
        const oCount = document.getElementById('rdaOverlayCount');
        const oPct = document.getElementById('rdaOverlayPct');
        const oRing = document.getElementById('rdaOverlayRing');

        if (oBadge && modeStr) oBadge.textContent = modeStr.toUpperCase();
        if (oTitle) oTitle.textContent = `Exportando (${pct}%)`;
        if (oMsg) oMsg.textContent = name || 'Preparando archivos...';
        if (oBar) oBar.style.width = `${pct}%`;
        if (oCount) oCount.textContent = `${current} de ${total} Unidades`;
        if (oPct) oPct.textContent = `${pct}% COMPLETADO`;
        if (oRing) {
            const strokeDashoffset = 283 - (283 * pct / 100);
            oRing.style.strokeDashoffset = strokeDashoffset;
        }
    };

    const removeOverlayProgress = () => {
        const o = document.getElementById('rdaExportOverlay');
        if (o) o.remove();
    };

    setOverlayProgress(0, targets.length, 'Iniciando proceso masivo...', labelProceso);

    // Desactivar temporalmente animaciones para mayor velocidad y sincronía
    let originalChartAnim = null;
    if (typeof Chart !== 'undefined' && Chart.defaults && Chart.defaults.animation) {
        originalChartAnim = Chart.defaults.animation;
        Chart.defaults.animation = false;
    }

    try {
        const zip = new JSZip();
        const content = document.getElementById('rdaDashboardContent');

        for (let i = 0; i < targets.length; i++) {
            const u = targets[i];
            const statusMsg = isJpeg ? 'Capturando Imagen JPEG' : (mode === 'png' ? 'Capturando Imagen PNG HD' : 'Generando Reporte PDF');
            setOverlayProgress(i + 1, targets.length, `[${u.clues}] ${u.nombre||u.clues}`, statusMsg);

            muniSelect.value = u.municipio ? u.municipio.toUpperCase() : '';
            if (typeof populateUnidadFilter === 'function') populateUnidadFilter();
            uniSelect.value = u.clues;
            
            if (typeof renderDashboard === 'function') {
                await renderDashboard();
            }

            // Para evitar que el navegador congele o ralentice el proceso en pestañas en segundo plano (background throttling)
            if (document.hidden) {
                await new Promise(r => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = r;
                    channel.port2.postMessage(null);
                });
            } else {
                await new Promise(resolve => setTimeout(resolve, isImg ? 350 : 50));
            }

            if (isImg) {
                const ext = isJpeg ? 'jpg' : 'png';
                const fname = _rdaState.esquema === 'comparativa_multianual' 
                    ? `${_safeName(u.nombre)}_${u.clues}_COMPARATIVA_25-26_RDA.${ext}`
                    : `RDA_${u.clues}_${_safeName(u.nombre)}.${ext}`;
                if (content) {
                    const canvas = await _captureRdaContentAsCanvas(content, 2.5);
                    const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
                    const dataUrl = isJpeg ? canvas.toDataURL(mimeType, 0.92) : canvas.toDataURL(mimeType);
                    const base64Data = dataUrl.replace(new RegExp(`^data:${mimeType.replace('/', '\\/')};base64,`), "");
                    zip.file(fname, base64Data, { base64: true });
                }
            } else {
                const fname = _rdaState.esquema === 'comparativa_multianual' 
                    ? `${_safeName(u.nombre)}_${u.clues}_COMPARATIVA_25-26_RDA.pdf`
                    : `RDA_${u.clues}_${_safeName(u.nombre)}.pdf`;
                const blob = await generarPDFRobusto('rdaDashboardContent', fname, true);
                zip.file(fname, blob);
            }
        }

        setOverlayProgress(targets.length, targets.length, 'Comprimiendo archivo ZIP final...', 'Finalizando');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        const tagMode = isJpeg ? 'JPEG' : (mode === 'png' ? 'PNG_HD' : 'PDF');
        link.download = `Indicadores_RDA2026_${tagMode}_${_safeName(originalMuni) || 'JS1'}_${_dateStr()}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

        if (typeof showToast === 'function') showToast(`Exportación masiva de ${mode.toUpperCase()}s completada`, true, 'good');

    } catch (e) {
        console.error('[RDA ZIP]', e);
        if (typeof showToast === 'function') showToast('Error en exportación masiva', false, 'bad');
    } finally {
        if (originalChartAnim !== null && typeof Chart !== 'undefined') {
            Chart.defaults.animation = originalChartAnim;
        }

        muniSelect.value = originalMuni;
        if (typeof populateUnidadFilter === 'function') populateUnidadFilter();
        uniSelect.value = originalUni;
        if (typeof renderDashboard === 'function') renderDashboard();

        removeOverlayProgress();
        if (typeof hideOverlay === 'function') hideOverlay();
    }
    } finally {
        window._isBatchExporting = false;
    }
}

window.refreshRDADashboard = () => { 
    _rdaCache.unidades = null; 
    _rdaCache.registros = null; 
    _rdaCache.maxMes = 0;
    loadAndRender(); 
};
window.resetRDAEsquemaToBasico = () => {
    _rdaState.esquema = 'basico';
    const sel = document.getElementById('rdaFilterEsquema');
    if (sel) sel.value = 'basico';
    document.querySelectorAll('.rda-scheme-btn').forEach(b => {
        if (b.dataset.scheme === 'basico') b.classList.add('active');
        else b.classList.remove('active');
    });
};
window.loadAndRender = loadAndRender;
window.addEventListener('DOMContentLoaded', () => initRDADashboard());

// 📱 MOBILE SPECIFIC LOGIC
function initRDAMobileDashboard() {
    document.querySelectorAll('.rda-scheme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.rda-scheme-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            _rdaState.esquema = e.target.dataset.scheme;
            renderMobileDashboard();
            // Sync with desktop scheme so states are matched
            const desktopScheme = document.getElementById('rdaFilterEsquema');
            if (desktopScheme) desktopScheme.value = _rdaState.esquema;
        });
    });

    document.getElementById('rdaMobileMuni')?.addEventListener('change', () => {
        populateMobileFilters();
        renderMobileDashboard();
    });
    document.getElementById('rdaMobileUnidad')?.addEventListener('change', () => renderMobileDashboard());
}

window.closeRdaMobile = function() {
    if (AppState.rol === "UNIDAD") {
        if (typeof activateUnidadTab === 'function') activateUnidadTab('CAPTURE');
    } else {
        if (typeof activateOpsTab === 'function') activateOpsTab('CAPTURE');
    }
};

function populateMobileFilters() {
    const { unidades } = _rdaCache;
    const muniSel = document.getElementById('rdaMobileMuni');
    const uniSel = document.getElementById('rdaMobileUnidad');
    if (!muniSel || !unidades) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    const allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];

    let municipios = [...new Set(unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();

    if (role === 'ADMIN' || role === 'JURISDICCIONAL' || role === 'CARAVANAS') {
        muniSel.disabled = false;
        if (muniSel.options.length <= 1) {
            muniSel.innerHTML = '<option value="">Todos los municipios</option>' + municipios.map(m => `<option value="${m}">${m}</option>`).join('');
            muniSel.value = '';
        }
    } else if (role === 'MUNICIPAL') {
        municipios = municipios.filter(m => {
            const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return allowed.some(a => mNorm.includes(a) || a.includes(mNorm));
        });
        if (muniSel.options.length <= 1) {
            muniSel.innerHTML = municipios.map(m => `<option value="${m}">${m}</option>`).join('');
            muniSel.value = municipios.length > 0 ? municipios[0] : '';
            muniSel.disabled = municipios.length <= 1;
        }
    } else if (role === 'UNIDAD') {
        const userClues = (typeof USER !== 'undefined' && USER?.clues) || '';
        const matchUnit = unidades.find(u => u.clues === userClues);
        if (matchUnit) {
            muniSel.innerHTML = `<option value="${(matchUnit.municipio || '').toUpperCase().trim()}">${matchUnit.municipio}</option>`;
            muniSel.value = (matchUnit.municipio || '').toUpperCase().trim();
            if (uniSel) {
                uniSel.innerHTML = `<option value="${matchUnit.clues}">${matchUnit.nombre || matchUnit.clues}</option>`;
                uniSel.value = matchUnit.clues;
            }
        }
        muniSel.disabled = true;
        if (uniSel) uniSel.disabled = true;
        return;
    }

    const muni = muniSel.value || '';
    if (role !== 'UNIDAD' && uniSel) {
        if (!muni) {
            uniSel.innerHTML = '<option value="">Todas las unidades</option>';
            uniSel.disabled = true;
        } else {
            uniSel.disabled = false;
            const units = unidades.filter(u => (u.municipio || '').toUpperCase().trim() === muni.toUpperCase().trim())
                                  .sort((a, b) => (a.clues || '').localeCompare(b.clues || ''));
            const currUni = uniSel.value;
            uniSel.innerHTML = '<option value="">Todas las unidades</option>' + units.map(u => `<option value="${u.clues}">${u.nombre || u.clues}</option>`).join('');
            uniSel.value = currUni || '';
        }
    }
}

function renderMobileDashboard() {
    const rdaMob = document.getElementById("rdaMobileDashboard");
    if (!rdaMob) return;

    const { unidades, maxMes } = _rdaCache;
    if (!unidades || !unidades.length) return;

    const muniFilter = document.getElementById('rdaMobileMuni')?.value || '';
    const uniFilter = document.getElementById('rdaMobileUnidad')?.value || '';
    const esquema = _rdaState.esquema || 'basico';
    const kpiList = SCHEME_KPIS[esquema] || SCHEME_KPIS['basico'];

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    const countEl = document.getElementById('rdaMobileCount');
    if (countEl) countEl.innerText = fUnits.length;

    // === Aggregate data exactly like renderDashboard ===
    let agg = {
        pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, pob_total: 0,
        bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
        hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0,
        adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
        am_neumo13: 0, am_neumo20: 0, am_td: 0,
        emb_tdpa: 0, emb_vsr: 0,
        inv_influenza: 0, inv_covid: 0,
        total_unidades: fUnits.length
    };

    for (const u of fUnits) {
        agg.pob_menor_1 += u.pob_menor_1 || 0;
        agg.pob_1_ano += u.pob_1_ano || 0;
        agg.pob_4_anos += u.pob_4_anos || 0;
        agg.bcg_dosis += u.bcg_dosis || 0;
        agg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0;
        agg.hexa_3_dosis += u.hexa_3_dosis || 0;
        agg.rota_2_dosis += u.rota_2_dosis || 0;
        agg.neumo_2_dosis += u.neumo_2_dosis || 0;
        agg.hexa_ref_dosis += u.hexa_ref_dosis || 0;
        agg.neumo_ref_dosis += u.neumo_ref_dosis || 0;
        agg.srp_2_dosis += u.srp_2_dosis || 0;
        agg.dpt_4_dosis += u.dpt_4_dosis || 0;
        agg.adol_hb += u.adol_hb || 0;
        agg.adol_sr += u.adol_sr || 0;
        agg.adol_vph += u.adol_vph || 0;
        agg.adol_td += u.adol_td || 0;
        agg.adol_tdpa += u.adol_tdpa || 0;
        agg.am_neumo13 += u.am_neumo13 || 0;
        agg.am_neumo20 += u.am_neumo20 || 0;
        agg.am_td += u.am_td || 0;
        agg.emb_tdpa += u.emb_tdpa || 0;
        agg.emb_vsr += u.emb_vsr || 0;
        agg.inv_influenza += u.inv_influenza || 0;
        agg.inv_covid += u.inv_covid || 0;
    }
    agg.pob_total = agg.pob_menor_1 + agg.pob_1_ano + agg.pob_4_anos;

    // Coberturas (same formula as desktop)
    const factorMenor1 = (agg.pob_menor_1 * 0.0833) * maxMes;
    const factorUno = (agg.pob_1_ano * 0.0833) * maxMes;
    const factorCuatro = (agg.pob_4_anos * 0.0833) * maxMes;
    const sumaDosisMenor1 = agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis;
    const sumaDosisUno = agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis;
    const sumaDosisCuatro = agg.dpt_4_dosis;
    agg.cobertura_menor1 = factorMenor1 > 0 ? Math.round((((sumaDosisMenor1 / 4.0) / factorMenor1) * 100) * 10) / 10 : 0;
    agg.cobertura_uno = factorUno > 0 ? Math.round((((sumaDosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
    agg.cobertura_cuatro = factorCuatro > 0 ? Math.round(((sumaDosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

    // === Render KPI Cards ===
    const kpiGrid = document.getElementById('rdaMobileKpiGrid');
    if (kpiGrid) {
        let kpiHtml = '';
        kpiList.forEach(k => {
            let valText = '';
            let subText = '';
            let valNum = 0;

            if (esquema === 'basico') {
                if (k.key === 'menor1') {
                    valNum = agg.cobertura_menor1;
                    valText = `${valNum}%`;
                    subText = `${sumaDosisMenor1.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'uno') {
                    valNum = agg.cobertura_uno;
                    valText = `${valNum}%`;
                    subText = `${sumaDosisUno.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'cuatro') {
                    valNum = agg.cobertura_cuatro;
                    valText = `${valNum}%`;
                    subText = `${agg.dpt_4_dosis.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'pob') {
                    valText = agg.pob_total.toLocaleString('es-MX');
                    subText = `${agg.total_unidades} unidades`;
                }
            } else {
                valNum = agg[k.key] || 0;
                valText = valNum.toLocaleString('es-MX');
                subText = 'dosis aplicadas';
            }

            let valColor = '#0f172a';
            if (esquema === 'basico' && k.key !== 'pob') {
                valColor = valNum >= 80 ? '#059669' : valNum >= 50 ? '#d97706' : '#dc2626';
            }

            kpiHtml += `
                <div class="rda-kpi-mobile-card" style="border-left: 3px solid ${k.fg};">
                    <div class="kpi-icon" style="background: ${k.bg}; color: ${k.fg};">
                        <span class="material-symbols-rounded premium-anim-icon">${k.icon}</span>
                    </div>
                    <div class="kpi-label">${k.label}</div>
                    <div class="kpi-value" style="color: ${valColor};">${valText}</div>
                    <div class="kpi-meta">${subText}</div>
                </div>
            `;
        });
        kpiGrid.innerHTML = kpiHtml;
    }

    // === Render Unit List ===
    const listEl = document.getElementById('rdaMobileList');
    if (listEl) {
        let listHtml = '';
        fUnits.forEach(u => {
            // Show the main KPI value per unit (first non-pob KPI)
            const mainKpi = kpiList.find(k => k.key !== 'pob') || kpiList[0];
            let mainVal = 0;
            if (esquema === 'basico') {
                if (mainKpi.key === 'menor1') {
                    const uDosis = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                    mainVal = uDosis;
                } else if (mainKpi.key === 'uno') {
                    mainVal = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0);
                } else if (mainKpi.key === 'cuatro') {
                    mainVal = u.dpt_4_dosis || 0;
                }
            } else {
                mainVal = Number(u[mainKpi.key]) || 0;
            }

            listHtml += `
                <div class="rda-unit-mobile-card">
                    <div class="unit-header">
                        <div>
                            <div class="unit-title">${u.nombre || u.clues}</div>
                            <div class="unit-clues">${u.clues}</div>
                        </div>
                        <div class="unit-doses">${mainVal.toLocaleString('es-MX')}</div>
                    </div>
                    <div class="unit-metrics">
                        <div class="metric-item">
                            <span class="metric-label">${mainKpi.label}</span>
                            <span class="metric-value text-slate-700">${mainVal.toLocaleString('es-MX')} dosis</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Municipio</span>
                            <span class="metric-value text-slate-700 truncate">${u.municipio || '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = listHtml;
    }
}
// ==========================================
// CALCULADORA DE PARÁMETROS (ADMIN) -> Mapeado ahora en param_calculator.js
// ==========================================


/**
 * Manejadores interactivos para el sistema de etiquetas (chips) del mapeador de SIS
 */
// Master Catálogo Oficial 2026 (Variables Federales SINBA-SIS)
const MASTER_CATALOG_2025 = [
    'VBC01','VBC02','BIO50','BIO03','VBC03','VAC06','VHB01','VHB02','VHB03','VHB04',
    'VHB05','VHB06','VAC67','VAC68','VAC69','VAC70','VHX01','VHX02','VHX03','VHX04',
    'VAC12','VAC13','VRV01','VRV02','VRV03','VRV04','VAC17','VAC18','VAC19','VNC01',
    'VNC02','VNC03','VAC93','VAC94','VNP01','VAC23','VTV01','VAC81','VTV02','VTV03',
    'VAC82','VAC91','VAC83','VPH05','VPH06','VPH07','VPH08','VAC84','VAC85','VAC92',
    'VPH09','VPH10','VPH11','VAC36','VAR01','VAC38','VAC87','BIO88','VAC39','VAC40',
    'VAC47','VAC48','VTD01','VTD02','VAC55','VAC56','VTT01','VTT02','VTT03','VTT04',
    'VTT05','VTT06','VTT07','VTT08','VTT09','VTT10','VTT11','VTT12','VAC63','VDP01',
    'VCV38','VCV39','VCV40','VCV28','VCV16','VCV20','VCV21',
    'BIE01','BIE28','BIE29','BIE30','BIE31','BIE04','BIE32','BIE33','BIE34','BIE35',
    'BIE36','BIE37','BIE38','BIE39','BIE40','BIO96','BIO97','BIE09','BIE10','BIE41',
    'BIE12','BIE13','BIE42','BIE15','BIE16','BIE43','BIE18','BIE19','BIE44','BIE48',
    'BIE49','BIE50','BIE24','BIE25','BIE46','BIE51','BIE52','BIE53','BIE54','BIE55',
    'BIE56','BIE57','BIE58','BIE59','BIE60','BIE61'
];

const MASTER_CATALOG_2026 = [
    'VBC01','VBC02','BIO50','BIO03','VBC03','VAC06','VHB01','VHB02','VHB03','VHB04',
    'VHB05','VHB06','VAC67','VAC68','VAC69','VAC70','VHX01','VHX02','VHX03','VHX04',
    'VAC12','VAC13','VRV01','VRV02','VRV03','VRV04','VAC17','VAC18','VAC19','VNC01',
    'VNC02','VNC03','VNC04','VCC01','VCC02','VCC03','VCC04','VCC05','VCC06','VCC07',
    'VAC23','VTV01','VTV02','VTV03','VAC82','VAC91','VDV01','VDV02','VDV03','VDV04',
    'VDV05','VDV06','VPH05','VPH06','VPH07','VPH08','VPH12','VPH13','VPH14','VAR02',
    'VAR03','VHA01','VHA02','BIO88','VAC39','VAC40','VAC47','VAC48','VTD01','VTD02',
    'VAC55','VAC56','VTT01','VTT02','VTT03','VTT04','VTT05','VTT06','VTT07','VTT08',
    'VTT09','VTT10','VTT11','VTT12','VAC63','VDP01','VS001','VCV38','VCV39','VCV40',
    'VCV28','VCV16','VCV20','VCV21',
    'BIE01','BIE28','BIE29','BIE30','BIE31','BIE04','BIE32','BIE33','BIE34','BIE35',
    'BIE36','BIE37','BIE38','BIE39','BIE40','BIO96','BIO97','BIE09','BIE10','BIE41',
    'BIE12','BIE13','BIE42','BIE15','BIE16','BIE43','BIE18','BIE19','BIE44','BIE48',
    'BIE49','BIE50','BIE24','BIE25','BIE46','BIE51','BIE52','BIE53','BIE54','BIE55',
    'BIE56','BIE57','BIE58','BIE59','BIE60','BIE61'
];

window.getValidKeysForYear = function() {
    const valid = new Set();
    const activeCatalog = (_currentSisMappingYear === 2025) ? MASTER_CATALOG_2025 : MASTER_CATALOG_2026;
    activeCatalog.forEach(k => valid.add(k.toUpperCase()));
    _importedCatalogKeys.forEach(item => valid.add(item.key.toUpperCase()));
    const defaultDict = window.DICT_RDA || {};
    Object.values(defaultDict).forEach(arr => {
        if (Array.isArray(arr)) arr.forEach(k => valid.add(k.toUpperCase()));
    });
    return valid;
};

// Obtener todas las claves que YA están asignadas en la vista por Biológico Madre
window.getAllAssignedMotherKeys = function() {
    const assigned = new Set();
    const D = window.DICT_RDA || {};
    
    Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
        const fam = BIO_FAMILY_MAP[famKey];
        fam.doses.forEach(doseKey => {
            const keys = D[doseKey] || [];
            keys.forEach(k => assigned.add(k.toUpperCase()));
        });
        if (_bioMotherKeys[famKey]) {
            _bioMotherKeys[famKey].forEach(k => assigned.add(k.toUpperCase()));
        }
    });
    return assigned;
};

window.handleMotherTagKeydown = function(e, famKey) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
        if (!val) return;

        const validCatalogKeys = window.getValidKeysForYear();
        if (!validCatalogKeys.has(val)) {
            if (typeof showToast === 'function') showToast(`La clave '${val}' no existe en el catálogo federal oficial.`, false, 'bad');
            e.target.value = '';
            return;
        }

        if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
        if (!_bioMotherKeys[famKey].includes(val)) {
            _bioMotherKeys[famKey].push(val);
            window.renderSisMappingTable();
        }
        e.target.value = '';
    }
};

window.handleMotherTagBlur = function(e, famKey) {
    const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
    if (val) {
        const validCatalogKeys = window.getValidKeysForYear();
        if (validCatalogKeys.has(val)) {
            if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
            if (!_bioMotherKeys[famKey].includes(val)) {
                _bioMotherKeys[famKey].push(val);
                window.renderSisMappingTable();
            }
        }
    }
    e.target.value = '';
};

window.handleSisTagKeydown = function(e, doseKey) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
        if (!val) return;

        // Validar herencia: La dosis solo puede recibir claves asignadas a su Biológico Madre
        const parentFamKey = Object.keys(BIO_FAMILY_MAP).find(fam => BIO_FAMILY_MAP[fam].doses.includes(doseKey));
        const motherKeys = parentFamKey ? (_bioMotherKeys[parentFamKey] || []) : [];

        if (motherKeys.length > 0 && !motherKeys.includes(val)) {
            if (typeof showToast === 'function') showToast(`La clave '${val}' no pertenece al Biológico Madre (${BIO_FAMILY_MAP[parentFamKey]?.label || parentFamKey}). Asígnala primero en el Paso 1.`, false, 'bad');
            e.target.value = '';
            return;
        }

        const container = e.target.closest('.sis-tags-input-container');
        const wrapper = container.querySelector('.sis-chips-wrapper');
        const existing = Array.from(wrapper.querySelectorAll('.sis-chip')).map(c => c.dataset.val);
        if (!existing.includes(val)) {
            const chip = document.createElement('span');
            chip.className = 'sis-chip';
            chip.dataset.val = val;
            chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: #e2e8f0; color: #1e293b; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; transition: all 0.2s;";
            chip.innerHTML = `${val} <span class="sis-chip-remove" style="cursor: pointer; font-size: 14px; font-weight: 900; color: #64748b; user-select: none; margin-left: 2px;" onclick="this.parentElement.remove();">&times;</span>`;
            wrapper.appendChild(chip);
        }
        e.target.value = '';
    } else if (e.key === 'Backspace' && e.target.value === '') {
        const container = e.target.closest('.sis-tags-input-container');
        const wrapper = container.querySelector('.sis-chips-wrapper');
        const chips = wrapper.querySelectorAll('.sis-chip');
        if (chips.length > 0) {
            chips[chips.length - 1].remove();
        }
    }
};

window.handleSisTagBlur = function(e, doseKey) {
    const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
    if (val && !val.includes('@') && val.length < 20) {
        const parentFamKey = Object.keys(BIO_FAMILY_MAP).find(fam => BIO_FAMILY_MAP[fam].doses.includes(doseKey));
        const motherKeys = parentFamKey ? (_bioMotherKeys[parentFamKey] || []) : [];

        if (motherKeys.length === 0 || motherKeys.includes(val)) {
            const container = e.target.closest('.sis-tags-input-container');
            const wrapper = container.querySelector('.sis-chips-wrapper');
            const existing = Array.from(wrapper.querySelectorAll('.sis-chip')).map(c => c.dataset.val);
            if (!existing.includes(val)) {
                const chip = document.createElement('span');
                chip.className = 'sis-chip';
                chip.dataset.val = val;
                chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: #e2e8f0; color: #1e293b; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; transition: all 0.2s;";
                chip.innerHTML = `${val} <span class="sis-chip-remove" style="cursor: pointer; font-size: 14px; font-weight: 900; color: #64748b; user-select: none; margin-left: 2px;" onclick="this.parentElement.remove();">&times;</span>`;
                wrapper.appendChild(chip);
            }
        }
    }
    e.target.value = '';
};

/**
 * Renderiza la tabla de mapeo de variables SIS en el panel Admin.
 */
/**
 * Renderiza la tabla de mapeo de variables SIS en el panel Admin.
 */
let _adminMappingViewMode = 'mother'; // 'mother' | 'dose'

window.switchAdminMappingView = function(mode) {
    _adminMappingViewMode = mode;
    const btnMother = document.getElementById('btnViewMotherBio');
    const btnDose = document.getElementById('btnViewDoseScheme');

    if (mode === 'mother') {
        if (btnMother) btnMother.style.cssText = 'background-color: #0f172a !important; color: #ffffff !important; font-weight: 900;';
        if (btnDose) btnDose.style.cssText = 'background-color: transparent !important; color: #334155 !weight: 700;';
    } else {
        if (btnMother) btnMother.style.cssText = 'background-color: transparent !important; color: #334155 !important; font-weight: 700;';
        if (btnDose) btnDose.style.cssText = 'background-color: #0f172a !important; color: #ffffff !important; font-weight: 900;';
    }

    window.renderSisMappingTable();
};

window.renderSisMappingTable = function(searchQuery = '') {
    const tbody = document.getElementById('sisMappingTbody');
    if (!tbody) return;

    const query = String(searchQuery || '').trim().toLowerCase();
    const D = window.DICT_RDA || {};

    if (_adminMappingViewMode === 'mother') {
        // VISTA 1: POR BIOLÓGICO MADRE (Total de Dosis Aplicadas)
        let html = '';
        const allAssigned = window.getAllAssignedMotherKeys();
        const validKeys = Array.from(window.getValidKeysForYear()).sort();

        Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
            if (_currentSisMappingYear === 2025 && (famKey === 'VSR' || famKey === 'NEUMO_20')) return;
            if (_currentSisMappingYear !== 2025 && famKey === 'NEUMO_ADULTOS') return;

            const fam = BIO_FAMILY_MAP[famKey];
            if (query && !fam.label.toLowerCase().includes(query) && !famKey.toLowerCase().includes(query)) return;

            // Recopilar todas las claves asociadas a las dosis de este biológico madre
            const motherVarsSet = new Set();
            fam.doses.forEach(doseKey => {
                const keys = D[doseKey] || [];
                keys.forEach(k => motherVarsSet.add(k));
            });

            // Si hay claves en _bioMotherKeys para esta familia, incluirlas también
            if (_bioMotherKeys[famKey]) {
                _bioMotherKeys[famKey].forEach(k => motherVarsSet.add(k));
            }

            const vars = Array.from(motherVarsSet);
            // Disponibles para esta fila: Claves válidas que NO están asignadas a NINGÚN biológico madre aún (o asignadas a este mismo)
            const availableForThisFam = validKeys.filter(k => !allAssigned.has(k) || vars.includes(k));

            html += `
                <tr class="hover:bg-slate-50/50">
                    <td class="px-6 py-4 text-[12px] font-bold text-slate-800" style="width: 320px; vertical-align: middle;">
                        <div class="font-black text-indigo-900 text-[13px] flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            ${fam.label}
                        </div>
                        <div class="text-[10px] text-slate-400 font-bold mt-0.5">Biológico Madre (Total Dosis) <code class="text-slate-400/80 bg-slate-100 px-1 py-0.2 rounded text-[9px] ml-1 font-mono">${famKey}</code></div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="sis-tags-input-container" data-fam="${famKey}" 
                             style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 16px; border-radius: 14px; border: 1px solid #cbd5e1; background: #ffffff; min-height: 48px; align-items: center;">
                            <div class="sis-chips-wrapper" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                                ${vars.map(v => `
                                    <span class="sis-chip" data-val="${v}" 
                                          style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; border: 1px solid #c7d2fe; transition: all 0.2s;">
                                        ${v}
                                        <span class="sis-chip-remove" style="cursor: pointer; font-size: 14px; font-weight: 900; color: #6366f1; user-select: none; margin-left: 2px;" onclick="event.stopPropagation(); window.removeMotherVarChip('${famKey}', '${v}', this);">&times;</span>
                                    </span>
                                `).join('')}
                            </div>
                            <select onchange="window.selectMotherKeyFromList('${famKey}', this)"
                                    style="height: 36px; min-height: 36px; max-height: 36px; border-radius: 14px; border: 1px solid rgba(203, 213, 225, 0.8); padding: 0 36px 0 16px; background-color: #f8fafc; color: #0f172a; font-size: 12px; font-weight: 800; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23475569\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>'); background-repeat: no-repeat; background-position: right 12px center; cursor: pointer; outline: none; margin-left: auto;">
                                <option value="">+ Seleccionar clave disponible...</option>
                                ${availableForThisFam.filter(k => !vars.includes(k)).map(k => `<option value="${k}">${k}</option>`).join('')}
                            </select>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || `<tr><td colspan="2" class="p-6 text-center text-xs font-bold text-slate-400">No hay biológicos que coincidan.</td></tr>`;
        return;
    }

    // VISTA 2: POR ESQUEMA / DOSIS RDA
    const metadata = {
        BCG: { label: "BCG", group: "Esquema Básico (0-8 años)", desc: "Dosis Única (<1 año)" },
        HepB_0_7: { label: "Hepatitis B (Nacimiento)", group: "Esquema Básico (0-8 años)", desc: "0 a 7 días" },
        Hexa_1: { label: "Hexavalente 1ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año" },
        Hexa_2: { label: "Hexavalente 2ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año" },
        Hexa_3: { label: "Hexavalente 3ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año" },
        Hexa_Ref: { label: "Hexavalente Refuerzo", group: "Esquema Básico (0-8 años)", desc: "Niños de 1 año" },
        Rota_2: { label: "Rotavirus 2ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año" },
        Neumo_1: { label: "Neumocócica Conjugada (13v) 1ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año (13v)" },
        Neumo_2: { label: "Neumocócica Conjugada (13v) 2ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año (13v)" },
        Neumo_Ref: { label: "Neumocócica Conjugada (13v) Refuerzo", group: "Esquema Básico (0-8 años)", desc: "Niños de 1 año (13v)" },
        Neumo_C1: { label: "Neumocócica 20v 1ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año (20v)" },
        Neumo_C2: { label: "Neumocócica 20v 2ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Menores de 1 año (20v)" },
        Neumo_C3: { label: "Neumocócica 20v Refuerzo/3ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Niños de 1 año (20v)" },
        SRP_1: { label: "SRP 1ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Niños de 1 año" },
        SRP_2: { label: "SRP 2ª Dosis", group: "Esquema Básico (0-8 años)", desc: "Niños de 18 meses / 6 años" },
        DPT_4: { label: "DPT Refuerzo", group: "Esquema Básico (0-8 años)", desc: "Niños de 4 años" },
        VARICELA: { label: "Varicela", group: "Biológicos Adicionales", desc: "Dosis adicionales" },
        HEPATITIS_A: { label: "Hepatitis A", group: "Biológicos Adicionales", desc: "Dosis adicionales" },
        ADOL_HB: { label: "Hepatitis B (Adolescentes y Adultos)", group: "Esquema Adolescentes y Adultos", desc: "Dosis para este grupo" },
        ADOL_SR: { label: "SR Doble Viral", group: "Esquema Adolescentes y Adultos", desc: "Dosis para este grupo" },
        ADOL_VPH: { label: "VPH Virus Papiloma Humano", group: "Esquema Adolescentes y Adultos", desc: "Adolescentes 11-16 años" },
        ADOL_TD: { label: "Td Tétanos y Difteria", group: "Esquema Adolescentes y Adultos", desc: "Adolescentes y Adultos" },
        ADOL_TDPA: { label: "Tdpa Tétanos, Difteria, Tos Ferina", group: "Esquema Adolescentes y Adultos", desc: "Adolescentes" },
        AM_NEUMO13: { label: "Neumocócica 13 Valente", group: "Esquema Adultos Mayores", desc: "Adultos mayores" },
        AM_NEUMO20: { label: "Neumocócica 20 Valente", group: "Esquema Adultos Mayores", desc: "Adultos mayores" },
        NEUMO_23: { label: "Neumocócica 23 Polisacárida", group: "Esquema Adultos Mayores", desc: "Adultos mayores" },
        SRP_6: { label: "SRP Dosis 6 Años", group: "Esquema Básico (0-8 años)", desc: "Niños de 6 años" },
        AM_TD: { label: "Td Tétanos y Difteria (Adultos Mayores)", group: "Esquema Adultos Mayores", desc: "Adultos mayores" },
        EMB_TDPA: { label: "Tdpa Embarazadas", group: "Esquema Embarazadas", desc: "Gestantes" },
        EMB_VSR: { label: "VSR Virus Sincicial Respiratorio", group: "Esquema Embarazadas", desc: "Gestantes" },
        INFLUENZA: { label: "Influenza Estacional", group: "Temporada Invernal", desc: "Todas las dosis" },
        COVID: { label: "COVID-19", group: "Temporada Invernal", desc: "Todas las dosis" }
    };

    const groups = {};
    Object.keys(metadata).forEach(metaKey => {
        if (_currentSisMappingYear === 2025 && (metaKey === 'AM_NEUMO20' || metaKey === 'EMB_VSR' || metaKey === 'Neumo_C1' || metaKey === 'Neumo_C2' || metaKey === 'Neumo_C3')) return;
        if (_currentSisMappingYear !== 2025 && (metaKey === 'NEUMO_23' || metaKey === 'SRP_6')) return;

        const meta = metadata[metaKey];
        const labelMatches = meta.label.toLowerCase().includes(query);
        const groupMatches = meta.group.toLowerCase().includes(query);
        const keyMatches = metaKey.toLowerCase().includes(query);
        if (query && !labelMatches && !groupMatches && !keyMatches) return;

        if (!groups[meta.group]) groups[meta.group] = [];
        groups[meta.group].push({ key: metaKey, label: meta.label, desc: meta.desc });
    });

    let html = '';
    const sortedGroupNames = Object.keys(groups).sort();
    sortedGroupNames.forEach(groupName => {
        html += `
            <tr class="bg-slate-100/60 font-black text-slate-700">
                <td colspan="2" class="px-6 py-2.5 text-[11px] uppercase tracking-wider border-y border-slate-200 text-slate-700 bg-slate-100">
                    ${groupName}
                </td>
            </tr>
        `;
        groups[groupName].forEach(item => {
            const vars = D[item.key] || [];
            
            // HERENCIA: En vista por dosis/esquema, solo se pueden seleccionar las claves asignadas a su Biológico Madre
            const parentFamKey = Object.keys(BIO_FAMILY_MAP).find(fam => BIO_FAMILY_MAP[fam].doses.includes(item.key));
            const inheritedMotherKeys = parentFamKey ? (_bioMotherKeys[parentFamKey] || []) : Array.from(window.getValidKeysForYear());

            html += `
                <tr class="hover:bg-slate-50/50">
                    <td class="px-6 py-4 text-[12px] font-bold text-slate-800" style="width: 320px; vertical-align: middle;">
                        <div class="font-black text-slate-900 text-[13px]">${item.label}</div>
                        <div class="text-[10px] text-slate-400 font-bold mt-0.5">${item.desc} <code class="text-slate-400/80 bg-slate-100 px-1 py-0.2 rounded text-[9px] ml-1 font-mono">${item.key}</code></div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="sis-tags-input-container" data-bio="${item.key}" 
                             style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 16px; border-radius: 14px; border: 1px solid #cbd5e1; background: #ffffff; min-height: 48px; align-items: center;">
                            <div class="sis-chips-wrapper" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                                ${vars.map(v => `
                                    <span class="sis-chip" data-val="${v}" 
                                          style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: #e2e8f0; color: #1e293b; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; transition: all 0.2s;">
                                        ${v}
                                        <span class="sis-chip-remove" style="cursor: pointer; font-size: 14px; font-weight: 900; color: #64748b; user-select: none; margin-left: 2px;" onclick="event.stopPropagation(); window.removeDoseKeyChip('${item.key}', '${v}');">&times;</span>
                                    </span>
                                `).join('')}
                            </div>
                            <select onchange="window.selectDoseKeyFromList('${item.key}', this)"
                                    style="height: 36px; min-height: 36px; max-height: 36px; border-radius: 14px; border: 1px solid rgba(203, 213, 225, 0.8); padding: 0 36px 0 16px; background-color: #f8fafc; color: #0f172a; font-size: 12px; font-weight: 800; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23475569\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>'); background-repeat: no-repeat; background-position: right 12px center; cursor: pointer; outline: none; margin-left: auto;">
                                <option value="">+ Seleccionar clave heredada...</option>
                                ${inheritedMotherKeys.filter(k => !vars.includes(k)).map(k => `<option value="${k}">${k}</option>`).join('')}
                            </select>
                        </div>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = html;
};

window.selectMotherKeyFromList = function(famKey, selectEl) {
    const val = selectEl.value;
    if (!val) return;

    if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
    if (!_bioMotherKeys[famKey].includes(val)) {
        _bioMotherKeys[famKey].push(val);
        window.renderSisMappingTable();
    }
};

window.selectDoseKeyFromList = function(doseKey, selectEl) {
    const val = selectEl.value;
    if (!val) return;

    if (!window.DICT_RDA) window.DICT_RDA = {};
    if (!Array.isArray(window.DICT_RDA[doseKey])) window.DICT_RDA[doseKey] = [];

    if (!window.DICT_RDA[doseKey].includes(val)) {
        window.DICT_RDA[doseKey].push(val);
    }

    // Asegurar que la clave también esté en el Biológico Madre correspondiente
    const parentFamKey = Object.keys(BIO_FAMILY_MAP).find(fam => BIO_FAMILY_MAP[fam].doses.includes(doseKey));
    if (parentFamKey) {
        if (!_bioMotherKeys[parentFamKey]) _bioMotherKeys[parentFamKey] = [];
        if (!_bioMotherKeys[parentFamKey].includes(val)) {
            _bioMotherKeys[parentFamKey].push(val);
        }
    }

    // Re-renderizar la tabla para actualizar visuales y opciones del selector
    window.renderSisMappingTable();
};

window.removeDoseKeyChip = function(doseKey, keyVal) {
    if (window.DICT_RDA && Array.isArray(window.DICT_RDA[doseKey])) {
        window.DICT_RDA[doseKey] = window.DICT_RDA[doseKey].filter(k => k !== keyVal);
    }
    // Re-renderizar la tabla para liberar la clave en los selectores desplegables
    window.renderSisMappingTable();
};

window.handleMotherTagKeydown = function(e, famKey) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
        if (val && !val.includes('@') && val.length < 20) {
            if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
            if (!_bioMotherKeys[famKey].includes(val)) {
                _bioMotherKeys[famKey].push(val);
                window.renderSisMappingTable();
            }
        }
        e.target.value = '';
    }
};

window.handleMotherTagBlur = function(e, famKey) {
    const val = e.target.value.trim().toUpperCase().replace(/,/g, '');
    if (val && !val.includes('@') && val.length < 20) {
        if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
        if (!_bioMotherKeys[famKey].includes(val)) {
            _bioMotherKeys[famKey].push(val);
            window.renderSisMappingTable();
        }
    }
    e.target.value = '';
};

window.removeMotherVarChip = function(famKey, keyVal, spanEl) {
    if (_bioMotherKeys[famKey]) {
        _bioMotherKeys[famKey] = _bioMotherKeys[famKey].filter(k => k !== keyVal);
    }
    if (spanEl && spanEl.parentElement) spanEl.parentElement.remove();
};

let _currentSisMappingYear = 2026;
let _bioMotherKeysPerYear = { 2025: {}, 2026: {} };
let _bioMotherKeys = {}; // Referencia al objeto del año activo

window.switchSisMappingYear = async function(anio) {
    _currentSisMappingYear = parseInt(anio, 10) || 2026;
    if (!_bioMotherKeysPerYear[_currentSisMappingYear]) {
        _bioMotherKeysPerYear[_currentSisMappingYear] = {};
    }
    _bioMotherKeys = _bioMotherKeysPerYear[_currentSisMappingYear];
    
    // Actualizar estados visuales de las pestañas
    const tabs = document.querySelectorAll('#sisMappingYearTabs button[data-anio]');
    tabs.forEach(btn => {
        const bAnio = parseInt(btn.dataset.anio, 10);
        if (bAnio === _currentSisMappingYear) {
            btn.style.cssText = 'background-color: #0f172a !important; color: #ffffff !important; border: 1px solid #0f172a !important;';
        } else {
            btn.style.cssText = 'background-color: #e2e8f0 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important;';
        }
    });

    // Cargar mapeo del año seleccionado desde Supabase
    if (typeof showOverlay === 'function') showOverlay(`Cargando plantilla SIS ${_currentSisMappingYear}...`, "Mapeador Admin");
    try {
        const { data, error } = await window.supabase
            .from('sis_variables_mapeo')
            .select('*')
            .eq('anio', _currentSisMappingYear);

        if (error) throw error;

        const baseDefault = _currentSisMappingYear === 2025 ? (window.DEFAULT_DICT_2025 || {}) : (window.DEFAULT_DICT_2026 || {});
        const yearMapping = JSON.parse(JSON.stringify(baseDefault));

        // Resetear mother keys para este año antes de poblar de BD
        _bioMotherKeysPerYear[_currentSisMappingYear] = {};
        _bioMotherKeys = _bioMotherKeysPerYear[_currentSisMappingYear];

        // Si existen registros personalizados guardados en Supabase para este año, sobrescribir
        if (data && data.length > 0) {
            data.forEach(row => {
                const bioStr = String(row.biologico || '').toUpperCase();
                if (bioStr.startsWith('MOTHER_')) {
                    const famKey = bioStr.replace('MOTHER_', '');
                    if (Array.isArray(row.variables)) {
                        _bioMotherKeys[famKey] = row.variables;
                    }
                } else {
                    const targetKey = Object.keys(yearMapping).find(k => k.toUpperCase() === bioStr);
                    if (targetKey && Array.isArray(row.variables)) {
                        yearMapping[targetKey] = [...row.variables];
                    } else if (!targetKey && Array.isArray(row.variables)) {
                        yearMapping[bioStr] = [...row.variables];
                    }
                }
            });
        }

        // AUTO-MIGRACIÓN: Corregir claves incorrectas guardadas en versiones anteriores
        if (_currentSisMappingYear === 2025) {
            // NEUMO_23 en 2025: clave real = VNP01 (VNC04 pertenece a AM_NEUMO13 en 2026)
            if (yearMapping.NEUMO_23 && yearMapping.NEUMO_23.includes('VNC04')) {
                yearMapping.NEUMO_23 = [...new Set(
                    yearMapping.NEUMO_23.map(k => k === 'VNC04' ? 'VNP01' : k)
                )];
                console.info('[SIS Mapper] Auto-migración 2025: VNC04 → VNP01 en NEUMO_23');
            }
        }

        // Si no había registros MOTHER_ en Supabase para alguna familia, auto-poblar _bioMotherKeys desde las dosis
        Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
            if (_currentSisMappingYear === 2025 && (famKey === 'VSR' || famKey === 'NEUMO_20')) return;
            if (_currentSisMappingYear !== 2025 && famKey === 'NEUMO_ADULTOS') return;

            if (!_bioMotherKeys[famKey] || _bioMotherKeys[famKey].length === 0) {
                const motherSet = new Set();
                BIO_FAMILY_MAP[famKey].doses.forEach(doseKey => {
                    const keys = yearMapping[doseKey] || [];
                    keys.forEach(k => {
                        if (_currentSisMappingYear === 2025 && (k.startsWith('VCC') || k === 'VS001')) return;
                        motherSet.add(k);
                    });
                });
                _bioMotherKeys[famKey] = Array.from(motherSet);
            }
            if (_currentSisMappingYear === 2025 && Array.isArray(_bioMotherKeys[famKey])) {
                _bioMotherKeys[famKey] = _bioMotherKeys[famKey].filter(k => !k.startsWith('VCC') && k !== 'VS001');
            }
        });

        // Actualizar diccionario activo local para este año
        if (typeof window.DICT_RDA_BY_YEAR === 'object') {
            window.DICT_RDA_BY_YEAR[_currentSisMappingYear] = yearMapping;
        }
        window.updateRdaDictionary(yearMapping);
        window.renderSisMappingTable();
    } catch (err) {
        console.error("[switchSisMappingYear] Error:", err);
        if (typeof showToast === 'function') showToast("Error al cambiar año: " + err.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

window.cloneSisMappingUi = async function() {
    const sourceYear = prompt("Ingresa el AÑO ORIGEN desde el cual deseas clonar (ejemplo: 2026):", "2026");
    if (!sourceYear) return;

    const srcInt = parseInt(sourceYear, 10);
    if (isNaN(srcInt) || srcInt === _currentSisMappingYear) {
        if (typeof showToast === 'function') showToast("Año origen no válido o idéntico al año actual.", false, 'bad');
        return;
    }

    if (typeof showOverlay === 'function') showOverlay(`Clonando mapeo de ${srcInt} a ${_currentSisMappingYear}...`, "Procesando");
    try {
        const { data: srcData, error: srcErr } = await window.supabase
            .from('sis_variables_mapeo')
            .select('*')
            .eq('anio', srcInt);

        if (srcErr) throw srcErr;
        if (!srcData || srcData.length === 0) throw new Error(`No existen reglas de mapeo registradas para el año ${srcInt}.`);

        const clonedRows = srcData.map(row => ({
            biologico: row.biologico,
            anio: _currentSisMappingYear,
            variables: row.variables
        }));

        const { error: upsertErr } = await window.supabase
            .from('sis_variables_mapeo')
            .upsert(clonedRows, { onConflict: 'biologico,anio' });

        if (upsertErr) throw upsertErr;

        if (typeof showToast === 'function') showToast(`¡Plantilla ${srcInt} clonada con éxito hacia ${_currentSisMappingYear}!`, true, 'good');
        window.switchSisMappingYear(_currentSisMappingYear);
    } catch (err) {
        console.error("[cloneSisMappingUi] Error:", err);
        if (typeof showToast === 'function') showToast("Error al clonar: " + err.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

window.addNewSisMappingYear = function() {
    const newYearStr = prompt("Ingresa el NUEVO AÑO para configurar la plantilla SIS (ejemplo: 2027):", "2027");
    if (!newYearStr) return;
    const newYear = parseInt(newYearStr, 10);
    if (isNaN(newYear) || newYear < 2020 || newYear > 2035) {
        if (typeof showToast === 'function') showToast("Año no válido", false, 'bad');
        return;
    }

    const tabsContainer = document.getElementById('sisMappingYearTabs');
    if (tabsContainer) {
        const existing = tabsContainer.querySelector(`button[data-anio="${newYear}"]`);
        if (!existing) {
            const addBtn = tabsContainer.querySelector('button[onclick*="addNewSisMappingYear"]');
            const newBtn = document.createElement('button');
            newBtn.type = 'button';
            newBtn.dataset.anio = newYear;
            newBtn.onclick = () => window.switchSisMappingYear(newYear);
            newBtn.style.cssText = 'background-color: #e2e8f0 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important;';
            newBtn.textContent = newYear;
            tabsContainer.insertBefore(newBtn, addBtn);
        }
    }
    window.switchSisMappingYear(newYear);
};

/**
 * Guarda los cambios realizados en el mapeo de variables SIS para el año activo.
 */
window.saveSisMappingUi = async function() {
    const rows = [];
    const localDict = window.DICT_RDA || {};

    // 1. Sincronizar desde chips visibles si existen en el DOM
    const doseContainers = document.querySelectorAll('.sis-tags-input-container[data-bio]');
    if (doseContainers && doseContainers.length > 0) {
        doseContainers.forEach(container => {
            const bio = container.dataset.bio;
            const chips = container.querySelectorAll('.sis-chip');
            const val = Array.from(chips).map(c => c.dataset.val.trim().toUpperCase()).filter(Boolean);
            localDict[bio] = val;
        });
    }

    // 2. Guardar mapeos por Dosis / Esquema (DICT_RDA)
    Object.keys(localDict).forEach(doseKey => {
        // Ignorar biológicos no pertenecientes al año activo
        if (_currentSisMappingYear === 2025 && (doseKey === 'AM_NEUMO20' || doseKey === 'EMB_VSR')) return;
        if (_currentSisMappingYear !== 2025 && (doseKey === 'NEUMO_23' || doseKey === 'SRP_6')) return;

        rows.push({
            biologico: doseKey,
            anio: _currentSisMappingYear,
            variables: localDict[doseKey] || []
        });
    });

    // 3. Guardar mapeos por Biológico Madre (_bioMotherKeys)
    Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
        if (_currentSisMappingYear === 2025 && (famKey === 'VSR' || famKey === 'NEUMO_20')) return;
        if (_currentSisMappingYear !== 2025 && famKey === 'NEUMO_ADULTOS') return;

        const motherVars = _bioMotherKeys[famKey] || [];
        rows.push({
            biologico: `MOTHER_${famKey}`,
            anio: _currentSisMappingYear,
            variables: motherVars
        });
    });

    if (typeof showOverlay === 'function') {
        showOverlay(`Guardando mapeo SIS para el año ${_currentSisMappingYear}...`, "Mapeador Admin");
    }

    try {
        const { error } = await window.supabase
            .from('sis_variables_mapeo')
            .upsert(rows, { onConflict: 'biologico,anio' });

        if (error) throw error;

        // Actualizar diccionarios locales por año
        if (typeof window.DICT_RDA_BY_YEAR === 'object') {
            window.DICT_RDA_BY_YEAR[_currentSisMappingYear] = localDict;
        }
        if (typeof window.updateRdaDictionary === 'function') {
            window.updateRdaDictionary(localDict);
        }
        if (typeof window.loadRdaMappingFromDatabase === 'function') {
            await window.loadRdaMappingFromDatabase(_currentSisMappingYear);
        }

        if (typeof showToast === 'function') {
            showToast(`¡Mapeo del año ${_currentSisMappingYear} guardado con éxito en Supabase!`, true, 'good');
        }
    } catch (e) {
        console.error("Error saving SIS mapping:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar mapeo: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

// ==============================================================================
// IMPORTADOR DE CATÁLOGOS FEDERALES SIS Y ASIGNADOR VISUAL DRAG & DROP
// ==============================================================================
let _importedCatalogKeys = []; // [{ key: 'VAC69', desc: 'Hexavalente 3a Dosis' }]

window.handleImportFederalKeyCatalog = async function(files) {
    if (!files || !files.length) return;
    const file = files[0];
    
    if (typeof showProgressOverlay === 'function') {
        showProgressOverlay(`Analizando catálogo federal ${file.name}...`, "Catálogo SIS", "CARGA DE ARCHIVO");
    } else if (typeof showOverlay === 'function') {
        showOverlay(`Analizando catálogo federal ${file.name}...`, "Catálogo SIS");
    }
    try {
        let rows = [];
        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            const wb = XLSX.read(text, { type: 'string' });
            rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        } else {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const sheetName = wb.SheetNames.find(s => s.toUpperCase().includes('SIS')) || wb.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        }

        let keysMap = new Map();
        let currentSectionHeader = '';

        rows.forEach((row) => {
            if (!Array.isArray(row)) return;

            // Detectar encabezados de biológico en la primera columna (ej: "119 BCG", "121 Hepatitis B", "275 Hexavalente acelular", "125 Neumocócica Conjugada", "132 T d")
            const firstCell = String(row[0] || '').trim();
            if (/^\d{3}\s+/.test(firstCell) || /BCG|Hepatitis|Hexavalente|DPT|Rotavirus|Neumoc[oó]cica|Triple|Tdpa|Td|Varicela|COVID|Influenza/i.test(firstCell)) {
                currentSectionHeader = firstCell.replace(/\r?\n|\r/g, ' ');
            }

            row.forEach((cell, cIdx) => {
                const cellStr = String(cell || '').trim();
                const match = cellStr.match(/\b([A-Z]{3}\d{2,3}|BIO\d{2})\b/g);
                if (match) {
                    match.forEach(k => {
                        const cleanKey = k.toUpperCase();
                        let desc = currentSectionHeader;

                        if (cIdx > 0 && row[cIdx - 1]) {
                            const prev = String(row[cIdx - 1]).trim();
                            if (prev && prev !== cleanKey) desc = `${currentSectionHeader} - ${prev}`;
                        }

                        if (!keysMap.has(cleanKey)) {
                            keysMap.set(cleanKey, desc || 'Clave oficial extraída del catálogo federal');
                        }
                    });
                }
            });
        });

        _importedCatalogKeys = Array.from(keysMap.entries()).map(([key, desc]) => ({ key, desc }));

        // AUTO-MAPEO INTELIGENTE: Asociar automáticamente claves a Biológicos Madre según texto detectado
        Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
            if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
        });

        _importedCatalogKeys.forEach(item => {
            const dUpper = item.desc.toUpperCase();
            let targetFam = null;

            if (_currentSisMappingYear === 2025 && (item.key.startsWith('VCC') || item.key === 'VS001')) {
                return; // Ignorar claves exclusivas de 2026 en el año 2025
            }
            if (dUpper.includes('BCG') || item.key.startsWith('VBC')) targetFam = 'BCG';
            else if (dUpper.includes('HEXAVALENTE') || item.key.startsWith('VHX')) targetFam = 'HEXAVALENTE';
            else if (dUpper.includes('ROTAVIRUS') || item.key.startsWith('VRV')) targetFam = 'ROTAVIRUS';
            else if (dUpper.includes('HEPATITIS B') || item.key.startsWith('VHB')) targetFam = 'HEPATITIS_B';
            else if (dUpper.includes('23') || dUpper.includes('POLISACARIDA') || item.key.startsWith('VNP')) targetFam = 'NEUMO_ADULTOS';
            else if (dUpper.includes('NEUMOC') || item.key.startsWith('VNC') || item.key.startsWith('VCC')) targetFam = 'NEUMO_CONJ';
            else if (dUpper.includes('TRIPLE') || dUpper.includes('SRP') || item.key.startsWith('VTV')) targetFam = 'SRP';
            else if (dUpper.includes('DOBLE') || dUpper.includes('SR') || item.key.startsWith('VDV')) targetFam = 'SR';
            else if (dUpper.includes('DPT') || item.key.startsWith('VDP') || item.key.startsWith('VPD')) targetFam = 'DPT';
            else if (dUpper.includes('TDPA')) targetFam = 'TDPA';
            else if (dUpper.includes('T D') || dUpper.includes('TD') || item.key.startsWith('VTD') || item.key.startsWith('VTT')) targetFam = 'TD';
            else if (dUpper.includes('VPH') || item.key.startsWith('VPH')) targetFam = 'VPH';
            else if (dUpper.includes('VARICELA') || item.key.startsWith('VAR')) targetFam = 'VARICELA';
            else if (dUpper.includes('HEPATITIS A') || item.key.startsWith('VHA')) targetFam = 'HEPATITIS_A';
            else if (dUpper.includes('INFLUENZA') || item.key.startsWith('BIE')) targetFam = 'INFLUENZA';
            else if (dUpper.includes('COVID') || item.key.startsWith('VCV')) targetFam = 'COVID';
            else if (dUpper.includes('VSR') || item.key.startsWith('VS')) targetFam = 'VSR';

            if (targetFam && _bioMotherKeys[targetFam] && !_bioMotherKeys[targetFam].includes(item.key)) {
                _bioMotherKeys[targetFam].push(item.key);
            }
        });
        if (typeof hideOverlay === 'function') hideOverlay();

        if (_importedCatalogKeys.length === 0) {
            if (typeof showToast === 'function') showToast("No se detectaron claves SIS válidas en la plantilla.", false, 'bad');
            return;
        }

        if (typeof showToast === 'function') {
            showToast(`¡Se extrajeron ${_importedCatalogKeys.length} claves del catálogo federal!`, true, 'good');
        }

        // Abrir Modal de Drag & Drop Visual
        window.openDragDropMapperModal();

    } catch (err) {
        console.error("Error al importar catálogo:", err);
        if (typeof hideOverlay === 'function') hideOverlay();
        if (typeof showToast === 'function') showToast("Error procesando archivo: " + err.message, false, 'bad');
    }
};

// Estructura oficial de Biológicos Madre ordenada según el Catálogo Federal (CE-H) 2026
const BIO_FAMILY_MAP = {
    BCG: { label: "119 BCG", doses: ["BCG"] },
    HEPATITIS_B: { label: "121 Hepatitis B", doses: ["HepB_0_7", "ADOL_HB"] },
    HEXAVALENTE: { label: "275 Hexavalente acelular", doses: ["Hexa_1", "Hexa_2", "Hexa_3", "Hexa_Ref"] },
    DPT: { label: "123 DPT", doses: ["DPT_4"] },
    ROTAVIRUS: { label: "274 Rotavirus RV1", doses: ["Rota_2"] },
    NEUMO_CONJ: { label: "125 Neumocócica Conjugada (13v)", doses: ["Neumo_1", "Neumo_2", "Neumo_Ref", "AM_NEUMO13"] },
    NEUMO_20: { label: "354 Neumocócica Conjugada (20 valente)", doses: ["Neumo_C1", "Neumo_C2", "Neumo_C3", "AM_NEUMO20"] },
    NEUMO_ADULTOS: { label: "126 Neumocócica Polisacárida (23)", doses: ["NEUMO_23"] },
    SRP: { label: "127 Triple Viral (SRP)", doses: ["SRP_1", "SRP_2", "SRP_6"] },
    SR: { label: "128 Doble Viral (SR)", doses: ["ADOL_SR"] },
    VPH: { label: "129 VPH", doses: ["ADOL_VPH"] },
    VARICELA: { label: "131 Varicela*", doses: ["VARICELA"] },
    HEPATITIS_A: { label: "122 Hepatitis A", doses: ["HEPATITIS_A"] },
    TD: { label: "132 Td", doses: ["ADOL_TD", "AM_TD"] },
    TDPA: { label: "133 Tdpa", doses: ["ADOL_TDPA", "EMB_TDPA"] },
    INFLUENZA: { label: "225 Influenza Estacional", doses: ["INFLUENZA"] },
    COVID: { label: "344 COVID-19", doses: ["COVID"] },
    VSR: { label: "355 VSR", doses: ["EMB_VSR"] }
};

let _currentDragDropStep = 1; // 1 = Biológico Madre, 2 = Dosis / Esquema
// _bioMotherKeys ya está declarado al inicio del módulo
let _selectedAvailableKeys = new Set(); // Selección múltiple para movimiento en lote

window.getAssignedDragDropKeys = function() {
    const assigned = new Set();
    if (_currentDragDropStep === 1) {
        Object.values(_bioMotherKeys).forEach(arr => arr.forEach(k => assigned.add(k)));
    } else {
        const targetBoxes = document.querySelectorAll('.drag-target-box .drop-zone-keys');
        targetBoxes.forEach(box => {
            const chips = box.querySelectorAll('span.inline-flex');
            chips.forEach(c => {
                const txt = c.childNodes[0]?.textContent?.trim();
                if (txt) assigned.add(txt);
            });
        });
    }
    return assigned;
};

window.openSisDragDropMapperModal = function() {
    window.openDragDropMapperModal();
};

window.openDragDropMapperModal = function() {
    const modal = document.getElementById('modalSisDragDropMapper');
    const yearBadge = document.getElementById('dragDropYearBadge');
    if (yearBadge) yearBadge.textContent = _currentSisMappingYear;

    // Usar la referencia aislada por año del mapeo activo
    if (!_bioMotherKeysPerYear[_currentSisMappingYear]) {
        _bioMotherKeysPerYear[_currentSisMappingYear] = {};
    }
    _bioMotherKeys = _bioMotherKeysPerYear[_currentSisMappingYear];

    Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
        if (_currentSisMappingYear === 2025 && (famKey === 'VSR' || famKey === 'NEUMO_20')) return;
        if (_currentSisMappingYear !== 2025 && famKey === 'NEUMO_ADULTOS') return;

        if (!_bioMotherKeys[famKey]) _bioMotherKeys[famKey] = [];
        BIO_FAMILY_MAP[famKey].doses.forEach(doseKey => {
            const keysInDose = (window.DICT_RDA || {})[doseKey] || [];
            keysInDose.forEach(k => {
                // Filtrar claves no pertenecientes a 2025 (VCC, VS001)
                if (_currentSisMappingYear === 2025 && (k.startsWith('VCC') || k === 'VS001')) return;
                if (!_bioMotherKeys[famKey].includes(k)) _bioMotherKeys[famKey].push(k);
            });
        });

        // Limpiar también cualquier clave no válida restante en _bioMotherKeys si es 2025
        if (_currentSisMappingYear === 2025 && Array.isArray(_bioMotherKeys[famKey])) {
            _bioMotherKeys[famKey] = _bioMotherKeys[famKey].filter(k => !k.startsWith('VCC') && k !== 'VS001');
        }
    });

    _selectedAvailableKeys.clear();
    window.switchDragDropStep(1);

    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
};

window.switchDragDropStep = function(step) {
    _currentDragDropStep = step;
    _selectedAvailableKeys.clear();

    const btn1 = document.getElementById('btnStep1');
    const btn2 = document.getElementById('btnStep2');
    const hint = document.getElementById('dragDropStepHint');
    const title = document.getElementById('rightPanelTitle');

    if (step === 1) {
        if (btn1) btn1.style.cssText = 'background-color: #0f172a !important; color: #ffffff !important; font-weight: 900;';
        if (btn2) btn2.style.cssText = 'background-color: #e2e8f0 !important; color: #334155 !important; font-weight: 700;';
        if (hint) hint.textContent = 'Paso 1: Asigna claves del catálogo federal al Biológico Madre (ej: Hexavalente, Neumococo).';
        if (title) title.textContent = 'Catálogo de Biológicos Madre (Nivel 1)';
        window.renderStep1Targets();
    } else {
        if (btn1) btn1.style.cssText = 'background-color: #e2e8f0 !important; color: #334155 !important; font-weight: 700;';
        if (btn2) btn2.style.cssText = 'background-color: #0f172a !important; color: #ffffff !important; font-weight: 900;';
        if (hint) hint.textContent = 'Paso 2: Distribuye las claves del Biológico Madre a las Dosis / Esquemas correspondientes.';
        if (title) title.textContent = 'Estructura de Dosis y Esquemas RDA (Nivel 2)';
        window.renderStep2Targets();
    }

    window.refreshDragDropAvailablePanel();
};

window.renderStep1Targets = function() {
    const targetsContainer = document.getElementById('dragDropTargetsContainer');
    if (!targetsContainer) return;

    let html = '';
    Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
        // Filtrar biológicos según reglas oficiales por año
        if (_currentSisMappingYear === 2025 && (famKey === 'VSR' || famKey === 'NEUMO_20')) return;
        if (_currentSisMappingYear !== 2025 && famKey === 'NEUMO_ADULTOS') return;

        const fam = BIO_FAMILY_MAP[famKey];
        const assignedKeys = _bioMotherKeys[famKey] || [];
        html += `
            <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 drag-target-box" data-fam="${famKey}">
                <div class="flex items-center justify-between">
                    <div class="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        ${fam.label}
                    </div>
                    <span class="text-[10px] font-bold text-slate-400">Biológico Madre</span>
                </div>

                <div class="drop-zone-keys flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl min-h-[48px] items-center"
                     ondragover="event.preventDefault(); this.classList.add('bg-indigo-50','border-indigo-400');"
                     ondragleave="this.classList.remove('bg-indigo-50','border-indigo-400');"
                     ondrop="window.handleDropOnBio(event, '${famKey}')">
                    ${assignedKeys.map(k => `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs border border-indigo-200 shadow-sm">
                            ${k}
                            <span onclick="window.removeMotherKeyChip('${famKey}', '${k}')" class="cursor-pointer text-indigo-400 hover:text-rose-600 font-bold">&times;</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    });
    targetsContainer.innerHTML = html;
};

window.renderStep2Targets = function() {
    const targetsContainer = document.getElementById('dragDropTargetsContainer');
    if (!targetsContainer) return;

    const D = window.DICT_RDA || {};
    let html = '';

    Object.keys(D).forEach(doseKey => {
        // Aislamiento estricto de biológicos por año oficial
        if (_currentSisMappingYear === 2025) {
            if (doseKey === 'AM_NEUMO20' || doseKey === 'EMB_VSR') return;
        } else {
            if (doseKey === 'NEUMO_23' || doseKey === 'SRP_6') return;
        }

        // Buscar qué familia madre posee esta dosis para asociarle sus claves
        const parentFamKey = Object.keys(BIO_FAMILY_MAP).find(fam => BIO_FAMILY_MAP[fam].doses.includes(doseKey));
        const motherKeys = parentFamKey ? (_bioMotherKeys[parentFamKey] || []) : [];

        const currentKeys = D[doseKey] || [];
        html += `
            <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 drag-target-box" data-bio="${doseKey}" data-fam="${parentFamKey || ''}">
                <div class="flex items-center justify-between">
                    <div class="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-teal-500"></span>
                        ${doseKey}
                        ${parentFamKey ? `<span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">${BIO_FAMILY_MAP[parentFamKey].label}</span>` : ''}
                    </div>
                    <span class="text-[10px] font-mono text-slate-400">Dosis / Esquema</span>
                </div>

                <div class="drop-zone-keys flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl min-h-[44px] items-center"
                     ondragover="event.preventDefault(); this.classList.add('bg-indigo-50','border-indigo-400');"
                     ondragleave="this.classList.remove('bg-indigo-50','border-indigo-400');"
                     ondrop="window.handleDropOnBio(event, '${doseKey}')">
                    ${currentKeys.map(k => `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-black text-xs border border-teal-200">
                            ${k}
                            <span onclick="window.removeKeyChip(this)" class="cursor-pointer text-teal-500 hover:text-rose-600 font-bold">&times;</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    });
    targetsContainer.innerHTML = html;
};

window.refreshDragDropAvailablePanel = function() {
    const searchVal = document.getElementById('dragDropSearchKey')?.value || '';
    const q = String(searchVal).trim().toLowerCase();

    let baseCatalog = _importedCatalogKeys;
    if (!baseCatalog || baseCatalog.length === 0) {
        const activeCat = (_currentSisMappingYear === 2025) ? MASTER_CATALOG_2025 : MASTER_CATALOG_2026;
        baseCatalog = activeCat.map(k => ({ key: k, section: `Catálogo Federal ${_currentSisMappingYear}`, desc: 'Variable Oficial SIS' }));
    }

    // En Paso 2, las disponibles son solo las claves asignadas en el Paso 1 a Biológicos Madre
    if (_currentDragDropStep === 2) {
        const motherKeysSet = new Set();
        Object.values(_bioMotherKeys).forEach(arr => arr.forEach(k => motherKeysSet.add(k)));
        baseCatalog = baseCatalog.filter(item => motherKeysSet.has(item.key));
    }

    const assigned = window.getAssignedDragDropKeys();
    const unassigned = baseCatalog.filter(item => !assigned.has(item.key));

    const availCount = document.getElementById('dragDropAvailableCount');
    if (availCount) availCount.textContent = unassigned.length;

    let displayList = unassigned;
    if (q) {
        displayList = unassigned.filter(k => k.key.toLowerCase().includes(q) || k.desc.toLowerCase().includes(q));
    }

    window.renderDragDropAvailableKeys(displayList);
    window.updateBatchToolbar();
};

window.renderDragDropAvailableKeys = function(keysList) {
    const availContainer = document.getElementById('dragDropAvailableContainer');
    if (!availContainer) return;

    if (keysList.length === 0) {
        availContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-6 font-bold">No hay claves disponibles en este paso.</div>`;
        return;
    }

    availContainer.innerHTML = keysList.map(item => {
        const isChecked = _selectedAvailableKeys.has(item.key);
        return `
            <div draggable="true" 
                 ondragstart="window.handleKeyDragStart(event, '${item.key}')"
                 class="mb-3 p-3 bg-white hover:bg-indigo-50/60 border ${isChecked ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-400' : 'border-slate-200'} rounded-2xl cursor-grab active:cursor-grabbing transition-all flex items-center justify-between shadow-sm group">
                <div class="flex items-center gap-3 flex-1 min-w-0 pr-2">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleKeySelection('${item.key}', this.checked)" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0">
                    <div class="truncate">
                        <div class="font-extrabold text-xs text-slate-800 tracking-tight">${item.key}</div>
                        <div class="text-[11px] text-slate-500 truncate mt-0.5">${item.desc}</div>
                    </div>
                </div>
                <button type="button" title="Asignar clave" onclick="window.quickAddKeyPrompt('${item.key}')"
                    style="background-color: #ffffff !important; color: #4f46e5 !important; border: 1px solid #cbd5e1 !important;"
                    class="w-7 h-7 rounded-xl font-extrabold text-sm flex items-center justify-center hover:!bg-indigo-600 hover:!text-white hover:!border-indigo-600 transition-all cursor-pointer shadow-xs flex-shrink-0 ml-2">
                    <span class="pointer-events-none">+</span>
                </button>
            </div>
        `;
    }).join('');
};

window.handleKeyDragStart = function(event, draggedKey) {
    let keysToDrag = [];
    if (_selectedAvailableKeys.has(draggedKey) && _selectedAvailableKeys.size > 1) {
        keysToDrag = Array.from(_selectedAvailableKeys);
    } else {
        keysToDrag = [draggedKey];
    }

    event.dataTransfer.setData('text/plain', JSON.stringify(keysToDrag));

    // Crear preview visual flotante para arrastrar en lote
    const dragGhost = document.createElement('div');
    dragGhost.className = 'fixed top-[-9999px] left-[-9999px] px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 border border-indigo-400 z-[9999]';
    dragGhost.innerHTML = `<span class="material-symbols-rounded text-sm">style</span> ${keysToDrag.length} clave(s) ${keysToDrag.length === 1 ? keysToDrag[0] : ''}`;
    document.body.appendChild(dragGhost);
    event.dataTransfer.setDragImage(dragGhost, 10, 10);
    setTimeout(() => dragGhost.remove(), 100);
};

window.toggleKeySelection = function(key, isChecked) {
    if (isChecked) _selectedAvailableKeys.add(key);
    else _selectedAvailableKeys.delete(key);
    window.updateBatchToolbar();
    window.refreshDragDropAvailablePanel();
};

window.toggleSelectAllAvailable = function() {
    const checkboxes = document.querySelectorAll('#dragDropAvailableContainer input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const key = cb.closest('div[draggable]').querySelector('.font-extrabold').textContent.trim();
        if (!allChecked) _selectedAvailableKeys.add(key);
        else _selectedAvailableKeys.delete(key);
    });
    window.updateBatchToolbar();
    window.refreshDragDropAvailablePanel();
};

window.updateBatchToolbar = function() {
    const toolbar = document.getElementById('batchActionToolbar');
    const label = document.getElementById('selectedCountLabel');
    if (toolbar && label) {
        if (_selectedAvailableKeys.size > 0) {
            toolbar.classList.remove('hidden');
            label.textContent = `${_selectedAvailableKeys.size} selec.`;
        } else {
            toolbar.classList.add('hidden');
        }
    }
};

window.filterDragDropKeys = function(query) {
    window.refreshDragDropAvailablePanel();
};

window.handleDropOnBio = function(event, targetKey) {
    event.preventDefault();
    const dropZone = event.currentTarget;
    dropZone.classList.remove('bg-indigo-50','border-indigo-400');
    const dataStr = event.dataTransfer.getData('text/plain');
    if (!dataStr) return;

    let keys = [];
    try {
        keys = JSON.parse(dataStr);
        if (!Array.isArray(keys)) keys = [dataStr];
    } catch (e) {
        keys = [dataStr];
    }

    keys.forEach(k => window.addKeyToTarget(targetKey, k));
    _selectedAvailableKeys.clear();
    window.updateBatchToolbar();
    window.refreshDragDropAvailablePanel();
};

window.quickAddKeyPrompt = function(key) {
    window.openBatchAssignModal([key]);
};

window.openBatchAssignModal = function(keyList = null) {
    const keysToAssign = keyList || Array.from(_selectedAvailableKeys);
    if (!keysToAssign || keysToAssign.length === 0) return;

    const summary = document.getElementById('batchAssignSummaryText');
    if (summary) summary.textContent = `Has seleccionado ${keysToAssign.length} clave(s): ${keysToAssign.join(', ')}`;

    const select = document.getElementById('batchAssignBioSelect');
    if (select) {
        let options = '';
        if (_currentDragDropStep === 1) {
            Object.keys(BIO_FAMILY_MAP).forEach(famKey => {
                options += `<option value="${famKey}">${BIO_FAMILY_MAP[famKey].label}</option>`;
            });
        } else {
            const D = window.DICT_RDA || {};
            Object.keys(D).forEach(doseKey => {
                if (_currentSisMappingYear === 2025 && doseKey === 'AM_NEUMO20') return;
                options += `<option value="${doseKey}">${doseKey}</option>`;
            });
        }
        select.innerHTML = options;
    }

    // Guardar temporalmente el lote a mover
    window._pendingBatchKeys = keysToAssign;
    const modal = document.getElementById('modalSisBatchAssign');
    if (modal) modal.classList.add('show');
};

window.confirmBatchAssign = function() {
    const select = document.getElementById('batchAssignBioSelect');
    if (!select) return;
    const targetKey = select.value;
    const keys = window._pendingBatchKeys || [];

    keys.forEach(k => window.addKeyToTarget(targetKey, k));

    _selectedAvailableKeys.clear();
    document.getElementById('modalSisBatchAssign').classList.remove('show');
    window.refreshDragDropAvailablePanel();
};

window.addKeyToTarget = function(targetKey, key) {
    if (_currentDragDropStep === 1) {
        if (!_bioMotherKeys[targetKey]) _bioMotherKeys[targetKey] = [];
        if (!_bioMotherKeys[targetKey].includes(key)) {
            _bioMotherKeys[targetKey].push(key);
            window.renderStep1Targets();
            window.refreshDragDropAvailablePanel();
        }
    } else {
        const targetBox = document.querySelector(`.drag-target-box[data-bio="${targetKey}"] .drop-zone-keys`);
        if (!targetBox) return;

        const assigned = window.getAssignedDragDropKeys();
        if (assigned.has(key)) return;

        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-black text-xs border border-teal-200';
        chip.innerHTML = `${key} <span onclick="window.removeKeyChip(this)" class="cursor-pointer text-teal-500 hover:text-rose-600 font-bold">&times;</span>`;
        targetBox.appendChild(chip);
        window.refreshDragDropAvailablePanel();
    }
};

window.removeMotherKeyChip = function(famKey, key) {
    if (_bioMotherKeys[famKey]) {
        _bioMotherKeys[famKey] = _bioMotherKeys[famKey].filter(k => k !== key);
        window.renderStep1Targets();
        window.refreshDragDropAvailablePanel();
    }
};

window.removeKeyChip = function(spanEl) {
    if (spanEl && spanEl.parentElement) {
        spanEl.parentElement.remove();
        window.refreshDragDropAvailablePanel();
    }
};

window.saveDragDropMapperResult = async function() {
    if (_currentDragDropStep === 1) {
        if (typeof showToast === 'function') showToast("Paso 1 guardado. Ahora distribuye a Dosis/Esquemas en el Paso 2.", true, 'good');
        window.switchDragDropStep(2);
        return;
    }

    const targetBoxes = document.querySelectorAll('.drag-target-box[data-bio]');
    const newMapping = {};

    targetBoxes.forEach(box => {
        const bioKey = box.dataset.bio;
        const chips = box.querySelectorAll('.drop-zone-keys span.inline-flex');
        const keys = Array.from(chips).map(c => c.childNodes[0]?.textContent?.trim()).filter(Boolean);
        newMapping[bioKey] = keys;
    });

    // 1. Actualizar diccionario en memoria global
    window.updateRdaDictionary(newMapping);

    // 2. Cerrar modal Drag & Drop
    document.getElementById('modalSisDragDropMapper').classList.remove('show');
    document.body.style.overflow = '';

    // 3. Renderizar tabla principal del Mapeador Admin
    window.renderSisMappingTable();

    // 4. Guardar inmediatamente en base de datos Supabase para el año activo
    await window.saveSisMappingUi();
};

window.clearRegistrosSisTable = async function(anioFilter = null) {
    const confirmMsg = anioFilter 
        ? `¿Estás seguro de vaciar los registros del año ${anioFilter} en la base de datos registros_sis?`
        : `⚠️ ¡ATENCIÓN! ¿Estás seguro de VACIA Y PURGAR COMPLETAMENTE la tabla 'registros_sis' de Supabase para comenzar desde cero?`;
    
    if (!confirm(confirmMsg)) return;

    if (typeof showOverlay === 'function') showOverlay("Limpiando tabla registros_sis...", "Base de Datos");
    try {
        let query = window.supabase.from('registros_sis').delete();
        if (anioFilter) {
            query = query.eq('anio', anioFilter);
        } else {
            query = query.neq('mes', -1); // Borrar todos los registros
        }

        const { error } = await query;
        if (error) throw error;

        if (typeof showToast === 'function') showToast("¡Tabla registros_sis limpiada con éxito!", true, 'good');
        if (typeof window.refreshRDADashboard === 'function') window.refreshRDADashboard();
    } catch (err) {
        console.error("Error purgando registros_sis:", err);
        if (typeof showToast === 'function') showToast("Error al vaciar tabla: " + err.message, false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};

window.closeModalAndUnlockBody = function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('show');
    const openModals = document.querySelectorAll('div[id^="modal"].show, div[id^="modal"][class*="show"]');
    if (!openModals || openModals.length <= 1) {
        document.body.style.overflow = '';
    }
};

// Cadenas de dosis secuenciales reales disponibles en sis_variables_mapeo (verificadas contra la
// BD, no asumidas). Se excluyen deliberadamente Td/Tdpa/adulto: sus claves son "ocasión de
// visita" (varias vías OR'd), no una secuencia real de dosis 1→2→3, y forzarlas en un funnel
// representaría mal el dato.
const ABANDONO_CHAINS = [
    { label: 'Hexavalente', color: '#2563eb', steps: [
        { key: 'hexa_1', label: 'Dosis 1' }, { key: 'hexa_2', label: 'Dosis 2' },
        { key: 'hexa_3', label: 'Dosis 3' }, { key: 'hexa_ref', label: 'Refuerzo' }
    ]},
    { label: 'Neumococo 13-valente', color: '#f59e0b', steps: [
        { key: 'neumo_1', label: 'Dosis 1' }, { key: 'neumo_2', label: 'Dosis 2' }, { key: 'neumo_ref', label: 'Refuerzo' }
    ]},
    // Serie separada de la anterior a propósito: son dos formulaciones distintas (13-valente
    // vs. 20-valente, confirmado contra sis_variables_mapeo: VAC17-19/VNC0x = 13-valente,
    // VCC0x = 20-valente), no serían comparables si se sumaran juntas.
    { label: 'Neumococo 20-valente', color: '#d97706', steps: [
        { key: 'neumo_c1', label: 'Dosis 1' }, { key: 'neumo_c2', label: 'Dosis 2' }, { key: 'neumo_c3', label: 'Dosis 3' }
    ]},
    { label: 'Rotavirus', color: '#16a34a', steps: [
        { key: 'rota_1', label: 'Dosis 1' }, { key: 'rota_2', label: 'Dosis 2' }
    ]},
    { label: 'SRP', color: '#7c3aed', steps: [
        { key: 'srp_1', label: 'Dosis 1' }, { key: 'srp_2', label: 'Dosis 2' }
    ]}
];

// Panel de Continuidad / Abandono de Esquema — análisis AGREGADO (dosis-N ÷ dosis-1 del
// periodo), no seguimiento del mismo paciente: registros_sis no tiene identificador de
// paciente, es un conteo mensual por unidad. Se integra como esquema independiente dentro
// del propio dashboard de Indicadores (mismo patrón que renderComparativaMultianual), sin
// tocar ni reemplazar el cálculo de ningún otro esquema.
async function renderAbandonoEsquema(muniFilter, uniFilter) {
    const container = document.getElementById('rdaDashboardContent');
    if (!container) return;

    if (!window._isBatchExporting && typeof showOverlay === 'function') {
        showOverlay("Calculando continuidad de esquema...", "Análisis de Continuidad");
    }

    try {
        const anio = _rdaCache.anio || new Date().getFullYear();
        const maxMes = _rdaCache.maxMes || 12;

        const { data, error } = await window.supabase.rpc('get_rda_abandono_esquema', { p_anio: anio, p_max_mes: maxMes });
        if (error) throw error;

        let rows = data || [];
        if (muniFilter) rows = rows.filter(r => (r.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
        if (uniFilter) rows = rows.filter(r => r.clues === uniFilter);

        // Totales agregados (jurisdicción o filtro actual) por cada paso de cada cadena
        const chainTotals = ABANDONO_CHAINS.map(chain => ({
            ...chain,
            totals: chain.steps.map(s => rows.reduce((a, r) => a + (Number(r[s.key]) || 0), 0))
        }));

        // Mayor caída relativa por unidad (para la tabla de hallazgos) — solo evalúa unidades
        // con al menos 1 aplicación en el primer paso de la cadena, para no dividir entre cero
        // ni destacar unidades sin volumen real.
        const worstDrops = [];
        rows.forEach(r => {
            let worst = null;
            ABANDONO_CHAINS.forEach(chain => {
                for (let i = 1; i < chain.steps.length; i++) {
                    const prevKey = chain.steps[i - 1].key;
                    const curKey = chain.steps[i].key;
                    const prevVal = Number(r[prevKey]) || 0;
                    const curVal = Number(r[curKey]) || 0;
                    if (prevVal <= 0) continue;
                    const dropPct = ((prevVal - curVal) / prevVal) * 100;
                    if (!worst || dropPct > worst.dropPct) {
                        worst = { chain: chain.label, from: chain.steps[i - 1].label, to: chain.steps[i].label, prevVal, curVal, dropPct };
                    }
                }
            });
            if (worst && worst.dropPct > 0) {
                worstDrops.push({ clues: r.clues, unidad: r.nombre, municipio: r.municipio, ...worst });
            }
        });
        worstDrops.sort((a, b) => b.dropPct - a.dropPct);

        const scopeLabel = uniFilter ? (rows[0]?.nombre || uniFilter) : (muniFilter ? `Municipio: ${muniFilter}` : 'Jurisdicción Sanitaria 1 (4 Municipios)');

        const chainRowsHtml = chainTotals.map(chain => {
            const stepsHtml = chain.steps.map((s, i) => {
                const total = chain.totals[i];
                const prevTotal = i === 0 ? null : chain.totals[i - 1];
                const rate = (i === 0 || !prevTotal) ? null : (total / prevTotal * 100);
                const desercion = rate === null ? null : Math.max(0, 100 - rate);
                return `
                    <td style="text-align:center; padding:8px 10px;">
                        <div style="font-weight:800; font-size:14px; color:#0f172a;">${total.toLocaleString('es-MX')}</div>
                        ${desercion !== null ? `<div style="font-size:10.5px; font-weight:700; color:${rate < 70 ? '#dc2626' : rate < 90 ? '#d97706' : '#16a34a'};">Deserción: ${desercion.toFixed(1)}%</div>` : '<div style="font-size:10.5px; color:#94a3b8;">Base (Dosis 1)</div>'}
                    </td>`;
            }).join('');
            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 10px; font-weight:800; font-size:12.5px; color:${chain.color};">${chain.label}</td>
                    ${stepsHtml}
                    ${chain.steps.length < 4 ? '<td></td>'.repeat(4 - chain.steps.length) : ''}
                </tr>`;
        }).join('');

        const worstDropsHtml = worstDrops.slice(0, 30).map(w => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px; font-size:12px; color:#475569;">${w.municipio || ''}</td>
                <td style="padding:7px 10px; font-size:12.5px; font-weight:700; color:#0f172a;">${w.unidad || w.clues}</td>
                <td style="padding:7px 10px; font-size:12px; color:#475569;">${w.chain}: ${w.from} → ${w.to}</td>
                <td style="padding:7px 10px; font-size:12px; color:#475569; text-align:center;">${w.prevVal} → ${w.curVal}</td>
                <td style="padding:7px 10px; text-align:center;"><span style="font-weight:800; font-size:12.5px; color:${w.dropPct >= 50 ? '#dc2626' : '#d97706'};">-${w.dropPct.toFixed(1)}%</span></td>
            </tr>`).join('');

        container.innerHTML = `
            <div style="padding:24px;">
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:14px; padding:14px 18px; margin-bottom:20px; display:flex; gap:12px; align-items:flex-start;">
                    <span class="material-symbols-rounded" style="color:#d97706; font-size:22px;">info</span>
                    <div style="font-size:12.5px; font-weight:700; color:#78350f; line-height:1.5;">
                        Índice de deserción según la metodología de supervisión del <strong>Manual de Vacunación 2021</strong>
                        (evaluación de tasas de deserción entre dosis, ej. DTP1/BCG vs. DTP3/Sarampión), aplicada aquí a cada
                        paso de dosis disponible. Es una <strong>razón agregada</strong> (total de dosis-N ÷ total de dosis-1
                        del periodo evaluado), <strong>no es seguimiento del mismo paciente</strong> — los registros de SIS son
                        conteos mensuales por unidad, no expedientes individuales. Úsalo para identificar en qué paso de cada
                        esquema se concentra la deserción, no como "cuántos pacientes abandonaron literalmente".
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <h3 style="margin:0; font-size:16px; font-weight:900; color:#0f172a;">Índice de Deserción por Cadena de Dosis</h3>
                        <span style="font-size:12px; font-weight:700; color:#64748b;">${scopeLabel} · ${anio}, Enero a ${MONTH_NAMES[maxMes - 1] || maxMes}</span>
                    </div>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; margin-bottom:16px;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="text-align:left; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Cadena</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Paso 1</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Paso 2</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Paso 3</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Paso 4</th>
                            </tr>
                        </thead>
                        <tbody>${chainRowsHtml}</tbody>
                    </table>
                </div>

                <div id="abandonoChartContainer" style="width:100%; height:360px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; margin-bottom:16px;"></div>

                <h4 style="margin:0 0 10px; font-size:14px; font-weight:900; color:#0f172a;">Mayor índice de deserción por unidad (Top 30)</h4>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="text-align:left; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Municipio</th>
                                <th style="text-align:left; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Unidad</th>
                                <th style="text-align:left; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Paso con mayor deserción</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Dosis</th>
                                <th style="text-align:center; padding:8px 10px; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Deserción</th>
                            </tr>
                        </thead>
                        <tbody>${worstDropsHtml || '<tr><td colspan="5" style="padding:20px; text-align:center; color:#94a3b8;">Sin datos suficientes para calcular deserción en este filtro.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;

        setTimeout(() => {
            const chartDom = document.getElementById('abandonoChartContainer');
            if (chartDom && typeof echarts !== 'undefined') {
                if (_rdaCharts.abandono) { try { _rdaCharts.abandono.dispose(); } catch(e){} _rdaCharts.abandono = null; }
                const chart = echarts.init(chartDom, null, { renderer: 'canvas' });
                _rdaCharts.abandono = chart;

                const categories = [];
                const values = [];
                const colors = [];
                chainTotals.forEach(chain => {
                    chain.steps.forEach((s, i) => {
                        categories.push(`${chain.label} — ${s.label}`);
                        values.push(chain.totals[i]);
                        colors.push(chain.color);
                    });
                });

                chart.setOption({
                    grid: { left: '3%', right: '4%', bottom: '3%', top: 20, containLabel: true },
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    xAxis: { type: 'value', axisLabel: { fontFamily: 'Inter, sans-serif' } },
                    yAxis: { type: 'category', data: categories, inverse: true, axisLabel: { fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700 } },
                    series: [{
                        type: 'bar',
                        data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [0, 6, 6, 0] } })),
                        label: { show: true, position: 'right', fontWeight: 800, fontSize: 11 },
                        barWidth: '55%'
                    }]
                });

                if (!window._rdaEchartsResizeAttached) {
                    window.addEventListener('resize', () => {
                        if (_rdaCharts.b) _rdaCharts.b.resize();
                        if (_rdaCharts.total) _rdaCharts.total.resize();
                        if (_rdaCharts.d) _rdaCharts.d.resize();
                        if (_rdaCharts.comparativa) { try { _rdaCharts.comparativa.resize(); } catch(e){} }
                        if (_rdaCharts.abandono) { try { _rdaCharts.abandono.resize(); } catch(e){} }
                    });
                    window._rdaEchartsResizeAttached = true;
                }
            }
        }, 100);

    } catch (e) {
        console.error("Error cargando análisis de continuidad de esquema:", e);
        container.innerHTML = `<div style="padding: 32px; color: #ef4444; font-weight: 700;">Error al generar análisis de continuidad: ${e.message}</div>`;
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
}

// Panel Único de Comparativa Multianual Executive (2025 vs 2026)
async function renderComparativaMultianual(muniFilter, uniFilter) {
    const container = document.getElementById('rdaDashboardContent');
    if (!container) return;

    if (!window._isBatchExporting && typeof showOverlay === 'function') {
        showOverlay("Cargando Diagnóstico Multianual (2025 vs 2026)...", "Análisis Avanzado");
    }

    try {
        const valTemp = String((_rdaState && _rdaState.corteTemporal) || '0');
        const isTotalAnual = (valTemp === '0');
        let maxMes2026 = _rdaCache.maxMes || 12;

        if (valTemp === 'T1') maxMes2026 = 3;
        else if (valTemp === 'T2') maxMes2026 = 6;
        else if (valTemp === 'T3') maxMes2026 = 9;
        else if (valTemp === 'T4') maxMes2026 = 12;
        else if (!isNaN(parseInt(valTemp, 10)) && parseInt(valTemp, 10) > 0) {
            maxMes2026 = parseInt(valTemp, 10);
        }

        const maxMes2025 = isTotalAnual ? 12 : maxMes2026;
        const maxMesName = MONTH_NAMES[maxMes2026 - 1] || 'FINAL';
        
        // Consultar agregaciones 2025 (12 meses o corte homólogo) y 2026 simultáneamente
        const { data: ind2025, error: err2025 } = await window.supabase.rpc('get_rda_indicators', { p_anio: 2025, p_max_mes: maxMes2025 });
        const { data: ind2026, error: err2026 } = await window.supabase.rpc('get_rda_indicators', { p_anio: 2026, p_max_mes: maxMes2026 });

        if (err2025) throw err2025;
        if (err2026) throw err2026;

        let raw2025 = ind2025 || [];
        let raw2026 = ind2026 || [];

        // Fallback de rescate directo con catálogo completo de claves SIS 2025 históricas
        if (raw2025.length > 0) {
            try {
                const keysTdComplete = [
                    'VAC39','VAC40','VAC43','VAC46','VAC47','VAC48','VAC51','VAC54','VAC55','VAC56','VAC59','VAC62',
                    'VTD01','VTD02','VTD03','VTD05','VTD07','VTD09','VTD11','VTD13','VTD14','VTD16','VTD19','VTD20',
                    'VTD21','VTD22','VTD23','VTD24','VTD25','VTD26','VTD27','VTD28','VTD29','VTD30','VTD31','VTD32',
                    'VTD33','VTD34','VTD35','VTD36','VTT01','VTT02','VTT03','VTT04','VTT05','VTT06','VTT07','VTT08',
                    'VTT09','VTT10','VTT11','VTT12'
                ];
                const keysNeumoAm   = ['VAC93', 'VAC94', 'VNC04']; // AM_NEUMO13 (Neumo 13 Conjugada - Adultos Mayores)
                const keysNeumo23   = ['VNP01'];                     // NEUMO_23 (Neumo 23 Polisacárida - 2025)
                const keysSrAdol = ['VAC83','VDV01','VDV02','VDV03','VDV04','VDV05','VDV06'];
                const allKeysQuery = [...new Set([...keysTdComplete, ...keysNeumoAm, ...keysNeumo23, ...keysSrAdol])];

                const { data: rawSis2025 } = await window.supabase
                    .from('registros_sis')
                    .select('clues, variable_sis, valor')
                    .eq('anio', 2025)
                    .lte('mes', maxMes2025)
                    .in('variable_sis', allKeysQuery);
                
                if (rawSis2025 && rawSis2025.length > 0) {
                    const sisByClues = {};
                    rawSis2025.forEach(r => {
                        if (!sisByClues[r.clues]) sisByClues[r.clues] = { neumo13: 0, neumo23: 0, tdTotal: 0, sr: 0 };
                        const v = (r.variable_sis || '').toUpperCase().trim();
                        const val = Number(r.valor) || 0;
                        if (keysNeumoAm.includes(v))   sisByClues[r.clues].neumo13 += val;
                        if (keysNeumo23.includes(v))   sisByClues[r.clues].neumo23 += val;
                        if (keysTdComplete.includes(v)) sisByClues[r.clues].tdTotal += val;
                        if (keysSrAdol.includes(v))    sisByClues[r.clues].sr += val;
                    });

                    raw2025.forEach(u => {
                        if (sisByClues[u.clues]) {
                            if (sisByClues[u.clues].neumo13 > 0) u.am_neumo13 = sisByClues[u.clues].neumo13;
                            if (sisByClues[u.clues].neumo23 > 0) u.neumo_23   = sisByClues[u.clues].neumo23;
                            if (sisByClues[u.clues].tdTotal > 0) {
                                if (!u.am_td   || u.am_td   < sisByClues[u.clues].tdTotal) u.am_td   = sisByClues[u.clues].tdTotal;
                                if (!u.adol_td || u.adol_td < sisByClues[u.clues].tdTotal) u.adol_td = sisByClues[u.clues].tdTotal;
                            }
                            if (sisByClues[u.clues].sr > 0) u.adol_sr = sisByClues[u.clues].sr;
                        }
                    });
                }
            } catch (err2025Sis) {
                console.warn('[RDA 2025 SIS Fallback Warning]', err2025Sis);
            }
        }

        // Normalizador universal de municipios para evitar pérdidas por tildes o variaciones de nombre
        const _normMuni = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const matchMuni = (uMuni, targetMuni) => {
            const uNorm = _normMuni(uMuni);
            const tNorm = _normMuni(targetMuni);
            if (tNorm.includes('MARQUES') && uNorm.includes('MARQUES')) return true;
            if (tNorm.includes('QUERETARO') && uNorm.includes('QUERETARO')) return true;
            return uNorm === tNorm;
        };

        // Filtrado dinámico
        let u2025 = raw2025;
        let u2026 = raw2026;

        if (muniFilter) {
            u2025 = u2025.filter(u => matchMuni(u.municipio, muniFilter));
            u2026 = u2026.filter(u => matchMuni(u.municipio, muniFilter));
        }
        if (uniFilter) {
            u2025 = u2025.filter(u => u.clues === uniFilter);
            u2026 = u2026.filter(u => u.clues === uniFilter);
        }

        // Función totalizadora segura con evaluación de meses específica por año
        const calcTotals = (arr, evalMes = maxMes2026) => {
            let r = {
                pM1: 0, p1A: 0, p4A: 0, p6A: 0,
                bcg: 0, hepb: 0, rota: 0, hexaM1: 0, hexa1A: 0, neumoM1: 0, neumo1A: 0, srp1: 0, srp2: 0, dpt: 0, srp6: 0,
                adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                am_neumo13: 0, am_neumo20: 0, am_td: 0,
                emb_tdpa: 0, emb_vsr: 0,
                inv_influenza: 0, inv_covid: 0
            };
            for (const u of arr) {
                r.pM1 += u.pob_menor_1 || 0; r.p1A += u.pob_1_ano || 0; r.p4A += u.pob_4_anos || 0; r.p6A += u.pob_6_anos || 0;
                r.bcg += u.bcg_dosis || 0; r.hepb += u.hepb_0_7_dosis || 0; r.rota += u.rota_2_dosis || 0;
                r.hexaM1 += (u.hexa_1_dosis||0) + (u.hexa_2_dosis||0) + (u.hexa_3_dosis||0);
                r.hexa1A += u.hexa_ref_dosis || 0;
                r.neumoM1 += (u.neumo_1_dosis||0) + (u.neumo_2_dosis||0) + (u.neumo_c1_dosis||0) + (u.neumo_c2_dosis||0);
                r.neumo1A += (u.neumo_ref_dosis||0) + (u.neumo_c3_dosis||0);
                r.srp1 += u.srp_1_dosis || 0; r.srp2 += u.srp_2_dosis || 0; r.dpt += u.dpt_4_dosis || 0; r.srp6 += u.srp_6_dosis || 0;

                r.adol_hb += u.adol_hb || 0;
                r.adol_sr += u.adol_sr || 0;
                r.adol_vph += u.adol_vph || 0;
                r.adol_td += u.adol_td || 0;
                r.adol_tdpa += u.adol_tdpa || 0;

                r.am_neumo13 += u.am_neumo13 || 0;
                r.am_neumo20 += u.am_neumo20 || 0;
                r.am_td += u.am_td || 0;

                r.emb_tdpa += u.emb_tdpa || 0;
                r.emb_vsr += u.emb_vsr || 0;

                r.inv_influenza += u.inv_influenza || 0;
                r.inv_covid += u.inv_covid || 0;
            }
            const fM1 = (r.pM1 * 0.0833) * evalMes;
            const f1A = (r.p1A * 0.0833) * evalMes;
            const f4A = (r.p4A * 0.0833) * evalMes;
            const f6A = ((r.p6A || r.p4A) * 0.0833) * evalMes;

            const dosisM1 = r.bcg + r.hepb + r.hexaM1 + r.rota + r.neumoM1;
            const dosis1A = r.hexa1A + r.neumo1A + r.srp2;
            const dosis4A = r.dpt;
            const dosis6A = r.srp6;

            r.covM1 = fM1 > 0 ? Math.round((((dosisM1 / 4.0) / fM1) * 100) * 10) / 10 : 0;
            r.cov1A = f1A > 0 ? Math.round((((dosis1A / 3.0) / f1A) * 100) * 10) / 10 : 0;
            r.cov4A = f4A > 0 ? Math.round(((dosis4A / f4A) * 100) * 10) / 10 : 0;
            r.cov6A = f6A > 0 ? Math.round(((dosis6A / f6A) * 100) * 10) / 10 : 0;

            r.appBCG = r.bcg; r.appHepB = r.hepb; r.appRota = r.rota; r.appHexaM1 = r.hexaM1;
            r.appHexa1A = r.hexa1A; r.appNeumoM1 = r.neumoM1; r.appNeumo1A = r.neumo1A; r.appSRP = r.srp1 + r.srp2; r.appDPT = r.dpt; r.appSRP6 = r.srp6;

            r.covBCG = fM1 > 0 ? Math.round((r.appBCG / fM1 * 100) * 10) / 10 : 0;
            r.covHepB = fM1 > 0 ? Math.round((r.appHepB / fM1 * 100) * 10) / 10 : 0;
            r.covRota = fM1 > 0 ? Math.round((r.appRota / fM1 * 100) * 10) / 10 : 0;
            r.covHexaM1 = fM1 > 0 ? Math.round((r.appHexaM1 / fM1 * 100) * 10) / 10 : 0;
            r.covHexa1A = f1A > 0 ? Math.round((r.appHexa1A / f1A * 100) * 10) / 10 : 0;
            r.covNeumoM1 = fM1 > 0 ? Math.round((r.appNeumoM1 / fM1 * 100) * 10) / 10 : 0;
            r.covNeumo1A = f1A > 0 ? Math.round((r.appNeumo1A / f1A * 100) * 10) / 10 : 0;
            r.covSRP = f1A > 0 ? Math.round((r.appSRP / f1A * 100) * 10) / 10 : 0;
            r.covDPT = f4A > 0 ? Math.round((r.appDPT / f4A * 100) * 10) / 10 : 0;
            r.covSRP6 = f6A > 0 ? Math.round((r.appSRP6 / f6A * 100) * 10) / 10 : 0;

            return r;
        };

        const t25 = calcTotals(u2025, maxMes2025);
        const t26 = calcTotals(u2026, maxMes2026);

        // Agrupación de Municipios de la JS1 con comparación segura
        const munisJS1 = ['CORREGIDORA', 'HUIMILPAN', 'EL MARQUÉS', 'QUERÉTARO'];
        const compMunis = munisJS1.map(m => {
            const arr25 = raw2025.filter(u => matchMuni(u.municipio, m));
            const arr26 = raw2026.filter(u => matchMuni(u.municipio, m));
            return {
                nombre: m,
                t25: calcTotals(arr25, maxMes2025),
                t26: calcTotals(arr26, maxMes2026)
            };
        });

        // Función helper para renderizar celdas con ícono + barra (misma opción que
        // ya se usa en la tabla principal de Indicadores RDA, ver badge() más arriba).
        // Nada de chips: mismo motivo documentado abajo (html2canvas no las exporta bien).
        const renderOption8Coverage = (pctVal, isPrimary2026 = false) => {
            const pct = typeof pctVal === 'number' ? pctVal : (parseFloat(pctVal) || 0);
            let statusLabel = 'ÓPTIMO';
            let statusColor = '#15803d';
            let statusIcon = '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>';
            if (pct < 80) {
                statusLabel = 'CRÍTICO';
                statusColor = '#dc2626';
                statusIcon = '<path d="M12 3l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="16.6" r=".6" fill="currentColor" stroke="none"/>';
            } else if (pct < 95) {
                statusLabel = 'REGULAR';
                statusColor = '#d97706';
                statusIcon = '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r=".6" fill="currentColor" stroke="none"/>';
            }
            const mainColor = isPrimary2026 ? '#0284c7' : '#0f172a';
            const barPct = Math.max(0, Math.min(100, pct));
            return `
                <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px;" title="${statusLabel}">
                    <div style="display: inline-flex; align-items: center; gap: 5px;">
                        <span style="display: flex; align-items: center; justify-content: center; color: ${statusColor}; flex-shrink: 0;">
                            <svg viewBox="0 0 24 24" width="13" height="13" style="fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;">${statusIcon}</svg>
                        </span>
                        <span style="font-size: 13px; font-weight: 900; color: ${mainColor}; line-height: 1.2;">${pct}%</span>
                    </div>
                    <span style="display: block; width: 48px; height: 4px; border-radius: 2px; background: #eef1f6; overflow: hidden;">
                        <span style="display: block; height: 100%; border-radius: 2px; width: ${barPct}%; background: ${statusColor};"></span>
                    </span>
                </div>
            `;
        };

        // Semáforo comparativo dinámico sin chips (Opción 8: Cifra + Subtexto)
        const getCompBadgeHtml = (cov2025, cov2026) => {
            const diff = Math.round((cov2026 - cov2025) * 10) / 10;
            if (diff > 0) {
                return `
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <div style="font-size: 12.5px; font-weight: 900; color: #15803d; line-height: 1.2;">▲ +${diff}%</div>
                        <div style="font-size: 9px; font-weight: 800; color: #166534; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">AVANCE SUPERIOR</div>
                    </div>
                `;
            } else if (diff >= -3) {
                return `
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <div style="font-size: 12.5px; font-weight: 900; color: #334155; line-height: 1.2;">● ${diff}%</div>
                        <div style="font-size: 9px; font-weight: 800; color: #475569; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">DESEMPEÑO SIMILAR</div>
                    </div>
                `;
            } else {
                return `
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <div style="font-size: 12.5px; font-weight: 900; color: #b91c1c; line-height: 1.2;">▼ ${diff}%</div>
                        <div style="font-size: 9px; font-weight: 800; color: #dc2626; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">AVANCE MENOR</div>
                    </div>
                `;
            }
        };

        // Título y ámbito dinámico con alta jerarquía visual executive en sobrio tono slate
        // Sin chips/píldoras: texto plano con ícono al frente, sin fondo ni border-radius. Los
        // chips con fondo+flex-centrado son los que html2canvas nunca logra alinear bien al
        // exportar; texto plano en línea no tiene ese problema (nada que centrar dentro de una caja).
        let scopeHtml = '';
        if (uniFilter) {
            const uM = (_rdaCache.unidades||[]).find(x => x.clues === uniFilter);
            const mName = uM?.municipio || muniFilter || 'QUERÉTARO';
            const uName = uM?.nombre || 'UNIDAD MÉDICA';
            scopeHtml = `
                <div style="margin-top: 8px; font-size: 11.5px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.03em;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: -2px;">location_city</span> MUNICIPIO: ${mName.toUpperCase()}
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: -2px;">local_hospital</span> UNIDAD: ${uName.toUpperCase()} — ${uniFilter}
                </div>
            `;
        } else if (muniFilter) {
            scopeHtml = `
                <div style="margin-top: 8px; font-size: 11.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: -2px;">location_city</span> MUNICIPIO: ${muniFilter.toUpperCase()}
                </div>
            `;
        } else {
            scopeHtml = `
                <div style="margin-top: 8px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: -2px;">domain</span> JURISDICCIÓN SANITARIA 1 (QUERÉTARO)
                </div>
            `;
        }

        // Helpers para evaluación dinámica y renderizado de Cards KPI
        const getPeriodoText = (m) => {
            const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const mVal = Math.min(Math.max(parseInt(m, 10) || 12, 1), 12);
            const mName = monthsShort[mVal - 1];
            let trimStr = '1er trimestre';
            if (mVal >= 10) trimStr = '4to trimestre';
            else if (mVal >= 7) trimStr = '3er trimestre';
            else if (mVal >= 4) trimStr = '2do trimestre';
            return mVal === 1 ? `Evaluado de Ene (${trimStr})` : `Evaluado de Ene-${mName} (${trimStr})`;
        };

        const renderKpiCard = (title, cov25, cov26) => {
            const diff = Math.round((cov26 - cov25) * 10) / 10;
            const isUp = diff >= 0;
            const absDiff = Math.abs(diff);
            const themeColor = isUp ? '#059669' : '#dc2626';
            const themeBg = isUp ? '#ecfdf5' : '#fef2f2';
            const themeBorder = isUp ? '#a7f3d0' : '#fecdd3';
            const gradFill = isUp ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f43f5e, #dc2626)';

            return `
                <div style="background: #ffffff; border-radius: 20px; padding: 22px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15,23,42,0.04); position: relative; overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(15,23,42,0.08)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(15,23,42,0.04)';">
                    <div style="font-size: 11.5px; font-weight: 900; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                        <span>${title}</span>
                        <span style="font-size: 10px; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px;">COMPARATIVO</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; align-items: baseline;">
                        <!-- AÑO 2025 (Soft Slate) -->
                        <div style="background: #f8fafc; padding: 10px 12px; border-radius: 12px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; display: block;">AÑO 2025</span>
                            <div style="font-size: 21px; font-weight: 800; color: #475569; margin-top: 2px;">${cov25}%</div>
                        </div>
                        <!-- AÑO 2026 (Electric Vibrant Blue) -->
                        <div style="background: #f0f9ff; padding: 10px 12px; border-radius: 12px; border: 1px solid #bae6fd;">
                            <span style="font-size: 10px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.04em;">AÑO 2026 <span style="font-size: 9px;">⚡</span></span>
                            <div style="font-size: 25px; font-weight: 900; color: #0369a1; margin-top: 2px;">${cov26}%</div>
                        </div>
                    </div>

                    <!-- SEMAFORIZADO DINÁMICO ANIMADO -->
                    <div style="margin-top: 14px; padding: 10px 12px; border-radius: 12px; background: ${themeBg}; border: 1px solid ${themeBorder}; display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 22px; height: 22px; border-radius: 50%; background: ${themeColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px ${isUp ? 'rgba(16,185,129,0.4)' : 'rgba(220,38,38,0.4)'};">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                                        ${isUp ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>' : '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>'}
                                    </svg>
                                </div>
                                <span style="font-size: 12.5px; font-weight: 900; color: ${themeColor};">${isUp ? '+' : ''}${diff}% pts</span>
                            </div>
                            <span style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 6px; background: #ffffff; color: ${themeColor}; border: 1px solid ${themeBorder};">
                                ${isUp ? 'AVANCE SUPERIOR' : 'DECREMENTO'}
                            </span>
                        </div>
                        <div style="width: 100%; height: 5px; background: rgba(0,0,0,0.06); border-radius: 999px; overflow: hidden;">
                            <div style="height: 100%; width: ${Math.min(100, Math.max(10, absDiff * 2.5))}%; background: ${gradFill}; border-radius: 999px; transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                </div>
            `;
        };

        // Generar HTML Executive con paleta Slate Sobria y Alineación a la Izquierda estricta
        container.innerHTML = `
            <div style="background: #ffffff; border-radius: 24px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.04); font-family: Inter, system-ui, sans-serif;">
                
                <!-- HEADER EXECUTIVE -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #0f172a; color: white; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; letter-spacing: 0.05em;">EXECUTIVE COMPARATIVE SUITE</span>
                            <span style="font-size: 12px; font-weight: 800; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 5px 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(2,132,199,0.08);">${getPeriodoText(maxMes2026)}</span>
                        </div>
                        <h2 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em;">
                            Comparativa Multianual de Cobertura Vacunal (2025 vs 2026)
                        </h2>
                        ${scopeHtml}
                    </div>
                </div>

                <!-- CARDS DE DIAGNÓSTICO ESTRATÉGICO COMPARATIVO EN SOBRIO GRIS Y SLATE -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-bottom: 32px;">
                    ${renderKpiCard('Menores de 1 Año (<1)', t25.covM1, t26.covM1)}
                    ${renderKpiCard('Niños de 1 Año (1)', t25.cov1A, t26.cov1A)}
                    ${renderKpiCard('Niños de 4 Años (4)', t25.cov4A, t26.cov4A)}
                </div>

                <!-- HISTOGRAMA GRÁFICO DUAL EN TONOS PIZARRA SOBRIOS (SLATE) -->
                <div style="background: #ffffff; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(15,23,42,0.03); margin-bottom: 32px;">
                    <div id="chartComparativeMulti" style="width: 100%; height: 400px;"></div>
                </div>

                <!-- TABLA 1: DESGLOSE POR MUNICIPIOS (Solo se despliega en el Concentrado Jurisdiccional) -->
                ${(!muniFilter && !uniFilter) ? `
                <div style="margin-bottom: 32px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded" style="color: #0f172a; font-size: 20px;">location_on</span> Comportamiento por Municipio (Avance 2025 vs 2026 | ${getPeriodoText(maxMes2026)})
                    </h3>
                    <div style="border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff; box-shadow: 0 4px 20px rgba(15,23,42,0.03);">
                        <table style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 11.5px;">
                            <colgroup>
                                <col style="width: 22%;">
                                <col style="width: 9%;">
                                <col style="width: 9%;">
                                <col style="width: 9%;">
                                <col style="width: 9%;">
                                <col style="width: 9%;">
                                <col style="width: 9%;">
                                <col style="width: 24%;">
                            </colgroup>
                            <thead style="position: sticky; top: 0; z-index: 20; background: #f8fafc;">
                                <tr style="background: #f8fafc; font-weight: 900; color: #334155; border-bottom: 1px solid #e2e8f0;">
                                    <th style="padding: 12px 14px; text-align: left; border-right: 1px solid #f1f5f9; position: sticky; top: 0; background: #f8fafc; z-index: 20;">MUNICIPIO</th>
                                    <th style="padding: 12px 10px; text-align: left; border-right: 1px solid #f1f5f9; position: sticky; top: 0; background: #f8fafc; z-index: 20;" colspan="2">< 1 AÑO</th>
                                    <th style="padding: 12px 10px; text-align: left; border-right: 1px solid #f1f5f9; position: sticky; top: 0; background: #f8fafc; z-index: 20;" colspan="2">1 AÑO</th>
                                    <th style="padding: 12px 10px; text-align: left; border-right: 1px solid #f1f5f9; position: sticky; top: 0; background: #f8fafc; z-index: 20;" colspan="2">4 AÑOS</th>
                                    <th style="padding: 12px 12px; text-align: left; position: sticky; top: 0; background: #f8fafc; z-index: 20;">TENDENCIA GLOBAL</th>
                                </tr>
                                <tr style="background: #f1f5f9; font-weight: 800; color: #64748b; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 8px 14px; text-align: left; border-right: 1px solid #e2e8f0; position: sticky; top: 37px; background: #f1f5f9; z-index: 20;">JS1 QUERÉTARO</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #64748b; font-weight: 800; position: sticky; top: 37px; background: #f1f5f9; z-index: 20;">2025</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #e2e8f0; position: sticky; top: 37px; z-index: 20;">2026 ⚡</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #64748b; font-weight: 800; position: sticky; top: 37px; background: #f1f5f9; z-index: 20;">2025</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #e2e8f0; position: sticky; top: 37px; z-index: 20;">2026 ⚡</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #64748b; font-weight: 800; position: sticky; top: 37px; background: #f1f5f9; z-index: 20;">2025</th>
                                    <th style="padding: 8px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #e2e8f0; position: sticky; top: 37px; z-index: 20;">2026 ⚡</th>
                                    <th style="padding: 8px 12px; text-align: left; position: sticky; top: 37px; background: #f1f5f9; z-index: 20;">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${compMunis.map(m => {
                                    const isPositive = (m.t26.covM1 + m.t26.cov1A) >= (m.t25.covM1 + m.t25.cov1A);
                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9; font-weight: 700; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                            <td style="padding: 12px 14px; text-align: left; font-weight: 900; color: #0f172a; border-right: 1px solid #f1f5f9;">${m.nombre}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(m.t25.covM1, false)}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: rgba(240,249,255,0.4); border-right: 1px solid #f1f5f9;">${renderOption8Coverage(m.t26.covM1, true)}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(m.t25.cov1A, false)}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: rgba(240,249,255,0.4); border-right: 1px solid #f1f5f9;">${renderOption8Coverage(m.t26.cov1A, true)}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(m.t25.cov4A, false)}</td>
                                            <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: rgba(240,249,255,0.4); border-right: 1px solid #f1f5f9;">${renderOption8Coverage(m.t26.cov4A, true)}</td>
                                            <td style="padding: 10px 8px; text-align: left;">
                                                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                                    <div style="font-size: 12.5px; font-weight: 900; color: ${isPositive ? '#15803d' : '#b91c1c'}; line-height: 1.2;">
                                                        ${isPositive ? '▲ ASCENDENTE' : '▼ EN REVISIÓN'}
                                                    </div>
                                                    <div style="font-size: 9px; font-weight: 800; color: ${isPositive ? '#166534' : '#dc2626'}; letter-spacing: 0.05em; line-height: 1.1; margin-top: 1px;">
                                                        ${isPositive ? 'CUMPLIMIENTO ÓPTIMO' : 'BAJO SEGUIMIENTO'}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                <tr style="background: #f8fafc; font-weight: 900; color: #0f172a; border-top: 2px solid #cbd5e1;">
                                    <td style="padding: 14px 14px; text-align: left; border-right: 1px solid #cbd5e1;">TOTAL JURISDICCIONAL</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(t25.covM1, false)}</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #cbd5e1;">${renderOption8Coverage(t26.covM1, true)}</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(t25.cov1A, false)}</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #cbd5e1;">${renderOption8Coverage(t26.cov1A, true)}</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #64748b; font-weight: 800;">${renderOption8Coverage(t25.cov4A, false)}</td>
                                    <td style="padding: 10px 10px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; border-right: 1px solid #cbd5e1;">${renderOption8Coverage(t26.cov4A, true)}</td>
                                    <td style="padding: 12px 8px; text-align: left;">
                                        <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                            <div style="font-size: 12.5px; font-weight: 900; color: #0284c7; line-height: 1.2;">✓ CONSOLIDADO</div>
                                            <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; line-height: 1.1; margin-top: 1px;">JURISDICCIÓN SANITARIA 1</div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <!-- TABLA 2: MATRIZ DETALLADA POR BIOLÓGICO Y POBLACIÓN ALINEADA A LA IZQUIERDA -->
                <div>
                    <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded" style="color: #0f172a; font-size: 20px;">vaccines</span> Matriz Multianual por Biológico e Indicadores de Población
                    </h3>
                    <div style="border-radius: 20px; border: 1px solid #e2e8f0; overflow-y: auto; max-height: 520px; background: #ffffff; box-shadow: 0 4px 20px rgba(15,23,42,0.03);">
                        <table style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 11.5px;">
                            <colgroup>
                                <col style="width: 22%;">
                                <col style="width: 14%;">
                                <col style="width: 10%;">
                                <col style="width: 10%;">
                                <col style="width: 10%;">
                                <col style="width: 10%;">
                                <col style="width: 24%;">
                            </colgroup>
                            <thead style="position: sticky; top: 0; z-index: 25; background: #f8fafc;">
                                <tr style="background: #f8fafc; font-weight: 900; color: #334155; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px 14px; text-align: left; position: sticky; top: 0; background: #f8fafc; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">BIOLÓGICO Y ESQUEMA</th>
                                    <th style="padding: 12px 10px; text-align: left; position: sticky; top: 0; background: #f8fafc; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">GRUPO POBLACIONAL</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #64748b; font-weight: 800; position: sticky; top: 0; background: #f8fafc; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">DOSIS 2025</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; position: sticky; top: 0; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">DOSIS 2026</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #64748b; font-weight: 800; position: sticky; top: 0; background: #f8fafc; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">AVANCE 2025</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #0284c7; font-weight: 900; background: #f0f9ff; position: sticky; top: 0; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">AVANCE 2026</th>
                                    <th style="padding: 12px 10px; text-align: left; position: sticky; top: 0; background: #f8fafc; z-index: 25; box-shadow: 0 2px 4px rgba(15,23,42,0.04);">COMPARATIVA (2026 VS 2025)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const buildRow = (n, g, d25, d26, c25, c26, difStr, isUp, isSpecial = false) => {
                                        const numVal = Math.abs(parseFloat(difStr) || 12);
                                        const fillPct = Math.min(100, Math.max(12, numVal * 2.5));
                                        const barColor = isUp ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f43f5e, #dc2626)';
                                        return `
                                        <tr style="border-bottom: 1px solid #f1f5f9; font-weight: 700; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                            <td style="padding: 12px 14px; text-align: left; font-weight: 900; color: #0f172a;">${n}</td>
                                            <td style="padding: 12px 10px; text-align: left; color: #64748b; font-weight: 800;">${g}</td>
                                            <td style="padding: 12px 14px; text-align: left; color: #64748b; font-weight: 800;">${d25 ? d25.toLocaleString('es-MX') : '0'}</td>
                                            <td style="padding: 12px 14px; text-align: left; color: #0284c7; font-weight: 900; background: rgba(240,249,255,0.4);">${d26 ? d26.toLocaleString('es-MX') : '0'}</td>
                                            <td style="padding: 12px 14px; text-align: left; color: #64748b; font-weight: 800;">${c25}</td>
                                            <td style="padding: 12px 14px; text-align: left; color: #0284c7; font-weight: 900; background: rgba(240,249,255,0.4);">${c26}</td>
                                            <td style="padding: 10px 12px; text-align: left;">
                                                ${isSpecial ? `
                                                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                                        <div style="font-size: 12.5px; font-weight: 900; color: #0369a1; line-height: 1.2;">${difStr}</div>
                                                        <div style="font-size: 9px; font-weight: 800; color: #0284c7; letter-spacing: 0.05em; line-height: 1.1; margin-top: 1px;">DOSIS APLICADAS</div>
                                                    </div>
                                                ` : `
                                                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                                        <div style="font-size: 12.5px; font-weight: 900; color: ${isUp ? '#15803d' : '#b91c1c'}; line-height: 1.2;">
                                                            ${isUp ? '▲' : '▼'} ${difStr}
                                                        </div>
                                                        <div style="font-size: 9px; font-weight: 800; color: ${isUp ? '#166534' : '#991b1b'}; letter-spacing: 0.05em; line-height: 1.1; margin-top: 1px;">
                                                            ${isUp ? 'AVANCE SUPERIOR' : 'AVANCE MENOR'}
                                                        </div>
                                                    </div>
                                                `}
                                            </td>
                                        </tr>
                                    `;
                                    };

                                    const sectionHeader = (title, iconName = 'bookmark') => `
                                        <tr style="background: #0f172a !important; color: #ffffff !important;">
                                            <td colspan="7" style="padding: 11px 16px; font-weight: 900 !important; color: #ffffff !important; background: #0f172a !important; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11.5px; border: none !important; text-align: left !important;">
                                                <span class="material-symbols-rounded" style="font-size: 16px; vertical-align: text-bottom; color: #38bdf8; margin-right: 6px;">${iconName}</span> ${title}
                                            </td>
                                        </tr>
                                    `;

                                    const calcDosisDiff = (d25, d26) => {
                                        const diff = d26 - d25;
                                        const pct = d25 > 0 ? Math.round(((diff / d25) * 100) * 10) / 10 : 0;
                                        const label = diff >= 0 ? `+${diff.toLocaleString('es-MX')} Dosis (+${pct}%)` : `${diff.toLocaleString('es-MX')} Dosis (${pct}%)`;
                                        return { label, isUp: diff >= 0 };
                                    };

                                    let html = '';
                                    
                                    // Esquema Básico
                                    html += sectionHeader('ESQUEMA BÁSICO (0-8 AÑOS)', 'child_care');
                                    html += buildRow('BCG (Única)', '< 1 Año', t25.appBCG, t26.appBCG, `${t25.covBCG}%`, `${t26.covBCG}%`, `${(t26.covBCG - t25.covBCG).toFixed(1)}% pts`, t26.covBCG >= t25.covBCG);
                                    html += buildRow('Hepatitis B (0-7 días)', '< 1 Año', t25.appHepB, t26.appHepB, `${t25.covHepB}%`, `${t26.covHepB}%`, `${(t26.covHepB - t25.covHepB).toFixed(1)}% pts`, t26.covHepB >= t25.covHepB);
                                    html += buildRow('Rotavirus (2a Dosis)', '< 1 Año', t25.appRota, t26.appRota, `${t25.covRota}%`, `${t26.covRota}%`, `${(t26.covRota - t25.covRota).toFixed(1)}% pts`, t26.covRota >= t25.covRota);
                                    html += buildRow('Hexavalente (3a Dosis)', '< 1 Año', t25.appHexaM1, t26.appHexaM1, `${t25.covHexaM1}%`, `${t26.covHexaM1}%`, `${(t26.covHexaM1 - t25.covHexaM1).toFixed(1)}% pts`, t26.covHexaM1 >= t25.covHexaM1);
                                    html += buildRow('Hexavalente (Refuerzo)', '1 Año', t25.appHexa1A, t26.appHexa1A, `${t25.covHexa1A}%`, `${t26.covHexa1A}%`, `${(t26.covHexa1A - t25.covHexa1A).toFixed(1)}% pts`, t26.covHexa1A >= t25.covHexa1A);
                                    html += buildRow('Neumococo (2a Dosis)', '< 1 Año', t25.appNeumoM1, t26.appNeumoM1, `${t25.covNeumoM1}%`, `${t26.covNeumoM1}%`, `${(t26.covNeumoM1 - t25.covNeumoM1).toFixed(1)}% pts`, t26.covNeumoM1 >= t25.covNeumoM1);
                                    html += buildRow('Neumococo (Refuerzo)', '1 Año', t25.appNeumo1A, t26.appNeumo1A, `${t25.covNeumo1A}%`, `${t26.covNeumo1A}%`, `${(t26.covNeumo1A - t25.covNeumo1A).toFixed(1)}% pts`, t26.covNeumo1A >= t25.covNeumo1A);
                                    html += buildRow('SRP (Dosis Completa)', '1 Año', t25.appSRP, t26.appSRP, `${t25.covSRP}%`, `${t26.covSRP}%`, `${(t26.covSRP - t25.covSRP).toFixed(1)}% pts`, t26.covSRP >= t25.covSRP);
                                    html += buildRow('DPT (4 Años)', '4 Años', t25.appDPT, t26.appDPT, `${t25.covDPT}%`, `${t26.covDPT}%`, `${(t26.covDPT - t25.covDPT).toFixed(1)}% pts`, t26.covDPT >= t25.covDPT);

                                    // Adolescentes y Adultos
                                    html += sectionHeader('ADOLESCENTES Y ADULTOS (DOSIS APLICADAS)', 'groups');
                                    let dAdolHb = calcDosisDiff(t25.adol_hb, t26.adol_hb);
                                    html += buildRow('Hepatitis B Adultos', 'Adolescentes/Adultos', t25.adol_hb, t26.adol_hb, `${t25.adol_hb.toLocaleString('es-MX')} Dosis`, `${t26.adol_hb.toLocaleString('es-MX')} Dosis`, dAdolHb.label, dAdolHb.isUp);
                                    let dAdolSr = calcDosisDiff(t25.adol_sr, t26.adol_sr);
                                    html += buildRow('SR (Sarampión-Rubéola)', 'Adolescentes/Adultos', t25.adol_sr, t26.adol_sr, `${t25.adol_sr.toLocaleString('es-MX')} Dosis`, `${t26.adol_sr.toLocaleString('es-MX')} Dosis`, dAdolSr.label, dAdolSr.isUp);
                                    let dAdolVph = calcDosisDiff(t25.adol_vph, t26.adol_vph);
                                    html += buildRow('VPH (Virus Papiloma)', 'Adolescentes', t25.adol_vph, t26.adol_vph, `${t25.adol_vph.toLocaleString('es-MX')} Dosis`, `${t26.adol_vph.toLocaleString('es-MX')} Dosis`, dAdolVph.label, dAdolVph.isUp);
                                    let dAdolTd = calcDosisDiff(t25.adol_td, t26.adol_td);
                                    html += buildRow('Td (Tétanos-Difteria)', 'Adolescentes/Adultos', t25.adol_td, t26.adol_td, `${t25.adol_td.toLocaleString('es-MX')} Dosis`, `${t26.adol_td.toLocaleString('es-MX')} Dosis`, dAdolTd.label, dAdolTd.isUp);
                                    let dAdolTdpa = calcDosisDiff(t25.adol_tdpa, t26.adol_tdpa);
                                    html += buildRow('Tdpa Adultos', 'Adolescentes/Adultos', t25.adol_tdpa, t26.adol_tdpa, `${t25.adol_tdpa.toLocaleString('es-MX')} Dosis`, `${t26.adol_tdpa.toLocaleString('es-MX')} Dosis`, dAdolTdpa.label, dAdolTdpa.isUp);

                                    // Adultos Mayores
                                    html += sectionHeader('ADULTOS MAYORES (DOSIS APLICADAS)', 'elderly');
                                    let dAmN13 = calcDosisDiff(t25.am_neumo13, t26.am_neumo13);
                                    html += buildRow('Neumococo 13-valente', '60+ Años', t25.am_neumo13, t26.am_neumo13, `${t25.am_neumo13.toLocaleString('es-MX')} Dosis`, `${t26.am_neumo13.toLocaleString('es-MX')} Dosis`, dAmN13.label, dAmN13.isUp);
                                    let dAmN20 = calcDosisDiff(t25.am_neumo20, t26.am_neumo20);
                                    html += buildRow('Neumococo 20-valente', '60+ Años', t25.am_neumo20, t26.am_neumo20, `${t25.am_neumo20.toLocaleString('es-MX')} Dosis`, `${t26.am_neumo20.toLocaleString('es-MX')} Dosis`, dAmN20.label, dAmN20.isUp);
                                    let dAmTd = calcDosisDiff(t25.am_td, t26.am_td);
                                    html += buildRow('Td Mayores', '60+ Años', t25.am_td, t26.am_td, `${t25.am_td.toLocaleString('es-MX')} Dosis`, `${t26.am_td.toLocaleString('es-MX')} Dosis`, dAmTd.label, dAmTd.isUp);

                                    // Embarazadas
                                    html += sectionHeader('MUJERES EMBARAZADAS', 'pregnant_woman');
                                    let dEmbTdpa = calcDosisDiff(t25.emb_tdpa, t26.emb_tdpa);
                                    html += buildRow('Tdpa Embarazadas', 'Embarazadas', t25.emb_tdpa, t26.emb_tdpa, `${t25.emb_tdpa.toLocaleString('es-MX')} Dosis`, `${t26.emb_tdpa.toLocaleString('es-MX')} Dosis`, dEmbTdpa.label, dEmbTdpa.isUp);
                                    html += buildRow('VSR Embarazadas', 'Embarazadas', 0, t26.emb_vsr, 'Sin Registro 2025', `${t26.emb_vsr.toLocaleString('es-MX')} Dosis`, `+${t26.emb_vsr.toLocaleString('es-MX')} Dosis (Estrategia 2026)`, true, true);

                                    // Temporada Invernal
                                    html += sectionHeader('TEMPORADA INVERNAL', 'ac_unit');
                                    let dInvInf = calcDosisDiff(t25.inv_influenza, t26.inv_influenza);
                                    html += buildRow('Influenza Estacional', 'Población Blanco', t25.inv_influenza, t26.inv_influenza, `${t25.inv_influenza.toLocaleString('es-MX')} Dosis`, `${t26.inv_influenza.toLocaleString('es-MX')} Dosis`, dInvInf.label, dInvInf.isUp);
                                    let dInvCov = calcDosisDiff(t25.inv_covid, t26.inv_covid);
                                    html += buildRow('COVID-19', 'Población Blanco', t25.inv_covid, t26.inv_covid, `${t25.inv_covid.toLocaleString('es-MX')} Dosis`, `${t26.inv_covid.toLocaleString('es-MX')} Dosis`, dInvCov.label, dInvCov.isUp);

                                    return html;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Renderizar Histograma ECharts Dual con elegancia Slate Sobria (Gris/Grafito/Negro carbón)
        setTimeout(() => {
            const chartDom = document.getElementById('chartComparativeMulti');
            if (chartDom && typeof echarts !== 'undefined') {
                // Cada re-render (cambio de filtro) reemplaza el HTML del contenedor y crea un
                // #chartComparativeMulti nuevo; si no se destruye la instancia anterior aquí, se
                // queda viva apuntando a un nodo ya desconectado del DOM, y el próximo movimiento
                // de mouse la hace tronar al intentar reposicionar su tooltip (getSize de null).
                if (_rdaCharts.comparativa) { try { _rdaCharts.comparativa.dispose(); } catch(e){} _rdaCharts.comparativa = null; }
                const myChart = echarts.init(chartDom, null, { renderer: 'canvas' });
                _rdaCharts.comparativa = myChart;
                if (!window._rdaEchartsResizeAttached) {
                    window.addEventListener('resize', () => {
                        if (_rdaCharts.b) _rdaCharts.b.resize();
                        if (_rdaCharts.total) _rdaCharts.total.resize();
                        if (_rdaCharts.d) _rdaCharts.d.resize();
                        if (_rdaCharts.comparativa) { try { _rdaCharts.comparativa.resize(); } catch(e){} }
                    });
                    window._rdaEchartsResizeAttached = true;
                }
                const fontModern = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
                
                const subtextStr = (_rdaState.corteTemporal === '0' || !_rdaState.corteTemporal)
                    ? `Evaluación Acumulada a la Fecha: Enero a ${maxMesName} (Mes 1 a ${maxMes2026})`
                    : (maxMes2026 === 12 ? 'Evaluación Total Anual Evaluada (Enero a Diciembre)' : `Evaluación Acumulada al Cierre de ${maxMesName} (Mes 1 a ${maxMes2026})`);

                const option = {
                    title: {
                        text: 'Comparativa de Cobertura Vacunal por Grupo de Edad (2025 vs 2026)',
                        subtext: subtextStr,
                        left: 'center',
                        top: 10,
                        textStyle: { fontFamily: fontModern, fontSize: 16, fontWeight: 900, color: '#0f172a' },
                        subtextStyle: { fontFamily: fontModern, fontSize: 12, fontWeight: 800, color: '#475569' }
                    },
                    tooltip: {
                        trigger: 'axis',
                        axisPointer: { type: 'shadow' },
                        backgroundColor: '#0f172a',
                        textStyle: { fontFamily: fontModern, color: '#ffffff', fontSize: 12 },
                        formatter: function(params) {
                            let s = `<strong style="font-size:13px;">${params[0].name}</strong><br/>`;
                            params.forEach(p => {
                                s += `${p.marker} ${p.seriesName}: <strong>${p.value}%</strong><br/>`;
                            });
                            return s;
                        }
                    },
                    legend: {
                        data: ['Año 2025', 'Año 2026'],
                        top: 58,
                        left: 'center',
                        textStyle: { fontFamily: fontModern, fontWeight: 800, color: '#334155', fontSize: 12 }
                    },
                    grid: { left: '3%', right: '3%', bottom: '8%', top: 98, containLabel: true },
                    xAxis: {
                        type: 'category',
                        data: ['Menores de 1 Año (<1)', 'Niños de 1 Año (1)', 'Niños de 4 Años (4)'],
                        axisLabel: { fontFamily: fontModern, fontWeight: 800, color: '#0f172a', fontSize: 12 }
                    },
                    yAxis: {
                        type: 'value',
                        name: 'Cobertura (%)',
                        axisLabel: { fontFamily: fontModern, formatter: '{value}%', fontWeight: 700, color: '#475569', fontSize: 11 },
                        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }
                    },
                    series: [
                        {
                            name: 'Año 2025',
                            type: 'bar',
                            data: [t25.covM1, t25.cov1A, t25.cov4A],
                            showBackground: false,
                            itemStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: '#94a3b8' },
                                    { offset: 0.5, color: '#64748b' },
                                    { offset: 1, color: '#475569' }
                                ]),
                                borderRadius: [8, 8, 2, 2],
                                shadowColor: 'rgba(51, 65, 85, 0.25)',
                                shadowBlur: 8,
                                shadowOffsetY: 4
                            },
                            barWidth: 38,
                            label: { show: true, position: 'top', formatter: '{c}%', fontFamily: fontModern, fontWeight: 900, fontSize: 12, color: '#475569' }
                        },
                        {
                            name: 'Año 2026',
                            type: 'bar',
                            data: [t26.covM1, t26.cov1A, t26.cov4A],
                            showBackground: false,
                            itemStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: '#334155' },
                                    { offset: 0.5, color: '#1e293b' },
                                    { offset: 1, color: '#0f172a' }
                                ]),
                                borderRadius: [8, 8, 2, 2],
                                shadowColor: 'rgba(15, 23, 42, 0.4)',
                                shadowBlur: 12,
                                shadowOffsetY: 6
                            },
                            barWidth: 38,
                            label: { show: true, position: 'top', formatter: '{c}%', fontFamily: fontModern, fontWeight: 900, fontSize: 12, color: '#0f172a' }
                        }
                    ]
                };
                myChart.setOption(option);
                // El resize de esta instancia ya lo cubre el listener global de renderBarChart
                // (window._rdaEchartsResizeAttached), que ahora también revisa _rdaCharts.comparativa.
            }
        }, 100);

    } catch (e) {
        console.error("Error cargando comparativa multianual executive:", e);
        container.innerHTML = `<div style="padding: 32px; color: #ef4444; font-weight: 700;">Error al generar comparativa: ${e.message}</div>`;
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
}

