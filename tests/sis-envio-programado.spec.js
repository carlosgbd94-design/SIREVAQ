// SINBA-SIS: «Cerrar y programar envío».
//  - UNIDAD: antes de que abra la ventana de envío puede cerrar y programar; queda congelada y puede cancelar.
//  - MUNICIPAL: ve quién programó (y cuántos días antes del fin de mes), filtra por «Envío programado» y puede revocar con motivo.
// Página real (biovac.html) con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|ResizeObserver|DevTools|posthog/i;

async function abrir(page, rol) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 240)); });
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector(rol === 'UNIDAD' ? '#campoPeriodo' : '#dockPasosMun', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1500);
  return errores;
}

test.use({ viewport: { width: 1400, height: 1000 } });

// UNIDAD con su captura del mes en BORRADOR y la ventana de envío CERRADA (todavía se está prellenando).
// El servidor simulado hace lo que hacen las RPC reales: programar / desprogramar mueven las columnas.
async function prepararUnidad(page, { revocada = false } = {}) {
  await page.evaluate(async ({ revocada }) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'QTSSA000001_ALFA' };
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({
      id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: {}, ajustes: {},
      capturado_por: 'MARIA LOPEZ RUIZ', sin_movimiento: true, envio_programado_en: null, envio_programado_para: null,
      programacion_revocada_en: revocada ? '2026-10-14T10:00:00Z' : null
    });
    F.tables.sis06p_programaciones = revocada
      ? [{ captura_id: 'c1', accion: 'REVOCADO', motivo: 'Aún no termina el mes, sigue vacunando hasta el último día', usuario: 'Municipal', rol: 'MUNICIPAL', created_at: '2026-10-14T10:00:00Z' }]
      : [];
    window.__rpcs = [];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        window.__rpcs.push([n, a]);
        const cap = F.tables.sis06p_capturas.find((c) => c.id === (a && a.p_captura_id));
        if (n === 'sis06p_comparativo') return { data: [], error: null };
        if (n === 'sis06p_ventana_envio') return { data: [{ dentro_prellenado: true, dentro_envio: false, inicio_prellenado: '2026-09-23', inicio_envio: '2026-09-30', fin_envio: '2026-10-07' }], error: null };
        if (n === 'sis06p_programar_envio') { Object.assign(cap, { envio_programado_en: new Date().toISOString(), envio_programado_para: '2026-09-30', envio_programado_dias_antes: 5 }); return { data: '2026-09-30', error: null }; }
        if (n === 'sis06p_desprogramar_envio') { Object.assign(cap, { envio_programado_en: null, envio_programado_para: null }); return { data: null, error: null }; }
        return t.rpc(n, a);
      };
      if (p === 'from') return (tabla) => {
        if (tabla === 'sis06p_programaciones') {
          const filas = F.tables.sis06p_programaciones || [];
          const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, then: (res, rej) => Promise.resolve({ data: filas, error: null }).then(res, rej) };
          return q;
        }
        return t.from(tabla);
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
    document.getElementById('selUsuario').value = 'MARIA LOPEZ RUIZ';
    SIS06PBiovac.actualizarDock();
  }, { revocada });
  await page.waitForTimeout(500);
}

test('Programar envío (unidad): antes de la ventana se ofrece «Programar», congela la captura y se puede cancelar', async ({ page }) => {
  const errores = await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page);

  // Antes de programar: Programar visible, Enviar apagado (fuera de ventana), sin aviso
  await expect(page.locator('#btnProgramarSIS06P')).toBeVisible();
  await expect(page.locator('#btnEnviarSIS06P')).toBeDisabled();
  await expect(page.locator('#btnCancelarProgSIS06P')).toBeHidden();
  await expect(page.locator('#sisProgramacion')).toBeHidden();

  // Programar: confirma con una advertencia clara y manda la RPC con el nombre de la persona (no el usuario técnico)
  await page.click('#btnProgramarSIS06P');
  await expect(page.locator('#modalTitulo')).toHaveText('Cerrar y programar el envío');
  await expect(page.locator('#modalMensaje')).toContainText('se cerrará AHORA');
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#sisProgramacion')).toBeVisible();
  await expect(page.locator('#sisProgramacion')).toContainText('Cerrado y programado');
  const llamada = await page.evaluate(() => window.__rpcs.find((r) => r[0] === 'sis06p_programar_envio'));
  expect(llamada[1].p_captura_id).toBe('c1');
  expect(llamada[1].p_usuario).toBe('MARIA LOPEZ RUIZ');

  // Congelada: ni Guardar, ni Enviar, ni Programar; solo Cancelar programación; el responsable queda fijo
  await expect(page.locator('#btnProgramarSIS06P')).toBeHidden();
  await expect(page.locator('#btnEnviarSIS06P')).toBeHidden();
  await expect(page.locator('#btnGuardarSIS06P')).toBeHidden();
  await expect(page.locator('#btnCancelarProgSIS06P')).toBeVisible();
  await expect(page.locator('#sis06pBadgeEstado')).toHaveText('Cerrado — envío programado');
  await expect(page.locator('#dockEstadoTitulo')).toHaveText('Programado');
  await expect(page.locator('#selUsuario')).toHaveJSProperty('readOnly', true);
  expect(await page.evaluate(() => estado.sis06pEstadoActual)).toBeDefined();
  expect(await page.locator('#sis06pCaptureGroupsContainer input:not([disabled]):not([readonly])').count()).toBe(0);

  // Cancelar: se reabre y vuelve a poder capturar
  await page.click('#btnCancelarProgSIS06P');
  await expect(page.locator('#modalTitulo')).toHaveText('Cancelar la programación');
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#sisProgramacion')).toBeHidden();
  await expect(page.locator('#btnProgramarSIS06P')).toBeVisible();
  await expect(page.locator('#btnGuardarSIS06P')).toBeVisible();
  await expect(page.locator('#btnCancelarProgSIS06P')).toBeHidden();
  expect(errores).toEqual([]);
});

