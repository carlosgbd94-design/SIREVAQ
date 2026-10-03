-- ============================================================================
-- SINBA-SIS desde octubre 2026: cadena de existencias editable por el municipal
-- + publicación segura al concentrado que alimenta los indicadores (registros_sis)
--
-- 1. biovac_renglones.ajuste_anterior_frascos: la existencia anterior de un mes
--    es SIEMPRE  (existencia final del mes previo) + (ajuste manual). Así el
--    municipal puede poner 15 en octubre y 13 en noviembre sin romper la
--    secuencia: si después corrige octubre, noviembre se mueve por la misma
--    diferencia y su ajuste manual se conserva.
-- 2. biovac_aplicar_correccion / biovac_cerrar_mes arrastran con esa regla,
--    ponen en cero lo que ya no existe aguas arriba y NO dejan cerrar/corregir
--    un mes con existencia negativa o frasco a medias.
-- 3. Seguridad: abrir/aplicar/cerrar ya no son ejecutables por anon ni por
--    cualquiera que esté autenticado; y la unidad no puede cambiar el estado de
--    su propio movimiento por PostgREST (se saltaba el candado del envío).
-- 4. sis_publicar_registros_sis: carga a registros_sis SOLO los CLUES validados
--    de un municipio y SOLO las claves que maneja el SIS, en una transacción,
--    reemplazando lo anterior de esas mismas llaves (idempotente, sin duplicar,
--    sin tocar otros CLUES, otras claves ni meses previos al arranque).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Alcance de un municipal (misma regla que las políticas RLS de BioVac)
-- ---------------------------------------------------------------------------
create or replace function _sis_municipal_alcanza(p_perfil perfiles, p_municipio text) returns boolean
language sql immutable
as $$
  select p_municipio is not null and (
    p_municipio = p_perfil.municipio_asignado::text
    or p_municipio = any (coalesce(p_perfil.municipios_allowed, array[]::text[]))
    or p_municipio = any (string_to_array(coalesce(p_perfil.municipio_asignado::text, ''), ','))
    or p_municipio = any (string_to_array(coalesce(p_perfil.municipio::text, ''), ','))
  );
$$;
revoke all on function _sis_municipal_alcanza(perfiles, text) from public, anon;
grant execute on function _sis_municipal_alcanza(perfiles, text) to authenticated;

-- Autoriza una operación sobre un movimiento. p_solo_revisor = true: la unidad
-- NO puede (reabrir/corregir son de MUNICIPAL/JURISDICCIONAL/ADMIN).
create or replace function _biovac_autoriza_movimiento(p_movimiento_id uuid, p_solo_revisor boolean) returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil perfiles%rowtype;
  v_clues text;
  v_municipio text;
  v_rol text;
  v_ok boolean := false;
begin
  if v_uid is null then
    -- anon / authenticated sin sesión: fuera. service_role o conexión directa: se permite.
    if coalesce(auth.role(), '') in ('anon', 'authenticated') then
      raise exception 'Sesión no válida.';
    end if;
    return;
  end if;

  select * into v_perfil from perfiles where id = v_uid and activo = 'SI';
  if not found then raise exception 'Sesión no válida o perfil inactivo.'; end if;

  select bu.clues, bu.municipio into v_clues, v_municipio
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
  where m.id = p_movimiento_id;
  if not found then raise exception 'Movimiento % no existe', p_movimiento_id; end if;

  v_rol := upper(v_perfil.rol);
  if v_rol in ('ADMIN', 'JURISDICCIONAL') then v_ok := true;
  elsif v_rol = 'MUNICIPAL' then v_ok := _sis_municipal_alcanza(v_perfil, v_municipio);
  elsif v_rol = 'UNIDAD' and not p_solo_revisor then v_ok := (v_perfil.clues = v_clues);
  end if;

  if not v_ok then
    raise exception 'No tienes permiso para esta operación sobre este movimiento.';
  end if;
