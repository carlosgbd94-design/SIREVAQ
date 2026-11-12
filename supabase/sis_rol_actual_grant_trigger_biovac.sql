-- ===========================================================================
-- Arreglo: "permission denied for function _sis_rol_actual" al agregar/editar un renglón en BIOVAC.
-- biovac_trg_20_autocalc (trigger, SECURITY INVOKER) llama a _sis_rol_actual() desde la guardia
-- sin_desechadas_directas_arf_canje, pero a esa función se le había revocado EXECUTE a authenticated.
-- _sis_rol_actual() es SECURITY DEFINER y solo devuelve el rol del propio usuario (auth.uid()),
-- así que concederle EXECUTE no expone nada. Idempotente.
-- ===========================================================================
grant execute on function public._sis_rol_actual() to authenticated;
