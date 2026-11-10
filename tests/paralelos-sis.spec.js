// PARALELOS 2026: el libro se arma sobre la plantilla real (Formatos/paralelos_2026_plantilla.xlsx) con lo validado
// en el SINBA-SIS de 4 municipios + 2 hospitales. Prueba en Node (sin navegador): mapeo por clave y por columna,
// modo «mes» (una hoja) y «acumulado» (libro completo con TOTAL), claves corregidas de Tdpa y totales.
const { test, expect } = require('@playwright/test');
const path = require('path');
const ExcelJS = require('exceljs');

const PLANTILLA = path.join(__dirname, '..', 'Formatos', 'paralelos_2026_plantilla.xlsx');
const COL = { QUERETARO: 8, HUIMILPAN: 9, MARQUES: 10, CORREGIDORA: 11, NHG: 13, HENM: 14 };

function cargarModulo() {
  global.window = { ExcelJS };
  delete require.cache[require.resolve('../paralelos_sis.js')];
  require('../paralelos_sis.js');
  return window.SIS06PParalelos;
}
const abrirPlantilla = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(PLANTILLA); const sep = wb.getWorksheet('MES'); sep.name = 'SEPTIEMBRE'; return wb; };
const val = (c) => { const v = c.value; return v && typeof v === 'object' ? Number(v.result) : Number(v); };

// valor determinista por municipio/clave (distinto en cada destino y mes)
const sumasDe = (claves, mes) => {
  const sumas = new Map();
  Object.keys(COL).forEach((m, i) => {
    const mp = new Map();
    claves.forEach((k, j) => mp.set(k, ((j * 7 + i * 3 + mes) % 11)));
    sumas.set(m, mp);
  });
  return sumas;
};

test('PARALELOS octubre: cada clave cae en su fila y cada municipio/hospital en su columna', async () => {
  const P = cargarModulo();
  const wb = await abrirPlantilla();
  const oct = wb.getWorksheet('OCTUBRE');
  const { mapa, corregidas } = P.filasPorClave(oct);
  // Tdpa Afro/Indígena: la plantilla ya trae la clave SIS real VDP52..55 (antes repetía VPD52..55 de DPT)
  expect(corregidas).toEqual([]);
  expect(P.columnasDestino(oct)).toEqual(COL);

  const claves = [...mapa.keys()];
  const { wb: libro, nombreArchivo, resumen } = await P.armar({ modo: 'mes', mes: 10, anio: 2026, wb, traer: async (m) => ({ sumas: sumasDe(claves, m), faltan: [] }) });
  expect(nombreArchivo).toBe('PARALELOS_2026_OCTUBRE.xlsx');
  expect(libro.worksheets.map((w) => w.name)).toEqual(['OCTUBRE']);
  expect(resumen.sinFila).toEqual([]);

  const ws = libro.getWorksheet('OCTUBRE');
  const esperado = sumasDe(claves, 10);
  let revisadas = 0;
  claves.forEach((k) => {
    const r = mapa.get(k);
    Object.entries(COL).forEach(([m, c]) => {
      const e = esperado.get(m).get(k);
      const real = ws.getCell(r, c).value;
      if (!e) expect(real == null, `${k}/${m} vacío`).toBe(true);
      else { expect(val(ws.getCell(r, c)), `${k}/${m}`).toBe(e); revisadas++; }
    });
    // L = municipios, O = jurisdicción (resultado a la vista)
    const suma = (cs) => cs.reduce((a, c) => a + (val(ws.getCell(r, c)) || 0), 0);
    expect(val(ws.getCell(r, 12))).toBe(suma([8, 9, 10, 11]));
    expect(val(ws.getCell(r, 15))).toBe(suma([12, 13, 14]));
  });
  expect(revisadas).toBeGreaterThan(1000);
  // claves de Tdpa corregidas en la hoja
  expect(ws.getCell(365, 2).value).toBe('VDP52');
  // VS001 (VSR en embarazadas) lleva 3 dígitos: también debe tener fila
  expect(mapa.get('VS001')).toBe(370);
  expect(ws.getCell(368, 2).value).toBe('VDP55');
  // TOTAL BCG: L/O con el mismo rango que H (antes sumaban hasta la fila 18, con migrantes)
  expect(ws.getCell('L32').value.formula).toBe('SUM(L12:L16)');
  expect(ws.getCell('O32').value.formula).toBe('SUM(O12:O16)');
  expect(val(ws.getCell('H32'))).toBe([12, 13, 14, 15, 16].reduce((a, r) => a + (val(ws.getCell(r, 8)) || 0), 0));
  expect(ws.getCell('I7').value).toBe('OCTUBRE');
});

