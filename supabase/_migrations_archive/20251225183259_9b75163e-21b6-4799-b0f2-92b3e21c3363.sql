-- Fix PUBLIC_DATA_EXPOSURE: Remove the overly permissive profiles policy
-- The existing policies (profiles_select_own, profiles_select_admin, etc.) provide proper access control
-- We just need to drop the vulnerable "select all" policy
DROP POLICY IF EXISTS "profiles_select_basic_info_all_users" ON public.profiles;