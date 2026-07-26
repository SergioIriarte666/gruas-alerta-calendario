-- El cierre automático de detenciones pasa al SERVIDOR.
--
-- Prueba en terreno del 25/07: detención "descanso" abierta 21:11 y puntos con
-- velocidad sostenida (16→25→27→80→92→92→86→70 km/h) entre 21:24:42 y 21:27:07
-- —2,5 min sobre el umbral— con la detención todavía abierta. El evaluador
-- vivía en el cliente y dependía del estado de la UI, que en ese momento decía
-- "sin transmitir" mientras un watcher huérfano seguía subiendo puntos.
--
-- La regla ahora se evalúa sobre los PUNTOS, que son el hecho, y no sobre lo
-- que la app cree de sí misma. El evaluador del cliente queda como espejo
-- optimista de la UI; la verdad la escribe el servidor.

BEGIN;

-- ── 1. Un punto nunca alimenta una sesión cerrada por el barrido ────────────
/**
 * El barrido de zombies cierra sesiones a los 10 min sin puntos. Si después
 * llega un punto FRESCO de esa sesión (cola offline que se vacía al recuperar
 * señal, app que revive), la sesión estaba viva y el cierre fue un falso
 * positivo: se reabre. Solo aplica a 'timeout' — un corte manual, un cambio de
 * servicio o el cierre del servicio son decisiones, no fallos de detección, y
 * jamás deben resucitar por un punto rezagado.
 */
CREATE OR REPLACE FUNCTION public.reactivate_session_on_fresh_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.recorded_at < now() - interval '10 minutes' THEN
    RETURN NULL;
  END IF;

  UPDATE public.operator_location_sessions
  SET status = 'active', ended_at = NULL, ended_reason = NULL
  WHERE id = NEW.session_id
    AND status = 'stopped'
    AND ended_reason = 'timeout';

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.reactivate_session_on_fresh_point() IS
  'Reabre una sesión cerrada por el barrido (ended_reason=timeout) cuando llega un punto reciente: el cierre fue un falso positivo. Nunca reabre cortes manuales ni cierres de servicio.';

DROP TRIGGER IF EXISTS trg_reactivate_session_on_fresh_point ON public.operator_location_points;
CREATE TRIGGER trg_reactivate_session_on_fresh_point
  AFTER INSERT ON public.operator_location_points
  FOR EACH ROW EXECUTE FUNCTION public.reactivate_session_on_fresh_point();

REVOKE ALL ON FUNCTION public.reactivate_session_on_fresh_point() FROM PUBLIC, anon, authenticated;

-- ── 2. Cierre automático de detenciones por velocidad sostenida ─────────────
/**
 * Umbrales: decisión operativa de terreno (hay faenas con límite de 15 km/h).
 * No "corregirlos" hacia arriba. Mismos valores que la ronda 1 en el cliente
 * (src/utils/sustainedMovement.ts).
 *
 * Criterio: la detención se cierra cuando la RACHA de movimiento que termina en
 * el punto recién insertado cubre al menos AUTO_RESUME_SUSTAIN_SECONDS. La
 * racha arranca justo después del último punto lento (o del inicio de la
 * detención, si no hubo ninguno). Un punto sin velocidad —incluido el latido
 * sin movimiento— cuenta como lento y reinicia la racha: la ausencia de dato
 * jamás debe leerse como "va rodando".
 */
CREATE OR REPLACE FUNCTION public.auto_close_stop_event_on_sustained_speed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  auto_resume_speed_kmh      constant numeric := 10;
  auto_resume_sustain_seconds constant integer := 60;
  v_speed_mps       constant numeric := auto_resume_speed_kmh / 3.6;
  v_stop_id         uuid;
  v_stop_started_at timestamptz;
  v_run_started_at  timestamptz;
  v_moving_points   integer;
BEGIN
  IF NEW.service_id IS NULL OR COALESCE(NEW.speed_mps, -1) <= v_speed_mps THEN
    RETURN NULL;
  END IF;

  SELECT e.id, e.started_at
  INTO v_stop_id, v_stop_started_at
  FROM public.service_stop_events e
  WHERE e.service_id = NEW.service_id
    AND e.ended_at IS NULL
  LIMIT 1;

  IF v_stop_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Último punto lento desde que se abrió la detención: ahí empieza la racha.
  SELECT max(p.recorded_at)
  INTO v_run_started_at
  FROM public.operator_location_points p
  WHERE p.service_id = NEW.service_id
    AND p.recorded_at >= v_stop_started_at
    AND p.recorded_at < NEW.recorded_at
    AND COALESCE(p.speed_mps, -1) <= v_speed_mps;

  v_run_started_at := COALESCE(v_run_started_at, v_stop_started_at);

  IF EXTRACT(EPOCH FROM (NEW.recorded_at - v_run_started_at)) < auto_resume_sustain_seconds THEN
    RETURN NULL;
  END IF;

  -- Al menos dos puntos abarcando la ventana: un único fix rápido (rebote de
  -- GPS) no puede cerrar una detención declarada por el operador.
  SELECT count(*)
  INTO v_moving_points
  FROM public.operator_location_points p
  WHERE p.service_id = NEW.service_id
    AND p.recorded_at > v_run_started_at
    AND p.recorded_at <= NEW.recorded_at
    AND COALESCE(p.speed_mps, -1) > v_speed_mps;

  IF v_moving_points < 2 THEN
    RETURN NULL;
  END IF;

  UPDATE public.service_stop_events
  SET ended_at = now(), ended_by_source = 'auto_speed'
  WHERE id = v_stop_id
    AND ended_at IS NULL;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.auto_close_stop_event_on_sustained_speed() IS
  'Cierra la detención abierta del servicio cuando los puntos muestran >10 km/h sostenidos 60 s. Vive en el servidor a propósito: el evaluador del cliente dependía del estado de la app y no corrió en la prueba del 25/07.';

DROP TRIGGER IF EXISTS trg_auto_close_stop_event_on_sustained_speed ON public.operator_location_points;
CREATE TRIGGER trg_auto_close_stop_event_on_sustained_speed
  AFTER INSERT ON public.operator_location_points
  FOR EACH ROW EXECUTE FUNCTION public.auto_close_stop_event_on_sustained_speed();

REVOKE ALL ON FUNCTION public.auto_close_stop_event_on_sustained_speed() FROM PUBLIC, anon, authenticated;

COMMIT;
