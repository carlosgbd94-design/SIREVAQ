-- Endurecimiento de seguridad: perfiles y usuarios_legacy.
-- Proyecto utclfqjietlxzlorxhrs. Ver el resumen de hallazgos abajo.
--
-- HALLAZGO 1 — perfiles: la política RLS_Perfiles_Update_Self permitía a cualquier usuario con
--   sesión hacer UPDATE de CUALQUIER columna de su propia fila (USING id = auth.uid(), sin
--   WITH CHECK ni límite de columnas). is_admin() se decide con perfiles.rol = 'ADMIN', así que
--   un usuario UNIDAD podía ascenderse a ADMIN (PATCH /rest/v1/perfiles?id=eq.<su id> {"rol":"ADMIN"})
--   o cambiarse de CLUES/municipio para ver datos de otras unidades.
--   Corrección: trigger que rechaza cambios a columnas protegidas cuando quien edita NO es admin.
--   Se conserva lo que la app sí necesita que el usuario edite en su propia fila: must_change,
--   nombre, telefono (y updated_at). Las Edge Functions admin-* usan service_role (auth.uid()
--   es NULL) y el SQL Editor corre como postgres: ninguno se ve afectado.
--
-- HALLAZGO 2 — usuarios_legacy: la política "Allow public read for login" (SELECT, public,
--   USING true) más los privilegios de tabla de anon dejaban la tabla completa legible con la
--   llave anónima (que está en el JS público): hashes SHA-256 de contraseña (y 8 filas con
--   contraseñas que NO parecen hashes), reset_token, reset_expires, correos.
--   El login real usa Supabase Auth; el "login" contra esta tabla era código muerto (retirado
--   de main.js). Lo único que la usaba sin sesión era "¿Olvidaste tu contraseña?" (usuario ->
--   correo), que ahora lo resuelve la Edge Function recover-access con service_role.
--   Corrección: anon pierde todo acceso; authenticated solo puede leer columnas no sensibles
--   (las que usan los listados de notificaciones del panel). password, email, must_change,
--   reset_token y reset_expires quedan accesibles únicamente por service_role / postgres.
--   handle_new_user es SECURITY DEFINER (dueño con BYPASSRLS): no se afecta.
--
-- Higiene adicional: TRUNCATE/TRIGGER/REFERENCES no pasan por RLS, no hay motivo para que
-- anon/authenticated los tengan; anon tampoco debe poder escribir en perfiles.

-- ── 1. perfiles ────────────────────────────────────────────────────────────
create or replace function public.perfiles_proteger_columnas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Edge Functions (service_role) y SQL Editor/migraciones (sin JWT): sin restricción
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Administradores de la app: pueden editar cualquier perfil
  if public.is_admin() then
    return new;
  end if;

  -- Cualquier otro usuario: solo nombre, teléfono, must_change y updated_at
  if new.id                   is distinct from old.id
  or new.usuario              is distinct from old.usuario
  or new.email                is distinct from old.email
  or new.rol                  is distinct from old.rol
  or new.activo               is distinct from old.activo
  or new.clues                is distinct from old.clues
  or new.unidad               is distinct from old.unidad
  or new.municipio            is distinct from old.municipio
  or new.municipios_allowed   is distinct from old.municipios_allowed
  or new.clues_asignado       is distinct from old.clues_asignado
  or new.municipio_asignado   is distinct from old.municipio_asignado
  or new.created_at           is distinct from old.created_at
  then
    raise exception 'No tienes permiso para modificar ese dato de tu perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_proteger_columnas on public.perfiles;
-- Nombre elegido para que corra ANTES de trg_sync_perfiles_asignados (orden alfabético)
create trigger perfiles_proteger_columnas
  before update on public.perfiles
  for each row execute function public.perfiles_proteger_columnas();

revoke truncate, trigger, references on public.perfiles from anon, authenticated;
revoke insert, update, delete on public.perfiles from anon;

-- ── 2. usuarios_legacy ─────────────────────────────────────────────────────
revoke all on public.usuarios_legacy from anon, authenticated;
grant select (usuario, rol, clues, municipio, unidad, activo)
  on public.usuarios_legacy to authenticated;

drop policy if exists "Allow public read for login" on public.usuarios_legacy;
drop policy if exists "legacy_lectura_basica_autenticados" on public.usuarios_legacy;
create policy "legacy_lectura_basica_autenticados"
  on public.usuarios_legacy
  for select
  to authenticated
  using (true);
