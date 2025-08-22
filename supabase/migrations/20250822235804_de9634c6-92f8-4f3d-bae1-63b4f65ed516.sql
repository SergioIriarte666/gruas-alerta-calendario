-- Continuar con las correcciones del sistema de reconciliación

-- 4. Corregir trigger maintain_payment_consistency para no tocar remaining_amount
DROP FUNCTION IF EXISTS public.maintain_payment_consistency();
CREATE FUNCTION public.maintain_payment_consistency()
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

-- 5. Corregir función fix_payment_system_inconsistencies
DROP FUNCTION IF EXISTS public.fix_payment_system_inconsistencies();
CREATE FUNCTION public.fix_payment_system_inconsistencies()
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