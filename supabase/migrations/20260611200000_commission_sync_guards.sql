-- Guards del sistema de comisiones (diagnóstico 2026-06-11):
-- 1. El trigger de comisiones no cubría INSERT (servicios creados directamente
--    como 'completed' nunca generaban comisión → missing_commission).
-- 2. Las rutinas de sync borraban comisiones PAGADAS y las recreaban como
--    pendientes (pérdida de payment_date/payment_batch_id).
-- 3. force_commission_sync_for_service creaba comisiones para servicios
--    cancelados y excluía operadores por nombre hardcodeado.
-- 4. El trigger estaba registrado dos veces y repair_commission_system lo
--    re-apuntaba a otra función en cada ejecución (deriva de esquema).

-- ── 1. Función del trigger: cubre INSERT, nunca toca filas pagadas ──
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resource RECORD;
  v_commission_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN

    -- Borrar solo comisiones NO pagadas (las pagadas son registro contable)
    DELETE FROM public.costs
    WHERE service_id = NEW.id
      AND category_id = v_commission_category_id
      AND payment_date IS NULL
      AND payment_batch_id IS NULL;

    FOR v_resource IN
      SELECT sr.operator_id, sr.commission_amount, o.name as operator_name
      FROM public.service_resources sr
      JOIN public.operators o ON o.id = sr.operator_id
      WHERE sr.service_id = NEW.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
        -- No duplicar si ya quedó una comisión (p. ej. pagada) para el operador
        AND NOT EXISTS (
          SELECT 1 FROM public.costs c
          WHERE c.service_id = NEW.id
            AND c.operator_id = sr.operator_id
            AND c.category_id = v_commission_category_id
        )
    LOOP
      INSERT INTO public.costs (
        amount, category_id, service_id, operator_id,
        service_folio, date, description, subcategory, notes, crane_id
      ) VALUES (
        v_resource.commission_amount,
        v_commission_category_id,
        NEW.id,
        v_resource.operator_id,
        NEW.folio,
        NEW.service_date,
        'Comisión ' || v_resource.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        NEW.crane_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2. Un solo trigger, AFTER INSERT OR UPDATE ──
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;
DROP TRIGGER IF EXISTS trigger_generate_commission_on_service_completion ON public.services;
DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;

CREATE TRIGGER trigger_generate_commission_on_service_completion
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_on_service_completion();

-- ── 3. force_commission_sync_for_service: guards de estado, pago y exención ──
CREATE OR REPLACE FUNCTION public.force_commission_sync_for_service(p_service_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_service RECORD;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_created_count INT := 0;
  v_resource_record RECORD;
BEGIN
  SELECT id, folio, service_date, crane_id, operator_commission, status
  INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF v_service.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Servicio no encontrado');
  END IF;

  -- Un servicio cancelado no debe tener comisión activa
  IF v_service.status = 'cancelled' THEN
    RETURN json_build_object('success', true, 'message', 'Servicio cancelado: sin comisiones', 'created', 0);
  END IF;

  IF v_service.operator_commission IS NULL OR v_service.operator_commission <= 0 THEN
    RETURN json_build_object('success', true, 'message', 'El servicio no tiene comisión configurada', 'created', 0);
  END IF;

  -- Borrar solo comisiones NO pagadas
  DELETE FROM costs
  WHERE service_id = p_service_id
    AND category_id = v_category_id
    AND payment_date IS NULL
    AND payment_batch_id IS NULL;

  -- Crear comisiones para operadores no exentos sin comisión existente
  FOR v_resource_record IN
    SELECT sr.operator_id, sr.commission_amount, o.name
    FROM service_resources sr
    JOIN operators o ON sr.operator_id = o.id
    WHERE sr.service_id = p_service_id
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND NOT o.commission_exempt
      AND NOT EXISTS (
        SELECT 1 FROM costs c
        WHERE c.service_id = p_service_id
          AND c.operator_id = sr.operator_id
          AND c.category_id = v_category_id
      )
  LOOP
    INSERT INTO costs (
      date, description, amount, category_id, operator_id, service_id, service_folio, subcategory, crane_id
    ) VALUES (
      v_service.service_date,
      'Comisión operador: ' || v_resource_record.name || ' - Servicio ' || v_service.folio,
      v_resource_record.commission_amount, v_category_id, v_resource_record.operator_id,
      p_service_id, v_service.folio, 'Comisión Operador', v_service.crane_id
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'message', 'Sincronización completada', 'created', v_created_count, 'folio', v_service.folio);
END;
$function$;

-- ── 4. repair_commission_system: sin DROP/CREATE de trigger (deriva de esquema) ──
CREATE OR REPLACE FUNCTION public.repair_commission_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  commission_category_id UUID;
  repaired_count INTEGER := 0;
  synced_count INTEGER := 0;
  created_count INTEGER := 0;
  service_record RECORD;
  resource_record RECORD;
  result jsonb;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden reparar el sistema de comisiones';
  END IF;

  SELECT id INTO commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador';

  IF commission_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios completados')
    RETURNING id INTO commission_category_id;
  END IF;

  -- PASO 1: Sincronizar operator_id desde service_resources a services
  FOR service_record IN
    SELECT DISTINCT s.id as service_id, sr.operator_id, sr.commission_amount
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE sr.resource_type = 'operator'
      AND sr.is_primary = true
      AND s.operator_id IS NULL
      AND s.status <> 'cancelled'
  LOOP
    UPDATE public.services
    SET
      operator_id = service_record.operator_id,
      operator_commission = service_record.commission_amount,
      updated_at = now()
    WHERE id = service_record.service_id;

    synced_count := synced_count + 1;
  END LOOP;

  -- PASO 2: Generar comisiones faltantes para servicios completados
  FOR resource_record IN
    SELECT DISTINCT
      s.id as service_id,
      s.folio,
      s.service_date,
      s.created_by,
      sr.operator_id,
      sr.commission_amount,
      o.name as operator_name
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    JOIN public.operators o ON sr.operator_id = o.id
    WHERE s.status = 'completed'
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND NOT o.commission_exempt
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c
        WHERE c.service_id = s.id
          AND c.operator_id = sr.operator_id
          AND c.category_id = commission_category_id
      )
  LOOP
    INSERT INTO public.costs (
      amount,
      category_id,
      service_id,
      operator_id,
      service_folio,
      date,
      description,
      subcategory,
      notes,
      created_by
    ) VALUES (
      resource_record.commission_amount,
      commission_category_id,
      resource_record.service_id,
      resource_record.operator_id,
      resource_record.folio,
      resource_record.service_date,
      'Comisión por servicio ' || resource_record.folio || ' - Operador: ' || resource_record.operator_name,
      'comisiones',
      'Comisión generada por reparación masiva del sistema',
      resource_record.created_by
    );

    created_count := created_count + 1;
  END LOOP;

  repaired_count := synced_count + created_count;

  result := jsonb_build_object(
    'success', true,
    'repair_date', now(),
    'services_synced', synced_count,
    'commissions_created', created_count,
    'total_repaired', repaired_count,
    'trigger_updated', false
  );

  RETURN result;
END;
$function$;
