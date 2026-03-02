CREATE TABLE public.trip_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_name TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC,
  estimated_time_hours NUMERIC,
  crane_type TEXT,
  vehicle_config TEXT DEFAULT '1_vehicle',
  fuel_cost NUMERIC DEFAULT 0,
  toll_cost NUMERIC DEFAULT 0,
  additional_costs NUMERIC DEFAULT 0,
  total_estimate NUMERIC DEFAULT 0,
  calculation_details JSONB,
  service_id UUID REFERENCES public.services(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_estimates_auth_only" ON public.trip_estimates
  AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);