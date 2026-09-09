-- ============================================================================
-- BioVac — Motor de Movimiento de Biológico
-- Esquema base. Aislado del resto de SIREVAQ: prefijo biovac_, sin FKs a
-- tablas existentes (unidades_medicas/perfiles). La integración con la app
-- se hace en una fase aparte, mapeando biovac_unidades.clues -> clues real.
--
-- Fuente de verdad del diseño: "MoViMiEnTo De BiOlOgICo 2026.xlsx"
-- (Servicios de Salud del Estado de Querétaro, Jurisdicción Sanitaria N°1).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Jurisdicciones y unidades (municipios)
-- ---------------------------------------------------------------------------

create table if not exists biovac_jurisdicciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  created_at timestamptz not null default now()
);

create table if not exists biovac_unidades (
  id uuid primary key default gen_random_uuid(),
  jurisdiccion_id uuid not null references biovac_jurisdicciones(id),
  clues text not null unique,
  nombre text not null,
  municipio text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo de biológicos
--
-- bloque_id agrupa 1+ biológicos bajo un solo renglón "Total" impreso
-- (caso real: COVID-19 MODERNA y COVID-19 PFIZER comparten un Total).
--
-- vigente_desde/vigente_hasta permiten que el catálogo cambie en el año
-- sin perder histórico (ej. "Neumocócica polisacárida 23v" vigente hasta
-- abril-2026, reemplazada por "Neumocócica conjugada 20v" desde mayo-2026;
-- "VSR" aparece hasta mayo-2026 en adelante).
-- ---------------------------------------------------------------------------

create table if not exists biovac_bloques_catalogo (
  id uuid primary key default gen_random_uuid(),
  pagina text not null check (pagina in ('ANVERSO','REVERSO')),
  orden int not null,
  nombre_bloque text not null,
  unique (pagina, orden)
);

create table if not exists biovac_catalogo_biologicos (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null references biovac_bloques_catalogo(id),
  clave text not null unique,
  nombre_excel text not null,               -- texto tal cual aparece en columna A del Excel
  orden_en_bloque int not null default 1,
  presentacion text not null check (presentacion in ('UNIDOSIS','MULTIDOSIS')),
  dosis_por_frasco numeric not null default 1,   -- default del biológico; un lote puede sobreescribirlo
  regla_especial text check (regla_especial in ('SPLIT_DOSE')), -- ver biovac_renglones.aplicadas_b/desechadas_b
  -- BCG y SR: frasco multidosis que, una vez abierto, se debe aplicar o
  -- desechar en la misma jornada -- nunca puede quedar un renglón NORMAL
  -- con existencia_final_frascos fraccionaria (frasco parcialmente usado
  -- sin resolver). Se valida en biovac_trg_20_autocalc.
  frasco_desecho_mismo_dia boolean not null default false,
  vigente_desde date not null default '2000-01-01',
  vigente_hasta date,
  created_at timestamptz not null default now()
);

create index if not exists idx_biovac_catalogo_bloque on biovac_catalogo_biologicos(bloque_id);

-- ---------------------------------------------------------------------------
-- Lotes
--
-- dosis_por_frasco_override: en la práctica, dentro de un mismo bloque
-- (ej. COVID-19) distintos lotes pueden tener distinta dosis/frasco según
-- fabricante/presentación real (Moderna 5, Pfizer adulto 10, Pfizer
-- pediátrico 6 — verificado en el Excel real). Si es NULL se usa el
-- default del catálogo.
-- ---------------------------------------------------------------------------

create table if not exists biovac_lotes (
  id uuid primary key default gen_random_uuid(),
  biologico_id uuid not null references biovac_catalogo_biologicos(id),
  numero_lote text not null,
  caducidad date,
  dosis_por_frasco_override numeric,
  created_at timestamptz not null default now(),
  unique (biologico_id, numero_lote)
);

create index if not exists idx_biovac_lotes_biologico on biovac_lotes(biologico_id);

-- ---------------------------------------------------------------------------
-- Movimientos mensuales (un renglón "cabecera" por unidad+año+mes)
-- ---------------------------------------------------------------------------

create table if not exists biovac_movimientos (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references biovac_unidades(id),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR','CERRADO','EN_CORRECCION')),
  fue_corregido boolean not null default false,
  responsable_elaboracion text,
  fecha_corte date,
  cerrado_en timestamptz,
  cerrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidad_id, anio, mes)
);

create index if not exists idx_biovac_movimientos_unidad on biovac_movimientos(unidad_id, anio, mes);

