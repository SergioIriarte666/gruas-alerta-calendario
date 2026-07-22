BEGIN;

-- Paradas intermedias de un servicio multidestino (ej: Taxi Base G5N ->
-- Vallenar -> Mantos de Oro -> Copiapo, cobrado como UN servicio con UN link
-- de seguimiento). El edge function service-tracking calcula el ETA hacia la
-- PROXIMA parada no alcanzada y marca reached_at por geofence (300 m).
CREATE TABLE IF NOT EXISTS public.service_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  stop_order integer NOT NULL,
  label text NOT NULL,                -- ej: "Recogida Vallenar"
  address text,
  lat double precision,
  lng double precision,
  stop_type text NOT NULL DEFAULT 'waypoint'
    CHECK (stop_type IN ('pickup','dropoff','waypoint','final')),
  reached_at timestamptz,             -- seteado por el edge function (geofence)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_service_stops_service
  ON public.service_stops(service_id, stop_order);

ALTER TABLE public.service_stops ENABLE ROW LEVEL SECURITY;

-- Policies espejo de services: SELECT para authenticated, escritura para
-- admin. SIN policies anon: el acceso publico es exclusivamente via el edge
-- function service-tracking con service role.
DROP POLICY IF EXISTS service_stops_select_auth ON public.service_stops;
CREATE POLICY service_stops_select_auth
  ON public.service_stops FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS service_stops_admin_write ON public.service_stops;
CREATE POLICY service_stops_admin_write
  ON public.service_stops TO authenticated
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_stops TO authenticated;
GRANT ALL ON public.service_stops TO service_role;

-- Cache de ETA pasa a ser por parada objetivo: si la parada objetivo cambia,
-- el cache anterior (eta_seconds/eta_polyline) es invalido aunque siga fresco.
ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS eta_target_stop_id uuid
    REFERENCES public.service_stops(id) ON DELETE SET NULL;

COMMIT;
