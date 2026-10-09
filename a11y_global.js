/*
 * Accesibilidad global de SIREVAQ (se carga en todas las pantallas).
 * No cambia el diseño: corrige lo que un lector de pantalla o el teclado no pueden resolver solos.
 *   1. Los iconos (Material Symbols) son decorativos: aria-hidden (si no, el lector dice "check_circle", "arrow_back"...).
 *   2. Botones/enlaces que solo traen un icono reciben nombre en español (a partir del icono o de su title).
 *   3. Encabezados de tabla con scope y casillas numéricas sin etiqueta con una a partir de su fila/columna.
 *   4. Foco visible para teclado en todo control y "reducir movimiento" respetado en TODAS las animaciones.
 *   5. Enlace "Saltar al contenido" (aparece al navegar con Tab).
 * Todo se aplica al cargar y a lo que se pinte después (MutationObserver).
 */
(function () {
  'use strict';
  if (window.__a11yGlobal) return;
  window.__a11yGlobal = true;

  var css = [
    ':focus-visible { outline: 3px solid #0f172a !important; outline-offset: 2px !important; }',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }',
    '}',
    '.saltar-contenido { position: fixed; left: 12px; top: -64px; z-index: 2147483000; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 12px; font: 700 13px/1.2 Inter, system-ui, sans-serif; text-decoration: none; transition: top .18s ease; }',
    '.saltar-contenido:focus { top: 12px; }'
  ].join('\n');
  var estilo = document.createElement('style');
  estilo.setAttribute('data-a11y-global', '1');
  estilo.textContent = css;
  (document.head || document.documentElement).appendChild(estilo);

  var NOMBRE_ICONO = {
    close: 'Cerrar', arrow_back: 'Volver', arrow_forward: 'Siguiente', delete: 'Eliminar', edit: 'Editar', download: 'Descargar',
    refresh: 'Actualizar', search: 'Buscar', help: 'Ayuda', info: 'Información', menu: 'Menú', add: 'Agregar', add_circle: 'Agregar',
    save: 'Guardar', print: 'Imprimir', expand_more: 'Mostrar más', expand_less: 'Mostrar menos', chevron_left: 'Anterior',
    chevron_right: 'Siguiente', more_vert: 'Más opciones', visibility: 'Ver', check: 'Confirmar', send: 'Enviar', undo: 'Deshacer',
    history: 'Historial', upload: 'Subir', content_copy: 'Copiar', notifications: 'Notificaciones', logout: 'Cerrar sesión',
    picture_as_pdf: 'Ver PDF', done_all: 'Marcar todo', lock: 'Candado', settings: 'Configuración'
  };

  function nombreVisible(el) {
    var al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var t = lb.split(' ').map(function (i) { var n = document.getElementById(i); return n ? n.textContent : ''; }).join(' ').trim();
      if (t) return t;
    }
    var clon = el.cloneNode(true);
    var ic = clon.querySelectorAll('.material-symbols-rounded, [aria-hidden="true"]');
    for (var i = 0; i < ic.length; i++) ic[i].remove();
    return (clon.textContent || '').trim();
  }

  function arreglarIconos(raiz) {
    var l = raiz.querySelectorAll('.material-symbols-rounded:not([aria-hidden]):not([aria-label]):not([role="img"])');
    for (var i = 0; i < l.length; i++) l[i].setAttribute('aria-hidden', 'true');
  }

  function arreglarNombres(raiz) {
    var l = raiz.querySelectorAll('button:not([aria-label]), a[href]:not([aria-label]), [role="button"]:not([aria-label])');
    for (var i = 0; i < l.length; i++) {
      var el = l[i];
      if (nombreVisible(el)) continue;
      var nombre = (el.getAttribute('title') || '').trim();
      if (!nombre) {
        var ic = el.querySelector('.material-symbols-rounded');
        var txt = ic ? (ic.textContent || '').trim() : '';
        nombre = NOMBRE_ICONO[txt] || '';
      }
      if (nombre) el.setAttribute('aria-label', nombre);
    }
  }

  function arreglarTablas(raiz) {
    var ths = raiz.querySelectorAll('th:not([scope])');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var enCuerpo = th.parentElement && th.parentElement.parentElement && th.parentElement.parentElement.tagName === 'TBODY';
      th.setAttribute('scope', enCuerpo && th.cellIndex === 0 ? 'row' : 'col');
    }
    // Casillas de captura dentro de tablas sin etiqueta: se nombran con el texto de su fila y de su columna.
    var ins = raiz.querySelectorAll('td input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([aria-label]), td select:not([aria-label])');
    for (var j = 0; j < ins.length; j++) {
      var inp = ins[j];
      if ((inp.labels && inp.labels.length) || inp.getAttribute('aria-labelledby')) continue;
      var td = inp.closest('td'); var tr = td && td.parentElement; if (!tr) continue;
      var tabla = tr.closest('table');
      var fila = tr.cells && tr.cells[0] ? nombreVisible(tr.cells[0]).replace(/\s+/g, ' ').slice(0, 80) : '';
      var col = '';
      if (tabla && tabla.tHead && tabla.tHead.rows.length) {
        var cab = tabla.tHead.rows[tabla.tHead.rows.length - 1].cells[td.cellIndex];
        col = cab ? nombreVisible(cab).replace(/\s+/g, ' ').slice(0, 60) : '';
      }
      var et = [fila, col].filter(Boolean).join(' — ') || inp.getAttribute('title') || inp.getAttribute('placeholder') || '';
      if (et) inp.setAttribute('aria-label', et);
    }
  }

  // Pestañas/selectores de vista que solo marcaban la activa con una clase: se anuncian con aria-current.
  function sincronizarVistas() {
    var bs = document.querySelectorAll('button.nav-tab');
    for (var i = 0; i < bs.length; i++) {
      var activa = bs[i].classList.contains('active') || bs[i].classList.contains('activo') || bs[i].classList.contains('tab-active');
      if (activa) bs[i].setAttribute('aria-current', 'true'); else bs[i].removeAttribute('aria-current');
    }
  }

  function arreglar(raiz) {
    try { arreglarIconos(raiz); arreglarNombres(raiz); arreglarTablas(raiz); sincronizarVistas(); } catch (e) { /* la accesibilidad nunca debe romper la página */ }
  }

  function enlaceSaltar() {
    if (document.querySelector('.saltar-contenido') || !document.body) return;
    var a = document.createElement('a');
    a.className = 'saltar-contenido';
    a.href = '#';
    a.textContent = 'Saltar al contenido';
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      var hs = document.querySelectorAll('h1, h2');
      var destino = null;
      for (var i = 0; i < hs.length; i++) { var r = hs[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0) { destino = hs[i]; break; } }
      if (!destino) return;
      destino.setAttribute('tabindex', '-1');
      destino.focus();
      destino.scrollIntoView({ block: 'start' });
    });
    document.body.insertBefore(a, document.body.firstChild);
  }

  var pendiente = false;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    // setTimeout (no rAF): también corre con la pestaña en segundo plano
    setTimeout(function () { pendiente = false; arreglar(document); }, 60);
  }

  function iniciar() {
    enlaceSaltar();
    arreglar(document);
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
      // cambio de clase en una pestaña (active/activo): se vuelve a anunciar cuál está activa
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) { if (muts[i].target.classList && muts[i].target.classList.contains('nav-tab')) { programar(); return; } }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
