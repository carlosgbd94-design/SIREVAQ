/* Barra flotante de pestañas/pasos (ver dock_glass.css): la "tinta" -- el
   resaltado tonal que se desliza hasta la pestaña activa y toma su color
   (--hoja). Se reposiciona al cambiar la pestaña activa, al cambiar el
   contenido de las pestañas (píldoras), al redimensionar y cuando el propio
   contenedor pasa de oculto a visible. */
(function () {
  'use strict';

  function mover(cont) {
    if (!cont) return;
    bordes(cont);
    const tinta = cont.querySelector('.hoja-tinta');
    if (!tinta) return;
    const activa = cont.querySelector('.hoja-tab.activo');
    if (!activa || activa.offsetWidth === 0) { tinta.style.width = '0px'; return; }
    tinta.style.width = activa.offsetWidth + 'px';
    tinta.style.transform = 'translateX(' + activa.offsetLeft + 'px)';
    const color = getComputedStyle(activa).getPropertyValue('--hoja').trim() || '#0284c7';
    tinta.style.setProperty('--hoja', color);
    // En una barra desbordada (móvil) la pestaña activa siempre queda a la vista.
    if (typeof activa.scrollIntoView === 'function' && cont.scrollWidth > cont.clientWidth) {
      activa.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      bordes(cont);
    }
  }

  // Difumina el borde por el que aún hay pestañas fuera de vista (en vez de cortarlas en seco).
  function bordes(cont) {
    // Antes de recortar pestañas se cede el lugar de la línea de estatus: sin ella caben todas (el estatus sigue a un toque en «Enviar»).
    const dock = cont.closest && cont.closest('.dock-sis');
    if (dock) {
      dock.classList.remove('dock-compacto');
      if (cont.scrollWidth - cont.clientWidth > 2) dock.classList.add('dock-compacto');
    }
    const max = cont.scrollWidth - cont.clientWidth;
    const izq = max > 2 && cont.scrollLeft > 2;
    const der = max > 2 && cont.scrollLeft < max - 2;
    cont.classList.toggle('corta-izq', izq);
    cont.classList.toggle('corta-der', der);
  }

  function instalar(cont) {
    if (!cont || cont.dataset.tinta === '1') return;
    cont.dataset.tinta = '1';
    const tinta = cont.querySelector('.hoja-tinta');
    cont.addEventListener('scroll', () => bordes(cont), { passive: true });
    new MutationObserver((registros) => {
      // Los cambios de la propia tinta no deben re-dispararse a sí mismos.
      if (registros.every((r) => r.target === tinta)) return;
      mover(cont);
    }).observe(cont, { attributes: true, attributeFilter: ['class', 'style'], subtree: true, childList: true, characterData: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => mover(cont)).observe(cont);
    window.addEventListener('resize', () => mover(cont));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => mover(cont));
    mover(cont);
  }

  window.DockGlass = { instalar, mover };
})();
