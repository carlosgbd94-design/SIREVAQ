-- =============================================================================
-- «Recibido contra requisición» marcaba como FALTANTE lo que una unidad recibió y luego perdió en un accidente de red de frío
-- (ARF): al moverlo a ARF el renglón NORMAL queda con menos «recibido» y el resto aparece como recibido en el renglón ARF del
-- mismo lote. La requisición asigna el total, así que se compara contra NORMAL + ARF (lo realmente recibido de ese lote).
-- Ej.: Pedro Escobedo, lote GAZ00045: requisición 1000 = 951 NORMAL + 49 ARF.
-- =============================================================================
do $$
declare v text;
begin
  v := pg_get_functiondef('public.sis06p_recibido_vs_requisicion(integer,integer,text)'::regprocedure);
  if v like '%r.categoria in (''NORMAL'', ''ARF'')%' then return; end if;
  v := replace(v, 'r.categoria = ''NORMAL''', 'r.categoria in (''NORMAL'', ''ARF'')');
  if v not like '%r.categoria in (''NORMAL'', ''ARF'')%' then raise exception 'No se pudo parchear'; end if;
  execute v;
end $$;
