-- HABILITAR RLS EN TABLAS DE FACTURAS
-- Corregir errores críticos de seguridad
-- ========================================================

-- Habilitar RLS en las tablas que tienen políticas pero no tienen RLS activado
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_closures ENABLE ROW LEVEL SECURITY;

-- Verificar que las políticas existentes funcionan correctamente
-- Las políticas ya están creadas, solo faltaba habilitar RLS

-- Confirmar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('invoices', 'invoice_services', 'invoice_closures');