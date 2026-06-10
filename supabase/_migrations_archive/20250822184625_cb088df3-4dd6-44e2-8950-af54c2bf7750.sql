-- Corrección Global del Sistema de Conciliación de Pagos

-- 1. Corregir función maintain_payment_consistency para evitar duplicaciones
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
      
      -- Recalcular applied_amount del pago (SIN duplicación)
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
      
      -- Actualizar el pago con los montos correctos
      UPDATE payments 
      SET 
        applied_amount = payment_total_applied,
        remaining_amount = payment_amount - payment_total_applied,
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
      
      -- Actualizar la factura con estado correcto
      UPDATE invoices
      SET 
        paid_amount = invoice_total_paid,
        remaining_amount = invoice_total - invoice_total_paid,
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

-- 2. Crear función para corregir inconsistencias existentes
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
      remaining_amount = payment_record.amount - LEAST(payment_record.calculated_applied, payment_record.amount),
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
      remaining_amount = invoice_record.total - invoice_record.calculated_paid,
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

-- 3. Crear función para eliminar aplicaciones duplicadas
CREATE OR REPLACE FUNCTION public.remove_duplicate_payment_applications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar duplicados';
  END IF;

  -- Eliminar aplicaciones duplicadas (mantener solo la más reciente)
  DELETE FROM payment_applications 
  WHERE id IN (
    SELECT id FROM (
      SELECT id, 
             ROW_NUMBER() OVER (
               PARTITION BY payment_id, invoice_id 
               ORDER BY created_at DESC
             ) as rn
      FROM payment_applications
    ) ranked 
    WHERE rn > 1
  );
  
  GET DIAGNOSTICS removed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'removed_duplicates', removed_count,
    'message', format('Eliminadas %s aplicaciones duplicadas', removed_count)
  );
END;
$function$;

-- 4. Crear constraint para evitar referencias bancarias duplicadas por cliente
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_unique_bank_reference_per_client'
  ) THEN
    ALTER TABLE payments 
    ADD CONSTRAINT payments_unique_bank_reference_per_client 
    UNIQUE (client_id, bank_reference, payment_date);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    -- El constraint ya existe, no hacer nada
    NULL;
END $$;

-- 5. Crear función de diagnóstico completo
CREATE OR REPLACE FUNCTION public.comprehensive_payment_diagnosis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  diagnosis jsonb;
  inconsistent_payments INTEGER;
  inconsistent_invoices INTEGER;
  duplicate_applications INTEGER;
  orphaned_applications INTEGER;
BEGIN
  -- Contar pagos inconsistentes
  SELECT COUNT(*) INTO inconsistent_payments
  FROM (
    SELECT 
      p.id,
      p.applied_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.applied_amount
    HAVING p.applied_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR p.applied_amount > (SELECT amount FROM payments WHERE id = p.id)
  ) inconsistent;

  -- Contar facturas inconsistentes
  SELECT COUNT(*) INTO inconsistent_invoices
  FROM (
    SELECT 
      i.id,
      i.paid_amount,
      i.status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.paid_amount, i.status
    HAVING i.paid_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR (i.status = 'paid' AND COALESCE(SUM(pa.applied_amount), 0) < i.total)
  ) inconsistent;

  -- Contar aplicaciones duplicadas
  SELECT COUNT(*) INTO duplicate_applications
  FROM (
    SELECT payment_id, invoice_id, COUNT(*) as duplicates
    FROM payment_applications
    GROUP BY payment_id, invoice_id
    HAVING COUNT(*) > 1
  ) duplicates;

  -- Contar aplicaciones huérfanas
  SELECT COUNT(*) INTO orphaned_applications
  FROM payment_applications pa
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id)
     OR NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = pa.invoice_id);

  diagnosis := jsonb_build_object(
    'timestamp', NOW(),
    'system_health', CASE 
      WHEN inconsistent_payments = 0 AND inconsistent_invoices = 0 
           AND duplicate_applications = 0 AND orphaned_applications = 0 
      THEN 'HEALTHY' 
      ELSE 'NEEDS_REPAIR' 
    END,
    'issues', jsonb_build_object(
      'inconsistent_payments', inconsistent_payments,
      'inconsistent_invoices', inconsistent_invoices,
      'duplicate_applications', duplicate_applications,
      'orphaned_applications', orphaned_applications
    ),
    'total_issues', inconsistent_payments + inconsistent_invoices + duplicate_applications + orphaned_applications
  );

  RETURN diagnosis;
END;
$function$;