-- ============================================================================
-- APLICADO EN PRODUCCIÓN 2026-11-04 — lecturas mucho más rápidas con el mismo acceso
-- ============================================================================
-- Qué arregla: las políticas RLS llaman auth.uid(), is_admin(), get_user_role(), es_visualizador_juris() e
-- is_jurisdiccional() SIN envolverlas en (select ...). Postgres las vuelve a ejecutar por CADA FILA (is_admin() es plpgsql
-- volátil y hace una consulta a perfiles cada vez). Es el aviso "auth_rls_initplan" del asesor de Supabase (94 hallazgos).
--
-- Medido en producción (2026-11-04, dentro de transacciones revertidas, sin tocar datos):
--   existencia_detalle    UNIDAD 4,649 ms -> 43 ms   |  ADMIN 4,852 ms -> 46 ms   (29,115 filas)
--   biologicos_existencia UNIDAD 2,856 ms -> 10 ms   |  ADMIN   281 ms ->  4 ms
--   consumibles           UNIDAD   293 ms ->  4 ms   |  ADMIN   309 ms ->  4 ms
--
-- Es un cambio SEMÁNTICAMENTE IDÉNTICO: solo cambia cuándo se evalúa cada función (una vez por consulta, no por fila).
-- Verificado: 6 roles (ADMIN, JURISDICCIONAL, MUNICIPAL, UNIDAD, CARAVANAS, VISUALIZADOR_JURISDICCIONAL) x 85 tablas con
-- RLS, conteo de filas visible ANTES vs DESPUÉS de reescribir las 129 políticas: 0 diferencias.
-- (registros_sis y requi_pdf_generados quedaron fuera de la comparación por ser demasiado lentas ANTES de reescribir.)
--
-- Es idempotente (no vuelve a envolver lo ya envuelto). Para revertir basta con quitar los "(select ...)".
-- ============================================================================

do $$
declare r record; q text; w text; sql text; k int := 0;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := r.qual; w := r.with_check;
    q := regexp_replace(q, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi');
    q := regexp_replace(q, '(?<!select )(is_admin|get_user_role|es_visualizador_juris|is_jurisdiccional)\(\)', '(select \1())', 'gi');
    if w is not null then
      w := regexp_replace(w, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi');
      w := regexp_replace(w, '(?<!select )(is_admin|get_user_role|es_visualizador_juris|is_jurisdiccional)\(\)', '(select \1())', 'gi');
    end if;
    if q is distinct from r.qual or w is distinct from r.with_check then
      sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
        || case when q is not null then ' using (' || q || ')' else '' end
        || case when w is not null then ' with check (' || w || ')' else '' end;
      execute sql;
      k := k + 1;
    end if;
  end loop;
  raise notice 'politicas reescritas: %', k;
end $$;
