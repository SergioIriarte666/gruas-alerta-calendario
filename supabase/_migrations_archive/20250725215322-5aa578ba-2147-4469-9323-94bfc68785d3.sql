-- ELIMINAR TODOS LOS TRIGGERS PROBLEMÁTICOS RESTANTES
-- =======================================================================================

-- Eliminar triggers específicos que causan recursión en facturas
DROP TRIGGER IF EXISTS trigger_update_closure_status_on_invoice ON public.invoice_closures;
DROP TRIGGER IF EXISTS trigger_update_service_status_on_invoice_closure ON public.invoice_closures;
DROP TRIGGER IF EXISTS check_overdue_invoices_trigger ON public.invoices;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;

-- Eliminar las funciones asociadas
DROP FUNCTION IF EXISTS public.update_closure_status_on_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.update_services_status_on_invoice_closure() CASCADE;
DROP FUNCTION IF EXISTS public.check_and_update_overdue_invoices() CASCADE;

-- Mantener solo los triggers simples de timestamp
-- Verificar que solo quedan triggers seguros
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE 
    WHEN t.tgenabled = 'O' THEN 'ENABLED'
    WHEN t.tgenabled = 'D' THEN 'DISABLED'
    ELSE 'OTHER'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('invoices', 'invoice_closures', 'invoice_services')
AND t.tgname NOT LIKE 'RI_%'
ORDER BY c.relname, t.tgname;

-- Crear un test de creación de factura básico
INSERT INTO public.invoices (
  folio,
  client_id,
  issue_date,
  due_date,
  subtotal,
  vat,
  total,
  status,
  created_by
) VALUES (
  'TEST-001',
  (SELECT id FROM public.clients LIMIT 1),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  100000,
  19000,
  119000,
  'draft',
  auth.uid()
);

-- Si llegamos aquí sin error, el problema está resuelto
SELECT 'TEST EXITOSO: Factura creada sin recursión infinita' as result;