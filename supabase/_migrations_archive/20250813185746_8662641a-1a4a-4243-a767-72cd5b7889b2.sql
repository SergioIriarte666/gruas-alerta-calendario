-- MEJORA DEL SISTEMA DE PAGOS - PREVENCIÓN DE DUPLICADOS Y CLARIDAD
-- Crear trigger para prevenir duplicados de pagos

CREATE OR REPLACE FUNCTION public.prevent_duplicate_payments()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Verificar si ya existe un pago similar en las últimas 24 horas
  SELECT COUNT(*) INTO existing_count
  FROM public.payments 
  WHERE client_id = NEW.client_id
    AND amount = NEW.amount
    AND payment_date = NEW.payment_date
    AND payment_method = NEW.payment_method
    AND created_at > now() - interval '24 hours'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un pago similar para este cliente en las últimas 24 horas. Posible duplicado detectado.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger en la tabla payments
DROP TRIGGER IF EXISTS prevent_duplicate_payments_trigger ON public.payments;
CREATE TRIGGER prevent_duplicate_payments_trigger
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_payments();

-- Función mejorada para aplicar pagos con mejor lógica
CREATE OR REPLACE FUNCTION public.smart_apply_payment(
  p_payment_id UUID,
  p_auto_apply BOOLEAN DEFAULT true
) 
RETURNS TABLE(
  success BOOLEAN,
  applications_made INTEGER,
  remaining_amount DECIMAL,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment_amount DECIMAL;
  applications_count INTEGER := 0;
  application_amount DECIMAL;
BEGIN
  -- Obtener información del pago
  SELECT * INTO payment_record
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Pago no encontrado';
    RETURN;
  END IF;
  
  -- Si ya está aplicado completamente, no hacer nada
  IF payment_record.remaining_amount <= 0 THEN
    RETURN QUERY SELECT true, 0, 0::DECIMAL, 'Pago ya está completamente aplicado';
    RETURN;
  END IF;
  
  remaining_payment_amount := payment_record.remaining_amount;
  
  -- Solo aplicar automáticamente si p_auto_apply es true
  IF p_auto_apply THEN
    -- Buscar facturas pendientes del cliente ordenadas por fecha de vencimiento
    FOR invoice_record IN 
      SELECT i.*, COALESCE(i.remaining_amount, i.total) as pending_amount
      FROM invoices i
      WHERE i.client_id = payment_record.client_id
      AND i.status IN ('sent', 'overdue')
      AND COALESCE(i.remaining_amount, i.total) > 0
      ORDER BY i.due_date ASC
    LOOP
      EXIT WHEN remaining_payment_amount <= 0;
      
      -- Calcular cuánto aplicar a esta factura
      application_amount := LEAST(remaining_payment_amount, invoice_record.pending_amount);
      
      -- Crear aplicación del pago
      INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        notes,
        created_by
      ) VALUES (
        p_payment_id,
        invoice_record.id,
        application_amount,
        'fifo',
        'Aplicación automática FIFO',
        auth.uid()
      );
      
      -- Actualizar factura
      UPDATE invoices 
      SET 
        paid_amount = COALESCE(paid_amount, 0) + application_amount,
        remaining_amount = COALESCE(remaining_amount, total) - application_amount,
        status = CASE 
          WHEN (COALESCE(remaining_amount, total) - application_amount) <= 0 THEN 'paid'::invoice_status
          ELSE status
        END,
        updated_at = now()
      WHERE id = invoice_record.id;
      
      remaining_payment_amount := remaining_payment_amount - application_amount;
      applications_count := applications_count + 1;
    END LOOP;
  END IF;
  
  -- Actualizar estado del pago
  UPDATE payments 
  SET 
    applied_amount = amount - remaining_payment_amount,
    remaining_amount = remaining_payment_amount,
    status = CASE 
      WHEN remaining_payment_amount <= 0 THEN 'applied'::payment_status
      WHEN remaining_payment_amount < amount THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = now()
  WHERE id = p_payment_id;
  
  RETURN QUERY SELECT 
    true, 
    applications_count, 
    remaining_payment_amount,
    CASE 
      WHEN applications_count > 0 THEN 'Pago aplicado a ' || applications_count || ' facturas'
      ELSE 'Pago registrado sin aplicar automáticamente'
    END;
END;
$$;