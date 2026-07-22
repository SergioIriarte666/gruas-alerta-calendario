BEGIN;

-- La bitácora se instaló después de varios ciclos de prueba. Incluimos sólo cierres
-- recientes para que un operador sin servicios actuales no reciba una pantalla vacía,
-- evitando a la vez convertir todo el historial antiguo en ruido.
WITH assigned_operators AS (
  SELECT service.id AS service_id, service.operator_id
  FROM public.services service
  WHERE service.operator_id IS NOT NULL
  UNION
  SELECT resource.service_id, resource.operator_id
  FROM public.service_resources resource
  WHERE resource.resource_type = 'operator'
    AND resource.operator_id IS NOT NULL
),
recent_finished AS (
  SELECT
    assignment.operator_id AS activity_operator_id,
    service.*,
    row_number() OVER (
      PARTITION BY assignment.operator_id
      ORDER BY COALESCE(service.updated_at, service.created_at) DESC, service.id DESC
    ) AS operator_position
  FROM assigned_operators assignment
  JOIN public.services service ON service.id = assignment.service_id
  WHERE service.status IN ('completed', 'cancelled', 'failed')
    AND COALESCE(service.updated_at, service.created_at) >= now() - interval '45 days'
)
INSERT INTO public.operator_activity_events (
  operator_id,
  service_id,
  event_type,
  severity,
  title,
  description,
  metadata,
  dedupe_key,
  created_at
)
SELECT
  recent.activity_operator_id,
  recent.id,
  CASE WHEN recent.status = 'completed' THEN 'service_completed' ELSE 'service_cancelled' END,
  CASE
    WHEN recent.status = 'failed' THEN 'critical'
    WHEN recent.status = 'cancelled' THEN 'warning'
    ELSE 'success'
  END,
  CASE
    WHEN recent.status = 'failed' THEN 'Servicio con incidencia'
    WHEN recent.status = 'cancelled' THEN 'Servicio cancelado'
    ELSE 'Servicio finalizado'
  END,
  CASE
    WHEN recent.status = 'failed' THEN format('El servicio %s fue marcado con falla.', recent.folio)
    WHEN recent.status = 'cancelled' THEN format('El servicio %s fue cancelado.', recent.folio)
    ELSE format('El servicio %s fue completado correctamente.', recent.folio)
  END,
  jsonb_build_object(
    'folio', recent.folio,
    'status', recent.status,
    'service_date', recent.service_date,
    'historical_snapshot', true
  ),
  format('service:%s:historical:%s:%s', recent.id, recent.status, recent.activity_operator_id),
  COALESCE(recent.updated_at, recent.created_at, now())
FROM recent_finished recent
WHERE recent.operator_position <= 30
  AND NOT EXISTS (
    SELECT 1
    FROM public.operator_activity_events existing
    WHERE existing.operator_id = recent.activity_operator_id
      AND existing.service_id = recent.id
      AND existing.event_type = CASE
        WHEN recent.status = 'completed' THEN 'service_completed'
        ELSE 'service_cancelled'
      END
  )
ON CONFLICT (dedupe_key) DO NOTHING;

COMMIT;
