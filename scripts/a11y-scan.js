// Escáner rápido de accesibilidad para pegar/evaluar en la consola de una página de SIREVAQ.
// Uso (con el servidor local abierto):  eval(await (await fetch('/scripts/a11y-scan.js')).text())
// Revisa: controles sin nombre, iconos sin aria-hidden, campos sin etiqueta, tablas sin scope, landmarks, regiones vivas,
// contraste aproximado de textos visibles y si hay @media (prefers-reduced-motion). No sustituye una auditoría con lector de pantalla.
(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const nombre = (e) => {
    const al = e.getAttribute('aria-label'); if (al) return al.trim();
    const lb = e.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    if (e.labels && e.labels.length) return e.labels[0].innerText.trim();
    const clon = e.cloneNode(true); clon.querySelectorAll('.material-symbols-rounded,[aria-hidden=true]').forEach((n) => n.remove());
    const t = (clon.innerText || clon.textContent || '').trim(); if (t) return t;
    return (e.title || e.placeholder || e.getAttribute('alt') || '').trim();
  };
  const r = { url: location.pathname, lang: document.documentElement.lang, titulo: document.title };
  const ctrls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')].filter(vis);
  r.controles = ctrls.length;
  r.sinNombre = ctrls.filter((e) => !nombre(e)).map((e) => (e.id || e.className || e.tagName).toString().slice(0, 50)).slice(0, 25);
  const iconos = [...document.querySelectorAll('.material-symbols-rounded')];
  r.iconosSinAriaHidden = iconos.filter((e) => !e.closest('[aria-hidden=true]') && !e.getAttribute('aria-label') && !e.getAttribute('aria-hidden')).length;
  r.iconosTotal = iconos.length;
  r.inputsSinEtiqueta = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis)
    .filter((e) => !(e.getAttribute('aria-label') || (e.labels && e.labels.length) || e.getAttribute('aria-labelledby'))).map((e) => e.id || e.name || e.className).slice(0, 20);
  r.imgSinAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
  r.thSinScope = [...document.querySelectorAll('th')].filter((t) => !t.getAttribute('scope') && vis(t)).length;
  r.h1 = document.querySelectorAll('h1').length; r.h2 = document.querySelectorAll('h2').length;
  r.landmarks = { main: document.querySelectorAll('main,[role=main]').length, nav: document.querySelectorAll('nav,[role=navigation]').length, saltar: document.querySelectorAll('.saltar-contenido').length };
  r.tabindexPositivo = [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).length;
  r.regionesVivas = document.querySelectorAll('[aria-live],[role=status],[role=alert]').length;
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [R, G, B] = m.slice(0, 3).map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
  const fondo = (e) => { for (let n = e; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; const m = b.match(/\d+(\.\d+)?/g); if (m && (m.length < 4 || Number(m[3]) > 0.5)) return b; } return 'rgb(255,255,255)'; };
  const bajos = []; const vistos = new Set();
  document.querySelectorAll('p,span,small,b,td,th,label,button,a,h1,h2,h3,li,div').forEach((e) => {
    if (!vis(e) || e.classList.contains('material-symbols-rounded') || e.disabled) return;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const cs = getComputedStyle(e); const L1 = lum(cs.color), L2 = lum(fondo(e)); if (L1 == null || L2 == null) return;
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize); const grande = px >= 18.66 || (px >= 14 && Number(cs.fontWeight) >= 700);
    if (ratio < (grande ? 3 : 4.5)) { const k = cs.color + '|' + fondo(e) + '|' + px; if (!vistos.has(k)) { vistos.add(k); bajos.push(`${ratio.toFixed(2)} ${px}px ${cs.color} sobre ${fondo(e)} :: "${e.textContent.trim().slice(0, 30)}"`); } }
  });
  r.contrasteBajo = bajos.slice(0, 20);
  r.reducirMovimiento = [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((x) => x.conditionText && x.conditionText.includes('prefers-reduced-motion')); } catch (e) { return false; } });
  return JSON.stringify(r, null, 1);
})()
