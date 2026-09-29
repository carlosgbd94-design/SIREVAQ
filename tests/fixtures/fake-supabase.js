// Cliente Supabase simulado en memoria para probar requisiciones.html sin red
// ni sesión real. Emula lo justo de supabase-js (from/select/insert/upsert/
// update/delete + filtros) y los triggers de validación de Postgres
// (supabase/requi_engine.sql), ya con la corrección de
// requi_trigger_upsert_no_cuenta_doble.sql (no cuenta dos veces al mismo destino).
(function () {
  let n = 0;
  const uid = () => 'id-' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
  const clon = (o) => JSON.parse(JSON.stringify(o));

  const bio = (id, codigo, nombre, presentacion, orden) => ({ id, clave_articulo: 'CLAVE-' + codigo, codigo_articulo: codigo, nombre, presentacion, forma: 'x', orden, activo: true });
  const unidad = (id, nombre, municipio) => ({ id, clues: 'C' + id, nombre, municipio, activo: true });

  const db = window.__FAKE_DB__ = {
    perfiles: [{ id: 'u1', usuario: 'tester', rol: window.__FAKE_ROL__ || 'ADMIN', municipio_asignado: null, municipios_allowed: null }],
    requi_catalogo_biologicos: [
      bio('bio-srp', '3820', 'VACUNA TRIPLE VIRAL 1DS (SRP)', 'UNIDOSIS', 1),
      bio('bio-hexa', '6135', 'VACUNA HEXAVALENTE', 'UNIDOSIS', 2),
      bio('bio-td', '3810', 'VACUNA TD', 'MULTIDOSIS', 3)
    ],
    requi_unidades: [
      unidad('un-c1', 'C.S. Uno', 'CORREGIDORA'), unidad('un-c2', 'C.S. Dos', 'CORREGIDORA'), unidad('un-c3', 'C.S. Tres', 'CORREGIDORA'),
      unidad('un-q1', 'C.S. Cuatro', 'QUERETARO'), unidad('un-q2', 'C.S. Cinco', 'QUERETARO')
    ],
    requi_firmas: [],
    requi_requisiciones: [{ id: 'req-prev', anio: 2000, mes: 1, estado: 'CERRADA', fue_corregido: false, creado_por: 'x', fecha_envio: null }],
    requi_items_jurisdiccion: [],
    requi_lotes: [],
    requi_distribucion_municipio: [],
    requi_distribucion_unidad: [],
    requi_pdf_generados: [],
    lotes: []
  };
  if (window.__FAKE_CON_REQ__) {
    const hoy = new Date();
    db.requi_requisiciones.push({ id: 'req-hoy', anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, estado: 'BORRADOR', fue_corregido: false, creado_por: 'x', fecha_envio: null });
  }
  // Mes anterior (base de "Sugerir"): SRP 60/20/10/30 y HEXA 50/50 entre municipios;
  // en Corregidora, SRP y HEXA se repartían 30/30/0 entre sus unidades.
  const dmPrev = (municipio, b, cantidad) => db.requi_distribucion_municipio.push({ id: uid(), requisicion_id: 'req-prev', municipio, requi_biologico_id: b, lote_id: 'lote-prev', cantidad });
  dmPrev('CORREGIDORA', 'bio-srp', 60); dmPrev('HUIMILPAN', 'bio-srp', 20); dmPrev('MARQUES', 'bio-srp', 10); dmPrev('QUERETARO', 'bio-srp', 30);
  dmPrev('CORREGIDORA', 'bio-hexa', 50); dmPrev('QUERETARO', 'bio-hexa', 50);
  const duPrev = (unidad_id, b, cantidad) => db.requi_distribucion_unidad.push({ id: uid(), requisicion_id: 'req-prev', unidad_id, requi_biologico_id: b, lote_id: 'lote-prev', cantidad });
  duPrev('un-c1', 'bio-srp', 30); duPrev('un-c2', 'bio-srp', 30);
  duPrev('un-c1', 'bio-hexa', 30); duPrev('un-c2', 'bio-hexa', 10);

  const CLAVE_NAT = {
    requi_requisiciones: ['anio', 'mes'],
    requi_items_jurisdiccion: ['requisicion_id', 'requi_biologico_id', 'lote_id'],
    requi_distribucion_municipio: ['requisicion_id', 'municipio', 'requi_biologico_id', 'lote_id'],
    requi_distribucion_unidad: ['requisicion_id', 'unidad_id', 'requi_biologico_id', 'lote_id'],
    requi_lotes: ['requi_biologico_id', 'numero_lote'],
    requi_firmas: ['nivel', 'destino']
  };
  const mismoLote = (a, b) => a.requisicion_id === b.requisicion_id && a.requi_biologico_id === b.requi_biologico_id && a.lote_id === b.lote_id;
  const suma = (arr) => arr.reduce((acc, r) => acc + Number(r.cantidad || 0), 0);

  // Triggers BEFORE INSERT/UPDATE (copia fiel de requi_engine.sql)
  function trigger(tabla, nueva, trabajo, anterior) {
    if (tabla === 'requi_distribucion_municipio') {
      const item = trabajo.requi_items_jurisdiccion.find((i) => mismoLote(i, nueva));
      if (!item) throw new Error('ERROR: Este lote no está registrado como surtido en la requisición jurisdiccional.');
      const otros = suma(trabajo.requi_distribucion_municipio.filter((d) => mismoLote(d, nueva) && d.id !== nueva.id && d.municipio !== nueva.municipio));
      if (otros + Number(nueva.cantidad) > Number(item.cantidad_surtida)) throw new Error(`ERROR: Excede lo surtido para este lote: disponible ${item.cantidad_surtida}, ya repartido ${otros}`);
    }
    if (tabla === 'requi_distribucion_unidad') {
      const muni = (db.requi_unidades.find((u) => u.id === nueva.unidad_id) || {}).municipio;
      const asig = trabajo.requi_distribucion_municipio.find((d) => d.municipio === muni && mismoLote(d, nueva));
      if (!asig) throw new Error(`ERROR: El municipio "${muni}" no tiene asignado este lote`);
      const otras = suma(trabajo.requi_distribucion_unidad.filter((d) => mismoLote(d, nueva) && d.id !== nueva.id && d.unidad_id !== nueva.unidad_id
        && (db.requi_unidades.find((u) => u.id === d.unidad_id) || {}).municipio === muni));
      if (otras + Number(nueva.cantidad) > Number(asig.cantidad)) throw new Error(`ERROR: Excede lo asignado a ${muni}`);
    }
    if (tabla === 'requi_items_jurisdiccion' && anterior && Number(nueva.cantidad_surtida) < Number(anterior.cantidad_surtida)) {
      const rep = suma(trabajo.requi_distribucion_municipio.filter((d) => mismoLote(d, nueva)));
      if (Number(nueva.cantidad_surtida) < rep) throw new Error(`ERROR: No puedes bajar lo surtido a ${nueva.cantidad_surtida}`);
    }
  }

  function ejecutar(q) {
    const trabajo = {};
    Object.keys(db).forEach((t) => { trabajo[t] = db[t].map((r) => ({ ...r })); });
    let filas = trabajo[q.tabla];
    let salida = [];
    const cumple = (r) => q.filtros.every((f) => f(r));

    if (q.op === 'insert' || q.op === 'upsert') {
      const nat = CLAVE_NAT[q.tabla] || [];
      const porId = q.op === 'upsert' && q.opts && q.opts.onConflict === 'id';
      for (const original of q.payload) {
        const nueva = { ...original };
        if (!nueva.id) nueva.id = uid();          // el default se aplica antes del trigger
        if (q.tabla === 'requi_requisiciones') { nueva.estado = nueva.estado || 'BORRADOR'; nueva.fue_corregido = nueva.fue_corregido || false; }
        trigger(q.tabla, nueva, trabajo);
        const previo = porId ? filas.find((r) => r.id === nueva.id) : filas.find((r) => nat.length && nat.every((c) => r[c] === nueva[c]));
        if (previo) {
          if (q.op === 'insert') throw new Error('duplicate key value violates unique constraint');
          const aplicada = { ...previo, ...nueva, id: previo.id };
          trigger(q.tabla, aplicada, trabajo, previo);
          Object.assign(previo, aplicada);
          salida.push(previo);
        } else {
          if (nat.length && filas.find((r) => nat.every((c) => r[c] === nueva[c]))) throw new Error('duplicate key value violates unique constraint');
          filas.push(nueva);
          salida.push(nueva);
        }
      }
    } else if (q.op === 'update') {
      filas.filter(cumple).forEach((r) => {
        const aplicada = { ...r, ...q.payload };
        trigger(q.tabla, aplicada, trabajo, r);
        Object.assign(r, aplicada);
        salida.push(r);
      });
    } else if (q.op === 'delete') {
      const quedan = filas.filter((r) => !cumple(r));
      salida = filas.filter(cumple);
      trabajo[q.tabla] = quedan;
    } else {
      salida = filas.filter(cumple);
    }

    // Confirmar la "transacción"
    Object.keys(trabajo).forEach((t) => { db[t] = trabajo[t]; });

    if (q.op === 'select' || q.devuelve) {
      salida = salida.map((r) => {
        const o = { ...r };
        if (q.cols && q.cols.includes('requi_lotes(')) o.requi_lotes = clon(db.requi_lotes.find((l) => l.id === r.lote_id) || { numero_lote: '?', caducidad: null });
        return o;
      });
    }
    q.orden.forEach(([c, asc]) => salida.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)));
    if (q.rango) salida = salida.slice(q.rango[0], q.rango[1] + 1);
    if (q.limite != null) salida = salida.slice(0, q.limite);
    salida = clon(salida);
    if (q.modo === 'single') return salida.length === 1 ? { data: salida[0], error: null } : { data: null, error: { message: 'No single row' } };
    if (q.modo === 'maybe') return { data: salida[0] || null, error: null };
    return { data: (q.op === 'select' || q.devuelve) ? salida : null, error: null };
  }

  function constructor(tabla) {
    const q = { tabla, op: 'select', cols: '*', filtros: [], orden: [], rango: null, limite: null, payload: null, opts: null, modo: 'many', devuelve: false };
    const api = {
      select(cols) { if (q.op !== 'select') q.devuelve = true; q.cols = cols || '*'; return api; },
      insert(rows) { q.op = 'insert'; q.payload = Array.isArray(rows) ? rows : [rows]; return api; },
      upsert(rows, opts) { q.op = 'upsert'; q.payload = Array.isArray(rows) ? rows : [rows]; q.opts = opts || {}; return api; },
      update(obj) { q.op = 'update'; q.payload = obj; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(c, v) { q.filtros.push((r) => r[c] === v); return api; },
      gt(c, v) { q.filtros.push((r) => r[c] > v); return api; },
      or(expr) {
        const m = expr.match(/^anio\.lt\.(\d+),and\(anio\.eq\.(\d+),mes\.lt\.(\d+)\)$/);
        if (m) q.filtros.push((r) => r.anio < Number(m[1]) || (r.anio === Number(m[2]) && r.mes < Number(m[3])));
        return api;
      },
      order(c, o) { q.orden.push([c, !(o && o.ascending === false)]); return api; },
      range(a, b) { q.rango = [a, b]; return api; },
      limit(k) { q.limite = k; return api; },
      single() { q.modo = 'single'; return api; },
      maybeSingle() { q.modo = 'maybe'; return api; },
      then(ok, ko) {
        return new Promise((res) => setTimeout(res, 0)).then(() => {
          try { return ejecutar(q); } catch (e) { return { data: null, error: { message: e.message } }; }
        }).then(ok, ko);
      }
    };
    return api;
  }

  window.supabase = {
    createClient() {
      return {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 't@test.mx' } } } }) },
        from: constructor
      };
    }
  };
})();
