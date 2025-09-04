-- Sincronizar categorías de proveedores con categorías de costos
-- Agregar las categorías que existen en cost_categories pero faltan en supplier_categories

INSERT INTO public.supplier_categories (name, label, description, is_active)
SELECT 
  LOWER(REPLACE(cc.name, ' ', '_')) as name,
  cc.name as label, 
  cc.description,
  true as is_active
FROM public.cost_categories cc
WHERE cc.name NOT IN (
  SELECT DISTINCT 
    CASE 
      WHEN sc.label = 'Administrativos' THEN 'Administrativos'
      WHEN sc.label = 'Combustible' THEN 'Combustible' 
      WHEN sc.label = 'Leasing Operativo' THEN 'Leasing Operativo'
      WHEN sc.label = 'Mantenimiento' THEN 'Mantenimiento'
      WHEN sc.label = 'Otros' THEN 'Otros'
      WHEN sc.label = 'Seguros' THEN 'Seguros'
      ELSE sc.label
    END
  FROM public.supplier_categories sc 
  WHERE sc.is_active = true
)
AND cc.name NOT IN (
  -- Excluir categorías que no son relevantes para proveedores
  'Comisión Operador',
  'Gastos de Proveedores', 
  'Pagos a Proveedores'
)
ORDER BY cc.name;

-- Verificar que todas las categorías se insertaron correctamente
-- Esta consulta nos mostrará el estado final
SELECT 
  'supplier_categories' as source,
  label as category_name,
  description,
  is_active
FROM public.supplier_categories
WHERE is_active = true

UNION ALL

SELECT 
  'cost_categories' as source,
  name as category_name,
  description,
  true as is_active
FROM public.cost_categories
WHERE name NOT IN ('Comisión Operador', 'Gastos de Proveedores', 'Pagos a Proveedores')

ORDER BY source, category_name;