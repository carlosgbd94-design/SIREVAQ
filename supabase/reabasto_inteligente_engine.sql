-- ============================================================================
-- Motor de Reabasto Inteligente (SIREVAQ)
-- ============================================================================
-- Calcula automáticamente Promedio/Mínimo/Máximo sugeridos por unidad+biológico
-- para las unidades con evidencia REAL de desabasto recurrente (no estimación
-- estadística), y las deja en `biologicos_params_sugeridos` esperando
-- aprobación humana explícita -- NUNCA escribe directo en `biologicos_params`.
--
-- Espejo del estado ya aplicado en Supabase (proyecto utclfqjietlxzlorxhrs) vía
-- varias migraciones incrementales durante su desarrollo. Este archivo documenta
-- el estado FINAL para que quede en el repo, igual que biovac_engine.sql o
-- sis06p_estado_engine.sql -- no es un script de migración por sí mismo (ya se
-- aplicó todo directo con el MCP de Supabase).
--
-- Piezas:
--   1. biologico_sis_variable_mapping -- fuente única del mapeo biológico->SIS,
--      compartida con param_calculator.js (antes vivía hardcodeado ahí solo).
--   2. biologicos_params_sugeridos -- staging de las sugerencias pendientes.
--   3. calcular_reabasto_pendientes() -- el motor: usa la captura SEMANAL real
--      de existencia (biologicos_existencia) para detectar desabasto -- NO
--      compara aplicaciones contra lo pedido, porque eso se contamina con
--      errores de captura. Solo genera sugerencias para unidades con evidencia
--      real (existencia en cero Y consumo real ese mes). Excluye Influenza/VPH/
--      COVID-19 (vacunas de campaña/temporada) y unidades tipo Caravana
--      (FAM/UMME, en reestructuración). Tiene guardarraíl contra datos atípicos
--      (winsoriza contra la mediana, salvo que el pico sea un evento real que
--      afecte a muchas unidades el mismo mes -- brote/campaña, no typo).
--   4. sirevaq_easter_date / sirevaq_is_mexican_holiday / sirevaq_is_business_day /
--      sirevaq_bio_capture_window -- puerto exacto a SQL de getEasterDate/
--      isMexicanHoliday/isBusinessDay/getBioCaptureWindow (main.js), para que el
--      cron calcule la MISMA fecha que ya ve el usuario en el cliente.
--   5. sirevaq_bio_reabasto_scheduler() + cron diario -- dispara el motor 3 días
--      antes de que abra la ventana de captura del día 22 (mes actual o
--      siguiente). También se dispara por evento al cargar un CSV nuevo (ver
--      rda_parser.js, RDAParser.rpcUpsert()).
--   6. Notificación de aprobación pendiente: UNA por municipio afectado
--      (target_scope='MUNICIPIO'), nunca por rol genérico -- el filtro de
--      notificaciones del cliente no tiene caso para target_scope='ROLE' y
--      caía en el fallback "le llega a todos" (bug real, ya corregido).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Fuente única del mapeo Biológico -> Variables SIS
-- ----------------------------------------------------------------------------
create table if not exists public.biologico_sis_variable_mapping (
    biologico text not null,
    variable_sis text not null,
    created_at timestamptz not null default now(),
    primary key (biologico, variable_sis)
);

comment on table public.biologico_sis_variable_mapping is
    'Mapeo canónico: qué variables del concentrado SIS suman como aplicaciones de cada biológico. Fuente única para param_calculator.js y para el motor SQL de reabasto.';

alter table public.biologico_sis_variable_mapping enable row level security;

drop policy if exists "RLS_biologico_sis_variable_mapping_Read" on public.biologico_sis_variable_mapping;
create policy "RLS_biologico_sis_variable_mapping_Read"
    on public.biologico_sis_variable_mapping
    for select
    using (auth.role() = 'authenticated');

drop policy if exists "RLS_biologico_sis_variable_mapping_Write_Admin" on public.biologico_sis_variable_mapping;
create policy "RLS_biologico_sis_variable_mapping_Write_Admin"
    on public.biologico_sis_variable_mapping
    for all
    using (is_admin());

