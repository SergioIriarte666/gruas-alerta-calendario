-- 1. Add user_id to clients table to link them to auth users
ALTER TABLE public.clients
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX ON public.clients (user_id) WHERE user_id IS NOT NULL;

-- 2. Add client_id to profiles table for reverse mapping
ALTER TABLE public.profiles
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Enable RLS on services and invoices
-- Note: The actual policies are now created in a later migration file
-- to ensure they are defined correctly without problematic helper functions.
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

