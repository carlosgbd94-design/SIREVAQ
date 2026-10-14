/**
 * medal_badges.js — medallas de cumplimiento (SVG metálico sobrio, una silueta por rango).
 * Un solo sprite oculto con <symbol> + gradientes; cada medalla es un <use> (barato aunque haya decenas
 * en el ranking). Compartido por escritorio (bundle-head) y móvil.
 */
(function () {
  "use strict";

  var TIERS = {
    diamante: { label: "Diamante", g: ["#D6EEFF", "#5BB4F5", "#1F5FB8"] },
    oro:      { label: "Oro",      g: ["#FFE9A6", "#E8B64A", "#9A6A12"] },
    plata:    { label: "Plata",    g: ["#F4F6F8", "#B9C1CA", "#6B7580"] },
    bronce:   { label: "Bronce",   g: ["#F3C7A0", "#C98048", "#7A4420"] },
    acero:    { label: "Acero",    g: ["#D3DBE4", "#8497AB", "#44566B"] },
    jade:     { label: "Jade",     g: ["#C8F2E0", "#4CC49A", "#13705A"] }
  };
  var ORDER = ["diamante", "oro", "plata", "bronce", "acero", "jade"];

  function pts(k, r1, r2, cx, cy) {
    var a = [];
    for (var i = 0; i < k * 2; i++) {
      var r = i % 2 ? r2 : r1, t = Math.PI * i / k - Math.PI / 2;
      a.push((cx + r * Math.cos(t)).toFixed(1) + "," + (cy + r * Math.sin(t)).toFixed(1));
    }
    return a.join(" ");
  }
  function reg(k, r, cx, cy, off) {
    var a = [];
    for (var i = 0; i < k; i++) {
      var t = 2 * Math.PI * i / k - Math.PI / 2 + (off || 0);
      a.push((cx + r * Math.cos(t)).toFixed(1) + "," + (cy + r * Math.sin(t)).toFixed(1));
    }
    return a.join(" ");
  }
  function laurel(c) {
    var o = "";
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 6; i++) {
        var a = Math.PI * (0.62 + i * 0.095);
        var x = 32 - s * 13.5 * Math.cos(a), y = 30 + 13.5 * Math.sin(a);
        o += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="1.5" ry="3.2" fill="' + c +
          '" opacity=".85" transform="rotate(' + (s * (-30 + i * 22)).toFixed(0) + " " + x.toFixed(1) + " " + y.toFixed(1) + ')"/>';
      }
    }
    return o;
  }

  function symbolBody(t) {
    var g = TIERS[t].g, O = "url(#mb-" + t + "-o)", I = "url(#mb-" + t + "-i)", hl = "#fff";
    var star = '<polygon points="' + pts(5, 7.5, 3.1, 32, 32) + '" fill="' + g[0] + '" opacity=".95"/>';
    var rim = function (shape) { return shape + ' fill="none" stroke="' + hl + '" stroke-opacity=".5" stroke-width=".8"/>'; };
    if (t === "oro") {
      return '<polygon points="' + pts(16, 29, 26.5, 32, 32) + '" fill="' + O + '"/>' +
        '<circle cx="32" cy="32" r="21" fill="' + I + '"/>' +
        rim('<circle cx="32" cy="32" r="21"') +
        '<circle cx="32" cy="32" r="17" fill="none" stroke="' + g[2] + '" stroke-opacity=".5" stroke-width=".8"/>' +
        laurel(g[0]) + star;
    }
    if (t === "plata") {
      var sh = "M32 8L50 14V31C50 43 42 50 32 55C22 50 14 43 14 31V14Z";
      return '<path d="M32 3L55 11V31C55 46 45 55 32 61C19 55 9 46 9 31V11Z" fill="' + O + '"/>' +
        '<path d="' + sh + '" fill="' + I + '"/>' + rim('<path d="' + sh + '"') +
        '<polygon points="' + pts(5, 9, 3.7, 32, 31) + '" fill="' + g[0] + '"/>';
    }
    if (t === "bronce") {
      return '<polygon points="' + reg(6, 29, 32, 32, 0) + '" fill="' + O + '"/>' +
        '<polygon points="' + reg(6, 23, 32, 32, 0) + '" fill="' + I + '"/>' +
        rim('<polygon points="' + reg(6, 23, 32, 32, 0) + '"') +
        '<polygon points="' + reg(6, 17.5, 32, 32, 0) + '" fill="none" stroke="' + g[2] + '" stroke-opacity=".5" stroke-width=".8"/>' + star;
    }
    if (t === "acero") {
      return '<polygon points="' + reg(8, 29, 32, 32, Math.PI / 8) + '" fill="' + O + '"/>' +
        '<polygon points="' + reg(8, 23.5, 32, 32, Math.PI / 8) + '" fill="' + I + '"/>' +
        rim('<polygon points="' + reg(8, 23.5, 32, 32, Math.PI / 8) + '"') +
        '<circle cx="32" cy="32" r="14" fill="none" stroke="' + g[2] + '" stroke-opacity=".55" stroke-width=".8"/>' + star;
    }
    if (t === "jade") {
      return '<rect x="4" y="4" width="56" height="56" rx="21" fill="' + O + '"/>' +
        '<rect x="10" y="10" width="44" height="44" rx="15" fill="' + I + '"/>' +
        rim('<rect x="10" y="10" width="44" height="44" rx="15"') +
        '<path d="M32 45C21 42 19 31 23 22C34 23.5 43 31 32 45Z" fill="' + g[0] + '" opacity=".95"/>' +
        '<path d="M32 45L26 29" stroke="' + g[2] + '" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>';
    }
    // diamante: gema facetada
    return '<path d="M15 21L24 9H40L49 21L32 57Z" fill="' + O + '"/>' +
      '<path d="M15 21H49L32 57Z" fill="' + I + '" opacity=".95"/>' +
      '<path d="M24 9L29 21L15 21Z" fill="' + g[0] + '" opacity=".9"/>' +
      '<path d="M40 9L35 21H49Z" fill="' + g[2] + '" opacity=".6"/>' +
      '<path d="M24 9H40L35 21H29Z" fill="#fff" opacity=".55"/>' +
      '<path d="M29 21H35L32 57Z" fill="#fff" opacity=".35"/>' +
      '<path d="M15 21L24 9H40L49 21L32 57Z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8" stroke-linejoin="round"/>' +
      '<path d="M50 5l1.3 4.2 4.2 1.3-4.2 1.3L50 16l-1.3-4.2-4.2-1.3 4.2-1.3z" fill="' + g[0] + '"/>';
  }

  var mounted = false;
  function mount() {
    if (mounted || typeof document === "undefined" || !document.body) return;
    if (document.getElementById("mb-sprite")) { mounted = true; return; }
    var defs = "", syms = "";
    ORDER.forEach(function (t) {
      var g = TIERS[t].g;
      defs += '<linearGradient id="mb-' + t + '-o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + g[0] +
        '"/><stop offset=".5" stop-color="' + g[1] + '"/><stop offset="1" stop-color="' + g[2] + '"/></linearGradient>' +
        '<linearGradient id="mb-' + t + '-i" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + g[0] +
        '"/><stop offset=".55" stop-color="' + g[1] + '"/><stop offset="1" stop-color="' + g[2] + '"/></linearGradient>';
      syms += '<symbol id="mb-' + t + '" viewBox="0 0 64 64">' + symbolBody(t) + "</symbol>";
    });
    var holder = document.createElement("div");
    holder.innerHTML = '<svg id="mb-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" ' +
      'style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' + defs + "</defs>" + syms + "</svg>";
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
    mounted = true;
  }
  if (typeof document !== "undefined") {
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }

  /** Marcado de una medalla; mount() es idempotente por si se pide antes de que exista el body. */
  function svg(tier, size) {
    var t = String(tier || "").trim().toLowerCase();
    if (!TIERS[t]) return "";
    mount();
    var s = size || 24;
    return '<svg class="mb-svg" width="' + s + '" height="' + s + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#mb-' + t + '"/></svg>';
  }

  window.MedalBadges = {
    svg: svg,
    has: function (t) { return !!TIERS[String(t || "").trim().toLowerCase()]; },
    label: function (t) { var x = TIERS[String(t || "").trim().toLowerCase()]; return x ? x.label : ""; },
    tiers: ORDER.slice()
  };
})();
