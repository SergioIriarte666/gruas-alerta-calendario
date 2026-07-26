-- Precisión del cierre automático: la racha se mide desde el PRIMER punto en
-- movimiento, no desde el último punto lento.
--
-- La versión de 20260726000000 medía la ventana contra el último punto lento, y
-- ahí cabe todo el hueco entre ese punto y el primero rápido: con un fix lento a
-- las 21:00 y dos rápidos a las 21:02 y 21:02:30, la "racha" parecía de 90 s
-- cuando el movimiento real llevaba 30. La validación sintética lo detectó.
--
-- Regla final, la del acuerdo operativo: al menos DOS puntos, todos sobre 10
-- km/h, abarcando 60 s o más. Cualquier punto lento o sin velocidad en el medio
-- reinicia la racha.

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_close_stop_event_on_sustained_speed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  auto_resume_speed_kmh       constant numeric := 10;
  auto_resume_sustain_seconds constant integer := 60;
  v_speed_mps        constant numeric := auto_resume_speed_kmh / 3.6;
  v_stop_id          uuid;
  v_stop_started_at  timestamptz;
  v_last_slow_at     timestamptz;
  v_first_moving_at  timestamptz;
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

  -- Último punto lento (o sin velocidad: un latido sin movimiento cuenta como
  -- lento, la ausencia de dato jamás se lee como "va rodando") desde que se
  -- abrió la detención. Todo lo anterior a él no pertenece a la racha.
  SELECT max(p.recorded_at)
  INTO v_last_slow_at
  FROM public.operator_location_points p
  WHERE p.service_id = NEW.service_id
    AND p.recorded_at >= v_stop_started_at
    AND p.recorded_at < NEW.recorded_at
    AND COALESCE(p.speed_mps, -1) <= v_speed_mps;

  -- Primer punto EN MOVIMIENTO de la racha vigente: ahí empieza a contar.
  SELECT min(p.recorded_at)
  INTO v_first_moving_at
  FROM public.operator_location_points p
  WHERE p.service_id = NEW.service_id
    AND p.recorded_at >= v_stop_started_at
    AND p.recorded_at < NEW.recorded_at
    AND p.recorded_at > COALESCE(v_last_slow_at, '-infinity'::timestamptz)
    AND COALESCE(p.speed_mps, -1) > v_speed_mps;

  -- Sin un punto rápido previo hay uno solo (el recién insertado): un rebote de
  -- GPS no puede cerrar una detención declarada por el operador.
  IF v_first_moving_at IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXTRACT(EPOCH FROM (NEW.recorded_at - v_first_moving_at)) < auto_resume_sustain_seconds THEN
    RETURN NULL;
  END IF;

  UPDATE public.service_stop_events
  SET ended_at = now(), ended_by_source = 'auto_speed'
  WHERE id = v_stop_id
    AND ended_at IS NULL;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_close_stop_event_on_sustained_speed() FROM PUBLIC, anon, authenticated;

COMMIT;
