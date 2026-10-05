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
  // Los diálogos de confirmación son propios de SIREVAQ (no del navegador): por omisión se aceptan solos;
  // las pruebas que los revisan ponen window.__AUTO_CONFIRMAR__ = false.
  await page.addInitScript(() => {
    window.__AUTO_CONFIRMAR__ = true;
    setInterval(() => {
      const m = document.getElementById('modalConfirmar');
      if (window.__AUTO_CONFIRMAR__ && m && m.style.display === 'flex') document.getElementById('confirmarAceptar').click();
    }, 25);
  });
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
  if (opciones.libs) {   // ExcelJS y JSZip reales (de node_modules) en lugar del CDN, para probar exportaciones
    await page.route(/exceljs\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') }));
    await page.route(/jszip\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, '..', 'node_modules', 'jszip', 'dist', 'jszip.min.js') }));
  }
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
  await page.keyboard.type('150227');                               // se captura DD-MM-AA (la máscara pone los guiones)
  await expect(page.locator('#rapCad')).toHaveValue('15-02-27');
  await expect(page.locator('#rapCad ~ .cad-vista')).toHaveText('= FEB-27');   // y se muestra MMM-AA
  await expect(page.locator('#rapCant')).toBeFocused();            // con la fecha completa pasa sola a la cantidad
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
  expect(await db(page, "db.requi_lotes.find((l) => l.numero_lote === 'AB123').caducidad")).toBe('2027-02-15');
  await expect(page.locator('#tbodyBiologicos')).toContainText('FEB-27');   // en la tabla se ve MMM-AA

  // Lote ya conocido: trae su caducidad y salta directo a la cantidad
  await page.fill('#rapLote', 'AB123');
  await expect(page.locator('#rapCad')).toHaveValue('15-02-27');   // trae el día exacto que se capturó
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
  expect(await page.evaluate(() => estado.unidades.map((u) => u.id))).toEqual(['un-c1', 'un-c2', 'un-c3', 'un-q1', 'un-q2', 'un-nhg', 'un-henm']);   // los hospitales, al final
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
  await expect(page.locator('#pildoraPaso3')).toHaveText('2/4');   // solo cuentan destinos con unidades registradas (en el simulado: Corregidora y Querétaro)
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


