
-- Crear tabla para categorías de costos
CREATE TABLE public.cost_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla principal de costos
CREATE TABLE public.costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES public.cost_categories(id) ON DELETE RESTRICT,
  crane_id UUID REFERENCES public.cranes(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear trigger para actualizar el campo updated_at en la tabla de costos
CREATE TRIGGER handle_updated_at_costs
BEFORE UPDATE ON public.costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Row Level Security (RLS) para ambas tablas
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para que los usuarios autenticados puedan gestionar categorías de costos
CREATE POLICY "Allow full access to authenticated users on cost_categories"
ON public.cost_categories
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Políticas de RLS para que los usuarios autenticados puedan gestionar costos
CREATE POLICY "Allow full access to authenticated users on costs"
ON public.costs
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Insertar algunas categorías de costos por defecto
INSERT INTO public.cost_categories (name, description) VALUES
('Combustible', 'Costos relacionados a la compra de combustible.'),
('Peajes', 'Costos de peajes en rutas.'),
('Salarios', 'Salarios y remuneraciones de operadores y personal.'),
('Mantenimiento', 'Costos de mantenimiento preventivo y correctivo de grúas.'),
('Seguros', 'Pólizas de seguro para vehículos y operaciones.'),
('Administrativos', 'Costos de oficina, software y otros gastos administrativos.'),
('Impuestos', 'Pagos de impuestos y patentes.'),
('Otros', 'Costos varios no categorizados.');