test('PARALELOS acumulado: libro completo, octubre y noviembre desde el SIS y TOTAL = suma de los meses', async () => {
  const P = cargarModulo();
  const wb = await abrirPlantilla();
  const claves = [...P.filasPorClave(wb.getWorksheet('OCTUBRE')).mapa.keys()];
  const antesEnero = val(wb.getWorksheet('ENERO').getCell('H12'));
  const antesAgosto = val(wb.getWorksheet('AGOSTO').getCell('H12'));
  const { wb: libro, nombreArchivo } = await P.armar({ modo: 'acumulado', mes: 11, anio: 2026, wb, traer: async (m) => ({ sumas: sumasDe(claves, m), faltan: [] }) });
  expect(nombreArchivo).toBe('PARALELOS_2026_ACUMULADO_hasta_NOVIEMBRE.xlsx');
  expect(libro.worksheets.map((w) => w.name)).toEqual(['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'TOTAL']);
  // enero a septiembre se quedan como venían
  expect(val(libro.getWorksheet('ENERO').getCell('H12'))).toBe(antesEnero);
  expect(val(libro.getWorksheet('AGOSTO').getCell('H12'))).toBe(antesAgosto);
  const r = P.filasPorClave(libro.getWorksheet('OCTUBRE')).mapa.get('VBC01');
  const vOct = val(libro.getWorksheet('OCTUBRE').getCell(r, 9)), vNov = val(libro.getWorksheet('NOVIEMBRE').getCell(r, 9));
  expect(vNov).not.toBe(vOct);
  // TOTAL: suma de la MISMA clave en cada hoja, con la fila y columna reales de cada una (enero tiene otro orden/columnas)
  const tot = libro.getWorksheet('TOTAL').getCell(r, 9);
  expect(tot.formula).toContain('ENERO!G');
  expect(tot.formula).toContain(`OCTUBRE!I${r}`);
  const meses = libro.worksheets.filter((w) => w.name !== 'TOTAL');
  const sumaMeses = meses.reduce((a, w) => {
    const { mapa } = P.filasPorClave(w), col = P.columnasDestino(w).HUIMILPAN, fila = mapa.get('VBC01');
    return a + (fila && col ? (val(w.getCell(fila, col)) || 0) : 0);
  }, 0);
  expect(val(tot)).toBe(sumaMeses);
  expect(libro.calcProperties.fullCalcOnLoad).toBe(true);
});

test('PARALELOS: rechaza meses sin SIS por unidad, otro año, y avisa de claves sin renglón', async () => {
  const P = cargarModulo();
  const traer = async () => ({ sumas: new Map(), faltan: [] });
  await expect(P.armar({ modo: 'mes', mes: 9, anio: 2026, traer })).rejects.toThrow(/octubre/);
  await expect(P.armar({ modo: 'mes', mes: 10, anio: 2027, traer })).rejects.toThrow(/2026/);
  const wb = await abrirPlantilla();
  const sumas = new Map([['QUERETARO', new Map([['BIE01', 5], ['ZZZ99', 4], ['VBC01', 2]])], ['HENM', new Map([['VBC01', 3]])]]);
  const { resumen, wb: libro } = await P.armar({ modo: 'mes', mes: 10, anio: 2026, wb, traer: async () => ({ sumas, faltan: [{ muni: 'HUIMILPAN', etiqueta: 'Huimilpan', motivo: 'Faltan por validar' }] }) });
  expect(resumen.sinFila).toEqual(['ZZZ99']);   // clave que la plantilla no tiene
  expect(resumen.faltan.map((f) => f.muni)).toEqual(['HUIMILPAN']);
  const ws = libro.getWorksheet('OCTUBRE');
  expect(val(ws.getCell('H12'))).toBe(2);
  expect(val(ws.getCell('N12'))).toBe(3);
  expect(val(ws.getCell('H405'))).toBe(5);   // BIE01 (Influenza) en su renglón del bloque
  expect(val(ws.getCell('I12')) || 0).toBe(0);
});

// ---- Interfaz real (biovac_jurisdiccion.html, paso 4 «Informe», con el Supabase simulado de Jurisdicción) ----
const fs = require('fs');
const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-juris.js'), 'utf8');
const EXCELJS_MIN = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'exceljs', 'dist', 'exceljs.min.js'), 'utf8');

