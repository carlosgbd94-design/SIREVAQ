-- Ejecutar DESPUES de sis06p_reconciliacion.sql (redefine _sis06p_comparativo_calc con grupos SR+SRP y DPT+TdPa).
-- Grupos de conciliación (regla federal): si se aplica SRP en lugar de SR, en el
-- paloteo se reporta como SR pero en el seguimiento de biológico se da de baja
-- como SRP. Igual DPT / TdPa. Por eso SR+SRP y DPT+TdPa se concilian JUNTOS:
-- lo que sobra en uno es exactamente lo que falta en el otro.
alter table sis_biovac_mapa add column if not exists grupo_conciliacion text;
update sis_biovac_mapa set grupo_conciliacion = sis_biologico;
update sis_biovac_mapa set grupo_conciliacion = 'SR+SRP', etiqueta = 'SR + SRP (se concilian juntas)' where biovac_clave in ('SR','SRP');
update sis_biovac_mapa set grupo_conciliacion = 'DPT+TDPA', etiqueta = 'DPT + TdPa (se concilian juntas)' where biovac_clave in ('DPT','TDPA');
alter table sis_biovac_mapa alter column grupo_conciliacion set not null;

create or replace function _sis06p_comparativo_calc(p_clues text, p_mes int, p_anio int)
returns table (grupo text, etiqueta text, claves text[], paloteo numeric, aplicado numeric)
language sql
stable
security definer
set search_path = public
as $$
  with grupos as (
    select m.grupo_conciliacion as gr, min(m.etiqueta) as etq, array_agg(m.biovac_clave order by m.biovac_clave) as cls
    from sis_biovac_mapa m
    group by m.grupo_conciliacion
  ),
  -- sis_biologico -> grupo (varios biológicos BioVac pueden compartir el mismo
  -- sis_biologico, p. ej. COVID Moderna/Pfizer: se deduplica).
  gsis as (
    select distinct m.sis_biologico as sb, m.grupo_conciliacion as gr from sis_biovac_mapa m
  ),
  palo as (
    select gsis.gr,
           sum(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'total', '')::numeric, 0)
               * case when v.media_dosis then 0.5 else 1 end) as n
    from sis06p_capturas c
    cross join sis_variables v
    join gsis on gsis.sb = v.biologico
    where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio and v.activo
    group by gsis.gr
  ),
  inf as (
    select coalesce(sum(case when kv.value ~ '^[0-9]+(\.[0-9]+)?$' then kv.value::numeric else 0 end), 0) as n
    from influenza_capturas ic
    cross join lateral jsonb_each_text(coalesce(ic.valores, '{}'::jsonb)) kv
    where ic.clues = p_clues
      and extract(month from ic.fecha) = p_mes
      and extract(year from ic.fecha) = p_anio
  ),
  apl as (
    select m.grupo_conciliacion as gr,
           sum(case when cb.regla_especial = 'SPLIT_DOSE'
                    then coalesce(r.aplicadas_a, 0) / 2 + coalesce(r.aplicadas_b, 0)
                    else coalesce(r.aplicadas_a, 0) + coalesce(r.aplicadas_b, 0) end) as n
    from biovac_unidades bu
    join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
    join biovac_renglones r on r.movimiento_id = mv.id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    join sis_biovac_mapa m on m.biovac_clave = cb.clave
    where bu.clues = p_clues
    group by m.grupo_conciliacion
  )
  select g.gr, g.etq, g.cls,
         coalesce(case when g.gr = 'INFLUENZA' then (select n from inf) else palo.n end, 0),
         coalesce(apl.n, 0)
  from grupos g
  left join palo on palo.gr = g.gr
  left join apl on apl.gr = g.gr
  order by g.etq;
$$;

revoke all on function _sis06p_comparativo_calc(text, int, int) from public;
revoke all on function _sis06p_comparativo_calc(text, int, int) from anon;
revoke all on function _sis06p_comparativo_calc(text, int, int) from authenticated;
