/**
 * SIS / SINBA -- Captura mensual del concentrado SIS-06-P, portada a la
 * ventana de BioVac (Fase 3), con motor de envío/validación (Fase 4). NO
 * depende de `AppService`/`window.USER` -- usa el cliente Supabase
 * (`estado.db`) y la sesión (`estado.perfil`) de `biovac_ui.js`, y
 * `toast()`/`mostrarCargando()`/`ocultarCargando()` de ese mismo archivo.
 *
 * La unidad captura su concentrado MENSUAL completo (104 variables), NO por
 * día. Afromexicano/Indígena/Migrante son subconteos ilustrativos, subconjunto
 * del total, nunca se suman aparte.
 *
 * Flujo de estatus (motor en supabase/sis06p_estado_engine.sql):
 * BORRADOR (unidad edita libre) -> ENVIADO (unidad ya no edita; municipal/
 * jurisdiccional/admin sí, cada edición se audita automáticamente por
 * trigger) -> VALIDADO (municipal marcó validado; unidad ve "cambios
 * pendientes de aceptar" si hubo correcciones, y el botón Imprimir).
 * Este módulo también sirve como "modo revisión" para roles MUNICIPAL/
 * JURISDICCIONAL/ADMIN: `claveActiva()` resuelve la CLUES objetivo según
 * quién mira, no siempre `estado.perfil.clues`.
 */
