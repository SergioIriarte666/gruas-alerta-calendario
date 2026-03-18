-- Step 1: Fix trigger to resolve category by name lookup instead of UUID cast
CREATE OR REPLACE FUNCTION create_cost_from_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_id UUID;
  v_maintenance_cat_id UUID;
  v_resolved_cat_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    IF EXISTS (SELECT 1 FROM costs WHERE supplier_payment_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    
    -- Default category
    SELECT id INTO v_maintenance_cat_id 
    FROM cost_categories WHERE name = 'Mantenimiento' LIMIT 1;
    
    IF v_maintenance_cat_id IS NULL THEN
      SELECT id INTO v_maintenance_cat_id FROM cost_categories LIMIT 1;
    END IF;
    
    -- Resolve category: try UUID first, then name lookup
    v_resolved_cat_id := NULL;
    IF NEW.category IS NOT NULL AND NEW.category != '' THEN
      -- Try direct UUID cast
      BEGIN
        v_resolved_cat_id := NEW.category::uuid;
        -- Verify it exists
        IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE id = v_resolved_cat_id) THEN
          v_resolved_cat_id := NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_resolved_cat_id := NULL;
      END;
      
      -- If not a valid UUID, lookup by name
      IF v_resolved_cat_id IS NULL THEN
        SELECT id INTO v_resolved_cat_id 
        FROM cost_categories 
        WHERE lower(name) = lower(NEW.category) 
        LIMIT 1;
      END IF;
    END IF;
    
    INSERT INTO costs (
      amount, category_id, date, description,
      supplier_id, supplier_payment_id, payment_date, created_by
    ) VALUES (
      NEW.amount,
      COALESCE(v_resolved_cat_id, v_maintenance_cat_id),
      COALESCE(NEW.due_date, CURRENT_DATE),
      COALESCE(NEW.description, 'Pago a proveedor'),
      NEW.supplier_id, NEW.id, NEW.paid_date, NEW.created_by
    ) RETURNING id INTO v_cost_id;
    
    UPDATE supplier_payments SET cost_id = v_cost_id WHERE id = NEW.id;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
      v_cost_id := NEW.cost_id;
      IF v_cost_id IS NULL THEN
        SELECT id INTO v_cost_id FROM costs WHERE supplier_payment_id = NEW.id LIMIT 1;
      END IF;
      IF v_cost_id IS NOT NULL THEN
        UPDATE costs SET payment_date = COALESCE(NEW.paid_date, CURRENT_DATE) WHERE id = v_cost_id;
        IF NEW.cost_id IS NULL THEN
          UPDATE supplier_payments SET cost_id = v_cost_id WHERE id = NEW.id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Remove duplicate trigger
DROP TRIGGER IF EXISTS create_cost_from_supplier_payment_trigger ON supplier_payments;

-- Step 3: Fix check_supplier_invoice_duplicates to use inventory_suppliers
CREATE OR REPLACE FUNCTION check_supplier_invoice_duplicates(
  p_folio text,
  p_supplier_rut text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_tolerance_percent numeric DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  reference_number text,
  supplier_id uuid,
  supplier_name text,
  supplier_rut text,
  amount numeric,
  due_date date,
  created_at timestamp with time zone,
  match_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.reference_number,
    sp.supplier_id,
    s.name AS supplier_name,
    s.rut AS supplier_rut,
    sp.amount,
    sp.due_date,
    sp.created_at,
    CASE
      WHEN sp.reference_number = p_folio THEN 'exact_folio'
      WHEN p_supplier_rut IS NOT NULL AND s.rut = p_supplier_rut AND p_amount IS NOT NULL 
           AND ABS(sp.amount - p_amount) <= (p_amount * p_tolerance_percent / 100) THEN 'similar'
    END AS match_type
  FROM supplier_payments sp
  JOIN inventory_suppliers s ON s.id = sp.supplier_id
  WHERE 
    sp.reference_number = p_folio
    OR (p_supplier_rut IS NOT NULL AND s.rut = p_supplier_rut AND p_amount IS NOT NULL 
        AND ABS(sp.amount - p_amount) <= (p_amount * p_tolerance_percent / 100))
  ORDER BY 
    CASE WHEN sp.reference_number = p_folio THEN 1 ELSE 2 END,
    sp.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;