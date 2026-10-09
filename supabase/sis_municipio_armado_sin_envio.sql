-- ===========================================================================
-- SINBA-SIS / Movimiento · desde octubre 2026
--
--  * El Movimiento del MUNICIPIO (fila JS1-xxx) se ARMA con lo que enviaron sus unidades, pero es
--    editable (recibido, aplicadas, desechadas): la existencia anterior viene del mes pasado.
--    El municipal lo imprime, la jurisdicción lo valida en papel, se corrige en la plataforma y,
--    al empatar, el municipal lo cierra con "Cerrar mes". Entonces la jurisdicción lo toma como definitivo.
--  * Una unidad que no envía (falla de internet, etc.) NO impide consolidar: el municipal la marca
--    "sin envío" con un motivo (auditado y reversible). Si la unidad envía después, la marca deja de contar.
--  * No se puede cerrar el Movimiento del municipio con unidades sin validar (salvo las "sin envío").
--
-- SOLO ADITIVA: no borra ni reescribe datos existentes. Idempotente.
-- ===========================================================================

-- 1) Unidades "sin envío" ----------------------------------------------------
create table if not exists sis06p_sin_envio (
  id uuid primary key default gen_random_uuid(),
  clues text not null,
  mes int not null check (mes between 1 and 12),
  anio int not null,
  motivo text not null check (length(trim(motivo)) > 0),
  usuario text,
  rol text,
  creado_en timestamptz not null default now(),
  unique (clues, mes, anio)
);
alter table sis06p_sin_envio enable row level security;
revoke all on sis06p_sin_envio from anon, authenticated;   -- solo se toca por las funciones de abajo

create or replace function public._sis06p_unidad_omitida(p_clues text, p_anio int, p_mes int) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from sis06p_sin_envio s
    where s.clues = p_clues and s.anio = p_anio and s.mes = p_mes
      and not exists (
        select 1 from sis06p_capturas c
        where c.clues = s.clues and c.anio = s.anio and c.mes = s.mes and c.estado in ('ENVIADO', 'VALIDADO')
      )
  );
$$;

create or replace function public.sis06p_marcar_sin_envio(p_clues text, p_mes int, p_anio int, p_motivo text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype; v_rol text; v_municipio text; v_estado text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then
    raise exception 'Solo el municipal, la jurisdicción o la administración pueden continuar sin una unidad.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'El motivo es obligatorio.'; end if;

  select bu.municipio into v_municipio from biovac_unidades bu
   where bu.clues = p_clues and bu.activo and bu.clues not like 'JS1-%';
  if v_municipio is null then raise exception 'La unidad % no existe o no está activa.', p_clues; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, v_municipio) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;

  select c.estado into v_estado from sis06p_capturas c where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio;
  if v_estado in ('ENVIADO', 'VALIDADO') then
    raise exception 'Esta unidad ya envió su SINBA-SIS de este mes: no se puede marcar sin envío.';
  end if;

  insert into sis06p_sin_envio (clues, mes, anio, motivo, usuario, rol)
  values (p_clues, p_mes, p_anio, trim(p_motivo), coalesce(v_perfil.usuario, v_perfil.id::text), v_rol)
  on conflict (clues, mes, anio) do update
    set motivo = excluded.motivo, usuario = excluded.usuario, rol = excluded.rol, creado_en = now();
end;
$$;

create or replace function public.sis06p_quitar_sin_envio(p_clues text, p_mes int, p_anio int)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype; v_rol text; v_municipio text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then raise exception 'Rol % no autorizado.', v_rol; end if;
  select bu.municipio into v_municipio from biovac_unidades bu where bu.clues = p_clues;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, v_municipio) then
    raise exception 'Fuera de tu alcance de municipios.';
  end if;
  delete from sis06p_sin_envio where clues = p_clues and mes = p_mes and anio = p_anio;   -- solo la marca; no hay datos de captura aquí
end;
$$;

