-- Vinculación de sesiones de telemetría: reconocer a TODO operador asignado,
-- y fallar fuerte en vez de anular en silencio.
--
-- enforce_principal_operator_service_binding solo aceptaba a
-- services.operator_id. Cualquier otra sesión salía con
-- `NEW.service_id := NULL`: el UPDATE "funcionaba", nadie veía un error, y la
-- telemetría quedaba huérfana. Así se perdieron 1.476 puntos GPS del 08-08 en
-- 3 sesiones de Sergio Iriarte, que condujo un servicio cuyo operador
-- principal es Jesús Rojas.
--
-- En la operación real un servicio lo puede conducir un operador distinto al
-- del folio, y el sistema ya lo sabe por dos vías: service_resources
-- (multi-operador) y service_operator_handoffs (relevo en terreno).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_principal_operator_service_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio text;
  v_operator_name text;
BEGIN
  IF NEW.service_id IS NULL OR NEW.operator_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Operador principal del folio.
  IF EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = NEW.service_id AND s.operator_id = NEW.operator_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Operador asignado al servicio (multi-operador).
  IF EXISTS (
    SELECT 1 FROM public.service_resources sr
    WHERE sr.service_id = NEW.service_id
      AND sr.operator_id = NEW.operator_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Parte de un relevo registrado, entrante o saliente. Se acepta el
  --    traspaso aunque siga pendiente de confirmar: el que va manejando ya
  --    está transmitiendo, y perder esos puntos es justo lo que se corrige.
  IF EXISTS (
    SELECT 1 FROM public.service_operator_handoffs h
    WHERE h.service_id = NEW.service_id
      AND NEW.operator_id IN (h.incoming_operator_id, h.outgoing_operator_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.folio INTO v_folio FROM public.services s WHERE s.id = NEW.service_id;
  SELECT o.name INTO v_operator_name FROM public.operators o WHERE o.id = NEW.operator_id;

  -- Antes esto era `NEW.service_id := NULL`. Un rechazo silencioso deja al
  -- operador transmitiendo a la nada durante horas sin que nadie se entere.
  RAISE EXCEPTION
    'operator_service_binding_rejected: el operador % (%) no está asignado al servicio % (%). No es el operador principal, no figura en service_resources y no participa de ningún traspaso registrado.',
    COALESCE(v_operator_name, 'desconocido'),
    NEW.operator_id,
    COALESCE(v_folio, 'sin folio'),
    NEW.service_id
    USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.enforce_principal_operator_service_binding() IS
  'Acepta la sesión si el operador es el principal, está en service_resources o participa de un traspaso. Si no, RAISE: nunca anula service_id en silencio.';

GRANT EXECUTE ON FUNCTION public.enforce_principal_operator_service_binding() TO authenticated;

-- =========================================================================
-- Reparación de la telemetría del 08-08 (SRV-6887)
-- =========================================================================
-- Sergio Iriarte condujo el servicio; el folio queda a nombre de Jesús Rojas.
-- NO se toca services.operator_id ni la comisión: commission_amount = 0 e
-- is_primary = false, verificado en ensayo con ROLLBACK que sync_service_commissions
-- no genera ninguna fila nueva en costs.

INSERT INTO public.service_resources (
  service_id, operator_id, resource_type, commission_amount, is_primary, role
)
SELECT
  '46a740f7-5fda-4690-af5d-1b87192a5c89'::uuid,
  'fd13ec43-7da5-4da9-a06c-c8648e817d1a'::uuid,
  'operator',
  0,
  false,
  'Apoyo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_resources
  WHERE service_id = '46a740f7-5fda-4690-af5d-1b87192a5c89'
    AND operator_id = 'fd13ec43-7da5-4da9-a06c-c8648e817d1a'
);

-- El UPDATE pasa por el trigger recién reemplazado: es la prueba en vivo de
-- que la vía service_resources ahora vincula.
UPDATE public.operator_location_sessions
SET service_id = '46a740f7-5fda-4690-af5d-1b87192a5c89',
    updated_at = now()
WHERE id IN (
  '6fcbc85b-3eef-4145-8194-c0d2d183729a',
  'a749f72d-4049-4dfa-8e8e-a88d0a700779',
  '05ceaea5-e90b-4bdb-9fd8-e665b14413f6'
)
  AND service_id IS NULL;

COMMIT;
