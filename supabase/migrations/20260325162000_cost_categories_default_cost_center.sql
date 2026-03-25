-- Direct link: Cost Categories -> Default Cost Center
-- - Adds default_cost_center_id on cost_categories
-- - Backfills defaults based on existing naming heuristics
-- - Updates assign_default_cost_center trigger to use the configured default
-- - Backfills costs without cost_center_id using the configured defaults

ALTER TABLE public.cost_categories
ADD COLUMN IF NOT EXISTS default_cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cost_categories_default_cost_center_id
  ON public.cost_categories (default_cost_center_id);

UPDATE public.cost_categories c
SET default_cost_center_id = (
  SELECT cc.id
  FROM public.cost_centers cc
  WHERE cc.code = CASE
    WHEN c.name ILIKE '%combustible%' OR c.name ILIKE '%gasolina%' OR c.name ILIKE '%diesel%' THEN 'COMB'
    WHEN c.name ILIKE '%mantenimiento%' OR c.name ILIKE '%reparaci%' OR c.name ILIKE '%repuesto%' THEN 'MANT'
    WHEN c.name ILIKE '%administrat%' OR c.name ILIKE '%oficina%' OR c.name ILIKE '%papeler%' THEN 'ADMIN'
    WHEN c.name ILIKE '%personal%' OR c.name ILIKE '%salario%' OR c.name ILIKE '%sueldo%' THEN 'PERS'
    WHEN c.name ILIKE '%servicio%' OR c.name ILIKE '%operacion%' THEN 'OPER'
    WHEN c.name ILIKE '%tecnolog%' OR c.name ILIKE '%software%' OR c.name ILIKE '%equipo%' THEN 'TEC'
    WHEN c.name ILIKE '%marketing%' OR c.name ILIKE '%publicidad%' OR c.name ILIKE '%comercial%' THEN 'MKT'
    ELSE 'OPER'
  END
  LIMIT 1
)
WHERE c.default_cost_center_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_default_cost_center()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_center uuid;
BEGIN
  IF NEW.cost_center_id IS NULL THEN
    SELECT default_cost_center_id
    INTO v_default_center
    FROM public.cost_categories
    WHERE id = NEW.category_id;

    IF v_default_center IS NOT NULL THEN
      NEW.cost_center_id := v_default_center;
    ELSE
      NEW.cost_center_id := (
        SELECT cc.id
        FROM public.cost_centers cc
        WHERE cc.code = CASE
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%combustible%' OR name ILIKE '%gasolina%' OR name ILIKE '%diesel%'
          ) THEN 'COMB'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%reparaci%' OR name ILIKE '%repuesto%'
          ) THEN 'MANT'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%administrat%' OR name ILIKE '%oficina%' OR name ILIKE '%papeler%'
          ) THEN 'ADMIN'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%personal%' OR name ILIKE '%salario%' OR name ILIKE '%sueldo%'
          ) THEN 'PERS'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%'
          ) THEN 'OPER'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%tecnolog%' OR name ILIKE '%software%' OR name ILIKE '%equipo%'
          ) THEN 'TEC'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%marketing%' OR name ILIKE '%publicidad%' OR name ILIKE '%comercial%'
          ) THEN 'MKT'
          ELSE 'OPER'
        END
        LIMIT 1
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_cost_center ON public.costs;
CREATE TRIGGER trigger_assign_cost_center
  BEFORE INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_cost_center();

UPDATE public.costs co
SET cost_center_id = c.default_cost_center_id
FROM public.cost_categories c
WHERE co.cost_center_id IS NULL
  AND co.category_id = c.id
  AND c.default_cost_center_id IS NOT NULL;

UPDATE public.costs
SET cost_center_id = (SELECT id FROM public.cost_centers WHERE code = 'OPER' LIMIT 1)
WHERE cost_center_id IS NULL;
