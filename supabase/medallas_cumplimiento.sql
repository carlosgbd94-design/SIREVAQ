-- Medallas de cumplimiento y métricas del historial.
--
-- 1) get_year_medal_inputs_rpc: insumos del año (semanas cumplidas, pedido, semanas esperadas) SOLO de la unidad
--    o del municipio pedido; antes el cliente pedía las métricas de todo el estado por cada mes.
-- 2) get_history_metrics_rpc: ahora devuelve solo datos crudos. El puntaje, el nivel y "pedido requerido" los
--    calcula el cliente (main.js: computeComplianceScore) porque dependen de influenza y de la ventana de captura
--    con días festivos; la versión SQL anterior estaba desactualizada (ignoraba influenza y exigía pedido desde el 15).
-- 3) influenza_capture_hits_rpc: de las fechas esperadas que se le pasan, devuelve cuáles capturó cada unidad
--    (un solo jsonb, sin tope de filas ni descarga de la tabla completa). Al ser SECURITY DEFINER el ranking ve las
--    capturas de TODAS las unidades; antes, con RLS, un usuario de unidad solo veía las suyas.

create index if not exists idx_consumibles_clues_fecha on public.consumibles (clues, fecha);
create index if not exists idx_exist_clues_fecha on public.biologicos_existencia (clues, fecha);
create index if not exists idx_influenza_capturas_campana_fecha on public.influenza_capturas (anio_campana, fecha);

