-- Función para limpiar duplicados de pagos
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  duplicate_record RECORD;
  deleted_count INTEGER := 0;
  kept_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden limpiar duplicados';
  END IF;

  -- Identificar y eliminar duplicados, manteniendo el más reciente
  FOR duplicate_record IN 
    SELECT 
      client_id,
      amount,
      payment_date,
      payment_method,
      array_agg(id ORDER BY created_at DESC) as payment_ids,
      COUNT(*) as duplicate_count
    FROM public.payments 
    GROUP BY client_id, amount, payment_date, payment_method
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer pago (más reciente) y eliminar los duplicados
    FOR i IN 2..array_length(duplicate_record.payment_ids, 1) LOOP
      -- Eliminar aplicaciones de pago duplicadas
      DELETE FROM public.payment_applications 
      WHERE payment_id = duplicate_record.payment_ids[i];
      
      -- Eliminar el pago duplicado
      DELETE FROM public.payments 
      WHERE id = duplicate_record.payment_ids[i];
      
      deleted_count := deleted_count + 1;
    END LOOP;
    
    kept_count := kept_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_payments', deleted_count,
    'kept_payments', kept_count,
    'message', format('Limpieza completada: eliminados %s duplicados, mantenidos %s pagos únicos', deleted_count, kept_count)
  );
END;
$$;

-- Función para prevenir duplicados futuros
CREATE OR REPLACE FUNCTION public.prevent_duplicate_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Verificar si ya existe un pago similar en las últimas 24 horas
  SELECT COUNT(*) INTO existing_count
  FROM public.payments 
  WHERE client_id = NEW.client_id
    AND amount = NEW.amount
    AND payment_date = NEW.payment_date
    AND payment_method = NEW.payment_method
    AND created_at > now() - interval '24 hours'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un pago similar para este cliente en las últimas 24 horas. Posible duplicado detectado.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para prevenir duplicados
DROP TRIGGER IF EXISTS prevent_payment_duplicates ON public.payments;
CREATE TRIGGER prevent_payment_duplicates
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_payments();

-- Actualizar el cálculo de remaining_amount automáticamente
CREATE OR REPLACE FUNCTION public.update_payment_remaining_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Calcular remaining_amount basado en amount - applied_amount
  NEW.remaining_amount := NEW.amount - COALESCE(NEW.applied_amount, 0);
  
  -- Actualizar status basado en amounts
  IF NEW.applied_amount >= NEW.amount THEN
    NEW.status := 'applied';
  ELSIF NEW.applied_amount > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para actualización automática
DROP TRIGGER IF EXISTS update_payment_amounts ON public.payments;
CREATE TRIGGER update_payment_amounts
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_remaining_amount();