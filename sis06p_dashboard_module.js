/**
 * SIS / SINBA -- Dashboard de seguimiento (Fase 4): quién ya envió su
 * concentrado SIS-06-P del mes y quién falta, para roles MUNICIPAL/
 * JURISDICCIONAL/ADMIN. Solo lectura -- llama sis06p_resumen_seguimiento
 * (RPC, Postgres decide el alcance real por rol, ver supabase/
 * sis06p_estado_engine.sql). Módulo aparte de sis06p_biovac_module.js
 * porque es un dominio de solo-lectura distinto de la captura.
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

  async function render() {
    const tbody = document.getElementById('seguimientoTbody');
    const contadores = document.getElementById('seguimientoContadores');
    if (!tbody || !contadores) return;

    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);

    tbody.innerHTML = '<tr><td colspan="6" style="padding:14px; text-align:center; color:var(--muted);">Cargando…</td></tr>';

    const { data, error } = await estado.db.rpc('sis06p_resumen_seguimiento', { p_mes: mes, p_anio: anio });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:14px; text-align:center; color:var(--error);">Error: ${error.message}</td></tr>`;
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

  // Saltar directo a modo revisión de una unidad desde la fila del
  // dashboard -- usa #selUnidadRevision (CLUES), no #selUnidad (ese es el
  // municipio/hospital de Movimiento, vista aparte). Solo MUNICIPAL baja a
  // nivel unidad: JURISDICCIONAL/ADMIN ven este mismo Seguimiento (estatus,
  // sin datos capturados) pero no pueden entrar al detalle de una unidad.
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
