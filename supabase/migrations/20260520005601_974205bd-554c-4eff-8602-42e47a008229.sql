
-- 1. Crane documents DELETE policy
DROP POLICY IF EXISTS "crane_docs_admin_operator_delete" ON storage.objects;
CREATE POLICY "crane_docs_admin_operator_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'crane-documents' AND (is_admin_user_safe() OR is_operator_user_safe()));

-- 2. company_profiles admin policy consistency
DROP POLICY IF EXISTS "Admins can manage company profiles" ON public.company_profiles;
CREATE POLICY "Admins can manage company profiles"
ON public.company_profiles FOR ALL
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- 3. Make view security_invoker
ALTER VIEW public.orphan_crane_parts_candidates SET (security_invoker = on);

-- 4. Set search_path on project-owned functions
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'auto_update_service_invoice_status',
    'check_cost_duplicates',
    'check_operator_not_excluded',
    'check_supplier_duplicates',
    'check_supplier_invoice_duplicates',
    'force_commission_sync_for_service',
    'generate_service_cash_receipt_folio',
    'sync_cost_deletion_cascade',
    'sync_cost_update_to_payment',
    'sync_service_company_from_crane',
    'sync_services_on_crane_company_change',
    'sync_supplier_invoice_delete',
    'sync_supplier_invoice_update',
    'touch_supplier_invoice_items_updated_at',
    'update_payment_applied_amount',
    'validate_product_service_description',
    'validate_service_invoice_consistency'
  ];
  rec record;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    FOR rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', rec.sig);
    END LOOP;
  END LOOP;
END $$;
