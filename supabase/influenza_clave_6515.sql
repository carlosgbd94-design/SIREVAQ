-- La clave de la vacuna de influenza cambia (6317 -> 6515 ...). Las funciones ya no la buscan por clave:
-- la reconocen por el nombre del catálogo (contiene "INFLUENZA"), así un cambio de clave no las rompe.
-- Se reescriben a partir de la definición vigente en la base.
do $$
declare
  v_def text;
  v_fn text;
begin
  foreach v_fn in array array['requi_traer_reparto_influenza', 'influenza_lotes_entregas'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn;
    v_def := replace(v_def,
      'b.codigo_articulo in (''6515'', ''6317'') and b.activo order by (b.codigo_articulo = ''6515'') desc limit 1;',
      'b.nombre ilike ''%influenza%'' and b.activo order by b.orden limit 1;');
    v_def := replace(v_def,
      'b.codigo_articulo in (''6515'', ''6317'')',
      'b.nombre ilike ''%influenza%''');
    execute v_def;
  end loop;
end $$;
