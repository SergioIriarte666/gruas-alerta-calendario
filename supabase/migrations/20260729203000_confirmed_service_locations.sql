-- Las ubicaciones que ve un cliente son snapshots confirmados del servicio.
-- saved_locations y los geocoders sólo ayudan al usuario a elegir el punto:
-- nunca son una fuente dinámica para /track.

BEGIN;

CREATE OR REPLACE FUNCTION public.assert_tracking_service_coordinates(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service public.services%ROWTYPE;
BEGIN
  SELECT *
  INTO v_service
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado'
      USING ERRCODE = '23503';
  END IF;

  IF NULLIF(btrim(v_service.origin), '') IS NULL
     OR v_service.origin_lat IS NULL
     OR v_service.origin_lng IS NULL THEN
    RAISE EXCEPTION
      'Confirma el origen exacto del servicio antes de compartir el seguimiento'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(v_service.destination), '') IS NULL
     OR v_service.destination_lat IS NULL
     OR v_service.destination_lng IS NULL THEN
    RAISE EXCEPTION
      'Confirma el destino exacto del servicio antes de compartir el seguimiento'
      USING ERRCODE = '22023';
  END IF;

  IF v_service.origin_lat NOT BETWEEN -56.5 AND -17
     OR v_service.origin_lng NOT BETWEEN -76 AND -66
     OR v_service.destination_lat NOT BETWEEN -56.5 AND -17
     OR v_service.destination_lng NOT BETWEEN -76 AND -66 THEN
    RAISE EXCEPTION
      'Las coordenadas del servicio están fuera de Chile o tienen latitud/longitud invertidas'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_tracking_service_coordinates(uuid) IS
  'Impide publicar seguimiento sin snapshots confirmados y plausibles de origen y destino.';

REVOKE ALL ON FUNCTION public.assert_tracking_service_coordinates(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_tracking_service_coordinates(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.validate_service_location_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_active_link boolean;
BEGIN
  IF (NEW.origin_lat IS NULL) <> (NEW.origin_lng IS NULL) THEN
    RAISE EXCEPTION 'El origen debe guardar latitud y longitud juntas'
      USING ERRCODE = '22023';
  END IF;

  IF (NEW.destination_lat IS NULL) <> (NEW.destination_lng IS NULL) THEN
    RAISE EXCEPTION 'El destino debe guardar latitud y longitud juntas'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.origin_lat IS NOT NULL
     AND (NEW.origin_lat NOT BETWEEN -56.5 AND -17
          OR NEW.origin_lng NOT BETWEEN -76 AND -66) THEN
    RAISE EXCEPTION 'Coordenadas de origen fuera de Chile o invertidas'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.destination_lat IS NOT NULL
     AND (NEW.destination_lat NOT BETWEEN -56.5 AND -17
          OR NEW.destination_lng NOT BETWEEN -76 AND -66) THEN
    RAISE EXCEPTION 'Coordenadas de destino fuera de Chile o invertidas'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.service_tracking_links l
      WHERE l.service_id = NEW.id
        AND l.revoked_at IS NULL
        AND l.expires_at > now()
    )
    INTO v_has_active_link;

    IF v_has_active_link THEN
      IF NULLIF(btrim(NEW.origin), '') IS NULL
         OR NEW.origin_lat IS NULL
         OR NEW.origin_lng IS NULL
         OR NULLIF(btrim(NEW.destination), '') IS NULL
         OR NEW.destination_lat IS NULL
         OR NEW.destination_lng IS NULL THEN
        RAISE EXCEPTION
          'Un servicio con seguimiento compartido debe conservar origen y destino confirmados'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_service_location_snapshot_trigger
  ON public.services;
CREATE TRIGGER validate_service_location_snapshot_trigger
BEFORE INSERT OR UPDATE OF
  origin, origin_lat, origin_lng,
  destination, destination_lat, destination_lng
ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.validate_service_location_snapshot();

CREATE OR REPLACE FUNCTION public.invalidate_tracking_route_on_location_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.service_tracking_links
  SET eta_seconds = NULL,
      eta_distance_meters = NULL,
      eta_polyline = NULL,
      eta_cached_at = NULL,
      eta_target_stop_id = NULL,
      eta_target_kind = NULL,
      on_site_reached_at = CASE
        WHEN NEW.origin IS DISTINCT FROM OLD.origin
          OR NEW.origin_lat IS DISTINCT FROM OLD.origin_lat
          OR NEW.origin_lng IS DISTINCT FROM OLD.origin_lng
        THEN NULL
        ELSE on_site_reached_at
      END,
      max_stage_reached = CASE
        WHEN NEW.origin IS DISTINCT FROM OLD.origin
          OR NEW.origin_lat IS DISTINCT FROM OLD.origin_lat
          OR NEW.origin_lng IS DISTINCT FROM OLD.origin_lng
        THEN NULL
        ELSE max_stage_reached
      END
  WHERE service_id = NEW.id
    AND revoked_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invalidate_tracking_route_on_location_change_trigger
  ON public.services;
CREATE TRIGGER invalidate_tracking_route_on_location_change_trigger
AFTER UPDATE OF
  origin, origin_lat, origin_lng,
  destination, destination_lat, destination_lng
ON public.services
FOR EACH ROW
WHEN (
  OLD.origin IS DISTINCT FROM NEW.origin
  OR OLD.origin_lat IS DISTINCT FROM NEW.origin_lat
  OR OLD.origin_lng IS DISTINCT FROM NEW.origin_lng
  OR OLD.destination IS DISTINCT FROM NEW.destination
  OR OLD.destination_lat IS DISTINCT FROM NEW.destination_lat
  OR OLD.destination_lng IS DISTINCT FROM NEW.destination_lng
)
EXECUTE FUNCTION public.invalidate_tracking_route_on_location_change();

CREATE OR REPLACE FUNCTION public.validate_tracking_link_location_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_tracking_service_coordinates(NEW.service_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_tracking_link_location_snapshot_trigger
  ON public.service_tracking_links;
CREATE TRIGGER validate_tracking_link_location_snapshot_trigger
BEFORE INSERT ON public.service_tracking_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_tracking_link_location_snapshot();

-- Validar también antes de reutilizar un token vigente. Así no se puede
-- esquivar la defensa creando el link y borrando luego una coordenada.
CREATE OR REPLACE FUNCTION public.get_or_create_tracking_token(
  p_service_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_existing_token text;
  v_token text;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.get_or_create_tracking_token(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_tracking_token(uuid, uuid)
  TO service_role;

COMMIT;