async function abrirJuris(page, rol) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs/, (r) => r.fulfill({ contentType: 'application/javascript', body: EXCELJS_MIN }));
  await page.addInitScript((r) => { window.__FAKE_ROL__ = r; }, rol);
  await page.goto('/biovac_jurisdiccion.html', { waitUntil: 'load' });
  await page.waitForSelector('#dockJuris', { state: 'visible', timeout: 15000 });
  await page.selectOption('#selAnio', '2026');
  await page.selectOption('#selMes', '10');
}

test('PARALELOS (UI): en el paso 4 del Concentrado Jurisdiccional, solo JURISDICCIONAL/ADMIN, y descarga el libro del mes con lo validado', async ({ page }) => {
  test.setTimeout(90000);
  await abrirJuris(page, 'JURISDICCIONAL');
  await page.locator('#dockJTabs [data-jpaso="4"]').click();
  await expect(page.locator('#panelPaso4 #paralelosSIS')).toBeVisible();
  const visible = (rol) => page.evaluate((r) => {
    estado.perfil = Object.assign({}, estado.perfil, { rol: r });
    window.SIS06PParalelos.pintar();
    const c = document.getElementById('paralelosSIS');
    return !!c && c.style.display !== 'none';
  }, rol);
  for (const rol of ['UNIDAD', 'MUNICIPAL', 'VISUALIZADOR']) expect(await visible(rol), rol).toBe(false);
  expect(await visible('JURISDICCIONAL')).toBe(true);
  expect(await visible('ADMIN')).toBe(true);

  // el botón respeta el periodo: antes de octubre 2026 está deshabilitado
  await page.evaluate(() => { document.getElementById('selMes').value = '9'; window.SIS06PParalelos.pintar(); });
  await expect(page.locator('#paralelosSIS [data-paralelos="mes"]')).toBeDisabled();
  await page.evaluate(() => { document.getElementById('selMes').value = '10'; window.SIS06PParalelos.pintar(); });
  await expect(page.locator('#paralelosSIS [data-paralelos="mes"]')).toBeEnabled();
  await expect(page.locator('#paralelosSIS [data-paralelos="mes"]')).toContainText('octubre');
  await expect(page.locator('#paralelosSIS [data-paralelos="acumulado"]')).toContainText('enero a octubre');

  // HENM sin validar (el servidor responde error): sale el aviso y se puede descargar de todos modos
  await page.evaluate(() => {
    estado.db = { rpc: async (n, a) => {
      if (n !== 'sis_filas_csv') return { data: [], error: null };
      if (a.p_municipio === 'HENM') return { data: null, error: { message: 'Faltan por validar: QTSSA000001' } };
      const k = { QUERETARO: 5, HUIMILPAN: 1, MARQUES: 2, CORREGIDORA: 3, NHG: 4 }[a.p_municipio];
      return { data: [{ clues: 'C1', municipio: a.p_municipio, variable_sis: 'VBC01', valor: k }, { clues: 'C2', municipio: a.p_municipio, variable_sis: 'VBC01', valor: 10 }, { clues: 'C1', municipio: a.p_municipio, variable_sis: 'VDP52', valor: k }], error: null };
    } };
  });
  await page.locator('#paralelosSIS [data-paralelos="mes"]').click();
  await page.getByRole('button', { name: 'Descargar de todos modos' }).click();
  const d = await page.waitForEvent('download', { timeout: 30000 });
  expect(d.suggestedFilename()).toBe('PARALELOS_2026_OCTUBRE.xlsx');
  const destino = path.join(test.info().outputDir, 'paralelos_oct.xlsx');
  await d.saveAs(destino);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(destino);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['OCTUBRE']);
  const ws = wb.getWorksheet('OCTUBRE');
  expect(val(ws.getCell('H12'))).toBe(15);   // Querétaro: 5 + 10 de dos CLUES
  expect(val(ws.getCell('K12'))).toBe(13);   // Corregidora
  expect(val(ws.getCell('M12'))).toBe(14);   // NHG -> HGQ
  expect(ws.getCell('N12').value == null).toBe(true);    // HENM sin validar: columna vacía
  expect(val(ws.getCell('L12'))).toBe(15 + 11 + 12 + 13);
  expect(val(ws.getCell('O12'))).toBe(15 + 11 + 12 + 13 + 14);
  expect(val(ws.getCell('H365'))).toBe(5);   // VDP52 -> fila 365 (Tdpa afro)
});

