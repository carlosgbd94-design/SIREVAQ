-- ===========================================================================
-- Un lote en A.R.F. o Canje NO se aplica: no puede llevar dosis aplicadas.
--
-- 1) Guardia en biovac_trg_20_autocalc: en un renglón que no es NORMAL no se pueden CAPTURAR (insertar o subir) dosis
--    aplicadas. Bajarlas o ponerlas en cero sí se puede (para corregir lo ya capturado). Lo que mueven los procesos
--    internos (sincronización del municipio, dictamen, mover) corre con biovac.bypass_validaciones.
-- 2) La sincronización unidades -> municipio ya no suma las aplicadas de renglones que no son NORMAL: si una unidad
--    capturó aplicadas en Canje/A.R.F. por error, no se contagian al municipio (el detector muestra la diferencia
--    y la unidad debe corregir).
-- ADITIVA e idempotente.
-- ===========================================================================
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_trg_20_autocalc()'::regprocedure);
  if v not like '%sin_aplicadas_arf_canje%' then
    v := replace(v, E'  new.existencia_final_frascos := biovac_calc_existencia_final(',
      E'  -- sin_aplicadas_arf_canje: un lote en A.R.F. o Canje no se aplica\n' ||
      E'  if new.categoria is distinct from ''NORMAL'' and coalesce(current_setting(''biovac.bypass_validaciones'', true), ''off'') <> ''on''\n' ||
      E'     and (coalesce(new.aplicadas_a, 0) > 0 or coalesce(new.aplicadas_b, 0) > 0)\n' ||
      E'     and (tg_op = ''INSERT'' or coalesce(new.aplicadas_a, 0) > coalesce(old.aplicadas_a, 0) or coalesce(new.aplicadas_b, 0) > coalesce(old.aplicadas_b, 0)) then\n' ||
      E'    raise exception ''Un lote en % no se aplica: pásalo primero a Normal (Dictamen / Mover) o dalo de baja como desechado.'', case new.categoria when ''ARF'' then ''A.R.F.'' else ''Canje'' end;\n' ||
      E'  end if;\n\n' ||
      E'  new.existencia_final_frascos := biovac_calc_existencia_final(');
    if v not like '%sin_aplicadas_arf_canje%' then raise exception 'No se pudo parchear biovac_trg_20_autocalc'; end if;
    execute v;
  end if;

  v := pg_get_functiondef('public._biovac_sincronizar_municipio(text,integer,integer)'::regprocedure);
  if v not like '%sin_aplicadas_arf_canje%' then
    v := replace(v,
      'sum(rn.recibido_frascos) rec, sum(rn.aplicadas_a) apa, sum(rn.aplicadas_b) apb,',
      'sum(rn.recibido_frascos) rec, sum(case when rn.categoria = ''NORMAL'' then rn.aplicadas_a else 0 end) apa, sum(case when rn.categoria = ''NORMAL'' then rn.aplicadas_b else 0 end) apb, /* sin_aplicadas_arf_canje */');
    if v not like '%sin_aplicadas_arf_canje%' then raise exception 'No se pudo parchear _biovac_sincronizar_municipio'; end if;
    execute v;
  end if;
end $$;
