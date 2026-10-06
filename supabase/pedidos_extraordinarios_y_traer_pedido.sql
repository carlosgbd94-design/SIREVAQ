-- =============================================================================
-- Pedidos extraordinarios de biológico + "Traer pedido de biológico" a Requisiciones.
--
-- Antes: calendario_pedidos tiene UNA fila por mes (PK anio_mes), así que un pedido extra
-- no tenía dónde vivir: la captura "extraordinaria" se guardaba con la misma fecha del pedido
-- ordinario y lo pisaba. Ahora:
--
--  * pedidos_extraordinarios: aperturas que abre ADMIN. Cada una es un pedido propio, con su
--    fecha (fecha_programada = fecha_pedido_programada con la que se guarda en biologicos_pedido)
--    y su ventana de captura. Las unidades capturan ahí y NO tocan el pedido del día 22.
--  * bio_pedidos_clasificados(anio, mes): de TODOS los pedidos con fecha en ese mes decide cuál
--    es el ordinario (el del calendario / el más cercano al día 22) y marca los demás como
--    EXTRAORDINARIO. Lo usan la exportación y Requisiciones, así que no dependen de lo que
--    cada captura haya escrito en tipo_pedido.
--  * requi_pedido_equivalencias: nombre del biológico en el pedido -> código en Requisiciones.
--  * requi_requisiciones.pedido_fecha + requi_traer_pedido_biologico: llena en una requisición
--    (BORRADOR) los pasos 1-3 con las cantidades pedidas (por unidad), lote POR DEFINIR.
--    Influenza no entra: viene del reparto de frascos (requi_traer_reparto_influenza).
-- Idempotente.
-- =============================================================================

-- 1) Aperturas extraordinarias ------------------------------------------------
create table if not exists public.pedidos_extraordinarios (
  id uuid primary key default gen_random_uuid(),
  fecha_programada date not null,
  habilitar_desde date not null,
  habilitar_hasta date not null,
  motivo text,
  activo boolean not null default true,
  creado_por text,
  creado_en timestamptz not null default now(),
  constraint pedidos_extraordinarios_rango check (habilitar_hasta >= habilitar_desde)
);

create unique index if not exists pedidos_extraordinarios_fecha_uk
  on public.pedidos_extraordinarios (fecha_programada);

alter table public.pedidos_extraordinarios enable row level security;

drop policy if exists pedidos_extraordinarios_select on public.pedidos_extraordinarios;
create policy pedidos_extraordinarios_select on public.pedidos_extraordinarios
  for select to authenticated using (true);
-- Sin políticas de escritura: solo las funciones de abajo (ADMIN) modifican la tabla.

create or replace function public._pedido_es_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from perfiles p
                  where p.id = (select auth.uid()) and p.activo = 'SI' and upper(p.rol) = 'ADMIN');
$$;
-- Solo la usan las funciones SECURITY DEFINER de abajo: nadie la llama directo.
revoke all on function public._pedido_es_admin() from public, anon, authenticated;

