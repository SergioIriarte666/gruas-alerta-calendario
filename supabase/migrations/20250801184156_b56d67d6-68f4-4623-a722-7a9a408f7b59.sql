-- FASE 1: Reparación específica del servicio 2999918-1
-- Función para sincronizar un servicio específico de forma segura
CREATE OR REPLACE FUNCTION force_commission_sync_for_service(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  commission_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  service_record RECORD;
  resource_record RECORD;
  existing_cost_count INTEGER;
  synced_count INTEGER := 0;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar sincronización de comisiones';
  END IF;

  -- Obtener datos del servicio
  SELECT folio, service_date, crane_id, operator_commission
  INTO service_record
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;

  -- Solo sincronizar si tiene operator_commission > 0
  IF service_record.operator_commission <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Servicio sin comisiones configuradas - no requiere sincronización',
      'service_folio', service_record.folio,
      'operator_commission', service_record.operator_commission
    );
  END IF;

  -- Verificar si ya tiene registros en costs
  SELECT COUNT(*) INTO existing_cost_count
  FROM public.costs
  WHERE service_id = p_service_id 
    AND category_id = commission_category_id;

  IF existing_cost_count > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Servicio ya tiene comisiones sincronizadas',
      'service_folio', service_record.folio,
      'existing_costs', existing_cost_count
    );
  END IF;

  -- Obtener recursos del servicio con comisiones
  FOR resource_record IN
    SELECT sr.operator_id, sr.commission_amount, o.name, o.rut
    FROM public.service_resources sr
    JOIN public.operators o ON sr.operator_id = o.id
    WHERE sr.service_id = p_service_id 
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
  LOOP
    -- Crear registro de comisión en costs
    INSERT INTO public.costs (
      service_id,
      category_id,
      operator_id,
      description,
      amount,
      date,
      subcategory,
      service_folio,
      crane_id,
      created_by
    ) VALUES (
      p_service_id,
      commission_category_id,
      resource_record.operator_id,
      'Comisión operador - Servicio ' || service_record.folio,
      resource_record.commission_amount,
      service_record.service_date,
      'comisiones',
      service_record.folio,
      service_record.crane_id,
      auth.uid()
    );

    synced_count := synced_count + 1;
    
    RAISE NOTICE 'Comisión sincronizada: % - % CLP para operador %', 
      service_record.folio, resource_record.commission_amount, resource_record.name;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'service_folio', service_record.folio,
    'service_id', p_service_id,
    'operator_commission', service_record.operator_commission,
    'synced_commissions', synced_count,
    'message', 'Sincronización completada: ' || synced_count || ' comisiones creadas'
  );
END;
$$;