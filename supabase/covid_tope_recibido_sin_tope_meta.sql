-- COVID-19: la meta por grupo deja de bloquear; lo que bloquea es aplicar más de lo RECIBIDO de cada marca.
--
-- Motivo (2026-11-19): la federación entrega las marcas como quiere y la meta de adultos (c3..c6) es ~10 veces menor que la
-- pediátrica. La Moderna capturada como adulto consumía la meta y la Pfizer (solo adultos) ya no se podía reportar
-- (17 unidades, ~250 dosis). Octubre ya está validado y no se toca: la regla nueva solo aplica a lo que se guarde de ahora en adelante.
--
-- 1) covid_trg_valida_captura: queda solo la validación de forma (marcas, rubros, enteros >= 0, Pfizer sin niños).
--    Se quita el tope contra la meta por rubro (cliente y móvil ahora solo avisan «rebasas la meta»).
-- 2) covid_trg_tope_abasto: por marca, lo aplicado en TODA la campaña (otras semanas, incluidos meses anteriores, + este
--    reporte, en dosis equivalentes de 0.5 mL: c1/c2 de 0.25 mL valen media) no puede pasar de lo recibido en TODA la campaña
--    (suma de todas las entregas de covid_distribucion_frascos x dosis por frasco). Lo recibido nuevo entra solo (se suma en vivo).
--    · Ya no se omite cuando la unidad no tiene ningún reparto: sin frascos recibidos de una marca no se puede reportar esa marca.
--    · Solo rol UNIDAD (revisores/admin corrigen sin candado) y solo si el reporte SUBE lo aplicado de la marca respecto a lo
--      ya guardado de esa semana (datos existentes no se rompen).
-- Idempotente.

create or replace function public.covid_trg_valida_captura() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m text; k text;
  v_val numeric;
  rubros text[] := array['c1','c2','c3','c4','c5','c6'];
begin
  for m in select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) loop
    if m not in ('MODERNA', 'PFIZER') then
      raise exception 'Marca no válida en la captura de COVID-19: %.', m using errcode = 'P0001';
    end if;
    for k in select jsonb_object_keys(new.valores -> m) loop
      if not (k = any (rubros)) then
        raise exception 'Rubro no válido en la captura de COVID-19: %.', k using errcode = 'P0001';
      end if;
      v_val := coalesce(nullif(new.valores -> m ->> k, '')::numeric, 0);
      if v_val < 0 or v_val <> trunc(v_val) then
        raise exception 'Las dosis aplicadas deben ser enteros no negativos (% %).', m, k using errcode = 'P0001';
      end if;
      if m = 'PFIZER' and k in ('c1', 'c2') and v_val > 0 then
        raise exception 'Pfizer no se aplica a niños de 6 a 59 meses.' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
  return new;
end $$;

create or replace function public.covid_trg_tope_abasto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_prev jsonb;
  m text;
  v_rep numeric; v_nuevo numeric; v_old numeric; v_otros numeric;
begin
  if (select auth.uid()) is null then return new; end if;
  select upper(p.rol) into v_rol from perfiles p where p.id = (select auth.uid());
  if v_rol is distinct from 'UNIDAD' then return new; end if;

  v_prev := case when tg_op = 'UPDATE' and old.fecha = new.fecha and old.clues = new.clues then old.valores else '{}'::jsonb end;

  foreach m in array array['MODERNA', 'PFIZER'] loop
    v_nuevo := covid_equivalentes_marca(new.valores, m);
    v_old := covid_equivalentes_marca(v_prev, m);
    continue when v_nuevo <= v_old;
    -- Recibido en toda la campaña (todas las entregas, de cualquier mes)
    select coalesce(sum(d.cantidad_frascos), 0) * covid_dosis_por_frasco(m) into v_rep
    from covid_distribucion_frascos d where d.clues = new.clues and d.anio_campana = new.anio_campana and d.marca = m;
    -- Aplicado en las demás semanas de la campaña (meses anteriores incluidos)
    select coalesce(sum(covid_equivalentes_marca(c.valores, m)), 0) into v_otros
    from covid_capturas c where c.clues = new.clues and c.anio_campana = new.anio_campana and c.fecha <> new.fecha;
    if v_otros + v_nuevo > v_rep then
      raise exception 'Con este reporte tu unidad habría aplicado % dosis de % y solo ha recibido % en la campaña (te pasas por %). Se cuenta todo lo aplicado en semanas y meses anteriores contra todo lo recibido. Revisa la captura o pide a tu municipio o Jurisdicción que registre la entrega de frascos.',
        round(v_otros + v_nuevo, 1), case m when 'PFIZER' then 'Pfizer' else 'Moderna' end, round(v_rep, 1), round(v_otros + v_nuevo - v_rep, 1)
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

revoke execute on function public.covid_trg_valida_captura() from public, anon, authenticated;
revoke execute on function public.covid_trg_tope_abasto() from public, anon, authenticated;
