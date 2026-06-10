-- Función corregida para crear payment desde income existente
CREATE OR REPLACE FUNCTION create_payment_from_existing_income(p_income_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_income RECORD;
  v_payment_id UUID;
  v_apply_result jsonb;
BEGIN
  -- Obtener datos del income
  SELECT * INTO v_income FROM incomes WHERE id = p_income_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Income no encontrado');
  END IF;

  -- Validar que tenga invoice_id asociado
  IF v_income.invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Income no tiene factura asociada');
  END IF;

  -- Crear el payment (SIN remaining_amount porque es calculado automáticamente)
  INSERT INTO payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    applied_amount
  ) VALUES (
    v_income.client_id,
    v_income.amount,
    v_income.income_date,
    v_income.payment_method,
    v_income.bank_reference,
    'Creado desde ingreso: ' || COALESCE(v_income.description, 'Sin descripción'),
    'pending',
    0
  ) RETURNING id INTO v_payment_id;

  -- Aplicar el payment a la factura usando apply_payment_manual
  SELECT apply_payment_manual(
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', v_income.invoice_id,
        'amount', v_income.amount
      )
    )
  ) INTO v_apply_result;

  -- Verificar resultado de la aplicación
  IF v_apply_result->>'status' != 'success' THEN
    -- Rollback: eliminar el payment creado
    DELETE FROM payments WHERE id = v_payment_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error al aplicar payment: ' || (v_apply_result->>'message')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'message', 'Payment creado y aplicado exitosamente',
    'details', v_apply_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar la corrección para FACT-4033
SELECT create_payment_from_existing_income('e33f5689-619b-4e4b-a003-5859d7e0ffeb'::uuid);