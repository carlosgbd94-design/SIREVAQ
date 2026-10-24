-- ============================================================================
-- Retención escalonada con resúmenes mensuales (SIREVAQ)
-- ============================================================================
-- Espejo del estado YA APLICADO en Supabase (proyecto utclfqjietlxzlorxhrs, 2026-10-23) vía las migraciones
-- respaldo_previo_retencion_escalonada, retencion_escalonada_resumenes_mensuales y
-- cron_autolimpieza_historicos_escalonada. Documenta el estado final; no es un script para volver a correr.
--
-- Por qué: el cron anterior "autolimpieza-historicos" (mensual, día 1) fallaba cada mes con un error de sintaxis
-- (BEGIN..END suelto, sin DO) y nunca borró nada. Habría borrado de golpe todo lo anterior al mes pasado, o sea
-- el historial que usan las estadísticas y el motor de proyección.
--
-- Política:
--   biologicos_pedido / biologicos_existencia / consumibles : 13 meses de detalle (compara contra el mismo mes del año pasado)
--   existencia_detalle (por lote)                           : 12 meses
--   registros_sis (SIS)                                     : 36 meses (ya viene resumido por mes: una fila por unidad/variable/mes)
-- Los meses cerrados de pedidos, existencia y consumibles se resumen (por mes y unidad) ANTES de borrar.
-- Borrado en lotes con tope por corrida (5,000 filas por tabla; 20,000 en SIS). Cron diario 03:30.
--
-- Pendiente de decidir (no aplicado): en registros_sis el 91 % de las filas tienen valor = 0 (431,471 de 474,532).
-- Quitarlas bajaría la tabla de ~88 MB a ~8 MB, pero cambia la semántica «fila presente = dato cargado»
-- (get_registros_sis_active_months usa DISTINCT mes), por eso no se tocó.
--
-- Respaldo previo: esquema `respaldo` (no expuesto por PostgREST) con copias *_20261023 de pedidos,
-- existencia, existencia por lote y consumibles. Se puede borrar cuando ya no haga falta.
-- ============================================================================

create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;
-- create table respaldo.biologicos_pedido_20261023 as select * from public.biologicos_pedido;   (idem existencia, detalle, consumibles)

-- 1. Resúmenes mensuales -----------------------------------------------------
create table if not exists public.resumen_pedidos_mensual (
    clues text not null,
    biologico text not null,
    mes date not null,
    tipo_pedido text not null default 'MENSUAL',
    unidad text,
    municipio text,
    pedido_frascos numeric not null default 0,
    existencia_frascos numeric,
    promedio_frascos numeric,
    min_dosis integer,
    max_dosis integer,
    n_registros integer not null default 0,
    sin_pedido boolean not null default false,
    actualizado timestamptz not null default now(),
    primary key (clues, biologico, mes, tipo_pedido)
);
create index if not exists idx_res_ped_mes on public.resumen_pedidos_mensual (mes);

create table if not exists public.resumen_existencia_mensual (
    clues text not null,
    mes date not null,
    unidad text,
    municipio text,
    n_capturas integer not null default 0,
    n_con_ceros integer not null default 0,
    n_sin_movimiento integer not null default 0,
    ultima_fecha date,
    por_biologico jsonb not null default '{}'::jsonb,   -- { bcg: {min,max,prom,ceros,ultima}, ... }
    actualizado timestamptz not null default now(),
    primary key (clues, mes)
);
create index if not exists idx_res_exi_mes on public.resumen_existencia_mensual (mes);

create table if not exists public.resumen_consumibles_mensual (
    clues text not null,
    mes date not null,
    unidad text,
    municipio text,
    n_capturas integer not null default 0,
    n_sin_movimiento integer not null default 0,
    ultima_fecha date,
    por_insumo jsonb not null default '{}'::jsonb,
    actualizado timestamptz not null default now(),
    primary key (clues, mes)
);
create index if not exists idx_res_con_mes on public.resumen_consumibles_mensual (mes);

create table if not exists public.limpieza_historicos_log (
    id bigserial primary key,
    ejecutado timestamptz not null default now(),
    tabla text not null,
    corte date not null,
    filas integer not null,
    simulacion boolean not null default false
);

-- Solo lectura para Admin y Jurisdicción; las escribe únicamente la función (security definer).
alter table public.resumen_pedidos_mensual enable row level security;
alter table public.resumen_existencia_mensual enable row level security;
alter table public.resumen_consumibles_mensual enable row level security;
alter table public.limpieza_historicos_log enable row level security;
-- (política "RLS_<tabla>_Read": select si perfiles.rol en ('ADMIN','JURISDICCIONAL'))

-- 2. Índices que faltaban (la app filtra pedidos por unidad y fecha programada)
create index if not exists idx_ped_clues_fecha_prog on public.biologicos_pedido (clues, fecha_pedido_programada);
create index if not exists idx_ped_fecha_prog on public.biologicos_pedido (fecha_pedido_programada);

-- 3. public.refrescar_resumenes_mensuales(): upsert idempotente de los meses CERRADOS (< mes actual).
--    Pedidos: por (unidad, biológico, mes, tipo) con suma de pedido y último existencia/promedio/mín/máx.
--    Existencia y consumibles: por (unidad, mes) con n capturas, con ceros, sin movimiento y, por biológico/insumo,
--    min/max/promedio/ceros/última (se desarma la fila con jsonb_each_text(to_jsonb(fila) - columnas no numéricas)).
--    Definición completa: ver la migración retencion_escalonada_resumenes_mensuales.

-- 4. public.autolimpieza_historicos(p_dry_run boolean default false) returns table(tabla, corte, filas)
--    Siempre llama primero a refrescar_resumenes_mensuales(); luego borra por lotes lo anterior al corte
--    (13 / 13 / 13 / 12 / 36 meses) y deja una fila en limpieza_historicos_log por tabla con borrados.
--    p_dry_run = true solo cuenta. Ejecutable solo por service_role (y el cron como postgres).

-- 5. Cron (reemplaza el jobid 8 roto)
-- select cron.unschedule('autolimpieza-historicos');
-- select cron.schedule('autolimpieza-historicos', '30 3 * * *', 'select public.autolimpieza_historicos();');

-- ============================================================================
-- RPC para la «Proyección inteligente» (param_calculator.js) — migración rpc_sis_mensual_sin_ceros
-- ============================================================================
-- get_registros_sis_mensual_nz(p_anio_desde, p_anio_hasta): productividad SIS mensual de uno o varios años SIN las filas
-- en cero (el 91 % de registros_sis son ceros y no aportan a ninguna suma): 43,061 filas para 2025-2026 en vez de 474,532
-- (≈44 páginas de 1,000 en vez de ≈470). Orden estable (anio, mes, clues, variable_sis) para paginar. Solo ADMIN y
-- JURISDICCIONAL, igual que get_registros_sis_monthly. Definición completa: migración rpc_sis_mensual_sin_ceros.