(function () {
  let _sisVariablesCache = [];
  let _sis06pCapturasCache = [];
  let _influenzaCapturasCache = [];
  let _ventanaCache = null;
  let _correccionesPendientesCache = [];

  // Copia de window.INFLUENZA_SIS_MAPPING (fuente única de verdad real:
  // influenza_module.js:57-72) -- biovac.html no carga influenza_module.js
  // (es de otra página/bundle), así que se duplica aquí solo esta constante
  // pequeña. Si cambia allá, hay que reflejarlo aquí.
  const INFLUENZA_SIS_MAPPING = {
    r1: "BIE01", r2: "BIE28", r3: "BIE29", r4: "BIE30", r5: "BIE31",
    r6: "BIE04", r7: "BIE32", r8: "BIE33", r9: "BIE34", r10: "BIE35",
    r11: "BIE36", r12: "BIE37", r13: "BIE38", r14: "BIE39", r15: "BIE40",
    r16: "BIO96", r17: "BIO97",
    r18: "BIE09", r19: "BIE10", r20: "BIE41",
    r21: "BIE12", r22: "BIE13", r23: "BIE42",
    r24: "BIE15", r25: "BIE16", r26: "BIE43",
    r27: "BIE18", r28: "BIE19", r29: "BIE44",
    r30: "BIE48", r31: "BIE49", r32: "BIE50",
    r33: "BIE24", r34: "BIE25", r35: "BIE46",
    r36: "BIE51", r37: "BIE52", r38: "BIE53",
    r39: "BIE54", r40: "BIE55",
    r41: "BIE56", r42: "BIE57", r43: "BIE58",
    r44: "BIE59", r45: "BIE60", r46: "BIE61"
  };

  const _SIS_ACCENT_PALETTE = [
    { border: '#0ea5e9', bg: '#e0f2fe', bgSoft: '#f0f9ff', text: '#0369a1' },
    { border: '#8b5cf6', bg: '#ede9fe', bgSoft: '#f5f3ff', text: '#6d28d9' },
    { border: '#10b981', bg: '#d1fae5', bgSoft: '#ecfdf5', text: '#047857' },
    { border: '#f59e0b', bg: '#fef3c7', bgSoft: '#fffbeb', text: '#b45309' },
    { border: '#ec4899', bg: '#fce7f3', bgSoft: '#fdf2f8', text: '#be185d' },
    { border: '#14b8a6', bg: '#ccfbf1', bgSoft: '#f0fdfa', text: '#0f766e' },
    { border: '#f43f5e', bg: '#ffe4e6', bgSoft: '#fff1f2', text: '#be123c' },
    { border: '#6366f1', bg: '#e0e7ff', bgSoft: '#eef2ff', text: '#4338ca' },
    { border: '#84cc16', bg: '#ecfccb', bgSoft: '#f7fee7', text: '#4d7c0f' },
    { border: '#06b6d4', bg: '#cffafe', bgSoft: '#ecfeff', text: '#0e7490' }
  ];
  function accentDeBiologico(biologico) {
    let hash = 0;
    const str = String(biologico || '');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return _SIS_ACCENT_PALETTE[hash % _SIS_ACCENT_PALETTE.length];
  }

  // Reutiliza el catálogo global `MESES` ya definido en biovac_ui.js
  // ({v,l}[], cargado antes que este archivo).
  function mesNombre(m) {
    const found = (typeof MESES !== 'undefined' ? MESES : []).find((x) => x.v === Number(m));
    return found ? found.l : String(m);
  }

  // ---------------------------------------------------------------------------
  // Resolución de la CLUES/unidad "activa": UNIDAD siempre ve la suya propia
  // (selector bloqueado); MUNICIPAL/JURISDICCIONAL/ADMIN ven la que hayan
  // elegido en el selector compartido del encabezado (modo revisión). El
  // valor especial "Jurisdicción (suma)" no es una CLUES real -- SIS-06-P no
  // tiene sentido ahí, se resuelve a null y las pantallas muestran un aviso.
  // ---------------------------------------------------------------------------

  function esRolRevisor() {
    const rol = estado.perfil && estado.perfil.rol;
    return rol === 'MUNICIPAL' || rol === 'JURISDICCIONAL' || rol === 'ADMIN';
  }

  function datosUnidadActiva() {
    if (!estado.perfil) return null;
    if (estado.perfil.rol === 'UNIDAD') {
      return { clues: estado.perfil.clues, unidad: estado.perfil.unidad, municipio: estado.perfil.municipio };
    }
    const selVal = document.getElementById('selUnidad')?.value;
    if (!selVal || selVal === UNIDAD_JURISDICCION) return null;
    const u = (estado.unidades || []).find((x) => x.id === selVal);
    if (!u) return null;
    return { clues: u.clues, unidad: u.nombre, municipio: u.municipio };
  }

  async function init() {
    const activa = datosUnidadActiva();
    const container = document.getElementById('sis06pCaptureGroupsContainer');
    if (!activa) {
      if (container) container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Selecciona una unidad (CLUES) específica arriba -- "Jurisdicción (suma)" no aplica a SIS-06-P.</div>';
      return;
    }
    try {
      if (_sisVariablesCache.length === 0) {
        const { data: vars, error: e1 } = await estado.db.from('sis_variables').select('*').eq('activo', true).order('orden');
        if (e1) throw e1;
        _sisVariablesCache = vars || [];
      }

      const { data: capturas, error: e2 } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      if (e2) throw e2;
      _sis06pCapturasCache = capturas || [];

      const { data: capturasInf, error: e3 } = await estado.db.from('influenza_capturas').select('fecha, valores').eq('clues', activa.clues);
      if (e3) throw e3;
      _influenzaCapturasCache = capturasInf || [];

      const mes = Number(document.getElementById('selMes').value);
      const anio = Number(document.getElementById('selAnio').value);
      const { data: ventana, error: e4 } = await estado.db.rpc('sis06p_ventana_envio', { p_anio: anio, p_mes: mes });
      if (e4) { console.warn('[SIS-06-P] Error cargando ventana:', e4); _ventanaCache = null; }
      else _ventanaCache = (ventana && ventana[0]) || null;

      await cargarCorreccionesPendientes(activa.clues);

      render();
    } catch (err) {
      console.error('[SIS-06-P] Error al cargar:', err);
      toast('Error al cargar SIS-06-P: ' + err.message, 'error');
    }
  }

  async function cargarCorreccionesPendientes(clues) {
    if (estado.perfil.rol !== 'UNIDAD') { _correccionesPendientesCache = []; return; }
    const { data, error } = await estado.db.from('sis06p_correcciones')
      .select('*').eq('clues', clues).eq('tipo', 'EDICION_MUNICIPAL').eq('reconocido_por_unidad', false)
      .order('creado_en', { ascending: false });
    if (error) { console.warn('[SIS-06-P] Error cargando correcciones pendientes:', error); _correccionesPendientesCache = []; return; }
    _correccionesPendientesCache = data || [];
  }

  const SUBCONTEO_LABEL = { total: 'Total', afro: 'Afromexicano', indigena: 'Indígena', migrante: 'Migrante' };

  function labelDeFila(filaExcel) {
    const v = _sisVariablesCache.find((x) => Number(x.fila_excel) === Number(filaExcel));
    if (!v) return `Fila ${filaExcel}`;
    return `${v.biologico} -- ${v.grupo_poblacional || ''}${v.dosis ? ' · ' + v.dosis : ''}`;
  }

  function renderPanelCambiosPendientes() {
    const panel = document.getElementById('sis06pPanelCambiosPendientes');
    const lista = document.getElementById('sis06pListaCambiosPendientes');
    if (!panel || !lista) return;

    if (estado.perfil.rol !== 'UNIDAD' || _correccionesPendientesCache.length === 0) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    lista.innerHTML = _correccionesPendientesCache.map((c) => `
      <div style="background:#fff; border:1px solid var(--warning-border); border-radius:10px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div style="font-size:11.5px;">
          <strong>${labelDeFila(c.fila_excel)}</strong> -- ${SUBCONTEO_LABEL[c.subconteo] || c.subconteo}:
          <span style="color:var(--muted); text-decoration:line-through;">${c.valor_anterior}</span>
          <span class="material-symbols-rounded" style="font-size:12px; vertical-align:middle;">arrow_forward</span>
          <strong style="color:var(--warning);">${c.valor_nuevo}</strong>
          <span style="color:var(--muted);"> -- ${c.usuario}, ${new Date(c.creado_en).toLocaleDateString('es-MX')}</span>
        </div>
        <button class="btn-mini btn-secundario" data-aceptar-correccion="${c.id}"><span class="material-symbols-rounded">check</span> Aceptar</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-aceptar-correccion]').forEach((btn) => {
      btn.addEventListener('click', () => aceptarCambio(btn.getAttribute('data-aceptar-correccion')));
    });
  }

  async function aceptarCambio(correccionId) {
    try {
      const { error } = await estado.db.rpc('sis06p_reconocer_correccion', { p_correccion_id: correccionId, p_usuario: nombreCompletoDePerfil(estado.perfil) });
      if (error) throw error;
      const activa = datosUnidadActiva();
      await cargarCorreccionesPendientes(activa.clues);
      renderPanelCambiosPendientes();
      toast('Cambio aceptado.', 'ok');
    } catch (err) {
      toast('Error al aceptar el cambio: ' + err.message, 'error');
    }
  }

  async function aceptarTodosCambios() {
    const activa = datosUnidadActiva();
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === Number(document.getElementById('selMes').value) && Number(r.anio) === Number(document.getElementById('selAnio').value));
    if (!currentReport) return;
    try {
      const { error } = await estado.db.rpc('sis06p_reconocer_todas', { p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil) });
      if (error) throw error;
      await cargarCorreccionesPendientes(activa.clues);
      renderPanelCambiosPendientes();
      toast('Todos los cambios fueron aceptados.', 'ok');
    } catch (err) {
      toast('Error al aceptar los cambios: ' + err.message, 'error');
    }
  }

  function renderBannerVentana(estadoActual) {
    const banner = document.getElementById('sis06pBannerVentana');
    if (!banner) return;
    if (!_ventanaCache || estado.perfil.rol !== 'UNIDAD' || estadoActual !== 'BORRADOR') {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    if (_ventanaCache.dentro_envio) {
      banner.style.cssText += 'background:var(--success-bg); color:var(--success);';
      banner.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">check_circle</span> Ya puedes enviar tu concentrado -- ventana de envío abierta hasta el ${_ventanaCache.fin_envio}.`;
    } else {
      banner.style.cssText += 'background:var(--warning-bg); color:var(--warning);';
      banner.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">schedule</span> Puedes ir prellenando -- el envío se habilita del ${_ventanaCache.inicio_envio} al ${_ventanaCache.fin_envio}.`;
    }
  }

  function render() {
    const activa = datosUnidadActiva();
    const container = document.getElementById('sis06pCaptureGroupsContainer');
    if (!container) return;
    if (!activa) {
      container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Selecciona una unidad (CLUES) específica arriba -- "Jurisdicción (suma)" no aplica a SIS-06-P.</div>';
      return;
    }
    container.innerHTML = '';

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    const currentValores = currentReport ? (currentReport.valores || {}) : {};
    const estadoActual = currentReport ? currentReport.estado : 'BORRADOR';

    const esUnidad = estado.perfil.rol === 'UNIDAD';
    const soloLectura = esUnidad ? (estadoActual !== 'BORRADOR') : (!currentReport || estadoActual === 'BORRADOR');

    // Badges y botones de acción
    const badge = document.getElementById('sis06pBadgeEstado');
    if (badge) {
      badge.className = 'estado-badge estado-' + estadoActual;
      badge.textContent = estadoActual === 'BORRADOR' ? 'Borrador' : estadoActual === 'ENVIADO' ? 'Enviado -- pendiente de validación' : 'Información validada';
    }
    renderBannerVentana(estadoActual);
    renderPanelCambiosPendientes();

    const btnGuardar = document.getElementById('btnGuardarSIS06P');
    const btnEnviar = document.getElementById('btnEnviarSIS06P');
    const btnValidar = document.getElementById('btnMarcarValidado');
    const btnImprimir = document.getElementById('btnImprimirSIS06P');

    if (esUnidad) {
      if (btnGuardar) btnGuardar.style.display = estadoActual === 'BORRADOR' ? 'inline-flex' : 'none';
      if (btnEnviar) {
        btnEnviar.style.display = estadoActual === 'BORRADOR' ? 'inline-flex' : 'none';
        btnEnviar.disabled = !(_ventanaCache && _ventanaCache.dentro_envio);
        btnEnviar.title = btnEnviar.disabled ? 'Fuera de la ventana de envío' : '';
      }
      if (btnValidar) btnValidar.style.display = 'none';
      if (btnImprimir) btnImprimir.style.display = estadoActual === 'VALIDADO' ? 'inline-flex' : 'none';
    } else {
      if (btnGuardar) btnGuardar.style.display = (currentReport && estadoActual !== 'BORRADOR') ? 'inline-flex' : 'none';
      if (btnEnviar) btnEnviar.style.display = 'none';
      if (btnValidar) btnValidar.style.display = (currentReport && estadoActual === 'ENVIADO') ? 'inline-flex' : 'none';
      if (btnImprimir) btnImprimir.style.display = 'none';
      if (!currentReport || estadoActual === 'BORRADOR') {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">Esta unidad todavía no envía su concentrado de este mes -- nada que revisar todavía.</div>';
        return;
      }
    }

    const groups = new Map();
    _sisVariablesCache.forEach((v) => {
      if (!groups.has(v.biologico)) groups.set(v.biologico, []);
      groups.get(v.biologico).push(v);
    });

    groups.forEach((vars, biologico) => {
      const capturadas = vars.filter((v) => {
        const row = currentValores[String(v.fila_excel)];
        return row && Number(row.total || 0) > 0;
      }).length;
      const accent = accentDeBiologico(biologico);

      const card = document.createElement('div');
      card.style.cssText = `background:#fff; border:1px solid var(--outline-variant); border-left:4px solid ${accent.border}; border-radius:16px; overflow:hidden;`;

      const header = document.createElement('button');
      header.type = 'button';
      header.style.cssText = 'width:100%; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; text-align:left; background:transparent; border:none; cursor:pointer; box-shadow:none;';
      header.innerHTML = `
        <span style="display:flex; align-items:center; gap:10px;">
          <span style="width:24px; height:24px; border-radius:8px; background:${accent.bg}; color:${accent.text}; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0;">
            <span class="material-symbols-rounded" style="font-size:15px;">vaccines</span>
          </span>
          <span style="font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:${accent.text};">${biologico}</span>
        </span>
        <span style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:10px; font-weight:800; background:${capturadas > 0 ? accent.bg : '#f1f5f9'}; color:${capturadas > 0 ? accent.text : '#94a3b8'}; border:1px solid ${capturadas > 0 ? accent.border : '#e2e8f0'}; padding:2px 9px; border-radius:20px;">${capturadas}/${vars.length}</span>
          <span class="material-symbols-rounded sis-chevron" style="font-size:18px; color:#94a3b8; transition:transform .2s;">expand_more</span>
        </span>
      `;

      const body = document.createElement('div');
      body.style.display = 'none';
      body.innerHTML = `
        <div style="overflow-x:auto; border-top:1px solid #f1f5f9;">
          <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:1px solid var(--outline-variant);">
                <th style="padding:10px; text-align:left; font-weight:600; color:#475569;">Grupo poblacional / Dosis</th>
                <th style="padding:10px; text-align:center; width:110px; font-weight:800; font-size:11px; color:#334155;">TOTAL</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Afromex.</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Indígena</th>
                <th style="padding:10px; text-align:center; width:88px; font-weight:500; font-size:10px; color:#94a3b8;">Migrante</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;

      const tbody = body.querySelector('tbody');
      vars.forEach((v) => {
        const rowVal = currentValores[String(v.fila_excel)] || {};
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom:1px solid #f1f5f9;';

        const dis = soloLectura ? 'disabled' : '';
        const mkTotal = (val) => `
          <input type="number" min="0" step="1" id="sisb_${v.fila_excel}_total" data-fila="${v.fila_excel}" data-kind="total" ${dis}
            style="width:88px; max-width:100%; text-align:center; font-weight:800; font-size:13px; color:${accent.text};
              background:${soloLectura ? '#f1f5f9' : accent.bgSoft}; border:1.5px solid ${accent.border}; border-radius:9px; padding:6px 8px; outline:none;"
            value="${val !== undefined && val !== null ? val : ''}" placeholder="0">`;
        const mkSub = (kind, val) => `
          <input type="number" min="0" step="1" id="sisb_${v.fila_excel}_${kind}" data-fila="${v.fila_excel}" data-kind="${kind}" ${dis}
            style="width:66px; max-width:100%; text-align:center; font-weight:500; font-size:11px; color:#94a3b8;
              background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:5px 6px; outline:none;"
            value="${val !== undefined && val !== null ? val : ''}" placeholder="0">`;

        const claveBadge = v.clave_general
          ? `<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:700;font-family:monospace;background:#f1f5f9;color:#64748b;padding:1px 6px;border-radius:6px;">${v.clave_general}</span>`
          : `<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:700;text-transform:uppercase;background:#e2e8f0;color:#94a3b8;padding:1px 6px;border-radius:20px;">No se reporta en RDA</span>`;

        row.innerHTML = `
          <td style="padding:10px;">
            <span style="font-size:12px; font-weight:600; color:#334155;">${v.grupo_poblacional || ''}${v.dosis ? ' · ' + v.dosis : ''}</span>
            ${claveBadge}
          </td>
          <td style="padding:10px; text-align:center;">${mkTotal(rowVal.total)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('afro', rowVal.afro)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('indigena', rowVal.indigena)}</td>
          <td style="padding:10px; text-align:center;">${mkSub('migrante', rowVal.migrante)}</td>
        `;
        tbody.appendChild(row);

        if (!soloLectura) {
          const totalInput = row.querySelector(`#sisb_${v.fila_excel}_total`);
          ['afro', 'indigena', 'migrante'].forEach((kind) => {
            const subInput = row.querySelector(`#sisb_${v.fila_excel}_${kind}`);
            const validate = () => {
              const total = parseInt(totalInput.value) || 0;
              const sub = parseInt(subInput.value) || 0;
              if (sub > total) {
                subInput.style.borderColor = '#ef4444'; subInput.style.background = '#fee2e2'; subInput.style.color = '#991b1b';
              } else {
                subInput.style.borderColor = '#e2e8f0'; subInput.style.background = '#f8fafc'; subInput.style.color = '#94a3b8';
              }
            };
            subInput.addEventListener('input', validate);
            totalInput.addEventListener('input', validate);
          });
        }
      });

      header.addEventListener('click', () => {
        const abierto = body.style.display !== 'none';
        body.style.display = abierto ? 'none' : 'block';
        header.querySelector('.sis-chevron').style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
      });

      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  async function save() {
    const activa = datosUnidadActiva();
    if (!activa) { toast('Selecciona una unidad (CLUES) específica.', 'error'); return; }

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const clues = activa.clues;
    const esUnidad = estado.perfil.rol === 'UNIDAD';

    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (esUnidad && currentReport && currentReport.estado !== 'BORRADOR') {
      toast('Este concentrado ya fue enviado -- no puedes editarlo directamente.', 'error');
      return;
    }
    if (!esUnidad && (!currentReport || currentReport.estado === 'BORRADOR')) {
      toast('Esta unidad todavía no envía su concentrado -- nada que corregir.', 'error');
      return;
    }

    let hasSubconteoError = false;
    const valores = {};
    _sisVariablesCache.forEach((v) => {
      const total = parseInt(document.getElementById(`sisb_${v.fila_excel}_total`)?.value) || 0;
      const afro = parseInt(document.getElementById(`sisb_${v.fila_excel}_afro`)?.value) || 0;
      const indigena = parseInt(document.getElementById(`sisb_${v.fila_excel}_indigena`)?.value) || 0;
      const migrante = parseInt(document.getElementById(`sisb_${v.fila_excel}_migrante`)?.value) || 0;
      if (afro > total || indigena > total || migrante > total) hasSubconteoError = true;
      if (total || afro || indigena || migrante) valores[v.fila_excel] = { total, afro, indigena, migrante };
    });

    if (hasSubconteoError) {
      toast('No se puede guardar: hay subconteos (Afromexicano/Indígena/Migrante) que superan el Total de su misma fila.', 'error');
      return;
    }

    mostrarCargando(esUnidad ? 'Guardando concentrado SIS-06-P...' : 'Guardando corrección...');
    try {
      const nombreActor = nombreCompletoDePerfil(estado.perfil) || String(estado.perfil.usuario || '');
      let hist = [];
      if (currentReport && currentReport.historial_ediciones) {
        hist = typeof currentReport.historial_ediciones === 'string' ? JSON.parse(currentReport.historial_ediciones) : currentReport.historial_ediciones;
      }
      hist.push({
        fecha_edicion: new Date().toISOString(),
        editado_por: estado.perfil.rol,
        usuario: nombreActor,
        valores_anteriores: currentReport ? currentReport.valores : null
      });

      const record = {
        clues,
        unidad: activa.unidad,
        municipio: activa.municipio,
        mes, anio, valores,
        capturado_por: currentReport ? currentReport.capturado_por : nombreActor,
        historial_ediciones: hist,
        ultimo_editor_usuario: nombreActor,
        updated_at: new Date().toISOString()
      };

      const { error } = await estado.db.from('sis06p_capturas').upsert(record, { onConflict: 'clues,mes,anio' });
      if (error) throw error;

      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', clues);
      _sis06pCapturasCache = capturas || [];
      render();

      const totalReportado = Object.values(valores).reduce((s, v) => s + Number(v.total || 0), 0);
      toast(`✅ ${esUnidad ? 'Concentrado' : 'Corrección'} guardado · ${totalReportado} dosis en ${Object.keys(valores).length} variables.`, 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error al guardar:', err);
      toast('Error al guardar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  async function enviarParaValidacion() {
    const activa = datosUnidadActiva();
    if (!activa) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport) { toast('Guarda tu concentrado antes de enviarlo.', 'error'); return; }

    mostrarCargando('Enviando concentrado para validación...');
    try {
      const { error } = await estado.db.rpc('sis06p_enviar_para_validacion', {
        p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil)
      });
      if (error) throw error;
      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      _sis06pCapturasCache = capturas || [];
      render();
      toast('✅ Concentrado enviado para validación.', 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error al enviar:', err);
      toast('No se pudo enviar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  async function marcarValidado() {
    const activa = datosUnidadActiva();
    if (!activa) return;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport) return;

    const confirmado = await mostrarModal({
      titulo: 'Marcar como Validado',
      mensaje: `Vas a marcar como validado el concentrado SIS-06-P de ${activa.unidad} (${mesNombre(mes)} ${anio}). La unidad ya no podrá editarlo directamente y verá cualquier corrección que hayas hecho. ¿Confirmas?`,
      textoAceptar: 'Marcar como Validado'
    });
    if (!confirmado) return;

    mostrarCargando('Marcando como validado...');
    try {
      const { error } = await estado.db.rpc('sis06p_marcar_validado', {
        p_captura_id: currentReport.id, p_usuario: nombreCompletoDePerfil(estado.perfil)
      });
      if (error) throw error;
      const { data: capturas } = await estado.db.from('sis06p_capturas').select('*').eq('clues', activa.clues);
      _sis06pCapturasCache = capturas || [];
      render();
      toast('✅ Concentrado marcado como validado.', 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error al validar:', err);
      toast('No se pudo validar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  // ---------------------------------------------------------------------------
  // Imprimir -- solo disponible con estado VALIDADO. Clona el acordeón ya
  // expandido, en modo solo-lectura, dentro de #sis06pVistaImprimible; el
  // CSS @media print (en biovac.html) oculta todo lo demás.
  // ---------------------------------------------------------------------------

  function prepararImpresion() {
    const activa = datosUnidadActiva();
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const currentReport = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!currentReport || currentReport.estado !== 'VALIDADO') return;

    const destino = document.getElementById('sis06pVistaImprimible');
    if (!destino) return;

    const origen = document.getElementById('sis06pCaptureGroupsContainer');
    const clon = origen.cloneNode(true);
    clon.querySelectorAll('div').forEach((d) => { if (d.style && d.style.display === 'none') d.style.display = 'block'; });
    clon.querySelectorAll('input').forEach((i) => {
      const span = document.createElement('span');
      span.textContent = i.value || '0';
      span.style.cssText = 'display:inline-block; padding:4px 8px; font-weight:700;';
      i.replaceWith(span);
    });

    destino.innerHTML = `
      <div style="padding:20px; font-family:sans-serif;">
        <h2 style="margin:0 0 4px;">Concentrado Mensual SIS-06-P</h2>
        <p style="margin:0 0 16px; font-size:13px;">
          ${activa.unidad} (${activa.clues}) -- ${activa.municipio}<br>
          ${mesNombre(mes)} ${anio} -- Validado por ${currentReport.validado_por || ''} el ${currentReport.validado_en ? new Date(currentReport.validado_en).toLocaleDateString('es-MX') : ''}
        </p>
      </div>
    `;
    destino.appendChild(clon);
    window.print();
  }

  // ---------------------------------------------------------------------------
  // Pestaña CSV: mismas filas (CLUES, MUNICIPIO, VARIABLE_SIS, MES, ANIO, VALOR)
  // que ya acepta el panel RDA -- vista previa + descarga, solo de esta CLUES.
  // ---------------------------------------------------------------------------

  // Suma las capturas semanales de Influenza que caen dentro del mes/año
  // calendario pedido y las traduce a filas SIS vía INFLUENZA_SIS_MAPPING.
  // Solo emite filas si hubo al menos una semana capturada ese mes -- si no,
  // no hay nada que decir de Influenza ese periodo.
  function buildInfluenzaCSVRows(clues, municipio, mes, anio) {
    const enMes = _influenzaCapturasCache.filter((c) => {
      if (!c.fecha) return false;
      const d = new Date(c.fecha + 'T12:00:00');
      return (d.getMonth() + 1) === mes && d.getFullYear() === anio;
    });
    if (enMes.length === 0) return [];

    const sumas = {};
    enMes.forEach((c) => {
      Object.entries(c.valores || {}).forEach(([rubro, val]) => {
        sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0);
      });
    });

    return Object.entries(INFLUENZA_SIS_MAPPING).map(([rubro, clave]) => ({
      CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: clave, MES: mes, ANIO: anio, VALOR: sumas[rubro] || 0
    }));
  }

  function buildCSVRowsActuales() {
    const activa = datosUnidadActiva();
    if (!activa) return [];
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const clues = activa.clues;
    const municipio = activa.municipio;
    const captura = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);

    const rows = [];
    if (captura) {
      const valores = captura.valores || {};
      _sisVariablesCache.forEach((v) => {
        const val = valores[String(v.fila_excel)] || {};
        const total = Number(val.total || 0);
        if (v.clave_general) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_general, MES: mes, ANIO: anio, VALOR: total });
        const afro = Number(val.afro || 0);
        if (v.clave_afro && afro > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_afro, MES: mes, ANIO: anio, VALOR: afro });
        const indigena = Number(val.indigena || 0);
        if (v.clave_indigena && indigena > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_indigena, MES: mes, ANIO: anio, VALOR: indigena });
        const migrante = Number(val.migrante || 0);
        if (v.clave_migrante && migrante > 0) rows.push({ CLUES: captura.clues, MUNICIPIO: captura.municipio, VARIABLE_SIS: v.clave_migrante, MES: mes, ANIO: anio, VALOR: migrante });
      });
    }
    return rows.concat(buildInfluenzaCSVRows(clues, municipio, mes, anio));
  }

  function renderCSVPreview() {
    const tbody = document.getElementById('csvUnidadTbody');
    if (!tbody) return;
    const rows = buildCSVRowsActuales();
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">No hay concentrado guardado para este mes/año todavía -- captúralo en la pestaña SIS-06-P y guarda.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 9px; font-family:monospace; font-weight:700; color:var(--primary);">${r.VARIABLE_SIS}</td>
        <td style="padding:8px 9px;">${mesNombre(r.MES)}</td>
        <td style="padding:8px 9px;">${r.ANIO}</td>
        <td style="padding:8px 9px; text-align:center; font-weight:800;">${r.VALOR}</td>
      </tr>
    `).join('');
  }

  function downloadCSV() {
    const rows = buildCSVRowsActuales();
    if (rows.length === 0) { toast('No hay concentrado guardado para este mes/año.', 'error'); return; }
    const headers = ['CLUES', 'MUNICIPIO', 'VARIABLE_SIS', 'MES', 'ANIO', 'VALOR'];
    const csvLines = [headers.join(',')].concat(
      rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    );
    const blob = new Blob(['﻿' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SIS06P_${rows[0].CLUES}_${rows[0].MES}_${rows[0].ANIO}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Exportar a la plantilla oficial (.xlsx) -- confirmado contra
  // SINBA-VER_26_2026.xlsx, hoja "SINBA-SIS-06-P": la columna Y es el TOTAL
  // (dedicada, no hace falta desglosar por edad), V/W/X son Afromexicano/
  // Indígena/Migrante, y `sis_variables.fila_excel` ya es el número de
  // renglón real de esa hoja (se verificó al construir el catálogo en
  // Fase 1). Los encabezados A6/B6/H6/L6/W3/V3 en el original son fórmulas
  // que dependen de un selector en la hoja ÍNDICE -- en vez de arriesgar un
  // desajuste de texto contra ese catálogo, aquí se sobrescriben directo con
  // los valores ya conocidos (mismo criterio que ya usaba el prototipo
  // sinba_dev/main.js con syncMetadataHeaders).
  // ---------------------------------------------------------------------------

  const COL_TOTAL = 25, COL_AFRO = 22, COL_INDIGENA = 23, COL_MIGRANTE = 24;

  async function exportarExcelOficial() {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const captura = _sis06pCapturasCache.find((r) => Number(r.mes) === mes && Number(r.anio) === anio);
    if (!captura) { toast('No hay concentrado guardado para este mes/año.', 'error'); return; }

    mostrarCargando('Generando Excel con la plantilla oficial...');
    try {
      const resp = await fetch('SINBA-VER_26_2026.xlsx');
      if (!resp.ok) throw new Error('No se pudo cargar la plantilla oficial (SINBA-VER_26_2026.xlsx).');
      const buffer = await resp.arrayBuffer();

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('SINBA-SIS-06-P');
      if (!ws) throw new Error('La plantilla no tiene la hoja "SINBA-SIS-06-P".');

      // H6 (localidad, via VLOOKUP contra DATOS!E94:F168) se deja intacta --
      // esa columna es la LOCALIDAD de la unidad (ej. "JURICA PUEBLO"), no el
      // municipio, y no la capturamos en ningún lado -- verificado contra un
      // ejemplo real (LOMAS.xlsx) antes de escribir esto, mejor dejarla en
      // blanco (fórmula sin resolver) que meter un dato equivocado en un
      // reporte oficial.
      ws.getCell('A6').value = captura.unidad || '';
      ws.getCell('B6').value = captura.clues;
      ws.getCell('L6').value = captura.capturado_por || '';
      // W3 = código de mes de 2 dígitos ("08" para agosto, NO el nombre) y
      // V3 = días del mes (NO el año) -- también verificado contra
      // LOMAS.xlsx: W3="08", V3=31 para un reporte de agosto. El año no se
      // captura en esta hoja (vive implícito en el nombre del archivo de la
      // plantilla, ej. SINBA-VER_26_2026.xlsx).
      ws.getCell('W3').value = String(mes).padStart(2, '0');
      ws.getCell('V3').value = new Date(anio, mes, 0).getDate();

      const valores = captura.valores || {};
      _sisVariablesCache.forEach((v) => {
        const val = valores[String(v.fila_excel)];
        if (!val) return;
        const row = Number(v.fila_excel);
        const total = Number(val.total || 0);
        const afro = Number(val.afro || 0);
        const indigena = Number(val.indigena || 0);
        const migrante = Number(val.migrante || 0);
        if (total > 0) ws.getCell(row, COL_TOTAL).value = total;
        if (afro > 0) ws.getCell(row, COL_AFRO).value = afro;
        if (indigena > 0) ws.getCell(row, COL_INDIGENA).value = indigena;
        if (migrante > 0) ws.getCell(row, COL_MIGRANTE).value = migrante;
      });

      const outBuffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SINBA-SIS-06-P_${captura.clues}_${mes}_${anio}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('✅ Excel generado con la plantilla oficial.', 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error al exportar Excel oficial:', err);
      toast('Error al exportar: ' + err.message, 'error');
    } finally {
      ocultarCargando();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnGuardar = document.getElementById('btnGuardarSIS06P');
    if (btnGuardar) btnGuardar.addEventListener('click', save);
    const btnEnviar = document.getElementById('btnEnviarSIS06P');
    if (btnEnviar) btnEnviar.addEventListener('click', enviarParaValidacion);
    const btnValidar = document.getElementById('btnMarcarValidado');
    if (btnValidar) btnValidar.addEventListener('click', marcarValidado);
    const btnImprimir = document.getElementById('btnImprimirSIS06P');
    if (btnImprimir) btnImprimir.addEventListener('click', prepararImpresion);
    const btnAceptarTodos = document.getElementById('btnAceptarTodosCambios');
    if (btnAceptarTodos) btnAceptarTodos.addEventListener('click', aceptarTodosCambios);
    const btnCSV = document.getElementById('btnDescargarCSVUnidad');
    if (btnCSV) btnCSV.addEventListener('click', downloadCSV);
    const btnExcel = document.getElementById('btnExportarExcelOficial');
    if (btnExcel) btnExcel.addEventListener('click', exportarExcelOficial);
  });

  window.SIS06PBiovac = { init, render, save, renderCSVPreview };
})();
