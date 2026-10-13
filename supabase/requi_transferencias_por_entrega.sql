-- Una transferencia (PDF) por entrega del mes, no una por mes.
-- Las ya cargadas quedan como entrega 1; la unicidad pasa de (anio, mes) a (anio, mes, entrega).
alter table requi_transferencias add column if not exists entrega int not null default 1 check (entrega >= 1);

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'requi_transferencias'::regclass and contype = 'u'
      and (select array_agg(attname::text order by attname::text) from pg_attribute
           where attrelid = conrelid and attnum = any(conkey)) = array['anio','mes']
  loop
    execute format('alter table requi_transferencias drop constraint %I', c);
  end loop;
end $$;

create unique index if not exists requi_transferencias_anio_mes_entrega_key
  on requi_transferencias (anio, mes, entrega);
