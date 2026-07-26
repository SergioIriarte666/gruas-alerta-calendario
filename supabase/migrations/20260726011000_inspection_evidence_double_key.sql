-- Doble llave para escribir evidencia de inspección/entrega.
--
-- El 25/07 no solo se cerró el servicio equivocado: se le escribió encima el
-- PDF de entrega, la foto, el nombre y el RUT del receptor de OTRO servicio.
-- Esa contaminación documental es tan grave como el cierre —es la prueba que se
-- le entrega a un asegurador— y ocurría por la misma vía: un UPDATE directo a
-- `inspections` con el service_id que el flujo traía por dentro.
--
-- Misma solución que el cierre: la escritura pasa por una función que exige el
-- folio que la UI muestra, y un trigger cierra el camino directo. Se bloquea
-- solo lo que ESCRIBE evidencia: limpiar campos (rollback del pipeline) y
-- borrar filas siguen libres, o un fallo a mitad de camino no podría revertirse.

BEGIN;

/**
 * Guarda la evidencia de una fase completa (inicial o entrega) en una sola
 * operación validada. Reemplaza el insert/update directo del cliente.
 *
 * El payload viaja como jsonb con claves en LISTA BLANCA: cualquier otra se
 * ignora en silencio. Nada de construir SQL dinámico con lo que mande el
 * navegador.
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
    UPDATE public.inspections SET
      operator_id = v_operator_id,
      equipment_checklist = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'equipment_checklist', '[]'::jsonb))),
      equipment_status = COALESCE(p_payload -> 'equipment_status', equipment_status),
      vehicle_observations = NULLIF(p_payload ->> 'vehicle_observations', ''),
      client_name = NULLIF(p_payload ->> 'client_name', ''),
      client_rut = NULLIF(p_payload ->> 'client_rut', ''),
      photos_client_vehicle = v_photos,
      pdf_retiro_url = v_pdf_path,
      pdf_retiro_uploaded_at = now()
    WHERE id = v_inspection_id;
  END IF;

  PERFORM set_config('app.via_inspection_evidence', '', true);

  RETURN jsonb_build_object('id', v_inspection_id, 'was_inserted', v_was_inserted);
END;
$$;

/**
 * Cierra el camino directo. Solo se bloquea la escritura de evidencia NUEVA
 * (PDF o fotos no nulos): poner esos campos en NULL es lo que hace el rollback
 * del pipeline cuando algo falla a mitad, y eso debe seguir funcionando.
 */
CREATE OR REPLACE FUNCTION public.enforce_inspection_evidence_double_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_writes_evidence boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_writes_evidence :=
      NEW.pdf_url IS NOT NULL
      OR NEW.pdf_retiro_url IS NOT NULL
      OR COALESCE(array_length(NEW.photos_before_service, 1), 0) > 0
      OR COALESCE(array_length(NEW.photos_client_vehicle, 1), 0) > 0;
  ELSE
    v_writes_evidence :=
      (NEW.pdf_url IS NOT NULL AND NEW.pdf_url IS DISTINCT FROM OLD.pdf_url)
      OR (NEW.pdf_retiro_url IS NOT NULL AND NEW.pdf_retiro_url IS DISTINCT FROM OLD.pdf_retiro_url)
      OR (COALESCE(array_length(NEW.photos_before_service, 1), 0) > 0
          AND NEW.photos_before_service IS DISTINCT FROM OLD.photos_before_service)
      OR (COALESCE(array_length(NEW.photos_client_vehicle, 1), 0) > 0
          AND NEW.photos_client_vehicle IS DISTINCT FROM OLD.photos_client_vehicle);
  END IF;

  IF v_writes_evidence
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND COALESCE(current_setting('app.via_inspection_evidence', true), '') IS DISTINCT FROM NEW.service_id::text
  THEN
    RAISE EXCEPTION 'La evidencia de inspección solo puede escribirse con save_inspection_evidence(id, folio): la escritura directa está bloqueada.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_inspection_evidence_double_key ON public.inspections;
CREATE TRIGGER trg_enforce_inspection_evidence_double_key
  BEFORE INSERT OR UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_inspection_evidence_double_key();

REVOKE ALL ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_inspection_evidence_double_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_inspection_evidence(uuid, text, text, uuid, jsonb) IS
  'Escribe la evidencia de una fase (initial/final) exigiendo el folio que la UI muestra. Único camino no-admin para escribir PDF y fotos de inspección.';

COMMIT;
