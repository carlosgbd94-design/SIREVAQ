-- El usuario confirmó que el "Hospital General" viejo (HG) ya no existe --
-- solo quedan Nuevo Hospital General (NHG) y HENM como destinos hospital.
alter table requi_distribucion_municipio drop constraint requi_distribucion_municipio_municipio_check;
alter table requi_distribucion_municipio add constraint requi_distribucion_municipio_municipio_check
  check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO','NHG','HENM'));
