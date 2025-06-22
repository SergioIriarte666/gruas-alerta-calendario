-- 1. Add user_id to clients table to link them to auth users
ALTER TABLE public.clients
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX ON public.clients (user_id) WHERE user_id IS NOT NULL;

-- 2. Add client_id to profiles table for reverse mapping
ALTER TABLE public.profiles
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Helper function to get the client_id for the currently authenticated user
CREATE OR REPLACE FUNCTION get_client_id_for_user(user_id UUID)
RETURNS UUID AS $$
DECLARE
  client_id_result UUID;
BEGIN
  SELECT client_id INTO client_id_result
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN client_id_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS on services and invoices
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for the client portal

-- Policy for services: Clients can only see their own services.
CREATE POLICY "Allow client to read their own services"
ON public.services
FOR SELECT
TO authenticated
USING (
  get_client_id_for_user(auth.uid()) = client_id
);

-- Policy for invoices: Clients can see invoices related to their services.
-- This is more complex as we need to check through closures.
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
      AND s.client_id = get_client_id_for_user(auth.uid())
  )
);

-- Allow full access for internal roles (assuming they are not tied to a client_id)
CREATE POLICY "Allow internal roles full access to services"
ON public.services
FOR ALL
TO authenticated
USING (get_client_id_for_user(auth.uid()) IS NULL)
WITH CHECK (get_client_id_for_user(auth.uid()) IS NULL);

CREATE POLICY "Allow internal roles full access to invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (get_client_id_for_user(auth.uid()) IS NULL)
WITH CHECK (get_client_id_for_user(auth.uid()) IS NULL);

