ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS company_rut TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT;

UPDATE public.services s
SET company_rut = c.owner_company_rut,
    company_name = c.owner_company_name
FROM public.cranes c
WHERE s.crane_id = c.id;

UPDATE public.services s
SET company_rut = cd.rut,
    company_name = cd.business_name
FROM public.company_data cd
WHERE s.company_rut IS NULL;

CREATE OR REPLACE FUNCTION public.sync_service_company_from_crane()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crane_id IS NOT NULL THEN
    SELECT owner_company_rut, owner_company_name
    INTO NEW.company_rut, NEW.company_name
    FROM public.cranes
    WHERE id = NEW.crane_id;
  ELSE
    SELECT rut, business_name
    INTO NEW.company_rut, NEW.company_name
    FROM public.company_data
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_sync_company_ins ON public.services;
CREATE TRIGGER trg_services_sync_company_ins
BEFORE INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_company_from_crane();

DROP TRIGGER IF EXISTS trg_services_sync_company_upd ON public.services;
CREATE TRIGGER trg_services_sync_company_upd
BEFORE UPDATE OF crane_id ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_company_from_crane();

CREATE OR REPLACE FUNCTION public.sync_services_on_crane_company_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.services
  SET company_rut = NEW.owner_company_rut,
      company_name = NEW.owner_company_name
  WHERE crane_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cranes_propagate_company ON public.cranes;
CREATE TRIGGER trg_cranes_propagate_company
AFTER UPDATE OF owner_company_rut, owner_company_name ON public.cranes
FOR EACH ROW
EXECUTE FUNCTION public.sync_services_on_crane_company_change();

CREATE INDEX IF NOT EXISTS idx_services_company_rut
  ON public.services (company_rut)
  WHERE company_rut IS NOT NULL;