-- Lista de marcas vigentes del mes (lo que el usuario puede ver según su rol). Función nueva: no toca el seguimiento.
create or replace function public.sis06p_sin_envio_lista(p_mes int, p_anio int)
returns table(clues text, municipio text, motivo text, usuario text, creado_en timestamptz, vigente boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_perfil perfiles%rowtype; v_rol text;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then return; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'VISUALIZADOR_JURISDICCIONAL') then return; end if;
  return query
    select s.clues, bu.municipio, s.motivo, s.usuario, s.creado_en, _sis06p_unidad_omitida(s.clues, s.anio, s.mes)
    from sis06p_sin_envio s join biovac_unidades bu on bu.clues = s.clues
    where s.mes = p_mes and s.anio = p_anio
      and (v_rol <> 'MUNICIPAL' or _sis_municipal_alcanza(v_perfil, bu.municipio))
    order by s.clues;
end;
$$;

-- 2) Marca de "armado con las unidades" en el Movimiento (columnas nuevas, nulas = no armado) ----
alter table biovac_movimientos add column if not exists armado_en timestamptz;
alter table biovac_movimientos add column if not exists armado_por text;

-- 3) Armar el Movimiento del municipio con sus unidades ----------------------------------------
-- Pone recibido / aplicadas / desechadas = suma de las unidades que ya enviaron, lote por lote. NO toca la
-- existencia anterior (viene del mes pasado). Los lotes que ninguna unidad trae se dejan como están.
-- Lo que se reemplaza queda en biovac_correcciones (valor anterior -> nuevo): no se pierde nada.
create or replace function public.biovac_armar_movimiento_municipio(p_municipio text, p_mes int, p_anio int, p_usuario text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype; v_rol text; v_inicio date;
  v_js1 uuid; v_mov uuid; v_estado text; v_ant_estado text;
  v_batch uuid := gen_random_uuid();
  v_incl text[]; v_omit text[]; v_pend text[];
  v_act int := 0; v_nuevos int := 0;
  r record; v_row biovac_renglones%rowtype; v_id uuid;
  v_ant_anio int; v_ant_mes int;
begin
  select * into v_perfil from perfiles where id = (select auth.uid()) and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then raise exception 'Rol % no puede armar el Movimiento del municipio.', v_rol; end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then raise exception 'Fuera de tu alcance de municipios.'; end if;
  if p_municipio in ('NHG', 'HENM') then raise exception 'Los hospitales capturan en su propia cuenta: no se arman.'; end if;

  select valor::date into v_inicio from sis_config where clave = 'inicio_captura_por_unidad';
  if make_date(p_anio, p_mes, 1) < coalesce(v_inicio, date '2026-10-01') then
    raise exception 'Este mes se captura a mano en el municipio (las unidades todavía no capturaban su Movimiento).';
  end if;

  select u.id into v_js1 from biovac_unidades u where u.municipio = p_municipio and u.clues like 'JS1-%' order by u.clues limit 1;
  if v_js1 is null then raise exception 'El municipio % no tiene Movimiento propio.', p_municipio; end if;

  -- el mes anterior debe estar cerrado: de ahí viene la existencia anterior
  v_ant_anio := case when p_mes = 1 then p_anio - 1 else p_anio end;
  v_ant_mes := case when p_mes = 1 then 12 else p_mes - 1 end;
  select estado into v_ant_estado from biovac_movimientos where unidad_id = v_js1 and anio = v_ant_anio and mes = v_ant_mes;
  if v_ant_estado is not null and v_ant_estado <> 'CERRADO' then
    raise exception 'Cierra primero el mes anterior del municipio: su existencia final pasa como existencia anterior de este mes.';
  end if;

  select id, estado into v_mov, v_estado from biovac_movimientos
   where unidad_id = v_js1 and anio = p_anio and mes = p_mes for update;
  if v_mov is null then
    insert into biovac_movimientos (unidad_id, anio, mes, fecha_corte)
    values (v_js1, p_anio, p_mes, (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date)
    returning id into v_mov;
    v_estado := 'BORRADOR';
  end if;
  if v_estado not in ('BORRADOR', 'EN_CORRECCION') then
    raise exception 'El mes del municipio está cerrado: ábrelo con "Corregir movimiento" antes de volver a traer las unidades.';
  end if;

  select coalesce(array_agg(bu.clues order by bu.clues) filter (where _sis06p_unidad_omitida(bu.clues, p_anio, p_mes)), '{}'),
         coalesce(array_agg(bu.clues order by bu.clues) filter (where not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes) and um.estado = 'CERRADO'), '{}'),
         coalesce(array_agg(bu.clues order by bu.clues) filter (where not _sis06p_unidad_omitida(bu.clues, p_anio, p_mes) and coalesce(um.estado, '') <> 'CERRADO'), '{}')
    into v_omit, v_incl, v_pend
  from biovac_unidades bu
  left join biovac_movimientos um on um.unidad_id = bu.id and um.anio = p_anio and um.mes = p_mes
  where bu.activo and bu.clues not like 'JS1-%' and bu.municipio = p_municipio;

  perform set_config('biovac.bypass_validaciones', 'on', true);   -- la caducidad de un lote arrastrado no debe frenar el armado
  for r in
    select rn.lote_id, rn.categoria,
           sum(rn.recibido_frascos) rec, sum(rn.aplicadas_a) apa, sum(rn.aplicadas_b) apb,
           sum(rn.desechadas_a) dea, sum(rn.desechadas_b) deb
    from biovac_renglones rn
    join biovac_movimientos um on um.id = rn.movimiento_id
    join biovac_unidades bu on bu.id = um.unidad_id
    where bu.clues = any (v_incl) and um.anio = p_anio and um.mes = p_mes
    group by rn.lote_id, rn.categoria
  loop
    select * into v_row from biovac_renglones where movimiento_id = v_mov and lote_id = r.lote_id and categoria = r.categoria for update;
    if not found then
      insert into biovac_renglones (movimiento_id, lote_id, categoria, existencia_anterior_frascos,
                                    recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b)
      values (v_mov, r.lote_id, r.categoria, 0, r.rec, r.apa, r.apb, r.dea, r.deb);
      v_nuevos := v_nuevos + 1;
    else
      if v_row.recibido_frascos is distinct from r.rec or v_row.aplicadas_a is distinct from r.apa or v_row.aplicadas_b is distinct from r.apb
         or v_row.desechadas_a is distinct from r.dea or v_row.desechadas_b is distinct from r.deb then
        insert into biovac_correcciones (movimiento_id, renglon_id, usuario, rol, campo, valor_anterior, valor_nuevo, motivo, tipo, cascade_batch_id)
        select v_mov, v_row.id, p_usuario, v_rol, c.campo, c.antes::text, c.despues::text,
               'Movimiento armado con las unidades del municipio', 'ARMADO_UNIDADES', v_batch
        from (values ('recibido_frascos', v_row.recibido_frascos, r.rec), ('aplicadas_a', v_row.aplicadas_a, r.apa),
                     ('aplicadas_b', v_row.aplicadas_b, r.apb), ('desechadas_a', v_row.desechadas_a, r.dea),
                     ('desechadas_b', v_row.desechadas_b, r.deb)) as c(campo, antes, despues)
        where c.antes is distinct from c.despues;
        update biovac_renglones
           set recibido_frascos = r.rec, aplicadas_a = r.apa, aplicadas_b = r.apb, desechadas_a = r.dea, desechadas_b = r.deb
         where id = v_row.id;
        v_act := v_act + 1;
      end if;
    end if;
  end loop;
  perform set_config('biovac.bypass_validaciones', 'off', true);

  update biovac_movimientos set armado_en = now(), armado_por = p_usuario, updated_at = now() where id = v_mov;

  return jsonb_build_object('movimiento_id', v_mov, 'unidades_incluidas', to_jsonb(v_incl), 'unidades_sin_envio', to_jsonb(v_omit),
                            'unidades_pendientes', to_jsonb(v_pend), 'renglones_nuevos', v_nuevos, 'renglones_actualizados', v_act);
end;
$$;

-- 4) Qué cuenta para la jurisdicción: con el Movimiento del municipio ARMADO, cuenta ese (y no las unidades) ------
create or replace function public.biovac_cuenta_para_jurisdiccion(p_clues text, p_municipio text, p_anio integer, p_mes integer)
returns boolean language sql stable set search_path to 'public'
as $function$
  select case
    when p_municipio in ('NHG', 'HENM')
         and make_date(p_anio, p_mes, 1) >= coalesce((select valor::date from sis_config where clave = 'inicio_captura_hospitales'), date '2026-09-01')
      then p_clues not like 'JS1-%'
    when make_date(p_anio, p_mes, 1) < (select valor::date from sis_config where clave = 'inicio_captura_por_unidad')
      then p_clues like 'JS1-%'
    when exists (
           select 1 from biovac_movimientos mj join biovac_unidades uj on uj.id = mj.unidad_id
           where uj.clues like 'JS1-%' and uj.municipio = p_municipio and mj.anio = p_anio and mj.mes = p_mes and mj.armado_en is not null)
      then p_clues like 'JS1-%'
    else p_clues not like 'JS1-%'
         or not exists (
           select 1 from biovac_unidades r
           where r.municipio = p_municipio and r.clues not like 'JS1-%' and r.activo
         )
  end;
