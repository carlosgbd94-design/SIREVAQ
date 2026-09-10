-- ============================================================================
-- BioVac — Motor de reglas (PL/pgSQL)
--
-- Requiere haber corrido biovac_schema.sql antes.
--
-- Piezas:
--   1. biovac_calc_existencia_final(...)   fórmula pura, según catálogo/lote
--   2. trg_biovac_10_bloqueo                bloquea escritura en mes CERRADO
--   3. trg_biovac_20_autocalc                calcula existencia_final_frascos
--   4. biovac_recalcular_movimiento(id)      re-dispara el cálculo de un mes
--   5. biovac_cerrar_mes(id, usuario)        cierra + siembra el mes siguiente
--   6. biovac_abrir_correccion(...)          reabre un mes CERRADO
--   7. biovac_aplicar_correccion(id, usuario) recalcula y cascada hacia adelante
--   8. biovac_validar_concentrado(...)       chequeos jurisdicción (solo lectura)
--   9. biovac_generar_informe_jurisdiccional(...)  snapshot para exportar
--  10. biovac_reclasificar_arf_normal(...)   dictamen resuelto: A.R.F. -> Normal
--  10b. biovac_reclasificar_normal_arf(...)  parte de un lote se manda a dictamen: Normal -> A.R.F.
--  11. biovac_resolver_canje(...)            canje resuelto: lote nuevo entra como Normal
--
-- Los triggers usan un bypass de sesión (biovac.bypass_lock) para que el
-- propio motor pueda escribir en meses ya CERRADOS al propagar una
-- corrección hacia adelante; un cliente normal jamás debe setear esa
-- variable (no se expone ningún RPC que la active sin pasar por
-- biovac_cerrar_mes / biovac_aplicar_correccion).
--
-- Un segundo bypass (biovac.bypass_validaciones) protege, con el mismo
-- criterio, el arrastre automático de existencia (dentro de
-- biovac_cerrar_mes/biovac_aplicar_correccion): sin él, un lote que se
-- vuelve "caducado dentro de su propio mes" solo por venir arrastrando
-- desde un mes anterior (o una fila de un histórico importado, capturado a
-- mano sin estas reglas) bloquearía el cierre/corrección por completo. Las
-- seguridades de biovac_trg_20_autocalc siguen aplicando siempre a la
-- captura en vivo de un usuario.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fórmula de existencia final
-- ---------------------------------------------------------------------------

create or replace function biovac_calc_existencia_final(
  p_lote_id uuid,
  p_anterior numeric,
  p_recibido numeric,
  p_aplicadas_a numeric,
  p_aplicadas_b numeric,
  p_desechadas_a numeric,
  p_desechadas_b numeric
) returns numeric
language plpgsql
stable
as $$
declare
  v_presentacion text;
  v_dosis numeric;
  v_regla text;
  v_aplicadas numeric;
  v_desechadas numeric;
begin
  select cb.presentacion,
         coalesce(l.dosis_por_frasco_override, cb.dosis_por_frasco),
         cb.regla_especial
    into v_presentacion, v_dosis, v_regla
  from biovac_lotes l
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where l.id = p_lote_id;

  if v_presentacion is null then
    raise exception 'Lote % no encontrado para calcular existencia final', p_lote_id;
  end if;

  if v_regla = 'SPLIT_DOSE' then
    v_aplicadas := coalesce(p_aplicadas_a, 0) / 2 + coalesce(p_aplicadas_b, 0);
    v_desechadas := coalesce(p_desechadas_a, 0) / 2 + coalesce(p_desechadas_b, 0);
  else
    v_aplicadas := coalesce(p_aplicadas_a, 0) + coalesce(p_aplicadas_b, 0);
    v_desechadas := coalesce(p_desechadas_a, 0) + coalesce(p_desechadas_b, 0);
  end if;

  if v_presentacion = 'UNIDOSIS' then
    return (coalesce(p_anterior, 0) + coalesce(p_recibido, 0)) - (v_aplicadas + v_desechadas);
  else -- MULTIDOSIS
    if v_dosis is null or v_dosis = 0 then
      raise exception 'Biológico del lote % es MULTIDOSIS pero no tiene dosis_por_frasco válida', p_lote_id;
    end if;
    return ((coalesce(p_anterior, 0) + coalesce(p_recibido, 0)) * v_dosis - (v_aplicadas + v_desechadas)) / v_dosis;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Bloqueo de meses cerrados
