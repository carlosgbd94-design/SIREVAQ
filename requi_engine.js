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

  return { saldoDisponible, validarReparto, compararLote, distanciaEdicion };
});
