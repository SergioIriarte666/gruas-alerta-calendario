-- Mejorar el sistema de facturas vencidas (Corregido)
-- =====================================================

-- 1. Recrear el trigger para actualización automática de facturas vencidas
DROP TRIGGER IF EXISTS check_and_update_overdue_invoices_trigger ON public.invoices;

CREATE OR REPLACE FUNCTION public.check_and_update_overdue_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ejecutar actualización global de facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  -- Si es INSERT o UPDATE, verificar la factura actual
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Verificar si la factura actual debería estar vencida
    IF NEW.due_date < CURRENT_DATE 
       AND NEW.status IN ('sent', 'draft') 
       AND NEW.status != 'overdue'
       AND NEW.status != 'paid'
       AND NEW.status != 'cancelled' THEN
      NEW.status := 'overdue';
      NEW.updated_at := now();
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear trigger que se ejecuta antes de INSERT/UPDATE
CREATE TRIGGER check_and_update_overdue_invoices_trigger
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_update_overdue_invoices();

-- 2. Recrear función para corrección manual (eliminar la existente primero)
DROP FUNCTION IF EXISTS public.fix_existing_overdue_invoices();

CREATE OR REPLACE FUNCTION public.fix_existing_overdue_invoices()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función';
  END IF;

  -- Contar cuántas facturas se actualizarán
  SELECT COUNT(*) INTO updated_count
  FROM public.invoices 
  WHERE status IN ('sent', 'draft') 
    AND due_date < CURRENT_DATE
    AND status != 'overdue'
    AND status != 'paid'
    AND status != 'cancelled';

  -- Ejecutar la actualización de facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  RETURN 'Actualización completada: ' || updated_count || ' facturas actualizadas a estado vencido';
END;
$$;

-- 3. Crear función para obtener estadísticas de facturas vencidas
CREATE OR REPLACE FUNCTION public.get_invoice_overdue_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_overdue INTEGER;
  total_amount NUMERIC;
  avg_days_overdue NUMERIC;
  oldest_overdue INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(total), 0),
    COALESCE(AVG(CURRENT_DATE - due_date), 0),
    COALESCE(MAX(CURRENT_DATE - due_date), 0)
  INTO 
    total_overdue, 
    total_amount, 
    avg_days_overdue, 
    oldest_overdue
  FROM public.invoices 
  WHERE due_date < CURRENT_DATE 
    AND status IN ('sent', 'draft', 'overdue')
    AND status NOT IN ('paid', 'cancelled');

  RETURN jsonb_build_object(
    'total_overdue', total_overdue,
    'total_amount', total_amount,
    'avg_days_overdue', ROUND(avg_days_overdue, 1),
    'oldest_overdue', oldest_overdue,
    'last_updated', now()
  );
END;
$$;

-- 4. Mejorar la función get_overdue_invoices_for_alerts para ser más robusta
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
AS $$
BEGIN
  -- Primero actualizar facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  -- Luego retornar las facturas vencidas (con validación por fecha, no solo por status)
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
    AND i.status NOT IN ('paid', 'cancelled')
  ORDER BY i.due_date ASC;
END;
$$;