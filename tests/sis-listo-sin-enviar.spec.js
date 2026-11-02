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
