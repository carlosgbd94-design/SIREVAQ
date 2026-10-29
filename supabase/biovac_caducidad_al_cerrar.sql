-- ===========================================================================
-- BIOVAC · La validación de caducidad se mueve de «guardar un renglón» a «cerrar el mes».
--
-- Antes: biovac_trg_20_autocalc rechazaba CUALQUIER escritura de un renglón NORMAL cuyo lote caducara en el mes del
-- movimiento y siguiera con existencia. Eso impedía precargar la existencia anterior de un lote que caduca este mes
-- (o recibir un lote próximo a caducar), aunque la unidad pensara desecharlo antes de enviar.
-- Ahora: el renglón se guarda libremente (la pantalla ya avisa «caduca al terminar este mes») y la regla se aplica
-- al cerrar el mes / enviar el SINBA-SIS (biovac_cerrar_mes), que es donde de verdad importa.
-- Idempotente.
-- ===========================================================================

create or replace function biovac_trg_20_autocalc() returns trigger
language plpgsql
as $$
begin
  new.existencia_final_frascos := biovac_calc_existencia_final(
    new.lote_id, new.existencia_anterior_frascos, new.recibido_frascos,
    new.aplicadas_a, new.aplicadas_b, new.desechadas_a, new.desechadas_b
  );
  new.updated_at := now();
  return new;
end;
$$;

-- biovac_cerrar_mes: igual que antes + revisión de caducidad (después de recalcular, junto a los negativos).
DO $mig$
declare
  v_def text;
  v_ancla text := E'  select count(*) into v_fraccionarios\n  from biovac_renglones r\n  join biovac_lotes l on l.id = r.lote_id';
  v_nuevo text := E'  select string_agg(x.txt, E''; '' order by x.txt) into v_caducados\n  from (\n    select l.numero_lote || '' (caduca '' || to_char(l.caducidad, ''MM/YYYY'') || '', existencia '' || round(r.existencia_final_frascos, 2) || '')'' as txt\n    from biovac_renglones r\n    join biovac_lotes l on l.id = r.lote_id\n    join biovac_movimientos mm on mm.id = r.movimiento_id\n    where r.movimiento_id = p_movimiento_id and r.categoria = ''NORMAL'' and r.existencia_final_frascos > 0\n      and l.caducidad is not null\n      and date_trunc(''month'', l.caducidad)::date <= make_date(mm.anio, mm.mes, 1)\n  ) x;\n  if v_caducados is not null then\n    perform set_config(''biovac.bypass_lock'', ''off'', true);\n    perform set_config(''biovac.bypass_validaciones'', ''off'', true);\n    raise exception ''No se puede cerrar: hay lote(s) que caducan este mes y aún tienen existencia: %. Dalos de baja como desechados, o pásalos a A.R.F. o canje, y vuelve a intentar.'', v_caducados;\n  end if;\n\n';
begin
  select pg_get_functiondef('public.biovac_cerrar_mes(uuid,text)'::regprocedure) into v_def;
  if position('v_caducados' in v_def) > 0 then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'ancla no encontrada'; end if;
  v_def := replace(v_def, E'  v_faltan text;\nbegin', E'  v_faltan text;\n  v_caducados text;\nbegin');
  v_def := replace(v_def, v_ancla, v_nuevo || v_ancla);
  execute v_def;
end
$mig$;
