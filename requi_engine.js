// ============================================================================
// Requisiciones — Motor cliente (espejo de requi_trg_valida_municipio/unidad
// en supabase/requi_engine.sql). Solo da feedback instantáneo en UI; la
// autoridad real es siempre el trigger de Postgres, igual filosofía que
// biovac_engine.js.
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RequiEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Saldo restante = disponible - ya repartido a otros destinos (excluyendo,
  // si se edita una fila existente, la propia fila vía excluirId).
  function saldoDisponible(disponible, filas, excluirId) {
    const yaRepartido = (filas || [])
      .filter((f) => f.id !== excluirId)
      .reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0);
    return Math.max(0, Number(disponible || 0) - yaRepartido);
  }

  // Valida si `cantidad` cabe en el saldo disponible. Devuelve {ok, mensaje}.
  function validarReparto(disponible, filas, excluirId, cantidad, etiquetaDestino) {
    const cant = Number(cantidad) || 0;
    if (cant < 0) return { ok: false, mensaje: 'La cantidad no puede ser negativa.' };
    const saldo = saldoDisponible(disponible, filas, excluirId);
    if (cant > saldo) {
      return {
        ok: false,
        mensaje: `Excede lo disponible${etiquetaDestino ? ' para ' + etiquetaDestino : ''}: `
          + `disponible ${disponible}, ya repartido ${Number(disponible) - saldo}, intentas asignar ${cant}.`
      };
    }
    return { ok: true, mensaje: '' };
  }

  // Comparador de lotes: exacto / similar (typo probable) / nuevo.
  // `existentes` = [{ id, numero_lote, caducidad }] del mismo biológico.
  function distanciaEdicion(a, b) {
    a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function compararLote(numeroLote, existentes) {
    const texto = String(numeroLote || '').trim();
    if (!texto) return { estado: 'VACIO' };

    const exacto = (existentes || []).find(
      (l) => String(l.numero_lote || '').trim().toUpperCase() === texto.toUpperCase()
    );
    if (exacto) return { estado: 'EXISTE', lote: exacto };

    const similares = (existentes || [])
      .map((l) => ({ lote: l, distancia: distanciaEdicion(texto, l.numero_lote) }))
      .filter((x) => x.distancia > 0 && x.distancia <= 2 && texto.length > 3)
      .sort((a, b) => a.distancia - b.distancia);

    if (similares.length) return { estado: 'SIMILAR', sugerencias: similares.map((s) => s.lote) };
    return { estado: 'NUEVO' };
  }

  // -------------------------------------------------------------------------
  // Captura rápida: pegado desde Excel, reconocimiento de biológicos y
  // reparto proporcional. Todo puro (sin DOM ni red) para poder probarlo.
  // -------------------------------------------------------------------------

  function normalizar(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // "VACUNA TRIPLE VIRAL 1DS (SRP)" -> "SRP"; "VACUNA HEXAVALENTE" -> "HEXAVALENTE".
  function nombreCortoBio(bio) {
    const nombre = String((bio && bio.nombre) || '').replace(/\s+/g, ' ').trim();
    const paren = nombre.match(/\(([^)]{1,6})\)/);
    if (paren) return paren[1].trim();
    return nombre.replace(/^(VACUNA\s+)+/i, '').trim() || nombre;
  }

  // Texto libre (nombre, nombre corto, clave o código de artículo) -> biológico
  // del catálogo, o null si no hay uno solo que coincida sin ambigüedad.
  function resolverBiologico(texto, catalogo) {
    const t = normalizar(texto);
    if (!t) return null;
    const cat = catalogo || [];
    const porCodigo = cat.find((b) => normalizar(b.codigo_articulo) === t || normalizar(b.clave_articulo) === t);
    if (porCodigo) return porCodigo;
    const exacto = cat.find((b) => normalizar(b.nombre) === t || normalizar(nombreCortoBio(b)) === t);
    if (exacto) return exacto;
    if (t.length < 3) return null;
    // El nombre corto (SR, TD, BCG…) solo cuenta como palabra completa: si no,
    // un lote como "A1TD22" se confundiría con TD.
    const conEspacios = ' ' + t + ' ';
    const contiene = cat.filter((b) => normalizar(b.nombre).includes(t) || conEspacios.includes(' ' + normalizar(nombreCortoBio(b)) + ' '));
    return contiene.length === 1 ? contiene[0] : null;
  }

  // Texto pegado (Excel = tabulaciones; también acepta ; o 2+ espacios) -> matriz de celdas.
  function parsearPegado(texto) {
    const lineas = String(texto == null ? '' : texto).replace(/\r/g, '').split('\n');
    while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
    return lineas.map((linea) => {
      let celdas;
      if (linea.includes('\t')) celdas = linea.split('\t');
      else if (linea.includes(';')) celdas = linea.split(';');
      else celdas = linea.trim().split(/\s{2,}/);
      return celdas.map((c) => c.trim());
    });
  }

  // "1,250" / "1 250" / "1250" -> 1250; vacío o texto -> null.
  function parsearEntero(celda) {
    const t = String(celda == null ? '' : celda).trim().replace(/[\s,]/g, '');
    if (!/^\d+$/.test(t)) return null;
    return Number(t);
  }

  // Solo formatos con separador (FEB-27, 02/27, 28/02/2027): un número pelado
  // como 0227 es indistinguible de una cantidad, así que no se toma por fecha.
  const RE_CADUCIDAD = [
    /^[A-Za-zñÑ]{3}[-/ ]\d{2,4}$/,          // FEB-27, feb/2027
    /^\d{1,2}[-/]\d{2,4}$/,                 // 02/27
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/       // 28/02/2027
  ];
  function pareceCaducidad(celda) {
    const t = String(celda || '').trim();
    return RE_CADUCIDAD.some((re) => re.test(t));
  }

  // Cada fila pegada (una por lote) -> { bio, bioTexto, lote, caducidadTexto, cantidad, error }.
  // No depende del orden de las columnas: reconoce el biológico, la caducidad,
  // la cantidad (último número entero) y el lote (lo que sobra con algún dígito).
  // `bioPorDefecto` se usa cuando la fila no trae biológico.
  function detectarFilasSurtido(filas, catalogo, bioPorDefecto) {
    const resultado = [];
    filas.forEach((celdasOrig) => {
      const celdas = celdasOrig.filter((c) => c !== '');
      if (!celdas.some((c) => /\d/.test(c))) return; // encabezado o fila vacía
      const usadas = new Set();

      let bio = null, bioTexto = '';
      celdas.forEach((c, i) => {
        if (bio) return;
        if (/^[\d\s,]+$/.test(c)) return; // un número pelado es cantidad, no biológico
        const b = resolverBiologico(c, catalogo);
        if (b) { bio = b; bioTexto = c; usadas.add(i); }
      });

      let caducidadTexto = '';
      celdas.forEach((c, i) => {
        if (caducidadTexto || usadas.has(i)) return;
        if (pareceCaducidad(c)) { caducidadTexto = c; usadas.add(i); }
      });

      let cantidad = null, idxCant = -1;
      for (let i = celdas.length - 1; i >= 0; i--) {
        if (usadas.has(i)) continue;
        const n = parsearEntero(celdas[i]);
        if (n !== null) { cantidad = n; idxCant = i; break; }
      }
      if (idxCant >= 0) usadas.add(idxCant);

      let lote = '';
      celdas.forEach((c, i) => {
        if (lote || usadas.has(i)) return;
        if (/\d/.test(c)) { lote = c.replace(/\s+/g, ' ').toUpperCase(); usadas.add(i); }
      });

      const fila = { bio: bio || bioPorDefecto || null, bioTexto, lote, caducidadTexto, cantidad, error: '' };
      if (!fila.lote) fila.error = 'No encontré el número de lote.';
      else if (!(cantidad > 0)) fila.error = 'No encontré una cantidad mayor a 0.';
      else if (!fila.bio) fila.error = 'No reconocí el biológico.';
      resultado.push(fila);
    });
    return resultado;
  }

  // Reparte `total` (entero) en proporción a `pesos`, sin decimales y sumando
  // exactamente `total` (método del mayor residuo). null si no hay pesos > 0.
  function repartirProporcional(total, pesos) {
    const t = Math.max(0, Math.floor(Number(total) || 0));
    const p = (pesos || []).map((x) => Math.max(0, Number(x) || 0));
    const suma = p.reduce((a, b) => a + b, 0);
    if (!t || suma <= 0) return null;
    const exactos = p.map((x) => (x / suma) * t);
    const base = exactos.map(Math.floor);
    let faltan = t - base.reduce((a, b) => a + b, 0);
    exactos.map((e, i) => ({ i, r: e - Math.floor(e) }))
      .sort((a, b) => b.r - a.r || a.i - b.i)
      .slice(0, faltan)
      .forEach(({ i }) => { base[i] += 1; });
    return base;
  }

  return {
    saldoDisponible, validarReparto, compararLote, distanciaEdicion,
    normalizar, nombreCortoBio, resolverBiologico, parsearPegado, parsearEntero,
    detectarFilasSurtido, repartirProporcional
  };
});
