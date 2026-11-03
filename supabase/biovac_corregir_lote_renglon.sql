-- ============================================================================
-- Corregir el LOTE de un renglón sin perder lo capturado (existencia anterior,
-- recibido, aplicadas, desechadas, observaciones).
--
-- Caso real: la unidad capturó el lote 1 y era el lote 2. Antes solo se podía
-- eliminar el renglón (y con él las cantidades). Ahora se re-apunta el renglón
-- a otro lote del mismo biológico y todo lo capturado se queda.
--
-- Reglas:
--   * Solo en un movimiento en captura (BORRADOR) o en corrección (EN_CORRECCION).
--   * Quien puede operar el movimiento (la propia unidad antes de enviar, el
--     municipal/jurisdicción/admin al corregir) -- misma autorización que el resto.
--   * SOLO sirve para corregir una EXISTENCIA ANTERIOR capturada a mano este mes:
--     el renglón no puede traer recibido (viene validado de Requisiciones) ni ser
--     arrastre de un mes anterior (ahí se corrige en el mes donde se capturó).
--   * Los meses SIGUIENTES de esa unidad que arrastran el lote viejo se re-apuntan
--     solos (si no, el arrastre resucitaría el lote equivocado); si alguno trae
--     recibido de Requisiciones con ese lote, se avisa y no se cambia nada.
--   * Nunca se renombra biovac_lotes (es compartido entre municipios): se busca
--     o se crea el lote nuevo del mismo biológico.
--   * Si la unidad ya trae el lote nuevo con la misma categoría en alguno de
--     esos meses, no se mezcla solo: se avisa (unique movimiento+lote+categoría).
--   * Queda en biovac_correcciones (tipo EDICION, campo 'lote').
-- ============================================================================

