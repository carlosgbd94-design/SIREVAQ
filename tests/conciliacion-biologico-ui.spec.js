// CONCILIACIÓN DE BIOLÓGICO: botón en el dock del Movimiento (biovac.html), ventana accesible y descarga real del .xlsx.
// Página real con el Supabase simulado de tests/fixtures/fake-biovac.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const EXCELJS = fs.readFileSync(require.resolve('exceljs/dist/exceljs.min.js'), 'utf8');
const JSZIP = fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'), 'utf8');

test.setTimeout(120000);

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs/, (r) => r.fulfill({ contentType: 'application/javascript', body: EXCELJS }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip/, (r) => r.fulfill({ contentType: 'application/javascript', body: JSZIP }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

test('MUNICIPAL: el dock trae «Conciliación», la ventana es un diálogo y descarga el libro de una unidad', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => {
    estado.perfil = { rol: 'MUNICIPAL', usuario: 'muni', nombre: 'Laura', apellido_paterno: 'Soto', apellido_materno: 'Ruiz', municipios_allowed: ['QUERETARO'] };
    window.ConciliacionBiologico.pintar();
  });
  const boton = page.locator('#btnConciliacionDock');
  await expect(boton).toBeAttached();
  await page.evaluate(() => document.getElementById('btnConciliacionDock').click());

  const dialogo = page.getByRole('dialog', { name: /Conciliación de biológico 2026/ });
  await expect(dialogo).toBeVisible();
  // opciones: unidad, municipio completo, un libro por unidad; el mes parte en octubre y no hay meses anteriores
  await expect(dialogo.getByRole('radio')).toHaveCount(3);
  const meses = await dialogo.locator('#concMes option').allTextContents();
  expect(meses.map((m) => m.split(' ')[0])).toEqual(['Octubre', 'Noviembre', 'Diciembre']);
  // la lista de unidades no incluye la fila JS1- del municipio
  const unidades = await dialogo.locator('#concUni option').allTextContents();
  expect(unidades.length).toBe(4);
  expect(unidades.join('|')).not.toContain('JS1-');

  // Escape cierra y devuelve el foco al botón
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);

  // descarga de una unidad
  await page.evaluate(() => document.getElementById('btnConciliacionDock').click());
  await expect(dialogo).toBeVisible();
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), dialogo.locator('#concDescargar').click()]);
  expect(descarga.suggestedFilename()).toMatch(/^CONCILIACION_BIOLOGICO_2026_.*_hasta_.*\.xlsx$/);
  const ruta = await descarga.path();
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(ruta);
  const nombres = wb.worksheets.map((w) => w.name.trim());
  expect(nombres).toContain('SR');
  expect(nombres).not.toContain('ÍNDICE');
  expect(nombres.length).toBe(19);
  const o6 = wb.getWorksheet('SR').getCell('O6').value;
  expect(String(o6)).toMatch(/\(1\)$/);
  expect(String(o6)).toContain('C.S. Alfa');
});

test('MUNICIPAL sin Movimiento en el periodo: el ZIP masivo avisa en vez de descargar un archivo vacío', async ({ page }) => {
  await abrir(page, 'MUNICIPAL');
  await page.evaluate(() => {
    estado.perfil = { rol: 'MUNICIPAL', usuario: 'muni', nombre: 'Laura', apellido_paterno: 'Soto', municipios_allowed: ['QUERETARO'] };
    window.ConciliacionBiologico.pintar();
    document.getElementById('btnConciliacionDock').click();
  });
  const dialogo = page.getByRole('dialog', { name: /Conciliación de biológico 2026/ });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('radio').nth(2).check();
  await expect(dialogo.locator('#concCampoUni')).toBeHidden();
  await dialogo.locator('#concDescargar').click();
  await expect(dialogo.locator('#concEstado')).toContainText('Ninguna unidad tiene Movimiento', { timeout: 60000 });
  await expect(dialogo.locator('#concDescargar')).toBeEnabled();
});

test('UNIDAD: solo ve su unidad (sin elegir municipio) y no aparece el selector de alcance', async ({ page }) => {
  await abrir(page, 'UNIDAD');
  await page.evaluate(() => {
    estado.perfil = { rol: 'UNIDAD', usuario: 'alfa', nombre: 'Ana', apellido_paterno: 'Lopez', clues: 'QTSSA000001' };
    window.ConciliacionBiologico.pintar();
    document.getElementById('btnConciliacionDock').click();
  });
  const dialogo = page.getByRole('dialog', { name: /Conciliación de biológico 2026/ });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('radio')).toHaveCount(0);
  await expect(dialogo.locator('#concMun')).toHaveCount(0);
});
