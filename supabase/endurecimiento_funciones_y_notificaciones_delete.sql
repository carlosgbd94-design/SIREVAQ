-- 2026-11-08: search_path fijo en 3 funciones, trigger-functions sin EXECUTE para anon/authenticated (el trigger se
-- dispara igual) y borrado de notificaciones solo por su autor o ADMIN (antes cualquier sesion borraba cualquiera).
alter function public.biovac_trg_20_autocalc()      set search_path = public, extensions, pg_temp;
alter function public.covid_dosis_por_frasco(text)   set search_path = public, extensions, pg_temp;
alter function public.sis06p_trg_sin_movimiento()    set search_path = public, extensions, pg_temp;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace='public'::regnamespace and p.prorettype='trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

drop policy if exists "Authenticated users can delete own notifications" on public.notificaciones;
create policy notificaciones_delete_dueno on public.notificaciones for delete to authenticated
  using ((select is_admin()) or from_usuario = (select p.usuario from public.perfiles p where p.id = (select auth.uid())));
