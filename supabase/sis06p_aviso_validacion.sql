-- ======================================================================================
-- SINBA-SIS: AVISO DE VALIDACION GARANTIZADO (app + correo), hecho por el SERVIDOR
-- ======================================================================================
-- ANTES: el navegador del revisor insertaba la notificacion DESPUES de validar (best-effort):
-- si cerraba la pestana o fallaba la red, la unidad no se enteraba. Y no habia correo.
-- AHORA: sis06p_marcar_validado (que tambien usa sis06p_validar_con_excepcion) inserta la
-- notificacion SIS_VALIDADO en la MISMA transaccion (el trigger fanout la reparte a la unidad,
-- al municipal/jurisdiccion/admin) y pide a la Edge Function `sis-validado-correo` que mande
-- el correo a las personas de esa unidad. El correo nunca puede tumbar la validacion.
-- Desplegar la funcion:  supabase functions deploy sis-validado-correo
-- ======================================================================================

create or replace function public._sis06p_avisar_validacion(p_captura_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  c record;
  v_usuario text;
  v_notif_id text;
  v_mes text;
  v_meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  v_key text;
begin
  select clues, municipio, mes, anio, validado_por, excepcion_conciliacion
    into c from sis06p_capturas where id = p_captura_id;
  if c.clues is null then return; end if;

  select usuario into v_usuario from perfiles where id = (select auth.uid());
  v_mes := v_meses[c.mes];
  v_notif_id := 'NOTIF:SISVAL:' || p_captura_id::text || ':' || floor(extract(epoch from clock_timestamp()))::text;

  insert into notificaciones (id, created_ts, created_date, from_usuario, from_rol, target_scope, target_municipio, target_clues,
                              target_usuario, type, title, message, meta_json, status)
  values (v_notif_id, now(), (now() at time zone 'America/Mexico_City')::date, coalesce(v_usuario, c.validado_por),
          (select upper(rol) from perfiles where id = (select auth.uid())), 'CLUES', c.municipio, c.clues, null,
          'SIS_VALIDADO',
          'Tu SINBA-SIS de ' || v_mes || ' ' || c.anio || ' fue validado',
          'El municipal validó tu SINBA-SIS de ' || v_mes || ' ' || c.anio || ' (SIS-06-P, Movimiento, SIS-SS-CE-H e Influenza). '
            || 'Ya no se puede editar: puedes exportar el Excel oficial y el PDF, e imprimirlo.'
            || case when c.excepcion_conciliacion is not null then ' Se validó con una excepción de conciliación: ' || c.excepcion_conciliacion else '' end,
          to_jsonb(json_build_object('source', 'SIS06P', 'clues', c.clues, 'mes', c.mes, 'anio', c.anio)::text),
          'UNREAD');

  -- Correo (best-effort): pg_net es asincrono; cualquier fallo se ignora para no deshacer la validacion.
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'cron_email_alerts_service_role_key';
    if v_key is not null then
      perform net.http_post(
        url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/sis-validado-correo',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object('notificacion_id', v_notif_id, 'captura_id', p_captura_id),
        timeout_milliseconds := 20000);
    end if;
  exception when others then
    raise warning 'sis06p: no se pudo pedir el correo de validacion: %', sqlerrm;
  end;
exception when others then
  -- Ni la notificacion ni el correo pueden revertir la validacion ya hecha.
  raise warning 'sis06p: no se pudo avisar la validacion de %: %', p_captura_id, sqlerrm;
end;
$fn$;

revoke all on function public._sis06p_avisar_validacion(uuid) from public, anon, authenticated;

create or replace function public.sis06p_marcar_validado(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol text;
  v_municipios_allowed text[];
  v_clues_fila text;
  v_municipio text;
  v_mes int;
  v_anio int;
  v_estado text;
  v_dif text;
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios_allowed
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    raise exception 'Rol % no puede validar concentrados.', v_rol;
  end if;

  select clues, municipio, mes, anio, estado
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado
  from sis06p_capturas where id = p_captura_id
  for update;

  if v_clues_fila is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if v_rol = 'MUNICIPAL' and not (v_municipio = any(v_municipios_allowed)) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;
  if v_estado <> 'ENVIADO' then
    raise exception 'Solo se puede validar un concentrado ENVIADO (estado actual: %).', v_estado;
  end if;

  v_dif := _sis06p_diferencias_texto(v_clues_fila, v_mes, v_anio);
  if v_dif is not null then
    raise exception 'No se puede validar: el paloteo SIS-06-P y el Movimiento de Biológico no coinciden en: %. Corrige el que esté mal (modo revisión) y vuelve a validar.', v_dif;
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'VALIDADO', validado_en = now(), validado_por = p_usuario,
      editado_por = v_rol, updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_VALIDADO', true);

  -- Aviso a la unidad (app + correo) en la misma transaccion: ya no depende del navegador del revisor.
  perform public._sis06p_avisar_validacion(p_captura_id);
end;
$function$;
