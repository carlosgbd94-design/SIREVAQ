-- ===========================================================================
-- Movimiento del MUNICIPIO desde octubre 2026: se arma SOLO con sus unidades (escalera de jerarquías)
--
--   unidades (base)  ->  municipio (JS1-xxx, editable en recibido/aplicadas/desechadas)  ->  jurisdicción
--   (los hospitales NHG/HENM se cuentan aparte, con su propia cuenta)
--
--  * Sincronización AUTOMÁTICA por diferencias: cada vez que un Movimiento de unidad pasa a CERRADO (envío o corrección
--    aplicada) se suma lo nuevo al del municipio. Por ser por diferencias, lo que el municipal ajustó a mano se conserva
--    y repetirla es inofensivo. La existencia anterior del municipio NO se toca (viene del cierre del mes pasado).
--  * La jurisdicción suma por MUNICIPIO (fila JS1-), nunca por unidad. Hospitales: su propia cuenta.
--  * Detector de discrepancias unidades vs municipio (biovac_discrepancias_municipio) y su aviso en la validación.
--  * Los meses de PRUEBA de las unidades (antes del arranque por unidad) ya no arrastran existencia al arranque.
-- ADITIVA e idempotente.
-- ===========================================================================

-- 1) Columnas base: lo que las unidades aportaron la última vez que se sincronizó (para aplicar solo la diferencia)
alter table biovac_renglones add column if not exists base_recibido_frascos numeric not null default 0;
alter table biovac_renglones add column if not exists base_aplicadas_a numeric not null default 0;
alter table biovac_renglones add column if not exists base_aplicadas_b numeric not null default 0;
alter table biovac_renglones add column if not exists base_desechadas_a numeric not null default 0;
alter table biovac_renglones add column if not exists base_desechadas_b numeric not null default 0;

-- 2) ¿Es un mes de prueba de una unidad real (no hospital) previo al arranque por unidad?
create or replace function public._biovac_es_mes_de_prueba(p_unidad uuid, p_anio int, p_mes int) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from biovac_unidades u
    where u.id = p_unidad and u.clues not like 'JS1-%' and u.municipio not in ('NHG', 'HENM')
      and make_date(p_anio, p_mes, 1) < coalesce((select valor::date from sis_config where clave = 'inicio_captura_por_unidad'), date '2026-10-01')
  );
$$;

-- 3) Sincronización del Movimiento del municipio con sus unidades (por diferencias)
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
    ), viejo as (
      select lote_id, categoria from biovac_renglones
      where movimiento_id = v_mov and (base_recibido_frascos <> 0 or base_aplicadas_a <> 0 or base_aplicadas_b <> 0
                                       or base_desechadas_a <> 0 or base_desechadas_b <> 0)
    )
    select coalesce(n.lote_id, v.lote_id) lote_id, coalesce(n.categoria, v.categoria) categoria,
           coalesce(n.rec, 0) rec, coalesce(n.apa, 0) apa, coalesce(n.apb, 0) apb, coalesce(n.dea, 0) dea, coalesce(n.deb, 0) deb
    from nuevo n full join viejo v on v.lote_id = n.lote_id and v.categoria = n.categoria
  loop
    select * into v_row from biovac_renglones where movimiento_id = v_mov and lote_id = r.lote_id and categoria = r.categoria for update;
    if not found then
      insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos,
                                    recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b,
                                    base_recibido_frascos, base_aplicadas_a, base_aplicadas_b, base_desechadas_a, base_desechadas_b)
      values (v_mov, r.lote_id, r.categoria, 0, r.rec, r.apa, r.apb, r.dea, r.deb, r.rec, r.apa, r.apb, r.dea, r.deb);
      v_nuevos := v_nuevos + 1;
    else
      update biovac_renglones set
        recibido_frascos = greatest(0, recibido_frascos + (r.rec - base_recibido_frascos)),
        aplicadas_a = greatest(0, aplicadas_a + (r.apa - base_aplicadas_a)),
        aplicadas_b = greatest(0, aplicadas_b + (r.apb - base_aplicadas_b)),
        desechadas_a = greatest(0, desechadas_a + (r.dea - base_desechadas_a)),
        desechadas_b = greatest(0, desechadas_b + (r.deb - base_desechadas_b)),
        base_recibido_frascos = r.rec, base_aplicadas_a = r.apa, base_aplicadas_b = r.apb,
        base_desechadas_a = r.dea, base_desechadas_b = r.deb
      where id = v_row.id
        and (base_recibido_frascos <> r.rec or base_aplicadas_a <> r.apa or base_aplicadas_b <> r.apb
             or base_desechadas_a <> r.dea or base_desechadas_b <> r.deb);
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

