-- 2026-11-08: lecturas por rango de fechas de existencia_detalle / consumibles / biologicos_existencia.
-- Causa: las políticas RLS del rol MUNICIPAL (y "Existencia select RLS") tenían un EXISTS correlacionado a perfiles
-- que se evaluaba FILA POR FILA (en un rango de 1296 filas = 1296 consultas a perfiles, ~15 mil bloques por llamada).
-- Ahora el alcance del usuario se calcula UNA vez por consulta con (select mis_municipios()) / (select mi_clues_unidad()).
-- Funciones SECURITY INVOKER: leen perfiles con el RLS del propio usuario, igual que antes.
-- El bloque compara, para varios usuarios de cada rol, el hash de las filas visibles ANTES y DESPUÉS y se revierte si algo difiere.
-- Además: índices por fecha (consumibles, existencia_detalle, notificaciones) y se quitan 2 índices redundantes.
create index if not exists idx_consumibles_fecha          on public.consumibles (fecha);
create index if not exists idx_det_fecha                  on public.existencia_detalle (fecha);
create index if not exists idx_notificaciones_created_ts  on public.notificaciones (created_ts desc);
drop index if exists public.idx_exist_clues_fecha;   -- idéntico al único biologicos_existencia_clues_fecha_uq
drop index if exists public.idx_exist_clues;         -- prefijo de los índices (clues, fecha)

create or replace function public.mis_municipios() returns text[]
language sql stable set search_path to 'public','pg_temp' as $$
  select case when p.rol = 'MUNICIPAL'
              then array[p.municipio]::text[] || coalesce(p.municipios_allowed, '{}'::text[]) || coalesce(string_to_array(p.municipio, ','), '{}'::text[])
              else '{}'::text[] end
  from public.perfiles p where p.id = auth.uid();
$$;
create or replace function public.mi_clues_unidad() returns text
language sql stable set search_path to 'public','pg_temp' as $$
  select case when p.rol = 'UNIDAD' then p.clues end from public.perfiles p where p.id = auth.uid();
$$;

do $$
declare r record; t text; h text; antes jsonb := '{}'; despues jsonb := '{}';
  tablas text[] := array['biologicos_existencia','consumibles','existencia_detalle'];
begin
  for pase in 1..2 loop
    if pase = 2 then
      alter policy "RLS_biologicos_existencia_Muni" on public.biologicos_existencia using (municipio = any (((select public.mis_municipios()))::text[]));
      alter policy "RLS_consumibles_Muni"            on public.consumibles            using (municipio = any (((select public.mis_municipios()))::text[]));
      alter policy "RLS_existencia_detalle_Muni"     on public.existencia_detalle     using (municipio = any (((select public.mis_municipios()))::text[]));
      alter policy "Existencia select RLS" on public.biologicos_existencia using (
        (select is_admin()) or municipio = any (((select public.mis_municipios()))::text[]) or clues = (select public.mi_clues_unidad()));
    end if;
    for r in select id from (select id, row_number() over (partition by rol order by usuario) rn from public.perfiles where activo = 'SI') x where rn <= 3 loop
      foreach t in array tablas loop
        perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
        set local role authenticated;
        execute format('select md5(coalesce(string_agg(id::text, ''|'' order by id), '''')) from public.%I', t) into h;
        reset role;
        if pase = 1 then antes := antes || jsonb_build_object(r.id || ':' || t, h);
        else despues := despues || jsonb_build_object(r.id || ':' || t, h); end if;
      end loop;
    end loop;
  end loop;
  if antes is distinct from despues then raise exception 'La visibilidad cambio para algun usuario; se revierte'; end if;
  raise notice 'Visibilidad identica para % comprobaciones', (select count(*) from jsonb_object_keys(antes));
end $$;
