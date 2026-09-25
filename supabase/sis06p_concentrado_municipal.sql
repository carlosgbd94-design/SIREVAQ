-- =============================================================================
-- Concentrado municipal (solo lectura) -- se arma SOLO desde las unidades:
--   * sis06p_recibido_vs_requisicion: la requisición municipal (lo que llegó al
--     municipio, ya repartido por unidad) debe coincidir con la SUMA de lo que
--     las unidades capturaron como "recibido", por biológico + lote + caducidad.
--   * sis06p_seguimiento_biologico: hoja "SEGUIMIENTO DE BIOLOGICO" del Excel
--     municipal -- por unidad y biológico, SIN lotes: existencia anterior
--     (frascos), recibido (frascos), aplicado (dosis), desperdicio (dosis) y
--     existencia al corte (frascos), sumando todos los lotes/categorías.
--   Aplicado/desperdicio en dosis EQUIVALENTES (SPLIT_DOSE: a/2 + b), igual que
--   la conciliación y que la columna VALIDACIÓN del Excel municipal.
-- Alcance por rol real (auth.uid()), nunca un parámetro del cliente.
-- =============================================================================

create or replace function sis06p_recibido_vs_requisicion(p_mes int, p_anio int, p_municipio text default null)
returns table (
  municipio text, biologico text, numero_lote text,
  caducidad_requisicion date, caducidad_unidades date,
  requisicion numeric, unidades numeric, coincide boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios text[];
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null or v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN','VISUALIZADOR_JURISDICCIONAL') then
    raise exception 'Rol % no puede ver la conciliación con la requisición.', coalesce(v_rol, 'desconocido');
  end if;

  return query
  with req as (
    select dm.municipio as mun, cb.biovac_biologico_id as bid, min(cb.nombre) as bname,
           lo.numero_lote as lote, min(lo.caducidad) as cad, sum(dm.cantidad) as q
    from requi_requisiciones rq
    join requi_distribucion_municipio dm on dm.requisicion_id = rq.id
    join requi_catalogo_biologicos cb on cb.id = dm.requi_biologico_id
    join requi_lotes lo on lo.id = dm.lote_id
    where rq.anio = p_anio and rq.mes = p_mes
      and dm.cantidad <> 0
      and cb.biovac_biologico_id is not null
      -- solo municipios que reparten a unidades (requi_unidades): los hospitales
      -- (NHG, HENM) se surten directo, no por unidades
      and dm.municipio in (select ru.municipio from requi_unidades ru)
    group by dm.municipio, cb.biovac_biologico_id, lo.numero_lote
  ),
  uni as (
    select bu.municipio as mun, l.biologico_id as bid, l.numero_lote as lote,
           min(l.caducidad) as cad, sum(r.recibido_frascos) as q
    from biovac_unidades bu
    join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
    join biovac_renglones r on r.movimiento_id = mv.id
    join biovac_lotes l on l.id = r.lote_id
    where bu.activo = true and bu.clues not like 'JS1-%'
      and bu.municipio in (select ru.municipio from requi_unidades ru)
      and r.categoria = 'NORMAL' and coalesce(r.recibido_frascos, 0) <> 0
    group by bu.municipio, l.biologico_id, l.numero_lote
  )
  select coalesce(req.mun, uni.mun),
         coalesce(req.bname, cbb.nombre_excel),
         coalesce(req.lote, uni.lote),
         req.cad, uni.cad,
         coalesce(req.q, 0), coalesce(uni.q, 0),
         (coalesce(req.q, 0) = coalesce(uni.q, 0) and (req.cad is null or uni.cad is null or req.cad = uni.cad))
  from req
  full join uni on uni.mun = req.mun and uni.bid = req.bid and uni.lote = req.lote
  left join biovac_catalogo_biologicos cbb on cbb.id = uni.bid
  where (p_municipio is null or coalesce(req.mun, uni.mun) = p_municipio)
    and (v_rol <> 'MUNICIPAL' or coalesce(req.mun, uni.mun) = any(v_municipios))
  order by 1, 2, 3;
end;
$$;

revoke all on function sis06p_recibido_vs_requisicion(int, int, text) from public;
revoke all on function sis06p_recibido_vs_requisicion(int, int, text) from anon;
grant execute on function sis06p_recibido_vs_requisicion(int, int, text) to authenticated;

create or replace function sis06p_seguimiento_biologico(p_municipio text, p_mes int, p_anio int)
returns table (
  clues text, unidad text, movimiento_estado text,
  biovac_clave text, biologico text,
  existencia_anterior numeric, recibido numeric,
  aplicado numeric, desperdicio numeric, existencia_corte numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios text[];
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null or v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN','VISUALIZADOR_JURISDICCIONAL') then
    raise exception 'Rol % no puede ver el seguimiento de biológico.', coalesce(v_rol, 'desconocido');
  end if;
  if v_rol = 'MUNICIPAL' and not (p_municipio = any(v_municipios)) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;

  return query
  select bu.clues, bu.nombre, mv.estado, cb.clave, cb.nombre_excel,
         sum(coalesce(r.existencia_anterior_frascos, 0)),
         sum(coalesce(r.recibido_frascos, 0)),
         sum(case when cb.regla_especial = 'SPLIT_DOSE'
                  then coalesce(r.aplicadas_a, 0) / 2 + coalesce(r.aplicadas_b, 0)
                  else coalesce(r.aplicadas_a, 0) + coalesce(r.aplicadas_b, 0) end),
         sum(case when cb.regla_especial = 'SPLIT_DOSE'
                  then coalesce(r.desechadas_a, 0) / 2 + coalesce(r.desechadas_b, 0)
                  else coalesce(r.desechadas_a, 0) + coalesce(r.desechadas_b, 0) end),
         sum(coalesce(r.existencia_final_frascos, 0))
  from biovac_unidades bu
  join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
  join biovac_renglones r on r.movimiento_id = mv.id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where bu.activo = true and bu.clues not like 'JS1-%' and bu.municipio = p_municipio
  group by bu.clues, bu.nombre, mv.estado, cb.clave, cb.nombre_excel
  order by bu.clues, cb.clave;
end;
$$;

revoke all on function sis06p_seguimiento_biologico(text, int, int) from public;
revoke all on function sis06p_seguimiento_biologico(text, int, int) from anon;
grant execute on function sis06p_seguimiento_biologico(text, int, int) to authenticated;
