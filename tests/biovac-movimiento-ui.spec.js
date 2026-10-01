// Movimiento de Biológico (biovac.html): secciones con color, lápiz/bote por renglón, aviso de lote repetido,
// banner de corrección para el municipal y periodo compacto de Admin/Jurisdicción.
// Se usa la página real con el Supabase simulado (tests/fixtures/fake-biovac.js) y se arma el estado a mano.
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

// Arma un movimiento con 2 lotes de BCG y lo pinta con render().
async function pintar(page, { rol, estadoMov = 'BORRADOR', jurisdiccional = false, anteriorEditable = true }) {
  await page.evaluate(([r, e, j, ae]) => {
    const lote = (id, n) => ({ id, numero_lote: n, caducidad: '2027-03-31', biologico_id: 'bio1', dosis_por_frasco_override: null });
    const fila = (id, n, ant, rec) => ({ id, categoria: 'NORMAL', existencia_anterior_frascos: ant, recibido_frascos: rec, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: ant + rec, observaciones: null, biovac_lotes: lote('l' + id, n) });
    estado.perfil = { rol: r, usuario: 'prueba', nombre: 'Prueba', apellido_paterno: 'X' };
    estado.bloques = [{ id: 'b1' }];
    estado.biologicos = [{ id: 'bio1', clave: 'BCG', nombre_excel: 'B.C.G. frasco multidosis', bloque_id: 'b1', orden_en_bloque: 1, presentacion: 'FRASCO', dosis_por_frasco: 10, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null }];
    estado.renglones = [fila('1', '0374MA108', 1, 0), fila('2', '0374MA109', 2, 0)];
    estado.ultimasEdicionesJurisdiccion = new Map();
    estado.movimiento = { id: 'm1', estado: e, anio: 2026, mes: 9, unidad_id: 'un-a', responsable_elaboracion: '', fecha_corte: '2026-09-30' };
    estado.correccionEsJurisdiccional = j;
    estado.anteriorEditable = ae;
    // escrituras simuladas: registran el último update y devuelven una existencia final
    window.__updates = [];
    estado.db = {
      from: () => {
        const q = { payload: null };
        const api = {
          update(p) { q.payload = p; return api; },
          eq() { return api; }, select() { return api; },
          single: async () => { window.__updates.push(q.payload); return { data: { existencia_final_frascos: 3 }, error: null }; },
          delete() { return api; },
          then(ok) { return Promise.resolve({ error: null }).then(ok); }
        };
        return api;
      },
      rpc: async () => ({ data: [], error: null })
    };
    document.getElementById('btnSeccionMovimiento')?.classList.add('activo');
    render();
  }, [rol, estadoMov, jurisdiccional, anteriorEditable]);
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('Las secciones de la tabla tienen su color e icono y cada renglón trae lápiz y bote', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintar(page, { rol: 'UNIDAD' });
  for (const c of ['c-ant', 'c-rec', 'c-apl', 'c-des', 'c-fin']) await expect(page.locator(`table.renglones thead th.${c}`)).toHaveCount(1);
  await expect(page.locator('table.renglones thead th.c-ant')).toContainText('Existencia anterior');
  await expect(page.locator('[data-action="editar-ant"]')).toHaveCount(2);
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(2);
  await expect(page.locator('#guiaCaptura .paso')).toHaveCount(4);              // guía de captura para la unidad
});

test('Lápiz: corrige la existencia anterior de un renglón sin borrarlo', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintar(page, { rol: 'UNIDAD' });
  const fila = page.locator('table.renglones tbody tr').first();
  await expect(fila.locator('input.ant-input')).toBeHidden();
  await fila.locator('[data-action="editar-ant"]').click();
  await expect(fila).toHaveClass(/fila-editando/);
  await expect(fila.locator('input.ant-input')).toBeVisible();
  await fila.locator('input.ant-input').fill('5');
  await fila.locator('input.ant-input').press('Tab');                            // change -> guarda
  await expect.poll(() => page.evaluate(() => window.__updates.length)).toBe(1);
  expect(await page.evaluate(() => window.__updates[0])).toEqual({ existencia_anterior_frascos: 5 });
  await expect(fila.locator('[data-ant-valor]')).toHaveText('5');
  // Enter cierra el modo edición
  await fila.locator('input.ant-input').focus();
  await page.keyboard.press('Enter');
  await expect(fila).not.toHaveClass(/fila-editando/);
});

