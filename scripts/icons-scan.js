/**
 * Mantiene el subconjunto de la fuente de iconos (Material Symbols Rounded) de index.html.
 *
 * index.html pide a Google Fonts solo los iconos que la app usa (&icon_names=...), lo que
 * baja la fuente de ~540 KB a ~60 KB. Este script:
 *   1. descarga el catalogo oficial de nombres de iconos,
 *   2. recorre TODO el codigo que carga index.html (HTML/JS/CSS) y junta cada palabra que
 *      coincide con un nombre oficial (superconjunto seguro: nunca omite un icono escrito
 *      como texto; solo se perderia uno armado por concatenacion, y no hay ninguno),
 *   3. reescribe el <link> de la fuente en index.html.
 *
 *   node scripts/icons-scan.js          reescribe el enlace en index.html
 *   node scripts/icons-scan.js --check  solo verifica (sale con 1 si falta algun icono)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const META_URL = 'https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true';

// Carpetas y paginas que NO carga index.html
const SKIP_DIRS = new Set(['node_modules', 'tests', 'dist', 'mobile', 'playwright-report',
  'test-results', 'supabase', '.git', 'assets', 'scripts']);
const SKIP_FILES = /(biovac\.html|biovac_jurisdiccion\.html|biovac_print\.html|requisiciones\.html|reset\.html|mobile\.html|demo_|logo_glass|reference|toast_proposals|mobile_|concentrador|build-)/;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location));
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

function sourceFiles() {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) { if (!SKIP_DIRS.has(f.name) && !f.name.startsWith('.')) walk(path.join(d, f.name)); continue; }
      if (/\.(js|html|css)$/.test(f.name) && !SKIP_FILES.test(f.name)) out.push(path.join(d, f.name));
    }
  })(ROOT);
  return out;
}

(async () => {
  const meta = JSON.parse((await get(META_URL)).replace(/^\)\]\}'\n/, ''));
  // OJO: el catalogo marca como "unsupported" para Rounded a nombres antiguos (expand_more, done,
  // error_outline...) que SI se dibujan: la fuente los acepta como alias, tambien en icon_names.
  const official = new Set(meta.icons.map((i) => i.name));

  const found = new Set();
  const unknown = new Set();
  for (const f of sourceFiles()) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\b[a-z][a-z0-9_]{1,40}\b/g)) if (official.has(m[0])) found.add(m[0]);
    // Por contexto: texto de un elemento con la clase de iconos. Si el catalogo no lo conoce se
    // incluye igual (y se avisa) para no perder un icono por una lista incompleta.
    for (const m of s.matchAll(/material-symbols-rounded[^>]*>\s*([a-z][a-z0-9_]{1,40})\s*</g)) {
      if (!official.has(m[1])) unknown.add(m[1]);
      found.add(m[1]);
    }
  }
  if (unknown.size) console.log('no estan en el catalogo (incluidos igual):', [...unknown].join(', '));
  const names = [...found].sort();
  const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:FILL@0..1&icon_names=' +
    names.join(',') + '&display=block';

  const re = /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Rounded[^"]*" rel="stylesheet">/;
  let anyMissing = false;
  const targets = [
    { file: 'index.html', names },
    // mobile.html pedia la fuente COMPLETA (~540 KB) por datos moviles. Se le da solo lo que
    // usan mobile.html, los mobile_* y los scripts/estilos locales que mobile.html carga.
    { file: 'mobile.html', names: [...mobileNames(official)].sort() },
  ];
  for (const t of targets) {
    const p = path.join(ROOT, t.file);
    let html = fs.readFileSync(p, 'utf8');
    const m = html.match(re);
    if (!m) { console.error(`No se encontro el <link> de Material Symbols en ${t.file}`); process.exit(1); }
    const current = new Set((m[0].match(/icon_names=([^&"]*)/) || [, ''])[1].split(',').filter(Boolean));
    const missing = t.names.filter((n) => !current.has(n));
    console.log(`${t.file}: iconos usados: ${t.names.length} | en el enlace: ${current.size} | faltan: ${missing.length}`);
    if (missing.length) { console.log('faltan:', missing.join(', ')); anyMissing = true; }
    // Google Fonts devuelve la fuente COMPLETA (~540 KB) si icon_names pasa de ~4096 caracteres.
    const largo = t.names.join(',').length;
    if (largo > 4000) { console.log(`AVISO ${t.file}: icon_names mide ${largo} caracteres (>4000): Google devolveria la fuente completa.`); if (t.file === 'mobile.html') anyMissing = true; }
    if (CHECK) continue;
    const u ='https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:FILL@0..1&icon_names=' +
      t.names.join(',') + '&display=block';
    html = html.replace(re, `<link href="${u.replace(/&/g, '&amp;')}" rel="stylesheet">`);
    fs.writeFileSync(p, html);
    console.log(`${t.file} actualizado.`);
  }
  if (CHECK) process.exit(anyMissing ? 1 : 0);
})();

// Iconos escritos en mobile.html y en los archivos mobile_* (solo la parte movil).
function mobileNames(official) {
  const out = new Set();
  const html = fs.readFileSync(path.join(ROOT, 'mobile.html'), 'utf8');
  const set = new Set(['mobile.html']);
  for (const m of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))/g)) {
    if (!/^(https?:|\/\/)/.test(m[1]) && !m[1].startsWith('vendor/')) set.add(m[1]);
  }
  for (const f of fs.readdirSync(ROOT)) if (/^mobile_.*\.(js|css)$/.test(f)) set.add(f);
  const files = [...set].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f));
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    // Solo palabras que son un literal completo ('x', "x", `x`) o el texto de una etiqueta (>x<):
    // asi no entran palabras sueltas de comentarios/CSS que casualmente son nombre de icono.
    for (const m of s.matchAll(/(?<=["'`>])\s*([a-z][a-z0-9_]{1,40})\s*(?=["'`<])/g)) if (official.has(m[1])) out.add(m[1]);
    for (const m of s.matchAll(/material-symbols-rounded[^>]*>\s*([a-z][a-z0-9_]{1,40})\s*</g)) out.add(m[1]);
  }
  return out;
}
