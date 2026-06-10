-- Add occasional_client_name column to incomes table
ALTER TABLE public.incomes 
ADD COLUMN occasional_client_name TEXT;

COMMENT ON COLUMN public.incomes.occasional_client_name IS 'Nombre del cliente ocasional que no requiere registro en el sistema';