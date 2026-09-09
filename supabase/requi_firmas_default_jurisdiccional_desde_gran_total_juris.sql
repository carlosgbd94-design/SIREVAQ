-- Nombres reales extraídos de "Gran total Juris.xlsx" (hoja GRAN TOTAL
-- JURIS, celdas A72/H72) para el nivel jurisdiccional: aquí los roles se
-- invierten respecto al nivel municipal -- la jurisdicción es quien RECIBE
-- del almacén estatal (Leslie López Enciso), y quien ENTREGA es personal
-- del almacén estatal (Jesús Fernando Molina Reyes). Solo se llenan los
-- campos vacíos (coalesce), sin tocar elaboro_nombre="LESLIE LOPEZ" que ya
-- había tecleado el propio usuario real.
update requi_firmas
set entrega_nombre = coalesce(entrega_nombre, 'ENF. JESÚS FERNANDO MOLINA REYES'),
    recibe_nombre = coalesce(recibe_nombre, 'LIC. LESLIE LÓPEZ ENCISO')
where nivel = 'JURISDICCIONAL' and destino = 'JURISDICCION';