test('Agregar un lote que ya está en la tabla avisa y lleva a la casilla RECIBIDO resaltada', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintar(page, { rol: 'UNIDAD' });
  await page.evaluate(() => {
    window.obtenerLotesCatalogoCentral = async () => [
      { lote: '0374MA108', caducidad: '2027-03-31' }, { lote: 'NUEVO1', caducidad: '2027-05-31' }];
  });
  await page.click('[data-action="toggle-agregar"]');
  await page.selectOption('[data-nuevo-categoria]', 'NORMAL');
  await expect(page.locator('[data-nuevo-lote]')).toBeEnabled();
  await page.selectOption('[data-nuevo-lote]', '0374MA108');
  const alerta = page.locator('[data-alerta-repetido]');
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('ya está dado de alta');
  await expect(alerta).toContainText('RECIBIDO');
  await expect(page.locator('[data-action="confirmar-agregar"]')).toBeDisabled();

  // un lote que no está en la tabla no avisa
  await page.selectOption('[data-nuevo-lote]', 'NUEVO1');
  await expect(alerta).toBeHidden();
  await expect(page.locator('[data-action="confirmar-agregar"]')).toBeEnabled();

  // ir a la casilla recibido
  await page.selectOption('[data-nuevo-lote]', '0374MA108');
  await page.click('[data-action="ir-a-recibido"]');
  await expect(page.locator('[data-panel-agregar]')).not.toHaveClass(/abierto/);
  await expect(page.locator('input[data-renglon="1"][data-campo="recibido_frascos"]').locator('xpath=..')).toHaveClass(/pulso/);
  await expect(page.locator('input[data-renglon="1"][data-campo="recibido_frascos"]')).toBeFocused();
});

test('Tipo de cantidad: tarjetas Existencia anterior / Recibido', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintar(page, { rol: 'UNIDAD' });
  await page.click('[data-action="toggle-agregar"]');
  await expect(page.locator('.tipo-cantidad label')).toHaveCount(2);
  await expect(page.locator('.tipo-cantidad input:checked')).toHaveValue('ANTERIOR');
  await page.locator('.tipo-cantidad label.t-rec').click();
  await expect(page.locator('.tipo-cantidad input:checked')).toHaveValue('RECIBIDO');
});

test('Municipal: un movimiento cerrado ofrece "Corregir movimiento"; en corrección edita, quita y guarda', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await pintar(page, { rol: 'MUNICIPAL', estadoMov: 'CERRADO' });
  await expect(page.locator('.banner-mov.cerrado')).toContainText('Corregir');
  await expect(page.locator('[data-banner="corregir"]')).toBeVisible();
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(0);   // cerrado: solo lectura

  await pintar(page, { rol: 'MUNICIPAL', estadoMov: 'EN_CORRECCION' });
  await expect(page.locator('.banner-mov.correccion')).toContainText('Modo corrección');
  await expect(page.locator('[data-banner="guardar"]')).toBeVisible();
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(2);
  await expect(page.locator('[data-action="editar-ant"]')).toHaveCount(2);
  await expect(page.locator('[data-action="toggle-agregar"]')).toHaveCount(1);

  // La unidad no ve el banner de corrección sobre su propio movimiento cerrado
  await pintar(page, { rol: 'UNIDAD', estadoMov: 'CERRADO' });
  await expect(page.locator('.banner-mov')).toHaveCount(0);
});

test('Corrección jurisdiccional: la existencia anterior no se edita (el servidor solo admite campos de movimiento)', async ({ page }) => {
  await abrir(page, 'JURISDICCIONAL');
  await pintar(page, { rol: 'JURISDICCIONAL', estadoMov: 'EN_CORRECCION', jurisdiccional: true });
  await expect(page.locator('[data-action="editar-ant"]')).toHaveCount(0);
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(2);
});

test('Periodo compacto para Admin y Jurisdicción, normal para los demás perfiles', async ({ page }) => {
  await abrir(page, 'JURISDICCIONAL');
  await expect(page.locator('#campoPeriodo')).toHaveClass(/compacto/);
  const alto = await page.locator('#campoPeriodo').evaluate((e) => e.getBoundingClientRect().height);
  expect(alto).toBeLessThan(70);
});

test('Periodo normal para la unidad', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await expect(page.locator('#campoPeriodo')).not.toHaveClass(/compacto/);
});

test('Existencia anterior: solo el primer mes se captura; después viene sola', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintar(page, { rol: 'UNIDAD', anteriorEditable: false });
  await expect(page.locator('[data-action="editar-ant"]')).toHaveCount(0);        // sin lápiz
  await expect(page.locator('input.ant-input')).toHaveCount(0);
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(2);  // el bote sigue
  await expect(page.locator('#guiaCaptura .paso.ant')).toContainText('sola');
  await page.click('[data-action="toggle-agregar"]');
  await expect(page.locator('.tipo-cantidad input[value="ANTERIOR"]')).toBeDisabled();
  await expect(page.locator('.tipo-cantidad input[value="RECIBIDO"]')).toBeChecked();

  // el primer mes sí
  await pintar(page, { rol: 'UNIDAD', anteriorEditable: true });
  await expect(page.locator('[data-action="editar-ant"]')).toHaveCount(2);
  await expect(page.locator('#guiaCaptura .paso.ant')).toContainText('primer mes');
});

