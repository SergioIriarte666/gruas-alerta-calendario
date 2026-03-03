-- Insertar subcategorías de "Gastos de Servicios" si no existen
DO $$
DECLARE
  v_cat_id uuid;
BEGIN
  SELECT id INTO v_cat_id FROM public.cost_categories WHERE name = 'Gastos de Servicios' LIMIT 1;
  
  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories (category_id, name, display_order, is_active)
    SELECT v_cat_id, sub.name, sub.ord, true
    FROM (VALUES 
      ('Combustible', 1),
      ('Peajes', 2),
      ('Viáticos', 3),
      ('Estacionamiento', 4),
      ('Materiales', 5),
      ('Transporte', 6),
      ('Hospedaje', 7),
      ('Otros', 8)
    ) AS sub(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories 
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

  SELECT id INTO v_cat_id FROM public.cost_categories WHERE name = 'Mantenimiento' LIMIT 1;
  
  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories (category_id, name, display_order, is_active)
    SELECT v_cat_id, sub.name, sub.ord, true
    FROM (VALUES 
      ('Piezas y Repuestos', 1),
      ('Mano de obra', 2),
      ('Servicios externos', 3),
      ('Lubricantes y Fluidos', 4),
      ('Herramientas', 5),
      ('Calibración', 6),
      ('Inspecciones', 7),
      ('Otros', 8)
    ) AS sub(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories 
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;
END $$;