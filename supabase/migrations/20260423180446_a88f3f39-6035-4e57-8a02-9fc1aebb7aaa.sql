
-- ============================================================================
-- Security fix #1: Scope inspections access to assigned operators only
-- ============================================================================

-- Helper: returns true if the current user (operator) is assigned to a service
CREATE OR REPLACE FUNCTION public.is_operator_assigned_to_service(_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.services s
    LEFT JOIN public.operators o_primary ON o_primary.id = s.operator_id
    WHERE s.id = _service_id
      AND o_primary.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.service_resources sr
    JOIN public.operators o ON o.id = sr.operator_id
    WHERE sr.service_id = _service_id
      AND o.user_id = auth.uid()
  );
$$;

-- Drop the overly permissive operator policy
DROP POLICY IF EXISTS inspections_operator_access ON public.inspections;

-- Operators can SELECT only inspections of services they are assigned to
CREATE POLICY inspections_operator_select
ON public.inspections
FOR SELECT
TO authenticated
USING (
  public.is_operator_user_safe()
  AND public.is_operator_assigned_to_service(service_id)
);

-- Operators can INSERT only for services they are assigned to, and as themselves
CREATE POLICY inspections_operator_insert
ON public.inspections
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_operator_user_safe()
  AND public.is_operator_assigned_to_service(service_id)
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = inspections.operator_id
      AND o.user_id = auth.uid()
  )
);

-- Operators can UPDATE only inspections of services they are assigned to
CREATE POLICY inspections_operator_update
ON public.inspections
FOR UPDATE
TO authenticated
USING (
  public.is_operator_user_safe()
  AND public.is_operator_assigned_to_service(service_id)
)
WITH CHECK (
  public.is_operator_user_safe()
  AND public.is_operator_assigned_to_service(service_id)
);

-- Note: DELETE intentionally NOT granted to operators (admin-only via inspections_admin_full)


-- ============================================================================
-- Security fix #2: Add scoped UPDATE/DELETE policies for company-assets bucket
-- Allow authenticated users to update/delete only their own uploads (files
-- whose first folder segment equals their auth.uid()).
-- ============================================================================

DROP POLICY IF EXISTS "Users can update their own company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own company-assets" ON storage.objects;

CREATE POLICY "Users can update their own company-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own company-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
