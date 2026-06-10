
-- Restrict change history tables to admin only (matches sensitivity of underlying data)
DROP POLICY IF EXISTS cch_select_authenticated ON public.cost_change_history;
CREATE POLICY cch_select_admin ON public.cost_change_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS cpch_select_authenticated ON public.crane_part_change_history;
CREATE POLICY cpch_select_admin ON public.crane_part_change_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

DROP POLICY IF EXISTS imch_select_authenticated ON public.inventory_movement_change_history;
CREATE POLICY imch_select_admin ON public.inventory_movement_change_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

-- Storage: quick-entry-photos bucket — enforce folder ownership (first folder = auth.uid())
DROP POLICY IF EXISTS authenticated_read_quick_entry ON storage.objects;
CREATE POLICY authenticated_read_quick_entry ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'quick-entry-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS authenticated_update_quick_entry ON storage.objects;
CREATE POLICY authenticated_update_quick_entry ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'quick-entry-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'quick-entry-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS authenticated_write_quick_entry ON storage.objects;
CREATE POLICY authenticated_write_quick_entry ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quick-entry-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Storage: company-assets — enforce folder ownership on INSERT
DROP POLICY IF EXISTS "Authenticated users can upload to company-assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload to company-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
