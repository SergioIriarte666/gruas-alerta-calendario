-- Fix operator role detection used by RLS policies.
-- Currently public.is_operator_user_safe() only checks public.user_roles, but operator users are stored in public.profiles.role.
-- This causes embedded clients to return null for operators due to RLS.

CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'operator'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'operator'
  );
$$;