test('Requisiciones: prellenar cantidades sin lote y repartirlas', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#btnPrellenar');
  await expect(page.locator('#modalCantidades')).toBeVisible();
  await expect(page.locator('#cantFilas tr')).toHaveCount(3);
  await expect(page.locator('#cantGuardar')).toBeDisabled();
  await page.locator('#cantFilas input').nth(0).fill('120');
  await page.locator('#cantFilas input').nth(1).fill('65');
  await expect(page.locator('#cantResumen')).toContainText('2 biológicos · 185 dosis');
  await page.click('#cantGuardar');
  await expect(page.locator('#modalCantidades')).toBeHidden();
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.filter((i) => i.requisicion_id === "req-hoy").length')).toBe(2);
  expect(await db(page, "db.requi_lotes.filter((l) => l.numero_lote === 'POR DEFINIR').length")).toBe(2);
  await expect(page.locator('#avisoPendientes')).toBeVisible();
  await expect(page.locator('#tbodyBiologicos')).toContainText('Lote por definir');

  // Ya se puede repartir sin tener lotes
  await page.click('.paso-tab[data-paso="2"]');
  await expect(page.locator('#matrizMunicipio tbody tr')).toHaveCount(2);
  const lote = await db(page, "db.requi_lotes.find((l) => l.numero_lote === 'POR DEFINIR' && l.requi_biologico_id === 'bio-srp').id");
  await page.fill(celda2(lote, 'CORREGIDORA'), '100');
  await page.press(celda2(lote, 'CORREGIDORA'), 'Enter');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.filter((d) => d.lote_id === '${lote}').map((d) => d.cantidad)`)).toEqual([100]);

  // Volver a prellenar reemplaza la cantidad (no duplica renglones)
  await page.click('.paso-tab[data-paso="1"]');
  await page.click('#btnPrellenar');
  await expect(page.locator('#cantFilas input').nth(0)).toHaveValue('120');
  await page.locator('#cantFilas input').nth(0).fill('130');
  await page.click('#cantGuardar');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.find((i) => i.requi_biologico_id === "bio-srp").cantidad_surtida')).toBe(130);
  expect(await db(page, 'db.requi_items_jurisdiccion.filter((i) => i.requisicion_id === "req-hoy").length')).toBe(2);
  expect(errores).toEqual([]);
});

test('Requisiciones: varias entregas en el mismo mes, cada una con su propio paso 1', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#barraEntregas')).toBeVisible();
  await expect(page.locator('#barraEntregas [data-entrega]')).toHaveCount(1);

  // Captura en la entrega 1
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'ESQ1');
  await page.fill('#rapCant', '200');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);

  // Llega otra entrega: se crea aparte y empieza vacía
  await page.click('#btnNuevaEntrega');
  await expect(page.locator('#modalTexto')).toBeVisible();              // diálogo propio, no el del navegador
  await expect(page.locator('#textoTitulo')).toHaveText('Nueva entrega 2');
  await page.click('#textoSugerencias [data-sug="Influenza"]');
  await expect(page.locator('#textoValor')).toHaveValue('Influenza');
  await page.click('#textoAceptar');
  await expect(page.locator('#modalTexto')).toBeHidden();
  await expect(page.locator('#barraEntregas [data-entrega]')).toHaveCount(2);
  await expect(page.locator('#barraEntregas [data-entrega="2"]')).toContainText('Influenza');
  await expect(page.locator('#barraEntregas [data-entrega="2"]')).toHaveClass(/activo/);
  expect(await db(page, 'db.requi_requisiciones.filter((r) => r.anio !== 2000).map((r) => r.entrega)')).toEqual([1, 2]);
  await expect(page.locator('#tbodyBiologicos')).not.toContainText('ESQ1');
  await page.click('#chipsBio .chip-bio[data-bio="bio-hexa"]');
  await page.fill('#rapLote', 'INF1');
  await page.fill('#rapCant', '50');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(2);
  expect(await db(page, 'db.requi_items_jurisdiccion.filter((i) => i.requisicion_id === "req-hoy").length')).toBe(1);

  // Cambiar de entrega recarga los datos de esa entrega
  await page.click('#barraEntregas [data-entrega="1"]');
  await expect(page.locator('#tbodyBiologicos')).toContainText('ESQ1');
  await expect(page.locator('#tbodyBiologicos')).not.toContainText('INF1');
  expect(errores).toEqual([]);
});


test('Requisiciones: asignar lotes (uno o varios) a cantidades prellenadas y el reparto se acomoda', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#btnPrellenar');
  await page.locator('#cantFilas input').nth(0).fill('65');         // SRP: 65 dosis sin lote
  await page.click('#cantGuardar');
  await expect(page.locator('#avisoPendientes')).toBeVisible();

  // Reparto previo: 40 a Corregidora, 25 a Querétaro (y 40 de Corregidora a una unidad)
  await page.click('.paso-tab[data-paso="2"]');
  const pend = await db(page, "db.requi_lotes.find((l) => l.numero_lote === 'POR DEFINIR').id");
  await page.fill(celda2(pend, 'CORREGIDORA'), '40');
  await page.press(celda2(pend, 'CORREGIDORA'), 'Enter');
  await page.fill(celda2(pend, 'QUERETARO'), '25');
  await page.press(celda2(pend, 'QUERETARO'), 'Enter');
  await expect.poll(() => db(page, 'db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").length')).toBe(2);
  await page.click('.paso-tab[data-paso="1"]');

  // Ventana de asignar: 2 lotes que suman 65 (el segundo renglón se llena con lo que falta)
  await page.click('#avisoPendientes .btn-asignar-lotes');
  await expect(page.locator('#modalAsignar')).toBeVisible();
  await expect(page.locator('#asigTitulo')).toContainText('Asignar lotes');
  await page.locator('#asigFilas input[data-campo="lote"]').first().fill('LOTE-A');
  await page.locator('#asigFilas input[data-campo="cad"]').first().fill('150729');
  await expect(page.locator('#asigFilas .cad-vista').first()).toHaveText('= JUL-29');
  await page.locator('#asigFilas input[data-campo="cant"]').first().fill('50');
  await expect(page.locator('#asigResumen')).toContainText('quedan 15 por definir');
  await page.click('#asigAgregar');
  await expect(page.locator('#asigFilas input[data-campo="cant"]').nth(1)).toHaveValue('15');
  await page.locator('#asigFilas input[data-campo="lote"]').nth(1).fill('LOTE-B');
  await expect(page.locator('#asigResumen')).toContainText('Suman 65 de 65');
  await page.click('#asigGuardar');
  await expect(page.locator('#modalAsignar')).toBeHidden();

  await expect(page.locator('#avisoPendientes')).toBeHidden();
  await expect(page.locator('#tbodyBiologicos')).toContainText('LOTE-A');
  await expect(page.locator('#tbodyBiologicos')).toContainText('LOTE-B');
  await expect(page.locator('#tbodyBiologicos')).not.toContainText('Lote por definir');
  await expect(page.locator('#tbodyBiologicos .cad-tip').first()).toHaveAttribute('title', /15 de julio de 2029/);
  const loteA = await loteId(page, 'LOTE-A');
  const loteB = await loteId(page, 'LOTE-B');
  // Corregidora (40) y 10 de Querétaro llenan el lote A (50); lo demás de Querétaro (15) va al B
  const rep = await db(page, `Object.fromEntries(db.requi_distribucion_municipio.filter((d) => d.requisicion_id === 'req-hoy').map((d) => [d.municipio + ':' + (d.lote_id === '${loteA}' ? 'A' : 'B'), d.cantidad]))`);
  expect(rep).toEqual({ 'CORREGIDORA:A': 40, 'QUERETARO:A': 10, 'QUERETARO:B': 15 });
  expect(await db(page, `db.requi_lotes.find((l) => l.id === '${loteA}').caducidad`)).toBe('2029-07-15');
  expect(errores).toEqual([]);
});

test('Requisiciones: cambiar el número de lote de un renglón con lote real y dividirlo', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'MAL-1');
  await page.fill('#rapCant', '100');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);
  await page.click('.paso-tab[data-paso="2"]');
  const viejo = await loteId(page, 'MAL-1');
  await page.fill(celda2(viejo, 'CORREGIDORA'), '100');
  await page.press(celda2(viejo, 'CORREGIDORA'), 'Enter');
  await expect.poll(() => db(page, 'db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").length')).toBe(1);
  await page.click('.paso-tab[data-paso="1"]');

  // 1) Cambiar el número de lote: una fila con toda la cantidad
  await page.click('.fila-lote-capturado .btn-asignar-lotes');
  await expect(page.locator('#asigTitulo')).toContainText('Cambiar o dividir lote');
  await expect(page.locator('#asigSub')).toContainText('MAL-1');
  await page.locator('#asigFilas input[data-campo="lote"]').first().fill('BIEN-1');
  await page.locator('#asigFilas input[data-campo="cad"]').first().fill('01-03-28');
  await page.click('#asigGuardar');
  await expect(page.locator('#modalAsignar')).toBeHidden();
  await expect(page.locator('#tbodyBiologicos')).toContainText('BIEN-1');
  await expect(page.locator('#tbodyBiologicos')).not.toContainText('MAL-1');
  const bien = await loteId(page, 'BIEN-1');
  expect(await db(page, 'db.requi_items_jurisdiccion.map((i) => i.lote_id + ":" + i.cantidad_surtida)')).toEqual([`${bien}:100`]);
  expect(await db(page, 'db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").map((d) => d.lote_id + ":" + d.municipio + ":" + d.cantidad)')).toEqual([`${bien}:CORREGIDORA:100`]);

  // 2) Dividirlo: 30 pasan a otro lote y 70 se quedan en el actual
  await page.click('.fila-lote-capturado .btn-asignar-lotes');
  await page.locator('#asigFilas input[data-campo="lote"]').first().fill('BIEN-2');
  await page.locator('#asigFilas input[data-campo="cant"]').first().fill('30');
  await expect(page.locator('#asigResumen')).toContainText('70 se quedan en BIEN-1');
  await page.click('#asigGuardar');
  await expect(page.locator('#modalAsignar')).toBeHidden();
  await expect(page.locator('#tbodyBiologicos')).toContainText('BIEN-2');
  expect(await db(page, 'db.requi_items_jurisdiccion.map((i) => i.cantidad_surtida).sort((a, b) => a - b)')).toEqual([30, 70]);
  expect(await db(page, 'db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").map((d) => d.cantidad).sort((a, b) => a - b)')).toEqual([30, 70]);

  // 3) Un lote que ya está capturado este mes no se puede usar como destino
  await page.click('.fila-lote-capturado .btn-asignar-lotes >> nth=0');
  await page.locator('#asigFilas input[data-campo="lote"]').first().fill('BIEN-2');
  await page.locator('#asigFilas input[data-campo="cant"]').first().fill('5');
  await page.click('#asigGuardar');
  await expect(page.locator('#toast')).toContainText('ya está capturado');
  expect(errores).toEqual([]);
});

test('Requisiciones: el biológico elegido se quita con Escape o con un clic fuera de la captura', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  const activo = page.locator('#chipsBio .chip-bio.activo');

  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await expect(activo).toHaveCount(1);
  await page.keyboard.press('Escape');                       // con el cursor en el campo Lote
  await expect(activo).toHaveCount(0);
  await expect(page.locator('#rapLote')).toBeDisabled();

  await page.click('#chipsBio .chip-bio[data-bio="bio-hexa"]');
  await expect(activo).toHaveCount(1);
  await page.click('#rapLote');                              // dentro de la captura: se mantiene
  await expect(activo).toHaveCount(1);
  await page.click('h1');                                    // fuera: se quita
  await expect(activo).toHaveCount(0);
  expect(errores).toEqual([]);
});


test('Requisiciones: la caducidad se teclea con máscara DD-MM-AA y no admite más dígitos', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  const cad = page.locator('#rapCad');
  await cad.focus();
  await page.keyboard.type('31');
  await expect(cad).toHaveValue('31-');                      // salta solo al mes
  await page.keyboard.type('07');
  await expect(cad).toHaveValue('31-07-');
  await page.keyboard.type('29');
  await expect(cad).toHaveValue('31-07-29');
  await expect(page.locator('#rapCant')).toBeFocused();      // fecha completa y válida: pasa a la cantidad
  await cad.fill('');
  await cad.focus();
  await page.keyboard.type('311445555');                     // los dígitos de más no entran
  await expect(cad).toHaveValue('31-14-45');
  await cad.fill('');
  await cad.focus();
  await page.keyboard.type('4');
  await expect(cad).toHaveValue('04-');                      // un 4-9 de primer dígito se completa con 0
  await cad.fill('');
  await cad.focus();
  await page.keyboard.type('7-6-29');                        // separadores a mano también
  await expect(cad).toHaveValue('07-06-29');
  await cad.fill('');
  await cad.focus();
  await page.keyboard.type('jul-29');                        // MMM-AA con letras se respeta
  await expect(cad).toHaveValue('jul-29');
  await expect(page.locator('#rapCad ~ .cad-vista')).toHaveText('= JUL-29');
  expect(errores).toEqual([]);
});

test('Requisiciones: renombrar la entrega usa un diálogo propio y se puede cancelar', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#barraEntregas')).toBeVisible();
  await page.click('#btnRenombrarEntrega');
  await expect(page.locator('#modalTexto')).toBeVisible();
  await page.fill('#textoValor', 'Esquema básico');
  await page.keyboard.press('Enter');
  await expect(page.locator('#modalTexto')).toBeHidden();
  await expect(page.locator('#barraEntregas [data-entrega="1"]')).toContainText('Esquema básico');
  expect(await db(page, 'db.requi_requisiciones.find((r) => r.id === "req-hoy").etiqueta')).toBe('Esquema básico');
  await page.click('#btnRenombrarEntrega');
  await page.fill('#textoValor', 'Otro');
  await page.keyboard.press('Escape');                       // cancelar: no cambia nada
  await expect(page.locator('#modalTexto')).toBeHidden();
  expect(await db(page, 'db.requi_requisiciones.find((r) => r.id === "req-hoy").etiqueta')).toBe('Esquema básico');
  expect(errores).toEqual([]);
});


test('Requisiciones: exportar un municipio da UN archivo con una pestaña por unidad y la municipal al final', async ({ page }, testInfo) => {
  const ExcelJS = require('exceljs');
  const JSZip = require('jszip');
  const errores = await preparar(page, { conReq: true, libs: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  // Datos: SRP con un lote, repartido a Corregidora y de ahí a 2 de sus 3 unidades
  await page.evaluate(() => {
    const db = window.__FAKE_DB__;
    db.requi_lotes.push({ id: 'l1', requi_biologico_id: 'bio-srp', numero_lote: 'L1', caducidad: '2027-08-31' });
    const base = { requisicion_id: 'req-hoy', requi_biologico_id: 'bio-srp', lote_id: 'l1' };
    db.requi_items_jurisdiccion.push({ id: 'i1', ...base, cantidad_surtida: 50 });
    db.requi_distribucion_municipio.push({ id: 'm1', ...base, municipio: 'CORREGIDORA', cantidad: 50 });
    db.requi_distribucion_unidad.push({ id: 'u1', ...base, unidad_id: 'un-c1', cantidad: 30 }, { id: 'u2', ...base, unidad_id: 'un-c2', cantidad: 20 });
  });
  await page.click('#btnCargar');
  await expect(page.locator('#pildoraPaso1')).toHaveText('1');
  await page.click('#btnAbrirExportar');
  await expect(page.locator('#chkIncluirUnidades')).toBeChecked();
  const descarga = page.waitForEvent('download');
  await page.click('#btnExportarMasivo');
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^Requisiciones_\d{4}-\d{2}\.zip$/);
  const ruta = testInfo.outputPath('paquete.zip');
  await archivo.saveAs(ruta);
  const zip = await JSZip.loadAsync(require('fs').readFileSync(ruta));
  const nombres = Object.keys(zip.files);
  expect(nombres).toHaveLength(1);                               // un archivo por municipio, no uno por unidad
  expect(nombres[0]).toMatch(/^Requisicion_MUNICIPAL_MUNICIPIO_CORREGIDORA_/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await zip.files[nombres[0]].async('nodebuffer'));
  expect(wb.worksheets.map((w) => w.name)).toEqual(['C.S. Uno', 'C.S. Dos', 'MUNICIPAL']);
  const [uno, dos, mun] = wb.worksheets;
  expect(uno.getCell('B9').value).toBe('C.S. C.S. Uno');
  expect(uno.getCell('G14').value).toBe(30);
  expect(dos.getCell('G14').value).toBe(20);
  expect(mun.getCell('G14').value).toBe(50);
  expect(mun.getCell('B9').value).toBe('MUNICIPIO CORREGIDORA');
  expect(errores).toEqual([]);
});


test('Requisiciones: las confirmaciones son diálogos de SIREVAQ (se cancelan con Cancelar o Escape)', async ({ page }) => {
  const dialogosNativos = [];
  const errores = await preparar(page, { conReq: true });
  page.on('dialog', (d) => { dialogosNativos.push(d.message()); d.dismiss(); });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.evaluate(() => { window.__AUTO_CONFIRMAR__ = false; });
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'DEL1');
  await page.fill('#rapCant', '10');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);

  // Quitar un lote: diálogo rojo; Cancelar no quita nada
  await page.click('.fila-lote-capturado .btn-quitar-item');
  await expect(page.locator('#modalConfirmar')).toBeVisible();
  await expect(page.locator('#confirmarTitulo')).toHaveText('¿Quitar este lote?');
  await expect(page.locator('#modalConfirmar .modal-hoja')).toHaveAttribute('data-tono', 'peligro');
  await page.click('#confirmarCancelar');
  await expect(page.locator('#modalConfirmar')).toBeHidden();
  expect(await db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);

  // Escape también cancela
  await page.click('.fila-lote-capturado .btn-quitar-item');
  await expect(page.locator('#modalConfirmar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modalConfirmar')).toBeHidden();
  expect(await db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);

  // Aceptar sí lo quita
  await page.click('.fila-lote-capturado .btn-quitar-item');
  await page.click('#confirmarAceptar');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(0);

  // Exportar con lotes por definir pregunta antes (y cancelar no genera nada)
  await page.click('#btnPrellenar');
  await page.locator('#cantFilas input').nth(0).fill('20');
  await page.click('#cantGuardar');
  await page.click('#btnAbrirExportar');
  await page.click('#btnPdfJurisdiccional');
  await expect(page.locator('#confirmarTitulo')).toHaveText('Hay lotes por definir');
  await page.click('#confirmarCancelar');
  await expect(page.locator('#modalConfirmar')).toBeHidden();
  await expect(page.locator('#toast')).not.toContainText('Generando');
  expect(dialogosNativos).toEqual([]);                       // ningún cuadro del navegador
  expect(errores).toEqual([]);
});

test('Requisiciones: NHGQ y HENM aparecen como unidades en el paso 3 y reciben solos lo del paso 2', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'HOSP1');
  await page.fill('#rapCant', '100');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);

  // Paso 2: cantidad general a los dos hospitales
  await page.click('.paso-tab[data-paso="2"]');
  const lote = await loteId(page, 'HOSP1');
  await page.fill(celda2(lote, 'NHG'), '40');
  await page.press(celda2(lote, 'NHG'), 'Enter');
  await page.fill(celda2(lote, 'HENM'), '25');
  await page.press(celda2(lote, 'HENM'), 'Enter');
  await expect.poll(() => db(page, 'db.requi_distribucion_unidad.filter((d) => d.requisicion_id === "req-hoy").length')).toBe(2);

  // Paso 3: ambos hospitales están como destinos, con su unidad y su cantidad ya puesta
  await page.click('.paso-tab[data-paso="3"]');
  await expect(page.locator('#chipsMunicipio .chip-bio[data-muni="NHG"]')).toBeVisible();
  await expect(page.locator('#chipsMunicipio .chip-bio[data-muni="HENM"]')).toBeVisible();
  await page.click('#chipsMunicipio .chip-bio[data-muni="NHG"]');
  await expect(page.locator('#matrizUnidad tbody tr')).toHaveCount(1);
  await expect(page.locator('#matrizUnidad tbody tr').first()).toContainText('NHGQ');
  await expect(page.locator(celda3(lote, 'un-nhg'))).toHaveValue('40');
  await page.click('#chipsMunicipio .chip-bio[data-muni="HENM"]');
  await expect(page.locator(celda3(lote, 'un-henm'))).toHaveValue('25');
  await expect(page.locator('#matrizUnidad th[data-col] .saldo-td')).toContainText('0');   // sin saldo: ya está completo

  // Si cambia el paso 2, la unidad del hospital lo sigue (también al bajar)
  await page.click('.paso-tab[data-paso="2"]');
  await page.fill(celda2(lote, 'NHG'), '30');
  await page.press(celda2(lote, 'NHG'), 'Enter');
  await expect.poll(() => db(page, 'db.requi_distribucion_unidad.find((d) => d.unidad_id === "un-nhg" && d.requisicion_id === "req-hoy").cantidad')).toBe(30);
  await page.fill(celda2(lote, 'NHG'), '60');
  await page.press(celda2(lote, 'NHG'), 'Enter');
  await expect.poll(() => db(page, 'db.requi_distribucion_unidad.find((d) => d.unidad_id === "un-nhg" && d.requisicion_id === "req-hoy").cantidad')).toBe(60);
  expect(errores).toEqual([]);
});

test('Requisiciones: el chip de guardado muestra qué está guardado y qué falta, y Guardar/Ctrl+S confirman lo tecleado', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  const chip = page.locator('#dockGuardado');
  await expect(chip).toHaveClass(/\bok\b/);
  await expect(page.locator('#dockGuardadoTitulo')).toHaveText('Todo guardado');

  // Algo escrito en la captura rápida y sin agregar: "Falta guardar"
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'G1');
  await expect(chip).toHaveClass(/\bsucio\b/);
  await expect(page.locator('#dockGuardadoTitulo')).toHaveText('Falta guardar');
  await expect(page.locator('#dockGuardadoTexto')).toContainText('Captura rápida');
  await expect(page.locator('#btnGuardarTodo')).not.toHaveClass(/en-reposo/);

  // Guardar sin cantidad: avisa y sigue pendiente
  await page.click('#btnGuardarTodo');
  await expect(page.locator('#toast')).toContainText('cantidad');
  await expect(chip).toHaveClass(/\bsucio\b/);

  // Con la cantidad, Guardar lo agrega y todo queda guardado
  await page.fill('#rapCant', '100');
  await page.click('#btnGuardarTodo');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);
  await expect(chip).toHaveClass(/\bok\b/);
  await expect(page.locator('#toast')).toContainText('Todo guardado');
  await expect(page.locator('#dockGuardadoTexto')).toContainText('hace');
  await expect(page.locator('#btnGuardarTodo')).toHaveClass(/en-reposo/);

  // Una cantidad tecleada en la matriz (sin salir de la celda) es "sin confirmar"; Ctrl+S la guarda
  await page.click('.paso-tab[data-paso="2"]');
  const lote = await loteId(page, 'G1');
  await page.fill(celda2(lote, 'CORREGIDORA'), '60');
  await expect(chip).toHaveClass(/\bsucio\b/);
  await expect(page.locator('#dockGuardadoTexto')).toContainText('celda');
  await page.keyboard.press('Control+s');
  await expect.poll(() => db(page, `db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").map((d) => d.cantidad)`)).toEqual([60]);
  await expect(chip).toHaveClass(/\bok\b/);

  // El panel de pendientes dice qué falta por completar y lleva al paso
  await page.click('#dockGuardado');
  await expect(page.locator('#panelPendientes')).toBeVisible();
  await expect(page.locator('#panelPendientes')).toContainText('Todo guardado');
  await expect(page.locator('#panelPendientes')).toContainText('Paso 2');
  await expect(page.locator('#dockGuardadoPend')).toBeVisible();
  await page.click('#panelPendientes [data-pp="paso2"]');
  await expect(page.locator('#panelPendientes')).toBeHidden();
  await expect(page.locator('#panelPaso2')).toHaveClass(/activo/);
  await page.click('#dockGuardado');
  await page.keyboard.press('Escape');
  await expect(page.locator('#panelPendientes')).toBeHidden();

  // Si la base rechaza algo, el chip lo dice (y se limpia con el siguiente guardado bueno)
  await page.evaluate(() => { inicioEscritura(); finEscritura({ message: 'ERROR: Excede lo surtido' }); });
  await expect(chip).toHaveClass(/\berror\b/);
  await expect(page.locator('#dockGuardadoTitulo')).toHaveText('No se guardó');
  await expect(page.locator('#dockGuardadoTexto')).toContainText('Excede lo surtido');
  await page.evaluate(() => { inicioEscritura(); finEscritura(null); });
  await expect(chip).toHaveClass(/\bok\b/);
  expect(errores).toEqual([]);
});

