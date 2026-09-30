// Concentrado Jurisdiccional guiado (biovac_jurisdiccion.html) con un Supabase simulado
// (tests/fixtures/fake-juris.js): cierre por municipio con puntos de avance,
// validaciones agrupadas que llevan al lote, filtros del concentrado y el
// informe con su lista de verificación.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-juris.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|ResizeObserver|DevTools/i;

async function abrir(page, rol) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 240)); });
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol || 'JURISDICCIONAL');
  await page.goto('/biovac_jurisdiccion.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockJuris', { state: 'visible', timeout: 15000 });
  // Octubre 2026: ya se suma por unidad (CLUES).
  await page.selectOption('#selAnio', '2026');
  await page.selectOption('#selMes', '10');
  await expect(page.locator('#pildoraJ1')).toHaveText('2/4');
  return errores;
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('Jurisdicción: concentrado guiado por municipio en 4 pasos', async ({ page }) => {
  const errores = await abrir(page);

  // --- Paso 1: municipios (las unidades solo se consultan) --------------------
  await expect(page.locator('#rutaJuris .ruta-paso')).toHaveCount(4);
  await expect(page.locator('#estadoUnidades .jur-muni')).toHaveCount(4);             // Querétaro, Corregidora, NHG, HENM
  await expect(page.locator('#estadoUnidades .pt')).toHaveCount(0);                   // sin puntos por unidad
  await expect(page.locator('#estadoUnidades details[open]')).toHaveCount(0);         // la lista de unidades viene plegada
  await expect(page.locator('#pildoraJ1')).toHaveText('2/4');                          // NHG y HENM ya cerraron completos
  await expect(page.locator('#cierreResumen')).toContainText('2 de 4 cerrados');
  const qro = page.locator('#estadoUnidades .jur-muni').first();
  await expect(qro).toContainText('Querétaro');
  await expect(qro).toContainText('1 de 3 unidades cerraron su Movimiento');
  await expect(qro).toContainText('SINBA-SIS (consulta): 1 validados · 1 por validar · 1 sin enviar');
  await expect(page.locator('#estadoUnidades .jur-estado.ok')).toHaveCount(2);
  await expect(page.locator('#dockJTitulo')).toContainText('Paso 1 de 4');
  // Los hospitales tienen su SINBA-SIS en biovac.html; los municipios no llevan ese botón
  await expect(page.locator('#estadoUnidades a[href="biovac.html"]')).toHaveCount(0);

  // Antes del arranque por unidad, cuentan las filas de cada municipio y hospital (aquí 4 pseudo)
  await page.selectOption('#selMes', '9');
  await expect(page.locator('#pildoraJ1')).toHaveText('0/4');
  await page.selectOption('#selMes', '10');
  await expect(page.locator('#pildoraJ1')).toHaveText('2/4');

  // --- Paso 2: por revisar (qué pasa, quién lo resuelve, qué hacer) -------------
  await page.click('#btnSiguiente');
  await expect(page.locator('#panelPaso2')).toBeVisible();
  await expect(page.locator('.validacion-grupo')).toHaveCount(1);                       // solo el error; "sin cerrar" no es un aviso
  await expect(page.locator('.validacion-grupo.ERROR')).toContainText('VACUNA SRP · lote AB123');
  await expect(page.locator('.validacion-grupo.ERROR')).toContainText('Qué pasa');
  await expect(page.locator('.validacion-grupo.ERROR')).toContainText('existencia final del lote queda en -5');
  await expect(page.locator('.validacion-grupo.ERROR')).toContainText('Quién lo resuelve');
  await expect(page.locator('.validacion-grupo.ERROR')).toContainText('Querétaro');
  await expect(page.locator('.jur-pendientes')).toContainText('3 unidades sin cerrar');   // plegado, solo consulta
  await expect(page.locator('.jur-pendientes[open]')).toHaveCount(0);
  await expect(page.locator('#pildoraJ2')).toHaveText('1');

  // "Ver el lote": detalle por MUNICIPIO con la explicación a la vista
  await page.click('[data-action="ir-lote"]');
  await expect(page.locator('#panelPaso3')).toBeVisible();
  await expect(page.locator('#drilldownContenido .jur-callout')).toContainText('Se dieron de baja más frascos');
  const filasMuni = page.locator('#drilldownContenido table.jur-drill tbody tr');
  await expect(page.locator('#drilldownContenido tr.muni-resumen')).toHaveCount(1);       // Querétaro = suma de sus 2 unidades
  await expect(page.locator('#drilldownContenido tr.muni-resumen')).toContainText('Querétaro');
  await expect(page.locator('#drilldownContenido tr.muni-resumen .existencia-final')).toHaveText('1');   // -2 + 3
  await expect(page.locator('#drilldownContenido tr.sub-fila')).toHaveCount(2);
  await expect(page.locator('#drilldownContenido tr.sub-fila').first()).toBeHidden();      // las unidades vienen plegadas
  await expect(page.locator('#drilldownContenido')).not.toContainText('C.S. Dos');         // quien no reportó el lote no estorba
  await expect(page.locator('#drilldownContenido')).toContainText('1 unidad no reportó este lote');
  await page.click('#drilldownContenido [data-action="toggle-unidades"]');
  await expect(page.locator('#drilldownContenido tr.sub-fila').first()).toBeVisible();
  await expect(page.locator('#drilldownContenido tr.sub-fila').first()).toContainText('C.S. Alfa');
  expect(await filasMuni.count()).toBe(4);                                                  // resumen + 2 unidades + Corregidora
  await expect(page.locator('#chipsBio .jur-chip.activo')).toContainText('SRP');
  await expect(page.locator('table.concentrado tbody tr').filter({ hasText: 'HX001' })).toHaveCount(0);   // filtrado por biológico

  // Filtros del concentrado
  await page.click('#chipsBio [data-filtro-bio=""]');
  await page.click('#chipsBio [data-solo-alertas]');
  await expect(page.locator('table.concentrado tbody tr').filter({ hasText: 'AB124' })).toHaveCount(0);   // sin aviso
  await expect(page.locator('table.concentrado tbody tr').filter({ hasText: 'AB123' })).toHaveCount(1);   // existencia negativa
  await expect(page.locator('table.concentrado tbody tr').filter({ hasText: 'HX001' })).toHaveCount(1);   // provisional
  await page.click('#chipsBio [data-solo-alertas]');

  // --- Paso 4: informe ----------------------------------------------------------
  await page.click('#dockJTabs .hoja-tab[data-jpaso="4"]');
  await expect(page.locator('#checkInforme li')).toHaveCount(3);
  await expect(page.locator('#checkInforme li.ok')).toHaveCount(1);                          // solo "sin otros avisos"
  await expect(page.locator('#checkInforme li').first()).toContainText('2 de 4');
  await expect(page.locator('#btnGenerarInforme')).toBeVisible();
  await expect(page.locator('#btnSiguiente')).toBeHidden();
  await page.click('#btnGenerarInforme');
  await expect(page.locator('#modalTitulo')).toHaveText('Hay municipios sin cerrar');       // pregunta antes de generar sin todo cerrado
  await page.click('#modalBtnAceptar');
  await expect(page.locator('#listaInformes .informe-fila')).toHaveCount(1);
  await expect(page.locator('#pildoraJ4')).toHaveText('✓');
  await expect(page.locator('#btnExportarExcelJurisdiccional')).toBeVisible();
  await expect(page.locator('#btnVerPdfJurisdiccional')).toBeVisible();

  await page.click('#panelPaso4 [data-ayuda="jur_informe"]');
  await expect(page.locator('#ayudaOverlay.abierto')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(errores).toEqual([]);
});

test('Jurisdicción: el visualizador consulta pero no genera ni corrige', async ({ page }) => {
  const errores = await abrir(page, 'VISUALIZADOR_JURISDICCIONAL');
  await page.click('#dockJTabs .hoja-tab[data-jpaso="4"]');
  await expect(page.locator('#btnGenerarInforme')).toBeHidden();
  await page.click('#dockJTabs .hoja-tab[data-jpaso="3"]');
  await page.locator('table.concentrado [data-action="drilldown"]').first().click();
  await expect(page.locator('#drilldownContenido')).toContainText('Querétaro');
  await expect(page.locator('[data-action="abrir-correccion-mov"]')).toHaveCount(0);
  expect(errores).toEqual([]);
});
