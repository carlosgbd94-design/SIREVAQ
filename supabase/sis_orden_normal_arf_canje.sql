-- Orden del concentrado: primero lotes NORMALES, luego A.R.F., al final CANJE
-- (antes ordenaba por texto: ARF < CANJE < NORMAL). Solo cambia el ORDER BY.
create or replace function public.biovac_concentrado_jurisdiccion(p_jurisdiccion_id uuid, p_anio integer, p_mes integer, p_incluir_borrador boolean default false)
 returns table(bloque_id uuid, pagina text, orden_bloque integer, biologico_id uuid, orden_en_bloque integer, nombre_excel text, clave text, regla_especial text, lote_id uuid, numero_lote text, caducidad date, categoria text, dosis_por_frasco_override numeric, existencia_anterior_frascos numeric, recibido_frascos numeric, aplicadas_a numeric, aplicadas_b numeric, desechadas_a numeric, desechadas_b numeric, existencia_final_frascos numeric, unidades_reportando integer, unidades_cerradas integer, es_provisional boolean)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque,
         cb.nombre_excel, cb.clave, cb.regla_especial, l.id, l.numero_lote, l.caducidad, r.categoria,
         l.dosis_por_frasco_override,
         sum(r.existencia_anterior_frascos), sum(r.recibido_frascos),
         sum(r.aplicadas_a), sum(r.aplicadas_b), sum(r.desechadas_a), sum(r.desechadas_b),
         sum(r.existencia_final_frascos),
         count(distinct m.unidad_id)::int as unidades_reportando,
         count(distinct m.unidad_id) filter (where m.estado = 'CERRADO')::int as unidades_cerradas,
         bool_or(case when u.clues like 'JS1-%' then m.estado <> 'CERRADO'
                      else coalesce(c.estado, '') <> 'VALIDADO' end) as es_provisional
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  join biovac_bloques_catalogo bl on bl.id = cb.bloque_id
  left join sis06p_capturas c on c.clues = u.clues and c.anio = m.anio and c.mes = m.mes
  where u.jurisdiccion_id = p_jurisdiccion_id
    and m.anio = p_anio and m.mes = p_mes
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and (p_incluir_borrador or m.estado = 'CERRADO')
    and not (m.estado <> 'CERRADO' and _sis06p_unidad_omitida(u.clues, p_anio, p_mes))
  group by cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque, cb.nombre_excel, cb.clave, cb.regla_especial,
           l.id, l.numero_lote, l.caducidad, r.categoria
  order by bl.pagina, bl.orden, cb.orden_en_bloque,
           case r.categoria when 'NORMAL' then 0 when 'ARF' then 1 else 2 end, l.numero_lote, l.id;
$function$;
