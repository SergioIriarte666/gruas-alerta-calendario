CREATE TABLE IF NOT EXISTS public.operator_location_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'mobile_app',
  platform text NOT NULL DEFAULT 'ios',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  last_point_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.operator_location_sessions(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_meters double precision NULL,
  speed_mps double precision NULL,
  heading_degrees double precision NULL,
  altitude_meters double precision NULL,
  recorded_at timestamptz NOT NULL,
  is_offline_sync boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'mobile_app',
  platform text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_location_sessions_operator_started_at
  ON public.operator_location_sessions(operator_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_location_sessions_service_started_at
  ON public.operator_location_sessions(service_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_location_points_operator_recorded_at
  ON public.operator_location_points(operator_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_location_points_service_recorded_at
  ON public.operator_location_points(service_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_location_points_session_recorded_at
  ON public.operator_location_points(session_id, recorded_at DESC);

DROP TRIGGER IF EXISTS trg_operator_location_sessions_updated_at ON public.operator_location_sessions;
CREATE TRIGGER trg_operator_location_sessions_updated_at
  BEFORE UPDATE ON public.operator_location_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.operator_location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_location_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage own location sessions" ON public.operator_location_sessions;
CREATE POLICY "Operators manage own location sessions"
  ON public.operator_location_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_sessions.operator_id
        AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_sessions.operator_id
        AND o.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Operators manage own location points" ON public.operator_location_points;
CREATE POLICY "Operators manage own location points"
  ON public.operator_location_points
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_points.operator_id
        AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_points.operator_id
        AND o.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.operator_location_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.operator_location_points TO authenticated;
