-- COVID-19: el reparto de frascos YA NO se limita a la meta (2026-11-23).
-- Motivo: la federacion entrega las marcas como quiere (la Pfizer llego por encima de lo que la meta adulta preveia) y el
-- reparto de Pfizer quedaba bloqueado con «Rebasa la meta de COVID». La meta sigue siendo referencia visible, no candado.
-- Se conserva UNA regla: un destino/unidad sin meta de ninos no recibe Moderna (se reserva para ninos). Lo hacen los
-- triggers; covid_guardar_reparto ya no repite ningun tope (los triggers de covid_distribucion_frascos validan al insertar).
-- Idempotente. Reemplaza lo de covid_metas_frascos.sql y covid_moderna_sin_ninos.sql.

create or replace function public.covid_remesas_tope_meta()
returns trigger language plpgsql set search_path = public as $$
declare
  v_dest text;
  v_total numeric;
  v_adulto numeric;
begin
  if new.marca <> 'MODERNA' then return new; end if;
  if tg_op = 'UPDATE' and new.asignacion is not distinct from old.asignacion then return new; end if;
  foreach v_dest in array array['QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM'] loop
    if coalesce(nullif(new.asignacion ->> v_dest, '')::numeric, 0) <= 0 then continue; end if;
    select md.total, md.adulto into v_total, v_adulto from public.covid_meta_dosis(new.anio_campana, v_dest, null) md;
    if coalesce(v_total, 0) > 0 and v_total <= coalesce(v_adulto, 0) then
      raise exception '% no tiene meta de ninos: no recibe Moderna. Su meta (% dosis) se cubre al 100 %% con Pfizer (% frascos).',
        v_dest, v_total, ceil(v_adulto / 6.0) using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.covid_distribucion_tope_meta()
returns trigger language plpgsql set search_path = public as $$
declare
  v_total numeric;
  v_adulto numeric;
begin
  if new.marca <> 'MODERNA' or coalesce(new.cantidad_frascos, 0) <= 0 then return new; end if;
  select md.total, md.adulto into v_total, v_adulto from public.covid_meta_dosis(new.anio_campana, null, new.clues) md;
  if coalesce(v_total, 0) > 0 and v_total <= coalesce(v_adulto, 0) then
    raise exception 'La unidad % no tiene meta de ninos: no recibe Moderna. Su meta (% dosis) se cubre al 100 %% con Pfizer (% frascos).',
      new.clues, v_total, ceil(v_adulto / 6.0) using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---- RPC: el municipal reparte lo que le asignó Jurisdicción entre sus unidades (atómico)
create or replace function public.covid_guardar_reparto(
  p_campana text,
  p_marca text,
  p_municipio text,
  p_numero integer,
  p_fecha date,
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
  v_marca text := upper(coalesce(p_marca, ''));
  v_dpf integer := public.covid_dosis_por_frasco(p_marca);
  v_asignado numeric;
  v_suma numeric;
  v_ajenas integer;
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
  if v_dpf is null then
    raise exception 'Marca inválida: % (usa MODERNA o PFIZER)', p_marca;
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Reparto inválido';
  end if;

  select (r.asignacion ->> v_destino)::numeric
    into v_asignado
    from covid_remesas r
   where r.anio_campana = p_campana and r.marca = v_marca and r.numero_entrega = p_numero;
  if not found then
    raise exception 'La Jurisdicción todavía no registra la entrega % de % de la campaña %', p_numero, v_marca, p_campana;
  end if;

  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
             where coalesce((x ->> 'cantidad_frascos')::numeric, 0) < 0
                or coalesce((x ->> 'cantidad_frascos')::numeric, 0) <> trunc(coalesce((x ->> 'cantidad_frascos')::numeric, 0))) then
    raise exception 'Las cantidades deben ser frascos enteros y no negativos';
  end if;

  select coalesce(sum(coalesce((x ->> 'cantidad_frascos')::numeric, 0)), 0)
    into v_suma
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;

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

  delete from covid_distribucion_frascos
   where anio_campana = p_campana and marca = v_marca
     and municipio = p_municipio and numero_entrega = p_numero;

  insert into covid_distribucion_frascos
    (anio_campana, marca, clues, municipio, cantidad_frascos, fecha_entrega, numero_entrega, entregado_por)
  select p_campana, v_marca, x ->> 'clues', p_municipio, (x ->> 'cantidad_frascos')::int, p_fecha, p_numero,
         upper(p_entregado_por)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
   where coalesce((x ->> 'cantidad_frascos')::int, 0) > 0;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.covid_guardar_reparto(text, text, text, integer, date, text, jsonb) from public, anon;
grant execute on function public.covid_guardar_reparto(text, text, text, integer, date, text, jsonb) to authenticated;
