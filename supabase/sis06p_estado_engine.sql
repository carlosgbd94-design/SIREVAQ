-- NOTA: sis06p_enviar_para_validacion, sis06p_marcar_validado y
-- sis06p_resumen_seguimiento se REDEFINEN en sis06p_reconciliacion.sql
-- (conciliación paloteo vs Movimiento, envío+cierre atómico). Ejecutar ese
-- archivo DESPUÉS de este -- las versiones de aquí abajo quedan reemplazadas.
-- ============================================================================
-- SIS-06-P — Motor de flujo de estatus (envío -> validación municipal ->
-- aceptación de cambios por la unidad).
--
-- Requiere sis_schema.sql ya aplicado. Modelo calcado del sistema de
-- corrección de BioVac (biovac_engine.sql / biovac_jurisdiccion.sql) pero
-- corrigiendo dos huecos reales que tiene ese sistema:
--   1. Sus funciones reciben p_rol como parámetro del cliente y lo confían
--      sin validar -- aquí NINGUNA función acepta p_rol, todas resuelven el
--      rol real leyendo perfiles por auth.uid().
--   2. biovac_reconocer_correccion no valida que la corrección pertenezca a
--      quien la reconoce -- aquí sí, siempre.
--
-- Diferencia deliberada de diseño: en vez de una función RPC dedicada para
-- "guardar corrección" (que el frontend debe recordar llamar), un trigger
-- BEFORE UPDATE diffea automáticamente el jsonb `valores` cuando quien
-- escribe es MUNICIPAL/JURISDICCIONAL/ADMIN sobre una fila ENVIADO/VALIDADO.
-- La auditoría no depende de qué botón se apretó, depende de qué cambió.
--
-- Piezas:
--   1. Columnas nuevas en sis06p_capturas
--   2. Tabla sis06p_correcciones (auditoría campo a campo)
--   3. Tabla sis06p_calendario_override (ventana administrable)
--   4. RLS de ambas tablas nuevas
--   5. sis06p_ventana_envio(anio, mes)              lectura, ventana de fechas
--   6. sis06p_trg_10_bloqueo_y_auditoria             trigger BEFORE INSERT/UPDATE
--   7. sis06p_enviar_para_validacion(captura_id, usuario)
--   8. sis06p_marcar_validado(captura_id, usuario)
--   9. sis06p_reconocer_correccion(correccion_id, usuario)
--  10. sis06p_reconocer_todas(captura_id, usuario)
--  11. sis06p_resumen_seguimiento(mes, anio)         dashboard MUNICIPAL/JURIS/ADMIN
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas en sis06p_capturas
-- ---------------------------------------------------------------------------

alter table sis06p_capturas
  add column if not exists estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','ENVIADO','VALIDADO')),
  add column if not exists enviado_en timestamptz,
  add column if not exists enviado_por text,
  add column if not exists validado_en timestamptz,
  add column if not exists validado_por text,
  add column if not exists ultimo_editor_usuario text;

comment on column sis06p_capturas.editado_por is
  'Rol real (UNIDAD/MUNICIPAL/JURISDICCIONAL/ADMIN) de quien tocó valores por última vez -- lo fuerza el trigger, nunca lo manda el cliente.';
comment on column sis06p_capturas.ultimo_editor_usuario is
  'Nombre para mostrar de quien hizo el último UPDATE -- lo llena el cliente antes de guardar; el trigger lo exige cuando MUNICIPAL+ edita un mes ya ENVIADO/VALIDADO, para poder auditar quién hizo el cambio.';

-- ---------------------------------------------------------------------------
-- 2. Auditoría campo a campo (mirror de biovac_correcciones)
-- ---------------------------------------------------------------------------

