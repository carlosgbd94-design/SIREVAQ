-- ============================================================================
-- Reducir el uso de disco (Disk IO) de Supabase sin cambiar de plan.
--
-- 1) La publicación a indicadores (registros_sis) ya NO se dispara cada vez que cambia algo
--    (validar una unidad, marcar «sin envío», editar un reporte de Influenza): se hace UNA vez,
--    cuando el municipal cierra el mes (Movimiento del municipio, fila JS1-*, pasa a CERRADO).
--    Sigue existiendo el botón «Cargar a indicadores» (publicación manual) por si hay que repetirla.
--      - se quitan: trg_sis06p_90_publicar_auto, trg_sis06p_sin_envio_publicar_auto, trg_influenza_publicar_auto
--      - se agrega:  trg_biovac_publicar_al_cierre (biovac_movimientos -> CERRADO, solo filas JS1-*)
--
-- 2) refrescar_resumenes_mensuales() (la corre cada noche autolimpieza_historicos) reescribía TODAS las
--    filas de los resúmenes mensuales aunque no hubieran cambiado (solo cambiaba «actualizado»): ahora
--    solo actualiza las que de verdad cambiaron.
-- ============================================================================

-- 1) Publicación solo al cierre del mes -------------------------------------------------------------
drop trigger if exists trg_sis06p_90_publicar_auto on public.sis06p_capturas;
drop trigger if exists trg_sis06p_sin_envio_publicar_auto on public.sis06p_sin_envio;
drop trigger if exists trg_influenza_publicar_auto on public.influenza_capturas;

create or replace function public.biovac_trg_publicar_al_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_clues text; v_muni text;
begin
  select u.clues, u.municipio into v_clues, v_muni from biovac_unidades u where u.id = new.unidad_id;
  if v_clues like 'JS1-%' and v_muni is not null then
    perform _sis_publicar_auto(new.mes, new.anio, v_muni);   -- no falla el cierre si no se puede publicar
  end if;
  return null;
end;
$$;
revoke all on function public.biovac_trg_publicar_al_cierre() from public, anon, authenticated;

drop trigger if exists trg_biovac_publicar_al_cierre on public.biovac_movimientos;
create trigger trg_biovac_publicar_al_cierre
  after update of estado on public.biovac_movimientos
  for each row
  when (new.estado = 'CERRADO' and old.estado is distinct from 'CERRADO')
  execute function public.biovac_trg_publicar_al_cierre();

-- 2) Resúmenes mensuales: solo se reescriben las filas que cambiaron ---------------------------------
do $$
declare v text;
begin
  v := pg_get_functiondef('public.refrescar_resumenes_mensuales()'::regprocedure);
  if v like '%is distinct from%' then return; end if;   -- ya parchada
  v := replace(v,
    'sin_pedido = excluded.sin_pedido, actualizado = now();',
    E'sin_pedido = excluded.sin_pedido, actualizado = now()\n    where (r.unidad, r.municipio, r.pedido_frascos, r.existencia_frascos, r.promedio_frascos, r.min_dosis, r.max_dosis, r.n_registros, r.sin_pedido)\n      is distinct from (excluded.unidad, excluded.municipio, excluded.pedido_frascos, excluded.existencia_frascos, excluded.promedio_frascos, excluded.min_dosis, excluded.max_dosis, excluded.n_registros, excluded.sin_pedido);');
  v := replace(v,
    'ultima_fecha = excluded.ultima_fecha, por_biologico = excluded.por_biologico, actualizado = now();',
    E'ultima_fecha = excluded.ultima_fecha, por_biologico = excluded.por_biologico, actualizado = now()\n    where (r.unidad, r.municipio, r.n_capturas, r.n_con_ceros, r.n_sin_movimiento, r.ultima_fecha, r.por_biologico)\n      is distinct from (excluded.unidad, excluded.municipio, excluded.n_capturas, excluded.n_con_ceros, excluded.n_sin_movimiento, excluded.ultima_fecha, excluded.por_biologico);');
  v := replace(v,
    'por_insumo = excluded.por_insumo, actualizado = now();',
    E'por_insumo = excluded.por_insumo, actualizado = now()\n    where (r.unidad, r.municipio, r.n_capturas, r.n_sin_movimiento, r.ultima_fecha, r.por_insumo)\n      is distinct from (excluded.unidad, excluded.municipio, excluded.n_capturas, excluded.n_sin_movimiento, excluded.ultima_fecha, excluded.por_insumo);');
  if v not like '%is distinct from%' then raise exception 'No se pudo parchear refrescar_resumenes_mensuales'; end if;
  execute v;
end $$;
