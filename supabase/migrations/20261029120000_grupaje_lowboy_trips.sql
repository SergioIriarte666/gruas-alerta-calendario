-- Viajes multi-vehículo (Grupaje Lowboy).
--
-- Un viaje es un servicio PADRE (datos operativos, costos, comisión del
-- operador) con un servicio HIJO por patente (valor, N° O.C., N° siniestro,
-- cliente). Mutual exige una factura por vehículo, así que el ingreso vive en
-- los hijos y el padre lleva value = 0: los reportes que suman services.value
-- no duplican. Los costos cargados al padre se prorratean a los hijos
-- ponderado por el valor de cada vehículo (vista trip_cost_allocations).
--
-- NO se reutiliza related_service_id / service_relationship_type: son del
-- feature de excedentes (CHECK main/excess + prevent_excess_of_excess).
--
-- El viaje puede ser multicliente (2 Mutual + 1 Auxilia): el cliente es dato
-- del hijo. El padre toma el client_id del primer vehículo solo porque la
-- columna es NOT NULL; jamás entra a cierres ni facturas.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Esquema
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS trip_parent_id uuid NULL
    REFERENCES public.services(id) ON DELETE RESTRICT;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_trip_parent boolean NOT NULL DEFAULT false;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS incident_number text NULL;

COMMENT ON COLUMN public.services.trip_parent_id IS
  'Servicio padre (viaje) cuando este servicio es un vehículo de un viaje multi-vehículo. ON DELETE RESTRICT: primero se eliminan los hijos.';
COMMENT ON COLUMN public.services.is_trip_parent IS
  'true = servicio "viaje" de Grupaje Lowboy: lleva datos operativos, costos y comisión; value = 0 (el ingreso vive en los hijos).';
COMMENT ON COLUMN public.services.incident_number IS
  'N° de siniestro del vehículo (aseguradoras). Por vehículo, no por viaje.';

CREATE INDEX IF NOT EXISTS idx_services_trip_parent_id
  ON public.services(trip_parent_id)
  WHERE trip_parent_id IS NOT NULL;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS chk_trip_parent_not_child;
ALTER TABLE public.services
  ADD CONSTRAINT chk_trip_parent_not_child
  CHECK (NOT (is_trip_parent AND trip_parent_id IS NOT NULL));

-- El referenciado tiene que ser un padre real. No se exige mismo cliente: el
-- viaje es multicliente por diseño.
CREATE OR REPLACE FUNCTION public.validate_trip_parent_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_is_trip boolean;
BEGIN
  IF NEW.trip_parent_id IS NOT NULL THEN
    IF NEW.trip_parent_id = NEW.id THEN
      RAISE EXCEPTION 'Un servicio no puede ser su propio viaje padre'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT is_trip_parent INTO v_parent_is_trip
    FROM public.services
    WHERE id = NEW.trip_parent_id;

    IF v_parent_is_trip IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'trip_parent_id % no es un servicio viaje (is_trip_parent = true)', NEW.trip_parent_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Un padre con hijos no deja de ser padre: se desvinculan los hijos primero.
  IF TG_OP = 'UPDATE' AND OLD.is_trip_parent AND NOT NEW.is_trip_parent THEN
    IF EXISTS (SELECT 1 FROM public.services WHERE trip_parent_id = NEW.id) THEN
      RAISE EXCEPTION 'El viaje % tiene vehículos asociados: desvincúlalos antes de quitarle is_trip_parent', NEW.folio
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trip_parent_link ON public.services;
CREATE TRIGGER trg_validate_trip_parent_link
  BEFORE INSERT OR UPDATE OF trip_parent_id, is_trip_parent ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_parent_link();

-- Flag del tipo de servicio (mismo patrón que *_required / vehicle_info_optional).
ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS supports_multi_vehicle boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.service_types.supports_multi_vehicle IS
  'true = el formulario crea 1 servicio viaje + N servicios hijo (uno por patente) vía create_trip_service.';

UPDATE public.service_types
SET supports_multi_vehicle = true
WHERE id = '59505e51-566a-406b-929f-9d23caed95ac'
  AND supports_multi_vehicle = false;

