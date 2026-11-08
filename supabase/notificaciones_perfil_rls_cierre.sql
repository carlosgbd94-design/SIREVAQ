-- Cierra notificaciones_perfil (2026-11-08).
-- Antes: 4 políticas "Allow ... for all" con USING true para el rol public => cualquiera, incluso sin sesión
-- (anon), podía leer, crear, modificar y borrar los avisos de TODOS los usuarios.
-- Ahora:
--   * anon: sin acceso (políticas solo para authenticated y sin privilegios de tabla).
--   * SELECT/UPDATE/DELETE: solo las filas propias (usuario = mi perfil) o ADMIN. Todo el código del cliente
--     (web y móvil) ya filtra por su propio usuario o por id de su fila.
--   * INSERT: cualquier sesión activa (el reparto "fan-out" desde el cliente crea filas para otros destinatarios;
--     el trigger fanout_notification_trigger es SECURITY DEFINER y no depende de estas políticas).
drop policy if exists "Allow select for all" on public.notificaciones_perfil;
drop policy if exists "Allow insert for all" on public.notificaciones_perfil;
drop policy if exists "Allow update for all" on public.notificaciones_perfil;
drop policy if exists "Allow delete for all" on public.notificaciones_perfil;

create policy np_select_propias on public.notificaciones_perfil for select to authenticated
  using ((select is_admin()) or usuario = (select p.usuario from public.perfiles p where p.id = (select auth.uid())));

create policy np_insert_sesion on public.notificaciones_perfil for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo = 'SI'));

create policy np_update_propias on public.notificaciones_perfil for update to authenticated
  using ((select is_admin()) or usuario = (select p.usuario from public.perfiles p where p.id = (select auth.uid())))
  with check ((select is_admin()) or usuario = (select p.usuario from public.perfiles p where p.id = (select auth.uid())));

create policy np_delete_propias on public.notificaciones_perfil for delete to authenticated
  using ((select is_admin()) or usuario = (select p.usuario from public.perfiles p where p.id = (select auth.uid())));

revoke all on public.notificaciones_perfil from anon;
revoke truncate, trigger, references on public.notificaciones_perfil from authenticated;
