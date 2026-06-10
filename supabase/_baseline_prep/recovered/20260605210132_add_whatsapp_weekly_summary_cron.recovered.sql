-- Recuperado de supabase_migrations.schema_migrations (version 20260605210132,
-- name "add_whatsapp_weekly_summary_cron") el 2026-06-10. Aplicada en remoto
-- sin archivo local. NO re-aplicar: el job ya existe en produccion.

SELECT cron.schedule(
  'whatsapp-weekly-summary',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/whatsapp-weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'CRON_SECRET'
        LIMIT 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
