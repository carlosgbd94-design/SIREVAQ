/* Globitos de ayuda ("hints") para los botones e íconos de las tablas.
 *
 * Qué hace: en el SINBA-SIS, cualquier elemento con title="..." dentro de la hoja de Movimiento (o con data-hint="...")
 * muestra su explicación en un globito bien visible al pasar el puntero o al enfocarlo con el teclado, en lugar del
 * tooltip nativo (lento, chico y que no se lee bien). El texto del title pasa a data-hint la primera vez; si el elemento
 * no tiene texto propio (botón de solo ícono) se conserva como aria-label para lectores de pantalla.
 *
 * En pantalla táctil no hay "pasar el puntero": ahí la explicación vive en las tarjetas de arriba de cada hoja y en los
 * tutoriales; los globitos solo salen con mouse o teclado.
 */
(function () {
  'use strict';

  const ALCANCE = '#panelMovimiento, #panelSIS06P, #panelCEH, #panelInfluenza, #rutaMes, .dock-sis, #sis06pConciliacion';
  let burbuja = null;
  let duenio = null;
  let timer = null;

  function crear() {
    if (burbuja) return burbuja;
    const st = document.createElement('style');
    st.textContent = `
      .hint-burbuja { position: fixed; z-index: 2400; max-width: 290px; padding: 9px 12px; border-radius: 12px; background: #0f172a; color: #f8fafc;
        font: 600 12.5px/1.45 'Nunito Sans', 'Inter', sans-serif; box-shadow: 0 10px 28px rgba(15,23,42,.35); pointer-events: none;
        opacity: 0; transform: translateY(4px); transition: opacity .14s ease, transform .14s ease; }
      .hint-burbuja.visible { opacity: 1; transform: none; }
      .hint-burbuja::after { content: ''; position: absolute; left: var(--flecha, 50%); width: 10px; height: 10px; background: #0f172a; transform: translateX(-50%) rotate(45deg); }
      .hint-burbuja.arriba::after { bottom: -4px; }
      .hint-burbuja.abajo::after { top: -4px; }
      @media (prefers-reduced-motion: reduce) { .hint-burbuja { transition: none; transform: none; } }`;
    document.head.appendChild(st);
    burbuja = document.createElement('div');
    burbuja.className = 'hint-burbuja';
    burbuja.id = 'hintBurbuja';
    burbuja.setAttribute('role', 'tooltip');
    burbuja.hidden = true;
    burbuja.setAttribute('aria-hidden', 'true');   // decorativo para los lectores: el texto ya viaja en aria-label / aria-describedby
    document.body.appendChild(burbuja);
    return burbuja;
  }

  // Convierte el title nativo en data-hint (una sola vez por elemento).
  function adoptar(el) {
    if (!el || el.dataset.hint) return;
    const t = el.getAttribute('title');
    if (!t) return;
    el.dataset.hint = t;
    el.removeAttribute('title');
    const sinTexto = !(el.textContent || '').replace(/\b(lock|edit|delete|swap_horiz|help)\b/g, '').trim();
    if (sinTexto && !el.getAttribute('aria-label')) el.setAttribute('aria-label', t);
  }

  function objetivo(nodo) {
    if (!nodo || !nodo.closest) return null;
    const el = nodo.closest('[data-hint], [title]');
    if (!el) return null;
    if (!el.dataset.hint && !el.closest(ALCANCE)) return null;
    return el;
  }

  function mostrar(el) {
    adoptar(el);
    const texto = el.dataset.hint;
    if (!texto) return;
    const b = crear();
    b.hidden = false;
    b.textContent = texto;
    b.classList.remove('visible', 'arriba', 'abajo');
    b.style.left = '0px'; b.style.top = '0px';
    const r = el.getBoundingClientRect();
    const w = b.offsetWidth, h = b.offsetHeight;
    const margen = 8;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(margen, Math.min(window.innerWidth - w - margen, left));
    const cabeArriba = r.top - h - 12 > margen;
    const top = cabeArriba ? r.top - h - 10 : r.bottom + 10;
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.style.setProperty('--flecha', Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left)) + 'px');
    b.classList.add(cabeArriba ? 'arriba' : 'abajo');
    requestAnimationFrame(() => b.classList.add('visible'));
    duenio = el;
    el.setAttribute('aria-describedby', 'hintBurbuja');
  }

  function ocultar() {
    clearTimeout(timer);
    if (burbuja) { burbuja.classList.remove('visible'); const b = burbuja; setTimeout(() => { if (!b.classList.contains('visible')) b.hidden = true; }, 200); }
    if (duenio) { duenio.removeAttribute('aria-describedby'); duenio = null; }
  }

  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    const el = objetivo(ev.target);
    if (!el || el === duenio) return;
    ocultar();
    adoptar(el);
    timer = setTimeout(() => mostrar(el), 280);
  });
  document.addEventListener('pointerout', (ev) => {
    const el = objetivo(ev.target);
    if (el && (!ev.relatedTarget || !el.contains(ev.relatedTarget))) ocultar();
  });
  document.addEventListener('focusin', (ev) => {
    const el = objetivo(ev.target);
    if (el) { ocultar(); mostrar(el); }
  });
  document.addEventListener('focusout', ocultar);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') ocultar(); });
  document.addEventListener('click', ocultar, true);
  window.addEventListener('scroll', ocultar, { passive: true, capture: true });

  window.Hints = { mostrar, ocultar };
})();
