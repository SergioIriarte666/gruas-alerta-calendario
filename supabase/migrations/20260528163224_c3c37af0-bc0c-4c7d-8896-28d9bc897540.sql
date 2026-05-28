-- Phase 2: idempotency for operator WhatsApp notification
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS operator_notified_at timestamptz;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS operator_notified_for uuid;
CREATE INDEX IF NOT EXISTS idx_services_operator_notified_at ON public.services(operator_notified_at);

-- Tracking table to avoid duplicate overdue/no-operator alerts in the same day
CREATE TABLE IF NOT EXISTS public.whatsapp_alert_dedupe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  sent_for_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santiago')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (alert_key, sent_for_date)
);

GRANT SELECT ON public.whatsapp_alert_dedupe TO authenticated;
GRANT ALL ON public.whatsapp_alert_dedupe TO service_role;

ALTER TABLE public.whatsapp_alert_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp alert dedupe"
ON public.whatsapp_alert_dedupe FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));