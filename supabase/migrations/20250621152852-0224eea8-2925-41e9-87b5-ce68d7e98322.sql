
-- Actualizar todas las funciones con search_path seguro
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.validate_invoice_closure_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invoice_client_id UUID;
  closure_client_id UUID;
  closure_status TEXT;
BEGIN
  -- Obtener el cliente de la factura
  SELECT client_id INTO invoice_client_id
  FROM public.invoices
  WHERE id = NEW.invoice_id;

  -- Obtener el cliente y estado del cierre
  SELECT client_id, status INTO closure_client_id, closure_status
  FROM public.service_closures
  WHERE id = NEW.closure_id;

  -- Validar que ambos pertenezcan al mismo cliente (si el cierre tiene cliente específico)
  IF closure_client_id IS NOT NULL AND invoice_client_id != closure_client_id THEN
    RAISE EXCEPTION 'La factura y el cierre deben pertenecer al mismo cliente';
  END IF;

  -- Validar que el cierre esté cerrado
  IF closure_status != 'closed' THEN
    RAISE EXCEPTION 'Solo se pueden facturar cierres que estén cerrados';
  END IF;

  -- Validar que el cierre no esté ya facturado
  IF closure_status = 'invoiced' THEN
    RAISE EXCEPTION 'Este cierre ya ha sido facturado';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_invoice_closure_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'Invoice closure created: invoice_id=%, closure_id=%, user=%', 
      NEW.invoice_id, NEW.closure_id, auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE NOTICE 'Invoice closure updated: id=%, user=%', NEW.id, auth.uid();
  ELSIF TG_OP = 'DELETE' THEN
    RAISE NOTICE 'Invoice closure deleted: id=%, user=%', OLD.id, auth.uid();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_service_status_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar el status del servicio a 'invoiced' cuando se agrega a una factura
  UPDATE public.services 
  SET status = 'invoiced', updated_at = now()
  WHERE id = NEW.service_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_services_status_on_invoice_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar el status de todos los servicios del cierre a 'invoiced'
  UPDATE public.services 
  SET status = 'invoiced', updated_at = now()
  WHERE id IN (
    SELECT service_id 
    FROM public.closure_services 
    WHERE closure_id = NEW.closure_id
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_closure_status_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar el status del cierre a 'invoiced' cuando se agrega a una factura
  UPDATE public.service_closures 
  SET status = 'invoiced', updated_at = now()
  WHERE id = NEW.closure_id;
  
  RETURN NEW;
END;
$$;
