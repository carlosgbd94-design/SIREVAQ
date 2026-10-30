-- COVID-19: tope por marca contra lo repartido, también en el servidor.
-- Lo aplicado de una marca (acumulado de las demás semanas + este reporte, en dosis equivalentes de 0.5 mL:
-- las pediátricas c1/c2 de 0.25 mL valen media) no puede pasar de lo repartido a la unidad (frascos x dosis por
-- frasco, covid_distribucion_frascos). Misma regla que covid_captura.js (excesosAbasto), para que no dependa del cliente.
--  · Solo rol UNIDAD (como el tope contra la meta); revisores/admin corrigen sin este candado.
--  · Solo bloquea AUMENTOS de la marca respecto a lo ya guardado de esa semana: no rompe datos existentes.
--  · Sin ningún reparto de COVID-19 registrado para la unidad no hay contra qué comparar y no bloquea.
create or replace function public.covid_equivalentes_marca(p_valores jsonb, p_marca text) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(sum(coalesce(nullif(p_valores -> p_marca ->> r, '')::numeric, 0) * (case when r in ('c1', 'c2') then 0.5 else 1 end)), 0)
  from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) as r
$$;

create or replace function public.covid_trg_tope_abasto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_frascos numeric;
  v_prev jsonb;
  m text;
  v_rep numeric; v_nuevo numeric; v_old numeric; v_otros numeric;
begin
  if (select auth.uid()) is null then return new; end if;
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then return new; end if;

  select coalesce(sum(d.cantidad_frascos), 0) into v_frascos
  from covid_distribucion_frascos d where d.clues = new.clues and d.anio_campana = new.anio_campana;
  if v_frascos <= 0 then return new; end if;

  v_prev := case when tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then old.valores else '{}'::jsonb end;

  foreach m in array array['MODERNA', 'PFIZER'] loop
    v_nuevo := covid_equivalentes_marca(new.valores, m);
    v_old := covid_equivalentes_marca(v_prev, m);
    continue when v_nuevo <= v_old;
    select coalesce(sum(d.cantidad_frascos), 0) * covid_dosis_por_frasco(m) into v_rep
    from covid_distribucion_frascos d where d.clues = new.clues and d.anio_campana = new.anio_campana and d.marca = m;
    select coalesce(sum(covid_equivalentes_marca(c.valores, m)), 0) into v_otros
    from covid_capturas c where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;
    if v_otros + v_nuevo > v_rep then
      raise exception 'Con este reporte tu unidad habría aplicado % dosis de % y solo tiene % repartidas (te pasas por %). Revisa la captura o pide a tu municipio o Jurisdicción que registre la entrega de frascos.',
        round(v_otros + v_nuevo, 1), case m when 'PFIZER' then 'Pfizer' else 'Moderna' end, round(v_rep, 1), round(v_otros + v_nuevo - v_rep, 1)
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists covid_trg_tope_abasto on public.covid_capturas;
create trigger covid_trg_tope_abasto before insert or update on public.covid_capturas
  for each row execute function public.covid_trg_tope_abasto();

revoke execute on function public.covid_trg_tope_abasto() from public, anon, authenticated;
