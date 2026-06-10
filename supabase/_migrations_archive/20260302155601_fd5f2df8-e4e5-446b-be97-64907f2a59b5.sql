CREATE TABLE public.saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_locations_auth_only"
ON public.saved_locations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);