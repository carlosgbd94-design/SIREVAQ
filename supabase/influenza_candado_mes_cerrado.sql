-- Candado de Influenza para la UNIDAD: además de "SIS enviado/validado" (ya existía), la unidad deja de
-- poder tocar sus semanas cuando (desde el arranque por unidad) el mes está "sin envío" o el Movimiento del
-- municipio ya está CERRADO. Municipal/Jurisdicción/Admin siguen pudiendo (modo revisión); cada edición suya
-- vuelve a publicar a indicadores (trg_influenza_publicar_auto).
create or replace function public.influenza_trg_candado_sis_enviado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol text; v_estado text; v_fecha date; v_clues text; v_clues_l text[]; v_fechas date[]; i int;
  v_ini date; v_mes int; v_anio int;
begin
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_clues_l := array[new.clues]; v_fechas := array[new.fecha];
  elsif tg_op = 'DELETE' then
    v_clues_l := array[old.clues]; v_fechas := array[old.fecha];
  else
    v_clues_l := array[old.clues, new.clues]; v_fechas := array[old.fecha, new.fecha];
  end if;

  select valor::date into v_ini from sis_config where clave = 'inicio_captura_por_unidad';

  for i in 1 .. array_length(v_fechas, 1) loop
    v_clues := v_clues_l[i];
    v_fecha := v_fechas[i];
    continue when v_fecha is null;
    v_mes := extract(month from v_fecha)::int; v_anio := extract(year from v_fecha)::int;

    select c.estado into v_estado from sis06p_capturas c
    where c.clues = v_clues and c.mes = v_mes and c.anio = v_anio;

    if v_estado is not null and v_estado <> 'BORRADOR' then
      raise exception 'El SIS de % ya fue enviado (%): Influenza de ese mes quedó congelada. Pide al municipal que la corrija en modo revisión.',
        to_char(v_fecha, 'MM/YYYY'), lower(v_estado) using errcode = 'P0001';
    end if;

    if v_ini is not null and make_date(v_anio, v_mes, 1) >= date_trunc('month', v_ini)::date then
      if _sis06p_unidad_omitida(v_clues, v_anio, v_mes) then
        raise exception 'El mes % quedó "sin envío" para esta unidad: Influenza de ese mes está congelada. Pide al municipal que la corrija.',
          to_char(v_fecha, 'MM/YYYY') using errcode = 'P0001';
      end if;
      if exists (
        select 1 from biovac_unidades u
        join biovac_unidades j on j.municipio = u.municipio and j.clues like 'JS1-%'
        join biovac_movimientos m on m.unidad_id = j.id and m.anio = v_anio and m.mes = v_mes and m.estado = 'CERRADO'
        where u.clues = v_clues and u.clues not like 'JS1-%') then
        raise exception 'El mes % ya está cerrado por el municipio: Influenza de ese mes está congelada. Pide al municipal que la corrija.',
          to_char(v_fecha, 'MM/YYYY') using errcode = 'P0001';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
