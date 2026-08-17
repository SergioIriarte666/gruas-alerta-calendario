-- Cierre definitivo de servicios: una sola vía canónica.
--
-- El caso que lo motivó (3274759-1) quedó imposible de cerrar por dos bloqueos
-- simultáneos y sin salida en la UI:
--   (a) el servicio nunca se inició en la app, así que estaba en 'pending' y
--       complete_service solo aceptaba in_progress/inspection_completed;
--   (b) el usuario que intentaba cerrarlo era además el operador asignado, y
--       enforce_service_close_double_key bloqueaba sin eximir al admin.
--
-- Regla que queda: un admin SIEMPRE puede cerrar, desde cualquier estado que no
-- sea facturado, incluso si él mismo figura como operador. El operador puro
-- sigue cerrando solo lo que efectivamente inició. La confirmación de folio
-- aplica a todos —admin incluido—: es barata y evita cerrar el equivocado.

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) complete_service: vía única de cierre, con reglas por rol.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_service(p_service_id uuid, p_folio_confirmation text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status      text;
  v_business_tz text;
  v_is_admin    boolean;
BEGIN
  -- Doble llave: valida folio contra el id, y asignación (o rol admin).
  v_status := public.assert_service_identity(p_service_id, p_folio_confirmation);

  -- Un traspaso sin confirmar sigue frenando al operador entrante (exime admin).
  PERFORM public.assert_no_pending_handoff(p_service_id);

  -- Estados terminales: idempotente en 'completed', prohibido si ya se facturó.
  IF v_status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_status IN ('invoiced', 'partially_invoiced') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede cerrar un servicio facturado (estado actual: %)', v_status
      USING ERRCODE = '22023';
  END IF;

  -- auth.uid() NULL (crons, service_role) cae en la rama estricta, igual que antes.
  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);

  -- El operador puro no cierra lo que no inició. El admin sí: el cierre
  -- administrativo existe justamente para los servicios que nunca pasaron por
  -- la app (pending, quoted, con OC, fallidos, anulados).
  IF NOT v_is_admin AND v_status NOT IN ('in_progress', 'inspection_completed') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede completar un servicio en estado %. Inícialo primero o pide a un administrador que lo cierre.', v_status
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(report_timezone, 'America/Santiago')
    INTO v_business_tz
  FROM public.company_data
  LIMIT 1;
  v_business_tz := COALESCE(v_business_tz, 'America/Santiago');

  -- La bandera lleva el ID VALIDADO, no un simple "on": aunque algo más quisiera
  -- cerrar otro servicio dentro de la misma transacción, el trigger lo rechaza.
  PERFORM set_config('app.via_complete_service', p_service_id::text, true);

  UPDATE public.services
  SET status = 'completed',
      end_time = COALESCE(end_time, (now() AT TIME ZONE v_business_tz)::time)
  WHERE id = p_service_id;

  PERFORM set_config('app.via_complete_service', '', true);

  RETURN 'completed';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_service(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (b) enforce_service_close_double_key: eximir admin, simétrico con
--     assert_no_pending_handoff. El resto de la guarda queda intacto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_service_close_double_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('completed', 'cancelled')
     -- Trabajos server-side sin usuario autenticado (crons, service_role).
     AND auth.uid() IS NOT NULL
     -- Solo el terreno: quien está asignado a este servicio.
     AND public.is_operator_assigned_to_service(NEW.id)
     -- El admin no es "terreno": que además figure como operador asignado no
     -- puede dejarlo sin forma de cerrar el servicio.
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     -- Vía legítima: complete_service dejó el id validado en la bandera.
     AND COALESCE(current_setting('app.via_complete_service', true), '') IS DISTINCT FROM NEW.id::text
  THEN
    RAISE EXCEPTION 'Este servicio está asignado a ti: solo puede cerrarse con complete_service(id, folio), que exige el folio en pantalla. El cierre directo está bloqueado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- (c) Fuera las tres vías legacy de cierre. Ninguna validaba folio ni
--     asignación, dos deshabilitaban triggers y ninguna estampaba end_time.
--     Sus llamadores quedaron migrados a complete_service en este mismo cambio.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.emergency_close_service(uuid);
DROP FUNCTION IF EXISTS public.force_close_service_bypass_triggers(uuid);
DROP FUNCTION IF EXISTS public.close_service_status_only(uuid);

COMMIT;
