// Auditoría de Requisiciones (requisiciones.html) con un Supabase simulado: accesibilidad automática (axe-core,
// WCAG 2.1 A/AA + buenas prácticas), identificadores repetidos, controles repetidos y carga de lotes.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-supabase.js'), 'utf8');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|ResizeObserver|DevTools/i;

async function preparar(page, opciones = {}) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => {
    window.__AUTO_CONFIRMAR__ = true;
    setInterval(() => {
      const m = document.getElementById('modalConfirmar');
      if (window.__AUTO_CONFIRMAR__ && m && m.style.display === 'flex') document.getElementById('confirmarAceptar').click();
    }, 25);
  });
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  // Las fuentes de iconos SÍ se cargan (axe detecta los iconos de ligadura solo con la fuente real)
  await page.route(/cdnjs\.cloudflare\.com/, (r) => r.abort());
  if (opciones.libs) {
    await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
    await page.route(/jszip\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'jszip', 'dist', 'jszip.min.js') }));
  }
  await page.addInitScript((o) => { window.__FAKE_ROL__ = o.rol; window.__FAKE_CON_REQ__ = !!o.conReq; window.__FAKE_MUNI__ = o.muni || null; }, { rol: opciones.rol || 'ADMIN', conReq: opciones.conReq, muni: opciones.muni });
  await page.goto('/requisiciones.html', { waitUntil: 'load' });
  return errores;
}

const db = (page, expr) => page.evaluate(`(() => { const db = window.__FAKE_DB__; return ${expr}; })()`);

// axe-core sobre lo que está a la vista; devuelve [{id, impacto, nodos:[selector]}]
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.slice(0, 6).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  });
}

// Identificadores repetidos y botones visibles con el mismo nombre accesible dentro de un mismo contenedor
async function repetidos(page) {
  return page.evaluate(() => {
    const ids = {};
    document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    const idsRepetidos = Object.entries(ids).filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
    const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const nombre = (e) => (e.getAttribute('aria-label') || e.textContent || e.title || '').replace(/\s+/g, ' ').trim();
    const grupos = {};
    document.querySelectorAll('button, a[href]').forEach((e) => {
      if (!visible(e)) return;
      const n = nombre(e);
      if (!n) return;
      const zona = (e.closest('section, [role="dialog"], .paso, .card, header, nav, main') || document.body).id || (e.closest('section, [role="dialog"], .paso, .card, header, nav, main') || document.body).className || 'body';
      const k = zona + ' | ' + n;
      grupos[k] = (grupos[k] || 0) + 1;
    });
    const botonesRepetidos = Object.entries(grupos).filter(([, n]) => n > 1).map(([k, n]) => `${k} x${n}`);
    return { idsRepetidos, botonesRepetidos };
  });
}

test.use({ viewport: { width: 1400, height: 900 } });

test('AUDITORÍA: sin violaciones de accesibilidad ni controles/ids repetidos en cada estado de Requisiciones', async ({ page }) => {
  test.setTimeout(120000);
  const errores = await preparar(page);
  const informe = {};
  const revisar = async (etiqueta) => { await page.waitForTimeout(350); informe[etiqueta] = { axe: await axe(page), ...(await repetidos(page)) }; };

  await expect(page.locator('#tarjetaSinRequisicion')).toBeVisible();
  await revisar('sin requisición');

  await page.click('#btnCrearRequisicion');
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await revisar('paso 1 vacío');

  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.keyboard.type('AB123'); await page.keyboard.press('Enter');
  await page.keyboard.type('150227'); await page.keyboard.type('1000'); await page.keyboard.press('Enter');
  await page.evaluate((t) => { const d = new DataTransfer(); d.setData('text/plain', t); document.getElementById('rapLote').dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); }, ['HEXAVALENTE\tHX001\tMAR-27\t400', 'TD\tTD77\t04/27\t100'].join('\n'));
  await revisar('modal pegar');
  await page.click('#pegarImportar');
  await expect(page.locator('#modalPegar')).toBeHidden();
  await revisar('paso 1 con lotes');

  await page.click('.paso-tab[data-paso="2"]');
  await revisar('paso 2');
  await page.click('.paso-tab[data-paso="3"]');
  await revisar('paso 3');

  const problemas = {};
  for (const [k, v] of Object.entries(informe)) {
    const p = { axe: v.axe, idsRepetidos: v.idsRepetidos, botonesRepetidos: v.botonesRepetidos };
    if (p.axe.length || p.idsRepetidos.length || p.botonesRepetidos.length) problemas[k] = p;
  }
  expect(problemas).toEqual({});
  expect(errores).toEqual([]);
});

test('la fecha de recepción capturada es la que se queda al cerrar y no el último día del mes', async ({ page }) => {
  const errores = await preparar(page);
  await page.click('#btnCrearRequisicion');
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  const campo = page.locator('#inpFechaRecepcion');
  await expect(campo).toBeVisible();
  // Al ir tecleando el año aparece 0002, 0020…: eso no es una fecha y no se guarda
  await campo.fill('0002-07-06');
  await campo.dispatchEvent('change');
  await page.waitForTimeout(150);
  expect(await db(page, 'db.requi_requisiciones[db.requi_requisiciones.length-1].fecha_envio || null')).toBeNull();
  // La barra del mes ya no trae botones de «cargar» ni «guardar» (cargar es automático y Guardar vive abajo)
  await expect(page.locator('#btnCargar, #btnGuardarCabecera')).toHaveCount(0);
  // Año y mes comparten fila; las entregas (y la fecha de recepción) van juntas en su propio panel debajo
  const sel = await page.evaluate(() => ({ a: document.getElementById('selAnio').getBoundingClientRect().top, m: document.getElementById('selMes').getBoundingClientRect().top,
    panel: document.getElementById('barraEntregas').getBoundingClientRect().bottom, dentro: document.getElementById('barraEntregas').contains(document.getElementById('campoFechaRecepcion')) }));
  expect(Math.abs(sel.a - sel.m)).toBeLessThan(4);
  expect(sel.dentro).toBe(true);
  await campo.fill('2026-10-07');
  await campo.dispatchEvent('change');
  await expect.poll(() => db(page, 'db.requi_requisiciones[db.requi_requisiciones.length-1].fecha_envio')).toBe('2026-10-07');
  await page.click('#btnCerrarMes');
  await expect.poll(() => db(page, 'db.requi_requisiciones[db.requi_requisiciones.length-1].estado')).toBe('CERRADA');
  expect(await db(page, 'db.requi_requisiciones[db.requi_requisiciones.length-1].fecha_envio')).toBe('2026-10-07');
  expect(errores).toEqual([]);
});

