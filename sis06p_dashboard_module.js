/**
 * SIS / SINBA -- Dashboard de seguimiento (Fase 4, pulido Fase 5): quién ya
 * envió su concentrado SIS-06-P del mes y quién falta. Llama
 * sis06p_resumen_seguimiento (RPC, Postgres decide el alcance real por rol,
 * ver supabase/sis06p_estado_engine.sql) -- el RPC siempre regresa el mismo
 * set de columnas (una fila por CLUES real); lo que cambia por rol es cómo
 * se PINTA ese resultado aquí, nunca la consulta:
 *
 *   - ADMIN: tabla plana de todas las unidades (vista original, sin cambios)
 *     con clic deshabilitado (ver irARevisarUnidad).
 *   - MUNICIPAL: la misma tabla plana, ya acotada por el RPC a sus propias
 *     unidades -- clic habilitado, salta a modo revisión (SIS-06-P) de esa
 *     CLUES para poder validar.
 *   - JURISDICCIONAL: NO ve la tabla plana (demasiado detalle operativo que
 *     no le corresponde revisar) -- ve 6 grupos colapsables (4 municipios +
 *     2 hospitales) con el conteo de validadas/por validar/sin enviar de
 *     cada uno. Puramente informativo: sin clic, sin datos capturados --
 *     la validación de cada unidad es responsabilidad de su municipio.
 *
 * Módulo aparte de sis06p_biovac_module.js porque es un dominio de
 * solo-lectura distinto de la captura.
 */
