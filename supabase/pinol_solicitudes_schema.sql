-- ======================================================================================
-- MIGRACIÓN: ESQUEMA Y TRIGGERS DE pinol_solicitudes (VERSIONADO)
-- SIREVAQ 2026
-- ======================================================================================
-- CONTEXTO:
-- La tabla `pinol_solicitudes`, sus políticas RLS y el trigger `notify_admin_on_pinol`
-- existen en el proyecto de Supabase en producción (utclfqjietlxzlorxhrs) pero NUNCA se
-- versionaron en este repositorio.
--
-- Esta migración fue verificada contra la base de datos real (list_tables, pg_policies,
-- pg_get_functiondef, pg_get_triggerdef vía MCP de Supabase) el 2026-08-20, NO es una
-- reconstrucción por inferencia. Las secciones 1-4 documentan tal cual lo que YA EXISTE
-- (DROP+CREATE con la definición exacta, así que re-ejecutarlas es un no-op seguro).
-- La sección 5 es la única pieza nueva (mejora #4): un trigger que antes no existía.
-- ======================================================================================

-- 1. Tabla base (ya existe; solo agrega la columna nueva de la sección 5) --------------
ALTER TABLE public.pinol_solicitudes ADD COLUMN IF NOT EXISTS comentario_entrega TEXT;

CREATE INDEX IF NOT EXISTS idx_pinol_clues_estatus ON public.pinol_solicitudes(clues, estatus);
CREATE INDEX IF NOT EXISTS idx_pinol_municipio_estatus ON public.pinol_solicitudes(municipio, estatus);

-- 2. Realtime (ya habilitado en prod; DO block idempotente por si se corre en otro proyecto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pinol_solicitudes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pinol_solicitudes;
  END IF;
END $$;

-- 3. RLS existente en producción, documentada aquí verbatim (no se modifica el comportamiento)
-- NOTA: esta tabla usa perfiles.clues / perfiles.municipio (no clues_asignado/municipio_asignado
-- como registros_sis en fix_registros_sis_rls_multimunicipio.sql) -- son dos convenciones
-- distintas que coexisten en este proyecto; fuera del alcance de esta migración unificarlas.
ALTER TABLE public.pinol_solicitudes ENABLE ROW LEVEL SECURITY;

-- is_admin() ya está definida en public (SECURITY DEFINER, usada por otras tablas también)
-- y no se redefine aquí para no tocar nada fuera del alcance de pinol_solicitudes.
DROP POLICY IF EXISTS "RLS_pinol_solicitudes_Admin" ON public.pinol_solicitudes;
CREATE POLICY "RLS_pinol_solicitudes_Admin" ON public.pinol_solicitudes
FOR ALL
USING (is_admin());

DROP POLICY IF EXISTS "RLS_pinol_solicitudes_Unidad" ON public.pinol_solicitudes;
CREATE POLICY "RLS_pinol_solicitudes_Unidad" ON public.pinol_solicitudes
FOR ALL
USING (clues = (SELECT perfiles.clues FROM perfiles WHERE perfiles.id = auth.uid()));

DROP POLICY IF EXISTS "RLS_pinol_solicitudes_Muni" ON public.pinol_solicitudes;
CREATE POLICY "RLS_pinol_solicitudes_Muni" ON public.pinol_solicitudes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'MUNICIPAL'
      AND (
        pinol_solicitudes.municipio = perfiles.municipio
        OR pinol_solicitudes.municipio = ANY (perfiles.municipios_allowed)
        OR pinol_solicitudes.municipio = ANY (string_to_array(perfiles.municipio, ','))
      )
  )
);

DROP POLICY IF EXISTS "RLS_pinol_solicitudes_Muni_Update" ON public.pinol_solicitudes;
CREATE POLICY "RLS_pinol_solicitudes_Muni_Update" ON public.pinol_solicitudes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'MUNICIPAL'
      AND (
        pinol_solicitudes.municipio = perfiles.municipio
        OR pinol_solicitudes.municipio = ANY (perfiles.municipios_allowed)
        OR pinol_solicitudes.municipio = ANY (string_to_array(perfiles.municipio, ','))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'MUNICIPAL'
      AND (
        pinol_solicitudes.municipio = perfiles.municipio
        OR pinol_solicitudes.municipio = ANY (perfiles.municipios_allowed)
        OR pinol_solicitudes.municipio = ANY (string_to_array(perfiles.municipio, ','))
      )
  )
);

