/* Lectura analítica del avance RDA (esquema básico). Cálculo puro, sin DOM: lo usa rda_ui.js y lo prueban los tests.
 * La fórmula RDA NO cambia: avance = (dosis ÷ divisor) ÷ (población × 0.0833 × meses del corte). Aquí solo se
 * LEE ese avance: ritmo, proyección al cierre, brecha por unidad/municipio, semáforo y concentración. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.RdaAnalisis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const FACTOR = 0.0833;
    // Mismos cortes que las tarjetas de avance: >=95 óptimo, >=75 regular, resto crítico.
    const nivelDe = (p) => (p >= 95 ? 'optimo' : p >= 75 ? 'regular' : 'critico');

    // Definición de cada grupo de edad: población, dosis y divisor del esquema básico.
    const GRUPOS = [
        { key: 'menor1', nombre: 'Menores de 1 año', corto: '<1', div: 4, vacunas: '5 vacunas',
          pob: u => u.pob_menor_1 || 0,
          dosis: u => (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_2_dosis || 0) },
        { key: 'uno', nombre: 'Niños de 1 año', corto: '1', div: 3, vacunas: '3 vacunas',
          pob: u => u.pob_1_ano || 0,
          dosis: u => (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.srp_2_dosis || 0) },
        { key: 'cuatro', nombre: 'Niños de 4 años', corto: '4', div: 1, vacunas: 'DPT',
          pob: u => u.pob_4_anos || 0,
          dosis: u => u.dpt_4_dosis || 0 }
    ];
    const GRUPO_6 = { key: 'seis', nombre: 'Niños de 6 años', corto: '6', div: 1, vacunas: 'SRP',
        pob: u => u.pob_6_anos || 0, dosis: u => u.srp_6_dosis || 0 };

    const r1 = (n) => Math.round(n * 10) / 10;

    function medidasDe(g, u, mm) {
        const pob = g.pob(u);
        const meta = pob * FACTOR * mm;
        const eq = g.dosis(u) / g.div;
        return { pob, meta, eq, avance: meta > 0 ? eq / meta * 100 : null, brecha: Math.max(0, meta - eq) };
    }

    /** unidades: filas de get_rda_indicators ya filtradas por ámbito. mm: meses del corte (1-12). */
    function analiza(unidades, mm, opciones) {
        opciones = opciones || {};
        mm = Math.min(12, Math.max(1, Number(mm) || 12));
        const grupos = GRUPOS.concat(opciones.anio === 2025 ? [GRUPO_6] : []);
        const res = grupos.map(g => {
            const filas = [];
            let pobT = 0, metaT = 0, eqT = 0;
            for (const u of unidades) {
                const m = medidasDe(g, u, mm);
                pobT += m.pob; metaT += m.meta; eqT += m.eq;
                if (m.meta >= 1) filas.push({ clues: u.clues, nombre: u.nombre || u.clues, municipio: u.municipio || '', ...m });
            }
            const avance = metaT > 0 ? eqT / metaT * 100 : null;
            const restantes = 12 - mm;
            const ritmo = eqT / mm;                       // aplicadas equivalentes por mes, a la fecha
            const anual = pobT * FACTOR * 12;             // meta del año completo
            const proyeccion = eqT + ritmo * restantes;   // cierre si se mantiene el ritmo
            const proyPct = anual > 0 ? proyeccion / anual * 100 : null;
            const faltanAnual = Math.max(0, anual - eqT);
            const ritmoNecesario = restantes > 0 ? faltanAnual / restantes : null;
            const brechaCorte = Math.max(0, metaT - eqT);

            // Semáforo por unidad (solo unidades con población meta)
            const niveles = { optimo: 0, regular: 0, critico: 0 };
            filas.forEach(f => { f.nivel = nivelDe(f.avance); niveles[f.nivel]++; });

            // Brecha: quién concentra lo que falta
            const porBrecha = filas.filter(f => f.brecha > 0).sort((a, b) => b.brecha - a.brecha);
            const brechaUnidades = porBrecha.reduce((s, f) => s + f.brecha, 0);
            let acum = 0, nMitad = 0;
            for (const f of porBrecha) { acum += f.brecha; nMitad++; if (acum >= brechaUnidades * 0.5) break; }

            // Municipios
            const mun = new Map();
            for (const f of filas) {
                const k = f.municipio || 'SIN MUNICIPIO';
                const a = mun.get(k) || { municipio: k, meta: 0, eq: 0, brecha: 0, unidades: 0 };
                a.meta += f.meta; a.eq += f.eq; a.brecha += f.brecha; a.unidades++;
                mun.set(k, a);
            }
            const municipios = [...mun.values()].map(a => ({ ...a, avance: a.meta > 0 ? a.eq / a.meta * 100 : null }))
                .sort((a, b) => b.brecha - a.brecha);

            return {
                key: g.key, nombre: g.nombre, corto: g.corto, vacunas: g.vacunas, div: g.div,
                pob: pobT, meta: metaT, eq: eqT, avance, nivel: avance == null ? null : nivelDe(avance),
                brechaCorte, restantes, ritmo, anual, proyeccion, proyPct, faltanAnual, ritmoNecesario,
                // cuántas veces hay que multiplicar el ritmo actual para cerrar en 100 %
                factorRitmo: ritmoNecesario != null && ritmo > 0 ? ritmoNecesario / ritmo : null,
                niveles, unidadesConMeta: filas.length,
                filas, topBrecha: porBrecha.slice(0, 5), nMitadBrecha: nMitad, brechaUnidades,
                municipios, mejores: filas.slice().sort((a, b) => b.avance - a.avance).slice(0, 3)
            };
        });
        return { mm, grupos: res, titulares: titulares(res, mm) };
    }

    // Frases cortas y accionables que cruzan los grupos (las tarjetas ya dicen lo propio de cada grupo).
    function titulares(gs, mm) {
        const out = [];
        const fmt = (n) => Math.round(n).toLocaleString('es-MX');
        const ok = gs.filter(g => g.avance != null);
        if (!ok.length) return out;
        const restantes = 12 - mm;

        if (restantes > 0) {
            const sinAlcanzar = ok.filter(g => g.proyPct != null && g.proyPct < 100);
            const lejano = ok.filter(g => g.factorRitmo != null).sort((a, b) => b.factorRitmo - a.factorRitmo)[0];
            if (!sinAlcanzar.length) {
                out.push({ prioridad: 1, icon: 'verified', texto: `Quedan ${restantes} ${restantes === 1 ? 'mes' : 'meses'} y, al ritmo actual, los ${ok.length} grupos cierran el año en 100 % o más.` });
            } else if (lejano) {
                out.push({ prioridad: 1, icon: 'speed', texto: `Quedan ${restantes} ${restantes === 1 ? 'mes' : 'meses'}: al ritmo actual ${sinAlcanzar.length === ok.length ? 'ningún grupo' : sinAlcanzar.length + ' de ' + ok.length + ' grupos no'} llega${sinAlcanzar.length === ok.length ? '' : 'n'} al 100 % anual. El más lejano es ${lejano.nombre.toLowerCase()}: necesita ${(Math.round(lejano.factorRitmo * 10) / 10)}× su ritmo actual.` });
            }
        }

        // Concentración: el grupo donde menos unidades explican la mitad del rezago
        const conc = ok.filter(g => g.unidadesConMeta >= 6 && g.nMitadBrecha > 0 && g.brechaUnidades > 0)
            .sort((a, b) => a.nMitadBrecha / a.unidadesConMeta - b.nMitadBrecha / b.unidadesConMeta)[0];
        if (conc) out.push({ prioridad: 2, icon: 'filter_alt', texto: `El rezago está concentrado: en ${conc.nombre.toLowerCase()}, ${conc.nMitadBrecha} de ${conc.unidadesConMeta} unidades suman la mitad de lo que falta (${fmt(conc.brechaUnidades)} equivalentes).` });

        // Municipio y unidad con más rezago sumando los grupos
        const mun = new Map(), uni = new Map();
        let total = 0;
        for (const g of ok) for (const f of g.filas) {
            if (f.brecha <= 0) continue;
            total += f.brecha;
            const km = f.municipio || 'SIN MUNICIPIO';
            mun.set(km, (mun.get(km) || 0) + f.brecha);
            const u = uni.get(f.clues) || { nombre: f.nombre, municipio: f.municipio, brecha: 0 };
            u.brecha += f.brecha; uni.set(f.clues, u);
        }
        if (total > 0 && mun.size > 1) {
            const [m, b] = [...mun.entries()].sort((a, c) => c[1] - a[1])[0];
            out.push({ prioridad: 3, icon: 'location_on', texto: `${m} aporta ${Math.round(b / total * 100)} % del rezago jurisdiccional sumando los grupos (${fmt(b)} de ${fmt(total)} equivalentes).` });
        }
        if (total > 0 && uni.size > 3) {
            const u = [...uni.values()].sort((a, c) => c.brecha - a.brecha)[0];
            out.push({ prioridad: 3, icon: 'domain', texto: `${u.nombre} es la unidad con más rezago: ${Math.round(u.brecha / total * 100)} % del total (${fmt(u.brecha)} equivalentes).` });
        }
        return out.sort((a, b) => a.prioridad - b.prioridad);
    }

    // ── Esquemas de solo dosis (adolescentes/adultos, mayores, embarazadas, adicionales): no hay población meta,
    // así que se lee la distribución: qué biológico pesa, qué municipio/unidades concentran y quién no aplicó.
    const ESQUEMAS_DOSIS = {
        adultos: [['HepB', 'adol_hb'], ['SR', 'adol_sr'], ['VPH', 'adol_vph'], ['Td', 'adol_td'], ['Tdpa', 'adol_tdpa']],
        mayores: [['Neumo 13', 'am_neumo13'], ['Neumo 20', 'am_neumo20'], ['Td mayores', 'am_td']],
        embarazadas: [['Tdpa', 'emb_tdpa'], ['VSR', 'emb_vsr']],
        adicionales: [['Varicela', 'varicela'], ['Hepatitis A', 'hepatitis_a']]
    };

    function analizaDosis(unidades, esquema) {
        const defs = ESQUEMAS_DOSIS[esquema];
        if (!defs) return null;
        const us = unidades.map(u => {
            const por = defs.map(([, campo]) => Number(u[campo]) || 0);
            return { clues: u.clues, nombre: u.nombre || u.clues, municipio: u.municipio || 'SIN MUNICIPIO', por, total: por.reduce((a, b) => a + b, 0) };
        });
        const total = us.reduce((a, u) => a + u.total, 0);
        const bios = defs.map(([label], i) => {
            const t = us.reduce((a, u) => a + u.por[i], 0);
            const aplicaron = us.filter(u => u.por[i] > 0).length;
            const top = us.filter(u => u.por[i] > 0).sort((a, b) => b.por[i] - a.por[i]).slice(0, 3).map(u => ({ nombre: u.nombre, municipio: u.municipio, dosis: u.por[i] }));
            return { label, total: t, share: total > 0 ? t / total * 100 : 0, aplicaron, sin: us.length - aplicaron, top };
        });
        const mun = new Map();
        us.forEach(u => { const m = mun.get(u.municipio) || { municipio: u.municipio, dosis: 0, unidades: 0 }; m.dosis += u.total; m.unidades++; mun.set(u.municipio, m); });
        const municipios = [...mun.values()].sort((a, b) => b.dosis - a.dosis);
        const ordenadas = us.filter(u => u.total > 0).sort((a, b) => b.total - a.total);
        let acum = 0, nMitad = 0;
        for (const u of ordenadas) { acum += u.total; nMitad++; if (acum >= total * 0.5) break; }
        const sinDosis = us.filter(u => u.total === 0);
        const out = { total, unidades: us.length, bios, municipios, sinDosis, nMitad, conDosis: ordenadas.length, titulares: [] };
        const fmt = (n) => Math.round(n).toLocaleString('es-MX');
        const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-MX');
        if (total > 0) {
            const g = bios.slice().sort((a, b) => b.total - a.total)[0];
            if (bios.length > 1) out.titulares.push({ icon: 'vaccines', texto: `${g.label} es el biológico que más pesa: ${pct(g.share)} % de las ${fmt(total)} dosis del esquema.` });
            const m = municipios[0];
            if (municipios.length > 1 && m.dosis > 0) out.titulares.push({ icon: 'location_on', texto: `${m.municipio} aplica ${pct(m.dosis / total * 100)} % de las dosis con ${pct(m.unidades / us.length * 100)} % de las unidades.` });
            if (ordenadas.length >= 6) out.titulares.push({ icon: "filter_alt", texto: nMitad === 1 ? `${ordenadas[0].nombre} sola suma la mitad de las dosis del esquema.` : `${nMitad} de ${ordenadas.length} unidades que aplicaron suman la mitad de las dosis.` });
        }
        if (us.length > 1 && sinDosis.length) {
            const nombres = sinDosis.length <= 4 ? `: ${sinDosis.map(u => u.nombre).join(', ')}` : '';
            out.titulares.push({ icon: 'report', texto: `${sinDosis.length} de ${us.length} unidades no registran ninguna dosis de este esquema${nombres}.` });
        }
        return out;
    }

    /** Compara el avance de cada unidad en dos años (mismo CLUES). u25/u26: filas de get_rda_indicators;
     *  mm25/mm26: meses del corte de cada año. "Mejoró" y "cayó" usan una banda de ±3 puntos como la tabla comparativa. */
    function comparaAnios(u25, u26, mm25, mm26) {
        const por25 = new Map(u25.map(u => [u.clues, u]));
        const BANDA = 3;
        const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('es-MX');
        const grupos = GRUPOS.map(g => {
            const filas = [];
            for (const u of u26) {
                const v = por25.get(u.clues);
                if (!v) continue;
                const a = medidasDe(g, v, mm25), b = medidasDe(g, u, mm26);
                if (a.meta < 1 || b.meta < 1) continue;
                filas.push({ clues: u.clues, nombre: u.nombre || u.clues, municipio: u.municipio || '', av25: a.avance, av26: b.avance, delta: b.avance - a.avance, metaMin: Math.min(a.meta, b.meta) });
            }
            const mejoran = filas.filter(f => f.delta > BANDA).length;
            const caen = filas.filter(f => f.delta < -BANDA).length;
            // Rankings: al menos 30 aplicaciones de meta al corte en ambos años. Una unidad móvil con población casi nula
            // daría porcentajes de cientos y taparía lo importante (sigue contando en el semáforo).
            const ord = filas.filter(f => f.metaMin >= 30).sort((x, y) => y.delta - x.delta);
            return { key: g.key, nombre: g.nombre, comparables: filas.length, mejoran, caen, estables: filas.length - mejoran - caen,
                mejores: ord.filter(f => f.delta > 0).slice(0, 3), peores: ord.slice().reverse().filter(f => f.delta < 0).slice(0, 3) };
        });
        const titulares = [];
        for (const g of grupos) {
            if (g.comparables >= 5) titulares.push({ icon: g.caen > g.mejoran ? 'trending_down' : 'trending_up',
                texto: `${g.nombre}: ${g.mejoran} de ${g.comparables} unidades avanzan más que el año pasado, ${g.estables} se mantienen y ${g.caen} van por debajo.` });
        }
        const todas = grupos.flatMap(g => g.peores.map(f => ({ ...f, grupo: g.nombre })));
        const caida = todas.sort((a, b) => a.delta - b.delta)[0];
        if (caida) titulares.push({ icon: 'warning', texto: `Mayor caída: ${caida.nombre} (${caida.grupo.toLowerCase()}) pasó de ${fmt(caida.av25)} % a ${fmt(caida.av26)} % (${fmt(caida.delta)} pts).` });
        const subidas = grupos.flatMap(g => g.mejores.map(f => ({ ...f, grupo: g.nombre })));
        const alza = subidas.sort((a, b) => b.delta - a.delta)[0];
        if (alza) titulares.push({ icon: 'emoji_events', texto: `Mayor avance: ${alza.nombre} (${alza.grupo.toLowerCase()}) pasó de ${fmt(alza.av25)} % a ${fmt(alza.av26)} % (+${fmt(alza.delta)} pts).` });
        return { grupos, titulares };
    }

    // ── Vista "Por biológico": misma fórmula de la tabla (dosis del biológico ÷ meta al corte de su grupo, sin divisor)
    const BIOLOGICOS = [
        { key: 'v1', nombre: 'BCG', grupo: 'menor1', dosis: u => u.bcg_dosis || 0 },
        { key: 'v2', nombre: 'Hepatitis B', grupo: 'menor1', dosis: u => u.hepb_0_7_dosis || 0 },
        { key: 'v3', nombre: 'Rotavirus', grupo: 'menor1', dosis: u => u.rota_2_dosis || 0 },
        { key: 'v4', nombre: 'Hexavalente <1 año', multi: true, grupo: 'menor1', dosis: u => (u.hexa_1_dosis || 0) + (u.hexa_2_dosis || 0) + (u.hexa_3_dosis || 0) },
        { key: 'v5', nombre: 'Hexavalente 1 año', grupo: 'uno', dosis: u => u.hexa_ref_dosis || 0 },
        { key: 'v6', nombre: 'Neumocócica <1 año', multi: true, grupo: 'menor1', dosis: u => (u.neumo_1_dosis || 0) + (u.neumo_2_dosis || 0) + (u.neumo_c1_dosis || 0) + (u.neumo_c2_dosis || 0) },
        { key: 'v7', nombre: 'Neumocócica 1 año', grupo: 'uno', dosis: u => (u.neumo_ref_dosis || 0) + (u.neumo_c3_dosis || 0) },
        { key: 'v8', nombre: 'SRP', grupo: 'uno', dosis: u => (u.srp_1_dosis || 0) + (u.srp_2_dosis || 0) },
        { key: 'v9', nombre: 'DPT', grupo: 'cuatro', dosis: u => u.dpt_4_dosis || 0 }
    ];
    const POB_GRUPO = { menor1: u => u.pob_menor_1 || 0, uno: u => u.pob_1_ano || 0, cuatro: u => u.pob_4_anos || 0 };

    function analizaBiologicos(unidades, mm) {
        mm = Math.min(12, Math.max(1, Number(mm) || 12));
        const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('es-MX');
        const bios = BIOLOGICOS.map(b => {
            const filas = [];
            let metaT = 0, dosT = 0;
            for (const u of unidades) {
                const meta = POB_GRUPO[b.grupo](u) * FACTOR * mm;
                const dos = b.dosis(u);
                metaT += meta; dosT += dos;
                if (meta >= 1) filas.push({ clues: u.clues, nombre: u.nombre || u.clues, municipio: u.municipio || '', meta, dosis: dos, avance: dos / meta * 100, brecha: Math.max(0, meta - dos) });
            }
            const niveles = { optimo: 0, regular: 0, critico: 0 };
            filas.forEach(f => { f.nivel = nivelDe(f.avance); niveles[f.nivel]++; });
            const avance = metaT > 0 ? dosT / metaT * 100 : null;
            const peores = filas.filter(f => f.brecha > 0).sort((a, c) => c.brecha - a.brecha).slice(0, 3);
            return { key: b.key, nombre: b.nombre, multi: !!b.multi, grupo: b.grupo, avance, nivel: avance == null ? null : nivelDe(avance), meta: metaT, dosis: dosT,
                brecha: Math.max(0, metaT - dosT), niveles, unidadesConMeta: filas.length, peores };
        }).filter(b => b.avance != null);
        const orden = bios.slice().sort((a, c) => a.avance - c.avance);
        // Hexavalente y Neumocócica <1 año suman las 3 dosis por niño (la tabla las mide así), por eso pasan de 100 %:
        // no son comparables con los biológicos de una sola dosis y quedan fuera de las frases de más/menos avanzado.
        const comparables = orden.filter(b => !b.multi);
        const titulares = [];
        if (comparables.length > 1) {
            const lo = comparables[0], hi = comparables[comparables.length - 1];
            titulares.push({ icon: 'vaccines', texto: `El biológico más rezagado es ${lo.nombre} (${fmt(lo.avance)} %); el más avanzado, ${hi.nombre} (${fmt(hi.avance)} %). Hay ${fmt(hi.avance - lo.avance)} puntos de distancia.` });
        }
        // Unidades con varios biológicos críticos
        const porUnidad = new Map();
        for (const b of BIOLOGICOS) for (const u of unidades) {
            const meta = POB_GRUPO[b.grupo](u) * FACTOR * mm;
            if (meta < 1) continue;
            const o = porUnidad.get(u.clues) || { nombre: u.nombre || u.clues, n: 0, crit: 0 };
            o.n++; if (b.dosis(u) / meta * 100 < 75) o.crit++;
            porUnidad.set(u.clues, o);
        }
        const todasCrit = [...porUnidad.values()].filter(o => o.n >= 5 && o.crit === o.n);
        if (todasCrit.length) titulares.push({ icon: 'report', texto: `${todasCrit.length} ${todasCrit.length === 1 ? 'unidad está' : 'unidades están'} en nivel crítico en todos sus biológicos con meta${todasCrit.length <= 3 ? `: ${todasCrit.map(o => o.nombre).join(', ')}` : ''}.` });
        return { mm, bios, orden, titulares };
    }

    return { GRUPOS, FACTOR, nivelDe, analiza, titulares, ESQUEMAS_DOSIS, analizaDosis, comparaAnios, BIOLOGICOS, analizaBiologicos };
});
