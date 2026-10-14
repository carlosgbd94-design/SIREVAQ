-- PostgREST corta cada respuesta en 1000 filas (max_rows). Estas dos funciones devuelven una fila por
-- unidad x grupo / entrega x unidad x lote y rebasan ese tope en la temporada; el cliente las pide por
-- bloques (.range) y para que los bloques no se traslapen ni salten filas el orden debe ser TOTAL.
-- Solo se agrega ORDER BY con desempate: mismos datos, mismo cuerpo.

create or replace function public.influenza_lotes_entregas(p_campana text)
 returns table(numero_entrega integer, clues text, lote text, caducidad date, cantidad numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
          and u.clues = (select p.clues from perfiles p where p.id = (select auth.uid())))
   order by r.influenza_entrega, u.clues, l.numero_lote, l.caducidad, du.id;
$function$;

create or replace function public.sis06p_comparativo(p_mes integer, p_anio integer, p_clues text default null::text)
 returns table(clues text, unidad text, municipio text, grupo text, etiqueta text, claves text[], paloteo numeric, aplicado numeric, coincide boolean, ajuste_paloteo numeric, ajuste_aplicado numeric)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_rol text;
  v_clues text;
  v_municipios text[];
begin
  select upper(p.rol), p.clues, p.municipios_allowed into v_rol, v_clues, v_municipios
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null then
    raise exception 'Perfil no encontrado o inactivo.';
  end if;

  return query
  select bu.clues, bu.nombre, bu.municipio, c.grupo, c.etiqueta, c.claves, c.paloteo, c.aplicado, (c.paloteo = c.aplicado),
         c.ajuste_paloteo, c.ajuste_aplicado
  from biovac_unidades bu
  cross join lateral _sis06p_comparativo_calc(bu.clues, p_mes, p_anio) c
  where bu.activo = true
    and bu.clues not like 'JS1-%'
    and (p_clues is null or bu.clues = p_clues)
    and case v_rol
          when 'UNIDAD' then bu.clues = v_clues
          when 'MUNICIPAL' then bu.municipio = any(v_municipios)
          when 'JURISDICCIONAL' then true
          when 'VISUALIZADOR_JURISDICCIONAL' then true
          when 'ADMIN' then true
          else false
        end
    and (c.paloteo <> 0 or c.aplicado <> 0)
  order by bu.clues, c.etiqueta, c.grupo, c.claves;
end;
$function$;

-- Concentrado de la jurisdicción: orden TOTAL (desempate por lote) para poder pedirlo por bloques.
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
  order by bl.pagina, bl.orden, cb.orden_en_bloque, r.categoria, l.numero_lote, l.id;
$function$;
