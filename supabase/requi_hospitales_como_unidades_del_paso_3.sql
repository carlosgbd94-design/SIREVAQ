-- ============================================================================
-- Requisiciones -- NHGQ y HENM aparecen como unidades en el paso 3.
-- Cada hospital sigue siendo un destino de primer nivel (paso 2), pero también es su
-- propia (única) unidad: lo que se le asigna en el paso 2 se le pasa solo en el paso 3
-- (requisiciones_ui.js, guardarReparto), así su requisición por unidad se puede exportar
-- y Biovac la puede precargar por CLUES.
-- ============================================================================
alter table requi_unidades drop constraint if exists requi_unidades_municipio_check;
alter table requi_unidades add constraint requi_unidades_municipio_check
  check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO','NHG','HENM'));

insert into requi_unidades (clues, nombre, municipio, activo, nombre_impresion, direccion) values
  ('QTSSA002901', 'NHGQ', 'NHG', true, 'NUEVO HOSPITAL GENERAL DE QUERÉTARO', 'Adalberto Martínez n.448, La Joya, Querétaro, Qro.'),
  ('QTSSA001740', 'HENM', 'HENM', true, 'HOSPITAL DE ESPECIALIDADES DEL NIÑO Y LA MUJER', 'Av. Luis Vega Monrroy n.410, Colinas del Cimatario, Querétaro, Qro.')
on conflict (clues) do update set municipio = excluded.municipio, activo = true,
  nombre_impresion = excluded.nombre_impresion, direccion = excluded.direccion;

-- Lo ya asignado a cada hospital en el paso 2 pasa a su unidad.
insert into requi_distribucion_unidad (requisicion_id, unidad_id, requi_biologico_id, lote_id, cantidad)
select dm.requisicion_id, u.id, dm.requi_biologico_id, dm.lote_id, dm.cantidad
from requi_distribucion_municipio dm join requi_unidades u on u.municipio = dm.municipio
where dm.municipio in ('NHG', 'HENM') and dm.cantidad > 0
on conflict (requisicion_id, unidad_id, requi_biologico_id, lote_id) do update set cantidad = excluded.cantidad;
