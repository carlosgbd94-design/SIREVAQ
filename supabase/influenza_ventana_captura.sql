-- Ventana de captura de Influenza (defensa en servidor; el cliente ya valida lo mismo):
--   · la fecha del reporte debe caer dentro de la temporada de su campaña (fecha_inicio..fecha_fin);
--   · un rol UNIDAD no puede capturar antes de que inicie la campaña, ni una semana futura
--     (a lo mucho el jueves previo al viernes del reporte).
-- No aplica a sesiones sin usuario (SQL del dashboard / service role), para poder corregir datos.
create or replace function public.influenza_trg_ventana_captura()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol text;
  v_ini date;
  v_fin date;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  select c.fecha_inicio, c.fecha_fin into v_ini, v_fin
  from campanas c where c.nombre = new.anio_campana;

  -- Campaña desconocida o sin fechas: no se bloquea (no inventar reglas).
  if v_ini is null or v_fin is null then
    return new;
  end if;

  if new.fecha < v_ini or new.fecha > v_fin then
    raise exception 'La fecha % queda fuera de la campaña (% a %).',
      to_char(new.fecha, 'DD/MM/YYYY'), to_char(v_ini, 'DD/MM/YYYY'), to_char(v_fin, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;

  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol = 'UNIDAD' then
    if v_hoy < v_ini then
      raise exception 'La campaña de Influenza inicia el %. Aún no se pueden capturar reportes.',
        to_char(v_ini, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    if new.fecha > v_hoy + 1 then
      raise exception 'No se puede capturar la semana del % antes de tiempo.',
        to_char(new.fecha, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists influenza_trg_ventana_captura on public.influenza_capturas;
create trigger influenza_trg_ventana_captura
  before insert or update on public.influenza_capturas
  for each row execute function public.influenza_trg_ventana_captura();
