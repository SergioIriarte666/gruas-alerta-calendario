-- Programa el barrido diario del ledger inspection_storage_orphans.
--
-- Hasta ahora la tabla era un ledger de solo-escritura: recordInspectionStorageOrphan
-- encolaba objetos huerfanos pero ningun job los purgaba. Las filas de servicios ya
-- eliminados quedan con service_id NULL (FK ON DELETE SET NULL); la funcion
-- purge-storage-orphans las procesa igual (NO filtra por service_id).
--
-- Se reutiliza el patron de retencion R2: net.http_post + x-cron-secret desde vault.

DO $$
DECLARE
  existing_job record;
  purge_job_id bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'purge-storage-orphans-daily'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  purge_job_id := cron.schedule(
    'purge-storage-orphans-daily',
    '0 5 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/purge-storage-orphans',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $cron$
  );

  INSERT INTO public.inspection_retention_cron_jobs (job_name, job_id, schedule)
  VALUES ('purge-storage-orphans-daily', purge_job_id, '0 5 * * *')
  ON CONFLICT (job_name) DO UPDATE
    SET job_id = EXCLUDED.job_id,
        schedule = EXCLUDED.schedule,
        created_at = now();
END $$;
