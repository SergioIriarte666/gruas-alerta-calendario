-- Función para reparar aplicación de pago a factura (casos retroactivos)
CREATE OR REPLACE FUNCTION repair_payment_application(
  p_payment_id UUID,
  p_invoice_id UUID
)
RETURNS jsonb AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
BEGIN
  -- Obtener payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment no encontrado');
  END IF;
  
  -- Obtener invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice no encontrado');
  END IF;
  
  -- Verificar que no exista ya una aplicación
  IF EXISTS (
    SELECT 1 FROM payment_applications 
    WHERE payment_id = p_payment_id AND invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe una aplicación para este pago e invoice');
  END IF;
  
  -- Aplicar usando la función existente
  RETURN apply_payment_manual(
    p_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'amount', LEAST(v_payment.remaining_amount, v_invoice.remaining_amount)
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;