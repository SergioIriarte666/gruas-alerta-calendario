-- Agregar columna para vincular pagos con facturas
ALTER TABLE public.supplier_payments
ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;

-- Agregar columnas para tracking de pagos parciales en facturas
ALTER TABLE public.supplier_invoices
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Agregar columna balance calculada basada en amount (no total_amount)
ALTER TABLE public.supplier_invoices
ADD COLUMN IF NOT EXISTS balance NUMERIC GENERATED ALWAYS AS (amount - COALESCE(paid_amount, 0)) STORED;

-- Crear índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice_id ON public.supplier_payments(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON public.supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON public.supplier_invoices(status);