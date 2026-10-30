-- Influenza: tope contra lo repartido, también en el servidor.
-- Lo aplicado por la unidad (todas las dosis de las demás semanas + este reporte) no puede pasar de lo repartido
-- (influenza_distribucion_frascos: frascos x 10 dosis). Misma regla que influenzaAbastoSemana() del cliente.
--  · Solo rol UNIDAD (como el tope contra la meta); revisores/admin corrigen sin este candado.
--  · Solo bloquea AUMENTOS respecto a lo ya guardado de esa semana: no rompe datos existentes.
--  · Sin ningún reparto registrado para la unidad no hay contra qué comparar y no bloquea.
create or replace function public.influenza_total_dosis(p_valores jsonb) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(sum(coalesce(nullif(e.value, '')::numeric, 0)), 0) from jsonb_each_text(coalesce(p_valores, '{}'::jsonb)) e
$$;

create or replace function public.influenza_trg_tope_abasto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_frascos numeric;
  v_rep numeric; v_nuevo numeric; v_old numeric; v_otros numeric;
begin
  if (select auth.uid()) is null then return new; end if;
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then return new; end if;

  select coalesce(sum(d.cantidad_frascos), 0) into v_frascos
  from influenza_distribucion_frascos d where d.clues = new.clues and d.anio_campana = new.anio_campana;
  if v_frascos <= 0 then return new; end if;

  v_nuevo := influenza_total_dosis(new.valores);
  v_old := case when tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then influenza_total_dosis(old.valores) else 0 end;
  if v_nuevo <= v_old then return new; end if;

  v_rep := v_frascos * 10;
  select coalesce(sum(influenza_total_dosis(c.valores)), 0) into v_otros
  from influenza_capturas c where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;
  if v_otros + v_nuevo > v_rep then
    raise exception 'Con este reporte tu unidad habría aplicado % dosis y solo tiene % repartidas (te pasas por %). Revisa la captura o pide a tu municipio o Jurisdicción que registre la entrega de frascos.',
      round(v_otros + v_nuevo), round(v_rep), round(v_otros + v_nuevo - v_rep) using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists influenza_trg_tope_abasto on public.influenza_capturas;
create trigger influenza_trg_tope_abasto before insert or update on public.influenza_capturas
  for each row execute function public.influenza_trg_tope_abasto();

revoke execute on function public.influenza_trg_tope_abasto() from public, anon, authenticated;
