-- Función para corregir montos negativos
CREATE OR REPLACE FUNCTION public.fix_negative_remaining_amounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fixed_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir montos negativos';
  END IF;

  -- Corregir pagos con remaining_amount negativo
  UPDATE public.payments 
  SET 
    applied_amount = LEAST(applied_amount, amount),
    remaining_amount = GREATEST(amount - applied_amount, 0),
    status = CASE 
      WHEN LEAST(applied_amount, amount) = 0 THEN 'pending'::payment_status
      WHEN LEAST(applied_amount, amount) < amount THEN 'partial'::payment_status
      WHEN LEAST(applied_amount, amount) = amount THEN 'applied'::payment_status
      ELSE 'partial'::payment_status
    END,
    updated_at = now()
  WHERE remaining_amount < 0 OR applied_amount > amount;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', fixed_count,
    'message', format('Corregidos %s pagos con montos negativos', fixed_count)
  );
END;
$function$