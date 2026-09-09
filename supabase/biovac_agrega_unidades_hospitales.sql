-- Extiende el puente Requisiciones -> Movimiento de Biológico
-- (ofrecerCargaDesdeRequisiciones en biovac_ui.js) a Hospitales. Ese puente
-- ya cruza por `biovac_unidades.municipio = requi_distribucion_municipio.
-- municipio` sin ningún código extra -- solo hacía falta que existiera la
-- fila. Los hospitales son destinos de primer nivel en Requisiciones (no
-- dependen de ningún municipio), con clave literal 'NHG'/'HENM' en
-- requi_distribucion_municipio.municipio (ver DESTINOS en
-- requisiciones_ui.js) -- se usa la misma clave aquí para que el cruce
-- funcione tal cual.
--
-- `clues` sigue el mismo patrón sintético ya usado para los 4 municipios en
-- producción (JS1-<clave>, no un CLUES real -- Biovac trabaja a nivel
-- municipio/destino, no unidad de salud, así que nunca hubo un CLUES real
-- de por medio para ninguna de las filas existentes tampoco).
--
-- NOTA: para que alguien pueda operar estos 2 destinos en Biovac (crear
-- movimientos, capturar renglones), su perfil necesita 'NHG' y/o 'HENM'
-- en perfiles.municipio_asignado (es una lista separada por comas -- ver
-- biovac_rls_produccion.sql) -- esta migración solo crea el destino, no
-- asigna a nadie como responsable.
insert into biovac_unidades (jurisdiccion_id, clues, nombre, municipio, activo)
select j.id, v.clues, v.nombre, v.municipio, true
from biovac_jurisdicciones j,
     (values
       ('JS1-NHG', 'Nuevo Hospital General', 'NHG'),
       ('JS1-HENM', 'HENM', 'HENM')
     ) as v(clues, nombre, municipio)
where j.clave = 'JS1'
on conflict (clues) do nothing;
