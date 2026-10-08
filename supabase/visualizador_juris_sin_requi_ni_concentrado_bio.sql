-- VISUALIZADOR_JURISDICCIONAL ya no lee Requisiciones ni lo exclusivo del Concentrado Biologico.
-- No se tocan biovac_unidades / biovac_movimientos / biovac_renglones / catalogos biovac:
-- los usa el concentrado SIS (sis06p_*), al que este perfil si tiene acceso.
create or replace function public.es_visualizador_juris()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and upper(p.rol) = 'VISUALIZADOR_JURISDICCIONAL');
$$;
revoke all on function public.es_visualizador_juris() from public, anon;
grant execute on function public.es_visualizador_juris() to authenticated;

do $$
declare r record; nuevo text;
begin
  for r in
    select tablename, policyname, qual from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and (tablename, policyname) in (
      ('requi_catalogo_biologicos','requi_catalogo_select'),
      ('requi_distribucion_municipio','requi_dist_muni_select'),
      ('requi_distribucion_unidad','requi_dist_unidad_select'),
      ('requi_firmas','requi_firmas_select'),
      ('requi_items_jurisdiccion','requi_items_juris_select'),
      ('requi_lotes','requi_lotes_select'),
      ('requi_lotes_mapa_biologico','requi_lotes_mapa_select'),
      ('requi_pdf_generados','requi_pdf_select'),
      ('requi_pedido_equivalencias','requi_pedido_equivalencias_select'),
      ('requi_requisiciones','requi_requisiciones_select'),
      ('requi_unidades','requi_unidades_select'),
      ('biovac_correcciones','biovac_correcciones_select'),
      ('biovac_correcciones_municipio','biovac_corr_muni_select'),
      ('biovac_informes_jurisdiccionales','biovac_informes_select'),
      ('biovac_movimientos_jurisdiccionales','biovac_mov_jurisdiccion_select'))
  loop
    nuevo := case when r.qual = 'true' then 'NOT public.es_visualizador_juris()'
                  else '(' || r.qual || ') AND NOT public.es_visualizador_juris()' end;
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, nuevo);
  end loop;
end $$;

-- Lectura de capturas para el visualizador (resumen, existencia, SIS): solo SELECT.
do $$
declare t text;
begin
  foreach t in array array['biologicos_existencia','consumibles','existencia_detalle','calendario_pedidos','biologicos_params','biologicos_params_sugeridos','jeringas_params','registros_sis','unidades_medicas','sis06p_correcciones']
  loop
    execute format('drop policy if exists "Select %1$s Visualizador Jurisdiccional" on public.%1$I', t);
    execute format('create policy "Select %1$s Visualizador Jurisdiccional" on public.%1$I for select to authenticated using (public.es_visualizador_juris())', t);
  end loop;
end $$;
