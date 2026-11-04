-- ============================================================================
-- APLICADO EN PRODUCCIÓN 2026-11-04 — que los hospitales (NHG y HENM) también se publiquen a indicadores al cerrar el mes
-- ============================================================================
-- Hallazgo de la auditoría (2026-11-04): el disparador trg_biovac_publicar_al_cierre (reducir_io_publicacion_al_cierre.sql)
-- solo publica cuando se cierra una fila JS1-* (el Movimiento del MUNICIPIO). Los hospitales no tienen fila JS1 desde
-- octubre: su Movimiento es el de la CLUES real (QTSSA001740 HENM, QTSSA002901 NHGQ) y los valida la Jurisdicción. Antes de
-- ese cambio sí se publicaban solos al validarse; ahora solo con el botón manual «Cargar a indicadores».
--
-- 1) El disparador también publica cuando se cierra el Movimiento de un hospital.
-- 2) _sis_publicar_auto_core anota «PENDIENTE» cuando el cierre no pudo publicar porque faltan unidades por validar (hoy ese
--    caso no deja rastro y el aviso dice «se carga sola al cerrar el mes»): así se sabe que falta publicar a mano.
-- ============================================================================

create or replace function public.biovac_trg_publicar_al_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_clues text; v_muni text;
begin
  select u.clues, u.municipio into v_clues, v_muni from biovac_unidades u where u.id = new.unidad_id;
  if v_muni is not null and (v_clues like 'JS1-%' or v_muni in ('NHG', 'HENM')) then
    perform _sis_publicar_auto(new.mes, new.anio, v_muni);   -- no falla el cierre si no se puede publicar
  end if;
  return null;
end;
$$;
revoke all on function public.biovac_trg_publicar_al_cierre() from public, anon, authenticated;

create or replace function public._sis_publicar_auto_core(p_mes integer, p_anio integer, p_municipio text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ini date; v_usr text; v_res jsonb;
begin
  if p_municipio is null or p_mes is null or p_anio is null then return; end if;
  select valor::date into v_ini from sis_config where clave = 'inicio_captura_por_unidad';
  if v_ini is not null and make_date(p_anio, p_mes, 1) < date_trunc('month', v_ini)::date then return; end if;
  select p.usuario into v_usr from perfiles p where p.id = auth.uid();
  begin
    v_res := sis_publicar_registros_sis(p_mes, p_anio, p_municipio, coalesce(v_usr, 'AUTO') || ' (auto)');
    insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
    values (p_anio, p_mes, p_municipio, 'PUBLICADO',
            'insertadas=' || (v_res ->> 'insertadas') || ' reemplazadas=' || (v_res ->> 'reemplazadas'), v_usr);
  exception when others then
    if sqlerrm like 'Faltan por validar%' then
      insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
      values (p_anio, p_mes, p_municipio, 'PENDIENTE', left(sqlerrm, 800), v_usr);
    elsif sqlerrm not like 'Sesión no válida%' and sqlerrm not like 'Rol %' then
      insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
      values (p_anio, p_mes, p_municipio, 'BLOQUEADO', left(sqlerrm, 800), v_usr);
    end if;
  end;
end $function$;
