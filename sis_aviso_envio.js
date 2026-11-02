// Señal para la UNIDAD en la pantalla principal: su SINBA-SIS está guardado y cuadra (paloteo = Movimiento), pero NO se ha enviado.
// Guardar no es enviar: el municipal solo recibe el SINBA-SIS cuando la unidad pulsa «Enviar» (ventana de fin de mes).
// Pone una etiqueta «Falta enviar» en la pestaña SINBA-SIS y, una vez al día, un aviso con acceso directo.
(function () {
  const ETIQUETA_ID = 'sisAvisoEnvioTab';
  let _corriendo = false;
  let _ultimaRevision = 0;

  function usuarioUnidad() {
    const u = typeof USER !== 'undefined' ? USER : null;
    return u && u.rol === 'UNIDAD' && u.clues ? u : null;
  }

  // Meses cuya ventana de envío podría estar abierta hoy: el actual (últimos días) y el anterior (primeros 7 días).
  function periodosCandidatos() {
    const d = new Date();
    const act = { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    const ant = act.mes === 1 ? { anio: act.anio - 1, mes: 12 } : { anio: act.anio, mes: act.mes - 1 };
    return [act, ant];
  }

  async function pendienteDeEnviar(clues) {
    const sb = window.supabase;
    if (!sb || !sb.rpc) return null;
    for (const p of periodosCandidatos()) {
      const { data: vent, error: ev } = await sb.rpc('sis06p_ventana_envio', { p_anio: p.anio, p_mes: p.mes });
      const v = Array.isArray(vent) ? vent[0] : vent;
      if (ev || !v || !v.dentro_envio) continue;
      const { data: cap, error: ec } = await sb.from('sis06p_capturas').select('estado').eq('clues', clues).eq('mes', p.mes).eq('anio', p.anio).maybeSingle();
      if (ec || !cap || cap.estado !== 'BORRADOR') continue;
      const { data: comp, error: eco } = await sb.rpc('sis06p_comparativo', { p_mes: p.mes, p_anio: p.anio, p_clues: clues });
      if (eco || !Array.isArray(comp) || comp.some((f) => !f.coincide)) continue;
      return { mes: p.mes, anio: p.anio, fin: v.fin_envio };
    }
    return null;
  }

  function ponerEtiqueta(hay) {
    const tab = document.getElementById('tabBIOVAC');
    if (!tab) return;
    let et = document.getElementById(ETIQUETA_ID);
    if (!hay) { if (et) et.remove(); return; }
    if (!et) {
      et = document.createElement('span');
      et.id = ETIQUETA_ID;
      et.className = 'nav-tab-aviso';
      et.textContent = 'Falta enviar';
      tab.appendChild(et);
    }
    tab.title = 'Tu SINBA-SIS está guardado pero no enviado: entra y pulsa Enviar';
  }

  function avisarUnaVezAlDia(clues, p) {
    const clave = `sis_aviso_envio_${clues}_${p.anio}-${p.mes}`;
    const hoy = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(clave) === hoy) return; localStorage.setItem(clave, hoy); } catch (e) { /* sin storage: se avisa igual */ }
    if (typeof showToast !== 'function') return;
    showToast('Tu SINBA-SIS está guardado, pero todavía NO lo has enviado. Guardar no basta: tu municipal no recibe nada hasta que pulses «Enviar».', false, 'warn', {
      title: 'Falta enviar tu SINBA-SIS', duration: 14000, force: true,
      action: { label: 'Ir a SINBA-SIS', onclick: "window.location.href='biovac.html'" }
    });
  }

  async function revisar() {
    const u = usuarioUnidad();
    if (!u || _corriendo) return;
    _corriendo = true;
    try {
      const p = await pendienteDeEnviar(u.clues);
      ponerEtiqueta(Boolean(p));
      if (p) avisarUnaVezAlDia(u.clues, p);
      _ultimaRevision = Date.now();
    } catch (err) {
      console.warn('[SINBA-SIS] No se pudo revisar si falta enviar:', err);
    } finally {
      _corriendo = false;
    }
  }

  // La sesión se hidrata después de cargar los scripts: se espera a que exista el usuario (máx. ~90 s) y se revisa una vez.
  let _intentos = 0;
  const espera = setInterval(() => {
    _intentos += 1;
    if (usuarioUnidad() && window.supabase && window.supabase.rpc) {
      clearInterval(espera);
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
      idle(() => revisar());
    } else if (_intentos > 90) {
      clearInterval(espera);
    }
  }, 1000);

  // Al volver a la pestaña (p. ej. tras enviar en otra) se actualiza la etiqueta, como máximo cada 5 minutos.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && usuarioUnidad() && Date.now() - _ultimaRevision > 300000) revisar();
  });
})();
