/**
 * SIS / SINBA -- Exportación del concentrado mensual SIS-06-P a CSV
 * (CLUES, MUNICIPIO, VARIABLE_SIS, MES, ANIO, VALOR), mismo formato que ya
 * acepta el panel RDA existente (rda_parser.js -> registros_sis), para
 * reemplazar la subida manual del concentrador de Python.
 *
 * La captura de SIS-06-P en sí vive en biovac.html (ver sis06p_biovac_module.js,
 * Fase 3) -- este módulo solo lee `sis06p_capturas` para exportar, desde el
 * panel RDA de `index.html` (roles MUNICIPAL/JURISDICCIONAL/ADMIN).
 */

let _sisVariablesCache = [];
let _sisVariablesByFilaExcel = new Map();

function buildSISCSVRowsForCaptura(captura, sisVarByFila) {
  const rows = [];
  const { clues, municipio, mes, anio, valores } = captura;

  (sisVarByFila || _sisVariablesByFilaExcel).forEach((varDef, filaExcel) => {
    const v = (valores || {})[String(filaExcel)] || (valores || {})[filaExcel] || {};
    const total = Number(v.total || 0);
    if (varDef.clave_general) {
      rows.push({ CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: varDef.clave_general, MES: mes, ANIO: anio, VALOR: total });
    }
    const afro = Number(v.afro || 0);
    if (varDef.clave_afro && afro > 0) {
      rows.push({ CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: varDef.clave_afro, MES: mes, ANIO: anio, VALOR: afro });
    }
    const indigena = Number(v.indigena || 0);
    if (varDef.clave_indigena && indigena > 0) {
      rows.push({ CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: varDef.clave_indigena, MES: mes, ANIO: anio, VALOR: indigena });
    }
    const migrante = Number(v.migrante || 0);
    if (varDef.clave_migrante && migrante > 0) {
      rows.push({ CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: varDef.clave_migrante, MES: mes, ANIO: anio, VALOR: migrante });
    }
  });

  return rows;
}

