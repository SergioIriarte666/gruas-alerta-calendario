-- Create function to migrate legacy crane parts data
CREATE OR REPLACE FUNCTION public.migrate_legacy_crane_parts_data(p_crane_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  migrated_count INTEGER := 0;
  cost_record RECORD;
  new_part_id UUID;
  maintenance_category_id UUID;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones de datos';
  END IF;

  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Migrar costos de "Piezas y Repuestos" que no tienen crane_parts asociado
  FOR cost_record IN 
    SELECT c.*
    FROM public.costs c
    WHERE c.subcategory = 'Piezas y Repuestos'
    AND (p_crane_id IS NULL OR c.crane_id = p_crane_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.crane_parts cp WHERE cp.cost_id = c.id
    )
  LOOP
    -- Crear registro en crane_parts
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      total_value,
      supplier,
      notes,
      cost_id,
      created_by
    ) VALUES (
      cost_record.crane_id,
      COALESCE(cost_record.description, 'Pieza migrada'),
      cost_record.date,
      1, -- cantidad por defecto
      cost_record.amount,
      cost_record.amount,
      'Proveedor no especificado',
      'Registro migrado automáticamente desde costos legacy: ' || COALESCE(cost_record.notes, ''),
      cost_record.id,
      cost_record.created_by
    ) RETURNING id INTO new_part_id;

    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'migrated_records', migrated_count,
    'message', 'Migración completada exitosamente'
  );
END;
$$;

-- Create function to detect duplicate crane parts
CREATE OR REPLACE FUNCTION public.detect_duplicate_crane_parts(p_crane_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  duplicate_count INTEGER := 0;
  total_parts INTEGER := 0;
  total_costs INTEGER := 0;
  linked_costs INTEGER := 0;
BEGIN
  -- Contar total de crane_parts
  SELECT COUNT(*) INTO total_parts
  FROM public.crane_parts
  WHERE (p_crane_id IS NULL OR crane_id = p_crane_id);

  -- Contar costos de "Piezas y Repuestos"
  SELECT COUNT(*) INTO total_costs
  FROM public.costs
  WHERE subcategory = 'Piezas y Repuestos'
  AND (p_crane_id IS NULL OR crane_id = p_crane_id);

  -- Contar costos ya vinculados a crane_parts
  SELECT COUNT(*) INTO linked_costs
  FROM public.costs c
  INNER JOIN public.crane_parts cp ON c.id = cp.cost_id
  WHERE c.subcategory = 'Piezas y Repuestos'
  AND (p_crane_id IS NULL OR c.crane_id = p_crane_id);

  -- Los duplicados potenciales son costos sin vincular
  duplicate_count := total_costs - linked_costs;

  RETURN json_build_object(
    'success', true,
    'duplicate_count', duplicate_count,
    'total_parts', total_parts,
    'total_costs', total_costs,
    'linked_costs', linked_costs,
    'unlinked_costs', duplicate_count,
    'message', CASE 
      WHEN duplicate_count > 0 THEN 
        'Se detectaron ' || duplicate_count || ' costos de piezas sin vincular'
      ELSE 
        'No se detectaron duplicados'
    END
  );
END;
$$;