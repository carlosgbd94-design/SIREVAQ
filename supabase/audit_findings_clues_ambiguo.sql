-- ============================================================================
-- Auditoría de integridad de datos (Administración > Auditoría): get_audit_findings fallaba con
--   «column reference "clues" is ambiguous»
-- porque la función devuelve una columna llamada `clues` y varias subconsultas la usan sin calificar
-- (SELECT clues FROM unidades ...). `#variable_conflict use_column` hace que, ante el choque con la columna de salida,
-- plpgsql entienda la columna de la tabla. La lógica de los checks no cambia.
-- ============================================================================

create or replace function public.get_audit_findings(p_anio integer default null::integer)
 returns table(categoria text, severidad text, clues text, descripcion text, detalle jsonb)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
    v_anio integer := coalesce(p_anio, extract(year from now())::int);
begin
    if not exists (
        select 1 from public.perfiles
        where id = auth.uid() and upper(rol) = 'ADMIN'
    ) then
        raise exception 'No autorizado para consultar auditoría de datos';
    end if;

    return query

    -- (a) CLUES con formato inválido (longitud <> 11, no-mayúsculas, espacios)
    select 'clues_formato'::text, 'alta'::text, t.clues,
           'CLUES con formato inválido en ' || t.origen || ' (esperado: 11 caracteres, mayúsculas, sin espacios)',
           jsonb_build_object('origen', t.origen, 'longitud', length(t.clues))
    from (
        select u0.clues, 'unidades' as origen from public.unidades u0
        union all
        select um0.clues, 'unidades_medicas' from public.unidades_medicas um0
        union all
        -- registros_sis tiene cientos de miles de filas: se filtra el formato inválido ANTES del distinct (sin ordenar toda la tabla)
        select distinct rs0.clues, 'registros_sis' from public.registros_sis rs0
         where rs0.clues is not null and (length(rs0.clues) <> 11 or rs0.clues <> upper(rs0.clues) or rs0.clues <> btrim(rs0.clues))
        union all
        select distinct pa0.clues, 'poblaciones_anuales' from public.poblaciones_anuales pa0
    ) t
    where t.clues is not null
      and (length(t.clues) <> 11 or t.clues <> upper(t.clues) or t.clues <> btrim(t.clues))

    union all

    -- (b) unidades_medicas huérfanas (sin fila correspondiente en unidades)
    select 'unidad_huerfana', 'alta', um.clues,
           'Existe en unidades_medicas (' || coalesce(um.nombre,'?') || ', ' || coalesce(um.municipio,'?') || ') pero no está en el catálogo unidades',
           jsonb_build_object('nombre', um.nombre, 'municipio', um.municipio)
    from public.unidades_medicas um
    left join public.unidades u on u.clues = um.clues
    where u.clues is null

    union all

    -- (b) unidades activas sin fila en unidades_medicas (quedan invisibles en indicadores por el INNER JOIN)
    select 'unidad_sin_ficha_medica', 'alta', u.clues,
           'Unidad activa (' || coalesce(u.unidad,'?') || ') sin fila en unidades_medicas: queda invisible en Indicadores',
           jsonb_build_object('unidad', u.unidad, 'municipio', u.municipio)
    from public.unidades u
    left join public.unidades_medicas um on um.clues = u.clues
    where u.activo = 'SI' and um.clues is null

    union all

    -- (c) poblaciones_anuales: mismo valor exacto entre año y año+1, con pob_6_anos=0 (síntoma de duplicado por copiar-pegar)
    select 'poblacion_duplicada_sospechosa', 'media', a.clues,
           'Población idéntica entre ' || a.anio || ' y ' || b.anio || ' con pob_6_anos=0 — posible copia sin actualizar',
           jsonb_build_object('anio_a', a.anio, 'anio_b', b.anio, 'pob_menor_1', a.pob_menor_1, 'pob_1_ano', a.pob_1_ano, 'pob_4_anos', a.pob_4_anos)
    from public.poblaciones_anuales a
    join public.poblaciones_anuales b on a.clues = b.clues and b.anio = a.anio + 1
    where a.pob_menor_1 = b.pob_menor_1 and a.pob_1_ano = b.pob_1_ano and a.pob_4_anos = b.pob_4_anos
      and a.pob_6_anos = 0 and (a.pob_menor_1 > 0 or a.pob_1_ano > 0 or a.pob_4_anos > 0)

    union all

    -- (d) unidades con meses faltantes en registros_sis respecto al máximo mes reportado en la jurisdicción ese año
    select 'meses_faltantes', 'media', x.clues,
           'Reportó ' || x.meses_reportados || ' de ' || x.mes_max_jurisdiccion || ' meses disponibles en ' || v_anio,
           jsonb_build_object('meses_reportados', x.meses_reportados, 'mes_max_jurisdiccion', x.mes_max_jurisdiccion, 'anio', v_anio)
    from (
        select d.clues, count(*) as meses_reportados,
               (select max(rs.mes) from public.registros_sis rs where rs.anio = v_anio) as mes_max_jurisdiccion
        from (select distinct r.clues, r.mes from public.registros_sis r where r.anio = v_anio) d
        group by d.clues
    ) x
    where x.meses_reportados < x.mes_max_jurisdiccion

    union all

    -- (e1) sis_variables_mapeo: llaves duplicadas solo por mayúsculas/minúsculas
    select 'mapeo_duplicado_mayusculas', 'baja', null::text,
           'sis_variables_mapeo tiene ' || y.n || ' filas para "' || upper(y.biologico_norm) || '" (año ' || y.anio || ') que solo difieren en mayúsculas/minúsculas',
           jsonb_build_object('anio', y.anio, 'variantes', y.variantes)
    from (
        select sm.anio, upper(sm.biologico) as biologico_norm, count(*) as n, jsonb_agg(sm.biologico) as variantes
        from public.sis_variables_mapeo sm
        where sm.anio = v_anio
        group by sm.anio, upper(sm.biologico)
        having count(*) > 1
    ) y

    union all

    -- (e2) funciones SECURITY DEFINER que tocan datos de registros_sis/params sin RAISE EXCEPTION de control de rol
    select 'rpc_sin_verificacion_rol', 'baja', null::text,
           'La función ' || p.proname || '() es SECURITY DEFINER, lee datos de productividad/parámetros, pero no tiene una verificación de rol (RAISE EXCEPTION) en su cuerpo',
           jsonb_build_object('funcion', p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prosrc not ilike '%RAISE EXCEPTION%'
      and (p.prosrc ilike '%registros_sis%' or p.prosrc ilike '%_params%')
      and p.proname <> 'get_audit_findings';
end;
$function$;
