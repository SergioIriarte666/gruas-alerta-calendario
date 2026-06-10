
-- Widen cost-matching search to ±30 days and include costs with no service_folio
-- (costs registered before the invoice arrived have no folio and must always be candidates)

CREATE OR REPLACE FUNCTION find_matching_costs_for_invoice(
  p_supplier_rut text,
  p_amount numeric,
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  id uuid,
  description text,
  amount numeric,
  date date,
  payment_date date,
  supplier_name text,
  supplier_payment_id uuid,
  has_invoice boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.description,
    c.amount,
    c.date,
    c.payment_date,
    COALESCE(s.name, '') as supplier_name,
    c.supplier_payment_id,
    CASE WHEN sp.supplier_invoice_id IS NOT NULL THEN true ELSE false END as has_invoice
  FROM costs c
  LEFT JOIN inventory_suppliers s ON c.supplier_id = s.id
  LEFT JOIN supplier_payments sp ON (c.supplier_payment_id = sp.id OR sp.cost_id = c.id)
  WHERE
    -- Match by supplier RUT
    c.supplier_id IN (
      SELECT id FROM inventory_suppliers
      WHERE UPPER(REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE(p_supplier_rut, '.', ''), '-', ''), ' ', ''))
    )
    -- Amount within ±5%
    AND c.amount BETWEEN p_amount * 0.95 AND p_amount * 1.05
    -- Date within range OR cost has no folio (pre-invoice registration, always a candidate)
    AND (
      c.date BETWEEN p_date_from AND p_date_to
      OR c.service_folio IS NULL
    )
    -- No invoice linked yet
    AND (sp.supplier_invoice_id IS NULL OR sp.id IS NULL)
  ORDER BY
    -- Prefer exact amount match first
    ABS(c.amount - p_amount) ASC,
    c.date DESC
  LIMIT 5;
$$;