test('Requisiciones: sin permiso de edición no hay chip de guardado ni botón Guardar', async ({ page }) => {
  await preparar(page, { rol: 'VISUALIZADOR_JURISDICCIONAL', conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await expect(page.locator('#dockGuardado')).toBeHidden();
  await expect(page.locator('#btnGuardarTodo')).toBeHidden();
});


test('Requisiciones: si falla la lectura NO se muestra la requisición vacía y se puede reintentar', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'LEER1');
  await page.fill('#rapCant', '10');
  await page.press('#rapCant', 'Enter');
  await expect(page.locator('#tbodyBiologicos')).toContainText('LEER1');

  // Se cae la lectura de lo surtido al recargar: lo que ya estaba en pantalla no se borra y se avisa
  await page.evaluate(() => { window.__FAKE_FALLAR__ = ['requi_items_jurisdiccion']; });
  await page.click('#btnCargar');
  await expect(page.locator('#toast')).toContainText('No se pudo cargar la requisición');
  await expect(page.locator('#hintCabecera')).toBeVisible();
  await expect(page.locator('#hintCabecera')).toContainText('no captures nada');
  await expect(page.locator('#tbodyBiologicos')).toContainText('LEER1');

  // Al volver la conexión, "Cargar" reintenta y quita el aviso
  await page.evaluate(() => { window.__FAKE_FALLAR__ = []; });
  await page.click('#btnCargar');
  await expect(page.locator('#hintCabecera')).toBeHidden();
  await expect(page.locator('#tbodyBiologicos')).toContainText('LEER1');
  expect(errores).toEqual([]);
});

