-- ============================================================================
-- BioVac — Seed inicial: jurisdicción, unidades y catálogo de biológicos
--
-- Catálogo y reglas de presentación (UNIDOSIS/MULTIDOSIS/SPLIT_DOSE)
-- verificados fórmula por fórmula contra "MoViMiEnTo De BiOlOgICo 2026.xlsx"
-- (columnas N de cada bloque, hojas ENE y MAY 2026). Ver notas por bloque.
--
-- Los CLUES de las 4 unidades son PLACEHOLDER (el archivo real no los trae) —
-- deben corregirse con los CLUES reales antes de integrar con la página
-- (fase 6 del plan), donde se mapean a unidades_medicas/perfiles.
-- ============================================================================

insert into biovac_jurisdicciones (clave, nombre)
values ('JS1', 'Jurisdicción Sanitaria N°1')
on conflict (clave) do nothing;

insert into biovac_unidades (jurisdiccion_id, clues, nombre, municipio)
select j.id, v.clues, v.nombre, v.municipio
from biovac_jurisdicciones j,
     (values
       ('PENDIENTE-QUERETARO', 'Querétaro', 'Querétaro'),
       ('PENDIENTE-CORREGIDORA', 'Corregidora', 'Corregidora'),
       ('PENDIENTE-MARQUES', 'Marqués', 'Marqués'),
       ('PENDIENTE-HUIMILPAN', 'Huimilpan', 'Huimilpan')
     ) as v(clues, nombre, municipio)
where j.clave = 'JS1'
on conflict (clues) do nothing;

-- ---------------------------------------------------------------------------
-- Bloques (orden de impresión tal cual el Excel: Anverso 1-8, Reverso 1-9)
-- ---------------------------------------------------------------------------

insert into biovac_bloques_catalogo (pagina, orden, nombre_bloque) values
  ('ANVERSO', 1, 'B.C.G.'),
  ('ANVERSO', 2, 'Hepatitis B'),
  ('ANVERSO', 3, 'Hexavalente'),
  ('ANVERSO', 4, 'DPT'),
  ('ANVERSO', 5, 'Rotavirus RV1'),
  ('ANVERSO', 6, 'Neumocócica conjugada (13 valente)'),
  ('ANVERSO', 7, 'Neumocócica (23v / 20v)'),
  ('ANVERSO', 8, 'SRP Triple Viral'),
  ('REVERSO', 1, 'Antiinfluenza Estacional'),
  ('REVERSO', 2, 'SR'),
  ('REVERSO', 3, 'V.P.H.'),
  ('REVERSO', 4, 'Td'),
  ('REVERSO', 5, 'TDPa'),
  ('REVERSO', 6, 'COVID-19'),
  ('REVERSO', 7, 'Varicela'),
  ('REVERSO', 8, 'Hepatitis A'),
  ('REVERSO', 9, 'VSR')
on conflict (pagina, orden) do nothing;

-- ---------------------------------------------------------------------------
-- Catálogo de biológicos
--
-- Notas de fidelidad (fórmula real de la columna N del Excel):
--   * UNIDOSIS         -> (anterior+recibido)-(aplicadas+desechadas)
--   * MULTIDOSIS(n)    -> ((anterior+recibido)*n-(aplicadas+desechadas))/n
--   * SPLIT_DOSE       -> aplicadas = aplicadas_a/2 + aplicadas_b (idem desechadas)
--     antes de aplicar la fórmula de arriba. Verificado en Hepatitis B (x10)
--     y COVID-19 Moderna (x5).
--   * COVID-19 Pfizer usa x6 (corregido 2026-10-07; antes x10); un lote de ARF/canje
--     observado en el Excel usa x6 (probablemente presentación pediátrica)
--     — por eso dosis_por_frasco es también override-able por LOTE
--     (biovac_lotes.dosis_por_frasco_override), no solo por catálogo.
-- ---------------------------------------------------------------------------

insert into biovac_catalogo_biologicos
  (bloque_id, clave, nombre_excel, orden_en_bloque, presentacion, dosis_por_frasco, regla_especial, vigente_desde, vigente_hasta)
select b.id, v.clave, v.nombre_excel, v.orden_en_bloque, v.presentacion, v.dosis, v.regla, v.desde::date, v.hasta::date
from biovac_bloques_catalogo b
join (values
  ('ANVERSO', 1, 'BCG',            E'B.C.G.\nfrasco multidosis',                       1, 'MULTIDOSIS', 10, null,         '2000-01-01', null),
  ('ANVERSO', 2, 'HEPB',           E'Hepatitis "B" frasco multidosis',                  1, 'MULTIDOSIS', 10, 'SPLIT_DOSE', '2000-01-01', null),
  ('ANVERSO', 3, 'HEXAVALENTE',    E'Hexavalente frasco unidosis',                      1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('ANVERSO', 4, 'DPT',            E'DPT\n frasco  multidosis',                         1, 'MULTIDOSIS', 10, null,         '2000-01-01', null),
  ('ANVERSO', 5, 'ROTAVIRUS',      E'Rotavirus RV1      frasco unidosis',               1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('ANVERSO', 6, 'NEUMO_13V',      E'Neumocócica conjugada\n(13 valente)',              1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('ANVERSO', 7, 'NEUMO_23V',      E'Neumocócica polisacarida\n(23 serotipos)',         1, 'UNIDOSIS',    1, null,         '2000-01-01', '2026-04-30'),
  ('ANVERSO', 7, 'NEUMO_20V',      E'Neumocócica conjugada\n(20 valente)',              2, 'UNIDOSIS',    1, null,         '2026-05-01', null),
  ('ANVERSO', 8, 'SRP',            E'SRP \nTriple Viral frasco unidosis',               1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('REVERSO', 1, 'ANTIINFLUENZA',  E'Antiinfluenza Estacional frasco   10 dosis',       1, 'MULTIDOSIS', 10, null,         '2000-01-01', null),
  ('REVERSO', 2, 'SR',             E'SR\nfrasco multidosis',                            1, 'MULTIDOSIS', 10, null,         '2000-01-01', null),
  ('REVERSO', 3, 'VPH',            E'V.P.H.\nBivalente / Tetravalente',                 1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('REVERSO', 4, 'TD',             E'Td                   frasco                  multidosis', 1, 'MULTIDOSIS', 10, null, '2000-01-01', null),
  ('REVERSO', 5, 'TDPA',           E'TDPa\nfrasco unidosis',                            1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('REVERSO', 6, 'COVID_MODERNA',  E'COVID-19\nMODERNA',                                1, 'MULTIDOSIS',  5, 'SPLIT_DOSE', '2000-01-01', null),
  ('REVERSO', 6, 'COVID_PFIZER',   E'COVID-19\nPFIZER',                                 2, 'MULTIDOSIS', 6,  null,         '2000-01-01', null),
  ('REVERSO', 7, 'VARICELA',       'Varicela',                                          1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('REVERSO', 8, 'HEPA',           E'Hepatitis "A"',                                    1, 'UNIDOSIS',    1, null,         '2000-01-01', null),
  ('REVERSO', 9, 'VSR',            'VSR',                                               1, 'UNIDOSIS',    1, null,         '2026-05-01', null)
) as v(pagina, orden, clave, nombre_excel, orden_en_bloque, presentacion, dosis, regla, desde, hasta)
  on b.pagina = v.pagina and b.orden = v.orden
on conflict (clave) do nothing;