-- ---------------------------------------------------------------------------
-- 2. Vista de prorrateo: ÚNICA fuente de verdad del reparto de costos.
--    weight = valor del hijo / valor del viaje. El redondeo cuadra exacto: el
--    hijo de mayor valor (desempate por folio) absorbe la diferencia.
--    Si todos los hijos valen 0 (viaje sin cotizar) se reparte en partes
--    iguales para que los costos nunca queden sin dueño.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.trip_cost_allocations;
CREATE VIEW public.trip_cost_allocations
WITH (security_invoker = true)
AS
WITH children AS (
  SELECT
    c.id              AS child_id,
    c.folio           AS child_folio,
    c.trip_parent_id  AS parent_id,
    c.client_id       AS child_client_id,
    c.license_plate   AS child_license_plate,
    c.status::text    AS child_status,
    COALESCE(c.value, 0)::numeric AS child_value
  FROM public.services c
  WHERE c.trip_parent_id IS NOT NULL
),
trip AS (
  SELECT
    parent_id,
    SUM(child_value)                 AS trip_value,
    COUNT(*)::int                    AS vehicle_count,
    COUNT(DISTINCT child_client_id)::int AS client_count
  FROM children
  GROUP BY parent_id
),
parent_costs AS (
  SELECT k.service_id AS parent_id, COALESCE(SUM(k.amount), 0)::numeric AS parent_costs
  FROM public.costs k
  JOIN trip t ON t.parent_id = k.service_id
  GROUP BY k.service_id
),
weighted AS (
  SELECT
    ch.*,
    p.folio AS parent_folio,
    t.trip_value,
    t.vehicle_count,
    t.client_count,
    COALESCE(pc.parent_costs, 0) AS parent_costs,
    CASE
      WHEN t.trip_value > 0 THEN ch.child_value / t.trip_value
      ELSE 1::numeric / t.vehicle_count
    END AS weight,
    ROW_NUMBER() OVER (
      PARTITION BY ch.parent_id
      ORDER BY ch.child_value DESC, ch.child_folio ASC
    ) AS rn
  FROM children ch
  JOIN trip t ON t.parent_id = ch.parent_id
  JOIN public.services p ON p.id = ch.parent_id
  LEFT JOIN parent_costs pc ON pc.parent_id = ch.parent_id
),
rounded AS (
  SELECT
    w.*,
    ROUND(w.weight * w.parent_costs) AS raw_allocated,
    SUM(ROUND(w.weight * w.parent_costs)) OVER (PARTITION BY w.parent_id) AS raw_sum
  FROM weighted w
)
SELECT
  parent_id,
  parent_folio,
  child_id,
  child_folio,
  child_client_id,
  child_license_plate,
  child_status,
  child_value,
  trip_value,
  vehicle_count,
  client_count,
  weight,
  parent_costs,
  CASE WHEN rn = 1 THEN raw_allocated + (parent_costs - raw_sum) ELSE raw_allocated END AS allocated_amount
FROM rounded;

COMMENT ON VIEW public.trip_cost_allocations IS
  'Prorrateo de los costos del servicio viaje (padre) a cada vehículo (hijo), ponderado por valor. SUM(allocated_amount) por padre = parent_costs exacto.';

