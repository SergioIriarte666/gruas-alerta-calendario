-- Solución global para corrección automática de estados de facturas
-- Problema: Facturas pagadas que no actualizan su estado correctamente

-- 1. Función para corregir TODOS los estados de facturas globalmente
CREATE OR REPLACE FUNCTION public.fix_all_invoice_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  invoice_record RECORD;
  calculated_paid DECIMAL;
  calculated_status invoice_status;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir estados globalmente';
  END IF;

  -- Corregir TODAS las facturas recalculando su estado real basado en pagos aplicados
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.paid_amount as current_paid,
      i.status as current_status,
      COALESCE(SUM(pa.applied_amount), 0) as real_paid_amount
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.folio, i.total, i.paid_amount, i.status
  LOOP
    calculated_paid := invoice_record.real_paid_amount;
    
    -- Determinar el estado correcto basado en pagos reales
    IF calculated_paid >= invoice_record.total THEN
      calculated_status := 'paid'::invoice_status;
    ELSIF calculated_paid > 0 THEN
      calculated_status := 'partial'::invoice_status;
    ELSIF invoice_record.current_status = 'draft' THEN
      calculated_status := 'draft'::invoice_status;
    ELSE
      calculated_status := 'sent'::invoice_status;
    END IF;
    
    -- Solo actualizar si hay cambios
    IF invoice_record.current_paid != calculated_paid OR 
       invoice_record.current_status != calculated_status THEN
      
      UPDATE invoices 
      SET 
        paid_amount = calculated_paid,
        status = calculated_status,
        payment_date = CASE 
          WHEN calculated_status = 'paid' THEN COALESCE(payment_date, CURRENT_DATE)
          WHEN calculated_status != 'paid' THEN NULL
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Factura % corregida: paid_amount % -> %, status % -> %', 
        invoice_record.folio, 
        invoice_record.current_paid, 
        calculated_paid,
        invoice_record.current_status,
        calculated_status;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con estados inconsistentes', fixed_count),
    'timestamp', NOW()
  );
END;
$function$;

-- 2. Función mejorada para mantener consistencia en tiempo real
CREATE OR REPLACE FUNCTION public.maintain_payment_consistency_enhanced()
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
  payment_id_affected UUID;
BEGIN
  -- Procesar cambios en payment_applications
  IF TG_TABLE_NAME = 'payment_applications' THEN
    payment_id_affected := COALESCE(NEW.payment_id, OLD.payment_id);
    invoice_id_affected := COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- ACTUALIZAR PAGO AFECTADO
    IF payment_id_affected IS NOT NULL THEN
      SELECT 
        p.amount,
        COALESCE(SUM(pa.applied_amount), 0)
      INTO payment_amount, payment_total_applied
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      WHERE p.id = payment_id_affected
      GROUP BY p.amount;
      
      -- Validar límites
      IF payment_total_applied > payment_amount THEN
        RAISE EXCEPTION 'El monto aplicado (%) excede el monto del pago (%)', 
          payment_total_applied, payment_amount;
      END IF;
      
      -- Actualizar pago
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
    END IF;
    
    -- ACTUALIZAR FACTURA AFECTADA
    IF invoice_id_affected IS NOT NULL THEN
      SELECT 
        i.total,
        COALESCE(SUM(pa.applied_amount), 0)
      INTO invoice_total, invoice_total_paid
      FROM invoices i
      LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
      WHERE i.id = invoice_id_affected
      GROUP BY i.total;
      
      -- Actualizar factura con estado correcto
      UPDATE invoices
      SET 
        paid_amount = invoice_total_paid,
        status = CASE 
          WHEN invoice_total_paid >= invoice_total THEN 'paid'::invoice_status
          WHEN invoice_total_paid > 0 THEN 'partial'::invoice_status
          ELSE CASE 
            WHEN status = 'draft' THEN 'draft'::invoice_status
            ELSE 'sent'::invoice_status
          END
        END,
        payment_date = CASE 
          WHEN invoice_total_paid >= invoice_total THEN COALESCE(payment_date, CURRENT_DATE)
          WHEN invoice_total_paid = 0 THEN NULL
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_id_affected;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3. Reemplazar el trigger existente con la versión mejorada
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;
CREATE TRIGGER maintain_payment_consistency_enhanced_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payment_applications
    FOR EACH ROW EXECUTE FUNCTION maintain_payment_consistency_enhanced();

-- 4. Ejecutar corrección global inmediata
SELECT public.fix_all_invoice_statuses();