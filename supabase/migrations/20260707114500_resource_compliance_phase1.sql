BEGIN;

CREATE OR REPLACE FUNCTION public.get_resource_compliance(
  p_crane_id uuid DEFAULT NULL,
  p_operator_ids uuid[] DEFAULT NULL,
  p_service_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  resource_type text,
  resource_id uuid,
  resource_name text,
  item text,
  item_label text,
  expiry_date date,
  days_until int,
  level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT COALESCE(p_service_date, CURRENT_DATE)::date AS service_date
  ),
  crane_base AS (
    SELECT
      c.id AS resource_id,
      c.license_plate AS resource_name,
      c.technical_review_expiry,
      c.insurance_expiry,
      c.circulation_permit_expiry,
      c.status
    FROM public.cranes c
    WHERE p_crane_id IS NOT NULL
      AND c.id = p_crane_id
  ),
  crane_document_issues AS (
    SELECT
      'crane'::text AS resource_type,
      cb.resource_id,
      cb.resource_name,
      doc.item,
      doc.item_label,
      doc.expiry_date,
      (doc.expiry_date - p.service_date) AS days_until,
      CASE
        WHEN doc.expiry_date < p.service_date THEN 'error'
        WHEN doc.expiry_date <= p.service_date + 7 THEN 'warning'
        ELSE NULL
      END AS level
    FROM crane_base cb
    CROSS JOIN params p
    CROSS JOIN LATERAL (
      VALUES
        ('technical_review_expiry'::text, 'Revisión Técnica'::text, cb.technical_review_expiry),
        ('insurance_expiry'::text, 'Seguro'::text, cb.insurance_expiry),
        ('circulation_permit_expiry'::text, 'Permiso de Circulación'::text, cb.circulation_permit_expiry)
    ) AS doc(item, item_label, expiry_date)
    WHERE doc.expiry_date <= p.service_date + 7
  ),
  crane_status_issues AS (
    SELECT
      'crane'::text AS resource_type,
      cb.resource_id,
      cb.resource_name,
      'crane_status'::text AS item,
      format(
        'Grúa no activa (%s)',
        CASE cb.status
          WHEN 'inactive' THEN 'Inactiva'
          WHEN 'sold' THEN 'Vendida'
          WHEN 'written_off' THEN 'Dada de baja'
          ELSE 'Activa'
        END
      ) AS item_label,
      NULL::date AS expiry_date,
      NULL::int AS days_until,
      'error'::text AS level
    FROM crane_base cb
    WHERE cb.status <> 'active'
  ),
  operators_base AS (
    SELECT
      o.id AS resource_id,
      o.name AS resource_name,
      o.operator_type,
      o.exam_expiry
    FROM public.operators o
    WHERE p_operator_ids IS NOT NULL
      AND o.id = ANY (p_operator_ids)
      AND o.operator_type <> 'administrative'
  ),
  latest_operator_docs AS (
    SELECT DISTINCT ON (od.operator_id, od.document_type)
      od.operator_id,
      od.document_type,
      od.expiry_date
    FROM public.operator_documents od
    INNER JOIN operators_base ob
      ON ob.resource_id = od.operator_id
    WHERE od.document_type IN (
      'licencia_conducir',
      'examen_psicosensotecnico',
      'examen_altura',
      'seguro_vida'
    )
    ORDER BY
      od.operator_id,
      od.document_type,
      od.expiry_date DESC NULLS LAST,
      od.updated_at DESC,
      od.created_at DESC
  ),
  operator_document_issues AS (
    SELECT
      'operator'::text AS resource_type,
      ob.resource_id,
      ob.resource_name,
      doc.item,
      doc.item_label,
      doc.expiry_date,
      (doc.expiry_date - p.service_date) AS days_until,
      CASE
        WHEN doc.expiry_date < p.service_date AND doc.item = 'seguro_vida' THEN 'warning'
        WHEN doc.expiry_date < p.service_date THEN 'error'
        WHEN doc.expiry_date <= p.service_date + 7 THEN 'warning'
        ELSE NULL
      END AS level
    FROM operators_base ob
    CROSS JOIN params p
    JOIN LATERAL (
      SELECT
        lod.document_type AS item,
        CASE lod.document_type
          WHEN 'licencia_conducir' THEN 'Licencia de Conducir'
          WHEN 'examen_psicosensotecnico' THEN 'Examen Psicosensotécnico'
          WHEN 'examen_altura' THEN 'Examen de Altura'
          WHEN 'seguro_vida' THEN 'Seguro de Vida'
          ELSE lod.document_type
        END AS item_label,
        lod.expiry_date
      FROM latest_operator_docs lod
      WHERE lod.operator_id = ob.resource_id
        AND lod.expiry_date IS NOT NULL

      UNION ALL

      SELECT
        'examen_psicosensotecnico'::text AS item,
        'Examen Psicosensotécnico'::text AS item_label,
        ob.exam_expiry AS expiry_date
      WHERE ob.exam_expiry IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM latest_operator_docs lod
          WHERE lod.operator_id = ob.resource_id
            AND lod.document_type = 'examen_psicosensotecnico'
        )
    ) AS doc ON TRUE
    WHERE doc.expiry_date <= p.service_date + 7
  ),
  missing_license_issues AS (
    SELECT
      'operator'::text AS resource_type,
      ob.resource_id,
      ob.resource_name,
      'missing_licencia_conducir'::text AS item,
      'Licencia de Conducir'::text AS item_label,
      NULL::date AS expiry_date,
      NULL::int AS days_until,
      'warning'::text AS level
    FROM operators_base ob
    WHERE NOT EXISTS (
      SELECT 1
      FROM latest_operator_docs lod
      WHERE lod.operator_id = ob.resource_id
        AND lod.document_type = 'licencia_conducir'
    )
  )
  SELECT
    issues.resource_type,
    issues.resource_id,
    issues.resource_name,
    issues.item,
    issues.item_label,
    issues.expiry_date,
    issues.days_until,
    issues.level
  FROM (
    SELECT * FROM crane_document_issues WHERE level IS NOT NULL
    UNION ALL
    SELECT * FROM crane_status_issues
    UNION ALL
    SELECT * FROM operator_document_issues WHERE level IS NOT NULL
    UNION ALL
    SELECT * FROM missing_license_issues
  ) AS issues
  ORDER BY
    CASE issues.level WHEN 'error' THEN 0 ELSE 1 END,
    issues.resource_type,
    issues.resource_name,
    issues.item;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_compliance(uuid, uuid[], date) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_compliance_override(
  p_service_context jsonb,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo los administradores pueden autorizar recursos no aptos';
  END IF;

  IF coalesce(length(trim(p_reason)), 0) < 10 THEN
    RAISE EXCEPTION 'El motivo del override debe tener al menos 10 caracteres';
  END IF;

  INSERT INTO public.audit_log (operation, table_name, new_data, user_id)
  VALUES (
    'compliance_override',
    'services',
    jsonb_build_object('context', p_service_context, 'reason', trim(p_reason)),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_compliance_override(jsonb, text) TO authenticated;

COMMIT;