function downloadSISCSV(filename, rows) {
  const headers = ["CLUES", "MUNICIPIO", "VARIABLE_SIS", "MES", "ANIO", "VALOR"];
  const csvLines = [headers.join(",")].concat(
    rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  );
  const blob = new Blob(["﻿" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function initSISExportModalDefaults() {
  const mesSelect = document.getElementById("sisExportMes");
  const anioSelect = document.getElementById("sisExportAnio");
  if (!mesSelect || !anioSelect || mesSelect.dataset.defaulted) return;

  const now = new Date();
  let prevMonth = now.getMonth(); // mes actual (0-based) == mes anterior en 1-based
  let prevYear = now.getFullYear();
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  mesSelect.value = String(prevMonth);
  anioSelect.value = String(prevYear);
  mesSelect.dataset.defaulted = "1";
}

// Suma las capturas semanales de Influenza (influenza_capturas.valores,
// mapa plano {rubro_id: dosis}) que caen dentro del mes/año calendario
// pedido, y las traduce a filas SIS vía window.INFLUENZA_SIS_MAPPING --
// fuente única de verdad ya definida en influenza_module.js (mismo bundle
// que este archivo en index.html, no hay que duplicarla aquí). Solo emite
// filas si la unidad reportó algo ese mes (si no hubo captura, no hay nada
// que decir de Influenza ese periodo -- distinto a SIS-06-P, que si existe
// un renglón siempre completa las 94 claves con clave, aquí puede no haber
// ninguna semana de esa campaña dentro del mes).
function buildInfluenzaCSVRows(clues, municipio, mes, anio, capturasInfluenza) {
  const mapping = window.INFLUENZA_SIS_MAPPING || {};
  const enMes = (capturasInfluenza || []).filter((c) => {
    if (!c.fecha) return false;
    const d = new Date(c.fecha + "T12:00:00");
    return (d.getMonth() + 1) === Number(mes) && d.getFullYear() === Number(anio);
  });
  if (enMes.length === 0) return [];

  const sumas = {};
  enMes.forEach((c) => {
    Object.entries(c.valores || {}).forEach(([rubro, val]) => {
      sumas[rubro] = (sumas[rubro] || 0) + Number(val || 0);
    });
  });

  return Object.entries(mapping).map(([rubro, clave]) => ({
    CLUES: clues, MUNICIPIO: municipio, VARIABLE_SIS: clave, MES: mes, ANIO: anio, VALOR: sumas[rubro] || 0
  }));
}

async function exportSISConcentrado({ mes, anio }) {
  try {
    if (_sisVariablesCache.length === 0) {
      const resVars = await AppService.call("getsis_variables", {});
      _sisVariablesCache = resVars.data || [];
      _sisVariablesByFilaExcel = new Map(_sisVariablesCache.map(v => [Number(v.fila_excel), v]));
    }

    const role = String((USER && USER.rol) || "").trim().toUpperCase();
    const isJurisdiccional = role === "ADMIN" || role === "JURISDICCIONAL" || role === "VISUALIZADOR_JURISDICCIONAL";
    const municipiosAllowed = USER?.municipiosAllowed || (USER?.municipio ? [USER.municipio] : []);

    const resCapturas = await AppService.call("getsis06p_capturas", {});
    let capturas = (resCapturas.data || []).filter(c => Number(c.mes) === Number(mes) && Number(c.anio) === Number(anio));

    // Influenza vive en su propia tabla (influenza_capturas, semanal) -- se
    // lee directo de Supabase (mismo patrón ya usado por concentrado_ui.js
    // para sis_variables_mapeo), no vía AppService (ese handler solo filtra
    // por anio_campana, y aquí conviene filtrar por mes calendario en JS).
    let queryInfluenza = window.supabase.from('influenza_capturas').select('clues, municipio, fecha, valores');
    if (!isJurisdiccional) queryInfluenza = queryInfluenza.in('municipio', municipiosAllowed);
    const { data: capturasInfluenzaAll, error: errInfluenza } = await queryInfluenza;
    if (errInfluenza) console.error("Error cargando influenza_capturas para exportar:", errInfluenza);
    const capturasInfluenza = capturasInfluenzaAll || [];

    if (!isJurisdiccional) {
      capturas = capturas.filter(c => municipiosAllowed.includes(c.municipio));
    }

    // Agrupar Influenza por CLUES -- una CLUES puede no tener sis06p_capturas
    // ese mes pero sí Influenza (o viceversa), así que la unión de ambos
    // conjuntos de CLUES define qué filas se generan.
    const cluesInfo = new Map();
    capturas.forEach(c => cluesInfo.set(c.clues, { clues: c.clues, municipio: c.municipio }));
    capturasInfluenza.forEach(c => { if (!cluesInfo.has(c.clues)) cluesInfo.set(c.clues, { clues: c.clues, municipio: c.municipio }); });

    if (cluesInfo.size === 0) {
      showToast("No hay concentrados capturados para ese mes/año en tu alcance.", false, "warn");
      return;
    }

    let rows = [];
    capturas.forEach(c => {
      rows = rows.concat(buildSISCSVRowsForCaptura(c, _sisVariablesByFilaExcel));
    });
    cluesInfo.forEach(({ clues, municipio }) => {
      const capturasDeEstaClues = capturasInfluenza.filter(c => c.clues === clues);
      rows = rows.concat(buildInfluenzaCSVRows(clues, municipio, mes, anio, capturasDeEstaClues));
    });

    rows.sort((a, b) => (a.MES - b.MES) || String(a.MUNICIPIO).localeCompare(String(b.MUNICIPIO)) || String(a.CLUES).localeCompare(String(b.CLUES)));

    const scopeLabel = isJurisdiccional ? "JURISDICCIONAL" : municipiosAllowed.join("-");
    const filename = `SIS_${scopeLabel}_${mes}_${anio}.csv`;
    downloadSISCSV(filename, rows);

    if (!isJurisdiccional) {
      showToast("⚠️ Sube este archivo junto con los de los demás municipios de este mes: el panel RDA reemplaza todos los datos del mes al subir, y subir solo un municipio puede borrar los datos de los demás hasta que se vuelvan a cargar.", true, "warn");
    } else {
      showToast(`✅ Concentrado exportado: ${cluesInfo.size} CLUES, ${rows.length} filas.`, true, "good");
    }
  } catch (err) {
    console.error("Error al exportar concentrado SIS:", err);
    showToast(err.message || "Error al exportar el concentrado SIS.", false, "bad");
  }
}
