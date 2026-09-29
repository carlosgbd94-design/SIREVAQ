-- ============================================================================
-- Requisiciones -- corrige la validación de reparto en un UPSERT por columnas
-- únicas.
--
-- Problema: en INSERT ... ON CONFLICT (requisicion, destino, biológico, lote)
-- el trigger BEFORE INSERT se dispara con la fila propuesta, cuyo `id` es uno
-- nuevo (default), distinto del de la fila que después se actualizará. Como la
-- suma de "otros" solo excluía `id <> new.id`, contaba la cantidad ANTERIOR del
-- mismo destino además de la nueva, y rechazaba subir una cantidad ya guardada
-- cuando el lote estaba casi repartido (ej. surtido 100, destino tenía 60,
-- subirlo a 70 daba 60 + 70 > 100).
--
-- Solución: la suma de "otros" también excluye la fila del mismo destino.
-- ============================================================================

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
    and id <> new.id
    and municipio <> new.municipio;

  if v_repartido_otros + new.cantidad > v_disponible then
    raise exception 'Excede lo surtido para este lote: disponible %, ya repartido a otros municipios/Hospitales %, intentas asignar % a %',
      v_disponible, v_repartido_otros, new.cantidad, new.municipio;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

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
    and du.id <> new.id
    and du.unidad_id <> new.unidad_id;

  if v_repartido_otras + new.cantidad > v_disponible then
    raise exception 'Excede lo asignado a % para este lote: disponible %, ya repartido a otras unidades %, intentas asignar %',
      v_municipio, v_disponible, v_repartido_otras, new.cantidad;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
