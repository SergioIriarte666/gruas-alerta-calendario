CREATE TABLE IF NOT EXISTS public.internal_scheduler_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_scheduler_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_scheduler_secrets_block_all ON public.internal_scheduler_secrets;
CREATE POLICY internal_scheduler_secrets_block_all
ON public.internal_scheduler_secrets
FOR ALL
USING (false)
WITH CHECK (false);

INSERT INTO public.internal_scheduler_secrets (key, value)
VALUES ('generate_backup_cron', md5(random()::text || clock_timestamp()::text))
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'generate-auto-backup-daily';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'generate-auto-backup-daily',
  '15 3 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/generate-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT value
        FROM public.internal_scheduler_secrets
        WHERE key = 'generate_backup_cron'
      )
    ),
    body := jsonb_build_object(
      'source', 'pg_cron'
    )
  );
  $job$
);
