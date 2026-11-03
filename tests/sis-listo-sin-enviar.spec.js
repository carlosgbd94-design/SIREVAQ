// SINBA-SIS: (1) la UNIDAD ve un aviso claro cuando su información está guardada y cuadra pero NO la ha enviado
// (guardar no es enviar); (2) el Seguimiento del municipal muestra el nombre de la persona que elaboró el SIS,
// no el usuario técnico (CLUES_NOMBRE) con el que entró la unidad.
// Página real (biovac.html) con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

// UNIDAD QTSSA000001 con su captura del mes en BORRADOR y el servidor diciendo si cuadra y si el envío está abierto.
async function prepararUnidad(page, { cuadra, envioAbierto }) {
  await page.evaluate(async ({ cuadra, envioAbierto }) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: {}, ajustes: {}, capturado_por: 'MARIA LOPEZ RUIZ' });
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n === 'sis06p_comparativo') return { data: [{ clues: 'QTSSA000001', etiqueta: 'BCG', paloteo: 10, aplicado: cuadra ? 10 : 7, coincide: cuadra }], error: null };
        if (n === 'sis06p_ventana_envio') return { data: [{ dentro_prellenado: true, dentro_envio: envioAbierto, inicio_prellenado: '2026-09-23', inicio_envio: '2026-09-30', fin_envio: '2026-10-07' }], error: null };
        return t.rpc(n, a);
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
    document.getElementById('selUsuario').value = 'MARIA LOPEZ RUIZ';
    SIS06PBiovac.actualizarDock();
  }, { cuadra, envioAbierto });
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('UNIDAD: guardado y cuadrado pero sin enviar -> aviso fuerte con «Enviar ahora» y el botón de la barra late', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { cuadra: true, envioAbierto: true });
  const aviso = page.locator('#sisListoEnviar');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('NO lo has enviado');
  await expect(aviso).toContainText('Guardar no es enviar');
  await expect(aviso.locator('[data-enviar-ahora]')).toBeVisible();
  await expect(page.locator('#dockEstadoDetalle')).toContainText('falta ENVIAR');
  await expect(page.locator('#btnEnviarSIS06P')).toHaveClass(/dock-pulso/);
});

test('UNIDAD: cuadra y está guardado pero el envío aún no abre -> aviso tranquilo, sin botón', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { cuadra: true, envioAbierto: false });
  const aviso = page.locator('#sisListoEnviar');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('guardar no es enviar');
  await expect(aviso.locator('[data-enviar-ahora]')).toHaveCount(0);
  await expect(page.locator('#btnEnviarSIS06P')).not.toHaveClass(/dock-pulso/);
});

test('UNIDAD: si no cuadra el paloteo con el Movimiento, no se anuncia como listo', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { cuadra: false, envioAbierto: true });
  await expect(page.locator('#sisListoEnviar')).toBeHidden();
  await expect(page.locator('#sisAlertaDiferencias')).toBeVisible();
});

const FILAS_SEG = `[
  { clues: 'QTSSA003595', unidad: 'U 1', municipio: 'QUERETARO', estado: 'ENVIADO', enviado_en: '2026-11-02T10:00:00Z', paloteo_dosis: 5, movimiento_lotes: 1, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0, capturado_por: 'ANA PEREZ LOPEZ', enviado_por: 'QTSSA003595_UMME_SAN_PEDRITO' },
  { clues: 'QTSSA003596', unidad: 'U 2', municipio: 'QUERETARO', estado: 'ENVIADO', enviado_en: '2026-11-02T10:00:00Z', paloteo_dosis: 5, movimiento_lotes: 1, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0, capturado_por: null, enviado_por: 'QTSSA003596_LA_GOTERA' },
  { clues: 'QTSSA003597', unidad: 'U 3', municipio: 'QUERETARO', estado: 'ENVIADO', enviado_en: '2026-11-02T10:00:00Z', paloteo_dosis: 5, movimiento_lotes: 1, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0, capturado_por: 'QTSSA003597_X_Y', enviado_por: 'Luis Gómez' }
]`;

async function pintarSeguimiento(page) {
  await page.evaluate(async (filas) => {
    const real = estado.db;
    const datos = eval(filas);
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => (n === 'sis06p_resumen_seguimiento' ? { data: datos, error: null } : t.rpc(n, a));
      return t[p];
    } });
    await SIS06PDashboard.render();
  }, FILAS_SEG);
}

