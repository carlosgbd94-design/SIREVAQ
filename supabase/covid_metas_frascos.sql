-- =============================================================================
-- COVID-19 (temporada invernal): metas por rubro y reparto de frascos por marca.
--
-- Mismo flujo que influenza (Jurisdicción -> 4 municipios + HENM/NHG -> unidades), pero en tablas
-- propias para no tocar nada de influenza (Requisiciones, lotes y triggers siguen como estaban).
--
--  * covid_metas: metas por rubro {"c1":..,"c6":..} (formato FORMATOS_TEMPORADA_INVERNAL 2026-2027,
--    PALOTEO INFLUENZA fila 62): c1 6-59 meses primera (0.25 mL), c2 6-59 meses segunda (0.25 mL),
--    c3 5-59 años con factores de riesgo, c4 60 años y más, c5 embarazadas, c6 personal de salud.
--  * covid_remesas / covid_distribucion_frascos: una entrega por MARCA (MODERNA o PFIZER).
--
-- Dosis (en equivalentes de 0.5 mL, como el formato: TOTAL = (c1+c2)/2 + c3+c4+c5+c6):
--   MODERNA: pediátrica 0.25 mL y adulto 0.5 mL; 1 frasco = 10 dosis de 0.5 mL.
--   PFIZER:  solo adultos (c3..c6), 0.5 mL; 1 frasco = 6 dosis.
-- Tope duro por destino y por unidad: lo recibido en todas las entregas y las dos marcas
-- (en dosis de 0.5 mL) no rebasa la meta total (+ el frasco que pueda quedar abierto), y los
-- frascos Pfizer no cubren más que la meta adulta. Idempotente.
-- =============================================================================

create table if not exists public.covid_metas (
  id uuid primary key default gen_random_uuid(),
  anio_campana text not null,
  municipio text not null,
  clues text,
  metas jsonb not null default '{}'::jsonb,
  modificado_por text not null,
  updated_at timestamptz default now()
);
create unique index if not exists covid_metas_unique_campana_muni_clues
  on public.covid_metas (anio_campana, municipio, clues) nulls not distinct;

create table if not exists public.covid_remesas (
  id uuid primary key default gen_random_uuid(),
  anio_campana text not null,
  marca text not null check (marca in ('MODERNA', 'PFIZER')),
  numero_entrega integer not null check (numero_entrega >= 1),
  fecha date not null,
  total_frascos integer not null check (total_frascos >= 0),
  asignacion jsonb not null default '{}'::jsonb,
  manual jsonb not null default '[]'::jsonb,
  creado_por text not null,
  updated_at timestamptz not null default now(),
  unique (anio_campana, marca, numero_entrega)
);

create table if not exists public.covid_distribucion_frascos (
  id uuid primary key default gen_random_uuid(),
  anio_campana text not null,
  marca text not null check (marca in ('MODERNA', 'PFIZER')),
  clues text not null,
  municipio text not null,
  cantidad_frascos integer not null default 0 check (cantidad_frascos >= 0),
  fecha_entrega date not null,
  numero_entrega integer not null default 1,
  entregado_por text,
  created_at timestamptz default now()
);
create index if not exists covid_dist_frascos_campana_idx
  on public.covid_distribucion_frascos (anio_campana, marca, municipio, numero_entrega);
create index if not exists covid_dist_frascos_clues_idx
  on public.covid_distribucion_frascos (anio_campana, clues);

alter table public.covid_metas enable row level security;
alter table public.covid_remesas enable row level security;
alter table public.covid_distribucion_frascos enable row level security;

-- ---- RLS (mismo esquema que influenza_metas / influenza_remesas / influenza_distribucion_frascos)
drop policy if exists "covid_metas_read" on public.covid_metas;
create policy "covid_metas_read" on public.covid_metas
  for select to authenticated using (true);
drop policy if exists "covid_metas_write_juris" on public.covid_metas;
create policy "covid_metas_write_juris" on public.covid_metas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));
drop policy if exists "covid_metas_write_municipal" on public.covid_metas;
create policy "covid_metas_write_municipal" on public.covid_metas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) = 'MUNICIPAL'
                  and covid_metas.municipio = any (p.municipios_allowed)))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) = 'MUNICIPAL'
                  and covid_metas.municipio = any (p.municipios_allowed)));

drop policy if exists "covid_remesas_read" on public.covid_remesas;
create policy "covid_remesas_read" on public.covid_remesas
  for select to authenticated using (true);
drop policy if exists "covid_remesas_write_juris" on public.covid_remesas;
create policy "covid_remesas_write_juris" on public.covid_remesas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));

drop policy if exists "covid_dist_read" on public.covid_distribucion_frascos;
create policy "covid_dist_read" on public.covid_distribucion_frascos
  for select to authenticated using (true);
