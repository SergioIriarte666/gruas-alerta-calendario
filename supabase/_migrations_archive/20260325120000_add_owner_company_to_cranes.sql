ALTER TABLE public.cranes
  ADD COLUMN IF NOT EXISTS owner_company_rut TEXT,
  ADD COLUMN IF NOT EXISTS owner_company_name TEXT;

UPDATE public.cranes c
SET
  owner_company_rut = cd.rut,
  owner_company_name = cd.business_name
FROM public.company_data cd
WHERE c.owner_company_rut IS NULL;

CREATE INDEX IF NOT EXISTS idx_cranes_owner_company_rut
  ON public.cranes (owner_company_rut)
  WHERE owner_company_rut IS NOT NULL;
