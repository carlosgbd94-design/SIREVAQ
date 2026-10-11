-- Influenza: el panel de la unidad abre toda la semana + la meta se hace cumplir también en servidor.
--
-- 1) Ventana de captura. El reporte se fecha el viernes (o el último día del mes en un corte entre semana), pero
--    la semana es la ISO (lunes a domingo): sábado y domingo cuentan para el viernes de esa misma semana.
--    UNIDAD puede capturar desde el lunes de esa semana (no antes) y cualquier día; sigue habiendo UN reporte por
--    semana (clave clues + fecha). El viernes que sigue a un corte de fin de mes entre semana abre al día
--    siguiente del corte, porque los días anteriores son del reporte del corte.
--    (Antes: solo jueves y viernes en el cliente y, en servidor, a lo mucho el jueves previo.)
-- 2) Meta. Un rol UNIDAD no puede reportar dosis en un rubro sin meta ni rebasar la meta de su unidad con lo ya
--    acumulado en las demás semanas. Solo cuentan los AUMENTOS: volver a guardar una cifra ya existente (por
--    ejemplo si la meta bajó después) no se bloquea. No aplica a revisores ni a procesos sin usuario.

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
  v_lunes date;
  v_abre date;
  v_corte date;
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

    -- La semana abre el lunes (o el inicio de la campaña, si es después).
    v_lunes := new.fecha - (extract(isodow from new.fecha)::int - 1);
    v_abre := greatest(v_lunes, v_ini);

    -- Viernes posterior a un corte de fin de mes entre semana: abre al día siguiente del corte.
    if extract(isodow from new.fecha)::int = 5 then
      v_corte := (date_trunc('month', v_lunes::timestamp) + interval '1 month - 1 day')::date;
      if v_corte >= v_lunes and v_corte < new.fecha
         and extract(isodow from v_corte)::int between 1 and 4
         and v_corte between v_ini and v_fin then
        v_abre := greatest(v_abre, v_corte + 1);
      end if;
    end if;

    if v_hoy < v_abre then
      raise exception 'No se puede capturar la semana del % antes de tiempo: abre el %.',
        to_char(new.fecha, 'DD/MM/YYYY'), to_char(v_abre, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.influenza_trg_meta_unidad()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol text;
  v_metas jsonb;
  k text;
  v_new numeric;
  v_old numeric;
  v_meta numeric;
  v_otros numeric;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then
    return new;
  end if;

  select m.metas into v_metas
  from influenza_metas m
  where m.anio_campana = new.anio_campana and m.clues = new.clues
  order by m.updated_at desc nulls last
  limit 1;

  for k in select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) loop
    v_new := coalesce(nullif(new.valores ->> k, '')::numeric, 0);
    if v_new < 0 then
      raise exception 'Las dosis aplicadas no pueden ser negativas (%).', k using errcode = 'P0001';
    end if;

    v_old := 0;
    if tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then
      v_old := coalesce(nullif(old.valores ->> k, '')::numeric, 0);
    end if;
    continue when v_new <= v_old;

    v_meta := coalesce(nullif(v_metas ->> k, '')::numeric, 0);
    if v_meta <= 0 then
      raise exception 'Tu unidad no tiene meta asignada en el rubro % de esta campaña: no se puede reportar.', k
        using errcode = 'P0001';
    end if;

    select coalesce(sum(nullif(c.valores ->> k, '')::numeric), 0) into v_otros
    from influenza_capturas c
    where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;

    if v_otros + v_new > v_meta then
      raise exception 'El rubro % rebasaría la meta de tu unidad: llevas % dosis en otras semanas, con % de esta semana serían % y la meta es %.',
        k, v_otros, v_new, v_otros + v_new, v_meta
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function public.influenza_trg_meta_unidad() from public, anon, authenticated;

drop trigger if exists influenza_trg_meta_unidad on public.influenza_capturas;
create trigger influenza_trg_meta_unidad
  before insert or update on public.influenza_capturas
  for each row execute function public.influenza_trg_meta_unidad();
