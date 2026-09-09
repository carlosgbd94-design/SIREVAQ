-- El usuario confirmó que se equivocó al pedir quitar "VACUNA
-- ANTINEUMOCOCCICA 23 1DS" (código 146): sí sigue vigente en el formato
-- oficial de requisición. Se reactiva -- nunca se había borrado, solo
-- desactivado (ver requi_firmas_cache_por_nivel_y_quita_neumo23.sql), así
-- que basta con devolver activo=true; conserva su orden=1 original (el
-- mismo lugar donde aparece en el Excel real).
update requi_catalogo_biologicos set activo = true where codigo_articulo = '146';
