-- Trigger para validar montos en pagos y estadísticas mejoradas
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