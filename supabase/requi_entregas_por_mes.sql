-- ============================================================================
-- Requisiciones -- varias entregas por mes.
-- Cada entrega es su propia requisición (mismo año/mes, distinto número). Reemplaza el
-- único (anio, mes) de requi_schema.sql por (anio, mes, entrega). `etiqueta` es un nombre
-- opcional ("Esquema básico", "Influenza").
-- ============================================================================
alter table requi_requisiciones add column if not exists entrega int not null default 1 check (entrega >= 1);
alter table requi_requisiciones add column if not exists etiqueta text;
alter table requi_requisiciones drop constraint if exists requi_requisiciones_anio_mes_key;
drop index if exists requi_requisiciones_anio_mes_key;
create unique index if not exists requi_requisiciones_anio_mes_entrega_key on requi_requisiciones (anio, mes, entrega);
