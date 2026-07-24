-- Map Matching cache: una geometría matcheada (pegada a calles) por sesión de
-- rastreo cerrada. Fase visual: no toca service_route_metrics ni el cómputo de
-- métricas. Escritura exclusiva de la edge function mapbox-proxy (service role);
-- el cliente solo lee. Ver acción map_matching en supabase/functions/mapbox-proxy.
BEGIN;

CREATE TABLE IF NOT EXISTS public.matched_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE
    REFERENCES public.operator_location_sessions(id) ON DELETE CASCADE,
  segments jsonb NOT NULL,          -- [{geometry: GeoJSON LineString, confidence: numeric, matched: boolean}]
  avg_confidence numeric,
  points_input integer,             -- puntos recibidos
  points_used integer,              -- puntos tras filtrado
  api_requests integer,             -- chunks llamados a Mapbox
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matched_routes ENABLE ROW LEVEL SECURITY;

-- SELECT: mismo criterio que operator_location_sessions.
-- Operadores leen las rutas de sus propias sesiones.
DROP POLICY IF EXISTS "Operators read own matched routes" ON public.matched_routes;
CREATE POLICY "Operators read own matched routes"
  ON public.matched_routes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operator_location_sessions s
      JOIN public.operators o ON o.id = s.operator_id
      WHERE s.id = matched_routes.session_id
        AND o.user_id = auth.uid()
    )
  );

-- Admin y viewer leen todas (paridad con "Admins read all location sessions").
DROP POLICY IF EXISTS "Admins read all matched routes" ON public.matched_routes;
CREATE POLICY "Admins read all matched routes"
  ON public.matched_routes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Viewers read all matched routes" ON public.matched_routes;
CREATE POLICY "Viewers read all matched routes"
  ON public.matched_routes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

-- INSERT/UPDATE/DELETE: nadie desde el cliente. Sin policies para esas
-- operaciones, solo el service role (que ignora RLS) escribe vía edge function.

GRANT SELECT ON public.matched_routes TO authenticated;

COMMIT;
