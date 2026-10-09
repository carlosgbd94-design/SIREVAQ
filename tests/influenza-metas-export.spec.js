// Exportación de metas de Influenza al formato oficial (Formatos/Metas Influenza Querétaro 2025-2026.xlsx).
// No necesita navegador: arma los libros con ExcelJS en Node y revisa hojas, fórmulas y columnas.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const raiz = path.join(__dirname, '..');
const X = require(path.join(raiz, 'influenza_metas_export.js'));
const plantilla = fs.readFileSync(path.join(raiz, 'Formatos', 'Metas Influenza Querétaro 2025-2026.xlsx'));
const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8');

// Rubros y mapeo SIS tal como los define influenza_module.js
const ctx = { window: {} };
vm.createContext(ctx);
const i0 = modulo.indexOf('const INFLUENZA_RUBROS');
vm.runInContext(modulo.slice(i0, modulo.indexOf('];', i0) + 2).replace('const INFLUENZA_RUBROS', 'var INFLUENZA_RUBROS'), ctx);
const j0 = modulo.indexOf('window.INFLUENZA_SIS_MAPPING = {');
vm.runInContext(modulo.slice(j0, modulo.indexOf('};', j0) + 2), ctx);
const RUBROS = ctx.INFLUENZA_RUBROS;
const IDS = RUBROS.map((r) => r.id);
const SIS = ctx.window.INFLUENZA_SIS_MAPPING;

const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const meta = (clues, municipio, base) => ({ clues, municipio, metas: Object.fromEntries(IDS.map((id, k) => [id, base + k])) });
const unidad = (clues, nombre, municipio) => ({ clues, unidad: nombre, municipio });
const construir = (muni, metas, unidades) => X.construirLibroMetas({ ExcelJS, plantilla, muni, campana: '2025-2026', metas, unidades, rubroIds: IDS });

test('los 46 rubros siguen el orden de los renglones 11-56 de la plantilla', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(plantilla);
  const ws = wb.worksheets[0];
  const maestro = (r, c) => { const cel = ws.getCell(r, c); return cel.isMerged ? cel.master.value : cel.value; };
  RUBROS.forEach((rb, k) => {
    expect(norm(ws.getCell(11 + k, 6).value), `edad ${rb.id}`).toBe(norm(rb.edad));
    expect(norm(maestro(11 + k, 3)), `grupo ${rb.id}`).toBe(norm(rb.grupo));
  });
});

test('claves de jeringa: 23x25 = r1..r14 y 22x32 = r15..r46, en el mismo orden que el SIS', () => {
  expect(IDS.slice(0, 14).map((id) => SIS[id])).toEqual(X.CLAVES_JERINGA_23X25);
  expect(IDS.slice(14).map((id) => SIS[id])).toEqual(X.CLAVES_JERINGA_22X32);
  expect(X.CLAVES_JERINGA_23X25).toHaveLength(14);
  expect(X.CLAVES_JERINGA_22X32).toHaveLength(32);
});