-- ---------------------------------------------------------------------------
-- Renglones (un renglón = un lote con actividad ese mes; agregar/quitar
-- lote = insertar/borrar fila, sin arrastrar fórmulas).
--
-- categoria: 'NORMAL', 'ARF' (en dictamen) o 'CANJE' -- son dos estatus
-- distintos aunque el Excel real los imprima juntos bajo una sola sección
-- "A.R.F. En dictamen o canje". Los tres suman al Total impreso del
-- bloque, pero ARF/CANJE NUNCA se tratan como "dado de baja" en la
-- lógica de negocio (se reconcilian aparte).
--
-- aplicadas_a/aplicadas_b y desechadas_a/desechadas_b: para biológicos con
-- regla_especial='SPLIT_DOSE' (Hepatitis B, COVID-19 Moderna en el Excel
-- real), la dosis aplicada/desechada se reparte en dos columnas (dosis
-- fraccionada + dosis completa) que se combinan como aplicadas_a/2 +
-- aplicadas_b antes de calcular la existencia final. Para el resto,
-- aplicadas_b/desechadas_b quedan en 0 y el cálculo es aplicadas_a a secas.
--
-- existencia_final_frascos: la calcula SIEMPRE el trigger
-- biovac_trg_20_autocalc (ver biovac_engine.sql) — nunca se confía en un
-- valor que mande el cliente.
-- ---------------------------------------------------------------------------

create table if not exists biovac_renglones (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references biovac_movimientos(id) on delete cascade,
  lote_id uuid not null references biovac_lotes(id),
  -- ARF (en dictamen) y CANJE son estatus distintos aunque el Excel real los
  -- imprima bajo una sola sección "A.R.F. En dictamen o canje" -- se separan
  -- aquí para trazabilidad real; la exportación los vuelve a unir visualmente.
  categoria text not null default 'NORMAL' check (categoria in ('NORMAL','ARF','CANJE')),
  existencia_anterior_frascos numeric not null default 0,
  recibido_frascos numeric not null default 0,
  aplicadas_a numeric not null default 0,
  aplicadas_b numeric not null default 0,
  desechadas_a numeric not null default 0,
  desechadas_b numeric not null default 0,
  existencia_final_frascos numeric not null default 0,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (movimiento_id, lote_id, categoria)
);

create index if not exists idx_biovac_renglones_movimiento on biovac_renglones(movimiento_id);
create index if not exists idx_biovac_renglones_lote on biovac_renglones(lote_id);

-- ---------------------------------------------------------------------------
-- Auditoría de correcciones (append-only)
-- ---------------------------------------------------------------------------

create table if not exists biovac_correcciones (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references biovac_movimientos(id),
  -- on delete set null: esta fila es append-only y ya guarda todo lo
  -- legible como texto (valor_anterior/valor_nuevo, ej. "ARF (5 frascos)"
  -- -> "NORMAL (5 frascos)"), así que perder el enlace al renglón no
  -- pierde información de auditoría -- pero sin esto, la sola existencia
  -- de esta fila bloqueaba por completo poder borrar después el renglón
  -- resultante de una reactivación de A.R.F. o resolución de Canje
  -- (violación de llave foránea, sin ningún mensaje claro para el usuario).
  renglon_id uuid references biovac_renglones(id) on delete set null,
  usuario text not null,
  rol text not null,
  campo text,
  valor_anterior text,
  valor_nuevo text,
  motivo text not null,
  tipo text not null check (tipo in ('EDICION','REAPERTURA','CORRECCION_JURISDICCIONAL','RECLASIFICACION')),
  cascade_batch_id uuid,
  creado_en timestamptz not null default now()
);

create index if not exists idx_biovac_correcciones_movimiento on biovac_correcciones(movimiento_id);
create index if not exists idx_biovac_correcciones_batch on biovac_correcciones(cascade_batch_id);

-- ---------------------------------------------------------------------------
-- Informes jurisdiccionales generados (foto fija del concentrado en vivo,
-- para el PDF/Excel oficial — la vista en vivo puede seguir cambiando
-- después por una corrección municipal, lo cual marca el informe como
-- desactualizado).
-- ---------------------------------------------------------------------------

create table if not exists biovac_informes_jurisdiccionales (
  id uuid primary key default gen_random_uuid(),
  jurisdiccion_id uuid not null references biovac_jurisdicciones(id),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  generado_por text,
  generado_en timestamptz not null default now(),
  estado text not null default 'GENERADO' check (estado in ('GENERADO','CON_CORRECCIONES_POSTERIORES')),
  snapshot jsonb not null
);

create index if not exists idx_biovac_informes_jurisdiccion on biovac_informes_jurisdiccionales(jurisdiccion_id, anio, mes);
