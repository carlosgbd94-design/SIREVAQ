-- =============================================================================
-- Calendario anual de capacitaciones.
-- ADMIN / JURISDICCIONAL registran fecha, tema y sede; todos los usuarios
-- autenticados (UNIDAD incluida) lo consultan. Distinto de `capacitaciones`
-- (aperturas de evidencia): esto es solo la agenda del año.
-- =============================================================================
create table if not exists public.calendario_capacitaciones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  tema text not null check (length(btrim(tema)) > 0),
  sede text not null check (length(btrim(sede)) > 0),
  direccion text,
  modalidad text not null default 'PRESENCIAL' check (modalidad in ('PRESENCIAL','VIRTUAL','MIXTA')),
  dirigido_a text,
  notas text,
  activo boolean not null default true,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendario_capacitaciones_fecha_idx
  on public.calendario_capacitaciones (fecha);

alter table public.calendario_capacitaciones enable row level security;

drop policy if exists "cal_cap_select" on public.calendario_capacitaciones;
create policy "cal_cap_select" on public.calendario_capacitaciones
  for select to authenticated using (true);

drop policy if exists "cal_cap_write_juris" on public.calendario_capacitaciones;
create policy "cal_cap_write_juris" on public.calendario_capacitaciones
  for all to authenticated
  using (exists (select 1 from perfiles p
                 where p.id = (select auth.uid()) and p.activo = 'SI'
                   and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p
                      where p.id = (select auth.uid()) and p.activo = 'SI'
                        and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));
