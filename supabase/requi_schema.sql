-- ============================================================================
-- Requisiciones — Esquema base (Jurisdicción -> Municipio/Hospitales -> Unidad)
-- Prefijo requi_. Aislado del resto de SIREVAQ, mismo criterio que Biovac
-- (biovac_schema.sql): catálogo e identidad de lote propios, sin FKs a
-- catálogos de otros módulos, para no arriesgar el layout impreso de Biovac
-- ni el de "Carga de lotes por municipio" (tabla public.lotes).
--
-- Fuente de verdad del formato: "REQUISICION ACTUALIZADA.xlsx" / "Gran total
-- Juris.xlsx" / "Municipio *.xlsx" / "Hospitales.xlsx" (Servicios de Salud
-- del Estado de Querétaro, Jurisdicción Sanitaria N°1, carpeta SEPTIEMBRE).
--
-- Jerarquía real: Jurisdicción reparte a 5 destinos de primer nivel
-- (CORREGIDORA, HUIMILPAN, MARQUES, QUERETARO, HOSPITALES -- mismo texto sin
-- acentos que ya usan perfiles.municipio_asignado/biovac_unidades/
-- public.unidades, para que las políticas RLS por municipio del usuario
-- funcionen igual que en el resto de la app). Las caravanas NO son un
-- destino aparte: son una unidad más dentro de su municipio real.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Catálogo de biológicos tal como aparecen impresos en la requisición oficial
-- (columnas reales: clave de artículo SACI/Oracle, nombre, presentación,
-- forma farmacéutica, orden de impresión). Deliberadamente separado de
-- biovac_catalogo_biologicos: ese catálogo gobierna el layout impreso de
-- "Movimiento de Biológico" y no incluye renglones legacy que sí exige el
-- formato oficial de requisición (ej. Antipoliomielítica Sabin, Inmuno-
-- globulina Antitetánica, Antiamarílica, SRP multidosis) aunque hoy lleguen
-- en cantidad cero. biovac_biologico_id es un puente OPCIONAL para cuando
-- el mismo biológico sí existe en Biovac (se usa solo para la sincronización
-- manual hacia "Carga de lotes por municipio" en la UI, nunca automática).
-- ---------------------------------------------------------------------------

create table if not exists requi_catalogo_biologicos (
  id uuid primary key default gen_random_uuid(),
  clave_articulo text not null unique,      -- ej '25311.020-000-0148-01'
  codigo_articulo text,                     -- ej '148' (columna B del Excel)
  nombre text not null,                     -- NOMBRE DEL ARTÍCULO
  presentacion text not null check (presentacion in ('UNIDOSIS','MULTIDOSIS')),
  forma text,                               -- FORMA / FARMACÉUTICA
  orden int not null,                       -- respeta el orden de impresión del Excel
  biovac_biologico_id uuid references biovac_catalogo_biologicos(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_requi_catalogo_orden on requi_catalogo_biologicos(orden);

-- ---------------------------------------------------------------------------
-- Lotes (identidad única a nivel jurisdicción: un lote = un renglón, sin
-- importar a cuántos destinos se reparta después).
-- ---------------------------------------------------------------------------

create table if not exists requi_lotes (
  id uuid primary key default gen_random_uuid(),
  requi_biologico_id uuid not null references requi_catalogo_biologicos(id),
  numero_lote text not null,
  caducidad date,
  created_at timestamptz not null default now(),
  unique (requi_biologico_id, numero_lote)
);

create index if not exists idx_requi_lotes_biologico on requi_lotes(requi_biologico_id);

-- ---------------------------------------------------------------------------
-- Unidades destino: los 4 municipios reales (sembradas desde public.unidades,
-- misma CLUES) + Hospitales (destino de primer nivel, no depende de ningún
-- municipio). Catálogo propio -- ver nota de aislamiento arriba.
-- ---------------------------------------------------------------------------

-- Solo los 4 municipios reales tienen unidades (Paso 3). Los hospitales son
-- destinos de primer nivel sin desglose por unidad -- ver
-- requi_distribucion_municipio y requi_separa_hospitales_como_destinos_
-- propios.sql.
create table if not exists requi_unidades (
  id uuid primary key default gen_random_uuid(),
  clues text unique,
  nombre text not null,
  municipio text not null check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (municipio, nombre)
);

create index if not exists idx_requi_unidades_municipio on requi_unidades(municipio);

-- ---------------------------------------------------------------------------
-- Cabecera mensual de la requisición jurisdiccional.
-- ---------------------------------------------------------------------------

create table if not exists requi_requisiciones (
  id uuid primary key default gen_random_uuid(),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  folio_oracle text,                        -- se escribe a mano, tal como hoy se sella en papel
  fecha_envio date,
  area text not null default 'VACUNAS',
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR','CERRADA')),
  creado_por text,
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  unique (anio, mes)
);

-- ---------------------------------------------------------------------------
-- Lo surtido a nivel jurisdiccional: la "bolsa" tope contra la que se valida
-- todo el reparto (ver requi_engine.sql).
-- ---------------------------------------------------------------------------

create table if not exists requi_items_jurisdiccion (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references requi_requisiciones(id) on delete cascade,
  requi_biologico_id uuid not null references requi_catalogo_biologicos(id),
  lote_id uuid not null references requi_lotes(id),
  cantidad_surtida numeric not null default 0 check (cantidad_surtida >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisicion_id, requi_biologico_id, lote_id)
);

create index if not exists idx_requi_items_juris_requisicion on requi_items_jurisdiccion(requisicion_id);

-- ---------------------------------------------------------------------------
-- Reparto jurisdicción -> municipio/Hospitales. Un lote puede tener fila en
-- 1, 2, 3, 4 o los 5 destinos de forma independiente (o en ninguno todavía).
-- ---------------------------------------------------------------------------

-- municipio: los 4 municipios reales + 2 hospitales como destinos de primer
-- nivel, hermanos entre sí (NHG=Nuevo Hospital General, HENM=Hospital de
-- Especialidades del Niño y la Mujer -- el "Hospital General" viejo ya no
-- existe). Cada hospital lleva su propia requisición -- no comparten un
-- bucket combinado. A diferencia de los municipios, los hospitales se
-- tratan como "unidad" para firmas: nunca llevan nombre de quien recibe
-- precapturado (se firma a mano en el papel), ver requisiciones_ui.js.
create table if not exists requi_distribucion_municipio (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references requi_requisiciones(id) on delete cascade,
  municipio text not null check (municipio in ('CORREGIDORA','HUIMILPAN','MARQUES','QUERETARO','NHG','HENM')),
  requi_biologico_id uuid not null references requi_catalogo_biologicos(id),
  lote_id uuid not null references requi_lotes(id),
  cantidad numeric not null default 0 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisicion_id, municipio, requi_biologico_id, lote_id)
);

create index if not exists idx_requi_dist_muni_requisicion on requi_distribucion_municipio(requisicion_id);
create index if not exists idx_requi_dist_muni_combo on requi_distribucion_municipio(requisicion_id, requi_biologico_id, lote_id);

-- ---------------------------------------------------------------------------
-- Reparto municipio/Hospitales -> unidad. Mismo criterio de libertad por
-- lote que el nivel anterior.
-- ---------------------------------------------------------------------------

create table if not exists requi_distribucion_unidad (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references requi_requisiciones(id) on delete cascade,
  unidad_id uuid not null references requi_unidades(id),
  requi_biologico_id uuid not null references requi_catalogo_biologicos(id),
  lote_id uuid not null references requi_lotes(id),
  cantidad numeric not null default 0 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisicion_id, unidad_id, requi_biologico_id, lote_id)
);

