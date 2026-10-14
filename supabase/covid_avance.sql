-- =============================================================================
-- COVID-19: avance (dosis aplicadas del SIS) por unidad y rubro, acumulado en un rango de meses.
--
-- Las dosis aplicadas de COVID viven en registros_sis (por unidad, variable y mes; las publica el SIS ya
-- validadas). Esta función las suma por CLUES y variable dentro del rango pedido, respetando la jerarquía:
-- Jurisdicción ve todo, el municipal solo sus municipios y una unidad solo la suya.
--
-- Variables (clave general, igual que los indicadores RDA): VCV38 6-59 meses primera, VCV39 segunda,
-- VCV28 5-59 con riesgo, VCV16 60+, VCV20 embarazadas, VCV21 personal de salud.
-- `ult` = último mes (día 1) con dosis > 0 dentro del rango. Idempotente.
-- =============================================================================

create or replace function public.covid_avance(p_desde date, p_hasta date)
returns table (clues text, variable_sis text, dosis bigint, ult date)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select upper(p.rol) rol, upper(p.municipio) muni, p.clues cl,
           coalesce((select array_agg(upper(trim(x))) from unnest(p.municipios_allowed) x), '{}') permitidos
      from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI')
  select r.clues::text, r.variable_sis::text, sum(r.valor)::bigint,
         max(make_date(r.anio, r.mes, 1)) filter (where r.valor > 0)
    from yo
    join registros_sis r
      on r.variable_sis in ('VCV38', 'VCV39', 'VCV28', 'VCV16', 'VCV20', 'VCV21')
     and make_date(r.anio, r.mes, 1) between date_trunc('month', p_desde)::date and date_trunc('month', p_hasta)::date
    join unidades u on u.clues = r.clues
   where yo.rol in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
      or (yo.rol = 'MUNICIPAL' and (upper(u.municipio) = yo.muni or upper(u.municipio) = any (yo.permitidos) or '*' = any (yo.permitidos)))
      or (yo.rol not in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'MUNICIPAL') and u.clues = yo.cl)
   group by r.clues, r.variable_sis;
$$;

revoke all on function public.covid_avance(date, date) from public, anon;
grant execute on function public.covid_avance(date, date) to authenticated;
