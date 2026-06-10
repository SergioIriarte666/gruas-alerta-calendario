-- Add optional excess functionality to services table
ALTER TABLE public.services 
ADD COLUMN has_excess boolean NOT NULL DEFAULT false,
ADD COLUMN client_covered_amount numeric,
ADD COLUMN excess_amount numeric;

-- Add comments for clarity
COMMENT ON COLUMN public.services.has_excess IS 'Indicates if service has excess amount paid by third party';
COMMENT ON COLUMN public.services.client_covered_amount IS 'Amount covered by client when has_excess is true';
COMMENT ON COLUMN public.services.excess_amount IS 'Excess amount paid by third party (calculated: value - client_covered_amount)';