/**
 * Junta y comprime (sin reescribir nada) los scripts locales de SIREVAQ.
 *
 * Que SI hace: concatenar los archivos en el MISMO orden en que hoy se cargan
 * en index.html, y correr el minificador de esbuild (quita espacios/comentarios
 * y acorta nombres de variables locales). Nada de conversion a TypeScript, nada
 * de módulos ES, nada de cambiar la sintaxis del código.
 *
 * Que NO hace: no toca index.html. El resultado se escribe en dist/ y hay que
 * verificarlo (ver index.bundled-test.html + npm test) antes de usarlo en produccion.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');

// Mismo orden exacto en el que index.html los carga hoy (ver <head>, linea ~362-371).
// pdf_assets.js (imagenes base64 del PDF de Resguardo) se excluye a proposito:
// main.js ahora lo carga bajo demanda (ver ensurePdfAssetsLoaded) solo cuando
// se exporta ese PDF, en vez de pesar en el bundle de cada carga de la app.
const GROUP_HEAD = [
  'offline_db.js',
  'stock_predictor.js',
  'export_manager.js',
  'pinol_assets.js',
  'feedback_autoreply.js',
  'perfil_cuenta.js',
  'main.js',
  'influenza_module.js',
  'sis_export_module.js',
];

// Mismo orden exacto en el que index.html los carga hoy (final del <body>, linea ~7752-7755).
const GROUP_BODY = [
  'rda_calculator.js',
  'rda_parser.js',
  'param_calculator.js',
  'jeringas_calculator.js',
  'auditoria_console.js',
  'rda_ui.js',
  'concentrado_ui.js',
];

function concatGroup(files) {
  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
      // ";\n" entre archivos evita que un archivo sin punto y coma final
      // se pegue con una linea del siguiente (Automatic Semicolon Insertion).
      return `/* ---- ${file} ---- */\n${content}\n;`;
    })
    .join('\n');
}

async function buildGroup(name, files) {
  const source = concatGroup(files);
  const result = await esbuild.transform(source, {
    minify: true,
    // Sin "target": esbuild no baja de version ni reescribe sintaxis,
    // solo minifica (espacios, comentarios, nombres de variables locales).
    sourcefile: name,
    sourcemap: 'external',
    legalComments: 'none',
  });

  fs.writeFileSync(path.join(DIST_DIR, `${name}.js`), `${result.code}\n//# sourceMappingURL=${name}.js.map`);
  fs.writeFileSync(path.join(DIST_DIR, `${name}.js.map`), result.map);

  const originalSize = Buffer.byteLength(source, 'utf8');
  const finalSize = Buffer.byteLength(result.code, 'utf8');
  console.log(
    `[build-bundle] ${name}.js: ${files.length} archivos, ${(originalSize / 1024).toFixed(0)} KB -> ${(finalSize / 1024).toFixed(0)} KB`
  );
}

async function main() {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  await buildGroup('bundle-head', GROUP_HEAD);
  await buildGroup('bundle-body', GROUP_BODY);
  console.log('[build-bundle] Listo. Revisa dist/. index.html de produccion NO fue tocado.');
}

main().catch((err) => {
  console.error('[build-bundle] Error:', err);
  process.exit(1);
});
