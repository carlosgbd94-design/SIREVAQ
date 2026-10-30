// Captura semanal de COVID-19 por marca: validación, paquete CeNSIA, sumas para SIS-06-P y Movimiento, y el panel.
const { test, expect } = require('@playwright/test');
const path = require('path');

const raiz = path.join(__dirname, '..');
const C = require(path.join(raiz, 'covid_captura.js'));

const valores = {
  MODERNA: { c1: 10, c2: 4, c3: 6, c4: 20, c5: 3, c6: 7 },
  PFIZER: { c3: 5, c4: 8, c5: 2, c6: 1 }
};

test('Paquete CeNSIA: casillas por marca, comorbilidades a 12-59 y sin «Otra»/«Otros»', () => {
  const p = C.paqueteCensia(valores);
  expect(p).toEqual({
    BIE200CM: 10, BIE200CM2: 4, BIE103_12a59aCM: 6, BIE40CM: 20, BIO96CM: 3, BIO97CM: 7,
    BIE103_12a59aCP: 5, BIE40CP: 8, BIO96CP: 2, BIO97CP: 1
  });
  expect(Object.keys(p).some((k) => /CO$|148|149|150|151|5a11a/.test(k))).toBe(false);
});

test('Pfizer en niños de 6 a 59 meses se descarta; negativos y decimales se limpian', () => {
  const v = C.limpiar({ MODERNA: { c1: -3, c3: 2.9 }, PFIZER: { c1: 50, c2: 9, c4: '7' } });
  expect(v.PFIZER.c1).toBeUndefined();
  expect(v.MODERNA.c1).toBe(0);
  expect(v.MODERNA.c3).toBe(2);
  expect(v.PFIZER.c4).toBe(7);
});

test('SIS: Moderna + Pfizer se suman por clave (VCV38/39/28/16/20/21) y VCV40 no se prellena', () => {
  const s = C.sisPorClave([{ valores }, { valores: { MODERNA: { c1: 1 }, PFIZER: { c4: 2 } } }]);
  expect(s).toEqual({ VCV38: 11, VCV39: 4, VCV28: 11, VCV16: 30, VCV20: 5, VCV21: 8 });
  expect(s.VCV40).toBeUndefined();
  expect(C.SIS_REFUERZO_6_59.activo).toBe(false);
});

test('Movimiento por marca: Moderna parte 0.25 mL / 0.5 mL, Pfizer todo en una columna', () => {
  const m = C.movimientoPorMarca([{ valores }]);
  expect(m.COVID_MODERNA).toEqual({ a: 14, b: 36 });
  expect(m.COVID_PFIZER).toEqual({ a: 16 });
});

test('Mes: solo semanas cuya fecha cae en el mes', () => {
  const c = [{ fecha: '2026-10-30' }, { fecha: '2026-11-06' }];
  expect(C.delMes(c, 10, 2026)).toHaveLength(1);
});

test('Validación contra la meta: Moderna y Pfizer suman; lo ya guardado no bloquea', () => {
  const metas = { c1: 20, c2: 20, c3: 10, c4: 30, c5: 5, c6: 10 };
  const acum = { c3: 2, c4: 0 };
  let r = C.validar({ MODERNA: { c3: 5 }, PFIZER: { c3: 4 } }, metas, acum, {});
  expect(r.error).toMatch(/supera la meta.*por 1 dosis/);
  r = C.validar({ MODERNA: { c3: 4 }, PFIZER: { c3: 4 } }, metas, acum, {});
  expect(r.error).toBeNull();
  // ya estaba guardado por encima: no se bloquea mientras no suba
  r = C.validar({ MODERNA: { c4: 40 } }, metas, {}, { MODERNA: { c4: 40 } });
  expect(r.error).toBeNull();
  // sin meta en el rubro
  r = C.validar({ MODERNA: { c5: 1 } }, { c1: 1 }, {}, {});
  expect(r.error).toMatch(/no tiene meta/);
});

