CREATE OR REPLACE FUNCTION public.update_vip_services_batch(p_updates jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_input_count integer := 0;
  v_updated_count integer := 0;
  v_updated_ids uuid[] := '{}';
  v_missing_ids uuid[] := '{}';
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates debe ser un arreglo JSON';
  END IF;

  WITH raw_updates AS (
    SELECT
      (item->>'id')::uuid AS id,
      NULLIF(btrim(item->>'quote_number'), '') AS quote_number,
      NULLIF(btrim(item->>'purchase_order'), '') AS purchase_order,
      CASE
        WHEN NULLIF(btrim(item->>'target_status'), '') IS NOT NULL
          THEN (item->>'target_status')::service_status
        ELSE NULL
      END AS target_status
    FROM jsonb_array_elements(p_updates) AS item
    WHERE NULLIF(item->>'id', '') IS NOT NULL
  ),
  filtered_updates AS (
    SELECT *
    FROM raw_updates
    WHERE quote_number IS NOT NULL
       OR purchase_order IS NOT NULL
       OR target_status IS NOT NULL
  ),
  updated_rows AS (
    UPDATE public.services AS s
    SET
      quote_number = COALESCE(u.quote_number, s.quote_number),
      purchase_order = COALESCE(u.purchase_order, s.purchase_order),
      status = COALESCE(u.target_status, s.status),
      updated_at = now()
    FROM filtered_updates AS u
    WHERE s.id = u.id
    RETURNING s.id
  )
  SELECT
    (SELECT COUNT(*) FROM filtered_updates),
    (SELECT COUNT(*) FROM updated_rows),
    COALESCE((SELECT array_agg(id) FROM updated_rows), '{}'),
    COALESCE((
      SELECT array_agg(u.id)
      FROM filtered_updates AS u
      LEFT JOIN updated_rows AS r ON r.id = u.id
      WHERE r.id IS NULL
    ), '{}')
  INTO
    v_input_count,
    v_updated_count,
    v_updated_ids,
    v_missing_ids;

  RETURN jsonb_build_object(
    'success', true,
    'input_count', v_input_count,
    'updated_count', v_updated_count,
    'updated_ids', to_jsonb(v_updated_ids),
    'missing_ids', to_jsonb(v_missing_ids)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

ALTER FUNCTION public.update_vip_services_batch(jsonb) OWNER TO postgres;

GRANT ALL ON FUNCTION public.update_vip_services_batch(jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_vip_services_batch(jsonb) TO service_role;
