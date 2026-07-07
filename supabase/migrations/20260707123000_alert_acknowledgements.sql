BEGIN;

CREATE TABLE IF NOT EXISTS public.alert_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  doc_expiry_date date NOT NULL,
  acknowledged_by uuid REFERENCES public.profiles(id),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (alert_key, doc_expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_alert_acknowledgements_alert_key
  ON public.alert_acknowledgements(alert_key);

ALTER TABLE public.alert_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_acknowledgements_admin_select"
  ON public.alert_acknowledgements
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user_safe());

CREATE POLICY "alert_acknowledgements_admin_insert"
  ON public.alert_acknowledgements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user_safe());

COMMIT;
