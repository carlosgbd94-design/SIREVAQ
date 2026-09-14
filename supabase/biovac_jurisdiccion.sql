-- ============================================================================
-- BioVac — Funciones de solo lectura para la vista jurisdiccional (Fase 4)
--
-- Requiere haber corrido biovac_schema.sql y biovac_engine.sql antes.
--
-- El concentrado jurisdiccional NUNCA se almacena aparte: siempre se agrega
-- en vivo con SUM/GROUP BY sobre los movimientos municipales (mismo patrón
-- que ya usa este repo en rpc_concentrado_aplicaciones.sql). Por default
-- solo suma movimientos ya CERRADOS (comportamiento original, el que sigue
-- usando "generar informe" y la exportación Excel/PDF jurisdiccional, que
-- deben ser un dato oficial/definitivo, nunca mezclado con lo que un
-- municipio todavía puede seguir editando). La pantalla EN VIVO
-- (biovac_jurisdiccion_ui.js) pide p_incluir_borrador=true para no
-- quedarse vacía mientras dura el mes -- cada renglón que dependa de al
-- menos una unidad aún no cerrada se marca es_provisional=true.
-- Solo "generar informe" (biovac_generar_informe_jurisdiccional, ya en
-- biovac_engine.sql) toma una foto fija para el PDF/Excel oficial.
--
-- dosis_por_frasco_override va en el resultado porque Movimiento de
-- Biológico (biovac_ui.js: cargarMovimientoJurisdiccional) reutiliza este
-- mismo RPC para pintar un "renglón jurisdiccional" con el mismo
-- renderizado de tabla que usa para un municipio real, y esa función lo
-- necesita para recalcular la existencia final igual que lo haría con un
-- renglón de verdad. l.id ya va en el GROUP BY (llave primaria de
-- biovac_lotes), así que Postgres acepta esta columna adicional sin
-- agregarla también ahí.
-- ============================================================================

-- 10. Concentrado en vivo: un renglón por (biológico, lote, categoría),
--     sumado a través de las unidades de la jurisdicción.
create or replace function biovac_concentrado_jurisdiccion(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_incluir_borrador boolean default false
)
returns table (
  bloque_id uuid, pagina text, orden_bloque int, biologico_id uuid, orden_en_bloque int,
  nombre_excel text, clave text, regla_especial text, lote_id uuid, numero_lote text, caducidad date, categoria text,
  dosis_por_frasco_override numeric,
  existencia_anterior_frascos numeric, recibido_frascos numeric,
  aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric, desechadas_b numeric,
  existencia_final_frascos numeric, unidades_reportando int, unidades_cerradas int, es_provisional boolean
)
language sql
stable
as $$
  select cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque,
         cb.nombre_excel, cb.clave, cb.regla_especial, l.id, l.numero_lote, l.caducidad, r.categoria,
         l.dosis_por_frasco_override,
         sum(r.existencia_anterior_frascos), sum(r.recibido_frascos),
         sum(r.aplicadas_a), sum(r.aplicadas_b), sum(r.desechadas_a), sum(r.desechadas_b),
         sum(r.existencia_final_frascos),
         count(distinct m.unidad_id)::int as unidades_reportando,
         count(distinct m.unidad_id) filter (where m.estado = 'CERRADO')::int as unidades_cerradas,
         count(distinct m.unidad_id) filter (where m.estado = 'CERRADO') < count(distinct m.unidad_id) as es_provisional
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  join biovac_bloques_catalogo bl on bl.id = cb.bloque_id
  where u.jurisdiccion_id = p_jurisdiccion_id
    and m.anio = p_anio and m.mes = p_mes
    and (p_incluir_borrador or m.estado = 'CERRADO')
  group by cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque, cb.nombre_excel, cb.clave, cb.regla_especial,
           l.id, l.numero_lote, l.caducidad, r.categoria
  order by bl.pagina, bl.orden, cb.orden_en_bloque, r.categoria, l.numero_lote;
$$;

