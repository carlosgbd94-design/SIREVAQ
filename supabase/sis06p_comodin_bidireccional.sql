-- =============================================================================
-- COMODÍN BIDIRECCIONAL. Ejecutar DESPUÉS de sis06p_comodin.sql.
-- Además de SRP_COMO_SR / TDPA_COMO_DPT (paloteo reporta la vacuna "base" pero
-- se usó la otra), ahora también el sentido contrario:
--     SR_COMO_SRP   : se aplicó SR y en el paloteo se reportó como SRP
--     DPT_COMO_TDPA : se aplicó DPT y en el paloteo se reportó como TdPa
-- Cuentas (A = SR/DPT, B = SRP/TdPa; n_fwd = B reportada como A; n_rev = A
-- reportada como B):
--     A: paloteo A + n_rev = aplicado A + n_fwd
--     B: paloteo B + n_fwd = aplicado B + n_rev
-- Guardas: n_fwd <= min(paloteo A, aplicado B); n_rev <= min(paloteo B, aplicado A).
-- Si se excede, se IGNORA y la etiqueta lo dice (la diferencia sigue marcada).
-- =============================================================================

create or replace function sis06p_trg_05_valida_ajustes() returns trigger
language plpgsql
as $$
declare
  v_key text;
  v_val text;
begin
  for v_key in select jsonb_object_keys(coalesce(new.ajustes, '{}'::jsonb)) loop
    if v_key not in ('SRP_COMO_SR', 'TDPA_COMO_DPT', 'SR_COMO_SRP', 'DPT_COMO_TDPA') then
      raise exception 'Ajuste desconocido: %.', v_key;
    end if;
    v_val := new.ajustes ->> v_key;
    if v_val is null or v_val !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'El ajuste % debe ser un número mayor o igual a 0.', v_key;
    end if;
  end loop;
  return new;
end;
$$;

-- Etiqueta de auditoría (sis06p_correcciones.detalle) para las 4 llaves. Se
-- parcha la función vigente en la base para no pisar cambios posteriores.
do $$
declare
  d text;
  viejo text := $q$case v_key when 'SRP_COMO_SR' then 'Ajuste: SRP aplicada como SR' else 'Ajuste: TdPa aplicada como DPT' end$q$;
  nuevo text := $q$case v_key when 'SRP_COMO_SR' then 'Ajuste: SRP aplicada como SR' when 'SR_COMO_SRP' then 'Ajuste: SR aplicada como SRP' when 'DPT_COMO_TDPA' then 'Ajuste: DPT aplicada como TdPa' else 'Ajuste: TdPa aplicada como DPT' end$q$;
begin
  d := pg_get_functiondef('sis06p_trg_10_bloqueo_y_auditoria()'::regprocedure);
  if position(viejo in d) = 0 then
    raise exception 'sis06p_trg_10_bloqueo_y_auditoria: no se encontró la etiqueta esperada.';
  end if;
  execute replace(d, viejo, nuevo);
end $$;

