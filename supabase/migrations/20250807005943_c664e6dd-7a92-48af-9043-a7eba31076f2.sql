-- Corregir funciones SQL que intentan actualizar remaining_amount (columna generada)
-- Esta migración corrige apply_payment_fifo y apply_payment_manual

CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
  p_payment_id uuid,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  application_amount numeric;
  total_applied numeric := 0;
  applications_made integer := 0;
BEGIN
  -- Obtener información del pago
  SELECT * INTO payment_record
  FROM public.payments
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;
  
  -- Verificar que el pago tenga monto disponible
  IF payment_record.remaining_amount <= 0 THEN
    RAISE EXCEPTION 'El pago no tiene monto disponible para aplicar';
  END IF;
  
  -- Obtener facturas pendientes FIFO (más antiguas primero)
  FOR invoice_record IN 
    SELECT * FROM public.invoices 
    WHERE client_id = COALESCE(p_client_id, payment_record.client_id)
    AND status IN ('sent', 'overdue', 'paid')
    AND remaining_amount > 0
    ORDER BY due_date ASC, created_at ASC
  LOOP
    -- Calcular monto disponible del pago
    SELECT remaining_amount INTO payment_record.remaining_amount
    FROM public.payments 
    WHERE id = p_payment_id;
    
    EXIT WHEN payment_record.remaining_amount <= 0;
    
    -- Calcular monto a aplicar (menor entre lo que queda del pago y lo que debe la factura)
    application_amount := LEAST(payment_record.remaining_amount, invoice_record.remaining_amount);
    
    IF application_amount > 0 THEN
      -- Crear registro de aplicación
      INSERT INTO public.payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        created_by
      ) VALUES (
        p_payment_id,
        invoice_record.id,
        application_amount,
        'fifo',
        auth.uid()
      );
      
      -- Actualizar applied_amount del pago (remaining_amount se calcula automáticamente)
      UPDATE public.payments 
      SET applied_amount = applied_amount + application_amount,
          updated_at = now()
      WHERE id = p_payment_id;
      
      -- Actualizar paid_amount de la factura (remaining_amount se calcula automáticamente)
      UPDATE public.invoices 
      SET paid_amount = paid_amount + application_amount,
          updated_at = now()
      WHERE id = invoice_record.id;
      
      -- Verificar si la factura está completamente pagada
      UPDATE public.invoices 
      SET status = 'paid',
          payment_date = CURRENT_DATE,
          updated_at = now()
      WHERE id = invoice_record.id 
      AND remaining_amount <= 0
      AND status != 'paid';
      
      total_applied := total_applied + application_amount;
      applications_made := applications_made + 1;
    END IF;
  END LOOP;
  
  -- Actualizar estado del pago si está completamente aplicado
  UPDATE public.payments 
  SET status = CASE 
    WHEN remaining_amount <= 0 THEN 'applied'
    WHEN applied_amount > 0 THEN 'partial'
    ELSE status
  END,
  updated_at = now()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', total_applied,
    'applications_made', applications_made,
    'remaining_amount', (SELECT remaining_amount FROM public.payments WHERE id = p_payment_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_payment_manual(
  p_payment_id uuid,
  p_applications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  application_record RECORD;
  invoice_record RECORD;
  total_applied numeric := 0;
  applications_made integer := 0;
BEGIN
  -- Obtener información del pago
  SELECT * INTO payment_record
  FROM public.payments
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;
  
  -- Procesar cada aplicación
  FOR application_record IN 
    SELECT 
      (app->>'invoice_id')::uuid as invoice_id,
      (app->>'amount')::numeric as amount
    FROM jsonb_array_elements(p_applications) as app
  LOOP
    -- Validar que la factura existe y tiene saldo pendiente
    SELECT * INTO invoice_record
    FROM public.invoices
    WHERE id = application_record.invoice_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Factura no encontrada: %', application_record.invoice_id;
    END IF;
    
    IF invoice_record.remaining_amount <= 0 THEN
      RAISE EXCEPTION 'La factura % no tiene saldo pendiente', invoice_record.folio;
    END IF;
    
    -- Validar que el monto no exceda lo disponible
    IF application_record.amount > invoice_record.remaining_amount THEN
      RAISE EXCEPTION 'Monto excede el saldo de la factura %', invoice_record.folio;
    END IF;
    
    -- Validar que el total no exceda el pago disponible
    IF (total_applied + application_record.amount) > payment_record.remaining_amount THEN
      RAISE EXCEPTION 'Total de aplicaciones excede el monto disponible del pago';
    END IF;
    
    -- Crear registro de aplicación
    INSERT INTO public.payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      created_by
    ) VALUES (
      p_payment_id,
      application_record.invoice_id,
      application_record.amount,
      'manual',
      auth.uid()
    );
    
    -- Actualizar applied_amount del pago (remaining_amount se calcula automáticamente)
    UPDATE public.payments 
    SET applied_amount = applied_amount + application_record.amount,
        updated_at = now()
    WHERE id = p_payment_id;
    
    -- Actualizar paid_amount de la factura (remaining_amount se calcula automáticamente)
    UPDATE public.invoices 
    SET paid_amount = paid_amount + application_record.amount,
        updated_at = now()
    WHERE id = application_record.invoice_id;
    
    -- Verificar si la factura está completamente pagada
    UPDATE public.invoices 
    SET status = 'paid',
        payment_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = application_record.invoice_id 
    AND remaining_amount <= 0
    AND status != 'paid';
    
    total_applied := total_applied + application_record.amount;
    applications_made := applications_made + 1;
  END LOOP;
  
  -- Actualizar estado del pago si está completamente aplicado
  UPDATE public.payments 
  SET status = CASE 
    WHEN remaining_amount <= 0 THEN 'applied'
    WHEN applied_amount > 0 THEN 'partial'
    ELSE status
  END,
  updated_at = now()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', total_applied,
    'applications_made', applications_made,
    'remaining_amount', (SELECT remaining_amount FROM public.payments WHERE id = p_payment_id)
  );
END;
$function$;