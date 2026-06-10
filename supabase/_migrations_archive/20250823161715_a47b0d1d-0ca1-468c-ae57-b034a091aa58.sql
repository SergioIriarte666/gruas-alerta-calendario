-- RECREAR EL TRIGGER PARA MANTENIMIENTOS Y CREAR COSTO FALTANTE

-- 1. Recrear el trigger que faltó en la migración anterior
CREATE OR REPLACE TRIGGER create_cost_from_maintenance_trigger
  AFTER UPDATE ON public.crane_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_maintenance();

-- 2. Crear manualmente el costo para el mantenimiento específico que falta
DO $$
DECLARE
  maintenance_category_id UUID;
  maintenance_record RECORD;
BEGIN
  -- Obtener el mantenimiento específico
  SELECT * INTO maintenance_record
  FROM public.crane_maintenance
  WHERE id = '56935de4-be8e-44a3-8303-f0a048f55588'::uuid;
  
  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name = 'Mantenimiento'
  LIMIT 1;
  
  -- Si no existe la categoría, crearla
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
    RETURNING id INTO maintenance_category_id;
  END IF;
  
  -- Crear el costo faltante si no existe
  IF NOT EXISTS (SELECT 1 FROM public.costs WHERE maintenance_id = maintenance_record.id) THEN
    INSERT INTO public.costs (
      amount,
      category_id,
      crane_id,
      date,
      description,
      notes,
      subcategory,
      maintenance_id,
      created_by
    ) VALUES (
      maintenance_record.cost,
      maintenance_category_id,
      maintenance_record.crane_id,
      COALESCE(maintenance_record.completed_date, maintenance_record.scheduled_date, CURRENT_DATE),
      'Mantenimiento: ' || maintenance_record.description,
      'Costo creado manualmente para corregir integración',
      'Reparaciones',
      maintenance_record.id,
      maintenance_record.created_by
    );
    
    RAISE NOTICE 'Costo creado para mantenimiento: %', maintenance_record.id;
  END IF;
END $$;

-- 3. Ejecutar corrección para otros mantenimientos pendientes
SELECT public.fix_unlinked_maintenance_costs();

-- 4. Verificar el estado final
SELECT public.diagnose_maintenance_cost_integration();