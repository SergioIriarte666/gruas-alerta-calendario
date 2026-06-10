
-- 1. Add user_id to operators table to link them to auth users
-- This allows us to associate a system user with an operator record.
ALTER TABLE public.operators
ADD COLUMN user_id UUID UNIQUE,
ADD CONSTRAINT fk_operators_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.operators.user_id IS 'Link to the user profile for app access.';


-- 2. Create a helper function to get operator_id from a user_id
-- This will be used in RLS policies to find which operator an user is.
CREATE OR REPLACE FUNCTION public.get_operator_id_by_user(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM public.operators WHERE user_id = p_user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- 3. Refine RLS for the 'services' table to enforce data segregation
-- First, remove the old policy that allows any authenticated user to see all services.
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
DROP POLICY IF EXISTS "Admins and operators can manage services" ON public.services;

-- Create a new policy for viewing services based on user role.
-- Admins/viewers can see all services. Operators can only see services assigned to them.
CREATE POLICY "Users can view services based on role" ON public.services
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Create a new policy for managing services.
-- Admins can manage all. Operators can only manage their own.
CREATE POLICY "Users can manage services based on role" ON public.services
  FOR ALL
  USING (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );


-- 4. Refine RLS for the 'operators' table
-- Remove old permissive policies.
DROP POLICY IF EXISTS "Authenticated users can view operators" ON public.operators;
DROP POLICY IF EXISTS "Admins and operators can manage operators" ON public.operators;

-- Create new policy for viewing operator data.
-- Admins/viewers see all. Operators see only their own record.
CREATE POLICY "Users can view operators based on role" ON public.operators
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND user_id = auth.uid())
  );

-- Create new policy for managing operator data.
-- Admins manage all. Operators only manage their own record.
CREATE POLICY "Users can manage operators based on role" ON public.operators
  FOR ALL
  USING (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND user_id = auth.uid())
  );