test('Querétaro: solo unidades con meta, sin hospitales, con jeringas', async () => {
  const metas = [
    meta(null, 'QUERETARO', 100), meta(null, 'HENM', 50), meta(null, 'NHG', 60),
    meta('QTSSA001793', 'QUERETARO', 10),      // JURICA (urbana)
    meta('QTSSA001904', 'QUERETARO', 7),       // JOFRITO (rural)
    meta('QTSSA001740', 'HENM', 50), meta('QTSSA002901', 'NHG', 60),
    meta('QTSSA999999', 'QUERETARO', 3)        // unidad nueva que la plantilla no trae
  ];
  const sinMeta = meta('QTSSA012585', 'QUERETARO', 0);   // UMME AMB2: existe pero no es operativa
  sinMeta.metas = {};
  const unidades = [unidad('QTSSA001793', 'JURICA', 'QUERETARO'), unidad('QTSSA999999', 'UMME NUEVA', 'QUERETARO'),
    unidad('QTSSA012585', 'UMME AMBULANCIA 2', 'QUERETARO'), unidad('QTSSA003544', 'UMME LA BARRETA', 'QUERETARO')];
  const wb = await construir('QUERETARO', [...metas, sinMeta], unidades);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS UNIDADES URBANAS', 'METAS UNIDADES RURALES', 'Comparación', 'DISTRIBUCIÓN DE JERINGA']);
  const [urb, rur, comp, jer] = wb.worksheets;

  // Urbanas: solo JURICA (sin NHGQ/HENM). Rurales: JOFRITO y la unidad nueva. Nada de AMB2 ni La Barreta
  const encabezados = (ws) => { const o = []; for (let c = 7; c <= 26; c++) { if (ws.getCell(10, c).value) o.push(ws.getCell(10, c).value); } return o; };
  expect(encabezados(urb)).toEqual(['JURICA']);
  expect(encabezados(rur)).toEqual(['JOFRITO', 'UMME NUEVA']);
  expect(urb.getCell('G11').value).toBe(10);
  expect(urb.getCell('G56').value).toBe(10 + 45);
  expect(rur.getCell('G11').value).toBe(7);
  expect(rur.getCell('H11').value).toBe(3);
  expect(urb.getCell('H11').value).toBeNull();
  expect(urb.getCell('AA11').value.formula).toBe('SUM(G11:Z11)');

  // Comparación: solo el municipio (los hospitales van aparte)
  expect(comp.getCell('G5').value.formula).toBe("SUM('METAS UNIDADES URBANAS'!AA11,'METAS UNIDADES RURALES'!AA11)");
  expect(comp.getCell('H5').value).toBe(100);
  expect(comp.getCell('H50').value).toBe(145);

  // Jeringas: 23x25 renglones 11-24 y 22x32 renglones 25-56
  expect(jer.getCell('A2').value).toBe('QTSSA001793');
  expect(jer.getCell('G2').value.formula).toBe("SUM('METAS UNIDADES URBANAS'!G11:G24)");
  expect(jer.getCell('H2').value.formula).toBe("SUM('METAS UNIDADES URBANAS'!G25:G56)");
  expect(jer.getCell('B4').value).toBe('UMME NUEVA');
  expect(jer.getCell('G4').value.formula).toBe("SUM('METAS UNIDADES RURALES'!H11:H24)");
  expect(jer.getCell('B5').value).toBe('TOTAL');
});

test('Hospitales: archivo aparte con la meta asignada por Jurisdicción', async () => {
  const metas = [meta(null, 'HENM', 50), meta(null, 'NHG', 60), meta(null, 'QUERETARO', 100)];   // sin registros por CLUES
  const wb = await construir('HOSPITALES', metas, []);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS UNIDADES', 'Comparación', 'DISTRIBUCIÓN DE JERINGA']);
  const hoja = wb.worksheets[0];
  expect(hoja.getCell('G10').value).toBe('NHGQ');
  expect(hoja.getCell('H10').value).toBe('HENM');
  expect(hoja.getCell('G11').value).toBe(60);
  expect(hoja.getCell('H11').value).toBe(50);
  expect(wb.worksheets[1].getCell('H5').value).toBe(110);
  expect(wb.worksheets[2].getCell('A2').value).toBe('QTSSA002901');
  expect(X.nombreArchivo('HOSPITALES', '2025-2026')).toBe('Metas Influenza Hospitales 2025-2026.xlsx');
});

