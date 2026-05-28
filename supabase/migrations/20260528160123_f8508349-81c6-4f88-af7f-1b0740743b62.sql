
-- 1) whatsapp_settings: remove permissive SELECT for all authenticated users.
--    Admin-only management policy already covers admins; restrict reads to admins only.
DROP POLICY IF EXISTS "Authenticated users can view whatsapp settings" ON public.whatsapp_settings;

-- 2) service_cash_receipts: restrict INSERT to admins or operators (not any authenticated user)
DROP POLICY IF EXISTS service_cash_receipts_insert ON public.service_cash_receipts;
CREATE POLICY service_cash_receipts_insert
  ON public.service_cash_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_admin_user_safe() OR public.is_operator_user_safe())
  );

-- Also add an explicit DELETE policy: only admins (and the creator if operator) can delete
DROP POLICY IF EXISTS service_cash_receipts_delete ON public.service_cash_receipts;
CREATE POLICY service_cash_receipts_delete
  ON public.service_cash_receipts
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin_user_safe()
    OR (public.is_operator_user_safe() AND created_by = auth.uid())
  );

-- 3) Explicit admin-only storage policies for the private 'backups-auto' bucket
DROP POLICY IF EXISTS "backups_auto_admin_select" ON storage.objects;
CREATE POLICY "backups_auto_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'backups-auto'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "backups_auto_admin_insert" ON storage.objects;
CREATE POLICY "backups_auto_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'backups-auto'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "backups_auto_admin_update" ON storage.objects;
CREATE POLICY "backups_auto_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'backups-auto'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'backups-auto'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "backups_auto_admin_delete" ON storage.objects;
CREATE POLICY "backups_auto_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'backups-auto'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4) Set immutable search_path on the only user-defined function lacking it
ALTER FUNCTION public.set_import_rut_mappings_updated_at() SET search_path = public;
