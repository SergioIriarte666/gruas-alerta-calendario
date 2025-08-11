-- Fix ambiguous function call error by removing duplicate create_invoice_transaction function
-- Keep only the two distinct functions: one for closures, one for services

-- Drop the conflicting function that uses jsonb (causing ambiguity with json version)
DROP FUNCTION IF EXISTS public.create_invoice_transaction(jsonb, uuid[]);

-- Verify we have only the correct two functions remaining:
-- 1. create_invoice_transaction(p_client_id uuid, p_closure_id uuid, ...) - For closures
-- 2. create_invoice_transaction(p_invoice_data json, p_service_ids uuid[]) - For services