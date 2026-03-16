-- Add SELECT access for viewer role (they had access via the old permissive policy)
CREATE POLICY "services_viewer_read_access" ON services
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'viewer'::app_role
  )
);