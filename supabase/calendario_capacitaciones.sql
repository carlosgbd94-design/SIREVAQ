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

-- Escritura separada por comando (una sola política ALL duplicaba la de SELECT y la evaluaba en cada lectura).
drop policy if exists "cal_cap_write_juris" on public.calendario_capacitaciones;
drop policy if exists "cal_cap_insert_juris" on public.calendario_capacitaciones;
drop policy if exists "cal_cap_update_juris" on public.calendario_capacitaciones;
drop policy if exists "cal_cap_delete_juris" on public.calendario_capacitaciones;
create policy "cal_cap_insert_juris" on public.calendario_capacitaciones for insert to authenticated
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));
create policy "cal_cap_update_juris" on public.calendario_capacitaciones for update to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));
create policy "cal_cap_delete_juris" on public.calendario_capacitaciones for delete to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));

-- =============================================================================
-- Recordatorio automático por correo (faltan 3 días o menos).
-- Edge Function: supabase/functions/capacitacion-recordatorio (supabase functions deploy capacitacion-recordatorio)
-- pg_cron la invoca a diario 08:00 hora de México (14:00 UTC). Cada capacitación se avisa una sola vez
-- (recordatorio_3d_ts); el cliente lo regresa a NULL si cambia su fecha. Pruebas: POST {"dry_run": true}
-- o {"test_to": "correo@x.com"}.
-- =============================================================================
alter table public.calendario_capacitaciones add column if not exists recordatorio_3d_ts timestamptz;

select cron.schedule(
  'enviar-recordatorio-capacitacion',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/capacitacion-recordatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_email_alerts_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