test('Requisiciones: el analizador de caducidades y la máscara aguantan entradas raras', async ({ page }) => {
  await preparar(page, { conReq: true });
  const p = (t) => page.evaluate((x) => parsearCaducidadInteligente(x), t);
  expect(await p('15-07-29')).toBe('2029-07-15');
  expect(await p('15/07/2029')).toBe('2029-07-15');
  expect(await p('150729')).toBe('2029-07-15');
  expect(await p('07-29')).toBe('2029-07-31');                 // mes y año: último día del mes
  expect(await p('JUL-29')).toBe('2029-07-31');
  expect(await p('jul-29')).toBe('2029-07-31');
  expect(await p('29-02-28')).toBe('2028-02-29');              // bisiesto
  expect(await p('')).toBeNull();
  expect(await p('abc')).toBeNull();
  expect(await p('99-99-99')).toBeNull();                      // mes imposible
  expect(await p('00-00-00')).toBeNull();
  expect(await p('15-13-29')).toBeNull();
  // Días que no existen en ese mes se rechazan (antes se acomodaban al último día)
  expect(await p('31-04-29')).toBeNull();
  expect(await p('29-02-29')).toBeNull();                      // 2029 no es bisiesto
  expect(await p('30-02-28')).toBeNull();
  expect(await p('31-06-29')).toBeNull();
  expect(await p('31-07-29')).toBe('2029-07-31');
  const v = (x) => page.evaluate((y) => vistaCaducidad(y), x);
  expect(await v('31-04-29')).toBe('Abril de 2029 solo llega al día 30');
  expect(await v('29-02-29')).toBe('Febrero de 2029 solo llega al día 28');
  expect(await v('15-13-29')).toBe('El mes debe ser de 01 a 12');
  expect(await v('15-07-29')).toBe('= JUL-29');
  expect(await v('')).toBe('');
  const m = (t) => page.evaluate((x) => formatearFechaTecleada(x, { inputType: 'insertText' }), t);
  expect(await m('')).toBe('');
  expect(await m('9')).toBe('09-');
  expect(await m('0')).toBe('0');
  expect(await m('00')).toBe('00-');
  expect(await m('3')).toBe('3');
  expect(await m('31-')).toBe('31-');
  expect(await m('31-1')).toBe('31-1');
  expect(await m('1/')).toBe('01-');
  expect(await m('15-07-2')).toBe('15-07-2');
  expect(await m('15-07-299999')).toBe('15-07-29');
  expect(await page.evaluate(() => formatearFechaTecleada('15072029', { inputType: 'insertFromPaste' }))).toBe('15-07-29');
  expect(await page.evaluate(() => formatearFechaTecleada('15/7/2029', { inputType: 'insertFromPaste' }))).toBe('15-07-29');
  // Al borrar no se vuelve a poner el guion (si no, no se podría borrar)
  expect(await page.evaluate(() => formatearFechaTecleada('31-', { inputType: 'deleteContentBackward' }))).toBe('31-');
  // Nunca revienta con basura
  for (const basura of ['  ', '--', '..', 'ñ', '１２', '<script>', '31-06-29-12']) {
    await page.evaluate((x) => formatearFechaTecleada(x, { inputType: 'insertText' }), basura);
  }
  expect(await page.evaluate(() => formatDdMmAa('2029-07-15'))).toBe('15-07-29');
  expect(await page.evaluate(() => formatMmmAa('2029-07-15'))).toBe('JUL-29');
  expect(await page.evaluate(() => fechaLarga('2029-07-15'))).toMatch(/15 de julio de 2029/);
});


