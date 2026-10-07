// Excel del concentrado municipal: hojas PALOTEO y SEGUIMIENTO DE BIOLOGICO armadas sobre la plantilla real
// ("SIS QUERETARO AGOSTO 2026.xlsx" recortada en Formatos/concentrado_municipal_plantilla.xlsx).
// Se corre el botón real "Descargar Excel del concentrado" de biovac.html con el Supabase simulado y se
// compara el .xlsx descargado contra lo esperado, para 36 (Querétaro real), 4 (municipio chico) y 40
// (más de las 38 columnas de la plantilla) unidades.
// Para ver los archivos: GUARDAR_PRUEBAS=1 npx playwright test tests/concentrado-municipal-excel.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const raiz = path.join(__dirname, '..');
const FAKE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-biovac.js'), 'utf8');
const EXCELJS = fs.readFileSync(path.join(raiz, 'node_modules', 'exceljs', 'dist', 'exceljs.min.js'), 'utf8');
const MES = 9; const ANIO = 2026;

const QRO = 'QTSSA001764:UMME MÓVIL QUERETARO|QTSSA001793:JURICA|QTSSA001810:MENCHACA|QTSSA001822:SAN ANTONIO DE LA PUNTA|QTSSA001834:SAN PABLO|QTSSA001846:FELIPE CARRILLO PUERTO|QTSSA001851:LOMA BONITA|QTSSA001863:PEDRO ESCOBEDO|QTSSA001904:JOFRITO|QTSSA001916:MONTENEGRO|QTSSA001921:PIE DE GALLO|QTSSA001945:SAN JOSÉ BUENAVISTA|QTSSA001962:SAN MIGUELITO|QTSSA001974:SANTA MARÍA MAGDALENA|QTSSA002003:LA SOLANA|QTSSA002015:TINAJA DE LA ESTANCIA|QTSSA002522:LÁZARO CÁRDENAS|QTSSA002534:SAN PEDRITO PEÑUELAS|QTSSA002703:MENCHACA NORTE|QTSSA003553:UMME CERRO DE LA CRUZ|QTSSA003562:UMME LA LUZ|QTSSA003595:UMME SAN PEDRITO|QTSSA003604:UMME RANCHO LARGO|QTSSA003715:LA GOTERA|QTSSA012240:SAN JOSÉ EL ALTO|QTSSA012276:FAM SAN JOSE BUENAVISTA|QTSSA012281:FAM PEDRO ESCOBEDO|QTSSA012544:FAM PALO ALTO|QTSSA012556:UMME MF1|QTSSA012561:UMME AMBULANCIA 1|QTSSA012631:UMME MEDICO DENTAL|QTSSA012655:SANTA ROSA JAUREGUI|QTSSA012923:SATELITE|QTSSA012976:SAN PEDRO MARTIR|QTSSA012982:LOMAS DE CASA BLANCA|QTSSA013034:TLACOTE EL BAJO'.split('|').map((x) => { const [clues, nombre] = x.split(':'); return { clues, nombre }; });
const MARQUES = 'QTSSA001315:LA CAÑADA|QTSSA001332:AMAZCALA|QTSSA001344:ATONGO|QTSSA001356:SAN MIGUEL LÁZARO CÁRDENAS|QTSSA001390:LA GRIEGA|QTSSA001402:JESÚS MARÍA|QTSSA001426:PALO ALTO|QTSSA001431:EL PARAISO|QTSSA001933:SAN ISIDRO MIRANDA|QTSSA003571:CHICHIMEQUILLAS|QTSSA003580:NAVAJAS|QTSSA012264:FAM CHICHIMEQUILLAS|QTSSA012643:ALFAJAYUCAN|QTSSA012940:LA PIEDAD'.split('|').map((x) => { const [clues, nombre] = x.split(':'); return { clues, nombre }; });
const CLAVES_BIO = ['BCG', 'HEPB', 'HEXAVALENTE', 'DPT', 'ROTAVIRUS', 'NEUMO_13V', 'NEUMO_20V', 'SRP', 'ANTIINFLUENZA', 'SR', 'VPH', 'TD', 'TDPA', 'COVID_MODERNA', 'COVID_PFIZER', 'VARICELA', 'HEPA', 'VSR'];

