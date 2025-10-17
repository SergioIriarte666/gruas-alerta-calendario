-- Corrección Inmediata: Redirigir pago de FACT-4073 a FACT-4084
-- UUID del pago correcto: 6f507d9b-45d6-4454-98db-aa1aee4dcfd2

DO $$
DECLARE
  v_payment_id uuid := '6f507d9b-45d6-4454-98db-aa1aee4dcfd2'; -- UUID correcto del pago
  v_wrong_invoice_id uuid := '035bc289-d14b-4f01-a3e2-2b86cccfc5e9'; -- FACT-4073
  v_correct_invoice_id uuid := '3fa9fe6b-5cb4-45ff-87e7-efb65e4d9c4f'; -- FACT-4084
  v_payment_amount numeric := 714000;
BEGIN
  -- 1. Eliminar aplicación incorrecta de FACT-4073
  DELETE FROM payment_applications 
  WHERE payment_id = v_payment_id 
    AND invoice_id = v_wrong_invoice_id;
  
  -- 2. Resetear FACT-4073 a estado 'sent' (no pagada)
  UPDATE invoices 
  SET 
    paid_amount = 0,
    status = 'sent'::invoice_status,
    payment_date = NULL,
    updated_at = NOW()
  WHERE id = v_wrong_invoice_id;
  
  -- 3. Crear aplicación correcta a FACT-4084
  INSERT INTO payment_applications (
    payment_id,
    invoice_id,
    applied_amount,
    application_method,
    notes,
    created_at
  ) VALUES (
    v_payment_id,
    v_correct_invoice_id,
    v_payment_amount,
    'manual'::application_method,
    'Corrección manual: Pago redirigido de FACT-4073 a FACT-4084',
    NOW()
  );
  
  -- 4. Actualizar FACT-4084 como pagada
  UPDATE invoices 
  SET 
    paid_amount = v_payment_amount,
    status = 'paid'::invoice_status,
    payment_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_correct_invoice_id;
  
  -- 5. Actualizar el pago como aplicado
  UPDATE payments 
  SET 
    applied_amount = v_payment_amount,
    status = 'applied'::payment_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  RAISE NOTICE 'Corrección completada exitosamente: Pago redirigido de FACT-4073 a FACT-4084';
END $$;