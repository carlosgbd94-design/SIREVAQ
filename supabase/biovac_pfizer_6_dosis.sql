-- COVID-19 Pfizer: el frasco es de 6 dosis (no de 10). Confirmado por el usuario (2026-10-07) y es el factor que
-- usa la plantilla real del concentrado municipal ("SIS QUERETARO <MES>.xlsx", hoja SEGUIMIENTO DE BIOLOGICO).
-- Solo cambia el valor por omisión del catálogo: lo que ya está guardado (existencia_final_frascos de los renglones
-- de enero a mayo 2026) NO se recalcula aquí; el trigger lo recalcula cuando se edite cada renglón.
update public.biovac_catalogo_biologicos
   set dosis_por_frasco = 6
 where clave = 'COVID_PFIZER'
   and dosis_por_frasco is distinct from 6;