$function$;

-- 5) Concentrado jurisdiccional: PROVISIONAL hasta que el Movimiento del municipio se cierre (o, si aún se suma por
--    unidades, hasta que estén validadas); las unidades "sin envío" no aportan borradores a medias. ----------------
create or replace function public.biovac_concentrado_jurisdiccion(p_jurisdiccion_id uuid, p_anio integer, p_mes integer, p_incluir_borrador boolean default false)
returns table(bloque_id uuid, pagina text, orden_bloque integer, biologico_id uuid, orden_en_bloque integer, nombre_excel text, clave text,
              regla_especial text, lote_id uuid, numero_lote text, caducidad date, categoria text, dosis_por_frasco_override numeric,
              existencia_anterior_frascos numeric, recibido_frascos numeric, aplicadas_a numeric, aplicadas_b numeric,
              desechadas_a numeric, desechadas_b numeric, existencia_final_frascos numeric,
              unidades_reportando integer, unidades_cerradas integer, es_provisional boolean)
language sql stable set search_path to 'public', 'pg_temp'
as $function$
  select cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque,
         cb.nombre_excel, cb.clave, cb.regla_especial, l.id, l.numero_lote, l.caducidad, r.categoria,
         l.dosis_por_frasco_override,
         sum(r.existencia_anterior_frascos), sum(r.recibido_frascos),
         sum(r.aplicadas_a), sum(r.aplicadas_b), sum(r.desechadas_a), sum(r.desechadas_b),
         sum(r.existencia_final_frascos),
         count(distinct m.unidad_id)::int as unidades_reportando,
         count(distinct m.unidad_id) filter (where m.estado = 'CERRADO')::int as unidades_cerradas,
         bool_or(case when u.clues like 'JS1-%' then m.estado <> 'CERRADO'
                      else coalesce(c.estado, '') <> 'VALIDADO' end) as es_provisional
  from biovac_renglones r
  join biovac_movimientos m on m.id = r.movimiento_id
  join biovac_unidades u on u.id = m.unidad_id
  join biovac_lotes l on l.id = r.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  join biovac_bloques_catalogo bl on bl.id = cb.bloque_id
  left join sis06p_capturas c on c.clues = u.clues and c.anio = m.anio and c.mes = m.mes
  where u.jurisdiccion_id = p_jurisdiccion_id
    and m.anio = p_anio and m.mes = p_mes
    and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, p_anio, p_mes)
    and (p_incluir_borrador or m.estado = 'CERRADO')
    and not (m.estado <> 'CERRADO' and _sis06p_unidad_omitida(u.clues, p_anio, p_mes))
  group by cb.bloque_id, bl.pagina, bl.orden, cb.id, cb.orden_en_bloque, cb.nombre_excel, cb.clave, cb.regla_especial,
           l.id, l.numero_lote, l.caducidad, r.categoria
  order by bl.pagina, bl.orden, cb.orden_en_bloque, r.categoria, l.numero_lote;
