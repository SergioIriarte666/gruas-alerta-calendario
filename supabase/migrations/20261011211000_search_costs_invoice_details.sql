-- Buscar en la glosa y en el contenido real del documento: proveedor y líneas XML.
-- La normalización en español reconoce cadenas/cadena y elimina diferencias de
-- mayúsculas y acentos. Los fragmentos y códigos conservan coincidencia literal.
CREATE OR REPLACE FUNCTION public.search_costs(p_search text)
RETURNS SETOF public.costs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  WITH terms AS (
    SELECT token, plainto_tsquery('spanish', token) AS query
    FROM regexp_split_to_table(
      translate(lower(trim(coalesce(p_search, ''))), 'áéíóúüñ', 'aeiouun'),
      '[[:space:]]+'
    ) AS token
    WHERE token <> ''
  )
  SELECT c.*
  FROM public.costs c
  LEFT JOIN public.inventory_suppliers supplier ON supplier.id=c.supplier_id
  LEFT JOIN public.supplier_invoices invoice ON invoice.id=c.supplier_invoice_id
  LEFT JOIN public.inventory_suppliers invoice_supplier ON invoice_supplier.id=invoice.supplier_id
  LEFT JOIN public.cost_categories category ON category.id=c.category_id
  LEFT JOIN public.cranes crane ON crane.id=c.crane_id
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', item.product_code, item.product_name, item.description), ' ') AS text
    FROM public.supplier_invoice_items item
    WHERE item.supplier_invoice_id=c.supplier_invoice_id
  ) details ON true
  CROSS JOIN LATERAL (
    SELECT translate(lower(concat_ws(' ',
      c.description, c.notes, c.subcategory, c.service_folio,
      c.document_number, c.dte_folio, c.dte_rut_emisor,
      c.id::text, 'CST-' || left(replace(c.id::text,'-',''),8),
      supplier.name, supplier.rut, invoice_supplier.name, invoice_supplier.rut,
      invoice.invoice_number, invoice.description, invoice.product_service_description,
      details.text, category.name, crane.brand, crane.model, crane.license_plate
    )), 'áéíóúüñ', 'aeiouun') AS text
  ) searchable
  WHERE NOT EXISTS (
    SELECT 1 FROM terms
    WHERE strpos(searchable.text, terms.token)=0
      AND NOT (to_tsvector('spanish', searchable.text) @@ terms.query)
  );
$function$;

COMMENT ON FUNCTION public.search_costs(text) IS
  'Busca costos por términos en español, proveedor, factura y líneas XML. SECURITY INVOKER conserva RLS. Los filtros y relaciones se aplican mediante PostgREST.';
REVOKE ALL ON FUNCTION public.search_costs(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_costs(text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
