-- ADMIN sin candados en SIS: puede ENVIAR el SINBA-SIS de cualquier unidad (antes solo la propia UNIDAD).
-- Para ADMIN no aplican: la ventana de envío, el nombre del responsable ni «en ceros sin marca».
-- Se mantienen la conciliación paloteo = Movimiento y que exista el Movimiento del mes (integridad del dato).
-- La captura/guardado ya estaba abierta a ADMIN en los triggers (sis06p_trg_10_bloqueo_y_auditoria, biovac_trg_*,
-- influenza_trg_*): los candados de esos triggers solo aplican al rol UNIDAD. JURISDICCIONAL queda como estaba.
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
  v_admin boolean;
begin
  select upper(p.rol), p.clues into v_rol, v_clues_perfil
  from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI';

  if v_rol is null or v_rol not in ('UNIDAD', 'ADMIN') then
    raise exception 'Solo la unidad (o el administrador) puede enviar el concentrado.';
  end if;
  v_admin := (v_rol = 'ADMIN');

  select clues, municipio, mes, anio, estado, sin_movimiento
    into v_clues_fila, v_municipio, v_mes, v_anio, v_estado, v_sin_mov
  from sis06p_capturas where id = p_captura_id
  for update;

  if v_clues_fila is null then
    raise exception 'Concentrado % no existe.', p_captura_id;
  end if;
  if not v_admin and v_clues_fila is distinct from v_clues_perfil then
    raise exception 'No puedes enviar el concentrado de otra unidad.';
  end if;
  if v_estado <> 'BORRADOR' then
    raise exception 'Este concentrado ya está en estado %, no se puede volver a enviar.', v_estado;
  end if;

  if not v_admin then
    select * into v_ventana from sis06p_ventana_envio(v_anio, v_mes);
    if not v_ventana.dentro_envio then
      raise exception 'Fuera de la ventana de envío (% a %). Solo se puede enviar entre el último día del mes y la semana siguiente.',
        v_ventana.inicio_envio, v_ventana.fin_envio;
    end if;

    select capturado_por into v_resp from sis06p_capturas where id = p_captura_id;
    if not _sis06p_nombre_valido(v_resp) then
      raise exception 'Falta el nombre completo de quien elabora el SINBA-SIS. Escríbelo en «Responsable de la información», guarda y vuelve a enviar.';
    end if;
  end if;

  v_dosis := _sis06p_dosis_del_mes(v_clues_fila, v_mes, v_anio);
  if not v_admin and v_dosis = 0 and not coalesce(v_sin_mov, false) then
    raise exception 'Tu SINBA-SIS está en ceros. Si este mes no recibiste ni aplicaste biológico, marca «Sin movimiento este mes», guarda y vuelve a enviar. Si sí hubo aplicaciones, captúralas en el paloteo.';
  end if;

  select bu.id into v_unidad_id from biovac_unidades bu where bu.clues = v_clues_fila;
  if v_unidad_id is null then
    raise exception 'No se encontró la unidad en el catálogo de BioVac.';
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
      editado_por = v_rol, updated_at = now()
  where id = p_captura_id;
  perform set_config('sis06p.bypass_lock', 'off', true);

  insert into sis06p_correcciones (captura_id, clues, municipio, mes, anio, usuario, rol, tipo, reconocido_por_unidad)
  values (p_captura_id, v_clues_fila, v_municipio, v_mes, v_anio, p_usuario, v_rol, 'MARCADOR_ENVIADO', true);
end;
$function$;