// Excel marca "contenido dañado" si no queda ninguna hoja visible o la pestaña activa apunta a una hoja que no existe
async function revisarLibroEscrito(libro, esperadas) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(await libro.xlsx.writeBuffer());
  const xml = await zip.file('xl/workbook.xml').async('string');
  const hojas = [...xml.matchAll(/<sheet [^>]*>/g)].map((m) => m[0]);
  expect(hojas.length).toBe(esperadas);
  const activa = Number(/activeTab="(\d+)"/.exec(xml)[1]), primera = Number(/firstSheet="(\d+)"/.exec(xml)[1]);
  expect(activa).toBeLessThan(hojas.length);
  expect(primera).toBeLessThan(hojas.length);
  expect(hojas[activa]).not.toContain('state="hidden"');
  expect(hojas.some((h) => !h.includes('state="hidden"'))).toBe(true);
  const sel = [];
  for (const f of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const x = await zip.file(f).async('string');
    if (/tabSelected="1"/.test(x)) sel.push(f);
  }
  expect(sel.length).toBe(1);
}

test('PARALELOS: el archivo escrito no queda "dañado" (hojas visibles, pestaña activa válida) y trae Influenza en octubre', async () => {
  const P = cargarModulo();
  let wb = await abrirPlantilla();
  const inf = [...P.filasPorClave(wb.getWorksheet('SEPTIEMBRE')).mapa.entries()].filter(([k, r]) => /^BI[EO]/.test(k) && r >= 404).map(([k]) => k);
  expect(inf.length).toBeGreaterThan(40);
  const claves = [...P.filasPorClave(wb.getWorksheet('OCTUBRE')).mapa.keys()];
  expect(claves).not.toContain('BIE01');                 // octubre no trae el bloque: se copia de la hoja base
  const traer = async (m) => ({ sumas: sumasDe(claves.concat(inf), m), faltan: [] });
  const r1 = await P.armar({ modo: 'mes', mes: 10, anio: 2026, wb, traer });
  expect(r1.resumen.sinFila).toEqual([]);
  await revisarLibroEscrito(r1.wb, 1);
  const ws = r1.wb.getWorksheet('OCTUBRE');
  const mapa = P.filasPorClave(ws).mapa;
  expect(mapa.get('BIE01')).toBe(405);
  const esperado = sumasDe(claves.concat(inf), 10);
  let n = 0;
  inf.forEach((k) => Object.entries(COL).forEach(([m, c]) => { const e = esperado.get(m).get(k); if (e) { expect(val(ws.getCell(mapa.get(k), c)), `${k}/${m}`).toBe(e); n++; } }));
  expect(n).toBeGreaterThan(100);
  const r = mapa.get('BIE28');
  expect(val(ws.getCell(r, 12))).toBe([8, 9, 10, 11].reduce((a, c) => a + (val(ws.getCell(r, c)) || 0), 0));
  const fila451 = [...Array(10).keys()].map((i) => 450 + i - 0).find((x) => /TOTAL INFLUENZA/i.test(String(ws.getCell(x, 1).value || '')));
  expect(fila451).toBe(451);
  expect(val(ws.getCell(451, 8))).toBe(inf.reduce((a, k) => a + (val(ws.getCell(mapa.get(k), 8)) || 0), 0));
  expect(ws.model.merges.some((m) => m === 'A405:A409')).toBe(true);

  wb = await abrirPlantilla();
  const r2 = await P.armar({ modo: 'acumulado', mes: 11, anio: 2026, wb, traer });
  await revisarLibroEscrito(r2.wb, 13);
  // TOTAL por clave: Influenza (filas distintas en cada hoja) y una clave de enero (su hoja tiene otro orden)
  const tot = r2.wb.getWorksheet('TOTAL');
  const tm = P.filasPorClave(tot).mapa;
  const rt = tm.get('BIE01');
  const esperadoTot = r2.wb.worksheets.filter((w) => w.name !== 'TOTAL').reduce((a, w) => {
    const f = P.filasPorClave(w).mapa.get('BIE01'), c = P.columnasDestino(w).QUERETARO;
    return a + (f && c ? (val(w.getCell(f, c)) || 0) : 0);
  }, 0);
  expect(esperadoTot).toBeGreaterThan(val(r2.wb.getWorksheet('OCTUBRE').getCell(405, 8)));   // incluye meses con el bloque en otra fila
  expect(val(tot.getCell(rt, 8))).toBe(esperadoTot);
  expect(tot.getCell(rt, 8).formula).toContain('OCTUBRE!H405');
});
