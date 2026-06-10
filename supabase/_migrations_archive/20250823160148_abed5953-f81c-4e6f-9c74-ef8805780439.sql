-- 1. Add maintenance_id field to costs table to link maintenance records
ALTER TABLE public.costs ADD COLUMN maintenance_id UUID REFERENCES public.crane_maintenance(id);

-- 2. Create index for better performance
CREATE INDEX idx_costs_maintenance_id ON public.costs(maintenance_id);

-- 3. Create trigger function to automatically create costs when maintenance is completed
CREATE OR REPLACE FUNCTION public.create_cost_from_maintenance()
RETURNS TRIGGER AS $$
DECLARE
  maintenance_category_id UUID;
  cost_description TEXT;
  cost_subcategory TEXT;
BEGIN
  -- Only create cost when maintenance changes to 'completed' status and has cost > 0
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.cost > 0 THEN
    
    -- Get or create maintenance category
    SELECT id INTO maintenance_category_id
    FROM public.cost_categories
    WHERE name = 'Mantenimiento'
    LIMIT 1;
    
    -- If category doesn't exist, create it
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
      RETURNING id INTO maintenance_category_id;
    END IF;
    
    -- Build description
    cost_description := 'Mantenimiento: ' || NEW.description;
    IF NEW.provider IS NOT NULL THEN
      cost_description := cost_description || ' - Proveedor: ' || NEW.provider;
    END IF;
    
    -- Determine subcategory based on maintenance type
    cost_subcategory := CASE 
      WHEN NEW.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
      WHEN NEW.maintenance_type ILIKE '%correctivo%' OR NEW.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
      WHEN NEW.maintenance_type ILIKE '%repuesto%' OR NEW.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
      WHEN NEW.maintenance_type ILIKE '%revision%' OR NEW.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
      ELSE 'Mantenimiento General'
    END;
    
    -- Check if cost already exists for this maintenance
    IF NOT EXISTS (SELECT 1 FROM public.costs WHERE maintenance_id = NEW.id) THEN
      -- Create the cost record
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
        NEW.cost,
        maintenance_category_id,
        NEW.crane_id,
        COALESCE(NEW.completed_date, NEW.scheduled_date, CURRENT_DATE),
        cost_description,
        CASE 
          WHEN NEW.notes IS NOT NULL THEN 'Mantenimiento automático: ' || NEW.notes
          ELSE 'Costo generado automáticamente desde mantenimiento'
        END,
        cost_subcategory,
        NEW.id,
        COALESCE(NEW.created_by, auth.uid())
      );
      
      RAISE NOTICE 'Costo creado automáticamente para mantenimiento: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS create_cost_from_maintenance_trigger ON public.crane_maintenance;
CREATE TRIGGER create_cost_from_maintenance_trigger
  AFTER UPDATE ON public.crane_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_maintenance();

-- 5. Sync existing completed maintenances that don't have associated costs
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
)
SELECT 
  cm.cost,
  (SELECT id FROM public.cost_categories WHERE name = 'Mantenimiento' LIMIT 1),
  cm.crane_id,
  COALESCE(cm.completed_date, cm.scheduled_date, cm.created_at::date),
  'Mantenimiento: ' || cm.description || 
  CASE WHEN cm.provider IS NOT NULL THEN ' - Proveedor: ' || cm.provider ELSE '' END,
  'Costo migrado automáticamente desde mantenimiento histórico' ||
  CASE WHEN cm.notes IS NOT NULL THEN '. Notas: ' || cm.notes ELSE '' END,
  CASE 
    WHEN cm.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
    WHEN cm.maintenance_type ILIKE '%correctivo%' OR cm.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
    WHEN cm.maintenance_type ILIKE '%repuesto%' OR cm.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
    WHEN cm.maintenance_type ILIKE '%revision%' OR cm.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
    ELSE 'Mantenimiento General'
  END,
  cm.id,
  cm.created_by
FROM public.crane_maintenance cm
WHERE cm.status = 'completed' 
  AND cm.cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.costs c WHERE c.maintenance_id = cm.id
  );

-- 6. Create function to get maintenance with associated cost
CREATE OR REPLACE FUNCTION public.get_maintenance_with_cost(maintenance_id_param UUID)
RETURNS TABLE(
  maintenance_id UUID,
  maintenance_description TEXT,
  maintenance_cost NUMERIC,
  maintenance_status TEXT,
  cost_id UUID,
  cost_amount NUMERIC,
  cost_description TEXT,
  cost_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.description,
    cm.cost,
    cm.status,
    c.id,
    c.amount,
    c.description,
    c.date
  FROM public.crane_maintenance cm
  LEFT JOIN public.costs c ON cm.id = c.maintenance_id
  WHERE cm.id = maintenance_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;