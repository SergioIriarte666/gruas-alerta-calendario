-- Description: Simplifies and corrects client-related RLS policies.
-- This migration removes the dependency on the `get_client_id_for_user` function
-- by embedding the logic directly into the policies. It ensures clients can
-- only read their own data and create service requests for themselves.

-- Step 1: Drop the old, problematic policies and the unused helper function.
-- It's safe to ignore errors if they don't exist.

-- Policies on 'services' table
DROP POLICY IF EXISTS "Allow client to create their own service requests" ON public.services;
DROP POLICY IF EXISTS "Allow client to read their own services" ON public.services;

-- Policies on 'invoices' table
DROP POLICY IF EXISTS "Allow client to read their own invoices" ON public.invoices;

-- The no-longer-needed helper function
DROP FUNCTION IF EXISTS get_client_id_for_user(user_id UUID);


-- Step 2: Recreate the policies with simplified and direct logic.

-- Policy for creating services: Clients can only create services for themselves.
CREATE POLICY "Allow client to create their own service requests"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT client_id FROM public.profiles WHERE id = auth.uid()) = client_id
);

-- Policy for reading services: Clients can only see their own services.
CREATE POLICY "Allow client to read their own services"
ON public.services
FOR SELECT
TO authenticated
USING (
  (SELECT client_id FROM public.profiles WHERE id = auth.uid()) = client_id
);

-- Policy for reading invoices: Clients can see invoices related to their services.
CREATE POLICY "Allow client to read their own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.closures c
    JOIN public.closure_services cs ON c.id = cs.closure_id
    JOIN public.services s ON cs.service_id = s.id
    WHERE c.id = public.invoices.closure_id
      AND s.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);


