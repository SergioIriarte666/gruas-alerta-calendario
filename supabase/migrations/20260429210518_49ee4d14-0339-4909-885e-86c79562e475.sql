CREATE OR REPLACE FUNCTION public.search_voidable_inventory_purchases(p_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  date date,
  description text,
  amount numeric,
  supplier_id uuid,
  supplier_name text,
  document_number text,
  service_folio text,
  payment_date date,
  immediate_consumption boolean,
  inventory_movement_id uuid,
  supplier_payment_id uuid,
  supplier_invoice_id uuid,
  purchase_quantity numeric,
  purchase_unit_cost numeric,
  has_inventory_link boolean,
  matched_item text,
  match_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := nullif(trim(coalesce(p_search, '')), '');
  v_norm text;
  v_words text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;

  IF v_term IS NOT NULL THEN
    v_norm  := lower(public.unaccent(v_term));
    v_words := regexp_split_to_array(v_norm, '\s+');
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.costs c
    WHERE
      c.inventory_movement_id IS NOT NULL
      OR c.purchase_quantity IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = c.id)
      OR EXISTS (SELECT 1 FROM public.supplier_invoice_items sii WHERE sii.supplier_invoice_id = c.supplier_invoice_id)
  ),
  enriched AS (
    SELECT
      b.*,
      s.name::text AS sup_name,
      (
        SELECT string_agg(coalesce(sii.description, '') || ' ' || coalesce(sii.product_name, ''), ' ')
        FROM public.supplier_invoice_items sii
        WHERE sii.supplier_invoice_id = b.supplier_invoice_id
      )::text AS invoice_items_text,
      (
        SELECT string_agg(
          coalesce(ii.name, '') || ' ' ||
          coalesce(ii.description, '') || ' ' ||
          coalesce(im.observations, '') || ' ' ||
          coalesce(im.reference_document, '') || ' ' ||
          coalesce(im.supplier_name, ''),
        ' ')
        FROM public.inventory_movements im
        LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
        WHERE im.cost_id = b.id OR im.id = b.inventory_movement_id
      )::text AS movements_text,
      (
        SELECT coalesce(ii.name, ii.description, sii.description, sii.product_name)::text
        FROM public.inventory_movements im
        LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
        LEFT JOIN public.supplier_invoice_items sii ON sii.id = im.supplier_invoice_item_id
        WHERE (im.cost_id = b.id OR im.id = b.inventory_movement_id)
          AND im.movement_type = 'entry'
        ORDER BY im.created_at ASC NULLS LAST
        LIMIT 1
      )::text AS best_item_name
    FROM base b
    LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  ),
  scored AS (
    SELECT
      e.*,
      lower(public.unaccent(
        coalesce(e.description, '') || ' ' ||
        coalesce(e.document_number, '') || ' ' ||
        coalesce(e.service_folio, '') || ' ' ||
        coalesce(e.notes, '') || ' ' ||
        coalesce(e.sup_name, '') || ' ' ||
        coalesce(e.invoice_items_text, '') || ' ' ||
        coalesce(e.movements_text, '')
      )) AS haystack
    FROM enriched e
  ),
  filtered AS (
    SELECT
      s.*,
      (
        CASE WHEN v_term IS NULL THEN 0
             WHEN lower(public.unaccent(coalesce(s.document_number,''))) = v_norm
               OR lower(public.unaccent(coalesce(s.service_folio,''))) = v_norm THEN 100
             WHEN lower(public.unaccent(coalesce(s.description,''))) LIKE '%' || v_norm || '%' THEN 70
             WHEN lower(public.unaccent(coalesce(s.invoice_items_text,'') || ' ' || coalesce(s.movements_text,''))) LIKE '%' || v_norm || '%' THEN 50
             WHEN lower(public.unaccent(coalesce(s.notes,'') || ' ' || coalesce(s.sup_name,''))) LIKE '%' || v_norm || '%' THEN 30
             ELSE 10
        END
      )::integer AS score
    FROM scored s
    WHERE
      v_term IS NULL
      OR (
        SELECT bool_and(s.haystack LIKE '%' || w || '%')
        FROM unnest(v_words) AS w
        WHERE w <> ''
      )
  )
  SELECT
    f.id::uuid,
    f.date::date,
    f.description::text,
    f.amount::numeric,
    f.supplier_id::uuid,
    f.sup_name::text AS supplier_name,
    f.document_number::text,
    f.service_folio::text,
    f.payment_date::date,
    f.immediate_consumption::boolean,
    f.inventory_movement_id::uuid,
    f.supplier_payment_id::uuid,
    f.supplier_invoice_id::uuid,
    f.purchase_quantity::numeric,
    f.purchase_unit_cost::numeric,
    (f.inventory_movement_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = f.id))::boolean AS has_inventory_link,
    f.best_item_name::text AS matched_item,
    f.score::integer AS match_score
  FROM filtered f
  ORDER BY f.score DESC, f.date DESC NULLS LAST, f.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.search_voidable_inventory_purchases(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_voidable_inventory_purchases(text) TO authenticated;