function variablesDelCatalogo() {
  const [, ...lineas] = fs.readFileSync(path.join(__dirname, 'fixtures', 'sis_variables_claves.csv'), 'utf8').trim().split(/\r?\n/);
  const vars = lineas.map((l, i) => { const [fila, g, a, ind, m] = l.split(','); return { id: 'v' + fila, fila_excel: Number(fila), orden: i + 1, activo: true, biologico: 'X', clave_general: g, clave_afro: a, clave_indigena: ind, clave_migrante: m }; });
  [112, 113, 114, 115, 116, 117, 118, 119, 120, 121].forEach((f, i) => vars.push({ id: 'v' + f, fila_excel: f, orden: 200 + i, activo: true, biologico: 'SIN CLAVE', clave_general: null, clave_afro: null, clave_indigena: null, clave_migrante: null }));
  return vars;
}

function generarDatos(n, opciones = {}) {
  let s = 4242 + n; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const base = opciones.municipio === 'MARQUES' ? MARQUES : QRO;
  const unidades = base.slice(0, Math.min(n, base.length)).map((u, i) => ({ id: 'u' + i, clues: u.clues, nombre: u.nombre }));
  for (let i = unidades.length; i < n; i++) unidades.push({ id: 'u' + i, clues: 'QTSSA9' + String(90000 + i), nombre: 'UNIDAD EXTRA ' + i });
  if (n < QRO.length && !opciones.municipio) unidades.forEach((u, i) => { u.clues = n === 4 ? ['QTSSA990001', 'QTSSA990002', 'QTSSA990003', 'QTSSA990004'][i] : u.clues; if (n === 4) u.nombre = ['C.S. UNO', 'C.S. DOS', 'C.S. TRES', 'C.S. CUATRO'][i]; });
  const variables = variablesDelCatalogo();
  const capturas = unidades.map((u, i) => {
    const valores = {};
    variables.forEach((v) => { if (rnd() < 0.55) valores[String(v.fila_excel)] = { total: ri(1, 90), afro: rnd() < 0.2 ? ri(1, 4) : 0, indigena: rnd() < 0.2 ? ri(1, 4) : 0, migrante: rnd() < 0.15 ? ri(1, 3) : 0 }; });
    return { clues: u.clues, estado: i % 5 === 4 ? 'ENVIADO' : 'VALIDADO', valores, municipio: opciones.municipio || 'QUERETARO', mes: MES, anio: ANIO };
  });
  const seg = [];
  unidades.forEach((u, i) => CLAVES_BIO.forEach((c, j) => {
    if (rnd() < 0.7) { const ant = ri(0, 9) + (rnd() < 0.3 ? 0.5 : 0); seg.push({ clues: u.clues, biovac_clave: c, existencia_anterior: ant, recibido: ri(0, 6), aplicado: ri(0, 40) + (c === 'HEPB' ? 0.5 : 0), desperdicio: ri(0, 5), existencia_corte: 0, movimiento_estado: 'CERRADO' }); }
  }));
  const influenza = [];
  unidades.forEach((u) => ['2026-09-04', '2026-09-11', '2026-10-02'].forEach((fecha) => { const v = {}; for (let k = 1; k <= 46; k++) if (rnd() < 0.25) v['r' + k] = ri(1, 9); influenza.push({ clues: u.clues, fecha, valores: v }); }));
  return { unidades, variables, capturas, seg, influenza: opciones.sinInfluenza ? [] : influenza, municipio: opciones.municipio || 'QUERETARO' };
}

async function abrir(page) {
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('[console.error]', m.text()); });
  await page.route(/unpkg\.com\/@supabase\/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs/, (r) => r.fulfill({ contentType: 'application/javascript', body: EXCELJS }));
  await page.goto('/biovac.html', { waitUntil: 'load' });
  await page.waitForSelector('#campoPeriodo', { state: 'attached' });
  await page.waitForTimeout(1200);
}

