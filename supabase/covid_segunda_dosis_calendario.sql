-- COVID-19: la 2ª dosis de 6 a 59 meses (rubro c2) no se captura durante el 1er mes de la campaña
-- (va un mes después de la 1ª). Misma regla que influenza_reglas.js (segundasDesde = fecha_inicio + 1 mes), ahora
-- también en el servidor para que no dependa del cliente (escritorio o móvil).
--  · Solo rol UNIDAD (como el tope contra la meta); revisores/admin corrigen sin este candado.
--  · Solo bloquea AUMENTOS del rubro respecto a lo ya guardado de esa semana: no rompe datos existentes.
--  · La fecha del reporte es la clave de la semana (viernes o corte), igual que en el cliente.
create or replace function public.covid_trg_valida_captura() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_metas jsonb;
  m text; k text;
  v_val numeric; v_old numeric; v_nuevo numeric; v_otros numeric; v_meta numeric; v_prev jsonb;
  v_ini date; v_segundas date;
  rubros text[] := array['c1','c2','c3','c4','c5','c6'];
begin
  -- Forma: solo MODERNA/PFIZER, solo c1..c6, enteros >= 0; Pfizer solo adultos
  for m in select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) loop
    if m not in ('MODERNA', 'PFIZER') then
      raise exception 'Marca no válida en la captura de COVID-19: %.', m using errcode = 'P0001';
    end if;
    for k in select jsonb_object_keys(new.valores -> m) loop
      if not (k = any (rubros)) then
        raise exception 'Rubro no válido en la captura de COVID-19: %.', k using errcode = 'P0001';
      end if;
      v_val := coalesce(nullif(new.valores -> m ->> k, '')::numeric, 0);
      if v_val < 0 or v_val <> trunc(v_val) then
        raise exception 'Las dosis aplicadas deben ser enteros no negativos (% %).', m, k using errcode = 'P0001';
      end if;
      if m = 'PFIZER' and k in ('c1', 'c2') and v_val > 0 then
        raise exception 'Pfizer no se aplica a niños de 6 a 59 meses.' using errcode = 'P0001';
      end if;
    end loop;
  end loop;

  if (select auth.uid()) is null then return new; end if;
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then return new; end if;

  v_prev := case when tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then old.valores else '{}'::jsonb end;

  -- Calendario: sin 2ª dosis (c2) antes de fecha_inicio + 1 mes (si el día no existe queda en el último del mes, como en el cliente)
  select c.fecha_inicio into v_ini from campanas c where c.nombre = new.anio_campana;
  if v_ini is not null then
    v_segundas := (v_ini + interval '1 month')::date;
    v_nuevo := coalesce(nullif(new.valores -> 'MODERNA' ->> 'c2', '')::numeric, 0) + coalesce(nullif(new.valores -> 'PFIZER' ->> 'c2', '')::numeric, 0);
    v_old := coalesce(nullif(v_prev -> 'MODERNA' ->> 'c2', '')::numeric, 0) + coalesce(nullif(v_prev -> 'PFIZER' ->> 'c2', '')::numeric, 0);
    if new.fecha < v_segundas and v_nuevo > v_old then
      raise exception 'No hay 2ª dosis en el 1er mes de la campaña: la 2ª de 6 a 59 meses va un mes después de la 1ª, así que se captura a partir del %.',
        to_char(v_segundas, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
  end if;

  select cm.metas into v_metas from covid_metas cm
  where cm.anio_campana = new.anio_campana and cm.clues = new.clues
  order by cm.updated_at desc nulls last limit 1;
  -- Sin renglón propio (p. ej. hospitales con meta a nivel destino) la meta se valida en el cliente.
  if v_metas is null then return new; end if;

  foreach k in array rubros loop
    v_nuevo := coalesce(nullif(new.valores -> 'MODERNA' ->> k, '')::numeric, 0) + coalesce(nullif(new.valores -> 'PFIZER' ->> k, '')::numeric, 0);
    v_old := coalesce(nullif(v_prev -> 'MODERNA' ->> k, '')::numeric, 0) + coalesce(nullif(v_prev -> 'PFIZER' ->> k, '')::numeric, 0);
    continue when v_nuevo <= v_old;
    v_meta := coalesce(nullif(v_metas ->> k, '')::numeric, 0);
    if v_meta <= 0 then
      raise exception 'Tu unidad no tiene meta de COVID-19 en el rubro % de esta campaña: no se puede reportar.', k using errcode = 'P0001';
    end if;
    select coalesce(sum(coalesce(nullif(c.valores -> 'MODERNA' ->> k, '')::numeric, 0) + coalesce(nullif(c.valores -> 'PFIZER' ->> k, '')::numeric, 0)), 0)
      into v_otros
    from covid_capturas c
    where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;
    if v_otros + v_nuevo > v_meta then
      raise exception 'El rubro % de COVID-19 rebasaría la meta de tu unidad: llevas % dosis en otras semanas, con % de esta semana serían % y la meta es %.',
        k, v_otros, v_nuevo, v_otros + v_nuevo, v_meta using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
