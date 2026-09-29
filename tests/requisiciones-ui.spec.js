// Requisiciones (requisiciones.html) de punta a punta con un Supabase simulado en
// memoria (tests/fixtures/fake-supabase.js), que emula también los triggers de
// validación de Postgres. Cubre: crear la requisición, captura rápida con
// teclado, pegado desde Excel, matrices de los pasos 2 y 3 (teclado, doble
// clic, pegado de bloques, validación), "Sugerir según el mes anterior",
// puntos de avance y ayuda contextual.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-supabase.js'), 'utf8');
const RUIDO = /sentry|favicon|Failed to load resource|net::ERR|ERR_BLOCKED|Manifest|preload|fonts\.g|googleapis|unpkg|gstatic|cdn|ResizeObserver|DevTools/i;

async function preparar(page, opciones = {}) {
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
  await page.addInitScript((o) => { window.__FAKE_ROL__ = o.rol; window.__FAKE_CON_REQ__ = !!o.conReq; }, { rol: opciones.rol || 'ADMIN', conReq: opciones.conReq });
  await page.goto('/requisiciones.html', { waitUntil: 'load' });
  return errores;
}

const db = (page, expr) => page.evaluate(`(() => { const db = window.__FAKE_DB__; return ${expr}; })()`);
const loteId = (page, numero) => db(page, `db.requi_lotes.find((l) => l.numero_lote === '${numero}').id`);

