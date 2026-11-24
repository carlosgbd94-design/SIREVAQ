-- 2026-11-24: el calendario mensual (calendario_pedidos) se leia un dia atras en el navegador (UTC-6), y las
-- unidades que tenian cargada la version vieja guardaron el pedido ordinario con fecha_pedido_programada = 19
-- en lugar de 20 (el dia objetivo). Aparecian como una ventana aparte y las demas unidades como pendientes.
--
-- 1) Correccion de datos aplicada una vez:
--    update biologicos_pedido set fecha_pedido_programada = '2026-11-20'
--     where fecha_pedido_programada = '2026-11-19' and fecha_captura = '2026-11-24' and clues in ('QTSSA012631','QTSSA012276');
-- 2) Guardia: si un pedido MENSUAL llega con la fecha UN DIA ANTES del objetivo del calendario activo del mes
--    (nunca puede ser una fecha valida), se guarda con la fecha objetivo. Corre antes de trg_pedido_tipo_extraordinario
--    (orden alfabetico de triggers).
create or replace function public.pedido_fecha_calendario_guardia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sig date;
begin
  if new.fecha_pedido_programada is null or coalesce(new.tipo_pedido, 'MENSUAL') <> 'MENSUAL' then
    return new;
  end if;
  v_sig := new.fecha_pedido_programada + 1;
  if exists (select 1 from calendario_pedidos c
              where c.anio_mes = to_char(v_sig, 'YYYY-MM') and c.activo = 'SI' and c.fecha_programada = v_sig)
     and not exists (select 1 from pedidos_extraordinarios e where e.fecha_programada = new.fecha_pedido_programada) then
    new.fecha_pedido_programada := v_sig;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedido_fecha_calendario on public.biologicos_pedido;
create trigger trg_pedido_fecha_calendario
  before insert or update of fecha_pedido_programada, tipo_pedido on public.biologicos_pedido
  for each row execute function public.pedido_fecha_calendario_guardia();
