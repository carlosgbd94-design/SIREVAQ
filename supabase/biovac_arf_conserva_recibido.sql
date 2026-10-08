-- ===========================================================================
-- BIOVAC · Pasar a A.R.F. conserva la procedencia (existencia anterior vs recibido)
--
-- Problema: al mandar a A.R.F. un lote RECIBIDO en el mes (p. ej. falla de red
-- de frío sobre vacuna que entró en septiembre), biovac_reclasificar_normal_arf
-- le restaba el recibido al renglón Normal pero abría el renglón A.R.F. con ese
-- monto como EXISTENCIA ANTERIOR. El A.R.F. mostraba como "anterior" algo que
-- en realidad se recibió ese mes y el total recibido del mes quedaba reducido.
--
-- Ahora:
--   Normal -> A.R.F.: lo que sale de existencia anterior entra al A.R.F. como
--     anterior; lo que sale de recibido entra al A.R.F. como RECIBIDO.
--   A.R.F. -> Normal (dictamen): se regresa primero la parte recibida al
--     recibido del renglón Normal y el resto a existencia anterior.
-- Conserva el chequeo de autorización de la auditoría 2026-10.
-- Idempotente (create or replace).
-- ===========================================================================

create or replace function public.biovac_reclasificar_normal_arf(
  p_renglon_id uuid, p_monto numeric, p_usuario text, p_rol text, p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_movimiento_id uuid;
  v_lote_id uuid;
  v_categoria text;
  v_final numeric;
  v_anterior numeric;
  v_estado text;
  v_resta_anterior numeric;
  v_resta_recibido numeric;
  v_arf_id uuid;
begin
  perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false); -- auditoria-2026-10
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos, r.existencia_anterior_frascos
    into v_movimiento_id, v_lote_id, v_categoria, v_final, v_anterior
  from biovac_renglones r
  where r.id = p_renglon_id
  for update;

  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;
  if v_categoria <> 'NORMAL' then
    raise exception 'Solo se puede pasar a A.R.F. un renglón Normal (categoría actual: %)', v_categoria;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'La cantidad a pasar a A.R.F. debe ser mayor a cero';
  end if;
  if p_monto > v_final then
    raise exception 'No puedes pasar a A.R.F. más de la existencia actual (% frascos)', v_final;
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado not in ('BORRADOR','EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para reclasificar un lote (estado actual: %)', v_estado;
  end if;

  v_resta_anterior := least(p_monto, greatest(v_anterior, 0));
  v_resta_recibido := p_monto - v_resta_anterior;

  update biovac_renglones
  set existencia_anterior_frascos = existencia_anterior_frascos - v_resta_anterior,
      recibido_frascos = recibido_frascos - v_resta_recibido
  where id = p_renglon_id;

  -- la parte que venía de existencia anterior se queda como anterior; la que
  -- se RECIBIÓ en el mes entra al A.R.F. como recibido (no como anterior).
  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos, recibido_frascos)
  values (v_movimiento_id, v_lote_id, 'ARF', v_resta_anterior, v_resta_recibido)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos,
                recibido_frascos = biovac_renglones.recibido_frascos + excluded.recibido_frascos
  returning id into v_arf_id;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_movimiento_id, v_arf_id, p_usuario, p_rol, 'categoria',
          'NORMAL (' || p_monto || ' frascos)',
          'ARF (' || p_monto || ' frascos' ||
            case when v_resta_recibido > 0 then '; ' || v_resta_recibido || ' recibidos en el mes' else '' end || ')',
          p_motivo, 'RECLASIFICACION');

  return v_arf_id;
end;
$function$;

create or replace function public.biovac_reclasificar_arf_normal(
  p_renglon_id uuid, p_usuario text, p_rol text, p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_movimiento_id uuid;
  v_lote_id uuid;
  v_categoria text;
  v_estado text;
  v_monto numeric;
  v_recibido numeric;
  v_a_recibido numeric;
  v_a_anterior numeric;
  v_normal_id uuid;
begin
  perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false); -- auditoria-2026-10
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos, r.recibido_frascos
    into v_movimiento_id, v_lote_id, v_categoria, v_monto, v_recibido
  from biovac_renglones r
  where r.id = p_renglon_id
  for update;

  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;
  if v_categoria <> 'ARF' then
    raise exception 'Solo se puede reactivar un renglón en A.R.F. (categoría actual: %)', v_categoria;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado not in ('BORRADOR','EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para reactivar un lote (estado actual: %)', v_estado;
  end if;
  if v_monto <= 0 then
    raise exception 'No hay existencia en A.R.F. para reactivar en este renglón';
  end if;

  -- se regresa primero lo recibido en el mes; el resto vuelve como anterior
  v_a_recibido := least(v_monto, greatest(coalesce(v_recibido, 0), 0));
  v_a_anterior := v_monto - v_a_recibido;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos, recibido_frascos)
  values (v_movimiento_id, v_lote_id, 'NORMAL', v_a_anterior, v_a_recibido)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos,
                recibido_frascos = biovac_renglones.recibido_frascos + excluded.recibido_frascos
  returning id into v_normal_id;

  -- el renglón ARF ya se movió por completo a NORMAL -- se elimina para que
  -- el movimiento no acumule renglones en 0 mes tras mes; el rastro queda
  -- en biovac_correcciones, apuntando al renglón NORMAL resultante.
  delete from biovac_renglones where id = p_renglon_id;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_movimiento_id, v_normal_id, p_usuario, p_rol, 'categoria',
          'ARF (' || v_monto || ' frascos)', 'NORMAL (' || v_monto || ' frascos)', p_motivo, 'RECLASIFICACION');

  return v_normal_id;
end;
$function$;

revoke execute on function public.biovac_reclasificar_normal_arf(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.biovac_reclasificar_normal_arf(uuid, numeric, text, text, text) to authenticated, service_role;
revoke execute on function public.biovac_reclasificar_arf_normal(uuid, text, text, text) from public, anon;
grant execute on function public.biovac_reclasificar_arf_normal(uuid, text, text, text) to authenticated, service_role;