async function descargar(page, datos) {
  const espera = page.waitForEvent('download', { timeout: 60000 });
  const info = await page.evaluate(async ([D, mes, anio]) => {
    const tablas = {
      biovac_unidades: D.unidades.map((u) => ({ ...u, municipio: D.municipio, activo: true })),
      sis_variables: D.variables, sis06p_capturas: D.capturas, influenza_capturas: D.influenza
    };
    const from = (t) => {
      const fl = [];
      const api = {
        select() { return api; }, eq(c, v) { fl.push((r) => r[c] === v); return api; }, in(c, a) { fl.push((r) => a.includes(r[c])); return api; },
        gte(c, v) { fl.push((r) => r[c] >= v); return api; }, lt(c, v) { fl.push((r) => r[c] < v); return api; }, not() { return api; }, order() { return api; },
        then(ok, ko) { return Promise.resolve({ data: (tablas[t] || []).filter((r) => fl.every((f) => f(r))), error: null }).then(ok, ko); }
      };
      return api;
    };
    const rpcs = { sis06p_seguimiento_biologico: D.seg, sis06p_recibido_vs_requisicion: [] };
    estado.db = { from, rpc: async (n) => ({ data: rpcs[n] || [], error: null }) };
    estado.biologicos = ['BCG', 'HEPB', 'HEXAVALENTE', 'DPT', 'ROTAVIRUS', 'NEUMO_13V', 'NEUMO_20V', 'SRP', 'ANTIINFLUENZA', 'SR', 'VPH', 'TD', 'TDPA', 'COVID_MODERNA', 'COVID_PFIZER', 'VARICELA', 'HEPA', 'VSR'].map((c) => ({ clave: c, nombre_excel: c }));
    window.__toasts = []; const t0 = window.toast; window.toast = (m, k) => { window.__toasts.push(String(m)); return t0(m, k); };
    const cont = document.createElement('div'); document.body.appendChild(cont);
    await SIS06PConcentradoMunicipal.render(cont, D.municipio, mes, anio);
    cont.querySelector('[data-accion="excel"]').click();
    return { mapeoInfluenza: window.SIS06PBiovac.INFLUENZA_SIS_MAPPING };
  }, [datos, MES, ANIO]);
  const d = await espera;
  const destino = path.join(test.info().outputDir, `concentrado_${datos.municipio}_${datos.unidades.length}.xlsx`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await d.saveAs(destino);
  if (process.env.GUARDAR_PRUEBAS) fs.copyFileSync(destino, path.join(raiz, 'PRUEBAS_EXPORTACION', `CONCENTRADO_${datos.municipio === 'MARQUES' ? 'MARQUES' : datos.unidades.length + '_unidades'}${datos.influenza.length ? '' : '_sin_influenza'}.xlsx`));
  await page.waitForFunction(() => window.__toasts.length > 0, null, { timeout: 15000 });
  const toasts = await page.evaluate(() => window.__toasts);
  return { archivo: destino, info, toasts };
}

const num = (v) => { if (v && typeof v === 'object') v = v.result; const x = Number(v); return Number.isFinite(x) ? x : 0; };
const letra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const redondear = (v) => Math.round(v * 100) / 100;

for (const [n, sinInfluenza, municipio] of [[36, false], [4, false], [40, false], [1, false], [2, false], [4, true], [14, false, 'MARQUES']]) {
  test(`Excel del concentrado ${municipio || 'QUERETARO'} con ${n} unidades${sinInfluenza ? ' sin Influenza' : ''}: PALOTEO, SEGUIMIENTO y CSV sobre la plantilla real`, async ({ page }) => {
    test.setTimeout(120000);
    const D = generarDatos(n, { sinInfluenza, municipio });
    const oficial = municipio === 'MARQUES' ? 'EL MARQUÉS' : 'QUERÉTARO';
    await abrir(page);
    const { archivo, info, toasts } = await descargar(page, D);
    expect(toasts.join(' | ')).toContain('Excel del concentrado municipal generado');


    // Excel rechaza el archivo si una definición de columnas pasa de la 16384 (pasó al insertar columnas)
    const zip = await JSZip.loadAsync(fs.readFileSync(archivo));
    for (const nombre of Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))) {
      const xml = await zip.file(nombre).async('string');
      [...xml.matchAll(/<col [^>]*?max="(\d+)"/g)].forEach((m) => expect(Number(m[1]), `${nombre} <col max>`).toBeLessThanOrEqual(16384));
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['PALOTEO', 'SEGUIMIENTO DE BIOLOGICO', 'CSV', 'RECIBIDO VS REQUISICION']);
    const wp = wb.getWorksheet('PALOTEO'); const ws = wb.getWorksheet('SEGUIMIENTO DE BIOLOGICO');
    const cIni = 9; const cFin = cIni + n - 1; const cTot = cFin + 1;

    // ---------------- PALOTEO ----------------
    expect(wp.getCell('A1').value).toBe('SEPTIEMBRE');
    expect(wp.getCell('A3').value).toBe(`MUNICIPIO ${oficial}`);
    // la banda oscura del título no debe tener huecos blancos
    for (let c = 1; c <= cTot; c++) { const f = wp.getCell(1, c).fill; expect(f && f.fgColor && f.fgColor.argb, `relleno fila 1 col ${c}`).toBe('FF2B2F36'); }
    D.unidades.forEach((u, i) => expect(wp.getCell(4, cIni + i).value).toBe(u.clues));
    expect(wp.getCell(3, cTot).value).toBe('Total Municipal');
    expect(wp.model.merges).toContain(`${letra(cTot)}3:${letra(cTot)}4`);
    // Sin protección de hoja ni contraseña
    expect(wp.sheetProtection).toBeFalsy();
    expect(ws.sheetProtection).toBeFalsy();
    // Las filas de afro/indígena/migrante siguen agrupadas y ocultas (si no, la impresión sería larguísima)
    let ocultas = 0; wp.eachRow({ includeEmpty: true }, (row) => { if (row.hidden) ocultas++; });
    expect(ocultas).toBe(282);
    expect(wp.getRow(10).hidden).toBe(true);   // VBC51: BCG migrante
    expect(wp.getRow(9).hidden).toBe(false);   // VBC03: BCG total
    expect(wp.getRow(25).hidden).toBe(false);  // TOTAL BCG
    expect(wp.getRow(397).hidden).toBe(false); // Influenza
    // Impresión: con Influenza va aparte (salto después de la 396 y encabezados 3:4 repetidos); sin ella termina en la 396
    expect(wp.pageSetup.printArea).toBe(`A1:${letra(cTot)}${sinInfluenza ? 396 : 443}`);
    expect(wp.pageSetup.printTitlesRow).toBe('3:4');
    expect(wp.pageSetup.fitToPage).toBe(false);
    expect(wp.pageSetup.scale).toBeGreaterThanOrEqual(10);
    expect(wp.pageSetup.scale).toBeLessThanOrEqual(100);
    const hojasXml = await Promise.all(Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).map((f) => zip.file(f).async('string')));
    const conSaltos = hojasXml.filter((x) => /<rowBreaks/.test(x));
    if (sinInfluenza) expect(conSaltos.length).toBe(0); else expect(conSaltos.some((x) => /<brk id="396"/.test(x))).toBe(true);
    // la columna siguiente al total no debe traer restos de la plantilla
    expect(wp.getCell(5, cTot + 1).value).toBeNull();

    // valores esperados por clave
    const esperado = new Map(); // `${clues}|${clave}` -> n
    D.capturas.forEach((c) => D.variables.forEach((v) => {
      const val = c.valores[String(v.fila_excel)]; if (!val) return;
      if (v.clave_general && val.total) esperado.set(`${c.clues}|${v.clave_general}`, val.total);
      if (v.clave_afro && val.afro) esperado.set(`${c.clues}|${v.clave_afro}`, val.afro);
      if (v.clave_indigena && val.indigena) esperado.set(`${c.clues}|${v.clave_indigena}`, val.indigena);
      if (v.clave_migrante && val.migrante) esperado.set(`${c.clues}|${v.clave_migrante}`, val.migrante);
    }));
    D.influenza.filter((f) => f.fecha < '2026-10-01').forEach((f) => Object.entries(f.valores).forEach(([rubro, x]) => {
      const clave = info.mapeoInfluenza[rubro]; const k = `${f.clues}|${clave}`; esperado.set(k, (esperado.get(k) || 0) + x);
    }));

    const filaDeClave = new Map(); const subtotales = [];
    for (let r = 5; r <= 442; r++) {
      const b = String(wp.getCell(r, 2).value && wp.getCell(r, 2).value.richText ? wp.getCell(r, 2).value.richText.map((t) => t.text).join('') : wp.getCell(r, 2).value || '');
      const clave = String(wp.getCell(r, 3).value || '').trim();
      if (/^TOTAL/.test(b) && b === String(wp.getCell(r, 3).value || '')) subtotales.push(r);
      else if (clave) filaDeClave.set(clave, r);
    }
    expect(filaDeClave.size).toBeGreaterThan(300);
    let comprobadas = 0; const errPal = [];
    esperado.forEach((x, k) => {
      const [clues, clave] = k.split('|');
      const i = D.unidades.findIndex((u) => u.clues === clues); const r = filaDeClave.get(clave);
      if (!r) { errPal.push(`la clave ${clave} no existe en la plantilla`); return; }
      if (num(wp.getCell(r, cIni + i).value) !== x) errPal.push(`${clues} ${clave}`);
      comprobadas++;
    });
    expect(errPal.slice(0, 10)).toEqual([]);
    expect(comprobadas).toBeGreaterThan(n * 30);

    // Total Municipal = suma de la fila, y subtotales por biológico = suma de sus renglones TOTAL
    const errTot = [];
    for (let r = 5; r <= 442; r++) {
      let sum = 0; for (let c = cIni; c <= cFin; c++) sum += num(wp.getCell(r, c).value);
      if (num(wp.getCell(r, cTot).value) !== sum) errTot.push(`total fila ${r}`);
      if (wp.getCell(r, cTot).value.formula !== `SUM(I${r}:${letra(cFin)}${r})`) errTot.push(`fórmula fila ${r}`);
    }
    expect(errTot.slice(0, 10)).toEqual([]);
    expect(subtotales.length).toBe(16);
    const filaBCG = filaDeClave.get('VBC01');
    const sumaBCG = (i) => [0, 1, 2, 3, 4].reduce((a, k) => a + num(wp.getCell(filaBCG + k, cIni + i).value), 0);
    const filaSubBCG = subtotales[0];
    D.unidades.forEach((u, i) => { expect(num(wp.getCell(filaSubBCG, cIni + i).value)).toBe(sumaBCG(i)); });
    expect(wp.getCell(filaSubBCG, cIni).value.formula).toBe('SUM(I5:I9)');
    if (n > 1) expect(wp.getCell(filaSubBCG, cIni + 1).value.formula).toBe('SUM(J5:J9)');
    expect(wp.getCell(443, cTot).value.formula).toBe(`SUM(${letra(cTot)}397:${letra(cTot)}442)`);

    // ---------------- CSV (mismo formato que la hoja CSV del Excel oficial) ----------------
    const wc = wb.getWorksheet('CSV');
    expect(['CLUES', 'VARIABLE', 'VALOR', 'MES', 'AÑO', 'MUNICIPIO'].map((h, i) => wc.getCell(1, i + 1).value)).toEqual(['CLUES', 'VARIABLE', 'VALOR', 'MES', 'AÑO', 'MUNICIPIO']);
    const clavesPaloteo = []; // renglones de datos del PALOTEO, en su orden
    for (let r = 5; r <= 442; r++) { const cl = String(wp.getCell(r, 3).value || '').trim(); if (cl && !subtotales.includes(r)) clavesPaloteo.push({ r, cl }); }
    expect(clavesPaloteo.length).toBe(422);
    expect(wc.rowCount).toBe(1 + n * 422);
    expect(wc.autoFilter).toBeTruthy();
    // letra de la hoja CSV: Arial Nova 11 en el encabezado, en el primer renglón y en el último
    [wc.getCell('A1'), wc.getCell('A2'), wc.getCell('C2'), wc.getCell('F2'), wc.getCell(`A${wc.rowCount}`), wc.getCell(`C${wc.rowCount}`)].forEach((c) => { expect(c.font.name, c.address).toBe('Arial Nova'); expect(c.font.size).toBe(11); });
    let fila = 2; const vistos = new Set(); const errCsv = [];
    D.unidades.forEach((u, i) => {
      const L = letra(cIni + i);
      clavesPaloteo.forEach(({ r, cl }) => {
        const c = wc.getRow(fila);
        if (c.getCell(1).value.formula !== `PALOTEO!$${L}$4`) errCsv.push(`CLUES fila ${fila}`);
        if (c.getCell(2).value !== cl) errCsv.push(`VARIABLE fila ${fila}: ${c.getCell(2).value} != ${cl}`);
        if (c.getCell(3).value.formula !== `PALOTEO!$${L}$${r}`) errCsv.push(`VALOR fila ${fila}`);
        // el valor guardado coincide con la celda del PALOTEO a la que apunta
        if (num(c.getCell(3).value) !== num(wp.getCell(r, cIni + i).value)) errCsv.push(`${u.clues} ${cl}: CSV ${num(c.getCell(3).value)} vs PALOTEO ${num(wp.getCell(r, cIni + i).value)}`);
        if (c.getCell(4).value !== MES || c.getCell(5).value !== ANIO || c.getCell(6).value !== oficial) errCsv.push(`MES/AÑO/MUNICIPIO fila ${fila}`);
        const llave = `${u.clues}|${cl}`; if (vistos.has(llave)) errCsv.push(`duplicado ${llave}`); vistos.add(llave);
        fila++;
      });
    });
    expect(errCsv.slice(0, 10)).toEqual([]);
    // y contra lo capturado: cada valor esperado aparece en su renglón del CSV
    const idxClave = new Map(clavesPaloteo.map((q, k) => [q.cl, k]));
    const errEsp = [];
    esperado.forEach((x, k) => {
      const [clues, clave] = k.split('|'); const i = D.unidades.findIndex((u) => u.clues === clues);
      const got = num(wc.getRow(2 + i * 422 + idxClave.get(clave)).getCell(3).value);
      if (got !== x) errEsp.push(`CSV ${clues} ${clave}: ${got} != ${x}`);
    });
    expect(errEsp.slice(0, 10)).toEqual([]);

    // ---------------- SEGUIMIENTO ----------------
    const sIni = 2; const sFin = sIni + n - 1; const sTot = sFin + 1; const sVal = sTot + 1;
    expect(ws.getCell('A1').value).toBe(`MUNICIPIO ${oficial}`);
    D.unidades.forEach((u, i) => expect(typeof ws.getCell(2, sIni + i).value).toBe('string'));
    expect(ws.getCell(2, sTot).value).toBe('Total');
    expect(ws.getCell(2, sVal).value).toBe('VALIDACIÓN');
    expect(ws.model.merges).toContain(`A3:${letra(sTot)}3`);
    expect(ws.model.merges).toContain(`A79:${letra(sTot)}79`);
    expect(ws.model.merges).toContain(`${letra(sVal)}2:${letra(sVal + 1)}41`);
    expect(ws.getCell(3, 1).value).toBe('EXISTENCIA ANTERIOR (FRASCOS)');
    expect(ws.getCell(79, 1).value).toBe('EXISTENCIA AL CORTE (FRASCOS)');
    const seg = (clues, c, campo) => { const f = D.seg.find((x) => x.clues === clues && x.biovac_clave === c); return f ? redondear(f[campo]) : 0; };
    [['existencia_anterior', 4], ['recibido', 23], ['aplicado', 42], ['desperdicio', 61]].forEach(([campo, base]) => {
      CLAVES_BIO.forEach((c, k) => {
        let suma = 0;
        D.unidades.forEach((u, i) => { const x = seg(u.clues, c, campo); suma += x; expect(num(ws.getCell(base + k, sIni + i).value), `${campo} ${u.clues} ${c}`).toBe(x); });
        expect(num(ws.getCell(base + k, sTot).value)).toBe(redondear(suma));
        expect(ws.getCell(base + k, sTot).value.formula).toBe(`SUM(B${base + k}:${letra(sFin)}${base + k})`);
      });
    });
    // Existencia al corte: fórmula de la plantilla (BCG usa dosis por frasco 10, HEXAVALENTE es unidosis)
    const corteBCG = ws.getCell(80, sIni + 1).value;
    expect(corteBCG.formula).toBe(`SUM(((${letra(sIni + 1)}4+${letra(sIni + 1)}23)*10-(${letra(sIni + 1)}42+${letra(sIni + 1)}61))/10)`);
    expect(ws.getCell(82, sIni).value.formula).toBe('(B6+B25)-(B44+B63)');
    // VALIDACIÓN apunta al Total del PALOTEO de cada biológico
    expect(ws.getCell(42, sVal).value.formula).toBe(`PALOTEO!${letra(cTot)}25`);
    expect(ws.getCell(43, sVal).value.formula).toBe(`((PALOTEO!${letra(cTot)}26)/2)+(SUM(PALOTEO!${letra(cTot)}27:${letra(cTot)}32))`);
    expect(num(ws.getCell(42, sVal).value)).toBe(num(wp.getCell(25, cTot).value));
    expect(ws.pageSetup.printArea).toBe(`A1:${letra(sVal + 1)}97`);
  });
}
