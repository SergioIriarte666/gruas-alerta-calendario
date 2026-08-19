-- Cron de la copia fuera de sitio y de la purga de respaldos.
--
-- El respaldo diario corre a las 12:00 de Santiago (16:00 UTC) y tarda ~85 s.
-- La copia a R2 va después, no dentro: sumarla al respaldo lo mataba con
-- WORKER_RESOURCE_LIMIT. La purga corre más tarde todavía, para no borrar nunca
-- antes de haber copiado.
--
-- Retención acordada con el dueño (2026-08-19): 30 días completos + una copia
-- mensual durante 12 meses.

-- Copia a R2. Cada hora a propósito: la función es un reconciliador idempotente
-- y sube por lotes de 3 días, así que si un día falla, la corrida siguiente lo
-- recupera sin que nadie intervenga.
SELECT cron.schedule(
  'sync-backups-to-r2-hourly',
  '25 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/sync-backups-to-r2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'CRON_SECRET' LIMIT 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron', 'limit', 3)
    );
  $$
);

-- Purga diaria, bien después de la copia. `dry_run: false` es explícito: la
-- función no borra si no se lo piden.
SELECT cron.schedule(
  'purge-old-backups-daily',
  '45 6 * * *',
  $$
    SELECT net.http_post(
      url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/purge-old-backups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'CRON_SECRET' LIMIT 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron', 'dry_run', false)
    );
  $$
);
