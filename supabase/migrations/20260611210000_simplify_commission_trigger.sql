-- Simplificación del sistema de comisiones (2026-06-11).
-- El trigger de BD pasa a ser la ÚNICA fuente de verdad. Reglas:
--   * cancelled/failed/pending/quoted → sin comisión (se anulan las no pagadas)
--   * operador commission_exempt → nunca genera comisión
--   * comisiones pagadas (payment_date/payment_batch_id) → intocables
--   * reasignación → se anula la pendiente del operador anterior y se crea
--     la del nuevo si aplica
-- Dispara en services (INSERT + cambios de status/operador) y en
-- service_resources (INSERT/UPDATE/DELETE), porque el flujo de creación
-- inserta services antes que service_resources.

BEGIN;

-- ── Función núcleo: sincroniza las comisiones de un servicio ──
CREATE OR REPLACE FUNCTION public.sync_service_commissions(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service RECORD;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
BEGIN
  SELECT id, folio, service_date, crane_id, status
  INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Estados sin comisión: anular las no pagadas; las pagadas quedan como
  -- registro histórico contable
  IF v_service.status NOT IN ('completed', 'with_purchase_order', 'invoiced') THEN
    DELETE FROM costs
    WHERE service_id = p_service_id
      AND category_id = v_category_id
      AND payment_date IS NULL
      AND payment_batch_id IS NULL;
    RETURN;
  END IF;

  -- 1) Anular pendientes que ya no corresponden (reasignación, monto en 0,
  --    operador ahora exento)
  DELETE FROM costs c
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM service_resources sr
      JOIN operators o ON o.id = sr.operator_id
      WHERE sr.service_id = p_service_id
        AND sr.resource_type = 'operator'
        AND sr.operator_id = c.operator_id
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    );

  -- 2) Actualizar monto de pendientes que difieren de service_resources
  UPDATE costs c
  SET amount = sr.commission_amount,
      updated_at = now()
  FROM service_resources sr
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.operator_id = c.operator_id
    AND sr.commission_amount > 0
    AND c.amount IS DISTINCT FROM sr.commission_amount;

  -- 3) Crear las faltantes (operadores no exentos sin fila previa,
  --    pagada o pendiente)
  INSERT INTO costs (
    amount, category_id, service_id, operator_id,
    service_folio, date, description, subcategory, notes, crane_id
  )
  SELECT
    sr.commission_amount,
    v_category_id,
    p_service_id,
    sr.operator_id,
    v_service.folio,
    v_service.service_date,
    'Comisión ' || o.name,
    'comisiones',
    'Comisión generada automáticamente',
    v_service.crane_id
  FROM service_resources sr
  JOIN operators o ON o.id = sr.operator_id
  WHERE sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.commission_amount > 0
    AND NOT o.commission_exempt
    AND NOT EXISTS (
      SELECT 1 FROM costs c
      WHERE c.service_id = p_service_id
        AND c.operator_id = sr.operator_id
        AND c.category_id = v_category_id
    );
END;
$function$;

-- ── Wrapper para services: INSERT o cambio relevante ──
CREATE OR REPLACE FUNCTION public.trg_services_commission_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
     OR NEW.operator_commission IS DISTINCT FROM OLD.operator_commission THEN
    PERFORM public.sync_service_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Wrapper para service_resources: cualquier cambio de operadores ──
CREATE OR REPLACE FUNCTION public.trg_service_resources_commission_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.sync_service_commissions(COALESCE(NEW.service_id, OLD.service_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ── Reemplazar triggers anteriores ──
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;
DROP TRIGGER IF EXISTS trigger_generate_commission_on_service_completion ON public.services;
DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;
DROP TRIGGER IF EXISTS trigger_services_commission_sync ON public.services;
DROP TRIGGER IF EXISTS trigger_service_resources_commission_sync ON public.service_resources;

CREATE TRIGGER trigger_services_commission_sync
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_services_commission_sync();

CREATE TRIGGER trigger_service_resources_commission_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.service_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_service_resources_commission_sync();

-- La función del trigger anterior queda obsoleta
DROP FUNCTION IF EXISTS public.generate_commission_on_service_completion();

COMMIT;
