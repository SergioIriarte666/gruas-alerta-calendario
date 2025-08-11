-- Create cost centers table
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  budget_amount NUMERIC DEFAULT 0,
  budget_period TEXT DEFAULT 'monthly' CHECK (budget_period IN ('monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Add cost_center_id to costs table
ALTER TABLE public.costs 
ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cost_centers_parent_id ON public.cost_centers (parent_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON public.cost_centers (code);
CREATE INDEX IF NOT EXISTS idx_costs_cost_center_id ON public.costs (cost_center_id);

-- Enable RLS on cost_centers
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cost_centers
CREATE POLICY "cost_centers_select_policy" ON public.cost_centers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cost_centers_modify_policy" ON public.cost_centers
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Create trigger for updating updated_at
CREATE TRIGGER handle_updated_at_cost_centers
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default cost centers
INSERT INTO public.cost_centers (code, name, description) VALUES
  ('ADMIN', 'Administrativos', 'Gastos administrativos y de oficina'),
  ('OPER', 'Operacionales', 'Gastos operacionales directos'),
  ('MANT', 'Mantenimiento', 'Gastos de mantenimiento de equipos'),
  ('COMB', 'Combustible', 'Gastos de combustible y energía'),
  ('PERS', 'Personal', 'Gastos de personal y recursos humanos'),
  ('MKT', 'Marketing', 'Gastos de marketing y ventas'),
  ('TEC', 'Tecnología', 'Gastos de tecnología e innovación');

-- Insert sub-centers for operations
INSERT INTO public.cost_centers (code, name, description, parent_id) 
SELECT 
  'OPER-GRU', 
  'Operación Grúas', 
  'Costos específicos de operación de grúas',
  id 
FROM public.cost_centers WHERE code = 'OPER';

INSERT INTO public.cost_centers (code, name, description, parent_id) 
SELECT 
  'OPER-SERV', 
  'Servicios Cliente', 
  'Costos directos de servicios a clientes',
  id 
FROM public.cost_centers WHERE code = 'OPER';