-- Disparador: un Movimiento de UNIDAD que pasa a CERRADO (envío, o corrección aplicada) se suma solo al del municipio.
-- Un fallo aquí nunca debe impedir que la unidad envíe: se avisa y el detector de discrepancias lo deja ver.
create or replace function public.biovac_trg_sync_municipio() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_clues text; v_muni text;
begin
  select u.clues, u.municipio into v_clues, v_muni from biovac_unidades u where u.id = new.unidad_id;
  if v_clues is null or v_clues like 'JS1-%' then return null; end if;
  begin
    perform _biovac_sincronizar_municipio(v_muni, new.anio, new.mes);
  exception when others then
    raise warning 'No se pudo sincronizar el Movimiento del municipio %: %', v_muni, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_biovac_sync_municipio on biovac_movimientos;
create trigger trg_biovac_sync_municipio
after update of estado on biovac_movimientos
for each row
when (new.estado = 'CERRADO' and old.estado is distinct from 'CERRADO')
execute function public.biovac_trg_sync_municipio();

-- Resincronización manual (mantenimiento / recuperación): ahora aplica solo la DIFERENCIA, nunca pisa lo ajustado a mano.
create or replace function public.biovac_armar_movimiento_municipio(p_municipio text, p_mes int, p_anio int, p_usuario text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_perfil perfiles%rowtype; v_rol text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then raise exception 'Rol % no puede actualizar el Movimiento del municipio.', v_rol; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then raise exception 'Fuera de tu alcance de municipios.'; end if;
  return _biovac_sincronizar_municipio(p_municipio, p_anio, p_mes);
end;
$$;

-- 4) La jurisdicción suma por MUNICIPIO (fila JS1-), nunca por unidad. Hospitales con cuenta propia: su fila real.
create or replace function public.biovac_cuenta_para_jurisdiccion(p_clues text, p_municipio text, p_anio integer, p_mes integer)
returns boolean language sql stable set search_path to 'public'
as $function$
  select case
    when p_municipio in ('NHG', 'HENM')
         and make_date(p_anio, p_mes, 1) >= coalesce((select valor::date from sis_config where clave = 'inicio_captura_hospitales'), date '2026-09-01')
      then p_clues not like 'JS1-%'
    else p_clues like 'JS1-%'
  end;
$function$;

-- 5) Detector de discrepancias unidades vs municipio (por lote). Un solo hallazgo por lote, el más importante.
create or replace function public.biovac_discrepancias_municipio(p_municipio text, p_mes int, p_anio int)
returns table(lote_id uuid, numero_lote text, caducidad date, biologico text, categoria text,
              mun_anterior numeric, uni_anterior numeric, mun_recibido numeric, uni_recibido numeric,
              mun_aplicadas numeric, uni_aplicadas numeric, mun_desechadas numeric, uni_desechadas numeric,
              mun_final numeric, uni_final numeric, tipo text, severidad text, mensaje text)
