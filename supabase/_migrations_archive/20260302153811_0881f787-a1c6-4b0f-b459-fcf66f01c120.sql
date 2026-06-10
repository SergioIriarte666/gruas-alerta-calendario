
DROP POLICY IF EXISTS "trip_estimates_auth_only" ON public.trip_estimates;

CREATE POLICY "trip_estimates_auth_only"
ON public.trip_estimates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
