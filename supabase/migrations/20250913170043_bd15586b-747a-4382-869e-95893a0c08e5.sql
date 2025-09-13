-- Función para recalcular automáticamente el estado de una factura
CREATE OR REPLACE FUNCTION public.auto_update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_total NUMERIC;
  v_invoice_due_date DATE;
  v_total_applied NUMERIC;
  v_new_status invoice_status;
BEGIN
  -- Determinar el invoice_id según el tipo de operación
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  
  -- Obtener información de la factura
  SELECT total, due_date INTO v_invoice_total, v_invoice_due_date
  FROM invoices 
  WHERE id = v_invoice_id;
  
  -- Calcular total aplicado
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
  FROM payment_applications 
  WHERE invoice_id = v_invoice_id;
  
  -- Determinar nuevo estado
  IF v_total_applied >= v_invoice_total THEN
    v_new_status := 'paid'::invoice_status;
  ELSIF v_total_applied > 0 THEN
    v_new_status := 'partial'::invoice_status;
  ELSIF v_invoice_due_date < CURRENT_DATE THEN
    v_new_status := 'overdue'::invoice_status;
  ELSE
    v_new_status := 'sent'::invoice_status;
  END IF;
  
  -- Actualizar la factura (sin tocar campos generados automáticamente)
  UPDATE invoices 
  SET 
    paid_amount = v_total_applied,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
      WHEN v_new_status != 'paid' THEN NULL
      ELSE payment_date
    END,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  -- Log para debugging
  RAISE NOTICE 'Auto-updated invoice %: total_applied=%, status=%', v_invoice_id, v_total_applied, v_new_status;
  
  -- Retornar registro apropiado según la operación
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger que se ejecuta automáticamente en cambios de payment_applications
DROP TRIGGER IF EXISTS payment_applications_auto_update_invoice_status ON payment_applications;

CREATE TRIGGER payment_applications_auto_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_invoice_status();

-- Función de mantenimiento para corrección masiva (mejorada)
CREATE OR REPLACE FUNCTION public.fix_all_invoice_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  invoice_record RECORD;
  fixed_count INTEGER := 0;
  total_applied NUMERIC;
  new_status invoice_status;
  old_status invoice_status;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar correcciones masivas';
  END IF;

  -- Procesar todas las facturas
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.due_date,
      i.status as current_status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid_amount
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.folio, i.total, i.due_date, i.status
  LOOP
    total_applied := invoice_record.calculated_paid_amount;
    old_status := invoice_record.current_status;
    
    -- Determinar estado correcto
    IF total_applied >= invoice_record.total THEN
      new_status := 'paid'::invoice_status;
    ELSIF total_applied > 0 THEN
      new_status := 'partial'::invoice_status;
    ELSIF invoice_record.due_date < CURRENT_DATE THEN
      new_status := 'overdue'::invoice_status;
    ELSE
      new_status := 'sent'::invoice_status;
    END IF;
    
    -- Actualizar solo si hay cambios
    IF old_status != new_status OR ABS(COALESCE((SELECT paid_amount FROM invoices WHERE id = invoice_record.id), 0) - total_applied) > 0.01 THEN
      UPDATE invoices 
      SET 
        paid_amount = total_applied,
        status = new_status,
        payment_date = CASE 
          WHEN new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
          WHEN new_status != 'paid' THEN NULL
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Corregida factura %: % -> %, paid_amount: %', 
        invoice_record.folio, old_status, new_status, total_applied;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con estados inconsistentes', fixed_count),
    'timestamp', NOW()
  );
END;
$$;