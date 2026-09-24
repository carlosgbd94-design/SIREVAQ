-- ======================================================================================
-- DESABASTO: CORREO CONSOLIDADO (UNO POR DESTINATARIO) EN LUGAR DE UNO POR ALERTA
-- ======================================================================================
-- ANTES: el trigger trg_notify_desabasto_critico llamaba a email-alerts/send-desabasto-alert
-- por cada fila ALERTA_DESABASTO -> una tarde de capturas = decenas de correos por persona.
--
-- AHORA: las alertas quedan pendientes (email_digest_ts IS NULL) y pg_cron invoca la Edge
-- Function `desabasto-digest` 3 veces al dia; cada destinatario recibe UN correo con las
-- unidades de su alcance agrupadas por municipio.
--
-- Ya aplicado en Supabase (migraciones desabasto_email_digest_columna_y_retiro_trigger y
-- desabasto_email_digest_cron). Se guarda aqui como referencia / para recrear el entorno.
-- Desplegar la funcion:  supabase functions deploy desabasto-digest
-- Probar sin enviar nada: POST {"dry_run": true} a la funcion (ver el cuerpo del cron abajo).
-- ======================================================================================

ALTER TABLE public.notificaciones ADD COLUMN IF NOT EXISTS email_digest_ts timestamptz;

-- Alertas historicas: ya salieron una por una con el trigger anterior.
UPDATE public.notificaciones
   SET email_digest_ts = COALESCE(created_ts, now())
 WHERE type = 'ALERTA_DESABASTO' AND email_digest_ts IS NULL;

DROP TRIGGER IF EXISTS trg_notify_desabasto_critico ON public.notificaciones;
DROP FUNCTION IF EXISTS public.notify_desabasto_critico();

CREATE INDEX IF NOT EXISTS notificaciones_desabasto_pendiente_idx
  ON public.notificaciones (created_ts)
  WHERE type = 'ALERTA_DESABASTO' AND email_digest_ts IS NULL;

-- 10:00, 14:00 y 18:00 hora de Mexico (UTC-6, sin horario de verano) = 16:00, 20:00 y 00:00 UTC.
SELECT cron.schedule(
  'enviar-resumen-desabasto',
  '0 0,16,20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/desabasto-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_email_alerts_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
