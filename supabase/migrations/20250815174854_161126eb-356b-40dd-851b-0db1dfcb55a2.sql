-- Función para recalcular balances de pagos
CREATE OR REPLACE FUNCTION public.recalculate_payment_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  updated_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden recalcular balances de pagos';
  END IF;

  -- Recalcular para cada pago
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      COALESCE((
        SELECT SUM(pa.applied_amount) 
        FROM public.payment_applications pa 
        WHERE pa.payment_id = p.id
      ), 0) as real_applied_amount
    FROM public.payments p
  LOOP
    BEGIN
      -- Actualizar applied_amount y remaining_amount
      UPDATE public.payments 
      SET 
        applied_amount = payment_record.real_applied_amount,
        remaining_amount = payment_record.amount - payment_record.real_applied_amount,
        status = CASE 
          WHEN payment_record.real_applied_amount = 0 THEN 'pending'::payment_status
          WHEN payment_record.real_applied_amount < payment_record.amount THEN 'partial'::payment_status
          WHEN payment_record.real_applied_amount = payment_record.amount THEN 'applied'::payment_status
          ELSE 'partial'::payment_status
        END,
        updated_at = now()
      WHERE id = payment_record.id;
      
      updated_count := updated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING 'Error actualizando pago %: %', payment_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_payments', updated_count,
    'error_count', error_count,
    'message', format('Recalculados %s pagos exitosamente', updated_count)
  );
END;
$function$