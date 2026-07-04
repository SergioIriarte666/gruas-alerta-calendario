BEGIN;

-- 1. Motivo de inicio/detención de sesiones de rastreo.
ALTER TABLE public.operator_location_sessions
  ADD COLUMN IF NOT EXISTS started_reason text NOT NULL DEFAULT 'manual';

ALTER TABLE public.operator_location_sessions
  ADD COLUMN IF NOT EXISTS ended_reason text NULL;

DO $$
BEGIN
  ALTER TABLE public.operator_location_sessions
    ADD CONSTRAINT operator_location_sessions_started_reason_check
    CHECK (started_reason IN ('manual', 'auto_schedule', 'auto_service'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.operator_location_sessions
    ADD CONSTRAINT operator_location_sessions_ended_reason_check
    CHECK (ended_reason IN ('manual', 'service_change', 'timeout', 'schedule_end'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Policies granulares: visibilidad de admin + integridad append-only de puntos.

DROP POLICY IF EXISTS "Operators manage own location sessions" ON public.operator_location_sessions;

DROP POLICY IF EXISTS "Operators insert own location sessions" ON public.operator_location_sessions;
CREATE POLICY "Operators insert own location sessions"
  ON public.operator_location_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_sessions.operator_id
        AND o.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Operators update own location sessions" ON public.operator_location_sessions;
CREATE POLICY "Operators update own location sessions"
  ON public.operator_location_sessions
  FOR UPDATE
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

DROP POLICY IF EXISTS "Operators read own location sessions" ON public.operator_location_sessions;
CREATE POLICY "Operators read own location sessions"
  ON public.operator_location_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_sessions.operator_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins read all location sessions" ON public.operator_location_sessions;
CREATE POLICY "Admins read all location sessions"
  ON public.operator_location_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Operators manage own location points" ON public.operator_location_points;

DROP POLICY IF EXISTS "Operators insert own location points" ON public.operator_location_points;
CREATE POLICY "Operators insert own location points"
  ON public.operator_location_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_points.operator_id
        AND o.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Operators read own location points" ON public.operator_location_points;
CREATE POLICY "Operators read own location points"
  ON public.operator_location_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_location_points.operator_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins read all location points" ON public.operator_location_points;
CREATE POLICY "Admins read all location points"
  ON public.operator_location_points
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Los puntos de rastreo son append-only: revocar UPDATE otorgado en la migración anterior.
REVOKE UPDATE ON public.operator_location_points FROM authenticated;

-- 3. Configuración de jornada de rastreo.
CREATE TABLE IF NOT EXISTS public.tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday_start time NOT NULL DEFAULT '08:30',
  weekday_end time NOT NULL DEFAULT '18:00',
  saturday_start time NOT NULL DEFAULT '08:30',
  saturday_end time NOT NULL DEFAULT '13:00',
  sunday_enabled boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 10,
  points_retention_days integer NOT NULL DEFAULT 180,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tracking_settings_updated_at ON public.tracking_settings;
CREATE TRIGGER trg_tracking_settings_updated_at
  BEFORE UPDATE ON public.tracking_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read tracking settings" ON public.tracking_settings;
CREATE POLICY "Authenticated read tracking settings"
  ON public.tracking_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins insert tracking settings" ON public.tracking_settings;
CREATE POLICY "Admins insert tracking settings"
  ON public.tracking_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update tracking settings" ON public.tracking_settings;
CREATE POLICY "Admins update tracking settings"
  ON public.tracking_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.tracking_settings TO authenticated;
GRANT INSERT, UPDATE ON public.tracking_settings TO authenticated;

INSERT INTO public.tracking_settings (weekday_start, weekday_end, saturday_start, saturday_end, sunday_enabled, session_timeout_minutes, points_retention_days)
SELECT '08:30', '18:00', '08:30', '13:00', false, 10, 180
WHERE NOT EXISTS (SELECT 1 FROM public.tracking_settings);

-- 4. Realtime.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_location_points;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_location_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Job de barrido de sesiones zombie (cada 5 minutos).
DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'operator-tracking-session-sweep'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'operator-tracking-session-sweep',
    '*/5 * * * *',
    $cron$
      UPDATE public.operator_location_sessions
      SET status = 'stopped', ended_at = now(), ended_reason = 'timeout'
      WHERE status = 'active'
        AND COALESCE(last_point_at, started_at)
            < now() - make_interval(mins => (SELECT session_timeout_minutes FROM public.tracking_settings LIMIT 1));
    $cron$
  );
END $$;

-- 6. Job de retención de puntos (diario 07:00 UTC = 04:00 Chile invierno).
DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'operator-tracking-points-retention'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'operator-tracking-points-retention',
    '0 7 * * *',
    $cron$
      DELETE FROM public.operator_location_points
      WHERE recorded_at < now() - make_interval(days => (SELECT points_retention_days FROM public.tracking_settings LIMIT 1));
    $cron$
  );
END $$;

COMMIT;
