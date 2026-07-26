-- La guarda de cierre se define por ASIGNACIÓN, no por rol.
--
-- La versión de 20260726010000 eximía al rol admin. La validación sintética
-- destapó por qué eso no servía: de las cinco cuentas de operador, DOS tienen
-- además el rol admin —incluida la del dueño, que es quien corrió la prueba de
-- terreno del 25/07—. Con una exención por rol, la app del operador de esas dos
-- cuentas seguía pudiendo cerrar el servicio equivocado por la vía directa:
-- justo el caso que este trabajo existe para hacer imposible.
--
-- El criterio correcto no es "quién eres" sino "desde dónde puedes equivocarte":
-- si el usuario autenticado ES el operador asignado a ese servicio, está en el
-- terreno —en la app, con la pantalla que puede mentir— y debe pasar por la
-- doble llave. El escritorio (un admin operando un servicio que no es suyo) y
-- los trabajos server-side sin usuario siguen como estaban.
--
-- Contrapartida asumida y explícita: un admin que además es el operador
-- asignado ya no puede cerrar ESE servicio con un UPDATE directo desde el TMS;
-- el mensaje de error dice qué usar. Es exactamente el caso donde la confusión
-- de servicios es posible, así que ahí la fricción es el punto.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_service_close_double_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('completed', 'cancelled')
     -- Trabajos server-side sin usuario autenticado (crons, service_role).
     AND auth.uid() IS NOT NULL
     -- Solo el terreno: quien está asignado a este servicio.
     AND public.is_operator_assigned_to_service(NEW.id)
     -- Vía legítima: complete_service dejó el id validado en la bandera.
     AND COALESCE(current_setting('app.via_complete_service', true), '') IS DISTINCT FROM NEW.id::text
  THEN
    RAISE EXCEPTION 'Este servicio está asignado a ti: solo puede cerrarse con complete_service(id, folio), que exige el folio en pantalla. El cierre directo está bloqueado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

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
     AND public.is_operator_assigned_to_service(NEW.service_id)
     AND COALESCE(current_setting('app.via_inspection_evidence', true), '') IS DISTINCT FROM NEW.service_id::text
  THEN
    RAISE EXCEPTION 'La evidencia de un servicio asignado a ti solo puede escribirse con save_inspection_evidence(id, folio): la escritura directa está bloqueada.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_service_close_double_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_inspection_evidence_double_key() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_service_close_double_key() IS
  'Bloquea el cierre directo de un servicio cuando quien escribe es el operador asignado (el vector de terreno). Exentos: escritorio operando servicios ajenos y trabajos server-side sin usuario.';

COMMIT;
