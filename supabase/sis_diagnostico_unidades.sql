-- =============================================================================
-- Asistente de revisión del municipal: evidencia por unidad.
--
-- SOLO LECTURA. No modifica ningún dato. Devuelve, para el municipio/mes, lo que
-- declaró cada unidad en los lotes donde el Movimiento del municipio y la suma de
-- sus unidades NO coinciden (misma comparación que biovac_discrepancias_municipio),
-- para que el motor de diagnóstico del cliente (diagnostico_sis.js) pueda decir
-- QUÉ unidad declaró la existencia en otro lote / otro estatus.
--
-- Mismo alcance y guardia de rol que biovac_discrepancias_municipio.
-- =============================================================================

create or replace function public.biovac_diagnostico_unidades(p_municipio text, p_mes integer, p_anio integer)
returns table (
  lote_id uuid, numero_lote text, biologico text, categoria text,
  unidad text, clues text,
  anterior numeric, recibido numeric, aplicado numeric, desechado numeric, final numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_perfil perfiles%rowtype; v_rol text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then return; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'VISUALIZADOR_JURISDICCIONAL') then return; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then return; end if;
  if p_municipio in ('NHG', 'HENM') then return; end if;

  return query
  with mun as (
    select r.lote_id, r.categoria,
           r.existencia_anterior_frascos ant, r.recibido_frascos rec,
           r.aplicadas_a + r.aplicadas_b apl, r.desechadas_a + r.desechadas_b des
    from biovac_renglones r
    join biovac_movimientos m on m.id = r.movimiento_id
    join biovac_unidades u on u.id = m.unidad_id
    where u.municipio = p_municipio and u.clues like 'JS1-%' and m.anio = p_anio and m.mes = p_mes
  ), un as materialized (
    -- _sis06p_unidad_omitida se evalúa UNA vez por unidad (no por renglón): de ~5 s a una fracción
    select bu.id, bu.nombre, bu.clues
    from biovac_unidades bu
    where bu.municipio = p_municipio and bu.clues not like 'JS1-%' and bu.activo
      and not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes)
  ), det as (
    select rn.lote_id, rn.categoria, un.nombre, un.clues,
           rn.existencia_anterior_frascos ant, rn.recibido_frascos rec,
           rn.aplicadas_a + rn.aplicadas_b apl, rn.desechadas_a + rn.desechadas_b des,
           rn.existencia_final_frascos fin
    from biovac_movimientos um
    join un on un.id = um.unidad_id
    join biovac_renglones rn on rn.movimiento_id = um.id
    where um.anio = p_anio and um.mes = p_mes and um.estado = 'CERRADO'
  ), agg as (
    select d.lote_id, d.categoria, sum(d.ant) ant, sum(d.rec) rec, sum(d.apl) apl, sum(d.des) des
    from det d group by d.lote_id, d.categoria
  ), dif as (
    select coalesce(m.lote_id, a.lote_id) lid, coalesce(m.categoria, a.categoria) cat
    from mun m full join agg a on a.lote_id = m.lote_id and a.categoria = m.categoria
    where abs(coalesce(m.ant, 0) - coalesce(a.ant, 0)) > 0.001
       or abs(coalesce(m.rec, 0) - coalesce(a.rec, 0)) > 0.001
       or abs(coalesce(m.apl, 0) - coalesce(a.apl, 0)) > 0.001
       or abs(coalesce(m.des, 0) - coalesce(a.des, 0)) > 0.001
  )
  select dd.lote_id, l.numero_lote, cb.nombre_excel, dd.categoria, dd.nombre, dd.clues,
         dd.ant, dd.rec, dd.apl, dd.des, dd.fin
  from dif
  join det dd on dd.lote_id = dif.lid and dd.categoria = dif.cat
  join biovac_lotes l on l.id = dd.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where dd.ant <> 0 or dd.rec <> 0 or dd.apl <> 0 or dd.des <> 0 or dd.fin <> 0
  order by cb.nombre_excel, l.numero_lote, dd.categoria, dd.nombre;
end;
$function$;

revoke all on function public.biovac_diagnostico_unidades(text, integer, integer) from public, anon;
grant execute on function public.biovac_diagnostico_unidades(text, integer, integer) to authenticated;
