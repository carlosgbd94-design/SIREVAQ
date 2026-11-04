-- =============================================================================
-- Avisos del concentrado municipal que no decían qué pasaba:
--  1) «Existencia negativa» (biovac_discrepancias_municipio): el mensaje solo daba el final (-9). Casi siempre la causa es que
--     las unidades declararon más existencia ANTERIOR de ese lote que la que el municipio trae del mes pasado (las unidades
--     aplicaron dosis que ya tenían). Ahora el aviso muestra la cuenta (anterior + recibido - aplicadas - desechadas), la
--     anterior de las unidades contra la del municipio y cuánto falta.
--  2) «Recibido contra requisición» (sis06p_recibido_vs_requisicion): ahora devuelve QUÉ unidades no cuadran (lo que la requisición
--     le asignó vs lo que capturó, detalle_unidades), y qué otros lotes del mismo biológico hay de cada lado (requisicion_otros_lotes / unidades_otros_lotes).
-- Solo cambia lo que se muestra; ningún cálculo ni regla.
-- =============================================================================

-- 1) Mensaje de existencia negativa ---------------------------------------------------------------------------------
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v like '%porque falta existencia anterior%' then return; end if;   -- ya parchada
  v := replace(v,
    $q$format('La existencia final del municipio queda en %s (negativa): se dieron de baja más frascos de los que hay.', trim_scale(round(t.mfin, 2)))$q$,
    $q$case when t.uant > t.mant then
             format('La existencia final del municipio queda en %s (negativa) porque falta existencia anterior: las unidades declararon %s de este lote del mes pasado y el municipio trae %s (faltan %s). Cuenta del municipio: anterior %s + recibido %s − aplicadas %s − desechadas %s. Si lo de las unidades es lo correcto, corrige la existencia anterior del municipio a %s.',
               trim_scale(round(t.mfin, 2)), trim_scale(round(t.uant, 2)), trim_scale(round(t.mant, 2)), trim_scale(round(t.uant - t.mant, 2)),
               trim_scale(round(t.mant, 2)), trim_scale(round(t.mrec, 2)), trim_scale(round(t.mapl, 2)), trim_scale(round(t.mdes, 2)), trim_scale(round(t.uant, 2)))
           else
             format('La existencia final del municipio queda en %s (negativa): anterior %s + recibido %s − aplicadas %s − desechadas %s. Se dieron de baja más frascos de los que hay: revisa lo aplicado o lo recibido de este lote.',
               trim_scale(round(t.mfin, 2)), trim_scale(round(t.mant, 2)), trim_scale(round(t.mrec, 2)), trim_scale(round(t.mapl, 2)), trim_scale(round(t.mdes, 2)))
           end$q$);
  if v not like '%porque falta existencia anterior%' then raise exception 'No se pudo parchear biovac_discrepancias_municipio'; end if;
  execute v;
end $$;

-- 2) Recibido contra requisición con detalle --------------------------------------------------------------------------
drop function if exists public.sis06p_recibido_vs_requisicion(integer, integer, text);

