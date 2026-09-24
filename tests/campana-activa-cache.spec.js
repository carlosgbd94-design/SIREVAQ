// Verifica getActiveCampaign() (main.js): una sola petición para llamadas simultáneas (aviso N+1 de
// Sentry en la carga de la página), reutilización por TTL, invalidación y que no se cachean errores.
// Se extrae el bloque de main.js y se evalúa con un Supabase simulado.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const inicio = src.indexOf('const ACTIVE_CAMPAIGN_TTL_MS');
const fin = src.indexOf('/**\n * 🔐 handleLoginFlow');
const bloque = src.slice(inicio, fin);

async function montar(page) {
  await page.goto('/__blank_camp');
  await page.evaluate((code) => {
    window.__llamadas = 0;
    window.__respuesta = () => ({ data: { id: 1, nombre: 'Campaña Influenza 2026-2027' }, error: null });
    window.supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => { window.__llamadas++; return new Promise((r) => setTimeout(() => r(window.__respuesta()), 30)); } }) }) }) };
    // eslint-disable-next-line no-eval
    (0, eval)(code + '\nwindow.getActiveCampaign = getActiveCampaign; window.invalidateActiveCampaign = invalidateActiveCampaign;');
  }, bloque);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/__blank_camp', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
});

test('5 llamadas simultáneas hacen UNA sola petición', async ({ page }) => {
  await montar(page);
  const r = await page.evaluate(async () => {
    const res = await Promise.all([1, 2, 3, 4, 5].map(() => window.getActiveCampaign()));
    return { llamadas: window.__llamadas, nombres: res.map((x) => x.data.nombre) };
  });
  expect(r.llamadas).toBe(1);
  expect(new Set(r.nombres).size).toBe(1);
});

test('reutiliza el resultado y se vuelve a pedir tras invalidar', async ({ page }) => {
  await montar(page);
  const r = await page.evaluate(async () => {
    await window.getActiveCampaign(); await window.getActiveCampaign();
    const antes = window.__llamadas;
    window.invalidateActiveCampaign();
    await window.getActiveCampaign();
    return { antes, despues: window.__llamadas };
  });
  expect(r).toEqual({ antes: 1, despues: 2 });
});

test('no cachea errores', async ({ page }) => {
  await montar(page);
  const r = await page.evaluate(async () => {
    window.__respuesta = () => ({ data: null, error: { message: 'boom' } });
    const a = await window.getActiveCampaign();
    window.__respuesta = () => ({ data: { id: 2, nombre: 'ok' }, error: null });
    const b = await window.getActiveCampaign();
    return { errorA: !!a.error, dataB: b.data && b.data.nombre, llamadas: window.__llamadas };
  });
  expect(r).toEqual({ errorA: true, dataB: 'ok', llamadas: 2 });
});
