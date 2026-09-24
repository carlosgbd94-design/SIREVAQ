(() => {
    // 💉 SIREVAQ_CATALOG: Copia local del catálogo único de biológicos (main.js no se carga en mobile.html).
    // Debe mantenerse en sincronía con la definición homónima en main.js.
    if (!window.SIREVAQ_CATALOG) {
        window.SIREVAQ_CATALOG = {
            "bcg":            { key: "bcg", label: "BCG", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 10, color: "#3B82F6" },
            "hepatitis_b":    { key: "hepatitis_b", label: "HEPATITIS B", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 10, color: "#2563EB" },
            "hexavalente":    { key: "hexavalente", label: "HEXAVALENTE", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#059669" },
            "dpt":            { key: "dpt", label: "DPT", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 10, color: "#D97706" },
            "rotavirus":      { key: "rotavirus", label: "ROTAVIRUS", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#7C3AED" },
            "neumococica_13": { key: "neumococica_13", label: "NEUMOCÓCICA 13", isEsquemaBasico: true, requiresPriorHistory: true, dosesPerVial: 1, color: "#3D405B" },
            "neumococica_20": { key: "neumococica_20", label: "NEUMOCÓCICA 20", isEsquemaBasico: true, requiresPriorHistory: true, dosesPerVial: 1, color: "#4B5563" },
            "srp":            { key: "srp", label: "SRP", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#DC2626" },
            "sr":             { key: "sr", label: "SR", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 10, color: "#EA580C" },
            "vph":            { key: "vph", label: "VPH", isEsquemaBasico: false, requiresPriorHistory: false, dosesPerVial: 1, color: "#DB2777" },
            "varicela":       { key: "varicela", label: "VARICELA", isEsquemaBasico: false, requiresPriorHistory: false, dosesPerVial: 1, color: "#9333EA" },
            "hepatitis_a":    { key: "hepatitis_a", label: "HEPATITIS A", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#0284C7" },
            "td":             { key: "td", label: "TD", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 10, color: "#65A30D" },
            "tdpa":           { key: "tdpa", label: "TDPA", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#16A34A" },
            "covid_19":       { key: "covid_19", label: "COVID-19", isEsquemaBasico: false, requiresPriorHistory: false, dosesPerVial: 6, color: "#0891B2" },
            "influenza":      { key: "influenza", label: "INFLUENZA", isEsquemaBasico: false, requiresPriorHistory: false, dosesPerVial: 10, color: "#CA8A04" },
            "vsr":            { key: "vsr", label: "VSR", isEsquemaBasico: true, requiresPriorHistory: false, dosesPerVial: 1, color: "#4F46E5" }
        };
    }

    if (!window.normalizeBioKey) {
        window.normalizeBioKey = function(str) {
            if (!str) return "";
            const raw = String(str).toLowerCase()
                .normalize("NFD")
                .replace(new RegExp("[̀-ͯ]", "g"), "")
                .replace(/[^a-z0-9]/g, "");

            if (raw.includes("neumo")) return raw.includes("20") ? "neumococica_20" : "neumococica_13";
            if (raw.includes("hepatitisb")) return "hepatitis_b";
            if (raw.includes("hepatitisa")) return "hepatitis_a";
            if (raw.includes("hexavalente") || raw.includes("hexa")) return "hexavalente";
            if (raw.includes("rotavirus") || raw.includes("rotav")) return "rotavirus";
            if (raw.includes("varic")) return "varicela";
            if (raw.includes("influ")) return "influenza";
            if (raw.includes("covid")) return "covid_19";
            if (raw.includes("tdpa")) return "tdpa";
            if (raw === "td" || raw.includes("td")) return "td";
            if (raw.includes("vsr")) return "vsr";
            if (raw.includes("srp")) return "srp";
            if (raw === "sr" || raw.includes("sr")) return "sr";
            if (raw.includes("vph")) return "vph";
            if (raw.includes("dpt")) return "dpt";
            if (raw.includes("bcg")) return "bcg";

            return raw;
        };
    }

    if (!window.getBioMetadata) {
        window.getBioMetadata = function(str) {
            const key = window.normalizeBioKey(str);
            return window.SIREVAQ_CATALOG[key] || { key: key, label: String(str || '').toUpperCase().trim(), isEsquemaBasico: false, requiresPriorHistory: false, dosesPerVial: 10, color: "#64748B" };
        };
    }

    if (!window.isBioEsquemaBasico) {
        window.isBioEsquemaBasico = function(str) {
            const meta = window.getBioMetadata(str);
            return Boolean(meta && meta.isEsquemaBasico);
        };
    }

    // --- Configuración Global ---
    const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4"; 

    let supabaseClient = null;
    let currentUser = null;
    let currentProfile = null;
    let activePanel = 'SR';
    let biologicosCatalogo = [];
    let biologicosParams = [];
    let lotesCatalogo = [];
    // Lotes NORMAL de TODOS los municipios (sin filtrar al propio) -- solo se
    // usa cuando el "Origen" de una tarjeta de Existencia es Préstamo
    // (desabasto/A.R.F.), para poder capturar un lote que nunca se le surtió
    // a tu municipio pero que físicamente te prestó otro. Mismo criterio que
    // ALL_LOTES_NORMAL en main.js (escritorio).
    let allLotesNormal = [];

    let hasTodaySR = false;
    let hasTodayCONS = false;
    let hasTodayBIO = false;
    let hasActivePinol = false;
    let pinolFlowStatus = "NONE"; // NONE | PENDING | DELIVERED
    let pinolCacheLoaded = false; // true tras la primera respuesta real de checkCapturesState
    let PINOL_SOLICITUDES_CHANNEL_MOBILE = null;

    let isEditingSR = false;
    let isEditingCONS = false;
    let isEditingBIO = false;
    let targetPedidoDate = "";
    let canCaptureBioGlobal = true;
    let canCaptureConsGlobal = true;
    let canCaptureSRGlobal = true;
    let mobileConfettiInstance = null;
    let srPrefillSnapshot = null; // items del último reporte SR precargado, para detectar guardado sin cambios
    let srPrefillGapInfo = null;  // {diffDays, missedWeeks, lastDate} cuando el salto desde la última captura es >= 9 días
    let recentErrors = [];
    const originalConsoleError = console.error;
    console.error = function(...args) {
        recentErrors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        if (recentErrors.length > 5) recentErrors.shift();
        originalConsoleError.apply(console, args);
    };

    // 🔄 retryWithBackoff: Reintenta una operación asíncrona ante fallos de red móviles
    const retryWithBackoff = async (fn, retries = 3, delay = 1000, factor = 2) => {
        let currentDelay = delay;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                const isNetworkError = !error.status || (error.status >= 500 && error.status <= 599) || error.message?.toLowerCase().includes("failed to fetch") || error.message?.toLowerCase().includes("network");
                if (!isNetworkError || i === retries - 1) {
                    throw error;
                }
                console.warn(`[Mobile Retry] Intento ${i + 1} fallido. Reintentando en ${currentDelay}ms...`, error);
                await new Promise(res => setTimeout(res, currentDelay));
                currentDelay *= factor;
            }
        }
    };

    const INDICATOR_W = 50; // Circular pointer width/height

    // Drag state for Selection Dock
    let isDraggingDock = false;
    let dragStartX = 0;
    let dockLeftOffset = 0;

    // --- Audio & Confetti Haptic Helpers ---
    const playNotificationSound = (type = "success") => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            if (type === "success" || type === "sent") {
                const notes = [
                    { f: 523.25, d: 0.3, t: 0.0 },  // C5
                    { f: 659.25, d: 0.3, t: 0.08 }, // E5
                    { f: 783.99, d: 0.3, t: 0.16 }, // G5
                    { f: 1046.50, d: 0.5, t: 0.24 } // C6
                ];
                notes.forEach(note => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = "sine";
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.frequency.setValueAtTime(note.f, now + note.t);
                    g.gain.setValueAtTime(0.1, now + note.t);
                    g.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);
                    o.start(now + note.t);
                    o.stop(now + note.t + note.d);
                });
            } else if (type === "error" || type === "bad") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(120, now + 0.25);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (e) {
            console.warn("AudioContext failed:", e);
        }
    };

    const triggerConfettiCelebration = () => {
        try {
            if (typeof window.confetti === "function") {
                let canvas = document.getElementById("mobile-confetti-canvas");
                if (!canvas) {
                    canvas = document.createElement("canvas");
                    canvas.id = "mobile-confetti-canvas";
                    canvas.style.position = "fixed";
                    canvas.style.inset = "0";
                    canvas.style.width = "100vw";
                    canvas.style.height = "100vh";
                    canvas.style.pointerEvents = "none";
                    canvas.style.zIndex = "999999";
                    document.body.appendChild(canvas);
                }

                if (!mobileConfettiInstance) {
                    mobileConfettiInstance = window.confetti.create(canvas, {
                        resize: true,
                        useWorker: false
                    });
                }

                const palette = ['#003366', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                mobileConfettiInstance({
                    particleCount: 50,
                    spread: 60,
                    origin: { x: 0.2, y: 0.8 },
                    colors: palette
                });
                mobileConfettiInstance({
                    particleCount: 50,
                    spread: 60,
                    origin: { x: 0.8, y: 0.8 },
                    colors: palette
                });

                setTimeout(() => {
                    if (mobileConfettiInstance) {
                        mobileConfettiInstance.reset();
                    }
                }, 4000);
            }
        } catch (e) {
            console.warn("Mobile Confetti failed:", e);
        }
    };

    // --- Toast Alerts ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-rounded text-lg">${type === 'success' ? 'check_circle' : 'error'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        // Triggers for Haptics, vibration & sound
        if (type === 'success') {
            playNotificationSound('success');
            if (navigator.vibrate) navigator.vibrate(120);
            triggerConfettiCelebration();
        } else if (type === 'error') {
            playNotificationSound('error');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 150]);
            
            // Screen shake
            const mainApp = document.getElementById('mainApp') || document.body;
            mainApp.classList.remove('shake-organic');
            void mainApp.offsetWidth; // Force layout recalculation
            mainApp.classList.add('shake-organic');
            setTimeout(() => {
                mainApp.classList.remove('shake-organic');
            }, 600);
        }

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- Expiration Utilities ---
    const getShelfLifeClass = (cad) => {
        if (!cad) return "";
        let cadDate = new Date(cad + "T00:00:00");
        if (isNaN(cadDate.getTime())) return "";

        const today = new Date();
        const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const diffMonths = (cadDate.getFullYear() - firstOfCurrentMonth.getFullYear()) * 12 + (cadDate.getMonth() - firstOfCurrentMonth.getMonth());

        if (diffMonths <= 3) return "shelf-life-danger"; // Expirado/Crítico
        if (diffMonths <= 6) return "shelf-life-warn";   // Alerta
        return "shelf-life-ok";
    };

    // 💉 Vacunas multidosis que exigen fecha de apertura (28 días de vigencia).
    // Excluye BCG y SR por el manual, y COVID-19 porque su lineamiento cambia según la marca de cada temporada.
    const VACCINES_REQUIRE_APERTURA = ["TD", "DPT", "INFLUENZA", "HEPATITIS B"];
    const APERTURA_FRASCO_LIMITE_DIAS = 28;

    const getAperturaStatus = (fechaApertura) => {
        if (!fechaApertura) return null;
        const dOpen = new Date(fechaApertura + "T00:00:00");
        const now = new Date();
        dOpen.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((now - dOpen) / (1000 * 60 * 60 * 24));
        const daysLeft = APERTURA_FRASCO_LIMITE_DIAS - diffDays;

        let cls = "shelf-life-ok", icon = "check_circle", text = `${daysLeft} día${daysLeft === 1 ? "" : "s"} restantes`;
        if (daysLeft <= 0) { cls = "shelf-life-danger"; icon = "error"; text = "Vencido, descartar"; }
        else if (daysLeft <= 5) { cls = "shelf-life-warn"; icon = "warning"; text = `${daysLeft} día${daysLeft === 1 ? "" : "s"} restantes`; }

        return { daysLeft, cls, icon, text };
    };

    const formatToMmmAa = (cad) => {
        if (!cad) return "—";
        const parts = cad.split('-');
        if (parts.length < 3) return cad;
        
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        const mIdx = parseInt(parts[1]) - 1;
        const yy = parts[0].substring(2);
        
        return `${months[mIdx]}-${yy}`;
    };

    // --- Initialize Supabase ---
    const initSupabase = () => {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    experimental: {
                        passkey: true
                    }
                }
            });
            checkSession();
        } else {
            showToast("Error de conexión con base de datos. Reintente.", "error");
        }
    };

    // --- Autenticación ---
    const checkSession = async () => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                await handleAuthSuccess(session.user);
            }
        } catch (e) {
            console.error("Session check error:", e);
        } finally {
            const loader = document.getElementById('premiumLoadingScreen');
            if (loader) loader.classList.add('hidden');
        }
    };

    const handleAuthSuccess = async (user) => {
        currentUser = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        showToast("Sesión iniciada correctamente");
        
        initTheme();
        await fetchProfile();
        await fetchCatalogs();
        await fetchTargetDate();
        canCaptureConsGlobal = checkConsumiblesCaptureWindow();
        
        // SR capture follows the same window as BIO (Thursday/Friday) or Wednesday holiday overrides
        const d_dow = new Date().getDay();
        let isSRDay = (d_dow === 4 || d_dow === 5);
        if (d_dow === 3) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const Friday = new Date();
            Friday.setDate(Friday.getDate() + 2);
            if (isMexicanHoliday(tomorrow) && isMexicanHoliday(Friday)) {
                isSRDay = true;
            }
        }
        
        // Manual override check in aperturas_existencia
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: extOverride } = await supabaseClient
                .from('aperturas_existencia')
                .select('*')
                .eq('fecha', todayStr)
                .eq('activo', 'SI')
                .maybeSingle();
            if (extOverride) {
                isSRDay = true;
            }
        } catch (errOverride) {
            console.warn("Error fetching aperturas_existencia override:", errOverride);
        }

        canCaptureSRGlobal = isSRDay;

        await fetchLotes();
        await loadCompliance();
        await checkCapturesState();
        await loadNotifications();
        await loadFiles();
        loadWeather();
        initNotificationsRealtime();
        initPinolRealtimeMobile();
        
        // Initialize the physics-based glass shaders and copy the clone-world content
        initDockGlass();
        const cloneWorld = document.getElementById('dockCloneWorld');
        if (cloneWorld) {
            // Render the clone background using a realistic representation of the app gradient and glowing nodes
            cloneWorld.innerHTML = `
                <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #f1f4f8, #e2e8f0); opacity: 0.95;"></div>
                <div style="position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.35; background: #3b82f6; width: 140px; height: 140px; top: -70px; left: 20px;"></div>
                <div style="position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.35; background: #10b981; width: 140px; height: 140px; bottom: -70px; right: 20px;"></div>
            `;
            if (document.documentElement.classList.contains('dark')) {
                cloneWorld.innerHTML = `
                    <div style="position: absolute; inset: 0; background: #000000; opacity: 0.95;"></div>
                    <div style="position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.25; background: #1e3a8a; width: 140px; height: 140px; top: -70px; left: 20px;"></div>
                    <div style="position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.25; background: #064e3b; width: 140px; height: 140px; bottom: -70px; right: 20px;"></div>
                `;
            }
        }
        
        switchPanel('SR');
        initDockDrag();
    };

    const fetchProfile = async () => {
        if (!currentUser) return;
        
        let res;
        try {
            res = await retryWithBackoff(() => supabaseClient
                .from('perfiles')
                .select('*')
                .eq('id', currentUser.id)
                .single()
            );
        } catch (e) {
            res = { data: null, error: e };
        }
        const { data, error } = res;

        if (error || !data) {
            console.warn("Profile error, using metadata fallback:", error);
            currentProfile = {
                id: currentUser.id,
                usuario: currentUser.email,
                rol: currentUser.user_metadata?.rol || "UNIDAD",
                clues: currentUser.user_metadata?.clues || "QTSSA012154",
                unidad: currentUser.user_metadata?.unidad || "OFICINAS DE LA JURISDICCION SANITARIA",
                municipio: currentUser.user_metadata?.municipio || "Querétaro",
                activo: "SI"
            };
        } else {
            currentProfile = data;
        }
        const dataProfile = currentProfile;
        document.getElementById('profileName').textContent = dataProfile.nombre || dataProfile.usuario || currentUser.email;
        document.getElementById('profileRole').textContent = dataProfile.rol || 'UNIDAD';
        refreshProfileContactUiMobile();
        
        const isAdmin = dataProfile.rol === 'ADMIN' || dataProfile.rol === 'JURISDICCIONAL';
        document.getElementById('profileClues').textContent = dataProfile.clues || (isAdmin ? 'QTSSA012154 (Jurisdicción 1)' : 'Ninguna');
        document.getElementById('profileUnidad').textContent = dataProfile.unidad || (isAdmin ? 'Jurisdicción JS1' : 'No asignada');
        document.getElementById('profileMunicipio').textContent = dataProfile.municipio || (isAdmin ? 'Querétaro' : 'Ninguno');
        document.getElementById('profileAllowed').textContent = dataProfile.municipios_allowed || (isAdmin ? 'Todos' : 'Ninguno');

        // BCG button mobile dynamic visibility (Unidad non-UMME/FAM only)
        const btnSetBCGMobile = document.getElementById('btnSetBCGMobile');
        if (btnSetBCGMobile) {
            const isUnidad = dataProfile.rol === 'UNIDAD';
            const cluesUpper = String(dataProfile.clues || "").toUpperCase();
            const nameUpper = String(dataProfile.usuario || currentUser.email || "").toUpperCase();
            const isUmmeOrFam = cluesUpper.includes("UMME") || cluesUpper.includes("FAM") || nameUpper.includes("UMME") || nameUpper.includes("FAM") || dataProfile.rol === "CARAVANAS";
            if (isUnidad && !isUmmeOrFam) {
                btnSetBCGMobile.classList.remove('hidden');
            } else {
                btnSetBCGMobile.classList.add('hidden');
            }
        }
    };

    // --- Perfil > Cuenta: datos de contacto y cambio de contraseña con código por correo ---
    // Los diálogos viven en perfil_cuenta.js (compartido con el escritorio).
    const refreshProfileContactUiMobile = () => {
        const p = currentProfile || {};
        const t = String(p.telefono || '');
        const tel = t.length === 10 ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : t;
        const partes = [p.nombre, tel].filter(Boolean);
        const summary = document.getElementById('profileContactSummaryMobile');
        if (summary) summary.textContent = partes.length ? partes.join(' · ') : 'Agrega tu nombre y teléfono';
        const nameEl = document.getElementById('profileName');
        if (nameEl && currentUser) nameEl.textContent = p.nombre || p.usuario || currentUser.email;
    };

    const ensurePerfilCuenta = () => {
        if (!window.PerfilCuenta) {
            showToast("No se pudo cargar el módulo de perfil. Recarga la página.", "error");
            return false;
        }
        if (!window.__perfilCuentaInit) {
            window.PerfilCuenta.init({
                getClient: () => supabaseClient,
                getUser: () => ({
                    uid: currentUser?.id,
                    email: currentUser?.email,
                    nombre: currentProfile?.nombre || '',
                    telefono: currentProfile?.telefono || ''
                }),
                redirectTo: window.location.origin + window.location.pathname.replace('mobile.html', '') + 'reset.html',
                toast: (msg, kind) => showToast(msg, kind === 'bad' ? 'error' : 'success'),
                onContactSaved: (c) => {
                    if (currentProfile) { currentProfile.nombre = c.nombre; currentProfile.telefono = c.telefono; }
                    refreshProfileContactUiMobile();
                },
                onPasswordChanged: async () => {
                    if (currentUser?.id) await supabaseClient.from('perfiles').update({ must_change: false }).eq('id', currentUser.id);
                }
            });
            window.__perfilCuentaInit = true;
        }
        return true;
    };

    window.openContactoModal = () => {
        if (!ensurePerfilCuenta()) return;
        document.getElementById('profileDropdown')?.classList.add('hidden');
        window.PerfilCuenta.openContacto();
    };
    // También lo usa feedback_autoreply.js ("Cambiar mi contraseña")
    window.openChangePasswordFlow = () => {
        if (!ensurePerfilCuenta()) return;
        document.getElementById('profileDropdown')?.classList.add('hidden');
        window.PerfilCuenta.openCambiarPassword();
    };

    const normalizeString = (str) => {
        if (!str) return "";
        let normalized = String(str)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
        
        // Alias mapping to resolve catalog mismatches on different versions/platforms
        if (normalized === "NEUMO 13" || normalized === "NEUMOCOCCICA 13" || normalized === "NEUMOCOCICA 13") {
            return "NEUMOCÓCICA 13";
        }
        if (normalized === "NEUMO 20" || normalized === "NEUMOCOCCICA 20" || normalized === "NEUMOCOCICA 20") {
            return "NEUMOCÓCICA 20";
        }
        return normalized;
    };

    const fetchCatalogs = async () => {
        let catData, catError;
        try {
            const res = await retryWithBackoff(() => supabaseClient
                .from('biologicos_catalogo')
                .select('*')
                .order('orden_biologico')
            );
            catData = res.data;
            catError = res.error;
        } catch (e) {
            catError = e;
        }

        if (catError) {
            console.error("fetchCatalogs master catalog error:", catError);
            showToast("Error catálogos: " + catError.message, "error");
            return;
        }

        if (catData) {
            biologicosCatalogo = catData;
        }

        if (currentProfile) {
            const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
            const cluesFilter = (isAdmin ? 'QTSSA012154' : (currentProfile.clues || '*')).trim().toUpperCase();

            let paramsData, paramsError;
            try {
                const res = await retryWithBackoff(() => supabaseClient
                    .from('biologicos_params')
                    .select('*')
                    .in('clues', [cluesFilter, '*'])
                );
                paramsData = res.data;
                paramsError = res.error;
            } catch (e) {
                paramsError = e;
            }

            if (paramsError) {
                console.error("fetchCatalogs params error:", paramsError);
                showToast("Error parámetros: " + paramsError.message, "error");
                return;
            }

            if (paramsData && paramsData.length > 0) {
                biologicosParams = paramsData;

                biologicosCatalogo.forEach(bio => {
                    const bioNormalized = normalizeString(bio.biologico);
                    const matchedParam = paramsData.find(p => 
                        normalizeString(p.biologico) === bioNormalized && String(p.clues).trim().toUpperCase() === cluesFilter
                    ) || paramsData.find(p => 
                        normalizeString(p.biologico) === bioNormalized && String(p.clues).trim().toUpperCase() === '*'
                    );
                    
                    if (matchedParam) {
                        bio.promedio_frascos = matchedParam.promedio_frascos || 0;
                        bio.min_dosis = matchedParam.min_dosis || 0;
                        bio.max_dosis = matchedParam.max_dosis || 0;
                    } else {
                        bio.promedio_frascos = 0;
                        bio.min_dosis = 0;
                        bio.max_dosis = 0;
                    }
                });
            }
        }
    };

    const prefillBIOReport = async () => {
        if (!currentProfile || !targetPedidoDate) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        const { data: savedItems, error } = await supabaseClient
            .from('biologicos_pedido')
            .select('*')
            .eq('clues', cluesFilter)
            .eq('fecha_pedido_programada', targetPedidoDate);

        if (error) {
            console.error("prefillBIOReport error:", error);
            showToast("Error pre-llenado BIO: " + error.message, "error");
            return;
        }

        if (savedItems && savedItems.length > 0) {
            const nombreBIOInput = document.getElementById('nombreBIO');
            if (nombreBIOInput && savedItems[0].capturado_por) {
                nombreBIOInput.value = savedItems[0].capturado_por;
            }
            const chkNoPedido = document.getElementById('chkNoPedido');
            if (chkNoPedido) {
                chkNoPedido.checked = !!savedItems[0].sin_pedido;
                chkNoPedido.dispatchEvent(new Event('change'));
            }

            savedItems.forEach(item => {
                const matchedBio = biologicosCatalogo.find(b => normalizeString(b.biologico) === normalizeString(item.biologico));
                if (matchedBio) {
                    const existInput = document.querySelector(`input[data-bio-id="${matchedBio.id}"][data-field="existencia"]`);
                    const pedInput = document.querySelector(`input[data-bio-id="${matchedBio.id}"][data-field="pedido"]`);
                    if (existInput) {
                        existInput.value = item.existencia_actual_frascos || 0;
                        existInput.dispatchEvent(new Event('input'));
                    }
                    if (pedInput) {
                        pedInput.value = item.pedido_frascos || 0;
                        pedInput.dispatchEvent(new Event('input'));
                    }
                }
            });
            hasTodayBIO = true;
            syncCommandHub();
        }
    };

    const prefillCONSReport = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        const today = new Date().toISOString().split('T')[0];

        const { data: savedItem, error } = await supabaseClient
            .from('consumibles')
            .select('*')
            .eq('clues', cluesFilter)
            .eq('fecha', today)
            .maybeSingle();

        if (error) {
            console.error("prefillCONSReport error:", error);
            return;
        }

        if (savedItem) {
            const nombreInput = document.getElementById('nombreCONS');
            const srpInput = document.getElementById('srp_dosis');
            const srInput = document.getElementById('sr_dosis');
            const j05Input = document.getElementById('jeringa_aplic_05ml_0605502657');
            const j50Input = document.getElementById('jeringa_reconst_5ml_0605500438');
            const agujaInput = document.getElementById('aguja_0600403711');
            const chkSinMov = document.getElementById('chkSinMovimientoCONS');

            if (nombreInput) nombreInput.value = savedItem.capturado_por || '';
            if (srpInput) {
                srpInput.value = savedItem.srp_dosis ?? 0;
                srpInput.dispatchEvent(new Event('input'));
            }
            if (srInput) {
                srInput.value = savedItem.sr_dosis ?? 0;
                srInput.dispatchEvent(new Event('input'));
            }
            if (j05Input) {
                j05Input.value = savedItem.jeringa_aplic_05ml_0605502657 ?? 0;
                j05Input.dispatchEvent(new Event('input'));
            }
            if (j50Input) {
                j50Input.value = savedItem.jeringa_reconst_5ml_0605500438 ?? 0;
                j50Input.dispatchEvent(new Event('input'));
            }
            if (agujaInput) {
                agujaInput.value = savedItem.aguja_0600403711 ?? 0;
                agujaInput.dispatchEvent(new Event('input'));
            }
            
            if (chkSinMov) {
                chkSinMov.checked = (savedItem.sin_movimiento === "SI" || savedItem.sin_movimiento === true);
                chkSinMov.dispatchEvent(new Event('change'));
            }
            
            hasTodayCONS = true;
            syncCommandHub();
        }
    };

    // Misma normalización que normalizeTextKey_ en main.js, para comparar municipios
    // de forma consistente entre escritorio y móvil (acentos/mayúsculas/alias).
    const normalizeMunicipioKey = (v) => {
        let s = String(v ?? "")
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/\s+/g, " ");
        if (s === "MARQUES" || s === "EL MARQUES") return "EL MARQUES";
        return s;
    };

    const fetchLotes = async () => {
        const { data, error } = await supabaseClient.from('lotes').select('*');
        if (error) {
            console.error("fetchLotes error:", error);
            showToast("Error lotes: " + error.message, "error");
            return;
        }
        if (data) {
            const isAdmin = currentProfile && (currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL');
            const userMuni = normalizeMunicipioKey(currentProfile?.municipio);

            // Los lotes A.R.F./Canje solo se usan en Movimiento de Biológico --
            // nunca deben ofrecerse en la captura de existencia de las unidades
            // (mismo criterio que loadBatchesForSession en main.js).
            lotesCatalogo = data.filter(l => {
                if (l.tipo && l.tipo !== "NORMAL") return false;

                if (isAdmin || !userMuni) return true;
                if (!l.municipio) return false;
                const loteMuni = normalizeMunicipioKey(l.municipio);
                return loteMuni === "*" || loteMuni === "TODOS" || loteMuni.includes(userMuni);
            });

            // allLotesNormal: mismo filtro de tipo, pero SIN restringir por
            // municipio -- ver declaración arriba.
            allLotesNormal = data.filter(l => !l.tipo || l.tipo === "NORMAL");

            const container = document.getElementById('srCardsContainer');
            if (container) container.innerHTML = '';
            
            renderPedidosCards();
            await prefillPreviousReport();
            await prefillCONSReport();
            await prefillBIOReport();
        }
    };

    const fetchTargetDate = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient
            .from('calendario_pedidos')
            .select('*')
            .eq('anio_mes', today.substring(0, 7))
            .eq('activo', 'SI')
            .maybeSingle();

        if (error) {
            console.error("fetchTargetDate error:", error);
        }

        const now = new Date();
        let start, target, end;
        if (data && data.fecha_programada) {
            start = new Date(data.habilitar_desde);
            target = new Date(data.fecha_programada);
            end = new Date(data.habilitar_hasta);
        } else {
            const intelligentWindow = calculateBioIntelligentWindow(now.getFullYear(), now.getMonth());
            start = intelligentWindow.start;
            target = intelligentWindow.target;
            end = intelligentWindow.end;
        }

        const windowStartYmd = dateToLocalYmd(start);
        const windowTargetYmd = dateToLocalYmd(target);
        const windowEndYmd = dateToLocalYmd(end);
        const hoyYmd = dateToLocalYmd(now);

        canCaptureBioGlobal = hoyYmd >= windowStartYmd && hoyYmd <= windowEndYmd;
        targetPedidoDate = windowTargetYmd;

        const bioBox = document.getElementById('fechaPedidoBIOBox');
        if (bioBox) {
            bioBox.className = "p-5 rounded-2xl mb-6 text-center border-none transition-all";
            
            const startLabel = window.dayjs ? window.dayjs(start).format('DD/MM') : windowStartYmd.substring(5);
            const endLabel = window.dayjs ? window.dayjs(end).format('DD/MM') : windowEndYmd.substring(5);
            const targetLabelStr = window.dayjs ? window.dayjs(target).format('DD/MM/YYYY') : windowTargetYmd;

            if (canCaptureBioGlobal) {
                bioBox.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🟢 Ventana de Captura Activa</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Disponible del ${startLabel} al ${endLabel}</span>
                `;
            } else if (hoyYmd < windowStartYmd) {
                // Future capture window
                bioBox.style.background = "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🔵 Ventana de Captura Próxima</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Estará disponible del ${startLabel} al ${endLabel}</span>
                `;
            } else {
                // Past capture window
                bioBox.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🔴 Ventana de Captura Cerrada</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Estuvo disponible del ${startLabel} al ${endLabel}</span>
                `;
            }
        }
    };

    // --- Dynamic Card Management in Existencia de Biológico (SR) ---
    const addSRCard = (data = null) => {
        const container = document.getElementById('srCardsContainer');
        if (!container) return;

        if (container.querySelector('.font-bold')) container.innerHTML = '';

        const cardId = 'card_' + Math.random().toString(36).substring(2, 9);
        const card = document.createElement('div');
        card.className = 'biologic-card dynamic-sr-card';
        card.dataset.cardId = cardId;

        const bioOptions = biologicosCatalogo.map(bio => {
            const isSelected = data?.biologico && (normalizeString(data.biologico) === normalizeString(bio.biologico));
            return `<option value="${bio.biologico}" ${isSelected ? 'selected' : ''}>${bio.biologico}</option>`;
        }).join('');

        card.innerHTML = `
            <div class="card-header flex justify-between items-center pb-2 border-b border-slate-100">
                <span class="text-xs font-black text-slate-800 uppercase tracking-widest">Existencia de Biológico</span>
                <div class="flex items-center gap-2 ml-auto">
                    <button type="button" class="btn-clone-card" title="Duplicar">
                        <span class="material-symbols-rounded">post_add</span>
                    </button>
                    <button type="button" class="btn-delete-card" title="Eliminar">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
            <div class="cascade-inputs pt-3">
                <div class="cascade-field">
                    <label>Biológico</label>
                    <select class="sr-bio-select w-full" data-field="biologico">
                        <option value="">Selecciona...</option>
                        ${bioOptions}
                    </select>
                </div>
                <div class="cascade-field">
                    <label>Lote</label>
                    <select class="sr-lote-select w-full" data-field="lote" disabled>
                        <option value="">Selecciona lote...</option>
                    </select>
                </div>
                <div class="cascade-field">
                    <label>Caducidad</label>
                    <span class="text-xs font-black text-slate-400 sr-cad-badge">—</span>
                </div>
                <div class="cascade-field">
                    <label>Recepción</label>
                    <input type="date" data-field="recepcion" class="w-full" value="${data?.fecha_recepcion || ''}">
                </div>
                <div class="cascade-field">
                    <label>Tipo de Biológico</label>
                    <select class="sr-tipo-select w-full" data-field="tipo">
                        <option value="REQUISICION" ${(!data || data.tipo === 'REQUISICION' || data.tipo === 'Recibido con requisición') ? 'selected' : ''}>Recibido con requisición</option>
                        <option value="PRESTAMO_DESABASTO" ${(data?.tipo === 'PRESTAMO_DESABASTO' || data?.tipo === 'Préstamo por desabasto') ? 'selected' : ''}>Préstamo por desabasto</option>
                        <option value="PRESTAMO_ARF" ${(data?.tipo === 'PRESTAMO_ARF' || data?.tipo === 'Préstamo por ARF') ? 'selected' : ''}>Préstamo por ARF</option>
                    </select>
                </div>
                <div class="cascade-field">
                    <label>Cantidad
                        <span class="material-symbols-rounded" style="font-size:13px; color:#d97706; cursor:help; vertical-align:middle;" title="Si capturas un decimal en TD, DPT, Influenza o Hepatitis B, te pediremos la fecha de apertura del frasco (vigencia de 28 días una vez abierto). BCG y SR quedan excluidas por el manual.">info</span>
                    </label>
                    <div class="touch-stepper-wrap flex items-center gap-2">
                        <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1);">-</button>
                        <input type="number" data-field="cantidad" value="${data?.cantidad || 0}" min="0" class="w-full text-center font-black sr-qty-input">
                        <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1;">+</button>
                    </div>
                    <div class="sr-apertura-badge" style="display:none; justify-content:center; margin-top:6px; cursor:pointer;"></div>
                </div>
            </div>
        `;

        const bioSelect = card.querySelector('.sr-bio-select');
        const loteSelect = card.querySelector('.sr-lote-select');
        const cadBadge = card.querySelector('.sr-cad-badge');
        const qtyInput = card.querySelector('.sr-qty-input');
        const aperturaBadge = card.querySelector('.sr-apertura-badge');
        const tipoSelect = card.querySelector('.sr-tipo-select');

        // 💉 Fecha de apertura del frasco (si viene de una captura previa). Se marca como
        // NO "fresca" porque es un valor arrastrado (prefill/edición) — si el usuario
        // cambia la cantidad, sí debe re-validarse contra looksLikeNewVialOpening (a
        // diferencia de una fecha que el propio usuario acaba de confirmar ahora).
        card.dataset.fechaApertura = data?.fecha_apertura || "";
        card.dataset.fechaAperturaFresh = "0";
        // Última cantidad guardada para esta tarjeta (mismo lote+entrada) — permite
        // detectar si un nuevo decimal corresponde a un frasco físico distinto
        // (ver looksLikeNewVialOpening en el bloque de apertura de frascos).
        card.dataset.prevCantidad = (data && data.cantidad != null) ? String(data.cantidad) : "";

        qtyInput.addEventListener('input', (e) => {
            let val = e.target.value;
            if (val.length > 1 && val.startsWith('0')) {
                e.target.value = val.replace(/^0+/, '');
            }
        });

        // 💉 Listeners para detectar frasco multidosis abierto (decimal en TD/DPT/INFLUENZA/HEPATITIS B)
        // Detección en vivo: solo pinta el badge, no interrumpe con un modal (eso ocurre
        // en un solo paso al guardar, ver openAperturaBatchModal en saveReport).
        qtyInput.addEventListener('blur', () => updateAperturaState(card));
        bioSelect.addEventListener('change', () => updateAperturaState(card));
        // Clic directo en el badge = revisar/capturar esa tarjeta puntual, sin esperar al guardado.
        if (aperturaBadge) aperturaBadge.addEventListener('click', () => handleAperturaCheck(card, { prompt: true, force: true }));

        const updateLoteDropdown = (selectedBio, preselectedLote = null) => {
            if (!selectedBio) {
                loteSelect.innerHTML = '<option value="">Selecciona lote...</option>';
                loteSelect.disabled = true;
                cadBadge.className = 'text-xs font-black text-slate-400 sr-cad-badge';
                cadBadge.textContent = '—';
                return;
            }

            // Requisición: solo lotes surtidos a tu propio municipio (lotesCatalogo).
            // Préstamo (desabasto/A.R.F.): el lote nunca fue surtido a tu municipio
            // a propósito -- se abre a allLotesNormal (todos los municipios),
            // mostrando de dónde viene en la etiqueta (mismo criterio que main.js).
            const esPrestamo = !!(tipoSelect && String(tipoSelect.value || '').startsWith('PRESTAMO'));
            const fuenteLotes = esPrestamo ? allLotesNormal : lotesCatalogo;
            const filteredLotes = fuenteLotes.filter(l =>
                normalizeString(l.biologico) === normalizeString(selectedBio)
            );

            if (filteredLotes.length === 0) {
                loteSelect.innerHTML = '<option value="">Sin lotes activos</option>';
                loteSelect.disabled = true;
                cadBadge.textContent = '—';
                return;
            }

            loteSelect.innerHTML = '<option value="">Selecciona lote...</option>' + filteredLotes.map(l =>
                `<option value="${l.lote}" data-cad="${l.caducidad}" data-municipio="${l.municipio || ''}" ${preselectedLote === l.lote ? 'selected' : ''}>${esPrestamo ? `${l.lote} — ${l.municipio || '?'}` : l.lote}</option>`
            ).join('');
            loteSelect.disabled = false;

            if (preselectedLote) {
                loteSelect.value = preselectedLote;
                const matched = filteredLotes.find(l => l.lote === preselectedLote);
                if (matched) {
                    const lifeClass = getShelfLifeClass(matched.caducidad);
                    cadBadge.className = `text-xs font-black sr-cad-badge ${lifeClass}`;
                    cadBadge.textContent = formatToMmmAa(matched.caducidad);
                }
            }
        };

        bioSelect.addEventListener('change', () => {
            updateLoteDropdown(bioSelect.value);
        });

        // Cambiar el Origen (Requisición <-> Préstamo) cambia de dónde sale la
        // lista de lotes -- se re-arma desde cero (sin preselección) para que
        // el usuario elija explícitamente de la fuente correcta.
        if (tipoSelect) {
            tipoSelect.addEventListener('change', () => {
                if (bioSelect.value) updateLoteDropdown(bioSelect.value);
            });
        }

        loteSelect.addEventListener('change', () => {
            const opt = loteSelect.selectedOptions[0];
            const cad = opt ? opt.dataset.cad : null;
            if (cad) {
                const formatted = formatToMmmAa(cad);
                const lifeClass = getShelfLifeClass(cad);
                cadBadge.className = `text-xs font-black sr-cad-badge ${lifeClass}`;
                cadBadge.textContent = formatted;
            } else {
                cadBadge.className = 'text-xs font-black text-slate-400 sr-cad-badge';
                cadBadge.textContent = '—';
            }
        });

        card.querySelector('.btn-clone-card').addEventListener('click', () => {
            addSRCard({
                biologico: bioSelect.value,
                lote: loteSelect.value,
                fecha_recepcion: '',
                cantidad: 0
            });
            showToast("Entrada duplicada. Asigna la nueva cantidad/fecha.");
        });

        card.querySelector('.btn-delete-card').addEventListener('click', () => {
            card.remove();
            showToast("Registro eliminado.", "error");
        });

        container.appendChild(card);

        renderAperturaBadge(card);

        if (data) {
            updateLoteDropdown(data.biologico, data.lote);
        } else {
            // Added manually (not during prefill load) - scroll and highlight
            setTimeout(() => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('new-card-highlight');
                // Remove highlight class after animation finishes
                setTimeout(() => {
                    card.classList.remove('new-card-highlight');
                }, 800);
            }, 50);
        }

        if (hasTodaySR && !isEditingSR) {
            card.querySelectorAll('select, input').forEach(el => el.disabled = true);
            card.querySelectorAll('.btn-delete-card, .btn-clone-card').forEach(el => el.style.display = 'none');
        }
    };

    // --- Pre-llenado de Captura Semanal Anterior ---
    const prefillPreviousReport = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = (isAdmin ? 'QTSSA012154' : (currentProfile.clues || '')).trim().toUpperCase();

        if (!cluesFilter) return;

        const { data: lastRecord } = await supabaseClient
            .from('biologicos_existencia')
            .select('fecha, capturado_por, sin_movimiento')
            .eq('clues', cluesFilter)
            .order('fecha', { ascending: false })
            .limit(1);

        if (lastRecord && lastRecord.length > 0) {
            const lastDate = lastRecord[0].fecha;
            const respName = lastRecord[0].capturado_por;
            const sinMov = lastRecord[0].sin_movimiento === 'SI' || lastRecord[0].sin_movimiento === true;

            // Detección de salto de semanas (paridad con desktop: execPrefillSemanal).
            // Si pasaron 9 días o más desde la última captura, se guarda el detalle del salto
            // para poder advertir al usuario si intenta guardar sin cambios en saveReport().
            const todayStr = new Date().toISOString().split('T')[0];
            const diffDays = Math.round((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / (1000 * 3600 * 24));
            if (diffDays >= 9) {
                srPrefillGapInfo = { diffDays, missedWeeks: Math.max(1, Math.floor(diffDays / 7)), lastDate };
            } else {
                srPrefillGapInfo = null;
            }

            const nombreSRInput = document.getElementById('nombreSR');
            if (nombreSRInput && respName) nombreSRInput.value = respName;

            const chkSinMov = document.getElementById('chkSinMovimientoSR');
            if (chkSinMov) {
                chkSinMov.checked = sinMov;
                chkSinMov.dispatchEvent(new Event('change'));
            }

            if (sinMov) {
                const container = document.getElementById('srCardsContainer');
                if (container) container.innerHTML = '';
                srPrefillSnapshot = null;
                showToast("Se pre-llenó la información de la captura anterior.");
            } else {
                const { data: details } = await supabaseClient
                    .from('existencia_detalle')
                    .select('*')
                    .eq('clues', cluesFilter)
                    .eq('fecha', lastDate);

                if (details && details.length > 0) {
                    const container = document.getElementById('srCardsContainer');
                    if (container) container.innerHTML = '';

                    details.forEach(item => {
                        addSRCard({
                            biologico: item.biologico,
                            lote: item.lote,
                            fecha_recepcion: item.fecha_recepcion,
                            cantidad: item.cantidad,
                            fecha_apertura: item.fecha_apertura || null
                        });
                    });
                    srPrefillSnapshot = JSON.stringify(details.map(item => ({
                        biologico: String(item.biologico || '').trim().toUpperCase(),
                        lote: String(item.lote || '').trim().toUpperCase(),
                        cantidad: Number(item.cantidad)
                    })));
                    if (srPrefillGapInfo) {
                        showToast(`⚠️ Te saltaste ${srPrefillGapInfo.missedWeeks} semana(s) (última captura hace ${diffDays} días). Se precargó esa información — revísala antes de guardar.`, "error");
                    } else {
                        showToast("Se pre-llenó la información de la captura anterior.");
                    }
                } else {
                    srPrefillSnapshot = null;
                    addSRCard();
                }
            }
        } else {
            srPrefillSnapshot = null;
            srPrefillGapInfo = null;
            addSRCard();
        }
    };

    // --- Pinol Flow Banner (paridad con el banner de escritorio) ---
    const updatePinolFlowBanner = (status) => {
        const banner = document.getElementById('pinolFlowBanner');
        if (!banner) return;

        if (status === "PENDING") {
            banner.style.display = "flex";
            banner.className = "flex gap-3 items-center p-4 rounded-2xl mb-6 border text-xs font-bold leading-relaxed bg-amber-50 border-amber-200 text-amber-800";
            banner.innerHTML = `
                <span class="material-symbols-rounded text-xl">hourglass_empty</span>
                <span>Tu solicitud está en curso. El área municipal aún no ha surtido el insumo.</span>
            `;
        } else if (status === "DELIVERED") {
            banner.style.display = "flex";
            banner.className = "flex gap-3 items-center p-4 rounded-2xl mb-6 border text-xs font-bold leading-relaxed bg-blue-50 border-blue-200 text-blue-800";
            banner.innerHTML = `
                <span class="material-symbols-rounded text-xl">local_shipping</span>
                <span>El insumo fue enviado. Revisa tus notificaciones y marca como recibido para habilitar una nueva solicitud.</span>
            `;
        } else {
            banner.style.display = "none";
            banner.className = "";
            banner.innerHTML = "";
        }
    };

    // --- Realtime de pinol_solicitudes (paridad con escritorio) ---
    // Mantiene el candado del formulario y el banner sincronizados en vivo cuando
    // el municipal marca "entregado", sin depender de que la unidad cambie de pestaña.
    const initPinolRealtimeMobile = () => {
        if (!currentUser || !currentProfile || currentProfile.rol !== 'UNIDAD') return;
        if (PINOL_SOLICITUDES_CHANNEL_MOBILE) return;

        PINOL_SOLICITUDES_CHANNEL_MOBILE = supabaseClient
            .channel('mobile-pinol-solicitudes-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pinol_solicitudes', filter: `clues=eq.${currentProfile.clues}` }, () => {
                checkCapturesState().then(() => {
                    applyFormLocks();
                    syncCommandHub();
                }).catch(err => console.error("Error refrescando pinol en realtime:", err));
            })
            .subscribe();
    };

    // --- Command Hub Lock/Edit State Sync ---
    const applyFormLocks = () => {
        const isSRLocked = (hasTodaySR && !isEditingSR) || !canCaptureSRGlobal;
        const isCONSLocked = (hasTodayCONS && !isEditingCONS) || !canCaptureConsGlobal;
        const isBIOLocked = (hasTodayBIO && !isEditingBIO) || !canCaptureBioGlobal;
        // Antes de la primera respuesta real de checkCapturesState, no se sabe si ya
        // hay una solicitud activa -- por seguridad se trata como bloqueado (ver mismo
        // fix del lado de escritorio, _pinolCacheLoaded).
        const isPinolLocked = hasActivePinol || !pinolCacheLoaded;

        // Lock/Unlock SR inputs
        document.querySelectorAll('#srCardsContainer select, #srCardsContainer input, #srCardsContainer button').forEach(el => {
            if (el.classList.contains('btn-delete-card') || el.classList.contains('btn-clone-card')) {
                el.style.display = isSRLocked ? 'none' : 'flex';
            } else {
                el.disabled = isSRLocked;
            }
        });
        const btnAddSRCard = document.getElementById('btnAddSRCard');
        if (btnAddSRCard) btnAddSRCard.style.display = isSRLocked ? 'none' : 'flex';

        // Lock/Unlock CONS inputs
        document.querySelectorAll('#panelCONS input, #panelCONS textarea').forEach(el => {
            if (el.id !== 'chkSinMovimientoCONS') {
                el.disabled = isCONSLocked;
            }
        });
        const chkSinMovCONS = document.getElementById('chkSinMovimientoCONS');
        if (chkSinMovCONS) chkSinMovCONS.disabled = isCONSLocked || !canCaptureConsGlobal;

        // Lock/Unlock BIO inputs
        document.querySelectorAll('#panelBIO input, #panelBIO select, #panelBIO textarea').forEach(el => {
            if (el.id !== 'chkNoPedido') {
                el.disabled = isBIOLocked;
            }
        });
        const chkNoPedido = document.getElementById('chkNoPedido');
        if (chkNoPedido) chkNoPedido.disabled = isBIOLocked || !canCaptureBioGlobal;

        // Lock/Unlock PINOL inputs
        document.querySelectorAll('#panelPINOL input, #panelPINOL textarea').forEach(el => {
            el.disabled = isPinolLocked;
            el.style.opacity = isPinolLocked ? "0.55" : "";
            el.style.pointerEvents = isPinolLocked ? "none" : "";
        });
    };

    const syncCommandHub = () => {
        const hub = document.getElementById('globalCommandHub');
        if (!hub) return;

        const saveBtn = document.getElementById('hubSaveBtn');
        const editBtn = document.getElementById('hubEditBtn');
        const cancelBtn = document.getElementById('hubCancelBtn');
        const statusChip = document.getElementById('hubStatusChip');
        const statusText = document.getElementById('hubStatusText');

        let isAlreadySaved = false;
        let isEditing = false;

        if (activePanel === 'SR') {
            isAlreadySaved = hasTodaySR || !canCaptureSRGlobal;
            isEditing = isEditingSR;
        } else if (activePanel === 'CONS') {
            isAlreadySaved = hasTodayCONS || !canCaptureConsGlobal;
            isEditing = isEditingCONS;
        } else if (activePanel === 'BIO') {
            isAlreadySaved = hasTodayBIO || !canCaptureBioGlobal;
            isEditing = isEditingBIO;
        } else if (activePanel === 'PINOL') {
            isAlreadySaved = hasActivePinol;
            isEditing = false;
        }

        // Update status text and chip classes
        if (statusText && statusChip) {
            statusChip.style.display = "flex";
            const isOutsideWindow = (activePanel === 'SR' && !canCaptureSRGlobal) || (activePanel === 'BIO' && !canCaptureBioGlobal) || (activePanel === 'CONS' && !canCaptureConsGlobal);
            if (isOutsideWindow) {
                statusText.textContent = 'Fuera de Ventana';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            } else if (isAlreadySaved && !(activePanel === 'SR' && !canCaptureSRGlobal)) {
                statusText.textContent = isEditing ? 'Editando' : 'Reporte Guardado';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            } else {
                statusText.textContent = 'Listo';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            }
        }

        // Show/Hide buttons
        if (saveBtn) {
            let show = (!isAlreadySaved || isEditing);
            const iconSpan = saveBtn.querySelector('.material-symbols-rounded');
            const isOutsideWindow = (activePanel === 'SR' && !canCaptureSRGlobal) || (activePanel === 'BIO' && !canCaptureBioGlobal) || (activePanel === 'CONS' && !canCaptureConsGlobal);

            if (isOutsideWindow) {
                saveBtn.disabled = true;
                saveBtn.style.background = '#e2e8f0';
                saveBtn.style.color = '#94a3b8';
                saveBtn.style.pointerEvents = 'none';
                saveBtn.style.opacity = '0.7';
                saveBtn.style.boxShadow = 'none';
                if (iconSpan) iconSpan.textContent = 'save';
                saveBtn.style.setProperty('display', 'flex', 'important');
            } else {
                saveBtn.disabled = false;
                saveBtn.style.background = '';
                saveBtn.style.color = '';
                saveBtn.style.pointerEvents = '';
                saveBtn.style.opacity = '';
                saveBtn.style.boxShadow = '';
                if (iconSpan) iconSpan.textContent = 'save';
                saveBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
            }
        }
        if (editBtn) {
            const hasActualCapture = (activePanel === 'SR' && hasTodaySR) || (activePanel === 'CONS' && hasTodayCONS) || (activePanel === 'BIO' && hasTodayBIO);
            const show = (hasActualCapture && !isEditing && activePanel !== 'PINOL' && ((activePanel === 'SR' && canCaptureSRGlobal) || (activePanel === 'BIO' && canCaptureBioGlobal) || (activePanel === 'CONS' && canCaptureConsGlobal)));
            editBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
        }
        if (cancelBtn) {
            const show = isEditing;
            cancelBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
        }

        applyFormLocks();
    };

    const checkCapturesState = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        const today = new Date().toISOString().split('T')[0];

        // Weekly capture check: if Thursday or Friday, check both dates
        let srDateFilter = [today];
        const dow = new Date().getDay();
        if (dow === 5) {
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            srDateFilter.push(yesterdayObj.toISOString().split('T')[0]);
        } else if (dow === 4) {
            const tomorrowObj = new Date();
            tomorrowObj.setDate(tomorrowObj.getDate() + 1);
            srDateFilter.push(tomorrowObj.toISOString().split('T')[0]);
        }

        try {
            const [resSR, resCONS, resBIO, resPinol] = await Promise.all([
                supabaseClient.from('biologicos_existencia').select('id').eq('clues', cluesFilter).in('fecha', srDateFilter).limit(1),
                supabaseClient.from('consumibles').select('id').eq('clues', cluesFilter).eq('fecha', today).maybeSingle(),
                supabaseClient.from('biologicos_pedido').select('id').eq('clues', cluesFilter).eq('fecha_pedido_programada', targetPedidoDate).limit(1),
                supabaseClient.from('pinol_solicitudes').select('id, estatus').eq('clues', cluesFilter).in('estatus', ['PENDIENTE', 'ENTREGADO'])
            ]);

            hasTodaySR = resSR.data && resSR.data.length > 0;
            hasTodayCONS = !!resCONS.data;
            hasTodayBIO = resBIO.data && resBIO.data.length > 0;

            const pinolRows = resPinol.data || [];
            hasActivePinol = pinolRows.length > 0;
            pinolFlowStatus = pinolRows.length === 0
                ? "NONE"
                : (pinolRows.some(r => String(r.estatus || "").toUpperCase() === "ENTREGADO") ? "DELIVERED" : "PENDING");
            pinolCacheLoaded = true;
            updatePinolFlowBanner(pinolFlowStatus);

            syncCommandHub();
        } catch (e) {
            console.error("Error checking captures state:", e);
            syncCommandHub();
        }
    };

    // --- Weather Widget ---
    const loadWeather = async () => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.5881&longitude=-100.3899&current_weather=true&timezone=America/Mexico_City`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    document.getElementById('hdrClima').textContent = `${temp}°C`;
                    
                    const code = data.current_weather.weathercode;
                    let emoji = "🌤️";
                    if (code === 0) emoji = "☀️";
                    else if (code >= 1 && code <= 3) emoji = "🌤️";
                    else if (code >= 45 && code <= 48) emoji = "🌫️";
                    else if (code >= 51 && code <= 67) emoji = "🌧️";
                    else if (code >= 71 && code <= 77) emoji = "❄️";
                    else if (code >= 80 && code <= 82) emoji = "🌦️";
                    
                    document.getElementById('lblClimaEmoji').textContent = emoji;
                }
            }
        } catch (e) {
            console.warn(e);
        }
    };

    // --- Cálculo del Cumplimiento Real ---
    const loadCompliance = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        if (!cluesFilter) {
            document.getElementById('lblCumplimientoVal').textContent = '100%';
            return;
        }

        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const month = todayObj.getMonth();
        const todayYmd = todayObj.toISOString().split('T')[0];
        const startOfMonthStr = new Date(year, month, 1).toISOString().split('T')[0];

        const [resBio, resCons, resPedido] = await Promise.all([
            supabaseClient.from('biologicos_existencia').select('fecha').eq('clues', cluesFilter).gte('fecha', startOfMonthStr),
            supabaseClient.from('consumibles').select('fecha').eq('clues', cluesFilter).gte('fecha', startOfMonthStr),
            supabaseClient.from('biologicos_pedido').select('id').eq('clues', cluesFilter).gte('fecha_captura', startOfMonthStr).eq('tipo_pedido', 'MENSUAL').limit(1)
        ]);

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const expectedDatesCons = [];
        const expectedDatesBio = [];
        let iter = new Date(startOfMonth);
        while (iter <= endOfMonth) {
            const dow = iter.getDay();
            const ymd = iter.toISOString().split('T')[0];
            if (dow === 4) expectedDatesCons.push(ymd);
            if (dow === 5) expectedDatesBio.push(ymd);
            iter.setDate(iter.getDate() + 1);
        }

        const denominatorCons = expectedDatesCons.length || 4;
        const denominatorBio = expectedDatesBio.length || 4;

        let cons_semanas_ok = 0;
        expectedDatesCons.forEach(targetJueves => {
            const dJue = new Date(`${targetJueves}T12:00:00`);
            const targetWindow = [targetJueves];
            if (isMexicanHoliday(dJue)) {
                const dMie = new Date(dJue);
                dMie.setDate(dJue.getDate() - 1);
                targetWindow.push(dMie.toISOString().split('T')[0]);
            }
            if (resCons.data && resCons.data.some(r => targetWindow.includes(r.fecha))) {
                cons_semanas_ok++;
            }
        });

        let bio_semanas_ok = 0;
        expectedDatesBio.forEach(targetViernes => {
            const dVie = new Date(`${targetViernes}T12:00:00`);
            const dJue = new Date(dVie);
            dJue.setDate(dVie.getDate() - 1);
            const targetWindow = [targetViernes, dJue.toISOString().split('T')[0]];
            if (isMexicanHoliday(dVie) && isMexicanHoliday(dJue)) {
                const dMie = new Date(dJue);
                dMie.setDate(dJue.getDate() - 1);
                targetWindow.push(dMie.toISOString().split('T')[0]);
            }
            if (resBio.data && resBio.data.some(r => targetWindow.includes(r.fecha))) {
                bio_semanas_ok++;
            }
        });

        const bPct = (bio_semanas_ok / denominatorBio) * 100;
        const cPct = (cons_semanas_ok / denominatorCons) * 100;
        const pPct = (resPedido.data && resPedido.data.length > 0) ? 100 : 0;

        const intelligentWindow = calculateBioIntelligentWindow(year, month);
        const windowStartYmd = intelligentWindow.start.toISOString().split('T')[0];
        const isPedidoRequired = todayYmd >= windowStartYmd;

        let score = 0;
        if (isPedidoRequired) {
            score = Math.round((bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2));
        } else {
            score = Math.round((bPct * 0.5) + (cPct * 0.5));
        }
        if (score > 100) score = 100;

        document.getElementById('lblCumplimientoVal').textContent = `${score}%`;
    };

    // --- Biometric Passkey Functions ---
    const handleBiometricLogin = async () => {
        showToast("Escaneando datos biométricos...", "success");
        try {
            const { data, error } = await supabaseClient.auth.signInWithPasskey();
            if (error) throw error;
            if (data.session) {
                handleAuthSuccess(data.user);
            }
        } catch (err) {
            showToast("Error de acceso biométrico: " + err.message, "error");
        }
    };

    const handleRegisterBiometrics = async (checked) => {
        if (!checked) return;
        showToast("Registrando dispositivo biométrico...", "success");
        try {
            const { error } = await supabaseClient.auth.registerPasskey();
            if (error) throw error;
            showToast("Dispositivo biométrico enlazado con éxito.");
        } catch (err) {
            showToast("Error al registrar: " + err.message, "error");
            document.getElementById('chkBiometria').checked = false;
        }
    };

    // --- Theme Control ---
    const initTheme = () => {
        const theme = localStorage.getItem('theme') || 'light';
        applyThemeClass(theme === 'dark');
    };

    const applyThemeClass = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.getElementById('themeIconProfile').textContent = 'dark_mode';
        } else {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeIconProfile').textContent = 'light_mode';
        }
    };

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyThemeClass(isDark);
    };

    // --- Render Pedidos Cards with Real Validation Rules ---
    const renderPedidosCards = () => {
        const container = document.getElementById('bioCardsContainer');
        if (!container) return;

        container.innerHTML = '';
        
        const allowedBios = biologicosParams.filter(p => p.activo === 'SI').map(p => normalizeString(p.biologico));
        const filtered = biologicosCatalogo.filter(bio => allowedBios.includes(normalizeString(bio.biologico)));

        const fragment = document.createDocumentFragment();

        filtered.forEach(bio => {
            const card = document.createElement('div');
            card.className = 'biologic-card';
            
            const promedio = bio.promedio_frascos || 0;
            const minDosis = bio.min_dosis || 0;
            const maxDosis = bio.max_dosis || 0;

            const bioKey = String(bio.biologico).trim().toUpperCase();
            const requires5 = ["BCG", "HEXAVALENTE", "ROTAVIRUS", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP"].includes(bioKey);
            const multiple = requires5 ? 5 : 1;

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-title">${bio.biologico}</span>
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${bio.tipo_esquema || 'Dosis'}</span>
                </div>
                <div class="cascade-inputs">
                    <div class="flex justify-between text-[10px] font-black text-slate-400 pb-2 border-b border-slate-100">
                        <span>Promedio: <strong class="text-slate-700 dark:text-slate-200">${promedio} fr.</strong></span>
                        <span>Mín/Máx: <strong class="text-slate-700 dark:text-slate-200">${minDosis}/${maxDosis} d.</strong></span>
                    </div>
                    <div class="cascade-field">
                        <label>Existencia</label>
                        <div class="touch-stepper-wrap flex items-center gap-2">
                            <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input'));">-</button>
                            <input type="number" data-bio-id="${bio.id}" data-bio-name="${bio.biologico}" data-field="existencia" value="0" min="0" class="w-full text-center font-black bio-exist-input">
                            <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input'));">+</button>
                        </div>
                    </div>
                    <div class="cascade-field">
                        <label>Pedido</label>
                        <div class="touch-stepper-wrap flex items-center gap-2">
                            <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input'));">-</button>
                            <input type="number" data-bio-id="${bio.id}" data-bio-name="${bio.biologico}" data-field="pedido" value="0" min="0" class="w-full text-center font-black bio-ped-input">
                            <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input'));">+</button>
                        </div>
                    </div>
                    <div class="text-center pt-2">
                        <span class="text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider stock-val-badge bg-slate-100 text-slate-500">
                            Sin Captura
                        </span>
                    </div>
                </div>
            `;

            const existInput = card.querySelector('.bio-exist-input');
            const pedInput = card.querySelector('.bio-ped-input');
            const valBadge = card.querySelector('.stock-val-badge');

            const stripZeroes = (e) => {
                let val = e.target.value;
                if (val.length > 1 && val.startsWith('0')) {
                    e.target.value = val.replace(/^0+/, '');
                }
            };
            existInput.addEventListener('input', stripZeroes);
            pedInput.addEventListener('input', stripZeroes);

            const validateStock = () => {
                const exist = parseInt(existInput.value) || 0;
                const ped = parseInt(pedInput.value) || 0;
                const total = exist + ped;

                let isError = false;
                let message = "";
                let badgeClass = "";

                if (multiple > 1 && ped > 0 && (ped % multiple !== 0)) {
                    isError = true;
                    message = `⚠️ Múltiplo de ${multiple}`;
                    badgeClass = "bg-red-100 text-red-700 border border-red-200";
                }
                else if (promedio > 0 && total < promedio) {
                    message = `⚠️ Faltan ${promedio - total} fr.`;
                    badgeClass = "bg-amber-100 text-amber-700 border border-amber-200";
                } else if (promedio > 0) {
                    message = "✓ Correcto";
                    badgeClass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                } else {
                    message = "✓ Correcto";
                    badgeClass = "bg-slate-100 text-slate-500";
                }

                valBadge.className = `text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider stock-val-badge ${badgeClass}`;
                valBadge.textContent = message;
                
                if (isError) {
                    card.classList.add('border-red-500');
                    card.dataset.invalid = "true";
                } else {
                    card.classList.remove('border-red-500');
                    delete card.dataset.invalid;
                }

                const hasErrors = document.querySelectorAll('[data-invalid="true"]').length > 0;
                const saveBtn = document.getElementById('hubSaveBtn');
                if (saveBtn) saveBtn.disabled = hasErrors;
            };

            existInput.addEventListener('input', validateStock);
            pedInput.addEventListener('input', validateStock);

            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    };

    // --- Pinol Confirm Receipt Flow ---
    const canConfirmPinolReceipt = (item) => {
        if (!currentProfile || String(currentProfile.rol || "").toUpperCase() !== "UNIDAD") return false;
        if (!item || !item.notificacion) return false;

        let meta = {};
        try {
            meta = typeof item.notificacion.meta_json === "string" 
                ? JSON.parse(item.notificacion.meta_json) 
                : (item.notificacion.meta_json || {});
        } catch (e) {
            meta = {};
        }

        const source = String(meta.source || "").toUpperCase();
        const event = String(meta.event || "").toUpperCase();
        const alreadyConfirmed = String(meta.confirmed_by_unit || "").toUpperCase() === "SI";
        const status = String(item.status || "").toUpperCase();

        return source === "PINOL" &&
            event === "PINOL_ENTREGADO" &&
            !alreadyConfirmed &&
            status !== "READ";
    };

    const confirmPinolReceiptMobile = async (notificationId) => {
        try {
            const { data: notif, error: fetchErr } = await supabaseClient
                .from('notificaciones')
                .select('*')
                .eq('id', notificationId)
                .single();
                
            if (fetchErr || !notif) throw new Error("Notificación no encontrada");
            
            const meta = typeof notif.meta_json === "string" 
                ? JSON.parse(notif.meta_json) 
                : (notif.meta_json || {});
            const pinolId = meta.pinol_id;
            
            meta.confirmed_by_unit = "SI";
            meta.confirmation_ts = new Date().toISOString();
            
            await supabaseClient
                .from('notificaciones')
                .update({ meta_json: JSON.stringify(meta) })
                .eq('id', notificationId);
                
            await supabaseClient
                .from('notificaciones_perfil')
                .update({ status: 'READ', read_ts: new Date().toISOString() })
                .eq('notificacion_id', notificationId)
                .eq('usuario', currentProfile.usuario);
                
            if (pinolId) {
                await supabaseClient
                    .from('pinol_solicitudes')
                    .update({
                        estatus: 'RECIBIDO',
                        recibido_ts: new Date().toISOString()
                    })
                    .eq('id', pinolId);
            }
            
            showToast("Recepción confirmada correctamente", "success");
            hasActivePinol = false;
            pinolFlowStatus = "NONE";
            updatePinolFlowBanner(pinolFlowStatus);

            await loadNotifications();
            applyFormLocks();
            syncCommandHub();
        } catch (err) {
            console.error("Error confirming pinol receipt:", err);
            showToast("Error al confirmar recepción", "error");
        }
    };

    // --- Notificaciones ---
    const loadNotifications = async () => {
        if (!currentUser || !currentProfile) return;
        const { data } = await supabaseClient
            .from('notificaciones_perfil')
            .select('id, notificacion_id, status, read_ts, notificacion:notificaciones(*)')
            .eq('usuario', currentProfile.usuario)
            .eq('deleted', false)
            .order('created_at', { ascending: false })
            .limit(100);

        if (data) {
            const list = document.getElementById('notifList');
            if (!list) return;
            const unreadCount = data.filter(n => n.status === 'UNREAD').length;

            const badge = document.getElementById('notifBadge');
            if (badge) {
                if (unreadCount > 0) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }

            if (data.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs font-bold">No hay nuevas notificaciones</div>`;
                return;
            }

            const sortedData = [...data].sort((a, b) => {
                const aUnread = a.status === 'UNREAD';
                const bUnread = b.status === 'UNREAD';
                if (aUnread && !bUnread) return -1;
                if (!aUnread && bUnread) return 1;

                const dateA = new Date(a.created_at || a.notificacion?.created_at || 0);
                const dateB = new Date(b.created_at || b.notificacion?.created_at || 0);
                return dateB - dateA;
            });

            list.innerHTML = sortedData.map(item => {
                const notif = item.notificacion || {};
                const isUnread = item.status === 'UNREAD';
                const formattedDate = window.dayjs ? window.dayjs(notif.created_at).format('DD/MM/YYYY HH:mm') : '';
                
                // Color mapping and category labels for notifications
                let typeBadge = '';
                const titleStr = (notif.title || 'Alerta').toUpperCase();
                
                if (titleStr.includes('PINOL')) {
                    typeBadge = `<span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">PINOL</span>`;
                } else if (titleStr.includes('APERTURA') || titleStr.includes('HABILITAR')) {
                    typeBadge = `<span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">APERTURA</span>`;
                } else if (titleStr.includes('ERROR') || titleStr.includes('FALLA') || titleStr.includes('ADVERTENCIA')) {
                    typeBadge = `<span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20">SISTEMA</span>`;
                } else {
                    typeBadge = `<span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-600 border border-slate-500/20">AVISO</span>`;
                }

                // Status indicator dot
                const unreadDot = isUnread ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-600 block shrink-0" title="Nueva"></span>` : '';

                    const formatNotifBodyMobile = (title, message, fromUsuario = "") => {
                    if (!message) return '<span class="text-slate-400 italic">Sin descripción de la alerta.</span>';
                    
                    let clean = message;
                    const isDelivery = (title && title.toLowerCase().includes("entrega")) || message.toLowerCase().includes("entregada") || message.toLowerCase().includes("recibido");
                    
                    if (isDelivery) {
                        clean = "Pinol entregado:";
                    } else {
                        clean = title ? `${title}:` : "Notificación:";
                    }

                    const unidadMatch = message.match(/Unidad:\s*([^.\n]+)/i) || 
                                        message.match(/Unidad de salud:\s*([^.\n]+)/i) ||
                                        message.match(/La unidad\s+([^.\n]+?)\s+ha solicitado/i);
                    const unidad = unidadMatch ? unidadMatch[1].trim().split(" CLUES:")[0].split(" Solicitó:")[0] : "";

                    const solicitanteMatch = message.match(/Solicita(?:nte)?:\s*([^.\n\r]+)/i) ||
                                             message.match(/por\s+([^.\n\r]+)/i);
                    let solicitante = solicitanteMatch ? solicitanteMatch[1].trim().replace(/\(.*?\)/g, "").split(" para ")[0] : "";
                    if (!solicitante && fromUsuario) {
                        solicitante = fromUsuario;
                    }

                    const fechaMatch = message.match(/Fecha de solicitud:\s*([\d-]+)/i) ||
                                       message.match(/Fecha:\s*([\d-]+)/i);
                    let fechaReq = fechaMatch ? fechaMatch[1] : "";
                    if (fechaReq) {
                        const d = new Date(fechaReq);
                        if (!isNaN(d.getTime())) {
                            const dd = String(d.getDate()).padStart(2, '0');
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const yy = String(d.getFullYear()).slice(-2);
                            fechaReq = `${dd}-${mm}-${yy}`;
                        }
                    }

                    let html = `<strong class="text-slate-800 font-extrabold block mb-1">${clean}</strong>`;
                    
                    if (isDelivery) {
                        if (unidad || fechaReq) {
                            const details = [unidad, fechaReq ? `Sol: ${fechaReq}` : ""].filter(Boolean).join(" • ");
                            html += `<div class="text-[10px] text-slate-500 font-semibold mt-0.5">${details}</div>`;
                        }
                        
                        const lines = message.split("\n");
                        const commentLines = lines.filter(line => {
                            const l = line.toLowerCase();
                            if (l.includes("unidad de salud:") || l.includes("unidad:") || l.includes("fecha de solicitud:") || l.includes("fecha:") || l.includes("tu solicitud de pinol") || l.includes("pinol entregado:")) {
                                return false;
                            }
                            return true;
                        });
                        const comment = commentLines.join(" ").trim();
                        if (comment) {
                            html += `<div class="mt-2 p-2 bg-slate-50 border-l-2 border-amber-500 rounded text-[10px] text-slate-600 font-medium italic">
                                <strong>Comentario:</strong> "${comment}"
                            </div>`;
                        }
                    } else {
                        if (fechaReq) html += `<div class="text-[10px] text-slate-500 font-medium">Fecha de solicitud: ${fechaReq}</div>`;
                        if (unidad) html += `<div class="text-[10px] text-slate-500 font-medium">Unidad de salud: ${unidad}</div>`;
                        if (solicitante) html += `<div class="text-[10px] text-slate-500 font-medium">Solicita: ${solicitante}</div>`;
                        if (!unidad && message.trim() && message !== title) {
                            html += `<div class="text-[11px] text-slate-500 font-medium mt-1">${message}</div>`;
                        }
                    }
                    return html;
                };

                const displayMsg = formatNotifBodyMobile(notif.title, notif.message, notif.from_usuario);
                const canConfirm = canConfirmPinolReceipt(item);
                const confirmBtnHtml = canConfirm 
                    ? `<button class="btn-confirm-pinol-receipt mt-3 w-full py-2.5 px-4 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all" data-notif-id="${item.notificacion_id}">
                         <span class="material-symbols-rounded text-sm">task_alt</span>
                         <span>Confirmar Recibido</span>
                       </button>` 
                    : '';

                return `
                    <div class="swipe-container rounded-2xl mb-3.5 border ${isUnread ? 'border-slate-200/80 shadow-sm' : 'border-transparent'}" data-id="${item.id}">
                        <div class="swipe-action-left swipe-hint-left-anim" style="opacity: 0;">
                            <div class="flex items-center gap-1.5 text-white font-black text-[10px] uppercase tracking-wider">
                                <span class="material-symbols-rounded text-sm">check</span>
                                <span>Leída</span>
                            </div>
                        </div>
                        <div class="swipe-action-right swipe-hint-right-anim" style="opacity: 0;">
                            <div class="flex items-center gap-1.5 text-white font-black text-[10px] uppercase tracking-wider">
                                <span class="material-symbols-rounded text-sm">delete</span>
                                <span>Eliminar</span>
                            </div>
                        </div>
                        <div class="swipe-content p-4 flex flex-col gap-2.5 swipe-hint-anim ${isUnread ? 'bg-white' : 'bg-transparent'}">
                            <div class="flex items-center justify-between gap-2 border-b border-slate-100/50 pb-2">
                                <div class="flex items-center gap-2 overflow-hidden">
                                    ${unreadDot}
                                    <span class="text-xs font-black tracking-tight truncate ${isUnread ? 'text-slate-900' : 'text-slate-600'}">${notif.title || 'Alerta'}</span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    ${typeBadge}
                                    <span class="text-[9px] font-bold text-slate-400">${formattedDate}</span>
                                </div>
                            </div>
                            <div class="leading-normal">${displayMsg}</div>
                            ${confirmBtnHtml}
                        </div>
                    </div>
                `;
            }).join('');

            bindSwipeEvents();

            // Bind click event to confirm pinol receipt buttons
            list.querySelectorAll('.btn-confirm-pinol-receipt').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Avoid triggering card click/swipe
                    const notifId = btn.dataset.notifId;
                    btn.disabled = true;
                    btn.textContent = "Confirmando...";
                    await confirmPinolReceiptMobile(notifId);
                });
            });
        }
    };

    const bindSwipeEvents = () => {
        const containers = document.querySelectorAll('#notifList .swipe-container');
        containers.forEach(container => {
            const content = container.querySelector('.swipe-content');
            const actionLeft = container.querySelector('.swipe-action-left');
            const actionRight = container.querySelector('.swipe-action-right');
            const itemId = container.dataset.id;
            
            let startX = 0;
            let currentX = 0;
            let isSwiping = false;
            
            content.addEventListener('touchstart', (e) => {
                content.classList.remove('swipe-hint-anim');
                actionLeft.classList.remove('swipe-hint-left-anim');
                actionRight.classList.remove('swipe-hint-right-anim');
                
                startX = e.touches[0].clientX;
                content.style.transition = 'none';
                isSwiping = true;
            }, { passive: true });
            
            content.addEventListener('touchmove', (e) => {
                if (!isSwiping) return;
                currentX = e.touches[0].clientX - startX;
                
                if (currentX > 120) {
                    currentX = 120 + (currentX - 120) * 0.2;
                } else if (currentX < -120) {
                    currentX = -120 + (currentX + 120) * 0.2;
                }
                
                if (currentX > 0) {
                    actionLeft.style.opacity = Math.min(1, currentX / 60);
                    actionRight.style.opacity = 0;
                } else if (currentX < 0) {
                    actionRight.style.opacity = Math.min(1, Math.abs(currentX) / 60);
                    actionLeft.style.opacity = 0;
                }
                
                content.style.transform = `translateX(${currentX}px)`;
            }, { passive: true });
            
            content.addEventListener('touchend', async () => {
                if (!isSwiping) return;
                isSwiping = false;
                
                content.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                
                if (currentX > 75) {
                    content.style.transform = 'translateX(100%)';
                    actionLeft.style.opacity = 1;
                    
                    const { error } = await supabaseClient
                        .from('notificaciones_perfil')
                        .update({ status: 'READ', read_ts: new Date().toISOString() })
                        .eq('id', itemId);
                        
                    if (error) {
                        showToast("Error al marcar como leída: " + error.message, "error");
                        content.style.transform = 'translateX(0)';
                    } else {
                        showToast("Marcada como leída");
                        loadNotifications();
                    }
                } else if (currentX < -75) {
                    content.style.transform = 'translateX(-100%)';
                    actionRight.style.opacity = 1;
                    
                    const { error } = await supabaseClient
                        .from('notificaciones_perfil')
                        .update({ deleted: true, deleted_ts: new Date().toISOString() })
                        .eq('id', itemId);
                        
                    if (error) {
                        showToast("Error al eliminar: " + error.message, "error");
                        content.style.transform = 'translateX(0)';
                    } else {
                        showToast("Notificación eliminada");
                        loadNotifications();
                    }
                } else {
                    content.style.transform = 'translateX(0)';
                    actionLeft.style.opacity = 0;
                    actionRight.style.opacity = 0;
                }
            });
        });
    };

    const initNotificationsRealtime = () => {
        if (!currentUser || !currentProfile) return;
        supabaseClient
            .channel('mobile-notificaciones-perfil')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones_perfil', filter: `usuario=eq.${currentProfile.usuario}` }, () => {
                loadNotifications();
            })
            .subscribe();
    };

    // --- Archivos ---
    const loadFiles = async () => {
        if (!currentUser || !currentProfile) return;
        const role = currentProfile.rol;
        const userClues = currentProfile.clues || "";

        const { data } = await supabaseClient.rpc('get_evidences_list_by_category', {
            category_name: 'Evidencia_de_capacitaciones'
        });

        if (data) {
            let filtered = data;
            if (role === "UNIDAD") {
                filtered = data.filter(f => String(f.name || "").includes(userClues));
            }

            const list = document.getElementById('archivosList');
            if (!list) return;

            if (filtered.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs font-bold">No hay archivos disponibles</div>`;
                return;
            }

            list.innerHTML = filtered.map(f => {
                const parts = (f.name || "").split("/");
                const fileName = parts[parts.length - 1] || f.name;
                const publicUrl = supabaseClient.storage.from('evidencias').getPublicUrl(f.name).data.publicUrl;

                return `
                    <a href="${publicUrl}" target="_blank" class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-700 hover:bg-slate-100 transition-all">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="material-symbols-rounded text-slate-400 text-lg flex-shrink-0">description</span>
                            <span class="text-xs font-bold truncate">${fileName}</span>
                        </div>
                        <span class="material-symbols-rounded text-slate-400 text-sm">open_in_new</span>
                    </a>
                `;
            }).join('');
        }
    };

    // --- BCG Apertura Modal Flow ---
    const openBCGApertura = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const clues = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        const { data } = await supabaseClient
            .from('unidades_bcg_apertura')
            .select('*')
            .eq('clues', clues);

        const box = document.getElementById('bcgAperturaTurnosBox');
        if (!box) return;

        const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo", "No abre"];
        const turnos = ["MATUTINO", "VESPERTINO", "ESPECIAL"];
        
        let html = '';
        turnos.forEach(t => {
            const match = data ? data.find(d => d.turno === t) : null;
            const currentDay = match ? match.dia_semana : 'No abre';
            const options = days.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}</option>`).join('');
            html += `
                <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t.replace('_', ' ')}</span>
                    <select name="bcgAperturaSelect" data-turno="${t}" class="w-full h-10 border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-800">
                        <option value="NO_ABRE" ${currentDay === 'No abre' ? 'selected' : ''}>No abre</option>
                        ${options.replace('<option value="No abre" >No abre</option>', '')}
                    </select>
                </div>
            `;
        });
        box.innerHTML = html;
        document.getElementById('bcgAperturaOverlay').classList.remove('hidden');
    };

    const saveBCGApertura = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const clues = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        
        const selects = Array.from(document.querySelectorAll('select[name="bcgAperturaSelect"]'));
        const rows = [];
        const turnosToDelete = [];

        selects.forEach(sel => {
            const t = sel.getAttribute("data-turno");
            const val = sel.value;
            if (val && val !== "NO_ABRE") {
                rows.push({
                    clues: clues,
                    turno: t,
                    dia_semana: val,
                    updated_at: new Date().toISOString()
                });
            } else {
                turnosToDelete.push(t);
            }
        });

        try {
            if (turnosToDelete.length > 0) {
                const { error: delErr } = await supabaseClient
                    .from('unidades_bcg_apertura')
                    .delete()
                    .eq('clues', clues)
                    .in('turno', turnosToDelete);
                if (delErr) throw delErr;
            }

            if (rows.length > 0) {
                const { error: upsErr } = await supabaseClient
                    .from('unidades_bcg_apertura')
                    .upsert(rows);
                if (upsErr) throw upsErr;
            }

            showToast("Apertura BCG guardada con éxito");
            document.getElementById('bcgAperturaOverlay').classList.add('hidden');
        } catch (error) {
            console.error(error);
            showToast("Error al guardar: " + error.message, "error");
        }
    };

    // --- Directorio BCG Flow ---
    const openBCGDirectorio = async () => {
        try {
            const [resUnits, resApertura] = await Promise.all([
                supabaseClient.from('unidades').select('clues, unidad, municipio').eq('activo', 'SI').order('municipio').order('unidad'),
                supabaseClient.from('unidades_bcg_apertura').select('*')
            ]);

            if (resUnits.error) throw resUnits.error;
            if (resApertura.error) throw resApertura.error;

            window.bcgDirUnits = resUnits.data.filter(u => {
                const name = String(u.unidad || "").toUpperCase();
                return !name.includes("UMME") && !name.includes("FAM");
            });
            window.bcgDirAperturas = resApertura.data;

            const munis = Array.from(new Set(window.bcgDirUnits.map(u => u.municipio))).filter(Boolean).sort();
            const muniSelect = document.getElementById("bcgDirMuniSelect");
            if (muniSelect) {
                muniSelect.innerHTML = '<option value="">Todos los Municipios</option>' + munis.map(m => 
                    `<option value="${m}">${m}</option>`
                ).join('');
            }

            document.getElementById("bcgDirSearchInput").value = "";
            document.getElementById("bcgDirMuniSelect").value = "";
            document.getElementById("bcgDirDaySelect").value = "";

            renderBCGDirectorioList();
            document.getElementById('bcgDirectorioOverlay').classList.remove('hidden');
        } catch (error) {
            console.error("Error al cargar directorio BCG:", error);
            showToast("Error al cargar directorio.", "error");
        }
    };

    const renderBCGDirectorioList = () => {
        const queryInp = document.getElementById("bcgDirSearchInput");
        const muniSel = document.getElementById("bcgDirMuniSelect");
        const daySel = document.getElementById("bcgDirDaySelect");
        const container = document.getElementById("bcgDirList");
        if (!container || !queryInp || !muniSel || !daySel) return;

        const query = queryInp.value.trim().toUpperCase();
        const selectedMuni = muniSel.value;
        const selectedDay = daySel.value;

        const units = window.bcgDirUnits || [];
        const apertures = window.bcgDirAperturas || [];

        const apMap = {};
        apertures.forEach(ap => {
            if (!apMap[ap.clues]) apMap[ap.clues] = [];
            apMap[ap.clues].push(ap);
        });

        const filtered = units.filter(u => {
            if (query) {
                const matchClues = (u.clues || '').toUpperCase().includes(query);
                const matchName = (u.unidad || '').toUpperCase().includes(query);
                if (!matchClues && !matchName) return false;
            }
            if (selectedMuni && u.municipio !== selectedMuni) return false;

            const aps = apMap[u.clues] || [];
            if (selectedDay) {
                const matchesDay = aps.some(ap => String(ap.dia_semana).trim().toUpperCase() === selectedDay.toUpperCase());
                if (!matchesDay) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-bold">Sin resultados</div>`;
            return;
        }

        filtered.sort((a, b) => {
            const muniComp = String(a.municipio || "").localeCompare(String(b.municipio || ""));
            if (muniComp !== 0) return muniComp;
            return String(a.unidad || "").localeCompare(String(b.unidad || ""));
        });

        let html = "";
        let lastMuni = null;

        filtered.forEach(u => {
            const muni = u.municipio || "Sin Municipio";
            if (muni !== lastMuni) {
                lastMuni = muni;
                html += `
                    <div class="text-[#0284c7] font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 mt-4 mb-2">
                        <span class="material-symbols-rounded text-sm">location_on</span>
                        <span>${muni}</span>
                        <div class="flex-1 h-[1px] bg-slate-200"></div>
                    </div>
                `;
            }

            const aps = apMap[u.clues] || [];
            let badgeHtml = "";
            if (aps.length > 0) {
                badgeHtml = aps.map(ap => {
                    let color = "#0284c7";
                    let bg = "#e0f2fe";
                    let icon = "☀️";
                    if (ap.turno === "VESPERTINO") { color = "#d97706"; bg = "#fffbeb"; icon = "⛅"; }
                    else if (ap.turno === "ESPECIAL") { color = "#7c3aed"; bg = "#f5f3ff"; icon = "✨"; }
                    
                    return `
                        <div class="flex items-center gap-1 bg-[${bg}] text-[${color}] border border-[${color}]/10 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase">
                            <span>${icon}</span>
                            <span>${ap.turno.toLowerCase()}</span>
                            <span class="opacity-40">•</span>
                            <span>${ap.dia_semana}</span>
                        </div>
                    `;
                }).join('');
            } else {
                badgeHtml = `
                    <div class="flex items-center gap-1 bg-slate-100 text-slate-400 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase">
                        <span>💤</span>
                        <span>Sin apertura registrada</span>
                    </div>
                `;
            }

            html += `
                <div class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col gap-2">
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-slate-800">${u.unidad}</span>
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">${u.clues}</span>
                    </div>
                    <div class="flex gap-2 flex-wrap pt-2 border-t border-dashed border-slate-100 mt-1">
                        ${badgeHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    };

    // =========================================================================
    // DOCK LIQUID GLASS ENGINE — Exact port from reference.html (Pebble & Void)
    // Uses Canvas 2D physics-based Snell's Law displacement map + clone-world
    // technique so refraction works on ALL browsers (not just backdrop-filter).
    // =========================================================================

    // SurfaceEquations: convex squircle lens profile
    const dockSurfaceEq = (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

    // Calculate 1D surface normal displacement profile
    const calcDispMap1D = (gt, bw, sf, ri, s = 128) => {
        const e = 1 / ri;
        const r = [];
        for (let i = 0; i < s; i++) {
            const x = i / s;
            const y = sf(x);
            const dx = x < 1 ? 0.0001 : -0.0001;
            const d = (sf(Math.max(0, Math.min(1, x + dx))) - y) / dx;
            const m = Math.sqrt(d * d + 1);
            const n = [-d / m, -1 / m];
            const dt = n[1];
            const k = 1 - e * e * (1 - dt * dt);
            if (k < 0) {
                r.push(0);
            } else {
                const rf = [-(e * dt + Math.sqrt(k)) * n[0], e - (e * dt + Math.sqrt(k)) * n[1]];
                r.push(rf[0] * ((y * bw + gt) / rf[1]));
            }
        }
        return r;
    };

    // Calculate 2D displacement map ImageData using squircle surface normals
    const calcDispMap2D = (cw, ch, ow, oh, rad, bw, md, pMap) => {
        const img = new ImageData(cw, ch);
        for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = 128;
            img.data[i + 1] = 128;
            img.data[i + 3] = 255;
        }
        const rSq = rad * rad;
        const rp1Sq = (rad + 1) ** 2;
        const rmBwSq = Math.max(0, rad - bw) ** 2;
        const wB = ow - rad * 2;
        const hB = oh - rad * 2;
        const oX = (cw - ow) / 2;
        const oY = (ch - oh) / 2;
        for (let y1 = 0; y1 < oh; y1++) {
            for (let x1 = 0; x1 < ow; x1++) {
                const idx = ((oY + y1) * cw + oX + x1) * 4;
                const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - wB : 0;
                const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - hB : 0;
                const dSq = x * x + y * y;
                if (dSq <= rp1Sq && dSq >= rmBwSq) {
                    const dist = Math.sqrt(dSq);
                    const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                    const bIdx = Math.floor(Math.max(0, Math.min(1, (rad - dist) / bw)) * pMap.length);
                    const dVal = pMap[Math.max(0, Math.min(bIdx, pMap.length - 1))] || 0;
                    const dX = md > 0 ? (-(dist > 0 ? x / dist : 0) * dVal) / md : 0;
                    const dY = md > 0 ? (-(dist > 0 ? y / dist : 0) * dVal) / md : 0;
                    img.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * op));
                    img.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * op));
                }
            }
        }
        return img;
    };

    // Calculate specular highlight ImageData
    const calcSpecular = (ow, oh, rad, bw) => {
        const img = new ImageData(ow, oh);
        const sVec = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
        const rSq = rad * rad;
        const rp1Sq = (rad + 1) ** 2;
        const rmSSq = Math.max(0, (rad - 1.5) ** 2);
        for (let y1 = 0; y1 < oh; y1++) {
            for (let x1 = 0; x1 < ow; x1++) {
                const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - (ow - rad * 2) : 0;
                const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - (oh - rad * 2) : 0;
                const dSq = x * x + y * y;
                if (dSq <= rp1Sq && dSq >= rmSSq) {
                    const dist = Math.sqrt(dSq);
                    const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                    const dp = Math.abs((dist > 0 ? x / dist : 0) * sVec[0] + (dist > 0 ? -y / dist : 0) * sVec[1]);
                    const cf = dp * Math.sqrt(1 - (1 - Math.max(0, Math.min(1, (rad - dist) / 1.5))) ** 2);
                    const c = Math.min(255, 255 * cf);
                    const idx = (y1 * ow + x1) * 4;
                    img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c;
                    img.data[idx + 3] = Math.min(255, c * cf * op);
                }
            }
        }
        return img;
    };

    const imageDataToURL = (img) => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').putImageData(img, 0, 0);
        return c.toDataURL();
    };

    // Dock glass config (matching reference.html dock settings)
    const DOCK_GLASS = { w: 76, h: 50, r: 25, bw: 18, gt: 100, ri: 2.0, md: 0 };

    // Initialize once: build high-res canvas displacement map + specular, inject SVG filter
    const initDockGlass = () => {
        const pc = calcDispMap1D(DOCK_GLASS.gt, DOCK_GLASS.bw, dockSurfaceEq, DOCK_GLASS.ri);
        DOCK_GLASS.md = Math.max(...pc.map(Math.abs));

        // Use 3x super-sampling resolution (High DPI Retina) to eliminate pixelation and jagged lines
        const retinaScale = 3;
        const widthRes = DOCK_GLASS.w * retinaScale;
        const heightRes = DOCK_GLASS.h * retinaScale;
        const radiusRes = DOCK_GLASS.r * retinaScale;
        const bezelRes = DOCK_GLASS.bw * retinaScale;

        const dispURL = imageDataToURL(calcDispMap2D(
            widthRes, heightRes, widthRes, heightRes,
            radiusRes, bezelRes, DOCK_GLASS.md || 1, pc
        ));
        const specURL = imageDataToURL(calcSpecular(widthRes, heightRes, radiusRes, bezelRes));

        // Inject SVG filter with Retina maps and explicit pixel dimensions
        // Expanded filter region (x="-100%", y="-100%", width="300%", height="300%") prevents boundary clipping lines (the blue/cyan border artifacts)
        const filterHTML = `<svg id="dockGlassSVG" width="0" height="0" style="position:absolute;pointer-events:none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="dockGlassFilter" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">
                    <!-- Set stdDeviation to 0 to keep the background and icons razor sharp (no dirty blur) -->
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blurred" />
                    <!-- Render the high resolution images fit into layout dimensions with image-rendering: crisp-edges quality -->
                    <feImage id="dockDispImg" href="${dispURL}" x="0" y="0" width="${DOCK_GLASS.w}" height="${DOCK_GLASS.h}" result="displacement_map" preserveAspectRatio="none" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" />
                    <!-- Scale reduced slightly (DOCK_GLASS.md * 0.9) to prevent extreme stretches that yield grey pixel borders -->
                    <feDisplacementMap id="dockDispMap" in="blurred" in2="displacement_map" scale="${DOCK_GLASS.md * 0.9}" xChannelSelector="R" yChannelSelector="G" result="displaced" />
                    <feColorMatrix in="displaced" type="saturate" values="1.2" result="displaced_saturated" />
                    <feImage id="dockSpecImg" href="${specURL}" x="0" y="0" width="${DOCK_GLASS.w}" height="${DOCK_GLASS.h}" result="specular_layer" preserveAspectRatio="none" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" />
                    <feComponentTransfer in="specular_layer" result="specular_faded">
                        <feFuncA type="linear" slope="0.8" />
                    </feComponentTransfer>
                    <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
                </filter>
            </defs>
        </svg>`;
        document.body.insertAdjacentHTML('beforeend', filterHTML);

        DOCK_GLASS.dispURL = dispURL;
        DOCK_GLASS.specURL = specURL;

        // Detect backdrop-filter:url() support (Chrome desktop)
        const testEl = document.createElement('div');
        testEl.style.backdropFilter = 'url(#test)';
        DOCK_GLASS.useBackdropFilter = testEl.style.backdropFilter.includes('url');
        
        if (DOCK_GLASS.useBackdropFilter) {
            document.body.classList.add('use-backdrop-filter');
        } else {
            document.body.classList.remove('use-backdrop-filter');
        }

        // Apply to inner element
        const inner = document.getElementById('dockIndicatorInner');
        if (!inner) return;

        if (DOCK_GLASS.useBackdropFilter) {
            inner.style.backdropFilter = 'url(#dockGlassFilter)';
            inner.style.webkitBackdropFilter = 'url(#dockGlassFilter)';
        } else {
            // Clone-world fallback: apply filter to the clone div inside the indicator
            const clone = document.getElementById('dockBubbleClone');
            if (clone) clone.style.filter = 'url(#dockGlassFilter)';
        }
    };

    // Update clone-world transform when indicator moves (reference.html line 1650-1654)
    const updateDockGlassFilter = () => {
        if (DOCK_GLASS.useBackdropFilter) return; // backdrop-filter handles it natively

        const bubble = document.getElementById('dockIndicator');
        const cloneWorld = document.getElementById('dockCloneWorld');
        const dock = document.getElementById('mobileCaptureDock');
        if (!bubble || !cloneWorld || !dock) return;

        const dockRect = dock.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();

        // Translate the clone world opposite to the indicator's position
        // so the clone appears to show the real scene "behind" the indicator
        const gx = bubbleRect.left - dockRect.left;
        const gy = bubbleRect.top - dockRect.top;
        cloneWorld.style.transform = `translate(${-gx}px, ${-gy}px)`;
    };

    const switchPanel = (panelId) => {
        activePanel = panelId;
        
        document.querySelectorAll('.panel-section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`panel${panelId}`)?.classList.remove('hidden');

        const items = document.querySelectorAll('.dock-item');
        let activeBtn = null;
        items.forEach(item => {
            const isActive = item.dataset.panel === panelId;
            item.classList.toggle('active', isActive);
            if (isActive) activeBtn = item;
        });

        if (activeBtn) {
            const indicator = document.getElementById('dockIndicator');
            const dock = document.getElementById('mobileCaptureDock');
            const dockRect = dock.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            
            const transformX = btnRect.left - dockRect.left + (btnRect.width - 76) / 2;

            requestAnimationFrame(() => {
                indicator.style.transform = `translate(${transformX}px, -50%) scale(1.15)`;
                indicator.style.opacity = '1';
                updateDockGlassFilter();
            });
        }

        const hub = document.getElementById('globalCommandHub');
        if (hub) {
            hub.classList.add('visible');
            syncCommandHub();
        }

        // Keep local captures state in sync from database to apply locks immediately
        checkCapturesState().then(() => {
            applyFormLocks();
            syncCommandHub();
        }).catch(err => console.error("Error refreshing captures on panel switch:", err));
    };


    // --- Dock Touch/Drag Logic (Fully non-blocking) ---
    const initDockDrag = () => {
        const indicator = document.getElementById('dockIndicator');
        const dock = document.getElementById('mobileCaptureDock');

        dock.addEventListener('touchstart', (e) => {
            const touchX = e.touches[0].clientX;
            const indRect = indicator.getBoundingClientRect();
            
            if (touchX >= indRect.left && touchX <= indRect.right) {
                isDraggingDock = true;
                dragStartX = touchX;
                const dockRect = dock.getBoundingClientRect();
                dockLeftOffset = indRect.left - dockRect.left;
                indicator.style.transition = 'none';
            }
        }, { passive: true });

        dock.addEventListener('touchmove', (e) => {
            if (!isDraggingDock) return;
            const clientX = e.touches[0].clientX;
            const deltaX = clientX - dragStartX;
            const dockRect = dock.getBoundingClientRect();
            
            let newX = dockLeftOffset + deltaX;
            newX = Math.max(8, Math.min(newX, dockRect.width - 84));

            requestAnimationFrame(() => {
                indicator.style.transform = `translate(${newX}px, -50%) scale(1.15)`;
                updateDockGlassFilter();
            });
        }, { passive: true });

        dock.addEventListener('touchend', (e) => {
            if (!isDraggingDock) return;
            isDraggingDock = false;
            indicator.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.2, 1)';

            const indRect = indicator.getBoundingClientRect();
            const indCenter = indRect.left + indRect.width / 2;

            const items = Array.from(document.querySelectorAll('.dock-item'));
            let closestItem = items[0];
            let minDistance = Infinity;

            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                const itemCenter = rect.left + rect.width / 2;
                const dist = Math.abs(indCenter - itemCenter);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestItem = item;
                }
            });

            switchPanel(closestItem.dataset.panel);
        });

        window.addEventListener('resize', () => {
            updateDockGlassFilter();
        });
    };

    // --- Confirmación de guardado sin cambios tras salto de semanas (paridad con desktop) ---
    const showPrefillGapConfirm = (gapInfo) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('prefillGapConfirmOverlay');
            const msgEl = document.getElementById('prefillGapConfirmMsg');
            if (!overlay || !msgEl) { resolve(true); return; }

            msgEl.innerHTML = `Detectamos un salto de <b>${gapInfo.missedWeeks} semana(s)</b> desde tu última captura del <b>${gapInfo.lastDate}</b> (hace ${gapInfo.diffDays} días).<br><br>Estás guardando las existencias sin cambios respecto a esa fecha.<br><br><b>¿Deseas continuar?</b>`;

            const btnAccept = document.getElementById('btnPrefillGapAccept');
            const btnCancel = document.getElementById('btnPrefillGapCancel');

            const cleanup = (val) => {
                overlay.classList.add('hidden');
                if (btnAccept) btnAccept.onclick = null;
                if (btnCancel) btnCancel.onclick = null;
                overlay.onclick = null;
                resolve(val);
            };

            if (btnAccept) btnAccept.onclick = () => cleanup(true);
            if (btnCancel) btnCancel.onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };

            overlay.classList.remove('hidden');
        });
    };

    // 💉 Modal de fecha de apertura de frasco multidosis (28 días de vigencia).
    // Resuelve con la fecha ISO capturada, o null si el usuario pospone ("Después").
    const openAperturaFrascoModal = ({ biologico, lote, fechaRecepcion, initialDate } = {}) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('aperturaFrascoOverlay');
            const contextEl = document.getElementById('aperturaFrascoContext');
            const dateInput = document.getElementById('aperturaFrascoFechaInput');
            const btnAccept = document.getElementById('btnAperturaFrascoAccept');
            const btnCancel = document.getElementById('btnAperturaFrascoCancel');
            if (!overlay || !dateInput) { resolve(null); return; }

            const hoy = new Date().toISOString().split('T')[0];
            if (contextEl) {
                contextEl.innerHTML = `Detectamos una cantidad decimal en <b>${biologico || ""}</b>, lote <b>${lote || "—"}</b>. Según el manual de vacunación, este frasco debe usarse dentro de los <b>28 días</b> posteriores a su apertura.`;
            }
            dateInput.value = initialDate || hoy;
            dateInput.min = fechaRecepcion || "";
            dateInput.max = hoy;

            const cleanup = (val) => {
                overlay.classList.add('hidden');
                if (btnAccept) btnAccept.onclick = null;
                if (btnCancel) btnCancel.onclick = null;
                overlay.onclick = null;
                resolve(val);
            };

            if (btnCancel) btnCancel.onclick = () => cleanup(null);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
            if (btnAccept) {
                btnAccept.onclick = () => {
                    const val = dateInput.value;
                    if (!val) { showToast("Selecciona la fecha de apertura del frasco", "error"); return; }
                    if (fechaRecepcion && val < fechaRecepcion) { showToast("La fecha de apertura no puede ser anterior a la recepción del lote", "error"); return; }
                    if (val > hoy) { showToast("La fecha de apertura no puede ser posterior a hoy", "error"); return; }
                    cleanup(val);
                };
            }

            overlay.classList.remove('hidden');
        });
    };

    // 💉 Pinta el badge de estado del frasco abierto (o "falta capturar") en la tarjeta SR.
    const renderAperturaBadge = (card) => {
        const badge = card.querySelector('.sr-apertura-badge');
        if (!badge) return;
        const bioSelect = card.querySelector('[data-field="biologico"]');
        const qtyInput = card.querySelector('[data-field="cantidad"]');
        const bio = bioSelect ? bioSelect.value : "";
        const cant = qtyInput ? qtyInput.value : "";
        const hasDecimal = cant !== "" && !isNaN(Number(cant)) && Number(cant) % 1 !== 0;
        const requiresApertura = hasDecimal && VACCINES_REQUIRE_APERTURA.includes(bio);

        if (!requiresApertura) {
            badge.style.display = "none";
            badge.innerHTML = "";
            return;
        }

        const fecha = card.dataset.fechaApertura || "";
        if (!fecha) {
            badge.style.display = "flex";
            badge.innerHTML = `<span class="apertura-pill shelf-life-danger"><span class="material-symbols-rounded" style="font-size:12px;">error</span> Falta fecha apertura</span>`;
            return;
        }

        const status = getAperturaStatus(fecha);
        badge.style.display = "flex";
        badge.innerHTML = status
            ? `<span class="apertura-pill ${status.cls}"><span class="material-symbols-rounded" style="font-size:12px;">${status.icon}</span> ${status.text}</span>`
            : "";
    };

    // 💉 Detecta si el decimal capturado corresponde a un frasco FÍSICO DISTINTO al que ya
    // se venía rastreando para esta tarjeta (mismo lote+entrada), comparando contra la
    // última cantidad guardada. No hay serie/folio por frasco (solo dosis agregadas por
    // lote+entrada), así que es una inferencia — pero la única matemáticamente confiable:
    // si la FRACCIÓN abierta subió respecto a la última captura, es imposible que sea el
    // mismo frasco vaciándose (las dosis solo bajan) -> tiene que ser un frasco distinto.
    // (Ojo: NO basta con que bajen los frascos sellados — eso también pasa al consumir un
    // sellado completo en la semana sin tocar el que ya estaba abierto, p.ej. 2.6 -> 1.6
    // sigue siendo el mismo frasco abierto con 0.6 sin cambios.)
    // Si la fracción se mantiene o baja, es el mismo frasco siguiéndose consumiendo (0.6 -> 0.3).
    const looksLikeNewVialOpening = (prevCantidadStr, currCantidad) => {
        if (prevCantidadStr === "" || prevCantidadStr == null || isNaN(currCantidad)) return false;
        const prevCantidad = Number(prevCantidadStr);
        if (isNaN(prevCantidad)) return false;

        const prevFrac = +(prevCantidad - Math.floor(prevCantidad)).toFixed(4);
        const currFrac = +(currCantidad - Math.floor(currCantidad)).toFixed(4);

        const EPS = 0.001;
        return currFrac > prevFrac + EPS;
    };

    // 💉 Actualiza en vivo el estado/badge de apertura de la tarjeta SIN abrir el modal
    // (se llama en cada blur del input o cambio de biológico). La captura real de la
    // fecha se resuelve en un solo paso al guardar (ver openAperturaBatchModal),
    // o puntualmente si el usuario da clic directo en el badge.
    const updateAperturaState = (card) => {
        if (!card) return;
        const bioSelect = card.querySelector('[data-field="biologico"]');
        const qtyInput = card.querySelector('[data-field="cantidad"]');
        const bio = bioSelect ? bioSelect.value : "";
        const cant = qtyInput ? qtyInput.value : "";
        const hasDecimal = cant !== "" && !isNaN(Number(cant)) && Number(cant) % 1 !== 0;
        const requiresApertura = hasDecimal && VACCINES_REQUIRE_APERTURA.includes(bio);

        if (!requiresApertura) {
            card.dataset.fechaApertura = "";
            card.dataset.fechaAperturaFresh = "0";
        } else if (
            card.dataset.fechaApertura &&
            card.dataset.fechaAperturaFresh !== "1" &&
            looksLikeNewVialOpening(card.dataset.prevCantidad, Number(cant))
        ) {
            // Solo se re-valida una fecha "arrastrada" — una que el usuario acaba de
            // confirmar en esta sesión (fechaAperturaFresh="1") no se vuelve a cuestionar,
            // o el guardado la borraría y saltaría el modal de nuevo aunque ya estaba bien.
            card.dataset.fechaApertura = "";
        }
        renderAperturaBadge(card);
    };

    // 💉 Modal de revisión en lote: lista todas las tarjetas con decimal en TD/DPT/INFLUENZA/
    // HEPATITIS B sin fecha de apertura, para no interrumpir con un modal por cada tarjeta.
    // Resuelve true si se completaron todas las fechas, o false si el usuario cancela.
    const openAperturaBatchModal = (pendingCards) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('aperturaBatchOverlay');
            const listEl = document.getElementById('aperturaBatchList');
            const btnAccept = document.getElementById('btnAperturaBatchAccept');
            const btnCancel = document.getElementById('btnAperturaBatchCancel');
            if (!overlay || !listEl) { resolve(false); return; }

            const hoy = new Date().toISOString().split('T')[0];

            listEl.innerHTML = pendingCards.map((p, i) => `
                <div class="apertura-batch-item">
                    <div class="apertura-batch-item-label">
                        ${p.biologico}
                        <small>Lote ${p.lote || "—"}</small>
                    </div>
                    <input type="date" class="apertura-batch-date-input" data-idx="${i}" value="${hoy}" min="${p.fechaRecepcion || ""}" max="${hoy}">
                </div>
            `).join("");

            const cleanup = (val) => {
                overlay.classList.add('hidden');
                if (btnAccept) btnAccept.onclick = null;
                if (btnCancel) btnCancel.onclick = null;
                overlay.onclick = null;
                resolve(val);
            };

            if (btnCancel) btnCancel.onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
            if (btnAccept) {
                btnAccept.onclick = () => {
                    const inputs = Array.from(listEl.querySelectorAll('.apertura-batch-date-input'));
                    let allValid = true;

                    inputs.forEach((inp) => {
                        const idx = Number(inp.dataset.idx);
                        const p = pendingCards[idx];
                        const val = inp.value;
                        const invalid = !val || (p.fechaRecepcion && val < p.fechaRecepcion) || val > hoy;
                        inp.style.borderColor = invalid ? "#ef4444" : "";
                        if (invalid) allValid = false;
                    });

                    if (!allValid) {
                        showToast("Revisa las fechas marcadas en rojo", "error");
                        return;
                    }

                    inputs.forEach((inp) => {
                        const idx = Number(inp.dataset.idx);
                        const p = pendingCards[idx];
                        p.card.dataset.fechaApertura = inp.value;
                        // Confirmada por el usuario ahora: no se debe re-cuestionar contra
                        // looksLikeNewVialOpening en el refresco defensivo antes de guardar.
                        p.card.dataset.fechaAperturaFresh = "1";
                        renderAperturaBadge(p.card);
                    });

                    cleanup(true);
                };
            }

            overlay.classList.remove('hidden');
        });
    };

    // 💉 Evalúa si la tarjeta requiere fecha de apertura y, si aplica, dispara el modal de captura.
    const handleAperturaCheck = async (card, opts = {}) => {
        if (!card || card.dataset.aperturaModalOpen === "1") return;
        const bioSelect = card.querySelector('[data-field="biologico"]');
        const loteSelect = card.querySelector('[data-field="lote"]');
        const qtyInput = card.querySelector('[data-field="cantidad"]');
        const recInput = card.querySelector('[data-field="recepcion"]');

        if (opts.prompt && qtyInput && qtyInput.disabled) return; // Tarjeta bloqueada (captura ya guardada, sin editar)

        const bio = bioSelect ? bioSelect.value : "";
        const lote = loteSelect ? loteSelect.value : "";
        const cant = qtyInput ? qtyInput.value : "";
        const recep = recInput ? recInput.value : "";

        const hasDecimal = cant !== "" && !isNaN(Number(cant)) && Number(cant) % 1 !== 0;
        const requiresApertura = hasDecimal && VACCINES_REQUIRE_APERTURA.includes(bio);

        if (!requiresApertura) {
            card.dataset.fechaApertura = "";
            card.dataset.fechaAperturaFresh = "0";
            renderAperturaBadge(card);
            return;
        }

        if (opts.prompt && (opts.force || !card.dataset.fechaApertura)) {
            card.dataset.aperturaModalOpen = "1";
            try {
                const fecha = await openAperturaFrascoModal({ biologico: bio, lote, fechaRecepcion: recep, initialDate: card.dataset.fechaApertura || "" });
                if (fecha) {
                    card.dataset.fechaApertura = fecha;
                    // Confirmada por el usuario ahora: no se debe re-cuestionar contra
                    // looksLikeNewVialOpening en el refresco defensivo antes de guardar.
                    card.dataset.fechaAperturaFresh = "1";
                }
            } finally {
                card.dataset.aperturaModalOpen = "0";
            }
        }
        renderAperturaBadge(card);
    };

    // --- Guardar Reportes ---
    const saveReport = async () => {
        if (!currentUser || !currentProfile) {
            showToast("No autorizado o sesión expirada.", "error");
            return;
        }

        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        const muniFilter = isAdmin ? 'Querétaro' : (currentProfile.municipio || '');

        const btn = document.getElementById('hubSaveBtn');
        const statusText = document.getElementById('hubStatusText');

        btn.disabled = true;
        statusText.textContent = "Guardando...";

        try {
            let dataObject = {
                usuario: currentProfile.usuario,
                clues: cluesFilter,
                municipio: muniFilter,
                fecha_captura: new Date().toISOString().split('T')[0]
            };

            let tableName = "";
            let isAlreadySaved = false;

            if (activePanel === 'SR') {
                isAlreadySaved = hasTodaySR;
                const nombreSR = document.getElementById('nombreSR')?.value.trim() || "";
                if (!nombreSR) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }
                dataObject.nombre_responsable = nombreSR;

                const chkSinMov = document.getElementById('chkSinMovimientoSR');
                const sinMovimiento = !!(chkSinMov && chkSinMov.checked);
                dataObject.sin_movimiento = sinMovimiento;

                const items = [];
                let hasInvalid = false;
                const errors = [];

                const cards = document.querySelectorAll('.dynamic-sr-card');
                cards.forEach((card, index) => {
                    const bioSelect = card.querySelector('[data-field="biologico"]');
                    const loteSelect = card.querySelector('[data-field="lote"]');
                    const qtyInput = card.querySelector('[data-field="cantidad"]');
                    const recInput = card.querySelector('[data-field="recepcion"]');
                    const tipoSelect = card.querySelector('[data-field="tipo"]');

                    const bio = bioSelect?.value;
                    const lote = loteSelect?.value;
                    const cant = qtyInput?.value;
                    const recep = recInput?.value;
                    const tipo = tipoSelect?.value || "REQUISICION";

                    if (!bio && !lote && !cant && !recep) return;

                    const rowErrors = [];
                    if (!bio) rowErrors.push("falta seleccionar el biológico");
                    if (bio && !lote) rowErrors.push("falta seleccionar el lote");
                    if (bio && !recep) rowErrors.push("falta la fecha de recepción");
                    if (cant === "") {
                        rowErrors.push("falta ingresar la cantidad");
                    } else if (Number(cant) < 0) {
                        rowErrors.push("la cantidad no puede ser negativa");
                    } else if (Number(cant) === 0) {
                        rowErrors.push("no puedes guardar lotes en ceros, si se terminó elimina la fila");
                    } else if (bio) {
                        const allowedDecimals = ["TD", "COVID-19", "INFLUENZA", "DPT", "HEPATITIS B"];
                        const hasDecimal = Number(cant) % 1 !== 0;
                        if (hasDecimal && !allowedDecimals.includes(bio)) {
                            rowErrors.push(`la vacuna ${bio} no admite decimales`);
                        }
                        // 💉 Frasco multidosis abierto sin fecha de apertura: no bloquea aquí como error
                        // de tarjeta, se resuelve en un solo paso (modal de revisión en lote) al guardar.
                    }

                    let cad = "";
                    const selectedOpt = loteSelect?.selectedOptions?.[0];
                    if (lote && loteSelect) {
                        cad = selectedOpt?.dataset?.cad || "";
                        if (cad) {
                            let cadDate = new Date(cad + "T23:59:59");
                            if (cadDate < new Date()) {
                                rowErrors.push(`el lote ${lote} está caducado (${formatToMmmAa(cad)})`);
                            }
                        }
                    }

                    if (rowErrors.length > 0) {
                        hasInvalid = true;
                        errors.push(`Tarjeta ${index + 1}: ${rowErrors.join(", ")}`);
                    } else {
                        const matchedBio = biologicosCatalogo.find(b =>
                            normalizeString(b.biologico) === normalizeString(bio)
                        );
                        if (matchedBio) {
                            // municipio_origen: de qué municipio viene el lote prestado -- se
                            // lee del propio option elegido (mismo criterio que data-cad),
                            // nunca se le pide un campo aparte al usuario. Solo aplica a
                            // Préstamo; en Requisición el lote ya es tuyo.
                            const esPrestamoTipo = tipo && tipo.startsWith("PRESTAMO");
                            const itemObj = {
                                id: matchedBio.id,
                                biologico: bio,
                                cantidad: Number(cant),
                                lote,
                                recepcion: recep,
                                caducidad: cad,
                                tipo: tipo,
                                fecha_apertura: card.dataset.fechaApertura || null,
                                municipio_origen: esPrestamoTipo ? (selectedOpt?.dataset?.municipio || null) : null
                            };
                            items.push(itemObj);
                            card._pendingSaveItem = itemObj;
                        }
                    }
                });

                if (hasInvalid) {
                    errors.forEach(err => showToast(err, "error"));
                    throw new Error("Validaciones fallidas");
                }

                if (!items.length && !sinMovimiento) {
                    showToast("Captura al menos un biológico", "error");
                    throw new Error("Sin items");
                }

                // 💉 Revisión en lote de frascos multidosis abiertos sin fecha de apertura (un solo modal)
                const pendingAperturaCards = [];
                cards.forEach((card) => {
                    if (!card._pendingSaveItem) return;
                    // Refresca por si el blur no alcanzó a disparar (defensivo): también
                    // detecta aquí si el decimal actual corresponde a un frasco distinto.
                    updateAperturaState(card);
                    if (card.dataset.fechaApertura) return;
                    const bioSelect = card.querySelector('[data-field="biologico"]');
                    const loteSelect = card.querySelector('[data-field="lote"]');
                    const qtyInput = card.querySelector('[data-field="cantidad"]');
                    const recInput = card.querySelector('[data-field="recepcion"]');
                    const bio = bioSelect ? bioSelect.value : "";
                    const lote = loteSelect ? loteSelect.value : "";
                    const cant = qtyInput ? qtyInput.value : "";
                    const recep = recInput ? recInput.value : "";
                    const hasDecimal = cant !== "" && !isNaN(Number(cant)) && Number(cant) % 1 !== 0;
                    if (hasDecimal && VACCINES_REQUIRE_APERTURA.includes(bio)) {
                        pendingAperturaCards.push({ card, biologico: bio, lote, fechaRecepcion: recep });
                    }
                });

                if (pendingAperturaCards.length > 0) {
                    const completed = await openAperturaBatchModal(pendingAperturaCards);
                    if (!completed) {
                        throw new Error("Captura de fecha de apertura cancelada");
                    }
                    pendingAperturaCards.forEach(p => {
                        if (p.card._pendingSaveItem) p.card._pendingSaveItem.fecha_apertura = p.card.dataset.fechaApertura || null;
                    });
                }

                // Confirmación de guardado sin cambios tras salto de semanas (paridad con desktop)
                if (!sinMovimiento && srPrefillGapInfo && srPrefillSnapshot) {
                    const currentSnapshot = JSON.stringify(items.map(item => ({
                        biologico: String(item.biologico || '').trim().toUpperCase(),
                        lote: String(item.lote || '').trim().toUpperCase(),
                        cantidad: Number(item.cantidad)
                    })));
                    if (currentSnapshot === srPrefillSnapshot) {
                        const confirmed = await showPrefillGapConfirm(srPrefillGapInfo);
                        if (!confirmed) throw new Error("Confirmación cancelada");
                    }
                }

                // Delete existing first to avoid duplicate keys (desktop parity)
                await Promise.all([
                    supabaseClient.from('biologicos_existencia').delete().eq('clues', cluesFilter).eq('fecha', dataObject.fecha_captura),
                    supabaseClient.from('existencia_detalle').delete().eq('clues', cluesFilter).eq('fecha', dataObject.fecha_captura)
                ]);

                // Consultar reporte previo para validar transiciones
                const { data: prevReport } = await supabaseClient
                    .from('biologicos_existencia')
                    .select('*')
                    .eq('clues', cluesFilter)
                    .lt('fecha', dataObject.fecha_captura)
                    .order('fecha', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Create summaryRecord for biologicos_existencia
                const summaryRecord = {
                    id: btoa(cluesFilter + ":" + dataObject.fecha_captura + ":" + Date.now()),
                    timestamp: new Date().toISOString(),
                    fecha: dataObject.fecha_captura,
                    municipio: muniFilter,
                    clues: cluesFilter,
                    unidad: currentProfile.unidad || "UNIDAD",
                    capturado_por: nombreSR.toUpperCase(),
                    sin_movimiento: sinMovimiento
                };

                const BIOS = ["bcg", "hepatitis_b", "hexavalente", "dpt", "rotavirus", "neumococica_13", "neumococica_20", "srp", "sr", "vph", "varicela", "hepatitis_a", "td", "tdpa", "covid_19", "influenza", "vsr"];
                BIOS.forEach(b => summaryRecord[b] = 0);

                // Purgar renglones fantasma en 0 si ya hay una partida con stock activo para el mismo lote
                const activeLotsWithStockMobile = new Set();
                items.forEach(it => {
                    const lKey = `${String(it.biologico || '').trim().toUpperCase()}:${String(it.lote || '').trim().toUpperCase()}`;
                    if (Number(it.cantidad || 0) > 0) {
                        activeLotsWithStockMobile.add(lKey);
                    }
                });

                const detailRecords = [];
                items.forEach(it => {
                    const lKey = `${String(it.biologico || '').trim().toUpperCase()}:${String(it.lote || '').trim().toUpperCase()}`;
                    const qty = Number(it.cantidad || 0);

                    if (qty === 0 && activeLotsWithStockMobile.has(lKey)) {
                        console.log(`[Mobile Capture] Purgando renglón fantasma en 0 para lote ${lKey} pues cuenta con stock activo.`);
                        return;
                    }

                    const bioMeta = (typeof window.getBioMetadata === 'function')
                        ? window.getBioMetadata(it.biologico)
                        : { key: (it.biologico || '').toLowerCase(), label: String(it.biologico || '').toUpperCase() };

                    const finalKey = bioMeta.key;
                    if (BIOS.includes(finalKey)) {
                        summaryRecord[finalKey] += qty;
                    }

                    detailRecords.push({
                        fecha: dataObject.fecha_captura,
                        clues: cluesFilter,
                        unidad: currentProfile.unidad || "UNIDAD",
                        municipio: muniFilter,
                        biologico: bioMeta.label || it.biologico,
                        lote: it.lote,
                        caducidad: it.caducidad,
                        fecha_recepcion: it.recepcion,
                        cantidad: qty,
                        capturado_por: nombreSR.toUpperCase(),
                        tipo: it.tipo || "REQUISICION",
                        fecha_apertura: it.fecha_apertura || null,
                        municipio_origen: it.municipio_origen || null
                    });
                });

                // Insert into both tables (sequential guard to prevent orphan summary records)
                if (detailRecords.length > 0) {
                    const resDetail = await supabaseClient.from('existencia_detalle').insert(detailRecords);
                    if (resDetail.error) throw resDetail.error;
                }

                const resSummary = await supabaseClient.from('biologicos_existencia').insert(summaryRecord);
                if (resSummary.error) throw resSummary.error;

                // --- Auto-Resolución y Desduplicación Inteligente de Alertas (Móvil) ---
                try {
                    const { data: activeNotifs } = await supabaseClient
                        .from('notificaciones')
                        .select('id, meta_json')
                        .eq('type', 'ALERTA_DESABASTO');

                    if (activeNotifs && activeNotifs.length > 0) {
                        for (const n of activeNotifs) {
                            try {
                                const meta = typeof n.meta_json === 'string' ? JSON.parse(n.meta_json) : (n.meta_json || {});
                                if (meta.clues === cluesFilter && meta.status === 'activa' && Array.isArray(meta.missing)) {
                                    const remainingMissing = meta.missing.filter(bName => {
                                        const bKey = (typeof window.normalizeBioKey === 'function') ? window.normalizeBioKey(bName) : bName.toLowerCase();
                                        return Number(summaryRecord[bKey] || 0) === 0;
                                    });

                                    if (remainingMissing.length === 0) {
                                        meta.status = 'resuelta';
                                        meta.resolved_ts = new Date().toISOString();
                                        await supabaseClient
                                            .from('notificaciones')
                                            .update({
                                                meta_json: JSON.stringify(meta),
                                                status: 'READ'
                                            })
                                            .eq('id', n.id);
                                        console.log(`[Mobile Capture] Alerta de desabasto ${n.id} marcada automáticamente como RESUELTA`);
                                    }
                                }
                            } catch (eJ) {}
                        }
                    }
                } catch (eAutoR) {
                    console.warn('[Mobile Capture] Aviso en auto-resolución de alertas:', eAutoR);
                }

                // --- Generar Alerta de Desabasto en Móvil (solo Esquema Básico) ---
                const missingBios = BIOS.filter(b => {
                    const isEsquema = (typeof window.isBioEsquemaBasico === 'function') ? window.isBioEsquemaBasico(b) : true;
                    if (!isEsquema) return false;
                    if (summaryRecord[b] !== 0) return false;

                    const bioMeta = (typeof window.getBioMetadata === 'function') ? window.getBioMetadata(b) : {};
                    if (bioMeta.requiresPriorHistory || b === "neumococica_20" || b === "neumococica_13") {
                        const hadStock = prevReport ? Number(prevReport[b] || 0) > 0 : false;
                        if (!hadStock) return false;
                    }
                    return true;
                });

                if (missingBios.length > 0) {
                    // Desduplicación: Verificar si ya existe una alerta activa para esta unidad hoy
                    let hasActiveAlertToday = false;
                    try {
                        const { data: existingAlerts } = await supabaseClient
                            .from('notificaciones')
                            .select('id, created_date, meta_json')
                            .eq('type', 'ALERTA_DESABASTO')
                            .eq('created_date', dataObject.fecha_captura);

                        (existingAlerts || []).forEach(n => {
                            try {
                                const meta = typeof n.meta_json === 'string' ? JSON.parse(n.meta_json) : (n.meta_json || {});
                                if (meta.clues === cluesFilter && meta.status === 'activa') {
                                    hasActiveAlertToday = true;
                                }
                            } catch (e) {}
                        });
                    } catch (eChk) {}

                    if (!hasActiveAlertToday) {
                        try {
                            const missingNames = missingBios.map(b => (typeof window.getBioMetadata === 'function') ? window.getBioMetadata(b).label : b.toUpperCase());
                            const notifId = 'NOTIF:DESABASTO:' + btoa(cluesFilter + ":" + dataObject.fecha_captura + ":" + Date.now());
                            const desabastoRecord = {
                                id: notifId,
                                type: 'ALERTA_DESABASTO',
                                created_ts: new Date().toISOString(),
                                created_date: dataObject.fecha_captura,
                                from_usuario: currentProfile.usuario || 'SISTEMA',
                                from_rol: currentProfile.rol || 'SR',
                                target_scope: 'MUNICIPIO',
                                target_municipio: muniFilter,
                                title: '🚨 Desabasto detectado',
                                message: `La unidad ${currentProfile.unidad || cluesFilter} capturó sin existencias de: ${missingNames.join(', ')}.`,
                                status: 'UNREAD',
                                meta_json: JSON.stringify({
                                    clues: cluesFilter,
                                    unidad: currentProfile.unidad || cluesFilter,
                                    municipio: muniFilter,
                                    missing: missingNames,
                                    status: 'activa'
                                })
                            };
                            await supabaseClient.from('notificaciones').insert(desabastoRecord);
                        
                            // Fan-out a supervisores municipales y admins
                            const { data: activeUsers } = await supabaseClient.from('usuarios_legacy').select('usuario, rol, municipios_allowed').eq('activo', 'SI');
                            const recipients = new Set();
                            (activeUsers || []).forEach(u => {
                                const r = String(u.rol || '').toUpperCase();
                                if (r === 'ADMIN' || r === 'JURISDICCIONAL' || r === 'VISUALIZADOR_JURISDICCIONAL') {
                                    recipients.add(u.usuario);
                                } else if (r === 'MUNICIPAL') {
                                    let allowed = u.municipios_allowed;
                                    if (typeof allowed === 'string') { try { allowed = JSON.parse(allowed); } catch (e) { allowed = [allowed]; } }
                                    const normAllowed = (Array.isArray(allowed) ? allowed : []).map(m => String(m).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
                                    const normMuni = String(muniFilter).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    if (normAllowed.includes("*") || normAllowed.includes(normMuni)) {
                                        recipients.add(u.usuario);
                                    }
                                }
                            });
                            recipients.delete(currentProfile.usuario);
                            const recipientList = Array.from(recipients).filter(Boolean);
                            if (recipientList.length > 0) {
                                const fanoutRows = recipientList.map(u => ({
                                    notificacion_id: notifId,
                                    usuario: u,
                                    status: 'UNREAD',
                                    deleted: false
                                }));
                                await supabaseClient.from('notificaciones_perfil').upsert(fanoutRows, { onConflict: 'notificacion_id,usuario', ignoreDuplicates: true });
                            }
                        } catch (eNotif) {
                            console.warn("[Mobile] Error creando alerta de desabasto:", eNotif);
                        }
                    }
                }

                showToast("Reporte guardado con éxito");
                hasTodaySR = true;
                isEditingSR = false;
                syncCommandHub();
                return;
            } else if (activePanel === 'CONS') {
                tableName = "consumibles";
                delete dataObject.fecha_captura;
                delete dataObject.usuario;
                isAlreadySaved = hasTodayCONS;
                const nombreCONS = document.getElementById('nombreCONS')?.value.trim() || "";
                if (!nombreCONS) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }
                const today = new Date().toISOString().split('T')[0];
                dataObject.capturado_por = nombreCONS;
                dataObject.id = btoa(cluesFilter + ":" + today);

                const chkSinMov = document.getElementById('chkSinMovimientoCONS');
                dataObject.sin_movimiento = !!(chkSinMov && chkSinMov.checked);

                const srpVal = document.getElementById('srp_dosis')?.value;
                const srVal = document.getElementById('sr_dosis')?.value;
                const j05Val = document.getElementById('jeringa_aplic_05ml_0605502657')?.value;
                const j50Val = document.getElementById('jeringa_reconst_5ml_0605500438')?.value;

                if (srpVal === "" || srVal === "" || j05Val === "" || j50Val === "") {
                    showToast("Completa todos los campos obligatorios", "error");
                    throw new Error("Campos incompletos");
                }

                const srp = parseInt(srpVal) || 0;
                const sr = parseInt(srVal) || 0;
                const j05 = parseInt(j05Val) || 0;
                const j50 = parseInt(j50Val) || 0;

                if (srp < 0 || sr < 0 || j05 < 0 || j50 < 0) {
                    showToast("Las cantidades no pueden ser negativas", "error");
                    throw new Error("Valores negativos");
                }

                dataObject.srp_dosis = srp;
                dataObject.sr_dosis = sr;
                dataObject.jeringa_aplic_05ml_0605502657 = j05;
                dataObject.jeringa_reconst_5ml_0605500438 = j50;
                dataObject.aguja_0600403711 = srp + sr;
                dataObject.fecha = new Date().toISOString().split('T')[0];

            } else if (activePanel === 'BIO') {
                tableName = "biologicos_pedido";
                isAlreadySaved = hasTodayBIO;
                const nombreBIO = document.getElementById('nombreBIO')?.value.trim() || "";
                if (!nombreBIO) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }

                // Delete existing first to avoid duplicate keys (desktop parity)
                await supabaseClient.from('biologicos_pedido').delete().eq('clues', cluesFilter).eq('fecha_pedido_programada', targetPedidoDate);

                let records = [];
                let hasError = false;

                document.querySelectorAll('#bioCardsContainer input').forEach(el => {
                    const bioId = el.dataset.bioId;
                    const field = el.dataset.field;
                    const bioName = el.dataset.bioName || "Biológico";
                    const val = parseInt(el.value) || 0;

                    if (bioId && field) {
                        if (val < 0) {
                            showToast(`La cantidad para ${bioName} no puede ser negativa`, "error");
                            hasError = true;
                            return;
                        }
                        const bioKey = String(bioName).trim().toUpperCase();
                        let multiplo = 1;
                        if (bioKey === "HEXAVALENTE") {
                            multiplo = 10;
                        } else if (["BCG", "ROTAVIRUS", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP"].includes(bioKey)) {
                            multiplo = 5;
                        }
                        if (field === 'pedido' && multiplo > 1 && val > 0 && val % multiplo !== 0) {
                            showToast(`El pedido para ${bioName} debe ser múltiplo de ${multiplo} (se ingresó ${val})`, "error");
                            hasError = true;
                            return;
                        }
                        
                        let rec = records.find(r => r.biologico === bioName);
                        if (!rec) {
                            rec = {
                                id: btoa(cluesFilter + ":" + bioName + ":" + Date.now()),
                                timestamp: new Date().toISOString(),
                                fecha_captura: new Date().toISOString().split('T')[0],
                                fecha_pedido_programada: targetPedidoDate,
                                municipio: muniFilter,
                                clues: cluesFilter,
                                biologico: bioName,
                                capturado_por: nombreBIO.toUpperCase(),
                                tipo_pedido: "MENSUAL",
                                sin_pedido: document.getElementById('chkNoPedido').checked,
                                existencia_actual_frascos: 0,
                                pedido_frascos: 0
                            };
                            records.push(rec);
                        }
                        if (field === 'existencia') {
                            rec.existencia_actual_frascos = val;
                        } else if (field === 'pedido') {
                            rec.pedido_frascos = val;
                        }
                    }
                });

                if (hasError) throw new Error("Validación de pedido fallida");

                // Enforce stock vs average monthly rules (BIO lock)
                let warningMsgs = [];
                const sinPedido = document.getElementById('chkNoPedido').checked;
                records.forEach(rec => {
                    const matchedBio = biologicosCatalogo.find(b => 
                        normalizeString(b.biologico) === normalizeString(rec.biologico)
                    );
                    const promedioVal = matchedBio ? (matchedBio.promedio_frascos || 0) : 0;
                    const totalVal = rec.existencia_actual_frascos + rec.pedido_frascos;
                    const normKey = String(rec.biologico).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const isExento = ["VPH", "INFLUENZA", "COVID-19", "COVID 19", "VARICELA", "HEPATITIS A"].includes(normKey);
                    
                    if (promedioVal > 0 && totalVal < promedioVal && !isExento) {
                        warningMsgs.push(`${rec.biologico} (Promedio: ${promedioVal}, Ingresado: ${totalVal})`);
                    }
                });

                if (warningMsgs.length > 0) {
                    showToast("🚫 Ajuste de cantidades requerido: " + warningMsgs.join(", "), "error");
                    throw new Error("Existencia + Pedido es menor al promedio mensual");
                }
                
                const { error } = await supabaseClient.from('biologicos_pedido').insert(records);
                if (error) throw error;

                // Mark as successfully processed and exit saveReport insert block early since it's already done
                showToast("Pedido guardado con éxito");
                hasTodayBIO = true;
                isEditingBIO = false;
                syncCommandHub();
                return;

            } else if (activePanel === 'PINOL') {
                if (hasActivePinol) {
                    showToast("Ya tienes una solicitud de Pinol activa.", "error");
                    throw new Error("Múltiples pedidos de Pinol no permitidos");
                }
                tableName = "pinol_solicitudes";
                const nombrePINOL = document.getElementById('nombrePINOL')?.value.trim() || "";
                if (!nombrePINOL) {
                    showToast("Ingresa el nombre de quien solicita", "error");
                    throw new Error("Nombre requerido");
                }
                const solicitud = parseInt(document.getElementById('pinol_solicitud').value) || 0;
                if (isNaN(solicitud) || solicitud < 1) {
                    showToast("La solicitud debe ser de al menos 1 botella", "error");
                    throw new Error("Cantidad de solicitud inválida");
                }

                const pinolRecord = {
                    id: btoa(cluesFilter + ":" + Date.now()),
                    timestamp_solicitud: new Date().toISOString(),
                    fecha_solicitud: new Date().toISOString().split('T')[0],
                    clues: cluesFilter,
                    unidad: currentProfile.unidad || "UNIDAD SIN NOMBRE",
                    municipio: muniFilter,
                    existencia_actual_botellas: parseInt(document.getElementById('pinol_existencia').value) || 0,
                    solicitud_botellas: solicitud,
                    observaciones: document.getElementById('pinol_observaciones').value.trim(),
                    estatus: "PENDIENTE",
                    capturado_por: nombrePINOL.toUpperCase()
                };

                const { error } = await supabaseClient
                    .from(tableName)
                    .insert([pinolRecord]);

                if (error) throw error;

                showToast("Reporte guardado con éxito");
                hasActivePinol = true;
                pinolFlowStatus = "PENDING";
                updatePinolFlowBanner(pinolFlowStatus);
                applyFormLocks();
                syncCommandHub();
                return;
            }

            // Save or update using upsert/insert
            const { error } = await supabaseClient
                .from(tableName)
                .upsert([dataObject]);

            if (error) throw error;

            showToast("Reporte guardado con éxito");
            
            // Update states and trigger Command Hub Sync
            if (activePanel === 'SR') {
                hasTodaySR = true;
                isEditingSR = false;
            } else if (activePanel === 'CONS') {
                hasTodayCONS = true;
                isEditingCONS = false;
            } else if (activePanel === 'BIO') {
                hasTodayBIO = true;
                isEditingBIO = false;
            } else if (activePanel === 'PINOL') {
                hasActivePinol = true;
            }

            syncCommandHub();

        } catch (err) {
            console.error(err);
            if (err.message === "Confirmación cancelada" || err.message === "Captura de fecha de apertura cancelada") {
                // Cancelación intencional del usuario (modal de salto de semanas / fecha de apertura) — sin toast.
            } else if (err.message && err.message !== "Nombre requerido" && err.message !== "Validaciones fallidas" && err.message !== "Sin items" && err.message !== "Campos incompletos" && err.message !== "Valores negativos" && err.message !== "Validación de pedido fallida") {
                showToast("Error: " + err.message, "error");
            } else if (err.message) {
                // If it is a validation error but has a message, let's toast it to alert the user
                showToast(err.message, "error");
            } else {
                showToast("Error al guardar reporte.", "error");
            }
            syncCommandHub();
        } finally {
            btn.disabled = false;
        }
    };

    // --- Recuperación de Contraseña (Móvil) ---
    const maskEmailMobile = (email) => {
        if (!email || !email.includes("@")) return email;
        const [local, domain] = email.split("@");
        if (local.length <= 3) return local.charAt(0) + "***@" + domain;
        return local.substring(0, 3) + "***" + local.substring(local.length - 2) + "@" + domain;
    };

    const openForgotModalMobile = () => {
        const input = document.getElementById('forgotUsuarioMobile');
        if (input) input.value = '';
        document.getElementById('forgotOverlayMobile')?.classList.remove('hidden');
        setTimeout(() => input?.focus(), 60);
    };

    const closeForgotModalMobile = () => {
        document.getElementById('forgotOverlayMobile')?.classList.add('hidden');
    };

    const requestPasswordResetFlowMobile = async () => {
        const lastRequest = localStorage.getItem("JS1_last_reset_request");
        const now = Date.now();
        const cooldownMs = 60000; // 60 segundos de bloqueo para evitar saturar Supabase
        if (lastRequest) {
            const elapsed = now - parseInt(lastRequest, 10);
            if (elapsed < cooldownMs) {
                const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
                showToast(`Espera ${remaining} segundos antes de solicitar otra recuperación.`, "error");
                return;
            }
        }

        const input = document.getElementById('forgotUsuarioMobile');
        const emailOrUser = input ? input.value.trim() : "";
        if (!emailOrUser) {
            showToast("Ingresa tu usuario o correo institucional", "error");
            return;
        }

        const btn = document.getElementById('btnForgotSendMobile');
        const btnLabel = btn?.querySelector('span:last-child');
        try {
            if (btn) { btn.disabled = true; }
            if (btnLabel) { btnLabel.textContent = 'Enviando...'; }

            // La búsqueda usuario -> correo la hace el servidor (recover-access); el navegador
            // solo recibe el correo enmascarado. El redirectTo apunta a reset.html (página
            // responsiva compartida con desktop) para que el enlace funcione en cualquier dispositivo.
            let res;
            const { data, error } = await supabaseClient.functions.invoke('recover-access', {
                body: {
                    identifier: emailOrUser,
                    mode: 'recovery',
                    redirectTo: window.location.origin + window.location.pathname.replace('mobile.html', '') + 'reset.html'
                }
            });
            if (error) {
                try { res = await error.context.json(); } catch (e) { res = null; }
                if (!res) res = { ok: false, message: error.message || "No se pudo contactar al servidor" };
            } else {
                res = data || { ok: false, message: "Respuesta vacía del servidor" };
            }

            if (!res.ok) {
                showToast(res.message || "No se pudo enviar el enlace", "error");
                return;
            }

            localStorage.setItem("JS1_last_reset_request", Date.now().toString());
            showToast(`Enlace enviado a ${res.masked}. Revisa también tu bandeja de SPAM.`, "success");
            closeForgotModalMobile();
        } catch (e) {
            console.error(e);
            showToast("Error al solicitar recuperación", "error");
        } finally {
            if (btn) { btn.disabled = false; }
            if (btnLabel) { btnLabel.textContent = 'Enviar enlace'; }
        }
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
            if (error) showToast(error.message, "error");
            else handleAuthSuccess(data.user);
        });

        document.getElementById('btnForgotPasswordMobile')?.addEventListener('click', openForgotModalMobile);
        document.getElementById('btnForgotCloseMobile')?.addEventListener('click', closeForgotModalMobile);
        document.getElementById('btnForgotSendMobile')?.addEventListener('click', requestPasswordResetFlowMobile);
        document.getElementById('forgotOverlayMobile')?.addEventListener('click', (e) => {
            if (e.target.id === 'forgotOverlayMobile') closeForgotModalMobile();
        });

        document.getElementById('btnBiometricLogin')?.addEventListener('click', handleBiometricLogin);
        document.getElementById('chkBiometria')?.addEventListener('change', (e) => handleRegisterBiometrics(e.target.checked));

        document.getElementById('btnThemeToggleProfile')?.addEventListener('click', toggleTheme);
        document.getElementById('btnProfileContactMobile')?.addEventListener('click', () => window.openContactoModal());
        document.getElementById('btnProfileChangePasswordMobile')?.addEventListener('click', () => window.openChangePasswordFlow());
        document.getElementById('btnLogout')?.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            location.reload();
        });

        document.getElementById('btnAddSRCard')?.addEventListener('click', () => {
            addSRCard();
            showToast("Nuevo registro añadido.");
        });

        const setupModalToggle = (btnId, modalId) => {
            const btn = document.getElementById(btnId);
            const overlay = document.getElementById(modalId);
            const card = overlay?.querySelector('.dropdown-card');

            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                ['profileDropdown', 'topNotifDropdown', 'archivosDropdown', 'bcgAperturaOverlay', 'bcgDirectorioOverlay'].forEach(id => {
                    if (id !== modalId) document.getElementById(id)?.classList.add('hidden');
                });
                overlay.classList.toggle('hidden');
            });
            card?.addEventListener('click', (e) => e.stopPropagation());
            overlay?.addEventListener('click', () => overlay.classList.add('hidden'));
        };

        setupModalToggle('btnProfileToggle', 'profileDropdown');
        setupModalToggle('btnNotifToggle', 'topNotifDropdown');
        setupModalToggle('btnFilesToggle', 'archivosDropdown');

        document.getElementById('btnClearNotifs')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser || !currentProfile) return;
            const { error } = await supabaseClient
                .from('notificaciones_perfil')
                .update({ deleted: true, deleted_ts: new Date().toISOString() })
                .eq('usuario', currentProfile.usuario)
                .eq('deleted', false);
            if (error) {
                showToast("Error al limpiar notificaciones: " + error.message, "error");
            } else {
                showToast("Notificaciones limpiadas");
                loadNotifications();
            }
        });

        // BCG Modals Setup
        document.getElementById('btnSetBCGMobile')?.addEventListener('click', openBCGApertura);
        document.getElementById('btnDirectorioBCGMobile')?.addEventListener('click', openBCGDirectorio);
        
        document.getElementById('bcgAperturaOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'bcgAperturaOverlay') e.target.classList.add('hidden');
        });
        document.getElementById('bcgDirectorioOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'bcgDirectorioOverlay') e.target.classList.add('hidden');
        });

        document.getElementById('btnCancelBCGApertura')?.addEventListener('click', () => {
            document.getElementById('bcgAperturaOverlay').classList.add('hidden');
        });
        document.getElementById('btnSaveBCGApertura')?.addEventListener('click', saveBCGApertura);
        document.getElementById('btnCancelBCGDir')?.addEventListener('click', () => {
            document.getElementById('bcgDirectorioOverlay').classList.add('hidden');
        });

        document.getElementById('bcgDirSearchInput')?.addEventListener('input', renderBCGDirectorioList);
        document.getElementById('bcgDirMuniSelect')?.addEventListener('change', renderBCGDirectorioList);
        document.getElementById('bcgDirDaySelect')?.addEventListener('change', renderBCGDirectorioList);

        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active');
                document.getElementById(`profileTab_${btn.dataset.tab}`)?.classList.remove('hidden');
            });
        });

        document.getElementById('chkSinMovimientoSR')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('#srCardsContainer select, #srCardsContainer input, #srCardsContainer button, #btnAddSRCard').forEach(el => {
                if (el.id === 'chkSinMovimientoSR') return;
                el.disabled = disabled;
                el.style.opacity = disabled ? "0.55" : "";
                el.style.pointerEvents = disabled ? "none" : "";
                if (disabled && el.type === 'number') el.value = 0;
            });
            if (disabled) showToast("Biológicos marcados Sin Movimiento.");
        });

        document.getElementById('chkSinMovimientoCONS')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('#panelCONS input, #panelCONS textarea, #panelCONS select').forEach(el => {
                if (el.id !== 'chkSinMovimientoCONS' && el.id !== 'nombreCONS') {
                    el.disabled = disabled;
                    el.style.opacity = disabled ? "0.55" : "";
                    el.style.pointerEvents = disabled ? "none" : "";
                    if (disabled && el.type === 'number') el.value = 0;
                }
            });
            if (disabled) showToast("Consumibles marcados Sin Movimiento.");
        });

        document.getElementById('chkNoPedido')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('.bio-ped-input').forEach(el => {
                el.disabled = disabled;
                el.style.opacity = disabled ? "0.55" : "";
                el.style.pointerEvents = disabled ? "none" : "";
                if (disabled) {
                    el.value = 0;
                    el.dispatchEvent(new Event('input'));
                }
            });
            if (disabled) showToast("Solo existencias activo.");
        });

        document.addEventListener('click', () => {
            document.getElementById('profileDropdown')?.classList.add('hidden');
            document.getElementById('topNotifDropdown')?.classList.add('hidden');
            document.getElementById('archivosDropdown')?.classList.add('hidden');
        });

        document.getElementById('mobileCaptureDock')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.dock-item');
            if (btn && !isDraggingDock) {
                switchPanel(btn.dataset.panel);
            }
        });

        let touchStartX = 0;
        let touchEndX = 0;
        const mainArea = document.getElementById('captureContentArea');
        mainArea?.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        mainArea?.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const diffX = touchStartX - touchEndX;
            const panels = ['SR', 'CONS', 'BIO', 'PINOL'];
            const curIdx = panels.indexOf(activePanel);
            if (Math.abs(diffX) > 80 && !isDraggingDock) {
                if (diffX > 0 && curIdx < panels.length - 1) switchPanel(panels[curIdx + 1]);
                else if (diffX < 0 && curIdx > 0) switchPanel(panels[curIdx - 1]);
            }
        }, { passive: true });

        const syncNeedles = () => {
            const srp = parseInt(document.getElementById('srp_dosis')?.value) || 0;
            const sr = parseInt(document.getElementById('sr_dosis')?.value) || 0;
            const agujaInput = document.getElementById('aguja_0600403711');
            if (agujaInput) {
                agujaInput.value = srp + sr;
            }
        };
        document.getElementById('srp_dosis')?.addEventListener('input', syncNeedles);
        document.getElementById('sr_dosis')?.addEventListener('input', syncNeedles);

        document.getElementById('hubEditBtn')?.addEventListener('click', () => {
            if (activePanel === 'SR') isEditingSR = true;
            if (activePanel === 'CONS') isEditingCONS = true;
            if (activePanel === 'BIO') isEditingBIO = true;
            syncCommandHub();
            showToast("Modo edición activado", "success");
        });

        document.getElementById('hubCancelBtn')?.addEventListener('click', async () => {
            if (activePanel === 'SR') {
                isEditingSR = false;
                await prefillPreviousReport();
            } else if (activePanel === 'CONS') {
                isEditingCONS = false;
                // Reload CONS data if any
            } else if (activePanel === 'BIO') {
                isEditingBIO = false;
                // Reload BIO data if any
            }
            syncCommandHub();
            showToast("Edición cancelada", "error");
        });

        document.getElementById('hubSaveBtn')?.addEventListener('click', saveReport);

        // --- Mobile Feedback Event Listeners ---
        const fbBtn = document.getElementById('btnFeedbackMobile');
        const fbOverlay = document.getElementById('feedbackMobileOverlay');
        const fbForm = document.getElementById('feedbackMobileForm');
        const fbUploadArea = document.getElementById('fbMobileUploadArea');
        const fbImagesInput = document.getElementById('fbMobileImagesInput');
        const fbPreviewGrid = document.getElementById('fbMobilePreviewGrid');

        let fbUploadedFiles = [];

        if (fbBtn && fbOverlay) {
            fbBtn.addEventListener('click', () => {
                fbOverlay.classList.remove('hidden');
                fbUploadedFiles = [];
                if (fbPreviewGrid) fbPreviewGrid.innerHTML = '';
                if (fbForm) fbForm.reset();
            });
        }

        // Respuestas automáticas para dudas con solución conocida (ver feedback_autoreply.js)
        if (fbForm) {
            window.FeedbackAutoReply?.attach({
                textarea: document.getElementById('fbMobileMessage'),
                form: fbForm,
                typeSelect: document.getElementById('fbMobileType'),
                getContext: () => ({ loggedIn: !!currentProfile }),
                onClose: () => fbOverlay.classList.add('hidden'),
                onResolved: () => { fbOverlay.classList.add('hidden'); fbForm.reset(); }
            });
        }

        if (fbUploadArea && fbImagesInput) {
            fbUploadArea.addEventListener('click', () => {
                fbImagesInput.click();
            });
        }

        const handleFbFiles = (files) => {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;
                fbUploadedFiles.push(file);

                const reader = new FileReader();
                reader.onload = (e) => {
                    const idx = fbUploadedFiles.length - 1;
                    const item = document.createElement('div');
                    item.className = 'fb-mobile-preview-item';
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="fb-mobile-preview-remove" data-index="${idx}">✕</button>
                    `;
                    fbPreviewGrid.appendChild(item);
                };
                reader.readAsDataURL(file);
            }
        };

        if (fbImagesInput) {
            fbImagesInput.addEventListener('change', (e) => {
                if (e.target.files) {
                    handleFbFiles(e.target.files);
                    fbImagesInput.value = '';
                }
            });
        }

        if (fbPreviewGrid) {
            fbPreviewGrid.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.fb-mobile-preview-remove');
                if (removeBtn) {
                    const idx = parseInt(removeBtn.dataset.index);
                    fbUploadedFiles.splice(idx, 1);
                    removeBtn.closest('.fb-mobile-preview-item').remove();
                    // Update indices
                    fbPreviewGrid.querySelectorAll('.fb-mobile-preview-remove').forEach((btn, newIdx) => {
                        btn.dataset.index = newIdx;
                    });
                }
            });
        }

        if (fbOverlay) {
            // Paste screenshot handler
            fbOverlay.addEventListener('paste', (e) => {
                if (fbOverlay.classList.contains('hidden')) return;
                const items = e.clipboardData?.items;
                if (items) {
                    const files = [];
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) files.push(file);
                        }
                    }
                    if (files.length > 0) {
                        handleFbFiles(files);
                        showToast("Imagen pegada desde el portapapeles");
                    }
                }
            });
        }

        if (fbForm) {
            fbForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const type = document.getElementById('fbMobileType').value;
                const moduleVal = document.getElementById('fbMobileModule').value;
                const message = document.getElementById('fbMobileMessage').value;
                const submitBtn = document.getElementById('btnSubmitFeedbackMobile');

                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="material-symbols-rounded animate-spin text-sm">refresh</span> Enviando...';
                submitBtn.disabled = true;

                const userName = currentProfile?.nombre || currentProfile?.usuario || "Usuario Anónimo Móvil";
                const userRole = currentProfile?.rol || "Desconocido";
                const userUnit = currentProfile?.unidad || "N/A";
                const userClues = currentProfile?.clues || "N/A";

                let embedColor = 3447003;
                let typeEmoji = "❓ Pregunta/Duda";
                if (type === "Sugerencia") {
                    embedColor = 16766720;
                    typeEmoji = "💡 Sugerencia (Mobile)";
                } else if (type === "Error") {
                    embedColor = 15158332;
                    typeEmoji = "🚨 Reporte de Error (Mobile)";
                }

                const fields = [
                    { name: "👤 Usuario", value: userName, inline: true },
                    { name: "🔑 Rol", value: userRole, inline: true },
                    { name: "🏥 Unidad", value: userUnit, inline: true },
                    { name: "🏢 CLUES", value: userClues, inline: true },
                    { name: "🛠️ Módulo", value: moduleVal, inline: true }
                ];

                if (type === "Error" && recentErrors.length > 0) {
                    fields.push({
                        name: "💻 Errores Recientes (Consola)",
                        value: "```js\n" + recentErrors.join("\n") + "\n```",
                        inline: false
                    });
                }

                const embed = {
                    title: `${typeEmoji}`,
                    description: `**Mensaje:**\n${message}`,
                    color: embedColor,
                    fields: fields,
                    footer: { text: "SIREVAQ Mobile" },
                    timestamp: new Date().toISOString()
                };

                if (fbUploadedFiles.length > 0) {
                    embed.image = { url: "attachment://image_0.png" };
                }

                const FEEDBACK_ENDPOINT = SUPABASE_URL + "/functions/v1/send-feedback"; // Edge Function; el webhook de Discord ya no vive en el navegador

                const formData = new FormData();
                formData.append("payload_json", JSON.stringify({ embeds: [embed] }));

                fbUploadedFiles.forEach((file, index) => {
                    const ext = file.name.split('.').pop() || "png";
                    formData.append(`files[${index}]`, file, `image_${index}.${ext}`);
                });

                try {
                    const response = await fetch(FEEDBACK_ENDPOINT, {
                        method: "POST",
                        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
                        body: formData
                    });

                    if (response.ok) {
                        showToast("¡Feedback recibido con éxito!");
                        fbOverlay.classList.add('hidden');
                        fbForm.reset();
                    } else {
                        throw new Error("Discord response not ok");
                    }
                } catch (error) {
                    console.error("Error sending mobile feedback:", error);
                    showToast("No se pudo enviar el reporte. Intenta más tarde.", "error");
                } finally {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            });
        }
    };

    // --- Animated Particles Background ---
    const initBgCanvas = () => {
        const canvas = document.createElement('canvas');
        canvas.id = 'bgCanvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '-2';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.35';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = [];
        const count = 24;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 1
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            const isDark = document.documentElement.classList.contains('dark');
            ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.1)';

            particles.forEach((p, idx) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();

                for (let j = idx + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 110) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });

            requestAnimationFrame(animate);
        };

        animate();
    };

    // --- Date & Capture Window Calculations ---
    function calculateBioIntelligentWindow(year, month) {
        return getBioCaptureWindow(year, month + 1);
    }

    function checkConsumiblesCaptureWindow() {
        const d = new Date();
        const dow = d.getDay();

        // 4 = Thursday
        if (dow === 4) {
            return true;
        }

        // 3 = Wednesday
        if (dow === 3) {
            const tomorrow = new Date(d);
            tomorrow.setDate(d.getDate() + 1);
            if (isMexicanHoliday(tomorrow)) {
                return true;
            }
        }

        return false;
    }

    function getBioCaptureWindow(year, month) {
        let target = new Date(year, month - 1, 22);
        while (!isBusinessDay(target)) {
            target.setDate(target.getDate() - 1);
        }
        let start = new Date(target);
        start.setDate(start.getDate() - 1);
        while (!isBusinessDay(start)) {
            start.setDate(start.getDate() - 1);
        }
        let end = new Date(target);
        end.setDate(end.getDate() + 1);
        while (!isBusinessDay(end)) {
            end.setDate(end.getDate() + 1);
        }
        return { start, target, end };
    }

    function isBusinessDay(date) {
        const day = date.getDay();
        if (day === 0 || day === 6) return false;
        if (isMexicanHoliday(date)) return false;
        return true;
    }

    function isMexicanHoliday(date) {
        if (typeof dayjs === 'undefined') {
            return false;
        }
        const d = dayjs(date);
        const y = d.year();
        const m = d.month() + 1;
        const dayOfMonth = d.date();
        const dayOfWeek = d.day();

        const fixed = [
            "01-01", // Año nuevo
            "05-01", // Trabajo
            "09-16", // Independencia
            "12-25"  // Navidad
        ];

        const mmdd = `${String(m).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
        if (fixed.includes(mmdd)) return true;

        if (m === 2 && dayOfWeek === 1 && dayOfMonth <= 7) return true;
        if (m === 3 && dayOfWeek === 1 && dayOfMonth >= 15 && dayOfMonth <= 21) return true;
        if (m === 11 && dayOfWeek === 1 && dayOfMonth >= 15 && dayOfMonth <= 21) return true;

        const easter = dayjs(getEasterDate(y));
        const juevesSanto = easter.subtract(3, 'day');
        const viernesSanto = easter.subtract(2, 'day');

        if (d.isSame(juevesSanto, 'day') || d.isSame(viernesSanto, 'day')) {
            return true;
        }
        return false;
    }

    function getEasterDate(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function dateToLocalYmd(d) {
        if (!d) return "";
        if (typeof d === "string") return d;
        if (!(d instanceof Date)) return "";
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSupabase();
            setupEventListeners();
            initBgCanvas();
        });
    } else {
        initSupabase();
        setupEventListeners();
        initBgCanvas();
    }
})();
