/* Panel «COVID-19» de la captura de la unidad: mismo modelo de diseño que la tabla de Influenza
 * (tarjetas con tabla Meta · Acumulado · Esta semana · Avance, clases .inf-*), una tarjeta por marca.
 * Un reporte por semana; el nuevo reemplaza al anterior. Se guarda con el botón azul de guardar del panel de captura.
 * La lógica vive en covid_captura.js; aquí solo se pinta.
 *
 * ctx = { container, metas, capturas, fecha, cerrada, motivo, USER, alCambiar(), reglaRubro(r) -> regla|null (calendario),
 *         censia: { url, hoy(), fechaAplicacion(fecha), enviarPaquete(paquete) -> enlace } }
 */
(function (root) {
  "use strict";
  const C = root.CovidCaptura;
  if (!C) return;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("es-MX");
  const MARCA_TXT = { MODERNA: "Moderna", PFIZER: "Pfizer" };
  // Etiquetas cortas (la tarjeta ya dice la marca)
  const EDAD = {
    c1: "6 a 59 meses · 1ª dosis (0.25 mL)", c2: "6 a 59 meses · 2ª dosis (0.25 mL)",
    c3: "5 a 59 años con factores de riesgo", c4: "60 años y más", c5: "Personas embarazadas", c6: "Personal de salud"
  };
  let ultimo = null;   // estado vivo del panel pintado (lo lee el botón de guardar del panel de captura)

  function tono(meta, pct) {
    if (!meta) return "none";
    if (pct > 100) return "over";
    if (pct >= 85) return "good";
    if (pct >= 50) return "warn";
    return "bad";
  }

  /** Pinta el panel. Devuelve false (y no pinta) si la unidad no tiene meta de COVID-19. */
  function render(ctx) {
    const box = ctx.container;
    if (!box) return false;
    box.innerHTML = "";
    ultimo = null;
    const metas = ctx.metas || null;
    if (!metas || !C.RUBROS.some((r) => Number(metas[r] || 0) > 0)) return false;

    const actual = (ctx.capturas || []).find((r) => r.fecha === ctx.fecha) || null;
    const previo = actual ? actual.valores : {};
    const otras = (ctx.capturas || []).filter((r) => r.fecha !== ctx.fecha);
    // Acumulado de las demás semanas: por rubro (ambas marcas) y por marca
    const acumRubro = {};
    const acumMarca = { MODERNA: {}, PFIZER: {} };
    C.RUBROS.forEach((r) => {
      acumRubro[r] = otras.reduce((s, c) => s + C.porRubro(c.valores)[r], 0);
      C.MARCAS.forEach((m) => { acumMarca[m][r] = otras.reduce((s, c) => s + (Number(c.valores?.[m]?.[r]) || 0), 0); });
    });

    if (ctx.cerrada) {
      const cerrado = document.createElement("div");
      cerrado.className = "inf-aviso inf-aviso--cerrada";
      cerrado.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">lock_clock</span><div><b>Captura cerrada.</b> ${esc(ctx.motivo || "")} Puedes revisar la tabla, pero todavía no se puede guardar información.</div>`;
      box.appendChild(cerrado);
    }

    // Regla de reemplazo (mismo aviso que Influenza)
    if (!ctx.cerrada || actual) {
      const reemplazo = document.createElement("section");
      reemplazo.className = "inf-reemplazo";
      reemplazo.setAttribute("aria-label", "Cómo funciona el guardado de COVID-19 de la semana");
      reemplazo.innerHTML = actual
        ? `<span class="material-symbols-rounded" aria-hidden="true">swap_horiz</span><div><b>Esta semana ya tiene un reporte de COVID-19 guardado${actual.folio ? ` (folio ${esc(actual.folio)})` : ""}.</b> Si lo vuelves a guardar, <b>el nuevo reemplaza por completo al anterior</b>: no se suma. Captura siempre el <b>total de la semana</b>. Moderna y Pfizer suman contra la misma meta.</div>`
        : `<span class="material-symbols-rounded" aria-hidden="true">info</span><div><b>Un solo reporte por semana.</b> Captura el <b>total de la semana</b> de cada marca; si vuelves a guardar esta semana, el nuevo reporte reemplaza al anterior. Moderna y Pfizer suman contra la misma meta.</div>`;
      box.appendChild(reemplazo);
    }

    // Reglas de calendario por rubro (2ª dosis no en el 1er mes de la campaña, igual que Influenza)
    const reglas = {};
    C.RUBROS.forEach((r) => { reglas[r] = ctx.reglaRubro ? ctx.reglaRubro(r) : null; });
    const reglasAviso = {};
    C.RUBROS.forEach((r) => { if (reglas[r] && Number(metas[r] || 0) > 0) reglasAviso[reglas[r].tipo] = reglas[r]; });
    Object.values(reglasAviso).forEach((rg) => {
      const av = document.createElement("div");
      av.className = "inf-aviso";
      av.innerHTML = `<b>${rg.tipo === "segunda" ? "2ª dosis" : "1ª dosis"} no disponible esta semana.</b> ${esc(rg.texto)}`;
      box.appendChild(av);
    });

    if (actual) renderCensia(box, ctx, actual);

    // Una sola tarjeta (como cada grupo de Influenza): una fila por grupo, con Moderna y Pfizer lado a lado.
    // La meta es una sola por grupo (no distingue marca), por eso el avance suma ambas.
    const rubros = C.RUBROS.filter((r) => Number(metas[r] || 0) > 0);
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";
    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100">
        <h4 class="text-xs font-black text-violet-900 uppercase tracking-wider m-0">COVID-19 - Dosis aplicadas por marca</h4>
      </div>
      <div class="cvc-tabla-wrap w-full rounded-xl border border-slate-200 bg-white">
        <table class="inf-cap-tabla w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <caption class="sr-only">COVID-19: meta, acumulado, dosis de esta semana por marca y avance contra la meta (Moderna y Pfizer suman)</caption>
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th scope="col" class="p-3">Subgrupo / Edad</th>
              <th scope="col" class="p-3 text-center">Meta Anual</th>
              <th scope="col" class="p-3 text-center">Acumulado</th>
              <th scope="col" class="p-3 text-center">Moderna<span class="sr-only"> esta semana</span></th>
              <th scope="col" class="p-3 text-center">Pfizer<span class="sr-only"> esta semana</span></th>
              <th scope="col" class="p-3 text-center">Avance %</th>
            </tr>
          </thead>
          <tbody class="tbody-inputs"></tbody>
        </table>
      </div>
      <p class="text-xs text-slate-500 m-0">La meta no distingue marca: Moderna y Pfizer suman contra el mismo número, aunque los frascos se hayan repartido por marca.</p>`;
    const tbody = card.querySelector(".tbody-inputs");
    rubros.forEach((r) => {
      const meta = Number(metas[r]);
      const celda = (m) => {
        if (!C.RUBROS_MARCA[m].includes(r)) return `<td class="p-3 text-center inf-num" aria-label="${MARCA_TXT[m]}: no aplica a este grupo"><span aria-hidden="true">—</span></td>`;
        const val = Number(previo?.[m]?.[r]) || 0;
        if (reglas[r]) return `<td class="p-3 text-center"><input type="number" id="input_cov_${m}_${r}" class="inf-input" data-m="${m}" data-r="${r}" disabled placeholder="—" title="${esc(reglas[r].texto)}" aria-label="${MARCA_TXT[m]}, ${esc(EDAD[r])}: no disponible por calendario"></td>`;
        return `<td class="p-3 text-center">
          <input type="number" min="0" step="1" inputmode="numeric" id="input_cov_${m}_${r}" class="inf-input" data-m="${m}" data-r="${r}"
            aria-label="${MARCA_TXT[m]}, ${esc(EDAD[r])}: dosis aplicadas esta semana" aria-describedby="disp_cov_${r}"
            value="${val > 0 ? val : ""}" ${ctx.cerrada ? 'disabled placeholder="—" title="La captura de esta semana está cerrada"' : ctx.bloqueada ? 'disabled title="Reporte guardado: presiona Editar para modificarlo"' : 'placeholder="0"'}>
        </td>`;
      };
      const row = document.createElement("tr");
      row.className = "inf-fila";
      row.innerHTML = `
        <th scope="row" class="p-3 inf-fila-edad"><span class="inf-edad">${esc(EDAD[r])}</span>${reglas[r] ? `<span class="inf-pill-regla">${esc(reglas[r].etiqueta)}</span>` : ""}</th>
        <td class="p-3 text-center inf-num">${fmt(meta)}</td>
        <td class="p-3 text-center inf-num inf-num--acum">${fmt(acumRubro[r])}</td>
        ${celda("MODERNA")}${celda("PFIZER")}
        <td class="p-3 text-center inf-col-avance">
          <span id="pct_cov_${r}" class="inf-pct" data-tono="none">0%</span>
          <div class="inf-barra"><div id="bar_cov_${r}" class="inf-barra-fill" data-tono="none" role="progressbar" aria-label="Avance contra la meta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="width:0%;"></div></div>
          <span id="disp_cov_${r}" class="inf-disp"></span>
        </td>`;
      tbody.appendChild(row);
    });
    box.appendChild(card);

    // Frascos que corresponden a la meta de la unidad: niños solo con Moderna (5 dosis), adultos con Pfizer (6 dosis)
    const F = root.CovidFrascos;
    if (F && F.frascosPorMeta) {
      const fm = F.frascosPorMeta(metas);
      const resumen = document.createElement("section");
      resumen.className = "cvc-frascos";
      resumen.setAttribute("aria-label", "Frascos que corresponden a la meta de tu unidad");
      resumen.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;margin-bottom:12px";
      const caja = (tit, num, det) => `<div style="flex:1 1 180px;border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px;background:#fff">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b">${tit}</div>
        <div style="font-size:26px;font-weight:900;color:#4c1d95;line-height:1.2">${fmt(num)} <span style="font-size:13px;font-weight:700;color:#64748b">frascos</span></div>
        <div style="font-size:12px;color:#64748b">${det}</div></div>`;
      resumen.innerHTML =
        caja("Moderna · niños de 6 a 59 meses", fm.moderna, `Meta de niños: ${fmt(fm.pedEq)} dosis de 0.5 mL ÷ 5 por frasco. Es la única marca para menores de 12 años (lineamientos 2026-2027).`) +
        caja("Pfizer · 12 años y más", fm.pfizer, `Meta de adultos: ${fmt(fm.adulto)} dosis ÷ 6 por frasco. Pfizer solo se aplica desde los 12 años.`) +
        caja("Total que te corresponde", fm.total, "Sin contar la pérdida que sume la Jurisdicción.");
      card.insertBefore(resumen, card.children[1]);
    }

    const leer = () => {
      const v = { MODERNA: {}, PFIZER: {} };
      box.querySelectorAll(".inf-input[data-m]").forEach((el) => { v[el.dataset.m][el.dataset.r] = Math.max(0, parseInt(el.value, 10) || 0); });
      return C.limpiar(v);
    };
    const repintar = () => {
      const nuevo = C.porRubro(leer());
      rubros.forEach((r) => {
        const meta = Number(metas[r] || 0);
        const total = acumRubro[r] + nuevo[r];
        const pct = meta > 0 ? Math.round((total / meta) * 100) : 0;
        const t = tono(meta, pct);
        const exceso = total - meta;
        const disp = box.querySelector(`#disp_cov_${r}`);
        const pctEl = box.querySelector(`#pct_cov_${r}`);
        const bar = box.querySelector(`#bar_cov_${r}`);
        if (exceso > 0) {
          disp.className = "inf-disp is-over";
          disp.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">warning</span>Te pasas por ${fmt(exceso)}`;
        } else {
          disp.className = "inf-disp" + (exceso === 0 ? " is-justo" : "");
          disp.textContent = `${fmt(total)} de ${fmt(meta)}`;
        }
        box.querySelectorAll(`.inf-input[data-r="${r}"]`).forEach((input) => {
          if (exceso > 0) { input.setAttribute("aria-invalid", "true"); input.classList.add("is-over"); }
          else { input.removeAttribute("aria-invalid"); input.classList.remove("is-over"); }
        });
        pctEl.textContent = `${pct}%`; pctEl.dataset.tono = t;
        bar.style.width = Math.min(pct, 100) + "%";
        bar.setAttribute("aria-valuenow", String(Math.min(pct, 100)));
        bar.dataset.tono = t;
      });
    };
    box.querySelectorAll(".inf-input[data-m]").forEach((el) => el.addEventListener("input", () => {
      repintar();
      if (ctx.alCambiar) ctx.alCambiar();
    }));
    repintar();

    ultimo = {
      total: () => C.totalDosis(leer()),
      /** Lo tecleado + su validación contra la meta (la usa el guardado del panel de captura). */
      recoger: () => {
        const v = leer();
        const val = C.validar(v, metas, acumRubro, previo, reglas);
        return { valores: v, error: val.error, sin_movimiento: C.totalDosis(v) === 0 };
      }
    };
    return true;
  }

  // Misma tarjeta «Siguiente paso: captura en CeNSIA» que Influenza (.inf-censia)
  function renderCensia(box, ctx, reporte) {
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
      const t = C.RUBROS.reduce((s, r) => s + (Number(reporte.valores?.[m]?.[r]) || 0), 0);
      return t > 0 ? `${MARCA_TXT[m]} ${fmt(t)}` : "";
    }).filter(Boolean).join(" · ");
    const sec = document.createElement("section");
    sec.className = "inf-censia";
    sec.setAttribute("aria-label", "Pasar este reporte de COVID-19 a CeNSIA");
    sec.innerHTML = `
      <div class="inf-censia__tit"><span class="material-symbols-rounded" aria-hidden="true">cloud_upload</span><b>Siguiente paso: COVID-19 en CeNSIA</b></div>
      <p>Este reporte (${fmt(total)} dosis${marcas ? ` · ${marcas}` : ""}) también se captura en la sección <b>COVID-19</b> de <b>Dosis Aplicadas → Captura</b> de CeNSIA, con fecha <b>${fmtF(fecha)}</b>. Tú revisas y pulsas <b>Guardar</b> allá.</p>
      ${previo ? `<p class="inf-censia__aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>Ya abriste CeNSIA con este reporte el ${esc(previo)}. En CeNSIA las capturas <b>se suman</b> (a diferencia de SIREVAQ, que reemplaza): si ya lo guardaste allá, no lo vuelvas a guardar; si cambió algo, captura solo la diferencia.</p>` : ""}
      <div data-guia></div>
      <p class="inf-censia__aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>El complemento lleva un solo reporte a la vez: al abrir CeNSIA con COVID-19, guarda primero lo de Influenza si aún no lo hiciste.</p>
      <div class="inf-censia__acciones"><a class="inf-censia__btn" id="cvcCensiaAbrir" href="${esc(cz.url)}" target="_blank" rel="noopener">Abrir CeNSIA y rellenar COVID-19</a></div>`;
    const gh = sec.querySelector("[data-guia]");
    if (gh) { if (typeof cz.guia === "function") gh.replaceWith(cz.guia()); else gh.remove(); }
    box.appendChild(sec);
    const abrir = sec.querySelector("#cvcCensiaAbrir");
    abrir.addEventListener("click", () => {
      const enlace = cz.enviarPaquete({ v: 1, clues: ctx.USER?.clues, fecha, valores: paquete });
      if (enlace) abrir.href = enlace;
      try { localStorage.setItem(clave, fmtF(cz.hoy())); } catch (e) { /* sin almacenamiento */ }
    });
  }

  root.CovidCapturaUI = {
    render,
    totalActual: () => (ultimo ? ultimo.total() : 0),
    recoger: () => (ultimo ? ultimo.recoger() : null)
  };
})(typeof window !== "undefined" ? window : globalThis);