create or replace function public.sis06p_recibido_vs_requisicion(p_mes integer, p_anio integer, p_municipio text default null)
returns table (
  municipio text, biologico text, numero_lote text,
  caducidad_requisicion date, caducidad_unidades date,
  requisicion numeric, unidades numeric, coincide boolean,
  detalle_unidades jsonb, requisicion_otros_lotes jsonb, unidades_otros_lotes jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios text[];
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null or v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN','VISUALIZADOR_JURISDICCIONAL') then
    raise exception 'Rol % no puede ver la conciliación con la requisición.', coalesce(v_rol, 'desconocido');
  end if;

  return query
  with destinos as (
    -- municipios que reparten a unidades + hospitales (HENM, NHG: destino con una sola unidad)
    select ru.municipio as mun from requi_unidades ru
    union select 'HENM' union select 'NHG'
  ),
  req as (
    select dm.municipio as mun, cb.biovac_biologico_id as bid, min(cb.nombre) as bname,
           lo.numero_lote as lote, min(lo.caducidad) as cad, sum(dm.cantidad) as q
    from requi_requisiciones rq
    join requi_distribucion_municipio dm on dm.requisicion_id = rq.id
    join requi_catalogo_biologicos cb on cb.id = dm.requi_biologico_id
    join requi_lotes lo on lo.id = dm.lote_id
    where rq.anio = p_anio and rq.mes = p_mes
      and dm.cantidad <> 0
      and cb.biovac_biologico_id is not null
      and dm.municipio in (select mun from destinos)
    group by dm.municipio, cb.biovac_biologico_id, lo.numero_lote
  ),
  uni as (
    select bu.municipio as mun, l.biologico_id as bid, l.numero_lote as lote,
           min(l.caducidad) as cad, sum(r.recibido_frascos) as q
    from biovac_unidades bu
    join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
    join biovac_renglones r on r.movimiento_id = mv.id
    join biovac_lotes l on l.id = r.lote_id
    where bu.activo = true and bu.clues not like 'JS1-%'
      and bu.municipio in (select mun from destinos)
      and r.categoria = 'NORMAL' and coalesce(r.recibido_frascos, 0) <> 0
    group by bu.municipio, l.biologico_id, l.numero_lote
  ),
  -- lo que la requisición le asignó a CADA unidad contra lo que esa unidad capturó: solo las unidades que no cuadran
  requ as (
    select ru.clues, ru.nombre, ru.municipio as mun, cb.biovac_biologico_id as bid, lo.numero_lote as lote, sum(du.cantidad) as q
    from requi_requisiciones rq
    join requi_distribucion_unidad du on du.requisicion_id = rq.id
    join requi_unidades ru on ru.id = du.unidad_id
    join requi_catalogo_biologicos cb on cb.id = du.requi_biologico_id
    join requi_lotes lo on lo.id = du.lote_id
    where rq.anio = p_anio and rq.mes = p_mes and du.cantidad <> 0 and cb.biovac_biologico_id is not null
    group by ru.clues, ru.nombre, ru.municipio, cb.biovac_biologico_id, lo.numero_lote
  ),
  unid as (
    select bu.clues, bu.nombre, bu.municipio as mun, l.biologico_id as bid, l.numero_lote as lote, sum(r.recibido_frascos) as q
    from biovac_unidades bu
    join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
    join biovac_renglones r on r.movimiento_id = mv.id
    join biovac_lotes l on l.id = r.lote_id
    where bu.activo = true and bu.clues not like 'JS1-%'
      and r.categoria = 'NORMAL' and coalesce(r.recibido_frascos, 0) <> 0
    group by bu.clues, bu.nombre, bu.municipio, l.biologico_id, l.numero_lote
  ),
  dif as (
    select coalesce(a.mun, b.mun) as mun, coalesce(a.bid, b.bid) as bid, coalesce(a.lote, b.lote) as lote,
           jsonb_agg(jsonb_build_object('clues', coalesce(a.clues, b.clues), 'unidad', coalesce(a.nombre, b.nombre),
                                        'requisicion', coalesce(a.q, 0), 'recibido', coalesce(b.q, 0)) order by coalesce(a.clues, b.clues)) as det
    from requ a
    full join unid b on a.clues = b.clues and a.bid = b.bid and a.lote = b.lote
    where coalesce(a.q, 0) <> coalesce(b.q, 0)
    group by 1, 2, 3
  )
  select coalesce(req.mun, uni.mun),
         coalesce(req.bname, cbb.nombre_excel),
         coalesce(req.lote, uni.lote),
         req.cad, uni.cad,
         coalesce(req.q, 0), coalesce(uni.q, 0),
         (coalesce(req.q, 0) = coalesce(uni.q, 0) and (req.cad is null or uni.cad is null or req.cad = uni.cad)),
         (select d.det from dif d where d.mun = coalesce(req.mun, uni.mun) and d.bid = coalesce(req.bid, uni.bid) and d.lote = coalesce(req.lote, uni.lote)),
         (select jsonb_agg(jsonb_build_object('lote', r2.lote, 'cantidad', r2.q) order by r2.lote)
            from req r2 where r2.mun = coalesce(req.mun, uni.mun) and r2.bid = coalesce(req.bid, uni.bid)
              and r2.lote is distinct from coalesce(req.lote, uni.lote)),
         (select jsonb_agg(jsonb_build_object('lote', u2.lote, 'cantidad', u2.q) order by u2.lote)
            from uni u2 where u2.mun = coalesce(req.mun, uni.mun) and u2.bid = coalesce(req.bid, uni.bid)
              and u2.lote is distinct from coalesce(req.lote, uni.lote))
  from req
  full join uni on uni.mun = req.mun and uni.bid = req.bid and uni.lote = req.lote
  left join biovac_catalogo_biologicos cbb on cbb.id = uni.bid
  where (p_municipio is null or coalesce(req.mun, uni.mun) = p_municipio)
    and (v_rol <> 'MUNICIPAL' or coalesce(req.mun, uni.mun) = any(v_municipios))
  order by 1, 2, 3;
end;
$$;

revoke all on function public.sis06p_recibido_vs_requisicion(integer, integer, text) from public;
revoke all on function public.sis06p_recibido_vs_requisicion(integer, integer, text) from anon;
grant execute on function public.sis06p_recibido_vs_requisicion(integer, integer, text) to authenticated;

-- 3) «Cambio posterior de la unidad»: casi siempre es una unidad con el mes REABIERTO en corrección (no cuenta en la suma de
--    las unidades hasta que se cierre de nuevo, pero el municipio ya la traía). El aviso ahora dice cuáles unidades son.
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v like '%no se cuentan hasta que la cierren%' then return; end if;
  v := replace(v,
    E'Reabre el mes del municipio para actualizarlo.'',\n               trim_scale(round(t.urec, 2)), trim_scale(round(t.uapl, 2)), trim_scale(round(t.udes, 2)), trim_scale(round(t.brec, 2)), trim_scale(round(t.bapl, 2)), trim_scale(round(t.bdes, 2)))\n           when ''INCONSISTENCIA''',
    E'Reabre el mes del municipio para actualizarlo.%s'',\n               trim_scale(round(t.urec, 2)), trim_scale(round(t.uapl, 2)), trim_scale(round(t.udes, 2)), trim_scale(round(t.brec, 2)), trim_scale(round(t.bapl, 2)), trim_scale(round(t.bdes, 2)),\n               coalesce((select '' Causa probable: estas unidades tienen el mes abierto en corrección y no se cuentan hasta que la cierren de nuevo: '' || string_agg(bu.nombre, '', '' order by bu.nombre) || ''.''\n                           from biovac_unidades bu join biovac_movimientos um on um.unidad_id = bu.id and um.anio = p_anio and um.mes = p_mes\n                          where bu.municipio = p_municipio and bu.clues not like ''JS1-%'' and bu.activo and um.estado <> ''CERRADO''\n                            and not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes)), ''''))\n           when ''INCONSISTENCIA''');
  if v not like '%no se cuentan hasta que la cierren%' then raise exception 'No se pudo parchear el aviso de cambio posterior'; end if;
  execute v;
