// Exportación Meta-Logro (plantillas 2026-2027 Individual y Municipal/Jurisdiccional). Sin navegador: ExcelJS en Node.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const raiz = path.join(__dirname, '..');
const X = require(path.join(raiz, 'influenza_meta_logro_export.js'));
const F = (n) => fs.readFileSync(path.join(raiz, 'Formatos', n));
const PLANT_IND = F('Análisis_Meta_Logro_Influenza_2026-2027_UNIDAD_DE_SALUD_Individual.xlsx');
const PLANT_COVID = F('PLANTILLA COVID 2026-2027.xlsx');
const PLANT_MJ = F('Análisis_Meta_Logro_Influenza_2026-2027_UNIDAD_DE_SALUD_Municipal_Jurisdiccional.xlsx');

const modulo = fs.readFileSync(path.join(raiz, 'influenza_module.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
const i0 = modulo.indexOf('const INFLUENZA_RUBROS');
vm.runInContext(modulo.slice(i0, modulo.indexOf('];', i0) + 2).replace('const INFLUENZA_RUBROS', 'var INFLUENZA_RUBROS'), ctx);
const RUBROS = ctx.INFLUENZA_RUBROS;
const IDS = RUBROS.map((r) => r.id);
const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const valor = (ws, r, c) => { const x = ws.getCell(r, c); const v = x.isMerged ? x.master.value : x.value; return v && v.result !== undefined ? v.result : v; };

test('los 46 rubros siguen el orden de las dos plantillas', async () => {
  for (const [plantilla, f0, nombre] of [[PLANT_MJ, 10, 'municipal/jurisdiccional'], [PLANT_IND, 9, 'individual']]) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantilla);
    const ws = wb.getWorksheet(X.HOJA_RESUMEN);
    RUBROS.forEach((rb, k) => {
      expect(norm(valor(ws, f0 + k, 6)), `${nombre} ${rb.id}`).toBe(norm(rb.edad));
      expect(norm(valor(ws, f0 + k, 3)), `${nombre} grupo ${rb.id}`).toBe(norm(rb.grupo));
    });
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(PLANT_IND);
  const oct = wb.getWorksheet('OCTUBRE');
  RUBROS.forEach((rb, k) => expect(norm(valor(oct, 8 + k, 6)), `mes ${rb.id}`).toBe(norm(rb.edad)));
});

test('la semana sigue la regla de viernes del módulo (corte entre semana va en la columna que sigue)', () => {
  expect(X.mesYSemana('2026-10-02')).toEqual({ mes: 'OCTUBRE', semana: 1 });
  expect(X.mesYSemana('2026-10-09')).toEqual({ mes: 'OCTUBRE', semana: 2 });
  expect(X.mesYSemana('2026-10-30')).toEqual({ mes: 'OCTUBRE', semana: 5 });
  expect(X.mesYSemana('2026-11-06')).toEqual({ mes: 'NOVIEMBRE', semana: 1 });
  expect(X.mesYSemana('2026-11-26')).toEqual({ mes: 'NOVIEMBRE', semana: 4 }); // jueves: va con el viernes 27 (4.º)
});

test('Individual: cada captura cae en su mes y su semana; la meta va al resumen', async () => {
  const caps = [
    { fecha: '2026-10-09', valores: { r1: 5, r2: 3 } },
    { fecha: '2026-10-16', valores: { r1: 2 } },
    { fecha: '2026-11-06', valores: { r1: 4 } },
    { fecha: '2026-09-25', valores: { r1: 1 } }
  ];
  const { wb, omitidas } = await X.construirLibroUnidad({ ExcelJS, plantilla: PLANT_IND, rubroIds: IDS, metas: { r1: 50, r2: 20 }, capturas: caps, titulo: 'Unidad prueba' });
  expect(omitidas).toEqual(['2026-09-25']);
  const buf = await wb.xlsx.writeBuffer();
  const w2 = new ExcelJS.Workbook();
  await w2.xlsx.load(buf);
  const oct = w2.getWorksheet('OCTUBRE'), nov = w2.getWorksheet('NOVIEMBRE'), res = w2.getWorksheet(X.HOJA_RESUMEN);
  expect(oct.getCell('H8').value).toBe(5);    // semana 2
  expect(oct.getCell('I8').value).toBe(2);    // semana 3
  expect(oct.getCell('H9').value).toBe(3);
  expect(oct.getCell('G8').value).toBeNull();
  expect(nov.getCell('G8').value).toBe(4);    // semana 1 de noviembre
  expect(res.getCell('H9').value).toBe(50);
  expect(res.getCell('H10').value).toBe(20);
  expect(res.getCell('G9').value.formula).toBe('SUM(OCTUBRE:ABRIL!L8)');
  expect(res.getCell('G9').value.result).toBe(11);
  expect(String(res.getCell('A5').value)).toContain('Unidad prueba');
  expect(String(res.getCell('A4').value)).toContain('Temporada Invernal 2026-2027');   // título fijo aparte del sujeto
  expect(res.getCell('K9').numFmt).toBe(';;;');                                          // la barra de avance no muestra el número
  expect(String(w2.getWorksheet('OCTUBRE').getCell('C5').value)).toContain('OCTUBRE');
});

test('Municipal/Jurisdiccional: un grupo LOGRO|META|% por entidad, total y semáforo en cada %', async () => {
  const ent = ['QUERETARO', 'CORREGIDORA', 'EL MARQUES', 'HUIMILPAN', 'HENM', 'NHG'].map((n, k) => ({
    nombre: n,
    metas: Object.fromEntries(IDS.map((id, i) => [id, 100 + i + k])),
    logros: Object.fromEntries(IDS.map((id, i) => [id, i === 0 ? 50 + k : 0]))
  }));
  const wb = await X.construirLibroEntidades({ ExcelJS, plantilla: PLANT_MJ, rubroIds: IDS, entidades: ent, titulo: 'Jurisdicción prueba', nombreTotal: 'TOTAL JURISDICCIÓN' });
  const buf = await wb.xlsx.writeBuffer();
  const w2 = new ExcelJS.Workbook();
  await w2.xlsx.load(buf);
  const ws = w2.worksheets[0];
  // 6 entidades + total = 7 grupos desde la columna G
  expect(ws.getCell(8, 7).value).toBe('QUERETARO');
  expect(ws.getCell(8, 7 + 5 * 3).value).toBe('NHG');
  expect(ws.getCell(8, 7 + 6 * 3).value).toBe('TOTAL JURISDICCIÓN');
  expect(ws.getCell(9, 7).value).toBe('LOGRO');
  expect(ws.getCell(9, 8).value).toBe('META');
  expect(ws.getCell(9, 9).value).toBe('%');
  expect(ws.getCell(10, 7).value).toBe(50);
  expect(ws.getCell(10, 8).value).toBe(100);
  expect(ws.getCell(10, 9).value.formula).toBe('IFERROR(G10/H10," ")');
  const totalCol = 7 + 6 * 3;
  const sumaLogro = ent.reduce((s, e) => s + e.logros.r1, 0);
  expect(ws.getCell(10, totalCol).value).toBe(sumaLogro);
  expect(ws.getCell(56, 7).value.formula).toBe('SUM(G10:G55)');
  expect(ws.getCell(57, 9).value.formula).toBe('IFERROR(G57/H57," ")'); // % de frascos = logro/meta
  const refs = ws.conditionalFormattings.map((c) => c.ref);
  ['I', 'L', 'O', 'R', 'U', 'X', 'AA'].forEach((col) => expect(refs).toContain(`${col}10:${col}56`));
  const reglas = ws.conditionalFormattings.find((c) => c.ref === 'I10:I56').rules;
  expect(reglas.length).toBe(4);
});

test('con una sola entidad no se agrega el grupo TOTAL', async () => {
  const wb = await X.construirLibroEntidades({ ExcelJS, plantilla: PLANT_MJ, rubroIds: IDS, entidades: [{ nombre: 'UNA', metas: { r1: 10 }, logros: { r1: 5 } }], titulo: 't' });
  const ws = wb.worksheets[0];
  expect(ws.getCell(8, 7).value).toBe('UNA');
  expect(ws.getCell(10, 9).value.result).toBe(0.5);
  expect(ws.getCell(8, 10).value).not.toBe('TOTAL');
  expect(ws.getCell(8, 10).value).toBeNull();   // sin el segundo grupo vacío de la plantilla
  expect(ws.getCell(9, 10).value).toBeNull();
  expect(ws.getCell(10, 12).value).toBeNull();
});

// ─── COVID-19: libro del Concentrado de Avances (simple, con unidades y por semana) ───────────────────────────
const RUBROS_COVID = [
  { id: 'c1', grupo: 'Niñas y niños de 6 a 59 meses', edad: 'Primera (0.25 mL)' },
  { id: 'c2', grupo: 'Niñas y niños de 6 a 59 meses', edad: 'Segunda (0.25 mL)' },
  { id: 'c3', grupo: 'Personas de 5 a 59 años con factores de riesgo', edad: '0.5 mL' },
  { id: 'c4', grupo: 'Personas de 60 años y más', edad: '0.5 mL' },
  { id: 'c5', grupo: 'Personas embarazadas', edad: '0.5 mL' },
  { id: 'c6', grupo: 'Personal de salud', edad: '0.5 mL' }
];
const ent = (nombre, metas, logros) => ({ nombre, metas, logros, marca: { MODERNA: 0, PFIZER: 0 } });

test('COVID-19: libro con una hoja, una columna por entidad y TOTAL en dosis equivalentes (pediátricas a media dosis)', async () => {
  const wb = await X.construirLibroCovid({
    ExcelJS, plantilla: PLANT_COVID, rubros: RUBROS_COVID, titulo: 'JURISDICCIÓN SANITARIA', temporada: '2026-2027', nombreTotal: 'TOTAL JURISDICCIÓN',
    entidades: [
      ent('QUERÉTARO', { c1: 100, c2: 100, c3: 50, c4: 0, c5: 0, c6: 0 }, { c1: 40, c2: 0, c3: 10, c4: 0, c5: 0, c6: 0 }),
      ent('HENM', { c1: 20, c2: 20, c3: 10, c4: 0, c5: 0, c6: 0 }, { c1: 0, c2: 0, c3: 5, c4: 0, c5: 0, c6: 0 })
    ]
  });
  expect(wb.worksheets.length).toBe(2);   // Meta-Logro y la hoja «DOSIS POR MARCA»
  const ws = wb.worksheets[0];
  const heads = [7, 10, 13].map((c) => valor(ws, 7, c));
  expect(heads).toEqual(['QUERÉTARO', 'HENM', 'TOTAL JURISDICCIÓN']);
  const FT = 15;   // 6 rubros desde el renglón 9
  // meta equivalente: Q (100+100)/2 + 50 = 150; H (20+20)/2 + 10 = 30; total 180. Logro: Q 40/2 + 10 = 30; H 5; total 35
  expect([valor(ws, FT, 7), valor(ws, FT, 8)]).toEqual([30, 150]);
  expect([valor(ws, FT, 10), valor(ws, FT, 11)]).toEqual([5, 30]);
  expect([valor(ws, FT, 13), valor(ws, FT, 14)]).toEqual([35, 180]);
});

test('COVID-19 por semana: el total del rango usa la meta una sola vez (no la suma por semana)', async () => {
  const meta = { c1: 100, c2: 100, c3: 50, c4: 0, c5: 0, c6: 0 };   // 150 equivalentes
  const wb = await X.construirLibroCovid({
    ExcelJS, plantilla: PLANT_COVID, rubros: RUBROS_COVID, titulo: 'QUERETARO', temporada: '2026-2027',
    entidades: [ent('Sem 43', meta, { c3: 10 }), ent('Sem 44', meta, { c3: 20 })],
    totalExplicito: ent('TOTAL DEL RANGO', meta, { c3: 30 })
  });
  const ws = wb.worksheets[0];
  expect([7, 10, 13].map((c) => valor(ws, 7, c))).toEqual(['Sem 43', 'Sem 44', 'TOTAL DEL RANGO']);
  expect([valor(ws, 15, 13), valor(ws, 15, 14)]).toEqual([30, 150]);   // 150, no 300
  expect(wb.worksheets[0].name).toBe('META-LOGRO COVID-19');
});

test('COVID-19: hoja «DOSIS POR MARCA» sobre la plantilla (Moderna 1.ª/2.ª dosis y Pfizer por grupo), un bloque por entidad', async () => {
  const metas = { c1: 100, c2: 100, c3: 50, c4: 0, c5: 0, c6: 0 };
  const R0 = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
  const e1 = { nombre: 'UNO', metas, logros: {}, marca: { MODERNA: 0, PFIZER: 0 }, marcaR: { MODERNA: { ...R0, c1: 40, c2: 10, c3: 30, c4: 5, c5: 2, c6: 3 }, PFIZER: R0 } };
  const e2 = { nombre: 'DOS', metas, logros: {}, marca: { MODERNA: 0, PFIZER: 0 }, marcaR: { MODERNA: { ...R0, c1: 8 }, PFIZER: { ...R0, c1: 1, c3: 20, c6: 4 } } };
  const wb = await X.construirLibroCovid({ ExcelJS, plantilla: PLANT_COVID, rubros: RUBROS_COVID, entidades: [e1, e2], titulo: 't', nombreTotal: 'TOTAL' });
  expect(wb.worksheets.map((w) => w.name)).toEqual(['META-LOGRO COVID-19', 'DOSIS POR MARCA']);
  const wm = wb.getWorksheet('DOSIS POR MARCA');
  const c = (r, k) => { const x = wm.getCell(r, k); const y = x.isMerged ? x.master.value : x.value; return y && y.formula ? (y.result === undefined ? 0 : y.result) : y; };
  // Bloque 1 (UNO) en los renglones 7-15 de la plantilla; el bloque 2 (DOS) 11 renglones más abajo
  expect(c(7, 3)).toBe('UNO');
  expect([c(8, 5), c(8, 7)]).toEqual(['MODERNA', 'PFIZER']);
  expect([c(9, 5), c(9, 6)]).toEqual(['1er Dosis', '2a Dosis']);
  expect([c(10, 3), c(10, 5), c(10, 6)]).toEqual(['NIÑOS DE 6 A 59 MESES', 40, 10]);   // Pfizer no aplica a niños: su encabezado cubre el renglón
  expect([c(11, 5), c(12, 5), c(13, 5), c(14, 5)]).toEqual([30, 5, 2, 3]);   // comorbilidades, 60+, embarazadas, salud
  expect([c(15, 5), c(15, 7)]).toEqual([90, 0]);
  expect(c(18, 3)).toBe('DOS');
  expect(c(21, 5)).toBe(8);
  expect([c(22, 7), c(25, 7)]).toEqual([20, 4]);
  expect([c(26, 5), c(26, 7)]).toEqual([8, 24]);
});
