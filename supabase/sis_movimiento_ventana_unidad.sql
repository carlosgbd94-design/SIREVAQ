-- ============================================================================
-- Movimiento de Biológico: la UNIDAD solo escribe dentro de la ventana del mes
--
-- Antes el candado de fechas (prellenado desde 7 días antes de fin de mes hasta 7 días
-- después, o las fechas habilitadas por el administrador) solo protegía el paloteo SIS-06-P
-- (sis06p_capturas). Los renglones del Movimiento de un mes ya cerrado seguían editables
-- por la unidad (aunque no hubiera enviado nada), por eso seguían llenando septiembre en octubre.
-- Municipal, Jurisdicción y Admin no cambian. La excepción del administrador
-- (sis06p_calendario_override) también abre el Movimiento porque se lee de sis06p_ventana_envio.
-- ============================================================================

create or replace function public._sis06p_mes_fuera_de_ventana(p_anio int, p_mes int)
returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select v.dentro_prellenado from sis06p_ventana_envio(p_anio, p_mes) v), false)
$$;
revoke all on function public._sis06p_mes_fuera_de_ventana(int, int) from public, anon, authenticated;

create or replace function public.biovac_trg_10_bloqueo()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_estado text;
  v_mov_id uuid := coalesce(new.movimiento_id, old.movimiento_id);
  v_clues text;
  v_anio int;
  v_mes int;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;

  select m.estado, bu.clues, m.anio, m.mes into v_estado, v_clues, v_anio, v_mes
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id
  where m.id = v_mov_id;

  if v_estado = 'CERRADO' then
    raise exception 'El movimiento % está cerrado. Use biovac_abrir_correccion(...) antes de editar.', v_mov_id;
  end if;

  if _sis_rol_actual() = 'UNIDAD' and _sis06p_mes_bloqueado(v_clues, v_anio, v_mes) then
    raise exception 'El SINBA-SIS de %/% ya fue enviado: la unidad ya no puede modificar el Movimiento de Biológico. Pide la corrección al municipal.',
      lpad(v_mes::text, 2, '0'), v_anio;
  end if;

  if _sis_rol_actual() = 'UNIDAD' and _sis06p_mes_fuera_de_ventana(v_anio, v_mes) then
    raise exception 'El Movimiento de %/% está fuera de su ventana de captura. Si necesitas capturarlo, pide al administrador que habilite el mes.',
      lpad(v_mes::text, 2, '0'), v_anio;
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function public.biovac_trg_30_unidad_bloqueo()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_clues text;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;
  if _sis_rol_actual() = 'UNIDAD' then
    select bu.clues into v_clues from biovac_unidades bu where bu.id = old.unidad_id;
    if _sis06p_mes_bloqueado(v_clues, old.anio, old.mes) then
      raise exception 'El SINBA-SIS de %/% ya fue enviado: la unidad ya no puede modificar este Movimiento de Biológico.',
        lpad(old.mes::text, 2, '0'), old.anio;
    end if;
    if _sis06p_mes_fuera_de_ventana(old.anio, old.mes) then
      raise exception 'El Movimiento de %/% está fuera de su ventana de captura. Si necesitas capturarlo, pide al administrador que habilite el mes.',
        lpad(old.mes::text, 2, '0'), old.anio;
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;
