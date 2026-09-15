-- ===================================================================================
-- Fix: r2_objects.name es PRIMARY KEY. El upload de evidencias (main.js, case
-- "uploadfile") usa upsert(onConflict: 'name') para que "reemplazar" un documento
-- (mismo folderPath) actualice tamaño/tipo/fecha en vez de fallar en silencio contra
-- la PK. Postgres resuelve ON CONFLICT DO UPDATE como una operación que requiere
-- permiso UPDATE sobre la fila existente -- pero r2_objects solo tenía políticas de
-- SELECT e INSERT para "authenticated", así que el upsert quedaba bloqueado por RLS
-- (403) en cuanto el conflicto realmente ocurría (es decir, en cada reemplazo real).
-- ===================================================================================

CREATE POLICY "Permitir actualizacion a usuarios autenticados"
ON public.r2_objects
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
