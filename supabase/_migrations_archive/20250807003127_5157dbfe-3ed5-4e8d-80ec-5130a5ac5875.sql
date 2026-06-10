-- Corregir la función apply_payment_manual para manejar tipos correctamente
CREATE OR REPLACE FUNCTION public.apply_payment_manual(
  p_payment_id UUID,
  p_applications JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  payment_record RECORD;
  application RECORD;
  total_to_apply DECIMAL(10,2) := 0;
  total_applied DECIMAL(10,2) := 0;
  applications_made INTEGER := 0;
  new_status payment_status;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  -- Obtener el pago
  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Pago no encontrado'; 
  END IF;

  -- Calcular total a aplicar
  SELECT SUM((value->>'amount')::DECIMAL) INTO total_to_apply 
  FROM jsonb_array_elements(p_applications);
  
  IF total_to_apply > (payment_record.amount - COALESCE(payment_record.applied_amount, 0)) THEN
    RAISE EXCEPTION 'El monto total a aplicar excede el monto disponible del pago';
  END IF;

  -- Procesar cada aplicación
  FOR application IN 
    SELECT 
      (value->>'invoice_id')::UUID as invoice_id, 
      (value->>'amount')::DECIMAL as amount
    FROM jsonb_array_elements(p_applications)
  LOOP
    -- Verificar que la factura existe y pertenece al cliente
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE id = application.invoice_id 
      AND client_id = payment_record.client_id 
      AND (total - COALESCE(paid_amount, 0)) >= application.amount
    ) THEN
      RAISE EXCEPTION 'Factura inválida o monto excede el saldo pendiente para factura %', application.invoice_id;
    END IF;

    -- Insertar aplicación de pago
    INSERT INTO public.payment_applications (
      payment_id, 
      invoice_id, 
      applied_amount, 
      application_method, 
      created_by
    ) VALUES (
      p_payment_id, 
      application.invoice_id, 
      application.amount, 
      'manual'::application_method, 
      auth.uid()
    );
    
    -- Actualizar factura
    UPDATE public.invoices SET 
      paid_amount = COALESCE(paid_amount, 0) + application.amount,
      remaining_amount = total - (COALESCE(paid_amount, 0) + application.amount),
      updated_at = NOW() 
    WHERE id = application.invoice_id;
    
    total_applied := total_applied + application.amount;
    applications_made := applications_made + 1;
  END LOOP;

  -- Determinar nuevo status del pago
  IF (COALESCE(payment_record.applied_amount, 0) + total_applied) >= payment_record.amount THEN
    new_status := 'applied'::payment_status;
  ELSIF (COALESCE(payment_record.applied_amount, 0) + total_applied) > 0 THEN
    new_status := 'partial'::payment_status;
  ELSE
    new_status := 'pending'::payment_status;
  END IF;

  -- Actualizar pago
  UPDATE public.payments SET 
    applied_amount = COALESCE(applied_amount, 0) + total_applied,
    remaining_amount = amount - (COALESCE(applied_amount, 0) + total_applied),
    status = new_status,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Actualizar status de facturas completamente pagadas
  UPDATE public.invoices SET 
    status = 'paid'::invoice_status, 
    payment_date = payment_record.payment_date
  WHERE client_id = payment_record.client_id 
    AND remaining_amount <= 0 
    AND status != 'paid'::invoice_status;

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied,
    'payment_status', new_status
  );
END;
$$;

-- Corregir también la función apply_payment_fifo
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
  p_payment_id UUID,
  p_client_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment DECIMAL(10,2);
  amount_to_apply DECIMAL(10,2);
  applications_made INTEGER := 0;
  total_applied DECIMAL(10,2) := 0;
  new_status payment_status;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  -- Obtener el pago
  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Pago no encontrado'; 
  END IF;

  -- Usar el cliente del pago si no se especifica
  IF p_client_id IS NULL THEN
    p_client_id := payment_record.client_id;
  END IF;

  -- Verificar que el cliente coincide
  IF payment_record.client_id != p_client_id THEN
    RAISE EXCEPTION 'El pago no pertenece al cliente especificado';
  END IF;

  -- Calcular monto disponible
  remaining_payment := payment_record.amount - COALESCE(payment_record.applied_amount, 0);
  
  IF remaining_payment <= 0 THEN
    RAISE EXCEPTION 'El pago ya está completamente aplicado';
  END IF;

  -- Aplicar a facturas pendientes (FIFO)
  FOR invoice_record IN 
    SELECT * FROM public.invoices 
    WHERE client_id = p_client_id 
      AND status IN ('sent', 'overdue')
      AND (total - COALESCE(paid_amount, 0)) > 0
    ORDER BY issue_date ASC, created_at ASC
  LOOP
    EXIT WHEN remaining_payment <= 0;
    
    -- Calcular cuánto aplicar a esta factura
    amount_to_apply := LEAST(
      remaining_payment, 
      invoice_record.total - COALESCE(invoice_record.paid_amount, 0)
    );
    
    -- Insertar aplicación
    INSERT INTO public.payment_applications (
      payment_id, 
      invoice_id, 
      applied_amount, 
      application_method, 
      created_by
    ) VALUES (
      p_payment_id, 
      invoice_record.id, 
      amount_to_apply, 
      'fifo'::application_method, 
      auth.uid()
    );
    
    -- Actualizar factura
    UPDATE public.invoices SET 
      paid_amount = COALESCE(paid_amount, 0) + amount_to_apply,
      remaining_amount = total - (COALESCE(paid_amount, 0) + amount_to_apply),
      updated_at = NOW() 
    WHERE id = invoice_record.id;
    
    remaining_payment := remaining_payment - amount_to_apply;
    total_applied := total_applied + amount_to_apply;
    applications_made := applications_made + 1;
  END LOOP;

  -- Determinar nuevo status del pago
  IF (COALESCE(payment_record.applied_amount, 0) + total_applied) >= payment_record.amount THEN
    new_status := 'applied'::payment_status;
  ELSIF (COALESCE(payment_record.applied_amount, 0) + total_applied) > 0 THEN
    new_status := 'partial'::payment_status;
  ELSE
    new_status := 'pending'::payment_status;
  END IF;

  -- Actualizar pago
  UPDATE public.payments SET 
    applied_amount = COALESCE(applied_amount, 0) + total_applied,
    remaining_amount = amount - (COALESCE(applied_amount, 0) + total_applied),
    status = new_status,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Actualizar status de facturas completamente pagadas
  UPDATE public.invoices SET 
    status = 'paid'::invoice_status, 
    payment_date = payment_record.payment_date
  WHERE client_id = p_client_id 
    AND remaining_amount <= 0 
    AND status != 'paid'::invoice_status;

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied,
    'remaining_payment', remaining_payment,
    'payment_status', new_status
  );
END;
$$;