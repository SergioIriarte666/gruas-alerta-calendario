-- Integridad operacional de services: visibilidad, borrado, folio y auditoría.
--
-- Incidente de referencia (08-09 ago 2026): un servicio en 'quoted' no aparecía
-- en el portal del operador. Para poder operar se eliminaron 3 servicios reales
-- —uno EN VUELO con journey_stage 'towing', otro con inspección firmada— y se
-- recrearon; el folio SRV-6887 fue reutilizado por el registro nuevo.
--
-- Esta migración cierra las cuatro puertas que lo permitieron:
--   1. El estado comercial bloqueaba el inicio del servicio por el operador.
--   2. Se podía eliminar un servicio con evidencia de terreno.
--   3. El folio se recalculaba desde un contador que retrocedía al borrar.
--   4. audit_log no registraba los DELETE de services.

BEGIN;

-- =========================================================================
-- 1. El estado comercial no bloquea la operación
-- =========================================================================

-- Espejo servidor de OPERATOR_STARTABLE_SERVICE_STATUSES (src/constants/
-- operatorVisibility.ts). Si cambia uno, cambia el otro.
CREATE OR REPLACE FUNCTION public.operator_startable_statuses()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['pending', 'quoted', 'purchase_order_pending', 'with_purchase_order']::text[];
$$;

COMMENT ON FUNCTION public.operator_startable_statuses() IS
  'Estados desde los que un operador puede iniciar un servicio. El estado comercial no decide la visibilidad operacional.';

