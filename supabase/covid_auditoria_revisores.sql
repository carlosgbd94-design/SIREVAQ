-- =============================================================================
-- COVID-19: lo que cambie un revisor (MUNICIPAL / JURISDICCIONAL / ADMIN) en un mes de SIS ya enviado queda en el
-- control de cambios de la unidad, igual que Influenza (influenza_trg_auditoria_sis). Idempotente.
-- =============================================================================
create or replace function covid_trg_auditoria_sis() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_clues text;
  v_fecha date;
  v_old jsonb;
  v_new jsonb;
  v_hist jsonb;
  v_usuario text;
  v_cap record;
  m text;
  r text;
  v_a text;
  v_b text;
begin
  v_rol := _sis_rol_actual();
  if v_rol is null or v_rol = 'UNIDAD' then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    v_clues := old.clues; v_fecha := old.fecha; v_old := old.valores; v_new := '{}'::jsonb; v_hist := old.historial_ediciones;
  elsif tg_op = 'INSERT' then
    v_clues := new.clues; v_fecha := new.fecha; v_old := '{}'::jsonb; v_new := new.valores; v_hist := new.historial_ediciones;
  else
    v_clues := new.clues; v_fecha := new.fecha; v_old := old.valores; v_new := new.valores; v_hist := new.historial_ediciones;
  end if;

  select c.id, c.municipio, c.estado into v_cap
  from sis06p_capturas c
  where c.clues = v_clues and c.mes = extract(month from v_fecha)::int and c.anio = extract(year from v_fecha)::int;
  if v_cap.id is null or v_cap.estado = 'BORRADOR' then return coalesce(new, old); end if;

  v_usuario := coalesce(nullif(trim(coalesce(v_hist -> (jsonb_array_length(v_hist) - 1) ->> 'usuario', '')), ''), v_rol);

  foreach m in array array['MODERNA', 'PFIZER'] loop
    foreach r in array array['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] loop
      v_a := coalesce(nullif(v_old -> m ->> r, ''), '0');
      v_b := coalesce(nullif(v_new -> m ->> r, ''), '0');
      if v_a ~ '^-?[0-9]+(\.[0-9]+)?$' and v_b ~ '^-?[0-9]+(\.[0-9]+)?$' and v_a::numeric <> v_b::numeric then
        insert into sis06p_correcciones
          (captura_id, clues, municipio, mes, anio, detalle, usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
        values
          (v_cap.id, v_clues, v_cap.municipio, extract(month from v_fecha)::int, extract(year from v_fecha)::int,
           'COVID-19 ' || case when m = 'PFIZER' then 'Pfizer' else 'Moderna' end || ', semana del ' || to_char(v_fecha, 'DD/MM') || ' (' || r || ')',
           v_usuario, v_rol, v_a, v_b, 'EDICION_MUNICIPAL', false);
      end if;
    end loop;
  end loop;

  return coalesce(new, old);
end;
$$;
revoke all on function covid_trg_auditoria_sis() from public, anon, authenticated;
drop trigger if exists covid_trg_auditoria_sis on covid_capturas;
create trigger covid_trg_auditoria_sis after insert or update or delete on covid_capturas
  for each row execute function covid_trg_auditoria_sis();
