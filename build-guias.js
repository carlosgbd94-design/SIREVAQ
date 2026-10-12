/* Genera las guías para compartir (página HTML + PDF) a partir de UNA sola fuente: guias_contenido.js.
 *
 *   npm run build:guias
 *
 * Escribe instructivo_influenza.*, instructivo_sis.* y novedades_unidades.*. En la app esas mismas guías
 * se ven dentro de la tarjeta «¿Cómo funciona?» (ayuda.js); estas páginas/PDF existen solo para mandarlas
 * por WhatsApp o imprimirlas. Requiere Playwright (ya es dependencia de desarrollo del proyecto).
 */
const fs = require('fs');
const path = require('path');
const G = require('./guias_contenido.js');

const RAIZ = __dirname;
const CSS = fs.readFileSync(path.join(RAIZ, 'guias_estilo.css'), 'utf8');
const PIE = 'SIREVAQ · Jurisdicción Sanitaria 1';

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pagina({ titulo, desc, pdf, volver, volverEtiqueta, cuerpo, claseBody = '', cssExtra = '' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · SIREVAQ</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(titulo)} · SIREVAQ">
<meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="#1E1B3A">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&family=Rubik:wght@500;600;700&display=swap">
<style>
${CSS}
${cssExtra}
</style>
</head>
<body class="${claseBody}">
<div class="barra">
  <a class="volver" href="${esc(volver)}" aria-label="${esc(volverEtiqueta)}">&#8592; ${esc(volverEtiqueta)}</a>
  <b>${esc(titulo)}</b>
  <a href="${esc(pdf)}" download>Descargar PDF</a>
</div>
<main class="deck">
${cuerpo}
</main>
</body>
</html>
`;
}

const tarj = (b) => {
  const n = b.tipo === 'paso' ? `<div class="num">${esc(b.n)}</div>` : '';
  const donde = b.donde ? `<p class="donde">Dónde: ${esc(b.donde)}</p>` : '';
  return `<div class="tarj">${n}<h3>${esc(b.nombre)}</h3><p>${esc(b.texto)}</p>${donde}</div>`;
};

function diapositivaPaso(paso, i, n) {
  let html = '';
  let cartas = [];
  const vaciar = () => { if (cartas.length) { html += `  <div class="fila">${cartas.join('')}</div>\n`; cartas = []; } };
  paso.bloques.forEach((b) => {
    if (b.tipo === 'item' || b.tipo === 'paso') cartas.push(tarj(b));
    else {
      vaciar();
      if (b.tipo === 'titulo') html += `  <h3 class="sub">${esc(b.texto)}</h3>\n`;
      else if (b.tipo === 'nota') html += `  <p><b>${esc(b.texto)}</b></p>\n`;
    }
  });
  vaciar();
  return `
<section class="slide" aria-label="${esc(paso.titulo)}">
  <p class="etq">Paso ${i + 1} de ${n}</p>
  <h2>${esc(paso.titulo)}</h2>
${html}  <p class="pie">${PIE}</p>
</section>`;
}

function guiaPorPasos(g, claveExtra) {
  const n = g.pasos.length;
  const portada = `
<section class="slide noche" aria-label="Portada">
  <p class="etq">Para las unidades de salud</p>
  <h1>${esc(g.titulo.replace(/^Guía del /, '').replace(/^Guía de /, ''))}</h1>
  <h3 style="color:#E4DDFB;font-weight:500">${esc(g.subtitulo)}</h3>
  <p class="pie">${PIE}</p>
</section>`;
  const cierre = `
<section class="slide noche" aria-label="Cierre">
  <p class="etq">¿Dudas?</p>
  <h1>La ayuda está en cada pantalla</h1>
  <p>Busca el botón <b>«?»</b> o <b>«¿Cómo funciona?»</b> en tu panel: abre esta misma guía por pasos sin salir de lo que estás haciendo. Para correcciones, consulta a tu coordinación municipal.</p>
  <p><a class="boton-final" href="${esc(g.volver)}">&#8592; ${esc(g.volverEtiqueta)}</a></p>
  <p class="pie">${PIE}</p>
</section>`;
  return portada + g.pasos.map((p, i) => diapositivaPaso(p, i, n)).join('') + cierre;
}

function tarjetaNovedades(g) {
  let k = 0;
  const items = g.pasos.flatMap((p) => p.bloques.filter((b) => b.tipo === 'item'));
  const lista = items.map((b) => {
    k += 1;
    return `
  <article class="nov">
    <div class="num">${k}</div>
    <div><h3>${esc(b.nombre)}</h3><p>${esc(b.texto)}</p>${b.donde ? `<p class="donde">Dónde lo encuentro: ${esc(b.donde)}</p>` : ''}</div>
  </article>`;
  }).join('');
  return `
<section class="slide noche" aria-label="Novedades">
  <p class="etq">Para las unidades de salud</p>
  <h1>Lo nuevo en SIREVAQ</h1>
  <p>${items.length} cosas que ya puedes usar. Cada una dice dónde encontrarla.</p>
</section>
<section class="slide" aria-label="Lista de novedades">
  <div class="nov-lista">${lista}
  </div>
  <p class="pie">${PIE}</p>
</section>
<section class="slide" aria-label="Guías">
  <p class="etq">Guías paso a paso</p>
  <h2>Para ver todo con detalle</h2>
  <div class="fila">
    <div class="tarj"><h3>${esc(G.influenza_captura.titulo)}</h3><p>${esc(G.influenza_captura.subtitulo)}</p><p class="solo-impresion">carlosgbd94-design.github.io/SIREVAQ/${G.influenza_captura.pagina}</p><p><a class="boton-final" href="${G.influenza_captura.pagina}">Abrir guía</a></p></div>
    <div class="tarj"><h3>${esc(G.guia_sis.titulo)}</h3><p>${esc(G.guia_sis.subtitulo)}</p><p class="solo-impresion">carlosgbd94-design.github.io/SIREVAQ/${G.guia_sis.pagina}</p><p><a class="boton-final" href="${G.guia_sis.pagina}">Abrir guía</a></p></div>
  </div>
  <p><a class="boton-final" href="${esc(g.volver)}">&#8592; ${esc(g.volverEtiqueta)}</a></p>
  <p class="pie">${PIE}</p>
</section>`;
}

const SALIDAS = [
  { clave: 'influenza_captura', archivo: 'instructivo_influenza', tarjeta: false },
  { clave: 'guia_sis', archivo: 'instructivo_sis', tarjeta: false },
  { clave: 'novedades', archivo: 'novedades_unidades', tarjeta: true }
];

async function main() {
  const { chromium } = require('@playwright/test');
  const navegador = await chromium.launch();
  for (const s of SALIDAS) {
    const g = G[s.clave];
    const html = pagina({
      titulo: g.titulo, desc: g.subtitulo, pdf: s.archivo + '.pdf', volver: g.volver, volverEtiqueta: g.volverEtiqueta,
      cuerpo: s.tarjeta ? tarjetaNovedades(g) : guiaPorPasos(g), claseBody: s.tarjeta ? 'tarjeta' : '',
      cssExtra: s.tarjeta ? '@page { size: Letter portrait; margin: 0; }' : ''
    });
    fs.writeFileSync(path.join(RAIZ, s.archivo + '.html'), html, 'utf8');
    const p = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto('file:///' + path.join(RAIZ, s.archivo + '.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' }).catch(() => {});
    await p.emulateMedia({ media: 'print' });
    const opts = { path: path.join(RAIZ, s.archivo + '.pdf'), printBackground: true, preferCSSPageSize: true };
    if (s.tarjeta) Object.assign(opts, { format: 'Letter' }); else Object.assign(opts, { width: '1280px', height: '720px' });
    await p.pdf(opts);
    if (!s.tarjeta) {
      const desbordan = await p.evaluate(() => [...document.querySelectorAll('.slide')].map((el, i) => ({ i: i + 1, sh: el.scrollHeight, ch: el.clientHeight })).filter((x) => x.sh > x.ch + 1));
      if (desbordan.length) console.warn('  ⚠ diapositivas que desbordan en', s.archivo, JSON.stringify(desbordan));
    }
    await p.close();
    console.log('[build-guias]', s.archivo + '.html + .pdf');
  }
  await navegador.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
