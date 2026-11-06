-- La vacuna VPH que se aplica es Nonavalente (9 tipos), no Bivalente / Tetravalente.
-- Aplicada en producción (migración vph_nonavalente_nombre).
update public.biovac_catalogo_biologicos
   set nombre_excel = E'V.P.H.\nNonavalente'
 where clave = 'VPH' and nombre_excel = E'V.P.H.\nBivalente / Tetravalente';