language plpgsql stable security definer set search_path = public
as $$
declare v_perfil perfiles%rowtype; v_rol text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then return; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'VISUALIZADOR_JURISDICCIONAL') then return; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then return; end if;
  if p_municipio in ('NHG', 'HENM') then return; end if;

  return query
  with js1 as (
    select m.id mov from biovac_movimientos m join biovac_unidades u on u.id = m.unidad_id
    where u.municipio = p_municipio and u.clues like 'JS1-%' and m.anio = p_anio and m.mes = p_mes
  ), mun as (
    select r.lote_id, r.categoria, r.existencia_anterior_frascos ant, r.recibido_frascos rec,
           r.aplicadas_a + r.aplicadas_b apl, r.desechadas_a + r.desechadas_b des, r.existencia_final_frascos fin,
           r.base_recibido_frascos brec, r.base_aplicadas_a + r.base_aplicadas_b bapl, r.base_desechadas_a + r.base_desechadas_b bdes
    from biovac_renglones r join js1 on r.movimiento_id = js1.mov
  ), uni as (
    select rn.lote_id, rn.categoria, sum(rn.existencia_anterior_frascos) ant, sum(rn.recibido_frascos) rec,
           sum(rn.aplicadas_a + rn.aplicadas_b) apl, sum(rn.desechadas_a + rn.desechadas_b) des, sum(rn.existencia_final_frascos) fin
    from biovac_renglones rn
    join biovac_movimientos um on um.id = rn.movimiento_id
    join biovac_unidades bu on bu.id = um.unidad_id
    where bu.municipio = p_municipio and bu.clues not like 'JS1-%' and bu.activo
      and um.anio = p_anio and um.mes = p_mes and um.estado = 'CERRADO'
      and not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes)
    group by rn.lote_id, rn.categoria
  ), c as (
    select coalesce(m.lote_id, u.lote_id) lid, coalesce(m.categoria, u.categoria) cat,
           (m.lote_id is not null) en_mun, (u.lote_id is not null) en_uni,
           coalesce(m.ant, 0) mant, coalesce(u.ant, 0) uant, coalesce(m.rec, 0) mrec, coalesce(u.rec, 0) urec,
           coalesce(m.apl, 0) mapl, coalesce(u.apl, 0) uapl, coalesce(m.des, 0) mdes, coalesce(u.des, 0) udes,
           coalesce(m.fin, 0) mfin, coalesce(u.fin, 0) ufin,
           coalesce(m.brec, 0) brec, coalesce(m.bapl, 0) bapl, coalesce(m.bdes, 0) bdes
    from mun m full join uni u on u.lote_id = m.lote_id and u.categoria = m.categoria
  ), k as (
    select c.*,
      -- lo que el municipal movió a mano sobre lo que sumaron las unidades
      (c.mrec - c.brec) ed_rec, (c.mapl - c.bapl) ed_apl, (c.mdes - c.bdes) ed_des,
      -- cuánto de la diferencia de existencia final se explica por la anterior y por esos ajustes
      (c.mfin - c.ufin) dif_fin,
      (c.mant - c.uant) + (c.mrec - c.brec) - (c.mapl - c.bapl) - (c.mdes - c.bdes) explicado
    from c
  ), t as (
    select k.*,
      case
        when k.mfin < 0 then 'FINAL_NEGATIVA'
        when abs(k.brec - k.urec) > 0.001 or abs(k.bapl - k.uapl) > 0.001 or abs(k.bdes - k.udes) > 0.001 then 'UNIDAD_CAMBIO_POSTERIOR'
        when abs(k.dif_fin - k.explicado) > 0.001 then 'INCONSISTENCIA'
        when abs(k.ed_rec) > 0.001 or abs(k.ed_apl) > 0.001 or abs(k.ed_des) > 0.001 then 'EDITADO_A_MANO'
        when not k.en_uni and (select count(*) from uni) > 0 and (k.mant <> 0 or k.mrec <> 0 or k.mapl <> 0 or k.mdes <> 0) then 'SOLO_MUNICIPIO'
        when k.en_uni and abs(k.mant - k.uant) > 0.001 then 'ANTERIOR_DISTINTA'
        else null
      end tp
    from k
  )
  select t.lid, l.numero_lote, l.caducidad, cb.nombre_excel, t.cat,
         t.mant, t.uant, t.mrec, t.urec, t.mapl, t.uapl, t.mdes, t.udes, t.mfin, t.ufin,
         t.tp,
         case t.tp when 'FINAL_NEGATIVA' then 'ERROR' when 'UNIDAD_CAMBIO_POSTERIOR' then 'ERROR' when 'INCONSISTENCIA' then 'ERROR'
                   when 'EDITADO_A_MANO' then 'ADVERTENCIA' else 'INFO' end,
         case t.tp
           when 'FINAL_NEGATIVA' then format('La existencia final del municipio queda en %s (negativa): se dieron de baja más frascos de los que hay.', trim_scale(round(t.mfin, 2)))
           when 'UNIDAD_CAMBIO_POSTERIOR' then format('Las unidades suman hoy recibido %s, aplicadas %s y desechadas %s, pero el municipio tomó %s, %s y %s: una unidad cambió después de sincronizar o el mes del municipio ya estaba cerrado. Reabre el mes del municipio para actualizarlo.',
               trim_scale(round(t.urec, 2)), trim_scale(round(t.uapl, 2)), trim_scale(round(t.udes, 2)), trim_scale(round(t.brec, 2)), trim_scale(round(t.bapl, 2)), trim_scale(round(t.bdes, 2)))
           when 'INCONSISTENCIA' then format('El final del municipio (%s) y la suma de las unidades (%s) difieren en %s y eso NO se explica ni por la existencia anterior ni por tus ajustes: revisa este lote renglón por renglón.',
               trim_scale(round(t.mfin, 2)), trim_scale(round(t.ufin, 2)), trim_scale(round(t.dif_fin, 2)))
           when 'EDITADO_A_MANO' then format('Ajustaste a mano sobre lo que sumaron las unidades: recibido %s, aplicadas %s, desechadas %s. Confirma que es lo que se validó con la jurisdicción.',
               (case when t.ed_rec > 0 then '+' else '' end) || trim_scale(round(t.ed_rec, 2)),
               (case when t.ed_apl > 0 then '+' else '' end) || trim_scale(round(t.ed_apl, 2)),
               (case when t.ed_des > 0 then '+' else '' end) || trim_scale(round(t.ed_des, 2)))
           when 'SOLO_MUNICIPIO' then format('El municipio tiene %s frascos de este lote (anterior %s) y ninguna unidad lo reporta este mes: ¿sigue en el almacén municipal?',
               trim_scale(round(t.mfin, 2)), trim_scale(round(t.mant, 2)))
           when 'ANTERIOR_DISTINTA' then format('Existencia anterior distinta: el municipio trae %s del mes pasado y las unidades declararon %s. Es esperable el primer mes (captura manual previa del municipio); confirma que ese stock exista físicamente.',
               trim_scale(round(t.mant, 2)), trim_scale(round(t.uant, 2)))
         end
  from t
  join biovac_lotes l on l.id = t.lid
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where t.tp is not null
  order by case t.tp when 'FINAL_NEGATIVA' then 0 when 'UNIDAD_CAMBIO_POSTERIOR' then 1 when 'INCONSISTENCIA' then 2
                     when 'EDITADO_A_MANO' then 3 when 'SOLO_MUNICIPIO' then 4 else 5 end, cb.nombre_excel, l.numero_lote;
