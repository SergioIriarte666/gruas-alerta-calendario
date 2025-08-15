-- Función para validar consistencia de montos de pagos
CREATE OR REPLACE FUNCTION public.validate_payment_amounts()
RETURNS TABLE(payment_id uuid, folio text, amount numeric, applied_amount numeric, calculated_applied numeric, remaining_amount numeric, is_inconsistent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as payment_id,
    COALESCE(p.bank_reference, 'Sin referencia') as folio,
    p.amount,
    p.applied_amount,
    COALESCE((
      SELECT SUM(pa.applied_amount) 
      FROM public.payment_applications pa 
      WHERE pa.payment_id = p.id
    ), 0) as calculated_applied,
    p.remaining_amount,
    (p.applied_amount > p.amount OR p.remaining_amount < 0 OR 
     p.applied_amount != COALESCE((
       SELECT SUM(pa.applied_amount) 
       FROM public.payment_applications pa 
       WHERE pa.payment_id = p.id
     ), 0)) as is_inconsistent
  FROM public.payments p
  ORDER BY p.created_at DESC;
END;
$function$

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

-- Trigger para validar montos en pagos
CREATE OR REPLACE FUNCTION public.validate_payment_amounts_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar que applied_amount no exceda amount
  IF NEW.applied_amount > NEW.amount THEN
    NEW.applied_amount := NEW.amount;
  END IF;
  
  -- Calcular remaining_amount correcto
  NEW.remaining_amount := NEW.amount - NEW.applied_amount;
  
  -- Actualizar status basado en montos
  IF NEW.applied_amount = 0 THEN
    NEW.status := 'pending'::payment_status;
  ELSIF NEW.applied_amount < NEW.amount THEN
    NEW.status := 'partial'::payment_status;
  ELSIF NEW.applied_amount = NEW.amount THEN
    NEW.status := 'applied'::payment_status;
  END IF;
  
  RETURN NEW;
END;
$function$

-- Crear trigger en la tabla payments
DROP TRIGGER IF EXISTS validate_payment_amounts_trigger ON public.payments;
CREATE TRIGGER validate_payment_amounts_trigger
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_amounts_trigger();

-- Función para obtener estadísticas de reconciliación mejoradas
CREATE OR REPLACE FUNCTION public.get_reconciliation_stats_enhanced()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stats jsonb;
  inconsistent_payments INTEGER;
  negative_amounts INTEGER;
BEGIN
  -- Contar pagos inconsistentes
  SELECT COUNT(*) INTO inconsistent_payments
  FROM public.payments p
  WHERE p.applied_amount > p.amount OR p.remaining_amount < 0;
  
  -- Contar montos negativos
  SELECT COUNT(*) INTO negative_amounts
  FROM public.payments p
  WHERE p.remaining_amount < 0;

  -- Estadísticas generales
  SELECT jsonb_build_object(
    'total_payments', COUNT(*),
    'pending_payments', COUNT(*) FILTER (WHERE status = 'pending'),
    'partial_payments', COUNT(*) FILTER (WHERE status = 'partial'),
    'applied_payments', COUNT(*) FILTER (WHERE status = 'applied'),
    'cancelled_payments', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total_amount', COALESCE(SUM(amount), 0),
    'total_applied', COALESCE(SUM(applied_amount), 0),
    'total_remaining', COALESCE(SUM(remaining_amount), 0),
    'inconsistent_payments', inconsistent_payments,
    'negative_amounts', negative_amounts,
    'needs_repair', (inconsistent_payments > 0 OR negative_amounts > 0)
  ) INTO stats
  FROM public.payments;

  RETURN stats;
END;
$function$