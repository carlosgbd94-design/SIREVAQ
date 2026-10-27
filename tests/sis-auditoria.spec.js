// Auditoría del SINBA-SIS (biovac.html) con el Supabase simulado de fake-biovac: accesibilidad automática (axe-core,
// WCAG 2.1 A/AA + buenas prácticas), ids repetidos y botones repetidos en cada vista y diálogo.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const FOTOS = process.env.SIS_FOTOS || '';   // carpeta opcional para guardar capturas al revisar a ojo

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.slice(0, 5).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  });
}
async function repetidos(page) {
  return page.evaluate(() => {
    const ids = {};
    document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    return Object.entries(ids).filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
  });
}

test.use({ viewport: { width: 1400, height: 1000 } });

async function revisar(page, informe, etiqueta) {
  await page.waitForTimeout(1000);   // las tarjetas entran con animación (hasta ~0.8 s): se mide con el color final
  if (FOTOS) await page.screenshot({ path: path.join(FOTOS, etiqueta.replace(/\W+/g, '_') + '.png'), fullPage: true });
  informe[etiqueta] = { axe: await axe(page), ids: await repetidos(page) };
}
function problemas(informe) {
  const p = {};
  for (const [k, v] of Object.entries(informe)) if (v.axe.length || v.ids.length) p[k] = v;
  return p;
}

test('AUDITORÍA SIS: vistas del municipal (seguimiento y movimiento) sin violaciones', async ({ page }) => {
  test.setTimeout(90000);
  await abrir(page, 'MUNICIPAL');
  const informe = {};
  await revisar(page, informe, 'municipal inicio');
  // Cada hoja del dock del cierre guiado (Envíos, Revisión, Concentrado, Entrega)
  const hojas = page.locator('.dock-hojas button:visible');
  const n = await hojas.count();
  for (let i = 0; i < n; i++) {
    await hojas.nth(i).click({ timeout: 5000 });
    await revisar(page, informe, 'municipal hoja ' + (i + 1));
  }
  expect(problemas(informe)).toEqual({});
});

test('AUDITORÍA SIS: vista de la unidad (paloteo) y diálogo de envío sin violaciones', async ({ page }) => {
  test.setTimeout(90000);
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push(
      { id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', orden: 1, activo: true },
      { id: 2, fila_excel: 12, biologico: 'BCG', grupo_poblacional: '29 días a 11 meses', dosis: 'ÚNICA', edad: null, clave_general: 'VBC02', orden: 2, activo: true }
    );
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: { 11: { total: 5 } }, ajustes: {}, updated_at: new Date().toISOString() });
  });
  await page.evaluate(async () => { document.getElementById('panelSIS06P').style.display = 'block'; await SIS06PBiovac.init(); });
  const informe = {};
  await revisar(page, informe, 'unidad paloteo');
  expect(problemas(informe)).toEqual({});
});

// Teléfono (390 px): sin desborde horizontal y sin violaciones, en el cierre del municipal y en la vista de la unidad.
test.describe('SIS en teléfono', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  test('AUDITORÍA SIS móvil: municipal y unidad sin desborde ni violaciones', async ({ page }) => {
    test.setTimeout(90000);
    await abrir(page, 'MUNICIPAL');
    const informe = {};
    await revisar(page, informe, 'movil municipal');
    const desborde = async () => page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth + 1, anchos: [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > innerWidth + 2 && !e.closest('.tabla-wrap, [style*="overflow-x"], .tbl-scroll, .mun-chips, .inf-chips')).map((e) => (e.id || e.className || e.tagName).toString().slice(0, 40)).slice(0, 8) }));
    const d1 = await desborde();
    await page.evaluate(() => {
      const F = window.__FAKE; const mes = Number(document.getElementById('selMes').value); const anio = Number(document.getElementById('selAnio').value);
      estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
      F.tables.sis_variables.length = 0;
      F.tables.sis_variables.push({ id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', orden: 1, activo: true });
      F.tables.sis06p_capturas.length = 0;
      F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: { 11: { total: 5 } }, ajustes: {}, updated_at: new Date().toISOString() });
    });
    await page.evaluate(async () => { document.getElementById('panelSIS06P').style.display = 'block'; await SIS06PBiovac.init(); });
    await revisar(page, informe, 'movil unidad');
    const d2 = await desborde();
    expect({ municipal: d1, unidad: d2 }).toEqual({ municipal: { x: false, anchos: [] }, unidad: { x: false, anchos: [] } });
    expect(problemas(informe)).toEqual({});
  });
});

