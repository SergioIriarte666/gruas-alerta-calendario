BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-documents', 'operator-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

UPDATE public.operator_documents
SET file_url = CASE
  WHEN split_part(file_url, '?', 1) ~ '/operator-documents/' THEN
    regexp_replace(split_part(file_url, '?', 1), '^.*?/operator-documents/', '')
  WHEN file_url ~ '^/?operator-documents/' THEN
    regexp_replace(file_url, '^/?operator-documents/', '')
  ELSE
    file_url
END
WHERE file_url IS NOT NULL;

DROP POLICY IF EXISTS "Admin puede gestionar todos los documentos de operadores" ON public.operator_documents;
DROP POLICY IF EXISTS "Usuarios pueden ver documentos de operadores" ON public.operator_documents;

CREATE POLICY "operator_documents_admin_all"
ON public.operator_documents
FOR ALL
TO authenticated
USING (public.is_admin_user_safe())
WITH CHECK (public.is_admin_user_safe());

CREATE POLICY "operator_documents_operator_owner_select"
ON public.operator_documents
FOR SELECT
TO authenticated
USING (
  public.is_operator_user_safe()
  AND EXISTS (
    SELECT 1
    FROM public.operators o
    WHERE o.id = operator_documents.operator_id
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lectura pública de documentos de operadores" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir documentos de operadores" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar documentos de operadores" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar documentos de operadores" ON storage.objects;

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
