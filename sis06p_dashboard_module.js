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
  const ESTADO_LABEL = {
    SIN_INICIAR: 'Sin iniciar', BORRADOR: 'Capturando', ENVIADO: 'Enviado', VALIDADO: 'Validado'
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

    tbody.innerHTML = '<tr><td colspan="6" style="padding:14px; text-align:center; color:var(--muted);">Cargando…</td></tr>';
    if (vistaGrupos) vistaGrupos.innerHTML = '<div style="padding:14px; text-align:center; color:var(--muted);">Cargando…</div>';

    const { data, error } = await estado.db.rpc('sis06p_resumen_seguimiento', { p_mes: mes, p_anio: anio });
    if (error) {
      const msg = `Error: ${error.message}`;
      tbody.innerHTML = `<tr><td colspan="6" style="padding:14px; text-align:center; color:var(--error);">${msg}</td></tr>`;
      if (vistaGrupos) vistaGrupos.innerHTML = `<div style="padding:14px; text-align:center; color:var(--error);">${msg}</div>`;
      return;
    }

    const filas = data || [];
    const conteos = { SIN_INICIAR: 0, BORRADOR: 0, ENVIADO: 0, VALIDADO: 0 };
    filas.forEach((f) => { conteos[f.estado] = (conteos[f.estado] || 0) + 1; });

    contadores.innerHTML = Object.keys(ESTADO_LABEL).map((key) => `
      <div style="background:${ESTADO_COLOR[key].bg}; border-radius:14px; padding:14px 16px;">
        <div style="font-size:24px; font-weight:900; color:${ESTADO_COLOR[key].text};">${conteos[key] || 0}</div>
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:${ESTADO_COLOR[key].text};">${ESTADO_LABEL[key]}</div>
      </div>
    `).join('');

    if (esJurisdiccional) {
      if (vistaTabla) vistaTabla.style.display = 'none';
      if (vistaGrupos) { vistaGrupos.style.display = 'flex'; renderGrupos(vistaGrupos, filas); }
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

  // Vista ADMIN/MUNICIPAL -- tabla plana, sin cambios de fondo respecto a la
  // versión original (Fase 4): una fila por CLUES, clic salta a modo
  // revisión (solo MUNICIPAL, ver irARevisarUnidad).
  function renderTabla(tbody, filas) {
    if (filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:14px; text-align:center; color:var(--muted); font-style:italic;">No hay unidades en tu alcance.</td></tr>';
      return;
    }

    tbody.innerHTML = filas.map((f) => {
      const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.SIN_INICIAR;
      let detalle = '';
      if (f.estado === 'VALIDADO') detalle = `Validado por ${f.validado_por || '—'}, ${f.validado_en ? new Date(f.validado_en).toLocaleDateString('es-MX') : ''}`;
      else if (f.estado === 'ENVIADO') detalle = `Enviado por ${f.enviado_por || '—'}, ${f.enviado_en ? new Date(f.enviado_en).toLocaleDateString('es-MX') : ''}`;
      else if (f.estado === 'BORRADOR') detalle = `Capturado por ${f.capturado_por || '—'}`;
      else detalle = '—';

      return `
        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" data-clues="${f.clues}">
          <td style="padding:9px;">${f.municipio || ''}</td>
          <td style="padding:9px; font-family:monospace;">${f.clues}</td>
          <td style="padding:9px;">${f.unidad || ''}</td>
          <td style="padding:9px; text-align:center;">
            <span style="font-size:10px; font-weight:800; background:${color.bg}; color:${color.text}; padding:2px 10px; border-radius:20px;">${ESTADO_LABEL[f.estado] || f.estado}</span>
          </td>
          <td style="padding:9px; font-size:11.5px; color:var(--muted);">${detalle}</td>
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
                <tr style="border-bottom:1px solid #f1f5f9;">
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

  // Un botón por municipio a cargo del MUNICIPAL en sesión (normalmente uno
  // solo, pero un perfil puede tener más de uno en municipios_allowed) --
  // habilitado solo cuando TODAS las unidades de ese municipio en `filas`
  // (ya acotadas por el RPC al mes/año elegidos arriba) quedaron Validado.
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

      const barra = document.createElement('div');
      barra.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 16px; border-radius:14px; background:' + (completo ? 'var(--success-bg)' : '#f8fafc') + '; border:1px solid ' + (completo ? 'var(--success)' : 'var(--outline-variant)') + ';';
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
      barra.appendChild(btn);
      cont.appendChild(barra);
    });
  }

  async function exportarCSVOficialMunicipio(municipio, mes, anio) {
    try {
      const [{ data: variables, error: eVars }, { data: capturas, error: eCap }] = await Promise.all([
        estado.db.from('sis_variables').select('*').eq('activo', true).order('orden'),
        estado.db.from('sis06p_capturas').select('clues, valores').eq('municipio', municipio).eq('mes', mes).eq('anio', anio)
      ]);
      if (eVars) throw eVars;
      if (eCap) throw eCap;

      if (!capturas || capturas.length === 0) {
        toast('No hay concentrados capturados para ese mes/año en este municipio.', 'error');
        return;
      }

      const cluesList = capturas.map((c) => c.clues);
      const { data: capturasInfluenza, error: eInf } = await estado.db.from('influenza_capturas')
        .select('clues, fecha, valores').in('clues', cluesList);
      if (eInf) console.error('[SIS-06-P] Error cargando influenza para export oficial:', eInf);

      const mapping = (window.SIS06PBiovac && window.SIS06PBiovac.INFLUENZA_SIS_MAPPING) || {};

      const rows = [];
      capturas.forEach((c) => {
        const valores = c.valores || {};
        (variables || []).forEach((v) => {
          const val = valores[String(v.fila_excel)] || {};
          const total = Number(val.total || 0);
          if (v.clave_general) rows.push({ CLUES: c.clues, VARIABLE: v.clave_general, VALOR: total, MES: mes, AÑO: anio, MUNICIPIO: municipio });
          const afro = Number(val.afro || 0);
          if (v.clave_afro && afro > 0) rows.push({ CLUES: c.clues, VARIABLE: v.clave_afro, VALOR: afro, MES: mes, AÑO: anio, MUNICIPIO: municipio });
          const indigena = Number(val.indigena || 0);
          if (v.clave_indigena && indigena > 0) rows.push({ CLUES: c.clues, VARIABLE: v.clave_indigena, VALOR: indigena, MES: mes, AÑO: anio, MUNICIPIO: municipio });
          const migrante = Number(val.migrante || 0);
          if (v.clave_migrante && migrante > 0) rows.push({ CLUES: c.clues, VARIABLE: v.clave_migrante, VALOR: migrante, MES: mes, AÑO: anio, MUNICIPIO: municipio });
        });

        const infEnMes = (capturasInfluenza || []).filter((ci) => {
          if (ci.clues !== c.clues || !ci.fecha) return false;
          const d = new Date(ci.fecha + 'T12:00:00');
          return (d.getMonth() + 1) === Number(mes) && d.getFullYear() === Number(anio);
        });
        if (infEnMes.length > 0) {
          const sumas = {};
          infEnMes.forEach((ci) => {
            Object.entries(ci.valores || {}).forEach(([rubro, val]) => { sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0); });
          });
          Object.entries(mapping).forEach(([rubro, clave]) => {
            rows.push({ CLUES: c.clues, VARIABLE: clave, VALOR: sumas[rubro] || 0, MES: mes, AÑO: anio, MUNICIPIO: municipio });
          });
        }
      });

      // Ordenado por número de CLUES ascendente -- Array.sort de JS es
      // estable, así que dentro de cada CLUES las filas conservan el orden
      // del catálogo (orden) en el que se construyeron arriba.
      rows.sort((a, b) => String(a.CLUES).localeCompare(String(b.CLUES)));

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

      toast(`CSV oficial generado: ${cluesList.length} CLUES, ${rows.length} filas.`, 'ok');
    } catch (err) {
      console.error('[SIS-06-P] Error exportando CSV oficial del municipio:', err);
      toast(err.message || 'Error al exportar el CSV oficial.', 'error');
    }
  }

  // Saltar directo a modo revisión de una unidad desde la fila del
  // dashboard -- usa #selUnidadRevision (CLUES), no #selUnidad (ese es el
  // municipio/hospital de Movimiento, vista aparte). Solo MUNICIPAL baja a
  // nivel unidad: JURISDICCIONAL/ADMIN no llegan a esta función desde la
  // vista de grupos (sin clic) y, si llegaran desde la tabla plana (ADMIN),
  // siguen sin poder entrar al detalle de una unidad.
  function irARevisarUnidad(clues) {
    if (!estado.perfil || estado.perfil.rol !== 'MUNICIPAL') {
      toast('Solo municipal puede ver el detalle de una unidad -- aquí solo se ve el estatus general.', 'error');
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

  window.SIS06PDashboard = { render };
})();
