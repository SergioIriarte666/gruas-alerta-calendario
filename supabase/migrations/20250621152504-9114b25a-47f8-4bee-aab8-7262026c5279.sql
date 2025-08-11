
-- Crear función de seguridad para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Eliminar las políticas existentes demasiado permisivas
DROP POLICY IF EXISTS "Users can view all invoice_closures" ON public.invoice_closures;
DROP POLICY IF EXISTS "Users can insert invoice_closures" ON public.invoice_closures;
DROP POLICY IF EXISTS "Users can update invoice_closures" ON public.invoice_closures;
DROP POLICY IF EXISTS "Users can delete invoice_closures" ON public.invoice_closures;

-- Crear nuevas políticas basadas en roles
CREATE POLICY "Admins and operators can view invoice_closures" 
  ON public.invoice_closures 
  FOR SELECT 
  USING (
    public.get_current_user_role() IN ('admin', 'operator')
  );

CREATE POLICY "Only admins can create invoice_closures" 
  ON public.invoice_closures 
  FOR INSERT 
  WITH CHECK (
    public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Only admins can update invoice_closures" 
  ON public.invoice_closures 
  FOR UPDATE 
  USING (
    public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Only admins can delete invoice_closures" 
  ON public.invoice_closures 
  FOR DELETE 
  USING (
    public.get_current_user_role() = 'admin'
  );

-- Crear función para validar integridad de la relación factura-cierre
CREATE OR REPLACE FUNCTION public.validate_invoice_closure_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Crear trigger para validación de integridad
DROP TRIGGER IF EXISTS validate_invoice_closure_integrity_trigger ON public.invoice_closures;
CREATE TRIGGER validate_invoice_closure_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.invoice_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_closure_integrity();

-- Crear función para logging de cambios en invoice_closures
CREATE OR REPLACE FUNCTION public.log_invoice_closure_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Crear trigger para logging
DROP TRIGGER IF EXISTS log_invoice_closure_changes_trigger ON public.invoice_closures;
CREATE TRIGGER log_invoice_closure_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invoice_closure_changes();