end;
$$;
revoke all on function _biovac_autoriza_movimiento(uuid, boolean) from public, anon;
grant execute on function _biovac_autoriza_movimiento(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ajuste manual de la existencia anterior
-- ---------------------------------------------------------------------------
alter table biovac_renglones add column if not exists ajuste_anterior_frascos numeric not null default 0;

-- Trigger de autocálculo: además del final, mantiene el ajuste cuando alguien
-- (no el motor) cambia la existencia anterior de un mes que ya tiene mes previo.
create or replace function biovac_trg_20_autocalc() returns trigger
language plpgsql
as $$
declare
  v_caducidad date;
  v_numero_lote text;
  v_fin_de_mes date;
  v_prev_final numeric;
  v_hay_prev boolean;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') <> 'on'
     and (tg_op = 'INSERT' or new.existencia_anterior_frascos is distinct from old.existencia_anterior_frascos) then
    select r2.existencia_final_frascos into v_prev_final
    from biovac_movimientos m
    join biovac_movimientos mp on mp.unidad_id = m.unidad_id and (mp.anio * 12 + mp.mes) = (m.anio * 12 + m.mes - 1)
    left join biovac_renglones r2 on r2.movimiento_id = mp.id and r2.lote_id = new.lote_id and r2.categoria = new.categoria
    where m.id = new.movimiento_id;
    v_hay_prev := found;
    if v_hay_prev then
      new.ajuste_anterior_frascos := coalesce(new.existencia_anterior_frascos, 0) - coalesce(v_prev_final, 0);
    else
      new.ajuste_anterior_frascos := 0;
    end if;
  end if;

  new.existencia_final_frascos := biovac_calc_existencia_final(
    new.lote_id,
    new.existencia_anterior_frascos,
    new.recibido_frascos,
    new.aplicadas_a,
    new.aplicadas_b,
    new.desechadas_a,
    new.desechadas_b
  );
  new.updated_at := now();

  if new.categoria = 'NORMAL' and coalesce(current_setting('biovac.bypass_validaciones', true), 'off') <> 'on' then
    select l.numero_lote, l.caducidad into v_numero_lote, v_caducidad
    from biovac_lotes l where l.id = new.lote_id;

    select (date_trunc('month', make_date(m.anio, m.mes, 1)) + interval '1 month' - interval '1 day')::date
      into v_fin_de_mes
    from biovac_movimientos m where m.id = new.movimiento_id;

    if v_caducidad is not null and v_fin_de_mes is not null and v_caducidad < v_fin_de_mes and new.existencia_final_frascos > 0 then
      raise exception 'El lote % está caducado (%) y aún registra existencia (%). Regístralo como desechado antes de guardar.',
        v_numero_lote, v_caducidad, new.existencia_final_frascos;
    end if;
  end if;

  return new;
end;
$$;

-- Respaldo: lo que hoy ya es distinto del cierre del mes previo (reclasificaciones,
-- capturas manuales, histórico importado) pasa a ser "ajuste" para que la primera
-- corrección en cascada solo propague CAMBIOS y no pise lo existente.
do $$
begin
  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);
  update biovac_renglones r
  set ajuste_anterior_frascos = coalesce(r.existencia_anterior_frascos, 0) - coalesce(rp.existencia_final_frascos, 0)
  from biovac_movimientos m
  join biovac_movimientos mp on mp.unidad_id = m.unidad_id and (mp.anio * 12 + mp.mes) = (m.anio * 12 + m.mes - 1)
  left join biovac_renglones rp on rp.movimiento_id = mp.id
  where m.id = r.movimiento_id
    and rp.lote_id is not distinct from r.lote_id
    and rp.categoria is not distinct from r.categoria
    and r.ajuste_anterior_frascos is distinct from (coalesce(r.existencia_anterior_frascos, 0) - coalesce(rp.existencia_final_frascos, 0));
  -- filas con mes previo pero sin renglón previo del mismo lote: el ajuste es toda su anterior
  update biovac_renglones r
  set ajuste_anterior_frascos = coalesce(r.existencia_anterior_frascos, 0)
  from biovac_movimientos m
  join biovac_movimientos mp on mp.unidad_id = m.unidad_id and (mp.anio * 12 + mp.mes) = (m.anio * 12 + m.mes - 1)
  where m.id = r.movimiento_id
    and not exists (select 1 from biovac_renglones rp where rp.movimiento_id = mp.id and rp.lote_id = r.lote_id and rp.categoria = r.categoria)
    and r.ajuste_anterior_frascos is distinct from coalesce(r.existencia_anterior_frascos, 0);
  perform set_config('biovac.bypass_lock', 'off', true);
  perform set_config('biovac.bypass_validaciones', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cerrar mes / abrir corrección / aplicar corrección
-- ---------------------------------------------------------------------------
create or replace function biovac_cerrar_mes(p_movimiento_id uuid, p_usuario text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_unidad uuid;
  v_anio int;
  v_mes int;
  v_next_anio int;
  v_next_mes int;
  v_next_id uuid;
  v_negativos int;
  v_fraccionarios int;
begin
  perform _biovac_autoriza_movimiento(p_movimiento_id, false);

  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  perform biovac_recalcular_movimiento(p_movimiento_id);

  select count(*) into v_negativos
  from biovac_renglones where movimiento_id = p_movimiento_id and existencia_final_frascos < 0;
  if v_negativos > 0 then
    perform set_config('biovac.bypass_lock', 'off', true);
    perform set_config('biovac.bypass_validaciones', 'off', true);
    raise exception 'No se puede cerrar: % renglón(es) con existencia final negativa', v_negativos;
  end if;

  select count(*) into v_fraccionarios
  from biovac_renglones r
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where r.movimiento_id = p_movimiento_id
    and r.categoria = 'NORMAL'
    and cb.frasco_desecho_mismo_dia
    and r.existencia_final_frascos <> round(r.existencia_final_frascos);
  if v_fraccionarios > 0 then
    perform set_config('biovac.bypass_lock', 'off', true);
    perform set_config('biovac.bypass_validaciones', 'off', true);
    raise exception 'No se puede cerrar: % renglón(es) de biológicos que se desechan el mismo día de abrirse (BCG/SR) quedan con un frasco a medio resolver. Completa las dosis aplicadas/desechadas de esos renglones antes de cerrar.', v_fraccionarios;
  end if;

  select unidad_id, anio, mes into v_unidad, v_anio, v_mes
  from biovac_movimientos where id = p_movimiento_id;
  if v_unidad is null then raise exception 'Movimiento % no existe', p_movimiento_id; end if;

  update biovac_movimientos
  set estado = 'CERRADO', cerrado_en = now(), cerrado_por = p_usuario, updated_at = now()
  where id = p_movimiento_id;

  v_next_anio := v_anio;
  v_next_mes := v_mes + 1;
  if v_next_mes > 12 then v_next_anio := v_anio + 1; v_next_mes := 1; end if;

  insert into biovac_movimientos (unidad_id, anio, mes)
  values (v_unidad, v_next_anio, v_next_mes)
  on conflict (unidad_id, anio, mes) do nothing;

  select id into v_next_id
  from biovac_movimientos where unidad_id = v_unidad and anio = v_next_anio and mes = v_next_mes;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
  select v_next_id, r.lote_id, r.categoria, r.existencia_final_frascos
  from biovac_renglones r
  where r.movimiento_id = p_movimiento_id and r.existencia_final_frascos <> 0
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = excluded.existencia_anterior_frascos + biovac_renglones.ajuste_anterior_frascos;

  -- lo que ya existía en el mes siguiente y ya no viene del cierre: queda solo con su ajuste
  update biovac_renglones n
  set existencia_anterior_frascos = n.ajuste_anterior_frascos
  where n.movimiento_id = v_next_id
    and n.existencia_anterior_frascos is distinct from n.ajuste_anterior_frascos
    and not exists (
      select 1 from biovac_renglones r
      where r.movimiento_id = p_movimiento_id and r.lote_id = n.lote_id and r.categoria = n.categoria
        and r.existencia_final_frascos <> 0);

  perform biovac_recalcular_movimiento(v_next_id);

  perform set_config('biovac.bypass_lock', 'off', true);
  perform set_config('biovac.bypass_validaciones', 'off', true);
  return v_next_id;
end;
$$;

create or replace function biovac_abrir_correccion(
  p_movimiento_id uuid, p_usuario text, p_rol text, p_motivo text, p_tipo text default 'REAPERTURA'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_estado text;
begin
  perform _biovac_autoriza_movimiento(p_movimiento_id, true);

  select estado into v_estado from biovac_movimientos where id = p_movimiento_id;
  if v_estado is null then raise exception 'Movimiento % no existe', p_movimiento_id; end if;
  if v_estado <> 'CERRADO' then
    raise exception 'Solo se puede abrir corrección sobre un mes CERRADO (estado actual: %)', v_estado;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo de la corrección es obligatorio';
  end if;

  update biovac_movimientos set estado = 'EN_CORRECCION', updated_at = now() where id = p_movimiento_id;

  insert into biovac_correcciones (movimiento_id, usuario, rol, motivo, tipo, cascade_batch_id)
  values (p_movimiento_id, p_usuario, p_rol, p_motivo, p_tipo, v_batch);

  return v_batch;
end;
$$;

create or replace function biovac_aplicar_correccion(
  p_movimiento_id uuid, p_usuario text, p_cascade_batch_id uuid default null
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_unidad uuid;
  v_anio int;
  v_mes int;
  v_estado text;
  v_current_id uuid := p_movimiento_id;
  v_next_anio int;
  v_next_mes int;
  v_next_id uuid;
  v_next_estado text;
  v_meses_tocados int := 0;
  v_movimientos_tocados uuid[] := array[]::uuid[];
  v_malos int;
  v_detalle text;
begin
  perform _biovac_autoriza_movimiento(p_movimiento_id, true);

  select unidad_id, anio, mes, estado into v_unidad, v_anio, v_mes, v_estado
  from biovac_movimientos where id = p_movimiento_id;
  if v_unidad is null then raise exception 'Movimiento % no existe', p_movimiento_id; end if;
  if v_estado <> 'EN_CORRECCION' then
    raise exception 'Solo se puede guardar una corrección de un mes en corrección (estado actual: %)', v_estado;
  end if;

  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  perform biovac_recalcular_movimiento(p_movimiento_id);

  -- el mes corregido debe quedar sano igual que al cerrarlo
  select count(*) into v_malos from biovac_renglones where movimiento_id = p_movimiento_id and existencia_final_frascos < 0;
  if v_malos > 0 then
    raise exception 'No se puede guardar la corrección: % renglón(es) quedan con existencia final negativa.', v_malos;
  end if;
  select count(*) into v_malos
  from biovac_renglones r
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where r.movimiento_id = p_movimiento_id and r.categoria = 'NORMAL'
    and cb.frasco_desecho_mismo_dia and r.existencia_final_frascos <> round(r.existencia_final_frascos);
  if v_malos > 0 then
    raise exception 'No se puede guardar la corrección: % renglón(es) de BCG/SR quedan con un frasco a medio resolver.', v_malos;
  end if;

  update biovac_movimientos set estado = 'CERRADO', fue_corregido = true, updated_at = now()
  where id = p_movimiento_id;

  v_meses_tocados := 1;
  v_movimientos_tocados := array_append(v_movimientos_tocados, p_movimiento_id);

  loop
    v_next_anio := v_anio;
    v_next_mes := v_mes + 1;
    if v_next_mes > 12 then v_next_anio := v_anio + 1; v_next_mes := 1; end if;

    select id, estado into v_next_id, v_next_estado
    from biovac_movimientos where unidad_id = v_unidad and anio = v_next_anio and mes = v_next_mes;
    exit when v_next_id is null;

    -- anterior del mes siguiente = final de este mes + ajuste manual del siguiente
    insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
    select v_next_id, r.lote_id, r.categoria, r.existencia_final_frascos
    from biovac_renglones r
    where r.movimiento_id = v_current_id and r.existencia_final_frascos <> 0
    on conflict (movimiento_id, lote_id, categoria)
    do update set existencia_anterior_frascos = excluded.existencia_anterior_frascos + biovac_renglones.ajuste_anterior_frascos;

    -- lo que este mes ya no deja (final 0 o renglón borrado) no puede seguir arrastrándose
    update biovac_renglones n
    set existencia_anterior_frascos = n.ajuste_anterior_frascos
    where n.movimiento_id = v_next_id
      and n.existencia_anterior_frascos is distinct from n.ajuste_anterior_frascos
      and not exists (
        select 1 from biovac_renglones r
        where r.movimiento_id = v_current_id and r.lote_id = n.lote_id and r.categoria = n.categoria
          and r.existencia_final_frascos <> 0);

    perform biovac_recalcular_movimiento(v_next_id);

    -- un mes ya CERRADO no puede quedar negativo por una corrección anterior: se avisa cuál ajustar
    if v_next_estado = 'CERRADO' then
      select string_agg(l.numero_lote || ' (' || round(r.existencia_final_frascos, 2) || ')', ', ')
        into v_detalle
      from biovac_renglones r join biovac_lotes l on l.id = r.lote_id
      where r.movimiento_id = v_next_id and r.existencia_final_frascos < 0;
      if v_detalle is not null then
        raise exception 'La corrección dejaría en negativo el mes %/% (lote %). Corrige primero ese mes (aplicadas/desechadas) o reduce lo corregido.',
          lpad(v_next_mes::text, 2, '0'), v_next_anio, v_detalle;
      end if;
    end if;

    update biovac_movimientos set fue_corregido = true, updated_at = now() where id = v_next_id;

    insert into biovac_correcciones (movimiento_id, usuario, rol, motivo, tipo, cascade_batch_id)
    values (v_next_id, p_usuario, 'SISTEMA', 'Recálculo en cascada por corrección de mes anterior', 'EDICION', p_cascade_batch_id);

    v_meses_tocados := v_meses_tocados + 1;
    v_movimientos_tocados := array_append(v_movimientos_tocados, v_next_id);
    v_current_id := v_next_id;
    v_anio := v_next_anio;
    v_mes := v_next_mes;
  end loop;

  update biovac_informes_jurisdiccionales inf
  set estado = 'CON_CORRECCIONES_POSTERIORES'
  from biovac_movimientos m, biovac_unidades u
  where m.unidad_id = u.id
    and u.jurisdiccion_id = inf.jurisdiccion_id
    and inf.anio = m.anio and inf.mes = m.mes
    and inf.estado = 'GENERADO'
    and m.id = any (v_movimientos_tocados);

  perform set_config('biovac.bypass_lock', 'off', true);
  perform set_config('biovac.bypass_validaciones', 'off', true);

  return v_meses_tocados;
end;
$$;

revoke all on function biovac_cerrar_mes(uuid, text) from public, anon;
revoke all on function biovac_abrir_correccion(uuid, text, text, text, text) from public, anon;
revoke all on function biovac_aplicar_correccion(uuid, text, uuid) from public, anon;
grant execute on function biovac_cerrar_mes(uuid, text) to authenticated;
grant execute on function biovac_abrir_correccion(uuid, text, text, text, text) to authenticated;
grant execute on function biovac_aplicar_correccion(uuid, text, uuid) to authenticated;

-- La unidad (o cualquiera por PostgREST) no cambia el ESTADO de un movimiento a
-- mano: solo lo hacen las funciones de arriba (corren como dueño, no como
-- 'authenticated'). Sin esto, la unidad podía reabrir su mes ya enviado.
create or replace function biovac_trg_movimiento_estado() returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado and current_user in ('authenticated', 'anon') then
    raise exception 'El estado del movimiento solo cambia con Cerrar mes / Corregir movimiento.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_biovac_movimiento_estado on biovac_movimientos;
create trigger trg_biovac_movimiento_estado
before update on biovac_movimientos
for each row execute function biovac_trg_movimiento_estado();

-- ---------------------------------------------------------------------------
-- 3. Publicación a registros_sis
-- ---------------------------------------------------------------------------
create table if not exists sis_influenza_mapa (rubro text primary key, clave text not null unique);
insert into sis_influenza_mapa (rubro, clave) values
 ('r1','BIE01'),('r2','BIE28'),('r3','BIE29'),('r4','BIE30'),('r5','BIE31'),
 ('r6','BIE04'),('r7','BIE32'),('r8','BIE33'),('r9','BIE34'),('r10','BIE35'),
 ('r11','BIE36'),('r12','BIE37'),('r13','BIE38'),('r14','BIE39'),('r15','BIE40'),
 ('r16','BIO96'),('r17','BIO97'),
 ('r18','BIE09'),('r19','BIE10'),('r20','BIE41'),
 ('r21','BIE12'),('r22','BIE13'),('r23','BIE42'),
 ('r24','BIE15'),('r25','BIE16'),('r26','BIE43'),
 ('r27','BIE18'),('r28','BIE19'),('r29','BIE44'),
 ('r30','BIE48'),('r31','BIE49'),('r32','BIE50'),
 ('r33','BIE24'),('r34','BIE25'),('r35','BIE46'),
 ('r36','BIE51'),('r37','BIE52'),('r38','BIE53'),
 ('r39','BIE54'),('r40','BIE55'),
 ('r41','BIE56'),('r42','BIE57'),('r43','BIE58'),
 ('r44','BIE59'),('r45','BIE60'),('r46','BIE61')
on conflict (rubro) do nothing;
alter table sis_influenza_mapa enable row level security;
drop policy if exists "RLS_sis_influenza_mapa_Read" on sis_influenza_mapa;
create policy "RLS_sis_influenza_mapa_Read" on sis_influenza_mapa for select to authenticated using (true);

create table if not exists sis_publicaciones (
  id uuid primary key default gen_random_uuid(),
  anio int not null,
  mes int not null,
  municipio text not null,
  usuario text,
  rol text,
  filas_insertadas int not null,
  filas_reemplazadas int not null,
  clues_publicadas text[] not null default '{}',
  clues_omitidas text[] not null default '{}',
  creado_en timestamptz not null default now()
);
create index if not exists idx_sis_publicaciones_mes on sis_publicaciones (anio, mes, municipio, creado_en desc);
alter table sis_publicaciones enable row level security;
drop policy if exists "RLS_sis_publicaciones_Read" on sis_publicaciones;
create policy "RLS_sis_publicaciones_Read" on sis_publicaciones for select to authenticated
using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'
  and (upper(p.rol) in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
       or (upper(p.rol) = 'MUNICIPAL' and _sis_municipal_alcanza(p, sis_publicaciones.municipio)))));

-- Filas EXACTAS que alimentan registros_sis para un conjunto de CLUES (y de las
-- que sale el CSV): las 4 claves de cada variable del paloteo (aun en 0, igual
-- que la rejilla histórica) + las claves de Influenza leídas del mes.
create or replace function _sis_filas_publicables(p_mes int, p_anio int, p_clues text[])
returns table (clues text, municipio text, variable_sis text, valor int)
language sql stable security definer set search_path = public
as $$
  with caps as (
    select c.clues, c.municipio, c.valores from sis06p_capturas c
    where c.mes = p_mes and c.anio = p_anio and c.clues = any (p_clues) and c.estado = 'VALIDADO'
  ),
  paloteo as (
    select c.clues, c.municipio, v.clave_general as k,
           round(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'total', ''), '0')::numeric)::int as val
    from caps c cross join sis_variables v where v.activo and v.clave_general is not null
    union all
    select c.clues, c.municipio, v.clave_afro,
           round(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'afro', ''), '0')::numeric)::int
    from caps c cross join sis_variables v where v.activo and v.clave_afro is not null
    union all
    select c.clues, c.municipio, v.clave_indigena,
           round(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'indigena', ''), '0')::numeric)::int
    from caps c cross join sis_variables v where v.activo and v.clave_indigena is not null
    union all
    select c.clues, c.municipio, v.clave_migrante,
           round(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'migrante', ''), '0')::numeric)::int
    from caps c cross join sis_variables v where v.activo and v.clave_migrante is not null
  ),
  influenza as (
    select c.clues, c.municipio, m.clave as k,
           round(coalesce((
             select sum(coalesce(nullif(ic.valores ->> m.rubro, ''), '0')::numeric)
             from influenza_capturas ic
             where ic.clues = c.clues
               and ic.fecha >= make_date(p_anio, p_mes, 1)
               and ic.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date
           ), 0))::int as val
    from caps c cross join sis_influenza_mapa m
  )
  select clues, municipio, k, val from paloteo
  union all
  select clues, municipio, k, val from influenza;
