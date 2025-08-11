-- SOLUCIÓN DEFINITIVA: Eliminar trigger que causa recursión infinita en facturas
-- El trigger 'check_and_update_overdue_invoices_trigger' causa bucles infinitos al crear facturas

-- Eliminar el trigger problemático que ejecuta UPDATE dentro de INSERT
DROP TRIGGER IF EXISTS check_and_update_overdue_invoices_trigger ON public.invoices;

-- NOTA: La función update_overdue_invoices() aún existe y puede ejecutarse manualmente
-- cuando sea necesario actualizar facturas vencidas, pero no durante INSERT de nuevas facturas

-- Esta eliminación resuelve definitivamente el error "stack depth limit exceeded"