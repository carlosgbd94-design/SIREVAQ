-- biovac_validar_concentrado devolvía 5 consultas encadenadas (RETURN QUERY) sin ORDER BY: PostgREST corta en
-- 1000 filas y, sin orden total, una petición por bloques (.range) podía repetir o saltar avisos.
-- Mismo contenido; ahora es UNA sola consulta (UNION ALL) con orden total: bloque, unidad, biológico, lote, mensaje.
create or replace function public.biovac_validar_concentrado(p_jurisdiccion_id uuid, p_anio integer, p_mes integer)
 returns table(severidad text, codigo text, mensaje text, unidad text, biologico text, lote text)
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
begin
  return query
  select v.severidad, v.codigo, v.mensaje, v.unidad, v.biologico, v.lote
  from (
    select 1 as blk, 'ADVERTENCIA'::text as severidad, 'MOVIMIENTO_NO_CERRADO'::text as codigo,
           'La unidad todavía no cierra el movimiento de este mes (o no existe)'::text as mensaje,
           u.nombre::text as unidad, null::text as biologico, null::text as lote
    from biovac_unidades u
    where u.jurisdiccion_id = p_jurisdiccion_id and u.activo
      and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
      and not exists (
        select 1 from biovac_movimientos m
        where m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes and m.estado = 'CERRADO'
      )
      and not _sis06p_unidad_omitida(u.clues, p_anio, p_mes)

    union all
    select 2, 'ADVERTENCIA', 'CADUCIDAD_INCONSISTENTE',
           'El mismo lote tiene caducidades distintas entre municipios de la jurisdicción',
           string_agg(distinct u.nombre, ', ')::text, cb.nombre_excel::text, l.numero_lote::text
    from biovac_renglones r
    join biovac_movimientos m on m.id = r.movimiento_id
    join biovac_unidades u on u.id = m.unidad_id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
      and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    group by cb.nombre_excel, l.numero_lote
    having count(distinct l.caducidad) > 1

    union all
    select 3, 'ERROR', 'EXISTENCIA_NEGATIVA',
           'Existencia final negativa en un renglón', u.nombre::text, cb.nombre_excel::text, l.numero_lote::text
    from biovac_renglones r
    join biovac_movimientos m on m.id = r.movimiento_id
    join biovac_unidades u on u.id = m.unidad_id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    where u.jurisdiccion_id = p_jurisdiccion_id and m.anio = p_anio and m.mes = p_mes
      and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
      and r.existencia_final_frascos < 0

    union all
    select 4, 'ADVERTENCIA', 'ARF_SIN_RESOLVER',
           'Lote en A.R.F./canje con existencia sin resolver desde hace 3+ meses', u.nombre::text, cb.nombre_excel::text, l.numero_lote::text
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
      )

    union all
    select 5, case d.severidad when 'ERROR' then 'ERROR' else 'ADVERTENCIA' end, 'MUNICIPIO_VS_UNIDADES'::text, d.mensaje,
           (select u2.nombre from biovac_unidades u2 where u2.municipio = mu.municipio and u2.clues like 'JS1-%' order by u2.clues limit 1)::text,
           d.biologico::text, d.numero_lote::text
    from (select distinct u.municipio from biovac_unidades u
          where u.jurisdiccion_id = p_jurisdiccion_id and u.activo and u.clues like 'JS1-%' and u.municipio not in ('NHG', 'HENM')
            and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
            and make_date(p_anio, p_mes, 1) >= coalesce((select valor::date from sis_config where clave = 'inicio_captura_por_unidad'), date '2026-10-01')) mu
    cross join lateral biovac_discrepancias_municipio(mu.municipio, p_mes, p_anio) d
    where d.tipo <> 'SOLO_MUNICIPIO'
  ) v
  order by v.blk, v.unidad, v.biologico, v.lote, v.codigo, v.mensaje;
end;
$function$;
