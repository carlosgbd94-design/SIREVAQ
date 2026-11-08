-- 2026-11-08: índices sin uso (0 usos en 7 meses; idx_biovac_catalogo_bloque se conserva porque cubre una FK) y helpers internos
-- que solo llaman funciones SECURITY DEFINER dejan de ser invocables por /rest/v1/rpc.
drop index if exists public.idx_np_usuario_status;
drop index if exists public.idx_notificaciones_target_municipio;
drop index if exists public.idx_pinol_municipio_estatus;
drop index if exists public.idx_pinol_rutas_fecha;
-- NO se tocan _sis_rol_actual ni _sis06p_unidad_omitida: las llaman funciones INVOKER.
revoke execute on function public._biovac_autoriza_movimiento(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._biovac_es_mes_de_prueba(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public._sis_municipio_listo(integer, integer, text) from public, anon, authenticated;
revoke execute on function public._sis06p_dosis_del_mes(text, integer, integer) from public, anon, authenticated;
