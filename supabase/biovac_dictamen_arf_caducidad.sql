-- ===========================================================================
-- BIOVAC · Dictamen de A.R.F. (reutilizar / desechar, total o parcial) y
-- caducidad por MES.
--
-- 1) Caducidad por mes: un lote con caducidad MMM-AA (p. ej. OCT-26) caduca el
--    último día de ese mes, así que en el Movimiento de ESE mes ya no puede
--    quedar con existencia (debe desecharse). Antes solo se bloqueaba desde el
--    mes siguiente (caducidad < fin de mes), y las fechas guardadas con día 1
--    vs. fin de mes se comportaban distinto. Ahora se compara año-mes.
-- 2) biovac_dictamen_arf: resuelve existencia en A.R.F. (o un Normal caducado)
--    - REUTILIZAR: dictamen favorable, parcial o total, pasa a Normal. Se
--      rechaza si el lote caduca en este mes o antes (aunque el dictamen sea
--      favorable ya no se puede aplicar).
--    - DESECHAR: da de baja la cantidad en "desechadas" del propio renglón
--      (en dosis) sin que el usuario tenga que calcularlas.
-- Idempotente (create or replace).
-- ===========================================================================

create or replace function biovac_trg_20_autocalc() returns trigger
language plpgsql
as $$
declare
  v_caducidad date;
  v_numero_lote text;
  v_anio int;
  v_mes int;
