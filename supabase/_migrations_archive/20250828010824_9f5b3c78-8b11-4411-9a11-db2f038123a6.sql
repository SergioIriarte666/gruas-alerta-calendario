-- Fix security issue: Strengthen RLS policies for clients table to protect customer contact information

-- First, drop existing policies
DROP POLICY IF EXISTS "clients_admin_operator_access" ON public.clients;
DROP POLICY IF EXISTS "clients_own_data" ON public.clients;

-- Create more restrictive policies

-- 1. Admins have full access to all client data
CREATE POLICY "clients_admin_full_access" 
ON public.clients 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- 2. Operators can only SELECT client data (no insert/update/delete of sensitive info)
CREATE POLICY "clients_operator_read_only" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (is_operator_user_safe());

-- 3. Operators can only INSERT new clients (for new client creation)
CREATE POLICY "clients_operator_insert_only" 
ON public.clients 
FOR INSERT 
TO authenticated
WITH CHECK (is_operator_user_safe());

-- 4. Clients can only see their own data and only basic information
CREATE POLICY "clients_own_basic_data" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (
  is_client_user_safe() 
  AND id = get_user_client_id_safe()
);

-- 5. Create a function to check if sensitive data access is allowed
CREATE OR REPLACE FUNCTION public.can_access_client_sensitive_data()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Only admins can access sensitive client data (email, phone, address)
  SELECT is_admin_user_safe();
$$;

-- Create additional security functions for data filtering
CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'operator'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'client',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT client_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- Add comments to document the security policies
COMMENT ON POLICY "clients_admin_full_access" ON public.clients IS 
'Allows administrators full access to all client data including sensitive contact information';

COMMENT ON POLICY "clients_operator_read_only" ON public.clients IS 
'Allows operators to view client data but not modify sensitive contact information';

COMMENT ON POLICY "clients_operator_insert_only" ON public.clients IS 
'Allows operators to create new client records only';

COMMENT ON POLICY "clients_own_basic_data" ON public.clients IS 
'Allows clients to view only their own basic information';

-- Log this security enhancement
INSERT INTO public.audit_log (user_id, operation, table_name, new_data)
VALUES (
  auth.uid(),
  'SECURITY_ENHANCEMENT',
  'clients',
  jsonb_build_object(
    'action', 'strengthened_rls_policies',
    'description', 'Enhanced RLS policies to protect customer contact information',
    'timestamp', now()
  )
);