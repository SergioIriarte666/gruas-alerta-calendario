-- Alinear política de INSERT en inspections con el patrón de storage (operator OR admin).
-- Un admin haciendo una inspección en terreno no debe ser bloqueado por RLS.
DROP POLICY IF EXISTS "inspections_operator_insert" ON public.inspections;

CREATE POLICY "inspections_operator_insert" ON public.inspections
FOR INSERT TO authenticated
WITH CHECK (
  is_admin_user_safe()
  OR (
    is_operator_user_safe()
    AND is_operator_assigned_to_service(service_id)
    AND EXISTS (
      SELECT 1 FROM operators o
      WHERE o.id = inspections.operator_id
        AND o.user_id = (SELECT auth.uid())
    )
  )
);