test('Mes con el que abre el SIS: la unidad pasa al mes en curso después de la ventana; municipal y jurisdicción siguen en el reportado', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const r = await page.evaluate(() => {
    const con = (rol, f) => { estado.perfil = { ...estado.perfil, rol }; return periodoActivo(f); };
    return {
      unidad26oct: con('UNIDAD', new Date(2026, 9, 26)),
      unidad5oct: con('UNIDAD', new Date(2026, 9, 5)),
      unidad7ene: con('UNIDAD', new Date(2026, 0, 7)),
      unidad8ene: con('UNIDAD', new Date(2026, 0, 8)),
      municipal26oct: con('MUNICIPAL', new Date(2026, 9, 26)),
      juris8oct: con('JURISDICCIONAL', new Date(2026, 9, 8))
    };
  });
  expect(r).toEqual({
    unidad26oct: { anio: 2026, mes: 10 },
    unidad5oct: { anio: 2026, mes: 9 },
    unidad7ene: { anio: 2025, mes: 12 },
    unidad8ene: { anio: 2026, mes: 1 },
    municipal26oct: { anio: 2026, mes: 9 },
    juris8oct: { anio: 2026, mes: 9 }
  });
});

test('Movimiento del municipio: desglose por unidad de un lote (suma, requisición, ajuste manual) accesible y con acción para corregir en la unidad', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    estado.requisicionPorLote = new Map([['LC1', { numero_lote: 'LC1', requisicion: 30 }]]);
    const ren = { id: 'r1', categoria: 'NORMAL', recibido_frascos: 33, aplicadas_a: 10, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, biovac_lotes: { numero_lote: 'LC1' } };
    const aporte = [
      { clues: 'QTSSA000001', unidad: 'C.S. ALFA', estado: 'CERRADO', rec: 20, apl: 6, des: 0 },
      { clues: 'QTSSA000002', unidad: 'C.S. BETA', estado: 'CERRADO', rec: 10, apl: 4, des: 0 },
      { clues: 'QTSSA000003', unidad: 'C.S. GAMMA', estado: 'BORRADOR', rec: 5, apl: 0, des: 0 }
    ];
    const host = document.createElement('div'); host.id = 'prueba';
    host.innerHTML = '<table><tbody>' + filaPorUnidadHtml(ren, aporte, 9) + '</tbody></table>';
    document.body.appendChild(host);
    host.querySelector('tr').hidden = false;
    const a = await window.axe.run('#prueba', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    return { texto: host.innerText.replace(/\s+/g, ' '), botones: host.querySelectorAll('[data-action="corregir-en-unidad"]').length, violaciones: a.violations.map((v) => v.id) };
  });
  expect(r.violaciones).toEqual([]);
  expect(r.botones).toBe(3);
  expect(r.texto).toContain('Suma de unidades enviadas 30');      // solo suman las que ya enviaron
  expect(r.texto).toContain('Aún no suma');                         // la que no ha enviado se avisa
  expect(r.texto).toContain('La requisición asignó 30');            // comparación contra la requisición
  expect(r.texto).toContain('no cuadra');                           // 30 de la requisición vs 35 capturados por las unidades
  expect(r.texto).toContain('ajuste manual');                       // municipio 33 vs 30 de las unidades enviadas
});

test('Aviso de biológico caducado: solo cuenta existencia NORMAL; lo que ya está en A.R.F. o canje no se vuelve a avisar', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const html = await page.evaluate(() => {
    const hoy = new Date();
    estado.movimiento = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, estado: 'BORRADOR' };
    const esteMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    estado.biologicos = [{ id: 'b1', nombre_excel: 'BCG' }];
    const ren = (categoria, lote, cad, fin) => ({ categoria, existencia_final_frascos: fin, biovac_lotes: { numero_lote: lote, caducidad: cad, biologico_id: 'b1' } });
    estado.renglones = [ren('NORMAL', 'LOTE-NORMAL', '2025-06-01', 4), ren('CANJE', 'LOTE-CANJE', '2025-06-01', 10), ren('ARF', 'LOTE-ARF', '2023-08-01', 2), ren('NORMAL', 'LOTE-SANO', '2028-01-01', 9), ren('NORMAL', 'LOTE-MES', esteMes, 3)];
    return avisoCaducidadMovimiento();
  });
  expect(html).toContain('LOTE-NORMAL');
  expect(html).not.toContain('LOTE-CANJE');
  expect(html).not.toContain('LOTE-ARF');
  expect(html).not.toContain('LOTE-SANO');
  // El que caduca este mismo mes sale aparte: todavía no está caducado hoy, pero no puede cerrar el mes con existencia
  expect(html).toContain('LOTE-MES');
  expect(html).toContain('caduca al terminar este mes');
});

