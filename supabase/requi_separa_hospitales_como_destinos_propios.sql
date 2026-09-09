-- ============================================================================
-- El usuario pidió separar los hospitales: cada uno lleva su propia
-- requisición, no como "unidades" dentro de un bucket combinado
-- 'HOSPITALES'. Se reemplaza ese bucket por 3 destinos de primer nivel,
-- hermanos de los 4 municipios reales (mismo nivel que CORREGIDORA,
-- HUIMILPAN, MARQUES, QUERETARO en requi_distribucion_municipio):
--   HG   = Hospital General de Querétaro (antes unidad "H.G.")
--   NHG  = Nuevo Hospital General de Querétaro (antes unidad "N.H.G.")
--   HENM = Hospital de Especialidades del Niño y la Mujer (antes "HENM")
-- Como cada hospital YA es el destino final (no tiene unidades debajo), se
-- elimina de requi_unidades -- no hay Paso 3 para hospitales.
-- ============================================================================

delete from requi_unidades where municipio = 'HOSPITALES';

alter table requi_unidades drop constraint requi_unidades_municipio_check;
alter table requi_unidades add constraint requi_unidades_municipio_check
  check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO'));

alter table requi_distribucion_municipio drop constraint requi_distribucion_municipio_municipio_check;
alter table requi_distribucion_municipio add constraint requi_distribucion_municipio_municipio_check
  check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO','HG','NHG','HENM'));
