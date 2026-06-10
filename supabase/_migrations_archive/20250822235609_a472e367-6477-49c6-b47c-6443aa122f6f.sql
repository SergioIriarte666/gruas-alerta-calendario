-- Corrección completa del sistema de reconciliación de pagos
-- Problema: Las columnas remaining_amount son generadas y no pueden actualizarse manualmente

-- 1. Primero agregar 'partial' al enum de invoice_status si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partial' AND enumtypid = 'invoice_status'::regtype) THEN
        ALTER TYPE invoice_status ADD VALUE 'partial';
    END IF;
END $$;

-- 2. Corregir función apply_payment_manual - remover actualizaciones de remaining_amount
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

-- 3. Corregir función apply_payment_fifo
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
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

-- 4. Corregir función create_automatic_payment_for_invoice
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(p_invoice_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_application_amount DECIMAL;
    v_existing_payment_count INTEGER;
    result JSON;
BEGIN
    -- Obtener información de la factura
    SELECT id, client_id, total, paid_amount, folio, status
    INTO v_invoice
    FROM invoices 
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada: %', p_invoice_id;
    END IF;
    
    -- Verificar si ya tiene pagos aplicados
    SELECT COUNT(*) INTO v_existing_payment_count
    FROM payment_applications pa
    WHERE pa.invoice_id = p_invoice_id;
    
    IF v_existing_payment_count > 0 THEN
        RAISE EXCEPTION 'La factura % ya tiene pagos aplicados. Use la reconciliación manual.', v_invoice.folio;
    END IF;
    
    -- Calcular monto pendiente
    v_application_amount := v_invoice.total - COALESCE(v_invoice.paid_amount, 0);
    
    IF v_application_amount <= 0 THEN
        RAISE EXCEPTION 'La factura % ya está completamente pagada', v_invoice.folio;
    END IF;
    
    -- Verificar si ya existe un pago automático para esta factura
    IF EXISTS (
        SELECT 1 FROM payments p
        WHERE p.client_id = v_invoice.client_id
        AND p.bank_reference = 'PAGO-AUTO-' || v_invoice.folio
    ) THEN
        RAISE EXCEPTION 'Ya existe un pago automático para la factura %', v_invoice.folio;
    END IF;
    
    -- Crear el pago automático (sin asignar remaining_amount)
    INSERT INTO payments (
        client_id, amount, payment_date, payment_method, bank_reference,
        notes, status, applied_amount, created_by
    ) VALUES (
        v_invoice.client_id, 
        v_application_amount, 
        CURRENT_DATE, 
        'automatico',
        'PAGO-AUTO-' || v_invoice.folio,
        'Pago automático generado al marcar factura como pagada: ' || v_invoice.folio,
        'applied', 
        v_application_amount, 
        auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    -- Crear la aplicación del pago
    INSERT INTO payment_applications (
        payment_id, invoice_id, applied_amount, application_method,
        notes, created_by
    ) VALUES (
        v_payment_id, 
        p_invoice_id, 
        v_application_amount, 
        'manual',
        'Aplicación automática para factura: ' || v_invoice.folio, 
        auth.uid()
    );
    
    -- Actualizar la factura (sin tocar remaining_amount)
    UPDATE invoices 
    SET 
        paid_amount = COALESCE(paid_amount, 0) + v_application_amount,
        status = CASE 
            WHEN COALESCE(paid_amount, 0) + v_application_amount >= total 
            THEN 'paid'::invoice_status
            ELSE 'partial'::invoice_status
        END,
        payment_date = CURRENT_DATE, 
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN json_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'invoice_id', p_invoice_id, 
        'amount_paid', v_application_amount,
        'message', 'Pago automático creado y aplicado exitosamente'
    );
END;
$function$;

-- 5. Corregir trigger maintain_payment_consistency para no tocar remaining_amount
CREATE OR REPLACE FUNCTION public.maintain_payment_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payment_total_applied DECIMAL;
  payment_amount DECIMAL;
  invoice_total_paid DECIMAL;
  invoice_total DECIMAL;
  invoice_id_affected UUID;
BEGIN
  -- Solo procesar en INSERT/UPDATE/DELETE de payment_applications
  IF TG_TABLE_NAME = 'payment_applications' THEN
    
    -- Obtener ID del pago afectado
    DECLARE payment_id_affected UUID;
    BEGIN
      payment_id_affected := COALESCE(NEW.payment_id, OLD.payment_id);
      invoice_id_affected := COALESCE(NEW.invoice_id, OLD.invoice_id);
      
      -- Recalcular applied_amount del pago
      SELECT 
        COALESCE(SUM(pa.applied_amount), 0),
        p.amount
      INTO payment_total_applied, payment_amount
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      WHERE p.id = payment_id_affected
      GROUP BY p.amount;
      
      -- Validar que applied_amount no exceda amount
      IF payment_total_applied > payment_amount THEN
        RAISE EXCEPTION 'El monto aplicado (%) no puede exceder el monto del pago (%)', 
          payment_total_applied, payment_amount;
      END IF;
      
      -- Actualizar el pago (sin tocar remaining_amount - se calcula automáticamente)
      UPDATE payments 
      SET 
        applied_amount = payment_total_applied,
        status = CASE 
          WHEN payment_total_applied >= payment_amount THEN 'applied'::payment_status
          WHEN payment_total_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = payment_id_affected;
      
      -- Recalcular paid_amount de la factura afectada
      SELECT 
        COALESCE(SUM(pa.applied_amount), 0),
        i.total
      INTO invoice_total_paid, invoice_total
      FROM invoices i
      LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
      WHERE i.id = invoice_id_affected
      GROUP BY i.total;
      
      -- Actualizar la factura (sin tocar remaining_amount - se calcula automáticamente)
      UPDATE invoices
      SET 
        paid_amount = invoice_total_paid,
        status = CASE 
          WHEN invoice_total_paid >= invoice_total THEN 'paid'::invoice_status
          WHEN invoice_total_paid > 0 THEN 'partial'::invoice_status
          ELSE 'sent'::invoice_status
        END,
        payment_date = CASE 
          WHEN invoice_total_paid >= invoice_total THEN CURRENT_DATE
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_id_affected;
      
    END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 6. Corregir función fix_payment_system_inconsistencies
CREATE OR REPLACE FUNCTION public.fix_payment_system_inconsistencies()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fixed_payments INTEGER := 0;
  fixed_invoices INTEGER := 0;
  payment_record RECORD;
  invoice_record RECORD;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir inconsistencias';
  END IF;

  -- Corregir pagos con applied_amount incorrecto
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      p.applied_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.amount, p.applied_amount
    HAVING p.applied_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR p.applied_amount > p.amount
       OR p.applied_amount < 0
  LOOP
    UPDATE payments 
    SET 
      applied_amount = LEAST(payment_record.calculated_applied, payment_record.amount),
      status = CASE 
        WHEN LEAST(payment_record.calculated_applied, payment_record.amount) >= payment_record.amount THEN 'applied'::payment_status
        WHEN LEAST(payment_record.calculated_applied, payment_record.amount) > 0 THEN 'partial'::payment_status
        ELSE 'pending'::payment_status
      END,
      updated_at = NOW()
    WHERE id = payment_record.id;
    
    fixed_payments := fixed_payments + 1;
  END LOOP;

  -- Corregir facturas con paid_amount incorrecto
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.total,
      i.paid_amount,
      i.status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.total, i.paid_amount, i.status
    HAVING i.paid_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR (i.status = 'paid' AND COALESCE(SUM(pa.applied_amount), 0) < i.total)
       OR (i.status != 'paid' AND COALESCE(SUM(pa.applied_amount), 0) >= i.total)
  LOOP
    UPDATE invoices
    SET 
      paid_amount = invoice_record.calculated_paid,
      status = CASE 
        WHEN invoice_record.calculated_paid >= invoice_record.total THEN 'paid'::invoice_status
        WHEN invoice_record.calculated_paid > 0 THEN 'partial'::invoice_status
        ELSE 'sent'::invoice_status
      END,
      payment_date = CASE 
        WHEN invoice_record.calculated_paid >= invoice_record.total THEN COALESCE(payment_date, CURRENT_DATE)
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = invoice_record.id;
    
    fixed_invoices := fixed_invoices + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_payments', fixed_payments,
    'fixed_invoices', fixed_invoices,
    'message', format('Sistema corregido: %s pagos y %s facturas actualizadas', fixed_payments, fixed_invoices)
  );
END;
$function$;