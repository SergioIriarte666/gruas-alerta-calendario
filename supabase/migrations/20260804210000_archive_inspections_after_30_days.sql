BEGIN;

-- Las evidencias de inspección permanecen 30 días en Supabase Storage. Luego
-- este cron las copia y verifica en R2 antes de eliminar los objetos originales.
-- El lote pequeño protege el límite de ejecución de Edge Functions del plan Free;
-- al ejecutarse diariamente puede absorber hasta 300 inspecciones por mes.
DO $$
DECLARE
  existing_job record;
  archive_job_id bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'archive-inspections-to-r2-monthly',
      'archive-inspections-to-r2-daily'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  archive_job_id := cron.schedule(
    'archive-inspections-to-r2-daily',
    '30 3 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/archive-inspections-to-r2?limit=10',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'CRON_SECRET'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron', 'retention_days', 30)
      );
    $cron$
  );

  DELETE FROM public.inspection_retention_cron_jobs
  WHERE job_name IN (
    'archive-inspections-to-r2-monthly',
    'archive-inspections-to-r2-daily'
  );

  INSERT INTO public.inspection_retention_cron_jobs (job_name, job_id, schedule)
  VALUES ('archive-inspections-to-r2-daily', archive_job_id, '30 3 * * *');
END $$;

COMMIT;
