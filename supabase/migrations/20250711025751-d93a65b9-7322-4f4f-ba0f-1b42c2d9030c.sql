-- Modificar el trigger para que no se ejecute cuando ya existe cost_id
DROP TRIGGER IF EXISTS crane_parts_create_cost ON public.crane_parts;

-- Crear nuevo trigger que solo se ejecuta si NO hay cost_id
CREATE OR REPLACE FUNCTION public.create_cost_for_crane_part_conditional()
RETURNS TRIGGER AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Solo ejecutar si NO hay cost_id (evitar duplicación)
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the maintenance category ID
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- If no maintenance category exists, create one
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Create cost entry
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
    NEW.total_value,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Update the crane_part with the cost_id reference
  NEW.cost_id := new_cost_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear nuevo trigger condicional
CREATE TRIGGER crane_parts_create_cost_conditional
  BEFORE INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_for_crane_part_conditional();