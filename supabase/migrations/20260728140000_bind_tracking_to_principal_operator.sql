-- La sesión de ubicación se amarra al servicio SOLO si quien transmite es el
-- operador PRINCIPAL.
--
-- Evidencia (28/07 14:23, folio 3262047-1): tras el relevo Sergio -> Jesús, el
-- teléfono de Sergio siguió abriendo sesiones 'auto_service' amarradas al
-- servicio y etiquetando puntos con su service_id. Sergio seguía "asignado" al
-- traslado —como Adicional en service_resources—, y esa es toda la validación
-- que había. La página del cliente terminó alternando entre el punto más fresco
-- de cada teléfono: la grúa saltaba 430 km entre el corte y Grúas 5 Norte.
-- Hubo que reparar a mano 55 puntos.
--
-- El criterio correcto no es "¿estás asignado?" sino "¿ES TUYO?".
-- is_operator_assigned_to_service() incluye a los adicionales a propósito —para
-- que vean el expediente y puedan operar— pero responder esa pregunta para
-- decidir de quién es la POSICIÓN del servicio mezcla dos cosas distintas: un
-- servicio tiene muchos operadores autorizados y UNA sola grúa transmitiendo.
--
-- Los adicionales conservan todo lo demás: lectura del expediente, inspección,
-- detenciones. Lo único que pierden es teñir la posición del servicio.
--
-- Por qué en la base y no solo en el cliente: la app del operador es Capacitor.
-- Un arreglo únicamente en el bundle exige publicar en las tiendas y convivir
-- con versiones viejas en terreno por tiempo indefinido. La base es el único
-- punto por el que pasan todos los teléfonos, nuevos y viejos.

BEGIN;

-- Degrada, no rechaza. Un RAISE dejaría al operador adicional SIN transmisión
-- —su ubicación es legítima, lo que no es legítimo es atribuirla al servicio—,
-- y un error en el envío de puntos en terreno es exactamente lo que no se puede
-- permitir. La sesión sigue viva, simplemente sin servicio: es lo mismo que se
-- hizo a mano el 28/07.
CREATE OR REPLACE FUNCTION public.enforce_principal_operator_service_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.service_id IS NULL OR NEW.operator_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = NEW.service_id
      AND s.operator_id = NEW.operator_id
  ) THEN
    NEW.service_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_principal_operator_service_binding() IS
  'Suelta del servicio las sesiones y puntos de quien no es el operador principal. Degrada a service_id NULL en vez de rechazar: la transmisión no puede caerse en terreno.';

DROP TRIGGER IF EXISTS bind_session_to_principal_operator ON public.operator_location_sessions;
CREATE TRIGGER bind_session_to_principal_operator
  BEFORE INSERT OR UPDATE OF service_id, operator_id ON public.operator_location_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_principal_operator_service_binding();

DROP TRIGGER IF EXISTS bind_point_to_principal_operator ON public.operator_location_points;
CREATE TRIGGER bind_point_to_principal_operator
  BEFORE INSERT OR UPDATE OF service_id, operator_id ON public.operator_location_points
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_principal_operator_service_binding();

-- Al reasignar, la sesión del saliente se suelta del servicio en el acto.
--
-- Solo las ACTIVAS. Las sesiones cerradas del operador anterior eran correctas
-- cuando se escribieron —él ERA el principal— y reescribirlas borraría su tramo
-- del historial del traslado. Lo que se corta es la hemorragia hacia adelante,
-- no el pasado: la misma razón por la que no hay backfill.
CREATE OR REPLACE FUNCTION public.release_sessions_from_reassigned_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.operator_location_sessions
  SET service_id = NULL
  WHERE service_id = NEW.id
    AND status = 'active'
    AND operator_id IS DISTINCT FROM NEW.operator_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.release_sessions_from_reassigned_service() IS
  'Al reasignar un servicio, suelta las sesiones ACTIVAS del operador saliente. Las cerradas quedan intactas: eran correctas cuando se escribieron.';

DROP TRIGGER IF EXISTS release_sessions_on_reassignment ON public.services;
CREATE TRIGGER release_sessions_on_reassignment
  AFTER UPDATE OF operator_id ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.release_sessions_from_reassigned_service();

-- SIN BACKFILL, y es deliberado.
--
-- De los 1.535 puntos que hoy tienen service_id de un servicio cuyo principal
-- actual es otro, la enorme mayoría (1.530, folio 3262047-1) son de Sergio
-- CUANDO ÉL ERA el principal: legítimos, y son su tramo del traslado. La
-- comparación contra el operador principal de HOY no distingue "se escribió
-- mal" de "el servicio cambió de manos después". Borrarlos por esa regla
-- mutilaría el historial en vez de corregirlo. Los 55 puntos realmente
-- indebidos ya se repararon a mano el 28/07.

COMMIT;
