
-- Crear tabla para registros principales de pagos de comisiones
CREATE TABLE public.commission_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para detalles de comisiones incluidas en cada pago
CREATE TABLE public.commission_payment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  cost_id UUID NOT NULL REFERENCES public.costs(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  service_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payment_id, cost_id)
);

-- Agregar campo para marcar el estado de pago en la tabla costs
ALTER TABLE public.costs 
ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'));

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_commission_payments_operator_period ON public.commission_payments(operator_id, period_start, period_end);
CREATE INDEX idx_commission_payments_status ON public.commission_payments(status);
CREATE INDEX idx_commission_payment_items_payment ON public.commission_payment_items(payment_id);
CREATE INDEX idx_commission_payment_items_cost ON public.commission_payment_items(cost_id);
CREATE INDEX idx_costs_payment_status ON public.costs(payment_status) WHERE payment_status = 'pending';

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payment_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para commission_payments
CREATE POLICY "commission_payments_select_policy" 
  ON public.commission_payments 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "commission_payments_modify_policy" 
  ON public.commission_payments 
  FOR ALL 
  USING (is_admin_user());

-- Políticas RLS para commission_payment_items
CREATE POLICY "commission_payment_items_select_policy" 
  ON public.commission_payment_items 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "commission_payment_items_modify_policy" 
  ON public.commission_payment_items 
  FOR ALL 
  USING (is_admin_user());

-- Trigger para actualizar updated_at en commission_payments
CREATE TRIGGER update_commission_payments_updated_at
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