-- Abre (o reabre / actualiza) un pedido extraordinario. La fecha del pedido es también el día
-- en que empieza a poder capturarse; p_hasta es el último día de captura.
create or replace function public.pedido_extra_abrir(p_fecha date, p_hasta date, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_ordinaria date;
  v_fila pedidos_extraordinarios;
begin
  if not _pedido_es_admin() then
    raise exception 'Solo el administrador puede abrir pedidos extraordinarios' using errcode = '42501';
  end if;
  if p_fecha is null or p_hasta is null then raise exception 'Indica la fecha del pedido y el último día de captura'; end if;
  if p_hasta < p_fecha then raise exception 'El último día de captura no puede ser anterior a la fecha del pedido'; end if;

  -- El ordinario es el del calendario del mes: un extra no puede llevar esa misma fecha.
  select c.fecha_programada into v_ordinaria from calendario_pedidos c where c.anio_mes = to_char(p_fecha, 'YYYY-MM');
  if v_ordinaria = p_fecha then
    raise exception 'El % es la fecha del pedido ordinario de ese mes; elige otro día para el extraordinario', to_char(p_fecha, 'DD/MM/YYYY');
  end if;
  -- Y tampoco la de un pedido que ya se capturó como ordinario.
  if exists (select 1 from biologicos_pedido b
              where b.fecha_pedido_programada = p_fecha and coalesce(b.tipo_pedido, 'MENSUAL') <> 'EXTRAORDINARIO')
     and not exists (select 1 from pedidos_extraordinarios e where e.fecha_programada = p_fecha) then
    raise exception 'Ya hay un pedido ordinario capturado con fecha %; elige otro día', to_char(p_fecha, 'DD/MM/YYYY');
  end if;

  select coalesce(p.nombre, p.usuario, 'ADMIN') into v_nombre from perfiles p where p.id = (select auth.uid());

  insert into pedidos_extraordinarios (fecha_programada, habilitar_desde, habilitar_hasta, motivo, activo, creado_por)
    values (p_fecha, p_fecha, p_hasta, nullif(trim(p_motivo), ''), true, v_nombre)
  on conflict (fecha_programada) do update
    set habilitar_hasta = excluded.habilitar_hasta, motivo = excluded.motivo, activo = true
  returning * into v_fila;

  return to_jsonb(v_fila);
end;
$$;

-- Cierra o reabre una apertura (no borra nada de lo capturado).
create or replace function public.pedido_extra_estado(p_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not _pedido_es_admin() then
    raise exception 'Solo el administrador puede cambiar pedidos extraordinarios' using errcode = '42501';
  end if;
  update pedidos_extraordinarios set activo = p_activo where id = p_id;
  if not found then raise exception 'El pedido extraordinario ya no existe'; end if;
end;
$$;

-- Elimina una apertura que nunca recibió capturas.
create or replace function public.pedido_extra_eliminar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_fecha date;
begin
  if not _pedido_es_admin() then
    raise exception 'Solo el administrador puede eliminar pedidos extraordinarios' using errcode = '42501';
  end if;
  select fecha_programada into v_fecha from pedidos_extraordinarios where id = p_id;
  if v_fecha is null then raise exception 'El pedido extraordinario ya no existe'; end if;
  if exists (select 1 from biologicos_pedido b where b.fecha_pedido_programada = v_fecha) then
    raise exception 'Ya tiene capturas de unidades; ciérralo en lugar de eliminarlo';
  end if;
  delete from pedidos_extraordinarios where id = p_id;
end;
$$;

revoke all on function public.pedido_extra_abrir(date, date, text) from public, anon;
revoke all on function public.pedido_extra_estado(uuid, boolean) from public, anon;
revoke all on function public.pedido_extra_eliminar(uuid) from public, anon;
grant execute on function public.pedido_extra_abrir(date, date, text) to authenticated;
grant execute on function public.pedido_extra_estado(uuid, boolean) to authenticated;
grant execute on function public.pedido_extra_eliminar(uuid) to authenticated;

-- 2) Clasificación automática de los pedidos de un mes -------------------------
-- Ordinario = el pedido (no marcado como extra) cuya fecha coincide con el calendario del mes
-- o, si no coincide ninguno, el más cercano a esa fecha (empates: el anterior). Todos los demás: EXTRAORDINARIO.
-- Una fecha dada de alta en pedidos_extraordinarios (o capturada solo como EXTRAORDINARIO) es
-- siempre extraordinaria, aunque sea la única del mes.
-- 'MENSUAL' = ordinario (el mismo valor que ya guarda tipo_pedido).
create or replace function public.bio_pedidos_clasificados(p_anio integer, p_mes integer)
returns table (fecha date, tipo text, unidades integer, frascos numeric, ultima_captura timestamptz, motivo text, extra_abierto boolean)
language sql
stable
set search_path = public
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) d1, (make_date(p_anio, p_mes, 1) + interval '1 month')::date d2
  ), cal as (
    -- Fecha del pedido ordinario: la del calendario del mes o, si no hay fila (meses sin calendario),
    -- el día 22 corrido al viernes cuando cae en fin de semana (como hace la captura).
    select coalesce(
      (select c.fecha_programada from calendario_pedidos c where c.anio_mes = to_char(make_date(p_anio, p_mes, 1), 'YYYY-MM')),
      make_date(p_anio, p_mes, 22) - case extract(dow from make_date(p_anio, p_mes, 22))::int when 6 then 1 when 0 then 2 else 0 end
    ) as fecha_programada
  ), cap as (
    select b.fecha_pedido_programada f,
           count(distinct b.clues)::integer u,
           coalesce(sum(b.pedido_frascos), 0) fr,
           max(b.timestamp) ult,
           bool_and(coalesce(b.tipo_pedido, 'MENSUAL') = 'EXTRAORDINARIO') solo_extra
      from biologicos_pedido b, rango r
     where b.fecha_pedido_programada >= r.d1 and b.fecha_pedido_programada < r.d2
     group by b.fecha_pedido_programada
  ), ext as (
    select e.fecha_programada f, e.motivo, e.activo
      from pedidos_extraordinarios e, rango r
     where e.fecha_programada >= r.d1 and e.fecha_programada < r.d2
  ), base as (
    select coalesce(c.f, e.f) f, coalesce(c.u, 0) u, coalesce(c.fr, 0) fr, c.ult, e.motivo,
           (e.f is not null) es_extra, coalesce(e.activo, false) extra_abierto,
           (e.f is not null or coalesce(c.solo_extra, false)) explicito
      from cap c full join ext e on e.f = c.f
     where c.f is not null or e.activo
  ), ord as (
    select f from base where not explicito
     order by (f = (select fecha_programada from cal)) desc,
              abs(f - (select fecha_programada from cal)), f
     limit 1
  )
  select b.f, case when b.f = (select f from ord) then 'MENSUAL' else 'EXTRAORDINARIO' end,
         b.u, b.fr, b.ult, b.motivo, b.extra_abierto
    from base b
   order by b.f;