test('Calculo: el primer mes es editable en meses de prueba y en el mes de arranque; el segundo ya no', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  const r = await page.evaluate(async () => {
    estado.inicioPorUnidad = '2026-10-01';
    const dbFalso = (movs) => ({ from: () => { const api = { select() { return api; }, eq() { return api; }, lte() { return api; }, then(ok) { return Promise.resolve({ data: movs, error: null }).then(ok); } }; return api; } });
    estado.db = dbFalso([]);
    const prueba = await calcularAnteriorEditable('u1', 2026, 9);                  // antes del arranque: de prueba
    const primer = await calcularAnteriorEditable('u1', 2026, 10);                 // octubre, sin meses previos
    estado.db = dbFalso([{ anio: 2026, mes: 10 }]);
    const segundo = await calcularAnteriorEditable('u1', 2026, 11);                // noviembre, ya hay octubre
    estado.db = dbFalso([{ anio: 2026, mes: 9 }]);
    const conPrueba = await calcularAnteriorEditable('u1', 2026, 10);              // septiembre de prueba no cuenta
    return { prueba, primer, segundo, conPrueba };
  });
  expect(r).toEqual({ prueba: true, primer: true, segundo: false, conPrueba: true });
});

test('Municipal: avisos de correcciones de Jurisdicción con la fila gris, la corrección y lo que falta', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await pintar(page, { rol: 'MUNICIPAL', estadoMov: 'EN_CORRECCION' });
  await page.evaluate(() => {
    estado.unidades = [{ id: 'un-a', clues: 'QTSSA000001', nombre: 'C.S. Alfa', municipio: 'QUERETARO', jurisdiccion_id: 'j1' }];
    const pend = { id: 'c1', municipio: 'QUERETARO', lote_id: 'l1', numero_lote: '0374MA108', biologico_id: 'bio1', nombre_excel: 'B.C.G.', categoria: 'NORMAL',
      motivo: 'No cuadra con el paloteo', creado_por: 'Juris', creado_en: '2026-10-05T10:00:00Z',
      obj_recibido: 20, obj_aplicadas_a: null, obj_aplicadas_b: null, obj_desechadas_a: null, obj_desechadas_b: null,
      act_recibido: 15, act_aplicadas_a: 4, act_aplicadas_b: 0, act_desechadas_a: 0, act_desechadas_b: 0, coincide: false };
    window.__rpcCorr = [pend];
    estado.db = { from: () => ({}), rpc: async (n) => ({ data: n === 'biovac_correcciones_municipio_estado' ? window.__rpcCorr : [], error: null }) };
    return cargarCorreccionesJurisdiccion(false);
  });
  const panel = page.locator('#panelCorreccionesJur');
  await expect(panel).toContainText('Jurisdicción pidió corregir');
  await expect(panel.locator('tr.hoy')).toContainText('15');
  await expect(panel.locator('tr.objetivo')).toContainText('20');
  await expect(panel.locator('tr.falta')).toContainText('faltan 5');
  await expect(panel).toContainText('0374MA108');
  // el lote afectado queda marcado en la tabla de la unidad
  await expect(page.locator('[data-etiqueta-corr="l1|NORMAL"] .tag-correccion-jur')).toHaveCount(1);
  await expect(page.locator('[data-etiqueta-corr="l2|NORMAL"] .tag-correccion-jur')).toHaveCount(0);

  // al cuadrar, el servidor la marca resuelta: el aviso se va y se avisa con un toast
  await page.evaluate(() => { window.__rpcCorr = [{ ...window.__rpcCorr[0], coincide: true }]; return cargarCorreccionesJurisdiccion(true); });
  await expect(panel.locator('.corr-item')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('Corrección de Jurisdicción cumplida');
  await expect(page.locator('.tag-correccion-jur')).toHaveCount(0);

  // la unidad no ve estos avisos
  await page.evaluate(() => { window.__rpcCorr = [{ id: 'c2', municipio: 'QUERETARO', lote_id: 'l1', numero_lote: 'X', biologico_id: 'bio1', nombre_excel: 'B', categoria: 'NORMAL', motivo: 'm', creado_por: 'j', creado_en: '2026-10-05T10:00:00Z', obj_recibido: 1, act_recibido: 0, act_aplicadas_a: 0, act_aplicadas_b: 0, act_desechadas_a: 0, act_desechadas_b: 0, coincide: false }]; estado.perfil.rol = 'UNIDAD'; return cargarCorreccionesJurisdiccion(false); });
  await expect(panel.locator('.corr-item')).toHaveCount(0);
});
