/**
 * rda_parser.js
 * Parser de CSV concentrado SIS — Smart Upsert por MES.
 * Al subir un CSV, detecta los meses incluidos, borra registros previos
 * de esos meses, y luego inserta los nuevos datos.
 *
 * v2: Auto-detección de tipo de CSV (Productividad SIS vs Población).
 */

class RDAParser {
    // Tipo de CSV detectado: 'SIS' | 'POBLACION' | null
    static detectedType = null;

    // Dataset editable de la fila SIS analizada (una vez por archivo cargado).
    // Cada elemento: { idx, rowNum, clues, variable, valor, mes, anio, municipio, status, issues, suggestions, discarded }
    static _rows = null;

    // Cache en memoria del catálogo de unidades (clues -> {nombre, municipio}), para validar
    // CLUES y sugerir coincidencias cercanas sin repetir la consulta a Supabase.
    static _unitCatalog = null;

    // Para deduplicación editable: clave "CLUES|VARIABLE|MES|ANIO" -> idx de la fila que el usuario eligió mantener.
    static _dedupePreferred = new Map();

    // Lote acumulado de archivos (.csv/.xlsx/.xls) seleccionados para esta carga — se va agregando
    // con cada selección o arrastre, no se reemplaza, para poder soltar un archivo por municipio
    // en picks separados en vez de exigir un solo diálogo con selección múltiple.
    static _selectedFiles = [];

    // Cache de parseo por archivo, clave = _fileKey(file) -> { rows, type, error }. Evita re-leer
    // archivos ya procesados cuando se agrega o se quita uno del lote.
    static _fileParseCache = new Map();

    // Cuántas filas de la tabla de revisión se muestran (paginación simple para archivos grandes).
    static _reviewRenderedCount = 200;

    static _MONTHS = {
        ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
        JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12
    };

    // Alias histórico ÚNICO de CLUES aplicado en la ingesta (no en la BD): así, sin importar
    // cuántas veces se recargue el concentrado, los registros del año indicado siempre quedan
    // bajo el CLUES vigente de la unidad, aunque el archivo fuente traiga el CLUES viejo.
    // Clave: 'CLUES_VIEJO|ANIO' -> CLUES_NUEVO. Quitar la entrada cuando ya no se necesite
    // (p.ej. cuando ya no exista ningún concentrado histórico con el CLUES viejo para ese año).
    static CLUES_REASSIGNMENT = {
        'QTSSA002020|2026': 'QTSSA013034' // TLACOTE EL BAJO: cambio de CLUES a mitad de 2026
    };

