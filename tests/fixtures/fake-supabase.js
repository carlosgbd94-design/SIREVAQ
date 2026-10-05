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
      unidad('un-q1', 'C.S. Cuatro', 'QUERETARO'), unidad('un-q2', 'C.S. Cinco', 'QUERETARO'),
      unidad('un-nhg', 'NHGQ', 'NHG'), unidad('un-henm', 'HENM', 'HENM')
    ],
    requi_firmas: [],
    requi_requisiciones: [{ id: 'req-prev', anio: 2000, mes: 1, entrega: 1, etiqueta: null, estado: 'CERRADA', fue_corregido: false, creado_por: 'x', fecha_envio: null }],
    requi_items_jurisdiccion: [],
    requi_lotes: [],
    requi_distribucion_municipio: [],
    requi_distribucion_unidad: [],
    requi_pdf_generados: [],
    influenza_remesas: [],
    lotes: []
  };
  // Influenza (opcional): vacuna 6317 en el catálogo y una entrega repartida de 100 frascos
  // (Querétaro 60, ya repartido entre dos unidades; Corregidora 40, aún sin reparto interno).
  if (window.__FAKE_INFLUENZA__) {
    db.requi_catalogo_biologicos.push(bio('bio-flu', '6317', 'VACUNA ANTIINFLUENZA 10/D', 'MULTIDOSIS', 4));
    db.influenza_remesas.push({ anio_campana: 'Campaña Influenza 2026-2027', numero_entrega: 1, fecha: '2026-10-05', total_frascos: 100, asignacion: { QUERETARO: 60, CORREGIDORA: 40 } });
  }
  if (window.__FAKE_CON_REQ__) {
    const hoy = new Date();
    db.requi_requisiciones.push({ id: 'req-hoy', anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, entrega: 1, etiqueta: null, estado: 'BORRADOR', fue_corregido: false, creado_por: 'x', fecha_envio: null });
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
    requi_requisiciones: ['anio', 'mes', 'entrega'],
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
    // Prueba de fallos de red: window.__FAKE_FALLAR__ = ['tabla', ...] hace fallar las LECTURAS de esas tablas.
    if (q.op === 'select' && (window.__FAKE_FALLAR__ || []).includes(q.tabla)) return { data: null, error: { message: 'Failed to fetch' } };
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
        if (q.tabla === 'requi_requisiciones') { nueva.entrega = nueva.entrega || 1; nueva.etiqueta = nueva.etiqueta || null; nueva.estado = nueva.estado || 'BORRADOR'; nueva.fue_corregido = nueva.fue_corregido || false; }
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
      not(c, op, v) { if (op === 'is') q.filtros.push((r) => (v === null ? r[c] != null : r[c] !== v)); return api; },
      gt(c, v) { q.filtros.push((r) => r[c] > v); return api; },
      or(expr) {
        const m = expr.match(/^anio\.lt\.(\d+),and\(anio\.eq\.(\d+),mes\.lt\.(\d+)\),and\(anio\.eq\.(\d+),mes\.eq\.(\d+),entrega\.lt\.(\d+)\)$/);
        if (m) q.filtros.push((r) => r.anio < Number(m[1]) || (r.anio === Number(m[2]) && r.mes < Number(m[3]))
          || (r.anio === Number(m[4]) && r.mes === Number(m[5]) && (r.entrega || 1) < Number(m[6])));
        return api;
      },
      in(c, valores) { q.filtros.push((r) => valores.includes(r[c])); return api; },
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

  // Versión simplificada de requi_asignar_lotes (supabase/requi_covid_lotes_pendientes_transferencias.sql):
  // reemplaza un renglón por 1 o más lotes y pasa el reparto llenando en orden (municipios en el orden
  // de la app y unidades por id); lo que no se reasigna se queda en el lote actual.
  function rpcAsignarLotes({ p_item_id, p_lotes }) {
    const item = db.requi_items_jurisdiccion.find((i) => i.id === p_item_id);
    if (!item) return { data: null, error: { message: 'ERROR: No existe ese renglón de lo surtido.' } };
    const nuevos = [];
    for (const f of p_lotes) {
      const numero = String(f.numero_lote || '').trim();
      let lote = db.requi_lotes.find((l) => l.requi_biologico_id === item.requi_biologico_id && l.numero_lote.toUpperCase() === numero.toUpperCase());
      if (lote && db.requi_items_jurisdiccion.some((i) => i.requisicion_id === item.requisicion_id && i.lote_id === lote.id)) {
        return { data: null, error: { message: `ERROR: El lote ${numero} ya está capturado en esta requisición` } };
      }
      if (!lote) { lote = { id: uid(), requi_biologico_id: item.requi_biologico_id, numero_lote: numero, caducidad: f.caducidad || null }; db.requi_lotes.push(lote); }
      else if (f.caducidad && !lote.caducidad) lote.caducidad = f.caducidad;
      nuevos.push({ lote_id: lote.id, resto: Number(f.cantidad) });
      db.requi_items_jurisdiccion.push({ id: uid(), requisicion_id: item.requisicion_id, requi_biologico_id: item.requi_biologico_id, lote_id: lote.id, cantidad_surtida: Number(f.cantidad) });
    }
    const total = nuevos.reduce((a, x) => a + x.resto, 0);
    const mismo = (d) => d.requisicion_id === item.requisicion_id && d.requi_biologico_id === item.requi_biologico_id && d.lote_id === item.lote_id;
    const orden = ['CORREGIDORA', 'HUIMILPAN', 'MARQUES', 'QUERETARO', 'NHG', 'HENM'];
    db.requi_distribucion_municipio.filter(mismo).sort((a, b) => orden.indexOf(a.municipio) - orden.indexOf(b.municipio)).forEach((dm) => {
      let need = Number(dm.cantidad);
      const tomado = nuevos.map(() => 0);
      nuevos.forEach((c, i) => {
        const t = Math.min(need, c.resto);
        if (t > 0) {
          db.requi_distribucion_municipio.push({ id: uid(), requisicion_id: dm.requisicion_id, municipio: dm.municipio, requi_biologico_id: dm.requi_biologico_id, lote_id: c.lote_id, cantidad: t });
          c.resto -= t; tomado[i] = t; need -= t;
        }
      });
      db.requi_distribucion_unidad.filter((d) => mismo(d) && (db.requi_unidades.find((u) => u.id === d.unidad_id) || {}).municipio === dm.municipio).forEach((du) => {
        let n2 = Number(du.cantidad);
        tomado.forEach((cap, i) => {
          const t = Math.min(n2, cap);
          if (t > 0) {
            db.requi_distribucion_unidad.push({ id: uid(), requisicion_id: du.requisicion_id, unidad_id: du.unidad_id, requi_biologico_id: du.requi_biologico_id, lote_id: nuevos[i].lote_id, cantidad: t });
            tomado[i] -= t; n2 -= t;
          }
        });
        if (n2 > 0) du.cantidad = n2; else db.requi_distribucion_unidad.splice(db.requi_distribucion_unidad.indexOf(du), 1);
      });
      if (need > 0) dm.cantidad = need; else db.requi_distribucion_municipio.splice(db.requi_distribucion_municipio.indexOf(dm), 1);
    });
    const quedan = Number(item.cantidad_surtida) - total;
    if (quedan > 0) item.cantidad_surtida = quedan; else db.requi_items_jurisdiccion.splice(db.requi_items_jurisdiccion.indexOf(item), 1);
    return { data: { quedan_pendientes: Math.max(quedan, 0) }, error: null };
  }

  // Versión simplificada de requi_traer_reparto_influenza (supabase/influenza_requisiciones_vinculo.sql).
  function rpcTraerInfluenza({ p_requisicion, p_campana, p_numero }) {
    const req = db.requi_requisiciones.find((r) => r.id === p_requisicion);
    if (!req || req.estado !== 'BORRADOR') return { data: null, error: { message: 'ERROR: La requisición está cerrada; no se puede traer el reparto' } };
    const rem = db.influenza_remesas.find((r) => r.anio_campana === p_campana && r.numero_entrega === p_numero);
    if (!rem) return { data: null, error: { message: 'ERROR: La Jurisdicción todavía no registra la entrega' } };
    const bio = db.requi_catalogo_biologicos.find((b) => b.codigo_articulo === '6317');
    if (db.requi_requisiciones.some((r) => r.id !== p_requisicion && r.influenza_campana === p_campana && r.influenza_entrega === p_numero)) {
      return { data: null, error: { message: 'ERROR: La entrega ya está vinculada a otra requisición' } };
    }
    const conLoteReal = db.requi_items_jurisdiccion.some((i) => i.requisicion_id === p_requisicion && i.requi_biologico_id === bio.id
      && (db.requi_lotes.find((l) => l.id === i.lote_id) || {}).numero_lote !== 'POR DEFINIR');
    if (conLoteReal) return { data: null, error: { message: 'ERROR: La influenza de esta requisición ya tiene lotes asignados' } };
    let lote = db.requi_lotes.find((l) => l.requi_biologico_id === bio.id && l.numero_lote === 'POR DEFINIR');
    if (!lote) { lote = { id: uid(), requi_biologico_id: bio.id, numero_lote: 'POR DEFINIR', caducidad: null }; db.requi_lotes.push(lote); }
    const propio = (d) => d.requisicion_id === p_requisicion && d.requi_biologico_id === bio.id;
    db.requi_distribucion_unidad = db.requi_distribucion_unidad.filter((d) => !propio(d));
    db.requi_distribucion_municipio = db.requi_distribucion_municipio.filter((d) => !propio(d));
    db.requi_items_jurisdiccion = db.requi_items_jurisdiccion.filter((d) => !propio(d));
    const destinos = Object.entries(rem.asignacion).filter(([, v]) => Number(v) > 0);
    const total = destinos.reduce((a, [, v]) => a + Number(v), 0);
    db.requi_items_jurisdiccion.push({ id: uid(), requisicion_id: p_requisicion, requi_biologico_id: bio.id, lote_id: lote.id, cantidad_surtida: total });
    destinos.forEach(([municipio, v]) => db.requi_distribucion_municipio.push({ id: uid(), requisicion_id: p_requisicion, municipio, requi_biologico_id: bio.id, lote_id: lote.id, cantidad: Number(v) }));
    const unidades = window.__FAKE_INFLUENZA_UNI__ || [];
    unidades.forEach((u) => db.requi_distribucion_unidad.push({ id: uid(), requisicion_id: p_requisicion, unidad_id: u.unidad_id, requi_biologico_id: bio.id, lote_id: lote.id, cantidad: u.cantidad }));
    req.influenza_campana = p_campana; req.influenza_entrega = p_numero;
    const conUnidades = new Set(unidades.map((u) => (db.requi_unidades.find((x) => x.id === u.unidad_id) || {}).municipio));
    return { data: { frascos: total, destinos: destinos.length, unidades: unidades.length, clues_sin_unidad: [],
      destinos_sin_reparto_a_unidades: destinos.map(([m]) => m).filter((m) => !conUnidades.has(m)) }, error: null };
  }

  // Pedido de biológico (opcional): window.__FAKE_PEDIDOS__ = [{ fecha, tipo, unidades, frascos, motivo }].
  // bio_pedidos_clasificados devuelve los del mes pedido; requi_traer_pedido_biologico es una versión
  // simplificada de supabase/pedidos_extraordinarios_y_traer_pedido.sql (SRP por unidad, un pedido por requisición).
  function rpcPedidosClasificados({ p_anio, p_mes }) {
    const pref = p_anio + '-' + String(p_mes).padStart(2, '0');
    return { data: (window.__FAKE_PEDIDOS__ || []).filter((p) => p.fecha.startsWith(pref)).map((p) => ({ extra_abierto: false, ultima_captura: null, motivo: null, ...p })), error: null };
  }
  function rpcTraerPedido({ p_requisicion, p_fecha }) {
    const req = db.requi_requisiciones.find((r) => r.id === p_requisicion);
    if (!req || req.estado !== 'BORRADOR') return { data: null, error: { message: 'ERROR: La requisición está cerrada; no se puede traer el pedido' } };
    const ped = (window.__FAKE_PEDIDOS__ || []).find((p) => p.fecha === p_fecha);
    if (!ped) return { data: null, error: { message: 'ERROR: No hay capturas del pedido' } };
    if (db.requi_requisiciones.some((r) => r.id !== p_requisicion && r.pedido_fecha === p_fecha)) return { data: null, error: { message: 'ERROR: El pedido ya está vinculado a otra requisición' } };
    const bio = db.requi_catalogo_biologicos.find((b) => b.codigo_articulo === '3820');
    let lote = db.requi_lotes.find((l) => l.requi_biologico_id === bio.id && l.numero_lote === 'POR DEFINIR');
    if (!lote) { lote = { id: uid(), requi_biologico_id: bio.id, numero_lote: 'POR DEFINIR', caducidad: null }; db.requi_lotes.push(lote); }
    const propio = (d) => d.requisicion_id === p_requisicion && d.requi_biologico_id === bio.id;
    db.requi_distribucion_unidad = db.requi_distribucion_unidad.filter((d) => !propio(d));
    db.requi_distribucion_municipio = db.requi_distribucion_municipio.filter((d) => !propio(d));
    db.requi_items_jurisdiccion = db.requi_items_jurisdiccion.filter((d) => !propio(d));
    db.requi_items_jurisdiccion.push({ id: uid(), requisicion_id: p_requisicion, requi_biologico_id: bio.id, lote_id: lote.id, cantidad_surtida: ped.frascos });
    db.requi_distribucion_municipio.push({ id: uid(), requisicion_id: p_requisicion, municipio: 'QUERETARO', requi_biologico_id: bio.id, lote_id: lote.id, cantidad: ped.frascos });
    db.requi_distribucion_unidad.push({ id: uid(), requisicion_id: p_requisicion, unidad_id: 'un-q1', requi_biologico_id: bio.id, lote_id: lote.id, cantidad: ped.frascos });
    req.pedido_fecha = p_fecha;
    return { data: { fecha: p_fecha, frascos: ped.frascos, unidades: 1, biologicos: [{ codigo: '3820', nombre: bio.nombre, frascos: ped.frascos, unidades: 1 }],
      omitidos_con_lotes: [], clues_sin_unidad: [], sin_equivalencia: [], influenza_pedida: 0 }, error: null };
  }

  window.supabase = {
    createClient() {
      return {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 't@test.mx' } } } }) },
        from: constructor,
        rpc: async (nombre, args) => (nombre === 'requi_asignar_lotes' ? rpcAsignarLotes(args) : nombre === 'requi_traer_reparto_influenza' ? rpcTraerInfluenza(args) : nombre === 'bio_pedidos_clasificados' ? rpcPedidosClasificados(args) : nombre === 'requi_traer_pedido_biologico' ? rpcTraerPedido(args) : { data: null, error: { message: 'rpc no simulada: ' + nombre } })
      };
    }
  };
})();
