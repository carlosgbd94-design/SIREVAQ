-- Al corregir un reporte semanal de COVID-19, la hoja SIS-06-P en BORRADOR de ese mes debe tomar los
-- totales nuevos. Antes solo se recalculaban al guardar la hoja, y el comparativo con Movimiento
-- (sis06p_comparativo) leia las cifras viejas: "paloteo 143" cuando los reportes ya daban 139.5.
-- Las hojas ya enviadas no se tocan (se corrigen por el flujo de revisores).

create or replace function public.sis06p_resync_covid_borrador(p_clues text, p_mes int, p_anio int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  w record;
  v_val jsonb;
  v_old jsonb;
  k text;
begin
  if p_anio * 12 + p_mes < 2026 * 12 + 10 then return; end if;
  for c in select id, valores from sis06p_capturas
            where clues = p_clues and mes = p_mes and anio = p_anio and estado = 'BORRADOR' loop
    v_val := coalesce(c.valores, '{}'::jsonb);
    for w in select * from public._sis06p_covid_semanal(p_clues, p_mes, p_anio) loop
      k := w.fila::text;
      v_old := coalesce(v_val -> k, '{}'::jsonb);
      v_val := jsonb_set(v_val, array[k], jsonb_build_object(
        'total', w.total,
        'afro', least(coalesce((v_old ->> 'afro')::numeric, 0), w.total),
        'indigena', least(coalesce((v_old ->> 'indigena')::numeric, 0), w.total),
        'migrante', least(coalesce((v_old ->> 'migrante')::numeric, 0), w.total)), true);
    end loop;
    if v_val is distinct from c.valores then
      perform set_config('sis06p.bypass_lock', 'on', true);
      update sis06p_capturas set valores = v_val where id = c.id;
      perform set_config('sis06p.bypass_lock', 'off', true);
    end if;
  end loop;
end $$;

create or replace function public.covid_trg_resync_sis()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sis06p_resync_covid_borrador(old.clues, extract(month from old.fecha)::int, extract(year from old.fecha)::int);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sis06p_resync_covid_borrador(new.clues, extract(month from new.fecha)::int, extract(year from new.fecha)::int);
  end if;
  return null;
end $$;

drop trigger if exists covid_trg_resync_sis on public.covid_capturas;
create trigger covid_trg_resync_sis
  after insert or update or delete on public.covid_capturas
  for each row execute function public.covid_trg_resync_sis();

-- Reparar las hojas en borrador que ya quedaron desfasadas
select public.sis06p_resync_covid_borrador(clues, mes, anio)
from sis06p_capturas where estado = 'BORRADOR' and anio * 12 + mes >= 2026 * 12 + 10;
