BEGIN;

-- La migración 20260627170000_harden_supabase_security_warnings.sql revocó
-- EXECUTE de authenticated sobre todas las funciones SECURITY DEFINER de un
-- denylist genérico, incluyendo update_closure_status_on_invoice por error.
-- Esa función es invocada directamente desde el frontend
-- (src/hooks/invoices/useInvoiceOperations.ts) al crear una factura desde un
-- cierre, y necesita ser ejecutable por authenticated.
GRANT EXECUTE ON FUNCTION public.update_closure_status_on_invoice(uuid)
  TO authenticated;

COMMIT;
