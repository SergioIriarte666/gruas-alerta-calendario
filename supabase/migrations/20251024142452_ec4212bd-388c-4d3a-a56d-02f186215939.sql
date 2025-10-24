-- ============================================================
-- CORRECCIÓN DEFINITIVA: Eliminar duplicación de actualización
-- de applied_amount en funciones de aplicación de pagos
-- ============================================================

-- Eliminar funciones existentes con todas sus variantes
DROP FUNCTION IF EXISTS public.apply_payment_fifo(UUID, UUID);
DROP FUNCTION IF EXISTS public.apply_payment_fifo(UUID);
DROP FUNCTION IF EXISTS public.apply_payment_manual(UUID, jsonb);

-- 1. Crear apply_payment_fifo (sin actualización manual de applied_amount)
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

  -- ✅ CRÍTICO: NO actualizar applied_amount aquí - el trigger lo hace automáticamente
  
  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = p_client_id AND remaining_amount = 0 AND status != 'paid';

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied, 
    'remaining_payment', remaining_payment
  );
END;
$$;

-- 2. Crear apply_payment_manual (sin actualización manual de applied_amount)
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

  -- ✅ CRÍTICO: NO actualizar applied_amount aquí - el trigger lo hace automáticamente

  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = payment_record.client_id AND remaining_amount = 0 AND status != 'paid';

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied
  );
END;
$$;

-- 3. Ejecutar corrección inmediata de datos duplicados existentes
SELECT public.fix_applied_amount_duplications();

COMMENT ON FUNCTION public.apply_payment_fifo IS 
'Aplica pagos usando FIFO. El trigger maintain_payment_consistency_trigger actualiza applied_amount automáticamente.';

COMMENT ON FUNCTION public.apply_payment_manual IS 
'Aplica pagos manualmente. El trigger maintain_payment_consistency_trigger actualiza applied_amount automáticamente.';