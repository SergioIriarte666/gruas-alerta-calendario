
-- Crear categoría "Comisión Operador" si no existe
INSERT INTO public.cost_categories (name, description)
SELECT 'Comisión Operador', 'Comisiones pagadas a operadores por servicios realizados'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_categories WHERE name = 'Comisión Operador'
);
