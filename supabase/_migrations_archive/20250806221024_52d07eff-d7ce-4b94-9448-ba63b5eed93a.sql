-- Sistema de Conciliación de Pagos
-- Tipos ENUM
CREATE TYPE payment_status AS ENUM ('pending', 'applied', 'partial', 'cancelled');
CREATE TYPE application_method AS ENUM ('fifo', 'manual', 'proportional');

-- Tabla de pagos
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  bank_reference TEXT,
  payment_method TEXT DEFAULT 'transferencia',
  notes TEXT,
  status payment_status DEFAULT 'pending',
  applied_amount DECIMAL(10,2) DEFAULT 0 CHECK (applied_amount >= 0),
  remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - applied_amount) STORED,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de aplicaciones de pagos
CREATE TABLE public.payment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  applied_amount DECIMAL(10,2) NOT NULL CHECK (applied_amount > 0),
  application_method application_method DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_id, invoice_id)
);

-- Agregar campos a invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0 CHECK (paid_amount >= 0),
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (total - paid_amount) STORED;

-- RLS Policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_authenticated_access" ON public.payments
FOR ALL USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

CREATE POLICY "payment_applications_authenticated_access" ON public.payment_applications
FOR ALL USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- Función FIFO automática
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(p_payment_id UUID, p_client_id UUID DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment DECIMAL(10,2);
  amount_to_apply DECIMAL(10,2);
  applications_made INTEGER := 0;
  total_applied DECIMAL(10,2) := 0;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;

  IF p_client_id IS NULL THEN p_client_id := payment_record.client_id; END IF;
  remaining_payment := payment_record.amount - payment_record.applied_amount;

  FOR invoice_record IN 
    SELECT * FROM public.invoices 
    WHERE client_id = p_client_id AND status IN ('sent', 'overdue', 'draft') AND remaining_amount > 0
    ORDER BY due_date ASC, created_at ASC
  LOOP
    EXIT WHEN remaining_payment <= 0;
    amount_to_apply := LEAST(remaining_payment, invoice_record.remaining_amount);
    
    INSERT INTO public.payment_applications (payment_id, invoice_id, applied_amount, application_method, created_by) 
    VALUES (p_payment_id, invoice_record.id, amount_to_apply, 'fifo', auth.uid());
    
    UPDATE public.invoices SET paid_amount = paid_amount + amount_to_apply, updated_at = NOW() WHERE id = invoice_record.id;
    
    remaining_payment := remaining_payment - amount_to_apply;
    total_applied := total_applied + amount_to_apply;
    applications_made := applications_made + 1;
  END LOOP;

  UPDATE public.payments SET 
    applied_amount = applied_amount + total_applied,
    status = CASE WHEN applied_amount + total_applied >= amount THEN 'applied' WHEN applied_amount + total_applied > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = p_client_id AND remaining_amount = 0 AND status != 'paid';

  RETURN jsonb_build_object('success', true, 'applications_made', applications_made, 'total_applied', total_applied, 'remaining_payment', remaining_payment);
END;
$$;

-- Función aplicación manual
CREATE OR REPLACE FUNCTION public.apply_payment_manual(p_payment_id UUID, p_applications jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  payment_record RECORD;
  application RECORD;
  total_to_apply DECIMAL(10,2) := 0;
  total_applied DECIMAL(10,2) := 0;
  applications_made INTEGER := 0;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;

  SELECT SUM((value->>'amount')::DECIMAL) INTO total_to_apply FROM jsonb_array_elements(p_applications);
  IF total_to_apply > (payment_record.amount - payment_record.applied_amount) THEN
    RAISE EXCEPTION 'El monto total a aplicar excede el monto disponible del pago';
  END IF;

  FOR application IN 
    SELECT (value->>'invoice_id')::UUID as invoice_id, (value->>'amount')::DECIMAL as amount
    FROM jsonb_array_elements(p_applications)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = application.invoice_id AND client_id = payment_record.client_id AND remaining_amount >= application.amount) THEN
      RAISE EXCEPTION 'Factura inválida o monto excede el saldo pendiente';
    END IF;

    INSERT INTO public.payment_applications (payment_id, invoice_id, applied_amount, application_method, created_by) 
    VALUES (p_payment_id, application.invoice_id, application.amount, 'manual', auth.uid());
    
    UPDATE public.invoices SET paid_amount = paid_amount + application.amount, updated_at = NOW() WHERE id = application.invoice_id;
    
    total_applied := total_applied + application.amount;
    applications_made := applications_made + 1;
  END LOOP;

  UPDATE public.payments SET 
    applied_amount = applied_amount + total_applied,
    status = CASE WHEN applied_amount + total_applied >= amount THEN 'applied' WHEN applied_amount + total_applied > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = payment_record.client_id AND remaining_amount = 0 AND status != 'paid';

  RETURN jsonb_build_object('success', true, 'applications_made', applications_made, 'total_applied', total_applied);
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_update_timestamp();

-- Índices para optimización
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payment_applications_payment_id ON public.payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice_id ON public.payment_applications(invoice_id);
CREATE INDEX idx_invoices_remaining_amount ON public.invoices(remaining_amount) WHERE remaining_amount > 0;