end;
$$;

-- 6) Parches a funciones existentes (idempotentes) ---------------------------------------------------------------
do $do$
declare v_def text; v_new text;
begin
  -- 6a) biovac_cerrar_mes: ya no exige "traer" (la sincronización es automática) y un mes de PRUEBA de una unidad no arrastra al arranque
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_cerrar_mes' limit 1;
  if v_def is null then raise exception 'No existe biovac_cerrar_mes'; end if;
  if v_def not like '%_biovac_es_mes_de_prueba%' then
    v_new := replace(v_def,
      $a$    if v_js1_armado is null then
      raise exception 'Antes de cerrar, trae el Movimiento de tus unidades (botón "Traer de mis unidades").';
    end if;
$a$, '');
    v_def := v_new;
    v_new := replace(v_def,
      $a$  where id = p_movimiento_id;

  v_next_anio := v_anio;$a$,
      $b$  where id = p_movimiento_id;

  -- mes de PRUEBA de una unidad (antes del arranque por unidad): se cierra pero NO arrastra existencia al arranque
  if _biovac_es_mes_de_prueba(v_unidad, v_anio, v_mes) then
    perform set_config('biovac.bypass_lock', 'off', true);
    perform set_config('biovac.bypass_validaciones', 'off', true);
    return null;
  end if;

  v_next_anio := v_anio;$b$);
    if v_new = v_def then raise exception 'No se pudo parchear (prueba) biovac_cerrar_mes'; end if;
    execute v_new;
  end if;

  -- 6b) biovac_aplicar_correccion: la corrección de un mes de prueba tampoco se propaga al arranque
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_aplicar_correccion' limit 1;
  if v_def is null then raise exception 'No existe biovac_aplicar_correccion'; end if;
  if v_def not like '%_biovac_es_mes_de_prueba%' then
    v_new := replace(v_def,
      $a$    if v_next_mes > 12 then v_next_anio := v_anio + 1; v_next_mes := 1; end if;
$a$,
      $b$    if v_next_mes > 12 then v_next_anio := v_anio + 1; v_next_mes := 1; end if;
    exit when _biovac_es_mes_de_prueba(v_unidad, v_anio, v_mes);
$b$);
    if v_new = v_def then raise exception 'No se pudo parchear biovac_aplicar_correccion'; end if;
    execute v_new;
  end if;

  -- 6c) biovac_validar_concentrado: aviso por municipio cuando no cuadra con la suma de sus unidades
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_validar_concentrado' limit 1;
  if v_def is null then raise exception 'No existe biovac_validar_concentrado'; end if;
  if v_def not like '%MUNICIPIO_VS_UNIDADES%' then
    v_new := regexp_replace(v_def, E'\\nend;\\n\\$function\\$\\s*$',
      E'\n  return query\n' ||
      E'  select case d.severidad when ''ERROR'' then ''ERROR'' else ''ADVERTENCIA'' end, ''MUNICIPIO_VS_UNIDADES''::text, d.mensaje,\n' ||
      E'         (select u2.nombre from biovac_unidades u2 where u2.municipio = mu.municipio and u2.clues like ''JS1-%'' order by u2.clues limit 1),\n' ||
      E'         d.biologico, d.numero_lote\n' ||
      E'  from (select distinct u.municipio from biovac_unidades u\n' ||
      E'        where u.jurisdiccion_id = p_jurisdiccion_id and u.activo and u.clues like ''JS1-%'' and u.municipio not in (''NHG'', ''HENM'')\n' ||
      E'          and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)\n' ||
      E'          and make_date(p_anio, p_mes, 1) >= coalesce((select valor::date from sis_config where clave = ''inicio_captura_por_unidad''), date ''2026-10-01'')) mu\n' ||
      E'  cross join lateral biovac_discrepancias_municipio(mu.municipio, p_mes, p_anio) d\n' ||
      E'  where d.tipo <> ''SOLO_MUNICIPIO'';\n' ||
      E'end;\n$function$\n');
    if v_new = v_def then raise exception 'No se pudo parchear biovac_validar_concentrado'; end if;
    execute v_new;
  end if;
end
$do$;

-- 7) Permisos
do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname in
       ('_biovac_es_mes_de_prueba','_biovac_sincronizar_municipio','biovac_trg_sync_municipio','biovac_armar_movimiento_municipio',
        'biovac_cuenta_para_jurisdiccion','biovac_discrepancias_municipio','biovac_cerrar_mes','biovac_aplicar_correccion','biovac_validar_concentrado')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$do$;
