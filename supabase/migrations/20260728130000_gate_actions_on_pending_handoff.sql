-- El bloqueo por traspaso pendiente vivía SOLO en la UI. Se corrige.
--
-- Defecto introducido en la misma ronda 4: ServiceHandoffGate se pinta en
-- AssignedServiceCard, la tarjeta de la lista. Pero /operator/service/:id/inspection
-- es una ruta alcanzable directo —por historial, por un enlace guardado, o
-- simplemente porque la pantalla anterior quedó en caché—. Por ahí, el operador
-- entrante podía avanzar el estado y CERRAR el servicio sin haber levantado
-- nunca las fotos del estado en que recibió la carga, que es exactamente la
-- evidencia que el traspaso existe para capturar. Y esa ventana no se puede
-- reabrir después: al entregar ya no hay forma de saber en qué tramo apareció
-- un daño.
--
-- La doctrina del proyecto es explícita al respecto: las reglas de terreno se
-- evalúan en el SERVIDOR. Una guarda que solo existe en la pantalla no es una
-- guarda, es una sugerencia.
--
-- Alcance deliberado:
--   * Se bloquea AVANZAR DE ESTADO (entrega y cierre), no escribir evidencia.
--     Las fotos y el PDF que el operador alcance a subir son bienvenidos; lo que
--     no puede es dar el servicio por entregado saltándose la recepción.
--   * Solo aplica al TERRENO: quien está asignado al servicio y no es admin. El
--     escritorio tiene que poder destrabar un relevo mal abierto sin pedirle
--     permiso a nadie, y los trabajos server-side siguen igual.

BEGIN;

CREATE OR REPLACE FUNCTION public.assert_no_pending_handoff(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR NOT public.is_operator_assigned_to_service(p_service_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_operator_handoffs h
    WHERE h.service_id = p_service_id
      AND h.confirmed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Este servicio te fue traspasado y todavía no confirmas la recepción. Registra el estado de la carga (2 a 4 fotos) antes de continuar.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_no_pending_handoff(uuid) IS
  'Frena el avance de estado del terreno mientras el relevo no esté confirmado. El escritorio (admin) y los trabajos server-side quedan exentos.';

REVOKE ALL ON FUNCTION public.assert_no_pending_handoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_no_pending_handoff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_service(p_service_id uuid, p_folio_confirmation text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := public.assert_service_identity(p_service_id, p_folio_confirmation);

  PERFORM public.assert_no_pending_handoff(p_service_id);

  IF v_status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_status NOT IN ('in_progress', 'inspection_completed') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede completar un servicio en estado %', v_status
      USING ERRCODE = '22023';
  END IF;

  -- La bandera lleva el ID VALIDADO, no un simple "on": aunque algo más quisiera
  -- cerrar otro servicio dentro de la misma transacción, el trigger lo rechaza.
  PERFORM set_config('app.via_complete_service', p_service_id::text, true);

  UPDATE public.services
  SET status = 'completed'
  WHERE id = p_service_id;

  PERFORM set_config('app.via_complete_service', '', true);

  RETURN 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_operator_service_status(
  p_service_id uuid,
  p_folio_confirmation text,
  p_target_status text,
  p_start_time text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_target_status NOT IN ('in_progress', 'inspection_completed') THEN
    RAISE EXCEPTION 'Estado no permitido por esta función: %', p_target_status
      USING ERRCODE = '22023';
  END IF;

  v_status := public.assert_service_identity(p_service_id, p_folio_confirmation);

  PERFORM public.assert_no_pending_handoff(p_service_id);

  IF v_status = p_target_status THEN
    RETURN 'unchanged';
  END IF;

  IF p_target_status = 'in_progress' AND v_status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_transition: no se puede iniciar un servicio en estado %', v_status
      USING ERRCODE = '22023';
  END IF;

  IF p_target_status = 'inspection_completed' AND v_status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede pasar a entrega desde %', v_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.services
  SET status = p_target_status::public.service_status,
      start_time = CASE
        WHEN p_start_time IS NULL OR btrim(p_start_time) = '' THEN start_time
        ELSE p_start_time::time
      END
  WHERE id = p_service_id;

  RETURN p_target_status;
END;
$$;

COMMIT;
