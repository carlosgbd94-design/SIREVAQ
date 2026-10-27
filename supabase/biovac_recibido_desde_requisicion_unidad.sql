-- ============================================================================
-- El «recibido» de la UNIDAD sale solo de Requisiciones
--
-- Desde octubre 2026 la requisición reparte a cada unidad (requi_distribucion_unidad) y eso es todo lo que recibió.
-- Antes la carga la hacía el navegador al abrir el Movimiento (si la unidad no entraba, no se cargaba; y los biológicos
-- sin equivalente en BioVac, como COVID-19, se descartaban) y la unidad podía teclear cualquier cantidad recibida.
--
--  1) biovac_sincronizar_recibido_unidad(clues, anio, mes): deja el recibido NORMAL de la unidad IGUAL al de las requisiciones
--     del mes (todas las entregas sumadas, lote real, nunca «POR DEFINIR»). Idempotente. Lo que la unidad tenga como recibido
--     sin respaldo en Requisiciones se pone en 0. No toca existencia anterior, aplicadas ni desechadas, ni meses cerrados.
--  2) Trigger: la UNIDAD ya no puede escribir ni cambiar el recibido NORMAL por la API (las funciones sí, vía /rpc/).
-- ============================================================================

create or replace function public.biovac_sincronizar_recibido_unidad(p_clues text, p_anio int, p_mes int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype; v_rol text;
  v_unidad biovac_unidades%rowtype; v_requ uuid;
  v_inicio date;
  v_mov uuid; v_estado text;
  v_cargados int := 0; v_ceros int := 0; v_lotes int := 0;
  r record; v_lote uuid; v_n int;
  v_bl text := coalesce(current_setting('biovac.bypass_lock', true), 'off');
  v_bv text := coalesce(current_setting('biovac.bypass_validaciones', true), 'off');
begin
  -- Quién llama: servicio/SQL (sin sesión) o un perfil con alcance sobre la unidad
  if (select auth.uid()) is not null then
    select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
    if not found then raise exception 'Sesión no válida.'; end if;
    v_rol := upper(v_perfil.rol);
    if v_rol = 'UNIDAD' and v_perfil.clues is distinct from p_clues then raise exception 'Solo puedes sincronizar tu propia unidad.'; end if;
    if v_rol = 'MUNICIPAL' and not exists (select 1 from biovac_unidades bu where bu.clues = p_clues and _sis_municipal_alcanza(v_perfil, bu.municipio)) then
      raise exception 'Fuera de tu alcance de municipios.';
    end if;
    if v_rol not in ('UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then raise exception 'Rol % no puede sincronizar el recibido.', v_rol; end if;
  end if;

  select * into v_unidad from biovac_unidades where clues = p_clues and activo;
  if not found or p_clues like 'JS1-%' or v_unidad.municipio in ('NHG', 'HENM') then return jsonb_build_object('omitido', 'unidad no aplica'); end if;
  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if make_date(p_anio, p_mes, 1) < coalesce(v_inicio, date '2026-10-01') then return jsonb_build_object('omitido', 'mes de prueba'); end if;
  select id into v_requ from requi_unidades where clues = p_clues limit 1;
  if v_requ is null then return jsonb_build_object('omitido', 'sin unidad en Requisiciones'); end if;

  select id, estado into v_mov, v_estado from biovac_movimientos where unidad_id = v_unidad.id and anio = p_anio and mes = p_mes for update;
  if v_mov is not null and v_estado <> 'BORRADOR' then return jsonb_build_object('omitido', 'movimiento ' || v_estado); end if;
  if _sis06p_mes_bloqueado(p_clues, p_anio, p_mes) then return jsonb_build_object('omitido', 'SIS enviado'); end if;

  perform set_config('biovac.bypass_lock', 'on', true);
  perform set_config('biovac.bypass_validaciones', 'on', true);

  create temp table if not exists _recib_req (bid uuid, lote text, cad date, q numeric) on commit drop;
  truncate _recib_req;
  insert into _recib_req
    select cb.biovac_biologico_id, upper(btrim(lo.numero_lote)), min(lo.caducidad), sum(d.cantidad)
    from requi_requisiciones rq
    join requi_distribucion_unidad d on d.requisicion_id = rq.id and d.unidad_id = v_requ and d.cantidad > 0
    join requi_catalogo_biologicos cb on cb.id = d.requi_biologico_id and cb.biovac_biologico_id is not null
    join requi_lotes lo on lo.id = d.lote_id and btrim(lo.numero_lote) <> '' and upper(btrim(lo.numero_lote)) <> 'POR DEFINIR'
    where rq.anio = p_anio and rq.mes = p_mes
    group by cb.biovac_biologico_id, upper(btrim(lo.numero_lote));

  if v_mov is null and exists (select 1 from _recib_req) then
    insert into biovac_movimientos (unidad_id, anio, mes, fecha_corte)
    values (v_unidad.id, p_anio, p_mes, (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date)
    returning id into v_mov;
  end if;
  if v_mov is null then
    perform set_config('biovac.bypass_lock', v_bl, true); perform set_config('biovac.bypass_validaciones', v_bv, true);
    return jsonb_build_object('cargados', 0, 'nota', 'La unidad no tiene reparto en Requisiciones este mes.');
  end if;

  for r in select * from _recib_req loop
    select id into v_lote from biovac_lotes where biologico_id = r.bid and upper(btrim(numero_lote)) = r.lote limit 1;
    if v_lote is null then
      insert into biovac_lotes (biologico_id, numero_lote, caducidad) values (r.bid, r.lote, r.cad) returning id into v_lote;
      v_lotes := v_lotes + 1;
    end if;
    insert into biovac_renglones (movimiento_id, lote_id, categoria, recibido_frascos, observaciones)
    values (v_mov, v_lote, 'NORMAL', r.q, format('Cargado desde Requisiciones (%s frasco(s))', trim_scale(r.q)))
    on conflict (movimiento_id, lote_id, categoria) do update
      set recibido_frascos = excluded.recibido_frascos, observaciones = excluded.observaciones
      where biovac_renglones.recibido_frascos is distinct from excluded.recibido_frascos;
    get diagnostics v_n = row_count;
    v_cargados := v_cargados + v_n;
  end loop;

  -- Recibido NORMAL sin respaldo en Requisiciones: se pone en 0 (la unidad no recibe por su cuenta)
  update biovac_renglones rn set recibido_frascos = 0,
         observaciones = case when coalesce(btrim(rn.observaciones), '') = '' then 'Recibido sin respaldo en Requisiciones (se puso en 0)' else rn.observaciones end
  where rn.movimiento_id = v_mov and rn.categoria = 'NORMAL' and rn.recibido_frascos <> 0
    and not exists (select 1 from biovac_lotes l join _recib_req q on q.bid = l.biologico_id and q.lote = upper(btrim(l.numero_lote)) where l.id = rn.lote_id);
  get diagnostics v_ceros = row_count;

  perform set_config('biovac.bypass_lock', v_bl, true);
  perform set_config('biovac.bypass_validaciones', v_bv, true);
  return jsonb_build_object('movimiento_id', v_mov, 'renglones_actualizados', v_cargados, 'lotes_nuevos', v_lotes, 'recibido_sin_respaldo_en_cero', v_ceros);
end;
$$;
revoke all on function public.biovac_sincronizar_recibido_unidad(text, int, int) from public, anon;
grant execute on function public.biovac_sincronizar_recibido_unidad(text, int, int) to authenticated;

create or replace function public.biovac_trg_recibido_requisicion() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_clues text; v_muni text; v_anio int; v_mes int; v_inicio date;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then return new; end if;
  if coalesce(current_setting('request.path', true), '') like '%/rpc/%' then return new; end if;   -- funciones del sistema (dictamen, reclasificar, sincronizar)
  if new.categoria is distinct from 'NORMAL' then return new; end if;
  if tg_op = 'UPDATE' and new.recibido_frascos is not distinct from old.recibido_frascos then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.recibido_frascos, 0) = 0 then return new; end if;
  if _sis_rol_actual() is distinct from 'UNIDAD' then return new; end if;
  select bu.clues, bu.municipio, m.anio, m.mes into v_clues, v_muni, v_anio, v_mes
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id where m.id = new.movimiento_id;
  if v_clues is null or v_clues like 'JS1-%' or v_muni in ('NHG', 'HENM') then return new; end if;
  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if make_date(v_anio, v_mes, 1) < coalesce(v_inicio, date '2026-10-01') then return new; end if;
  raise exception 'El recibido de la unidad viene de Requisiciones: no se captura ni se cambia aquí. Si algo no coincide con lo que llegó, avisa al municipal.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_biovac_recibido_requisicion on biovac_renglones;
create trigger trg_biovac_recibido_requisicion before insert or update of recibido_frascos on biovac_renglones
for each row execute function public.biovac_trg_recibido_requisicion();
