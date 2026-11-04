-- =============================================================================
-- SINBA-SIS: la unidad recibe el aviso (app + correo) y puede EXPORTAR / IMPRIMIR solo cuando el
-- MUNICIPIO CIERRA EL MES -- no al validar su SIS.
--
-- Por qué: si al validar la unidad ya se le liberaba el archivo y después el concentrado municipal no
-- cuadraba, había que reabrir el SIS cuando la unidad ya podía haberlo impreso: la unidad quedaba con
-- una cifra distinta a la de la jurisdicción. Ahora validar solo deja el SIS «validado» (ya no se edita);
-- la liberación llega cuando el Movimiento del municipio (fila JS1-) queda CERRADO.
--
--   * sis06p_capturas.liberado_en: momento en que se liberó a la unidad (null = validado pero retenido).
--   * sis06p_marcar_validado: si el mes del municipio YA está cerrado libera al instante (una unidad que
--     valida tarde); si no, la deja retenida. Al (re)validar se reinicia liberado_en.
--   * Trigger en biovac_movimientos: al pasar la fila JS1- a CERRADO libera, avisa y manda el correo de
--     todas las unidades validadas de ese municipio y mes que seguían retenidas.
--   * Lo que ya estaba VALIDADO antes de este cambio se da por liberado (ya se les había avisado).
-- El aviso/correo sigue siendo best-effort: nunca puede impedir validar ni cerrar el mes.
-- =============================================================================

alter table public.sis06p_capturas add column if not exists liberado_en timestamptz;

-- Lo ya validado se considera liberado (esas unidades ya recibieron el aviso).
do $$
begin
  perform set_config('sis06p.bypass_lock', 'on', true);
  update public.sis06p_capturas
     set liberado_en = coalesce(validado_en, updated_at, now())
   where estado = 'VALIDADO' and liberado_en is null;
  perform set_config('sis06p.bypass_lock', 'off', true);
end $$;

-- ¿El Movimiento del municipio (fila JS1-) de ese mes ya está cerrado?
create or replace function public._sis06p_municipio_cerrado(p_municipio text, p_anio int, p_mes int)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from biovac_movimientos m
    join biovac_unidades u on u.id = m.unidad_id
    where u.municipio = p_municipio and u.clues like 'JS1-%'
      and m.anio = p_anio and m.mes = p_mes and m.estado = 'CERRADO'
  );
$$;
revoke all on function public._sis06p_municipio_cerrado(text, int, int) from public, anon, authenticated;

-- Libera una captura VALIDADO retenida: marca liberado_en y pide el aviso (app + correo).
create or replace function public._sis06p_liberar_captura(p_captura_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n int;
begin
  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas set liberado_en = now()
   where id = p_captura_id and estado = 'VALIDADO' and liberado_en is null;
  get diagnostics v_n = row_count;
  perform set_config('sis06p.bypass_lock', 'off', true);
  if v_n > 0 then perform public._sis06p_avisar_validacion(p_captura_id); end if;
exception when others then
  perform set_config('sis06p.bypass_lock', 'off', true);
  raise warning 'sis06p: no se pudo liberar la captura %: %', p_captura_id, sqlerrm;
end;
$$;
revoke all on function public._sis06p_liberar_captura(uuid) from public, anon, authenticated;

-- Al cerrar el mes del municipio: libera a todas sus unidades validadas.
create or replace function public._sis06p_trg_liberar_al_cerrar_municipio()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_mun text; r record;
begin
  select u.municipio into v_mun from biovac_unidades u where u.id = new.unidad_id and u.clues like 'JS1-%';
  if v_mun is null then return new; end if;
  for r in select id from sis06p_capturas
            where municipio = v_mun and anio = new.anio and mes = new.mes
              and estado = 'VALIDADO' and liberado_en is null
  loop
    perform public._sis06p_liberar_captura(r.id);
  end loop;
  return new;
exception when others then
  raise warning 'sis06p: no se pudo liberar al cerrar el mes de %: %', v_mun, sqlerrm;
  return new;
end;
$$;
revoke all on function public._sis06p_trg_liberar_al_cerrar_municipio() from public, anon, authenticated;

drop trigger if exists trg_biovac_liberar_sis_al_cerrar on public.biovac_movimientos;
create trigger trg_biovac_liberar_sis_al_cerrar
  after update of estado on public.biovac_movimientos
  for each row
  when (new.estado = 'CERRADO' and old.estado is distinct from 'CERRADO')
  execute function public._sis06p_trg_liberar_al_cerrar_municipio();

-- El texto del aviso: ahora el mes del municipio ya está cerrado.
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
          'Tu SINBA-SIS de ' || v_mes || ' ' || c.anio || ' ya es definitivo',
          'Tu SINBA-SIS de ' || v_mes || ' ' || c.anio || ' (SIS-06-P, Movimiento, SIS-SS-CE-H e Influenza) fue validado y el municipio ya cerró el mes. '
            || 'Ya no se puede editar: puedes exportar el Excel oficial y el PDF, e imprimirlo.'
            || case when c.excepcion_conciliacion is not null then ' Se validó con una excepción de conciliación: ' || c.excepcion_conciliacion else '' end,
          to_jsonb(json_build_object('source', 'SIS06P', 'clues', c.clues, 'mes', c.mes, 'anio', c.anio)::text),
          'UNREAD');

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
  raise warning 'sis06p: no se pudo avisar la validacion de %: %', p_captura_id, sqlerrm;
end;
$fn$;
revoke all on function public._sis06p_avisar_validacion(uuid) from public, anon, authenticated;

-- Validar: ya no avisa a la unidad por sí solo; solo si el mes del municipio ya está cerrado.
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
      editado_por = v_rol, updated_at = now(), liberado_en = null
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_VALIDADO', true);

  -- A la unidad se le libera (aviso + Exportar) cuando el municipio cierra el mes; si ya estaba cerrado, al instante.
  if public._sis06p_municipio_cerrado(v_municipio, v_anio, v_mes) then
    perform public._sis06p_liberar_captura(p_captura_id);
  end if;
end;
$function$;
