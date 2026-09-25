-- =============================================================================
-- Jurisdicción: qué filas de biovac_unidades cuentan para cada periodo, para NO
-- duplicar nada cuando unidades y municipio capturan el mismo mes.
--
--  * Antes del arranque por unidad (octubre 2026): solo cuentan las filas
--    municipales/hospital "pseudo" (clues 'JS1-...'), que es lo que se capturaba
--    (las filas con CLUES real de esos meses son pruebas).
--  * Desde octubre 2026: cuentan las UNIDADES con CLUES real. El municipio
--    nunca se queda con vacuna, así que su fila 'JS1-...' ya no se captura: es
--    la suma de sus unidades. Excepción: un municipio/hospital que TODAVÍA no
--    tiene ninguna unidad con CLUES real activa conserva su fila 'JS1-...'
--    (así nunca se pierde en silencio del concentrado, p. ej. NHG mientras no
--    se dé de alta su CLUES).
-- Los hospitales HENM y NHG son "municipios" aparte (municipio 'HENM' / 'NHG'),
-- nunca parte de QUERETARO.
-- =============================================================================

create table if not exists sis_config (
  clave text primary key,
  valor text not null
);
alter table sis_config enable row level security;
drop policy if exists "RLS_sis_config_Read" on sis_config;
create policy "RLS_sis_config_Read" on sis_config for select to authenticated using (true);
insert into sis_config (clave, valor) values ('inicio_captura_por_unidad', '2026-10-01')
on conflict (clave) do nothing;

create or replace function biovac_cuenta_para_jurisdiccion(p_clues text, p_municipio text, p_anio int, p_mes int)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when make_date(p_anio, p_mes, 1) < (select valor::date from sis_config where clave = 'inicio_captura_por_unidad')
      then p_clues like 'JS1-%'
    else p_clues not like 'JS1-%'
         or not exists (
           select 1 from biovac_unidades r
           where r.municipio = p_municipio and r.clues not like 'JS1-%' and r.activo
         )
  end;
$$;

grant execute on function biovac_cuenta_para_jurisdiccion(text, text, int, int) to authenticated;

-- 1. Concentrado jurisdiccional
create or replace function biovac_concentrado_jurisdiccion(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_incluir_borrador boolean default false
) returns table (
  bloque_id uuid, pagina text, orden_bloque integer, biologico_id uuid, orden_en_bloque integer,
  nombre_excel text, clave text, regla_especial text, lote_id uuid, numero_lote text, caducidad date,
  categoria text, dosis_por_frasco_override numeric, existencia_anterior_frascos numeric,
  recibido_frascos numeric, aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric,
  desechadas_b numeric, existencia_final_frascos numeric, unidades_reportando integer,
  unidades_cerradas integer, es_provisional boolean
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
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and (p_incluir_borrador or m.estado = 'CERRADO')
  group by cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque, cb.nombre_excel, cb.clave, cb.regla_especial,
           l.id, l.numero_lote, l.caducidad, r.categoria
  order by bl.pagina, bl.orden, cb.orden_en_bloque, r.categoria, l.numero_lote;
$$;

-- 2. Detalle por lote (qué unidades aportan)
create or replace function biovac_detalle_lote_jurisdiccion(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_lote_id uuid, p_categoria text
) returns table (
  unidad_id uuid, unidad_nombre text, movimiento_id uuid, movimiento_estado text, renglon_id uuid,
  existencia_anterior_frascos numeric, recibido_frascos numeric, aplicadas_a numeric, aplicadas_b numeric,
  desechadas_a numeric, desechadas_b numeric, existencia_final_frascos numeric, observaciones text
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
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
  order by u.nombre;
$$;

-- 3. Informe jurisdiccional (snapshot)
create or replace function biovac_generar_informe_jurisdiccional(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_usuario text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_snapshot jsonb;
begin
  select jsonb_agg(row_to_json(t)) into v_snapshot
  from (
    select cb.nombre_excel as biologico, l.numero_lote, r.categoria,
           sum(r.existencia_anterior_frascos) as existencia_anterior_frascos,
           sum(r.recibido_frascos) as recibido_frascos,
           sum(r.aplicadas_a) as aplicadas_a, sum(r.aplicadas_b) as aplicadas_b,
           sum(r.desechadas_a) as desechadas_a, sum(r.desechadas_b) as desechadas_b,
           sum(r.existencia_final_frascos) as existencia_final_frascos
    from biovac_renglones r
    join biovac_movimientos m on m.id = r.movimiento_id
    join biovac_unidades u on u.id = m.unidad_id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
      and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
      and m.estado = 'CERRADO'
    group by cb.bloque_id, cb.orden_en_bloque, cb.nombre_excel, l.numero_lote, r.categoria
    order by cb.orden_en_bloque
  ) t;

  insert into biovac_informes_jurisdiccionales (jurisdiccion_id, anio, mes, generado_por, snapshot)
  values (p_jurisdiccion_id, p_anio, p_mes, p_usuario, coalesce(v_snapshot, '[]'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

-- 4. Validaciones del concentrado
create or replace function biovac_validar_concentrado(p_jurisdiccion_id uuid, p_anio int, p_mes int)
returns table (severidad text, codigo text, mensaje text, unidad text, biologico text, lote text)
language plpgsql
stable
as $$
begin
  return query
  select 'ADVERTENCIA', 'MOVIMIENTO_NO_CERRADO',
         'La unidad todavía no cierra el movimiento de este mes (o no existe)',
         u.nombre, null::text, null::text
  from biovac_unidades u
  where u.jurisdiccion_id = p_jurisdiccion_id and u.activo
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and not exists (
      select 1 from biovac_movimientos m
      where m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes and m.estado = 'CERRADO'
    );

  return query
  select 'ADVERTENCIA', 'CADUCIDAD_INCONSISTENTE',
         'El mismo lote tiene caducidades distintas entre municipios de la jurisdicción',
         string_agg(distinct u.nombre, ', '), cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
  group by cb.nombre_excel, l.numero_lote
  having count(distinct l.caducidad) > 1;

  return query
  select 'ERROR', 'EXISTENCIA_NEGATIVA',
         'Existencia final negativa en un renglón', u.nombre, cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and r.existencia_final_frascos < 0;

  return query
  select 'ADVERTENCIA', 'ARF_SIN_RESOLVER',
         'Lote en A.R.F./canje con existencia sin resolver desde hace 3+ meses', u.nombre, cb.nombre_excel, l.numero_lote
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and r.categoria in ('ARF', 'CANJE') and r.existencia_final_frascos > 0
    and exists (
      select 1 from biovac_renglones r2
      join biovac_movimientos m2 on m2.id = r2.movimiento_id
      where r2.lote_id = r.lote_id and r2.categoria = r.categoria
        and m2.unidad_id = m.unidad_id
        and (m2.anio * 12 + m2.mes) <= (p_anio * 12 + p_mes) - 3
        and (m2.anio * 12 + m2.mes) > (p_anio * 12 + p_mes) - 4
        and r2.existencia_final_frascos > 0
    );
end;
$$;
