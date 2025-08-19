-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('combustible', 'mantenimiento', 'seguros', 'peajes', 'salarios', 'administrativos', 'impuestos', 'comision_operador', 'otros')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create supplier_payments table
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  paid_date DATE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('combustible', 'mantenimiento', 'seguros', 'peajes', 'salarios', 'administrativos', 'impuestos', 'comision_operador', 'otros')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create supplier_payment_cost_links table for bidirectional linking
CREATE TABLE public.supplier_payment_cost_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_payment_id UUID NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  cost_id UUID NOT NULL REFERENCES public.costs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(supplier_payment_id, cost_id)
);

-- Enable RLS on all tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_cost_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers
CREATE POLICY "suppliers_auth_access" ON public.suppliers
  FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policies for supplier_payments
CREATE POLICY "supplier_payments_auth_access" ON public.supplier_payments
  FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policies for supplier_payment_cost_links
CREATE POLICY "supplier_payment_cost_links_auth_access" ON public.supplier_payment_cost_links
  FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_suppliers_category ON public.suppliers(category);
CREATE INDEX idx_suppliers_is_active ON public.suppliers(is_active);
CREATE INDEX idx_suppliers_rut ON public.suppliers(rut);

CREATE INDEX idx_supplier_payments_supplier_id ON public.supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_status ON public.supplier_payments(status);
CREATE INDEX idx_supplier_payments_due_date ON public.supplier_payments(due_date);
CREATE INDEX idx_supplier_payments_category ON public.supplier_payments(category);

CREATE INDEX idx_supplier_payment_cost_links_payment_id ON public.supplier_payment_cost_links(supplier_payment_id);
CREATE INDEX idx_supplier_payment_cost_links_cost_id ON public.supplier_payment_cost_links(cost_id);

-- Create triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_payments_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update overdue supplier payments
CREATE OR REPLACE FUNCTION public.update_overdue_supplier_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE supplier_payments
  SET status = 'overdue',
      updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;