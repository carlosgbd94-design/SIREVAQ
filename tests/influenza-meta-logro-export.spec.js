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
