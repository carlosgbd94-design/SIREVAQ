// Corre solo en la pantalla «Captura de dosis aplicadas» de CeNSIA (Influenza).
// Rellena las casillas con lo que dejó SIREVAQ. NUNCA pulsa Guardar.
(function () {
  "use strict";
  var MAX_MS = 12 * 3600 * 1000;

  var host = document.createElement("div");
  host.id = "sirevaq-censia-aviso";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    '<style>' +
    '.b{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:min(600px,92vw);' +
    'background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:16px;padding:12px 16px;' +
    'box-shadow:0 8px 24px rgba(15,23,42,.18);font:600 14px/1.45 system-ui,Segoe UI,sans-serif;display:flex;gap:12px;align-items:center}' +
    '.b.mal{border-color:#fca5a5}.t{flex:1}.t small{display:block;font-weight:500;color:#475569}' +
    'button{font:700 13px system-ui,sans-serif;min-height:36px;padding:0 14px;border-radius:10px;border:1px solid #1e293b;background:#1e293b;color:#fff;cursor:pointer}' +
    'button.s{background:#fff;color:#1e293b;border-color:#cbd5e1}button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}' +
    '</style><div class="b" role="status" aria-live="polite"><div class="t"></div><button class="s" type="button">Cerrar</button></div>';
  var box = root.querySelector(".b"), txt = root.querySelector(".t");
  root.querySelector("button").addEventListener("click", function () { host.remove(); });
  function aviso(html, ok) {
    txt.innerHTML = html;
    box.className = "b" + (ok ? "" : " mal");
    if (!host.isConnected) document.body.appendChild(host);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function ev(el, t) { el.dispatchEvent(new Event(t, { bubbles: true })); }

  var esperar = function (cond, ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function paso() {
        if (cond()) return ok(true);
        if (Date.now() - t0 > ms) return ok(false);
        setTimeout(paso, 120);
      })();
    });
  };
  var opciones = function (sel) { return sel ? Array.prototype.filter.call(sel.options, function (o) { return o.value; }) : []; };
  var tiene = function (sel, v) { return opciones(sel).some(function (o) { return o.value === v; }); };

  // Elige la unidad aunque CeNSIA la cargue por pasos (institución -> municipio -> unidades)
  function elegirUnidad(clues) {
    var cl = document.querySelector("[name=s_clues]");
    if (!cl) return Promise.resolve(false);
    var fin = function () { if (tiene(cl, clues)) { cl.value = clues; ev(cl, "change"); return true; } return false; };
    if (fin()) return Promise.resolve(true);
    var inst = document.querySelector("[name=s_institucion]");
    var mun = document.querySelector("[name=s_municipio]");
    var p = Promise.resolve();
    if (inst && !inst.value) {
      var o = opciones(inst);
      if (o.length === 1 || o.some(function (x) { return x.value === "1"; })) {
        inst.value = o.length === 1 ? o[0].value : "1"; ev(inst, "change");
        p = esperar(function () { return opciones(mun).length > 0; }, 4000);
      }
    }
    return p.then(function () {
      if (fin()) return true;
      var munis = opciones(mun);
      // Si no sabemos el municipio, se prueba uno por uno hasta que aparezca la unidad
      return munis.reduce(function (prev, m) {
        return prev.then(function (hallado) {
          if (hallado) return true;
          mun.value = m.value; ev(mun, "change");
          return esperar(function () { return tiene(cl, clues); }, 1500).then(function (ok) { return ok ? fin() : false; });
        });
      }, Promise.resolve(false));
    });
  }

  function rellenar(d) {
    var f = document.querySelector("input[type=date]");
    if (f) { f.value = d.fecha; ev(f, "input"); ev(f, "change"); }
    var n = 0, total = 0;
    Object.keys(d.valores).forEach(function (k) {
      var el = document.getElementById(k);
      if (!el || el.disabled) return;
      el.value = d.valores[k]; ev(el, "input"); ev(el, "change");
      n++; total += d.valores[k];
    });
    var fecha = d.fecha.split("-").reverse().join("/");
    var base = "SIREVAQ rellenó " + n + " casillas · " + total.toLocaleString("es-MX") + " dosis · fecha " + fecha;
    aviso(base + "<small>Eligiendo tu unidad…</small>", true);
    elegirUnidad(d.clues).then(function (ok) {
      aviso(base + "<small>" + (ok ? "Unidad " + esc(d.clues) + " elegida. " : "Falta elegir tu unidad (" + esc(d.clues) + ") en el selector de CeNSIA. ") +
        "Revisa las cifras y pulsa GUARDAR tú mismo.</small>", ok);
    });
  }

  var ultimoT = 0, enganchado = false;
  var hayFormulario = function () { return !!document.getElementById("BIE01"); };

  // Al guardar en CeNSIA, el paquete se descarta para que no se rellene dos veces
  function enganchar() {
    if (enganchado) return;
    enganchado = true;
    var descartar = function () { setTimeout(function () { chrome.storage.local.remove("pending"); }, 1500); };
    var btn = document.getElementById("enviar_dosis");
    if (btn) btn.addEventListener("click", descartar, true);
    if (document.forms[0]) document.forms[0].addEventListener("submit", descartar, true);
  }

  // Rellena si ya hay formulario y hay un paquete sin usar. Se llama cuando la pantalla termina de cargar,
  // cuando el formulario aparece tarde (CeNSIA lo arma con scripts / tras el inicio de sesión) y cuando
  // SIREVAQ entrega un paquete con CeNSIA ya abierta: así no hace falta recargar con F5.
  function intentar() {
    if (!hayFormulario()) return;
    chrome.storage.local.get("pending", function (r) {
      var d = r && r.pending;
      if (!d || d.v !== 1) return;                         // nada pendiente: no hacemos ruido
      if (Date.now() - d.t > MAX_MS) { chrome.storage.local.remove("pending"); return; }
      if (d.t === ultimoT) return;                         // ese paquete ya se rellenó en esta pantalla
      ultimoT = d.t;
      rellenar(d);
      enganchar();
    });
  }

  if (hayFormulario()) intentar();
  else {
    var obs = new MutationObserver(function () {
      if (!hayFormulario()) return;
      obs.disconnect();
      // un instante para que CeNSIA termine de pintar los selectores antes de tocarlos
      setTimeout(intentar, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 10 * 60 * 1000);
  }
  chrome.storage.onChanged.addListener(function (cambios, area) {
    if (area === "local" && cambios.pending && cambios.pending.newValue) intentar();
  });
})();