for (const [rol, contenedor] of [['ADMIN', '#seguimientoTbody'], ['MUNICIPAL', '#munEnvios']]) {
  test(`Seguimiento (${rol}): «Enviado por» muestra a la persona (responsable), no el usuario técnico de la unidad`, async ({ page }) => {
    await abrir(page, rol);
    await pintarSeguimiento(page);
    const cuerpo = page.locator(contenedor);
    await expect(cuerpo).toContainText('Enviado por ANA PEREZ LOPEZ');
    await expect(cuerpo).toContainText('Enviado por responsable sin nombre');
    await expect(cuerpo).toContainText('Enviado por Luis Gómez');
    await expect(cuerpo).not.toContainText('UMME_SAN_PEDRITO');
    await expect(cuerpo).not.toContainText('LA_GOTERA');
  });
}

test('Seguimiento (ADMIN): orden Corregidora, Huimilpan, Marqués, hospitales, Querétaro y por CLUES dentro de cada uno', async ({ page }) => {
  await abrir(page, 'ADMIN');
  await page.evaluate(async () => {
    const f = (clues, municipio) => ({ clues, unidad: clues, municipio, estado: 'ENVIADO', enviado_en: '2026-11-02T10:00:00Z', paloteo_dosis: 1, movimiento_lotes: 1, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0, capturado_por: 'ANA PEREZ', enviado_por: 'x' });
    const datos = [f('QTSSA000003', 'QUERETARO'), f('QTSSA002901', 'NHG'), f('QTSSA000900', 'MARQUES'), f('QTSSA000953', 'HUIMILPAN'), f('QTSSA000854', 'CORREGIDORA'), f('QTSSA000830', 'CORREGIDORA')];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) { if (p === 'rpc') return async (n, a) => (n === 'sis06p_resumen_seguimiento' ? { data: datos, error: null } : t.rpc(n, a)); return t[p]; } });
    await SIS06PDashboard.render();
  });
  const claves = await page.locator('#seguimientoTbody tr td:nth-child(2)').allTextContents();
  expect(claves.map((c) => c.trim())).toEqual(['QTSSA000830', 'QTSSA000854', 'QTSSA000953', 'QTSSA000900', 'QTSSA002901', 'QTSSA000003']);
});

test('Responsable: una sola palabra o el usuario técnico no cuentan como nombre para enviar', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { cuadra: true, envioAbierto: true });
  const r = await page.evaluate(() => {
    estado.perfil.usuario = 'QTSSA000001_C_S_ALFA';
    const inp = document.getElementById('selUsuario');
    const sal = {};
    inp.value = 'Maria'; sal.una = responsableElaboracion();
    inp.value = 'QTSSA000001_C_S_ALFA'; sal.tecnico = responsableElaboracion();
    inp.value = 'Maria Lopez'; sal.completo = responsableElaboracion();
    return sal;
  });
  expect(r).toEqual({ una: '', tecnico: '', completo: 'Maria Lopez' });
});

test('SIS-06-P: los totales de COVID-19 salen de los reportes semanales y no se pueden teclear en la hoja', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const r = await page.evaluate(async () => {
    const F = window.__FAKE;
    document.getElementById('selMes').value = '10';
    document.getElementById('selAnio').value = '2026';
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'Maria Lopez Ruiz' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push({ id: 'v1', activo: true, orden: 1, biologico: 'COVID-19', fila_excel: 105, clave_general: 'VCV38', grupo_poblacional: 'DE 6 A 59 MESES', dosis: 'PRIMERA' },
      { id: 'v2', activo: true, orden: 2, biologico: 'COVID-19', fila_excel: 109, clave_general: 'VCV16', grupo_poblacional: 'REFUERZO', dosis: '60 AÑOS Y MÁS' });
    F.tables.covid_capturas = [
      { id: 'c1', clues: 'QTSSA000001', fecha: '2026-10-23', anio_campana: 2026, valores: { MODERNA: { c1: 10, c4: 30 }, PFIZER: { c4: 5 } } },
      { id: 'c2', clues: 'QTSSA000001', fecha: '2026-10-30', anio_campana: 2026, valores: { MODERNA: { c1: 2, c4: 20 } } }
    ];
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes: 10, anio: 2026, estado: 'BORRADOR', valores: { 105: { total: 999 } }, ajustes: {} });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
    const t = (f) => document.getElementById('sisb_' + f + '_total');
    return { v105: t(105) && t(105).value, ro105: t(105) && t(105).readOnly, v109: t(109) && t(109).value, ro109: t(109) && t(109).readOnly };
  });
  expect(r).toEqual({ v105: '12', ro105: true, v109: '55', ro109: true });
  // fijar las casillas no cuenta como cambio de la persona: ni chip de «cambios sin guardar» ni aviso al salir
  await expect(page.locator('#sis06pChipSinGuardar')).toBeHidden();
});

