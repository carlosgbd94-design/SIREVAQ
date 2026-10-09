// SINBA-SIS de la unidad: accesibilidad y confirmaciones.
//  - Enviar pide confirmación; Cancelar (y Enter con el foco en Cancelar) NO envía.
//  - Cada casilla del paloteo tiene nombre accesible; las tarjetas informan aria-expanded.
//  - Las hojas del dock son pestañas con aria-selected sincronizado y flechas.
//  - El cuadro modal es un diálogo, atrapa el Tab y devuelve el foco.
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

async function prepararUnidad(page) {
  await page.evaluate(() => {
    const F = window.__FAKE;
    const mes = Number(document.getElementById('selMes').value);
    const anio = Number(document.getElementById('selAnio').value);
    estado.perfil = { id: 'u1', rol: 'UNIDAD', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', usuario: 'prueba' };
    F.tables.sis_variables.length = 0;
    F.tables.sis_variables.push(
      { id: 1, fila_excel: 11, biologico: 'BCG', grupo_poblacional: 'Recién nacido', dosis: 'ÚNICA', edad: null, clave_general: 'VBC01', orden: 1, activo: true },
      { id: 2, fila_excel: 12, biologico: 'BCG', grupo_poblacional: '29 días a 11 meses', dosis: 'ÚNICA', edad: null, clave_general: 'VBC02', orden: 2, activo: true }
    );
    F.tables.sis06p_capturas.length = 0;
    F.tables.sis06p_capturas.push({ id: 'c1', clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', mes, anio, estado: 'BORRADOR', valores: { 11: { total: 5 } }, ajustes: {}, updated_at: '2026-09-01T00:00:00Z' });
  });
  await page.evaluate(async () => {
    document.getElementById('panelSIS06P').style.display = 'block';
    await SIS06PBiovac.init();
  });
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('Enviar pide confirmación: Cancelar y Enter sobre Cancelar no envían; Aceptar sí', async ({ page }) => {
  await abrir(page);
  await prepararUnidad(page);
  await page.evaluate(() => {
    window.__rpcEnviar = 0;
    const b = document.getElementById('btnEnviarSIS06P');
    b.style.display = 'inline-flex'; b.disabled = false;
    const real = estado.db;
    estado.db = new Proxy(real, { get(t, p) {
      if (p === 'rpc') return async (n, a) => {
        if (n === 'sis06p_comparativo') return { data: [], error: null };
        if (n === 'sis06p_enviar_para_validacion') { window.__rpcEnviar++; return { data: null, error: null }; }
        return t.rpc(n, a);
      };
      return t[p];
    } });
  });

  // Cancelar con el ratón
  await page.locator('#btnEnviarSIS06P').click();
  await expect(page.locator('#modalTitulo')).toHaveText('Enviar el SINBA-SIS para validación');
  await expect(page.locator('#modalOverlay [role=dialog]')).toHaveAttribute('aria-modal', 'true');
  await page.locator('#modalBtnCancelar').click();
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/abierto/);
  expect(await page.evaluate(() => window.__rpcEnviar)).toBe(0);
  // el foco regresa al botón que abrió el diálogo
  await expect(page.locator('#btnEnviarSIS06P')).toBeFocused();

  // Enter con el foco en Cancelar cancela (antes confirmaba por la espalda)
  await page.locator('#btnEnviarSIS06P').click();
  await page.locator('#modalBtnCancelar').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/abierto/);
  expect(await page.evaluate(() => window.__rpcEnviar)).toBe(0);

  // Tab queda atrapado dentro del cuadro
  await page.locator('#btnEnviarSIS06P').click();
  await page.locator('#modalBtnAceptar').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#modalBtnCancelar')).toBeFocused();
  await page.keyboard.press('Escape');

  // Aceptar sí envía
  await page.locator('#btnEnviarSIS06P').click();
  await page.locator('#modalBtnAceptar').click();
  await expect.poll(() => page.evaluate(() => window.__rpcEnviar)).toBe(1);
});

test('Paloteo: casillas con nombre accesible, tarjeta con aria-expanded y subconteo inválido marcado', async ({ page }) => {
  await abrir(page);
  await prepararUnidad(page);

  await expect(page.locator('#sisb_11_total')).toHaveAttribute('aria-label', 'BCG, Recién nacido, ÚNICA: total');
  await expect(page.locator('#sisb_11_afro')).toHaveAttribute('aria-label', 'BCG, Recién nacido, ÚNICA: Afromexicano');

  const cab = page.locator('.sis-card-header').first();
  await expect(cab).toHaveAttribute('aria-expanded', 'false');
  await cab.click();
  await expect(cab).toHaveAttribute('aria-expanded', 'true');
  const idCuerpo = await cab.getAttribute('aria-controls');
  await expect(page.locator('#' + idCuerpo)).toHaveCount(1);

  // un subconteo mayor al total se marca como inválido (no solo en rojo)
  await page.locator('#sisb_11_afro').fill('9');
  await expect(page.locator('#sisb_11_afro')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#sisb_11_afro').fill('2');
  await expect(page.locator('#sisb_11_afro')).not.toHaveAttribute('aria-invalid', 'true');
});

test('Hojas del dock: aria-selected sigue a la hoja activa y las flechas cambian de hoja', async ({ page }) => {
  await abrir(page);
  // el dock puede quedar oculto tras el acceso; se acciona por DOM (foco y teclado reales del navegador)
  const r = await page.evaluate(async () => {
    const sis = document.getElementById('btnSeccionSIS06P');
    const mov = document.getElementById('btnSeccionMovimiento');
    document.getElementById('toggleSeccionUnidad').style.display = 'flex';
    document.body.classList.add('con-dock'); document.getElementById('dockHojas').style.display = 'flex';
    sis.style.display = 'inline-flex'; mov.style.display = 'inline-flex';
    sis.click();
    await new Promise((res) => setTimeout(res, 100));
    const antes = [sis.getAttribute('aria-selected'), mov.getAttribute('aria-selected')];
    sis.focus();
    sis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((res) => setTimeout(res, 100));
    const chain = []; for (let e = mov; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none') chain.push(e.id || e.className || e.tagName); }
    return { chain, antes, despues: [sis.getAttribute('aria-selected'), mov.getAttribute('aria-selected')], foco: document.activeElement.id };
  });
  expect(r.antes).toEqual(['true', 'false']);
  expect(r.despues).toEqual(['false', 'true']);
  expect(r.foco).toBe('btnSeccionMovimiento');
});

test('Accesibilidad global: iconos decorativos ocultos, botones con nombre, enlace para saltar y foco visible', async ({ page }) => {
  await abrir(page);
  await prepararUnidad(page);
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const iconos = [...document.querySelectorAll('.material-symbols-rounded')];
    const sinOcultar = iconos.filter((e) => !e.closest('[aria-hidden="true"]') && !e.hasAttribute('aria-hidden') && !e.getAttribute('aria-label')).length;
    const sinNombre = [...document.querySelectorAll('button, a[href]')].filter((b) => {
      const c = b.cloneNode(true); c.querySelectorAll('.material-symbols-rounded').forEach((n) => n.remove());
      return !(b.getAttribute('aria-label') || b.title || (c.textContent || '').trim());
    }).length;
    const salto = document.querySelector('.saltar-contenido');
    const estilo = document.querySelector('style[data-a11y-global]');
    return { iconos: iconos.length, sinOcultar, sinNombre, salto: Boolean(salto), reduce: estilo ? estilo.textContent.includes('prefers-reduced-motion') : false, foco: estilo ? estilo.textContent.includes(':focus-visible') : false };
  });
  expect(r.iconos).toBeGreaterThan(0);
  expect(r.sinOcultar).toBe(0);
  expect(r.sinNombre).toBe(0);
  expect(r.salto).toBe(true);
  expect(await page.locator('main#contenidoPrincipal').count()).toBe(1);               // la pantalla tiene su zona principal (landmark)
  expect(r.reduce).toBe(true);
  expect(r.foco).toBe(true);
  // "Saltar al contenido" es lo primero que enfoca el Tab y lleva al título de la pantalla
  // es el PRIMER elemento del documento (lo primero que alcanza el Tab al cargar) y lleva al título de la pantalla
  expect(await page.evaluate(() => document.body.firstElementChild.classList.contains('saltar-contenido'))).toBe(true);
  await page.focus('.saltar-contenido');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).toMatch(/^H[12]$/);
});

test('Responsable: el usuario técnico (CLUES_NOMBRE) no se ofrece como persona; sin nombre no se envía', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate(() => ({
    tecnico: [esNombreTecnico('QTSSA012561_UMME_AMBULANCIA_1'), esNombreTecnico('QTSSA001834_SAN_PABLO'), esNombreTecnico('UMME_AMBULANCIA')],
    persona: [esNombreTecnico('Ana Pérez López'), esNombreTecnico('Dr. Luis Gómez'), esNombreTecnico('prueba')],
    sugerido: nombrePersonaDe({ id: 'x', usuario: 'QTSSA012561_UMME_AMBULANCIA_1' })
  }));
  expect(r.tecnico).toEqual([true, true, true]);
  expect(r.persona).toEqual([false, false, false]);
  expect(r.sugerido).toBe('');
});
