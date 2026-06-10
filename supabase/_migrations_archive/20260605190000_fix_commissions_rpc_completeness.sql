DROP FUNCTION IF EXISTS public.get_commissions_with_details();

CREATE OR REPLACE FUNCTION public.get_commissions_with_details()
RETURNS TABLE (
  id UUID,
  date DATE,
  description TEXT,
  amount NUMERIC,
  operator_id UUID,
  service_id UUID,
  service_folio TEXT,
  subcategory TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  payment_date DATE,
  payment_batch_id TEXT,
  category_id UUID,
  service_value NUMERIC,
  service_date DATE,
  client_name TEXT,
  operator_name TEXT,
  operator_rut TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH commission_categories AS (
    SELECT id
    FROM public.cost_categories
    WHERE lower(translate(name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) LIKE '%comision%'
      AND lower(translate(name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) LIKE '%operador%'
  )
  SELECT
    c.id,
    c.date,
    c.description,
    c.amount,
    COALESCE(c.operator_id, s.operator_id) AS operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    c.payment_date,
    c.payment_batch_id,
    c.category_id,
    s.value AS service_value,
    s.service_date,
    cl.name AS client_name,
    o.name AS operator_name,
    o.rut AS operator_rut
  FROM public.costs c
  LEFT JOIN public.services s
    ON s.id = c.service_id
    OR (
      c.service_id IS NULL
      AND c.service_folio IS NOT NULL
      AND s.folio = c.service_folio
    )
  LEFT JOIN public.clients cl ON s.client_id = cl.id
  LEFT JOIN public.operators o ON o.id = COALESCE(c.operator_id, s.operator_id)
  WHERE (
    c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
    OR c.category_id IN (SELECT id FROM commission_categories)
  )
  ORDER BY c.created_at DESC;
$$;