test('Corregidora: una sola hoja, sin urbanas/rurales, encabezado compacto y libro que reabre', async () => {
  const unidades = [unidad('QTSSA000842', 'LOS ÁNGELES', 'CORREGIDORA'), unidad('QTSSA000830', 'SANTA BARBARA', 'CORREGIDORA'),
    unidad('QTSSA001793', 'JURICA', 'QUERETARO'), unidad('QTSSA000854', 'SIN META', 'CORREGIDORA')];
  const metas = [meta(null, 'CORREGIDORA', 300), meta('QTSSA000830', 'CORREGIDORA', 20), meta('QTSSA000842', 'CORREGIDORA', 5)];
  const wb = await construir('CORREGIDORA', metas, unidades);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['METAS UNIDADES', 'Comparación', 'DISTRIBUCIÓN DE JERINGA']);
  const hoja = wb.worksheets[0];
  expect(hoja.getCell('G10').value).toBe('SANTA BARBARA');   // orden por CLUES
  expect(hoja.getCell('H10').value).toBe('LOS ÁNGELES');
  expect(hoja.getCell('G11').value).toBe(20);
  expect(hoja.getCell('I6').value).toBe('CORREGIDORA');
  expect(hoja.getCell('I5').value).toBe(1);
  expect(hoja.getColumn('G').hidden).toBe(false);
  expect(hoja.getColumn('L').hidden).toBe(false);            // mínimo de columnas visibles
  expect(hoja.getColumn('M').hidden).toBe(true);
  expect(hoja.getColumn('AA').hidden).toBeFalsy();
  expect(wb.worksheets[1].getCell('G5').value.formula).toBe("SUM('METAS UNIDADES'!AA11)");
  expect(wb.worksheets[1].getCell('H5').value).toBe(300);
  expect(wb.worksheets[2].getRow(3).getCell(2).value).toBe('LOS ÁNGELES');
  expect(wb.worksheets[2].getRow(4).getCell(2).value).toBe('TOTAL');

  // El archivo final se puede volver a abrir y conserva los recortes de los logotipos
  const datos = await X.escribirLibro(wb, JSZip);
  const reabierto = new ExcelJS.Workbook();
  await reabierto.xlsx.load(datos);
  expect(reabierto.worksheets).toHaveLength(3);
  const zip = await JSZip.loadAsync(datos);
  const dibujo = await zip.file('xl/drawings/drawing1.xml').async('string');
  expect(dibujo).toContain('<a:srcRect');
});

test('más de 20 unidades en un municipio: continúan en una hoja (2) sin perder ninguna', async () => {
  const unidades = Array.from({ length: 23 }, (_, k) => unidad(`QTSSA0${10000 + k}`, `U${k}`, 'MARQUES'));
  const metas = [meta(null, 'MARQUES', 500), ...unidades.map((u, k) => meta(u.clues, 'MARQUES', k === 22 ? 9 : 1))];
  const wb = await construir('MARQUES', metas, unidades);
  expect(wb.worksheets.map((w) => w.name)).toContain('METAS UNIDADES (2)');
  const h2 = wb.getWorksheet('METAS UNIDADES (2)');
  expect(h2.getCell('G10').value).toBe('U20');
  expect(h2.getCell('I10').value).toBe('U22');
  expect(h2.getCell('I11').value).toBe(9);
  expect(wb.getWorksheet('Comparación').getCell('G5').value.formula).toBe("SUM('METAS UNIDADES'!AA11,'METAS UNIDADES (2)'!AA11)");
  const jer = wb.getWorksheet('DISTRIBUCIÓN DE JERINGA');
  expect(jer.getCell('B24').value).toBe('U22');
  expect(jer.getCell('G24').value.formula).toBe("SUM('METAS UNIDADES (2)'!I11:I24)");
});