$$;

revoke all on function public.bio_pedidos_clasificados(integer, integer) from public, anon;
grant execute on function public.bio_pedidos_clasificados(integer, integer) to authenticated;

-- 3) Pedido -> Requisiciones -------------------------------------------------
create table if not exists public.requi_pedido_equivalencias (
  biologico_pedido text primary key,
  codigo_articulo text,
  nota text
);
alter table public.requi_pedido_equivalencias enable row level security;
drop policy if exists requi_pedido_equivalencias_select on public.requi_pedido_equivalencias;
create policy requi_pedido_equivalencias_select on public.requi_pedido_equivalencias
  for select to authenticated using (true);

insert into public.requi_pedido_equivalencias (biologico_pedido, codigo_articulo, nota) values
  ('BCG', '3801', null),
  ('DPT', '3805', null),
  ('HEPATITIS A', '6187', null),
  ('HEPATITIS B', '2526', null),
  ('HEXAVALENTE', '6135', null),
  ('NEUMOCOCICA 13', '148', null),
  ('NEUMOCOCICA 20', '6508', null),
  ('ROTAVIRUS', '150', null),
  ('SR', '3800', null),
  ('SRP', '3820', 'SRP unidosis (3820); el multidosis (3821) se captura a mano'),
  ('TD', '3810', null),
  ('TDPA', '3808', null),
  ('VARICELA', '6056', null),
  ('VPH', '6501', null),
  ('VSR', '6509', null),
  ('COVID-19', null, 'Hay dos presentaciones (Moderna / Pfizer): se captura a mano'),
  ('INFLUENZA', null, 'Viene del reparto de frascos (Traer reparto de influenza)')
on conflict (biologico_pedido) do nothing;

alter table public.requi_requisiciones add column if not exists pedido_fecha date;

-- Un pedido se trae a una sola requisición.
create unique index if not exists requi_requisiciones_pedido_uk
  on public.requi_requisiciones (pedido_fecha) where pedido_fecha is not null;

