-- "Tu SINBA-SIS de <mes> ya es definitivo" (type SIS_VALIDADO) es un aviso PARA LA UNIDAD.
-- El fan-out de scope CLUES lo repartia tambien a ADMIN/JURISDICCIONAL/VISUALIZADOR y a los MUNICIPAL/CARAVANAS,
-- asi que cada unidad que se validaba dejaba una copia en esos perfiles (decenas de avisos repetidos).
-- Ahora, para SIS_VALIDADO, solo recibe copia el perfil de esa CLUES. Todo lo demas queda igual.

CREATE OR REPLACE FUNCTION public.fanout_notification_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rec_user RECORD;
  muni_upper TEXT;
  muni_item TEXT;
  is_allowed BOOLEAN;
BEGIN
  IF NEW.target_scope = 'GLOBAL' THEN
    FOR rec_user IN
      SELECT usuario FROM perfiles WHERE activo = 'SI' AND usuario != NEW.from_usuario
    LOOP
      INSERT INTO notificaciones_perfil (notificacion_id, usuario)
      VALUES (NEW.id, rec_user.usuario)
      ON CONFLICT DO NOTHING;
    END LOOP;

  ELSIF NEW.target_scope = 'ROLE' THEN
    FOR rec_user IN
      SELECT usuario FROM perfiles
      WHERE activo = 'SI' AND usuario != NEW.from_usuario AND (rol = NEW.target_usuario OR rol = 'ADMIN')
    LOOP
      INSERT INTO notificaciones_perfil (notificacion_id, usuario)
      VALUES (NEW.id, rec_user.usuario)
      ON CONFLICT DO NOTHING;
    END LOOP;

  ELSIF NEW.target_scope = 'USUARIO' THEN
    IF NEW.target_usuario IS NOT NULL AND NEW.target_usuario != '' THEN
      INSERT INTO notificaciones_perfil (notificacion_id, usuario)
      VALUES (NEW.id, NEW.target_usuario)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF NEW.target_scope = 'CLUES' THEN
    muni_upper := upper(trim(coalesce(NEW.target_municipio, '')));

    FOR rec_user IN
      SELECT usuario, rol, clues, municipio, municipios_allowed
      FROM perfiles
      WHERE activo = 'SI' AND usuario != NEW.from_usuario
    LOOP
      IF rec_user.clues = NEW.target_clues THEN
        INSERT INTO notificaciones_perfil (notificacion_id, usuario)
        VALUES (NEW.id, rec_user.usuario)
        ON CONFLICT DO NOTHING;
      ELSIF NEW.type = 'SIS_VALIDADO' THEN
        NULL;   -- aviso solo para la unidad
      ELSIF rec_user.rol IN ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL') THEN
        INSERT INTO notificaciones_perfil (notificacion_id, usuario)
        VALUES (NEW.id, rec_user.usuario)
        ON CONFLICT DO NOTHING;
      ELSIF rec_user.rol IN ('MUNICIPAL', 'CARAVANAS') THEN
        is_allowed := false;
        IF rec_user.municipios_allowed IS NOT NULL THEN
          FOREACH muni_item IN ARRAY rec_user.municipios_allowed LOOP
            IF upper(trim(muni_item)) = '*' OR (muni_upper != '' AND upper(trim(muni_item)) = muni_upper) THEN
              is_allowed := true;
            END IF;
          END LOOP;
        END IF;

        IF is_allowed THEN
          INSERT INTO notificaciones_perfil (notificacion_id, usuario)
          VALUES (NEW.id, rec_user.usuario)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;

  ELSIF NEW.target_scope = 'MUNICIPIO' THEN
    muni_upper := upper(trim(coalesce(NEW.target_municipio, '')));

    FOR rec_user IN
      SELECT usuario, rol, municipios_allowed
      FROM perfiles
      WHERE activo = 'SI' AND usuario != NEW.from_usuario
    LOOP
      IF rec_user.rol IN ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL') THEN
        INSERT INTO notificaciones_perfil (notificacion_id, usuario)
        VALUES (NEW.id, rec_user.usuario)
        ON CONFLICT DO NOTHING;
      ELSIF rec_user.rol IN ('MUNICIPAL', 'CARAVANAS') THEN
        is_allowed := false;
        IF rec_user.municipios_allowed IS NOT NULL THEN
          FOREACH muni_item IN ARRAY rec_user.municipios_allowed LOOP
            IF upper(trim(muni_item)) = '*' OR (muni_upper != '' AND upper(trim(muni_item)) = muni_upper) THEN
              is_allowed := true;
            END IF;
          END LOOP;
        END IF;

        IF is_allowed THEN
          INSERT INTO notificaciones_perfil (notificacion_id, usuario)
          VALUES (NEW.id, rec_user.usuario)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Limpieza: copias ya repartidas a quien no es la unidad (solo las copias por perfil; el aviso maestro de la unidad no se toca).
DELETE FROM notificaciones_perfil np
USING notificaciones n, perfiles p
WHERE np.notificacion_id = n.id
  AND n.type = 'SIS_VALIDADO'
  AND p.usuario = np.usuario
  AND p.clues IS DISTINCT FROM n.target_clues;
