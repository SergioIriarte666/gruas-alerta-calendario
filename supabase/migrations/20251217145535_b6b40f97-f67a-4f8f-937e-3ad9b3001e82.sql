-- Create service_rates table for predefined service values by client and route
CREATE TABLE public.service_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
  origin TEXT NOT NULL,
  destination TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create indexes for efficient lookups
CREATE INDEX idx_service_rates_client_id ON public.service_rates(client_id);
CREATE INDEX idx_service_rates_origin ON public.service_rates(origin);
CREATE INDEX idx_service_rates_client_origin ON public.service_rates(client_id, origin);
CREATE INDEX idx_service_rates_active ON public.service_rates(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.service_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view service rates"
ON public.service_rates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert service rates"
ON public.service_rates
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update service rates"
ON public.service_rates
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete service rates"
ON public.service_rates
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_service_rates_updated_at
BEFORE UPDATE ON public.service_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();