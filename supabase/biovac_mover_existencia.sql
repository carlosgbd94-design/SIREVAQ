-- ============================================================================
-- Mover existencia entre Normal / A.R.F. / Canje (en los dos sentidos)
--
-- Antes solo había Normal -> A.R.F. (biovac_reclasificar_normal_arf) y A.R.F. -> Normal (todo el renglón, al dar el dictamen).
-- No había forma de mandar algo a Canje desde Normal o A.R.F., ni de sacar algo de Canje o A.R.F. una cantidad parcial.
--
-- biovac_mover_existencia(renglon, destino, monto, usuario, rol, motivo): mueve `monto` frascos de la existencia final de un
-- renglón a otra categoría del MISMO lote y del mismo Movimiento. Se descuenta primero de la existencia anterior y luego de lo
-- recibido (igual que las funciones existentes), queda en la bitácora de correcciones y, si el renglón de origen se queda sin
-- nada, se quita. Un lote caducado no puede volver a Normal.
--
-- Además: el recibido sincronizado con Requisiciones descuenta lo que ya se movió a A.R.F./Canje (para no contarlo doble) y el
-- candado de recibido de la unidad cubre también los renglones de A.R.F. y Canje.
-- ============================================================================

create or replace function public.biovac_mover_existencia(p_renglon_id uuid, p_destino text, p_monto numeric, p_usuario text, p_rol text, p_motivo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_mov uuid; v_lote uuid; v_cat text; v_final numeric; v_ant numeric; v_rec numeric; v_estado text;
  v_cad date; v_anio int; v_mes int;
  v_resta_ant numeric; v_resta_rec numeric; v_dest_id uuid; v_quedan numeric;
begin
  perform public._biovac_autoriza_movimiento((select rr.movimiento_id from biovac_renglones rr where rr.id = p_renglon_id), false);
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos, r.existencia_anterior_frascos, r.recibido_frascos
    into v_mov, v_lote, v_cat, v_final, v_ant, v_rec
  from biovac_renglones r where r.id = p_renglon_id for update;
  if v_mov is null then raise exception 'Renglón % no existe', p_renglon_id; end if;
  if p_destino not in ('NORMAL', 'ARF', 'CANJE') then raise exception 'Destino no válido: %', p_destino; end if;
  if p_destino = v_cat then raise exception 'El lote ya está en %', case v_cat when 'ARF' then 'A.R.F.' when 'CANJE' then 'Canje' else 'Normal' end; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'El motivo es obligatorio'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'La cantidad a mover debe ser mayor a cero'; end if;
  if p_monto > v_final then raise exception 'No puedes mover más de la existencia actual (% frascos)', v_final; end if;

  select m.estado, m.anio, m.mes into v_estado, v_anio, v_mes from biovac_movimientos m where m.id = v_mov;
  if v_estado not in ('BORRADOR', 'EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para mover existencia (estado actual: %)', v_estado;
  end if;
  if p_destino = 'NORMAL' then
    select l.caducidad into v_cad from biovac_lotes l where l.id = v_lote;
    if v_cad is not null and to_char(v_cad, 'YYYY-MM') <= to_char(make_date(v_anio, v_mes, 1), 'YYYY-MM') then
      raise exception 'Un lote caducado no puede regresar a Normal: desécholo.';
    end if;
  end if;

  v_resta_ant := least(p_monto, greatest(v_ant, 0));
  v_resta_rec := p_monto - v_resta_ant;

  update biovac_renglones set existencia_anterior_frascos = existencia_anterior_frascos - v_resta_ant,
                              recibido_frascos = recibido_frascos - v_resta_rec
  where id = p_renglon_id;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos, recibido_frascos)
  values (v_mov, v_lote, p_destino, v_resta_ant, v_resta_rec)
  on conflict (movimiento_id, lote_id, categoria) do update
    set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos,
        recibido_frascos = biovac_renglones.recibido_frascos + excluded.recibido_frascos
  returning id into v_dest_id;

  -- El renglón de origen se queda sin nada: se quita (su historia queda en la bitácora)
  select (existencia_anterior_frascos <> 0 or recibido_frascos <> 0 or aplicadas_a <> 0 or aplicadas_b <> 0 or desechadas_a <> 0 or desechadas_b <> 0)::int::numeric
    into v_quedan from biovac_renglones where id = p_renglon_id;
  if v_quedan = 0 then
    delete from biovac_renglones where id = p_renglon_id;
  end if;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_mov, v_dest_id, p_usuario, p_rol, 'categoria',
          v_cat || ' (' || p_monto || ' frascos)', p_destino || ' (' || p_monto || ' frascos)', p_motivo, 'RECLASIFICACION');
  return v_dest_id;
end;
$$;
revoke all on function public.biovac_mover_existencia(uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.biovac_mover_existencia(uuid, text, numeric, text, text, text) to authenticated;
