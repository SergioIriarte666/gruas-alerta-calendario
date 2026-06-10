-- SOLUCIÓN RADICAL: DESHABILITAR TEMPORALMENTE TRIGGERS PROBLEMÁTICOS
-- =======================================================================================

-- Identificar triggers que podrían causar recursión en facturas
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('invoices', 'invoice_closures', 'invoice_services', 'services', 'costs', 'profiles')
AND t.tgname NOT LIKE 'RI_%'  -- Excluir triggers de foreign keys
ORDER BY c.relname, t.tgname;

-- SOLUCIÓN TEMPORAL: Deshabilitar triggers problemáticos en facturas
-- =======================================================================================

-- Deshabilitar triggers que pueden estar causando recursión
ALTER TABLE public.invoices DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_closures DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_services DISABLE TRIGGER ALL;

-- Crear políticas RLS ultra-simplificadas para facturas
-- Eliminar TODAS las políticas complejas y crear unas básicas
DROP POLICY IF EXISTS "invoices_authenticated_access" ON public.invoices;
DROP POLICY IF EXISTS "invoice_closures_authenticated_access" ON public.invoice_closures;
DROP POLICY IF EXISTS "invoice_services_authenticated_access" ON public.invoice_services;

-- Políticas super simples para facturas - SIN FUNCIONES
CREATE POLICY "invoices_simple_auth" 
ON public.invoices 
FOR ALL 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoice_closures_simple_auth" 
ON public.invoice_closures 
FOR ALL 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoice_services_simple_auth" 
ON public.invoice_services 
FOR ALL 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verificar que no hay triggers activos en las tablas de facturas
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE 
    WHEN t.tgenabled = 'O' THEN 'ENABLED'
    WHEN t.tgenabled = 'D' THEN 'DISABLED'
    ELSE 'OTHER'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('invoices', 'invoice_closures', 'invoice_services')
AND t.tgname NOT LIKE 'RI_%'
ORDER BY c.relname, t.tgname;