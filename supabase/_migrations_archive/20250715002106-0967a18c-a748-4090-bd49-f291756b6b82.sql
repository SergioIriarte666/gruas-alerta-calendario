-- Actualizar el tipo de servicio "Servicios Mecánicos y De Apoyo" para hacerlo similar a taxi e insumos
UPDATE public.service_types 
SET 
  vehicle_info_optional = true,
  crane_required = false,
  operator_required = false,
  origin_required = false,
  destination_required = false
WHERE LOWER(name) LIKE '%servicios mecánicos%' 
   OR LOWER(name) LIKE '%servicios mecanicos%'
   OR LOWER(name) LIKE '%mecánicos y de apoyo%'
   OR LOWER(name) LIKE '%mecanicos y de apoyo%';