create or replace function biovac_corregir_lote_renglon(
  p_renglon_id uuid,
  p_nuevo_numero_lote text,
  p_nueva_caducidad date,
  p_usuario text,
  p_rol text,
  p_motivo text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov uuid;
  v_unidad uuid;
  v_estado text;
  v_lote_viejo uuid;
  v_num_viejo text;
  v_cad_vieja date;
  v_bio uuid;
  v_nuevo text := upper(btrim(coalesce(p_nuevo_numero_lote, '')));
  v_lote_nuevo uuid;
  v_choque text;
  v_tocados int := 0;
  v_recibido numeric;
  v_categoria text;
  v_anio int;
  v_mes int;
  r record;
begin
  select r0.movimiento_id, r0.lote_id, m.unidad_id, m.estado, l.numero_lote, l.caducidad, l.biologico_id, r0.recibido_frascos, r0.categoria, m.anio, m.mes
    into v_mov, v_lote_viejo, v_unidad, v_estado, v_num_viejo, v_cad_vieja, v_bio, v_recibido, v_categoria, v_anio, v_mes
  from biovac_renglones r0
  join biovac_movimientos m on m.id = r0.movimiento_id
  join biovac_lotes l on l.id = r0.lote_id
  where r0.id = p_renglon_id
  for update of r0;

  if v_mov is null then raise exception 'Renglón % no existe', p_renglon_id; end if;

  perform _biovac_autoriza_movimiento(v_mov, false);

  if v_estado not in ('BORRADOR', 'EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o en corrección para cambiar el lote (estado actual: %)', v_estado;
  end if;
  if coalesce(v_recibido, 0) > 0 then
    raise exception 'Este lote trae recibido (viene validado de Requisiciones): su lote no se cambia aquí.';
  end if;
  if exists (
    select 1 from biovac_renglones rp
    join biovac_movimientos mp on mp.id = rp.movimiento_id
    where mp.unidad_id = v_unidad and (mp.anio * 12 + mp.mes) < (v_anio * 12 + v_mes)
      and rp.lote_id = v_lote_viejo and rp.categoria = v_categoria
  ) then
    raise exception 'La existencia anterior de este lote viene arrastrada del mes pasado: corrige el lote en el mes donde se capturó.';
  end if;
  if exists (
    select 1 from biovac_renglones rs
    join biovac_movimientos ms on ms.id = rs.movimiento_id
    where ms.unidad_id = v_unidad and (ms.anio * 12 + ms.mes) > (v_anio * 12 + v_mes)
      and rs.lote_id = v_lote_viejo and rs.recibido_frascos > 0
  ) then
    raise exception 'Un mes posterior trae recibido de Requisiciones con este lote: no se puede cambiar solo el lote de la existencia anterior.';
  end if;
  if v_nuevo = '' then raise exception 'El número de lote nuevo es obligatorio'; end if;
  if p_motivo is null or length(btrim(p_motivo)) = 0 then raise exception 'El motivo es obligatorio'; end if;

  select id into v_lote_nuevo
  from biovac_lotes where biologico_id = v_bio and upper(btrim(numero_lote)) = v_nuevo
  order by (id = v_lote_viejo) desc limit 1;

  if v_lote_nuevo is null then
    insert into biovac_lotes (biologico_id, numero_lote, caducidad)
    values (v_bio, v_nuevo, p_nueva_caducidad) returning id into v_lote_nuevo;
  elsif v_lote_nuevo <> v_lote_viejo and p_nueva_caducidad is not null then
    update biovac_lotes set caducidad = p_nueva_caducidad
    where id = v_lote_nuevo and caducidad is distinct from p_nueva_caducidad;
  end if;

  if v_lote_nuevo = v_lote_viejo then
    raise exception 'Ese ya es el lote de este renglón (%)', v_num_viejo;
  end if;

  -- ¿la unidad ya trae el lote nuevo en alguno de los meses a re-apuntar?
  select to_char(make_date(m.anio, m.mes, 1), 'MM/YYYY') into v_choque
  from biovac_renglones rv
  join biovac_movimientos m on m.id = rv.movimiento_id
  join biovac_renglones rn on rn.movimiento_id = rv.movimiento_id and rn.lote_id = v_lote_nuevo and rn.categoria = rv.categoria
  where m.unidad_id = v_unidad and rv.lote_id = v_lote_viejo and (m.anio * 12 + m.mes) >= (v_anio * 12 + v_mes)
  order by m.anio, m.mes limit 1;
  if v_choque is not null then
    raise exception 'El lote % ya está capturado en % de esta unidad con el mismo estatus. Captura las cantidades en ese renglón y elimina el equivocado.', v_nuevo, v_choque;
  end if;

  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  for r in
    select rv.id as renglon_id, rv.movimiento_id as mov_id, rv.categoria
    from biovac_renglones rv
    join biovac_movimientos m on m.id = rv.movimiento_id
    where m.unidad_id = v_unidad and rv.lote_id = v_lote_viejo and (m.anio * 12 + m.mes) >= (v_anio * 12 + v_mes)
    order by m.anio, m.mes
  loop
    update biovac_renglones set lote_id = v_lote_nuevo, updated_at = now() where id = r.renglon_id;
    if r.mov_id <> v_mov then
      update biovac_movimientos set fue_corregido = true, updated_at = now()
      where id = r.mov_id and estado = 'CERRADO';
    end if;
    insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
    values (r.mov_id, r.renglon_id, p_usuario, p_rol, 'lote', v_num_viejo, v_nuevo,
            case when r.mov_id = v_mov then btrim(p_motivo) else btrim(p_motivo) || ' (arrastre del mismo cambio de lote)' end,
            'EDICION');
    v_tocados := v_tocados + 1;
  end loop;

  perform set_config('biovac.bypass_lock', 'off', true);
  perform set_config('biovac.bypass_validaciones', 'off', true);

  -- recalcula el mes (la caducidad del lote nuevo pudo ser otra)
  perform biovac_recalcular_movimiento(v_mov);

  return v_tocados;
end;
$$;

revoke all on function biovac_corregir_lote_renglon(uuid, text, date, text, text, text) from public, anon;
grant execute on function biovac_corregir_lote_renglon(uuid, text, date, text, text, text) to authenticated;