test('Requisiciones: una fecha que no existe no se puede guardar y el aviso dice por qué', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'FECHA1');
  await page.locator('#rapCad').focus();
  await page.keyboard.type('310429');                          // 31 de abril: no existe
  await expect(page.locator('#rapCad ~ .cad-vista')).toHaveText('Abril de 2029 solo llega al día 30');
  await expect(page.locator('#rapCad ~ .cad-vista')).toHaveClass(/mal/);
  await page.fill('#rapCant', '10');
  await page.press('#rapCant', 'Enter');
  await expect(page.locator('#toast')).toContainText('Abril de 2029 solo llega al día 30');
  expect(await db(page, 'db.requi_items_jurisdiccion.length')).toBe(0);
  await page.fill('#rapCad', '30-04-29');                      // corregida, sí se guarda
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);
  expect(await db(page, "db.requi_lotes.find((l) => l.numero_lote === 'FECHA1').caducidad")).toBe('2029-04-30');
  expect(errores).toEqual([]);
});

test('Requisiciones: lo escrito sin agregar se recupera al volver y ya no se usa el aviso nativo al salir', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'BORR1');
  await page.fill('#rapCant', '7');

  // Con algo tecleado y sin confirmar, el navegador NO debe preguntar al salir...
  const avisaTecleado = await page.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
  expect(avisaTecleado).toBe(false);
  // ...solo si hay una escritura a la base en vuelo
  const avisaEscribiendo = await page.evaluate(() => { estado.guardado.escribiendo = 1; const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); estado.guardado.escribiendo = 0; return ev.defaultPrevented; });
  expect(avisaEscribiendo).toBe(true);

  // Al cerrar/ocultar la pestaña queda el borrador
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const borrador = await page.evaluate(() => JSON.parse(localStorage.getItem('sirevaq_requi_borrador_req-hoy')));
  expect(borrador).toMatchObject({ bio: 'bio-srp', lote: 'BORR1', cant: '7' });

  // Al volver a abrir: se recupera, avisa y deja agregarlo
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#rapLote')).toHaveValue('BORR1');
  await expect(page.locator('#rapCant')).toHaveValue('7');
  await expect(page.locator('#chipsBio .chip-bio.activo')).toHaveCount(1);
  await expect(page.locator('#toast')).toContainText('Recuperé');
  await expect(page.locator('#dockGuardado')).toHaveClass(/sucio/);
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('sirevaq_requi_borrador_req-hoy'))).toBeNull();   // ya no hay borrador

  // Un clic suelto no descarta lo escrito (Escape sí)
  await page.click('#chipsBio .chip-bio[data-bio="bio-hexa"]');
  await page.fill('#rapLote', 'NOPIERDAS');
  await page.click('h1');
  await expect(page.locator('#rapLote')).toHaveValue('NOPIERDAS');
  await page.locator('#rapLote').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chipsBio .chip-bio.activo')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('sirevaq_requi_borrador_req-hoy'))).toBeNull();
  expect(errores).toEqual([]);
});