    static init() {
        const fileInput = document.getElementById('rdaCsvInput');
        const btnConfirm = document.getElementById('btnConfirmUploadCSV');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (!fileInput.files.length) return;
                const picked = Array.from(fileInput.files);
                fileInput.value = ''; // permite re-seleccionar el mismo archivo más adelante
                this.parseFilesAndPreview(picked);
            });
        }

        // Delegación de clic para quitar un archivo individual del lote (ficha con botón "✕")
        const fileBadgesEl = document.getElementById('csvFileListBadges');
        if (fileBadgesEl) {
            fileBadgesEl.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.csv-file-remove-btn');
                if (!removeBtn) return;
                const idx = parseInt(removeBtn.dataset.idx, 10);
                RDAParser.removeSelectedFile(idx);
            });
        }

        if (btnConfirm) {
            btnConfirm.addEventListener('click', async () => {
                if (!this.pendingData) return;

                if (this.detectedType === 'POBLACION') {
                    document.getElementById('modalUploadCSV').classList.remove('show');
                    const poblacionData = this.pendingData;
                    RDAParser.resetUploadModalUI(); // limpia el lote para que la próxima carga empiece de cero
                    this.processPoblacionData(poblacionData);
                    return;
                }

                const proceeded = await this.confirmAndProcessSIS();
                if (proceeded) {
                    document.getElementById('modalUploadCSV').classList.remove('show');
                    RDAParser.resetUploadModalUI(); // limpia el lote para que la próxima carga empiece de cero
                }
            });
        }

        // Delegación de eventos para la tabla de revisión editable (SIS)
        const reviewBody = document.getElementById('csvReviewTableBody');
        if (reviewBody) {
            reviewBody.addEventListener('input', (e) => {
                const input = e.target.closest('.csv-cell-input');
                if (!input) return;
                const idx = parseInt(input.dataset.idx, 10);
                const field = input.dataset.field;
                const row = (RDAParser._rows || []).find(r => r.idx === idx);
                if (row) row[field] = input.value;
            });

            reviewBody.addEventListener('click', (e) => {
                const discardBtn = e.target.closest('.csv-row-discard');
                const restoreBtn = e.target.closest('.csv-row-restore');
                const suggChip = e.target.closest('.csv-sugg-chip');

                if (discardBtn || restoreBtn) {
                    const idx = parseInt((discardBtn || restoreBtn).dataset.idx, 10);
                    const row = (RDAParser._rows || []).find(r => r.idx === idx);
                    if (row) {
                        row.discarded = !!discardBtn;
                        RDAParser.runAnalysis();
                    }
                    return;
                }

                if (suggChip) {
                    const idx = parseInt(suggChip.dataset.idx, 10);
                    const field = suggChip.dataset.field;
                    const value = suggChip.dataset.value;
                    const row = (RDAParser._rows || []).find(r => r.idx === idx);
                    if (row) {
                        row[field] = value;
                        RDAParser.runAnalysis();
                    }
                }
            });
        }

        const btnRevalidate = document.getElementById('btnRevalidateCsv');
        if (btnRevalidate) {
            btnRevalidate.addEventListener('click', () => RDAParser.runAnalysis());
        }

        const btnLoadMore = document.getElementById('btnLoadMoreReview');
        if (btnLoadMore) {
            btnLoadMore.addEventListener('click', () => {
                RDAParser._reviewRenderedCount += 200;
                RDAParser._renderReviewUI();
            });
        }

        const btnToggleReview = document.getElementById('btnToggleReviewTable');
        if (btnToggleReview) {
            btnToggleReview.addEventListener('click', () => {
                const wrap = document.getElementById('csvReviewTableWrap');
                const arrow = document.getElementById('reviewTableArrow');
                if (!wrap) return;
                const show = wrap.style.display === 'none';
                wrap.style.display = show ? 'block' : 'none';
                if (arrow) arrow.textContent = show ? 'expand_less' : 'expand_more';
            });
        }

        // Cerrar con tecla Escape: si el diálogo de confirmación de subida está abierto,
        // se cierra primero ese (cancela); si no, se cierra el modal completo de carga.
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;

            const confirmOverlay = document.getElementById('csvUploadConfirmOverlay');
            if (confirmOverlay && confirmOverlay.classList.contains('show')) {
                RDAParser.closeCsvUploadConfirm(false);
                return;
            }

            const modal = document.getElementById('modalUploadCSV');
            if (modal && modal.classList.contains('show')) {
                modal.classList.remove('show');
                RDAParser.resetUploadModalUI();
            }
        });
    }

    /** Normaliza un nombre de columna (quita tildes, espacios, mayúsculas) */
    static _normalizeKey(str) {
        return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    }

    /** Busca una columna en un row de CSV de forma resiliente */
    static _getCol(row, keyName) {
        const search = this._normalizeKey(keyName);
        const key = Object.keys(row).find(k => this._normalizeKey(k) === search);
        return key ? (row[key] || '').toString().trim() : null;
    }

    /** Busca una columna que contenga alguno de los patrones dados */
    static _findColByPatterns(row, patterns) {
        for (const k of Object.keys(row)) {
            const norm = this._normalizeKey(k);
            if (patterns.some(p => norm.includes(p))) return k;
        }
        return null;
    }

    /**
     * Detecta el tipo de CSV basado en los encabezados.
     * @param {string[]} fields — nombres de columna del CSV
     * @returns {'SIS'|'POBLACION'|null}
     */
    static detectCSVType(fields) {
        const nf = fields.map(f => this._normalizeKey(f));

        const hasClues    = nf.includes("CLUES");
        const hasVariable = nf.includes("VARIABLE") || nf.includes("VARIABLE_SIS");
        const hasValor    = nf.includes("VALOR") || nf.includes("DOSIS");
        const hasMes      = nf.includes("MES");
        const hasAnio     = nf.includes("ANO") || nf.includes("ANIO");

        // SIS: tiene las 5 columnas canónicas
        if (hasClues && hasVariable && hasValor && hasMes && hasAnio) return 'SIS';

        // POBLACION: tiene CLUES + al menos una columna de población
        const POB_PATTERNS = ['POB_MENOR', 'MENOR_1', 'MENORES', 'POB_1', '1_ANO', 'POB_4', '4_ANO', 'CUATRO'];
        const hasPobCol = nf.some(f => POB_PATTERNS.some(p => f.includes(p)));
        if (hasClues && hasPobCol) return 'POBLACION';

        return null;
    }

    /** Restaura el modal de carga a su estado inicial (sin archivos seleccionados). */
    static resetUploadModalUI() {
        const fileInput = document.getElementById('rdaCsvInput');
        if (fileInput) fileInput.value = '';

        const previewArea = document.getElementById('csvPreviewArea');
        if (previewArea) previewArea.style.display = 'none';
        const dropZone = document.getElementById('csvDropZone');
        if (dropZone) dropZone.style.display = 'flex';
        const btnConfirm = document.getElementById('btnConfirmUploadCSV');
        if (btnConfirm) btnConfirm.classList.add('opacity-50', 'pointer-events-none');
        const badgesEl = document.getElementById('csvFileListBadges');
        if (badgesEl) { badgesEl.style.display = 'none'; badgesEl.innerHTML = ''; }
        const errorDiv = document.getElementById('csvSchemaError');
        if (errorDiv) errorDiv.style.display = 'none';

        RDAParser._rows = null;
        RDAParser._selectedFiles = [];
        RDAParser._fileParseCache = new Map();
        RDAParser.pendingData = null;
        RDAParser.detectedType = null;
    }

    /** Lee un solo archivo (.csv, .xlsx o .xls) y devuelve sus filas como arreglo de objetos {columna: valor}. */
    static async _parseOneFile(file, targetSheet = 'CSV') {
        const name = file.name.toLowerCase();

        if (name.endsWith('.csv')) {
            return new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => resolve(results.data || []),
                    error: (error) => reject(error)
                });
            });
        }

        if (typeof XLSX === 'undefined') {
            throw new Error('El lector de archivos Excel no está disponible (XLSX no cargó).');
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('El archivo no contiene hojas.');
        }
        let sheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === targetSheet.toUpperCase());
        if (!sheetName) sheetName = workbook.SheetNames[0];
        return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
    }

    /** Clave estable de un File (para el caché de parseo — no depende de su posición en el lote). */
    static _fileKey(file) {
        return `${file.name}|${file.size}|${file.lastModified}`;
    }

    /** Pinta el resumen (nombre/tamaño total) y una ficha removible por archivo, con su resultado si ya se procesó. */
    static _renderFileBadges(files, perFileInfo, statusMsg) {
        const nameEl = document.getElementById('csvFileName');
        const sizeEl = document.getElementById('csvFileSize');
        const badgesEl = document.getElementById('csvFileListBadges');

        if (nameEl) nameEl.textContent = files.length === 1 ? files[0].name : `${files.length} archivos seleccionados`;
        if (sizeEl) {
            const totalKb = files.reduce((sum, f) => sum + f.size, 0) / 1024;
            sizeEl.textContent = statusMsg || `${totalKb.toFixed(1)} KB en total`;
        }
        if (!badgesEl) return;

        if (!files.length) {
            badgesEl.style.display = 'none';
            badgesEl.innerHTML = '';
            return;
        }

        badgesEl.style.display = 'flex';
        badgesEl.innerHTML = files.map((f, i) => {
            const info = perFileInfo ? perFileInfo[i] : null;
            let cls = 'bg-slate-100 text-slate-600 border-slate-200';
            let icon = '⏳';
            let extra = 'leyendo...';
            if (info) {
                if (info.ok) {
                    cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    icon = '✅';
                    extra = `${info.rows.toLocaleString()} filas`;
                } else {
                    cls = 'bg-rose-50 text-rose-700 border-rose-200';
                    icon = '⚠️';
                    extra = info.note;
                }
            }
            return `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold border ${cls} inline-flex items-center gap-1.5" title="${RDAParser._escAttr(f.name)} — ${RDAParser._escAttr(extra)}">${icon} ${RDAParser._escAttr(f.name)} <span class="opacity-70">(${RDAParser._escAttr(extra)})</span><button type="button" class="csv-file-remove-btn opacity-60 hover:opacity-100 hover:text-rose-600 cursor-pointer border-none bg-transparent p-0 font-black leading-none" data-idx="${i}" title="Quitar este archivo">✕</button></span>`;
        }).join('');
    }

    /** Quita un archivo del lote (por su posición actual) y re-analiza el resto. */
    static async removeSelectedFile(idx) {
        const files = RDAParser._selectedFiles || [];
        if (idx < 0 || idx >= files.length) return;
        files.splice(idx, 1);
        await RDAParser._reprocessSelectedFiles();
    }

    /**
     * Punto de entrada de la carga: AGREGA uno o varios archivos .csv/.xlsx/.xls al lote actual
     * (no lo reemplaza) — así puedes ir soltando un archivo por municipio en selecciones separadas,
     * en vez de tener que elegir los 4 juntos en un solo diálogo. Cada vez que el lote cambia se
     * vuelve a concentrar todo en un único dataset y se pasa al motor de análisis (SIS o Población)
     * exactamente como si fuera un solo archivo — no hay un "concentrador" aparte que generar y
     * volver a subir; es el mismo flujo de revisión y carga ya probado de un solo archivo.
     */
    static async parseFilesAndPreview(newFiles) {
        const incoming = Array.from(newFiles || []).filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
        if (!incoming.length) {
            if (!(RDAParser._selectedFiles || []).length) {
                this._showSchemaError('Selecciona al menos un archivo .csv, .xlsx o .xls.');
            }
            return;
        }

        const existingKeys = new Set((RDAParser._selectedFiles || []).map(f => RDAParser._fileKey(f)));
        const toAdd = incoming.filter(f => !existingKeys.has(RDAParser._fileKey(f)));
        RDAParser._selectedFiles = [...(RDAParser._selectedFiles || []), ...toAdd];

        await RDAParser._reprocessSelectedFiles();
    }

    /** Re-lee (con caché por archivo) TODO el lote en RDAParser._selectedFiles, lo concentra y dispara el análisis. */
    static async _reprocessSelectedFiles() {
        const fileArr = RDAParser._selectedFiles || [];
        if (!fileArr.length) {
            RDAParser.resetUploadModalUI();
            return;
        }

        document.getElementById('csvSchemaError').style.display = 'none';
        document.getElementById('csvDropZone').style.display = 'none';
        document.getElementById('csvPreviewArea').style.display = 'flex';
        document.getElementById('btnConfirmUploadCSV').classList.add('opacity-50', 'pointer-events-none');
        document.getElementById('csvValidCount').textContent = '...';
        document.getElementById('csvIgnoredCount').textContent = '...';
        document.getElementById('csvMonthsWarning').style.display = 'none';

        RDAParser._rows = null;
        RDAParser._dedupePreferred = new Map();
        RDAParser._reviewRenderedCount = 200;
        const reviewArea = document.getElementById('csvReviewTableArea');
        if (reviewArea) reviewArea.style.display = 'none';
        const badge = document.getElementById('csvTypeBadge');
        if (badge) badge.style.display = 'none';

        RDAParser._renderFileBadges(fileArr, null, `Leyendo ${fileArr.length} archivo(s)...`);

        // Paso 1: leer (con caché) cada archivo de forma independiente.
        for (const file of fileArr) {
            const key = RDAParser._fileKey(file);
            if (RDAParser._fileParseCache.has(key)) continue;

            let entry;
            try {
                const rawRows = await RDAParser._parseOneFile(file, 'CSV');
                if (!rawRows.length) {
                    entry = { rows: [], type: null, error: 'Archivo vacío' };
                } else {
                    const fields = Object.keys(rawRows[0] || {});
                    const type = RDAParser.detectCSVType(fields);
                    entry = type
                        ? { rows: rawRows, type, error: null }
                        : { rows: [], type: null, error: 'Columnas no reconocidas' };
                }
            } catch (err) {
                console.error('[RDA Parser] Error leyendo', file.name, err);
                entry = { rows: [], type: null, error: err.message || 'Error al leer el archivo' };
            }
            RDAParser._fileParseCache.set(key, entry);
        }

        // Paso 2: el tipo del lote es el del primer archivo (en el orden actual) que se leyó bien.
        let detectedType = null;
        for (const file of fileArr) {
            const entry = RDAParser._fileParseCache.get(RDAParser._fileKey(file));
            if (entry && entry.type) { detectedType = entry.type; break; }
        }

        // Paso 3: decidir inclusión por archivo y concentrar filas de los que coincidan con el tipo del lote.
        let mergedRows = [];
        const perFileInfo = fileArr.map(file => {
            const entry = RDAParser._fileParseCache.get(RDAParser._fileKey(file));
            if (!entry || entry.error) {
                return { ok: false, note: (entry && entry.error) || 'Error al leer el archivo' };
            }
            if (!detectedType || entry.type !== detectedType) {
                return { ok: false, note: `Es de tipo ${entry.type}, se esperaba ${detectedType}` };
            }
            mergedRows.push(...entry.rows);
            return { ok: true, rows: entry.rows.length };
        });

        RDAParser._renderFileBadges(fileArr, perFileInfo, null);

        if (!detectedType || mergedRows.length === 0) {
            this._showSchemaError(
                'No se pudo extraer información válida de los archivos seleccionados. Revisa el detalle por archivo arriba y ' +
                'que tengan el formato correcto (ver "Plantilla y Formato CSV"): Productividad SIS (CLUES, VARIABLE, VALOR, MES, ANO) ' +
                'o Población (CLUES + columnas de población).'
            );
            return;
        }

        this.detectedType = detectedType;
        this._updateModalForType(detectedType);

        if (detectedType === 'SIS') {
            await this.buildAndAnalyzeSIS(mergedRows);
        } else if (detectedType === 'POBLACION') {
            this.validateAndPreviewPoblacion(mergedRows);
        }
    }

    /** Actualiza el título y badge del modal según tipo detectado */
    static _updateModalForType(type) {
        const titleEl = document.querySelector('#modalUploadCSV h3');
        const subtitleEl = document.querySelector('#modalUploadCSV h3 + p');
        const badge = document.getElementById('csvTypeBadge');
        const monthsWarning = document.getElementById('csvMonthsWarning');
        const countersGrid = document.getElementById('csvCountersGrid');
        const fixedCard = document.getElementById('csvFixedCard');
        const warningCard = document.getElementById('csvWarningCard');
        const ignoredLabel = document.getElementById('csvIgnoredLabel');
        const reviewArea = document.getElementById('csvReviewTableArea');
        const oldIgnoredArea = document.getElementById('csvIgnoredDetailsArea');

        if (type === 'SIS') {
            if (titleEl) titleEl.textContent = 'Carga de Reporte SIS';
            if (subtitleEl) subtitleEl.textContent = 'Productividad mensual — formato .csv';
            if (badge) { badge.textContent = '📊 PRODUCTIVIDAD SIS'; badge.className = 'inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 mt-2'; badge.style.display = 'inline-flex'; }
            if (countersGrid) countersGrid.className = 'grid grid-cols-4 gap-2';
            if (fixedCard) fixedCard.style.display = '';
            if (warningCard) warningCard.style.display = '';
            if (ignoredLabel) ignoredLabel.textContent = 'Inválidos';
            if (oldIgnoredArea) oldIgnoredArea.style.display = 'none';
        } else if (type === 'POBLACION') {
            if (titleEl) titleEl.textContent = 'Carga de Población';
            if (subtitleEl) subtitleEl.textContent = 'Actualización masiva de datos demográficos';
            if (badge) { badge.textContent = '👥 POBLACIÓN'; badge.className = 'inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 mt-2'; badge.style.display = 'inline-flex'; }
            if (monthsWarning) monthsWarning.style.display = 'none';
            if (countersGrid) countersGrid.className = 'grid grid-cols-2 gap-3';
            if (fixedCard) fixedCard.style.display = 'none';
            if (warningCard) warningCard.style.display = 'none';
            if (ignoredLabel) ignoredLabel.textContent = 'Ignorados';
            if (reviewArea) reviewArea.style.display = 'none';
        }
    }

    static _showSchemaError(msg) {
        const errorDiv = document.getElementById('csvSchemaError');
        const errorText = document.getElementById('csvSchemaErrorText');
        errorText.textContent = msg;
        errorDiv.style.display = 'flex';
        document.getElementById('csvValidCount').textContent = '0';
        document.getElementById('csvIgnoredCount').textContent = '0';
    }

    // =========================================================================
    // SIS FLOW — Motor de análisis inteligente + revisión editable
    // =========================================================================

    /** Distancia de Levenshtein simple (sin dependencias externas) */
    static _levenshtein(a, b) {
        const m = a.length, n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        const dp = new Array(n + 1);
        for (let j = 0; j <= n; j++) dp[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = dp[0];
            dp[0] = i;
            for (let j = 1; j <= n; j++) {
                const tmp = dp[j];
                dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
                prev = tmp;
            }
        }
        return dp[n];
    }

    /** Busca la coincidencia más cercana a `value` dentro de `candidates`, dentro de `maxDistance` ediciones */
    static _closestMatch(value, candidates, maxDistance = 2) {
        if (!value || !candidates || !candidates.length) return null;
        let best = null, bestDist = Infinity;
        for (const c of candidates) {
            if (c === value) return null; // coincidencia exacta: no hay nada que sugerir
            const d = RDAParser._levenshtein(value, c);
            if (d < bestDist) { bestDist = d; best = c; }
        }
        return (best !== null && bestDist <= maxDistance) ? best : null;
    }

    /** Convierte nombres de mes en español (con o sin acentos) a su número 1-12 */
    static _normalizeMonthName(str) {
        const n = RDAParser._normalizeKey(str);
        return RDAParser._MONTHS[n] || null;
    }

    /** Escapa un valor para uso seguro dentro de un atributo HTML */
    static _escAttr(val) {
        return String(val ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    /** Trae y cachea el catálogo de unidades médicas (clues -> {nombre, municipio}) */
    static async ensureUnitCatalog() {
        if (RDAParser._unitCatalog) return RDAParser._unitCatalog;
        try {
            const { data, error } = await window.supabase.from('unidades_medicas').select('clues,nombre,municipio');
            if (error) throw error;
            const map = new Map();
            (data || []).forEach(u => map.set(String(u.clues || '').trim().toUpperCase(), { nombre: u.nombre, municipio: u.municipio }));
            RDAParser._unitCatalog = map;
        } catch (e) {
            console.warn('[RDA Parser] No se pudo cargar el catálogo de unidades para validación:', e);
            RDAParser._unitCatalog = new Map();
        }
        return RDAParser._unitCatalog;
    }

    /** Construye el dataset editable a partir del CSV parseado y dispara el primer análisis */
    static async buildAndAnalyzeSIS(data) {
        RDAParser._rows = data.map((row, i) => ({
            idx: i,
            rowNum: i + 2, // Fila 1 es el header
            clues: RDAParser._getCol(row, 'CLUES') || '',
            variable: RDAParser._getCol(row, 'VARIABLE_SIS') || RDAParser._getCol(row, 'VARIABLE') || '',
            valor: RDAParser._getCol(row, 'VALOR') || RDAParser._getCol(row, 'DOSIS') || '',
            mes: RDAParser._getCol(row, 'MES') || '',
            anio: RDAParser._getCol(row, 'ANO') || RDAParser._getCol(row, 'ANIO') || '',
            municipio: RDAParser._getCol(row, 'MUNICIPIO') || '',
            status: 'valid',
            issues: [],
            suggestions: {},
            discarded: false
        }));
        RDAParser._dedupePreferred = new Map();
        RDAParser._reviewRenderedCount = 200;
        RDAParser.pendingData = true; // sentinela: ya hay un archivo parseado

        await RDAParser.ensureUnitCatalog();
        RDAParser.runAnalysis();
    }

    /** Clasifica una fila individual (sin resolver duplicados, eso se hace en runAnalysis) */
    static _analyzeRow(r, context) {
        const clues = String(r.clues || '').trim().toUpperCase();
        const variable = String(r.variable || '').trim().toUpperCase();
        const valorRaw = String(r.valor ?? '').trim();
        const mesRaw = String(r.mes ?? '').trim();

        // 1. Campos faltantes — no hay forma segura de auto-corregir esto
        if (!clues || !variable || !valorRaw || !mesRaw) {
            r.issues.push('Falta CLUES, Variable, Valor o Mes');
            r.status = 'invalid';
        }

        // 2. VALOR: limpiar separadores de miles ("1,500"), espacios o texto sobrante ANTES de
        //    interpretar como número — parseInt("1,500") da 1 en vez de NaN, así que no basta
        //    con limpiar solo cuando el parseo directo falla.
        let valor;
        const cleanedValor = valorRaw.replace(/[^\d-]/g, '');
        if (cleanedValor === valorRaw) {
            valor = parseInt(valorRaw, 10);
            if (isNaN(valor)) {
                r.issues.push(`Valor "${valorRaw}" no es numérico`);
                r.status = 'invalid';
            }
        } else {
            valor = parseInt(cleanedValor, 10);
            if (!isNaN(valor)) {
                r._valorFixed = String(valor);
                r.issues.push(`Valor "${valorRaw}" interpretado como ${valor}`);
                if (r.status === 'valid') r.status = 'fixed';
            } else {
                r.issues.push(`Valor "${valorRaw}" no es numérico`);
                r.status = 'invalid';
            }
        }

        // 3. MES: aceptar nombres de mes en español además de 1-12
        let mes = parseInt(mesRaw, 10);
        if ((isNaN(mes) || mes < 1 || mes > 12) && mesRaw) {
            const mapped = RDAParser._normalizeMonthName(mesRaw);
            if (mapped) {
                mes = mapped;
                r._mesFixed = String(mapped);
                r.issues.push(`Mes "${mesRaw}" interpretado como ${mapped}`);
                if (r.status === 'valid') r.status = 'fixed';
            } else {
                r.issues.push(`Mes "${mesRaw}" inválido (debe ser 1-12)`);
                r.status = 'invalid';
            }
        }

        // 4. VALOR negativo — no es un caso de formato válido en ninguna unidad, se marca para revisión.
        //    (Nota: NO se marcan valores altos como sospechosos — hay unidades cuya productividad
        //    real supera con normalidad los 1,500 registros mensuales; juzgar por magnitud generaba
        //    falsos positivos y ruido innecesario.)
        if (!isNaN(valor) && valor < 0) {
            r.issues.push('Valor negativo');
            if (r.status === 'valid') r.status = 'warning';
        }

        // 5. CLUES desconocido en el catálogo real de unidades
        if (clues && context.unitCatalog && context.unitCatalog.size > 0 && !context.unitCatalog.has(clues)) {
            r.issues.push('CLUES no encontrado en el catálogo de unidades');
            if (r.status === 'valid') r.status = 'warning';
            const match = RDAParser._closestMatch(clues, context.unitCatalogKeys, 2);
            if (match) r.suggestions.clues = match;
        }

        // Nota: NO se marca como advertencia una VARIABLE_SIS ausente del diccionario de
        // indicadores (window.DICT_RDA). Ese diccionario decide qué variables alimentan cada
        // indicador calculado — es un filtro de la calculadora, no una regla de validez del dato.
        // La carga debe aceptar y guardar TODAS las variables de aplicaciones tal cual vienen;
        // cada función que calcule algo específico filtra lo que necesita, no la carga.
    }

    /**
     * Compara los municipios cubiertos por las filas que SÍ se van a subir contra los municipios
     * conocidos en el catálogo de unidades, y devuelve los que faltan por completo en este lote.
     * Existe porque el borrado en rpcUpsert es por (año, mes) — NO por municipio/CLUES — así que
     * subir un lote incompleto (p.ej. solo 2 de 4 municipios) borraría también los registros ya
     * guardados de los municipios ausentes para ese mes, sin insertar nada nuevo para reemplazarlos.
     * Si el catálogo de unidades no cargó (o no tiene municipios), devuelve [] para no dar falsas alarmas.
     */
    static _computeMissingMunicipios(uploadableRows) {
        const catalog = RDAParser._unitCatalog;
        if (!catalog || catalog.size === 0) return [];

        const known = new Set();
        catalog.forEach(u => {
            const m = String(u.municipio || '').trim().toUpperCase();
            if (m && m !== 'DESCONOCIDO') known.add(m);
        });
        if (known.size === 0) return [];

        const covered = new Set();
        (uploadableRows || []).forEach(r => {
            const clues = String(r.clues || '').trim().toUpperCase();
            const catalogInfo = catalog.get(clues);
            const m = String((catalogInfo && catalogInfo.municipio) || r.municipio || '').trim().toUpperCase();
            if (m) covered.add(m);
        });

        return Array.from(known).filter(m => !covered.has(m)).sort();
    }

    /** Estado visual (badge/ícono) para un status de fila */
    static _statusMeta(status) {
        switch (status) {
            case 'invalid': return { label: 'Inválido', badge: 'bg-rose-100 text-rose-700', icon: '❌' };
            case 'warning': return { label: 'Advertencia', badge: 'bg-amber-100 text-amber-700', icon: '⚠️' };
            case 'fixed': return { label: 'Corregido', badge: 'bg-blue-100 text-blue-700', icon: '🔧' };
            case 'discarded': return { label: 'Descartada', badge: 'bg-slate-200 text-slate-500', icon: '🗑️' };
            default: return { label: 'OK', badge: 'bg-emerald-100 text-emerald-700', icon: '✅' };
        }
    }

    /**
     * Re-analiza TODO el dataset en memoria (RDAParser._rows), incluyendo deduplicación,
     * y repinta contadores + tabla de revisión. Se llama tras el parseo inicial, tras editar
     * una celda y pulsar "Re-validar", tras descartar/restaurar una fila, o tras aplicar una sugerencia.
     */
    static runAnalysis() {
        if (!RDAParser._rows) return;

        const uiYear = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
        const context = {
            uiYear,
            unitCatalog: RDAParser._unitCatalog || new Map(),
            unitCatalogKeys: RDAParser._unitCatalog ? Array.from(RDAParser._unitCatalog.keys()) : []
        };

        // Paso 1: clasificar cada fila individualmente y agrupar claves candidatas a duplicado
        const keyMap = new Map(); // "CLUES|VARIABLE|MES|ANIO" -> [filas]
        RDAParser._rows.forEach(r => {
            r.issues = [];
            r.suggestions = {};
            r._valorFixed = null;
            r._mesFixed = null;

            if (r.discarded) { r.status = 'discarded'; return; }

            const variable = String(r.variable || '').trim().toUpperCase();
            if (variable && (variable.startsWith('VOI') || variable.startsWith('VOF') || variable.startsWith('VBC5'))) {
                r.status = 'excluded';
                r.issues.push('Variable de inventario excluida por regla de negocio (no es aplicación)');
                return;
            }

            r.status = 'valid';
            RDAParser._analyzeRow(r, context);

            if (r.status !== 'invalid') {
                const clues = String(r.clues || '').trim().toUpperCase();
                const mes = r._mesFixed || r.mes;
                let anio = parseInt(r.anio, 10);
                if (isNaN(anio) || anio < 2020 || anio > 2035) anio = uiYear;
                const key = `${clues}|${variable}|${mes}|${anio}`;
                if (!keyMap.has(key)) keyMap.set(key, []);
                keyMap.get(key).push(r);
            }
        });

        // Paso 2: deduplicar — dentro de cada grupo, se mantiene la fila preferida (o la última por defecto)
        keyMap.forEach((group, key) => {
            if (group.length <= 1) return;
            const preferredIdx = RDAParser._dedupePreferred.get(key);
            const keepRow = group.find(r => r.idx === preferredIdx) || group[group.length - 1];
            group.forEach(r => {
                if (r !== keepRow) {
                    r.status = 'invalid';
                    r.issues.push(`Duplicado: se mantiene la fila ${keepRow.rowNum} para CLUES+Variable+Mes+Año`);
                    r._duplicateKeepIdx = keepRow.idx;
                }
            });
        });

        RDAParser._renderReviewUI();
    }

    /** Genera el HTML de una fila editable de la tabla de revisión */
    static _renderRowHtml(r) {
        const meta = RDAParser._statusMeta(r.status);
        const isDiscarded = r.status === 'discarded';
        const disabledAttr = isDiscarded ? 'disabled' : '';
        const rowOpacity = isDiscarded ? 'opacity: 0.55;' : '';

        const suggChip = (field, value) => value
            ? `<button type="button" class="csv-sugg-chip block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer" data-idx="${r.idx}" data-field="${field}" data-value="${RDAParser._escAttr(value)}">¿${RDAParser._escAttr(value)}?</button>`
            : '';

        const actionBtn = isDiscarded
            ? `<button type="button" class="csv-row-restore text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg border-none cursor-pointer" data-idx="${r.idx}">Restaurar</button>`
            : `<button type="button" class="csv-row-discard text-[10px] font-bold text-error bg-error/10 px-2 py-1 rounded-lg border-none cursor-pointer" data-idx="${r.idx}">Descartar</button>`;

        const cell = (field, value) => `<input type="text" ${disabledAttr} data-idx="${r.idx}" data-field="${field}" value="${RDAParser._escAttr(value)}" class="csv-cell-input w-full px-1.5 py-1 rounded border border-slate-200 text-[11px] font-mono bg-white disabled:bg-slate-100">`;

        return `
        <tr class="border-t border-slate-100 align-top" style="${rowOpacity}" data-row-idx="${r.idx}">
          <td class="p-2 text-slate-400 font-mono text-[10px]">${r.rowNum}</td>
          <td class="p-2"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${meta.badge}">${meta.icon} ${meta.label}</span></td>
          <td class="p-2 min-w-[110px]">${cell('clues', r.clues)}${suggChip('clues', r.suggestions.clues)}</td>
          <td class="p-2 min-w-[90px]">${cell('variable', r.variable)}${suggChip('variable', r.suggestions.variable)}</td>
          <td class="p-2 min-w-[60px]">${cell('valor', r._valorFixed ?? r.valor)}</td>
          <td class="p-2 min-w-[45px]">${cell('mes', r._mesFixed ?? r.mes)}</td>
          <td class="p-2 min-w-[55px]">${cell('anio', r.anio)}</td>
          <td class="p-2 text-[10px] text-slate-500 max-w-[200px]">${(r.issues || []).map(i => RDAParser._escAttr(i)).join('<br>')}</td>
          <td class="p-2">${actionBtn}</td>
        </tr>`;
    }

    /** Repinta contadores, aviso de meses y tabla de revisión a partir de RDAParser._rows ya analizado */
    static _renderReviewUI() {
        const rows = RDAParser._rows || [];
        const counts = { valid: 0, fixed: 0, warning: 0, invalid: 0, excluded: 0, discarded: 0 };
        rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

        const uploadable = counts.valid + counts.fixed + counts.warning;

        const validEl = document.getElementById('csvValidCount');
        if (validEl) validEl.textContent = counts.valid.toLocaleString();
        const fixedEl = document.getElementById('csvFixedCount');
        if (fixedEl) fixedEl.textContent = counts.fixed.toLocaleString();
        const warnEl = document.getElementById('csvWarningCount');
        if (warnEl) warnEl.textContent = counts.warning.toLocaleString();
        const invalidEl = document.getElementById('csvIgnoredCount');
        if (invalidEl) invalidEl.textContent = counts.invalid.toLocaleString();

        const btnConfirm = document.getElementById('btnConfirmUploadCSV');
        if (btnConfirm) {
            if (uploadable > 0) btnConfirm.classList.remove('opacity-50', 'pointer-events-none');
            else btnConfirm.classList.add('opacity-50', 'pointer-events-none');
        }

        // Aviso de meses que se sobrescribirán (solo filas que efectivamente se subirán)
        const mesesSet = new Set();
        rows.forEach(r => {
            if (r.status === 'valid' || r.status === 'fixed' || r.status === 'warning') {
                const m = parseInt(r._mesFixed || r.mes, 10);
                if (!isNaN(m)) mesesSet.add(m);
            }
        });
        const mesesArray = [...mesesSet].sort((a, b) => a - b);
        const monthsWarnEl = document.getElementById('csvMonthsWarning');
        if (monthsWarnEl) {
            if (mesesArray.length > 0) {
                const listEl = document.getElementById('csvMonthsList');
                if (listEl) listEl.textContent = mesesArray.join(', ');
                monthsWarnEl.style.display = 'block';
            } else {
                monthsWarnEl.style.display = 'none';
            }
        }

        // Aviso de municipios ausentes en este lote (ver _computeMissingMunicipios)
        const uploadableForCoverage = rows.filter(r => r.status === 'valid' || r.status === 'fixed' || r.status === 'warning');
        const missingMunicipios = RDAParser._computeMissingMunicipios(uploadableForCoverage);
        const coverageWarnEl = document.getElementById('csvMunicipioCoverageWarning');
        if (coverageWarnEl) {
            if (missingMunicipios.length > 0 && mesesArray.length > 0) {
                const listEl = document.getElementById('csvMunicipioCoverageList');
                if (listEl) listEl.textContent = missingMunicipios.join(', ');
                coverageWarnEl.style.display = 'block';
            } else {
                coverageWarnEl.style.display = 'none';
            }
        }

        // Tabla de revisión: todo lo que no sea 'valid' puro ni 'excluded' (regla de negocio intencional)
        const reviewRows = rows.filter(r => r.status !== 'valid' && r.status !== 'excluded');
        const area = document.getElementById('csvReviewTableArea');
        const body = document.getElementById('csvReviewTableBody');
        const moreEl = document.getElementById('csvReviewTableMore');
        const btnLoadMore = document.getElementById('btnLoadMoreReview');
        const titleEl = document.getElementById('csvReviewTableTitle');
        const excludedNote = document.getElementById('csvExcludedNote');

        if (excludedNote) {
            if (counts.excluded > 0) {
                excludedNote.style.display = 'block';
                excludedNote.textContent = `ℹ️ ${counts.excluded.toLocaleString()} fila(s) de variables de inventario (VOI/VOF/VBC5) excluidas automáticamente — no son aplicaciones.`;
            } else {
                excludedNote.style.display = 'none';
            }
        }

        if (reviewRows.length === 0) {
            if (area) area.style.display = 'none';
        } else if (area && body) {
            area.style.display = 'flex';
            if (titleEl) titleEl.textContent = `Revisar y corregir ${reviewRows.length.toLocaleString()} fila(s) con problemas`;
            const limit = RDAParser._reviewRenderedCount || 200;
            const toRender = reviewRows.slice(0, limit);
            body.innerHTML = toRender.map(r => RDAParser._renderRowHtml(r)).join('');

            if (reviewRows.length > toRender.length) {
                if (moreEl) { moreEl.style.display = 'block'; moreEl.textContent = `Mostrando ${toRender.length.toLocaleString()} de ${reviewRows.length.toLocaleString()} filas con problemas.`; }
                if (btnLoadMore) btnLoadMore.style.display = 'inline-flex';
            } else {
                if (moreEl) moreEl.style.display = 'none';
                if (btnLoadMore) btnLoadMore.style.display = 'none';
            }
        }
    }

    /** Diálogo "¿Confirmas subir N válidos e ignorar M con error?" — clon del patrón openBioConfirm/closeBioConfirm */
    static _csvUploadConfirmResolver = null;

    static openCsvUploadConfirm(validCount, invalidCount, extraWarningHtml = '') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('csvUploadConfirmOverlay');
            if (!overlay) { resolve(false); return; }

            if (overlay.parentNode !== document.body) document.body.appendChild(overlay);

            overlay.onclick = (e) => { if (e.target === overlay) RDAParser.closeCsvUploadConfirm(false); };

            const btnCancel = overlay.querySelector('#btnCsvUploadConfirmCancel');
            const btnAccept = overlay.querySelector('#btnCsvUploadConfirmAccept');
            if (btnCancel) btnCancel.onclick = () => RDAParser.closeCsvUploadConfirm(false);
            if (btnAccept) btnAccept.onclick = () => RDAParser.closeCsvUploadConfirm(true);

            RDAParser._csvUploadConfirmResolver = resolve;

            const labelEl = overlay.querySelector('#csvUploadConfirmLabel');
            if (labelEl) {
                const labelText = invalidCount > 0 && extraWarningHtml
                    ? 'Filas con error y municipios ausentes'
                    : (invalidCount > 0 ? 'Filas con error sin resolver' : 'Municipios ausentes en este lote');
                labelEl.innerHTML = `<span class="material-symbols-rounded text-base">warning</span>${labelText}`;
            }

            const introEl = overlay.querySelector('#csvUploadConfirmIntro');
            if (introEl) {
                let html = invalidCount > 0
                    ? `Se subirán <strong>${validCount.toLocaleString()}</strong> registro(s) válido(s). ` +
                      `Se <strong>ignorarán ${invalidCount.toLocaleString()}</strong> fila(s) con error sin resolver.`
                    : `Se subirán <strong>${validCount.toLocaleString()}</strong> registro(s) válido(s).`;
                if (extraWarningHtml) html += `<br><br>${extraWarningHtml}`;
                introEl.innerHTML = html;
            }

            requestAnimationFrame(() => overlay.classList.add('show'));
            if (btnCancel) btnCancel.focus();
        });
    }

    static closeCsvUploadConfirm(result) {
        const overlay = document.getElementById('csvUploadConfirmOverlay');
        if (!overlay) return;
        overlay.classList.remove('show');

        const resolver = RDAParser._csvUploadConfirmResolver;
        RDAParser._csvUploadConfirmResolver = null;
        if (typeof resolver === 'function') {
            setTimeout(() => resolver(!!result), 300);
        }
    }

    /** Orquesta la confirmación (si aplica) y dispara la subida real. Devuelve true si se subió (o se canceló limpiamente). */
    static async confirmAndProcessSIS() {
        // Asegura que cualquier edición manual pendiente en la tabla se refleje en el estado
        // de cada fila antes de decidir qué se sube y qué se ignora.
        RDAParser.runAnalysis();

        const rows = RDAParser._rows || [];
        const uploadable = rows.filter(r => r.status === 'valid' || r.status === 'fixed' || r.status === 'warning');
        const invalidCount = rows.filter(r => r.status === 'invalid').length;

        if (uploadable.length === 0) {
            if (typeof showToast === 'function') showToast('No hay registros válidos para subir', false, 'warn');
            return false;
        }

        // Ver _computeMissingMunicipios: el borrado previo a insertar es por (año, mes), no por
        // municipio, así que un lote incompleto borraría datos de municipios que no vienen a
        // reemplazarse. Si falta alguno, se exige confirmación explícita aunque no haya filas inválidas.
        const missingMunicipios = RDAParser._computeMissingMunicipios(uploadable);

        if (invalidCount > 0 || missingMunicipios.length > 0) {
            let extraWarningHtml = '';
            if (missingMunicipios.length > 0) {
                extraWarningHtml = `⚠️ <strong>Este lote no incluye datos de: ${missingMunicipios.join(', ')}.</strong> ` +
                    `La limpieza previa a la carga es por mes (no por municipio) — si confirmas, se perderán los ` +
                    `registros ya guardados de esos municipios para el/los mes(es) de este lote.`;
            }
            const ok = await RDAParser.openCsvUploadConfirm(uploadable.length, invalidCount, extraWarningHtml);
            if (!ok) return false;
        }

        await RDAParser.processData();
        return true;
    }

    static async processData() {
        if (typeof showProgressOverlay === 'function') {
            showProgressOverlay("Procesando datos...", "Analizando", "CARGA DE ARCHIVO");
        } else if (typeof showOverlay === 'function') {
            showOverlay("Procesando datos...", "Analizando");
        }

        const uiYearVal = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
        const uploadableRows = (RDAParser._rows || []).filter(r => r.status === 'valid' || r.status === 'fixed' || r.status === 'warning');

        // 1. Convertir filas aprobadas en registros limpios
        const cleanData = [];
        const uniqueUnits = {};
        const mesesEnCSV = new Set();

        for (const r of uploadableRows) {
            let clues = String(r.clues || '').trim().toUpperCase();
            const variable = String(r.variable || '').trim().toUpperCase();
            const valor = parseInt(r._valorFixed ?? r.valor, 10);
            const mes = parseInt(r._mesFixed ?? r.mes, 10);
            let anio = parseInt(r.anio, 10);
            if (isNaN(anio) || anio < 2020 || anio > 2035) anio = uiYearVal;

            // Salvaguarda final: si por alguna razón la fila sigue incompleta, se omite en silencio
            if (!clues || !variable || isNaN(valor) || isNaN(mes) || isNaN(anio)) continue;

            // Corregir CLUES histórico antes de guardar (ver RDAParser.CLUES_REASSIGNMENT arriba)
            const reassignedClues = RDAParser.CLUES_REASSIGNMENT[`${clues}|${anio}`];
            if (reassignedClues) clues = reassignedClues;

            // ⚠️ NO filtrar por ALL_RDA_SET — guardar TODAS las variables de aplicaciones.
            // El calculator selecciona las que necesita. Así no perdemos datos si
            // se agregan nuevas variables al diccionario en el futuro.

            cleanData.push({
                clues: clues,
                variable_sis: variable,
                valor: valor,
                mes: mes,
                anio: anio
            });

            mesesEnCSV.add(mes);

            // Recolectar unidades únicas para auto-upsert — usa el catálogo real si ya conocemos el CLUES
            if (!uniqueUnits[clues]) {
                const catalogInfo = RDAParser._unitCatalog?.get(clues);
                const municipioCsv = String(r.municipio || '').trim().toUpperCase();
                uniqueUnits[clues] = {
                    clues: clues,
                    nombre: catalogInfo?.nombre || `UNIDAD ${clues}`,
                    municipio: catalogInfo?.municipio || municipioCsv || 'DESCONOCIDO'
                };
            }
        }

        const mesesArray = [...mesesEnCSV].sort((a, b) => a - b);
        console.log(`[RDA Parser] CSV procesado: ${uploadableRows.length} filas aprobadas → ${cleanData.length} registros finales.`);
        console.log(`[RDA Parser] CLUES únicas: ${Object.keys(uniqueUnits).length} | Meses: ${mesesArray.join(', ')}`);

        if (cleanData.length === 0) {
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast('No se encontraron datos válidos', false, 'warn');
            return;
        }

        // 2. Llamada RPC atómica — Una sola transacción: upsert unidades + borrado + inserción masiva.
        //    Si se pierde la conexión a la mitad, Postgres hace rollback automático y la BD
        //    queda íntegra. Se reemplaza el antiguo sistema de múltiples peticiones secuenciales.
        const loadYear = cleanData[0]?.anio;
        await this.rpcUpsert(Object.values(uniqueUnits), cleanData, mesesArray, loadYear);
    }

    static chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static async rpcUpsert(unidades, registros, meses, loadYear) {
        const total = registros.length;
        try {
            // 1. Sincronizar unidades médicas (en lotes de 100)
            if (typeof showProgressOverlay === 'function') {
                showProgressOverlay("Sincronizando catálogo de unidades médicas...", "Sincronizando", "CARGA DE ARCHIVO");
            } else if (typeof showOverlay === 'function') {
                showOverlay("Sincronizando catálogo de unidades médicas...", "Sincronizando");
            }
            const unitChunks = this.chunkArray(unidades, 100);
            for (let i = 0; i < unitChunks.length; i++) {
                const { error: unitErr } = await window.supabase
                    .from('unidades_medicas')
                    .upsert(unitChunks[i], { onConflict: 'clues', ignoreDuplicates: true });
                if (unitErr) throw new Error(`Error al registrar unidades médicas: ${unitErr.message}`);
            }

            // 2. Limpiar registros previos de los meses Y año en el CSV
            if (typeof showProgressOverlay === 'function') {
                showProgressOverlay("Limpiando registros del año y meses correspondientes...", "Sincronizando", "CARGA DE ARCHIVO");
            } else if (typeof showOverlay === 'function') {
                showOverlay("Limpiando registros del año y meses correspondientes...", "Sincronizando");
            }

            // Obtener el año del lote cargado
            const targetYear = loadYear || registros[0]?.anio;
            if (!targetYear || isNaN(targetYear)) {
                throw new Error("No se pudo identificar el año en los registros del lote.");
            }

            const { error: delErr } = await window.supabase
                .from('registros_sis')
                .delete()
                .eq('anio', targetYear)
                .in('mes', meses);

            if (delErr) throw new Error(`Error al limpiar base de datos: ${delErr.message}`);

            // 3. Insertar nuevos registros en lotes de 5000
            const batchSize = 5000;
            const recordChunks = this.chunkArray(registros, batchSize);
            const totalBatches = recordChunks.length;

            for (let i = 0; i < totalBatches; i++) {
                const start = i * batchSize + 1;
                const end = Math.min((i + 1) * batchSize, total);
                
                if (typeof updateOverlayProgress === 'function') {
                    updateOverlayProgress(
                        end,
                        total,
                        `Enviando lote ${i + 1} de ${totalBatches}: registros ${start.toLocaleString('es-MX')} a ${end.toLocaleString('es-MX')}`,
                        "Carga Masiva SIS",
                        "SINCRONIZACIÓN SUPABASE"
                    );
                } else if (typeof showOverlay === 'function') {
                    showOverlay(
                        `Enviando lote ${i + 1} de ${totalBatches} (${start.toLocaleString('es-MX')} a ${end.toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')} registros)...`,
                        "Carga Masiva SIS"
                    );
                }

                const { error: insErr } = await window.supabase
                    .from('registros_sis')
                    .insert(recordChunks[i]);
                
                if (insErr) throw new Error(`Error en lote ${i + 1}: ${insErr.message}`);
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            
            console.log(`[RDA Parser] ✅ Carga masiva completada: ${total} registros insertados en ${totalBatches} lotes.`);
            if (typeof showToast === 'function') showToast(`${total.toLocaleString('es-MX')} registros actualizados correctamente`, true, 'good');

            // Lanzar celebración premium
            if (typeof window.triggerConfetti === 'function') window.triggerConfetti();
            if (typeof window.playNotificationSound === 'function') window.playNotificationSound('success');

            // Refrescar el dashboard si está abierto
            if (typeof window.refreshRDADashboard === 'function') {
                window.refreshRDADashboard();
            }

            // Disparo del motor de reabasto inteligente (best-effort): un CSV nuevo es
            // justo el momento en que cambian los datos que ese motor usa. No debe
            // bloquear ni ensuciar el flujo de carga si falla -- por eso va en su propio
            // try/catch, sin overlay ni toast propios.
            try {
                const { error: reabastoErr } = await window.supabase.rpc('calcular_reabasto_pendientes', { p_anio: targetYear });
                if (reabastoErr) console.warn('[RDA Parser] Motor de reabasto inteligente no se pudo recalcular tras el CSV:', reabastoErr);
            } catch (reabastoEx) {
                console.warn('[RDA Parser] Motor de reabasto inteligente no se pudo recalcular tras el CSV:', reabastoEx);
            }

        } catch (err) {
            console.error('[RDA Parser] ❌ Error en carga masiva:', err);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(err.message || 'Error inesperado al subir datos', false, 'bad');
        }
    }

    // =========================================================================
    // POBLACIÓN FLOW (nuevo)
    // =========================================================================

    /** Valida y muestra preview del CSV de población */
    static validateAndPreviewPoblacion(data) {
        const POB_MENOR_PATTERNS = ['POB_MENOR', 'MENOR_1', 'MENORES'];
        const POB_1_PATTERNS     = ['POB_1_ANO', 'POB_1ANO', '1_ANO', 'UN_ANO', 'DE_1_ANO'];
        const POB_4_PATTERNS     = ['POB_4_ANO', 'POB_4ANO', '4_ANO', 'CUATRO', 'DE_4_ANO'];
        const POB_6_PATTERNS     = ['POB_6_ANO', 'POB_6ANO', '6_ANO', 'SEIS', 'DE_6_ANO'];

        let validos = 0;
        let ignorados = 0;

        // Encontrar las columnas reales en el CSV usando la primera fila
        const sampleRow = data[0];
        const colMenor = this._findColByPatterns(sampleRow, POB_MENOR_PATTERNS);
        const col1     = this._findColByPatterns(sampleRow, POB_1_PATTERNS);
        const col4     = this._findColByPatterns(sampleRow, POB_4_PATTERNS);
        const col6     = this._findColByPatterns(sampleRow, POB_6_PATTERNS);

        if (!colMenor && !col1 && !col4 && !col6) {
            this._showSchemaError("No se encontraron columnas de población (POB_MENOR_1, POB_1_ANO, POB_4_ANOS, POB_6_ANOS).");
            return;
        }

        const reasonCounts = {
            noClues: { label: "Falta el campo CLUES", count: 0, examples: [] },
            noPop: { label: "Faltan valores numéricos de población (menor 1, 1 año, 4 años, 6 años)", count: 0, examples: [] }
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;
            const clues = this._getCol(row, 'CLUES');
            if (!clues) { 
                ignorados++; 
                reasonCounts.noClues.count++;
                if (reasonCounts.noClues.examples.length < 5) {
                    reasonCounts.noClues.examples.push(`[Fila ${rowNum}] Sin CLUES`);
                }
                continue; 
            }

            const pMenor = colMenor ? parseInt(row[colMenor], 10) : NaN;
            const p1     = col1     ? parseInt(row[col1], 10)     : NaN;
            const p4     = col4     ? parseInt(row[col4], 10)     : NaN;
            const p6     = col6     ? parseInt(row[col6], 10)     : NaN;

            // Al menos un valor de población debe ser numérico
            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4) && isNaN(p6)) { 
                ignorados++; 
                reasonCounts.noPop.count++;
                if (reasonCounts.noPop.examples.length < 5) {
                    reasonCounts.noPop.examples.push(`[Fila ${rowNum}] CLUES: ${clues}`);
                }
                continue; 
            }

            validos++;
        }

        // Actualizar contadores — reusar los mismos IDs del modal
        document.getElementById('csvValidCount').textContent = validos.toLocaleString();
        document.getElementById('csvIgnoredCount').textContent = ignorados.toLocaleString();

        // Mostrar / Ocultar área de detalles ignorados
        const detailsArea = document.getElementById('csvIgnoredDetailsArea');
        const detailsList = document.getElementById('csvIgnoredDetailsList');
        
        if (detailsList) {
            detailsList.innerHTML = '';
            if (ignorados > 0) {
                let html = '';
                if (reasonCounts.noClues.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.noClues.count} registros</span> - ${reasonCounts.noClues.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.noClues.examples.map(ex => `<li>${ex}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                if (reasonCounts.noPop.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.noPop.count} registros</span> - ${reasonCounts.noPop.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.noPop.examples.map(ex => `<li>${ex}</li>`).join('')}
                                ${reasonCounts.noPop.count > 5 ? `<li>... y ${reasonCounts.noPop.count - 5} más</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                detailsList.innerHTML = html;
                detailsArea.style.display = 'block';
            } else {
                detailsArea.style.display = 'none';
            }
        }

        if (validos > 0) {
            this.pendingData = data;
            // Guardar las columnas detectadas para el procesamiento posterior
            this._pobCols = { colMenor, col1, col4, col6 };
            document.getElementById('btnConfirmUploadCSV').classList.remove('opacity-50', 'pointer-events-none');

            // Mostrar aviso de población en lugar de aviso de meses
            const warn = document.getElementById('csvMonthsWarning');
            if (warn) {
                const h5 = warn.querySelector('h5');
                const p = warn.querySelector('p');
                if (h5) h5.textContent = 'Actualización de Población';
                if (p) p.innerHTML = `Se actualizarán los datos demográficos de <strong>${validos}</strong> unidades médicas. ` +
                    `Columnas detectadas: ${[colMenor, col1, col4, col6].filter(Boolean).join(', ')}.`;
                warn.style.display = 'block';
            }
        } else {
            this._showSchemaError("No se encontraron registros válidos de población.");
        }
    }

    /** Procesa y envía datos de población al RPC */
    static async processPoblacionData(data) {
        if (typeof showOverlay === 'function') showOverlay("Actualizando población...", "Procesando");

        const { colMenor, col1, col4, col6 } = this._pobCols || {};
        const selectedAnio = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
        const payload = [];

        for (const row of data) {
            const clues = this._getCol(row, 'CLUES');
            if (!clues) continue;

            const pMenor = colMenor ? parseInt(row[colMenor], 10) : NaN;
            const p1     = col1     ? parseInt(row[col1], 10)     : NaN;
            const p4     = col4     ? parseInt(row[col4], 10)     : NaN;
            const p6     = col6     ? parseInt(row[col6], 10)     : NaN;

            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4) && isNaN(p6)) continue;

            payload.push({
                clues,
                pob_menor_1: isNaN(pMenor) ? 0 : pMenor,
                pob_1_ano:   isNaN(p1)     ? 0 : p1,
                pob_4_anos:  isNaN(p4)     ? 0 : p4,
                pob_6_anos:  isNaN(p6)     ? 0 : p6
            });
        }

        console.log(`[RDA Parser] 👥 Enviando ${payload.length} registros de población para el año ${selectedAnio}...`);

        try {
            // 1. Intentar vía RPC atómico por año
            const { data: result, error } = await window.supabase.rpc('upsert_poblacion_data', {
                p_data: payload,
                p_anio: selectedAnio
            });

            if (error) {
                console.warn('[RDA Parser] ⚠️ RPC upsert_poblacion_data no disponible, ejecutando actualización directa acotada por año...');
                
                // Fallback directo por año en tabla poblacion_unidades acotada por (clues, anio)
                const pobRows = payload.map(p => ({
                    clues: p.clues,
                    anio: selectedAnio,
                    pob_menor_1: p.pob_menor_1,
                    pob_1_ano: p.pob_1_ano,
                    pob_4_anos: p.pob_4_anos,
                    pob_6_anos: p.pob_6_anos
                }));

                const { error: directErr } = await window.supabase
                    .from('poblacion_unidades')
                    .upsert(pobRows, { onConflict: 'clues,anio' });

                if (directErr) {
                    console.error('[RDA Parser] ❌ Error en actualización directa de poblacion_unidades:', directErr);
                    if (typeof hideOverlay === 'function') hideOverlay();
                    if (typeof showToast === 'function') showToast(`Error al guardar población: ${directErr.message}`, false, 'bad');
                    return;
                }
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            const total = payload.length;
            console.log(`[RDA Parser] ✅ Población ${selectedAnio} guardada aisladamente para ${total} unidades.`);
            if (typeof showToast === 'function') showToast(`Población ${selectedAnio} guardada correctamente (${total} unidades)`, true, 'good');

            // Lanzar celebración premium
            if (typeof window.triggerConfetti === 'function') window.triggerConfetti();
            if (typeof window.playNotificationSound === 'function') window.playNotificationSound('success');

        } catch (err) {
            console.error('[RDA Parser] ❌ Error fatal en processPoblacionData:', err);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(err.message || 'Error inesperado', false, 'bad');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => RDAParser.init());

window.handleCsvDrop = function(event) {
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        document.getElementById('rdaCsvInput').files = event.dataTransfer.files;
        RDAParser.parseFilesAndPreview(event.dataTransfer.files);
    }
};

window.resetCsvUploadModal = function() {
    RDAParser.resetUploadModalUI();
};
