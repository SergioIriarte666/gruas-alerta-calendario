-- Escritura del punto de GPS: una sola operación, y un reloj que no retrocede.
--
-- Hasta ahora el cliente hacía dos escrituras sueltas: el UPSERT del punto y un
-- UPDATE de `operator_location_sessions.last_point_at`. Dos problemas reales:
--
-- 1. NO ES ATÓMICO. Si la segunda falla —o la app muere entre ambas— el punto
--    queda guardado y la sesión dice que no llegó nada. El barrido de zombies
--    lee `last_point_at`, así que una sesión perfectamente viva se cierra por
--    "timeout" a los 10 minutos con puntos entrando.
--
-- 2. `last_point_at` PODÍA RETROCEDER. La cola offline sube puntos viejos, y
--    tras un relevo pueden llegar de dos teléfonos. Un lote atrasado dejaba la
--    sesión "reportando" una hora antes de lo real, que es justo lo que el
--    watchdog del Fix 9 mira para decidir si la transmisión se cayó.
--
-- La RPC hace las dos escrituras en la misma transacción y sube `last_point_at`
-- solo hacia adelante, con GREATEST. Un punto atrasado se guarda —es historia
-- legítima— pero no le miente al reloj de la sesión.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_operator_location_point(
  p_session_id uuid,
  p_operator_id uuid,
  p_user_id uuid,
  p_service_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_speed_mps double precision,
  p_heading_degrees double precision,
  p_altitude_meters double precision,
  p_recorded_at timestamptz,
  p_is_offline_sync boolean DEFAULT false,
  p_source text DEFAULT 'mobile_app',
  p_platform text DEFAULT 'ios'
)
RETURNS void
LANGUAGE plpgsql
-- SECURITY INVOKER: las RLS de operator_location_points y de las sesiones
-- siguen aplicando exactamente igual que con el INSERT directo. Esta RPC agrupa
-- dos escrituras, no otorga permisos.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.operator_location_points (
    session_id, operator_id, user_id, service_id,
    latitude, longitude, accuracy_meters, speed_mps,
    heading_degrees, altitude_meters, recorded_at,
    is_offline_sync, source, platform
  ) VALUES (
    p_session_id, p_operator_id, p_user_id, p_service_id,
    p_latitude, p_longitude, p_accuracy_meters, p_speed_mps,
    p_heading_degrees, p_altitude_meters, p_recorded_at,
    COALESCE(p_is_offline_sync, false),
    COALESCE(p_source, 'mobile_app'),
    COALESCE(p_platform, 'ios')
  )
  -- Mismo destino de conflicto que usaba el cliente: reintentar la subida de un
  -- punto ya guardado tiene que ser inofensivo, porque la cola lo hace.
  ON CONFLICT (operator_id, recorded_at, latitude, longitude) DO NOTHING;

  UPDATE public.operator_location_sessions
  SET last_point_at = GREATEST(COALESCE(last_point_at, p_recorded_at), p_recorded_at)
  WHERE id = p_session_id;
END;
$$;

COMMENT ON FUNCTION public.record_operator_location_point IS
  'Guarda un punto de GPS y adelanta last_point_at de la sesión en la MISMA transacción. last_point_at nunca retrocede (GREATEST): un lote offline atrasado es historia válida, pero no puede mover el reloj que el watchdog usa para decidir si la transmisión se cayó.';

REVOKE ALL ON FUNCTION public.record_operator_location_point FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_operator_location_point TO authenticated, service_role;

-- ── Una sola sesión activa por operador ────────────────────────────────────
--
-- `ensureOperatorLocationSession` consulta "¿hay activa?" y crea si no. Dos
-- llamadas simultáneas —el arranque y el tick de 30 s, o dos montajes— pueden
-- responder "no" a la vez y abrir dos sesiones para el mismo operador. Con dos
-- sesiones vivas, el tercer fallback de `service-tracking` ("última sesión del
-- servicio") elige una y los puntos de la otra desaparecen del recorrido.
--
-- El índice lo vuelve imposible en la base. Verificado antes de crearlo: hoy no
-- hay ningún operador con más de una sesión activa, así que no rompe nada.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_operator_location_sessions_active
  ON public.operator_location_sessions (operator_id)
  WHERE status = 'active' AND ended_at IS NULL;

COMMIT;