create or replace function _sis06p_comparativo_calc(p_clues text, p_mes int, p_anio int)
returns table (grupo text, etiqueta text, claves text[], paloteo numeric, aplicado numeric,
               ajuste_paloteo numeric, ajuste_aplicado numeric)
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
  ),
  base as (
    select g.gr, g.etq, g.cls,
           coalesce(case when g.gr = 'INFLUENZA' then (select n from inf) else palo.n end, 0) as p,
           coalesce(apl.n, 0) as a
    from grupos g
    left join palo on palo.gr = g.gr
    left join apl on apl.gr = g.gr
  ),
  aj as (
    select coalesce(nullif(c.ajustes ->> 'SRP_COMO_SR', '')::numeric, 0)   as f1,  -- SRP reportada como SR
           coalesce(nullif(c.ajustes ->> 'SR_COMO_SRP', '')::numeric, 0)   as r1,  -- SR reportada como SRP
           coalesce(nullif(c.ajustes ->> 'TDPA_COMO_DPT', '')::numeric, 0) as f2,  -- TdPa reportada como DPT
           coalesce(nullif(c.ajustes ->> 'DPT_COMO_TDPA', '')::numeric, 0) as r2   -- DPT reportada como TdPa
    from (select 1) x
    left join sis06p_capturas c on c.clues = p_clues and c.mes = p_mes and c.anio = p_anio
  ),
  ef as (
    select aj.f1, aj.r1, aj.f2, aj.r2,
           case when aj.f1 > 0 and aj.f1 <= least((select p from base where cls = array['SR']::text[]),
                                                 (select a from base where cls = array['SRP']::text[])) then aj.f1 else 0 end as n1,
           case when aj.r1 > 0 and aj.r1 <= least((select p from base where cls = array['SRP']::text[]),
                                                 (select a from base where cls = array['SR']::text[])) then aj.r1 else 0 end as m1,
           case when aj.f2 > 0 and aj.f2 <= least((select p from base where cls = array['DPT']::text[]),
                                                 (select a from base where cls = array['TDPA']::text[])) then aj.f2 else 0 end as n2,
           case when aj.r2 > 0 and aj.r2 <= least((select p from base where cls = array['TDPA']::text[]),
                                                 (select a from base where cls = array['DPT']::text[])) then aj.r2 else 0 end as m2
    from aj
  ),
  fin as (
    select b.gr, b.etq, b.cls, b.p, b.a, ef.*,
           -- lo que el comodín suma al paloteo / al aplicado de este grupo
           case when b.cls = array['SRP']::text[] then ef.n1 when b.cls = array['SR']::text[] then ef.m1
                when b.cls = array['TDPA']::text[] then ef.n2 when b.cls = array['DPT']::text[] then ef.m2 else 0 end as add_p,
           case when b.cls = array['SR']::text[] then ef.n1 when b.cls = array['SRP']::text[] then ef.m1
                when b.cls = array['DPT']::text[] then ef.n2 when b.cls = array['TDPA']::text[] then ef.m2 else 0 end as add_a
    from base b cross join ef
  )
  select f.gr,
         f.etq || case
           when f.cls = array['SR']::text[]   and (f.n1 > 0 or f.m1 > 0) then
             ' ' || trim(both ' ' from (case when f.n1 > 0 then format(' (+%s de SRP aplicadas como SR)', trim_scale(f.n1)) else '' end
                              || case when f.m1 > 0 then format(' (+%s de SR reportadas como SRP)', trim_scale(f.m1)) else '' end))
           when f.cls = array['SRP']::text[]  and (f.n1 > 0 or f.m1 > 0) then
             ' ' || trim(both ' ' from (case when f.n1 > 0 then format(' (+%s aplicadas como SR)', trim_scale(f.n1)) else '' end
                              || case when f.m1 > 0 then format(' (+%s de SR reportadas como SRP)', trim_scale(f.m1)) else '' end))
           when f.cls = array['DPT']::text[]  and (f.n2 > 0 or f.m2 > 0) then
             ' ' || trim(both ' ' from (case when f.n2 > 0 then format(' (+%s de TdPa aplicadas como DPT)', trim_scale(f.n2)) else '' end
                              || case when f.m2 > 0 then format(' (+%s de DPT reportadas como TdPa)', trim_scale(f.m2)) else '' end))
           when f.cls = array['TDPA']::text[] and (f.n2 > 0 or f.m2 > 0) then
             ' ' || trim(both ' ' from (case when f.n2 > 0 then format(' (+%s aplicadas como DPT)', trim_scale(f.n2)) else '' end
                              || case when f.m2 > 0 then format(' (+%s de DPT reportadas como TdPa)', trim_scale(f.m2)) else '' end))
           else '' end
         || case
           when f.cls in (array['SR']::text[], array['SRP']::text[]) and ((f.f1 > 0 and f.n1 = 0) or (f.r1 > 0 and f.m1 = 0)) then ' (comodín inválido: mayor a lo capturado)'
           when f.cls in (array['DPT']::text[], array['TDPA']::text[]) and ((f.f2 > 0 and f.n2 = 0) or (f.r2 > 0 and f.m2 = 0)) then ' (comodín inválido: mayor a lo capturado)'
           else '' end,
         f.cls,
         f.p + f.add_p,
         f.a + f.add_a,
         f.add_p,
         f.add_a
  from fin f
  order by f.etq;
$$;

revoke all on function _sis06p_comparativo_calc(text, int, int) from public;
revoke all on function _sis06p_comparativo_calc(text, int, int) from anon;
revoke all on function _sis06p_comparativo_calc(text, int, int) from authenticated;
