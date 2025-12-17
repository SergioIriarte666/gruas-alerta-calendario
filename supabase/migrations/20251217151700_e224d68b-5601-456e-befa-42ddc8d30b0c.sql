-- Make origin column nullable in service_rates table
ALTER TABLE public.service_rates 
ALTER COLUMN origin DROP NOT NULL;