create table if not exists sis06p_correcciones (
  id uuid primary key default gen_random_uuid(),
  captura_id uuid not null references sis06p_capturas(id) on delete cascade,
  clues text not null,
  municipio text,
  mes int not null,
  anio int not null,
  fila_excel int,
  subconteo text check (subconteo in ('total','afro','indigena','migrante')),
  usuario text not null,
  rol text not null,
  valor_anterior text,
  valor_nuevo text,
  tipo text not null check (tipo in ('EDICION_MUNICIPAL','MARCADOR_ENVIADO','MARCADOR_VALIDADO')),
  reconocido_por_unidad boolean not null default false,
  reconocido_en timestamptz,
  reconocido_por text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_sis06p_correcciones_captura on sis06p_correcciones(captura_id);
create index if not exists idx_sis06p_correcciones_pendientes
  on sis06p_correcciones(clues) where tipo = 'EDICION_MUNICIPAL' and reconocido_por_unidad = false;

-- ---------------------------------------------------------------------------
-- 3. Ventana administrable (tabla propia -- NO calendario_pedidos, que es
--    del dominio de BIO en main.js)
-- ---------------------------------------------------------------------------

create table if not exists sis06p_calendario_override (
  id uuid primary key default gen_random_uuid(),
  anio int not null,
  mes int not null,
  habilitar_desde date not null,
  habilitar_hasta date not null,
  motivo text,
  activo boolean not null default true,
  creado_por text,
  creado_en timestamptz not null default now(),
  unique (anio, mes)
);

-- ---------------------------------------------------------------------------
-- 4. RLS de las tablas nuevas
-- ---------------------------------------------------------------------------

alter table sis06p_correcciones enable row level security;

drop policy if exists "RLS_sis06p_correcciones_Read" on sis06p_correcciones;
create policy "RLS_sis06p_correcciones_Read" on sis06p_correcciones for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = (select auth.uid()) and p.activo = 'SI'
        and (
          upper(p.rol) in ('ADMIN','JURISDICCIONAL')
          or (upper(p.rol) = 'MUNICIPAL' and sis06p_correcciones.municipio = any(p.municipios_allowed))
          or (upper(p.rol) = 'UNIDAD' and p.clues = sis06p_correcciones.clues)
        )
    )
  );
-- Sin policy de escritura para clientes: solo las funciones SECURITY DEFINER
-- de abajo escriben aquí (evaden RLS por diseño, igual que biovac_correcciones).

alter table sis06p_calendario_override enable row level security;

drop policy if exists "RLS_sis06p_calendario_Read" on sis06p_calendario_override;
create policy "RLS_sis06p_calendario_Read" on sis06p_calendario_override for select to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI'));

drop policy if exists "RLS_sis06p_calendario_Write_Admin" on sis06p_calendario_override;
create policy "RLS_sis06p_calendario_Write_Admin" on sis06p_calendario_override for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'ADMIN'))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'ADMIN'));

-- ---------------------------------------------------------------------------
-- 5. Ventana de envío -- último día del mes ± 7 días, o el override activo.
--    No es SECURITY DEFINER (no necesita evadir RLS, solo lee una tabla de
--    lectura abierta); se llama desde JS para pintar el banner Y desde
--    sis06p_enviar_para_validacion para revalidar server-side.
-- ---------------------------------------------------------------------------

