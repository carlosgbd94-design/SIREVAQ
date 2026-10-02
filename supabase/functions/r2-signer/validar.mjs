// Validación de subidas a R2 (lógica pura, sin Deno ni red: se prueba con Node en tests/r2-signer-validacion.spec.js).
//
// Qué se exige:
//  * Ruta: sin "..", sin "\", sin caracteres de control, sin segmentos vacíos ni larguísimos.
//  * Tipo de archivo: solo extensiones de la lista (nada de html/svg/js/exe en un dominio público);
//    el Content-Type se deduce de la extensión, no se confía en el que manda el navegador.
//  * Tamaño: hasta 40 MB.
//  * Quién puede escribir dónde (ver autorizarSubida).

export const MAX_BYTES = 40 * 1024 * 1024;

const MIME_POR_EXTENSION = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv', txt: 'text/plain', rtf: 'application/rtf',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  jfif: 'image/jpeg', tif: 'image/tiff', tiff: 'image/tiff', avif: 'image/avif',
  mp4: 'video/mp4', mov: 'video/quicktime'
};

// Carpetas de evidencias que ya usa la app (main.js, case "uploadfile") y quién las llena.
const EVIDENCIAS = {
  supervision: ['MUNICIPAL', 'ADMIN'],
  evidencia_de_capacitaciones: ['UNIDAD', 'ADMIN'],
  evidencias_de_campana: ['UNIDAD', 'ADMIN'],
  otros_reportes: ['UNIDAD', 'ADMIN']
};
const ROLES_TRANSFERENCIAS = ['ADMIN', 'JURISDICCIONAL'];

export function validarRuta(rutaCruda) {
  const ruta = String(rutaCruda == null ? '' : rutaCruda).trim();
  if (!ruta) return { ok: false, estado: 400, error: 'Falta la ruta del archivo (folderPath).' };
  if (ruta.length > 300) return { ok: false, estado: 400, error: 'La ruta del archivo es demasiado larga.' };
  if (/[\u0000-\u001f\u007f\\]/.test(ruta)) return { ok: false, estado: 400, error: 'La ruta del archivo trae caracteres no permitidos.' };
  if (ruta.startsWith('/') || ruta.endsWith('/')) return { ok: false, estado: 400, error: 'La ruta del archivo no es válida.' };
  const segmentos = ruta.split('/');
  if (segmentos.length < 2) return { ok: false, estado: 400, error: 'La ruta debe incluir una carpeta.' };
  if (segmentos.some((s) => s === '' || s === '.' || s === '..' || s.length > 150)) {
    return { ok: false, estado: 400, error: 'La ruta del archivo no es válida.' };
  }
  const nombre = segmentos[segmentos.length - 1];
  const punto = nombre.lastIndexOf('.');
  const extension = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : '';
  const mime = MIME_POR_EXTENSION[extension];
  if (!mime) return { ok: false, estado: 415, error: `Tipo de archivo no permitido${extension ? ` (.${extension})` : ''}.` };
  return { ok: true, ruta, segmentos, extension, mime };
}

// `contexto`: { segmentos, extension, rol, activo, tieneSesion, permitirAnonimo }
// Devuelve { ok:true } o { ok:false, estado, error }.
export function autorizarSubida({ segmentos, extension, rol, activo, tieneSesion, permitirAnonimo }) {
  const raiz = String(segmentos[0] || '').toLowerCase();
  const rolMay = String(rol || '').toUpperCase();

  // Transferencias de Requisiciones: PDF, y solo con sesión de ADMIN/JURISDICCIONAL (nunca sin sesión).
  if (raiz === 'requisiciones') {
    if (String(segmentos[1] || '').toLowerCase() !== 'transferencias') return { ok: false, estado: 403, error: 'Ruta no permitida.' };
    if (extension !== 'pdf') return { ok: false, estado: 415, error: 'Las transferencias deben ser PDF.' };
    if (!tieneSesion) return { ok: false, estado: 401, error: 'Inicia sesión para subir transferencias.' };
    if (activo !== 'SI' || !ROLES_TRANSFERENCIAS.includes(rolMay)) return { ok: false, estado: 403, error: 'Tu perfil no puede subir transferencias.' };
    return { ok: true };
  }

  // Evidencias (las que ya sube la app).
  if (Object.prototype.hasOwnProperty.call(EVIDENCIAS, raiz)) {
    if (tieneSesion) {
      if (activo !== 'SI' || !EVIDENCIAS[raiz].includes(rolMay)) return { ok: false, estado: 403, error: 'Tu perfil no puede subir a esa carpeta.' };
      return { ok: true };
    }
    // Sin sesión: solo mientras los clientes viejos (que no mandan el token) sigan en uso.
    if (permitirAnonimo) return { ok: true, anonimo: true };
    return { ok: false, estado: 401, error: 'Inicia sesión para subir archivos.' };
  }

  return { ok: false, estado: 403, error: 'Ruta no permitida.' };
}
