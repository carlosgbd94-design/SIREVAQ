-- ============================================================================
-- SINBA-SIS: candados del lado del servidor, excepción de conciliación,
-- auditoría de Influenza y publicación a indicadores a prueba de errores.
--
-- 1. Ventana de PRELLENADO obligatoria en el servidor (antes solo la mostraba
--    la pantalla) y calculada con la fecha de México, no la de UTC.
-- 2. Una vez ENVIADO el SIS, la UNIDAD no puede escribir NADA: ni SIS-06-P, ni
--    Movimiento (renglones, cabecera, cerrar/abrir mes), ni borrar la captura.
--    Solo MUNICIPAL/JURISDICCIONAL/ADMIN.
-- 3. Excepción de conciliación (ADMIN/JURISDICCIONAL, con justificación y
--    auditada) para el caso legítimo en que paloteo y Movimiento no cuadran.
-- 4. Los cambios de un revisor a Influenza de un mes ya enviado quedan en el
--    control de cambios que ve la unidad (igual que SIS-06-P).
-- 5. Publicación: no se publica ni se descarga el CSV si paloteo y Movimiento
--    no coinciden (salvo excepción); dos publicaciones simultáneas no pueden
--    duplicar filas; la carga manual de CSV (RDA) ya no borra el mismo mes de
--    OTROS años.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ayudantes internos (no ejecutables por el cliente)
-- ---------------------------------------------------------------------------
create or replace function _sis_rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select upper(p.rol) from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI'
$$;
revoke all on function _sis_rol_actual() from public, anon, authenticated;

create or replace function _sis06p_mes_bloqueado(p_clues text, p_anio int, p_mes int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sis06p_capturas c
    where c.clues = p_clues and c.anio = p_anio and c.mes = p_mes and c.estado <> 'BORRADOR'
  )
