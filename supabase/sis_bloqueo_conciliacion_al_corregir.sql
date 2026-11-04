-- 2026-11-04 (aplicado en prod, con ajuste el mismo día): la revisión (municipal / jurisdicción / admin) no puede ALEJAR un SIS
-- ENVIADO o VALIDADO del Movimiento de Biológico.
-- Contexto: El Paraíso, La Griega y San Isidro Miranda (Marqués) enviaron cuadrados el 3-nov, y después la revisión municipal
-- editó el paloteo y quedaron con diferencias; esa comprobación solo corría al Enviar (unidad) y al Validar.
--
-- 1) Guardar el paloteo (sis06p_capturas): si el SIS está ENVIADO/VALIDADO, cambian valores/ajustes y el Movimiento NO está
--    en corrección, el guardado se rechaza SOLO si deja más diferencia que la que había (suma de |paloteo - aplicado|).
--    Un guardado que acerca el paloteo al Movimiento se acepta aunque aún queden diferencias: así se corrige poco a poco.
--    (La primera versión rechazaba todo guardado con diferencias y no dejaba corregir en varios pasos.)
--    Con el Movimiento en corrección se permite siempre. La excepción autorizada sigue valiendo (_sis06p_diferencias_texto).
-- 2) Guardar la corrección del Movimiento (EN_CORRECCION -> CERRADO): si el SIS está ENVIADO/VALIDADO y no coincide, se rechaza
--    (el paloteo sí se puede corregir antes, mientras el Movimiento está en corrección).
-- Validar (sis06p_marcar_validado) ya bloqueaba por diferencias; no se toca.

create or replace function _sis06p_dif_puntaje(p_clues text, p_mes int, p_anio int) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(abs(d.paloteo - d.aplicado)), 0)
  from _sis06p_comparativo_calc(p_clues, p_mes, p_anio) d
  where d.paloteo <> d.aplicado;
$$;
revoke all on function _sis06p_dif_puntaje(text, int, int) from public, anon, authenticated;

-- ANTES del cambio: guarda cuánta diferencia hay hoy (la tabla aún tiene los valores viejos).
create or replace function sis06p_trg_29_conciliacion_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sis06p.dif_antes', '', true);
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then return new; end if;
  if (select auth.uid()) is null then return new; end if;
  if old.estado not in ('ENVIADO', 'VALIDADO') then return new; end if;
  perform set_config('sis06p.dif_antes', _sis06p_dif_puntaje(old.clues, old.mes, old.anio)::text, true);
  return new;
end;
$$;
revoke all on function sis06p_trg_29_conciliacion_antes() from public, anon, authenticated;

drop trigger if exists trg_sis06p_29_conciliacion_antes on sis06p_capturas;
create trigger trg_sis06p_29_conciliacion_antes
  before update on sis06p_capturas
  for each row execute function sis06p_trg_29_conciliacion_antes();

-- DESPUÉS: solo rechaza si el guardado deja MÁS diferencia que la que había.
create or replace function sis06p_trg_30_conciliacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mov_estado text;
  v_dif text;
  v_antes numeric;
  v_despues numeric;
begin
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then return new; end if;
  if (select auth.uid()) is null then return new; end if;
  if old.estado not in ('ENVIADO', 'VALIDADO') then return new; end if;
  if new.valores is not distinct from old.valores and new.ajustes is not distinct from old.ajustes then return new; end if;

  select m.estado into v_mov_estado
  from biovac_movimientos m
  join biovac_unidades bu on bu.id = m.unidad_id
  where bu.clues = new.clues and m.anio = new.anio and m.mes = new.mes;
  if v_mov_estado is null or v_mov_estado = 'EN_CORRECCION' then return new; end if;

  v_dif := _sis06p_diferencias_texto(new.clues, new.mes, new.anio);
  if v_dif is null then return new; end if;

  v_antes := nullif(current_setting('sis06p.dif_antes', true), '')::numeric;
  v_despues := _sis06p_dif_puntaje(new.clues, new.mes, new.anio);
  if v_antes is not null and v_despues <= v_antes then return new; end if;

  raise exception 'No se puede guardar: este cambio aleja el paloteo SIS-06-P del Movimiento de Biológico (sigue sin coincidir en: %). Ajusta el paloteo para acercarlo al Movimiento o abre la corrección del Movimiento.', v_dif;
end;
$$;
revoke all on function sis06p_trg_30_conciliacion() from public, anon, authenticated;

drop trigger if exists trg_sis06p_30_conciliacion on sis06p_capturas;
create trigger trg_sis06p_30_conciliacion
  after update on sis06p_capturas
  for each row execute function sis06p_trg_30_conciliacion();

create or replace function biovac_trg_40_conciliacion_al_corregir() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clues text;
  v_estado_sis text;
  v_dif text;
begin
  select bu.clues into v_clues from biovac_unidades bu where bu.id = new.unidad_id;
  select c.estado into v_estado_sis from sis06p_capturas c where c.clues = v_clues and c.anio = new.anio and c.mes = new.mes;
  if v_estado_sis in ('ENVIADO', 'VALIDADO') then
    v_dif := _sis06p_diferencias_texto(v_clues, new.mes, new.anio);
    if v_dif is not null then
      raise exception 'No se puede guardar la corrección: el Movimiento de Biológico y el paloteo SIS-06-P no coinciden en: %. Corrige el paloteo (modo revisión) y vuelve a guardar.', v_dif;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function biovac_trg_40_conciliacion_al_corregir() from public, anon, authenticated;

drop trigger if exists trg_biovac_40_conciliacion on biovac_movimientos;
create trigger trg_biovac_40_conciliacion
  before update on biovac_movimientos
  for each row
  when (old.estado = 'EN_CORRECCION' and new.estado = 'CERRADO')
  execute function biovac_trg_40_conciliacion_al_corregir();
