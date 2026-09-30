-- ============================================================================
-- Requisiciones -- catálogo según el formato oficial nuevo (Octubre 2026):
--   * Ya no existen Neumo 23 (146) ni Sabin (3802): se desactivan (no se borran,
--     para conservar los meses ya capturados).
--   * Entra Neumo 20 (6508). Hepatitis A pasa a 6187 y Varicela a …6056-01.
--   * `orden` = renglón del formato (fila = 12 + 2*orden en la plantilla).
-- ============================================================================
insert into requi_catalogo_biologicos (clave_articulo, codigo_articulo, nombre, presentacion, forma, orden)
values ('25311.020-000-6508-01', '6508', 'VACUNA ANTINEUMOCOCCICA 20', 'UNIDOSIS', 'Susp. Inyectable (Fco. Ampula)', 1)
on conflict (clave_articulo) do nothing;

update requi_catalogo_biologicos set clave_articulo = '25311.020-000-6187-00', codigo_articulo = '6187' where codigo_articulo = '3825';
update requi_catalogo_biologicos set clave_articulo = '25311.020-000-6056-01' where codigo_articulo = '6056';
update requi_catalogo_biologicos set activo = false, orden = 101 where codigo_articulo = '146';
update requi_catalogo_biologicos set activo = false, orden = 102 where codigo_articulo = '3802';

update requi_catalogo_biologicos c set orden = v.orden
from (values
  ('6508',1),('148',2),('150',3),('6135',4),('2526',5),('6187',6),('3800',7),('3801',8),('3805',9),
  ('3808',10),('3810',11),('6056',12),('3820',13),('3821',14),('6317',15),('3832',16),('6501',17),
  ('2',18),('6502',19),('6506',20),('6509',21)
) as v(codigo, orden)
where c.codigo_articulo = v.codigo;
