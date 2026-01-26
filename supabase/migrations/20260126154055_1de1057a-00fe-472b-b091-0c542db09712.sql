-- Modificar restricción de change_type para incluir SNAPSHOT
ALTER TABLE service_change_history 
DROP CONSTRAINT IF EXISTS service_change_history_change_type_check;

ALTER TABLE service_change_history 
ADD CONSTRAINT service_change_history_change_type_check 
CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'SNAPSHOT'));

-- Insertar snapshot inicial de todos los servicios existentes
INSERT INTO service_change_history (
  service_id, 
  service_folio, 
  changed_by, 
  changed_at, 
  change_type, 
  field_name, 
  old_value, 
  new_value, 
  change_context, 
  change_summary
)
SELECT 
  s.id,
  s.folio,
  s.created_by,
  s.created_at,
  'SNAPSHOT',
  'servicio',
  NULL,
  jsonb_build_object(
    'value', s.value,
    'purchase_order', s.purchase_order,
    'quote_number', s.quote_number,
    'status', s.status,
    'operator_commission', s.operator_commission,
    'client_covered_amount', s.client_covered_amount,
    'excess_amount', s.excess_amount,
    'insured_name', s.insured_name,
    'origin', s.origin,
    'destination', s.destination,
    'observations', s.observations,
    'vehicle_brand', s.vehicle_brand,
    'vehicle_model', s.vehicle_model,
    'license_plate', s.license_plate
  )::TEXT,
  'snapshot_inicial',
  'Snapshot inicial - Estado del servicio al momento de activar el historial'
FROM services s
WHERE NOT EXISTS (
  SELECT 1 FROM service_change_history h 
  WHERE h.service_id = s.id
);