GRANT EXECUTE ON FUNCTION public.operator_startable_statuses() TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_operator_service_status(
  p_service_id uuid,
  p_folio_confirmation text,
  p_target_status text,
  p_start_time text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Antes exigía v_status = 'pending' y dejaba varado a todo servicio con
  -- estado comercial ('quoted', OC pendiente...), aunque tuviera grúa,
  -- operador y hora asignados.
  IF p_target_status = 'in_progress'
     AND NOT (v_status = ANY (public.operator_startable_statuses())) THEN
    RAISE EXCEPTION 'invalid_transition: no se puede iniciar un servicio en estado %', v_status
      USING ERRCODE = '22023';
  END IF;

  IF p_target_status = 'inspection_completed'
     AND NOT (v_status = ANY (public.operator_startable_statuses() || ARRAY['in_progress'])) THEN
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

GRANT EXECUTE ON FUNCTION public.advance_operator_service_status(uuid, text, text, text) TO authenticated;

-- =========================================================================
-- 2. Un servicio con evidencia de terreno no se elimina
-- =========================================================================

-- Devuelve NULL si el servicio se puede eliminar, o el motivo del bloqueo.
-- Es la fuente única: la usan el trigger BEFORE DELETE, el RPC de cascada y
-- el hook de UI (vía RPC) para mostrar el mismo mensaje.
CREATE OR REPLACE FUNCTION public.service_delete_block_reason(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_service.status::text IN ('in_progress', 'inspection_completed', 'completed', 'invoiced') THEN
    v_reasons := v_reasons || format('el servicio está en estado %s', v_service.status);
  END IF;

  IF v_service.journey_stage_reached IS NOT NULL THEN
    v_reasons := v_reasons || format('el traslado alcanzó la etapa "%s"', v_service.journey_stage_reached);
  END IF;

  IF v_service.on_site_reached_at IS NOT NULL THEN
    v_reasons := v_reasons || 'la grúa marcó llegada al lugar';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inspections WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene inspección registrada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_tracking_links WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene link de seguimiento emitido';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_route_metrics WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene métricas de ruta calculadas';
  END IF;

  IF EXISTS (SELECT 1 FROM public.operator_location_sessions WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene sesiones de transmisión GPS';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_stop_events WHERE service_id = p_service_id) THEN
    v_reasons := v_reasons || 'tiene eventos de paradas del recorrido';
  END IF;

  IF array_length(v_reasons, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN array_to_string(v_reasons, '; ');
END;
$$;

COMMENT ON FUNCTION public.service_delete_block_reason(uuid) IS
  'NULL si el servicio es eliminable; si no, el motivo legible. Un servicio con evidencia de terreno se ANULA (status cancelled), no se elimina.';

GRANT EXECUTE ON FUNCTION public.service_delete_block_reason(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_service_deletable(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  v_reason := public.service_delete_block_reason(p_service_id);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'service_delete_blocked: % . Anula el servicio en vez de eliminarlo.', v_reason
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_service_deletable(uuid) TO authenticated;

-- Red de seguridad para el DELETE directo (el admin tiene policy ALL sobre
-- services). No puede depender de las filas hijas que el RPC de cascada ya
-- borró antes de llegar acá: por eso el RPC valida ANTES de tocar nada.
CREATE OR REPLACE FUNCTION public.guard_service_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  IF OLD.status::text IN ('in_progress', 'inspection_completed', 'completed', 'invoiced') THEN
    v_reasons := v_reasons || format('el servicio está en estado %s', OLD.status);
  END IF;

  IF OLD.journey_stage_reached IS NOT NULL THEN
    v_reasons := v_reasons || format('el traslado alcanzó la etapa "%s"', OLD.journey_stage_reached);
  END IF;

  IF OLD.on_site_reached_at IS NOT NULL THEN
    v_reasons := v_reasons || 'la grúa marcó llegada al lugar';
  END IF;

  -- Hijas que la cascada NO borra: siguen presentes en este punto.
  IF EXISTS (SELECT 1 FROM public.service_tracking_links WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene link de seguimiento emitido';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_route_metrics WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene métricas de ruta calculadas';
  END IF;

  IF EXISTS (SELECT 1 FROM public.operator_location_sessions WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene sesiones de transmisión GPS';
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_stop_events WHERE service_id = OLD.id) THEN
    v_reasons := v_reasons || 'tiene eventos de paradas del recorrido';
  END IF;

  IF array_length(v_reasons, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'service_delete_blocked: % . Anula el servicio en vez de eliminarlo.',
      array_to_string(v_reasons, '; ')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

-- Nombre con prefijo 'a_' para correr antes que los demás BEFORE DELETE
-- (Postgres los dispara en orden alfabético): nada se borra si esto aborta.
DROP TRIGGER IF EXISTS a_guard_service_delete ON public.services;
CREATE TRIGGER a_guard_service_delete
  BEFORE DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.guard_service_delete();

-- El RPC de cascada valida TODO antes de borrar la primera fila hija.
CREATE OR REPLACE FUNCTION public.delete_service_cascade(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar servicios';
  END IF;

  -- ANTES de tocar nada: la cascada borra inspections en el paso 1, así que un
  -- chequeo posterior (o el trigger BEFORE DELETE) ya no las vería.
  PERFORM public.assert_service_deletable(p_service_id);

  DELETE FROM public.inspections WHERE service_id = p_service_id;
  DELETE FROM public.costs WHERE service_id = p_service_id;
  DELETE FROM public.service_costs WHERE service_id = p_service_id;
  DELETE FROM public.service_resources WHERE service_id = p_service_id;
  DELETE FROM public.closure_services WHERE service_id = p_service_id;
  DELETE FROM public.invoice_services WHERE service_id = p_service_id;
  DELETE FROM public.calendar_events WHERE service_id = p_service_id;

  DELETE FROM public.services WHERE id = p_service_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_service_cascade(uuid) TO authenticated;

-- =========================================================================
-- 3. El folio nunca retrocede
-- =========================================================================

-- Antes: el cliente leía company_data.next_service_folio_number y lo escribía
-- +1 en dos viajes separados (useFolioGenerator). Dos creaciones simultáneas
-- sacaban el mismo número, y cualquier corrección del contador reciclaba
-- folios ya usados y borrados — así SRV-6887 volvió a emitirse.
--
-- La secuencia arranca en 6903 (último folio real, SRV-6903) y no en el máximo
-- numérico absoluto: SRV-826894 NO es un folio de negocio, es el fallback por
-- timestamp de useEnhancedFolioGeneration (`SRV-${Date.now().slice(-6)}`),
-- emitido ~40 s antes de guardar ese servicio el 22-07-2026. Decisión del
-- dueño (09-08-2026): la serie sigue en SRV-6904.
CREATE SEQUENCE IF NOT EXISTS public.services_folio_seq AS bigint;

COMMENT ON SEQUENCE public.services_folio_seq IS
  'Correlativo de folios SRV-. Monotónico: un folio eliminado queda quemado y jamás se reutiliza.';

-- Idempotente: pg_sequence_last_value() es NULL mientras nadie llamó a nextval,
-- así que una reejecución nunca retrocede el correlativo ya entregado.
SELECT setval(
  'public.services_folio_seq',
  GREATEST(
    COALESCE(pg_sequence_last_value('public.services_folio_seq'::regclass), 0),
    6903,
    COALESCE((
      SELECT max((regexp_replace(folio, '\D', '', 'g'))::bigint)
      FROM public.services
      WHERE folio ~ '^SRV-[0-9]+$'
        -- Se ignora el folio basura de timestamp; ver comentario de arriba.
        AND (regexp_replace(folio, '\D', '', 'g'))::bigint < 100000
    ), 0)
  ),
  true  -- is_called: el próximo nextval devuelve 6904
);

CREATE OR REPLACE FUNCTION public.next_service_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format text;
  v_candidate text;
  v_attempts int := 0;
BEGIN
  SELECT COALESCE(folio_format, 'SRV-{number}') INTO v_format
  FROM public.company_data LIMIT 1;
  v_format := COALESCE(v_format, 'SRV-{number}');

  -- La secuencia es monotónica, pero folios manuales o importados pueden haber
  -- ocupado un número por delante. Se avanza hasta encontrar uno libre; nunca
  -- se retrocede ni se cae a un folio por timestamp.
  LOOP
    v_attempts := v_attempts + 1;
    v_candidate := REPLACE(
      v_format,
      '{number}',
      LPAD(nextval('public.services_folio_seq')::text, 4, '0')
    );

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.services WHERE folio = v_candidate);

    IF v_attempts >= 1000 THEN
      RAISE EXCEPTION 'No se pudo obtener un folio libre tras % intentos', v_attempts
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Se mantiene company_data al día: la pantalla de Configuración muestra ese
  -- número y varias vistas legadas lo leen. La secuencia es la autoridad.
  UPDATE public.company_data
  SET next_service_folio_number = GREATEST(
        COALESCE(next_service_folio_number, 0),
        (SELECT last_value FROM public.services_folio_seq)::int + 1
      )
  WHERE id = (SELECT id FROM public.company_data LIMIT 1);

  RETURN v_candidate;
END;
$$;

COMMENT ON FUNCTION public.next_service_folio() IS
  'Único emisor de folios SRV-. Atómico (nextval) y monotónico: eliminar un servicio quema su folio.';

GRANT EXECUTE ON FUNCTION public.next_service_folio() TO authenticated;

-- =========================================================================
-- 4. audit_log registra los DELETE de services
-- =========================================================================

-- services solo tenía track_service_changes (→ service_change_history) para
-- INSERT/UPDATE. Los DELETE no dejaban rastro en audit_log, que es donde se
-- revisó primero tras el incidente.
DROP TRIGGER IF EXISTS trg_audit_services_delete ON public.services;
CREATE TRIGGER trg_audit_services_delete
  AFTER DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

COMMIT;
