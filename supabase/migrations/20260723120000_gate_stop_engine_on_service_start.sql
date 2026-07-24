BEGIN;

-- Bug SRV-6853 (23/07): el motor de paradas multidestino operaba desde que
-- existían link + paradas, aunque el operador NO hubiera pulsado "Iniciar
-- Servicio". El móvil hizo durante la mañana un tramo AJENO al servicio y:
--   · la guía pública ruteaba hacia la parada 1 ("devuélvase"), y
--   · este trigger armaba (armed_at) las paradas con ese tramo previo, dejando
--     el geofence listo para marcar reached_at con un viaje que no era el del
--     servicio.
--
-- El criterio de "servicio iniciado" es el ESTADO del servicio, no armed_at:
-- armed_at se setea por distancia GPS (>1 km) y el tramo previo lo habría
-- activado igual. `pending` = asignado pero no iniciado.
--
-- Espejo exacto de STARTED_STATUSES en supabase/functions/service-tracking.
-- Los puntos GPS se siguen insertando y asociando al servicio igual que antes:
-- este trigger solo decide si el punto ARMA o MARCA paradas; el historial
-- pre-inicio se conserva intacto.
CREATE OR REPLACE FUNCTION public.mark_reached_service_stops()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_id uuid;
  v_stop record;
BEGIN
  BEGIN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT service_id INTO v_service_id
    FROM public.operator_location_sessions
    WHERE id = NEW.session_id;

    IF v_service_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Solo servicios INICIADOS. Antes incluía 'pending' (ver comentario de
    -- cabecera): un servicio asignado pero no iniciado ya no arma ni marca.
    IF NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE id = v_service_id
        AND status IN ('in_progress', 'inspection_completed')
    ) THEN
      RETURN NEW;
    END IF;

    -- Armado (sticky): el móvil estuvo a más de 1 km de la parada pendiente.
    UPDATE public.service_stops s
    SET armed_at = now()
    WHERE s.service_id = v_service_id
      AND s.reached_at IS NULL
      AND s.armed_at IS NULL
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND public.service_stops_distance_meters(NEW.latitude, NEW.longitude, s.lat, s.lng) > 1000;

    -- Marcado en orden con catch-up: varias paradas pueden caer en el mismo
    -- radio; se corta en la primera que no cumple (armada + <300 m).
    FOR v_stop IN
      SELECT id, lat, lng, armed_at
      FROM public.service_stops
      WHERE service_id = v_service_id
        AND reached_at IS NULL
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      ORDER BY stop_order
    LOOP
      IF v_stop.armed_at IS NOT NULL
        AND public.service_stops_distance_meters(NEW.latitude, NEW.longitude, v_stop.lat, v_stop.lng) < 300
      THEN
        UPDATE public.service_stops SET reached_at = now() WHERE id = v_stop.id;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_reached_service_stops() TO service_role;

COMMIT;
