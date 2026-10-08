-- Aplicado en produccion (2026-10-08): existencia unica por CLUES+fecha y guardado atomico.
-- Ver migracion "existencia_unica_por_clues_fecha_y_guardado_atomico" en Supabase.
create unique index if not exists biologicos_existencia_clues_fecha_uq on public.biologicos_existencia (clues, fecha);
-- public.guardar_existencia(p_clues, p_fecha, p_resumen jsonb, p_detalle jsonb, p_editor text):
-- lock advisory por CLUES+fecha, borra y reinserta el dia en una transaccion (SECURITY INVOKER, RLS aplica)
-- y marca editado/editado_por/editado_ts cuando reemplaza una captura previa.
