-- Consolidación de registros duplicados de "Mangueras y Adaptadores"
-- Migrar movimientos del duplicado al original

-- Paso 1: Actualizar movimientos de inventario del duplicado al original
UPDATE public.inventory_movements 
SET item_id = '73e7e30a-aaaa-4b8a-9c8d-1e2f3g4h5i6j'
WHERE item_id = '636858cd-bbbb-4c8d-9e10-1f2g3h4i5j6k';

-- Paso 2: Consolidar stock en el item original
-- Primero eliminar stock del duplicado
DELETE FROM public.inventory_stock 
WHERE item_id = '636858cd-bbbb-4c8d-9e10-1f2g3h4i5j6k';

-- Recalcular stock del item original basado en movimientos
WITH stock_calculation AS (
  SELECT 
    item_id,
    location_id,
    COALESCE(SUM(CASE WHEN movement_type = 'entry' THEN quantity ELSE -quantity END), 0) as calculated_quantity
  FROM public.inventory_movements 
  WHERE item_id = '73e7e30a-aaaa-4b8a-9c8d-1e2f3g4h5i6j'
    AND status = 'active'
  GROUP BY item_id, location_id
)
INSERT INTO public.inventory_stock (item_id, location_id, current_quantity, available_quantity, reserved_quantity, last_movement_date, created_at, updated_at)
SELECT 
  sc.item_id,
  sc.location_id,
  sc.calculated_quantity,
  sc.calculated_quantity,
  0,
  NOW(),
  NOW(),
  NOW()
FROM stock_calculation sc
ON CONFLICT (item_id, location_id) 
DO UPDATE SET 
  current_quantity = EXCLUDED.current_quantity,
  available_quantity = EXCLUDED.available_quantity,
  updated_at = NOW(),
  last_movement_date = NOW();

-- Paso 3: Actualizar referencias en crane_parts si existen
UPDATE public.crane_parts cp
SET inventory_movement_id = im_new.id
FROM public.inventory_movements im_old
JOIN public.inventory_movements im_new ON (
  im_new.item_id = '73e7e30a-aaaa-4b8a-9c8d-1e2f3g4h5i6j' 
  AND im_new.movement_date = im_old.movement_date
  AND im_new.quantity = im_old.quantity
  AND im_new.movement_type = im_old.movement_type
)
WHERE cp.inventory_movement_id = im_old.id
  AND im_old.item_id = '636858cd-bbbb-4c8d-9e10-1f2g3h4i5j6k';

-- Paso 4: Eliminar el item duplicado
DELETE FROM public.inventory_items 
WHERE id = '636858cd-bbbb-4c8d-9e10-1f2g3h4i5j6k';

-- Paso 5: Verificación - mostrar resultado final
SELECT 
  'Consolidación completada' as status,
  (SELECT COUNT(*) FROM public.inventory_items WHERE name ILIKE '%mangueras%adaptadores%') as items_restantes,
  (SELECT COUNT(*) FROM public.inventory_movements WHERE item_id = '73e7e30a-aaaa-4b8a-9c8d-1e2f3g4h5i6j') as movimientos_totales,
  (SELECT COALESCE(SUM(current_quantity), 0) FROM public.inventory_stock WHERE item_id = '73e7e30a-aaaa-4b8a-9c8d-1e2f3g4h5i6j') as stock_final;