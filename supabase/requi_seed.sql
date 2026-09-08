-- ============================================================================
-- Requisiciones — Siembra inicial
--
-- 1) requi_catalogo_biologicos: los 20 renglones reales de la requisición
--    oficial de septiembre 2026 (SEPTIEMBRE/Municipio Corregidora.xlsx, hoja
--    GENERAL, filas 14-53), en el orden exacto en que se imprimen. Se cruzan
--    con biovac_catalogo_biologicos cuando existe equivalencia (puente
--    opcional, usado solo por el botón manual de sincronización en la UI).
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

insert into requi_unidades (clues, nombre, municipio, activo)
select u.clues, u.unidad, u.municipio, true
from public.unidades u
where u.activo = 'SI'
  and u.municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO')
  -- HENM se resiembra abajo bajo HOSPITALES, no se duplica aquí
  and u.unidad <> 'HENM'
on conflict (municipio, nombre) do update set clues = excluded.clues, activo = true;

-- ---------------------------------------------------------------------------
-- 3) Hospitales, destino de primer nivel.
--    - HENM: CLUES confirmada en public.unidades y public.unidades_medicas
--      (QTSSA001740, "Hospital de Especialidades del Niño y la Mujer Dr.
--      Felipe Núñez Lara").
--    - H.G.: CLUES confirmada en public.unidades (QTSSA002901, "Hospital
--      General de Queretaro") -- ahí aparece inactiva por motivos ajenos a
--      la distribución de vacunas; en la requisición real de septiembre
--      2026 sigue siendo destinatario activo, por eso aquí se sembra activa.
--    - N.H.G. (Nuevo Hospital General de Querétaro, Hospitales.xlsx hoja
--      "N.H.G"): SIN CLUES -- no existe registro en ninguna tabla de
--      SIREVAQ (unidades, unidades_medicas). Es un establecimiento nuevo;
--      su CLUES oficial (DGIS/SICLUES) debe confirmarla el usuario.
-- ---------------------------------------------------------------------------

insert into requi_unidades (clues, nombre, municipio, activo) values
  ('QTSSA001740', 'HENM', 'HOSPITALES', true),
  ('QTSSA002901', 'H.G.', 'HOSPITALES', true),
  (null, 'N.H.G.', 'HOSPITALES', true)
on conflict (municipio, nombre) do update set clues = excluded.clues, activo = true;
