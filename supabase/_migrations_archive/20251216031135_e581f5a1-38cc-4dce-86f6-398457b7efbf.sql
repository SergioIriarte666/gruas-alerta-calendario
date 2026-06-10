-- Drop the sync_missing_commissions function
-- Commissions should ONLY be created when a service is completed via trigger

DROP FUNCTION IF EXISTS public.sync_missing_commissions();