create index if not exists idx_requi_dist_unidad_requisicion on requi_distribucion_unidad(requisicion_id);
create index if not exists idx_requi_dist_unidad_combo on requi_distribucion_unidad(requisicion_id, requi_biologico_id, lote_id);

-- ---------------------------------------------------------------------------
-- Bitácora de impresión/exportación (quién generó qué PDF y cuándo).
-- ---------------------------------------------------------------------------

create table if not exists requi_pdf_generados (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references requi_requisiciones(id) on delete cascade,
  nivel text not null check (nivel in ('JURISDICCIONAL','MUNICIPAL','UNIDAD')),
  destino text not null,                    -- municipio, 'HOSPITALES' o nombre de unidad
  copias int not null default 1,
  generado_por text,
  generado_en timestamptz not null default now()
);

create index if not exists idx_requi_pdf_requisicion on requi_pdf_generados(requisicion_id);

-- ---------------------------------------------------------------------------
-- Firmas/responsables por nivel/destino: catálogo de configuración, NO datos
-- transaccionales -- el usuario señaló que el mismo responsable firma mes
-- tras mes, así que se capturan una vez y se reutilizan (caché) hasta que
-- cambien, en vez de volver a teclearse en cada requisición mensual.
-- Elaboró/Autorizó son fijos a nivel jurisdicción (una sola fila,
-- destino='JURISDICCION') y se imprimen igual en las 3 copias. Entrega/
-- Recibe se capturan por destino: la fila jurisdiccional para el nivel
-- JURISDICCIONAL, y una fila por município/Hospitales para el nivel
-- MUNICIPAL. Las UNIDADES no llevan nombre precapturado -- la unidad firma
-- a mano y anota su propio nombre en el papel, por eso 'UNIDAD' no es un
-- nivel válido aquí.
-- ---------------------------------------------------------------------------

create table if not exists requi_firmas (
  id uuid primary key default gen_random_uuid(),
  nivel text not null check (nivel in ('JURISDICCIONAL','MUNICIPAL')),
  destino text not null,
  elaboro_nombre text,
  elaboro_cargo text,
  autorizo_nombre text,
  autorizo_cargo text,
  entrega_nombre text,
  entrega_cargo text,
  recibe_nombre text,
  recibe_cargo text,
  updated_at timestamptz not null default now(),
  unique (nivel, destino)
);
