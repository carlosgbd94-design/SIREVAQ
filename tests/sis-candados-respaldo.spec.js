// SINBA-SIS: candados de la unidad tras el envío, respaldo local (caché) del avance, ventana de
// captura, historial, corrección de Influenza por revisores y validación con excepción.
// Página real (biovac.html) con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol || 'MUNICIPAL');
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

// Deja la página lista para usar SIS06PBiovac como la unidad QTSSA000001 (o como revisor con esa unidad elegida).
async function prepararSIS(page, { rol, estadoCaptura = 'BORRADOR', extras = [] }) {
  await page.evaluate(([r, est, ext]) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    if (r === 'UNIDAD') {
      estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    } else {
      estado.perfil = Object.assign({}, estado.perfil, { rol: r });
      document.getElementById('selUnidadRevision').value = 'un-a';
    }
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push(
      { id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', clave_afro: null, clave_indigena: null, clave_migrante: null, orden: 1, activo: true },
      { id: 2, fila_excel: 12, biologico: 'BCG', grupo_poblacional: '29 días a 11 meses', dosis: 'ÚNICA', edad: null, clave_general: 'VBC02', clave_afro: null, clave_indigena: null, clave_migrante: null, orden: 2, activo: true }
    );
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: est, valores: {}, ajustes: {}, updated_at: '2026-09-01T00:00:00Z' });
    ext.forEach((e, i) => F.tables.sis06p_capturas.push(Object.assign({ id: 'cx' + i, clues: 'QTSSA000001', municipio: 'QUERETARO', valores: {}, ajustes: {} }, e)));
  }, [rol, estadoCaptura, extras]);
}

test.use({ viewport: { width: 1400, height: 1000 } });

// ---------------------------------------------------------------------------
// Movimiento de Biológico
// ---------------------------------------------------------------------------

async function pintarMovimiento(page, { rol, estadoMov, sisEstado }) {
  await page.evaluate(([r, e, sis]) => {
    const lote = (id, n) => ({ id, numero_lote: n, caducidad: '2027-03-31', biologico_id: 'bio1', dosis_por_frasco_override: null });
    const fila = (id, n, ant, rec) => ({ id, categoria: 'NORMAL', existencia_anterior_frascos: ant, recibido_frascos: rec, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: ant + rec, observaciones: null, biovac_lotes: lote('l' + id, n) });
    estado.perfil = { id: 'u1', rol: r, usuario: 'prueba', nombre: 'Prueba', apellido_paterno: 'X' };
    estado.bloques = [{ id: 'b1' }];
    estado.biologicos = [{ id: 'bio1', clave: 'BCG', nombre_excel: 'B.C.G. frasco multidosis', bloque_id: 'b1', orden_en_bloque: 1, presentacion: 'FRASCO', dosis_por_frasco: 10, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null }];
    estado.renglones = [fila('1', '0374MA108', 1, 0), fila('2', '0374MA109', 2, 0)];
    estado.ultimasEdicionesJurisdiccion = new Map();
    estado.movimiento = { id: 'm1', estado: e, anio: 2026, mes: 9, unidad_id: 'un-a', responsable_elaboracion: '', fecha_corte: '2026-09-30' };
    estado.sis06pEstadoActual = sis;
    estado.correccionEsJurisdiccional = false;
    estado.anteriorEditable = true;
    window.__updates = [];
    window.__modoRed = 'ok';
    estado.db = {
      from: () => {
        const q = { payload: null };
        const api = {
          update(p) { q.payload = p; return api; },
          eq() { return api; }, select() { return api; },
          single: async () => {
            if (window.__modoRed === 'caido') return { data: null, error: { message: 'TypeError: Failed to fetch' } };
            if (window.__modoRed === 'rechazo') return { data: null, error: { message: 'El SINBA-SIS de 09/2026 ya fue enviado' } };
            window.__updates.push(q.payload);
            return { data: { existencia_final_frascos: 3 }, error: null };
          },
          delete() { return api; },
          then(ok) { return Promise.resolve({ error: null }).then(ok); }
        };
        return api;
      },
      rpc: async () => ({ data: [], error: null })
    };
    document.getElementById('btnSeccionMovimiento')?.classList.add('activo');
    render();
  }, [rol, estadoMov, sisEstado]);
}