$$;
revoke all on function _sis06p_mes_bloqueado(text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ventana (con fecha de México y override que también mueve el prellenado)
-- ---------------------------------------------------------------------------
create or replace function sis06p_ventana_envio(p_anio int, p_mes int)
returns table(inicio_prellenado date, inicio_envio date, fin_envio date, dentro_prellenado boolean, dentro_envio boolean, override_activo boolean)
language plpgsql stable set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_fin_mes date;
  v_inicio_envio date;
  v_fin_envio date;
  v_override record;
begin
  v_fin_mes := (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_inicio_envio := v_fin_mes;
  v_fin_envio := v_fin_mes + 7;

  select * into v_override from sis06p_calendario_override
  where anio = p_anio and mes = p_mes and activo = true limit 1;

  if v_override.id is not null then
    v_inicio_envio := v_override.habilitar_desde;
    v_fin_envio := v_override.habilitar_hasta;
  end if;

  inicio_prellenado := least(v_fin_mes - 7, v_inicio_envio);
  inicio_envio := v_inicio_envio;
  fin_envio := v_fin_envio;
  dentro_envio := v_hoy between v_inicio_envio and v_fin_envio;
  dentro_prellenado := v_hoy between least(v_fin_mes - 7, v_inicio_envio) and v_fin_envio;
  override_activo := (v_override.id is not null);
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Columnas de excepción + tipo de marcador
-- ---------------------------------------------------------------------------
alter table sis06p_capturas
  add column if not exists excepcion_conciliacion text,
  add column if not exists excepcion_por text,
  add column if not exists excepcion_en timestamptz;

alter table sis06p_correcciones drop constraint if exists sis06p_correcciones_tipo_check;
alter table sis06p_correcciones add constraint sis06p_correcciones_tipo_check
  check (tipo = any (array['EDICION_MUNICIPAL', 'MARCADOR_ENVIADO', 'MARCADOR_VALIDADO', 'MARCADOR_EXCEPCION']));

-- La diferencia paloteo/Movimiento no cuenta cuando hay excepción autorizada.
create or replace function _sis06p_diferencias_texto(p_clues text, p_mes int, p_anio int)
returns text language sql stable security definer set search_path = public as $$
  select string_agg(
           format('%s (paloteo %s, aplicado en Movimiento %s)', d.etiqueta, trim_scale(d.paloteo)::text, trim_scale(d.aplicado)::text),
           '; ' order by d.etiqueta)
         || case when bool_or(d.claves && array['SR','SRP','DPT','TDPA']::text[])
                 then ' Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT), captura el ajuste (comodín) en la pestaña SIS-06-P.'
                 else '' end
  from _sis06p_comparativo_calc(p_clues, p_mes, p_anio) d
  where d.paloteo <> d.aplicado
    and not exists (
      select 1 from sis06p_capturas c
      where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio and c.excepcion_conciliacion is not null
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger de SIS-06-P: ventana de prellenado + candados + excepción
-- ---------------------------------------------------------------------------
create or replace function sis06p_trg_10_bloqueo_y_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_clues text;
  v_municipios_allowed text[];
  v_fila text;
  v_kind text;
  v_old_val text;
  v_new_val text;
  v_key text;
  v_vent record;
begin
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then
    return new;
  end if;

  select upper(p.rol), p.clues, p.municipios_allowed
    into v_rol, v_clues, v_municipios_allowed
  from perfiles p
  where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null then
    raise exception 'Perfil no encontrado o inactivo.';
  end if;

  if v_rol = 'UNIDAD' then
    if v_clues is distinct from new.clues then
      raise exception 'No puedes escribir en el registro de otra unidad.';
    end if;
    if tg_op = 'UPDATE' and old.estado <> 'BORRADOR' then
      raise exception 'Este concentrado ya fue enviado (estado: %). No puedes editarlo directamente.', old.estado;
    end if;

    -- Prellenado: desde 7 días antes de fin de mes hasta el cierre de la ventana de envío.
    select * into v_vent from sis06p_ventana_envio(new.anio, new.mes);
    if not v_vent.dentro_prellenado then
      raise exception 'El SIS de %/% se puede capturar del % al %. Si necesitas capturarlo fuera de esas fechas, pide al administrador que habilite el mes.',
        lpad(new.mes::text, 2, '0'), new.anio,
        to_char(v_vent.inicio_prellenado, 'DD/MM/YYYY'), to_char(v_vent.fin_envio, 'DD/MM/YYYY');
    end if;

    new.estado := 'BORRADOR';
    if tg_op = 'UPDATE' then
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
      new.excepcion_conciliacion := old.excepcion_conciliacion;
      new.excepcion_por := old.excepcion_por;
      new.excepcion_en := old.excepcion_en;
    else
      new.enviado_en := null;
      new.enviado_por := null;
      new.validado_en := null;
      new.validado_por := null;
      new.excepcion_conciliacion := null;
      new.excepcion_por := null;
      new.excepcion_en := null;
    end if;
    new.editado_por := 'UNIDAD';
    return new;
  end if;

  if v_rol in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then
    if v_rol = 'MUNICIPAL' and not (new.municipio = any(v_municipios_allowed)) then
      raise exception 'Fuera de tu alcance de municipios.';
    end if;

    if v_rol in ('MUNICIPAL', 'JURISDICCIONAL') and tg_op = 'UPDATE' then
      new.estado := old.estado;
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
      new.excepcion_conciliacion := old.excepcion_conciliacion;
      new.excepcion_por := old.excepcion_por;
      new.excepcion_en := old.excepcion_en;
    end if;
    if v_rol in ('MUNICIPAL', 'JURISDICCIONAL') and tg_op = 'INSERT' then
      new.excepcion_conciliacion := null;
      new.excepcion_por := null;
      new.excepcion_en := null;
    end if;

    if tg_op = 'UPDATE' and old.estado in ('ENVIADO', 'VALIDADO')
       and (new.valores is distinct from old.valores or new.ajustes is distinct from old.ajustes) then
      if new.ultimo_editor_usuario is null or length(trim(new.ultimo_editor_usuario)) = 0 then
        raise exception 'Falta identificar quién hizo el cambio (ultimo_editor_usuario).';
      end if;
    end if;

    if tg_op = 'UPDATE' and old.estado in ('ENVIADO', 'VALIDADO')
       and new.valores is distinct from old.valores then
      for v_fila in
        select distinct k from (
          select jsonb_object_keys(coalesce(old.valores, '{}'::jsonb)) k
          union
          select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) k
        ) t
      loop
        foreach v_kind in array array['total', 'afro', 'indigena', 'migrante']
        loop
          v_old_val := old.valores #>> array[v_fila, v_kind];
          v_new_val := new.valores #>> array[v_fila, v_kind];
          if coalesce(v_old_val, '0') is distinct from coalesce(v_new_val, '0') then
            insert into sis06p_correcciones
              (captura_id, clues, municipio, mes, anio, fila_excel, subconteo,
               usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
            values
              (new.id, new.clues, new.municipio, new.mes, new.anio, v_fila::int, v_kind,
               new.ultimo_editor_usuario, v_rol, coalesce(v_old_val, '0'), coalesce(v_new_val, '0'),
               'EDICION_MUNICIPAL', false);
          end if;
        end loop;
      end loop;
    end if;

    if tg_op = 'UPDATE' and old.estado in ('ENVIADO', 'VALIDADO')
       and new.ajustes is distinct from old.ajustes then
      for v_key in
        select distinct k from (
          select jsonb_object_keys(coalesce(old.ajustes, '{}'::jsonb)) k
          union
          select jsonb_object_keys(coalesce(new.ajustes, '{}'::jsonb)) k
        ) t
      loop
        v_old_val := coalesce(old.ajustes ->> v_key, '0');
        v_new_val := coalesce(new.ajustes ->> v_key, '0');
        if v_old_val::numeric is distinct from v_new_val::numeric then
          insert into sis06p_correcciones
            (captura_id, clues, municipio, mes, anio, detalle,
             usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
          values
            (new.id, new.clues, new.municipio, new.mes, new.anio,
             case v_key when 'SRP_COMO_SR' then 'Ajuste: SRP aplicada como SR' when 'SR_COMO_SRP' then 'Ajuste: SR aplicada como SRP' when 'DPT_COMO_TDPA' then 'Ajuste: DPT aplicada como TdPa' else 'Ajuste: TdPa aplicada como DPT' end,
             new.ultimo_editor_usuario, v_rol, v_old_val, v_new_val,
             'EDICION_MUNICIPAL', false);
        end if;
      end loop;
    end if;

    new.editado_por := v_rol;
    return new;
  end if;

  raise exception 'Rol % no autorizado para escribir en sis06p_capturas.', v_rol;
end;
$$;
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from public, anon, authenticated;

-- Nadie borra una captura ya enviada (solo el administrador, y solo a mano).
create or replace function sis06p_trg_20_no_borrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
begin
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then return old; end if;
  if (select auth.uid()) is null then return old; end if; -- operación interna de base de datos
  if old.estado = 'BORRADOR' then return old; end if;
  v_rol := _sis_rol_actual();
  if v_rol = 'ADMIN' then return old; end if;
  raise exception 'Un SIS enviado o validado no se puede borrar. Si hay que rehacerlo, pide al administrador.';
end;
$$;
revoke all on function sis06p_trg_20_no_borrar() from public, anon, authenticated;
drop trigger if exists trg_sis06p_20_no_borrar on sis06p_capturas;
create trigger trg_sis06p_20_no_borrar before delete on sis06p_capturas
  for each row execute function sis06p_trg_20_no_borrar();

-- ---------------------------------------------------------------------------
-- 4. Movimiento de Biológico: la unidad no escribe en un mes con SIS enviado
-- ---------------------------------------------------------------------------
create or replace function biovac_trg_10_bloqueo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_mov_id uuid := coalesce(new.movimiento_id, old.movimiento_id);
  v_clues text;
  v_anio int;
  v_mes int;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;

  select m.estado, bu.clues, m.anio, m.mes into v_estado, v_clues, v_anio, v_mes
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
  where m.id = v_mov_id;

  if v_estado = 'CERRADO' then
    raise exception 'El movimiento % está cerrado. Use biovac_abrir_correccion(...) antes de editar.', v_mov_id;
  end if;

  if _sis_rol_actual() = 'UNIDAD' and _sis06p_mes_bloqueado(v_clues, v_anio, v_mes) then
    raise exception 'El SINBA-SIS de %/% ya fue enviado: la unidad ya no puede modificar el Movimiento de Biológico. Pide la corrección al municipal.',
      lpad(v_mes::text, 2, '0'), v_anio;
  end if;

  return coalesce(new, old);
end;
$$;
revoke all on function biovac_trg_10_bloqueo() from public, anon, authenticated;

create or replace function biovac_trg_30_unidad_bloqueo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clues text;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;
  if _sis_rol_actual() = 'UNIDAD' then
    select bu.clues into v_clues from biovac_unidades bu where bu.id = old.unidad_id;
    if _sis06p_mes_bloqueado(v_clues, old.anio, old.mes) then
      raise exception 'El SINBA-SIS de %/% ya fue enviado: la unidad ya no puede modificar este Movimiento de Biológico.',
        lpad(old.mes::text, 2, '0'), old.anio;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function biovac_trg_30_unidad_bloqueo() from public, anon, authenticated;
drop trigger if exists trg_biovac_30_unidad_bloqueo on biovac_movimientos;
create trigger trg_biovac_30_unidad_bloqueo before update or delete on biovac_movimientos
  for each row execute function biovac_trg_30_unidad_bloqueo();

-- La unidad tampoco cierra/recalcula un movimiento cuyo SIS ya se envió
-- (p. ej. el que el municipal dejó EN_CORRECCION).
create or replace function _biovac_autoriza_movimiento(p_movimiento_id uuid, p_solo_revisor boolean) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_perfil perfiles%rowtype;
  v_clues text;
  v_municipio text;
  v_anio int;
  v_mes int;
  v_rol text;
  v_ok boolean := false;
begin
  if v_uid is null then
    if coalesce(auth.role(), '') in ('anon', 'authenticated') then
      raise exception 'Sesión no válida.';
    end if;
    return;
  end if;

  select * into v_perfil from perfiles where id = v_uid and activo = 'SI';
  if not found then raise exception 'Sesión no válida o perfil inactivo.'; end if;

  select bu.clues, bu.municipio, m.anio, m.mes into v_clues, v_municipio, v_anio, v_mes
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
  where m.id = p_movimiento_id;
  if not found then raise exception 'Movimiento % no existe', p_movimiento_id; end if;

  v_rol := upper(v_perfil.rol);
  if v_rol in ('ADMIN', 'JURISDICCIONAL') then v_ok := true;
  elsif v_rol = 'MUNICIPAL' then v_ok := _sis_municipal_alcanza(v_perfil, v_municipio);
  elsif v_rol = 'UNIDAD' and not p_solo_revisor then
    v_ok := (v_perfil.clues = v_clues);
    if v_ok and _sis06p_mes_bloqueado(v_clues, v_anio, v_mes) then
      raise exception 'El SINBA-SIS de %/% ya fue enviado: solo el municipal puede modificar este movimiento.', lpad(v_mes::text, 2, '0'), v_anio;
    end if;
  end if;

  if not v_ok then
    raise exception 'No tienes permiso para esta operación sobre este movimiento.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Excepción de conciliación (ADMIN / JURISDICCIONAL), con justificación
-- ---------------------------------------------------------------------------
create or replace function sis06p_validar_con_excepcion(p_captura_id uuid, p_usuario text, p_justificacion text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_clues text;
  v_municipio text;
  v_mes int;
  v_anio int;
  v_estado text;
  v_just text := trim(coalesce(p_justificacion, ''));
begin
  v_rol := _sis_rol_actual();
  if v_rol is null or v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    raise exception 'Solo la jurisdicción o el administrador pueden autorizar una excepción de conciliación.';
  end if;
  if length(v_just) < 15 then
    raise exception 'Escribe el motivo de la excepción (mínimo 15 caracteres): queda registrado en la auditoría.';
  end if;

  select clues, municipio, mes, anio, estado into v_clues, v_municipio, v_mes, v_anio, v_estado
  from sis06p_capturas where id = p_captura_id for update;
  if v_clues is null then raise exception 'Concentrado % no existe.', p_captura_id; end if;
  if v_estado <> 'ENVIADO' then
    raise exception 'Solo se puede validar con excepción un concentrado ENVIADO (estado actual: %).', v_estado;
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set excepcion_conciliacion = v_just, excepcion_por = p_usuario, excepcion_en = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad, detalle)
  values (p_captura_id, v_clues, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_EXCEPCION', true,
          'Validado con excepción de conciliación: ' || v_just);

  perform sis06p_marcar_validado(p_captura_id, p_usuario);
end;
$$;
revoke all on function sis06p_validar_con_excepcion(uuid, text, text) from public, anon;
grant execute on function sis06p_validar_con_excepcion(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Influenza: lo que cambie un revisor en un mes ya enviado queda en el
--    control de cambios de la unidad (mismo panel que SIS-06-P)
-- ---------------------------------------------------------------------------
create or replace function influenza_trg_auditoria_sis() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_clues text;
  v_fecha date;
  v_old jsonb;
  v_new jsonb;
  v_hist jsonb;
  v_usuario text;
  v_cap record;
  v_k text;
  v_a text;
  v_b text;
  v_clave text;
begin
  v_rol := _sis_rol_actual();
  if v_rol is null or v_rol = 'UNIDAD' then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    v_clues := old.clues; v_fecha := old.fecha; v_old := old.valores; v_new := '{}'::jsonb; v_hist := old.historial_ediciones;
  elsif tg_op = 'INSERT' then
    v_clues := new.clues; v_fecha := new.fecha; v_old := '{}'::jsonb; v_new := new.valores; v_hist := new.historial_ediciones;
  else
    v_clues := new.clues; v_fecha := new.fecha; v_old := old.valores; v_new := new.valores; v_hist := new.historial_ediciones;
  end if;

  select c.id, c.municipio, c.estado into v_cap
  from sis06p_capturas c
  where c.clues = v_clues and c.mes = extract(month from v_fecha)::int and c.anio = extract(year from v_fecha)::int;
  if v_cap.id is null or v_cap.estado = 'BORRADOR' then return coalesce(new, old); end if;

  v_usuario := coalesce(nullif(trim(coalesce(v_hist -> (jsonb_array_length(v_hist) - 1) ->> 'usuario', '')), ''), v_rol);

  for v_k in
    select distinct k from (
      select jsonb_object_keys(coalesce(v_old, '{}'::jsonb)) k
      union
      select jsonb_object_keys(coalesce(v_new, '{}'::jsonb)) k
    ) t
  loop
    v_a := coalesce(nullif(v_old ->> v_k, ''), '0');
    v_b := coalesce(nullif(v_new ->> v_k, ''), '0');
    if v_a ~ '^-?[0-9]+(\.[0-9]+)?$' and v_b ~ '^-?[0-9]+(\.[0-9]+)?$' and v_a::numeric <> v_b::numeric then
      select m.clave into v_clave from sis_influenza_mapa m where m.rubro = v_k;
      insert into sis06p_correcciones
        (captura_id, clues, municipio, mes, anio, detalle, usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
      values
        (v_cap.id, v_clues, v_cap.municipio, extract(month from v_fecha)::int, extract(year from v_fecha)::int,
         'Influenza, semana del ' || to_char(v_fecha, 'DD/MM') || ' (' || coalesce(v_clave, v_k) || ')',
         v_usuario, v_rol, v_a, v_b, 'EDICION_MUNICIPAL', false);
    end if;
  end loop;

  return coalesce(new, old);
end;
$$;
revoke all on function influenza_trg_auditoria_sis() from public, anon, authenticated;
drop trigger if exists influenza_trg_auditoria_sis on influenza_capturas;
create trigger influenza_trg_auditoria_sis after insert or update or delete on influenza_capturas
  for each row execute function influenza_trg_auditoria_sis();

-- ---------------------------------------------------------------------------
-- 7. Publicación a indicadores
-- ---------------------------------------------------------------------------
-- Además de "todas validadas", el paloteo y el Movimiento de cada unidad
-- deben seguir cuadrando (si un revisor corrigió algo después de validar).
create or replace function _sis_municipio_listo(p_mes int, p_anio int, p_municipio text, out v_rol text, out v_unidades text[])
returns record language plpgsql stable security definer set search_path = public as $$
declare
  v_perfil perfiles%rowtype;
  v_inicio date;
  v_faltan text;
  v_difs text;
begin
  select * into v_perfil from perfiles where id = auth.uid() and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then
    raise exception 'Rol % no puede publicar el SIS.', v_rol;
  end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;
  if p_mes not between 1 and 12 or p_anio is null then raise exception 'Mes/año inválidos.'; end if;

  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if v_inicio is not null and make_date(p_anio, p_mes, 1) < date_trunc('month', v_inicio)::date then
    raise exception 'Los meses anteriores al arranque (%) no se publican desde aquí: ya están cargados y no se tocan.', to_char(v_inicio, 'MM/YYYY');
  end if;

  select array_agg(bu.clues order by bu.clues) into v_unidades
  from biovac_unidades bu
  where bu.activo and bu.clues not like 'JS1-%' and bu.municipio = p_municipio;
  if v_unidades is null then raise exception 'El municipio % no tiene unidades activas.', p_municipio; end if;

  select string_agg(u.clues, ', ' order by u.clues) into v_faltan
  from unnest(v_unidades) u(clues)
  left join sis06p_capturas c on c.clues = u.clues and c.mes = p_mes and c.anio = p_anio
  where coalesce(c.estado, '') <> 'VALIDADO';
  if v_faltan is not null then
    raise exception 'Faltan por validar: %. Se publica hasta que TODAS las unidades del municipio estén validadas.', v_faltan;
  end if;

  select string_agg(u.clues || ' -> ' || x.d, ' | ' order by u.clues) into v_difs
  from unnest(v_unidades) u(clues)
  cross join lateral (select _sis06p_diferencias_texto(u.clues, p_mes, p_anio) as d) x
  where x.d is not null;
  if v_difs is not null then
    raise exception 'No se publica: el paloteo y el Movimiento de Biológico ya no coinciden en %. Corrígelo en modo revisión (o autoriza una excepción) y vuelve a intentar.', v_difs;
  end if;
end;
$$;

-- Dos publicaciones simultáneas del mismo municipio/mes se hacen una tras otra
-- (si no, ambas borran antes de insertar y quedan filas duplicadas).
create or replace function sis_publicar_registros_sis(p_mes int, p_anio int, p_municipio text, p_usuario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rol text; v_unidades text[]; v_pub text[]; v_omit text[];
  v_dup int; v_neg int; v_del int; v_ins int;
begin
  perform pg_advisory_xact_lock(hashtext('sis_publicar:' || p_anio::text || ':' || p_mes::text || ':' || coalesce(p_municipio, '')));

  select l.v_rol, l.v_unidades into v_rol, v_unidades from _sis_municipio_listo(p_mes, p_anio, p_municipio) l;

  insert into unidades_medicas (clues, nombre, municipio)
  select bu.clues, bu.nombre, bu.municipio from biovac_unidades bu where bu.clues = any (v_unidades)
  on conflict (clues) do nothing;

  select coalesce(array_agg(u.clues order by u.clues) filter (where exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[]),
         coalesce(array_agg(u.clues order by u.clues) filter (where not exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[])
    into v_pub, v_omit from unnest(v_unidades) u(clues);

  if coalesce(array_length(v_pub, 1), 0) = 0 then
    raise exception 'Ninguna unidad de % está en el catálogo de unidades médicas del SIS.', p_municipio;
  end if;

  drop table if exists _sis_pub;
  create temp table _sis_pub on commit drop as select * from _sis_filas_publicables(p_mes, p_anio, v_pub);

  select count(*) - count(distinct (clues, variable_sis)) into v_dup from _sis_pub;
  if v_dup > 0 then raise exception 'Se detectaron % clave(s) repetidas al armar las filas; no se publicó nada.', v_dup; end if;
  select count(*) into v_neg from _sis_pub where valor < 0;
  if v_neg > 0 then raise exception 'Hay % valor(es) negativos en la captura; no se publicó nada.', v_neg; end if;
  if not exists (select 1 from _sis_pub) then raise exception 'No hay filas que publicar; no se tocó nada.'; end if;

  delete from registros_sis r
  where r.anio = p_anio and r.mes = p_mes and r.clues = any (v_pub)
    and r.variable_sis in (select distinct variable_sis from _sis_pub);
  get diagnostics v_del = row_count;

  insert into registros_sis (clues, variable_sis, valor, mes, anio)
  select clues, variable_sis, valor, p_mes, p_anio from _sis_pub;
  get diagnostics v_ins = row_count;

  insert into sis_publicaciones (anio, mes, municipio, usuario, rol, filas_insertadas, filas_reemplazadas, clues_publicadas, clues_omitidas)
  values (p_anio, p_mes, p_municipio, p_usuario, v_rol, v_ins, v_del, v_pub, v_omit);

  return jsonb_build_object('ok', true, 'insertadas', v_ins, 'reemplazadas', v_del,
                            'clues_publicadas', v_pub, 'clues_omitidas', v_omit);
end;
$$;
revoke all on function sis_publicar_registros_sis(int, int, text, text) from public, anon;
grant execute on function sis_publicar_registros_sis(int, int, text, text) to authenticated;

-- Carga manual de CSV (panel RDA): antes borraba el mismo MES de TODOS los años
-- (p_meses no trae año). Ahora solo borra las parejas (año, mes) que el propio CSV trae.
create or replace function upsert_registros_sis(p_unidades jsonb, p_registros jsonb, p_meses integer[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_unidades_sync integer := 0;
  v_registros_del integer := 0;
  v_registros_ins integer := 0;
begin
  if not exists (
    select 1 from public.perfiles where id = auth.uid() and upper(rol) in ('ADMIN', 'JURISDICCIONAL')
  ) then
    raise exception 'Acceso denegado: se requiere rol ADMIN o JURISDICCIONAL';
  end if;

  insert into public.unidades_medicas (clues, nombre, municipio)
  select (u ->> 'clues'), (u ->> 'nombre'), (u ->> 'municipio')
  from jsonb_array_elements(p_unidades) as u
  on conflict (clues) do nothing;
  get diagnostics v_unidades_sync = row_count;

  delete from public.registros_sis r
  where r.mes = any (p_meses)
    and (r.anio, r.mes) in (
      select distinct (x ->> 'anio')::int, (x ->> 'mes')::int from jsonb_array_elements(p_registros) x
    );
  get diagnostics v_registros_del = row_count;

  insert into public.registros_sis (clues, variable_sis, valor, mes, anio)
  select (r ->> 'clues'), (r ->> 'variable_sis'), (r ->> 'valor')::integer, (r ->> 'mes')::integer, (r ->> 'anio')::integer
  from jsonb_array_elements(p_registros) as r;
  get diagnostics v_registros_ins = row_count;

  return jsonb_build_object('ok', true, 'unidades_nuevas', v_unidades_sync,
                            'registros_eliminados', v_registros_del, 'registros_insertados', v_registros_ins);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;
