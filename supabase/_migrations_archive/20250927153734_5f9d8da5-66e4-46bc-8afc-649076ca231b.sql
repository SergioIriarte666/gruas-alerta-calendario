-- Recreate the missing payment consistency trigger system
CREATE OR REPLACE FUNCTION public.maintain_payment_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payment_id UUID;
  v_total_applied DECIMAL;
  v_payment_amount DECIMAL;
  v_new_status payment_status;
BEGIN
  -- Determine which payment to update
  IF TG_OP = 'DELETE' THEN
    v_payment_id := OLD.payment_id;
  ELSE
    v_payment_id := NEW.payment_id;
  END IF;
  
  -- Get payment amount
  SELECT amount INTO v_payment_amount
  FROM payments WHERE id = v_payment_id;
  
  -- Calculate total applied amount from applications
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
  FROM payment_applications 
  WHERE payment_id = v_payment_id;
  
  -- Determine new status
  IF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied'::payment_status;
  ELSIF v_total_applied > 0 THEN
    v_new_status := 'partial'::payment_status;
  ELSE
    v_new_status := 'pending'::payment_status;
  END IF;
  
  -- Update payment (without touching generated columns)
  UPDATE payments 
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;

-- Create the trigger
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION maintain_payment_consistency();

-- Function to fix all applied amount duplications
CREATE OR REPLACE FUNCTION public.fix_applied_amount_duplications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  payment_record RECORD;
  fixed_count INTEGER := 0;
  total_inconsistent INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Count total inconsistent payments
  SELECT COUNT(*) INTO total_inconsistent
  FROM (
    SELECT 
      p.id,
      p.applied_amount as recorded_applied,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.applied_amount
    HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
  ) inconsistent;

  -- Fix each inconsistent payment
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      p.applied_amount as recorded_applied,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied,
      c.name as client_name
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    LEFT JOIN clients c ON p.client_id = c.id
    GROUP BY p.id, p.amount, p.applied_amount, c.name
    HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
  LOOP
    -- Update payment with correct applied amount
    UPDATE payments 
    SET 
      applied_amount = payment_record.calculated_applied,
      status = CASE 
        WHEN payment_record.calculated_applied >= payment_record.amount THEN 'applied'::payment_status
        WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
        ELSE 'pending'::payment_status
      END,
      updated_at = NOW()
    WHERE id = payment_record.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE NOTICE 'Corregido pago de %: applied_amount % -> %', 
      payment_record.client_name, 
      payment_record.recorded_applied, 
      payment_record.calculated_applied;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_inconsistent_found', total_inconsistent,
    'payments_fixed', fixed_count,
    'message', format('Corregidos %s de %s pagos con applied_amount incorrecto', fixed_count, total_inconsistent),
    'timestamp', NOW()
  );
END;
$function$;