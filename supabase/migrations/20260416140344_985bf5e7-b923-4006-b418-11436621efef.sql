
-- 1. Add commission_exempt column
ALTER TABLE public.operators ADD COLUMN commission_exempt boolean NOT NULL DEFAULT false;

-- 2. Seed existing excluded operators
UPDATE public.operators SET commission_exempt = true
WHERE name ILIKE '%Jorge Iriarte%' OR name ILIKE '%Sergio Iriarte%' OR name ILIKE '%Jorge Ignacio Iriarte%';

-- 3. Replace trigger function to respect commission_exempt
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource RECORD;
  v_commission_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_is_exempt BOOLEAN;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Delete existing commission costs for this service to avoid duplicates
    DELETE FROM public.costs
    WHERE service_id = NEW.id AND category_id = v_commission_category_id;

    -- Loop through service_resources with commission > 0
    FOR v_resource IN
      SELECT sr.operator_id, sr.commission_amount, o.name as operator_name
      FROM public.service_resources sr
      JOIN public.operators o ON o.id = sr.operator_id
      WHERE sr.service_id = NEW.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    LOOP
      INSERT INTO public.costs (
        amount, category_id, service_id, operator_id,
        service_folio, date, description, subcategory, notes, crane_id
      ) VALUES (
        v_resource.commission_amount,
        v_commission_category_id,
        NEW.id,
        v_resource.operator_id,
        NEW.folio,
        NEW.service_date,
        'Comisión ' || v_resource.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        NEW.crane_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
