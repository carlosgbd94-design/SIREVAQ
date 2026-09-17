-- ============================================================================
-- Existencia de Biológicos — trazabilidad de préstamos entre municipios
--
-- Contexto: un renglón de existencia_detalle puede venir de un lote que
-- nunca se surtió oficialmente al municipio que lo captura (p.ej. Santa
-- Bárbara aplicó vacuna que Pedro Escobedo le prestó por desabasto). El
-- campo "tipo" ya distinguía ese caso (PRESTAMO_DESABASTO/PRESTAMO_ARF),
-- pero no había dónde guardar DE QUÉ municipio vino -- este campo lo
-- resuelve sin agregar ningún control nuevo al panel de captura: se llena
-- solo, leyendo el municipio del lote elegido en el mismo dropdown que ya
-- existía (ver handleSRBioChange/ALL_LOTES_NORMAL en main.js).
--
-- No aplica a BioVac (Movimiento de Biológico): ese módulo es independiente
-- y no se toca aquí.
-- ============================================================================

alter table existencia_detalle
  add column if not exists municipio_origen text;

comment on column existencia_detalle.municipio_origen is
  'Municipio que prestó el lote (solo cuando tipo = PRESTAMO_DESABASTO o PRESTAMO_ARF); NULL en captura normal por requisición.';
