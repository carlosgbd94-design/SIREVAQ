-- =============================================================================
-- COVID-19: captura semanal por unidad y por marca (mismo flujo que influenza_capturas).
--
--  valores = { "MODERNA": { "c1":n, "c2":n, "c3":n, "c4":n, "c5":n, "c6":n }, "PFIZER": { "c3":n, "c4":n, "c5":n, "c6":n } }
--  Rubros (covid_metas): c1/c2 6-59 meses 1a/2a (0.25 mL), c3 5-59 años con factores de riesgo, c4 60+, c5 embarazadas,
--  c6 personal de salud. Pfizer solo adultos (c3..c6). Un reporte por unidad y semana (fecha = misma llave que
--  influenza_capturas): el nuevo reemplaza al anterior.
--  La meta es una sola por rubro: Moderna + Pfizer suman contra ella. Idempotente.
-- =============================================================================

create table if not exists public.covid_capturas (
  id uuid primary key default gen_random_uuid(),
  clues text not null,
  unidad text,
  municipio text,
  fecha date not null,
  anio_campana text not null,
  valores jsonb not null default '{}'::jsonb,
  capturado_por text,
  editado_por text,
  historial_ediciones jsonb not null default '[]'::jsonb,
  sin_movimiento boolean not null default false,
  folio text,
  updated_at timestamptz not null default now(),
  unique (clues, fecha)
);
create index if not exists covid_capturas_campana_idx on public.covid_capturas (anio_campana, municipio, clues);
create unique index if not exists idx_covid_capturas_folio on public.covid_capturas (folio);

alter table public.covid_capturas enable row level security;

drop policy if exists "RLS_covid_capturas_Read" on public.covid_capturas;
create policy "RLS_covid_capturas_Read" on public.covid_capturas
  for select to authenticated using ((select auth.role()) = 'authenticated');

drop policy if exists "RLS_covid_capturas_Write_Admin" on public.covid_capturas;
create policy "RLS_covid_capturas_Write_Admin" on public.covid_capturas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));

drop policy if exists "RLS_covid_capturas_Write_Municipal" on public.covid_capturas;
create policy "RLS_covid_capturas_Write_Municipal" on public.covid_capturas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'MUNICIPAL'
                  and covid_capturas.municipio = any (p.municipios_allowed)))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'MUNICIPAL'
                  and covid_capturas.municipio = any (p.municipios_allowed)));

drop policy if exists "RLS_covid_capturas_Write_Unidad" on public.covid_capturas;
create policy "RLS_covid_capturas_Write_Unidad" on public.covid_capturas
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'UNIDAD' and p.clues = covid_capturas.clues))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and upper(p.rol) = 'UNIDAD' and p.clues = covid_capturas.clues));

-- Folio COV-AAAAMMDD-XXXXXXXX (estable una vez asignado)
create or replace function public.covid_trg_asignar_folio() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.folio := coalesce(new.folio, 'COV-' || to_char(new.fecha, 'YYYYMMDD') || '-' || upper(substr(new.id::text, 1, 8)));
  else
    new.folio := coalesce(old.folio, new.folio, 'COV-' || to_char(new.fecha, 'YYYYMMDD') || '-' || upper(substr(new.id::text, 1, 8)));
  end if;
  return new;
end $$;

-- Forma, marcas y tope contra la meta de la unidad (solo rol UNIDAD, como influenza_trg_meta_unidad).
create or replace function public.covid_trg_valida_captura() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_metas jsonb;
  m text; k text;
  v_val numeric; v_old numeric; v_nuevo numeric; v_otros numeric; v_meta numeric; v_prev jsonb;
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

  select cm.metas into v_metas from covid_metas cm
  where cm.anio_campana = new.anio_campana and cm.clues = new.clues
  order by cm.updated_at desc nulls last limit 1;
  -- Sin renglón propio (p. ej. hospitales con meta a nivel destino) la meta se valida en el cliente.
  if v_metas is null then return new; end if;

  v_prev := case when tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then old.valores else '{}'::jsonb end;
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

drop trigger if exists covid_trg_asignar_folio on public.covid_capturas;
create trigger covid_trg_asignar_folio before insert or update on public.covid_capturas
  for each row execute function public.covid_trg_asignar_folio();
drop trigger if exists covid_trg_valida_captura on public.covid_capturas;
create trigger covid_trg_valida_captura before insert or update on public.covid_capturas
  for each row execute function public.covid_trg_valida_captura();
-- Misma ventana semanal y mismo candado de SIS enviado que Influenza (las funciones solo leen fecha/clues/campaña).
drop trigger if exists covid_trg_ventana_captura on public.covid_capturas;
create trigger covid_trg_ventana_captura before insert or update on public.covid_capturas
  for each row execute function public.influenza_trg_ventana_captura();
drop trigger if exists covid_trg_candado_sis_enviado on public.covid_capturas;
create trigger covid_trg_candado_sis_enviado before insert or update or delete on public.covid_capturas
  for each row execute function public.influenza_trg_candado_sis_enviado();
