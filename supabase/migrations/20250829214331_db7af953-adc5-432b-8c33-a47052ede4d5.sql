-- Crear tabla de categorías de proveedores
CREATE TABLE public.supplier_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;

-- Política para usuarios autenticados
CREATE POLICY "supplier_categories_authenticated_access" 
ON public.supplier_categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Insertar categorías existentes
INSERT INTO public.supplier_categories (name, label, description, created_by) VALUES
('combustible', 'Combustible', 'Gastos en combustible y carburantes', auth.uid()),
('mantenimiento', 'Mantenimiento', 'Gastos de mantenimiento y reparaciones', auth.uid()),
('seguros', 'Seguros', 'Pólizas de seguros y coberturas', auth.uid()),
('peajes', 'Peajes', 'Gastos en peajes y transporte', auth.uid()),
('salarios', 'Salarios', 'Pagos de salarios y remuneraciones', auth.uid()),
('administrativos', 'Administrativos', 'Gastos administrativos y de oficina', auth.uid()),
('impuestos', 'Impuestos', 'Pagos de impuestos y tasas', auth.uid()),
('comision_operador', 'Comisión Operador', 'Comisiones pagadas a operadores', auth.uid()),
('otros', 'Otros', 'Otros gastos no clasificados', auth.uid());

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_supplier_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_categories_updated_at
  BEFORE UPDATE ON public.supplier_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_categories_updated_at();