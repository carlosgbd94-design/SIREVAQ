-- Nombres reales extraídos de las requisiciones de ejemplo de septiembre
-- (SEPTIEMBRE/Municipio *.xlsx, hoja GENERAL, celdas A72/H72): Entrega es la
-- misma persona (jurisdicción) en los 4 municipios; Recibe cambia por
-- municipio y coincide con el usuario real asignado a cada uno en perfiles
-- (ALMA_JS1 -> Corregidora/Huimilpan, JULIA_MENDOZA -> Marqués,
-- ANA_MARÍA_RAMÍREZ -> Querétaro). Son valores default editables, no fijos.
insert into requi_firmas (nivel, destino, entrega_nombre, recibe_nombre) values
  ('MUNICIPAL', 'CORREGIDORA', 'LIC. LESLIE LÓPEZ ENCISO', 'ENF. ALMA DELIA HERNÁNDEZ ESQUIVEL'),
  ('MUNICIPAL', 'HUIMILPAN',   'LIC. LESLIE LÓPEZ ENCISO', 'ENF. ALMA DELIA HERNÁNDEZ ESQUIVEL'),
  ('MUNICIPAL', 'MARQUES',     'LIC. LESLIE LÓPEZ ENCISO', 'L.E ANA JULIA MENDOZA HERNANDEZ'),
  ('MUNICIPAL', 'QUERETARO',   'LIC. LESLIE LÓPEZ ENCISO', 'MTRA. ANA MARÍA RAMÍREZ MUNGUÍA')
on conflict (nivel, destino) do update set
  entrega_nombre = coalesce(requi_firmas.entrega_nombre, excluded.entrega_nombre),
  recibe_nombre = coalesce(requi_firmas.recibe_nombre, excluded.recibe_nombre);
