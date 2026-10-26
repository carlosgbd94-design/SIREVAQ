-- Traer pedido de biológico: al volver a traerlo SOBRESCRIBE con lo que las unidades corrigieron.
-- Antes se saltaban los biológicos con lotes y no se retiraba lo que las unidades quitaron.

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
  v_tiene_lotes boolean;
  v_sin_cambio text[] := '{}';
  v_retirados text[] := '{}';
  v_previo date;
begin
  select upper(p.rol) into v_rol from perfiles p
   where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('ADMIN', 'JURISDICCIONAL') then
    raise exception 'Solo Jurisdicción puede traer el pedido de biológico' using errcode = '42501';
  end if;

  select r.estado, r.pedido_fecha into v_estado, v_previo from requi_requisiciones r where r.id = p_requisicion for update;
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
    select exists (select 1 from requi_items_jurisdiccion i join requi_lotes l on l.id = i.lote_id
                    where i.requisicion_id = p_requisicion and i.requi_biologico_id = v_bio.bio_id
                      and l.numero_lote <> 'POR DEFINIR' and i.cantidad_surtida > 0) into v_tiene_lotes;

    -- Sin cambios respecto al pedido actual de las unidades: no se toca (se conservan lotes y ajustes).
    if v_tiene_lotes and not exists (
         (select unidad_id, cantidad from _pedido_req where bio_id = v_bio.bio_id
          except select d.unidad_id, sum(d.cantidad) from requi_distribucion_unidad d
                  where d.requisicion_id = p_requisicion and d.requi_biologico_id = v_bio.bio_id group by d.unidad_id)
         union all
         (select d.unidad_id, sum(d.cantidad) from requi_distribucion_unidad d
           where d.requisicion_id = p_requisicion and d.requi_biologico_id = v_bio.bio_id group by d.unidad_id
          except select unidad_id, cantidad from _pedido_req where bio_id = v_bio.bio_id)) then
      v_sin_cambio := v_sin_cambio || v_bio.bio_nombre;
      continue;
    end if;
    if v_tiene_lotes then v_con_lotes := v_con_lotes || v_bio.bio_nombre; end if;

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

  -- Re-traer un pedido ya vinculado: lo que las unidades quitaron (ya no lo piden) se retira de la
  -- requisición, salvo que tenga lotes reales asignados (eso se corrige a mano en los pasos 2 y 3).
  if v_previo = p_fecha then
    for v_bio in
      select distinct cb.id bio_id, cb.nombre bio_nombre
        from requi_items_jurisdiccion i
        join requi_catalogo_biologicos cb on cb.id = i.requi_biologico_id
        join requi_pedido_equivalencias e on e.codigo_articulo = cb.codigo_articulo
       where i.requisicion_id = p_requisicion
         and not exists (select 1 from _pedido_req q where q.bio_id = cb.id)
    loop
      if exists (select 1 from requi_items_jurisdiccion i join requi_lotes l on l.id = i.lote_id
                  where i.requisicion_id = p_requisicion and i.requi_biologico_id = v_bio.bio_id
                    and l.numero_lote <> 'POR DEFINIR' and i.cantidad_surtida > 0) then
        v_con_lotes := v_con_lotes || v_bio.bio_nombre;
        continue;
      end if;
      delete from requi_distribucion_unidad    where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;
      delete from requi_distribucion_municipio where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;
      delete from requi_items_jurisdiccion     where requisicion_id = p_requisicion and requi_biologico_id = v_bio.bio_id;
      v_retirados := v_retirados || v_bio.bio_nombre;
    end loop;
  end if;

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
    'reemplazados_con_lotes', to_jsonb(v_con_lotes), 'sin_cambios', to_jsonb(v_sin_cambio), 'retirados', to_jsonb(v_retirados), 'omitidos_con_lotes', '[]'::jsonb, 'clues_sin_unidad', v_sin_unidad,
    'sin_equivalencia', v_sin_equiv, 'influenza_pedida', v_influenza);
end;
$$;

revoke all on function public.requi_traer_pedido_biologico(uuid, date) from public, anon;
grant execute on function public.requi_traer_pedido_biologico(uuid, date) to authenticated;
