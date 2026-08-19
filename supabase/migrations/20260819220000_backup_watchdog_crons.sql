-- Vigilancia del respaldo: que el silencio deje de parecer éxito.
--
-- El correo diario solo llega cuando el respaldo sale bien, así que si dejaba
-- de correr nadie se enteraba. Estos dos trabajos invierten esa señal.

-- Revisión diaria, después del respaldo (16:00 UTC) y de su copia a R2.
-- Avisa por correo si en 26 h no hubo respaldo, si quedó en `partial`, si trae
-- muchas menos tablas o filas de lo normal, o si R2 no tiene copia reciente.
SELECT cron.schedule(
  'backup-watchdog-daily',
  '0 19 * * *',
  $$
    SELECT net.http_post(
      url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/backup-watchdog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'CRON_SECRET' LIMIT 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

-- Simulacro de restauración, el día 3 de cada mes: baja el respaldo de R2,
-- restaura clients y services en una tabla temporal y los compara con
-- producción. Un respaldo que nadie restaura no se sabe si sirve.
SELECT cron.schedule(
  'verify-backup-restore-monthly',
  '30 5 3 * *',
  $$
    SELECT net.http_post(
      url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/verify-backup-restore',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'CRON_SECRET' LIMIT 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);
