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
    '.b{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(560px,94vw);box-sizing:border-box;' +
    'background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;' +
    'box-shadow:0 10px 30px rgba(15,23,42,.16);font:400 14px/1.5 Inter,system-ui,Segoe UI,sans-serif;display:flex;gap:14px;align-items:flex-start;' +
    'animation:ent .9s cubic-bezier(.3,.7,.4,1) both,flota 2.2s ease-in-out .9s infinite}' +
    '.b:hover{animation-play-state:running,paused}' +
    '@keyframes flota{0%,100%{translate:0 0}50%{translate:0 -6px}}' +
    '@keyframes ent{0%{opacity:0;transform:translate(-50%,-120px)}35%{opacity:1;transform:translate(-50%,10px)}55%{transform:translate(-50%,-14px)}75%{transform:translate(-50%,5px)}90%{transform:translate(-50%,-2px)}100%{opacity:1;transform:translate(-50%,0)}}' +
    '@media (prefers-reduced-motion:reduce){.b{animation:none}}' +
    '.i{flex:none;width:24px;height:24px;color:#15803d;margin-top:1px}.mal .i{color:#b45309}.i svg{width:24px;height:24px;display:block}' +
    '.c{flex:1;min-width:0}.h{font:600 16px/1.35 system-ui,Segoe UI,sans-serif;margin:0 0 2px}' +
    '.m{font-weight:inherit;color:#43474e}.h .m,.p .m{font-weight:700}.p .q{height:.78em;vertical-align:-.01em;margin-left:.05em}.q{height:.8em;width:auto;vertical-align:-.03em;margin-left:0}' +
    '.r{margin:0 0 10px;color:#64748b;font-size:13px}' +
    '.p{margin:0;color:#334155}.p strong{color:#0f172a;font-weight:700}' +
    '.p b{display:inline-block;background:#15803d;color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;border-radius:6px;padding:0 8px;line-height:1.6}' +
    'button{flex:none;font:600 13px system-ui,sans-serif;min-height:32px;padding:0 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer}' +
    'button:hover{background:#f8fafc}button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}' +
    '</style><div class="b" role="status" aria-live="polite"><div class="i"></div><div class="c"></div><button type="button">Cerrar</button></div>';
  var box = root.querySelector(".b"), ico = root.querySelector(".i"), cuerpo = root.querySelector(".c");
  // Marca como en la cabecera de SIREVAQ: «SIREVA» en gris medio y la «Q» en azul carbón, negrita fuerte
  var MARCA = '<span class="m">SIREVA<img class="q" alt="Q" src="data:image/png;base64,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"></span>';
  var SVG_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>';
  var SVG_AV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>';
  root.querySelector("button").addEventListener("click", function () { host.remove(); });
  // estado: "ok" | "mal" (falta elegir la unidad)
  function aviso(titulo, resumen, pie, estado) {
    ico.innerHTML = estado === "mal" ? SVG_AV : SVG_OK;
    cuerpo.innerHTML = '<p class="h">' + titulo + '</p><p class="r">' + resumen + '</p><p class="p">' + pie + '</p>';
    box.className = "b" + (estado === "mal" ? " mal" : "");
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
    var fecha = esc(d.fecha.split("-").reverse().join("/"));
    var resumen = n + (n === 1 ? " casilla" : " casillas") + " · " + total.toLocaleString("es-MX") + " dosis · " + fecha;
    var guardar = "<strong>Verifica y revisa las dosis:</strong> compara cada cifra con tu reporte y confirma que todo esté bien antes de pulsar <b>Guardar</b>. " + MARCA + " nunca guarda por ti.";
    aviso(MARCA + " rellenó tu reporte", resumen, "Eligiendo tu unidad…", "ok");
    elegirUnidad(d.clues).then(function (ok) {
      if (ok) {
        // CeNSIA muestra la unidad como «CLUES - NOMBRE»: se antepone el nombre al CLUES
        var cl = document.querySelector("[name=s_clues]");
        var tx = cl && cl.selectedIndex >= 0 ? cl.options[cl.selectedIndex].text : "";
        var nombre = tx.indexOf(d.clues) === 0 ? tx.slice(d.clues.length).replace(/^[\s\-–]+/, "").trim() : "";
        aviso(MARCA + " rellenó tu reporte", (nombre ? esc(nombre) + " · " : "") + esc(d.clues) + "<br>" + resumen, guardar, "ok");
      } else aviso("Falta elegir tu unidad", resumen, "Elige <b>" + esc(d.clues) + "</b> en «Unidades médicas (CLUES)». Después <strong>verifica y revisa las dosis</strong> y pulsa <b>Guardar</b>.", "mal");
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
