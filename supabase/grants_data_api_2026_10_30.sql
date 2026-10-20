-- Supabase, 2026-10-30: las tablas NUEVAS en "public" dejan de recibir GRANT automático
-- para la Data API (supabase-js / PostgREST / GraphQL). Sin GRANT el API responde
-- "permission denied". Las tablas existentes en producción NO cambian (verificado
-- 2026-10-20: todas las tablas de la app ya tienen sus grants).
--
-- Este script es IDEMPOTENTE y deja los grants como están hoy en producción. Úsalo
-- para reconstruir el esquema (supabase db reset, rama de preview, proyecto nuevo),
-- porque los scripts históricos (requi_schema, biovac_schema, sis_schema, etc.) crean
-- tablas sin GRANT. La seguridad real sigue siendo RLS (todas las tablas la tienen).
--
-- OJO: NO lo corras en producción (no hace falta y podría reabrir grants que los
-- scripts de endurecimiento, p. ej. hardening_perfiles_usuarios_legacy.sql, quitaron).
-- En una reconstrucción, córrelo ANTES de los scripts de endurecimiento.
--
-- Quedan fuera de este script a propósito:
--   sis06p_sin_envio, respaldo_limpieza_oct2026 (solo service_role / funciones)
--   usuarios_legacy: tiene GRANT por COLUMNAS (authenticated lee usuario, municipio, clues,
--   unidad, rol, activo; anon nada). Lo define hardening_perfiles_usuarios_legacy.sql.
--
-- ── Para TABLAS NUEVAS, en la misma migración que hace CREATE TABLE ─────────────────
--   alter table public.mi_tabla enable row level security;
--   grant select, insert, update, delete on public.mi_tabla to authenticated;
--   grant select, insert, update, delete on public.mi_tabla to service_role;
--   -- solo si la lee gente sin sesión (pantalla de login, etc.):
--   grant select on public.mi_tabla to anon;
--   -- si tiene columna serial/identity, también:
--   grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not in ('usuarios_legacy', 'sis06p_sin_envio', 'respaldo_limpieza_oct2026')
  loop
    execute format('grant select on public.%I to anon', t.relname);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant select, insert, update, delete on public.%I to service_role', t.relname);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated, service_role;
