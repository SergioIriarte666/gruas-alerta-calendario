-- Fase 2 de Map Matching: km REALES por vía junto a los haversine actuales en
-- service_route_metrics. Cómputo asíncrono vía edge function
-- compute-matched-route-metrics + pg_cron; NUNCA en el cierre del servicio.
-- No toca compute_service_route_metrics ni trg_compute_route_metrics_fn: el
-- haversine sigue siendo la fuente primaria. Los valores matched acompañan.
BEGIN;

ALTER TABLE public.service_route_metrics
  ADD COLUMN IF NOT EXISTS matched_total_distance_km numeric,
  ADD COLUMN IF NOT EXISTS matched_en_route_distance_km numeric,
  ADD COLUMN IF NOT EXISTS matched_towing_distance_km numeric,
  ADD COLUMN IF NOT EXISTS matching_confidence numeric,
  ADD COLUMN IF NOT EXISTS matched_computed_at timestamptz;

-- Job pg_cron cada 10 minutos que invoca la edge function vía pg_net, con el
-- mismo mecanismo (URL /functions/v1 + x-cron-secret desde vault) que los crons
-- existentes (process-notification-outbox, purge-storage-orphans). Idempotente:
-- unschedule si existe antes de schedule.
DO $$
DECLARE
  existing_job record;
  matched_job_id bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'compute-matched-route-metrics-10min'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  matched_job_id := cron.schedule(
    'compute-matched-route-metrics-10min',
    '*/10 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/compute-matched-route-metrics',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $cron$
  );

  -- Registro del job en el mismo ledger que usan los otros crons (si existe).
  IF to_regclass('public.inspection_retention_cron_jobs') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.inspection_retention_cron_jobs (job_name, job_id, schedule)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_name) DO UPDATE
         SET job_id = EXCLUDED.job_id,
             schedule = EXCLUDED.schedule,
             created_at = now()'
    USING 'compute-matched-route-metrics-10min', matched_job_id, '*/10 * * * *';
  END IF;
END $$;

COMMIT;
