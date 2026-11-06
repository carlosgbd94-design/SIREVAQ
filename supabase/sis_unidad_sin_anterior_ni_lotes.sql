-- ===========================================================================
-- Desde noviembre 2026 la UNIDAD ya no edita la existencia anterior ni agrega lotes a mano.
-- Los lotes y cantidades recibidos llegan de Requisiciones (el recibido ya está bloqueado para la unidad desde
-- octubre) y la existencia anterior es subsecuente: el cierre del mes previo (biovac_cerrar_mes la arrastra).
-- La pantalla ya lo respeta (anteriorEditablePorRol / renderPanelAgregar); esto lo hace valer en el servidor.
--
-- Qué bloquea (solo rol UNIDAD, unidades reales, meses >= sis_config.inicio_unidad_sin_anterior_ni_lotes):
--   * INSERT de un renglón por la vía directa de la tabla (agregar lote a mano).
--   * UPDATE de existencia_anterior_frascos.
-- No bloquea: las funciones del servidor (RPC: Dictamen, Canje, Mover, Cambiar lote...), el arrastre del cierre de mes,
-- la sincronización ni los hospitales (NHG/HENM, que capturan en su propia cuenta). ADITIVA e idempotente.
-- ===========================================================================
insert into sis_config (clave, valor) select 'inicio_unidad_sin_anterior_ni_lotes', '2026-11-01' where not exists (select 1 from sis_config where clave = 'inicio_unidad_sin_anterior_ni_lotes');

create or replace function public.biovac_trg_15_unidad_sin_anterior_ni_lotes() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_clues text; v_muni text; v_anio int; v_mes int; v_desde date; v_mov uuid;
begin
  if coalesce(current_setting('biovac.bypass_lock', true), 'off') = 'on' then return new; end if;
  if coalesce(current_setting('request.path', true), '') like '%/rpc/%' then return new; end if;
  if tg_op = 'UPDATE' and new.existencia_anterior_frascos is not distinct from old.existencia_anterior_frascos then return new; end if;
  if _sis_rol_actual() is distinct from 'UNIDAD' then return new; end if;
  v_mov := new.movimiento_id;
  select bu.clues, bu.municipio, m.anio, m.mes into v_clues, v_muni, v_anio, v_mes
  from biovac_movimientos m join biovac_unidades bu on bu.id = m.unidad_id where m.id = v_mov;
  if v_clues is null or v_clues like 'JS1-%' or v_muni in ('NHG', 'HENM') then return new; end if;
  select valor::date into v_desde from sis_config where clave = 'inicio_unidad_sin_anterior_ni_lotes';
  if make_date(v_anio, v_mes, 1) < coalesce(v_desde, date '2026-11-01') then return new; end if;
  if tg_op = 'INSERT' then
    raise exception 'Los lotes de tu Movimiento llegan solos desde Requisiciones: ya no se agregan a mano. Si te falta uno, avísale a tu municipal.' using errcode = '42501';
  end if;
  raise exception 'La existencia anterior ya no se captura: viene sola del cierre del mes pasado. Si no coincide, avísale a tu municipal.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_biovac_15_unidad_sin_anterior_ni_lotes on public.biovac_renglones;
create trigger trg_biovac_15_unidad_sin_anterior_ni_lotes
  before insert or update of existencia_anterior_frascos on public.biovac_renglones
  for each row execute function public.biovac_trg_15_unidad_sin_anterior_ni_lotes();
