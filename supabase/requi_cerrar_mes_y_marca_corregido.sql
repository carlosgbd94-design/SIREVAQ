-- "Cerrar mes" (Explorador de requisiciones): a diferencia de Biovac, aquí
-- NO se bloquea la edición al cerrar -- el usuario pidió explícitamente
-- poder seguir corrigiendo una requisición ya cerrada. En vez de eso, se
-- marca automáticamente fue_corregido=true la primera vez que se toca
-- cualquier dato (surtido/reparto) de una requisición ya CERRADA, para que
-- la "consecuencia" del cambio se vea reflejada hasta el usuario final: el
-- mismo renglón de requi_requisiciones es el que leen jurisdicción,
-- municipios y unidades (todas las vistas de solo lectura apuntan al mismo
-- registro), así que el aviso "corregido posteriormente" les llega a todos
-- sin trabajo extra.
alter table requi_requisiciones add column if not exists fue_corregido boolean not null default false;

create or replace function requi_trg_marca_corregido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id uuid;
begin
  if tg_op = 'DELETE' then
    v_req_id := old.requisicion_id;
  else
    v_req_id := new.requisicion_id;
  end if;

  update requi_requisiciones
    set fue_corregido = true
    where id = v_req_id and estado = 'CERRADA';

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requi_marca_corregido_items on requi_items_jurisdiccion;
create trigger trg_requi_marca_corregido_items
  after insert or update or delete on requi_items_jurisdiccion
  for each row execute function requi_trg_marca_corregido();

drop trigger if exists trg_requi_marca_corregido_municipio on requi_distribucion_municipio;
create trigger trg_requi_marca_corregido_municipio
  after insert or update or delete on requi_distribucion_municipio
  for each row execute function requi_trg_marca_corregido();

drop trigger if exists trg_requi_marca_corregido_unidad on requi_distribucion_unidad;
create trigger trg_requi_marca_corregido_unidad
  after insert or update or delete on requi_distribucion_unidad
  for each row execute function requi_trg_marca_corregido();
