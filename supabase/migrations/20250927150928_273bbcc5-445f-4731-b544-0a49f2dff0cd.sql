-- Final comprehensive function to fix the duplicate FACT-4011 application
CREATE OR REPLACE FUNCTION public.fix_duplicate_fact_4011_application()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_main_payment_id UUID := '9234da35-7e10-43e6-b918-b08d18b101be';
  v_fact_4011_id UUID := 'db1e10bc-5100-4691-af9b-a270e6f219c8';
  v_removed_amount DECIMAL;
  v_final_applied DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Get the amount being removed for logging
  SELECT applied_amount INTO v_removed_amount
  FROM payment_applications 
  WHERE payment_id = v_main_payment_id AND invoice_id = v_fact_4011_id;

  -- Remove the duplicate application from the main payment to FACT-4011
  -- FACT-4011 should only be paid by its own separate payment
  DELETE FROM payment_applications 
  WHERE payment_id = v_main_payment_id 
    AND invoice_id = v_fact_4011_id;

  -- Calculate final applied amount for main payment
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_final_applied
  FROM payment_applications
  WHERE payment_id = v_main_payment_id;

  -- Update main payment status
  UPDATE payments 
  SET 
    applied_amount = v_final_applied,
    status = CASE 
      WHEN v_final_applied >= amount THEN 'applied'::payment_status
      WHEN v_final_applied > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = v_main_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'main_payment_id', v_main_payment_id,
    'removed_duplicate_amount', v_removed_amount,
    'final_applied_amount', v_final_applied,
    'message', format('Eliminada aplicación duplicada de FACT-4011: $%s. El pago principal ahora aplica $%s correctamente.', 
      v_removed_amount, v_final_applied)
  );
END;
$function$;