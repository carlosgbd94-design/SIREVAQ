-- =============================================================================
-- Influenza <-> Requisiciones.
--
-- El reparto de frascos (influenza_remesas / influenza_distribucion_frascos) se hace PRIMERO:
-- cada municipio necesita su distribución para poder armar su requisición. Cuando llega la
-- entrega y se conocen los lotes, el lote vive solo en Requisiciones.
--
--  * requi_requisiciones.influenza_campana / influenza_entrega: a qué entrega del reparto
--    corresponde una requisición (única por campaña + entrega).
--  * requi_traer_reparto_influenza: llena en una requisición (BORRADOR) la vacuna de
--    influenza (6317, frasco ámpula 10 dosis) con lo repartido: paso 1 (total, lote POR DEFINIR),
--    paso 2 (4 municipios + HENM + NHG) y paso 3 (unidades). Los lotes se asignan después con
--    "Asignar lotes". No reemplaza si ya hay lotes reales asignados.
--  * influenza_lotes_entregas: lotes reales por unidad y entrega (solo lectura para el reparto).
-- Idempotente.
-- =============================================================================

alter table public.requi_requisiciones
  add column if not exists influenza_campana text,
  add column if not exists influenza_entrega integer;

create unique index if not exists requi_requisiciones_influenza_uk
  on public.requi_requisiciones (influenza_campana, influenza_entrega)
  where influenza_entrega is not null;

