-- Limpiar registros con SKU duplicado vacío
-- Primero, actualizamos todos los SKU vacíos a NULL
UPDATE public.inventory_items 
SET sku = NULL 
WHERE sku = '';

-- Después, si hay duplicados con NULL, mantenemos solo el más reciente
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY sku ORDER BY created_at DESC) as rn
  FROM public.inventory_items 
  WHERE sku IS NULL
)
DELETE FROM public.inventory_items 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);