-- ===========================================================================
-- Movimiento del municipio: las RECLASIFICACIONES de status del mes (Normal -> ARF / Canje) que una unidad hace
-- sobre su existencia anterior ahora se aplican al municipio.
--
-- Antes la sincronización solo sumaba recibido / aplicadas / desechadas de las unidades y NUNCA tocaba la existencia
-- anterior, así que cuando una unidad pasaba, p. ej., 6 frascos de BCG de Normal a ARF (su anterior queda Normal -6 /
-- ARF +6 contra el cierre de su mes previo) el municipio no se enteraba. Solo se reflejaba el ARF "recibido".
--
-- Regla (a nivel de municipio y lote, cuando todas las unidades ya cerraron): diferencia por categoría = suma de las
-- existencias anteriores de las unidades - existencia anterior que trae el municipio (sin lo ya aplicado). Si esas
-- diferencias suman cero entre categorías del lote es una reclasificación pura (lo que sale de Normal entra a ARF/Canje)
-- y se aplica. Una diferencia de conteo (neto distinto de cero) no se mueve sola: la sigue avisando el detector
-- («Existencia anterior distinta»). Se aplica por diferencias (columna base_anterior_frascos), igual que
-- recibido/aplicadas/desechadas: lo que el municipal ajustó a mano se conserva y repetirla es inofensivo.
-- ADITIVA e idempotente.
-- ===========================================================================
alter table biovac_renglones add column if not exists base_anterior_frascos numeric not null default 0;

