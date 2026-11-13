-- Avisos de Pinol (solicitud, entrega, recepcion): solo para ADMIN, MUNICIPAL del municipio y la unidad.
-- JURISDICCIONAL, VISUALIZADOR_JURISDICCIONAL y CARAVANAS no ven ni surten Pinol y recibian una copia de cada uno.
-- (Mantiene lo de sis_validado_solo_unidad.sql: SIS_VALIDADO solo para la unidad.)

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
  es_pinol BOOLEAN := (NEW.id LIKE 'NOTIF:PINOL%' OR NEW.type = 'PINOL' OR NEW.title ILIKE '%pinol%');
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
      ELSIF NEW.type = 'SIS_VALIDADO' OR NEW.id LIKE 'NOTIF:PINOL_ENTREGA%' OR NEW.title ILIKE 'pinol entregado%' THEN
        NULL;   -- aviso solo para la unidad
      ELSIF es_pinol AND rec_user.rol IN ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'CARAVANAS') THEN
        NULL;   -- Pinol es de municipal/administrador y de la unidad
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
      IF es_pinol AND rec_user.rol IN ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'CARAVANAS') THEN
        CONTINUE;   -- Pinol es de municipal/administrador
      END IF;
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


-- Limpieza: copias de avisos de Pinol ya repartidas a perfiles que no ven ni surten Pinol.
DELETE FROM notificaciones_perfil np
USING notificaciones n, perfiles p
WHERE np.notificacion_id = n.id
  AND (n.id LIKE 'NOTIF:PINOL%' OR n.type = 'PINOL')
  AND p.usuario = np.usuario
  AND p.rol IN ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'CARAVANAS');
