-- =============================================================================
-- COMODÍN de sustitución (regla federal): si se aplica SRP en lugar de SR, el
-- paloteo la reporta como SR pero el Movimiento la da de baja como SRP. Igual
-- TdPa en lugar de DPT. La unidad DECLARA cuántas dosis fueron (el comodín) en
-- `sis06p_capturas.ajustes` y la conciliación queda exacta biológico por
-- biológico:
--     SR  : paloteo SR            = aplicado SR  + SRP_COMO_SR
--     SRP : paloteo SRP + SRP_COMO_SR = aplicado SRP
--     DPT : paloteo DPT           = aplicado DPT + TDPA_COMO_DPT
--     TdPa: paloteo TdPa + TDPA_COMO_DPT = aplicado TdPa
-- Guardas: el comodín no puede ser mayor a lo que de verdad hay de un lado y
-- del otro (SRP_COMO_SR <= paloteo SR y <= aplicado SRP; TDPA_COMO_DPT <=
-- paloteo DPT y <= aplicado TdPa); si lo es, se IGNORA (la diferencia sigue
-- marcada) y la etiqueta lo dice. Sin comodín declarado, cualquier diferencia
-- SR/SRP o DPT/TdPa bloquea el envío/validación como cualquier otra.
-- Ejecutar DESPUÉS de sis06p_reconciliacion.sql y sis06p_reconciliacion_grupos.sql
-- (esto deja SR/SRP/DPT/TdPa como grupos individuales otra vez).
-- =============================================================================

alter table sis06p_capturas add column if not exists ajustes jsonb not null default '{}'::jsonb;
alter table sis06p_capturas drop constraint if exists sis06p_capturas_ajustes_obj;
alter table sis06p_capturas add constraint sis06p_capturas_ajustes_obj check (jsonb_typeof(ajustes) = 'object');

alter table sis06p_correcciones add column if not exists detalle text;

-- Validación de ajustes: solo las 2 llaves conocidas, valores numéricos >= 0.
create or replace function sis06p_trg_05_valida_ajustes() returns trigger
language plpgsql
as $$
declare
  v_key text;
  v_val text;
begin
  for v_key in select jsonb_object_keys(coalesce(new.ajustes, '{}'::jsonb)) loop
    if v_key not in ('SRP_COMO_SR', 'TDPA_COMO_DPT') then
      raise exception 'Ajuste desconocido: %.', v_key;
    end if;
    v_val := new.ajustes ->> v_key;
    if v_val is null or v_val !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'El ajuste % debe ser un número mayor o igual a 0.', v_key;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_sis06p_05_ajustes on sis06p_capturas;
create trigger trg_sis06p_05_ajustes
before insert or update on sis06p_capturas
for each row execute function sis06p_trg_05_valida_ajustes();

revoke all on function sis06p_trg_05_valida_ajustes() from public;
revoke all on function sis06p_trg_05_valida_ajustes() from anon;
revoke all on function sis06p_trg_05_valida_ajustes() from authenticated;

-- Auditoría de ajustes editados por un revisor (mismo esquema que `valores`):
-- se reutiliza tipo EDICION_MUNICIPAL (así la unidad los ve y acepta igual).
create or replace function sis06p_trg_10_bloqueo_y_auditoria() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_clues text;
  v_municipios_allowed text[];
  v_fila text;
  v_kind text;
  v_old_val text;
  v_new_val text;
  v_key text;