-- Semilla 1:1 desde el BIO_SIS_MAPPING original de param_calculator.js (incluye
-- las 46 variables de Influenza, hoy en window.INFLUENZA_SIS_MAPPING de
-- influenza_module.js) + VSR (variable real VS001, confirmada en
-- sis_variables_mapeo del año 2026, clave EMB_VSR).
insert into public.biologico_sis_variable_mapping (biologico, variable_sis) values
    ('BCG','VBC01'), ('BCG','VBC02'), ('BCG','BIO50'), ('BCG','BIO03'), ('BCG','VBC03'),
    ('HEPATITIS B','VAC06'), ('HEPATITIS B','VHB01'), ('HEPATITIS B','VHB02'), ('HEPATITIS B','VHB03'), ('HEPATITIS B','VHB04'), ('HEPATITIS B','VHB05'), ('HEPATITIS B','VHB06'),
    ('HEXAVALENTE','VAC67'), ('HEXAVALENTE','VAC68'), ('HEXAVALENTE','VAC69'), ('HEXAVALENTE','VAC70'), ('HEXAVALENTE','VHX01'), ('HEXAVALENTE','VHX02'), ('HEXAVALENTE','VHX03'), ('HEXAVALENTE','VHX04'),
    ('DPT','VAC12'), ('DPT','VAC13'),
    ('ROTAVIRUS','VRV01'), ('ROTAVIRUS','VRV02'), ('ROTAVIRUS','VRV03'), ('ROTAVIRUS','VRV04'),
    ('NEUMOCOCICA 13','VAC17'), ('NEUMOCOCICA 13','VAC18'), ('NEUMOCOCICA 13','VAC19'), ('NEUMOCOCICA 13','VNC01'), ('NEUMOCOCICA 13','VNC02'), ('NEUMOCOCICA 13','VNC03'), ('NEUMOCOCICA 13','VNC04'),
    ('SRP','VAC23'), ('SRP','VTV01'), ('SRP','VTV02'), ('SRP','VTV03'),
    ('SR','VAC82'), ('SR','VAC91'), ('SR','VDV01'), ('SR','VDV02'), ('SR','VDV03'), ('SR','VDV04'), ('SR','VDV05'), ('SR','VDV06'),
    ('VPH','VPH05'), ('VPH','VPH06'), ('VPH','VPH07'), ('VPH','VPH08'), ('VPH','VPH12'), ('VPH','VPH13'), ('VPH','VPH14'),
    ('VARICELA','VAR02'), ('VARICELA','VAR03'),
    ('HEPATITIS A','VHA01'), ('HEPATITIS A','VHA02'), ('HEPATITIS A','BIO88'),
    ('TD','VAC39'), ('TD','VAC40'), ('TD','VAC47'), ('TD','VAC48'), ('TD','VTD01'), ('TD','VTD02'), ('TD','VAC55'), ('TD','VAC56'), ('TD','VTT01'), ('TD','VTT02'), ('TD','VTT03'), ('TD','VTT04'), ('TD','VTT05'), ('TD','VTT06'), ('TD','VTT07'), ('TD','VTT08'), ('TD','VTT09'), ('TD','VTT10'), ('TD','VTT11'), ('TD','VTT12'),
    ('TDPA','VAC63'), ('TDPA','VDP01'),
    ('INFLUENZA','BIE01'), ('INFLUENZA','BIE28'), ('INFLUENZA','BIE29'), ('INFLUENZA','BIE30'), ('INFLUENZA','BIE31'),
    ('INFLUENZA','BIE04'), ('INFLUENZA','BIE32'), ('INFLUENZA','BIE33'), ('INFLUENZA','BIE34'), ('INFLUENZA','BIE35'),
    ('INFLUENZA','BIE36'), ('INFLUENZA','BIE37'), ('INFLUENZA','BIE38'), ('INFLUENZA','BIE39'), ('INFLUENZA','BIE40'),
    ('INFLUENZA','BIO96'), ('INFLUENZA','BIO97'),
    ('INFLUENZA','BIE09'), ('INFLUENZA','BIE10'), ('INFLUENZA','BIE41'),
    ('INFLUENZA','BIE12'), ('INFLUENZA','BIE13'), ('INFLUENZA','BIE42'),
    ('INFLUENZA','BIE15'), ('INFLUENZA','BIE16'), ('INFLUENZA','BIE43'),
    ('INFLUENZA','BIE18'), ('INFLUENZA','BIE19'), ('INFLUENZA','BIE44'),
    ('INFLUENZA','BIE48'), ('INFLUENZA','BIE49'), ('INFLUENZA','BIE50'),
    ('INFLUENZA','BIE24'), ('INFLUENZA','BIE25'), ('INFLUENZA','BIE46'),
    ('INFLUENZA','BIE51'), ('INFLUENZA','BIE52'), ('INFLUENZA','BIE53'),
    ('INFLUENZA','BIE54'), ('INFLUENZA','BIE55'),
    ('INFLUENZA','BIE56'), ('INFLUENZA','BIE57'), ('INFLUENZA','BIE58'),
    ('INFLUENZA','BIE59'), ('INFLUENZA','BIE60'), ('INFLUENZA','BIE61'),
    ('VSR', 'VS001')
