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
const SKIP_DIRS = new Set(['node_modules', 'tests', 'dist', 'sinba_dev', 'mobile', 'playwright-report',
  'test-results', 'supabase', '.git', 'assets', 'scripts', '73d628c9-0e23-43a9-ac8a-b98bcfaf5a37']);
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

  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const re = /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Rounded[^"]*" rel="stylesheet">/;
  const m = html.match(re);
  if (!m) { console.error('No se encontro el <link> de Material Symbols en index.html'); process.exit(1); }

  const current = new Set((m[0].match(/icon_names=([^&"]*)/) || [, ''])[1].split(',').filter(Boolean));
  const missing = names.filter((n) => !current.has(n));
  console.log(`iconos usados: ${names.length} | en index.html: ${current.size} | faltan: ${missing.length}`);
  if (missing.length) console.log('faltan:', missing.join(', '));

  if (CHECK) process.exit(missing.length ? 1 : 0);
  html = html.replace(re, `<link href="${url.replace(/&/g, '&amp;')}" rel="stylesheet">`);
  fs.writeFileSync(indexPath, html);
  console.log('index.html actualizado.');
})();
