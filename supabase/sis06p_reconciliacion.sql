-- =============================================================================
-- SIS-06-P <-> Movimiento de Biológico: conciliación con una sola fuente de
-- verdad, bloqueada del lado del servidor.
--
-- Ejecutar DESPUÉS de sis06p_estado_engine.sql: aquí se REDEFINEN
-- sis06p_enviar_para_validacion, sis06p_marcar_validado y
-- sis06p_resumen_seguimiento (las versiones de ese archivo quedan
-- reemplazadas).
--
-- Qué arregla:
--  1. El comparativo Paloteo vs Aplicado se armaba en JS cruzando la `clave`
--     de BioVac contra el texto `biologico` de sis_variables con nombres
--     ADIVINADOS ('HEXAVALENTE', 'ROTAVIRUS', 'SRP', 'SR', 'TD', 'TDPA',
--     'NEUMOCÓCICA 13'...) que NO existen tal cual en sis_variables
--     ('HEXAVALENTE ACELULAR DPaT + IPV + Hib + HB', 'ROTAVIRUS RV1', 'S R P
--     TRIPLE VIRAL', 'Td TETÁNICO DIFTÉRICO'...). Resultado: 7 de 16
--     biológicos siempre daban paloteo=0 y salían como "Revisar" aunque la
--     unidad sí hubiera capturado. Ahora el mapeo vive en una tabla
--     (sis_biovac_mapa) que se valida contra los catálogos reales al crearla.
--  2. La comparación solo AVISABA. Ahora la unidad NO puede enviar (ni el
--     municipal validar) mientras las dosis aplicadas del paloteo no sean
--     iguales a las del Movimiento, biológico por biológico.
--  3. "Enviar" cerraba el Movimiento desde el navegador ANTES de llamar al
--     RPC de envío: si el envío fallaba (ventana, diferencias) el Movimiento
--     ya quedaba CERRADO y la unidad no podía corregirlo. Ahora cierre +
--     envío son UNA sola transacción en el servidor: o pasa todo o no pasa
--     nada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mapeo biológico BioVac -> grupo de sis_variables.biologico
-- ---------------------------------------------------------------------------

create table if not exists sis_biovac_mapa (
  biovac_clave text primary key,
  sis_biologico text not null,
  etiqueta text not null
);

alter table sis_biovac_mapa enable row level security;
drop policy if exists "RLS_sis_biovac_mapa_Read" on sis_biovac_mapa;
create policy "RLS_sis_biovac_mapa_Read" on sis_biovac_mapa for select to authenticated using (true);

-- El texto de sis_variables.biologico se resuelve por patrón (LIKE) y NO se
-- escribe a mano: si un patrón no encuentra exactamente 1 grupo, el INSERT
-- falla (subconsulta con >1 fila) o el bloque de verificación de abajo
-- levanta excepción -- nunca se queda un mapeo colgado en silencio.
-- ANTIINFLUENZA -> 'INFLUENZA' es especial: no vive en sis_variables sino en
-- influenza_capturas (ver _sis06p_comparativo_calc).
-- NEUMO_23V no tiene grupo en SIS-06-P (solo existen 13 y 20 valente) -- se
-- deja fuera a propósito.
delete from sis_biovac_mapa;
insert into sis_biovac_mapa (biovac_clave, sis_biologico, etiqueta)
select p.clave,
       case when p.patron = 'INFLUENZA' then 'INFLUENZA'
            else (select distinct v.biologico from sis_variables v where v.biologico like p.patron) end,
       p.etiqueta
from (values
  ('BCG',           'BCG',            'B.C.G.'),
  ('HEPB',          'HEPATITIS B',    'Hepatitis "B" (pediátrica cuenta ½)'),
  ('HEXAVALENTE',   'HEXAVALENTE%',   'Hexavalente'),
  ('DPT',           'DPT',            'DPT'),
  ('ROTAVIRUS',     'ROTAVIRUS%',     'Rotavirus RV1'),
  ('NEUMO_13V',     'NEUMOC%13%',     'Neumocócica conjugada (13 valente)'),
  ('NEUMO_20V',     'NEUMOC%20%',     'Neumocócica conjugada (20 valente)'),
  ('SRP',           'S R P%',         'SRP Triple Viral'),
  ('SR',            'SR DOBLE%',      'SR'),
  ('VARICELA',      'VARICELA%',      'Varicela'),
  ('HEPA',          'HEPATITIS A',    'Hepatitis "A"'),
  ('VPH',           'VPH',            'VPH'),
  ('TD',            'Td %',           'Td'),
  ('TDPA',          'Tdpa',           'TDPa'),
  ('VSR',           'VSR',            'VSR'),
  ('COVID_MODERNA', 'COVID-19',       'COVID-19 (6 a 59 meses cuenta ½)'),
  ('COVID_PFIZER',  'COVID-19',       'COVID-19 (6 a 59 meses cuenta ½)'),
  ('ANTIINFLUENZA', 'INFLUENZA',      'Influenza estacional')
) as p(clave, patron, etiqueta);

do $$
begin
  if exists (select 1 from sis_biovac_mapa m where m.sis_biologico is null) then
    raise exception 'sis_biovac_mapa: un patrón no encontró grupo en sis_variables.';
  end if;
  if exists (
    select 1 from sis_biovac_mapa m
    where not exists (select 1 from biovac_catalogo_biologicos cb where cb.clave = m.biovac_clave)
  ) then
    raise exception 'sis_biovac_mapa: una clave BioVac no existe en biovac_catalogo_biologicos.';
  end if;
  if exists (
    select 1 from sis_biovac_mapa m
    where m.sis_biologico <> 'INFLUENZA'
      and not exists (select 1 from sis_variables v where v.biologico = m.sis_biologico)
  ) then
    raise exception 'sis_biovac_mapa: un grupo SIS no existe en sis_variables.';
  end if;
end $$;

-- Filas de SIS-06-P cuya dosis es PEDIÁTRICA y cuenta como media dosis de
-- frasco-adulto (misma regla que el Excel municipal, hoja SEGUIMIENTO DE
-- BIOLOGICO, columna VALIDACIÓN: Hepatitis B = VAC06/2 + VHB01..VHB06;
-- COVID = (VCV38+VCV39+VCV40)/2 + refuerzos) y que en Movimiento equivale a
-- la regla SPLIT_DOSE (aplicadas_a / 2 + aplicadas_b).
alter table sis_variables add column if not exists media_dosis boolean not null default false;
update sis_variables set media_dosis = coalesce(clave_general in ('VAC06','VCV38','VCV39','VCV40'), false);

do $$
begin
  if (select count(*) from sis_variables where media_dosis) <> 4 then
    raise exception 'sis_variables.media_dosis: se esperaban exactamente 4 filas (VAC06, VCV38, VCV39, VCV40).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cálculo (interno) -- paloteo vs aplicado por grupo, para UNA CLUES
--    Paloteo: suma de `total` (nunca afro/indigena/migrante, que son
--    subconjunto del total) de las filas del grupo en sis06p_capturas; las
--    filas media_dosis (pediátricas de Hepatitis B y COVID) cuentan ½.
--    Aplicado: aplicadas_a + aplicadas_b (ya en DOSIS -- nunca la división
--    entre dosis_por_frasco, que es para frascos) de TODOS los renglones
--    (NORMAL/ARF/CANJE) de los biológicos del grupo en el Movimiento del mes;
--    en biológicos SPLIT_DOSE (Hepatitis B, COVID Moderna) es a/2 + b.
--    Influenza: suma de todos los rubros de influenza_capturas cuya `fecha`
--    cae en ese mes calendario (mismo criterio que el CSV).
-- ---------------------------------------------------------------------------

create or replace function _sis06p_comparativo_calc(p_clues text, p_mes int, p_anio int)
returns table (grupo text, etiqueta text, claves text[], paloteo numeric, aplicado numeric)
language sql
stable
security definer
set search_path = public
as $$
  with grupos as (
    select m.sis_biologico as gr, min(m.etiqueta) as etq, array_agg(m.biovac_clave order by m.biovac_clave) as cls
    from sis_biovac_mapa m
    group by m.sis_biologico
  ),
  palo as (
    select v.biologico as gr,
           sum(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'total', '')::numeric, 0)
               * case when v.media_dosis then 0.5 else 1 end) as n
    from sis06p_capturas c
    cross join sis_variables v
    where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio and v.activo
    group by v.biologico
  ),
  inf as (
    select coalesce(sum(case when kv.value ~ '^[0-9]+(\.[0-9]+)?$' then kv.value::numeric else 0 end), 0) as n
    from influenza_capturas ic
    cross join lateral jsonb_each_text(coalesce(ic.valores, '{}'::jsonb)) kv
    where ic.clues = p_clues
      and extract(month from ic.fecha) = p_mes
      and extract(year from ic.fecha) = p_anio
  ),
  apl as (
    select m.sis_biologico as gr,
           sum(case when cb.regla_especial = 'SPLIT_DOSE'
                    then coalesce(r.aplicadas_a, 0) / 2 + coalesce(r.aplicadas_b, 0)
                    else coalesce(r.aplicadas_a, 0) + coalesce(r.aplicadas_b, 0) end) as n
    from biovac_unidades bu
    join biovac_movimientos mv on mv.unidad_id = bu.id and mv.mes = p_mes and mv.anio = p_anio
    join biovac_renglones r on r.movimiento_id = mv.id
    join biovac_lotes l on l.id = r.lote_id
    join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
    join sis_biovac_mapa m on m.biovac_clave = cb.clave
    where bu.clues = p_clues
    group by m.sis_biologico
  )
  select g.gr, g.etq, g.cls,
         coalesce(case when g.gr = 'INFLUENZA' then (select n from inf) else palo.n end, 0),
         coalesce(apl.n, 0)
  from grupos g
  left join palo on palo.gr = g.gr
  left join apl on apl.gr = g.gr
  order by g.etq;