test('Recibido de la unidad: desde octubre es solo de Requisiciones (la unidad no lo captura); antes de octubre y para los revisores no cambia', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const r = await page.evaluate(() => {
    const con = (rol, anio, mes) => { estado.perfil = { ...estado.perfil, rol }; estado.movimiento = { anio, mes, estado: 'BORRADOR' }; return recibidoSoloDeRequisicion(); };
    return { unidadOct: con('UNIDAD', 2026, 10), unidadSep: con('UNIDAD', 2026, 9), municipalOct: con('MUNICIPAL', 2026, 10), adminOct: con('ADMIN', 2026, 10), unidadNov: con('UNIDAD', 2026, 11) };
  });
  expect(r).toEqual({ unidadOct: true, unidadSep: false, municipalOct: false, adminOct: false, unidadNov: true });
});

test('Agregar lote de la unidad (con recibido de Requisiciones): primer mes solo existencia anterior; después no hay nada que agregar; hospitales también heredan', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const r = await page.evaluate(() => {
    estado.unidades = [{ id: 'u1', clues: 'QTSSA000001', municipio: 'QUERETARO' }, { id: 'h1', clues: 'QTSSA001740', municipio: 'HENM' }];
    const bio = { id: 'b1', nombre_excel: 'BCG\nfrasco multidosis' };
    estado.perfil = { ...estado.perfil, rol: 'UNIDAD' };
    estado.movimiento = { anio: 2026, mes: 10, unidad_id: 'u1', estado: 'BORRADOR' };
    estado.anteriorEditable = true;
    const primerMes = renderPanelAgregar(bio);
    estado.anteriorEditable = false;
    const despues = renderPanelAgregar(bio);
    estado.movimiento = { anio: 2026, mes: 9, unidad_id: 'u1', estado: 'BORRADOR' };   // mes de prueba: sigue el flujo anterior
    estado.anteriorEditable = true;
    const septiembre = renderPanelAgregar(bio);
    estado.movimiento = { anio: 2026, mes: 10, unidad_id: 'h1', estado: 'BORRADOR' };
    estado.perfil = { ...estado.perfil, rol: 'JURISDICCIONAL' };
    const hospitalJuris = recibidoSoloDeRequisicion();
    estado.movimiento = { anio: 2026, mes: 10, unidad_id: 'u1', estado: 'BORRADOR' };
    const unidadJuris = recibidoSoloDeRequisicion();   // la Jurisdicción no bloquea el recibido de una unidad común
    return { primerMes, despues, septiembre, hospitalJuris, unidadJuris };
  });
  expect(r.primerMes).toContain('Agregar un lote que ya tenías');
  expect(r.primerMes).toContain('Cuántos frascos tenías');
  expect(r.primerMes).not.toContain('Tipo de cantidad');
  expect(r.primerMes).not.toContain('Recibido este mes');
  expect(r.despues).toContain('llegan <b>solos</b> desde Requisiciones');
  expect(r.despues).not.toContain('data-panel-agregar');
  expect(r.septiembre).toContain('Tipo de cantidad');               // antes del arranque nada cambia
  expect(r.hospitalJuris).toBe(true);
  expect(r.unidadJuris).toBe(false);
});

test('Mover existencia: panel accesible con destinos según el estatus (un lote caducado no vuelve a Normal) y aviso de candado descartable', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const normal = panelMoverHtml({ id: 'r1', categoria: 'NORMAL' }, 10, false);
    const arf = panelMoverHtml({ id: 'r2', categoria: 'ARF' }, 5, false);
    const arfCaducado = panelMoverHtml({ id: 'r3', categoria: 'ARF' }, 5, true);
    const canje = panelMoverHtml({ id: 'r4', categoria: 'CANJE' }, 3, false);
    const host = document.createElement('div'); host.id = 'pm'; host.innerHTML = normal + arf; document.body.appendChild(host);
    host.querySelectorAll('.panel-resolver').forEach((p) => p.classList.add('abierto'));
    const a = await window.axe.run('#pm', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    const op = (h) => [...h.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    return { normal: op(normal), arf: op(arf), arfCaducado: op(arfCaducado), canje: op(canje), violaciones: a.violations.map((v) => v.id) };
  });
  expect(r.normal).toEqual(['ARF', 'CANJE']);
  expect(r.arf).toEqual(['NORMAL', 'CANJE']);
  expect(r.arfCaducado).toEqual(['CANJE']);
  expect(r.canje).toEqual(['NORMAL', 'ARF']);
  expect(r.violaciones).toEqual([]);
});