test('Programar envío (unidad): si el municipal revocó, ve el motivo y ya no se ofrece programar de nuevo', async ({ page }) => {
  const errores = await abrir(page, 'MUNICIPAL');
  await prepararUnidad(page, { revocada: true });
  await expect(page.locator('#sisProgramacion')).toBeVisible();
  await expect(page.locator('#sisProgramacion')).toContainText('Tu municipal revocó el envío programado');
  await expect(page.locator('#sisProgramacion')).toContainText('sigue vacunando hasta el último día.');
  await expect(page.locator('#btnProgramarSIS06P')).toBeHidden();      // el servidor tampoco lo permitiría hasta que abra el envío
  await expect(page.locator('#btnGuardarSIS06P')).toBeVisible();       // sigue capturando
});

test('Programar envío (municipal): ve quién programó y cuántos días antes, filtra y revoca con motivo', async ({ page }) => {
  const errores = await abrir(page, 'MUNICIPAL');
  // Beta (borrador) cerró 5 días antes del fin de mes y programó el envío
  await page.evaluate(() => {
    const F = window.__FAKE;
    const cap = F.tables.sis06p_capturas.find((c) => c.clues === 'QTSSA000002');
    Object.assign(cap, { envio_programado_en: '2026-09-25T15:00:00Z', envio_programado_para: '2026-09-30', envio_programado_por: 'Ana', envio_programado_dias_antes: 5 });
    window.__revocadas = [];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n === 'sis06p_revocar_programacion') {
          window.__revocadas.push(a);
          Object.assign(cap, { envio_programado_en: null, envio_programado_para: null, programacion_revocada_en: new Date().toISOString() });
          return { data: null, error: null };
        }
        return t.rpc(n, a);
      };
      return t[p];
    } });
  });
  await page.evaluate(() => SIS06PDashboard.cargarFilas(Number(document.getElementById('selMes').value), Number(document.getElementById('selAnio').value)).then((f) => window.__sis06pUltimasFilas = f));
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="2"]');
  await page.click('#dockPasosMun .hoja-tab[data-mpaso="1"]');

  const beta = page.locator('#munEnvios .mun-unidad[data-clues="QTSSA000002"]');
  await expect(beta.locator('.mun-pill.aviso')).toContainText('Programó envío · 5 d antes');
  await expect(beta).toContainText('Cerró y programó su envío');
  await expect(beta).toContainText('5 días antes del fin de mes');
  // Las demás no llevan la insignia
  await expect(page.locator('#munEnvios .mun-unidad[data-clues="QTSSA000001"]')).not.toContainText('Programó envío');

  // La única unidad sin enviar ya programó: no se le «recuerda» (se enviará sola), así que no hay mensaje de pendientes
  await expect(page.locator('#munCopiarPendientes')).toHaveCount(0);

  // Filtro «Envío programado»
  await page.click('.mun-chip[data-filtro="PROG"]');
  await expect(page.locator('#munEnvios .mun-unidad')).toHaveCount(1);

  // Revocar: pide motivo (mínimo 15 caracteres) y la unidad vuelve a quedar sin programación
  await beta.click();
  await expect(page.locator('#munRevocarProg')).toBeVisible();
  await page.click('#munRevocarProg');
  await expect(page.locator('#modalTitulo')).toHaveText('Revocar el envío programado');
  await page.fill('#modalInputMotivo', 'corto');
  await page.click('#modalBtnAceptar');
  expect(await page.evaluate(() => window.__revocadas.length)).toBe(0);            // motivo corto: no manda nada
  if (await page.locator('#modalOverlay.abierto').count()) {
    await page.fill('#modalInputMotivo', 'Aún no termina el mes, sigue vacunando');
    await page.click('#modalBtnAceptar');
  } else {
    await page.click('#munRevocarProg');
    await page.fill('#modalInputMotivo', 'Aún no termina el mes, sigue vacunando');
    await page.click('#modalBtnAceptar');
  }
  await expect.poll(() => page.evaluate(() => window.__revocadas.length)).toBe(1);
  const r = await page.evaluate(() => window.__revocadas[0]);
  expect(r.p_motivo).toBe('Aún no termina el mes, sigue vacunando');
  expect(r.p_captura_id).toBeTruthy();
  await expect(page.locator('#munRevocarProg')).toBeHidden();
  await page.click('#munVolverLista');
  await expect(page.locator('#munCopiarPendientes')).toHaveCount(1);       // ya sin programar vuelve a ser una pendiente
  expect(errores).toEqual([]);
});
