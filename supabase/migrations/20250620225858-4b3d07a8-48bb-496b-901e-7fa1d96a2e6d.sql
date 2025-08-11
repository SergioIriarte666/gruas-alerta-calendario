
-- Crear tabla para relacionar facturas con cierres
CREATE TABLE public.invoice_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  closure_id UUID NOT NULL REFERENCES public.service_closures(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_invoice_closures_invoice_id ON public.invoice_closures(invoice_id);
CREATE INDEX idx_invoice_closures_closure_id ON public.invoice_closures(closure_id);

-- Crear trigger para actualizar el status del cierre cuando se factura
CREATE OR REPLACE FUNCTION public.update_closure_status_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar el status del cierre a 'invoiced' cuando se agrega a una factura
  UPDATE service_closures 
  SET status = 'invoiced', updated_at = now()
  WHERE id = NEW.closure_id;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger
CREATE TRIGGER trigger_update_closure_status_on_invoice
  AFTER INSERT ON public.invoice_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_closure_status_on_invoice();
