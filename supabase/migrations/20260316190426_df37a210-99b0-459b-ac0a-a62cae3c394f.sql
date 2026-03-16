-- Fix PUBLIC_DATA_EXPOSURE: Remove overly permissive policy that grants ALL access to any authenticated user
DROP POLICY IF EXISTS "services_authenticated_access" ON services;

-- Fix the loose services_update_permissive_policy that allows any authenticated user to update non-invoiced services
DROP POLICY IF EXISTS "services_update_permissive_policy" ON services;

-- Replace with a properly scoped update policy
CREATE POLICY "services_update_scoped" ON services
FOR UPDATE TO authenticated
USING (
  is_admin_user_safe()
  OR (
    is_operator_user_safe() AND EXISTS (
      SELECT 1 FROM operators o
      WHERE o.user_id = auth.uid()
      AND (o.id = services.operator_id OR EXISTS (
        SELECT 1 FROM service_resources sr WHERE sr.service_id = services.id AND sr.operator_id = o.id
      ))
    )
  )
)
WITH CHECK (
  is_admin_user_safe()
  OR (
    is_operator_user_safe() AND EXISTS (
      SELECT 1 FROM operators o
      WHERE o.user_id = auth.uid()
      AND (o.id = services.operator_id OR EXISTS (
        SELECT 1 FROM service_resources sr WHERE sr.service_id = services.id AND sr.operator_id = o.id
      ))
    )
  )
);