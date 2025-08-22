-- Corrección completa del sistema de reconciliación de pagos
-- Problema: Las columnas remaining_amount son generadas y no pueden actualizarse manualmente

-- 1. Primero agregar 'partial' al enum de invoice_status si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partial' AND enumtypid = 'invoice_status'::regtype) THEN
        ALTER TYPE invoice_status ADD VALUE 'partial';
    END IF;
END $$;

-- 2. Eliminar y recrear función apply_payment_manual
DROP FUNCTION IF EXISTS public.apply_payment_manual(uuid, jsonb);
CREATE FUNCTION public.apply_payment_manual(
  p_payment_id uuid,
  p_applications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_amount numeric;
  total_applied numeric := 0;
  application jsonb;
  invoice_total numeric;
  current_paid numeric;
  new_applied numeric;
  result_applications jsonb := '[]'::jsonb;
BEGIN
  -- Validar que el pago existe y obtener su monto
  SELECT amount INTO payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado: %', p_payment_id;
  END IF;

  -- Procesar cada aplicación
  FOR application IN SELECT * FROM jsonb_array_elements(p_applications)
  LOOP
    DECLARE
      app_invoice_id uuid := (application->>'invoice_id')::uuid;
      app_amount numeric := (application->>'amount')::numeric;
    BEGIN
      -- Validar monto de aplicación
      IF app_amount <= 0 THEN
        RAISE EXCEPTION 'El monto de aplicación debe ser mayor a 0';
      END IF;
      
      total_applied := total_applied + app_amount;
      
      -- Validar que no exceda el monto del pago
      IF total_applied > payment_amount THEN
        RAISE EXCEPTION 'El total aplicado (%) excede el monto del pago (%)', total_applied, payment_amount;
      END IF;
      
      -- Obtener información de la factura
      SELECT total, COALESCE(paid_amount, 0) 
      INTO invoice_total, current_paid
      FROM invoices 
      WHERE id = app_invoice_id;
      
      IF invoice_total IS NULL THEN
        RAISE EXCEPTION 'Factura no encontrada: %', app_invoice_id;
      END IF;
      
      -- Validar que la aplicación no exceda lo pendiente
      IF current_paid + app_amount > invoice_total THEN
        RAISE EXCEPTION 'La aplicación excede el monto pendiente de la factura';
      END IF;
      
      -- Crear aplicación de pago
      INSERT INTO payment_applications (
        payment_id, invoice_id, applied_amount, application_method, 
        notes, created_by
      ) VALUES (
        p_payment_id, app_invoice_id, app_amount, 'manual',
        'Aplicación manual de pago', auth.uid()
      );
      
      -- Actualizar factura (sin tocar remaining_amount)
      new_applied := current_paid + app_amount;
      UPDATE invoices 
      SET 
        paid_amount = new_applied,
        status = CASE 
          WHEN new_applied >= invoice_total THEN 'paid'::invoice_status
          WHEN new_applied > 0 THEN 'partial'::invoice_status
          ELSE status
        END,
        payment_date = CASE 
          WHEN new_applied >= invoice_total THEN CURRENT_DATE
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = app_invoice_id;
      
      -- Agregar al resultado
      result_applications := result_applications || jsonb_build_object(
        'invoice_id', app_invoice_id,
        'applied_amount', app_amount
      );
    END;
  END LOOP;
  
  -- Actualizar pago (sin tocar remaining_amount)
  UPDATE payments 
  SET 
    applied_amount = total_applied,
    status = CASE 
      WHEN total_applied >= payment_amount THEN 'applied'::payment_status
      WHEN total_applied > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', total_applied,
    'applications', result_applications
  );
END;
$function$;

-- 3. Eliminar y recrear función apply_payment_fifo
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);
CREATE FUNCTION public.apply_payment_fifo(
  p_payment_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_amount numeric;
  payment_applied numeric;
  remaining_to_apply numeric;
  invoice_record record;
  applied_to_invoice numeric;
  applications_count integer := 0;
BEGIN
  -- Obtener información del pago
  SELECT amount, COALESCE(applied_amount, 0)
  INTO payment_amount, payment_applied
  FROM payments 
  WHERE id = p_payment_id AND client_id = p_client_id;
  
  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;
  
  remaining_to_apply := payment_amount - payment_applied;
  
  IF remaining_to_apply <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'El pago ya está completamente aplicado',
      'applications_created', 0
    );
  END IF;
  
  -- Aplicar a facturas pendientes por orden FIFO
  FOR invoice_record IN 
    SELECT id, folio, total, COALESCE(paid_amount, 0) as paid_amount
    FROM invoices 
    WHERE client_id = p_client_id 
    AND status IN ('sent', 'partial', 'overdue')
    AND total > COALESCE(paid_amount, 0)
    ORDER BY issue_date ASC, created_at ASC
  LOOP
    -- Calcular cuánto aplicar a esta factura
    applied_to_invoice := LEAST(
      remaining_to_apply, 
      invoice_record.total - invoice_record.paid_amount
    );
    
    -- Crear aplicación
    INSERT INTO payment_applications (
      payment_id, invoice_id, applied_amount, application_method,
      notes, created_by
    ) VALUES (
      p_payment_id, invoice_record.id, applied_to_invoice, 'fifo',
      'Aplicación automática FIFO', auth.uid()
    );
    
    -- Actualizar factura (sin tocar remaining_amount)
    UPDATE invoices 
    SET 
      paid_amount = invoice_record.paid_amount + applied_to_invoice,
      status = CASE 
        WHEN invoice_record.paid_amount + applied_to_invoice >= invoice_record.total 
        THEN 'paid'::invoice_status
        ELSE 'partial'::invoice_status
      END,
      payment_date = CASE 
        WHEN invoice_record.paid_amount + applied_to_invoice >= invoice_record.total 
        THEN CURRENT_DATE
        ELSE payment_date
      END,
      updated_at = NOW()
    WHERE id = invoice_record.id;
    
    remaining_to_apply := remaining_to_apply - applied_to_invoice;
    applications_count := applications_count + 1;
    
    EXIT WHEN remaining_to_apply <= 0;
  END LOOP;
  
  -- Actualizar pago (sin tocar remaining_amount)
  UPDATE payments 
  SET 
    applied_amount = payment_amount - remaining_to_apply,
    status = CASE 
      WHEN remaining_to_apply <= 0 THEN 'applied'::payment_status
      WHEN payment_amount - remaining_to_apply > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'applications_created', applications_count,
    'amount_applied', payment_amount - remaining_to_apply,
    'remaining_amount', remaining_to_apply
  );
END;
$function$;