-- Folio de cada reporte semanal de Influenza: lo asigna la base al crear el reporte, no cambia al editarlo
-- y es único. Formato INF-AAAAMMDD-XXXXXXXX (viernes de corte + primeros 8 caracteres del id).
alter table public.influenza_capturas add column if not exists folio text;

create or replace function public.influenza_trg_asignar_folio()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    new.folio := coalesce(new.folio, 'INF-' || to_char(new.fecha, 'YYYYMMDD') || '-' || upper(substr(new.id::text, 1, 8)));
  else
    new.folio := coalesce(old.folio, new.folio, 'INF-' || to_char(new.fecha, 'YYYYMMDD') || '-' || upper(substr(new.id::text, 1, 8)));
  end if;
  return new;
end;
$function$;

drop trigger if exists influenza_trg_asignar_folio on public.influenza_capturas;
create trigger influenza_trg_asignar_folio
  before insert or update on public.influenza_capturas
  for each row execute function public.influenza_trg_asignar_folio();

update public.influenza_capturas
set folio = 'INF-' || to_char(fecha, 'YYYYMMDD') || '-' || upper(substr(id::text, 1, 8))
where folio is null;

create unique index if not exists idx_influenza_capturas_folio on public.influenza_capturas(folio);
