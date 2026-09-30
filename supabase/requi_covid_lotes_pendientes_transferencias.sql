-- ============================================================================
-- Requisiciones -- 3 mejoras:
--   1) Claves COVID-19 Moderna (6502) y Pfizer (6506) en el catálogo.
--   2) Asignar lotes DESPUÉS de capturar cantidades: un lote "POR DEFINIR" por
--      biológico sirve de marcador; requi_asignar_lotes lo reemplaza por 1 o
--      más lotes reales y reacomoda el reparto ya hecho (pasos 2 y 3).
--   3) Repositorio "Transferencias" (PDF mensuales) visible solo para
--      ADMIN y JURISDICCIONAL.
-- ============================================================================

-- 1) COVID ------------------------------------------------------------------
insert into requi_catalogo_biologicos
  (clave_articulo, codigo_articulo, nombre, presentacion, forma, orden)
values
  ('25311.020-000-6502-00', '6502', 'VACUNA COVID-19 MODERNA', 'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)', 21),
  ('25311.020-000-6506-00', '6506', 'VACUNA COVID-19 PFIZER',  'MULTIDOSIS', 'Susp. Inyectable (Fco. Ampula)', 22)
on conflict (clave_articulo) do nothing;

-- 2) Lotes por definir --------------------------------------------------------
-- Reglas: `p_lotes` = [{numero_lote, caducidad?, cantidad}, ...] para el ítem
-- "POR DEFINIR" indicado. El reparto ya hecho de ese ítem se pasa a los lotes
-- nuevos llenando en orden (primer lote hasta agotarlo, luego el siguiente);
-- lo que no alcance a cubrirse se queda en "POR DEFINIR" (nunca se pierde).
-- Corre con los permisos de quien llama (RLS: solo ADMIN/JURISDICCIONAL).
create or replace function requi_asignar_lotes(p_item_id uuid, p_lotes jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  c_pend constant text := 'POR DEFINIR';
  c_orden constant text[] := array['CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO','NHG','HENM'];
  v_item requi_items_jurisdiccion%rowtype;
  v_n int;
  v_i int;
  v_e jsonb;
  v_num text;
  v_cad date;
  v_cant numeric;
  v_lote_id uuid;
  v_cad_actual date;
  v_ids uuid[] := '{}';
  v_resto numeric[] := '{}';
  v_total numeric := 0;
  dm record;
  du record;
  v_need numeric;
  v_need_u numeric;
  v_take numeric;
  v_mun_take numeric[];
  v_u_resto numeric[];
  v_quedan numeric;
begin
  select * into v_item from requi_items_jurisdiccion where id = p_item_id;
  if not found then raise exception 'No existe ese renglón de lo surtido.'; end if;
  if (select numero_lote from requi_lotes where id = v_item.lote_id) <> c_pend then
    raise exception 'Este renglón ya tiene lote asignado.';
  end if;

  v_n := jsonb_array_length(p_lotes);
  if v_n is null or v_n = 0 then raise exception 'Captura al menos un lote.'; end if;

  for v_e in select * from jsonb_array_elements(p_lotes) loop
    v_num := btrim(coalesce(v_e->>'numero_lote', ''));
    v_cant := coalesce((v_e->>'cantidad')::numeric, 0);
    v_cad := nullif(v_e->>'caducidad', '')::date;
    if v_num = '' or upper(v_num) = c_pend then raise exception 'Falta el número de lote.'; end if;
    if v_cant <= 0 then raise exception 'La cantidad del lote % debe ser mayor a 0.', v_num; end if;

    select id, caducidad into v_lote_id, v_cad_actual from requi_lotes
      where requi_biologico_id = v_item.requi_biologico_id and upper(numero_lote) = upper(v_num) limit 1;
    if v_lote_id is null then
      insert into requi_lotes (requi_biologico_id, numero_lote, caducidad)
        values (v_item.requi_biologico_id, v_num, v_cad) returning id into v_lote_id;
    elsif v_cad is not null and v_cad_actual is null then
      update requi_lotes set caducidad = v_cad where id = v_lote_id;
    end if;

    if v_lote_id = any (v_ids) then raise exception 'El lote % está repetido.', v_num; end if;
    if exists (select 1 from requi_items_jurisdiccion
               where requisicion_id = v_item.requisicion_id
                 and requi_biologico_id = v_item.requi_biologico_id and lote_id = v_lote_id) then
      raise exception 'El lote % ya está capturado en esta requisición; edita ese renglón en vez de asignarlo aquí.', v_num;
    end if;

    insert into requi_items_jurisdiccion (requisicion_id, requi_biologico_id, lote_id, cantidad_surtida)
      values (v_item.requisicion_id, v_item.requi_biologico_id, v_lote_id, v_cant);
    v_ids := v_ids || v_lote_id;
    v_resto := v_resto || v_cant;
    v_total := v_total + v_cant;
  end loop;

  -- Reparto a municipios/hospitales (y sus unidades), en el orden de la app.
  for dm in
    select * from requi_distribucion_municipio
    where requisicion_id = v_item.requisicion_id and requi_biologico_id = v_item.requi_biologico_id
      and lote_id = v_item.lote_id and cantidad > 0
    order by coalesce(array_position(c_orden, municipio), 99)
  loop
    v_need := dm.cantidad;
    v_mun_take := array_fill(0::numeric, array[v_n]);
    for v_i in 1..v_n loop
      exit when v_need <= 0;
      v_take := least(v_need, v_resto[v_i]);
      if v_take > 0 then
        insert into requi_distribucion_municipio (requisicion_id, municipio, requi_biologico_id, lote_id, cantidad)
          values (v_item.requisicion_id, dm.municipio, v_item.requi_biologico_id, v_ids[v_i], v_take);
        v_resto[v_i] := v_resto[v_i] - v_take;
        v_mun_take[v_i] := v_take;
        v_need := v_need - v_take;
      end if;
    end loop;

    v_u_resto := v_mun_take;
    for du in
      select d.* from requi_distribucion_unidad d join requi_unidades u on u.id = d.unidad_id
      where d.requisicion_id = v_item.requisicion_id and d.requi_biologico_id = v_item.requi_biologico_id
        and d.lote_id = v_item.lote_id and d.cantidad > 0 and u.municipio = dm.municipio
      order by u.clues nulls last, u.nombre
    loop
      v_need_u := du.cantidad;
      for v_i in 1..v_n loop
        exit when v_need_u <= 0;
        v_take := least(v_need_u, v_u_resto[v_i]);
        if v_take > 0 then
          insert into requi_distribucion_unidad (requisicion_id, unidad_id, requi_biologico_id, lote_id, cantidad)
            values (v_item.requisicion_id, du.unidad_id, v_item.requi_biologico_id, v_ids[v_i], v_take);
          v_u_resto[v_i] := v_u_resto[v_i] - v_take;
          v_need_u := v_need_u - v_take;
        end if;
      end loop;
      if v_need_u > 0 then update requi_distribucion_unidad set cantidad = v_need_u where id = du.id;
      else delete from requi_distribucion_unidad where id = du.id; end if;
    end loop;

    if v_need > 0 then update requi_distribucion_municipio set cantidad = v_need where id = dm.id;
    else delete from requi_distribucion_municipio where id = dm.id; end if;
  end loop;

  v_quedan := v_item.cantidad_surtida - v_total;
  if v_quedan > 0 then update requi_items_jurisdiccion set cantidad_surtida = v_quedan where id = v_item.id;
  else delete from requi_items_jurisdiccion where id = v_item.id; end if;

  return jsonb_build_object('quedan_pendientes', greatest(v_quedan, 0));
end;
$$;

grant execute on function requi_asignar_lotes(uuid, jsonb) to authenticated;

-- 3) Transferencias -----------------------------------------------------------
create table if not exists requi_transferencias (
  id uuid primary key default gen_random_uuid(),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  nombre_archivo text not null,          -- Transferencias_Septiembre_2026.pdf
  ruta text not null,                    -- clave en R2 (lleva un token no adivinable)
  public_url text not null,
  tamano_bytes bigint,
  subido_por text,
  subido_en timestamptz not null default now(),
  unique (anio, mes)
);

alter table requi_transferencias enable row level security;
drop policy if exists requi_transferencias_all on requi_transferencias;
create policy requi_transferencias_all on requi_transferencias for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());
