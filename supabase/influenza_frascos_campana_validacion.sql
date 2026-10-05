-- =============================================================================
-- Influenza: reparto de frascos por campaña + validación en el servidor.
--
-- Corrige dos huecos de influenza_remesas_frascos.sql:
--
--  1) influenza_distribucion_frascos no distinguía campañas. influenza_guardar_reparto
--     borraba por municipio + número de entrega, así que la "1ª entrega" de la
--     campaña siguiente habría borrado la de la anterior. Ahora la tabla lleva
--     `anio_campana` y el RPC borra / consulta solo dentro de su campaña.
--
--  2) Cualquier usuario autenticado podía escribir cualquier cosa. Ahora:
--       * el RPC (security definer) valida el rol y el municipio del usuario;
--       * la suma repartida entre las unidades no puede rebasar lo que la
--         Jurisdicción asignó a ese destino en esa entrega (influenza_remesas);
--       * las CLUES deben pertenecer al municipio (o ser el hospital);
--       * (la RLS de la tabla ya restringía la escritura directa por rol y municipio).
--
-- Aplicar junto con el despliegue del cliente (envía p_campana). Idempotente.
-- =============================================================================

-- 1) Columna de campaña + relleno de lo existente --------------------------------
alter table public.influenza_distribucion_frascos
  add column if not exists anio_campana text;

update public.influenza_distribucion_frascos d
   set anio_campana = coalesce(
     -- campaña de la remesa con el mismo número (si solo hay una)
     (select min(r.anio_campana) from public.influenza_remesas r
       where r.numero_entrega = d.numero_entrega
      having count(distinct r.anio_campana) = 1),
     -- si hay varias, la remesa guardada más recientemente
     (select r.anio_campana from public.influenza_remesas r order by r.updated_at desc limit 1),
     -- sin remesas: la campaña de influenza activa
     (select c.nombre from public.campanas c
       where c.activo is true and c.nombre ilike 'Campaña Influenza%' limit 1)
   )
 where d.anio_campana is null;

do $$
begin
  if not exists (select 1 from public.influenza_distribucion_frascos where anio_campana is null) then
    alter table public.influenza_distribucion_frascos alter column anio_campana set not null;
  else
    raise notice 'Quedan filas sin campaña en influenza_distribucion_frascos; asígnalas y vuelve a correr para fijar NOT NULL.';
  end if;
end $$;

create index if not exists influenza_dist_frascos_campana_idx
  on public.influenza_distribucion_frascos (anio_campana, municipio, numero_entrega);

-- 2) RLS: sin cambios. En producción la tabla ya tiene RLS_influenza_frascos_Write_Admin
--    (ADMIN/JURISDICCIONAL) y _Write_Municipal (solo su municipio).

-- 3) RPC con campaña y validaciones ---------------------------------------------
drop function if exists public.influenza_guardar_reparto(text, integer, date, text, date, text, jsonb);

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

  -- Rol: Jurisdicción reparte a cualquier destino; el municipal solo a su(s) municipio(s)
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

  -- Lo que la Jurisdicción asignó a este destino en esta entrega
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

  -- Las CLUES deben ser de este destino (los hospitales son destino de una sola CLUES)
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
