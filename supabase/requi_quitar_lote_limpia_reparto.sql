-- Requisiciones: al quitar un lote de "lo surtido" (requi_items_jurisdiccion) su reparto a municipios,
-- hospitales y unidades se quedaba huerfano y SEGUIA saliendo en los Excel de impresion (que leen
-- requi_distribucion_*). Ahora el reparto de ese lote se retira junto con el renglon surtido.

create or replace function public.requi_limpia_reparto_al_quitar_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Si otro renglon surtido sigue usando el mismo lote en la requisicion, el reparto se conserva.
  if not exists (select 1 from requi_items_jurisdiccion i
                 where i.requisicion_id = old.requisicion_id and i.lote_id = old.lote_id) then
    delete from requi_distribucion_unidad    where requisicion_id = old.requisicion_id and lote_id = old.lote_id;
    delete from requi_distribucion_municipio where requisicion_id = old.requisicion_id and lote_id = old.lote_id;
  end if;
  return old;
end $$;

drop trigger if exists trg_requi_limpia_reparto_al_quitar_item on requi_items_jurisdiccion;
create trigger trg_requi_limpia_reparto_al_quitar_item
  after delete on requi_items_jurisdiccion
  for each row execute function public.requi_limpia_reparto_al_quitar_item();

-- Limpieza de lo que ya quedo huerfano.
delete from requi_distribucion_unidad d
 where not exists (select 1 from requi_items_jurisdiccion i where i.requisicion_id = d.requisicion_id and i.lote_id = d.lote_id);
delete from requi_distribucion_municipio d
 where not exists (select 1 from requi_items_jurisdiccion i where i.requisicion_id = d.requisicion_id and i.lote_id = d.lote_id);
