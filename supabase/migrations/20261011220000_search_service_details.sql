-- Búsqueda por palabras en español; las relaciones conservan sus políticas RLS.
CREATE OR REPLACE FUNCTION public.search_service_ids(p_search text)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  WITH terms AS (
    SELECT token, plainto_tsquery('spanish', token) AS query
    FROM regexp_split_to_table(
      translate(lower(trim(coalesce(p_search, ''))), 'áéíóúüñ', 'aeiouun'),
      '[[:space:]]+'
    ) AS token WHERE token <> ''
  )
  SELECT s.id
  FROM public.services s
  LEFT JOIN public.clients client ON client.id=s.client_id
  LEFT JOIN public.clients third_party ON third_party.id=s.third_party_client_id
  LEFT JOIN public.cranes crane ON crane.id=s.crane_id
  LEFT JOIN public.operators operator ON operator.id=s.operator_id
  LEFT JOIN public.service_types type ON type.id=s.service_type_id
  LEFT JOIN LATERAL (
    SELECT string_agg(item.glosa, ' ') AS text
    FROM public.service_items item WHERE item.service_id=s.id
  ) items ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', c.license_plate, c.brand, c.model, o.name, o.rut), ' ') AS text
    FROM public.service_resources resource
    LEFT JOIN public.cranes c ON c.id=resource.crane_id
    LEFT JOIN public.operators o ON o.id=resource.operator_id
    WHERE resource.service_id=s.id
  ) resources ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', stop.label, stop.address, stop.notes), ' ') AS text
    FROM public.service_stops stop WHERE stop.service_id=s.id
  ) stops ON true
  CROSS JOIN LATERAL (
    SELECT translate(lower(concat_ws(' ',
      s.folio, s.purchase_order, s.purchase_order_number, s.quote_number,
      s.vehicle_brand, s.vehicle_model, s.license_plate, s.origin, s.destination,
      s.observations, s.invoice_folio, s.invoice_numero_fiscal, s.insured_name,
      s.company_name, s.company_rut, s.custody_notes, s.outsourced_notes,
      client.name, client.rut, client.department, third_party.name, third_party.rut,
      crane.license_plate, crane.brand, crane.model, operator.name, operator.rut,
      type.name, type.description, items.text, resources.text, stops.text,
      -- Mantener coincidencias de folios y patentes escritos sin guiones.
      regexp_replace(concat_ws(' ', s.folio, s.license_plate, crane.license_plate,
        s.purchase_order, s.purchase_order_number, s.quote_number,
        s.invoice_folio, s.invoice_numero_fiscal, client.rut), '[-_]', '', 'g')
    )), 'áéíóúüñ', 'aeiouun') AS text
  ) searchable
  WHERE NOT EXISTS (
    SELECT 1 FROM terms WHERE strpos(searchable.text, terms.token)=0
      AND NOT (to_tsvector('spanish', searchable.text) @@ terms.query)
  );
$function$;
COMMENT ON FUNCTION public.search_service_ids(text) IS
  'Busca servicios por términos en español, documentos, clientes, ruta, observaciones, productos, grúas y operadores; respeta RLS.';
REVOKE ALL ON FUNCTION public.search_service_ids(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_service_ids(text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
