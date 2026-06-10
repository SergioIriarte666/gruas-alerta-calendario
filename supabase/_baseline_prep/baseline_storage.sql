-- ============================================================================
-- COMPLEMENTO BASELINE — storage: buckets + policies sobre storage.objects
-- Un dump del esquema public NO incluye nada de esto.
-- ============================================================================
-- ===== BUCKETS =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('avatars', 'avatars', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('backups-auto', 'backups-auto', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('company-assets', 'company-assets', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('crane-documents', 'crane-documents', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('inspection-pdfs', 'inspection-pdfs', false, 20971520, '{application/pdf}'::text[]) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('inspection-photos', 'inspection-photos', false, 5242880, '{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('operator-documents', 'operator-documents', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('quick-entry-photos', 'quick-entry-photos', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- ===== POLICIES (storage.objects) =====
CREATE POLICY "Anyone can view avatars" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));

CREATE POLICY "Authenticated users can upload to company-assets" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'company-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Public read access for company-assets" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = 'company-assets'::text));

CREATE POLICY "Users can delete own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can delete their own company-assets" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'company-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Users can update own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can update their own company-assets" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'company-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))) WITH CHECK (((bucket_id = 'company-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Users can upload own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY authenticated_read_quick_entry ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'quick-entry-photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role))));

CREATE POLICY authenticated_update_quick_entry ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'quick-entry-photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role)))) WITH CHECK (((bucket_id = 'quick-entry-photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role))));

CREATE POLICY authenticated_write_quick_entry ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'quick-entry-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY backups_auto_admin_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'backups-auto'::text) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY backups_auto_admin_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'backups-auto'::text) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY backups_auto_admin_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'backups-auto'::text) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY backups_auto_admin_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'backups-auto'::text) AND has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((bucket_id = 'backups-auto'::text) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY crane_docs_admin_operator_delete ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'crane-documents'::text) AND (is_admin_user_safe() OR is_operator_user_safe())));

CREATE POLICY crane_docs_admin_operator_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'crane-documents'::text) AND (is_admin_user_safe() OR is_operator_user_safe())));

CREATE POLICY crane_docs_admin_operator_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'crane-documents'::text) AND (is_admin_user_safe() OR is_operator_user_safe())));

CREATE POLICY crane_docs_admin_operator_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'crane-documents'::text) AND (is_admin_user_safe() OR is_operator_user_safe())));

CREATE POLICY inspection_pdfs_operator_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'inspection-pdfs'::text) AND is_operator_user_safe()));

CREATE POLICY inspection_pdfs_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'inspection-pdfs'::text) AND (is_operator_user_safe() OR is_admin_user_safe())));

CREATE POLICY inspection_photos_operator_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'inspection-photos'::text) AND is_operator_user_safe()));

CREATE POLICY inspection_photos_operator_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'inspection-photos'::text) AND (is_operator_user_safe() OR is_admin_user_safe())));

CREATE POLICY inspection_photos_operator_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'inspection-photos'::text) AND is_operator_user_safe()));

CREATE POLICY operator_documents_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'operator-documents'::text) AND (is_admin_user_safe() OR ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM operators o
  WHERE (o.user_id = auth.uid()))))));

CREATE POLICY operator_documents_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'operator-documents'::text) AND (is_admin_user_safe() OR ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM operators o
  WHERE (o.user_id = auth.uid()))))));

CREATE POLICY operator_documents_storage_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'operator-documents'::text) AND (is_admin_user_safe() OR ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM operators o
  WHERE (o.user_id = auth.uid()))))));

CREATE POLICY operator_documents_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'operator-documents'::text) AND (is_admin_user_safe() OR ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM operators o
  WHERE (o.user_id = auth.uid())))))) WITH CHECK (((bucket_id = 'operator-documents'::text) AND (is_admin_user_safe() OR ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM operators o
  WHERE (o.user_id = auth.uid()))))));

CREATE POLICY quick_entry_photos_user_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'quick-entry-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY storage_admin_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((is_admin_user_safe() OR ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))));

