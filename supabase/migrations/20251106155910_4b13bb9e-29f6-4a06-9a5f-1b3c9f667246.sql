-- Crear tabla de subcategorías de ingresos
CREATE TABLE IF NOT EXISTS public.income_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.income_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_income_subcategories_category_id ON public.income_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_income_subcategories_active ON public.income_subcategories(is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE public.income_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_subcategories_select_all"
ON public.income_subcategories
FOR SELECT
USING (true);

CREATE POLICY "income_subcategories_admin_all"
ON public.income_subcategories
FOR ALL
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- Trigger para actualizar updated_at
CREATE TRIGGER update_income_subcategories_updated_at
BEFORE UPDATE ON public.income_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();