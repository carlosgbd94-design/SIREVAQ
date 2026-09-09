-- Permite editar cantidad_surtida de un item ya capturado (el usuario pidió
-- un botón "Editar" en el Paso 1, en vez de solo poder borrar y volver a
-- capturar). Sin este trigger, reducir cantidad_surtida por debajo de lo que
-- YA se repartió a municipios/Hospitales dejaría el reparto en un estado
-- inconsistente (repartido > surtido) sin que ningún otro trigger lo
-- detectara -- los triggers existentes (trg_requi_valida_municipio/unidad)
-- solo validan al escribir la fila de reparto, no al reducir la fuente.
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
