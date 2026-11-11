-- ============================================================================
-- Publicación a indicadores (registros_sis): hospitales, cierre obligatorio y verificación
-- ============================================================================
-- Hallazgos (2026-11-11):
--  1) Los hospitales (NHG, HENM) NUNCA se publicaban solos: el disparador de cierre los llamaba, pero sus cuentas son
--     rol UNIDAD y _sis_municipio_listo rechaza ese rol; _sis_publicar_auto_core ignoraba en silencio «Rol %».
--     Resultado: octubre de 2026 sin una sola fila de los hospitales en registros_sis (indicadores jurisdiccionales sin ellos).
--  2) NHGQ no estaba en unidades_medicas (get_rda_indicators la usa con INNER JOIN): aunque se publicara, no salía.
--  3) La publicación manual no exigía que el Movimiento del municipio/hospital estuviera CERRADO.
--  4) Nada comprobaba, después de insertar, que lo que quedó en registros_sis fuera exactamente lo que se quiso publicar.
--
-- Cambios:
--  * _sis_municipio_listo: acepta la llamada INTERNA del disparador de cierre (variable local sirevaq.publicar_interno),
--    que no depende del rol de quien cerró; sigue exigiendo todas las unidades validadas y paloteo = Movimiento.
--  * sis_publicar_registros_sis: exige Movimiento CERRADO; verifica filas y suma tras insertar (si no cuadra, revierte);
--    da de alta los hospitales en unidades_medicas bajo QUERÉTARO (igual que HENM y que la tabla unidades).
--  * _sis_publicar_auto_core: activa la llamada interna y deja rastro de todo lo que no se pudo publicar.
--  * sis_ultimo_intento_publicacion: último intento (publicado / pendiente / bloqueado) para mostrarlo en pantalla.
-- ============================================================================

create or replace function public._sis_municipio_listo(p_mes integer, p_anio integer, p_municipio text, out v_rol text, out v_unidades text[])
returns record
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_perfil perfiles%rowtype; v_inicio date; v_faltan text; v_difs text; v_todas text[]; v_interno boolean;
begin
  v_interno := coalesce(current_setting('sirevaq.publicar_interno', true), '') = '1';
  if v_interno then
    v_rol := 'AUTO';
  else
    select * into v_perfil from perfiles where id = auth.uid() and activo = 'SI';
    if not found then raise exception 'Sesión no válida.'; end if;
    v_rol := upper(v_perfil.rol);
    if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then
      raise exception 'Rol % no puede publicar el SIS.', v_rol;
    end if;
    if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then
      raise exception 'Fuera de tu alcance de municipios.';
    end if;
  end if;
  if p_mes not between 1 and 12 or p_anio is null then raise exception 'Mes/año inválidos.'; end if;

  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if v_inicio is not null and make_date(p_anio, p_mes, 1) < date_trunc('month', v_inicio)::date then
    raise exception 'Los meses anteriores al arranque (%) no se publican desde aquí: ya están cargados y no se tocan.', to_char(v_inicio, 'MM/YYYY');
  end if;

  select array_agg(bu.clues order by bu.clues) into v_todas
  from biovac_unidades bu
  where bu.activo and bu.clues not like 'JS1-%' and bu.municipio = p_municipio;
  if v_todas is null then raise exception 'El municipio % no tiene unidades activas.', p_municipio; end if;

  select array_agg(u.clues order by u.clues) into v_unidades
  from unnest(v_todas) u(clues)
  where not _sis06p_unidad_omitida(u.clues, p_anio, p_mes);
  if v_unidades is null then
    raise exception 'Todas las unidades de % están marcadas sin envío: no hay nada que publicar.', p_municipio;
  end if;

  select string_agg(u.clues, ', ' order by u.clues) into v_faltan
  from unnest(v_unidades) u(clues)
  left join sis06p_capturas c on c.clues = u.clues and c.mes = p_mes and c.anio = p_anio
  where coalesce(c.estado, '') <> 'VALIDADO';
  if v_faltan is not null then
    raise exception 'Faltan por validar: %. Valídalas, o márcalas "sin envío" si no van a enviar este mes.', v_faltan;
  end if;

  select string_agg(u.clues || ' -> ' || x.d, ' | ' order by u.clues) into v_difs
  from unnest(v_unidades) u(clues)
  cross join lateral (select _sis06p_diferencias_texto(u.clues, p_mes, p_anio) as d) x
  where x.d is not null;
  if v_difs is not null then
    raise exception 'No se publica: el paloteo y el Movimiento de Biológico ya no coinciden en %. Corrígelo en modo revisión (o autoriza una excepción) y vuelve a intentar.', v_difs;
  end if;
