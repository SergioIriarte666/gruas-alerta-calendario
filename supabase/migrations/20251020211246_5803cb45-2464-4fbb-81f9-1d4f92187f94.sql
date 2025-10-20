-- Agregar columna invoice_id a la tabla incomes
ALTER TABLE public.incomes 
ADD COLUMN invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Agregar índice para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_incomes_invoice_id ON public.incomes(invoice_id);

-- Agregar comentario descriptivo
COMMENT ON COLUMN public.incomes.invoice_id IS 'Factura asociada a este ingreso (opcional)';