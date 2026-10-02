// Reglas de la función r2-signer (supabase/functions/r2-signer/validar.mjs), sin red ni Deno.
const { test, expect } = require('@playwright/test');

let V;
test.beforeAll(async () => { V = await import('../supabase/functions/r2-signer/validar.mjs'); });

const ruta = (r) => V.validarRuta(r);

test('rutas: acepta las que usa la app y rechaza recorridos de carpeta y basura', async () => {
  for (const ok of [
    'Evidencia_de_capacitaciones/Curso_Vacunacion/QTSSA001793_JURICA/2026-10-01-doc.pdf',
    'Supervision/QTSSA001793_JURICA/2026-10-01-EVIDENCIA-SUPERVISION-QTSSA001793_JURICA.jpg',
    'Requisiciones/Transferencias/abc123/Transferencias_Octubre_2026.pdf',
    'Otros_reportes/QTSSA001793_JURICA/informe.DOCX'
  ]) expect(ruta(ok).ok, ok).toBe(true);
  for (const mal of ['', '   ', null, undefined, '/etc/passwd.pdf', 'a/../b/x.pdf', '../x.pdf', 'a/./x.pdf', 'a//x.pdf', ['a', 'b', 'x.pdf'].join(String.fromCharCode(92)), 'x.pdf', 'a/b/', 'a/b\u0000.pdf', 'a/' + 'x'.repeat(160) + '.pdf', ('a/'.repeat(200)) + 'x.pdf'])
    expect(ruta(mal).ok, String(mal)).toBe(false);
});

test('tipos: solo extensiones permitidas; el Content-Type sale de la extensión', async () => {
  expect(ruta('Otros_reportes/u/a.pdf').mime).toBe('application/pdf');
  expect(ruta('Otros_reportes/u/a.JPG').mime).toBe('image/jpeg');
  expect(ruta('Otros_reportes/u/a.xlsx').mime).toContain('spreadsheetml');
  for (const peligroso of ['a.html', 'a.htm', 'a.svg', 'a.js', 'a.mjs', 'a.exe', 'a.php', 'a.bat', 'a.sh', 'a.xml', 'a.pdf.exe', 'a', '.pdf', 'a.'])
    expect(ruta('Otros_reportes/u/' + peligroso).ok, peligroso).toBe(false);
  expect(ruta('Otros_reportes/u/a.svg').estado).toBe(415);
});

const base = (r) => ({ segmentos: ruta(r).segmentos, extension: ruta(r).extension });

test('transferencias: solo PDF, con sesión y solo ADMIN/JURISDICCIONAL (nunca sin sesión)', async () => {
  const t = 'Requisiciones/Transferencias/tok/Transferencias_Octubre_2026.pdf';
  const quien = (rol, extra = {}) => V.autorizarSubida({ ...base(t), rol, activo: 'SI', tieneSesion: true, permitirAnonimo: true, ...extra });
  expect(quien('ADMIN').ok).toBe(true);
  expect(quien('JURISDICCIONAL').ok).toBe(true);
  expect(quien('jurisdiccional').ok).toBe(true);
  for (const rol of ['MUNICIPAL', 'UNIDAD', 'VISUALIZADOR_JURISDICCIONAL', '', undefined]) expect(quien(rol).estado, String(rol)).toBe(403);
  expect(quien('ADMIN', { activo: 'NO' }).estado).toBe(403);
  // Sin sesión: 401 aunque se permita el modo "cliente viejo"
  expect(quien('ADMIN', { tieneSesion: false, rol: '' }).estado).toBe(401);
  // Otra carpeta de Requisiciones o un archivo que no es PDF
  expect(V.autorizarSubida({ ...base('Requisiciones/Otra/x.pdf'), rol: 'ADMIN', activo: 'SI', tieneSesion: true, permitirAnonimo: true }).ok).toBe(false);
  expect(V.autorizarSubida({ ...base('Requisiciones/Transferencias/t/x.png'), rol: 'ADMIN', activo: 'SI', tieneSesion: true }).estado).toBe(415);
});

test('evidencias: cada rol en su carpeta; sin sesión solo mientras se permita el modo legado', async () => {
  const sub = (r, ctx) => V.autorizarSubida({ ...base(r), activo: 'SI', ...ctx });
  const ev = 'Evidencia_de_capacitaciones/C/QTSSA1_U/a.pdf';
  const sup = 'Supervision/QTSSA1_U/a.jpg';
  expect(sub(ev, { rol: 'UNIDAD', tieneSesion: true }).ok).toBe(true);
  expect(sub(ev, { rol: 'ADMIN', tieneSesion: true }).ok).toBe(true);
  expect(sub(ev, { rol: 'MUNICIPAL', tieneSesion: true }).estado).toBe(403);
  expect(sub(ev, { rol: 'JURISDICCIONAL', tieneSesion: true }).estado).toBe(403);
  expect(sub(sup, { rol: 'MUNICIPAL', tieneSesion: true }).ok).toBe(true);
  expect(sub(sup, { rol: 'UNIDAD', tieneSesion: true }).estado).toBe(403);
  expect(sub('Evidencias_de_campana/C/QTSSA1_U/a.png', { rol: 'UNIDAD', tieneSesion: true }).ok).toBe(true);
  expect(sub('Otros_reportes/QTSSA1_U/a.docx', { rol: 'UNIDAD', tieneSesion: true }).ok).toBe(true);
  expect(sub(ev, { rol: 'UNIDAD', activo: 'NO', tieneSesion: true }).estado).toBe(403);
  // Cliente viejo (sin token): pasa solo con el interruptor encendido, y se marca como anónimo
  expect(sub(ev, { tieneSesion: false, permitirAnonimo: true })).toEqual({ ok: true, anonimo: true });
  expect(sub(ev, { tieneSesion: false, permitirAnonimo: false }).estado).toBe(401);
});

test('carpetas ajenas a la app se rechazan siempre (no se puede escribir en cualquier ruta del bucket)', async () => {
  for (const r of ['otra/carpeta/a.pdf', 'Requisiciones/a.pdf', 'sirevaq/x.pdf', 'Supervision_falsa/x/a.pdf', 'constructor/x/a.pdf', '__proto__/x/a.pdf'])
    for (const ctx of [{ rol: 'ADMIN', tieneSesion: true }, { tieneSesion: false, permitirAnonimo: true }]) {
      const res = V.autorizarSubida({ ...base(r), activo: 'SI', ...ctx });
      expect(res.ok, `${r} ${JSON.stringify(ctx)}`).toBe(false);
    }
});

test('tamaño máximo: 40 MB', async () => {
  expect(V.MAX_BYTES).toBe(40 * 1024 * 1024);
});
