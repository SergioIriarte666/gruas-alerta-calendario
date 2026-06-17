BEGIN;

CREATE TABLE IF NOT EXISTS public.business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  related_entity_type text,
  related_entity_id uuid,
  document_date date,
  expires_at date,
  is_confidential boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT business_documents_category_check CHECK (
    category IN (
      'contratos',
      'permisos',
      'seguros',
      'documentos_legales',
      'documentos_vehiculos',
      'documentos_operadores',
      'proveedores',
      'clientes',
      'facturas_y_respaldo',
      'otros'
    )
  ),
  CONSTRAINT business_documents_file_path_unique UNIQUE (file_path)
);

CREATE INDEX IF NOT EXISTS idx_business_documents_active_created_at
  ON public.business_documents (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_documents_category_active
  ON public.business_documents (category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_documents_expires_at_active
  ON public.business_documents (expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_documents_related_entity_active
  ON public.business_documents (related_entity_type, related_entity_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_documents_tags
  ON public.business_documents USING gin (tags);

CREATE OR REPLACE FUNCTION public.update_business_documents_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_documents_updated_at ON public.business_documents;
CREATE TRIGGER trg_business_documents_updated_at
  BEFORE UPDATE ON public.business_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_documents_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_confidential_business_documents()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::text IN ('admin', 'supervisor')
  );
$$;

ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_documents_select_active" ON public.business_documents;
CREATE POLICY "business_documents_select_active"
  ON public.business_documents
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "business_documents_insert" ON public.business_documents;
CREATE POLICY "business_documents_insert"
  ON public.business_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      is_confidential IS NOT TRUE
      OR public.can_manage_confidential_business_documents()
    )
  );

DROP POLICY IF EXISTS "business_documents_update" ON public.business_documents;
CREATE POLICY "business_documents_update"
  ON public.business_documents
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      is_confidential IS NOT TRUE
      OR public.can_manage_confidential_business_documents()
    )
  )
  WITH CHECK (
    (
      is_confidential IS NOT TRUE
      OR public.can_manage_confidential_business_documents()
    )
  );

DROP POLICY IF EXISTS "business_documents_delete_admin_only" ON public.business_documents;
CREATE POLICY "business_documents_delete"
  ON public.business_documents
  FOR DELETE
  TO authenticated
  USING (
    is_confidential IS NOT TRUE
    OR public.can_manage_confidential_business_documents()
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-documents',
  'business-documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'application/xml',
    'text/xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS business_documents_storage_insert ON storage.objects;
CREATE POLICY business_documents_storage_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS business_documents_storage_read ON storage.objects;
CREATE POLICY business_documents_storage_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1
      FROM public.business_documents bd
      WHERE bd.file_path = storage.objects.name
        AND bd.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS business_documents_storage_update ON storage.objects;
CREATE POLICY business_documents_storage_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND public.can_manage_confidential_business_documents()
  )
  WITH CHECK (
    bucket_id = 'business-documents'
    AND public.can_manage_confidential_business_documents()
  );

DROP POLICY IF EXISTS business_documents_storage_delete ON storage.objects;
CREATE POLICY business_documents_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.can_manage_confidential_business_documents()
      OR EXISTS (
        SELECT 1
        FROM public.business_documents bd
        WHERE bd.file_path = storage.objects.name
          AND bd.is_confidential IS NOT TRUE
      )
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND NOT EXISTS (
          SELECT 1
          FROM public.business_documents bd
          WHERE bd.file_path = storage.objects.name
        )
      )
    )
  );

GRANT ALL ON TABLE public.business_documents TO authenticated;
GRANT ALL ON TABLE public.business_documents TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_confidential_business_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_documents_updated_at() TO service_role;

COMMIT;
