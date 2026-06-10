
-- =============================================
-- 1. Fix operator over-access on services table
-- =============================================

-- Drop the overly broad operator ALL policy
DROP POLICY IF EXISTS "services_operator_access" ON public.services;

-- Drop the redundant broad "Enhanced" policy
DROP POLICY IF EXISTS "Enhanced service access policy" ON public.services;

-- Add scoped SELECT for operators: only services they're assigned to
CREATE POLICY "services_operator_select_scoped"
ON public.services
FOR SELECT
TO authenticated
USING (
  is_operator_user_safe() AND (
    EXISTS (
      SELECT 1 FROM operators o
      WHERE o.user_id = auth.uid()
        AND (
          o.id = services.operator_id
          OR EXISTS (
            SELECT 1 FROM service_resources sr
            WHERE sr.service_id = services.id AND sr.operator_id = o.id
          )
        )
    )
  )
);

-- Allow operators to INSERT services (they need this for creating services)
CREATE POLICY "services_operator_insert"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (is_operator_user_safe());

-- =============================================
-- 2. Fix crane-documents storage policies
-- =============================================

-- Drop overly broad storage policies for crane-documents
DROP POLICY IF EXISTS "authenticated_read_crane_docs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_crane_docs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_write_crane_docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload crane documents" ON storage.objects;

-- Scoped read: only admin or operator can read crane documents
CREATE POLICY "crane_docs_admin_operator_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'crane-documents'
  AND (is_admin_user_safe() OR is_operator_user_safe())
);

-- Scoped insert: only admin or operator can upload crane documents
CREATE POLICY "crane_docs_admin_operator_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'crane-documents'
  AND (is_admin_user_safe() OR is_operator_user_safe())
);

-- Scoped update: only admin or operator can update crane documents
CREATE POLICY "crane_docs_admin_operator_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'crane-documents'
  AND (is_admin_user_safe() OR is_operator_user_safe())
);