on conflict (biologico, variable_sis) do nothing;


-- ----------------------------------------------------------------------------
-- 2. Staging de sugerencias pendientes de aprobación
-- ----------------------------------------------------------------------------
create table if not exists public.biologicos_params_sugeridos (
    id uuid primary key default gen_random_uuid(),
    clues text not null,
    unidad text,
    municipio text,
    biologico text not null,
    promedio_frascos_sugerido numeric not null default 0,
    min_dosis_sugerido integer not null default 0,
    max_dosis_sugerido integer not null default 0,
    promedio_frascos_actual numeric not null default 0,
    min_dosis_actual integer not null default 0,
    max_dosis_actual integer not null default 0,
    ciclos_insuficientes_recientes integer not null default 0,
    tipo_cambio text not null default 'SIN_CAMBIO_RELEVANTE'
        check (tipo_cambio in ('RIESGO_DESABASTO','POSIBLE_SOBREABASTO','SIN_CAMBIO_RELEVANTE','DATO_ATIPICO_REVISAR')),
    dato_atipico_detectado boolean not null default false,
    periodo_evaluado text,
    anio_evaluado integer not null,
    created_at timestamptz not null default now(),
    unique (clues, biologico)
);

comment on table public.biologicos_params_sugeridos is
    'Staging del motor autónomo de reabasto: sugerencias calculadas por calcular_reabasto_pendientes(), pendientes de aprobación humana antes de copiarse a biologicos_params.';

alter table public.biologicos_params_sugeridos enable row level security;

drop policy if exists "RLS_biologicos_params_sugeridos_Read" on public.biologicos_params_sugeridos;
create policy "RLS_biologicos_params_sugeridos_Read"
    on public.biologicos_params_sugeridos
    for select
    using (
        is_admin()
        or exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'JURISDICCIONAL')
    );

drop policy if exists "RLS_biologicos_params_sugeridos_Write_Admin" on public.biologicos_params_sugeridos;
create policy "RLS_biologicos_params_sugeridos_Write_Admin"
    on public.biologicos_params_sugeridos
    for all
    using (is_admin());

drop policy if exists "RLS_biologicos_params_sugeridos_Write_Jurisdiccional" on public.biologicos_params_sugeridos;
create policy "RLS_biologicos_params_sugeridos_Write_Jurisdiccional"
    on public.biologicos_params_sugeridos
    for all
    using (
        exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'JURISDICCIONAL')
    );


