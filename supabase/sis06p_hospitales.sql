-- Hospitales HENM y NHG(Q): unidades de Querétaro que se manejan como municipios aparte.
-- Aplicado en Supabase (2026-09-24):
--  1. NHGQ (Nuevo Hospital General de Querétaro) = CLUES QTSSA002901 (confirmado por el usuario). El Hospital
--     General VIEJO era QTSSA001752 (no existe en el catálogo; solo NHGQ debe estar activa). En la hoja DATOS del
--     SINBA la fila del HGQ viejo trae por error QTSSA002901.
update unidades set unidad = 'NHGQ', activo = 'SI' where clues = 'QTSSA002901';
insert into biovac_unidades (jurisdiccion_id, clues, nombre, municipio, activo)
select jurisdiccion_id, 'QTSSA002901', 'NHGQ', 'NHG', true from biovac_unidades where clues = 'JS1-NHG'
on conflict do nothing;

--  2. La unidad (rol UNIDAD) de un hospital puede LEER solo el reparto de su propio destino
--     (la requisición les reparte a nivel destino, no por unidad) para la precarga.
drop policy if exists "requi_dist_muni_select_unidad_hospital" on requi_distribucion_municipio;
create policy "requi_dist_muni_select_unidad_hospital" on requi_distribucion_municipio
for select to authenticated
using (
  exists (
    select 1 from perfiles p join biovac_unidades bu on bu.clues = p.clues
    where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) = 'UNIDAD'
      and bu.municipio = requi_distribucion_municipio.municipio
      and bu.municipio in ('HENM', 'NHG')
  )
);

--  3. sis06p_recibido_vs_requisicion (ver sis06p_concentrado_municipal.sql) incluye ademas a los
--     destinos HENM y NHG (destino con una sola unidad) -- CTE `destinos`.