create or replace function public._biovac_sincronizar_municipio(p_municipio text, p_anio int, p_mes int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inicio date; v_js1 uuid; v_mov uuid; v_estado text;
  v_bypass text := coalesce(current_setting('biovac.bypass_validaciones', true), 'off');
  v_incl text[]; v_omit text[]; v_pend text[];
  v_act int := 0; v_nuevos int := 0; v_filas int;
  r record; v_row biovac_renglones%rowtype;
begin
  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if p_municipio in ('NHG', 'HENM') or make_date(p_anio, p_mes, 1) < coalesce(v_inicio, date '2026-10-01') then
    return jsonb_build_object('omitido', true);
  end if;
  select u.id into v_js1 from biovac_unidades u where u.municipio = p_municipio and u.clues like 'JS1-%' order by u.clues limit 1;
  if v_js1 is null then return jsonb_build_object('omitido', true); end if;

  select id, estado into v_mov, v_estado from biovac_movimientos where unidad_id = v_js1 and anio = p_anio and mes = p_mes for update;
  if v_mov is null then
    insert into biovac_movimientos (unidad_id, anio, mes, fecha_corte)
    values (v_js1, p_anio, p_mes, (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date)
    returning id into v_mov;
    v_estado := 'BORRADOR';
  end if;
  -- un mes del municipio ya CERRADO no se mueve solo: si una unidad cambia después, el detector de discrepancias lo avisa
  if v_estado = 'CERRADO' then return jsonb_build_object('cerrado', true); end if;

  select coalesce(array_agg(bu.clues order by bu.clues) filter (where _sis06p_unidad_omitida(bu.clues, p_anio, p_mes)), '{}'),
         coalesce(array_agg(bu.clues order by bu.clues) filter (where not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes) and um.estado = 'CERRADO'), '{}'),
         coalesce(array_agg(bu.clues order by bu.clues) filter (where not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes) and coalesce(um.estado, '') <> 'CERRADO'), '{}')
    into v_omit, v_incl, v_pend
  from biovac_unidades bu
  left join biovac_movimientos um on um.unidad_id = bu.id and um.anio = p_anio and um.mes = p_mes
  where bu.activo and bu.clues not like 'JS1-%' and bu.municipio = p_municipio;

  perform set_config('biovac.bypass_validaciones', 'on', true);   -- la caducidad de un lote arrastrado no debe frenar la suma
  for r in
    with nuevo as (
      select rn.lote_id, rn.categoria, sum(rn.recibido_frascos) rec, sum(rn.aplicadas_a) apa, sum(rn.aplicadas_b) apb,
             sum(rn.desechadas_a) dea, sum(rn.desechadas_b) deb
      from biovac_renglones rn
      join biovac_movimientos um on um.id = rn.movimiento_id
      join biovac_unidades bu on bu.id = um.unidad_id
      where bu.clues = any (v_incl) and um.anio = p_anio and um.mes = p_mes
      group by rn.lote_id, rn.categoria
    ), cur as (
      select um.unidad_id uid, rn.lote_id, rn.categoria, rn.existencia_anterior_frascos ant
      from biovac_renglones rn
      join biovac_movimientos um on um.id = rn.movimiento_id
      join biovac_unidades bu on bu.id = um.unidad_id
      where bu.clues = any (v_incl) and um.anio = p_anio and um.mes = p_mes
    ), usum as (
      select lote_id, categoria, sum(ant) ua from cur group by lote_id, categoria
    ), msum as (
      select lote_id, categoria, existencia_anterior_frascos - base_anterior_frascos ma
      from biovac_renglones where movimiento_id = v_mov
    ), dd as (
      select coalesce(u.lote_id, m.lote_id) lote_id, coalesce(u.categoria, m.categoria) categoria,
             coalesce(u.ua, 0) - coalesce(m.ma, 0) d
      from usum u full join msum m on m.lote_id = u.lote_id and m.categoria = u.categoria
    ), dd2 as (
      select dd.*, sum(dd.d) over (partition by dd.lote_id) neto from dd
    ), recl as (
      select lote_id, categoria, d ant
      from dd2
      where cardinality(v_pend) = 0 and abs(neto) < 0.0001 and abs(d) > 0.0001
    ), viejo as (
      select lote_id, categoria from biovac_renglones
      where movimiento_id = v_mov and (base_recibido_frascos <> 0 or base_aplicadas_a <> 0 or base_aplicadas_b <> 0
                                       or base_desechadas_a <> 0 or base_desechadas_b <> 0 or base_anterior_frascos <> 0)
    ), llaves as (
      select lote_id, categoria from nuevo union select lote_id, categoria from recl union select lote_id, categoria from viejo
    )
    select k.lote_id, k.categoria,
           coalesce(n.rec, 0) rec, coalesce(n.apa, 0) apa, coalesce(n.apb, 0) apb, coalesce(n.dea, 0) dea, coalesce(n.deb, 0) deb,
           coalesce(q.ant, 0) ant
    from llaves k
    left join nuevo n on n.lote_id = k.lote_id and n.categoria = k.categoria
    left join recl q on q.lote_id = k.lote_id and q.categoria = k.categoria
  loop
    select * into v_row from biovac_renglones where movimiento_id = v_mov and lote_id = r.lote_id and categoria = r.categoria for update;
    if not found then
      insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos,
                                    recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b,
                                    base_recibido_frascos, base_aplicadas_a, base_aplicadas_b, base_desechadas_a, base_desechadas_b,
                                    base_anterior_frascos)
      values (v_mov, r.lote_id, r.categoria, greatest(0, r.ant), r.rec, r.apa, r.apb, r.dea, r.deb, r.rec, r.apa, r.apb, r.dea, r.deb, r.ant);
      v_nuevos := v_nuevos + 1;
    else
      update biovac_renglones set
        existencia_anterior_frascos = greatest(0, existencia_anterior_frascos + (r.ant - base_anterior_frascos)),
        recibido_frascos = greatest(0, recibido_frascos + (r.rec - base_recibido_frascos)),
        aplicadas_a = greatest(0, aplicadas_a + (r.apa - base_aplicadas_a)),
        aplicadas_b = greatest(0, aplicadas_b + (r.apb - base_aplicadas_b)),
        desechadas_a = greatest(0, desechadas_a + (r.dea - base_desechadas_a)),
        desechadas_b = greatest(0, desechadas_b + (r.deb - base_desechadas_b)),
        base_anterior_frascos = r.ant,
        base_recibido_frascos = r.rec, base_aplicadas_a = r.apa, base_aplicadas_b = r.apb,
        base_desechadas_a = r.dea, base_desechadas_b = r.deb
      where id = v_row.id
        and (base_recibido_frascos <> r.rec or base_aplicadas_a <> r.apa or base_aplicadas_b <> r.apb
             or base_desechadas_a <> r.dea or base_desechadas_b <> r.deb or base_anterior_frascos <> r.ant);
      get diagnostics v_filas = row_count;
      v_act := v_act + v_filas;
    end if;
  end loop;
  perform set_config('biovac.bypass_validaciones', v_bypass, true);

  update biovac_movimientos set armado_en = coalesce(armado_en, now()), armado_por = coalesce(armado_por, 'automático') where id = v_mov;

  return jsonb_build_object('movimiento_id', v_mov, 'unidades_incluidas', to_jsonb(v_incl), 'unidades_sin_envio', to_jsonb(v_omit),
                            'unidades_pendientes', to_jsonb(v_pend), 'renglones_nuevos', v_nuevos, 'renglones_actualizados', v_act);
end;
$$;
