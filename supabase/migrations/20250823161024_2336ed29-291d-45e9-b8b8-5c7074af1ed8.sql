-- PLAN DE CORRECCIÓN: Resolver Conflicto de Triggers de Mantenimiento

-- 1. ELIMINAR TRIGGER DUPLICADO ORIGINAL
DROP TRIGGER IF EXISTS create_maintenance_cost_trigger ON public.crane_maintenance;

-- 2. FUNCIÓN PARA CORREGIR COSTOS EXISTENTES SIN MAINTENANCE_ID
CREATE OR REPLACE FUNCTION public.fix_unlinked_maintenance_costs()
RETURNS JSONB AS $$
DECLARE
  fixed_count INTEGER := 0;
  duplicate_count INTEGER := 0;
  cost_record RECORD;
  maintenance_id_found UUID;
BEGIN
  -- Buscar costos de mantenimiento sin maintenance_id
  FOR cost_record IN 
    SELECT c.* 
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento' 
      AND c.maintenance_id IS NULL
      AND c.description ILIKE 'Mantenimiento:%'
  LOOP
    -- Intentar encontrar el mantenimiento correspondiente por descripción y fecha
    SELECT cm.id INTO maintenance_id_found
    FROM public.crane_maintenance cm
    WHERE cm.crane_id = cost_record.crane_id
      AND cm.cost = cost_record.amount
      AND cm.status = 'completed'
      AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400 -- Mismo día
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c2 WHERE c2.maintenance_id = cm.id
      )
    ORDER BY ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp)))
    LIMIT 1;
    
    IF maintenance_id_found IS NOT NULL THEN
      -- Vincular el costo existente
      UPDATE public.costs 
      SET maintenance_id = maintenance_id_found,
          notes = COALESCE(notes, '') || ' [Vinculado automáticamente]'
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      RAISE NOTICE 'Vinculado costo % con mantenimiento %', cost_record.id, maintenance_id_found;
    ELSE
      -- Si no encuentra mantenimiento, verificar si es duplicado
      IF EXISTS (
        SELECT 1 FROM public.costs c2
        WHERE c2.id != cost_record.id
          AND c2.crane_id = cost_record.crane_id
          AND c2.amount = cost_record.amount
          AND c2.date = cost_record.date
          AND c2.maintenance_id IS NOT NULL
      ) THEN
        -- Eliminar duplicado
        DELETE FROM public.costs WHERE id = cost_record.id;
        duplicate_count := duplicate_count + 1;
        RAISE NOTICE 'Eliminado costo duplicado %', cost_record.id;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_costs', fixed_count,
    'removed_duplicates', duplicate_count,
    'message', format('Corregidos %s costos, eliminados %s duplicados', fixed_count, duplicate_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. EJECUTAR CORRECCIÓN
SELECT public.fix_unlinked_maintenance_costs();

-- 4. VERIFICAR QUE EL TRIGGER CORRECTO ESTÉ ACTIVO
-- (El trigger create_cost_from_maintenance_trigger ya existe de la migración anterior)

-- 5. EJECUTAR SINCRONIZACIÓN PARA MANTENIMIENTOS PENDIENTES
SELECT public.sync_maintenance_costs();

-- 6. FUNCIÓN DE DIAGNÓSTICO PARA VERIFICAR INTEGRIDAD
CREATE OR REPLACE FUNCTION public.diagnose_maintenance_cost_integration()
RETURNS JSONB AS $$
DECLARE
  completed_maintenances INTEGER;
  linked_costs INTEGER;
  unlinked_costs INTEGER;
  orphaned_costs INTEGER;
BEGIN
  -- Contar mantenimientos completados con costo
  SELECT COUNT(*) INTO completed_maintenances
  FROM public.crane_maintenance 
  WHERE status = 'completed' AND cost > 0;
  
  -- Contar costos vinculados correctamente
  SELECT COUNT(*) INTO linked_costs
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NOT NULL;
  
  -- Contar costos de mantenimiento sin vincular
  SELECT COUNT(*) INTO unlinked_costs
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NULL;
  
  -- Contar costos vinculados a mantenimientos inexistentes
  SELECT COUNT(*) INTO orphaned_costs
  FROM public.costs c
  WHERE c.maintenance_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.crane_maintenance cm WHERE cm.id = c.maintenance_id);
  
  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'integration_health', CASE 
      WHEN unlinked_costs = 0 AND orphaned_costs = 0 THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END,
    'statistics', jsonb_build_object(
      'completed_maintenances_with_cost', completed_maintenances,
      'linked_costs', linked_costs,
      'unlinked_costs', unlinked_costs,
      'orphaned_costs', orphaned_costs
    ),
    'message', CASE 
      WHEN unlinked_costs = 0 AND orphaned_costs = 0 
      THEN 'Integración funcionando correctamente'
      ELSE format('Se encontraron %s costos sin vincular y %s costos huérfanos', unlinked_costs, orphaned_costs)
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. EJECUTAR DIAGNÓSTICO
SELECT public.diagnose_maintenance_cost_integration();