-- ----------------------------------------------------------------------------
-- 3. Motor de cálculo (fuente única de verdad -- reemplaza al preview JS de
--    param_calculator.js para el modo "Reabasto inteligente")
-- ----------------------------------------------------------------------------
create or replace function public.calcular_reabasto_pendientes(
    p_anio integer,
    p_lead_time_semanas numeric default 2,
    p_lead_time_std_semanas numeric default 1,
    p_nivel_servicio numeric default 1.65
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_last_month integer;
    v_min_dosis_floor constant integer := 5;
    v_buffer_multiplier constant numeric := 1.10;
    v_semanas_evaluadas constant integer := 12;
    v_min_capturas_validas constant integer := 2;
    v_z_bump_maximo constant numeric := 1.5;
    v_winsor_factor constant numeric := 4;
    v_winsor_piso_suma constant numeric := 50;
    v_evento_generalizado_umbral constant numeric := 0.15;
    v_bio_excluidos constant text[] := array['INFLUENZA', 'VPH', 'COVID-19', 'COVID19', 'COVID 19'];
    v_count integer;
    v_muni_rec record;
    v_notif_id text;
    v_titulo text;
    v_mensaje text;
begin
    if auth.uid() is not null then
        if not (
            is_admin()
            or exists (select 1 from perfiles where perfiles.id = auth.uid() and upper(perfiles.rol) = 'JURISDICCIONAL')
        ) then
            raise exception 'No autorizado para ejecutar el motor de reabasto inteligente';
        end if;
    end if;

    select max(mes) into v_last_month
    from registros_sis
    where anio = p_anio;

    if v_last_month is null then
        return 0;
    end if;

    delete from biologicos_params_sugeridos where anio_evaluado = p_anio;

    with meses as (
        select generate_series(1, v_last_month) as mes
    ),
    unidades_activas as (
        select clues, unidad, municipio from unidades
        where activo = 'SI'
          and upper(coalesce(clues, '')) not like '%UMME%'
          and upper(coalesce(clues, '')) not like '%FAM%'
          and upper(coalesce(unidad, '')) not like '%UMME%'
          and upper(coalesce(unidad, '')) not like '%FAM%'
    ),
    bio_lista as (
        select distinct biologico from biologico_sis_variable_mapping
        where upper(biologico) <> all (v_bio_excluidos)
    ),
    default_multiplo as (
        -- Regla confirmada: monodosis = 1, multidosis SIEMPRE = 10 (excepto COVID-19,
        -- fuera de alcance, que no sigue esta regla). Tiene prioridad sobre lo guardado
        -- en biologicos_params.multiplo_pedido, que puede estar mal capturado.
        select * from (values
            ('BCG', 10), ('HEPATITIS B', 10), ('HEXAVALENTE', 1), ('DPT', 10),
            ('ROTAVIRUS', 1), ('NEUMOCOCICA 13', 1), ('SRP', 1), ('SR', 10),
            ('VPH', 1), ('VARICELA', 1), ('HEPATITIS A', 1), ('TD', 10),
            ('TDPA', 1), ('INFLUENZA', 10), ('VSR', 1)
        ) as t(biologico, valor)
    ),
    grid as (
        select u.clues, u.unidad, u.municipio, b.biologico, m.mes
        from unidades_activas u
        cross join bio_lista b
        cross join meses m
    ),
    consumo_mensual_crudo as (
        select
            g.clues, g.unidad, g.municipio, g.biologico, g.mes,
            coalesce(sum(r.valor), 0)::numeric as total_dosis_crudo,
            (extract(day from (make_date(p_anio, g.mes, 1) + interval '1 month - 1 day'))::numeric / 7.0) as semanas_del_mes
        from grid g
        left join biologico_sis_variable_mapping map on map.biologico = g.biologico
        left join registros_sis r
            on r.clues = g.clues
            and r.variable_sis = map.variable_sis
            and r.anio = p_anio
            and r.mes = g.mes
        group by g.clues, g.unidad, g.municipio, g.biologico, g.mes
    ),
    medianas as (
        select
            clues, biologico,
            percentile_cont(0.5) within group (order by total_dosis_crudo) as mediana_mensual
        from consumo_mensual_crudo
        group by clues, biologico
    ),
    -- Guardarraíl contra datos atípicos: ningún mes puede pesar más de 4x la mediana
    -- de esa misma unidad+biológico (o mediana+50 si la mediana es muy baja).
    candidato_atipico as (
        select
            c.clues, c.unidad, c.municipio, c.biologico, c.mes, c.semanas_del_mes,
            c.total_dosis_crudo,
            (c.total_dosis_crudo > greatest(md.mediana_mensual * v_winsor_factor, md.mediana_mensual + v_winsor_piso_suma)) as pico_aislado,
            greatest(md.mediana_mensual * v_winsor_factor, md.mediana_mensual + v_winsor_piso_suma) as tope_individual
        from consumo_mensual_crudo c
        join medianas md on md.clues = c.clues and md.biologico = c.biologico
    ),
    -- Evento generalizado: si el mismo mes está "disparado" en muchas unidades a la
    -- vez para el mismo biológico (>=15%), es un evento real (brote/campaña, ej.
    -- sarampión disparando SR/SRP) -- no se recorta ni se marca atípico en ese caso.
    eventos_generalizados as (
        select
            biologico, mes,
            (count(*) filter (where pico_aislado))::numeric / greatest(count(*), 1) as fraccion_con_pico
        from candidato_atipico
        group by biologico, mes
    ),
    consumo_mensual as (
        select
            ca.clues, ca.unidad, ca.municipio, ca.biologico, ca.mes, ca.semanas_del_mes,
            case
                when eg.fraccion_con_pico >= v_evento_generalizado_umbral then ca.total_dosis_crudo
                else least(ca.total_dosis_crudo, ca.tope_individual)
            end as total_dosis,
            (ca.pico_aislado and eg.fraccion_con_pico < v_evento_generalizado_umbral) as fue_recortado
        from candidato_atipico ca
        join eventos_generalizados eg on eg.biologico = ca.biologico and eg.mes = ca.mes
    ),
    stats_semanales as (
        select
            clues, unidad, municipio, biologico,
            avg(total_dosis / semanas_del_mes) as media_semanal,
            var_pop(total_dosis / semanas_del_mes) as varianza_semanal,
            avg(semanas_del_mes) as semanas_promedio_mes,
            min(total_dosis) as consumo_min_mes,
            max(total_dosis) as consumo_max_mes,
            bool_or(fue_recortado) as dato_atipico_detectado
        from consumo_mensual
        group by clues, unidad, municipio, biologico
    ),
    -- Desabasto comprobado: directo de la captura SEMANAL real de existencia
    -- (biologicos_existencia, tabla ancha con una columna por biológico), NO de
    -- comparar aplicaciones contra lo pedido (esa señal se contamina con errores
    -- de captura). Una semana en cero solo cuenta si ADEMÁS hubo consumo real ese
    -- mes (evidencia de demanda real, no solo "nadie lo está usando").
    existencia_semanal as (
        select
            b.biologico,
            e.clues,
            e.fecha,
            (to_jsonb(e) ->> lower(replace(b.biologico, ' ', '_')))::numeric as existencia_valor,
            extract(year from e.fecha)::int as anio_semana,
            extract(month from e.fecha)::int as mes_semana,
            row_number() over (partition by e.clues, b.biologico order by e.fecha desc) as rn
        from biologicos_existencia e
        cross join bio_lista b
        where exists (select 1 from unidades_activas ua where ua.clues = e.clues)
    ),
    existencia_evaluada as (
        select * from existencia_semanal where rn <= v_semanas_evaluadas
    ),
    existencia_con_consumo as (
        select
            ee.clues, ee.biologico, ee.existencia_valor,
            coalesce(cm.total_dosis_crudo, 0) as consumo_del_mes
        from existencia_evaluada ee
        left join consumo_mensual_crudo cm
            on cm.clues = ee.clues
            and cm.biologico = ee.biologico
            and cm.mes = ee.mes_semana
            and ee.anio_semana = p_anio
    ),
    brecha as (
        select
            clues, biologico,
            count(*) filter (where existencia_valor = 0 and consumo_del_mes > 0) as semanas_en_cero_recientes,
            count(*) filter (where existencia_valor is not null) as capturas_validas
        from existencia_con_consumo
        group by clues, biologico
    ),
    calculado as (
        select
            s.clues, s.unidad, s.municipio, s.biologico,
            s.media_semanal, s.varianza_semanal, s.semanas_promedio_mes,
            s.consumo_min_mes, s.consumo_max_mes, s.dato_atipico_detectado,
            case when coalesce(b.capturas_validas, 0) >= v_min_capturas_validas
                 then coalesce(b.semanas_en_cero_recientes, 0)
                 else 0
            end as ciclos_insuficientes_recientes,
            (p_nivel_servicio + (
                least(coalesce(b.semanas_en_cero_recientes, 0), v_semanas_evaluadas)::numeric
                / v_semanas_evaluadas * v_z_bump_maximo
            )) as z_efectivo,
            (s.semanas_promedio_mes + p_lead_time_semanas) as semanas_cobertura
        from stats_semanales s
        left join brecha b on b.clues = s.clues and b.biologico = s.biologico
    ),
    objetivo as (
        select
            c.*,
            sqrt(greatest(0,
                (c.semanas_cobertura * c.varianza_semanal)
                + (c.media_semanal * c.media_semanal * p_lead_time_std_semanas * p_lead_time_std_semanas)
            )) as desviacion_combinada
        from calculado c
    ),
    resultado as (
        select
            o.clues, o.unidad, o.municipio, o.biologico, o.ciclos_insuficientes_recientes, o.dato_atipico_detectado,
            greatest(0::numeric, (o.media_semanal * o.semanas_cobertura) + (o.z_efectivo * o.desviacion_combinada)) as promedio_dosis_objetivo,
            o.consumo_min_mes, o.consumo_max_mes
        from objetivo o
    ),
    con_multiplo as (
        select
            r.*,
            coalesce(dm.valor, bp.multiplo_pedido, 1) as multiplo_pedido,
            coalesce(bp.promedio_frascos, 0) as promedio_frascos_actual,
            coalesce(bp.min_dosis, 0) as min_dosis_actual,
            coalesce(bp.max_dosis, 0) as max_dosis_actual
        from resultado r
        left join biologicos_params bp on bp.clues = r.clues and bp.biologico = r.biologico
        left join default_multiplo dm on dm.biologico = r.biologico
    ),
    final_calc as (
        select
            clues, unidad, municipio, biologico, ciclos_insuficientes_recientes, dato_atipico_detectado,
            ceil(promedio_dosis_objetivo / multiplo_pedido)::numeric as promedio_frascos_sugerido,
            greatest(v_min_dosis_floor, round(consumo_min_mes * v_buffer_multiplier))::integer as min_dosis_sugerido,
            round(consumo_max_mes * v_buffer_multiplier)::integer as max_dosis_base,
            promedio_dosis_objetivo,
            promedio_frascos_actual, min_dosis_actual, max_dosis_actual
        from con_multiplo
    ),
    con_max_final as (
        select
            f.*,
            -- El Máximo nunca queda por debajo del propio objetivo de Promedio (el
            -- Promedio cubre varias semanas de cobertura y puede superar el máximo
            -- histórico mensual).
            greatest(f.min_dosis_sugerido, f.max_dosis_base, round(f.promedio_dosis_objetivo)::integer) as max_dosis_sugerido
        from final_calc f
    )
    insert into biologicos_params_sugeridos (
        clues, unidad, municipio, biologico,
        promedio_frascos_sugerido, min_dosis_sugerido, max_dosis_sugerido,
        promedio_frascos_actual, min_dosis_actual, max_dosis_actual,
        ciclos_insuficientes_recientes, tipo_cambio, dato_atipico_detectado, periodo_evaluado, anio_evaluado
    )
    select
        clues, unidad, municipio, biologico,
        promedio_frascos_sugerido, min_dosis_sugerido, max_dosis_sugerido,
        promedio_frascos_actual, min_dosis_actual, max_dosis_actual,
        ciclos_insuficientes_recientes,
        case
            when dato_atipico_detectado then 'DATO_ATIPICO_REVISAR'
            when promedio_frascos_sugerido > promedio_frascos_actual then 'RIESGO_DESABASTO'
            when promedio_frascos_sugerido < promedio_frascos_actual then 'POSIBLE_SOBREABASTO'
            else 'SIN_CAMBIO_RELEVANTE'
        end,
        dato_atipico_detectado,
        'Enero a mes ' || v_last_month || ' de ' || p_anio,
        p_anio
    from con_max_final
    -- Alcance dirigido: SOLO unidades con evidencia real de desabasto recurrente,
    -- no un reemplazo universal del cálculo de parámetros.
    where ciclos_insuficientes_recientes > 0
      and (
        promedio_frascos_sugerido <> promedio_frascos_actual
        or min_dosis_sugerido <> min_dosis_actual
        or max_dosis_sugerido <> max_dosis_actual
        or dato_atipico_detectado
      )
    on conflict (clues, biologico) do update set
        unidad = excluded.unidad,
        municipio = excluded.municipio,
        promedio_frascos_sugerido = excluded.promedio_frascos_sugerido,
        min_dosis_sugerido = excluded.min_dosis_sugerido,
        max_dosis_sugerido = excluded.max_dosis_sugerido,
        promedio_frascos_actual = excluded.promedio_frascos_actual,
        min_dosis_actual = excluded.min_dosis_actual,
        max_dosis_actual = excluded.max_dosis_actual,
        ciclos_insuficientes_recientes = excluded.ciclos_insuficientes_recientes,
        tipo_cambio = excluded.tipo_cambio,
        dato_atipico_detectado = excluded.dato_atipico_detectado,
        periodo_evaluado = excluded.periodo_evaluado,
        anio_evaluado = excluded.anio_evaluado,
        created_at = now();

    get diagnostics v_count = row_count;

    -- Notificación de aprobación pendiente: UNA por municipio afectado. NUNCA por
    -- rol genérico -- target_scope='ROLE' no tiene caso en el filtro de
    -- notificaciones del cliente (main.js) y caía en el fallback "le llega a
    -- todos" (bug real detectado en producción y corregido aquí).
    for v_muni_rec in
        select
            municipio,
            count(*) as total,
            count(*) filter (where tipo_cambio = 'RIESGO_DESABASTO') as n_riesgo,
            count(*) filter (where tipo_cambio = 'POSIBLE_SOBREABASTO') as n_sobre,
            count(*) filter (where tipo_cambio = 'DATO_ATIPICO_REVISAR') as n_atipico
        from biologicos_params_sugeridos
        where anio_evaluado = p_anio
          and municipio is not null
        group by municipio
    loop
        v_titulo := 'Sugerencias de reabasto pendientes de aprobación';
        v_mensaje := format(
            'El motor de reabasto inteligente encontró %s sugerencia(s) para %s en %s: %s con riesgo de desabasto, %s con posible sobreabasto, %s con dato atípico a revisar. Ve a Administración > Parámetros > Sugerencias Pendientes para revisar y aplicar.',
            v_muni_rec.total, p_anio, v_muni_rec.municipio, v_muni_rec.n_riesgo, v_muni_rec.n_sobre, v_muni_rec.n_atipico
        );
        v_notif_id := 'REABASTO:' || p_anio || ':' || v_muni_rec.municipio || ':' || extract(epoch from now())::bigint;

        insert into notificaciones (
            id, created_ts, created_date, from_usuario, from_rol,
            target_scope, target_municipio, title, message, type, status
        ) values (
            v_notif_id, now(), current_date, 'MOTOR_REABASTO', 'SISTEMA',
            'MUNICIPIO', v_muni_rec.municipio, v_titulo, v_mensaje, 'PARAMS_PENDIENTES', 'UNREAD'
        );

        -- JURISDICCIONAL: ve todos los municipios.
        insert into notificaciones_perfil (id, notificacion_id, usuario, status, deleted)
        select gen_random_uuid(), v_notif_id, p.usuario, 'UNREAD', false
        from perfiles p
        where upper(p.rol) = 'JURISDICCIONAL'
        on conflict do nothing;

        -- MUNICIPAL: solo quien tenga ESTE municipio entre los suyos (nunca UNIDAD).
        insert into notificaciones_perfil (id, notificacion_id, usuario, status, deleted)
        select gen_random_uuid(), v_notif_id, p.usuario, 'UNREAD', false
        from perfiles p
        where upper(p.rol) = 'MUNICIPAL'
          and (
              '*' = any(p.municipios_allowed)
              or v_muni_rec.municipio = any(p.municipios_allowed)
              or v_muni_rec.municipio = p.municipio_asignado
              or v_muni_rec.municipio = p.municipio
              or v_muni_rec.municipio = any(string_to_array(coalesce(p.municipio_asignado, ''), ','))
              or v_muni_rec.municipio = any(string_to_array(coalesce(p.municipio, ''), ','))
          )
        on conflict do nothing;
    end loop;

    return v_count;
end;
$$;

comment on function public.calcular_reabasto_pendientes is
    'Motor autónomo de reabasto inteligente: calcula Promedio/Mínimo/Máximo sugeridos por unidad+biológico (solo con evidencia real de desabasto recurrente) y los deja en biologicos_params_sugeridos para aprobación humana. Nunca escribe en biologicos_params.';


-- ----------------------------------------------------------------------------
-- 4. Ventana de captura (puerto exacto de main.js: getEasterDate/isMexicanHoliday/
--    isBusinessDay/getBioCaptureWindow) -- para que el cron calcule la MISMA fecha
--    que ya ve el usuario en el cliente.
-- ----------------------------------------------------------------------------
create or replace function public.sirevaq_easter_date(p_year integer)
returns date
language plpgsql
immutable
as $$
declare
    a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
    v_mes int; v_dia int;
begin
    a := p_year % 19;
    b := p_year / 100;
    c := p_year % 100;
    d := b / 4;
    e := b % 4;
    f := (b + 8) / 25;
    g := (b - f + 1) / 3;
    h := (19*a + b - d - g + 15) % 30;
    i := c / 4;
    k := c % 4;
    l := (32 + 2*e + 2*i - h - k) % 7;
    m := (a + 11*h + 22*l) / 451;
    v_mes := (h + l - 7*m + 114) / 31;
    v_dia := ((h + l - 7*m + 114) % 31) + 1;
    return make_date(p_year, v_mes, v_dia);
end;
$$;

create or replace function public.sirevaq_is_mexican_holiday(p_date date)
returns boolean
language plpgsql
immutable
as $$
declare
    v_year int := extract(year from p_date)::int;
    v_month int := extract(month from p_date)::int;
    v_day int := extract(day from p_date)::int;
    v_dow int := extract(dow from p_date)::int;
    v_easter date;
begin
    if (v_month=1 and v_day=1) or (v_month=5 and v_day=1) or (v_month=9 and v_day=16) or (v_month=12 and v_day=25) then
        return true;
    end if;
    if v_month=2 and v_dow=1 and v_day<=7 then return true; end if;
    if v_month=3 and v_dow=1 and v_day between 15 and 21 then return true; end if;
    if v_month=11 and v_dow=1 and v_day between 15 and 21 then return true; end if;

    v_easter := sirevaq_easter_date(v_year);
    if p_date = (v_easter - 3) or p_date = (v_easter - 2) then return true; end if;

    return false;
end;
$$;

create or replace function public.sirevaq_is_business_day(p_date date)
returns boolean
language sql
immutable
as $$
    select extract(dow from p_date)::int not in (0,6) and not public.sirevaq_is_mexican_holiday(p_date);
$$;

create or replace function public.sirevaq_bio_capture_window(p_anio integer, p_mes integer)
returns table(inicio date, objetivo date, fin date)
language plpgsql
immutable
as $$
declare
    v_target date := make_date(p_anio, p_mes, 22);
    v_start date;
    v_end date;
begin
    while not public.sirevaq_is_business_day(v_target) loop
        v_target := v_target - 1;
    end loop;
    v_start := v_target - 1;
    while not public.sirevaq_is_business_day(v_start) loop
        v_start := v_start - 1;
    end loop;
    v_end := v_target + 1;
    while not public.sirevaq_is_business_day(v_end) loop
        v_end := v_end + 1;
    end loop;
    inicio := v_start; objetivo := v_target; fin := v_end;
    return next;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. Disparo automático: cron diario 3 días antes de que abra la ventana
-- ----------------------------------------------------------------------------
create or replace function public.sirevaq_bio_reabasto_scheduler()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now date := current_date;
    v_year int := extract(year from v_now)::int;
    v_month int := extract(month from v_now)::int;
    v_next_year int;
    v_next_month int;
    v_window record;
    v_dias_antes constant int := 3;
begin
    select * into v_window from sirevaq_bio_capture_window(v_year, v_month);
    if v_now between (v_window.inicio - v_dias_antes) and (v_window.inicio - 1) then
        perform calcular_reabasto_pendientes(v_year);
    end if;

    if v_month = 12 then
        v_next_year := v_year + 1;
        v_next_month := 1;
    else
        v_next_year := v_year;
        v_next_month := v_month + 1;
    end if;

    select * into v_window from sirevaq_bio_capture_window(v_next_year, v_next_month);
    if v_now between (v_window.inicio - v_dias_antes) and (v_window.inicio - 1) then
        perform calcular_reabasto_pendientes(v_next_year);
    end if;
end;
$$;

comment on function public.sirevaq_bio_reabasto_scheduler is
    'Disparador diario (pg_cron) del motor de reabasto inteligente: recalcula 3 días antes de que abra la ventana de captura del día 22 (mes actual o siguiente).';

-- Cron diario a las 08:00 UTC, mismo estilo que los jobs ya existentes en este
-- proyecto (limpieza de notificaciones, recordatorios de email, etc.).
select cron.schedule(
    'sirevaq-bio-reabasto-diario',
    '0 8 * * *',
    $$select public.sirevaq_bio_reabasto_scheduler();$$
);

-- Evento: además del cron, RDAParser.rpcUpsert() en rda_parser.js llama a
-- calcular_reabasto_pendientes() vía RPC justo después de cargar un CSV nuevo
-- (best-effort, no bloquea la carga si falla).
