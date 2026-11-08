-- 2026-11-08: notificaciones UPDATE dejaba de ser "cualquier sesion edita cualquier aviso maestro" (USING true).
-- Ahora puede actualizar: ADMIN; MUNICIPAL/JURISDICCIONAL (resuelven alertas de desabasto y confirman entregas de sus unidades);
-- el autor del aviso o una cuenta de su misma unidad; quien lo recibe (tiene copia en notificaciones_perfil) y la unidad destino.
drop policy if exists "Authenticated users can update notifications" on public.notificaciones;
create policy notificaciones_update_relacionados on public.notificaciones for update to authenticated
  using (
    (select is_admin())
    or exists (select 1 from public.perfiles me where me.id = (select auth.uid()) and (
         upper(me.rol) in ('MUNICIPAL','JURISDICCIONAL')
      or me.usuario = notificaciones.from_usuario
      or (me.clues is not null and me.clues = notificaciones.target_clues)
      or (me.clues is not null and exists (select 1 from public.perfiles o where o.usuario = notificaciones.from_usuario and o.clues = me.clues))
      or exists (select 1 from public.notificaciones_perfil np where np.notificacion_id = notificaciones.id and np.usuario = me.usuario)
    ))
  );
