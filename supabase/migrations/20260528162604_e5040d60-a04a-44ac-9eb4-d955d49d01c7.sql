
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL DEFAULT 'outbound',
  event text,
  template_name text NOT NULL,
  recipient_phone text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error_code text,
  error_message text,
  attempts smallint NOT NULL DEFAULT 0,
  triggered_by uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT whatsapp_message_log_status_check CHECK (
    status IN ('queued','sent','delivered','read','failed')
  ),
  CONSTRAINT whatsapp_message_log_direction_check CHECK (
    direction IN ('outbound','inbound')
  )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_created_at
  ON public.whatsapp_message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_provider_msg
  ON public.whatsapp_message_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_status
  ON public.whatsapp_message_log (status);

GRANT SELECT ON public.whatsapp_message_log TO authenticated;
GRANT ALL ON public.whatsapp_message_log TO service_role;

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view whatsapp logs" ON public.whatsapp_message_log;
CREATE POLICY "Admins can view whatsapp logs"
  ON public.whatsapp_message_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_whatsapp_message_log_updated_at ON public.whatsapp_message_log;
CREATE TRIGGER update_whatsapp_message_log_updated_at
  BEFORE UPDATE ON public.whatsapp_message_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
