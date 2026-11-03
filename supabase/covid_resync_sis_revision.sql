-- =============================================================================
-- COVID-19: cuando un REVISOR (MUNICIPAL / JURISDICCIONAL / ADMIN) corrige un reporte semanal de un mes cuyo SIS ya
-- se envió o validó, los totales de COVID-19 guardados en la hoja SIS-06-P (filas 105-111) se vuelven a calcular.
-- Antes solo se re-sincronizaba el SIS en BORRADOR (sis06p_resync_covid_borrador), así que la hoja enviada quedaba con
-- cifras viejas frente a los reportes semanales corregidos. La UNIDAD no entra aquí: su candado impide editar tras
-- enviar. La corrección queda en el control de cambios por covid_trg_auditoria_sis. Idempotente.
-- =============================================================================
create or replace function public.sis06p_resync_covid_revision(p_clues text, p_mes integer, p_anio integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
  w record;
  v_val jsonb;
  v_old jsonb;
  k text;
begin
  if p_anio * 12 + p_mes < 2026 * 12 + 10 then return; end if;
  for c in select id, valores from sis06p_capturas
            where clues = p_clues and mes = p_mes and anio = p_anio and estado <> 'BORRADOR' loop
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
revoke all on function public.sis06p_resync_covid_revision(text, integer, integer) from public, anon, authenticated;

create or replace function public.covid_trg_resync_sis() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
begin
  v_rol := public._sis_rol_actual();
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sis06p_resync_covid_borrador(old.clues, extract(month from old.fecha)::int, extract(year from old.fecha)::int);
    if v_rol is not null and v_rol <> 'UNIDAD' then
      perform public.sis06p_resync_covid_revision(old.clues, extract(month from old.fecha)::int, extract(year from old.fecha)::int);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sis06p_resync_covid_borrador(new.clues, extract(month from new.fecha)::int, extract(year from new.fecha)::int);
    if v_rol is not null and v_rol <> 'UNIDAD' then
      perform public.sis06p_resync_covid_revision(new.clues, extract(month from new.fecha)::int, extract(year from new.fecha)::int);
    end if;
  end if;
  return null;
end $$;
