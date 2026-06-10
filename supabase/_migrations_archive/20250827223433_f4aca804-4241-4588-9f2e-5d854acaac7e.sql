-- LIMPIEZA COMPLETA DE DUPLICADOS DE INVENTARIO
-- Paso 1: Limpiar referencias primero para evitar violaciones de clave foránea

-- Identificar y limpiar crane_parts que referencian movimientos duplicados
UPDATE public.crane_parts 
SET inventory_movement_id = NULL
WHERE inventory_movement_id IN (
  SELECT im.id 
  FROM public.inventory_movements im
  JOIN (
    SELECT 
      item_id, 
      movement_date::date, 
      COALESCE(unit_cost, 0) as unit_cost, 
      movement_type, 
      COALESCE(quantity, 0) as quantity,
      MIN(created_at) as first_created
    FROM public.inventory_movements
    WHERE movement_type = 'entry'
    GROUP BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
    HAVING COUNT(*) > 1
  ) duplicates ON (
    im.item_id = duplicates.item_id 
    AND im.movement_date::date = duplicates.movement_date
    AND COALESCE(im.unit_cost, 0) = duplicates.unit_cost
    AND im.movement_type = duplicates.movement_type
    AND COALESCE(im.quantity, 0) = duplicates.quantity
    AND im.created_at > duplicates.first_created -- Solo los duplicados posteriores
  )
);

-- Paso 2: Corregir ortografía: "Magueras Y Adaptadores" → "Mangueras y Adaptadores"
UPDATE public.inventory_items 
SET name = 'Mangueras y Adaptadores',
    updated_at = now()
WHERE LOWER(TRIM(name)) = LOWER(TRIM('Magueras Y Adaptadores'));

-- Paso 3: Eliminar duplicados exactos de inventory_movements
-- Conservar solo el registro más antiguo de cada grupo duplicado
DELETE FROM public.inventory_movements 
WHERE id IN (
  SELECT im.id 
  FROM public.inventory_movements im
  JOIN (
    SELECT 
      item_id, 
      movement_date::date, 
      COALESCE(unit_cost, 0) as unit_cost, 
      movement_type, 
      COALESCE(quantity, 0) as quantity,
      MIN(created_at) as first_created
    FROM public.inventory_movements
    WHERE movement_type = 'entry'
    GROUP BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
    HAVING COUNT(*) > 1
  ) duplicates ON (
    im.item_id = duplicates.item_id 
    AND im.movement_date::date = duplicates.movement_date
    AND COALESCE(im.unit_cost, 0) = duplicates.unit_cost
    AND im.movement_type = duplicates.movement_type
    AND COALESCE(im.quantity, 0) = duplicates.quantity
    AND im.created_at > duplicates.first_created -- Solo eliminar los posteriores
  )
);

-- Paso 4: Recalcular stock de inventario tras la limpieza
-- Eliminar registros de stock existentes
DELETE FROM public.inventory_stock;

-- Regenerar stock basado en movimientos limpios
INSERT INTO public.inventory_stock (
  item_id, 
  location_id, 
  current_quantity, 
  available_quantity, 
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
  COALESCE(SUM(
    CASE 
      WHEN im.movement_type = 'entry' THEN im.quantity
      WHEN im.movement_type = 'exit' THEN -im.quantity
      ELSE 0
    END
  ), 0) as available_quantity,
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