test.describe('Archivo de una sola unidad (lo baja la propia unidad)', () => {
  const unidades = [unidad('QTSSA001793', 'JURICA', 'QUERETARO'), unidad('QTSSA001904', 'JOFRITO', 'QUERETARO')];
  const metas = [meta('QTSSA001793', 'QUERETARO', 10), meta('QTSSA001904', 'QUERETARO', 7), meta(null, 'QUERETARO', 500)];
  const solo = (clues, muni, m, u) => X.construirLibroMetas({ ExcelJS, plantilla, muni, campana: '2026-2027', metas: m, unidades: u, rubroIds: IDS, soloClues: clues });
  const nombres = (wb) => wb.worksheets.map((w) => w.name);

  test('unidad rural de Querétaro: solo su hoja, sin «Comparación» y con su columna y sus metas', async () => {
    const wb = await solo('QTSSA001904', 'QUERETARO', metas, unidades);
    expect(nombres(wb)).toEqual(['METAS UNIDADES RURALES', 'DISTRIBUCIÓN DE JERINGA']);
    const ws = wb.getWorksheet('METAS UNIDADES RURALES');
    expect(norm(ws.getCell(10, 7).value)).toBe('jofrito');
    expect(ws.getCell(10, 8).value == null).toBe(true);                 // ninguna otra unidad
    expect(ws.getCell(11, 7).value).toBe(7);                            // meta del rubro r1
    expect(ws.getCell(11 + 45, 7).value).toBe(7 + 45);                  // y del r46
    const jer = wb.getWorksheet('DISTRIBUCIÓN DE JERINGA');
    expect(jer.getCell(2, 1).value).toBe('QTSSA001904');
    expect(jer.getCell(3, 2).value).toBe('TOTAL');                      // una sola unidad + total
  });

  test('unidad urbana de Querétaro: solo la hoja de urbanas', async () => {
    const wb = await solo('QTSSA001793', 'QUERETARO', metas, unidades);
    expect(nombres(wb)).toEqual(['METAS UNIDADES URBANAS', 'DISTRIBUCIÓN DE JERINGA']);
    expect(norm(wb.getWorksheet('METAS UNIDADES URBANAS').getCell(10, 7).value)).toBe('jurica');
  });

  test('hospital: usa la meta de su destino y su propia hoja', async () => {
    const hosp = [meta(null, 'HENM', 40)];
    const wb = await solo('QTSSA001740', 'HOSPITALES', hosp, []);
    expect(nombres(wb)).toEqual(['METAS UNIDADES', 'DISTRIBUCIÓN DE JERINGA']);
    const ws = wb.getWorksheet('METAS UNIDADES');
    expect(norm(ws.getCell(10, 7).value)).toBe('henm');
    expect(ws.getCell(11, 7).value).toBe(40);
  });

  test('unidad sin meta: no genera archivo vacío', async () => {
    await expect(solo('QTSSA001793', 'QUERETARO', [meta('QTSSA001904', 'QUERETARO', 7)], unidades)).rejects.toThrow(/no tiene metas/);
  });

  test('nombre del archivo de la unidad', () => {
    expect(X.nombreArchivoUnidad('PIE DE GALLO', '2026-2027')).toBe('Metas Influenza PIE DE GALLO 2026-2027.xlsx');
    expect(X.nombreArchivoUnidad('A/B: "C"', '2026-2027')).toBe('Metas Influenza A B C 2026-2027.xlsx');
  });
});


test('el libro exportado no trae vínculos a hojas o libros de la plantilla original', async () => {
  const metas = [meta('QTSSA001793', 'QUERETARO', 10), meta(null, 'QUERETARO', 10)];
  for (const muni of ['QUERETARO', 'CORREGIDORA', 'HOSPITALES']) {
    const wb = await construir(muni, metas, [unidad('QTSSA001793', 'JURICA', 'QUERETARO')]);
    const zip = await JSZip.loadAsync(await X.escribirLibro(wb, JSZip));
    const nombres = Object.keys(zip.files);
    expect(nombres.filter((n) => /externalLink|connections|queryTable/i.test(n)), muni).toEqual([]);
    for (const n of nombres.filter((n) => /xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      const xml = await zip.file(n).async('string');
      expect(xml, `${muni} ${n}`).not.toMatch(/CLUES JS1|XLOOKUP|\[\d+\]/);
    }
  }
});
