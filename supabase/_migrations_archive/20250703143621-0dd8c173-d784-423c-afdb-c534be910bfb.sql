-- Agregar columna subcategory a la tabla costs para permitir subcategorías en Gastos de Servicios
ALTER TABLE public.costs ADD COLUMN subcategory TEXT NULL;

-- Agregar comentario para documentar el propósito de la columna
COMMENT ON COLUMN public.costs.subcategory IS 'Subcategoría para gastos de servicios: Combustible, Peajes, Otros';