
-- Eliminar sistema actual de pagos de comisiones y rediseñar
-- Paso 1: Eliminar tablas existentes de commission_payments

-- Eliminar tablas del sistema anterior
DROP TABLE IF EXISTS public.commission_payment_items CASCADE;
DROP TABLE IF EXISTS public.commission_payments CASCADE;

-- Eliminar columna payment_status de costs (ya no es necesaria)
ALTER TABLE public.costs DROP COLUMN IF EXISTS payment_status;

-- Crear nuevo sistema de comisiones simplificado y moderno
-- Tabla principal de comisiones generadas automáticamente
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0, -- porcentaje aplicado
  base_amount NUMERIC NOT NULL DEFAULT 0, -- valor base del servicio
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  period_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  period_month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de pagos por lotes (reemplaza commission_payments)
CREATE TABLE public.commission_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  commission_count INTEGER NOT NULL DEFAULT 0,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de relación entre lotes y comisiones
CREATE TABLE public.commission_batch_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.commission_batches(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(batch_id, commission_id)
);

-- Configuración de comisiones por operador
CREATE TABLE public.operator_commission_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
  percentage NUMERIC NOT NULL DEFAULT 10.0 CHECK (percentage >= 0 AND percentage <= 100),
  fixed_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_commission_rates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para commissions
CREATE POLICY "commissions_select_auth" 
  ON public.commissions 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "commissions_modify_admin" 
  ON public.commissions 
  FOR ALL 
  USING (is_admin_user());

-- Políticas RLS para commission_batches
CREATE POLICY "commission_batches_select_auth" 
  ON public.commission_batches 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "commission_batches_modify_admin" 
  ON public.commission_batches 
  FOR ALL 
  USING (is_admin_user());

-- Políticas RLS para commission_batch_items
CREATE POLICY "commission_batch_items_select_auth" 
  ON public.commission_batch_items 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "commission_batch_items_modify_admin" 
  ON public.commission_batch_items 
  FOR ALL 
  USING (is_admin_user());

-- Políticas RLS para operator_commission_rates
CREATE POLICY "operator_commission_rates_select_auth" 
  ON public.operator_commission_rates 
  FOR SELECT 
  USING (is_operator_user());

CREATE POLICY "operator_commission_rates_modify_admin" 
  ON public.operator_commission_rates 
  FOR ALL 
  USING (is_admin_user());

-- Triggers para updated_at
CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_batches_updated_at
  BEFORE UPDATE ON public.commission_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_operator_commission_rates_updated_at
  BEFORE UPDATE ON public.operator_commission_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para generar comisiones automáticamente cuando se completa un servicio
CREATE OR REPLACE FUNCTION public.generate_commission_for_service()
RETURNS TRIGGER AS $$
DECLARE
  commission_rate NUMERIC;
  fixed_amount NUMERIC;
  calculated_amount NUMERIC;
BEGIN
  -- Solo generar comisión si el servicio se marca como completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Obtener la tasa de comisión para el operador y tipo de servicio
    SELECT 
      COALESCE(ocr.percentage, 10.0),
      COALESCE(ocr.fixed_amount, 0)
    INTO commission_rate, fixed_amount
    FROM public.operator_commission_rates ocr
    WHERE ocr.operator_id = NEW.operator_id
      AND (ocr.service_type_id = NEW.service_type_id OR ocr.service_type_id IS NULL)
      AND ocr.is_active = true
      AND ocr.effective_from <= NEW.service_date
      AND (ocr.effective_to IS NULL OR ocr.effective_to >= NEW.service_date)
    ORDER BY ocr.service_type_id NULLS LAST, ocr.effective_from DESC
    LIMIT 1;
    
    -- Si no hay configuración específica, usar tasa por defecto del 10%
    IF commission_rate IS NULL THEN
      commission_rate := 10.0;
      fixed_amount := 0;
    END IF;
    
    -- Calcular monto de comisión
    calculated_amount := (NEW.value * commission_rate / 100) + fixed_amount;
    
    -- Insertar comisión
    INSERT INTO public.commissions (
      service_id,
      operator_id,
      amount,
      percentage,
      base_amount,
      status,
      period_year,
      period_month
    ) VALUES (
      NEW.id,
      NEW.operator_id,
      calculated_amount,
      commission_rate,
      NEW.value,
      'pending',
      EXTRACT(YEAR FROM NEW.service_date),
      EXTRACT(MONTH FROM NEW.service_date)
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger para generar comisiones automáticamente
CREATE TRIGGER generate_commission_on_service_completion
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_for_service();

-- Función para generar número de lote automático
CREATE OR REPLACE FUNCTION public.generate_batch_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  batch_number TEXT;
BEGIN
  -- Obtener el siguiente número de lote
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.commission_batches
  WHERE batch_number ~ '^BATCH-[0-9]+$';
  
  batch_number := 'BATCH-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN batch_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Índices para optimización
CREATE INDEX idx_commissions_operator_period ON public.commissions(operator_id, period_year, period_month);
CREATE INDEX idx_commissions_status ON public.commissions(status);
CREATE INDEX idx_commissions_service ON public.commissions(service_id);
CREATE INDEX idx_commission_batches_operator ON public.commission_batches(operator_id);
CREATE INDEX idx_commission_batches_period ON public.commission_batches(period_from, period_to);
CREATE INDEX idx_operator_commission_rates_active ON public.operator_commission_rates(operator_id, is_active) WHERE is_active = true;
