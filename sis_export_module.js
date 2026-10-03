/**
 * SIS / SINBA -- Exportación del concentrado mensual a CSV
 * (CLUES, MUNICIPIO, VARIABLE_SIS, MES, ANIO, VALOR), mismo formato que ya
 * acepta el panel RDA existente (rda_parser.js -> registros_sis).
 *
 * Las filas NO se arman aquí: salen del servidor (RPC sis_filas_csv), la misma
 * fuente con la que se publica a registros_sis (sis_publicar_registros_sis),
 * así el CSV y la tabla de indicadores nunca difieren. Solo se exporta un
 * municipio cuando TODAS sus unidades ya están validadas.
 *
 * La captura de SIS-06-P vive en biovac.html (sis06p_biovac_module.js); este
 * módulo solo sirve al panel RDA de `index.html` (MUNICIPAL/JURISDICCIONAL/ADMIN).
 */

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

async function exportSISConcentrado({ mes, anio }) {
  try {
    const role = String((USER && USER.rol) || "").trim().toUpperCase();
    const isJurisdiccional = role === "ADMIN" || role === "JURISDICCIONAL" || role === "VISUALIZADOR_JURISDICCIONAL";
    const municipiosAllowed = USER?.municipiosAllowed || (USER?.municipio ? [USER.municipio] : []);

    // Municipios con captura ese mes dentro del alcance del usuario.
    const resCapturas = await AppService.call("getsis06p_capturas", {});
    const capturas = (resCapturas.data || []).filter(c => Number(c.mes) === Number(mes) && Number(c.anio) === Number(anio));
    let municipios = [...new Set(capturas.map(c => c.municipio).filter(Boolean))];
    if (!isJurisdiccional) municipios = municipios.filter(m => municipiosAllowed.includes(m));

    if (municipios.length === 0) {
      showToast("No hay concentrados capturados para ese mes/año en tu alcance.", false, "warn");
      return;
    }

    let rows = [];
    const omitidos = [];
    for (const municipio of municipios) {
      const { data, error } = await window.supabase.rpc("sis_filas_csv", { p_mes: Number(mes), p_anio: Number(anio), p_municipio: municipio });
      if (error) {
        // Normalmente: todavía faltan unidades por validar en ese municipio.
        omitidos.push(`${municipio}: ${error.message}`);
        continue;
      }
      rows = rows.concat((data || []).map(f => ({ CLUES: f.clues, MUNICIPIO: f.municipio, VARIABLE_SIS: f.variable_sis, MES: Number(mes), ANIO: Number(anio), VALOR: f.valor })));
    }

    if (rows.length === 0) {
      showToast(`Nada que exportar. ${omitidos.join(" | ")}`, false, "warn");
      return;
    }

    const scopeLabel = isJurisdiccional ? "JURISDICCIONAL" : municipiosAllowed.join("-");
    downloadSISCSV(`SIS_${scopeLabel}_${mes}_${anio}.csv`, rows);

    const nClues = new Set(rows.map(r => r.CLUES)).size;
    if (omitidos.length > 0) {
      showToast(`⚠️ Exportado ${nClues} CLUES, pero NO se incluyó: ${omitidos.join(" | ")}. Subir este archivo reemplaza todo el mes en el panel RDA; mejor usa «Publicar a indicadores» en Seguimiento del SINBA-SIS.`, true, "warn");
    } else {
      showToast(`✅ Concentrado exportado: ${nClues} CLUES, ${rows.length} filas. Para cargarlo a indicadores usa «Publicar a indicadores» (no reemplaza otros municipios).`, true, "good");
    }
  } catch (err) {
    console.error("Error al exportar concentrado SIS:", err);
    showToast(err.message || "Error al exportar el concentrado SIS.", false, "bad");
  }
}