$$;

revoke all on function _sis06p_comparativo_calc(text, int, int) from public;
revoke all on function _sis06p_comparativo_calc(text, int, int) from anon;
revoke all on function _sis06p_comparativo_calc(text, int, int) from authenticated;

-- Texto de las diferencias para mensajes de error -- NULL si todo coincide.
create or replace function _sis06p_diferencias_texto(p_clues text, p_mes int, p_anio int)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(
           format('%s (paloteo %s, aplicado en Movimiento %s)', d.etiqueta, trim_scale(d.paloteo)::text, trim_scale(d.aplicado)::text),
           '; ' order by d.etiqueta)
  from _sis06p_comparativo_calc(p_clues, p_mes, p_anio) d
  where d.paloteo <> d.aplicado;
$$;

revoke all on function _sis06p_diferencias_texto(text, int, int) from public;
revoke all on function _sis06p_diferencias_texto(text, int, int) from anon;
revoke all on function _sis06p_diferencias_texto(text, int, int) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comparativo para el cliente -- una fila por (unidad, grupo) con algo
--    que comparar, acotado al alcance REAL del llamante (rol resuelto vía
--    auth.uid(), nunca un parámetro del cliente).
-- ---------------------------------------------------------------------------

create or replace function sis06p_comparativo(p_mes int, p_anio int, p_clues text default null)
returns table (
  clues text, unidad text, municipio text,
  grupo text, etiqueta text, claves text[],
  paloteo numeric, aplicado numeric, coincide boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues text;
  v_municipios text[];
begin
  select upper(p.rol), p.clues, p.municipios_allowed into v_rol, v_clues, v_municipios
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null then
    raise exception 'Perfil no encontrado o inactivo.';
  end if;

  return query
  select bu.clues, bu.nombre, bu.municipio, c.grupo, c.etiqueta, c.claves, c.paloteo, c.aplicado, (c.paloteo = c.aplicado)
  from biovac_unidades bu
  cross join lateral _sis06p_comparativo_calc(bu.clues, p_mes, p_anio) c
  where bu.activo = true
    and bu.clues not like 'JS1-%'
    and (p_clues is null or bu.clues = p_clues)
    and case v_rol
          when 'UNIDAD' then bu.clues = v_clues
          when 'MUNICIPAL' then bu.municipio = any(v_municipios)
          when 'JURISDICCIONAL' then true
          when 'VISUALIZADOR_JURISDICCIONAL' then true
          when 'ADMIN' then true
          else false
        end
    and (c.paloteo <> 0 or c.aplicado <> 0)
  order by bu.clues, c.etiqueta;
end;
$$;

revoke all on function sis06p_comparativo(int, int, text) from public;
revoke all on function sis06p_comparativo(int, int, text) from anon;
grant execute on function sis06p_comparativo(int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Enviar para validación: TODO en una transacción -- ventana, Movimiento
--    existente, conciliación, cierre del Movimiento y cambio de estado.
-- ---------------------------------------------------------------------------

create or replace function sis06p_enviar_para_validacion(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues_perfil text;
  v_clues_fila text;
  v_mes int;
  v_anio int;
  v_municipio text;
  v_estado text;
  v_ventana record;
  v_unidad_id uuid;
  v_mov_id uuid;
  v_mov_estado text;
  v_dif text;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is distinct from 'UNIDAD' then
    raise exception 'Solo la unidad puede enviar su propio concentrado.';
  end if;

  select clues, municipio, mes, anio, estado
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado
  from sis06p_capturas where id = p_captura_id
  for update;

  if v_clues_fila is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if v_clues_fila is distinct from v_clues_perfil then
    raise exception 'No puedes enviar el concentrado de otra unidad.';
  end if;
  if v_estado <> 'BORRADOR' then
    raise exception 'Este concentrado ya está en estado %, no se puede volver a enviar.', v_estado;
  end if;

  select * into v_ventana from sis06p_ventana_envio(v_anio, v_mes);
  if not v_ventana.dentro_envio then
    raise exception 'Fuera de la ventana de envío (% a %). Solo se puede enviar entre el último día del mes y la semana siguiente.',
      v_ventana.inicio_envio, v_ventana.fin_envio;
  end if;

  -- El SIS es UN solo documento: paloteo + Movimiento de Biológico.
  select bu.id into v_unidad_id from biovac_unidades bu where bu.clues = v_clues_fila;
  if v_unidad_id is null then
    raise exception 'No se encontró tu unidad en el catálogo de BioVac.';
  end if;

  select id, estado into v_mov_id, v_mov_estado
  from biovac_movimientos
  where unidad_id = v_unidad_id and anio = v_anio and mes = v_mes
  for update;

  if v_mov_id is null then
    raise exception 'El SIS es un solo documento: primero captura el Movimiento de Biológico de este mes (pestaña Movimiento de Biológico), luego envíalo.';
  end if;
  if v_mov_estado = 'EN_CORRECCION' then
    raise exception 'El Movimiento de Biológico de este mes está en corrección -- guárdalo (botón "Guardar corrección") antes de enviar el SIS.';
  end if;

  -- Conciliación: las dosis aplicadas del paloteo deben ser iguales a las del
  -- Movimiento, biológico por biológico. Se revisa ANTES de cerrar el
  -- Movimiento para que un rechazo no deje nada bloqueado.
  v_dif := _sis06p_diferencias_texto(v_clues_fila, v_mes, v_anio);
  if v_dif is not null then
    raise exception 'No se puede enviar: el paloteo SIS-06-P y el Movimiento de Biológico no coinciden en: %. Corrige uno de los dos para que las dosis aplicadas sean iguales.', v_dif;
  end if;

  if v_mov_estado = 'BORRADOR' then
    -- Si el cierre falla (existencia final negativa, frasco BCG/SR a medio
    -- resolver) esta excepción revierte TODA la transacción: el estado de
    -- SIS-06-P no cambia.
    perform biovac_cerrar_mes(v_mov_id, p_usuario);
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'ENVIADO', enviado_en = now(), enviado_por = p_usuario,
      editado_por = 'UNIDAD', updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, 'UNIDAD', 'MARCADOR_ENVIADO', true);
end;
$$;

revoke all on function sis06p_enviar_para_validacion(uuid, text) from public;
revoke all on function sis06p_enviar_para_validacion(uuid, text) from anon;
grant execute on function sis06p_enviar_para_validacion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Marcar como validado: no se valida un SIS que no concilia.
-- ---------------------------------------------------------------------------

create or replace function sis06p_marcar_validado(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios_allowed text[];
  v_clues_fila text;
  v_municipio text;
  v_mes int;
  v_anio int;
  v_estado text;
  v_dif text;
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios_allowed
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    raise exception 'Rol % no puede validar concentrados.', v_rol;
  end if;

  select clues, municipio, mes, anio, estado
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado
  from sis06p_capturas where id = p_captura_id
  for update;

  if v_clues_fila is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if v_rol = 'MUNICIPAL' and not (v_municipio = any(v_municipios_allowed)) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;
  if v_estado <> 'ENVIADO' then
    raise exception 'Solo se puede validar un concentrado ENVIADO (estado actual: %).', v_estado;
  end if;

  v_dif := _sis06p_diferencias_texto(v_clues_fila, v_mes, v_anio);
  if v_dif is not null then
    raise exception 'No se puede validar: el paloteo SIS-06-P y el Movimiento de Biológico no coinciden en: %. Corrige el que esté mal (modo revisión) y vuelve a validar.', v_dif;
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'VALIDADO', validado_en = now(), validado_por = p_usuario,
      editado_por = v_rol, updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_VALIDADO', true);
end;
$$;

revoke all on function sis06p_marcar_validado(uuid, text) from public;
revoke all on function sis06p_marcar_validado(uuid, text) from anon;
grant execute on function sis06p_marcar_validado(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seguimiento: mismas columnas de siempre + avance real de cada mitad del
--    SIS (paloteo y Movimiento) y # de diferencias, para que el revisor vea
--    de un vistazo por qué una unidad "no avanza".
-- ---------------------------------------------------------------------------

drop function if exists sis06p_resumen_seguimiento(int, int);

create or replace function sis06p_resumen_seguimiento(p_mes int, p_anio int)
returns table (
  clues text,
  unidad text,
  municipio text,
  estado text,
  capturado_por text,
  enviado_por text,
  validado_por text,
  enviado_en timestamptz,
  validado_en timestamptz,
  correcciones_pendientes int,
  paloteo_dosis numeric,
  movimiento_estado text,
  movimiento_lotes int,
  diferencias int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_municipios_allowed text[];
begin
  select upper(p.rol), p.municipios_allowed into v_rol, v_municipios_allowed
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol not in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    raise exception 'Rol % no tiene panel de seguimiento.', v_rol;
  end if;

  return query
  select
    bu.clues,
    bu.nombre,
    bu.municipio,
    coalesce(c.estado, case when m.id is not null then 'BORRADOR' else 'SIN_INICIAR' end),
    coalesce(c.capturado_por, m.responsable_elaboracion),
    c.enviado_por,
    c.validado_por,
    c.enviado_en,
    c.validado_en,
    coalesce((
      select count(*)::int from sis06p_correcciones sc
      where sc.captura_id = c.id and sc.tipo = 'EDICION_MUNICIPAL' and sc.reconocido_por_unidad = false
    ), 0),
    coalesce((
      select sum(coalesce(nullif(x.value ->> 'total', '')::numeric, 0))
      from jsonb_each(coalesce(c.valores, '{}'::jsonb)) x
    ), 0),
    m.estado,
    coalesce((select count(*)::int from biovac_renglones r where r.movimiento_id = m.id), 0),
    coalesce((
      select count(*)::int from _sis06p_comparativo_calc(bu.clues, p_mes, p_anio) d where d.paloteo <> d.aplicado
    ), 0)
  from biovac_unidades bu
  left join sis06p_capturas c
    on c.clues = bu.clues and c.mes = p_mes and c.anio = p_anio
  left join biovac_movimientos m
    on m.unidad_id = bu.id and m.mes = p_mes and m.anio = p_anio
  where bu.activo = true
    and bu.clues not like 'JS1-%'
    and (v_rol in ('JURISDICCIONAL','ADMIN') or bu.municipio = any(v_municipios_allowed))
  order by bu.clues;
end;
$$;

revoke all on function sis06p_resumen_seguimiento(int, int) from public;
revoke all on function sis06p_resumen_seguimiento(int, int) from anon;
grant execute on function sis06p_resumen_seguimiento(int, int) to authenticated;
