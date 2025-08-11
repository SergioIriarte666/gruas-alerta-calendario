-- ELIMINAR FUNCIÓN CONFLICTIVA DE FACTURACIÓN
-- Eliminar específicamente la versión con parámetro JSON que causa conflicto
DROP FUNCTION IF EXISTS public.create_invoice_transaction(json, uuid[]);

-- Verificar que solo quede la versión JSONB
-- La función correcta ya existe con parámetros (jsonb, uuid[])