test('Panel: mismo diseño que Influenza, una tabla con Moderna y Pfizer lado a lado, avisa excesos y valida al recoger', async ({ page }) => {
  await page.setContent('<div id="covidCapturaContainer"></div>');
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura_ui.js') });
  const pintado = await page.evaluate(() => window.CovidCapturaUI.render({
    container: document.getElementById('covidCapturaContainer'),
    metas: { c1: 20, c2: 20, c3: 10, c4: 30, c5: 5, c6: 10 },
    capturas: [], fecha: '2026-10-30', cerrada: false, USER: { clues: 'QTIMB000001' }
  }));
  expect(pintado).toBe(true);
  await expect(page.locator('.inf-cap-tabla')).toHaveCount(1);        // un solo cuadro, ambas marcas
  await expect(page.locator('.inf-input')).toHaveCount(10);           // Moderna 6 + Pfizer 4 (sin 6-59 meses)
  await expect(page.locator('#input_cov_PFIZER_c1')).toHaveCount(0);
  await page.locator('#input_cov_MODERNA_c3').fill('8');
  await page.locator('#input_cov_PFIZER_c3').fill('5');
  await expect(page.locator('#disp_cov_c3')).toContainText('Te pasas por 3');
  const mal = await page.evaluate(() => window.CovidCapturaUI.recoger());
  expect(mal.error).toMatch(/supera la meta/);
  await page.locator('#input_cov_PFIZER_c3').fill('2');
  await page.locator('#input_cov_MODERNA_c4').fill('12');
  const g = await page.evaluate(() => window.CovidCapturaUI.recoger());
  expect(g.error).toBeNull();
  expect(g.valores.MODERNA.c3).toBe(8);
  expect(g.valores.PFIZER.c3).toBe(2);
  expect(g.valores.MODERNA.c4).toBe(12);
  expect(g.sin_movimiento).toBe(false);
  expect(await page.evaluate(() => window.CovidCapturaUI.totalActual())).toBe(22);
});

test('Sin meta de COVID-19 el panel no se pinta', async ({ page }) => {
  await page.setContent('<div id="covidCapturaContainer"></div>');
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura_ui.js') });
  const r = await page.evaluate(() => window.CovidCapturaUI.render({
    container: document.getElementById('covidCapturaContainer'), metas: null, capturas: [], fecha: '2026-10-30', cerrada: false, USER: {}
  }));
  expect(r).toBe(false);
});

test('Panel con reporte guardado: ofrece CeNSIA y entrega el paquete con casillas por marca', async ({ page }) => {
  await page.setContent('<div id="covidCapturaContainer"></div>');
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura_ui.js') });
  await page.evaluate((v) => {
    window.__paquete = null;
    window.CovidCapturaUI.render({
      container: document.getElementById('covidCapturaContainer'),
      metas: { c3: 50, c4: 50 },
      capturas: [{ fecha: '2026-10-30', valores: v, folio: 'COV-20261030-AAAA' }], fecha: '2026-10-30', cerrada: false,
      USER: { clues: 'QTIMB000001' },
      censia: { url: 'https://censia.test/', hoy: () => '2026-11-02', fechaAplicacion: () => '2026-10-31', enviarPaquete: (p) => { window.__paquete = p; return 'https://censia.test/#x'; } }
    });
    document.getElementById('cvcCensiaAbrir').addEventListener('click', (e) => e.preventDefault());
  }, valores);
  await expect(page.locator('.inf-reemplazo')).toContainText('COV-20261030-AAAA');
  await page.locator('#cvcCensiaAbrir').click();
  const p = await page.evaluate(() => window.__paquete);
  expect(p.fecha).toBe('2026-10-31');
  expect(p.valores.BIE200CM).toBe(10);
  expect(p.valores.BIO97CP).toBe(1);
});

