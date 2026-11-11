/**
 * CSV JURISDICCIONAL (SINBA-SIS): un solo archivo con TODAS las unidades de los 4 municipios y los 2 hospitales.
 *
 * Es el mismo CSV oficial que baja cada municipal (CLUES, VARIABLE, VALOR, MES, AÑO, MUNICIPIO), pero de toda la
 * jurisdicción junta: Querétaro, Huimilpan, El Marqués, Corregidora, NHG y HENM. Las filas salen del servidor
 * (RPC sis_filas_csv, vía SIS_CSV.filasDeMunicipio): solo unidades VALIDADAS, la misma fuente de la publicación a
 * indicadores y de PARALELOS, así que los tres nunca difieren.
 *
 * Vive en el Concentrado Jurisdiccional (paso 4 «Informe»), junto a PARALELOS. Solo JURISDICCIONAL y ADMIN.
 */
(function () {
  const DESTINOS = [
    { muni: 'QUERETARO', etiqueta: 'Querétaro' },
    { muni: 'HUIMILPAN', etiqueta: 'Huimilpan' },
    { muni: 'MARQUES', etiqueta: 'El Marqués' },
    { muni: 'CORREGIDORA', etiqueta: 'Corregidora' },
    { muni: 'NHG', etiqueta: 'Nuevo Hospital General (NHG)' },
    { muni: 'HENM', etiqueta: 'Hospital del Niño y la Mujer (HENM)' }
  ];
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const nombreMes = (m) => MESES[Number(m) - 1] || String(m);

  const est = () => (typeof estado !== 'undefined' ? estado : (window.estado || null));
  const puede = () => { const e = est(); const r = e && e.perfil && e.perfil.rol; return r === 'ADMIN' || r === 'JURISDICCIONAL'; };
  const msg = (t, tipo) => { if (typeof window.toast === 'function') window.toast(t, tipo); else console.log('[CSV jurisdiccional]', t); };
  let ocupado = false;

  const periodo = () => ({ mes: Number((document.getElementById('selMes') || {}).value), anio: Number((document.getElementById('selAnio') || {}).value) });

  // Une las filas de cada destino en el orden de DESTINOS (y dentro de cada uno el orden del servidor: CLUES, VARIABLE).
  function unirFilas(porDestino) {
    const filas = [];
    DESTINOS.forEach((d) => { (porDestino.get(d.muni) || []).forEach((f) => filas.push(f)); });
    return filas;
  }

  const nombreArchivo = (mes, anio) => `SIS_JURISDICCION_${String(mes).padStart(2, '0')}_${anio}.csv`;

  async function descargar() {
    if (ocupado) return;
    const { mes, anio } = periodo();
    const db = est() && est().db;
    if (!db) { msg('Aún no hay conexión con la base. Intenta de nuevo.', 'error'); return; }
    if (!window.SIS_CSV) { msg('No cargó el generador de CSV. Recarga la página.', 'error'); return; }
    ocupado = true;
    const btn = document.querySelector('#csvJurisdiccional [data-csvjur]');
    if (btn) btn.disabled = true;
    const estadoEl = document.getElementById('csvJurisdiccionalEstado');
    const aviso = (t) => { if (estadoEl) estadoEl.textContent = t; };
    try {
      const porDestino = new Map(), faltan = [];
      let hechos = 0;
      aviso('Leyendo el SINBA-SIS validado de municipios y hospitales…');
      await Promise.all(DESTINOS.map(async (d) => {
        try {
          porDestino.set(d.muni, await window.SIS_CSV.filasDeMunicipio(db, d.muni, mes, anio));
        } catch (e) {
          faltan.push({ etiqueta: d.etiqueta, motivo: (e && e.message) || String(e) });
        }
        hechos++;
        aviso(`Leyendo… ${hechos} de ${DESTINOS.length}`);
      }));
      const filas = unirFilas(porDestino);
      if (!filas.length) {
        const motivo = faltan.slice(0, 3).map((f) => `${f.etiqueta}: ${f.motivo}`).join(' | ');
        throw new Error('Todavía no hay SINBA-SIS validado en ese periodo. ' + motivo);
      }
      if (faltan.length && typeof window.mostrarModal === 'function') {
        const seguir = await window.mostrarModal({
          titulo: 'Faltan municipios u hospitales por validar',
          mensaje: `Sin SINBA-SIS validado: ${faltan.map((f) => f.etiqueta).join('; ')}. El CSV saldría sin sus unidades. ¿Descargar de todos modos?`,
          textoAceptar: 'Descargar de todos modos'
        });
        if (!seguir) { aviso(''); return; }
      }
      window.SIS_CSV.descargar(nombreArchivo(mes, anio), filas);
      aviso('');
      const unidades = new Set(filas.map((f) => f.CLUES)).size;
      msg(`✅ ${nombreArchivo(mes, anio)} listo: ${unidades} unidades, ${filas.length} filas.${faltan.length ? ' Sin: ' + faltan.map((f) => f.etiqueta).join(', ') + '.' : ''}`, faltan.length ? 'warn' : 'ok');
    } catch (err) {
      console.error('[CSV jurisdiccional] Error al exportar:', err);
      aviso('');
      msg(err.message || 'No se pudo generar el CSV jurisdiccional.', 'error');
    } finally {
      ocupado = false;
      refrescar();
    }
  }

  function refrescar() {
    const cont = document.getElementById('csvJurisdiccional');
    if (!cont) return;
    if (!puede()) { cont.style.display = 'none'; return; }
    cont.style.display = 'flex';
    const { mes, anio } = periodo();
    const btn = cont.querySelector('[data-csvjur]');
    const nota = cont.querySelector('#csvJurisdiccionalNota');
    const valido = anio >= 2026 && mes >= 1 && (anio > 2026 || mes >= 10);
    if (btn) {
      btn.disabled = !valido || ocupado;
      btn.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">download</span> Descargar ${valido ? nombreMes(mes).toLowerCase() : 'CSV'}`;
    }
    if (nota) nota.textContent = valido
      ? `Un solo archivo con TODAS las unidades de los 4 municipios y los 2 hospitales (${nombreMes(mes)} ${anio}), con las columnas del CSV oficial. Solo lo ya validado.`
      : 'Disponible desde octubre de 2026 (elige el mes y el año arriba): antes de eso el SIS no se captura por unidad.';
  }

  // Crea la tarjeta (una sola vez) en el paso 4 del Concentrado Jurisdiccional.
  function pintar() {
    const lista = document.querySelector('#panelPaso4 .jur-entregables');
    if (!lista) return;
    let cont = document.getElementById('csvJurisdiccional');
    if (!puede()) { if (cont) cont.style.display = 'none'; return; }
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'csvJurisdiccional';
      cont.className = 'jur-entregable';
      cont.setAttribute('role', 'region');
      cont.setAttribute('aria-labelledby', 'csvJurisdiccionalTitulo');
      cont.innerHTML = `
        <b id="csvJurisdiccionalTitulo">CSV jurisdiccional</b>
        <small id="csvJurisdiccionalNota"></small>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-secundario btn-mini" data-csvjur="1"></button>
        </div>
        <div id="csvJurisdiccionalEstado" role="status" aria-live="polite" style="font-size:12px; font-weight:600; color:var(--muted);"></div>`;
      lista.appendChild(cont);
      cont.addEventListener('click', (e) => { const b = e.target.closest('[data-csvjur]'); if (b && !b.disabled) descargar(); });
    }
    refrescar();
  }

  window.SIS06PCsvJurisdiccional = { pintar, descargar, unirFilas, nombreArchivo, DESTINOS };
})();
