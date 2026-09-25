-- ============================================================================
-- SINBA-SIS -- Influenza: candado del corte mensual.
--
-- Influenza NO se captura dentro del SIS: se captura semana a semana en su
-- panel (Meta-Logro, con validación contra la meta) y el SIS solo LEE el corte
-- del mes en vivo (influenza_capturas cuya fecha cae en ese mes calendario).
-- Como el SIS no guarda una copia, no puede duplicar nada.
--
-- Lo que faltaba: una vez que la unidad ENVÍA su SIS del mes, ese corte tiene
-- que quedar congelado -- si no, la unidad podría volver a editar una semana
-- de ese mes en el panel de Influenza y el total ya conciliado con Movimiento
-- de Biológico cambiaría por debajo. Este trigger lo impide SOLO para rol
-- UNIDAD; MUNICIPAL/JURISDICCIONAL/ADMIN (y procesos internos sin sesión)
-- siguen pudiendo corregir, igual que con el resto del SIS.
--
-- Requiere sis06p_estado_engine.sql (columna sis06p_capturas.estado).
-- ============================================================================

create or replace function public.influenza_trg_candado_sis_enviado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_estado text;
  v_fecha date;
  v_clues text;
  v_clues_l text[];
  v_fechas date[];
  i int;
begin
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  -- Sin sesión (proceso interno) o rol revisor: sin restricción.
  if v_rol is distinct from 'UNIDAD' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Se revisan la fila nueva Y la anterior (un UPDATE puede mover la fecha).
  -- OLD no existe en INSERT ni NEW en DELETE, por eso se arma la lista por caso.
  if tg_op = 'INSERT' then
    v_clues_l := array[new.clues]; v_fechas := array[new.fecha];
  elsif tg_op = 'DELETE' then
    v_clues_l := array[old.clues]; v_fechas := array[old.fecha];
  else
    v_clues_l := array[old.clues, new.clues]; v_fechas := array[old.fecha, new.fecha];
  end if;

  for i in 1 .. array_length(v_fechas, 1) loop
    v_clues := v_clues_l[i];
    v_fecha := v_fechas[i];
    continue when v_fecha is null;

    select c.estado into v_estado
    from sis06p_capturas c
    where c.clues = v_clues
      and c.mes = extract(month from v_fecha)::int
      and c.anio = extract(year from v_fecha)::int;

    if v_estado is not null and v_estado <> 'BORRADOR' then
      raise exception 'El SIS de % ya fue enviado (%): Influenza de ese mes quedó congelada. Pide al municipal que la corrija en modo revisión.',
        to_char(v_fecha, 'MM/YYYY'), lower(v_estado)
        using errcode = 'P0001';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.influenza_trg_candado_sis_enviado() from public, anon, authenticated;

drop trigger if exists influenza_trg_candado_sis_enviado on public.influenza_capturas;
create trigger influenza_trg_candado_sis_enviado
  before insert or update or delete on public.influenza_capturas
  for each row execute function public.influenza_trg_candado_sis_enviado();
