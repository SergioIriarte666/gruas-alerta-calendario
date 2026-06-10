-- Crear tabla de categorías de ingresos
CREATE TABLE IF NOT EXISTS public.income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'dollar-sign',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de ingresos
CREATE TABLE IF NOT EXISTS public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica del ingreso
  income_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  
  -- Categorización
  category_id UUID REFERENCES public.income_categories(id) ON DELETE SET NULL,
  subcategory TEXT,
  
  -- Información bancaria
  payment_method TEXT NOT NULL,
  bank_reference TEXT,
  
  -- Cliente asociado (OPCIONAL)
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  
  -- Notas adicionales
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_incomes_date ON public.incomes(income_date DESC);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON public.incomes(category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_client ON public.incomes(client_id);
CREATE INDEX IF NOT EXISTS idx_incomes_created_at ON public.incomes(created_at DESC);

-- RLS para income_categories
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_categories_select_all"
  ON public.income_categories FOR SELECT
  USING (true);

CREATE POLICY "income_categories_admin_all"
  ON public.income_categories FOR ALL
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

-- RLS para incomes
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incomes_select_authenticated"
  ON public.incomes FOR SELECT
  USING (is_authenticated_user_safe());

CREATE POLICY "incomes_insert_authenticated"
  ON public.incomes FOR INSERT
  WITH CHECK (is_authenticated_user_safe());

CREATE POLICY "incomes_update_authenticated"
  ON public.incomes FOR UPDATE
  USING (is_authenticated_user_safe())
  WITH CHECK (is_authenticated_user_safe());

CREATE POLICY "incomes_delete_admin"
  ON public.incomes FOR DELETE
  USING (is_admin_user_safe());

-- Trigger para updated_at en incomes
CREATE TRIGGER update_incomes_updated_at 
  BEFORE UPDATE ON public.incomes
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at en income_categories
CREATE TRIGGER update_income_categories_updated_at 
  BEFORE UPDATE ON public.income_categories
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar categorías predefinidas
INSERT INTO public.income_categories (name, description, color, icon) VALUES
  ('Servicios', 'Ingresos por servicios prestados', '#10b981', 'truck'),
  ('Extraordinarios', 'Ingresos extraordinarios no recurrentes', '#f59e0b', 'sparkles'),
  ('Intereses', 'Ingresos por intereses bancarios', '#3b82f6', 'trending-up'),
  ('Reembolsos', 'Devoluciones y reembolsos recibidos', '#8b5cf6', 'arrow-down-circle'),
  ('Otros', 'Otros ingresos diversos', '#6b7280', 'more-horizontal')
ON CONFLICT (name) DO NOTHING;