$$;
revoke all on function _sis_filas_publicables(int, int, text[]) from public, anon, authenticated;

-- Valida rol/alcance/arranque/validación completa; devuelve los CLUES del municipio.
create or replace function _sis_municipio_listo(p_mes int, p_anio int, p_municipio text, out v_rol text, out v_unidades text[])
language plpgsql stable security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_inicio date;
  v_faltan text;
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
end;
$$;
revoke all on function _sis_municipio_listo(int, int, text) from public, anon;
grant execute on function _sis_municipio_listo(int, int, text) to authenticated;

-- Filas (para el CSV de descarga). Mismo origen y mismas validaciones que publicar.
create or replace function sis_filas_csv(p_mes int, p_anio int, p_municipio text)
returns table (clues text, municipio text, variable_sis text, valor int)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_rol text;
  v_unidades text[];
begin
  select l.v_rol, l.v_unidades into v_rol, v_unidades from _sis_municipio_listo(p_mes, p_anio, p_municipio) l;
  return query
    select f.clues, f.municipio, f.variable_sis, f.valor
    from _sis_filas_publicables(p_mes, p_anio, v_unidades) f
    order by f.clues, f.variable_sis;
end;
$$;
revoke all on function sis_filas_csv(int, int, text) from public, anon;
grant execute on function sis_filas_csv(int, int, text) to authenticated;