end $$;

-- 4) Existencia negativa: el aviso dice DÓNDE está (qué unidades tienen ese lote y cuánto traen/recibieron/aplicaron).
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v like '%Unidades con este lote:%' then return; end if;
  v := replace(v,
    E'end\n           when ''UNIDAD_CAMBIO_POSTERIOR'' then format(',
    E'end || coalesce((select '' Unidades con este lote: '' || string_agg(bu.nombre || '' (anterior '' || trim_scale(round(r.existencia_anterior_frascos, 2)) || '', recibió '' || trim_scale(round(r.recibido_frascos, 2)) || '', aplicó '' || trim_scale(round(r.aplicadas_a + r.aplicadas_b, 2)) || '')'', ''; '' order by bu.nombre) || ''.''\n                              from biovac_renglones r join biovac_movimientos um on um.id = r.movimiento_id join biovac_unidades bu on bu.id = um.unidad_id\n                             where r.lote_id = t.lid and r.categoria = t.cat and um.anio = p_anio and um.mes = p_mes and bu.municipio = p_municipio\n                               and bu.clues not like ''JS1-%'' and bu.activo\n                               and (r.existencia_anterior_frascos <> 0 or r.recibido_frascos <> 0 or r.aplicadas_a + r.aplicadas_b <> 0)), '''')\n           when ''UNIDAD_CAMBIO_POSTERIOR'' then format(');
  if v not like '%Unidades con este lote:%' then raise exception 'No se pudo parchear el detalle de existencia negativa'; end if;
  execute v;
end $$;

-- 5) «N correcciones sin aceptar» del seguimiento: cuenta CELDAS con un cambio real (primer valor ≠ último), no cada vez que el
--    municipal tecleó (4→5→4→5→4 son 4 filas pero ningún cambio).
do $$
declare v text;
begin
  v := pg_get_functiondef('public.sis06p_resumen_seguimiento(integer,integer)'::regprocedure);
  if v like '%group by sc.fila_excel, sc.subconteo, sc.detalle%' then return; end if;
  v := replace(v,
    E'select count(*)::int from sis06p_correcciones sc\n      where sc.captura_id = c.id and sc.tipo = ''EDICION_MUNICIPAL'' and sc.reconocido_por_unidad = false',
    E'select count(*)::int from (\n        select (array_agg(sc.valor_anterior order by sc.creado_en))[1] as va, (array_agg(sc.valor_nuevo order by sc.creado_en desc))[1] as vn\n        from sis06p_correcciones sc\n        where sc.captura_id = c.id and sc.tipo = ''EDICION_MUNICIPAL'' and sc.reconocido_por_unidad = false\n        group by sc.fila_excel, sc.subconteo, sc.detalle\n      ) g where g.va is distinct from g.vn');
  if v not like '%group by sc.fila_excel, sc.subconteo, sc.detalle%' then raise exception 'No se pudo parchear sis06p_resumen_seguimiento'; end if;
  execute v;
end $$;

-- 6) La existencia anterior del MUNICIPIO es la correcta (sale del cierre del mes pasado): si las unidades declararon de más, la
--    corrección es en la unidad. El aviso lo dice así y muestra con qué cerró cada unidad el mes pasado.
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v like '%la unidad que declaró de más%' then return; end if;
  v := replace(v,
    'Si lo de las unidades es lo correcto, corrige la existencia anterior del municipio a %s.',
    'La existencia anterior del municipio es la correcta (viene del cierre del mes pasado): la unidad que declaró de más debe corregir la suya (reábrela con «Reabrir y corregir» o pídeselo).');
  v := replace(v,
    $q$trim_scale(round(r.existencia_anterior_frascos, 2)) || ', recibió '$q$,
    $q$trim_scale(round(r.existencia_anterior_frascos, 2)) || ' y en el mes pasado cerró con ' || trim_scale(round(coalesce((select sum(pr.existencia_final_frascos) from biovac_renglones pr join biovac_movimientos pm on pm.id = pr.movimiento_id where pm.unidad_id = um.unidad_id and pr.lote_id = r.lote_id and pr.categoria = r.categoria and pm.anio * 12 + pm.mes = p_anio * 12 + p_mes - 1), 0), 2)) || ', recibió '$q$);
  v := replace(v, 'porque falta existencia anterior: las unidades declararon %s de este lote del mes pasado y el municipio trae %s (faltan %s).',
                  'porque las unidades declararon más existencia anterior de la que trae el municipio: declararon %s de este lote y el municipio trae %s (%s de más).');
  if v not like '%la unidad que declaró de más%' or v not like '%en el mes pasado cerró con%' then raise exception 'No se pudo parchear el aviso'; end if;
  execute v;
end $$;

-- 7) Existencia negativa / anterior distinta: mensaje corto + columna `detalle` (jsonb) con CADA unidad que tiene el lote: su
--    anterior, con qué cerró el mes pasado, lo recibido y lo aplicado, y si es posible causante (declaró más anterior de la que
--    cerró). La pantalla lo dibuja como tabla. Cambia el tipo de retorno: se recrea la función.
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v like '%detalle jsonb%' then return; end if;
  -- se quita la lista de unidades pegada al texto (ahora va en `detalle`)
  v := regexp_replace(v, 'end \|\| coalesce\(\(select '' Unidades con este lote:.*?\), ''''\)(\s+)when ''UNIDAD_CAMBIO_POSTERIOR''', E'end\1when ''UNIDAD_CAMBIO_POSTERIOR''', 's');
  v := replace(v,
    'La existencia final del municipio queda en %s (negativa) porque las unidades declararon más existencia anterior de la que trae el municipio: declararon %s de este lote y el municipio trae %s (%s de más). Cuenta del municipio: anterior %s + recibido %s − aplicadas %s − desechadas %s. La existencia anterior del municipio es la correcta (viene del cierre del mes pasado): la unidad que declaró de más debe corregir la suya (reábrela con «Reabrir y corregir» o pídeselo).',
    'Quedó en %s frascos: las unidades declararon %s de existencia anterior y el municipio trae %s (%s de más). El anterior del municipio es el correcto (viene del cierre del mes pasado): el error está en la unidad que declaró de más.');
  v := replace(v,
    'La existencia final del municipio queda en %s (negativa): anterior %s + recibido %s − aplicadas %s − desechadas %s. Se dieron de baja más frascos de los que hay: revisa lo aplicado o lo recibido de este lote.',
    'Quedó en %s frascos: se dieron de baja más de los que había. Revisa lo aplicado o lo recibido de este lote en las unidades de abajo.');
  v := replace(v, 'mensaje text)', 'mensaje text, detalle jsonb)');
  v := replace(v,
    E'         end\n  from t\n  join biovac_lotes l on l.id = t.lid',
    E'         end,\n         case when t.tp in (''FINAL_NEGATIVA'', ''ANTERIOR_DISTINTA'') then (\n           select jsonb_agg(jsonb_build_object(''unidad'', bu.nombre, ''clues'', bu.clues, ''anterior'', r.existencia_anterior_frascos, ''cierre_mes_pasado'', p.cp,\n                                               ''recibido'', r.recibido_frascos, ''aplicado'', r.aplicadas_a + r.aplicadas_b, ''sospechosa'', r.existencia_anterior_frascos > p.cp)\n                            order by (r.existencia_anterior_frascos > p.cp) desc, bu.nombre)\n             from biovac_renglones r\n             join biovac_movimientos um on um.id = r.movimiento_id\n             join biovac_unidades bu on bu.id = um.unidad_id\n             cross join lateral (select coalesce(sum(pr.existencia_final_frascos), 0) as cp from biovac_renglones pr join biovac_movimientos pm on pm.id = pr.movimiento_id\n                                  where pm.unidad_id = um.unidad_id and pr.lote_id = r.lote_id and pr.categoria = r.categoria and pm.anio * 12 + pm.mes = p_anio * 12 + p_mes - 1) p\n            where r.lote_id = t.lid and r.categoria = t.cat and um.anio = p_anio and um.mes = p_mes and bu.municipio = p_municipio\n              and bu.clues not like ''JS1-%'' and bu.activo\n              and (r.existencia_anterior_frascos <> 0 or r.recibido_frascos <> 0 or r.aplicadas_a + r.aplicadas_b <> 0))\n         end\n  from t\n  join biovac_lotes l on l.id = t.lid');
  if v not like '%detalle jsonb%' or v not like '%cierre_mes_pasado%' or v like '%Unidades con este lote:%' or v not like '%Quedó en %s frascos: las unidades declararon%' then raise exception 'No se pudo parchear el detalle'; end if;
  drop function public.biovac_discrepancias_municipio(text, integer, integer);
  execute v;
  revoke all on function public.biovac_discrepancias_municipio(text, integer, integer) from public;
  revoke all on function public.biovac_discrepancias_municipio(text, integer, integer) from anon;
  grant execute on function public.biovac_discrepancias_municipio(text, integer, integer) to authenticated;
end $$;

-- 8) «Existencia anterior distinta» es solo informativa (esperable el primer mes y con frascos multidosis: BCG, Hepatitis B, Td, DPT,
--    Influenza, COVID): NO lleva la tabla de «posible error». El detalle de unidades queda solo para la existencia negativa.
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_discrepancias_municipio(text,integer,integer)'::regprocedure);
  if v not like '%case when t.tp in (''FINAL_NEGATIVA'', ''ANTERIOR_DISTINTA'') then (%' then return; end if;
  v := replace(v, 'case when t.tp in (''FINAL_NEGATIVA'', ''ANTERIOR_DISTINTA'') then (', 'case when t.tp = ''FINAL_NEGATIVA'' then (');
  if v like '%''ANTERIOR_DISTINTA'') then (%' then raise exception 'No se pudo parchear'; end if;
  execute v;
end $$;