async function pegar(page, selector, texto) {
  await page.evaluate(([sel, t]) => {
    const el = document.querySelector(sel);
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [selector, texto]);
}

const celda2 = (loteid, destino) => `#matrizMunicipio input.celda[data-municipio="${destino}"][data-lote="${loteid}"]`;
const celda3 = (loteid, unidad) => `#matrizUnidad input.celda[data-unidad="${unidad}"][data-lote="${loteid}"]`;

test.use({ viewport: { width: 1400, height: 900 } });

test('Requisiciones: flujo completo por pasos (captura rápida, pegado, matrices, sugerencia, avance)', async ({ page }) => {
  const errores = await preparar(page);

  // --- Sin requisición del mes: una sola acción clara -------------------------
  await expect(page.locator('#tarjetaSinRequisicion')).toBeVisible();
  await expect(page.locator('#tituloSinRequisicion')).toContainText('Todavía no hay requisición de');
  await page.click('#btnCrearRequisicion');
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await expect(page.locator('#tarjetaSinRequisicion')).toBeHidden();
  await expect(page.locator('#stepper .st-nodo')).toHaveCount(3);

  // --- Paso 1: captura rápida solo con teclado -------------------------------
  await expect(page.locator('#rapLote')).toBeDisabled();           // sin biológico elegido
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await expect(page.locator('#rapLote')).toBeFocused();
  await page.keyboard.type('AB123');
  await page.keyboard.press('Enter');
  await expect(page.locator('#rapCad')).toBeFocused();
  await page.keyboard.type('0227');
  await page.keyboard.press('Enter');
  await expect(page.locator('#rapCant')).toBeFocused();
  await expect(page.locator('#rapCad')).toHaveValue('FEB-27');     // 0227 -> FEB-27
  await page.keyboard.type('1000');
  await page.keyboard.press('Enter');
  await expect(page.locator('#tbodyBiologicos')).toContainText('AB123');
  await expect(page.locator('#rapLote')).toBeFocused();            // listo para el siguiente lote

  await page.keyboard.type('AB124');
  await page.keyboard.press('Enter');
  await page.keyboard.type('mar-27');
  await page.keyboard.press('Enter');
  await page.keyboard.type('500');
  await page.keyboard.press('Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(2);

  // Lote ya conocido: trae su caducidad y salta directo a la cantidad
  await page.fill('#rapLote', 'AB123');
  await expect(page.locator('#rapCad')).toHaveValue('FEB-27');
  await expect(page.locator('#rapNota')).toContainText('Ya capturado');
  await page.press('#rapLote', 'Enter');
  await expect(page.locator('#rapCant')).toBeFocused();
  await page.fill('#rapLote', '');

  // --- Paso 1: pegar desde Excel ----------------------------------------------
  await page.click('#btnPegarSurtido');
  await page.fill('#pegarTexto', ['HEXAVALENTE\tHX001\tMAR-27\t400', 'TD\tTD77\t04/27\t100', 'XYZ\tQQ99\t\t10', 'SRP\tAB123\t\t1000'].join('\n'));
  await expect(page.locator('#pegarVista tbody tr')).toHaveCount(4);
  await expect(page.locator('#pegarVista')).toContainText('Reemplaza 1000');
  await expect(page.locator('#pegarResumen')).toContainText('3 lotes por importar');
  await page.selectOption('#pegarVista select[data-pegar-bio]', 'bio-td');   // asignar el que no se reconoció
  await expect(page.locator('#pegarResumen')).toContainText('4 lotes por importar');
  await page.click('#pegarImportar');
  await expect(page.locator('#modalPegar')).toBeHidden();
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(5);
  await expect(page.locator('#pildoraPaso1')).toHaveText('5');

  // --- Paso 2: matriz de reparto ---------------------------------------------
  await page.click('.paso-tab[data-paso="2"]');
  await expect(page.locator('#matrizMunicipio tbody tr')).toHaveCount(5);
  const l123 = await loteId(page, 'AB123');
  const l124 = await loteId(page, 'AB124');
  const lHX = await loteId(page, 'HX001');

  await page.fill(celda2(l123, 'CORREGIDORA'), '600');
  await page.press(celda2(l123, 'CORREGIDORA'), 'Enter');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.filter((d) => d.lote_id === '${l123}').map((d) => d.cantidad)`)).toEqual([600]);

  // Excede lo surtido: se rechaza sin ir al servidor y la celda vuelve a como estaba
  await page.fill(celda2(l123, 'QUERETARO'), '500');
  await page.press(celda2(l123, 'QUERETARO'), 'Tab');
  await expect(page.locator('#toast')).toContainText('Excede lo surtido');
  await expect(page.locator(celda2(l123, 'QUERETARO'))).toHaveValue('');

  // Doble clic en celda vacía = todo el saldo
  await page.dblclick(celda2(l123, 'MARQUES'));
  await expect(page.locator(celda2(l123, 'MARQUES'))).toHaveValue('400');
  await expect(page.locator(`#matrizMunicipio tr[data-key$="::${l123}"]`)).toHaveClass(/completo/);

  // Pegar un bloque de Excel desde una celda
  await pegar(page, celda2(l124, 'CORREGIDORA'), '100\t50\t25');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.filter((d) => d.lote_id === '${l124}').map((d) => d.cantidad).sort((a, b) => a - b)`)).toEqual([25, 50, 100]);

  // Subir una celda ya guardada cerca del tope (el upsert por id no cuenta dos veces lo anterior)
  await page.fill(celda2(l124, 'CORREGIDORA'), '400');
  await page.press(celda2(l124, 'CORREGIDORA'), 'Tab');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.find((d) => d.lote_id === '${l124}' && d.municipio === 'CORREGIDORA').cantidad`)).toBe(400);

  // Sugerir según el mes anterior: solo lotes sin reparto y con antecedente (HEXAVALENTE 50/50)
  await page.click('#btnSugerir2');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.filter((d) => d.lote_id === '${lHX}').map((d) => d.municipio + ':' + d.cantidad).sort()`)).toEqual(['CORREGIDORA:200', 'QUERETARO:200']);
  expect(await db(page, "db.requi_distribucion_municipio.filter((d) => d.requi_biologico_id === 'bio-td' && d.requisicion_id !== 'req-prev').length")).toBe(0); // TD sin antecedente: no se toca

  // Filtro por biológico
  await page.click('#chipsFiltro2 .chip-bio[data-filtro="bio-td"]');
  await expect(page.locator('#matrizMunicipio tbody tr')).toHaveCount(2);
  await page.click('#chipsFiltro2 .chip-bio[data-filtro=""]');
  await expect(page.locator('#matrizMunicipio tbody tr')).toHaveCount(5);

  // Avance: 2 de 5 lotes completos (AB123 y HX001)
  await expect(page.locator('#pildoraPaso2')).toHaveText('2/5');
  await expect(page.locator('#avancePaso2 button.pt.completo')).toHaveCount(2);
  await expect(page.locator('#avancePaso2 button.pt.parcial')).toHaveCount(1);

  // --- Paso 3: matriz de unidades --------------------------------------------
  await page.click('.paso-tab[data-paso="3"]');
  await page.click('#chipsMunicipio .chip-bio[data-muni="CORREGIDORA"]');
  await expect(page.locator('#matrizUnidad thead th[data-col]')).toHaveCount(3);
  // Primero por municipio, luego por CLUES
  expect(await page.evaluate(() => estado.unidades.map((u) => u.id))).toEqual(['un-c1', 'un-c2', 'un-c3', 'un-q1', 'un-q2']);
  // Unidades por número de CLUES (no por nombre: alfabético saldría Dos, Tres, Uno)
  expect(await page.locator('#matrizUnidad tbody tr').evaluateAll((trs) => trs.map((t) => t.dataset.unidadFila))).toEqual(['un-c1', 'un-c2', 'un-c3']);
  // Biológicos en el orden del formato de requisición (columna `orden` del catálogo), no alfabético
  expect(await page.locator('#matrizUnidad thead th[data-col] b').allTextContents()).toEqual(['SRP', 'SRP', 'HEXAVALENTE']);

  await page.fill(celda3(l123, 'un-c1'), '400');
  await page.press(celda3(l123, 'un-c1'), 'Enter');
  await expect.poll(() => db(page, `db.requi_distribucion_unidad.filter((d) => d.lote_id === '${l123}').map((d) => d.cantidad)`)).toEqual([400]);

  await page.fill(celda3(l123, 'un-c2'), '300');                    // 400 + 300 > 600 asignados
  await page.press(celda3(l123, 'un-c2'), 'Tab');
  await expect(page.locator('#toast')).toContainText('Excede lo asignado');
  await page.dblclick(celda3(l123, 'un-c2'));                        // el saldo real: 200
  await expect(page.locator(celda3(l123, 'un-c2'))).toHaveValue('200');
  await expect(page.locator(`#matrizUnidad thead th[data-col$="::${l123}"] .saldo-chip`)).toHaveClass(/completo/);

  await pegar(page, celda3(l124, 'un-c1'), '100\n100\n50');          // desde la primera unidad (por CLUES) hacia abajo
  await expect.poll(() => db(page, `db.requi_distribucion_unidad.filter((d) => d.lote_id === '${l124}').map((d) => d.cantidad).sort((a, b) => a - b)`)).toEqual([50, 100, 100]);

  await page.click('#btnSugerir3');                                   // HX001: 30/10/0 del mes anterior -> 150/50/0
  await expect.poll(() => db(page, `db.requi_distribucion_unidad.filter((d) => d.lote_id === '${lHX}').map((d) => d.unidad_id + ':' + d.cantidad).sort()`)).toEqual(['un-c1:150', 'un-c2:50']);

  // Un municipio no puede bajar por debajo de lo que ya repartió a sus unidades (paso 2)
  await page.click('.paso-tab[data-paso="2"]');
  await page.fill(celda2(l123, 'CORREGIDORA'), '100');
  await page.press(celda2(l123, 'CORREGIDORA'), 'Tab');
  await expect(page.locator('#toast')).toContainText('ya repartió 600');
  await expect(page.locator(celda2(l123, 'CORREGIDORA'))).toHaveValue('600');

  // --- Avance general y ayuda -------------------------------------------------
  await expect(page.locator('#pildoraPaso3')).toHaveText('2/7');
  await expect(page.locator('#stepper .st-nodo.hecho')).toHaveCount(1);       // solo el paso 1 está completo
  await expect(page.locator('#dockEstadoTitulo')).toContainText('Paso 2 de 3');
  await page.click('#panelPaso2 [data-ayuda="requi2"]');
  await expect(page.locator('#ayudaOverlay.abierto')).toBeVisible();
  await expect(page.locator('#ayudaCuerpo')).toContainText('Doble clic');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ayudaOverlay.abierto')).toHaveCount(0);

  await page.click('#btnSiguiente');                                          // 2 -> 3
  await expect(page.locator('#panelPaso3')).toHaveClass(/activo/);
  await expect(page.locator('#btnSiguiente')).toBeHidden();

  expect(errores).toEqual([]);
});

test('Requisiciones: un rol de solo lectura ve los pasos pero sin captura', async ({ page }) => {
  const errores = await preparar(page, { rol: 'MUNICIPAL', conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-solo-lectura', '1');
  await expect(page.locator('#rapida')).toBeHidden();
  await expect(page.locator('#btnSugerir2')).toBeHidden();
  await expect(page.locator('#btnCerrarMes')).toBeHidden();
  expect(errores).toEqual([]);
});
