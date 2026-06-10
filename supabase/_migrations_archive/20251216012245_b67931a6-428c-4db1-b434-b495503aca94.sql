-- Fix RLS policy for service_resources to allow INSERT operations
-- The current policy only has USING clause, missing WITH CHECK for INSERT

-- 1. Drop the existing policy
DROP POLICY IF EXISTS "service_resources_auth_only" ON service_resources;

-- 2. Create complete policy with both USING and WITH CHECK
CREATE POLICY "service_resources_auth_only" ON service_resources
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);