drop policy if exists "covid_dist_write_juris" on public.covid_distribucion_frascos;
create policy "covid_dist_write_juris" on public.covid_distribucion_frascos
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));
drop policy if exists "covid_dist_write_municipal" on public.covid_distribucion_frascos;
create policy "covid_dist_write_municipal" on public.covid_distribucion_frascos
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) = 'MUNICIPAL'
                  and covid_distribucion_frascos.municipio = any (p.municipios_allowed)))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid())
                  and p.activo = 'SI' and upper(p.rol) = 'MUNICIPAL'
                  and covid_distribucion_frascos.municipio = any (p.municipios_allowed)));

-- ---- CLUES válida (igual que influenza_metas)
create or replace function public.covid_metas_clues_valida()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.clues is not null
     and not exists (select 1 from unidades u where u.clues = new.clues and u.activo = 'SI') then
    raise exception 'La CLUES % no existe o no está activa en el catálogo de unidades; no se puede guardar su meta de COVID.', new.clues
      using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_covid_metas_clues_valida on public.covid_metas;
create trigger trg_covid_metas_clues_valida
  before insert or update of clues on public.covid_metas
  for each row execute function public.covid_metas_clues_valida();

-- ---- Cálculo común
create or replace function public.covid_dosis_por_frasco(p_marca text)
returns integer language sql immutable as $$
  select case upper(p_marca) when 'MODERNA' then 10 when 'PFIZER' then 6 else null end;
$$;

-- Meta de un destino (clues nulo, municipio = destino) o de una unidad (clues):
-- total en dosis de 0.5 mL equivalentes (redondeado hacia arriba) y meta adulta (c3..c6).
create or replace function public.covid_meta_dosis(p_campana text, p_municipio text, p_clues text)
returns table (total numeric, adulto numeric)
language sql stable set search_path = public as $$
  select ceil(coalesce(sum(case when e.key in ('c1', 'c2') then v / 2.0 else v end), 0)),
         coalesce(sum(case when e.key in ('c3', 'c4', 'c5', 'c6') then v else 0 end), 0)
    from (select m.metas from covid_metas m
           where m.anio_campana = p_campana
             and ((p_clues is not null and m.clues = p_clues)
               or (p_clues is null and m.clues is null and upper(m.municipio) = upper(p_municipio)))) mm,
         lateral (select e2.key, coalesce(nullif(e2.value, '')::numeric, 0) as v
                    from jsonb_each_text(mm.metas) e2) e;
$$;

-- ---- Tope por destino (remesas)
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
drop trigger if exists trg_covid_remesas_tope_meta on public.covid_remesas;
create trigger trg_covid_remesas_tope_meta
  before insert or update of asignacion, total_frascos, marca on public.covid_remesas
  for each row execute function public.covid_remesas_tope_meta();

-- ---- Tope por unidad (red de seguridad para cualquier escritura; el RPC da el mensaje claro)
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
drop trigger if exists trg_covid_distribucion_tope_meta on public.covid_distribucion_frascos;
create trigger trg_covid_distribucion_tope_meta
  before insert or update of cantidad_frascos, clues, anio_campana, marca on public.covid_distribucion_frascos
  for each row execute function public.covid_distribucion_tope_meta();

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

  -- Tope por meta (ambas marcas, en dosis de 0.5 mL; Pfizer además limitada a la meta adulta)
  if exists (select 1 from covid_metas m where m.anio_campana = p_campana) then
    select string_agg(format('%s (%s frascos; le caben %s)', t.clues, t.cant, t.tope), '; ')
      into v_excede
      from (
        select r.clues, r.cant,
               case when v_marca = 'PFIZER'
                    then least(ceil(greatest(0, coalesce(md.total, 0) - coalesce(o.dosis, 0)) / v_dpf),
                               ceil(greatest(0, coalesce(md.adulto, 0) - coalesce(o.dosis_pfizer, 0)) / 6.0))
                    else ceil(greatest(0, coalesce(md.total, 0) - coalesce(o.dosis, 0)) / v_dpf)
               end as tope
          from (select x ->> 'clues' as clues,
                       sum(coalesce((x ->> 'cantidad_frascos')::numeric, 0)) as cant
                  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
                 group by 1) r
          left join lateral public.covid_meta_dosis(p_campana, null, r.clues) md on true
          left join lateral (
            select sum(d.cantidad_frascos * public.covid_dosis_por_frasco(d.marca)) as dosis,
                   sum(case when d.marca = 'PFIZER' then d.cantidad_frascos * 6 else 0 end) as dosis_pfizer
              from covid_distribucion_frascos d
             where d.anio_campana = p_campana and d.clues = r.clues
               and not (d.marca = v_marca and d.numero_entrega = p_numero)) o on true
         where r.cant > 0
      ) t
     where t.cant > t.tope;
    if v_excede is not null then
      raise exception 'El reparto rebasa la meta de COVID en: %', v_excede using errcode = '23514';
    end if;
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
