-- =============================================================================
-- Influenza: tope duro de frascos por la meta de la campaña.
--
-- Lo recibido en TODAS las entregas de una campaña no puede rebasar la meta en frascos
-- (meta en dosis / 10, redondeada hacia arriba: el último frasco puede quedar abierto).
--
--  * influenza_remesas: por cada destino (4 municipios + HENM + NHG), la suma de las demás
--    entregas más esta no puede pasar de la meta del destino (influenza_metas, clues nulo).
--  * influenza_distribucion_frascos / influenza_guardar_reparto: por cada unidad, lo repartido
--    en las demás entregas más esta no puede pasar de la meta de la unidad (influenza_metas, su CLUES).
--
-- Solo se aplica si la campaña ya tiene metas capturadas (sin metas no hay contra qué comparar;
-- ese caso ya lo frena el cliente). Un destino/unidad sin meta tiene tope 0.
-- Una actualización que no cambia las cantidades no se revalida (aunque la meta haya bajado después).
-- Idempotente.
-- =============================================================================

create or replace function public.influenza_remesas_tope_meta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_dest text;
  v_val numeric;
  v_otras numeric;
  v_dosis numeric;
  v_tope numeric;
begin
  if tg_op = 'UPDATE'
     and new.asignacion is not distinct from old.asignacion
     and new.total_frascos = old.total_frascos then
    return new;
  end if;

  if not exists (select 1 from influenza_metas m where m.anio_campana = new.anio_campana) then
    return new;
  end if;

  foreach v_dest in array array['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM'] loop
    v_val := coalesce(nullif(new.asignacion ->> v_dest, '')::numeric, 0);
    if v_val <= 0 then
      continue;
    end if;

    select coalesce(sum(coalesce(nullif(x.asignacion ->> v_dest, '')::numeric, 0)), 0)
      into v_otras
      from influenza_remesas x
     where x.anio_campana = new.anio_campana
       and x.id is distinct from new.id
       and x.numero_entrega <> new.numero_entrega;

    select coalesce(sum(coalesce(nullif(e.value, '')::numeric, 0)), 0)
      into v_dosis
      from influenza_metas m, jsonb_each_text(m.metas) e
     where m.anio_campana = new.anio_campana
       and m.clues is null
       and upper(m.municipio) = v_dest;

    v_tope := ceil(v_dosis / 10);
    if v_otras + v_val > v_tope then
      raise exception 'Rebasa la meta de frascos de la campaña en %: la meta es de % frascos, ya recibió % en otras entregas y esta le sumaría %.',
        v_dest, v_tope, v_otras, v_val
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_influenza_remesas_tope_meta on public.influenza_remesas;
create trigger trg_influenza_remesas_tope_meta
  before insert or update of asignacion, total_frascos on public.influenza_remesas
  for each row execute function public.influenza_remesas_tope_meta();

-- Por unidad: red de seguridad para cualquier escritura (el RPC ya da un mensaje más claro).
create or replace function public.influenza_distribucion_tope_meta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_otras numeric;
  v_dosis numeric;
  v_tope numeric;
begin
  if coalesce(new.cantidad_frascos, 0) <= 0 then
    return new;
  end if;
  if not exists (select 1 from influenza_metas m where m.anio_campana = new.anio_campana) then
    return new;
  end if;

  -- Lo de la unidad en la campaña, sin esta fila (otras entregas + otras filas de esta entrega)
  select coalesce(sum(d.cantidad_frascos), 0)
    into v_otras
    from influenza_distribucion_frascos d
   where d.anio_campana = new.anio_campana
     and d.clues = new.clues
     and (tg_op = 'INSERT' or d.id is distinct from new.id);

  select coalesce(sum(coalesce(nullif(e.value, '')::numeric, 0)), 0)
    into v_dosis
    from influenza_metas m, jsonb_each_text(m.metas) e
   where m.anio_campana = new.anio_campana
     and m.clues = new.clues;

  v_tope := ceil(v_dosis / 10);
  if v_otras + new.cantidad_frascos > v_tope then
    raise exception 'Rebasa la meta de frascos de la unidad % (campaña %): la meta es de % frascos, ya tiene % y esto le sumaría %.',
      new.clues, new.anio_campana, v_tope, v_otras, new.cantidad_frascos
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_influenza_distribucion_tope_meta on public.influenza_distribucion_frascos;
create trigger trg_influenza_distribucion_tope_meta
  before insert or update of cantidad_frascos, clues, anio_campana on public.influenza_distribucion_frascos
  for each row execute function public.influenza_distribucion_tope_meta();

