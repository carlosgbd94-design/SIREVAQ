-- =============================================================================
-- Pedido de biológico capturado por el MUNICIPIO a nombre de una unidad que no lo hizo.
--
-- Contexto: Jurisdicción "jala" el pedido desde la plataforma (requi_traer_pedido_biologico / exportación,
-- ambos por fecha_pedido_programada). Si una unidad no capturó, alguien tiene que hacerlo a mano. El
-- municipio ya puede hacerlo, pero NO debe contar como cumplimiento de la unidad.
--
-- Diseño: las filas se guardan en biologicos_pedido con tipo_pedido = 'MUNICIPAL'.
--  * Todo el cumplimiento (medallas, historial, resumen de captura, móvil) filtra tipo_pedido = 'MENSUAL',
--    así que 'MUNICIPAL' no cuenta en ningún lado, sin tocar esas consultas.
--  * Requisiciones y exportación leen por fecha (sin filtrar tipo), así que SÍ incluyen el pedido.
--  * Si la unidad captura después lo suyo, su guardado borra por (clues, fecha) y queda como MENSUAL (cuenta).
--  * Parámetros (promedio, mínimo, máximo, múltiplo) se toman de biologicos_params en el servidor.
-- Idempotente.
-- =============================================================================

create or replace function public._pedido_municipal_autorizar(p_clues text)
returns table (rol text, nombre text, municipio text, unidad text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_nombre text;
  v_allowed text[];
  v_muni text;
  v_unidad text;
  v_norm text;
begin
  select upper(p.rol), coalesce(p.nombre, p.usuario), p.municipios_allowed
    into v_rol, v_nombre, v_allowed
    from perfiles p
   where p.id = (select auth.uid()) and p.activo = 'SI';
  if v_rol is null or v_rol not in ('ADMIN', 'MUNICIPAL') then
    raise exception 'Solo el nivel municipal puede capturar el pedido de una unidad' using errcode = '42501';
  end if;

  select u.municipio, u.unidad into v_muni, v_unidad
    from unidades u
   where upper(u.clues) = upper(trim(p_clues)) and u.activo = 'SI'
   limit 1;
  if v_muni is null then raise exception 'La unidad % no existe o está inactiva', p_clues; end if;

  if v_rol = 'MUNICIPAL' then
    v_norm := translate(upper(v_muni), 'ÁÉÍÓÚÜ', 'AEIOUU');
    if not exists (
      select 1 from unnest(coalesce(v_allowed, '{}')) a
       where a = '*' or translate(upper(trim(a)), 'ÁÉÍÓÚÜ', 'AEIOUU') = v_norm
    ) then
      raise exception 'La unidad % no pertenece a tu municipio', p_clues using errcode = '42501';
    end if;
  end if;

  return query select v_rol, v_nombre, v_muni, v_unidad;
end;
$$;
revoke all on function public._pedido_municipal_autorizar(text) from public, anon, authenticated;

-- Formulario: parámetros de la unidad + lo que el municipio ya había capturado en esa fecha.
create or replace function public.pedido_municipal_formulario(p_clues text, p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a record;
  v_filas jsonb;
  v_unidad_captura boolean;
  v_municipal record;
  v_requi boolean;
begin
  select * into a from _pedido_municipal_autorizar(p_clues);

  -- ¿El pedido de esa fecha ya se trajo a una requisición? (los cambios no la actualizan solos)
  select exists (select 1 from requi_requisiciones r where r.pedido_fecha = p_fecha) into v_requi;

  select coalesce(jsonb_agg(jsonb_build_object(
           'biologico', bp.biologico,
           'min_dosis', bp.min_dosis,
           'max_dosis', bp.max_dosis,
           'promedio_frascos', bp.promedio_frascos,
           'multiplo', coalesce(bp.multiplo_pedido, 1),
           'existencia_actual_frascos', s.existencia_actual_frascos,
           'pedido_frascos', s.pedido_frascos
         ) order by bp.orden_biologico), '[]'::jsonb)
    into v_filas
    from biologicos_params bp
    left join biologicos_pedido s
      on upper(s.clues) = upper(bp.clues) and s.biologico = bp.biologico
     and s.fecha_pedido_programada = p_fecha and s.tipo_pedido = 'MUNICIPAL'
   where upper(bp.clues) = upper(trim(p_clues)) and bp.activo = 'SI';

  -- ¿La unidad ya hizo su propio pedido ese día? (en ese caso no se captura desde el municipio)
  select exists (select 1 from biologicos_pedido b
                  where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha
                    and coalesce(b.tipo_pedido, 'MENSUAL') <> 'MUNICIPAL')
    into v_unidad_captura;

  select max(b.timestamp) ts, max(b.editado_nombre) nombre, bool_and(coalesce(b.sin_pedido, false)) sin_pedido
    into v_municipal
    from biologicos_pedido b
   where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha and b.tipo_pedido = 'MUNICIPAL';

  return jsonb_build_object(
    'clues', upper(trim(p_clues)), 'unidad', a.unidad, 'municipio', a.municipio, 'fecha', p_fecha,
    'filas', v_filas,
    'unidad_ya_capturo', v_unidad_captura,
    'requisicion_vinculada', v_requi,
    'municipal_ts', v_municipal.ts,
    'municipal_nombre', v_municipal.nombre,
    'sin_pedido', coalesce(v_municipal.sin_pedido, false) and v_municipal.ts is not null);
end;
$$;

-- Guardado: p_items = [{biologico, existencia, pedido}, ...]. Reemplaza lo que el municipio había capturado.
create or replace function public.pedido_municipal_guardar(
  p_clues text, p_fecha date, p_items jsonb, p_sin_pedido boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_n integer;
  v_total numeric;
begin
  select * into a from _pedido_municipal_autorizar(p_clues);

  if p_fecha is null then raise exception 'Indica la fecha del pedido'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay renglones que guardar';
  end if;
  if exists (select 1 from pedidos_extraordinarios e where e.fecha_programada = p_fecha) then
    raise exception 'Esta fecha es de un pedido extraordinario; el pedido municipal es solo del pedido ordinario';
  end if;
  if exists (select 1 from biologicos_pedido b
              where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha
                and coalesce(b.tipo_pedido, 'MENSUAL') <> 'MUNICIPAL') then
    raise exception 'La unidad ya capturó su propio pedido de esta fecha; no se puede sustituir desde el municipio';
  end if;

  delete from biologicos_pedido b
   where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha and b.tipo_pedido = 'MUNICIPAL';

  insert into biologicos_pedido (id, "timestamp", fecha_captura, fecha_pedido_programada, municipio, clues, unidad, biologico,
                                 max_dosis, min_dosis, promedio_frascos, existencia_actual_frascos, pedido_frascos,
                                 tipo_pedido, sin_pedido, capturado_por, editado, editado_por, editado_nombre, editado_ts)
  select 'MUN:' || bp.clues || ':' || bp.biologico || ':' || p_fecha::text, now(), v_hoy, p_fecha, a.municipio, bp.clues, a.unidad, bp.biologico,
         bp.max_dosis, bp.min_dosis, bp.promedio_frascos,
         greatest(coalesce((i.value ->> 'existencia')::numeric, 0), 0),
         case when p_sin_pedido then 0 else greatest(coalesce((i.value ->> 'pedido')::numeric, 0), 0) end,
         'MUNICIPAL', coalesce(p_sin_pedido, false), upper(coalesce(a.nombre, 'MUNICIPAL')), 'SI', a.rol, upper(coalesce(a.nombre, '')), now()
    from jsonb_array_elements(p_items) i
    join biologicos_params bp
      on upper(bp.clues) = upper(trim(p_clues)) and bp.activo = 'SI' and bp.biologico = (i.value ->> 'biologico');

  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Ningún renglón corresponde a los biológicos de la unidad'; end if;

  select coalesce(sum(pedido_frascos), 0) into v_total
    from biologicos_pedido b
   where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha and b.tipo_pedido = 'MUNICIPAL';

  return jsonb_build_object('renglones', v_n, 'frascos', v_total);
end;
$$;

-- Quita lo capturado por el municipio (la unidad vuelve a quedar sin pedido).
create or replace function public.pedido_municipal_quitar(p_clues text, p_fecha date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  perform 1 from _pedido_municipal_autorizar(p_clues);
  delete from biologicos_pedido b
   where upper(b.clues) = upper(trim(p_clues)) and b.fecha_pedido_programada = p_fecha and b.tipo_pedido = 'MUNICIPAL';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.pedido_municipal_formulario(text, date) from public, anon;
revoke all on function public.pedido_municipal_guardar(text, date, jsonb, boolean) from public, anon;
revoke all on function public.pedido_municipal_quitar(text, date) from public, anon;
grant execute on function public.pedido_municipal_formulario(text, date) to authenticated;
grant execute on function public.pedido_municipal_guardar(text, date, jsonb, boolean) to authenticated;
grant execute on function public.pedido_municipal_quitar(text, date) to authenticated;
