-- ============================================================================
-- Todo número de lote se guarda en MAYÚSCULAS y sin espacios sobrantes, sin
-- importar cómo lo capture el usuario ("ab12 " -> "AB12"). Es un trigger en la
-- base (no depende de que cada pantalla lo recuerde) en cada tabla que guarda
-- números de lote. Los datos existentes ya estaban normalizados (verificado
-- 2026-10-01), así que no hace falta reescribir filas.
-- ============================================================================

create or replace function _normaliza_numero_lote()
returns trigger language plpgsql set search_path = public as $$
declare
  v_col text := tg_argv[0];
  v_json jsonb := to_jsonb(new);
begin
  if v_json ->> v_col is not null then
    new := jsonb_populate_record(new, jsonb_build_object(v_col, upper(btrim(v_json ->> v_col))));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lotes_mayusculas on lotes;
create trigger trg_lotes_mayusculas before insert or update of lote on lotes
  for each row execute function _normaliza_numero_lote('lote');

drop trigger if exists trg_biovac_lotes_mayusculas on biovac_lotes;
create trigger trg_biovac_lotes_mayusculas before insert or update of numero_lote on biovac_lotes
  for each row execute function _normaliza_numero_lote('numero_lote');

drop trigger if exists trg_requi_lotes_mayusculas on requi_lotes;
create trigger trg_requi_lotes_mayusculas before insert or update of numero_lote on requi_lotes
  for each row execute function _normaliza_numero_lote('numero_lote');

drop trigger if exists trg_existencia_detalle_lote_mayusculas on existencia_detalle;
create trigger trg_existencia_detalle_lote_mayusculas before insert or update of lote on existencia_detalle
  for each row execute function _normaliza_numero_lote('lote');

drop trigger if exists trg_influenza_dist_lote_mayusculas on influenza_distribucion_frascos;
create trigger trg_influenza_dist_lote_mayusculas before insert or update of lote on influenza_distribucion_frascos
  for each row execute function _normaliza_numero_lote('lote');
