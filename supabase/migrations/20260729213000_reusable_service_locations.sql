-- Todo origen/destino confirmado pasa a ser reutilizable. El catálogo ayuda
-- a seleccionar un punto; el servicio conserva siempre su propio snapshot.

BEGIN;

ALTER TABLE public.saved_locations
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saved_locations.coordinate_locked IS
  'Cuando es true, un servicio no puede usar este nombre/alias con coordenadas alejadas.';

CREATE OR REPLACE FUNCTION public.normalize_service_location_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT regexp_replace(
    translate(
      lower(btrim(coalesce(p_text, ''))),
      'áéíóúüñàèìòùäëïöâêîôû',
      'aeiouunaeiouaeioaeiou'
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.service_location_distance_m(
  p_lat_a double precision,
  p_lng_a double precision,
  p_lat_b double precision,
  p_lng_b double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 6371000.0 * 2.0 * asin(
    least(
      1.0,
      sqrt(
        power(sin(radians(p_lat_b - p_lat_a) / 2.0), 2) +
        cos(radians(p_lat_a)) * cos(radians(p_lat_b)) *
        power(sin(radians(p_lng_b - p_lng_a) / 2.0), 2)
      )
    )
  );
$$;

-- Los puntos verificados de la empresa y de Salfa no admiten que el mismo
-- nombre/alias se combine accidentalmente con coordenadas de otro lugar.
UPDATE public.saved_locations
SET coordinate_locked = true
WHERE public.normalize_service_location_text(name) IN (
    'gruas 5 norte',
    'salfa freire'
  )
  OR EXISTS (
    SELECT 1
    FROM unnest(coalesce(aliases, '{}'::text[])) alias
    WHERE public.normalize_service_location_text(alias) IN (
      'custodia g5n',
      'instalaciones g5n',
      'gruas 5 norte',
      'salfa freire'
    )
  );

CREATE OR REPLACE FUNCTION public.assert_location_matches_locked_catalog(
  p_label text,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match_name text;
  v_distance_m double precision;
BEGIN
  IF NULLIF(btrim(p_label), '') IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    RETURN;
  END IF;

  SELECT location.name,
         public.service_location_distance_m(
           p_lat,
           p_lng,
           location.latitude::double precision,
           location.longitude::double precision
         )
  INTO v_match_name, v_distance_m
  FROM public.saved_locations location
  WHERE location.is_active
    AND location.coordinate_locked
    AND (
      public.normalize_service_location_text(location.name) =
        public.normalize_service_location_text(p_label)
      OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(location.aliases, '{}'::text[])) alias
        WHERE public.normalize_service_location_text(alias) =
          public.normalize_service_location_text(p_label)
      )
    )
  ORDER BY public.service_location_distance_m(
    p_lat,
    p_lng,
    location.latitude::double precision,
    location.longitude::double precision
  )
  LIMIT 1;

  IF FOUND AND v_distance_m > 500 THEN
    RAISE EXCEPTION
      'La ubicación "%" no coincide con el punto verificado "%" (distancia: % km)',
      p_label,
      v_match_name,
      round((v_distance_m / 1000.0)::numeric, 1)
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_location_matches_locked_catalog(
  text, double precision, double precision
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_location_matches_locked_catalog(
  text, double precision, double precision
) TO service_role;

-- Registra un uso sin cambiar jamás el snapshot del servicio ni mover las
-- coordenadas curadas del catálogo. Un texto nuevo cerca de un punto conocido
-- se convierte en alias; un punto realmente nuevo crea una entrada.
CREATE OR REPLACE FUNCTION public.record_confirmed_service_location(
  p_label text,
  p_lat double precision,
  p_lng double precision,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_location_id uuid;
  v_location_name text;
BEGIN
  IF NULLIF(btrim(p_label), '') IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    RETURN NULL;
  END IF;

  -- Primero, la misma etiqueta en el mismo sector. Después, cualquier punto
  -- físicamente equivalente (150 m) para aprender el nuevo texto como alias.
  SELECT location.id, location.name
  INTO v_location_id, v_location_name
  FROM public.saved_locations location
  WHERE location.is_active
    AND public.service_location_distance_m(
      p_lat,
      p_lng,
      location.latitude::double precision,
      location.longitude::double precision
    ) <= 150
  ORDER BY
    CASE
      WHEN public.normalize_service_location_text(location.name) =
             public.normalize_service_location_text(p_label)
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(location.aliases, '{}'::text[])) alias
          WHERE public.normalize_service_location_text(alias) =
            public.normalize_service_location_text(p_label)
        )
      THEN 0
      ELSE 1
    END,
    location.coordinate_locked DESC,
    public.service_location_distance_m(
      p_lat,
      p_lng,
      location.latitude::double precision,
      location.longitude::double precision
    )
  LIMIT 1;

  IF v_location_id IS NOT NULL THEN
    UPDATE public.saved_locations
    SET
      usage_count = usage_count + 1,
      aliases = CASE
        WHEN public.normalize_service_location_text(p_label) <>
             public.normalize_service_location_text(v_location_name)
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(coalesce(aliases, '{}'::text[])) alias
            WHERE public.normalize_service_location_text(alias) =
              public.normalize_service_location_text(p_label)
          )
        THEN array_append(coalesce(aliases, '{}'::text[]), btrim(p_label))
        ELSE coalesce(aliases, '{}'::text[])
      END,
      updated_at = now()
    WHERE id = v_location_id;

    RETURN v_location_id;
  END IF;

  INSERT INTO public.saved_locations (
    name,
    latitude,
    longitude,
    category,
    usage_count,
    is_active,
    created_by
  )
  VALUES (
    btrim(p_label),
    p_lat,
    p_lng,
    'recurrente',
    1,
    true,
    p_created_by
  )
  RETURNING id INTO v_location_id;

  RETURN v_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_confirmed_service_location(
  text, double precision, double precision, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_service_recurrent_locations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_confirmed_service_location(
      NEW.origin,
      NEW.origin_lat,
      NEW.origin_lng,
      NEW.created_by
    );
    PERFORM public.record_confirmed_service_location(
      NEW.destination,
      NEW.destination_lat,
      NEW.destination_lng,
      NEW.created_by
    );
  ELSE
    IF NEW.origin IS DISTINCT FROM OLD.origin
       OR NEW.origin_lat IS DISTINCT FROM OLD.origin_lat
       OR NEW.origin_lng IS DISTINCT FROM OLD.origin_lng THEN
      PERFORM public.record_confirmed_service_location(
        NEW.origin,
        NEW.origin_lat,
        NEW.origin_lng,
        NEW.created_by
      );
    END IF;

    IF NEW.destination IS DISTINCT FROM OLD.destination
       OR NEW.destination_lat IS DISTINCT FROM OLD.destination_lat
       OR NEW.destination_lng IS DISTINCT FROM OLD.destination_lng THEN
      PERFORM public.record_confirmed_service_location(
        NEW.destination,
        NEW.destination_lat,
        NEW.destination_lng,
        NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_service_recurrent_locations_trigger
  ON public.services;
CREATE TRIGGER capture_service_recurrent_locations_trigger
AFTER INSERT OR UPDATE OF
  origin, origin_lat, origin_lng,
  destination, destination_lat, destination_lng
ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.capture_service_recurrent_locations();

-- Extiende la protección ya instalada para que los nombres curados tampoco
-- puedan terminar apuntando a otro lugar dentro de Chile.
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

  PERFORM public.assert_location_matches_locked_catalog(
    v_service.origin,
    v_service.origin_lat,
    v_service.origin_lng
  );
  PERFORM public.assert_location_matches_locked_catalog(
    v_service.destination,
    v_service.destination_lat,
    v_service.destination_lng
  );
END;
$$;

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

  PERFORM public.assert_location_matches_locked_catalog(
    NEW.origin,
    NEW.origin_lat,
    NEW.origin_lng
  );
  PERFORM public.assert_location_matches_locked_catalog(
    NEW.destination,
    NEW.destination_lat,
    NEW.destination_lng
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.service_tracking_links link
      WHERE link.service_id = NEW.id
        AND link.revoked_at IS NULL
        AND link.expires_at > now()
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

COMMIT;
