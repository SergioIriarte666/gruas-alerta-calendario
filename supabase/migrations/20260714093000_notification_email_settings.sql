BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_enabled boolean NOT NULL DEFAULT true,
  send_inspection_completed boolean NOT NULL DEFAULT true,
  send_vehicle_pickup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_email_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.notification_email_settings TO authenticated;
GRANT ALL ON public.notification_email_settings TO service_role;

DROP POLICY IF EXISTS "Admins can manage notification email settings" ON public.notification_email_settings;
CREATE POLICY "Admins can manage notification email settings"
  ON public.notification_email_settings
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_notification_email_settings_updated_at ON public.notification_email_settings;
CREATE TRIGGER update_notification_email_settings_updated_at
  BEFORE UPDATE ON public.notification_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_email_settings (
  email_enabled,
  send_inspection_completed,
  send_vehicle_pickup
)
SELECT true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.notification_email_settings);

COMMIT;
