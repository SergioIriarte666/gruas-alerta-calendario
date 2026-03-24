ALTER TABLE public.inventory_suppliers
ADD COLUMN IF NOT EXISTS default_payment_term_id UUID REFERENCES public.payment_terms(id);

ALTER TABLE public.inventory_suppliers
ADD COLUMN IF NOT EXISTS credit_date DATE;

CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_default_payment_term_id
ON public.inventory_suppliers(default_payment_term_id);

CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_credit_date
ON public.inventory_suppliers(credit_date);