create or replace function public.requi_traer_pedido_biologico(p_requisicion uuid, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_estado text;
  v_lote uuid;
  v_bio record;
  v_nombres text[] := '{}';
  v_con_lotes text[] := '{}';
  v_detalle jsonb := '[]'::jsonb;
  v_total numeric;
  v_n_uni integer;
  v_gran_total numeric := 0;
  v_unidades_tot integer := 0;
  v_sin_unidad jsonb;
  v_sin_equiv jsonb;
  v_influenza numeric;
begin
  select upper(p.rol) into v_rol from perfiles p
   where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    raise exception 'Solo Jurisdicción puede traer el pedido de biológico' using errcode = '42501';
  end if;

  select r.estado into v_estado from requi_requisiciones r where r.id = p_requisicion for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if v_estado <> 'BORRADOR' then raise exception 'La requisición está cerrada; no se puede traer el pedido'; end if;

  if not exists (select 1 from biologicos_pedido b where b.fecha_pedido_programada = p_fecha) then
    raise exception 'No hay capturas del pedido con fecha %', to_char(p_fecha, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from requi_requisiciones r where r.id <> p_requisicion and r.pedido_fecha = p_fecha) then
    raise exception 'El pedido del % ya está vinculado a otra requisición', to_char(p_fecha, 'DD/MM/YYYY');
  end if;

  -- Pedido por unidad y biológico del catálogo (varias filas del mismo CLUES/biológico se suman).
  drop table if exists _pedido_req;
  create temp table _pedido_req on commit drop as
    select cb.id bio_id, cb.nombre bio_nombre, cb.codigo_articulo, u.id unidad_id, u.municipio, sum(b.pedido_frascos) cantidad
      from biologicos_pedido b
      join requi_pedido_equivalencias e on e.biologico_pedido = upper(trim(b.biologico)) and e.codigo_articulo is not null
      join requi_catalogo_biologicos cb on cb.codigo_articulo = e.codigo_articulo and cb.activo
      join requi_unidades u on u.clues = b.clues and u.activo
     where b.fecha_pedido_programada = p_fecha and coalesce(b.pedido_frascos, 0) > 0
     group by cb.id, cb.nombre, cb.codigo_articulo, u.id, u.municipio;

  for v_bio in select distinct bio_id, bio_nombre, codigo_articulo from _pedido_req order by codigo_articulo loop
    -- Lotes reales ya asignados: no se pisan (se corrige directo en los pasos 2 y 3).
    if exists (select 1 from requi_items_jurisdiccion i join requi_lotes l on l.id = i.lote_id
                where i.requisicion_id = p_requisicion and i.requi_biologico_id = v_bio.bio_id
                  and l.numero_lote <> 'POR DEFINIR' and i.cantidad_surtida > 0) then
      v_con_lotes := v_con_lotes || v_bio.bio_nombre;
      continue;
    end if;

    insert into requi_lotes (requi_biologico_id, numero_lote) values (v_bio.bio_id, 'POR DEFINIR')
      on conflict (requi_biologico_id, numero_lote) do nothing;
    select l.id into v_lote from requi_lotes l where l.requi_biologico_id = v_bio.bio_id and l.numero_lote = 'POR DEFINIR';

    delete from requi_distribucion_unidad    where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;
    delete from requi_distribucion_municipio where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;
    delete from requi_items_jurisdiccion     where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;

    select sum(cantidad), count(*) into v_total, v_n_uni from _pedido_req where bio_id = v_bio.bio_id;

    insert into requi_items_jurisdiccion (requisicion_id, requi_biologico_id, lote_id, cantidad_surtida)
      values (p_requisicion, v_bio.bio_id, v_lote, v_total);
    insert into requi_distribucion_municipio (requisicion_id, municipio, requi_biologico_id, lote_id, cantidad)
      select p_requisicion, municipio, v_bio.bio_id, v_lote, sum(cantidad)
        from _pedido_req where bio_id = v_bio.bio_id group by municipio;
    insert into requi_distribucion_unidad (requisicion_id, unidad_id, requi_biologico_id, lote_id, cantidad)
      select p_requisicion, unidad_id, v_bio.bio_id, v_lote, cantidad
        from _pedido_req where bio_id = v_bio.bio_id;

    v_nombres := v_nombres || v_bio.bio_nombre;
    v_gran_total := v_gran_total + v_total;
    v_unidades_tot := greatest(v_unidades_tot, v_n_uni);
    v_detalle := v_detalle || jsonb_build_object('codigo', v_bio.codigo_articulo, 'nombre', v_bio.bio_nombre, 'frascos', v_total, 'unidades', v_n_uni);
  end loop;

  -- Lo que no se pudo traer, para avisarlo.
  select coalesce(jsonb_agg(jsonb_build_object('clues', x.clues, 'frascos', x.fr) order by x.clues), '[]'::jsonb) into v_sin_unidad
    from (select b.clues, sum(b.pedido_frascos) fr
            from biologicos_pedido b
            join requi_pedido_equivalencias e on e.biologico_pedido = upper(trim(b.biologico)) and e.codigo_articulo is not null
           where b.fecha_pedido_programada = p_fecha and coalesce(b.pedido_frascos, 0) > 0
             and not exists (select 1 from requi_unidades u where u.clues = b.clues and u.activo)
           group by b.clues) x;

  select coalesce(jsonb_agg(jsonb_build_object('biologico', x.bio, 'frascos', x.fr, 'nota', x.nota) order by x.bio), '[]'::jsonb) into v_sin_equiv
    from (select upper(trim(b.biologico)) bio, sum(b.pedido_frascos) fr, max(e.nota) nota
            from biologicos_pedido b
            left join requi_pedido_equivalencias e on e.biologico_pedido = upper(trim(b.biologico))
           where b.fecha_pedido_programada = p_fecha and coalesce(b.pedido_frascos, 0) > 0
             and e.codigo_articulo is null and upper(trim(b.biologico)) <> 'INFLUENZA'
           group by upper(trim(b.biologico))) x;

  select coalesce(sum(b.pedido_frascos), 0) into v_influenza
    from biologicos_pedido b where b.fecha_pedido_programada = p_fecha and upper(trim(b.biologico)) = 'INFLUENZA';

  update requi_requisiciones set pedido_fecha = p_fecha where id = p_requisicion;

  return jsonb_build_object(
    'fecha', p_fecha, 'frascos', v_gran_total, 'biologicos', v_detalle, 'unidades', v_unidades_tot,
    'omitidos_con_lotes', to_jsonb(v_con_lotes), 'clues_sin_unidad', v_sin_unidad,
    'sin_equivalencia', v_sin_equiv, 'influenza_pedida', v_influenza);
end;
$$;

revoke all on function public.requi_traer_pedido_biologico(uuid, date) from public, anon;
grant execute on function public.requi_traer_pedido_biologico(uuid, date) to authenticated;
