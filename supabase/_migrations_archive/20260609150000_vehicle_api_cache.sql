BEGIN;

CREATE TABLE IF NOT EXISTS public.vehicle_api_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint     text NOT NULL,
  lookup_value text NOT NULL,
  response     jsonb NOT NULL,
  created_at   timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  CONSTRAINT vehicle_api_cache_endpoint_value_key
    UNIQUE (endpoint, lookup_value)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_api_cache_lookup
  ON public.vehicle_api_cache (endpoint, lookup_value);
CREATE INDEX IF NOT EXISTS idx_vehicle_api_cache_expires
  ON public.vehicle_api_cache (expires_at);

ALTER TABLE public.vehicle_api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_cache"
  ON public.vehicle_api_cache FOR SELECT
  USING (auth.role() = 'authenticated');

COMMIT;
