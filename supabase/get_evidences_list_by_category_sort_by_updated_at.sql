-- ===================================================================================
-- Fix: created_at se queda fijo en la primera subida de un archivo de evidencia
-- (r2_objects.name es PK, el reemplazo hace upsert y solo toca updated_at). Ordenar
-- el listado por created_at hacía que un documento recién reemplazado no subiera al
-- tope del explorador de evidencias, aunque su contenido y la fecha mostrada (ver
-- enrichFile en main.js) ya reflejen el reemplazo.
-- ===================================================================================

CREATE OR REPLACE FUNCTION public.get_evidences_list_by_category(category_name text, p_max_rows integer DEFAULT 100)
 RETURNS TABLE(name text, bucket_id text, owner uuid, created_at timestamp with time zone, updated_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, public_url text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata, public_url
  FROM (
    SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata, public_url
    FROM public.r2_objects
    WHERE bucket_id = 'sirevaq-evidencias'
      AND name LIKE (category_name || '/%')
    UNION ALL
    SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata,
           'https://utclfqjietlxzlorxhrs.supabase.co/storage/v1/object/public/evidencias/' || name as public_url
    FROM storage.objects
    WHERE bucket_id = 'evidencias'
      AND name LIKE (category_name || '/%')
  ) sub
  ORDER BY COALESCE(updated_at, created_at) DESC
  LIMIT p_max_rows;
$function$;
