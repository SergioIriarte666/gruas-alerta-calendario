-- Corrección del Sistema de Conciliación de Pagos
-- Problema: create_automatic_payment_for_invoice actualiza manualmente paid_amount
-- y el trigger auto_update_invoice_status también lo hace, causando duplicaciones

-- 1. Eliminar función existente y recrearla corregida
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid);

CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(p_invoice_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id uuid;
  v_application_amount numeric;
BEGIN
  -- Obtener información de la factura
  SELECT 
    i.id,
    i.folio,
    i.client_id,
    i.total,
    COALESCE(i.paid_amount, 0) as paid_amount,
    i.remaining_amount,
    c.name as client_name
  INTO v_invoice
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  
  -- Validar que la factura no esté ya pagada completamente
  IF v_invoice.remaining_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'La factura ya está completamente pagada',
      'invoice_id', p_invoice_id
    );
  END IF;
  
  -- Calcular monto a aplicar (remaining_amount)
  v_application_amount := v_invoice.remaining_amount;
  
  -- Crear el pago automático
  INSERT INTO payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    applied_amount,
    created_by
  ) VALUES (
    v_invoice.client_id,
    v_application_amount,
    CURRENT_DATE,
    'transferencia',
    'PAGO-AUTO-' || v_invoice.folio,
    'Pago automático generado para factura ' || v_invoice.folio,
    'applied',
    v_application_amount,
    auth.uid()
  ) RETURNING id INTO v_payment_id;
  
  -- Crear la aplicación de pago
  INSERT INTO payment_applications (
    payment_id,
    invoice_id,
    applied_amount,
    application_method,
    notes,
    created_by
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    v_application_amount,
    'manual',
    'Aplicación automática - Marcar como pagada',
    auth.uid()
  );
  
  -- CORRECCIÓN: Solo actualizar payment_date
  -- El trigger auto_update_invoice_status se encarga de:
  -- - Calcular paid_amount correctamente
  -- - Actualizar status
  -- - Actualizar remaining_amount
  UPDATE invoices 
  SET 
    payment_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'applied_amount', v_application_amount,
    'message', 'Pago automático creado exitosamente'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en create_automatic_payment_for_invoice: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'invoice_id', p_invoice_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Función para corregir facturas con paid_amount duplicado
CREATE OR REPLACE FUNCTION public.fix_duplicate_paid_amounts()
RETURNS jsonb AS $$
DECLARE
  fixed_count INTEGER := 0;
  invoice_record RECORD;
  calculated_paid NUMERIC;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Buscar facturas con paid_amount != suma de aplicaciones
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.paid_amount as current_paid,
      COALESCE(SUM(pa.applied_amount), 0) as correct_paid
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.folio, i.total, i.paid_amount
    HAVING ABS(i.paid_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
  LOOP
    calculated_paid := invoice_record.correct_paid;
    
    -- Actualizar directamente con el monto correcto
    UPDATE invoices 
    SET 
      paid_amount = calculated_paid,
      status = CASE 
        WHEN calculated_paid >= total THEN 'paid'::invoice_status
        WHEN calculated_paid > 0 THEN 'partial'::invoice_status
        WHEN due_date < CURRENT_DATE THEN 'overdue'::invoice_status
        ELSE 'sent'::invoice_status
      END,
      payment_date = CASE 
        WHEN calculated_paid >= total AND payment_date IS NULL THEN CURRENT_DATE
        WHEN calculated_paid < total THEN NULL
        ELSE payment_date
      END,
      updated_at = NOW()
    WHERE id = invoice_record.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE NOTICE 'Corregida factura %: paid_amount % -> % (diferencia: %)', 
      invoice_record.folio, 
      invoice_record.current_paid, 
      calculated_paid,
      invoice_record.current_paid - calculated_paid;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con paid_amount duplicado', fixed_count),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;