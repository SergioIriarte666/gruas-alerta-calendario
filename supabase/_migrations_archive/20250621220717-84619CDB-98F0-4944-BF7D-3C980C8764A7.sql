-- Fix: Add client_id to profiles table
-- This column was intended in a previous migration but was incorrectly implemented.
-- It links a user profile to a client record, essential for the client portal.

ALTER TABLE public.profiles
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.client_id IS 'Links the user profile to a client record for portal access.';
