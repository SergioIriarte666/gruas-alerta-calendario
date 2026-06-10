-- =====================================================
-- PARTE 1: Corrección Inmediata - Comisión Faltante SRV-5792
-- =====================================================

-- Insertar comisión faltante de Jesus Rojas para SRV-5792
INSERT INTO public.costs (
  amount,
  category_id,
  date,
  description,
  service_id,
  service_folio,
  operator_id,
  subcategory,
  created_by
)
SELECT 
  sr.commission_amount,
  (SELECT id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1),
  s.service_date,
  'Comisión por servicio: ' || COALESCE(o.name, 'Operador') || ' [Sincronización manual]',
  s.id,
  s.folio,
  sr.operator_id,
  'comisiones',
  s.created_by
FROM public.service_resources sr
JOIN public.services s ON sr.service_id = s.id
LEFT JOIN public.operators o ON sr.operator_id = o.id
WHERE s.folio = 'SRV-5792'
  AND sr.commission_amount > 0
  AND sr.operator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.costs c 
    WHERE c.service_id = s.id 
      AND c.operator_id = sr.operator_id
      AND c.category_id = (SELECT id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1)
  );

-- =====================================================
-- PARTE 2: Actualizar Función de Sincronización
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_missing_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commission_category_id UUID;
  services_processed INTEGER := 0;
  commissions_created INTEGER := 0;
  service_record RECORD;
  resource_record RECORD;
  operator_name TEXT;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  IF commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de comisiones no encontrada'
    );
  END IF;
  
  -- Buscar servicios con comisiones en service_resources pero sin costos correspondientes
  -- CAMBIO CRÍTICO: Ahora considera TODOS los estados relevantes, no solo 'completed'
  FOR service_record IN 
    SELECT DISTINCT s.id, s.folio, s.service_date, s.created_by
    FROM public.services s
    INNER JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE sr.commission_amount > 0 
      AND sr.operator_id IS NOT NULL
      AND s.status IN ('completed', 'with_purchase_order', 'invoiced', 'scheduled', 'in_progress')
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c 
        WHERE c.service_id = s.id 
          AND c.operator_id = sr.operator_id
          AND c.category_id = commission_category_id
      )
  LOOP
    services_processed := services_processed + 1;
    
    -- Procesar cada operador con comisión en este servicio
    FOR resource_record IN 
      SELECT sr.operator_id, sr.commission_amount, o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = service_record.id
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.costs c 
          WHERE c.service_id = service_record.id 
            AND c.operator_id = sr.operator_id
            AND c.category_id = commission_category_id
        )
    LOOP
      -- Insertar comisión faltante
      INSERT INTO public.costs (
        amount,
        category_id,
        date,
        description,
        service_id,
        service_folio,
        operator_id,
        subcategory,
        created_by
      ) VALUES (
        resource_record.commission_amount,
        commission_category_id,
        service_record.service_date,
        'Comisión por servicio: ' || COALESCE(resource_record.operator_name, 'Operador') || ' [Sincronización automática]',
        service_record.id,
        service_record.folio,
        resource_record.operator_id,
        'comisiones',
        service_record.created_by
      );
      
      commissions_created := commissions_created + 1;
      
      RAISE NOTICE 'Comisión creada: Servicio %, Operador %, Monto $%', 
        service_record.folio, resource_record.operator_name, resource_record.commission_amount;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'services_processed', services_processed,
    'commissions_created', commissions_created,
    'message', format('Sincronización completada: %s comisiones creadas en %s servicios', commissions_created, services_processed)
  );
END;
$$;