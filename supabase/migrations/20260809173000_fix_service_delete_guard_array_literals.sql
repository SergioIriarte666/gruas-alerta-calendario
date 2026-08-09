-- Corrige service_delete_block_reason / guard_service_delete: `text[] || 'literal'`
-- resolvia al operador anyarray||anyarray (el literal es de tipo unknown) y
-- reventaba con "malformed array literal" en cuanto el motivo era una constante
-- y no un format(). Se tipan los literales; la logica no cambia.

BEGIN;

CREATE OR REPLACE FUNCTION public.service_delete_block_reason(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_service.status::text IN ('in_progress', 'inspection_completed', 'completed', 'invoiced') THEN
    v_reasons := v_reasons || format('el servicio está en estado %s', v_service.status);
  END IF;

  IF v_service.journey_stage_reached IS NOT NULL THEN
    v_reasons := v_reasons || format('el traslado alcanzó la etapa "%s"', v_service.journey_stage_reached);
  END IF;

  IF v_service.on_site_reached_at IS NOT NULL THEN
    v_reasons := v_reasons || 'la grúa marcó llegada al lugar'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.inspections WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene inspección registrada'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_tracking_links WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene link de seguimiento emitido'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_route_metrics WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene métricas de ruta calculadas'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.operator_location_sessions WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene sesiones de transmisión GPS'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_stop_events WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene eventos de paradas del recorrido'::text;
  END IF;

  IF array_length(v_reasons, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN array_to_string(v_reasons, '; ');
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_service_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  IF OLD.status::text IN ('in_progress', 'inspection_completed', 'completed', 'invoiced') THEN
    v_reasons := v_reasons || format('el servicio está en estado %s', OLD.status);
  END IF;

  IF OLD.journey_stage_reached IS NOT NULL THEN
    v_reasons := v_reasons || format('el traslado alcanzó la etapa "%s"', OLD.journey_stage_reached);
  END IF;

  IF OLD.on_site_reached_at IS NOT NULL THEN
    v_reasons := v_reasons || 'la grúa marcó llegada al lugar'::text;
  END IF;

  -- Hijas que la cascada NO borra: siguen presentes en este punto.
  IF EXISTS (SELECT 1 FROM public.service_tracking_links WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene link de seguimiento emitido'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_route_metrics WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene métricas de ruta calculadas'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.operator_location_sessions WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene sesiones de transmisión GPS'::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_stop_events WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene eventos de paradas del recorrido'::text;
  END IF;

  IF array_length(v_reasons, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'service_delete_blocked: % . Anula el servicio en vez de eliminarlo.',
      array_to_string(v_reasons, '; ')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

GRANT EXECUTE ON FUNCTION public.service_delete_block_reason(uuid) TO authenticated;

COMMIT;