$function$;

-- 6) Cerrar mes del Movimiento del municipio (desde octubre): armado y con todas las unidades validadas o "sin envío" ----
do $do$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_cerrar_mes' limit 1;
  if v_def is null then raise exception 'No existe biovac_cerrar_mes'; end if;
  if v_def not like '%armado_en%' then
    v_new := replace(v_def,
      E'  v_fraccionarios int;\nbegin\n',
      E'  v_fraccionarios int;\n  v_js1_clues text;\n  v_js1_muni text;\n  v_js1_armado timestamptz;\n  v_faltan text;\nbegin\n');
    if v_new = v_def then raise exception 'No se pudo parchear (declaraciones) biovac_cerrar_mes'; end if;
    v_def := v_new;
    v_new := replace(v_def,
      E'  perform set_config(''biovac.bypass_lock'', ''on'', true);\n',
      E'  -- Movimiento del municipio (JS1-) desde octubre: debe estar armado con las unidades y estas validadas (o sin envío)\n' ||
      E'  select u.clues, u.municipio, m.anio, m.mes, m.armado_en into v_js1_clues, v_js1_muni, v_anio, v_mes, v_js1_armado\n' ||
      E'    from biovac_movimientos m join biovac_unidades u on u.id = m.unidad_id where m.id = p_movimiento_id;\n' ||
      E'  if v_js1_clues like ''JS1-%'' and v_js1_muni not in (''NHG'', ''HENM'')\n' ||
      E'     and make_date(v_anio, v_mes, 1) >= coalesce((select valor::date from sis_config where clave = ''inicio_captura_por_unidad''), date ''2026-10-01'') then\n' ||
      E'    if v_js1_armado is null then\n' ||
      E'      raise exception ''Antes de cerrar, trae el Movimiento de tus unidades (botón "Traer de mis unidades").'';\n' ||
      E'    end if;\n' ||
      E'    select string_agg(bu.clues, '', '' order by bu.clues) into v_faltan\n' ||
      E'    from biovac_unidades bu left join sis06p_capturas c on c.clues = bu.clues and c.anio = v_anio and c.mes = v_mes\n' ||
      E'    where bu.activo and bu.clues not like ''JS1-%'' and bu.municipio = v_js1_muni\n' ||
      E'      and not _sis06p_unidad_omitida(bu.clues, v_anio, v_mes) and coalesce(c.estado, '''') <> ''VALIDADO'';\n' ||
      E'    if v_faltan is not null then\n' ||
      E'      raise exception ''No se puede cerrar: faltan por validar %. Valídalas o márcalas "sin envío" si no van a enviar este mes.'', v_faltan;\n' ||
      E'    end if;\n' ||
      E'  end if;\n\n' ||
      E'  perform set_config(''biovac.bypass_lock'', ''on'', true);\n');
    if v_new = v_def then raise exception 'No se pudo parchear (candado) biovac_cerrar_mes'; end if;
    execute v_new;
  end if;
end
$do$;

-- 7) Publicación / CSV del SIS: las unidades "sin envío" no bloquean; el resto debe estar validado y conciliado ----
create or replace function public._sis_municipio_listo(p_mes integer, p_anio integer, p_municipio text, OUT v_rol text, OUT v_unidades text[])
returns record language plpgsql stable security definer set search_path = public
as $function$
declare
  v_perfil perfiles%rowtype; v_inicio date; v_faltan text; v_difs text; v_todas text[];
begin
  select * into v_perfil from perfiles where id = auth.uid() and activo = 'SI';
  if not found then raise exception 'Sesión no válida.'; end if;
  v_rol := upper(v_perfil.rol);
  if v_rol not in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN') then
    raise exception 'Rol % no puede publicar el SIS.', v_rol;
  end if;
  if v_rol = 'MUNICIPAL' and not _sis_municipal_alcanza(v_perfil, p_municipio) then
    raise exception 'Fuera de tu alcance de municipios.';
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

-- 8) Aviso "movimiento no cerrado" de la validación: no acusa a una unidad que ya quedó "sin envío" -------------------
do $do$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'biovac_validar_concentrado' limit 1;
  if v_def is null then raise exception 'No existe biovac_validar_concentrado'; end if;
  if v_def not like '%_sis06p_unidad_omitida%' then
    v_new := replace(v_def,
      E'      where m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes and m.estado = ''CERRADO''\n    );',
      E'      where m.unidad_id = u.id and m.anio = p_anio and m.mes = p_mes and m.estado = ''CERRADO''\n    )\n    and not _sis06p_unidad_omitida(u.clues, p_anio, p_mes);');
    if v_new = v_def then raise exception 'No se pudo parchear biovac_validar_concentrado'; end if;
    execute v_new;
  end if;
end
$do$;

-- 9) Permisos: nada para anon
do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname in
       ('_sis06p_unidad_omitida','sis06p_marcar_sin_envio','sis06p_quitar_sin_envio','sis06p_sin_envio_lista',
        'biovac_armar_movimiento_municipio','biovac_cuenta_para_jurisdiccion','biovac_concentrado_jurisdiccion',
        '_sis_municipio_listo','biovac_cerrar_mes','biovac_validar_concentrado')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$do$;
