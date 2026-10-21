// Corre en SIREVAQ. Hace tres cosas, nada más:
//  1) avisa a la página que el complemento está instalado (atributo en <html>);
//  2) cuando la página le manda el paquete de dosis, lo guarda para CeNSIA;
//  3) si el complemento se actualiza con la página abierta, se lo avisa para que pida recargar.
(function () {
  "use strict";
  document.documentElement.setAttribute("data-sirevaq-censia-ext", chrome.runtime.getManifest().version);

  // Al actualizarse el complemento, esta copia queda huérfana (chrome.runtime.id desaparece): se avisa una sola vez
  var vigia = setInterval(function () {
    var vivo = false;
    try { vivo = !!(chrome.runtime && chrome.runtime.id); } catch (e) { vivo = false; }
    if (vivo) return;
    clearInterval(vigia);
    window.postMessage({ source: "sirevaq-ext", type: "ext-updated" }, location.origin);
  }, 3000);

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || ev.origin !== location.origin) return;
    var m = ev.data;
    if (!m || m.source !== "sirevaq" || m.type !== "censia-payload") return;
    var p = m.payload;
    if (!p || p.v !== 1 || typeof p.clues !== "string" || p.clues.length > 40 || typeof p.fecha !== "string" || !p.valores) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) return;      // la fecha se muestra en CeNSIA: solo AAAA-MM-DD
    // Solo cifras enteras >= 0 con códigos de casilla válidos
    var limpio = {};
    Object.keys(p.valores).forEach(function (k) {
      var n = Number(p.valores[k]);
      if (/^BI[EO][0-9A-Za-z_]{1,20}$/.test(k) && Number.isInteger(n) && n >= 0 && n < 100000) limpio[k] = n;
    });
    chrome.storage.local.set({ pending: { v: 1, t: Date.now(), clues: p.clues, fecha: p.fecha, valores: limpio } }, function () {
      window.postMessage({ source: "sirevaq-ext", type: "censia-payload-ok" }, location.origin);
    });
  });
})();
