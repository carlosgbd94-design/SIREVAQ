-- Confirma CLUES de H.G. (Hospital General de Querétaro), verificada contra
-- public.unidades (QTSSA002901, ahí marcada inactiva por motivos ajenos a la
-- distribución de vacunas -- en la requisición real de septiembre 2026 sigue
-- siendo destinatario activo). N.H.G. queda sin CLUES: no existe registro en
-- ninguna tabla de SIREVAQ (unidades, unidades_medicas) -- es un
-- establecimiento nuevo, su CLUES oficial debe confirmarla el usuario.
update requi_unidades set clues = 'QTSSA002901', activo = true
where municipio = 'HOSPITALES' and nombre = 'H.G.';

-- Nota: este archivo también agregó columnas de firma (elaboro_/autorizo_)
-- a requi_requisiciones -- se revirtió en requi_firmas_por_destino.sql: el
-- usuario señaló que Elaboró/Autorizó/Entrega/Recibe cambian por nivel y
-- destino (jurisdicción, cada municipio, cada unidad), así que ahora viven
-- en su propia tabla requi_firmas en vez de una sola vez por mes.
