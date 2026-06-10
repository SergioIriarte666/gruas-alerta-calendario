-- Update the function to fix the specific payment issue with correct fiscal numbers
CREATE OR REPLACE FUNCTION public.fix_amphos_payment_applications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payment_id UUID := '9234da35-7e10-43e6-b918-b08d18b101be';
  v_removed_count INTEGER := 0;
  v_added_count INTEGER := 0;
  v_final_applied DECIMAL;
  
  -- Invoices that should NOT be paid (to remove)
  wrong_applications UUID[] := ARRAY[
    '21a5dcbe-e8a8-4677-b395-f430c5f4cdf7', -- FACT-4004
    '5ce20c33-f779-4acf-a268-8e2f209149a0', -- FACT-4031  
    '44f1c6e9-c80e-4e0b-86b4-6464755c8cc1', -- FACT-4032
    'b45ab027-a221-4a4a-bde8-d5616864b853'  -- FACT-4035
  ];
  
  -- Invoices that should be paid
  v_fact_4011_id UUID := 'db1e10bc-5100-4691-af9b-a270e6f219c8';
  v_fact_4013_id UUID := '73a50b63-a8ec-48e2-b16c-505882afa3f7';
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Step 1: Remove incorrect applications
  DELETE FROM payment_applications 
  WHERE id = ANY(wrong_applications);
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  -- Step 2: Add missing application for FACT-4011
  INSERT INTO payment_applications (
    payment_id,
    invoice_id, 
    applied_amount,
    application_method,
    created_by
  ) VALUES (
    v_payment_id,
    v_fact_4011_id,
    258388.00,
    'manual',
    auth.uid()
  );
  
  -- Step 3: Complete FACT-4013 payment (add remaining $297,500)
  INSERT INTO payment_applications (
    payment_id,
    invoice_id,
    applied_amount, 
    application_method,
    created_by
  ) VALUES (
    v_payment_id,
    v_fact_4013_id,
    297500.00,
    'manual',
    auth.uid()
  );
  
  v_added_count := 2;
  
  -- Step 4: Calculate final applied amount
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_final_applied
  FROM payment_applications
  WHERE payment_id = v_payment_id;
  
  -- Step 5: Update payment status (should remain 'applied')
  UPDATE payments 
  SET 
    applied_amount = v_final_applied,
    status = 'applied'::payment_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'removed_applications', v_removed_count,
    'added_applications', v_added_count,
    'final_applied_amount', v_final_applied,
    'message', format('Corregido pago Amphos 21: eliminadas %s aplicaciones incorrectas, agregadas %s correctas. Total aplicado: $%s', 
      v_removed_count, v_added_count, v_final_applied)
  );
END;
$function$;