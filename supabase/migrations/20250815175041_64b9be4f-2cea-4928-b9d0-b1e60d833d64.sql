-- Eliminar trigger existente y recrear
DROP TRIGGER IF EXISTS validate_payment_amounts_trigger ON public.payments;

CREATE TRIGGER validate_payment_amounts_trigger
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_amounts_trigger();