BEGIN;

CREATE OR REPLACE FUNCTION public.get_fleet_compliance(
  p_reference_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  resource_type text,
  resource_id uuid,
  resource_name text,
  worst_level text,
  issues_count int,
  next_item_label text,
  next_expiry_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reference_date AS (
    SELECT COALESCE(p_reference_date, CURRENT_DATE)::date AS value
  ),
  crane_compliance AS (
    SELECT
      'crane'::text AS resource_type,
      c.id AS resource_id,
      c.license_plate::text AS resource_name,
      CASE
        WHEN COUNT(gc.item) FILTER (WHERE gc.level = 'error') > 0 THEN 'error'
        WHEN COUNT(gc.item) FILTER (WHERE gc.level = 'warning') > 0 THEN 'warning'
        ELSE 'ok'
      END::text AS worst_level,
      COUNT(gc.item)::int AS issues_count,
      (
        ARRAY_AGG(gc.item_label ORDER BY gc.expiry_date ASC NULLS LAST, CASE gc.level WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, gc.item_label)
        FILTER (WHERE gc.item IS NOT NULL)
      )[1]::text AS next_item_label,
      (
        ARRAY_AGG(gc.expiry_date ORDER BY gc.expiry_date ASC NULLS LAST, CASE gc.level WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, gc.item_label)
        FILTER (WHERE gc.item IS NOT NULL)
      )[1]::date AS next_expiry_date
    FROM public.cranes c
    CROSS JOIN reference_date rd
    LEFT JOIN LATERAL public.get_resource_compliance(c.id, NULL, rd.value) gc
      ON TRUE
    WHERE c.status = 'active'
    GROUP BY c.id, c.license_plate
  ),
  operator_compliance AS (
    SELECT
      'operator'::text AS resource_type,
      o.id AS resource_id,
      o.name::text AS resource_name,
      CASE
        WHEN COUNT(gc.item) FILTER (WHERE gc.level = 'error') > 0 THEN 'error'
        WHEN COUNT(gc.item) FILTER (WHERE gc.level = 'warning') > 0 THEN 'warning'
        ELSE 'ok'
      END::text AS worst_level,
      COUNT(gc.item)::int AS issues_count,
      (
        ARRAY_AGG(gc.item_label ORDER BY gc.expiry_date ASC NULLS LAST, CASE gc.level WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, gc.item_label)
        FILTER (WHERE gc.item IS NOT NULL)
      )[1]::text AS next_item_label,
      (
        ARRAY_AGG(gc.expiry_date ORDER BY gc.expiry_date ASC NULLS LAST, CASE gc.level WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, gc.item_label)
        FILTER (WHERE gc.item IS NOT NULL)
      )[1]::date AS next_expiry_date
    FROM public.operators o
    CROSS JOIN reference_date rd
    LEFT JOIN LATERAL public.get_resource_compliance(NULL, ARRAY[o.id], rd.value) gc
      ON TRUE
    WHERE o.is_active = TRUE
      AND o.operator_type = 'crane_operator'
    GROUP BY o.id, o.name
  )
  SELECT *
  FROM (
    SELECT * FROM crane_compliance
    UNION ALL
    SELECT * FROM operator_compliance
  ) compliance
  ORDER BY compliance.resource_type, compliance.resource_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_fleet_compliance(date) TO authenticated;

COMMIT;
