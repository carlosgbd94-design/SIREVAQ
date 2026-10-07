// Supabase simulado en memoria para biovac_jurisdiccion.html (Concentrado Jurisdiccional).
(function () {
  const J = 'jur-1';
  const pseudo = (id, muni) => ({ id, clues: 'JS1-' + muni, nombre: muni, municipio: muni, activo: true, jurisdiccion_id: J });
  const real = (id, clues, nombre, muni) => ({ id, clues, nombre, municipio: muni, activo: true, jurisdiccion_id: J });
  const rol = window.__FAKE_ROL__ || 'JURISDICCIONAL';
  const tables = {
    perfiles: [{ id: 'j1', usuario: 'juris', rol }],
    biovac_jurisdicciones: [{ id: J, nombre: 'Jurisdicción Sanitaria N°1' }],
    sis_config: [{ clave: 'inicio_captura_por_unidad', valor: '2026-10-01' }],
    biovac_unidades: [
      pseudo('ps-q', 'QUERETARO'), real('q-a', 'Q001', 'C.S. Alfa', 'QUERETARO'), real('q-b', 'Q002', 'C.S. Beta', 'QUERETARO'), real('q-c', 'Q003', 'C.S. Gamma', 'QUERETARO'),
      pseudo('ps-c', 'CORREGIDORA'), real('c-1', 'C001', 'C.S. Uno', 'CORREGIDORA'), real('c-2', 'C002', 'C.S. Dos', 'CORREGIDORA'),
      pseudo('ps-n', 'NHG'), real('n-1', 'N001', 'NHGQ', 'NHG'),
      pseudo('ps-h', 'HENM')
    ],
    biovac_movimientos: [],
    biovac_informes_jurisdiccionales: []
  };
  const mov = (unidad_id, estadoM, fue_corregido) => tables.biovac_movimientos.push({ unidad_id, anio: 2026, mes: 10, estado: estadoM, fue_corregido: !!fue_corregido });
  mov('q-a', 'CERRADO'); mov('q-b', 'BORRADOR'); mov('c-1', 'CERRADO'); mov('c-2', 'EN_CORRECCION', true); mov('n-1', 'CERRADO'); mov('ps-h', 'CERRADO');

  const fila = (o) => ({ pagina: 'PAGINA 1', bloque_id: 'b1', regla_especial: null, categoria: 'NORMAL', caducidad: '2027-02-28', existencia_anterior_frascos: 10, recibido_frascos: 20, aplicadas_a: 15, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 15, unidades_cerradas: 2, unidades_reportando: 2, es_provisional: false, ...o });
  const concentrado = [
    fila({ biologico_id: 'srp', clave: 'SRP', nombre_excel: 'VACUNA SRP', lote_id: 'l1', numero_lote: 'AB123', existencia_final_frascos: -5 }),
    fila({ biologico_id: 'srp', clave: 'SRP', nombre_excel: 'VACUNA SRP', lote_id: 'l2', numero_lote: 'AB124' }),
    fila({ biologico_id: 'hexa', clave: 'HEXAVALENTE', nombre_excel: 'VACUNA HEXAVALENTE', lote_id: 'l3', numero_lote: 'HX001', es_provisional: true, unidades_cerradas: 1 })
  ];
  const validaciones = [
    { severidad: 'ERROR', codigo: 'EXISTENCIA_NEGATIVA', mensaje: 'Existencia final negativa en un renglón', unidad: 'C.S. Alfa', biologico: 'VACUNA SRP', lote: 'AB123' },
    { severidad: 'ADVERTENCIA', codigo: 'MOVIMIENTO_NO_CERRADO', mensaje: 'x', unidad: 'C.S. Beta', biologico: null, lote: null },
    { severidad: 'ADVERTENCIA', codigo: 'MOVIMIENTO_NO_CERRADO', mensaje: 'x', unidad: 'C.S. Gamma', biologico: null, lote: null },
    { severidad: 'ADVERTENCIA', codigo: 'MOVIMIENTO_NO_CERRADO', mensaje: 'x', unidad: 'C.S. Dos', biologico: null, lote: null }
  ];
  const sis = [
    { clues: 'Q001', municipio: 'QUERETARO', estado: 'VALIDADO' }, { clues: 'Q002', municipio: 'QUERETARO', estado: 'ENVIADO' }, { clues: 'Q003', municipio: 'QUERETARO', estado: 'BORRADOR' },
    { clues: 'N001', municipio: 'NHG', estado: 'ENVIADO' }
  ];
  const rpc = {
    biovac_validar_concentrado: () => validaciones,
    biovac_correcciones_municipio_estado: () => (window.__CORR || []),
    biovac_concentrado_jurisdiccion: () => concentrado,
    sis06p_resumen_seguimiento: () => sis,
    biovac_detalle_lote_jurisdiccion: () => [
      { unidad_id: 'q-a', unidad_nombre: 'C.S. Alfa', movimiento_id: 'm-a', movimiento_estado: 'CERRADO', renglon_id: 'r-a', existencia_anterior_frascos: 0, recibido_frascos: 10, aplicadas_a: 12, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: -2, observaciones: '' },
      { unidad_id: 'q-b', unidad_nombre: 'C.S. Beta', movimiento_id: 'm-b', movimiento_estado: 'BORRADOR', renglon_id: 'r-b', existencia_anterior_frascos: 0, recibido_frascos: 5, aplicadas_a: 2, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 3, observaciones: '' },
      { unidad_id: 'c-1', unidad_nombre: 'C.S. Uno', movimiento_id: 'm-c1', movimiento_estado: 'CERRADO', renglon_id: 'r-c1', existencia_anterior_frascos: 1, recibido_frascos: 6, aplicadas_a: 2, aplicadas_b: 0, desechadas_a: 0, desechadas_b: 0, existencia_final_frascos: 5, observaciones: '' },
      { unidad_id: 'c-2', unidad_nombre: 'C.S. Dos', movimiento_id: 'm-c2', movimiento_estado: 'EN_CORRECCION', renglon_id: null, existencia_anterior_frascos: null, recibido_frascos: null, aplicadas_a: null, aplicadas_b: null, desechadas_a: null, desechadas_b: null, existencia_final_frascos: null, observaciones: null }
    ],
    biovac_generar_informe_jurisdiccional: (a) => {
      tables.biovac_informes_jurisdiccionales.push({ id: 'inf-' + tables.biovac_informes_jurisdiccionales.length, jurisdiccion_id: a.p_jurisdiccion_id, anio: a.p_anio, mes: a.p_mes, generado_por: a.p_usuario, generado_en: new Date().toISOString(), estado: 'GENERADO' });
      return 'ok';
    }
  };
  window.__FAKE = { tables, rpc };

  function constructor(tabla) {
    const q = { filtros: [], orden: [], limite: null, modo: 'many' };
    const api = {
      select() { return api; },
      eq(c, v) { q.filtros.push((r) => r[c] === v); return api; },
      in(c, arr) { q.filtros.push((r) => arr.includes(r[c])); return api; },
      not(c, op, v) { if (op === 'like') { const re = new RegExp('^' + String(v).replace(/%/g, '.*') + '$'); q.filtros.push((r) => !re.test(String(r[c] || ''))); } return api; },
      order(c) { q.orden.push(c); return api; },
      limit(n) { q.limite = n; return api; },
      single() { q.modo = 'single'; return api; },
      maybeSingle() { q.modo = 'maybe'; return api; },
      // Correcciones de Jurisdicción al movimiento de un municipio (biovac_correcciones_municipio)
      insert(row) {
        if (tabla === 'biovac_correcciones_municipio') {
          const unidades = tables.biovac_unidades.filter((u) => u.municipio === row.municipio).map((u) => u.id);
          const filas = rpc.biovac_detalle_lote_jurisdiccion().filter((d) => unidades.includes(d.unidad_id) && d.renglon_id);
          const sum = (c) => filas.reduce((a, d) => a + (Number(d[c]) || 0), 0);
          (window.__CORR = window.__CORR || []).push({
            id: 'cm1', municipio: row.municipio, lote_id: row.lote_id, categoria: row.categoria, motivo: row.motivo, creado_por: row.creado_por,
            creado_en: new Date().toISOString(), numero_lote: 'AB123', nombre_excel: 'VACUNA SRP',
            obj_recibido: row.recibido_frascos ?? null, obj_aplicadas_a: row.aplicadas_a ?? null, obj_aplicadas_b: row.aplicadas_b ?? null,
            obj_desechadas_a: row.desechadas_a ?? null, obj_desechadas_b: row.desechadas_b ?? null,
            act_recibido: sum('recibido_frascos'), act_aplicadas_a: sum('aplicadas_a'), act_aplicadas_b: sum('aplicadas_b'),
            act_desechadas_a: sum('desechadas_a'), act_desechadas_b: sum('desechadas_b'), coincide: false
          });
          (window.__INSERTS = window.__INSERTS || []).push(row);
        }
        return api;
      },
      update(p) { if (tabla === 'biovac_correcciones_municipio' && p && p.estado === 'CANCELADA') window.__CORR = []; return api; },
      upsert() { return api; }, delete() { return api; },
      neq() { return api; }, gt() { return api; }, gte() { return api; }, lt() { return api; }, lte() { return api; }, is() { return api; }, ilike() { return api; }, or() { return api; }, range() { return api; },
      then(ok, ko) {
        return new Promise((r) => setTimeout(r, 0)).then(() => {
          let d = (tables[tabla] || []).filter((r) => q.filtros.every((f) => f(r))).map((r) => ({ ...r }));
          q.orden.forEach((c) => d.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0)));
          if (q.limite != null) d = d.slice(0, q.limite);
          if (q.modo === 'single') return { data: d[0] || null, error: d.length ? null : { message: 'sin filas' } };
          if (q.modo === 'maybe') return { data: d[0] || null, error: null };
          return { data: d, error: null };
        }).then(ok, ko);
      }
    };
    return api;
  }

  window.supabase = {
    createClient() {
      return {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'j1', email: 'j@test.mx' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: constructor,
        rpc: (nombre, args) => new Promise((r) => setTimeout(r, 0)).then(() => ({ data: rpc[nombre] ? rpc[nombre](args || {}) : [], error: null })),
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel() {}
      };
    }
  };
})();
