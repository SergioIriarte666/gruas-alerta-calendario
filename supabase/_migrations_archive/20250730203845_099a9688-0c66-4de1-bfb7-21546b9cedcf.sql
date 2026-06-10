-- Función para calcular total_value antes de insertar
CREATE OR REPLACE FUNCTION public.calculate_crane_part_total_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calcular total_value si no está definido o es 0
  IF NEW.total_value IS NULL OR NEW.total_value = 0 THEN
    NEW.total_value := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_price, 0);
  END IF;
  
  -- Validar que tenemos valores válidos
  IF NEW.total_value <= 0 THEN
    RAISE WARNING 'total_value calculado es <= 0 para pieza: %. quantity: %, unit_price: %', 
      NEW.part_name, NEW.quantity, NEW.unit_price;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función mejorada para crear costos con validación
CREATE OR REPLACE FUNCTION public.create_cost_for_crane_part_conditional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
  calculated_amount NUMERIC;
BEGIN
  -- Si ya tiene cost_id asociado, no crear uno nuevo
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular amount usando total_value (que ya debería estar calculado por el trigger anterior)
  calculated_amount := COALESCE(NEW.total_value, NEW.quantity * NEW.unit_price, 0);
  
  -- Validar que el amount sea válido
  IF calculated_amount <= 0 THEN
    RAISE WARNING 'No se puede crear costo con amount <= 0 para pieza: %. total_value: %, quantity: %, unit_price: %', 
      NEW.part_name, NEW.total_value, NEW.quantity, NEW.unit_price;
    RETURN NEW;
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Si no existe categoría de mantenimiento, crearla
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Crear registro de costo
  INSERT INTO public.costs (
    amount,
    category_id,
    crane_id,
    date,
    description,
    notes,
    subcategory,
    created_by
  ) VALUES (
    calculated_amount,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Asignar el cost_id al registro de crane_parts
  NEW.cost_id := new_cost_id;

  RAISE NOTICE 'Costo creado exitosamente: ID %, amount: % para pieza: %', new_cost_id, calculated_amount, NEW.part_name;

  RETURN NEW;
END;
$$;

-- Recrear triggers en el orden correcto
DROP TRIGGER IF EXISTS trigger_calculate_crane_part_total_value ON public.crane_parts;
DROP TRIGGER IF EXISTS trigger_create_cost_for_crane_part ON public.crane_parts;
DROP TRIGGER IF EXISTS sync_parts_purchase_trigger ON public.crane_parts;

-- 1. Primero calcular total_value
CREATE TRIGGER trigger_calculate_crane_part_total_value
  BEFORE INSERT OR UPDATE ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_crane_part_total_value();

-- 2. Luego crear el costo (con total_value ya calculado)
CREATE TRIGGER trigger_create_cost_for_crane_part
  BEFORE INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_for_crane_part_conditional();

-- 3. Finalmente sincronizar con inventario
CREATE TRIGGER sync_parts_purchase_trigger
  AFTER INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parts_purchase_to_inventory();