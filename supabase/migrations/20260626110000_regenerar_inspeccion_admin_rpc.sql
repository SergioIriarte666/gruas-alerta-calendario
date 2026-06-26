BEGIN;

CREATE OR REPLACE FUNCTION public.get_regenerar_inspeccion_elegibles()
RETURNS TABLE (
  service_id uuid,
  folio text,
  service_date date,
  client_name text,
  operator_name text,
  n_fotos_disponibles integer,
  tiene_row_inspection boolean,
  pdf_url_actual text,
  pdf_retiro_url_actual text,
  ultimo_envio_whatsapp_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden listar inspecciones regenerables';
  END IF;

  RETURN QUERY
  WITH photo_counts AS (
    SELECT
      split_part(o.name, '/', 1)::uuid AS service_id,
      count(*)::integer AS n_fotos_disponibles
    FROM storage.objects o
    WHERE o.bucket_id = 'inspection-photos'
      AND o.name LIKE '%/%'
      AND split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY split_part(o.name, '/', 1)
  ),
  primary_operators AS (
    SELECT DISTINCT ON (sr.service_id)
      sr.service_id,
      o.name AS operator_name
    FROM public.service_resources sr
    JOIN public.operators o ON o.id = sr.operator_id
    WHERE sr.resource_type = 'operator'
    ORDER BY sr.service_id, sr.is_primary DESC, sr.created_at ASC
  ),
  last_whatsapp AS (
    SELECT
      (w.context->>'serviceId')::uuid AS service_id,
      max(w.created_at) AS ultimo_envio_whatsapp_at
    FROM public.whatsapp_message_log w
    WHERE w.template_name = 'inspeccion_completada_doc'
      AND w.context ? 'serviceId'
      AND (w.context->>'serviceId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY (w.context->>'serviceId')::uuid
  )
  SELECT
    s.id AS service_id,
    s.folio,
    s.service_date,
    c.name AS client_name,
    COALESCE(o_direct.name, po.operator_name, 'Sin operador') AS operator_name,
    pc.n_fotos_disponibles,
    (i.id IS NOT NULL) AS tiene_row_inspection,
    i.pdf_url AS pdf_url_actual,
    i.pdf_retiro_url AS pdf_retiro_url_actual,
    lw.ultimo_envio_whatsapp_at
  FROM photo_counts pc
  JOIN public.services s ON s.id = pc.service_id
  LEFT JOIN public.clients c ON c.id = s.client_id
  LEFT JOIN public.operators o_direct ON o_direct.id = s.operator_id
  LEFT JOIN primary_operators po ON po.service_id = s.id
  LEFT JOIN public.inspections i ON i.service_id = s.id AND i.deleted_at IS NULL
  LEFT JOIN last_whatsapp lw ON lw.service_id = s.id
  ORDER BY s.service_date DESC, s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_regenerar_inspeccion_elegibles() TO authenticated;

COMMIT;
