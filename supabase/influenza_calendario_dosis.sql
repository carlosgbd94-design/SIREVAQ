-- Influenza: calendario de dosis también en el servidor (antes solo vivía en influenza_reglas.js, o sea en el cliente).
--  · 2ª dosis (r6..r10): no hay durante el 1er mes de la campaña (fecha < fecha_inicio + 1 mes).
--  · 1ª dosis (r1..r5): no hay durante el último mes (fecha > fecha_fin - 1 mes): su 2ª caería fuera de la temporada.
-- Mismo criterio que InfluenzaReglas.reglaDosis. Solo rol UNIDAD (como el tope contra la meta) y solo AUMENTOS
-- respecto de lo ya guardado de esa semana, para no romper reportes existentes.
create or replace function public.influenza_trg_meta_unidad() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_metas jsonb;
  k text;
  v_new numeric;
  v_old numeric;
  v_meta numeric;
  v_otros numeric;
  v_ini date; v_fin date; v_segundas date; v_primeras date;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then
    return new;
  end if;

  select m.metas into v_metas
  from influenza_metas m
  where m.anio_campana = new.anio_campana and m.clues = new.clues
  order by m.updated_at desc nulls last
  limit 1;

  select c.fecha_inicio, c.fecha_fin into v_ini, v_fin from campanas c where c.nombre = new.anio_campana;
  if v_ini is not null then v_segundas := (v_ini + interval '1 month')::date; end if;
  if v_fin is not null then v_primeras := (v_fin - interval '1 month')::date; end if;

  for k in select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) loop
    v_new := coalesce(nullif(new.valores ->> k, '')::numeric, 0);
    if v_new < 0 then
      raise exception 'Las dosis aplicadas no pueden ser negativas (%).', k using errcode = 'P0001';
    end if;

    v_old := 0;
    if tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then
      v_old := coalesce(nullif(old.valores ->> k, '')::numeric, 0);
    end if;
    continue when v_new <= v_old;

    -- Calendario de dosis
    if k in ('r6', 'r7', 'r8', 'r9', 'r10') and v_segundas is not null and new.fecha < v_segundas then
      raise exception 'No hay 2ª dosis en el 1er mes de la campaña: la 2ª va un mes después de la 1ª, así que se captura a partir del %.',
        to_char(v_segundas, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    if k in ('r1', 'r2', 'r3', 'r4', 'r5') and v_primeras is not null and new.fecha > v_primeras then
      raise exception 'No hay 1ª dosis en el último mes de la campaña: su 2ª dosis caería fuera de la temporada. La última fecha para 1ª dosis es el %.',
        to_char(v_primeras, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;

    v_meta := coalesce(nullif(v_metas ->> k, '')::numeric, 0);
    if v_meta <= 0 then
      raise exception 'Tu unidad no tiene meta asignada en el rubro % de esta campaña: no se puede reportar.', k
        using errcode = 'P0001';
    end if;

    select coalesce(sum(nullif(c.valores ->> k, '')::numeric), 0) into v_otros
    from influenza_capturas c
    where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;

    if v_otros + v_new > v_meta then
      raise exception 'El rubro % rebasaría la meta de tu unidad: llevas % dosis en otras semanas, con % de esta semana serían % y la meta es %.',
        k, v_otros, v_new, v_otros + v_new, v_meta
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;
