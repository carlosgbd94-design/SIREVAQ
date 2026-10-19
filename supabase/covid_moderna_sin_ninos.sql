-- COVID-19: un destino o unidad SIN meta de niños (6 a 59 meses) no recibe Moderna.
-- Moderna es escasa (apenas sobran unos frascos) y se necesita para los niños, que solo la reciben a ella;
-- una meta solo de adultos se cubre al 100 % con Pfizer (6 dosis por frasco, 12 años en adelante).
-- Reemplaza covid_remesas_tope_meta y covid_distribucion_tope_meta de covid_metas_frascos.sql agregando esa regla.
-- Solo actúa al escribir/cambiar la entrega: lo ya guardado no se toca (si se edita esa entrega hay que corregirlo).

create or replace function public.covid_remesas_tope_meta()
returns trigger language plpgsql set search_path = public as $$
declare
  v_dest text;
  v_val numeric;
  v_dpf integer := public.covid_dosis_por_frasco(new.marca);
  v_total numeric;
  v_adulto numeric;
  v_otras numeric;
  v_otras_pfizer numeric;
  v_tope numeric;
begin
  if tg_op = 'UPDATE'
     and new.asignacion is not distinct from old.asignacion
     and new.total_frascos = old.total_frascos then
    return new;
  end if;
  if not exists (select 1 from covid_metas m where m.anio_campana = new.anio_campana) then
    return new;
  end if;

  foreach v_dest in array array['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM'] loop
    v_val := coalesce(nullif(new.asignacion ->> v_dest, '')::numeric, 0);
    if v_val <= 0 then continue; end if;

    select md.total, md.adulto into v_total, v_adulto
      from public.covid_meta_dosis(new.anio_campana, v_dest, null) md;

    if new.marca = 'MODERNA' and coalesce(v_total, 0) > 0 and coalesce(v_total, 0) <= coalesce(v_adulto, 0) then
      raise exception '% no tiene meta de niños: no recibe Moderna. Su meta (% dosis) se cubre al 100 %% con Pfizer (% frascos).',
        v_dest, v_total, ceil(v_adulto / 6.0)
        using errcode = '23514';
    end if;

    select coalesce(sum(coalesce(nullif(x.asignacion ->> v_dest, '')::numeric, 0)
                        * public.covid_dosis_por_frasco(x.marca)), 0),
           coalesce(sum(case when x.marca = 'PFIZER'
                             then coalesce(nullif(x.asignacion ->> v_dest, '')::numeric, 0) * 6 else 0 end), 0)
      into v_otras, v_otras_pfizer
      from covid_remesas x
     where x.anio_campana = new.anio_campana
       and x.id is distinct from new.id
       and not (x.marca = new.marca and x.numero_entrega = new.numero_entrega);

    v_tope := ceil(greatest(0, coalesce(v_total, 0) - v_otras) / v_dpf);
    if new.marca = 'PFIZER' then
      v_tope := least(v_tope, ceil(greatest(0, coalesce(v_adulto, 0) - v_otras_pfizer) / 6.0));
    end if;
    if v_val > v_tope then
      raise exception 'Rebasa la meta de COVID en %: con % le caben % frascos más (meta % dosis de 0.5 mL, adulta %, ya recibió % dosis) y esta entrega le suma %.',
        v_dest, new.marca, v_tope, v_total, v_adulto, v_otras, v_val
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.covid_distribucion_tope_meta()
returns trigger language plpgsql set search_path = public as $$
declare
  v_dpf integer := public.covid_dosis_por_frasco(new.marca);
  v_total numeric;
  v_adulto numeric;
  v_otras numeric;
  v_otras_pfizer numeric;
  v_tope numeric;
begin
  if coalesce(new.cantidad_frascos, 0) <= 0 then return new; end if;
  if not exists (select 1 from covid_metas m where m.anio_campana = new.anio_campana) then
    return new;
  end if;

  select md.total, md.adulto into v_total, v_adulto
    from public.covid_meta_dosis(new.anio_campana, null, new.clues) md;

  if new.marca = 'MODERNA' and coalesce(v_total, 0) > 0 and coalesce(v_total, 0) <= coalesce(v_adulto, 0) then
    raise exception 'La unidad % no tiene meta de niños: no recibe Moderna. Su meta (% dosis) se cubre al 100 %% con Pfizer (% frascos).',
      new.clues, v_total, ceil(v_adulto / 6.0)
      using errcode = '23514';
  end if;

  select coalesce(sum(d.cantidad_frascos * public.covid_dosis_por_frasco(d.marca)), 0),
         coalesce(sum(case when d.marca = 'PFIZER' then d.cantidad_frascos * 6 else 0 end), 0)
    into v_otras, v_otras_pfizer
    from covid_distribucion_frascos d
   where d.anio_campana = new.anio_campana
     and d.clues = new.clues
     and (tg_op = 'INSERT' or d.id is distinct from new.id);

  v_tope := ceil(greatest(0, coalesce(v_total, 0) - v_otras) / v_dpf);
  if new.marca = 'PFIZER' then
    v_tope := least(v_tope, ceil(greatest(0, coalesce(v_adulto, 0) - v_otras_pfizer) / 6.0));
  end if;
  if new.cantidad_frascos > v_tope then
    raise exception 'Rebasa la meta de COVID de la unidad % (campaña %): con % le caben % frascos más y esto le sumaría %.',
      new.clues, new.anio_campana, new.marca, v_tope, new.cantidad_frascos
      using errcode = '23514';
  end if;
  return new;
end;
$$;
