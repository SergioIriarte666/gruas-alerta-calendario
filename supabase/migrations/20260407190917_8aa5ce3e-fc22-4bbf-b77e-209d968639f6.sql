
-- 1. Fix profiles INSERT policy: force role to 'viewer' on insert
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_insert_own_safe"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'viewer'::app_role);

-- 2. Fix get_current_user_role_safe() to not default to 'viewer'
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 3. Fix storage: replace broad ALL policy with scoped delete
DROP POLICY IF EXISTS "storage_authenticated_only" ON storage.objects;

-- Re-add as SELECT+INSERT only (not DELETE) for general authenticated access
CREATE POLICY "storage_authenticated_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "storage_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Admin-only delete for all buckets (except avatars which already has own policy)
CREATE POLICY "storage_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    is_admin_user_safe()
    OR (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  );
