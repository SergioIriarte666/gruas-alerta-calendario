-- Cinta de telemetría en vivo del panel del operador + tres reparaciones
-- estructurales detectadas en el servicio real 3266844-1 (31/07/2026).
--
--  1. get_service_live_progress: los mismos números que hoy sólo existen al
--     cerrar el servicio (service_route_metrics), pero EN VIVO y autorizados.
--  2. mark_on_site_from_point: el hito on_site deja de depender de que alguien
--     abra el link público.
--  3. reject_tracking_link_on_closed_service: no se crean links sobre
--     servicios ya cerrados.

BEGIN;

-- ---------------------------------------------------------------------------
-- Espejo SQL de STAGE_RANK (supabase/functions/_shared/journeyStage.ts).
--
-- El orden de las etapas es UNA sola regla y vive en ese módulo TS, que es el
-- que usa la edge function service-tracking. Aquí se espeja porque un trigger
-- de Postgres no puede importarlo. Si allá cambia el orden, cambia acá: los
-- dos motores (edge function y trigger) tienen que converger al mismo máximo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journey_stage_rank(p_stage text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_stage
    WHEN 'assigned'  THEN 0
    WHEN 'en_route'  THEN 1
    WHEN 'on_site'   THEN 2
    WHEN 'towing'    THEN 3
    WHEN 'last_leg'  THEN 4
    WHEN 'arrived'   THEN 5
    ELSE -1
  END;
$function$;

COMMENT ON FUNCTION public.journey_stage_rank(text) IS
  'Espejo de STAGE_RANK en supabase/functions/_shared/journeyStage.ts. La línea de tiempo del cliente sólo avanza: este rango es el que decide si un hito puede subir max_stage_reached.';

-- ---------------------------------------------------------------------------
-- 1. Progreso en vivo del servicio.
--
-- Reutiliza los umbrales de compute_service_route_metrics (mismo haversine de
-- 6371 km, mismo descarte de segmentos > 150 km/h, mismo gap de 5 min) para
-- que la cinta y la métrica de cierre no puedan contar historias distintas.
-- La única diferencia es la ventana: aquí termina en now(), no en el cierre.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_service_live_progress(p_service_id uuid)
RETURNS TABLE (
  distance_km numeric,
  elapsed_minutes integer,
  moving_minutes integer,
  stopped_minutes integer,
  avg_moving_kmh numeric,
  points_count integer,
  gaps_count integer,
  last_point_at timestamptz,
  last_speed_kmh numeric,
  eta_seconds integer,
  eta_distance_meters integer,
  eta_target_kind text,
  eta_cached_at timestamptz,
  open_stop_reason text,
  open_stop_started_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_authorized boolean;
  v_start_at timestamptz;
  v_end_at timestamptz := now();
  v_first_point_at timestamptz;
  v_points_count integer := 0;
  v_gaps_count integer := 0;
  v_distance_km numeric := 0;
  v_moving_minutes numeric := 0;
  v_elapsed_minutes integer := 0;
  v_moving_int integer := 0;
  v_stopped_int integer := 0;
  v_avg_moving numeric;
  v_last_point_at timestamptz;
  v_last_speed_kmh numeric;
  v_eta_seconds integer;
  v_eta_distance_meters integer;
  v_eta_target_kind text;
  v_eta_cached_at timestamptz;
  v_stop_reason text;
  v_stop_started_at timestamptz;
  rec record;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_at timestamptz;
  v_seg_km numeric;
  v_seg_minutes numeric;
  v_seg_speed_kmh numeric;
BEGIN
  -- SECURITY DEFINER: la autorización es lo primero que corre, siempre.
  --
  -- El operador que TRANSMITE puede no ser el asignado en `services`: el
  -- transbordo de camión a mitad de viaje (26/07) deja al entrante alimentando
  -- la sesión sin figurar todavía como operator_id. Tener sesión de este
  -- servicio es prueba suficiente de que la telemetría es suya.
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.services s
      JOIN public.operators o ON o.id = s.operator_id
      WHERE s.id = p_service_id AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.operator_location_sessions sess
      WHERE sess.service_id = p_service_id AND sess.user_id = auth.uid()
    )
  INTO v_authorized;

  IF NOT COALESCE(v_authorized, false) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), min(p.recorded_at)
  INTO v_points_count, v_first_point_at
  FROM public.operator_location_points p
  WHERE p.service_id = p_service_id;

  -- Inicio real: primera transición a in_progress (mismo criterio que
  -- compute_service_route_metrics). Fallback al primer punto.
  SELECT min(h.changed_at) INTO v_start_at
  FROM public.service_change_history h
  WHERE h.service_id = p_service_id
    AND h.field_name = 'status'
    AND h.new_value = 'in_progress';

  v_start_at := COALESCE(v_start_at, v_first_point_at);

  -- ETA vigente: se devuelve TAL CUAL (incluida su antigüedad). Quién decide
  -- si sirve es el front — un ETA de hace media hora no es "el ETA", es basura
  -- con formato de ETA, y esa decisión pertenece a quien lo pinta.
  SELECT l.eta_seconds, l.eta_distance_meters, l.eta_target_kind, l.eta_cached_at
  INTO v_eta_seconds, v_eta_distance_meters, v_eta_target_kind, v_eta_cached_at
  FROM public.service_tracking_links l
  WHERE l.service_id = p_service_id
    AND l.revoked_at IS NULL
  ORDER BY l.created_at DESC
  LIMIT 1;

  SELECT e.reason, e.started_at
  INTO v_stop_reason, v_stop_started_at
  FROM public.service_stop_events e
  WHERE e.service_id = p_service_id
    AND e.ended_at IS NULL
  ORDER BY e.started_at DESC
  LIMIT 1;

  -- Último punto conocido. `last_speed_kmh` es lo que permite distinguir
  -- "sin señal" de "estacionado": el plugin emite por filtro de DISTANCIA, así
  -- que un camión detenido deja de reportar (medido en el 3266844-1: 190 s
  -- promedio entre puntos detenido, hasta 26 min; 16 s en movimiento). Sin la
  -- velocidad del último punto, cualquier umbral por antigüedad marcaría como
  -- anomalía a una grúa correctamente estacionada en faena.
  SELECT p.recorded_at,
         CASE WHEN p.speed_mps IS NULL OR p.speed_mps < 0
              THEN NULL
              ELSE ROUND((p.speed_mps * 3.6)::numeric, 1)
         END
  INTO v_last_point_at, v_last_speed_kmh
  FROM public.operator_location_points p
  WHERE p.service_id = p_service_id
  ORDER BY p.recorded_at DESC
  LIMIT 1;

  IF v_start_at IS NOT NULL THEN
    SELECT count(*) INTO v_points_count
    FROM public.operator_location_points p
    WHERE p.service_id = p_service_id
      AND p.recorded_at >= v_start_at
      AND p.recorded_at <= v_end_at;

    v_elapsed_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end_at - v_start_at)) / 60.0))::integer;

    FOR rec IN
      SELECT p.latitude, p.longitude, p.recorded_at
      FROM public.operator_location_points p
      WHERE p.service_id = p_service_id
        AND p.recorded_at >= v_start_at
        AND p.recorded_at <= v_end_at
      ORDER BY p.recorded_at ASC
    LOOP
      IF v_prev_at IS NOT NULL THEN
        v_seg_minutes := EXTRACT(EPOCH FROM (rec.recorded_at - v_prev_at)) / 60.0;

        IF v_seg_minutes > 5 THEN
          v_gaps_count := v_gaps_count + 1;
        END IF;

        v_seg_km := 6371 * 2 * asin(sqrt(
          power(sin(radians(rec.latitude - v_prev_lat) / 2), 2) +
          cos(radians(v_prev_lat)) * cos(radians(rec.latitude)) *
          power(sin(radians(rec.longitude - v_prev_lng) / 2), 2)
        ));

        v_seg_speed_kmh := CASE WHEN v_seg_minutes > 0 THEN v_seg_km / (v_seg_minutes / 60.0) ELSE 0 END;

        -- Mismo filtro anti-ruido que compute_service_route_metrics: un salto
        -- por jitter GPS o reconexión no puede inflar el recorrido. Si no
        -- fuera el mismo umbral, la cinta y el cierre darían kilometrajes
        -- distintos para el mismo viaje.
        IF v_seg_speed_kmh <= 150 THEN
          v_distance_km := v_distance_km + v_seg_km;

          IF v_seg_speed_kmh >= 3 THEN
            v_moving_minutes := v_moving_minutes + v_seg_minutes;
          END IF;
        END IF;
      END IF;

      v_prev_lat := rec.latitude;
      v_prev_lng := rec.longitude;
      v_prev_at  := rec.recorded_at;
    END LOOP;
  END IF;

  v_moving_int  := GREATEST(0, ROUND(v_moving_minutes))::integer;
  v_stopped_int := GREATEST(0, v_elapsed_minutes - v_moving_int);

  IF v_moving_int > 0 THEN
    v_avg_moving := ROUND(v_distance_km / (v_moving_int / 60.0), 1);
  ELSE
    v_avg_moving := NULL;
  END IF;

  RETURN QUERY SELECT
    ROUND(v_distance_km, 1),
    v_elapsed_minutes,
    v_moving_int,
    v_stopped_int,
    v_avg_moving,
    COALESCE(v_points_count, 0),
    v_gaps_count,
    v_last_point_at,
    v_last_speed_kmh,
    v_eta_seconds,
    v_eta_distance_meters,
    v_eta_target_kind,
    v_eta_cached_at,
    v_stop_reason,
    v_stop_started_at;
