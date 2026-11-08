-- Optimización de BD 2026-11-08 (plan gratuito, instancia compartida).
-- Idempotente. Cambios de rendimiento SIN cambiar quién puede ver/editar qué.
--
-- 1) Índices en llaves foráneas sin índice (advisor 0001): evitan barridos al borrar/actualizar el padre
--    y aceleran los joins por lote / biológico / unidad.
-- 2) RLS (advisor 0003): auth.role()/auth.jwt() envueltos en (select ...) para que se evalúen UNA vez
--    por consulta y no por fila.
-- 3) Políticas duplicadas idénticas en public.unidades (advisor 0006): se quita la copia.
-- 4) is_admin() pasa a STABLE (antes VOLATILE sin necesidad): permite al planificador cachearla.
-- 5) biovac_correcciones_pendientes_lote(uuid[]): una sola llamada en vez de una RPC por unidad
--    (biovac_correcciones_pendientes se llamó 37 mil veces).

-- 1) Índices FK -------------------------------------------------------------------------------------
create index if not exists idx_aperturas_consumibles_created_by      on public.aperturas_consumibles (created_by);
create index if not exists idx_biovac_correcciones_renglon           on public.biovac_correcciones (renglon_id);
create index if not exists idx_biovac_corr_municipio_lote            on public.biovac_correcciones_municipio (lote_id);
create index if not exists idx_biovac_unidades_jurisdiccion          on public.biovac_unidades (jurisdiccion_id);
create index if not exists idx_registros_sis_clues_anio_mes          on public.registros_sis (clues, anio, mes);
create index if not exists idx_requi_cat_bio_biovac_biologico        on public.requi_catalogo_biologicos (biovac_biologico_id);
create index if not exists idx_requi_dist_muni_lote                  on public.requi_distribucion_municipio (lote_id);
create index if not exists idx_requi_dist_muni_requi_bio             on public.requi_distribucion_municipio (requi_biologico_id);
create index if not exists idx_requi_dist_unidad_lote                on public.requi_distribucion_unidad (lote_id);
create index if not exists idx_requi_dist_unidad_requi_bio           on public.requi_distribucion_unidad (requi_biologico_id);
create index if not exists idx_requi_dist_unidad_unidad              on public.requi_distribucion_unidad (unidad_id);
create index if not exists idx_requi_items_juris_lote                on public.requi_items_jurisdiccion (lote_id);
create index if not exists idx_requi_items_juris_requi_bio           on public.requi_items_jurisdiccion (requi_biologico_id);

-- 2) RLS: initplan ---------------------------------------------------------------------------------
alter policy "RLS_unidades_Read"                  on public.unidades                       using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_biologicos_catalogo_Read"       on public.biologicos_catalogo            using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_calendario_pedidos_Read"        on public.calendario_pedidos             using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_lotes_Read"                     on public.lotes                          using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_aperturas_consumibles_Read"     on public.aperturas_consumibles          using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_influenza_metas_Read"           on public.influenza_metas                using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_influenza_capturas_Read"        on public.influenza_capturas             using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_influenza_frascos_Read"         on public.influenza_distribucion_frascos using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_sis_variables_Read"             on public.sis_variables                  using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_sis06p_capturas_Read"           on public.sis06p_capturas                using ((select auth.role()) = 'authenticated'::text);
alter policy "RLS_biologico_sis_variable_mapping_Read" on public.biologico_sis_variable_mapping using ((select auth.role()) = 'authenticated'::text);
alter policy "Admins pueden modificar aperturas existencia" on public.aperturas_existencia using ((((select auth.jwt()) ->> 'rol'::text)) = 'ADMIN'::text);

-- 3) Duplicados exactos en public.unidades (misma condición que RLS_unidades_Read / RLS_unidades_Write_Admin)
drop policy if exists "Unidades select policy"    on public.unidades;
drop policy if exists "Unidades admin all policy" on public.unidades;

-- 4) is_admin() estable ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN');
$$;

-- 5) Correcciones pendientes de varias unidades en UNA llamada -----------------------------------------
create or replace function public.biovac_correcciones_pendientes_lote(p_unidad_ids uuid[])
returns table(
  unidad_id uuid, correccion_id uuid, movimiento_id uuid, anio integer, mes integer,
  biologico text, numero_lote text, categoria text, campo text,
  valor_anterior text, valor_nuevo text, usuario text, motivo text, creado_en timestamp with time zone
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select m.unidad_id, c.id, m.id, m.anio, m.mes,
         cb.nombre_excel, l.numero_lote, r.categoria,
         c.campo, c.valor_anterior, c.valor_nuevo,
         c.usuario, c.motivo, c.creado_en
  from biovac_correcciones c
  join biovac_movimientos m on m.id = c.movimiento_id
  left join biovac_renglones r on r.id = c.renglon_id
  left join biovac_lotes l on l.id = r.lote_id
  left join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where m.unidad_id = any (p_unidad_ids)
    and c.tipo = 'CORRECCION_JURISDICCIONAL'
    and c.reconocido_por_municipal = false
    and c.campo is not null
  order by c.creado_en desc;
$$;

revoke all on function public.biovac_correcciones_pendientes_lote(uuid[]) from public, anon;
grant execute on function public.biovac_correcciones_pendientes_lote(uuid[]) to authenticated;
