-- Fase 4 de «Cerrar y programar envío»: aviso en la app a la unidad cuando el municipal REVOCA su programación
-- o cuando el envío automático FALLA (el trigger fanout de notificaciones lo reparte a la unidad y a sus revisores).
-- Va como trigger sobre la bitácora para no tocar las RPC; nunca puede deshacer la revocación ni el envío.
create or replace function public._sis06p_trg_avisar_programacion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  v_per text := v_meses[new.mes] || ' ' || new.anio;
  v_titulo text; v_msg text; v_motivo text := nullif(btrim(coalesce(new.motivo, '')), '');
begin
  if new.accion not in ('REVOCADO', 'FALLIDO') then return new; end if;

  if new.accion = 'REVOCADO' then
    v_titulo := 'El municipal revocó el envío programado de tu SINBA-SIS de ' || v_per;
    v_msg := 'Motivo: ' || coalesce(v_motivo, 'sin motivo') || '. Tu captura quedó abierta: sigue registrando y envía cuando abra la ventana de envío '
             || '(no podrás volver a programar este mes antes de esa fecha).';
  else
    v_titulo := 'No se pudo enviar automáticamente tu SINBA-SIS de ' || v_per;
    v_msg := 'El envío programado no se hizo: ' || coalesce(v_motivo, 'error desconocido') || ' Tu captura quedó abierta: corrígelo y vuelve a cerrarlo o envíalo.';
  end if;

  insert into notificaciones (id, created_ts, created_date, from_usuario, from_rol, target_scope, target_municipio, target_clues,
                              target_usuario, type, title, message, meta_json, status)
  values ('NOTIF:SISPROG:' || new.id::text, now(), (now() at time zone 'America/Mexico_City')::date,
          coalesce(new.usuario, 'Sistema'), new.rol, 'CLUES', new.municipio, new.clues, null,
          'WARN', v_titulo, v_msg,
          to_jsonb(json_build_object('source', 'SIS06P_PROG', 'clues', new.clues, 'mes', new.mes, 'anio', new.anio, 'accion', new.accion)::text),
          'UNREAD');
  return new;
exception when others then
  raise warning 'sis06p: no se pudo avisar la programación %: %', new.id, sqlerrm;
  return new;
end;
$fn$;
revoke all on function public._sis06p_trg_avisar_programacion() from public, anon, authenticated;

drop trigger if exists trg_sis06p_programaciones_aviso on public.sis06p_programaciones;
create trigger trg_sis06p_programaciones_aviso
  after insert on public.sis06p_programaciones
  for each row execute function public._sis06p_trg_avisar_programacion();