-- 4. Trigger "solicitud creada" -> notifica al municipal (YA EXISTE, documentado verbatim)
CREATE OR REPLACE FUNCTION public.notify_admin_on_pinol()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.estatus = 'PENDIENTE' THEN
    INSERT INTO notificaciones (
      id, created_ts, created_date, from_usuario, from_rol, target_scope,
      target_municipio, target_clues, title, message, type, status, meta_json
    ) VALUES (
      'NOTIF:PINOL_REQ:' || NEW.id, now(), current_date, NEW.capturado_por, 'UNIDAD', 'MUNICIPIO',
      NEW.municipio, NEW.clues, 'Nueva solicitud de pinol',
      'Unidad de salud: ' || NEW.unidad || E'\nSolicita: ' || NEW.capturado_por || E'\nCantidad: ' || NEW.solicitud_botellas || ' botella(s) de Pinol.',
      'PINOL', 'UNREAD',
      jsonb_build_object('source', 'PINOL', 'event', 'PINOL_SOLICITADO', 'pinol_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pinol_notify_trigger ON public.pinol_solicitudes;
CREATE TRIGGER pinol_notify_trigger
  AFTER INSERT ON public.pinol_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_pinol();

-- 5. Trigger "insumo entregado" -> notifica a la unidad (NUEVO, mejora #4) ------------------
-- Antes, main.js (case "markpinoldelivered") intentaba un INSERT directo del lado del
-- cliente en `notificaciones` y, si RLS lo bloqueaba, un comentario asumía que "un trigger
-- en Supabase lo generará" -- trigger que, verificado contra la base real, NO EXISTÍA.
-- Este trigger reemplaza esa suposición por una garantía real: la notificación de entrega
-- se crea siempre, de forma determinista, en la misma transacción del UPDATE de estatus.
-- Usa jsonb_build_object (igual que notify_admin_on_pinol de la sección 4) para que
-- meta_json quede como objeto real y no como string doble-codificado -- main.js ya tiene
-- el parseo defensivo (typeof === 'string' ? JSON.parse(...) : meta_json) en la mayoría de
-- los lectores de notificaciones; el único lector que no lo tenía (confirmpinolreceipt) se
-- corrigió en el mismo commit que esta migración.
CREATE OR REPLACE FUNCTION public.fn_notify_pinol_entregado()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.estatus = 'ENTREGADO' AND (OLD.estatus IS DISTINCT FROM 'ENTREGADO') THEN
    IF NOT EXISTS (SELECT 1 FROM notificaciones WHERE id = 'NOTIF:PINOL_ENTREGA:' || NEW.id) THEN
      INSERT INTO notificaciones (
        id, created_ts, created_date, from_usuario, from_rol, target_scope,
        target_clues, target_municipio, title, message, type, status, meta_json
      ) VALUES (
        'NOTIF:PINOL_ENTREGA:' || NEW.id, now(), current_date, NEW.entregado_por, 'MUNICIPAL', 'CLUES',
        NEW.clues, NEW.municipio, 'Pinol entregado',
        coalesce(nullif(trim(NEW.comentario_entrega), ''), 'Tu solicitud de pinol ha sido marcada como entregada.')
          || E'\nUnidad de salud: ' || coalesce(NEW.unidad, '') || ' (CLUES: ' || NEW.clues || ')'
          || E'\nFecha de solicitud: ' || coalesce(NEW.fecha_solicitud::text, ''),
        'SUCCESS', 'UNREAD',
        jsonb_build_object('source', 'PINOL', 'event', 'PINOL_ENTREGADO', 'pinol_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_pinol_entregado ON public.pinol_solicitudes;
CREATE TRIGGER trg_notify_pinol_entregado
  AFTER UPDATE ON public.pinol_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_pinol_entregado();

-- 6. Endurecimiento: get_advisors (security) marcó ambas funciones con
-- "search_path mutable" (WARN). No son SECURITY DEFINER así que el riesgo es bajo,
-- pero es gratis fijarlo ya que esta migración las está tocando de todos modos.
ALTER FUNCTION public.notify_admin_on_pinol() SET search_path = public;
ALTER FUNCTION public.fn_notify_pinol_entregado() SET search_path = public;

-- 7. Guard "no más de una solicitud activa por CLUES" (NUEVO) -------------------------------
-- Motivo: el candado de "guardar" (getPinolFlowStatus / hasActivePinol) SIEMPRE fue solo del
-- lado del cliente -- una lectura cacheada que decide si mostrar el botón habilitado. Nunca
-- hubo nada en la base de datos que impidiera una segunda fila PENDIENTE para la misma clues.
-- Verificado el 2026-08-21 contra producción: 8 unidades con 2 a 4 solicitudes activas
-- simultáneas para la misma clues (ej. QTSSA001332 AMAZCALA con 3), confirmando que el
-- candado de UI se puede saltar (multi-dispositivo, cola offline sin verificación de
-- duplicados -- ver offline_db.js syncQueue -- carrera de caché, etc.) sin que nada lo impida
-- del lado del servidor. Este trigger lo hace estructuralmente imposible de ahí en adelante,
-- sin importar cuál haya sido la causa exacta del lado del cliente. No toca las filas
-- duplicadas ya existentes (no es un índice único, así que no requiere limpiar datos antes
-- de aplicarse) -- esas se resuelven manualmente desde el panel municipal (ícono de basura).
CREATE OR REPLACE FUNCTION public.fn_pinol_reject_duplicate_active()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.estatus = 'PENDIENTE' THEN
    IF EXISTS (
      SELECT 1 FROM pinol_solicitudes
      WHERE clues = NEW.clues
        AND estatus IN ('PENDIENTE','ENTREGADO')
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Ya existe una solicitud de Pinol activa para esta unidad (CLUES %). Debe completarse y confirmarse como recibida antes de crear una nueva.', NEW.clues
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_pinol_reject_duplicate_active ON public.pinol_solicitudes;
CREATE TRIGGER trg_pinol_reject_duplicate_active
  BEFORE INSERT ON public.pinol_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.fn_pinol_reject_duplicate_active();

-- 8. Autoclean: al abrir un ciclo nuevo, borra el ciclo anterior ya cerrado (NUEVO) --------
-- Pedido explícito: si una unidad ya recibió y confirmó su Pinol, esa fila RECIBIDO se sigue
-- mostrando en el panel (es la referencia de "última entrega") hasta que la misma unidad
-- vuelva a solicitar -- en ese momento se borra el ciclo anterior para no acumular historial
-- muerto. Solo puede quedar RECIBIDO para limpiar: trg_pinol_reject_duplicate_active (sección
-- 7) ya impide que este INSERT llegue a ejecutarse si hay algo PENDIENTE/ENTREGADO sin cerrar.
CREATE OR REPLACE FUNCTION public.fn_pinol_autoclean_recibido()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.estatus = 'PENDIENTE' THEN
    DELETE FROM pinol_solicitudes
    WHERE clues = NEW.clues
      AND estatus = 'RECIBIDO'
      AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_pinol_autoclean_recibido ON public.pinol_solicitudes;
CREATE TRIGGER trg_pinol_autoclean_recibido
  AFTER INSERT ON public.pinol_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.fn_pinol_autoclean_recibido();

-- 9. Al confirmar una recepción, cierra también las entregas anteriores sin confirmar (NUEVO) --
-- Aplicado en prod 2026-10-07. Cubre web y móvil (ambos solo actualizan la fila de su notificación).
-- Se limpiaron además a mano las filas ENTREGADO/PENDIENTE duplicadas heredadas de antes del
-- candado de la sección 7, dejando activa solo la más reciente por CLUES.
CREATE OR REPLACE FUNCTION public.fn_pinol_cerrar_entregas_previas()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.estatus = 'RECIBIDO' AND OLD.estatus IS DISTINCT FROM 'RECIBIDO' THEN
    UPDATE pinol_solicitudes
       SET estatus = 'RECIBIDO', recibido_ts = coalesce(recibido_ts, NEW.recibido_ts, now())
     WHERE clues = NEW.clues
       AND id <> NEW.id
       AND estatus = 'ENTREGADO'
       AND timestamp_solicitud <= NEW.timestamp_solicitud;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_pinol_cerrar_entregas_previas ON public.pinol_solicitudes;
CREATE TRIGGER trg_pinol_cerrar_entregas_previas
  AFTER UPDATE OF estatus ON public.pinol_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.fn_pinol_cerrar_entregas_previas();

-- ======================================================================================
-- NOTA (get_advisors, verificado tras aplicar esta migración el 2026-08-20):
-- pinol_solicitudes ya tenía, ANTES de esta migración, políticas RLS permisivas
-- superpuestas (RLS_pinol_solicitudes_Admin se solapa con Unidad/Muni/Muni_Update en
-- varias acciones) y auth.uid() sin envolver en (select ...) -- ambos son hallazgos
-- de performance/lint pre-existentes que esta migración solo redeclara verbatim, no
-- introduce. Quedan fuera del alcance de este cambio (mejoras #1-#4 de trazabilidad
-- del flujo de Pinol); repórtalos aparte si se quiere una limpieza de RLS.
-- ======================================================================================
-- VERIFICACIÓN
-- SELECT * FROM pg_policies WHERE tablename = 'pinol_solicitudes';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.pinol_solicitudes'::regclass;
-- ======================================================================================
