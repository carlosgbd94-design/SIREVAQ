-- Cierre de la politica de lectura abierta de public.notificaciones.
-- 1) El trigger de reparto ahora tambien conoce ALL_CLUES, MUNICIPAL_USERS_ALL, MUNICIPIO_UNITS y ALL_MY_UNITS
--    (antes los repartia el navegador y fallaba por RLS: muchas unidades nunca tuvieron su fila de buzon).
-- 2) Se completan las filas de buzon que faltaban para avisos ya existentes (mismo estado que se ve hoy: sin leer).
-- 3) Se elimina "Authenticated users can read notifications" (USING true), que anulaba RLS_Notif_Select_Authorized.

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

  ELSIF NEW.target_scope = 'ALL_CLUES' THEN
    -- Todas las unidades + administrador/jurisdiccional/visualizador (mismo criterio que la bandeja).
    INSERT INTO notificaciones_perfil (notificacion_id, usuario)
    SELECT NEW.id, usuario FROM perfiles
    WHERE activo = 'SI' AND usuario != NEW.from_usuario
      AND (rol IN ('UNIDAD', 'ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL') OR clues IS NOT NULL)
    ON CONFLICT DO NOTHING;

  ELSIF NEW.target_scope = 'MUNICIPAL_USERS_ALL' THEN
    INSERT INTO notificaciones_perfil (notificacion_id, usuario)
    SELECT NEW.id, usuario FROM perfiles
    WHERE activo = 'SI' AND usuario != NEW.from_usuario
      AND rol IN ('MUNICIPAL', 'ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL')
    ON CONFLICT DO NOTHING;

  ELSIF NEW.target_scope IN ('MUNICIPIO_UNITS', 'ALL_MY_UNITS') THEN
    muni_upper := upper(trim(coalesce(NEW.target_municipio, '')));
    FOR rec_user IN
      SELECT usuario, rol, clues, municipio, municipios_allowed
      FROM perfiles
      WHERE activo = 'SI' AND usuario != NEW.from_usuario
    LOOP
      IF rec_user.rol IN ('ADMIN', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL') THEN
        INSERT INTO notificaciones_perfil (notificacion_id, usuario) VALUES (NEW.id, rec_user.usuario) ON CONFLICT DO NOTHING;
      ELSIF rec_user.rol = 'UNIDAD' OR rec_user.clues IS NOT NULL THEN
        IF muni_upper = '' OR upper(trim(coalesce(rec_user.municipio, ''))) = muni_upper THEN
          INSERT INTO notificaciones_perfil (notificacion_id, usuario) VALUES (NEW.id, rec_user.usuario) ON CONFLICT DO NOTHING;
        END IF;
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
          INSERT INTO notificaciones_perfil (notificacion_id, usuario) VALUES (NEW.id, rec_user.usuario) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;



-- 2) Relleno de buzones faltantes (lo que la bandeja ya muestra hoy a cada rol, sin cambiar lo visible).
WITH m AS (SELECT * FROM notificaciones WHERE target_scope <> 'GLOBAL'),
p AS (SELECT usuario, rol, clues, municipio, municipios_allowed FROM perfiles WHERE activo = 'SI')
INSERT INTO notificaciones_perfil (notificacion_id, usuario)
SELECT m.id, p.usuario FROM m JOIN p ON (
     (m.target_scope = 'ALL_CLUES' AND (p.rol IN ('UNIDAD','ADMIN','JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL') OR p.clues IS NOT NULL))
  OR (m.target_scope = 'MUNICIPAL_USERS_ALL' AND p.rol IN ('MUNICIPAL','ADMIN','JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL'))
  OR (m.target_scope = 'USUARIO' AND p.usuario = m.target_usuario)
  OR (m.target_scope = 'MUNICIPIO' AND (p.rol IN ('JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL') OR (p.rol IN ('MUNICIPAL','CARAVANAS') AND ('*' = ANY(p.municipios_allowed) OR upper(m.target_municipio) = ANY (SELECT upper(x) FROM unnest(p.municipios_allowed) x)))))
  OR (m.target_scope = 'CLUES' AND (p.clues = m.target_clues OR p.rol IN ('JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL') OR (p.rol IN ('MUNICIPAL','CARAVANAS') AND ('*' = ANY(p.municipios_allowed) OR upper(m.target_municipio) = ANY (SELECT upper(x) FROM unnest(p.municipios_allowed) x)))))
)
WHERE m.from_usuario IS DISTINCT FROM p.usuario
  AND NOT (m.id LIKE 'NOTIF:PINOL%' AND p.rol IN ('JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL','CARAVANAS'))
  AND NOT (m.type = 'SIS_VALIDADO' AND p.clues IS DISTINCT FROM m.target_clues)
ON CONFLICT DO NOTHING;

-- 3) Cierre: ya cada quien lee solo lo suyo (global, enviado por el usuario, o con fila en su buzon; ADMIN todo).
--    Verificado: UNIDAD ve 16 de 431, MUNICIPAL 90, JURISDICCIONAL 253, igual a lo que tiene en su buzon.
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON public.notificaciones;

-- 4) Los avisos viejos de Pinol (id NOTIF:<base64>, tipo SUCCESS) se reconocen por el titulo.
DELETE FROM notificaciones_perfil np
USING notificaciones n, perfiles p
WHERE np.notificacion_id = n.id
  AND (n.id LIKE 'NOTIF:PINOL%' OR n.type = 'PINOL' OR n.title ILIKE '%pinol%')
  AND n.target_scope IN ('CLUES', 'MUNICIPIO')
  AND p.usuario = np.usuario
  AND p.rol IN ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'CARAVANAS');

-- 5) "Pinol entregado" es solo para la unidad a la que se entrego (el municipal es quien entrega; no necesita el aviso).
DELETE FROM notificaciones_perfil np
USING notificaciones n, perfiles p
WHERE np.notificacion_id = n.id
  AND n.target_scope = 'CLUES'
  AND (n.id LIKE 'NOTIF:PINOL_ENTREGA%' OR n.title ILIKE 'pinol entregado%')
  AND p.usuario = np.usuario
  AND p.clues IS DISTINCT FROM n.target_clues;