-- 1) ---------------------------------------------------------------------------------------------------------------
create or replace function public.get_year_medal_inputs_rpc(
  p_anio int,
  p_clues text default null,
  p_municipio text default null
)
returns table(
  mes text,
  clues varchar,
  bio_semanas_ok int,
  cons_semanas_ok int,
  pedido_mensual boolean,
  ebio int,
  econs int
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with lim as (
    select case when p_anio = extract(year from current_date)::int
                then extract(month from current_date)::int else 12 end as n
  ),
  mon as (
    select make_date(p_anio, g, 1) as d0,
           (make_date(p_anio, g, 1) + interval '1 month - 1 day')::date as d1
    from lim, generate_series(1, lim.n) g
  ),
  days as (
    select m.d0, gs::date as dt, extract(dow from gs)::int as dow
    from mon m, generate_series(m.d0::timestamp, m.d1::timestamp, interval '1 day') gs
  ),
  tot as (
    select d0,
           greatest(count(*) filter (where dow = 5), 1)::int as eb,
           greatest(count(*) filter (where dow = 4), 1)::int as ec
    from days group by d0
  ),
  u as (
    select un.clues::varchar as clues
    from public.unidades un
    where un.activo = 'SI'
      and (p_clues is null or upper(trim(un.clues)) = upper(trim(p_clues)))
      -- Misma normalización que normalizeText() del cliente: sin acentos/Ñ, mayúsculas y "EL MARQUES" = "MARQUES"
      and (p_municipio is null or
           regexp_replace(translate(upper(trim(un.municipio)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '^EL MARQUES$', 'MARQUES') =
           regexp_replace(translate(upper(trim(p_municipio)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '^EL MARQUES$', 'MARQUES'))
  )
  select
    to_char(m.d0, 'YYYY-MM') as mes,
    u.clues,
    (select count(*) from days d
       where d.d0 = m.d0 and d.dow = 5
         and exists (select 1 from public.biologicos_existencia b
                     where b.clues = u.clues and b.fecha in (d.dt, d.dt - 1)))::int as bio_semanas_ok,
    (select count(*) from days d
       where d.d0 = m.d0 and d.dow = 4
         and exists (select 1 from public.consumibles c
                     where c.clues = u.clues and c.fecha in (d.dt, d.dt - 1)))::int as cons_semanas_ok,
    exists (select 1 from public.biologicos_pedido p
            where p.clues = u.clues and p.tipo_pedido = 'MENSUAL'
              and p.fecha_captura >= m.d0 and p.fecha_captura <= m.d1) as pedido_mensual,
    t.eb as ebio,
    t.ec as econs
  from mon m
  join tot t on t.d0 = m.d0
  cross join u
  order by 1, 2;
$$;

revoke all on function public.get_year_medal_inputs_rpc(int, text, text) from public, anon;
grant execute on function public.get_year_medal_inputs_rpc(int, text, text) to authenticated, service_role;

-- 2) ---------------------------------------------------------------------------------------------------------------
drop function if exists public.get_history_metrics_rpc(character varying);

create function public.get_history_metrics_rpc(p_mes character varying)
returns table(
  clues character varying,
  municipio character varying,
  unidad character varying,
  bio_semanas_ok integer,
  cons_semanas_ok integer,
  pedido_mensual boolean,
  ultima_captura character varying,
  ebio integer,
  econs integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_fecha_inicio date;
  v_fecha_fin date;
  v_total_month_cons int := 0;
  v_total_month_bio int := 0;
  v_curr_date date;
  v_dow int;
begin
  v_fecha_inicio := cast(p_mes || '-01' as date);
  -- Siempre se evalúa el mes completo: el denominador es el total de semanas del mes
  v_fecha_fin := (v_fecha_inicio + interval '1 month - 1 day')::date;

  -- Semanas esperadas: jueves para consumibles, viernes para biológicos
  v_curr_date := v_fecha_inicio;
  while v_curr_date <= v_fecha_fin loop
    v_dow := extract(dow from v_curr_date);
    if v_dow = 4 then
      v_total_month_cons := v_total_month_cons + 1;
    elsif v_dow = 5 then
      v_total_month_bio := v_total_month_bio + 1;
    end if;
    v_curr_date := v_curr_date + 1;
  end loop;

  if v_total_month_cons = 0 then v_total_month_cons := 1; end if;
  if v_total_month_bio = 0 then v_total_month_bio := 1; end if;

  return query
  with active_units as (
    select u.clues::varchar as clues_u, u.municipio::varchar as municipio_u, u.unidad::varchar as unidad_u
    from public.unidades u
    where u.activo = 'SI'
  ),
  bio_counts as (
    select b.clues::varchar as clues_b, count(distinct target_friday) as bio_ok
    from (
      select g.dt::date as target_friday, (g.dt - interval '1 day')::date as target_thursday
      from generate_series(v_fecha_inicio::timestamp, v_fecha_fin::timestamp, '1 day'::interval) g(dt)
      where extract(dow from g.dt) = 5
    ) f
    join public.biologicos_existencia b on (b.fecha = f.target_friday or b.fecha = f.target_thursday)
    group by b.clues
  ),
  cons_counts as (
    select c.clues::varchar as clues_c, count(distinct target_thursday) as cons_ok
    from (
      select g.dt::date as target_thursday, (g.dt - interval '1 day')::date as target_wednesday
      from generate_series(v_fecha_inicio::timestamp, v_fecha_fin::timestamp, '1 day'::interval) g(dt)
      where extract(dow from g.dt) = 4
    ) t
    join public.consumibles c on (c.fecha = t.target_thursday or c.fecha = t.target_wednesday)
    group by c.clues
  ),
  pedido_counts as (
    select distinct p.clues::varchar as clues_p
    from public.biologicos_pedido p
    where p.fecha_captura >= v_fecha_inicio and p.fecha_captura <= v_fecha_fin and p.tipo_pedido = 'MENSUAL'
  ),
  last_captures as (
    select clues_lc, max(max_fecha)::varchar as ult_fecha
    from (
      select b.clues::varchar as clues_lc, max(b.fecha) as max_fecha
      from public.biologicos_existencia b
      where b.fecha >= v_fecha_inicio and b.fecha <= v_fecha_fin
      group by b.clues
      union all
      select c.clues::varchar as clues_lc, max(c.fecha) as max_fecha
      from public.consumibles c
      where c.fecha >= v_fecha_inicio and c.fecha <= v_fecha_fin
      group by c.clues
    ) combo
    group by clues_lc
  )
  select
    au.clues_u as clues,
    au.municipio_u as municipio,
    au.unidad_u as unidad,
    coalesce(bc.bio_ok, 0)::int as bio_semanas_ok,
    coalesce(cc.cons_ok, 0)::int as cons_semanas_ok,
    (pc.clues_p is not null) as pedido_mensual,
    coalesce(lc.ult_fecha, '—')::varchar as ultima_captura,
    v_total_month_bio::int as ebio,
    v_total_month_cons::int as econs
  from active_units au
  left join bio_counts bc on bc.clues_b = au.clues_u
  left join cons_counts cc on cc.clues_c = au.clues_u
  left join pedido_counts pc on pc.clues_p = au.clues_u
  left join last_captures lc on lc.clues_lc = au.clues_u;
end;
$function$;

revoke all on function public.get_history_metrics_rpc(character varying) from public, anon;
grant execute on function public.get_history_metrics_rpc(character varying) to authenticated, service_role;

-- 3) ---------------------------------------------------------------------------------------------------------------
-- Devuelve {"CLUES": ["2026-10-16", ...]} solo con las fechas pedidas que cada unidad sí capturó.
create or replace function public.influenza_capture_hits_rpc(
  p_campana text,
  p_fechas date[],
  p_clues text[] default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_object_agg(clues, fechas), '{}'::jsonb)
  from (
    select c.clues, jsonb_agg(distinct c.fecha order by c.fecha) as fechas
    from public.influenza_capturas c
    where c.anio_campana = p_campana
      and c.fecha = any(p_fechas)
      and (p_clues is null or c.clues = any(p_clues))
    group by c.clues
  ) t;
$$;

revoke all on function public.influenza_capture_hits_rpc(text, date[], text[]) from public, anon;
grant execute on function public.influenza_capture_hits_rpc(text, date[], text[]) to authenticated, service_role;