end;
$function$;

create or replace function public.sis_publicar_registros_sis(p_mes integer, p_anio integer, p_municipio text, p_usuario text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol text; v_unidades text[]; v_pub text[]; v_omit text[];
  v_dup int; v_neg int; v_del int; v_ins int;
  v_cerrados int; v_movs int;
  v_n_src int; v_s_src bigint; v_n_db int; v_s_db bigint; v_clues_src int;
begin
  perform pg_advisory_xact_lock(hashtext('sis_publicar:' || p_anio::text || ':' || p_mes::text || ':' || coalesce(p_municipio, '')));

  select l.v_rol, l.v_unidades into v_rol, v_unidades from _sis_municipio_listo(p_mes, p_anio, p_municipio) l;

  -- Solo se publica con el mes CERRADO: el Movimiento del municipio (fila JS1-*) o el del hospital debe estar cerrado.
  select count(*) filter (where m.estado = 'CERRADO'), count(*) into v_cerrados, v_movs
  from biovac_movimientos m join biovac_unidades u on u.id = m.unidad_id
  where m.anio = p_anio and m.mes = p_mes and u.municipio = p_municipio
    and (u.clues like 'JS1-%' or u.municipio in ('NHG', 'HENM'));
  if v_movs = 0 or v_cerrados < v_movs then
    raise exception 'El Movimiento de Biológico de % (%/%) todavía no está cerrado: a indicadores se carga hasta que se cierre el mes.',
      p_municipio, lpad(p_mes::text, 2, '0'), p_anio;
  end if;

  insert into unidades_medicas (clues, nombre, municipio)
  select bu.clues, bu.nombre, case when bu.municipio in ('NHG', 'HENM') then 'QUERÉTARO' else bu.municipio end
  from biovac_unidades bu where bu.clues = any (v_unidades)
  on conflict (clues) do nothing;

  select coalesce(array_agg(u.clues order by u.clues) filter (where exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[]),
         coalesce(array_agg(u.clues order by u.clues) filter (where not exists (select 1 from unidades_medicas um where um.clues = u.clues)), array[]::text[])
    into v_pub, v_omit from unnest(v_unidades) u(clues);

  if coalesce(array_length(v_pub, 1), 0) = 0 then
    raise exception 'Ninguna unidad de % está en el catálogo de unidades médicas del SIS.', p_municipio;
  end if;

  drop table if exists _sis_pub;
  create temp table _sis_pub on commit drop as select * from _sis_filas_publicables(p_mes, p_anio, v_pub);

  select count(*) - count(distinct (clues, variable_sis)) into v_dup from _sis_pub;
  if v_dup > 0 then raise exception 'Se detectaron % clave(s) repetidas al armar las filas; no se publicó nada.', v_dup; end if;
  select count(*) into v_neg from _sis_pub where valor < 0;
  if v_neg > 0 then raise exception 'Hay % valor(es) negativos en la captura; no se publicó nada.', v_neg; end if;
  if not exists (select 1 from _sis_pub) then raise exception 'No hay filas que publicar; no se tocó nada.'; end if;
  select count(distinct clues) into v_clues_src from _sis_pub;
  if v_clues_src <> array_length(v_pub, 1) then
    raise exception 'Solo % de % unidades traen filas para publicar; no se publicó nada.', v_clues_src, array_length(v_pub, 1);
  end if;
  select count(*), coalesce(sum(valor), 0) into v_n_src, v_s_src from _sis_pub;

  delete from registros_sis r
  where r.anio = p_anio and r.mes = p_mes and r.clues = any (v_pub)
    and r.variable_sis in (select distinct variable_sis from _sis_pub);
  get diagnostics v_del = row_count;

  insert into registros_sis (clues, variable_sis, valor, mes, anio)
  select clues, variable_sis, valor, p_mes, p_anio from _sis_pub;
  get diagnostics v_ins = row_count;

  -- Verificación: lo que quedó en registros_sis para esas llaves es EXACTAMENTE lo que se quiso publicar.
  select count(*), coalesce(sum(r.valor), 0) into v_n_db, v_s_db
  from registros_sis r
  join (select distinct clues, variable_sis from _sis_pub) k on k.clues = r.clues and k.variable_sis = r.variable_sis
  where r.anio = p_anio and r.mes = p_mes;
  if v_ins <> v_n_src or v_n_db <> v_n_src or v_s_db <> v_s_src then
    raise exception 'Verificación fallida (esperadas % filas con suma %, quedaron % con suma %): no se publicó nada.', v_n_src, v_s_src, v_n_db, v_s_db;
  end if;

  insert into sis_publicaciones (anio, mes, municipio, usuario, rol, filas_insertadas, filas_reemplazadas, clues_publicadas, clues_omitidas)
  values (p_anio, p_mes, p_municipio, p_usuario, v_rol, v_ins, v_del, v_pub, v_omit);

  return jsonb_build_object('ok', true, 'insertadas', v_ins, 'reemplazadas', v_del,
                            'clues_publicadas', v_pub, 'clues_omitidas', v_omit, 'suma', v_s_src);
end;
$function$;

create or replace function public._sis_publicar_auto_core(p_mes integer, p_anio integer, p_municipio text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ini date; v_usr text; v_res jsonb;
begin
  if p_municipio is null or p_mes is null or p_anio is null then return; end if;
  select valor::date into v_ini from sis_config where clave = 'inicio_captura_por_unidad';
  if v_ini is not null and make_date(p_anio, p_mes, 1) < date_trunc('month', v_ini)::date then return; end if;
  select p.usuario into v_usr from perfiles p where p.id = auth.uid();
  -- llamada interna del disparador: no depende del rol de quien cerró (los hospitales cierran con cuenta UNIDAD)
  perform set_config('sirevaq.publicar_interno', '1', true);
  begin
    v_res := sis_publicar_registros_sis(p_mes, p_anio, p_municipio, coalesce(v_usr, 'AUTO') || ' (auto)');
    insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
    values (p_anio, p_mes, p_municipio, 'PUBLICADO',
            'insertadas=' || (v_res ->> 'insertadas') || ' reemplazadas=' || (v_res ->> 'reemplazadas'), v_usr);
  exception when others then
    if sqlerrm like 'Faltan por validar%' then
      insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
      values (p_anio, p_mes, p_municipio, 'PENDIENTE', left(sqlerrm, 800), v_usr);
    else
      insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
      values (p_anio, p_mes, p_municipio, 'BLOQUEADO', left(sqlerrm, 800), v_usr);
    end if;
  end;
  perform set_config('sirevaq.publicar_interno', '', true);
end $function$;

create or replace function public.sis_ultimo_intento_publicacion(p_mes integer, p_anio integer, p_municipio text)
returns table (resultado text, detalle text, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_perfil perfiles%rowtype;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found or upper(v_perfil.rol) not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'VISUALIZADOR_JURISDICCIONAL') then return; end if;
  if upper(v_perfil.rol) = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then return; end if;
  return query
    select l.resultado::text, l.detalle::text, l.creado_en
    from sis_publicacion_auto_log l
    where l.anio = p_anio and l.mes = p_mes and l.municipio = p_municipio
    order by l.creado_en desc limit 1;
end;
$function$;
revoke all on function public.sis_ultimo_intento_publicacion(integer, integer, text) from public, anon;
grant execute on function public.sis_ultimo_intento_publicacion(integer, integer, text) to authenticated;
