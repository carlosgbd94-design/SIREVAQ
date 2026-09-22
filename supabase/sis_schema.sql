-- ============================================================================
-- SIS (SINBA) — Fase 1: catálogo de variables + captura diaria de SIS-06-P
-- (Registro de Aplicación de Biológicos, Primera Parte).
--
-- La unidad de salud (CLUES) llena esta hoja a diario ("paloteo"): cada día
-- se registra cuántas dosis de cada (biológico, grupo poblacional, dosis) se
-- aplicaron, con Afromexicano/Indígena/Migrante como subconteos SOLO
-- ilustrativos (subconjunto del total, NUNCA se suman aparte). La semana y
-- el mes se obtienen sumando los días -- nunca se capturan ni se guardan por
-- separado, mismo criterio que ya usa el resto de SIREVAQ (nada se duplica
-- si se puede calcular).
--
-- SIS-SS-CE-H-2026 (el reporte oficial con las claves SIS) es 100% derivado
-- de esta captura -- se genera, no se captura aparte.
--
-- El catálogo (sis_variables) se extrajo y verificó cruzando el archivo
-- oficial SINBA-VER_26_2026.xlsx (plantilla vacía) contra un ejemplo real
-- lleno (LOMAS.xlsx): 104 combinaciones biológico+grupo poblacional+dosis,
-- 94 de ellas con su clave oficial SIS ya confirmada contra las fórmulas de
-- SIS-SS-CE-H-2026 (las 10 restantes -- sueros/faboterápicos/"otros
-- biológicos" -- no alimentan ese reporte). Ver sis_variables_seed.sql.
-- ============================================================================

create table if not exists sis_variables (
  id uuid primary key default gen_random_uuid(),
  fila_excel int not null unique,
  biologico text not null,
  grupo_poblacional text,
  dosis text,
  -- Columna D real de SINBA-SIS-06-P cuando trae información nueva aparte
  -- de biologico/grupo_poblacional/dosis (franja de edad) -- p.ej. VPH
  -- violación sexual, Td embarazadas/población. Null cuando esa columna no
  -- aporta nada nuevo (solo repite B/C). Ver sis_variables_add_edad_y_
  -- corrige_dosis (migración) para el porqué.
  edad text,
  clave_general text unique,
  clave_afro text,
  clave_indigena text,
  clave_migrante text,
  orden int not null,
  activo boolean not null default true
);

create index if not exists idx_sis_variables_biologico on sis_variables(biologico);

-- Captura MENSUAL por CLUES -- un renglón por (unidad, mes, año), con un jsonb
-- {fila_excel: {total, afro, indigena, migrante}} por variable, mismo patrón
-- que influenza_capturas.valores. La unidad captura su concentrado completo
-- una vez al mes (NO por día -- descartado explícitamente: el paloteo diario
-- se queda en papel/Excel de la unidad, solo el concentrado mensual entra a
-- SIREVAQ). Afromexicano/Indígena/Migrante son subconteos ILUSTRATIVOS,
-- subconjunto del total -- nunca se suman aparte (total=40, afro=20 -> el
-- total sigue siendo 40).
create table if not exists sis06p_capturas (
  id uuid primary key default gen_random_uuid(),
  clues text not null,
  unidad text,
  municipio text,
  mes int not null check (mes between 1 and 12),
  anio int not null check (anio >= 2020 and anio <= 2100),
  valores jsonb not null default '{}'::jsonb,
  capturado_por text,
  editado_por text,
  historial_ediciones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (clues, mes, anio)
);

create index if not exists idx_sis06p_capturas_clues_mes_anio on sis06p_capturas(clues, mes, anio);
create index if not exists idx_sis06p_capturas_municipio_mes_anio on sis06p_capturas(municipio, mes, anio);

alter table sis_variables enable row level security;
alter table sis06p_capturas enable row level security;

drop policy if exists "RLS_sis_variables_Read" on sis_variables;
create policy "RLS_sis_variables_Read" on sis_variables for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "RLS_sis_variables_Write_Admin" on sis_variables;
create policy "RLS_sis_variables_Write_Admin" on sis_variables for all to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) in ('ADMIN','JURISDICCIONAL')))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) in ('ADMIN','JURISDICCIONAL')));

-- Mismo patrón exacto que influenza_capturas: lectura para cualquier
-- autenticado, escritura ADMIN/JURISDICCIONAL sin restricción, MUNICIPAL
-- solo su(s) municipio(s) asignado(s), UNIDAD solo su propio CLUES.
drop policy if exists "RLS_sis06p_capturas_Read" on sis06p_capturas;
create policy "RLS_sis06p_capturas_Read" on sis06p_capturas for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "RLS_sis06p_capturas_Write_Admin" on sis06p_capturas;
create policy "RLS_sis06p_capturas_Write_Admin" on sis06p_capturas for all to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) in ('ADMIN','JURISDICCIONAL')))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) in ('ADMIN','JURISDICCIONAL')));

drop policy if exists "RLS_sis06p_capturas_Write_Municipal" on sis06p_capturas;
create policy "RLS_sis06p_capturas_Write_Municipal" on sis06p_capturas for all to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'MUNICIPAL' and sis06p_capturas.municipio = any(perfiles.municipios_allowed)))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'MUNICIPAL' and sis06p_capturas.municipio = any(perfiles.municipios_allowed)));

drop policy if exists "RLS_sis06p_capturas_Write_Unidad" on sis06p_capturas;
create policy "RLS_sis06p_capturas_Write_Unidad" on sis06p_capturas for all to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'UNIDAD' and perfiles.clues = sis06p_capturas.clues))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'UNIDAD' and perfiles.clues = sis06p_capturas.clues));
