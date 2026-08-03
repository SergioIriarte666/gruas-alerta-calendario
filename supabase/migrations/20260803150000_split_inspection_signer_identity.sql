-- El firmante de la entrega dejaba sin identidad al del retiro.
--
-- `inspections` tiene UNA fila por servicio: la inspección inicial la INSERTA y
-- la entrega la ACTUALIZA. Ambas fases escribían el mismo par
-- client_name/client_rut, así que el nombre y el RUT de quien RECIBE el
-- vehículo pisaban los de quien lo ENTREGÓ. Son dos personas distintas, en dos
-- momentos distintos, y el acta que ve el asegurador necesita a las dos.
--
-- Evidencia: folio 3266120-1 (01-08-2026). El PDF de pre-servicio decía
-- "Alberto Pino" y en la fila quedó "Auxilia Club Asistencia S.A." —la razón
-- social del cliente, que el formulario prellenaba— con el RUT del receptor.
--
-- Se separan las identidades en dos pares y la fase 'final' deja de tocar el
-- par del retiro. No se crean triggers: los de notificación
-- (trg_enqueue_initial_inspection_notifications /
-- trg_enqueue_delivery_inspection_notifications) siguen igual.

BEGIN;

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_rut  text;

COMMENT ON COLUMN public.inspections.client_name IS
  'Nombre de la persona que ENTREGA el vehículo (inspección inicial/retiro). NO es la razón social del cliente.';
COMMENT ON COLUMN public.inspections.client_rut IS
  'RUT de la persona que ENTREGA el vehículo (inspección inicial/retiro).';
COMMENT ON COLUMN public.inspections.receiver_name IS
  'Nombre de la persona que RECIBE el vehículo (inspección de entrega).';
COMMENT ON COLUMN public.inspections.receiver_rut IS
  'RUT de la persona que RECIBE el vehículo (inspección de entrega).';

/**
 * Misma función, mismo contrato de doble llave (ver
 * 20260726011000_inspection_evidence_double_key.sql). El único cambio: la rama
 * 'final' escribe receiver_name/receiver_rut y ya NO toca client_name ni
 * client_rut. La lista blanca del payload es lo que hace que esto sea una
 * garantía y no una convención: aunque el cliente mande client_name en la
 * entrega, la función lo ignora.
 */
CREATE OR REPLACE FUNCTION public.save_inspection_evidence(
  p_service_id uuid,
  p_folio_confirmation text,
  p_phase text,
  p_operator_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inspection_id  uuid;
  v_was_inserted   boolean := false;
  v_operator_id    uuid;
  v_photos         text[];
  v_pdf_path       text;
BEGIN
  IF p_phase NOT IN ('initial', 'final') THEN
    RAISE EXCEPTION 'Fase inválida: %', p_phase USING ERRCODE = '22023';
  END IF;

  PERFORM public.assert_service_identity(p_service_id, p_folio_confirmation);

  -- El operador de la inspección es el asignado al servicio, no el que mande el
  -- cliente: es quien firma el acta.
  SELECT COALESCE(p_operator_id, s.operator_id) INTO v_operator_id
  FROM public.services s WHERE s.id = p_service_id;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'El servicio no tiene un operador asignado' USING ERRCODE = '22023';
  END IF;

  v_photos := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'photos', '[]'::jsonb))
  );
  v_pdf_path := NULLIF(p_payload ->> 'pdf_path', '');

  IF v_pdf_path IS NULL THEN
    RAISE EXCEPTION 'Falta la ruta del PDF de la fase %', p_phase USING ERRCODE = '22023';
  END IF;

  IF p_phase = 'final' AND COALESCE(array_length(v_photos, 1), 0) = 0 THEN
    RAISE EXCEPTION 'La entrega requiere al menos una fotografía' USING ERRCODE = '22023';
  END IF;

  SELECT i.id INTO v_inspection_id
  FROM public.inspections i
  WHERE i.service_id = p_service_id;

  PERFORM set_config('app.via_inspection_evidence', p_service_id::text, true);

  IF v_inspection_id IS NULL THEN
    IF p_phase = 'final' THEN
      PERFORM set_config('app.via_inspection_evidence', '', true);
      RAISE EXCEPTION 'No existe una inspección inicial donde guardar la evidencia de entrega'
        USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.inspections (
      service_id, operator_id, equipment_checklist, equipment_status,
      vehicle_observations, operator_signature, client_name, client_rut,
      initial_vehicle_state, photos_before_service, pdf_url, pdf_uploaded_at
    ) VALUES (
      p_service_id,
      v_operator_id,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'equipment_checklist', '[]'::jsonb))),
      p_payload -> 'equipment_status',
      NULLIF(p_payload ->> 'vehicle_observations', ''),
      COALESCE(p_payload ->> 'operator_signature', ''),
      NULLIF(p_payload ->> 'client_name', ''),
      NULLIF(p_payload ->> 'client_rut', ''),
      p_payload -> 'initial_vehicle_state',
      v_photos,
      v_pdf_path,
      now()
    )
    RETURNING id INTO v_inspection_id;

    v_was_inserted := true;
  ELSIF p_phase = 'initial' THEN
    UPDATE public.inspections SET
      operator_id = v_operator_id,
      equipment_checklist = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'equipment_checklist', '[]'::jsonb))),
      equipment_status = COALESCE(p_payload -> 'equipment_status', equipment_status),
      vehicle_observations = NULLIF(p_payload ->> 'vehicle_observations', ''),
      operator_signature = COALESCE(NULLIF(p_payload ->> 'operator_signature', ''), operator_signature),
      client_name = NULLIF(p_payload ->> 'client_name', ''),
      client_rut = NULLIF(p_payload ->> 'client_rut', ''),
      initial_vehicle_state = COALESCE(p_payload -> 'initial_vehicle_state', initial_vehicle_state),
      photos_before_service = v_photos,
      pdf_url = v_pdf_path,
      pdf_uploaded_at = now()
    WHERE id = v_inspection_id;
  ELSE
    -- Entrega: client_name/client_rut quedan intactos a propósito. Son la
    -- identidad de quien entregó el vehículo en el retiro; el receptor tiene
    -- su propio par.
    UPDATE public.inspections SET
      operator_id = v_operator_id,
      equipment_checklist = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'equipment_checklist', '[]'::jsonb))),
      equipment_status = COALESCE(p_payload -> 'equipment_status', equipment_status),
      vehicle_observations = NULLIF(p_payload ->> 'vehicle_observations', ''),
      receiver_name = NULLIF(p_payload ->> 'receiver_name', ''),
      receiver_rut = NULLIF(p_payload ->> 'receiver_rut', ''),
      photos_client_vehicle = v_photos,
      pdf_retiro_url = v_pdf_path,
      pdf_retiro_uploaded_at = now()
    WHERE id = v_inspection_id;
  END IF;

  PERFORM set_config('app.via_inspection_evidence', '', true);

  RETURN jsonb_build_object('id', v_inspection_id, 'was_inserted', v_was_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) IS
  'Escribe la evidencia de una fase (initial/final) exigiendo el folio que la UI muestra. Único camino no-admin para escribir PDF y fotos de inspección. La fase final escribe receiver_* y nunca pisa client_* (identidad del retiro).';

COMMIT;
