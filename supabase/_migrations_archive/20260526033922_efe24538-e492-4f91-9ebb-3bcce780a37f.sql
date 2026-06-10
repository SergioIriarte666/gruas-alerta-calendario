CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_phone_1 TEXT,
  admin_phone_2 TEXT,
  notify_operator_assigned BOOLEAN NOT NULL DEFAULT true,
  notify_service_completed BOOLEAN NOT NULL DEFAULT true,
  notify_document_expiry BOOLEAN NOT NULL DEFAULT true,
  notify_payment_pending BOOLEAN NOT NULL DEFAULT true,
  notify_service_no_quote BOOLEAN NOT NULL DEFAULT true,
  notify_service_no_operator BOOLEAN NOT NULL DEFAULT false,
  notify_invoice_overdue BOOLEAN NOT NULL DEFAULT false,
  notify_daily_reminder BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Admins can manage whatsapp settings"
  ON public.whatsapp_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can view whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Authenticated users can view whatsapp settings"
  ON public.whatsapp_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS update_whatsapp_settings_updated_at ON public.whatsapp_settings;
CREATE TRIGGER update_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_settings (admin_phone_1)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings);