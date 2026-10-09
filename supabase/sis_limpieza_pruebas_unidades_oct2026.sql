-- ===========================================================================
-- Limpieza ÚNICA (ya aplicada en producción el 2026-10-09): lo que las pruebas de SEPTIEMBRE de las unidades
-- dejaron sembrado en OCTUBRE. El flujo por unidad entra en vigor en octubre; septiembre no debe afectarlo.
--
--  * Solo unidades REALES que NO son hospital (clues no JS1-, municipio no NHG/HENM). Los hospitales NHG/HENM se
--    cuentan aparte y NO se tocan.
--  * Se borra: (a) movimientos de octubre en adelante que una unidad dejó CERRADOS sin haber enviado su SINBA-SIS
--    (cierre de prueba) y los meses sembrados a partir de ellos; (b) renglones de octubre cuya existencia anterior es
--    solo la copia del cierre de un mes de prueba y que no tienen ninguna captura.
--  * ANTES de borrar, cada fila queda respaldada en respaldo_limpieza_oct2026 (jsonb): se puede restaurar.
--  * Los movimientos y capturas de septiembre de las unidades NO se borran: quedan aislados (los meses de prueba ya no
--    arrastran existencia al arranque, ver _biovac_es_mes_de_prueba en sis_movimiento_municipio_automatico.sql).
-- Resultado: 2 movimientos (UMME MÉDICO DENTAL oct y nov, de prueba) y 39 renglones sembrados
-- (PEDRO ESCOBEDO 16, SANTA MARÍA MAGDALENA 11, SAN JOSÉ EL ALTO 12).
-- NO es idempotente en el sentido de re-ejecutarse tras nuevas capturas: solo actúa sobre lo descrito.
-- ===========================================================================

create table if not exists respaldo_limpieza_oct2026 (
  id bigserial primary key,
  tabla text not null,
  fila jsonb not null,
  motivo text not null,
  respaldado_en timestamptz not null default now()
);
alter table respaldo_limpieza_oct2026 enable row level security;
revoke all on respaldo_limpieza_oct2026 from anon, authenticated;

do $do$
declare
  v_inicio date;
  n_ren int := 0; n_mov int := 0; n_cor int := 0;
begin
  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if v_inicio is null then raise exception 'Falta sis_config.inicio_captura_por_unidad'; end if;
  perform set_config('biovac.bypass_lock', 'on', true);

  create temp table _mov_borrar on commit drop as
  select m.id
  from biovac_movimientos m join biovac_unidades u on u.id = m.unidad_id
  where u.clues not like 'JS1-%' and u.municipio not in ('NHG', 'HENM')
    and make_date(m.anio, m.mes, 1) >= v_inicio
    and m.estado = 'CERRADO'
    and not exists (select 1 from sis06p_capturas c where c.clues = u.clues and c.anio = m.anio and c.mes = m.mes and c.estado in ('ENVIADO', 'VALIDADO'));

  insert into _mov_borrar
  select m2.id
  from biovac_movimientos m2 join biovac_unidades u2 on u2.id = m2.unidad_id
  where u2.clues not like 'JS1-%' and u2.municipio not in ('NHG', 'HENM')
    and make_date(m2.anio, m2.mes, 1) >= v_inicio and m2.estado = 'BORRADOR'
    and not exists (select 1 from biovac_renglones x where x.movimiento_id = m2.id and (x.recibido_frascos <> 0 or x.aplicadas_a <> 0 or x.aplicadas_b <> 0 or x.desechadas_a <> 0 or x.desechadas_b <> 0))
    and exists (select 1 from biovac_movimientos pm join _mov_borrar b on b.id = pm.id
                where pm.unidad_id = m2.unidad_id and (pm.anio * 12 + pm.mes) < (m2.anio * 12 + m2.mes))
    and m2.id not in (select id from _mov_borrar);

  create temp table _ren_borrar on commit drop as
  select r.id
  from biovac_renglones r join biovac_movimientos m on m.id = r.movimiento_id join biovac_unidades u on u.id = m.unidad_id
  where u.clues not like 'JS1-%' and u.municipio not in ('NHG', 'HENM')
    and make_date(m.anio, m.mes, 1) >= v_inicio
    and m.estado = 'BORRADOR'
    and m.id not in (select id from _mov_borrar)
    and not exists (select 1 from biovac_renglones x where x.movimiento_id = m.id and (x.recibido_frascos <> 0 or x.aplicadas_a <> 0 or x.aplicadas_b <> 0 or x.desechadas_a <> 0 or x.desechadas_b <> 0))
    and not exists (select 1 from sis06p_capturas c where c.clues = u.clues and c.anio = m.anio and c.mes = m.mes and c.estado <> 'BORRADOR')
    and exists (select 1 from biovac_movimientos pm join biovac_renglones pr on pr.movimiento_id = pm.id
                where pm.unidad_id = m.unidad_id and (pm.anio * 12 + pm.mes) = (m.anio * 12 + m.mes) - 1 and make_date(pm.anio, pm.mes, 1) < v_inicio
                  and pr.lote_id = r.lote_id and pr.categoria = r.categoria and abs(pr.existencia_final_frascos - r.existencia_anterior_frascos) < 0.001);

  insert into respaldo_limpieza_oct2026 (tabla, fila, motivo)
  select 'biovac_movimientos', to_jsonb(m), 'Movimiento de prueba de una unidad cerrado fuera del flujo real (o sembrado a partir de él)'
  from biovac_movimientos m where m.id in (select id from _mov_borrar);
  insert into respaldo_limpieza_oct2026 (tabla, fila, motivo)
  select 'biovac_renglones', to_jsonb(r), 'Renglón de un movimiento de prueba que se elimina'
  from biovac_renglones r where r.movimiento_id in (select id from _mov_borrar);
  insert into respaldo_limpieza_oct2026 (tabla, fila, motivo)
  select 'biovac_correcciones', to_jsonb(c), 'Corrección de un movimiento de prueba que se elimina'
  from biovac_correcciones c where c.movimiento_id in (select id from _mov_borrar);
  insert into respaldo_limpieza_oct2026 (tabla, fila, motivo)
  select 'biovac_renglones', to_jsonb(r), 'Existencia anterior sembrada desde un mes de prueba de septiembre (sin captura de octubre)'
  from biovac_renglones r where r.id in (select id from _ren_borrar);

  delete from biovac_correcciones where movimiento_id in (select id from _mov_borrar);
  get diagnostics n_cor = row_count;
  delete from biovac_movimientos where id in (select id from _mov_borrar);
  get diagnostics n_mov = row_count;
  delete from biovac_renglones where id in (select id from _ren_borrar);
  get diagnostics n_ren = row_count;

  perform set_config('biovac.bypass_lock', 'off', true);
  raise notice 'Limpieza: % movimientos, % renglones sembrados, % correcciones (respaldados en respaldo_limpieza_oct2026)', n_mov, n_ren, n_cor;
end
$do$;
