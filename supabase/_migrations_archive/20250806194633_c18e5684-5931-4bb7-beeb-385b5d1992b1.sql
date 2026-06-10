-- DEFINITIVO: Eliminar función que causa recursión infinita en facturas
-- Esta función consulta la tabla 'invoices' directamente, activando políticas RLS que causan bucles infinitos

-- Eliminar la función problemática para siempre
DROP FUNCTION IF EXISTS public.generate_unique_invoice_folio();

-- NOTA: Las funciones seguras que permanecen son:
-- 1. confirm_invoice_folio_usage() - Para crear facturas reales (usa company_data, no invoices)
-- 2. generate_invoice_folio_preview() - Para preview (usa company_data, no invoices)

-- Esta eliminación resuelve definitivamente el error "stack depth limit exceeded"