-- =============================================================================
-- Influenza: el reparto de frascos debe sumar EXACTO lo asignado.
--
--  * influenza_guardar_reparto: antes solo rechazaba si la suma pasaba de lo asignado por
--    Jurisdicción; ahora también si falta (el reparto entre unidades debe cerrar exacto).
--  * influenza_remesas: trigger que exige que lo repartido entre los 6 destinos sume
--    exactamente total_frascos (Jurisdicción no puede dejar frascos sin asignar ni pasarse).
-- Idempotente.
-- =============================================================================

create or replace function public.influenza_remesas_suma_exacta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_suma numeric;
begin
  select coalesce(sum(e.value::numeric), 0) into v_suma
    from jsonb_each_text(new.asignacion) e
   where e.key in ('QUERETARO', 'CORREGIDORA', 'MARQUES', 'HUIMILPAN', 'NHG', 'HENM');
  if v_suma <> new.total_frascos then
    raise exception 'El reparto suma % frascos y la entrega recibió %: debe coincidir exacto', v_suma, new.total_frascos
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_influenza_remesas_suma_exacta on public.influenza_remesas;
create trigger trg_influenza_remesas_suma_exacta
  before insert or update of asignacion, total_frascos on public.influenza_remesas
  for each row execute function public.influenza_remesas_suma_exacta();

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
