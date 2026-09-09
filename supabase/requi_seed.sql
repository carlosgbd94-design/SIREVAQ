-- ============================================================================
-- Requisiciones — Siembra inicial
--
-- 1) requi_catalogo_biologicos: los 20 renglones reales de la requisición
--    oficial de septiembre 2026 (SEPTIEMBRE/Municipio Corregidora.xlsx, hoja
--    GENERAL, filas 14-53), en el orden exacto en que se imprimen. Se cruzan
--    con biovac_catalogo_biologicos cuando existe equivalencia (puente
--    opcional, usado solo por el botón manual de sincronización en la UI).
--    "VACUNA ANTINEUMOCOCCICA 23 1DS" (código 146, fila 14) se había
--    desactivado por un pedido del usuario que luego se corrigió -- sí
--    sigue vigente en el formato oficial (ver requi_restaura_neumo23.sql).
-- 2) requi_unidades: los 4 municipios reales, sembrados desde public.unidades
--    (misma CLUES) + Hospitales como destino de primer nivel (no existe como
--    tal en public.unidades -- ahí HENM/Hospital General cuelgan de
--    QUERETARO; aquí se reclasifican bajo 'HOSPITALES' por ser, en la
--    práctica, un destinatario que la jurisdicción atiende directo).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Catálogo de biológicos de la requisición
-- ---------------------------------------------------------------------------

insert into requi_catalogo_biologicos
  (clave_articulo, codigo_articulo, nombre, presentacion, forma, orden, biovac_biologico_id)
values
  ('25311.020-000-0146-03','146','VACUNA ANTINEUMOCOCCICA 23 1DS','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',1,
    (select id from biovac_catalogo_biologicos where clave='NEUMO_23V')),
  ('25311.020-000-0148-01','148','VACUNA ANTINEUMOCOCCICA 13','UNIDOSIS','Susp. Inyectable (Jer. prellenada)',2,
    (select id from biovac_catalogo_biologicos where clave='NEUMO_13V')),
  ('25311.020-000-0150-05','150','VACUNA ROTAVIRUS MONOVALENTE','UNIDOSIS','Susp. Inyectable (Jer. prellenada)',3,
    (select id from biovac_catalogo_biologicos where clave='ROTAVIRUS')),
  ('25311.020-000-6135-00','6135','VACUNA HEXAVALENTE','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',4,
    (select id from biovac_catalogo_biologicos where clave='HEXAVALENTE')),
  ('25311.020-000-2526-00','2526','VACUNA HEPATITIS B MULTIDOSIS','MULTIDOSIS','Susp. Inyectable (Fco. Ampula)',5,
    (select id from biovac_catalogo_biologicos where clave='HEPB')),
  ('25311.020-000-3825-01','3825','VACUNA HEPATITIS A UNIDOSIS','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',6,
    (select id from biovac_catalogo_biologicos where clave='HEPA')),
  ('25311.020-000-3800-00','3800','VACUNA DOBLE VIRAL  (SR)','MULTIDOSIS','Fco. Amp Leofilizado+Diluy.',7,
    (select id from biovac_catalogo_biologicos where clave='SR')),
  ('25311.020-000-3801-01','3801','VACUNA BCG','MULTIDOSIS','Fco. Amp Leofilizado+Diluy.',8,
    (select id from biovac_catalogo_biologicos where clave='BCG')),
  ('25311.020-000-3802-00','3802','VACUNA  ANTIPOLIOMELITICA (SABIN)','MULTIDOSIS','Susp. (gotero de plastico)',9,
    null),
  ('25311.020-000-3805-00','3805','VACUNA VACUNA DPT','MULTIDOSIS','Susp. Inyectable (Fco. Ampula)',10,
    (select id from biovac_catalogo_biologicos where clave='DPT')),
  ('25311.020-000-3808-02','3808','VACUNA TDPA','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',11,
    (select id from biovac_catalogo_biologicos where clave='TDPA')),
  ('25311.020-000-3810-00','3810','VACUNA TD','MULTIDOSIS','Susp. Inyectable (Fco. Ampula)',12,
    (select id from biovac_catalogo_biologicos where clave='TD')),
  ('25311.020-000-6056-00','6056','VACUNA ANTIVARICELA','UNIDOSIS','Fco. Amp Leofilizado+Diluy.',13,
    (select id from biovac_catalogo_biologicos where clave='VARICELA')),
  ('25311.020-000-3820-00','3820','VACUNA TRIPLE VIRAL 1DS (SRP)','UNIDOSIS','Fco. Amp Leofilizado+Diluy.',14,
    (select id from biovac_catalogo_biologicos where clave='SRP')),
  ('25311.020-000-3821-00','3821','VACUNA TRIPLE VIRAL MULTI DOSIS','MULTIDOSIS','Fco. Amp Leofilizado+Diluy.',15,
    null),
  ('25311.020-000-6317-01','6317','VACUNA ANTIINFLUENZA 10/D','MULTIDOSIS','Susp. Inyectable (Fco. Ampula)',16,
    (select id from biovac_catalogo_biologicos where clave='ANTIINFLUENZA')),
  ('25311.020-000-3832-00','3832','VACUNA INMUNOGLOBULINA ANTITETANICA','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',17,
    null),
  ('25311.020-000-6501-02','6501','VACUNA VPH','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',18,
    (select id from biovac_catalogo_biologicos where clave='VPH')),
  ('25331.020-X-0002-00-E','2','VACUNA ANTIAMARILICA','UNIDOSIS','Fco. Amp Leofilizado +  Jer.prellenada.',19,
    null),
  ('25311.020-000-6509-01','6509','VACUNA VRS','UNIDOSIS','Susp. Inyectable (Fco. Ampula)',20,
    (select id from biovac_catalogo_biologicos where clave='VSR'))