create or replace function public.requi_traer_reparto_influenza(
  p_requisicion uuid,
  p_campana text,
  p_numero integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_estado text;
  v_asig jsonb;
  v_bio uuid;
  v_lote uuid;
  v_total numeric;
  v_n_muni integer;
  v_n_uni integer;
  v_sin_unidad text[];
  v_muni_sin text[];
  v_destinos text[] := array['QUERETARO','CORREGIDORA','MARQUES','HUIMILPAN','NHG','HENM'];
begin
  select upper(p.rol) into v_rol from perfiles p
   where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    raise exception 'Solo Jurisdicción puede traer el reparto de influenza' using errcode = '42501';
  end if;

  select r.estado into v_estado from requi_requisiciones r where r.id = p_requisicion for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if v_estado <> 'BORRADOR' then
    raise exception 'La requisición está cerrada; no se puede traer el reparto';
  end if;

  select r.asignacion into v_asig from influenza_remesas r
   where r.anio_campana = p_campana and r.numero_entrega = p_numero;
  if not found then
    raise exception 'La Jurisdicción todavía no registra la entrega % de la campaña %', p_numero, p_campana;
  end if;

  select b.id into v_bio from requi_catalogo_biologicos b where b.codigo_articulo = '6317' and b.activo;
  if v_bio is null then raise exception 'No se encontró la vacuna de influenza en el catálogo de Requisiciones'; end if;

  if exists (select 1 from requi_requisiciones r
              where r.id <> p_requisicion and r.influenza_campana = p_campana and r.influenza_entrega = p_numero) then
    raise exception 'La entrega % del reparto ya está vinculada a otra requisición', p_numero;
  end if;

  -- No se pisan lotes reales: si ya se asignaron, el reparto se corrige directo en Requisiciones.
  if exists (select 1 from requi_items_jurisdiccion i join requi_lotes l on l.id = i.lote_id
              where i.requisicion_id = p_requisicion and i.requi_biologico_id = v_bio
                and l.numero_lote <> 'POR DEFINIR' and i.cantidad_surtida > 0) then
    raise exception 'La influenza de esta requisición ya tiene lotes asignados; no se reemplaza su reparto';
  end if;

  insert into requi_lotes (requi_biologico_id, numero_lote) values (v_bio, 'POR DEFINIR')
    on conflict (requi_biologico_id, numero_lote) do nothing;
  select l.id into v_lote from requi_lotes l where l.requi_biologico_id = v_bio and l.numero_lote = 'POR DEFINIR';

  -- Se reemplaza solo la influenza de esta requisición (de abajo hacia arriba por los triggers).
  delete from requi_distribucion_unidad   where requisicion_id = p_requisicion and requi_biologico_id = v_bio;
  delete from requi_distribucion_municipio where requisicion_id = p_requisicion and requi_biologico_id = v_bio;
  delete from requi_items_jurisdiccion    where requisicion_id = p_requisicion and requi_biologico_id = v_bio;

  select coalesce(sum(e.value::numeric), 0) into v_total
    from jsonb_each_text(v_asig) e where e.key = any (v_destinos) and e.value::numeric > 0;

  if v_total > 0 then
    insert into requi_items_jurisdiccion (requisicion_id, requi_biologico_id, lote_id, cantidad_surtida)
      values (p_requisicion, v_bio, v_lote, v_total);

    insert into requi_distribucion_municipio (requisicion_id, municipio, requi_biologico_id, lote_id, cantidad)
      select p_requisicion, e.key, v_bio, v_lote, e.value::numeric
        from jsonb_each_text(v_asig) e where e.key = any (v_destinos) and e.value::numeric > 0;
    get diagnostics v_n_muni = row_count;

    insert into requi_distribucion_unidad (requisicion_id, unidad_id, requi_biologico_id, lote_id, cantidad)
      select p_requisicion, u.id, v_bio, v_lote, sum(f.cantidad_frascos)
        from influenza_distribucion_frascos f
        join requi_unidades u on u.clues = f.clues and u.activo
       where f.anio_campana = p_campana and f.numero_entrega = p_numero and f.cantidad_frascos > 0
       group by u.id;
    get diagnostics v_n_uni = row_count;
  else
    v_n_muni := 0; v_n_uni := 0;
  end if;

  -- Lo que no se pudo bajar a unidad: CLUES sin unidad en Requisiciones y municipios sin reparto interno.
  select coalesce(array_agg(distinct f.clues), '{}') into v_sin_unidad
    from influenza_distribucion_frascos f
   where f.anio_campana = p_campana and f.numero_entrega = p_numero and f.cantidad_frascos > 0
     and not exists (select 1 from requi_unidades u where u.clues = f.clues and u.activo);

  select coalesce(array_agg(e.key order by e.key), '{}') into v_muni_sin
    from jsonb_each_text(v_asig) e
   where e.key = any (v_destinos) and e.value::numeric > 0
     and not exists (select 1 from requi_distribucion_unidad du join requi_unidades u on u.id = du.unidad_id
                      where du.requisicion_id = p_requisicion and du.requi_biologico_id = v_bio and u.municipio = e.key);

  update requi_requisiciones set influenza_campana = p_campana, influenza_entrega = p_numero
   where id = p_requisicion;

  return jsonb_build_object(
    'frascos', v_total, 'destinos', v_n_muni, 'unidades', v_n_uni,
    'clues_sin_unidad', to_jsonb(v_sin_unidad), 'destinos_sin_reparto_a_unidades', to_jsonb(v_muni_sin));
end;
$$;

revoke all on function public.requi_traer_reparto_influenza(uuid, text, integer) from public, anon;
grant execute on function public.requi_traer_reparto_influenza(uuid, text, integer) to authenticated;

-- Lotes reales (los de Requisiciones) por unidad y entrega del reparto. 'POR DEFINIR' = aún sin lote.
create or replace function public.influenza_lotes_entregas(p_campana text)
returns table (numero_entrega integer, clues text, lote text, caducidad date, cantidad numeric)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select upper(p.rol) rol, upper(p.municipio) muni,
           coalesce((select array_agg(upper(trim(x))) from unnest(p.municipios_allowed) x), '{}') permitidos
      from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI')
  select r.influenza_entrega, u.clues, l.numero_lote, l.caducidad, du.cantidad
    from yo
    join requi_requisiciones r on r.influenza_campana = p_campana and r.influenza_entrega is not null
    join requi_distribucion_unidad du on du.requisicion_id = r.id and du.cantidad > 0
    join requi_catalogo_biologicos b on b.id = du.requi_biologico_id and b.codigo_articulo = '6317'
    join requi_lotes l on l.id = du.lote_id
    join requi_unidades u on u.id = du.unidad_id
   where yo.rol in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
      or (yo.rol = 'MUNICIPAL' and (upper(u.municipio) = yo.muni or upper(u.municipio) = any (yo.permitidos) or '*' = any (yo.permitidos)))
      or (yo.rol not in ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'MUNICIPAL')
          and u.clues = (select p.clues from perfiles p where p.id = (select auth.uid())));
$$;

revoke all on function public.influenza_lotes_entregas(text) from public, anon;
grant execute on function public.influenza_lotes_entregas(text) to authenticated;