create or replace function sis06p_ventana_envio(p_anio int, p_mes int)
returns table (
  inicio_prellenado date,
  inicio_envio date,
  fin_envio date,
  dentro_prellenado boolean,
  dentro_envio boolean,
  override_activo boolean
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_fin_mes date;
  v_inicio_envio date;
  v_fin_envio date;
  v_override record;
begin
  v_fin_mes := (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_inicio_envio := v_fin_mes;
  v_fin_envio := v_fin_mes + 7;

  select * into v_override
  from sis06p_calendario_override
  where anio = p_anio and mes = p_mes and activo = true
  limit 1;

  if v_override.id is not null then
    v_inicio_envio := v_override.habilitar_desde;
    v_fin_envio := v_override.habilitar_hasta;
  end if;

  inicio_prellenado := v_fin_mes - 7;
  inicio_envio := v_inicio_envio;
  fin_envio := v_fin_envio;
  dentro_envio := current_date between v_inicio_envio and v_fin_envio;
  dentro_prellenado := current_date between (v_fin_mes - 7) and v_fin_envio;
  override_activo := (v_override.id is not null);

  return next;
end;
$$;

grant execute on function sis06p_ventana_envio(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Trigger de bloqueo + auditoría automática
-- ---------------------------------------------------------------------------

create or replace function sis06p_trg_10_bloqueo_y_auditoria() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues text;
  v_municipios_allowed text[];
  v_fila text;
  v_kind text;
  v_old_val text;
  v_new_val text;
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
    if TG_OP = 'UPDATE' and old.estado <> 'BORRADOR' then
      raise exception 'Este concentrado ya fue enviado (estado: %). No puedes editarlo directamente.', old.estado;
    end if;
    new.estado := 'BORRADOR';
    if TG_OP = 'UPDATE' then
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
    else
      new.enviado_en := null;
      new.enviado_por := null;
      new.validado_en := null;
      new.validado_por := null;
    end if;
    new.editado_por := 'UNIDAD';
    return new;
  end if;

  if v_rol in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    if v_rol = 'MUNICIPAL' and not (new.municipio = any(v_municipios_allowed)) then
      raise exception 'Fuera de tu alcance de municipios.';
    end if;

    if v_rol in ('MUNICIPAL','JURISDICCIONAL') and TG_OP = 'UPDATE' then
      new.estado := old.estado;
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
    end if;

    if TG_OP = 'UPDATE' and old.estado in ('ENVIADO','VALIDADO')
       and new.valores is distinct from old.valores then
      if new.ultimo_editor_usuario is null or length(trim(new.ultimo_editor_usuario)) = 0 then
        raise exception 'Falta identificar quién hizo el cambio (ultimo_editor_usuario).';
      end if;

      for v_fila in
        select distinct k from (
          select jsonb_object_keys(coalesce(old.valores, '{}'::jsonb)) k
          union
          select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) k
        ) t
      loop
        foreach v_kind in array array['total','afro','indigena','migrante']
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

    new.editado_por := v_rol;
    return new;
  end if;

  raise exception 'Rol % no autorizado para escribir en sis06p_capturas.', v_rol;
end;
$$;

drop trigger if exists trg_sis06p_10_bloqueo on sis06p_capturas;
create trigger trg_sis06p_10_bloqueo
before insert or update on sis06p_capturas
for each row execute function sis06p_trg_10_bloqueo_y_auditoria();

-- Nadie debe poder invocar la función del trigger directamente vía RPC
-- (solo el motor de triggers de Postgres la llama, con NEW/OLD/TG_OP en
-- contexto) -- sin este revoke queda expuesta en /rest/v1/rpc/... a
-- cualquier rol, incluido anon.
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from public;
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from anon;
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from authenticated;

-- ---------------------------------------------------------------------------
-- 7. Enviar para validación (UNIDAD)
-- ---------------------------------------------------------------------------

create or replace function sis06p_enviar_para_validacion(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues_perfil text;
  v_clues_fila text;
  v_mes int;
  v_anio int;
  v_municipio text;
  v_estado text;
  v_ventana record;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is distinct from 'UNIDAD' then
    raise exception 'Solo la unidad puede enviar su propio concentrado.';
  end if;

  select clues, municipio, mes, anio, estado
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado
  from sis06p_capturas where id = p_captura_id
  for update;

  if v_clues_fila is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if v_clues_fila is distinct from v_clues_perfil then
    raise exception 'No puedes enviar el concentrado de otra unidad.';
  end if;
  if v_estado <> 'BORRADOR' then
    raise exception 'Este concentrado ya está en estado %, no se puede volver a enviar.', v_estado;
  end if;

  select * into v_ventana from sis06p_ventana_envio(v_anio, v_mes);
  if not v_ventana.dentro_envio then
    raise exception 'Fuera de la ventana de envío (% a %). Solo se puede enviar entre el último día del mes y la semana siguiente.',
      v_ventana.inicio_envio, v_ventana.fin_envio;
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'ENVIADO', enviado_en = now(), enviado_por = p_usuario,
      editado_por = 'UNIDAD', updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, 'UNIDAD', 'MARCADOR_ENVIADO', true);
end;
$$;

revoke all on function sis06p_enviar_para_validacion(uuid, text) from public;
revoke all on function sis06p_enviar_para_validacion(uuid, text) from anon;
grant execute on function sis06p_enviar_para_validacion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Marcar como validado (MUNICIPAL/JURISDICCIONAL/ADMIN)
-- ---------------------------------------------------------------------------

create or replace function sis06p_marcar_validado(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios_allowed text[];
  v_clues_fila text;
  v_municipio text;
  v_mes int;
  v_anio int;
  v_estado text;
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

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'VALIDADO', validado_en = now(), validado_por = p_usuario,
      editado_por = v_rol, updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_VALIDADO', true);
end;
$$;

revoke all on function sis06p_marcar_validado(uuid, text) from public;
revoke all on function sis06p_marcar_validado(uuid, text) from anon;
grant execute on function sis06p_marcar_validado(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9-10. Reconocer cambios (UNIDAD) -- corrige el hueco de autorización que
-- tiene biovac_reconocer_correccion (ahí no se valida pertenencia).
-- ---------------------------------------------------------------------------

create or replace function sis06p_reconocer_correccion(p_correccion_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues_perfil text;
  v_clues_correccion text;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is distinct from 'UNIDAD' then
    raise exception 'Solo la unidad puede aceptar sus propios cambios.';
  end if;

  select clues into v_clues_correccion
  from sis06p_correcciones
  where id = p_correccion_id and tipo = 'EDICION_MUNICIPAL';

  if v_clues_correccion is null then
    raise exception 'Corrección % no existe o no es de un tipo aceptable.', p_correccion_id;
  end if;
  if v_clues_correccion is distinct from v_clues_perfil then
    raise exception 'Esta corrección pertenece a otra unidad.';
  end if;

  update sis06p_correcciones
  set reconocido_por_unidad = true, reconocido_en = now(), reconocido_por = p_usuario
  where id = p_correccion_id;
end;
$$;

revoke all on function sis06p_reconocer_correccion(uuid, text) from public;
revoke all on function sis06p_reconocer_correccion(uuid, text) from anon;
grant execute on function sis06p_reconocer_correccion(uuid, text) to authenticated;

create or replace function sis06p_reconocer_todas(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues_perfil text;
  v_clues_captura text;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is distinct from 'UNIDAD' then
    raise exception 'Solo la unidad puede aceptar sus propios cambios.';
  end if;

  select clues into v_clues_captura from sis06p_capturas where id = p_captura_id;
  if v_clues_captura is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if v_clues_captura is distinct from v_clues_perfil then
    raise exception 'Este concentrado pertenece a otra unidad.';
  end if;

  update sis06p_correcciones
  set reconocido_por_unidad = true, reconocido_en = now(), reconocido_por = p_usuario
  where captura_id = p_captura_id and tipo = 'EDICION_MUNICIPAL' and reconocido_por_unidad = false;
end;
$$;

revoke all on function sis06p_reconocer_todas(uuid, text) from public;
revoke all on function sis06p_reconocer_todas(uuid, text) from anon;
grant execute on function sis06p_reconocer_todas(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Dashboard de seguimiento (MUNICIPAL/JURISDICCIONAL/ADMIN)
-- ---------------------------------------------------------------------------

create or replace function sis06p_resumen_seguimiento(p_mes int, p_anio int)
returns table (
  clues text,
  unidad text,
  municipio text,
  estado text,
  capturado_por text,
  enviado_por text,
  validado_por text,
  enviado_en timestamptz,
  validado_en timestamptz,
  correcciones_pendientes int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios_allowed text[];
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios_allowed
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    raise exception 'Rol % no tiene panel de seguimiento.', v_rol;
  end if;

  return query
  select
    bu.clues,
    bu.nombre,
    bu.municipio,
    -- Si la unidad ya abrió su Movimiento de Biológico del mes (botón "Crear
    -- movimiento") pero todavía no guarda el paloteo, ya está trabajando en
    -- "el SIS" (paloteo + movimiento son un solo archivo): cuenta como
    -- BORRADOR/"Capturando", no "Sin iniciar".
    coalesce(c.estado, case when m.id is not null then 'BORRADOR' else 'SIN_INICIAR' end),
    coalesce(c.capturado_por, m.responsable_elaboracion),
    c.enviado_por,
    c.validado_por,
    c.enviado_en,
    c.validado_en,
    coalesce((
      select count(*)::int from sis06p_correcciones sc
      where sc.captura_id = c.id and sc.tipo = 'EDICION_MUNICIPAL' and sc.reconocido_por_unidad = false
    ), 0)
  from biovac_unidades bu
  left join sis06p_capturas c
    on c.clues = bu.clues and c.mes = p_mes and c.anio = p_anio
  left join biovac_movimientos m
    on m.unidad_id = bu.id and m.mes = p_mes and m.anio = p_anio
  where bu.activo = true
    -- Las filas "pseudo" (municipios/hospitales, clues 'JS1-...') son solo
    -- para la captura de Movimiento a nivel municipal/hospital -- nunca
    -- envían SIS-06-P por sí mismas, así que no pintan nada en este
    -- seguimiento (antes salían siempre como "SIN_INICIAR", puro ruido).
    and bu.clues not like 'JS1-%'
    and (v_rol in ('JURISDICCIONAL','ADMIN') or bu.municipio = any(v_municipios_allowed))
  order by bu.clues;
end;
$$;

revoke all on function sis06p_resumen_seguimiento(int, int) from public;
revoke all on function sis06p_resumen_seguimiento(int, int) from anon;
grant execute on function sis06p_resumen_seguimiento(int, int) to authenticated;
