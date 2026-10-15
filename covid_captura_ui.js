/* Panel «COVID-19 · reporte de la semana» del panel de captura de la unidad (debajo de la tabla de Influenza).
 * Un reporte por semana; el nuevo reemplaza al anterior. Después de guardar ofrece el paso a CeNSIA (complemento).
 * La lógica vive en covid_captura.js; aquí solo se pinta y se conecta con el panel de Influenza (ctx).
 *
 * ctx = { container, metas, capturas, fecha, cerrada, motivo, nombre(), nombreEl, campana, USER,
 *         guardar(payload) -> Promise, aviso(msg, tipo), censia: { url, fechaAplicacion, instalada, enviarPaquete, marcadorFn } }
 */
(function (root) {
  "use strict";
  const C = root.CovidCaptura;
  if (!C) return;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("es-MX");
  const MARCA_TXT = { MODERNA: "Moderna", PFIZER: "Pfizer" };

  function render(ctx) {
    const box = ctx.container;
    if (!box) return;
    box.innerHTML = "";
    const metas = ctx.metas || null;
    if (!metas || !C.RUBROS.some((r) => Number(metas[r] || 0) > 0)) { box.hidden = true; return; }
    box.hidden = false;

    const actual = (ctx.capturas || []).find((r) => r.fecha === ctx.fecha) || null;
    const previo = actual ? actual.valores : {};
    const otras = (ctx.capturas || []).filter((r) => r.fecha !== ctx.fecha);
    const acumOtras = {};
    C.RUBROS.forEach((r) => { acumOtras[r] = otras.reduce((s, c) => s + C.porRubro(c.valores)[r], 0); });

    const sec = document.createElement("section");
    sec.className = "cvc";
    sec.setAttribute("aria-labelledby", "cvcTit");
    const filas = C.RUBROS.map((r) => {
      const celda = (m) => {
        if (!C.RUBROS_MARCA[m].includes(r)) return `<td class="cvc-na" aria-label="${MARCA_TXT[m]}: no aplica"><span aria-hidden="true">—</span></td>`;
        const v = Number(previo && previo[m] && previo[m][r]) || 0;
        return `<td><input class="cvc-in" type="number" min="0" step="1" inputmode="numeric" id="cvc_${m}_${r}" data-m="${m}" data-r="${r}"
          value="${v > 0 ? v : ""}" placeholder="0" ${ctx.cerrada ? "disabled" : ""} aria-label="${MARCA_TXT[m]}: ${esc(C.ETIQUETA[r])}"></td>`;
      };
      return `<tr data-r="${r}">
        <th scope="row">${esc(C.ETIQUETA[r])}</th>
        ${celda("MODERNA")}${celda("PFIZER")}
        <td class="cvc-num">${fmt(metas[r])}</td>
        <td class="cvc-num">${fmt(acumOtras[r])}</td>
        <td class="cvc-est" id="cvc_est_${r}" aria-live="off"></td>
      </tr>`;
    }).join("");

    sec.innerHTML = `
      <div class="cvc-tit" id="cvcTit"><span class="material-symbols-rounded" aria-hidden="true">vaccines</span><b>COVID-19 · reporte de la semana</b></div>
      <p class="cvc-nota">Captura por marca el <b>total de la semana</b>. Un solo reporte por semana: si lo vuelves a guardar, <b>el nuevo reemplaza al anterior</b>. Moderna y Pfizer suman contra la misma meta.</p>
      ${actual ? `<p class="cvc-ok"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span>Esta semana ya tiene reporte de COVID-19${actual.folio ? ` (folio ${esc(actual.folio)})` : ""}.</p>` : ""}
      <div class="cvc-wrap"><table class="cvc-tabla">
        <caption class="cvc-sr">Dosis de COVID-19 aplicadas en la semana, por marca, contra la meta de la unidad</caption>
        <thead><tr><th scope="col">Grupo</th><th scope="col">Moderna</th><th scope="col">Pfizer</th><th scope="col">Meta</th><th scope="col">Otras semanas</th><th scope="col">Estado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
      <div class="cvc-acc">
        <button type="button" class="cvc-btn" id="cvcGuardar" ${ctx.cerrada ? "disabled" : ""}>Guardar COVID-19</button>
        <span class="cvc-total" id="cvcTotal" role="status"></span>
      </div>
      ${ctx.cerrada ? `<p class="cvc-nota">${esc(ctx.motivo || "La captura de esta semana está cerrada.")}</p>` : ""}
      <div id="cvcCensia"></div>`;
    box.appendChild(sec);

    const leer = () => {
      const v = { MODERNA: {}, PFIZER: {} };
      sec.querySelectorAll(".cvc-in").forEach((el) => { v[el.dataset.m][el.dataset.r] = parseInt(el.value, 10) || 0; });
      return C.limpiar(v);
    };
    const repintar = () => {
      const v = leer();
      const nuevo = C.porRubro(v);
      let excede = false;
      C.RUBROS.forEach((r) => {
        const meta = Number(metas[r] || 0);
        const total = acumOtras[r] + nuevo[r];
        const est = sec.querySelector(`#cvc_est_${r}`);
        const ex = total - meta;
        const mal = meta > 0 ? ex > 0 : nuevo[r] > 0;
        if (mal) excede = true;
        est.textContent = meta > 0 ? (ex > 0 ? `Te pasas por ${fmt(ex)}` : `${fmt(total)} de ${fmt(meta)}`) : (nuevo[r] > 0 ? "Sin meta" : "—");
        est.classList.toggle("is-over", mal);
        sec.querySelectorAll(`.cvc-in[data-r="${r}"]`).forEach((el) => { if (mal) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); });
      });
      const t = C.totalDosis(v);
      sec.querySelector("#cvcTotal").textContent = `${fmt(t)} ${t === 1 ? "dosis" : "dosis"} esta semana`;
      return { v, excede };
    };
    sec.querySelectorAll(".cvc-in").forEach((el) => el.addEventListener("input", repintar));
    repintar();

    sec.querySelector("#cvcGuardar").addEventListener("click", async () => {
      const { v } = repintar();
      const nombre = (ctx.nombre() || "").trim();
      if (!nombre) { ctx.aviso("Por favor ingresa el nombre de quien reporta la captura.", "bad"); return; }
      const val = C.validar(v, metas, acumOtras, previo);
      if (val.error) { ctx.aviso(val.error, "bad"); return; }
      const btn = sec.querySelector("#cvcGuardar");
      btn.disabled = true;
      try {
        await ctx.guardar({ valores: v, nombre, sin_movimiento: C.totalDosis(v) === 0 });
      } finally { btn.disabled = false; }
    });

    if (actual) renderCensia(sec.querySelector("#cvcCensia"), ctx, actual);
  }

  function renderCensia(cont, ctx, reporte) {
    const cz = ctx.censia;
    if (!cz) return;
    const paquete = C.paqueteCensia(reporte.valores);
    const total = Object.values(paquete).reduce((a, b) => a + b, 0);
    const fecha = cz.fechaAplicacion(ctx.fecha);
    const fmtF = (s) => s.split("-").reverse().join("/");
    const clave = `sirevaq_censia_covid_${ctx.USER?.clues}_${ctx.fecha}`;
    let previo = null;
    try { previo = localStorage.getItem(clave); } catch (e) { /* sin almacenamiento */ }
    const marcas = C.MARCAS.map((m) => {
      const t = Object.keys(C.CENSIA[m]).reduce((s, r) => s + (Number(reporte.valores?.[m]?.[r]) || 0), 0);
      return t > 0 ? `${MARCA_TXT[m]} ${fmt(t)}` : "";
    }).filter(Boolean).join(" · ");
    cont.innerHTML = `
      <div class="cvc-censia">
        <div class="cvc-tit"><span class="material-symbols-rounded" aria-hidden="true">cloud_upload</span><b>Siguiente paso: COVID-19 en CeNSIA</b></div>
        <p>Este reporte (${fmt(total)} dosis${marcas ? ` · ${marcas}` : ""}) también se captura en CeNSIA, en la sección <b>COVID-19</b> de <b>Dosis Aplicadas → Captura</b>, con fecha <b>${fmtF(fecha)}</b>. Tú revisas y pulsas <b>Guardar</b> allá.</p>
        ${previo ? `<p class="cvc-aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>Ya abriste CeNSIA con este reporte el ${esc(previo)}. En CeNSIA las capturas <b>se suman</b>: si ya lo guardaste allá, no lo repitas; si cambió algo, captura solo la diferencia.</p>` : ""}
        <p class="cvc-aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>Guarda primero en CeNSIA lo de Influenza: cada vez que pulsas el botón, el complemento lleva solo este reporte de COVID-19.</p>
        <div class="cvc-acc"><a class="cvc-btn" id="cvcCensiaAbrir" href="${esc(cz.url)}" target="_blank" rel="noopener">Abrir CeNSIA y rellenar COVID-19</a></div>
      </div>`;
    const abrir = cont.querySelector("#cvcCensiaAbrir");
    abrir.addEventListener("click", () => {
      const enlace = cz.enviarPaquete({ v: 1, clues: ctx.USER?.clues, fecha, valores: paquete });
      if (enlace) abrir.href = enlace;
      try { localStorage.setItem(clave, fmtF(cz.hoy())); } catch (e) { /* sin almacenamiento */ }
    });
  }

  root.CovidCapturaUI = { render };
})(typeof window !== "undefined" ? window : globalThis);