begin
  if coalesce(current_setting('sis06p.bypass_lock', true), 'off') = 'on' then
    return new;
  end if;

  select upper(p.rol), p.clues, p.municipios_allowed
    into v_rol, v_clues, v_municipios_allowed
  from perfiles p
  where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null then
    raise exception 'Perfil no encontrado o inactivo.';
  end if;

  if v_rol = 'UNIDAD' then
    if v_clues is distinct from new.clues then
      raise exception 'No puedes escribir en el registro de otra unidad.';
    end if;
    if TG_OP = 'UPDATE' and old.estado <> 'BORRADOR' then
      raise exception 'Este concentrado ya fue enviado (estado: %). No puedes editarlo directamente.', old.estado;
    end if;
    new.estado := 'BORRADOR';
    if TG_OP = 'UPDATE' then
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
    else
      new.enviado_en := null;
      new.enviado_por := null;
      new.validado_en := null;
      new.validado_por := null;
    end if;
    new.editado_por := 'UNIDAD';
    return new;
  end if;

  if v_rol in ('MUNICIPAL','JURISDICCIONAL','ADMIN') then
    if v_rol = 'MUNICIPAL' and not (new.municipio = any(v_municipios_allowed)) then
      raise exception 'Fuera de tu alcance de municipios.';
    end if;

    if v_rol in ('MUNICIPAL','JURISDICCIONAL') and TG_OP = 'UPDATE' then
      new.estado := old.estado;
      new.enviado_en := old.enviado_en;
      new.enviado_por := old.enviado_por;
      new.validado_en := old.validado_en;
      new.validado_por := old.validado_por;
    end if;

    if TG_OP = 'UPDATE' and old.estado in ('ENVIADO','VALIDADO')
       and (new.valores is distinct from old.valores or new.ajustes is distinct from old.ajustes) then
      if new.ultimo_editor_usuario is null or length(trim(new.ultimo_editor_usuario)) = 0 then
        raise exception 'Falta identificar quién hizo el cambio (ultimo_editor_usuario).';
      end if;
    end if;

    if TG_OP = 'UPDATE' and old.estado in ('ENVIADO','VALIDADO')
       and new.valores is distinct from old.valores then
      for v_fila in
        select distinct k from (
          select jsonb_object_keys(coalesce(old.valores, '{}'::jsonb)) k
          union
          select jsonb_object_keys(coalesce(new.valores, '{}'::jsonb)) k
        ) t
      loop
        foreach v_kind in array array['total','afro','indigena','migrante']
        loop
          v_old_val := old.valores #>> array[v_fila, v_kind];
          v_new_val := new.valores #>> array[v_fila, v_kind];
          if coalesce(v_old_val, '0') is distinct from coalesce(v_new_val, '0') then
            insert into sis06p_correcciones
              (captura_id, clues, municipio, mes, anio, fila_excel, subconteo,
               usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
            values
              (new.id, new.clues, new.municipio, new.mes, new.anio, v_fila::int, v_kind,
               new.ultimo_editor_usuario, v_rol, coalesce(v_old_val, '0'), coalesce(v_new_val, '0'),
               'EDICION_MUNICIPAL', false);
          end if;
        end loop;
      end loop;
    end if;

    if TG_OP = 'UPDATE' and old.estado in ('ENVIADO','VALIDADO')
       and new.ajustes is distinct from old.ajustes then
      for v_key in
        select distinct k from (
          select jsonb_object_keys(coalesce(old.ajustes, '{}'::jsonb)) k
          union
          select jsonb_object_keys(coalesce(new.ajustes, '{}'::jsonb)) k
        ) t
      loop
        v_old_val := coalesce(old.ajustes ->> v_key, '0');
        v_new_val := coalesce(new.ajustes ->> v_key, '0');
        if v_old_val::numeric is distinct from v_new_val::numeric then
          insert into sis06p_correcciones
            (captura_id, clues, municipio, mes, anio, detalle,
             usuario, rol, valor_anterior, valor_nuevo, tipo, reconocido_por_unidad)
          values
            (new.id, new.clues, new.municipio, new.mes, new.anio,
             case v_key when 'SRP_COMO_SR' then 'Ajuste: SRP aplicada como SR' else 'Ajuste: TdPa aplicada como DPT' end,
             new.ultimo_editor_usuario, v_rol, v_old_val, v_new_val,
             'EDICION_MUNICIPAL', false);
        end if;
      end loop;
    end if;

    new.editado_por := v_rol;
    return new;
  end if;

  raise exception 'Rol % no autorizado para escribir en sis06p_capturas.', v_rol;
end;
$$;

revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from public;
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from anon;
revoke all on function sis06p_trg_10_bloqueo_y_auditoria() from authenticated;

-- SR / SRP / DPT / TdPa vuelven a ser grupos individuales (el ajuste del
-- comodín los concilia; ya no se suman "juntos" a ciegas).
update sis_biovac_mapa set grupo_conciliacion = 'SR DOBLE VIRAL', etiqueta = 'SR' where biovac_clave = 'SR';
update sis_biovac_mapa set grupo_conciliacion = 'S R P  TRIPLE VIRAL', etiqueta = 'SRP Triple Viral' where biovac_clave = 'SRP';
update sis_biovac_mapa set grupo_conciliacion = 'DPT', etiqueta = 'DPT' where biovac_clave = 'DPT';
update sis_biovac_mapa set grupo_conciliacion = 'Tdpa', etiqueta = 'TDPa' where biovac_clave = 'TDPA';

do $$
begin
  if exists (select 1 from sis_biovac_mapa where biovac_clave in ('SR','SRP','DPT','TDPA') and grupo_conciliacion <> sis_biologico) then
    raise exception 'sis_biovac_mapa: SR/SRP/DPT/TDPA deben quedar como grupos individuales.';
  end if;
end $$;

-- Cálculo con comodín. Devuelve además cuánto del comodín se sumó a cada lado.
drop function if exists sis06p_comparativo(int, int, text);
drop function if exists _sis06p_comparativo_calc(text, int, int);

create or replace function _sis06p_comparativo_calc(p_clues text, p_mes int, p_anio int)
returns table (grupo text, etiqueta text, claves text[], paloteo numeric, aplicado numeric,
               ajuste_paloteo numeric, ajuste_aplicado numeric)
language sql
stable
security definer
set search_path = public
as $$
  with grupos as (
    select m.grupo_conciliacion as gr, min(m.etiqueta) as etq, array_agg(m.biovac_clave order by m.biovac_clave) as cls
    from sis_biovac_mapa m
    group by m.grupo_conciliacion
  ),
  gsis as (
    select distinct m.sis_biologico as sb, m.grupo_conciliacion as gr from sis_biovac_mapa m
  ),
  palo as (
    select gsis.gr,
           sum(coalesce(nullif(c.valores -> (v.fila_excel::text) ->> 'total', '')::numeric, 0)
               * case when v.media_dosis then 0.5 else 1 end) as n
    from sis06p_capturas c
    cross join sis_variables v
    join gsis on gsis.sb = v.biologico
    where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio and v.activo
    group by gsis.gr
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
    select m.grupo_conciliacion as gr,
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
    group by m.grupo_conciliacion
  ),
  base as (
    select g.gr, g.etq, g.cls,
           coalesce(case when g.gr = 'INFLUENZA' then (select n from inf) else palo.n end, 0) as p,
           coalesce(apl.n, 0) as a
    from grupos g
    left join palo on palo.gr = g.gr
    left join apl on apl.gr = g.gr
  ),
  aj as (
    select coalesce((select nullif(c.ajustes ->> 'SRP_COMO_SR', '')::numeric from sis06p_capturas c
                     where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio), 0) as srp_sr,
           coalesce((select nullif(c.ajustes ->> 'TDPA_COMO_DPT', '')::numeric from sis06p_capturas c
                     where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio), 0) as tdpa_dpt
  ),
  ef as (
    select aj.srp_sr, aj.tdpa_dpt,
           case when aj.srp_sr > 0
                 and aj.srp_sr <= least((select p from base where cls = array['SR']::text[]),
                                        (select a from base where cls = array['SRP']::text[]))
                then aj.srp_sr else 0 end as n1,
           case when aj.tdpa_dpt > 0
                 and aj.tdpa_dpt <= least((select p from base where cls = array['DPT']::text[]),
                                          (select a from base where cls = array['TDPA']::text[]))
                then aj.tdpa_dpt else 0 end as n2
    from aj
  )
  select b.gr,
         b.etq || case
           when b.cls = array['SR']::text[]   and ef.n1 > 0 then format(' (+%s de SRP aplicadas como SR)', trim_scale(ef.n1))
           when b.cls = array['SR']::text[]   and ef.srp_sr > 0 then ' (comodín inválido: mayor a lo capturado)'
           when b.cls = array['SRP']::text[]  and ef.n1 > 0 then format(' (+%s aplicadas como SR)', trim_scale(ef.n1))
           when b.cls = array['SRP']::text[]  and ef.srp_sr > 0 then ' (comodín inválido: mayor a lo capturado)'
           when b.cls = array['DPT']::text[]  and ef.n2 > 0 then format(' (+%s de TdPa aplicadas como DPT)', trim_scale(ef.n2))
           when b.cls = array['DPT']::text[]  and ef.tdpa_dpt > 0 then ' (comodín inválido: mayor a lo capturado)'
           when b.cls = array['TDPA']::text[] and ef.n2 > 0 then format(' (+%s aplicadas como DPT)', trim_scale(ef.n2))
           when b.cls = array['TDPA']::text[] and ef.tdpa_dpt > 0 then ' (comodín inválido: mayor a lo capturado)'
           else '' end,
         b.cls,
         b.p + case when b.cls = array['SRP']::text[] then ef.n1 when b.cls = array['TDPA']::text[] then ef.n2 else 0 end,
         b.a + case when b.cls = array['SR']::text[]  then ef.n1 when b.cls = array['DPT']::text[]  then ef.n2 else 0 end,
         case when b.cls = array['SRP']::text[] then ef.n1 when b.cls = array['TDPA']::text[] then ef.n2 else 0 end,
         case when b.cls = array['SR']::text[]  then ef.n1 when b.cls = array['DPT']::text[]  then ef.n2 else 0 end
  from base b cross join ef
  order by b.etq;
$$;

revoke all on function _sis06p_comparativo_calc(text, int, int) from public;
revoke all on function _sis06p_comparativo_calc(text, int, int) from anon;
revoke all on function _sis06p_comparativo_calc(text, int, int) from authenticated;

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
         || case when bool_or(d.claves && array['SR','SRP','DPT','TDPA']::text[])
                 then ' Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT), captura el ajuste (comodín) en la pestaña SIS-06-P.'
                 else '' end
  from _sis06p_comparativo_calc(p_clues, p_mes, p_anio) d
  where d.paloteo <> d.aplicado;
$$;

revoke all on function _sis06p_diferencias_texto(text, int, int) from public;
revoke all on function _sis06p_diferencias_texto(text, int, int) from anon;
revoke all on function _sis06p_diferencias_texto(text, int, int) from authenticated;

create or replace function sis06p_comparativo(p_mes int, p_anio int, p_clues text default null)
returns table (
  clues text, unidad text, municipio text,
  grupo text, etiqueta text, claves text[],
  paloteo numeric, aplicado numeric, coincide boolean,
  ajuste_paloteo numeric, ajuste_aplicado numeric
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
  select bu.clues, bu.nombre, bu.municipio, c.grupo, c.etiqueta, c.claves, c.paloteo, c.aplicado, (c.paloteo = c.aplicado),
         c.ajuste_paloteo, c.ajuste_aplicado
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