on conflict (clave_articulo) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Unidades de los 4 municipios, sembradas desde public.unidades (misma
--    CLUES real). Solo unidades activas.
-- ---------------------------------------------------------------------------

-- HENM no se siembra aquí como unidad de QUERETARO: es un hospital, destino
-- de primer nivel propio (ver requi_distribucion_municipio) sin unidades
-- debajo -- H.G./N.H.G./HENM ya no viven en requi_unidades en absoluto,
-- cada uno lleva su propia requisición directa, tal como pidió el usuario.
insert into requi_unidades (clues, nombre, municipio, activo)
select u.clues, u.unidad, u.municipio, true
from public.unidades u
where u.activo = 'SI'
  and u.municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO')
  and u.unidad <> 'HENM'
on conflict (municipio, nombre) do update set clues = excluded.clues, activo = true;

-- ---------------------------------------------------------------------------
-- 3) Responsables de entrega/recibe por municipio, con los nombres reales
--    que ya traen las requisiciones de ejemplo de septiembre (SEPTIEMBRE/
--    Municipio *.xlsx, hoja GENERAL, A72/H72) -- son valores default
--    editables desde la UI, no fijos. Entrega es la misma persona
--    (jurisdicción) en los 4 municipios; Recibe cambia por municipio y
--    coincide con el usuario real asignado a cada uno en perfiles.
-- ---------------------------------------------------------------------------

insert into requi_firmas (nivel, destino, entrega_nombre, recibe_nombre) values
  ('MUNICIPAL', 'CORREGIDORA', 'LIC. LESLIE LÓPEZ ENCISO', 'ENF. ALMA DELIA HERNÁNDEZ ESQUIVEL'),
  ('MUNICIPAL', 'HUIMILPAN',   'LIC. LESLIE LÓPEZ ENCISO', 'ENF. ALMA DELIA HERNÁNDEZ ESQUIVEL'),
  ('MUNICIPAL', 'MARQUES',     'LIC. LESLIE LÓPEZ ENCISO', 'L.E ANA JULIA MENDOZA HERNANDEZ'),
  ('MUNICIPAL', 'QUERETARO',   'LIC. LESLIE LÓPEZ ENCISO', 'MTRA. ANA MARÍA RAMÍREZ MUNGUÍA')
on conflict (nivel, destino) do nothing;

-- Jurisdiccional: extraído de "Gran total Juris.xlsx" (hoja GRAN TOTAL
-- JURIS, A65/A66/H65/H66/A72/H72). A este nivel los roles de entrega/recibe
-- se invierten respecto al municipal -- la jurisdicción RECIBE del almacén
-- estatal, no entrega.
insert into requi_firmas (nivel, destino, elaboro_nombre, elaboro_cargo, autorizo_nombre, autorizo_cargo, entrega_nombre, recibe_nombre)
values (
  'JURISDICCIONAL', 'JURISDICCION',
  'L.E LIZBETH URIBE PANTOJA', 'RESPONSABLE PVU',
  'ING. ISRAEL RUIZ BARCENAS', 'ADMINISTRADOR DE JURISDICCION SANITARIA No. 1',
  'ENF. JESÚS FERNANDO MOLINA REYES', 'LIC. LESLIE LÓPEZ ENCISO'
)
on conflict (nivel, destino) do nothing;
