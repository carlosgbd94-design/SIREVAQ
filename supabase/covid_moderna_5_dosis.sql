-- =============================================================================
-- Corrección (2026-10-15): un frasco de COVID-19 Moderna rinde 5 dosis de 0.5 mL, no 10.
-- Pfizer sigue en 6. Las metas están en dosis y no cambian; solo la conversión a frascos.
-- Los topes por meta (triggers de covid_remesas y covid_distribucion_frascos, y covid_guardar_reparto)
-- usan esta función, así que la corrección aplica a todos. Lo ya repartido queda dentro de tope.
-- =============================================================================
create or replace function public.covid_dosis_por_frasco(p_marca text)
returns integer language sql immutable as $$
  select case upper(p_marca) when 'MODERNA' then 5 when 'PFIZER' then 6 else null end;
$$;
