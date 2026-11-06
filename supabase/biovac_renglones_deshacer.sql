-- ===========================================================================
-- Deshacer la eliminación de un renglón (lote) del Movimiento de Biológico.
-- Antes, eliminar un renglón lo borraba sin rastro de sus cantidades (existencia anterior, recibido, APLICADAS,
-- desechadas). Ahora se elimina con biovac_eliminar_renglon, que guarda una copia completa, y se puede restaurar
-- con biovac_restaurar_renglon (mismo id, mismas cantidades) o consultar con biovac_renglones_eliminados.
-- La tabla solo se toca por estas funciones (RLS activa sin políticas). ADITIVA e idempotente.
-- ===========================================================================
create table if not exists public.biovac_renglones_borrados (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null,
  renglon jsonb not null,
  borrado_por uuid,
  usuario text,
  borrado_en timestamptz not null default now(),
  restaurado_en timestamptz
);
create index if not exists biovac_renglones_borrados_mov_idx on public.biovac_renglones_borrados (movimiento_id, borrado_en desc) where restaurado_en is null;
alter table public.biovac_renglones_borrados enable row level security;
revoke all on public.biovac_renglones_borrados from anon, authenticated;

create or replace function public.biovac_eliminar_renglon(p_renglon_id uuid, p_usuario text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare r biovac_renglones%rowtype; v_id uuid;
begin
  select * into r from biovac_renglones where id = p_renglon_id for update;
  if r.id is null then raise exception 'El renglón ya no existe.'; end if;
  perform _biovac_autoriza_movimiento(r.movimiento_id, false);
  insert into biovac_renglones_borrados (movimiento_id, renglon, borrado_por, usuario)
  values (r.movimiento_id, to_jsonb(r), auth.uid(), p_usuario) returning id into v_id;
  delete from biovac_renglones where id = p_renglon_id;   -- los candados del mes (cerrado, enviado, ventana) siguen aplicando y revierten todo
  return v_id;
end;
$$;

create or replace function public.biovac_renglones_eliminados(p_movimiento_id uuid)
returns table (id uuid, categoria text, numero_lote text, caducidad date, biologico text,
               existencia_anterior numeric, recibido numeric, aplicadas numeric, desechadas numeric,
               borrado_en timestamptz, usuario text)
language plpgsql security definer set search_path = public
as $$
begin
  perform _biovac_autoriza_movimiento(p_movimiento_id, false);
  return query
    select b.id, b.renglon->>'categoria', l.numero_lote, l.caducidad, cb.nombre_excel,
           coalesce((b.renglon->>'existencia_anterior_frascos')::numeric, 0), coalesce((b.renglon->>'recibido_frascos')::numeric, 0),
           coalesce((b.renglon->>'aplicadas_a')::numeric, 0) + coalesce((b.renglon->>'aplicadas_b')::numeric, 0),
           coalesce((b.renglon->>'desechadas_a')::numeric, 0) + coalesce((b.renglon->>'desechadas_b')::numeric, 0),
           b.borrado_en, b.usuario
    from biovac_renglones_borrados b
    left join biovac_lotes l on l.id = (b.renglon->>'lote_id')::uuid
    left join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    where b.movimiento_id = p_movimiento_id and b.restaurado_en is null
    order by b.borrado_en desc limit 30;
end;
$$;

create or replace function public.biovac_restaurar_renglon(p_borrado_id uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare b biovac_renglones_borrados%rowtype; v_json jsonb; v_lote text;
begin
  select * into b from biovac_renglones_borrados where id = p_borrado_id for update;
  if b.id is null then raise exception 'No se encontró el renglón eliminado.'; end if;
  if b.restaurado_en is not null then raise exception 'Ese renglón ya se restauró.'; end if;
  perform _biovac_autoriza_movimiento(b.movimiento_id, false);
  v_json := b.renglon;
  if exists (select 1 from biovac_renglones where movimiento_id = b.movimiento_id and lote_id = (v_json->>'lote_id')::uuid and categoria = v_json->>'categoria') then
    select numero_lote into v_lote from biovac_lotes where id = (v_json->>'lote_id')::uuid;
    raise exception 'Ya hay un renglón del lote % en %: captura ahí o elimínalo antes de restaurar el anterior.', v_lote, v_json->>'categoria';
  end if;
  insert into biovac_renglones select * from jsonb_populate_record(null::biovac_renglones, v_json);
  update biovac_renglones_borrados set restaurado_en = now() where id = b.id;
  return (v_json->>'id')::uuid;
end;
$$;

revoke all on function public.biovac_eliminar_renglon(uuid, text) from public, anon;
revoke all on function public.biovac_renglones_eliminados(uuid) from public, anon;
revoke all on function public.biovac_restaurar_renglon(uuid) from public, anon;
grant execute on function public.biovac_eliminar_renglon(uuid, text) to authenticated;
grant execute on function public.biovac_renglones_eliminados(uuid) to authenticated;
grant execute on function public.biovac_restaurar_renglon(uuid) to authenticated;
