-- SINBA-SIS: "Cerrar y programar envío".
-- La unidad congela su captura antes del último día del mes y el sistema envía solo cuando se abre la
-- ventana de envío (o en la fecha que elija dentro de ella). El municipal ve quién programó y cuántos días
-- antes del fin de mes, y puede REVOCAR la programación (motivo obligatorio).
--
-- Diseño:
--  * El estado sigue siendo BORRADOR hasta que se ejecuta el envío; la programación vive en columnas de
--    sis06p_capturas (no hay un estado nuevo: publicación, CSV, ZIP y validación siguen iguales).
--  * "Programado" congela a la UNIDAD igual que ENVIADO (_sis06p_mes_bloqueado, trigger de capturas,
--    Influenza). Los revisores siguen pudiendo editar.
--  * Las columnas de programación solo las mueven las RPC (trigger trg_sis06p_08_programacion las preserva).
--  * Bitácora sis06p_programaciones: PROGRAMADO / DESPROGRAMADO / REVOCADO / EJECUTADO / FALLIDO.
--  * Cron diario 00:10 hora de México (06:10 UTC) ejecuta lo programado con fecha <= hoy.

-- ---------------------------------------------------------------------------
-- 1. Columnas y bitácora
-- ---------------------------------------------------------------------------
alter table public.sis06p_capturas
  add column if not exists envio_programado_en timestamptz,
  add column if not exists envio_programado_para date,
  add column if not exists envio_programado_por text,
  add column if not exists envio_programado_dias_antes integer,
  add column if not exists programacion_revocada_en timestamptz;

