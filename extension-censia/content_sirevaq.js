// Corre en SIREVAQ. Hace dos cosas, nada más:
//  1) avisa a la página que el complemento está instalado (atributo en <html>);
//  2) cuando la página le manda el paquete de dosis, lo guarda para CeNSIA.
(function () {
  "use strict";
  document.documentElement.setAttribute("data-sirevaq-censia-ext", chrome.runtime.getManifest().version);

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || ev.origin !== location.origin) return;
    var m = ev.data;
    if (!m || m.source !== "sirevaq" || m.type !== "censia-payload") return;
    var p = m.payload;
    if (!p || p.v !== 1 || typeof p.clues !== "string" || typeof p.fecha !== "string" || !p.valores) return;
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