create or replace function sis_publicar_registros_sis(p_mes int, p_anio int, p_municipio text, p_usuario text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_rol text;
  v_unidades text[];
  v_pub text[];
  v_omit text[];
  v_dup int;
  v_neg int;
  v_del int;
  v_ins int;
begin
  select l.v_rol, l.v_unidades into v_rol, v_unidades from _sis_municipio_listo(p_mes, p_anio, p_municipio) l;

  -- registros_sis.clues apunta al catálogo unidades_medicas: lo que no esté ahí no se puede cargar
  select coalesce(array_agg(u.clues order by u.clues) filter (where exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[]),
         coalesce(array_agg(u.clues order by u.clues) filter (where not exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[])
    into v_pub, v_omit
  from unnest(v_unidades) u(clues);

  if coalesce(array_length(v_pub, 1), 0) = 0 then
    raise exception 'Ninguna unidad de % está en el catálogo de unidades médicas del SIS.', p_municipio;
  end if;

  drop table if exists _sis_pub;
  create temp table _sis_pub on commit drop as
    select * from _sis_filas_publicables(p_mes, p_anio, v_pub);

  select count(*) - count(distinct (clues, variable_sis)) into v_dup from _sis_pub;
  if v_dup > 0 then
    raise exception 'Se detectaron % clave(s) repetidas al armar las filas; no se publicó nada.', v_dup;
  end if;
  select count(*) into v_neg from _sis_pub where valor < 0;
  if v_neg > 0 then
    raise exception 'Hay % valor(es) negativos en la captura; no se publicó nada.', v_neg;
  end if;

  -- Reemplaza SOLO las mismas llaves (clues x clave) del mismo mes: no toca otros CLUES, otras claves ni otros meses.
  delete from registros_sis r
  where r.anio = p_anio and r.mes = p_mes
    and r.clues = any (v_pub)
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

-- Estado de la publicación: ¿ya se publicó? ¿hubo cambios después?
create or replace function sis_estado_publicacion(p_mes int, p_anio int, p_municipio text)
returns table (publicado_en timestamptz, publicado_por text, filas int, desactualizada boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_pub sis_publicaciones%rowtype;
  v_cambio timestamptz;
begin
  select * into v_perfil from perfiles where id = auth.uid() and activo = 'SI';
  if not found or upper(v_perfil.rol) not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'VISUALIZADOR_JURISDICCIONAL') then return; end if;
  if upper(v_perfil.rol) = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then return; end if;

  select * into v_pub from sis_publicaciones
  where anio = p_anio and mes = p_mes and municipio = p_municipio order by creado_en desc limit 1;
  if not found then return; end if;

  select greatest(
    coalesce((select max(c.updated_at) from sis06p_capturas c where c.mes = p_mes and c.anio = p_anio and c.clues = any (v_pub.clues_publicadas)), '-infinity'),
    coalesce((select max(ic.updated_at) from influenza_capturas ic
              where ic.clues = any (v_pub.clues_publicadas)
                and ic.fecha >= make_date(p_anio, p_mes, 1)
                and ic.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date), '-infinity'))
    into v_cambio;

  return query select v_pub.creado_en, v_pub.usuario, v_pub.filas_insertadas, (v_cambio > v_pub.creado_en);
end;
$$;
revoke all on function sis_estado_publicacion(int, int, text) from public, anon;
grant execute on function sis_estado_publicacion(int, int, text) to authenticated;
