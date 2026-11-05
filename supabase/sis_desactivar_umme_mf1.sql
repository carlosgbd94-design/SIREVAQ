-- UMME MF1 (QTSSA012556, QUERETARO) no esta activa ni tiene usuario, pero seguia en biovac_unidades con
-- activo = true y el SIS la contaba como pendiente (35 de 36 validadas, el CSV para estadistica no se habilitaba).
-- La lista y el conteo del SIS salen de biovac_unidades.activo, asi que basta con marcarla inactiva.
-- Aplicado en produccion el 2026-11-05. Para revertir: set activo = true.
update biovac_unidades set activo = false where clues = 'QTSSA012556' and nombre = 'UMME MF1';