test('UNIDAD: con el SIS enviado el Movimiento queda en solo lectura, aunque el municipal lo tenga en corrección', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintarMovimiento(page, { rol: 'UNIDAD', estadoMov: 'EN_CORRECCION', sisEstado: 'ENVIADO' });
  await expect(page.locator('table.renglones input[data-campo]')).toHaveCount(0);
  await expect(page.locator('#bannerMovimiento')).toContainText('solo lectura');
  await expect(page.locator('[data-action="eliminar-renglon"]')).toHaveCount(0);
});

test('UNIDAD: con el SIS en borrador el Movimiento sí se captura', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintarMovimiento(page, { rol: 'UNIDAD', estadoMov: 'BORRADOR', sisEstado: 'BORRADOR' });
  expect(await page.locator('table.renglones input[data-campo]').count()).toBeGreaterThan(0);
});

test('MUNICIPAL: sí edita el Movimiento de una unidad con el SIS enviado (en corrección)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await pintarMovimiento(page, { rol: 'MUNICIPAL', estadoMov: 'EN_CORRECCION', sisEstado: 'VALIDADO' });
  expect(await page.locator('table.renglones input[data-campo]').count()).toBeGreaterThan(0);
});

test('Movimiento: si se cae el internet al guardar, lo tecleado se respalda y se recupera y guarda solo', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintarMovimiento(page, { rol: 'UNIDAD', estadoMov: 'BORRADOR', sisEstado: 'BORRADOR' });
  await page.evaluate(() => { window.__modoRed = 'caido'; });
  const celda = page.locator('input[data-renglon="1"][data-campo="recibido_frascos"]');
  await celda.fill('7');
  await celda.blur();
  await page.waitForTimeout(300);
  const respaldo = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('biovac_pend_v1:')).map(([, v]) => v));
  expect(respaldo.length).toBe(1);
  expect(respaldo[0]).toContain('"v":"7"');
  await expect(page.locator('#bannerPendientes')).toContainText('sin confirmar');

  // "Recarga": se vuelve a pintar el mes con el servidor ya sano -> se repone el 7 y se guarda solo
  await page.evaluate(() => {
    window.__modoRed = 'ok';
    estado.renglones.forEach((r) => { r.recibido_frascos = 0; });
    render();
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__updates.some((u) => u && u.recibido_frascos === 7))).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('biovac_pend_v1:')).length)).toBe(0);
  await expect(page.locator('#bannerPendientes')).toBeEmpty();
});

test('Movimiento: si el servidor RECHAZA el guardado (mes enviado) no se queda reintentando para siempre', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await pintarMovimiento(page, { rol: 'UNIDAD', estadoMov: 'BORRADOR', sisEstado: 'BORRADOR' });
  await page.evaluate(() => { window.__modoRed = 'rechazo'; });
  const celda = page.locator('input[data-renglon="1"][data-campo="recibido_frascos"]');
  await celda.fill('4');
  await celda.blur();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('biovac_pend_v1:')).length)).toBe(0);
  await expect(page.locator('#toast')).toContainText('No se guardó');
});

// ---------------------------------------------------------------------------
// SIS-06-P: respaldo, ventana, historial
// ---------------------------------------------------------------------------

