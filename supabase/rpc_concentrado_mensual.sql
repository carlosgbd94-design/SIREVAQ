-- Serie mensual del panel "Concentrado de Aplicaciones" (concentrado_ui.js).
-- Una fila por (municipio, biologico, mes) con las dosis del SIS de todo el año: ~4 municipios x 17 biologicos x 12 meses
-- (<= ~820 filas), asi que el cliente la pide completa (2 paginas) para dibujar el ritmo mensual y comparar con el
-- mismo periodo del año anterior. Mismo mapa clave SIS -> biologico y misma regla de acceso que get_concentrado_por_biologico
-- (rpc_concentrado_paginado.sql). Solo lectura.

-- unidades_mes = unidades del municipio con alguna captura ese mes (sirve para marcar meses de captura incompleta, p. ej. jun-2025: 34 de 69).
DROP FUNCTION IF EXISTS public.get_concentrado_mensual(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.get_concentrado_mensual(p_anio integer, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100000)
 RETURNS TABLE(municipio character varying, biologico text, mes integer, total_dosis bigint, unidades_mes integer)
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
    ),
    base AS (
        SELECT u.municipio AS b_muni, u.clues AS b_clues, cb.nombre_biologico_dedup AS b_bio, r.mes AS b_mes, SUM(r.valor) AS b_valor
        FROM public.unidades_medicas u
        INNER JOIN public.unidades un ON un.clues = u.clues AND un.activo = 'SI'
        INNER JOIN public.registros_sis r ON r.clues = u.clues AND r.anio = p_anio
        INNER JOIN clave_biologico_dedup cb ON cb.clave_dedup = r.variable_sis
        GROUP BY u.municipio, u.clues, cb.nombre_biologico_dedup, r.mes
    ),
    um AS (
        SELECT b.b_muni AS um_muni, b.b_mes AS um_mes, COUNT(DISTINCT b.b_clues)::INTEGER AS um_n
        FROM base b GROUP BY b.b_muni, b.b_mes
    )
    SELECT
        b.b_muni::VARCHAR,
        b.b_bio,
        b.b_mes::INTEGER,
        SUM(b.b_valor)::BIGINT,
        MAX(um.um_n)::INTEGER
    FROM base b
    INNER JOIN um ON um.um_muni = b.b_muni AND um.um_mes = b.b_mes
    GROUP BY b.b_muni, b.b_bio, b.b_mes
    ORDER BY b.b_muni, b.b_bio, b.b_mes
    OFFSET p_offset LIMIT p_limit;
END;
$function$;