create table if not exists public.sis06p_programaciones (
  id uuid primary key default gen_random_uuid(),
  captura_id uuid references public.sis06p_capturas(id) on delete cascade,
  clues text not null,
  municipio text,
  mes int not null,
  anio int not null,
  accion text not null check (accion in ('PROGRAMADO','DESPROGRAMADO','REVOCADO','EJECUTADO','FALLIDO')),
  usuario text,
  rol text,
  motivo text,
  programado_para date,
  dias_antes integer,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists idx_sis06p_programaciones_captura on public.sis06p_programaciones (captura_id, created_at desc);
create index if not exists idx_sis06p_programaciones_clues_mes on public.sis06p_programaciones (clues, anio, mes);

alter table public.sis06p_programaciones enable row level security;
drop policy if exists "RLS_sis06p_programaciones_Read" on public.sis06p_programaciones;
create policy "RLS_sis06p_programaciones_Read" on public.sis06p_programaciones
  for select using (
    exists (
      select 1 from perfiles p
      where p.id = (select auth.uid()) and p.activo = 'SI'
        and ( upper(p.rol) in ('ADMIN','JURISDICCIONAL')
              or (upper(p.rol) = 'MUNICIPAL' and sis06p_programaciones.municipio = any (p.municipios_allowed))
              or (upper(p.rol) = 'UNIDAD' and p.clues = sis06p_programaciones.clues) )
    )
  );
revoke insert, update, delete on public.sis06p_programaciones from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. "Programado" congela a la unidad
-- ---------------------------------------------------------------------------
create or replace function public._sis06p_mes_bloqueado(p_clues text, p_anio integer, p_mes integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from sis06p_capturas c
    where c.clues = p_clues and c.anio = p_anio and c.mes = p_mes
      and (c.estado <> 'BORRADOR' or c.envio_programado_en is not null)
  )
$function$;

-- Candado de capturas + las columnas de programación solo las mueven las RPC.
create or replace function public.sis06p_trg_08_programacion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.envio_programado_en := null;
    new.envio_programado_para := null;
    new.envio_programado_por := null;
    new.envio_programado_dias_antes := null;
    new.programacion_revocada_en := null;
    return new;
  end if;

  if _sis_rol_actual() = 'UNIDAD' and old.envio_programado_en is not null then
    raise exception 'Tu SINBA-SIS está cerrado y programado para enviarse el %. Si necesitas editar, cancela la programación primero.',
      to_char(old.envio_programado_para, 'DD/MM/YYYY');
  end if;

  if tg_op = 'UPDATE' then
    new.envio_programado_en := old.envio_programado_en;
    new.envio_programado_para := old.envio_programado_para;
    new.envio_programado_por := old.envio_programado_por;
    new.envio_programado_dias_antes := old.envio_programado_dias_antes;
    new.programacion_revocada_en := old.programacion_revocada_en;
    return new;
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_sis06p_08_programacion on public.sis06p_capturas;
create trigger trg_sis06p_08_programacion
  before insert or update or delete on public.sis06p_capturas
  for each row execute function public.sis06p_trg_08_programacion();

-- Influenza (y COVID, misma tabla): también se congela cuando el SIS está programado.
create or replace function public.influenza_trg_candado_sis_enviado()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rol text; v_estado text; v_prog date; v_fecha date; v_clues text; v_clues_l text[]; v_fechas date[]; i int;
  v_ini date; v_mes int; v_anio int;
begin
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then v_clues_l := array[new.clues]; v_fechas := array[new.fecha];
  elsif tg_op = 'DELETE' then v_clues_l := array[old.clues]; v_fechas := array[old.fecha];
  else v_clues_l := array[old.clues, new.clues]; v_fechas := array[old.fecha, new.fecha];
  end if;

  select valor::date into v_ini from sis_config where clave = 'inicio_captura_por_unidad';

  for i in 1 .. array_length(v_fechas, 1) loop
    v_clues := v_clues_l[i];
    v_fecha := v_fechas[i];
    continue when v_fecha is null;
    v_mes := extract(month from v_fecha)::int;
    v_anio := extract(year from v_fecha)::int;

    v_estado := null; v_prog := null;
    select c.estado, c.envio_programado_para into v_estado, v_prog
    from sis06p_capturas c where c.clues = v_clues and c.mes = v_mes and c.anio = v_anio;

    if v_estado is not null and v_estado <> 'BORRADOR' then
      raise exception 'El SIS de % ya fue enviado (%): Influenza de ese mes quedó congelada. Pide al municipal que la corrija en modo revisión.',
        to_char(v_fecha, 'MM/YYYY'), lower(v_estado) using errcode = 'P0001';
    end if;
    if v_prog is not null then
      raise exception 'El SIS de % está cerrado y programado para enviarse el %: Influenza de ese mes quedó congelada. Cancela la programación si necesitas editar.',
        to_char(v_fecha, 'MM/YYYY'), to_char(v_prog, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;

    if v_ini is not null and make_date(v_anio, v_mes, 1) >= date_trunc('month', v_ini)::date then
      if _sis06p_unidad_omitida(v_clues, v_anio, v_mes) then
        raise exception 'El mes % quedó "sin envío" para esta unidad: Influenza de ese mes está congelada. Pide al municipal que la corrija.',
          to_char(v_fecha, 'MM/YYYY') using errcode = 'P0001';
      end if;
      if exists (
        select 1 from biovac_unidades u
        join biovac_unidades j on j.municipio = u.municipio and j.clues like 'JS1-%'
        join biovac_movimientos m on m.unidad_id = j.id and m.anio = v_anio and m.mes = v_mes and m.estado = 'CERRADO'
        where u.clues = v_clues and u.clues not like 'JS1-%') then
        raise exception 'El mes % ya está cerrado por el municipio: Influenza de ese mes está congelada. Pide al municipal que la corrija.',
          to_char(v_fecha, 'MM/YYYY') using errcode = 'P0001';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Validación común (misma que Enviar) -> devuelve el texto del problema o null
-- ---------------------------------------------------------------------------
create or replace function public._sis06p_problema_para_enviar(p_captura_id uuid, p_admin boolean)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c record; v_dosis numeric; v_unidad_id uuid; v_mov_estado text; v_mov_id uuid; v_dif text;
begin
  select * into c from sis06p_capturas where id = p_captura_id;
  if c.id is null then return 'El concentrado no existe.'; end if;

  if not p_admin and not _sis06p_nombre_valido(c.capturado_por) then
    return 'Falta el nombre completo de quien elabora el SINBA-SIS (nombre y apellido) en «Responsable de la información». Escríbelo, guarda y vuelve a intentar.';
  end if;

  v_dosis := _sis06p_dosis_del_mes(c.clues, c.mes, c.anio);
  if not p_admin and v_dosis = 0 and not coalesce(c.sin_movimiento, false) then
    return 'Tu SINBA-SIS está en ceros. Si este mes no recibiste ni aplicaste biológico, marca «Sin movimiento este mes», guarda y vuelve a intentar.';
  end if;

  select bu.id into v_unidad_id from biovac_unidades bu where bu.clues = c.clues;
  if v_unidad_id is null then return 'No se encontró la unidad en el catálogo de BioVac.'; end if;

  select id, estado into v_mov_id, v_mov_estado from biovac_movimientos
  where unidad_id = v_unidad_id and anio = c.anio and mes = c.mes;
  if v_mov_id is null then
    return 'El SIS es un solo documento: primero captura el Movimiento de Biológico de este mes y luego ciérralo.';
  end if;
  if v_mov_estado = 'EN_CORRECCION' then
    return 'El Movimiento de Biológico de este mes está en corrección: guárdalo antes de continuar.';
  end if;

  v_dif := _sis06p_diferencias_texto(c.clues, c.mes, c.anio);
  if v_dif is not null then
    return 'El paloteo SIS-06-P y el Movimiento de Biológico no coinciden en: ' || v_dif;
  end if;
  return null;
end;
$function$;
revoke all on function public._sis06p_problema_para_enviar(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Programar
-- ---------------------------------------------------------------------------
create or replace function public.sis06p_programar_envio(p_captura_id uuid, p_usuario text, p_fecha date default null)
 returns date
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rol text; v_clues_perfil text; c record; v_vent record; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_para date; v_fin_mes date; v_prob text; v_admin boolean; v_mov_id uuid; v_mov_estado text;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('UNIDAD','ADMIN') then
    raise exception 'Solo la unidad (o el administrador) puede programar el envío.';
  end if;
  v_admin := (v_rol = 'ADMIN');

  select * into c from sis06p_capturas where id = p_captura_id for update;
  if c.id is null then raise exception 'Concentrado % no existe.', p_captura_id; end if;
  if not v_admin and c.clues is distinct from v_clues_perfil then
    raise exception 'No puedes programar el envío de otra unidad.';
  end if;
  if c.estado <> 'BORRADOR' then
    raise exception 'Este concentrado ya está en estado %: no se puede programar.', c.estado;
  end if;
  if c.envio_programado_en is not null then
    raise exception 'Este SINBA-SIS ya está programado para enviarse el %.', to_char(c.envio_programado_para, 'DD/MM/YYYY');
  end if;

  select * into v_vent from sis06p_ventana_envio(c.anio, c.mes);
  if v_vent.dentro_envio then
    raise exception 'Ya estás dentro de la ventana de envío: usa «Enviar» en lugar de programar.';
  end if;
  if not v_vent.dentro_prellenado and not v_admin then
    raise exception 'Fuera de la ventana de captura de este mes (% a %).', v_vent.inicio_prellenado, v_vent.fin_envio;
  end if;

  if c.programacion_revocada_en is not null and not v_admin then
    raise exception 'El municipal revocó tu programación anterior. Podrás volver a cerrar hasta que abra la ventana de envío (%).',
      to_char(v_vent.inicio_envio, 'DD/MM/YYYY');
  end if;

  v_para := coalesce(p_fecha, v_vent.inicio_envio);
  if v_para < v_vent.inicio_envio or v_para > v_vent.fin_envio then
    raise exception 'La fecha de envío debe estar entre % y % (ventana de envío del mes).',
      to_char(v_vent.inicio_envio, 'DD/MM/YYYY'), to_char(v_vent.fin_envio, 'DD/MM/YYYY');
  end if;

  v_prob := _sis06p_problema_para_enviar(p_captura_id, v_admin);
  if v_prob is not null then raise exception '%', v_prob; end if;

  -- Ensayo del cierre del Movimiento (existencias negativas, lotes que caducan, frascos a medio resolver):
  -- se ejecuta y se deshace, para no programar algo que el día del envío fallaría.
  select m.id, m.estado into v_mov_id, v_mov_estado
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
  where bu.clues = c.clues and m.anio = c.anio and m.mes = c.mes;
  if v_mov_estado = 'BORRADOR' then
    begin
      perform set_config('sis06p.cierre_por_envio', 'on', true);
      perform biovac_cerrar_mes(v_mov_id, p_usuario);
      raise exception 'ENSAYO_CIERRE_OK';
    exception when others then
      perform set_config('sis06p.cierre_por_envio', 'off', true);
      if sqlerrm <> 'ENSAYO_CIERRE_OK' then
        raise exception '%', sqlerrm;
      end if;
    end;
  end if;

  v_fin_mes := (make_date(c.anio, c.mes, 1) + interval '1 month' - interval '1 day')::date;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set envio_programado_en = now(),
      envio_programado_para = v_para,
      envio_programado_por = p_usuario,
      envio_programado_dias_antes = greatest(0, v_fin_mes - v_hoy),
      programacion_revocada_en = null
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_programaciones (captura_id, clues, municipio, mes, anio, accion, usuario, rol, programado_para, dias_antes)
  values (p_captura_id, c.clues, c.municipio, c.mes, c.anio, 'PROGRAMADO', p_usuario, v_rol, v_para, greatest(0, v_fin_mes - v_hoy));
  return v_para;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Cancelar (la unidad) y revocar (el municipal / jurisdicción / admin)
-- ---------------------------------------------------------------------------
create or replace function public.sis06p_desprogramar_envio(p_captura_id uuid, p_usuario text, p_motivo text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_rol text; v_clues_perfil text; c record;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('UNIDAD','ADMIN') then
    raise exception 'Solo la unidad (o el administrador) puede cancelar su programación.';
  end if;
  select * into c from sis06p_capturas where id = p_captura_id for update;
  if c.id is null then raise exception 'Concentrado no existe.'; end if;
  if v_rol = 'UNIDAD' and c.clues is distinct from v_clues_perfil then
    raise exception 'No puedes cancelar la programación de otra unidad.';
  end if;
  if c.estado <> 'BORRADOR' or c.envio_programado_en is null then
    raise exception 'Este SINBA-SIS no tiene un envío programado que cancelar.';
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set envio_programado_en = null, envio_programado_para = null, envio_programado_por = null,
      envio_programado_dias_antes = null
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_programaciones (captura_id, clues, municipio, mes, anio, accion, usuario, rol, motivo, programado_para, dias_antes)
  values (p_captura_id, c.clues, c.municipio, c.mes, c.anio, 'DESPROGRAMADO', p_usuario, v_rol,
          nullif(btrim(coalesce(p_motivo, '')), ''), c.envio_programado_para, c.envio_programado_dias_antes);
end;
$function$;

create or replace function public.sis06p_revocar_programacion(p_captura_id uuid, p_usuario text, p_motivo text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_perfil perfiles%rowtype; v_rol text; c record;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  v_rol := upper(coalesce(v_perfil.rol, ''));
  if v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    raise exception 'Solo el municipal, la jurisdicción o el administrador pueden revocar una programación.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 15 then
    raise exception 'Escribe el motivo de la revocación (mínimo 15 caracteres): la unidad lo verá.';
  end if;
  select * into c from sis06p_capturas where id = p_captura_id for update;
  if c.id is null then raise exception 'Concentrado no existe.'; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, c.municipio) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;
  if c.estado <> 'BORRADOR' or c.envio_programado_en is null then
    raise exception 'Este SINBA-SIS no tiene un envío programado que revocar.';
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set envio_programado_en = null, envio_programado_para = null, envio_programado_por = null,
      envio_programado_dias_antes = null, programacion_revocada_en = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_programaciones (captura_id, clues, municipio, mes, anio, accion, usuario, rol, motivo, programado_para, dias_antes)
  values (p_captura_id, c.clues, c.municipio, c.mes, c.anio, 'REVOCADO', p_usuario, v_rol,
          btrim(p_motivo), c.envio_programado_para, c.envio_programado_dias_antes);
end;
$function$;

grant execute on function public.sis06p_programar_envio(uuid, text, date) to authenticated;
grant execute on function public.sis06p_desprogramar_envio(uuid, text, text) to authenticated;
grant execute on function public.sis06p_revocar_programacion(uuid, text, text) to authenticated;
revoke execute on function public.sis06p_programar_envio(uuid, text, date) from anon, public;
revoke execute on function public.sis06p_desprogramar_envio(uuid, text, text) from anon, public;
revoke execute on function public.sis06p_revocar_programacion(uuid, text, text) from anon, public;

-- ---------------------------------------------------------------------------
-- 6. Ejecución diaria
-- ---------------------------------------------------------------------------
create or replace function public.sis06p_ejecutar_envios_programados()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c record; v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_n int := 0; v_prob text; v_mov_id uuid; v_mov_estado text; v_usuario text;
begin
  for c in
    select * from sis06p_capturas
    where estado = 'BORRADOR' and envio_programado_en is not null and envio_programado_para <= v_hoy
    order by envio_programado_para, clues
  loop
    begin
      v_usuario := coalesce(c.envio_programado_por, 'Envío programado');
      v_prob := _sis06p_problema_para_enviar(c.id, false);
      if v_prob is not null then raise exception '%', v_prob; end if;

      select m.id, m.estado into v_mov_id, v_mov_estado
      from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
      where bu.clues = c.clues and m.anio = c.anio and m.mes = c.mes for update of m;

      if v_mov_estado = 'BORRADOR' then
        perform set_config('sis06p.cierre_por_envio', 'on', true);
        perform biovac_cerrar_mes(v_mov_id, v_usuario);
        perform set_config('sis06p.cierre_por_envio', 'off', true);
      end if;

      perform set_config('sis06p.bypass_lock', 'on', true);
      update sis06p_capturas
      set estado = 'ENVIADO', enviado_en = now(), enviado_por = v_usuario,
          sin_movimiento = (_sis06p_dosis_del_mes(c.clues, c.mes, c.anio) = 0),
          editado_por = 'UNIDAD', updated_at = now()
      where id = c.id;
      perform set_config('sis06p.bypass_lock', 'off', true);

      insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, detalle, reconocido_por_unidad)
      values (c.id, c.clues, c.municipio, c.mes, c.anio, v_usuario, 'UNIDAD', 'MARCADOR_ENVIADO', 'Envío automático programado', true);
      insert into sis06p_programaciones (captura_id, clues, municipio, mes, anio, accion, usuario, rol, programado_para, dias_antes)
      values (c.id, c.clues, c.municipio, c.mes, c.anio, 'EJECUTADO', v_usuario, 'SISTEMA', c.envio_programado_para, c.envio_programado_dias_antes);
      v_n := v_n + 1;
    exception when others then
      perform set_config('sis06p.cierre_por_envio', 'off', true);
      perform set_config('sis06p.bypass_lock', 'on', true);
      update sis06p_capturas
      set envio_programado_en = null, envio_programado_para = null, envio_programado_por = null,
          envio_programado_dias_antes = null
      where id = c.id;
      perform set_config('sis06p.bypass_lock', 'off', true);
      insert into sis06p_programaciones (captura_id, clues, municipio, mes, anio, accion, usuario, rol, motivo, programado_para, dias_antes)
      values (c.id, c.clues, c.municipio, c.mes, c.anio, 'FALLIDO', c.envio_programado_por, 'SISTEMA', left(SQLERRM, 600),
              c.envio_programado_para, c.envio_programado_dias_antes);
    end;
  end loop;
  return v_n;
end;
$function$;
revoke all on function public.sis06p_ejecutar_envios_programados() from public, anon, authenticated;

-- Todos los días 00:10 hora de México (UTC-6, sin horario de verano).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sis06p-envios-programados') then
    perform cron.unschedule('sis06p-envios-programados');
  end if;
  perform cron.schedule('sis06p-envios-programados', '10 6 * * *', 'select public.sis06p_ejecutar_envios_programados();');
end $$;
