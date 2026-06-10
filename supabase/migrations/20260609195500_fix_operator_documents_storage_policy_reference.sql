BEGIN;

DROP POLICY IF EXISTS "operator_documents_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "operator_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "operator_documents_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "operator_documents_storage_delete" ON storage.objects;

CREATE POLICY "operator_documents_storage_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'operator-documents'
  AND (
    public.is_admin_user_safe()
    OR (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.operators o
      WHERE o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "operator_documents_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'operator-documents'
  AND (
    public.is_admin_user_safe()
    OR (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.operators o
      WHERE o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "operator_documents_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'operator-documents'
  AND (
    public.is_admin_user_safe()
    OR (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.operators o
      WHERE o.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'operator-documents'
  AND (
    public.is_admin_user_safe()
    OR (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.operators o
      WHERE o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "operator_documents_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'operator-documents'
  AND (
    public.is_admin_user_safe()
    OR (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.operators o
      WHERE o.user_id = auth.uid()
    )
  )
);

COMMIT;
