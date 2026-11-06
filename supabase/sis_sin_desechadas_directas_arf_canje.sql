-- ===========================================================================
-- Las dosis desechadas de un lote en A.R.F. o Canje no se capturan a mano:
--   * Canje: no se desecha; se resuelve con el canje (lote nuevo + caducidad, pasa a Normal).
--   * A.R.F.: se decide con el Dictamen (reutilizar -> Normal, o desechar) o «Desechar por caducidad».
-- Guardia en biovac_trg_20_autocalc (subir desechadas):
--   * CANJE: ningún rol puede subir desechadas.
--   * ARF: la UNIDAD no puede subirlas a mano; solo vía biovac_dictamen_arf (marca biovac.via_dictamen).
-- Bajarlas o ponerlas en cero sí se puede (corregir). El importador de Excel y los procesos internos
-- (biovac.bypass_validaciones) no se ven afectados.
-- ADITIVA e idempotente.
-- ===========================================================================
do $$
declare v text;
begin
  v := pg_get_functiondef('public.biovac_trg_20_autocalc()'::regprocedure);
  if v not like '%sin_desechadas_directas_arf_canje%' then
    v := replace(v, E'  -- sin_aplicadas_arf_canje: un lote en A.R.F. o Canje no se aplica\n',
      E'  -- sin_desechadas_directas_arf_canje: no se captura a mano el desecho de un lote en A.R.F. (va por el Dictamen) ni en Canje\n' ||
      E'  if new.categoria in (''ARF'', ''CANJE'') and coalesce(current_setting(''biovac.bypass_validaciones'', true), ''off'') <> ''on''\n' ||
      E'     and (coalesce(new.desechadas_a, 0) > 0 or coalesce(new.desechadas_b, 0) > 0)\n' ||
      E'     and (tg_op = ''INSERT'' or coalesce(new.desechadas_a, 0) > coalesce(old.desechadas_a, 0) or coalesce(new.desechadas_b, 0) > coalesce(old.desechadas_b, 0))\n' ||
      E'     and (new.categoria = ''CANJE'' or (coalesce(current_setting(''biovac.via_dictamen'', true), ''off'') <> ''on'' and _sis_rol_actual() = ''UNIDAD'')) then\n' ||
      E'    raise exception ''Un lote en % no se desecha a mano: %'', case new.categoria when ''ARF'' then ''A.R.F.'' else ''Canje'' end,\n' ||
      E'      case new.categoria when ''ARF'' then ''usa «Dictamen» (o «Desechar por caducidad») en ese renglón.'' else ''resuélvelo con el canje (lote nuevo y caducidad).'' end;\n' ||
      E'  end if;\n\n' ||
      E'  -- sin_aplicadas_arf_canje: un lote en A.R.F. o Canje no se aplica\n');
    if v not like '%sin_desechadas_directas_arf_canje%' then raise exception 'No se pudo parchear biovac_trg_20_autocalc'; end if;
    execute v;
  end if;

  v := pg_get_functiondef('public.biovac_dictamen_arf(uuid,text,numeric,text,text,text)'::regprocedure);
  if v not like '%via_dictamen%' then
    v := replace(v, E'  if p_resultado = ''DESECHAR'' then\n',
      E'  perform set_config(''biovac.via_dictamen'', ''on'', true);   -- el desecho por dictamen sí puede escribir desechadas en ARF\n  if p_resultado = ''DESECHAR'' then\n');
    v := replace(v, E'    return r.id;\n  end if;\n\n  if r.categoria <> ''ARF''',
      E'    perform set_config(''biovac.via_dictamen'', ''off'', true);\n    return r.id;\n  end if;\n  perform set_config(''biovac.via_dictamen'', ''off'', true);\n\n  if r.categoria <> ''ARF''');
    if v not like '%via_dictamen%' or v not like '%''off'', true);%return r.id%' then raise exception 'No se pudo parchear biovac_dictamen_arf'; end if;
    execute v;
  end if;
end $$;
