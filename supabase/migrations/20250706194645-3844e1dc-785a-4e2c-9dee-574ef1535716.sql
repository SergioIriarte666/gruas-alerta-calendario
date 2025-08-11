-- Add invoice fields to services table
ALTER TABLE public.services 
ADD COLUMN invoice_folio TEXT,
ADD COLUMN invoice_numero_fiscal TEXT;