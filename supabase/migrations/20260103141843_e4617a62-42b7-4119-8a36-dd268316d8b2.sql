-- Add insured_name column to services table for tracking insurance clients' customers
ALTER TABLE public.services ADD COLUMN insured_name text;