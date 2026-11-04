-- 2026-11-04 (aplicado en prod): la función interna _biovac_sincronizar_municipio no debe poder llamarse directo por la API.
-- Solo la usan biovac_armar_movimiento_municipio y biovac_trg_sync_municipio, ambas SECURITY DEFINER (corren como dueño),
-- así que el flujo del cliente sigue igual. Verificado armando el Movimiento municipal de Querétaro como usuario MUNICIPAL.
revoke execute on function public._biovac_sincronizar_municipio(text, integer, integer) from public, anon, authenticated;
