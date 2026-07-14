BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'tracking_link',
    'inspection_whatsapp',
    'inspection_email',
    'delivery_whatsapp',
    'delivery_email'
  )),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  inspection_id uuid REFERENCES public.inspections(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_outbox_service
  ON public.notification_outbox (service_id, created_at DESC);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification_outbox TO authenticated;
GRANT ALL ON public.notification_outbox TO service_role;

DROP POLICY IF EXISTS "Admins can view notification outbox" ON public.notification_outbox;
CREATE POLICY "Admins can view notification outbox"
  ON public.notification_outbox
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit integer DEFAULT 10)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH next_rows AS (
    SELECT id
    FROM public.notification_outbox
    WHERE status = 'pending'
      AND attempts < 5
    ORDER BY created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox outbox
  SET status = 'processing',
      last_error = NULL
  FROM next_rows
  WHERE outbox.id = next_rows.id
  RETURNING outbox.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_tracking_link_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
    INSERT INTO public.notification_outbox (kind, service_id, payload)
    VALUES (
      'tracking_link',
      NEW.id,
      jsonb_build_object('source', 'services_status_trigger')
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_tracking_link_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_tracking_link_notification() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_tracking_link_notification() FROM authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_tracking_link_notification ON public.services;
CREATE TRIGGER trg_enqueue_tracking_link_notification
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_tracking_link_notification();

CREATE OR REPLACE FUNCTION public.enqueue_initial_inspection_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.pdf_url IS NOT NULL THEN
    INSERT INTO public.notification_outbox (kind, service_id, inspection_id, payload)
    VALUES
      (
        'inspection_whatsapp',
        NEW.service_id,
        NEW.id,
        jsonb_build_object(
          'phase', 'initial',
          'pdf', jsonb_build_object('bucket', 'inspection-pdfs', 'path', NEW.pdf_url),
          'source', 'inspections_insert_trigger'
        )
      ),
      (
        'inspection_email',
        NEW.service_id,
        NEW.id,
        jsonb_build_object(
          'phase', 'initial',
          'pdf', jsonb_build_object('bucket', 'inspection-pdfs', 'path', NEW.pdf_url),
          'source', 'inspections_insert_trigger'
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_initial_inspection_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_initial_inspection_notifications() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_initial_inspection_notifications() FROM authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_initial_inspection_notifications ON public.inspections;
CREATE TRIGGER trg_enqueue_initial_inspection_notifications
  AFTER INSERT ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_initial_inspection_notifications();

CREATE OR REPLACE FUNCTION public.enqueue_delivery_inspection_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.pdf_retiro_url IS NULL AND NEW.pdf_retiro_url IS NOT NULL THEN
    INSERT INTO public.notification_outbox (kind, service_id, inspection_id, payload)
    VALUES
      (
        'delivery_whatsapp',
        NEW.service_id,
        NEW.id,
        jsonb_build_object(
          'phase', 'final',
          'pdf', jsonb_build_object('bucket', 'inspection-pdfs', 'path', NEW.pdf_retiro_url),
          'source', 'inspections_delivery_update_trigger'
        )
      ),
      (
        'delivery_email',
        NEW.service_id,
        NEW.id,
        jsonb_build_object(
          'phase', 'final',
          'pdf', jsonb_build_object('bucket', 'inspection-pdfs', 'path', NEW.pdf_retiro_url),
          'source', 'inspections_delivery_update_trigger'
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_delivery_inspection_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_delivery_inspection_notifications() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_delivery_inspection_notifications() FROM authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_delivery_inspection_notifications ON public.inspections;
CREATE TRIGGER trg_enqueue_delivery_inspection_notifications
  AFTER UPDATE OF pdf_retiro_url ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_delivery_inspection_notifications();

DO $$
DECLARE
  existing_job record;
  outbox_job_id bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'process-notification-outbox-minutely'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  outbox_job_id := cron.schedule(
    'process-notification-outbox-minutely',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/process-notification-outbox',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $cron$
  );

  IF to_regclass('public.inspection_retention_cron_jobs') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.inspection_retention_cron_jobs (job_name, job_id, schedule)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_name) DO UPDATE
         SET job_id = EXCLUDED.job_id,
             schedule = EXCLUDED.schedule,
             created_at = now()'
    USING 'process-notification-outbox-minutely', outbox_job_id, '* * * * *';
  END IF;
END $$;

COMMIT;
