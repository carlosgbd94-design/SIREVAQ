// Movimiento del MUNICIPIO (fila JS1-) desde octubre 2026: se arma SOLO con las unidades (sin botón), la existencia
// anterior no se edita (viene del mes pasado), recibido/aplicadas/desechadas sí, no se precarga de Requisiciones a
// nivel municipio (llega por las unidades) y el detector de discrepancias avisa lo que no cuadra.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');

async function abrir(page) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.__FAKE_ROL__ = 'MUNICIPAL'; });
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

const DISCREPANCIAS = [
  { numero_lote: 'L-ERR', biologico: 'B.C.G.', categoria: 'NORMAL', tipo: 'UNIDAD_CAMBIO_POSTERIOR', severidad: 'ERROR', mensaje: 'Una unidad cambió después de sincronizar.' },
  { numero_lote: 'L-ANT', biologico: 'B.C.G.', categoria: 'NORMAL', tipo: 'ANTERIOR_DISTINTA', severidad: 'INFO', mensaje: 'Existencia anterior distinta: el municipio trae 126 y las unidades declararon 2.' }
];

async function pintar(page, { estadoMov, mes = 10, discrepancias = [] }) {
  await page.evaluate(([e, m, disc]) => {
    const lote = (id, n) => ({ id, numero_lote: n, caducidad: '2027-03-31', biologico_id: 'bio1', dosis_por_frasco_override: null });
    const fila = (id, n, ant, rec) => ({ id, categoria: 'NORMAL', existencia_anterior_frascos: ant, recibido_frascos: rec, aplicadas_a: 0, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: ant + rec, observaciones: null, biovac_lotes: lote('l' + id, n) });
    estado.inicioPorUnidad = '2026-10-01';
    estado.bloques = [{ id: 'b1' }];
    estado.biologicos = [{ id: 'bio1', clave: 'BCG', nombre_excel: 'B.C.G. frasco multidosis', bloque_id: 'b1', orden_en_bloque: 1, presentacion: 'FRASCO', dosis_por_frasco: 10, regla_especial: null, vigente_desde: '2020-01-01', vigente_hasta: null }];
    estado.renglones = [fila('1', '0374MA108', 5, 0)];
    estado.ultimasEdicionesJurisdiccion = new Map();
    estado.movimiento = { id: 'mq', estado: e, anio: 2026, mes: m, unidad_id: 'ps-q', responsable_elaboracion: '', fecha_corte: '2026-10-31' };
    estado.sis06pEstadoActual = null;
    estado.anteriorEditable = true;
    window.__rpcs = [];
    estado.db = {
      from: () => new Proxy({}, { get: (t, p) => (p === 'then' ? (ok) => Promise.resolve({ error: null, data: [] }).then(ok) : (p === 'single' || p === 'maybeSingle') ? async () => ({ data: null, error: null }) : () => estado.db.from()) }),
      rpc: async (n, a) => { window.__rpcs.push([n, a]); return { data: n === 'biovac_discrepancias_municipio' ? disc : (n === 'sis06p_resumen_seguimiento' ? (window.__seg || [{ municipio: 'QUERETARO', estado: 'ENVIADO' }]) : []), error: null }; }
    };
    document.getElementById('btnSeccionMovimiento')?.classList.add('activo');
    render();
  }, [estadoMov, mes, discrepancias]);
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('Movimiento del municipio (octubre en adelante): se arma solo, sin botón, y la existencia anterior no se edita', async ({ page }) => {
  await abrir(page);
  await pintar(page, { estadoMov: 'BORRADOR' });
  await expect(page.locator('#bannerMovimiento')).toContainText('Se arma solo con tus unidades');
  await expect(page.locator('#bannerMovimiento [data-banner="armar"]')).toHaveCount(0);        // sin "Traer de mis unidades"
  await expect(page.locator('#bannerMovimiento button', { hasText: 'Traer' })).toHaveCount(0);
  expect(await page.evaluate(() => anteriorEditablePorRol())).toBe(false);
  expect(await page.evaluate(() => document.getElementById('btnAbrirImportador').style.display)).toBe('none');   // no se importa un Excel manual sobre un Movimiento que se arma solo
  await expect(page.locator('#panelMovimiento .ayuda-franja')).toBeHidden();                                   // sin texto repetido
  await expect(page.locator('table.renglones input.ant-input')).toHaveCount(0);                // anterior bloqueada
  expect(await page.locator('table.renglones input[data-campo="recibido_frascos"]').count()).toBeGreaterThan(0);   // recibido sí
});

test('Detector de discrepancias: avisa lo que no cuadra entre unidades y municipio', async ({ page }) => {
  await abrir(page);
  await pintar(page, { estadoMov: 'BORRADOR', discrepancias: DISCREPANCIAS });
  const caja = page.locator('#discrepanciasMunicipio');
  await expect(caja).toContainText('1 por corregir');
  await expect(caja).toContainText('1 informativas');
  await expect(caja.locator('details')).toHaveAttribute('open', '');                            // con errores se abre sola
  await expect(caja).toContainText('Una unidad cambió después');
  await expect(caja).toContainText('lote L-ANT');
  const llamada = await page.evaluate(() => window.__rpcs.find((r) => r[0] === 'biovac_discrepancias_municipio'));
  expect(llamada[1]).toEqual({ p_municipio: 'QUERETARO', p_mes: 10, p_anio: 2026 });
  // Sin discrepancias: todo en verde
  await pintar(page, { estadoMov: 'BORRADOR', discrepancias: [] });
  await expect(page.locator('#discrepanciasMunicipio')).toContainText('cuadran en todos los lotes');
  // Si todavía ninguna unidad envió, NO se dice que "todo cuadra": no hay nada que comparar
  await page.evaluate(() => { window.__seg = [{ municipio: 'QUERETARO', estado: 'BORRADOR' }]; });
  await pintar(page, { estadoMov: 'BORRADOR', discrepancias: [] });
  await page.evaluate(() => { window.__seg = [{ municipio: 'QUERETARO', estado: 'BORRADOR' }]; });
  await pintar(page, { estadoMov: 'BORRADOR', discrepancias: [] });
  await expect(page.locator('#discrepanciasMunicipio')).toContainText('Aún ninguna unidad ha enviado');
  await expect(page.locator('#discrepanciasMunicipio')).not.toContainText('cuadran en todos los lotes');
});

test('Desde octubre el municipio NO precarga su requisición (le llega por las unidades); antes de octubre sí se ofrece', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate(async () => {
    estado.inicioPorUnidad = '2026-10-01';
    const llamadas = [];
    const original = window.ofrecerCargaDesdeRequisiciones;
    window.ofrecerCargaDesdeRequisiciones = async () => { llamadas.push('municipio'); };
    estado.unidades = [{ id: 'ps-q', clues: 'JS1-QUERETARO', nombre: 'Querétaro', municipio: 'QUERETARO', activo: true }];
    const caso = (anio, mes) => {
      estado.movimiento = { id: 'm', unidad_id: 'ps-q', anio, mes, estado: 'BORRADOR' };
      return movimientoDelMunicipioPorUnidades();
    };
    const out = { oct: caso(2026, 10), sep: caso(2026, 9) };
    window.ofrecerCargaDesdeRequisiciones = original;
    return out;
  });
  expect(r.oct).toBe(true);     // octubre: se arma con unidades -> no se precarga a nivel municipio
  expect(r.sep).toBe(false);    // septiembre: captura manual de siempre
});

test('Antes de octubre el Movimiento del municipio sigue siendo manual (sin aviso de armado)', async ({ page }) => {
  await abrir(page);
  await pintar(page, { estadoMov: 'BORRADOR', mes: 9 });
  await expect(page.locator('#bannerMovimiento')).not.toContainText('se arma solo');
  expect(await page.evaluate(() => anteriorEditablePorRol())).toBe(true);
});

test('Movimiento cerrado del municipio: ya no muestra el aviso de armado y ofrece corregir', async ({ page }) => {
  await abrir(page);
  await pintar(page, { estadoMov: 'CERRADO' });
  await expect(page.locator('#bannerMovimiento')).not.toContainText('se arma solo');
  await expect(page.locator('#bannerMovimiento [data-banner="corregir"]')).toBeVisible();
});
