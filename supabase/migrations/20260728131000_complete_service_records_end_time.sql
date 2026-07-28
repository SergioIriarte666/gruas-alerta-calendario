-- El cierre registra la hora real de término.
--
-- El 26/07 se corrigió que start_time quedara NULL al iniciar: la hora de
-- partida viaja ahora en la misma llamada que el cambio a in_progress. El
-- arreglo se aplicó a UNA sola punta. complete_service seguía escribiendo solo
-- el estado, así que la hora de término no la registraba nadie.
--
-- Medida en producción antes de este cambio: 75 de 76 servicios 'completed' con
-- end_time en NULL. No es un campo muerto —serviceReportGenerator lo lee y lo
-- exporta como columna "Hora Término"—, así que esa columna salía vacía en todos
-- los informes y la duración real de cada traslado no quedaba en ninguna parte.
--
-- Dos decisiones explícitas:
--
--   1. Se estampa SOLO desde complete_service, es decir desde el cierre real del
--      terreno. Un admin que marca 'completed' un servicio histórico desde el
--      TMS no recibe la hora de hoy: una hora falsa es peor que una vacía, y
--      ese caso se corrige a mano en el wizard, donde el campo es editable.
--
--   2. COALESCE, no sobreescritura. Si alguien ya registró deliberadamente una
--      hora de término, el cierre la respeta en vez de pisarla — el mismo
--      criterio con el que advance_operator_service_status conserva start_time
--      cuando no le mandan uno nuevo.
--
-- La hora se calcula en la zona del NEGOCIO (company_data.report_timezone, con
-- 'America/Santiago' de respaldo). La base corre en UTC: un now()::time directo
-- habría guardado cuatro horas de más.

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_service(p_service_id uuid, p_folio_confirmation text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_business_tz text;
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
$$;

COMMENT ON FUNCTION public.complete_service(uuid, text) IS
  'Cierra un servicio con doble llave id+folio y registra la hora real de término en la zona del negocio. Respeta una hora ya registrada a mano.';

COMMIT;