// ---- Calendario: la 2ª dosis de 6 a 59 meses (c2) no va en el 1er mes de la campaña (igual que Influenza) ----
test.describe('COVID-19: 2ª dosis bloqueada el 1er mes', () => {
  const R = require(path.join(raiz, 'influenza_reglas.js'));
  const INI = '2026-10-01', FIN = '2027-01-31';
  const conReglas = () => { global.InfluenzaReglas = R; };

  test('c2 se bloquea antes de inicio + 1 mes y se abre desde esa fecha; el resto de rubros nunca', () => {
    conReglas();
    expect(C.reglaRubro('c2', '2026-10-16', INI, FIN).etiqueta).toBe('Desde 1 nov');
    expect(C.reglaRubro('c2', '2026-10-30', INI, FIN)).not.toBeNull();
    expect(C.reglaRubro('c2', '2026-11-06', INI, FIN)).toBeNull();
    ['c1', 'c3', 'c4', 'c5', 'c6'].forEach((r) => expect(C.reglaRubro(r, '2026-10-16', INI, FIN)).toBeNull());
  });

  test('validar rechaza dosis nuevas en un rubro bloqueado y acepta el resto', () => {
    conReglas();
    const reglas = { c2: C.reglaRubro('c2', '2026-10-16', INI, FIN) };
    const v = { MODERNA: { c1: 2, c2: 3 }, PFIZER: {} };
    const r = C.validar(v, { c1: 10, c2: 10 }, {}, {}, reglas);
    expect(r.error).toContain('2ª dosis');
    expect(r.error).toContain('1 nov 2026');
    expect(C.validar({ MODERNA: { c1: 2 }, PFIZER: {} }, { c1: 10, c2: 10 }, {}, {}, reglas).error).toBeNull();
    // ya abierta (noviembre) no estorba
    expect(C.validar(v, { c1: 10, c2: 10 }, {}, {}, { c2: C.reglaRubro('c2', '2026-11-06', INI, FIN) }).error).toBeNull();
  });

  test('el panel deshabilita c2 con su etiqueta «Desde 1 nov» y avisa; en noviembre queda habilitado', async ({ page }) => {
    await page.setContent('<div id="covidCapturaContainer"></div>');
    await page.addScriptTag({ path: path.join(raiz, 'influenza_reglas.js') });
    await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
    await page.addScriptTag({ path: path.join(raiz, 'covid_captura_ui.js') });
    const pintar = (fecha) => page.evaluate((f) => window.CovidCapturaUI.render({
      container: document.getElementById('covidCapturaContainer'), metas: { c1: 50, c2: 50, c3: 50 }, capturas: [], fecha: f, cerrada: false, USER: {},
      reglaRubro: (r) => window.CovidCaptura.reglaRubro(r, f, '2026-10-01', '2027-01-31')
    }), fecha);
    await pintar('2026-10-16');
    await expect(page.locator('#input_cov_MODERNA_c2')).toBeDisabled();
    await expect(page.locator('#input_cov_MODERNA_c1')).toBeEnabled();
    await expect(page.locator('.inf-pill-regla')).toHaveText('Desde 1 nov');
    await expect(page.locator('.inf-aviso')).toContainText('2ª dosis no disponible esta semana');
    await pintar('2026-11-06');
    await expect(page.locator('#input_cov_MODERNA_c2')).toBeEnabled();
    await expect(page.locator('.inf-aviso')).toHaveCount(0);
  });
});

