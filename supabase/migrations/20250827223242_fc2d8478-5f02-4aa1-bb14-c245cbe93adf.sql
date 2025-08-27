-- LIMPIEZA COMPLETA DE DUPLICADOS DE INVENTARIO
-- Paso 1: Consolidar items con nombres similares

-- Corregir ortografía: "Magueras Y Adaptadores" → "Mangueras y Adaptadores"
UPDATE public.inventory_items 
SET name = 'Mangueras y Adaptadores',
    updated_at = now()
WHERE LOWER(TRIM(name)) = LOWER(TRIM('Magueras Y Adaptadores'));

-- Paso 2: Eliminar duplicados exactos de inventory_movements
-- Conservar solo el registro más antiguo de cada grupo duplicado

-- Crear tabla temporal con IDs a conservar (los más antiguos)
CREATE TEMP TABLE movements_to_keep AS
SELECT 
  id,
  ROW_NUMBER() OVER (
    PARTITION BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
    ORDER BY created_at ASC
  ) as rn
FROM public.inventory_movements
WHERE movement_type = 'entry';

-- Eliminar duplicados (conservar solo rn = 1)
DELETE FROM public.inventory_movements 
WHERE id IN (
  SELECT im.id 
  FROM public.inventory_movements im
  JOIN movements_to_keep mtk ON im.id = mtk.id
  WHERE mtk.rn > 1
);

-- Paso 3: Verificar y limpiar registros huérfanos en crane_parts
-- que puedan estar referenciando movimientos eliminados
UPDATE public.crane_parts 
SET inventory_movement_id = NULL
WHERE inventory_movement_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements 
    WHERE id = crane_parts.inventory_movement_id
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

-- Paso 5: Verificación final - Query para mostrar resultado
-- (Esto se ejecuta pero no afecta datos, solo para logging)
DO $$
DECLARE
  duplicate_count INTEGER;
  item_count INTEGER;
  stock_items INTEGER;
BEGIN
  -- Contar duplicados restantes
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0), COUNT(*) as cnt
    FROM public.inventory_movements
    WHERE movement_type = 'entry'
    GROUP BY item_id, movement_date::date, COALESCE(unit_cost, 0), movement_type, COALESCE(quantity, 0)
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Contar items totales
  SELECT COUNT(*) INTO item_count FROM public.inventory_items;
  
  -- Contar items en stock
  SELECT COUNT(*) INTO stock_items FROM public.inventory_stock;
  
  RAISE NOTICE 'LIMPIEZA COMPLETADA:';
  RAISE NOTICE '- Duplicados restantes: %', duplicate_count;
  RAISE NOTICE '- Items de inventario: %', item_count;
  RAISE NOTICE '- Items con stock: %', stock_items;
  RAISE NOTICE '- Nombres corregidos: Magueras → Mangueras y Adaptadores';
END $$;