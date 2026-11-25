/* Panel "Lectura del corte" del esquema básico de Indicadores RDA (usa rda_analisis.js).
 * Se pinta dentro de #rdaDashboardContent, así que la exportación a imagen/ZIP lo incluye; no usa texto sr-only. */
(function () {
    'use strict';
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const NIVEL = {
        optimo: { txt: 'Óptimo', color: '#10b981', ink: '#047857', icon: 'check_circle' },
        regular: { txt: 'Regular', color: '#f59e0b', ink: '#b45309', icon: 'warning' },
        critico: { txt: 'Crítico', color: '#e11d48', ink: '#be123c', icon: 'error' }
    };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const n0 = (n) => Math.round(n).toLocaleString('es-MX');
    const p1 = (n) => (Math.round(n * 10) / 10).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const corto = (s) => { s = String(s || ''); return s.length > 30 ? s.slice(0, 29) + '…' : s; };

    function tarjeta(g, unica) {
        const nv = g.nivel ? NIVEL[g.nivel] : null;
        const anualPct = g.anual > 0 ? g.eq / g.anual * 100 : 0;          // lo aplicado, contra la meta de todo el año
        const proyPct = g.proyPct || 0;
        const cortePct = g.mm12 ? 100 : (g.meta / (g.anual || 1)) * 100;   // dónde debería ir hoy
        const escala = Math.max(100, proyPct, anualPct) * 1.04;
        const w = (v) => Math.min(100, Math.max(0, v / escala * 100));
        const cierre = g.restantes === 0;
        const sobre = g.proyPct != null && g.proyPct >= 100;

        let ritmo = '';
        if (!cierre && g.ritmoNecesario != null) {
            const f = g.factorRitmo;
            ritmo = `
            <div class="rl-ritmo">
              <div><span class="rl-k">Ritmo actual</span><b>${n0(g.ritmo)}</b><span class="rl-u">/ mes</span></div>
              <div><span class="rl-k">Necesario para 100 %</span><b>${n0(g.ritmoNecesario)}</b><span class="rl-u">/ mes${f && f > 1.05 ? ` · ${p1(f)}×` : ''}</span></div>
            </div>`;
        } else if (cierre) {
            ritmo = `<div class="rl-ritmo"><div><span class="rl-k">Cierre del año</span><b>${p1(anualPct)} %</b><span class="rl-u">de la meta anual</span></div></div>`;
        }

        let sem = '';
        if (!unica && g.unidadesConMeta > 1) {
            const tot = g.unidadesConMeta;
            const seg = ['optimo', 'regular', 'critico'].filter(k => g.niveles[k] > 0)
                .map(k => `<span class="rl-seg" style="flex:${g.niveles[k]};background:${NIVEL[k].color}" title="${NIVEL[k].txt}: ${g.niveles[k]}"></span>`).join('');
            const leg = ['optimo', 'regular', 'critico'].map(k =>
                `<span class="rl-leg"><i class="rl-dot" style="background:${NIVEL[k].color}"></i>${g.niveles[k]} ${NIVEL[k].txt.toLowerCase()}${g.niveles[k] === 1 ? '' : 's'}</span>`).join('');
            sem = `<div class="rl-sub">${tot} unidades con población meta</div><div class="rl-semaforo">${seg}</div><div class="rl-legs">${leg}</div>`;
        }

        let top = '';
        if (!unica && g.topBrecha.length) {
            const max = g.topBrecha[0].brecha || 1;
            top = `<div class="rl-sub">Donde más falta${g.nMitadBrecha > 0 && g.unidadesConMeta >= 6 ? ` · ${g.nMitadBrecha} unidades suman la mitad` : ''}</div>` +
                g.topBrecha.slice(0, 4).map(f => `
                <div class="rl-fila"><span class="rl-nom" title="${esc(f.nombre)} · ${esc(f.municipio)}">${esc(corto(f.nombre))}</span>
                <span class="rl-barra"><i style="width:${Math.max(3, f.brecha / max * 100)}%;background:${NIVEL[f.nivel].color}"></i></span>
                <span class="rl-num">−${n0(f.brecha)}</span></div>`).join('');
        }

        return `
        <article class="rl-card" data-rl="${g.key}">
          <header><h4>${esc(g.nombre)}</h4>${nv ? `<span class="rl-pill" style="color:${nv.ink}"><span class="material-symbols-rounded" aria-hidden="true">${nv.icon}</span>${nv.txt} · ${p1(g.avance)} %</span>` : ''}</header>
          <div class="rl-pista" aria-label="Avance contra la meta anual">
            <i class="rl-hoy" style="width:${w(anualPct)}%"></i>
            ${!cierre ? `<i class="rl-proy" style="left:${w(anualPct)}%;width:${Math.max(0, w(proyPct) - w(anualPct))}%"></i>` : ''}
            <i class="rl-marca rl-m-corte" style="left:${w(cortePct)}%" title="Meta al corte"></i>
            <i class="rl-marca rl-m-100" style="left:${w(100)}%" title="Meta anual"></i>
          </div>
          <div class="rl-pista-txt">
            <span><b>${p1(anualPct)} %</b> de la meta anual aplicado</span>
            ${!cierre ? `<span>Proyección al cierre: <b style="color:${sobre ? '#047857' : '#be123c'}">${p1(proyPct)} %</b></span>` : ''}
          </div>
          ${ritmo}${sem}${top}
        </article>`;
    }

    window.renderRdaLectura = function (fUnits, mm, anio) {
        const A = window.RdaAnalisis;
        let host = document.getElementById('rdaLecturaCorte');
        if (!A) { if (host) host.remove(); return; }
        const grid = document.getElementById('rdaAnalysisGrid');
        if (!grid) return;
        if (!host) {
            host = document.createElement('section');
            host.id = 'rdaLecturaCorte';
            host.className = 'rl';
            host.setAttribute('aria-label', 'Lectura del corte');
            grid.parentElement.insertBefore(host, grid);
        }
        const r = A.analiza(fUnits, mm, { anio });
        r.grupos.forEach(g => { g.mm12 = r.mm === 12; });
        const unica = fUnits.length <= 1;
        const tit = r.titulares.slice(0, 4);
        host.innerHTML = `
          <div class="rl-head"><h3>Lectura del corte</h3>
            <p>Corte a ${esc(MESES[r.mm - 1])} · ${r.mm} de 12 meses. La barra muestra lo aplicado contra la meta de <b>todo el año</b>; la franja clara es lo que sumaría si se mantiene el ritmo actual.</p></div>
          ${tit.length ? `<ul class="rl-tit">${tit.map(t => `<li><span class="material-symbols-rounded" aria-hidden="true">${t.icon}</span><span>${esc(t.texto)}</span></li>`).join('')}</ul>` : ''}
          <div class="rl-grid">${r.grupos.map(g => tarjeta(g, unica)).join('')}</div>`;
        host._analisis = r;
    };
    // Esquemas de solo dosis: distribución, alcance por unidad y quién concentra
    window.renderRdaLecturaDosis = function (fUnits, esquema) {
        const A = window.RdaAnalisis;
        const r = A && A.analizaDosis(fUnits, esquema);
        let host = document.getElementById('rdaLecturaCorte');
        if (!r) { if (host) host.remove(); return; }
        const grid = document.getElementById('rdaAnalysisGrid');
        if (!grid) return;
        if (!host) {
            host = document.createElement('section');
            host.id = 'rdaLecturaCorte';
            host.className = 'rl';
            host.setAttribute('aria-label', 'Lectura del esquema');
            grid.parentElement.insertBefore(host, grid);
        }
        const unica = fUnits.length <= 1;
        const cards = r.bios.map(b => {
            const alc = r.unidades > 0 ? b.aplicaron / r.unidades * 100 : 0;
            const top = !unica && b.top.length ? `<div class="rl-sub">Quién más aplicó</div>` + b.top.map(f => `
                <div class="rl-fila"><span class="rl-nom" title="${esc(f.nombre)} · ${esc(f.municipio)}">${esc(corto(f.nombre))}</span>
                <span class="rl-barra"><i style="width:${Math.max(4, f.dosis / b.top[0].dosis * 100)}%;background:#0284c7"></i></span>
                <span class="rl-num">${n0(f.dosis)}</span></div>`).join('') : '';
            return `<article class="rl-card">
              <header><h4>${esc(b.label)}</h4><span class="rl-pill" style="color:#0f172a">${p1(b.share)} % del esquema</span></header>
              <div class="rl-ritmo"><div><span class="rl-k">Dosis</span><b>${n0(b.total)}</b></div>
              ${unica ? '' : `<div><span class="rl-k">Unidades que aplicaron</span><b>${b.aplicaron}</b><span class="rl-u">de ${r.unidades}</span></div>`}</div>
              ${unica ? '' : `<div class="rl-pista" aria-label="Alcance en unidades"><i class="rl-hoy" style="width:${alc}%;border-radius:6px"></i></div>
              <div class="rl-pista-txt"><span><b>${p1(alc)} %</b> de las unidades registran dosis${b.sin ? ` · ${b.sin} sin dosis` : ''}</span></div>`}
              ${top}</article>`;
        }).join('');
        const muni = !unica && r.municipios.length > 1 ? `<div class="rl-sub" style="margin-top:18px">Dosis por municipio</div>` + r.municipios.map(m => `
            <div class="rl-fila rl-fila-m"><span class="rl-nom">${esc(m.municipio)}</span>
            <span class="rl-barra"><i style="width:${r.total > 0 ? Math.max(2, m.dosis / r.municipios[0].dosis * 100) : 0}%;background:#0369a1"></i></span>
            <span class="rl-num">${n0(m.dosis)} · ${r.total > 0 ? p1(m.dosis / r.total * 100) : '0,0'} %</span></div>`).join('') : '';
        host.innerHTML = `
          <div class="rl-head"><h3>Lectura del esquema</h3>
            <p>Este esquema no tiene población meta: se lee cuánto pesa cada biológico, cuántas unidades lo aplican y quién concentra las dosis.</p></div>
          ${r.titulares.length ? `<ul class="rl-tit">${r.titulares.map(t => `<li><span class="material-symbols-rounded" aria-hidden="true">${t.icon}</span><span>${esc(t.texto)}</span></li>`).join('')}</ul>` : ''}
          <div class="rl-grid rl-grid-d">${cards}</div>${muni}`;
        host._analisis = r;
    };
    // Vista "Por biológico" del esquema básico: un biológico por tarjeta, del más rezagado al más avanzado
    window.renderRdaLecturaBio = function (fUnits, mm) {
        const A = window.RdaAnalisis;
        const r = A && A.analizaBiologicos(fUnits, mm);
        let host = document.getElementById('rdaLecturaCorte');
        if (!r || !r.bios.length) { if (host) host.remove(); return; }
        const grid = document.getElementById('rdaAnalysisGrid');
        if (!grid) return;
        if (!host) {
            host = document.createElement('section');
            host.id = 'rdaLecturaCorte';
            host.className = 'rl';
            host.setAttribute('aria-label', 'Lectura por biológico');
            grid.parentElement.insertBefore(host, grid);
        }
        const unica = fUnits.length <= 1;
        const cards = r.orden.map(b => {
            const nv = NIVEL[b.nivel];
            const tot = b.unidadesConMeta;
            const sem = !unica && tot > 1 ? `<div class="rl-semaforo" style="margin-top:12px">${['optimo', 'regular', 'critico'].filter(k => b.niveles[k] > 0)
                .map(k => `<span class="rl-seg" style="flex:${b.niveles[k]};background:${NIVEL[k].color}" title="${NIVEL[k].txt}: ${b.niveles[k]}"></span>`).join('')}</div>
                <div class="rl-legs">${['optimo', 'regular', 'critico'].map(k => `<span class="rl-leg"><i class="rl-dot" style="background:${NIVEL[k].color}"></i>${b.niveles[k]} ${NIVEL[k].txt.toLowerCase()}${b.niveles[k] === 1 ? '' : 's'}</span>`).join('')}</div>` : '';
            const top = !unica && b.peores.length ? `<div class="rl-sub">Donde más falta</div>` + b.peores.map(f => `
                <div class="rl-fila"><span class="rl-nom" title="${esc(f.nombre)} · ${esc(f.municipio)}">${esc(corto(f.nombre))}</span>
                <span class="rl-barra"><i style="width:${Math.max(4, f.brecha / b.peores[0].brecha * 100)}%;background:${NIVEL[f.nivel].color}"></i></span>
                <span class="rl-num">−${n0(f.brecha)}</span></div>`).join('') : '';
            return `<article class="rl-card">
              <header><h4>${esc(b.nombre)}</h4><span class="rl-pill" style="color:${nv.ink}"><span class="material-symbols-rounded" aria-hidden="true">${nv.icon}</span>${nv.txt} · ${p1(b.avance)} %</span></header>
              <div class="rl-pista"><i class="rl-hoy" style="width:${Math.min(100, b.avance)}%;border-radius:6px;background:${nv.color}"></i><i class="rl-marca rl-m-100" style="left:100%"></i></div>
              <div class="rl-pista-txt"><span><b>${n0(b.dosis)}</b> dosis de <b>${n0(b.meta)}</b> de meta al corte${b.multi ? ' · suma las 3 dosis del esquema' : ''}</span></div>
              ${sem}${top}</article>`;
        }).join('');
        host.innerHTML = `
          <div class="rl-head"><h3>Lectura por biológico</h3>
            <p>Corte a ${esc(MESES[r.mm - 1])} · ${r.mm} de 12 meses. Cada biológico se mide contra la meta al corte de su grupo de edad; van del más rezagado al más avanzado.</p></div>
          ${r.titulares.length ? `<ul class="rl-tit">${r.titulares.slice(0, 4).map(t => `<li><span class="material-symbols-rounded" aria-hidden="true">${t.icon}</span><span>${esc(t.texto)}</span></li>`).join('')}</ul>` : ''}
          <div class="rl-grid">${cards}</div>`;
        host._analisis = r;
    };

    // Comparativa multianual: devuelve el HTML (la vista arma su contenido con una plantilla de texto)
    window.rdaLecturaComparativaHtml = function (u25, u26, mm25, mm26) {
        const A = window.RdaAnalisis;
        if (!A || !A.comparaAnios) return '';
        const r = A.comparaAnios(u25, u26, mm25, mm26);
        if (!r.grupos.some(g => g.comparables > 0)) return '';
        const f1 = (n) => p1(n);
        const filas = (lista, signo) => lista.map(f => `
            <div class="rl-fila"><span class="rl-nom" title="${esc(f.nombre)} · ${esc(f.municipio)}">${esc(corto(f.nombre))}</span>
            <span class="rl-barra"><i style="width:${Math.min(100, Math.max(4, Math.abs(f.delta)))}%;background:${signo > 0 ? '#10b981' : '#e11d48'}"></i></span>
            <span class="rl-num">${signo > 0 ? '+' : ''}${f1(f.delta)}</span></div>`).join('');
        const cards = r.grupos.filter(g => g.comparables > 0).map(g => {
            const tot = g.comparables;
            const seg = [['mejoran', '#10b981', 'avanzan más'], ['estables', '#94a3b8', 'se mantienen'], ['caen', '#e11d48', 'van por debajo']]
                .filter(([k]) => g[k] > 0).map(([k, c, t]) => `<span class="rl-seg" style="flex:${g[k]};background:${c}" title="${g[k]} ${t}"></span>`).join('');
            return `<article class="rl-card">
              <header><h4>${esc(g.nombre)}</h4><span class="rl-pill" style="color:#0f172a">${tot} unidades comparables</span></header>
              <div class="rl-semaforo" style="margin-top:12px">${seg}</div>
              <div class="rl-legs"><span class="rl-leg"><i class="rl-dot" style="background:#10b981"></i>${g.mejoran} avanzan más</span><span class="rl-leg"><i class="rl-dot" style="background:#94a3b8"></i>${g.estables} se mantienen</span><span class="rl-leg"><i class="rl-dot" style="background:#e11d48"></i>${g.caen} van por debajo</span></div>
              ${g.peores.length ? `<div class="rl-sub">Mayores caídas (puntos)</div>${filas(g.peores, -1)}` : ''}
              ${g.mejores.length ? `<div class="rl-sub">Mayores avances (puntos)</div>${filas(g.mejores, 1)}` : ''}
            </article>`;
        }).join('');
        const nota = mm25 !== mm26 ? `El 2025 se toma completo (${mm25} meses) y el 2026 a ${mm26}; el avance se calcula contra la meta de los meses de cada corte, así que los porcentajes sí son comparables.` : 'Mismo corte en ambos años.';
        return `<section class="rl" id="rdaLecturaComparativa" style="margin:0 0 32px" aria-label="Lectura de la comparación">
          <div class="rl-head"><h3>Lectura de la comparación</h3><p>${esc(nota)} Se comparan las unidades presentes en los dos años; "avanzan más" y "van por debajo" usan una banda de ±3 puntos.</p></div>
          ${r.titulares.length ? `<ul class="rl-tit">${r.titulares.map(t => `<li><span class="material-symbols-rounded" aria-hidden="true">${t.icon}</span><span>${esc(t.texto)}</span></li>`).join('')}</ul>` : ''}
          <div class="rl-grid">${cards}</div></section>`;
    };
    window.removeRdaLectura = function () { document.getElementById('rdaLecturaCorte')?.remove(); };
})();
