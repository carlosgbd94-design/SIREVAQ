-- =============================================================================
-- Influenza: reparto de frascos por entrega (remesa).
--
-- Jurisdicción captura cuántos frascos llegaron en cada entrega y los reparte
-- entre 6 destinos (4 municipios + hospitales HENM y NHG) en proporción a su
-- meta. Cada municipio reparte lo suyo entre sus unidades (mismo cálculo,
-- editable) y eso se guarda en influenza_distribucion_frascos, que ya existía.
--
--  * influenza_remesas: una fila por entrega y campaña. `asignacion` guarda los
--    frascos por destino {"QUERETARO":458,...} y `manual` los destinos que se
--    editaron a mano (para no recalcularlos al volver a abrir).
--  * influenza_guardar_reparto: reemplaza de forma atómica las filas de
--    influenza_distribucion_frascos de un destino y una entrega.
--
-- Los hospitales HENM (QTSSA001740) y NHG (QTSSA002901) son unidades de
-- QUERETARO en `unidades`, pero aquí son destinos aparte con municipio 'HENM' /
-- 'NHG'. Su meta vive en influenza_metas con ese municipio (clues nulo = total
-- del destino; clues propia = lo que ve la unidad al capturar).
-- =============================================================================

create table if not exists public.influenza_remesas (
  id uuid primary key default gen_random_uuid(),
  anio_campana text not null,
  numero_entrega integer not null check (numero_entrega >= 1),
  fecha date not null,
  total_frascos integer not null check (total_frascos >= 0),
  asignacion jsonb not null default '{}'::jsonb,
  manual jsonb not null default '[]'::jsonb,
  creado_por text not null,
  updated_at timestamptz not null default now(),
  unique (anio_campana, numero_entrega)
);

alter table public.influenza_remesas enable row level security;

drop policy if exists "influenza_remesas_select" on public.influenza_remesas;
create policy "influenza_remesas_select" on public.influenza_remesas
  for select to authenticated using (true);

drop policy if exists "influenza_remesas_write_juris" on public.influenza_remesas;
create policy "influenza_remesas_write_juris" on public.influenza_remesas
  for all to authenticated
  using (exists (select 1 from perfiles p
                 where p.id = (select auth.uid()) and p.activo = 'SI'
                   and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p
                      where p.id = (select auth.uid()) and p.activo = 'SI'
                        and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));

create or replace function public.influenza_guardar_reparto(
  p_municipio text,
  p_numero integer,
  p_fecha date,
  p_lote text,
  p_caducidad date,
  p_entregado_por text,
  p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  delete from influenza_distribucion_frascos
   where municipio = p_municipio and numero_entrega = p_numero;

  insert into influenza_distribucion_frascos
    (clues, municipio, cantidad_frascos, fecha_entrega, numero_entrega, entregado_por, lote, fecha_caducidad)
  select r->>'clues', p_municipio, (r->>'cantidad_frascos')::int, p_fecha, p_numero,
         upper(p_entregado_por), nullif(p_lote, ''), p_caducidad
    from jsonb_array_elements(p_rows) r
   where coalesce((r->>'cantidad_frascos')::int, 0) > 0;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.influenza_guardar_reparto(text, integer, date, text, date, text, jsonb) from public, anon;
grant execute on function public.influenza_guardar_reparto(text, integer, date, text, date, text, jsonb) to authenticated;
