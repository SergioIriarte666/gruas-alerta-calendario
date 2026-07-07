BEGIN;

CREATE TABLE IF NOT EXISTS public.client_billing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  position text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_billing_contacts_client
  ON public.client_billing_contacts(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_billing_contacts_client_email
  ON public.client_billing_contacts(client_id, lower(email));

ALTER TABLE public.client_billing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_billing_contacts_admin_full_access" ON "public"."client_billing_contacts"
  TO "authenticated"
  USING ("public"."is_admin_user_safe"())
  WITH CHECK ("public"."is_admin_user_safe"());

CREATE POLICY "client_billing_contacts_select_authenticated" ON "public"."client_billing_contacts"
  FOR SELECT TO "authenticated"
  USING (true);

CREATE TABLE IF NOT EXISTS public.invoice_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  email_type text NOT NULL DEFAULT 'overdue_notification',
  recipients text[] NOT NULL,
  sent_by uuid REFERENCES public.profiles(id),
  resend_id text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_email_log_invoice
  ON public.invoice_email_log(invoice_id);

ALTER TABLE public.invoice_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_email_log_select_authenticated" ON "public"."invoice_email_log"
  FOR SELECT TO "authenticated"
  USING (true);

COMMIT;