test('SIS-06-P: la UNIDAD ve «Ir a mis reportes de COVID-19» y al pulsarlo se marca que viene del SIS', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(async () => {
    const F = window.__FAKE;
    document.getElementById('selMes').value = '10'; document.getElementById('selAnio').value = '2026';
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'Maria Lopez Ruiz' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push({ id: 'v1', activo: true, orden: 1, biologico: 'COVID-19', fila_excel: 105, clave_general: 'VCV38', grupo_poblacional: 'DE 6 A 59 MESES', dosis: 'PRIMERA' });
    F.tables.covid_capturas = [];
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes: 10, anio: 2026, estado: 'BORRADOR', valores: {}, ajustes: {} });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  });
  const btn = page.locator('[data-ir-covid]');
  await expect(btn).toHaveCount(1);
  await page.route(/index\.html\?captura=COVID/, (r) => r.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await Promise.all([page.waitForURL(/index\.html\?captura=COVID/), btn.evaluate((b) => b.click())]);
  expect(await page.evaluate(() => sessionStorage.getItem('sirevaq_desde_sis'))).toBe('1');
});

test('Municipal: si una lectura lenta de la unidad anterior termina al último, no pisa la unidad nueva (botón Validar y estado correctos)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const r = await page.evaluate(async () => {
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    const F = window.__FAKE;
    F.tables.sis_variables.length = 0;
    estado.unidadesClues = [
      { id: 'ua', clues: 'QTSSA00000A', nombre: 'Unidad A', municipio: 'QUERETARO' },
      { id: 'ub', clues: 'QTSSA00000B', nombre: 'Unidad B', municipio: 'QUERETARO' }];
    const sel = document.getElementById('selUnidadRevision');
    sel.innerHTML = '<option value="ua">A</option><option value="ub">B</option>';
    const caps = { 'QTSSA00000A': { id: 'ca', clues: 'QTSSA00000A', mes, anio, estado: 'VALIDADO', valores: {}, ajustes: {} }, 'QTSSA00000B': { id: 'cb', clues: 'QTSSA00000B', mes, anio, estado: 'ENVIADO', valores: {}, ajustes: {} } };
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'from') return (tabla) => {
        if (tabla !== 'sis06p_capturas') return t.from(tabla);
        return { select() { return { eq(_c, v) { return new Promise((res) => setTimeout(() => res({ data: [caps[v]], error: null }), v === 'QTSSA00000A' ? 700 : 30)); } }; } };
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    sel.value = 'ua';
    const pA = SIS06PBiovac.init();   // lenta
    sel.value = 'ub';
    const pB = SIS06PBiovac.init();   // rápida: es la que manda
    await Promise.all([pA, pB]);
    return { badge: document.getElementById('sis06pBadgeEstado').textContent, validar: getComputedStyle(document.getElementById('btnMarcarValidado')).display };
  });
  expect(r.badge.toLowerCase()).toContain('enviado');
  expect(r.validar).not.toBe('none');
});

test('Corrección de Movimiento: el resumen de cambios sale solo y en palabras sencillas', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  const frases = await page.evaluate(() => {
    estado.biologicos = [{ id: 'b1', clave: 'BCG', nombre_excel: 'BCG' }];
    const antes = { r1: { id: 'r1', biovac_lotes: { biologico_id: 'b1', numero_lote: 'L1' }, existencia_anterior_frascos: 1, aplicadas_a: 5 } };
    const despues = [{ id: 'r1', biovac_lotes: { biologico_id: 'b1', numero_lote: 'L1' }, existencia_anterior_frascos: 2, aplicadas_a: 5 }];
    return resumenCambiosCorreccion(antes, despues);
  });
  expect(frases).toEqual(['Se editó la existencia anterior de BCG (lote L1), de 1 a 2']);
});
