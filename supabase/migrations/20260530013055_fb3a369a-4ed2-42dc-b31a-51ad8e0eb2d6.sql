ALTER TABLE public.whatsapp_message_log 
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID;

CREATE INDEX IF NOT EXISTS idx_wa_log_visible
  ON public.whatsapp_message_log (created_at DESC)
  WHERE hidden_at IS NULL;

DROP POLICY IF EXISTS "Admins can hide whatsapp logs" ON public.whatsapp_message_log;
CREATE POLICY "Admins can hide whatsapp logs"
  ON public.whatsapp_message_log
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));