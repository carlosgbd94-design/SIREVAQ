-- get_rda_indicators: tardaba ~1-2 s por llamada (32 comparaciones "variable = ANY(arreglo)" por CADA fila de registros_sis).
-- Ahora la sumatoria se pre-agrega por (clues, variable_sis) en una subconsulta y las 32 comparaciones corren sobre
-- esas filas (hasta ~10x menos). El resultado es idéntico (suma de sumas); el bloque lo comprueba comparando el hash
-- del resultado ANTES y DESPUÉS para varios años/meses y se revierte solo si algo difiere.
-- Idempotente: si la función ya está pre-agregada, no hace nada.
do $$
declare
  v_def text; v_new text;
  v_old_a text; v_old_b text; v_old_c text;
  v_new_a text; v_new_b text; v_new_c text;
  v_from text := E'        LEFT JOIN public.registros_sis r\n            ON r.clues = (';
  v_to   text := E'        LEFT JOIN (SELECT rs.clues, rs.variable_sis, SUM(rs.valor) AS valor FROM public.registros_sis rs WHERE rs.anio = p_anio AND rs.mes <= p_max_mes GROUP BY rs.clues, rs.variable_sis) r\n            ON r.clues = (';
  v_tail_from text := E'            )\n            AND r.anio = p_anio\n            AND r.mes <= p_max_mes\n        GROUP BY';
  v_tail_to   text := E'            )\n        GROUP BY';
begin
  select pg_get_functiondef('public.get_rda_indicators(integer,integer)'::regprocedure) into v_def;
  if position('SUM(rs.valor)' in v_def) > 0 then raise notice 'ya pre-agregada'; return; end if;
  if position(v_from in v_def) = 0 or position(v_tail_from in v_def) = 0 then
    raise exception 'La definicion de get_rda_indicators cambio; revisar a mano';
  end if;

  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_old_a from public.get_rda_indicators(2026, 10) t;
  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_old_b from public.get_rda_indicators(2026, 3)  t;
  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_old_c from public.get_rda_indicators(2025, 12) t;

  v_new := replace(replace(v_def, v_from, v_to), v_tail_from, v_tail_to);
  execute v_new;

  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_new_a from public.get_rda_indicators(2026, 10) t;
  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_new_b from public.get_rda_indicators(2026, 3)  t;
  select md5(coalesce(string_agg(t::text, '|' order by t.clues), '')) into v_new_c from public.get_rda_indicators(2025, 12) t;

  if v_old_a is distinct from v_new_a or v_old_b is distinct from v_new_b or v_old_c is distinct from v_new_c then
    raise exception 'El resultado cambio (% / % / %); se revierte', v_old_a = v_new_a, v_old_b = v_new_b, v_old_c = v_new_c;
  end if;
  raise notice 'get_rda_indicators pre-agregada: resultado identico en 3 comprobaciones';
end $$;
