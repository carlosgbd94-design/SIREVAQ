// Supabase simulado en memoria para biovac.html con un perfil MUNICIPAL: lo justo
// para el cierre guiado (seguimiento, comparativo, concentrado, validación).
// Toda tabla no listada responde vacía; toda RPC no listada responde [].
(function () {
  const unidad = (id, clues, nombre) => ({ id, clues, nombre, municipio: 'QUERETARO', activo: true });
  const tables = {
    perfiles: [{ id: 'u1', usuario: 'muni', rol: window.__FAKE_ROL__ || 'MUNICIPAL', municipio_asignado: 'QUERETARO', municipios_allowed: ['QUERETARO'], clues: null, unidad: null, municipio: 'QUERETARO' }],
    biovac_unidades: [
      { id: 'ps-q', clues: 'JS1-QUERETARO', nombre: 'Querétaro', municipio: 'QUERETARO', activo: true },
      unidad('un-a', 'QTSSA000001', 'C.S. Alfa'), unidad('un-b', 'QTSSA000002', 'C.S. Beta'),
      unidad('un-c', 'QTSSA000003', 'C.S. Gamma'), unidad('un-d', 'QTSSA000004', 'C.S. Delta')
    ],
    sis06p_capturas: [],
    sis_variables: []
  };
  const hoy = new Date();
  // El SIS se abre en el mes que se reporta: el anterior al actual (enero -> diciembre del año pasado).
  const mes = hoy.getMonth() === 0 ? 12 : hoy.getMonth(), anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  // Seguimiento (lo que devuelve sis06p_resumen_seguimiento)
  const seg = [
    { clues: 'QTSSA000001', unidad: 'C.S. Alfa', municipio: 'QUERETARO', estado: 'ENVIADO', enviado_por: 'Ana', enviado_en: '2026-09-30T10:00:00Z', paloteo_dosis: 120, movimiento_lotes: 4, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0 },
    { clues: 'QTSSA000002', unidad: 'C.S. Beta', municipio: 'QUERETARO', estado: 'BORRADOR', paloteo_dosis: 10, movimiento_lotes: 0, movimiento_estado: null, diferencias: 0, correcciones_pendientes: 0 },
    { clues: 'QTSSA000003', unidad: 'C.S. Gamma', municipio: 'QUERETARO', estado: 'ENVIADO', enviado_por: 'Luis', enviado_en: '2026-10-01T10:00:00Z', paloteo_dosis: 300, movimiento_lotes: 6, movimiento_estado: 'CERRADO', diferencias: 2, correcciones_pendientes: 0 },
    { clues: 'QTSSA000004', unidad: 'C.S. Delta', municipio: 'QUERETARO', estado: 'VALIDADO', validado_por: 'muni', validado_en: '2026-10-02T10:00:00Z', paloteo_dosis: 80, movimiento_lotes: 2, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0 }
  ];
  // Jurisdicción: además de Querétaro ve otro municipio y los dos hospitales (que ella valida).
  if (window.__FAKE_ROL__ === 'JURISDICCIONAL') {
    const otra = (id, clues, nombre, municipio) => ({ id, clues, nombre, municipio, activo: true });
    tables.biovac_unidades.push(otra('un-e', 'QTSSA000009', 'C.S. Ex', 'CORREGIDORA'), otra('un-h1', 'QTSSA002901', 'NHGQ', 'NHG'), otra('un-h2', 'QTSSA001740', 'HENM', 'HENM'));
    seg.push({ clues: 'QTSSA000009', unidad: 'C.S. Ex', municipio: 'CORREGIDORA', estado: 'VALIDADO', paloteo_dosis: 5, movimiento_lotes: 1, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0 },
      { clues: 'QTSSA002901', unidad: 'NHGQ', municipio: 'NHG', estado: 'ENVIADO', enviado_por: 'Sofía', enviado_en: '2026-10-01T10:00:00Z', paloteo_dosis: 50, movimiento_lotes: 3, movimiento_estado: 'CERRADO', diferencias: 0, correcciones_pendientes: 0 },
      { clues: 'QTSSA001740', unidad: 'HENM', municipio: 'HENM', estado: 'BORRADOR', paloteo_dosis: 0, movimiento_lotes: 0, movimiento_estado: null, diferencias: 0, correcciones_pendientes: 0 });
  }
  seg.forEach((f, i) => tables.sis06p_capturas.push({ id: 'cap-' + i, clues: f.clues, municipio: 'QUERETARO', mes, anio, estado: f.estado, valores: {} }));

  const sinEnvio = [];
  const rpc = {
    sis06p_resumen_seguimiento: () => seg.map((f) => ({ ...f })),
    sis06p_sin_envio_lista: () => sinEnvio.map((m) => ({ ...m, vigente: true })),
    sis06p_marcar_sin_envio: (a) => { sinEnvio.push({ clues: a.p_clues, municipio: 'QUERETARO', motivo: a.p_motivo, usuario: 'muni' }); return null; },
    sis06p_quitar_sin_envio: (a) => { const i = sinEnvio.findIndex((m) => m.clues === a.p_clues); if (i >= 0) sinEnvio.splice(i, 1); return null; },
    sis06p_ventana_envio: () => [{ dentro_prellenado: true, dentro_envio: true, inicio_prellenado: '2026-09-23', inicio_envio: '2026-09-30', fin_envio: '2026-10-07' }],
    sis06p_comparativo: (a) => [
      { municipio: 'QUERETARO', clues: 'QTSSA000001', unidad: 'C.S. Alfa', etiqueta: 'SRP', paloteo: 10, aplicado: 10, coincide: true },
      { municipio: 'QUERETARO', clues: 'QTSSA000003', unidad: 'C.S. Gamma', etiqueta: 'HEXAVALENTE', paloteo: 30, aplicado: 25, coincide: false },
      { municipio: 'QUERETARO', clues: 'QTSSA000003', unidad: 'C.S. Gamma', etiqueta: 'TD', paloteo: 5, aplicado: 9, coincide: false }
    ].filter((f) => !a.p_clues || f.clues === a.p_clues).filter((f) => f.clues !== 'QTSSA000003' || seg.find((x) => x.clues === f.clues).estado !== 'VALIDADO'),
    sis06p_recibido_vs_requisicion: () => [{ coincide: true }, { coincide: false }],
    sis06p_marcar_validado: (a) => {
      const cap = tables.sis06p_capturas.find((c) => c.id === a.p_captura_id);
      if (cap) { cap.estado = 'VALIDADO'; const f = seg.find((x) => x.clues === cap.clues); if (f) { f.estado = 'VALIDADO'; f.validado_por = 'muni'; f.validado_en = new Date().toISOString(); } }
      return null;
    }
  };
  window.__FAKE = { tables, seg, validarTodas() { seg.forEach((f) => { f.estado = 'VALIDADO'; f.diferencias = 0; }); } };

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
      insert() { return api; }, update() { return api; }, upsert() { return api; }, delete() { return api; },
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
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'm@test.mx' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: constructor,
        rpc: (nombre, args) => new Promise((r) => setTimeout(r, 0)).then(() => ({ data: rpc[nombre] ? rpc[nombre](args || {}) : [], error: null })),
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel() {}
      };
    }
  };
})();