begin
  new.existencia_final_frascos := biovac_calc_existencia_final(
    new.lote_id, new.existencia_anterior_frascos, new.recibido_frascos,
    new.aplicadas_a, new.aplicadas_b, new.desechadas_a, new.desechadas_b
  );
  new.updated_at := now();

  -- Solo renglones NORMALES (un lote en A.R.F./canje puede quedar caducado
  -- mientras se resuelve). Se compara contra el MES del propio movimiento:
  -- un lote que caduca en ese mes (o antes) no puede cerrar con existencia.
  if new.categoria = 'NORMAL' and coalesce(current_setting('biovac.bypass_validaciones', true), 'off') <> 'on' then
    select l.numero_lote, l.caducidad into v_numero_lote, v_caducidad
    from biovac_lotes l where l.id = new.lote_id;

    select m.anio, m.mes into v_anio, v_mes
    from biovac_movimientos m where m.id = new.movimiento_id;

    if v_caducidad is not null and v_anio is not null
       and date_trunc('month', v_caducidad)::date <= make_date(v_anio, v_mes, 1)
       and new.existencia_final_frascos > 0 then
      raise exception 'El lote % caduca en % y aún registra existencia (%). Regístralo como desechado antes de guardar.',
        v_numero_lote, to_char(v_caducidad, 'MM/YYYY'), round(new.existencia_final_frascos, 2);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.biovac_dictamen_arf(
  p_renglon_id uuid, p_resultado text, p_monto numeric, p_usuario text, p_rol text, p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  r biovac_renglones%rowtype;
  v_estado text;
  v_anio int;
  v_mes int;
  v_caducidad date;
  v_presentacion text;
  v_dosis numeric;
  v_regla text;
  v_vencido boolean;
  v_monto numeric;
  v_u numeric;
  v_a_rec numeric;
  v_a_ant numeric;
  v_normal_id uuid;
begin
  perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false);

  select * into r from biovac_renglones where id = p_renglon_id for update;
  if r.id is null then raise exception 'Renglón % no existe', p_renglon_id; end if;
  if p_resultado not in ('REUTILIZAR', 'DESECHAR') then raise exception 'Resultado inválido: %', p_resultado; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'El motivo es obligatorio'; end if;

  select m.estado, m.anio, m.mes into v_estado, v_anio, v_mes from biovac_movimientos m where m.id = r.movimiento_id;
  if v_estado not in ('BORRADOR', 'EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección (estado actual: %)', v_estado;
  end if;

  select l.caducidad, cb.presentacion, coalesce(l.dosis_por_frasco_override, cb.dosis_por_frasco), cb.regla_especial
    into v_caducidad, v_presentacion, v_dosis, v_regla
  from biovac_lotes l join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where l.id = r.lote_id;
  v_vencido := v_caducidad is not null and date_trunc('month', v_caducidad)::date <= make_date(v_anio, v_mes, 1);

  if r.existencia_final_frascos <= 0 then raise exception 'No hay existencia en este renglón'; end if;
  v_monto := coalesce(p_monto, r.existencia_final_frascos);
  if v_monto <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if v_monto > r.existencia_final_frascos + 0.0001 then
    raise exception 'No puedes dar de baja más de la existencia actual (% frascos)', round(r.existencia_final_frascos, 2);
  end if;
  if v_monto > r.existencia_final_frascos then v_monto := r.existencia_final_frascos; end if;
  -- el dictamen y la caducidad son por LOTE: todo lo que está en A.R.F. se resuelve completo
  if r.categoria = 'ARF' then v_monto := r.existencia_final_frascos; end if;

  if p_resultado = 'DESECHAR' then
    if r.categoria = 'CANJE' then raise exception 'Un lote en canje se resuelve con el canje, no con el dictamen'; end if;
    if r.categoria = 'NORMAL' and not v_vencido then
      raise exception 'Un lote Normal solo se desecha por esta vía cuando ya caducó; si no, mándalo primero a A.R.F.';
    end if;
    -- dosis equivalentes a los frascos que se dan de baja
    v_u := round(v_monto * case when v_presentacion = 'UNIDOSIS' then 1 else v_dosis end, 4);
    if v_regla = 'SPLIT_DOSE' then
      update biovac_renglones set desechadas_b = coalesce(desechadas_b, 0) + v_u where id = r.id;
    else
      update biovac_renglones set desechadas_a = coalesce(desechadas_a, 0) + v_u where id = r.id;
    end if;
    update biovac_renglones set observaciones = left(trim(both ' ' from coalesce(observaciones, '') || ' ' ||
        case when v_vencido then 'Desechado por caducidad. ' else 'Desechado por dictamen. ' end || p_motivo), 500)
      where id = r.id;
    insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
    values (r.movimiento_id, r.id, p_usuario, p_rol, 'desechadas',
            round(v_monto, 2) || ' frascos con existencia', 'desechados (' || round(v_monto, 2) || ' frascos' ||
              case when v_vencido then ', caducidad' else ', dictamen' end || ')',
            p_motivo, 'RECLASIFICACION');
    return r.id;
  end if;

  -- REUTILIZAR (solo desde A.R.F.)
  if r.categoria <> 'ARF' then raise exception 'Solo se reutiliza existencia que está en A.R.F.'; end if;
  if v_vencido then
    raise exception 'El lote caduca en % y ya no puede reutilizarse aunque el dictamen sea favorable: desecha la existencia.',
      to_char(v_caducidad, 'MM/YYYY');
  end if;

  v_a_rec := least(v_monto, greatest(coalesce(r.recibido_frascos, 0), 0));
  v_a_ant := v_monto - v_a_rec;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos, recibido_frascos)
  values (r.movimiento_id, r.lote_id, 'NORMAL', v_a_ant, v_a_rec)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos,
                recibido_frascos = biovac_renglones.recibido_frascos + excluded.recibido_frascos
  returning id into v_normal_id;

  update biovac_renglones
     set existencia_anterior_frascos = existencia_anterior_frascos - v_a_ant,
         recibido_frascos = recibido_frascos - v_a_rec
   where id = r.id;
  -- si ya no queda nada en el A.R.F. (ni movimiento propio), se elimina
  delete from biovac_renglones
   where id = r.id and coalesce(existencia_anterior_frascos, 0) = 0 and coalesce(recibido_frascos, 0) = 0
     and coalesce(aplicadas_a, 0) = 0 and coalesce(aplicadas_b, 0) = 0
     and coalesce(desechadas_a, 0) = 0 and coalesce(desechadas_b, 0) = 0;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (r.movimiento_id, v_normal_id, p_usuario, p_rol, 'categoria',
          'ARF (' || round(v_monto, 2) || ' frascos)', 'NORMAL (' || round(v_monto, 2) || ' frascos, dictamen favorable)',
          p_motivo, 'RECLASIFICACION');
  return v_normal_id;
end;
$function$;

revoke execute on function public.biovac_dictamen_arf(uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.biovac_dictamen_arf(uuid, text, numeric, text, text, text) to authenticated, service_role;
