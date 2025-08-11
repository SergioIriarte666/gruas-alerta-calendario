-- Función para actualizar facturas vencidas automáticamente
CREATE OR REPLACE FUNCTION public.update_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Actualizar facturas que han pasado su fecha de vencimiento
  UPDATE public.invoices 
  SET 
    status = 'overdue',
    updated_at = now()
  WHERE 
    status IN ('sent', 'draft') 
    AND due_date < CURRENT_DATE
    AND status != 'overdue'
    AND status != 'paid'
    AND status != 'cancelled';
    
  -- Log para debugging
  RAISE NOTICE 'Updated overdue invoices at: %', now();
END;
$function$;

-- Función para obtener facturas que deberían estar vencidas (incluso si no tienen el status correcto)
CREATE OR REPLACE FUNCTION public.get_overdue_invoices_for_alerts()
RETURNS TABLE(
  id uuid,
  folio text,
  client_name text,
  due_date date,
  total numeric,
  days_overdue integer,
  status invoice_status
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (CURRENT_DATE - i.due_date)::integer as days_overdue,
    i.status
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE 
    i.due_date < CURRENT_DATE
    AND i.status IN ('sent', 'draft', 'overdue')
    AND i.status != 'paid'
    AND i.status != 'cancelled'
  ORDER BY i.due_date ASC;
END;
$function$;

-- Función para corregir facturas vencidas existentes (ejecutar una vez)
CREATE OR REPLACE FUNCTION public.fix_existing_overdue_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función';
  END IF;

  -- Actualizar facturas vencidas
  UPDATE public.invoices 
  SET 
    status = 'overdue',
    updated_at = now()
  WHERE 
    status IN ('sent', 'draft') 
    AND due_date < CURRENT_DATE
    AND status != 'overdue'
    AND status != 'paid'
    AND status != 'cancelled';
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_invoices', updated_count,
    'message', format('Se actualizaron %s facturas vencidas', updated_count),
    'timestamp', now()
  );
END;
$function$;

-- Trigger que verifica y actualiza facturas vencidas en cada inserción/actualización
CREATE OR REPLACE FUNCTION public.check_and_update_overdue_invoices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ejecutar la actualización automática de facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  -- Si la factura actual también debería estar vencida, actualizarla
  IF NEW.status IN ('sent', 'draft') AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger en la tabla de facturas
DROP TRIGGER IF EXISTS check_overdue_invoices_trigger ON public.invoices;
CREATE TRIGGER check_overdue_invoices_trigger
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_update_overdue_invoices();