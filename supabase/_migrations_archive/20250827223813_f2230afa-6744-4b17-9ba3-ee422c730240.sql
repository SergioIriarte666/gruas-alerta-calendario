-- LIMPIEZA COMPLETA DE DUPLICADOS DE INVENTARIO
-- Paso 1: Limpiar referencias de crane_parts que apuntan a movimientos duplicados

-- Obtener IDs de movimientos duplicados (posteriores al primero)
WITH duplicated_movements AS (
  SELECT 
    im.id,
    ROW_NUMBER() OVER (
      PARTITION BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
      ORDER BY created_at ASC
    ) as rn
  FROM public.inventory_movements im
  WHERE movement_type = 'entry'
)
-- Limpiar referencias en crane_parts antes de eliminar movimientos
UPDATE public.crane_parts 
SET inventory_movement_id = NULL
WHERE inventory_movement_id IN (
  SELECT id FROM duplicated_movements WHERE rn > 1
);

-- Paso 2: Corregir ortografía de items
UPDATE public.inventory_items 
SET name = 'Mangueras y Adaptadores',
    updated_at = now()
WHERE LOWER(TRIM(name)) = LOWER(TRIM('Magueras Y Adaptadores'));

-- Paso 3: Eliminar movimientos duplicados (conservar solo el más antiguo)
WITH duplicated_movements AS (
  SELECT 
    im.id,
    ROW_NUMBER() OVER (
      PARTITION BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
      ORDER BY created_at ASC
    ) as rn
  FROM public.inventory_movements im
  WHERE movement_type = 'entry'
)
DELETE FROM public.inventory_movements 
WHERE id IN (SELECT id FROM duplicated_movements WHERE rn > 1);

-- Paso 4: Recalcular stock correctamente (sin columnas generadas)
DELETE FROM public.inventory_stock;

INSERT INTO public.inventory_stock (
  item_id, 
  location_id, 
  current_quantity, 
  reserved_quantity,
  last_movement_date,
  created_at,
  updated_at
)
SELECT 
  im.item_id,
  im.location_id,
  COALESCE(SUM(
    CASE 
      WHEN im.movement_type = 'entry' THEN im.quantity
      WHEN im.movement_type = 'exit' THEN -im.quantity
      ELSE 0
    END
  ), 0) as current_quantity,
  0 as reserved_quantity,
  MAX(im.movement_date) as last_movement_date,
  now() as created_at,
  now() as updated_at
FROM public.inventory_movements im
WHERE im.status = 'active'
GROUP BY im.item_id, im.location_id
HAVING COALESCE(SUM(
  CASE 
    WHEN im.movement_type = 'entry' THEN im.quantity
    WHEN im.movement_type = 'exit' THEN -im.quantity
    ELSE 0
  END
), 0) != 0;