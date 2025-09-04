-- Actualizar la tabla suppliers para permitir cualquier valor de categoría (no solo enum)
-- Eliminar la restricción del tipo enum si existe
ALTER TABLE public.suppliers ALTER COLUMN category TYPE text;

-- Actualizar la tabla supplier_payments también
ALTER TABLE public.supplier_payments ALTER COLUMN category TYPE text;

-- Verificar que las tablas acepten categorías como text
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('suppliers', 'supplier_payments') 
AND column_name = 'category';