-- 11. Detalle por unidad de un lote específico (para el drill-down de
--     corrección desde la vista jurisdiccional). Incluye unidades que no
--     reportaron ese lote (renglon_id null) para que se note la ausencia.
create or replace function biovac_detalle_lote_jurisdiccion(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_lote_id uuid, p_categoria text
)
returns table (
  unidad_id uuid, unidad_nombre text, movimiento_id uuid, movimiento_estado text,
  renglon_id uuid, existencia_anterior_frascos numeric, recibido_frascos numeric,
  aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric, desechadas_b numeric,
  existencia_final_frascos numeric, observaciones text
)
language sql
stable
as $$
  select u.id, u.nombre, m.id, m.estado,
         r.id, r.existencia_anterior_frascos, r.recibido_frascos,
         r.aplicadas_a, r.aplicadas_b, r.desechadas_a, r.desechadas_b,
         r.existencia_final_frascos, r.observaciones
  from biovac_unidades u
  left join biovac_movimientos m on m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes
  left join biovac_renglones r on r.movimiento_id = m.id and r.lote_id = p_lote_id and r.categoria = p_categoria
  where u.jurisdiccion_id = p_jurisdiccion_id and u.activo
  order by u.nombre;
$$;

-- ---------------------------------------------------------------------------
-- 12. Guardar un campo desde el drill-down de corrección jurisdiccional, con
--     auditoría POR CAMPO (a diferencia del marcador de apertura de
--     biovac_abrir_correccion, que es solo el batch) -- así la alerta
--     municipal puede decir exactamente qué biológico/lote/campo cambió, no
--     solo "este mes se corrigió". Reusa el motivo con el que se abrió la
--     corrección (capturado en la fila "marcador" del mismo
--     cascade_batch_id) para no pedir un motivo aparte por cada celda.
-- ---------------------------------------------------------------------------