GRANT SELECT ON public.trip_cost_allocations TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC transaccional de creación. SECURITY INVOKER: aplican las RLS de
--    services. Las service_resources (operador + comisión del viaje) y los
--    costos "Gastos de Servicios" los crea el frontend contra el PADRE por el
--    flujo existente; así sync_service_commissions genera la comisión solo
--    para el padre (los hijos no tienen resource con commission_amount > 0).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_trip_service(p_parent jsonb, p_vehicles jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_id     uuid;
  v_parent_folio  text;
  v_parent_client uuid;
  v_vehicle       jsonb;
  v_child_id      uuid;
  v_child_folio   text;
  v_child_client  uuid;
  v_plate         text;
  v_po            text;
  v_children      jsonb := '[]'::jsonb;
  v_status        text;
  v_service_type  uuid;
BEGIN
  IF p_vehicles IS NULL OR jsonb_typeof(p_vehicles) <> 'array' OR jsonb_array_length(p_vehicles) < 1 THEN
    RAISE EXCEPTION 'Un viaje necesita al menos un vehículo'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_service_type := NULLIF(p_parent->>'service_type_id', '')::uuid;
  IF v_service_type IS NULL THEN
    RAISE EXCEPTION 'service_type_id es obligatorio'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.service_types WHERE id = v_service_type AND supports_multi_vehicle) THEN
    RAISE EXCEPTION 'El tipo de servicio no admite viajes multi-vehículo'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Validación previa de todos los vehículos antes de escribir nada.
  FOR v_vehicle IN SELECT * FROM jsonb_array_elements(p_vehicles) LOOP
    IF NULLIF(trim(v_vehicle->>'client_id'), '') IS NULL THEN
      RAISE EXCEPTION 'Cada vehículo del viaje debe indicar su cliente'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NULLIF(trim(v_vehicle->>'license_plate'), '') IS NULL THEN
      RAISE EXCEPTION 'Cada vehículo del viaje debe tener patente'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_child_folio := NULLIF(trim(v_vehicle->>'folio'), '');
    IF v_child_folio IS NOT NULL AND EXISTS (SELECT 1 FROM public.services WHERE folio = v_child_folio) THEN
      RAISE EXCEPTION 'Ya existe un servicio con el folio %', v_child_folio
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;

  -- El padre toma el cliente del primer vehículo (client_id es NOT NULL).
  v_parent_client := COALESCE(
    NULLIF(p_parent->>'client_id', '')::uuid,
    (p_vehicles->0->>'client_id')::uuid
  );
  v_parent_folio := public.next_service_folio();

  INSERT INTO public.services (
    folio, is_trip_parent, trip_parent_id, value,
    client_id, service_type_id,
    request_date, service_date, start_time, end_time,
    origin, origin_lat, origin_lng, origin_location_source,
    destination, destination_lat, destination_lng, destination_location_source,
    crane_id, operator_id, operator_commission,
    status, observations, contact_person, contact_phone,
    license_plate, vehicle_brand, vehicle_model,
    created_by
  ) VALUES (
    v_parent_folio, true, NULL, 0,
    v_parent_client, v_service_type,
    NULLIF(p_parent->>'request_date', '')::date,
    NULLIF(p_parent->>'service_date', '')::date,
    NULLIF(p_parent->>'start_time', '')::time,
    NULLIF(p_parent->>'end_time', '')::time,
    NULLIF(p_parent->>'origin', ''),
    NULLIF(p_parent->>'origin_lat', '')::double precision,
    NULLIF(p_parent->>'origin_lng', '')::double precision,
    NULLIF(p_parent->>'origin_location_source', ''),
    NULLIF(p_parent->>'destination', ''),
    NULLIF(p_parent->>'destination_lat', '')::double precision,
    NULLIF(p_parent->>'destination_lng', '')::double precision,
    NULLIF(p_parent->>'destination_location_source', ''),
    NULLIF(p_parent->>'crane_id', '')::uuid,
    NULLIF(p_parent->>'operator_id', '')::uuid,
    COALESCE(NULLIF(p_parent->>'operator_commission', '')::numeric, 0),
    COALESCE(NULLIF(p_parent->>'status', ''), 'pending')::public.service_status,
    NULLIF(p_parent->>'observations', ''),
    NULLIF(p_parent->>'contact_person', ''),
    NULLIF(p_parent->>'contact_phone', ''),
    NULL, NULL, NULL,
    auth.uid()
  )
  RETURNING id INTO v_parent_id;

  FOR v_vehicle IN SELECT * FROM jsonb_array_elements(p_vehicles) LOOP
    v_child_client := (v_vehicle->>'client_id')::uuid;
    v_plate := upper(trim(v_vehicle->>'license_plate'));
    v_po := NULLIF(trim(v_vehicle->>'purchase_order'), '');
    v_child_folio := COALESCE(NULLIF(trim(v_vehicle->>'folio'), ''), public.next_service_folio());
    v_status := CASE WHEN v_po IS NOT NULL THEN 'with_purchase_order' ELSE 'quoted' END;

    INSERT INTO public.services (
      folio, is_trip_parent, trip_parent_id, value,
      client_id, service_type_id,
      request_date, service_date, start_time, end_time,
      origin, origin_lat, origin_lng, origin_location_source,
      destination, destination_lat, destination_lng, destination_location_source,
      crane_id, operator_id, operator_commission,
      status, observations, contact_person, contact_phone,
      license_plate, vehicle_brand, vehicle_model,
      purchase_order, incident_number,
      created_by
    ) VALUES (
      v_child_folio, false, v_parent_id,
      COALESCE(NULLIF(v_vehicle->>'value', '')::numeric, 0),
      v_child_client, v_service_type,
      NULLIF(p_parent->>'request_date', '')::date,
      NULLIF(p_parent->>'service_date', '')::date,
      NULLIF(p_parent->>'start_time', '')::time,
      NULLIF(p_parent->>'end_time', '')::time,
      NULLIF(p_parent->>'origin', ''),
      NULLIF(p_parent->>'origin_lat', '')::double precision,
      NULLIF(p_parent->>'origin_lng', '')::double precision,
      NULLIF(p_parent->>'origin_location_source', ''),
      NULLIF(p_parent->>'destination', ''),
      NULLIF(p_parent->>'destination_lat', '')::double precision,
      NULLIF(p_parent->>'destination_lng', '')::double precision,
      NULLIF(p_parent->>'destination_location_source', ''),
      NULLIF(p_parent->>'crane_id', '')::uuid,
      NULLIF(p_parent->>'operator_id', '')::uuid,
      0,
      v_status::public.service_status,
      NULLIF(p_parent->>'observations', ''),
      NULLIF(p_parent->>'contact_person', ''),
      NULLIF(p_parent->>'contact_phone', ''),
      v_plate,
      NULLIF(trim(v_vehicle->>'vehicle_brand'), ''),
      NULLIF(trim(v_vehicle->>'vehicle_model'), ''),
      v_po,
      NULLIF(trim(v_vehicle->>'incident_number'), ''),
      auth.uid()
    )
    RETURNING id INTO v_child_id;

    v_children := v_children || jsonb_build_object(
      'id', v_child_id,
      'folio', v_child_folio,
      'license_plate', v_plate,
      'client_id', v_child_client
    );
  END LOOP;

  RETURN jsonb_build_object(
    'parent_id', v_parent_id,
    'parent_folio', v_parent_folio,
    'children', v_children
  );
