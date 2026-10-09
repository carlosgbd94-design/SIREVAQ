-- ===========================================================================
-- SINBA-SIS · dos candados distintos, sin callejón sin salida para la unidad
--
--   * ENVIAR (sis06p_enviar_para_validacion) = candado del SINBA-SIS completo.
--     Es el ÚNICO que maneja la unidad: cierra el Movimiento y bloquea el paloteo
--     en una sola transacción.
--   * CERRAR MES (biovac_cerrar_mes) = candado del Movimiento. Solo lo manejan
--     los roles revisores (municipal / jurisdicción / admin), que además pueden
--     reabrirlo con "Corregir movimiento".
--
-- Problema: la unidad también veía "Cerrar mes" (con el texto "puedes
-- reabrirlo"), pero biovac_abrir_correccion solo admite revisores. Una unidad
-- que lo pulsaba se quedaba con el Movimiento cerrado y sin forma de corregir
-- una diferencia con el paloteo. Ahora el servidor lo impide: la unidad solo
-- cierra el Movimiento DENTRO de su envío.
-- Idempotente (marca 'cierre_por_envio' en el cuerpo).
-- ===========================================================================

do $do$
declare v_def text; v_new text;
begin
  -- 1) biovac_cerrar_mes: la unidad no cierra por separado
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_cerrar_mes' limit 1;
  if v_def is null then raise exception 'No existe biovac_cerrar_mes'; end if;
  if v_def not like '%cierre_por_envio%' then
    v_new := replace(v_def,
      E'  perform _biovac_autoriza_movimiento(p_movimiento_id, false);\n',
      E'  perform _biovac_autoriza_movimiento(p_movimiento_id, false);\n' ||
      E'  -- candado propio de los revisores: la unidad cierra el Movimiento solo al ENVIAR el SINBA-SIS\n' ||
      E'  if _sis_rol_actual() = ''UNIDAD'' and coalesce(current_setting(''sis06p.cierre_por_envio'', true), ''off'') <> ''on'' then\n' ||
      E'    raise exception ''La unidad no cierra el mes por separado: al enviar el SINBA-SIS el Movimiento de Biológico se cierra solo.'';\n' ||
      E'  end if;\n');
    if v_new = v_def then raise exception 'No se pudo parchear biovac_cerrar_mes'; end if;
    execute v_new;
  end if;

  -- 2) el envío marca que ese cierre es legítimo
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'sis06p_enviar_para_validacion' limit 1;
  if v_def is null then raise exception 'No existe sis06p_enviar_para_validacion'; end if;
  if v_def not like '%cierre_por_envio%' then
    v_new := replace(v_def,
      E'    perform biovac_cerrar_mes(v_mov_id, p_usuario);\n',
      E'    perform set_config(''sis06p.cierre_por_envio'', ''on'', true);\n' ||
      E'    perform biovac_cerrar_mes(v_mov_id, p_usuario);\n' ||
      E'    perform set_config(''sis06p.cierre_por_envio'', ''off'', true);\n');
    if v_new = v_def then raise exception 'No se pudo parchear sis06p_enviar_para_validacion'; end if;
    execute v_new;
  end if;
end
$do$;