test('Requisiciones: las cantidades tecleadas en una matriz se confirman solas al salir de la pestaña', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.click('#chipsBio .chip-bio[data-bio="bio-srp"]');
  await page.fill('#rapLote', 'SAL1');
  await page.fill('#rapCant', '100');
  await page.press('#rapCant', 'Enter');
  await expect.poll(() => db(page, 'db.requi_items_jurisdiccion.length')).toBe(1);
  await page.click('.paso-tab[data-paso="2"]');
  const lote = await loteId(page, 'SAL1');
  await page.fill(celda2(lote, 'CORREGIDORA'), '45');           // sin salir de la celda
  await expect(page.locator('#dockGuardado')).toHaveClass(/sucio/);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => db(page, 'db.requi_distribucion_municipio.filter((d) => d.requisicion_id === "req-hoy").map((d) => d.cantidad)')).toEqual([45]);
  expect(errores).toEqual([]);
});


test('Requisiciones: la barra de abajo no encima el chip de guardado con los pasos, en ningún ancho', async ({ page }) => {
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  // Sin la fuente de íconos (en las pruebas no hay red) el nombre del ícono se pintaría como texto y ensancharía
  // los botones: se simula cada ícono como una caja de 20px, que es lo que mide con la fuente real.
  await page.addStyleTag({ content: '.material-symbols-rounded { font-size: 0 !important; display: inline-block; width: 20px; height: 20px; overflow: hidden; }' });
  await page.click('#chipsBio .chip-bio[data-bio="bio-hexa"]');
  await page.fill('#rapLote', 'ANCHO1');                       // chip en "Falta guardar" (su texto más largo)
  for (const ancho of [1600, 1400, 1250, 1120, 1100, 1060, 1024, 990, 960, 930, 900, 800, 600, 420]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const caja = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); if (c.display === 'none') return null; const b = e.getBoundingClientRect(); return b.width ? { izq: b.left, der: b.right } : null; };
      // El texto que se sale de su caja (nowrap sin lugar) se pinta ENCIMA de lo de al lado aunque las cajas no se toquen.
      const desborda = ['#dockEstado', '#dockGuardado', '#dockGuardado .dg-txt', '#dockEstado b', '#dockEstado small'].filter((s) => {
        const e = document.querySelector(s); if (!e || getComputedStyle(e).display === 'none' || !e.getBoundingClientRect().width) return false;
        return getComputedStyle(e).overflowX !== 'hidden' && e.scrollWidth > e.clientWidth + 1;   // (con overflow oculto se recorta, no se encima)
      });
      // Las pestañas de pasos no deben quedar recortadas (con scroll interno se verían cortadas: "3 ·").
      const hojas = document.querySelector('.dock-hojas');
      if (hojas.scrollWidth > hojas.clientWidth + 1) desborda.push('.dock-hojas (pestañas recortadas)');
      return { desborda, dock: caja('#dockPasos'), partes: { pasos: caja('.dock-hojas'), estado: caja('#dockEstado'), chip: caja('#dockGuardado'), acciones: caja('.dock-acciones') } };
    });
    expect(r.desborda, `texto que se sale de su caja @${ancho}`).toEqual([]);
    const partes = Object.entries(r.partes).filter(([, v]) => v);
    for (let i = 0; i < partes.length; i++) {
      // dentro de la barra
      expect(partes[i][1].izq, `${partes[i][0]} @${ancho}`).toBeGreaterThanOrEqual(r.dock.izq - 1);
      expect(partes[i][1].der, `${partes[i][0]} @${ancho}`).toBeLessThanOrEqual(r.dock.der + 1);
      // sin encimarse con ninguna otra parte
      for (let j = i + 1; j < partes.length; j++) {
        const a = partes[i][1], b = partes[j][1];
        expect(a.der <= b.izq + 1 || b.der <= a.izq + 1, `${partes[i][0]} y ${partes[j][0]} se encíman @${ancho}`).toBe(true);
      }
    }
    expect(r.partes.chip, `el chip debe verse @${ancho}`).not.toBeNull();
  }
  expect(errores).toEqual([]);
});

