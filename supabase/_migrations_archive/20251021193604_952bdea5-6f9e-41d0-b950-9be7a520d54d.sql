-- Función para sincronizar un ingreso específico a pago (casos retroactivos)
CREATE OR REPLACE FUNCTION sync_specific_income_to_payment(p_income_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_income RECORD;
  v_payment_id UUID;
  v_result jsonb;
BEGIN
  -- Obtener el ingreso
  SELECT * INTO v_income FROM incomes WHERE id = p_income_id;
  
  -- Validar que el ingreso existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El ingreso no existe'
    );
  END IF;
  
  -- Validar que tiene cliente y factura asociada
  IF v_income.invoice_id IS NULL OR v_income.client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El ingreso debe tener cliente y factura asociada'
    );
  END IF;
  
  -- Verificar si ya existe un payment similar (mismo cliente, monto y fecha)
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE client_id = v_income.client_id
    AND amount = v_income.amount
    AND payment_date = v_income.income_date
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ya existe un pago con estas características (mismo cliente, monto y fecha)'
    );
  END IF;
  
  -- Crear el payment
  INSERT INTO payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    remaining_amount
  ) VALUES (
    v_income.client_id,
    v_income.amount,
    v_income.income_date,
    v_income.payment_method,
    v_income.bank_reference,
    'Sincronizado desde ingreso: ' || v_income.description,
    'pending',
    v_income.amount
  )
  RETURNING id INTO v_payment_id;
  
  -- Aplicar a la factura usando la función existente
  SELECT apply_payment_manual(
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', v_income.invoice_id,
        'amount', v_income.amount
      )
    )
  ) INTO v_result;
  
  -- Verificar si la aplicación fue exitosa
  IF v_result->>'success' = 'true' THEN
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'message', 'Pago creado y aplicado exitosamente a la factura'
    );
  ELSE
    -- Si hubo error al aplicar, eliminar el payment creado
    DELETE FROM payments WHERE id = v_payment_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al aplicar el pago a la factura: ' || COALESCE(v_result->>'error', 'Error desconocido')
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error inesperado: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;