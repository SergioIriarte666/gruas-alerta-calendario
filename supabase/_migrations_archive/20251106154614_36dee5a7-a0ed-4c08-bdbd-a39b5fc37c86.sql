-- Crear tabla de subcategorías de costos
CREATE TABLE IF NOT EXISTS public.cost_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_cost_subcategories_category_id ON public.cost_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_cost_subcategories_active ON public.cost_subcategories(is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE public.cost_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_subcategories_auth_only" 
ON public.cost_subcategories 
FOR ALL 
USING (auth.role() = 'authenticated'::text);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_cost_subcategories_updated_at
BEFORE UPDATE ON public.cost_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar subcategorías predefinidas para "Gastos de Servicios"
INSERT INTO public.cost_subcategories (category_id, name, display_order)
SELECT 
  cc.id,
  subcategory,
  row_number
FROM 
  public.cost_categories cc,
  (VALUES 
    ('Combustible', 1),
    ('Peajes', 2),
    ('Viáticos', 3),
    ('Estacionamiento', 4),
    ('Materiales', 5),
    ('Transporte', 6),
    ('Hospedaje', 7),
    ('Otros', 8)
  ) AS subs(subcategory, row_number)
WHERE cc.name = 'Gastos de Servicios'
ON CONFLICT DO NOTHING;

-- Insertar subcategorías predefinidas para "Mantenimiento"
INSERT INTO public.cost_subcategories (category_id, name, display_order)
SELECT 
  cc.id,
  subcategory,
  row_number
FROM 
  public.cost_categories cc,
  (VALUES 
    ('Piezas y Repuestos', 1),
    ('Mano de obra', 2),
    ('Servicios externos', 3),
    ('Lubricantes y Fluidos', 4),
    ('Herramientas', 5),
    ('Calibración', 6),
    ('Inspecciones', 7),
    ('Otros', 8)
  ) AS subs(subcategory, row_number)
WHERE cc.name = 'Mantenimiento'
ON CONFLICT DO NOTHING;