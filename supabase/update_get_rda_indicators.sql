-- ===================================================================================
-- SQL Migration: update_get_rda_indicators (VERSIÓN DINÁMICA V6)
-- Ejecutar en el SQL Editor de Supabase para hacer que el cálculo de dosis
-- responda de forma automática y dinámica a los cambios en el Mapeador del Admin.
-- ===================================================================================

-- Eliminar la función anterior para poder cambiar la estructura y firma
DROP FUNCTION IF EXISTS public.get_rda_indicators(integer, integer);

CREATE OR REPLACE FUNCTION public.get_rda_indicators(p_anio integer, p_max_mes integer)
 RETURNS TABLE(
    clues character varying, 
    nombre character varying, 
    municipio character varying, 
    pob_menor_1 integer, 
    pob_1_ano integer, 
    pob_4_anos integer, 
    pob_6_anos integer,
    bcg_dosis integer, 
    hepb_0_7_dosis integer, 
    hexa_3_dosis integer, 
    rota_2_dosis integer, 
    neumo_2_dosis integer, 
    hexa_ref_dosis integer, 
    neumo_ref_dosis integer, 
    srp_2_dosis integer, 
    dpt_4_dosis integer,
    srp_6_dosis integer,
    basic_menor_1_dosis integer, 
    basic_1_ano_dosis integer, 
    basic_4_anos_dosis integer, 
    cobertura_menor1 numeric, 
    cobertura_uno numeric, 
    cobertura_cuatro numeric, 
    adol_hb integer, 
    adol_sr integer, 
    adol_vph integer, 
    adol_td integer, 
    adol_tdpa integer, 
    am_neumo13 integer, 
    am_neumo20 integer, 
    am_td integer, 
    emb_tdpa integer, 
    emb_vsr integer, 
    inv_influenza integer, 
    inv_covid integer, 
    hexa_1_dosis integer, 
    hexa_2_dosis integer, 
    neumo_1_dosis integer, 
    neumo_c1_dosis integer, 
    neumo_c2_dosis integer, 
    neumo_c3_dosis integer, 
    srp_1_dosis integer, 
    varicela integer, 
    hepatitis_a integer,
    neumo_23_dosis integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    -- Arrays de variables del SIS cargados dinámicamente de public.sis_variables_mapeo
    v_bcg text[];
    v_hepb_0_7 text[];
    v_hexa_3 text[];
    v_rota_2 text[];
    v_neumo_2 text[];
    v_hexa_ref text[];
    v_neumo_ref text[];
    v_srp_2 text[];
    v_dpt_4 text[];
    v_adol_hb text[];
    v_adol_sr text[];
    v_adol_vph text[];
    v_adol_td text[];
    v_adol_tdpa text[];
    v_am_neumo13 text[];
    v_am_neumo20 text[];
    v_am_td text[];
    v_emb_tdpa text[];
    v_emb_vsr text[];
    v_influenza text[];
    v_covid text[];
    v_hexa_1 text[];
    v_hexa_2 text[];
    v_neumo_1 text[];
    v_neumo_c1 text[];
    v_neumo_c2 text[];
    v_neumo_c3 text[];
    v_srp_1 text[];
    v_varicela text[];
    v_hepatitis_a text[];
    -- SRP 6 años (exclusivo 2025)
    v_srp_6 text[];
    -- Neumo 23 Polisacárida (exclusivo 2025, clave VNP01)
    v_neumo_23 text[];
BEGIN
    -- 1. Cargar los mapeos desde la base de datos (con fallbacks estáticos si no existen registros)
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_bcg FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('BCG', 'MOTHER_BCG') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hepb_0_7 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEPB_0_7') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_3 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_3') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_rota_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ROTA_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_ref FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_REF') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_ref FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_REF') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_srp_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('SRP_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_dpt_4 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('DPT_4') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_adol_hb FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ADOL_HB') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_adol_sr FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ADOL_SR', 'SR', 'MOTHER_SR') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_adol_vph FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ADOL_VPH', 'VPH', 'MOTHER_VPH') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_adol_td FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ADOL_TD', 'TD', 'MOTHER_TD') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_adol_tdpa FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ADOL_TDPA', 'TDPA', 'MOTHER_TDPA') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_am_neumo13 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('AM_NEUMO13') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_am_neumo20 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('AM_NEUMO20', 'NEUMOCÓCICA 20', 'MOTHER_NEUMO_20') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_am_td FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('AM_TD') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_emb_tdpa FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('EMB_TDPA') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_emb_vsr FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('EMB_VSR', 'VSR', 'MOTHER_VSR') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_influenza FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('INFLUENZA', 'MOTHER_INFLUENZA') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_covid FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('COVID', 'COVID-19', 'MOTHER_COVID') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c3 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C3') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_srp_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('SRP_1') AND anio = p_anio) x;
    
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_varicela FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('VARICELA', 'MOTHER_VARICELA') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hepatitis_a FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEPATITIS_A', 'HEPATITIS A', 'MOTHER_HEPATITIS_A') AND anio = p_anio) x;
    -- SRP 6 años y Neumo 23 (solo aplican en p_anio = 2025)
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_srp_6 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) = 'SRP_6' AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_23 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_23', 'NEUMO_ADULTOS') AND anio = p_anio) x;

    -- 2. Fallbacks estáticos por si los arrays resultan vacíos (sin registros en sis_variables_mapeo)
    IF cardinality(v_bcg) = 0 THEN v_bcg := ARRAY['VBC01', 'VBC02', 'BIO50']; END IF;
    IF cardinality(v_hepb_0_7) = 0 THEN v_hepb_0_7 := ARRAY['VAC06']; END IF;
    IF cardinality(v_hexa_3) = 0 THEN v_hexa_3 := ARRAY['VAC69']; END IF;
    IF cardinality(v_rota_2) = 0 THEN v_rota_2 := ARRAY['VRV02']; END IF;
    IF cardinality(v_neumo_2) = 0 THEN v_neumo_2 := ARRAY['VAC18', 'VCC02']; END IF;
    IF cardinality(v_hexa_ref) = 0 THEN v_hexa_ref := ARRAY['VAC70']; END IF;
    IF cardinality(v_neumo_ref) = 0 THEN v_neumo_ref := ARRAY['VAC19', 'VCC03']; END IF;
    IF cardinality(v_srp_2) = 0 THEN v_srp_2 := ARRAY['VTV01']; END IF;
    IF cardinality(v_dpt_4) = 0 THEN v_dpt_4 := ARRAY['VAC12']; END IF;

    IF cardinality(v_hexa_1) = 0 THEN v_hexa_1 := ARRAY['VAC67']; END IF;
    IF cardinality(v_hexa_2) = 0 THEN v_hexa_2 := ARRAY['VAC68']; END IF;
    IF cardinality(v_neumo_1) = 0 THEN v_neumo_1 := ARRAY['VAC17']; END IF;
    IF cardinality(v_neumo_c1) = 0 THEN v_neumo_c1 := ARRAY['VCC01']; END IF;
    IF cardinality(v_neumo_c2) = 0 THEN v_neumo_c2 := ARRAY['VCC02']; END IF;
    IF cardinality(v_neumo_c3) = 0 THEN v_neumo_c3 := ARRAY['VCC03']; END IF;
    IF cardinality(v_srp_1) = 0 THEN v_srp_1 := ARRAY['VAC23']; END IF;

    IF cardinality(v_varicela) = 0 THEN v_varicela := ARRAY['VAR02', 'VAR03']; END IF;
    IF cardinality(v_hepatitis_a) = 0 THEN v_hepatitis_a := ARRAY['VHA01', 'VHA02', 'BIO88']; END IF;

    IF cardinality(v_adol_hb) = 0 THEN v_adol_hb := ARRAY['VHB01','VHB02','VHB03','VHB04','VHB05','VHB06']; END IF;
    IF cardinality(v_adol_sr) = 0 THEN v_adol_sr := ARRAY['VAC83','VDV01','VDV02','VDV03','VDV04','VDV05','VDV06']; END IF;
    IF cardinality(v_adol_vph) = 0 THEN v_adol_vph := ARRAY['VPH05','VPH06','VPH07','VPH08','VPH12','VPH13','VPH14']; END IF;
    IF cardinality(v_adol_td) = 0 THEN v_adol_td := ARRAY['VAC39','VAC40','VAC47','VAC48','VTD01','VTD02','VAC55','VAC56','VTD03','VTD19','VTD05','VTD21','VTD07','VTD23','VTD09','VTD25','VTD11','VTD27','VTD14','VTD29','VTD31','VTD32','VTD34','VTD35','VTD20','VTD22','VTD24','VTD26','VTD28','VTD30','VTD33','VTD36','VTT01','VTT02','VTT04','VTT05','VTT07','VTT08','VTT10','VTT11']; END IF;
    IF cardinality(v_adol_tdpa) = 0 THEN v_adol_tdpa := ARRAY['VAC63']; END IF;

    IF cardinality(v_am_neumo13) = 0 THEN v_am_neumo13 := ARRAY['VNC04','VAC93','VAC94']; END IF;
    IF cardinality(v_am_neumo20) = 0 THEN v_am_neumo20 := ARRAY['VCC07']; END IF;
    IF cardinality(v_am_td) = 0 THEN v_am_td := ARRAY['VTT03','VTT06','VTT09','VTT12','VAC43','VAC46','VAC51','VAC54','VTD13','VTD16','VAC59','VAC62']; END IF;

    IF cardinality(v_emb_tdpa) = 0 THEN v_emb_tdpa := ARRAY['VAC63']; END IF;
    IF cardinality(v_emb_vsr) = 0 THEN v_emb_vsr := ARRAY['VS001']; END IF;

    IF cardinality(v_influenza) = 0 THEN v_influenza := ARRAY['BIE01','BIE28','BIE29','BIE30','BIE31','BIE04','BIE32','BIE33','BIE34','BIE35','BIE36','BIE37','BIE38','BIE39','BIE40','BIO96','BIO97','BIE09','BIE10','BIE41','BIE12','BIE13','BIE42','BIE15','BIE16','BIE43','BIE18','BIE19','BIE44','BIE48','BIE49','BIE50','BIE24','BIE25','BIE46','BIE51','BIE52','BIE53','BIE54','BIE55','BIE56','BIE57','BIE58','BIE59','BIE60','BIE61']; END IF;
    IF cardinality(v_covid) = 0 THEN v_covid := ARRAY['VCV38','VCV39','VCV40','VCV28','VCV16','VCV20','VCV21']; END IF;
    -- Fallbacks SRP_6 y Neumo 23 (solo se usan en 2025; para 2026 el array queda vacío y retorna 0)
    IF p_anio = 2025 AND cardinality(v_srp_6) = 0 THEN v_srp_6 := ARRAY['VTV01']; END IF;
    IF p_anio = 2025 AND cardinality(v_neumo_23) = 0 THEN v_neumo_23 := ARRAY['VNP01']; END IF;

    -- 3. Consulta y agregación por unidad
    RETURN QUERY
    WITH raw_sums AS (
        SELECT
            u.clues::VARCHAR as u_clues,
            u.nombre::VARCHAR as u_nombre,
            u.municipio::VARCHAR as u_municipio,
            COALESCE(pu.pob_menor_1, u.pob_menor_1, 0) as u_pob_menor_1,
            COALESCE(pu.pob_1_ano, u.pob_1_ano, 0) as u_pob_1_ano,
            COALESCE(pu.pob_4_anos, u.pob_4_anos, 0) as u_pob_4_anos,
            COALESCE(pu.pob_6_anos, 0) as u_pob_6_anos,
            -- Básico Menor 1 Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_bcg) THEN r.valor ELSE 0 END), 0)::INT as val_bcg,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hepb_0_7) THEN r.valor ELSE 0 END), 0)::INT as val_hepb,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_3) THEN r.valor ELSE 0 END), 0)::INT as val_hexa,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_rota_2) THEN r.valor ELSE 0 END), 0)::INT as val_rota,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_2) THEN r.valor ELSE 0 END), 0)::INT as val_neumo,
            -- Básico 1 Año Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_ref) THEN r.valor ELSE 0 END), 0)::INT as val_hexa_ref,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_ref) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_ref,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_srp_2) THEN r.valor ELSE 0 END), 0)::INT as val_srp_2,
            -- Básico 4 Años Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_dpt_4) THEN r.valor ELSE 0 END), 0)::INT as val_dpt_4,

            -- Adolescentes Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_adol_hb) THEN r.valor ELSE 0 END), 0)::INT as val_adol_hb,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_adol_sr) THEN r.valor ELSE 0 END), 0)::INT as val_adol_sr,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_adol_vph) THEN r.valor ELSE 0 END), 0)::INT as val_adol_vph,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_adol_td) THEN r.valor ELSE 0 END), 0)::INT as val_adol_td,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_adol_tdpa) THEN r.valor ELSE 0 END), 0)::INT as val_adol_tdpa,

            -- Adultos Mayores Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_am_neumo13) THEN r.valor ELSE 0 END), 0)::INT as val_am_neumo13,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_am_neumo20) THEN r.valor ELSE 0 END), 0)::INT as val_am_neumo20,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_am_td) THEN r.valor ELSE 0 END), 0)::INT as val_am_td,

            -- Embarazadas Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_emb_tdpa) THEN r.valor ELSE 0 END), 0)::INT as val_emb_tdpa,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_emb_vsr) THEN r.valor ELSE 0 END), 0)::INT as val_emb_vsr,

            -- Temporada Invernal Breakdown
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_influenza) THEN r.valor ELSE 0 END), 0)::INT as val_inv_influenza,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_covid) THEN r.valor ELSE 0 END), 0)::INT as val_inv_covid,

            -- Nuevas variables para coberturas por biológico
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_1) THEN r.valor ELSE 0 END), 0)::INT as val_hexa_1,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_2) THEN r.valor ELSE 0 END), 0)::INT as val_hexa_2,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_1) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_1,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c1) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_c1,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c2) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_c2,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c3) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_c3,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_srp_1) THEN r.valor ELSE 0 END), 0)::INT as val_srp_1,

            -- Adicionales Breakdown (Varicela y Hepatitis A)
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_varicela) THEN r.valor ELSE 0 END), 0)::INT as val_varicela,
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hepatitis_a) THEN r.valor ELSE 0 END), 0)::INT as val_hepatitis_a,
            -- Básico 6 Años (SRP Dosis 6 años, exclusivo 2025)
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_srp_6) THEN r.valor ELSE 0 END), 0)::INT as val_srp_6,
            -- Neumo 23 Polisacárida (exclusivo 2025)
            COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_23) THEN r.valor ELSE 0 END), 0)::INT as val_neumo_23
        FROM public.unidades_medicas u
        INNER JOIN public.unidades un ON un.clues = u.clues AND un.activo = 'SI'
        LEFT JOIN public.poblaciones_anuales pu ON pu.clues = u.clues AND pu.anio = p_anio
        LEFT JOIN public.registros_sis r ON r.clues = u.clues AND r.anio = p_anio AND r.mes <= p_max_mes
        GROUP BY u.clues, u.nombre, u.municipio, pu.pob_menor_1, pu.pob_1_ano, pu.pob_4_anos, pu.pob_6_anos, u.pob_menor_1, u.pob_1_ano, u.pob_4_anos
    )
    SELECT
        u_clues as clues,
        u_nombre as nombre,
        u_municipio as municipio,
        u_pob_menor_1 as pob_menor_1,
        u_pob_1_ano as pob_1_ano,
        u_pob_4_anos as pob_4_anos,
        u_pob_6_anos as pob_6_anos,
        val_bcg as bcg_dosis,
        val_hepb as hepb_0_7_dosis,
        val_hexa as hexa_3_dosis,
        val_rota as rota_2_dosis,
        val_neumo as neumo_2_dosis,
        val_hexa_ref as hexa_ref_dosis,
        val_neumo_ref as neumo_ref_dosis,
        val_srp_2 as srp_2_dosis,
        val_dpt_4 as dpt_4_dosis,
        (val_bcg + val_hepb + val_hexa + val_rota + val_neumo)::INT as basic_menor_1_dosis,
        (val_hexa_ref + val_neumo_ref + val_srp_2)::INT as basic_1_ano_dosis,
        val_dpt_4::INT as basic_4_anos_dosis,

        -- Calculated Coverages
        COALESCE(
            ROUND(
                (((val_bcg + val_hepb + val_hexa + val_rota + val_neumo) / 4.0) /
                NULLIF((u_pob_menor_1 * 0.0833 * p_max_mes), 0.0))::numeric * 100.0,
                1
            ),
            0.0
        )::NUMERIC as cobertura_menor1,

        COALESCE(
            ROUND(
                ((val_hexa_ref + val_neumo_ref + val_srp_2) /
                NULLIF((u_pob_1_ano * 0.0833 * p_max_mes), 0.0))::numeric * 100.0,
                1
            ),
            0.0
        )::NUMERIC as cobertura_uno,

        COALESCE(
            ROUND(
                (val_dpt_4 /
                NULLIF((u_pob_4_anos * 0.0833 * p_max_mes), 0.0))::numeric * 100.0,
                1
            ),
            0.0
        )::NUMERIC as cobertura_cuatro,

        val_adol_hb as adol_hb,
        val_adol_sr as adol_sr,
        val_adol_vph as adol_vph,
        val_adol_td as adol_td,
        val_adol_tdpa as adol_tdpa,
        val_am_neumo13 as am_neumo13,
        val_am_neumo20 as am_neumo20,
        val_am_td as am_td,
        val_emb_tdpa as emb_tdpa,
        val_emb_vsr as emb_vsr,
        val_inv_influenza as inv_influenza,
        val_inv_covid as inv_covid,

        -- Nuevos campos de dosis para cálculo individual de biológicos
        val_hexa_1 as hexa_1_dosis,
        val_hexa_2 as hexa_2_dosis,
        val_neumo_1 as neumo_1_dosis,
        val_neumo_c1 as neumo_c1_dosis,
        val_neumo_c2 as neumo_c2_dosis,
        val_neumo_c3 as neumo_c3_dosis,
        val_srp_1 as srp_1_dosis,

        -- Adicionales
        val_varicela as varicela,
        val_hepatitis_a as hepatitis_a,
        -- 6 Años y Neumo 23 (exclusivos 2025)
        val_srp_6 as srp_6_dosis,
        val_neumo_23 as neumo_23_dosis
    FROM raw_sums;
END;
$function$;
