-- =============================================================================
-- Auditoría 2026-10-04 (YA APLICADA en producción como migración
-- `auditoria_2026_10_usuarios_seguridad_publicacion`; este archivo es la copia para el repo)
-- =============================================================================
-- 1) USUARIOS: `usuario` único (sin distinguir mayúsculas); municipios_allowed (JWT/RLS) se deriva en
--    el servidor de municipio+rol; handle_new_user tolera IDs repetidos.
-- 2) SEGURIDAD: 7 funciones SECURITY DEFINER de BioVac eran ejecutables por anon sin chequeo; ahora
--    exigen sesión + alcance (_biovac_autoriza_movimiento). calcular_reabasto_pendientes ya no deja
--    pasar a anon. Se quita EXECUTE a anon/PUBLIC en las que no deben llamarse sin sesión.
-- 3) PUBLICACIÓN SIS: da de alta en unidades_medicas las CLUES faltantes (p. ej. NHGQ).

update public.perfiles set usuario = 'QTSSA012154_CARAVANAS_PRUEBA'
 where id = '64ecb799-2fa2-4c23-a288-2af40b4af4cd' and usuario = 'QTSSA012154_CARAVANAS';

create unique index if not exists perfiles_usuario_lower_uidx on public.perfiles (lower(usuario));

create or replace function public.sync_perfiles_asignados()
returns trigger language plpgsql set search_path = public
as $function$
declare v_lista text[];
begin
  new.clues_asignado := new.clues;
  new.municipio_asignado := new.municipio;
  if tg_op = 'INSERT' or new.municipio is distinct from old.municipio or new.rol is distinct from old.rol then
    if new.rol = 'ADMIN' then
      new.municipios_allowed := array['*'];
    elsif new.rol in ('MUNICIPAL','JURISDICCIONAL') then
      select coalesce(array_agg(distinct s.m), '{}') into v_lista
        from (select upper(btrim(x)) as m from unnest(regexp_split_to_array(coalesce(new.municipio,''), '[;,]')) x) s
       where s.m <> '' and s.m <> 'SIN ASIGNAR';
      new.municipios_allowed := v_lista;
    else
      new.municipios_allowed := '{}';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  legacy_data record;
  v_usuario text;
begin
  select * into legacy_data from public.usuarios_legacy
   where lower(email) = lower(new.email) or lower(usuario) = lower(new.email) limit 1;

  v_usuario := coalesce(nullif(new.raw_user_meta_data->>'usuario_id',''), legacy_data.usuario, split_part(new.email,'@',1));
  if exists (select 1 from public.perfiles where lower(usuario) = lower(v_usuario)) then
    v_usuario := v_usuario || '_' || left(new.id::text, 6);
  end if;

  insert into public.perfiles (id, usuario, email, municipio, clues, unidad, rol, activo)
  values (new.id, v_usuario, new.email,
          coalesce(legacy_data.municipio,'SIN ASIGNAR'), coalesce(legacy_data.clues,'SIN CLUES'),
          coalesce(legacy_data.unidad,'UNIDAD NUEVA'), coalesce(legacy_data.rol,'UNIDAD'), coalesce(legacy_data.activo,'SI'));
  return new;
end;
$function$;