-- ---------------------------------------------------------------------------

create or replace function biovac_trg_10_bloqueo() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;

  select estado into v_estado
  from biovac_movimientos
  where id = coalesce(new.movimiento_id, old.movimiento_id);

  if v_estado = 'CERRADO' then
    raise exception 'El movimiento % está cerrado. Use biovac_abrir_correccion(...) antes de editar.',
      coalesce(new.movimiento_id, old.movimiento_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_biovac_10_bloqueo on biovac_renglones;
create trigger trg_biovac_10_bloqueo
before insert or update or delete on biovac_renglones
for each row execute function biovac_trg_10_bloqueo();

-- ---------------------------------------------------------------------------
-- 3. Autocálculo de existencia final (BEFORE, sin recursión: escribe en NEW)
-- ---------------------------------------------------------------------------

-- NOTA: la seguridad "BCG/SR no puede quedar fraccionario" NO vive aquí --
-- vivir en el trigger de cada insert/update bloqueaba capturar "aplicadas"
-- y "desechadas" como dos ediciones de campo separadas (autoguardado por
-- celda): el estado INTERMEDIO, con solo aplicadas tecleado, casi siempre
-- deja un decimal. Se movió como compuerta explícita dentro de
-- biovac_cerrar_mes (ver más abajo, junto a la de existencia negativa) --
-- ahí sí debe estar resuelto, y antes se bypasseaba justo ahí por error.
create or replace function biovac_trg_20_autocalc() returns trigger
language plpgsql
as $$
declare
  v_caducidad date;
  v_numero_lote text;
  v_fin_de_mes date;
begin
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

  -- Solo aplica a renglones NORMALES (un lote en A.R.F./canje puede
  -- legítimamente quedar caducado mientras se resuelve -- no está en uso
  -- activo):
  if new.categoria = 'NORMAL' and coalesce(current_setting('biovac.bypass_validaciones', true), 'off') <> 'on' then
    select l.numero_lote, l.caducidad
      into v_numero_lote, v_caducidad
    from biovac_lotes l
    where l.id = new.lote_id;

    -- Lote caducado con existencia activa: debe desecharse o
    -- reclasificarse antes de poder guardarse así. Se compara contra el
    -- ÚLTIMO DÍA DEL MES del propio movimiento, no contra la fecha real
    -- de hoy -- así una importación de histórico o una corrección a un
    -- mes pasado no se bloquea solo porque, visto desde HOY, ese lote ya
    -- caducó; lo que importa es si ya estaba caducado EN ese mes.
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

drop trigger if exists trg_biovac_20_autocalc on biovac_renglones;
create trigger trg_biovac_20_autocalc
before insert or update on biovac_renglones
for each row execute function biovac_trg_20_autocalc();

-- ---------------------------------------------------------------------------
-- 4. Re-disparar el cálculo de todos los renglones de un movimiento
--    (usa un UPDATE "touch" para reactivar el trigger BEFORE de cada fila)
-- ---------------------------------------------------------------------------

create or replace function biovac_recalcular_movimiento(p_movimiento_id uuid) returns void
language sql
as $$
  update biovac_renglones
  set existencia_anterior_frascos = existencia_anterior_frascos
  where movimiento_id = p_movimiento_id;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cerrar mes: valida, recalcula, marca CERRADO y siembra el mes siguiente
-- ---------------------------------------------------------------------------

create or replace function biovac_cerrar_mes(p_movimiento_id uuid, p_usuario text) returns uuid
language plpgsql
security definer
set search_path = public
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
  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  perform biovac_recalcular_movimiento(p_movimiento_id);

  select count(*) into v_negativos
  from biovac_renglones
  where movimiento_id = p_movimiento_id and existencia_final_frascos < 0;

  if v_negativos > 0 then
    perform set_config('biovac.bypass_lock', 'off', true);
    perform set_config('biovac.bypass_validaciones', 'off', true);
    raise exception 'No se puede cerrar: % renglón(es) con existencia final negativa', v_negativos;
  end if;

  -- BCG/SR: frasco multidosis que se desecha el mismo día de abrirse --
  -- nunca puede quedar una existencia final fraccionaria. Aquí, al cerrar,
  -- es donde de verdad debe estar resuelto (ver nota en
  -- biovac_trg_20_autocalc más arriba).
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

  if v_unidad is null then
    raise exception 'Movimiento % no existe', p_movimiento_id;
  end if;

  update biovac_movimientos
  set estado = 'CERRADO', cerrado_en = now(), cerrado_por = p_usuario, updated_at = now()
  where id = p_movimiento_id;

  v_next_anio := v_anio;
  v_next_mes := v_mes + 1;
  if v_next_mes > 12 then
    v_next_anio := v_anio + 1;
    v_next_mes := 1;
  end if;

  insert into biovac_movimientos (unidad_id, anio, mes)
  values (v_unidad, v_next_anio, v_next_mes)
  on conflict (unidad_id, anio, mes) do nothing;

  select id into v_next_id
  from biovac_movimientos
  where unidad_id = v_unidad and anio = v_next_anio and mes = v_next_mes;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
  select v_next_id, r.lote_id, r.categoria, r.existencia_final_frascos
  from biovac_renglones r
  where r.movimiento_id = p_movimiento_id
    and r.existencia_final_frascos <> 0
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = excluded.existencia_anterior_frascos;

  perform biovac_recalcular_movimiento(v_next_id);

  perform set_config('biovac.bypass_lock', 'off', true);
  perform set_config('biovac.bypass_validaciones', 'off', true);

  return v_next_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Abrir corrección sobre un mes CERRADO
-- ---------------------------------------------------------------------------

create or replace function biovac_abrir_correccion(
  p_movimiento_id uuid,
  p_usuario text,
  p_rol text,
  p_motivo text,
  p_tipo text default 'REAPERTURA'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_estado text;
begin
  select estado into v_estado from biovac_movimientos where id = p_movimiento_id;
  if v_estado is null then
    raise exception 'Movimiento % no existe', p_movimiento_id;
  end if;
  if v_estado <> 'CERRADO' then
    raise exception 'Solo se puede abrir corrección sobre un mes CERRADO (estado actual: %)', v_estado;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo de la corrección es obligatorio';
  end if;

  update biovac_movimientos
  set estado = 'EN_CORRECCION', updated_at = now()
  where id = p_movimiento_id;

  insert into biovac_correcciones (movimiento_id, usuario, rol, motivo, tipo, cascade_batch_id)
  values (p_movimiento_id, p_usuario, p_rol, p_motivo, p_tipo, v_batch);

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Aplicar corrección: recalcula el mes y propaga en cascada hacia
--    adelante (existencia_anterior de cada mes siguiente se resincroniza
--    con la existencia_final ya corregida del mes previo).
-- ---------------------------------------------------------------------------

create or replace function biovac_aplicar_correccion(
  p_movimiento_id uuid,
  p_usuario text,
  p_cascade_batch_id uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidad uuid;
  v_anio int;
  v_mes int;
  v_current_id uuid := p_movimiento_id;
  v_next_anio int;
  v_next_mes int;
  v_next_id uuid;
  v_meses_tocados int := 0;
  v_movimientos_tocados uuid[] := array[]::uuid[];
begin
  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  perform biovac_recalcular_movimiento(p_movimiento_id);

  select unidad_id, anio, mes into v_unidad, v_anio, v_mes
  from biovac_movimientos where id = p_movimiento_id;

  if v_unidad is null then
    raise exception 'Movimiento % no existe', p_movimiento_id;
  end if;

  update biovac_movimientos
  set estado = 'CERRADO', fue_corregido = true, updated_at = now()
  where id = p_movimiento_id;

  v_meses_tocados := 1;
  v_movimientos_tocados := array_append(v_movimientos_tocados, p_movimiento_id);

  loop
    v_next_anio := v_anio;
    v_next_mes := v_mes + 1;
    if v_next_mes > 12 then
      v_next_anio := v_anio + 1;
      v_next_mes := 1;
    end if;

    select id into v_next_id
    from biovac_movimientos
    where unidad_id = v_unidad and anio = v_next_anio and mes = v_next_mes;

    exit when v_next_id is null;

    insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
    select v_next_id, r.lote_id, r.categoria, r.existencia_final_frascos
    from biovac_renglones r
    where r.movimiento_id = v_current_id
      and r.existencia_final_frascos <> 0
    on conflict (movimiento_id, lote_id, categoria)
    do update set existencia_anterior_frascos = excluded.existencia_anterior_frascos;

    perform biovac_recalcular_movimiento(v_next_id);

    update biovac_movimientos
    set fue_corregido = true, updated_at = now()
    where id = v_next_id;

    insert into biovac_correcciones (movimiento_id, usuario, rol, motivo, tipo, cascade_batch_id)
    values (v_next_id, p_usuario, 'SISTEMA', 'Recálculo en cascada por corrección de mes anterior', 'EDICION', p_cascade_batch_id);

    v_meses_tocados := v_meses_tocados + 1;
    v_movimientos_tocados := array_append(v_movimientos_tocados, v_next_id);
    v_current_id := v_next_id;
    v_anio := v_next_anio;
    v_mes := v_next_mes;
  end loop;

  -- si el informe jurisdiccional de algún mes tocado ya fue generado, marcarlo desactualizado
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

-- ---------------------------------------------------------------------------
-- 8. Validaciones de inconsistencias a nivel jurisdicción (solo lectura)
-- ---------------------------------------------------------------------------

create or replace function biovac_validar_concentrado(p_jurisdiccion_id uuid, p_anio int, p_mes int)
returns table (severidad text, codigo text, mensaje text, unidad text, biologico text, lote text)
language plpgsql
stable
as $$
begin
  return query
  -- movimiento municipal faltante o no cerrado
  select 'ERROR', 'MOVIMIENTO_NO_CERRADO',
         'La unidad no tiene el movimiento de este mes cerrado (o no existe)',
         u.nombre, null::text, null::text
  from biovac_unidades u
  where u.jurisdiccion_id = p_jurisdiccion_id and u.activo
    and not exists (
      select 1 from biovac_movimientos m
      where m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes and m.estado = 'CERRADO'
    );

  return query
  -- mismo número de lote con caducidad distinta entre municipios
  select 'ADVERTENCIA', 'CADUCIDAD_INCONSISTENTE',
         'El mismo lote tiene caducidades distintas entre municipios de la jurisdicción',
         string_agg(distinct u.nombre, ', '), cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
  group by cb.nombre_excel, l.numero_lote
  having count(distinct l.caducidad) > 1;

  return query
  -- existencia final negativa (no debería poder cerrarse, pero se valida por si se corrigió a mano)
  select 'ERROR', 'EXISTENCIA_NEGATIVA',
         'Existencia final negativa en un renglón', u.nombre, cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
    and r.existencia_final_frascos < 0;

  return query
  -- ARF/canje con existencia > 0 sostenida por 3+ meses sin resolver
  select 'ADVERTENCIA', 'ARF_SIN_RESOLVER',
         'Lote en A.R.F./canje con existencia sin resolver desde hace 3+ meses', u.nombre, cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
    and r.categoria in ('ARF', 'CANJE') and r.existencia_final_frascos > 0
    and exists (
      select 1 from biovac_renglones r2
      join biovac_movimientos m2 on m2.id = r2.movimiento_id
      where r2.lote_id = r.lote_id and r2.categoria = r.categoria
        and m2.unidad_id = m.unidad_id
        and (m2.anio * 12 + m2.mes) <= (p_anio * 12 + p_mes) - 3
        and (m2.anio * 12 + m2.mes) > (p_anio * 12 + p_mes) - 4
        and r2.existencia_final_frascos > 0
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Generar informe jurisdiccional (snapshot del concentrado en vivo)
-- ---------------------------------------------------------------------------

create or replace function biovac_generar_informe_jurisdiccional(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_usuario text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_snapshot jsonb;
begin
  select jsonb_agg(row_to_json(t)) into v_snapshot
  from (
    select cb.nombre_excel as biologico, l.numero_lote, r.categoria,
           sum(r.existencia_anterior_frascos) as existencia_anterior_frascos,
           sum(r.recibido_frascos) as recibido_frascos,
           sum(r.aplicadas_a) as aplicadas_a, sum(r.aplicadas_b) as aplicadas_b,
           sum(r.desechadas_a) as desechadas_a, sum(r.desechadas_b) as desechadas_b,
           sum(r.existencia_final_frascos) as existencia_final_frascos
    from biovac_renglones r
    join biovac_movimientos m on m.id = r.movimiento_id
    join biovac_unidades u on u.id = m.unidad_id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
      and m.estado = 'CERRADO'
    group by cb.bloque_id, cb.orden_en_bloque, cb.nombre_excel, l.numero_lote, r.categoria
    order by cb.orden_en_bloque
  ) t;

  insert into biovac_informes_jurisdiccionales (jurisdiccion_id, anio, mes, generado_por, snapshot)
  values (p_jurisdiccion_id, p_anio, p_mes, p_usuario, coalesce(v_snapshot, '[]'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Resolución de A.R.F. — el dictamen llega y la vacuna se reactiva como
--     existencia normal (aplicar o desechar se registra después, ya en el
--     renglón NORMAL, con datos reales de ese mes). El renglón ARF se vacía
--     (queda en 0, deja de arrastrarse) y su monto se traslada íntegro al
--     renglón NORMAL del mismo lote en el mismo movimiento (se crea si no
--     existe, o se suma si ya había uno).
-- ---------------------------------------------------------------------------

create or replace function biovac_reclasificar_arf_normal(
  p_renglon_id uuid,
  p_usuario text,
  p_rol text,
  p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento_id uuid;
  v_lote_id uuid;
  v_categoria text;
  v_estado text;
  v_monto numeric;
  v_normal_id uuid;
begin
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos
    into v_movimiento_id, v_lote_id, v_categoria, v_monto
  from biovac_renglones r
  where r.id = p_renglon_id
  for update;

  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;
  if v_categoria <> 'ARF' then
    raise exception 'Solo se puede reactivar un renglón en A.R.F. (categoría actual: %)', v_categoria;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado not in ('BORRADOR','EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para reactivar un lote (estado actual: %)', v_estado;
  end if;
  if v_monto <= 0 then
    raise exception 'No hay existencia en A.R.F. para reactivar en este renglón';
  end if;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
  values (v_movimiento_id, v_lote_id, 'NORMAL', v_monto)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos
  returning id into v_normal_id;

  -- el renglón ARF ya se movió por completo a NORMAL -- se elimina para que
  -- el movimiento no acumule renglones en 0 mes tras mes; el rastro queda
  -- en biovac_correcciones, apuntando al renglón NORMAL resultante.
  delete from biovac_renglones where id = p_renglon_id;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_movimiento_id, v_normal_id, p_usuario, p_rol, 'categoria',
          'ARF (' || v_monto || ' frascos)', 'NORMAL (' || v_monto || ' frascos)', p_motivo, 'RECLASIFICACION');

  return v_normal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10b. Reclasificación Normal -> A.R.F. — sentido inverso de la anterior:
--      parte (o toda) la existencia de un renglón Normal se manda a
--      dictamen. Se resta primero de existencia_anterior_frascos y, si no
--      alcanza, del recibido_frascos de este mes -- nunca se tocan
--      aplicadas/desechadas, que tienen un significado distinto (dosis
--      aplicadas/descartadas, no lotes trasladados a dictamen). El renglón
--      A.R.F. destino se crea si no existe, o se le suma si ya había uno.
-- ---------------------------------------------------------------------------

create or replace function biovac_reclasificar_normal_arf(
  p_renglon_id uuid,
  p_monto numeric,
  p_usuario text,
  p_rol text,
  p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento_id uuid;
  v_lote_id uuid;
  v_categoria text;
  v_final numeric;
  v_anterior numeric;
  v_estado text;
  v_resta_anterior numeric;
  v_resta_recibido numeric;
  v_arf_id uuid;
begin
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos, r.existencia_anterior_frascos
    into v_movimiento_id, v_lote_id, v_categoria, v_final, v_anterior
  from biovac_renglones r
  where r.id = p_renglon_id
  for update;

  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;
  if v_categoria <> 'NORMAL' then
    raise exception 'Solo se puede pasar a A.R.F. un renglón Normal (categoría actual: %)', v_categoria;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'La cantidad a pasar a A.R.F. debe ser mayor a cero';
  end if;
  if p_monto > v_final then
    raise exception 'No puedes pasar a A.R.F. más de la existencia actual (% frascos)', v_final;
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado not in ('BORRADOR','EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para reclasificar un lote (estado actual: %)', v_estado;
  end if;

  v_resta_anterior := least(p_monto, v_anterior);
  v_resta_recibido := p_monto - v_resta_anterior;

  update biovac_renglones
  set existencia_anterior_frascos = existencia_anterior_frascos - v_resta_anterior,
      recibido_frascos = recibido_frascos - v_resta_recibido
  where id = p_renglon_id;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
  values (v_movimiento_id, v_lote_id, 'ARF', p_monto)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos
  returning id into v_arf_id;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_movimiento_id, v_arf_id, p_usuario, p_rol, 'categoria',
          'NORMAL (' || p_monto || ' frascos)', 'ARF (' || p_monto || ' frascos)', p_motivo, 'RECLASIFICACION');

  return v_arf_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Resolución de Canje — el lote en canje se sustituye por un lote nuevo
--     (recibido a cambio); la existencia se traslada íntegra del renglón
--     CANJE (que se vacía) al renglón NORMAL del lote nuevo, en el mismo
--     movimiento. No tiene plazo esperado (puede durar años sin resolverse).
-- ---------------------------------------------------------------------------

create or replace function biovac_resolver_canje(
  p_renglon_id uuid,
  p_nuevo_numero_lote text,
  p_nueva_caducidad date,
  p_usuario text,
  p_rol text,
  p_motivo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento_id uuid;
  v_lote_id uuid;
  v_biologico_id uuid;
  v_lote_numero_actual text;
  v_categoria text;
  v_estado text;
  v_monto numeric;
  v_nuevo_lote_id uuid;
  v_normal_id uuid;
begin
  select r.movimiento_id, r.lote_id, r.categoria, r.existencia_final_frascos, l.numero_lote, l.biologico_id
    into v_movimiento_id, v_lote_id, v_categoria, v_monto, v_lote_numero_actual, v_biologico_id
  from biovac_renglones r
  join biovac_lotes l on l.id = r.lote_id
  where r.id = p_renglon_id
  for update of r;

  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;
  if v_categoria <> 'CANJE' then
    raise exception 'Solo se puede resolver un renglón en Canje (categoría actual: %)', v_categoria;
  end if;
  if p_nuevo_numero_lote is null or length(trim(p_nuevo_numero_lote)) = 0 then
    raise exception 'El número de lote nuevo es obligatorio';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado not in ('BORRADOR','EN_CORRECCION') then
    raise exception 'El mes debe estar en captura o corrección para registrar un canje (estado actual: %)', v_estado;
  end if;
  if v_monto <= 0 then
    raise exception 'No hay existencia en Canje para resolver en este renglón';
  end if;

  select id into v_nuevo_lote_id
  from biovac_lotes where biologico_id = v_biologico_id and numero_lote = trim(p_nuevo_numero_lote);

  if v_nuevo_lote_id is null then
    insert into biovac_lotes (biologico_id, numero_lote, caducidad)
    values (v_biologico_id, trim(p_nuevo_numero_lote), p_nueva_caducidad)
    returning id into v_nuevo_lote_id;
  elsif p_nueva_caducidad is not null then
    update biovac_lotes set caducidad = p_nueva_caducidad where id = v_nuevo_lote_id;
  end if;

  insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos)
  values (v_movimiento_id, v_nuevo_lote_id, 'NORMAL', v_monto)
  on conflict (movimiento_id, lote_id, categoria)
  do update set existencia_anterior_frascos = biovac_renglones.existencia_anterior_frascos + excluded.existencia_anterior_frascos
  returning id into v_normal_id;

  -- el renglón en canje ya se sustituyó por completo -- se elimina para que
  -- el movimiento no acumule renglones en 0 mes tras mes; el rastro queda
  -- en biovac_correcciones, apuntando al renglón NORMAL resultante.
  delete from biovac_renglones where id = p_renglon_id;

  insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo)
  values (v_movimiento_id, v_normal_id, p_usuario, p_rol, 'categoria',
          'CANJE lote ' || v_lote_numero_actual || ' (' || v_monto || ' frascos)',
          'NORMAL lote ' || trim(p_nuevo_numero_lote) || ' (' || v_monto || ' frascos)',
          p_motivo, 'RECLASIFICACION');

  return v_normal_id;
end;
$$;