test('SIS-06-P: el avance sin guardar se respalda y reaparece al volver a abrir el mes', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol: 'UNIDAD' });
  await page.evaluate(() => { document.getElementById('panelSIS06P').style.display = 'block'; });
  await page.evaluate(async () => { await SIS06PBiovac.init(); });
  await page.evaluate(() => {
    const el = document.getElementById('sisb_11_total');
    el.value = '5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sis06p_draft_v1:')).length)).toBe(1);

  // "Recarga" de la hoja: el servidor sigue sin tener nada, el borrador local repone el 5
  await page.evaluate(async () => { await SIS06PBiovac.init(); });
  await expect(page.locator('#sisb_11_total')).toHaveValue('5');
  await expect(page.locator('#sis06pBannerBorrador')).toContainText('Recuperamos tu avance');
  expect(await page.evaluate(() => document.getElementById('sis06pChipSinGuardar').style.display)).not.toBe('none');   // el panel está oculto en la prueba: se revisa el estilo

  // Descartar vuelve a lo guardado y borra el respaldo
  await page.locator('#btnDescartarBorrador').click();
  await expect(page.locator('#sisb_11_total')).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sis06p_draft_v1:')).length)).toBe(0);
});

test('SIS-06-P: si el guardado falla por la red el borrador se conserva y se guarda solo al volver el internet', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol: 'UNIDAD' });
  await page.evaluate(async () => { await SIS06PBiovac.init(); });
  await page.evaluate(() => {
    const el = document.getElementById('sisb_11_total');
    el.value = '8';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  const resultado = await page.evaluate(async () => {
    const real = estado.db;
    window.__realDb = real;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'from') return (tabla) => (tabla === 'sis06p_capturas' ? { upsert: async () => ({ error: { message: 'TypeError: Failed to fetch' } }) } : t.from(tabla));
      return t[p];
    } });
    return SIS06PBiovac.save();
  });
  expect(resultado).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sis06p_draft_v1:')).length)).toBe(1);
  await expect(page.locator('#sisb_11_total')).toHaveValue('8');

  await page.evaluate(() => { estado.db = window.__realDb; window.dispatchEvent(new Event('online')); });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sis06p_draft_v1:')).length)).toBe(0);
});

test('SIS-06-P: fuera de su ventana de captura la unidad solo puede ver (y se le explica por qué)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol: 'UNIDAD' });
  await page.evaluate(async () => {
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return (n, a) => (n === 'sis06p_ventana_envio'
        ? Promise.resolve({ data: [{ dentro_prellenado: false, dentro_envio: false, inicio_prellenado: '2099-01-23', inicio_envio: '2099-01-31', fin_envio: '2099-02-07' }], error: null })
        : t.rpc(n, a));
      return t[p];
    } });
    await SIS06PBiovac.init();
  });
  await expect(page.locator('#sisb_11_total')).toBeDisabled();
  await expect(page.locator('#sis06pBannerVentana')).toContainText('todavía no se abre');
  await expect(page.locator('#btnGuardarSIS06P')).toBeHidden();
});

test('Historial: lista los meses con su estatus, es solo consulta y "Ver" abre ese mes', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, {
    rol: 'UNIDAD', estadoCaptura: 'ENVIADO',
    extras: [{ mes: 3, anio: 2026, estado: 'VALIDADO', validado_por: 'Ana', validado_en: '2026-04-02T10:00:00Z', enviado_en: '2026-04-01T10:00:00Z' }]
  });
  await page.evaluate(async () => { await SIS06PBiovac.init(); await SIS06PBiovac.abrirHistorial(); });
  const filas = page.locator('#detalleSISCuerpo tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(page.locator('#detalleSISCuerpo [data-hist-excel]')).toHaveCount(1);   // solo el validado exporta
  await expect(page.locator('#detalleSISCuerpo')).toContainText('Solo consulta');
  await page.locator('#detalleSISCuerpo [data-hist-ver="3|2026"]').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getElementById('selMes').value)).toBe('3');
});

// ---------------------------------------------------------------------------
// Revisores: Influenza y validación con excepción
// ---------------------------------------------------------------------------

