-- Actualizar registros existentes de "Otros" a "Viatico" en gastos de servicios
UPDATE public.costs 
SET subcategory = 'Viatico', updated_at = now()
WHERE subcategory = 'Otros' 
  AND category_id IN (
    SELECT id FROM public.cost_categories 
    WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%'
  );