END;
$$;

COMMENT ON FUNCTION public.create_trip_service(jsonb, jsonb) IS
  'Crea un servicio viaje (padre, value 0) + un hijo por vehículo en una transacción. Folio del hijo opcional (N° de asistencia del cliente); si no viene, next_service_folio().';

REVOKE ALL ON FUNCTION public.create_trip_service(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_trip_service(jsonb, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Migración de datos: SRV-7105 / SRV-7106 / SRV-7107 son un mismo viaje
--    (Mutual de Seguridad, 30-10-2026, Copiapó → Santiago, grúa DSBZ-85).
--    Idempotente. No se tocan estados ni valores de los 3 hijos.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_src       public.services%ROWTYPE;
  v_parent_id uuid;
  c_obs CONSTANT text := 'Viaje Grupaje Lowboy — agrupa SRV-7105, SRV-7106, SRV-7107';
BEGIN
  SELECT * INTO v_src FROM public.services WHERE folio = 'SRV-7105';
  IF NOT FOUND THEN
    RAISE NOTICE 'SRV-7105 no existe: se omite la migración de datos del viaje';
    RETURN;
  END IF;

  SELECT id INTO v_parent_id
  FROM public.services
  WHERE is_trip_parent AND observations = c_obs
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    INSERT INTO public.services (
      folio, is_trip_parent, trip_parent_id, value,
      client_id, service_type_id,
      request_date, service_date,
      origin, origin_lat, origin_lng, origin_location_source,
      destination, destination_lat, destination_lng, destination_location_source,
      crane_id, operator_id, operator_commission,
      status, observations, created_by
    ) VALUES (
      public.next_service_folio(), true, NULL, 0,
      v_src.client_id, v_src.service_type_id,
      v_src.request_date, v_src.service_date,
      v_src.origin, v_src.origin_lat, v_src.origin_lng, v_src.origin_location_source,
      v_src.destination, v_src.destination_lat, v_src.destination_lng, v_src.destination_location_source,
      v_src.crane_id, v_src.operator_id, 0,
      'pending', c_obs, v_src.created_by
    )
    RETURNING id INTO v_parent_id;

    -- El padre lleva el recurso del operador (comisión 0, como los hijos) para
    -- que el portal operador y el motor de comisiones lo vean igual que a un
    -- viaje creado desde el formulario.
    INSERT INTO public.service_resources (service_id, resource_type, operator_id, is_primary, commission_amount, role)
    SELECT v_parent_id, sr.resource_type, sr.operator_id, sr.is_primary, 0, sr.role
    FROM public.service_resources sr
    WHERE sr.service_id = v_src.id
      AND sr.resource_type = 'operator'
      AND NOT EXISTS (
        SELECT 1 FROM public.service_resources x
        WHERE x.service_id = v_parent_id AND x.operator_id = sr.operator_id
      );
  END IF;

  UPDATE public.services
  SET trip_parent_id = v_parent_id
  WHERE folio IN ('SRV-7105', 'SRV-7106', 'SRV-7107')
    AND trip_parent_id IS NULL;
END;
$$;

COMMIT;
