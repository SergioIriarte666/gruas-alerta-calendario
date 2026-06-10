ALTER TABLE public.company_data
  ADD COLUMN IF NOT EXISTS daily_report_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_report_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_report_last_status text,
  ADD COLUMN IF NOT EXISTS daily_report_last_error text;

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
VALUES ('daily_pending_report_cron', md5(random()::text || clock_timestamp()::text))
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'send-daily-pending-report-hourly';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'send-daily-pending-report-hourly',
  '5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/send-daily-pending-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT value
        FROM public.internal_scheduler_secrets
        WHERE key = 'daily_pending_report_cron'
      )
    ),
    body := jsonb_build_object(
      'source', 'pg_cron'
    )
  );
  $job$
);