create or replace function biovac_guardar_campo_correccion_jurisdiccional(
  p_renglon_id uuid,
  p_campo text,
  p_valor text,
  p_usuario text,
  p_rol text,
  p_cascade_batch_id uuid
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento_id uuid;
  v_estado text;
  v_valor_anterior text;
  v_valor_nuevo text;
  v_final numeric;
  v_motivo_batch text;
  v_campos_numericos text[] := array['recibido_frascos','aplicadas_a','aplicadas_b','desechadas_a','desechadas_b'];
begin
  if p_campo <> 'observaciones' and not (p_campo = any(v_campos_numericos)) then
    raise exception 'Campo % no editable desde corrección jurisdiccional', p_campo;
  end if;

  select r.movimiento_id into v_movimiento_id from biovac_renglones r where r.id = p_renglon_id for update;
  if v_movimiento_id is null then
    raise exception 'Renglón % no existe', p_renglon_id;
  end if;

  select estado into v_estado from biovac_movimientos where id = v_movimiento_id;
  if v_estado <> 'EN_CORRECCION' then
    raise exception 'El mes debe estar en corrección para editar (estado actual: %)', v_estado;
  end if;

  execute format('select %I::text from biovac_renglones where id = $1', p_campo) into v_valor_anterior using p_renglon_id;

  if p_campo = 'observaciones' then
    execute format('update biovac_renglones set %I = $1 where id = $2', p_campo)
      using nullif(trim(p_valor), ''), p_renglon_id;
    v_valor_nuevo := nullif(trim(p_valor), '');
  else
    execute format('update biovac_renglones set %I = $1 where id = $2', p_campo)
      using coalesce(p_valor::numeric, 0), p_renglon_id;
    v_valor_nuevo := coalesce(p_valor::numeric, 0)::text;
  end if;

  select existencia_final_frascos into v_final from biovac_renglones where id = p_renglon_id;

  if (p_campo <> 'observaciones' and coalesce(v_valor_anterior, '0') is distinct from v_valor_nuevo)
     or (p_campo = 'observaciones' and coalesce(v_valor_anterior, '') is distinct from coalesce(v_valor_nuevo, '')) then

    select motivo into v_motivo_batch
    from biovac_correcciones
    where cascade_batch_id = p_cascade_batch_id and campo is null
    order by creado_en asc limit 1;

    insert into biovac_correcciones
      (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo, cascade_batch_id, reconocido_por_municipal)
    values
      (v_movimiento_id, p_renglon_id, p_usuario, p_rol, p_campo, v_valor_anterior, v_valor_nuevo,
       coalesce(v_motivo_batch, 'Corrección jurisdiccional'), 'CORRECCION_JURISDICCIONAL', p_cascade_batch_id, false);
  end if;

  return v_final;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Correcciones jurisdiccionales pendientes de reconocer por una unidad
--     (municipio) -- excluye la fila "marcador" de apertura del batch
--     (campo is null), solo cambios de campo reales.
-- ---------------------------------------------------------------------------

create or replace function biovac_correcciones_pendientes(p_unidad_id uuid)
returns table (
  correccion_id uuid, movimiento_id uuid, anio int, mes int,
  biologico text, numero_lote text, categoria text,
  campo text, valor_anterior text, valor_nuevo text,
  usuario text, motivo text, creado_en timestamptz
)
language sql
stable
as $$
  select c.id, m.id, m.anio, m.mes,
         cb.nombre_excel, l.numero_lote, r.categoria,
         c.campo, c.valor_anterior, c.valor_nuevo,
         c.usuario, c.motivo, c.creado_en
  from biovac_correcciones c
  join biovac_movimientos m on m.id = c.movimiento_id
  left join biovac_renglones r on r.id = c.renglon_id
  left join biovac_lotes l on l.id = r.lote_id
  left join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where m.unidad_id = p_unidad_id
    and c.tipo = 'CORRECCION_JURISDICCIONAL'
    and c.reconocido_por_municipal = false
    and c.campo is not null
  order by c.creado_en desc;
$$;

-- ---------------------------------------------------------------------------
-- 14. Reconocer una o todas las correcciones jurisdiccionales pendientes de
--     un movimiento -- acción deliberada (no un simple "visto"): queda
--     registrado quién y cuándo se enteró.
-- ---------------------------------------------------------------------------

create or replace function biovac_reconocer_correccion(p_correccion_id uuid, p_usuario text)
returns void
language sql
security definer
set search_path = public
as $$
  update biovac_correcciones
  set reconocido_por_municipal = true, reconocido_en = now(), reconocido_por = p_usuario
  where id = p_correccion_id and tipo = 'CORRECCION_JURISDICCIONAL';
$$;

create or replace function biovac_reconocer_correcciones_movimiento(p_movimiento_id uuid, p_usuario text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  update biovac_correcciones
  set reconocido_por_municipal = true, reconocido_en = now(), reconocido_por = p_usuario
  where movimiento_id = p_movimiento_id and tipo = 'CORRECCION_JURISDICCIONAL'
    and reconocido_por_municipal = false and campo is not null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Última edición jurisdiccional por renglón, dentro de un movimiento --
--     registro permanente de "quién tocó esto por última vez desde
--     jurisdicción" (independiente de si ya se reconoció la alerta:
--     reconocer solo dice "ya lo vi", no debe borrar el rastro de quién
--     editó). La UI municipal lo pinta como etiqueta "Editado por <usuario>"
--     directo en la fila del lote, para que la edición jurisdiccional --
--     que es la más reciente -- quede visible ahí mismo.
-- ---------------------------------------------------------------------------

create or replace function biovac_ultimas_ediciones_jurisdiccionales(p_movimiento_id uuid)
returns table (renglon_id uuid, usuario text, rol text, creado_en timestamptz)
language sql
stable
as $$
  select distinct on (c.renglon_id) c.renglon_id, c.usuario, c.rol, c.creado_en
  from biovac_correcciones c
  where c.movimiento_id = p_movimiento_id
    and c.tipo = 'CORRECCION_JURISDICCIONAL'
    and c.campo is not null
    and c.renglon_id is not null
  order by c.renglon_id, c.creado_en desc;
$$;
