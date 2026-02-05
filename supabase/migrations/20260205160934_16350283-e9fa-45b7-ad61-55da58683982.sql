-- Función para verificar duplicados de costos
CREATE OR REPLACE FUNCTION check_cost_duplicates(
  p_date DATE,
  p_amount NUMERIC,
  p_description TEXT,
  p_folio TEXT DEFAULT NULL,
  p_tolerance_percent NUMERIC DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  date DATE,
  description TEXT,
  amount NUMERIC,
  service_folio TEXT,
  created_at TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.date,
    c.description,
    c.amount,
    c.service_folio,
    c.created_at,
    CASE
      WHEN c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)) THEN 'exact'
      WHEN p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio THEN 'folio'
      WHEN c.date = p_date AND ABS(c.amount - p_amount) <= (p_amount * p_tolerance_percent / 100) THEN 'similar'
    END AS match_type
  FROM costs c
  WHERE 
    (c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)))
    OR (p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio)
    OR (c.date = p_date AND ABS(c.amount - p_amount) <= (p_amount * p_tolerance_percent / 100))
  ORDER BY 
    CASE 
      WHEN c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)) THEN 1
      WHEN p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio THEN 2
      ELSE 3
    END,
    c.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar duplicados de facturas de proveedores (supplier_payments)
CREATE OR REPLACE FUNCTION check_supplier_invoice_duplicates(
  p_folio TEXT,
  p_supplier_rut TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_tolerance_percent NUMERIC DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  reference_number TEXT,
  supplier_id UUID,
  supplier_name TEXT,
  supplier_rut TEXT,
  amount NUMERIC,
  due_date DATE,
  created_at TIMESTAMPTZ,
  match_type TEXT
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
  JOIN suppliers s ON s.id = sp.supplier_id
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

-- Función para verificar duplicados de proveedores
CREATE OR REPLACE FUNCTION check_supplier_duplicates(
  p_rut TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rut TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.rut,
    s.email,
    s.phone,
    s.is_active,
    s.created_at,
    CASE
      WHEN s.rut = p_rut THEN 'exact_rut'
      WHEN p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)) THEN 'exact_name'
      WHEN p_name IS NOT NULL AND s.name ILIKE '%' || p_name || '%' THEN 'similar_name'
    END AS match_type
  FROM suppliers s
  WHERE 
    s.rut = p_rut
    OR (p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)))
    OR (p_name IS NOT NULL AND s.name ILIKE '%' || p_name || '%')
  ORDER BY 
    CASE 
      WHEN s.rut = p_rut THEN 1
      WHEN p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)) THEN 2
      ELSE 3
    END,
    s.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;