test('Tope por marca: no se puede aplicar más de lo repartido; sin reparto registrado no hay tope; lo ya guardado no bloquea', () => {
  const metas = { c1: 100, c2: 100, c3: 100, c4: 100, c5: 100, c6: 100 };
  const rep = { MODERNA: 50, PFIZER: 12 };   // 10 frascos Moderna (5) y 2 de Pfizer (6), en dosis de 0.5 mL
  // Moderna: 40 acumuladas + 8 de 0.5 mL + 4 pediátricas (2 eq) = 50: justo, no bloquea
  let r = C.validar({ MODERNA: { c4: 8, c1: 4 } }, metas, {}, {}, null, { repartido: rep, acumMarca: { MODERNA: 40, PFIZER: 0 } });
  expect(r.error).toBeNull();
  // una más: 51 > 50
  r = C.validar({ MODERNA: { c4: 9, c1: 4 } }, metas, {}, {}, null, { repartido: rep, acumMarca: { MODERNA: 40, PFIZER: 0 } });
  expect(r.error).toMatch(/habría aplicado 51 dosis de Moderna y solo tiene 50 repartidas \(te pasas por 1\)/);
  expect(r.abasto[0]).toMatchObject({ marca: 'MODERNA', exceso: 1 });
  // Pfizer: 13 > 12; Moderna sigue en su tope
  r = C.validar({ PFIZER: { c3: 13 } }, metas, {}, {}, null, { repartido: rep, acumMarca: { MODERNA: 0, PFIZER: 0 } });
  expect(r.error).toMatch(/Pfizer.*te pasas por 1/);
  // sin reparto registrado: no hay contra qué comparar
  r = C.validar({ MODERNA: { c4: 90 } }, metas, {}, {}, null, { repartido: null, acumMarca: { MODERNA: 0, PFIZER: 0 } });
  expect(r.error).toBeNull();
  // ya estaba guardado por encima del reparto: mientras no suba, no se bloquea
  r = C.validar({ MODERNA: { c4: 10 } }, metas, {}, { MODERNA: { c4: 10 } }, null, { repartido: { MODERNA: 5, PFIZER: 0 }, acumMarca: { MODERNA: 0, PFIZER: 0 } });
  expect(r.error).toBeNull();
  // marca sin frascos repartidos pero con reparto de la otra: aplicar de ella ya es pasarse
  r = C.validar({ PFIZER: { c4: 1 } }, metas, {}, {}, null, { repartido: { MODERNA: 50, PFIZER: 0 }, acumMarca: { MODERNA: 0, PFIZER: 0 } });
  expect(r.error).toMatch(/Pfizer/);
});

test('Panel: el control de abasto avisa en vivo cuando se pasa de lo repartido y el guardado se detiene', async ({ page }) => {
  await page.setContent('<div id="covidCapturaContainer"></div>');
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura.js') });
  await page.addScriptTag({ path: path.join(raiz, 'covid_captura_ui.js') });
  await page.evaluate(() => window.CovidCapturaUI.render({
    container: document.getElementById('covidCapturaContainer'),
    metas: { c1: 20, c2: 20, c3: 100, c4: 100, c5: 5, c6: 10 },
    frascos: { MODERNA: 2, PFIZER: 1 },   // 10 dosis de Moderna y 6 de Pfizer
    capturas: [{ fecha: '2026-10-23', valores: { MODERNA: { c4: 6 }, PFIZER: {} } }],
    fecha: '2026-10-30', cerrada: false, USER: { clues: 'QTIMB000001' }
  }));
  const moderna = page.locator('#cvc_ab_MODERNA');
  await expect(moderna).toContainText('6 de 10 dosis');
  await expect(moderna).toHaveAttribute('data-tono', 'good');
  await page.locator('#input_cov_MODERNA_c4').fill('4');
  await expect(moderna).toContainText('10 de 10 dosis');
  await page.locator('#input_cov_MODERNA_c4').fill('7');
  await expect(moderna).toHaveAttribute('data-tono', 'over');
  await expect(moderna).toContainText('Te pasas por 3 dosis');
  const mal = await page.evaluate(() => window.CovidCapturaUI.recoger());
  expect(mal.error).toMatch(/habría aplicado 13 dosis de Moderna y solo tiene 10 repartidas/);
  await page.locator('#input_cov_MODERNA_c4').fill('4');
  expect((await page.evaluate(() => window.CovidCapturaUI.recoger())).error).toBeNull();
  // Sin reparto registrado no se pinta el control ni hay tope
  await page.evaluate(() => window.CovidCapturaUI.render({
    container: document.getElementById('covidCapturaContainer'), metas: { c4: 100 }, frascos: null,
    capturas: [], fecha: '2026-10-30', cerrada: false, USER: { clues: 'QTIMB000001' }
  }));
  await expect(page.locator('.cvc-abasto')).toHaveCount(0);
});
