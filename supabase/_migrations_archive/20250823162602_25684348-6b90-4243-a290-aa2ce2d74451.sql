-- SOLUCION GLOBAL MEJORADA: Función de vinculación inteligente
CREATE OR REPLACE FUNCTION public.smart_link_maintenance_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  fixed_count INTEGER := 0;
  cost_record RECORD;
  maintenance_record RECORD;
  maintenance_category_id UUID;
BEGIN
  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories 
  WHERE name = 'Mantenimiento'
  LIMIT 1;
  
  IF maintenance_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de mantenimiento no encontrada'
    );
  END IF;

  -- Vincular costos huérfanos con mantenimientos
  FOR cost_record IN 
    SELECT c.* 
    FROM public.costs c
    WHERE c.category_id = maintenance_category_id 
      AND c.maintenance_id IS NULL
  LOOP
    -- Buscar mantenimiento correspondiente con criterios flexibles
    SELECT cm.* INTO maintenance_record
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed'
      AND cm.cost > 0
      AND (
        -- Criterio 1: Coincidencia exacta ideal
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost = cost_record.amount 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400)
        OR
        -- Criterio 2: Misma grúa y monto, fecha flexible (una semana)
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost = cost_record.amount 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 604800)
        OR
        -- Criterio 3: Misma grúa, fechas cercanas, monto similar (±10%)
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost BETWEEN cost_record.amount * 0.9 AND cost_record.amount * 1.1
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400)
        OR
        -- Criterio 4: Por descripción similar y grúa
        (cm.crane_id = cost_record.crane_id 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400
         AND (cost_record.description ILIKE '%' || LEFT(cm.description, 20) || '%' 
              OR cm.description ILIKE '%' || LEFT(cost_record.description, 20) || '%'))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c2 WHERE c2.maintenance_id = cm.id
      )
    ORDER BY 
      -- Priorizar coincidencias más exactas
      CASE 
        WHEN cm.crane_id = cost_record.crane_id AND cm.cost = cost_record.amount 
             AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400 
        THEN 1
        WHEN cm.crane_id = cost_record.crane_id AND cm.cost = cost_record.amount 
        THEN 2
        WHEN cm.crane_id = cost_record.crane_id 
             AND cm.cost BETWEEN cost_record.amount * 0.9 AND cost_record.amount * 1.1 
        THEN 3
        ELSE 4
      END,
      ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp)))
    LIMIT 1;
    
    -- Si encontró un mantenimiento, vincularlo
    IF maintenance_record.id IS NOT NULL THEN
      UPDATE public.costs 
      SET 
        maintenance_id = maintenance_record.id,
        notes = COALESCE(notes, '') || ' [Vinculado automáticamente con algoritmo inteligente]',
        updated_at = NOW()
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Vinculado costo % (%) con mantenimiento % (%)', 
        cost_record.id, cost_record.amount, maintenance_record.id, maintenance_record.description;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'linked_costs', fixed_count,
    'message', format('Vinculados %s costos con mantenimientos usando algoritmo inteligente', fixed_count)
  );
END;
$$;

-- Ejecutar la función de vinculación inteligente
SELECT public.smart_link_maintenance_costs();

-- Verificar el resultado final
SELECT 
  'Resultado Final' as status,
  'Mantenimientos Completados' as categoria,
  COUNT(*) as cantidad
FROM public.crane_maintenance 
WHERE status = 'completed' AND cost > 0

UNION ALL

SELECT 
  'Resultado Final' as status,
  'Costos Vinculados' as categoria,
  COUNT(*) as cantidad
FROM public.costs c
JOIN public.cost_categories cc ON c.category_id = cc.id
WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NOT NULL

UNION ALL

SELECT 
  'Resultado Final' as status,
  'Costos Pendientes' as categoria,
  COUNT(*) as cantidad
FROM public.costs c
JOIN public.cost_categories cc ON c.category_id = cc.id
WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NULL;