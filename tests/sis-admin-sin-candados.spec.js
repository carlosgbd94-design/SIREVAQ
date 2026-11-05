// ADMIN sin candados en SIS: captura/guarda y envía el SINBA-SIS de una unidad (aun fuera de ventana y sin responsable).
// JURISDICCIONAL conserva el comportamiento de revisor (nada que corregir mientras la unidad no envía).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
test.use({ viewport: { width: 1400, height: 1000 } });

async function abrir(page, rol) {
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1500);
}

async function revisarUnidad(page, rol) {
  await page.evaluate(async (rol) => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'a1', rol, usuario: 'revisor', nombre: 'REVI SOR PRUEBA', municipios_allowed: ['QUERETARO'] };
    estado.unidadesClues = [{ id: 'u-alfa', clues: 'QTSSA000001', nombre: 'C.S. Alfa', municipio: 'QUERETARO' }];
    const sel = document.getElementById('selUnidadRevision');
    sel.innerHTML = '<option value="u-alfa">C.S. Alfa</option>'; sel.value = 'u-alfa';
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: {}, ajustes: {}, capturado_por: '', sin_movimiento: false });
    const real = estado.db;
    window.__rpc = [];
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        window.__rpc.push(n);
        if (n === 'sis06p_comparativo') return { data: [], error: null };
        if (n === 'sis06p_ventana_envio') return { data: [{ dentro_prellenado: false, dentro_envio: false, inicio_prellenado: '2030-01-01', inicio_envio: '2030-01-08', fin_envio: '2030-01-15' }], error: null };
        return t.rpc(n, a);
      };
      return t[p];
    } });
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
    SIS06PBiovac.actualizarDock();
  }, rol);
}

test('ADMIN: ve el paloteo editable, Guardar y Enviar habilitado aunque el mes esté fuera de ventana', async ({ page }) => {
  await abrir(page, 'ADMIN');
  await revisarUnidad(page, 'ADMIN');
  await expect(page.locator('#btnGuardarSIS06P')).toBeVisible();
  await expect(page.locator('#btnEnviarSIS06P')).toBeVisible();
  await expect(page.locator('#btnEnviarSIS06P')).toBeEnabled();
  await expect(page.locator('#sis06pCaptureGroupsContainer')).not.toContainText('nada que revisar');
});

test('JURISDICCIONAL: sigue sin captura ni Enviar mientras la unidad no envía', async ({ page }) => {
  await abrir(page, 'JURISDICCIONAL');
  await revisarUnidad(page, 'JURISDICCIONAL');
  await expect(page.locator('#btnEnviarSIS06P')).toBeHidden();
  await expect(page.locator('#sis06pCaptureGroupsContainer')).toContainText('nada que revisar');
});

test('ADMIN: ve el selector de unidad y la hoja SIS-06-P; el clic en una unidad del Seguimiento no lo bloquea', async ({ page }) => {
  await abrir(page, 'ADMIN');
  await expect(page.locator('#btnSeccionSIS06P')).toBeVisible();
  await page.click('#btnSeccionSIS06P');
  await expect(page.locator('#wrapUnidadRevision')).toBeVisible();
  expect(await page.locator('#selUnidadRevision option').count()).toBeGreaterThan(1);
  await page.evaluate(() => {
    const clues = estado.unidadesClues[0].clues;
    window.__sis06pUltimasFilas = [{ clues, municipio: estado.unidadesClues[0].municipio }];
    window.SIS06PDashboard.irARevisarUnidad && window.SIS06PDashboard.irARevisarUnidad(clues);
  });
  await expect(page.locator('.toast, #toast').filter({ hasText: 'Solo el municipal' })).toHaveCount(0);
});