-- Inyecta el chequeo de autorización al inicio de cada función (idempotente por la marca del cuerpo)
do $do$
declare r record; v_def text; v_new text;
begin
  for r in select * from (values
    ('biovac_generar_informe_jurisdiccional',
     $inj$if not exists (select 1 from public.perfiles pf where pf.id = (select auth.uid()) and pf.activo = 'SI' and upper(pf.rol) in ('ADMIN','JURISDICCIONAL')) then raise exception 'No autorizado para generar el informe jurisdiccional.'; end if; -- auditoria-2026-10$inj$),
    ('biovac_guardar_campo_correccion_jurisdiccional',
     $inj$perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), true); -- auditoria-2026-10$inj$),
    ('biovac_reclasificar_arf_normal',
     $inj$perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false); -- auditoria-2026-10$inj$),
    ('biovac_reclasificar_normal_arf',
     $inj$perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false); -- auditoria-2026-10$inj$),
    ('biovac_resolver_canje',
     $inj$perform public._biovac_autoriza_movimiento((select rr.movimiento_id from public.biovac_renglones rr where rr.id = p_renglon_id), false); -- auditoria-2026-10$inj$),
    ('biovac_reconocer_correcciones_movimiento',
     $inj$perform public._biovac_autoriza_movimiento(p_movimiento_id, false); -- auditoria-2026-10$inj$)
  ) as t(fn, inj)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = r.fn limit 1;
    if v_def is null then raise exception 'No existe %', r.fn; end if;
    if v_def like '%auditoria-2026-10%' then continue; end if;
    v_new := regexp_replace(v_def, E'\\nbegin\\n', E'\nbegin\n  ' || replace(r.inj, '\', '\\') || E'\n');
    if v_new = v_def then raise exception 'No se pudo inyectar en %', r.fn; end if;
    execute v_new;
  end loop;
end
$do$;

create or replace function public.biovac_reconocer_correccion(p_correccion_id uuid, p_usuario text)
returns void language plpgsql security definer set search_path = public
as $function$
declare v_movimiento_id uuid;
begin
  select c.movimiento_id into v_movimiento_id from public.biovac_correcciones c
   where c.id = p_correccion_id and c.tipo = 'CORRECCION_JURISDICCIONAL';
  if v_movimiento_id is null then return; end if;
  perform public._biovac_autoriza_movimiento(v_movimiento_id, false);
  update public.biovac_correcciones
     set reconocido_por_municipal = true, reconocido_en = now(), reconocido_por = p_usuario
   where id = p_correccion_id and tipo = 'CORRECCION_JURISDICCIONAL';
end;
$function$;

do $do$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'calcular_reabasto_pendientes' limit 1;
  if v_def like '%auditoria-2026-10%' then return; end if;
  v_new := replace(v_def,
    E'    if auth.uid() is not null then\n        if not (',
    E'    -- auditoria-2026-10\n    if auth.uid() is null and coalesce(auth.role(), '''') in (''anon'', ''authenticated'') then\n        raise exception ''No autorizado para ejecutar el motor de reabasto inteligente'';\n    end if;\n    if auth.uid() is not null then\n        if not (');
  if v_new = v_def then raise exception 'No se pudo parchear calcular_reabasto_pendientes'; end if;
  execute v_new;
end
$do$;

do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname in (
       'biovac_generar_informe_jurisdiccional','biovac_guardar_campo_correccion_jurisdiccional',
       'biovac_reclasificar_arf_normal','biovac_reclasificar_normal_arf','biovac_reconocer_correccion',
       'biovac_reconocer_correcciones_movimiento','biovac_resolver_canje','biovac_trg_10_bloqueo',
       'sirevaq_bio_reabasto_scheduler','calcular_reabasto_pendientes',
       'get_capacitaciones_evidencia_stats','get_evidences_list_by_category')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$do$;

create or replace function sis_publicar_registros_sis(p_mes int, p_anio int, p_municipio text, p_usuario text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_rol text; v_unidades text[]; v_pub text[]; v_omit text[];
  v_dup int; v_neg int; v_del int; v_ins int;
begin
  select l.v_rol, l.v_unidades into v_rol, v_unidades from _sis_municipio_listo(p_mes, p_anio, p_municipio) l;

  insert into unidades_medicas (clues, nombre, municipio)
  select bu.clues, bu.nombre, bu.municipio from biovac_unidades bu where bu.clues = any (v_unidades)
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

  delete from registros_sis r
  where r.anio = p_anio and r.mes = p_mes and r.clues = any (v_pub)
    and r.variable_sis in (select distinct variable_sis from _sis_pub);
  get diagnostics v_del = row_count;

  insert into registros_sis (clues, variable_sis, valor, mes, anio)
  select clues, variable_sis, valor, p_mes, p_anio from _sis_pub;
  get diagnostics v_ins = row_count;

  insert into sis_publicaciones (anio, mes, municipio, usuario, rol, filas_insertadas, filas_reemplazadas, clues_publicadas, clues_omitidas)
  values (p_anio, p_mes, p_municipio, p_usuario, v_rol, v_ins, v_del, v_pub, v_omit);

  return jsonb_build_object('ok', true, 'insertadas', v_ins, 'reemplazadas', v_del,
                            'clues_publicadas', v_pub, 'clues_omitidas', v_omit);
end;
$$;
revoke all on function sis_publicar_registros_sis(int, int, text, text) from public, anon;
grant execute on function sis_publicar_registros_sis(int, int, text, text) to authenticated;