test('Requisiciones: traer el reparto de influenza llena los pasos 1-3 con lote por definir y avisa lo que falta', async ({ page }) => {
  await page.addInitScript(() => {
    window.__FAKE_INFLUENZA__ = true;
    window.__FAKE_INFLUENZA_UNI__ = [{ unidad_id: 'un-q1', cantidad: 40 }, { unidad_id: 'un-q2', cantidad: 20 }];
  });
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.evaluate(() => { window.__AUTO_CONFIRMAR__ = false; });

  await page.click('#btnTraerInfluenza');
  await expect(page.locator('#modalInfluenza')).toBeVisible();
  await expect(page.locator('#infEntrega option')).toHaveCount(1);
  await expect(page.locator('#infDetalle')).toContainText('100 frascos recibidos');
  await expect(page.locator('#infDetalle')).toContainText('Querétaro 60');
  await expect(page.locator('#infTraer')).toBeEnabled();

  await page.click('#infTraer');
  // Corregidora tiene 40 asignados pero aún sin reparto a sus unidades: se avisa
  await expect(page.locator('#modalConfirmar')).toBeVisible();
  await expect(page.locator('#modalConfirmar')).toContainText('Se trajeron 100 frascos de influenza');
  await expect(page.locator('#modalConfirmar')).toContainText('Corregidora');
  await page.click('#confirmarAceptar');

  expect(await db(page, "db.requi_items_jurisdiccion.filter((i) => i.requi_biologico_id === 'bio-flu').map((i) => i.cantidad_surtida)")).toEqual([100]);
  expect(await db(page, "db.requi_lotes.filter((l) => l.requi_biologico_id === 'bio-flu').map((l) => l.numero_lote)")).toEqual(['POR DEFINIR']);
  expect(await db(page, "db.requi_distribucion_municipio.filter((d) => d.requi_biologico_id === 'bio-flu').reduce((a, d) => a + d.cantidad, 0)")).toBe(100);
  expect(await db(page, "db.requi_distribucion_unidad.filter((d) => d.requi_biologico_id === 'bio-flu').reduce((a, d) => a + d.cantidad, 0)")).toBe(60);
  expect(await db(page, "db.requi_requisiciones.find((r) => r.id === 'req-hoy').influenza_entrega")).toBe(1);

  // Con la entrega ya vinculada a esta requisición se puede volver a traer (reemplaza) y avisa el reemplazo
  await page.click('#btnTraerInfluenza');
  await expect(page.locator('#infDetalle')).toContainText('se reemplazan');
  await page.click('#infCancelar');
  await expect(page.locator('#modalInfluenza')).toBeHidden();
  expect(errores).toEqual([]);
});

test('Requisiciones: la entrega de influenza ya vinculada a otra requisición no se puede traer', async ({ page }) => {
  await page.addInitScript(() => { window.__FAKE_INFLUENZA__ = true; });
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.evaluate(() => {
    window.__FAKE_DB__.requi_requisiciones.push({ id: 'req-otra', anio: 2026, mes: 9, entrega: 1, etiqueta: 'Influenza', estado: 'BORRADOR', fue_corregido: false, creado_por: 'x', fecha_envio: null,
      influenza_campana: 'Campaña Influenza 2026-2027', influenza_entrega: 1 });
  });
  await page.click('#btnTraerInfluenza');
  await expect(page.locator('#infEntrega')).toContainText('ya vinculada');
  await expect(page.locator('#infDetalle')).toContainText('ya está vinculada');
  await expect(page.locator('#infTraer')).toBeDisabled();
  expect(errores).toEqual([]);
});

test('Requisiciones: la confirmación de reemplazar se ve por encima del modal de Traer reparto de influenza', async ({ page }) => {
  await page.addInitScript(() => {
    window.__FAKE_INFLUENZA__ = true;
    window.__FAKE_INFLUENZA_UNI__ = [{ unidad_id: 'un-q1', cantidad: 40 }];
  });
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  // Primera vez: se trae el reparto (los avisos se aceptan solos)
  await page.click('#btnTraerInfluenza');
  await page.click('#infTraer');
  await expect(page.locator('#modalInfluenza')).toBeHidden();
  await page.evaluate(() => { window.__AUTO_CONFIRMAR__ = false; });
  // Segunda vez: ya hay influenza, así que pide confirmar el reemplazo con el modal todavía abierto
  await page.click('#btnTraerInfluenza');
  await expect(page.locator('#infDetalle')).toContainText('se reemplazan');
  await page.click('#infTraer');
  await expect(page.locator('#modalConfirmar')).toBeVisible();
  await expect(page.locator('#modalInfluenza')).toBeVisible();
  const arriba = await page.evaluate(() => {
    const r = document.querySelector('#modalConfirmar .modal-hoja').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(el && el.closest('#modalConfirmar'));
  });
  expect(arriba).toBe(true);
  expect(errores).toEqual([]);
});