(function () {
  // Este seguimiento es de QUIÉN YA ENVIÓ: prellenar/capturar es trabajo
  // interno de la unidad (y antes de que abra la ventana de envío ni siquiera
  // puede terminarlo), así que "sin iniciar" y "capturando" se muestran como
  // UN solo estatus, "Sin enviar" -- el avance real (dosis del paloteo,
  // lotes del Movimiento, diferencias) va en las columnas de Detalle y
  // Conciliación, no como un estatus aparte que parece "en proceso de envío".
  const ESTADO_LABEL = {
    SIN_INICIAR: 'Sin enviar', BORRADOR: 'Sin enviar', ENVIADO: 'Por validar', VALIDADO: 'Validado'
  };
  const ESTADO_COLOR = {
    SIN_INICIAR: { bg: '#f1f5f9', text: '#94a3b8' },
    BORRADOR: { bg: '#e0f2fe', text: '#0369a1' },
    ENVIADO: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
    VALIDADO: { bg: 'var(--success-bg)', text: 'var(--success)' }
  };

  // Mismo texto (sin acentos) que ya usan biovac_unidades.municipio /
  // requi_distribucion_municipio.municipio -- ver biovac_ui.js
  // (MUNICIPIO_BIOVAC_A_LOTES) y supabase/biovac_agrega_unidades_
  // hospitales.sql. Orden fijo (no alfabético) para que los 6 grupos
  // siempre salgan en el mismo lugar mes con mes.
  const MUNICIPIO_LABEL = {
    QUERETARO: 'Querétaro', CORREGIDORA: 'Corregidora', MARQUES: 'El Marqués', HUIMILPAN: 'Huimilpan',
    NHG: 'Nuevo Hospital General', HENM: 'Hospital del Niño y la Mujer'
  };
  const ORDEN_MUNICIPIOS = ['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM'];
  const ES_HOSPITAL = { NHG: true, HENM: true };

  async function render() {
    const tbody = document.getElementById('seguimientoTbody');
    const contadores = document.getElementById('seguimientoContadores');
    const vistaTabla = document.getElementById('seguimientoVistaTabla');
    const vistaGrupos = document.getElementById('seguimientoVistaGrupos');
    if (!tbody || !contadores) return;

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const rolActual = estado.perfil ? estado.perfil.rol : null;
    const esJurisdiccional = rolActual === 'JURISDICCIONAL';

    const titulo = document.getElementById('seguimientoTitulo');
    const subtitulo = document.getElementById('seguimientoSubtitulo');
    if (titulo && subtitulo) {
      if (esJurisdiccional) {
        titulo.textContent = 'Avance de validación por municipio';
        subtitulo.textContent = 'Vista informativa: quién ya validó, quién tiene envíos pendientes de validar y quién no ha enviado -- cada municipio valida a sus propias unidades.';
      } else {
        titulo.textContent = 'Seguimiento SIS-06-P';
        subtitulo.textContent = 'Quién ya envió su concentrado del mes seleccionado arriba, y quién falta.';
      }
    }

    tbody.innerHTML = '<tr><td colspan="7" style="padding:14px; text-align:center; color:var(--muted);">Cargando…</td></tr>';
    if (vistaGrupos) vistaGrupos.innerHTML = '<div style="padding:14px; text-align:center; color:var(--muted);">Cargando…</div>';

    const { data, error } = await estado.db.rpc('sis06p_resumen_seguimiento', { p_mes: mes, p_anio: anio });
    if (error) {
      const msg = `Error: ${error.message}`;
      tbody.innerHTML = `<tr><td colspan="7" style="padding:14px; text-align:center; color:var(--error);">${msg}</td></tr>`;
      if (vistaGrupos) vistaGrupos.innerHTML = `<div style="padding:14px; text-align:center; color:var(--error);">${msg}</div>`;
      return;
    }

    const filas = data || [];
    window.__sis06pUltimasFilas = filas;
    // MUNICIPAL con el cierre guiado: el seguimiento se pinta como el paso 1
    // (municipal_guiado.js); el resto de este archivo lo sigue usando ADMIN/JURISDICCIONAL.
    if ((rolActual === 'MUNICIPAL' || rolActual === 'JURISDICCIONAL') && window.MunicipalGuiado && window.MunicipalGuiado.activo()) {
      await renderBannerVentana(mes, anio);
      window.MunicipalGuiado.pintarEnvios(filas);
      return;
    }
    const conteos = { SIN_ENVIAR: 0, ENVIADO: 0, VALIDADO: 0 };
    filas.forEach((f) => {
      const key = (f.estado === 'ENVIADO' || f.estado === 'VALIDADO') ? f.estado : 'SIN_ENVIAR';
      conteos[key] += 1;
    });
    const tarjetas = [
      { key: 'SIN_ENVIAR', label: 'Sin enviar', color: ESTADO_COLOR.SIN_INICIAR },
      { key: 'ENVIADO', label: 'Por validar', color: ESTADO_COLOR.ENVIADO },
      { key: 'VALIDADO', label: 'Validado', color: ESTADO_COLOR.VALIDADO }
    ];
    contadores.innerHTML = tarjetas.map((t) => `
      <div style="background:${t.color.bg}; border-radius:14px; padding:14px 16px;">
        <div style="font-size:24px; font-weight:900; color:${t.color.text};">${conteos[t.key] || 0}</div>
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:${t.color.text};">${t.label}</div>
      </div>
    `).join('');
    await renderBannerVentana(mes, anio);

    if (esJurisdiccional) {
      if (vistaTabla) vistaTabla.style.display = 'none';
      if (vistaGrupos) { vistaGrupos.style.display = 'flex'; renderGrupos(vistaGrupos, filas); }
      // Hospitales (HENM, NHG): la jurisdicción hace de "municipal" -- mismo
      // avance de validación, conciliación, concentrado y CSV que un municipio.
      renderExportOficial(filas.filter((f) => ES_HOSPITAL[f.municipio]), mes, anio);
      return;
    }

    if (vistaGrupos) vistaGrupos.style.display = 'none';
    if (vistaTabla) vistaTabla.style.display = 'block';
    renderTabla(tbody, filas);

    if (rolActual === 'MUNICIPAL') renderExportOficial(filas, mes, anio);
    else {
      const cont = document.getElementById('seguimientoExportOficial');
      if (cont) cont.style.display = 'none';
    }
  }

  // Avance real de las dos mitades del SIS de una unidad que todavía no
  // envía: dosis capturadas en el paloteo y lotes en el Movimiento. Evita que
  // una unidad con un Movimiento vacío (creado pero sin un solo lote) parezca
  // "trabajando" igual que una que sí lo tiene capturado.
  function detalleAvance(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    const paloteo = dosis > 0 ? `paloteo ${dosis} dosis` : 'paloteo sin captura';
    const mov = f.movimiento_estado ? (lotes > 0 ? `Movimiento ${lotes} lote(s)` : 'Movimiento sin lotes') : 'Movimiento sin iniciar';
    return `${paloteo} · ${mov}`;
  }

  function celdaConciliacion(f) {
    const dosis = Number(f.paloteo_dosis) || 0;
    const lotes = Number(f.movimiento_lotes) || 0;
    if (dosis === 0 && lotes === 0) return '<span style="color:#cbd5e1;">—</span>';
    const n = Number(f.diferencias) || 0;
    if (n > 0) return `<span style="font-size:10px; font-weight:800; background:var(--warning-bg); color:var(--warning); padding:2px 9px; border-radius:20px; white-space:nowrap;">${n} no coincide(n)</span>`;
    return '<span style="font-size:10px; font-weight:800; background:var(--success-bg); color:var(--success); padding:2px 9px; border-radius:20px;">Coincide</span>';
  }

  // Aviso de la ventana de envío del mes elegido: deja claro POR QUÉ nadie
  // aparece como enviado todavía (o hasta cuándo pueden hacerlo).
  async function renderBannerVentana(mes, anio) {
    const banner = document.getElementById('seguimientoVentana');
    if (!banner) return;
    try {
      const { data, error } = await estado.db.rpc('sis06p_ventana_envio', { p_anio: anio, p_mes: mes });
      if (error || !data || !data[0]) { banner.style.display = 'none'; return; }
      const v = data[0];
      const fecha = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }); };
      banner.style.display = 'block';
      if (v.dentro_envio) {
        banner.style.cssText = 'display:block; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:12px; font-weight:700; background:var(--success-bg); color:var(--success);';
        banner.textContent = `Envío abierto: las unidades pueden enviar su SIS hasta el ${fecha(v.fin_envio)}.`;
      } else {
        const antes = new Date() < new Date(v.inicio_envio + 'T00:00:00');
        banner.style.cssText = 'display:block; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:12px; font-weight:700; background:#f1f5f9; color:#64748b;';
        banner.textContent = antes
          ? `El envío de este mes se habilita del ${fecha(v.inicio_envio)} al ${fecha(v.fin_envio)}. Hasta entonces las unidades solo pueden prellenar -- todas aparecen como "Sin enviar".`
          : `La ventana de envío de este mes ya cerró (${fecha(v.inicio_envio)} al ${fecha(v.fin_envio)}).`;
      }
    } catch (err) {
      banner.style.display = 'none';
    }
  }

  // Vista ADMIN/MUNICIPAL -- tabla plana, sin cambios de fondo respecto a la
  // versión original (Fase 4): una fila por CLUES, clic salta a modo
  // revisión (solo MUNICIPAL, ver irARevisarUnidad).
  function renderTabla(tbody, filas) {
    if (filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">No hay unidades en tu alcance.</td></tr>';
      return;
    }

    tbody.innerHTML = filas.map((f) => {
      const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.SIN_INICIAR;
      let detalle = '';
      if (f.estado === 'VALIDADO') detalle = `Validado por ${f.validado_por || '—'}, ${f.validado_en ? new Date(f.validado_en).toLocaleDateString('es-MX') : ''}`;
      else if (f.estado === 'ENVIADO') detalle = `Enviado por ${f.enviado_por || '—'}, ${f.enviado_en ? new Date(f.enviado_en).toLocaleDateString('es-MX') : ''}`;
      else detalle = detalleAvance(f);

      return `
        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" data-clues="${f.clues}">
          <td style="padding:9px;">${f.municipio || ''}</td>
          <td style="padding:9px; font-family:monospace;">${f.clues}</td>
          <td style="padding:9px;">${f.unidad || ''}</td>
          <td style="padding:9px; text-align:center;">
            <span style="font-size:10px; font-weight:800; background:${color.bg}; color:${color.text}; padding:2px 10px; border-radius:20px;">${ESTADO_LABEL[f.estado] || f.estado}</span>
          </td>
          <td style="padding:9px; font-size:11.5px; color:var(--muted);">${detalle}</td>
          <td style="padding:9px; text-align:center;">${celdaConciliacion(f)}</td>
          <td style="padding:9px; text-align:center;">
            ${f.correcciones_pendientes > 0 ? `<span style="font-size:10px; font-weight:800; background:var(--warning-bg); color:var(--warning); padding:2px 8px; border-radius:20px;">${f.correcciones_pendientes}</span>` : '—'}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-clues]').forEach((tr) => {
      tr.addEventListener('click', () => irARevisarUnidad(tr.getAttribute('data-clues')));
    });
  }

  // Vista JURISDICCIONAL -- 6 tarjetas colapsables (mismo lenguaje visual
  // "sis-card" ya usado en el paloteo SIS-06-P, plano y sin clic: acá no hay
  // nada que editar, solo el estatus de cada unidad dentro del grupo).
  function renderGrupos(contenedor, filas) {
    const porMunicipio = new Map();
    filas.forEach((f) => {
      const key = f.municipio || '—';
      if (!porMunicipio.has(key)) porMunicipio.set(key, []);
      porMunicipio.get(key).push(f);
    });

    const grupos = ORDEN_MUNICIPIOS.filter((m) => porMunicipio.has(m))
      .concat([...porMunicipio.keys()].filter((m) => !ORDEN_MUNICIPIOS.includes(m)));

    if (grupos.length === 0) {
      contenedor.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-style:italic;">No hay unidades que mostrar.</div>';
      return;
    }

    contenedor.innerHTML = '';
    grupos.forEach((municipio) => {
      const unidadesGrupo = porMunicipio.get(municipio) || [];
      const nValidado = unidadesGrupo.filter((f) => f.estado === 'VALIDADO').length;
      const nEnviado = unidadesGrupo.filter((f) => f.estado === 'ENVIADO').length;
      const nSinEnviar = unidadesGrupo.length - nValidado - nEnviado;
      const completo = unidadesGrupo.length > 0 && nValidado === unidadesGrupo.length;

      const card = document.createElement('div');
      card.className = 'sis-card';
      card.style.cssText = 'border:1px solid var(--outline-variant);';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'sis-card-header';
      header.innerHTML = `
        <div class="sis-card-row">
          <span style="display:flex; align-items:center; gap:12px; min-width:0;">
            <span class="sis-icon-chip" style="background:${completo ? 'var(--success-bg)' : '#f1f5f9'};">
              <span class="material-symbols-rounded" style="color:${completo ? 'var(--success)' : '#64748b'};">${ES_HOSPITAL[municipio] ? 'local_hospital' : 'location_city'}</span>
            </span>
            <span class="sis-card-title">${MUNICIPIO_LABEL[municipio] || municipio}</span>
          </span>
          <span style="display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">
            <span style="font-size:10px; font-weight:800; background:var(--success-bg); color:var(--success); padding:2px 9px; border-radius:20px; white-space:nowrap;">${nValidado} validada(s)</span>
            <span style="font-size:10px; font-weight:800; background:var(--warning-bg); color:var(--warning); padding:2px 9px; border-radius:20px; white-space:nowrap;">${nEnviado} por validar</span>
            <span style="font-size:10px; font-weight:800; background:#f1f5f9; color:#94a3b8; padding:2px 9px; border-radius:20px; white-space:nowrap;">${nSinEnviar} sin enviar</span>
            <span class="material-symbols-rounded sis-chevron" style="font-size:18px; color:#94a3b8; transition:transform .32s cubic-bezier(.4,0,.2,1);">expand_more</span>
          </span>
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'sis-card-body';
      body.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tbody>
            ${unidadesGrupo.map((f) => {
              const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.SIN_INICIAR;
              return `
                <tr style="border-bottom:1px solid #f1f5f9;${ES_HOSPITAL[municipio] ? ' cursor:pointer;' : ''}" ${ES_HOSPITAL[municipio] ? `data-hospital-clues="${f.clues}"` : ''}>
                  <td style="padding:8px 12px; font-family:monospace; color:#64748b; width:110px;">${f.clues}</td>
                  <td style="padding:8px 12px; color:#334155;">${f.unidad || ''}</td>
                  <td style="padding:8px 12px; text-align:right; width:120px;">
                    <span style="font-size:10px; font-weight:800; background:${color.bg}; color:${color.text}; padding:2px 10px; border-radius:20px;">${ESTADO_LABEL[f.estado] || f.estado}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Mismo mecanismo de despliegue animado (max-height) que ya usa el
      // acordeón de biológicos en sis06p_biovac_module.js -- ver ese
      // archivo para el porqué de fijar a un número antes de ir a "none"/"0".
      header.addEventListener('click', () => {
        const abriendo = !body.classList.contains('abierto');
        header.querySelector('.sis-chevron').style.transform = abriendo ? 'rotate(180deg)' : 'rotate(0deg)';
        if (abriendo) {
          body.classList.add('abierto');
          body.style.maxHeight = body.scrollHeight + 'px';
          body.addEventListener('transitionend', function alTerminar(ev) {
            if (ev.propertyName !== 'max-height') return;
            body.removeEventListener('transitionend', alTerminar);
            if (body.classList.contains('abierto')) body.style.maxHeight = 'none';
          });
        } else {
          body.style.maxHeight = body.scrollHeight + 'px';
          void body.offsetHeight;
          body.classList.remove('abierto');
          body.style.maxHeight = '0px';
        }
      });

      body.querySelectorAll('tr[data-hospital-clues]').forEach((tr) => {
        tr.addEventListener('click', () => irARevisarUnidad(tr.getAttribute('data-hospital-clues')));
      });

      card.appendChild(header);
      card.appendChild(body);
      contenedor.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Export oficial por municipio -- CSV en el mismo orden de columnas y el
  // mismo criterio de ordenamiento (por CLUES ascendente) que ya usa hoy el
  // proceso manual: la unidad llena su Excel, el municipio concentra todas
  // sus unidades en una plantilla como "SIS QUERETARO AGOSTO 2026.xlsx" (hoja
  // "CSV": columnas CLUES, VARIABLE, VALOR, MES, AÑO, MUNICIPIO) y esa hoja
  // es lo que hoy se sube a mano al departamento de estadística. Aquí se
  // genera ese mismo CSV directo desde las capturas SIS-06-P ya validadas,
  // UN archivo por municipio (nunca por unidad -- cada municipio manda su
  // propio concentrado, igual que hoy sus 4 archivos .xlsx por separado).
  //
  // OJO: esto es un formato DISTINTO al que ya genera sis_export_module.js
  // (CLUES,MUNICIPIO,VARIABLE_SIS,MES,ANIO,VALOR) -- ese otro es para volver
  // a subir el concentrado al propio panel RDA de SIREVAQ (rda_parser.js
  // espera ese orden/nombres de columna exacto). Este es para el archivo que
  // sale de SIREVAQ hacia afuera, con el orden/nombre de columna real que ya
  // usa el departamento de estadística -- no deben unificarse aunque el
  // contenido de cada fila sea el mismo dato.
  // ---------------------------------------------------------------------------

  // Un bloque por municipio a cargo del MUNICIPAL en sesión (normalmente uno
  // solo, pero un perfil puede tener más de uno en municipios_allowed):
  // botón de descarga (habilitado solo cuando TODAS las unidades de ese
  // municipio en `filas` -- ya acotadas por el RPC al mes/año elegidos
  // arriba -- quedaron Validado) + la tabla comparativa Paloteo vs Aplicado
  // (ver cargarComparativoAplicado), que no depende de la validación: sirve
  // precisamente para revisar ANTES de que todo quede validado.
  function renderExportOficial(filas, mes, anio) {
    const cont = document.getElementById('seguimientoExportOficial');
    if (!cont) return;

    const porMunicipio = new Map();
    filas.forEach((f) => {
      const key = f.municipio || '—';
      if (!porMunicipio.has(key)) porMunicipio.set(key, []);
      porMunicipio.get(key).push(f);
    });

    if (porMunicipio.size === 0) { cont.style.display = 'none'; return; }

    cont.style.display = 'flex';
    cont.innerHTML = '';
    [...porMunicipio.entries()].forEach(([municipio, unidadesGrupo]) => {
      const nValidado = unidadesGrupo.filter((f) => f.estado === 'VALIDADO').length;
      const completo = unidadesGrupo.length > 0 && nValidado === unidadesGrupo.length;
      const etiqueta = MUNICIPIO_LABEL[municipio] || municipio;

      const tarjeta = document.createElement('div');
      tarjeta.style.cssText = 'border-radius:14px; background:' + (completo ? 'var(--success-bg)' : '#f8fafc') + '; border:1px solid ' + (completo ? 'var(--success)' : 'var(--outline-variant)') + '; overflow:hidden;';

      const barra = document.createElement('div');
      barra.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 16px;';
      barra.innerHTML = `
        <span style="font-size:12.5px; font-weight:700; color:${completo ? 'var(--success)' : 'var(--muted)'};">
          ${completo ? '✅' : '⏳'} ${etiqueta}: ${nValidado}/${unidadesGrupo.length} unidad(es) validada(s)${completo ? '' : ' -- faltan por validar para poder exportar'}
        </span>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = completo ? 'btn-primario btn-mini' : 'btn-fantasma btn-mini';
      btn.disabled = !completo;
      if (!completo) btn.style.opacity = '0.5';
      btn.innerHTML = '<span class="material-symbols-rounded">download</span> Descargar CSV oficial';
      btn.addEventListener('click', () => exportarCSVOficialMunicipio(municipio, mes, anio));
      const btnPub = document.createElement('button');
      btnPub.type = 'button';
      btnPub.className = completo ? 'btn-primario btn-mini' : 'btn-fantasma btn-mini';
      btnPub.disabled = !completo;
      if (!completo) btnPub.style.opacity = '0.5';
      btnPub.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Publicar a indicadores';
      const estadoPub = document.createElement('div');
      estadoPub.style.cssText = 'flex-basis:100%; font-size:11.5px; font-weight:600; color:var(--muted);';
      btnPub.addEventListener('click', async () => {
        btnPub.disabled = true;
        const hecho = await publicarMunicipio(municipio, mes, anio, etiqueta);
        btnPub.disabled = false;
        if (hecho) pintarEstadoPublicacion(estadoPub, municipio, mes, anio);
      });
      const acciones = document.createElement('div');
      acciones.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';
      acciones.appendChild(btn);
      acciones.appendChild(btnPub);
      barra.appendChild(acciones);
      barra.appendChild(estadoPub);
      if (completo) pintarEstadoPublicacion(estadoPub, municipio, mes, anio);
      tarjeta.appendChild(barra);

      const comparativoCont = document.createElement('div');
      comparativoCont.style.cssText = 'padding:0 16px 14px;';
      comparativoCont.innerHTML = '<div style="font-size:11.5px; color:var(--muted); padding:6px 0;">Cargando conciliación paloteo vs. aplicado…</div>';
      tarjeta.appendChild(comparativoCont);
      cont.appendChild(tarjeta);

      renderComparativoAplicado(comparativoCont, municipio, mes, anio);

      // Concentrado municipal (paloteo por unidad + seguimiento de biológico +
      // recibido vs requisición): se arma solo desde lo que capturan las
      // unidades -- ver sis06p_concentrado_municipal_module.js.
      if (window.SIS06PConcentradoMunicipal) {
        const concentradoCont = document.createElement('div');
        concentradoCont.style.cssText = 'padding:0 16px 14px;';
        tarjeta.appendChild(concentradoCont);
        window.SIS06PConcentradoMunicipal.render(concentradoCont, municipio, mes, anio);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Conciliación Paloteo (SIS-06-P) vs. Aplicado (Movimiento de Biológico),
  // POR UNIDAD -- el mismo RPC (sis06p_comparativo) con el que el servidor
  // bloquea el envío de la unidad y la validación del municipal. Antes se
  // sumaba todo el municipio en una sola tabla (un faltante de una unidad
  // podía taparse con un sobrante de otra) y el cruce de biológicos usaba un
  // mapeo escrito a mano que no coincidía con sis_variables -- ver
  // supabase/sis06p_reconciliacion.sql.
  //
  // Solo se listan las unidades CON diferencia: es lo único que el municipal
  // tiene que atender antes de poder validar y exportar.
  // ---------------------------------------------------------------------------

  async function renderComparativoAplicado(cont, municipio, mes, anio) {
    try {
      const { data, error } = await estado.db.rpc('sis06p_comparativo', { p_mes: mes, p_anio: anio });
      if (error) throw error;
      const filas = (data || []).filter((f) => f.municipio === municipio);
      const porUnidad = new Map();
      filas.forEach((f) => {
        if (!porUnidad.has(f.clues)) porUnidad.set(f.clues, { unidad: f.unidad, filas: [] });
        porUnidad.get(f.clues).filas.push(f);
      });
      const conDiferencia = [...porUnidad.entries()].filter(([, u]) => u.filas.some((f) => !f.coincide));

      if (porUnidad.size === 0) {
        cont.innerHTML = '<div style="font-size:11.5px; color:var(--muted); font-style:italic; padding:6px 0;">Ninguna unidad tiene paloteo ni movimiento capturado todavía para conciliar.</div>';
        return;
      }
      if (conDiferencia.length === 0) {
        cont.innerHTML = `<div style="font-size:11.5px; font-weight:700; color:var(--success); padding:6px 0;">✅ Conciliación paloteo vs. movimiento: las ${porUnidad.size} unidad(es) con captura coinciden en todos sus biológicos.</div>`;
        return;
      }
      cont.innerHTML = `
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); margin:4px 0 8px;">
          Conciliación paloteo (SIS-06-P) vs. aplicado (Movimiento de Biológico) -- ${conDiferencia.length} unidad(es) con diferencia
        </div>
        ${conDiferencia.map(([clues, u]) => {
          const dif = u.filas.filter((f) => !f.coincide);
          return `
          <div style="margin-bottom:10px; border:1px solid var(--warning-border); border-radius:12px; overflow:hidden; background:#fff;">
            <div style="padding:8px 12px; background:var(--warning-bg); color:var(--warning); font-size:12px; font-weight:800; display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <span>${u.unidad || ''} <span style="font-family:monospace; font-weight:600;">${clues}</span></span>
              <span>${dif.length} biológico(s) no coinciden</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead><tr style="border-bottom:1px solid var(--outline-variant);">
                <th style="text-align:left; padding:6px 8px; font-size:10px; text-transform:uppercase; color:var(--muted);">Biológico</th>
                <th style="text-align:center; padding:6px 8px; font-size:10px; text-transform:uppercase; color:var(--muted);">Paloteo</th>
                <th style="text-align:center; padding:6px 8px; font-size:10px; text-transform:uppercase; color:var(--muted);">Aplicado</th>
              </tr></thead>
              <tbody>
                ${dif.map((f) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:6px 8px;">${f.etiqueta}</td>
                    <td style="padding:6px 8px; text-align:center; font-weight:700;">${Number(f.paloteo)}</td>
                    <td style="padding:6px 8px; text-align:center; font-weight:700;">${Number(f.aplicado)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
            </div>
          </div>`;
        }).join('')}
      `;
    } catch (err) {
      console.error('[SIS-06-P] Error cargando la conciliación paloteo vs aplicado:', err);
      cont.innerHTML = `<div style="font-size:11.5px; color:var(--error);">Error al cargar la conciliación: ${err.message || err}</div>`;
    }
  }

  // Filas oficiales del municipio, armadas en el SERVIDOR con las mismas reglas con que se publica a
  // registros_sis (sis_filas_csv): solo CLUES validadas, las 4 claves de cada variable aun en 0 y Influenza
  // del mes. Falla (con el motivo) si falta validar alguna unidad: nunca sale un CSV a medias.
  async function exportarCSVOficialMunicipio(municipio, mes, anio) {
    try {
      const { data, error } = await estado.db.rpc('sis_filas_csv', { p_mes: mes, p_anio: anio, p_municipio: municipio });
      if (error) throw error;
      const rows = (data || []).map((f) => ({ CLUES: f.clues, VARIABLE: f.variable_sis, VALOR: f.valor, MES: mes, 'AÑO': anio, MUNICIPIO: f.municipio || municipio }));
      if (rows.length === 0) {
        toast('No hay concentrados validados para ese mes/año en este municipio.', 'error');
        return;
      }

      const headers = ['CLUES', 'VARIABLE', 'VALOR', 'MES', 'AÑO', 'MUNICIPIO'];
      const csvLines = [headers.join(',')].concat(
        rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
      );
      const blob = new Blob(['﻿' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SIS_${municipio}_${mes}_${anio}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast(`CSV oficial generado: ${new Set(rows.map((r) => r.CLUES)).size} CLUES, ${rows.length} filas.`, 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error exportando CSV oficial del municipio:', err);
      toast(err.message || 'Error al exportar el CSV oficial.', 'error');
    }
  }

  // Carga el concentrado validado del municipio a registros_sis (la tabla que alimenta los indicadores).
  // Es idempotente: reemplaza SOLO las mismas llaves (CLUES x clave) de ese mes -- nunca duplica ni toca
  // otros municipios, otras claves ni meses anteriores. Hay que repetirla si después se corrige algo.
  async function publicarMunicipio(municipio, mes, anio, etiqueta) {
    const ok = await mostrarModal({
      titulo: 'Publicar a indicadores',
      mensaje: `Se cargará el SIS validado de ${etiqueta} (${String(mes).padStart(2, '0')}/${anio}) a la tabla que alimenta los indicadores. Si ya se había publicado, se reemplaza SOLO lo de este municipio y este mes; no se toca nada más.`,
      textoAceptar: 'Publicar'
    });
    if (!ok) return false;
    try {
      const usuario = (estado.perfil ? nombreCompletoDePerfil(estado.perfil) : null);
      const { data, error } = await estado.db.rpc('sis_publicar_registros_sis', { p_mes: mes, p_anio: anio, p_municipio: municipio, p_usuario: usuario });
      if (error) throw error;
      const omitidas = (data && data.clues_omitidas) || [];
      toast(`✅ Publicado: ${data.insertadas} filas de ${(data.clues_publicadas || []).length} unidad(es)${data.reemplazadas ? ` (reemplazó ${data.reemplazadas} previas)` : ''}.${omitidas.length ? ' Sin catálogo SIS, omitidas: ' + omitidas.join(', ') + '.' : ''}`, 'ok');
      return true;
    } catch (err) {
      console.error('[SIS-06-P] Error publicando a registros_sis:', err);
      toast(err.message || 'Error al publicar.', 'error');
      return false;
    }
  }

  async function pintarEstadoPublicacion(cont, municipio, mes, anio) {
    try {
      const { data } = await estado.db.rpc('sis_estado_publicacion', { p_mes: mes, p_anio: anio, p_municipio: municipio });
      const p = Array.isArray(data) ? data[0] : null;
      if (!p) { cont.textContent = 'Aún no publicado a indicadores.'; cont.style.color = 'var(--muted)'; return; }
      const cuando = new Date(p.publicado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      if (p.desactualizada) {
        cont.textContent = `⚠ Publicado el ${cuando}${p.publicado_por ? ' por ' + p.publicado_por : ''}, pero hubo cambios después: vuelve a publicar.`;
        cont.style.color = 'var(--warning)';
      } else {
        cont.textContent = `Publicado el ${cuando}${p.publicado_por ? ' por ' + p.publicado_por : ''} (${p.filas} filas).`;
        cont.style.color = 'var(--success)';
      }
    } catch (e) { cont.textContent = ''; }
  }

  // Saltar directo a modo revisión de una unidad desde la fila del
  // dashboard -- usa #selUnidadRevision (CLUES), no #selUnidad (ese es el
  // municipio/hospital de Movimiento, vista aparte). Solo MUNICIPAL baja a
  // nivel unidad: JURISDICCIONAL/ADMIN no llegan a esta función desde la
  // vista de grupos (sin clic) y, si llegaran desde la tabla plana (ADMIN),
  // siguen sin poder entrar al detalle de una unidad.
  function irARevisarUnidad(clues) {
    const rol = estado.perfil ? estado.perfil.rol : null;
    if ((rol === 'MUNICIPAL' || rol === 'JURISDICCIONAL') && window.MunicipalGuiado && window.MunicipalGuiado.activo()) { window.MunicipalGuiado.revisar(clues); return; }
    const fila = (window.__sis06pUltimasFilas || []).find((f) => f.clues === clues);
    // JURISDICCIONAL es el "municipal" de los hospitales (HENM, NHG): solo
    // esas CLUES bajan a detalle/validación; el resto es responsabilidad de
    // su municipio.
    const puede = rol === 'MUNICIPAL' || (rol === 'JURISDICCIONAL' && fila && ES_HOSPITAL[fila.municipio]);
    if (!puede) {
      toast('Solo el municipal (o la jurisdicción, en hospitales) puede ver el detalle de una unidad -- aquí solo se ve el estatus general.', 'error');
      return;
    }
    const selUnidadRevision = document.getElementById('selUnidadRevision');
    const opt = Array.from(selUnidadRevision.options).find((o) => {
      const u = (estado.unidadesClues || estado.unidades || []).find((x) => x.id === o.value);
      return u && u.clues === clues;
    });
    if (!opt) { toast('No se encontró esa unidad en tu alcance.', 'error'); return; }
    selUnidadRevision.value = opt.value;
    document.getElementById('btnSeccionSIS06P').click();
    selUnidadRevision.dispatchEvent(new Event('change'));
  }

  // Solo trae las filas del seguimiento (sin pintar nada): las usa el cierre guiado
  // del municipal para su ruta, sus puntos de avance y la navegación entre unidades.
  async function cargarFilas(mes, anio) {
    const { data, error } = await estado.db.rpc('sis06p_resumen_seguimiento', { p_mes: mes, p_anio: anio });
    if (error) { toast('No se pudo cargar el seguimiento: ' + error.message, 'error'); return null; }
    window.__sis06pUltimasFilas = data || [];
    return data || [];
  }

  window.SIS06PDashboard = { render, cargarFilas, renderBannerVentana, renderComparativoAplicado, exportarCSVOficialMunicipio, MUNICIPIO_LABEL };
})();
