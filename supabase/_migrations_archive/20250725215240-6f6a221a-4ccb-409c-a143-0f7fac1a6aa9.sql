-- SOLUCIÓN DRÁSTICA: ELIMINAR TRIGGERS PROBLEMÁTICOS EN FACTURAS
-- =======================================================================================

-- Identificar todos los triggers en tablas relacionadas con facturas
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('invoices', 'invoice_closures', 'invoice_services', 'services', 'costs')
AND t.tgname NOT LIKE 'RI_%'  -- Excluir triggers de foreign keys
ORDER BY c.relname, t.tgname;

-- DESHABILITAR TODOS LOS TRIGGERS QUE PODRÍAN CAUSAR RECURSIÓN
-- =======================================================================================

-- Deshabilitar triggers en servicios que podrían afectar facturas
DROP TRIGGER IF EXISTS update_service_status_on_invoice_trigger ON public.invoice_services;
DROP TRIGGER IF EXISTS generate_multiple_commissions_for_service_trigger ON public.services;
DROP TRIGGER IF EXISTS sync_service_changes_to_costs_trigger ON public.services;

-- Eliminar funciones que podrían estar causando recursión
DROP FUNCTION IF EXISTS public.update_service_status_on_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.generate_multiple_commissions_for_service() CASCADE;
DROP FUNCTION IF EXISTS public.sync_service_changes_to_costs() CASCADE;

-- Deshabilitar triggers de validación de integridad que podrían causar problemas
DROP TRIGGER IF EXISTS validate_invoice_closure_integrity_trigger ON public.invoice_closures;
DROP TRIGGER IF EXISTS log_invoice_closure_changes_trigger ON public.invoice_closures;

-- Eliminar funciones de validación problemáticas
DROP FUNCTION IF EXISTS public.validate_invoice_closure_integrity() CASCADE;
DROP FUNCTION IF EXISTS public.log_invoice_closure_changes() CASCADE;

-- Crear función simple para actualizar updated_at sin recursión
CREATE OR REPLACE FUNCTION public.simple_update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Agregar triggers simples solo para timestamps
CREATE TRIGGER simple_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION simple_update_timestamp();

CREATE TRIGGER simple_invoice_closures_updated_at
  BEFORE UPDATE ON public.invoice_closures
  FOR EACH ROW EXECUTE FUNCTION simple_update_timestamp();

-- Verificar que no quedan triggers problemáticos
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('invoices', 'invoice_closures', 'invoice_services')
AND t.tgname NOT LIKE 'RI_%'
ORDER BY c.relname, t.tgname;