test('Revisor: corrige una semana de Influenza de una unidad con SIS enviado y se avisa para actualizar indicadores', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol: 'MUNICIPAL', estadoCaptura: 'ENVIADO' });
  await page.evaluate(async () => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    let d = 1; while (new Date(anio, mes - 1, d).getDay() !== 5) d++;
    const fecha = anio + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    F.tables.influenza_capturas = [{ id: 'i1', clues: 'QTSSA000001', fecha, valores: { r1: 4, r2: 2 }, anio_campana: 'Campaña Influenza 2026-2027', municipio: 'QUERETARO', unidad: 'C.S. Alfa', capturado_por: 'X', sin_movimiento: false }];
    window.__upserts = [];
    window.__corregido = 0;
    document.addEventListener('sis06p:corregido', () => { window.__corregido++; });
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'from') return (tabla) => {
        const api = t.from(tabla);
        if (tabla === 'influenza_capturas') api.upsert = async (rec) => { window.__upserts.push(rec); return { error: null }; };
        return api;
      };
      return t[p];
    } });
    await SIS06PBiovac.init();
    await SIS06PBiovac.abrirEditorInfluenza();
  });
  await expect(page.locator('#detalleSISOverlay')).toHaveClass(/abierto/);
  await expect(page.locator('.ed-inf-in[data-r="r1"]')).toHaveValue('4');
  await page.locator('.ed-inf-in[data-r="r1"]').fill('9');
  await page.locator('#detalleSISPie button', { hasText: 'Guardar cambios' }).click();
  await page.waitForTimeout(500);
  const up = await page.evaluate(() => window.__upserts);
  expect(up.length).toBe(1);
  expect(up[0].valores.r1).toBe(9);
  expect(up[0].valores.r2).toBe(2);
  expect(up[0].sin_movimiento).toBe(false);
  expect(up[0].editado_por).toBe('MUNICIPAL');
  expect(up[0].historial_ediciones.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__corregido)).toBe(1);
});

test('Revisor: la unidad en borrador no se puede corregir (nada que corregir todavía)', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol: 'MUNICIPAL', estadoCaptura: 'BORRADOR' });
  await page.evaluate(async () => { await SIS06PBiovac.init(); await SIS06PBiovac.abrirEditorInfluenza(); });
  await expect(page.locator('#detalleSISOverlay')).not.toHaveClass(/abierto/);
  await expect(page.locator('#toast')).toContainText('todavía no envía');
});

async function validarConDiferencias(page, rol) {
  await abrir(page, 'MUNICIPAL');
  await prepararSIS(page, { rol, estadoCaptura: 'ENVIADO' });
  await page.evaluate(async () => {
    window.__rpcs = [];
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return (n, a) => {
        window.__rpcs.push(n);
        if (n === 'sis06p_marcar_validado') return Promise.resolve({ data: null, error: { message: 'No se puede validar: B.C.G. (paloteo 5, aplicado en Movimiento 0) no coinciden en: BCG.' } });
        if (n === 'sis06p_validar_con_excepcion') return Promise.resolve({ data: null, error: null });
        return t.rpc(n, a);
      };
      return t[p];
    } });
    await SIS06PBiovac.init();
    document.getElementById('btnMarcarValidado').click();
  });
  await page.waitForSelector('#modalOverlay.abierto');
  await page.locator('#modalBtnAceptar').click();   // confirma "Marcar como Validado"
  await page.waitForTimeout(500);
}

test('Validar con diferencias: ADMIN puede autorizar una excepción con motivo (queda registrada)', async ({ page }) => {
  await validarConDiferencias(page, 'ADMIN');
  await page.waitForSelector('#modalOverlay.abierto');
  await expect(page.locator('#modalTitulo')).toHaveText('Validar con excepción');
  await page.fill('#modalInputMotivo', 'Se aplicó SRP por falta de SR; autorizado por jurisdicción');
  await page.locator('#modalBtnAceptar').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__rpcs.includes('sis06p_validar_con_excepcion'))).toBe(true);
});

test('Validar con diferencias: el municipal NO tiene excepción, solo el aviso de qué corregir', async ({ page }) => {
  await validarConDiferencias(page, 'MUNICIPAL');
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/abierto/);
  await expect(page.locator('#toast')).toContainText('No se pudo validar');
  expect(await page.evaluate(() => window.__rpcs.includes('sis06p_validar_con_excepcion'))).toBe(false);
});
