
-- Agregar campo numero_fiscal a la tabla invoices
ALTER TABLE public.invoices 
ADD COLUMN numero_fiscal TEXT;

-- Crear constraint UNIQUE para numero_fiscal (solo cuando no sea NULL)
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_numero_fiscal_unique UNIQUE (numero_fiscal);

-- Crear índice para mejorar rendimiento en búsquedas por número fiscal
CREATE INDEX IF NOT EXISTS idx_invoices_numero_fiscal ON public.invoices (numero_fiscal);
