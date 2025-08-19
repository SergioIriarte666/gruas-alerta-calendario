-- Fix form hanging issue and migrate existing costs to cost centers

-- First, let's update the existing costs with appropriate cost centers based on their categories
UPDATE costs 
SET cost_center_id = (
  SELECT cc.id 
  FROM cost_centers cc 
  WHERE cc.code = CASE 
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%combustible%' OR name ILIKE '%gasolina%' OR name ILIKE '%diesel%') THEN 'COMB'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%reparaci%' OR name ILIKE '%repuesto%') THEN 'MANT'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%administrat%' OR name ILIKE '%oficina%' OR name ILIKE '%papeler%') THEN 'ADMIN'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%personal%' OR name ILIKE '%salario%' OR name ILIKE '%sueldo%') THEN 'PERS'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%') THEN 'OPER'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%tecnolog%' OR name ILIKE '%software%' OR name ILIKE '%equipo%') THEN 'TEC'
    WHEN costs.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%marketing%' OR name ILIKE '%publicidad%' OR name ILIKE '%comercial%') THEN 'MKT'
    ELSE 'OPER' -- Default to operational costs
  END
  LIMIT 1
)
WHERE cost_center_id IS NULL;

-- Add a default cost center for any remaining unassigned costs
UPDATE costs 
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = 'OPER' LIMIT 1)
WHERE cost_center_id IS NULL;

-- Create an index for better performance on cost_center_id lookups
CREATE INDEX IF NOT EXISTS idx_costs_cost_center_lookup ON costs(cost_center_id, category_id);

-- Add a trigger to automatically assign cost center based on category for new costs
CREATE OR REPLACE FUNCTION assign_default_cost_center()
RETURNS TRIGGER AS $$
BEGIN
  -- If no cost center is specified, assign based on category
  IF NEW.cost_center_id IS NULL THEN
    NEW.cost_center_id := (
      SELECT cc.id 
      FROM cost_centers cc 
      WHERE cc.code = CASE 
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%combustible%' OR name ILIKE '%gasolina%' OR name ILIKE '%diesel%') THEN 'COMB'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%reparaci%' OR name ILIKE '%repuesto%') THEN 'MANT'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%administrat%' OR name ILIKE '%oficina%' OR name ILIKE '%papeler%') THEN 'ADMIN'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%personal%' OR name ILIKE '%salario%' OR name ILIKE '%sueldo%') THEN 'PERS'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%') THEN 'OPER'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%tecnolog%' OR name ILIKE '%software%' OR name ILIKE '%equipo%') THEN 'TEC'
        WHEN NEW.category_id IN (SELECT id FROM cost_categories WHERE name ILIKE '%marketing%' OR name ILIKE '%publicidad%' OR name ILIKE '%comercial%') THEN 'MKT'
        ELSE 'OPER' -- Default to operational costs
      END
      LIMIT 1
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for automatic cost center assignment
DROP TRIGGER IF EXISTS trigger_assign_cost_center ON costs;
CREATE TRIGGER trigger_assign_cost_center
  BEFORE INSERT ON costs
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_cost_center();

-- Verify migration results
SELECT 
  'Migration Summary' as status,
  (SELECT COUNT(*) FROM costs WHERE cost_center_id IS NOT NULL) as assigned_costs,
  (SELECT COUNT(*) FROM costs WHERE cost_center_id IS NULL) as unassigned_costs;