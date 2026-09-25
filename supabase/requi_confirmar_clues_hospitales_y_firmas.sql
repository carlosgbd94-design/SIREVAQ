-- CORREGIDO (2026-09-24, confirmado por el usuario): las CLUES de los dos hospitales generales son
-- distintas --
--   * H.G.  (Hospital General de Querétaro, el VIEJO, ya no existe): QTSSA001752 -- debe quedar inactivo.
--   * N.H.G. / NHGQ (Nuevo Hospital General de Querétaro, lo reemplazó): QTSSA002901.
-- (Una versión anterior de este archivo asignaba QTSSA002901 al H.G. viejo por una etiqueta equivocada
-- en public.unidades y en la hoja DATOS de SINBA-VER_26_2026.xlsx; ambas ya se corrigieron.)
update requi_unidades set clues = 'QTSSA001752', activo = false
where municipio = 'HOSPITALES' and nombre = 'H.G.';
update requi_unidades set clues = 'QTSSA002901', activo = true
where municipio = 'HOSPITALES' and nombre = 'N.H.G.';

-- Nota: este archivo también agregó columnas de firma (elaboro_/autorizo_)
-- a requi_requisiciones -- se revirtió en requi_firmas_por_destino.sql: el
-- usuario señaló que Elaboró/Autorizó/Entrega/Recibe cambian por nivel y
-- destino (jurisdicción, cada municipio, cada unidad), así que ahora viven
-- en su propia tabla requi_firmas en vez de una sola vez por mes.
