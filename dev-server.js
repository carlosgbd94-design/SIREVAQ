/**
 * Servidor local de desarrollo (npm run dev -> http://localhost:5800).
 *  - Sirve la carpeta del proyecto SIN caché (Cache-Control: no-store): recargar = ver el cambio al instante.
 *  - Al guardar un .js/.css/.html fuera de dist/ reconstruye dist/ con build-bundle.js (con espera de 400 ms
 *    para juntar guardados seguidos), así main.js y los demás archivos del bundle se reflejan sin comandos.
 *  - No toca index.html ni sube nada: es solo para probar en local (usa el mismo Supabase de producción).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5800);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.normalize(path.join(ROOT, ruta));
  if (!archivo.startsWith(ROOT)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('No encontrado'); }
    const ext = path.extname(archivo).toLowerCase();
    const cabeceras = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    // Como en producción (GitHub Pages sirve gzip): así las mediciones de peso y tiempos de red son comparables.
    if (/\b(gzip)\b/.test(req.headers['accept-encoding'] || '') && /^(\.html|\.js|\.mjs|\.css|\.json|\.map|\.svg|\.csv|\.txt)$/.test(ext)) {
      res.writeHead(200, { ...cabeceras, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return fs.createReadStream(archivo).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    }
    res.writeHead(200, { ...cabeceras, 'Content-Length': st.size });
    fs.createReadStream(archivo).pipe(res);
  });
}).listen(PORT, () => console.log(`[dev] http://localhost:${PORT}  (sin caché; reconstruye dist/ al guardar)`));

// --- Reconstrucción automática del bundle ---
let temporizador = null, construyendo = false, pendiente = false;
function construir() {
  if (construyendo) { pendiente = true; return; }
  construyendo = true;
  const t0 = Date.now();
  const p = spawn(process.execPath, ['build-bundle.js'], { cwd: ROOT, stdio: 'ignore' });
  p.on('exit', (codigo) => {
    construyendo = false;
    console.log(`[dev] bundle ${codigo === 0 ? 'reconstruido' : 'FALLÓ (revisa node build-bundle.js)'} en ${Date.now() - t0} ms`);
    if (pendiente) { pendiente = false; construir(); }
  });
}
const IGNORAR = /(^|[\\/])(dist|node_modules|\.git|\.claude|tests|test-results|playwright-report|mobile|supabase|assets|vendor|prueba_exportacion|PRUEBAS_EXPORTACION)([\\/]|$)/i;
fs.watch(ROOT, { recursive: true }, (_ev, nombre) => {
  if (!nombre || IGNORAR.test(nombre) || !/\.(js|css|html)$/i.test(nombre)) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(construir, 400);
});
