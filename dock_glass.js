/* Barra flotante de pestañas/pasos (ver dock_glass.css): la "tinta" -- el
   resaltado tonal que se desliza hasta la pestaña activa y toma su color
   (--hoja). Se reposiciona al cambiar la pestaña activa, al cambiar el
   contenido de las pestañas (píldoras), al redimensionar y cuando el propio
   contenedor pasa de oculto a visible. */
(function () {
  'use strict';

  function mover(cont) {
    if (!cont) return;
    const tinta = cont.querySelector('.hoja-tinta');
    if (!tinta) return;
    const activa = cont.querySelector('.hoja-tab.activo');
    if (!activa || activa.offsetWidth === 0) { tinta.style.width = '0px'; return; }
    tinta.style.width = activa.offsetWidth + 'px';
    tinta.style.transform = 'translateX(' + activa.offsetLeft + 'px)';
    tinta.style.setProperty('--hoja', getComputedStyle(activa).getPropertyValue('--hoja').trim() || '#0284c7');
    // En una barra desbordada (móvil) la pestaña activa siempre queda a la vista.
    if (typeof activa.scrollIntoView === 'function' && cont.scrollWidth > cont.clientWidth) {
      activa.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function instalar(cont) {
    if (!cont || cont.dataset.tinta === '1') return;
    cont.dataset.tinta = '1';
    const tinta = cont.querySelector('.hoja-tinta');
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
