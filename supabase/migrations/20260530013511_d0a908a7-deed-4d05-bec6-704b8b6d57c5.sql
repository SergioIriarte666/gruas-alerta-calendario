
DROP POLICY IF EXISTS invoice_cancellations_authenticated_select ON public.invoice_cancellations;
CREATE POLICY invoice_cancellations_scoped_select
  ON public.invoice_cancellations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR original_client_id = get_user_client_id_safe()
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_cancellations.invoice_id AND i.client_id = get_user_client_id_safe())
  );

DROP POLICY IF EXISTS invoice_closures_select_auth ON public.invoice_closures;
CREATE POLICY invoice_closures_scoped_select
  ON public.invoice_closures FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_closures.invoice_id AND i.client_id = get_user_client_id_safe())
  );

DROP POLICY IF EXISTS invoice_services_select_auth ON public.invoice_services;
CREATE POLICY invoice_services_scoped_select
  ON public.invoice_services FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_services.invoice_id AND i.client_id = get_user_client_id_safe())
  );

DROP POLICY IF EXISTS payment_applications_select_auth ON public.payment_applications;
CREATE POLICY payment_applications_scoped_select
  ON public.payment_applications FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_applications.invoice_id AND i.client_id = get_user_client_id_safe())
  );

DROP POLICY IF EXISTS "Authenticated users can view change history" ON public.service_change_history;
CREATE POLICY service_change_history_scoped_select
  ON public.service_change_history FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_change_history.service_id AND s.client_id = get_user_client_id_safe())
  );

DROP POLICY IF EXISTS "Restrict realtime to staff" ON realtime.messages;
CREATE POLICY "Realtime access for authenticated users"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR has_role(auth.uid(), 'client'::app_role)
    OR has_role(auth.uid(), 'viewer'::app_role)
  );
