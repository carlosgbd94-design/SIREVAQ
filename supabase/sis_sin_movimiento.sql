-- ============================================================================
-- SINBA-SIS: «Sin movimiento» explícito y envío en ceros.
--
-- Hasta ahora una unidad sin dosis podía guardar todo en ceros y enviar: el SIS
-- llegaba igual que uno que se olvidaron de capturar, y el municipal no podía
-- distinguir «de verdad no hubo movimiento» de «no capturaron». Igual que en
-- Influenza, el cero se declara:
--   * sis06p_capturas.sin_movimiento = la unidad marcó «Sin movimiento este mes»
--     (no recibió ni aplicó biológico; puede tener existencia anterior).
--   * Enviar con el mes en ceros (paloteo + reportes de Influenza) SOLO se
--     permite con esa marca. Con dosis, la marca se apaga sola.
--   * El paloteo y el Movimiento ya se concilian aparte: con sin movimiento las
--     «aplicadas» del Movimiento también deben ser 0 (lo exige la conciliación).
-- Aditiva: no toca capturas existentes ni los envíos ya hechos.
-- ============================================================================

alter table public.sis06p_capturas
  add column if not exists sin_movimiento boolean not null default false;

-- Dosis del mes de una unidad: lo capturado en el paloteo (total por variable) + lo reportado en Influenza.
create or replace function public._sis06p_dosis_del_mes(p_clues text, p_mes int, p_anio int)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(coalesce(nullif(v.value->>'total', '')::numeric, 0))
              from sis06p_capturas c, jsonb_each(coalesce(c.valores, '{}'::jsonb)) v
              where c.clues = p_clues and c.mes = p_mes and c.anio = p_anio
                and jsonb_typeof(v.value) = 'object'), 0)
    +
    coalesce((select sum(coalesce(nullif(v.value #>> '{}', '')::numeric, 0))
              from influenza_capturas i, jsonb_each(coalesce(i.valores, '{}'::jsonb)) v
              where i.clues = p_clues
                and i.fecha >= make_date(p_anio, p_mes, 1)
                and i.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date
                and jsonb_typeof(v.value) = 'number'), 0);
$$;
revoke all on function public._sis06p_dosis_del_mes(text, int, int) from public, anon;
grant execute on function public._sis06p_dosis_del_mes(text, int, int) to authenticated;

-- Si el paloteo guardado trae dosis, «sin movimiento» no puede quedar prendido.
create or replace function public.sis06p_trg_sin_movimiento()
returns trigger
language plpgsql
as $$
begin
  if new.sin_movimiento and exists (
    select 1 from jsonb_each(coalesce(new.valores, '{}'::jsonb)) v
    where jsonb_typeof(v.value) = 'object' and coalesce(nullif(v.value->>'total', '')::numeric, 0) > 0
  ) then
    new.sin_movimiento := false;
  end if;
  return new;
end;
$$;
drop trigger if exists sis06p_trg_sin_movimiento on public.sis06p_capturas;
create trigger sis06p_trg_sin_movimiento
  before insert or update on public.sis06p_capturas
  for each row execute function public.sis06p_trg_sin_movimiento();

-- Enviar: mismo cuerpo de siempre + el candado del mes en ceros.
create or replace function public.sis06p_enviar_para_validacion(p_captura_id uuid, p_usuario text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_resp text;
  v_sin_mov boolean;
  v_dosis numeric;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is distinct from 'UNIDAD' then
    raise exception 'Solo la unidad puede enviar su propio concentrado.';
  end if;

  select clues, municipio, mes, anio, estado, sin_movimiento
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado, v_sin_mov
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

  select capturado_por into v_resp from sis06p_capturas where id = p_captura_id;
  if not _sis06p_nombre_valido(v_resp) then
    raise exception 'Falta el nombre completo de quien elabora el SINBA-SIS. Escríbelo en «Responsable de la información», guarda y vuelve a enviar.';
  end if;

  -- Mes en ceros: solo se envía si la unidad declaró «Sin movimiento».
  v_dosis := _sis06p_dosis_del_mes(v_clues_fila, v_mes, v_anio);
  if v_dosis = 0 and not coalesce(v_sin_mov, false) then
    raise exception 'Tu SINBA-SIS está en ceros. Si este mes no recibiste ni aplicaste biológico, marca «Sin movimiento este mes», guarda y vuelve a enviar. Si sí hubo aplicaciones, captúralas en el paloteo.';
  end if;

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

  v_dif := _sis06p_diferencias_texto(v_clues_fila, v_mes, v_anio);
  if v_dif is not null then
    raise exception 'No se puede enviar: el paloteo SIS-06-P y el Movimiento de Biológico no coinciden en: %. Corrige uno de los dos para que las dosis aplicadas sean iguales.', v_dif;
  end if;

  if v_mov_estado = 'BORRADOR' then
    perform set_config('sis06p.cierre_por_envio', 'on', true);
    perform biovac_cerrar_mes(v_mov_id, p_usuario);
    perform set_config('sis06p.cierre_por_envio', 'off', true);
  end if;

  perform set_config('sis06p.bypass_lock', 'on', true);
  update sis06p_capturas
  set estado = 'ENVIADO', enviado_en = now(), enviado_por = p_usuario,
      sin_movimiento = (v_dosis = 0),
      editado_por = 'UNIDAD', updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, 'UNIDAD', 'MARCADOR_ENVIADO', true);
end;
$function$;

revoke all on function public.sis06p_enviar_para_validacion(uuid, text) from public, anon;
grant execute on function public.sis06p_enviar_para_validacion(uuid, text) to authenticated;

-- Realtime: el panel de validación del municipal se refresca solo cuando una unidad guarda/envía/corrige.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sis06p_capturas') then
    alter publication supabase_realtime add table public.sis06p_capturas;
  end if;
end $$;
