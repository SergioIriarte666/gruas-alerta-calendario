-- Fix validation trigger to allow updates on invoiced closures
CREATE OR REPLACE FUNCTION public.validate_invoice_closure_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invoice_client_id UUID;
  closure_client_id UUID;
  closure_status TEXT;
  is_editing BOOLEAN;
BEGIN
  -- Check if this is an update (editing existing invoice)
  is_editing := TG_OP = 'UPDATE';
  
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

  -- Para nuevas facturas, validar que el cierre esté cerrado
  -- Para editar facturas existentes, permitir cierres cerrados O facturados
  IF is_editing THEN
    -- Al editar, permitir cierres 'closed' o 'invoiced'
    IF closure_status NOT IN ('closed', 'invoiced') THEN
      RAISE EXCEPTION 'Solo se pueden usar cierres que estén cerrados o facturados';
    END IF;
  ELSE
    -- Al crear nueva factura, solo permitir cierres 'closed'
    IF closure_status != 'closed' THEN
      RAISE EXCEPTION 'Solo se pueden facturar cierres que estén cerrados';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;