END;
$function$;

COMMENT ON FUNCTION public.get_service_live_progress(uuid) IS
  'Telemetría en vivo del servicio para la cinta del panel del operador. Comparte umbrales con compute_service_route_metrics (haversine 6371 km, descarte de segmentos > 150 km/h, gap > 5 min) para que el número en vivo y el de cierre coincidan.';

REVOKE ALL ON FUNCTION public.get_service_live_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_service_live_progress(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Hito on_site independiente del link público.
--
-- El flujo multiparada ya tiene su trigger (trg_mark_reached_service_stops),
-- pero el flujo origen→destino evaluaba on_site SÓLO dentro de la edge
-- function service-tracking: es decir, sólo si alguien abría el link. Cuando
-- el cliente cierra la página, el hito nunca se graba, el servicio pasa a
-- inspection_completed, el piso de etapa salta a 'towing' y on_site_reached_at
-- queda NULL para siempre. compute_service_route_metrics no puede entonces
-- separar ida de traslado y marca low_confidence = true. Ya pasó dos veces en
-- producción.
--
-- Este trigger es DEFENSA ADICIONAL, no reemplazo: comparte los umbrales
-- (300 / 500 m) y el orden de etapas con la edge function, así que si corren
-- los dos convergen al mismo resultado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_on_site_from_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_service record;
  v_link record;
  v_distance_m double precision;
BEGIN
  BEGIN
    IF NEW.service_id IS NULL OR NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT s.status, s.origin_lat, s.origin_lng
    INTO v_service
    FROM public.services s
    WHERE s.id = NEW.service_id;

    IF NOT FOUND
       OR v_service.status NOT IN ('in_progress', 'inspection_completed')
       OR v_service.origin_lat IS NULL
       OR v_service.origin_lng IS NULL THEN
      RETURN NEW;
    END IF;

    -- El multidestino tiene su propio motor de hitos: los dos no pueden
    -- pisarse. Un servicio con paradas se rige por mark_reached_service_stops.
    IF EXISTS (SELECT 1 FROM public.service_stops st WHERE st.service_id = NEW.service_id) THEN
      RETURN NEW;
    END IF;

    SELECT l.id, l.on_site_reached_at, l.max_stage_reached
    INTO v_link
    FROM public.service_tracking_links l
    WHERE l.service_id = NEW.service_id
      AND l.revoked_at IS NULL
    ORDER BY l.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    v_distance_m := public.service_stops_distance_meters(
      NEW.latitude, NEW.longitude, v_service.origin_lat, v_service.origin_lng
    );

    -- SIEMPRE NEW.recorded_at, NUNCA now(): con el buffer offline un punto
    -- puede subirse minutos después de ser capturado y now() grabaría un hito
    -- falso. Por lo mismo el hito se corrige HACIA ATRÁS si llega un punto más
    -- antiguo que también califica: la llegada real es la primera, no la
    -- primera en subir.
    IF v_distance_m < 300
       AND (v_link.on_site_reached_at IS NULL OR NEW.recorded_at < v_link.on_site_reached_at) THEN
      UPDATE public.service_tracking_links
      SET on_site_reached_at = NEW.recorded_at,
          max_stage_reached = CASE
            WHEN public.journey_stage_rank(max_stage_reached) < public.journey_stage_rank('on_site')
              THEN 'on_site'
            ELSE max_stage_reached
          END
      WHERE id = v_link.id;

    ELSIF v_link.on_site_reached_at IS NOT NULL AND v_distance_m > 500 THEN
      -- Ya estuvo en el origen y ahora se aleja: va cargado. La etapa nunca
      -- baja, por eso el UPDATE está condicionado al rango persistido.
      UPDATE public.service_tracking_links
      SET max_stage_reached = 'towing'
      WHERE id = v_link.id
        AND public.journey_stage_rank(max_stage_reached) < public.journey_stage_rank('towing');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Un punto GPS jamás puede perderse por este trigger. El hito es
    -- informativo; la posición es el dato.
    NULL;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mark_on_site_from_point ON public.operator_location_points;
CREATE TRIGGER trg_mark_on_site_from_point
  AFTER INSERT ON public.operator_location_points
  FOR EACH ROW EXECUTE FUNCTION public.mark_on_site_from_point();

-- ---------------------------------------------------------------------------
-- 3. Guard anti link fantasma.
--
-- 31/07, 16:59:34: al cerrar el servicio la cascada revocó el link; 8 segundos
-- después se creó uno NUEVO sobre un servicio ya 'completed'. Token público
-- vivo, válido 7 días, jamás compartido. Es una carrera entre la revocación y
-- el código que reasegura la existencia del link (una pantalla todavía
-- montada). El guard de front ayuda, pero la carrera se gana en la base.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_tracking_link_on_closed_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT s.status INTO v_status
  FROM public.services s
  WHERE s.id = NEW.service_id;

  IF v_status IN ('completed', 'cancelled', 'failed', 'invoiced', 'partially_invoiced') THEN
    RAISE EXCEPTION 'No se puede crear un link de seguimiento sobre un servicio en estado final (%)', v_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reject_tracking_link_on_closed_service ON public.service_tracking_links;
CREATE TRIGGER trg_reject_tracking_link_on_closed_service
  BEFORE INSERT ON public.service_tracking_links
  FOR EACH ROW EXECUTE FUNCTION public.reject_tracking_link_on_closed_service();

-- Salida silenciosa antes de llegar al trigger: todas las vías de creación
-- (admin, operador, cliente, WhatsApp) pasan por aquí. Un servicio cerrado no
-- genera link nuevo y quien llamó recibe NULL, no una excepción — pedir el
-- link de un servicio que acaba de cerrar es una carrera normal, no un error.
CREATE OR REPLACE FUNCTION public.get_or_create_tracking_token(p_service_id uuid, p_created_by uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_existing_token text;
  v_token text;
  v_status text;
BEGIN
  -- Lo primero, antes incluso de validar coordenadas: un servicio cerrado no
  -- tiene seguimiento que entregar. Si quedara un link vivo sobre él es
  -- justamente el fantasma que este cambio persigue, así que tampoco se
  -- devuelve.
  SELECT s.status INTO v_status
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_status IN ('completed', 'cancelled', 'failed', 'invoiced', 'partially_invoiced') THEN
    RETURN NULL;
  END IF;

  PERFORM public.assert_tracking_service_coordinates(p_service_id);

  SELECT token INTO v_existing_token
  FROM public.service_tracking_links
  WHERE service_id = p_service_id
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN v_existing_token;
  END IF;

  LOOP
    v_token := substr(
      regexp_replace(encode(gen_random_bytes(16), 'base64'), '[^a-zA-Z0-9]', '', 'g'),
      1, 16
    );

    BEGIN
      INSERT INTO public.service_tracking_links (service_id, created_by, token)
      VALUES (p_service_id, p_created_by, v_token);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Colisión extremadamente improbable: generar otro token.
    END;
  END LOOP;

  RETURN v_token;
END;
$function$;

COMMIT;
