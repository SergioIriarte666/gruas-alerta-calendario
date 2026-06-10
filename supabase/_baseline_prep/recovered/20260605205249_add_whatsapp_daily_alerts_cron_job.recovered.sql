-- Recuperado de supabase_migrations.schema_migrations (version 20260605205249,
-- name "add_whatsapp_daily_alerts_cron_job") el 2026-06-10. Aplicada en remoto
-- sin archivo local. NO re-aplicar: el job ya existe en produccion.

-- Job pg_cron para whatsapp-daily-alerts
-- Se ejecuta de lunes a viernes a las 08:00 hora Chile (UTC-4 en verano / UTC-3 en invierno)
-- Usamos 11:00 UTC que equivale a 08:00 CLT (UTC-3, horario de invierno Chile)
-- En horario de verano Chile (UTC-4) serían las 07:00, aceptable para alertas matutinas

SELECT cron.schedule(
  'whatsapp-daily-alerts',
  '0 11 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/whatsapp-daily-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'CRON_SECRET'
        LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'source', 'pg_cron'
    )
  );
  $$
);
