
-- Improve find_matching_costs_for_invoice:
--   • Extend date window to ±30 days (callers pass ±7d, adding 23d each side reaches ±30d from issue date)
--   • Include costs with no service_folio — registered before receiving the invoice
--   • Exclude costs already linked to a supplier_invoice
--   • Order by closest date to the search midpoint instead of plain DESC

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
    COALESCE(s.name, '') AS supplier_name,
    c.supplier_payment_id,
    CASE WHEN sp.supplier_invoice_id IS NOT NULL THEN true ELSE false END AS has_invoice
  FROM costs c
  LEFT JOIN inventory_suppliers s ON c.supplier_id = s.id
  LEFT JOIN supplier_payments sp ON (c.supplier_payment_id = sp.id OR sp.cost_id = c.id)
  WHERE
    -- Match by supplier RUT
    c.supplier_id IN (
      SELECT id FROM inventory_suppliers
      WHERE UPPER(REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '')) =
            UPPER(REPLACE(REPLACE(REPLACE(p_supplier_rut, '.', ''), '-', ''), ' ', ''))
    )
    -- Amount within ±5%
    AND c.amount BETWEEN p_amount * 0.95 AND p_amount * 1.05
    -- Extended date window (±30 days from issue date) OR cost registered without folio yet
    AND (
      c.date BETWEEN (p_date_from - INTERVAL '23 days') AND (p_date_to + INTERVAL '23 days')
      OR c.service_folio IS NULL
    )
    -- No invoice linked yet (via payment or directly on the cost)
    AND (sp.supplier_invoice_id IS NULL OR sp.id IS NULL)
    AND c.supplier_invoice_id IS NULL
  ORDER BY
    -- Exact amount match first, then closest date to the search window start
    ABS(c.amount - p_amount) ASC,
    ABS(c.date - p_date_from) ASC
  LIMIT 5;
$$;
