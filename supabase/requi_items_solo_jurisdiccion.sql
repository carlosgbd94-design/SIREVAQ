-- ============================================================================
-- Requisiciones: "lo surtido" por la jurisdicción (requi_items_jurisdiccion) ya NO se lee a
-- tabla abierta. Antes cualquier perfil activo (municipal, unidad...) podía consultar por la API las
-- cantidades surtidas de TODOS los biológicos y lotes aunque la pantalla no se las mostrara.
--
--  * La tabla solo se lee por jurisdicción: ADMIN, JURISDICCIONAL y VISUALIZADOR_JURISDICCIONAL.
--  * Municipal/Unidad leen los lotes (número y caducidad, que necesitan para su requisición) por
--    requi_items_de_requisicion(), que solo devuelve los lotes que les repartieron y SIN la cantidad
--    surtida total (cantidad_surtida = null).
-- La escritura no cambia (ADMIN / JURISDICCIONAL).
-- ============================================================================

create or replace function public.requi_es_juris_lectura()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles p
     where p.id = (select auth.uid()) and p.activo = 'SI'
       and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL'));
$$;
revoke all on function public.requi_es_juris_lectura() from public, anon;
grant execute on function public.requi_es_juris_lectura() to authenticated;

drop policy if exists requi_items_juris_select on public.requi_items_jurisdiccion;
create policy requi_items_juris_select on public.requi_items_jurisdiccion for select to authenticated
  using (public.requi_es_juris_lectura());

create or replace function public.requi_items_de_requisicion(p_requisicion uuid)
returns table (
  id uuid, requisicion_id uuid, requi_biologico_id uuid, lote_id uuid, cantidad_surtida numeric,
  created_at timestamptz, updated_at timestamptz, numero_lote text, caducidad date
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_rol text; v_clues text; v_munis text[];
begin
  select upper(p.rol), p.clues,
         array(select trim(x) from unnest(
                 coalesce(string_to_array(p.municipio_asignado::text, ','), '{}')
                 || coalesce(p.municipios_allowed, '{}')
                 || coalesce(string_to_array(p.municipio, ','), '{}')) x where trim(x) <> '')
    into v_rol, v_clues, v_munis
    from public.perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null then return; end if;

  if v_rol in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL') then
    return query
      select i.id, i.requisicion_id, i.requi_biologico_id, i.lote_id, i.cantidad_surtida,
             i.created_at, i.updated_at, l.numero_lote, l.caducidad
        from public.requi_items_jurisdiccion i join public.requi_lotes l on l.id = i.lote_id
       where i.requisicion_id = p_requisicion order by i.created_at;
    return;
  end if;

  -- Municipal / Unidad: solo los lotes que les repartieron, sin la cantidad total surtida.
  return query
    select i.id, i.requisicion_id, i.requi_biologico_id, i.lote_id, null::numeric,
           i.created_at, i.updated_at, l.numero_lote, l.caducidad
      from public.requi_items_jurisdiccion i join public.requi_lotes l on l.id = i.lote_id
     where i.requisicion_id = p_requisicion
       and (
         (v_rol = 'MUNICIPAL' and (
            exists (select 1 from public.requi_distribucion_municipio d
                     where d.requisicion_id = i.requisicion_id and d.requi_biologico_id = i.requi_biologico_id
                       and d.lote_id = i.lote_id and d.municipio = any (v_munis))
            or exists (select 1 from public.requi_distribucion_unidad d join public.requi_unidades u on u.id = d.unidad_id
                        where d.requisicion_id = i.requisicion_id and d.requi_biologico_id = i.requi_biologico_id
                          and d.lote_id = i.lote_id and u.municipio = any (v_munis))))
         or (v_rol = 'UNIDAD' and (
            exists (select 1 from public.requi_distribucion_unidad d join public.requi_unidades u on u.id = d.unidad_id
                     where d.requisicion_id = i.requisicion_id and d.requi_biologico_id = i.requi_biologico_id
                       and d.lote_id = i.lote_id and u.clues = v_clues)
            or exists (select 1 from public.requi_distribucion_municipio d join public.biovac_unidades bu on bu.municipio = d.municipio
                        where d.requisicion_id = i.requisicion_id and d.requi_biologico_id = i.requi_biologico_id
                          and d.lote_id = i.lote_id and bu.clues = v_clues and d.municipio in ('HENM', 'NHG'))))
       )
     order by i.created_at;
end;
$$;
revoke all on function public.requi_items_de_requisicion(uuid) from public, anon;
grant execute on function public.requi_items_de_requisicion(uuid) to authenticated;