-- RPC: mismo contenido que influenza_reparto_suma_exacta.sql + tope por meta con mensaje claro.
create or replace function public.influenza_guardar_reparto(
  p_campana text,
  p_municipio text,
  p_numero integer,
  p_fecha date,
  p_lote text,
  p_caducidad date,
  p_entregado_por text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_muni text;
  v_allowed text[];
  v_destino text := upper(coalesce(p_municipio, ''));
  v_asignado numeric;
  v_suma numeric;
  v_ajenas integer;
  v_excede text;
  n integer;
begin
  select upper(p.rol), upper(p.municipio),
         coalesce((select array_agg(upper(trim(x))) from unnest(p.municipios_allowed) x), '{}')
    into v_rol, v_muni, v_allowed
    from perfiles p
   where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null then
    raise exception 'Usuario sin perfil activo' using errcode = '42501';
  end if;

  if v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    if v_rol <> 'MUNICIPAL'
       or not (v_destino = v_muni or v_destino = any (v_allowed) or '*' = any (v_allowed)) then
      raise exception 'No tienes permiso para repartir frascos de %', p_municipio using errcode = '42501';
    end if;
  end if;

  if p_campana is null or p_campana = '' then
    raise exception 'Falta la campaña';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Reparto inválido';
  end if;

  select (r.asignacion ->> v_destino)::numeric
    into v_asignado
    from influenza_remesas r
   where r.anio_campana = p_campana and r.numero_entrega = p_numero;

  if not found then
    raise exception 'La Jurisdicción todavía no registra la entrega % de la campaña %', p_numero, p_campana;
  end if;

  select coalesce(sum(coalesce((x ->> 'cantidad_frascos')::numeric, 0)), 0)
    into v_suma
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;

  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
             where coalesce((x ->> 'cantidad_frascos')::numeric, 0) < 0
                or coalesce((x ->> 'cantidad_frascos')::numeric, 0) <> trunc(coalesce((x ->> 'cantidad_frascos')::numeric, 0))) then
    raise exception 'Las cantidades deben ser frascos enteros y no negativos';
  end if;

  if v_suma > coalesce(v_asignado, 0) then
    raise exception 'El reparto (% frascos) rebasa lo asignado por la Jurisdicción (%)', v_suma, coalesce(v_asignado, 0);
  end if;
  if v_suma < coalesce(v_asignado, 0) then
    raise exception 'El reparto (% frascos) no suma lo asignado por la Jurisdicción (%): faltan %',
      v_suma, coalesce(v_asignado, 0), coalesce(v_asignado, 0) - v_suma;
  end if;

  select count(*) into v_ajenas
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
   where case v_destino
           when 'HENM' then (x ->> 'clues') <> 'QTSSA001740'
           when 'NHG'  then (x ->> 'clues') <> 'QTSSA002901'
           else not exists (select 1 from unidades u
                             where u.clues = x ->> 'clues' and upper(u.municipio) = v_destino)
                or (x ->> 'clues') in ('QTSSA001740', 'QTSSA002901')
         end;
  if v_ajenas > 0 then
    raise exception 'Hay unidades que no pertenecen a %', p_municipio;
  end if;

  -- Tope por meta: lo repartido a una unidad en todas las entregas no rebasa su meta en frascos
  if exists (select 1 from influenza_metas m where m.anio_campana = p_campana) then
    select string_agg(format('%s (%s frascos; meta %s, ya recibió %s)', t.clues, t.cant, t.tope, t.otras), '; ')
      into v_excede
      from (
        select r.clues, r.cant,
               ceil(coalesce(mm.dosis, 0) / 10) as tope,
               coalesce(o.fr, 0) as otras
          from (select x ->> 'clues' as clues,
                       sum(coalesce((x ->> 'cantidad_frascos')::numeric, 0)) as cant
                  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
                 group by 1) r
          left join lateral (
            select sum(coalesce(nullif(e.value, '')::numeric, 0)) as dosis
              from influenza_metas m, jsonb_each_text(m.metas) e
             where m.anio_campana = p_campana and m.clues = r.clues) mm on true
          left join lateral (
            select sum(d.cantidad_frascos) as fr
              from influenza_distribucion_frascos d
             where d.anio_campana = p_campana and d.clues = r.clues
               and d.numero_entrega <> p_numero) o on true
         where r.cant > 0
      ) t
     where t.otras + t.cant > t.tope;

    if v_excede is not null then
      raise exception 'El reparto rebasa la meta de frascos de la campaña en: %', v_excede
        using errcode = '23514';
    end if;
  end if;

  delete from influenza_distribucion_frascos
   where anio_campana = p_campana and municipio = p_municipio and numero_entrega = p_numero;

  insert into influenza_distribucion_frascos
    (anio_campana, clues, municipio, cantidad_frascos, fecha_entrega, numero_entrega, entregado_por, lote, fecha_caducidad)
  select p_campana, x ->> 'clues', p_municipio, (x ->> 'cantidad_frascos')::int, p_fecha, p_numero,
         upper(p_entregado_por), nullif(p_lote, ''), p_caducidad
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
   where coalesce((x ->> 'cantidad_frascos')::int, 0) > 0;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.influenza_guardar_reparto(text, text, integer, date, text, date, text, jsonb) from public, anon;
grant execute on function public.influenza_guardar_reparto(text, text, integer, date, text, date, text, jsonb) to authenticated;
