-- ============================================================================
-- Requisiciones — Motor de validación (Postgres es la autoridad; el JS de
-- requi_engine.js solo espeja esto para dar feedback instantáneo en UI,
-- igual filosofía que biovac_trg_20_autocalc en biovac_engine.sql).
--
-- Regla central pedida por el usuario: nunca se puede repartir más de lo
-- que en verdad llegó (surtido), en ningún nivel, para ningún lote.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nivel 1: jurisdicción -> municipio/Hospitales no puede exceder lo surtido
-- de ese biológico+lote.
-- ---------------------------------------------------------------------------

create or replace function requi_trg_valida_municipio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disponible numeric;
  v_repartido_otros numeric;
begin
  select cantidad_surtida into v_disponible
  from requi_items_jurisdiccion
  where requisicion_id = new.requisicion_id
    and requi_biologico_id = new.requi_biologico_id
    and lote_id = new.lote_id;

  if v_disponible is null then
    raise exception 'Este lote no está registrado como surtido en la requisición jurisdiccional; captúralo primero en el paso 1.';
  end if;

  select coalesce(sum(cantidad), 0) into v_repartido_otros
  from requi_distribucion_municipio
  where requisicion_id = new.requisicion_id
    and requi_biologico_id = new.requi_biologico_id
    and lote_id = new.lote_id
    and id <> new.id;

  if v_repartido_otros + new.cantidad > v_disponible then
    raise exception 'Excede lo surtido para este lote: disponible %, ya repartido a otros municipios/Hospitales %, intentas asignar % a %',
      v_disponible, v_repartido_otros, new.cantidad, new.municipio;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_requi_valida_municipio on requi_distribucion_municipio;
create trigger trg_requi_valida_municipio
  before insert or update on requi_distribucion_municipio
  for each row execute function requi_trg_valida_municipio();

-- ---------------------------------------------------------------------------
-- Nivel 2: municipio/Hospitales -> unidad no puede exceder lo que ese
-- municipio recibió del lote.
-- ---------------------------------------------------------------------------

create or replace function requi_trg_valida_unidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_municipio text;
  v_disponible numeric;
  v_repartido_otras numeric;
begin
  select municipio into v_municipio from requi_unidades where id = new.unidad_id;

  select cantidad into v_disponible
  from requi_distribucion_municipio
  where requisicion_id = new.requisicion_id
    and municipio = v_municipio
    and requi_biologico_id = new.requi_biologico_id
    and lote_id = new.lote_id;

  if v_disponible is null then
    raise exception 'El municipio/Hospitales "%" no tiene asignado este lote; repártelo primero en el paso 2.', v_municipio;
  end if;

  select coalesce(sum(du.cantidad), 0) into v_repartido_otras
  from requi_distribucion_unidad du
  join requi_unidades u on u.id = du.unidad_id
  where du.requisicion_id = new.requisicion_id
    and u.municipio = v_municipio
    and du.requi_biologico_id = new.requi_biologico_id
    and du.lote_id = new.lote_id
    and du.id <> new.id;

  if v_repartido_otras + new.cantidad > v_disponible then
    raise exception 'Excede lo asignado a % para este lote: disponible %, ya repartido a otras unidades %, intentas asignar %',
      v_municipio, v_disponible, v_repartido_otras, new.cantidad;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_requi_valida_unidad on requi_distribucion_unidad;
create trigger trg_requi_valida_unidad
  before insert or update on requi_distribucion_unidad
  for each row execute function requi_trg_valida_unidad();

-- ---------------------------------------------------------------------------
-- updated_at automático en items_jurisdiccion (los otros dos ya lo hacen
-- dentro de su propio trigger de validación de arriba).
-- ---------------------------------------------------------------------------

create or replace function requi_trg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_requi_touch_items_juris on requi_items_jurisdiccion;
create trigger trg_requi_touch_items_juris
  before update on requi_items_jurisdiccion
  for each row execute function requi_trg_touch_updated_at();

drop trigger if exists trg_requi_firmas_touch on requi_firmas;
create trigger trg_requi_firmas_touch
  before update on requi_firmas
  for each row execute function requi_trg_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Nivel 0: editar lo surtido (Paso 1, botón "Editar") no puede bajar por
-- debajo de lo que ya se repartió a municipios/Hospitales de ese mismo
-- lote -- ver requi_valida_edicion_surtido.sql para el detalle.
-- ---------------------------------------------------------------------------

create or replace function requi_trg_valida_edicion_surtido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_repartido numeric;
begin
  if new.cantidad_surtida = old.cantidad_surtida
     and new.requi_biologico_id = old.requi_biologico_id
     and new.lote_id = old.lote_id then
    return new;
  end if;

  if new.requi_biologico_id <> old.requi_biologico_id or new.lote_id <> old.lote_id then
    raise exception 'No se puede cambiar el biológico o el lote de un ítem ya capturado; quítalo y vuelve a agregarlo.';
  end if;

  select coalesce(sum(cantidad), 0) into v_repartido
  from requi_distribucion_municipio
  where requisicion_id = new.requisicion_id
    and requi_biologico_id = new.requi_biologico_id
    and lote_id = new.lote_id;

  if new.cantidad_surtida < v_repartido then
    raise exception 'No puedes bajar lo surtido a % -- ya se repartieron % unidades de este lote a municipios/Hospitales. Reduce primero ese reparto.',
      new.cantidad_surtida, v_repartido;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_requi_valida_edicion_surtido on requi_items_jurisdiccion;
create trigger trg_requi_valida_edicion_surtido
  before update on requi_items_jurisdiccion
  for each row execute function requi_trg_valida_edicion_surtido();
