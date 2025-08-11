
-- Agregar columnas de referencia para bidireccionalidad
ALTER TABLE public.crane_parts 
ADD COLUMN inventory_movement_id uuid REFERENCES public.inventory_movements(id);

ALTER TABLE public.costs 
ADD COLUMN inventory_movement_id uuid REFERENCES public.inventory_movements(id);

-- Crear tabla de mapeo entre costos e items de inventario
CREATE TABLE public.cost_inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_id uuid NOT NULL REFERENCES public.costs(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(cost_id, inventory_item_id)
);

-- Habilitar RLS en la nueva tabla
ALTER TABLE public.cost_inventory_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para cost_inventory_items
CREATE POLICY "cost_inventory_items_select_policy" 
  ON public.cost_inventory_items 
  FOR SELECT 
  USING (true);

CREATE POLICY "cost_inventory_items_modify_policy" 
  ON public.cost_inventory_items 
  FOR ALL 
  USING (is_operator_user());

-- Función para sincronizar automáticamente compras de piezas con inventario
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Obtener ubicación por defecto (primera activa)
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una por defecto
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Buscar o crear item de inventario basado en el nombre de la pieza
  SELECT id INTO inventory_item_id
  FROM public.inventory_items
  WHERE LOWER(name) = LOWER(NEW.part_name)
  AND is_active = true
  LIMIT 1;

  -- Si no existe el item, crearlo
  IF inventory_item_id IS NULL THEN
    INSERT INTO public.inventory_items (
      name,
      description,
      unit_of_measure,
      unit_cost,
      minimum_stock,
      is_active,
      created_by
    ) VALUES (
      NEW.part_name,
      'Auto-creado desde compra de pieza para grúa',
      'unidad',
      NEW.unit_price,
      1,
      true,
      NEW.created_by
    )
    RETURNING id INTO inventory_item_id;
  END IF;

  -- Crear movimiento de entrada al inventario
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    supplier_name,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    inventory_item_id,
    location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.supplier,
    'Compra de pieza para grúa - Pieza ID: ' || NEW.id,
    'Movimiento automático generado desde compra de pieza',
    NEW.date,
    'active',
    NEW.created_by
  )
  RETURNING id INTO movement_id;

  -- Actualizar crane_parts con referencia al movimiento
  NEW.inventory_movement_id := movement_id;

  -- Crear mapeo en cost_inventory_items si existe cost_id
  IF NEW.cost_id IS NOT NULL THEN
    INSERT INTO public.cost_inventory_items (
      cost_id,
      inventory_item_id,
      quantity,
      unit_cost,
      created_by
    ) VALUES (
      NEW.cost_id,
      inventory_item_id,
      NEW.quantity,
      NEW.unit_price,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear trigger para sincronización automática
CREATE TRIGGER sync_parts_purchase_trigger
  BEFORE INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parts_purchase_to_inventory();

-- Función para crear movimiento de salida cuando se consume una pieza
CREATE OR REPLACE FUNCTION public.create_inventory_consumption_movement(
  p_inventory_item_id UUID,
  p_quantity INTEGER,
  p_crane_id UUID,
  p_operator_id UUID DEFAULT NULL,
  p_reference_document TEXT DEFAULT NULL,
  p_observations TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Crear movimiento de salida
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    crane_id,
    operator_id,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    p_inventory_item_id,
    location_id,
    'exit',
    p_quantity,
    p_crane_id,
    p_operator_id,
    p_reference_document,
    p_observations,
    CURRENT_DATE,
    'active',
    auth.uid()
  )
  RETURNING id INTO movement_id;

  RETURN movement_id;
END;
$function$;

-- Función para obtener trazabilidad completa de una pieza
CREATE OR REPLACE FUNCTION public.get_parts_traceability(p_crane_id UUID DEFAULT NULL)
RETURNS TABLE(
  part_id UUID,
  part_name TEXT,
  supplier TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC,
  inventory_item_id UUID,
  inventory_item_name TEXT,
  current_stock INTEGER,
  total_purchased INTEGER,
  total_consumed INTEGER,
  crane_license_plate TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id as part_id,
    cp.part_name,
    cp.supplier,
    cp.date as purchase_date,
    cp.total_value as purchase_cost,
    ii.id as inventory_item_id,
    ii.name as inventory_item_name,
    COALESCE(stock.current_quantity, 0) as current_stock,
    COALESCE(purchases.total_purchased, 0) as total_purchased,
    COALESCE(consumptions.total_consumed, 0) as total_consumed,
    c.license_plate as crane_license_plate
  FROM public.crane_parts cp
  LEFT JOIN public.inventory_movements im_entry ON cp.inventory_movement_id = im_entry.id
  LEFT JOIN public.inventory_items ii ON im_entry.item_id = ii.id
  LEFT JOIN public.cranes c ON cp.crane_id = c.id
  LEFT JOIN (
    SELECT 
      item_id,
      SUM(current_quantity) as current_quantity
    FROM public.inventory_stock
    GROUP BY item_id
  ) stock ON ii.id = stock.item_id
  LEFT JOIN (
    SELECT 
      item_id,
      SUM(quantity) as total_purchased
    FROM public.inventory_movements
    WHERE movement_type = 'entry'
    GROUP BY item_id
  ) purchases ON ii.id = purchases.item_id
  LEFT JOIN (
    SELECT 
      item_id,
      SUM(quantity) as total_consumed
    FROM public.inventory_movements
    WHERE movement_type = 'exit'
    GROUP BY item_id
  ) consumptions ON ii.id = consumptions.item_id
  WHERE (p_crane_id IS NULL OR cp.crane_id = p_crane_id)
  ORDER BY cp.date DESC;
END;
$function$;
