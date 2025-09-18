-- Add third_party_client_id column to services table for excess service functionality
ALTER TABLE public.services 
ADD COLUMN third_party_client_id UUID REFERENCES public.clients(id);

-- Add index for better performance on third_party_client_id queries
CREATE INDEX idx_services_third_party_client_id ON public.services(third_party_client_id);

-- Add comment to document the column purpose
COMMENT ON COLUMN public.services.third_party_client_id IS 'Client ID for excess services - references the third party client who will be billed for the excess amount';