// ---------------------------------------------------------------------------
// Traer pedido de biológico (ordinario / extraordinarios). La requisición del mes en curso lleva el
// pedido del mes anterior (el de octubre se hizo el 22 de septiembre).
// ---------------------------------------------------------------------------
function pedidosDelMesAnterior(extras) {
  return () => {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const pref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    window.__FAKE_PEDIDOS__ = [{ fecha: pref + '-22', tipo: 'MENSUAL', unidades: 68, frascos: 13466 }];
    if (window.__FAKE_PEDIDOS_EXTRA__) {
      window.__FAKE_PEDIDOS__.push({ fecha: pref + '-28', tipo: 'EXTRAORDINARIO', unidades: 12, frascos: 340, motivo: 'Brote de sarampión' });
    }
    window.__PEDIDO_PREF__ = pref;
  };
}

test('Requisiciones: Traer pedido de biológico propone el mes anterior y solo trae cuando se pide', async ({ page }) => {
  await page.addInitScript(pedidosDelMesAnterior());
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  // Sin pulsar el botón no se trae nada
  expect(await db(page, "db.requi_items_jurisdiccion.length")).toBe(0);

  await page.click('#btnTraerPedido');
  await expect(page.locator('#modalPedido')).toBeVisible();
  await expect(page.locator('#pedMes option').first()).toContainText('el que corresponde');
  const pref = await page.evaluate(() => window.__PEDIDO_PREF__);
  await expect(page.locator('#pedMes')).toHaveValue(pref.replace(/-0?(\d+)$/, '-$1'));
  await expect(page.locator('#pedOpciones input[type=radio]')).toHaveCount(1);
  await expect(page.locator('#pedOpciones input[type=radio]')).toBeChecked();
  await expect(page.locator('#pedOpciones')).toContainText('Ordinario');
  await expect(page.locator('#pedAviso')).toContainText('Hay un solo pedido');
  await expect(page.locator('#pedTraer')).toBeEnabled();
  await expect(page.locator('#pedTraer')).toContainText('22');

  await page.click('#pedTraer');
  await expect(page.locator('#modalPedido')).toBeHidden();
  expect(await db(page, "db.requi_items_jurisdiccion.map((i) => i.cantidad_surtida)")).toEqual([13466]);
  expect(await db(page, "db.requi_lotes.map((l) => l.numero_lote)")).toEqual(['POR DEFINIR']);
  expect(await db(page, "db.requi_requisiciones.find((r) => r.id === 'req-hoy').pedido_fecha")).toMatch(/-22$/);
  expect(errores).toEqual([]);
});

test('Requisiciones: con más de un pedido en el mes deja elegir y trae el elegido', async ({ page }) => {
  await page.addInitScript(() => { window.__FAKE_PEDIDOS_EXTRA__ = true; });
  await page.addInitScript(pedidosDelMesAnterior());
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();

  await page.click('#btnTraerPedido');
  await expect(page.locator('#pedOpciones input[type=radio]')).toHaveCount(2);
  await expect(page.locator('#pedAviso')).toContainText('Se detectaron 2 pedidos');
  await expect(page.locator('#pedAviso')).toContainText('1 ordinario y 1 extraordinario');
  // Se propone el ordinario; el extraordinario se distingue y muestra su motivo
  await expect(page.locator('#pedOpciones input[type=radio]').first()).toBeChecked();
  await expect(page.locator('#pedOpciones .ped-tag.extra')).toHaveText('Extraordinario');
  await expect(page.locator('#pedOpciones')).toContainText('Brote de sarampión');

  await page.locator('#pedOpciones input[type=radio]').nth(1).check();
  await expect(page.locator('#pedTraer')).toContainText('28');
  await expect(page.locator('#pedResumen')).toContainText('340 frascos');
  await page.click('#pedTraer');
  await expect(page.locator('#modalPedido')).toBeHidden();
  expect(await db(page, "db.requi_items_jurisdiccion.map((i) => i.cantidad_surtida)")).toEqual([340]);
  expect(await db(page, "db.requi_requisiciones.find((r) => r.id === 'req-hoy').pedido_fecha")).toMatch(/-28$/);
  expect(errores).toEqual([]);
});

test('Requisiciones: un pedido ya vinculado a otra requisición no se puede traer', async ({ page }) => {
  await page.addInitScript(pedidosDelMesAnterior());
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.evaluate(() => {
    window.__FAKE_DB__.requi_requisiciones.push({ id: 'req-otra', anio: 2026, mes: 9, entrega: 1, etiqueta: null, estado: 'BORRADOR', fue_corregido: false, creado_por: 'x', fecha_envio: null,
      pedido_fecha: window.__PEDIDO_PREF__ + '-22' });
  });
  await page.click('#btnTraerPedido');
  await expect(page.locator('#pedOpciones')).toContainText('Ya vinculado');
  await expect(page.locator('#pedOpciones input[type=radio]')).toBeDisabled();
  await expect(page.locator('#pedTraer')).toBeDisabled();
  expect(errores).toEqual([]);
});

test('Requisiciones: Traer pedido es accesible (grupo con leyenda, Escape cierra y devuelve el foco, Tab no se escapa)', async ({ page }) => {
  await page.addInitScript(() => { window.__FAKE_PEDIDOS_EXTRA__ = true; });
  await page.addInitScript(pedidosDelMesAnterior());
  const errores = await preparar(page, { conReq: true });
  await expect(page.locator('#contenidoRequisicion')).toBeVisible();
  await page.focus('#btnTraerPedido');
  await page.keyboard.press('Enter');
  await expect(page.locator('#modalPedido')).toBeVisible();
  await expect(page.locator('#modalPedido [role=dialog]')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#pedGrupo legend')).toHaveText('Pedido a traer');
  await expect(page.locator('#pedAviso')).toHaveAttribute('aria-live', 'polite');
  // El foco entra al pedido propuesto
  await expect(page.locator('#pedOpciones input[type=radio]').first()).toBeFocused();
  // Flechas cambian de pedido (radio nativo)
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#pedOpciones input[type=radio]').nth(1)).toBeChecked();
  // Tab cicla dentro del modal
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#modalPedido'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#modalPedido')).toBeHidden();
  await expect(page.locator('#btnTraerPedido')).toBeFocused();
  expect(errores).toEqual([]);
});
