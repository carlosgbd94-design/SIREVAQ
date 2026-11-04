-- Versión vigente en producción de get_concentrado_aplicaciones / get_concentrado_por_biologico (paginadas, 5 parámetros).
-- Reemplaza a las versiones de 3 parámetros de rpc_concentrado_aplicaciones.sql: esas se eliminaron el 2026-11-04 porque
-- convivían con estas (que tienen DEFAULT en p_offset/p_limit) y una llamada de 3 argumentos era ambigua.
-- El cliente siempre pagina (concentrado_ui.js / mobile_supervision_ops.js pasan p_offset y p_limit; ORDER BY estable).

drop function if exists public.get_concentrado_aplicaciones(integer, integer, integer);
drop function if exists public.get_concentrado_por_biologico(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.get_concentrado_aplicaciones(p_anio integer, p_mes_ini integer, p_mes_fin integer, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100000)
 RETURNS TABLE(clues character varying, nombre character varying, municipio character varying, variable_sis character varying, total_dosis bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND upper(rol) IN ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
    ) THEN
        RAISE EXCEPTION 'No autorizado para consultar el concentrado de aplicaciones';
    END IF;

    RETURN QUERY
    WITH vaccine_vars AS (
        SELECT DISTINCT jsonb_array_elements_text(m.variables) AS var
        FROM public.sis_variables_mapeo m
        WHERE m.anio = p_anio
    )
    SELECT
        u.clues::VARCHAR,
        u.nombre::VARCHAR,
        u.municipio::VARCHAR,
        r.variable_sis::VARCHAR,
        SUM(r.valor)::BIGINT AS total_dosis
    FROM public.unidades_medicas u
    INNER JOIN public.unidades un ON un.clues = u.clues AND un.activo = 'SI'
    INNER JOIN public.registros_sis r
        ON r.clues = u.clues
        AND r.anio = p_anio
        AND r.mes BETWEEN p_mes_ini AND p_mes_fin
        AND r.variable_sis IN (SELECT var FROM vaccine_vars)
    GROUP BY u.clues, u.nombre, u.municipio, r.variable_sis
    ORDER BY u.clues, r.variable_sis
    OFFSET p_offset LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_concentrado_por_biologico(p_anio integer, p_mes_ini integer, p_mes_fin integer, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100000)
 RETURNS TABLE(clues character varying, nombre character varying, municipio character varying, biologico text, total_dosis bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND upper(rol) IN ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
    ) THEN
        RAISE EXCEPTION 'No autorizado para consultar el concentrado de aplicaciones';
    END IF;

    RETURN QUERY
    WITH alias_map(canonico, alias) AS (
        VALUES
          ('BCG','BCG'), ('BCG','MOTHER_BCG'),
          ('HEPATITIS B','HEPB_0_7'), ('HEPATITIS B','ADOL_HB'), ('HEPATITIS B','HEPATITIS B'), ('HEPATITIS B','MOTHER_HEPATITIS_B'),
          ('HEXAVALENTE','HEXA_1'), ('HEXAVALENTE','HEXA_2'), ('HEXAVALENTE','HEXA_3'), ('HEXAVALENTE','HEXA_REF'), ('HEXAVALENTE','HEXAVALENTE'), ('HEXAVALENTE','MOTHER_HEXAVALENTE'),
          ('DPT','DPT_4'), ('DPT','DPT'), ('DPT','MOTHER_DPT'),
          ('ROTAVIRUS','ROTA_1'), ('ROTAVIRUS','ROTA_2'), ('ROTAVIRUS','ROTAVIRUS'), ('ROTAVIRUS','MOTHER_ROTAVIRUS'),
          ('NEUMOCOCICA 13','NEUMO_1'), ('NEUMOCOCICA 13','NEUMO_2'), ('NEUMOCOCICA 13','NEUMO_C1'), ('NEUMOCOCICA 13','NEUMO_C2'), ('NEUMOCOCICA 13','NEUMO_C3'), ('NEUMOCOCICA 13','NEUMO_REF'), ('NEUMOCOCICA 13','AM_NEUMO13'), ('NEUMOCOCICA 13','MOTHER_NEUMO_CONJ'),
          ('NEUMOCOCICA 20','AM_NEUMO20'), ('NEUMOCOCICA 20','MOTHER_NEUMO_20'),
          ('SRP','SRP_1'), ('SRP','SRP_2'), ('SRP','SRP_6'), ('SRP','SRP'), ('SRP','MOTHER_SRP'),
          ('SR','ADOL_SR'), ('SR','SR'), ('SR','MOTHER_SR'),
          ('VPH','ADOL_VPH'), ('VPH','VPH'), ('VPH','MOTHER_VPH'),
          ('VARICELA','VARICELA'), ('VARICELA','MOTHER_VARICELA'),
          ('HEPATITIS A','HEPATITIS_A'), ('HEPATITIS A','HEPATITIS A'), ('HEPATITIS A','MOTHER_HEPATITIS_A'),
          ('TD','ADOL_TD'), ('TD','AM_TD'), ('TD','TD'), ('TD','MOTHER_TD'),
          ('TDPA','ADOL_TDPA'), ('TDPA','EMB_TDPA'), ('TDPA','TDPA'), ('TDPA','MOTHER_TDPA'),
          ('COVID-19','COVID'), ('COVID-19','COVID-19'), ('COVID-19','MOTHER_COVID'),
          ('INFLUENZA','INFLUENZA'), ('INFLUENZA','MOTHER_INFLUENZA'),
          ('VSR','EMB_VSR'), ('VSR','VSR'), ('VSR','MOTHER_VSR')
    ),
    clave_biologico AS (
        SELECT DISTINCT
          jsonb_array_elements_text(m.variables) AS variable_sis,
          COALESCE(am.canonico, 'OTROS') AS nombre_biologico
        FROM public.sis_variables_mapeo m
        LEFT JOIN alias_map am ON upper(am.alias) = upper(m.biologico)
        WHERE m.anio = p_anio
    ),
    clave_biologico_dedup AS (
        SELECT cb0.variable_sis AS clave_dedup, (array_agg(cb0.nombre_biologico ORDER BY (cb0.nombre_biologico = 'OTROS')))[1] AS nombre_biologico_dedup
        FROM clave_biologico cb0
        GROUP BY cb0.variable_sis
    )
    SELECT
        u.clues::VARCHAR,
        u.nombre::VARCHAR,
        u.municipio::VARCHAR,
        cb.nombre_biologico_dedup,
        SUM(r.valor)::BIGINT AS total_dosis
    FROM public.unidades_medicas u
    INNER JOIN public.unidades un ON un.clues = u.clues AND un.activo = 'SI'
    INNER JOIN public.registros_sis r ON r.clues = u.clues AND r.anio = p_anio AND r.mes BETWEEN p_mes_ini AND p_mes_fin
    INNER JOIN clave_biologico_dedup cb ON cb.clave_dedup = r.variable_sis
    GROUP BY u.clues, u.nombre, u.municipio, cb.nombre_biologico_dedup
    ORDER BY u.clues, cb.nombre_biologico_dedup
    OFFSET p_offset LIMIT p_limit;
END;
$function$;