// Paneles y modales que la auditoría anterior no abría: Exportar (cada pestaña), firmas, historial, transferencias,
// asignar lotes, Traer pedido / influenza / COVID-19 y el perfil municipal.
test('AUDITORÍA: modales y paneles secundarios de Requisiciones sin violaciones de accesibilidad', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.__FAKE_INFLUENZA__ = true; window.__FAKE_COVID__ = true; window.__FAKE_PEDIDOS_EXTRA__ = true;
    const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    window.__FAKE_PEDIDOS__ = [{ fecha: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-22`, tipo: 'MENSUAL', unidades: 68, frascos: 13466 }];
  });
  const errores = await preparar(page, { conReq: true });
  const informe = {};
  // Se espera a que terminen las transiciones (el aviso emergente entra con opacidad) para medir contrastes reales
  const revisar = async (etiqueta) => { await page.waitForTimeout(350); informe[etiqueta] = { axe: await axe(page), ...(await repetidos(page)) }; };
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();

  // Firmas desplegadas
  await page.click('#btnToggleResponsables');
  await expect(page.locator('#btnToggleResponsables')).toHaveAttribute('aria-expanded', 'true');
  await revisar('firmas');
  await page.click('#btnToggleResponsables');

  // Panel Exportar: cada pestaña
  await page.click('#btnAbrirExportar');
  for (const t of ['tabExpMunis', 'tabExpJuris', 'tabExpKardex']) { await page.click('#' + t); await revisar('exportar ' + t); }
  await page.keyboard.press('Escape');

  // Historial y Transferencias
  await page.click('#btnAbrirExplorador');
  await revisar('historial');
  await page.click('#btnAbrirExplorador');
  await page.click('#btnAbrirTransferencias');
  await expect(page.locator('#modalTransferencias')).toBeVisible();
  await revisar('transferencias');
  await page.click('#transCerrar2');

  // Traer pedido / influenza / COVID
  for (const [id, modal] of [['btnTraerPedido', 'modalPedido'], ['btnTraerInfluenza', 'modalInfluenza'], ['btnTraerCovid', 'modalCovid']]) {
    await page.click('#btnMenuTraer');
    await page.click('#' + id);
    await expect(page.locator('#' + modal)).toBeVisible();
    await page.waitForTimeout(250);
    await revisar(modal);
    await page.keyboard.press('Escape');
    await expect(page.locator('#' + modal)).toBeHidden();
  }

  // Asignar lotes
  await page.click('#btnPrellenar');
  await page.locator('#cantFilas input').nth(0).fill('65');
  await page.click('#cantGuardar');
  await page.click('#avisoPendientes .btn-asignar-lotes');
  await expect(page.locator('#modalAsignar')).toBeVisible();
  await revisar('asignar lotes');

  const problemas = {};
  for (const [k, v] of Object.entries(informe)) {
    const p = { axe: v.axe, idsRepetidos: v.idsRepetidos, botonesRepetidos: v.botonesRepetidos };
    if (p.axe.length || p.idsRepetidos.length || p.botonesRepetidos.length) problemas[k] = p;
  }
  expect(problemas).toEqual({});
  expect(errores).toEqual([]);
});

test('perfil municipal (Querétaro): sin firmas ni pestañas de Jurisdicción; Exportar con Municipio y Rutas', async ({ page }) => {
  const errores = await preparar(page, { rol: 'MUNICIPAL', conReq: true, muni: 'QUERETARO' });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await expect(page.locator('#tarjetaResponsables')).toBeHidden();          // la fila de firmas es de Jurisdicción
  await expect(page.locator('#btnMenuTraer')).toBeHidden();
  await page.click('#btnAbrirExportar');
  await expect(page.locator('#tabExpMunis')).toBeVisible();
  await expect(page.locator('#tabExpRutas')).toBeVisible();                 // Rutas es de Querétaro
  await expect(page.locator('#tabExpJuris')).toBeHidden();
  await expect(page.locator('#tabExpKardex')).toBeHidden();
  await expect(page.locator('#seccionMunis')).toBeVisible();
  await expect(page.locator('#btnExportarMasivo')).toBeVisible();
  const r = await axe(page);
  expect(r).toEqual([]);
  expect(errores).toEqual([]);
});

test('perfil municipal (otro municipio): Exportar sin tira de pestañas y sin Rutas', async ({ page }) => {
  const errores = await preparar(page, { rol: 'MUNICIPAL', conReq: true, muni: 'HUIMILPAN' });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await expect(page.locator('#tarjetaResponsables')).toBeHidden();
  await page.click('#btnAbrirExportar');
  await expect(page.locator('#peTabs')).toBeHidden();
  await expect(page.locator('#seccionMunis')).toBeVisible();
  await expect(page.locator('#tabExpRutas')).toBeHidden();
  expect(errores).toEqual([]);
});
