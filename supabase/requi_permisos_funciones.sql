-- ============================================================================
-- Requisiciones -- permisos de EXECUTE de las funciones.
--  * requi_asignar_lotes corre con los permisos de quien llama (RLS: solo ADMIN/JURISDICCIONAL),
--    pero no tiene por qué ser ejecutable sin sesión.
--  * Las funciones de trigger (SECURITY DEFINER) solo las dispara la base; quitar EXECUTE no
--    impide que los triggers se disparen y evita que se expongan como RPC.
-- ============================================================================
revoke execute on function public.requi_asignar_lotes(uuid, jsonb) from public, anon;
grant execute on function public.requi_asignar_lotes(uuid, jsonb) to authenticated;

revoke execute on function public.requi_trg_marca_corregido() from public, anon, authenticated;
revoke execute on function public.requi_trg_valida_edicion_surtido() from public, anon, authenticated;
revoke execute on function public.requi_trg_valida_municipio() from public, anon, authenticated;
revoke execute on function public.requi_trg_valida_unidad() from public, anon, authenticated;
