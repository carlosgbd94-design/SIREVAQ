-- Aviso a Jurisdicción cuando el municipio captura/corrige/quita el pedido de una unidad DESPUÉS de que el pedido ya se
-- trajo a una requisición. Se muestra como banner no invasivo dentro del panel de Requisiciones (NO en la campanita:
-- casi nadie revisa esas notificaciones). Reemplaza la notificación de pedido_municipal_aviso_jurisdiccion.sql.
-- Idempotente. Aplicar después de pedido_municipal_captura.sql y pedido_municipal_aviso_jurisdiccion.sql.

-- Bitácora de lo que el municipio captura/corrige/quita
create table if not exists public.pedido_municipal_log (
  id bigint generated always as identity primary key,
  clues text not null,
  fecha date not null,
  accion text not null check (accion in ('GUARDAR','QUITAR')),
  frascos numeric not null default 0,
  unidad text,
  municipio text,
  nombre text,
  ts timestamptz not null default now()
);
create index if not exists pedido_municipal_log_fecha_idx on public.pedido_municipal_log (fecha, clues, ts desc);
alter table public.pedido_municipal_log enable row level security;
-- Sin políticas: solo se lee/escribe desde las funciones SECURITY DEFINER.

-- Cuándo se trajo el pedido a la requisición (cada vez que se trae, también al volver a traerlo)
alter table public.requi_requisiciones add column if not exists pedido_traido_ts timestamptz;
create or replace function public._trg_requi_pedido_traido_ts()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.pedido_fecha is not null then new.pedido_traido_ts := now(); end if;
  return new;
end;
$$;
drop trigger if exists trg_requi_pedido_traido_ts on public.requi_requisiciones;
create trigger trg_requi_pedido_traido_ts
  before update of pedido_fecha on public.requi_requisiciones
  for each row execute function public._trg_requi_pedido_traido_ts();

-- El aviso ahora es una fila de bitácora (antes una notificación en la campanita)
create or replace function public._pedido_municipal_avisar(
  p_clues text, p_fecha date, p_unidad text, p_municipio text, p_nombre text, p_rol text, p_accion text, p_frascos numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pedido_municipal_log (clues, fecha, accion, frascos, unidad, municipio, nombre)
  values (p_clues, p_fecha, p_accion, coalesce(p_frascos, 0), p_unidad, p_municipio, p_nombre);
end;
$$;
revoke all on function public._pedido_municipal_avisar(text, date, text, text, text, text, text, numeric) from public, anon, authenticated;

-- Cambios del municipio posteriores al momento en que se trajo el pedido a esta requisición (último movimiento por unidad)
create or replace function public.requi_avisos_pedido_municipal(p_requisicion uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_fecha date;
  v_ts timestamptz;
  v_cambios jsonb;
begin
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    return jsonb_build_object('fecha', null, 'cambios', '[]'::jsonb);
  end if;
  select r.pedido_fecha, r.pedido_traido_ts into v_fecha, v_ts from requi_requisiciones r where r.id = p_requisicion;
  if v_fecha is null then return jsonb_build_object('fecha', null, 'cambios', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object('clues', x.clues, 'unidad', x.unidad, 'municipio', x.municipio,
           'accion', x.accion, 'frascos', x.frascos, 'nombre', x.nombre, 'ts', x.ts) order by x.municipio, x.unidad), '[]'::jsonb)
    into v_cambios
    from (select distinct on (l.clues) l.* from pedido_municipal_log l
           where l.fecha = v_fecha and l.ts > coalesce(v_ts, '-infinity'::timestamptz)
           order by l.clues, l.ts desc) x;

  return jsonb_build_object('fecha', v_fecha, 'traido_ts', v_ts, 'cambios', v_cambios);
end;
$$;
revoke all on function public.requi_avisos_pedido_municipal(uuid) from public, anon;
grant execute on function public.requi_avisos_pedido_municipal(uuid) to authenticated;
