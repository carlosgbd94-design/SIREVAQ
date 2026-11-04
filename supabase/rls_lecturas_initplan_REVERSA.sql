-- REVERSA de rls_lecturas_initplan.sql (aplicado 2026-11-04).
-- Quita los "(select ...)" que envolvían auth.uid(), is_admin(), get_user_role(), es_visualizador_juris() e is_jurisdiccional().
-- Solo hace falta si algo se comportara distinto (no se detectaron diferencias: 6 roles x 85 tablas).
do $$
declare r record; q text; w text; sql text; k int := 0;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := r.qual; w := r.with_check;
    q := regexp_replace(q, '\(\s*select\s+(auth\.uid\(\)|is_admin\(\)|get_user_role\(\)|es_visualizador_juris\(\)|is_jurisdiccional\(\))\s*\)', '\1', 'gi');
    if w is not null then
      w := regexp_replace(w, '\(\s*select\s+(auth\.uid\(\)|is_admin\(\)|get_user_role\(\)|es_visualizador_juris\(\)|is_jurisdiccional\(\))\s*\)', '\1', 'gi');
    end if;
    if q is distinct from r.qual or w is distinct from r.with_check then
      sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
        || case when q is not null then ' using (' || q || ')' else '' end
        || case when w is not null then ' with check (' || w || ')' else '' end;
      execute sql;
      k := k + 1;
    end if;
  end loop;
  raise notice 'politicas revertidas: %', k;
end $$;
